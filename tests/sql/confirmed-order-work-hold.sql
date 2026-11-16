-- Uses the disposable confirmed-order fixture. No real data or billing.
insert into public.orders(id,workspace_id,encounter_id,origin_chart_id,order_type,clinical_order_type,execution_mode,destination_module,display_name,status,order_confirmation_status,detail_schema_version,detail_inputs,billing_reflection_enabled,requested_by_user_id)
values('86000000-0000-4000-8000-000000000004','synthetic-order-edit','84000000-0000-4000-8000-000000000001','85000000-0000-4000-8000-000000000001',
 'treatment','treatment','routed','treatment','합성 처치','confirmed','confirmed',1,
 '{"method":"합성 준비 A","site":"합성 부위","administeredAmount":1,"frequency":"once","schedule":"합성 일정"}',false,'81000000-0000-4000-8000-000000000002');
insert into public.order_tasks(id,workspace_id,encounter_id,order_id,task_role,clinical_order_type,destination_module,effective_snapshot,created_by_user_id,assigned_to_user_id,assigned_by_user_id,assigned_at)
select '87000000-0000-4000-8000-000000000004',o.workspace_id,o.encounter_id,o.id,'execution','treatment','treatment',
 jsonb_build_object('orderDisplayName',o.display_name,'detailInputs',o.detail_inputs,'detailSchemaVersion',1,'billingReflectionEnabled',false),
 '81000000-0000-4000-8000-000000000002','81000000-0000-4000-8000-000000000003','81000000-0000-4000-8000-000000000001',now()
from public.orders o where o.id='86000000-0000-4000-8000-000000000004';
insert into public.order_fulfillment_work_items(id,workspace_id,encounter_id,order_id,order_type,queue_type,clinical_order_type,destination_module,task_id,task_attempt_no,source_snapshot,requested_by_user_id,assigned_to_user_id,assigned_by_user_id,assigned_at)
select '88000000-0000-4000-8000-000000000004',t.workspace_id,t.encounter_id,t.order_id,'treatment','treatment','treatment','treatment',t.id,1,t.effective_snapshot,
 '81000000-0000-4000-8000-000000000002',t.assigned_to_user_id,t.assigned_by_user_id,t.assigned_at
from public.order_tasks t where t.id='87000000-0000-4000-8000-000000000004';

do $$
declare
  w constant text := 'synthetic-order-edit';
  chart constant uuid := '85000000-0000-4000-8000-000000000001';
  editor constant uuid := '81000000-0000-4000-8000-000000000001';
  performer constant uuid := '81000000-0000-4000-8000-000000000003';
  order_row public.order_fulfillment_work_items;
  session uuid;
  current_task uuid;
  original_start timestamptz;
  context jsonb;
  document jsonb;
  review jsonb;
  command jsonb;
  action text;
begin
  perform pg_temp.assert_true(
    not has_table_privilege('authenticated','private.order_work_holds','INSERT')
    and not has_function_privilege('anon','public.clair_manage_confirmed_order_edit_session(text,uuid,uuid,uuid,text)','EXECUTE'),
    'hold storage and RPC privileges');
  for order_row in select * from public.order_fulfillment_work_items where id in
    ('88000000-0000-4000-8000-000000000002','88000000-0000-4000-8000-000000000004')
    order by id
  loop
    session := gen_random_uuid();
    perform set_config('request.jwt.claim.sub',performer::text,true);
    document := public.clair_get_fulfillment_instruction(w,order_row.id);
    document := public.clair_mutate_fulfillment_instruction(w,order_row.id,jsonb_build_object(
      'action','start','commandId',gen_random_uuid(),'expectedRevision',document->>'revision'));
    original_start := (document->>'firstStartedAt')::timestamptz;
    perform pg_temp.assert_true(original_start is not null, 'initial task was started');

    perform pg_temp.assert_true(
      (public.clair_manage_confirmed_order_edit_session(w,chart,order_row.order_id,session,'begin'))->>'editSessionId' is null,
      'chart read permission cannot create a hold');
    perform set_config('request.jwt.claim.sub',editor::text,true);
    context := public.clair_manage_confirmed_order_edit_session(w,chart,order_row.order_id,session,'begin');
    perform pg_temp.assert_true(context->>'editSessionId'=session::text,'hold started');
    perform pg_temp.assert_true((public.clair_manage_confirmed_order_edit_session(w,chart,order_row.order_id,session,'renew'))->>'editSessionId'=session::text,'hold renewed');
    begin
      perform public.clair_manage_confirmed_order_edit_session(w,chart,order_row.order_id,gen_random_uuid(),'begin');
      raise exception 'second session was accepted';
    exception when raise_exception then if sqlerrm<>'order_work_on_hold' then raise; end if; end;
    perform public.clair_manage_confirmed_order_edit_session(w,chart,order_row.order_id,gen_random_uuid(),'release');

    perform set_config('request.jwt.claim.sub',performer::text,true);
    document := public.clair_get_fulfillment_instruction(w,order_row.id);
    perform pg_temp.assert_true(document->>'pauseReason'='order_edit' and jsonb_array_length(document->'items')=1,'held instruction stays readable');
    perform pg_temp.assert_true(exists (
      select 1 from jsonb_array_elements(public.clair_get_chart_order_execution_read_model(w,order_row.encounter_id)->'tasks') task
      where task->>'taskId'=order_row.task_id::text and task->>'pauseReason'='order_edit' and task->>'status'='in_progress'
    ),'chart uses the common hold projection with recorded status preserved');
    perform pg_temp.assert_true(
      exists(select 1 from jsonb_array_elements(public.clair_list_fulfillment_work_items_v2(
        w,order_row.queue_type,null,order_row.order_id,'paused',null,null,order_row.id)) item
        where item->>'pauseReason'='order_edit' and item->>'assignedToUserId'=performer::text),
      'common paused queue projection preserves performer');
    foreach action in array array['complete_all','complete','unassign'] loop
      begin
        perform public.clair_mutate_fulfillment_instruction(w,order_row.id,
          jsonb_build_object('action',action,'commandId',gen_random_uuid(),'expectedRevision',document->>'revision')
          || case when action='complete' then jsonb_build_object('itemId',order_row.id) else '{}'::jsonb end);
        raise exception 'held instruction accepted %',action;
      exception when raise_exception then if sqlerrm<>'order_work_on_hold' then raise; end if; end;
    end loop;
    foreach action in array array['complete','unassign'] loop
      begin
        perform public.clair_transition_fulfillment_work_item(w,performer,order_row.id,action,
          (document#>>'{items,0,revision}')::bigint,gen_random_uuid(),null,null,null);
        raise exception 'held legacy workflow accepted %',action;
      exception when raise_exception then if sqlerrm<>'order_work_on_hold' then raise; end if; end;
    end loop;
    perform pg_temp.assert_true((select status='in_progress' and assigned_to_user_id=performer
      from public.order_fulfillment_work_items where id=order_row.id), 'failed actions preserve state and performer');

    perform set_config('request.jwt.claim.sub',editor::text,true);
    perform public.clair_manage_confirmed_order_edit_session(w,chart,order_row.order_id,session,'release');
    document := public.clair_get_fulfillment_instruction(w,order_row.id);
    perform pg_temp.assert_true(document->>'pauseReason' is null and
      document#>>'{items,0,status}'='in_progress','cancel resumes previously recorded state');
    perform public.clair_manage_confirmed_order_edit_session(w,chart,order_row.order_id,session,'begin');
    update private.order_work_holds set expires_at=statement_timestamp()-interval '1 second' where session_id=session;
    begin
      perform public.clair_manage_confirmed_order_edit_session(w,chart,order_row.order_id,session,'renew');
      raise exception 'expired session was renewed';
    exception when raise_exception then if sqlerrm<>'order_edit_session_expired' then raise; end if; end;
    perform pg_temp.assert_true((public.clair_get_fulfillment_instruction(w,order_row.id))->>'pauseReason' is null,'abandoned session expires');
    session := gen_random_uuid();
    context := public.clair_manage_confirmed_order_edit_session(w,chart,order_row.order_id,session,'begin')->'context';
    command := jsonb_build_object('orderId',order_row.order_id,'chartId',chart,'commandId',gen_random_uuid(),
      'editSessionId',session,'expectedVersion',context->>'version','reason','합성 지시 수정',
      'clinical',jsonb_build_object('detailSchemaVersion',1,'actualDispenseMode','automatic','detailInputs',
        context->'detailInputs' || case when order_row.queue_type='dispensing'
          then '{"guardianNote":"합성 조제 지시 변경"}'::jsonb else '{"method":"합성 준비 B"}'::jsonb end));
    begin
      perform public.clair_edit_confirmed_order(w,chart,order_row.order_id,
        jsonb_set(command,'{expectedVersion}','"stale"'));
      raise exception 'stale confirm accepted';
    exception when raise_exception then if sqlerrm<>'revision_conflict' then raise; end if; end;
    begin
      perform public.clair_edit_confirmed_order(w,chart,order_row.order_id,command-'editSessionId');
      raise exception 'confirm without hold credential accepted';
    exception when raise_exception then if sqlerrm<>'order_work_on_hold' then raise; end if; end;
    perform pg_temp.assert_true((public.clair_get_fulfillment_instruction(w,order_row.id))->>'pauseReason'='order_edit','failed saves keep hold');
    perform public.clair_edit_confirmed_order(w,chart,order_row.order_id,command);
    perform public.clair_edit_confirmed_order(w,chart,order_row.order_id,command);
    perform set_config('request.jwt.claim.sub',performer::text,true);
    document := public.clair_get_fulfillment_instruction(w,order_row.id);
    current_task := (document#>>'{items,0,taskId}')::uuid;
    perform pg_temp.assert_true(document->>'pauseReason' is null and
      document->>'mainAssigneeId'=performer::text and document#>>'{items,0,assigneeId}'=performer::text and
      document#>>'{items,0,status}'='requested' and current_task<>order_row.task_id and
      (document->>'firstStartedAt')::timestamptz=original_start,'re-request preserves assigned owner and first start');
    command := jsonb_build_object('action','start','commandId',gen_random_uuid(),'expectedRevision',document->>'revision');
    begin
      perform public.clair_mutate_fulfillment_instruction(w,order_row.id,command);
      raise exception 'start without acknowledgement accepted';
    exception when raise_exception then if sqlerrm<>'instruction_ack_required' then raise; end if; end;
    review := public.clair_get_task_instruction_review(w,current_task);
    perform public.clair_acknowledge_task_instructions(w,current_task,review#>>'{current,versionKey}');
    document := public.clair_mutate_fulfillment_instruction(w,order_row.id,command);
    perform public.clair_mutate_fulfillment_instruction(w,order_row.id,command);
    perform pg_temp.assert_true(document#>>'{items,0,status}'='in_progress'
      and document->>'mainAssigneeId'=performer::text,'one start continues as the same assignee');
    perform pg_temp.assert_true((select count(*)=1 from public.order_task_events
      where task_id=current_task and event_type='started'),'one start audit event');
    raise notice 'PASS % edit hold, mutation denial, cancel, save and restart', order_row.queue_type;
  end loop;
end
$$;
rollback;
