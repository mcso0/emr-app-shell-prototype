-- Extends the disposable confirmed-order fixture. Frozen synthetic V1 result
-- definitions avoid an unrelated master-publication dependency.
update public.workspace_permission_roles set permissions='{"allowed":["chart:view","dispensing:view","dispensing:complete","lab:view","lab:complete","imaging:view","imaging:complete"]}'
where id='80000000-0000-4000-8000-000000000003';
insert into public.orders(id,workspace_id,encounter_id,origin_chart_id,order_type,clinical_order_type,execution_mode,destination_module,display_name,status,order_confirmation_status,detail_schema_version,detail_inputs,billing_reflection_enabled,requested_by_user_id)
select ('86000000-0000-4000-8000-00000000000'||n)::uuid,'synthetic-order-edit','84000000-0000-4000-8000-000000000001','85000000-0000-4000-8000-000000000001',
 case n when 6 then 'imaging' else 'lab' end,case n when 6 then 'imaging' when 7 then 'external_lab' else 'clinical_lab' end,'routed',case n when 6 then 'imaging' when 7 then 'external_lab' else 'lab' end,
 '합성 검사 '||n,'confirmed','confirmed',1,
 case n when 6 then '{"bodyRegion":"abdomen","position":"VD/LAT","viewCount":2,"contrastRequired":false,"sedationRequired":false}'::jsonb
 when 7 then '{"providerId":"synthetic-provider","specimenType":"blood","testItem":"Synthetic","shippingCondition":"Synthetic A"}'::jsonb
 else '{"specimenType":"blood","testPanel":"Synthetic","collectionCondition":"Synthetic A"}'::jsonb end,false,'81000000-0000-4000-8000-000000000002'
from generate_series(5,7) n;
insert into public.order_tasks(id,workspace_id,encounter_id,order_id,task_role,clinical_order_type,destination_module,effective_snapshot,created_by_user_id,assigned_to_user_id,assigned_by_user_id,assigned_at)
select ('87000000-0000-4000-8000-'||right(o.id::text,12))::uuid,o.workspace_id,o.encounter_id,o.id,'execution',o.clinical_order_type,o.destination_module,
 jsonb_build_object('orderDisplayName',o.display_name,'detailInputs',o.detail_inputs,'detailSchemaVersion',1,'calculationOutputs',o.calculation_outputs,'billingReflectionEnabled',false),
 '81000000-0000-4000-8000-000000000002','81000000-0000-4000-8000-000000000003','81000000-0000-4000-8000-000000000001',now()
from public.orders o where workspace_id='synthetic-order-edit' and o.id::text>'86000000-0000-4000-8000-000000000004';
insert into public.order_fulfillment_work_items(id,workspace_id,encounter_id,order_id,order_type,queue_type,clinical_order_type,destination_module,task_id,task_attempt_no,source_snapshot,requested_by_user_id,assigned_to_user_id,assigned_by_user_id,assigned_at)
select ('88000000-0000-4000-8000-'||right(t.id::text,12))::uuid,t.workspace_id,t.encounter_id,t.order_id,case when t.clinical_order_type='imaging' then 'imaging' else 'lab' end,t.destination_module,t.clinical_order_type,t.destination_module,t.id,1,t.effective_snapshot,
 '81000000-0000-4000-8000-000000000002',t.assigned_to_user_id,t.assigned_by_user_id,t.assigned_at
from public.order_tasks t where workspace_id='synthetic-order-edit' and t.id::text>'87000000-0000-4000-8000-000000000004';
insert into public.lab_test_categories(id,workspace_id,category_name) values('synthetic-cat','synthetic-order-edit','Synthetic');
insert into public.lab_test_items(id,workspace_id,category_id,test_item_name,result_input_type,result_value_kind)
values('synthetic-item','synthetic-order-edit','synthetic-cat','Synthetic','number','numeric');
do $$
declare row_definition jsonb; snapshot jsonb; entry_id uuid; wi public.order_fulfillment_work_items;
begin
 row_definition:=jsonb_build_object('rowId',repeat('a',64),'rowDefinitionOrigin','workspace_custom','ordinal',1,'labTestItemId','synthetic-item',
  'sourceMasterTestRecordId',null,'ownerPinnedSourceTestRevision',null,'itemVersionSourceMasterRecordId',null,'itemVersionSourceTestRevision',null,
  'workspaceResultRevision',1,'sourceOrdinal',null,'effectiveSortOrder',1,'analyteName','Synthetic','resultValueKind','numeric','resultInputType','number',
  'unit',null,'decimalScale',null,'referenceRange',null,'required',true,'displayGroup',null);
 snapshot:=jsonb_build_object('schemaVersion',1,'source',jsonb_build_object('workspaceCatalogItemId','synthetic-catalog','workspaceCatalogRevision',1,
  'masterOrderRecordId','99000000-0000-4000-8000-000000000001','masterOrderRevision',1,'profile',jsonb_build_object('orderRecordId','99000000-0000-4000-8000-000000000001',
  'targetType','panel','labPanelRecordId','99000000-0000-4000-8000-000000000002','labPanelRevision',1,'labTestRecordId',null,'labTestRevision',null,'specimenTypeRecordId',null,'specimenTypeRevision',null)),
  'rows',jsonb_build_array(row_definition));
 for wi in select * from public.order_fulfillment_work_items where workspace_id='synthetic-order-edit' and queue_type in ('lab','external_lab') loop
  insert into public.lab_result_entries(workspace_id,result_id,encounter_id,order_id,work_item_id,task_id,task_attempt_no,result_status,
   source_workspace_catalog_item_id,source_workspace_catalog_revision,source_master_order_record_id,source_master_order_revision,
   source_master_panel_record_id,source_master_panel_revision,result_definition_snapshot,result_definition_snapshot_sha256,result_definition_origin)
  values(wi.workspace_id,'lab-order:'||wi.order_id,wi.encounter_id,wi.order_id,wi.id,wi.task_id,1,'received','synthetic-catalog',1,
   '99000000-0000-4000-8000-000000000001',1,'99000000-0000-4000-8000-000000000002',1,snapshot,private.clinical_master_sha256(snapshot),'canonical') returning id into entry_id;
  insert into public.lab_result_entry_rows(workspace_id,lab_result_entry_id,row_id,lab_test_item_id,analyte_name,sort_order,row_definition_origin,workspace_result_revision,result_value_kind,result_input_type,effective_sort_order,required)
  values(wi.workspace_id,entry_id,repeat('a',64),'synthetic-item','Synthetic',1,'workspace_custom',1,'numeric','number',1,true);
  perform private.clair_assert_lab_result_definition_snapshot(wi.workspace_id,entry_id);
 end loop;
end $$;
create function pg_temp.exam_action(wi uuid,action text) returns jsonb language plpgsql as $$
begin
 return public.clair_transition_fulfillment_work_item('synthetic-order-edit',auth.uid(),wi,action,
  (select row_revision from public.order_fulfillment_work_items where id=wi),gen_random_uuid(),null,null,null);
end $$;

do $$
declare w text:='synthetic-order-edit'; actor uuid:='81000000-0000-4000-8000-000000000003'; editor uuid:='81000000-0000-4000-8000-000000000001';
 chart uuid:='85000000-0000-4000-8000-000000000001'; wi public.order_fulfillment_work_items; original public.lab_result_entries;
 current_entry public.lab_result_entries; result jsonb; review jsonb; command jsonb; session uuid; attachment uuid; old_rows jsonb; old_entry jsonb; old_task uuid;
begin
 for wi in select * from public.order_fulfillment_work_items where workspace_id=w and queue_type in ('lab','external_lab') order by id loop
  perform set_config('request.jwt.claim.sub',actor::text,true);
  perform pg_temp.exam_action(wi.id,'start');
  select * into original from public.lab_result_entries where workspace_id=w and order_id=wi.order_id;
  perform public.clair_save_lab_result_entry_v2(w,actor,original.result_id,wi.encounter_id,wi.order_id,wi.id,0,gen_random_uuid(),
    jsonb_build_array(jsonb_build_object('rowId',repeat('a',64),'value','7','note','Synthetic prior note')));
  perform public.clair_save_lab_result_overall_finding(w,original.result_id,0,'Synthetic prior overall');
  attachment:=gen_random_uuid();
  perform public.clair_prepare_lab_result_attachment(w,original.result_id,null,attachment,'synthetic.txt','text/plain',1);
  perform set_config('request.jwt.claim.role','service_role',true);
  perform public.clair_mutate_lab_attachment(w,original.result_id,attachment,'finalize',actor);
  perform set_config('request.jwt.claim.role','authenticated',true);
  select to_jsonb(e) into old_entry from public.lab_result_entries e where id=original.id;
  select jsonb_agg(to_jsonb(r) order by r.id) into old_rows from public.lab_result_entry_rows r where lab_result_entry_id=original.id;
  perform set_config('request.jwt.claim.sub',editor::text,true);
  session:=gen_random_uuid();
  result:=public.clair_manage_confirmed_order_edit_session(w,chart,wi.order_id,session,'begin');
  perform pg_temp.assert_true(result->>'editSessionId'=session::text,'examination edit holds active work');
  perform set_config('request.jwt.claim.sub',actor::text,true);
  begin
   perform public.clair_save_lab_result_overall_finding(w,original.result_id,1,'must not save'); raise exception 'held lab write accepted';
  exception when raise_exception then if sqlerrm<>'order_work_on_hold' then raise; end if; end;
  perform set_config('request.jwt.claim.sub',editor::text,true);
  command:=jsonb_build_object('orderId',wi.order_id,'chartId',chart,'commandId',gen_random_uuid(),'expectedVersion',result#>>'{context,version}','editSessionId',session,
   'reason','합성 재요청','clinical',jsonb_build_object('detailSchemaVersion',1,'detailInputs',result#>'{context,detailInputs}'||case when wi.queue_type='external_lab' then '{"shippingCondition":"Synthetic B"}'::jsonb else '{"collectionCondition":"Synthetic B"}'::jsonb end));
  perform public.clair_edit_confirmed_order(w,chart,wi.order_id,command);
  select * into current_entry from public.lab_result_entries where workspace_id=w and order_id=wi.order_id and task_attempt_no=2;
  perform pg_temp.assert_true(current_entry.id is not null and current_entry.id<>original.id and current_entry.entry_write_revision=0,'new attempt gets independent blank result');
  perform pg_temp.assert_true((select bool_and(result_value is null and note is null) from public.lab_result_entry_rows where lab_result_entry_id=current_entry.id),'old values and notes are not copied');
  perform pg_temp.assert_true(not exists(select 1 from public.lab_result_overall_findings where lab_result_entry_id=current_entry.id) and not exists(select 1 from public.lab_result_attachments where lab_result_entry_id=current_entry.id),'overall and attachments are not copied');
  perform pg_temp.assert_true((select to_jsonb(e)=old_entry from public.lab_result_entries e where id=original.id) and (select jsonb_agg(to_jsonb(r) order by r.id)=old_rows from public.lab_result_entry_rows r where lab_result_entry_id=original.id),'previous result records unchanged');
  perform set_config('request.jwt.claim.sub',actor::text,true);
  result:=public.clair_get_lab_result_entry(w,actor,null,wi.id,wi.order_id);
  perform pg_temp.assert_true(result->>'resultId'=current_entry.result_id and jsonb_array_length(result->'priorResults')=1,'default read selects current attempt and exposes history');
  perform pg_temp.assert_true((public.clair_get_lab_result_phase2(w,original.result_id))->>'editable'='false','prior attempt read only');
  begin perform pg_temp.exam_action(wi.id,'start'); raise exception 'restart without review accepted';
  exception when raise_exception then if sqlerrm<>'instruction_ack_required' then raise; end if; end;
  review:=public.clair_get_task_instruction_review(w,current_entry.task_id);
  perform public.clair_acknowledge_task_instructions(w,current_entry.task_id,review#>>'{current,versionKey}');
  begin
   perform public.clair_save_lab_result_overall_finding(w,current_entry.result_id,0,'must start first'); raise exception 'requested write accepted';
  exception when raise_exception then if sqlerrm<>'lab_result_read_only' then raise; end if; end;
  perform pg_temp.exam_action(wi.id,'start');
  begin perform pg_temp.exam_action(wi.id,'complete'); raise exception 'empty new attempt completed';
  exception when raise_exception then if sqlerrm<>'required_lab_results_incomplete' then raise; end if; end;
  begin
   perform public.clair_save_lab_result_entry_v2(w,actor,original.result_id,wi.encounter_id,wi.order_id,wi.id,1,gen_random_uuid(),jsonb_build_array(jsonb_build_object('rowId',repeat('a',64),'value','99','note',null)));
   raise exception 'stale rows accepted';
  exception when raise_exception then if sqlerrm<>'lab_result_attempt_changed' then raise; end if; end;
  begin perform public.clair_save_lab_result_overall_finding(w,original.result_id,1,'stale'); raise exception 'stale overall accepted';
  exception when raise_exception then if sqlerrm<>'lab_result_attempt_changed' then raise; end if; end;
  begin perform public.clair_prepare_lab_result_attachment(w,original.result_id,null,gen_random_uuid(),'stale.txt','text/plain',1); raise exception 'stale upload accepted';
  exception when raise_exception then if sqlerrm<>'lab_result_attempt_changed' then raise; end if; end;
  perform set_config('request.jwt.claim.role','service_role',true);
  begin perform public.clair_mutate_lab_attachment(w,original.result_id,attachment,'finalize',actor); raise exception 'stale finalize accepted';
  exception when raise_exception then if sqlerrm<>'lab_result_attempt_changed' then raise; end if; end;
  perform set_config('request.jwt.claim.role','authenticated',true);
  perform public.clair_save_lab_result_entry_v2(w,actor,current_entry.result_id,wi.encounter_id,wi.order_id,wi.id,0,gen_random_uuid(),jsonb_build_array(jsonb_build_object('rowId',repeat('a',64),'value','8','note','Synthetic current note')));
  perform pg_temp.exam_action(wi.id,'complete');
  perform pg_temp.assert_true((select status='completed' from public.order_fulfillment_work_items where id=wi.id),'new attempt completes only with new results');
  raise notice 'PASS % new attempt, previous results, hold, acknowledgement, fresh completion, stale writers',wi.queue_type;
 end loop;
end $$;
do $$
declare w text:='synthetic-order-edit'; actor uuid:='81000000-0000-4000-8000-000000000003'; editor uuid:='81000000-0000-4000-8000-000000000001';
 wi uuid:='88000000-0000-4000-8000-000000000006'; o uuid:='86000000-0000-4000-8000-000000000006'; old_context jsonb; current_context jsonb; review jsonb; old_result jsonb; result_payload jsonb;
begin
 perform set_config('request.jwt.claim.sub',actor::text,true);
 perform pg_temp.exam_action(wi,'start');
 old_context:=public.clair_get_order_execution_context(w,wi);
 result_payload:='{"acquisitionDisposition":"acquired_new","acquiredViews":["VD","LAT"],"performedProtocol":"Synthetic abdomen imaging","quality":"diagnostic","findings":"Synthetic findings","interpretation":"Synthetic reviewed interpretation"}';
 old_context:=public.clair_record_order_execution_result(w,actor,wi,(old_context->>'workItemRevision')::bigint,old_context->>'planSha256',0,gen_random_uuid(),now(),result_payload,null,null);
 old_result:=old_context->'results';
 perform set_config('request.jwt.claim.sub',editor::text,true);
 perform pg_temp.edit(o,null,jsonb_build_object('detailSchemaVersion',1,'detailInputs',old_context#>'{planSnapshot,detailInputs}'||'{"imagingProtocol":"Synthetic changed protocol"}'::jsonb),'합성 영상 재요청');
 perform set_config('request.jwt.claim.sub',actor::text,true);
 current_context:=public.clair_get_order_execution_context(w,wi);
 perform pg_temp.assert_true(current_context->>'taskId'<>old_context->>'taskId' and current_context->'results'='[]'::jsonb and jsonb_array_length(current_context->'priorTasks')=1,'imaging new attempt is empty and previous task accessible');
 perform pg_temp.assert_true((public.clair_get_order_execution_context(w,wi,(old_context->>'taskId')::uuid))->'results'=old_result,'old imaging records unchanged');
 begin
  perform public.clair_record_order_execution_result(w,actor,wi,(old_context->>'workItemRevision')::bigint,old_context->>'planSha256',0,gen_random_uuid(),now(),result_payload,null,null);
  raise exception 'stale imaging save accepted';
 exception when raise_exception then if sqlerrm not in ('revision_conflict','plan_version_conflict','execution_revision_conflict') then raise; end if; end;
 review:=public.clair_get_task_instruction_review(w,(current_context->>'taskId')::uuid);
 perform public.clair_acknowledge_task_instructions(w,(current_context->>'taskId')::uuid,review#>>'{current,versionKey}');
 perform pg_temp.exam_action(wi,'start');
 begin perform pg_temp.exam_action(wi,'complete'); raise exception 'imaging old record completed new task';
 exception when raise_exception then if sqlerrm<>'actual_execution_result_required' then raise; end if; end;
 current_context:=public.clair_get_order_execution_context(w,wi);
 perform public.clair_record_order_execution_result(w,actor,wi,(current_context->>'workItemRevision')::bigint,current_context->>'planSha256',0,gen_random_uuid(),now(),result_payload||'{"findings":"Synthetic new findings"}'::jsonb,null,null);
 perform pg_temp.assert_true((public.clair_get_order_execution_context(w,wi))->>'status'='completed','new imaging result saves and completes');
 raise notice 'PASS imaging fresh result, immutable prior task history, stale save and completion';
end $$;

-- Re-requesting unassigned examinations carries this actor's identical review
-- into its own atomic claim/start, allowing an immediate fresh result save.
do $$
declare w text:='synthetic-order-edit'; wi uuid:='88000000-0000-4000-8000-000000000005'; o uuid:='86000000-0000-4000-8000-000000000005';
 d jsonb; r jsonb; task uuid; actor uuid:='81000000-0000-4000-8000-000000000003';
begin
 perform set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000001',true);
 d:=public.clair_get_confirmed_order_edit(w,'85000000-0000-4000-8000-000000000001',o);
 perform pg_temp.edit(o,null,jsonb_build_object('detailSchemaVersion',1,'detailInputs',d->'detailInputs'||'{"collectionCondition":"Synthetic C"}'::jsonb),'합성 미배정 재요청');
 perform set_config('request.jwt.claim.sub',actor::text,true);
 perform pg_temp.exam_action(wi,'unassign');
 select task_id into task from public.order_fulfillment_work_items where id=wi;
 begin perform pg_temp.exam_action(wi,'claim'); raise exception 'unreviewed atomic claim accepted';
 exception when raise_exception then if sqlerrm<>'instruction_ack_required' then raise; end if; end;
 r:=public.clair_get_task_instruction_review(w,task);
 perform public.clair_acknowledge_task_instructions(w,task,r#>>'{current,versionKey}');
 perform pg_temp.exam_action(wi,'claim');
 perform pg_temp.assert_true((select status='in_progress' and assigned_to_user_id=actor from public.order_fulfillment_work_items where id=wi),'claim assigns and starts atomically');
 perform pg_temp.assert_true((public.clair_get_task_instruction_review(w,task))->>'requiresAcknowledgement'='false','same actor review remains valid after own claim');
 r:=public.clair_get_lab_result_entry(w,actor,null,wi,o);
 perform public.clair_save_lab_result_entry_v2(w,actor,r->>'resultId','84000000-0000-4000-8000-000000000001',o,wi,0,gen_random_uuid(),jsonb_build_array(jsonb_build_object('rowId',repeat('a',64),'value','9','note',null)));
 raise notice 'PASS unassigned re-request acknowledgement, atomic claim/start and immediate fresh save';
end $$;

set constraints all immediate;
rollback;
