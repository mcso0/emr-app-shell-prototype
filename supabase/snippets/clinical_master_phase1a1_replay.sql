-- Local-only Phase 1A-1 PostgreSQL publisher replay.
-- Run from the repository root with:
--   psql --dbname "$LOCAL_DATABASE_URL" --set ON_ERROR_STOP=1 --file supabase/snippets/clinical_master_phase1a1_replay.sql
--
-- The payload is synthetic and non-authoritative. Everything is wrapped in one
-- transaction and rolled back at the end; no fixture rows survive this script.
-- A true two-session advisory-lock run is documented at the end. It is not
-- claimed as executed unless two local psql sessions are available.

begin;

create temp table clinical_master_phase1a1_replay_state (
  state_key text primary key,
  state_value jsonb not null
) on commit drop;

do $replay$
declare
  v_source jsonb := jsonb_build_object(
    'sourceType', 'synthetic',
    'title', 'Phase 1A-1 local synthetic replay',
    'sourceVersion', 'replay-v1'
  );
  v_records jsonb := '[]'::jsonb;
  v_paths jsonb;
  v_names jsonb;
  v_codes text[] := array[
    'CG_CONSULTATION', 'CG_PREVENTION', 'CG_EXAM', 'CG_PROCEDURE',
    'CG_SURGERY', 'CG_INPATIENT', 'CG_THERAPY', 'CG_MEDICATION_SUPPLY'
  ];
  v_route_codes text[] := array[
    'NT_LAB', 'NT_IMAGING', 'NT_DISPENSING', 'NT_TREATMENT',
    'NT_INPATIENT', 'NT_BILLING_ONLY', 'NT_CHART_ONLY'
  ];
  v_destinations text[] := array[
    'lab', 'imaging', 'dispensing', 'treatment',
    'inpatient', 'billing_only', 'chart_only'
  ];
  v_task_required boolean[] := array[true, true, true, true, true, false, false];
  v_runtime_status text[] := array['active', 'active', 'active', 'active', 'held', 'active', 'active'];
  v_result jsonb;
  v_payload jsonb;
  v_reordered jsonb;
  v_reordered_records jsonb;
  v_nfc jsonb;
  v_nfd jsonb;
  v_defaults_equivalent jsonb;
  v_metadata jsonb;
  v_changed jsonb;
  v_path_change jsonb;
  v_records_changed jsonb;
  v_retry jsonb;
  v_release_id uuid;
  v_metadata_release_id uuid;
  v_changed_release_id uuid;
  v_path_release_id uuid;
  v_initial_fingerprint text;
  v_fingerprint_nfc text;
  v_fingerprint_nfd text;
  v_revision integer;
  v_count integer;
  i integer;
begin
  v_names := jsonb_build_array(
    jsonb_build_object('languageCode', 'ko', 'nameKind', 'preferred', 'name', '진료'),
    jsonb_build_object('languageCode', 'en', 'nameKind', 'preferred', 'name', 'Clinical Care')
  );
  v_records := v_records || jsonb_build_array(jsonb_build_object(
    'masterKey', 'fixture.category.x.clinical', 'recordType', 'order_category',
    'names', v_names, 'source', v_source,
    'detail', jsonb_build_object('categoryCode', 'X_CLINICAL', 'categoryLevel', 'X', 'sortOrder', 10)
  ));

  v_names := jsonb_build_array(
    jsonb_build_object('languageCode', 'ko', 'nameKind', 'preferred', 'name', '일반 진료'),
    jsonb_build_object('languageCode', 'en', 'nameKind', 'preferred', 'name', 'General Care')
  );
  v_records := v_records || jsonb_build_array(jsonb_build_object(
    'masterKey', 'fixture.category.t.general', 'recordType', 'order_category',
    'names', v_names, 'source', v_source,
    'detail', jsonb_build_object('categoryCode', 'T_GENERAL', 'categoryLevel', 'T', 'parentMasterKey', 'fixture.category.x.clinical', 'sortOrder', 10)
  ));

  v_names := jsonb_build_array(
    jsonb_build_object('languageCode', 'ko', 'nameKind', 'preferred', 'name', '진료 상담'),
    jsonb_build_object('languageCode', 'en', 'nameKind', 'preferred', 'name', 'Consultation')
  );
  v_records := v_records || jsonb_build_array(jsonb_build_object(
    'masterKey', 'fixture.action.consultation', 'recordType', 'clinical_action',
    'names', v_names, 'source', v_source,
    'detail', jsonb_build_object('tCategoryKey', 'fixture.category.t.general', 'itemType', 'consultation', 'isOtherUnclassified', false)
  ));

  v_names := jsonb_build_array(
    jsonb_build_object('languageCode', 'ko', 'nameKind', 'preferred', 'name', '진료 상담 기타'),
    jsonb_build_object('languageCode', 'en', 'nameKind', 'preferred', 'name', 'Other Consultation')
  );
  v_records := v_records || jsonb_build_array(jsonb_build_object(
    'masterKey', 'fixture.action.consultation.other', 'recordType', 'clinical_action',
    'names', v_names, 'source', v_source,
    'detail', jsonb_build_object('tCategoryKey', 'fixture.category.t.general', 'itemType', 'consultation', 'isOtherUnclassified', true)
  ));

  for i in 1..8 loop
    v_names := jsonb_build_array(
      jsonb_build_object('languageCode', 'ko', 'nameKind', 'preferred', 'name', v_codes[i]),
      jsonb_build_object('languageCode', 'en', 'nameKind', 'preferred', 'name', v_codes[i])
    );
    v_records := v_records || jsonb_build_array(jsonb_build_object(
      'masterKey', 'fixture.chart-group.' || lower(replace(v_codes[i], 'CG_', '')),
      'recordType', 'chart_group', 'names', v_names, 'source', v_source,
      'detail', jsonb_build_object('groupCode', v_codes[i], 'sortOrder', i * 10)
    ));
  end loop;

  for i in 1..7 loop
    v_names := jsonb_build_array(
      jsonb_build_object('languageCode', 'ko', 'nameKind', 'preferred', 'name', v_route_codes[i]),
      jsonb_build_object('languageCode', 'en', 'nameKind', 'preferred', 'name', v_route_codes[i])
    );
    v_records := v_records || jsonb_build_array(jsonb_build_object(
      'masterKey', 'fixture.task-route.' || lower(replace(v_route_codes[i], 'NT_', '')),
      'recordType', 'task_route', 'names', v_names, 'source', v_source,
      'detail', jsonb_build_object(
        'routeCode', v_route_codes[i], 'destinationModule', v_destinations[i],
        'taskRequired', v_task_required[i], 'runtimeStatus', v_runtime_status[i]
      )
    ));
  end loop;

  v_names := jsonb_build_array(
    jsonb_build_object('languageCode', 'ko', 'nameKind', 'preferred', 'name', '개'),
    jsonb_build_object('languageCode', 'en', 'nameKind', 'preferred', 'name', 'Dog')
  );
  v_records := v_records || jsonb_build_array(jsonb_build_object(
    'masterKey', 'fixture.species.dog', 'recordType', 'species', 'names', v_names, 'source', v_source,
    'detail', jsonb_build_object('speciesCode', 'dog')
  ));
  v_names := jsonb_build_array(
    jsonb_build_object('languageCode', 'ko', 'nameKind', 'preferred', 'name', '고양이'),
    jsonb_build_object('languageCode', 'en', 'nameKind', 'preferred', 'name', 'Cat')
  );
  v_records := v_records || jsonb_build_array(jsonb_build_object(
    'masterKey', 'fixture.species.cat', 'recordType', 'species', 'names', v_names, 'source', v_source,
    'detail', jsonb_build_object('speciesCode', 'cat')
  ));

  v_names := jsonb_build_array(
    jsonb_build_object('languageCode', 'ko', 'nameKind', 'preferred', 'name', '개'),
    jsonb_build_object('languageCode', 'en', 'nameKind', 'preferred', 'name', 'Each')
  );
  v_records := v_records || jsonb_build_array(jsonb_build_object(
    'masterKey', 'fixture.unit.each', 'recordType', 'unit', 'names', v_names, 'source', v_source,
    'detail', jsonb_build_object('unitCode', 'EA', 'symbol', 'ea', 'decimalScale', 0)
  ));
  v_names := jsonb_build_array(
    jsonb_build_object('languageCode', 'ko', 'nameKind', 'preferred', 'name', '혈액'),
    jsonb_build_object('languageCode', 'en', 'nameKind', 'preferred', 'name', 'Blood')
  );
  v_records := v_records || jsonb_build_array(jsonb_build_object(
    'masterKey', 'fixture.specimen.blood', 'recordType', 'specimen_type', 'names', v_names, 'source', v_source,
    'detail', jsonb_build_object('specimenCode', 'BLOOD')
  ));
  v_names := jsonb_build_array(
    jsonb_build_object('languageCode', 'ko', 'nameKind', 'preferred', 'name', '수치'),
    jsonb_build_object('languageCode', 'en', 'nameKind', 'preferred', 'name', 'Numeric')
  );
  v_records := v_records || jsonb_build_array(jsonb_build_object(
    'masterKey', 'fixture.result-input.numeric', 'recordType', 'result_input_type', 'names', v_names, 'source', v_source,
    'detail', jsonb_build_object('inputCode', 'NUMERIC', 'valueKind', 'numeric', 'supportsUnit', true)
  ));
  v_names := jsonb_build_array(
    jsonb_build_object('languageCode', 'ko', 'nameKind', 'preferred', 'name', '초진 상담'),
    jsonb_build_object('languageCode', 'en', 'nameKind', 'preferred', 'name', 'Initial Consultation')
  );
  v_records := v_records || jsonb_build_array(jsonb_build_object(
    'masterKey', 'fixture.order.consultation', 'recordType', 'order', 'names', v_names, 'source', v_source,
    'detail', jsonb_build_object(
      'classificationPathKey', 'fixture.path.consultation', 'defaultSalesUnitCode', 'EA',
      'defaultBillingReflectionEnabled', true, 'defaultQuantity', 1, 'species', jsonb_build_array('dog', 'cat')
    )
  ));

  v_paths := jsonb_build_array(
    jsonb_build_object(
      'pathKey', 'fixture.path.consultation', 'clinicalActionKey', 'fixture.action.consultation',
      'chartGroupKey', 'fixture.chart-group.exam', 'taskRouteKey', 'fixture.task-route.lab'
    ),
    jsonb_build_object(
      'pathKey', 'fixture.path.consultation.other', 'clinicalActionKey', 'fixture.action.consultation.other',
      'chartGroupKey', 'fixture.chart-group.consultation', 'taskRouteKey', 'fixture.task-route.chart_only'
    )
  );
  v_payload := jsonb_build_object(
    'releaseKey', 'phase-1a-1-replay-v1',
    'releaseNotes', 'Synthetic Phase 1A-1 replay; non-authoritative.',
    'publishedByLabel', 'Local PostgreSQL replay',
    'records', v_records,
    'classificationPaths', v_paths
  );

  v_result := private.publish_clinical_master_release(v_payload, null);
  v_release_id := (v_result->>'releaseId')::uuid;
  v_initial_fingerprint := v_result->>'sourceFingerprint';
  if coalesce(v_result->>'idempotent', 'true') <> 'false'
    or v_initial_fingerprint !~ '^[0-9a-f]{64}$'
    or v_result->>'recordCount' <> '25'
    or (select record_count from master.master_releases where id = v_release_id) <> 25 then
    raise exception 'initial publication did not produce a server fingerprint';
  end if;
  insert into clinical_master_phase1a1_replay_state values
    ('payload', v_payload), ('initial_result', v_result),
    ('initial_release_id', jsonb_build_object('id', v_release_id));
  v_retry := private.publish_clinical_master_release(v_payload, null);
  if (v_retry->>'releaseId')::uuid <> v_release_id
    or v_retry->>'releaseNo' <> v_result->>'releaseNo'
    or v_retry->>'sourceFingerprint' <> v_result->>'sourceFingerprint'
    or v_retry->>'recordCount' <> v_result->>'recordCount'
    or v_retry->>'idempotent' <> 'true' then
    raise exception 'same-payload retry did not return the same release';
  end if;

  if (select count(*) from master.master_releases) <> 1
    or (select count(*) from master.master_records) <> 25
    or (select count(*) from master.master_record_versions) <> 25
    or (select count(*) from master.master_review_events) <> 50 then
    raise exception 'initial publication row counts are not structurally complete';
  end if;
  if (select count(*) from master.chart_groups) <> 8
    or (select count(*) from master.task_routes) <> 7
    or (select count(*) from master.species where species_code in ('dog', 'cat')) <> 2 then
    raise exception 'fixed vocabulary rows are incomplete';
  end if;
  if exists (
    select 1 from master.task_routes
    where not (
      (route_code = 'NT_LAB' and destination_module = 'lab' and task_required and runtime_status = 'active')
      or (route_code = 'NT_IMAGING' and destination_module = 'imaging' and task_required and runtime_status = 'active')
      or (route_code = 'NT_DISPENSING' and destination_module = 'dispensing' and task_required and runtime_status = 'active')
      or (route_code = 'NT_TREATMENT' and destination_module = 'treatment' and task_required and runtime_status = 'active')
      or (route_code = 'NT_INPATIENT' and destination_module = 'inpatient' and task_required and runtime_status = 'held')
      or (route_code = 'NT_BILLING_ONLY' and destination_module = 'billing_only' and not task_required and runtime_status = 'active')
      or (route_code = 'NT_CHART_ONLY' and destination_module = 'chart_only' and not task_required and runtime_status = 'active')
    )
  ) then
    raise exception 'one or more NT tuples are not exact';
  end if;
  if exists (
    select 1 from master.classification_paths path
    join master.task_routes route on route.master_record_id = path.task_route_id
    where path.retired_in_release_id is null and route.route_code = 'NT_INPATIENT'
  ) then
    raise exception 'NT_INPATIENT was allowed to become active';
  end if;
  if not exists (
    select 1 from master.clinical_actions action
    join master.master_records record_row on record_row.id = action.master_record_id
    join master.classification_paths path on path.clinical_action_id = action.master_record_id
    where action.is_other_unclassified and record_row.master_key = 'fixture.action.consultation.other'
      and path.retired_in_release_id is null
  ) then
    raise exception 'Other/Unclassified A/path is missing';
  end if;
  if exists (select 1 from master.clinical_actions where action_code !~ '^A[0-9]{6}$') then
    raise exception 'A-code was not server generated in the required format';
  end if;

  -- DB-backed golden vector: record-array reorder converges to the same release.
  select jsonb_agg(value order by ordinality desc) into v_reordered_records
  from jsonb_array_elements(v_payload->'records') with ordinality as rows(value, ordinality);
  v_reordered := jsonb_set(v_payload, '{records}', v_reordered_records, true);
  v_result := private.publish_clinical_master_release(v_reordered, null);
  if (v_result->>'releaseId')::uuid <> v_release_id or v_result->>'idempotent' <> 'true' then
    raise exception 'record reorder fingerprint did not converge';
  end if;

  -- DB-backed golden vectors: name-array and species-array reorder converge too.
  select jsonb_agg(
    case when value->>'masterKey' = 'fixture.order.consultation' then
      jsonb_set(value, '{names}', (
        select jsonb_agg(name_value order by name_ordinal desc)
        from jsonb_array_elements(value->'names') with ordinality as names(name_value, name_ordinal)
      ), true)
    else value end order by ordinal
  ) into v_reordered_records
  from jsonb_array_elements(v_payload->'records') with ordinality as rows(value, ordinal);
  v_reordered := jsonb_set(v_payload, '{records}', v_reordered_records, true);
  v_result := private.publish_clinical_master_release(v_reordered, null);
  if (v_result->>'releaseId')::uuid <> v_release_id then
    raise exception 'name reorder fingerprint did not converge';
  end if;

  select jsonb_agg(
    case when value->>'masterKey' = 'fixture.order.consultation' then
      jsonb_set(value, '{detail,species}', (
        select jsonb_agg(species_value order by species_ordinal desc)
        from jsonb_array_elements(value->'detail'->'species') with ordinality as species(species_value, species_ordinal)
      ), true)
    else value end order by ordinal
  ) into v_reordered_records
  from jsonb_array_elements(v_payload->'records') with ordinality as rows(value, ordinal);
  v_reordered := jsonb_set(v_payload, '{records}', v_reordered_records, true);
  v_result := private.publish_clinical_master_release(v_reordered, null);
  if (v_result->>'releaseId')::uuid <> v_release_id then
    raise exception 'species reorder fingerprint did not converge';
  end if;

  -- Unicode normalization is intentionally codepoint-preserving in this phase.
  v_nfc := jsonb_set(v_payload, '{records,0,names,0,name}', to_jsonb('가'::text), true);
  v_nfd := jsonb_set(v_payload, '{records,0,names,0,name}', to_jsonb('가'::text), true);
  v_fingerprint_nfc := encode(extensions.digest(convert_to((private.clinical_master_canonicalize_payload(v_nfc))::text, 'UTF8'), 'sha256'), 'hex');
  v_fingerprint_nfd := encode(extensions.digest(convert_to((private.clinical_master_canonicalize_payload(v_nfd))::text, 'UTF8'), 'sha256'), 'hex');
  if v_fingerprint_nfc = v_fingerprint_nfd then
    raise exception 'Unicode codepoint distinction was unexpectedly normalized';
  end if;

  -- Omitted typed defaults must canonicalize identically to explicit defaults.
  select jsonb_agg(
    case
      when value->>'masterKey' = 'fixture.action.consultation'
        then value #- '{detail,isOtherUnclassified}'
      when value->>'masterKey' = 'fixture.unit.each'
        then value #- '{detail,decimalScale}'
      when value->>'masterKey' = 'fixture.order.consultation'
        then (value #- '{detail,defaultBillingReflectionEnabled}') #- '{detail,defaultQuantity}'
      else value
    end order by ordinal
  ) into v_records_changed
  from jsonb_array_elements(v_payload->'records') with ordinality as rows(value, ordinal);
  v_defaults_equivalent := jsonb_set(v_payload, '{records}', v_records_changed, true);
  v_result := private.publish_clinical_master_release(v_defaults_equivalent, null);
  if (v_result->>'releaseId')::uuid <> v_release_id
    or v_result->>'sourceFingerprint' <> v_initial_fingerprint
    or v_result->>'recordCount' <> '25'
    or v_result->>'idempotent' <> 'true' then
    raise exception 'omitted and explicit typed defaults did not converge';
  end if;

  -- A release-metadata-only change creates release lineage but no record history.
  v_metadata := jsonb_set(v_payload, '{releaseKey}', to_jsonb('phase-1a-1-replay-metadata-v2'::text), true);
  v_metadata := jsonb_set(v_metadata, '{releaseNotes}', to_jsonb('Metadata-only retry vector'::text), true);
  v_result := private.publish_clinical_master_release(v_metadata, null);
  v_metadata_release_id := (v_result->>'releaseId')::uuid;
  if v_result->>'idempotent' <> 'false'
    or v_result->>'recordCount' <> '25'
    or (select record_count from master.master_releases where id = v_metadata_release_id) <> 25
    or (select count(*) from master.master_releases) <> 2
    or (select count(*) from master.master_record_versions) <> 25 then
    raise exception 'metadata-only release changed record history';
  end if;
  v_retry := private.publish_clinical_master_release(v_metadata, null);
  if (v_retry->>'releaseId')::uuid <> v_metadata_release_id
    or v_retry->>'releaseNo' <> v_result->>'releaseNo'
    or v_retry->>'sourceFingerprint' <> v_result->>'sourceFingerprint'
    or v_retry->>'recordCount' <> v_result->>'recordCount'
    or v_retry->>'idempotent' <> 'true' then
    raise exception 'metadata-only retry did not return the complete persisted result contract';
  end if;
  if (select current_revision from master.master_records where master_key = 'fixture.action.consultation') <> 1 then
    raise exception 'metadata-only release advanced an unchanged record';
  end if;

  -- One real record change advances only that record's revision.
  v_changed := jsonb_set(v_metadata, '{releaseKey}', to_jsonb('phase-1a-1-replay-content-v3'::text), true);
  select jsonb_agg(
    case when value->>'masterKey' = 'fixture.order.consultation' then
      jsonb_set(value, '{detail,defaultQuantity}', to_jsonb(2::numeric), true)
    else value end order by ordinal
  ) into v_records_changed
  from jsonb_array_elements(v_changed->'records') with ordinality as rows(value, ordinal);
  v_changed := jsonb_set(v_changed, '{records}', v_records_changed, true);
  v_result := private.publish_clinical_master_release(v_changed, null);
  v_changed_release_id := (v_result->>'releaseId')::uuid;
  if (select count(*) from master.master_record_versions) <> 26
    or (select count(*) from master.master_record_versions version_row
        join master.master_records record_row on record_row.id = version_row.master_record_id
        where record_row.master_key = 'fixture.order.consultation') <> 2
    or (select current_revision from master.master_records where master_key = 'fixture.order.consultation') <> 2
    or (select current_revision from master.master_records where master_key = 'fixture.action.consultation') <> 1 then
    raise exception 'changed record did not advance exactly one revision';
  end if;
  if (select count(*) from master.master_record_versions where release_id = v_changed_release_id) <> 1 then
    raise exception 'changed release wrote an unchanged record snapshot';
  end if;
  if v_result->>'recordCount' <> '25'
    or (select record_count from master.master_releases where id = v_changed_release_id) <> 25 then
    raise exception 'changed release recordCount was not persisted';
  end if;
  v_retry := private.publish_clinical_master_release(v_changed, null);
  if (v_retry->>'releaseId')::uuid <> v_changed_release_id
    or v_retry->>'releaseNo' <> v_result->>'releaseNo'
    or v_retry->>'sourceFingerprint' <> v_result->>'sourceFingerprint'
    or v_retry->>'recordCount' <> v_result->>'recordCount'
    or v_retry->>'idempotent' <> 'true' then
    raise exception 'changed-record retry did not return the complete persisted result contract';
  end if;

  -- A new path for the same A retires the old active path and preserves history.
  v_path_change := jsonb_set(v_changed, '{releaseKey}', to_jsonb('phase-1a-1-replay-path-v4'::text), true);
  select jsonb_agg(path_value order by path_value->>'pathKey') into v_paths
  from (
    select value as path_value
    from jsonb_array_elements(v_path_change->'classificationPaths') as paths(value)
    where value->>'pathKey' <> 'fixture.path.consultation'
    union all
    select jsonb_build_object(
      'pathKey', 'fixture.path.consultation.v2', 'clinicalActionKey', 'fixture.action.consultation',
      'chartGroupKey', 'fixture.chart-group.procedure', 'taskRouteKey', 'fixture.task-route.treatment'
    )
  ) as path_rows;
  v_path_change := jsonb_set(v_path_change, '{classificationPaths}', v_paths, true);
  select jsonb_agg(
    case when value->>'masterKey' = 'fixture.order.consultation' then
      jsonb_set(value, '{detail,classificationPathKey}', to_jsonb('fixture.path.consultation.v2'::text), true)
    else value end order by ordinal
  ) into v_records_changed
  from jsonb_array_elements(v_path_change->'records') with ordinality as rows(value, ordinal);
  v_path_change := jsonb_set(v_path_change, '{records}', v_records_changed, true);
  v_result := private.publish_clinical_master_release(v_path_change, null);
  v_path_release_id := (v_result->>'releaseId')::uuid;
  if v_result->>'recordCount' <> '25'
    or (select record_count from master.master_releases where id = v_path_release_id) <> 25 then
    raise exception 'path release recordCount was not persisted';
  end if;
  if (select count(*) from master.classification_paths where clinical_action_id = (
      select action.master_record_id from master.clinical_actions action
      join master.master_records record_row on record_row.id = action.master_record_id
      where record_row.master_key = 'fixture.action.consultation'
    )) <> 2
    or (select count(*) from master.classification_paths path
        where path.clinical_action_id = (
          select action.master_record_id from master.clinical_actions action
          join master.master_records record_row on record_row.id = action.master_record_id
          where record_row.master_key = 'fixture.action.consultation'
        )
          and path.retired_in_release_id is null) <> 1
    or not exists (select 1 from master.classification_paths where path_key = 'fixture.path.consultation'
                   and retired_in_release_id = v_path_release_id)
    or not exists (select 1 from master.classification_paths where path_key = 'fixture.path.consultation.v2'
                   and retired_in_release_id is null) then
    raise exception 'classification path retirement did not preserve history';
  end if;
  v_retry := private.publish_clinical_master_release(v_path_change, null);
  if (v_retry->>'releaseId')::uuid <> v_path_release_id
    or v_retry->>'releaseNo' <> v_result->>'releaseNo'
    or v_retry->>'sourceFingerprint' <> v_result->>'sourceFingerprint'
    or v_retry->>'recordCount' <> v_result->>'recordCount'
    or v_retry->>'idempotent' <> 'true' then
    raise exception 'path release retry did not return the complete persisted result contract';
  end if;

  insert into clinical_master_phase1a1_replay_state values
    ('changed_payload', v_changed), ('path_payload', v_path_change),
    ('path_result', v_result), ('path_release_id', jsonb_build_object('id', v_path_release_id));
end;
$replay$;

do $negative_replay$
declare
  v_payload jsonb;
  v_bad jsonb;
  v_records jsonb;
  v_record_id uuid;
  v_before_releases integer;
  v_before_records integer;
  v_before_versions integer;
  v_before_paths integer;
  v_before_typed_rows integer;
  v_before_revision integer;
  v_count integer;
  v_rejected boolean;
  v_sqlstate text;
  v_sqlerrm text;
  v_price_key text;
  v_table_name text;
  v_retired_path_id uuid;
  v_retired_path_key text;
  v_retired_release_id uuid;
  v_action_code_before text;
  v_action_code_after text;
  v_action_revision_before integer;
  v_action_revision_after integer;
  v_typed_record_id uuid;
  v_typed_record_key text;
  v_typed_id_before uuid;
  v_typed_id_after uuid;
  v_table_index integer;
  v_table_names text[] := array[
    'order_categories', 'clinical_actions', 'chart_groups', 'task_routes',
    'species', 'units', 'specimen_types', 'result_input_types', 'orders'
  ];
  v_table_keys text[] := array[
    'fixture.category.x.clinical', 'fixture.action.consultation', 'fixture.chart-group.exam',
    'fixture.task-route.lab', 'fixture.species.dog', 'fixture.unit.each',
    'fixture.specimen.blood', 'fixture.result-input.numeric', 'fixture.order.consultation'
  ];
begin
  select state_value into v_payload
  from clinical_master_phase1a1_replay_state
  where state_key = 'payload';

  -- A different payload carrying the same release key is a conflicting retry.
  v_bad := jsonb_set(v_payload, '{releaseNotes}', to_jsonb('conflicting retry'::text), true);
  select count(*) into v_before_releases from master.master_releases;
  v_rejected := false;
  begin
    perform private.publish_clinical_master_release(v_bad, null);
  exception when others then
    v_rejected := true;
  end;
  if not v_rejected or (select count(*) from master.master_releases) <> v_before_releases then
    raise exception 'conflicting release-key retry was accepted';
  end if;

  -- Recursive price-key rejection is performed before canonicalization. Each
  -- vector keeps the detail container valid and differs only by key spelling.
  foreach v_price_key in array array['price', 'priceKrw', 'PRICE_KRW', 'canonicalPrice'] loop
    v_bad := jsonb_set(v_payload, '{releaseKey}', to_jsonb(('phase-1a-1-replay-bad-price-' || lower(v_price_key))::text), true);
    select jsonb_agg(
      case when value->>'masterKey' = 'fixture.order.consultation' then
        jsonb_set(value, '{detail,species}', jsonb_build_array(jsonb_build_object(v_price_key, 100)), true)
      else value end order by ordinal
    ) into v_records
    from jsonb_array_elements(v_bad->'records') with ordinality as rows(value, ordinal);
    v_bad := jsonb_set(v_bad, '{records}', v_records, true);
    select count(*) into v_before_releases from master.master_releases;
    v_rejected := false;
    v_sqlstate := null;
    v_sqlerrm := null;
    begin
      perform private.publish_clinical_master_release(v_bad, null);
    exception when others then
      v_rejected := true;
      get stacked diagnostics v_sqlstate = returned_sqlstate, v_sqlerrm = message_text;
    end;
    if not v_rejected or v_sqlstate <> '22023' or v_sqlerrm <> 'clinical_master_canonical_price_forbidden'
      or (select count(*) from master.master_releases) <> v_before_releases
      or exists (select 1 from master.master_releases where release_key = v_bad->>'releaseKey') then
      raise exception 'nested canonical price vector % was not rejected by the price validator (% / %)', v_price_key, v_sqlstate, v_sqlerrm;
    end if;
  end loop;

  -- Unknown clinical-claim fields are rejected at the raw payload boundary.
  v_bad := jsonb_set(v_payload, '{releaseKey}', to_jsonb('phase-1a-1-replay-bad-unknown'::text), true)
    || jsonb_build_object('clinicalClaim', jsonb_build_object('validated', true));
  select count(*) into v_before_releases from master.master_releases;
  v_rejected := false;
  v_sqlstate := null;
  v_sqlerrm := null;
  begin
    perform private.publish_clinical_master_release(v_bad, null);
  exception when others then
    v_rejected := true;
    get stacked diagnostics v_sqlstate = returned_sqlstate, v_sqlerrm = message_text;
  end;
  if not v_rejected or v_sqlstate <> '22023' or v_sqlerrm <> 'clinical_master_unknown_contract_field'
    or (select count(*) from master.master_releases) <> v_before_releases then
    raise exception 'unknown clinical field was accepted or misclassified (% / %)', v_sqlstate, v_sqlerrm;
  end if;

  v_bad := jsonb_set(v_payload, '{releaseKey}', to_jsonb('phase-1a-1-replay-bad-detail-field'::text), true);
  select jsonb_agg(
    case when value->>'masterKey' = 'fixture.unit.each' then
      jsonb_set(value, '{detail,unknownClinicalField}', to_jsonb(true), true)
    else value end order by ordinal
  ) into v_records
  from jsonb_array_elements(v_bad->'records') with ordinality as rows(value, ordinal);
  v_bad := jsonb_set(v_bad, '{records}', v_records, true);
  select count(*) into v_before_releases from master.master_releases;
  v_rejected := false;
  v_sqlstate := null;
  v_sqlerrm := null;
  begin
    perform private.publish_clinical_master_release(v_bad, null);
  exception when others then
    v_rejected := true;
    get stacked diagnostics v_sqlstate = returned_sqlstate, v_sqlerrm = message_text;
  end;
  if not v_rejected or v_sqlstate <> '22023' or v_sqlerrm <> 'clinical_master_unknown_detail_field'
    or (select count(*) from master.master_releases) <> v_before_releases then
    raise exception 'unknown detail field was accepted or misclassified (% / %)', v_sqlstate, v_sqlerrm;
  end if;

  -- A mismatched NT tuple is rejected by both payload validation and the DB CHECK.
  v_bad := jsonb_set(v_payload, '{releaseKey}', to_jsonb('phase-1a-1-replay-bad-route'::text), true);
  select jsonb_agg(
    case when value->>'masterKey' = 'fixture.task-route.lab' then
      jsonb_set(value, '{detail,destinationModule}', to_jsonb('imaging'::text), true)
    else value end order by ordinal
  ) into v_records
  from jsonb_array_elements(v_bad->'records') with ordinality as rows(value, ordinal);
  v_bad := jsonb_set(v_bad, '{records}', v_records, true);
  select count(*) into v_before_releases from master.master_releases;
  v_rejected := false;
  v_sqlstate := null;
  v_sqlerrm := null;
  begin
    perform private.publish_clinical_master_release(v_bad, null);
  exception when others then
    v_rejected := true;
    get stacked diagnostics v_sqlstate = returned_sqlstate, v_sqlerrm = message_text;
  end;
  if not v_rejected or v_sqlstate <> '23514'
    or (select count(*) from master.master_releases) <> v_before_releases
    or exists (select 1 from master.master_releases where release_key = v_bad->>'releaseKey') then
    raise exception 'route tuple mismatch was accepted or misclassified (% / %)', v_sqlstate, v_sqlerrm;
  end if;

  -- NT_INPATIENT may exist structurally but cannot be selected by an active path.
  v_bad := jsonb_set(v_payload, '{releaseKey}', to_jsonb('phase-1a-1-replay-bad-held-route'::text), true);
  select jsonb_agg(
    case when value->>'pathKey' = 'fixture.path.consultation' then
      jsonb_set(value, '{taskRouteKey}', to_jsonb('fixture.task-route.inpatient'::text), true)
    else value end order by ordinal
  ) into v_records
  from jsonb_array_elements(v_bad->'classificationPaths') with ordinality as rows(value, ordinal);
  v_bad := jsonb_set(v_bad, '{classificationPaths}', v_records, true);
  select count(*) into v_before_releases from master.master_releases;
  v_rejected := false;
  begin
    perform private.publish_clinical_master_release(v_bad, null);
  exception when others then
    v_rejected := true;
  end;
  if not v_rejected or (select count(*) from master.master_releases) <> v_before_releases then
    raise exception 'held NT route was accepted by an active path';
  end if;

  -- Structured typed-code conflict must roll back release, current-row, and history changes.
  v_bad := jsonb_set(v_payload, '{releaseKey}', to_jsonb('phase-1a-1-replay-bad-category-code'::text), true);
  select jsonb_agg(
    case when value->>'masterKey' = 'fixture.category.x.clinical' then
      jsonb_set(value, '{detail,categoryCode}', to_jsonb('X_CONFLICT'::text), true)
    else value end order by ordinal
  ) into v_records
  from jsonb_array_elements(v_bad->'records') with ordinality as rows(value, ordinal);
  v_bad := jsonb_set(v_bad, '{records}', v_records, true);
  select count(*) into v_before_releases from master.master_releases;
  select count(*) into v_before_records from master.master_records;
  select count(*) into v_before_versions from master.master_record_versions;
  v_rejected := false;
  begin
    perform private.publish_clinical_master_release(v_bad, null);
  exception when others then
    v_rejected := true;
  end;
  if not v_rejected
    or (select count(*) from master.master_releases) <> v_before_releases
    or (select count(*) from master.master_records) <> v_before_records
    or (select count(*) from master.master_record_versions) <> v_before_versions then
    raise exception 'typed-code conflict left release/history residue';
  end if;

  -- Direct lifecycle checks: published_at is required, and deprecated_at has
  -- the correct nullability in both lifecycle states.
  select id into v_record_id from master.master_records where master_key = 'fixture.action.consultation';
  v_rejected := false;
  v_sqlstate := null;
  begin
    update master.master_records set published_at = null where id = v_record_id;
  exception when others then
    v_rejected := true;
    get stacked diagnostics v_sqlstate = returned_sqlstate;
  end;
  if not v_rejected or v_sqlstate <> '23514' then raise exception 'published_at null lifecycle row was accepted (%);', v_sqlstate; end if;
  v_rejected := false;
  v_sqlstate := null;
  begin
    update master.master_records set deprecated_at = now() where id = v_record_id;
  exception when others then
    v_rejected := true;
    get stacked diagnostics v_sqlstate = returned_sqlstate;
  end;
  if not v_rejected or v_sqlstate <> '23514' then raise exception 'non-deprecated row retained deprecated_at (%);', v_sqlstate; end if;
  v_rejected := false;
  v_sqlstate := null;
  begin
    update master.master_records set lifecycle_status = 'deprecated', deprecated_at = null where id = v_record_id;
  exception when others then
    v_rejected := true;
    get stacked diagnostics v_sqlstate = returned_sqlstate;
  end;
  if not v_rejected or v_sqlstate <> '23514' then raise exception 'deprecated row without deprecated_at was accepted (%);', v_sqlstate; end if;

  -- The normalized-name composite uniqueness is enforced by the database.
  v_rejected := false;
  begin
    insert into master.master_record_names (
      master_record_id, language_code, name_kind, name, normalized_name
    ) values (v_record_id, 'ko', 'alias', '  진료 별칭  ', 'ignored');
    insert into master.master_record_names (
      master_record_id, language_code, name_kind, name, normalized_name
    ) values (v_record_id, 'ko', 'alias', '진료 별칭', 'ignored');
  exception when unique_violation then
    v_rejected := true;
  end;
  if not v_rejected then raise exception 'normalized-name duplicate was accepted'; end if;

  -- Immutable version/event/release/typed-code identity guards.
  v_rejected := false;
  begin
    update master.master_record_versions set snapshot = snapshot || '{"tampered":true}'::jsonb
    where id = (select id from master.master_record_versions where master_record_id = v_record_id order by revision limit 1);
  exception when others then
    v_rejected := true;
  end;
  if not v_rejected then raise exception 'record version mutation unexpectedly succeeded'; end if;
  v_rejected := false;
  begin
    delete from master.master_review_events
    where id = (select id from master.master_review_events where master_record_id = v_record_id order by created_at limit 1);
  exception when others then
    v_rejected := true;
  end;
  if not v_rejected then raise exception 'review-event DELETE unexpectedly succeeded'; end if;
  v_rejected := false;
  begin
    update master.master_releases set release_notes = 'tampered'
    where id = (select (state_value->>'id')::uuid from clinical_master_phase1a1_replay_state where state_key = 'initial_release_id');
  exception when others then
    v_rejected := true;
  end;
  if not v_rejected then raise exception 'published release mutation unexpectedly succeeded'; end if;
  v_rejected := false;
  begin
    update master.task_routes set route_code = 'NT_IMAGING'
    where route_code = 'NT_LAB';
  exception when others then
    v_rejected := true;
  end;
  if not v_rejected then raise exception 'typed route-code mutation unexpectedly succeeded'; end if;
  v_rejected := false;
  begin
    update master.task_routes set destination_module = 'imaging'
    where route_code = 'NT_LAB';
  exception when others then
    v_rejected := true;
  end;
  if not v_rejected then raise exception 'direct NT tuple mutation unexpectedly succeeded'; end if;

  -- Clinical action A-codes remain immutable after server generation.
  select action.action_code, record_row.current_revision
    into v_action_code_before, v_action_revision_before
  from master.clinical_actions action
  join master.master_records record_row on record_row.id = action.master_record_id
  where record_row.master_key = 'fixture.action.consultation';
  v_rejected := false;
  v_sqlstate := null;
  v_sqlerrm := null;
  begin
    update master.clinical_actions set action_code = 'A999999'
    where master_record_id = (select id from master.master_records where master_key = 'fixture.action.consultation');
  exception when others then
    v_rejected := true;
    get stacked diagnostics v_sqlstate = returned_sqlstate, v_sqlerrm = message_text;
  end;
  select action.action_code, record_row.current_revision
    into v_action_code_after, v_action_revision_after
  from master.clinical_actions action
  join master.master_records record_row on record_row.id = action.master_record_id
  where record_row.master_key = 'fixture.action.consultation';
  if not v_rejected or v_sqlstate <> '55000' or v_sqlerrm <> 'clinical_master_action_code_immutable'
    or v_action_code_before is distinct from v_action_code_after
    or v_action_revision_before is distinct from v_action_revision_after then
    raise exception 'A-code mutation was not rejected exactly (% / %)', v_sqlstate, v_sqlerrm;
  end if;

  -- A retired path is historical and cannot be deleted or re-keyed.
  select id, path_key, retired_in_release_id into v_retired_path_id, v_retired_path_key, v_retired_release_id
  from master.classification_paths where path_key = 'fixture.path.consultation';
  if v_retired_path_id is null or v_retired_release_id is null then
    raise exception 'retired path fixture is missing';
  end if;
  select count(*) into v_before_paths from master.classification_paths;
  v_sqlstate := null;
  v_sqlerrm := null;
  begin
    delete from master.classification_paths where id = v_retired_path_id;
  exception when others then
    get stacked diagnostics v_sqlstate = returned_sqlstate, v_sqlerrm = message_text;
  end;
  if v_sqlstate <> '55000' or v_sqlerrm <> 'clinical_master_classification_path_identity_immutable'
    or (select count(*) from master.classification_paths) <> v_before_paths
    or not exists (select 1 from master.classification_paths where id = v_retired_path_id and path_key = v_retired_path_key and retired_in_release_id = v_retired_release_id) then
    raise exception 'retired path DELETE was not rejected without residue (% / %)', v_sqlstate, v_sqlerrm;
  end if;
  v_sqlstate := null;
  v_sqlerrm := null;
  begin
    update master.classification_paths set id = extensions.gen_random_uuid() where id = v_retired_path_id;
  exception when others then
    get stacked diagnostics v_sqlstate = returned_sqlstate, v_sqlerrm = message_text;
  end;
  if v_sqlstate <> '55000' or v_sqlerrm <> 'clinical_master_classification_path_identity_immutable'
    or not exists (select 1 from master.classification_paths where id = v_retired_path_id and path_key = v_retired_path_key and retired_in_release_id = v_retired_release_id) then
    raise exception 'retired path UUID re-key was not rejected (% / %)', v_sqlstate, v_sqlerrm;
  end if;

  -- INSERT retirement ordering is enforced before any unique-index residue can occur.
  select count(*) into v_before_paths from master.classification_paths;
  v_sqlstate := null;
  v_sqlerrm := null;
  begin
    insert into master.classification_paths (
      path_key, clinical_action_id, chart_group_id, task_route_id,
      active_from_release_id, retired_in_release_id
    )
    select 'fixture.path.invalid-retirement-order', clinical_action_id, chart_group_id, task_route_id,
      active_from_release_id, active_from_release_id
    from master.classification_paths where path_key = 'fixture.path.consultation.v2';
  exception when others then
    get stacked diagnostics v_sqlstate = returned_sqlstate, v_sqlerrm = message_text;
  end;
  if v_sqlstate <> '23514' or v_sqlerrm <> 'clinical_master_path_retirement_release_order_invalid'
    or (select count(*) from master.classification_paths) <> v_before_paths
    or exists (select 1 from master.classification_paths where path_key = 'fixture.path.invalid-retirement-order') then
    raise exception 'invalid path retirement order was not rejected exactly (% / %)', v_sqlstate, v_sqlerrm;
  end if;

  -- Every typed projection rejects DELETE and master_record_id re-keying while
  -- retaining its prior ID and the owning record revision.
  for v_table_index in 1..array_length(v_table_names, 1) loop
    v_table_name := v_table_names[v_table_index];
    v_typed_record_key := v_table_keys[v_table_index];
    execute format(
      'select t.master_record_id from master.%I t join master.master_records r on r.id = t.master_record_id where r.master_key = $1',
      v_table_name
    ) into v_typed_id_before using v_typed_record_key;
    select current_revision into v_before_revision from master.master_records where master_key = v_typed_record_key;
    execute format(
      'select count(*) from master.%I t where t.master_record_id = $1', v_table_name
    ) into v_before_typed_rows using v_typed_id_before;

    v_sqlstate := null;
    v_sqlerrm := null;
    begin
      execute format('delete from master.%I where master_record_id = $1', v_table_name) using v_typed_id_before;
    exception when others then
      get stacked diagnostics v_sqlstate = returned_sqlstate, v_sqlerrm = message_text;
    end;
    execute format('select count(*) from master.%I where master_record_id = $1', v_table_name)
      into v_count using v_typed_id_before;
    execute format('select t.master_record_id from master.%I t where t.master_record_id = $1', v_table_name)
      into v_typed_id_after using v_typed_id_before;
    if v_sqlstate <> '55000' or v_sqlerrm <> 'clinical_master_typed_projection_immutable'
      or v_count <> v_before_typed_rows or v_typed_id_after is distinct from v_typed_id_before
      or (select current_revision from master.master_records where master_key = v_typed_record_key) <> v_before_revision then
      raise exception 'typed DELETE guard failed for % (% / %)', v_table_name, v_sqlstate, v_sqlerrm;
    end if;

    v_sqlstate := null;
    v_sqlerrm := null;
    begin
      execute format('update master.%I set master_record_id = extensions.gen_random_uuid() where master_record_id = $1', v_table_name)
        using v_typed_id_before;
    exception when others then
      get stacked diagnostics v_sqlstate = returned_sqlstate, v_sqlerrm = message_text;
    end;
    execute format('select t.master_record_id from master.%I t where t.master_record_id = $1', v_table_name)
      into v_typed_id_after using v_typed_id_before;
    if v_sqlstate <> '55000' or v_sqlerrm <> 'clinical_master_typed_identity_immutable'
      or v_typed_id_after is distinct from v_typed_id_before
      or (select current_revision from master.master_records where master_key = v_typed_record_key) <> v_before_revision then
      raise exception 'typed master_record_id re-key guard failed for % (% / %)', v_table_name, v_sqlstate, v_sqlerrm;
    end if;
  end loop;
end;
$negative_replay$;

set local role anon;
do $anon_boundary$
declare
  v_read_denied boolean := false;
  v_write_denied boolean := false;
  v_execute_denied boolean := false;
begin
  begin
    execute 'select count(*) from master.master_records';
  exception when insufficient_privilege then
    v_read_denied := true;
  end;
  begin
    execute 'insert into master.master_sources(source_type, title) values (''synthetic'', ''boundary probe'')';
  exception when insufficient_privilege then
    v_write_denied := true;
  end;
  begin
    execute 'select private.publish_clinical_master_release(''{}''::jsonb, null)';
  exception when insufficient_privilege then
    v_execute_denied := true;
  end;
  if not v_read_denied or not v_write_denied or not v_execute_denied then
    raise exception 'anon private-master boundary failed (read %, write %, execute %)', v_read_denied, v_write_denied, v_execute_denied;
  end if;
end;
$anon_boundary$;
reset role;

set local role authenticated;
do $authenticated_boundary$
declare
  v_read_denied boolean := false;
  v_write_denied boolean := false;
  v_execute_denied boolean := false;
begin
  begin
    execute 'select count(*) from master.master_records';
  exception when insufficient_privilege then
    v_read_denied := true;
  end;
  begin
    execute 'insert into master.master_sources(source_type, title) values (''synthetic'', ''boundary probe'')';
  exception when insufficient_privilege then
    v_write_denied := true;
  end;
  begin
    execute 'select private.publish_clinical_master_release(''{}''::jsonb, null)';
  exception when insufficient_privilege then
    v_execute_denied := true;
  end;
  if not v_read_denied or not v_write_denied or not v_execute_denied then
    raise exception 'authenticated private-master boundary failed (read %, write %, execute %)', v_read_denied, v_write_denied, v_execute_denied;
  end if;
end;
$authenticated_boundary$;
reset role;

set local role service_role;
do $service_boundary$
declare
  v_read_denied boolean := false;
  v_write_denied boolean := false;
  v_execute_denied boolean := false;
begin
  begin
    execute 'select count(*) from master.master_records';
  exception when insufficient_privilege then
    v_read_denied := true;
  end;
  begin
    execute 'insert into master.master_sources(source_type, title) values (''synthetic'', ''boundary probe'')';
  exception when insufficient_privilege then
    v_write_denied := true;
  end;
  begin
    execute 'select private.publish_clinical_master_release(''{}''::jsonb, null)';
  exception when insufficient_privilege then
    v_execute_denied := true;
  end;
  if not v_read_denied or not v_write_denied or not v_execute_denied then
    raise exception 'service_role private-master boundary failed (read %, write %, execute %)', v_read_denied, v_write_denied, v_execute_denied;
  end if;
end;
$service_boundary$;
reset role;

-- A second local psql session can prove the lock directly. Run these two
-- sessions with the same payload and distinct interactive timing:
--   Session A: begin; select private.publish_clinical_master_release(:payload::jsonb, null); -- leave open
--   Session B: select private.publish_clinical_master_release(:payload::jsonb, null);
-- Session B must wait on clinical_master_phase_1a1_publication and then return
-- the same release ID with idempotent=true after Session A commits. This local
-- two-session advisory-lock run is an instruction, not a claim that it ran here.

rollback;
select 'clinical_master_phase1a1_replay_cleanup_ok' as replay_result;
