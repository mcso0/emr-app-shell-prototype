import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
const container = `clair-chart-summary-${process.pid}`;
const docker = (args, input) => {
  const result = spawnSync("docker", args, { input, encoding: "utf8", maxBuffer: 4 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(result.stderr + result.stdout);
  return result.stdout;
};
const source = readFileSync("supabase/migrations/20260908211856_encounter_multi_chart.sql", "utf8");
const start = source.indexOf("create function public.clair_mutate_chart_order_execution_for_chart(");
const baseline = source.slice(start, source.indexOf("create function public.clair_mutate_chart_order_execution(", start));
const migration = readFileSync("supabase/migrations/20261027121000_chart_execution_mutation_summary.sql", "utf8");
const fixture = readFileSync("tests/sql/chart-execution-mutation-summary.sql", "utf8");
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
    return docker(["exec", "-i", container, "psql", "-X", "-U", "supabase_admin", "-d", database, "-v", "ON_ERROR_STOP=1"], fixture.replace("-- WRAPPER", () => wrapper));
  };
  let reproduced = false;
  try { run("before_fix", baseline); } catch (error) { if (!String(error).includes("missing_authoritative_summary")) throw error; reproduced = true; }
  if (!reproduced) throw new Error("Baseline did not reproduce the defect");
  run("after_fix", baseline + migration);
  console.log("PASS: baseline response defect reproduced; authoritative summary, broadcast, replay, scope/actor checks and transaction rollback verified. Synthetic wrapper dependencies only.");
} finally { docker(["stop", container]); }
