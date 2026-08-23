\set ON_ERROR_STOP on
-- PR-011 local-only rollback replay. Apply the additive migration locally first:
--   psql --dbname "$LOCAL_DATABASE_URL" --file supabase/migrations/20260823124500_clinical_master_publisher_full_type_hotfix.sql
-- Then run this file with the compact fixture payload supplied as a psql variable:
--   psql -v payload_json="$(jq -c . tests/fixtures/clinical-master-publisher-full-type-hotfix.fixture.json)" --file supabase/snippets/clinical_master_publisher_full_type_hotfix_replay.sql
-- It never applies a remote migration and the transaction is rolled back, so no
-- synthetic release or master rows survive.
\if :{?payload_json}
\else
\echo 'payload_json is required; pass -v payload_json="$(jq -c . tests/fixtures/clinical-master-publisher-full-type-hotfix.fixture.json)"'
\quit 3
\endif

begin;

-- Directly reapply the additive migration inside this rollback-only transaction
-- so the named constraint replacement and publisher replacement are exercised.
\ir ../migrations/20260823124500_clinical_master_publisher_full_type_hotfix.sql

create temporary table clinical_master_publisher_full_type_hotfix_replay_payload (
  payload jsonb not null
) on commit drop;
insert into clinical_master_publisher_full_type_hotfix_replay_payload(payload)
values (:'payload_json'::jsonb);

do $replay$
declare
  v_payload jsonb;
  v_changed jsonb;
  v_result jsonb;
  v_retry jsonb;
  v_changed_result jsonb;
  v_release_id uuid;
  v_changed_release_id uuid;
  v_action_id uuid;
  v_action_code_before text;
  v_action_code_after text;
  v_action_revision_before integer;
  v_action_revision_after integer;
  v_action_version_count_before integer;
  v_action_version_count_after integer;
  v_order_id uuid;
  v_order_revision_before integer;
  v_order_revision_after integer;
  v_order_version_count_before integer;
  v_order_version_count_after integer;
  v_before_releases integer;
  v_before_records integer;
  v_before_versions integer;
  v_before_review_events integer;
  v_before_order_categories integer;
  v_before_x_categories integer;
  v_before_t_categories integer;
  v_before_clinical_actions integer;
  v_before_chart_groups integer;
  v_before_task_routes integer;
  v_before_paths integer;
  v_before_species integer;
  v_before_units integer;
  v_before_specimen_types integer;
  v_before_result_input_types integer;
  v_before_lab_tests integer;
  v_before_lab_panels integer;
  v_before_orders integer;
  v_before_lab_stage_count integer;
  v_before_lab_stage_fingerprint jsonb;
  v_lab_stage_fingerprint jsonb;
  v_probe_baseline jsonb;
  v_probe_after jsonb;
  v_probe_payload jsonb;
  v_probe_key text;
  v_probe_sqlstate text;
  v_probe_constraint text;
  v_probe_succeeded boolean;
  v_probe_row record;
  v_identity_key text;
  v_identity_id uuid;
  v_identity_revision integer;
  v_identity_versions integer;
  v_existing_identity_state jsonb := '{}'::jsonb;
  v_expected_chart_mappings jsonb := '[
    {"masterKey":"phase1a2.fallback.chart.CG_CONSULTATION","groupCode":"CG_CONSULTATION","sortOrder":901},
    {"masterKey":"phase1a2.fallback.chart.CG_MEDICATION_SUPPLY","groupCode":"CG_MEDICATION_SUPPLY","sortOrder":902},
    {"masterKey":"phase1a2.fallback.chart.CG_PROCEDURE","groupCode":"CG_PROCEDURE","sortOrder":903},
    {"masterKey":"phase1a2.fallback.chart.CG_EXAM","groupCode":"CG_EXAM","sortOrder":904},
    {"masterKey":"cm.chart.treatment","groupCode":"CG_THERAPY","sortOrder":905}
  ]'::jsonb;
  v_expected_route_mappings jsonb := '[
    {"masterKey":"phase1a2.fallback.route.NT_CHART_ONLY","routeCode":"NT_CHART_ONLY","destinationModule":"chart_only","taskRequired":false,"runtimeStatus":"active"},
    {"masterKey":"phase1a2.fallback.route.NT_DISPENSING","routeCode":"NT_DISPENSING","destinationModule":"dispensing","taskRequired":true,"runtimeStatus":"active"},
    {"masterKey":"phase1a2.fallback.route.NT_IMAGING","routeCode":"NT_IMAGING","destinationModule":"imaging","taskRequired":true,"runtimeStatus":"active"},
    {"masterKey":"phase1a2.fallback.route.NT_LAB","routeCode":"NT_LAB","destinationModule":"lab","taskRequired":true,"runtimeStatus":"active"},
    {"masterKey":"phase1a2.fallback.route.NT_TREATMENT","routeCode":"NT_TREATMENT","destinationModule":"treatment","taskRequired":true,"runtimeStatus":"active"}
  ]'::jsonb;
  v_expected_species_mappings jsonb := '[
    {"masterKey":"phase1a2.fallback.species.cat","speciesCode":"cat"},
    {"masterKey":"phase1a2.fallback.species.dog","speciesCode":"dog"}
  ]'::jsonb;
  v_expected_path_mappings jsonb := '[
    {"pathKey":"cm.path.consultation","clinicalActionKey":"cm.action.consultation","chartGroupKey":"phase1a2.fallback.chart.CG_CONSULTATION","taskRouteKey":"phase1a2.fallback.route.NT_CHART_ONLY"},
    {"pathKey":"cm.path.dispensing","clinicalActionKey":"cm.action.dispensing","chartGroupKey":"phase1a2.fallback.chart.CG_MEDICATION_SUPPLY","taskRouteKey":"phase1a2.fallback.route.NT_DISPENSING"},
    {"pathKey":"cm.path.imaging","clinicalActionKey":"cm.action.imaging","chartGroupKey":"phase1a2.fallback.chart.CG_PROCEDURE","taskRouteKey":"phase1a2.fallback.route.NT_IMAGING"},
    {"pathKey":"cm.path.laboratory","clinicalActionKey":"cm.action.laboratory","chartGroupKey":"phase1a2.fallback.chart.CG_EXAM","taskRouteKey":"phase1a2.fallback.route.NT_LAB"},
    {"pathKey":"cm.path.treatment","clinicalActionKey":"cm.action.treatment","chartGroupKey":"cm.chart.treatment","taskRouteKey":"phase1a2.fallback.route.NT_TREATMENT"}
  ]'::jsonb;
  v_existing_identity_keys text[] := array[
    'phase1a2.fallback.chart.CG_CONSULTATION',
    'phase1a2.fallback.chart.CG_MEDICATION_SUPPLY',
    'phase1a2.fallback.chart.CG_PROCEDURE',
    'phase1a2.fallback.chart.CG_EXAM',
    'phase1a2.fallback.route.NT_CHART_ONLY',
    'phase1a2.fallback.route.NT_DISPENSING',
    'phase1a2.fallback.route.NT_IMAGING',
    'phase1a2.fallback.route.NT_LAB',
    'phase1a2.fallback.route.NT_TREATMENT',
    'phase1a2.fallback.species.cat',
    'phase1a2.fallback.species.dog'
  ];
  v_expected_types text[] := array[
    'order_category','clinical_action','chart_group','task_route','order',
    'species','unit','specimen_type','result_input_type','lab_test','lab_panel'
  ];
begin
  select payload into v_payload
  from clinical_master_publisher_full_type_hotfix_replay_payload;

  if jsonb_array_length(v_payload->'records') <> 83
    or (select count(distinct value->>'recordType') from jsonb_array_elements(v_payload->'records')) <> 11 then
    raise exception 'clinical_master_publisher_full_type_hotfix_all_11_types_failed';
  end if;

  raise notice 'clinical_master_publisher_full_type_hotfix_direct_migration_reapply_ok';

  select count(*) into v_before_releases from master.master_releases;
  select count(*) into v_before_records from master.master_records;
  select count(*) into v_before_versions from master.master_record_versions;
  select count(*) into v_before_review_events from master.master_review_events;
  select count(*) into v_before_order_categories from master.order_categories;
  select count(*) into v_before_x_categories from master.order_categories where category_level='X';
  select count(*) into v_before_t_categories from master.order_categories where category_level='T' and parent_category_id is not null;
  select count(*) into v_before_clinical_actions from master.clinical_actions;
  select count(*) into v_before_chart_groups from master.chart_groups;
  select count(*) into v_before_task_routes from master.task_routes;
  select count(*) into v_before_paths from master.classification_paths where retired_in_release_id is null;
  select count(*) into v_before_species from master.species;
  select count(*) into v_before_units from master.units;
  select count(*) into v_before_specimen_types from master.specimen_types;
  select count(*) into v_before_result_input_types from master.result_input_types;
  select count(*) into v_before_lab_tests from master.lab_tests;
  select count(*) into v_before_lab_panels from master.lab_panels;
  select count(*) into v_before_orders from master.orders;
  select count(*) into v_before_lab_stage_count
  from private.clinical_master_lab_publish_stage;
  select coalesce(jsonb_agg(to_jsonb(stage) order by stage.release_id,stage.master_record_id),'[]'::jsonb)
    into v_before_lab_stage_fingerprint
  from private.clinical_master_lab_publish_stage stage;

  foreach v_identity_key in array v_existing_identity_keys loop
    select record_row.id,record_row.current_revision,count(version.*)
      into v_identity_id,v_identity_revision,v_identity_versions
    from master.master_records record_row
    left join master.master_record_versions version on version.master_record_id=record_row.id
    where record_row.master_key=v_identity_key
    group by record_row.id,record_row.current_revision;
    if v_identity_id is null then
      raise exception 'clinical_master_publisher_full_type_hotfix_existing_identity_missing key=%',v_identity_key;
    end if;
    v_existing_identity_state := jsonb_set(
      v_existing_identity_state,
      array[v_identity_key],
      jsonb_build_object(
        'id',v_identity_id::text,
        'revision',v_identity_revision,
        'versions',v_identity_versions
      ),
      true
    );
  end loop;

  v_result := private.publish_clinical_master_release(v_payload, null);
  if coalesce(v_result->>'idempotent','true') <> 'false'
    or v_result->>'recordCount' <> '83' then
    raise exception 'clinical_master_publisher_full_type_hotfix_initial_publish_failed';
  end if;
  v_release_id := (v_result->>'releaseId')::uuid;

  select coalesce(jsonb_agg(to_jsonb(stage) order by stage.release_id,stage.master_record_id),'[]'::jsonb)
    into v_lab_stage_fingerprint
  from private.clinical_master_lab_publish_stage stage
  where stage.release_id <> v_release_id;
  if v_lab_stage_fingerprint is distinct from v_before_lab_stage_fingerprint then
    raise exception 'clinical_master_publisher_full_type_hotfix_preexisting_stage_fingerprint_failed phase=%','initial';
  end if;

  if (select count(*) from master.master_releases) <> v_before_releases + 1
    or (select count(*) from master.master_records) <> v_before_records + 72
    or (select count(*) from master.master_record_versions) <> v_before_versions + 83
    or (select count(*) from master.master_review_events) <> v_before_review_events + 166 then
    raise exception 'clinical_master_publisher_full_type_hotfix_lineage_counts_failed';
  end if;

  if (select count(*) from private.clinical_master_lab_publish_stage where release_id=v_release_id) <> 83
    or exists (
      select 1 from unnest(v_expected_types) expected(record_type)
      where not exists (
        select 1 from private.clinical_master_lab_publish_stage stage
        where stage.release_id=v_release_id and stage.record_type=expected.record_type
      )
    ) then
    raise exception 'clinical_master_publisher_full_type_hotfix_stage_types_failed';
  end if;

  if (select count(*) from master.order_categories) <> v_before_order_categories + 6
    or (select count(*) from master.clinical_actions) <> v_before_clinical_actions + 5
    or (select count(*) from master.chart_groups) <> v_before_chart_groups + 1
    or (select count(*) from master.task_routes) <> v_before_task_routes + 0
    or (select count(*) from master.classification_paths where retired_in_release_id is null) <> v_before_paths + 5
    or (select count(*) from master.species) <> v_before_species + 0
    or (select count(*) from master.units) <> v_before_units + 6
    or (select count(*) from master.specimen_types) <> v_before_specimen_types + 4
    or (select count(*) from master.result_input_types) <> v_before_result_input_types + 3
    or (select count(*) from master.lab_tests) <> v_before_lab_tests + 13
    or (select count(*) from master.lab_panels) <> v_before_lab_panels + 4
    or (select count(*) from master.orders) <> v_before_orders + 30 then
      raise exception 'clinical_master_publisher_full_type_hotfix_typed_rows_failed';
  end if;

  foreach v_identity_key in array v_existing_identity_keys loop
    select record_row.id,record_row.current_revision,count(version.*)
      into v_identity_id,v_identity_revision,v_identity_versions
    from master.master_records record_row
    left join master.master_record_versions version on version.master_record_id=record_row.id
    where record_row.master_key=v_identity_key
    group by record_row.id,record_row.current_revision;
    if v_identity_id::text is distinct from v_existing_identity_state->v_identity_key->>'id'
      or v_identity_revision <> (v_existing_identity_state->v_identity_key->>'revision')::integer + 1
      or v_identity_versions <> (v_existing_identity_state->v_identity_key->>'versions')::integer + 1 then
      raise exception 'clinical_master_publisher_full_type_hotfix_existing_identity_revision_failed key=%',v_identity_key;
    end if;
  end loop;

  if (
    select coalesce(jsonb_agg(jsonb_build_object(
      'masterKey',record_row.master_key,
      'groupCode',chart.group_code,
      'sortOrder',chart.sort_order
    ) order by chart.sort_order),'[]'::jsonb)
    from master.chart_groups chart
    join master.master_records record_row on record_row.id=chart.master_record_id
    where record_row.master_key in (
      'phase1a2.fallback.chart.CG_CONSULTATION',
      'phase1a2.fallback.chart.CG_MEDICATION_SUPPLY',
      'phase1a2.fallback.chart.CG_PROCEDURE',
      'phase1a2.fallback.chart.CG_EXAM',
      'cm.chart.treatment'
    )
  ) is distinct from v_expected_chart_mappings then
    raise exception 'clinical_master_publisher_full_type_hotfix_chart_mapping_failed';
  end if;

  if (
    select coalesce(jsonb_agg(jsonb_build_object(
      'masterKey',record_row.master_key,
      'routeCode',route.route_code,
      'destinationModule',route.destination_module,
      'taskRequired',route.task_required,
      'runtimeStatus',route.runtime_status
    ) order by route.route_code),'[]'::jsonb)
    from master.task_routes route
    join master.master_records record_row on record_row.id=route.master_record_id
    where record_row.master_key = any(array[
      'phase1a2.fallback.route.NT_CHART_ONLY',
      'phase1a2.fallback.route.NT_DISPENSING',
      'phase1a2.fallback.route.NT_IMAGING',
      'phase1a2.fallback.route.NT_LAB',
      'phase1a2.fallback.route.NT_TREATMENT'
    ])
  ) is distinct from v_expected_route_mappings then
    raise exception 'clinical_master_publisher_full_type_hotfix_route_mapping_failed';
  end if;

  if (
    select coalesce(jsonb_agg(jsonb_build_object(
      'masterKey',record_row.master_key,
      'speciesCode',species.species_code
    ) order by species.species_code),'[]'::jsonb)
    from master.species species
    join master.master_records record_row on record_row.id=species.master_record_id
    where record_row.master_key = any(array[
      'phase1a2.fallback.species.cat',
      'phase1a2.fallback.species.dog'
    ])
  ) is distinct from v_expected_species_mappings then
    raise exception 'clinical_master_publisher_full_type_hotfix_species_mapping_failed';
  end if;

  if (
    select coalesce(jsonb_agg(jsonb_build_object(
      'pathKey',path.path_key,
      'clinicalActionKey',action_record.master_key,
      'chartGroupKey',chart_record.master_key,
      'taskRouteKey',route_record.master_key
    ) order by path.path_key),'[]'::jsonb)
    from master.classification_paths path
    join master.master_records action_record on action_record.id=path.clinical_action_id
    join master.master_records chart_record on chart_record.id=path.chart_group_id
    join master.master_records route_record on route_record.id=path.task_route_id
    where path.path_key = any(array[
      'cm.path.consultation',
      'cm.path.dispensing',
      'cm.path.imaging',
      'cm.path.laboratory',
      'cm.path.treatment'
    ])
      and path.retired_in_release_id is null
  ) is distinct from v_expected_path_mappings then
    raise exception 'clinical_master_publisher_full_type_hotfix_classification_tuple_failed';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_payload->'classificationPaths') path_input
    where not exists (
      select 1
      from master.classification_paths path_row
      join master.master_records action_record on action_record.id=path_row.clinical_action_id
      join master.master_records chart_record on chart_record.id=path_row.chart_group_id
      join master.master_records route_record on route_record.id=path_row.task_route_id
      where path_row.path_key=path_input->>'pathKey'
        and path_row.retired_in_release_id is null
        and action_record.master_key=path_input->>'clinicalActionKey'
        and chart_record.master_key=path_input->>'chartGroupKey'
        and route_record.master_key=path_input->>'taskRouteKey'
    )
  ) then
    raise exception 'clinical_master_publisher_full_type_hotfix_classification_relation_failed';
  end if;

  if (select count(*) from master.order_categories where category_level='X') <> v_before_x_categories + 1
    or (select count(*) from master.order_categories where category_level='T' and parent_category_id is not null) <> v_before_t_categories + 5
    or not exists (
      select 1
      from master.classification_paths path
      join master.master_records action_record on action_record.id=path.clinical_action_id
      where path.path_key='cm.path.laboratory'
        and path.retired_in_release_id is null
        and action_record.master_key='cm.action.laboratory'
    ) then
    raise exception 'clinical_master_publisher_full_type_hotfix_new_path_failed';
  end if;

  if (select count(*) from private.clinical_master_lab_vocabulary_publish_stage where release_id=v_release_id) <> 13
    or (select count(*) from private.clinical_master_lab_test_publish_stage where release_id=v_release_id) <> 13
    or (select count(*) from private.clinical_master_lab_panel_publish_stage where release_id=v_release_id) <> 4
    or (select count(*) from private.clinical_master_lab_order_publish_stage where release_id=v_release_id) <> 30
    or not exists (
      select 1 from private.clinical_master_lab_test_publish_stage stage
      where stage.release_id=v_release_id
        and stage.relation_content ? 'labTestVocabulary'
        and stage.result_input_type_master_record_id is not null
    )
    or not exists (
      select 1 from private.clinical_master_lab_panel_publish_stage stage
      where stage.release_id=v_release_id
        and jsonb_array_length(stage.relation_content->'labPanelItems') > 0
    )
    or not exists (
      select 1 from private.clinical_master_lab_order_publish_stage stage
      where stage.release_id=v_release_id
        and jsonb_array_length(stage.relation_content->'labOrderProfiles') = 1
    ) then
    raise exception 'clinical_master_publisher_full_type_hotfix_specialized_stage_failed';
  end if;

  if exists (
    select 1
    from master.clinical_actions action
    join master.master_records record_row on record_row.id=action.master_record_id
    where record_row.master_key in (
      select value->>'masterKey'
      from jsonb_array_elements(v_payload->'records') records(value)
      where value->>'recordType'='clinical_action'
    )
      and (
        action.action_code is null
        or not exists (
          select 1
          from master.master_record_versions version
          where version.master_record_id=record_row.id
            and version.release_id=v_release_id
            and version.snapshot->'detail'->>'actionCode'=action.action_code
        )
      )
  ) then
    raise exception 'clinical_master_publisher_full_type_hotfix_action_code_snapshot_failed';
  end if;
  if exists (
    select 1
    from private.clinical_master_lab_publish_stage stage
    where stage.release_id=v_release_id
      and stage.record_type='clinical_action'
      and stage.base_content->'detail'->>'actionCode' is null
  ) then
    raise exception 'clinical_master_publisher_full_type_hotfix_stage_action_code_missing';
  end if;

  select action.master_record_id,action.action_code,record_row.current_revision,count(version.*)
    into v_action_id,v_action_code_before,v_action_revision_before,v_action_version_count_before
  from master.clinical_actions action
  join master.master_records record_row on record_row.id=action.master_record_id
  left join master.master_record_versions version on version.master_record_id=record_row.id
  where record_row.master_key='cm.action.consultation'
  group by action.master_record_id,action.action_code,record_row.current_revision;

  select record_row.id,record_row.current_revision,count(version.*)
    into v_order_id,v_order_revision_before,v_order_version_count_before
  from master.master_records record_row
  left join master.master_record_versions version on version.master_record_id=record_row.id
  where record_row.master_key='cm.order.consult.initial'
  group by record_row.id,record_row.current_revision;

  v_retry := private.publish_clinical_master_release(v_payload, null);
  if (v_retry->>'releaseId')::uuid <> v_release_id
    or v_retry->>'idempotent' <> 'true'
    or (select count(*) from master.master_releases) <> v_before_releases + 1 then
    raise exception 'clinical_master_publisher_full_type_hotfix_same_payload_not_idempotent';
  end if;
  select coalesce(jsonb_agg(to_jsonb(stage) order by stage.release_id,stage.master_record_id),'[]'::jsonb)
    into v_lab_stage_fingerprint
  from private.clinical_master_lab_publish_stage stage
  where stage.release_id <> v_release_id;
  if v_lab_stage_fingerprint is distinct from v_before_lab_stage_fingerprint then
    raise exception 'clinical_master_publisher_full_type_hotfix_preexisting_stage_fingerprint_failed phase=%','retry';
  end if;

  select jsonb_set(
    v_payload,
    '{releaseKey}',
    to_jsonb('cm.release.airtable.operational-pilot.v2'::text)
  ) into v_changed;
  select jsonb_set(
    v_changed,
    '{records}',
    (
      select jsonb_agg(
        case
          when value->>'masterKey'='cm.order.consult.initial' then
            jsonb_set(value,'{names,0,name}',to_jsonb('Initial Consultation Changed'::text))
          else value
        end
        order by ordinal
      )
      from jsonb_array_elements(v_changed->'records') with ordinality records(value,ordinal)
    )
  ) into v_changed;

  v_changed_result := private.publish_clinical_master_release(v_changed, null);
  if coalesce(v_changed_result->>'idempotent','true') <> 'false'
    or (v_changed_result->>'releaseId')::uuid = v_release_id
    or v_changed_result->>'recordCount' <> '83' then
    raise exception 'clinical_master_publisher_full_type_hotfix_changed_publish_failed';
  end if;
  v_changed_release_id := (v_changed_result->>'releaseId')::uuid;

  select coalesce(jsonb_agg(to_jsonb(stage) order by stage.release_id,stage.master_record_id),'[]'::jsonb)
    into v_lab_stage_fingerprint
  from private.clinical_master_lab_publish_stage stage
  where stage.release_id <> v_release_id
    and stage.release_id <> v_changed_release_id;
  if v_lab_stage_fingerprint is distinct from v_before_lab_stage_fingerprint then
    raise exception 'clinical_master_publisher_full_type_hotfix_preexisting_stage_fingerprint_failed phase=%','v2';
  end if;

  select action.action_code,record_row.current_revision,count(version.*)
    into v_action_code_after,v_action_revision_after,v_action_version_count_after
  from master.clinical_actions action
  join master.master_records record_row on record_row.id=action.master_record_id
  left join master.master_record_versions version on version.master_record_id=record_row.id
  where record_row.master_key='cm.action.consultation'
  group by action.action_code,record_row.current_revision;
  if v_action_revision_after <> v_action_revision_before
    or v_action_version_count_after <> v_action_version_count_before
    or v_action_code_after is distinct from v_action_code_before then
    raise exception 'clinical_master_publisher_full_type_hotfix_unchanged_action_false_bumped';
  end if;

  select record_row.current_revision,count(version.*)
    into v_order_revision_after,v_order_version_count_after
  from master.master_records record_row
  left join master.master_record_versions version on version.master_record_id=record_row.id
  where record_row.master_key='cm.order.consult.initial'
  group by record_row.current_revision;
  if v_order_revision_after <> v_order_revision_before + 1
    or v_order_version_count_after <> v_order_version_count_before + 1 then
    raise exception 'clinical_master_publisher_full_type_hotfix_changed_order_revision_failed';
  end if;

  if (select count(*) from master.master_releases) <> v_before_releases + 2
    or (select count(*) from master.master_record_versions) <> v_before_versions + 84
    or (select count(*) from master.master_record_versions where release_id=v_changed_release_id) <> 1
    or not exists (
      select 1 from master.master_record_versions version
      join master.master_records record_row on record_row.id=version.master_record_id
      where version.release_id=v_changed_release_id
        and record_row.master_key='cm.order.consult.initial'
        and version.snapshot->'detail'->>'actionCode' is null
    ) then
    raise exception 'clinical_master_publisher_full_type_hotfix_changed_lineage_failed';
  end if;

  -- Natural-code collision probes must fail at the database unique boundary,
  -- not silently create a second master identity.  The baseline fingerprint
  -- covers every durable publisher table that a probe could reach; each
  -- attempt runs in a PL/pgSQL subtransaction so the main replay continues.
  select jsonb_build_object(
    'releases',coalesce((select jsonb_agg(to_jsonb(item) order by item.id) from master.master_releases item),'[]'::jsonb),
    'records',coalesce((select jsonb_agg(to_jsonb(item) order by item.id) from master.master_records item),'[]'::jsonb),
    'versions',coalesce((select jsonb_agg(to_jsonb(item) order by item.id) from master.master_record_versions item),'[]'::jsonb),
    'reviewEvents',coalesce((select jsonb_agg(to_jsonb(item) order by item.id) from master.master_review_events item),'[]'::jsonb),
    'chartGroups',coalesce((select jsonb_agg(to_jsonb(item) order by item.master_record_id) from master.chart_groups item),'[]'::jsonb),
    'taskRoutes',coalesce((select jsonb_agg(to_jsonb(item) order by item.master_record_id) from master.task_routes item),'[]'::jsonb),
    'species',coalesce((select jsonb_agg(to_jsonb(item) order by item.master_record_id) from master.species item),'[]'::jsonb),
    'classificationPaths',coalesce((select jsonb_agg(to_jsonb(item) order by item.id) from master.classification_paths item),'[]'::jsonb),
    'labPublishStage',coalesce((select jsonb_agg(to_jsonb(item) order by item.release_id,item.master_record_id) from private.clinical_master_lab_publish_stage item),'[]'::jsonb)
  ) into v_probe_baseline;

  for v_probe_row in
    select * from (values
      ('phase1a2.fallback.chart.CG_CONSULTATION','cm.probe.chart.CG_CONSULTATION','chart_groups_group_code_key'),
      ('phase1a2.fallback.route.NT_CHART_ONLY','cm.probe.route.NT_CHART_ONLY','task_routes_route_code_key'),
      ('phase1a2.fallback.species.cat','cm.probe.species.cat','species_species_code_key')
    ) probes(existing_key,probe_key,constraint_name)
  loop
    select jsonb_set(
      jsonb_set(v_payload,'{releaseKey}',to_jsonb('cm.release.probe.' || v_probe_row.probe_key)),
      '{records}',
      (
        select jsonb_agg(
          case
            when value->>'masterKey'=v_probe_row.existing_key
              then jsonb_set(value,'{masterKey}',to_jsonb(v_probe_row.probe_key))
            else value
          end
          order by ordinal
        )
        from jsonb_array_elements(v_payload->'records') with ordinality records(value,ordinal)
      )
    ) into v_probe_payload;
    v_probe_succeeded := false;
    begin
      begin
        perform private.publish_clinical_master_release(v_probe_payload,null);
      exception when unique_violation then
        get stacked diagnostics v_probe_sqlstate = returned_sqlstate, v_probe_constraint = constraint_name;
        if v_probe_sqlstate <> '23505' or v_probe_constraint <> v_probe_row.constraint_name then
          raise exception 'clinical_master_publisher_full_type_hotfix_natural_collision_boundary_failed key=% sqlstate=% constraint=%',v_probe_row.probe_key,v_probe_sqlstate,v_probe_constraint;
        end if;
        v_probe_succeeded := true;
      end;
      if not v_probe_succeeded then
        raise exception 'clinical_master_publisher_full_type_hotfix_natural_collision_not_rejected key=%',v_probe_row.probe_key;
      end if;
    end;
    select jsonb_build_object(
      'releases',coalesce((select jsonb_agg(to_jsonb(item) order by item.id) from master.master_releases item),'[]'::jsonb),
      'records',coalesce((select jsonb_agg(to_jsonb(item) order by item.id) from master.master_records item),'[]'::jsonb),
      'versions',coalesce((select jsonb_agg(to_jsonb(item) order by item.id) from master.master_record_versions item),'[]'::jsonb),
      'reviewEvents',coalesce((select jsonb_agg(to_jsonb(item) order by item.id) from master.master_review_events item),'[]'::jsonb),
      'chartGroups',coalesce((select jsonb_agg(to_jsonb(item) order by item.master_record_id) from master.chart_groups item),'[]'::jsonb),
      'taskRoutes',coalesce((select jsonb_agg(to_jsonb(item) order by item.master_record_id) from master.task_routes item),'[]'::jsonb),
      'species',coalesce((select jsonb_agg(to_jsonb(item) order by item.master_record_id) from master.species item),'[]'::jsonb),
      'classificationPaths',coalesce((select jsonb_agg(to_jsonb(item) order by item.id) from master.classification_paths item),'[]'::jsonb),
      'labPublishStage',coalesce((select jsonb_agg(to_jsonb(item) order by item.release_id,item.master_record_id) from private.clinical_master_lab_publish_stage item),'[]'::jsonb)
    ) into v_probe_after;
    if v_probe_after is distinct from v_probe_baseline
      or exists (select 1 from master.master_records where master_key=v_probe_row.probe_key) then
      raise exception 'clinical_master_publisher_full_type_hotfix_natural_collision_residue key=%',v_probe_row.probe_key;
    end if;
  end loop;
  raise notice 'clinical_master_publisher_full_type_hotfix_natural_collision_probes_ok sqlstate=23505 constraints=chart_groups_group_code_key,task_routes_route_code_key,species_species_code_key';

  if has_function_privilege('anon','private.publish_clinical_master_release(jsonb,uuid)','execute')
    or has_function_privilege('authenticated','private.publish_clinical_master_release(jsonb,uuid)','execute')
    or has_function_privilege('service_role','private.publish_clinical_master_release(jsonb,uuid)','execute') then
    raise exception 'clinical_master_publisher_full_type_hotfix_execute_leaked';
  end if;

  raise notice 'clinical_master_publisher_full_type_hotfix_replay_ok release_id=% changed_release_id=%',v_release_id,v_changed_release_id;
end;
$replay$;

rollback;
