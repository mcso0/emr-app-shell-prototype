-- Local-only Phase 1B-1 laboratory replay.
-- Run after an A1 -> A2 -> A3 -> B1 reset:
--   psql --dbname "$LOCAL_DATABASE_URL" -v ON_ERROR_STOP=1 \
--     -f supabase/snippets/clinical_master_phase1b1_replay.sql
--
-- Every row is synthetic and the transaction is rolled back.  The fixture is
-- loaded from tests/fixtures so the replay and focused contract test share one
-- canonical payload without adding a seed/deployment dependency.

\set ON_ERROR_STOP on
\set b1_fixture '{"releaseKey":"phase1b1-lab-fixture-v1","releaseNotes":"Synthetic Phase 1B-1 laboratory fixture.","publishedByLabel":"Phase 1B-1 synthetic fixture","records":[{"masterKey":"phase1b1.specimen.serum","recordType":"specimen_type","names":[{"languageCode":"ko","nameKind":"preferred","name":"혈청"},{"languageCode":"en","nameKind":"preferred","name":"Serum"}],"source":{"sourceType":"synthetic","title":"Phase 1B-1 fixture"},"detail":{"specimenCode":"serum"}},{"masterKey":"phase1b1.input.numeric","recordType":"result_input_type","names":[{"languageCode":"ko","nameKind":"preferred","name":"숫자"},{"languageCode":"en","nameKind":"preferred","name":"Numeric"}],"source":{"sourceType":"synthetic","title":"Phase 1B-1 fixture"},"detail":{"inputCode":"numeric","valueKind":"numeric","supportsUnit":true}},{"masterKey":"phase1b1.input.text","recordType":"result_input_type","names":[{"languageCode":"ko","nameKind":"preferred","name":"텍스트"},{"languageCode":"en","nameKind":"preferred","name":"Text"}],"source":{"sourceType":"synthetic","title":"Phase 1B-1 fixture"},"detail":{"inputCode":"text","valueKind":"text","supportsUnit":false}},{"masterKey":"phase1b1.unit.mgdl","recordType":"unit","names":[{"languageCode":"ko","nameKind":"preferred","name":"밀리그램/데시리터"},{"languageCode":"en","nameKind":"preferred","name":"mg/dL"}],"source":{"sourceType":"synthetic","title":"Phase 1B-1 fixture"},"detail":{"unitCode":"mg/dL","symbol":"mg/dL","decimalScale":1}},{"masterKey":"phase1b1.test.glucose","recordType":"lab_test","names":[{"languageCode":"ko","nameKind":"preferred","name":"혈당"},{"languageCode":"en","nameKind":"preferred","name":"Glucose"}],"source":{"sourceType":"synthetic","title":"Phase 1B-1 fixture"},"detail":{"testCode":"GLU","resultInputTypeKey":"phase1b1.input.numeric","canonicalUnitKey":"phase1b1.unit.mgdl","decimalScale":1}},{"masterKey":"phase1b1.test.protein","recordType":"lab_test","names":[{"languageCode":"ko","nameKind":"preferred","name":"단백질 메모"},{"languageCode":"en","nameKind":"preferred","name":"Protein note"}],"source":{"sourceType":"synthetic","title":"Phase 1B-1 fixture"},"detail":{"testCode":"PROT_NOTE","resultInputTypeKey":"phase1b1.input.text","canonicalUnitKey":null,"decimalScale":null}},{"masterKey":"phase1b1.panel.metabolic","recordType":"lab_panel","names":[{"languageCode":"ko","nameKind":"preferred","name":"기초 혈액검사"},{"languageCode":"en","nameKind":"preferred","name":"Basic Metabolic"}],"source":{"sourceType":"synthetic","title":"Phase 1B-1 fixture"},"detail":{"panelCode":"BMP"}},{"masterKey":"phase1b1.order.metabolic","recordType":"order","names":[{"languageCode":"ko","nameKind":"preferred","name":"기초 혈액검사"},{"languageCode":"en","nameKind":"preferred","name":"Basic Metabolic Panel"}],"source":{"sourceType":"synthetic","title":"Phase 1B-1 fixture"},"detail":{"classificationPathKey":"phase1a2.fallback.path.lab","defaultSalesUnitCode":"EA","defaultBillingReflectionEnabled":true,"defaultQuantity":1,"species":["dog"]}}],"classificationPaths":[],"labPanelItems":[{"panelMasterKey":"phase1b1.panel.metabolic","testMasterKey":"phase1b1.test.glucose","sortOrder":0,"required":true,"displayGroup":"chemistry"},{"panelMasterKey":"phase1b1.panel.metabolic","testMasterKey":"phase1b1.test.protein","sortOrder":1,"required":false,"displayGroup":"chemistry"}],"labOrderProfiles":[{"orderMasterKey":"phase1b1.order.metabolic","labPanelMasterKey":"phase1b1.panel.metabolic","labTestMasterKey":null,"specimenMasterKey":"phase1b1.specimen.serum"}]}'

begin;

create temp table clinical_master_phase1b1_replay_state (
  state_key text primary key,
  state_value jsonb not null
) on commit drop;
create temp table clinical_master_phase1b1_fixture (payload jsonb not null) on commit drop;
insert into clinical_master_phase1b1_fixture(payload) values (:'b1_fixture'::jsonb);

do $replay$
declare
  v_actor uuid := '00000000-0000-4000-8000-000000000001';
  v_workspace text := 'b1-replay-laboratory';
  v_encounter uuid := 'b1000000-0000-4000-8000-000000000001';
  v_order uuid := 'b1000000-0000-4000-8000-000000000099';
  v_release jsonb;
  v_payload jsonb;
  v_adoption jsonb;
  v_catalog_id text;
  v_catalog_revision integer;
  v_catalog jsonb;
  v_links jsonb;
  v_confirm jsonb;
  v_retry jsonb;
  v_result public.lab_result_entries%rowtype;
  v_work_item uuid;
  v_invoice_id uuid;
  v_lab_item_id text;
  v_lab_link_id text;
  v_item_revision integer;
  v_link_revision integer;
  v_row_count integer;
  v_invoice_line_count integer;
  v_update_id uuid;
  v_catalog_update_id uuid;
  v_resolved jsonb;
  v_projection jsonb;
  v_pending_count integer;
  v_guard_denied boolean;
  v_stale_update_id uuid;
  v_shared_catalog_id text;
  v_shared_link_id text;
  v_shared_metadata jsonb;
  v_bad_snapshot jsonb;
  v_branch_catalog_revision integer;
  v_branch_item_revision integer;
  v_branch_link_revision integer;
  v_branch_link_snapshot jsonb;
  v_branch_snapshot jsonb;
  v_branch_hash text;
begin
  if to_regprocedure('private.publish_clinical_master_release(jsonb,uuid)') is null
     or to_regprocedure('private.clair_adopt_master_release_to_workspace(text,uuid)') is null
     or to_regprocedure('public.clair_update_order_catalog_item(text,text,integer,jsonb)') is null
     or to_regprocedure('public.clair_save_chart_order_action(text,uuid,uuid,text,uuid[])') is null
     or to_regprocedure('public.clair_save_lab_result_entry_v2(text,uuid,text,uuid,uuid,uuid,integer,uuid,jsonb)') is null then
    raise exception 'clinical_master_phase1b1_replay_required_rpc_missing';
  end if;

  perform private.clinical_master_seed_fallback_paths();
  insert into public.workspaces(id, display_name, status, created_by_user_id)
  values (v_workspace, 'Phase 1B-1 laboratory replay', 'active', v_actor);
  insert into public.user_memberships(id, workspace_id, user_id, roles, status, activated_at)
  values ('b1a00000-0000-4000-8000-000000000001', v_workspace, v_actor,
          array['hospital_admin'], 'active', now());
  insert into public.patients(id, workspace_id, patient_no, name, species)
  values ('b1000000-0000-4000-8000-000000000010', v_workspace, 'B1-REPLAY-001', 'B1 replay patient', 'dog');
  insert into public.encounters(id, workspace_id, patient_id, encounter_no, reception_type, status)
  values (v_encounter, v_workspace, 'b1000000-0000-4000-8000-000000000010', 'B1-REPLAY-ENC-001', 'walk_in', 'waiting');

  select payload into v_payload from clinical_master_phase1b1_fixture limit 1;
  v_release := private.publish_clinical_master_release(v_payload, v_actor);
  if v_release->>'idempotent' <> 'false' then
    raise exception 'clinical_master_phase1b1_replay_publish_not_new';
  end if;
  if (select count(*) from private.clinical_master_lab_vocabulary_publish_stage
      where release_id=(v_release->>'releaseId')::uuid) <> 4
     or (select count(*) from private.clinical_master_lab_test_publish_stage
         where release_id=(v_release->>'releaseId')::uuid) <> 2
     or (select count(*) from private.clinical_master_lab_panel_publish_stage
         where release_id=(v_release->>'releaseId')::uuid) <> 1
     or (select count(*) from private.clinical_master_lab_order_publish_stage
         where release_id=(v_release->>'releaseId')::uuid) <> 1 then
    raise exception 'clinical_master_phase1b1_replay_four_stage_missing';
  end if;
  if (select count(*) from master.master_record_versions version
      join master.master_records owner on owner.id=version.master_record_id
      where version.release_id=(v_release->>'releaseId')::uuid
        and owner.record_type='lab_test'
        and version.snapshot->'labTestVocabulary'->>'resultInputTypeMasterRecordId' is not null
        and version.snapshot->'labTestVocabulary'->>'resultInputTypeRevision' is not null) <> 2 then
    raise exception 'clinical_master_phase1b1_replay_vocabulary_pin_missing';
  end if;
  v_adoption := private.clair_adopt_master_release_to_workspace(v_workspace, (v_release->>'releaseId')::uuid);
  if coalesce((v_adoption->'labProjection'->>'createdItemCount')::integer, 0) <> 2
     or coalesce((v_adoption->'labProjection'->>'createdLinkCount')::integer, 0) <> 2 then
    raise exception 'clinical_master_phase1b1_replay_lab_projection_failed:%', v_adoption;
  end if;

  v_guard_denied := false;
  begin
    update master.lab_tests
    set test_code = test_code || '_blocked'
    where master_record_id = (select id from master.master_records where master_key='phase1b1.test.glucose');
  exception when others then
    if sqlerrm = 'clinical_master_lab_test_identity_immutable' then v_guard_denied := true; else raise; end if;
  end;
  if not v_guard_denied then raise exception 'clinical_master_phase1b1_replay_lab_test_identity_guard_missing'; end if;
  v_guard_denied := false;
  begin
    delete from master.lab_panels
    where master_record_id = (select id from master.master_records where master_key='phase1b1.panel.metabolic');
  exception when others then
    if sqlerrm = 'clinical_master_lab_typed_projection_immutable' then v_guard_denied := true; else raise; end if;
  end;
  if not v_guard_denied then raise exception 'clinical_master_phase1b1_replay_lab_panel_delete_guard_missing'; end if;

  select id, catalog_revision into v_catalog_id, v_catalog_revision
  from public.order_catalog_items
  where workspace_id = v_workspace and source_master_record_id = (
    select id from master.master_records where master_key = 'phase1b1.order.metabolic'
  );
  if v_catalog_id is null or v_catalog_revision is null then
    raise exception 'clinical_master_phase1b1_replay_catalog_missing';
  end if;

  -- A2 owns price activation.  Keep explicit zero to prove NULL/zero is not
  -- collapsed by the B1 lab-definition CAS.
  perform set_config('request.jwt.claim.sub', v_actor::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_actor::text, 'role', 'authenticated')::text, true);
  perform public.clair_update_order_catalog_item_a2_base(
    v_workspace, v_catalog_id, v_catalog_revision, jsonb_build_object('priceKrw', 0)
  );
  select catalog_revision into v_catalog_revision
  from public.order_catalog_items where workspace_id = v_workspace and id = v_catalog_id;

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
  where link.workspace_id = v_workspace and link.order_catalog_item_id = v_catalog_id
    and link.link_origin in ('clair_master', 'workspace_custom');
  v_catalog := public.clair_update_order_catalog_item(
    v_workspace, v_catalog_id, v_catalog_revision,
    jsonb_build_object('labDefinition', jsonb_build_object('availabilityStatus', 'active', 'links', v_links))
  );
  if (v_catalog->'item'->>'availability_status') <> 'active' then
    raise exception 'clinical_master_phase1b1_replay_catalog_activation_failed';
  end if;

  perform public.clair_save_chart_order_draft(
    v_workspace, v_actor::text, v_encounter,
    jsonb_build_array(jsonb_build_object(
      'orderId', v_order, 'workspaceCatalogItemId', v_catalog_id,
      'displayName', '기초 혈액검사', 'billingDisplayName', '기초 혈액검사',
      'quantity', 1, 'unitPriceSnapshot', 0, 'rowType', 'individual',
      'taskRequired', true, 'billingReflectionEnabled', true
    ))
  );
  v_confirm := public.clair_save_chart_order_action(v_workspace, v_actor, v_encounter, 'confirm', array[v_order]);
  select * into v_result from public.lab_result_entries where workspace_id = v_workspace and order_id = v_order;
  if v_result.result_id <> 'lab-order:' || v_order::text
     or v_result.result_definition_origin <> 'canonical'
     or v_result.result_definition_snapshot_sha256 <> private.clinical_master_sha256(v_result.result_definition_snapshot) then
    raise exception 'clinical_master_phase1b1_replay_result_freeze_invalid';
  end if;
  select count(*) into v_row_count from public.lab_result_entry_rows where workspace_id = v_workspace and lab_result_entry_id = v_result.id;
  if v_row_count <> 2 then raise exception 'clinical_master_phase1b1_replay_panel_row_count:%', v_row_count; end if;
  set constraints all immediate;
  set constraints all deferred;
  if exists (
    select 1
    from public.lab_result_entry_rows row
    join public.order_catalog_lab_test_item_links link
      on link.workspace_id=v_workspace and link.order_catalog_item_id=v_catalog_id
     and link.lab_test_item_id=row.lab_test_item_id
    where row.workspace_id=v_workspace and row.lab_result_entry_id=v_result.id
      and row.row_id is distinct from lower(encode(extensions.digest(convert_to(format('lab-result-row:v1:%s:%s:%s',v_order::text,link.id::text,row.sort_order::text),'UTF8'),'sha256'),'hex'))
  ) then
    raise exception 'clinical_master_phase1b1_replay_callable_row_id_formula_failed';
  end if;

  -- The stored-definition validator must reject JSON strings that happen to
  -- cast to a valid number/boolean.  Bypass only the canonical immutability
  -- trigger in this rolled-back synthetic assertion, then restore the exact
  -- frozen snapshot before exercising the value-save path.
  v_bad_snapshot := jsonb_set(v_result.result_definition_snapshot, '{rows,0,ordinal}', to_jsonb('1'::text), false);
  alter table public.lab_result_entries disable trigger lab_result_entries_canonical_definition_guard;
  alter table public.lab_result_entries disable trigger lab_result_entries_canonical_definition_deferred;
  update public.lab_result_entries
  set result_definition_snapshot=v_bad_snapshot,
      result_definition_snapshot_sha256=private.clinical_master_sha256(v_bad_snapshot)
  where workspace_id=v_workspace and id=v_result.id;
  alter table public.lab_result_entries enable trigger lab_result_entries_canonical_definition_guard;
  alter table public.lab_result_entries enable trigger lab_result_entries_canonical_definition_deferred;
  v_guard_denied := false;
  begin
    perform private.clair_assert_lab_result_definition_snapshot(v_workspace,v_result.id);
  exception when others then
    if sqlerrm = 'lab_result_definition_snapshot_invalid' then v_guard_denied := true; else raise; end if;
  end;
  alter table public.lab_result_entries disable trigger lab_result_entries_canonical_definition_guard;
  alter table public.lab_result_entries disable trigger lab_result_entries_canonical_definition_deferred;
  update public.lab_result_entries
  set result_definition_snapshot=v_result.result_definition_snapshot,
      result_definition_snapshot_sha256=v_result.result_definition_snapshot_sha256
  where workspace_id=v_workspace and id=v_result.id;
  alter table public.lab_result_entries enable trigger lab_result_entries_canonical_definition_guard;
  alter table public.lab_result_entries enable trigger lab_result_entries_canonical_definition_deferred;
  if not v_guard_denied then raise exception 'clinical_master_phase1b1_replay_json_type_string_accepted'; end if;

  v_bad_snapshot := jsonb_set(v_result.result_definition_snapshot, '{schemaVersion}', to_jsonb('1'::text), false);
  alter table public.lab_result_entries disable trigger lab_result_entries_canonical_definition_guard;
  alter table public.lab_result_entries disable trigger lab_result_entries_canonical_definition_deferred;
  update public.lab_result_entries
  set result_definition_snapshot=v_bad_snapshot,
      result_definition_snapshot_sha256=private.clinical_master_sha256(v_bad_snapshot)
  where workspace_id=v_workspace and id=v_result.id;
  alter table public.lab_result_entries enable trigger lab_result_entries_canonical_definition_guard;
  alter table public.lab_result_entries enable trigger lab_result_entries_canonical_definition_deferred;
  v_guard_denied := false;
  begin
    perform private.clair_assert_lab_result_definition_snapshot(v_workspace,v_result.id);
  exception when others then
    if sqlerrm = 'lab_result_definition_snapshot_invalid' then v_guard_denied := true; else raise; end if;
  end;
  alter table public.lab_result_entries disable trigger lab_result_entries_canonical_definition_guard;
  alter table public.lab_result_entries disable trigger lab_result_entries_canonical_definition_deferred;
  update public.lab_result_entries
  set result_definition_snapshot=v_result.result_definition_snapshot,
      result_definition_snapshot_sha256=v_result.result_definition_snapshot_sha256
  where workspace_id=v_workspace and id=v_result.id;
  alter table public.lab_result_entries enable trigger lab_result_entries_canonical_definition_guard;
  alter table public.lab_result_entries enable trigger lab_result_entries_canonical_definition_deferred;
  if not v_guard_denied then raise exception 'clinical_master_phase1b1_replay_json_schema_version_string_accepted'; end if;

  perform public.clair_save_lab_result_entry_v2(
    v_workspace, v_actor, v_result.result_id, v_encounter, v_order, null,
    0, 'b1111111-1111-4111-8111-111111111111'::uuid,
    (select jsonb_agg(jsonb_build_object('rowId', row.row_id,
      'value', case when row.sort_order = 1 then '42.5' else 'trace' end,
      'note', case when row.sort_order = 1 then 'replay' else null end)
      order by row.sort_order)
     from public.lab_result_entry_rows row where row.workspace_id = v_workspace and row.lab_result_entry_id = v_result.id)
  );
  v_retry := public.clair_save_lab_result_entry_v2(
    v_workspace, v_actor, v_result.result_id, v_encounter, v_order, null,
    0, 'b1111111-1111-4111-8111-111111111111'::uuid,
    (select jsonb_agg(jsonb_build_object('rowId', row.row_id,
      'value', case when row.sort_order = 1 then '42.5' else 'trace' end,
      'note', case when row.sort_order = 1 then 'replay' else null end)
      order by row.sort_order)
     from public.lab_result_entry_rows row where row.workspace_id = v_workspace and row.lab_result_entry_id = v_result.id)
  );
  if v_retry is distinct from (select outcome from public.lab_result_entry_write_requests
                               where workspace_id=v_workspace and request_id='b1111111-1111-4111-8111-111111111111'::uuid) then
    raise exception 'clinical_master_phase1b1_replay_retry_outcome_not_stored';
  end if;
  update public.lab_result_entries set result_status='reviewed' where workspace_id=v_workspace and id=v_result.id;
  v_retry := public.clair_save_lab_result_entry_v2(
    v_workspace, v_actor, v_result.result_id, v_encounter, v_order, null,
    0, 'b1111111-1111-4111-8111-111111111111'::uuid,
    (select jsonb_agg(jsonb_build_object('rowId', row.row_id,
      'value', case when row.sort_order = 1 then '42.5' else 'trace' end,
      'note', case when row.sort_order = 1 then 'replay' else null end)
      order by row.sort_order)
     from public.lab_result_entry_rows row where row.workspace_id = v_workspace and row.lab_result_entry_id = v_result.id)
  );
  if v_retry is distinct from (select outcome from public.lab_result_entry_write_requests
                               where workspace_id=v_workspace and request_id='b1111111-1111-4111-8111-111111111111'::uuid) then
    raise exception 'clinical_master_phase1b1_replay_retry_after_review_not_idempotent';
  end if;
  update public.lab_result_entries set result_status='entered' where workspace_id=v_workspace and id=v_result.id;
  select entry_write_revision into v_result.entry_write_revision from public.lab_result_entries where id = v_result.id;
  if v_result.entry_write_revision <> 1 then raise exception 'clinical_master_phase1b1_replay_result_save_revision'; end if;
  if exists (select 1 from public.lab_result_entry_rows where lab_result_entry_id = v_result.id and judgment <> 'not_judged') then
    raise exception 'clinical_master_phase1b1_replay_result_judgment_mutated';
  end if;

  perform public.clair_sync_fulfillment_work_items_from_orders(v_workspace, v_actor, v_encounter, array[v_order]);
  select item.id into v_work_item from public.order_fulfillment_work_items item
  where item.workspace_id = v_workspace and item.order_id = v_order;
  if v_work_item is null then raise exception 'clinical_master_phase1b1_replay_work_item_missing'; end if;
  perform public.clair_update_fulfillment_work_item(v_workspace, v_actor, v_work_item, 'accepted', null, null);
  perform public.clair_update_fulfillment_work_item(v_workspace, v_actor, v_work_item, 'in_progress', null, null);
  perform public.clair_update_fulfillment_work_item(v_workspace, v_actor, v_work_item, 'completed', null, 'B1 replay');
  perform public.clair_sync_billing_invoice_candidates_from_fulfillment(v_workspace, v_actor, v_encounter, array[v_order]);
  select invoice_line_id into v_invoice_id from public.orders where workspace_id = v_workspace and id = v_order;
  select count(*) into v_invoice_line_count from public.invoice_lines where workspace_id = v_workspace and order_id = v_order;
  if v_invoice_id is null or v_invoice_line_count <> 1 then
    raise exception 'clinical_master_phase1b1_replay_invoice_anchor_invalid';
  end if;

  -- A relation-only source revision must create one durable catalog review
  -- target, preserve the frozen result above, and resolve through the single
  -- authenticated B1 resolver using the stored source projection.
  v_payload := jsonb_set(
    jsonb_set(v_payload, '{releaseKey}', '"phase1b1-lab-fixture-v2"'::jsonb),
    '{labPanelItems,0,displayGroup}', '"chemistry-updated"'::jsonb
  );
  -- Referenced test/specimen owners may be omitted from a later payload. The
  -- panel/order relation owners remain present; the publisher must pin the
  -- already-published immutable referenced versions into their snapshots.
  v_payload := jsonb_set(v_payload, '{records}', (
    select jsonb_agg(value order by value->>'masterKey')
    from jsonb_array_elements(v_payload->'records') records(value)
    where value->>'masterKey' not in ('phase1b1.test.protein','phase1b1.specimen.serum')
  ));
  v_release := private.publish_clinical_master_release(v_payload, v_actor);
  if not exists (
       select 1
       from master.master_record_versions version
       join master.master_records owner on owner.id=version.master_record_id
       cross join lateral jsonb_array_elements(version.snapshot->'labPanelItems') members(value)
       where version.release_id=(v_release->>'releaseId')::uuid
         and owner.master_key='phase1b1.panel.metabolic'
         and members.value->>'testMasterKey'='phase1b1.test.protein'
         and nullif(members.value->>'testMasterRecordId','') is not null
         and nullif(members.value->>'testMasterRevision','')::integer > 0
     )
     or not exists (
       select 1
       from master.master_record_versions version
       join master.master_records owner on owner.id=version.master_record_id
       cross join lateral jsonb_array_elements(version.snapshot->'labOrderProfiles') profiles(value)
       where version.release_id=(v_release->>'releaseId')::uuid
         and owner.master_key='phase1b1.order.metabolic'
         and profiles.value->>'specimenMasterKey'='phase1b1.specimen.serum'
         and nullif(profiles.value->>'specimenMasterRecordId','') is not null
         and nullif(profiles.value->>'specimenMasterRevision','')::integer > 0
     ) then
    raise exception 'clinical_master_phase1b1_replay_omitted_owner_pin_missing';
  end if;
  v_adoption := private.clair_adopt_master_release_to_workspace(v_workspace, (v_release->>'releaseId')::uuid);
  select count(*), (array_agg(id order by id))[1] into v_pending_count, v_update_id
  from public.workspace_lab_catalog_updates
  where workspace_id=v_workspace and order_catalog_item_id=v_catalog_id and status='pending';
  if v_pending_count <> 1 or v_update_id is null then
    raise exception 'clinical_master_phase1b1_replay_review_target_missing:%', v_adoption;
  end if;
  select catalog_revision into v_catalog_revision
  from public.order_catalog_items where workspace_id=v_workspace and id=v_catalog_id;
  v_resolved := public.clair_resolve_workspace_lab_definition_update(
    v_workspace,v_update_id,v_actor,v_catalog_revision,'accept'
  );
  if v_resolved->>'decision' <> 'accept'
     or (select status from public.workspace_lab_catalog_updates where workspace_id=v_workspace and id=v_update_id) <> 'accepted'
     or (select catalog_revision from public.order_catalog_items where workspace_id=v_workspace and id=v_catalog_id) <> v_catalog_revision + 1
     or (select count(*) from public.order_catalog_lab_test_item_links where workspace_id=v_workspace and order_catalog_item_id=v_catalog_id and display_group='chemistry-updated') <> 1 then
    raise exception 'clinical_master_phase1b1_replay_review_resolution_failed:%', v_resolved;
  end if;
  if (select current_revision from master.master_records where master_key='phase1b1.panel.metabolic') <> 2
     or (select current_revision from master.master_records where master_key='phase1b1.order.metabolic') <> 2 then
    raise exception 'clinical_master_phase1b1_replay_relation_owner_revision_failed';
  end if;

  -- A changed shared source test creates one item review target. Acceptance
  -- repins only links whose stored owner pin is the immediately prior
  -- immutable version and advances the workspace item exactly once.
  v_payload := jsonb_set(
    jsonb_set(
      (select payload from clinical_master_phase1b1_fixture limit 1),
      '{releaseKey}', '"phase1b1-lab-fixture-v3"'::jsonb
    ),
    '{labPanelItems,0,displayGroup}', '"chemistry-updated"'::jsonb
  );
  v_payload := jsonb_set(v_payload, '{records}', (
    select jsonb_agg(
      case when value->>'masterKey'='phase1b1.test.glucose'
        then jsonb_set(value, '{names,0,name}', '"혈당 개정"'::jsonb)
        else value end
      order by value->>'masterKey'
    )
    from jsonb_array_elements(v_payload->'records') records(value)
  ));
  v_release := private.publish_clinical_master_release(v_payload, v_actor);

  select item.id,item.workspace_result_revision
    into v_lab_item_id,v_item_revision
  from public.lab_test_items item
  where item.workspace_id=v_workspace
    and item.source_master_record_id=(select id from master.master_records where master_key='phase1b1.test.glucose');
  if v_lab_item_id is null then raise exception 'clinical_master_phase1b1_replay_shared_owner_item_missing'; end if;

  -- Install the second immutable owner before target capture.  Its catalog
  -- has no adopted source projection and its old panel/order version does
  -- not belong to the incoming owner projection, so the item target must not
  -- claim or repin this shared link.
  v_catalog := public.clair_create_order_catalog_item(
    v_workspace,
    jsonb_build_object(
      'id','b1-replay-shared-owner',
      'categoryGroup','lab',
      'standardOrderName','B1 shared owner control',
      'inHospitalOrderName','B1 shared owner control',
      'billingName','B1 shared owner control',
      'priceKrw',0,
      'availabilityStatus','active'
    )
  );
  v_shared_catalog_id := v_catalog->'item'->>'id';
  if v_shared_catalog_id is null then raise exception 'clinical_master_phase1b1_replay_shared_owner_catalog_missing'; end if;
  v_shared_link_id := 'lab-link:v1:' || lower(encode(extensions.digest(convert_to(v_workspace || ':' || v_shared_catalog_id || ':' || v_lab_item_id,'UTF8'),'sha256'),'hex'));
  v_shared_metadata := jsonb_build_object(
    'schemaVersion',2,
    'linkOrigin','clair_master',
    'profileKind','panel',
    'workspaceCatalogItemId',v_shared_catalog_id,
    'masterOrderRecordId',(select id from master.master_records where master_key='phase1b1.order.metabolic'),
    'masterOrderRevision',1,
    'masterPanelRecordId',(select id from master.master_records where master_key='phase1b1.panel.metabolic'),
    'masterPanelRevision',1,
    'masterTestRecordId',(select id from master.master_records where master_key='phase1b1.test.glucose'),
    'ownerPinnedSourceTestRevision',1,
    'itemVersionSourceMasterRecordId',(select source_master_record_id from public.lab_test_item_versions where workspace_id=v_workspace and lab_test_item_id=v_lab_item_id and workspace_result_revision=1),
    'itemVersionSourceTestRevision',(select source_master_revision from public.lab_test_item_versions where workspace_id=v_workspace and lab_test_item_id=v_lab_item_id and workspace_result_revision=1),
    'labTestItemId',v_lab_item_id,
    'pinnedWorkspaceResultRevision',1,
    'sourceOrdinal',0,
    'effectiveSortOrder',0,
    'required',true,
    'displayGroup','shared-owner-control'
  );
  insert into public.order_catalog_lab_test_item_links(
    id,workspace_id,order_catalog_item_id,lab_test_item_id,lab_test_category_id,
    sort_order,link_revision,link_origin,profile_kind,
    source_master_order_record_id,source_master_order_revision,
    source_master_panel_record_id,source_master_panel_revision,
    source_master_test_record_id,owner_pinned_source_test_revision,
    source_ordinal,effective_sort_order,pinned_workspace_result_revision,
    required,display_group,snapshot_metadata,snapshot_metadata_schema_version,
    snapshot_metadata_sha256
  ) values (
    v_shared_link_id,v_workspace,v_shared_catalog_id,v_lab_item_id,
    (select category_id from public.lab_test_items where workspace_id=v_workspace and id=v_lab_item_id),
    0,1,'clair_master','panel',
    (select id from master.master_records where master_key='phase1b1.order.metabolic'),1,
    (select id from master.master_records where master_key='phase1b1.panel.metabolic'),1,
    (select id from master.master_records where master_key='phase1b1.test.glucose'),1,
    0,0,1,true,'shared-owner-control',v_shared_metadata,2,
    private.clinical_master_sha256(v_shared_metadata)
  );
  v_adoption := private.clair_adopt_master_release_to_workspace(v_workspace, (v_release->>'releaseId')::uuid);
  if (select current_revision from master.master_records where master_key='phase1b1.test.glucose') <> 2
     or (select current_revision from master.master_records where master_key='phase1b1.panel.metabolic') <> 3
     or (select current_revision from master.master_records where master_key='phase1b1.order.metabolic') <> 3
     or (select current_revision from master.master_records where master_key='phase1b1.test.protein') <> 1
     or (select current_revision from master.master_records where master_key='phase1b1.specimen.serum') <> 1 then
    raise exception 'clinical_master_phase1b1_replay_omitted_owner_revision_cascade';
  end if;
  select count(*), (array_agg(id order by id))[1]
    into v_pending_count, v_update_id
  from public.workspace_lab_item_updates
  where workspace_id=v_workspace and status='pending';
  if v_pending_count <> 1 or v_update_id is null then
    raise exception 'clinical_master_phase1b1_replay_item_review_target_missing:%', v_adoption;
  end if;
  select count(*), (array_agg(id order by id))[1]
    into v_pending_count, v_catalog_update_id
  from public.workspace_lab_catalog_updates
  where workspace_id=v_workspace and order_catalog_item_id=v_catalog_id and status='pending';
  if v_pending_count <> 1 or v_catalog_update_id is null then
    raise exception 'clinical_master_phase1b1_replay_overlapping_catalog_review_target_missing:%', v_adoption;
  end if;
  -- A newer published source must obsolete the older pending target before
  -- any item/link mutation is allowed.
  v_stale_update_id := v_update_id;
  v_payload := jsonb_set(v_payload, '{releaseKey}', '"phase1b1-lab-fixture-v4-stale-test"'::jsonb);
  v_payload := jsonb_set(v_payload, '{records}', (
    select jsonb_agg(
      case when value->>'masterKey'='phase1b1.test.glucose'
        then jsonb_set(value, '{names,0,name}', '"혈당 2차 개정"'::jsonb)
        else value end
      order by value->>'masterKey'
    )
    from jsonb_array_elements(v_payload->'records') records(value)
    where value->>'masterKey'='phase1b1.test.glucose'
  ));
  v_payload := jsonb_set(v_payload, '{labPanelItems}', '[]'::jsonb);
  v_payload := jsonb_set(v_payload, '{labOrderProfiles}', '[]'::jsonb);
  v_guard_denied := false;
  begin
    v_release := private.publish_clinical_master_release(v_payload, v_actor);
    perform public.clair_resolve_workspace_lab_definition_update(
      v_workspace,v_stale_update_id,v_actor,v_item_revision,'accept'
    );
  exception when others then
    if sqlerrm='lab_update_target_obsolete' then v_guard_denied := true; else raise; end if;
  end;
  if not v_guard_denied then raise exception 'clinical_master_phase1b1_replay_stale_item_target_accepted'; end if;

  -- Exercise item-first and catalog-first acceptance from the same two
  -- durable targets.  The first branch is deliberately rolled back after
  -- recording its complete projection state; the second branch commits the
  -- reverse order and must converge to the exact same state.
  select catalog_revision into v_catalog_revision
  from public.order_catalog_items where workspace_id=v_workspace and id=v_catalog_id;
  begin
    v_resolved := public.clair_resolve_workspace_lab_definition_update(
      v_workspace,v_update_id,v_actor,v_item_revision,'accept'
    );
    select catalog_revision into v_branch_catalog_revision
    from public.order_catalog_items where workspace_id=v_workspace and id=v_catalog_id;
    v_resolved := public.clair_resolve_workspace_lab_definition_update(
      v_workspace,v_catalog_update_id,v_actor,v_branch_catalog_revision,'accept'
    );
    select catalog_revision,last_applied_lab_membership_projection_snapshot,
           last_applied_lab_membership_projection_sha256
      into v_branch_catalog_revision,v_branch_snapshot,v_branch_hash
    from public.order_catalog_items where workspace_id=v_workspace and id=v_catalog_id;
    select workspace_result_revision into v_branch_item_revision
    from public.lab_test_items where workspace_id=v_workspace and id=v_lab_item_id;
    select link_revision into v_branch_link_revision
    from public.order_catalog_lab_test_item_links
    where workspace_id=v_workspace and order_catalog_item_id=v_catalog_id and lab_test_item_id=v_lab_item_id;
    select jsonb_build_object(
             'linkRevision',link.link_revision,
             'ownerPinnedSourceTestRevision',link.owner_pinned_source_test_revision,
             'sourceMasterOrderRevision',link.source_master_order_revision,
             'sourceMasterPanelRevision',link.source_master_panel_revision,
             'pinnedWorkspaceResultRevision',link.pinned_workspace_result_revision,
             'required',link.required,
             'displayGroup',link.display_group,
             'snapshotMetadata',link.snapshot_metadata,
             'snapshotMetadataSha256',link.snapshot_metadata_sha256
           )
      into v_branch_link_snapshot
    from public.order_catalog_lab_test_item_links link
    where link.workspace_id=v_workspace and link.order_catalog_item_id=v_catalog_id and link.lab_test_item_id=v_lab_item_id;
    if (select status from public.workspace_lab_item_updates where workspace_id=v_workspace and id=v_update_id) <> 'accepted'
       or (select status from public.workspace_lab_catalog_updates where workspace_id=v_workspace and id=v_catalog_update_id) <> 'accepted'
       or exists (
         select 1 from public.workspace_lab_item_updates
         where workspace_id=v_workspace and status='pending'
       )
       or exists (
         select 1 from public.workspace_lab_catalog_updates
         where workspace_id=v_workspace and status='pending'
       ) then
      raise exception 'clinical_master_phase1b1_replay_item_review_resolution_failed';
    end if;
    raise exception 'clinical_master_phase1b1_replay_item_first_branch_rollback';
  exception when others then
    if sqlerrm <> 'clinical_master_phase1b1_replay_item_first_branch_rollback' then raise; end if;
  end;

  -- Reverse order: the catalog target may advance the link owner pin before
  -- the item target is accepted.  The item resolver must still select that
  -- exact link from the stored target projection.
  select catalog_revision into v_catalog_revision
  from public.order_catalog_items where workspace_id=v_workspace and id=v_catalog_id;
  v_resolved := public.clair_resolve_workspace_lab_definition_update(
    v_workspace,v_catalog_update_id,v_actor,v_catalog_revision,'accept'
  );
  v_resolved := public.clair_resolve_workspace_lab_definition_update(
    v_workspace,v_update_id,v_actor,v_item_revision,'accept'
  );
  if v_resolved->>'decision' <> 'accept'
     or (select status from public.workspace_lab_item_updates where workspace_id=v_workspace and id=v_update_id) <> 'accepted'
     or (select status from public.workspace_lab_catalog_updates where workspace_id=v_workspace and id=v_catalog_update_id) <> 'accepted'
     or (select workspace_result_revision from public.lab_test_items where workspace_id=v_workspace and id=v_lab_item_id) <> v_branch_item_revision
     or (select catalog_revision from public.order_catalog_items where workspace_id=v_workspace and id=v_catalog_id) <> v_branch_catalog_revision
     or (select last_applied_lab_membership_projection_snapshot from public.order_catalog_items where workspace_id=v_workspace and id=v_catalog_id) is distinct from v_branch_snapshot
     or (select last_applied_lab_membership_projection_sha256 from public.order_catalog_items where workspace_id=v_workspace and id=v_catalog_id) is distinct from v_branch_hash
     or (select link_revision from public.order_catalog_lab_test_item_links where workspace_id=v_workspace and order_catalog_item_id=v_catalog_id and lab_test_item_id=v_lab_item_id) <> v_branch_link_revision
     or (select jsonb_build_object(
               'linkRevision',link.link_revision,
               'ownerPinnedSourceTestRevision',link.owner_pinned_source_test_revision,
               'sourceMasterOrderRevision',link.source_master_order_revision,
               'sourceMasterPanelRevision',link.source_master_panel_revision,
               'pinnedWorkspaceResultRevision',link.pinned_workspace_result_revision,
               'required',link.required,
               'displayGroup',link.display_group,
               'snapshotMetadata',link.snapshot_metadata,
               'snapshotMetadataSha256',link.snapshot_metadata_sha256
             )
         from public.order_catalog_lab_test_item_links link
         where link.workspace_id=v_workspace and link.order_catalog_item_id=v_catalog_id and link.lab_test_item_id=v_lab_item_id) is distinct from v_branch_link_snapshot
     or exists (
       select 1
       from public.order_catalog_lab_test_item_links link
       where link.workspace_id=v_workspace and link.order_catalog_item_id=v_catalog_id
         and link.lab_test_item_id=v_lab_item_id
         and (
           link.owner_pinned_source_test_revision <> (select source_owner_revision from public.workspace_lab_item_updates where workspace_id=v_workspace and id=v_update_id)
           or nullif(link.snapshot_metadata->>'ownerPinnedSourceTestRevision','')::integer is distinct from link.owner_pinned_source_test_revision
           or nullif(link.snapshot_metadata->>'masterOrderRevision','')::integer is distinct from link.source_master_order_revision
           or nullif(link.snapshot_metadata->>'masterPanelRevision','')::integer is distinct from link.source_master_panel_revision
           or link.snapshot_metadata_sha256 is distinct from private.clinical_master_sha256(link.snapshot_metadata)
         )
     )
     or exists (
       select 1 from public.workspace_lab_item_updates
       where workspace_id=v_workspace and status='pending'
     )
     or exists (
       select 1 from public.workspace_lab_catalog_updates
       where workspace_id=v_workspace and status='pending'
     ) then
    raise exception 'clinical_master_phase1b1_replay_overlapping_target_resolution_failed:%', v_resolved;
  end if;
  v_retry := public.clair_save_chart_order_action(v_workspace,v_actor,v_encounter,'confirm',array[v_order]);
  if not exists (
    select 1 from jsonb_array_elements(v_retry) result(value)
    where result.value->>'status'='confirmed'
  ) then
    raise exception 'clinical_master_phase1b1_replay_confirmation_after_overlap_failed:%', v_retry;
  end if;
  if (select owner_pinned_source_test_revision from public.order_catalog_lab_test_item_links where workspace_id=v_workspace and id=v_shared_link_id) <> 1
     or (select pinned_workspace_result_revision from public.order_catalog_lab_test_item_links where workspace_id=v_workspace and id=v_shared_link_id) <> 1
     or (select link_revision from public.order_catalog_lab_test_item_links where workspace_id=v_workspace and id=v_shared_link_id) <> 1
     or (select nullif(snapshot_metadata->>'ownerPinnedSourceTestRevision','')::integer from public.order_catalog_lab_test_item_links where workspace_id=v_workspace and id=v_shared_link_id) is distinct from (select owner_pinned_source_test_revision from public.order_catalog_lab_test_item_links where workspace_id=v_workspace and id=v_shared_link_id)
     or (select nullif(snapshot_metadata->>'masterOrderRevision','')::integer from public.order_catalog_lab_test_item_links where workspace_id=v_workspace and id=v_shared_link_id) is distinct from (select source_master_order_revision from public.order_catalog_lab_test_item_links where workspace_id=v_workspace and id=v_shared_link_id)
     or (select nullif(snapshot_metadata->>'masterPanelRevision','')::integer from public.order_catalog_lab_test_item_links where workspace_id=v_workspace and id=v_shared_link_id) is distinct from (select source_master_panel_revision from public.order_catalog_lab_test_item_links where workspace_id=v_workspace and id=v_shared_link_id)
     or (select snapshot_metadata_sha256 from public.order_catalog_lab_test_item_links where workspace_id=v_workspace and id=v_shared_link_id) is distinct from private.clinical_master_sha256((select snapshot_metadata from public.order_catalog_lab_test_item_links where workspace_id=v_workspace and id=v_shared_link_id)) then
    raise exception 'clinical_master_phase1b1_replay_shared_owner_repin_leaked';
  end if;
  -- The immutable test version must remain authoritative even if a mutable
  -- typed vocabulary row is changed after the result was frozen.
  update master.result_input_types
  set value_kind='text'
  where master_record_id=(select id from master.master_records where master_key='phase1b1.input.numeric');
  v_projection := private.clinical_master_lab_test_projection(
    (select id from master.master_records where master_key='phase1b1.test.glucose'), 2
  );
  if v_projection->>'resultValueKind' <> 'numeric' then
    raise exception 'clinical_master_phase1b1_replay_immutable_vocabulary_snapshot_changed';
  end if;
  if (select result_definition_snapshot_sha256 from public.lab_result_entries where workspace_id=v_workspace and id=v_result.id)
     is distinct from v_result.result_definition_snapshot_sha256 then
    raise exception 'clinical_master_phase1b1_replay_historical_result_snapshot_changed';
  end if;

  if has_table_privilege('authenticated', 'public.lab_result_entries', 'SELECT')
     or has_table_privilege('authenticated', 'public.lab_result_entry_rows', 'INSERT') then
    raise exception 'clinical_master_phase1b1_replay_direct_result_privilege_leaked';
  end if;
  if (select count(*) from public.orders where workspace_id = v_workspace and id = v_order) <> 1
     or (select count(*) from public.lab_result_entries where workspace_id = v_workspace and order_id = v_order) <> 1
     or (select count(*) from public.order_fulfillment_work_items where workspace_id = v_workspace and order_id = v_order) <> 1 then
    raise exception 'clinical_master_phase1b1_replay_single_unit_invariant_failed';
  end if;

  -- A source test change and an independent catalog projection can overlap
  -- while the catalog projection removes that test. The item target retains the
  -- authored reference, but item-first leaves deletion and the one catalog
  -- revision to the independent catalog target.
  v_payload := jsonb_set(
    (select payload from clinical_master_phase1b1_fixture limit 1),
    '{releaseKey}', '"phase1b1-lab-fixture-v5-member-removal"'::jsonb
  );
  v_payload := jsonb_set(v_payload, '{records}', (
    select jsonb_agg(
      case when value->>'masterKey'='phase1b1.test.glucose'
        then jsonb_set(value, '{names,0,name}', '"혈당 제거 동시 개정"'::jsonb)
        else value end
      order by value->>'masterKey'
    )
    from jsonb_array_elements(v_payload->'records') records(value)
  ));
  v_payload := jsonb_set(v_payload, '{labPanelItems}', (
    select coalesce(jsonb_agg(value order by (value->>'sortOrder')::integer,value->>'testMasterKey'),'[]'::jsonb)
    from jsonb_array_elements(v_payload->'labPanelItems') members(value)
    where value->>'testMasterKey' <> 'phase1b1.test.glucose'
  ));
  v_release := private.publish_clinical_master_release(v_payload, v_actor);
  v_adoption := private.clair_adopt_master_release_to_workspace(v_workspace, (v_release->>'releaseId')::uuid);
  select workspace_result_revision into v_item_revision
  from public.lab_test_items where workspace_id=v_workspace and id=v_lab_item_id;
  select catalog_revision into v_catalog_revision
  from public.order_catalog_items where workspace_id=v_workspace and id=v_catalog_id;
  select count(*),(array_agg(id order by id))[1]
    into v_pending_count,v_update_id
  from public.workspace_lab_item_updates
  where workspace_id=v_workspace and source_release_id=(v_release->>'releaseId')::uuid and status='pending';
  if v_pending_count <> 1 or v_update_id is null
     or not exists (
       select 1 from public.workspace_lab_item_updates item_update
       where item_update.workspace_id=v_workspace and item_update.id=v_update_id
         and v_catalog_id=any(item_update.affected_catalog_item_ids)
     ) then
    raise exception 'clinical_master_phase1b1_replay_member_removal_item_target_missing:%',v_adoption;
  end if;
  select count(*),(array_agg(id order by id))[1]
    into v_pending_count,v_catalog_update_id
  from public.workspace_lab_catalog_updates
  where workspace_id=v_workspace and source_release_id=(v_release->>'releaseId')::uuid
    and order_catalog_item_id=v_catalog_id and status='pending';
  if v_pending_count <> 1 or v_catalog_update_id is null
     or exists (
       select 1
       from jsonb_array_elements(coalesce((select source_membership_projection_snapshot from public.workspace_lab_catalog_updates where id=v_catalog_update_id)->'members','[]'::jsonb)) members(value)
       where members.value->>'labTestItemId'=v_lab_item_id
     ) then
    raise exception 'clinical_master_phase1b1_replay_member_removal_catalog_target_missing:%',v_adoption;
  end if;

  -- Item-first: the item revision advances, but the removed link and catalog
  -- revision remain unchanged until the independent membership target accepts.
  begin
    v_resolved := public.clair_resolve_workspace_lab_definition_update(
      v_workspace,v_update_id,v_actor,v_item_revision,'accept'
    );
    if (select catalog_revision from public.order_catalog_items where workspace_id=v_workspace and id=v_catalog_id) <> v_catalog_revision then
      raise exception 'clinical_master_phase1b1_replay_member_removal_item_first_catalog_revision_changed';
    end if;
    v_resolved := public.clair_resolve_workspace_lab_definition_update(
      v_workspace,v_catalog_update_id,v_actor,v_catalog_revision,'accept'
    );
    select catalog_revision,last_applied_lab_membership_projection_snapshot,
           last_applied_lab_membership_projection_sha256
      into v_branch_catalog_revision,v_branch_snapshot,v_branch_hash
    from public.order_catalog_items where workspace_id=v_workspace and id=v_catalog_id;
    select workspace_result_revision into v_branch_item_revision
    from public.lab_test_items where workspace_id=v_workspace and id=v_lab_item_id;
    select coalesce(jsonb_agg(jsonb_build_object(
             'id',link.id,'labTestItemId',link.lab_test_item_id,
             'linkRevision',link.link_revision,
             'ownerPinnedSourceTestRevision',link.owner_pinned_source_test_revision,
             'sourceMasterOrderRevision',link.source_master_order_revision,
             'sourceMasterPanelRevision',link.source_master_panel_revision,
             'pinnedWorkspaceResultRevision',link.pinned_workspace_result_revision,
             'snapshotMetadata',link.snapshot_metadata,
             'snapshotMetadataSha256',link.snapshot_metadata_sha256
           ) order by link.id),'[]'::jsonb)
      into v_branch_link_snapshot
    from public.order_catalog_lab_test_item_links link
    where link.workspace_id=v_workspace and link.order_catalog_item_id=v_catalog_id;
    if exists (
         select 1 from public.order_catalog_lab_test_item_links
         where workspace_id=v_workspace and order_catalog_item_id=v_catalog_id and lab_test_item_id=v_lab_item_id
       )
       or jsonb_array_length(coalesce(v_branch_snapshot->'members','[]'::jsonb)) <> 1
       or exists (select 1 from public.workspace_lab_item_updates where workspace_id=v_workspace and source_release_id=(v_release->>'releaseId')::uuid and status='pending')
       or exists (select 1 from public.workspace_lab_catalog_updates where workspace_id=v_workspace and source_release_id=(v_release->>'releaseId')::uuid and status='pending') then
      raise exception 'clinical_master_phase1b1_replay_member_removal_item_first_not_consumed';
    end if;
    raise exception 'clinical_master_phase1b1_replay_member_removal_item_first_branch_rollback';
  exception when others then
    if sqlerrm <> 'clinical_master_phase1b1_replay_member_removal_item_first_branch_rollback' then raise; end if;
  end;

  -- Catalog-first must converge to the exact item/link/catalog state.
  v_resolved := public.clair_resolve_workspace_lab_definition_update(
    v_workspace,v_catalog_update_id,v_actor,v_catalog_revision,'accept'
  );
  v_resolved := public.clair_resolve_workspace_lab_definition_update(
    v_workspace,v_update_id,v_actor,v_item_revision,'accept'
  );
  if (select catalog_revision from public.order_catalog_items where workspace_id=v_workspace and id=v_catalog_id) <> v_branch_catalog_revision
     or (select workspace_result_revision from public.lab_test_items where workspace_id=v_workspace and id=v_lab_item_id) <> v_branch_item_revision
     or (select last_applied_lab_membership_projection_snapshot from public.order_catalog_items where workspace_id=v_workspace and id=v_catalog_id) is distinct from v_branch_snapshot
     or (select last_applied_lab_membership_projection_sha256 from public.order_catalog_items where workspace_id=v_workspace and id=v_catalog_id) is distinct from v_branch_hash
     or (select coalesce(jsonb_agg(jsonb_build_object(
             'id',link.id,'labTestItemId',link.lab_test_item_id,
             'linkRevision',link.link_revision,
             'ownerPinnedSourceTestRevision',link.owner_pinned_source_test_revision,
             'sourceMasterOrderRevision',link.source_master_order_revision,
             'sourceMasterPanelRevision',link.source_master_panel_revision,
             'pinnedWorkspaceResultRevision',link.pinned_workspace_result_revision,
             'snapshotMetadata',link.snapshot_metadata,
             'snapshotMetadataSha256',link.snapshot_metadata_sha256
           ) order by link.id),'[]'::jsonb)
         from public.order_catalog_lab_test_item_links link
         where link.workspace_id=v_workspace and link.order_catalog_item_id=v_catalog_id) is distinct from v_branch_link_snapshot
     or exists (select 1 from public.order_catalog_lab_test_item_links where workspace_id=v_workspace and order_catalog_item_id=v_catalog_id and lab_test_item_id=v_lab_item_id)
     or exists (select 1 from public.workspace_lab_item_updates where workspace_id=v_workspace and source_release_id=(v_release->>'releaseId')::uuid and status='pending')
     or exists (select 1 from public.workspace_lab_catalog_updates where workspace_id=v_workspace and source_release_id=(v_release->>'releaseId')::uuid and status='pending') then
    raise exception 'clinical_master_phase1b1_replay_member_removal_order_convergence_failed:%',v_resolved;
  end if;
  v_retry := public.clair_save_chart_order_action(v_workspace,v_actor,v_encounter,'confirm',array[v_order]);
  if not exists (
    select 1 from jsonb_array_elements(v_retry) result(value)
    where result.value->>'status'='confirmed'
  ) then
    raise exception 'clinical_master_phase1b1_replay_member_removal_confirmation_failed:%',v_retry;
  end if;

  -- Item CAS: an explicit empty target set creates a new workspace version but
  -- repins zero links; a later explicit target refreshes that link's metadata
  -- hash and pin only.
  select link.lab_test_item_id,link.id into v_lab_item_id,v_lab_link_id
  from public.order_catalog_lab_test_item_links link
  where link.workspace_id=v_workspace and link.order_catalog_item_id=v_catalog_id
  order by link.effective_sort_order desc,link.id
  limit 1;
  select workspace_result_revision into v_item_revision
  from public.lab_test_items where workspace_id=v_workspace and id=v_lab_item_id;
  perform public.clair_update_workspace_lab_test_item(
    v_workspace,v_lab_item_id,v_actor,v_item_revision,null,'customize',
    jsonb_build_object('displayName','단백질 메모 v2','inputType','text','resultValueKind','text','unit',null,'decimalScale',null),
    '{}'::text[]
  );
  select workspace_result_revision into v_item_revision
  from public.lab_test_items where workspace_id=v_workspace and id=v_lab_item_id;
  if v_item_revision <> 2
     or (select pinned_workspace_result_revision from public.order_catalog_lab_test_item_links where workspace_id=v_workspace and id=v_lab_link_id) <> 1 then
    raise exception 'clinical_master_phase1b1_replay_empty_target_repin_failed';
  end if;
  perform public.clair_update_workspace_lab_test_item(
    v_workspace,v_lab_item_id,v_actor,v_item_revision,null,'customize',
    jsonb_build_object('displayName','단백질 메모 v3','inputType','text','resultValueKind','text','unit',null,'decimalScale',null),
    array[v_lab_link_id]
  );
  select workspace_result_revision into v_item_revision
  from public.lab_test_items where workspace_id=v_workspace and id=v_lab_item_id;
  select link_revision into v_link_revision
  from public.order_catalog_lab_test_item_links where workspace_id=v_workspace and id=v_lab_link_id;
  if v_item_revision <> 3
     or v_link_revision <> 2
     or (select pinned_workspace_result_revision from public.order_catalog_lab_test_item_links where workspace_id=v_workspace and id=v_lab_link_id) <> 3
     or (select snapshot_metadata_sha256 from public.order_catalog_lab_test_item_links where workspace_id=v_workspace and id=v_lab_link_id) is distinct from private.clinical_master_sha256((select snapshot_metadata from public.order_catalog_lab_test_item_links where workspace_id=v_workspace and id=v_lab_link_id)) then
    raise exception 'clinical_master_phase1b1_replay_targeted_metadata_refresh_failed';
  end if;
  -- A vocabulary-only change must flow through the effective dependency pass
  -- before the panel/order relation snapshots are recomputed.
  v_payload := jsonb_set(
    (select payload from clinical_master_phase1b1_fixture limit 1),
    '{releaseKey}', '"phase1b1-lab-fixture-v4"'::jsonb
  );
  v_payload := jsonb_set(v_payload, '{records}', (
    select jsonb_agg(
      case
        when value->>'masterKey'='phase1b1.test.glucose' then jsonb_set(value, '{names,0,name}', '"혈당 개정"'::jsonb)
        when value->>'masterKey'='phase1b1.unit.mgdl' then jsonb_set(value, '{detail,decimalScale}', '2'::jsonb)
        else value
      end order by value->>'masterKey'
    )
    from jsonb_array_elements(v_payload->'records') records(value)
  ));
  v_release := private.publish_clinical_master_release(v_payload, v_actor);
  if (select current_revision from master.master_records where master_key='phase1b1.unit.mgdl') <> 2
     or (select current_revision from master.master_records where master_key='phase1b1.test.glucose') <> 4
     or (select current_revision from master.master_records where master_key='phase1b1.panel.metabolic') <> 5
     or (select current_revision from master.master_records where master_key='phase1b1.order.metabolic') <> 5 then
    raise exception 'clinical_master_phase1b1_replay_vocabulary_revision_cascade_failed';
  end if;

  insert into clinical_master_phase1b1_replay_state values
    ('release', v_release),
    ('adoption', v_adoption),
    ('confirm', v_confirm),
    ('resultEntryId', to_jsonb(v_result.id)),
    ('workItemId', to_jsonb(v_work_item)),
    ('invoiceLineId', to_jsonb(v_invoice_id));
end
$replay$;

select state_key, state_value
from clinical_master_phase1b1_replay_state
order by state_key;

rollback;

select 'clinical_master_phase1b1_replay_cleanup_ok' as replay_result;
