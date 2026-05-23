-- DEN-236: order fulfillment work item schema and RPC contract.
-- Local-first migration file only. Remote staging application requires dry-run review first.

create table if not exists public.order_fulfillment_work_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.workspaces(id) on delete cascade,
  encounter_id uuid not null references public.encounters(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  order_type text not null
    check (order_type in ('lab', 'imaging', 'dispensing', 'treatment')),
  queue_type text not null
    check (queue_type in ('lab', 'imaging', 'dispensing', 'treatment')),
  status text not null default 'requested'
    check (status in ('requested', 'accepted', 'in_progress', 'completed', 'cancelled', 'returned')),
  priority text not null default 'normal'
    check (priority in ('urgent', 'high', 'normal', 'low')),
  requested_by_user_id uuid references public.users(id) on delete set null,
  assigned_to_user_id uuid references public.users(id) on delete set null,
  due_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  returned_at timestamptz,
  reason text,
  source_snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(source_snapshot) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, order_id),
  check (workspace_id <> ''),
  check (order_type = queue_type),
  check (status <> 'completed' or completed_at is not null),
  check (status <> 'cancelled' or cancelled_at is not null),
  check (status <> 'returned' or returned_at is not null)
);

create index if not exists order_fulfillment_work_items_workspace_queue_status_idx
  on public.order_fulfillment_work_items (workspace_id, queue_type, status, updated_at desc);

create index if not exists order_fulfillment_work_items_workspace_encounter_idx
  on public.order_fulfillment_work_items (workspace_id, encounter_id, queue_type);

alter table public.order_fulfillment_work_items enable row level security;

drop policy if exists order_fulfillment_work_items_workspace_member_select
  on public.order_fulfillment_work_items;
create policy order_fulfillment_work_items_workspace_member_select
  on public.order_fulfillment_work_items
  for select
  using (private.clair_is_active_workspace_member(workspace_id));

drop policy if exists order_fulfillment_work_items_workspace_member_write
  on public.order_fulfillment_work_items;
create policy order_fulfillment_work_items_workspace_member_write
  on public.order_fulfillment_work_items
  for all
  using (private.clair_is_active_workspace_member(workspace_id))
  with check (private.clair_is_active_workspace_member(workspace_id));

create or replace function private.clair_fulfillment_transition_allowed(
  p_current_status text,
  p_next_status text
)
returns boolean
language sql
stable
as $$
  select
    p_current_status = p_next_status
    or (
      p_current_status = 'requested'
      and p_next_status in ('accepted', 'cancelled', 'returned')
    )
    or (
      p_current_status = 'accepted'
      and p_next_status in ('in_progress', 'cancelled', 'returned')
    )
    or (
      p_current_status = 'in_progress'
      and p_next_status in ('completed', 'cancelled', 'returned')
    )
    or (
      p_current_status = 'returned'
      and p_next_status in ('requested', 'cancelled')
    );
$$;

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
set search_path = public, private
as $$
declare
  v_rows jsonb;
begin
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing';
  end if;

  if p_queue_type not in ('lab', 'imaging', 'dispensing', 'treatment') then
    raise exception 'unsupported_order_type';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', item.id,
        'workspaceId', item.workspace_id,
        'encounterId', item.encounter_id,
        'orderId', item.order_id,
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
      )
      order by item.updated_at desc, item.id
    ),
    '[]'::jsonb
  )
  into v_rows
  from public.order_fulfillment_work_items item
  where item.workspace_id = p_workspace_id
    and item.queue_type = p_queue_type
    and (p_encounter_id is null or item.encounter_id = p_encounter_id)
    and (p_order_id is null or item.order_id = p_order_id)
    and (p_status is null or item.status = p_status);

  return v_rows;
end;
$$;

create or replace function public.clair_sync_fulfillment_work_items_from_orders(
  p_workspace_id text,
  p_actor_user_id uuid,
  p_encounter_id uuid,
  p_order_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_matched_count integer := 0;
  v_now timestamptz := now();
  v_rows jsonb;
  v_selected_count integer := coalesce(array_length(p_order_ids, 1), 0);
begin
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing';
  end if;

  if not exists (
    select 1
    from public.encounters e
    where e.workspace_id = p_workspace_id
      and e.id = p_encounter_id
      and e.status <> 'cancelled'
  ) then
    raise exception 'encounter_unavailable';
  end if;

  if v_selected_count = 0 or v_selected_count > 100 then
    raise exception 'order_unavailable';
  end if;

  select count(*)
  into v_matched_count
  from public.orders o
  where o.workspace_id = p_workspace_id
    and o.encounter_id = p_encounter_id
    and o.id = any(p_order_ids)
    and o.status <> 'cancelled'
    and o.order_type in ('lab', 'imaging', 'dispensing', 'treatment');

  if v_matched_count <> v_selected_count then
    raise exception 'order_unavailable';
  end if;

  insert into public.order_fulfillment_work_items (
    workspace_id,
    encounter_id,
    order_id,
    order_type,
    queue_type,
    status,
    priority,
    requested_by_user_id,
    assigned_to_user_id,
    due_at,
    completed_at,
    returned_at,
    source_snapshot,
    created_at,
    updated_at
  )
  select
    o.workspace_id,
    o.encounter_id,
    o.id,
    o.order_type,
    o.order_type,
    case
      when o.status = 're_requested' then 'returned'
      when o.status = 'in_progress' then 'in_progress'
      when o.status = 'completed' or o.work_status = 'completed' then 'completed'
      else 'requested'
    end,
    o.priority,
    coalesce(o.requested_by_user_id, p_actor_user_id),
    o.current_assignee_user_id,
    o.due_at,
    case when o.status = 'completed' or o.work_status = 'completed' then v_now else null end,
    case when o.status = 're_requested' then v_now else null end,
    jsonb_strip_nulls(jsonb_build_object(
      'patientName', p.name,
      'guardianName', g.name,
      'orderDisplayName', o.display_name,
      'serviceItemId', o.service_item_id,
      'billingReflectionEnabled', coalesce(o.billing_reflection_enabled, true),
      'instruction', o.instruction,
      'detail', jsonb_build_object(
        'orderType', o.order_type,
        'priority', o.priority,
        'warningMessage', o.warning_message
      )
    )),
    v_now,
    v_now
  from public.orders o
  join public.encounters e
    on e.workspace_id = o.workspace_id
   and e.id = o.encounter_id
  left join public.patients p
    on p.workspace_id = o.workspace_id
   and p.id = e.patient_id
  left join public.guardians g
    on g.workspace_id = o.workspace_id
   and g.id = e.guardian_id
  where o.workspace_id = p_workspace_id
    and o.encounter_id = p_encounter_id
    and o.id = any(p_order_ids)
  on conflict (workspace_id, order_id)
  do update set
    assigned_to_user_id = excluded.assigned_to_user_id,
    due_at = excluded.due_at,
    priority = excluded.priority,
    source_snapshot = excluded.source_snapshot,
    updated_at = v_now;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', item.id,
        'workspaceId', item.workspace_id,
        'encounterId', item.encounter_id,
        'orderId', item.order_id,
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
      )
      order by item.updated_at desc, item.id
    ),
    '[]'::jsonb
  )
  into v_rows
  from public.order_fulfillment_work_items item
  where item.workspace_id = p_workspace_id
    and item.encounter_id = p_encounter_id
    and item.order_id = any(p_order_ids);

  return v_rows;
end;
$$;

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
set search_path = public, private
as $$
declare
  v_item public.order_fulfillment_work_items%rowtype;
  v_now timestamptz := now();
begin
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing';
  end if;

  select *
  into v_item
  from public.order_fulfillment_work_items item
  where item.workspace_id = p_workspace_id
    and item.id = p_work_item_id
  for update;

  if v_item.id is null then
    raise exception 'work_item_unavailable';
  end if;

  if p_status not in ('requested', 'accepted', 'in_progress', 'completed', 'cancelled', 'returned') then
    raise exception 'invalid_transition';
  end if;

  if not private.clair_fulfillment_transition_allowed(v_item.status, p_status) then
    raise exception 'invalid_transition';
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
  where item.workspace_id = p_workspace_id
    and item.id = p_work_item_id;

  insert into public.order_events (
    workspace_id,
    order_id,
    event_type,
    performed_by_user_id,
    payload,
    created_at
  )
  values (
    p_workspace_id,
    v_item.order_id,
    case when p_status = 'completed' then 'completed' else 'edited' end,
    p_actor_user_id,
    jsonb_build_object(
      'action', 'fulfillment_work_item_update',
      'fulfillmentWorkItemId', p_work_item_id,
      'previousStatus', v_item.status,
      'nextStatus', p_status
    ),
    v_now
  );

  return public.clair_list_fulfillment_work_items(
    p_workspace_id,
    v_item.queue_type,
    v_item.encounter_id,
    v_item.order_id,
    null
  );
end;
$$;

grant execute on function public.clair_list_fulfillment_work_items(text, text, uuid, uuid, text)
  to authenticated;
grant execute on function public.clair_sync_fulfillment_work_items_from_orders(text, uuid, uuid, uuid[])
  to authenticated;
grant execute on function public.clair_update_fulfillment_work_item(text, uuid, uuid, text, uuid, text)
  to authenticated;
