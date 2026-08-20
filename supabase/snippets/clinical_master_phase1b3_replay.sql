-- CLINICAL-MASTER-PR-006 local replay.
-- Run after `npx supabase db reset --local`.  B3 creates its own short-lived
-- B2-native fixtures through the owner-only adapter, then rolls them back.
-- No seed file or remote database is written.

\set ON_ERROR_STOP on

begin;

do $$
declare
  v_actor uuid := '00000000-0000-4000-8000-000000000001'::uuid;
  v_encounter uuid := '19426000-0000-4000-8000-000000000001'::uuid;
  v_revision uuid;
  v_item uuid;
  v_etag text;
  v_next_etag text;
  v_preview jsonb;
  v_saved jsonb;
  v_action jsonb;
  v_retry jsonb;
  v_selection jsonb;
  v_parent uuid;
  v_sum_parent uuid := 'b3000000-0000-4000-8000-000000000001'::uuid;
  v_fixed_parent uuid := 'b3000000-0000-4000-8000-000000000002'::uuid;
  v_range_parent uuid := 'b3000000-0000-4000-8000-000000000003'::uuid;
  v_snapshot jsonb;
  v_hash text;
  v_error text;
  v_seed_result jsonb;
  v_request uuid;
begin
  if to_regprocedure('public.clair_preview_chart_order_set(text,uuid,text,uuid,jsonb)') is null
     or to_regprocedure('public.clair_save_chart_order_draft(text,text,uuid,jsonb)') is null
     or to_regprocedure('public.clair_save_chart_order_action(text,uuid,uuid,text,uuid[],text)') is null then
    raise exception 'clinical_master_phase1b3_replay_required_rpc_missing';
  end if;

  perform set_config('request.jwt.claim.sub', v_actor::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_actor::text, 'role', 'authenticated')::text,
    true
  );

  -- The predecessor replay intentionally rolls back its fixtures. Keep this
  -- replay reset-compatible by using the same B2 native adapter here rather
  -- than relying on mutable legacy order_set_items or pre-existing rows.
  v_request := private.clair_b2_deterministic_uuid(
    'replay', array['clair-demo', 'b3-sum', '2026-08-20']::text[]
  );
  v_seed_result := private.clair_seed_order_set_compatibility_projection(
    'clair-demo', 'b2-replay-sum',
    jsonb_build_object(
      'setCategory', 'B3 replay', 'setName', 'B3 replay sum',
      'billingName', 'B3 replay sum billing',
      'amountBasis', 'included_order_sum', 'setPriceKrw', null,
      'rangeBasis', null, 'salesUnit', 'per_each',
      'billingReflectionEnabled', false, 'taxType', 'derived',
      'targetSpecies', jsonb_build_array('dog', 'cat', 'other'),
      'careGuide', null, 'internalInstruction', null,
      'items', jsonb_build_array(jsonb_build_object(
        'childKind', 'atomic',
        'childOrderCatalogItemId', 'den194-catalog-cbc',
        'childOrderCatalogRevision', 1,
        'childOrderSetId', null, 'childSetRevisionId', null,
        'sortOrder', 1, 'defaultSelected', true,
        'billingReflectionDefault', true, 'defaultQuantity', 1,
        'quantitySource', 'manual_at_apply'
      )),
      'priceRanges', jsonb_build_array()
    ),
    'active', v_actor, v_request
  );
  if v_seed_result->>'outcome' <> 'created' then
    raise exception 'clinical_master_phase1b3_replay_sum_seed_failed:%', v_seed_result;
  end if;

  v_request := private.clair_b2_deterministic_uuid(
    'replay', array['clair-demo', 'b3-fixed', '2026-08-20']::text[]
  );
  v_seed_result := private.clair_seed_order_set_compatibility_projection(
    'clair-demo', 'b2-replay-fixed',
    jsonb_build_object(
      'setCategory', 'B3 replay', 'setName', 'B3 replay fixed',
      'billingName', 'B3 replay fixed billing',
      'amountBasis', 'set_fixed_price', 'setPriceKrw', 0,
      'rangeBasis', null, 'salesUnit', 'per_each',
      'billingReflectionEnabled', true, 'taxType', 'non_taxable',
      'targetSpecies', jsonb_build_array('dog'),
      'careGuide', null, 'internalInstruction', null,
      'items', jsonb_build_array(jsonb_build_object(
        'childKind', 'atomic',
        'childOrderCatalogItemId', 'den194-catalog-wellness-vaccine',
        'childOrderCatalogRevision', 1,
        'childOrderSetId', null, 'childSetRevisionId', null,
        'sortOrder', 1, 'defaultSelected', true,
        'billingReflectionDefault', false, 'defaultQuantity', 1,
        'quantitySource', 'fixed_one'
      )),
      'priceRanges', jsonb_build_array()
    ),
    'active', v_actor, v_request
  );
  if v_seed_result->>'outcome' <> 'created' then
    raise exception 'clinical_master_phase1b3_replay_fixed_seed_failed:%', v_seed_result;
  end if;

  v_request := private.clair_b2_deterministic_uuid(
    'replay', array['clair-demo', 'b3-range', '2026-08-20']::text[]
  );
  v_seed_result := private.clair_seed_order_set_compatibility_projection(
    'clair-demo', 'b2-replay-range',
    jsonb_build_object(
      'setCategory', 'B3 replay', 'setName', 'B3 replay range',
      'billingName', 'B3 replay range billing',
      'amountBasis', 'range_price', 'setPriceKrw', null,
      'rangeBasis', 'patient_weight_kg', 'salesUnit', 'per_kg',
      'billingReflectionEnabled', true, 'taxType', 'taxable',
      'targetSpecies', jsonb_build_array('dog'),
      'careGuide', null, 'internalInstruction', null,
      'items', jsonb_build_array(jsonb_build_object(
        'childKind', 'atomic',
        'childOrderCatalogItemId', 'den194-catalog-cbc',
        'childOrderCatalogRevision', 1,
        'childOrderSetId', null, 'childSetRevisionId', null,
        'sortOrder', 1, 'defaultSelected', true,
        'billingReflectionDefault', false, 'defaultQuantity', 1,
        'quantitySource', 'fixed_one'
      )),
      'priceRanges', jsonb_build_array(
        jsonb_build_object('sortOrder', 1, 'lowerBound', 0,
          'upperBound', 5, 'priceKrw', 1000),
        jsonb_build_object('sortOrder', 2, 'lowerBound', 5,
          'upperBound', null, 'priceKrw', 1500)
      )
    ),
    'active', v_actor, v_request
  );
  if v_seed_result->>'outcome' <> 'created' then
    raise exception 'clinical_master_phase1b3_replay_range_seed_failed:%', v_seed_result;
  end if;

  v_request := private.clair_b2_deterministic_uuid(
    'replay', array['workspace-clair-cheongdam', 'b3-other-workspace', '2026-08-20']::text[]
  );
  v_seed_result := private.clair_seed_order_set_compatibility_projection(
    'workspace-clair-cheongdam', 'b2-replay-other-workspace',
    jsonb_build_object(
      'setCategory', 'B3 replay', 'setName', 'B3 replay other workspace',
      'billingName', 'B3 replay other workspace billing',
      'amountBasis', 'included_order_sum', 'setPriceKrw', null,
      'rangeBasis', null, 'salesUnit', 'per_order',
      'billingReflectionEnabled', false, 'taxType', 'derived',
      'targetSpecies', jsonb_build_array('dog'),
      'careGuide', null, 'internalInstruction', null,
      'items', jsonb_build_array(jsonb_build_object(
        'childKind', 'atomic', 'childOrderCatalogItemId', 'cd-consult-first',
        'childOrderCatalogRevision', 1,
        'childOrderSetId', null, 'childSetRevisionId', null,
        'sortOrder', 1, 'defaultSelected', true,
        'billingReflectionDefault', true, 'defaultQuantity', 1,
        'quantitySource', 'fixed_one'
      )),
      'priceRanges', jsonb_build_array()
    ),
    'active', v_actor, v_request
  );
  if v_seed_result->>'outcome' <> 'created' then
    raise exception 'clinical_master_phase1b3_replay_other_workspace_seed_failed:%', v_seed_result;
  end if;

  -- Sum: explicit 0.001 quantity, NULL parent price, billable atomic child.
  select s.current_revision_id into v_revision
  from public.order_sets s
  where s.workspace_id = 'clair-demo' and s.id = 'b2-replay-sum';
  select i.id into v_item
  from public.order_set_revision_items i
  where i.workspace_id = 'clair-demo' and i.order_set_id = 'b2-replay-sum'
    and i.revision_id = v_revision and i.child_kind = 'atomic';
  v_selection := jsonb_build_object(
    'items', jsonb_build_array(jsonb_build_object(
      'revisionItemId', v_item, 'selected', true, 'quantity', 0.001
    ))
  );
  v_preview := public.clair_preview_chart_order_set(
    'clair-demo', v_encounter, 'b2-replay-sum', v_revision, v_selection
  );
  if v_preview->'set'->>'amountBasis' <> 'included_order_sum'
     or v_preview->'set'->>'setPriceKrw' is not null then
    raise exception 'clinical_master_phase1b3_replay_sum_projection_invalid:%', v_preview;
  end if;

  -- Preview intent is deliberately closed: client price/snapshot fields never
  -- become an authority and are rejected instead of being silently ignored.
  begin
    perform public.clair_preview_chart_order_set(
      'clair-demo', v_encounter, 'b2-replay-sum', v_revision,
      v_selection || jsonb_build_object('priceKrw', 999999, 'snapshot', jsonb_build_object('tampered', true))
    );
    raise exception 'clinical_master_phase1b3_replay_tampered_preview_accepted';
  exception
    when others then
      get stacked diagnostics v_error = message_text;
      if v_error = 'clinical_master_phase1b3_replay_tampered_preview_accepted'
         or v_error not like 'invalid_order_set_selection%' then
        raise;
      end if;
  end;
  v_saved := public.clair_get_chart_order_draft('clair-demo', v_encounter);
  v_etag := v_saved->>'etag';
  v_saved := public.clair_save_chart_order_draft(
    'clair-demo', v_actor::text, v_encounter,
    jsonb_build_object(
      'expectedEtag', v_etag,
      'rows', jsonb_build_array(jsonb_build_object(
        'rowType', 'set', 'orderId', v_sum_parent,
        'sourceSetId', 'b2-replay-sum', 'sourceSetRevisionId', v_revision,
        'sourceSetRevisionNo', (select revision_no from public.order_set_revisions where id=v_revision),
        'selectionIntent', v_selection
      ))
    )
  );
  select o.applied_snapshot, o.applied_snapshot_sha256
    into v_snapshot, v_hash
  from public.orders o
  where o.workspace_id = 'clair-demo' and o.id = v_sum_parent;
  if v_snapshot->>'rowType' <> 'set'
     or v_snapshot->>'categoryGroup' <> 'set'
     or v_snapshot->>'billingCategory' <> 'other'
     or v_hash is distinct from private.clair_b3_sha256(jsonb_build_object(
       'appliedSnapshot', v_snapshot,
       'appliedPriceSnapshot', (select applied_price_snapshot from public.orders where id=v_sum_parent),
       'calculationInputs', (select calculation_inputs from public.orders where id=v_sum_parent),
       'calculationOutputs', (select calculation_outputs from public.orders where id=v_sum_parent)
     )) then
    raise exception 'clinical_master_phase1b3_replay_sum_snapshot_invalid';
  end if;
  if (select unit_price_snapshot from public.orders where id=v_sum_parent) is not null
     or (select billing_reflection_enabled from public.orders where id=v_sum_parent) then
    raise exception 'clinical_master_phase1b3_replay_sum_billing_invalid';
  end if;
  if (select quantity from public.orders where id=v_sum_parent) <> 1.000 then
    raise exception 'clinical_master_phase1b3_replay_quantity_parent_invalid';
  end if;
  if (select quantity from public.orders where parent_chart_order_line_id=v_sum_parent) <> 0.001 then
    raise exception 'clinical_master_phase1b3_replay_quantity_fraction_invalid';
  end if;

  -- A stale but syntactically valid mutable ETag must conflict before any
  -- draft write. The empty replacement is intentionally not persisted.
  begin
    perform public.clair_save_chart_order_draft(
      'clair-demo', v_actor::text, v_encounter,
      jsonb_build_object('expectedEtag', '"' || repeat('0', 64) || '"', 'rows', '[]'::jsonb)
    );
    raise exception 'clinical_master_phase1b3_replay_stale_etag_accepted';
  exception
    when others then
      get stacked diagnostics v_error = message_text;
      if v_error = 'clinical_master_phase1b3_replay_stale_etag_accepted'
         or v_error not like 'revision_conflict%' then
        raise;
      end if;
  end;

  -- 1, 1.0, and 1.00 are JSONB/numeric-equivalent intent values.
  if (public.clair_preview_chart_order_set(
        'clair-demo', v_encounter, 'b2-replay-sum', v_revision,
        jsonb_build_object('items', jsonb_build_array(jsonb_build_object(
          'revisionItemId', v_item, 'selected', true, 'quantity', 1
        )))
      )->>'selectionFingerprint') is distinct from
     (public.clair_preview_chart_order_set(
        'clair-demo', v_encounter, 'b2-replay-sum', v_revision,
        jsonb_build_object('items', jsonb_build_array(jsonb_build_object(
          'revisionItemId', v_item, 'selected', true, 'quantity', 1.00
        )))
      )->>'selectionFingerprint') then
    raise exception 'clinical_master_phase1b3_replay_numeric_fingerprint_invalid';
  end if;

  -- Fixed zero: only the parent is reflected to billing.
  select s.current_revision_id into v_revision
  from public.order_sets s
  where s.workspace_id = 'clair-demo' and s.id = 'b2-replay-fixed';
  select i.id into v_item
  from public.order_set_revision_items i
  where i.workspace_id = 'clair-demo' and i.order_set_id = 'b2-replay-fixed'
    and i.revision_id = v_revision and i.child_kind = 'atomic';
  v_selection := jsonb_build_object('items', jsonb_build_array(jsonb_build_object(
    'revisionItemId', v_item, 'selected', true, 'quantity', 1
  )));
  v_saved := public.clair_get_chart_order_draft('clair-demo', v_encounter);
  v_saved := public.clair_save_chart_order_draft(
    'clair-demo', v_actor::text, v_encounter,
    jsonb_build_object('expectedEtag', v_saved->>'etag', 'rows', jsonb_build_array(jsonb_build_object(
      'rowType', 'set', 'orderId', v_fixed_parent, 'sourceSetId', 'b2-replay-fixed',
      'sourceSetRevisionId', v_revision,
      'sourceSetRevisionNo', (select revision_no from public.order_set_revisions where id=v_revision),
      'selectionIntent', v_selection
    )))
  );
  if (select unit_price_snapshot from public.orders where id=v_fixed_parent) <> 0
     or not (select billing_reflection_enabled from public.orders where id=v_fixed_parent)
     or (select billing_reflection_enabled from public.orders where parent_chart_order_line_id=v_fixed_parent) then
    raise exception 'clinical_master_phase1b3_replay_fixed_billing_invalid';
  end if;

  -- Range Option A: [0,5) and [5,+infinity); 5 selects the second bracket.
  select s.current_revision_id into v_revision
  from public.order_sets s
  where s.workspace_id = 'clair-demo' and s.id = 'b2-replay-range';
  select i.id into v_item
  from public.order_set_revision_items i
  where i.workspace_id = 'clair-demo' and i.order_set_id = 'b2-replay-range'
    and i.revision_id = v_revision and i.child_kind = 'atomic';
  v_selection := jsonb_build_object(
    'items', jsonb_build_array(jsonb_build_object(
      'revisionItemId', v_item, 'selected', true, 'quantity', 1
    )),
    'rangeInput', 5
  );
  v_preview := public.clair_preview_chart_order_set(
    'clair-demo', v_encounter, 'b2-replay-range', v_revision, v_selection
  );
  if v_preview->'set'->>'amountBasis' <> 'range_price'
     or v_preview->'pricing'->>'rangeInput' <> '5'
     or (v_preview->'pricing'->>'finalTotalKrw')::numeric <> 1500 then
    raise exception 'clinical_master_phase1b3_replay_range_bracket_invalid:%', v_preview;
  end if;
  v_saved := public.clair_get_chart_order_draft('clair-demo', v_encounter);
  v_saved := public.clair_save_chart_order_draft(
    'clair-demo', v_actor::text, v_encounter,
    jsonb_build_object('expectedEtag', v_saved->>'etag', 'rows', jsonb_build_array(jsonb_build_object(
      'rowType', 'set', 'orderId', v_range_parent, 'sourceSetId', 'b2-replay-range',
      'sourceSetRevisionId', v_revision,
      'sourceSetRevisionNo', (select revision_no from public.order_set_revisions where id=v_revision),
      'selectionIntent', v_selection
    )))
  );
  if (select unit_price_snapshot from public.orders where id=v_range_parent) <> 1500
     or not (select billing_reflection_enabled from public.orders where id=v_range_parent)
     or (select billing_reflection_enabled from public.orders where parent_chart_order_line_id=v_range_parent) then
    raise exception 'clinical_master_phase1b3_replay_range_billing_invalid';
  end if;

  -- Confirm retry uses the stored terminal result before mutable reads/CAS.
  v_saved := public.clair_get_chart_order_actions('clair-demo', v_encounter);
  v_action := public.clair_save_chart_order_action(
    'clair-demo', v_actor, v_encounter, 'confirm', array[v_sum_parent], v_saved->>'etag'
  );
  v_retry := public.clair_save_chart_order_action(
    'clair-demo', v_actor, v_encounter, 'confirm', array[v_sum_parent], '"' || repeat('0',64) || '"'
  );
  if v_action->>'stored' <> 'false' or v_retry->>'stored' <> 'true' then
    raise exception 'clinical_master_phase1b3_replay_terminal_retry_invalid';
  end if;
  v_next_etag := v_action->>'etag';
  v_action := public.clair_save_chart_order_action(
    'clair-demo', v_actor, v_encounter, 'bill', array[v_sum_parent], v_next_etag
  );
  v_retry := public.clair_save_chart_order_action(
    'clair-demo', v_actor, v_encounter, 'bill', array[v_sum_parent], '"' || repeat('0',64) || '"'
  );
  if v_action->>'stored' <> 'false' or v_retry->>'stored' <> 'true' then
    raise exception 'clinical_master_phase1b3_replay_bill_retry_invalid';
  end if;

  -- The second synthetic workspace is seeded by B2 but is not readable through
  -- this chart session. This check prevents a cross-tenant preview shortcut.
  select s.current_revision_id into v_revision
  from public.order_sets s
  where s.workspace_id = 'workspace-clair-cheongdam'
    and s.id = 'b2-replay-other-workspace';
  begin
    perform public.clair_preview_chart_order_set(
      'workspace-clair-cheongdam', v_encounter, 'b2-replay-other-workspace', v_revision,
      jsonb_build_object('items', '[]'::jsonb)
    );
    raise exception 'clinical_master_phase1b3_replay_cross_workspace_preview_accepted';
  exception
    when others then
      get stacked diagnostics v_error = message_text;
      if v_error = 'clinical_master_phase1b3_replay_cross_workspace_preview_accepted'
         or not (v_error like any (array['workspace_membership_missing%', 'encounter_unavailable%', 'order_set_member_unavailable%'])) then
        raise;
      end if;
  end;
end
$$;

-- Sol regression matrix: exercise the persisted B3 envelope and the
-- downstream/A3 boundaries against real local rows. Every mutation below is
-- inside the outer transaction and is rolled back with the fixture.
do $$
declare
  v_actor uuid := '00000000-0000-4000-8000-000000000001'::uuid;
  v_encounter uuid := '19426000-0000-4000-8000-000000000001'::uuid;
  v_request uuid;
  v_seed_result jsonb;
  v_saved jsonb;
  v_actions jsonb;
  v_action jsonb;
  v_billing jsonb;
  v_preview jsonb;
  v_selection jsonb;
  v_error text;
  v_rows jsonb;
  v_revision uuid;
  v_item uuid;
  v_parent_id uuid;
  v_child_id uuid;
  v_hash_before text;
  v_hash_after text;
  v_child_hash_before text;
  v_child_hash_after text;
  v_recomputed_hash text;
  v_tamper_applied boolean;
  v_count_before integer;
  v_count_after integer;
  v_catalog_revision integer;
  v_wellness_catalog_revision integer;
  v_wellness_price numeric;
  v_catalog_result jsonb;
  v_invoice_line_id uuid;
  v_rounding_revision uuid;
  v_rounding_item uuid;
  v_rounding_item_two uuid;
  v_rounding_preview jsonb;
  v_frozen_def jsonb;
  v_frozen_parent_hash text;
  v_frozen_child_hash text;
  v_frozen_parent_snapshot jsonb;
  v_frozen_child_snapshot jsonb;
  v_frozen_parent_objects jsonb;
  v_frozen_child_objects jsonb;
  v_frozen_parent_revision uuid;
  v_frozen_catalog_revision integer;
  v_many_items jsonb;
  v_many_rows jsonb := '[]'::jsonb;
  v_many_set_id text;
  v_many_revision uuid;
  v_many_selection jsonb;
  v_many_parent_id uuid;
  v_many_parent_ids uuid[] := '{}';
  v_many_index integer;
  v_nested_child_revision uuid;
  v_nested_child_item uuid;
  v_nested_parent_revision uuid;
  v_nested_parent_item uuid;
  v_nested_selection jsonb;
  v_nested_actions jsonb;
  v_nested_child_def jsonb;
  v_nested_parent_def jsonb;
  v_nested_child_current_revision uuid;
  v_nested_review_id uuid;
  v_explicit_case record;
  v_explicit_def jsonb;
  v_explicit_selection jsonb;
  v_explicit_child_id uuid;
  v_explicit_parent_line_total numeric;
  v_explicit_parent_rounding_result numeric;
  v_explicit_parent_unit_price numeric;
  v_explicit_parent_discount numeric;
  v_explicit_child_line_total numeric;
  v_explicit_parent_snapshot jsonb;
  v_explicit_child_snapshot jsonb;
  v_explicit_parent_line_id uuid;
  v_explicit_child_line_id uuid;
  v_explicit_parent_line_count integer;
  v_explicit_child_line_count integer;
  v_individual_id uuid := 'b3000000-0000-4000-8000-000000000015'::uuid;
  v_integrity_parent uuid := 'b3000000-0000-4000-8000-000000000011'::uuid;
  v_fixed_parent uuid := 'b3000000-0000-4000-8000-000000000012'::uuid;
  v_regression_fixed_parent uuid := 'b3000000-0000-4000-8000-000000000016'::uuid;
  v_rounding_parent uuid := 'b3000000-0000-4000-8000-000000000013'::uuid;
  v_nested_parent uuid := 'b3000000-0000-4000-8000-000000000014'::uuid;
begin
  perform set_config('request.jwt.claim.sub', v_actor::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_actor::text, 'role', 'authenticated')::text,
    true
  );

  if to_regprocedure('public.clair_update_order_catalog_item(text,text,integer,jsonb)') is null
     or to_regprocedure('public.clair_sync_billing_invoice_candidates_from_chart(text,uuid,uuid,uuid[])') is null then
    raise exception 'clinical_master_phase1b3_regression_required_a3_rpc_missing';
  end if;

  -- The first replay DO has a one-child fixed set in draft state. Confirm it
  -- here, flush its valid envelope, and then isolate the child-only
  -- reverse-equality check before returning to deferred replay mode.
  v_parent_id := 'b3000000-0000-4000-8000-000000000002'::uuid;
  v_actions := public.clair_get_chart_order_actions('clair-demo', v_encounter);
  perform public.clair_save_chart_order_action(
    'clair-demo', v_actor, v_encounter, 'confirm', array[v_parent_id], v_actions->>'etag'
  );
  set constraints orders_set_child_parent_lineage_trg immediate;
  set constraints orders_set_child_parent_lineage_trg deferred;
  select id into v_child_id
  from public.orders
  where workspace_id = 'clair-demo'
    and parent_chart_order_line_id = v_parent_id
    and row_type = 'set_child'
    and status <> 'cancelled';
  if (select order_confirmation_status from public.orders where id = v_parent_id) not in ('confirmed', 'billed')
     or (select order_confirmation_status from public.orders where id = v_child_id) not in ('confirmed', 'billed') then
    raise exception 'clinical_master_phase1b3_regression_child_frozen_tamper_fixture_invalid';
  end if;
  select jsonb_build_object(
           'appliedSnapshot', applied_snapshot,
           'appliedPriceSnapshot', applied_price_snapshot,
           'calculationInputs', calculation_inputs,
           'calculationOutputs', calculation_outputs
         ), applied_snapshot_sha256
    into v_frozen_parent_objects, v_frozen_parent_hash
  from public.orders
  where workspace_id = 'clair-demo' and id = v_parent_id;
  select jsonb_build_object(
           'appliedSnapshot', applied_snapshot,
           'appliedPriceSnapshot', applied_price_snapshot,
           'calculationInputs', calculation_inputs,
           'calculationOutputs', calculation_outputs
         ), applied_snapshot_sha256
    into v_frozen_child_objects, v_frozen_child_hash
  from public.orders
  where workspace_id = 'clair-demo' and id = v_child_id;
  v_count_before := (
    select count(*)
    from public.orders
    where workspace_id = 'clair-demo' and encounter_id = v_encounter
  );
  v_tamper_applied := false;
  v_error := null;
  begin
    update public.orders
    set applied_snapshot = jsonb_set(
          applied_snapshot,
          '{displayName}',
          to_jsonb('tampered-confirmed-child-item'::text),
          true
        ),
        applied_snapshot_sha256 = private.clair_b3_sha256(jsonb_build_object(
          'appliedSnapshot', jsonb_set(
            applied_snapshot,
            '{displayName}',
            to_jsonb('tampered-confirmed-child-item'::text),
            true
          ),
          'appliedPriceSnapshot', applied_price_snapshot,
          'calculationInputs', calculation_inputs,
          'calculationOutputs', calculation_outputs
        ))
    where workspace_id = 'clair-demo' and id = v_child_id;
    set constraints orders_set_child_parent_lineage_trg immediate;
    v_tamper_applied := true;
  exception when others then
    get stacked diagnostics v_error = message_text;
    if v_error !~* 'parent.*item.*mismatch' then raise; end if;
  end;
  set constraints orders_set_child_parent_lineage_trg deferred;
  if v_tamper_applied then
    raise exception 'clinical_master_phase1b3_regression_child_frozen_tamper_accepted';
  end if;
  if (
       select jsonb_build_object(
                'appliedSnapshot', applied_snapshot,
                'appliedPriceSnapshot', applied_price_snapshot,
                'calculationInputs', calculation_inputs,
                'calculationOutputs', calculation_outputs
              )
       from public.orders
       where workspace_id = 'clair-demo' and id = v_parent_id
     ) is distinct from v_frozen_parent_objects
     or (select applied_snapshot_sha256 from public.orders where id = v_parent_id)
          is distinct from v_frozen_parent_hash
     or (
       select jsonb_build_object(
                'appliedSnapshot', applied_snapshot,
                'appliedPriceSnapshot', applied_price_snapshot,
                'calculationInputs', calculation_inputs,
                'calculationOutputs', calculation_outputs
              )
       from public.orders
       where workspace_id = 'clair-demo' and id = v_child_id
     ) is distinct from v_frozen_child_objects
     or (select applied_snapshot_sha256 from public.orders where id = v_child_id)
          is distinct from v_frozen_child_hash
     or (select count(*) from public.orders
         where workspace_id = 'clair-demo' and encounter_id = v_encounter) <> v_count_before
     or (select order_confirmation_status from public.orders where id = v_parent_id)
          not in ('confirmed', 'billed')
     or (select order_confirmation_status from public.orders where id = v_child_id)
          not in ('confirmed', 'billed') then
    raise exception 'clinical_master_phase1b3_regression_child_frozen_tamper_transaction_invalid';
  end if;

  -- Seed an independent sum set so the integrity cases do not alter the
  -- simpler smoke fixture above.
  select catalog_revision into v_catalog_revision
  from public.order_catalog_items
  where workspace_id = 'clair-demo' and id = 'den194-catalog-cbc';
  v_request := private.clair_b2_deterministic_uuid(
    'replay', array['clair-demo', 'b3-regression-sum', '2026-08-20']::text[]
  );
  v_seed_result := private.clair_seed_order_set_compatibility_projection(
    'clair-demo', 'b2-regression-sum',
    jsonb_build_object(
      'setCategory', 'B3 regression', 'setName', 'B3 regression sum',
      'billingName', 'B3 regression sum billing',
      'amountBasis', 'included_order_sum', 'setPriceKrw', null,
      'rangeBasis', null, 'salesUnit', 'per_each',
      'billingReflectionEnabled', false, 'taxType', 'derived',
      'targetSpecies', jsonb_build_array('dog'), 'careGuide', null,
      'internalInstruction', null,
      'items', jsonb_build_array(jsonb_build_object(
        'childKind', 'atomic', 'childOrderCatalogItemId', 'den194-catalog-cbc',
        'childOrderCatalogRevision', v_catalog_revision,
        'childOrderSetId', null, 'childSetRevisionId', null, 'sortOrder', 1,
        'defaultSelected', true, 'billingReflectionDefault', true,
        'defaultQuantity', 1, 'quantitySource', 'manual_at_apply'
      )),
      'priceRanges', jsonb_build_array()
    ),
    'active', v_actor, v_request
  );
  if v_seed_result->>'outcome' <> 'created' then
    raise exception 'clinical_master_phase1b3_regression_sum_seed_failed:%', v_seed_result;
  end if;

  select current_revision_id into v_revision
  from public.order_sets
  where workspace_id = 'clair-demo' and id = 'b2-regression-sum';
  select id into v_item
  from public.order_set_revision_items
  where workspace_id = 'clair-demo' and order_set_id = 'b2-regression-sum'
    and revision_id = v_revision and child_kind = 'atomic';
  v_selection := jsonb_build_object('items', jsonb_build_array(jsonb_build_object(
    'revisionItemId', v_item, 'selected', true, 'quantity', 0.001
  )));
  v_preview := public.clair_preview_chart_order_set(
    'clair-demo', v_encounter, 'b2-regression-sum', v_revision, v_selection
  );
  v_saved := public.clair_get_chart_order_draft('clair-demo', v_encounter);
  v_saved := public.clair_save_chart_order_draft(
    'clair-demo', v_actor::text, v_encounter,
    jsonb_build_object(
      'expectedEtag', v_saved->>'etag',
      'rows', jsonb_build_array(jsonb_build_object(
        'rowType', 'set', 'orderId', v_integrity_parent,
        'sourceSetId', 'b2-regression-sum', 'sourceSetRevisionId', v_revision,
        'sourceSetRevisionNo', (select revision_no from public.order_set_revisions where id = v_revision),
        'selectionIntent', v_selection
      ))
    )
  );
  select o.id, o.applied_snapshot_sha256, private.clair_b3_sha256(jsonb_build_object(
      'appliedSnapshot', o.applied_snapshot,
      'appliedPriceSnapshot', o.applied_price_snapshot,
      'calculationInputs', o.calculation_inputs,
      'calculationOutputs', o.calculation_outputs
    ))
    into v_parent_id, v_hash_before, v_recomputed_hash
  from public.orders o
  where o.workspace_id = 'clair-demo' and o.id = v_integrity_parent;
  if v_parent_id is null
     or v_hash_before is distinct from v_recomputed_hash
     or (select applied_snapshot_schema_version from public.orders where id = v_integrity_parent) <> 1
     or (select applied_snapshot_sha256 from public.orders where id = v_integrity_parent) is null
     or jsonb_typeof((select applied_snapshot from public.orders where id = v_integrity_parent)) <> 'object'
     or jsonb_typeof((select applied_price_snapshot from public.orders where id = v_integrity_parent)) <> 'object'
     or jsonb_typeof((select calculation_inputs from public.orders where id = v_integrity_parent)) <> 'object'
     or jsonb_typeof((select calculation_outputs from public.orders where id = v_integrity_parent)) <> 'object'
     or (select applied_price_snapshot->>'billedAs' from public.orders where id = v_integrity_parent) <> 'nonbillable_parent'
     or (select applied_snapshot->>'rowType' from public.orders where id = v_integrity_parent) <> 'set'
  then
    raise exception 'clinical_master_phase1b3_regression_four_object_envelope_invalid';
  end if;
  select o.id, o.applied_snapshot_sha256 into v_child_id, v_child_hash_before
  from public.orders o
  where o.workspace_id = 'clair-demo'
    and o.parent_chart_order_line_id = v_integrity_parent
    and o.row_type = 'set_child' and o.status <> 'cancelled';
  if v_child_id is null
     or (select applied_snapshot->>'rowType' from public.orders where id = v_child_id) <> 'set_child'
     or (select applied_price_snapshot->>'billedAs' from public.orders where id = v_child_id) <> 'atomic_child'
     or (select applied_snapshot->>'sourceSetId' from public.orders where id = v_child_id) <> 'b2-regression-sum'
     or v_child_hash_before is distinct from private.clair_b3_sha256(jsonb_build_object(
       'appliedSnapshot', (select applied_snapshot from public.orders where id = v_child_id),
       'appliedPriceSnapshot', (select applied_price_snapshot from public.orders where id = v_child_id),
       'calculationInputs', (select calculation_inputs from public.orders where id = v_child_id),
       'calculationOutputs', (select calculation_outputs from public.orders where id = v_child_id)
     )) then
    raise exception 'clinical_master_phase1b3_regression_child_envelope_invalid';
  end if;

  -- A valid edit changes the reconciliation hash and all four-object inputs,
  -- while keeping the same root/leaf rows rather than duplicating them.
  v_hash_before := (select applied_snapshot_sha256 from public.orders where id = v_integrity_parent);
  v_saved := public.clair_get_chart_order_draft('clair-demo', v_encounter);
  v_selection := jsonb_build_object('items', jsonb_build_array(jsonb_build_object(
    'revisionItemId', v_item, 'selected', true, 'quantity', 0.002
  )));
  perform public.clair_save_chart_order_draft(
    'clair-demo', v_actor::text, v_encounter,
    jsonb_build_object(
      'expectedEtag', v_saved->>'etag',
      'rows', jsonb_build_array(jsonb_build_object(
        'rowType', 'set', 'orderId', v_integrity_parent,
        'sourceSetId', 'b2-regression-sum', 'sourceSetRevisionId', v_revision,
        'sourceSetRevisionNo', (select revision_no from public.order_set_revisions where id = v_revision),
        'selectionIntent', v_selection
      ))
    )
  );
  select parent.applied_snapshot_sha256, child.applied_snapshot_sha256
    into v_hash_after, v_child_hash_after
  from public.orders parent
  join public.orders child
    on child.workspace_id = parent.workspace_id
   and child.parent_chart_order_line_id = parent.id
   and child.id = v_child_id
  where parent.workspace_id = 'clair-demo' and parent.id = v_integrity_parent;
  if v_hash_after is null or v_hash_after = v_hash_before
     or v_hash_after is distinct from private.clair_b3_sha256(jsonb_build_object(
       'appliedSnapshot', (select applied_snapshot from public.orders where id = v_integrity_parent),
       'appliedPriceSnapshot', (select applied_price_snapshot from public.orders where id = v_integrity_parent),
       'calculationInputs', (select calculation_inputs from public.orders where id = v_integrity_parent),
       'calculationOutputs', (select calculation_outputs from public.orders where id = v_integrity_parent)
     ))
     or v_child_hash_after is null or v_child_hash_after = v_child_hash_before
     or v_child_hash_after is distinct from private.clair_b3_sha256(jsonb_build_object(
       'appliedSnapshot', (select applied_snapshot from public.orders where id = v_child_id),
       'appliedPriceSnapshot', (select applied_price_snapshot from public.orders where id = v_child_id),
       'calculationInputs', (select calculation_inputs from public.orders where id = v_child_id),
       'calculationOutputs', (select calculation_outputs from public.orders where id = v_child_id)
     ))
     or (select quantity from public.orders where id = v_child_id) <> 0.002 then
    raise exception 'clinical_master_phase1b3_regression_reconciliation_hash_invalid';
  end if;

  -- First reject an unchanged hash after a cross-object price tamper.
  v_tamper_applied := false;
  begin
    update public.orders
    set applied_price_snapshot = applied_price_snapshot || jsonb_build_object('billedAs', 'atomic_child')
    where workspace_id = 'clair-demo' and id = v_integrity_parent;
    set constraints orders_set_child_parent_lineage_trg immediate;
    v_tamper_applied := true;
  exception when others then
    get stacked diagnostics v_error = message_text;
    if v_error !~* '(snapshot|hash|integrity)' then raise; end if;
  end;
  if v_tamper_applied then
    v_actions := public.clair_get_chart_order_actions('clair-demo', v_encounter);
    begin
      perform public.clair_save_chart_order_action(
        'clair-demo', v_actor, v_encounter, 'confirm', array[v_integrity_parent], v_actions->>'etag'
      );
      raise exception 'clinical_master_phase1b3_regression_tampered_hash_accepted';
    exception when others then
      get stacked diagnostics v_error = message_text;
      if v_error = 'clinical_master_phase1b3_regression_tampered_hash_accepted'
         or v_error !~* '(snapshot|hash|integrity)' then raise; end if;
    end;
    if (select order_confirmation_status from public.orders where id = v_integrity_parent) not in ('draft', 'pending') then
      raise exception 'clinical_master_phase1b3_regression_tamper_changed_lifecycle';
    end if;
    v_saved := public.clair_get_chart_order_draft('clair-demo', v_encounter);
    v_selection := jsonb_build_object('items', jsonb_build_array(jsonb_build_object(
      'revisionItemId', v_item, 'selected', true, 'quantity', 0.002
    )));
    perform public.clair_save_chart_order_draft(
      'clair-demo', v_actor::text, v_encounter,
      jsonb_build_object(
        'expectedEtag', v_saved->>'etag',
        'rows', jsonb_build_array(jsonb_build_object(
          'rowType', 'set', 'orderId', v_integrity_parent,
          'sourceSetId', 'b2-regression-sum', 'sourceSetRevisionId', v_revision,
          'sourceSetRevisionNo', (select revision_no from public.order_set_revisions where id = v_revision),
          'selectionIntent', v_selection
        ))
      )
    );
  end if;

  -- A hash that is recomputed over a cross-field-inconsistent schema-1 object
  -- must still be rejected; matching the digest alone is insufficient.
  v_tamper_applied := false;
  begin
    update public.orders
    set applied_snapshot = jsonb_set(
      applied_snapshot, '{rowType}', to_jsonb('individual'::text), true
    ),
        applied_snapshot_sha256 = private.clair_b3_sha256(jsonb_build_object(
          'appliedSnapshot', jsonb_set(applied_snapshot, '{rowType}', to_jsonb('individual'::text), true),
          'appliedPriceSnapshot', applied_price_snapshot,
          'calculationInputs', calculation_inputs,
          'calculationOutputs', calculation_outputs
        ))
    where workspace_id = 'clair-demo' and id = v_integrity_parent;
    set constraints orders_set_child_parent_lineage_trg immediate;
    v_tamper_applied := true;
  exception when others then
    get stacked diagnostics v_error = message_text;
    if v_error !~* '(snapshot|hash|integrity|lineage)' then raise; end if;
  end;
  if v_tamper_applied then
    v_actions := public.clair_get_chart_order_actions('clair-demo', v_encounter);
    begin
      perform public.clair_save_chart_order_action(
        'clair-demo', v_actor, v_encounter, 'confirm', array[v_integrity_parent], v_actions->>'etag'
      );
      raise exception 'clinical_master_phase1b3_regression_cross_field_tamper_accepted';
    exception when others then
      get stacked diagnostics v_error = message_text;
      if v_error = 'clinical_master_phase1b3_regression_cross_field_tamper_accepted'
         or v_error !~* '(snapshot|hash|integrity|lineage)' then raise; end if;
    end;
    v_saved := public.clair_get_chart_order_draft('clair-demo', v_encounter);
    v_selection := jsonb_build_object('items', jsonb_build_array(jsonb_build_object(
      'revisionItemId', v_item, 'selected', true, 'quantity', 0.002
    )));
    perform public.clair_save_chart_order_draft(
      'clair-demo', v_actor::text, v_encounter,
      jsonb_build_object(
        'expectedEtag', v_saved->>'etag',
        'rows', jsonb_build_array(jsonb_build_object(
          'rowType', 'set', 'orderId', v_integrity_parent,
          'sourceSetId', 'b2-regression-sum', 'sourceSetRevisionId', v_revision,
          'sourceSetRevisionNo', (select revision_no from public.order_set_revisions where id = v_revision),
          'selectionIntent', v_selection
        ))
      )
    );
  end if;
  if (select applied_snapshot->>'rowType' from public.orders where id = v_integrity_parent) <> 'set'
     or (select applied_snapshot_sha256 from public.orders where id = v_integrity_parent) is distinct from private.clair_b3_sha256(jsonb_build_object(
       'appliedSnapshot', (select applied_snapshot from public.orders where id = v_integrity_parent),
       'appliedPriceSnapshot', (select applied_price_snapshot from public.orders where id = v_integrity_parent),
       'calculationInputs', (select calculation_inputs from public.orders where id = v_integrity_parent),
       'calculationOutputs', (select calculation_outputs from public.orders where id = v_integrity_parent)
     )) then
    raise exception 'clinical_master_phase1b3_regression_reconciliation_failed';
  end if;

  -- A parent item is a frozen copy of its persisted child. Recomputing the
  -- four-object hash cannot authorize a parent-only item-field tamper.
  v_hash_before := (select applied_snapshot_sha256 from public.orders where id = v_integrity_parent);
  v_child_hash_before := (select applied_snapshot_sha256 from public.orders where id = v_child_id);
  v_count_before := (select count(*) from public.orders
                     where workspace_id = 'clair-demo' and encounter_id = v_encounter);
  v_tamper_applied := false;
  begin
    update public.orders
    set applied_snapshot = jsonb_set(
          applied_snapshot,
          '{items,0,displayName}',
          to_jsonb('tampered-parent-item'::text),
          true
        ),
        applied_snapshot_sha256 = private.clair_b3_sha256(jsonb_build_object(
          'appliedSnapshot', jsonb_set(
            applied_snapshot,
            '{items,0,displayName}',
            to_jsonb('tampered-parent-item'::text),
            true
          ),
          'appliedPriceSnapshot', applied_price_snapshot,
          'calculationInputs', calculation_inputs,
          'calculationOutputs', calculation_outputs
        ))
    where workspace_id = 'clair-demo' and id = v_integrity_parent;
    set constraints orders_set_child_parent_lineage_trg immediate;
    v_tamper_applied := true;
  exception when others then
    get stacked diagnostics v_error = message_text;
    if v_error !~* '(snapshot|hash|integrity|lineage|child)' then raise; end if;
  end;
  if v_tamper_applied then
    v_actions := public.clair_get_chart_order_actions('clair-demo', v_encounter);
    begin
      perform public.clair_save_chart_order_action(
        'clair-demo', v_actor, v_encounter, 'confirm', array[v_integrity_parent], v_actions->>'etag'
      );
      raise exception 'clinical_master_phase1b3_regression_parent_child_frozen_tamper_accepted';
    exception when others then
      get stacked diagnostics v_error = message_text;
      if v_error = 'clinical_master_phase1b3_regression_parent_child_frozen_tamper_accepted'
         or v_error !~* '(snapshot|hash|integrity|lineage|child)' then raise; end if;
    end;
    if (select order_confirmation_status from public.orders where id = v_integrity_parent) not in ('draft', 'pending') then
      raise exception 'clinical_master_phase1b3_regression_parent_child_frozen_tamper_changed_lifecycle';
    end if;
    v_saved := public.clair_get_chart_order_draft('clair-demo', v_encounter);
    perform public.clair_save_chart_order_draft(
      'clair-demo', v_actor::text, v_encounter,
      jsonb_build_object('expectedEtag', v_saved->>'etag', 'rows', jsonb_build_array(jsonb_build_object(
        'rowType', 'set', 'orderId', v_integrity_parent,
        'sourceSetId', 'b2-regression-sum', 'sourceSetRevisionId', v_revision,
        'sourceSetRevisionNo', (select revision_no from public.order_set_revisions where id = v_revision),
        'selectionIntent', jsonb_build_object('items', jsonb_build_array(jsonb_build_object(
          'revisionItemId', v_item, 'selected', true, 'quantity', 0.002
        )))
      )))
    );
  end if;
  if (select count(*) from public.orders
      where workspace_id = 'clair-demo' and encounter_id = v_encounter) <> v_count_before
     or (select applied_snapshot_sha256 from public.orders where id = v_integrity_parent) is distinct from private.clair_b3_sha256(jsonb_build_object(
       'appliedSnapshot', (select applied_snapshot from public.orders where id = v_integrity_parent),
       'appliedPriceSnapshot', (select applied_price_snapshot from public.orders where id = v_integrity_parent),
       'calculationInputs', (select calculation_inputs from public.orders where id = v_integrity_parent),
       'calculationOutputs', (select calculation_outputs from public.orders where id = v_integrity_parent)
     ))
     or (select applied_snapshot_sha256 from public.orders where id = v_child_id) is distinct from private.clair_b3_sha256(jsonb_build_object(
       'appliedSnapshot', (select applied_snapshot from public.orders where id = v_child_id),
       'appliedPriceSnapshot', (select applied_price_snapshot from public.orders where id = v_child_id),
       'calculationInputs', (select calculation_inputs from public.orders where id = v_child_id),
       'calculationOutputs', (select calculation_outputs from public.orders where id = v_child_id)
     )) then
    raise exception 'clinical_master_phase1b3_regression_parent_child_frozen_tamper_transaction_invalid';
  end if;

  -- fixed_one is a server-owned quantity and cannot be overridden at apply.
  select current_revision_id into v_revision
  from public.order_sets where workspace_id = 'clair-demo' and id = 'b2-replay-fixed';
  select id into v_item
  from public.order_set_revision_items
  where workspace_id = 'clair-demo' and order_set_id = 'b2-replay-fixed'
    and revision_id = v_revision and child_kind = 'atomic';
  select count(*) into v_count_before
  from public.orders
  where workspace_id = 'clair-demo' and encounter_id = v_encounter;
  begin
    perform public.clair_preview_chart_order_set(
      'clair-demo', v_encounter, 'b2-replay-fixed', v_revision,
      jsonb_build_object('items', jsonb_build_array(jsonb_build_object(
        'revisionItemId', v_item, 'selected', true, 'quantity', 2
      )))
    );
    raise exception 'clinical_master_phase1b3_regression_fixed_one_override_accepted';
  exception when others then
    get stacked diagnostics v_error = message_text;
    if v_error = 'clinical_master_phase1b3_regression_fixed_one_override_accepted'
      or v_error !~* '(quantity|fixed_one)' then raise; end if;
  end;
  select count(*) into v_count_after
  from public.orders
  where workspace_id = 'clair-demo' and encounter_id = v_encounter;
  if v_count_after <> v_count_before then
    raise exception 'clinical_master_phase1b3_regression_fixed_one_created_row';
  end if;

  -- More than 100 input rows must fail before any transactional row is
  -- inserted or updated.
  v_saved := public.clair_get_chart_order_draft('clair-demo', v_encounter);
  select count(*) into v_count_before
  from public.orders where workspace_id = 'clair-demo' and encounter_id = v_encounter;
  select coalesce(jsonb_agg(jsonb_build_object(
      'rowType', 'individual',
      'orderId', gen_random_uuid(),
      'workspaceCatalogItemId', 'den194-catalog-cbc',
      'quantity', 1
    )), '[]'::jsonb)
    into v_rows
  from generate_series(1, 101);
  begin
    perform public.clair_save_chart_order_draft(
      'clair-demo', v_actor::text, v_encounter,
      jsonb_build_object('expectedEtag', v_saved->>'etag', 'rows', v_rows)
    );
    raise exception 'clinical_master_phase1b3_regression_over_100_accepted';
  exception when others then
    get stacked diagnostics v_error = message_text;
    if v_error = 'clinical_master_phase1b3_regression_over_100_accepted'
       or v_error !~* '(invalid_order_rows|100|too_large)' then raise; end if;
  end;
  select count(*) into v_count_after
  from public.orders where workspace_id = 'clair-demo' and encounter_id = v_encounter;
  if v_count_after <> v_count_before then
    raise exception 'clinical_master_phase1b3_regression_over_100_partial_write';
  end if;

  -- The cap is transaction-wide: one request containing multiple set roots
  -- must reject when parent plus selected children exceed 100, with no root
  -- or child row from that request written. Reuse the nine active catalog
  -- members across eleven independent synthetic sets (99 children + 11 roots).
  select jsonb_agg(jsonb_build_object(
      'childKind', 'atomic',
      'childOrderCatalogItemId', item.id,
      'childOrderCatalogRevision', item.catalog_revision,
      'childOrderSetId', null, 'childSetRevisionId', null,
      'sortOrder', item.sort_order, 'defaultSelected', true,
      'billingReflectionDefault', false, 'defaultQuantity', 1,
      'quantitySource', 'fixed_one'
    ) order by item.sort_order)
    into v_many_items
  from (
    select c.id, c.catalog_revision,
           row_number() over (order by c.id)::integer as sort_order
    from public.order_catalog_items c
    where c.workspace_id = 'clair-demo' and c.availability_status = 'active'
    order by c.id
    limit 9
  ) item;
  if coalesce(jsonb_array_length(v_many_items), 0) <> 9 then
    raise exception 'clinical_master_phase1b3_regression_multi_set_fixture_invalid';
  end if;
  v_many_rows := '[]'::jsonb;
  v_many_parent_ids := '{}';
  for v_many_index in 1..11 loop
    v_many_set_id := 'b2-regression-many-' || lpad(v_many_index::text, 2, '0');
    v_request := private.clair_b2_deterministic_uuid(
      'replay', array['clair-demo', v_many_set_id, '2026-08-20']::text[]
    );
    v_seed_result := private.clair_seed_order_set_compatibility_projection(
      'clair-demo', v_many_set_id,
      jsonb_build_object(
        'setCategory', 'B3 regression', 'setName', 'B3 multi-set over 100 ' || v_many_index,
        'billingName', 'B3 multi-set over 100 ' || v_many_index,
        'amountBasis', 'included_order_sum', 'setPriceKrw', null,
        'rangeBasis', null, 'salesUnit', 'per_each',
        'billingReflectionEnabled', false, 'taxType', 'derived',
        'targetSpecies', jsonb_build_array('dog'), 'careGuide', null,
        'internalInstruction', null, 'items', v_many_items,
        'priceRanges', jsonb_build_array()
      ),
      'active', v_actor, v_request
    );
    if v_seed_result->>'outcome' <> 'created' then
      raise exception 'clinical_master_phase1b3_regression_multi_set_seed_failed:%', v_seed_result;
    end if;
    select current_revision_id into v_many_revision
    from public.order_sets
    where workspace_id = 'clair-demo' and id = v_many_set_id;
    select jsonb_build_object('items', jsonb_agg(jsonb_build_object(
      'revisionItemId', item.id, 'selected', true, 'quantity', 1
    ) order by item.sort_order))
      into v_many_selection
    from public.order_set_revision_items item
    where item.workspace_id = 'clair-demo'
      and item.order_set_id = v_many_set_id
      and item.revision_id = v_many_revision;
    v_many_parent_id := (
      'b3000000-0000-4000-8000-' || lpad((20 + v_many_index)::text, 12, '0')
    )::uuid;
    v_many_parent_ids := array_append(v_many_parent_ids, v_many_parent_id);
    v_many_rows := v_many_rows || jsonb_build_array(jsonb_build_object(
      'rowType', 'set', 'orderId', v_many_parent_id,
      'sourceSetId', v_many_set_id, 'sourceSetRevisionId', v_many_revision,
      'sourceSetRevisionNo', (select revision_no from public.order_set_revisions where id = v_many_revision),
      'selectionIntent', v_many_selection
    ));
  end loop;
  v_saved := public.clair_get_chart_order_draft('clair-demo', v_encounter);
  select count(*) into v_count_before
  from public.orders where workspace_id = 'clair-demo' and encounter_id = v_encounter;
  begin
    perform public.clair_save_chart_order_draft(
      'clair-demo', v_actor::text, v_encounter,
      jsonb_build_object('expectedEtag', v_saved->>'etag', 'rows', v_many_rows)
    );
    raise exception 'clinical_master_phase1b3_regression_multi_set_over_100_accepted';
  exception when others then
    get stacked diagnostics v_error = message_text;
    if v_error <> 'order_set_too_many_rows'
       and v_error <> 'clinical_master_phase1b3_regression_multi_set_over_100_accepted' then
      raise;
    end if;
  end;
  select count(*) into v_count_after
  from public.orders where workspace_id = 'clair-demo' and encounter_id = v_encounter;
  if v_count_after <> v_count_before
     or exists (select 1 from public.orders where id = any(v_many_parent_ids)) then
    raise exception 'clinical_master_phase1b3_regression_multi_set_over_100_partial_write';
  end if;

  -- The bill action never creates a candidate for the nonbillable sum parent,
  -- but the selected atomic child remains eligible for A3 billing sync.
  v_actions := public.clair_get_chart_order_actions('clair-demo', v_encounter);
  v_action := public.clair_save_chart_order_action(
    'clair-demo', v_actor, v_encounter, 'confirm', array[v_integrity_parent], v_actions->>'etag'
  );
  v_actions := public.clair_get_chart_order_actions('clair-demo', v_encounter);
  v_action := public.clair_save_chart_order_action(
    'clair-demo', v_actor, v_encounter, 'bill', array[v_integrity_parent], v_actions->>'etag'
  );
  if (select billing_candidate_status from public.orders where id = v_integrity_parent) = 'candidate_created'
     or (select billing_candidate_status from public.orders where id = v_child_id) <> 'candidate_created' then
    raise exception 'clinical_master_phase1b3_regression_nonbillable_bill_candidate_invalid';
  end if;
  v_billing := public.clair_sync_billing_invoice_candidates_from_chart(
    'clair-demo', v_actor, v_encounter, array[v_child_id]
  );
  select o.invoice_line_id into v_invoice_line_id
  from public.orders o where o.workspace_id = 'clair-demo' and o.id = v_child_id;
  if v_invoice_line_id is null
     or (select tax_type from public.invoice_lines where id = v_invoice_line_id)
          is distinct from (select applied_price_snapshot->>'taxType' from public.orders where id = v_child_id)
     or (select source_order_snapshot->'appliedPriceSnapshot' from public.invoice_lines where id = v_invoice_line_id)
          is distinct from (select applied_price_snapshot from public.orders where id = v_child_id) then
    raise exception 'clinical_master_phase1b3_regression_child_tax_snapshot_parity_failed';
  end if;

  -- Fixed zero/non-taxable parent is billable once; its nonbillable child is
  -- never emitted as a candidate, and A3 preserves the frozen tax snapshot.
  select catalog_revision into v_catalog_revision
  from public.order_catalog_items
  where workspace_id = 'clair-demo' and id = 'den194-catalog-wellness-vaccine';
  v_request := private.clair_b2_deterministic_uuid(
    'replay', array['clair-demo', 'b3-regression-fixed', '2026-08-20']::text[]
  );
  v_seed_result := private.clair_seed_order_set_compatibility_projection(
    'clair-demo', 'b2-regression-fixed',
    jsonb_build_object(
      'setCategory', 'B3 regression', 'setName', 'B3 regression fixed',
      'billingName', 'B3 regression fixed billing',
      'amountBasis', 'set_fixed_price', 'setPriceKrw', 0,
      'rangeBasis', null, 'salesUnit', 'per_each',
      'billingReflectionEnabled', true, 'taxType', 'non_taxable',
      'targetSpecies', jsonb_build_array('dog'), 'careGuide', null,
      'internalInstruction', null,
      'items', jsonb_build_array(jsonb_build_object(
        'childKind', 'atomic', 'childOrderCatalogItemId', 'den194-catalog-wellness-vaccine',
        'childOrderCatalogRevision', v_catalog_revision,
        'childOrderSetId', null, 'childSetRevisionId', null, 'sortOrder', 1,
        'defaultSelected', true, 'billingReflectionDefault', false,
        'defaultQuantity', 1, 'quantitySource', 'fixed_one'
      )),
      'priceRanges', jsonb_build_array()
    ),
    'active', v_actor, v_request
  );
  if v_seed_result->>'outcome' <> 'created' then
    raise exception 'clinical_master_phase1b3_regression_fixed_seed_failed:%', v_seed_result;
  end if;
  select current_revision_id into v_revision
  from public.order_sets where workspace_id = 'clair-demo' and id = 'b2-regression-fixed';
  select id into v_item
  from public.order_set_revision_items
  where workspace_id = 'clair-demo' and order_set_id = 'b2-regression-fixed'
    and revision_id = v_revision and child_kind = 'atomic';
  v_selection := jsonb_build_object('items', jsonb_build_array(jsonb_build_object(
    'revisionItemId', v_item, 'selected', true, 'quantity', 1
  )));
  v_saved := public.clair_get_chart_order_draft('clair-demo', v_encounter);
  perform public.clair_save_chart_order_draft(
    'clair-demo', v_actor::text, v_encounter,
    jsonb_build_object('expectedEtag', v_saved->>'etag', 'rows', jsonb_build_array(jsonb_build_object(
      'rowType', 'set', 'orderId', v_regression_fixed_parent,
      'sourceSetId', 'b2-regression-fixed', 'sourceSetRevisionId', v_revision,
      'sourceSetRevisionNo', (select revision_no from public.order_set_revisions where id = v_revision),
      'selectionIntent', v_selection
    )))
  );
  if (select applied_price_snapshot->>'billedAs' from public.orders where id = v_regression_fixed_parent) <> 'set_parent'
     or (select applied_price_snapshot->>'taxType' from public.orders where id = v_regression_fixed_parent) <> 'non_taxable'
     or (select applied_price_snapshot->>'billedAs' from public.orders where parent_chart_order_line_id = v_regression_fixed_parent) <> 'atomic_child' then
    raise exception 'clinical_master_phase1b3_regression_fixed_billed_as_invalid';
  end if;
  v_actions := public.clair_get_chart_order_actions('clair-demo', v_encounter);
  perform public.clair_save_chart_order_action(
    'clair-demo', v_actor, v_encounter, 'confirm', array[v_regression_fixed_parent], v_actions->>'etag'
  );
  -- Billing reads the confirmed four-object rows, not the mutable current set
  -- or catalog. Mutate both authorities after confirm, then prove the parent
  -- still bills while its nonbillable child remains outside candidate state.
  v_frozen_parent_revision := v_revision;
  select applied_snapshot_sha256, applied_snapshot
    into v_frozen_parent_hash, v_frozen_parent_snapshot
  from public.orders where id = v_regression_fixed_parent;
  select id, applied_snapshot_sha256, applied_snapshot, workspace_catalog_revision
    into v_child_id, v_frozen_child_hash, v_frozen_child_snapshot, v_frozen_catalog_revision
  from public.orders
  where parent_chart_order_line_id = v_regression_fixed_parent
    and row_type = 'set_child' and status <> 'cancelled';

  v_frozen_def := jsonb_build_object(
    'setCategory', 'B3 regression', 'setName', 'B3 regression fixed',
    'billingName', 'B3 regression fixed billing',
    'amountBasis', 'set_fixed_price', 'setPriceKrw', 0,
    'rangeBasis', null, 'salesUnit', 'per_each',
    'billingReflectionEnabled', true, 'taxType', 'non_taxable',
    'targetSpecies', jsonb_build_array('dog'), 'careGuide', null,
    'internalInstruction', null,
    'items', jsonb_build_array(jsonb_build_object(
      'childKind', 'atomic', 'childOrderCatalogItemId', 'den194-catalog-wellness-vaccine',
      'childOrderCatalogRevision', v_catalog_revision,
      'childOrderSetId', null, 'childSetRevisionId', null, 'sortOrder', 1,
      'defaultSelected', true, 'billingReflectionDefault', false,
      'defaultQuantity', 1, 'quantitySource', 'fixed_one'
    )),
    'priceRanges', jsonb_build_array()
  );
  v_request := private.clair_b2_deterministic_uuid(
    'replay', array['clair-demo', 'b3-regression-fixed-post-confirm-mutation', '2026-08-20']::text[]
  );
  v_seed_result := public.clair_save_order_set_revision(
    'clair-demo', 'b2-regression-fixed', v_frozen_parent_revision,
    v_frozen_def, 'inactive', v_request
  );
  if v_seed_result->>'outcome' <> 'applied'
     or (select availability_status from public.order_sets
         where workspace_id = 'clair-demo' and id = 'b2-regression-fixed') <> 'inactive'
     or (select current_revision_id from public.order_sets
         where workspace_id = 'clair-demo' and id = 'b2-regression-fixed') = v_frozen_parent_revision then
    raise exception 'clinical_master_phase1b3_regression_frozen_set_mutation_failed:%', v_seed_result;
  end if;
  v_catalog_result := public.clair_update_order_catalog_item(
    'clair-demo', 'den194-catalog-wellness-vaccine', v_catalog_revision,
    jsonb_build_object('availabilityStatus', 'inactive')
  );
  if v_catalog_result->>'ok' <> 'true'
     or (select availability_status from public.order_catalog_items
         where workspace_id = 'clair-demo' and id = 'den194-catalog-wellness-vaccine') <> 'inactive'
     or (select catalog_revision from public.order_catalog_items
         where workspace_id = 'clair-demo' and id = 'den194-catalog-wellness-vaccine') = v_frozen_catalog_revision then
    raise exception 'clinical_master_phase1b3_regression_frozen_catalog_mutation_failed:%', v_catalog_result;
  end if;
  v_actions := public.clair_get_chart_order_actions('clair-demo', v_encounter);
  v_action := public.clair_save_chart_order_action(
    'clair-demo', v_actor, v_encounter, 'bill', array[v_regression_fixed_parent], v_actions->>'etag'
  );
  if v_action->>'stored' <> 'false'
     or (select billing_candidate_status from public.orders where id = v_regression_fixed_parent) <> 'candidate_created'
     or (select billing_candidate_status from public.orders where id = v_child_id) = 'candidate_created'
     or (select order_confirmation_status from public.orders where id = v_regression_fixed_parent) <> 'confirmed'
     or (select order_confirmation_status from public.orders where id = v_child_id) <> 'confirmed'
     or (select applied_snapshot_sha256 from public.orders where id = v_regression_fixed_parent) is distinct from v_frozen_parent_hash
     or (select applied_snapshot from public.orders where id = v_regression_fixed_parent) is distinct from v_frozen_parent_snapshot
     or (select applied_snapshot_sha256 from public.orders where id = v_child_id) is distinct from v_frozen_child_hash
     or (select applied_snapshot from public.orders where id = v_child_id) is distinct from v_frozen_child_snapshot
     or (select source_set_revision_id from public.orders where id = v_regression_fixed_parent) is distinct from v_frozen_parent_revision
     or (select workspace_catalog_revision from public.orders where id = v_child_id) is distinct from v_frozen_catalog_revision then
    raise exception 'clinical_master_phase1b3_regression_fixed_child_candidate_invalid';
  end if;
  -- Restore only the mutable catalog authority needed by the later schema-0
  -- refresh assertion; the confirmed rows above remain frozen evidence.
  select catalog_revision into v_catalog_revision
  from public.order_catalog_items
  where workspace_id = 'clair-demo' and id = 'den194-catalog-wellness-vaccine';
  v_catalog_result := public.clair_update_order_catalog_item(
    'clair-demo', 'den194-catalog-wellness-vaccine', v_catalog_revision,
    jsonb_build_object('availabilityStatus', 'active')
  );
  if v_catalog_result->>'ok' <> 'true' then
    raise exception 'clinical_master_phase1b3_regression_frozen_catalog_restore_failed:%', v_catalog_result;
  end if;
  v_billing := public.clair_sync_billing_invoice_candidates_from_chart(
    'clair-demo', v_actor, v_encounter, array[v_regression_fixed_parent]
  );
  select invoice_line_id into v_invoice_line_id from public.orders where id = v_regression_fixed_parent;
  if v_invoice_line_id is null
     or (select tax_type from public.invoice_lines where id = v_invoice_line_id) <> 'non_taxable'
     or (select source_order_snapshot->'appliedPriceSnapshot' from public.invoice_lines where id = v_invoice_line_id)
          is distinct from (select applied_price_snapshot from public.orders where id = v_regression_fixed_parent) then
    raise exception 'clinical_master_phase1b3_regression_non_taxable_invoice_parity_failed';
  end if;

  -- Individual rows remain A3 schema 0 and refresh their mutable catalog
  -- revision through the A3 authority, without acquiring a B3 hash.
  select catalog_revision into v_catalog_revision
  from public.order_catalog_items
  where workspace_id = 'clair-demo' and id = 'den194-catalog-wellness-vaccine';
  v_saved := public.clair_get_chart_order_draft('clair-demo', v_encounter);
  perform public.clair_save_chart_order_draft(
    'clair-demo', v_actor::text, v_encounter,
    jsonb_build_object('expectedEtag', v_saved->>'etag', 'rows', jsonb_build_array(jsonb_build_object(
      'rowType', 'individual', 'orderId', v_individual_id,
      'workspaceCatalogItemId', 'den194-catalog-wellness-vaccine', 'quantity', 1
    )))
  );
  if (select applied_snapshot_schema_version from public.orders where id = v_individual_id) <> 0
     or (select applied_snapshot_sha256 from public.orders where id = v_individual_id) is not null
     or (select workspace_catalog_revision from public.orders where id = v_individual_id) <> v_catalog_revision then
    raise exception 'clinical_master_phase1b3_regression_schema_zero_individual_invalid';
  end if;
  v_catalog_result := public.clair_update_order_catalog_item(
    'clair-demo', 'den194-catalog-wellness-vaccine', v_catalog_revision,
    jsonb_build_object('priceKrw', 45123)
  );
  if v_catalog_result->>'ok' <> 'true' then
    raise exception 'clinical_master_phase1b3_regression_individual_catalog_update_failed:%', v_catalog_result;
  end if;
  v_saved := public.clair_get_chart_order_draft('clair-demo', v_encounter);
  perform public.clair_save_chart_order_draft(
    'clair-demo', v_actor::text, v_encounter,
    jsonb_build_object('expectedEtag', v_saved->>'etag', 'rows', jsonb_build_array(jsonb_build_object(
      'rowType', 'individual', 'orderId', v_individual_id,
      'workspaceCatalogItemId', 'den194-catalog-wellness-vaccine', 'quantity', 2
    )))
  );
  select catalog_revision into v_catalog_revision
  from public.order_catalog_items
  where workspace_id = 'clair-demo' and id = 'den194-catalog-wellness-vaccine';
  if (select workspace_catalog_revision from public.orders where id = v_individual_id) <> v_catalog_revision
     or (select unit_price_snapshot from public.orders where id = v_individual_id) <> 45123
     or (select applied_snapshot_schema_version from public.orders where id = v_individual_id) <> 0
     or (select applied_snapshot_sha256 from public.orders where id = v_individual_id) is not null then
    raise exception 'clinical_master_phase1b3_regression_individual_catalog_refresh_invalid';
  end if;

  -- A3 owns rounding_rule and price. B3 must carry both into the preview and
  -- persisted child calculation rather than substituting as_is.
  select catalog_revision into v_catalog_revision
  from public.order_catalog_items
  where workspace_id = 'clair-demo' and id = 'den194-catalog-cbc';
  v_catalog_result := public.clair_update_order_catalog_item(
    'clair-demo', 'den194-catalog-cbc', v_catalog_revision,
    jsonb_build_object('priceKrw', 1001, 'roundingRule', 'ceil')
  );
  if v_catalog_result->>'ok' <> 'true' then
    raise exception 'clinical_master_phase1b3_regression_rounding_catalog_update_failed:%', v_catalog_result;
  end if;
  select catalog_revision into v_catalog_revision
  from public.order_catalog_items
  where workspace_id = 'clair-demo' and id = 'den194-catalog-cbc';
  select catalog_revision into v_wellness_catalog_revision
  from public.order_catalog_items
  where workspace_id = 'clair-demo' and id = 'den194-catalog-wellness-vaccine';
  select price_krw into v_wellness_price
  from public.order_catalog_items
  where workspace_id = 'clair-demo' and id = 'den194-catalog-wellness-vaccine';
  v_catalog_result := public.clair_update_order_catalog_item(
    'clair-demo', 'den194-catalog-wellness-vaccine', v_wellness_catalog_revision,
    jsonb_build_object('roundingRule', 'floor')
  );
  if v_catalog_result->>'ok' <> 'true' then
    raise exception 'clinical_master_phase1b3_regression_mixed_rounding_catalog_update_failed:%', v_catalog_result;
  end if;
  select catalog_revision into v_wellness_catalog_revision
  from public.order_catalog_items
  where workspace_id = 'clair-demo' and id = 'den194-catalog-wellness-vaccine';
  v_request := private.clair_b2_deterministic_uuid(
    'replay', array['clair-demo', 'b3-regression-rounding', '2026-08-20']::text[]
  );
  v_seed_result := private.clair_seed_order_set_compatibility_projection(
    'clair-demo', 'b2-regression-rounding',
    jsonb_build_object(
      'setCategory', 'B3 regression', 'setName', 'B3 regression rounding',
      'billingName', 'B3 regression rounding billing',
      'amountBasis', 'included_order_sum', 'setPriceKrw', null,
      'rangeBasis', null, 'salesUnit', 'per_each',
      'billingReflectionEnabled', false, 'taxType', 'derived',
      'targetSpecies', jsonb_build_array('dog'), 'careGuide', null,
      'internalInstruction', null,
      'items', jsonb_build_array(
        jsonb_build_object(
          'childKind', 'atomic', 'childOrderCatalogItemId', 'den194-catalog-cbc',
          'childOrderCatalogRevision', v_catalog_revision,
          'childOrderSetId', null, 'childSetRevisionId', null, 'sortOrder', 1,
          'defaultSelected', true, 'billingReflectionDefault', true,
          'defaultQuantity', 1, 'quantitySource', 'manual_at_apply'
        ),
        jsonb_build_object(
          'childKind', 'atomic', 'childOrderCatalogItemId', 'den194-catalog-wellness-vaccine',
          'childOrderCatalogRevision', v_wellness_catalog_revision,
          'childOrderSetId', null, 'childSetRevisionId', null, 'sortOrder', 2,
          'defaultSelected', true, 'billingReflectionDefault', true,
          'defaultQuantity', 1, 'quantitySource', 'manual_at_apply'
        )
      ),
      'priceRanges', jsonb_build_array()
    ),
    'active', v_actor, v_request
  );
  if v_seed_result->>'outcome' <> 'created' then
    raise exception 'clinical_master_phase1b3_regression_rounding_seed_failed:%', v_seed_result;
  end if;
  select current_revision_id into v_rounding_revision
  from public.order_sets where workspace_id = 'clair-demo' and id = 'b2-regression-rounding';
  select id into v_rounding_item
  from public.order_set_revision_items
  where workspace_id = 'clair-demo' and order_set_id = 'b2-regression-rounding'
    and revision_id = v_rounding_revision and child_kind = 'atomic' and sort_order = 1;
  select id into v_rounding_item_two
  from public.order_set_revision_items
  where workspace_id = 'clair-demo' and order_set_id = 'b2-regression-rounding'
    and revision_id = v_rounding_revision and child_kind = 'atomic' and sort_order = 2;
  v_selection := jsonb_build_object('items', jsonb_build_array(
    jsonb_build_object('revisionItemId', v_rounding_item, 'selected', true, 'quantity', 1.234),
    jsonb_build_object('revisionItemId', v_rounding_item_two, 'selected', true, 'quantity', 1.234)
  ));
  v_rounding_preview := public.clair_preview_chart_order_set(
    'clair-demo', v_encounter, 'b2-regression-rounding', v_rounding_revision, v_selection
  );
  v_preview := public.clair_preview_chart_order_set(
    'clair-demo', v_encounter, 'b2-regression-rounding', v_rounding_revision,
    jsonb_build_object('items', jsonb_build_array(
      jsonb_build_object('revisionItemId', v_rounding_item_two, 'selected', true, 'quantity', 1.234),
      jsonb_build_object('revisionItemId', v_rounding_item, 'selected', true, 'quantity', 1.234)
    ))
  );
  if v_rounding_preview->'items'->0->>'roundingRule' <> 'ceil'
     or (v_rounding_preview->'items'->0->>'roundingResultKrw')::numeric <> ceil(1001 * 1.234)
     or (v_rounding_preview->'items'->0->>'appliedCatalogRevision')::integer <> v_catalog_revision then
    raise exception 'clinical_master_phase1b3_regression_rounding_preview_invalid:%', v_rounding_preview;
  end if;
  if v_rounding_preview->'items'->1->>'roundingRule' <> 'floor'
     or (v_rounding_preview->'items'->1->>'roundingResultKrw')::numeric <> floor(v_wellness_price * 1.234)
     or (v_rounding_preview->'items'->1->>'appliedCatalogRevision')::integer <> v_wellness_catalog_revision
     or v_rounding_preview->'calculationOutputs'->>'roundingRule' <> 'as_is'
     or (v_rounding_preview->'calculationOutputs'->'roundingResultKrw')::numeric
          <> ceil(1001 * 1.234) + floor(v_wellness_price * 1.234)
     or (v_rounding_preview->'pricing'->>'finalTotalKrw')::numeric
          <> ceil(1001 * 1.234) + floor(v_wellness_price * 1.234)
     or v_preview->>'selectionFingerprint' is distinct from v_rounding_preview->>'selectionFingerprint'
     or (v_preview->'calculationOutputs'->'roundingResultKrw')::numeric
          <> (v_rounding_preview->'calculationOutputs'->'roundingResultKrw')::numeric then
    raise exception 'clinical_master_phase1b3_regression_mixed_rounding_aggregate_invalid';
  end if;
  v_saved := public.clair_get_chart_order_draft('clair-demo', v_encounter);
  perform public.clair_save_chart_order_draft(
    'clair-demo', v_actor::text, v_encounter,
    jsonb_build_object('expectedEtag', v_saved->>'etag', 'rows', jsonb_build_array(jsonb_build_object(
      'rowType', 'set', 'orderId', v_rounding_parent,
      'sourceSetId', 'b2-regression-rounding', 'sourceSetRevisionId', v_rounding_revision,
      'sourceSetRevisionNo', (select revision_no from public.order_set_revisions where id = v_rounding_revision),
      'selectionIntent', v_selection
    )))
  );
  if (select applied_price_snapshot->>'roundingRule' from public.orders where id = v_rounding_parent) <> 'as_is'
     or (select applied_price_snapshot->>'roundingResultKrw' from public.orders where id = v_rounding_parent)::numeric
          <> ceil(1001 * 1.234) + floor(v_wellness_price * 1.234)
     or (select calculation_outputs->>'roundingRule' from public.orders where id = v_rounding_parent) <> 'as_is'
     or (select calculation_outputs->>'roundingResultKrw' from public.orders where id = v_rounding_parent)::numeric
          <> ceil(1001 * 1.234) + floor(v_wellness_price * 1.234)
     or (select applied_price_snapshot->>'roundingRule' from public.orders
         where parent_chart_order_line_id = v_rounding_parent
           and workspace_catalog_item_id = 'den194-catalog-cbc') <> 'ceil'
     or (select applied_price_snapshot->>'roundingRule' from public.orders
         where parent_chart_order_line_id = v_rounding_parent
           and workspace_catalog_item_id = 'den194-catalog-wellness-vaccine') <> 'floor' then
    raise exception 'clinical_master_phase1b3_regression_rounding_snapshot_invalid';
  end if;

  -- A selected leaf can be removed through the draft authority when another
  -- leaf remains selected.  The active getter must hide the cancelled child
  -- while retaining its set lineage for audit/history; reapplying the same
  -- set then restores the active two-leaf fixture without reviving the old
  -- cancelled row.
  select id into v_child_id
  from public.orders
  where workspace_id = 'clair-demo'
    and parent_chart_order_line_id = v_rounding_parent
    and source_set_revision_item_id = v_rounding_item
    and row_type = 'set_child'
    and status <> 'cancelled';
  if v_child_id is null then
    raise exception 'clinical_master_phase1b3_regression_child_selection_removed_fixture_invalid';
  end if;
  v_saved := public.clair_get_chart_order_draft('clair-demo', v_encounter);
  v_saved := public.clair_save_chart_order_draft(
    'clair-demo', v_actor::text, v_encounter,
    jsonb_build_object(
      'expectedEtag', v_saved->>'etag',
      'rows', jsonb_build_array(jsonb_build_object(
        'rowType', 'set', 'orderId', v_rounding_parent,
        'sourceSetId', 'b2-regression-rounding', 'sourceSetRevisionId', v_rounding_revision,
        'sourceSetRevisionNo', (select revision_no from public.order_set_revisions where id = v_rounding_revision),
        'selectionIntent', jsonb_build_object('items', jsonb_build_array(
          jsonb_build_object('revisionItemId', v_rounding_item, 'selected', false, 'quantity', 1.234),
          jsonb_build_object('revisionItemId', v_rounding_item_two, 'selected', true, 'quantity', 1.234)
        ))
      ))
    )
  );
  if (select status from public.orders where id = v_child_id) <> 'cancelled'
     or (select order_confirmation_status from public.orders where id = v_child_id) <> 'cancelled'
     or (select cancellation_reason from public.orders where id = v_child_id) <> 'set_selection_removed'
     or exists (
       select 1
       from jsonb_array_elements(v_saved -> 'rows') entry(value)
       where entry.value ->> 'orderId' = v_child_id::text
     )
     or (select count(*) from public.orders
         where workspace_id = 'clair-demo'
           and parent_chart_order_line_id = v_rounding_parent
           and row_type = 'set_child'
           and status <> 'cancelled') <> 1 then
    raise exception 'clinical_master_phase1b3_regression_child_selection_removed_invalid';
  end if;
  if (select row_type from public.orders where id = v_child_id) <> 'set_child'
     or (select parent_chart_order_line_id from public.orders where id = v_child_id) is distinct from v_rounding_parent
     or (select source_set_id from public.orders where id = v_child_id) <> 'b2-regression-rounding'
     or (select source_set_revision_id from public.orders where id = v_child_id) is distinct from v_rounding_revision
     or (select source_set_revision_item_id from public.orders where id = v_child_id) is distinct from v_rounding_item
     or (select applied_snapshot->>'rowType' from public.orders where id = v_child_id) <> 'set_child' then
    raise exception 'clinical_master_phase1b3_regression_child_selection_removed_lineage_invalid';
  end if;
  -- Restore both selections for the remaining replay cases; the cancelled
  -- row above remains the immutable removal evidence.
  v_saved := public.clair_get_chart_order_draft('clair-demo', v_encounter);
  perform public.clair_save_chart_order_draft(
    'clair-demo', v_actor::text, v_encounter,
    jsonb_build_object(
      'expectedEtag', v_saved->>'etag',
      'rows', jsonb_build_array(jsonb_build_object(
        'rowType', 'set', 'orderId', v_rounding_parent,
        'sourceSetId', 'b2-regression-rounding', 'sourceSetRevisionId', v_rounding_revision,
        'sourceSetRevisionNo', (select revision_no from public.order_set_revisions where id = v_rounding_revision),
        'selectionIntent', v_selection
      ))
    )
  );
  if (select count(*) from public.orders
      where workspace_id = 'clair-demo'
        and parent_chart_order_line_id = v_rounding_parent
        and row_type = 'set_child'
        and status <> 'cancelled') <> 2 then
    raise exception 'clinical_master_phase1b3_regression_child_selection_restore_invalid';
  end if;

  -- A fixed/range parent may have a billable explicit-extra child. The
  -- persisted parent roundingResultKrw is the final set-plus-child result,
  -- while the invoice parent line must use the parent-only lineTotalKrw/set
  -- price. The child must be emitted exactly once, including an idempotent
  -- retry of the A3 billing wrapper.
  for v_explicit_case in
    select *
    from (values
      ('fixed'::text, 'b2-regression-explicit-fixed'::text,
       'b3000000-0000-4000-8000-000000000017'::uuid, 200::integer,
       null::numeric, 'per_each'::text),
      ('range'::text, 'b2-regression-explicit-range'::text,
       'b3000000-0000-4000-8000-000000000018'::uuid, 1500::integer,
       5::numeric, 'per_kg'::text)
    ) as cases(kind, set_id, parent_id, set_price, range_input, sales_unit)
  loop
    v_request := private.clair_b2_deterministic_uuid(
      'replay', array['clair-demo', v_explicit_case.set_id, '2026-08-20']::text[]
    );
    v_explicit_def := jsonb_build_object(
      'setCategory', 'B3 regression',
      'setName', 'B3 explicit extra ' || v_explicit_case.kind,
      'billingName', 'B3 explicit extra ' || v_explicit_case.kind || ' billing',
      'amountBasis', case when v_explicit_case.kind = 'fixed'
        then 'set_fixed_price' else 'range_price' end,
      'setPriceKrw', case when v_explicit_case.kind = 'fixed'
        then to_jsonb(v_explicit_case.set_price) else 'null'::jsonb end,
      'rangeBasis', case when v_explicit_case.kind = 'fixed'
        then null else 'patient_weight_kg' end,
      'salesUnit', v_explicit_case.sales_unit,
      'billingReflectionEnabled', true,
      'taxType', 'taxable',
      'targetSpecies', jsonb_build_array('dog'),
      'careGuide', null,
      'internalInstruction', null,
      'items', jsonb_build_array(jsonb_build_object(
        'childKind', 'atomic',
        'childOrderCatalogItemId', 'den194-catalog-cbc',
        'childOrderCatalogRevision', v_catalog_revision,
        'childOrderSetId', null,
        'childSetRevisionId', null,
        'sortOrder', 1,
        'defaultSelected', true,
        'billingReflectionDefault', true,
        'defaultQuantity', 1,
        'quantitySource', 'fixed_one'
      )),
      'priceRanges', case when v_explicit_case.kind = 'fixed'
        then '[]'::jsonb
        else jsonb_build_array(jsonb_build_object(
          'sortOrder', 1,
          'lowerBound', 0,
          'upperBound', null,
          'priceKrw', v_explicit_case.set_price
        )) end
    );
    v_seed_result := private.clair_seed_order_set_compatibility_projection(
      'clair-demo', v_explicit_case.set_id, v_explicit_def,
      'active', v_actor, v_request
    );
    if v_seed_result->>'outcome' <> 'created' then
      raise exception 'clinical_master_phase1b3_regression_explicit_extra_seed_failed:%', v_seed_result;
    end if;

    select current_revision_id into v_revision
    from public.order_sets
    where workspace_id = 'clair-demo' and id = v_explicit_case.set_id;
    select id into v_item
    from public.order_set_revision_items
    where workspace_id = 'clair-demo'
      and order_set_id = v_explicit_case.set_id
      and revision_id = v_revision
      and child_kind = 'atomic';
    v_explicit_selection := jsonb_build_object(
      'items', jsonb_build_array(jsonb_build_object(
        'revisionItemId', v_item, 'selected', true, 'quantity', 1
      ))
    );
    if v_explicit_case.kind = 'range' then
      v_explicit_selection := v_explicit_selection || jsonb_build_object(
        'rangeInput', v_explicit_case.range_input
      );
    end if;
    v_preview := public.clair_preview_chart_order_set(
      'clair-demo', v_encounter, v_explicit_case.set_id, v_revision,
      v_explicit_selection
    );
    v_saved := public.clair_get_chart_order_draft('clair-demo', v_encounter);
    perform public.clair_save_chart_order_draft(
      'clair-demo', v_actor::text, v_encounter,
      jsonb_build_object(
        'expectedEtag', v_saved->>'etag',
        'rows', jsonb_build_array(jsonb_build_object(
          'rowType', 'set',
          'orderId', v_explicit_case.parent_id,
          'sourceSetId', v_explicit_case.set_id,
          'sourceSetRevisionId', v_revision,
          'sourceSetRevisionNo', (select revision_no from public.order_set_revisions where id = v_revision),
          'selectionIntent', v_explicit_selection
        ))
      )
    );
    select id into v_explicit_child_id
    from public.orders
    where workspace_id = 'clair-demo'
      and parent_chart_order_line_id = v_explicit_case.parent_id
      and row_type = 'set_child'
      and status <> 'cancelled';
    select
      o.applied_snapshot,
      (o.calculation_outputs->>'lineTotalKrw')::numeric,
      (o.calculation_outputs->>'roundingResultKrw')::numeric
      into v_explicit_parent_snapshot,
           v_explicit_parent_line_total,
           v_explicit_parent_rounding_result
    from public.orders o
    where o.workspace_id = 'clair-demo' and o.id = v_explicit_case.parent_id;
    if v_explicit_child_id is null
       or v_explicit_parent_line_total is distinct from v_explicit_case.set_price::numeric
       or v_explicit_parent_rounding_result is null then
      raise exception 'clinical_master_phase1b3_regression_explicit_extra_snapshot_invalid';
    end if;
    if v_explicit_parent_rounding_result <= v_explicit_parent_line_total then
      raise exception 'clinical_master_phase1b3_regression_explicit_extra_snapshot_not_distinct';
    end if;

    v_actions := public.clair_get_chart_order_actions('clair-demo', v_encounter);
    perform public.clair_save_chart_order_action(
      'clair-demo', v_actor, v_encounter, 'confirm',
      array[v_explicit_case.parent_id], v_actions->>'etag'
    );
    v_actions := public.clair_get_chart_order_actions('clair-demo', v_encounter);
    perform public.clair_save_chart_order_action(
      'clair-demo', v_actor, v_encounter, 'bill',
      array[v_explicit_case.parent_id], v_actions->>'etag'
    );
    if (select billing_candidate_status from public.orders where id = v_explicit_case.parent_id)
          <> 'candidate_created'
       or (select billing_candidate_status from public.orders where id = v_explicit_child_id)
          <> 'candidate_created' then
      raise exception 'clinical_master_phase1b3_regression_explicit_extra_candidate_invalid';
    end if;

    v_billing := public.clair_sync_billing_invoice_candidates_from_chart(
      'clair-demo', v_actor, v_encounter,
      array[v_explicit_case.parent_id, v_explicit_child_id]
    );
    select o.invoice_line_id into v_explicit_parent_line_id
    from public.orders o
    where o.workspace_id = 'clair-demo' and o.id = v_explicit_case.parent_id;
    select o.invoice_line_id into v_explicit_child_line_id
    from public.orders o
    where o.workspace_id = 'clair-demo' and o.id = v_explicit_child_id;
    select count(*) into v_explicit_parent_line_count
    from public.invoice_lines where order_id = v_explicit_case.parent_id;
    select count(*) into v_explicit_child_line_count
    from public.invoice_lines where order_id = v_explicit_child_id;
    select il.line_total, il.unit_price, il.discount_amount,
           il.source_order_snapshot
      into v_explicit_parent_line_total,
           v_explicit_parent_unit_price,
           v_explicit_parent_discount,
           v_explicit_parent_snapshot
    from public.invoice_lines il
    where il.id = v_explicit_parent_line_id;
    select il.line_total, il.source_order_snapshot
      into v_explicit_child_line_total, v_explicit_child_snapshot
    from public.invoice_lines il
    where il.id = v_explicit_child_line_id;
    if v_explicit_parent_line_count <> 1
       or v_explicit_child_line_count <> 1
       or v_explicit_parent_line_id is null
       or v_explicit_child_line_id is null
       or v_explicit_parent_line_total is distinct from
          (select (calculation_outputs->>'lineTotalKrw')::numeric
           from public.orders where id = v_explicit_case.parent_id)
       or v_explicit_parent_unit_price is distinct from v_explicit_case.set_price::numeric
       or v_explicit_parent_discount is distinct from 0::numeric
       or v_explicit_parent_snapshot->'calculationOutputs'->>'lineTotalKrw' is distinct from
          (select calculation_outputs->>'lineTotalKrw'
           from public.orders where id = v_explicit_case.parent_id)
       or v_explicit_parent_snapshot->'appliedPriceSnapshot'->>'priceKrw' is distinct from
          v_explicit_case.set_price::text then
      raise exception 'clinical_master_phase1b3_regression_invoice_parent_line_total_invalid';
    end if;
    if v_explicit_child_line_total is distinct from
          (select (calculation_outputs->>'lineTotalKrw')::numeric
           from public.orders where id = v_explicit_child_id)
       or v_explicit_child_snapshot->'appliedPriceSnapshot'->>'priceKrw' is distinct from
          (select applied_price_snapshot->>'priceKrw'
           from public.orders where id = v_explicit_child_id) then
      raise exception 'clinical_master_phase1b3_regression_invoice_child_line_invalid';
    end if;

    -- Reapplying the same parent+child selection must not add a second line.
    v_billing := public.clair_sync_billing_invoice_candidates_from_chart(
      'clair-demo', v_actor, v_encounter,
      array[v_explicit_case.parent_id, v_explicit_child_id]
    );
    if (select count(*) from public.invoice_lines where order_id = v_explicit_case.parent_id) <> 1
       or (select count(*) from public.invoice_lines where order_id = v_explicit_child_id) <> 1
       or (select invoice_line_id from public.orders where id = v_explicit_case.parent_id)
            is distinct from v_explicit_parent_line_id
       or (select invoice_line_id from public.orders where id = v_explicit_child_id)
            is distinct from v_explicit_child_line_id then
      raise exception 'clinical_master_phase1b3_regression_invoice_child_duplicate';
    end if;
  end loop;

  -- Nested child sets are flattened at draft time, but their exact pinned
  -- child set/revision remains a confirmation-time usability dependency.
  v_nested_child_def := jsonb_build_object(
    'setCategory', 'B3 regression', 'setName', 'B3 nested child',
    'billingName', 'B3 nested child billing',
    'amountBasis', 'included_order_sum', 'setPriceKrw', null,
    'rangeBasis', null, 'salesUnit', 'per_each',
    'billingReflectionEnabled', false, 'taxType', 'derived',
    'targetSpecies', jsonb_build_array('dog'), 'careGuide', null,
    'internalInstruction', null,
    'items', jsonb_build_array(jsonb_build_object(
      'childKind', 'atomic', 'childOrderCatalogItemId', 'den194-catalog-cbc',
      'childOrderCatalogRevision', v_catalog_revision,
      'childOrderSetId', null, 'childSetRevisionId', null, 'sortOrder', 1,
      'defaultSelected', true, 'billingReflectionDefault', true,
      'defaultQuantity', 1, 'quantitySource', 'fixed_one'
    )),
    'priceRanges', jsonb_build_array()
  );
  v_request := private.clair_b2_deterministic_uuid(
    'replay', array['clair-demo', 'b3-regression-nested-child', '2026-08-20']::text[]
  );
  v_seed_result := private.clair_seed_order_set_compatibility_projection(
    'clair-demo', 'b2-regression-nested-child', v_nested_child_def,
    'active', v_actor, v_request
  );
  if v_seed_result->>'outcome' <> 'created' then
    raise exception 'clinical_master_phase1b3_regression_nested_child_seed_failed:%', v_seed_result;
  end if;
  select current_revision_id into v_nested_child_revision
  from public.order_sets where workspace_id = 'clair-demo' and id = 'b2-regression-nested-child';
  select id into v_nested_child_item
  from public.order_set_revision_items
  where workspace_id = 'clair-demo' and order_set_id = 'b2-regression-nested-child'
    and revision_id = v_nested_child_revision and child_kind = 'atomic';
  v_nested_parent_def := jsonb_build_object(
    'setCategory', 'B3 regression', 'setName', 'B3 nested parent',
    'billingName', 'B3 nested parent billing',
    'amountBasis', 'included_order_sum', 'setPriceKrw', null,
    'rangeBasis', null, 'salesUnit', 'per_each',
    'billingReflectionEnabled', false, 'taxType', 'derived',
    'targetSpecies', jsonb_build_array('dog'), 'careGuide', null,
    'internalInstruction', null,
    'items', jsonb_build_array(jsonb_build_object(
      'childKind', 'order_set', 'childOrderCatalogItemId', null,
      'childOrderCatalogRevision', null, 'childOrderSetId', 'b2-regression-nested-child',
      'childSetRevisionId', v_nested_child_revision, 'sortOrder', 1,
      'defaultSelected', true, 'billingReflectionDefault', false,
      'defaultQuantity', 1, 'quantitySource', 'fixed_one'
    )),
    'priceRanges', jsonb_build_array()
  );
  v_request := private.clair_b2_deterministic_uuid(
    'replay', array['clair-demo', 'b3-regression-nested-parent', '2026-08-20']::text[]
  );
  v_seed_result := private.clair_seed_order_set_compatibility_projection(
    'clair-demo', 'b2-regression-nested-parent', v_nested_parent_def,
    'active', v_actor, v_request
  );
  if v_seed_result->>'outcome' <> 'created' then
    raise exception 'clinical_master_phase1b3_regression_nested_parent_seed_failed:%', v_seed_result;
  end if;
  select current_revision_id into v_nested_parent_revision
  from public.order_sets where workspace_id = 'clair-demo' and id = 'b2-regression-nested-parent';
  select id into v_nested_parent_item
  from public.order_set_revision_items
  where workspace_id = 'clair-demo' and order_set_id = 'b2-regression-nested-parent'
    and revision_id = v_nested_parent_revision and child_kind = 'order_set';
  v_nested_selection := jsonb_build_object('items', jsonb_build_array(jsonb_build_object(
    'revisionItemId', v_nested_child_item, 'selected', true, 'quantity', 1
  )));
  v_saved := public.clair_get_chart_order_draft('clair-demo', v_encounter);
  perform public.clair_save_chart_order_draft(
    'clair-demo', v_actor::text, v_encounter,
    jsonb_build_object('expectedEtag', v_saved->>'etag', 'rows', jsonb_build_array(jsonb_build_object(
      'rowType', 'set', 'orderId', v_nested_parent,
      'sourceSetId', 'b2-regression-nested-parent', 'sourceSetRevisionId', v_nested_parent_revision,
      'sourceSetRevisionNo', (select revision_no from public.order_set_revisions where id = v_nested_parent_revision),
      'selectionIntent', v_nested_selection
    )))
  );
  select source_set_revision_item_id into v_nested_parent_item
  from public.orders
  where id = v_nested_parent and row_type = 'set';
  if v_nested_parent_item is not null
     or (select count(*) from public.orders where parent_chart_order_line_id = v_nested_parent and row_type = 'set_child' and status <> 'cancelled') <> 1 then
    raise exception 'clinical_master_phase1b3_regression_nested_container_selection_invalid';
  end if;
  v_hash_before := (select applied_snapshot_sha256 from public.orders where id = v_nested_parent);
  v_saved := public.clair_get_chart_order_draft('clair-demo', v_encounter);
  perform public.clair_save_chart_order_draft(
    'clair-demo', v_actor::text, v_encounter,
    jsonb_build_object('expectedEtag', v_saved->>'etag', 'rows', jsonb_build_array(jsonb_build_object(
      'rowType', 'set', 'orderId', v_nested_parent,
      'sourceSetId', 'b2-regression-nested-parent', 'sourceSetRevisionId', v_nested_parent_revision,
      'sourceSetRevisionNo', (select revision_no from public.order_set_revisions where id = v_nested_parent_revision),
      'selectionIntent', v_nested_selection
    )))
  );
  if (select count(*) from public.orders where id = v_nested_parent) <> 1
     or (select count(*) from public.orders where parent_chart_order_line_id = v_nested_parent and row_type = 'set_child' and status <> 'cancelled') <> 1
     or (select applied_snapshot_sha256 from public.orders where id = v_nested_parent) is distinct from v_hash_before then
    raise exception 'clinical_master_phase1b3_regression_nested_reapply_not_idempotent';
  end if;

  -- Each post-draft child-set fault blocks confirm without changing either
  -- persisted lifecycle row.
  perform private.clair_b2_apply_projection(
    'clair-demo', 'b2-regression-nested-child', v_nested_child_revision,
    'inactive', false, v_actor
  );
  v_nested_actions := public.clair_get_chart_order_actions('clair-demo', v_encounter);
  begin
    perform public.clair_save_chart_order_action(
      'clair-demo', v_actor, v_encounter, 'confirm', array[v_nested_parent], v_nested_actions->>'etag'
    );
    raise exception 'clinical_master_phase1b3_regression_nested_unavailable_accepted';
  exception when others then
    get stacked diagnostics v_error = message_text;
    if v_error = 'clinical_master_phase1b3_regression_nested_unavailable_accepted'
       or v_error !~* '(unavailable|composition|revision)' then raise; end if;
  end;
  if (select order_confirmation_status from public.orders where id = v_nested_parent) not in ('draft', 'pending') then
    raise exception 'clinical_master_phase1b3_regression_nested_unavailable_changed_state';
  end if;
  perform private.clair_b2_apply_projection(
    'clair-demo', 'b2-regression-nested-child', v_nested_child_revision,
    'active', true, v_actor
  );
  v_nested_actions := public.clair_get_chart_order_actions('clair-demo', v_encounter);
  begin
    perform public.clair_save_chart_order_action(
      'clair-demo', v_actor, v_encounter, 'confirm', array[v_nested_parent], v_nested_actions->>'etag'
    );
    raise exception 'clinical_master_phase1b3_regression_nested_review_accepted';
  exception when others then
    get stacked diagnostics v_error = message_text;
    if v_error = 'clinical_master_phase1b3_regression_nested_review_accepted'
       or v_error !~* '(unavailable|composition|review|revision)' then raise; end if;
  end;
  perform private.clair_b2_apply_projection(
    'clair-demo', 'b2-regression-nested-child', v_nested_child_revision,
    'active', false, v_actor
  );
  perform set_config('clinical_master.b2_internal_write', 'on', true);
  update public.order_set_revisions
  set validation_status = 'invalid',
      validation_errors = jsonb_build_array(jsonb_build_object(
        'code', 'b3_regression_invalid_revision', 'field', 'revision', 'message', 'B3 regression invalid revision'
      ))
  where workspace_id = 'clair-demo' and id = v_nested_child_revision;
  perform set_config('clinical_master.b2_internal_write', 'off', true);
  v_nested_actions := public.clair_get_chart_order_actions('clair-demo', v_encounter);
  begin
    perform public.clair_save_chart_order_action(
      'clair-demo', v_actor, v_encounter, 'confirm', array[v_nested_parent], v_nested_actions->>'etag'
    );
    raise exception 'clinical_master_phase1b3_regression_nested_revision_accepted';
  exception when others then
    get stacked diagnostics v_error = message_text;
    if v_error = 'clinical_master_phase1b3_regression_nested_revision_accepted'
       or v_error !~* '(unavailable|composition|review|revision|validation)' then raise; end if;
  end;
  perform set_config('clinical_master.b2_internal_write', 'on', true);
  update public.order_set_revisions
  set validation_status = 'valid', validation_errors = '[]'::jsonb
  where workspace_id = 'clair-demo' and id = v_nested_child_revision;
  perform set_config('clinical_master.b2_internal_write', 'off', true);
  -- Restoring the child does not clear the parent's composition-review flag.
  -- Advance the child through the B2 writer and resolve its pinned-revision
  -- review through the approved lifecycle before the final confirm.
  v_request := private.clair_b2_deterministic_uuid(
    'replay', array['clair-demo', 'b3-regression-nested-child-reapply', '2026-08-20']::text[]
  );
  v_seed_result := public.clair_save_order_set_revision(
    'clair-demo', 'b2-regression-nested-child', v_nested_child_revision,
    v_nested_child_def, 'active', v_request
  );
  if v_seed_result->>'outcome' <> 'applied' then
    raise exception 'clinical_master_phase1b3_regression_nested_child_reapply_failed:%', v_seed_result;
  end if;
  v_nested_child_current_revision := (v_seed_result #>> '{result,current,revisionId}')::uuid;
  select id into v_nested_review_id
  from public.order_set_revision_update_reviews
  where workspace_id = 'clair-demo'
    and parent_order_set_id = 'b2-regression-nested-parent'
    and parent_revision_id = v_nested_parent_revision
    and child_order_set_id = 'b2-regression-nested-child'
    and pinned_child_revision_id = v_nested_child_revision
    and available_child_revision_id = v_nested_child_current_revision
    and status = 'pending';
  if v_nested_review_id is null then
    raise exception 'clinical_master_phase1b3_regression_nested_review_missing';
  end if;
  v_request := private.clair_b2_deterministic_uuid(
    'replay', array['clair-demo', 'b3-regression-nested-review-accept', '2026-08-20']::text[]
  );
  v_seed_result := public.clair_resolve_order_set_update_review(
    'clair-demo', v_nested_review_id, v_nested_parent_revision, 'accept', v_request
  );
  if v_seed_result->>'outcome' <> 'accepted' then
    raise exception 'clinical_master_phase1b3_regression_nested_review_accept_failed:%', v_seed_result;
  end if;
  v_nested_actions := public.clair_get_chart_order_actions('clair-demo', v_encounter);
  v_action := public.clair_save_chart_order_action(
    'clair-demo', v_actor, v_encounter, 'confirm', array[v_nested_parent], v_nested_actions->>'etag'
  );
  if (select order_confirmation_status from public.orders where id = v_nested_parent) <> 'confirmed'
     or (select count(*) from public.orders where parent_chart_order_line_id = v_nested_parent and order_confirmation_status = 'confirmed') <> 1 then
    raise exception 'clinical_master_phase1b3_regression_nested_valid_reapply_failed';
  end if;

  -- Semantic preflight/readback: every live set draft has a nonblank exact
  -- source identity and the schema-1 four-object/hash envelope.
  if exists (
    select 1 from public.orders o
    where o.row_type in ('set', 'set_child')
      and o.status <> 'cancelled'
      and o.order_confirmation_status in ('draft', 'pending')
      and nullif(btrim(o.source_set_id), '') is null
  ) then
    raise exception 'clinical_master_phase1b3_regression_nonblank_set_draft_failed';
  end if;
  if exists (
    select 1 from public.orders o
    where o.row_type in ('set', 'set_child')
      and (o.applied_snapshot_schema_version <> 1
        or o.applied_snapshot_sha256 is null
        or jsonb_typeof(o.applied_snapshot) <> 'object'
        or jsonb_typeof(o.applied_price_snapshot) <> 'object'
        or jsonb_typeof(o.calculation_inputs) <> 'object'
        or jsonb_typeof(o.calculation_outputs) <> 'object')
  ) then
    raise exception 'clinical_master_phase1b3_regression_semantic_preflight_failed';
  end if;
end
$$;

select 'b3_replay_set_parents' as check_name, count(*)::integer as value
from public.orders
where workspace_id = 'clair-demo' and id in (
  'b3000000-0000-4000-8000-000000000001'::uuid,
  'b3000000-0000-4000-8000-000000000002'::uuid,
  'b3000000-0000-4000-8000-000000000003'::uuid,
  'b3000000-0000-4000-8000-000000000011'::uuid,
  'b3000000-0000-4000-8000-000000000012'::uuid,
  'b3000000-0000-4000-8000-000000000013'::uuid,
  'b3000000-0000-4000-8000-000000000014'::uuid,
  'b3000000-0000-4000-8000-000000000015'::uuid,
  'b3000000-0000-4000-8000-000000000016'::uuid,
  'b3000000-0000-4000-8000-000000000017'::uuid,
  'b3000000-0000-4000-8000-000000000018'::uuid,
  'b3000000-0000-4000-8000-000000000021'::uuid,
  'b3000000-0000-4000-8000-000000000022'::uuid,
  'b3000000-0000-4000-8000-000000000023'::uuid,
  'b3000000-0000-4000-8000-000000000024'::uuid,
  'b3000000-0000-4000-8000-000000000025'::uuid,
  'b3000000-0000-4000-8000-000000000026'::uuid,
  'b3000000-0000-4000-8000-000000000027'::uuid,
  'b3000000-0000-4000-8000-000000000028'::uuid,
  'b3000000-0000-4000-8000-000000000029'::uuid,
  'b3000000-0000-4000-8000-000000000030'::uuid,
  'b3000000-0000-4000-8000-000000000031'::uuid
);
select 'b3_replay_set_children' as check_name, count(*)::integer as value
from public.orders
where workspace_id = 'clair-demo' and row_type = 'set_child'
  and parent_chart_order_line_id in (
    'b3000000-0000-4000-8000-000000000001'::uuid,
    'b3000000-0000-4000-8000-000000000002'::uuid,
    'b3000000-0000-4000-8000-000000000003'::uuid,
    'b3000000-0000-4000-8000-000000000011'::uuid,
    'b3000000-0000-4000-8000-000000000012'::uuid,
    'b3000000-0000-4000-8000-000000000013'::uuid,
    'b3000000-0000-4000-8000-000000000014'::uuid,
    'b3000000-0000-4000-8000-000000000015'::uuid,
    'b3000000-0000-4000-8000-000000000016'::uuid,
    'b3000000-0000-4000-8000-000000000017'::uuid,
    'b3000000-0000-4000-8000-000000000018'::uuid,
    'b3000000-0000-4000-8000-000000000021'::uuid,
    'b3000000-0000-4000-8000-000000000022'::uuid,
    'b3000000-0000-4000-8000-000000000023'::uuid,
    'b3000000-0000-4000-8000-000000000024'::uuid,
    'b3000000-0000-4000-8000-000000000025'::uuid,
    'b3000000-0000-4000-8000-000000000026'::uuid,
    'b3000000-0000-4000-8000-000000000027'::uuid,
    'b3000000-0000-4000-8000-000000000028'::uuid,
    'b3000000-0000-4000-8000-000000000029'::uuid,
    'b3000000-0000-4000-8000-000000000030'::uuid,
    'b3000000-0000-4000-8000-000000000031'::uuid
  );
select 'b2_replay_range' as check_name, count(*)::integer as value
from public.order_set_revision_price_ranges
where workspace_id = 'clair-demo'
  and order_set_id = 'b2-replay-range';

-- Keep the local replay transaction-clean. The result rows above are the
-- evidence; no synthetic orders, events, or B2 fixtures survive the run.
rollback;

do $$
begin
  if exists (
       select 1 from public.orders
       where id in (
         'b3000000-0000-4000-8000-000000000001'::uuid,
         'b3000000-0000-4000-8000-000000000002'::uuid,
         'b3000000-0000-4000-8000-000000000003'::uuid,
         'b3000000-0000-4000-8000-000000000011'::uuid,
         'b3000000-0000-4000-8000-000000000012'::uuid,
         'b3000000-0000-4000-8000-000000000013'::uuid,
         'b3000000-0000-4000-8000-000000000014'::uuid,
         'b3000000-0000-4000-8000-000000000015'::uuid,
         'b3000000-0000-4000-8000-000000000016'::uuid,
         'b3000000-0000-4000-8000-000000000017'::uuid,
         'b3000000-0000-4000-8000-000000000018'::uuid
       )
     )
     or exists (
       select 1 from public.order_events
       where order_id in (
         'b3000000-0000-4000-8000-000000000001'::uuid,
         'b3000000-0000-4000-8000-000000000002'::uuid,
         'b3000000-0000-4000-8000-000000000003'::uuid,
         'b3000000-0000-4000-8000-000000000011'::uuid,
         'b3000000-0000-4000-8000-000000000012'::uuid,
         'b3000000-0000-4000-8000-000000000013'::uuid,
         'b3000000-0000-4000-8000-000000000014'::uuid,
         'b3000000-0000-4000-8000-000000000015'::uuid,
         'b3000000-0000-4000-8000-000000000016'::uuid,
         'b3000000-0000-4000-8000-000000000017'::uuid,
         'b3000000-0000-4000-8000-000000000018'::uuid
       )
     )
     or exists (
       select 1 from public.order_sets
       where id in (
         'b2-replay-sum', 'b2-replay-fixed', 'b2-replay-range',
         'b2-replay-other-workspace', 'b2-regression-sum',
         'b2-regression-fixed', 'b2-regression-rounding',
         'b2-regression-nested-child', 'b2-regression-nested-parent',
         'b2-regression-explicit-fixed', 'b2-regression-explicit-range'
       )
     ) then
    raise exception 'clinical_master_phase1b3_replay_cleanup_failed';
  end if;
end
$$;

select 'b3_replay_cleanup_ok' as check_name;
