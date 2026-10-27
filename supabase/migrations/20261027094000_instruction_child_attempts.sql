-- Item edits keep the aggregate identity; execution attempts advance independently.
-- Unchanged completed children and their actual-result versions are never copied.
begin;
set local lock_timeout='5s';
set local statement_timeout='120s';

create function pg_temp.patch_instruction_function(signature text,old text,replacement text,expected integer default 1)
returns void language plpgsql as $$
declare d text;
begin
 d:=pg_get_functiondef(signature::regprocedure);
 if (length(d)-length(replace(d,old,'')))/length(old)<>expected then raise exception 'instruction_child_anchor: % / %',signature,left(old,80); end if;
 execute replace(d,old,replacement);
end $$;

select pg_temp.patch_instruction_function('private.clair_assert_order_task_identity_and_history()',
 'or v_parent.attempt_no is distinct from new.attempt_no',
 'or (v_parent.attempt_no is distinct from new.attempt_no and new.destination_module not in (''dispensing'',''treatment''))');

select pg_temp.patch_instruction_function('private.clair_calculate_aggregate_task_status(text,uuid)',
 'and child.parent_task_id = p_aggregate_task_id;',
 'and child.parent_task_id = p_aggregate_task_id
    and not exists(select 1 from public.order_tasks newer where newer.workspace_id=child.workspace_id
      and newer.order_id=child.order_id and newer.attempt_no>child.attempt_no);');
select pg_temp.patch_instruction_function('private.clair_calculate_aggregate_task_status(text,uuid)',
 'child.parent_task_id=p_aggregate_task_id and child.destination_module',
 'child.parent_task_id=p_aggregate_task_id
      and not exists(select 1 from public.order_tasks newer where newer.workspace_id=child.workspace_id and newer.order_id=child.order_id and newer.attempt_no>child.attempt_no)
      and child.destination_module');
select pg_temp.patch_instruction_function('private.clair_calculate_aggregate_task_status(text,uuid)',
 'child.parent_task_id=p_aggregate_task_id and child.status',
 'child.parent_task_id=p_aggregate_task_id
      and not exists(select 1 from public.order_tasks newer where newer.workspace_id=child.workspace_id and newer.order_id=child.order_id and newer.attempt_no>child.attempt_no)
      and child.status');

-- Keep the chart-origin wrappers and clinical validation/calculation body intact.
select pg_temp.patch_instruction_function('public.clair_mutate_chart_order_execution_origin_base(text,uuid,uuid,text,text,integer,jsonb,text)',
 $old$  select * into v_order
  from public.orders orders
  where orders.workspace_id = p_workspace_id
    and orders.id = p_order_id
  for update;$old$,
 $new$  perform private.clair_lock_work_ownership(p_workspace_id,p_order_id);
  perform 1 from public.orders root where root.workspace_id=p_workspace_id and root.id=(
    select coalesce(o.parent_chart_order_line_id,o.id) from public.orders o where o.workspace_id=p_workspace_id and o.id=p_order_id) for update;
  select * into v_order
  from public.orders orders
  where orders.workspace_id = p_workspace_id
    and orders.id = p_order_id
  for update;$new$);

select pg_temp.patch_instruction_function('public.clair_mutate_chart_order_execution_origin_base(text,uuid,uuid,text,text,integer,jsonb,text)',
 $old$  if v_order.row_type = 'set_child' then
    raise exception 'set_child_independent_mutation_forbidden';
  end if;$old$,
 $new$  if v_order.row_type = 'set_child' then
    if v_order.destination_module not in ('dispensing','treatment') or v_action not in ('amend','re_request') then
      raise exception 'set_child_independent_mutation_forbidden'; end if;
    select * into v_old_aggregate from public.order_tasks parent
    where parent.workspace_id=p_workspace_id and parent.order_id=v_order.parent_chart_order_line_id and parent.task_role='aggregate'
    order by parent.attempt_no desc limit 1 for update;
    if not found or v_old_aggregate.status in ('cancelled','returned') then raise exception 're_request_transition_invalid'; end if;
    if exists(select 1 from public.orders parent where parent.workspace_id=p_workspace_id and parent.id=v_order.parent_chart_order_line_id
      and parent.invoice_line_id is not null) or exists(select 1 from public.order_billing_candidates c
      where c.workspace_id=p_workspace_id and c.order_id=v_order.parent_chart_order_line_id
      and (c.invoice_line_id is not null or c.status in ('invoice_linked','billing_review_required'))) then
      raise exception 'billing_reversal_required'; end if;
    if v_action='re_request' and coalesce(v_changes->'detailInputs',v_order.detail_inputs)=v_order.detail_inputs
      and coalesce((v_changes->>'detailSchemaVersion')::integer,v_order.detail_schema_version)=v_order.detail_schema_version
      and coalesce(v_changes->'actualDispenseQuantity',v_order.calculation_outputs->'actualDispenseQuantity') is not distinct from v_order.calculation_outputs->'actualDispenseQuantity' then raise exception 'unchanged_instruction'; end if;
  end if;$new$);

select pg_temp.patch_instruction_function('public.clair_mutate_chart_order_execution_origin_base(text,uuid,uuid,text,text,integer,jsonb,text)',
 'v_order.row_type <> ''individual''',
 '(v_order.row_type <> ''individual'' and not (v_order.row_type=''set_child'' and v_order.destination_module in (''dispensing'',''treatment'')))');
select pg_temp.patch_instruction_function('public.clair_mutate_chart_order_execution_origin_base(text,uuid,uuid,text,text,integer,jsonb,text)',
 'if v_order.row_type = ''individual'' and exists (',
 'if v_order.row_type in (''individual'',''set_child'') and exists (');

-- The independent-child branch carries the existing aggregate reference.
select pg_temp.patch_instruction_function('public.clair_mutate_chart_order_execution_origin_base(text,uuid,uuid,text,text,integer,jsonb,text)',
 $old$      insert into public.order_tasks(
        workspace_id, encounter_id, order_id, task_role,
        clinical_order_type, destination_module, status, priority,
        attempt_no, request_cycle, re_requested_from_task_id, effective_snapshot,
        created_by_user_id, created_at, updated_at
      ) values (
        p_workspace_id, v_order.encounter_id, p_order_id, 'execution',$old$,
 $new$      insert into public.order_tasks(
        workspace_id, encounter_id, order_id, parent_task_id, task_role,
        clinical_order_type, destination_module, status, priority,
        attempt_no, request_cycle, re_requested_from_task_id, effective_snapshot,
        created_by_user_id, created_at, updated_at
      ) values (
        p_workspace_id, v_order.encounter_id, p_order_id, v_old_task.parent_task_id, 'execution',$new$);

-- A whole-set repeat selects each child's current attempt, not the aggregate's number.
select pg_temp.patch_instruction_function('public.clair_mutate_chart_order_execution_origin_base(text,uuid,uuid,text,text,integer,jsonb,text)',
 'and task.attempt_no = v_old_aggregate.attempt_no',
 'and (task.id=v_old_aggregate.id or task.parent_task_id=v_old_aggregate.id)
          and not exists(select 1 from public.order_tasks newer where newer.workspace_id=task.workspace_id and newer.order_id=task.order_id and newer.attempt_no>task.attempt_no)',2);
select pg_temp.patch_instruction_function('public.clair_mutate_chart_order_execution_origin_base(text,uuid,uuid,text,text,integer,jsonb,text)',
 'v_next_attempt, v_next_attempt, v_old_task.id,',
 'v_old_task.attempt_no+1, v_old_task.attempt_no+1, v_old_task.id,',2);
select pg_temp.patch_instruction_function('public.clair_mutate_chart_order_execution_origin_base(text,uuid,uuid,text,text,integer,jsonb,text)',
 $old$'taskId', v_new_task.id,
          'attemptNo', v_next_attempt,$old$,
 $new$'taskId', v_new_task.id,
          'attemptNo', v_new_task.attempt_no,$new$);

-- Pending edits also invalidate the optimistic revision used by the instruction.
select pg_temp.patch_instruction_function('public.clair_mutate_chart_order_execution_origin_base(text,uuid,uuid,text,text,integer,jsonb,text)',
 'set source_snapshot = v_new_task.effective_snapshot, updated_at = v_now',
 'set source_snapshot = v_new_task.effective_snapshot, row_revision=item.row_revision+1, updated_at = v_now');

select pg_temp.patch_instruction_function('public.clair_mutate_chart_order_execution_origin_base(text,uuid,uuid,text,text,integer,jsonb,text)',
 '  v_after := jsonb_build_object(',
 $new$  if v_order.row_type='set_child' and v_order.destination_module in ('dispensing','treatment') and v_action in ('amend','re_request') then
    update private.fulfillment_instruction_state set finalized=false,revision=revision+1
    where workspace_id=p_workspace_id and root_task_id=v_old_aggregate.id and queue_type=v_order.destination_module;
    insert into private.fulfillment_instruction_reopen_scope values(txid_current(),p_workspace_id,v_old_aggregate.id,p_actor_user_id) on conflict do nothing;
    update public.order_tasks parent set status=case
      when private.clair_calculate_aggregate_task_status(p_workspace_id,parent.id)='pending' and parent.started_at is not null then 'in_progress'
      else private.clair_calculate_aggregate_task_status(p_workspace_id,parent.id) end,
      completed_at=null,row_revision=row_revision+1,updated_at=v_now
    where parent.workspace_id=p_workspace_id and parent.id=v_old_aggregate.id;
    delete from private.fulfillment_instruction_reopen_scope where transaction_id=txid_current() and workspace_id=p_workspace_id and task_id=v_old_aggregate.id;
    update public.orders parent set status=case when v_old_aggregate.started_at is not null then 'in_progress' else 'confirmed' end,
      work_status='pending',task_status=(select status from public.order_tasks where workspace_id=p_workspace_id and id=v_old_aggregate.id),updated_at=v_now
    where parent.workspace_id=p_workspace_id and parent.id=v_order.parent_chart_order_line_id;
    insert into public.order_task_events(workspace_id,task_id,task_attempt_no,order_id,event_type,actor_user_id,reason,before_values,after_values)
    values(p_workspace_id,v_old_aggregate.id,v_old_aggregate.attempt_no,v_old_aggregate.order_id,'re_requested',p_actor_user_id,v_reason,
      jsonb_build_object('status',v_old_aggregate.status),jsonb_build_object('changedOrderId',p_order_id,'orderRevisionId',v_revision.id));
  end if;
  v_after := jsonb_build_object($new$);

select pg_temp.patch_instruction_function('public.clair_mutate_chart_order_execution_origin_base(text,uuid,uuid,text,text,integer,jsonb,text)',
 $old$'nextAttemptNo', v_next_attempt$old$,
 $new$'nextAttemptNo', v_old_task.attempt_no+1$new$,2);

select pg_temp.patch_instruction_function('public.clair_mutate_chart_order_execution_origin_base(text,uuid,uuid,text,text,integer,jsonb,text)',
 'coalesce(v_old_aggregate.attempt_no, v_old_task.attempt_no)',
 'case when v_order.row_type=''set_child'' then v_old_task.attempt_no else coalesce(v_old_aggregate.attempt_no, v_old_task.attempt_no) end');

drop function pg_temp.patch_instruction_function(text,text,text,integer);
commit;
