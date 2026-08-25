-- Chart order execution Phase 8: one workspace-scoped downstream read model
-- for Task history, routed Queue projections, Billing candidates, and the
-- invariants that reconcile those projections back to confirmed Orders.

set lock_timeout = '5s';
set statement_timeout = '120s';

create or replace function public.clair_get_chart_order_execution_read_model(
  p_workspace_id text,
  p_encounter_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private, extensions, pg_temp
as $function$
declare
  v_can_view_billing boolean;
  v_result jsonb;
begin
  if auth.uid() is null
    or not private.clair_is_active_workspace_member(p_workspace_id)
    or not private.clair_current_user_has_workspace_permission(
      p_workspace_id,
      'chart:view'
    )
  then
    raise exception 'permission_denied' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.encounters encounter
    where encounter.workspace_id = p_workspace_id
      and encounter.id = p_encounter_id
  ) then
    raise exception 'encounter_unavailable';
  end if;

  v_can_view_billing := private.clair_current_user_has_workspace_permission(
    p_workspace_id,
    'billing:view'
  );

  select jsonb_build_object(
    'workspaceId', p_workspace_id,
    'encounterId', p_encounter_id,
    'tasks', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'taskId', task.id,
          'orderId', task.order_id,
          'parentTaskId', task.parent_task_id,
          'taskRole', task.task_role,
          'clinicalOrderType', task.clinical_order_type,
          'destinationModule', task.destination_module,
          'status', task.status,
          'priority', task.priority,
          'attemptNo', task.attempt_no,
          'reRequestedFromTaskId', task.re_requested_from_task_id,
          'effectiveSnapshot', task.effective_snapshot,
          'resultSnapshot', task.result_snapshot,
          'startedAt', task.started_at,
          'completedAt', task.completed_at,
          'cancelledAt', task.cancelled_at,
          'createdAt', task.created_at,
          'updatedAt', task.updated_at
        ) order by task.created_at, task.attempt_no, task.id
      )
      from public.order_tasks task
      where task.workspace_id = p_workspace_id
        and task.encounter_id = p_encounter_id
    ), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'eventId', event.id,
          'taskId', event.task_id,
          'taskAttemptNo', event.task_attempt_no,
          'orderId', event.order_id,
          'eventType', event.event_type,
          'actorUserId', event.actor_user_id,
          'reason', event.reason,
          'beforeValues', event.before_values,
          'afterValues', event.after_values,
          'commandId', event.command_id,
          'createdAt', event.created_at
        ) order by event.created_at, event.id
      )
      from public.order_task_events event
      join public.order_tasks task
        on task.workspace_id = event.workspace_id
       and task.id = event.task_id
       and task.attempt_no = event.task_attempt_no
      where event.workspace_id = p_workspace_id
        and task.encounter_id = p_encounter_id
    ), '[]'::jsonb),
    'revisions', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'revisionId', revision.id,
          'orderId', revision.order_id,
          'revisionNo', revision.revision_no,
          'changeType', revision.change_type,
          'reason', revision.reason,
          'actorUserId', revision.created_by_user_id,
          'beforeValues', revision.before_values,
          'afterValues', revision.after_values,
          'affectedTasks', revision.affected_tasks,
          'billingImpact', revision.billing_impact,
          'createdAt', revision.created_at,
          'completedAt', revision.completed_at
        ) order by revision.created_at, revision.revision_no, revision.id
      )
      from public.order_revisions revision
      join public.orders orders
        on orders.workspace_id = revision.workspace_id
       and orders.id = revision.order_id
      where revision.workspace_id = p_workspace_id
        and orders.encounter_id = p_encounter_id
    ), '[]'::jsonb),
    'queues', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'workItemId', queue.id,
          'orderId', queue.order_id,
          'taskId', queue.task_id,
          'taskAttemptNo', queue.task_attempt_no,
          'destinationModule', queue.destination_module,
          'queueType', queue.queue_type,
          'queueStatus', queue.status,
          'updatedAt', queue.updated_at
        ) order by queue.updated_at, queue.id
      )
      from public.order_fulfillment_work_items queue
      where queue.workspace_id = p_workspace_id
        and queue.encounter_id = p_encounter_id
        and queue.task_id is not null
    ), '[]'::jsonb),
    'billingCandidates', case when v_can_view_billing then coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'billingCandidateId', candidate.id,
          'orderId', candidate.order_id,
          'taskId', candidate.task_id,
          'taskAttemptNo', candidate.task_attempt_no,
          'status', candidate.status,
          'amount', candidate.amount,
          'invoiceLineId', candidate.invoice_line_id,
          'updatedAt', candidate.updated_at
        ) order by candidate.updated_at, candidate.id
      )
      from public.order_billing_candidates candidate
      where candidate.workspace_id = p_workspace_id
        and candidate.encounter_id = p_encounter_id
    ), '[]'::jsonb) else '[]'::jsonb end,
    'reconciliation', jsonb_build_object(
      'confirmedAtomicCount', (
        select count(*)
        from public.orders orders
        where orders.workspace_id = p_workspace_id
          and orders.encounter_id = p_encounter_id
          and orders.row_type in ('individual','set_child')
          and orders.order_confirmation_status in ('confirmed','billed')
      ),
      'executionTaskCount', (
        select count(*)
        from public.order_tasks task
        where task.workspace_id = p_workspace_id
          and task.encounter_id = p_encounter_id
          and task.task_role = 'execution'
      ),
      'missingTaskCount', (
        select count(*)
        from public.orders orders
        where orders.workspace_id = p_workspace_id
          and orders.encounter_id = p_encounter_id
          and orders.row_type in ('individual','set_child')
          and orders.order_confirmation_status in ('confirmed','billed')
          and not exists (
            select 1
            from public.order_tasks task
            where task.workspace_id = orders.workspace_id
              and task.order_id = orders.id
          )
      ),
      'duplicateTaskCount', coalesce((
        select sum(duplicate_count - 1)
        from (
          select count(*) as duplicate_count
          from public.order_tasks task
          where task.workspace_id = p_workspace_id
            and task.encounter_id = p_encounter_id
          group by task.order_id, task.attempt_no
          having count(*) > 1
        ) duplicates
      ), 0),
      'duplicateQueueCount', coalesce((
        select sum(duplicate_count - 1)
        from (
          select count(*) as duplicate_count
          from public.order_fulfillment_work_items queue
          where queue.workspace_id = p_workspace_id
            and queue.encounter_id = p_encounter_id
            and queue.task_id is not null
          group by queue.task_id, queue.task_attempt_no
          having count(*) > 1
        ) duplicates
      ), 0),
      'duplicateBillingCandidateCount', coalesce((
        select sum(duplicate_count - 1)
        from (
          select count(*) as duplicate_count
          from public.order_billing_candidates candidate
          where candidate.workspace_id = p_workspace_id
            and candidate.encounter_id = p_encounter_id
          group by candidate.order_id
          having count(*) > 1
        ) duplicates
      ), 0),
      'destinationlessQueueCount', (
        select count(*)
        from public.order_fulfillment_work_items queue
        join public.order_tasks task
          on task.workspace_id = queue.workspace_id
         and task.id = queue.task_id
         and task.attempt_no = queue.task_attempt_no
        where queue.workspace_id = p_workspace_id
          and queue.encounter_id = p_encounter_id
          and task.destination_module is null
      ),
      'aggregateQueueCount', (
        select count(*)
        from public.order_fulfillment_work_items queue
        join public.order_tasks task
          on task.workspace_id = queue.workspace_id
         and task.id = queue.task_id
         and task.attempt_no = queue.task_attempt_no
        where queue.workspace_id = p_workspace_id
          and queue.encounter_id = p_encounter_id
          and task.task_role = 'aggregate'
      ),
      'orphanTaskCount', (
        select count(*)
        from public.order_tasks task
        left join public.orders orders
          on orders.workspace_id = task.workspace_id
         and orders.id = task.order_id
         and orders.encounter_id = task.encounter_id
        where task.workspace_id = p_workspace_id
          and task.encounter_id = p_encounter_id
          and orders.id is null
      ),
      'orphanQueueCount', (
        select count(*)
        from public.order_fulfillment_work_items queue
        left join public.order_tasks task
          on task.workspace_id = queue.workspace_id
         and task.id = queue.task_id
         and task.attempt_no = queue.task_attempt_no
        where queue.workspace_id = p_workspace_id
          and queue.encounter_id = p_encounter_id
          and queue.task_id is not null
          and (
            task.id is null
            or task.order_id is distinct from queue.order_id
            or task.destination_module is distinct from queue.destination_module
            or task.task_role is distinct from 'execution'
          )
      ),
      'orphanBillingCandidateCount', (
        select count(*)
        from public.order_billing_candidates candidate
        left join public.order_tasks task
          on task.workspace_id = candidate.workspace_id
         and task.id = candidate.task_id
         and task.attempt_no = candidate.task_attempt_no
        where candidate.workspace_id = p_workspace_id
          and candidate.encounter_id = p_encounter_id
          and (
            task.id is null
            or task.order_id is distinct from candidate.order_id
            or task.task_role is distinct from 'execution'
          )
      ),
      'draftArtifactCount', (
        select count(*)
        from (
          select task.id::text as artifact_id
          from public.order_tasks task
          join public.orders orders
            on orders.workspace_id = task.workspace_id
           and orders.id = task.order_id
          where task.workspace_id = p_workspace_id
            and task.encounter_id = p_encounter_id
            and orders.order_confirmation_status in ('draft','pending')
          union all
          select queue.id::text
          from public.order_fulfillment_work_items queue
          join public.orders orders
            on orders.workspace_id = queue.workspace_id
           and orders.id = queue.order_id
          where queue.workspace_id = p_workspace_id
            and queue.encounter_id = p_encounter_id
            and queue.task_id is not null
            and orders.order_confirmation_status in ('draft','pending')
          union all
          select candidate.id
          from public.order_billing_candidates candidate
          join public.orders orders
            on orders.workspace_id = candidate.workspace_id
           and orders.id = candidate.order_id
          where candidate.workspace_id = p_workspace_id
            and candidate.encounter_id = p_encounter_id
            and orders.order_confirmation_status in ('draft','pending')
        ) artifacts
      )
    )
  ) into v_result;

  return v_result;
end;
$function$;

revoke all on function public.clair_get_chart_order_execution_read_model(text, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.clair_get_chart_order_execution_read_model(text, uuid)
  to authenticated;

comment on function public.clair_get_chart_order_execution_read_model(text, uuid) is
  'Returns the workspace-scoped chart Order -> Task -> Queue/Billing/history read model and reconciliation counts. Billing links are omitted without billing:view.';
