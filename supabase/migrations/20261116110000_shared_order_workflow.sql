-- Extend the existing confirmed-edit and fulfillment commands. Dispensing and
-- treatment keep their instruction-level assignment/completion contracts.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '120s';

create function pg_temp.patch_shared_workflow(signature text, old text, replacement text, expected integer default 1)
returns void language plpgsql as $$
declare definition text := pg_get_functiondef(signature::regprocedure);
begin
  if (length(definition) - length(replace(definition, old, ''))) / length(old) <> expected then
    raise exception 'shared workflow patch drift: %', signature;
  end if;
  execute replace(definition, old, replacement);
end $$;

select pg_temp.patch_shared_workflow('public.clair_get_confirmed_order_edit(text,uuid,uuid)',
  $old$o.clinical_order_type not in ('dispensing','treatment')$old$,
  $new$o.clinical_order_type not in ('dispensing','treatment','clinical_lab','external_lab','imaging')$new$);
select pg_temp.patch_shared_workflow('public.clair_edit_confirmed_order(text,uuid,uuid,jsonb)',
  $old$or clinical->>'actualDispenseMode' is distinct from before_context->>'actualDispenseMode'
  or (clinical->>'actualDispenseMode'='manual' and clinical->'actualDispenseQuantity' is distinct from before_context->'actualDispenseQuantity')$old$,
  $new$or (o.clinical_order_type='dispensing' and (
    clinical->>'actualDispenseMode' is distinct from before_context->>'actualDispenseMode'
    or (clinical->>'actualDispenseMode'='manual' and clinical->'actualDispenseQuantity' is distinct from before_context->'actualDispenseQuantity')))$new$);
select pg_temp.patch_shared_workflow('public.clair_edit_confirmed_order(text,uuid,uuid,jsonb)',
  $old$or clinical->>'actualDispenseMode' not in ('automatic','manual')$old$,
  $new$or (o.clinical_order_type='dispensing' and coalesce(clinical->>'actualDispenseMode','') not in ('automatic','manual'))$new$);

-- Preserve aggregate identity when only one examination in a set changes.
select pg_temp.patch_shared_workflow('public.clair_mutate_chart_order_execution_origin_base(text,uuid,uuid,text,text,integer,jsonb,text)',
  $old$v_order.destination_module not in ('dispensing','treatment')$old$,
  $new$v_order.destination_module not in ('dispensing','treatment','lab','external_lab','imaging')$new$);
select pg_temp.patch_shared_workflow('public.clair_mutate_chart_order_execution_origin_base(text,uuid,uuid,text,text,integer,jsonb,text)',
  $old$v_order.destination_module in ('dispensing','treatment')$old$,
  $new$v_order.destination_module in ('dispensing','treatment','lab','external_lab','imaging')$new$, 2);
select pg_temp.patch_shared_workflow('public.clair_mutate_chart_order_execution_origin_base(text,uuid,uuid,text,text,integer,jsonb,text)',
  $old$v_order.clinical_order_type in ('dispensing','treatment') and v_action in ('amend','re_request')$old$,
  $new$v_order.clinical_order_type in ('dispensing','treatment','clinical_lab','external_lab','imaging') and v_action in ('amend','re_request')$new$);

-- Keep actor/version acknowledgements and historical snapshots. Only the
-- quantity-only fallback is specific to dispensing; schema labels are shared.
select pg_temp.patch_shared_workflow('private.clair_task_effective_instructions_before_partial(text,uuid)',
  $old$coalesce(text_value,'요청 조제량 또는 조제량 입력 방식 변경')$old$,
  $new$coalesce(text_value,case when t.clinical_order_type='dispensing' then '요청 조제량 또는 조제량 입력 방식 변경' else '오더 내용 변경' end)$new$);
select pg_temp.patch_shared_workflow('private.clair_localize_task_instruction_changes(public.order_tasks,jsonb)',
  $old$coalesce(changes.description, '요청 조제량 또는 조제량 입력 방식 변경')$old$,
  $new$coalesce(changes.description, case when p_task.clinical_order_type='dispensing' then '요청 조제량 또는 조제량 입력 방식 변경' else '오더 내용 변경' end)$new$);

-- Existing claim now also starts examinations atomically. No new action or
-- permission is introduced, and other queues keep their current claim behavior.
select pg_temp.patch_shared_workflow('public.clair_transition_fulfillment_work_item(text,uuid,uuid,text,bigint,uuid,uuid,text,text)',
  '  v_event_type text;',
  E'  v_event_type text;\n  v_claim_starts_work boolean;\n  v_reviewed_document jsonb;\n  v_assigned_document jsonb;');
select pg_temp.patch_shared_workflow('public.clair_transition_fulfillment_work_item(text,uuid,uuid,text,bigint,uuid,uuid,text,text)',
  '  v_next_status := v_item.status;',
  E'  v_claim_starts_work := p_action=\'claim\' and v_item.queue_type in (\'lab\',\'external_lab\',\'imaging\');\n  v_next_status := v_item.status;');
select pg_temp.patch_shared_workflow('public.clair_transition_fulfillment_work_item(text,uuid,uuid,text,bigint,uuid,uuid,text,text)',
  $old$    v_next_assignee := p_actor_user_id;
    v_event_type := 'assigned';
  elsif p_action = 'start' then$old$,
  $new$    v_next_assignee := p_actor_user_id;
    v_event_type := 'assigned';
    if v_claim_starts_work then
      v_next_status := 'in_progress';
      v_next_phase := case when v_item.queue_type='imaging' then 'interpretation_in_progress' else 'inputting' end;
    end if;
  elsif p_action = 'start' then$new$);
select pg_temp.patch_shared_workflow('public.clair_transition_fulfillment_work_item(text,uuid,uuid,text,bigint,uuid,uuid,text,text)',
  $old$  if p_action in ('start','resume','complete') then
    perform private.clair_require_task_instruction_ack(p_workspace_id,v_task.id,p_actor_user_id);
  end if;$old$,
  $new$  if p_action in ('start','resume','complete') or v_claim_starts_work then
    perform private.clair_require_task_instruction_ack(p_workspace_id,v_task.id,p_actor_user_id);
    if v_claim_starts_work then
      v_reviewed_document := private.clair_task_effective_instructions(p_workspace_id,v_task.id);
    end if;
  end if;$new$);
select pg_temp.patch_shared_workflow('public.clair_transition_fulfillment_work_item(text,uuid,uuid,text,bigint,uuid,uuid,text,text)',
  $old$case when p_action = 'start' then$old$,
  $new$case when p_action = 'start' or v_claim_starts_work then$new$, 4);
select pg_temp.patch_shared_workflow('public.clair_transition_fulfillment_work_item(text,uuid,uuid,text,bigint,uuid,uuid,text,text)',
  $old$  if p_action = 'return' then
    update public.order_billing_candidates candidate$old$,
  $new$  if v_claim_starts_work then
    v_assigned_document := private.clair_task_effective_instructions(p_workspace_id,v_task.id);
    if (v_reviewed_document - 'versionKey') is distinct from (v_assigned_document - 'versionKey') then
      raise exception 'instruction_version_conflict';
    end if;
    -- The same actor reviewed identical contents immediately before this claim.
    -- Bind that proof to its own new assignment only; handoff never carries it.
    if v_reviewed_document->>'versionKey' is distinct from v_assigned_document->>'versionKey' then
      insert into private.chart_instruction_acknowledgements(workspace_id,chart_id,actor_id,scope,version_key,document)
      select p_workspace_id,(v_assigned_document->>'chartId')::uuid,p_actor_user_id,
        v_assigned_document->>'scope',v_assigned_document->>'versionKey',v_assigned_document
      where exists(select 1 from private.chart_instruction_acknowledgements a
        where a.workspace_id=p_workspace_id and a.chart_id=(v_reviewed_document->>'chartId')::uuid
          and a.actor_id=p_actor_user_id and a.version_key=v_reviewed_document->>'versionKey')
      on conflict do nothing;
    end if;
    insert into public.order_task_events(workspace_id,task_id,task_attempt_no,order_id,event_type,actor_user_id,before_values,after_values)
    values(p_workspace_id,v_task.id,v_task.attempt_no,v_item.order_id,'started',p_actor_user_id,
      jsonb_build_object('status',v_task.status),
      jsonb_build_object('status','in_progress','action','claim','commandId',p_command_id,'workItemId',p_work_item_id));
  end if;

  if p_action = 'return' then
    update public.order_billing_candidates candidate$new$);

select pg_temp.patch_shared_workflow('public.clair_get_order_execution_context(text,uuid,uuid)',
$old$    'results',history);$old$,
$new$    'priorTasks',coalesce((select jsonb_agg(jsonb_build_object('taskId',prior.id,'attemptNo',prior.attempt_no) order by prior.attempt_no desc)
      from public.order_tasks prior where prior.workspace_id=p_workspace_id and prior.order_id=t.order_id and prior.task_role='execution' and prior.attempt_no<t.attempt_no),'[]'::jsonb),
    'results',history);$new$);
commit;
