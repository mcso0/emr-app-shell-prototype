-- DEN-512: keep reception walk-in consultation queue time aligned with planned/check-in event time.

create or replace function public.clair_create_reception_walk_in_encounter(
  p_workspace_id text,
  p_actor_user_id text,
  p_walk_in jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  v_patient_id uuid := nullif(p_walk_in->>'patientId', '')::uuid;
  v_guardian_id uuid := nullif(p_walk_in->>'guardianId', '')::uuid;
  v_primary_veterinarian_id uuid := nullif(p_walk_in->>'primaryVeterinarianId', '')::uuid;
  v_planned_start_at timestamptz := nullif(p_walk_in->>'plannedStartAt', '')::timestamptz;
  v_encounter_id uuid;
  v_queue_entry_id uuid;
  v_now timestamptz := now();
  v_event_time timestamptz := coalesce(v_planned_start_at, v_now);
  v_encounter_no text := 'E-' || to_char(v_event_time at time zone 'Asia/Seoul', 'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  v_duration_minutes integer := nullif(p_walk_in->>'durationMinutes', '')::integer;
  v_visit_purpose text := nullif(btrim(p_walk_in->>'visitPurpose'), '');
  v_encounter_row jsonb;
  v_queue_row jsonb;
begin
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing';
  end if;

  if v_patient_id is null or not exists (
    select 1 from public.patients p
    where p.workspace_id = p_workspace_id
      and p.id = v_patient_id
      and p.status = 'active'
  ) then
    raise exception 'patient_unavailable';
  end if;

  if v_guardian_id is not null then
    if not exists (
      select 1 from public.guardians g
      where g.workspace_id = p_workspace_id
        and g.id = v_guardian_id
    ) then
      raise exception 'guardian_unavailable';
    end if;

    if not exists (
      select 1 from public.patient_guardians pg
      where pg.workspace_id = p_workspace_id
        and pg.patient_id = v_patient_id
        and pg.guardian_id = v_guardian_id
    ) then
      raise exception 'patient_guardian_link_missing';
    end if;
  end if;

  if v_primary_veterinarian_id is not null and not exists (
    select 1
    from public.user_memberships um
    join public.users u on u.id = um.user_id
    where um.workspace_id = p_workspace_id
      and um.user_id = v_primary_veterinarian_id
      and um.status = 'active'
      and u.status = 'active'
      and 'vet' = any(um.roles)
  ) then
    raise exception 'primary_veterinarian_unavailable';
  end if;

  insert into public.encounters (
    workspace_id,
    patient_id,
    guardian_id,
    appointment_id,
    primary_veterinarian_id,
    encounter_no,
    reception_type,
    department,
    duration_minutes,
    chief_complaint,
    visit_purpose,
    reception_memo,
    status,
    checked_in_at,
    checked_in_by_user_id,
    created_at,
    updated_at
  )
  values (
    p_workspace_id,
    v_patient_id,
    v_guardian_id,
    null,
    v_primary_veterinarian_id,
    v_encounter_no,
    'walk_in',
    nullif(btrim(p_walk_in->>'department'), ''),
    v_duration_minutes,
    v_visit_purpose,
    coalesce(v_visit_purpose, '현장 접수'),
    nullif(btrim(p_walk_in->>'memo'), ''),
    'waiting',
    v_event_time,
    null,
    v_now,
    v_event_time
  )
  returning id into v_encounter_id;

  insert into public.waiting_queue_entries (
    workspace_id,
    encounter_id,
    queue_type,
    status,
    priority,
    entered_at
  )
  values (
    p_workspace_id,
    v_encounter_id,
    'consultation',
    'waiting',
    'normal',
    v_event_time
  )
  returning id into v_queue_entry_id;

  select jsonb_build_object(
    'id', e.id::text,
    'workspaceId', e.workspace_id,
    'patientId', e.patient_id::text,
    'guardianId', e.guardian_id::text,
    'appointmentId', e.appointment_id::text,
    'primaryVeterinarianId', e.primary_veterinarian_id::text,
    'encounterNo', e.encounter_no,
    'receptionType', e.reception_type,
    'department', e.department,
    'durationMinutes', e.duration_minutes,
    'chiefComplaint', e.chief_complaint,
    'visitPurpose', e.visit_purpose,
    'receptionMemo', e.reception_memo,
    'status', e.status,
    'checkedInAt', e.checked_in_at,
    'checkedInByUserId', e.checked_in_by_user_id::text,
    'createdAt', e.created_at,
    'updatedAt', e.updated_at
  )
    into v_encounter_row
  from public.encounters e
  where e.id = v_encounter_id;

  select jsonb_build_object(
    'id', q.id::text,
    'workspaceId', q.workspace_id,
    'encounterId', q.encounter_id::text,
    'queueType', q.queue_type,
    'status', q.status,
    'priority', q.priority,
    'sortOrder', q.sort_order,
    'enteredAt', q.entered_at,
    'calledAt', q.called_at,
    'finishedAt', q.finished_at
  )
    into v_queue_row
  from public.waiting_queue_entries q
  where q.id = v_queue_entry_id;

  return jsonb_build_object(
    'encounter', v_encounter_row,
    'queueEntry', v_queue_row
  );
end;
$$;

revoke all on function public.clair_create_reception_walk_in_encounter(text, text, jsonb) from public;
grant execute on function public.clair_create_reception_walk_in_encounter(text, text, jsonb) to authenticated;

comment on function public.clair_create_reception_walk_in_encounter(text, text, jsonb) is
  'DEN-512 server-owned writer for walk-in encounter plus consultation queue creation, preserving planned/check-in event time.';;
