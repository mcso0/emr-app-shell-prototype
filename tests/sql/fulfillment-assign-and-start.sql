
-- Four single orders cover both assignment paths in both queues.
insert into orders(id,workspace_id,encounter_id,origin_chart_id,status,clinical_order_type,destination_module,
  order_confirmation_status,row_type,requested_by_user_id,sort_order)
select ('1c000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'workspace-a',
  '20000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000001','requested',
  queue_type,queue_type,'confirmed','individual','00000000-0000-4000-8000-000000000003',n
from (values (1,'dispensing'),(2,'dispensing'),(3,'treatment'),(4,'treatment')) seed(n,queue_type);
insert into order_tasks(id,workspace_id,encounter_id,order_id,task_role,clinical_order_type,destination_module,
  status,priority,attempt_no,effective_snapshot)
select ('3c000000-0000-4000-8000-'||right(id::text,12))::uuid,workspace_id,encounter_id,id,
  'execution',clinical_order_type,destination_module,'pending','normal',1,'{}'
from orders where id::text like '1c000000%';
insert into order_fulfillment_work_items(id,workspace_id,order_id,encounter_id,task_id,task_attempt_no,
  status,queue_type,clinical_order_type,destination_module,source_snapshot,requested_by_user_id)
select ('4c000000-0000-4000-8000-'||right(order_id::text,12))::uuid,workspace_id,order_id,encounter_id,id,1,
  'requested',destination_module,clinical_order_type,destination_module,'{}','00000000-0000-4000-8000-000000000003'
from order_tasks where id::text like '3c000000%';

create trigger order_tasks_treatment_execution_medication before insert or update on public.order_tasks
  for each row execute function private.clair_guard_treatment_execution_medication();

do $$
declare
  wi public.order_fulfillment_work_items;
  previous_owner uuid:='00000000-0000-4000-8000-000000000001';
  next_owner uuid:='00000000-0000-4000-8000-000000000002';
  requester uuid:='00000000-0000-4000-8000-000000000003';
  chart uuid:='51000000-0000-4000-8000-000000000001';
  chart_revision integer; d jsonb; cmd jsonb; review jsonb; action text; actor uuid; reason text:='합성 교대 사유';
  events_before bigint; notes_before bigint;
begin
  perform set_config('test.actor',requester::text,true);
  select coalesce(max(revision),0) into chart_revision from private.chart_instruction_revisions
    where chart_id=chart and scope='overall';
  perform public.clair_apply_overall_instructions('workspace-a',chart,jsonb_build_object(
    'commandId',gen_random_uuid(),'changes',jsonb_build_array(jsonb_build_object(
      'scope','overall','expectedRevision',chart_revision,'operation','set','instruction','합성 최신 지시 확인'))));

  for wi in select * from order_fulfillment_work_items where id::text like '4c000000%' order by id loop
    action:=case when right(wi.id::text,1) in ('2','4') then 'takeover' else 'claim' end;
    if action='takeover' then
      perform set_config('test.actor',previous_owner::text,true);
      d:=public.clair_get_fulfillment_instruction('workspace-a',wi.id);
      perform public.clair_mutate_fulfillment_instruction('workspace-a',wi.id,jsonb_build_object(
        'action','claim','commandId',gen_random_uuid(),'expectedRevision',d->>'revision'));
    end if;

    actor:=case when action='takeover' then next_owner else previous_owner end;
    perform set_config('test.actor',actor::text,true);
    d:=public.clair_get_fulfillment_instruction('workspace-a',wi.id);
    cmd:=jsonb_strip_nulls(jsonb_build_object('action',action,'commandId',gen_random_uuid(),
      'expectedRevision',d->>'revision','startWork',true,'reason',case when action='takeover' then reason end));
    review:=public.clair_get_task_instruction_review('workspace-a',wi.task_id);
    if (review->>'requiresAcknowledgement')::boolean then
      begin
        perform public.clair_mutate_fulfillment_instruction('workspace-a',wi.id,cmd);
        raise exception 'assignment start bypassed instruction acknowledgement';
      exception when raise_exception then if sqlerrm<>'instruction_ack_required' then raise; end if; end;
      if d is distinct from public.clair_get_fulfillment_instruction('workspace-a',wi.id) then
        raise exception 'failed acknowledgement changed owner or state';
      end if;
      perform public.clair_acknowledge_task_instructions('workspace-a',wi.task_id,review#>>'{current,versionKey}');
    end if;

    if wi.queue_type='treatment' and action='takeover' then
      update order_tasks set effective_snapshot='{"detailSchemaVersion":3,"detailInputs":{"administrationPolicy":"separate_medication_order"}}' where id=wi.task_id;
      select count(*) into notes_before from notification_events;
      begin
        perform public.clair_mutate_fulfillment_instruction('workspace-a',wi.id,cmd);
        raise exception 'takeover start bypassed medication-link guard';
      exception when raise_exception then if sqlerrm<>'treatment_medication_link_required' then raise; end if; end;
      if d->>'revision' is distinct from public.clair_get_fulfillment_instruction('workspace-a',wi.id)->>'revision'
        or (select count(*) from notification_events)<>notes_before then raise exception 'failed treatment start committed ownership or notification'; end if;
      update order_tasks set effective_snapshot=jsonb_set(effective_snapshot,'{detailInputs,linkedMedicationOrderId}',
        '"1c000000-0000-4000-8000-000000000001"') where id=wi.task_id;
    end if;

    d:=public.clair_mutate_fulfillment_instruction('workspace-a',wi.id,cmd);
    if d->>'mainAssigneeId' is distinct from actor::text
      or d#>>'{items,0,status}' is distinct from 'in_progress' or (d->>'canStart')::boolean then
      raise exception '% % did not return the started instruction: %',wi.queue_type,action,d;
    end if;
    if not exists(select 1 from order_fulfillment_work_items where id=wi.id and status='in_progress'
        and assigned_to_user_id=actor and started_by_user_id=actor and started_at=assigned_at)
      or not exists(select 1 from order_tasks where id=wi.task_id and status='in_progress'
        and assigned_to_user_id=actor and started_by_user_id=actor and started_at=assigned_at)
      or not exists(select 1 from orders where id=wi.order_id and status='in_progress' and task_status='in_progress') then
      raise exception '% % did not persist assignment and start together',wi.queue_type,action;
    end if;
    if (select count(*) from order_task_events where task_id=wi.task_id and event_type='started'
        and after_values->>'commandId'=cmd->>'commandId')<>1 then raise exception 'start audit missing'; end if;
    if action='takeover' and (
      (select count(*) from order_task_events e where e.task_id=wi.task_id and e.event_type='handed_off'
        and e.reason='합성 교대 사유' and e.after_values->>'commandId'=cmd->>'commandId')<>1
      or (select count(*) from notification_events where source_payload->>'commandId'=cmd->>'commandId'
        and source_payload->>'reason'='합성 교대 사유' and recipient_id=requester::text)<>1) then
      raise exception 'takeover audit or requester notification missing';
    end if;
    select count(*) into events_before from order_task_events;
    select count(*) into notes_before from notification_events;
    if d is distinct from public.clair_mutate_fulfillment_instruction('workspace-a',wi.id,cmd)
      or (select count(*) from order_task_events)<>events_before
      or (select count(*) from notification_events)<>notes_before then
      raise exception 'assignment and start replay changed outcome or wrote duplicate events';
    end if;
  end loop;
end $$;

-- Starting one queue in a mixed set preserves the other queue and a separately
-- assigned child executor. Starting a set follows the existing start scope.
do $$
declare
  dispensing uuid:='47000000-0000-4000-8000-000000000002';
  child uuid:='47000000-0000-4000-8000-000000000003';
  treatment uuid:='47000000-0000-4000-8000-000000000004';
  executor uuid:='00000000-0000-4000-8000-000000000002';
  d jsonb; other_before jsonb; other_after jsonb;
begin
  perform set_config('test.actor','00000000-0000-4000-8000-000000000001',true);
  other_before:=public.clair_get_fulfillment_instruction('workspace-a',treatment);
  d:=public.clair_get_fulfillment_instruction('workspace-a',dispensing);
  d:=public.clair_mutate_fulfillment_instruction('workspace-a',dispensing,jsonb_build_object(
    'action','assign','itemId',child,'assigneeId',executor,'commandId',gen_random_uuid(),'expectedRevision',d->>'revision'));
  d:=public.clair_mutate_fulfillment_instruction('workspace-a',dispensing,jsonb_build_object(
    'action','unassign','commandId',gen_random_uuid(),'expectedRevision',d->>'revision'));
  d:=public.clair_mutate_fulfillment_instruction('workspace-a',dispensing,jsonb_build_object(
    'action','claim','startWork',true,'commandId',gen_random_uuid(),'expectedRevision',d->>'revision'));
  if (d->>'canStart')::boolean or exists(select 1 from jsonb_array_elements(d->'items') x where x->>'status'<>'in_progress')
    or not exists(select 1 from order_fulfillment_work_items where id=child and assigned_to_user_id=executor) then
    raise exception 'set claim did not start both items while retaining the child executor';
  end if;
  other_after:=public.clair_get_fulfillment_instruction('workspace-a',treatment);
  if other_after-'revision' is distinct from other_before-'revision' then
    raise exception 'set claim and start changed the other queue';
  end if;
end $$;

do $$
declare wi public.order_fulfillment_work_items; document jsonb;
begin
  perform set_config('test.actor','00000000-0000-4000-8000-000000000001',true);
  for wi in select * from order_fulfillment_work_items where id in (
    '4c000000-0000-4000-8000-000000000001','4c000000-0000-4000-8000-000000000003'
  ) loop
    update orders
    set calculation_outputs='{"dispenseApplicability":true,"calculationStatus":"ready","actualDispenseQuantity":1}'
    where workspace_id='workspace-a' and id=wi.order_id and clinical_order_type='dispensing';
    perform public.clair_mutate_chart_order_execution_origin_base('workspace-a',auth.uid(),
      wi.order_id,'re_request','Synthetic edited instruction',0,
      '{"detailInputs":{"instruction":"Synthetic updated plan"}}','rerequest-history-'||wi.queue_type);
    document:=public.clair_get_fulfillment_instruction('workspace-a',wi.id);
    if wi.started_at is null or (document->>'firstStartedAt')::timestamptz is distinct from wi.started_at
      or document#>>'{items,0,status}' is distinct from 'requested'
      or document#>>'{items,0,attemptNo}' is distinct from '2'
      or document#>>'{items,0,plan,detailInputs,instruction}' is distinct from 'Synthetic updated plan'
      or (select started_at from order_fulfillment_work_items where id=wi.id) is not null then
      raise exception '% replacement did not preserve start history and pending edited work',wi.queue_type;
    end if;
  end loop;
end $$;
