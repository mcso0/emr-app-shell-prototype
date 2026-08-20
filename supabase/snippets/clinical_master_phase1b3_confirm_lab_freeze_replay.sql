-- Local-only Phase 1B-3 confirmation freeze-fix replay.
-- Run after `npx supabase db reset --local`.  Every fixture mutation is
-- synthetic and rolled back.  No remote database or seed file is written.

\set ON_ERROR_STOP on

begin;

do $$
declare
  v_actor uuid := '00000000-0000-4000-8000-000000000001'::uuid;
  v_workspace text := 'clair-demo';
  v_encounter uuid := '19426000-0000-4000-8000-000000000001'::uuid;
  v_individual_id uuid := 'b3f00000-0000-4000-8000-000000000001'::uuid;
  v_set_parent_id uuid := 'b3f00000-0000-4000-8000-000000000002'::uuid;
  v_legacy_id uuid := 'b3f00000-0000-4000-8000-000000000003'::uuid;
  v_permission_id uuid := 'b3f00000-0000-4000-8000-000000000004'::uuid;
  v_drift_id uuid := 'b3f00000-0000-4000-8000-000000000006'::uuid;
  v_front_desk uuid := '00000000-0000-4000-8000-000000000010'::uuid;
  v_payload jsonb;
  v_release jsonb;
  v_adoption jsonb;
  v_catalog_id text;
  v_catalog_revision integer;
  v_links jsonb;
  v_catalog_result jsonb;
  v_saved jsonb;
  v_actions jsonb;
  v_confirm jsonb;
  v_retry jsonb;
  v_result public.lab_result_entries%rowtype;
  v_row_count integer;
  v_header_count integer;
  v_before_count integer;
  v_after_count integer;
  v_drift_order_before jsonb;
  v_drift_etag text;
  v_drift_event_count integer;
  v_drift_header_count integer;
  v_result_entry_id uuid;
  v_result_snapshot_before jsonb;
  v_result_hash_before text;
  v_result_rows_before jsonb;
  v_result_rows_after jsonb;
  v_usage_before jsonb;
  v_usage_after jsonb;
  v_set_definition jsonb;
  v_set_result jsonb;
  v_set_id text;
  v_set_revision uuid;
  v_lab_revision_item uuid;
  v_non_lab_revision_item uuid;
  v_selection jsonb;
  v_preview jsonb;
  v_lab_child_id uuid;
  v_non_lab_child_id uuid;
  v_error text;
begin
  if to_regprocedure(
       'public.clair_save_chart_order_action(text,uuid,uuid,text,uuid[],text)'
     ) is null
     or to_regprocedure(
       'private.clair_create_lab_result_entry_for_confirmed_order(text,uuid,uuid,uuid)'
     ) is null
     or to_regprocedure(
       'public.clair_save_chart_order_draft(text,text,uuid,jsonb)'
     ) is null
     or to_regprocedure(
       'public.clair_create_order_set(text,jsonb,text,uuid)'
     ) is null then
    raise exception 'clinical_master_phase1b3_confirm_freeze_replay_required_rpc_missing';
  end if;

  perform set_config('request.jwt.claim.sub', v_actor::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_actor::text, 'role', 'authenticated')::text,
    true
  );

  v_payload := $fixture$
  {
    "releaseKey":"phase1b3-confirm-freeze-replay-v1",
    "releaseNotes":"Synthetic B3 confirmation freeze replay.",
    "publishedByLabel":"Phase 1B-3 confirmation freeze replay",
    "records":[
      {"masterKey":"phase1b3freeze.specimen.serum","recordType":"specimen_type","names":[{"languageCode":"ko","nameKind":"preferred","name":"혈청"},{"languageCode":"en","nameKind":"preferred","name":"Serum"}],"source":{"sourceType":"synthetic","title":"Phase 1B-3 confirmation freeze replay"},"detail":{"specimenCode":"serum"}},
      {"masterKey":"phase1b3freeze.input.numeric","recordType":"result_input_type","names":[{"languageCode":"ko","nameKind":"preferred","name":"숫자"},{"languageCode":"en","nameKind":"preferred","name":"Numeric"}],"source":{"sourceType":"synthetic","title":"Phase 1B-3 confirmation freeze replay"},"detail":{"inputCode":"numeric","valueKind":"numeric","supportsUnit":true}},
      {"masterKey":"phase1b3freeze.input.text","recordType":"result_input_type","names":[{"languageCode":"ko","nameKind":"preferred","name":"텍스트"},{"languageCode":"en","nameKind":"preferred","name":"Text"}],"source":{"sourceType":"synthetic","title":"Phase 1B-3 confirmation freeze replay"},"detail":{"inputCode":"text","valueKind":"text","supportsUnit":false}},
      {"masterKey":"phase1b3freeze.unit.mgdl","recordType":"unit","names":[{"languageCode":"ko","nameKind":"preferred","name":"밀리그램/데시리터"},{"languageCode":"en","nameKind":"preferred","name":"mg/dL"}],"source":{"sourceType":"synthetic","title":"Phase 1B-3 confirmation freeze replay"},"detail":{"unitCode":"mg/dL","symbol":"mg/dL","decimalScale":1}},
      {"masterKey":"phase1b3freeze.test.glucose","recordType":"lab_test","names":[{"languageCode":"ko","nameKind":"preferred","name":"혈당"},{"languageCode":"en","nameKind":"preferred","name":"Glucose"}],"source":{"sourceType":"synthetic","title":"Phase 1B-3 confirmation freeze replay"},"detail":{"testCode":"GLU_FREEZE","resultInputTypeKey":"phase1b3freeze.input.numeric","canonicalUnitKey":"phase1b3freeze.unit.mgdl","decimalScale":1}},
      {"masterKey":"phase1b3freeze.test.protein","recordType":"lab_test","names":[{"languageCode":"ko","nameKind":"preferred","name":"단백질 메모"},{"languageCode":"en","nameKind":"preferred","name":"Protein note"}],"source":{"sourceType":"synthetic","title":"Phase 1B-3 confirmation freeze replay"},"detail":{"testCode":"PROT_FREEZE","resultInputTypeKey":"phase1b3freeze.input.text","canonicalUnitKey":null,"decimalScale":null}},
      {"masterKey":"phase1b3freeze.panel.metabolic","recordType":"lab_panel","names":[{"languageCode":"ko","nameKind":"preferred","name":"기초 혈액검사"},{"languageCode":"en","nameKind":"preferred","name":"Basic Metabolic"}],"source":{"sourceType":"synthetic","title":"Phase 1B-3 confirmation freeze replay"},"detail":{"panelCode":"BMP_FREEZE"}},
      {"masterKey":"phase1b3freeze.order.metabolic","recordType":"order","names":[{"languageCode":"ko","nameKind":"preferred","name":"기초 혈액검사"},{"languageCode":"en","nameKind":"preferred","name":"Basic Metabolic Panel"}],"source":{"sourceType":"synthetic","title":"Phase 1B-3 confirmation freeze replay"},"detail":{"classificationPathKey":"phase1a2.fallback.path.lab","defaultSalesUnitCode":"EA","defaultBillingReflectionEnabled":true,"defaultQuantity":1,"species":["dog"]}}
    ],
    "classificationPaths":[],
    "labPanelItems":[
      {"panelMasterKey":"phase1b3freeze.panel.metabolic","testMasterKey":"phase1b3freeze.test.glucose","sortOrder":0,"required":true,"displayGroup":"chemistry"},
      {"panelMasterKey":"phase1b3freeze.panel.metabolic","testMasterKey":"phase1b3freeze.test.protein","sortOrder":1,"required":false,"displayGroup":"chemistry"}
    ],
    "labOrderProfiles":[
      {"orderMasterKey":"phase1b3freeze.order.metabolic","labPanelMasterKey":"phase1b3freeze.panel.metabolic","labTestMasterKey":null,"specimenMasterKey":"phase1b3freeze.specimen.serum"}
    ]
  }
  $fixture$::jsonb;

  v_release := private.publish_clinical_master_release(v_payload, v_actor);
  if v_release->>'idempotent' <> 'false' then
    raise exception 'clinical_master_phase1b3_confirm_freeze_replay_publish_not_new';
  end if;
  v_adoption := private.clair_adopt_master_release_to_workspace(
    v_workspace,
    (v_release->>'releaseId')::uuid
  );
  if coalesce((v_adoption->'labProjection'->>'createdItemCount')::integer, 0) <> 2
     or coalesce((v_adoption->'labProjection'->>'createdLinkCount')::integer, 0) <> 2 then
    raise exception 'clinical_master_phase1b3_confirm_freeze_replay_lab_projection_failed:%', v_adoption;
  end if;

  select item.id, item.catalog_revision
    into v_catalog_id, v_catalog_revision
  from public.order_catalog_items item
  join master.master_records owner
    on owner.id = item.source_master_record_id
  where item.workspace_id = v_workspace
    and owner.master_key = 'phase1b3freeze.order.metabolic';
  if v_catalog_id is null then
    raise exception 'clinical_master_phase1b3_confirm_freeze_replay_catalog_missing';
  end if;

  -- A2 owns price/source activation; B1 owns only the lab link projection.
  perform public.clair_update_order_catalog_item_a2_base(
    v_workspace,
    v_catalog_id,
    v_catalog_revision,
    jsonb_build_object('priceKrw', 35000)
  );
  select catalog_revision into v_catalog_revision
  from public.order_catalog_items
  where workspace_id = v_workspace and id = v_catalog_id;
  select jsonb_agg(jsonb_build_object(
    'labTestItemId', link.lab_test_item_id,
    'effectiveSortOrder', link.effective_sort_order,
    'required', link.required,
    'displayGroup', link.display_group,
    'expectedLinkRevision', link.link_revision,
    'expectedWorkspaceResultRevision', link.pinned_workspace_result_revision
  ) order by link.effective_sort_order, link.id)
    into v_links
  from public.order_catalog_lab_test_item_links link
  where link.workspace_id = v_workspace
    and link.order_catalog_item_id = v_catalog_id
    and link.link_origin in ('clair_master', 'workspace_custom');
  v_catalog_result := public.clair_update_order_catalog_item(
    v_workspace,
    v_catalog_id,
    v_catalog_revision,
    jsonb_build_object(
      'labDefinition',
      jsonb_build_object('availabilityStatus', 'active', 'links', v_links)
    )
  );
  if v_catalog_result->'item'->>'availability_status' <> 'active' then
    raise exception 'clinical_master_phase1b3_confirm_freeze_replay_catalog_activation_failed';
  end if;
  select catalog_revision into v_catalog_revision
  from public.order_catalog_items
  where workspace_id = v_workspace and id = v_catalog_id;

  -- A canonical draft keeps only frozen order pins.  Advancing the mutable
  -- catalog after the draft is saved must therefore be discovered by the B1
  -- helper, which rejects with catalog_projection_stale and rolls back the
  -- B3 confirmation/event atomically.
  v_saved := public.clair_get_chart_order_draft(v_workspace, v_encounter);
  perform public.clair_save_chart_order_draft(
    v_workspace,
    v_actor::text,
    v_encounter,
    jsonb_build_object(
      'expectedEtag', v_saved->>'etag',
      'rows', jsonb_build_array(jsonb_build_object(
        'rowType', 'individual',
        'orderId', v_drift_id,
        'workspaceCatalogItemId', v_catalog_id,
        'quantity', 1
      ))
    )
  );
  select to_jsonb(order_row)
    into v_drift_order_before
  from public.orders order_row
  where order_row.workspace_id = v_workspace and order_row.id = v_drift_id;
  select count(*) into v_drift_event_count
  from public.order_events
  where workspace_id = v_workspace and order_id = v_drift_id;
  select count(*) into v_drift_header_count
  from public.lab_result_entries
  where workspace_id = v_workspace and order_id = v_drift_id;
  v_actions := public.clair_get_chart_order_actions(v_workspace, v_encounter);
  v_drift_etag := v_actions->>'etag';
  v_catalog_result := public.clair_update_order_catalog_item_a2_base(
    v_workspace,
    v_catalog_id,
    v_catalog_revision,
    jsonb_build_object('priceKrw', 35001, 'availabilityStatus', 'paused')
  );
  select catalog_revision into v_catalog_revision
  from public.order_catalog_items
  where workspace_id = v_workspace and id = v_catalog_id;
  v_error := null;
  begin
    perform public.clair_save_chart_order_action(
      v_workspace, v_actor, v_encounter, 'confirm', array[v_drift_id], v_drift_etag
    );
    raise exception 'clinical_master_phase1b3_confirm_freeze_replay_catalog_drift_not_rejected';
  exception when others then
    get stacked diagnostics v_error = message_text;
    if v_error <> 'catalog_projection_stale' then
      raise;
    end if;
  end;
  if (select order_confirmation_status from public.orders where id = v_drift_id) <> 'draft'
     or (select to_jsonb(order_row) from public.orders order_row where order_row.id = v_drift_id)
          is distinct from v_drift_order_before
     or (select count(*) from public.order_events where workspace_id = v_workspace and order_id = v_drift_id)
          <> v_drift_event_count
     or (select count(*) from public.lab_result_entries where workspace_id = v_workspace and order_id = v_drift_id)
          <> v_drift_header_count
     or (public.clair_get_chart_order_actions(v_workspace, v_encounter)->>'etag') <> v_drift_etag then
    raise exception 'clinical_master_phase1b3_confirm_freeze_replay_catalog_drift_not_atomic';
  end if;
  -- Restore active catalog authority through the lab-definition CAS before
  -- exercising the successful individual and set-child confirmations.  The
  -- drift assertion above remains pinned to the prior order revision.
  v_catalog_result := public.clair_update_order_catalog_item(
    v_workspace,
    v_catalog_id,
    v_catalog_revision,
    jsonb_build_object(
      'labDefinition',
      jsonb_build_object('availabilityStatus', 'active', 'links', v_links)
    )
  );
  if v_catalog_result->'item'->>'availability_status' <> 'active' then
    raise exception 'clinical_master_phase1b3_confirm_freeze_replay_catalog_restore_failed';
  end if;
  select catalog_revision into v_catalog_revision
  from public.order_catalog_items
  where workspace_id = v_workspace and id = v_catalog_id;

  -- Individual canonical master lab root: confirm must create one exact
  -- server identity and two immutable definition rows.
  v_saved := public.clair_get_chart_order_draft(v_workspace, v_encounter);
  perform public.clair_save_chart_order_draft(
    v_workspace,
    v_actor::text,
    v_encounter,
    jsonb_build_object(
      'expectedEtag', v_saved->>'etag',
      'rows', jsonb_build_array(jsonb_build_object(
        'rowType', 'individual',
        'orderId', v_individual_id,
        'workspaceCatalogItemId', v_catalog_id,
        'quantity', 1
      ))
    )
  );
  if (select workspace_catalog_item_id from public.orders where id = v_individual_id) is distinct from v_catalog_id
     or (select workspace_catalog_revision from public.orders where id = v_individual_id) is distinct from v_catalog_revision
     or (select applied_snapshot_schema_version from public.orders where id = v_individual_id) <> 0
     or (select applied_snapshot_sha256 from public.orders where id = v_individual_id) is not null
     or (select source_master_record_id from public.orders where id = v_individual_id)
          is distinct from (select source_master_record_id from public.order_catalog_items where workspace_id = v_workspace and id = v_catalog_id)
     or (select source_master_revision from public.orders where id = v_individual_id)
          is distinct from (select source_master_revision from public.order_catalog_items where workspace_id = v_workspace and id = v_catalog_id) then
    raise exception 'clinical_master_phase1b3_confirm_freeze_replay_individual_frozen_lineage_invalid';
  end if;
  v_actions := public.clair_get_chart_order_actions(v_workspace, v_encounter);
  v_confirm := public.clair_save_chart_order_action(
    v_workspace, v_actor, v_encounter, 'confirm', array[v_individual_id], v_actions->>'etag'
  );
  if v_confirm->>'stored' <> 'false'
     or (select order_confirmation_status from public.orders where id = v_individual_id) <> 'confirmed' then
    raise exception 'clinical_master_phase1b3_confirm_freeze_replay_individual_confirm_failed';
  end if;
  select * into v_result
  from public.lab_result_entries
  where workspace_id = v_workspace and order_id = v_individual_id;
  if not found
     or v_result.result_id <> 'lab-order:' || v_individual_id::text
     or v_result.result_definition_origin <> 'canonical'
     or v_result.result_definition_snapshot_sha256
          is distinct from private.clinical_master_sha256(v_result.result_definition_snapshot)
     or v_result.source_master_order_record_id is null
     or v_result.source_master_order_revision is null
     or v_result.source_workspace_catalog_item_id is distinct from v_catalog_id
     or v_result.source_workspace_catalog_revision is distinct from v_catalog_revision
     or v_result.source_master_order_record_id is distinct from (select source_master_record_id from public.orders where id = v_individual_id)
     or v_result.source_master_order_revision is distinct from (select source_master_revision from public.orders where id = v_individual_id) then
    raise exception 'clinical_master_phase1b3_confirm_freeze_replay_individual_header_invalid';
  end if;
  v_result_entry_id := v_result.id;
  v_result_snapshot_before := v_result.result_definition_snapshot;
  v_result_hash_before := v_result.result_definition_snapshot_sha256;
  select count(*) into v_row_count
  from public.lab_result_entry_rows
  where workspace_id = v_workspace and lab_result_entry_id = v_result.id;
  if v_row_count <> 2
     or exists (
       select 1
       from public.lab_result_entry_rows result_row
       left join public.order_catalog_lab_test_item_links link
         on link.workspace_id = v_workspace
        and link.order_catalog_item_id = v_catalog_id
        and link.lab_test_item_id = result_row.lab_test_item_id
       left join public.lab_test_item_versions version_row
         on version_row.workspace_id = v_workspace
        and version_row.lab_test_item_id = result_row.lab_test_item_id
        and version_row.workspace_result_revision = result_row.workspace_result_revision
       where result_row.workspace_id = v_workspace
         and result_row.lab_result_entry_id = v_result.id
         and (
           result_row.row_id !~ '^[0-9a-f]{64}$'
           or result_row.row_definition_origin <> 'clair_master'
           or link.id is null
           or version_row.lab_test_item_id is null
           or result_row.row_id is distinct from lower(encode(
                extensions.digest(convert_to(format(
                  'lab-result-row:v1:%s:%s:%s',
                  v_individual_id::text, link.id::text, result_row.sort_order::text
                ), 'UTF8'), 'sha256'), 'hex'))
           or result_row.source_master_test_record_id is null
           or result_row.source_master_test_record_id is distinct from link.source_master_test_record_id
           or result_row.owner_pinned_source_test_revision is distinct from link.owner_pinned_source_test_revision
           or result_row.item_version_source_master_record_id is null
           or result_row.item_version_source_master_record_id is distinct from version_row.source_master_record_id
           or result_row.item_version_source_test_revision is distinct from version_row.source_master_revision
           or result_row.workspace_result_revision is null
         )
     ) then
    raise exception 'clinical_master_phase1b3_confirm_freeze_replay_individual_rows_invalid';
  end if;
  select coalesce(jsonb_agg(to_jsonb(result_row) order by result_row.sort_order, result_row.row_id), '[]'::jsonb)
    into v_result_rows_before
  from public.lab_result_entry_rows result_row
  where result_row.workspace_id = v_workspace and result_row.lab_result_entry_id = v_result.id;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', item.id,
    'savedResultUsageCount', item.saved_result_usage_count,
    'historicalUnattributedUsageResidual', item.historical_unattributed_usage_residual,
    'canonicalSavedResultUsageCount', item.canonical_saved_result_usage_count,
    'legacySavedResultUsageCount', item.legacy_saved_result_usage_count,
    'quarantineSavedResultUsageCount', item.quarantine_saved_result_usage_count
  ) order by item.id), '[]'::jsonb)
    into v_usage_before
  from public.lab_test_items item
  where item.workspace_id = v_workspace
    and exists (
      select 1 from public.lab_result_entry_rows result_row
      where result_row.workspace_id = v_workspace
        and result_row.lab_result_entry_id = v_result.id
        and result_row.lab_test_item_id = item.id
    );
  select count(*) into v_before_count
  from public.lab_result_entries
  where workspace_id = v_workspace and order_id = v_individual_id;
  v_retry := public.clair_save_chart_order_action(
    v_workspace, v_actor, v_encounter, 'confirm', array[v_individual_id], '"' || repeat('0',64) || '"'
  );
  select count(*) into v_after_count
  from public.lab_result_entries
  where workspace_id = v_workspace and order_id = v_individual_id;
  select * into v_result
  from public.lab_result_entries
  where workspace_id = v_workspace and order_id = v_individual_id;
  if not found then
    raise exception 'clinical_master_phase1b3_confirm_freeze_replay_individual_retry_header_missing';
  end if;
  select coalesce(jsonb_agg(to_jsonb(result_row) order by result_row.sort_order, result_row.row_id), '[]'::jsonb)
    into v_result_rows_after
  from public.lab_result_entry_rows result_row
  where result_row.workspace_id = v_workspace and result_row.lab_result_entry_id = v_result.id;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', item.id,
    'savedResultUsageCount', item.saved_result_usage_count,
    'historicalUnattributedUsageResidual', item.historical_unattributed_usage_residual,
    'canonicalSavedResultUsageCount', item.canonical_saved_result_usage_count,
    'legacySavedResultUsageCount', item.legacy_saved_result_usage_count,
    'quarantineSavedResultUsageCount', item.quarantine_saved_result_usage_count
  ) order by item.id), '[]'::jsonb)
    into v_usage_after
  from public.lab_test_items item
  where item.workspace_id = v_workspace
    and exists (
      select 1 from public.lab_result_entry_rows result_row
      where result_row.workspace_id = v_workspace
        and result_row.lab_result_entry_id = v_result.id
        and result_row.lab_test_item_id = item.id
    );
  if v_retry->>'stored' <> 'true'
     or v_after_count <> v_before_count
     or v_result.id is distinct from v_result_entry_id
     or v_result.result_id is distinct from 'lab-order:' || v_individual_id::text
     or v_result.result_definition_snapshot is distinct from v_result_snapshot_before
     or v_result.result_definition_snapshot_sha256 is distinct from v_result_hash_before
     or v_result_rows_after is distinct from v_result_rows_before
     or v_usage_after is distinct from v_usage_before then
    raise exception 'clinical_master_phase1b3_confirm_freeze_replay_individual_retry_changed_frozen_state';
  end if;

  -- B2 set with one canonical lab child and one legacy/non-lab child.  The
  -- parent is the only selected action root; the wrapper must never freeze
  -- the set parent or the non-lab child.
  v_set_definition := jsonb_build_object(
    'setCategory', 'freeze-fix-replay',
    'setName', 'B3 freeze fix replay set',
    'billingName', 'B3 freeze fix replay set billing',
    'amountBasis', 'included_order_sum',
    'setPriceKrw', null,
    'rangeBasis', null,
    'salesUnit', 'per_order',
    'billingReflectionEnabled', false,
    'taxType', 'derived',
    'targetSpecies', jsonb_build_array('dog'),
    'careGuide', null,
    'internalInstruction', 'Synthetic replay only.',
    'items', jsonb_build_array(
      jsonb_build_object(
        'childKind', 'atomic',
        'childOrderCatalogItemId', v_catalog_id,
        'childOrderCatalogRevision', v_catalog_revision,
        'childOrderSetId', null,
        'childSetRevisionId', null,
        'sortOrder', 1,
        'defaultSelected', true,
        'billingReflectionDefault', true,
        'defaultQuantity', 1,
        'quantitySource', 'fixed_one'
      ),
      jsonb_build_object(
        'childKind', 'atomic',
        'childOrderCatalogItemId', 'den194-catalog-wellness-vaccine',
        'childOrderCatalogRevision', 1,
        'childOrderSetId', null,
        'childSetRevisionId', null,
        'sortOrder', 2,
        'defaultSelected', true,
        'billingReflectionDefault', true,
        'defaultQuantity', 1,
        'quantitySource', 'manual_at_apply'
      )
    ),
    'priceRanges', jsonb_build_array()
  );
  v_set_result := public.clair_create_order_set(
    v_workspace,
    v_set_definition,
    'active',
    'b3f00000-0000-4000-8000-000000000005'::uuid
  );
  if v_set_result->>'outcome' <> 'created' then
    raise exception 'clinical_master_phase1b3_confirm_freeze_replay_set_create_failed:%', v_set_result;
  end if;
  v_set_id := v_set_result #>> '{result,orderSet,id}';
  select current_revision_id into v_set_revision
  from public.order_sets
  where workspace_id = v_workspace and id = v_set_id;
  select id into v_lab_revision_item
  from public.order_set_revision_items
  where workspace_id = v_workspace
    and order_set_id = v_set_id
    and revision_id = v_set_revision
    and child_order_catalog_item_id = v_catalog_id;
  select id into v_non_lab_revision_item
  from public.order_set_revision_items
  where workspace_id = v_workspace
    and order_set_id = v_set_id
    and revision_id = v_set_revision
    and child_order_catalog_item_id = 'den194-catalog-wellness-vaccine';
  v_selection := jsonb_build_object('items', jsonb_build_array(
    jsonb_build_object('revisionItemId', v_lab_revision_item, 'selected', true, 'quantity', 1),
    jsonb_build_object('revisionItemId', v_non_lab_revision_item, 'selected', true, 'quantity', 2)
  ));
  v_preview := public.clair_preview_chart_order_set(
    v_workspace, v_encounter, v_set_id, v_set_revision, v_selection
  );
  if (v_preview->'items'->0->>'quantity')::numeric <> 1
     or (v_preview->'items'->1->>'quantity')::numeric <> 2 then
    raise exception 'clinical_master_phase1b3_confirm_freeze_replay_set_quantity_invalid';
  end if;
  v_saved := public.clair_get_chart_order_draft(v_workspace, v_encounter);
  perform public.clair_save_chart_order_draft(
    v_workspace,
    v_actor::text,
    v_encounter,
    jsonb_build_object(
      'expectedEtag', v_saved->>'etag',
      'rows', jsonb_build_array(jsonb_build_object(
        'rowType', 'set',
        'orderId', v_set_parent_id,
        'sourceSetId', v_set_id,
        'sourceSetRevisionId', v_set_revision,
        'sourceSetRevisionNo', 1,
        'selectionIntent', v_selection
      ))
    )
  );
  select id into v_lab_child_id
  from public.orders
  where workspace_id = v_workspace
    and parent_chart_order_line_id = v_set_parent_id
    and row_type = 'set_child'
    and order_type = 'lab'
    and status <> 'cancelled';
  select id into v_non_lab_child_id
  from public.orders
  where workspace_id = v_workspace
    and parent_chart_order_line_id = v_set_parent_id
    and row_type = 'set_child'
    and order_type <> 'lab'
    and status <> 'cancelled';
  if v_lab_child_id is null or v_non_lab_child_id is null
     or (select source_master_record_id from public.orders where id = v_lab_child_id) is null
     or (select source_master_revision from public.orders where id = v_lab_child_id) is null
     or (select workspace_catalog_item_id from public.orders where id = v_lab_child_id) is distinct from v_catalog_id
     or (select workspace_catalog_revision from public.orders where id = v_lab_child_id) is distinct from v_catalog_revision
     or (select applied_snapshot_schema_version from public.orders where id = v_lab_child_id) <> 1
     or (select applied_snapshot_sha256 from public.orders where id = v_lab_child_id) !~ '^[0-9a-f]{64}$'
     or (select source_master_record_id from public.orders where id = v_lab_child_id)
          is distinct from (select source_master_record_id from public.order_catalog_items where workspace_id = v_workspace and id = v_catalog_id)
     or (select source_master_revision from public.orders where id = v_lab_child_id)
          is distinct from (select source_master_revision from public.order_catalog_items where workspace_id = v_workspace and id = v_catalog_id)
     or (select source_master_record_id from public.orders where id = v_non_lab_child_id) is not null then
    raise exception 'clinical_master_phase1b3_confirm_freeze_replay_set_child_lineage_invalid';
  end if;
  v_actions := public.clair_get_chart_order_actions(v_workspace, v_encounter);
  v_confirm := public.clair_save_chart_order_action(
    v_workspace, v_actor, v_encounter, 'confirm', array[v_set_parent_id], v_actions->>'etag'
  );
  if v_confirm->>'stored' <> 'false'
     or (select order_confirmation_status from public.orders where id = v_set_parent_id) <> 'confirmed'
     or (select order_confirmation_status from public.orders where id = v_lab_child_id) <> 'confirmed'
     or (select order_confirmation_status from public.orders where id = v_non_lab_child_id) <> 'confirmed' then
    raise exception 'clinical_master_phase1b3_confirm_freeze_replay_set_confirm_failed';
  end if;
  select * into v_result
  from public.lab_result_entries
  where workspace_id = v_workspace and order_id = v_lab_child_id;
  if not found
     or v_result.result_id <> 'lab-order:' || v_lab_child_id::text
     or v_result.result_definition_origin <> 'canonical'
     or v_result.result_definition_snapshot_sha256
          is distinct from private.clinical_master_sha256(v_result.result_definition_snapshot)
     or v_result.source_master_order_record_id is null
     or v_result.source_master_order_revision is null
     or v_result.source_workspace_catalog_item_id is distinct from v_catalog_id
     or v_result.source_workspace_catalog_revision is distinct from v_catalog_revision
     or v_result.source_master_order_record_id is distinct from (select source_master_record_id from public.orders where id = v_lab_child_id)
     or v_result.source_master_order_revision is distinct from (select source_master_revision from public.orders where id = v_lab_child_id) then
    raise exception 'clinical_master_phase1b3_confirm_freeze_replay_set_lab_header_invalid';
  end if;
  v_result_entry_id := v_result.id;
  v_result_snapshot_before := v_result.result_definition_snapshot;
  v_result_hash_before := v_result.result_definition_snapshot_sha256;
  select count(*) into v_row_count
  from public.lab_result_entry_rows
  where workspace_id = v_workspace and lab_result_entry_id = v_result.id;
  if v_row_count <> 2
     or exists (
       select 1
       from public.lab_result_entry_rows result_row
       left join public.order_catalog_lab_test_item_links link
         on link.workspace_id = v_workspace
        and link.order_catalog_item_id = v_catalog_id
        and link.lab_test_item_id = result_row.lab_test_item_id
       left join public.lab_test_item_versions version_row
         on version_row.workspace_id = v_workspace
        and version_row.lab_test_item_id = result_row.lab_test_item_id
        and version_row.workspace_result_revision = result_row.workspace_result_revision
       where result_row.workspace_id = v_workspace
         and result_row.lab_result_entry_id = v_result.id
         and (
           result_row.row_id !~ '^[0-9a-f]{64}$'
           or result_row.row_definition_origin <> 'clair_master'
           or link.id is null
           or version_row.lab_test_item_id is null
           or result_row.row_id is distinct from lower(encode(
                extensions.digest(convert_to(format(
                  'lab-result-row:v1:%s:%s:%s',
                  v_lab_child_id::text, link.id::text, result_row.sort_order::text
                ), 'UTF8'), 'sha256'), 'hex'))
           or result_row.source_master_test_record_id is null
           or result_row.source_master_test_record_id is distinct from link.source_master_test_record_id
           or result_row.owner_pinned_source_test_revision is distinct from link.owner_pinned_source_test_revision
           or result_row.item_version_source_master_record_id is null
           or result_row.item_version_source_master_record_id is distinct from version_row.source_master_record_id
           or result_row.item_version_source_test_revision is distinct from version_row.source_master_revision
           or result_row.workspace_result_revision is null
         )
     ) then
    raise exception 'clinical_master_phase1b3_confirm_freeze_replay_set_lab_rows_invalid';
  end if;
  if exists (
    select 1 from public.lab_result_entries
    where workspace_id = v_workspace and order_id = v_set_parent_id
  ) or exists (
    select 1 from public.lab_result_entries
    where workspace_id = v_workspace and order_id = v_non_lab_child_id
  ) then
    raise exception 'clinical_master_phase1b3_confirm_freeze_replay_non_lab_child_or_parent_frozen';
  end if;
  select coalesce(jsonb_agg(to_jsonb(result_row) order by result_row.sort_order, result_row.row_id), '[]'::jsonb)
    into v_result_rows_before
  from public.lab_result_entry_rows result_row
  where result_row.workspace_id = v_workspace and result_row.lab_result_entry_id = v_result.id;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', item.id,
    'savedResultUsageCount', item.saved_result_usage_count,
    'historicalUnattributedUsageResidual', item.historical_unattributed_usage_residual,
    'canonicalSavedResultUsageCount', item.canonical_saved_result_usage_count,
    'legacySavedResultUsageCount', item.legacy_saved_result_usage_count,
    'quarantineSavedResultUsageCount', item.quarantine_saved_result_usage_count
  ) order by item.id), '[]'::jsonb)
    into v_usage_before
  from public.lab_test_items item
  where item.workspace_id = v_workspace
    and exists (
      select 1 from public.lab_result_entry_rows result_row
      where result_row.workspace_id = v_workspace
        and result_row.lab_result_entry_id = v_result.id
        and result_row.lab_test_item_id = item.id
    );
  select count(*) into v_before_count
  from public.lab_result_entries
  where workspace_id = v_workspace and order_id = v_lab_child_id;
  v_retry := public.clair_save_chart_order_action(
    v_workspace, v_actor, v_encounter, 'confirm', array[v_set_parent_id], '"' || repeat('0',64) || '"'
  );
  select count(*) into v_after_count
  from public.lab_result_entries
  where workspace_id = v_workspace and order_id = v_lab_child_id;
  select * into v_result
  from public.lab_result_entries
  where workspace_id = v_workspace and order_id = v_lab_child_id;
  if not found then
    raise exception 'clinical_master_phase1b3_confirm_freeze_replay_set_retry_header_missing';
  end if;
  select coalesce(jsonb_agg(to_jsonb(result_row) order by result_row.sort_order, result_row.row_id), '[]'::jsonb)
    into v_result_rows_after
  from public.lab_result_entry_rows result_row
  where result_row.workspace_id = v_workspace and result_row.lab_result_entry_id = v_result.id;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', item.id,
    'savedResultUsageCount', item.saved_result_usage_count,
    'historicalUnattributedUsageResidual', item.historical_unattributed_usage_residual,
    'canonicalSavedResultUsageCount', item.canonical_saved_result_usage_count,
    'legacySavedResultUsageCount', item.legacy_saved_result_usage_count,
    'quarantineSavedResultUsageCount', item.quarantine_saved_result_usage_count
  ) order by item.id), '[]'::jsonb)
    into v_usage_after
  from public.lab_test_items item
  where item.workspace_id = v_workspace
    and exists (
      select 1 from public.lab_result_entry_rows result_row
      where result_row.workspace_id = v_workspace
        and result_row.lab_result_entry_id = v_result.id
        and result_row.lab_test_item_id = item.id
    );
  if v_retry->>'stored' <> 'true'
     or v_after_count <> v_before_count
     or v_result.id is distinct from v_result_entry_id
     or v_result.result_id is distinct from 'lab-order:' || v_lab_child_id::text
     or v_result.result_definition_snapshot is distinct from v_result_snapshot_before
     or v_result.result_definition_snapshot_sha256 is distinct from v_result_hash_before
     or v_result_rows_after is distinct from v_result_rows_before
     or v_usage_after is distinct from v_usage_before then
    raise exception 'clinical_master_phase1b3_confirm_freeze_replay_set_retry_changed_frozen_state';
  end if;

  -- A workspace_custom/masterless lab order must remain confirmed without a
  -- canonical result header.  This is the regression guard for the old broad
  -- order_type-only candidate query.
  v_saved := public.clair_get_chart_order_draft(v_workspace, v_encounter);
  perform public.clair_save_chart_order_draft(
    v_workspace,
    v_actor::text,
    v_encounter,
    jsonb_build_object(
      'expectedEtag', v_saved->>'etag',
      'rows', jsonb_build_array(jsonb_build_object(
        'rowType', 'individual',
        'orderId', v_legacy_id,
        'workspaceCatalogItemId', 'den194-catalog-cbc',
        'quantity', 1
      ))
    )
  );
  v_actions := public.clair_get_chart_order_actions(v_workspace, v_encounter);
  v_confirm := public.clair_save_chart_order_action(
    v_workspace, v_actor, v_encounter, 'confirm', array[v_legacy_id], v_actions->>'etag'
  );
  if (select order_confirmation_status from public.orders where id = v_legacy_id) <> 'confirmed'
     or exists (select 1 from public.lab_result_entries where workspace_id = v_workspace and order_id = v_legacy_id) then
    raise exception 'clinical_master_phase1b3_confirm_freeze_replay_workspace_custom_lab_frozen';
  end if;

  -- Public ACL/permission boundary: an active front-desk member cannot reach
  -- the chart action, and the draft remains unchanged.
  v_saved := public.clair_get_chart_order_draft(v_workspace, v_encounter);
  perform public.clair_save_chart_order_draft(
    v_workspace,
    v_actor::text,
    v_encounter,
    jsonb_build_object(
      'expectedEtag', v_saved->>'etag',
      'rows', jsonb_build_array(jsonb_build_object(
        'rowType', 'individual',
        'orderId', v_permission_id,
        'workspaceCatalogItemId', 'den194-catalog-wellness-vaccine',
        'quantity', 1
      ))
    )
  );
  v_saved := public.clair_get_chart_order_actions(v_workspace, v_encounter);
  perform set_config('request.jwt.claim.sub', v_front_desk::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_front_desk::text, 'role', 'authenticated')::text,
    true
  );
  v_error := null;
  begin
    perform public.clair_save_chart_order_action(
      v_workspace,
      v_front_desk,
      v_encounter,
      'confirm',
      array[v_permission_id],
      v_saved->>'etag'
    );
    raise exception 'permission_boundary_not_enforced';
  exception when others then
    get stacked diagnostics v_error = message_text;
    if v_error not like 'permission_missing%' then
      raise;
    end if;
  end;
  if (select order_confirmation_status from public.orders where id = v_permission_id) <> 'draft' then
    raise exception 'permission_boundary_mutated_order';
  end if;

  raise notice 'clinical_master_phase1b3_confirm_lab_freeze_replay_ok';
end
$$;

-- ACL regression runs as the actual authenticated database role.  Claims alone
-- under postgres would only test SECURITY DEFINER behavior, not EXECUTE ACLs.
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000001',
  true
);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', '00000000-0000-4000-8000-000000000001',
    'role', 'authenticated'
  )::text,
  true
);
do $acl$
declare
  v_private_denied boolean := false;
  v_public_result jsonb;
begin
  if current_user <> 'authenticated'
     or has_function_privilege(
          current_user,
          'private.clair_save_chart_order_action(text,uuid,uuid,text,uuid[],text)',
          'EXECUTE'
        )
     or not has_function_privilege(
          current_user,
          'public.clair_save_chart_order_action(text,uuid,uuid,text,uuid[],text)',
          'EXECUTE'
        )
     or has_function_privilege(
          'anon',
          'public.clair_save_chart_order_action(text,uuid,uuid,text,uuid[],text)',
          'EXECUTE'
        ) then
    raise exception 'clinical_master_phase1b3_confirm_freeze_replay_acl_matrix_invalid';
  end if;
  begin
    execute 'select private.clair_save_chart_order_action($1,$2,$3,$4,$5,$6)'
      using
        'clair-demo',
        '00000000-0000-4000-8000-000000000001'::uuid,
        '19426000-0000-4000-8000-000000000001'::uuid,
        'confirm',
        array['b3f00000-0000-4000-8000-000000000001'::uuid],
        '"' || repeat('0', 64) || '"';
  exception when insufficient_privilege then
    v_private_denied := true;
  end;
  if not v_private_denied then
    raise exception 'clinical_master_phase1b3_confirm_freeze_replay_private_execute_leaked';
  end if;
  v_public_result := public.clair_save_chart_order_action(
    'clair-demo',
    '00000000-0000-4000-8000-000000000001'::uuid,
    '19426000-0000-4000-8000-000000000001'::uuid,
    'confirm',
    array['b3f00000-0000-4000-8000-000000000001'::uuid],
    '"' || repeat('0', 64) || '"'
  );
  if v_public_result->>'stored' <> 'true' then
    raise exception 'clinical_master_phase1b3_confirm_freeze_replay_public_execute_failed:%', v_public_result;
  end if;
end
$acl$;
reset role;

rollback;
