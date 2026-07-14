\set ON_ERROR_STOP on

begin;

create temporary table reception_vital_replay_results (
  scenario text primary key,
  payload jsonb not null
) on commit drop;

grant select, insert on reception_vital_replay_results to authenticated;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000004',
  true
);

do $$
begin
  begin
    insert into public.patient_vital_measurements (
      workspace_id,
      patient_id,
      encounter_id,
      measured_at,
      recorded_by_user_id,
      weight_kg
    )
    values (
      'clair-demo',
      '19421000-0000-4000-8000-000000000005',
      '19426000-0000-4000-8000-000000000005',
      now(),
      '00000000-0000-4000-8000-000000000004',
      3.55
    );
    raise exception 'direct_write_was_not_denied';
  exception
    when insufficient_privilege then
      null;
  end;
end;
$$;

insert into reception_vital_replay_results (scenario, payload)
select
  'successful_measurement',
  public.clair_create_reception_walk_in_encounter(
    'clair-demo',
    '00000000-0000-4000-8000-000000000004',
    jsonb_build_object(
      'patientId', '19421000-0000-4000-8000-000000000005',
      'guardianId', '19420000-0000-4000-8000-000000000005',
      'durationMinutes', 30,
      'plannedStartAt', '2026-07-14T10:00:00+09:00',
      'visitPurpose', 'RECEPTION-QA-PR-011 vital readback',
      'vitals', jsonb_build_object(
        'weightKg', 3.55,
        'temperatureC', 38.6,
        'respiratoryRateRpm', 24,
        'bloodPressure', jsonb_build_object(
          'systolicMmhg', 132,
          'diastolicMmhg', 84
        )
      )
    )
  );

reset role;

do $$
declare
  v_encounter_id uuid;
begin
  select (payload #>> '{encounter,id}')::uuid
    into v_encounter_id
  from reception_vital_replay_results
  where scenario = 'successful_measurement';

  if v_encounter_id is null then
    raise exception 'successful_encounter_missing';
  end if;

  if (
    select count(*)
    from public.patient_vital_measurements
    where workspace_id = 'clair-demo'
      and patient_id = '19421000-0000-4000-8000-000000000005'
      and encounter_id = v_encounter_id
      and recorded_by_user_id = '00000000-0000-4000-8000-000000000004'
      and weight_kg = 3.55
      and temperature_c = 38.6
      and respiratory_rate_rpm = 24
      and blood_pressure_systolic_mmhg = 132
      and blood_pressure_diastolic_mmhg = 84
  ) <> 1 then
    raise exception 'vital_measurement_readback_mismatch';
  end if;

  if not exists (
    select 1
    from public.patient_vital_measurements m
    join public.encounters e
      on e.workspace_id = m.workspace_id
     and e.id = m.encounter_id
     and e.patient_id = m.patient_id
    where m.workspace_id = 'clair-demo'
      and m.patient_id = '19421000-0000-4000-8000-000000000005'
      and m.encounter_id = v_encounter_id
  ) then
    raise exception 'vital_measurement_ownership_mismatch';
  end if;

  if not exists (
    select 1
    from public.patients
    where workspace_id = 'clair-demo'
      and id = '19421000-0000-4000-8000-000000000005'
      and weight_kg = 3.55
  ) then
    raise exception 'patient_weight_snapshot_mismatch';
  end if;
end;
$$;

create or replace function pg_temp.clair_fail_vital_insert()
returns trigger
language plpgsql
as $$
begin
  raise exception 'forced_vital_insert_failure';
end;
$$;

create trigger reception_vital_replay_forced_failure
before insert on public.patient_vital_measurements
for each row execute function pg_temp.clair_fail_vital_insert();

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000004',
  true
);

do $$
begin
  begin
    perform public.clair_create_reception_walk_in_encounter(
      'clair-demo',
      '00000000-0000-4000-8000-000000000004',
      jsonb_build_object(
        'patientId', '19421000-0000-4000-8000-000000000005',
        'guardianId', '19420000-0000-4000-8000-000000000005',
        'durationMinutes', 30,
        'plannedStartAt', '2026-07-14T10:30:00+09:00',
        'visitPurpose', 'RECEPTION-QA-PR-011 forced rollback',
        'vitals', jsonb_build_object('temperatureC', 39.1)
      )
    );
    raise exception 'forced_failure_did_not_fire';
  exception
    when others then
      if sqlerrm <> 'forced_vital_insert_failure' then
        raise;
      end if;
  end;
end;
$$;

reset role;

do $$
begin
  if exists (
    select 1
    from public.encounters
    where workspace_id = 'clair-demo'
      and visit_purpose = 'RECEPTION-QA-PR-011 forced rollback'
  ) then
    raise exception 'forced_failure_encounter_was_not_rolled_back';
  end if;

  if exists (
    select 1
    from public.waiting_queue_entries q
    join public.encounters e on e.id = q.encounter_id
    where e.workspace_id = 'clair-demo'
      and e.visit_purpose = 'RECEPTION-QA-PR-011 forced rollback'
  ) then
    raise exception 'forced_failure_queue_was_not_rolled_back';
  end if;

  if exists (
    select 1
    from public.patient_vital_measurements m
    join public.encounters e on e.id = m.encounter_id
    where e.workspace_id = 'clair-demo'
      and e.visit_purpose = 'RECEPTION-QA-PR-011 forced rollback'
  ) then
    raise exception 'forced_failure_measurement_was_not_rolled_back';
  end if;
end;
$$;

drop trigger reception_vital_replay_forced_failure
  on public.patient_vital_measurements;

rollback;
