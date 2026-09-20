import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const migrationPath = process.argv[2];
if (!/^supabase\/migrations\/\d+_plan_order_optional_adjustment_reason\.sql$/.test(migrationPath ?? "")) {
  throw new Error("Supply the exact local optional-adjustment-reason migration path.");
}
const container = "chart-pr038-postgres";
const database = "chart_pr038_verified";
const inspection = spawnSync("docker", ["inspect", "--format", "{{.HostConfig.NetworkMode}}", container], { encoding: "utf8" });
if (inspection.status !== 0 || inspection.stdout.trim() !== "none") {
  throw new Error("Requires the owned network-isolated chart-pr038-postgres container; shared or remote DBs are forbidden.");
}
const migration = readFileSync(resolve(migrationPath), "utf8");
const fixture = readFileSync(resolve("tests/sql/plan_order_optional_reason_contract.sql"), "utf8");
const sql = fixture.replace("begin;", `begin;\n${migration}\n${migration}\n`);
const result = spawnSync("docker", ["exec", "-i", container, "psql", "-X", "-U", "supabase_admin", "-d", database, "-v", "ON_ERROR_STOP=1"], {
  input: sql, encoding: "utf8", maxBuffer: 4 * 1024 * 1024,
});
if (result.status !== 0 || !result.stdout.includes("PASS plan_order_optional_reason_contract") || !result.stdout.includes("ROLLBACK")) {
  process.stderr.write(result.stdout.slice(-2000) + result.stderr.slice(-4000));
  throw new Error("SQL contract failed or lacked completion/rollback markers.");
}
console.log("PASS: migration apply/reapply, signed linkage, optional reason, actor/workspace/CAS/idempotency guards, history/audit, privileges/RLS, transaction rollback");
