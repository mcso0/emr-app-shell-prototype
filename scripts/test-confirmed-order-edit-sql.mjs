// Uses a disposable local Docker DB with the current application migrations.
// Synthetic fixtures are wrapped in a transaction and always rolled back.
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
const container = process.env.CONFIRMED_EDIT_TEST_CONTAINER;
const database = process.env.CONFIRMED_EDIT_TEST_DATABASE;
if (!container || !database || !/^[a-zA-Z0-9_-]+$/.test(container) || !/^[a-zA-Z0-9_-]+$/.test(database)) {
  throw new Error("Set CONFIRMED_EDIT_TEST_CONTAINER and CONFIRMED_EDIT_TEST_DATABASE to a disposable local test DB.");
}
const inspection = spawnSync("docker", ["inspect", "--format", "{{.HostConfig.NetworkMode}}", container], { encoding: "utf8" });
if (inspection.status !== 0 || inspection.stdout.trim() !== "none") throw new Error("Only an isolated Docker container with network mode none is accepted.");
const baseSql = readFileSync(new URL("../tests/sql/confirmed-order-edit.sql", import.meta.url), "utf8");
const followupSql = baseSql.slice(0, baseSql.indexOf("do $$\ndeclare d jsonb; r jsonb;")) + readFileSync(new URL("../tests/sql/selected-billing-prepayment.sql", import.meta.url), "utf8");
for (const [name, sql] of [["sql", baseSql], ["selected-billing-prepayment", followupSql]]) {
const result = spawnSync("docker", ["exec", "-i", container, "psql", "-X", "-U", "supabase_admin", "-d", database, "-v", "ON_ERROR_STOP=1"], {
  input: sql, encoding: "utf8", maxBuffer: 4 * 1024 * 1024,
});
mkdirSync(".artifacts/confirmed-order-edit", { recursive: true });
writeFileSync(`.artifacts/confirmed-order-edit/${name}.log`, result.stdout + result.stderr);
if (result.status !== 0 || !result.stdout.includes("ROLLBACK")) {
  process.stderr.write(result.stderr); process.exit(result.status || 1);
}
console.log("Confirmed order edit SQL regressions passed; all synthetic rows rolled back.");
if (result.stderr.includes("WarnSendingBroadcastMessage")) console.log("Local Realtime delivery is not configured; RPC/state/notification-row assertions passed.");

}
