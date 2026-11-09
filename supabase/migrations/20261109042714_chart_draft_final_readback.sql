-- The chart save returns the readback after details and candidate removals finish.
-- The two owner-only writers below have no caller that consumes their readback.
begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $migration$
declare
  v_name text;
  v_target regprocedure;
  v_definition text;
  v_readback text := '  return public.clair_get_chart_order_draft(p_workspace_id, p_encounter_id);';
  v_assignment text := '  v_base_result := public.clair_save_chart_order_draft_';
begin
  foreach v_name in array array['phase2', 'candidate', 'billing_summary'] loop
    v_target := format('public.clair_save_chart_order_draft_%s_base(text,text,uuid,jsonb)', v_name)::regprocedure;
    if exists (
      select 1
      from pg_catalog.pg_proc proc
      cross join lateral pg_catalog.aclexplode(coalesce(proc.proacl, pg_catalog.acldefault('f', proc.proowner))) acl
      where proc.oid = v_target and acl.grantee <> proc.proowner
    ) then
      raise exception 'chart_draft_readback_requires_owner_only_writer';
    end if;
    v_definition := pg_get_functiondef(v_target);
    if strpos(v_definition, '-- chart draft final readback') > 0 then
      continue;
    end if;

    if strpos(v_definition, v_readback) = 0
      or (v_name <> 'phase2' and (
        strpos(v_definition, v_assignment) = 0
        or (length(v_definition) - length(replace(v_definition, 'v_base_result', ''))) / length('v_base_result') <> 2
      )) then
      raise exception 'chart_draft_readback_patch_target_mismatch';
    end if;

    if v_name <> 'phase2' then
      v_definition := replace(v_definition, E'  v_base_result jsonb;\n', '');
      v_definition := replace(v_definition, v_assignment, '  perform public.clair_save_chart_order_draft_');
    end if;
    if v_name <> 'billing_summary' then
      v_definition := replace(v_definition, v_readback,
        E'  -- chart draft final readback is owned by the candidate removal wrapper.\n  return null::jsonb;');
    else
      v_definition := replace(v_definition, v_readback,
        E'  -- chart draft final readback includes all writes and removals.\n' || v_readback);
    end if;

    execute v_definition;
  end loop;
end;
$migration$;

commit;
