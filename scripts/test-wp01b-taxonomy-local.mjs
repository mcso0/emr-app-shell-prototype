// Only a named local synthetic Docker PostgreSQL container; every change rolls back.
import fs from "node:fs";
import { spawnSync } from "node:child_process";
const chartPlanV2 = process.argv.includes("--chart-plan-v2");
const medicationLinkMigration = "supabase/migrations/20260908083048_treatment_medication_link_at_execution.sql";
const chartPlanMigration = "supabase/migrations/20260908083019_order_ready_planning_and_catalog_archive.sql";
const workspaceDefaultsMigration = "supabase/migrations/20260908083035_ready_orders_synthetic_workspace_normalization.sql";
const artifact = "docs/work/clinical-master/order-execution-defaults/artifacts/wp-01b/";
const payload = JSON.parse(fs.readFileSync("tests/fixtures/clinical-master-execution-preset-release-v1.json", "utf8"));
payload.releaseKey = "wp01b.taxonomy.local-test.r1";
payload.releaseNotes = "Local rollback-only taxonomy regression; synthetic only.";
payload.records = payload.records.filter(r => r.masterKey === "cm.order.lab.panel.cbc-basic");
payload.classificationPaths = [];
payload.labPanelItems = [];
payload.labOrderProfiles = payload.labOrderProfiles.filter(p => p.orderMasterKey === "cm.order.lab.panel.cbc-basic");
Object.assign(payload.records[0].detail, { adminSubcategoryCode: "clinical-pathology", labFamilyCode: "cbc" });
const dispensing = JSON.parse(fs.readFileSync("docs/work/clinical-master/order-execution-defaults/artifacts/wp-03/dispensing-definitions.non-applied.v2.json", "utf8"));
const dispensingPayload = { ...payload, releaseKey: "wp03.products.local-test.r1", releaseNotes: "Synthetic product authority local rollback only",
  records: dispensing.records, classificationPaths: [], labPanelItems: [], labOrderProfiles: [] };
const treatment = JSON.parse(fs.readFileSync("docs/work/clinical-master/order-execution-defaults/artifacts/wp-04/treatment-definitions.non-applied.v2.json", "utf8"));
const treatmentPayload = { ...payload, releaseKey: "wp04.treatment.local-test.r1", releaseNotes: "Synthetic treatment V2 local rollback only",
  records: treatment.records, classificationPaths: [], labPanelItems: [], labOrderProfiles: [] };
const cbc = JSON.parse(fs.readFileSync("docs/work/clinical-master/order-execution-defaults/artifacts/oed-lab-04/cbc-runtime.non-applied.v1.json", "utf8"));
const cbcPayload = { ...payload, releaseKey: "oed-lab04.cbc.local-test.r1", releaseNotes: "Synthetic CBC profiles local rollback only",
  records: cbc.records, classificationPaths: [], labPanelItems: [], labOrderProfiles: cbc.labOrderProfiles,
  labResultProfiles: cbc.profiles, labResultProfileOrderKeys: cbc.requiresProfileOrderKeys, labCompositions: cbc.compositions };
const allLab = JSON.parse(fs.readFileSync("docs/work/clinical-master/order-execution-defaults/artifacts/oed-lab-04/all-runtime.non-applied.v1.json", "utf8"));
const allLabPayload = { ...cbcPayload, releaseKey: "oed-lab04.all.local-test.r1", records: allLab.records,
  labOrderProfiles: allLab.labOrderProfiles, labResultProfiles: allLab.profiles, labResultProfileOrderKeys: allLab.requiresProfileOrderKeys, labCompositions: allLab.compositions };
const imaging = JSON.parse(fs.readFileSync("docs/work/clinical-master/order-execution-defaults/artifacts/wp-06/imaging-definitions.non-applied.v1.json", "utf8"));
const imagingPayload = { ...payload, releaseKey: "wp06.imaging.local-test.r1", records: imaging.records, classificationPaths: [], labPanelItems: [], labOrderProfiles: [] };
const remaining = JSON.parse(fs.readFileSync("docs/work/clinical-master/order-execution-defaults/artifacts/wp-07/remaining-definitions.non-applied.v1.json", "utf8"));
const remainingPayload = { ...payload, releaseKey: "wp07.remaining.local-test.r1", records: [...remaining.supportingRecords,...remaining.records], classificationPaths: remaining.classificationPaths, labPanelItems: [], labOrderProfiles: [] };
const completePayload = JSON.parse(fs.readFileSync("docs/work/clinical-master/order-execution-defaults/artifacts/wp-09/combined-release.non-applied.v1.json", "utf8")).payload;
const sql = "BEGIN;\nSET LOCAL statement_timeout='90s';\n" +
  fs.readFileSync("supabase/migrations/20260903003949_plan_order_work_lifecycle_and_rpc_boundary.sql", "utf8") + "\n" +
  fs.readFileSync("supabase/migrations/20260906074651_clinical_master_order_taxonomy_fields.sql", "utf8") +
  "\n" + fs.readFileSync("supabase/migrations/20260906084227_clinical_master_chart_catalog_lineage.sql", "utf8") +
  "\n" + fs.readFileSync("supabase/migrations/20260906084900_clinical_master_execution_field_merge.sql", "utf8") +
  "\n" + fs.readFileSync("supabase/migrations/20260906092729_clinical_master_planned_preparation_v2.sql", "utf8") +
  "\n" + fs.readFileSync("supabase/migrations/20260906094043_clinical_master_preparation_authority_storage.sql", "utf8") +
  "\n" + fs.readFileSync("supabase/migrations/20260906100558_clinical_master_execution_results.sql", "utf8") +
  "\n" + fs.readFileSync("supabase/migrations/20260906103022_clinical_master_treatment_planning_v2.sql", "utf8") +
  "\n" + fs.readFileSync("supabase/migrations/20260906105031_clinical_master_treatment_actual_results.sql", "utf8") +
  "\n" + fs.readFileSync("supabase/migrations/20260906110344_clinical_master_lab_result_profiles_v2.sql", "utf8") +
  "\n" + fs.readFileSync("supabase/migrations/20260906112359_clinical_master_lab_projection_selected_pins.sql", "utf8") +
  "\n" + fs.readFileSync("supabase/migrations/20260906114732_clinical_master_lab_atomic_retest.sql", "utf8") +
  "\n" + fs.readFileSync("supabase/migrations/20260906120152_clinical_master_lab_compositions.sql", "utf8") +
  "\n" + fs.readFileSync("supabase/migrations/20260906123903_clinical_master_lab_workspace_profile_overrides.sql", "utf8") +
  "\n" + fs.readFileSync("supabase/migrations/20260906124059_clinical_master_inpatient_locations.sql", "utf8") +
  "\n" + fs.readFileSync("supabase/migrations/20260906124122_clinical_master_chart_actual_results.sql", "utf8") +
  "\n" + fs.readFileSync("supabase/migrations/20260906135526_clinical_master_synthetic_dispensing_rebind.sql", "utf8") +
  (chartPlanV2 ? "\n" + fs.readFileSync(chartPlanMigration, "utf8") : "") +
  (chartPlanV2 ? "\n" + fs.readFileSync(workspaceDefaultsMigration, "utf8") + "\n" + fs.readFileSync(medicationLinkMigration, "utf8") : "") +
  "\n" + fs.readFileSync(artifact + "slice-03-taxonomy-db-setup.sql", "utf8") + "\nSAVEPOINT package_scenarios;\n" +
  "\nCREATE TEMP TABLE taxonomy_test_payload (payload jsonb);\nINSERT INTO taxonomy_test_payload VALUES ('" + JSON.stringify(payload).replaceAll("'", "''") + "'::jsonb);\n" +
  fs.readFileSync(artifact + "taxonomy-fields-local-assert.sql", "utf8") +
  "\n" + fs.readFileSync("docs/work/clinical-master/order-execution-defaults/artifacts/wp-02/execution-fields-local-assert.sql", "utf8") +
  "\n" + fs.readFileSync("docs/work/clinical-master/order-execution-defaults/artifacts/wp-03/preparation-v2-local-assert.sql", "utf8") +
  "\n" + fs.readFileSync("docs/work/clinical-master/order-execution-defaults/artifacts/wp-03/preparation-v2-rpc-local-assert.sql", "utf8") +
  "\n" + fs.readFileSync("docs/work/clinical-master/order-execution-defaults/artifacts/wp-08/execution-results-local-assert.sql", "utf8") +
  "\nCREATE TEMP TABLE wp03_product_payload(payload jsonb); INSERT INTO wp03_product_payload VALUES ('" + JSON.stringify(dispensingPayload).replaceAll("'", "''") + "'::jsonb);\n" +
  fs.readFileSync("docs/work/clinical-master/order-execution-defaults/artifacts/wp-03/product-authority-local-assert.sql", "utf8") +
  "\nCREATE TEMP TABLE wp04_treatment_payload(payload jsonb); INSERT INTO wp04_treatment_payload VALUES ('" + JSON.stringify(treatmentPayload).replaceAll("'", "''") + "'::jsonb);\n" +
  fs.readFileSync("docs/work/clinical-master/order-execution-defaults/artifacts/wp-04/treatment-v2-local-assert.sql", "utf8") +
  "\nCREATE TEMP TABLE lab04_cbc_payload(payload jsonb); INSERT INTO lab04_cbc_payload VALUES ('" + JSON.stringify(cbcPayload).replaceAll("'", "''") + "'::jsonb);\n" +
  fs.readFileSync("docs/work/clinical-master/order-execution-defaults/artifacts/oed-lab-04/profiles-local-assert.sql", "utf8") +
  "\nCREATE TEMP TABLE lab04_all_payload(payload jsonb); INSERT INTO lab04_all_payload VALUES ('" + JSON.stringify(allLabPayload).replaceAll("'", "''") + "'::jsonb);\n" +
  fs.readFileSync("docs/work/clinical-master/order-execution-defaults/artifacts/oed-lab-04/all-local-assert.sql", "utf8") +
  "\n" + fs.readFileSync("docs/work/clinical-master/order-execution-defaults/artifacts/oed-lab-04/overrides-local-assert.sql", "utf8") +
  "\nCREATE TEMP TABLE wp06_imaging_payload(payload jsonb); INSERT INTO wp06_imaging_payload VALUES ('" + JSON.stringify(imagingPayload).replaceAll("'", "''") + "'::jsonb);\n" +
  fs.readFileSync("docs/work/clinical-master/order-execution-defaults/artifacts/wp-06/imaging-local-assert.sql", "utf8") +
  "\nCREATE TEMP TABLE wp07_remaining_payload(payload jsonb); INSERT INTO wp07_remaining_payload VALUES ('" + JSON.stringify(remainingPayload).replaceAll("'", "''") + "'::jsonb);\n" +
  fs.readFileSync("docs/work/clinical-master/order-execution-defaults/artifacts/wp-07/inpatient-local-assert.sql", "utf8") +
  "\n" + fs.readFileSync("docs/work/clinical-master/order-execution-defaults/artifacts/wp-07/chart-actual-local-assert.sql", "utf8") +
  (chartPlanV2 ? "\n" + fs.readFileSync("docs/work/clinical-master/order-execution-defaults/artifacts/wp-10/chart-plan-local-assert.sql", "utf8") : "") +
  (chartPlanV2 ? "\n" + fs.readFileSync("docs/work/clinical-master/order-execution-defaults/artifacts/wp-10/treatment-link-local-assert.sql", "utf8") : "") +
  // Package tests deliberately create conflicting r2-r6 versions; the full candidate
  // must be tested against the original seeded source, not those test-only mutations.
  "\nROLLBACK TO SAVEPOINT package_scenarios;\nCREATE TEMP TABLE wp09_complete_payload(payload jsonb); INSERT INTO wp09_complete_payload VALUES ('" + JSON.stringify(completePayload).replaceAll("'", "''") + "'::jsonb);\n" +
  fs.readFileSync("docs/work/clinical-master/order-execution-defaults/artifacts/wp-09/combined-local-assert.sql", "utf8") +
  "\nROLLBACK TO SAVEPOINT package_scenarios;\nCREATE TEMP TABLE wp09_rebind_payload(payload jsonb); INSERT INTO wp09_rebind_payload VALUES ('" + JSON.stringify(completePayload).replaceAll("'", "''") + "'::jsonb);\n" +
  "\nCREATE TEMP TABLE wp09_seed_payload(payload jsonb); INSERT INTO wp09_seed_payload VALUES ('" + fs.readFileSync("tests/fixtures/clinical-master-execution-preset-release-v1.json", "utf8").replaceAll("'", "''") + "'::jsonb);\n" +
  fs.readFileSync("docs/work/clinical-master/order-execution-defaults/artifacts/wp-09/dispensing-rebind-local-assert.sql", "utf8") + "\nROLLBACK;\n";
const run = spawnSync("docker", ["exec", "-i", "supabase_db_clinical-preset-perf-seeded-20260831", "psql", "-X", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1"], { input: sql, encoding: "utf8", maxBuffer: 2e6 });
process.stdout.write((run.stdout ?? "").split("\n").filter(line => !/^(CREATE|ALTER|REVOKE|GRANT|DROP|UPDATE|INSERT|COMMENT|SELECT|SET)( |$)/.test(line)).join("\n"));
process.stderr.write(run.stderr ?? "");
if (run.error) throw run.error;
process.exitCode = run.status ?? 1;
