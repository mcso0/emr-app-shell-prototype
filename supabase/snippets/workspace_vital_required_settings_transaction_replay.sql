\set ON_ERROR_STOP on

begin;

create temporary table workspace_vital_required_replay_baseline (
  measurement_count bigint not null
) on commit drop;

insert into workspace_vital_required_replay_baseline (measurement_count)
select count(*) from public.patient_vital_measurements;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000001',
  true
);

do $$
declare
  v_snapshot jsonb;
begin
  v_snapshot := public.clair_get_workspace_vital_settings('clair-demo');
  if not (v_snapshot->'presets' @> '[{"key":"weight","requiredInWorkspace":true}]'::jsonb)
    or not (v_snapshot->'presets' @> '[{"key":"temperature","requiredInWorkspace":true}]'::jsonb)
  then
    raise exception 'required_vital_metadata_missing';
  end if;

  begin
    perform public.clair_replace_workspace_vital_settings(
      'clair-demo',
      '00000000-0000-4000-8000-000000000001',
      '[
        {"key":"temperature","enabled":true,"displayUnit":"°C","sortOrder":0},
        {"key":"heart_rate","enabled":true,"displayUnit":"bpm","sortOrder":1}
      ]'::jsonb
    );
    raise exception 'required_vital_omission_was_not_rejected';
  exception
    when others then
      if sqlerrm <> 'required_vital_setting_missing_or_disabled' then raise; end if;
  end;

  begin
    perform public.clair_replace_workspace_vital_settings(
      'clair-demo',
      '00000000-0000-4000-8000-000000000001',
      '[
        {"key":"weight","enabled":true,"displayUnit":"kg","sortOrder":0},
        {"key":"temperature","enabled":false,"displayUnit":"°C","sortOrder":1}
      ]'::jsonb
    );
    raise exception 'required_vital_disable_was_not_rejected';
  exception
    when others then
      if sqlerrm <> 'required_vital_setting_missing_or_disabled' then raise; end if;
  end;

  -- Remove optional heart rate while keeping both required presets.
  v_snapshot := public.clair_replace_workspace_vital_settings(
    'clair-demo',
    '00000000-0000-4000-8000-000000000001',
    '[
      {"key":"weight","enabled":true,"displayUnit":"kg","sortOrder":0},
      {"key":"temperature","enabled":true,"displayUnit":"°C","sortOrder":1},
      {"key":"respiratory_rate","enabled":true,"displayUnit":"rpm","sortOrder":2}
    ]'::jsonb
  );
  if v_snapshot->'items' @> '[{"key":"heart_rate"}]'::jsonb then
    raise exception 'optional_vital_removal_failed';
  end if;

  -- Re-add the same preset. No patient measurement row is rewritten.
  v_snapshot := public.clair_replace_workspace_vital_settings(
    'clair-demo',
    '00000000-0000-4000-8000-000000000001',
    '[
      {"key":"weight","enabled":true,"displayUnit":"kg","sortOrder":0},
      {"key":"temperature","enabled":true,"displayUnit":"°C","sortOrder":1},
      {"key":"heart_rate","enabled":true,"displayUnit":"bpm","sortOrder":2},
      {"key":"respiratory_rate","enabled":true,"displayUnit":"rpm","sortOrder":3}
    ]'::jsonb
  );
  if not (v_snapshot->'items' @> '[{"key":"heart_rate","enabled":true}]'::jsonb) then
    raise exception 'optional_vital_readd_failed';
  end if;
end;
$$;

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000004',
  true
);

do $$
begin
  begin
    perform public.clair_replace_workspace_vital_settings(
      'clair-demo',
      '00000000-0000-4000-8000-000000000004',
      '[
        {"key":"weight","enabled":true,"displayUnit":"kg","sortOrder":0},
        {"key":"temperature","enabled":true,"displayUnit":"°C","sortOrder":1}
      ]'::jsonb
    );
    raise exception 'front_desk_write_was_not_denied';
  exception
    when others then
      if sqlerrm <> 'permission_missing' then raise; end if;
  end;
end;
$$;

reset role;

do $$
begin
  if (select count(*) from public.patient_vital_measurements)
    <> (select measurement_count from workspace_vital_required_replay_baseline)
  then
    raise exception 'patient_vital_measurements_changed';
  end if;
end;
$$;

rollback;
