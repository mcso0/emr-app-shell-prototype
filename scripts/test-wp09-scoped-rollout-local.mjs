// Fixed local synthetic Docker DB only. Installation, fixtures, and even the
// commit=true scenario live inside one outer transaction that always rolls back.
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
const folder = "docs/work/clinical-master/order-execution-defaults/artifacts/wp-09/";
const combined = JSON.parse(readFileSync(`${folder}combined-release.non-applied.v1.json`, "utf8"));
const configuration = JSON.parse(readFileSync(`${folder}workspace-configuration.non-applied.v1.json`, "utf8"));
const seed = JSON.parse(readFileSync("tests/fixtures/clinical-master-execution-preset-release-v1.json", "utf8"));
const packet = { payload: combined.payload, configuration,
  retiredKeys: combined.retirementPlan.map(row => row.originalMasterKey), newKeys: combined.newOrders };
// Reuse the existing verified migration order without executing its scenarios.
const baselineHarness = readFileSync("scripts/test-wp01b-taxonomy-local.mjs", "utf8");
const migrations = [...baselineHarness.matchAll(/fs\.readFileSync\("(supabase\/migrations\/[^"]+\.sql)"/g)].map(match => match[1]);
if (migrations.length < 17 || new Set(migrations).size !== migrations.length
  || migrations.at(-1) !== "supabase/migrations/20260906135526_clinical_master_synthetic_dispensing_rebind.sql") throw Error("wp09_local_migration_baseline_drift");
migrations.splice(1, 0, "supabase/migrations/20260906070813_clinical_master_admin_classification_read.sql");
migrations.push("supabase/migrations/20260906141337_clinical_master_oed_scoped_rollout.sql");
const migrationSources = migrations.map(file => readFileSync(file, "utf8"));
console.log(JSON.stringify({ localOnly: true, outerRollback: true, migrations: migrations.length, migrationSha256: createHash("sha256").update(migrationSources.at(-1)).digest("hex"),
  configurationSha256: configuration.artifactSha256 }));
const literal = value => `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
const sql = ["BEGIN; SET LOCAL statement_timeout='180s';", ...migrationSources,
  // Some included migrations set their own timeout. Reapply a bounded budget
  // for the three complete rollback/apply scenarios in the assertion DO block.
  "SET LOCAL statement_timeout='300s';",
  "SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);",
  `CREATE TEMP TABLE wp09_scoped_input(packet jsonb,seed jsonb); INSERT INTO wp09_scoped_input VALUES (${literal(packet)},${literal(seed)});`,
  readFileSync(`${folder}scoped-rollout-local-assert.sql`, "utf8"), "ROLLBACK;"].join("\n");
const run = spawnSync("docker", ["exec", "-i", "supabase_db_clinical-preset-perf-seeded-20260831", "psql", "-X", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1"],
  { input: sql, encoding: "utf8", maxBuffer: 2e6 });
process.stdout.write((run.stdout ?? "").split("\n").filter(line => !/^(CREATE|ALTER|REVOKE|GRANT|DROP|UPDATE|INSERT|COMMENT|SELECT|SET)( |$)/.test(line)).join("\n"));
process.stderr.write(run.stderr ?? "");
if (run.error) throw run.error;
process.exitCode = run.status ?? 1;
