-- Keep all original WP10 table/workspace coverage; hash each row once.
-- Avoid serializing whole-table JSON aggregates in the older WP09 helper.
-- WP09 behavior is untouched. No rows, privileges or mutation boundaries change.
create or replace function private.clair_wp10_state_fingerprint() returns jsonb
language plpgsql security invoker set search_path=pg_catalog,public,private,master as $f$
declare result jsonb:='[]'; r record; scope text; fingerprint jsonb;
  targets text[]:=array['clair-demo','clair-foreign-demo','workspace-clair-cheongdam','workspace-clinical-master-pilot-v1'];
begin
  for r in select schemaname,tablename from pg_tables where schemaname='master'
    or (schemaname='private' and tablename='clinical_master_dispensing_service_review_events') order by schemaname,tablename loop
    execute format('select jsonb_build_object(''schema'',$1,''table'',$2,''count'',count(*),''sha256'',encode(extensions.digest(coalesce(string_agg(hash,'''' order by hash),''''),''sha256''),''hex'')) from (select encode(extensions.digest(to_jsonb(t)::text,''sha256''),''hex'') hash from %I.%I t) rows',r.schemaname,r.tablename)
      into fingerprint using r.schemaname,r.tablename;
    result:=result||jsonb_build_array(fingerprint);
  end loop;
  foreach scope in array targets loop
    for r in select unnest(array['order_catalog_items','lab_test_items','lab_test_item_versions',
      'order_catalog_lab_test_item_links','orders','order_tasks','order_task_events','order_confirmation_commands',
      'order_fulfillment_work_items','order_billing_candidates','lab_result_entries','lab_result_entry_rows',
      'order_sets','order_set_revisions','order_execution_result_versions','lab_atomic_retest_requests',
      'workspace_lab_devices','workspace_lab_result_profile_bindings','workspace_lab_profile_events',
      'workspace_lab_composition_revisions','workspace_lab_composition_apply_requests','workspace_lab_profile_override_versions',
      'audit_events','workspace_master_updates','workspace_lab_item_updates','workspace_lab_catalog_updates','lab_test_categories',
      'notification_events','notification_user_states',
      'workspace_inpatient_locations','workspace_inpatient_location_events','user_memberships',
      'workspace_permission_roles','workspace_membership_permission_role_assignments']) as tablename loop
      execute format('select jsonb_build_object(''workspaceId'',$1,''tableName'',$2,''count'',count(*),''sha256'',encode(extensions.digest(coalesce(string_agg(hash,'''' order by hash),''''),''sha256''),''hex'')) from (select encode(extensions.digest(to_jsonb(t)::text,''sha256''),''hex'') hash from public.%I t where workspace_id=$1) rows',r.tablename)
        into fingerprint using scope,r.tablename;
      result:=result||jsonb_build_array(fingerprint);
    end loop;
  end loop;
  return jsonb_build_object('state',result,'clinicalHistory',private.clair_wp10_clinical_history_fingerprint());
end $f$;
revoke all on function private.clair_wp10_state_fingerprint() from public,anon,authenticated,service_role;
