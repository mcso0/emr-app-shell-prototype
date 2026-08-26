begin;

-- Returning a fulfillment item to the shared queue is the persisted form of
-- the UI's assignment-cancel action. Keep the existing transition, actor,
-- permission, Task-alignment, and audit contract, but allow that transition to
-- clear the assignee instead of coalescing NULL back to the previous owner.
create or replace function public.clair_update_fulfillment_work_item(
  p_workspace_id text,
  p_actor_user_id uuid,
  p_work_item_id uuid,
  p_status text,
  p_assigned_to_user_id uuid default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_item public.order_fulfillment_work_items%rowtype;
  v_task public.order_tasks%rowtype;
  v_now timestamptz := now();
  v_next_task_status text;
  v_event_type text;
begin
  if auth.uid() is null or p_actor_user_id is distinct from auth.uid() then
    raise exception 'actor_mismatch' using errcode = '42501';
  end if;
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing';
  end if;

  select * into v_item
  from public.order_fulfillment_work_items item
  where item.workspace_id = p_workspace_id and item.id = p_work_item_id
  for update;
  if not found then raise exception 'work_item_unavailable'; end if;

  if not private.clair_current_user_has_workspace_permission(
    p_workspace_id,
    private.clair_queue_permission_for_destination(
      coalesce(v_item.destination_module, v_item.queue_type),
      'mutate'
    )
  ) then
    raise exception 'permission_missing';
  end if;
  if p_status not in (
    'requested','accepted','in_progress','completed','cancelled','returned'
  ) or not private.clair_fulfillment_transition_allowed(v_item.status, p_status) then
    raise exception 'invalid_transition';
  end if;
  if p_status in ('cancelled','returned')
    and length(btrim(coalesce(p_reason, ''))) = 0
  then
    raise exception 'reason_required';
  end if;

  update public.order_fulfillment_work_items item
  set
    status = p_status,
    assigned_to_user_id = case
      when p_status = 'returned' and p_assigned_to_user_id is null then null
      else coalesce(p_assigned_to_user_id, item.assigned_to_user_id)
    end,
    completed_at = case when p_status = 'completed' then v_now else item.completed_at end,
    cancelled_at = case when p_status = 'cancelled' then v_now else item.cancelled_at end,
    returned_at = case when p_status = 'returned' then v_now else item.returned_at end,
    reason = coalesce(nullif(btrim(p_reason), ''), item.reason),
    updated_at = v_now
  where item.workspace_id = p_workspace_id and item.id = p_work_item_id;

  if v_item.task_id is not null then
    select * into v_task
    from public.order_tasks task
    where task.workspace_id = p_workspace_id
      and task.id = v_item.task_id
      and task.attempt_no = v_item.task_attempt_no
    for update;
    if not found then raise exception 'queue_projection_task_mismatch'; end if;

    v_next_task_status := case p_status
      when 'in_progress' then 'in_progress'
      when 'completed' then 'complete'
      when 'cancelled' then 'cancelled'
      when 'returned' then 'paused'
      else 'pending'
    end;
    v_event_type := case p_status
      when 'in_progress' then 'started'
      when 'completed' then 'completed'
      when 'cancelled' then 'cancelled'
      when 'returned' then 'paused'
      when 'requested' then 'resumed'
      else 'created'
    end;

    update public.order_tasks task
    set
      status = v_next_task_status,
      started_at = case
        when v_next_task_status = 'in_progress' then coalesce(task.started_at, v_now)
        else task.started_at
      end,
      completed_at = case
        when v_next_task_status = 'complete' then coalesce(task.completed_at, v_now)
        else task.completed_at
      end,
      cancelled_at = case
        when v_next_task_status = 'cancelled' then coalesce(task.cancelled_at, v_now)
        else task.cancelled_at
      end,
      result_snapshot = case
        when v_next_task_status = 'complete' then coalesce(
          task.result_snapshot,
          jsonb_build_object(
            'source', 'queue_projection',
            'workItemId', p_work_item_id,
            'completedAt', v_now
          )
        )
        else task.result_snapshot
      end,
      updated_at = v_now
    where task.workspace_id = p_workspace_id and task.id = v_task.id;

    insert into public.order_task_events (
      workspace_id, task_id, task_attempt_no, order_id, event_type,
      actor_user_id, reason, before_values, after_values, created_at
    ) values (
      p_workspace_id, v_task.id, v_task.attempt_no, v_task.order_id, v_event_type,
      p_actor_user_id, nullif(btrim(p_reason), ''),
      jsonb_build_object('taskStatus', v_task.status, 'queueStatus', v_item.status),
      jsonb_build_object('taskStatus', v_next_task_status, 'queueStatus', p_status),
      v_now
    );
  end if;

  insert into public.order_events (
    workspace_id, order_id, event_type, performed_by_user_id, payload, created_at
  ) values (
    p_workspace_id,
    v_item.order_id,
    case when p_status = 'completed' then 'completed' else 'edited' end,
    p_actor_user_id,
    jsonb_build_object(
      'action', 'fulfillment_work_item_update',
      'fulfillmentWorkItemId', p_work_item_id,
      'taskId', v_item.task_id,
      'taskAttemptNo', v_item.task_attempt_no,
      'previousStatus', v_item.status,
      'nextStatus', p_status,
      'reason', nullif(btrim(p_reason), '')
    ),
    v_now
  );

  return public.clair_list_fulfillment_work_items(
    p_workspace_id, v_item.queue_type, v_item.encounter_id, v_item.order_id, null
  );
end;
$function$;

revoke all on function public.clair_update_fulfillment_work_item(
  text,uuid,uuid,text,uuid,text
) from public, anon;
grant execute on function public.clair_update_fulfillment_work_item(
  text,uuid,uuid,text,uuid,text
) to authenticated;

comment on function public.clair_update_fulfillment_work_item(
  text,uuid,uuid,text,uuid,text
) is
  'Permission-checked fulfillment transition with aligned universal Task state; returned plus a null assignee releases the item to the shared queue.';

commit;
