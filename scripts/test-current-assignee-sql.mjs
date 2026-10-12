import { readFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
const container = `clair-owner-boundary-${process.pid}`;
const image = "public.ecr.aws/supabase/postgres:17.6.1.165";
function docker(args, input) {
 const r = spawnSync("docker", args, { input, encoding: "utf8", maxBuffer: 4 * 1024 * 1024 });
 if (r.status !== 0) throw new Error(r.stderr.slice(-3500) + r.stdout.slice(-1000));
 return r.stdout;
}
const functions = [
 ["20260903003949_plan_order_work_lifecycle_and_rpc_boundary.sql", "clair_transition_fulfillment_work_item"],
 ["20260819172501_clinical_master_phase1b1_laboratory_slice.sql", "clair_save_lab_result_entry_v2"],
 ["20260927124324_lab_result_sheet_phase2.sql", "clair_get_lab_result_phase2"],
 ["20260927124324_lab_result_sheet_phase2.sql", "clair_save_lab_result_overall_finding"],
 ["20260929055945_lab_attachment_scoped_context.sql", "clair_prepare_lab_result_attachment"],
 ["20260906100558_clinical_master_execution_results.sql", "clair_get_order_execution_context"],
 ["20260906100558_clinical_master_execution_results.sql", "clair_record_order_execution_result"],
 ["20261006052000_fulfillment_queue_origin_chart.sql", "clair_list_fulfillment_work_items_v2"],
 ["20260520100000_billing_invoice_line_persistence_rpc.sql", "clair_save_billing_invoice_lines"],
 ["20260819172501_clinical_master_phase1b1_laboratory_slice.sql", "clair_save_lab_result_entry"],
 ...["clair_sync_billing_invoice_candidates", "clair_sync_billing_invoice_candidates_from_chart", "clair_sync_billing_invoice_candidates_from_fulfillment"].map(name => ["20260819150622_clinical_master_phase1a3_order_authority.sql", name]),
 ["20260906114732_clinical_master_lab_atomic_retest.sql", "clair_create_lab_atomic_retest"],
 ...["clair_prepare_billing_checkout_session", "clair_transition_billing_invoice_status", "clair_save_billing_payment_status", "clair_reverse_billing_review_invoice"].map(name => ["20260903003949_plan_order_work_lifecycle_and_rpc_boundary.sql", name]),
];
const legacySource = readFileSync("supabase/migrations/20260609112000_lab_result_entry_persistence.sql", "utf8");
const legacyAt = legacySource.indexOf("create or replace function public.clair_save_lab_result_entry(");
const legacyEnd = legacySource.indexOf("$$;", legacyAt) + 3;
const legacy = legacySource.slice(legacyAt, legacyEnd).replace("public.clair_save_lab_result_entry(", "public.clair_save_lab_result_entry_legacy_base(");
const baseline = "set check_function_bodies = off;\n" + legacy + "\ngrant execute on function public.clair_save_lab_result_entry_legacy_base(text,uuid,text,uuid,uuid,uuid,jsonb) to authenticated;\n" + functions.map(([file, name]) => {
 const s = readFileSync(`supabase/migrations/${file}`, "utf8");
 const at = s.search(new RegExp(`create(?: or replace)? function public\\.${name}\\(`, "i"));
 if (at < 0) throw new Error(`Missing function ${name}`);
 const tail = s.slice(at), match = tail.match(/\bas\s+(\$[a-zA-Z_]*\$)/i);
 if (!match) throw new Error(`Missing body ${name}`);
 return tail.slice(0, tail.indexOf(match[1], match.index + match[0].length) + match[1].length + 1);
}).join("\n");
const migration = readFileSync("supabase/migrations/20261012054346_current_assignee_mutation_boundary.sql", "utf8");
const fixture = readFileSync("tests/sql/current-assignee-boundary.sql", "utf8");
const sql = fixture.replace("-- BASELINE", () => baseline).replaceAll("-- MIGRATION", () => migration);
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
 if (!output.includes("ROLLBACK")) throw new Error("No rollback proof");
 const actorA = "00000000-0000-4000-8000-000000000001", actorB = "00000000-0000-4000-8000-000000000002";
 const order = "10000000-0000-4000-8000-000000000001", encounter = "20000000-0000-4000-8000-000000000001";
 const psqlArgs = ["exec", "-i", container, "psql", "-X", "-U", "supabase_admin", "-d", "ownership_test", "-v", "ON_ERROR_STOP=1"];
 docker(psqlArgs, `insert into users values ('${actorA}','A','active'),('${actorB}','B','active'); insert into orders(id,workspace_id,encounter_id) values ('${order}','workspace-a','${encounter}'); insert into order_fulfillment_work_items(id,workspace_id,order_id,assigned_to_user_id,status,request_cycle,created_at,destination_module,queue_type) values ('40000000-0000-4000-8000-000000000001','workspace-a','${order}','${actorA}','requested',1,now(),'lab','lab');`);
 function session(sql, onReady) {
  return new Promise(resolve => {
   const child = spawn("docker", psqlArgs);
   let stdout = "", stderr = "";
   child.stdout.on("data", chunk => { stdout += chunk; if (stdout.includes("HANDOFF_LOCKED")) onReady?.(); });
   child.stderr.on("data", chunk => { stderr += chunk; });
   child.on("close", code => resolve({ code, stdout, stderr }));
   child.stdin.end(sql);
  });
 }
 let locked;
 const lockedSignal = new Promise(resolve => { locked = resolve; });
 const transfer = session(`begin; select set_config('test.actor','${actorA}',true); select private.clair_assert_work_owner('workspace-a','${order}','${actorA}',true); update order_fulfillment_work_items set assigned_to_user_id='${actorB}'; select 'HANDOFF_LOCKED'; select pg_sleep(1); commit;`, locked);
 await lockedSignal;
 const oldWrite = session(`select set_config('test.actor','${actorA}',false); select private.clair_assert_work_owner('workspace-a','${order}','${actorA}',true);`);
 const [handed, rejected] = await Promise.all([transfer, oldWrite]);
 if (handed.code !== 0 || rejected.code === 0 || !rejected.stderr.includes("current_assignee_required")) throw new Error("Concurrent old-owner write was not rejected: " + JSON.stringify({handed,rejected}));
 docker(psqlArgs, `select set_config('test.actor','${actorB}',false); select private.clair_assert_work_owner('workspace-a','${order}','${actorB}',true);`);
 console.log("PASS: actual function patch anchors/apply/reapply; owner transfer/denial, immediate lab eligibility, invoice persistence/audit, inactive rejection, attachment publication denial/cleanup and two-session handoff vs stale write. Isolated synthetic schema; not full Supabase replay.");
} finally { if (owned) docker(["stop", container]); }
