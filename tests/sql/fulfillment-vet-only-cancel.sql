-- Run in an isolated migrated PostgreSQL database. All rows are rolled back.
begin;
set local statement_timeout='20s';
set local lock_timeout='5s';
select set_config('request.jwt.claim.sub','49110946-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);
insert into auth.users(id)
select ('49110946-0000-4000-8000-00000000000'||n)::uuid from generate_series(1,3) n;
insert into public.users(id,display_name,status)
select ('49110946-0000-4000-8000-00000000000'||n)::uuid,'합성 직원 '||n,'active' from generate_series(1,3) n;
insert into public.workspaces(id,display_name,status) values('synthetic-vet-cancel','Synthetic cancellation permissions','active');
insert into public.user_memberships(workspace_id,user_id,roles,status)
select 'synthetic-vet-cancel',('49110946-0000-4000-8000-00000000000'||n)::uuid,
  case n when 1 then array['vet'] when 2 then array['technician'] else array['hospital_admin'] end,'active'
from generate_series(1,3) n;
insert into public.workspace_permission_roles(id,workspace_id,role_key,label,role_type,permissions)
values ('50110946-0000-4000-8000-000000000001','synthetic-vet-cancel','synthetic_tech','Synthetic technician','standard',
  '{"allowed":["chart:view","chart:update","order:view","order:update","dispensing:view","dispensing:complete"]}');
insert into public.workspace_membership_permission_role_assignments(membership_id,workspace_id,permission_role_id)
select id,workspace_id,'50110946-0000-4000-8000-000000000001' from public.user_memberships
where workspace_id='synthetic-vet-cancel' and user_id='49110946-0000-4000-8000-000000000002'
on conflict(membership_id) do update set permission_role_id=excluded.permission_role_id;
insert into public.guardians(id,workspace_id,name)
values('82110946-0000-4000-8000-000000000001','synthetic-vet-cancel','합성 권한 검증 합성 보호자');
insert into public.patients(id,workspace_id,patient_no,name,species)
values('83110946-0000-4000-8000-000000000001','synthetic-vet-cancel','SYN-합성 권한 검증','합성 권한 검증 합성 환자','dog');
insert into public.patient_guardians(workspace_id,patient_id,guardian_id,is_primary,can_receive_messages)
values('synthetic-vet-cancel','83110946-0000-4000-8000-000000000001','82110946-0000-4000-8000-000000000001',true,false);
insert into public.encounters(id,workspace_id,patient_id,guardian_id,encounter_no,reception_type,status,primary_veterinarian_id)
values('84110946-0000-4000-8000-000000000001','synthetic-vet-cancel','83110946-0000-4000-8000-000000000001',
 '82110946-0000-4000-8000-000000000001','SYN-합성 권한 검증','walk_in','in_consultation','49110946-0000-4000-8000-000000000001');
insert into public.encounters(id,workspace_id,patient_id,guardian_id,encounter_no,reception_type,status,primary_veterinarian_id)
values('84110946-0000-4000-8000-000000000002','synthetic-vet-cancel','83110946-0000-4000-8000-000000000001',
 '82110946-0000-4000-8000-000000000001','SYN-CANCEL-LEGACY','walk_in','in_consultation','49110946-0000-4000-8000-000000000001');
insert into public.soap_notes(id,workspace_id,encounter_id,status)
values('85110946-0000-4000-8000-000000000001','synthetic-vet-cancel','84110946-0000-4000-8000-000000000001','draft');
insert into public.orders(id,workspace_id,encounter_id,origin_chart_id,order_type,clinical_order_type,execution_mode,destination_module,
 display_name,status,order_confirmation_status,detail_schema_version,detail_inputs,applied_snapshot,unit_price_snapshot,quantity,billing_reflection_enabled,requested_by_user_id)
select ('86110946-0000-4000-8000-00000000000'||n)::uuid,'synthetic-vet-cancel',
 case when n=9 then '84110946-0000-4000-8000-000000000002'::uuid else '84110946-0000-4000-8000-000000000001'::uuid end,
 case when n<>9 then '85110946-0000-4000-8000-000000000001'::uuid end,
 queue_type,queue_type,'routed',queue_type,
 '합성 권한 검증 합성 '||label,'confirmed','confirmed',1,
 case when queue_type='dispensing' then '{"doseBasis":"patient","dose":1,"doseUnit":"tablet","route":"PO","frequency":"sid","durationDays":1,"totalQuantity":1,"totalQuantityUnit":"tablet"}'::jsonb
      else '{}'::jsonb end,
 jsonb_build_object('displayName','합성 권한 검증 합성 '||label),0,1,false,'49110946-0000-4000-8000-000000000001'
from (values(1,'dispensing','조제 완료'),(2,'treatment','처치 완료'),
 (3,'dispensing','조제 취소'),(4,'treatment','처치 취소'),
 (7,'dispensing','조제 미지정 완료'),(8,'treatment','처치 미지정 완료'),
 (9,'dispensing','차트 미연결 오더 취소')) seed(n,queue_type,label);

-- A non-dispensing root still protects the treatment child on set cancellation.
insert into public.order_catalog_items(id,workspace_id,standard_order_id,source_preset_version,
 category_group,category_label,standard_order_name,in_hospital_order_name,billing_name,availability_status,price_krw,
 default_destination_module,default_task_required,billing_reflection_enabled,origin_type)
values ('synthetic-cancel-treatment','synthetic-vet-cancel','synthetic-cancel-treatment','synthetic-v1',
 'treatment','처치','합성 처치','합성 처치','합성 처치','active',0,'treatment',true,false,'workspace_custom');
insert into public.order_sets(id,workspace_id,source_set_version,set_category,set_name,billing_name,amount_basis,
 billing_reflection_enabled,created_by_user_id,updated_by_user_id)
values ('synthetic-cancel-set','synthetic-vet-cancel','order-set-revision-1','혼합','합성 세트','합성 세트','included_order_sum',false,
 '49110946-0000-4000-8000-000000000001','49110946-0000-4000-8000-000000000001');
insert into public.order_set_revisions(id,workspace_id,order_set_id,revision_no,validation_status,validation_errors,
 set_category,set_name,billing_name,amount_basis,sales_unit,billing_reflection_enabled,tax_type,target_species,created_by_user_id)
values ('81110946-0000-4000-8000-000000000001','synthetic-vet-cancel','synthetic-cancel-set',1,'valid','[]',
 '혼합','합성 세트','합성 세트','included_order_sum','per_each',false,'derived',array['dog','cat','other'],
 '49110946-0000-4000-8000-000000000001');
update public.order_sets set current_revision_id='81110946-0000-4000-8000-000000000001'
where workspace_id='synthetic-vet-cancel' and id='synthetic-cancel-set';
insert into public.order_set_revision_items(id,workspace_id,order_set_id,revision_id,child_kind,
 child_order_catalog_item_id,child_order_catalog_revision,sort_order,default_selected,billing_reflection_default,default_quantity,quantity_source)
values ('81110946-0000-4000-8000-000000000002','synthetic-vet-cancel','synthetic-cancel-set','81110946-0000-4000-8000-000000000001',
 'atomic','synthetic-cancel-treatment',1,10,true,false,1,'fixed_one');
do $set_fixture$
declare
  workspace constant text := 'synthetic-vet-cancel';
  encounter constant uuid := '84110946-0000-4000-8000-000000000001';
  chart constant uuid := '85110946-0000-4000-8000-000000000001';
  parent constant uuid := '86110946-0000-4000-8000-000000000005';
  draft jsonb;
begin
  draft := public.clair_get_chart_order_draft(workspace,encounter);
  perform public.clair_save_chart_order_draft_for_chart(workspace,auth.uid()::text,encounter,chart,
    jsonb_build_object('expectedEtag',draft->'etag','rows',jsonb_build_array(jsonb_build_object(
      'rowType','set','orderId',parent,'sourceSetId','synthetic-cancel-set',
      'sourceSetRevisionId','81110946-0000-4000-8000-000000000001','sourceSetRevisionNo',1,
      'selectionIntent','{"items":[{"revisionItemId":"81110946-0000-4000-8000-000000000002","selected":true,"quantity":1}]}'::jsonb,
      'detailInputs','{}'::jsonb,'detailSchemaVersion',1,'priority','normal',
      'childInputs','[{"revisionItemId":"81110946-0000-4000-8000-000000000002","detailInputs":{"method":"합성 처치","site":"합성 부위","administeredAmount":0,"frequency":"once"},"detailSchemaVersion":1,"priority":"normal"}]'::jsonb))));
  if (select count(*) from public.orders where workspace_id=workspace and parent_chart_order_line_id=parent
      and clinical_order_type='treatment') <> 1 then raise exception 'treatment set child missing'; end if;
  update public.orders set status='confirmed',order_confirmation_status='confirmed'
  where workspace_id=workspace and (id=parent or parent_chart_order_line_id=parent);
end $set_fixture$;
insert into public.order_tasks(id,workspace_id,encounter_id,order_id,parent_task_id,task_role,clinical_order_type,destination_module,effective_snapshot,created_by_user_id)
select (case when o.row_type='set_child' then '87110946-0000-4000-8000-000000000006'
       else '87110946-0000-4000-8000-'||right(o.id::text,12) end)::uuid,o.workspace_id,o.encounter_id,o.id,
 case when o.row_type='set_child' then '87110946-0000-4000-8000-000000000005'::uuid end,
 case when o.row_type='set' then 'aggregate' else 'execution' end,o.clinical_order_type,o.destination_module,
 jsonb_build_object('orderDisplayName',o.display_name,'detailInputs',o.detail_inputs,'detailSchemaVersion',1,'billingReflectionEnabled',false),
 '49110946-0000-4000-8000-000000000001'
from public.orders o where o.workspace_id='synthetic-vet-cancel' order by case when o.row_type='set' then 0 else 1 end,o.id;
insert into public.order_fulfillment_work_items(id,workspace_id,encounter_id,order_id,order_type,queue_type,clinical_order_type,destination_module,task_id,task_attempt_no,source_snapshot,requested_by_user_id)
select ('88110946-0000-4000-8000-'||right(t.id::text,12))::uuid,t.workspace_id,t.encounter_id,t.order_id,t.clinical_order_type,t.destination_module,t.clinical_order_type,t.destination_module,t.id,1,t.effective_snapshot,
 '49110946-0000-4000-8000-000000000001'
from public.order_tasks t where t.workspace_id='synthetic-vet-cancel' and t.task_role='execution';
set constraints all immediate;

create function pg_temp.cancel_order(order_id uuid, key text, legacy boolean default false)
returns jsonb language plpgsql as $$
begin
  if legacy then
    return public.clair_mutate_chart_order_execution('synthetic-vet-cancel',current_setting('request.jwt.claim.sub')::uuid,order_id,
      'cancel','합성 취소 사유',0,'{}',key);
  end if;
  return public.clair_mutate_chart_order_execution_for_chart('synthetic-vet-cancel',current_setting('request.jwt.claim.sub')::uuid,
    '85110946-0000-4000-8000-000000000001',order_id,'cancel','합성 취소 사유',0,'{}',key);
end $$;

set local role authenticated;
do $test$
declare
  w constant text := 'synthetic-vet-cancel';
  vet constant uuid := '49110946-0000-4000-8000-000000000001';
  technician constant uuid := '49110946-0000-4000-8000-000000000002';
  admin constant uuid := '49110946-0000-4000-8000-000000000003';
  actor uuid; order_id uuid; work_item_id uuid; n integer;
  doc jsonb; context jsonb; payload jsonb;
begin
  if has_table_privilege(current_user,'public.orders','UPDATE')
    or has_function_privilege(current_user,
      'public.clair_mutate_chart_order_execution_origin_base(text,uuid,uuid,text,text,integer,jsonb,text)','EXECUTE') then
    raise exception 'authenticated role can bypass the public mutation boundary';
  end if;
  perform set_config('request.jwt.claim.sub',technician::text,true);
  foreach n in array array[3,4] loop
    work_item_id := ('88110946-0000-4000-8000-00000000000'||n)::uuid;
    doc := public.clair_get_fulfillment_instruction(w,work_item_id);
    doc := public.clair_mutate_fulfillment_instruction(w,work_item_id,jsonb_build_object(
      'action','claim','commandId',gen_random_uuid(),'expectedRevision',doc->>'revision'));
    if doc->>'mainAssigneeId' is distinct from technician::text then
      raise exception 'cancellation fixture is not assigned to the technician %',n;
    end if;
  end loop;

  foreach actor in array array[technician,admin] loop
    perform set_config('request.jwt.claim.sub',actor::text,true);
    foreach n in array array[3,4,5,9] loop
      order_id := ('86110946-0000-4000-8000-00000000000'||n)::uuid;
      begin
        perform pg_temp.cancel_order(order_id,gen_random_uuid()::text,n=9);
        raise exception 'non-veterinarian cancelled order %',n;
      exception when insufficient_privilege then
        if sqlerrm <> 'permission_missing' then raise; end if;
      end;
    end loop;
  end loop;

  perform set_config('request.jwt.claim.sub',technician::text,true);
  foreach n in array array[1,2,7,8] loop
    work_item_id := ('88110946-0000-4000-8000-00000000000'||n)::uuid;
    doc := public.clair_get_fulfillment_instruction(w,work_item_id);
    if (doc->>'canCompleteAll')::boolean is distinct from false then
      raise exception 'unassigned technician can complete %',n;
    end if;
    begin
      perform public.clair_mutate_fulfillment_instruction(w,work_item_id,jsonb_build_object(
        'action','complete_all','commandId',gen_random_uuid(),'expectedRevision',doc->>'revision'));
      raise exception 'unassigned technician completed %',n;
    exception when insufficient_privilege then
      if sqlerrm <> 'permission_missing' then raise; end if;
    end;
    if n in (7,8) then continue; end if;

    doc := public.clair_mutate_fulfillment_instruction(w,work_item_id,jsonb_build_object(
      'action','claim','commandId',gen_random_uuid(),'expectedRevision',doc->>'revision'));
    if doc->>'mainAssigneeId' is distinct from technician::text
      or (doc->>'canCompleteAll')::boolean is distinct from true then
      raise exception 'assigned technician lacks completion permission %',n;
    end if;
    begin
      perform public.clair_mutate_fulfillment_instruction(w,work_item_id,jsonb_build_object(
        'action','complete_all','commandId',gen_random_uuid(),'expectedRevision',doc->>'revision'));
      raise exception 'completion accepted without actual result %',n;
    exception when raise_exception then
      if sqlerrm <> 'actual_execution_result_required' then raise; end if;
    end;
    context := public.clair_get_order_execution_context(w,work_item_id,null);
    payload := case n when 1 then '{"preparedQuantity":1,"preparedUnit":"tablet"}'::jsonb
      else '{"performedProcedure":"합성 처치","outcome":"합성 완료"}'::jsonb end;
    perform public.clair_record_order_execution_result(w,current_setting('request.jwt.claim.sub')::uuid,work_item_id,
      (context->>'workItemRevision')::bigint,context->>'planSha256',0,gen_random_uuid(),now(),
      payload,case when n=1 then '합성 준비수량 확인' end,null);
    doc := public.clair_get_fulfillment_instruction(w,work_item_id);
    if doc#>>'{items,0,status}' is distinct from 'completed' or doc->>'finalized' is distinct from 'true' then
      raise exception 'technician did not finalize order %',n;
    end if;
  end loop;

  perform set_config('request.jwt.claim.sub',vet::text,true);
  foreach n in array array[3,4,5,9] loop
    order_id := ('86110946-0000-4000-8000-00000000000'||n)::uuid;
    perform pg_temp.cancel_order(order_id,gen_random_uuid()::text,n=9);
  end loop;
end $test$;
reset role;

do $verify$
declare
  w constant text := 'synthetic-vet-cancel';
begin
  if (select count(*) from public.orders where workspace_id=w and status='completed') <> 2
    or (select count(*) from public.order_execution_result_versions where workspace_id=w
      and recorded_by_user_id='49110946-0000-4000-8000-000000000002') <> 2
    or (select count(*) from public.order_fulfillment_work_items where workspace_id=w and status='cancelled') <> 4
    or (select count(*) from public.orders where workspace_id=w and status='cancelled') <> 5
    or (select count(*) from public.order_fulfillment_work_items where workspace_id=w and status='requested') <> 2
    or (select count(*) from public.order_revisions where workspace_id=w and change_type='cancellation'
      and created_by_user_id='49110946-0000-4000-8000-000000000001') <> 4
    or (select count(*) from public.order_task_events where workspace_id=w and event_type='cancelled'
      and actor_user_id<>'49110946-0000-4000-8000-000000000001') <> 0
    or exists(select 1 from public.invoices where workspace_id=w)
    or exists(select 1 from public.order_billing_candidates where workspace_id=w) then
    raise exception 'cancellation, completion, audit or billing state mismatch';
  end if;
end $verify$;
rollback;
