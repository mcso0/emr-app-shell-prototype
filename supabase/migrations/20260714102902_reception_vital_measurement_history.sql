-- RECEPTION-QA-PR-011: persist optional walk-in vitals as patient measurement history.
-- This forward-only migration keeps encounter, queue, measurement, and weight snapshot writes atomic.

create table public.patient_vital_measurements (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.workspaces(id) on delete cascade,
  patient_id uuid not null,
  encounter_id uuid not null,
  measured_at timestamptz not null,
  recorded_by_user_id uuid not null references public.users(id) on delete restrict,
  weight_kg numeric(6,2),
  temperature_c numeric(4,1),
  respiratory_rate_rpm integer,
  blood_pressure_systolic_mmhg integer,
  blood_pressure_diastolic_mmhg integer,
  created_at timestamptz not null default now(),
  constraint patient_vital_measurements_has_value_check check (
    num_nonnulls(
      weight_kg,
      temperature_c,
      respiratory_rate_rpm,
      blood_pressure_systolic_mmhg,
      blood_pressure_diastolic_mmhg
    ) > 0
  ),
  constraint patient_vital_measurements_positive_values_check check (
    (weight_kg is null or weight_kg > 0)
    and (temperature_c is null or temperature_c > 0)
    and (respiratory_rate_rpm is null or respiratory_rate_rpm > 0)
    and (blood_pressure_systolic_mmhg is null or blood_pressure_systolic_mmhg > 0)
    and (blood_pressure_diastolic_mmhg is null or blood_pressure_diastolic_mmhg > 0)
  ),
  constraint patient_vital_measurements_blood_pressure_pair_check check (
    (blood_pressure_systolic_mmhg is null) =
    (blood_pressure_diastolic_mmhg is null)
  ),
  constraint patient_vital_measurements_patient_workspace_fk
    foreign key (workspace_id, patient_id) references public.patients(workspace_id, id)
    on delete cascade,
  constraint patient_vital_measurements_encounter_workspace_fk
    foreign key (workspace_id, encounter_id) references public.encounters(workspace_id, id)
    on delete cascade
);

create index patient_vital_measurements_workspace_patient_measured_idx
  on public.patient_vital_measurements (workspace_id, patient_id, measured_at desc);

create index patient_vital_measurements_workspace_encounter_idx
  on public.patient_vital_measurements (workspace_id, encounter_id);

alter table public.patient_vital_measurements enable row level security;
revoke all privileges on table public.patient_vital_measurements from public, anon, authenticated;

create or replace function public.clair_create_reception_walk_in_encounter(
  p_workspace_id text,
  p_actor_user_id text,
  p_walk_in jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions, pg_temp
as $$
declare
  v_actor_user_id uuid;
  v_patient_id uuid := nullif(p_walk_in->>'patientId', '')::uuid;
  v_guardian_id uuid := nullif(p_walk_in->>'guardianId', '')::uuid;
  v_primary_veterinarian_id uuid := nullif(p_walk_in->>'primaryVeterinarianId', '')::uuid;
  v_planned_start_at timestamptz := nullif(p_walk_in->>'plannedStartAt', '')::timestamptz;
  v_vitals jsonb := p_walk_in -> 'vitals';
  v_weight_kg numeric(6,2);
  v_temperature_c numeric(4,1);
  v_respiratory_rate_rpm integer;
  v_blood_pressure_systolic_mmhg integer;
  v_blood_pressure_diastolic_mmhg integer;
  v_has_measurement boolean := false;
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
  begin
    v_actor_user_id := nullif(p_actor_user_id, '')::uuid;
  exception
    when invalid_text_representation then
      raise exception 'actor_mismatch';
  end;

  if v_actor_user_id is null or v_actor_user_id <> auth.uid() then
    raise exception 'actor_mismatch';
  end if;

  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing';
  end if;

  if p_walk_in ? 'vitals' then
    if jsonb_typeof(v_vitals) is distinct from 'object' then
      raise exception 'invalid_vitals';
    end if;

    if (v_vitals ? 'weightKg' and jsonb_typeof(v_vitals->'weightKg') is distinct from 'number')
      or (v_vitals ? 'temperatureC' and jsonb_typeof(v_vitals->'temperatureC') is distinct from 'number')
      or (v_vitals ? 'respiratoryRateRpm' and jsonb_typeof(v_vitals->'respiratoryRateRpm') is distinct from 'number')
      or (v_vitals ? 'bloodPressure' and jsonb_typeof(v_vitals->'bloodPressure') is distinct from 'object') then
      raise exception 'invalid_vitals';
    end if;

    begin
      v_weight_kg := nullif(v_vitals->>'weightKg', '')::numeric(6,2);
      v_temperature_c := nullif(v_vitals->>'temperatureC', '')::numeric(4,1);

      if v_vitals ? 'respiratoryRateRpm' then
        if trunc((v_vitals->>'respiratoryRateRpm')::numeric) <>
          (v_vitals->>'respiratoryRateRpm')::numeric then
          raise exception 'invalid_vitals';
        end if;
        v_respiratory_rate_rpm := (v_vitals->>'respiratoryRateRpm')::integer;
      end if;

      if v_vitals ? 'bloodPressure' then
        if jsonb_typeof(v_vitals->'bloodPressure'->'systolicMmhg') is distinct from 'number'
          or jsonb_typeof(v_vitals->'bloodPressure'->'diastolicMmhg') is distinct from 'number' then
          raise exception 'invalid_vitals';
        end if;

        if trunc((v_vitals #>> '{bloodPressure,systolicMmhg}')::numeric) <>
            (v_vitals #>> '{bloodPressure,systolicMmhg}')::numeric
          or trunc((v_vitals #>> '{bloodPressure,diastolicMmhg}')::numeric) <>
            (v_vitals #>> '{bloodPressure,diastolicMmhg}')::numeric then
          raise exception 'invalid_vitals';
        end if;

        v_blood_pressure_systolic_mmhg :=
          (v_vitals #>> '{bloodPressure,systolicMmhg}')::integer;
        v_blood_pressure_diastolic_mmhg :=
          (v_vitals #>> '{bloodPressure,diastolicMmhg}')::integer;
      end if;
    exception
      when invalid_text_representation or numeric_value_out_of_range then
        raise exception 'invalid_vitals';
    end;
  end if;

  if (v_weight_kg is not null and v_weight_kg <= 0)
    or (v_temperature_c is not null and v_temperature_c <= 0)
    or (v_respiratory_rate_rpm is not null and v_respiratory_rate_rpm <= 0)
    or (v_blood_pressure_systolic_mmhg is not null and v_blood_pressure_systolic_mmhg <= 0)
    or (v_blood_pressure_diastolic_mmhg is not null and v_blood_pressure_diastolic_mmhg <= 0)
    or ((v_blood_pressure_systolic_mmhg is null) <>
        (v_blood_pressure_diastolic_mmhg is null)) then
    raise exception 'invalid_vitals';
  end if;

  v_has_measurement := num_nonnulls(
    v_weight_kg,
    v_temperature_c,
    v_respiratory_rate_rpm,
    v_blood_pressure_systolic_mmhg,
    v_blood_pressure_diastolic_mmhg
  ) > 0;

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

  if v_has_measurement then
    if not exists (
      select 1
      from public.encounters e
      where e.workspace_id = p_workspace_id
        and e.patient_id = v_patient_id
        and e.id = v_encounter_id
    ) then
      raise exception 'encounter_unavailable';
    end if;

    insert into public.patient_vital_measurements (
      workspace_id,
      patient_id,
      encounter_id,
      measured_at,
      recorded_by_user_id,
      weight_kg,
      temperature_c,
      respiratory_rate_rpm,
      blood_pressure_systolic_mmhg,
      blood_pressure_diastolic_mmhg
    )
    values (
      p_workspace_id,
      v_patient_id,
      v_encounter_id,
      v_now,
      v_actor_user_id,
      v_weight_kg,
      v_temperature_c,
      v_respiratory_rate_rpm,
      v_blood_pressure_systolic_mmhg,
      v_blood_pressure_diastolic_mmhg
    );

    if v_weight_kg is not null then
      update public.patients
      set weight_kg = v_weight_kg,
          updated_at = v_now
      where workspace_id = p_workspace_id
        and id = v_patient_id;
    end if;
  end if;

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
  'RECEPTION-QA-PR-011 server-owned atomic writer for walk-in encounter, consultation queue, optional vital history, and weight snapshot.';
