\set ON_ERROR_STOP on

begin;

\ir ../migrations/20260826150000_clinical_master_dispensing_order_foundation.sql
\ir ../migrations/20260826152000_clinical_master_dispensing_fulfillment_history.sql

do $replay$
declare
  v_release_id uuid;
  v_path_id uuid;
  v_species_id uuid;
  v_species_code text;
  v_override_species_code text;
  v_override_encounter_id uuid;
  v_reviewer_id uuid;
  v_non_veterinarian_id uuid;
  v_workspace_id text;
  v_encounter_id uuid;
  v_pending_allowed boolean;
  v_approved_allowed boolean;
  v_error text;
  v_sqlstate text;
  v_table text;
begin
  select id into strict v_release_id
  from master.master_releases
  order by release_no
  limit 1;

  select path.id into strict v_path_id
  from master.classification_paths path
  join master.task_routes route on route.master_record_id = path.task_route_id
  where route.destination_module = 'dispensing'
    and route.task_required
    and route.runtime_status = 'active'
  order by path.path_key
  limit 1;

  select species.master_record_id, species.species_code
  into strict v_species_id, v_species_code
  from master.species species
  order by species.species_code
  limit 1;

  select encounter.workspace_id, encounter.id
  into strict v_workspace_id, v_encounter_id
  from public.encounters encounter
  join public.patients patient
    on patient.workspace_id = encounter.workspace_id
   and patient.id = encounter.patient_id
  where patient.species = v_species_code
  order by encounter.workspace_id, encounter.id
  limit 1;

  select patient.species, encounter.id
  into v_override_species_code, v_override_encounter_id
  from public.encounters encounter
  join public.patients patient
    on patient.workspace_id = encounter.workspace_id
   and patient.id = encounter.patient_id
  where encounter.workspace_id = v_workspace_id
    and patient.species <> v_species_code
  order by patient.species, encounter.id
  limit 1;
  if v_override_species_code is null then
    raise exception 'clinical_master_dispensing_species_override_fixture_missing';
  end if;

  select membership.user_id
  into strict v_reviewer_id
  from public.user_memberships membership
  where membership.workspace_id = v_workspace_id
    and membership.status = 'active'
    and private.clair_is_active_veterinarian_member(
      membership.workspace_id,
      membership.user_id
    )
  order by membership.user_id
  limit 1;

  select membership.user_id
  into strict v_non_veterinarian_id
  from public.user_memberships membership
  where membership.workspace_id = v_workspace_id
    and membership.status = 'active'
    and not private.clair_is_active_veterinarian_member(
      membership.workspace_id,
      membership.user_id
    )
  order by membership.user_id
  limit 1;

  perform pg_catalog.set_config(
    'request.jwt.claim.sub',
    v_reviewer_id::text,
    true
  );

  if not private.clair_order_detail_inputs_are_valid(
    'dispensing',
    1,
    pg_catalog.jsonb_build_object(
      'doseBasis', 'patient',
      'dose', 1,
      'doseUnit', 'mg',
      'route', 'PO',
      'frequency', 'once',
      'durationDays', 1,
      'totalQuantity', 1,
      'extraLabelSpeciesConfirmed', true,
      'extraLabelSpeciesReason', '병원 수의사 판단에 따른 종 범위 확장 재현'
    ),
    true
  ) then
    raise exception 'clinical_master_dispensing_extra_label_detail_schema_rejected';
  end if;

  set constraints all deferred;

  insert into master.master_records (
    id, master_key, record_type, lifecycle_status, safety_status,
    current_revision, current_release_id, published_at
  ) values
    ('01700000-0000-4000-8000-000000000001', 'replay.dispensing.pending', 'order', 'published', 'normal', 1, v_release_id, now()),
    ('01700000-0000-4000-8000-000000000002', 'replay.dispensing.approved', 'order', 'published', 'normal', 1, v_release_id, now());

  insert into master.master_record_versions (
    master_record_id, revision, release_id, snapshot, change_summary, authored_by_label
  ) values
    ('01700000-0000-4000-8000-000000000001', 1, v_release_id, '{"schemaVersion":1,"name":"pending"}', 'PR-017 rollback replay', 'Codex local replay'),
    ('01700000-0000-4000-8000-000000000002', 1, v_release_id, '{"schemaVersion":1,"name":"approved"}', 'PR-017 rollback replay', 'Codex local replay');

  insert into master.orders (
    master_record_id, classification_path_id, default_billing_reflection_enabled, default_quantity
  ) values
    ('01700000-0000-4000-8000-000000000001', v_path_id, true, 1),
    ('01700000-0000-4000-8000-000000000002', v_path_id, true, 1);

  insert into master.medication_ingredients (
    id, ingredient_key, revision, normalized_english_name, korean_name,
    korean_review_status, lifecycle_status, source_release_id
  ) values (
    '01710000-0000-4000-8000-000000000001', 'replay-ingredient', 1,
    'Replay ingredient', '재현 성분', 'approved', 'approved', v_release_id
  );

  insert into master.evidence_documents (
    id, document_key, revision, authority, jurisdiction, document_type,
    source_uri, content_sha256, accessed_at, lifecycle_status, source_release_id
  ) values (
    '01720000-0000-4000-8000-000000000001', 'replay-evidence', 1,
    'VMD', 'GB', 'spc', 'https://example.invalid/replay-spc', repeat('a', 64),
    current_date, 'captured', v_release_id
  );

  insert into master.medication_products (
    id, product_key, revision, authority, source_jurisdiction, source_product_id,
    english_product_name, korean_draft_name, korean_review_status, dosage_form,
    routes, strength_snapshot, coverage_category, lifecycle_status, source_release_id
  ) values (
    '01730000-0000-4000-8000-000000000001', 'replay-product', 1,
    'VMD', 'GB', 'replay-product-1', 'Replay product', '재현 제품', 'approved',
    'tablet', array['oral','otic'], '[{"value":10,"unit":"mg"}]', 'replay', 'approved', v_release_id
  );

  insert into master.medication_product_ingredients (
    product_id, product_revision, ingredient_id, ingredient_revision, ordinal,
    strength_kind, numerator_value, numerator_unit, evidence_mode, pairing_status,
    source_release_id
  ) values (
    '01730000-0000-4000-8000-000000000001', 1,
    '01710000-0000-4000-8000-000000000001', 1, 1,
    'presentation', 10, 'mg', 'direct', 'approved', v_release_id
  );

  insert into master.medication_species_applicability (
    product_id, product_revision, species_record_id, evidence_mode, review_status, source_release_id
  ) values (
    '01730000-0000-4000-8000-000000000001', 1, v_species_id,
    'direct', 'approved', v_release_id
  );

  insert into master.medication_product_handling (
    product_id, product_revision, storage_codes, extraction_status, source_release_id
  ) values (
    '01730000-0000-4000-8000-000000000001', 1,
    array['store_below_25c'], 'approved', v_release_id
  );

  insert into master.dispensing_order_profiles (
    id, profile_key, profile_revision, order_record_id, order_record_revision,
    product_id, product_revision, allowed_routes, korean_translation_review_status,
    evidence_fingerprint, lifecycle_status, source_release_id
  ) values
    (
      '01740000-0000-4000-8000-000000000001', 'replay-profile-pending', 1,
      '01700000-0000-4000-8000-000000000001', 1,
      '01730000-0000-4000-8000-000000000001', 1, array['oral'], 'pending',
      repeat('b', 64), 'clinical_review_pending', v_release_id
    ),
    (
      '01740000-0000-4000-8000-000000000002', 'replay-profile-approved', 1,
      '01700000-0000-4000-8000-000000000002', 1,
      '01730000-0000-4000-8000-000000000001', 1, array['oral'], 'approved',
      repeat('c', 64), 'approved', v_release_id
    );

  insert into master.evidence_assertions (
    assertion_key, product_id, product_revision, field_path, evidence_document_id,
    evidence_document_revision, evidence_mode, locator, extraction_status, source_release_id
  )
  select
    'replay-assertion-' || required.field_path,
    '01730000-0000-4000-8000-000000000001', 1, required.field_path,
    '01720000-0000-4000-8000-000000000001', 1, 'direct',
    'rollback replay locator', 'approved', v_release_id
  from (values
    ('product.identity'),
    ('product.strength'),
    ('product.dosageForm'),
    ('product.route'),
    ('product.targetSpecies'),
    ('handling.storage')
  ) required(field_path);

  insert into master.clinical_reviews (
    id, review_key, dispensing_profile_id, dispensing_profile_revision, decision,
    reviewer_user_id, reviewer_eligibility, decision_reason, reviewed_at, source_release_id
  ) values (
    '01750000-0000-4000-8000-000000000001', 'replay-review-approved',
    '01740000-0000-4000-8000-000000000002', 1, 'approved', v_reviewer_id,
    '{"eligible":true,"basis":"local_rollback_replay"}',
    'Local rollback-only gate verification', now(), v_release_id
  );

  insert into master.medication_regulatory_profiles (
    id, regulatory_key, revision, product_id, product_revision, jurisdiction,
    authorization_status, controlled_status, policy_version, review_status,
    reviewer_user_id, reviewed_at, source_release_id
  ) values (
    '01760000-0000-4000-8000-000000000001', 'replay-regulatory-kr', 1,
    '01730000-0000-4000-8000-000000000001', 1, 'KR', 'approved',
    'not_controlled', 'local-replay-only', 'approved', v_reviewer_id, now(), v_release_id
  );

  v_pending_allowed := master.clair_dispensing_profile_clinical_use_allowed(
    '01740000-0000-4000-8000-000000000001', 1
  );
  if v_pending_allowed then
    raise exception 'clinical_master_dispensing_pending_profile_gate_unexpectedly_open';
  end if;

  v_approved_allowed := master.clair_dispensing_profile_clinical_use_allowed(
    '01740000-0000-4000-8000-000000000002', 1
  );
  if not v_approved_allowed then
    raise exception 'clinical_master_dispensing_approved_profile_gate_closed';
  end if;

  begin
    insert into master.medication_ingredients (
      id, ingredient_key, revision, normalized_english_name, korean_name,
      korean_review_status, lifecycle_status, source_release_id
    ) values (
      '01710000-0000-4000-8000-000000000002', 'replay-ingredient-pending', 1,
      'Replay pending ingredient', '재현 미검토 성분', 'pending',
      'clinical_review_pending', v_release_id
    );
    insert into master.medication_product_ingredients (
      product_id, product_revision, ingredient_id, ingredient_revision, ordinal,
      strength_kind, numerator_value, numerator_unit, evidence_mode, pairing_status,
      source_release_id
    ) values (
      '01730000-0000-4000-8000-000000000001', 1,
      '01710000-0000-4000-8000-000000000002', 1, 2,
      'presentation', 5, 'mg', 'inferred', 'manual_review_required', v_release_id
    );
    if master.clair_dispensing_profile_clinical_use_allowed(
      '01740000-0000-4000-8000-000000000002', 1
    ) then
      raise exception 'clinical_master_dispensing_partial_ingredient_review_accepted';
    end if;
    raise exception 'clinical_master_dispensing_partial_ingredient_replay_rollback';
  exception when others then
    get stacked diagnostics v_error = message_text;
    if v_error = 'clinical_master_dispensing_partial_ingredient_review_accepted' then
      raise;
    elsif v_error <> 'clinical_master_dispensing_partial_ingredient_replay_rollback' then
      raise;
    end if;
  end;

  begin
    insert into master.medication_regulatory_profiles (
      id, regulatory_key, revision, product_id, product_revision, jurisdiction,
      authorization_status, controlled_status, policy_version, review_status,
      source_release_id
    ) values (
      '01760000-0000-4000-8000-000000000002', 'replay-regulatory-kr', 2,
      '01730000-0000-4000-8000-000000000001', 1, 'KR', 'rejected',
      'controlled', 'local-replay-only-v2', 'pending', v_release_id
    );
    if master.clair_dispensing_profile_clinical_use_allowed(
      '01740000-0000-4000-8000-000000000002', 1
    ) then
      raise exception 'clinical_master_dispensing_stale_regulatory_approval_accepted';
    end if;
    raise exception 'clinical_master_dispensing_latest_regulatory_replay_rollback';
  exception when others then
    get stacked diagnostics v_error = message_text;
    if v_error = 'clinical_master_dispensing_stale_regulatory_approval_accepted' then
      raise;
    elsif v_error <> 'clinical_master_dispensing_latest_regulatory_replay_rollback' then
      raise;
    end if;
  end;

  with snapshot as (
    select jsonb_build_object(
      'sourceDispensingProfileId', '01740000-0000-4000-8000-000000000001',
      'sourceDispensingProfileRevision', 1,
      'sourceMedicationProductId', '01730000-0000-4000-8000-000000000001',
      'sourceMedicationProductRevision', 1,
      'routes', jsonb_build_array('oral'),
      'targetSpecies', jsonb_build_array(v_species_code)
    ) as value
  )
  insert into public.order_catalog_items (
    id, workspace_id, standard_order_id, source_preset_version, category_group,
    category_label, standard_order_name, in_hospital_order_name, billing_name,
    availability_status, price_krw, sales_unit, target_species,
    default_destination_module, default_task_required, billing_reflection_enabled,
    customization_state, preset_merge_status, origin_type, source_master_record_id,
    source_master_revision, initial_imported_revision, last_auto_merged_revision,
    classification_path_id, source_projection_snapshot, source_projection_fingerprint,
    source_dispensing_profile_id, source_dispensing_profile_revision,
    dispensing_profile_snapshot, dispensing_profile_snapshot_sha256
  )
  select
    'pr017-replay-pending', v_workspace_id, 'pr017-replay-pending', 'pr017-replay-v1',
    'medication', '조제', '재현 대기 제품', '재현 대기 제품', '재현 대기 제품',
    'pending_activation', 1000, 'per_each', array[v_species_code], 'dispensing', true, true,
    'unmodified', 'current', 'clair_master',
    '01700000-0000-4000-8000-000000000001', 1, 1, 1, v_path_id,
    '{"schemaVersion":1,"source":"pr017-replay"}', repeat('d', 64),
    '01740000-0000-4000-8000-000000000001', 1,
    snapshot.value, private.clinical_master_sha256(snapshot.value)
  from snapshot;

  if (select clinical_use_allowed from public.order_catalog_items where id = 'pr017-replay-pending') then
    raise exception 'clinical_master_dispensing_pending_catalog_became_clinically_allowed';
  end if;

  begin
    update public.order_catalog_items
    set availability_status = 'active'
    where id = 'pr017-replay-pending';
    raise exception 'clinical_master_dispensing_pending_activation_accepted';
  exception when others then
    get stacked diagnostics v_error = message_text, v_sqlstate = returned_sqlstate;
    if v_error <> 'clinical_master_dispensing_clinical_review_required' or v_sqlstate <> '42501' then
      raise;
    end if;
  end;

  begin
    update public.order_catalog_items
    set dispensing_profile_snapshot_sha256 = repeat('f', 64)
    where id = 'pr017-replay-pending';
    raise exception 'clinical_master_dispensing_tampered_snapshot_accepted';
  exception when others then
    get stacked diagnostics v_error = message_text, v_sqlstate = returned_sqlstate;
    if v_error <> 'clinical_master_dispensing_snapshot_fingerprint_mismatch' or v_sqlstate <> '23514' then
      raise;
    end if;
  end;

  with snapshot as (
    select jsonb_build_object(
      'sourceDispensingProfileId', '01740000-0000-4000-8000-000000000002',
      'sourceDispensingProfileRevision', 1,
      'sourceMedicationProductId', '01730000-0000-4000-8000-000000000001',
      'sourceMedicationProductRevision', 1,
      'routes', jsonb_build_array('oral'),
      'targetSpecies', jsonb_build_array(v_species_code)
    ) as value
  )
  insert into public.order_catalog_items (
    id, workspace_id, standard_order_id, source_preset_version, category_group,
    category_label, standard_order_name, in_hospital_order_name, billing_name,
    availability_status, price_krw, sales_unit, target_species,
    default_destination_module, default_task_required, billing_reflection_enabled,
    customization_state, preset_merge_status, origin_type, source_master_record_id,
    source_master_revision, initial_imported_revision, last_auto_merged_revision,
    classification_path_id, source_projection_snapshot, source_projection_fingerprint,
    source_dispensing_profile_id, source_dispensing_profile_revision,
    dispensing_profile_snapshot, dispensing_profile_snapshot_sha256
  )
  select
    'pr017-replay-approved', v_workspace_id, 'pr017-replay-approved', 'pr017-replay-v1',
    'medication', '조제', '재현 승인 제품', '재현 승인 제품', '재현 승인 제품',
    'active', 1000, 'per_each', array[v_species_code], 'dispensing', true, true,
    'unmodified', 'current', 'clair_master',
    '01700000-0000-4000-8000-000000000002', 1, 1, 1, v_path_id,
    '{"schemaVersion":1,"source":"pr017-replay"}', repeat('e', 64),
    '01740000-0000-4000-8000-000000000002', 1,
    snapshot.value, private.clinical_master_sha256(snapshot.value)
  from snapshot;

  if not (select clinical_use_allowed from public.order_catalog_items where id = 'pr017-replay-approved') then
    raise exception 'clinical_master_dispensing_approved_catalog_gate_closed';
  end if;
  if (select source_clinical_review_id from public.order_catalog_items where id = 'pr017-replay-approved')
    is distinct from '01750000-0000-4000-8000-000000000001'::uuid then
    raise exception 'clinical_master_dispensing_review_lineage_missing';
  end if;

  update public.order_catalog_items
  set target_species = array[v_species_code, v_override_species_code]
  where id = 'pr017-replay-approved';
  if not exists (
    select 1
    from private.clinical_master_dispensing_species_override_events audit
    where audit.workspace_id = v_workspace_id
      and audit.catalog_item_id = 'pr017-replay-approved'
      and audit.before_species = array[v_species_code]
      and audit.after_species = array[v_species_code, v_override_species_code]
  ) then
    raise exception 'clinical_master_dispensing_species_override_audit_missing';
  end if;

  begin
    insert into public.orders (
      id, workspace_id, encounter_id, order_type, display_name, billing_display_name,
      status, work_status, priority, quantity, unit_price_snapshot,
      requested_by_user_id, requested_at, row_type, source_order_id,
      source_order_version, applied_snapshot, applied_price_snapshot,
      calculation_inputs, calculation_outputs, quantity_source, price_rule_source,
      billing_reflection_enabled, order_confirmation_status,
      billing_candidate_status, task_status, workspace_catalog_item_id,
      source_master_record_id, source_master_revision, workspace_catalog_revision,
      applied_snapshot_schema_version
    ) values (
      '01770000-0000-4000-8000-000000000001', v_workspace_id, v_encounter_id,
      'dispensing', '재현 대기 조제', '재현 대기 조제', 'draft', 'pending',
      'normal', 1, 1000, v_reviewer_id, now(), 'individual',
      'pr017-replay-pending', 'pr017-replay-v1',
      jsonb_build_object('workspaceCatalogItemId', 'pr017-replay-pending'),
      '{"priceKrw":1000}', '{}', '{}', 'manual', 'preset_price', true,
      'draft', 'not_requested', 'pending', 'pr017-replay-pending',
      '01700000-0000-4000-8000-000000000001', 1, 1, 0
    );
    raise exception 'clinical_master_dispensing_pending_order_accepted';
  exception when others then
    get stacked diagnostics v_error = message_text, v_sqlstate = returned_sqlstate;
    if v_error <> 'clinical_master_dispensing_clinical_review_required' or v_sqlstate <> '42501' then
      raise;
    end if;
  end;

  perform pg_catalog.set_config(
    'request.jwt.claim.sub',
    v_non_veterinarian_id::text,
    true
  );
  begin
    insert into public.orders (
      id, workspace_id, encounter_id, order_type, display_name, billing_display_name,
      status, work_status, priority, quantity, unit_price_snapshot,
      requested_by_user_id, requested_at, row_type, source_order_id,
      source_order_version, applied_snapshot, applied_price_snapshot,
      calculation_inputs, calculation_outputs, quantity_source, price_rule_source,
      billing_reflection_enabled, order_confirmation_status,
      billing_candidate_status, task_status, workspace_catalog_item_id,
      source_master_record_id, source_master_revision, workspace_catalog_revision,
      applied_snapshot_schema_version, detail_inputs
    ) values (
      '01770000-0000-4000-8000-000000000005', v_workspace_id, v_override_encounter_id,
      'dispensing', '재현 종 확장 비수의사', '재현 종 확장 비수의사', 'draft', 'pending',
      'normal', 1, 1000, v_non_veterinarian_id, now(), 'individual',
      'pr017-replay-approved', 'pr017-replay-v1',
      jsonb_build_object('workspaceCatalogItemId', 'pr017-replay-approved'),
      '{"priceKrw":1000}', '{}', '{}', 'manual', 'preset_price', true,
      'draft', 'not_requested', 'pending', 'pr017-replay-approved',
      '01700000-0000-4000-8000-000000000002', 1, 1, 0,
      jsonb_build_object(
        'route', 'PO',
        'extraLabelSpeciesConfirmed', true,
        'extraLabelSpeciesReason', '비수의사 종 범위 확장 재현'
      )
    );
    raise exception 'clinical_master_dispensing_species_override_non_veterinarian_accepted';
  exception when others then
    get stacked diagnostics v_error = message_text, v_sqlstate = returned_sqlstate;
    if v_error <> 'clinical_master_dispensing_species_override_veterinarian_required'
      or v_sqlstate <> '42501' then
      raise;
    end if;
  end;
  perform pg_catalog.set_config(
    'request.jwt.claim.sub',
    v_reviewer_id::text,
    true
  );

  insert into public.orders (
    id, workspace_id, encounter_id, order_type, display_name, billing_display_name,
    status, work_status, priority, quantity, unit_price_snapshot,
    requested_by_user_id, requested_at, row_type, source_order_id,
    source_order_version, applied_snapshot, applied_price_snapshot,
    calculation_inputs, calculation_outputs, quantity_source, price_rule_source,
    billing_reflection_enabled, order_confirmation_status,
    billing_candidate_status, task_status, workspace_catalog_item_id,
    source_master_record_id, source_master_revision, workspace_catalog_revision,
    applied_snapshot_schema_version
  ) values (
    '01770000-0000-4000-8000-000000000002', v_workspace_id, v_encounter_id,
    'dispensing', '재현 승인 조제', '재현 승인 조제', 'draft', 'pending',
    'normal', 1, 1000, v_reviewer_id, now(), 'individual',
    'pr017-replay-approved', 'pr017-replay-v1',
    jsonb_build_object('workspaceCatalogItemId', 'pr017-replay-approved'),
    '{"priceKrw":1000}', '{}', '{}', 'manual', 'preset_price', true,
    'draft', 'not_requested', 'pending', 'pr017-replay-approved',
    '01700000-0000-4000-8000-000000000002', 1, 1, 0
  );

  begin
    insert into public.orders (
      id, workspace_id, encounter_id, order_type, display_name, billing_display_name,
      status, work_status, priority, quantity, unit_price_snapshot,
      requested_by_user_id, requested_at, row_type, source_order_id,
      source_order_version, applied_snapshot, applied_price_snapshot,
      calculation_inputs, calculation_outputs, quantity_source, price_rule_source,
      billing_reflection_enabled, order_confirmation_status,
      billing_candidate_status, task_status, workspace_catalog_item_id,
      source_master_record_id, source_master_revision, workspace_catalog_revision,
      applied_snapshot_schema_version, detail_inputs
    ) values (
      '01770000-0000-4000-8000-000000000003', v_workspace_id, v_override_encounter_id,
      'dispensing', '재현 종 확장 미확인', '재현 종 확장 미확인', 'draft', 'pending',
      'normal', 1, 1000, v_reviewer_id, now(), 'individual',
      'pr017-replay-approved', 'pr017-replay-v1',
      jsonb_build_object('workspaceCatalogItemId', 'pr017-replay-approved'),
      '{"priceKrw":1000}', '{}', '{}', 'manual', 'preset_price', true,
      'draft', 'not_requested', 'pending', 'pr017-replay-approved',
      '01700000-0000-4000-8000-000000000002', 1, 1, 0,
      jsonb_build_object('route', 'PO')
    );
    raise exception 'clinical_master_dispensing_species_override_without_confirmation_accepted';
  exception when others then
    get stacked diagnostics v_error = message_text, v_sqlstate = returned_sqlstate;
    if v_error <> 'clinical_master_dispensing_species_override_confirmation_required'
      or v_sqlstate <> '23514' then
      raise;
    end if;
  end;

  insert into public.orders (
    id, workspace_id, encounter_id, order_type, display_name, billing_display_name,
    status, work_status, priority, quantity, unit_price_snapshot,
    requested_by_user_id, requested_at, row_type, source_order_id,
    source_order_version, applied_snapshot, applied_price_snapshot,
    calculation_inputs, calculation_outputs, quantity_source, price_rule_source,
    billing_reflection_enabled, order_confirmation_status,
    billing_candidate_status, task_status, workspace_catalog_item_id,
    source_master_record_id, source_master_revision, workspace_catalog_revision,
    applied_snapshot_schema_version, detail_inputs
  ) values (
    '01770000-0000-4000-8000-000000000004', v_workspace_id, v_override_encounter_id,
    'dispensing', '재현 종 확장 확인', '재현 종 확장 확인', 'draft', 'pending',
    'normal', 1, 1000, v_reviewer_id, now(), 'individual',
    'pr017-replay-approved', 'pr017-replay-v1',
    jsonb_build_object('workspaceCatalogItemId', 'pr017-replay-approved'),
    '{"priceKrw":1000}', '{}', '{}', 'manual', 'preset_price', true,
    'draft', 'not_requested', 'pending', 'pr017-replay-approved',
    '01700000-0000-4000-8000-000000000002', 1, 1, 0,
    jsonb_build_object(
      'route', 'PO',
      'extraLabelSpeciesConfirmed', true,
      'extraLabelSpeciesReason', '병원 수의사 판단에 따른 종 범위 확장 재현'
    )
  );
  if (select applied_snapshot -> 'dispensingLineage' ->> 'speciesUseBasis'
      from public.orders where id = '01770000-0000-4000-8000-000000000004')
    is distinct from 'workspace_extra_label_override' then
    raise exception 'clinical_master_dispensing_species_override_lineage_missing';
  end if;
  if (select applied_snapshot -> 'dispensingLineage'
        -> 'extraLabelSpeciesAttestation' ->> 'actorUserId'
      from public.orders where id = '01770000-0000-4000-8000-000000000004')
    is distinct from v_reviewer_id::text then
    raise exception 'clinical_master_dispensing_species_override_actor_missing';
  end if;

  if (select applied_snapshot -> 'dispensingLineage' ->> 'sourceClinicalReviewId'
      from public.orders where id = '01770000-0000-4000-8000-000000000002')
    is distinct from '01750000-0000-4000-8000-000000000001' then
    raise exception 'clinical_master_dispensing_draft_lineage_missing';
  end if;

  begin
    update public.orders
    set detail_inputs = jsonb_build_object('route', 'OTIC')
    where id = '01770000-0000-4000-8000-000000000002';
    raise exception 'clinical_master_dispensing_incompatible_route_accepted';
  exception when others then
    get stacked diagnostics v_error = message_text, v_sqlstate = returned_sqlstate;
    if v_error <> 'clinical_master_dispensing_route_incompatible' or v_sqlstate <> '23514' then
      raise;
    end if;
  end;

  update public.orders
  set detail_inputs = jsonb_build_object('route', 'PO')
  where id = '01770000-0000-4000-8000-000000000002';

  update public.orders
  set
    status = 'confirmed',
    order_confirmation_status = 'confirmed'
  where id = '01770000-0000-4000-8000-000000000002';

  begin
    update public.orders
    set applied_snapshot = applied_snapshot || jsonb_build_object(
      'dispensingLineage', jsonb_build_object('tampered', true)
    )
    where id = '01770000-0000-4000-8000-000000000002';
    raise exception 'clinical_master_dispensing_confirmed_lineage_mutation_accepted';
  exception when others then
    get stacked diagnostics v_error = message_text, v_sqlstate = returned_sqlstate;
    if v_error <> 'clinical_master_dispensing_confirmed_lineage_immutable' or v_sqlstate <> '55000' then
      raise;
    end if;
  end;

  begin
    update master.medication_products
    set english_product_name = 'Mutated replay product'
    where id = '01730000-0000-4000-8000-000000000001';
    raise exception 'clinical_master_dispensing_immutable_update_accepted';
  exception when others then
    get stacked diagnostics v_error = message_text, v_sqlstate = returned_sqlstate;
    if v_error <> 'clinical_master_dispensing_revision_immutable' or v_sqlstate <> '55000' then
      raise;
    end if;
  end;

  foreach v_table in array array[
    'medication_ingredients', 'evidence_documents', 'medication_products',
    'medication_product_ingredients', 'medication_species_applicability',
    'medication_product_handling', 'dispensing_order_profiles', 'evidence_assertions',
    'clinical_reviews', 'medication_regulatory_profiles'
  ] loop
    if not (select relrowsecurity from pg_catalog.pg_class where oid = pg_catalog.to_regclass('master.' || v_table)) then
      raise exception 'clinical_master_dispensing_rls_missing:%', v_table;
    end if;
    if exists (
      select 1 from pg_catalog.pg_policy
      where polrelid = pg_catalog.to_regclass('master.' || v_table)
    ) then
      raise exception 'clinical_master_dispensing_policy_present:%', v_table;
    end if;
    if pg_catalog.has_table_privilege('anon', 'master.' || v_table, 'SELECT')
      or pg_catalog.has_table_privilege('authenticated', 'master.' || v_table, 'SELECT')
      or pg_catalog.has_table_privilege('service_role', 'master.' || v_table, 'SELECT') then
      raise exception 'clinical_master_dispensing_acl_exposed:%', v_table;
    end if;
  end loop;

  if pg_catalog.strpos(
    pg_catalog.pg_get_functiondef(
      'public.clair_list_fulfillment_work_items(text,text,uuid,uuid,text)'::regprocedure
    ),
    '''patientId'', encounter.patient_id'
  ) = 0 or pg_catalog.strpos(
    pg_catalog.pg_get_functiondef(
      'public.clair_list_fulfillment_work_items(text,text,uuid,uuid,text)'::regprocedure
    ),
    '''taskStatus'', task.status'
  ) = 0 then
    raise exception 'clinical_master_dispensing_fulfillment_read_model_missing';
  end if;

  if pg_catalog.strpos(
    pg_catalog.pg_get_functiondef(
      'public.clair_list_fulfillment_work_item_history_v2(text,uuid,integer,timestamptz,uuid)'::regprocedure
    ),
    'private.clair_queue_permission_for_destination'
  ) = 0 or pg_catalog.strpos(
    pg_catalog.pg_get_functiondef(
      'public.clair_list_fulfillment_work_item_history_v2(text,uuid,integer,timestamptz,uuid)'::regprocedure
    ),
    'event.workspace_id = p_workspace_id'
  ) = 0 then
    raise exception 'clinical_master_dispensing_fulfillment_history_scope_missing';
  end if;

  raise notice 'clinical_master_dispensing_order_foundation_replay_ok';
end;
$replay$;

rollback;
