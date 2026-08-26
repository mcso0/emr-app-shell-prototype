\set ON_ERROR_STOP on

begin;
set transaction read only;
set statement_timeout = '30s';

select
  pg_catalog.current_database() as database_name,
  current_user as database_user,
  pg_catalog.current_setting('server_version') as server_version,
  pg_catalog.now() as inspected_at;

select version, name
from supabase_migrations.schema_migrations
order by version desc
limit 20;

select
  dependency.object_name,
  case dependency.object_kind
    when 'table' then pg_catalog.to_regclass(dependency.object_name) is not null
    else pg_catalog.to_regprocedure(dependency.object_name) is not null
  end as present
from (values
  ('table', 'master.master_releases'),
  ('table', 'master.master_records'),
  ('table', 'public.order_catalog_items'),
  ('table', 'public.orders'),
  ('function', 'private.publish_clinical_master_release(jsonb,uuid)'),
  ('function', 'private.clair_adopt_master_release_to_workspace(text,uuid)'),
  ('function', 'private.clinical_master_sha256(jsonb)'),
  ('table', 'master.dispensing_order_profiles'),
  ('table', 'private.clinical_master_dispensing_release_payloads'),
  ('table', 'private.clinical_master_dispensing_adoption_events'),
  ('function', 'private.publish_clinical_master_dispensing_release(jsonb,uuid)'),
  ('function', 'private.adopt_clinical_master_dispensing_release(text,uuid,uuid,text[])')
) dependency(object_kind, object_name)
order by dependency.object_name;

select
  namespace.nspname as schema_name,
  relation.relname as relation_name,
  relation.relrowsecurity as rls_enabled,
  relation.relforcerowsecurity as rls_forced,
  (select pg_catalog.count(*) from pg_catalog.pg_policy policy
   where policy.polrelid = relation.oid) as policy_count,
  pg_catalog.has_table_privilege('anon', relation.oid, 'SELECT,INSERT,UPDATE,DELETE')
    as anon_has_dml,
  pg_catalog.has_table_privilege('authenticated', relation.oid, 'SELECT,INSERT,UPDATE,DELETE')
    as authenticated_has_dml,
  pg_catalog.has_table_privilege('service_role', relation.oid, 'SELECT,INSERT,UPDATE,DELETE')
    as service_role_has_dml
from pg_catalog.pg_class relation
join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
where (namespace.nspname, relation.relname) in (
  ('master', 'master_releases'),
  ('master', 'master_records'),
  ('public', 'order_catalog_items'),
  ('public', 'orders'),
  ('master', 'dispensing_order_profiles'),
  ('private', 'clinical_master_dispensing_release_payloads'),
  ('private', 'clinical_master_dispensing_adoption_events')
)
order by namespace.nspname, relation.relname;

select
  target.workspace_id,
  workspace.id is not null as workspace_present,
  pg_catalog.count(catalog.id)::integer as catalog_count,
  private.clinical_master_sha256(coalesce(pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object(
      'id', catalog.id,
      'sourceMasterRecordId', catalog.source_master_record_id,
      'sourceMasterRevision', catalog.source_master_revision,
      'catalogRevision', catalog.catalog_revision,
      'availabilityStatus', catalog.availability_status,
      'customizationState', catalog.customization_state,
      'presetMergeStatus', catalog.preset_merge_status,
      'sourceProjectionFingerprint', catalog.source_projection_fingerprint
    ) order by catalog.id
  ) filter (where catalog.id is not null), '[]'::jsonb)) as catalog_fingerprint
from (values
  ('clair-demo'),
  ('workspace-clair-cheongdam'),
  ('workspace-clinical-master-pilot-v1'),
  ('clair-foreign-demo')
) target(workspace_id)
left join public.workspaces workspace on workspace.id = target.workspace_id
left join public.order_catalog_items catalog on catalog.workspace_id = workspace.id
group by target.workspace_id, workspace.id
order by target.workspace_id;

select metric, row_count
from (
  select 'confirmed_atomic_orders' as metric, pg_catalog.count(*)::bigint as row_count
  from public.orders
  where row_type = 'individual' and order_confirmation_status in ('confirmed', 'billed')
  union all
  select 'order_tasks', pg_catalog.count(*) from public.order_tasks
  union all
  select 'fulfillment_work_items', pg_catalog.count(*) from public.order_fulfillment_work_items
  union all
  select 'order_billing_candidates', pg_catalog.count(*) from public.order_billing_candidates
) metrics
order by metric;

select
  pg_catalog.count(*) filter (where state <> 'idle')::integer as other_non_idle_sessions,
  pg_catalog.count(*) filter (where wait_event_type = 'Lock')::integer as lock_waiters
from pg_catalog.pg_stat_activity
where pid <> pg_catalog.pg_backend_pid();

rollback;
