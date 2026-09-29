-- LAB-PR-003: keep a retest draft on its prior order's chart.
-- Do not disable the existing chart-origin permission/status/scope trigger.
set lock_timeout = '5s';
set statement_timeout = '120s';

do $patch$
declare
  body text := pg_catalog.pg_get_functiondef('public.clair_create_lab_atomic_retest(text,jsonb)'::regprocedure);
  old_columns text := 'selected_lab_profile_version_id,selected_lab_device_id)';
  new_columns text := 'selected_lab_profile_version_id,selected_lab_device_id,origin_chart_id)';
  old_values text := 'catalog.id,catalog.catalog_revision,catalog.source_master_record_id,catalog.source_master_revision,chosen_profile,chosen_device);';
  new_values text := 'catalog.id,catalog.catalog_revision,catalog.source_master_record_id,catalog.source_master_revision,chosen_profile,chosen_device,old_order.origin_chart_id);';
begin
  if pg_catalog.strpos(body, new_columns) > 0 and pg_catalog.strpos(body, new_values) > 0 then
    return;
  end if;
  if (pg_catalog.length(body) - pg_catalog.length(pg_catalog.replace(body, old_columns, ''))) / pg_catalog.length(old_columns) <> 1
    or (pg_catalog.length(body) - pg_catalog.length(pg_catalog.replace(body, old_values, ''))) / pg_catalog.length(old_values) <> 1 then
    raise exception 'lab_atomic_retest_chart_origin_patch_anchor_mismatch';
  end if;
  body := pg_catalog.replace(pg_catalog.replace(body, old_columns, new_columns), old_values, new_values);
  execute body;
end;
$patch$;
