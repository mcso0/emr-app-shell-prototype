import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
const container = `clair-chart-requester-${process.pid}`;
const docker = (args, input) => {
  const result = spawnSync("docker", args, { input, encoding: "utf8", maxBuffer: 4 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(result.stderr + result.stdout);
  return result.stdout;
};
const migration = readFileSync("supabase/migrations/20261027125000_chart_order_requester_display.sql", "utf8");
const fixture = readFileSync("tests/sql/chart-order-requester-display.sql", "utf8");
try {
  docker(["run", "--detach", "--rm", "--name", container, "--network", "none", "-e", "POSTGRES_PASSWORD=synthetic-local-test", "public.ecr.aws/supabase/postgres:17.6.1.165"]);
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    const logs = spawnSync("docker", ["logs", container], { encoding: "utf8" });
    if (/init process complete;[\s\S]*database system is ready to accept connections/.test(logs.stdout + logs.stderr)) { ready = true; break; }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  if (!ready) throw new Error("Isolated database did not start");
  const run = (database, wrapper) => {
    docker(["exec", container, "createdb", "-U", "supabase_admin", "-T", "template0", database]);
    return docker(["exec", "-i", container, "psql", "-X", "-U", "supabase_admin", "-d", database, "-v", "ON_ERROR_STOP=1"], fixture.replace("-- MIGRATION", () => wrapper));
  };
  let reproduced = false;
  try { run("before_fix", ""); } catch (error) { if (!String(error).includes("missing_requester")) throw error; reproduced = true; }
  if (!reproduced) throw new Error("Baseline did not reproduce the defect");
  run("after_fix", migration);
  console.log("PASS: baseline response defect reproduced; requester IDs/names for individual, set and child rows, missing users, existing fields, unchanged orders and function security contract verified. Synthetic projection fixture only.");
} finally { docker(["stop", container]); }
