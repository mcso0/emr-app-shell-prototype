\set ON_ERROR_STOP on
-- Local-only replay for the release-scoped publisher/adopter migration.
-- The V3 adapter fixture is copied to /tmp in the local database container
-- before running this file. The transaction always rolls back.

begin;

\ir ../migrations/20260824091724_clinical_master_release_scoped_workspace_adoption.sql

create temporary table replay_payload(raw jsonb not null) on commit drop;
\copy replay_payload(raw) from '/tmp/clinical-master-operational-v3-adapter-output.json'

create or replace function pg_temp.clinical_master_replay_workspace_surface(p_workspace_id text)
returns jsonb language sql stable set search_path = pg_catalog, public as $$
select pg_catalog.jsonb_build_object(
  'catalog',coalesce((select pg_catalog.jsonb_agg(to_jsonb(row_value) order by row_value.id) from public.order_catalog_items row_value where row_value.workspace_id=p_workspace_id),'[]'::jsonb),
  'labItems',coalesce((select pg_catalog.jsonb_agg(to_jsonb(row_value) order by row_value.id) from public.lab_test_items row_value where row_value.workspace_id=p_workspace_id),'[]'::jsonb),
  'labVersions',coalesce((select pg_catalog.jsonb_agg(to_jsonb(row_value) order by row_value.lab_test_item_id,row_value.workspace_result_revision) from public.lab_test_item_versions row_value where row_value.workspace_id=p_workspace_id),'[]'::jsonb),
  'labLinks',coalesce((select pg_catalog.jsonb_agg(to_jsonb(row_value) order by row_value.id) from public.order_catalog_lab_test_item_links row_value where row_value.workspace_id=p_workspace_id),'[]'::jsonb),
  'masterUpdates',coalesce((select pg_catalog.jsonb_agg(to_jsonb(row_value) order by row_value.id) from public.workspace_master_updates row_value where row_value.workspace_id=p_workspace_id),'[]'::jsonb),
  'labCatalogUpdates',coalesce((select pg_catalog.jsonb_agg(to_jsonb(row_value) order by row_value.id) from public.workspace_lab_catalog_updates row_value where row_value.workspace_id=p_workspace_id),'[]'::jsonb),
  'labItemUpdates',coalesce((select pg_catalog.jsonb_agg(to_jsonb(row_value) order by row_value.id) from public.workspace_lab_item_updates row_value where row_value.workspace_id=p_workspace_id),'[]'::jsonb),
  'notifications',coalesce((select pg_catalog.jsonb_agg(to_jsonb(row_value) order by row_value.id) from public.notification_events row_value where row_value.workspace_id=p_workspace_id),'[]'::jsonb)
)
$$;

create or replace function pg_temp.clinical_master_replay_owner_surface(
  p_workspace_id text,
  p_source_master_record_id uuid
)
returns jsonb language sql stable set search_path = pg_catalog, public as $$
with catalog_ids as (
  select id from public.order_catalog_items
  where workspace_id=p_workspace_id and source_master_record_id=p_source_master_record_id
), lab_item_ids as (
  select distinct link.lab_test_item_id
  from public.order_catalog_lab_test_item_links link
  where link.workspace_id=p_workspace_id and link.order_catalog_item_id in (select id from catalog_ids)
), update_ids as (
  select id::text from public.workspace_master_updates
  where workspace_id=p_workspace_id and source_master_record_id=p_source_master_record_id
)
select pg_catalog.jsonb_build_object(
  'catalog',coalesce((select pg_catalog.jsonb_agg(to_jsonb(row_value) order by row_value.id) from public.order_catalog_items row_value where row_value.workspace_id=p_workspace_id and row_value.id in (select id from catalog_ids)),'[]'::jsonb),
  'labItems',coalesce((select pg_catalog.jsonb_agg(to_jsonb(row_value) order by row_value.id) from public.lab_test_items row_value where row_value.workspace_id=p_workspace_id and row_value.id in (select lab_test_item_id from lab_item_ids)),'[]'::jsonb),
  'labVersions',coalesce((select pg_catalog.jsonb_agg(to_jsonb(row_value) order by row_value.lab_test_item_id,row_value.workspace_result_revision) from public.lab_test_item_versions row_value where row_value.workspace_id=p_workspace_id and row_value.lab_test_item_id in (select lab_test_item_id from lab_item_ids)),'[]'::jsonb),
  'labLinks',coalesce((select pg_catalog.jsonb_agg(to_jsonb(row_value) order by row_value.id) from public.order_catalog_lab_test_item_links row_value where row_value.workspace_id=p_workspace_id and row_value.order_catalog_item_id in (select id from catalog_ids)),'[]'::jsonb),
  'masterUpdates',coalesce((select pg_catalog.jsonb_agg(to_jsonb(row_value) order by row_value.id) from public.workspace_master_updates row_value where row_value.workspace_id=p_workspace_id and row_value.source_master_record_id=p_source_master_record_id),'[]'::jsonb),
  'labCatalogUpdates',coalesce((select pg_catalog.jsonb_agg(to_jsonb(row_value) order by row_value.id) from public.workspace_lab_catalog_updates row_value where row_value.workspace_id=p_workspace_id and row_value.order_catalog_item_id in (select id from catalog_ids)),'[]'::jsonb),
  'labItemUpdates',coalesce((select pg_catalog.jsonb_agg(to_jsonb(row_value) order by row_value.id) from public.workspace_lab_item_updates row_value where row_value.workspace_id=p_workspace_id and row_value.lab_test_item_id in (select lab_test_item_id from lab_item_ids)),'[]'::jsonb),
  'notifications',coalesce((select pg_catalog.jsonb_agg(to_jsonb(row_value) order by row_value.id) from public.notification_events row_value where row_value.workspace_id=p_workspace_id and row_value.source_entity_id in (select id from update_ids)),'[]'::jsonb)
)
$$;

do $replay$
declare
  v_payload jsonb;
  v_cumulative_payload jsonb;
  v_legacy_payload jsonb;
  v_legacy_release_id uuid;
  v_legacy_result jsonb;
  v_legacy_retry jsonb;
  v_payload_result jsonb;
  v_payload_publish_retry jsonb;
  v_payload_retry jsonb;
  v_payload_release_id uuid;
  v_cumulative_release_id uuid;
  v_workspace_id text := 'clinical-master-release-scope-existing';
  v_absent_workspace_id text := 'clinical-master-release-scope-absent';
  v_metabolic_owner_id uuid;
  v_before_metabolic_surface jsonb;
  v_after_metabolic_surface jsonb;
  v_before_failure_surface jsonb;
  v_after_failure_surface jsonb;
  v_before_catalog_count integer;
  v_first_catalog_count integer;
  v_after_catalog_count integer;
  v_before_catalog_fingerprint text;
  v_first_catalog_fingerprint text;
  v_after_catalog_fingerprint text;
  v_before_lab_item_version_count integer;
  v_first_lab_item_version_count integer;
  v_after_lab_item_version_count integer;
  v_before_lab_item_version_fingerprint text;
  v_first_lab_item_version_fingerprint text;
  v_after_lab_item_version_fingerprint text;
  v_before_metabolic_snapshot jsonb;
  v_after_metabolic_snapshot jsonb;
  v_before_initial_count integer;
  v_after_initial_count integer;
  v_before_metabolic_count integer;
  v_after_metabolic_count integer;
  v_stage_owner_id uuid;
  v_stage_master_key text;
  v_stage_revision integer;
  v_stage_base_content jsonb;
  v_stage_relation_content jsonb;
  v_stage_included boolean;
  v_stage_specimen_id uuid;
  v_stage_specimen_revision integer;
  v_stage_sha text;
  v_second_stage_owner_id uuid;
  v_function record;
  v_function_oid oid;
  v_column_default text;
  v_column_not_null boolean;
begin
  select raw->'payload' into v_payload from replay_payload;
  if v_payload->>'adoptionScope' is distinct from 'payload'
     or jsonb_array_length(v_payload->'records') <> 230
     or (select count(*) from jsonb_array_elements(v_payload->'records') record_row(value) where value->>'recordType'='order') <> 120
     or v_payload::text not like '%cm.order.consult.first-visit%' then
    raise exception 'clinical_master_release_scoped_replay_payload_fixture_failed';
  end if;
  if exists (
    select 1 from jsonb_array_elements(v_payload->'records') record_row(value)
    where value->>'masterKey' in ('cm.order.consult.initial','phase1.optionb.v1.order.metabolic')
  ) then
    raise exception 'clinical_master_release_scoped_replay_nonpayload_owner_present';
  end if;
  if lower(encode(extensions.digest(
       convert_to(private.clinical_master_canonicalize_payload(v_payload)::text,'UTF8'),
       'sha256'
     ),'hex')) is distinct from '0225bc6714210cfe663bded97fe6b3cbf76fedf99dce1540a302c0fd46235893' then
    raise exception 'clinical_master_release_scoped_replay_payload_canonical_fingerprint_changed';
  end if;
  if lower(encode(extensions.digest(
       convert_to(private.clinical_master_canonicalize_payload(v_payload-'adoptionScope')::text,'UTF8'),
       'sha256'
     ),'hex')) is distinct from '3213a3f84595ae11007970448b670063c49ea167f01e1825258a655b6843c137' then
    raise exception 'clinical_master_release_scoped_replay_omitted_scope_canonical_fingerprint_changed';
  end if;

  -- Historical no-scope payloads must retain their pre-migration canonical
  -- bytes and source fingerprint, then remain idempotent on retry.
  select jsonb_build_object(
    'releaseKey', release_row.release_key,
    'releaseNotes', release_row.release_notes,
    'publishedByLabel', release_row.published_by_label,
    'records', coalesce(jsonb_agg(version_row.snapshot - 'revision' order by version_row.snapshot->>'masterKey'),'[]'::jsonb),
    'classificationPaths', coalesce((
      select jsonb_agg(jsonb_build_object(
        'pathKey', path.path_key,
        'clinicalActionKey', action_record.master_key,
        'chartGroupKey', chart_record.master_key,
        'taskRouteKey', route_record.master_key
      ) order by path.path_key)
      from master.classification_paths path
      join master.master_records action_record on action_record.id = path.clinical_action_id
      join master.master_records chart_record on chart_record.id = path.chart_group_id
      join master.master_records route_record on route_record.id = path.task_route_id
      where path.active_from_release_id = release_row.id
    ), '[]'::jsonb)
  ) into v_legacy_payload
  from master.master_releases release_row
  left join master.master_record_versions version_row on version_row.release_id = release_row.id
  where release_row.release_key = 'phase-1a-2-fallback-v1'
  group by release_row.id, release_row.release_key, release_row.release_notes, release_row.published_by_label;
  if v_legacy_payload is null then
    raise exception 'clinical_master_release_scoped_replay_legacy_fixture_missing';
  end if;
  insert into public.workspaces(id,display_name,status) values
    (v_workspace_id,'Clinical Master release-scope existing replay','active'),
    (v_absent_workspace_id,'Clinical Master release-scope absent replay','active')
  on conflict (id) do nothing;
  select id into v_legacy_release_id
  from master.master_releases
  where release_key = 'phase-1a-2-fallback-v1';
  if lower(encode(extensions.digest(convert_to(private.clinical_master_canonicalize_payload(v_legacy_payload)::text,'UTF8'),'sha256'),'hex'))
     is distinct from (select source_fingerprint from master.master_releases where id=v_legacy_release_id) then
    raise exception 'clinical_master_release_scoped_replay_legacy_canonical_bytes_changed';
  end if;
  v_legacy_result := private.publish_clinical_master_release(v_legacy_payload, null);
  v_legacy_retry := private.publish_clinical_master_release(v_legacy_payload, null);
  if (v_legacy_result->>'idempotent')::boolean is distinct from true
     or (v_legacy_retry->>'idempotent')::boolean is distinct from true
     or (v_legacy_result->>'releaseId')::uuid is distinct from v_legacy_release_id
     or (v_legacy_retry->>'releaseId')::uuid is distinct from v_legacy_release_id
     or v_legacy_result->>'sourceFingerprint' is distinct from (select source_fingerprint from master.master_releases where id=v_legacy_release_id)
     or (select adoption_scope from master.master_releases where id=v_legacy_release_id) is distinct from 'cumulative' then
    raise exception 'clinical_master_release_scoped_replay_legacy_retry_failed';
  end if;

  -- A no-scope cumulative release intentionally renames one payload lab order
  -- to the historical metabolic key.  It proves the legacy global behavior
  -- and gives payload adoption a real nonpayload catalog/lab surface that
  -- must remain byte-for-byte unchanged.
  select (v_payload - 'adoptionScope') || pg_catalog.jsonb_build_object(
    'releaseKey','clinical-master-release-scope-replay-cumulative',
    'releaseNotes','local cumulative compatibility replay',
    'records',(
      select pg_catalog.jsonb_agg(
        case when value->>'masterKey'='cm.order.lab.panel.cbc-basic'
          then pg_catalog.jsonb_set(value,'{masterKey}',to_jsonb('phase1.optionb.v1.order.metabolic'::text))
          else value end
        order by case when value->>'masterKey'='cm.order.lab.panel.cbc-basic'
          then 'phase1.optionb.v1.order.metabolic' else value->>'masterKey' end
      ) from pg_catalog.jsonb_array_elements(v_payload->'records') records(value)
    ),
    'labOrderProfiles',(
      select pg_catalog.jsonb_agg(
        case when value->>'orderMasterKey'='cm.order.lab.panel.cbc-basic'
          then pg_catalog.jsonb_set(value,'{orderMasterKey}',to_jsonb('phase1.optionb.v1.order.metabolic'::text))
          else value end
        order by case when value->>'orderMasterKey'='cm.order.lab.panel.cbc-basic'
          then 'phase1.optionb.v1.order.metabolic' else value->>'orderMasterKey' end
      ) from pg_catalog.jsonb_array_elements(v_payload->'labOrderProfiles') profiles(value)
    )
  ) into v_cumulative_payload;
  v_legacy_result := private.publish_clinical_master_release(v_cumulative_payload,null);
  v_legacy_retry := private.publish_clinical_master_release(v_cumulative_payload,null);
  v_cumulative_release_id := (v_legacy_result->>'releaseId')::uuid;
  if v_legacy_result->>'adoptionScope' is distinct from 'cumulative'
     or (v_legacy_retry->>'idempotent')::boolean is distinct from true
     or (v_legacy_retry->>'releaseId')::uuid is distinct from v_cumulative_release_id then
    raise exception 'clinical_master_release_scoped_replay_cumulative_publish_failed';
  end if;
  v_legacy_result := private.clair_adopt_master_release_to_workspace(v_workspace_id,v_cumulative_release_id);
  if v_legacy_result->>'adoptionScope' is distinct from 'cumulative' then
    raise exception 'clinical_master_release_scoped_replay_cumulative_dispatch_failed';
  end if;
  select id into v_metabolic_owner_id from master.master_records
  where master_key='phase1.optionb.v1.order.metabolic';
  v_before_metabolic_surface := pg_temp.clinical_master_replay_owner_surface(v_workspace_id,v_metabolic_owner_id);
  if pg_catalog.jsonb_array_length(v_before_metabolic_surface->'catalog') <> 1
     or pg_catalog.jsonb_array_length(v_before_metabolic_surface->'labLinks') <= 0
     or pg_catalog.jsonb_array_length(v_before_metabolic_surface->'labVersions') <= 0 then
    raise exception 'clinical_master_release_scoped_replay_existing_nonpayload_fixture_failed';
  end if;

  -- Publish and adopt the real 230-record V3 payload through the outer
  -- adopter so the lab helper is part of the replayed contract.
  v_payload_result := private.publish_clinical_master_release(v_payload, null);
  v_payload_release_id := (v_payload_result->>'releaseId')::uuid;
  if v_payload_result->>'adoptionScope' is distinct from 'payload'
     or (v_payload_result->>'recordCount')::integer is distinct from 230
     or v_payload_result->>'sourceFingerprint' is distinct from '0225bc6714210cfe663bded97fe6b3cbf76fedf99dce1540a302c0fd46235893' then
    raise exception 'clinical_master_release_scoped_replay_payload_publish_failed';
  end if;
  v_payload_publish_retry := private.publish_clinical_master_release(v_payload, null);
  if (v_payload_publish_retry->>'releaseId')::uuid is distinct from v_payload_release_id
     or (v_payload_publish_retry->>'idempotent')::boolean is distinct from true
     or v_payload_publish_retry->>'sourceFingerprint' is distinct from '0225bc6714210cfe663bded97fe6b3cbf76fedf99dce1540a302c0fd46235893' then
    raise exception 'clinical_master_release_scoped_replay_payload_publish_retry_failed';
  end if;

  select count(*), md5(coalesce(string_agg(concat_ws(':',version_row.lab_test_item_id,version_row.workspace_result_revision::text,version_row.source_master_record_id::text,version_row.source_master_revision::text), '' order by version_row.lab_test_item_id,version_row.workspace_result_revision),''))
    into v_before_lab_item_version_count, v_before_lab_item_version_fingerprint
  from public.lab_test_item_versions version_row
  where version_row.workspace_id = v_workspace_id;
  select count(*), md5(coalesce(string_agg(concat_ws(':',item.id,item.source_master_record_id::text,item.source_master_revision::text), '' order by item.id),''))
    into v_before_catalog_count, v_before_catalog_fingerprint
  from public.order_catalog_items item
  where item.workspace_id = v_workspace_id;
  v_payload_result := private.clair_adopt_master_release_to_workspace(v_workspace_id, v_payload_release_id);
  if v_payload_result->>'adoptionScope' is distinct from 'payload'
     or v_payload_result->'labProjection' is null
     or (v_payload_result->>'createdCount')::integer is distinct from 1 then
    raise exception 'clinical_master_release_scoped_replay_payload_adoption_dispatch_failed';
  end if;
  v_after_metabolic_surface := pg_temp.clinical_master_replay_owner_surface(v_workspace_id,v_metabolic_owner_id);
  if v_after_metabolic_surface is distinct from v_before_metabolic_surface then
    raise exception 'clinical_master_release_scoped_replay_existing_nonpayload_surface_mutated';
  end if;
  select count(*), md5(coalesce(string_agg(concat_ws(':',version_row.lab_test_item_id,version_row.workspace_result_revision::text,version_row.source_master_record_id::text,version_row.source_master_revision::text), '' order by version_row.lab_test_item_id,version_row.workspace_result_revision),''))
    into v_first_lab_item_version_count, v_first_lab_item_version_fingerprint
  from public.lab_test_item_versions version_row
  where version_row.workspace_id = v_workspace_id;
  select count(*), md5(coalesce(string_agg(concat_ws(':',item.id,item.source_master_record_id::text,item.source_master_revision::text), '' order by item.id),''))
    into v_first_catalog_count, v_first_catalog_fingerprint
  from public.order_catalog_items item
  where item.workspace_id = v_workspace_id;
  v_payload_retry := private.clair_adopt_master_release_to_workspace(v_workspace_id, v_payload_release_id);
  if coalesce((v_payload_retry->>'createdCount')::integer, -1) <> 0
     or coalesce((v_payload_retry->'labProjection'->>'createdItemCount')::integer, -1) <> 0 then
    raise exception 'clinical_master_release_scoped_replay_payload_retry_created_rows';
  end if;
  select count(*), md5(coalesce(string_agg(concat_ws(':',version_row.lab_test_item_id,version_row.workspace_result_revision::text,version_row.source_master_record_id::text,version_row.source_master_revision::text), '' order by version_row.lab_test_item_id,version_row.workspace_result_revision),''))
    into v_after_lab_item_version_count, v_after_lab_item_version_fingerprint
  from public.lab_test_item_versions version_row
  where version_row.workspace_id = v_workspace_id;
  if v_first_lab_item_version_count <> v_before_lab_item_version_count + (v_payload_result->'labProjection'->>'createdItemCount')::integer
     or v_payload_retry->'labProjection'->>'createdItemCount' <> '0'
     or v_after_lab_item_version_count <> v_first_lab_item_version_count
     or v_after_lab_item_version_fingerprint is distinct from v_first_lab_item_version_fingerprint then
    raise notice 'lab fingerprint diagnostic before_count=% before_fp=% first_count=% first_fp=% created=% after_count=% after_fp=% retry_created=%', v_before_lab_item_version_count, v_before_lab_item_version_fingerprint, v_first_lab_item_version_count, v_first_lab_item_version_fingerprint, v_payload_result->'labProjection'->>'createdItemCount', v_after_lab_item_version_count, v_after_lab_item_version_fingerprint, v_payload_retry->'labProjection'->>'createdItemCount';
    raise exception 'clinical_master_release_scoped_replay_lab_item_retry_fingerprint_failed';
  end if;
  select count(*), md5(coalesce(string_agg(concat_ws(':',item.id,item.source_master_record_id::text,item.source_master_revision::text), '' order by item.id),''))
    into v_after_catalog_count, v_after_catalog_fingerprint
  from public.order_catalog_items item
  where item.workspace_id = v_workspace_id;
  if v_first_catalog_count is distinct from v_before_catalog_count + 1
     or v_after_catalog_count <> v_first_catalog_count
     or v_after_catalog_fingerprint is distinct from v_first_catalog_fingerprint then
    raise exception 'clinical_master_release_scoped_replay_payload_catalog_boundary_failed';
  end if;
  v_payload_result := private.clair_adopt_master_release_to_workspace(v_absent_workspace_id,v_payload_release_id);
  if (v_payload_result->>'createdCount')::integer is distinct from 120
     or (v_payload_result->'labProjection'->>'catalogCount')::integer is distinct from 30 then
    raise exception 'clinical_master_release_scoped_replay_absent_workspace_exact_set_failed';
  end if;
  select count(*) into v_after_initial_count
  from public.order_catalog_items item
  join master.master_records owner on owner.id=item.source_master_record_id
  where item.workspace_id=v_absent_workspace_id and owner.master_key='cm.order.consult.initial';
  select count(*) into v_after_metabolic_count
  from public.order_catalog_items item
  join master.master_records owner on owner.id=item.source_master_record_id
  where item.workspace_id=v_absent_workspace_id and owner.master_key='phase1.optionb.v1.order.metabolic';
  if v_after_initial_count <> 0
     or v_after_metabolic_count <> 0 then
    raise exception 'clinical_master_release_scoped_replay_absent_nonpayload_created';
  end if;

  -- Simultaneous two-stage omission/replacement must still fail against the
  -- immutable publisher manifest before any workspace surface can mutate.
  create temporary table replay_general_stage_backup on commit drop as
    select * from private.clinical_master_lab_publish_stage
    where release_id=v_payload_release_id and record_type='order'
    order by master_key limit 2;
  create temporary table replay_specialized_stage_backup on commit drop as
    select * from private.clinical_master_lab_order_publish_stage
    where release_id=v_payload_release_id
    order by master_key limit 2;
  select owner_record_id,master_key,effective_revision,base_content,relation_content,included,specimen_master_record_id,specimen_revision,content_sha256
    into v_stage_owner_id,v_stage_master_key,v_stage_revision,v_stage_base_content,v_stage_relation_content,v_stage_included,v_stage_specimen_id,v_stage_specimen_revision,v_stage_sha
  from replay_specialized_stage_backup order by master_key limit 1;
  select owner_record_id into v_second_stage_owner_id
  from replay_specialized_stage_backup order by master_key offset 1 limit 1;
  v_before_failure_surface := pg_temp.clinical_master_replay_workspace_surface(v_workspace_id);
  delete from private.clinical_master_lab_publish_stage where release_id=v_payload_release_id and master_record_id=v_stage_owner_id;
  delete from private.clinical_master_lab_order_publish_stage where release_id=v_payload_release_id and owner_record_id=v_stage_owner_id;
  begin
    perform private.clair_adopt_master_release_to_workspace_a2_base(v_workspace_id,v_payload_release_id);
    raise exception 'clinical_master_release_scoped_replay_stage_omission_not_rejected';
  exception when others then
    if sqlerrm not like '%clinical_master_payload_adoption_manifest_parity_invalid%'
       and sqlerrm not like '%clinical_master_payload_adoption_stage_parity_invalid%' then raise; end if;
  end;
  v_after_failure_surface := pg_temp.clinical_master_replay_workspace_surface(v_workspace_id);
  if v_after_failure_surface is distinct from v_before_failure_surface then
    raise exception 'clinical_master_release_scoped_replay_stage_omission_mutated_catalog';
  end if;
  insert into private.clinical_master_lab_publish_stage select * from replay_general_stage_backup where master_record_id=v_stage_owner_id;
  insert into private.clinical_master_lab_order_publish_stage(
    release_id,owner_record_id,master_key,included,base_content,relation_content,effective_revision,specimen_master_record_id,specimen_revision,content_sha256
  ) values(v_payload_release_id,v_stage_owner_id,v_stage_master_key,v_stage_included,v_stage_base_content,v_stage_relation_content,v_stage_revision,v_stage_specimen_id,v_stage_specimen_revision,v_stage_sha);
  v_before_failure_surface := pg_temp.clinical_master_replay_workspace_surface(v_workspace_id);
  update private.clinical_master_lab_publish_stage
    set base_content=base_content || '{"replayTamper":true}'::jsonb
  where release_id=v_payload_release_id and master_record_id=v_second_stage_owner_id;
  update private.clinical_master_lab_order_publish_stage
    set base_content=base_content || '{"replayTamper":true}'::jsonb,
        content_sha256=private.clinical_master_sha256((base_content || '{"replayTamper":true}'::jsonb) || relation_content)
  where release_id=v_payload_release_id and owner_record_id=v_second_stage_owner_id;
  begin
    perform private.clair_adopt_master_release_to_workspace_a2_base(v_workspace_id,v_payload_release_id);
    raise exception 'clinical_master_release_scoped_replay_stage_mismatch_not_rejected';
  exception when others then
    if sqlerrm not like '%clinical_master_payload_adoption_manifest_parity_invalid%' then raise; end if;
  end;
  v_after_failure_surface := pg_temp.clinical_master_replay_workspace_surface(v_workspace_id);
  if v_after_failure_surface is distinct from v_before_failure_surface then
    raise exception 'clinical_master_release_scoped_replay_stage_mismatch_mutated_catalog';
  end if;

  -- Every new/renamed private function remains owned by postgres, security
  -- definer, search_path pinned, and effectively non-executable by API roles.
  for v_function in
    select * from (values
      ('private.clinical_master_assert_contract_keys(text,jsonb)', '', false),
      ('private.clinical_master_canonicalize_payload(jsonb)', '', false),
      ('private.clinical_master_payload_manifest_content_sha256(uuid,text,text,boolean,integer,jsonb,jsonb)', '', false),
      ('private.clinical_master_release_payload_owner_manifest_immutable()', 'pg_catalog', true),
      ('private.clinical_master_set_release_adoption_scope()', 'pg_catalog', true),
      ('private.publish_clinical_master_release_cumulative(jsonb,uuid)', 'public, private, master, extensions, pg_catalog', true),
      ('private.publish_clinical_master_release(jsonb,uuid)', 'public, private, master, extensions, pg_catalog', true),
      ('private.clair_adopt_master_release_to_workspace_a2_cumulative(text,uuid)', 'public, private, master, extensions, pg_temp', true),
      ('private.clair_adopt_master_release_to_workspace_payload(text,uuid)', 'public, private, master, extensions, pg_temp', true),
      ('private.clair_adopt_master_release_to_workspace_a2_base(text,uuid)', 'public, private, master, extensions, pg_temp', true),
      ('private.clair_adopt_lab_master_projection_to_workspace_payload(text,uuid)', 'public, private, master, extensions, pg_temp, pg_catalog', true),
      ('private.clair_adopt_master_release_to_workspace(text,uuid)', 'public, private, master, extensions, pg_catalog', true),
      ('private.clair_adopt_lab_master_projection_to_workspace(text,uuid)', 'public, private, master, extensions, pg_temp, pg_catalog', true)
    ) as expected(signature,search_path,security_definer)
  loop
    v_function_oid := to_regprocedure(v_function.signature);
    if v_function_oid is null then
      raise exception 'clinical_master_release_scoped_replay_security_function_missing: %', v_function.signature;
    end if;
    if not exists (select 1 from pg_proc proc where proc.oid=v_function_oid and pg_get_userbyid(proc.proowner)='postgres' and proc.prosecdef is not distinct from v_function.security_definer)
       or (v_function.search_path <> '' and not exists (select 1 from pg_proc proc cross join lateral unnest(coalesce(proc.proconfig,'{}'::text[])) setting where proc.oid=v_function_oid and setting='search_path=' || v_function.search_path))
       or (v_function.search_path = '' and not exists (select 1 from pg_proc proc cross join lateral unnest(coalesce(proc.proconfig,'{}'::text[])) setting where proc.oid=v_function_oid and setting='search_path=""'))
       or has_function_privilege('anon',v_function_oid,'execute')
       or has_function_privilege('authenticated',v_function_oid,'execute')
       or has_function_privilege('service_role',v_function_oid,'execute') then
      raise exception 'clinical_master_release_scoped_replay_security_preflight_failed: %', v_function.signature;
    end if;
  end loop;
  if pg_catalog.pg_get_userbyid((select relowner from pg_catalog.pg_class where oid='private.clinical_master_release_payload_owner_manifest'::regclass)) <> 'postgres'
     or pg_catalog.has_table_privilege('anon','private.clinical_master_release_payload_owner_manifest','select,insert,update,delete')
     or pg_catalog.has_table_privilege('authenticated','private.clinical_master_release_payload_owner_manifest','select,insert,update,delete')
     or pg_catalog.has_table_privilege('service_role','private.clinical_master_release_payload_owner_manifest','select,insert,update,delete')
     or not exists (
       select 1 from pg_catalog.pg_trigger trigger_row
       where trigger_row.tgrelid='private.clinical_master_release_payload_owner_manifest'::regclass
         and trigger_row.tgname='clinical_master_release_payload_owner_manifest_immutable'
         and not trigger_row.tgisinternal
     ) then
    raise exception 'clinical_master_release_scoped_replay_manifest_security_failed';
  end if;
  if nullif(pg_catalog.current_setting('clinical_master.manifest_write_release_id',true),'') is not null then
    raise exception 'clinical_master_release_scoped_replay_manifest_write_scope_leaked:%',
      pg_catalog.current_setting('clinical_master.manifest_write_release_id',true);
  end if;
  begin
    insert into private.clinical_master_release_payload_owner_manifest(
      release_id,master_record_id,master_key,record_type,included,
      base_content,relation_content,effective_revision,content_sha256
    )
    select v_payload_release_id,v_metabolic_owner_id,'phase1.optionb.v1.order.metabolic',
      'order',true,manifest.base_content,manifest.relation_content,
      manifest.effective_revision,manifest.content_sha256
    from private.clinical_master_release_payload_owner_manifest manifest
    where manifest.release_id=v_payload_release_id
    order by manifest.master_key limit 1;
    raise exception 'clinical_master_release_scoped_replay_manifest_insert_not_rejected';
  exception when others then
    if sqlerrm not like '%clinical_master_release_payload_owner_manifest_immutable%' then raise; end if;
  end;
  begin
    update private.clinical_master_release_payload_owner_manifest
    set master_key=master_key
    where release_id=v_payload_release_id;
    raise exception 'clinical_master_release_scoped_replay_manifest_update_not_rejected';
  exception when others then
    if sqlerrm not like '%clinical_master_release_payload_owner_manifest_immutable%' then raise; end if;
  end;
  begin
    delete from private.clinical_master_release_payload_owner_manifest
    where release_id=v_payload_release_id;
    raise exception 'clinical_master_release_scoped_replay_manifest_delete_not_rejected';
  exception when others then
    if sqlerrm not like '%clinical_master_release_payload_owner_manifest_immutable%' then raise; end if;
  end;
  select attnotnull,pg_catalog.pg_get_expr(definition.adbin,definition.adrelid)
    into v_column_not_null,v_column_default
  from pg_catalog.pg_attribute attribute
  left join pg_catalog.pg_attrdef definition
    on definition.adrelid=attribute.attrelid and definition.adnum=attribute.attnum
  where attribute.attrelid='master.master_releases'::regclass
    and attribute.attname='adoption_scope'
    and not attribute.attisdropped;
  if v_column_not_null is distinct from true
     or v_column_default is distinct from '''cumulative''::text' then
    raise exception 'clinical_master_release_scoped_replay_scope_column_constraint_failed';
  end if;
  if not exists (select 1 from pg_constraint where conrelid='master.master_releases'::regclass and conname='master_releases_adoption_scope_check' and pg_get_constraintdef(oid) like '%cumulative%' and pg_get_constraintdef(oid) like '%payload%') then
    raise exception 'clinical_master_release_scoped_replay_scope_check_missing';
  end if;
  raise notice 'clinical_master_release_scoped_workspace_adoption_replay_ok';
end;
$replay$;

rollback;
