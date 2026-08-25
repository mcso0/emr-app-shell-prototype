-- Chart order execution Phase 2: universal task attempts, immutable task events,
-- aggregate-state calculation, and the existing fulfillment row as a routed
-- queue projection. This is an additive expand migration for the deployed app.

set lock_timeout = '5s';
set statement_timeout = '120s';

create table if not exists public.order_tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.workspaces(id) on delete cascade,
  encounter_id uuid not null,
  order_id uuid not null,
  parent_task_id uuid,
  task_role text not null
    check (task_role in ('execution', 'aggregate')),
  clinical_order_type text not null
    check (clinical_order_type in (
      'consultation','clinical_lab','imaging','external_lab',
      'dispensing','treatment','hospitalization','other'
    )),
  destination_module text,
  status text not null default 'pending'
    check (status in (
      'pending','in_progress','paused','partial_complete','complete','cancelled'
    )),
  priority text not null default 'normal'
    check (priority in ('normal','urgent')),
  attempt_no integer not null default 1 check (attempt_no > 0),
  re_requested_from_task_id uuid,
  effective_snapshot jsonb not null
    check (jsonb_typeof(effective_snapshot) = 'object'),
  result_snapshot jsonb
    check (result_snapshot is null or jsonb_typeof(result_snapshot) = 'object'),
  created_by_user_id uuid not null references public.users(id) on delete restrict,
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, id, attempt_no),
  unique (workspace_id, order_id, attempt_no),
  foreign key (workspace_id, encounter_id)
    references public.encounters(workspace_id, id) on delete restrict,
  foreign key (workspace_id, order_id)
    references public.orders(workspace_id, id) on delete restrict,
  foreign key (workspace_id, parent_task_id)
    references public.order_tasks(workspace_id, id) on delete restrict,
  foreign key (workspace_id, re_requested_from_task_id)
    references public.order_tasks(workspace_id, id) on delete restrict,
  check (
    (task_role = 'aggregate' and parent_task_id is null and destination_module is null)
    or task_role = 'execution'
  ),
  check (
    task_role = 'aggregate'
    or destination_module is not null
    or status = 'complete'
  ),
  check (status <> 'in_progress' or started_at is not null),
  check (status <> 'complete' or completed_at is not null),
  check (status <> 'cancelled' or cancelled_at is not null),
  check (parent_task_id is null or parent_task_id <> id),
  check (re_requested_from_task_id is null or re_requested_from_task_id <> id)
);

create index if not exists order_tasks_workspace_encounter_status_idx
  on public.order_tasks(workspace_id, encounter_id, status, updated_at desc);
create index if not exists order_tasks_workspace_destination_status_idx
  on public.order_tasks(workspace_id, destination_module, status, updated_at desc)
  where task_role = 'execution' and destination_module is not null;
create index if not exists order_tasks_parent_idx
  on public.order_tasks(workspace_id, parent_task_id, attempt_no)
  where parent_task_id is not null;
create index if not exists order_tasks_re_requested_from_idx
  on public.order_tasks(workspace_id, re_requested_from_task_id)
  where re_requested_from_task_id is not null;

create table if not exists public.order_task_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.workspaces(id) on delete cascade,
  task_id uuid not null,
  task_attempt_no integer not null check (task_attempt_no > 0),
  order_id uuid not null,
  event_type text not null
    check (event_type in (
      'created','started','paused','resumed','completed','cancelled',
      'amended','re_requested','priority_changed'
    )),
  actor_user_id uuid not null references public.users(id) on delete restrict,
  reason text,
  before_values jsonb not null default '{}'::jsonb
    check (jsonb_typeof(before_values) = 'object'),
  after_values jsonb not null default '{}'::jsonb
    check (jsonb_typeof(after_values) = 'object'),
  command_id uuid,
  created_at timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, task_id, task_attempt_no)
    references public.order_tasks(workspace_id, id, attempt_no) on delete restrict,
  foreign key (workspace_id, order_id)
    references public.orders(workspace_id, id) on delete restrict,
  check (
    event_type not in ('cancelled','amended','re_requested','priority_changed')
    or length(btrim(coalesce(reason, ''))) > 0
  )
);

create index if not exists order_task_events_task_history_idx
  on public.order_task_events(workspace_id, task_id, task_attempt_no, created_at, id);
create index if not exists order_task_events_order_history_idx
  on public.order_task_events(workspace_id, order_id, created_at, id);
create index if not exists order_task_events_command_idx
  on public.order_task_events(workspace_id, command_id)
  where command_id is not null;

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

    if old.status in ('complete','cancelled')
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
      or v_previous.status not in ('complete','cancelled')
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

drop trigger if exists order_tasks_identity_history_guard_trg on public.order_tasks;
create trigger order_tasks_identity_history_guard_trg
before insert or update on public.order_tasks
for each row execute function private.clair_assert_order_task_identity_and_history();

create or replace function private.clair_assert_order_task_event_identity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_task public.order_tasks%rowtype;
begin
  select * into v_task
  from public.order_tasks task
  where task.workspace_id = new.workspace_id
    and task.id = new.task_id
    and task.attempt_no = new.task_attempt_no;
  if not found or v_task.order_id is distinct from new.order_id then
    raise exception 'task_event_identity_mismatch' using errcode = '23514';
  end if;
  return new;
end;
$function$;

drop trigger if exists order_task_events_identity_guard_trg on public.order_task_events;
create trigger order_task_events_identity_guard_trg
before insert on public.order_task_events
for each row execute function private.clair_assert_order_task_event_identity();

create or replace function private.clair_reject_order_task_event_mutation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
begin
  raise exception 'task_event_immutable' using errcode = '55000';
end;
$function$;

drop trigger if exists order_task_events_immutable_trg on public.order_task_events;
create trigger order_task_events_immutable_trg
before update or delete on public.order_task_events
for each row execute function private.clair_reject_order_task_event_mutation();

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
  v_in_progress integer;
  v_paused integer;
  v_terminal integer;
begin
  select task.task_role into v_role
  from public.order_tasks task
  where task.workspace_id = p_workspace_id
    and task.id = p_aggregate_task_id;
  if v_role is distinct from 'aggregate' then
    raise exception 'aggregate_task_unavailable';
  end if;

  select
    count(*),
    count(*) filter (where child.status = 'cancelled'),
    count(*) filter (where child.status = 'complete'),
    count(*) filter (where child.status = 'in_progress'),
    count(*) filter (where child.status = 'paused'),
    count(*) filter (where child.status in ('complete','cancelled'))
  into v_total, v_cancelled, v_complete, v_in_progress, v_paused, v_terminal
  from public.order_tasks child
  where child.workspace_id = p_workspace_id
    and child.parent_task_id = p_aggregate_task_id;

  if v_total > 0 and v_cancelled = v_total then return 'cancelled'; end if;
  if v_total > 0 and v_terminal = v_total and v_complete > 0 then return 'complete'; end if;
  if v_in_progress > 0 then return 'in_progress'; end if;
  if v_terminal > 0 and v_terminal < v_total then return 'partial_complete'; end if;
  if v_paused > 0 then return 'paused'; end if;
  return 'pending';
end;
$function$;

revoke all on function private.clair_calculate_aggregate_task_status(text, uuid)
  from public, anon, authenticated, service_role;

-- Extend the current fulfillment work item into a task-linked queue projection
-- without removing the legacy projection key used by the deployed client.
alter table public.order_fulfillment_work_items
  add column if not exists task_id uuid,
  add column if not exists task_attempt_no integer,
  add column if not exists clinical_order_type text,
  add column if not exists destination_module text;

update public.order_fulfillment_work_items item
set
  clinical_order_type = coalesce(item.clinical_order_type, orders.clinical_order_type),
  destination_module = coalesce(item.destination_module, orders.destination_module, item.queue_type)
from public.orders orders
where orders.workspace_id = item.workspace_id
  and orders.id = item.order_id
  and (item.clinical_order_type is null or item.destination_module is null);

alter table public.order_fulfillment_work_items
  drop constraint if exists order_fulfillment_work_items_queue_type_check,
  drop constraint if exists order_fulfillment_work_items_check;

alter table public.order_fulfillment_work_items
  add constraint order_fulfillment_work_items_queue_type_v2_check
    check (queue_type in (
      'consultation','lab','imaging','external_lab','dispensing',
      'treatment','hospitalization','other'
    )) not valid,
  add constraint order_fulfillment_work_items_clinical_type_check
    check (clinical_order_type is null or clinical_order_type in (
      'consultation','clinical_lab','imaging','external_lab',
      'dispensing','treatment','hospitalization','other'
    )) not valid,
  add constraint order_fulfillment_work_items_destination_check
    check (destination_module is null or destination_module in (
      'consultation','lab','imaging','external_lab','dispensing',
      'treatment','hospitalization','other'
    )) not valid,
  add constraint order_fulfillment_work_items_task_link_check
    check (
      (task_id is null and task_attempt_no is null)
      or (task_id is not null and task_attempt_no is not null
          and destination_module = queue_type)
    ) not valid,
  add constraint order_fulfillment_work_items_task_fkey
    foreign key (workspace_id, task_id, task_attempt_no)
    references public.order_tasks(workspace_id, id, attempt_no) on delete restrict
    not valid;

alter table public.order_fulfillment_work_items
  validate constraint order_fulfillment_work_items_queue_type_v2_check,
  validate constraint order_fulfillment_work_items_clinical_type_check,
  validate constraint order_fulfillment_work_items_destination_check,
  validate constraint order_fulfillment_work_items_task_link_check,
  validate constraint order_fulfillment_work_items_task_fkey;

create unique index if not exists order_fulfillment_work_items_task_key
  on public.order_fulfillment_work_items(workspace_id, task_id)
  where task_id is not null;
create index if not exists order_fulfillment_work_items_destination_status_idx
  on public.order_fulfillment_work_items(
    workspace_id, destination_module, status, updated_at desc
  ) where destination_module is not null;

create or replace function private.clair_assert_queue_projection_task()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_task public.order_tasks%rowtype;
begin
  if new.task_id is null then return new; end if;
  select * into v_task
  from public.order_tasks task
  where task.workspace_id = new.workspace_id
    and task.id = new.task_id
    and task.attempt_no = new.task_attempt_no;
  if not found
    or v_task.task_role <> 'execution'
    or v_task.encounter_id is distinct from new.encounter_id
    or v_task.order_id is distinct from new.order_id
    or v_task.destination_module is null
    or v_task.destination_module is distinct from new.destination_module
    or new.destination_module is distinct from new.queue_type
    or v_task.clinical_order_type is distinct from new.clinical_order_type
  then
    raise exception 'queue_projection_task_mismatch' using errcode = '23514';
  end if;
  return new;
end;
$function$;

drop trigger if exists order_fulfillment_work_items_task_guard_trg
  on public.order_fulfillment_work_items;
create trigger order_fulfillment_work_items_task_guard_trg
before insert or update of task_id, task_attempt_no, clinical_order_type,
  destination_module, queue_type, order_id, encounter_id
on public.order_fulfillment_work_items
for each row execute function private.clair_assert_queue_projection_task();

create or replace function private.clair_queue_permission_for_destination(
  p_destination_module text,
  p_action text
)
returns text
language sql
immutable
set search_path = pg_catalog
as $function$
  select case
    when p_destination_module in ('lab','external_lab')
      then case when p_action = 'read' then 'lab:view' else 'lab:complete' end
    when p_destination_module = 'imaging'
      then case when p_action = 'read' then 'imaging:view' else 'imaging:complete' end
    when p_destination_module in ('dispensing','treatment','hospitalization')
      then case when p_action = 'read' then 'dispensing:view' else 'dispensing:complete' end
    else case when p_action = 'read' then 'chart:view' else 'chart:update' end
  end;
$function$;

revoke all on function private.clair_queue_permission_for_destination(text, text)
  from public, anon, authenticated, service_role;

alter table public.order_tasks enable row level security;
alter table public.order_task_events enable row level security;

drop policy if exists order_tasks_workspace_chart_select on public.order_tasks;
create policy order_tasks_workspace_chart_select
  on public.order_tasks for select
  using (
    private.clair_is_active_workspace_member(workspace_id)
    and private.clair_current_user_has_workspace_permission(workspace_id, 'chart:view')
  );

drop policy if exists order_task_events_workspace_chart_select
  on public.order_task_events;
create policy order_task_events_workspace_chart_select
  on public.order_task_events for select
  using (
    private.clair_is_active_workspace_member(workspace_id)
    and private.clair_current_user_has_workspace_permission(workspace_id, 'chart:view')
    and exists (
      select 1 from public.order_tasks task
      where task.workspace_id = order_task_events.workspace_id
        and task.id = order_task_events.task_id
        and task.attempt_no = order_task_events.task_attempt_no
    )
  );

drop policy if exists order_fulfillment_work_items_workspace_member_select
  on public.order_fulfillment_work_items;
create policy order_fulfillment_work_items_workspace_capability_select
  on public.order_fulfillment_work_items for select
  using (
    private.clair_is_active_workspace_member(workspace_id)
    and private.clair_current_user_has_workspace_permission(
      workspace_id,
      private.clair_queue_permission_for_destination(
        coalesce(destination_module, queue_type),
        'read'
      )
    )
  );

drop policy if exists order_fulfillment_work_items_workspace_member_write
  on public.order_fulfillment_work_items;

revoke all on table public.order_tasks, public.order_task_events
  from public, anon, authenticated;
grant select on table public.order_tasks, public.order_task_events to authenticated;
revoke insert, update, delete on table public.order_fulfillment_work_items
  from authenticated;

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
  ) then
    raise exception 'unsupported_order_type';
  end if;
  if not private.clair_current_user_has_workspace_permission(
    p_workspace_id,
    private.clair_queue_permission_for_destination(p_queue_type, 'read')
  ) then
    raise exception 'permission_missing';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', item.id,
    'workspaceId', item.workspace_id,
    'encounterId', item.encounter_id,
    'orderId', item.order_id,
    'taskId', item.task_id,
    'taskAttemptNo', item.task_attempt_no,
    'clinicalOrderType', item.clinical_order_type,
    'destinationModule', item.destination_module,
    'orderType', item.order_type,
    'queueType', item.queue_type,
    'status', item.status,
    'priority', item.priority,
    'requestedByUserId', item.requested_by_user_id,
    'assignedToUserId', item.assigned_to_user_id,
    'dueAt', item.due_at,
    'completedAt', item.completed_at,
    'cancelledAt', item.cancelled_at,
    'returnedAt', item.returned_at,
    'reason', item.reason,
    'sourceSnapshot', item.source_snapshot,
    'createdAt', item.created_at,
    'updatedAt', item.updated_at
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
  from public, anon;
grant execute on function public.clair_list_fulfillment_work_items(text,text,uuid,uuid,text)
  to authenticated;

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
    assigned_to_user_id = coalesce(p_assigned_to_user_id, item.assigned_to_user_id),
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

revoke all on function public.clair_update_fulfillment_work_item(text,uuid,uuid,text,uuid,text)
  from public, anon;
grant execute on function public.clair_update_fulfillment_work_item(text,uuid,uuid,text,uuid,text)
  to authenticated;

comment on table public.order_tasks is
  'One immutable-identity universal execution or aggregate attempt per confirmed Order.';
comment on table public.order_task_events is
  'Append-only actor/reason/before/after history for universal task attempts.';
comment on column public.order_fulfillment_work_items.task_id is
  'Nullable only for pre-backfill legacy rows; task-linked rows are routed execution queue projections.';
