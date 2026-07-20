-- RECEPTION-PR-017 follow-up: role-agnostic operational assignees for walk-in encounters.

alter table public.encounters
  add constraint encounters_workspace_id_id_key unique (workspace_id, id);

create table public.encounter_staff_assignments (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.workspaces(id) on delete cascade,
  encounter_id uuid not null,
  assignee_user_id uuid not null,
  created_by_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (workspace_id, encounter_id, assignee_user_id),
  foreign key (workspace_id, encounter_id)
    references public.encounters(workspace_id, id) on delete cascade,
  foreign key (workspace_id, assignee_user_id)
    references public.user_memberships(workspace_id, user_id)
);

create index encounter_staff_assignments_workspace_assignee_idx
  on public.encounter_staff_assignments (workspace_id, assignee_user_id, encounter_id);

alter table public.encounter_staff_assignments enable row level security;
revoke all on table public.encounter_staff_assignments from public, anon, authenticated;

comment on table public.encounter_staff_assignments is
  'Role-agnostic operational assignees for a walk-in encounter; distinct from the primary veterinarian.';

insert into public.encounter_staff_assignments (
  workspace_id,
  encounter_id,
  assignee_user_id,
  created_by_user_id
)
select
  e.workspace_id,
  e.id,
  e.primary_veterinarian_id,
  e.checked_in_by_user_id
from public.encounters e
where e.primary_veterinarian_id is not null
on conflict (workspace_id, encounter_id, assignee_user_id) do nothing;

alter function public.clair_create_reception_walk_in_encounter(text, text, jsonb)
  rename to clair_create_reception_walk_in_encounter_base;

revoke all on function public.clair_create_reception_walk_in_encounter_base(text, text, jsonb)
  from public, anon, authenticated;

create function public.clair_create_reception_walk_in_encounter(
  p_workspace_id text,
  p_actor_user_id text,
  p_walk_in jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions, pg_temp
as $$
declare
  v_actor_user_id uuid := nullif(p_actor_user_id, '')::uuid;
  v_primary_veterinarian_id uuid := nullif(p_walk_in->>'primaryVeterinarianId', '')::uuid;
  v_assignment_user_ids uuid[] := '{}'::uuid[];
  v_result jsonb;
  v_encounter_id uuid;
begin
  if v_actor_user_id is null or v_actor_user_id <> auth.uid() then
    raise exception 'actor_mismatch';
  end if;

  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing';
  end if;

  if p_walk_in ? 'assignedStaffUserIds'
    and jsonb_typeof(p_walk_in->'assignedStaffUserIds') <> 'array' then
    raise exception 'assigned_staff_unavailable';
  end if;

  if exists (
    select 1
    from jsonb_array_elements_text(
      coalesce(p_walk_in->'assignedStaffUserIds', '[]'::jsonb)
    ) as staff(user_id)
    where staff.user_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ) then
    raise exception 'assigned_staff_unavailable';
  end if;

  select coalesce(array_agg(distinct staff.user_id::uuid), '{}'::uuid[])
  into v_assignment_user_ids
  from jsonb_array_elements_text(
    coalesce(p_walk_in->'assignedStaffUserIds', '[]'::jsonb)
  ) as staff(user_id);

  if v_primary_veterinarian_id is not null then
    v_assignment_user_ids := array(
      select distinct assignee_user_id
      from unnest(
        array_append(v_assignment_user_ids, v_primary_veterinarian_id)
      ) as assignee_user_id
    );
  end if;

  if exists (
    select 1
    from unnest(v_assignment_user_ids) as assignment(assignee_user_id)
    left join public.user_memberships um
      on um.workspace_id = p_workspace_id
      and um.user_id = assignment.assignee_user_id
    left join public.users u
      on u.id = assignment.assignee_user_id
    where um.user_id is null
      or um.status <> 'active'
      or cardinality(um.roles) = 0
      or u.id is null
      or u.status <> 'active'
  ) then
    raise exception 'assigned_staff_unavailable';
  end if;

  v_result := public.clair_create_reception_walk_in_encounter_base(
    p_workspace_id,
    p_actor_user_id,
    p_walk_in
  );
  v_encounter_id := nullif(v_result #>> '{encounter,id}', '')::uuid;

  if v_encounter_id is null then
    raise exception 'walk_in_write_failed';
  end if;

  insert into public.encounter_staff_assignments (
    workspace_id,
    encounter_id,
    assignee_user_id,
    created_by_user_id
  )
  select
    p_workspace_id,
    v_encounter_id,
    assignee_user_id,
    v_actor_user_id
  from unnest(v_assignment_user_ids) as assignee_user_id
  on conflict (workspace_id, encounter_id, assignee_user_id) do nothing;

  return jsonb_set(
    v_result,
    '{encounter,assignedStaffUserIds}',
    to_jsonb(v_assignment_user_ids),
    true
  );
end;
$$;

revoke all on function public.clair_create_reception_walk_in_encounter(text, text, jsonb)
  from public, anon;
grant execute on function public.clair_create_reception_walk_in_encounter(text, text, jsonb)
  to authenticated;

alter function private.clair_list_reception_day_calendar_records(text, date)
  rename to clair_list_reception_day_calendar_records_appointment_base;

create function private.clair_list_reception_day_calendar_records(
  p_workspace_id text,
  p_day date
) returns jsonb
language sql
security definer
set search_path = public, private, pg_temp
as $$
  with source_records as (
    select value as record, ordinality
    from jsonb_array_elements(
      private.clair_list_reception_day_calendar_records_appointment_base(
        p_workspace_id,
        p_day
      )
    ) with ordinality
  )
  select coalesce(
    jsonb_agg(
      case
        when record->'encounter' is null or record->'encounter' = 'null'::jsonb then record
        else jsonb_set(
          record,
          '{encounter,assignedStaffUserIds}',
          coalesce((
            select jsonb_agg(
              assignment.assignee_user_id::text
              order by assignment.created_at, assignment.id
            )
            from public.encounter_staff_assignments assignment
            where assignment.workspace_id = p_workspace_id
              and assignment.encounter_id = (record #>> '{encounter,id}')::uuid
          ), '[]'::jsonb)
        )
      end
      order by ordinality
    ),
    '[]'::jsonb
  )
  from source_records;
$$;

revoke all on function private.clair_list_reception_day_calendar_records(text, date)
  from public, anon, authenticated;

alter function private.clair_list_reception_queue_internal(text, date, integer)
  rename to clair_list_reception_queue_internal_appointment_base;

create function private.clair_list_reception_queue_internal(
  p_workspace_id text,
  p_day date,
  p_limit integer default 100
) returns jsonb
language sql
security definer
set search_path = public, private, pg_temp
as $$
  with source_records as (
    select value as record, ordinality
    from jsonb_array_elements(
      private.clair_list_reception_queue_internal_appointment_base(
        p_workspace_id,
        p_day,
        p_limit
      )
    ) with ordinality
  )
  select coalesce(
    jsonb_agg(
      case
        when record->'encounter' is null or record->'encounter' = 'null'::jsonb then record
        else jsonb_set(
          record,
          '{encounter,assignedStaffUserIds}',
          coalesce((
            select jsonb_agg(
              assignment.assignee_user_id::text
              order by assignment.created_at, assignment.id
            )
            from public.encounter_staff_assignments assignment
            where assignment.workspace_id = p_workspace_id
              and assignment.encounter_id = (record #>> '{encounter,id}')::uuid
          ), '[]'::jsonb)
        )
      end
      order by ordinality
    ),
    '[]'::jsonb
  )
  from source_records;
$$;

revoke all on function private.clair_list_reception_queue_internal(text, date, integer)
  from public, anon, authenticated;
