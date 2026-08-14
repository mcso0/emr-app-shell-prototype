-- RECEPTION-PR-017: role-agnostic reservation workload assignment.
-- Keep assigned_veterinarian_id as the clinical owner; this relation tracks
-- every active workspace member who has operational work for a reservation.

create table public.appointment_staff_assignments (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.workspaces(id) on delete cascade,
  appointment_id uuid not null,
  assignee_user_id uuid not null,
  created_by_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (workspace_id, appointment_id, assignee_user_id),
  foreign key (workspace_id, appointment_id)
    references public.appointments(workspace_id, id) on delete cascade,
  foreign key (workspace_id, assignee_user_id)
    references public.user_memberships(workspace_id, user_id)
);

create index appointment_staff_assignments_workspace_assignee_idx
  on public.appointment_staff_assignments (workspace_id, assignee_user_id, appointment_id);

alter table public.appointment_staff_assignments enable row level security;

comment on table public.appointment_staff_assignments is
  'Role-agnostic operational assignees for a reception appointment; distinct from the primary veterinarian.';

-- Existing clinical owners are also operationally responsible for their
-- appointments. This makes the new model additive for the calendar history.
insert into public.appointment_staff_assignments (
  workspace_id,
  appointment_id,
  assignee_user_id,
  created_by_user_id
)
select
  a.workspace_id,
  a.id,
  a.assigned_veterinarian_id,
  a.created_by_user_id
from public.appointments a
where a.assigned_veterinarian_id is not null
on conflict (workspace_id, appointment_id, assignee_user_id) do nothing;

create or replace function public.clair_create_reception_appointment(
  p_workspace_id text,
  p_actor_user_id text,
  p_appointment jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_actor_user_id uuid := nullif(p_actor_user_id, '')::uuid;
  v_patient_id uuid := nullif(p_appointment->>'patientId', '')::uuid;
  v_guardian_id uuid := nullif(p_appointment->>'guardianId', '')::uuid;
  v_veterinarian_id uuid := nullif(p_appointment->>'assignedVeterinarianId', '')::uuid;
  v_duration_minutes integer := nullif(p_appointment->>'durationMinutes', '')::integer;
  v_scheduled_start_at timestamptz := nullif(p_appointment->>'scheduledStartAt', '')::timestamptz;
  v_scheduled_end_at timestamptz;
  v_memo text := nullif(trim(p_appointment->>'reservationMemo'), '');
  v_weight_kg numeric(6,2) := nullif(p_appointment->>'weightKg', '')::numeric(6,2);
  v_assignment_user_ids uuid[] := '{}'::uuid[];
  v_appointment public.appointments%rowtype;
begin
  if v_actor_user_id is null or v_actor_user_id <> auth.uid() then
    raise exception 'actor_mismatch';
  end if;

  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing';
  end if;

  if not private.clair_current_user_has_workspace_permission(p_workspace_id, 'reception:create') then
    raise exception 'permission_missing';
  end if;

  if v_patient_id is null or v_scheduled_start_at is null or v_duration_minutes is null then
    raise exception 'invalid_input';
  end if;

  if v_duration_minutes < 10 or v_duration_minutes > 240 then
    raise exception 'invalid_input';
  end if;

  if v_weight_kg is not null and v_weight_kg <= 0 then
    raise exception 'invalid_weight_kg';
  end if;

  if p_appointment ? 'assignedStaffUserIds'
    and jsonb_typeof(p_appointment->'assignedStaffUserIds') <> 'array' then
    raise exception 'assigned_staff_unavailable';
  end if;

  if exists (
    select 1
    from jsonb_array_elements_text(coalesce(p_appointment->'assignedStaffUserIds', '[]'::jsonb)) as staff(user_id)
    where staff.user_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ) then
    raise exception 'assigned_staff_unavailable';
  end if;

  select coalesce(array_agg(distinct staff.user_id::uuid), '{}'::uuid[])
  into v_assignment_user_ids
  from jsonb_array_elements_text(coalesce(p_appointment->'assignedStaffUserIds', '[]'::jsonb)) as staff(user_id);

  if v_veterinarian_id is not null then
    v_assignment_user_ids := array(
      select distinct assignee_user_id
      from unnest(array_append(v_assignment_user_ids, v_veterinarian_id)) as assignee_user_id
    );
  end if;

  v_scheduled_end_at := v_scheduled_start_at + make_interval(mins => v_duration_minutes);

  perform private.clair_assert_reception_time_allowed(
    p_workspace_id, v_scheduled_start_at, v_scheduled_end_at, 'appointment'
  );

  if not exists (
    select 1
    from public.patients p
    where p.workspace_id = p_workspace_id
      and p.id = v_patient_id
      and p.status = 'active'
  ) then
    raise exception 'patient_unavailable';
  end if;

  if v_guardian_id is not null and not exists (
    select 1
    from public.guardians g
    where g.workspace_id = p_workspace_id
      and g.id = v_guardian_id
  ) then
    raise exception 'guardian_unavailable';
  end if;

  if v_guardian_id is not null and not exists (
    select 1
    from public.patient_guardians pg
    where pg.patient_id = v_patient_id
      and pg.guardian_id = v_guardian_id
  ) then
    raise exception 'patient_guardian_link_missing';
  end if;

  if v_veterinarian_id is not null and not exists (
    select 1
    from public.user_memberships m
    where m.workspace_id = p_workspace_id
      and m.user_id = v_veterinarian_id
      and m.status = 'active'
      and m.roles @> array['vet']::text[]
  ) then
    raise exception 'primary_veterinarian_unavailable';
  end if;

  if exists (
    select 1
    from unnest(v_assignment_user_ids) as assignment_user_id
    where not exists (
      select 1
      from public.user_memberships m
      where m.workspace_id = p_workspace_id
        and m.user_id = assignment_user_id
        and m.status = 'active'
    )
  ) then
    raise exception 'assigned_staff_unavailable';
  end if;

  if exists (
    select 1
    from public.appointments a
    where a.workspace_id = p_workspace_id
      and a.status in ('requested', 'confirmed', 'changed')
      and v_scheduled_start_at < coalesce(a.scheduled_end_at, a.scheduled_start_at + interval '30 minutes')
      and v_scheduled_end_at > a.scheduled_start_at
  ) then
    raise exception 'appointment_slot_unavailable';
  end if;

  insert into public.appointments (
    workspace_id,
    patient_id,
    guardian_id,
    assigned_veterinarian_id,
    scheduled_start_at,
    scheduled_end_at,
    visit_purpose,
    symptom_note,
    status,
    created_by_user_id
  )
  values (
    p_workspace_id,
    v_patient_id,
    v_guardian_id,
    v_veterinarian_id,
    v_scheduled_start_at,
    v_scheduled_end_at,
    v_memo,
    v_memo,
    'confirmed',
    v_actor_user_id
  )
  returning * into v_appointment;

  insert into public.appointment_staff_assignments (
    workspace_id,
    appointment_id,
    assignee_user_id,
    created_by_user_id
  )
  select
    p_workspace_id,
    v_appointment.id,
    assignment_user_id,
    v_actor_user_id
  from unnest(v_assignment_user_ids) as assignment_user_id;

  if v_weight_kg is not null then
    update public.patients
    set
      weight_kg = round(v_weight_kg, 2),
      updated_at = now()
    where workspace_id = p_workspace_id
      and id = v_patient_id;
  end if;

  insert into public.appointment_change_logs (
    workspace_id,
    appointment_id,
    changed_by_user_id,
    change_type,
    before_value,
    after_value
  )
  values (
    p_workspace_id,
    v_appointment.id,
    v_actor_user_id,
    'create',
    '{}'::jsonb,
    jsonb_build_object(
      'assignedStaffUserIds', to_jsonb(v_assignment_user_ids),
      'status', v_appointment.status,
      'weightKg', v_weight_kg
    )
  );

  return jsonb_build_object(
    'id', v_appointment.id::text,
    'workspaceId', v_appointment.workspace_id,
    'patientId', v_appointment.patient_id::text,
    'guardianId', v_appointment.guardian_id::text,
    'assignedVeterinarianId', v_appointment.assigned_veterinarian_id::text,
    'assignedStaffUserIds', to_jsonb(v_assignment_user_ids),
    'scheduledStartAt', v_appointment.scheduled_start_at,
    'scheduledEndAt', v_appointment.scheduled_end_at,
    'visitPurpose', v_appointment.visit_purpose,
    'symptomNote', v_appointment.symptom_note,
    'status', v_appointment.status,
    'createdByUserId', v_appointment.created_by_user_id::text,
    'createdAt', v_appointment.created_at,
    'updatedAt', v_appointment.updated_at
  );
end;
$$;

revoke all on function public.clair_create_reception_appointment(text, text, jsonb) from public;
grant execute on function public.clair_create_reception_appointment(text, text, jsonb) to authenticated;

alter function private.clair_list_reception_day_calendar_records(text, date)
  rename to clair_list_reception_day_calendar_records_base;

create function private.clair_list_reception_day_calendar_records(
  p_workspace_id text,
  p_day date
)
returns jsonb
language sql
security definer
set search_path = public, private, pg_temp
as $$
  with source_records as (
    select value as record, ordinality
    from jsonb_array_elements(
      private.clair_list_reception_day_calendar_records_base(p_workspace_id, p_day)
    ) with ordinality
  )
  select coalesce(
    jsonb_agg(
      case
        when record->'appointment' is null or record->'appointment' = 'null'::jsonb then record
        else jsonb_set(
          record,
          '{appointment,assignedStaffUserIds}',
          coalesce((
            select jsonb_agg(assignment.assignee_user_id::text order by assignment.created_at, assignment.id)
            from public.appointment_staff_assignments assignment
            where assignment.workspace_id = p_workspace_id
              and assignment.appointment_id = (record #>> '{appointment,id}')::uuid
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
  rename to clair_list_reception_queue_internal_base;

create function private.clair_list_reception_queue_internal(
  p_workspace_id text,
  p_day date,
  p_limit integer default 100
)
returns jsonb
language sql
security definer
set search_path = public, private, pg_temp
as $$
  with source_records as (
    select value as record, ordinality
    from jsonb_array_elements(
      private.clair_list_reception_queue_internal_base(p_workspace_id, p_day, p_limit)
    ) with ordinality
  )
  select coalesce(
    jsonb_agg(
      case
        when record->'appointment' is null or record->'appointment' = 'null'::jsonb then record
        else jsonb_set(
          record,
          '{appointment,assignedStaffUserIds}',
          coalesce((
            select jsonb_agg(assignment.assignee_user_id::text order by assignment.created_at, assignment.id)
            from public.appointment_staff_assignments assignment
            where assignment.workspace_id = p_workspace_id
              and assignment.appointment_id = (record #>> '{appointment,id}')::uuid
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
