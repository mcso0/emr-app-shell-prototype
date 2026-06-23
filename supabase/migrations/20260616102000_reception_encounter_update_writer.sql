create or replace function public.clair_update_reception_encounter(
  p_workspace_id text,
  p_actor_user_id text,
  p_encounter_id text,
  p_patch jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_department text := nullif(btrim(p_patch->>'department'), '');
  v_duration_minutes integer := nullif(p_patch->>'durationMinutes', '')::integer;
  v_memo text := nullif(btrim(p_patch->>'memo'), '');
  v_primary_veterinarian_id uuid := nullif(p_patch->>'primaryVeterinarianId', '')::uuid;
  v_visit_purpose text := nullif(btrim(p_patch->>'visitPurpose'), '');
  v_weight_kg numeric(6,2) := nullif(p_patch->>'weightKg', '')::numeric(6,2);
  v_actor_user_id uuid := nullif(p_actor_user_id, '')::uuid;
  v_encounter public.encounters%rowtype;
  v_patient public.patients%rowtype;
  v_queue_entry public.waiting_queue_entries%rowtype;
begin
  if v_actor_user_id is null or not exists (
    select 1
      from public.user_memberships m
     where m.workspace_id = p_workspace_id
       and m.user_id = v_actor_user_id
       and m.status = 'active'
  ) then
    raise exception 'workspace_membership_missing';
  end if;

  select *
    into v_encounter
    from public.encounters
   where workspace_id = p_workspace_id
     and (id::text = p_encounter_id or encounter_no = p_encounter_id)
   limit 1;

  if v_encounter.id is null then
    raise exception 'encounter_unavailable';
  end if;

  if v_encounter.status not in ('waiting', 'in_consultation') then
    raise exception 'encounter_not_editable';
  end if;

  if v_duration_minutes is not null and v_duration_minutes <= 0 then
    raise exception 'invalid_duration_minutes';
  end if;

  if v_weight_kg is not null and v_weight_kg <= 0 then
    raise exception 'invalid_weight_kg';
  end if;

  if v_primary_veterinarian_id is not null and not exists (
    select 1
      from public.users u
      join public.user_memberships m on m.user_id = u.id
     where u.id = v_primary_veterinarian_id
       and u.status = 'active'
       and m.workspace_id = p_workspace_id
       and m.status = 'active'
       and 'vet' = any(m.roles)
  ) then
    raise exception 'primary_veterinarian_unavailable';
  end if;

  update public.encounters
     set department = v_department,
         duration_minutes = coalesce(v_duration_minutes, duration_minutes),
         primary_veterinarian_id = v_primary_veterinarian_id,
         chief_complaint = coalesce(v_visit_purpose, chief_complaint),
         visit_purpose = coalesce(v_visit_purpose, visit_purpose),
         reception_memo = v_memo,
         updated_at = now()
   where id = v_encounter.id
   returning * into v_encounter;

  select *
    into v_patient
    from public.patients
   where workspace_id = p_workspace_id
     and id = v_encounter.patient_id
     and status = 'active'
   limit 1;

  if v_patient.id is null then
    raise exception 'patient_unavailable';
  end if;

  if v_weight_kg is not null then
    update public.patients
       set weight_kg = round(v_weight_kg, 2),
           updated_at = now()
     where id = v_patient.id
     returning * into v_patient;
  end if;

  select *
    into v_queue_entry
    from public.waiting_queue_entries
   where workspace_id = p_workspace_id
     and encounter_id = v_encounter.id
     and queue_type = 'consultation'
   order by entered_at desc
   limit 1;

  if v_queue_entry.id is null then
    raise exception 'queue_entry_unavailable';
  end if;

  return jsonb_build_object(
    'encounter', jsonb_build_object(
      'id', v_encounter.id,
      'workspaceId', v_encounter.workspace_id,
      'patientId', v_encounter.patient_id,
      'guardianId', v_encounter.guardian_id,
      'appointmentId', v_encounter.appointment_id,
      'primaryVeterinarianId', v_encounter.primary_veterinarian_id,
      'encounterNo', v_encounter.encounter_no,
      'receptionType', v_encounter.reception_type,
      'department', v_encounter.department,
      'durationMinutes', v_encounter.duration_minutes,
      'chiefComplaint', v_encounter.chief_complaint,
      'visitPurpose', v_encounter.visit_purpose,
      'receptionMemo', v_encounter.reception_memo,
      'status', v_encounter.status,
      'checkedInAt', v_encounter.checked_in_at,
      'checkedInByUserId', v_encounter.checked_in_by_user_id,
      'createdAt', v_encounter.created_at,
      'updatedAt', v_encounter.updated_at
    ),
    'patient', jsonb_build_object(
      'id', v_patient.id,
      'patientNo', v_patient.patient_no,
      'workspaceId', v_patient.workspace_id,
      'name', v_patient.name,
      'species', v_patient.species,
      'breed', v_patient.breed,
      'birthDate', v_patient.birth_date,
      'estimatedAgeText', v_patient.estimated_age_text,
      'sex', v_patient.sex,
      'neutered', v_patient.neutered,
      'microchipNo', v_patient.microchip_no,
      'patientRegistrationNo', v_patient.patient_registration_no,
      'weightKg', v_patient.weight_kg,
      'specialNote', v_patient.special_note,
      'handlingCautionLocked', v_patient.handling_caution_locked,
      'status', v_patient.status,
      'createdAt', v_patient.created_at,
      'updatedAt', v_patient.updated_at
    ),
    'queueEntry', jsonb_build_object(
      'id', v_queue_entry.id,
      'workspaceId', v_queue_entry.workspace_id,
      'encounterId', v_queue_entry.encounter_id,
      'queueType', v_queue_entry.queue_type,
      'status', v_queue_entry.status,
      'priority', v_queue_entry.priority,
      'sortOrder', v_queue_entry.sort_order,
      'enteredAt', v_queue_entry.entered_at,
      'calledAt', v_queue_entry.called_at,
      'finishedAt', v_queue_entry.finished_at
    )
  );
end;
$$;

revoke all on function public.clair_update_reception_encounter(text, text, text, jsonb) from public;
grant execute on function public.clair_update_reception_encounter(text, text, text, jsonb) to authenticated;

alter table if exists public.live_audit_events
  drop constraint if exists live_audit_events_event_type_check;

alter table if exists public.live_audit_events
  add constraint live_audit_events_event_type_check
  check (
    event_type = any(array[
      'auth.login',
      'chart.order_created',
      'fulfillment.status_changed',
      'billing.invoice_created',
      'billing.payment_recorded',
      'customer.profile_updated',
      'reception.walk_in_created',
      'reception.appointment_created',
      'reception.encounter_cancelled',
      'reception.encounter_updated',
      'reception.patient_guardian_registered'
    ])
  );

comment on function public.clair_update_reception_encounter(text, text, text, jsonb) is
  'Updates editable reception encounter details and patient weight for synthetic/demo reception QA.';
