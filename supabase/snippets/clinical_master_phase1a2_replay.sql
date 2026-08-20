-- Local-only Phase 1A-2 replay.
-- Run with:
--   psql --dbname "$LOCAL_DATABASE_URL" --set ON_ERROR_STOP=1 --file supabase/snippets/clinical_master_phase1a2_replay.sql
--
-- The complete synthetic adoption/review run is one transaction and rolls
-- back at the end. No fixture rows survive this script.
--
-- Publisher/adoption two-session proof (run in two psql sessions while this
-- migration is installed): session A calls private.publish_clinical_master_release
-- while holding the exact A1 publication key; session B calls
-- private.clair_adopt_master_release_to_workspace and must wait for A's commit.
-- The focused local gate records this separately from same-adoption contention.

begin;

create temp table clinical_master_phase1a2_replay_state (
  state_key text primary key,
  state_value jsonb not null
) on commit drop;

do $replay$
declare
  v_source jsonb := jsonb_build_object(
    'sourceType', 'synthetic',
    'title', 'Phase 1A-2 local adoption replay',
    'sourceVersion', 'a2-replay-v2'
  );
  v_payload jsonb;
  v_records jsonb;
  v_paths jsonb := jsonb_build_array(jsonb_build_object(
    'pathKey', 'phase1a2.fallback.path.consultation',
    'clinicalActionKey', 'phase1a2.fallback.action.consultation',
    'chartGroupKey', 'phase1a2.fallback.chart.CG_CONSULTATION',
    'taskRouteKey', 'phase1a2.fallback.route.NT_CHART_ONLY'
  ));
  v_result jsonb;
  v_retry jsonb;
  v_release_1 uuid;
  v_release_2 uuid;
  v_release_3 uuid;
  v_release_4 uuid;
  v_replacement_record_id uuid;
  v_consultation_path_id uuid;
  v_a_item text := 'master-a2-replay-a-a2.replay.order.changed';
  v_b_item text := 'master-a2-replay-b-a2.replay.order.changed';
  v_stable_item text := 'master-a2-replay-b-a2.replay.order.stable';
  v_new_item text := 'master-a2-replay-a-a2.replay.order.new';
  v_new3_item text := 'master-a2-replay-a-a2.replay.order.new3';
  v_d_stable_item text := 'master-a2-replay-d-a2.replay.order.stable';
  v_b_local_item text := 'a2-replay-b-local-custom';
  v_b_replacement_update uuid;
  v_b_new3_update uuid;
  v_a_new_update uuid;
  v_before_revision integer;
  v_after_revision integer;
  v_b_snapshot_before jsonb;
  v_created_item jsonb;
  v_admin uuid := '00000000-0000-4000-8000-000000000001';
  v_denied boolean;
begin
  perform private.clinical_master_seed_fallback_paths();
  select id into v_consultation_path_id
  from master.classification_paths
  where path_key = 'phase1a2.fallback.path.consultation';

  insert into public.workspaces (id, display_name, status, created_by_user_id)
  values
    ('a2-replay-a', 'Phase 1A-2 Replay A', 'active', v_admin),
    ('a2-replay-b', 'Phase 1A-2 Replay B', 'active', v_admin),
    ('a2-replay-c', 'Phase 1A-2 Catch-up C', 'active', v_admin),
    ('a2-replay-d', 'Phase 1A-2 Fresh Lifecycle D', 'active', v_admin);
  insert into public.user_memberships (id, workspace_id, user_id, roles, status, activated_at)
  values
    ('a2a00000-0000-4000-8000-000000000001', 'a2-replay-a', v_admin, array['hospital_admin'], 'active', now()),
    ('a2b00000-0000-4000-8000-000000000001', 'a2-replay-b', v_admin, array['hospital_admin'], 'active', now()),
    ('a2c00000-0000-4000-8000-000000000001', 'a2-replay-c', v_admin, array['hospital_admin'], 'active', now()),
    ('a2d00000-0000-4000-8000-000000000001', 'a2-replay-d', v_admin, array['hospital_admin'], 'active', now());

  v_records := jsonb_build_array(
    jsonb_build_object(
      'masterKey', 'a2.replay.order.changed', 'recordType', 'order',
      'names', jsonb_build_array(
        jsonb_build_object('languageCode', 'ko', 'nameKind', 'preferred', 'name', 'A2 기본 상담'),
        jsonb_build_object('languageCode', 'en', 'nameKind', 'preferred', 'name', 'A2 Base Consultation'),
        jsonb_build_object('languageCode', 'ko', 'nameKind', 'alias', 'name', 'A2 상담')
      ),
      'source', v_source,
      'detail', jsonb_build_object(
        'classificationPathKey', 'phase1a2.fallback.path.consultation',
        'defaultSalesUnitCode', 'EA', 'defaultBillingReflectionEnabled', true,
        'defaultQuantity', 1, 'species', jsonb_build_array('dog', 'cat')
      )
    ),
    jsonb_build_object(
      'masterKey', 'a2.replay.order.stable', 'recordType', 'order',
      'names', jsonb_build_array(
        jsonb_build_object('languageCode', 'ko', 'nameKind', 'preferred', 'name', 'A2 안정 상담'),
        jsonb_build_object('languageCode', 'en', 'nameKind', 'preferred', 'name', 'A2 Stable Consultation')
      ),
      'source', v_source,
      'detail', jsonb_build_object(
        'classificationPathKey', 'phase1a2.fallback.path.consultation',
        'defaultSalesUnitCode', 'EA', 'defaultBillingReflectionEnabled', false,
        'defaultQuantity', 1, 'species', jsonb_build_array('dog')
      )
    )
  );
  v_payload := jsonb_build_object(
    'releaseKey', 'phase-1a-2-replay-release-1',
    'releaseNotes', 'Phase 1A-2 synthetic release 1.',
    'publishedByLabel', 'Phase 1A-2 replay',
    'records', v_records, 'classificationPaths', v_paths
  );
  v_result := private.publish_clinical_master_release(v_payload, null);
  v_release_1 := (v_result ->> 'releaseId')::uuid;
  if v_result ->> 'idempotent' <> 'false' then raise exception 'release 1 unexpectedly idempotent'; end if;

  v_result := private.clair_adopt_master_release_to_workspace('a2-replay-a', v_release_1);
  if coalesce((v_result ->> 'createdCount')::integer, 0) <> 2 then raise exception 'workspace A release 1 create failed:%', v_result; end if;
  v_result := private.clair_adopt_master_release_to_workspace('a2-replay-b', v_release_1);
  if coalesce((v_result ->> 'createdCount')::integer, 0) <> 2 then raise exception 'workspace B release 1 create failed:%', v_result; end if;
  v_retry := private.clair_adopt_master_release_to_workspace('a2-replay-a', v_release_1);
  if coalesce((v_retry ->> 'createdCount')::integer, 0) <> 0
    or coalesce((v_retry ->> 'reviewCount')::integer, 0) <> 0
    or (select count(*) from public.workspace_master_updates where workspace_id = 'a2-replay-a' and release_id = v_release_1) <> 2 then
    raise exception 'release 1 retry duplicated adoption state:%', v_retry;
  end if;

  if (select availability_status from public.order_catalog_items where workspace_id = 'a2-replay-a' and id = v_a_item) <> 'pending_activation'
    or (select price_krw from public.order_catalog_items where workspace_id = 'a2-replay-a' and id = v_a_item) is not null then
    raise exception 'release 1 did not preserve pending/null activation safety';
  end if;
  select source_projection_snapshot into v_b_snapshot_before
  from public.order_catalog_items
  where workspace_id = 'a2-replay-b' and id = v_b_item;

  insert into public.order_catalog_items (
    id, workspace_id, standard_order_id, source_preset_version,
    customization_state, customized_fields, preset_merge_status,
    category_group, category_label, standard_order_name,
    in_hospital_order_name, billing_name, aliases, availability_status,
    price_krw, sales_unit, target_species, default_destination_module,
    default_task_required, billing_reflection_enabled, tax_included,
    rounding_rule, pricing_rule, medication_metadata, vaccine_metadata
  ) values (
    v_b_local_item, 'a2-replay-b', 'workspace-local-a2', 'workspace-custom-v1',
    'detached', array['*'], 'detached', 'consultation', '병원 로컬',
    '병원 로컬 오더', '병원 로컬 오더', '병원 로컬 청구명', array['로컬'],
    'active', 999, 'per_order', array['dog'], 'chart_only', false, true,
    true, 'as_is', jsonb_build_object('priceBasis','fixed_order_price','priceKrw',999,
      'salesUnit','per_order','taxIncluded',true,'roundingRule','as_is',
      'billingReflectionEnabled',true), '{}'::jsonb, '{}'::jsonb
  );

  update public.order_catalog_items
  set price_krw = 1234, availability_status = 'paused',
      in_hospital_order_name = 'B local name',
      customization_state = 'customized', customized_fields = array['price_krw', 'in_hospital_order_name'],
      catalog_revision = catalog_revision + 1, updated_at = now()
  where workspace_id = 'a2-replay-b' and id = v_b_item;

  v_records := jsonb_build_array(
    jsonb_build_object(
      'masterKey', 'a2.replay.order.changed', 'recordType', 'order',
      'names', jsonb_build_array(
        jsonb_build_object('languageCode', 'ko', 'nameKind', 'preferred', 'name', 'A2 변경 상담'),
        jsonb_build_object('languageCode', 'en', 'nameKind', 'preferred', 'name', 'A2 Changed Consultation'),
        jsonb_build_object('languageCode', 'ko', 'nameKind', 'alias', 'name', 'A2 변경')
      ),
      'source', v_source,
      'detail', jsonb_build_object(
        'classificationPathKey', 'phase1a2.fallback.path.consultation',
        'defaultSalesUnitCode', 'EA', 'defaultBillingReflectionEnabled', true,
        'defaultQuantity', 1, 'species', jsonb_build_array('dog', 'cat')
      )
    ),
    jsonb_build_object(
      'masterKey', 'a2.replay.order.new', 'recordType', 'order',
      'names', jsonb_build_array(
        jsonb_build_object('languageCode', 'ko', 'nameKind', 'preferred', 'name', 'A2 새 상담'),
        jsonb_build_object('languageCode', 'en', 'nameKind', 'preferred', 'name', 'A2 New Consultation')
      ),
      'source', v_source,
      'detail', jsonb_build_object(
        'classificationPathKey', 'phase1a2.fallback.path.consultation',
        'defaultSalesUnitCode', 'EA', 'defaultBillingReflectionEnabled', true,
        'defaultQuantity', 1, 'species', jsonb_build_array('dog', 'cat')
      )
    )
  );
  v_payload := jsonb_build_object(
    'releaseKey', 'phase-1a-2-replay-release-2',
    'releaseNotes', 'Phase 1A-2 synthetic release 2.',
    'publishedByLabel', 'Phase 1A-2 replay',
    'records', v_records, 'classificationPaths', v_paths
  );
  v_result := private.publish_clinical_master_release(v_payload, null);
  v_release_2 := (v_result ->> 'releaseId')::uuid;
  v_result := private.clair_adopt_master_release_to_workspace('a2-replay-a', v_release_2);
  if coalesce((v_result ->> 'autoAppliedCount')::integer, 0) <> 1
    or coalesce((v_result ->> 'createdCount')::integer, 0) <> 1 then
    raise exception 'workspace A release 2 transition failed:%', v_result; end if;
  if (select count(*) from public.workspace_master_updates where workspace_id = 'a2-replay-b' and release_id = v_release_2) <> 0 then
    raise exception 'workspace B should have skipped release 2';
  end if;
  if (select source_master_revision from public.order_catalog_items where workspace_id = 'a2-replay-b' and id = v_b_item) <> 1
    or (select in_hospital_order_name from public.order_catalog_items where workspace_id = 'a2-replay-b' and id = v_b_item) <> 'B local name'
    or (select price_krw from public.order_catalog_items where workspace_id = 'a2-replay-b' and id = v_b_item) <> 1234 then
    raise exception 'skipped release row was changed unexpectedly';
  end if;
  if (select source_master_revision from public.order_catalog_items where workspace_id = 'a2-replay-a' and id = v_a_item) <> 2
    or (select standard_order_name from public.order_catalog_items where workspace_id = 'a2-replay-a' and id = v_a_item) <> 'A2 변경 상담'
    or (select source_projection_fingerprint from public.order_catalog_items where workspace_id = 'a2-replay-a' and id = v_a_item)
      <> private.clinical_master_projection_fingerprint((select source_projection_snapshot from public.order_catalog_items where workspace_id = 'a2-replay-a' and id = v_a_item)) then
    raise exception 'unmodified source projection fingerprint did not advance with release 2';
  end if;

  v_records := jsonb_build_array(jsonb_build_object(
    'masterKey', 'a2.replay.order.new3', 'recordType', 'order',
    'names', jsonb_build_array(
      jsonb_build_object('languageCode', 'ko', 'nameKind', 'preferred', 'name', 'A2 최신 상담'),
      jsonb_build_object('languageCode', 'en', 'nameKind', 'preferred', 'name', 'A2 Latest Consultation')
    ),
    'source', v_source,
    'detail', jsonb_build_object(
      'classificationPathKey', 'phase1a2.fallback.path.consultation',
      'defaultSalesUnitCode', 'EA', 'defaultBillingReflectionEnabled', true,
      'defaultQuantity', 1, 'species', jsonb_build_array('dog')
    )
  ));
  v_payload := jsonb_build_object(
    'releaseKey', 'phase-1a-2-replay-release-3',
    'releaseNotes', 'Phase 1A-2 synthetic release 3.',
    'publishedByLabel', 'Phase 1A-2 replay',
    'records', v_records, 'classificationPaths', v_paths
  );
  v_result := private.publish_clinical_master_release(v_payload, null);
  v_release_3 := (v_result ->> 'releaseId')::uuid;
  select id into v_replacement_record_id from master.master_records where master_key = 'a2.replay.order.new3';
  update master.master_records
  set lifecycle_status = 'deprecated',
      deprecated_at = coalesce(deprecated_at, now()),
      replacement_record_id = v_replacement_record_id,
      updated_at = now()
  where master_key = 'a2.replay.order.changed';

  v_result := private.clair_adopt_master_release_to_workspace('a2-replay-a', v_release_3);
  if coalesce((v_result ->> 'createdCount')::integer, 0) <> 1
    or coalesce((v_result ->> 'reviewCount')::integer, 0) <> 2 then
    raise exception 'workspace A release 3 lifecycle transition failed:%', v_result; end if;
  v_result := private.clair_adopt_master_release_to_workspace('a2-replay-b', v_release_3);
  if coalesce((v_result ->> 'createdCount')::integer, 0) <> 2
    or coalesce((v_result ->> 'reviewCount')::integer, 0) <> 3 then
    raise exception 'workspace B release 3 skipped-release catch-up failed:%', v_result; end if;
  v_result := private.clair_adopt_master_release_to_workspace('a2-replay-c', v_release_3);
  if coalesce((v_result ->> 'createdCount')::integer, 0) <> 4
    or coalesce((v_result ->> 'reviewCount')::integer, 0) <> 4 then
    raise exception 'workspace C latest catch-up did not converge all sources:%', v_result; end if;
  if not exists (
      select 1 from public.workspace_master_updates
      where workspace_id = 'a2-replay-a' and release_id = v_release_3
        and update_type = 'replacement' and status = 'pending'
    )
    or not exists (
      select 1 from public.workspace_master_updates
      where workspace_id = 'a2-replay-b' and release_id = v_release_3
        and source_master_record_id = (
          select id from master.master_records where master_key = 'a2.replay.order.new'
        )
        and update_type = 'new' and status = 'pending'
    ) then
    raise exception 'lifecycle/replacement or skipped-release catch-up review missing';
  end if;

  if (select in_hospital_order_name from public.order_catalog_items where workspace_id = 'a2-replay-b' and id = v_b_item) <> 'B local name'
    or (select price_krw from public.order_catalog_items where workspace_id = 'a2-replay-b' and id = v_b_item) <> 1234
    or (select source_master_revision from public.order_catalog_items where workspace_id = 'a2-replay-b' and id = v_b_item) <> 1
    or (select source_projection_snapshot from public.order_catalog_items where workspace_id = 'a2-replay-b' and id = v_b_item) is distinct from v_b_snapshot_before
    or (select source_master_revision from public.order_catalog_items where workspace_id = 'a2-replay-b' and id = v_stable_item) <> 1 then
    raise exception 'customized whole-row or historical snapshot preservation failed';
  end if;
  if (select source_master_revision from public.order_catalog_items where workspace_id = 'a2-replay-a' and id = v_a_item) <> 2
    or (select source_projection_snapshot ->> 'lifecycleStatus' from public.order_catalog_items where workspace_id = 'a2-replay-a' and id = v_a_item) <> 'published' then
    raise exception 'lifecycle review overwrote A row before resolution';
  end if;
  if (select source_master_revision from public.order_catalog_items where workspace_id = 'a2-replay-c' and id = 'master-a2-replay-c-a2.replay.order.changed') <> 2
    or (select source_master_revision from public.order_catalog_items where workspace_id = 'a2-replay-c' and id = 'master-a2-replay-c-a2.replay.order.stable') <> 1 then
    raise exception 'latest catch-up source revisions missing';
  end if;
  if (select preset_merge_status from public.order_catalog_items where workspace_id = 'a2-replay-c' and id = 'master-a2-replay-c-a2.replay.order.changed') <> 'deprecated_source' then
    raise exception 'fresh replacement row did not preserve deprecated source state';
  end if;

  -- Resolve B's replacement review before the metadata-only re-adoption so the
  -- same-source pending and dismissed histories are both exercised.
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  select id into v_b_replacement_update
  from public.workspace_master_updates
  where workspace_id = 'a2-replay-b' and release_id = v_release_3 and update_type = 'replacement';
  perform public.clair_resolve_workspace_master_update(
    'a2-replay-b',
    v_b_replacement_update,
    (select catalog_revision from public.order_catalog_items where workspace_id = 'a2-replay-b' and id = v_b_item),
    'dismiss'
  );
  if (select status from public.workspace_master_updates where id = v_b_replacement_update) <> 'dismissed' then
    raise exception 'same-source dismissed review setup failed';
  end if;
  reset role;

  -- Release 4 republishes the same source snapshot under a new release key.
  -- It must not create a new review or notification for either pending or
  -- dismissed history merely because the release ID changed.
  v_payload := jsonb_build_object(
    'releaseKey', 'phase-1a-2-replay-release-4-metadata-only',
    'releaseNotes', 'Phase 1A-2 synthetic metadata-only release.',
    'publishedByLabel', 'Phase 1A-2 replay',
    'records', v_records, 'classificationPaths', v_paths
  );
  v_result := private.publish_clinical_master_release(v_payload, null);
  v_release_4 := (v_result ->> 'releaseId')::uuid;
  v_result := private.clair_adopt_master_release_to_workspace('a2-replay-a', v_release_4);
  if coalesce((v_result ->> 'createdCount')::integer, 0) <> 0
    or coalesce((v_result ->> 'reviewCount')::integer, 0) <> 0
    or coalesce((v_result ->> 'notificationCount')::integer, 0) <> 0 then
    raise exception 'same-source pending review was duplicated by metadata-only release:%', v_result;
  end if;
  v_result := private.clair_adopt_master_release_to_workspace('a2-replay-b', v_release_4);
  if coalesce((v_result ->> 'createdCount')::integer, 0) <> 0
    or coalesce((v_result ->> 'reviewCount')::integer, 0) <> 0
    or coalesce((v_result ->> 'notificationCount')::integer, 0) <> 0 then
    raise exception 'same-source dismissed review was duplicated by metadata-only release:%', v_result;
  end if;
  if (select count(*) from public.workspace_master_updates where workspace_id = 'a2-replay-a') <> 6
    or (select count(*) from public.workspace_master_updates where workspace_id = 'a2-replay-b') <> 5 then
    raise exception 'metadata-only release created duplicate same-source reviews';
  end if;

  -- Change a source to deprecated without a replacement after release 4 is
  -- published, then adopt into a fresh workspace to prove new-row lifecycle
  -- precedence independently of the existing-row path.
  update master.master_records
  set lifecycle_status = 'deprecated',
      deprecated_at = coalesce(deprecated_at, now()),
      replacement_record_id = null,
      updated_at = now()
  where master_key = 'a2.replay.order.stable';
  v_result := private.clair_adopt_master_release_to_workspace('a2-replay-d', v_release_4);
  if coalesce((v_result ->> 'createdCount')::integer, 0) <> 4
    or coalesce((v_result ->> 'reviewCount')::integer, 0) <> 4 then
    raise exception 'fresh workspace lifecycle catch-up failed:%', v_result;
  end if;
  if (select preset_merge_status from public.order_catalog_items where workspace_id = 'a2-replay-d' and id = v_d_stable_item) <> 'deprecated_source'
    or not exists (
      select 1 from public.workspace_master_updates
      where workspace_id = 'a2-replay-d' and release_id = v_release_4
        and source_master_record_id = (select id from master.master_records where master_key = 'a2.replay.order.stable')
        and update_type = 'deprecated' and status = 'pending'
    ) then
    raise exception 'fresh deprecated-without-replacement state was not preserved';
  end if;
  if not exists (
      select 1 from public.workspace_master_updates
      where workspace_id = 'a2-replay-d' and release_id = v_release_4
        and source_master_record_id = (select id from master.master_records where master_key = 'a2.replay.order.changed')
        and update_type = 'replacement' and status = 'pending'
    ) then
    raise exception 'fresh replacement review type was not prioritized';
  end if;

  if (select count(*) from public.notification_events where workspace_id = 'a2-replay-a' and event_scope_id = '') <> 5
    or (select count(*) from public.notification_events where workspace_id = 'a2-replay-b' and event_scope_id = '') <> 5
    or (select count(*) from public.notification_events where workspace_id = 'a2-replay-c' and event_scope_id = '') <> 4
    or (select count(*) from public.notification_events where workspace_id = 'a2-replay-d' and event_scope_id = '') <> 4
    or exists (
      select 1 from public.notification_events
      where workspace_id in ('a2-replay-a', 'a2-replay-b', 'a2-replay-c', 'a2-replay-d')
        and (source_payload ?| array['source_snapshot', 'workspace_snapshot', 'price_krw', 'internal_instruction']
          or recipient_payload ?| array['source_snapshot', 'workspace_snapshot', 'price_krw', 'internal_instruction'])
    ) then
    raise exception 'notification scope, dedupe, or private payload contract failed';
  end if;

  -- Exercise authenticated CAS, activation, trusted-create, and review paths.
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  select id into v_a_new_update from public.workspace_master_updates
  where workspace_id = 'a2-replay-a' and release_id = v_release_2 and update_type = 'new';
  if v_a_new_update is null then
    raise exception 'release-2 new review missing for activation proof';
  end if;
  v_denied := false;
  begin
    insert into public.order_catalog_items (
      id, workspace_id, standard_order_id, source_preset_version, category_group,
      category_label, standard_order_name, in_hospital_order_name, billing_name,
      default_destination_module
    ) values (
      'a2-replay-direct-insert', 'a2-replay-a', 'direct', 'direct', 'misc',
      'direct', 'direct', 'direct', 'direct', 'chart_only'
    );
  exception when insufficient_privilege then
    v_denied := true;
  end;
  if not v_denied then raise exception 'direct catalog DML was not denied'; end if;

  v_result := public.clair_create_order_catalog_item('a2-replay-a', jsonb_build_object(
    'id', 'a2-replay-create-attack',
    'classificationPathId', v_consultation_path_id,
    'categoryGroup', 'lab',
    'categoryLabel', 'ATTACK-CATEGORY',
    'tCode', 'ATTACK-T',
    'tCodeLabel', 'ATTACK-T-LABEL',
    'defaultDestinationModule', 'lab',
    'defaultTaskRequired', true,
    'priceKrw', 100,
    'salesUnit', 'per_each',
    'billingReflectionEnabled', true,
    'taxIncluded', true,
    'roundingRule', 'as_is',
    'standardOrderName', 'A2 create attack',
    'inHospitalOrderName', 'A2 create attack',
    'billingName', 'A2 create attack',
    'pricingRule', jsonb_build_object('priceKrw', 999999, 'evil', true)
  ));
  v_created_item := v_result -> 'item';
  if v_created_item ->> 'category_group' <> 'consultation'
    or v_created_item ->> 'category_label' <> 'CG_CONSULTATION'
    or v_created_item ->> 't_code' <> 'T_PHASE1A2'
    or v_created_item ->> 't_code_label' <> '기타 임상 주문'
    or v_created_item ->> 'default_destination_module' <> 'chart_only'
    or (v_created_item ->> 'default_task_required')::boolean
    or (v_created_item -> 'pricing_rule') ? 'evil'
    or (v_created_item -> 'pricing_rule' ->> 'priceKrw') <> '100' then
    raise exception 'trusted classification or pricing normalization failed:%', v_created_item;
  end if;

  select catalog_revision into v_before_revision
  from public.order_catalog_items where workspace_id = 'a2-replay-a' and id = v_new_item;
  begin
    perform public.clair_update_order_catalog_item('a2-replay-a', v_new_item, v_before_revision, jsonb_build_object('originType', 'clair_master'));
    raise exception 'protected catalog field was accepted';
  exception when others then
    if sqlerrm not like 'catalog_protected_field_rejected:%' then raise; end if;
  end;
  perform public.clair_update_order_catalog_item('a2-replay-a', v_new_item, v_before_revision, jsonb_build_object('priceKrw', 0, 'availabilityStatus', 'paused'));
  select catalog_revision into v_after_revision from public.order_catalog_items where workspace_id = 'a2-replay-a' and id = v_new_item;
  if v_after_revision <> v_before_revision + 1
    or (select price_krw from public.order_catalog_items where workspace_id = 'a2-replay-a' and id = v_new_item) <> 0
    or (select availability_status from public.order_catalog_items where workspace_id = 'a2-replay-a' and id = v_new_item) <> 'paused' then
    raise exception 'zero-price/pause update failed';
  end if;
  begin
    perform public.clair_update_order_catalog_item(
      'a2-replay-a', v_new_item, v_before_revision,
      jsonb_build_object('priceKrw', 100)
    );
    raise exception 'stale catalog revision was accepted';
  exception when others then
    if sqlerrm <> 'catalog_revision_conflict' then raise; end if;
  end;
  begin
    perform public.clair_update_order_catalog_item('a2-replay-a', v_new_item, v_after_revision, jsonb_build_object('availabilityStatus', 'active'));
    raise exception 'pending to paused to active bypass was accepted';
  exception when others then
    if sqlerrm <> 'pending_activation_requires_accepted_review' then raise; end if;
  end;
  perform public.clair_update_order_catalog_item('a2-replay-a', v_new_item, v_after_revision, jsonb_build_object('priceKrw', 0, 'availabilityStatus', 'pending_activation'));
  select catalog_revision into v_after_revision from public.order_catalog_items where workspace_id = 'a2-replay-a' and id = v_new_item;
  perform public.clair_resolve_workspace_master_update('a2-replay-a', v_a_new_update, v_after_revision, 'accept_source');
  if (select status from public.workspace_master_updates where id = v_a_new_update) <> 'accepted'
    or (select availability_status from public.order_catalog_items where workspace_id = 'a2-replay-a' and id = v_new_item) <> 'active'
    or (select price_krw from public.order_catalog_items where workspace_id = 'a2-replay-a' and id = v_new_item) <> 0 then
    raise exception 'accepted new review did not safely activate';
  end if;

  select id into v_b_replacement_update
  from public.workspace_master_updates
  where workspace_id = 'a2-replay-b' and release_id = v_release_3 and update_type = 'replacement';
  select id into v_b_new3_update
  from public.workspace_master_updates
  where workspace_id = 'a2-replay-b' and release_id = v_release_3 and update_type = 'new';
  if (select status from public.workspace_master_updates where id = v_b_replacement_update) <> 'dismissed' then
    perform public.clair_resolve_workspace_master_update(
      'a2-replay-b',
      v_b_replacement_update,
      (select catalog_revision from public.order_catalog_items where workspace_id = 'a2-replay-b' and id = v_b_item),
      'dismiss'
    );
  end if;
  if (select status from public.workspace_master_updates where id = v_b_replacement_update) <> 'dismissed'
    or (select source_projection_snapshot from public.order_catalog_items where workspace_id = 'a2-replay-b' and id = v_b_item) is distinct from v_b_snapshot_before
    or (select price_krw from public.order_catalog_items where workspace_id = 'a2-replay-b' and id = v_b_item) <> 1234 then
    raise exception 'dismissed lifecycle/replacement review changed historical workspace row';
  end if;
  perform public.clair_resolve_workspace_master_update(
    'a2-replay-b',
    v_b_new3_update,
    (select catalog_revision from public.order_catalog_items where workspace_id = 'a2-replay-b' and id = 'master-a2-replay-b-a2.replay.order.new3'),
    'dismiss'
  );
  if (select status from public.workspace_master_updates where id = v_b_new3_update) <> 'dismissed' then
    raise exception 'dismiss review failed';
  end if;
  reset role;

  insert into clinical_master_phase1a2_replay_state values
    ('release1', jsonb_build_object('id', v_release_1)),
    ('release2', jsonb_build_object('id', v_release_2)),
    ('release3', jsonb_build_object('id', v_release_3)),
    ('release4', jsonb_build_object('id', v_release_4)),
    ('workspace_a', jsonb_build_object('id', 'a2-replay-a')),
    ('workspace_b', jsonb_build_object('id', 'a2-replay-b')),
    ('workspace_c', jsonb_build_object('id', 'a2-replay-c')),
    ('workspace_d', jsonb_build_object('id', 'a2-replay-d'));
end;
$replay$;

delete from public.workspace_master_updates
where workspace_id in ('a2-replay-a', 'a2-replay-b', 'a2-replay-c', 'a2-replay-d');
delete from public.notification_events
where workspace_id in ('a2-replay-a', 'a2-replay-b', 'a2-replay-c', 'a2-replay-d');
delete from public.order_catalog_items
where workspace_id in ('a2-replay-a', 'a2-replay-b', 'a2-replay-c', 'a2-replay-d');
set local session_replication_role = replica;
delete from public.user_memberships
where workspace_id in ('a2-replay-a', 'a2-replay-b', 'a2-replay-c', 'a2-replay-d');
delete from public.workspaces
where id in ('a2-replay-a', 'a2-replay-b', 'a2-replay-c', 'a2-replay-d');
set local session_replication_role = origin;

do $cleanup$
begin
  if exists (select 1 from public.order_catalog_items where workspace_id in ('a2-replay-a', 'a2-replay-b', 'a2-replay-c', 'a2-replay-d'))
    or exists (select 1 from public.workspace_master_updates where workspace_id in ('a2-replay-a', 'a2-replay-b', 'a2-replay-c', 'a2-replay-d'))
    or exists (select 1 from public.notification_events where workspace_id in ('a2-replay-a', 'a2-replay-b', 'a2-replay-c', 'a2-replay-d'))
    or exists (select 1 from public.user_memberships where workspace_id in ('a2-replay-a', 'a2-replay-b', 'a2-replay-c', 'a2-replay-d'))
    or exists (select 1 from public.workspaces where id in ('a2-replay-a', 'a2-replay-b', 'a2-replay-c', 'a2-replay-d')) then
    raise exception 'clinical_master_phase1a2_replay_cleanup_failed';
  end if;
  raise notice 'clinical_master_phase1a2_replay_cleanup_ok';
end;
$cleanup$;

rollback;
