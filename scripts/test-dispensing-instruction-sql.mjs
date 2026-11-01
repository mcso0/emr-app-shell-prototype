import { readFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
const overallInstructions = process.argv.includes("--overall-instructions");
const container = `clair-instruction-${process.pid}`;
const image = "public.ecr.aws/supabase/postgres:17.6.1.165";
function docker(args, input) {
 const r = spawnSync("docker", args, { input, encoding: "utf8", maxBuffer: 4 * 1024 * 1024 });
 if (r.status !== 0) throw new Error(r.stderr.slice(-3500) + r.stdout.slice(-1000));
 return r.stdout;
}
const definitions = [
 ["20260825240000_chart_order_shared_draft_contract.sql", "public.clair_save_chart_order_draft"],
 ["20260912113946_dispensing_set_confirmation_compatibility.sql", "private.clair_b3_runtime_row_json"],
 ["20260906100558_clinical_master_execution_results.sql", "private.clair_execution_result_payload_valid"],
 ["20260903003949_plan_order_work_lifecycle_and_rpc_boundary.sql", "private.clair_assert_order_task_identity_and_history"],
 ["20260903003949_plan_order_work_lifecycle_and_rpc_boundary.sql", "private.clair_calculate_aggregate_task_status"],
 ["20261012054346_current_assignee_mutation_boundary.sql", "private.clair_lock_work_ownership"],
 ["20260906100558_clinical_master_execution_results.sql", "private.clair_guard_execution_result_completion"],
];
definitions.push(
 ["20261012054346_current_assignee_mutation_boundary.sql", "private.clair_assert_work_owner"],
 ["20260903003949_plan_order_work_lifecycle_and_rpc_boundary.sql", "public.clair_transition_fulfillment_work_item"],
 ["20260906100558_clinical_master_execution_results.sql", "public.clair_get_order_execution_context"],
 ["20260906100558_clinical_master_execution_results.sql", "public.clair_record_order_execution_result"],
 ["20260819150622_clinical_master_phase1a3_order_authority.sql", "public.clair_sync_billing_invoice_candidates_from_fulfillment"],
 ["20260903003949_plan_order_work_lifecycle_and_rpc_boundary.sql", "public.clair_mutate_chart_order_execution"],
);
if (overallInstructions) definitions.push(
 ["20260908211856_encounter_multi_chart.sql", "private.clair_require_chart_encounter"],
 ["20260908211856_encounter_multi_chart.sql", "private.clair_require_order_encounter"],
 ["20260908211856_encounter_multi_chart.sql", "private.clair_require_order_chart"],
 ["20260908083019_order_ready_planning_and_catalog_archive.sql", "public.clair_record_chart_actual_result"],
);
let baseline = "set check_function_bodies=off;\n" + definitions.map(([file,name]) => {
 const s=readFileSync(`supabase/migrations/${file}`,"utf8");
 const at=s.search(new RegExp(`create(?: or replace)? function ${name.replaceAll(".","\\.")}\\(`,"i"));
 if(at<0) throw new Error(name);
 const tail=s.slice(at),match=tail.match(/\bas\s+(\$[a-zA-Z_]*\$)/i);
 let body=tail.slice(0,tail.indexOf(match[1],match.index+match[0].length)+match[1].length+1);
 if(name==="private.clair_assert_order_task_identity_and_history") body=body.replace("or new.status <> 'pending'", "or (tg_op = 'INSERT' and new.status <> 'pending')");
 // Reconstruct the relevant, separately-tested October owner patch anchors.
 if(name==="public.clair_save_chart_order_draft") body=body.replace("public.clair_save_chart_order_draft(", "public.clair_save_chart_order_draft_candidate_base(");
 if(name==="public.clair_record_order_execution_result") body=body.replace("  if wi.row_revision is distinct from p_expected_revision then", "  perform private.clair_assert_work_owner(p_workspace_id,wi.order_id,p_actor_user_id);\n  if wi.row_revision is distinct from p_expected_revision then");
 if(name==="public.clair_get_order_execution_context") body=body.replace("'canRecord',t.id=wi.task_id and private", "'canRecord',t.id=wi.task_id and coalesce(wi.assigned_to_user_id=auth.uid(),false) and private");
 if(name==="public.clair_sync_billing_invoice_candidates_from_fulfillment") body=body.replace("  return private.clair_sync_billing_invoice_candidates_internal(", "  if exists(select 1 from public.order_fulfillment_work_items wi where wi.workspace_id=p_workspace_id and wi.encounter_id=p_encounter_id and wi.order_id=any(p_order_ids) and wi.assigned_to_user_id is distinct from p_actor_user_id) then raise exception 'current_assignee_required' using errcode='42501'; end if;\n  return private.clair_sync_billing_invoice_candidates_internal(");
 if(name==="public.clair_mutate_chart_order_execution") body=body.replace("public.clair_mutate_chart_order_execution(", "public.clair_mutate_chart_order_execution_origin_base(");
 if(name==="public.clair_record_order_execution_result") body=body.replaceAll("public.clair_save_chart_order_lifecycle(", "public.clair_save_chart_order_lifecycle_internal(");
 if(name==="public.clair_record_chart_actual_result") body=body.replaceAll("public.clair_save_chart_order_lifecycle(", "public.clair_save_chart_order_lifecycle_internal(");
 return body;
}).join("\n");
// Apply the actual intervening patches, including parent timestamps and encounter
// ownership locking, rather than testing a pre-September function shape.
const multiChart = readFileSync("supabase/migrations/20260908211856_encounter_multi_chart.sql", "utf8");
baseline += "\n" + multiChart.slice(multiChart.indexOf("do $fulfillment_aggregate$"), multiChart.indexOf("end $fulfillment_aggregate$;") + "end $fulfillment_aggregate$;".length);
baseline += "\n" + readFileSync("supabase/migrations/20260912230700_dispensing_execution_billing_candidate_handoff.sql", "utf8");
const ownerPatch = readFileSync("supabase/migrations/20261012054346_current_assignee_mutation_boundary.sql", "utf8");
baseline += "\n" + ownerPatch.slice(ownerPatch.indexOf("do $patch$"), ownerPatch.indexOf(" signature:='public.clair_save_lab_result_entry_v2")) + "\nend $patch$;";
const migration = ["20261027091000_dispensing_instruction_workflow.sql", "20261027092000_instruction_execution_authority.sql", "20261027093000_instruction_notifications.sql", "20261027094000_instruction_child_attempts.sql", "20261027095000_instruction_draft_notes.sql", "20261027110000_instruction_display_names.sql", "20261031120000_instruction_review_fixes.sql", ...(overallInstructions ? ["20261027130000_chart_oral_instructions.sql", "20261101140000_overall_instructions.sql"] : [])].map(file=>readFileSync(`supabase/migrations/${file}`, "utf8")).join("\n");
const fixture = readFileSync("tests/sql/dispensing-instruction.sql", "utf8")
 .replace("rollback;", () => readFileSync("tests/sql/instruction-review-fixes.sql", "utf8") + (overallInstructions ? readFileSync("tests/sql/overall-instructions.sql", "utf8") + readFileSync("tests/sql/overall-instructions-boundaries.sql", "utf8") : "") + "\nrollback;");
const notificationSource = readFileSync("supabase/migrations/20260705133000_notification_event_persistence.sql", "utf8");
const notificationTable = notificationSource.slice(notificationSource.indexOf("create table if not exists public.notification_events"), notificationSource.indexOf("create table if not exists public.notification_user_states"))
 .replace("references public.workspaces(id) on delete cascade", "");
const sql = fixture.replace("-- NOTIFICATION TABLE", notificationTable).replace("-- BASELINE", () => (overallInstructions ? readFileSync("tests/sql/overall-instructions-schema.sql", "utf8") : "") + baseline).replaceAll("-- MIGRATION", () => migration);
let owned = false;
try {
 docker(["run", "--detach", "--rm", "--name", container, "--network", "none", "-e", "POSTGRES_PASSWORD=synthetic-local-test", image]); owned = true;
 let ready = false;
 for (let i = 0; i < 60; i++) {
  const log = spawnSync("docker", ["logs", container], { encoding: "utf8" });
  const initialized = /init process complete;[\s\S]*database system is ready to accept connections/.test(log.stdout + log.stderr);
  if (initialized && spawnSync("docker", ["exec", container, "pg_isready", "-U", "supabase_admin"]).status === 0) { ready = true; break; }
  await new Promise(r => setTimeout(r, 1000));
 }
 if (!ready) throw new Error("Isolated SQL did not start");
 docker(["exec", container, "createdb", "-U", "supabase_admin", "-T", "template0", "ownership_test"]);
 const output = docker(["exec", "-i", container, "psql", "-X", "-U", "supabase_admin", "-d", "ownership_test", "-v", "ON_ERROR_STOP=1"], sql);
 if (!output.includes("ROLLBACK")) throw new Error("Missing rollback proof");
 const psql = ["exec", "-i", container, "psql", "-X", "-U", "supabase_admin", "-d", "ownership_test", "-v", "ON_ERROR_STOP=1"];
 const seed = fixture.slice(fixture.indexOf("-- Synthetic fixture"), fixture.indexOf("do $$\ndeclare d jsonb; cmd jsonb;"));
 docker(psql, seed + "\ncommit;");
 const revision = docker([...psql, "-At"], "select set_config('test.actor','00000000-0000-4000-8000-000000000001',false); select public.clair_get_fulfillment_instruction('workspace-a','40000000-0000-4000-8000-000000000002')->>'revision';").trim().split("\n").at(-1);
 function session(query, onReady) {
   return new Promise(resolve => {
     const child = spawn("docker", psql); let stdout = "", stderr = "";
     child.stdout.on("data", chunk => { stdout += chunk; if (stdout.includes("CLAIM_LOCKED")) onReady?.(); });
     child.stderr.on("data", chunk => { stderr += chunk; });
     child.on("close", code => resolve({ code, stdout, stderr })); child.stdin.end(query);
   });
 }
 const claim = (actor) => `select set_config('test.actor','${actor}',true); select public.clair_mutate_fulfillment_instruction('workspace-a','40000000-0000-4000-8000-000000000002',jsonb_build_object('action','claim','commandId',gen_random_uuid(),'expectedRevision','${revision}'));`;
 let locked; const signal = new Promise(resolve => { locked = resolve; });
 const first = session(`begin; ${claim("00000000-0000-4000-8000-000000000001")} select 'CLAIM_LOCKED'; select pg_sleep(1); commit;`, locked);
 await signal;
 const second = session(`begin; ${claim("00000000-0000-4000-8000-000000000002")} commit;`);
 const results = await Promise.all([first, second]);
 if (results[0].code !== 0 || results[1].code === 0 || !results[1].stderr.includes("revision_conflict")) throw new Error("Concurrent claims did not reject the stale contender: " + JSON.stringify(results));
 if (overallInstructions) {
  const source = readFileSync("tests/sql/overall-instructions.sql", "utf8");
  docker(psql, "begin; select set_config('test.actor','00000000-0000-4000-8000-000000000003',true);\n" + source.slice(0, source.indexOf("do $$")) + "\ncommit;");
  const chart = "51000000-0000-4000-8000-000000000001", task = "53000000-0000-4000-8000-000000000001", wi = "54000000-0000-4000-8000-000000000001";
  const actor = n => `select set_config('test.actor','00000000-0000-4000-8000-00000000000${n}',true);`;
  const apply = revision => `select public.clair_apply_overall_instructions('workspace-a','${chart}',jsonb_build_object('commandId',gen_random_uuid(),'changes',jsonb_build_array(jsonb_build_object('scope','overall','expectedRevision',${revision},'operation','set','instruction','Concurrent revision ${revision + 1}'))));`;
  docker(psql, `begin; ${actor(3)} ${apply(0)} commit;`);
  const version = docker([...psql, "-At"], `select private.clair_task_effective_instructions('workspace-a','${task}')->>'versionKey';`).trim();
  async function whileLocked(firstSql, secondSql) {
   let signalLocked;
   const signal = new Promise(resolve => { signalLocked = resolve; });
   const first = session(`begin; set local statement_timeout='8s'; ${firstSql} select 'CLAIM_LOCKED'; select pg_sleep(0.4); commit;`, signalLocked);
   await Promise.race([signal, first.then(result => { throw new Error("First session exited before taking locks: " + JSON.stringify(result)); })]);
   return Promise.all([first, session(`begin; set local statement_timeout='8s'; ${secondSql} commit;`)]);
  }
  const ackRace = await whileLocked(`${actor(3)} ${apply(1)}`, `${actor(2)} select public.clair_acknowledge_task_instructions('workspace-a','${task}','${version}');`);
  if (ackRace[0].code !== 0 || ackRace[1].code === 0 || !ackRace[1].stderr.includes("instruction_version_conflict")) throw new Error("Concurrent acknowledgement accepted a stale vector: " + JSON.stringify(ackRace));
  // Reproduce the chart-wrapper / apply lock ordering, including the later
  // underlying ownership lock. Before the new helper ordering this deadlocks.
  let chartLocked;
  const chartSignal = new Promise(resolve => { chartLocked = resolve; });
  const chartFirst = session(`begin; set local statement_timeout='8s'; ${actor(3)} select private.clair_require_order_chart('workspace-a',auth.uid()::text,'20000000-0000-4000-8000-000000000001','${chart}'); select 'CLAIM_LOCKED'; select pg_sleep(0.4); select private.clair_lock_work_ownership('workspace-a','52000000-0000-4000-8000-000000000001'); commit;`, chartLocked);
  await Promise.race([chartSignal, chartFirst.then(result => { throw new Error("Chart lock failed: " + JSON.stringify(result)); })]);
  const chartRace = await Promise.all([chartFirst, session(`begin; set local statement_timeout='8s'; ${actor(3)} ${apply(2)} commit;`)]);
  if (chartRace.some(result => result.code !== 0)) throw new Error("Chart / apply lock ordering failed: " + JSON.stringify(chartRace));
  docker(psql, `begin; ${actor(1)} select public.clair_acknowledge_task_instructions('workspace-a','${task}',private.clair_task_effective_instructions('workspace-a','${task}')->>'versionKey'); select public.clair_mutate_fulfillment_instruction('workspace-a','${wi}',jsonb_build_object('action','claim','commandId',gen_random_uuid(),'expectedRevision',public.clair_get_fulfillment_instruction('workspace-a','${wi}')->>'revision')); commit;`);
  const completionRace = await whileLocked(`${actor(1)} select public.clair_mutate_fulfillment_instruction('workspace-a','${wi}',jsonb_build_object('action','complete','itemId','${wi}','commandId',gen_random_uuid(),'expectedRevision',public.clair_get_fulfillment_instruction('workspace-a','${wi}')->>'revision'));`, `${actor(3)} ${apply(3)}`);
  if (completionRace.some(result => result.code !== 0)) throw new Error("Completion / apply race failed: " + JSON.stringify(completionRace));
  docker(psql, `do $$ begin
   if (select document#>>'{versions,overall}' from private.task_instruction_snapshots where task_id='${task}' and phase='completed')<>'3'
    or private.clair_task_effective_instructions('workspace-a','${task}')#>>'{versions,overall}'<>'4' then raise exception 'completion snapshot changed with later instructions'; end if;
  end $$;`);
  console.log("PASS: two-session stale acknowledgement, chart/apply lock ordering, and completion snapshot serialization.");
 }
 if (overallInstructions) console.log("PASS: overall instructions migration and scoped synthetic assertions.");
 console.log("PASS: instruction lifecycle, common-text completion preservation/history, notifications, role denial, replay/stale writes, billing guard, workspace isolation and concurrent claim. Isolated synthetic schema; not full Supabase replay.");
} finally { if (owned) docker(["stop", container]); }
