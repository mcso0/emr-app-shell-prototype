-- HOSPITAL-ADMIN-LIVE-PR-018: workspace-wide vital presets, ordering, visibility, and units.
-- Additive schema only. Historical patient vital measurements are never deleted.

alter table public.patient_vital_measurements
  add column if not exists heart_rate_bpm integer;

alter table public.patient_vital_measurements
  drop constraint if exists patient_vital_measurements_positive_values_check,
  drop constraint if exists patient_vital_measurements_blood_pressure_pair_check,
  drop constraint if exists patient_vital_measurements_value_or_cleared_check;

alter table public.patient_vital_measurements
  add constraint patient_vital_measurements_positive_values_check check (
    (weight_kg is null or weight_kg > 0)
    and (temperature_c is null or temperature_c > 0)
    and (heart_rate_bpm is null or heart_rate_bpm > 0)
    and (respiratory_rate_rpm is null or respiratory_rate_rpm > 0)
    and (blood_pressure_systolic_mmhg is null or blood_pressure_systolic_mmhg > 0)
    and (blood_pressure_diastolic_mmhg is null or blood_pressure_diastolic_mmhg > 0)
  ),
  add constraint patient_vital_measurements_blood_pressure_optional_diastolic_check check (
    blood_pressure_diastolic_mmhg is null or blood_pressure_systolic_mmhg is not null
  ),
  add constraint patient_vital_measurements_value_or_cleared_check check (
    (
      num_nonnulls(
        weight_kg,
        temperature_c,
        heart_rate_bpm,
        respiratory_rate_rpm,
        blood_pressure_systolic_mmhg,
        blood_pressure_diastolic_mmhg
      ) > 0
      and cleared_at is null
      and cleared_by_user_id is null
    )
    or (
      num_nonnulls(
        weight_kg,
        temperature_c,
        heart_rate_bpm,
        respiratory_rate_rpm,
        blood_pressure_systolic_mmhg,
        blood_pressure_diastolic_mmhg
      ) = 0
      and cleared_at is not null
      and cleared_by_user_id is not null
    )
  );

create table public.vital_presets (
  vital_key text primary key,
  label text not null,
  description text not null,
  canonical_unit text not null,
  allowed_display_units text[] not null,
  default_enabled boolean not null default false,
  default_sort_order integer not null check (default_sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vital_presets_allowed_units_check check (
    cardinality(allowed_display_units) > 0
    and canonical_unit = any(allowed_display_units)
  )
);

insert into public.vital_presets (
  vital_key, label, description, canonical_unit, allowed_display_units,
  default_enabled, default_sort_order
) values
  ('weight', '체중', '환자의 현재 체중', 'kg', array['kg', 'g'], true, 0),
  ('temperature', '체온', '체온계로 측정한 체온', '°C', array['°C', '°F'], true, 1),
  ('heart_rate', '심박수', '분당 심장 박동 수', 'bpm', array['bpm'], true, 2),
  ('respiratory_rate', '호흡수', '분당 호흡 횟수', 'rpm', array['rpm'], true, 3),
  ('blood_pressure', '혈압', '수축기 단독 또는 수축기/이완기', 'mmHg', array['mmHg'], false, 4)
on conflict (vital_key) do update set
  label = excluded.label,
  description = excluded.description,
  canonical_unit = excluded.canonical_unit,
  allowed_display_units = excluded.allowed_display_units,
  default_enabled = excluded.default_enabled,
  default_sort_order = excluded.default_sort_order,
  updated_at = now();

create table public.workspace_vital_settings (
  workspace_id text not null references public.workspaces(id) on delete cascade,
  vital_key text not null references public.vital_presets(vital_key) on delete restrict,
  enabled boolean not null default true,
  display_unit text not null,
  sort_order integer not null check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, vital_key),
  unique (workspace_id, sort_order)
);

insert into public.workspace_vital_settings (
  workspace_id, vital_key, enabled, display_unit, sort_order
)
select
  workspace.id,
  preset.vital_key,
  true,
  preset.canonical_unit,
  preset.default_sort_order
from public.workspaces workspace
cross join public.vital_presets preset
where preset.default_enabled
on conflict (workspace_id, vital_key) do nothing;

alter table public.vital_presets enable row level security;
alter table public.workspace_vital_settings enable row level security;

create policy vital_presets_authenticated_select
on public.vital_presets for select to authenticated
using (true);

create policy workspace_vital_settings_member_select
on public.workspace_vital_settings for select to authenticated
using (private.clair_is_active_workspace_member(workspace_id));

revoke all privileges on table public.vital_presets from public, anon, authenticated;
revoke all privileges on table public.workspace_vital_settings from public, anon, authenticated;
grant select on table public.vital_presets to authenticated;
grant select on table public.workspace_vital_settings to authenticated;

create or replace function public.clair_get_workspace_vital_settings(
  p_workspace_id text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
begin
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing';
  end if;

  return jsonb_build_object(
    'presets',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'key', preset.vital_key,
          'label', preset.label,
          'description', preset.description,
          'canonicalUnit', preset.canonical_unit,
          'allowedDisplayUnits', to_jsonb(preset.allowed_display_units)
        )
        order by preset.default_sort_order
      )
      from public.vital_presets preset
    ), '[]'::jsonb),
    'items',
    coalesce((
      with configured as (
        select
          setting.vital_key,
          setting.enabled,
          setting.display_unit,
          setting.sort_order
        from public.workspace_vital_settings setting
        where setting.workspace_id = p_workspace_id
      ),
      effective as (
        select * from configured
        union all
        select
          preset.vital_key,
          true,
          preset.canonical_unit,
          preset.default_sort_order
        from public.vital_presets preset
        where preset.default_enabled
          and not exists (select 1 from configured)
      )
      select jsonb_agg(
        jsonb_build_object(
          'key', effective.vital_key,
          'enabled', effective.enabled,
          'displayUnit', effective.display_unit,
          'sortOrder', effective.sort_order
        )
        order by effective.sort_order
      )
      from effective
    ), '[]'::jsonb)
  );
end;
$$;

alter table public.audit_events drop constraint if exists audit_events_event_type_check;
alter table public.audit_events add constraint audit_events_event_type_check check (event_type in (
  'workspace.created','workspace.invitation_created','workspace.invitation_resent','workspace.invitation_canceled',
  'workspace.invitation_accepted','workspace.membership_roles_changed','workspace.role_catalog_changed',
  'workspace.membership_status_changed','workspace.membership_soft_deleted','workspace.membership_archived',
  'workspace.membership_deactivated','workspace.membership_reactivated','workspace.membership_restored',
  'workspace.permission_role_deactivated','workspace.permission_role_reactivated',
  'workspace.permission_role_created','workspace.permission_role_updated',
  'workspace.job_position_deactivated','workspace.job_position_reactivated',
  'workspace.last_admin_change_blocked','user.profile_updated','user.workspace_status_message_updated',
  'reception.patient_guardian_registered','reception.walk_in_created','reception.appointment_created',
  'reception.appointment_checked_in','reception.appointment_restored','reception.encounter_cancelled',
  'reception.encounter_restored','reception.encounter_updated','reception.queue_status_changed',
  'chart.patient_called','chart.consultation_started','chart.consultation_returned_to_waiting',
  'chart.soap_saved','chart.completed','diagnosis.changed','order.draft_changed','order.confirmed',
  'order.billing_candidate_requested','order.status_changed','order_catalog.created',
  'order_catalog.updated','order_catalog.paused','billing.invoice_candidate_generated',
  'billing.invoice_line_changed','billing.invoice_issued','billing.payment_state_changed',
  'billing.refund_requested','hospital.operating_hours_updated','hospital.schedule_revision_published',
  'hospital.schedule_revision_mutated','hospital.vital_settings_updated'
));

create or replace function public.clair_replace_workspace_vital_settings(
  p_workspace_id text,
  p_actor_user_id text,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions, pg_temp
as $$
declare
  v_actor_user_id uuid;
  v_membership_id uuid;
  v_item jsonb;
  v_count integer;
  v_index integer := 0;
  v_key text;
  v_unit text;
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
  if not private.clair_current_user_has_workspace_permission(p_workspace_id, 'hospital_settings:manage') then
    raise exception 'permission_missing';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'invalid_vital_settings';
  end if;

  v_count := jsonb_array_length(p_items);
  if v_count < 1 or v_count > (select count(*) from public.vital_presets) then
    raise exception 'invalid_vital_settings';
  end if;
  if (
    select count(distinct item->>'key') <> v_count
      or count(distinct (item->>'sortOrder')::integer) <> v_count
    from jsonb_array_elements(p_items) item
  ) then
    raise exception 'invalid_vital_settings';
  end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(v_item) <> 'object'
      or jsonb_typeof(v_item->'enabled') <> 'boolean'
      or jsonb_typeof(v_item->'sortOrder') <> 'number'
      or (v_item->>'sortOrder')::integer <> v_index
    then
      raise exception 'invalid_vital_settings';
    end if;

    v_key := v_item->>'key';
    v_unit := v_item->>'displayUnit';
    if not exists (
      select 1
      from public.vital_presets preset
      where preset.vital_key = v_key
        and v_unit = any(preset.allowed_display_units)
    ) then
      raise exception 'invalid_vital_settings';
    end if;
    v_index := v_index + 1;
  end loop;

  delete from public.workspace_vital_settings
  where workspace_id = p_workspace_id;

  for v_item in select value from jsonb_array_elements(p_items) loop
    insert into public.workspace_vital_settings (
      workspace_id, vital_key, enabled, display_unit, sort_order
    ) values (
      p_workspace_id,
      v_item->>'key',
      (v_item->>'enabled')::boolean,
      v_item->>'displayUnit',
      (v_item->>'sortOrder')::integer
    );
  end loop;

  select membership.id
  into v_membership_id
  from public.user_memberships membership
  where membership.workspace_id = p_workspace_id
    and membership.user_id = v_actor_user_id
    and membership.status = 'active';

  perform public.clair_append_audit_event(
    'vital-settings-' || gen_random_uuid()::text,
    p_workspace_id,
    v_actor_user_id,
    v_membership_id,
    'hospital.vital_settings_updated',
    'workspace',
    p_workspace_id,
    p_after_snapshot => jsonb_build_object('items', p_items)
  );

  return public.clair_get_workspace_vital_settings(p_workspace_id);
end;
$$;

create or replace function public.clair_upsert_waiting_encounter_vitals(
  p_workspace_id text,
  p_actor_user_id text,
  p_encounter_id uuid,
  p_vitals jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions, pg_temp
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
  v_now timestamptz := now();
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
  if not private.clair_current_user_has_workspace_permission(p_workspace_id, 'vital:write') then
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

  if p_vitals is null or jsonb_typeof(p_vitals) <> 'object' then
    raise exception 'invalid_vitals';
  end if;
  if (p_vitals ? 'weightKg' and p_vitals->'weightKg' <> 'null'::jsonb and jsonb_typeof(p_vitals->'weightKg') <> 'number')
    or (p_vitals ? 'temperatureC' and p_vitals->'temperatureC' <> 'null'::jsonb and jsonb_typeof(p_vitals->'temperatureC') <> 'number')
    or (p_vitals ? 'heartRateBpm' and p_vitals->'heartRateBpm' <> 'null'::jsonb and jsonb_typeof(p_vitals->'heartRateBpm') <> 'number')
    or (p_vitals ? 'respiratoryRateRpm' and p_vitals->'respiratoryRateRpm' <> 'null'::jsonb and jsonb_typeof(p_vitals->'respiratoryRateRpm') <> 'number')
    or (p_vitals ? 'bloodPressureSystolicMmhg' and p_vitals->'bloodPressureSystolicMmhg' <> 'null'::jsonb and jsonb_typeof(p_vitals->'bloodPressureSystolicMmhg') <> 'number')
    or (p_vitals ? 'bloodPressureDiastolicMmhg' and p_vitals->'bloodPressureDiastolicMmhg' <> 'null'::jsonb and jsonb_typeof(p_vitals->'bloodPressureDiastolicMmhg') <> 'number')
  then
    raise exception 'invalid_vitals';
  end if;

  -- Keep the RPC boundary as strict as the client: PostgreSQL would otherwise
  -- round decimal JSON values when casting them to integer/limited-scale columns.
  if (p_vitals ? 'weightKg' and p_vitals->'weightKg' <> 'null'::jsonb
        and (p_vitals->>'weightKg')::numeric <> round((p_vitals->>'weightKg')::numeric, 2))
    or (p_vitals ? 'temperatureC' and p_vitals->'temperatureC' <> 'null'::jsonb
        and (p_vitals->>'temperatureC')::numeric <> round((p_vitals->>'temperatureC')::numeric, 1))
    or (p_vitals ? 'heartRateBpm' and p_vitals->'heartRateBpm' <> 'null'::jsonb
        and (p_vitals->>'heartRateBpm')::numeric <> trunc((p_vitals->>'heartRateBpm')::numeric))
    or (p_vitals ? 'respiratoryRateRpm' and p_vitals->'respiratoryRateRpm' <> 'null'::jsonb
        and (p_vitals->>'respiratoryRateRpm')::numeric <> trunc((p_vitals->>'respiratoryRateRpm')::numeric))
    or (p_vitals ? 'bloodPressureSystolicMmhg' and p_vitals->'bloodPressureSystolicMmhg' <> 'null'::jsonb
        and (p_vitals->>'bloodPressureSystolicMmhg')::numeric <> trunc((p_vitals->>'bloodPressureSystolicMmhg')::numeric))
    or (p_vitals ? 'bloodPressureDiastolicMmhg' and p_vitals->'bloodPressureDiastolicMmhg' <> 'null'::jsonb
        and (p_vitals->>'bloodPressureDiastolicMmhg')::numeric <> trunc((p_vitals->>'bloodPressureDiastolicMmhg')::numeric))
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

  perform pg_advisory_xact_lock(hashtext(p_workspace_id || ':' || p_encounter_id::text));

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
  if v_queue.id is null or v_encounter.status <> 'waiting' or v_queue.status <> 'waiting' then
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

  v_has_value := num_nonnulls(
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

  return jsonb_build_object(
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


create or replace function public.clair_get_patient_latest_vital_for_encounter(
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
  if not private.clair_current_user_has_workspace_permission(p_workspace_id, 'patient:view') then
    raise exception 'permission_missing';
  end if;

  select patient_id into v_patient_id
  from public.encounters
  where workspace_id = p_workspace_id
    and id = p_encounter_id
    and status <> 'cancelled';
  if v_patient_id is null then raise exception 'encounter_unavailable'; end if;

  select * into v_measurement
  from public.patient_vital_measurements
  where workspace_id = p_workspace_id and patient_id = v_patient_id
  order by measured_at desc, created_at desc, id desc
  limit 1;

  return jsonb_build_object(
    'patientId', v_patient_id::text,
    'vital', case when v_measurement.id is null then null else jsonb_build_object(
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
    ) end
  );
end;
$$;

alter function public.clair_get_chart_preconsultation_context(text, uuid)
  set schema private;
alter function private.clair_get_chart_preconsultation_context(text, uuid)
  rename to clair_get_chart_preconsultation_context_vital_settings_base;

create or replace function public.clair_get_chart_preconsultation_context(
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
  v_result jsonb;
  v_vitals jsonb;
begin
  v_result := private.clair_get_chart_preconsultation_context_vital_settings_base(
    p_workspace_id,
    p_encounter_id
  );

  select coalesce(
    jsonb_agg(
      vital.item || jsonb_build_object('heartRateBpm', measurement.heart_rate_bpm)
      order by vital.ordinality
    ),
    '[]'::jsonb
  )
  into v_vitals
  from jsonb_array_elements(coalesce(v_result->'vitals', '[]'::jsonb))
    with ordinality as vital(item, ordinality)
  left join public.patient_vital_measurements measurement
    on measurement.id::text = vital.item->>'id'
   and measurement.workspace_id = p_workspace_id;

  return jsonb_set(v_result, '{vitals}', v_vitals, true);
end;
$$;

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
  v_actor uuid := nullif(p_actor_user_id, '')::uuid;
  v_start timestamptz := coalesce(nullif(p_walk_in->>'plannedStartAt', '')::timestamptz, now());
  v_duration integer := coalesce(nullif(p_walk_in->>'durationMinutes', '')::integer, 30);
  v_vitals jsonb := coalesce(p_walk_in->'vitals', '{}'::jsonb);
  v_passthrough_vitals jsonb;
  v_sanitized_walk_in jsonb;
  v_result jsonb;
  v_encounter_id uuid;
  v_patient_id uuid;
  v_heart_rate_bpm integer;
  v_systolic integer;
  v_diastolic integer;
begin
  if v_actor is null or v_actor <> auth.uid() then raise exception 'actor_mismatch'; end if;
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing';
  end if;
  if not private.clair_current_user_has_workspace_permission(p_workspace_id, 'reception:create') then
    raise exception 'permission_missing';
  end if;
  perform private.clair_assert_reception_time_allowed(
    p_workspace_id,
    v_start,
    v_start + make_interval(mins => v_duration),
    'walk_in'
  );

  if jsonb_typeof(v_vitals) <> 'object' then raise exception 'invalid_vitals'; end if;
  if v_vitals ? 'heartRateBpm' then
    if jsonb_typeof(v_vitals->'heartRateBpm') <> 'number'
      or (v_vitals->>'heartRateBpm')::numeric <> trunc((v_vitals->>'heartRateBpm')::numeric)
    then raise exception 'invalid_vitals'; end if;
    v_heart_rate_bpm := (v_vitals->>'heartRateBpm')::integer;
  end if;

  if v_vitals ? 'bloodPressure' then
    if jsonb_typeof(v_vitals->'bloodPressure') <> 'object'
      or jsonb_typeof(v_vitals->'bloodPressure'->'systolicMmhg') <> 'number'
    then raise exception 'invalid_vitals'; end if;
    if (v_vitals #>> '{bloodPressure,systolicMmhg}')::numeric
        <> trunc((v_vitals #>> '{bloodPressure,systolicMmhg}')::numeric)
    then raise exception 'invalid_vitals'; end if;
    v_systolic := (v_vitals #>> '{bloodPressure,systolicMmhg}')::integer;

    if v_vitals->'bloodPressure' ? 'diastolicMmhg'
      and v_vitals->'bloodPressure'->'diastolicMmhg' <> 'null'::jsonb
    then
      if jsonb_typeof(v_vitals->'bloodPressure'->'diastolicMmhg') <> 'number'
        or (v_vitals #>> '{bloodPressure,diastolicMmhg}')::numeric
          <> trunc((v_vitals #>> '{bloodPressure,diastolicMmhg}')::numeric)
      then raise exception 'invalid_vitals'; end if;
      v_diastolic := (v_vitals #>> '{bloodPressure,diastolicMmhg}')::integer;
    end if;
  end if;

  if (v_heart_rate_bpm is not null and v_heart_rate_bpm <= 0)
    or (v_systolic is not null and v_systolic <= 0)
    or (v_diastolic is not null and v_diastolic <= 0)
  then raise exception 'invalid_vitals'; end if;

  v_passthrough_vitals := v_vitals - 'heartRateBpm' - 'bloodPressure';
  v_sanitized_walk_in := case
    when v_passthrough_vitals = '{}'::jsonb then p_walk_in - 'vitals'
    else jsonb_set(p_walk_in, '{vitals}', v_passthrough_vitals, true)
  end;

  v_result := private.clair_create_reception_walk_in_encounter_internal(
    p_workspace_id,
    p_actor_user_id,
    v_sanitized_walk_in
  );

  v_encounter_id := nullif(v_result #>> '{encounter,id}', '')::uuid;
  v_patient_id := nullif(v_result #>> '{encounter,patientId}', '')::uuid;

  if v_heart_rate_bpm is not null or v_systolic is not null then
    update public.patient_vital_measurements
    set
      heart_rate_bpm = v_heart_rate_bpm,
      blood_pressure_systolic_mmhg = v_systolic,
      blood_pressure_diastolic_mmhg = v_diastolic,
      updated_at = now(),
      updated_by_user_id = v_actor
    where workspace_id = p_workspace_id
      and encounter_id = v_encounter_id;

    if not found then
      insert into public.patient_vital_measurements (
        workspace_id,
        patient_id,
        encounter_id,
        measured_at,
        recorded_by_user_id,
        updated_at,
        updated_by_user_id,
        heart_rate_bpm,
        blood_pressure_systolic_mmhg,
        blood_pressure_diastolic_mmhg
      ) values (
        p_workspace_id,
        v_patient_id,
        v_encounter_id,
        now(),
        v_actor,
        now(),
        v_actor,
        v_heart_rate_bpm,
        v_systolic,
        v_diastolic
      );
    end if;
  end if;

  return v_result;
end;
$$;

revoke all on function public.clair_get_workspace_vital_settings(text) from public, anon;
revoke all on function public.clair_replace_workspace_vital_settings(text, text, jsonb) from public, anon;
revoke all on function public.clair_upsert_waiting_encounter_vitals(text, text, uuid, jsonb) from public, anon;
revoke all on function public.clair_get_patient_latest_vital_for_encounter(text, uuid) from public, anon;
revoke all on function public.clair_get_chart_preconsultation_context(text, uuid) from public, anon;
revoke all on function public.clair_create_reception_walk_in_encounter(text, text, jsonb) from public, anon;
revoke all on function private.clair_get_chart_preconsultation_context_vital_settings_base(text, uuid)
  from public, anon, authenticated;

grant execute on function public.clair_get_workspace_vital_settings(text) to authenticated;
grant execute on function public.clair_replace_workspace_vital_settings(text, text, jsonb) to authenticated;
grant execute on function public.clair_upsert_waiting_encounter_vitals(text, text, uuid, jsonb) to authenticated;
grant execute on function public.clair_get_patient_latest_vital_for_encounter(text, uuid) to authenticated;
grant execute on function public.clair_get_chart_preconsultation_context(text, uuid) to authenticated;
grant execute on function public.clair_create_reception_walk_in_encounter(text, text, jsonb) to authenticated;

comment on table public.vital_presets is
  'Curated product vital definitions and supported display units.';
comment on table public.workspace_vital_settings is
  'Workspace inclusion, enabled state, display unit, and input/display order for curated vital presets.';
comment on function public.clair_replace_workspace_vital_settings(text, text, jsonb) is
  'Actor-bound hospital_settings:manage replacement with catalog validation and audit emission.';
