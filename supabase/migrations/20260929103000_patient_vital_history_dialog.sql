-- CHART-PR-040. Additive local candidate; no remote application is authorized.
-- Keep legacy encounter upserts intact. New writes address exact measurement IDs.
do $$
declare v_expression text;
begin
  select pg_catalog.pg_get_expr(conbin, conrelid) into v_expression
  from pg_catalog.pg_constraint
  where conrelid = 'public.audit_events'::regclass and conname = 'audit_events_event_type_check';
  if v_expression is null then raise exception 'audit_event_contract_missing'; end if;
  alter table public.audit_events drop constraint audit_events_event_type_check;
  execute 'alter table public.audit_events add constraint audit_events_event_type_check check (('
    || v_expression || ') or event_type in (''patient.vital_measured'', ''patient.vital_corrected''))';
end;
$$;

-- Preserve all existing public audit events and execution privileges. Only the
-- two new internal measurement events are rejected through the public helper.
create or replace function public.clair_append_audit_event(
  p_id text,
  p_workspace_id text,
  p_actor_user_id uuid,
  p_actor_membership_id uuid,
  p_event_type text,
  p_target_type text,
  p_target_id text,
  p_encounter_id uuid default null,
  p_patient_id uuid default null,
  p_guardian_id uuid default null,
  p_request_id text default null,
  p_reason text default null,
  p_before_snapshot jsonb default '{}'::jsonb,
  p_after_snapshot jsonb default '{}'::jsonb,
  p_metadata jsonb default '{}'::jsonb,
  p_occurred_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_event public.audit_events%rowtype;
begin
  -- These events can only be written by the checked measurement transaction.
  if p_event_type in ('patient.vital_measured', 'patient.vital_corrected') then
    raise exception 'audit_event_internal_only';
  end if;

  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing';
  end if;

  insert into public.audit_events (
    id,
    workspace_id,
    actor_user_id,
    actor_membership_id,
    event_type,
    target_type,
    target_id,
    encounter_id,
    patient_id,
    guardian_id,
    request_id,
    reason,
    before_snapshot,
    after_snapshot,
    metadata,
    occurred_at
  )
  values (
    p_id,
    p_workspace_id,
    p_actor_user_id,
    p_actor_membership_id,
    p_event_type,
    p_target_type,
    p_target_id,
    p_encounter_id,
    p_patient_id,
    p_guardian_id,
    nullif(btrim(p_request_id), ''),
    nullif(btrim(p_reason), ''),
    coalesce(p_before_snapshot, '{}'::jsonb),
    coalesce(p_after_snapshot, '{}'::jsonb),
    coalesce(p_metadata, '{}'::jsonb),
    coalesce(p_occurred_at, now())
  )
  on conflict (id) do update
    set id = excluded.id
  returning *
  into v_event;

  return jsonb_build_object(
    'id', v_event.id,
    'workspaceId', v_event.workspace_id,
    'actorUserId', v_event.actor_user_id,
    'actorMembershipId', v_event.actor_membership_id,
    'eventType', v_event.event_type,
    'targetType', v_event.target_type,
    'targetId', v_event.target_id,
    'encounterId', v_event.encounter_id,
    'patientId', v_event.patient_id,
    'guardianId', v_event.guardian_id,
    'requestId', v_event.request_id,
    'reason', v_event.reason,
    'before', v_event.before_snapshot,
    'after', v_event.after_snapshot,
    'metadata', v_event.metadata,
    'occurredAt', v_event.occurred_at,
    'createdAt', v_event.created_at
  );
end;
$$;

create or replace function public.clair_write_patient_vital_measurement(
  p_workspace_id text,
  p_actor_user_id text,
  p_encounter_id uuid,
  p_vitals jsonb,
  p_action text,
  p_measurement_id uuid,
  p_expected_updated_at timestamptz,
  p_measured_at timestamptz
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
  v_before jsonb;
  v_latest_weight numeric;
  v_idempotent boolean := false;
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

  if not private.clair_current_user_has_workspace_permission(p_workspace_id, 'patient:view') then
    raise exception 'permission_missing';
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

  if p_action not in ('create', 'update') or p_action is null or p_measurement_id is null then
    raise exception 'invalid_vitals';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(p_workspace_id || ':vital:' || v_encounter.patient_id::text)
  );
  select * into v_measurement
  from public.patient_vital_measurements
  where id = p_measurement_id
    and workspace_id = p_workspace_id
    and patient_id = v_encounter.patient_id
  for update;
  if v_measurement.id is not null and (
    v_measurement.workspace_id <> p_workspace_id or v_measurement.patient_id <> v_encounter.patient_id
    or not exists (select 1 from public.encounters origin
      where origin.id = v_measurement.encounter_id and origin.workspace_id = p_workspace_id
        and origin.patient_id = v_encounter.patient_id and origin.status <> 'cancelled')
  ) then raise exception 'measurement_unavailable'; end if;
  if p_action = 'update' then
    if v_measurement.id is null then raise exception 'measurement_unavailable'; end if;
    if p_expected_updated_at is null or
      p_expected_updated_at <> coalesce(v_measurement.updated_at, v_measurement.created_at)
    then raise exception 'measurement_conflict'; end if;
    v_before := pg_catalog.to_jsonb(v_measurement);
  else
    if p_measured_at is null
      or (p_measured_at at time zone 'Asia/Seoul')::date <> (v_now at time zone 'Asia/Seoul')::date
      or p_measured_at > v_now + interval '5 minutes'
    then raise exception 'invalid_vitals'; end if;
    if v_measurement.id is not null then
      if v_measurement.encounter_id = p_encounter_id
        and v_measurement.measured_at = p_measured_at
        and row(v_measurement.weight_kg, v_measurement.temperature_c, v_measurement.heart_rate_bpm,
          v_measurement.respiratory_rate_rpm, v_measurement.blood_pressure_systolic_mmhg,
          v_measurement.blood_pressure_diastolic_mmhg)
        is not distinct from row(v_weight_kg, v_temperature_c, v_heart_rate_bpm,
          v_respiratory_rate_rpm, v_blood_pressure_systolic_mmhg, v_blood_pressure_diastolic_mmhg)
      then v_idempotent := true;
      else raise exception 'measurement_conflict'; end if;
    end if;
  end if;

  v_has_value := pg_catalog.num_nonnulls(
    v_weight_kg,
    v_temperature_c,
    v_heart_rate_bpm,
    v_respiratory_rate_rpm,
    v_blood_pressure_systolic_mmhg,
    v_blood_pressure_diastolic_mmhg
  ) > 0;

  if p_action = 'create' and not v_idempotent then
    if not v_has_value then
      raise exception 'vital_value_required';
    end if;
    insert into public.patient_vital_measurements (
      id,
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
      p_measurement_id,
      p_workspace_id,
      v_encounter.patient_id,
      p_encounter_id,
      p_measured_at,
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
  elsif p_action = 'update' then
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

  -- Historical corrections must not replace a newer patient's weight snapshot.
  select measurement.weight_kg into v_latest_weight
  from public.patient_vital_measurements measurement
  join public.encounters origin on origin.id = measurement.encounter_id
    and origin.workspace_id = measurement.workspace_id and origin.patient_id = measurement.patient_id
    and origin.status <> 'cancelled'
  where measurement.workspace_id = p_workspace_id and measurement.patient_id = v_encounter.patient_id
    and measurement.weight_kg is not null
  order by measurement.measured_at desc, measurement.created_at desc, measurement.id desc limit 1;
  if v_latest_weight is not null and not v_idempotent then
    update public.patients set weight_kg = v_latest_weight, updated_at = v_now
    where workspace_id = p_workspace_id and id = v_encounter.patient_id
      and weight_kg is distinct from v_latest_weight;
  end if;
  if not v_idempotent then
    insert into public.audit_events (
      id, workspace_id, actor_user_id, actor_membership_id, event_type,
      target_type, target_id, encounter_id, patient_id,
      before_snapshot, after_snapshot, metadata, occurred_at
    ) values (
      pg_catalog.gen_random_uuid()::text, p_workspace_id, v_actor_user_id,
      (select id from public.user_memberships where workspace_id = p_workspace_id
        and user_id = v_actor_user_id and status = 'active' limit 1),
      case when p_action = 'create' then 'patient.vital_measured' else 'patient.vital_corrected' end,
      'patient_vital_measurement', v_measurement.id::text,
      v_measurement.encounter_id, v_measurement.patient_id,
      coalesce(v_before, '{}'::jsonb), pg_catalog.to_jsonb(v_measurement),
      pg_catalog.jsonb_build_object('activeEncounterId', p_encounter_id), v_now
    );
  end if;

  return pg_catalog.jsonb_build_object(
    'id', v_measurement.id::text,
    'patientId', v_measurement.patient_id::text,
    'encounterId', v_measurement.encounter_id::text,
    'measuredAt', v_measurement.measured_at,
    'updatedAt', coalesce(v_measurement.updated_at, v_measurement.created_at),
    'createdAt', v_measurement.created_at,
    'recordedByName', (select display_name from public.users where id = v_measurement.recorded_by_user_id),
    'weightKg', v_measurement.weight_kg,
    'temperatureC', v_measurement.temperature_c,
    'heartRateBpm', v_measurement.heart_rate_bpm,
    'respiratoryRateRpm', v_measurement.respiratory_rate_rpm,
    'bloodPressureSystolicMmhg', v_measurement.blood_pressure_systolic_mmhg,
    'bloodPressureDiastolicMmhg', v_measurement.blood_pressure_diastolic_mmhg
  );
end;
$$;

revoke all on function public.clair_write_patient_vital_measurement(text, text, uuid, jsonb, text, uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.clair_write_patient_vital_measurement(text, text, uuid, jsonb, text, uuid, timestamptz, timestamptz) to authenticated;
comment on function public.clair_write_patient_vital_measurement(text, text, uuid, jsonb, text, uuid, timestamptz, timestamptz) is
  'Actor-bound exact-record create/correction via an active same-patient encounter; timestamps preserved, optimistic revision check and transactional audit.';

create or replace function public.clair_list_patient_vital_history(
  p_workspace_id text, p_encounter_id uuid, p_before_id uuid default null
) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_patient_id uuid;
  v_cursor public.patient_vital_measurements%rowtype;
  v_result jsonb;
begin
  if not private.clair_is_active_workspace_member(p_workspace_id) then raise exception 'workspace_membership_missing'; end if;
  if not private.clair_current_user_has_workspace_permission(p_workspace_id, 'patient:view') then raise exception 'permission_missing'; end if;
  select patient_id into v_patient_id from public.encounters
  where workspace_id = p_workspace_id and id = p_encounter_id and status <> 'cancelled';
  if v_patient_id is null then raise exception 'encounter_unavailable'; end if;
  if p_before_id is not null then
    select * into v_cursor from public.patient_vital_measurements
    where workspace_id = p_workspace_id and patient_id = v_patient_id and id = p_before_id;
    if v_cursor.id is null then raise exception 'measurement_unavailable'; end if;
  end if;
  with candidates as (
    select measurement.* from public.patient_vital_measurements measurement
    join public.encounters origin on origin.id = measurement.encounter_id
      and origin.workspace_id = measurement.workspace_id and origin.patient_id = measurement.patient_id
      and origin.status <> 'cancelled'
    where measurement.workspace_id = p_workspace_id and measurement.patient_id = v_patient_id
      and (p_before_id is null or row(measurement.measured_at, measurement.created_at, measurement.id)
        < row(v_cursor.measured_at, v_cursor.created_at, v_cursor.id))
    order by measurement.measured_at desc, measurement.created_at desc, measurement.id desc limit 101
  ), page as (
    select candidates.*, row_number() over (order by measured_at desc, created_at desc, id desc) as position
    from candidates
  )
  select pg_catalog.jsonb_build_object(
    'measurements', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id', item.id, 'patientId', item.patient_id, 'encounterId', item.encounter_id,
      'measuredAt', item.measured_at, 'updatedAt', coalesce(item.updated_at, item.created_at),
      'createdAt', item.created_at,
      'recordedByName', author.display_name,
      'weightKg', item.weight_kg, 'temperatureC', item.temperature_c, 'heartRateBpm', item.heart_rate_bpm,
      'respiratoryRateRpm', item.respiratory_rate_rpm, 'bloodPressureSystolicMmhg', item.blood_pressure_systolic_mmhg,
      'bloodPressureDiastolicMmhg', item.blood_pressure_diastolic_mmhg
    ) order by item.position) from page item left join public.users author on author.id = item.recorded_by_user_id
      where item.position <= 100), '[]'::jsonb),
    'nextCursor', case when (select count(*) from page) > 100
      then (select id::text from page where position = 100) else null end
  ) into v_result;
  return v_result;
end;
$$;
revoke all on function public.clair_list_patient_vital_history(text, uuid, uuid) from public, anon;
grant execute on function public.clair_list_patient_vital_history(text, uuid, uuid) to authenticated;

create or replace function public.clair_get_patient_latest_vital_for_encounter(
  p_workspace_id text, p_encounter_id uuid
) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_patient_id uuid;
  v_measurement public.patient_vital_measurements%rowtype;
  v_summary jsonb;
begin
  if not private.clair_is_active_workspace_member(p_workspace_id) then raise exception 'workspace_membership_missing'; end if;
  if not private.clair_current_user_has_workspace_permission(p_workspace_id, 'patient:view') then raise exception 'permission_missing'; end if;
  select patient_id into v_patient_id from public.encounters
  where workspace_id = p_workspace_id and id = p_encounter_id and status <> 'cancelled';
  if v_patient_id is null then raise exception 'encounter_unavailable'; end if;
  select measurement.* into v_measurement from public.patient_vital_measurements measurement
  join public.encounters origin on origin.id = measurement.encounter_id
    and origin.workspace_id = measurement.workspace_id and origin.patient_id = measurement.patient_id
    and origin.status <> 'cancelled'
  where measurement.workspace_id = p_workspace_id and measurement.patient_id = v_patient_id
  order by measurement.measured_at desc, measurement.created_at desc, measurement.id desc limit 1;
  with latest_fields as (
    select distinct on (field.key) field.key, field.value, measurement.measured_at
    from public.patient_vital_measurements measurement
    join public.encounters origin on origin.id = measurement.encounter_id
      and origin.workspace_id = measurement.workspace_id and origin.patient_id = measurement.patient_id
      and origin.status <> 'cancelled'
    cross join lateral pg_catalog.jsonb_each(pg_catalog.jsonb_build_object(
      'weightKg', measurement.weight_kg, 'temperatureC', measurement.temperature_c,
      'heartRateBpm', measurement.heart_rate_bpm, 'respiratoryRateRpm', measurement.respiratory_rate_rpm,
      'bloodPressureSystolicMmhg', measurement.blood_pressure_systolic_mmhg,
      'bloodPressureDiastolicMmhg', measurement.blood_pressure_diastolic_mmhg
    )) field
    where measurement.workspace_id = p_workspace_id and measurement.patient_id = v_patient_id
      and field.value <> 'null'::jsonb
    order by field.key, measurement.measured_at desc, measurement.created_at desc, measurement.id desc
  )
  select pg_catalog.jsonb_build_object(
    'values', coalesce(pg_catalog.jsonb_object_agg(key, value), '{}'::jsonb),
    'measuredAtByField', coalesce(pg_catalog.jsonb_object_agg(key, measured_at), '{}'::jsonb)
  ) into v_summary from latest_fields;
  return pg_catalog.jsonb_build_object(
    'patientId', v_patient_id,
    'summary', v_summary,
    'vital', case when v_measurement.id is null then null else pg_catalog.jsonb_build_object(
      'id', v_measurement.id, 'patientId', v_measurement.patient_id, 'encounterId', v_measurement.encounter_id,
      'measuredAt', v_measurement.measured_at, 'updatedAt', coalesce(v_measurement.updated_at, v_measurement.created_at),
      'createdAt', v_measurement.created_at,
      'recordedByName', (select display_name from public.users where id = v_measurement.recorded_by_user_id),
      'weightKg', v_measurement.weight_kg, 'temperatureC', v_measurement.temperature_c,
      'heartRateBpm', v_measurement.heart_rate_bpm, 'respiratoryRateRpm', v_measurement.respiratory_rate_rpm,
      'bloodPressureSystolicMmhg', v_measurement.blood_pressure_systolic_mmhg,
      'bloodPressureDiastolicMmhg', v_measurement.blood_pressure_diastolic_mmhg
    ) end
  );
end;
$$;
revoke all on function public.clair_get_patient_latest_vital_for_encounter(text, uuid) from public, anon;
grant execute on function public.clair_get_patient_latest_vital_for_encounter(text, uuid) to authenticated;
