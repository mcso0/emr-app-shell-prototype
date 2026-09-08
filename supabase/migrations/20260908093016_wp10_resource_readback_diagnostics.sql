-- Include exact scoped counts in a failed readback; no guard or behavior change.
do $diagnostics$
declare definition text; old_anchor text:=$old$then raise exception 'wp10_resource_readback_failed'; end if;$old$;
new_anchor text:=$new$then raise exception 'wp10_resource_readback_failed:workspace=% bindings=% sets=% wards=%',w,
  (select count(*) from public.workspace_lab_result_profile_bindings where workspace_id=w and override_version_id is null),
  (select count(*) from public.order_sets where workspace_id=w and availability_status='active' and archived_at is null),
  (select count(*) from public.workspace_inpatient_locations where workspace_id=w and active and is_default); end if;$new$;
begin
  definition:=pg_get_functiondef('private.clair_apply_wp10_ready_orders(jsonb,text,boolean)'::regprocedure);
  if length(definition)-length(replace(definition,old_anchor,''))<>length(old_anchor) then raise exception 'wp10_resource_diagnostic_source_drift'; end if;
  execute replace(definition,old_anchor,new_anchor);
end $diagnostics$;
