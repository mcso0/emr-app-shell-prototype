import { readFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
const name = `clair-dispense-quantity-${process.pid}`;
const image = "public.ecr.aws/supabase/postgres:17.6.1.165";
function docker(args, input) {
  const r = spawnSync("docker", args, { input, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(r.stderr.slice(0,2200) + r.stderr.slice(-500) + r.stdout.slice(-1500));
  return r.stdout;
}
const lifecycle = readFileSync("supabase/migrations/20260903003949_plan_order_work_lifecycle_and_rpc_boundary.sql", "utf8");
function definition(source, functionName) {
  const start = source.search(new RegExp(`create(?: or replace)? function ${functionName.replaceAll(".", "\\.")}\\(`, "i"));
  if (start < 0) throw new Error(`Missing ${functionName}`);
  const tail = source.slice(start), delimiter = tail.match(/\bas\s+(\$[A-Za-z_]*\$)/i);
  return tail.slice(0, tail.indexOf(delimiter[1], delimiter.index + delimiter[0].length) + delimiter[1].length + 1);
}
// Load the real V1 schema chain and validator: unit enum rejection must be tested.
const masterContract = readFileSync("supabase/migrations/20260825234000_chart_order_execution_master_contract.sql", "utf8");
const sharedDraft = readFileSync("supabase/migrations/20260825240000_chart_order_shared_draft_contract.sql", "utf8");
const foundation = readFileSync("supabase/migrations/20260826150000_clinical_master_dispensing_order_foundation.sql", "utf8");
const presets = readFileSync("supabase/migrations/20260826200000_clinical_master_dispensing_master_presets.sql", "utf8");
const systemExam = readFileSync("supabase/migrations/20260831070617_clinical_master_system_exam_order_contract.sql", "utf8");
const schemaFunctions = [
  definition(masterContract, "private.clair_order_detail_field_schema_v1").replace("function private.clair_order_detail_field_schema_v1(", "function private.clair_order_detail_field_schema_v1_base("),
  definition(masterContract, "private.clair_order_field_schema_is_valid"),
  definition(foundation, "private.clair_order_detail_field_schema_v1").replace("function private.clair_order_detail_field_schema_v1(", "function private.clair_order_detail_field_schema_v1_pr019_base("),
  definition(presets, "private.clair_order_detail_field_schema_v1").replace("function private.clair_order_detail_field_schema_v1(", "function private.clair_order_detail_field_schema_v1_pr022_base("),
  definition(systemExam, "private.clair_order_detail_field_schema_v1"),
  definition(sharedDraft, "private.clair_order_detail_inputs_are_valid"),
].join("\n");
const v2 = readFileSync("supabase/migrations/20260906092729_clinical_master_planned_preparation_v2.sql", "utf8");
// Exercise the real legacy entry point too, including its existing V2 patch.
const legacyV2Patch = v2.slice(v2.indexOf("do $patch$"), v2.indexOf("end $patch$;") + "end $patch$;".length)
  .replace(/,\n\s*'public\.clair_mutate_chart_order_execution[^']*'/, "");
const setCompat = readFileSync("supabase/migrations/20260912113946_dispensing_set_confirmation_compatibility.sql", "utf8");
const b3Draft = readFileSync("supabase/migrations/20260820140000_clinical_master_phase1b3_chart_set_runtime.sql", "utf8");
const draftCompatPatch = setCompat.slice(setCompat.indexOf("do $patch_b3_writer_conflict_update$"), setCompat.indexOf("$patch_b3_writer_conflict_update$;", setCompat.indexOf("do $patch_b3_writer_conflict_update$")) + "$patch_b3_writer_conflict_update$;".length);
const draftBase = definition(b3Draft, "public.clair_save_chart_order_draft")
  .replace("function public.clair_save_chart_order_draft(", "function public.clair_save_chart_order_draft_phase2_base(");
const child = readFileSync("supabase/migrations/20261027094000_instruction_child_attempts.sql", "utf8");
const owner = readFileSync("supabase/migrations/20261012054346_current_assignee_mutation_boundary.sql", "utf8");
const childStart = child.indexOf("select pg_temp.patch_instruction_function('public.clair_mutate_chart_order_execution_origin_base");
const childPatches = definition(child, "pg_temp.patch_instruction_function") + "\n" + child.slice(childStart, child.indexOf("drop function pg_temp.patch_instruction_function"));
const baseFunctions = [
  draftBase,
  definition(setCompat, "private.clair_is_set_pricing_calculation_outputs"),
  draftCompatPatch,
  definition(lifecycle, "private.clair_plan_order_dispense_failure"),
  definition(lifecycle, "public.clair_confirm_chart_order_candidates").replaceAll("orders.applied_snapshot #>> '{planOrderAuthority,priceBasis}'", "private.clair_order_dispensing_authority(orders) ->> 'priceBasis'"),
  definition(owner, "private.clair_lock_work_ownership"),
  definition(lifecycle, "private.clair_calculate_aggregate_task_status"),
  definition(lifecycle, "private.clair_reject_prebilling_override_mutation"),
  definition(lifecycle, "private.clair_compute_plan_order_dispense_projection").replace("function private.clair_compute_plan_order_dispense_projection(", "function private.clair_compute_dispense_before_preparation_v2("),
  definition(v2, "private.clair_compute_plan_order_dispense_projection").replace("p_order.applied_snapshot->'planOrderAuthority'", "private.clair_order_dispensing_authority(p_order)"),
  definition(v2, "private.clair_normalize_preparation_v2"),
  definition(lifecycle, "public.clair_save_order_actual_dispense_override"),
  legacyV2Patch,
  "revoke all on function public.clair_save_order_actual_dispense_override(text,uuid,uuid,timestamptz,numeric,text,text) from public,anon,authenticated,service_role; grant execute on function public.clair_save_order_actual_dispense_override(text,uuid,uuid,timestamptz,numeric,text,text) to authenticated;",
  definition(setCompat, "private.clair_order_dispensing_authority"),
  definition(lifecycle, "private.clair_refresh_plan_order_dispense_projection"),
  definition(lifecycle, "public.clair_mutate_chart_order_execution").replace("function public.clair_mutate_chart_order_execution(", "function public.clair_mutate_chart_order_execution_origin_base(").replace(
    "      v_confirmed_snapshot := coalesce(\n        v_order.confirmed_snapshot,",
    "      v_calculation_outputs := private.clair_normalize_preparation_v2(v_calculation_outputs);\n      v_confirmed_snapshot := coalesce(\n        v_order.confirmed_snapshot,"),
  childPatches,
].join("\n");
const historyStart = lifecycle.indexOf("create table if not exists public.order_actual_dispense_overrides");
const historyEnd = lifecycle.indexOf("create or replace function private.clair_snapshot_order_billing_authority", historyStart);
const migration = readFileSync("supabase/migrations/20261031090000_dispense_request_quantities.sql", "utf8") + "\n" +
  readFileSync("supabase/migrations/20261101010000_dispensing_prescription_units.sql", "utf8") + "\n" +
  (process.env.SKIP_DRAFT_RETENTION_FIX === "1" ? "" : readFileSync("supabase/migrations/20261101040000_dispense_draft_manual_retention.sql", "utf8"));
const instructionFixture = readFileSync("tests/sql/dispensing-instruction.sql", "utf8");
const supportNames = ["order_tasks", "order_fulfillment_work_items", "order_revisions", "order_billing_candidates", "order_task_events", "invoices", "invoice_lines", "order_revision_fields", "order_execution_outbox"];
const support = instructionFixture.split("\n").filter(line => line.endsWith(";") && supportNames.some(name => line.startsWith(`create table public.${name}(`) || line.startsWith(`alter table public.${name} `))).join("\n");
const fixture = readFileSync("tests/sql/dispense-request-quantity.sql", "utf8")
  .replace("-- MUTATION SUPPORT", () => support)
  .replace("-- BASELINE", () => schemaFunctions + "\n" + lifecycle.slice(historyStart, historyEnd) + "\n" + baseFunctions)
  .replace("-- MIGRATION", () => migration)
  .replace("-- UNIT CONVERSION TESTS", () => readFileSync("tests/sql/dispensing-unit-conversion.sql", "utf8"))
  .replace("-- DRAFT RETENTION TESTS", () => readFileSync("tests/sql/dispense-draft-retention.sql", "utf8"))
  .replace("-- LEGACY BOUNDARY TESTS", () => readFileSync("tests/sql/dispense-legacy-boundary.sql", "utf8"));
let owned = false;
try {
  docker(["run", "--rm", "-d", "--name", name, "--network", "none", "-e", "POSTGRES_PASSWORD=synthetic-local-only", image]); owned = true;
  let ready = false;
  for (let i = 0; i < 45; i++) {
    if (spawnSync("docker", ["logs", name], { encoding: "utf8" }).stdout.includes("PostgreSQL init process complete") && spawnSync("docker", ["exec", name, "pg_isready", "-U", "supabase_admin"], { stdio: "ignore" }).status === 0) { ready = true; break; }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  if (!ready) throw new Error("Isolated PostgreSQL unavailable");
  docker(["exec", name, "createdb", "-U", "supabase_admin", "-T", "template0", "dispense_test"]);
  const output = docker(["exec", "-i", name, "psql", "-X", "-U", "supabase_admin", "-d", "dispense_test", "-v", "ON_ERROR_STOP=1"], fixture.replace(/rollback;\s*$/, "commit;"));
  if (!output.includes("PASS dispense request quantities") || !output.includes("COMMIT")) throw new Error("Missing verification markers");
  const psql = ["exec", "-i", name, "psql", "-X", "-U", "supabase_admin", "-d", "dispense_test", "-v", "ON_ERROR_STOP=1"];
  const stamp = docker([...psql, "-At"], "select updated_at from orders where id='20000000-0000-4000-8000-000000000001';").trim();
  function session(query, onLocked) {
    return new Promise(resolve => {
      const child = spawn("docker", psql); let stdout = "", stderr = "";
      child.stdout.on("data", chunk => { stdout += chunk; if (stdout.includes("WRITE_LOCKED")) onLocked?.(); });
      child.stderr.on("data", chunk => { stderr += chunk; });
      child.on("close", code => resolve({ code, stdout, stderr })); child.stdin.end(query);
    });
  }
  const command = key => `set local role authenticated; select set_config('test.actor','00000000-0000-4000-8000-000000000001',true); select public.clair_save_order_dispense_request('hospital-a','00000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','${stamp}',1.7,'manual','${key}');`;
  let locked;
  const signal = new Promise(resolve => { locked = resolve; });
  const first = session(`begin; ${command("concurrent-writer-one")} select 'WRITE_LOCKED'; select pg_sleep(1); commit;`, locked);
  await Promise.race([signal, first.then(result => { throw new Error("First concurrent writer failed: " + JSON.stringify(result)); })]);
  const second = session(`begin; ${command("concurrent-writer-two")} commit;`);
  const results = await Promise.all([first, second]);
  if (results[0].code !== 0 || results[1].code === 0 || !results[1].stderr.includes("revision_conflict")) throw new Error("Concurrent stale write was not rejected: " + JSON.stringify(results));
  console.log("PASS: actual calculation, manual/rule RPCs, re-request task/fulfillment/billing snapshots, child mode reset, RLS and concurrent CAS in isolated synthetic PostgreSQL. Permission helpers and support schema are synthetic; real V1 detail validation is loaded; not full Supabase replay. No shared/remote DB writes.");
} finally { if (owned) docker(["stop", name]); }
