// Only the named synthetic local Docker DB; every statement rolls back.
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
const folder = "docs/work/clinical-master/order-execution-defaults/artifacts/";
const read = name => JSON.parse(readFileSync(folder + name, "utf8"));
const baselineHarness = readFileSync("scripts/test-wp01b-taxonomy-local.mjs", "utf8");
const migrations = [...baselineHarness.matchAll(/fs\.readFileSync\("(supabase\/migrations\/[^\"]+\.sql)"/g)].map(match => match[1]);
if (new Set(migrations).size !== migrations.length || migrations.length < 17) throw Error("wp10_local_baseline_drift");
migrations.splice(1, 0, "supabase/migrations/20260906070813_clinical_master_admin_classification_read.sql");
migrations.unshift("supabase/migrations/20260831132225_clinical_master_publisher_set_based_owner_revision.sql",
  "supabase/migrations/20260831135847_clinical_master_publisher_set_based_finalization.sql");
migrations.push("supabase/migrations/20260906141337_clinical_master_oed_scoped_rollout.sql",
  "supabase/migrations/20260906161551_clinical_master_oed_lab_owner_cascade.sql",
  "supabase/migrations/20260907054704_clinical_master_oed_scalar_memory.sql",
  "supabase/migrations/20260908083019_order_ready_planning_and_catalog_archive.sql",
  "supabase/migrations/20260908083035_ready_orders_synthetic_workspace_normalization.sql",
  "supabase/migrations/20260908083048_treatment_medication_link_at_execution.sql",
  "supabase/migrations/20260908083938_wp10_scalar_state_fingerprints.sql",
  "supabase/migrations/20260908085242_wp10_rehearsal_evidence_receipt.sql",
  "supabase/migrations/20260908092110_wp10_rehearsal_failure_diagnostics.sql",
  "supabase/migrations/20260908093016_wp10_resource_readback_diagnostics.sql",
  "supabase/migrations/20260908094229_wp10_freeze_extra_set_archive_targets.sql");
const projectionPlanProof = [
  "CREATE TEMP TABLE wp10_projection_before AS SELECT id,private.clinical_master_order_source_projection(id)::text AS projection FROM master.master_records WHERE record_type='order' UNION ALL SELECT 'ffffffff-ffff-4fff-8fff-ffffffffffff'::uuid,private.clinical_master_order_source_projection('ffffffff-ffff-4fff-8fff-ffffffffffff')::text;",
  readFileSync("supabase/migrations/20260908092115_wp10_cached_source_projection_plans.sql", "utf8"),
  "DO $$BEGIN IF EXISTS(SELECT 1 FROM wp10_projection_before WHERE projection IS DISTINCT FROM private.clinical_master_order_source_projection(id)::text) THEN RAISE EXCEPTION 'test projection output changed'; END IF; RAISE NOTICE 'WP10 all current projection outputs and nonexistent identity byte-equal; attributes preserved'; END$$;"
].join("\n");
const literal = value => `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
const proposal = read("wp-10/ready-orders.non-applied.v1.json");
const sql = ["BEGIN;", ...migrations.map(file => readFileSync(file, "utf8")), projectionPlanProof,
  "SET LOCAL statement_timeout='600s'; SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);",
  `CREATE TEMP TABLE wp09_seed_payload(payload jsonb); INSERT INTO wp09_seed_payload VALUES (${literal(JSON.parse(readFileSync("tests/fixtures/clinical-master-execution-preset-release-v1.json", "utf8")))});`,
  `CREATE TEMP TABLE wp09_rebind_payload(payload jsonb); INSERT INTO wp09_rebind_payload VALUES (${literal(read("wp-09/combined-release.non-applied.v1.json").payload)});`,
  readFileSync(folder + "wp-09/dispensing-rebind-local-assert.sql", "utf8"),
  // The historical local fixture has no pilot membership. Seed only inside
  // this rollback transaction; remote operation must use an existing admin.
  "INSERT INTO public.user_memberships(workspace_id,user_id,roles,status) VALUES ('workspace-clinical-master-pilot-v1','00000000-0000-4000-8000-000000000001',ARRAY['hospital_admin'],'active') ON CONFLICT (workspace_id,user_id) DO NOTHING;",
  // Complete the missing local pilot OWNER fixture, not production permissions.
  // The remote preflight must find an existing actor with both permissions.
  "SELECT set_config('request.jwt.claim.sub','',true); UPDATE public.workspace_membership_permission_role_assignments a SET permission_role_id=r.id,owner_source='explicit' FROM public.workspace_permission_roles r,public.user_memberships u WHERE u.workspace_id='workspace-clinical-master-pilot-v1' AND u.user_id='00000000-0000-4000-8000-000000000001' AND a.membership_id=u.id AND r.workspace_id=u.workspace_id AND r.role_type='owner'; SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);",
  `CREATE TEMP TABLE wp10_input(proposal jsonb,prices jsonb,resources jsonb); INSERT INTO wp10_input VALUES (${literal(proposal)},${literal(read("wp-10/common-prices.non-applied.v1.json"))},${literal(read("wp-10/resources.non-applied.v1.json"))});`,
  readFileSync(folder + (process.argv.includes("--packet") ? "wp-10/reset-packet-local-assert.sql" : "wp-10/catalog-reset-local-assert.sql"), "utf8"), ...(process.argv.includes("--packet") ? [readFileSync(folder+"wp-10/nested-extra-set-local-assert.sql", "utf8")] : []), readFileSync(folder+"wp-10/rehearsal-cancel-local-assert.sql", "utf8"), "ROLLBACK;"].join("\n");
const run = spawnSync("docker", ["exec", "-i", "supabase_db_clinical-preset-perf-seeded-20260831", "psql", "-X", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1"],
  { input: sql, encoding: "utf8", maxBuffer: 2e6 });
process.stdout.write((run.stdout ?? "").split("\n").filter(line => !/^(CREATE|ALTER|REVOKE|GRANT|DROP|UPDATE|INSERT|COMMENT|SELECT|SET)( |$)/.test(line)).join("\n"));
process.stderr.write(run.stderr ?? "");
if (run.error) throw run.error;
process.exitCode = run.status ?? 1;
