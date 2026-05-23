-- DEN-199: repair appointment check-in log change_type column mismatch found after first repair.

create or replace function public.clair_check_in_reception_appointment(
  p_workspace_id text,
  p_actor_user_id text,
  p_appointment_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  v_appointment_id uuid := nullif(p_appointment_id, '')::uuid;
  v_actor_user_id uuid := nullif(p_actor_user_id, '')::uuid;
  v_appointment public.appointments%rowtype;
  v_encounter_id uuid;
  v_queue_entry_id uuid;
  v_log_id uuid;
  v_now timestamptz := now();
  v_encounter_no text := 'E-' || to_char(v_now, 'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  v_duration_minutes integer;
  v_appointment_row jsonb;
  v_encounter_row jsonb;
  v_queue_row jsonb;
begin
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing';
  end if;

  select *
    into v_appointment
  from public.appointments a
  where a.workspace_id = p_workspace_id
    and a.id = v_appointment_id
  for update;

  if v_appointment.id is null then
    raise exception 'appointment_unavailable';
  end if;

  if exists (
    select 1
    from public.encounters e
    where e.workspace_id = p_workspace_id
      and e.appointment_id = v_appointment_id
  ) or v_appointment.status = 'checked_in' then
    raise exception 'appointment_already_checked_in';
  end if;

  if v_appointment.status <> 'confirmed' then
    raise exception 'appointment_not_check_in_ready';
  end if;

  if v_appointment.scheduled_end_at is not null then
    v_duration_minutes := greatest(
      10,
      round(extract(epoch from (v_appointment.scheduled_end_at - v_appointment.scheduled_start_at)) / 60)::integer
    );
  end if;

  update public.appointments
  set
    status = 'checked_in',
    updated_at = v_now
  where id = v_appointment_id
    and workspace_id = p_workspace_id;

  insert into public.encounters (
    workspace_id,
    patient_id,
    guardian_id,
    appointment_id,
    primary_veterinarian_id,
    encounter_no,
    reception_type,
    duration_minutes,
    chief_complaint,
    visit_purpose,
    status,
    checked_in_at,
    checked_in_by_user_id,
    created_at,
    updated_at
  )
  values (
    p_workspace_id,
    v_appointment.patient_id,
    v_appointment.guardian_id,
    v_appointment.id,
    v_appointment.assigned_veterinarian_id,
    v_encounter_no,
    'appointment',
    v_duration_minutes,
    v_appointment.visit_purpose,
    coalesce(v_appointment.visit_purpose, '예약 접수'),
    'waiting',
    v_now,
    v_actor_user_id,
    v_now,
    v_now
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
    v_now
  )
  returning id into v_queue_entry_id;

  insert into public.appointment_change_logs (
    workspace_id,
    appointment_id,
    changed_by_user_id,
    change_type,
    before_value,
    after_value,
    created_at
  )
  values (
    p_workspace_id,
    v_appointment.id,
    v_actor_user_id,
    'check_in',
    jsonb_build_object('status', v_appointment.status),
    jsonb_build_object('status', 'checked_in', 'encounterId', v_encounter_id::text),
    v_now
  )
  returning id into v_log_id;

  select jsonb_build_object(
    'id', a.id::text,
    'workspaceId', a.workspace_id,
    'patientId', a.patient_id::text,
    'guardianId', a.guardian_id::text,
    'assignedVeterinarianId', a.assigned_veterinarian_id::text,
    'scheduledStartAt', a.scheduled_start_at,
    'scheduledEndAt', a.scheduled_end_at,
    'visitPurpose', a.visit_purpose,
    'symptomNote', a.symptom_note,
    'status', a.status,
    'createdByUserId', a.created_by_user_id::text,
    'createdAt', a.created_at,
    'updatedAt', a.updated_at
  )
    into v_appointment_row
  from public.appointments a
  where a.id = v_appointment_id;

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
    'appointment', v_appointment_row,
    'encounter', v_encounter_row,
    'queueEntry', v_queue_row
  );
end;
$$;

revoke all on function public.clair_check_in_reception_appointment(text, text, text) from public;
grant execute on function public.clair_check_in_reception_appointment(text, text, text) to authenticated;

comment on function public.clair_check_in_reception_appointment(text, text, text) is
  'DEN-199 repair for appointment check-in log change_type column mismatch before staging seed/replay.';
