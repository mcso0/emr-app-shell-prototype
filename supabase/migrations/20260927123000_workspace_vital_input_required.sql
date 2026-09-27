-- HOSPITAL-ADMIN-LIVE-PR-024: five optional defaults and persisted input requirements.
-- Existing workspace configurations and patient measurement history are not rewritten.

-- Materialize the former four-preset fallback for legacy workspaces with no rows
-- before changing the product defaults for newly created workspaces.
insert into public.workspace_vital_settings (
  workspace_id, vital_key, enabled, display_unit, sort_order
)
select workspace.id, preset.vital_key, true, preset.canonical_unit,
  preset.default_sort_order
from public.workspaces workspace
cross join public.vital_presets preset
where preset.default_enabled
  and not exists (
    select 1 from public.workspace_vital_settings setting
    where setting.workspace_id = workspace.id
  )
on conflict (workspace_id, vital_key) do nothing;

alter table public.workspace_vital_settings
  add column input_required boolean not null default false;
alter table public.workspace_vital_settings
  add constraint workspace_vital_settings_required_enabled_check
  check (not input_required or enabled);

update public.vital_presets
set required_in_workspace = false, updated_at = now()
where vital_key in ('weight', 'temperature');
update public.vital_presets
set label = '혈압(수축기/이완기)',
  description = '수축기와 이완기 혈압',
  default_enabled = true,
  updated_at = now()
where vital_key = 'blood_pressure';

-- A saved empty list must remain empty instead of invoking the first-read
-- default fallback. This marker is internal to the SECURITY DEFINER RPCs.
create table private.workspace_vital_configuration_saves (
  workspace_id text primary key references public.workspaces(id) on delete cascade,
  saved_at timestamptz not null default now()
);
alter table private.workspace_vital_configuration_saves enable row level security;
revoke all on table private.workspace_vital_configuration_saves from public, anon, authenticated;

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
          'allowedDisplayUnits', to_jsonb(preset.allowed_display_units),
          'requiredInWorkspace', preset.required_in_workspace
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
          setting.input_required,
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
          false,
          preset.canonical_unit,
          preset.default_sort_order
        from public.vital_presets preset
        where preset.default_enabled
          and not exists (select 1 from configured)
          and not exists (
            select 1 from private.workspace_vital_configuration_saves saved
            where saved.workspace_id = p_workspace_id
          )
      )
      select jsonb_agg(
        jsonb_build_object(
          'key', effective.vital_key,
          'enabled', effective.enabled,
          'inputRequired', effective.input_required,
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

-- Shared transactional check for chart writers and the reception writer.
-- Only enabled, configured, required settings participate in validation.
create or replace function private.clair_assert_required_vital_values(
  p_workspace_id text,
  p_weight_kg numeric,
  p_temperature_c numeric,
  p_heart_rate_bpm integer,
  p_respiratory_rate_rpm integer,
  p_systolic integer,
  p_diastolic integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.workspace_vital_settings setting
    where setting.workspace_id = p_workspace_id
      and setting.enabled
      and setting.input_required
      and case setting.vital_key
        when 'weight' then p_weight_kg is null
        when 'temperature' then p_temperature_c is null
        when 'heart_rate' then p_heart_rate_bpm is null
        when 'respiratory_rate' then p_respiratory_rate_rpm is null
        when 'blood_pressure' then p_systolic is null or p_diastolic is null
        else false
      end
  ) then
    raise exception 'required_vital_value_missing';
  end if;
end;
$$;

revoke all on function private.clair_assert_required_vital_values(
  text, numeric, numeric, integer, integer, integer, integer
) from public, anon, authenticated;

create or replace function private.clair_check_required_vital_measurement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current public.patient_vital_measurements%rowtype;
begin
  select * into v_current
  from public.patient_vital_measurements
  where id = new.id and workspace_id = new.workspace_id;
  if not found then return new; end if;
  perform private.clair_assert_required_vital_values(
    v_current.workspace_id,
    v_current.weight_kg,
    v_current.temperature_c,
    v_current.heart_rate_bpm,
    v_current.respiratory_rate_rpm,
    v_current.blood_pressure_systolic_mmhg,
    v_current.blood_pressure_diastolic_mmhg
  );
  return new;
end;
$$;

revoke all on function private.clair_check_required_vital_measurement()
from public, anon, authenticated;

create constraint trigger patient_vital_measurements_input_required
after insert or update
on public.patient_vital_measurements
deferrable initially deferred
for each row execute function private.clair_check_required_vital_measurement();

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
  if v_count > (select count(*) from public.vital_presets) then
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
      or jsonb_typeof(v_item->'inputRequired') <> 'boolean'
      or ((v_item->>'inputRequired')::boolean and not (v_item->>'enabled')::boolean)
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

  if exists (
    select 1
    from public.vital_presets preset
    where preset.required_in_workspace
      and not exists (
        select 1
        from jsonb_array_elements(p_items) item
        where item->>'key' = preset.vital_key
          and (item->>'enabled')::boolean
      )
  ) then
    raise exception 'required_vital_setting_missing_or_disabled';
  end if;

  insert into private.workspace_vital_configuration_saves (workspace_id, saved_at)
  values (p_workspace_id, now())
  on conflict (workspace_id) do update set saved_at = excluded.saved_at;

  delete from public.workspace_vital_settings
  where workspace_id = p_workspace_id;

  for v_item in select value from jsonb_array_elements(p_items) loop
    insert into public.workspace_vital_settings (
      workspace_id, vital_key, enabled, input_required, display_unit, sort_order
    ) values (
      p_workspace_id,
      v_item->>'key',
      (v_item->>'enabled')::boolean,
      (v_item->>'inputRequired')::boolean,
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

  perform private.clair_assert_required_vital_values(
    p_workspace_id,
    nullif(v_vitals->>'weightKg', '')::numeric,
    nullif(v_vitals->>'temperatureC', '')::numeric,
    v_heart_rate_bpm,
    nullif(v_vitals->>'respiratoryRateRpm', '')::integer,
    v_systolic,
    v_diastolic
  );

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
revoke all on function public.clair_create_reception_walk_in_encounter(text, text, jsonb) from public, anon;
grant execute on function public.clair_get_workspace_vital_settings(text) to authenticated;
grant execute on function public.clair_replace_workspace_vital_settings(text, text, jsonb) to authenticated;
grant execute on function public.clair_create_reception_walk_in_encounter(text, text, jsonb) to authenticated;
