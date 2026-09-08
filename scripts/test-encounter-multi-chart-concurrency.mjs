import { readFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
const args = process.argv.slice(2);
const container = args[args.indexOf("--container") + 1];
const template = args[args.indexOf("--template") + 1];
if (!args.includes("--container") || !args.includes("--template") || !/^chart-pr037-[a-z0-9-]+$/.test(container ?? "") || !/^chart_pr037_[a-z0-9_]+$/.test(template ?? "")) throw new Error("Use only an explicitly owned multi-chart container/template.");
const database = `chart_pr037_concurrent_${Date.now()}`;
const cli = ["exec", "-i", container, "psql", "-X", "-U", "supabase_admin", "-v", "ON_ERROR_STOP=1", "-At"];
const sync = (db, sql) => {
  const result = spawnSync("docker", [...cli, "-d", db], { input: sql, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(result.stderr);
  return result.stdout.trim();
};
const sqlQuote = (text) => `'${text.replaceAll("'", "''")}'`;
const actor = "49110000-0000-4000-8000-000000000003";
const workspace = "workspace-clair-cheongdam";
const encounter = "96372000-0000-4000-8000-000000000002";
const session = `begin; set local role authenticated; select set_config('request.jwt.claim.sub','${actor}',true); select set_config('request.jwt.claim.role','authenticated',true);`;
const run = (sql) => new Promise((resolve) => {
  const child = spawn("docker", [...cli, "-d", database]);
  let stdout = "", stderr = "";
  child.stdout.on("data", (data) => { stdout += data; }); child.stderr.on("data", (data) => { stderr += data; });
  child.on("close", (status) => resolve({ status, stdout, stderr }));
  child.stdin.end(`${session}\n${sql}\ncommit;`);
});
const value = (result) => JSON.parse(result.stdout.split("\n").find((line) => line.startsWith("{")) ?? "null");
let created = false;
try {
  sync("postgres", `create database ${database} template ${template};`); created = true;
  sync(database, `begin; ${readFileSync("supabase/migrations/20260908152329_encounter_multi_chart.sql", "utf8")} commit;`);
  const fixture = readFileSync("tests/sql/encounter_multi_chart_soap_contract.sql", "utf8").split("set local role authenticated;")[0].replaceAll("96370000", "96372000").replaceAll("MULTI-CHART-037", "MULTI-CHART-CONCURRENT-037");
  sync(database, `${fixture}\ncommit;`);
  const create = (requestId) => `select public.clair_create_encounter_chart('${workspace}','${actor}','${encounter}','${requestId}');`;
  const [first, retry] = await Promise.all([run(create("96372000-0000-4000-8000-000000000101")), run(create("96372000-0000-4000-8000-000000000101"))]);
  if (first.status || retry.status || value(first)?.id !== value(retry)?.id) throw new Error("Concurrent creation failed or duplicated");
  const a = value(first), bResult = await run(create("96372000-0000-4000-8000-000000000102")), b = value(bResult);
  const save = (chart, text) => {
    const doc = { schemaVersion: 2, scopes: [{ scopeKey: "default", scope: "default", systemLabel: "기본 SOAP", blocks: [{ id: "text", type: "paragraph", props: { backgroundColor: "default", textColor: "default", textAlignment: "left" }, content: [{ type: "text", text, styles: {} }], children: [] }] }] };
    return `select public.clair_save_chart_soap_note_v4('${workspace}','${actor}','${encounter}','${chart.id}',${sqlQuote(JSON.stringify({ blockDocument: doc, subjective: "", objective: "", assessment: "", plan: "" }))}::jsonb,'${chart.updatedAt}');`;
  };
  const competing = await Promise.all([run(save(a, "Writer one")), run(save(a, "Writer two"))]);
  if (competing.filter((r) => r.status === 0).length !== 1 || !competing.some((r) => r.stderr.includes("soap_note_conflict"))) throw new Error(`Same-chart CAS did not admit exactly one writer: ${competing.map((r) => `${r.status}: ${r.stderr}`).join(" | ")}`);
  const currentA = value(competing.find((r) => r.status === 0));
  const separate = await Promise.all([run(save(currentA, "Independent A")), run(save(b, "Independent B"))]);
  if (separate.some((r) => r.status !== 0)) throw new Error(`Independent chart save failed: ${separate.map((r) => r.stderr).join(" ")}`);
  const count = sync(database, `select count(*) from public.soap_notes where encounter_id='${encounter}';`);
  if (count !== "2") throw new Error("Concurrent creation fabricated rows");
  // A routed set creates child execution tasks. Exercise the opposite callers
  // against the same root lock using independent PostgreSQL sessions.
  const orderFixture = readFileSync("tests/sql/encounter_multi_chart_order_contract.sql", "utf8").split("set local role authenticated;")[0]
    .replaceAll("phase5-consult", "phase5-imaging-child").replaceAll("'consultation', '진료'", "'imaging', '영상'")
    .replaceAll("'chart_only', false", "'imaging', true");
  sync(database, `${orderFixture} update public.order_sets set source_set_version='order-set-revision-1' where id='phase5-set'; commit;`);
  const orderEncounter = "95000000-0000-4000-8000-000000000002";
  const rootId = "95000000-0000-4000-8000-000000000103";
  const setup = await run(`do $setup$
    declare c uuid; draft jsonb; wi jsonb; child uuid;
    begin
      c := (public.clair_create_encounter_chart('${workspace}','${actor}','${orderEncounter}',gen_random_uuid())->>'id')::uuid;
      draft := public.clair_get_chart_order_draft('${workspace}','${orderEncounter}');
      draft := public.clair_save_chart_order_draft_for_chart('${workspace}','${actor}','${orderEncounter}',c,
        jsonb_build_object('expectedEtag',draft->'etag','rows',jsonb_build_array(jsonb_build_object(
          'rowType','set','orderId','${rootId}','sourceSetId','phase5-set',
          'sourceSetRevisionId','95000000-0000-4000-8000-000000000020','sourceSetRevisionNo',1,
          'selectionIntent','{"items":[{"revisionItemId":"95000000-0000-4000-8000-000000000021","selected":true,"quantity":1},{"revisionItemId":"95000000-0000-4000-8000-000000000022","selected":true,"quantity":1}]}'::jsonb,
          'detailInputs','{}'::jsonb,'detailSchemaVersion',1,'priority','normal',
          'childInputs','[{"revisionItemId":"95000000-0000-4000-8000-000000000021","detailInputs":{"specimenType":"blood","testPanel":"CBC","collectionCondition":"room temperature"},"detailSchemaVersion":1,"priority":"normal"},{"revisionItemId":"95000000-0000-4000-8000-000000000022","detailInputs":{"bodyRegion":"abdomen","position":"VD","viewCount":2,"contrastRequired":false,"sedationRequired":false},"detailSchemaVersion":1,"priority":"normal"}]'::jsonb))));
      perform public.clair_confirm_chart_order_candidates_for_chart('${workspace}','${actor}','${orderEncounter}',c,array['${rootId}'::uuid],draft->>'etag','concurrent-set-confirm');
      wi := public.clair_list_fulfillment_work_items('${workspace}','lab','${orderEncounter}',null,null)->0;
      perform public.clair_transition_fulfillment_work_item('${workspace}','${actor}',(wi->>'id')::uuid,'start',(wi->>'rowRevision')::bigint,gen_random_uuid(),null,null,null);
    end $setup$;`);
  if (setup.status) throw new Error(`${setup.stderr} ${setup.stdout}`);
  const origin = sync(database, `select origin_chart_id from public.orders where id='${rootId}';`);
  const child = sync(database, `select id from public.orders where parent_chart_order_line_id='${rootId}' and destination_module='lab';`);
  const lockRace = await Promise.all([
    run(`set local lock_timeout='5s'; select public.clair_mutate_chart_order_execution_for_chart('${workspace}','${actor}','${origin}','${rootId}','cancel','Synthetic concurrency cancellation',1,'{}','concurrent-root-cancel');`),
    run(`set local lock_timeout='5s'; select public.clair_save_chart_order_lifecycle('${workspace}','${actor}','${orderEncounter}','${child}','in_progress',null);`),
  ]);
  for (const result of lockRace) {
    if (result.status && !/lifecycle_state_mismatch|order_already_cancelled|order_not_editable|order_revision_conflict|order_lifecycle_state_mismatch/.test(result.stderr)) throw new Error(`Root/child lock race failed: ${result.stderr}`);
  }
  if (lockRace.every((r) => r.status)) throw new Error("Neither competing operation made progress");
  const origins = sync(database, `select count(*) from public.orders where (id='${rootId}' or parent_chart_order_line_id='${rootId}') and origin_chart_id is distinct from '${origin}'::uuid;`);
  if (origins !== "0") throw new Error("Concurrent execution changed order origin");
  const inconsistent = sync(database, `select count(*) from public.orders root join public.orders child on child.parent_chart_order_line_id=root.id where root.id='${rootId}' and root.status='cancelled' and child.status<>'cancelled';`);
  if (inconsistent !== "0") throw new Error("Root cancellation left active children");
  console.log("PASS concurrent root cancellation / child lifecycle synchronization without deadlocks; origin preserved");
  console.log("PASS concurrent create/retry, same-chart conflict, independent-chart saves; two charts preserved");
} finally {
  if (created) sync("postgres", `drop database ${database};`);
}
