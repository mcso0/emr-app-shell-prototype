-- Child invalidation updates parent rows while archiving extra sets. A live
-- FOR UPDATE cursor can skip those changed tuples. Freeze identities first,
-- then lock/read each current row so every extra is archived with correct audit.
do $freeze_targets$
declare definition text; old_anchor text; new_anchor text;
begin
  definition:=pg_get_functiondef('private.clair_wp10_normalize_resources(text,jsonb,text)'::regprocedure);
  old_anchor:='result jsonb; location public.workspace_inpatient_locations; original_revision uuid;';
  new_anchor:=old_anchor||' extra_set_ids text[]; extra_set_id text;';
  if length(definition)-length(replace(definition,old_anchor,''))<>length(old_anchor) then raise exception 'wp10_archive_declaration_drift'; end if;
  definition:=replace(definition,old_anchor,new_anchor);
  old_anchor:=$old$for current_set in select * from public.order_sets where workspace_id=p_workspace_id and not id=any(canonical_sets) and archived_at is null for update loop$old$;
  new_anchor:=$new$select coalesce(array_agg(id order by id),'{}'::text[]) into extra_set_ids
    from public.order_sets where workspace_id=p_workspace_id and not id=any(canonical_sets) and archived_at is null;
  foreach extra_set_id in array extra_set_ids loop
    select * into strict current_set from public.order_sets
      where workspace_id=p_workspace_id and id=extra_set_id for update;$new$;
  if length(definition)-length(replace(definition,old_anchor,''))<>length(old_anchor) then raise exception 'wp10_archive_loop_drift'; end if;
  definition:=replace(definition,old_anchor,new_anchor);
  old_anchor:=$old$select value into strict x from jsonb_array_elements(p_config->'locations') where value->>'workspaceId'=p_workspace_id;$old$;
  new_anchor:=$new$if exists(select 1 from public.order_sets where workspace_id=p_workspace_id and id=any(extra_set_ids)
    and (archived_at is null or availability_status<>'inactive')) then raise exception 'wp10_extra_set_archive_incomplete'; end if;
  $new$||old_anchor;
  if length(definition)-length(replace(definition,old_anchor,''))<>length(old_anchor) then raise exception 'wp10_archive_assertion_drift'; end if;
  execute replace(definition,old_anchor,new_anchor);
end $freeze_targets$;
