-- Measure the existing lock acquisitions without changing their order or scope.
begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $migration$
declare
  v_definition text := pg_get_functiondef(
    'public.clair_save_chart_order_draft_phase2_base(text,text,uuid,jsonb)'::regprocedure
  );
  v_lock text := '  perform pg_advisory_xact_lock(';
  v_after_locks text := '  v_current_etag := private.clair_b3_order_draft_etag(p_workspace_id, p_encounter_id);';
begin
  if strpos(v_definition, 'clair.draft_initial_lock_ms') = 0 then
    if strpos(v_definition, E'\nbegin\n') = 0
      or strpos(v_definition, v_lock) = 0
      or strpos(v_definition, v_after_locks) = 0 then
      raise exception 'chart_draft_lock_timing_patch_target_mismatch';
    end if;

    v_definition := replace(v_definition, E'\nbegin\n', E'\n  v_lock_started_at timestamptz;\nbegin\n');
    v_definition := replace(v_definition, v_lock, $before$
  if pg_catalog.current_setting('clair.draft_initial_lock_ms', true) = 'pending' then
    v_lock_started_at := pg_catalog.clock_timestamp();
  end if;
$before$ || v_lock);
    v_definition := replace(v_definition, v_after_locks, $after$
  if v_lock_started_at is not null then
    perform pg_catalog.set_config('clair.draft_initial_lock_ms',
      greatest(0, round(extract(epoch from pg_catalog.clock_timestamp() - v_lock_started_at) * 1000, 1))::text,
      true);
  end if;
$after$ || v_after_locks);
    execute v_definition;
  end if;
end;
$migration$;

do $migration$
declare
  v_definition text := pg_get_functiondef(
    'public.clair_save_chart_order_draft_for_chart(text,text,uuid,uuid,jsonb)'::regprocedure
  );
begin
  if strpos(v_definition, 'X-Clair-Draft-Timing') = 0 then
    if strpos(v_definition, 'declare v_result jsonb;') = 0
      or strpos(v_definition, '  v_result := public.clair_save_chart_order_draft_encounter_base(') = 0
      or strpos(v_definition, '  perform private.clair_require_order_chart(p_workspace_id, p_actor_user_id, p_encounter_id, p_chart_id);') = 0
      or strpos(v_definition, '  return v_result;') = 0 then
      raise exception 'chart_draft_timing_patch_target_mismatch';
    end if;

    v_definition := replace(v_definition, 'declare v_result jsonb;', $declaration$
declare
  v_started_at timestamptz := pg_catalog.clock_timestamp();
  v_previous_lock_ms text := pg_catalog.current_setting('clair.draft_initial_lock_ms', true);
  v_guard_ms numeric;
  v_lock_ms text;
  v_timing text;
  v_result jsonb;
$declaration$);
    v_definition := replace(v_definition,
      '  perform private.clair_require_order_chart(p_workspace_id, p_actor_user_id, p_encounter_id, p_chart_id);', $guard$
  perform private.clair_require_order_chart(p_workspace_id, p_actor_user_id, p_encounter_id, p_chart_id);
  v_guard_ms := greatest(0, round(extract(epoch from pg_catalog.clock_timestamp() - v_started_at) * 1000, 1));
$guard$);
    v_definition := replace(v_definition,
      '  v_result := public.clair_save_chart_order_draft_encounter_base(', $before$
  if pg_catalog.current_setting('request.method', true) = 'POST' then
    perform pg_catalog.set_config('clair.draft_initial_lock_ms', 'pending', true);
  end if;
  v_result := public.clair_save_chart_order_draft_encounter_base($before$);
    v_definition := replace(v_definition, '  return v_result;', $response$
  if pg_catalog.current_setting('request.method', true) = 'POST' then
    v_lock_ms := pg_catalog.current_setting('clair.draft_initial_lock_ms', true);
    perform pg_catalog.set_config('clair.draft_initial_lock_ms', coalesce(v_previous_lock_ms, ''), true);
    v_timing := 'db_function;dur=' ||
      greatest(0, round(extract(epoch from pg_catalog.clock_timestamp() - v_started_at) * 1000, 1))::text
      || ', db_chart_guard;dur=' || v_guard_ms::text;
    if v_lock_ms ~ '^[0-9]+([.][0-9]+)?$' then
      v_timing := v_timing || ', db_initial_locks;dur=' || v_lock_ms;
    end if;
    perform pg_catalog.set_config('response.headers',
      (coalesce(nullif(pg_catalog.current_setting('response.headers', true), '')::jsonb, '[]'::jsonb)
        || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('X-Clair-Draft-Timing', v_timing)))::text,
      true);
  end if;
  return v_result;
$response$);
    execute v_definition;
  end if;
end;
$migration$;

commit;
