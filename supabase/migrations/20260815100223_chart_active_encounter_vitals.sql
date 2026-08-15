create or replace function public.clair_upsert_chart_encounter_vitals(
  p_workspace_id text,
  p_actor_user_id text,
  p_encounter_id uuid,
  p_vitals jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_user_id uuid;
  v_encounter public.encounters%rowtype;
  v_queue public.waiting_queue_entries%rowtype;
  v_measurement public.patient_vital_measurements%rowtype;
  v_weight_kg numeric(6,2);
  v_temperature_c numeric(4,1);
  v_heart_rate_bpm integer;
  v_respiratory_rate_rpm integer;
  v_blood_pressure_systolic_mmhg integer;
  v_blood_pressure_diastolic_mmhg integer;
  v_has_value boolean;
  v_now timestamptz := pg_catalog.now();
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
  if not private.clair_current_user_has_workspace_permission(
    p_workspace_id,
    'vital:write'
  ) then
    raise exception 'permission_missing';
  end if;
  if not exists (
    select 1
    from public.user_memberships membership
    where membership.workspace_id = p_workspace_id
      and membership.user_id = v_actor_user_id
      and membership.status = 'active'
      and (
        membership.roles && array['hospital_admin', 'vet', 'technician']::text[]
        or exists (
          select 1
          from public.workspace_membership_job_position_assignments assignment
          join public.workspace_job_positions position
            on position.id = assignment.job_position_id
           and position.workspace_id = assignment.workspace_id
          where assignment.workspace_id = p_workspace_id
            and assignment.membership_id = membership.id
            and position.position_key in ('veterinarian', 'technician')
        )
      )
  ) then
    raise exception 'vital_writer_role_required';
  end if;

  if p_vitals is null or pg_catalog.jsonb_typeof(p_vitals) <> 'object' then
    raise exception 'invalid_vitals';
  end if;
  if (p_vitals ? 'weightKg' and p_vitals->'weightKg' <> 'null'::jsonb and pg_catalog.jsonb_typeof(p_vitals->'weightKg') <> 'number')
    or (p_vitals ? 'temperatureC' and p_vitals->'temperatureC' <> 'null'::jsonb and pg_catalog.jsonb_typeof(p_vitals->'temperatureC') <> 'number')
    or (p_vitals ? 'heartRateBpm' and p_vitals->'heartRateBpm' <> 'null'::jsonb and pg_catalog.jsonb_typeof(p_vitals->'heartRateBpm') <> 'number')
    or (p_vitals ? 'respiratoryRateRpm' and p_vitals->'respiratoryRateRpm' <> 'null'::jsonb and pg_catalog.jsonb_typeof(p_vitals->'respiratoryRateRpm') <> 'number')
    or (p_vitals ? 'bloodPressureSystolicMmhg' and p_vitals->'bloodPressureSystolicMmhg' <> 'null'::jsonb and pg_catalog.jsonb_typeof(p_vitals->'bloodPressureSystolicMmhg') <> 'number')
    or (p_vitals ? 'bloodPressureDiastolicMmhg' and p_vitals->'bloodPressureDiastolicMmhg' <> 'null'::jsonb and pg_catalog.jsonb_typeof(p_vitals->'bloodPressureDiastolicMmhg') <> 'number')
  then
    raise exception 'invalid_vitals';
  end if;

  if (p_vitals ? 'weightKg' and p_vitals->'weightKg' <> 'null'::jsonb
        and (p_vitals->>'weightKg')::numeric <> pg_catalog.round((p_vitals->>'weightKg')::numeric, 2))
    or (p_vitals ? 'temperatureC' and p_vitals->'temperatureC' <> 'null'::jsonb
        and (p_vitals->>'temperatureC')::numeric <> pg_catalog.round((p_vitals->>'temperatureC')::numeric, 1))
    or (p_vitals ? 'heartRateBpm' and p_vitals->'heartRateBpm' <> 'null'::jsonb
        and (p_vitals->>'heartRateBpm')::numeric <> pg_catalog.trunc((p_vitals->>'heartRateBpm')::numeric))
    or (p_vitals ? 'respiratoryRateRpm' and p_vitals->'respiratoryRateRpm' <> 'null'::jsonb
        and (p_vitals->>'respiratoryRateRpm')::numeric <> pg_catalog.trunc((p_vitals->>'respiratoryRateRpm')::numeric))
    or (p_vitals ? 'bloodPressureSystolicMmhg' and p_vitals->'bloodPressureSystolicMmhg' <> 'null'::jsonb
        and (p_vitals->>'bloodPressureSystolicMmhg')::numeric <> pg_catalog.trunc((p_vitals->>'bloodPressureSystolicMmhg')::numeric))
    or (p_vitals ? 'bloodPressureDiastolicMmhg' and p_vitals->'bloodPressureDiastolicMmhg' <> 'null'::jsonb
        and (p_vitals->>'bloodPressureDiastolicMmhg')::numeric <> pg_catalog.trunc((p_vitals->>'bloodPressureDiastolicMmhg')::numeric))
  then
    raise exception 'invalid_vitals';
  end if;

  v_weight_kg := nullif(p_vitals->>'weightKg', '')::numeric;
  v_temperature_c := nullif(p_vitals->>'temperatureC', '')::numeric;
  v_heart_rate_bpm := nullif(p_vitals->>'heartRateBpm', '')::integer;
  v_respiratory_rate_rpm := nullif(p_vitals->>'respiratoryRateRpm', '')::integer;
  v_blood_pressure_systolic_mmhg := nullif(p_vitals->>'bloodPressureSystolicMmhg', '')::integer;
  v_blood_pressure_diastolic_mmhg := nullif(p_vitals->>'bloodPressureDiastolicMmhg', '')::integer;

  if (v_weight_kg is not null and v_weight_kg <= 0)
    or (v_temperature_c is not null and v_temperature_c <= 0)
    or (v_heart_rate_bpm is not null and v_heart_rate_bpm <= 0)
    or (v_respiratory_rate_rpm is not null and v_respiratory_rate_rpm <= 0)
    or (v_blood_pressure_systolic_mmhg is not null and v_blood_pressure_systolic_mmhg <= 0)
    or (v_blood_pressure_diastolic_mmhg is not null and v_blood_pressure_diastolic_mmhg <= 0)
    or (v_blood_pressure_diastolic_mmhg is not null and v_blood_pressure_systolic_mmhg is null)
  then
    raise exception 'invalid_vitals';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(p_workspace_id || ':' || p_encounter_id::text)
  );

  select *
  into v_encounter
  from public.encounters
  where workspace_id = p_workspace_id
    and id = p_encounter_id
  for update;
  if v_encounter.id is null then
    raise exception 'encounter_unavailable';
  end if;

  select *
  into v_queue
  from public.waiting_queue_entries
  where workspace_id = p_workspace_id
    and encounter_id = p_encounter_id
    and queue_type = 'consultation'
    and status <> 'cancelled'
  for update;
  if v_queue.id is null
    or not (
      (v_encounter.status = 'waiting' and v_queue.status = 'waiting')
      or (
        v_encounter.status = 'in_consultation'
        and v_queue.status = 'in_progress'
      )
    )
  then
    raise exception 'stale_status';
  end if;

  select *
  into v_measurement
  from public.patient_vital_measurements
  where workspace_id = p_workspace_id
    and encounter_id = p_encounter_id
  order by measured_at desc, created_at desc, id desc
  limit 1
  for update;

  v_has_value := pg_catalog.num_nonnulls(
    v_weight_kg,
    v_temperature_c,
    v_heart_rate_bpm,
    v_respiratory_rate_rpm,
    v_blood_pressure_systolic_mmhg,
    v_blood_pressure_diastolic_mmhg
  ) > 0;

  if v_measurement.id is null then
    if not v_has_value then
      raise exception 'vital_value_required';
    end if;
    insert into public.patient_vital_measurements (
      workspace_id,
      patient_id,
      encounter_id,
      measured_at,
      recorded_by_user_id,
      updated_at,
      updated_by_user_id,
      weight_kg,
      temperature_c,
      heart_rate_bpm,
      respiratory_rate_rpm,
      blood_pressure_systolic_mmhg,
      blood_pressure_diastolic_mmhg
    ) values (
      p_workspace_id,
      v_encounter.patient_id,
      p_encounter_id,
      v_now,
      v_actor_user_id,
      v_now,
      v_actor_user_id,
      v_weight_kg,
      v_temperature_c,
      v_heart_rate_bpm,
      v_respiratory_rate_rpm,
      v_blood_pressure_systolic_mmhg,
      v_blood_pressure_diastolic_mmhg
    )
    returning * into v_measurement;
  else
    update public.patient_vital_measurements
    set
      weight_kg = v_weight_kg,
      temperature_c = v_temperature_c,
      heart_rate_bpm = v_heart_rate_bpm,
      respiratory_rate_rpm = v_respiratory_rate_rpm,
      blood_pressure_systolic_mmhg = v_blood_pressure_systolic_mmhg,
      blood_pressure_diastolic_mmhg = v_blood_pressure_diastolic_mmhg,
      updated_at = v_now,
      updated_by_user_id = v_actor_user_id,
      cleared_at = case when v_has_value then null else v_now end,
      cleared_by_user_id = case when v_has_value then null else v_actor_user_id end
    where id = v_measurement.id
    returning * into v_measurement;
  end if;

  if v_weight_kg is not null then
    update public.patients
    set weight_kg = v_weight_kg, updated_at = v_now
    where workspace_id = p_workspace_id
      and id = v_encounter.patient_id;
  end if;

  return pg_catalog.jsonb_build_object(
    'id', v_measurement.id::text,
    'patientId', v_measurement.patient_id::text,
    'encounterId', v_measurement.encounter_id::text,
    'measuredAt', v_measurement.measured_at,
    'weightKg', v_measurement.weight_kg,
    'temperatureC', v_measurement.temperature_c,
    'heartRateBpm', v_measurement.heart_rate_bpm,
    'respiratoryRateRpm', v_measurement.respiratory_rate_rpm,
    'bloodPressureSystolicMmhg', v_measurement.blood_pressure_systolic_mmhg,
    'bloodPressureDiastolicMmhg', v_measurement.blood_pressure_diastolic_mmhg
  );
end;
$$;

revoke all on function public.clair_upsert_chart_encounter_vitals(
  text,
  text,
  uuid,
  jsonb
) from public, anon;

grant execute on function public.clair_upsert_chart_encounter_vitals(
  text,
  text,
  uuid,
  jsonb
) to authenticated;

comment on function public.clair_upsert_chart_encounter_vitals(
  text,
  text,
  uuid,
  jsonb
) is
  'Actor-bound vital writer limited to waiting/waiting or in_consultation/in_progress consultation encounters.';
