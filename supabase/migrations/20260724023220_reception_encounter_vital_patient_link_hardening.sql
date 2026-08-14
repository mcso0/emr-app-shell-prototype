-- RECEPTION-LIVE-PR-017 follow-up: require the measurement patient to match
-- the selected encounter patient in addition to matching the encounter id.

create or replace function public.clair_get_reception_encounter_vital(
  p_workspace_id text,
  p_encounter_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_patient_id uuid;
  v_measurement public.patient_vital_measurements%rowtype;
begin
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing';
  end if;
  if not private.clair_current_user_has_workspace_permission(
    p_workspace_id,
    'reception:view'
  ) then
    raise exception 'permission_missing';
  end if;

  select encounter.patient_id
  into v_patient_id
  from public.encounters encounter
  where encounter.workspace_id = p_workspace_id
    and encounter.id = p_encounter_id;

  if v_patient_id is null then
    raise exception 'encounter_unavailable';
  end if;

  select measurement.*
  into v_measurement
  from public.patient_vital_measurements measurement
  where measurement.workspace_id = p_workspace_id
    and measurement.patient_id = v_patient_id
    and measurement.encounter_id = p_encounter_id
  order by measurement.measured_at desc, measurement.created_at desc, measurement.id desc
  limit 1;

  return jsonb_build_object(
    'patientId', v_patient_id::text,
    'vital', case
      when v_measurement.id is null then null
      else jsonb_build_object(
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
      )
    end
  );
end;
$$;

revoke all on function public.clair_get_reception_encounter_vital(text, uuid) from public, anon;
grant execute on function public.clair_get_reception_encounter_vital(text, uuid) to authenticated;

comment on function public.clair_get_reception_encounter_vital(text, uuid) is
  'RECEPTION-LIVE-PR-017 reception:view-gated exact encounter-and-patient vital read model.';
