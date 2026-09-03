-- Plan/Order legacy-column delivery: make assignment, work start, phase,
-- pause/resume, handoff, return, and completion separate persisted facts.
-- This migration also closes the DB permission boundary on chart/billing reads
-- that were previously protected only by the application route.

set lock_timeout = '5s';
set statement_timeout = '120s';

alter table public.order_tasks
  add column if not exists assigned_to_user_id uuid references public.users(id) on delete set null,
  add column if not exists assigned_by_user_id uuid references public.users(id) on delete set null,
  add column if not exists assigned_at timestamptz,
  add column if not exists started_by_user_id uuid references public.users(id) on delete set null,
  add column if not exists returned_at timestamptz,
  add column if not exists detailed_phase text,
  add column if not exists paused_from_phase text,
  add column if not exists request_cycle integer not null default 1,
  add column if not exists row_revision bigint not null default 1;

alter table public.order_fulfillment_work_items
  add column if not exists assigned_by_user_id uuid references public.users(id) on delete set null,
  add column if not exists assigned_at timestamptz,
  add column if not exists started_by_user_id uuid references public.users(id) on delete set null,
  add column if not exists started_at timestamptz,
  add column if not exists detailed_phase text,
  add column if not exists paused_from_phase text,
  add column if not exists request_cycle integer not null default 1,
  add column if not exists row_revision bigint not null default 1;

-- `command_id` belongs to the immutable confirmation command FK. Lifecycle
-- transitions need their own idempotency namespace so they cannot masquerade
-- as confirmation commands or violate that FK.
alter table public.order_task_events
  add column if not exists lifecycle_command_id uuid;

alter table public.order_tasks
  drop constraint if exists order_tasks_status_check,
  add constraint order_tasks_status_v3_check
    check (status in (
      'pending','in_progress','paused','partial_complete','complete','returned','cancelled'
    )) not valid,
  add constraint order_tasks_assignment_shape_check
    check (
      (assigned_to_user_id is null and assigned_by_user_id is null and assigned_at is null)
      or (assigned_to_user_id is not null and assigned_by_user_id is not null and assigned_at is not null)
    ) not valid,
  add constraint order_tasks_start_shape_check
    check (
      (started_at is null and started_by_user_id is null)
      or (started_at is not null and started_by_user_id is not null)
    ) not valid,
  add constraint order_tasks_started_status_check
    check (
      status not in ('in_progress','paused','partial_complete','complete')
      or started_at is not null
    ) not valid,
  add constraint order_tasks_request_cycle_check
    check (request_cycle > 0 and request_cycle = attempt_no) not valid,
  add constraint order_tasks_row_revision_check
    check (row_revision > 0) not valid,
  add constraint order_tasks_returned_at_check
    check (status <> 'returned' or returned_at is not null) not valid;

alter table public.order_fulfillment_work_items
  drop constraint if exists order_fulfillment_work_items_status_check,
  add constraint order_fulfillment_work_items_status_v3_check
    check (status in (
      'requested','in_progress','paused','completed','returned','cancelled'
    )) not valid,
  add constraint order_fulfillment_work_items_assignment_shape_check
    check (
      (assigned_to_user_id is null and assigned_by_user_id is null and assigned_at is null)
      or (assigned_to_user_id is not null and assigned_by_user_id is not null and assigned_at is not null)
    ) not valid,
  add constraint order_fulfillment_work_items_start_shape_check
    check (
      (started_at is null and started_by_user_id is null)
      or (started_at is not null and started_by_user_id is not null)
    ) not valid,
  add constraint order_fulfillment_work_items_request_cycle_check
    check (request_cycle > 0 and request_cycle = coalesce(task_attempt_no, 1)) not valid,
  add constraint order_fulfillment_work_items_row_revision_check
    check (row_revision > 0) not valid;

-- Preserve the original identity/history guard while making `returned` a
-- terminal attempt that can be followed only by a linked re-request attempt.
create or replace function private.clair_assert_order_task_identity_and_history()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_parent public.order_tasks%rowtype;
  v_previous public.order_tasks%rowtype;
  v_order public.orders%rowtype;
begin
  if tg_op = 'UPDATE' then
    if new.workspace_id is distinct from old.workspace_id
      or new.encounter_id is distinct from old.encounter_id
      or new.order_id is distinct from old.order_id
      or new.task_role is distinct from old.task_role
      or new.clinical_order_type is distinct from old.clinical_order_type
      or new.attempt_no is distinct from old.attempt_no
      or new.parent_task_id is distinct from old.parent_task_id
      or new.re_requested_from_task_id is distinct from old.re_requested_from_task_id
    then
      raise exception 'task_identity_immutable' using errcode = '55000';
    end if;

    if old.result_snapshot is not null
      and new.result_snapshot is distinct from old.result_snapshot
    then
      raise exception 'completed_result_immutable' using errcode = '55000';
    end if;

    if old.status in ('complete','returned','cancelled')
      and (
        new.status is distinct from old.status
        or new.effective_snapshot is distinct from old.effective_snapshot
        or new.priority is distinct from old.priority
        or new.destination_module is distinct from old.destination_module
      )
    then
      raise exception 'terminal_task_immutable' using errcode = '55000';
    end if;
  end if;

  select * into v_order
  from public.orders orders
  where orders.workspace_id = new.workspace_id
    and orders.id = new.order_id;
  if not found
    or v_order.encounter_id is distinct from new.encounter_id
    or v_order.clinical_order_type is distinct from new.clinical_order_type
    or v_order.destination_module is distinct from new.destination_module
    or v_order.order_confirmation_status not in ('confirmed','billed')
    or (new.task_role = 'aggregate' and v_order.row_type <> 'set')
    or (new.task_role = 'execution' and v_order.row_type = 'set')
  then
    raise exception 'task_order_contract_mismatch' using errcode = '23514';
  end if;

  if new.parent_task_id is not null then
    select * into v_parent
    from public.order_tasks task
    where task.workspace_id = new.workspace_id
      and task.id = new.parent_task_id;
    if not found
      or v_parent.task_role <> 'aggregate'
      or v_parent.encounter_id is distinct from new.encounter_id
      or v_parent.attempt_no is distinct from new.attempt_no
      or v_order.row_type <> 'set_child'
      or v_order.parent_chart_order_line_id is distinct from v_parent.order_id
    then
      raise exception 'aggregate_parent_invalid' using errcode = '23514';
    end if;
  elsif v_order.row_type = 'set_child' then
    raise exception 'aggregate_parent_required' using errcode = '23514';
  end if;

  if new.re_requested_from_task_id is not null then
    select * into v_previous
    from public.order_tasks task
    where task.workspace_id = new.workspace_id
      and task.id = new.re_requested_from_task_id;
    if not found
      or v_previous.order_id is distinct from new.order_id
      or v_previous.encounter_id is distinct from new.encounter_id
      or v_previous.task_role is distinct from new.task_role
      or v_previous.attempt_no + 1 <> new.attempt_no
      or v_previous.status not in ('complete','returned','cancelled')
      or new.status <> 'pending'
    then
      raise exception 're_request_link_invalid' using errcode = '23514';
    end if;
  elsif new.attempt_no <> 1 then
    raise exception 're_request_link_required' using errcode = '23514';
  end if;

  return new;
end;
$function$;

-- The old `accepted` state sometimes meant assignment and sometimes meant
-- started work. Only authoritative start evidence may promote it.
create temporary table clair_legacy_accepted_migration on commit drop as
select
  item.workspace_id,
  item.id as work_item_id,
  item.order_id,
  item.task_id,
  item.task_attempt_no,
  item.status as previous_status,
  case when task.started_at is not null or exists (
    select 1
    from public.order_task_events event
    where event.workspace_id = item.workspace_id
      and event.task_id = item.task_id
      and event.task_attempt_no = item.task_attempt_no
      and event.event_type = 'started'
  ) then 'in_progress' else 'requested' end as next_status,
  coalesce(
    (select event.actor_user_id
     from public.order_task_events event
     where event.workspace_id = item.workspace_id
       and event.task_id = item.task_id
       and event.task_attempt_no = item.task_attempt_no
       and event.event_type = 'started'
     order by event.created_at, event.id
     limit 1),
    task.created_by_user_id,
    item.requested_by_user_id
  ) as actor_user_id,
  item.updated_at as migrated_at
from public.order_fulfillment_work_items item
join public.order_tasks task
  on task.workspace_id = item.workspace_id
 and task.id = item.task_id
 and task.attempt_no = item.task_attempt_no
where item.status = 'accepted';

with accepted_projection as (
  select
    item.workspace_id,
    item.id,
    case when task.started_at is not null or exists (
      select 1
      from public.order_task_events event
      where event.workspace_id = item.workspace_id
        and event.task_id = item.task_id
        and event.task_attempt_no = item.task_attempt_no
        and event.event_type = 'started'
    ) then 'in_progress' else 'requested' end as next_status,
    coalesce(task.started_at, item.updated_at) as inferred_started_at,
    coalesce(
      (select event.actor_user_id
       from public.order_task_events event
       where event.workspace_id = item.workspace_id
         and event.task_id = item.task_id
         and event.task_attempt_no = item.task_attempt_no
         and event.event_type = 'started'
       order by event.created_at, event.id
       limit 1),
      task.created_by_user_id,
      item.requested_by_user_id
    ) as inferred_started_by
  from public.order_fulfillment_work_items item
  left join public.order_tasks task
    on task.workspace_id = item.workspace_id
   and task.id = item.task_id
   and task.attempt_no = item.task_attempt_no
  where item.status = 'accepted'
)
update public.order_fulfillment_work_items item
set
  status = accepted_projection.next_status,
  started_at = case when accepted_projection.next_status = 'in_progress'
    then accepted_projection.inferred_started_at else item.started_at end,
  started_by_user_id = case when accepted_projection.next_status = 'in_progress'
    then accepted_projection.inferred_started_by else item.started_by_user_id end,
  assigned_by_user_id = case when item.assigned_to_user_id is not null
    then coalesce(item.assigned_by_user_id, item.requested_by_user_id) else null end,
  assigned_at = case when item.assigned_to_user_id is not null
    then coalesce(item.assigned_at, item.created_at) else null end,
  updated_at = greatest(item.updated_at, now())
from accepted_projection
where item.workspace_id = accepted_projection.workspace_id
  and item.id = accepted_projection.id;

-- Existing queue rows already carried the intended assignee but predated the
-- assignment provenance columns. Complete that shape before copying it to the
-- authoritative Task attempt so the new constraint is never observed halfway.
update public.order_fulfillment_work_items item
set
  assigned_by_user_id = case when item.assigned_to_user_id is not null
    then coalesce(item.assigned_by_user_id, item.requested_by_user_id) else null end,
  assigned_at = case when item.assigned_to_user_id is not null
    then coalesce(item.assigned_at, item.created_at) else null end
where (
  item.assigned_to_user_id is not null
  and (item.assigned_by_user_id is null or item.assigned_at is null)
) or (
  item.assigned_to_user_id is null
  and (item.assigned_by_user_id is not null or item.assigned_at is not null)
);

update public.order_tasks task
set
  assigned_to_user_id = item.assigned_to_user_id,
  assigned_by_user_id = item.assigned_by_user_id,
  assigned_at = item.assigned_at,
  -- Historical completed rows were allowed to omit start metadata. Prefer an
  -- existing start fact, then the terminal/state timestamps already preserved
  -- on the same attempt. Never infer an actor from a display name.
  started_at = case when item.status in ('in_progress','paused','completed')
    then coalesce(
      task.started_at,
      item.started_at,
      task.completed_at,
      item.completed_at,
      task.updated_at,
      item.updated_at,
      task.created_at,
      item.created_at
    )
    else coalesce(task.started_at, item.started_at)
  end,
  started_by_user_id = case when item.status in ('in_progress','paused','completed')
    then coalesce(
      task.started_by_user_id,
      item.started_by_user_id,
      task.created_by_user_id,
      item.requested_by_user_id
    )
    when coalesce(task.started_at, item.started_at) is not null
      then coalesce(task.started_by_user_id, item.started_by_user_id, task.created_by_user_id)
    else null
  end,
  status = case item.status
    when 'requested' then 'pending'
    when 'completed' then 'complete'
    else item.status
  end,
  returned_at = case when item.status = 'returned'
    then coalesce(task.returned_at, item.returned_at) else task.returned_at end,
  request_cycle = task.attempt_no,
  row_revision = greatest(task.row_revision, item.row_revision),
  updated_at = greatest(task.updated_at, item.updated_at)
from public.order_fulfillment_work_items item
where item.workspace_id = task.workspace_id
  and item.task_id = task.id
  and item.task_attempt_no = task.attempt_no;

-- Aggregate tasks and any other legacy attempt without a queue projection need
-- the same deterministic compatibility repair before the new checks validate.
-- A real start event wins; otherwise the existing completion/state timestamp is
-- the narrowest available fact and the task creator remains the actor fallback.
update public.order_tasks task
set
  started_at = coalesce(
    task.started_at,
    (
      select event.created_at
      from public.order_task_events event
      where event.workspace_id = task.workspace_id
        and event.task_id = task.id
        and event.task_attempt_no = task.attempt_no
        and event.event_type = 'started'
      order by event.created_at, event.id
      limit 1
    ),
    task.completed_at,
    task.updated_at,
    task.created_at
  ),
  started_by_user_id = coalesce(
    task.started_by_user_id,
    (
      select event.actor_user_id
      from public.order_task_events event
      where event.workspace_id = task.workspace_id
        and event.task_id = task.id
        and event.task_attempt_no = task.attempt_no
        and event.event_type = 'started'
      order by event.created_at, event.id
      limit 1
    ),
    task.created_by_user_id
  )
where task.status in ('in_progress','paused','partial_complete','complete')
  and (task.started_at is null or task.started_by_user_id is null);

update public.order_tasks task
set
  started_by_user_id = case when task.started_at is not null
    then coalesce(task.started_by_user_id, task.created_by_user_id) else null end,
  request_cycle = task.attempt_no
where (task.started_at is not null and task.started_by_user_id is null)
   or task.request_cycle is distinct from task.attempt_no;

with lifecycle_projection as (
  select
    item.workspace_id,
    item.id,
    case when item.assigned_to_user_id is not null
      then coalesce(item.assigned_by_user_id, item.requested_by_user_id) else null end
      as assigned_by_user_id,
    case when item.assigned_to_user_id is not null
      then coalesce(item.assigned_at, item.created_at) else null end
      as assigned_at,
    case when item.status in ('in_progress','paused','completed')
      then coalesce(item.started_at, task.started_at, item.updated_at) else item.started_at end
      as started_at,
    case when item.status in ('in_progress','paused','completed')
      then coalesce(
        item.started_by_user_id,
        task.started_by_user_id,
        task.created_by_user_id,
        item.requested_by_user_id
      )
      else item.started_by_user_id end as started_by_user_id,
    coalesce(item.task_attempt_no, 1) as request_cycle
  from public.order_fulfillment_work_items item
  join public.order_tasks task
    on task.workspace_id = item.workspace_id
   and task.id = item.task_id
   and task.attempt_no = item.task_attempt_no
)
update public.order_fulfillment_work_items item
set
  assigned_by_user_id = projection.assigned_by_user_id,
  assigned_at = projection.assigned_at,
  started_at = projection.started_at,
  started_by_user_id = projection.started_by_user_id,
  request_cycle = projection.request_cycle,
  updated_at = greatest(item.updated_at, now())
from lifecycle_projection projection
where item.workspace_id = projection.workspace_id
  and item.id = projection.id
  and row(
    item.assigned_by_user_id,
    item.assigned_at,
    item.started_at,
    item.started_by_user_id,
    item.request_cycle
  ) is distinct from row(
    projection.assigned_by_user_id,
    projection.assigned_at,
    projection.started_at,
    projection.started_by_user_id,
    projection.request_cycle
  );

alter table public.order_task_events
  drop constraint if exists order_task_events_event_type_check,
  drop constraint if exists order_task_events_check,
  add constraint order_task_events_event_type_v3_check
    check (event_type in (
      'created','assigned','started','phase_changed','paused','resumed',
      'handed_off','completed','returned','cancelled','amended','re_requested',
      'priority_changed','legacy_accepted_migrated'
    )) not valid,
  add constraint order_task_events_reason_v3_check
    check (
      event_type not in ('cancelled','returned','amended','re_requested','priority_changed','handed_off')
      or length(btrim(coalesce(reason, ''))) > 0
    ) not valid;

insert into public.order_task_events (
  workspace_id, task_id, task_attempt_no, order_id, event_type,
  actor_user_id, reason, before_values, after_values, created_at
)
select
  legacy.workspace_id,
  legacy.task_id,
  legacy.task_attempt_no,
  legacy.order_id,
  'legacy_accepted_migrated',
  legacy.actor_user_id,
  'accepted 상태를 시작 증거 기준으로 이관',
  jsonb_build_object(
    'workItemId', legacy.work_item_id,
    'status', legacy.previous_status
  ),
  jsonb_build_object(
    'workItemId', legacy.work_item_id,
    'status', legacy.next_status,
    'migrationRule', case when legacy.next_status = 'in_progress'
      then 'authoritative_start_evidence' else 'assignment_only' end
  ),
  greatest(legacy.migrated_at, now())
from clair_legacy_accepted_migration legacy;

create unique index if not exists order_task_events_lifecycle_command_unique
  on public.order_task_events(workspace_id, lifecycle_command_id)
  where lifecycle_command_id is not null;

alter table public.order_tasks
  validate constraint order_tasks_status_v3_check,
  validate constraint order_tasks_assignment_shape_check,
  validate constraint order_tasks_start_shape_check,
  validate constraint order_tasks_started_status_check,
  validate constraint order_tasks_request_cycle_check,
  validate constraint order_tasks_row_revision_check,
  validate constraint order_tasks_returned_at_check;

alter table public.order_fulfillment_work_items
  validate constraint order_fulfillment_work_items_status_v3_check,
  validate constraint order_fulfillment_work_items_assignment_shape_check,
  validate constraint order_fulfillment_work_items_start_shape_check,
  validate constraint order_fulfillment_work_items_request_cycle_check,
  validate constraint order_fulfillment_work_items_row_revision_check;

alter table public.order_task_events
  validate constraint order_task_events_event_type_v3_check,
  validate constraint order_task_events_reason_v3_check;

alter table public.order_billing_candidates
  add column if not exists price_basis_snapshot text,
  add column if not exists billing_unit_snapshot text,
  add column if not exists tax_class_snapshot text,
  add column if not exists set_billing_owner_snapshot text,
  add column if not exists set_amount_strategy_snapshot text,
  add column if not exists billing_snapshot jsonb,
  add column if not exists billing_snapshot_sha256 text,
  add column if not exists billing_cycle integer not null default 1,
  drop constraint if exists order_billing_candidates_status_check,
  drop constraint if exists order_billing_candidates_amount_check,
  add constraint order_billing_candidates_status_v3_check
    check (status in (
      'candidate_created','billing_review_required','invoice_linked','cancelled'
    )) not valid,
  add constraint order_billing_candidates_amount_v3_check
    check (amount >= 0) not valid,
  add constraint order_billing_candidates_price_basis_check
    check (price_basis_snapshot is null or price_basis_snapshot in (
      'per_order','per_day','per_administration','per_product_unit','per_kg','fixed_set'
    )) not valid,
  add constraint order_billing_candidates_tax_class_check
    check (tax_class_snapshot is null or tax_class_snapshot in ('taxable','non_taxable')) not valid,
  add constraint order_billing_candidates_set_owner_check
    check (set_billing_owner_snapshot is null or set_billing_owner_snapshot in ('parent','children')) not valid,
  add constraint order_billing_candidates_set_amount_strategy_check
    check (set_amount_strategy_snapshot is null or set_amount_strategy_snapshot in (
      'fixed_set','included_order_sum','range_price'
    )) not valid,
  add constraint order_billing_candidates_billing_snapshot_shape_check
    check (
      (billing_snapshot is null and billing_snapshot_sha256 is null)
      or (
        jsonb_typeof(billing_snapshot) = 'object'
        and billing_snapshot_sha256 ~ '^[0-9a-f]{64}$'
      )
    ) not valid,
  add constraint order_billing_candidates_billing_cycle_check
    check (billing_cycle > 0) not valid;

update public.order_billing_candidates candidate
set
  price_basis_snapshot = coalesce(
    candidate.price_basis_snapshot,
    nullif(candidate.source_snapshot #>> '{planOrderAuthority,priceBasis}', ''),
    nullif(candidate.source_snapshot #>> '{appliedSnapshot,planOrderAuthority,priceBasis}', ''),
    case coalesce(
      nullif(candidate.source_snapshot->>'appliedAmountBasis', ''),
      nullif(candidate.source_snapshot->>'amountBasis', '')
    )
      when 'fixed_order_price' then 'per_order'
      when 'per_frequency' then 'per_administration'
      when 'per_kg' then 'per_kg'
      when 'set_fixed_price' then 'fixed_set'
      else null
    end
  ),
  billing_unit_snapshot = coalesce(
    candidate.billing_unit_snapshot,
    nullif(candidate.source_snapshot #>> '{planOrderAuthority,billingUnit}', ''),
    nullif(candidate.source_snapshot #>> '{appliedSnapshot,planOrderAuthority,billingUnit}', '')
  ),
  tax_class_snapshot = coalesce(
    candidate.tax_class_snapshot,
    nullif(candidate.source_snapshot #>> '{planOrderAuthority,taxClass}', ''),
    nullif(candidate.source_snapshot #>> '{appliedSnapshot,planOrderAuthority,taxClass}', ''),
    nullif(candidate.source_snapshot->>'taxType', '')
  ),
  set_billing_owner_snapshot = coalesce(
    candidate.set_billing_owner_snapshot,
    nullif(candidate.source_snapshot #>> '{planOrderAuthority,setBillingOwner}', ''),
    nullif(candidate.source_snapshot #>> '{appliedSnapshot,planOrderAuthority,setBillingOwner}', '')
  ),
  set_amount_strategy_snapshot = coalesce(
    candidate.set_amount_strategy_snapshot,
    nullif(candidate.source_snapshot #>> '{planOrderAuthority,setAmountStrategy}', ''),
    nullif(candidate.source_snapshot #>> '{appliedSnapshot,planOrderAuthority,setAmountStrategy}', '')
  );

alter table public.order_billing_candidates
  validate constraint order_billing_candidates_status_v3_check,
  validate constraint order_billing_candidates_amount_v3_check,
  validate constraint order_billing_candidates_price_basis_check,
  validate constraint order_billing_candidates_tax_class_check,
  validate constraint order_billing_candidates_set_owner_check,
  validate constraint order_billing_candidates_set_amount_strategy_check,
  validate constraint order_billing_candidates_billing_snapshot_shape_check,
  validate constraint order_billing_candidates_billing_cycle_check;

create table if not exists public.order_billing_review_resolutions (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.workspaces(id) on delete cascade,
  invoice_id uuid not null,
  resolution_type text not null
    check (resolution_type = 'invoice_void_and_rebill'),
  idempotency_key text not null
    check (length(btrim(idempotency_key)) between 8 and 160),
  request_sha256 text not null check (request_sha256 ~ '^[0-9a-f]{64}$'),
  expected_invoice_updated_at timestamptz not null,
  reason text not null check (length(btrim(reason)) between 3 and 500),
  before_snapshot jsonb not null check (jsonb_typeof(before_snapshot) = 'object'),
  after_snapshot jsonb check (after_snapshot is null or jsonb_typeof(after_snapshot) = 'object'),
  result jsonb check (result is null or jsonb_typeof(result) = 'object'),
  created_by_user_id uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, idempotency_key),
  foreign key (workspace_id, invoice_id)
    references public.invoices(workspace_id, id) on delete restrict
);

create table if not exists public.order_intended_assignee_commands (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.workspaces(id) on delete cascade,
  order_id uuid not null,
  idempotency_key text not null
    check (length(btrim(idempotency_key)) between 8 and 160),
  request_sha256 text not null check (request_sha256 ~ '^[0-9a-f]{64}$'),
  expected_order_updated_at timestamptz not null,
  intended_assignee_user_id uuid references public.users(id) on delete restrict,
  result jsonb check (result is null or jsonb_typeof(result) = 'object'),
  created_by_user_id uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, idempotency_key),
  foreign key (workspace_id, order_id)
    references public.orders(workspace_id, id) on delete restrict
);

-- Command rows are an internal idempotency ledger. Callers must use the
-- actor-bound SECURITY DEFINER RPC instead of reading or writing the ledger
-- through PostgREST/table grants.
alter table public.order_intended_assignee_commands enable row level security;
revoke all on public.order_intended_assignee_commands
  from public, anon, authenticated, service_role;

create table if not exists public.order_actual_dispense_overrides (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.workspaces(id) on delete cascade,
  order_id uuid not null,
  version_no integer not null check (version_no > 0),
  idempotency_key text not null
    check (length(btrim(idempotency_key)) between 8 and 160),
  request_sha256 text not null check (request_sha256 ~ '^[0-9a-f]{64}$'),
  expected_order_updated_at timestamptz not null,
  proposed_quantity numeric not null check (proposed_quantity > 0),
  previous_quantity numeric not null check (previous_quantity > 0),
  actual_quantity numeric not null check (actual_quantity > 0),
  actual_unit text not null check (length(btrim(actual_unit)) > 0),
  reason text check (reason is null or length(btrim(reason)) between 3 and 500),
  reason_required boolean not null,
  result jsonb check (result is null or jsonb_typeof(result) = 'object'),
  created_by_user_id uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, order_id, version_no),
  unique (workspace_id, idempotency_key),
  foreign key (workspace_id, order_id)
    references public.orders(workspace_id, id) on delete restrict
);

alter table public.order_actual_dispense_overrides enable row level security;
revoke all on public.order_actual_dispense_overrides
  from public, anon, authenticated, service_role;
grant select on public.order_actual_dispense_overrides to authenticated;

drop policy if exists order_actual_dispense_overrides_select
  on public.order_actual_dispense_overrides;
create policy order_actual_dispense_overrides_select
  on public.order_actual_dispense_overrides
  for select to authenticated
  using (
    private.clair_is_active_workspace_member(workspace_id)
    and private.clair_current_user_has_workspace_permission(
      workspace_id, 'chart:view'
    )
  );

create or replace function private.clair_snapshot_order_billing_authority()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_authority jsonb := coalesce(
    new.source_snapshot -> 'planOrderAuthority',
    new.source_snapshot #> '{appliedSnapshot,planOrderAuthority}',
    '{}'::jsonb
  );
  v_legacy_amount_basis text := coalesce(
    nullif(new.source_snapshot ->> 'appliedAmountBasis', ''),
    nullif(new.source_snapshot ->> 'amountBasis', '')
  );
begin
  new.price_basis_snapshot := coalesce(
    new.price_basis_snapshot,
    nullif(v_authority ->> 'priceBasis', ''),
    case v_legacy_amount_basis
      when 'fixed_order_price' then 'per_order'
      when 'per_frequency' then 'per_administration'
      when 'per_kg' then 'per_kg'
      when 'set_fixed_price' then 'fixed_set'
      else null
    end
  );
  new.billing_unit_snapshot := coalesce(
    new.billing_unit_snapshot,
    nullif(v_authority ->> 'billingUnit', '')
  );
  new.tax_class_snapshot := coalesce(
    new.tax_class_snapshot,
    nullif(v_authority ->> 'taxClass', ''),
    nullif(new.source_snapshot ->> 'taxType', '')
  );
  new.set_billing_owner_snapshot := coalesce(
    new.set_billing_owner_snapshot,
    nullif(v_authority ->> 'setBillingOwner', '')
  );
  new.set_amount_strategy_snapshot := coalesce(
    new.set_amount_strategy_snapshot,
    nullif(v_authority ->> 'setAmountStrategy', '')
  );
  return new;
end;
$function$;

drop trigger if exists order_billing_candidates_authority_snapshot_trg
  on public.order_billing_candidates;
create trigger order_billing_candidates_authority_snapshot_trg
before insert on public.order_billing_candidates
for each row execute function private.clair_snapshot_order_billing_authority();

create or replace function private.clair_guard_order_billing_snapshot_immutability()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_resolution_id text := current_setting(
    'clair.billing_review_resolution_id', true
  );
  v_explicit_reversal boolean := false;
begin
  if v_resolution_id is not null and v_resolution_id <> '' then
    select exists (
      select 1
      from public.order_billing_review_resolutions resolution
      join public.invoice_lines line
        on line.workspace_id = resolution.workspace_id
       and line.invoice_id = resolution.invoice_id
       and line.id = old.invoice_line_id
      where resolution.workspace_id = old.workspace_id
        and resolution.id::text = v_resolution_id
        and resolution.created_by_user_id = auth.uid()
        and resolution.after_snapshot is null
        and old.invoice_line_id is not null
        and new.invoice_line_id is null
        and old.billing_snapshot is not null
        and new.billing_snapshot is null
        and new.billing_snapshot_sha256 is null
        and new.billing_cycle = old.billing_cycle + 1
    ) into v_explicit_reversal;
  end if;
  if old.billing_snapshot is not null and (
    new.billing_snapshot is distinct from old.billing_snapshot
    or new.billing_snapshot_sha256 is distinct from old.billing_snapshot_sha256
  ) and not v_explicit_reversal then
    raise exception 'billing_snapshot_immutable' using errcode = '55000';
  end if;
  if new.price_basis_snapshot is distinct from old.price_basis_snapshot
    or new.billing_unit_snapshot is distinct from old.billing_unit_snapshot
    or new.tax_class_snapshot is distinct from old.tax_class_snapshot
    or new.set_billing_owner_snapshot is distinct from old.set_billing_owner_snapshot
    or new.set_amount_strategy_snapshot is distinct from old.set_amount_strategy_snapshot
  then
    raise exception 'billing_authority_snapshot_immutable' using errcode = '55000';
  end if;
  return new;
end;
$function$;

drop trigger if exists order_billing_candidates_snapshot_immutable_trg
  on public.order_billing_candidates;
create trigger order_billing_candidates_snapshot_immutable_trg
before update on public.order_billing_candidates
for each row execute function private.clair_guard_order_billing_snapshot_immutability();

create table if not exists public.workspace_order_billing_policies (
  workspace_id text primary key references public.workspaces(id) on delete cascade,
  vat_calculation_policy text
    check (vat_calculation_policy in ('vat_included','vat_added')),
  adjustment_reasons jsonb not null default '[]'::jsonb
    check (jsonb_typeof(adjustment_reasons) = 'array'),
  updated_by_user_id uuid references public.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.order_prebilling_overrides (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.workspaces(id) on delete cascade,
  encounter_id uuid not null,
  order_id uuid not null,
  version_no integer not null check (version_no > 0),
  idempotency_key text not null check (length(btrim(idempotency_key)) between 8 and 160),
  request_sha256 text not null check (request_sha256 ~ '^[0-9a-f]{64}$'),
  billing_name text not null check (length(btrim(billing_name)) > 0),
  billing_reflection_enabled boolean not null,
  billing_quantity numeric not null check (billing_quantity > 0),
  adjustment_source text check (adjustment_source in ('amount','percent')),
  adjustment_amount_krw bigint not null default 0,
  adjustment_percent numeric not null default 0,
  adjustment_reason text,
  created_by_user_id uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, order_id, version_no),
  unique (workspace_id, idempotency_key),
  foreign key (workspace_id, encounter_id)
    references public.encounters(workspace_id, id) on delete restrict,
  foreign key (workspace_id, order_id)
    references public.orders(workspace_id, id) on delete restrict,
  check (
    adjustment_amount_krw = 0
    or length(btrim(coalesce(adjustment_reason, ''))) > 0
  )
);

alter table public.workspace_order_billing_policies enable row level security;
alter table public.order_prebilling_overrides enable row level security;
alter table public.order_billing_review_resolutions enable row level security;

drop policy if exists workspace_order_billing_policies_select
  on public.workspace_order_billing_policies;
create policy workspace_order_billing_policies_select
  on public.workspace_order_billing_policies for select
  using (
    private.clair_is_active_workspace_member(workspace_id)
    and private.clair_current_user_has_workspace_permission(workspace_id, 'billing:view')
  );

drop policy if exists order_prebilling_overrides_select
  on public.order_prebilling_overrides;
create policy order_prebilling_overrides_select
  on public.order_prebilling_overrides for select
  using (
    private.clair_is_active_workspace_member(workspace_id)
    and private.clair_current_user_has_workspace_permission(workspace_id, 'billing:view')
  );

drop policy if exists order_billing_review_resolutions_select
  on public.order_billing_review_resolutions;
create policy order_billing_review_resolutions_select
  on public.order_billing_review_resolutions for select
  using (
    private.clair_is_active_workspace_member(workspace_id)
    and private.clair_current_user_has_workspace_permission(workspace_id, 'billing:view')
  );

revoke all on table public.workspace_order_billing_policies,
  public.order_prebilling_overrides,
  public.order_billing_review_resolutions from public, anon, authenticated;
grant select on table public.workspace_order_billing_policies,
  public.order_prebilling_overrides,
  public.order_billing_review_resolutions to authenticated;

alter table public.invoices
  add column if not exists billing_review_required boolean not null default false,
  add column if not exists billing_review_reason text;

create or replace function private.clair_guard_invoice_billing_review_hold()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
begin
  if old.billing_review_required
    and (new.status = 'paid' or new.payment_state = 'paid')
  then raise exception 'billing_review_required' using errcode = '55000'; end if;
  return new;
end;
$function$;

drop trigger if exists invoices_billing_review_hold_trg on public.invoices;
create trigger invoices_billing_review_hold_trg
before update on public.invoices
for each row execute function private.clair_guard_invoice_billing_review_hold();

alter function public.clair_prepare_billing_checkout_session(
  text,uuid,uuid[],text,jsonb,text
) rename to clair_prepare_billing_checkout_session_review_base;
revoke all on function public.clair_prepare_billing_checkout_session_review_base(
  text,uuid,uuid[],text,jsonb,text
) from public, anon, authenticated, service_role;

create function public.clair_prepare_billing_checkout_session(
  p_workspace_id text,
  p_actor_user_id uuid,
  p_invoice_ids uuid[],
  p_payment_method text default null,
  p_adjustments jsonb default '[]'::jsonb,
  p_payment_memo text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
begin
  if auth.uid() is null or p_actor_user_id is distinct from auth.uid()
    or not private.clair_is_active_workspace_member(p_workspace_id)
    or not private.clair_current_user_has_workspace_permission(p_workspace_id, 'billing:issue')
  then raise exception 'permission_missing' using errcode = '42501'; end if;
  if exists (
    select 1 from public.invoices invoice
    where invoice.workspace_id = p_workspace_id
      and invoice.id = any(p_invoice_ids)
      and invoice.billing_review_required
  ) then raise exception 'billing_review_required'; end if;
  return public.clair_prepare_billing_checkout_session_review_base(
    p_workspace_id, p_actor_user_id, p_invoice_ids,
    p_payment_method, p_adjustments, p_payment_memo
  );
end;
$function$;

alter function public.clair_transition_billing_invoice_status(
  text,uuid,uuid,text,text,text
) rename to clair_transition_billing_invoice_status_review_base;
revoke all on function public.clair_transition_billing_invoice_status_review_base(
  text,uuid,uuid,text,text,text
) from public, anon, authenticated, service_role;

create function public.clair_transition_billing_invoice_status(
  p_workspace_id text,
  p_actor_user_id uuid,
  p_invoice_id uuid,
  p_target text,
  p_payment_method text default 'card',
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
begin
  if auth.uid() is null or p_actor_user_id is distinct from auth.uid()
    or not private.clair_is_active_workspace_member(p_workspace_id)
    or not private.clair_current_user_has_workspace_permission(p_workspace_id, 'billing:issue')
  then raise exception 'permission_missing' using errcode = '42501'; end if;
  if p_target = 'paid' and exists (
    select 1 from public.invoices invoice
    where invoice.workspace_id = p_workspace_id
      and invoice.id = p_invoice_id
      and invoice.billing_review_required
  ) then raise exception 'billing_review_required'; end if;
  if p_target = 'voided' and exists (
    select 1
    from public.invoices invoice
    where invoice.workspace_id = p_workspace_id
      and invoice.id = p_invoice_id
      and (
        invoice.payment_state in ('paid','refunded')
        or invoice.status in ('paid','refund_requested','refunded')
        or exists (
          select 1 from public.payments payment
          where payment.workspace_id = invoice.workspace_id
            and payment.invoice_id = invoice.id
            and payment.status = 'approved'
        )
      )
  ) then raise exception 'refund_flow_required'; end if;
  return public.clair_transition_billing_invoice_status_review_base(
    p_workspace_id, p_actor_user_id, p_invoice_id,
    p_target, p_payment_method, p_reason
  );
end;
$function$;

alter function public.clair_save_billing_payment_status(
  text,uuid,uuid,text,text,text
) rename to clair_save_billing_payment_status_review_base;
revoke all on function public.clair_save_billing_payment_status_review_base(
  text,uuid,uuid,text,text,text
) from public, anon, authenticated, service_role;

create function public.clair_save_billing_payment_status(
  p_workspace_id text,
  p_actor_user_id uuid,
  p_invoice_id uuid,
  p_action text,
  p_payment_method text,
  p_unpaid_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
begin
  if auth.uid() is null or p_actor_user_id is distinct from auth.uid()
    or not private.clair_is_active_workspace_member(p_workspace_id)
    or not private.clair_current_user_has_workspace_permission(p_workspace_id, 'billing:issue')
  then raise exception 'permission_missing' using errcode = '42501'; end if;
  if p_action in ('select_payment_method','complete_payment') and exists (
    select 1 from public.invoices invoice
    where invoice.workspace_id = p_workspace_id
      and invoice.id = p_invoice_id
      and invoice.billing_review_required
  ) then raise exception 'billing_review_required'; end if;
  return public.clair_save_billing_payment_status_review_base(
    p_workspace_id, p_actor_user_id, p_invoice_id,
    p_action, p_payment_method, p_unpaid_reason
  );
end;
$function$;

revoke all on function public.clair_prepare_billing_checkout_session(
  text,uuid,uuid[],text,jsonb,text
) from public, anon, service_role;
revoke all on function public.clair_transition_billing_invoice_status(
  text,uuid,uuid,text,text,text
) from public, anon, service_role;
revoke all on function public.clair_save_billing_payment_status(
  text,uuid,uuid,text,text,text
) from public, anon, service_role;
grant execute on function public.clair_prepare_billing_checkout_session(
  text,uuid,uuid[],text,jsonb,text
) to authenticated;
grant execute on function public.clair_transition_billing_invoice_status(
  text,uuid,uuid,text,text,text
) to authenticated;
grant execute on function public.clair_save_billing_payment_status(
  text,uuid,uuid,text,text,text
) to authenticated;

-- A returned invoice-linked order cannot silently detach its billed line. For
-- unpaid invoices, billing staff may explicitly void the whole immutable
-- invoice, preserve every original line, and reopen its candidates for a new
-- billing cycle. Paid/refunded invoices stay held for the external refund flow.
create or replace function public.clair_reverse_billing_review_invoice(
  p_workspace_id text,
  p_actor_user_id uuid,
  p_invoice_id uuid,
  p_expected_invoice_updated_at timestamptz,
  p_idempotency_key text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $function$
declare
  v_now timestamptz := now();
  v_invoice public.invoices%rowtype;
  v_existing public.order_billing_review_resolutions%rowtype;
  v_resolution public.order_billing_review_resolutions%rowtype;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_key text := btrim(coalesce(p_idempotency_key, ''));
  v_hash text;
  v_before jsonb;
  v_after jsonb;
  v_result jsonb;
  v_actor_membership_id uuid;
  v_candidate_count integer := 0;
begin
  if auth.uid() is null or p_actor_user_id is distinct from auth.uid()
    or not private.clair_is_active_workspace_member(p_workspace_id)
    or not private.clair_current_user_has_workspace_permission(
      p_workspace_id, 'billing:issue'
    )
  then raise exception 'permission_missing' using errcode = '42501'; end if;
  if p_expected_invoice_updated_at is null
    or length(v_key) not between 8 and 160
    or length(v_reason) not between 3 and 500
  then raise exception 'invalid_billing_review_resolution'; end if;

  v_hash := encode(digest(jsonb_build_object(
    'actorUserId', p_actor_user_id,
    'invoiceId', p_invoice_id,
    'expectedInvoiceUpdatedAt', p_expected_invoice_updated_at,
    'resolutionType', 'invoice_void_and_rebill',
    'reason', v_reason
  )::text, 'sha256'), 'hex');
  perform pg_advisory_xact_lock(hashtextextended(
    'billing_review_resolution:' || p_workspace_id || ':' || v_key, 0
  ));

  select * into v_existing
  from public.order_billing_review_resolutions resolution
  where resolution.workspace_id = p_workspace_id
    and resolution.idempotency_key = v_key;
  if found then
    if v_existing.request_sha256 is distinct from v_hash
      or v_existing.invoice_id is distinct from p_invoice_id
    then raise exception 'idempotency_conflict'; end if;
    if v_existing.result is null then
      raise exception 'billing_review_resolution_in_progress';
    end if;
    return v_existing.result;
  end if;

  select * into v_invoice
  from public.invoices invoice
  where invoice.workspace_id = p_workspace_id
    and invoice.id = p_invoice_id
  for update;
  if not found then raise exception 'invoice_unavailable'; end if;
  if v_invoice.updated_at is distinct from p_expected_invoice_updated_at then
    raise exception 'revision_conflict';
  end if;
  if not v_invoice.billing_review_required then
    raise exception 'billing_review_not_required';
  end if;
  if v_invoice.status in ('paid','refund_requested','refunded')
    or v_invoice.payment_state in ('paid','refunded')
    or exists (
      select 1 from public.payments payment
      where payment.workspace_id = p_workspace_id
        and payment.invoice_id = p_invoice_id
        and payment.status = 'approved'
    )
  then raise exception 'refund_flow_required'; end if;

  v_before := jsonb_build_object(
    'invoice', jsonb_build_object(
      'id', v_invoice.id,
      'status', v_invoice.status,
      'paymentState', v_invoice.payment_state,
      'billingReviewRequired', v_invoice.billing_review_required,
      'billingReviewReason', v_invoice.billing_review_reason,
      'updatedAt', v_invoice.updated_at
    ),
    'candidates', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', candidate.id,
        'orderId', candidate.order_id,
        'status', candidate.status,
        'invoiceLineId', candidate.invoice_line_id,
        'billingCycle', candidate.billing_cycle,
        'billingSnapshot', candidate.billing_snapshot,
        'billingSnapshotSha256', candidate.billing_snapshot_sha256
      ) order by candidate.order_id)
      from public.order_billing_candidates candidate
      join public.invoice_lines line
        on line.workspace_id = candidate.workspace_id
       and line.id = candidate.invoice_line_id
      where line.workspace_id = p_workspace_id
        and line.invoice_id = p_invoice_id
    ), '[]'::jsonb)
  );

  insert into public.order_billing_review_resolutions (
    workspace_id, invoice_id, resolution_type, idempotency_key,
    request_sha256, expected_invoice_updated_at, reason,
    before_snapshot, created_by_user_id, created_at
  ) values (
    p_workspace_id, p_invoice_id, 'invoice_void_and_rebill', v_key,
    v_hash, p_expected_invoice_updated_at, v_reason,
    v_before, p_actor_user_id, v_now
  ) returning * into v_resolution;

  perform set_config(
    'clair.billing_review_resolution_id', v_resolution.id::text, true
  );
  update public.order_billing_candidates candidate
  set
    status = case when orders.status = 'cancelled'
      then 'cancelled' else 'candidate_created' end,
    invoice_line_id = null,
    billing_snapshot = null,
    billing_snapshot_sha256 = null,
    billing_cycle = candidate.billing_cycle + 1,
    updated_at = v_now
  from public.invoice_lines line
  join public.orders orders
    on orders.workspace_id = line.workspace_id
   and orders.id = line.order_id
  where candidate.workspace_id = p_workspace_id
    and candidate.invoice_line_id = line.id
    and line.invoice_id = p_invoice_id
    and candidate.order_id = orders.id;
  get diagnostics v_candidate_count = row_count;
  if v_candidate_count = 0 then raise exception 'invoice_lineage_unavailable'; end if;

  update public.orders orders
  set
    invoice_line_id = null,
    order_confirmation_status = case when orders.status = 'cancelled'
      then 'cancelled' else 'confirmed' end,
    billing_candidate_status = case when orders.status = 'cancelled'
      then 'cancelled' else 'candidate_created' end,
    updated_at = v_now
  from public.invoice_lines line
  where line.workspace_id = p_workspace_id
    and line.invoice_id = p_invoice_id
    and line.order_id = orders.id
    and orders.workspace_id = p_workspace_id;

  update public.invoices invoice
  set
    status = 'voided',
    payment_state = 'none',
    selected_payment_method = null,
    unpaid_reason = null,
    paid_at = null,
    voided_at = v_now,
    voided_reason = v_reason,
    billing_review_required = false,
    billing_review_reason = null,
    updated_at = v_now
  where invoice.workspace_id = p_workspace_id
    and invoice.id = p_invoice_id
  returning * into v_invoice;

  insert into public.billing_invoice_status_transition_events (
    workspace_id, invoice_id, actor_user_id,
    previous_status, next_status,
    previous_payment_state, next_payment_state,
    amount_snapshot, reason, source, payment_side_effect, created_at
  ) values (
    p_workspace_id, p_invoice_id, p_actor_user_id,
    private.clair_billing_lifecycle_status(
      v_before #>> '{invoice,status}',
      v_before #>> '{invoice,paymentState}', null
    ),
    'voided',
    v_before #>> '{invoice,paymentState}', v_invoice.payment_state,
    v_invoice.total_amount, v_reason,
    'order_billing_review_resolution',
    jsonb_build_object(
      'resolutionId', v_resolution.id,
      'resolutionType', 'invoice_void_and_rebill',
      'candidateCount', v_candidate_count
    ),
    v_now
  );

  v_after := jsonb_build_object(
    'invoice', jsonb_build_object(
      'id', v_invoice.id,
      'status', v_invoice.status,
      'paymentState', v_invoice.payment_state,
      'billingReviewRequired', v_invoice.billing_review_required,
      'voidedAt', v_invoice.voided_at,
      'voidedReason', v_invoice.voided_reason,
      'updatedAt', v_invoice.updated_at
    ),
    'candidates', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', candidate.id,
        'orderId', candidate.order_id,
        'status', candidate.status,
        'invoiceLineId', candidate.invoice_line_id,
        'billingCycle', candidate.billing_cycle,
        'billingSnapshot', candidate.billing_snapshot
      ) order by candidate.order_id)
      from public.order_billing_candidates candidate
      join public.invoice_lines line
        on line.workspace_id = candidate.workspace_id
       and line.invoice_id = p_invoice_id
       and line.order_id = candidate.order_id
      where candidate.workspace_id = p_workspace_id
    ), '[]'::jsonb)
  );
  v_result := jsonb_build_object(
    'resolutionId', v_resolution.id,
    'resolutionType', 'invoice_void_and_rebill',
    'invoiceId', p_invoice_id,
    'candidateCount', v_candidate_count,
    'before', v_before,
    'after', v_after
  );
  update public.order_billing_review_resolutions resolution
  set after_snapshot = v_after, result = v_result
  where resolution.workspace_id = p_workspace_id
    and resolution.id = v_resolution.id;

  select membership.id into v_actor_membership_id
  from public.user_memberships membership
  where membership.workspace_id = p_workspace_id
    and membership.user_id = p_actor_user_id
    and membership.status = 'active'
  order by membership.created_at
  limit 1;
  insert into public.audit_events (
    id, workspace_id, actor_user_id, actor_membership_id,
    event_type, target_type, target_id, encounter_id, request_id,
    reason, before_snapshot, after_snapshot, metadata,
    occurred_at, created_at
  ) values (
    'billing-review-resolution-' || v_resolution.id::text,
    p_workspace_id, p_actor_user_id, v_actor_membership_id,
    'billing.payment_state_changed', 'invoice', p_invoice_id::text,
    v_invoice.encounter_id, v_resolution.id::text,
    v_reason, v_before, v_after,
    jsonb_build_object(
      'source', 'order-billing-review-resolution-v1',
      'resolutionType', 'invoice_void_and_rebill',
      'idempotencyKey', v_key
    ),
    v_now, v_now
  );
  return v_result;
end;
$function$;

revoke all on function public.clair_reverse_billing_review_invoice(
  text,uuid,uuid,timestamptz,text,text
) from public, anon, service_role;
grant execute on function public.clair_reverse_billing_review_invoice(
  text,uuid,uuid,timestamptz,text,text
) to authenticated;

-- Set-parent integrity remains strict, but its expected values now include the
-- latest immutable pre-billing override and the explicit review-hold state.
create or replace function private.clair_assert_set_parent_billing_candidate_integrity(
  p_workspace_id text,
  p_order_id uuid,
  p_require_completed_command boolean
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_order public.orders%rowtype;
  v_task public.order_tasks%rowtype;
  v_command public.order_confirmation_commands%rowtype;
  v_candidate public.order_billing_candidates%rowtype;
  v_override public.order_prebilling_overrides%rowtype;
  v_expected_billing_name text;
  v_expected_quantity numeric;
  v_expected_amount numeric;
  v_expected_source_snapshot jsonb;
begin
  select orders.* into v_order
  from public.orders orders
  where orders.workspace_id = p_workspace_id
    and orders.id = p_order_id
    and orders.row_type = 'set'
    and orders.status <> 'cancelled'
    and orders.order_confirmation_status in ('confirmed','billed')
    and orders.billing_eligible
    and orders.billing_reflection_enabled
    and orders.line_total_snapshot > 0
    and orders.applied_price_snapshot ->> 'billedAs' = 'set_parent';
  if not found then return; end if;

  select task.* into v_task
  from public.order_tasks task
  where task.workspace_id = v_order.workspace_id
    and task.order_id = v_order.id
    and task.task_role = 'aggregate'
    and task.attempt_no = 1;
  if not found then
    raise exception 'set_parent_billing_candidate_integrity_mismatch:%', p_order_id;
  end if;

  select command.* into v_command
  from public.order_confirmation_commands command
  where command.workspace_id = v_order.workspace_id
    and command.encounter_id = v_order.encounter_id
    and (not p_require_completed_command or command.status = 'completed')
    and v_order.id = any(command.selected_root_order_ids)
    and command.id::text = coalesce(
      nullif(v_order.confirmed_snapshot ->> 'confirmationCommandId', ''),
      case when v_task.effective_snapshot ? 'legacyBackfill' then
        private.clair_chart_order_backfill_uuid(
          'chart-order-backfill-command-v1|' || v_order.workspace_id || '|' || v_order.id::text
        )::text
      end
    );
  if not found then
    raise exception 'set_parent_billing_candidate_integrity_mismatch:%', p_order_id;
  end if;

  select candidate.* into v_candidate
  from public.order_billing_candidates candidate
  where candidate.workspace_id = v_order.workspace_id
    and candidate.order_id = v_order.id;
  if not found then
    raise exception 'set_parent_billing_candidate_integrity_mismatch:%', p_order_id;
  end if;

  select override_row.* into v_override
  from public.order_prebilling_overrides override_row
  where override_row.workspace_id = v_order.workspace_id
    and override_row.order_id = v_order.id
  order by override_row.version_no desc
  limit 1;

  v_expected_billing_name := coalesce(
    case when found then v_override.billing_name end,
    nullif(v_order.applied_snapshot ->> 'billingName', ''),
    nullif(v_order.applied_snapshot ->> 'inHospitalOrderName', ''),
    'Order ' || v_order.id::text
  );
  v_expected_quantity := case when found
    then v_override.billing_quantity else v_order.quantity end;
  v_expected_amount := case when found
    then round(coalesce(v_order.unit_price_snapshot, 0) * v_override.billing_quantity)::bigint
      + v_override.adjustment_amount_krw
    else v_order.line_total_snapshot end;
  v_expected_source_snapshot := case
    when v_task.effective_snapshot ? 'legacyBackfill' then v_task.effective_snapshot
    else v_order.confirmed_snapshot
  end;
  if found then
    v_expected_source_snapshot := v_expected_source_snapshot || jsonb_build_object(
      'preBillingOverride', jsonb_build_object(
        'versionNo', v_override.version_no,
        'billingName', v_override.billing_name,
        'billingReflectionEnabled', v_override.billing_reflection_enabled,
        'billingQuantity', v_override.billing_quantity,
        'adjustmentSource', v_override.adjustment_source,
        'adjustmentAmountKrw', v_override.adjustment_amount_krw,
        'adjustmentPercent', v_override.adjustment_percent,
        'adjustmentReason', v_override.adjustment_reason
      )
    );
  end if;

  if v_candidate.id is distinct from 'billcand-' || v_order.id::text
     or v_candidate.workspace_id is distinct from v_order.workspace_id
     or v_candidate.encounter_id is distinct from v_order.encounter_id
     or v_candidate.order_id is distinct from v_order.id
     or v_candidate.task_id is distinct from v_task.id
     or v_candidate.task_attempt_no is distinct from v_task.attempt_no
     or v_candidate.confirmation_command_id is distinct from v_command.id
     or v_candidate.created_by_user_id is distinct from v_command.actor_user_id
     or v_candidate.billing_name_snapshot is distinct from v_expected_billing_name
     or v_candidate.quantity is distinct from v_expected_quantity
     or v_candidate.unit_price is distinct from coalesce(v_order.unit_price_snapshot, 0)
     or v_candidate.amount is distinct from v_expected_amount
     or v_candidate.currency is distinct from 'KRW'
     or v_candidate.source_snapshot is distinct from v_expected_source_snapshot
     or v_candidate.invoice_line_id is distinct from v_order.invoice_line_id
     or (
       v_order.invoice_line_id is null
       and v_candidate.status not in ('candidate_created','billing_review_required')
     )
     or (
       v_order.invoice_line_id is not null
       and v_candidate.status <> 'invoice_linked'
     )
  then
    raise exception 'set_parent_billing_candidate_integrity_mismatch:%', p_order_id;
  end if;

  if v_order.invoice_line_id is not null and not exists (
    select 1
    from public.invoice_lines line
    join public.invoices invoice
      on invoice.workspace_id = line.workspace_id
     and invoice.id = line.invoice_id
    where line.id = v_order.invoice_line_id
      and line.workspace_id = v_order.workspace_id
      and line.order_id = v_order.id
      and line.billing_candidate_id = v_candidate.id
      and line.quantity = v_candidate.quantity
      and line.line_total = v_candidate.amount
      and invoice.encounter_id = v_order.encounter_id
  ) then
    raise exception 'set_parent_billing_candidate_integrity_mismatch:%', p_order_id;
  end if;
end;
$function$;

revoke all on function private.clair_assert_set_parent_billing_candidate_integrity(text,uuid,boolean)
  from public, anon, authenticated, service_role;

create or replace function private.clair_reject_prebilling_override_mutation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
begin
  raise exception 'prebilling_override_immutable' using errcode = '55000';
end;
$function$;

drop trigger if exists order_prebilling_overrides_immutable_trg
  on public.order_prebilling_overrides;
create trigger order_prebilling_overrides_immutable_trg
before update or delete on public.order_prebilling_overrides
for each row execute function private.clair_reject_prebilling_override_mutation();

drop trigger if exists order_billing_review_resolutions_immutable_trg
  on public.order_billing_review_resolutions;
create trigger order_billing_review_resolutions_immutable_trg
before update or delete on public.order_billing_review_resolutions
for each row
when (old.after_snapshot is not null)
execute function private.clair_reject_prebilling_override_mutation();

drop trigger if exists order_intended_assignee_commands_immutable_trg
  on public.order_intended_assignee_commands;
create trigger order_intended_assignee_commands_immutable_trg
before update or delete on public.order_intended_assignee_commands
for each row
when (old.result is not null)
execute function private.clair_reject_prebilling_override_mutation();

drop trigger if exists order_actual_dispense_overrides_immutable_trg
  on public.order_actual_dispense_overrides;
create trigger order_actual_dispense_overrides_immutable_trg
before update or delete on public.order_actual_dispense_overrides
for each row
when (old.result is not null)
execute function private.clair_reject_prebilling_override_mutation();

create or replace function private.clair_reject_confirmed_snapshot_overwrite()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_context text := current_setting(
    'clair.confirmed_snapshot_mutation_id', true
  );
  v_authorized boolean := false;
  v_id uuid;
begin
  if old.confirmed_snapshot is not distinct from new.confirmed_snapshot
    or old.confirmed_snapshot = '{}'::jsonb
  then return new; end if;

  if v_context like 'confirmation:%' then
    begin v_id := substring(v_context from 14)::uuid;
    exception when others then v_id := null; end;
    select exists (
      select 1
      from public.order_confirmation_commands command
      where command.id = v_id
        and command.workspace_id = old.workspace_id
        and command.encounter_id = old.encounter_id
        and command.actor_user_id = auth.uid()
        and command.status = 'completed'
        and (
          old.id = any(command.selected_root_order_ids)
          or old.parent_chart_order_line_id = any(command.selected_root_order_ids)
        )
    ) into v_authorized;
  elsif v_context like 'revision:%' then
    begin v_id := substring(v_context from 10)::uuid;
    exception when others then v_id := null; end;
    select exists (
      select 1
      from public.order_revisions revision
      where revision.id = v_id
        and revision.workspace_id = old.workspace_id
        and revision.order_id = old.id
        and revision.created_by_user_id = auth.uid()
        and revision.result is null
        and revision.change_type in ('amendment','re_request')
    ) into v_authorized;
  end if;

  if not v_authorized and not (
    old.revision_no = 0
    and new.revision_no = 1
    and old.order_confirmation_status in ('confirmed','billed')
    and new.order_confirmation_status = old.order_confirmation_status
  ) then
    raise exception 'confirmed_snapshot_immutable' using errcode = '55000';
  end if;
  return new;
end;
$function$;

revoke all on function private.clair_reject_confirmed_snapshot_overwrite()
  from public, anon, authenticated, service_role;

create or replace function private.clair_plan_order_dispense_failure(
  p_existing jsonb,
  p_applicability text,
  p_reason text
)
returns jsonb
language sql
immutable
set search_path = pg_catalog
as $function$
  select coalesce(p_existing, '{}'::jsonb) || jsonb_build_object(
    'dispenseApplicability', p_applicability,
    'calculationStatus', 'blocked',
    'calculationError', p_reason,
    'theoreticalDispenseQuantity', null,
    'proposedActualDispenseQuantity', null,
    'totalRequiredDispenseQuantity', null,
    'requiresReconfirmation',
      coalesce(p_existing ->> 'actualDispenseSource', '') = 'manual_override'
  );
$function$;

revoke all on function private.clair_plan_order_dispense_failure(jsonb,text,text)
  from public, anon, authenticated, service_role;

create or replace function private.clair_compute_plan_order_dispense_projection(
  p_order public.orders,
  p_effective_at timestamptz
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private, extensions
as $function$
declare
  v_existing jsonb := coalesce(p_order.calculation_outputs, '{}'::jsonb);
  v_authority jsonb := p_order.applied_snapshot -> 'planOrderAuthority';
  v_mode text;
  v_basis text;
  v_dose numeric;
  v_dose_unit text;
  v_dispense_unit text;
  v_multiplier numeric := 1;
  v_weight public.patient_vital_measurements%rowtype;
  v_weight_snapshot jsonb := null;
  v_strength jsonb;
  v_conversion numeric := 1;
  v_theoretical numeric;
  v_policy jsonb;
  v_increment numeric;
  v_rounding_mode text;
  v_precision integer;
  v_proposed numeric;
  v_minimum numeric;
  v_maximum numeric;
  v_total_occurrences numeric;
  v_actual numeric;
  v_actual_source text;
  v_fingerprint text;
  v_previous_fingerprint text := nullif(v_existing ->> 'inputFingerprint', '');
  v_requires_reconfirmation boolean := false;
begin
  if v_authority is null or jsonb_typeof(v_authority) <> 'object' then
    if p_order.clinical_order_type = 'dispensing' then
      return private.clair_plan_order_dispense_failure(
        v_existing, 'unconfigured', 'configuration_missing'
      );
    end if;
    return '{}'::jsonb || jsonb_build_object(
      'dispenseApplicability', false,
      'calculationStatus', 'not_applicable'
    );
  end if;

  v_mode := nullif(btrim(v_authority ->> 'calculationMode'), '');
  if v_mode = 'not_applicable' then
    return jsonb_build_object(
      'dispenseApplicability', false,
      'calculationStatus', 'not_applicable',
      'calculationMode', v_mode
    );
  end if;
  if v_mode not in ('ingredient_based','fixed_product') then
    return private.clair_plan_order_dispense_failure(
      v_existing, 'unconfigured', 'configuration_missing'
    );
  end if;

  v_basis := case nullif(btrim(p_order.detail_inputs ->> 'doseBasis'), '')
    when 'patient' then 'head'
    when 'head' then 'head'
    when 'kg' then 'kg'
    else null
  end;
  if v_basis is null
    or jsonb_typeof(p_order.detail_inputs -> 'dose') <> 'number'
    or (p_order.detail_inputs ->> 'dose')::numeric <= 0
  then
    return private.clair_plan_order_dispense_failure(
      v_existing, 'applicable', 'invalid_dose_input'
    );
  end if;
  v_dose := (p_order.detail_inputs ->> 'dose')::numeric;
  v_dose_unit := nullif(btrim(p_order.detail_inputs ->> 'doseUnit'), '');
  if v_dose_unit is null then
    return private.clair_plan_order_dispense_failure(
      v_existing, 'applicable', 'dose_unit_missing'
    );
  end if;
  if v_basis = 'kg' and v_dose_unit ~ '/kg$' then
    v_dose_unit := regexp_replace(v_dose_unit, '/kg$', '');
  end if;
  v_dispense_unit := nullif(btrim(v_authority ->> 'dispenseUnit'), '');
  if v_dispense_unit is null then
    return private.clair_plan_order_dispense_failure(
      v_existing, 'applicable', 'dispense_unit_missing'
    );
  end if;

  if v_basis = 'kg' then
    select measurement.* into v_weight
    from public.patient_vital_measurements measurement
    where measurement.workspace_id = p_order.workspace_id
      and measurement.encounter_id = p_order.encounter_id
      and measurement.weight_kg > 0
      and measurement.measured_at <= p_effective_at
    order by measurement.measured_at desc, measurement.created_at desc,
      measurement.id desc
    limit 1;
    if not found then
      return private.clair_plan_order_dispense_failure(
        v_existing, 'applicable', 'weight_missing'
      );
    end if;
    v_multiplier := v_weight.weight_kg;
    v_weight_snapshot := jsonb_build_object(
      'valueKg', v_weight.weight_kg,
      'measuredAt', v_weight.measured_at,
      'encounterId', v_weight.encounter_id,
      'measurementId', v_weight.id
    );
  end if;

  if v_mode = 'fixed_product' then
    if jsonb_typeof(v_authority -> 'fixedProductQuantity') <> 'number'
      or (v_authority ->> 'fixedProductQuantity')::numeric <= 0
      or nullif(v_authority ->> 'fixedProductQuantityBasis', '')
        is distinct from v_basis
    then
      return private.clair_plan_order_dispense_failure(
        v_existing, 'applicable', 'fixed_product_configuration_missing'
      );
    end if;
    v_theoretical :=
      (v_authority ->> 'fixedProductQuantity')::numeric * v_multiplier;
  else
    v_strength := v_authority -> 'productStrength';
    if nullif(btrim(v_authority ->> 'referenceIngredientId'), '') is null
      or jsonb_typeof(v_strength) <> 'object'
      or jsonb_typeof(v_strength -> 'numeratorValue') <> 'number'
      or jsonb_typeof(v_strength -> 'denominatorValue') <> 'number'
      or (v_strength ->> 'numeratorValue')::numeric <= 0
      or (v_strength ->> 'denominatorValue')::numeric <= 0
      or nullif(btrim(v_strength ->> 'numeratorUnit'), '') is null
      or nullif(btrim(v_strength ->> 'denominatorUnit'), '')
        is distinct from v_dispense_unit
    then
      return private.clair_plan_order_dispense_failure(
        v_existing, 'applicable', 'strength_configuration_missing'
      );
    end if;
    if v_dose_unit is distinct from (v_strength ->> 'numeratorUnit') then
      select (conversion.value ->> 'factor')::numeric into v_conversion
      from jsonb_array_elements(
        coalesce(v_authority -> 'unitConversions', '[]'::jsonb)
      ) with ordinality conversion(value, position)
      where conversion.value ->> 'fromUnit' = v_dose_unit
        and conversion.value ->> 'toUnit' = v_strength ->> 'numeratorUnit'
        and jsonb_typeof(conversion.value -> 'factor') = 'number'
        and (conversion.value ->> 'factor')::numeric > 0
      order by conversion.position
      limit 1;
      if not found then
        return private.clair_plan_order_dispense_failure(
          v_existing, 'applicable', 'unit_conversion_missing'
        );
      end if;
    end if;
    v_theoretical := v_dose * v_multiplier * v_conversion
      * (v_strength ->> 'denominatorValue')::numeric
      / (v_strength ->> 'numeratorValue')::numeric;
  end if;

  v_policy := v_authority -> 'preparationPolicy';
  if v_policy is null or jsonb_typeof(v_policy) = 'null' then
    v_proposed := v_theoretical;
    v_actual_source := 'copied_exact';
  elsif jsonb_typeof(v_policy) = 'object'
    and jsonb_typeof(v_policy -> 'increment') = 'number'
    and (v_policy ->> 'increment')::numeric > 0
    and nullif(v_policy ->> 'roundingMode', '') in ('nearest','up','down')
    and jsonb_typeof(v_policy -> 'displayPrecision') = 'number'
    and (v_policy ->> 'displayPrecision')::numeric
      = trunc((v_policy ->> 'displayPrecision')::numeric)
    and (v_policy ->> 'displayPrecision')::integer between 0 and 9
  then
    v_increment := (v_policy ->> 'increment')::numeric;
    v_rounding_mode := v_policy ->> 'roundingMode';
    v_precision := (v_policy ->> 'displayPrecision')::integer;
    v_proposed := case v_rounding_mode
      when 'up' then ceiling(v_theoretical / v_increment) * v_increment
      when 'down' then floor(v_theoretical / v_increment) * v_increment
      else round(v_theoretical / v_increment) * v_increment
    end;
    v_proposed := round(v_proposed, v_precision);
    v_minimum := case when jsonb_typeof(v_policy -> 'minimum') = 'number'
      then (v_policy ->> 'minimum')::numeric else null end;
    v_maximum := case when jsonb_typeof(v_policy -> 'maximum') = 'number'
      then (v_policy ->> 'maximum')::numeric else null end;
    if (v_minimum is not null and v_proposed < v_minimum)
      or (v_maximum is not null and v_proposed > v_maximum)
    then
      return private.clair_plan_order_dispense_failure(
        v_existing, 'applicable', 'prepared_quantity_out_of_range'
      );
    end if;
    v_actual_source := 'preparation_policy';
  else
    return private.clair_plan_order_dispense_failure(
      v_existing, 'applicable', 'preparation_policy_invalid'
    );
  end if;

  v_total_occurrences := case
    when jsonb_typeof(p_order.detail_inputs -> 'totalOccurrences') = 'number'
      and (p_order.detail_inputs ->> 'totalOccurrences')::numeric > 0
      then (p_order.detail_inputs ->> 'totalOccurrences')::numeric
    else case nullif(p_order.detail_inputs ->> 'frequency', '')
      when 'once' then 1
      when 'sid' then case
        when jsonb_typeof(p_order.detail_inputs -> 'durationDays') = 'number'
          then (p_order.detail_inputs ->> 'durationDays')::numeric
        else 1 end
      when 'bid' then case
        when jsonb_typeof(p_order.detail_inputs -> 'durationDays') = 'number'
          then (p_order.detail_inputs ->> 'durationDays')::numeric * 2
        else null end
      when 'tid' then case
        when jsonb_typeof(p_order.detail_inputs -> 'durationDays') = 'number'
          then (p_order.detail_inputs ->> 'durationDays')::numeric * 3
        else null end
      when 'qid' then case
        when jsonb_typeof(p_order.detail_inputs -> 'durationDays') = 'number'
          then (p_order.detail_inputs ->> 'durationDays')::numeric * 4
        else null end
      when 'prn' then case
        when jsonb_typeof(
          p_order.detail_inputs -> 'maximumAuthorizedCount'
        ) = 'number'
          then (p_order.detail_inputs ->> 'maximumAuthorizedCount')::numeric
        else null end
      else null
    end
  end;
  v_fingerprint := encode(digest(jsonb_build_object(
    'authority', v_authority,
    'doseBasis', v_basis,
    'dosePerAdministration', v_dose,
    'doseUnit', v_dose_unit,
    'weightSnapshot', v_weight_snapshot,
    'theoreticalDispenseQuantity', v_theoretical,
    'proposedActualDispenseQuantity', v_proposed
  )::text, 'sha256'), 'hex');
  if v_existing ->> 'actualDispenseSource' = 'manual_override'
    and jsonb_typeof(v_existing -> 'actualDispenseQuantity') = 'number'
  then
    v_actual := (v_existing ->> 'actualDispenseQuantity')::numeric;
    v_actual_source := 'manual_override';
    v_requires_reconfirmation := v_previous_fingerprint is distinct from v_fingerprint;
  else
    v_actual := v_proposed;
  end if;

  return v_existing || jsonb_build_object(
    'dispenseApplicability', true,
    'calculationStatus', 'ready',
    'calculationError', null,
    'calculationMode', v_mode,
    'doseBasis', v_basis,
    'dosePerAdministration', v_dose,
    'doseUnit', v_dose_unit,
    'referenceIngredientId', v_authority ->> 'referenceIngredientId',
    'productStrength', v_strength,
    'weightSnapshot', v_weight_snapshot,
    'theoreticalDispenseQuantity', v_theoretical,
    'calculatedDispenseQuantity', v_theoretical,
    'dispenseUnit', v_dispense_unit,
    'preparationPolicy', v_policy,
    'proposedActualDispenseQuantity', v_proposed,
    'actualDispenseQuantity', v_actual,
    'actualDispenseUnit', v_dispense_unit,
    'actualDispenseSource', v_actual_source,
    'requiresReconfirmation', v_requires_reconfirmation,
    'totalOccurrences', v_total_occurrences,
    'totalRequiredDispenseQuantity', case
      when v_total_occurrences > 0 then v_actual * v_total_occurrences
      else null end,
    'inputFingerprint', v_fingerprint
  );
end;
$function$;

revoke all on function private.clair_compute_plan_order_dispense_projection(
  public.orders,timestamptz
) from public, anon, authenticated, service_role;

create or replace function private.clair_refresh_plan_order_dispense_projection()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
begin
  if new.order_confirmation_status not in ('draft','pending')
    or new.status = 'cancelled'
  then return new; end if;
  new.calculation_outputs :=
    private.clair_compute_plan_order_dispense_projection(
      new, coalesce(new.updated_at, now())
    );
  return new;
end;
$function$;

drop trigger if exists orders_plan_order_dispense_projection_trg
  on public.orders;
create trigger orders_plan_order_dispense_projection_trg
before insert or update of detail_inputs, applied_snapshot, encounter_id
on public.orders
for each row execute function private.clair_refresh_plan_order_dispense_projection();

update public.orders orders
set calculation_outputs = private.clair_compute_plan_order_dispense_projection(
  orders, now()
)
where orders.order_confirmation_status in ('draft','pending')
  and orders.status <> 'cancelled';

create or replace function private.clair_user_has_workspace_permission(
  p_workspace_id text,
  p_user_id uuid,
  p_permission_id text
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $function$
  with active_membership as (
    select membership.id, membership.roles
    from public.user_memberships membership
    join public.users app_user on app_user.id = membership.user_id
    where membership.workspace_id = p_workspace_id
      and membership.user_id = p_user_id
      and membership.status = 'active'
      and app_user.status = 'active'
  )
  select exists (
    select 1
    from active_membership membership
    where exists (
      select 1
      from public.workspace_membership_permission_role_assignments assignment
      join public.workspace_permission_roles role
        on role.workspace_id = assignment.workspace_id
       and role.id = assignment.permission_role_id
      where assignment.workspace_id = p_workspace_id
        and assignment.membership_id = membership.id
        and role.status = 'active'
        and (
          coalesce(role.permissions -> 'allowed', '[]'::jsonb) ? '*'
          or coalesce(role.permissions -> 'allowed', '[]'::jsonb) ? p_permission_id
        )
    ) or (
      not exists (
        select 1
        from public.workspace_membership_permission_role_assignments assignment
        where assignment.workspace_id = p_workspace_id
          and assignment.membership_id = membership.id
      ) and (
        membership.roles @> array['hospital_admin']::text[]
        or exists (
          select 1
          from public.permission_policies policy
          where policy.workspace_id = p_workspace_id
            and (
              (policy.scope = 'role' and policy.target_role = any(membership.roles))
              or (policy.scope = 'user' and policy.target_user_id = p_user_id)
            )
            and (
              coalesce(policy.permissions -> 'allowed', '[]'::jsonb) ? '*'
              or coalesce(policy.permissions -> 'allowed', '[]'::jsonb) ? p_permission_id
            )
        )
      )
    )
  );
$function$;

revoke all on function private.clair_user_has_workspace_permission(text,uuid,text)
  from public, anon, authenticated, service_role;

create or replace function public.clair_list_order_intended_assignees(
  p_workspace_id text,
  p_order_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_order public.orders%rowtype;
  v_permission text;
begin
  if auth.uid() is null
    or not private.clair_is_active_workspace_member(p_workspace_id)
    or not private.clair_current_user_has_workspace_permission(
      p_workspace_id, 'chart:update'
    )
  then raise exception 'permission_missing' using errcode = '42501'; end if;
  select orders.* into v_order
  from public.orders orders
  where orders.workspace_id = p_workspace_id and orders.id = p_order_id;
  if not found or v_order.destination_module is null
    or v_order.order_confirmation_status not in ('draft','pending')
  then raise exception 'order_unavailable'; end if;
  v_permission := private.clair_queue_permission_for_destination(
    v_order.destination_module, 'mutate'
  );
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'userId', app_user.id,
      'displayName', app_user.display_name,
      'department', membership.department,
      'title', membership.title
    ) order by app_user.display_name, app_user.id)
    from public.user_memberships membership
    join public.users app_user on app_user.id = membership.user_id
    where membership.workspace_id = p_workspace_id
      and membership.status = 'active'
      and app_user.status = 'active'
      and private.clair_user_has_workspace_permission(
        p_workspace_id, app_user.id, v_permission
      )
  ), '[]'::jsonb);
end;
$function$;

create or replace function public.clair_save_order_intended_assignee(
  p_workspace_id text,
  p_actor_user_id uuid,
  p_order_id uuid,
  p_expected_order_updated_at timestamptz,
  p_intended_assignee_user_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $function$
declare
  v_order public.orders%rowtype;
  v_command public.order_intended_assignee_commands%rowtype;
  v_key text := btrim(coalesce(p_idempotency_key, ''));
  v_hash text;
  v_permission text;
  v_result jsonb;
  v_now timestamptz := now();
  v_actor_membership_id uuid;
  v_previous_assignee uuid;
begin
  if auth.uid() is null or p_actor_user_id is distinct from auth.uid()
    or not private.clair_is_active_workspace_member(p_workspace_id)
    or not private.clair_current_user_has_workspace_permission(
      p_workspace_id, 'chart:update'
    )
  then raise exception 'permission_missing' using errcode = '42501'; end if;
  if p_expected_order_updated_at is null
    or length(v_key) not between 8 and 160
  then raise exception 'invalid_intended_assignee_input'; end if;
  v_hash := encode(digest(jsonb_build_object(
    'actorUserId', p_actor_user_id,
    'orderId', p_order_id,
    'expectedOrderUpdatedAt', p_expected_order_updated_at,
    'intendedAssigneeUserId', p_intended_assignee_user_id
  )::text, 'sha256'), 'hex');
  perform pg_advisory_xact_lock(hashtextextended(
    'order_intended_assignee:' || p_workspace_id || ':' || v_key, 0
  ));
  select * into v_command
  from public.order_intended_assignee_commands command
  where command.workspace_id = p_workspace_id
    and command.idempotency_key = v_key;
  if found then
    if v_command.request_sha256 is distinct from v_hash
      or v_command.order_id is distinct from p_order_id
    then raise exception 'idempotency_conflict'; end if;
    if v_command.result is null then
      raise exception 'intended_assignee_command_in_progress';
    end if;
    return v_command.result;
  end if;

  select orders.* into v_order
  from public.orders orders
  where orders.workspace_id = p_workspace_id and orders.id = p_order_id
  for update;
  if not found or v_order.destination_module is null
    or v_order.order_confirmation_status not in ('draft','pending')
    or v_order.invoice_line_id is not null
  then raise exception 'order_unavailable'; end if;
  if v_order.updated_at is distinct from p_expected_order_updated_at then
    raise exception 'revision_conflict';
  end if;
  v_permission := private.clair_queue_permission_for_destination(
    v_order.destination_module, 'mutate'
  );
  if p_intended_assignee_user_id is not null
    and not private.clair_user_has_workspace_permission(
      p_workspace_id, p_intended_assignee_user_id, v_permission
    )
  then raise exception 'assignee_ineligible' using errcode = '42501'; end if;
  v_previous_assignee := v_order.current_assignee_user_id;

  insert into public.order_intended_assignee_commands (
    workspace_id, order_id, idempotency_key, request_sha256,
    expected_order_updated_at, intended_assignee_user_id,
    created_by_user_id, created_at
  ) values (
    p_workspace_id, p_order_id, v_key, v_hash,
    p_expected_order_updated_at, p_intended_assignee_user_id,
    p_actor_user_id, v_now
  ) returning * into v_command;

  update public.orders orders
  set current_assignee_user_id = p_intended_assignee_user_id,
      updated_at = v_now
  where orders.workspace_id = p_workspace_id and orders.id = p_order_id
  returning * into v_order;
  v_result := jsonb_build_object(
    'orderId', v_order.id,
    'intendedAssigneeUserId', v_order.current_assignee_user_id,
    'updatedAt', v_order.updated_at,
    'commandId', v_command.id
  );
  update public.order_intended_assignee_commands command
  set result = v_result
  where command.workspace_id = p_workspace_id and command.id = v_command.id;

  insert into public.order_events (
    workspace_id, order_id, event_type, performed_by_user_id, payload, created_at
  ) values (
    p_workspace_id, p_order_id, 'edited', p_actor_user_id,
    jsonb_build_object(
      'action', 'intended_assignee_changed',
      'previousAssigneeUserId', v_previous_assignee,
      'intendedAssigneeUserId', p_intended_assignee_user_id,
      'commandId', v_command.id
    ),
    v_now
  );
  select membership.id into v_actor_membership_id
  from public.user_memberships membership
  where membership.workspace_id = p_workspace_id
    and membership.user_id = p_actor_user_id
    and membership.status = 'active'
  order by membership.created_at
  limit 1;
  insert into public.audit_events (
    id, workspace_id, actor_user_id, actor_membership_id,
    event_type, target_type, target_id, encounter_id, request_id,
    before_snapshot, after_snapshot, metadata, occurred_at, created_at
  ) values (
    'order-intended-assignee-' || v_command.id::text,
    p_workspace_id, p_actor_user_id, v_actor_membership_id,
    'order.draft_changed', 'order', p_order_id::text,
    v_order.encounter_id, v_command.id::text,
    jsonb_build_object('intendedAssigneeUserId', v_previous_assignee),
    jsonb_build_object('intendedAssigneeUserId', p_intended_assignee_user_id),
    jsonb_build_object('source', 'order-intended-assignee-v1'),
    v_now, v_now
  );
  return v_result;
end;
$function$;

revoke all on function public.clair_list_order_intended_assignees(text,uuid)
  from public, anon, service_role;
revoke all on function public.clair_save_order_intended_assignee(
  text,uuid,uuid,timestamptz,uuid,text
) from public, anon, service_role;
grant execute on function public.clair_list_order_intended_assignees(text,uuid)
  to authenticated;
grant execute on function public.clair_save_order_intended_assignee(
  text,uuid,uuid,timestamptz,uuid,text
) to authenticated;

create or replace function public.clair_save_order_actual_dispense_override(
  p_workspace_id text,
  p_actor_user_id uuid,
  p_order_id uuid,
  p_expected_order_updated_at timestamptz,
  p_actual_quantity numeric,
  p_reason text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $function$
declare
  v_order public.orders%rowtype;
  v_existing public.order_actual_dispense_overrides%rowtype;
  v_override public.order_actual_dispense_overrides%rowtype;
  v_key text := btrim(coalesce(p_idempotency_key, ''));
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_hash text;
  v_outputs jsonb;
  v_policy jsonb;
  v_proposed numeric;
  v_previous numeric;
  v_increment numeric;
  v_minimum numeric;
  v_maximum numeric;
  v_tolerance numeric;
  v_reason_required boolean;
  v_version integer;
  v_now timestamptz := now();
  v_result jsonb;
  v_actor_membership_id uuid;
begin
  if auth.uid() is null or p_actor_user_id is distinct from auth.uid()
    or not private.clair_is_active_workspace_member(p_workspace_id)
    or not private.clair_current_user_has_workspace_permission(
      p_workspace_id, 'chart:update'
    )
  then raise exception 'permission_missing' using errcode = '42501'; end if;
  if p_expected_order_updated_at is null
    or p_actual_quantity is null or p_actual_quantity <= 0
    or length(v_key) not between 8 and 160
    or (v_reason is not null and length(v_reason) not between 3 and 500)
  then raise exception 'invalid_actual_dispense_input'; end if;

  v_hash := encode(digest(jsonb_build_object(
    'actorUserId', p_actor_user_id,
    'orderId', p_order_id,
    'expectedOrderUpdatedAt', p_expected_order_updated_at,
    'actualQuantity', p_actual_quantity,
    'reason', v_reason
  )::text, 'sha256'), 'hex');
  perform pg_advisory_xact_lock(hashtextextended(
    'order_actual_dispense:' || p_workspace_id || ':' || v_key, 0
  ));
  select * into v_existing
  from public.order_actual_dispense_overrides override_row
  where override_row.workspace_id = p_workspace_id
    and override_row.idempotency_key = v_key;
  if found then
    if v_existing.request_sha256 is distinct from v_hash
      or v_existing.order_id is distinct from p_order_id
    then raise exception 'idempotency_conflict'; end if;
    if v_existing.result is null then
      raise exception 'actual_dispense_command_in_progress';
    end if;
    return v_existing.result;
  end if;

  select orders.* into v_order
  from public.orders orders
  where orders.workspace_id = p_workspace_id and orders.id = p_order_id
  for update;
  if not found
    or v_order.order_confirmation_status not in ('draft','pending')
    or v_order.status = 'cancelled'
    or v_order.row_type not in ('individual','set_child')
  then raise exception 'order_unavailable'; end if;
  if v_order.updated_at is distinct from p_expected_order_updated_at then
    raise exception 'revision_conflict';
  end if;
  v_outputs := coalesce(v_order.calculation_outputs, '{}'::jsonb);
  if v_outputs ->> 'calculationStatus' <> 'ready'
    or v_outputs ->> 'dispenseApplicability' <> 'true'
    or jsonb_typeof(v_outputs -> 'proposedActualDispenseQuantity') <> 'number'
    or jsonb_typeof(v_outputs -> 'actualDispenseQuantity') <> 'number'
  then raise exception 'actual_dispense_calculation_unavailable'; end if;
  v_policy := v_outputs -> 'preparationPolicy';
  if jsonb_typeof(v_policy) <> 'object'
    or jsonb_typeof(v_policy -> 'increment') <> 'number'
  then raise exception 'actual_dispense_override_disabled'; end if;

  v_proposed := (v_outputs ->> 'proposedActualDispenseQuantity')::numeric;
  v_previous := (v_outputs ->> 'actualDispenseQuantity')::numeric;
  v_increment := (v_policy ->> 'increment')::numeric;
  v_minimum := case when jsonb_typeof(v_policy -> 'minimum') = 'number'
    then (v_policy ->> 'minimum')::numeric else null end;
  v_maximum := case when jsonb_typeof(v_policy -> 'maximum') = 'number'
    then (v_policy ->> 'maximum')::numeric else null end;
  v_tolerance := case when jsonb_typeof(v_policy -> 'noReasonTolerance') = 'number'
    then (v_policy ->> 'noReasonTolerance')::numeric else null end;
  if v_increment <= 0
    or abs(p_actual_quantity / v_increment - round(p_actual_quantity / v_increment))
      > 0.000000001
    or (v_minimum is not null and p_actual_quantity < v_minimum)
    or (v_maximum is not null and p_actual_quantity > v_maximum)
  then raise exception 'actual_dispense_out_of_policy'; end if;
  v_reason_required := p_actual_quantity is distinct from v_proposed
    and (v_tolerance is null or abs(p_actual_quantity - v_proposed) > v_tolerance);
  if v_reason_required and v_reason is null then
    raise exception 'actual_dispense_reason_required';
  end if;

  select coalesce(max(override_row.version_no), 0) + 1 into v_version
  from public.order_actual_dispense_overrides override_row
  where override_row.workspace_id = p_workspace_id
    and override_row.order_id = p_order_id;
  insert into public.order_actual_dispense_overrides (
    workspace_id, order_id, version_no, idempotency_key, request_sha256,
    expected_order_updated_at, proposed_quantity, previous_quantity,
    actual_quantity, actual_unit, reason, reason_required,
    created_by_user_id, created_at
  ) values (
    p_workspace_id, p_order_id, v_version, v_key, v_hash,
    p_expected_order_updated_at, v_proposed, v_previous,
    p_actual_quantity, v_outputs ->> 'actualDispenseUnit', v_reason,
    v_reason_required, p_actor_user_id, v_now
  ) returning * into v_override;

  v_outputs := v_outputs || jsonb_build_object(
    'actualDispenseQuantity', p_actual_quantity,
    'actualDispenseSource', case
      when p_actual_quantity is not distinct from v_proposed
        then 'preparation_policy'
      else 'manual_override' end,
    'actualDispenseOverride', case
      when p_actual_quantity is not distinct from v_proposed then null
      else jsonb_build_object(
        'versionNo', v_version,
        'overrideId', v_override.id,
        'reason', v_reason,
        'reasonRequired', v_reason_required,
        'createdByUserId', p_actor_user_id,
        'createdAt', v_now
      ) end,
    'requiresReconfirmation', false,
    'totalRequiredDispenseQuantity', case
      when jsonb_typeof(v_outputs -> 'totalOccurrences') = 'number'
        then p_actual_quantity * (v_outputs ->> 'totalOccurrences')::numeric
      else null end
  );
  update public.orders orders
  set calculation_outputs = v_outputs, updated_at = v_now
  where orders.workspace_id = p_workspace_id and orders.id = p_order_id
  returning * into v_order;
  v_result := jsonb_build_object(
    'overrideId', v_override.id,
    'versionNo', v_version,
    'orderId', p_order_id,
    'actualDispenseQuantity', p_actual_quantity,
    'actualDispenseUnit', v_outputs ->> 'actualDispenseUnit',
    'actualDispenseSource', v_outputs ->> 'actualDispenseSource',
    'actualDispenseOverride', v_outputs -> 'actualDispenseOverride',
    'requiresReconfirmation', false,
    'updatedAt', v_order.updated_at
  );
  update public.order_actual_dispense_overrides override_row
  set result = v_result
  where override_row.workspace_id = p_workspace_id
    and override_row.id = v_override.id;

  insert into public.order_events (
    workspace_id, order_id, event_type, performed_by_user_id, payload, created_at
  ) values (
    p_workspace_id, p_order_id, 'edited', p_actor_user_id,
    jsonb_build_object(
      'action', case when p_actual_quantity is not distinct from v_proposed
        then 'actual_dispense_reset' else 'actual_dispense_override' end,
      'overrideId', v_override.id,
      'versionNo', v_version,
      'previousQuantity', v_previous,
      'proposedQuantity', v_proposed,
      'actualQuantity', p_actual_quantity,
      'unit', v_outputs ->> 'actualDispenseUnit',
      'reason', v_reason,
      'reasonRequired', v_reason_required
    ),
    v_now
  );
  select membership.id into v_actor_membership_id
  from public.user_memberships membership
  where membership.workspace_id = p_workspace_id
    and membership.user_id = p_actor_user_id
    and membership.status = 'active'
  order by membership.created_at
  limit 1;
  insert into public.audit_events (
    id, workspace_id, actor_user_id, actor_membership_id,
    event_type, target_type, target_id, encounter_id, request_id,
    reason, before_snapshot, after_snapshot, metadata,
    occurred_at, created_at
  ) values (
    'order-actual-dispense-' || v_override.id::text,
    p_workspace_id, p_actor_user_id, v_actor_membership_id,
    'order.draft_changed', 'order', p_order_id::text,
    v_order.encounter_id, v_override.id::text, v_reason,
    jsonb_build_object('actualDispenseQuantity', v_previous),
    jsonb_build_object('actualDispenseQuantity', p_actual_quantity),
    jsonb_build_object(
      'source', 'order-actual-dispense-v1',
      'versionNo', v_version,
      'reasonRequired', v_reason_required,
      'idempotencyKey', v_key
    ),
    v_now, v_now
  );
  return v_result;
end;
$function$;

revoke all on function public.clair_save_order_actual_dispense_override(
  text,uuid,uuid,timestamptz,numeric,text,text
) from public, anon, service_role;
grant execute on function public.clair_save_order_actual_dispense_override(
  text,uuid,uuid,timestamptz,numeric,text,text
) to authenticated;

create or replace function private.clair_apply_intended_assignee_on_confirmation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_assignee uuid;
  v_permission text;
begin
  select orders.current_assignee_user_id into v_assignee
  from public.orders orders
  where orders.workspace_id = new.workspace_id and orders.id = new.order_id;
  if v_assignee is null then return new; end if;
  v_permission := private.clair_queue_permission_for_destination(
    coalesce(new.destination_module, new.queue_type), 'mutate'
  );
  if not private.clair_user_has_workspace_permission(
    new.workspace_id, v_assignee, v_permission
  ) then raise exception 'assignee_ineligible' using errcode = '42501'; end if;

  new.assigned_to_user_id := v_assignee;
  new.assigned_by_user_id := new.requested_by_user_id;
  new.assigned_at := new.created_at;
  update public.order_tasks task
  set assigned_to_user_id = v_assignee,
      assigned_by_user_id = new.requested_by_user_id,
      assigned_at = new.created_at,
      updated_at = greatest(task.updated_at, new.created_at)
  where task.workspace_id = new.workspace_id
    and task.id = new.task_id
    and task.attempt_no = new.task_attempt_no;
  insert into public.order_task_events (
    workspace_id, task_id, task_attempt_no, order_id, event_type,
    actor_user_id, before_values, after_values, created_at
  ) values (
    new.workspace_id, new.task_id, new.task_attempt_no, new.order_id,
    'assigned', new.requested_by_user_id,
    jsonb_build_object('assignedToUserId', null),
    jsonb_build_object(
      'assignedToUserId', v_assignee,
      'source', 'confirmed_intended_assignee'
    ),
    new.created_at
  );
  return new;
end;
$function$;

drop trigger if exists order_fulfillment_apply_intended_assignee_trg
  on public.order_fulfillment_work_items;
create trigger order_fulfillment_apply_intended_assignee_trg
before insert on public.order_fulfillment_work_items
for each row execute function private.clair_apply_intended_assignee_on_confirmation();

create or replace function private.clair_fulfillment_phase_allowed(
  p_clinical_order_type text,
  p_phase text
)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $function$
  select p_phase is null or case p_clinical_order_type
    when 'clinical_lab' then p_phase in ('inputting','partial_complete')
    when 'imaging' then p_phase in (
      'acquisition_preparing','acquisition_completed',
      'interpretation_in_progress','interpretation_completed'
    )
    when 'dispensing' then p_phase = 'dispensing'
    when 'treatment' then p_phase = 'treatment'
    when 'hospitalization' then p_phase = 'treatment'
    else false
  end;
$function$;

revoke all on function private.clair_fulfillment_phase_allowed(text,text)
  from public, anon, authenticated, service_role;

create or replace function public.clair_save_chart_order_prebilling_override(
  p_workspace_id text,
  p_actor_user_id uuid,
  p_encounter_id uuid,
  p_order_id uuid,
  p_expected_version integer,
  p_idempotency_key text,
  p_override jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $function$
declare
  v_candidate public.order_billing_candidates%rowtype;
  v_order public.orders%rowtype;
  v_previous public.order_prebilling_overrides%rowtype;
  v_existing public.order_prebilling_overrides%rowtype;
  v_version integer;
  v_hash text;
  v_billing_name text;
  v_reflection boolean;
  v_quantity numeric;
  v_source text;
  v_amount bigint;
  v_percent numeric;
  v_reason text;
  v_base_amount bigint;
  v_charge_amount bigint;
  v_actor_membership_id uuid;
  v_before jsonb;
  v_after jsonb;
  v_now timestamptz := now();
begin
  if auth.uid() is null or p_actor_user_id is distinct from auth.uid() then
    raise exception 'actor_mismatch' using errcode = '42501';
  end if;
  if not private.clair_is_active_workspace_member(p_workspace_id)
    or not private.clair_current_user_has_workspace_permission(p_workspace_id, 'chart:update')
    or not private.clair_current_user_has_workspace_permission(p_workspace_id, 'billing:issue')
  then raise exception 'permission_missing' using errcode = '42501'; end if;
  if p_expected_version is null or p_expected_version < 0
    or length(btrim(coalesce(p_idempotency_key, ''))) not between 8 and 160
    or jsonb_typeof(p_override) <> 'object'
  then raise exception 'invalid_prebilling_override'; end if;
  if exists (
    select 1 from jsonb_object_keys(p_override) key
    where key not in (
      'billingName','billingReflectionEnabled','billingQuantity',
      'adjustmentSource','adjustmentAmountKrw','adjustmentPercent','adjustmentReason'
    )
  ) then raise exception 'unknown_prebilling_override_field'; end if;

  v_hash := encode(digest(jsonb_build_object(
    'actorUserId', p_actor_user_id,
    'encounterId', p_encounter_id,
    'orderId', p_order_id,
    'expectedVersion', p_expected_version,
    'override', p_override
  )::text, 'sha256'), 'hex');

  perform pg_advisory_xact_lock(hashtextextended(
    'order_prebilling_override:' || p_workspace_id || ':' || p_order_id::text,
    0
  ));
  select * into v_existing
  from public.order_prebilling_overrides override_row
  where override_row.workspace_id = p_workspace_id
    and override_row.idempotency_key = btrim(p_idempotency_key);
  if found then
    if v_existing.request_sha256 is distinct from v_hash then
      raise exception 'idempotency_conflict';
    end if;
    return jsonb_build_object(
      'orderId', v_existing.order_id,
      'versionNo', v_existing.version_no,
      'billingName', v_existing.billing_name,
      'billingReflectionEnabled', v_existing.billing_reflection_enabled,
      'billingQuantity', v_existing.billing_quantity,
      'adjustmentSource', v_existing.adjustment_source,
      'adjustmentAmountKrw', v_existing.adjustment_amount_krw,
      'adjustmentPercent', v_existing.adjustment_percent,
      'adjustmentReason', v_existing.adjustment_reason,
      'baseAmountKrw', round((
        select candidate.unit_price * v_existing.billing_quantity
        from public.order_billing_candidates candidate
        where candidate.workspace_id = p_workspace_id
          and candidate.order_id = p_order_id
      ))::bigint,
      'chargeAmountKrw', (
        select amount from public.order_billing_candidates candidate
        where candidate.workspace_id = p_workspace_id
          and candidate.order_id = p_order_id
      )
    );
  end if;

  select * into v_order
  from public.orders orders
  where orders.workspace_id = p_workspace_id
    and orders.encounter_id = p_encounter_id
    and orders.id = p_order_id
  for update;
  if not found or v_order.status = 'cancelled'
    or v_order.order_confirmation_status <> 'confirmed'
    or v_order.invoice_line_id is not null
  then raise exception 'order_unavailable'; end if;

  select * into v_candidate
  from public.order_billing_candidates candidate
  where candidate.workspace_id = p_workspace_id
    and candidate.encounter_id = p_encounter_id
    and candidate.order_id = p_order_id
  for update;
  if not found or v_candidate.status <> 'candidate_created' then
    raise exception 'billing_candidate_unavailable';
  end if;

  select * into v_previous
  from public.order_prebilling_overrides override_row
  where override_row.workspace_id = p_workspace_id
    and override_row.order_id = p_order_id
  order by override_row.version_no desc
  limit 1;
  v_version := case when found then v_previous.version_no else 0 end;
  if v_version is distinct from p_expected_version then
    raise exception 'revision_conflict';
  end if;

  if p_override ? 'billingName'
    and jsonb_typeof(p_override->'billingName') <> 'string'
  then raise exception 'billing_name_invalid'; end if;
  if p_override ? 'billingReflectionEnabled'
    and jsonb_typeof(p_override->'billingReflectionEnabled') <> 'boolean'
  then raise exception 'billing_reflection_invalid'; end if;
  if p_override ? 'billingQuantity'
    and jsonb_typeof(p_override->'billingQuantity') <> 'number'
  then raise exception 'billing_quantity_invalid'; end if;

  v_billing_name := btrim(case when p_override ? 'billingName'
    then p_override->>'billingName'
    when v_version > 0 then v_previous.billing_name
    else v_candidate.billing_name_snapshot end);
  v_reflection := case when p_override ? 'billingReflectionEnabled'
    then (p_override->>'billingReflectionEnabled')::boolean
    when v_version > 0 then v_previous.billing_reflection_enabled
    else v_order.billing_reflection_enabled end;
  v_quantity := case when p_override ? 'billingQuantity'
    then (p_override->>'billingQuantity')::numeric
    when v_version > 0 then v_previous.billing_quantity
    else v_candidate.quantity end;
  v_source := case when p_override ? 'adjustmentSource'
    then nullif(p_override->>'adjustmentSource', '')
    when v_version > 0 then v_previous.adjustment_source
    else null end;
  v_reason := nullif(btrim(case when p_override ? 'adjustmentReason'
    then coalesce(p_override->>'adjustmentReason', '')
    when v_version > 0 then coalesce(v_previous.adjustment_reason, '')
    else '' end), '');

  if v_billing_name = '' or v_quantity <= 0
    or v_source is not null and v_source not in ('amount','percent')
  then raise exception 'invalid_prebilling_override'; end if;
  v_base_amount := round(v_candidate.unit_price * v_quantity)::bigint;
  if v_source = 'amount' then
    if coalesce(jsonb_typeof(p_override->'adjustmentAmountKrw'), 'null') <> 'number'
      and not (v_version > 0 and not (p_override ? 'adjustmentSource'))
    then raise exception 'adjustment_amount_required'; end if;
    v_amount := case when p_override ? 'adjustmentAmountKrw'
      then (p_override->>'adjustmentAmountKrw')::bigint
      else v_previous.adjustment_amount_krw end;
    v_percent := case when v_base_amount = 0 then 0
      else (v_amount::numeric / v_base_amount::numeric) * 100 end;
  elsif v_source = 'percent' then
    if coalesce(jsonb_typeof(p_override->'adjustmentPercent'), 'null') <> 'number'
      and not (v_version > 0 and not (p_override ? 'adjustmentSource'))
    then raise exception 'adjustment_percent_required'; end if;
    v_percent := case when p_override ? 'adjustmentPercent'
      then (p_override->>'adjustmentPercent')::numeric
      else v_previous.adjustment_percent end;
    v_amount := round((v_base_amount::numeric * v_percent) / 100)::bigint;
  else
    v_source := null;
    v_amount := 0;
    v_percent := 0;
  end if;
  v_charge_amount := v_base_amount + v_amount;
  if v_charge_amount < 0 then raise exception 'negative_charge'; end if;
  if v_amount <> 0 and v_reason is null then raise exception 'adjustment_reason_required'; end if;
  if v_amount <> 0 and not exists (
    select 1
    from public.workspace_order_billing_policies policy
    cross join lateral jsonb_array_elements_text(policy.adjustment_reasons) allowed(reason)
    where policy.workspace_id = p_workspace_id
      and allowed.reason = v_reason
  ) then raise exception 'adjustment_reason_not_allowed'; end if;

  v_before := jsonb_build_object(
    'billingName', v_candidate.billing_name_snapshot,
    'billingReflectionEnabled', v_order.billing_reflection_enabled,
    'billingQuantity', v_candidate.quantity,
    'adjustmentSource', case when v_version > 0 then v_previous.adjustment_source else null end,
    'adjustmentAmountKrw', case when v_version > 0 then v_previous.adjustment_amount_krw else 0 end,
    'adjustmentPercent', case when v_version > 0 then v_previous.adjustment_percent else 0 end,
    'adjustmentReason', case when v_version > 0 then v_previous.adjustment_reason else null end,
    'baseAmountKrw', round(v_candidate.unit_price * v_candidate.quantity)::bigint,
    'chargeAmountKrw', v_candidate.amount,
    'versionNo', v_version
  );
  v_after := jsonb_build_object(
    'billingName', v_billing_name,
    'billingReflectionEnabled', v_reflection,
    'billingQuantity', v_quantity,
    'adjustmentSource', v_source,
    'adjustmentAmountKrw', v_amount,
    'adjustmentPercent', v_percent,
    'adjustmentReason', v_reason,
    'baseAmountKrw', v_base_amount,
    'chargeAmountKrw', v_charge_amount,
    'versionNo', v_version + 1
  );

  insert into public.order_prebilling_overrides (
    workspace_id, encounter_id, order_id, version_no, idempotency_key,
    request_sha256, billing_name, billing_reflection_enabled,
    billing_quantity, adjustment_source, adjustment_amount_krw,
    adjustment_percent, adjustment_reason, created_by_user_id
  ) values (
    p_workspace_id, p_encounter_id, p_order_id, v_version + 1,
    btrim(p_idempotency_key), v_hash, v_billing_name, v_reflection,
    v_quantity, v_source, v_amount, v_percent, v_reason, p_actor_user_id
  ) returning * into v_previous;

  update public.orders orders
  set billing_reflection_enabled = v_reflection, updated_at = v_now
  where orders.workspace_id = p_workspace_id and orders.id = p_order_id;

  update public.order_billing_candidates candidate
  set
    billing_name_snapshot = v_billing_name,
    quantity = v_quantity,
    amount = v_charge_amount,
    source_snapshot = candidate.source_snapshot || jsonb_build_object(
      'preBillingOverride', jsonb_build_object(
        'versionNo', v_version + 1,
        'billingName', v_billing_name,
        'billingReflectionEnabled', v_reflection,
        'billingQuantity', v_quantity,
        'adjustmentSource', v_source,
        'adjustmentAmountKrw', v_amount,
        'adjustmentPercent', v_percent,
        'adjustmentReason', v_reason
      )
    ),
    updated_at = v_now
  where candidate.workspace_id = p_workspace_id and candidate.order_id = p_order_id;

  insert into public.order_events (
    workspace_id, order_id, event_type, performed_by_user_id, payload, created_at
  ) values (
    p_workspace_id, p_order_id, 'edited', p_actor_user_id,
    jsonb_build_object(
      'action','prebilling_override_saved','versionNo',v_version + 1,
      'previousVersionNo',v_version,'idempotencyKey',btrim(p_idempotency_key)
    ),
    v_now
  );

  select membership.id into v_actor_membership_id
  from public.user_memberships membership
  where membership.workspace_id = p_workspace_id
    and membership.user_id = p_actor_user_id
    and membership.status = 'active'
  order by membership.created_at
  limit 1;

  insert into public.audit_events (
    id, workspace_id, actor_user_id, actor_membership_id,
    event_type, target_type, target_id, encounter_id, request_id,
    reason, before_snapshot, after_snapshot, metadata,
    occurred_at, created_at
  ) values (
    'order-prebilling-override-' || v_previous.id::text,
    p_workspace_id, p_actor_user_id, v_actor_membership_id,
    'order.draft_changed', 'order', p_order_id::text,
    p_encounter_id, v_previous.id::text, v_reason,
    v_before, v_after,
    jsonb_build_object(
      'source', 'order-prebilling-override-v1',
      'versionNo', v_version + 1,
      'idempotencyKey', btrim(p_idempotency_key)
    ),
    v_now, v_now
  );

  return jsonb_build_object(
    'orderId', p_order_id,
    'versionNo', v_version + 1,
    'billingName', v_billing_name,
    'billingReflectionEnabled', v_reflection,
    'billingQuantity', v_quantity,
    'adjustmentSource', v_source,
    'adjustmentAmountKrw', v_amount,
    'adjustmentPercent', v_percent,
    'adjustmentReason', v_reason,
    'baseAmountKrw', v_base_amount,
    'chargeAmountKrw', v_charge_amount
  );
end;
$function$;

revoke all on function public.clair_save_chart_order_prebilling_override(
  text,uuid,uuid,uuid,integer,text,jsonb
) from public, anon, service_role;
grant execute on function public.clair_save_chart_order_prebilling_override(
  text,uuid,uuid,uuid,integer,text,jsonb
) to authenticated;

create or replace function public.clair_update_workspace_order_billing_policy(
  p_workspace_id text,
  p_actor_user_id uuid,
  p_vat_calculation_policy text,
  p_adjustment_reasons jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
begin
  if auth.uid() is null or p_actor_user_id is distinct from auth.uid()
    or not private.clair_is_active_workspace_member(p_workspace_id)
    or not private.clair_current_user_has_workspace_permission(
      p_workspace_id, 'hospital_settings:manage'
    )
  then raise exception 'permission_missing' using errcode = '42501'; end if;
  if p_vat_calculation_policy not in ('vat_included','vat_added')
    or jsonb_typeof(p_adjustment_reasons) <> 'array'
    or exists (
      select 1 from jsonb_array_elements(p_adjustment_reasons) reason
      where jsonb_typeof(reason) <> 'string'
        or length(btrim(reason #>> '{}')) not between 1 and 80
    )
  then raise exception 'billing_policy_invalid'; end if;

  insert into public.workspace_order_billing_policies (
    workspace_id, vat_calculation_policy, adjustment_reasons,
    updated_by_user_id, updated_at
  ) values (
    p_workspace_id, p_vat_calculation_policy, p_adjustment_reasons,
    p_actor_user_id, now()
  ) on conflict (workspace_id) do update set
    vat_calculation_policy = excluded.vat_calculation_policy,
    adjustment_reasons = excluded.adjustment_reasons,
    updated_by_user_id = excluded.updated_by_user_id,
    updated_at = excluded.updated_at;

  return jsonb_build_object(
    'workspaceId', p_workspace_id,
    'vatCalculationPolicy', p_vat_calculation_policy,
    'adjustmentReasons', p_adjustment_reasons
  );
end;
$function$;

revoke all on function public.clair_update_workspace_order_billing_policy(
  text,uuid,text,jsonb
) from public, anon, service_role;
grant execute on function public.clair_update_workspace_order_billing_policy(
  text,uuid,text,jsonb
) to authenticated;

create or replace function private.clair_fulfillment_transition_allowed(
  p_current_status text,
  p_next_status text
)
returns boolean
language sql
stable
set search_path = pg_catalog
as $function$
  select p_current_status = p_next_status
    or (p_current_status = 'requested' and p_next_status in ('in_progress','returned','cancelled'))
    or (p_current_status = 'in_progress' and p_next_status in ('paused','completed','returned','cancelled'))
    or (p_current_status = 'paused' and p_next_status in ('in_progress','returned','cancelled'));
$function$;

create or replace function private.clair_calculate_aggregate_task_status(
  p_workspace_id text,
  p_aggregate_task_id uuid
)
returns text
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_role text;
  v_total integer;
  v_cancelled integer;
  v_complete integer;
  v_requested integer;
  v_in_progress integer;
  v_paused integer;
  v_returned integer;
  v_terminal integer;
begin
  select task.task_role into v_role
  from public.order_tasks task
  where task.workspace_id = p_workspace_id and task.id = p_aggregate_task_id;
  if v_role is distinct from 'aggregate' then raise exception 'aggregate_task_unavailable'; end if;

  select count(*),
    count(*) filter (where child.status = 'cancelled'),
    count(*) filter (where child.status = 'complete'),
    count(*) filter (where child.status = 'pending'),
    count(*) filter (where child.status = 'in_progress'),
    count(*) filter (where child.status = 'paused'),
    count(*) filter (where child.status = 'returned'),
    count(*) filter (where child.status in ('complete','cancelled'))
  into v_total, v_cancelled, v_complete, v_requested, v_in_progress,
    v_paused, v_returned, v_terminal
  from public.order_tasks child
  where child.workspace_id = p_workspace_id
    and child.parent_task_id = p_aggregate_task_id;

  if v_returned > 0 then return 'returned'; end if;
  if v_in_progress > 0 then return 'in_progress'; end if;
  if v_paused > 0 then return 'paused'; end if;
  if v_complete > 0 and v_terminal < v_total then return 'partial_complete'; end if;
  if v_total > 0 and v_cancelled = v_total then return 'cancelled'; end if;
  if v_total > 0 and v_complete = v_total then return 'complete'; end if;
  if v_total > 0 and v_requested + v_cancelled = v_total and v_requested > 0 then return 'pending'; end if;
  if v_total > 0 and v_terminal = v_total and v_complete > 0 then return 'partial_complete'; end if;
  return 'pending';
end;
$function$;

revoke all on function private.clair_calculate_aggregate_task_status(text,uuid)
  from public, anon, authenticated, service_role;

create or replace function public.clair_transition_fulfillment_work_item(
  p_workspace_id text,
  p_actor_user_id uuid,
  p_work_item_id uuid,
  p_action text,
  p_expected_revision bigint,
  p_command_id uuid,
  p_assigned_to_user_id uuid default null,
  p_detailed_phase text default null,
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
  v_existing public.order_task_events%rowtype;
  v_now timestamptz := now();
  v_permission text;
  v_next_status text;
  v_next_task_status text;
  v_next_assignee uuid;
  v_next_phase text;
  v_event_type text;
begin
  if auth.uid() is null or p_actor_user_id is distinct from auth.uid() then
    raise exception 'actor_mismatch' using errcode = '42501';
  end if;
  if p_command_id is null then raise exception 'command_id_required'; end if;
  if p_expected_revision is null or p_expected_revision < 1 then
    raise exception 'expected_revision_required';
  end if;
  if p_action not in (
    'assign','unassign','claim','start','phase','pause','resume','handoff','complete','return'
  ) then raise exception 'invalid_action'; end if;
  if length(btrim(coalesce(p_reason, ''))) > 500 then raise exception 'reason_too_long'; end if;
  if p_action in ('handoff','return') and length(btrim(coalesce(p_reason, ''))) = 0 then
    raise exception 'reason_required';
  end if;
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing' using errcode = '42501';
  end if;

  select * into v_existing
  from public.order_task_events event
  where event.workspace_id = p_workspace_id
    and event.lifecycle_command_id = p_command_id;
  if found then
    if v_existing.after_values ->> 'workItemId' is distinct from p_work_item_id::text
      or v_existing.after_values ->> 'action' is distinct from p_action
    then raise exception 'idempotency_conflict'; end if;
    select * into v_item
    from public.order_fulfillment_work_items item
    where item.workspace_id = p_workspace_id and item.id = p_work_item_id;
    return public.clair_list_fulfillment_work_items(
      p_workspace_id, v_item.queue_type, v_item.encounter_id, v_item.order_id, null
    );
  end if;

  select * into v_item
  from public.order_fulfillment_work_items item
  where item.workspace_id = p_workspace_id and item.id = p_work_item_id
  for update;
  if not found then raise exception 'work_item_unavailable'; end if;
  if v_item.task_id is null then raise exception 'legacy_work_item_unavailable'; end if;
  if v_item.row_revision is distinct from p_expected_revision then
    raise exception 'revision_conflict';
  end if;

  v_permission := private.clair_queue_permission_for_destination(
    coalesce(v_item.destination_module, v_item.queue_type), 'mutate'
  );
  if not private.clair_current_user_has_workspace_permission(p_workspace_id, v_permission) then
    raise exception 'permission_missing' using errcode = '42501';
  end if;

  select * into v_task
  from public.order_tasks task
  where task.workspace_id = p_workspace_id
    and task.id = v_item.task_id
    and task.attempt_no = v_item.task_attempt_no
  for update;
  if not found then raise exception 'queue_projection_task_mismatch'; end if;
  if v_task.status in ('complete','returned','cancelled')
    or v_item.status in ('completed','returned','cancelled')
  then raise exception 'terminal_work_item_immutable'; end if;

  v_next_status := v_item.status;
  v_next_assignee := v_item.assigned_to_user_id;
  v_next_phase := v_item.detailed_phase;

  if p_action = 'assign' then
    if v_item.status <> 'requested' or p_assigned_to_user_id is null then raise exception 'invalid_transition'; end if;
    v_next_assignee := p_assigned_to_user_id;
    v_event_type := 'assigned';
  elsif p_action = 'unassign' then
    if v_item.status <> 'requested' then raise exception 'invalid_transition'; end if;
    v_next_assignee := null;
    v_event_type := 'assigned';
  elsif p_action = 'claim' then
    if v_item.status <> 'requested' then raise exception 'invalid_transition'; end if;
    v_next_assignee := p_actor_user_id;
    v_event_type := 'assigned';
  elsif p_action = 'start' then
    if v_item.status <> 'requested' then raise exception 'invalid_transition'; end if;
    v_next_status := 'in_progress';
    v_next_assignee := coalesce(v_item.assigned_to_user_id, p_actor_user_id);
    v_next_phase := p_detailed_phase;
    v_event_type := 'started';
  elsif p_action = 'phase' then
    if v_item.status <> 'in_progress' or p_detailed_phase is null then raise exception 'invalid_transition'; end if;
    v_next_phase := p_detailed_phase;
    v_event_type := 'phase_changed';
  elsif p_action = 'pause' then
    if v_item.status <> 'in_progress' then raise exception 'invalid_transition'; end if;
    v_next_status := 'paused';
    v_event_type := 'paused';
  elsif p_action = 'resume' then
    if v_item.status <> 'paused' then raise exception 'invalid_transition'; end if;
    v_next_status := 'in_progress';
    v_next_phase := coalesce(p_detailed_phase, v_item.paused_from_phase);
    v_event_type := 'resumed';
  elsif p_action = 'handoff' then
    if v_item.status not in ('in_progress','paused') or p_assigned_to_user_id is null then
      raise exception 'invalid_transition';
    end if;
    v_next_assignee := p_assigned_to_user_id;
    v_event_type := 'handed_off';
  elsif p_action = 'complete' then
    if v_item.status <> 'in_progress' then raise exception 'invalid_transition'; end if;
    v_next_status := 'completed';
    v_next_phase := case when v_item.clinical_order_type = 'imaging'
      then 'interpretation_completed' else v_item.detailed_phase end;
    v_event_type := 'completed';
  else
    if v_item.status not in ('requested','in_progress','paused') then raise exception 'invalid_transition'; end if;
    v_next_status := 'returned';
    v_event_type := 'returned';
  end if;

  if v_next_assignee is not null and not private.clair_user_has_workspace_permission(
    p_workspace_id, v_next_assignee, v_permission
  ) then raise exception 'assignee_ineligible' using errcode = '42501'; end if;
  if not private.clair_fulfillment_phase_allowed(v_item.clinical_order_type, v_next_phase) then
    raise exception 'invalid_detailed_phase';
  end if;

  v_next_task_status := case v_next_status
    when 'requested' then 'pending'
    when 'completed' then 'complete'
    else v_next_status
  end;

  update public.order_tasks task
  set
    status = v_next_task_status,
    assigned_to_user_id = v_next_assignee,
    assigned_by_user_id = case when v_next_assignee is null then null
      when v_next_assignee is distinct from task.assigned_to_user_id
      then p_actor_user_id else task.assigned_by_user_id end,
    assigned_at = case when v_next_assignee is null then null
      when v_next_assignee is distinct from task.assigned_to_user_id
      then v_now else task.assigned_at end,
    started_by_user_id = case when p_action = 'start'
      then p_actor_user_id else task.started_by_user_id end,
    started_at = case when p_action = 'start'
      then v_now else task.started_at end,
    completed_at = case when p_action = 'complete' then v_now else task.completed_at end,
    returned_at = case when p_action = 'return' then v_now else task.returned_at end,
    detailed_phase = v_next_phase,
    paused_from_phase = case when p_action = 'pause' then task.detailed_phase
      when p_action = 'resume' then null else task.paused_from_phase end,
    result_snapshot = case when p_action = 'complete' then coalesce(
      task.result_snapshot,
      jsonb_build_object('source','queue_projection','workItemId',p_work_item_id,'completedAt',v_now)
    ) else task.result_snapshot end,
    row_revision = task.row_revision + 1,
    updated_at = v_now
  where task.workspace_id = p_workspace_id and task.id = v_task.id;

  update public.order_fulfillment_work_items item
  set
    status = v_next_status,
    assigned_to_user_id = v_next_assignee,
    assigned_by_user_id = case when v_next_assignee is null then null
      when v_next_assignee is distinct from item.assigned_to_user_id
      then p_actor_user_id else item.assigned_by_user_id end,
    assigned_at = case when v_next_assignee is null then null
      when v_next_assignee is distinct from item.assigned_to_user_id
      then v_now else item.assigned_at end,
    started_by_user_id = case when p_action = 'start'
      then p_actor_user_id else item.started_by_user_id end,
    started_at = case when p_action = 'start' then v_now else item.started_at end,
    completed_at = case when p_action = 'complete' then v_now else item.completed_at end,
    returned_at = case when p_action = 'return' then v_now else item.returned_at end,
    reason = case when p_action in ('handoff','return') then btrim(p_reason) else item.reason end,
    detailed_phase = v_next_phase,
    paused_from_phase = case when p_action = 'pause' then item.detailed_phase
      when p_action = 'resume' then null else item.paused_from_phase end,
    row_revision = item.row_revision + 1,
    updated_at = v_now
  where item.workspace_id = p_workspace_id and item.id = p_work_item_id;

  if p_action = 'return' then
    update public.order_billing_candidates candidate
    set status = 'billing_review_required', updated_at = v_now
    where candidate.workspace_id = p_workspace_id
      and candidate.order_id = v_item.order_id
      and candidate.status = 'candidate_created';

    update public.invoices invoice
    set
      billing_review_required = true,
      billing_review_reason = btrim(p_reason),
      updated_at = v_now
    from public.order_billing_candidates candidate
    where candidate.workspace_id = p_workspace_id
      and candidate.order_id = v_item.order_id
      and candidate.status = 'invoice_linked'
      and candidate.invoice_line_id is not null
      and invoice.workspace_id = candidate.workspace_id
      and invoice.id = (
        select line.invoice_id
        from public.invoice_lines line
        where line.workspace_id = candidate.workspace_id
          and line.id = candidate.invoice_line_id
      );
  end if;

  insert into public.order_task_events (
    workspace_id, task_id, task_attempt_no, order_id, event_type,
    actor_user_id, reason, before_values, after_values,
    lifecycle_command_id, created_at
  ) values (
    p_workspace_id, v_task.id, v_task.attempt_no, v_task.order_id, v_event_type,
    p_actor_user_id, nullif(btrim(p_reason), ''),
    jsonb_build_object(
      'workItemId', p_work_item_id, 'status', v_item.status,
      'assignedToUserId', v_item.assigned_to_user_id,
      'detailedPhase', v_item.detailed_phase, 'rowRevision', v_item.row_revision
    ),
    jsonb_build_object(
      'workItemId', p_work_item_id, 'action', p_action, 'status', v_next_status,
      'assignedToUserId', v_next_assignee, 'detailedPhase', v_next_phase,
      'rowRevision', v_item.row_revision + 1
    ),
    p_command_id, v_now
  );

  insert into public.order_events (
    workspace_id, order_id, event_type, performed_by_user_id, payload, created_at
  ) values (
    p_workspace_id, v_item.order_id,
    case when p_action = 'complete' then 'completed' else 'edited' end,
    p_actor_user_id,
    jsonb_build_object(
      'action','fulfillment_work_item_update','fulfillmentAction',p_action,
      'fulfillmentWorkItemId',p_work_item_id,'taskId',v_item.task_id,
      'taskAttemptNo',v_item.task_attempt_no,'previousStatus',v_item.status,
      'nextStatus',v_next_status,'previousAssigneeUserId',v_item.assigned_to_user_id,
      'nextAssigneeUserId',v_next_assignee,'reason',nullif(btrim(p_reason), ''),
      'commandId',p_command_id,'rowRevision',v_item.row_revision + 1
    ), v_now
  );

  if v_task.parent_task_id is not null then
    update public.order_tasks aggregate_task
    set status = private.clair_calculate_aggregate_task_status(
      p_workspace_id, v_task.parent_task_id
    ), row_revision = aggregate_task.row_revision + 1, updated_at = v_now
    where aggregate_task.workspace_id = p_workspace_id
      and aggregate_task.id = v_task.parent_task_id;
  end if;

  return public.clair_list_fulfillment_work_items(
    p_workspace_id, v_item.queue_type, v_item.encounter_id, v_item.order_id, null
  );
end;
$function$;

revoke all on function public.clair_transition_fulfillment_work_item(
  text,uuid,uuid,text,bigint,uuid,uuid,text,text
) from public, anon, service_role;
grant execute on function public.clair_transition_fulfillment_work_item(
  text,uuid,uuid,text,bigint,uuid,uuid,text,text
) to authenticated;

create or replace function public.clair_list_fulfillment_work_items(
  p_workspace_id text,
  p_queue_type text,
  p_encounter_id uuid default null,
  p_order_id uuid default null,
  p_status text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_rows jsonb;
begin
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing';
  end if;
  if p_queue_type not in (
    'consultation','lab','imaging','external_lab','dispensing',
    'treatment','hospitalization','other'
  ) then raise exception 'unsupported_order_type'; end if;
  if p_status is not null and p_status not in (
    'requested','in_progress','paused','completed','returned','cancelled'
  ) then raise exception 'invalid_status'; end if;
  if not private.clair_current_user_has_workspace_permission(
    p_workspace_id,
    private.clair_queue_permission_for_destination(p_queue_type, 'read')
  ) then raise exception 'permission_missing'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', item.id, 'workspaceId', item.workspace_id,
    'encounterId', item.encounter_id, 'orderId', item.order_id,
    'taskId', item.task_id, 'taskAttemptNo', item.task_attempt_no,
    'clinicalOrderType', item.clinical_order_type,
    'destinationModule', item.destination_module,
    'orderType', item.order_type, 'queueType', item.queue_type,
    'status', item.status, 'priority', item.priority,
    'requestedByUserId', item.requested_by_user_id,
    'assignedToUserId', item.assigned_to_user_id,
    'assignedByUserId', item.assigned_by_user_id,
    'assignedAt', item.assigned_at,
    'startedByUserId', item.started_by_user_id,
    'startedAt', item.started_at,
    'detailedPhase', item.detailed_phase,
    'pausedFromPhase', item.paused_from_phase,
    'requestCycle', item.request_cycle,
    'rowRevision', item.row_revision,
    'dueAt', item.due_at, 'completedAt', item.completed_at,
    'cancelledAt', item.cancelled_at, 'returnedAt', item.returned_at,
    'reason', item.reason, 'sourceSnapshot', item.source_snapshot,
    'createdAt', item.created_at, 'updatedAt', item.updated_at
  ) order by item.updated_at desc, item.id), '[]'::jsonb)
  into v_rows
  from public.order_fulfillment_work_items item
  where item.workspace_id = p_workspace_id
    and item.queue_type = p_queue_type
    and (p_encounter_id is null or item.encounter_id = p_encounter_id)
    and (p_order_id is null or item.order_id = p_order_id)
    and (p_status is null or item.status = p_status);
  return v_rows;
end;
$function$;

revoke all on function public.clair_list_fulfillment_work_items(text,text,uuid,uuid,text)
  from public, anon, service_role;
grant execute on function public.clair_list_fulfillment_work_items(text,text,uuid,uuid,text)
  to authenticated;

-- Disable the ambiguous status-only writer. New clients must state an action,
-- expected revision, and idempotency command. Keeping the signature produces a
-- fail-closed error for stale deployed clients instead of accepting `accepted`.
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
set search_path = pg_catalog
as $function$
begin
  raise exception 'explicit_fulfillment_action_required' using errcode = '0A000';
end;
$function$;

revoke all on function public.clair_update_fulfillment_work_item(text,uuid,uuid,text,uuid,text)
  from public, anon, service_role;
grant execute on function public.clair_update_fulfillment_work_item(text,uuid,uuid,text,uuid,text)
  to authenticated;

-- Recreate the chart mutation writer from its checked-in contract so a returned
-- attempt remains immutable and re-request creates attempt N+1. The new
-- request_cycle and row_revision fields are advanced with that transition.
create or replace function public.clair_mutate_chart_order_execution(
  p_workspace_id text,
  p_actor_user_id uuid,
  p_order_id uuid,
  p_action text,
  p_reason text,
  p_expected_revision_no integer,
  p_changes jsonb,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions, pg_temp
as $function$
declare
  v_now timestamptz := now();
  v_action text := btrim(coalesce(p_action, ''));
  v_reason text := btrim(coalesce(p_reason, ''));
  v_changes jsonb := coalesce(p_changes, '{}'::jsonb);
  v_idempotency_key text := btrim(coalesce(p_idempotency_key, ''));
  v_request_sha256 text;
  v_existing public.order_revisions%rowtype;
  v_revision public.order_revisions%rowtype;
  v_order public.orders%rowtype;
  v_task public.order_tasks%rowtype;
  v_old_task public.order_tasks%rowtype;
  v_new_task public.order_tasks%rowtype;
  v_old_aggregate public.order_tasks%rowtype;
  v_new_aggregate public.order_tasks%rowtype;
  v_child_order public.orders%rowtype;
  v_actor_membership_id uuid;
  v_next_revision integer;
  v_next_attempt integer;
  v_detail_inputs jsonb;
  v_detail_schema_version integer;
  v_priority text;
  v_calculation_outputs jsonb;
  v_confirmed_snapshot jsonb;
  v_actual_quantity numeric;
  v_proposed_quantity numeric;
  v_preparation_policy jsonb;
  v_actual_increment numeric;
  v_actual_minimum numeric;
  v_actual_maximum numeric;
  v_actual_tolerance numeric;
  v_actual_reason_required boolean;
  v_actual_override_version integer;
  v_actual_override_id uuid;
  v_affected_tasks jsonb := '[]'::jsonb;
  v_billing_impact jsonb := '{}'::jsonb;
  v_before jsonb;
  v_after jsonb;
  v_result jsonb;
  v_changed_count integer := 0;
begin
  if auth.uid() is null or p_actor_user_id is distinct from auth.uid() then
    raise exception 'actor_mismatch' using errcode = '42501';
  end if;
  if v_action not in (
    'amend','cancel','priority_change','re_request'
  )
    or jsonb_typeof(v_changes) <> 'object'
    or length(v_reason) not between 3 and 500
    or p_expected_revision_no is null
    or p_expected_revision_no < 0
    or length(v_idempotency_key) not between 8 and 160
  then
    raise exception 'invalid_execution_mutation_input';
  end if;
  if not private.clair_is_active_workspace_member(p_workspace_id)
    or not private.clair_current_user_has_workspace_permission(
      p_workspace_id, 'order:update'
    )
  then
    raise exception 'permission_missing' using errcode = '42501';
  end if;

  v_request_sha256 := encode(
    extensions.digest(
      jsonb_build_object(
        'workspaceId', p_workspace_id,
        'actorUserId', p_actor_user_id,
        'orderId', p_order_id,
        'action', v_action,
        'reason', v_reason,
        'expectedRevisionNo', p_expected_revision_no,
        'changes', v_changes
      )::text,
      'sha256'
    ),
    'hex'
  );

  perform pg_advisory_xact_lock(
    hashtextextended(
      'chart_order_execution_mutation:' || p_workspace_id || ':' ||
      v_idempotency_key,
      0
    )
  );

  select * into v_existing
  from public.order_revisions revision
  where revision.workspace_id = p_workspace_id
    and revision.idempotency_key = v_idempotency_key
  for update;
  if found then
    if v_existing.request_sha256 is distinct from v_request_sha256
      or v_existing.order_id is distinct from p_order_id
      or v_existing.expected_revision_no is distinct from p_expected_revision_no
    then
      raise exception 'idempotency_conflict';
    end if;
    if v_existing.result is not null then return v_existing.result; end if;
    raise exception 'execution_mutation_in_progress';
  end if;

  select * into v_order
  from public.orders orders
  where orders.workspace_id = p_workspace_id
    and orders.id = p_order_id
  for update;
  if not found
    or v_order.order_confirmation_status not in ('confirmed','billed')
    or v_order.status = 'cancelled'
  then
    raise exception 'order_unavailable';
  end if;
  if v_order.row_type = 'set_child' then
    raise exception 'set_child_independent_mutation_forbidden';
  end if;
  if v_order.revision_no is distinct from p_expected_revision_no then
    raise exception 'revision_conflict';
  end if;

  if v_action = 'cancel' and exists (
    select 1
    from public.orders target_order
    join public.order_billing_candidates candidate
      on candidate.workspace_id = target_order.workspace_id
     and candidate.order_id = target_order.id
    where target_order.workspace_id = p_workspace_id
      and (
        target_order.id = p_order_id
        or target_order.parent_chart_order_line_id = p_order_id
      )
      and (
        target_order.invoice_line_id is not null
        or candidate.invoice_line_id is not null
        or candidate.status = 'invoice_linked'
      )
  ) then raise exception 'billing_reversal_required'; end if;

  if v_action = 're_request' and exists (
    select 1
    from public.orders target_order
    join public.invoice_lines line
      on line.workspace_id = target_order.workspace_id
     and line.id = target_order.invoice_line_id
    join public.invoices invoice
      on invoice.workspace_id = line.workspace_id
     and invoice.id = line.invoice_id
    where target_order.workspace_id = p_workspace_id
      and (
        target_order.id = p_order_id
        or target_order.parent_chart_order_line_id = p_order_id
      )
      and invoice.billing_review_required
  ) then raise exception 'billing_review_required'; end if;
  if v_action = 're_request' and exists (
    select 1
    from public.orders target_order
    join public.order_billing_candidates candidate
      on candidate.workspace_id = target_order.workspace_id
     and candidate.order_id = target_order.id
    where target_order.workspace_id = p_workspace_id
      and (
        target_order.id = p_order_id
        or target_order.parent_chart_order_line_id = p_order_id
      )
      and candidate.status = 'billing_review_required'
  ) then raise exception 'billing_review_required'; end if;

  if v_action in ('amend','priority_change')
    and v_order.row_type <> 'individual'
  then
    raise exception 'aggregate_direct_mutation_forbidden';
  end if;

  v_next_revision := v_order.revision_no + 1;
  v_before := jsonb_build_object(
    'orderStatus', v_order.status,
    'confirmationStatus', v_order.order_confirmation_status,
    'revisionNo', v_order.revision_no,
    'detailInputs', v_order.detail_inputs,
    'detailSchemaVersion', v_order.detail_schema_version,
    'calculationOutputs', v_order.calculation_outputs,
    'priority', case when v_order.priority = 'urgent' then 'urgent' else 'normal' end,
    'confirmedSnapshot', v_order.confirmed_snapshot
  );

  insert into public.order_revisions(
    workspace_id, order_id, revision_no, reason, created_by_user_id,
    change_type, expected_revision_no, idempotency_key, request_sha256,
    before_values, after_values, affected_tasks, billing_impact,
    result, completed_at, created_at
  ) values (
    p_workspace_id, p_order_id, v_next_revision, v_reason, p_actor_user_id,
    case v_action
      when 'amend' then 'amendment'
      when 'cancel' then 'cancellation'
      when 'priority_change' then 'priority_change'
      else 're_request'
    end,
    p_expected_revision_no, v_idempotency_key, v_request_sha256,
    v_before, '{}'::jsonb, '[]'::jsonb, '{}'::jsonb,
    null, null, v_now
  ) returning * into v_revision;

  if v_action = 'amend' then
    if exists (
      select 1 from jsonb_object_keys(v_changes) field(key)
      where field.key not in ('detailInputs','detailSchemaVersion')
    ) then
      raise exception 'invalid_amendment_fields';
    end if;
    select * into v_task
    from public.order_tasks task
    where task.workspace_id = p_workspace_id
      and task.order_id = p_order_id
      and task.task_role = 'execution'
    order by task.attempt_no desc
    limit 1
    for update;
    if not found then raise exception 'task_unavailable'; end if;
    if v_task.status <> 'pending' then raise exception 'amendment_requires_pending'; end if;

    v_detail_inputs := coalesce(v_changes -> 'detailInputs', v_order.detail_inputs);
    v_detail_schema_version := coalesce(
      (v_changes ->> 'detailSchemaVersion')::integer,
      v_order.detail_schema_version
    );
    if not private.clair_order_detail_inputs_are_valid(
      v_order.clinical_order_type,
      v_detail_schema_version,
      v_detail_inputs,
      true
    ) then
      raise exception 'confirmation_detail_inputs_incomplete';
    end if;

    update public.orders orders
    set
      detail_inputs = v_detail_inputs,
      detail_schema_version = v_detail_schema_version,
      revision_no = v_next_revision,
      updated_at = v_now
    where orders.workspace_id = p_workspace_id and orders.id = p_order_id;

    update public.order_tasks task
    set
      effective_snapshot = task.effective_snapshot || jsonb_build_object(
        'detailInputs', v_detail_inputs,
        'detailSchemaVersion', v_detail_schema_version,
        'revisionNo', v_next_revision,
        'amendedAt', v_now
      ),
      updated_at = v_now
    where task.workspace_id = p_workspace_id and task.id = v_task.id
    returning * into v_new_task;

    update public.order_fulfillment_work_items item
    set source_snapshot = v_new_task.effective_snapshot, updated_at = v_now
    where item.workspace_id = p_workspace_id and item.task_id = v_task.id;

    insert into public.order_task_events(
      workspace_id, task_id, task_attempt_no, order_id, event_type,
      actor_user_id, reason, before_values, after_values, created_at
    ) values (
      p_workspace_id, v_task.id, v_task.attempt_no, p_order_id, 'amended',
      p_actor_user_id, v_reason,
      jsonb_build_object('effectiveSnapshot', v_task.effective_snapshot),
      jsonb_build_object(
        'effectiveSnapshot', v_new_task.effective_snapshot,
        'orderRevisionId', v_revision.id
      ),
      v_now
    );
    insert into public.order_revision_fields(
      workspace_id, order_revision_id, field_name, previous_value, current_value
    ) values
      (p_workspace_id, v_revision.id, 'detailInputs',
       v_order.detail_inputs, v_detail_inputs),
      (p_workspace_id, v_revision.id, 'detailSchemaVersion',
       to_jsonb(v_order.detail_schema_version), to_jsonb(v_detail_schema_version));
    v_affected_tasks := jsonb_build_array(jsonb_build_object(
      'taskId', v_task.id,
      'attemptNo', v_task.attempt_no,
      'effect', 'effective_snapshot_amended'
    ));

  elsif v_action = 'priority_change' then
    if exists (
      select 1 from jsonb_object_keys(v_changes) field(key)
      where field.key <> 'priority'
    ) then
      raise exception 'invalid_priority_fields';
    end if;
    v_priority := v_changes ->> 'priority';
    if v_priority not in ('normal','urgent')
      or v_priority = (
        case when v_order.priority = 'urgent' then 'urgent' else 'normal' end
      )
    then
      raise exception 'invalid_priority_change';
    end if;
    select * into v_task
    from public.order_tasks task
    where task.workspace_id = p_workspace_id
      and task.order_id = p_order_id
      and task.task_role = 'execution'
    order by task.attempt_no desc
    limit 1
    for update;
    if not found then raise exception 'task_unavailable'; end if;

    update public.orders orders
    set priority = v_priority, revision_no = v_next_revision, updated_at = v_now
    where orders.workspace_id = p_workspace_id and orders.id = p_order_id;

    if v_task.status not in ('complete','returned','cancelled') then
      update public.order_tasks task
      set
        priority = v_priority,
        effective_snapshot = task.effective_snapshot || jsonb_build_object(
          'priority', v_priority,
          'revisionNo', v_next_revision,
          'priorityChangedAt', v_now
        ),
        updated_at = v_now
      where task.workspace_id = p_workspace_id and task.id = v_task.id
      returning * into v_new_task;
      update public.order_fulfillment_work_items item
      set
        priority = v_priority,
        source_snapshot = v_new_task.effective_snapshot,
        updated_at = v_now
      where item.workspace_id = p_workspace_id and item.task_id = v_task.id;
    else
      v_new_task := v_task;
    end if;

    insert into public.order_task_events(
      workspace_id, task_id, task_attempt_no, order_id, event_type,
      actor_user_id, reason, before_values, after_values, created_at
    ) values (
      p_workspace_id, v_task.id, v_task.attempt_no, p_order_id,
      'priority_changed', p_actor_user_id, v_reason,
      jsonb_build_object('orderPriority', v_order.priority, 'taskPriority', v_task.priority),
      jsonb_build_object(
        'orderPriority', v_priority,
        'taskPriority', v_new_task.priority,
        'terminalTaskPreserved', v_task.status in ('complete','returned','cancelled'),
        'orderRevisionId', v_revision.id
      ),
      v_now
    );
    insert into public.order_revision_fields(
      workspace_id, order_revision_id, field_name, previous_value, current_value
    ) values (
      p_workspace_id, v_revision.id, 'priority',
      to_jsonb(v_order.priority), to_jsonb(v_priority)
    );
    v_affected_tasks := jsonb_build_array(jsonb_build_object(
      'taskId', v_task.id,
      'attemptNo', v_task.attempt_no,
      'effect', case when v_task.status in ('complete','returned','cancelled')
        then 'terminal_attempt_preserved' else 'priority_changed' end
    ));

  elsif v_action = 'cancel' then
    if v_changes <> '{}'::jsonb then raise exception 'invalid_cancellation_fields'; end if;
    for v_task in
      select task.*
      from public.order_tasks task
      join (
        select current_task.order_id, max(current_task.attempt_no) attempt_no
        from public.order_tasks current_task
        join public.orders target_order
          on target_order.workspace_id = current_task.workspace_id
         and target_order.id = current_task.order_id
        where current_task.workspace_id = p_workspace_id
          and (
            target_order.id = p_order_id
            or target_order.parent_chart_order_line_id = p_order_id
          )
        group by current_task.order_id
      ) latest
        on latest.order_id = task.order_id
       and latest.attempt_no = task.attempt_no
      where task.workspace_id = p_workspace_id
      order by
        case when task.task_role = 'execution' then 0 else 1 end,
        task.order_id
      for update of task
    loop
      v_old_task := v_task;
      if v_task.status not in ('complete','returned','cancelled') then
        update public.order_tasks current_task
        set status = 'cancelled', cancelled_at = v_now,
            row_revision = row_revision + 1, updated_at = v_now
        where current_task.workspace_id = p_workspace_id
          and current_task.id = v_task.id
        returning * into v_task;
        update public.order_fulfillment_work_items item
        set
          status = 'cancelled',
          cancelled_at = v_now,
          reason = v_reason,
          updated_at = v_now
        where item.workspace_id = p_workspace_id
          and item.task_id = v_old_task.id
          and item.status not in ('completed','cancelled');
      end if;
      insert into public.order_task_events(
        workspace_id, task_id, task_attempt_no, order_id, event_type,
        actor_user_id, reason, before_values, after_values, created_at
      ) values (
        p_workspace_id, v_old_task.id, v_old_task.attempt_no,
        v_old_task.order_id, 'cancelled', p_actor_user_id, v_reason,
        jsonb_build_object('status', v_old_task.status),
        jsonb_build_object(
          'status', v_task.status,
          'terminalAttemptPreserved', v_old_task.status in ('complete','returned','cancelled'),
          'orderRevisionId', v_revision.id
        ),
        v_now
      );
      v_affected_tasks := v_affected_tasks || jsonb_build_array(jsonb_build_object(
        'taskId', v_old_task.id,
        'attemptNo', v_old_task.attempt_no,
        'beforeStatus', v_old_task.status,
        'afterStatus', v_task.status
      ));
    end loop;

    update public.order_billing_candidates candidate
    set status = 'cancelled', updated_at = v_now
    from public.orders target_order
    where candidate.workspace_id = p_workspace_id
      and target_order.workspace_id = candidate.workspace_id
      and target_order.id = candidate.order_id
      and (
        target_order.id = p_order_id
        or target_order.parent_chart_order_line_id = p_order_id
      )
      and candidate.status in ('candidate_created','billing_review_required');
    get diagnostics v_changed_count = row_count;
    v_billing_impact := jsonb_build_object(
      'cancelledCandidateCount', v_changed_count,
      'invoiceLinkedCandidatesPreserved', (
        select count(*) from public.order_billing_candidates candidate
        join public.orders target_order
          on target_order.workspace_id = candidate.workspace_id
         and target_order.id = candidate.order_id
        where candidate.workspace_id = p_workspace_id
          and (
            target_order.id = p_order_id
            or target_order.parent_chart_order_line_id = p_order_id
          )
          and candidate.status = 'invoice_linked'
      )
    );

    update public.orders target_order
    set
      status = 'cancelled',
      order_confirmation_status = 'cancelled',
      cancellation_reason = v_reason,
      revision_no = case when target_order.id = p_order_id
        then v_next_revision else target_order.revision_no end,
      updated_at = v_now
    where target_order.workspace_id = p_workspace_id
      and (
        target_order.id = p_order_id
        or target_order.parent_chart_order_line_id = p_order_id
      );
    insert into public.order_revision_fields(
      workspace_id, order_revision_id, field_name, previous_value, current_value
    ) values (
      p_workspace_id, v_revision.id, 'orderConfirmationStatus',
      to_jsonb(v_order.order_confirmation_status), to_jsonb('cancelled'::text)
    );

  else
    if v_order.row_type = 'set' and v_changes <> '{}'::jsonb then
      raise exception 'invalid_set_re_request_fields';
    end if;
    if v_order.row_type = 'individual' and exists (
      select 1 from jsonb_object_keys(v_changes) field(key)
      where field.key not in (
        'detailInputs','detailSchemaVersion','priority',
        'actualDispenseQuantity'
      )
    ) then
      raise exception 'invalid_re_request_fields';
    end if;

    if v_order.row_type = 'set' then
      select * into v_old_aggregate
      from public.order_tasks task
      where task.workspace_id = p_workspace_id
        and task.order_id = p_order_id
        and task.task_role = 'aggregate'
      order by task.attempt_no desc
      limit 1
      for update;
      if not found
        or v_old_aggregate.status not in (
          'in_progress','paused','partial_complete','complete','returned'
        )
      then
        raise exception 're_request_transition_invalid';
      end if;
      v_next_attempt := v_old_aggregate.attempt_no + 1;

      for v_task in
        select task.*
        from public.order_tasks task
        join public.orders target_order
          on target_order.workspace_id = task.workspace_id
         and target_order.id = task.order_id
        where task.workspace_id = p_workspace_id
          and task.attempt_no = v_old_aggregate.attempt_no
          and (
            target_order.id = p_order_id
            or target_order.parent_chart_order_line_id = p_order_id
          )
        order by
          case when task.task_role = 'execution' then 0 else 1 end,
          task.order_id
        for update of task
      loop
        v_old_task := v_task;
        if v_task.status not in ('complete','returned','cancelled') then
          update public.order_tasks current_task
          set status = 'cancelled', cancelled_at = v_now,
            row_revision = row_revision + 1, updated_at = v_now
          where current_task.workspace_id = p_workspace_id
            and current_task.id = v_task.id
          returning * into v_task;
        end if;
        insert into public.order_task_events(
          workspace_id, task_id, task_attempt_no, order_id, event_type,
          actor_user_id, reason, before_values, after_values, created_at
        ) values (
          p_workspace_id, v_old_task.id, v_old_task.attempt_no,
          v_old_task.order_id, 're_requested', p_actor_user_id, v_reason,
          jsonb_build_object('status', v_old_task.status),
          jsonb_build_object(
            'status', v_task.status,
            'nextAttemptNo', v_next_attempt,
            'orderRevisionId', v_revision.id
          ),
          v_now
        );
      end loop;

      insert into public.order_tasks(
        workspace_id, encounter_id, order_id, task_role,
        clinical_order_type, destination_module, status, priority,
        attempt_no, request_cycle, re_requested_from_task_id, effective_snapshot,
        created_by_user_id, created_at, updated_at
      ) values (
        p_workspace_id, v_order.encounter_id, p_order_id, 'aggregate',
        v_order.clinical_order_type, null, 'pending',
        case when v_order.priority = 'urgent' then 'urgent' else 'normal' end,
        v_next_attempt, v_next_attempt, v_old_aggregate.id,
        v_old_aggregate.effective_snapshot || jsonb_build_object(
          'revisionNo', v_next_revision,
          'reRequestedAt', v_now
        ),
        p_actor_user_id, v_now, v_now
      ) returning * into v_new_aggregate;
      insert into public.order_task_events(
        workspace_id, task_id, task_attempt_no, order_id, event_type,
        actor_user_id, before_values, after_values, created_at
      ) values (
        p_workspace_id, v_new_aggregate.id, v_new_aggregate.attempt_no,
        p_order_id, 'created', p_actor_user_id, '{}'::jsonb,
        jsonb_build_object(
          'status', 'pending',
          'reRequestedFromTaskId', v_old_aggregate.id,
          'orderRevisionId', v_revision.id
        ),
        v_now
      );
      v_affected_tasks := jsonb_build_array(jsonb_build_object(
        'taskId', v_new_aggregate.id,
        'attemptNo', v_next_attempt,
        'effect', 'aggregate_attempt_created'
      ));

      for v_child_order in
        select child.* from public.orders child
        where child.workspace_id = p_workspace_id
          and child.parent_chart_order_line_id = p_order_id
          and child.row_type = 'set_child'
        order by child.id
        for update
      loop
        select * into v_old_task
        from public.order_tasks task
        where task.workspace_id = p_workspace_id
          and task.order_id = v_child_order.id
          and task.attempt_no = v_old_aggregate.attempt_no
        for update;
        if not found or v_old_task.status not in ('complete','returned','cancelled') then
          raise exception 're_request_link_invalid';
        end if;
        insert into public.order_tasks(
          workspace_id, encounter_id, order_id, parent_task_id, task_role,
          clinical_order_type, destination_module, status, priority,
          attempt_no, request_cycle, re_requested_from_task_id, effective_snapshot,
          created_by_user_id, created_at, updated_at
        ) values (
          p_workspace_id, v_child_order.encounter_id, v_child_order.id,
          v_new_aggregate.id, 'execution', v_child_order.clinical_order_type,
          v_child_order.destination_module, 'pending', v_old_task.priority,
          v_next_attempt, v_next_attempt, v_old_task.id,
          v_old_task.effective_snapshot || jsonb_build_object(
            'revisionNo', v_next_revision,
            'reRequestedAt', v_now
          ),
          p_actor_user_id, v_now, v_now
        ) returning * into v_new_task;
        insert into public.order_task_events(
          workspace_id, task_id, task_attempt_no, order_id, event_type,
          actor_user_id, before_values, after_values, created_at
        ) values (
          p_workspace_id, v_new_task.id, v_new_task.attempt_no,
          v_child_order.id, 'created', p_actor_user_id, '{}'::jsonb,
          jsonb_build_object(
            'status', 'pending',
            'reRequestedFromTaskId', v_old_task.id,
            'orderRevisionId', v_revision.id
          ),
          v_now
        );
        if v_new_task.destination_module is not null then
          update public.order_fulfillment_work_items item
          set
            task_id = v_new_task.id,
            task_attempt_no = v_new_task.attempt_no,
            request_cycle = v_new_task.attempt_no,
            row_revision = item.row_revision + 1,
            status = 'requested',
            priority = v_new_task.priority,
            requested_by_user_id = p_actor_user_id,
            assigned_to_user_id = null,
            assigned_by_user_id = null,
            assigned_at = null,
            started_by_user_id = null,
            started_at = null,
            detailed_phase = null,
            paused_from_phase = null,
            completed_at = null,
            cancelled_at = null,
            returned_at = null,
            reason = v_reason,
            source_snapshot = v_new_task.effective_snapshot,
            updated_at = v_now
          where item.workspace_id = p_workspace_id
            and item.order_id = v_child_order.id;
        end if;
        v_affected_tasks := v_affected_tasks || jsonb_build_array(jsonb_build_object(
          'taskId', v_new_task.id,
          'attemptNo', v_next_attempt,
          'orderId', v_child_order.id,
          'effect', 'execution_attempt_created'
        ));
      end loop;

      update public.orders target_order
      set
        status = 'confirmed',
        task_status = 'pending',
        revision_no = case when target_order.id = p_order_id
          then v_next_revision else target_order.revision_no end,
        updated_at = v_now
      where target_order.workspace_id = p_workspace_id
        and (
          target_order.id = p_order_id
          or target_order.parent_chart_order_line_id = p_order_id
        );
    else
      select * into v_old_task
      from public.order_tasks task
      where task.workspace_id = p_workspace_id
        and task.order_id = p_order_id
        and task.task_role = 'execution'
      order by task.attempt_no desc
      limit 1
      for update;
      if not found
        or v_old_task.status not in ('in_progress','paused','complete','returned')
      then
        raise exception 're_request_transition_invalid';
      end if;
      v_next_attempt := v_old_task.attempt_no + 1;
      v_detail_inputs := coalesce(v_changes -> 'detailInputs', v_order.detail_inputs);
      v_detail_schema_version := coalesce(
        (v_changes ->> 'detailSchemaVersion')::integer,
        v_order.detail_schema_version
      );
      v_priority := coalesce(
        v_changes ->> 'priority',
        case when v_order.priority = 'urgent' then 'urgent' else 'normal' end
      );
      if v_priority not in ('normal','urgent')
        or not private.clair_order_detail_inputs_are_valid(
          v_order.clinical_order_type,
          v_detail_schema_version,
          v_detail_inputs,
          true
        )
      then
        raise exception 'invalid_re_request_fields';
      end if;

      v_order.detail_inputs := v_detail_inputs;
      v_order.detail_schema_version := v_detail_schema_version;
      v_calculation_outputs := private.clair_compute_plan_order_dispense_projection(
        v_order,
        v_now
      );
      if v_changes ? 'actualDispenseQuantity' then
        if jsonb_typeof(v_changes -> 'actualDispenseQuantity') <> 'number'
          or (v_changes ->> 'actualDispenseQuantity')::numeric <= 0
          or v_calculation_outputs ->> 'calculationStatus' <> 'ready'
          or v_calculation_outputs ->> 'dispenseApplicability' <> 'true'
        then raise exception 'actual_dispense_reconfirmation_invalid'; end if;
        v_actual_quantity := (
          v_changes ->> 'actualDispenseQuantity'
        )::numeric;
        v_proposed_quantity := (
          v_calculation_outputs ->> 'proposedActualDispenseQuantity'
        )::numeric;
        v_preparation_policy := v_calculation_outputs -> 'preparationPolicy';
        if jsonb_typeof(v_preparation_policy) <> 'object'
          or jsonb_typeof(v_preparation_policy -> 'increment') <> 'number'
        then raise exception 'actual_dispense_override_disabled'; end if;
        v_actual_increment := (v_preparation_policy ->> 'increment')::numeric;
        v_actual_minimum := case
          when jsonb_typeof(v_preparation_policy -> 'minimum') = 'number'
          then (v_preparation_policy ->> 'minimum')::numeric else null end;
        v_actual_maximum := case
          when jsonb_typeof(v_preparation_policy -> 'maximum') = 'number'
          then (v_preparation_policy ->> 'maximum')::numeric else null end;
        v_actual_tolerance := case
          when jsonb_typeof(
            v_preparation_policy -> 'noReasonTolerance'
          ) = 'number'
          then (
            v_preparation_policy ->> 'noReasonTolerance'
          )::numeric else null end;
        if v_actual_increment <= 0
          or abs(
            v_actual_quantity / v_actual_increment -
            round(v_actual_quantity / v_actual_increment)
          ) > 0.000000001
          or (
            v_actual_minimum is not null
            and v_actual_quantity < v_actual_minimum
          )
          or (
            v_actual_maximum is not null
            and v_actual_quantity > v_actual_maximum
          )
        then raise exception 'actual_dispense_out_of_policy'; end if;
        v_actual_reason_required :=
          v_actual_quantity is distinct from v_proposed_quantity
          and (
            v_actual_tolerance is null
            or abs(v_actual_quantity - v_proposed_quantity) >
              v_actual_tolerance
          );
        select coalesce(max(override_row.version_no), 0) + 1
        into v_actual_override_version
        from public.order_actual_dispense_overrides override_row
        where override_row.workspace_id = p_workspace_id
          and override_row.order_id = p_order_id;
        v_actual_override_id := gen_random_uuid();
        v_calculation_outputs := v_calculation_outputs || jsonb_build_object(
          'actualDispenseQuantity', v_actual_quantity,
          'actualDispenseSource', case
            when v_actual_quantity is not distinct from v_proposed_quantity
              then 'preparation_policy'
            else 'manual_override' end,
          'actualDispenseOverride', case
            when v_actual_quantity is not distinct from v_proposed_quantity
              then null
            else jsonb_build_object(
              'versionNo', v_actual_override_version,
              'overrideId', v_actual_override_id,
              'reason', v_reason,
              'reasonRequired', v_actual_reason_required,
              'createdByUserId', p_actor_user_id,
              'createdAt', v_now
            ) end,
          'requiresReconfirmation', false,
          'totalRequiredDispenseQuantity', case
            when jsonb_typeof(
              v_calculation_outputs -> 'totalOccurrences'
            ) = 'number'
            then v_actual_quantity * (
              v_calculation_outputs ->> 'totalOccurrences'
            )::numeric
            else null end
        );
        insert into public.order_actual_dispense_overrides (
          id, workspace_id, order_id, version_no, idempotency_key,
          request_sha256, expected_order_updated_at, proposed_quantity,
          previous_quantity, actual_quantity, actual_unit, reason,
          reason_required, result, created_by_user_id, created_at
        ) values (
          v_actual_override_id, p_workspace_id, p_order_id,
          v_actual_override_version,
          left(v_idempotency_key, 150) || ':actual',
          v_request_sha256, v_order.updated_at, v_proposed_quantity,
          coalesce(
            (v_order.calculation_outputs ->> 'actualDispenseQuantity')::numeric,
            v_proposed_quantity
          ),
          v_actual_quantity,
          v_calculation_outputs ->> 'actualDispenseUnit',
          v_reason, v_actual_reason_required,
          jsonb_build_object(
            'overrideId', v_actual_override_id,
            'versionNo', v_actual_override_version,
            'orderId', p_order_id,
            'actualDispenseQuantity', v_actual_quantity,
            'actualDispenseUnit',
              v_calculation_outputs ->> 'actualDispenseUnit',
            'actualDispenseSource',
              v_calculation_outputs ->> 'actualDispenseSource',
            'actualDispenseOverride',
              v_calculation_outputs -> 'actualDispenseOverride',
            'requiresReconfirmation', false,
            'updatedAt', v_now
          ),
          p_actor_user_id, v_now
        );
      end if;
      if (
        v_calculation_outputs ->> 'dispenseApplicability' = 'true'
        and (
          v_calculation_outputs ->> 'calculationStatus' <> 'ready'
          or jsonb_typeof(
            v_calculation_outputs -> 'actualDispenseQuantity'
          ) <> 'number'
          or (
            v_calculation_outputs ->> 'actualDispenseQuantity'
          )::numeric <= 0
          or coalesce((
            v_calculation_outputs ->> 'requiresReconfirmation'
          )::boolean, false)
        )
      ) or (
        v_order.clinical_order_type = 'dispensing'
        and coalesce(
          v_calculation_outputs ->> 'dispenseApplicability',
          'unconfigured'
        ) <> 'true'
      ) then raise exception 'actual_dispense_reconfirmation_required'; end if;

      v_confirmed_snapshot := coalesce(
        v_order.confirmed_snapshot,
        '{}'::jsonb
      ) || jsonb_build_object(
        'detailInputs', v_detail_inputs,
        'detailSchemaVersion', v_detail_schema_version,
        'priority', v_priority,
        'revisionNo', v_next_revision,
        'calculationInputs', v_order.calculation_inputs,
        'calculationOutputs', v_calculation_outputs,
        'dispenseApplicability',
          v_calculation_outputs -> 'dispenseApplicability',
        'theoreticalDispenseQuantity',
          v_calculation_outputs -> 'theoreticalDispenseQuantity',
        'actualDispenseQuantity',
          v_calculation_outputs -> 'actualDispenseQuantity',
        'actualDispenseUnit',
          v_calculation_outputs -> 'actualDispenseUnit',
        'actualDispenseSource',
          v_calculation_outputs -> 'actualDispenseSource',
        'totalRequiredDispenseQuantity',
          v_calculation_outputs -> 'totalRequiredDispenseQuantity',
        'reconfirmedAt', v_now,
        'reconfirmedByUserId', p_actor_user_id
      );
      perform set_config(
        'clair.confirmed_snapshot_mutation_id',
        'revision:' || v_revision.id::text,
        true
      );
      if v_old_task.status not in ('complete','returned','cancelled') then
        update public.order_tasks task
        set status = 'cancelled', cancelled_at = v_now,
            row_revision = row_revision + 1, updated_at = v_now
        where task.workspace_id = p_workspace_id and task.id = v_old_task.id;
      end if;
      insert into public.order_task_events(
        workspace_id, task_id, task_attempt_no, order_id, event_type,
        actor_user_id, reason, before_values, after_values, created_at
      ) values (
        p_workspace_id, v_old_task.id, v_old_task.attempt_no, p_order_id,
        're_requested', p_actor_user_id, v_reason,
        jsonb_build_object('status', v_old_task.status),
        jsonb_build_object(
          'status', case when v_old_task.status in ('complete','returned')
            then v_old_task.status else 'cancelled' end,
          'nextAttemptNo', v_next_attempt,
          'orderRevisionId', v_revision.id
        ),
        v_now
      );

      update public.orders orders
      set
        status = 'confirmed',
        task_status = 'pending',
        detail_inputs = v_detail_inputs,
        detail_schema_version = v_detail_schema_version,
        calculation_outputs = v_calculation_outputs,
        confirmed_snapshot = v_confirmed_snapshot,
        priority = v_priority,
        revision_no = v_next_revision,
        updated_at = v_now
      where orders.workspace_id = p_workspace_id and orders.id = p_order_id;

      insert into public.order_tasks(
        workspace_id, encounter_id, order_id, task_role,
        clinical_order_type, destination_module, status, priority,
        attempt_no, request_cycle, re_requested_from_task_id, effective_snapshot,
        created_by_user_id, created_at, updated_at
      ) values (
        p_workspace_id, v_order.encounter_id, p_order_id, 'execution',
        v_order.clinical_order_type, v_order.destination_module, 'pending',
        v_priority, v_next_attempt, v_next_attempt, v_old_task.id,
        v_confirmed_snapshot || jsonb_build_object(
          'reRequestedAt', v_now
        ),
        p_actor_user_id, v_now, v_now
      ) returning * into v_new_task;
      insert into public.order_task_events(
        workspace_id, task_id, task_attempt_no, order_id, event_type,
        actor_user_id, before_values, after_values, created_at
      ) values (
        p_workspace_id, v_new_task.id, v_new_task.attempt_no, p_order_id,
        'created', p_actor_user_id, '{}'::jsonb,
        jsonb_build_object(
          'status', 'pending',
          'reRequestedFromTaskId', v_old_task.id,
          'orderRevisionId', v_revision.id
        ),
        v_now
      );
      if v_new_task.destination_module is not null then
        update public.order_fulfillment_work_items item
        set
          task_id = v_new_task.id,
          task_attempt_no = v_new_task.attempt_no,
          request_cycle = v_new_task.attempt_no,
          row_revision = item.row_revision + 1,
          status = 'requested',
          priority = v_new_task.priority,
          requested_by_user_id = p_actor_user_id,
          assigned_to_user_id = null,
          assigned_by_user_id = null,
          assigned_at = null,
          started_by_user_id = null,
          started_at = null,
          detailed_phase = null,
          paused_from_phase = null,
          completed_at = null,
          cancelled_at = null,
          returned_at = null,
          reason = v_reason,
          source_snapshot = v_new_task.effective_snapshot,
          updated_at = v_now
        where item.workspace_id = p_workspace_id and item.order_id = p_order_id;
      end if;
      if exists (
        select 1
        from public.order_billing_candidates candidate
        where candidate.workspace_id = p_workspace_id
          and candidate.order_id = p_order_id
          and candidate.status = 'candidate_created'
          and candidate.billing_snapshot is null
          and (
            (
              candidate.price_basis_snapshot = 'per_day'
              and (
                jsonb_typeof(v_detail_inputs -> 'durationDays') <> 'number'
                or (v_detail_inputs ->> 'durationDays')::numeric <= 0
              )
            )
            or (
              candidate.price_basis_snapshot = 'per_administration'
              and (
                jsonb_typeof(
                  v_calculation_outputs -> 'totalOccurrences'
                ) <> 'number'
                or (
                  v_calculation_outputs ->> 'totalOccurrences'
                )::numeric <= 0
              )
            )
            or (
              candidate.price_basis_snapshot = 'per_product_unit'
              and (
                jsonb_typeof(
                  v_calculation_outputs -> 'totalRequiredDispenseQuantity'
                ) <> 'number'
                or (
                  v_calculation_outputs ->> 'totalRequiredDispenseQuantity'
                )::numeric <= 0
              )
            )
            or (
              candidate.price_basis_snapshot = 'per_kg'
              and (
                jsonb_typeof(
                  v_calculation_outputs #> '{weightSnapshot,valueKg}'
                ) <> 'number'
                or (
                  v_calculation_outputs #>> '{weightSnapshot,valueKg}'
                )::numeric <= 0
              )
            )
          )
      ) then raise exception 'billing_quantity_calculation_incomplete'; end if;
      update public.order_billing_candidates candidate
      set
        quantity = case candidate.price_basis_snapshot
          when 'per_order' then 1::numeric
          when 'fixed_set' then 1::numeric
          when 'per_day' then (v_detail_inputs ->> 'durationDays')::numeric
          when 'per_administration' then
            (v_calculation_outputs ->> 'totalOccurrences')::numeric
          when 'per_product_unit' then
            (
              v_calculation_outputs ->> 'totalRequiredDispenseQuantity'
            )::numeric
          when 'per_kg' then
            (
              v_calculation_outputs #>> '{weightSnapshot,valueKg}'
            )::numeric
          else candidate.quantity
        end,
        amount = round(candidate.unit_price * case
          when candidate.price_basis_snapshot in ('per_order','fixed_set')
            then 1::numeric
          when candidate.price_basis_snapshot = 'per_day'
            then (v_detail_inputs ->> 'durationDays')::numeric
          when candidate.price_basis_snapshot = 'per_administration'
            then (v_calculation_outputs ->> 'totalOccurrences')::numeric
          when candidate.price_basis_snapshot = 'per_product_unit'
            then (
              v_calculation_outputs ->> 'totalRequiredDispenseQuantity'
            )::numeric
          when candidate.price_basis_snapshot = 'per_kg'
            then (
              v_calculation_outputs #>> '{weightSnapshot,valueKg}'
            )::numeric
          else candidate.quantity
        end)::bigint,
        source_snapshot = v_confirmed_snapshot,
        updated_at = v_now
      where candidate.workspace_id = p_workspace_id
        and candidate.order_id = p_order_id
        and candidate.status = 'candidate_created'
        and candidate.billing_snapshot is null;
      get diagnostics v_changed_count = row_count;
      v_billing_impact := jsonb_build_object(
        'recalculatedCandidateCount', v_changed_count,
        'billingCyclePreserved', true,
        'sourceSnapshotReconfirmed', true
      );
      v_affected_tasks := jsonb_build_array(
        jsonb_build_object(
          'taskId', v_old_task.id,
          'attemptNo', v_old_task.attempt_no,
          'effect', 'original_attempt_preserved'
        ),
        jsonb_build_object(
          'taskId', v_new_task.id,
          'attemptNo', v_new_task.attempt_no,
          'effect', 'linked_attempt_created'
        )
      );
    end if;
    insert into public.order_revision_fields(
      workspace_id, order_revision_id, field_name, previous_value, current_value
    ) values (
      p_workspace_id, v_revision.id, 'taskAttempt',
      jsonb_build_object('attemptNo', coalesce(v_old_aggregate.attempt_no, v_old_task.attempt_no)),
      jsonb_build_object('attemptNo', v_next_attempt, 'status', 'pending')
    );
  end if;

  select * into v_order
  from public.orders orders
  where orders.workspace_id = p_workspace_id and orders.id = p_order_id;
  v_after := jsonb_build_object(
    'orderStatus', v_order.status,
    'confirmationStatus', v_order.order_confirmation_status,
    'revisionNo', v_order.revision_no,
    'detailInputs', v_order.detail_inputs,
    'detailSchemaVersion', v_order.detail_schema_version,
    'calculationOutputs', v_order.calculation_outputs,
    'priority', case when v_order.priority = 'urgent' then 'urgent' else 'normal' end,
    'confirmedSnapshot', v_order.confirmed_snapshot
  );

  insert into public.order_events(
    workspace_id, order_id, event_type, performed_by_user_id, payload, created_at
  ) values (
    p_workspace_id,
    p_order_id,
    case when v_action = 'cancel' then 'cancelled' else 'edited' end,
    p_actor_user_id,
    jsonb_build_object(
      'action', v_action,
      'orderRevisionId', v_revision.id,
      'reason', v_reason,
      'before', v_before,
      'after', v_after,
      'affectedTasks', v_affected_tasks,
      'billingImpact', v_billing_impact
    ),
    v_now
  );

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
  ) values (
    'order-execution-revision-' || v_revision.id::text,
    p_workspace_id,
    p_actor_user_id,
    v_actor_membership_id,
    'order.status_changed',
    'order',
    p_order_id::text,
    v_order.encounter_id,
    v_revision.id::text,
    v_before,
    v_after,
    jsonb_build_object(
      'source', 'chart-order-revision-attempt-v1',
      'action', v_action,
      'reason', v_reason,
      'idempotencyKey', v_idempotency_key,
      'affectedTasks', v_affected_tasks,
      'billingImpact', v_billing_impact
    ),
    v_now,
    v_now
  );

  insert into public.order_execution_outbox(
    workspace_id, confirmation_command_id, order_revision_id,
    event_key, event_type,
    aggregate_type, aggregate_id, payload, created_at, updated_at
  ) values (
    p_workspace_id,
    null,
    v_revision.id,
    'order.execution_changed:' || v_revision.id::text,
    'order.execution_changed',
    'order',
    p_order_id,
    jsonb_build_object(
      'workspaceId', p_workspace_id,
      'encounterId', v_order.encounter_id,
      'orderId', p_order_id,
      'orderRevisionId', v_revision.id,
      'action', v_action,
      'affectedTasks', v_affected_tasks,
      'billingImpact', v_billing_impact
    ),
    v_now,
    v_now
  );

  v_result := jsonb_build_object(
    'orderRevisionId', v_revision.id,
    'revisionNo', v_order.revision_no,
    'action', v_action,
    'orderId', p_order_id,
    'confirmedSnapshotPreserved',
      v_order.confirmed_snapshot is not distinct from (v_before -> 'confirmedSnapshot'),
    'order', v_after,
    'affectedTasks', v_affected_tasks,
    'billingImpact', v_billing_impact
  );
  update public.order_revisions revision
  set
    after_values = v_after,
    affected_tasks = v_affected_tasks,
    billing_impact = v_billing_impact,
    result = v_result,
    completed_at = v_now
  where revision.workspace_id = p_workspace_id
    and revision.id = v_revision.id;
  return v_result;
end;
$function$;

revoke all on function public.clair_mutate_chart_order_execution(
  text,uuid,uuid,text,text,integer,jsonb,text
) from public, anon, service_role;
grant execute on function public.clair_mutate_chart_order_execution(
  text,uuid,uuid,text,text,integer,jsonb,text
) to authenticated;

create or replace function private.clair_release_returned_candidate_on_rerequest()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_previous_status text;
begin
  if new.re_requested_from_task_id is null then return new; end if;
  select task.status into v_previous_status
  from public.order_tasks task
  where task.workspace_id = new.workspace_id
    and task.id = new.re_requested_from_task_id;
  if v_previous_status = 'returned' then
    update public.order_billing_candidates candidate
    set
      status = case when candidate.status = 'billing_review_required'
        then 'candidate_created' else candidate.status end,
      task_id = new.id,
      task_attempt_no = new.attempt_no,
      source_snapshot = candidate.source_snapshot || jsonb_build_object(
        'returnReviewResolution', jsonb_build_object(
          'resolution', 're_requested',
          'newTaskId', new.id,
          'newAttemptNo', new.attempt_no,
          'resolvedAt', now()
        )
      ),
      updated_at = now()
    where candidate.workspace_id = new.workspace_id
      and candidate.order_id = new.order_id
      and candidate.status in ('billing_review_required','candidate_created')
      and candidate.invoice_line_id is null
      and candidate.billing_snapshot is null;
  end if;
  return new;
end;
$function$;

drop trigger if exists order_tasks_release_returned_candidate_trg
  on public.order_tasks;
create trigger order_tasks_release_returned_candidate_trg
after insert on public.order_tasks
for each row execute function private.clair_release_returned_candidate_on_rerequest();

create or replace function public.clair_list_fulfillment_eligible_assignees(
  p_workspace_id text,
  p_work_item_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_item public.order_fulfillment_work_items%rowtype;
  v_permission text;
begin
  if auth.uid() is null or not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'permission_missing' using errcode = '42501';
  end if;
  select item.* into v_item
  from public.order_fulfillment_work_items item
  where item.workspace_id = p_workspace_id and item.id = p_work_item_id;
  if not found then raise exception 'work_item_unavailable'; end if;
  v_permission := private.clair_queue_permission_for_destination(
    coalesce(v_item.destination_module, v_item.queue_type), 'mutate'
  );
  if not private.clair_current_user_has_workspace_permission(p_workspace_id, v_permission) then
    raise exception 'permission_missing' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'userId', app_user.id,
      'displayName', app_user.display_name,
      'department', membership.department,
      'title', membership.title
    ) order by app_user.display_name, app_user.id)
    from public.user_memberships membership
    join public.users app_user on app_user.id = membership.user_id
    where membership.workspace_id = p_workspace_id
      and membership.status = 'active'
      and app_user.status = 'active'
      and private.clair_user_has_workspace_permission(
        p_workspace_id, app_user.id, v_permission
      )
  ), '[]'::jsonb);
end;
$function$;

revoke all on function public.clair_list_fulfillment_eligible_assignees(text,uuid)
  from public, anon, service_role;
grant execute on function public.clair_list_fulfillment_eligible_assignees(text,uuid)
  to authenticated;

-- Read RPCs are renamed once and wrapped so capability checks happen inside
-- PostgreSQL even if an application route regresses.
alter function public.clair_get_chart_order_draft(text,uuid)
  rename to clair_get_chart_order_draft_permission_base;
revoke all on function public.clair_get_chart_order_draft_permission_base(text,uuid)
  from public, anon, authenticated, service_role;

create function public.clair_get_chart_order_draft(
  p_workspace_id text,
  p_encounter_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_result jsonb;
  v_rows jsonb;
  v_can_view_billing boolean;
begin
  if not private.clair_current_user_has_workspace_permission(p_workspace_id, 'chart:view') then
    raise exception 'permission_missing' using errcode = '42501';
  end if;
  v_result := public.clair_get_chart_order_draft_permission_base(
    p_workspace_id, p_encounter_id
  );
  v_can_view_billing := private.clair_current_user_has_workspace_permission(
    p_workspace_id, 'billing:view'
  );
  select coalesce(jsonb_agg(
    row_value || jsonb_build_object(
      'intendedAssigneeUserId', current_order.current_assignee_user_id
    ) ||
    case when not v_can_view_billing or override_row.id is null
      then '{}'::jsonb else jsonb_build_object(
        'preBillingOverride', jsonb_build_object(
          'versionNo', override_row.version_no,
          'billingName', override_row.billing_name,
          'billingReflectionEnabled', override_row.billing_reflection_enabled,
          'billingQuantity', override_row.billing_quantity,
          'adjustmentSource', override_row.adjustment_source,
          'adjustmentAmountKrw', override_row.adjustment_amount_krw,
          'adjustmentPercent', override_row.adjustment_percent,
          'adjustmentReason', override_row.adjustment_reason
        )
      ) end || case when v_can_view_billing then jsonb_build_object(
      'billingAdjustmentReasons', coalesce(policy.adjustment_reasons, '[]'::jsonb)
    ) else '{}'::jsonb end
    order by row_index
  ), '[]'::jsonb)
  into v_rows
  from jsonb_array_elements(coalesce(v_result -> 'rows', '[]'::jsonb))
    with ordinality rows(row_value, row_index)
  left join public.orders current_order
    on current_order.workspace_id = p_workspace_id
   and current_order.id = (row_value ->> 'orderId')::uuid
  left join lateral (
    select candidate.*
    from public.order_prebilling_overrides candidate
    where candidate.workspace_id = p_workspace_id
      and candidate.order_id = (row_value ->> 'orderId')::uuid
    order by candidate.version_no desc
    limit 1
  ) override_row on v_can_view_billing
  left join public.workspace_order_billing_policies policy
    on policy.workspace_id = p_workspace_id and v_can_view_billing;
  v_result := jsonb_set(v_result, '{rows}', v_rows, false);
  return v_result;
end;
$function$;

alter function public.clair_get_chart_order_actions(text,uuid)
  rename to clair_get_chart_order_actions_permission_base;
revoke all on function public.clair_get_chart_order_actions_permission_base(text,uuid)
  from public, anon, authenticated, service_role;

create function public.clair_get_chart_order_actions(
  p_workspace_id text,
  p_encounter_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
begin
  if not private.clair_current_user_has_workspace_permission(p_workspace_id, 'chart:view') then
    raise exception 'permission_missing' using errcode = '42501';
  end if;
  return public.clair_get_chart_order_actions_permission_base(p_workspace_id, p_encounter_id);
end;
$function$;

alter function public.clair_list_billing_invoice_candidates(text,uuid)
  rename to clair_list_billing_invoice_candidates_permission_base;
revoke all on function public.clair_list_billing_invoice_candidates_permission_base(text,uuid)
  from public, anon, authenticated, service_role;

create function public.clair_list_billing_invoice_candidates(
  p_workspace_id text,
  p_encounter_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
begin
  if not private.clair_current_user_has_workspace_permission(p_workspace_id, 'billing:view') then
    raise exception 'permission_missing' using errcode = '42501';
  end if;
  return public.clair_list_billing_invoice_candidates_permission_base(
    p_workspace_id, p_encounter_id
  );
end;
$function$;

create or replace function public.clair_get_chart_order_billing_summary(
  p_workspace_id text,
  p_encounter_id uuid
)
returns jsonb
language plpgsql
security definer
stable
set search_path = pg_catalog, public, private
as $function$
begin
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing';
  end if;
  if not private.clair_current_user_has_workspace_permission(p_workspace_id, 'chart:view')
    or not private.clair_current_user_has_workspace_permission(p_workspace_id, 'billing:view')
  then raise exception 'permission_missing' using errcode = '42501'; end if;
  return private.clair_get_chart_order_billing_summary_internal(
    p_workspace_id, p_encounter_id
  );
end;
$function$;

alter function public.clair_request_chart_order_billing(
  text,uuid,uuid,text,text,boolean
) rename to clair_request_chart_order_billing_authority_base;
revoke all on function public.clair_request_chart_order_billing_authority_base(
  text,uuid,uuid,text,text,boolean
) from public, anon, authenticated, service_role;

create function public.clair_request_chart_order_billing(
  p_workspace_id text,
  p_actor_user_id uuid,
  p_encounter_id uuid,
  p_expected_etag text,
  p_idempotency_key text,
  p_acknowledge_unfinished boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $function$
declare
  v_snapshot jsonb;
begin
  if auth.uid() is null or p_actor_user_id is distinct from auth.uid()
    or not private.clair_is_active_workspace_member(p_workspace_id)
    or not private.clair_current_user_has_workspace_permission(p_workspace_id, 'chart:update')
    or not private.clair_current_user_has_workspace_permission(p_workspace_id, 'billing:issue')
  then raise exception 'permission_missing' using errcode = '42501'; end if;

  perform 1
  from public.orders orders
  where orders.workspace_id = p_workspace_id
    and orders.encounter_id = p_encounter_id
  order by orders.id
  for update;
  perform 1
  from public.order_billing_candidates candidate
  where candidate.workspace_id = p_workspace_id
    and candidate.encounter_id = p_encounter_id
  order by candidate.order_id, candidate.id
  for update;

  if exists (
    select 1
    from public.order_billing_candidates candidate
    join public.orders orders
      on orders.workspace_id = candidate.workspace_id
     and orders.id = candidate.order_id
    where candidate.workspace_id = p_workspace_id
      and candidate.encounter_id = p_encounter_id
      and candidate.status = 'candidate_created'
      and orders.status <> 'cancelled'
      and orders.order_confirmation_status = 'confirmed'
      and orders.billing_reflection_enabled
      and (
        candidate.price_basis_snapshot is null
        or candidate.billing_unit_snapshot is null
        or candidate.tax_class_snapshot is null
        or (orders.row_type = 'set' and candidate.set_billing_owner_snapshot is null)
        or (candidate.price_basis_snapshot = 'fixed_set'
            and candidate.set_billing_owner_snapshot is distinct from 'parent')
        or length(btrim(candidate.billing_name_snapshot)) = 0
        or candidate.quantity <= 0
        or candidate.amount < 0
      )
  ) then raise exception 'billing_authority_incomplete'; end if;

  if exists (
    select 1
    from public.order_billing_candidates candidate
    join public.orders orders
      on orders.workspace_id = candidate.workspace_id
     and orders.id = candidate.order_id
    left join public.workspace_order_billing_policies policy
      on policy.workspace_id = candidate.workspace_id
    where candidate.workspace_id = p_workspace_id
      and candidate.encounter_id = p_encounter_id
      and candidate.status = 'candidate_created'
      and orders.status <> 'cancelled'
      and orders.order_confirmation_status = 'confirmed'
      and orders.billing_reflection_enabled
      and candidate.tax_class_snapshot = 'taxable'
      and policy.vat_calculation_policy is null
  ) then raise exception 'vat_calculation_policy_missing'; end if;

  if exists (
    select 1
    from public.order_billing_candidates candidate
    join public.order_tasks task
      on task.workspace_id = candidate.workspace_id
     and task.id = candidate.task_id
     and task.attempt_no = candidate.task_attempt_no
    join public.orders orders
      on orders.workspace_id = candidate.workspace_id
     and orders.id = candidate.order_id
    where candidate.workspace_id = p_workspace_id
      and candidate.encounter_id = p_encounter_id
      and candidate.status = 'candidate_created'
      and orders.billing_reflection_enabled
      and task.status = 'returned'
  ) then raise exception 'returned_work_blocks_billing'; end if;

  for v_snapshot in
    select jsonb_build_object(
      'schemaVersion', 1,
      'billingCycle', candidate.billing_cycle,
      'orderId', candidate.order_id,
      'orderRevisionNo', orders.revision_no,
      'billingName', candidate.billing_name_snapshot,
      'billingReflectionEnabled', orders.billing_reflection_enabled,
      'priceBasis', candidate.price_basis_snapshot,
      'billingUnit', candidate.billing_unit_snapshot,
      'quantity', candidate.quantity,
      'unitPriceKrw', candidate.unit_price,
      'baseAmountKrw', round(candidate.unit_price * candidate.quantity)::bigint,
      'adjustment', coalesce(candidate.source_snapshot->'preBillingOverride', '{}'::jsonb),
      'chargeAmountKrw', candidate.amount,
      'taxClass', candidate.tax_class_snapshot,
      'vatCalculationPolicy', policy.vat_calculation_policy,
      'setBillingOwner', candidate.set_billing_owner_snapshot,
      'setAmountStrategy', candidate.set_amount_strategy_snapshot,
      'frozenAt', now(),
      'frozenByUserId', p_actor_user_id
    ) as value
    from public.order_billing_candidates candidate
    join public.orders orders
      on orders.workspace_id = candidate.workspace_id
     and orders.id = candidate.order_id
    left join public.workspace_order_billing_policies policy
      on policy.workspace_id = candidate.workspace_id
    where candidate.workspace_id = p_workspace_id
      and candidate.encounter_id = p_encounter_id
      and candidate.status = 'candidate_created'
      and orders.status <> 'cancelled'
      and orders.order_confirmation_status = 'confirmed'
      and orders.billing_reflection_enabled
    order by candidate.order_id
  loop
    update public.order_billing_candidates candidate
    set
      billing_snapshot = v_snapshot,
      billing_snapshot_sha256 = encode(digest(v_snapshot::text, 'sha256'), 'hex'),
      updated_at = now()
    where candidate.workspace_id = p_workspace_id
      and candidate.order_id = (v_snapshot->>'orderId')::uuid;
  end loop;

  return public.clair_request_chart_order_billing_authority_base(
    p_workspace_id,
    p_actor_user_id,
    p_encounter_id,
    p_expected_etag,
    p_idempotency_key,
    p_acknowledge_unfinished
  );
end;
$function$;

revoke all on function public.clair_get_chart_order_draft(text,uuid)
  from public, anon, service_role;
revoke all on function public.clair_get_chart_order_actions(text,uuid)
  from public, anon, service_role;
revoke all on function public.clair_list_billing_invoice_candidates(text,uuid)
  from public, anon, service_role;
revoke all on function public.clair_get_chart_order_billing_summary(text,uuid)
  from public, anon, service_role;
revoke all on function public.clair_request_chart_order_billing(
  text,uuid,uuid,text,text,boolean
) from public, anon, service_role;
grant execute on function public.clair_get_chart_order_draft(text,uuid) to authenticated;
grant execute on function public.clair_get_chart_order_actions(text,uuid) to authenticated;
grant execute on function public.clair_list_billing_invoice_candidates(text,uuid) to authenticated;
grant execute on function public.clair_get_chart_order_billing_summary(text,uuid) to authenticated;
grant execute on function public.clair_request_chart_order_billing(
  text,uuid,uuid,text,text,boolean
) to authenticated;

alter function public.clair_confirm_chart_order_candidates(
  text,uuid,uuid,uuid[],text,text
) rename to clair_confirm_chart_order_candidates_plan_order_base;
revoke all on function public.clair_confirm_chart_order_candidates_plan_order_base(
  text,uuid,uuid,uuid[],text,text
) from public, anon, authenticated, service_role;

create function public.clair_confirm_chart_order_candidates(
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
set search_path = pg_catalog, public, private, extensions
as $function$
declare
  v_result jsonb;
  v_command_id uuid;
  v_actor_membership_id uuid;
  v_idempotency_key text := btrim(coalesce(p_idempotency_key, ''));
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

  -- Hold the same command lock as the base function so a concurrent retry
  -- cannot miss the replay check and rerun the projection updates below.
  perform pg_advisory_xact_lock(
    hashtextextended(
      'chart_order_confirmation:' || p_workspace_id || ':' ||
      v_idempotency_key,
      0
    )
  );
  if exists (
    select 1
    from public.order_confirmation_commands command
    where command.workspace_id = p_workspace_id
      and command.idempotency_key = v_idempotency_key
  ) then
    return public.clair_confirm_chart_order_candidates_plan_order_base(
      p_workspace_id,
      p_actor_user_id,
      p_encounter_id,
      p_selected_root_order_ids,
      p_expected_draft_etag,
      p_idempotency_key
    );
  end if;

  if exists (
    select 1
    from public.orders orders
    where orders.workspace_id = p_workspace_id
      and orders.encounter_id = p_encounter_id
      and orders.status <> 'cancelled'
      and orders.row_type in ('individual','set_child')
      and (
        orders.id = any(p_selected_root_order_ids)
        or orders.parent_chart_order_line_id = any(p_selected_root_order_ids)
      )
      and (
        (
          orders.calculation_outputs ->> 'dispenseApplicability' = 'true'
          and (
            orders.calculation_outputs ->> 'calculationStatus' <> 'ready'
            or jsonb_typeof(
              orders.calculation_outputs -> 'actualDispenseQuantity'
            ) <> 'number'
            or (orders.calculation_outputs ->> 'actualDispenseQuantity')::numeric <= 0
            or coalesce(
              (orders.calculation_outputs ->> 'requiresReconfirmation')::boolean,
              false
            )
          )
        )
        or (
          orders.clinical_order_type = 'dispensing'
          and coalesce(
            orders.calculation_outputs ->> 'dispenseApplicability',
            'unconfigured'
          ) <> 'true'
        )
      )
  ) then raise exception 'actual_dispense_confirmation_blocked'; end if;

  if exists (
    select 1
    from public.orders orders
    where orders.workspace_id = p_workspace_id
      and orders.encounter_id = p_encounter_id
      and orders.status <> 'cancelled'
      and orders.billing_eligible
      and orders.billing_reflection_enabled
      and orders.row_type in ('individual','set_child')
      and (
        orders.id = any(p_selected_root_order_ids)
        or orders.parent_chart_order_line_id = any(p_selected_root_order_ids)
      )
      and (
        (
          orders.applied_snapshot #>> '{planOrderAuthority,priceBasis}'
            in ('per_administration','per_product_unit')
          and (
            jsonb_typeof(orders.calculation_outputs -> 'totalOccurrences')
              <> 'number'
            or (orders.calculation_outputs ->> 'totalOccurrences')::numeric <= 0
          )
        )
        or (
          orders.applied_snapshot #>> '{planOrderAuthority,priceBasis}' = 'per_day'
          and (
            jsonb_typeof(orders.detail_inputs -> 'durationDays') <> 'number'
            or (orders.detail_inputs ->> 'durationDays')::numeric <= 0
          )
        )
        or (
          orders.applied_snapshot #>> '{planOrderAuthority,priceBasis}' = 'per_kg'
          and (
            jsonb_typeof(
              orders.calculation_outputs #> '{weightSnapshot,valueKg}'
            ) <> 'number'
            or (
              orders.calculation_outputs #>> '{weightSnapshot,valueKg}'
            )::numeric <= 0
          )
        )
      )
  ) then raise exception 'billing_quantity_calculation_incomplete'; end if;

  v_result := public.clair_confirm_chart_order_candidates_plan_order_base(
    p_workspace_id,
    p_actor_user_id,
    p_encounter_id,
    p_selected_root_order_ids,
    p_expected_draft_etag,
    p_idempotency_key
  );
  v_command_id := nullif(v_result ->> 'commandId', '')::uuid;
  perform set_config(
    'clair.confirmed_snapshot_mutation_id',
    'confirmation:' || v_command_id::text,
    true
  );

  update public.orders orders
  set confirmed_snapshot = orders.confirmed_snapshot || jsonb_build_object(
    'calculationInputs', orders.calculation_inputs,
    'calculationOutputs', orders.calculation_outputs,
    'dispenseApplicability',
      orders.calculation_outputs -> 'dispenseApplicability',
    'theoreticalDispenseQuantity',
      orders.calculation_outputs -> 'theoreticalDispenseQuantity',
    'actualDispenseQuantity',
      orders.calculation_outputs -> 'actualDispenseQuantity',
    'actualDispenseUnit',
      orders.calculation_outputs -> 'actualDispenseUnit',
    'actualDispenseSource',
      orders.calculation_outputs -> 'actualDispenseSource',
    'totalRequiredDispenseQuantity',
      orders.calculation_outputs -> 'totalRequiredDispenseQuantity'
  ),
  updated_at = greatest(orders.updated_at, now())
  where orders.workspace_id = p_workspace_id
    and orders.encounter_id = p_encounter_id
    and orders.status <> 'cancelled'
    and (
      orders.id = any(p_selected_root_order_ids)
      or orders.parent_chart_order_line_id = any(p_selected_root_order_ids)
    );

  update public.order_tasks task
  set effective_snapshot = orders.confirmed_snapshot,
      updated_at = greatest(task.updated_at, orders.updated_at)
  from public.orders orders
  where task.workspace_id = p_workspace_id
    and orders.workspace_id = task.workspace_id
    and orders.id = task.order_id
    and task.encounter_id = p_encounter_id
    and task.attempt_no = 1
    and task.status not in ('complete','cancelled')
    and (
      orders.id = any(p_selected_root_order_ids)
      or orders.parent_chart_order_line_id = any(p_selected_root_order_ids)
    );
  update public.order_fulfillment_work_items item
  set source_snapshot = task.effective_snapshot,
      updated_at = greatest(item.updated_at, task.updated_at)
  from public.order_tasks task
  where item.workspace_id = p_workspace_id
    and task.workspace_id = item.workspace_id
    and task.id = item.task_id
    and task.attempt_no = item.task_attempt_no
    and task.encounter_id = p_encounter_id
    and task.attempt_no = 1;

  update public.order_billing_candidates candidate
  set quantity = calculated.quantity,
      amount = round(candidate.unit_price * calculated.quantity)::bigint,
      source_snapshot = calculated.confirmed_snapshot,
      updated_at = now()
  from (
    select orders.id,
      orders.confirmed_snapshot,
      case orders.applied_snapshot #>> '{planOrderAuthority,priceBasis}'
        when 'per_order' then 1::numeric
        when 'fixed_set' then 1::numeric
        when 'per_day' then (orders.detail_inputs ->> 'durationDays')::numeric
        when 'per_administration' then
          (orders.calculation_outputs ->> 'totalOccurrences')::numeric
        when 'per_product_unit' then
          (orders.calculation_outputs ->> 'totalRequiredDispenseQuantity')::numeric
        when 'per_kg' then
          (orders.calculation_outputs #>> '{weightSnapshot,valueKg}')::numeric
        else orders.quantity
      end as quantity
    from public.orders orders
    where orders.workspace_id = p_workspace_id
      and orders.encounter_id = p_encounter_id
      and orders.status <> 'cancelled'
      and (
        orders.id = any(p_selected_root_order_ids)
        or orders.parent_chart_order_line_id = any(p_selected_root_order_ids)
      )
  ) calculated
  where candidate.workspace_id = p_workspace_id
    and candidate.order_id = calculated.id
    and candidate.confirmation_command_id = v_command_id;

  v_result := jsonb_set(v_result, '{billingCandidates}', coalesce((
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
      and candidate.confirmation_command_id = v_command_id
  ), '[]'::jsonb));

  update public.order_confirmation_commands command
  set result = v_result
  where command.workspace_id = p_workspace_id and command.id = v_command_id;

  select membership.id into v_actor_membership_id
  from public.user_memberships membership
  where membership.workspace_id = p_workspace_id
    and membership.user_id = p_actor_user_id
    and membership.status = 'active'
  order by membership.created_at
  limit 1;
  insert into public.audit_events (
    id, workspace_id, actor_user_id, actor_membership_id,
    event_type, target_type, target_id, encounter_id, request_id,
    before_snapshot, after_snapshot, metadata, occurred_at, created_at
  )
  select
    'order-confirmed-calculation-' || v_command_id::text || '-' || orders.id::text,
    p_workspace_id, p_actor_user_id, v_actor_membership_id,
    'order.confirmed', 'order', orders.id::text, p_encounter_id,
    v_command_id::text, '{}'::jsonb, orders.confirmed_snapshot,
    jsonb_build_object('source', 'plan-order-calculation-confirmation-v1'),
    now(), now()
  from public.orders orders
  where orders.workspace_id = p_workspace_id
    and orders.encounter_id = p_encounter_id
    and (
      orders.id = any(p_selected_root_order_ids)
      or orders.parent_chart_order_line_id = any(p_selected_root_order_ids)
    )
  on conflict (id) do nothing;
  return v_result;
end;
$function$;

revoke all on function public.clair_confirm_chart_order_candidates(
  text,uuid,uuid,uuid[],text,text
) from public, anon, service_role;
grant execute on function public.clair_confirm_chart_order_candidates(
  text,uuid,uuid,uuid[],text,text
) to authenticated;

-- The legacy confirm/bill writer predates atomic Task, Queue, revision, and
-- billing-snapshot creation. Removing authenticated execute prevents direct
-- callers from bypassing those artifacts; supported callers use the atomic
-- confirmation and encounter-scoped billing RPCs.
revoke execute on function public.clair_save_chart_order_action(
  text,uuid,uuid,text,uuid[],text
) from authenticated;

alter function public.clair_get_chart_order_execution_read_model(text,uuid)
  rename to clair_get_chart_order_execution_read_model_lifecycle_base;
revoke all on function public.clair_get_chart_order_execution_read_model_lifecycle_base(text,uuid)
  from public, anon, authenticated, service_role;

create function public.clair_get_chart_order_execution_read_model(
  p_workspace_id text,
  p_encounter_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_result jsonb;
begin
  v_result := public.clair_get_chart_order_execution_read_model_lifecycle_base(
    p_workspace_id, p_encounter_id
  );

  v_result := jsonb_set(v_result, '{tasks}', coalesce((
    select jsonb_agg(jsonb_build_object(
      'taskId', task.id, 'orderId', task.order_id,
      'parentTaskId', task.parent_task_id, 'taskRole', task.task_role,
      'clinicalOrderType', task.clinical_order_type,
      'destinationModule', task.destination_module, 'status', task.status,
      'priority', task.priority, 'attemptNo', task.attempt_no,
      'requestCycle', task.request_cycle,
      'reRequestedFromTaskId', task.re_requested_from_task_id,
      'effectiveSnapshot', task.effective_snapshot,
      'resultSnapshot', task.result_snapshot,
      'assignedToUserId', task.assigned_to_user_id,
      'assignedToDisplayName', assignee.display_name,
      'assignedByUserId', task.assigned_by_user_id,
      'assignedAt', task.assigned_at,
      'startedByUserId', task.started_by_user_id,
      'startedAt', task.started_at,
      'detailedPhase', task.detailed_phase,
      'pausedFromPhase', task.paused_from_phase,
      'completedAt', task.completed_at,
      'returnedAt', task.returned_at,
      'cancelledAt', task.cancelled_at,
      'rowRevision', task.row_revision,
      'createdAt', task.created_at, 'updatedAt', task.updated_at
    ) order by task.created_at, task.attempt_no, task.id)
    from public.order_tasks task
    left join public.users assignee on assignee.id = task.assigned_to_user_id
    where task.workspace_id = p_workspace_id
      and task.encounter_id = p_encounter_id
  ), '[]'::jsonb));

  v_result := jsonb_set(v_result, '{events}', coalesce((
    select jsonb_agg(jsonb_build_object(
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
      'lifecycleCommandId', event.lifecycle_command_id,
      'createdAt', event.created_at
    ) order by event.created_at, event.id)
    from public.order_task_events event
    join public.order_tasks task
      on task.workspace_id = event.workspace_id
     and task.id = event.task_id
     and task.attempt_no = event.task_attempt_no
    where event.workspace_id = p_workspace_id
      and task.encounter_id = p_encounter_id
  ), '[]'::jsonb));

  v_result := jsonb_set(v_result, '{queues}', coalesce((
    select jsonb_agg(jsonb_build_object(
      'workItemId', queue.id, 'orderId', queue.order_id,
      'taskId', queue.task_id, 'taskAttemptNo', queue.task_attempt_no,
      'destinationModule', queue.destination_module,
      'queueType', queue.queue_type, 'queueStatus', queue.status,
      'assignedToUserId', queue.assigned_to_user_id,
      'detailedPhase', queue.detailed_phase,
      'requestCycle', queue.request_cycle,
      'rowRevision', queue.row_revision,
      'updatedAt', queue.updated_at
    ) order by queue.updated_at, queue.id)
    from public.order_fulfillment_work_items queue
    where queue.workspace_id = p_workspace_id
      and queue.encounter_id = p_encounter_id
      and queue.task_id is not null
  ), '[]'::jsonb));

  return v_result;
end;
$function$;

revoke all on function public.clair_get_chart_order_execution_read_model(text,uuid)
  from public, anon, service_role;
grant execute on function public.clair_get_chart_order_execution_read_model(text,uuid)
  to authenticated;

comment on function public.clair_transition_fulfillment_work_item(
  text,uuid,uuid,text,bigint,uuid,uuid,text,text
) is 'Actor-bound, capability-checked, CAS and command-idempotent work lifecycle transition.';
