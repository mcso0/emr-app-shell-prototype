-- Chart order execution Phase 9: deterministic production backfill.
--
-- This migration intentionally runs after the additive execution contract. It
-- classifies legacy rows only from durable columns and catalog routing data;
-- display names are never used to infer a clinical type, destination, or set
-- relationship. The helper is idempotent and remains private so a forward-fix
-- can safely repair a partially imported legacy row without exposing a public
-- mutation surface.

set lock_timeout = '5s';
set statement_timeout = '120s';

create or replace function private.clair_chart_order_backfill_uuid(p_seed text)
returns uuid
language sql
immutable
strict
security definer
set search_path = pg_catalog, extensions
as $function$
  with digest_value as (
    select encode(extensions.digest(p_seed::bytea, 'sha256'), 'hex') as value
  )
  select (
    substr(value, 1, 8) || '-' ||
    substr(value, 9, 4) || '-' ||
    substr(value, 13, 4) || '-' ||
    substr(value, 17, 4) || '-' ||
    substr(value, 21, 12)
  )::uuid
  from digest_value;
$function$;

revoke all on function private.clair_chart_order_backfill_uuid(text)
  from public, anon, authenticated, service_role;

create or replace function private.clair_backfill_chart_order_execution()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions, pg_temp
as $function$
declare
  v_now timestamptz := clock_timestamp();
  v_invalid_count bigint;
  v_task_count bigint;
  v_queue_count bigint;
  v_billing_count bigint;
  v_command_count bigint;
  v_event_count bigint;
begin
  -- Fail before writing if a durable relationship cannot be explained.
  select count(*) into v_invalid_count
  from public.orders child
  left join public.orders parent
    on parent.workspace_id = child.workspace_id
   and parent.id = child.parent_chart_order_line_id
  where child.order_confirmation_status in ('confirmed','billed')
    and child.row_type = 'set_child'
    and (
      parent.id is null
      or parent.encounter_id is distinct from child.encounter_id
      or parent.row_type <> 'set'
      or parent.order_confirmation_status not in ('confirmed','billed')
    );
  if v_invalid_count > 0 then
    raise exception 'legacy_confirmed_set_child_without_confirmed_parent:%',
      v_invalid_count using errcode = '23514';
  end if;

  select count(*) into v_invalid_count
  from public.orders orders
  left join lateral (
    select membership.user_id
    from public.user_memberships membership
    where membership.workspace_id = orders.workspace_id
      and membership.status = 'active'
    order by membership.created_at, membership.id
    limit 1
  ) fallback_actor on true
  where orders.order_confirmation_status in ('confirmed','billed')
    and orders.row_type in ('individual','set','set_child')
    and coalesce(
      orders.confirmed_by_user_id,
      orders.requested_by_user_id,
      fallback_actor.user_id
    ) is null;
  if v_invalid_count > 0 then
    raise exception 'legacy_confirmed_order_without_actor:%', v_invalid_count
      using errcode = '23514';
  end if;

  select count(*) into v_invalid_count
  from (
    select line.workspace_id, line.order_id
    from public.invoice_lines line
    where line.order_id is not null
    group by line.workspace_id, line.order_id
    having count(*) > 1
  ) duplicates;
  if v_invalid_count > 0 then
    raise exception 'legacy_order_has_multiple_invoice_lines:%', v_invalid_count
      using errcode = '23514';
  end if;

  -- One deterministic command per historical top-level root. This gives
  -- billing candidates and task events the same durable confirmation anchor
  -- as newly confirmed rows without pretending the old client supplied one.
  insert into public.order_confirmation_commands(
    id, workspace_id, encounter_id, actor_user_id, idempotency_key,
    request_sha256, expected_draft_etag, selected_root_order_ids,
    status, result, created_at, completed_at
  )
  select
    private.clair_chart_order_backfill_uuid(
      'chart-order-backfill-command-v1|' || root.workspace_id || '|' || root.id::text
    ),
    root.workspace_id,
    root.encounter_id,
    coalesce(root.confirmed_by_user_id, root.requested_by_user_id, fallback_actor.user_id),
    'legacy-order-backfill-' || root.id::text,
    encode(extensions.digest(
      ('chart-order-backfill-request-v1|' || root.workspace_id || '|' || root.id::text)::bytea,
      'sha256'
    ), 'hex'),
    '"' || repeat('0', 64) || '"',
    array[root.id]::uuid[],
    'completed',
    jsonb_build_object(
      'version', 1,
      'source', 'legacy-production-backfill',
      'rootOrderId', root.id,
      'workspaceId', root.workspace_id,
      'encounterId', root.encounter_id
    ),
    coalesce(root.confirmed_at, root.requested_at, root.created_at),
    coalesce(root.confirmed_at, root.requested_at, root.created_at)
  from public.orders root
  left join lateral (
    select membership.user_id
    from public.user_memberships membership
    where membership.workspace_id = root.workspace_id
      and membership.status = 'active'
    order by membership.created_at, membership.id
    limit 1
  ) fallback_actor on true
  where root.order_confirmation_status in ('confirmed','billed')
    and root.row_type in ('individual','set')
    and (
      not exists (
        select 1
        from public.order_tasks task
        where task.workspace_id = root.workspace_id
          and task.order_id = root.id
          and task.attempt_no = 1
      )
      or exists (
        select 1
        from public.orders child
        where child.workspace_id = root.workspace_id
          and child.parent_chart_order_line_id = root.id
          and child.order_confirmation_status in ('confirmed','billed')
          and child.row_type = 'set_child'
          and not exists (
            select 1
            from public.order_tasks task
            where task.workspace_id = child.workspace_id
              and task.order_id = child.id
              and task.attempt_no = 1
          )
      )
    )
  on conflict (workspace_id, idempotency_key) do nothing;

  get diagnostics v_command_count = row_count;

  -- Durable set parents alone qualify for aggregate backfill.
  insert into public.order_tasks(
    id, workspace_id, encounter_id, order_id, task_role,
    clinical_order_type, destination_module, status, priority, attempt_no,
    effective_snapshot, created_by_user_id, created_at, updated_at
  )
  select
    private.clair_chart_order_backfill_uuid(
      'chart-order-backfill-task-v1|' || orders.workspace_id || '|' || orders.id::text || '|1'
    ),
    orders.workspace_id,
    orders.encounter_id,
    orders.id,
    'aggregate',
    orders.clinical_order_type,
    null,
    'pending',
    case when orders.priority = 'urgent' then 'urgent' else 'normal' end,
    1,
    orders.confirmed_snapshot || jsonb_build_object(
      'legacyBackfill', jsonb_build_object(
        'version', 1,
        'classification', 'durable_set_parent',
        'backfilledAt', v_now
      )
    ),
    coalesce(orders.confirmed_by_user_id, orders.requested_by_user_id, fallback_actor.user_id),
    coalesce(orders.confirmed_at, orders.requested_at, orders.created_at),
    coalesce(orders.confirmed_at, orders.requested_at, orders.created_at)
  from public.orders orders
  left join lateral (
    select membership.user_id
    from public.user_memberships membership
    where membership.workspace_id = orders.workspace_id
      and membership.status = 'active'
    order by membership.created_at, membership.id
    limit 1
  ) fallback_actor on true
  where orders.order_confirmation_status in ('confirmed','billed')
    and orders.row_type = 'set'
  on conflict (workspace_id, order_id, attempt_no) do nothing;

  -- Every historical confirmed atomic Order receives exactly one first Task.
  -- Existing queue lifecycle wins over the coarse legacy Order lifecycle.
  insert into public.order_tasks(
    id, workspace_id, encounter_id, order_id, parent_task_id, task_role,
    clinical_order_type, destination_module, status, priority, attempt_no,
    effective_snapshot, result_snapshot, created_by_user_id,
    started_at, completed_at, cancelled_at, created_at, updated_at
  )
  select
    private.clair_chart_order_backfill_uuid(
      'chart-order-backfill-task-v1|' || orders.workspace_id || '|' || orders.id::text || '|1'
    ),
    orders.workspace_id,
    orders.encounter_id,
    orders.id,
    parent_task.id,
    'execution',
    orders.clinical_order_type,
    orders.destination_module,
    state.task_status,
    case when orders.priority = 'urgent' then 'urgent' else 'normal' end,
    1,
    orders.confirmed_snapshot || jsonb_build_object(
      'legacyBackfill', jsonb_build_object(
        'version', 1,
        'classification', case
          when orders.destination_module is null then 'destinationless_atomic'
          when work_item.id is not null then 'routed_existing_queue'
          else 'routed_missing_queue'
        end,
        'backfilledAt', v_now
      )
    ),
    case when state.task_status = 'complete' then jsonb_build_object(
      'legacyBackfill', true,
      'resultUnavailable', true,
      'preservedLegacyOrderStatus', orders.status
    ) else null end,
    coalesce(orders.confirmed_by_user_id, orders.requested_by_user_id, fallback_actor.user_id),
    case when state.task_status = 'in_progress'
      then coalesce(work_item.created_at, orders.requested_at, orders.confirmed_at, orders.created_at)
      else null end,
    case when state.task_status = 'complete'
      then coalesce(work_item.completed_at, orders.updated_at, orders.confirmed_at, orders.created_at)
      else null end,
    case when state.task_status = 'cancelled'
      then coalesce(work_item.cancelled_at, orders.updated_at, orders.confirmed_at, orders.created_at)
      else null end,
    coalesce(orders.confirmed_at, orders.requested_at, orders.created_at),
    greatest(
      coalesce(orders.confirmed_at, orders.requested_at, orders.created_at),
      coalesce(work_item.updated_at, orders.updated_at)
    )
  from public.orders orders
  left join public.order_fulfillment_work_items work_item
    on work_item.workspace_id = orders.workspace_id
   and work_item.order_id = orders.id
  left join public.order_tasks parent_task
    on parent_task.workspace_id = orders.workspace_id
   and parent_task.order_id = orders.parent_chart_order_line_id
   and parent_task.attempt_no = 1
   and parent_task.task_role = 'aggregate'
  left join lateral (
    select membership.user_id
    from public.user_memberships membership
    where membership.workspace_id = orders.workspace_id
      and membership.status = 'active'
    order by membership.created_at, membership.id
    limit 1
  ) fallback_actor on true
  cross join lateral (
    select case
      when orders.destination_module is null then 'complete'
      when work_item.status in ('accepted','in_progress') then 'in_progress'
      when work_item.status = 'completed' then 'complete'
      when work_item.status = 'cancelled' then 'cancelled'
      when work_item.status = 'returned' then 'paused'
      when orders.status = 'in_progress' then 'in_progress'
      when orders.status in ('ready_for_billing','completed') then 'complete'
      when orders.status = 'cancelled' then 'cancelled'
      else 'pending'
    end as task_status
  ) state
  where orders.order_confirmation_status in ('confirmed','billed')
    and orders.row_type in ('individual','set_child')
  on conflict (workspace_id, order_id, attempt_no) do nothing;

  get diagnostics v_task_count = row_count;

  -- Reconcile aggregate state only after all current included child Tasks exist.
  with aggregate_state as (
    select
      aggregate_task.workspace_id,
      aggregate_task.id,
      private.clair_calculate_aggregate_task_status(
        aggregate_task.workspace_id,
        aggregate_task.id
      ) as aggregate_status,
      min(child.started_at) as first_started_at,
      max(child.completed_at) as last_completed_at,
      max(child.cancelled_at) as last_cancelled_at,
      max(child.updated_at) as last_updated_at
    from public.order_tasks aggregate_task
    left join public.order_tasks child
      on child.workspace_id = aggregate_task.workspace_id
     and child.parent_task_id = aggregate_task.id
     and child.attempt_no = aggregate_task.attempt_no
    where aggregate_task.task_role = 'aggregate'
      and aggregate_task.attempt_no = 1
      and aggregate_task.effective_snapshot ? 'legacyBackfill'
    group by aggregate_task.workspace_id, aggregate_task.id
  )
  update public.order_tasks aggregate_task
  set
    status = state.aggregate_status,
    started_at = case when state.aggregate_status = 'in_progress'
      then coalesce(aggregate_task.started_at, child_times.first_started_at, aggregate_task.created_at)
      else aggregate_task.started_at end,
    completed_at = case when state.aggregate_status = 'complete'
      then coalesce(aggregate_task.completed_at, child_times.last_completed_at, aggregate_task.created_at)
      else null end,
    cancelled_at = case when state.aggregate_status = 'cancelled'
      then coalesce(aggregate_task.cancelled_at, child_times.last_cancelled_at, aggregate_task.created_at)
      else null end,
    result_snapshot = case when state.aggregate_status = 'complete'
      then coalesce(aggregate_task.result_snapshot, jsonb_build_object(
        'legacyBackfill', true,
        'resultUnavailable', true
      ))
      else aggregate_task.result_snapshot end,
    updated_at = greatest(aggregate_task.updated_at, child_times.last_updated_at)
  from aggregate_state state
  cross join lateral (
    select
      state.first_started_at,
      state.last_completed_at,
      state.last_cancelled_at,
      state.last_updated_at
  ) child_times
  where aggregate_task.workspace_id = state.workspace_id
    and aggregate_task.id = state.id;

  -- Link the existing fulfillment row, or create exactly one routed projection
  -- if a durable canonical destination exists but the legacy row is absent.
  insert into public.order_fulfillment_work_items(
    id, workspace_id, encounter_id, order_id, order_type, queue_type,
    status, priority, requested_by_user_id, source_snapshot,
    task_id, task_attempt_no, clinical_order_type, destination_module,
    completed_at, cancelled_at, returned_at, created_at, updated_at
  )
  select
    private.clair_chart_order_backfill_uuid(
      'chart-order-backfill-queue-v1|' || task.workspace_id || '|' || task.order_id::text || '|1'
    ),
    task.workspace_id,
    task.encounter_id,
    task.order_id,
    orders.order_type,
    task.destination_module,
    case task.status
      when 'in_progress' then 'in_progress'
      when 'paused' then 'returned'
      when 'complete' then 'completed'
      when 'cancelled' then 'cancelled'
      else 'requested'
    end,
    task.priority,
    task.created_by_user_id,
    task.effective_snapshot,
    task.id,
    task.attempt_no,
    task.clinical_order_type,
    task.destination_module,
    case when task.status = 'complete' then task.completed_at else null end,
    case when task.status = 'cancelled' then task.cancelled_at else null end,
    case when task.status = 'paused' then task.updated_at else null end,
    task.created_at,
    task.updated_at
  from public.order_tasks task
  join public.orders orders
    on orders.workspace_id = task.workspace_id
   and orders.id = task.order_id
  where task.task_role = 'execution'
    and task.attempt_no = 1
    and task.destination_module is not null
    and task.effective_snapshot ? 'legacyBackfill'
  on conflict (workspace_id, order_id) do update
  set
    task_id = excluded.task_id,
    task_attempt_no = excluded.task_attempt_no,
    clinical_order_type = excluded.clinical_order_type,
    destination_module = excluded.destination_module,
    queue_type = excluded.queue_type,
    priority = excluded.priority,
    source_snapshot = excluded.source_snapshot
  where order_fulfillment_work_items.task_id is distinct from excluded.task_id
     or order_fulfillment_work_items.task_attempt_no is distinct from excluded.task_attempt_no
     or order_fulfillment_work_items.clinical_order_type is distinct from excluded.clinical_order_type
     or order_fulfillment_work_items.destination_module is distinct from excluded.destination_module
     or order_fulfillment_work_items.queue_type is distinct from excluded.queue_type
     or order_fulfillment_work_items.priority is distinct from excluded.priority
     or order_fulfillment_work_items.source_snapshot is distinct from excluded.source_snapshot;

  get diagnostics v_queue_count = row_count;

  insert into public.order_task_events(
    id, workspace_id, task_id, task_attempt_no, order_id, event_type,
    actor_user_id, reason, before_values, after_values,
    command_id, created_at
  )
  select
    private.clair_chart_order_backfill_uuid(
      'chart-order-backfill-task-event-v1|' || task.workspace_id || '|' || task.id::text
    ),
    task.workspace_id,
    task.id,
    task.attempt_no,
    task.order_id,
    'created',
    task.created_by_user_id,
    null,
    '{}'::jsonb,
    jsonb_build_object(
      'status', task.status,
      'taskRole', task.task_role,
      'priority', task.priority,
      'destinationModule', task.destination_module,
      'source', 'legacy-production-backfill'
    ),
    private.clair_chart_order_backfill_uuid(
      'chart-order-backfill-command-v1|' || root.workspace_id || '|' || root.id::text
    ),
    task.created_at
  from public.order_tasks task
  join public.orders orders
    on orders.workspace_id = task.workspace_id
   and orders.id = task.order_id
  join public.orders root
    on root.workspace_id = orders.workspace_id
   and root.id = coalesce(orders.parent_chart_order_line_id, orders.id)
  where task.attempt_no = 1
    and task.effective_snapshot ? 'legacyBackfill'
  on conflict (workspace_id, id) do nothing;

  get diagnostics v_event_count = row_count;

  insert into public.order_billing_candidates(
    id, workspace_id, encounter_id, order_id, task_id, task_attempt_no,
    status, billing_name_snapshot, quantity, unit_price, amount, currency,
    source_snapshot, created_by_user_id, confirmation_command_id,
    invoice_line_id, created_at, updated_at
  )
  select
    'billcand-' || orders.id::text,
    orders.workspace_id,
    orders.encounter_id,
    orders.id,
    task.id,
    task.attempt_no,
    case when invoice_line.id is null then 'candidate_created' else 'invoice_linked' end,
    coalesce(
      nullif(orders.billing_display_name, ''),
      nullif(orders.applied_snapshot ->> 'billingName', ''),
      nullif(orders.applied_snapshot ->> 'inHospitalOrderName', ''),
      orders.display_name
    ),
    orders.quantity,
    coalesce(orders.unit_price_snapshot, 0),
    orders.line_total_snapshot,
    'KRW',
    task.effective_snapshot,
    task.created_by_user_id,
    private.clair_chart_order_backfill_uuid(
      'chart-order-backfill-command-v1|' || root.workspace_id || '|' || root.id::text
    ),
    invoice_line.id,
    task.created_at,
    task.updated_at
  from public.orders orders
  join public.order_tasks task
    on task.workspace_id = orders.workspace_id
   and task.order_id = orders.id
   and task.attempt_no = 1
   and task.task_role = 'execution'
  join public.orders root
    on root.workspace_id = orders.workspace_id
   and root.id = coalesce(orders.parent_chart_order_line_id, orders.id)
  left join lateral (
    select line.id
    from public.invoice_lines line
    where line.workspace_id = orders.workspace_id
      and line.order_id = orders.id
    order by line.created_at, line.id
    limit 1
  ) invoice_line on true
  where orders.order_confirmation_status in ('confirmed','billed')
    and orders.row_type in ('individual','set_child')
    and orders.billing_eligible
    and orders.billing_reflection_enabled
    and orders.line_total_snapshot > 0
  on conflict (workspace_id, order_id) do nothing;

  get diagnostics v_billing_count = row_count;

  update public.orders orders
  set
    billing_candidate_status = case
      when candidate.status = 'invoice_linked' then 'invoice_linked'
      else 'candidate_created'
    end,
    billing_candidate_id = candidate.id,
    invoice_line_id = coalesce(orders.invoice_line_id, candidate.invoice_line_id)
  from public.order_billing_candidates candidate
  where candidate.workspace_id = orders.workspace_id
    and candidate.order_id = orders.id
    and (
      orders.billing_candidate_status is distinct from case
        when candidate.status = 'invoice_linked' then 'invoice_linked'
        else 'candidate_created'
      end
      or orders.billing_candidate_id is distinct from candidate.id
      or (orders.invoice_line_id is null and candidate.invoice_line_id is not null)
    );

  insert into public.audit_events(
    id, workspace_id, actor_user_id, actor_membership_id,
    event_type, target_type, target_id, encounter_id, request_id,
    before_snapshot, after_snapshot, metadata, occurred_at, created_at
  )
  select
    'chart-execution-backfill-' || task.id::text,
    task.workspace_id,
    task.created_by_user_id,
    membership.id,
    'order.confirmed',
    'order_task',
    task.id::text,
    task.encounter_id,
    private.clair_chart_order_backfill_uuid(
      'chart-order-backfill-command-v1|' || root.workspace_id || '|' || root.id::text
    )::text,
    '{}'::jsonb,
    jsonb_build_object(
      'taskId', task.id,
      'orderId', task.order_id,
      'status', task.status,
      'taskRole', task.task_role
    ),
    jsonb_build_object(
      'source', 'legacy-production-backfill',
      'classification', task.effective_snapshot -> 'legacyBackfill' ->> 'classification'
    ),
    task.created_at,
    task.created_at
  from public.order_tasks task
  join public.orders orders
    on orders.workspace_id = task.workspace_id
   and orders.id = task.order_id
  join public.orders root
    on root.workspace_id = orders.workspace_id
   and root.id = coalesce(orders.parent_chart_order_line_id, orders.id)
  left join public.user_memberships membership
    on membership.workspace_id = task.workspace_id
   and membership.user_id = task.created_by_user_id
  where task.attempt_no = 1
    and task.effective_snapshot ? 'legacyBackfill'
  on conflict (id) do nothing;

  -- Postconditions: every cardinality is exact, workspace-scoped, and free of
  -- draft-created artifacts. Any violation rolls the entire migration back.
  select count(*) into v_invalid_count
  from public.orders orders
  where orders.order_confirmation_status in ('draft','pending')
    and (
      exists (select 1 from public.order_tasks task
        where task.workspace_id = orders.workspace_id and task.order_id = orders.id)
      or exists (select 1 from public.order_billing_candidates candidate
        where candidate.workspace_id = orders.workspace_id and candidate.order_id = orders.id)
      or exists (select 1 from public.order_fulfillment_work_items queue
        where queue.workspace_id = orders.workspace_id and queue.order_id = orders.id
          and queue.task_id is not null)
    );
  if v_invalid_count > 0 then
    raise exception 'draft_created_execution_artifact:%', v_invalid_count
      using errcode = '23514';
  end if;

  select count(*) into v_invalid_count
  from public.orders orders
  where orders.order_confirmation_status in ('confirmed','billed')
    and orders.row_type in ('individual','set_child')
    and 1 <> (
      select count(*)
      from public.order_tasks task
      where task.workspace_id = orders.workspace_id
        and task.order_id = orders.id
        and task.attempt_no = 1
        and task.task_role = 'execution'
    );
  if v_invalid_count > 0 then
    raise exception 'confirmed_atomic_task_cardinality_invalid:%', v_invalid_count
      using errcode = '23514';
  end if;

  select count(*) into v_invalid_count
  from public.order_tasks task
  left join public.order_fulfillment_work_items queue
    on queue.workspace_id = task.workspace_id
   and queue.task_id = task.id
  where task.task_role = 'execution'
    and task.attempt_no = 1
    and (
      (task.destination_module is null and queue.id is not null)
      or (
        task.destination_module is not null
        and (
          queue.id is null
          or queue.destination_module is distinct from task.destination_module
          or queue.order_id is distinct from task.order_id
        )
      )
    );
  if v_invalid_count > 0 then
    raise exception 'execution_queue_reconciliation_invalid:%', v_invalid_count
      using errcode = '23514';
  end if;

  select count(*) into v_invalid_count
  from public.order_tasks task
  join public.orders orders
    on orders.workspace_id = task.workspace_id and orders.id = task.order_id
  left join public.order_billing_candidates candidate
    on candidate.workspace_id = task.workspace_id and candidate.order_id = task.order_id
  where task.task_role = 'execution'
    and task.attempt_no = 1
    and orders.order_confirmation_status in ('confirmed','billed')
    and orders.billing_eligible
    and orders.billing_reflection_enabled
    and orders.line_total_snapshot > 0
    and candidate.id is null;
  if v_invalid_count > 0 then
    raise exception 'billable_order_candidate_missing:%', v_invalid_count
      using errcode = '23514';
  end if;

  select count(*) into v_invalid_count
  from public.order_tasks task
  left join public.orders orders
    on orders.workspace_id = task.workspace_id and orders.id = task.order_id
  where orders.id is null
    or task.encounter_id is distinct from orders.encounter_id
    or task.clinical_order_type is distinct from orders.clinical_order_type
    or task.destination_module is distinct from orders.destination_module;
  if v_invalid_count > 0 then
    raise exception 'task_order_or_workspace_orphan:%', v_invalid_count
      using errcode = '23514';
  end if;

  select count(*) into v_invalid_count
  from public.order_tasks child_task
  join public.orders child_order
    on child_order.workspace_id = child_task.workspace_id
   and child_order.id = child_task.order_id
  left join public.order_tasks parent_task
    on parent_task.workspace_id = child_task.workspace_id
   and parent_task.id = child_task.parent_task_id
  where child_order.row_type = 'set_child'
    and (
      parent_task.id is null
      or parent_task.task_role <> 'aggregate'
      or parent_task.order_id is distinct from child_order.parent_chart_order_line_id
    );
  if v_invalid_count > 0 then
    raise exception 'set_child_aggregate_link_invalid:%', v_invalid_count
      using errcode = '23514';
  end if;

  return jsonb_build_object(
    'version', 1,
    'source', 'legacy-production-backfill',
    'commandsInserted', v_command_count,
    'executionTasksInserted', v_task_count,
    'queueRowsInsertedOrLinked', v_queue_count,
    'billingCandidatesInserted', v_billing_count,
    'taskEventsInserted', v_event_count,
    'completedAt', v_now
  );
end;
$function$;

revoke all on function private.clair_backfill_chart_order_execution()
  from public, anon, authenticated, service_role;

select private.clair_backfill_chart_order_execution();

comment on function private.clair_backfill_chart_order_execution() is
  'Idempotent admin-only repair for durable confirmed legacy Orders. Never infers clinical meaning from display names.';
