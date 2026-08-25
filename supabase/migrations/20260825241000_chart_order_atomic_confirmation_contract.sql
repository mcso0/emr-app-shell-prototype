-- Chart order execution Phase 4: one idempotent confirmation transaction for
-- immutable snapshots, universal Tasks, optional Queue projections, Billing
-- candidates, audit/history, durable outbox, and the remaining shared Draft.

set lock_timeout = '5s';
set statement_timeout = '120s';

create table if not exists public.order_confirmation_commands (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.workspaces(id) on delete cascade,
  encounter_id uuid not null,
  actor_user_id uuid not null references public.users(id) on delete restrict,
  idempotency_key text not null
    check (length(btrim(idempotency_key)) between 8 and 160),
  request_sha256 text not null
    check (request_sha256 ~ '^[0-9a-f]{64}$'),
  expected_draft_etag text not null
    check (expected_draft_etag ~ '^"[0-9a-f]{64}"$'),
  selected_root_order_ids uuid[] not null,
  status text not null default 'processing'
    check (status in ('processing','completed')),
  result jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (workspace_id, id),
  unique (workspace_id, idempotency_key),
  foreign key (workspace_id, encounter_id)
    references public.encounters(workspace_id, id) on delete restrict,
  check (cardinality(selected_root_order_ids) between 1 and 100),
  check (result is null or jsonb_typeof(result) = 'object'),
  check (
    (status = 'processing' and result is null and completed_at is null)
    or (status = 'completed' and result is not null and completed_at is not null)
  )
);

create index if not exists order_confirmation_commands_encounter_idx
  on public.order_confirmation_commands(
    workspace_id, encounter_id, created_at desc
  );

create table if not exists public.order_billing_candidates (
  id text primary key,
  workspace_id text not null references public.workspaces(id) on delete cascade,
  encounter_id uuid not null,
  order_id uuid not null,
  task_id uuid not null,
  task_attempt_no integer not null default 1 check (task_attempt_no > 0),
  status text not null default 'candidate_created'
    check (status in ('candidate_created','invoice_linked','cancelled')),
  billing_name_snapshot text not null
    check (length(btrim(billing_name_snapshot)) > 0),
  quantity numeric not null check (quantity > 0),
  unit_price numeric not null check (unit_price >= 0),
  amount numeric not null check (amount > 0),
  currency text not null default 'KRW' check (currency = 'KRW'),
  source_snapshot jsonb not null
    check (jsonb_typeof(source_snapshot) = 'object'),
  created_by_user_id uuid not null references public.users(id) on delete restrict,
  confirmation_command_id uuid not null,
  invoice_line_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, order_id),
  foreign key (workspace_id, encounter_id)
    references public.encounters(workspace_id, id) on delete restrict,
  foreign key (workspace_id, order_id)
    references public.orders(workspace_id, id) on delete restrict,
  foreign key (workspace_id, task_id, task_attempt_no)
    references public.order_tasks(workspace_id, id, attempt_no) on delete restrict,
  foreign key (workspace_id, confirmation_command_id)
    references public.order_confirmation_commands(workspace_id, id) on delete restrict,
  foreign key (invoice_line_id)
    references public.invoice_lines(id) on delete restrict,
  check (
    (status = 'invoice_linked' and invoice_line_id is not null)
    or (status <> 'invoice_linked' and invoice_line_id is null)
  )
);

create index if not exists order_billing_candidates_encounter_status_idx
  on public.order_billing_candidates(
    workspace_id, encounter_id, status, created_at
  );

create table if not exists public.order_execution_outbox (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.workspaces(id) on delete cascade,
  confirmation_command_id uuid not null,
  event_key text not null,
  event_type text not null check (event_type in ('order.confirmed')),
  aggregate_type text not null check (aggregate_type = 'order'),
  aggregate_id uuid not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  status text not null default 'pending'
    check (status in ('pending','processing','delivered','failed')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  available_at timestamptz not null default now(),
  delivered_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, event_key),
  foreign key (workspace_id, confirmation_command_id)
    references public.order_confirmation_commands(workspace_id, id) on delete restrict,
  foreign key (workspace_id, aggregate_id)
    references public.orders(workspace_id, id) on delete restrict
);

create index if not exists order_execution_outbox_delivery_idx
  on public.order_execution_outbox(status, available_at, created_at)
  where status in ('pending','failed');

alter table public.order_task_events
  add constraint order_task_events_confirmation_command_fkey
  foreign key (workspace_id, command_id)
  references public.order_confirmation_commands(workspace_id, id)
  on delete restrict not valid;

alter table public.order_task_events
  validate constraint order_task_events_confirmation_command_fkey;

alter table public.order_confirmation_commands enable row level security;
alter table public.order_billing_candidates enable row level security;
alter table public.order_execution_outbox enable row level security;

drop policy if exists order_billing_candidates_capability_select
  on public.order_billing_candidates;
create policy order_billing_candidates_capability_select
on public.order_billing_candidates
for select
to authenticated
using (
  private.clair_current_user_has_workspace_permission(
    workspace_id,
    'billing:view'
  )
);

revoke all on public.order_confirmation_commands
  from public, anon, authenticated, service_role;
revoke all on public.order_billing_candidates
  from public, anon, authenticated, service_role;
revoke all on public.order_execution_outbox
  from public, anon, authenticated, service_role;
grant select on public.order_billing_candidates to authenticated;

create or replace function public.clair_confirm_chart_order_candidates(
  p_workspace_id text,
  p_actor_user_id uuid,
  p_encounter_id uuid,
  p_selected_root_order_ids uuid[],
  p_expected_draft_etag text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions, pg_temp
as $function$
declare
  v_now timestamptz := now();
  v_selected_ids uuid[];
  v_selected_count integer;
  v_idempotency_key text := btrim(coalesce(p_idempotency_key, ''));
  v_request_sha256 text;
  v_existing public.order_confirmation_commands%rowtype;
  v_command public.order_confirmation_commands%rowtype;
  v_action_result jsonb;
  v_remaining_draft jsonb;
  v_result jsonb;
  v_actor_membership_id uuid;
  v_root public.orders%rowtype;
  v_task public.order_tasks%rowtype;
  v_aggregate_task public.order_tasks%rowtype;
  v_aggregate_status text;
begin
  if auth.uid() is null or p_actor_user_id is distinct from auth.uid() then
    raise exception 'actor_mismatch' using errcode = '42501';
  end if;
  if not private.clair_is_active_workspace_member(p_workspace_id)
    or not private.clair_current_user_has_workspace_permission(
      p_workspace_id,
      'chart:update'
    )
  then
    raise exception 'permission_missing' using errcode = '42501';
  end if;

  select array_agg(ids.id order by ids.id), count(*)
  into v_selected_ids, v_selected_count
  from (select distinct id from unnest(p_selected_root_order_ids) selected(id)) ids;
  if v_selected_count is null
    or v_selected_count < 1
    or v_selected_count > 100
    or v_selected_count is distinct from cardinality(p_selected_root_order_ids)
    or exists (select 1 from unnest(p_selected_root_order_ids) ids(id) where id is null)
    or p_expected_draft_etag is null
    or p_expected_draft_etag !~ '^"[0-9a-f]{64}"$'
    or length(v_idempotency_key) not between 8 and 160
  then
    raise exception 'invalid_confirmation_input';
  end if;

  v_request_sha256 := encode(
    extensions.digest(
      jsonb_build_object(
        'workspaceId', p_workspace_id,
        'encounterId', p_encounter_id,
        'actorUserId', p_actor_user_id,
        'selectedRootOrderIds', to_jsonb(v_selected_ids),
        'expectedDraftEtag', p_expected_draft_etag
      )::text,
      'sha256'
    ),
    'hex'
  );

  perform pg_advisory_xact_lock(
    hashtextextended(
      'chart_order_confirmation:' || p_workspace_id || ':' || v_idempotency_key,
      0
    )
  );

  select * into v_existing
  from public.order_confirmation_commands command
  where command.workspace_id = p_workspace_id
    and command.idempotency_key = v_idempotency_key
  for update;
  if found then
    if v_existing.request_sha256 is distinct from v_request_sha256
      or v_existing.encounter_id is distinct from p_encounter_id
      or v_existing.actor_user_id is distinct from p_actor_user_id
      or v_existing.selected_root_order_ids is distinct from v_selected_ids
      or v_existing.expected_draft_etag is distinct from p_expected_draft_etag
    then
      raise exception 'idempotency_conflict';
    end if;
    if v_existing.status = 'completed' and v_existing.result is not null then
      return v_existing.result;
    end if;
    raise exception 'confirmation_in_progress';
  end if;

  if not exists (
    select 1 from public.encounters encounter
    where encounter.workspace_id = p_workspace_id
      and encounter.id = p_encounter_id
      and encounter.status in ('in_consultation','ordered','ready_for_billing')
    for update
  ) then
    raise exception 'encounter_unavailable';
  end if;

  if p_expected_draft_etag is distinct from
    private.clair_b3_order_draft_etag(p_workspace_id, p_encounter_id)
  then
    raise exception 'revision_conflict';
  end if;

  if (
    select count(*)
    from public.orders orders
    where orders.workspace_id = p_workspace_id
      and orders.encounter_id = p_encounter_id
      and orders.id = any(v_selected_ids)
      and orders.row_type in ('individual','set')
      and orders.status <> 'cancelled'
      and orders.order_confirmation_status in ('draft','pending')
  ) is distinct from v_selected_count then
    raise exception 'order_unavailable';
  end if;

  if exists (
    select 1
    from public.orders atomic
    left join public.order_catalog_items catalog
      on catalog.workspace_id = atomic.workspace_id
     and catalog.id = atomic.workspace_catalog_item_id
    where atomic.workspace_id = p_workspace_id
      and atomic.encounter_id = p_encounter_id
      and atomic.status <> 'cancelled'
      and atomic.row_type in ('individual','set_child')
      and (
        atomic.id = any(v_selected_ids)
        or atomic.parent_chart_order_line_id = any(v_selected_ids)
      )
      and (
        catalog.id is null
        or catalog.availability_status <> 'active'
        or catalog.catalog_revision is distinct from atomic.workspace_catalog_revision
        or catalog.clinical_order_type is distinct from atomic.clinical_order_type
        or catalog.destination_module is distinct from atomic.destination_module
        or catalog.execution_mode is distinct from atomic.execution_mode
        or catalog.detail_schema_version is distinct from atomic.detail_schema_version
        or catalog.billing_eligible is distinct from atomic.billing_eligible
      )
  ) then
    raise exception 'master_revision_requires_refresh';
  end if;

  if exists (
    select 1
    from public.orders atomic
    where atomic.workspace_id = p_workspace_id
      and atomic.encounter_id = p_encounter_id
      and atomic.status <> 'cancelled'
      and atomic.row_type in ('individual','set_child')
      and (
        atomic.id = any(v_selected_ids)
        or atomic.parent_chart_order_line_id = any(v_selected_ids)
      )
      and not private.clair_order_detail_inputs_are_valid(
        atomic.clinical_order_type,
        atomic.detail_schema_version,
        atomic.detail_inputs,
        true
      )
  ) then
    raise exception 'confirmation_detail_inputs_incomplete';
  end if;

  insert into public.order_confirmation_commands(
    workspace_id,
    encounter_id,
    actor_user_id,
    idempotency_key,
    request_sha256,
    expected_draft_etag,
    selected_root_order_ids
  ) values (
    p_workspace_id,
    p_encounter_id,
    p_actor_user_id,
    v_idempotency_key,
    v_request_sha256,
    p_expected_draft_etag,
    v_selected_ids
  ) returning * into v_command;

  -- The proven B3 boundary retains set expansion/current-master validation and
  -- canonical lab result freezing. This call, every write below, and the
  -- command result share this function's transaction and roll back together.
  v_action_result := public.clair_save_chart_order_action(
    p_workspace_id,
    p_actor_user_id,
    p_encounter_id,
    'confirm',
    v_selected_ids,
    p_expected_draft_etag
  );

  update public.orders orders
  set
    revision_no = greatest(orders.revision_no, 0) + 1,
    confirmed_snapshot = orders.applied_snapshot || jsonb_build_object(
      'snapshotSchemaVersion', 1,
      'orderId', orders.id,
      'workspaceId', orders.workspace_id,
      'encounterId', orders.encounter_id,
      'rowType', orders.row_type,
      'parentOrderId', orders.parent_chart_order_line_id,
      'clinicalOrderType', orders.clinical_order_type,
      'destinationModule', orders.destination_module,
      'executionMode', orders.execution_mode,
      'detailInputs', orders.detail_inputs,
      'detailSchemaVersion', orders.detail_schema_version,
      'priority', case when orders.priority = 'urgent' then 'urgent' else 'normal' end,
      'billingEligible', orders.billing_eligible,
      'quantity', orders.quantity,
      'unitPriceSnapshot', orders.unit_price_snapshot,
      'lineTotalSnapshot', orders.line_total_snapshot,
      'workspaceCatalogItemId', orders.workspace_catalog_item_id,
      'workspaceCatalogRevision', orders.workspace_catalog_revision,
      'sourceMasterRecordId', orders.source_master_record_id,
      'sourceMasterRevision', orders.source_master_revision,
      'revisionNo', greatest(orders.revision_no, 0) + 1,
      'confirmedAt', orders.confirmed_at,
      'confirmedByUserId', p_actor_user_id,
      'confirmationCommandId', v_command.id
    ),
    updated_at = v_now
  where orders.workspace_id = p_workspace_id
    and orders.encounter_id = p_encounter_id
    and orders.status <> 'cancelled'
    and (
      orders.id = any(v_selected_ids)
      or orders.parent_chart_order_line_id = any(v_selected_ids)
    );

  for v_root in
    select orders.*
    from public.orders orders
    where orders.workspace_id = p_workspace_id
      and orders.encounter_id = p_encounter_id
      and orders.id = any(v_selected_ids)
    order by orders.id
    for update
  loop
    if v_root.row_type = 'set' then
      insert into public.order_tasks(
        workspace_id, encounter_id, order_id, task_role,
        clinical_order_type, destination_module, status, priority,
        attempt_no, effective_snapshot, created_by_user_id
      ) values (
        p_workspace_id, p_encounter_id, v_root.id, 'aggregate',
        v_root.clinical_order_type, null, 'pending',
        case when v_root.priority = 'urgent' then 'urgent' else 'normal' end,
        1, v_root.confirmed_snapshot, p_actor_user_id
      ) returning * into v_aggregate_task;

      insert into public.order_tasks(
        workspace_id, encounter_id, order_id, parent_task_id, task_role,
        clinical_order_type, destination_module, status, priority,
        attempt_no, effective_snapshot, created_by_user_id, completed_at
      )
      select
        child.workspace_id,
        child.encounter_id,
        child.id,
        v_aggregate_task.id,
        'execution',
        child.clinical_order_type,
        child.destination_module,
        case when child.destination_module is null then 'complete' else 'pending' end,
        case when child.priority = 'urgent' then 'urgent' else 'normal' end,
        1,
        child.confirmed_snapshot,
        p_actor_user_id,
        case when child.destination_module is null then v_now else null end
      from public.orders child
      where child.workspace_id = p_workspace_id
        and child.encounter_id = p_encounter_id
        and child.parent_chart_order_line_id = v_root.id
        and child.row_type = 'set_child'
        and child.status <> 'cancelled'
      order by child.id;

      v_aggregate_status := private.clair_calculate_aggregate_task_status(
        p_workspace_id,
        v_aggregate_task.id
      );
      update public.order_tasks task
      set
        status = v_aggregate_status,
        completed_at = case when v_aggregate_status = 'complete' then v_now else null end,
        cancelled_at = case when v_aggregate_status = 'cancelled' then v_now else null end,
        updated_at = v_now
      where task.workspace_id = p_workspace_id
        and task.id = v_aggregate_task.id
      returning * into v_aggregate_task;
    else
      insert into public.order_tasks(
        workspace_id, encounter_id, order_id, task_role,
        clinical_order_type, destination_module, status, priority,
        attempt_no, effective_snapshot, created_by_user_id, completed_at
      ) values (
        p_workspace_id,
        p_encounter_id,
        v_root.id,
        'execution',
        v_root.clinical_order_type,
        v_root.destination_module,
        case when v_root.destination_module is null then 'complete' else 'pending' end,
        case when v_root.priority = 'urgent' then 'urgent' else 'normal' end,
        1,
        v_root.confirmed_snapshot,
        p_actor_user_id,
        case when v_root.destination_module is null then v_now else null end
      ) returning * into v_task;
    end if;
  end loop;

  insert into public.order_task_events(
    workspace_id, task_id, task_attempt_no, order_id,
    event_type, actor_user_id, before_values, after_values,
    command_id, created_at
  )
  select
    task.workspace_id,
    task.id,
    task.attempt_no,
    task.order_id,
    'created',
    p_actor_user_id,
    '{}'::jsonb,
    jsonb_build_object(
      'status', task.status,
      'taskRole', task.task_role,
      'priority', task.priority,
      'destinationModule', task.destination_module
    ),
    v_command.id,
    v_now
  from public.order_tasks task
  where task.workspace_id = p_workspace_id
    and task.encounter_id = p_encounter_id
    and task.attempt_no = 1
    and (
      task.order_id = any(v_selected_ids)
      or exists (
        select 1 from public.orders child
        where child.workspace_id = p_workspace_id
          and child.id = task.order_id
          and child.parent_chart_order_line_id = any(v_selected_ids)
      )
    )
  order by task.id;

  insert into public.order_fulfillment_work_items(
    workspace_id, encounter_id, order_id, order_type, queue_type,
    status, priority, requested_by_user_id, source_snapshot,
    task_id, task_attempt_no, clinical_order_type, destination_module,
    created_at, updated_at
  )
  select
    task.workspace_id,
    task.encounter_id,
    task.order_id,
    orders.order_type,
    task.destination_module,
    'requested',
    task.priority,
    p_actor_user_id,
    task.effective_snapshot,
    task.id,
    task.attempt_no,
    task.clinical_order_type,
    task.destination_module,
    v_now,
    v_now
  from public.order_tasks task
  join public.orders orders
    on orders.workspace_id = task.workspace_id
   and orders.id = task.order_id
  where task.workspace_id = p_workspace_id
    and task.encounter_id = p_encounter_id
    and task.task_role = 'execution'
    and task.destination_module is not null
    and task.attempt_no = 1
    and (
      task.order_id = any(v_selected_ids)
      or orders.parent_chart_order_line_id = any(v_selected_ids)
    )
  on conflict (workspace_id, order_id) do update
  set
    task_id = excluded.task_id,
    task_attempt_no = excluded.task_attempt_no,
    clinical_order_type = excluded.clinical_order_type,
    destination_module = excluded.destination_module,
    queue_type = excluded.queue_type,
    priority = excluded.priority,
    source_snapshot = excluded.source_snapshot,
    updated_at = excluded.updated_at;

  insert into public.order_billing_candidates(
    id, workspace_id, encounter_id, order_id, task_id, task_attempt_no,
    billing_name_snapshot, quantity, unit_price, amount, source_snapshot,
    created_by_user_id, confirmation_command_id, created_at, updated_at
  )
  select
    'billcand-' || orders.id::text,
    orders.workspace_id,
    orders.encounter_id,
    orders.id,
    task.id,
    task.attempt_no,
    coalesce(
      nullif(orders.applied_snapshot ->> 'billingName', ''),
      nullif(orders.applied_snapshot ->> 'inHospitalOrderName', ''),
      'Order ' || orders.id::text
    ),
    orders.quantity,
    coalesce(orders.unit_price_snapshot, 0),
    orders.line_total_snapshot,
    orders.confirmed_snapshot,
    p_actor_user_id,
    v_command.id,
    v_now,
    v_now
  from public.orders orders
  join public.order_tasks task
    on task.workspace_id = orders.workspace_id
   and task.order_id = orders.id
   and task.attempt_no = 1
   and task.task_role = 'execution'
  where orders.workspace_id = p_workspace_id
    and orders.encounter_id = p_encounter_id
    and orders.row_type in ('individual','set_child')
    and orders.status <> 'cancelled'
    and orders.billing_eligible
    and orders.billing_reflection_enabled
    and orders.line_total_snapshot > 0
    and (
      orders.id = any(v_selected_ids)
      or orders.parent_chart_order_line_id = any(v_selected_ids)
    );

  update public.orders orders
  set
    billing_candidate_status = 'candidate_created',
    billing_candidate_id = candidate.id,
    updated_at = v_now
  from public.order_billing_candidates candidate
  where candidate.workspace_id = orders.workspace_id
    and candidate.order_id = orders.id
    and candidate.confirmation_command_id = v_command.id;

  select membership.id into v_actor_membership_id
  from public.user_memberships membership
  where membership.workspace_id = p_workspace_id
    and membership.user_id = p_actor_user_id
    and membership.status = 'active'
  order by membership.created_at
  limit 1;

  insert into public.audit_events(
    id, workspace_id, actor_user_id, actor_membership_id,
    event_type, target_type, target_id, encounter_id, request_id,
    before_snapshot, after_snapshot, metadata, occurred_at, created_at
  )
  select
    'chart-confirm-' || v_command.id::text || '-' || orders.id::text,
    orders.workspace_id,
    p_actor_user_id,
    v_actor_membership_id,
    'order.confirmed',
    'order',
    orders.id::text,
    orders.encounter_id,
    v_command.id::text,
    jsonb_build_object('orderConfirmationStatus', 'draft'),
    orders.confirmed_snapshot,
    jsonb_build_object(
      'source', 'chart-order-atomic-confirmation-v1',
      'idempotencyKey', v_idempotency_key,
      'rootOrderId', coalesce(orders.parent_chart_order_line_id, orders.id)
    ),
    v_now,
    v_now
  from public.orders orders
  where orders.workspace_id = p_workspace_id
    and orders.encounter_id = p_encounter_id
    and orders.status <> 'cancelled'
    and (
      orders.id = any(v_selected_ids)
      or orders.parent_chart_order_line_id = any(v_selected_ids)
    );

  insert into public.audit_events(
    id, workspace_id, actor_user_id, actor_membership_id,
    event_type, target_type, target_id, encounter_id, request_id,
    before_snapshot, after_snapshot, metadata, occurred_at, created_at
  )
  select
    'billing-candidate-' || v_command.id::text || '-' || candidate.order_id::text,
    candidate.workspace_id,
    p_actor_user_id,
    v_actor_membership_id,
    'order.billing_candidate_requested',
    'order_billing_candidate',
    candidate.id,
    candidate.encounter_id,
    v_command.id::text,
    '{}'::jsonb,
    candidate.source_snapshot || jsonb_build_object(
      'billingCandidateId', candidate.id,
      'amount', candidate.amount,
      'status', candidate.status
    ),
    jsonb_build_object('source', 'chart-order-atomic-confirmation-v1'),
    v_now,
    v_now
  from public.order_billing_candidates candidate
  where candidate.workspace_id = p_workspace_id
    and candidate.confirmation_command_id = v_command.id;

  insert into public.order_execution_outbox(
    workspace_id, confirmation_command_id, event_key, event_type,
    aggregate_type, aggregate_id, payload, created_at, updated_at
  )
  select
    p_workspace_id,
    v_command.id,
    'order.confirmed:' || v_command.id::text || ':' || root.id::text,
    'order.confirmed',
    'order',
    root.id,
    jsonb_build_object(
      'workspaceId', p_workspace_id,
      'encounterId', p_encounter_id,
      'rootOrderId', root.id,
      'confirmationCommandId', v_command.id
    ),
    v_now,
    v_now
  from public.orders root
  where root.workspace_id = p_workspace_id
    and root.encounter_id = p_encounter_id
    and root.id = any(v_selected_ids);

  v_remaining_draft := public.clair_get_chart_order_draft(
    p_workspace_id,
    p_encounter_id
  );

  select jsonb_build_object(
    'commandId', v_command.id,
    'idempotencyKey', v_idempotency_key,
    'workspaceId', p_workspace_id,
    'encounterId', p_encounter_id,
    'selectedRootOrderIds', to_jsonb(v_selected_ids),
    'etag', v_remaining_draft -> 'etag',
    'remainingDraft', v_remaining_draft,
    'confirmedRows', coalesce(v_action_result -> 'rows', '[]'::jsonb),
    'tasks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'taskId', task.id,
        'orderId', task.order_id,
        'parentTaskId', task.parent_task_id,
        'taskRole', task.task_role,
        'clinicalOrderType', task.clinical_order_type,
        'destinationModule', task.destination_module,
        'status', task.status,
        'priority', task.priority,
        'attemptNo', task.attempt_no
      ) order by task.task_role, task.order_id)
      from public.order_tasks task
      where task.workspace_id = p_workspace_id
        and task.encounter_id = p_encounter_id
        and task.attempt_no = 1
        and (
          task.order_id = any(v_selected_ids)
          or exists (
            select 1 from public.orders child
            where child.workspace_id = p_workspace_id
              and child.id = task.order_id
              and child.parent_chart_order_line_id = any(v_selected_ids)
          )
        )
    ), '[]'::jsonb),
    'queueProjectionIds', coalesce((
      select jsonb_agg(to_jsonb(item.id) order by item.id)
      from public.order_fulfillment_work_items item
      where item.workspace_id = p_workspace_id
        and item.encounter_id = p_encounter_id
        and item.task_id in (
          select task.id from public.order_tasks task
          where task.workspace_id = p_workspace_id
            and task.encounter_id = p_encounter_id
            and task.attempt_no = 1
            and (
              task.order_id = any(v_selected_ids)
              or exists (
                select 1 from public.orders child
                where child.workspace_id = p_workspace_id
                  and child.id = task.order_id
                  and child.parent_chart_order_line_id = any(v_selected_ids)
              )
            )
        )
    ), '[]'::jsonb),
    'billingCandidates', coalesce((
      select jsonb_agg(jsonb_build_object(
        'billingCandidateId', candidate.id,
        'orderId', candidate.order_id,
        'taskId', candidate.task_id,
        'status', candidate.status,
        'billingName', candidate.billing_name_snapshot,
        'quantity', candidate.quantity,
        'unitPrice', candidate.unit_price,
        'amount', candidate.amount,
        'currency', candidate.currency,
        'createdAt', candidate.created_at
      ) order by candidate.order_id)
      from public.order_billing_candidates candidate
      where candidate.workspace_id = p_workspace_id
        and candidate.confirmation_command_id = v_command.id
    ), '[]'::jsonb)
  ) into v_result;

  update public.order_confirmation_commands command
  set
    status = 'completed',
    result = v_result,
    completed_at = v_now
  where command.workspace_id = p_workspace_id
    and command.id = v_command.id;

  return v_result;
end;
$function$;

revoke all on function public.clair_confirm_chart_order_candidates(
  text, uuid, uuid, uuid[], text, text
) from public, anon, service_role;
grant execute on function public.clair_confirm_chart_order_candidates(
  text, uuid, uuid, uuid[], text, text
) to authenticated;

comment on function public.clair_confirm_chart_order_candidates(
  text, uuid, uuid, uuid[], text, text
) is
  'Atomic selected-root confirmation with immutable snapshots, universal Tasks, routed Queue projections, Billing candidates, audit/outbox, remaining Draft ETag, and deterministic idempotent replay.';
