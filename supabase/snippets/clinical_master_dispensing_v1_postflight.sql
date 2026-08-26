\set ON_ERROR_STOP on

\if :{?PR017_EMBEDDED_POSTFLIGHT}
\else
begin;
set transaction read only;
\endif
set statement_timeout = '60s';

create temporary table pr017_release on commit drop as
select payload.release_id, payload.payload_sha256, payload.record_count
from private.clinical_master_dispensing_release_payloads payload
where payload.payload_sha256 =
  '3825feb207ed3ea3b9fcf3be69f3e1745f4571671d988da3d57a760e3f19460b';

select
  (select pg_catalog.count(*) from pr017_release) as exact_payload_release_count,
  release.release_id,
  release.payload_sha256,
  release.record_count,
  master_release.release_key,
  master_release.status,
  master_release.record_count as manifest_record_count,
  master_release.adoption_scope
from pr017_release release
join master.master_releases master_release on master_release.id = release.release_id;

select relation_name, rls_enabled, policy_count, anon_has_dml,
  authenticated_has_dml, service_role_has_dml
from (
  select
    namespace.nspname || '.' || relation.relname as relation_name,
    relation.relrowsecurity as rls_enabled,
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
    ('master', 'medication_ingredients'),
    ('master', 'evidence_documents'),
    ('master', 'medication_products'),
    ('master', 'medication_product_ingredients'),
    ('master', 'medication_species_applicability'),
    ('master', 'medication_product_handling'),
    ('master', 'dispensing_order_profiles'),
    ('master', 'evidence_assertions'),
    ('master', 'clinical_reviews'),
    ('master', 'medication_regulatory_profiles'),
    ('private', 'clinical_master_dispensing_release_payloads'),
    ('private', 'clinical_master_dispensing_adoption_events')
  )
) relations
order by relation_name;

select
  namespace.nspname || '.' || procedure.proname || '('
    || pg_catalog.pg_get_function_identity_arguments(procedure.oid) || ')' as function_name,
  pg_catalog.has_function_privilege('anon', procedure.oid, 'EXECUTE') as anon_can_execute,
  pg_catalog.has_function_privilege('authenticated', procedure.oid, 'EXECUTE')
    as authenticated_can_execute,
  pg_catalog.has_function_privilege('service_role', procedure.oid, 'EXECUTE')
    as service_role_can_execute
from pg_catalog.pg_proc procedure
join pg_catalog.pg_namespace namespace on namespace.oid = procedure.pronamespace
where procedure.oid in (
  'private.publish_clinical_master_dispensing_release(jsonb,uuid)'::pg_catalog.regprocedure,
  'private.adopt_clinical_master_dispensing_release(text,uuid,uuid,text[])'::pg_catalog.regprocedure
)
order by function_name;

select metric, row_count
from pr017_release release
cross join lateral (values
  ('ingredients', (select pg_catalog.count(*) from master.medication_ingredients row where row.source_release_id = release.release_id)),
  ('evidence_documents', (select pg_catalog.count(*) from master.evidence_documents row where row.source_release_id = release.release_id)),
  ('products', (select pg_catalog.count(*) from master.medication_products row where row.source_release_id = release.release_id)),
  ('product_ingredients', (select pg_catalog.count(*) from master.medication_product_ingredients row where row.source_release_id = release.release_id)),
  ('species_applicability', (select pg_catalog.count(*) from master.medication_species_applicability row where row.source_release_id = release.release_id)),
  ('product_handling', (select pg_catalog.count(*) from master.medication_product_handling row where row.source_release_id = release.release_id)),
  ('dispensing_profiles', (select pg_catalog.count(*) from master.dispensing_order_profiles row where row.source_release_id = release.release_id)),
  ('evidence_assertions', (select pg_catalog.count(*) from master.evidence_assertions row where row.source_release_id = release.release_id)),
  ('clinical_reviews', (select pg_catalog.count(*) from master.clinical_reviews row where row.source_release_id = release.release_id)),
  ('regulatory_profiles', (select pg_catalog.count(*) from master.medication_regulatory_profiles row where row.source_release_id = release.release_id))
) counts(metric, row_count)
order by metric;

select
  pg_catalog.count(*)::integer as profile_count,
  pg_catalog.count(*) filter (where master.clair_dispensing_profile_clinical_use_allowed(
    profile.id,
    profile.profile_revision
  ))::integer as clinical_use_allowed_count
from master.dispensing_order_profiles profile
join pr017_release release on release.release_id = profile.source_release_id;

select
  catalog.workspace_id,
  pg_catalog.count(*)::integer as adopted_profile_count,
  pg_catalog.count(*) filter (where catalog.availability_status = 'pending_activation')::integer
    as pending_activation_count,
  pg_catalog.count(*) filter (where catalog.clinical_use_allowed)::integer
    as clinical_use_allowed_count,
  private.clinical_master_sha256(pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object(
      'id', catalog.id,
      'sourceDispensingProfileId', catalog.source_dispensing_profile_id,
      'sourceDispensingProfileRevision', catalog.source_dispensing_profile_revision,
      'catalogRevision', catalog.catalog_revision,
      'availabilityStatus', catalog.availability_status,
      'clinicalUseAllowed', catalog.clinical_use_allowed,
      'snapshotSha256', catalog.dispensing_profile_snapshot_sha256
    ) order by catalog.id
  )) as dispensing_fingerprint
from public.order_catalog_items catalog
join master.dispensing_order_profiles profile
  on profile.id = catalog.source_dispensing_profile_id
 and profile.profile_revision = catalog.source_dispensing_profile_revision
join pr017_release release on release.release_id = profile.source_release_id
group by catalog.workspace_id
order by catalog.workspace_id;

select
  workspace.id as workspace_id,
  pg_catalog.count(catalog.id)::integer as catalog_count,
  private.clinical_master_sha256(coalesce(pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object(
      'id', catalog.id,
      'sourceMasterRecordId', catalog.source_master_record_id,
      'sourceMasterRevision', catalog.source_master_revision,
      'catalogRevision', catalog.catalog_revision,
      'availabilityStatus', catalog.availability_status,
      'sourceDispensingProfileId', catalog.source_dispensing_profile_id,
      'snapshotSha256', catalog.dispensing_profile_snapshot_sha256
    ) order by catalog.id
  ) filter (where catalog.id is not null), '[]'::jsonb)) as catalog_fingerprint
from public.workspaces workspace
left join public.order_catalog_items catalog on catalog.workspace_id = workspace.id
where workspace.id = 'clair-foreign-demo'
group by workspace.id;

select
  (select pg_catalog.count(*) from public.orders order_row
   join public.order_catalog_items catalog
     on catalog.workspace_id = order_row.workspace_id
    and catalog.id = order_row.workspace_catalog_item_id
   join master.dispensing_order_profiles profile
     on profile.id = catalog.source_dispensing_profile_id
   join pr017_release release on release.release_id = profile.source_release_id)
    as runtime_order_count,
  (select pg_catalog.count(*) from public.order_tasks task
   join public.orders order_row on order_row.workspace_id = task.workspace_id and order_row.id = task.order_id
   join public.order_catalog_items catalog
     on catalog.workspace_id = order_row.workspace_id and catalog.id = order_row.workspace_catalog_item_id
   join master.dispensing_order_profiles profile on profile.id = catalog.source_dispensing_profile_id
   join pr017_release release on release.release_id = profile.source_release_id)
    as runtime_task_count,
  (select pg_catalog.count(*) from public.order_fulfillment_work_items work_item
   join public.orders order_row on order_row.workspace_id = work_item.workspace_id and order_row.id = work_item.order_id
   join public.order_catalog_items catalog
     on catalog.workspace_id = order_row.workspace_id and catalog.id = order_row.workspace_catalog_item_id
   join master.dispensing_order_profiles profile on profile.id = catalog.source_dispensing_profile_id
   join pr017_release release on release.release_id = profile.source_release_id)
    as runtime_fulfillment_count,
  (select pg_catalog.count(*) from public.order_billing_candidates candidate
   join public.orders order_row on order_row.workspace_id = candidate.workspace_id and order_row.id = candidate.order_id
   join public.order_catalog_items catalog
     on catalog.workspace_id = order_row.workspace_id and catalog.id = order_row.workspace_catalog_item_id
   join master.dispensing_order_profiles profile on profile.id = catalog.source_dispensing_profile_id
   join pr017_release release on release.release_id = profile.source_release_id)
    as runtime_billing_count;

select
  event.workspace_id,
  event.release_id,
  event.actor_user_id,
  event.profile_count,
  event.clinical_use_allowed_count,
  event.availability_status,
  event.before_count,
  event.after_count,
  event.before_fingerprint,
  event.after_fingerprint,
  event.created_at
from private.clinical_master_dispensing_adoption_events event
join pr017_release release on release.release_id = event.release_id
order by event.workspace_id, event.created_at;

\if :{?PR017_EMBEDDED_POSTFLIGHT}
\else
rollback;
\endif
