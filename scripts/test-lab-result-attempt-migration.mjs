// Replay the migration over populated legacy results in an owned isolated clone.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
const container=process.env.CONFIRMED_EDIT_TEST_CONTAINER, template=process.env.CONFIRMED_EDIT_TEST_DATABASE;
assert.ok([container,template].every(v=>typeof v==='string' && /^[a-zA-Z0-9_-]+$/.test(v)));
const invoke=(args,input)=>spawnSync('docker',args,{input,encoding:'utf8',maxBuffer:4*1024*1024});
assert.equal(invoke(['inspect','--format','{{.HostConfig.NetworkMode}}',container]).stdout.trim(),'none');
const database=`lab_attempt_migration_${process.pid}`;
assert.equal(invoke(['exec',container,'createdb','-U','supabase_admin','--template',template,database]).status,0);
const args=['exec','-i',container,'psql','-X','-qAt','-U','supabase_admin','-d',database,'-v','ON_ERROR_STOP=1'];
const sql=input=>{const r=invoke(args,input);assert.equal(r.status,0,r.stderr);return r.stdout.trim();};
const migration=name=>readFileSync(new URL(`../supabase/migrations/${name}.sql`,import.meta.url),'utf8');
try {
 assert.equal(sql("select to_regclass('public.lab_result_entries_canonical_attempt_unique') is null"),'t','Pre-change schema required');
 sql(migration('20261116110000_shared_order_workflow'));
 const base=readFileSync(new URL('../tests/sql/confirmed-order-edit.sql',import.meta.url),'utf8').split('do $$\ndeclare d jsonb; r jsonb;')[0];
 const legacy=readFileSync(new URL('../tests/sql/shared-examination-workflow.sql',import.meta.url),'utf8').split('create function pg_temp.exam_action')[0]
  .replace('work_item_id,task_id,task_attempt_no,result_status','work_item_id,result_status')
  .replace("wi.id,wi.task_id,1,'received'","wi.id,'received'");
 sql(base+legacy+`
 do $$
 declare w text:='synthetic-order-edit'; wi public.order_fulfillment_work_items; e public.lab_result_entries; ctx jsonb;
 begin
  perform set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000003',true);
  for wi in select * from public.order_fulfillment_work_items where workspace_id=w and queue_type in ('lab','external_lab') loop
   perform public.clair_transition_fulfillment_work_item(w,auth.uid(),wi.id,'start',wi.row_revision,gen_random_uuid(),null,null,null);
   select * into e from public.lab_result_entries where work_item_id=wi.id;
   perform public.clair_save_lab_result_entry_v2(w,auth.uid(),e.result_id,wi.encounter_id,wi.order_id,wi.id,0,gen_random_uuid(),jsonb_build_array(jsonb_build_object('rowId',repeat('a',64),'value','7','note','Preserved legacy note')));
   perform public.clair_save_lab_result_overall_finding(w,e.result_id,0,'Preserved legacy finding');
   if wi.queue_type='external_lab' then
    perform public.clair_transition_fulfillment_work_item(w,auth.uid(),wi.id,'complete',(select row_revision from public.order_fulfillment_work_items where id=wi.id),gen_random_uuid(),null,null,null);
    perform set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000001',true);
    ctx:=public.clair_get_confirmed_order_edit(w,'85000000-0000-4000-8000-000000000001',wi.order_id);
    perform pg_temp.edit(wi.order_id,null,jsonb_build_object('detailSchemaVersion',1,'detailInputs',ctx->'detailInputs'||'{"shippingCondition":"Legacy next attempt"}'::jsonb),'Synthetic migration re-request');
    perform set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000003',true);
   end if;
  end loop;
 end $$;
 commit;`);
 const state=`select jsonb_build_object(
 'entries',(select jsonb_object_agg(id,md5((to_jsonb(e)-'task_id'-'task_attempt_no')::text)) from public.lab_result_entries e),
 'rows',(select jsonb_object_agg(id,md5(to_jsonb(r)::text)) from public.lab_result_entry_rows r),
 'findings',(select jsonb_object_agg(lab_result_entry_id,md5(to_jsonb(f)::text)) from public.lab_result_overall_findings f));`;
 const before=JSON.parse(sql(state));
 sql(migration('20261116110100_lab_result_attempts'));
 const after=JSON.parse(sql(state));
 for(const kind of ['entries','rows','findings'])for(const [id,hash] of Object.entries(before[kind]))assert.equal(after[kind][id],hash,`${kind} legacy data preserved`);
 assert.equal(Object.keys(after.entries).length,Object.keys(before.entries).length+1);
 assert.equal(sql(`select count(*) from public.lab_result_entries e join public.order_fulfillment_work_items w on w.id=e.work_item_id where e.task_attempt_no=1 and w.queue_type='lab' and e.task_id=w.task_id`),'1');
 assert.equal(sql(`select count(*) from public.lab_result_entries e join public.lab_result_entry_rows r on r.lab_result_entry_id=e.id where e.task_attempt_no=2 and r.result_value is null and r.note is null and e.entry_write_revision=0 and not exists(select 1 from public.lab_result_overall_findings f where f.lab_result_entry_id=e.id)`),'1');
 assert.equal(sql(`select count(*) from public.lab_result_entries e join public.order_fulfillment_work_items w on w.id=e.work_item_id where w.queue_type='external_lab' and e.task_id is null`),'1');
 sql(migration('20261116110200_billing_order_edit_hold'));
 mkdirSync('.artifacts/confirmed-order-edit',{recursive:true});
 writeFileSync('.artifacts/confirmed-order-edit/populated-migration.json',JSON.stringify({legacyEntries:Object.keys(before.entries).length,legacyRows:Object.keys(before.rows).length,hashesPreserved:true,firstAttemptBound:true,laterAttemptBlank:true},null,2));
 console.log('Populated V1/V2 migration, legacy hashes, first binding and blank later attempt passed.');
} finally {
 const r=invoke(['exec',container,'dropdb','-U','supabase_admin','--force',database]);assert.equal(r.status,0,r.stderr);
}
