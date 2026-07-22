-- HOSPITAL-ADMIN-LIVE-PR-019: required workspace vitals and reversible optional removal.
-- Configuration rows may be replaced; historical patient vital measurements are untouched.

alter table public.vital_presets
  add column if not exists required_in_workspace boolean not null default false;

update public.vital_presets preset
set
  required_in_workspace = true,
  default_enabled = true,
  updated_at = now()
where preset.vital_key in ('weight', 'temperature');

alter table public.vital_presets
  drop constraint if exists vital_presets_required_default_enabled_check;
alter table public.vital_presets
  add constraint vital_presets_required_default_enabled_check
  check (not required_in_workspace or default_enabled) not valid;
alter table public.vital_presets
  validate constraint vital_presets_required_default_enabled_check;

-- Preserve the existing four-default behavior for workspaces that have never
-- persisted a configuration.
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
  and not exists (
    select 1
    from public.workspace_vital_settings existing
    where existing.workspace_id = workspace.id
  )
on conflict (workspace_id, vital_key) do nothing;

-- Append only required presets missing from a partially configured workspace.
-- Existing display units and order are deliberately retained.
with workspace_max_order as (
  select
    workspace.id as workspace_id,
    coalesce(max(setting.sort_order), -1) as max_sort_order
  from public.workspaces workspace
  left join public.workspace_vital_settings setting
    on setting.workspace_id = workspace.id
  group by workspace.id
), missing_required as (
  select
    workspace_max_order.workspace_id,
    preset.vital_key,
    preset.canonical_unit,
    workspace_max_order.max_sort_order
      + row_number() over (
        partition by workspace_max_order.workspace_id
        order by preset.default_sort_order, preset.vital_key
      ) as sort_order
  from workspace_max_order
  cross join public.vital_presets preset
  where preset.required_in_workspace
    and not exists (
      select 1
      from public.workspace_vital_settings existing
      where existing.workspace_id = workspace_max_order.workspace_id
        and existing.vital_key = preset.vital_key
    )
)
insert into public.workspace_vital_settings (
  workspace_id, vital_key, enabled, display_unit, sort_order
)
select workspace_id, vital_key, true, canonical_unit, sort_order
from missing_required
on conflict (workspace_id, vital_key) do nothing;

update public.workspace_vital_settings setting
set enabled = true, updated_at = now()
from public.vital_presets preset
where preset.vital_key = setting.vital_key
  and preset.required_in_workspace
  and not setting.enabled;

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

revoke all on function public.clair_get_workspace_vital_settings(text) from public, anon;
revoke all on function public.clair_replace_workspace_vital_settings(text, text, jsonb) from public, anon;
grant execute on function public.clair_get_workspace_vital_settings(text) to authenticated;
grant execute on function public.clair_replace_workspace_vital_settings(text, text, jsonb) to authenticated;

comment on column public.vital_presets.required_in_workspace is
  'When true, every workspace must keep the preset configured and enabled. Measurement entry remains optional.';
comment on function public.clair_replace_workspace_vital_settings(text, text, jsonb) is
  'Atomically replaces workspace vital configuration, rejects missing or disabled required presets, and emits an audit event.';
