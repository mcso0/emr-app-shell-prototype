import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const container = `lab-input-warnings-${process.pid}`;
const image = "public.ecr.aws/supabase/postgres:17.6.1.165";
function docker(args, input) {
  const result = spawnSync("docker", args, { input, encoding: "utf8", maxBuffer: 4 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(result.stderr.slice(-3000) + result.stdout.slice(-1000));
  return result.stdout;
}
const old = readFileSync("supabase/migrations/20260906110344_clinical_master_lab_result_profiles_v2.sql", "utf8");
function extract(start, end) {
  const at = old.indexOf(start), until = old.indexOf(end, at);
  if (at < 0 || until < 0) throw new Error(`Missing baseline anchor: ${start}`);
  return old.slice(at, until);
}
const baseline = [
  extract("create function private.clair_lab_profile_rule_valid", "create function private.clair_lab_result_profile_valid"),
  extract("create function private.clair_evaluate_lab_profile_value", "create function private.clair_freeze_lab_result_profile"),
  extract("create function private.clair_derive_lab_result_profile_value", "do $patch$"),
  extract("create function private.clair_guard_lab_profile_completion", "create function public.clair_get_lab_result_profile_configuration"),
].join("\n");
const migration = readFileSync("supabase/migrations/20261006100000_lab_result_input_warnings.sql", "utf8");
const fixture = readFileSync("tests/sql/lab-input-warnings.sql", "utf8");
const sql = fixture.replace("-- BASELINE", () => baseline).replace("-- MIGRATION", () => migration + "\n" + migration);
let owned = false;
try {
  docker(["run", "--detach", "--rm", "--name", container, "--network", "none", "-e", "POSTGRES_PASSWORD=synthetic-local-test", image]);
  owned = true;
  if (docker(["inspect", "--format", "{{.HostConfig.NetworkMode}}", container]).trim() !== "none") throw new Error("Requires isolated local Postgres");
  let ready = false;
  for (let i = 0; i < 30; i++) {
    const probe = spawnSync("docker", ["exec", container, "pg_isready", "-U", "postgres"], { encoding: "utf8" });
    if (probe.status === 0) { ready = true; break; }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  if (!ready) throw new Error("Owned Postgres did not start");
  const output = docker(["exec", "-i", container, "psql", "-X", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1"], sql);
  if (!output.includes("PASS lab_input_warnings") || !output.includes("ROLLBACK")) throw new Error("Missing SQL completion markers");
  console.log("PASS: isolated SQL apply/reapply, TS-compatible raw warnings, row trigger, V1, legacy metadata, qualifier permissions, unchanged required-completion guard, rollback");
} finally {
  if (owned) docker(["stop", container]);
}
