-- DEN-452: lab result entry persistence foundation.
-- Local/dev/test scope only. Remote Supabase replay remains approval-gated.

create table if not exists public.lab_result_entries (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.workspaces(id) on delete cascade,
  result_id text not null check (length(trim(result_id)) > 0),
  encounter_id uuid not null references public.encounters(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  work_item_id uuid references public.order_fulfillment_work_items(id) on delete set null,
  result_status text not null default 'entered'
    check (result_status in ('received', 'entered', 'reviewed', 'corrected', 'cancelled')),
  result_payload jsonb not null default '{}'::jsonb check (jsonb_typeof(result_payload) = 'object'),
  abnormal_flag text not null default 'not_judged'
    check (abnormal_flag in ('normal', 'low', 'high', 'critical', 'not_judged')),
  entered_by_user_id uuid references public.users(id) on delete set null,
  entered_at timestamptz not null default now(),
  reviewed_by_user_id uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, result_id),
  check (workspace_id <> '')
);

create table if not exists public.lab_result_entry_rows (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.workspaces(id) on delete cascade,
  lab_result_entry_id uuid not null references public.lab_result_entries(id) on delete cascade,
  row_id text not null check (length(trim(row_id)) > 0),
  lab_test_item_id text references public.lab_test_items(id) on delete restrict,
  analyte_name text not null check (length(trim(analyte_name)) > 0),
  result_value text,
  result_unit text,
  reference_range text,
  judgment text not null default 'not_judged'
    check (judgment in ('low', 'normal', 'high', 'critical', 'not_judged')),
  note text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lab_result_entry_id, row_id),
  check (workspace_id <> '')
);

create index if not exists lab_result_entries_workspace_order_idx
  on public.lab_result_entries (workspace_id, order_id, updated_at desc);

create index if not exists lab_result_entries_workspace_work_item_idx
  on public.lab_result_entries (workspace_id, work_item_id, updated_at desc)
  where work_item_id is not null;

create index if not exists lab_result_entry_rows_entry_sort_idx
  on public.lab_result_entry_rows (lab_result_entry_id, sort_order, row_id);

create index if not exists lab_result_entry_rows_workspace_lab_item_idx
  on public.lab_result_entry_rows (workspace_id, lab_test_item_id)
  where lab_test_item_id is not null;

alter table public.lab_result_entries enable row level security;
alter table public.lab_result_entry_rows enable row level security;

grant select, insert, update, delete on public.lab_result_entries to authenticated;
grant select, insert, update, delete on public.lab_result_entry_rows to authenticated;

drop policy if exists lab_result_entries_workspace_member_select
  on public.lab_result_entries;
create policy lab_result_entries_workspace_member_select
on public.lab_result_entries
for select
to authenticated
using (private.clair_is_active_workspace_member(workspace_id));

drop policy if exists lab_result_entries_workspace_member_write
  on public.lab_result_entries;
create policy lab_result_entries_workspace_member_write
on public.lab_result_entries
for all
to authenticated
using (private.clair_is_active_workspace_member(workspace_id))
with check (private.clair_is_active_workspace_member(workspace_id));

drop policy if exists lab_result_entry_rows_workspace_member_select
  on public.lab_result_entry_rows;
create policy lab_result_entry_rows_workspace_member_select
on public.lab_result_entry_rows
for select
to authenticated
using (private.clair_is_active_workspace_member(workspace_id));

drop policy if exists lab_result_entry_rows_workspace_member_write
  on public.lab_result_entry_rows;
create policy lab_result_entry_rows_workspace_member_write
on public.lab_result_entry_rows
for all
to authenticated
using (private.clair_is_active_workspace_member(workspace_id))
with check (private.clair_is_active_workspace_member(workspace_id));

create or replace function private.clair_lab_result_abnormal_flag(p_rows jsonb)
returns text
language sql
stable
as $$
  select case
    when exists (
      select 1 from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) row
      where row ->> 'judgment' = 'critical'
    ) then 'critical'
    when exists (
      select 1 from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) row
      where row ->> 'judgment' = 'high'
    ) then 'high'
    when exists (
      select 1 from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) row
      where row ->> 'judgment' = 'low'
    ) then 'low'
    when exists (
      select 1 from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) row
      where row ->> 'judgment' = 'normal'
    ) then 'normal'
    else 'not_judged'
  end;
$$;

create or replace function public.clair_save_lab_result_entry(
  p_workspace_id text,
  p_actor_user_id uuid,
  p_result_id text,
  p_encounter_id uuid,
  p_order_id uuid,
  p_work_item_id uuid,
  p_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_entry_id uuid;
  v_now timestamptz := now();
  v_rows jsonb := coalesce(p_rows, '[]'::jsonb);
  v_saved_result jsonb;
  v_affected_lab_test_item_ids text[] := '{}';
begin
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing';
  end if;

  if length(trim(coalesce(p_result_id, ''))) = 0
    or jsonb_typeof(v_rows) <> 'array'
    or jsonb_array_length(v_rows) = 0
    or jsonb_array_length(v_rows) > 200 then
    raise exception 'invalid_lab_result_entry_payload';
  end if;

  if not exists (
    select 1
    from public.encounters encounter
    where encounter.workspace_id = p_workspace_id
      and encounter.id = p_encounter_id
      and encounter.status <> 'cancelled'
  ) then
    raise exception 'encounter_unavailable';
  end if;

  if not exists (
    select 1
    from public.orders order_row
    where order_row.workspace_id = p_workspace_id
      and order_row.encounter_id = p_encounter_id
      and order_row.id = p_order_id
      and order_row.order_type = 'lab'
      and order_row.status <> 'cancelled'
  ) then
    raise exception 'order_unavailable';
  end if;

  if p_work_item_id is not null and not exists (
    select 1
    from public.order_fulfillment_work_items work_item
    where work_item.workspace_id = p_workspace_id
      and work_item.encounter_id = p_encounter_id
      and work_item.order_id = p_order_id
      and work_item.id = p_work_item_id
      and work_item.queue_type = 'lab'
  ) then
    raise exception 'work_item_unavailable';
  end if;

  insert into public.lab_result_entries (
    workspace_id,
    result_id,
    encounter_id,
    order_id,
    work_item_id,
    result_status,
    result_payload,
    abnormal_flag,
    entered_by_user_id,
    entered_at,
    created_at,
    updated_at
  )
  values (
    p_workspace_id,
    p_result_id,
    p_encounter_id,
    p_order_id,
    p_work_item_id,
    'entered',
    jsonb_build_object('rows', v_rows),
    private.clair_lab_result_abnormal_flag(v_rows),
    p_actor_user_id,
    v_now,
    v_now,
    v_now
  )
  on conflict (workspace_id, result_id) do update
  set
    encounter_id = excluded.encounter_id,
    order_id = excluded.order_id,
    work_item_id = excluded.work_item_id,
    result_status = excluded.result_status,
    result_payload = excluded.result_payload,
    abnormal_flag = excluded.abnormal_flag,
    entered_by_user_id = excluded.entered_by_user_id,
    entered_at = excluded.entered_at,
    updated_at = excluded.updated_at
  returning id into v_entry_id;

  select coalesce(array_agg(distinct affected.lab_test_item_id), '{}'::text[])
  into v_affected_lab_test_item_ids
  from (
    select existing_row.lab_test_item_id
    from public.lab_result_entry_rows existing_row
    where existing_row.lab_result_entry_id = v_entry_id
      and existing_row.lab_test_item_id is not null
    union
    select nullif(row_data.row_value ->> 'labTestItemId', '')
    from jsonb_array_elements(v_rows) as row_data(row_value)
    where length(trim(coalesce(row_data.row_value ->> 'labTestItemId', ''))) > 0
  ) affected(lab_test_item_id);

  delete from public.lab_result_entry_rows
  where lab_result_entry_id = v_entry_id;

  insert into public.lab_result_entry_rows (
    workspace_id,
    lab_result_entry_id,
    row_id,
    lab_test_item_id,
    analyte_name,
    result_value,
    result_unit,
    reference_range,
    judgment,
    note,
    sort_order,
    created_at,
    updated_at
  )
  select
    p_workspace_id,
    v_entry_id,
    row_data.row_value ->> 'id',
    nullif(row_data.row_value ->> 'labTestItemId', ''),
    row_data.row_value ->> 'analyteName',
    nullif(row_data.row_value ->> 'value', ''),
    nullif(row_data.row_value ->> 'unit', ''),
    nullif(row_data.row_value ->> 'referenceRange', ''),
    case
      when row_data.row_value ->> 'judgment' in ('low', 'normal', 'high', 'critical', 'not_judged')
        then row_data.row_value ->> 'judgment'
      else 'not_judged'
    end,
    nullif(row_data.row_value ->> 'note', ''),
    row_data.ordinality::integer,
    v_now,
    v_now
  from jsonb_array_elements(v_rows) with ordinality as row_data(row_value, ordinality)
  where length(trim(coalesce(row_data.row_value ->> 'id', ''))) > 0
    and length(trim(coalesce(row_data.row_value ->> 'analyteName', ''))) > 0;

  if coalesce(array_length(v_affected_lab_test_item_ids, 1), 0) > 0 then
    update public.lab_test_items item
    set
      saved_result_usage_count = (
        select count(*)::integer
        from public.lab_result_entry_rows row
        where row.workspace_id = p_workspace_id
          and row.lab_test_item_id = item.id
      ),
      updated_at = v_now
    where item.workspace_id = p_workspace_id
      and item.id = any(v_affected_lab_test_item_ids);
  end if;

  select public.clair_get_lab_result_entry(p_workspace_id, p_result_id, null, null)
  into v_saved_result;

  return v_saved_result;
end;
$$;

create or replace function public.clair_get_lab_result_entry(
  p_workspace_id text,
  p_result_id text default null,
  p_work_item_id uuid default null,
  p_order_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_entry public.lab_result_entries%rowtype;
  v_rows jsonb;
begin
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing';
  end if;

  select *
  into v_entry
  from public.lab_result_entries entry
  where entry.workspace_id = p_workspace_id
    and (p_result_id is null or entry.result_id = p_result_id)
    and (p_work_item_id is null or entry.work_item_id = p_work_item_id)
    and (p_order_id is null or entry.order_id = p_order_id)
  order by entry.updated_at desc, entry.id
  limit 1;

  if v_entry.id is null then
    return jsonb_build_object(
      'ok', true,
      'status', 200,
      'savedResult', null,
      'enforcedBy', 'lab-result-entry-persistence'
    );
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', row.row_id,
        'labTestItemId', row.lab_test_item_id,
        'analyteName', row.analyte_name,
        'value', row.result_value,
        'unit', row.result_unit,
        'referenceRange', row.reference_range,
        'judgment', row.judgment,
        'note', row.note
      )
      order by row.sort_order, row.row_id
    ),
    '[]'::jsonb
  )
  into v_rows
  from public.lab_result_entry_rows row
  where row.lab_result_entry_id = v_entry.id;

  return jsonb_build_object(
    'ok', true,
    'status', 200,
    'savedResult', jsonb_build_object(
      'id', v_entry.id,
      'workspaceId', v_entry.workspace_id,
      'resultId', v_entry.result_id,
      'encounterId', v_entry.encounter_id,
      'orderId', v_entry.order_id,
      'workItemId', v_entry.work_item_id,
      'resultStatus', v_entry.result_status,
      'abnormalFlag', v_entry.abnormal_flag,
      'actorUserId', v_entry.entered_by_user_id,
      'createdAt', v_entry.created_at,
      'updatedAt', v_entry.updated_at,
      'rows', v_rows
    ),
    'enforcedBy', 'lab-result-entry-persistence'
  );
end;
$$;

grant execute on function public.clair_save_lab_result_entry(text, uuid, text, uuid, uuid, uuid, jsonb)
  to authenticated;
grant execute on function public.clair_get_lab_result_entry(text, text, uuid, uuid)
  to authenticated;

comment on table public.lab_result_entries is
  'DEN-452 local/dev lab result entry header persistence. Real provider/device integrations remain out of scope.';
comment on table public.lab_result_entry_rows is
  'DEN-452 local/dev structured lab result row persistence linked to seeded lab test items when available.';
comment on function public.clair_save_lab_result_entry(text, uuid, text, uuid, uuid, uuid, jsonb) is
  'DEN-452 workspace-member guarded lab result save RPC for local/dev API wiring.';
comment on function public.clair_get_lab_result_entry(text, text, uuid, uuid) is
  'DEN-452 workspace-member guarded lab result readback RPC for local/dev API wiring.';
