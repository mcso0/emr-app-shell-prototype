\set ON_ERROR_STOP on

begin;

set constraints all deferred;

do $fixture$
declare
  v_release_id uuid;
  v_path_id uuid;
  v_species_id uuid;
  v_profile_snapshot jsonb;
  v_authority jsonb := jsonb_build_object(
    'schemaVersion', 2,
    'calculationMode', 'product_unit',
    'dispenseUnit', 'tablet',
    'preparationPolicy', jsonb_build_object(
      'quantityScope', 'course_total',
      'increment', 1,
      'roundingMode', 'up',
      'displayPrecision', 0,
      'minimum', 1,
      'maximum', 100,
      'noReasonTolerance', 0
    ),
    'priceBasis', 'per_product_unit',
    'billingUnit', 'tablet',
    'taxClass', 'taxable',
    'setBillingOwner', 'children',
    'setAmountStrategy', 'included_order_sum'
  );
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

  select species.master_record_id into strict v_species_id
  from master.species species
  where species.species_code = 'dog';

  if not private.clair_plan_order_authority_is_valid(v_authority) then
    raise exception 'dispensing_set_fixture_authority_invalid';
  end if;

  insert into master.master_records (
    id, master_key, record_type, lifecycle_status, safety_status,
    current_revision, current_release_id, published_at
  ) values (
    '02400000-0000-4000-8000-000000000001',
    'rehearsal.dispensing.set-compatible',
    'order', 'published', 'normal', 1, v_release_id, now()
  );

  insert into master.master_record_versions (
    master_record_id, revision, release_id, snapshot, change_summary,
    authored_by_label
  ) values (
    '02400000-0000-4000-8000-000000000001', 1, v_release_id,
    '{"schemaVersion":1,"recordType":"order","name":"dispensing set compatibility","detail":{}}',
    'Local dispensing set compatibility rehearsal', 'Codex local rehearsal'
  );

  insert into master.orders (
    master_record_id, classification_path_id,
    default_billing_reflection_enabled, default_quantity
  ) values (
    '02400000-0000-4000-8000-000000000001', v_path_id, true, 1
  );

  insert into master.medication_ingredients (
    id, ingredient_key, revision, normalized_english_name, korean_name,
    korean_review_status, lifecycle_status, source_release_id
  ) values (
    '02410000-0000-4000-8000-000000000001',
    'dispensing-set-rehearsal-ingredient', 1,
    'Dispensing set rehearsal ingredient', '조제 세트 리허설 성분',
    'approved', 'approved', v_release_id
  );

  insert into master.evidence_documents (
    id, document_key, revision, authority, jurisdiction, document_type,
    source_uri, content_sha256, accessed_at, lifecycle_status, source_release_id
  ) values (
    '02420000-0000-4000-8000-000000000001',
    'dispensing-set-rehearsal-evidence', 1, 'VMD', 'GB', 'spc',
    'https://example.invalid/dispensing-set-rehearsal', repeat('a', 64),
    current_date, 'captured', v_release_id
  );

  insert into master.medication_products (
    id, product_key, revision, authority, source_jurisdiction,
    source_product_id, english_product_name, korean_draft_name,
    korean_review_status, dosage_form, routes, strength_snapshot,
    coverage_category, lifecycle_status, source_release_id
  ) values (
    '02430000-0000-4000-8000-000000000001',
    'dispensing-set-rehearsal-product', 1, 'VMD', 'GB',
    'dispensing-set-rehearsal-product-1', 'Dispensing set rehearsal product',
    '조제 세트 리허설 제품', 'approved', 'tablet', array['oral'],
    '[{"value":10,"unit":"mg"}]', 'rehearsal', 'approved', v_release_id
  );

  insert into master.medication_product_ingredients (
    product_id, product_revision, ingredient_id, ingredient_revision,
    ordinal, strength_kind, numerator_value, numerator_unit,
    evidence_mode, pairing_status, source_release_id
  ) values (
    '02430000-0000-4000-8000-000000000001', 1,
    '02410000-0000-4000-8000-000000000001', 1, 1,
    'presentation', 10, 'mg', 'direct', 'approved', v_release_id
  );

  insert into master.medication_species_applicability (
    product_id, product_revision, species_record_id, evidence_mode,
    review_status, source_release_id
  ) values (
    '02430000-0000-4000-8000-000000000001', 1, v_species_id,
    'direct', 'approved', v_release_id
  );

  insert into master.medication_product_handling (
    product_id, product_revision, storage_codes, extraction_status,
    source_release_id
  ) values (
    '02430000-0000-4000-8000-000000000001', 1,
    array['store_below_25c'], 'approved', v_release_id
  );

  insert into master.dispensing_order_profiles (
    id, profile_key, profile_revision, order_record_id,
    order_record_revision, product_id, product_revision, allowed_routes,
    korean_translation_review_status, evidence_fingerprint,
    lifecycle_status, source_release_id
  ) values (
    '02440000-0000-4000-8000-000000000001',
    'dispensing-set-rehearsal-profile', 1,
    '02400000-0000-4000-8000-000000000001', 1,
    '02430000-0000-4000-8000-000000000001', 1, array['oral'],
    'approved', repeat('c', 64), 'approved', v_release_id
  );

  insert into master.evidence_assertions (
    assertion_key, product_id, product_revision, field_path,
    evidence_document_id, evidence_document_revision, evidence_mode,
    locator, extraction_status, source_release_id
  )
  select
    'dispensing-set-rehearsal-' || replace(required.field_path, '.', '-'),
    '02430000-0000-4000-8000-000000000001', 1, required.field_path,
    '02420000-0000-4000-8000-000000000001', 1, 'direct',
    'local rehearsal locator', 'approved', v_release_id
  from (values
    ('product.identity'), ('product.strength'), ('product.dosageForm'),
    ('product.route'), ('product.targetSpecies'), ('handling.storage')
  ) required(field_path);

  insert into master.clinical_reviews (
    id, review_key, dispensing_profile_id, dispensing_profile_revision,
    decision, reviewer_user_id, reviewer_eligibility, decision_reason,
    reviewed_at, source_release_id
  ) values (
    '02450000-0000-4000-8000-000000000001',
    'dispensing-set-rehearsal-review',
    '02440000-0000-4000-8000-000000000001', 1, 'approved',
    '00000000-0000-4000-8000-000000000002',
    '{"eligible":true,"basis":"local_rehearsal"}',
    'Local compatibility rehearsal only', now(), v_release_id
  );

  insert into master.medication_regulatory_profiles (
    id, regulatory_key, revision, product_id, product_revision,
    jurisdiction, authorization_status, controlled_status, policy_version,
    review_status, reviewer_user_id, reviewed_at, source_release_id
  ) values (
    '02460000-0000-4000-8000-000000000001',
    'dispensing-set-rehearsal-regulatory', 1,
    '02430000-0000-4000-8000-000000000001', 1, 'KR', 'approved',
    'not_controlled', 'local-rehearsal-only', 'approved',
    '00000000-0000-4000-8000-000000000002', now(), v_release_id
  );

  v_profile_snapshot := jsonb_build_object(
    'sourceDispensingProfileId', '02440000-0000-4000-8000-000000000001',
    'sourceDispensingProfileRevision', 1,
    'sourceMedicationProductId', '02430000-0000-4000-8000-000000000001',
    'sourceMedicationProductRevision', 1,
    'routes', jsonb_build_array('oral'),
    'targetSpecies', jsonb_build_array('dog')
  );

  insert into public.order_catalog_items
  select (jsonb_populate_record(
    null::public.order_catalog_items,
    to_jsonb(base) || jsonb_build_object(
      'id', 'pr024-dispensing-set-compatible',
      'standard_order_id', 'pr024-dispensing-set-compatible',
      'source_preset_version', 'pr024-local-v1',
      'standard_order_name', 'PR-024 dispensing set compatible',
      'in_hospital_order_name', 'PR-024 dispensing set compatible',
      'billing_name', 'PR-024 dispensing set compatible',
      'availability_status', 'active',
      'price_krw', 1000,
      'sales_unit', 'per_each',
      'target_species', jsonb_build_array('dog'),
      'origin_type', 'clair_master',
      'source_master_record_id', '02400000-0000-4000-8000-000000000001',
      'source_master_revision', 1,
      'initial_imported_revision', 1,
      'last_auto_merged_revision', 1,
      'classification_path_id', v_path_id,
      'catalog_revision', 1,
      'source_projection_snapshot', jsonb_build_object(
        'schemaVersion', 1,
        'source', 'pr024-local-rehearsal'
      ),
      'source_projection_fingerprint', repeat('d', 64),
      'source_dispensing_profile_id', '02440000-0000-4000-8000-000000000001',
      'source_dispensing_profile_revision', 1,
      'source_medication_product_id', '02430000-0000-4000-8000-000000000001',
      'source_medication_product_revision', 1,
      'source_clinical_review_id', '02450000-0000-4000-8000-000000000001',
      'source_evidence_fingerprint', repeat('c', 64),
      'clinical_use_allowed', true,
      'dispensing_profile_snapshot', v_profile_snapshot,
      'dispensing_profile_snapshot_sha256',
        private.clinical_master_sha256(v_profile_snapshot),
      'default_detail_inputs', jsonb_build_object(
        'planOrderAuthority', v_authority
      ),
      'default_detail_input_policies', jsonb_build_object(
        'planOrderAuthority', 'derived_from_profile'
      ),
      'created_at', now(),
      'updated_at', now()
    )
  )).*
  from public.order_catalog_items base
  where base.workspace_id = 'clair-demo'
    and base.id = 'den194-catalog-maropitant';

  insert into public.order_sets (
    id, workspace_id, source_set_version, set_category, set_name,
    billing_name, availability_status, amount_basis, set_price_krw,
    sales_unit, billing_reflection_enabled, target_species, care_guide,
    internal_instruction, current_revision_id, tax_type,
    created_by_user_id, updated_by_user_id
  ) values (
    'pr024-dispensing-set', 'clair-demo', 'order-set-revision-1', 'medication',
    'PR-024 dispensing set', 'PR-024 dispensing set', 'active',
    'included_order_sum', null, 'per_each', false, array['dog'],
    'Local compatibility rehearsal only', 'Local compatibility rehearsal only',
    '02470000-0000-4000-8000-000000000001', 'derived',
    '00000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000002'
  );

  insert into public.order_set_revisions (
    id, workspace_id, order_set_id, revision_no, validation_status,
    validation_errors, set_category, set_name, billing_name, amount_basis,
    set_price_krw, range_basis, sales_unit, billing_reflection_enabled,
    tax_type, target_species, care_guide, internal_instruction,
    created_by_user_id
  ) values (
    '02470000-0000-4000-8000-000000000001', 'clair-demo',
    'pr024-dispensing-set', 1, 'valid', '[]', 'medication',
    'PR-024 dispensing set', 'PR-024 dispensing set',
    'included_order_sum', null, null, 'per_each', false, 'derived',
    array['dog'], 'Local compatibility rehearsal only',
    'Local compatibility rehearsal only',
    '00000000-0000-4000-8000-000000000002'
  );

  insert into public.order_set_revision_items (
    id, workspace_id, order_set_id, revision_id, child_kind,
    child_order_catalog_item_id, child_order_catalog_revision, sort_order,
    default_selected, billing_reflection_default, default_quantity,
    quantity_source
  ) values (
    '02480000-0000-4000-8000-000000000001', 'clair-demo',
    'pr024-dispensing-set', '02470000-0000-4000-8000-000000000001',
    'atomic', 'pr024-dispensing-set-compatible', 1, 1, true, true, 1,
    'fixed_one'
  );

  insert into public.encounters (
    id, workspace_id, patient_id, guardian_id, primary_veterinarian_id,
    encounter_no, reception_type, status, checked_in_at,
    checked_in_by_user_id, started_at
  )
  select
    '02490000-0000-4000-8000-000000000001', workspace_id, patient_id,
    guardian_id, '00000000-0000-4000-8000-000000000002',
    'PR024-DISP-SET', 'walk_in', 'in_consultation', now(),
    '00000000-0000-4000-8000-000000000002', now()
  from public.encounters
  where id = '26000000-0000-4000-8000-000000000001';

  insert into public.soap_notes (
    id, workspace_id, encounter_id, author_user_id, status, autosaved_at,
    clinical_at
  ) values (
    '02492000-0000-4000-8000-000000000001', 'clair-demo',
    '02490000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000002', 'autosaved', now(), now()
  );
end;
$fixture$;

set constraints all immediate;
set constraints all deferred;

do $foreign_workspace_boundary$
begin
  perform set_config(
    'request.jwt.claim.sub',
    '00000000-0000-4000-8000-000000000012',
    true
  );
  perform set_config(
    'request.jwt.claims',
    '{"sub":"00000000-0000-4000-8000-000000000012","role":"authenticated"}',
    true
  );
  execute 'set local role authenticated';

  if exists (
    select 1
    from public.order_catalog_items
    where workspace_id = 'clair-demo'
      and id = 'pr024-dispensing-set-compatible'
  ) or exists (
    select 1
    from public.order_sets
    where workspace_id = 'clair-demo'
      and id = 'pr024-dispensing-set'
  ) then
    raise exception 'dispensing_set_foreign_workspace_visible';
  end if;
end;
$foreign_workspace_boundary$;

reset role;

do $rpc_rehearsal$
declare
  v_current jsonb;
  v_saved jsonb;
  v_resaved jsonb;
  v_confirmed jsonb;
  v_child jsonb;
  v_first_actual numeric;
begin
  perform set_config(
    'request.jwt.claim.sub',
    '00000000-0000-4000-8000-000000000002',
    true
  );
  perform set_config(
    'request.jwt.claims',
    '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}',
    true
  );
  execute 'set local role authenticated';

  v_current := public.clair_get_chart_order_draft(
    'clair-demo', '02490000-0000-4000-8000-000000000001'
  );
  v_saved := public.clair_save_chart_order_draft_for_chart(
    'clair-demo',
    '00000000-0000-4000-8000-000000000002',
    '02490000-0000-4000-8000-000000000001',
    '02492000-0000-4000-8000-000000000001',
    jsonb_build_object(
      'expectedEtag', v_current ->> 'etag',
      'removedOrderIds', '[]'::jsonb,
      'rows', jsonb_build_array(jsonb_build_object(
        'rowType', 'set',
        'orderId', '02491000-0000-4000-8000-000000000001',
        'sourceSetId', 'pr024-dispensing-set',
        'sourceSetRevisionId', '02470000-0000-4000-8000-000000000001',
        'sourceSetRevisionNo', 1,
        'selectionIntent', jsonb_build_object(
          'items', jsonb_build_array(jsonb_build_object(
            'revisionItemId', '02480000-0000-4000-8000-000000000001',
            'selected', true,
            'quantity', 1
          ))
        ),
        'childInputs', jsonb_build_array(jsonb_build_object(
          'revisionItemId', '02480000-0000-4000-8000-000000000001',
          'detailInputs', jsonb_build_object(
            'doseBasis', 'patient',
            'dose', 1,
            'doseUnit', 'tablet',
            'route', 'PO',
            'frequency', 'once',
            'durationDays', 1,
            'totalQuantity', 1,
            'totalQuantityUnit', 'tablet'
          ),
          'detailSchemaVersion', 1,
          'priority', 'normal'
        )),
        'detailInputs', '{}'::jsonb,
        'detailSchemaVersion', 1,
        'priority', 'normal'
      ))
    )
  );

  select row.value into strict v_child
  from jsonb_array_elements(v_saved -> 'rows') row(value)
  where row.value ->> 'rowType' = 'set_child';

  if v_child #>> '{calculationOutputs,calculationStatus}' <> 'ready'
    or v_child #>> '{calculationOutputs,actualDispenseQuantity}' <> '1'
    or jsonb_typeof(v_child -> 'setPricingCalculationOutputs') <> 'object'
    or jsonb_typeof(v_child -> 'dispensingAuthoritySnapshot') <> 'object'
    or jsonb_typeof(v_child -> 'dispensingLineage') <> 'object'
  then
    raise exception 'dispensing_set_initial_save_contract_failed';
  end if;
  v_first_actual := (
    v_child #>> '{calculationOutputs,actualDispenseQuantity}'
  )::numeric;

  v_resaved := public.clair_save_chart_order_draft_for_chart(
    'clair-demo',
    '00000000-0000-4000-8000-000000000002',
    '02490000-0000-4000-8000-000000000001',
    '02492000-0000-4000-8000-000000000001',
    jsonb_build_object(
      'expectedEtag', v_saved ->> 'etag',
      'removedOrderIds', '[]'::jsonb,
      'rows', jsonb_build_array(jsonb_build_object(
        'rowType', 'set',
        'orderId', '02491000-0000-4000-8000-000000000001',
        'sourceSetId', 'pr024-dispensing-set',
        'sourceSetRevisionId', '02470000-0000-4000-8000-000000000001',
        'sourceSetRevisionNo', 1,
        'selectionIntent', jsonb_build_object(
          'items', jsonb_build_array(jsonb_build_object(
            'revisionItemId', '02480000-0000-4000-8000-000000000001',
            'selected', true,
            'quantity', 1
          ))
        ),
        'childInputs', jsonb_build_array(jsonb_build_object(
          'revisionItemId', '02480000-0000-4000-8000-000000000001',
          'detailInputs', jsonb_build_object(
            'doseBasis', 'patient',
            'dose', 2,
            'doseUnit', 'tablet',
            'route', 'PO',
            'frequency', 'once',
            'durationDays', 1,
            'totalQuantity', 2,
            'totalQuantityUnit', 'tablet'
          ),
          'detailSchemaVersion', 1,
          'priority', 'normal'
        )),
        'detailInputs', '{}'::jsonb,
        'detailSchemaVersion', 1,
        'priority', 'normal'
      ))
    )
  );

  select row.value into strict v_child
  from jsonb_array_elements(v_resaved -> 'rows') row(value)
  where row.value ->> 'rowType' = 'set_child';

  if (v_child #>> '{calculationOutputs,actualDispenseQuantity}')::numeric
      is distinct from v_first_actual * 2
    or (v_child -> 'setPricingCalculationOutputs')
      is distinct from (
        select row.value -> 'setPricingCalculationOutputs'
        from jsonb_array_elements(v_saved -> 'rows') row(value)
        where row.value ->> 'rowType' = 'set_child'
      )
  then
    raise exception 'dispensing_set_recalculation_contract_failed';
  end if;

  v_confirmed := public.clair_confirm_chart_order_candidates_for_chart(
    'clair-demo',
    '00000000-0000-4000-8000-000000000002',
    '02490000-0000-4000-8000-000000000001',
    '02492000-0000-4000-8000-000000000001',
    array['02491000-0000-4000-8000-000000000001'::uuid],
    v_resaved ->> 'etag',
    'pr024-dispensing-set-confirm-v1'
  );

  if v_confirmed ->> 'commandStatus' not in ('applied', 'already_applied')
    and v_confirmed ->> 'status' not in ('applied', 'already_applied')
  then
    raise exception 'dispensing_set_confirmation_rpc_failed';
  end if;
end;
$rpc_rehearsal$;

reset role;
set constraints all immediate;

do $stored_contract$
declare
  v_child public.orders;
  v_parent public.orders;
  v_state text;
  v_message text;
begin
  select * into strict v_parent
  from public.orders
  where id = '02491000-0000-4000-8000-000000000001';

  select * into strict v_child
  from public.orders
  where parent_chart_order_line_id = v_parent.id
    and status <> 'cancelled';

  if not private.clair_is_set_pricing_calculation_outputs(
      v_child.set_pricing_calculation_outputs
    )
    or v_child.applied_snapshot_sha256 is distinct from
      private.clair_b3_sha256(jsonb_build_object(
        'appliedSnapshot', v_child.applied_snapshot,
        'appliedPriceSnapshot', v_child.applied_price_snapshot,
        'calculationInputs', v_child.calculation_inputs,
        'calculationOutputs', v_child.set_pricing_calculation_outputs
      ))
    or v_child.calculation_outputs ->> 'calculationStatus' <> 'ready'
    or v_child.calculation_outputs ? 'childSubtotalKrw'
    or v_child.dispensing_authority_snapshot = '{}'::jsonb
    or v_child.dispensing_lineage_snapshot = '{}'::jsonb
    or v_parent.dispensing_lineage_snapshot
        -> v_child.source_set_revision_item_id::text
      is distinct from v_child.dispensing_lineage_snapshot
  then
    raise exception 'dispensing_set_stored_contract_failed';
  end if;

  if v_child.confirmed_snapshot -> 'setPricingCalculationOutputs'
      is distinct from v_child.set_pricing_calculation_outputs
    or v_child.confirmed_snapshot -> 'dispensingAuthoritySnapshot'
      is distinct from v_child.dispensing_authority_snapshot
    or v_child.confirmed_snapshot -> 'dispensingLineage'
      is distinct from v_child.dispensing_lineage_snapshot
    or v_child.confirmed_snapshot #>> '{calculationOutputs,calculationStatus}'
      <> 'ready'
    or not exists (
      select 1
      from public.order_tasks task
      where task.workspace_id = v_child.workspace_id
        and task.order_id = v_child.id
        and task.effective_snapshot is not distinct from v_child.confirmed_snapshot
    )
    or not exists (
      select 1
      from public.order_billing_candidates candidate
      where candidate.workspace_id = v_child.workspace_id
        and candidate.order_id = v_child.id
        and candidate.source_snapshot is not distinct from v_child.confirmed_snapshot
    )
  then
    raise exception 'dispensing_set_confirmation_snapshot_failed';
  end if;

  begin
    update public.orders
    set dispensing_lineage_snapshot = '{"tampered":true}'::jsonb
    where id = v_child.id;
    raise exception 'dispensing_set_confirmed_source_mutation_allowed';
  exception when others then
    get stacked diagnostics
      v_state = returned_sqlstate,
      v_message = message_text;
    if v_state <> '55000'
      or v_message <> 'confirmed_dispensing_set_contract_immutable'
    then
      raise;
    end if;
  end;

  raise notice 'clinical_master_dispensing_set_confirmation_compatibility_rehearsal_ok';
end;
$stored_contract$;

rollback;
