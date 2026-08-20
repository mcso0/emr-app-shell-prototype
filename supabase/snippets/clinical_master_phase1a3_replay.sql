-- Local-only Phase 1A-3 replay.
-- Run with ON_ERROR_STOP=1 after an A1 -> A2 -> A3 reset:
--   psql --dbname "$LOCAL_DATABASE_URL" -v ON_ERROR_STOP=1 \
--     -f supabase/snippets/clinical_master_phase1a3_replay.sql
--
-- Every probe row is synthetic and is rolled back at the end. The migration
-- itself owns the durable constraints/RPCs; this replay exercises the exact
-- snapshot, category, direct-DML, set, and anchor-adoption boundaries.

begin;

create temp table clinical_master_phase1a3_replay_state (
  state_key text primary key,
  state_value jsonb not null
) on commit drop;

do $replay$
declare
  v_admin uuid := '00000000-0000-4000-8000-000000000001';
  v_workspace text := 'clair-demo';
  v_cross_workspace text := 'a3-other-workspace';
  v_encounter uuid := '26000000-0000-4000-8000-000000000001';
  v_cross_patient uuid := 'a3000000-0000-4000-8000-000000000501';
  v_cross_encounter uuid := 'a3000000-0000-4000-8000-000000000502';
  v_path_id uuid;
  v_master_record_id uuid;
  v_master_revision integer;
  v_category text;
  v_billing_category text;
  v_rounding_case record;
  v_rounding_snapshot jsonb;
  v_rounding_expected numeric;
  v_snapshot jsonb;
  v_expected text[] := array[
    'consultation:consultation',
    'medication:dispensing',
    'treatment:treatment',
    'lab:laboratory',
    'imaging:imaging',
    'hospitalization:other',
    'misc:other'
  ];
  v_categories text[] := array[
    'consultation', 'medication', 'treatment', 'lab', 'imaging',
    'hospitalization', 'misc'
  ];
  v_order_id uuid;
  v_set_order_id uuid := 'a3000000-0000-4000-8000-000000000099';
  v_treatment_order_id uuid := 'a3000000-0000-4000-8000-000000000003';
  v_fractional_order_id uuid := 'a3010000-0000-4000-8000-000000000009';
  v_fractional_quantity numeric := case
    when to_regprocedure('private.clair_b3_sha256(jsonb)') is not null then 1.234
    else 1.23
  end;
  v_lab_order_id uuid := 'a3000000-0000-4000-8000-000000000004';
  v_imaging_order_id uuid := 'a3000000-0000-4000-8000-000000000005';
  v_hospitalization_order_id uuid := 'a3000000-0000-4000-8000-000000000006';
  v_misc_order_id uuid := 'a3000000-0000-4000-8000-000000000007';
  v_zero_order_id uuid := 'a3000000-0000-4000-8000-000000000008';
  v_legacy_order_id uuid := 'a3000000-0000-4000-8000-000000000201';
  v_legacy_invoice_id uuid := 'a3000000-0000-4000-8000-000000000202';
  v_legacy_line_id uuid := 'a3000000-0000-4000-8000-000000000203';
  v_legacy_service_item_id uuid;
  v_before_order_name text;
  v_before_order_snapshot jsonb;
  v_before_line_description text;
  v_before_line_quantity numeric;
  v_before_line_unit_price numeric;
  v_before_line_snapshot jsonb;
  v_before_misc_quantity numeric;
  v_before_misc_snapshot jsonb;
  v_line_count integer;
  v_draft_rows jsonb;
  v_draft_etag text;
  v_action_rows jsonb;
  v_action_response jsonb;
  -- Draft/save envelope and action If-Match signature can be mixed when an
  -- A3 migration is reapplied over a later B3 reset. Detect them separately:
  -- the getter response is the source of truth for draft/save payload shape.
  v_b3_runtime boolean := false;
  v_b3_action_runtime boolean := to_regprocedure(
    'public.clair_save_chart_order_action(text,uuid,uuid,text,uuid[],text)'
  ) is not null;
  v_fractional_action_rows jsonb;
  v_billing_rows jsonb;
  v_fractional_billing_rows jsonb;
  v_zero_draft_rows jsonb;
  v_zero_action_rows jsonb;
  v_zero_billing_rows jsonb;
  v_zero_invoice_rows jsonb;
  v_invoice_rows jsonb;
  v_invoice_id uuid;
  v_zero_invoice_id uuid;
  v_fractional_expected numeric;
  v_fractional_line_total numeric;
  v_fractional_line_discount_amount numeric;
  v_fractional_line_unit_price numeric;
  v_b3_fixed_range_regression boolean := false;
  v_billable_order_ids uuid[];
  v_getter_count integer;
  v_invoice_line_count integer;
  v_master_lineage_count integer;
  v_denied boolean;
  v_work_item_id uuid;
  v_fulfillment_rows jsonb;
  v_before_fulfillment_snapshot jsonb;
  v_after_fulfillment_snapshot jsonb;
  v_legacy_action_rows jsonb;
  v_legacy_fulfillment_rows jsonb;
  v_legacy_work_item_id uuid;
  v_legacy_draft_work_item_count integer;
  v_front_desk uuid := '00000000-0000-4000-8000-000000000004';
  v_inactive_front_desk uuid := '00000000-0000-4000-8000-000000000013';
  v_attack_value text;
begin
  select id
    into v_legacy_service_item_id
  from public.service_items
  order by id
  limit 1;
  if v_legacy_service_item_id is null then
    raise exception 'clinical_master_phase1a3_replay_missing_legacy_service_item';
  end if;
  select classification_path_id
    into v_path_id
  from public.order_catalog_items
  where workspace_id = v_workspace
  order by id
  limit 1;
  if v_path_id is null then
    raise exception 'clinical_master_phase1a3_replay_missing_classification_path';
  end if;

  -- Seven synthetic catalog rows are the mapping/reload matrix. The misc row
  -- deliberately carries NULL because it is non-billable; hospitalization is
  -- an explicit billable zero.
  for i in 1..array_length(v_categories, 1) loop
    select path.id
      into v_path_id
    from master.classification_paths path
    join master.clinical_actions action
      on action.master_record_id = path.clinical_action_id
    where action.item_type = v_categories[i]
      and path.retired_in_release_id is null
    order by path.path_key
    limit 1;
    if v_path_id is null then
      raise exception 'clinical_master_phase1a3_replay_missing_category_path:%', v_categories[i];
    end if;
    select action.master_record_id, master_record.current_revision
      into v_master_record_id, v_master_revision
    from master.classification_paths path
    join master.clinical_actions action
      on action.master_record_id = path.clinical_action_id
    join master.master_records master_record
      on master_record.id = action.master_record_id
    where path.id = v_path_id;
    insert into public.order_catalog_items (
      id, workspace_id, standard_order_id, source_preset_version,
      category_group, category_label, standard_order_name,
      in_hospital_order_name, billing_name, default_destination_module,
      classification_path_id, source_master_record_id, source_master_revision,
      origin_type, initial_imported_revision, source_projection_snapshot,
      source_projection_fingerprint,
      billing_reflection_enabled, price_krw,
      sales_unit, target_species
    ) values (
      'a3-replay-catalog-' || v_categories[i], v_workspace,
      'a3-replay-standard-' || v_categories[i], 'a3-replay-v1',
      v_categories[i], 'A3 ' || v_categories[i],
      'A3 standard ' || v_categories[i], 'A3 order ' || v_categories[i],
      'A3 billing ' || v_categories[i],
      case v_categories[i]
        when 'lab' then 'lab'
        when 'imaging' then 'imaging'
        when 'medication' then 'dispensing'
        when 'misc' then 'chart_only'
        when 'hospitalization' then 'chart_only'
        else 'treatment'
      end,
      v_path_id,
      v_master_record_id, v_master_revision,
      'clair_master', 1,
      jsonb_build_object('replayCategory', v_categories[i], 'replayVersion', 'a3'),
      encode(extensions.digest(('a3-replay-' || v_categories[i])::text, 'sha256'), 'hex'),
      v_categories[i] <> 'misc',
      case when v_categories[i] = 'misc' then null
           when v_categories[i] = 'hospitalization' then 0
           else 1000 + i end,
      'per_order', array['dog', 'cat']
    );
  end loop;

  -- Exercise every approved rounding mode in the server-owned catalog
  -- snapshot builder. Treatment is also the non-taxable provenance probe.
  update public.order_catalog_items
  set price_krw = case when category_group = 'medication' then 1001 else price_krw end,
      rounding_rule = case category_group
        when 'consultation' then 'as_is'
        when 'medication' then 'ceil'
        when 'treatment' then 'floor'
        when 'lab' then 'round'
        else 'as_is'
      end,
      tax_included = case when category_group = 'treatment' then false else tax_included end
  where id like 'a3-replay-catalog-%';

  for v_rounding_case in
    select category_group, rounding_rule, price_krw
    from public.order_catalog_items
    where id like 'a3-replay-catalog-%'
      and category_group in ('consultation', 'medication', 'treatment', 'lab')
    order by category_group
  loop
    v_rounding_snapshot := private.clair_build_catalog_order_snapshot(
      v_workspace,
      'a3-replay-catalog-' || v_rounding_case.category_group,
      1.234
    );
    v_rounding_expected := case v_rounding_case.rounding_rule
      when 'as_is' then (v_rounding_case.price_krw * 1.234)::numeric(12,2)
      when 'ceil' then ceil(v_rounding_case.price_krw * 1.234)::numeric(12,2)
      when 'floor' then floor(v_rounding_case.price_krw * 1.234)::numeric(12,2)
      when 'round' then round(v_rounding_case.price_krw * 1.234)::numeric(12,2)
    end;
    if v_rounding_snapshot->>'roundingRule' <> v_rounding_case.rounding_rule
       or (v_rounding_snapshot->>'lineTotalSnapshot')::numeric <> v_rounding_expected
       or (v_rounding_snapshot->>'roundingResultKrw')::numeric <> v_rounding_expected then
      raise exception 'clinical_master_phase1a3_replay_rounding_matrix_mismatch:%',
        v_rounding_case.rounding_rule;
    end if;
  end loop;

  -- The private SQL CASE is the sole live mapper. Keep this assertion
  -- independent from the TypeScript mirror so drift fails the replay.
  for i in 1..array_length(v_expected, 1) loop
    v_category := split_part(v_expected[i], ':', 1);
    v_billing_category := private.clair_map_catalog_category_to_billing_category(v_category);
    if v_category || ':' || v_billing_category <> v_expected[i] then
      raise exception 'clinical_master_phase1a3_replay_category_mapping_drift:%', v_expected[i];
    end if;
  end loop;

  -- Persist every row through the server snapshot builder. Client names,
  -- category, price, and snapshot claims are absent from this insert by
  -- design; only catalog intent and quantity are selected.
  for i in 1..array_length(v_categories, 1) loop
    v_order_id := ('a3000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid;
    v_snapshot := private.clair_build_catalog_order_snapshot(
      v_workspace,
      'a3-replay-catalog-' || v_categories[i],
      2
    );
    insert into public.orders (
      id, workspace_id, encounter_id, service_item_id,
      workspace_catalog_item_id, source_master_record_id, source_master_revision,
      workspace_catalog_revision,
      order_type, display_name, billing_display_name, status, work_status,
      quantity, unit_price_snapshot,
      requested_by_user_id, requested_at, row_type, source_order_id,
      source_order_version, applied_snapshot, applied_price_snapshot,
      calculation_inputs, calculation_outputs, billing_reflection_enabled,
      order_confirmation_status, billing_candidate_status, task_status
    ) values (
      v_order_id, v_workspace, v_encounter, null,
      v_snapshot->>'workspaceCatalogItemId',
      nullif(v_snapshot->>'sourceMasterRecordId', '')::uuid,
      nullif(v_snapshot->>'sourceMasterRevision', '')::integer,
      (v_snapshot->>'workspaceCatalogRevision')::integer,
      v_snapshot->>'orderType', v_snapshot->>'inHospitalOrderName',
      v_snapshot->>'billingName', 'requested', 'pending', 2,
      (v_snapshot->>'priceKrw')::numeric,
      v_admin, now(), 'individual', v_snapshot->>'sourcePresetId',
      v_snapshot->>'sourcePresetVersion', v_snapshot,
      jsonb_build_object(
        'priceKrw', v_snapshot->'priceKrw',
        'quantity', 2,
        'lineTotalSnapshot', v_snapshot->'lineTotalSnapshot',
        'roundingRule', v_snapshot->'roundingRule',
        'roundingResultKrw', v_snapshot->'roundingResultKrw',
        'taxIncluded', v_snapshot->'taxIncluded',
        'taxType', v_snapshot->'taxType',
        'workspaceCatalogItemId', v_snapshot->'workspaceCatalogItemId',
        'workspaceCatalogRevision', v_snapshot->'workspaceCatalogRevision'
      ),
      jsonb_build_object(
        'source', 'clinical_master_phase1a3_replay',
        'roundingRule', v_snapshot->'roundingRule',
        'storageScale', 2
      ),
      jsonb_build_object(
        'source', 'clinical_master_phase1a3_replay',
        'lineTotalSnapshot', v_snapshot->'lineTotalSnapshot',
        'priceKrw', v_snapshot->'priceKrw',
        'roundingRule', v_snapshot->'roundingRule',
        'roundingResultKrw', v_snapshot->'roundingResultKrw',
        'taxType', v_snapshot->'taxType'
      ),
      (v_snapshot->>'billingReflectionEnabled')::boolean,
      'draft', 'not_requested', 'pending'
    );
    if v_categories[i] = 'misc'
       and jsonb_typeof(v_snapshot->'priceKrw') <> 'null' then
      raise exception 'clinical_master_phase1a3_replay_null_price_lost';
    end if;
    if v_categories[i] = 'hospitalization'
       and (v_snapshot->>'priceKrw') <> '0' then
      raise exception 'clinical_master_phase1a3_replay_explicit_zero_lost';
    end if;
  end loop;

  -- Persist one fractional, non-as_is catalog order through the same path
  -- used by the client. This deliberately exercises the rounded result at
  -- invoice creation instead of only testing the private snapshot builder.
  v_snapshot := private.clair_build_catalog_order_snapshot(
    v_workspace,
    'a3-replay-catalog-medication',
    v_fractional_quantity
  );
  if v_snapshot->>'roundingRule' <> 'ceil'
     or (v_snapshot->>'priceKrw')::numeric <> 1001
     or (v_snapshot->>'roundingResultKrw')::numeric
          <> ceil(1001 * v_fractional_quantity) then
    raise exception 'clinical_master_phase1a3_replay_fractional_snapshot_invalid';
  end if;
  insert into public.orders (
    id, workspace_id, encounter_id, service_item_id,
    workspace_catalog_item_id, source_master_record_id, source_master_revision,
    workspace_catalog_revision,
    order_type, display_name, billing_display_name, status, work_status,
    quantity, unit_price_snapshot,
    requested_by_user_id, requested_at, row_type, source_order_id,
    source_order_version, applied_snapshot, applied_price_snapshot,
    calculation_inputs, calculation_outputs, billing_reflection_enabled,
    order_confirmation_status, billing_candidate_status, task_status
  ) values (
    v_fractional_order_id, v_workspace, v_encounter, null,
    v_snapshot->>'workspaceCatalogItemId',
    nullif(v_snapshot->>'sourceMasterRecordId', '')::uuid,
    nullif(v_snapshot->>'sourceMasterRevision', '')::integer,
    (v_snapshot->>'workspaceCatalogRevision')::integer,
    v_snapshot->>'orderType', v_snapshot->>'inHospitalOrderName',
    v_snapshot->>'billingName', 'requested', 'pending', v_fractional_quantity,
    (v_snapshot->>'priceKrw')::numeric,
    v_admin, now(), 'individual', v_snapshot->>'sourcePresetId',
    v_snapshot->>'sourcePresetVersion', v_snapshot,
    jsonb_build_object(
      'priceKrw', v_snapshot->'priceKrw',
      'quantity', v_fractional_quantity,
      'lineTotalSnapshot', v_snapshot->'lineTotalSnapshot',
      'roundingRule', v_snapshot->'roundingRule',
      'roundingResultKrw', v_snapshot->'roundingResultKrw',
      'taxIncluded', v_snapshot->'taxIncluded',
      'taxType', v_snapshot->'taxType',
      'workspaceCatalogItemId', v_snapshot->'workspaceCatalogItemId',
      'workspaceCatalogRevision', v_snapshot->'workspaceCatalogRevision'
    ),
    jsonb_build_object(
      'source', 'clinical_master_phase1a3_replay',
      'quantity', v_fractional_quantity,
      'roundingRule', v_snapshot->'roundingRule',
      'storageScale', 2
    ),
    jsonb_build_object(
      'source', 'clinical_master_phase1a3_replay',
      'lineTotalSnapshot', v_snapshot->'lineTotalSnapshot',
      'priceKrw', v_snapshot->'priceKrw',
      'roundingRule', v_snapshot->'roundingRule',
      'roundingResultKrw', v_snapshot->'roundingResultKrw',
      'taxType', v_snapshot->'taxType'
    ),
    (v_snapshot->>'billingReflectionEnabled')::boolean,
    'draft', 'not_requested', 'pending'
  );

  select count(*)
    into v_master_lineage_count
  from public.orders o
  where o.workspace_id = v_workspace
    and o.encounter_id = v_encounter
    and o.id::text like 'a3000000-0000-4000-8000-%'
    and o.source_master_record_id is not null
    and o.source_master_revision is not null
    and o.applied_snapshot->>'sourceMasterRecordId' = o.source_master_record_id::text
    and (o.applied_snapshot->>'sourceMasterRevision')::integer = o.source_master_revision;
  if v_master_lineage_count <> 7 then
    raise exception 'clinical_master_phase1a3_replay_master_lineage_matrix_mismatch:%', v_master_lineage_count;
  end if;

  -- Create a second synthetic tenant only inside this transaction so the
  -- public encounter/order boundary is exercised without a shared patient or
  -- workspace claim.
  insert into public.workspaces (id, display_name, created_by_user_id)
  values (v_cross_workspace, 'A3 replay other workspace', v_admin);
  insert into public.patients (id, workspace_id, patient_no, name, species)
  values (v_cross_patient, v_cross_workspace, 'A3-REPLAY-001', 'A3 replay patient', 'dog');
  insert into public.encounters (
    id, workspace_id, patient_id, encounter_no, reception_type, status
  ) values (
    v_cross_encounter, v_cross_workspace, v_cross_patient,
    'A3-REPLAY-ENC-001', 'walk_in', 'waiting'
  );

  -- Exercise the persisted chart getter/action snapshot and billing reader
  -- path for the seven-row matrix. The non-billable misc row remains a chart
  -- order and is intentionally excluded from invoice-line creation.
  select array_agg(id order by id)
    into v_billable_order_ids
  from public.orders
  where workspace_id = v_workspace
    and encounter_id = v_encounter
    and id::text like 'a3000000-0000-4000-8000-%'
    and billing_reflection_enabled;
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  v_draft_rows := public.clair_get_chart_order_draft(v_workspace, v_encounter);
  if jsonb_typeof(v_draft_rows) = 'object' then
    v_b3_runtime := true;
    if jsonb_typeof(v_draft_rows -> 'rows') <> 'array' then
      raise exception 'clinical_master_phase1a3_replay_draft_getter_rows_shape_invalid';
    end if;
    v_draft_etag := v_draft_rows ->> 'etag';
    v_draft_rows := v_draft_rows -> 'rows';
  elsif jsonb_typeof(v_draft_rows) <> 'array' then
    raise exception 'clinical_master_phase1a3_replay_draft_getter_response_shape_invalid';
  else
    v_b3_runtime := false;
  end if;
  select count(*)
    into v_getter_count
  from jsonb_array_elements(v_draft_rows) row_data(value)
  where row_data.value->>'orderId' like 'a3000000-0000-4000-8000-%'
    and row_data.value->>'workspaceCatalogItemId' like 'a3-replay-catalog-%';
  if v_getter_count <> 7 then
    raise exception 'clinical_master_phase1a3_replay_draft_getter_matrix_mismatch:%', v_getter_count;
  end if;
  if v_b3_action_runtime then
    execute 'select public.clair_save_chart_order_action($1,$2,$3,$4,$5,$6)'
      into v_action_response
      using v_workspace, v_admin, v_encounter, 'confirm', v_billable_order_ids,
        v_draft_etag;
    if jsonb_typeof(v_action_response) <> 'object'
       or jsonb_typeof(v_action_response -> 'rows') <> 'array'
       or v_action_response ->> 'etag' is null then
      raise exception 'clinical_master_phase1a3_replay_action_response_shape_invalid';
    end if;
    v_draft_etag := v_action_response ->> 'etag';
    v_action_rows := v_action_response -> 'rows';
  else
    v_action_rows := public.clair_save_chart_order_action(
      v_workspace, v_admin, v_encounter, 'confirm', v_billable_order_ids
    );
  end if;
  v_billing_rows := public.clair_sync_billing_invoice_candidates_from_chart(
    v_workspace, v_admin, v_encounter, v_billable_order_ids
  );
  select nullif(row_data.value->>'invoiceId', '')::uuid
    into v_invoice_id
  from jsonb_array_elements(v_billing_rows) row_data(value)
  limit 1;
  if v_invoice_id is null then
    raise exception 'clinical_master_phase1a3_replay_billing_reader_invoice_missing';
  end if;
  v_invoice_rows := public.clair_get_billing_invoice_lines(v_workspace, v_invoice_id);
  select count(*)
    into v_invoice_line_count
  from jsonb_array_elements(v_invoice_rows->'lines') row_data(value)
  where row_data.value->>'orderId' = any(v_billable_order_ids::text[])
    and row_data.value->>'workspaceCatalogItemId' like 'a3-replay-catalog-%'
    and row_data.value->>'billingCategory' is not null
    and row_data.value->>'categoryGroup' is not null;
  if v_invoice_line_count <> 6 then
    raise exception 'clinical_master_phase1a3_replay_invoice_reader_matrix_mismatch:%', v_invoice_line_count;
  end if;
  reset role;
  if not exists (
    select 1
    from jsonb_array_elements(v_invoice_rows->'lines') row_data(value)
    where row_data.value->>'orderId' = v_treatment_order_id::text
      and row_data.value->>'taxType' = 'non_taxable'
      and row_data.value->'sourceOrderSnapshot'->>'taxType' = 'non_taxable'
      and row_data.value->'sourceOrderSnapshot'->'appliedSnapshot'
        = (select applied_snapshot from public.orders where id = v_treatment_order_id)
      and row_data.value->'sourceOrderSnapshot'->'appliedPriceSnapshot'
        = (select applied_price_snapshot from public.orders where id = v_treatment_order_id)
      and row_data.value->'sourceOrderSnapshot'->'calculationInputs'
        = (select calculation_inputs from public.orders where id = v_treatment_order_id)
      and row_data.value->'sourceOrderSnapshot'->'calculationOutputs'
        = (select calculation_outputs from public.orders where id = v_treatment_order_id)
      and row_data.value->'sourceOrderSnapshot' ? 'sourceSetRevisionId'
      and row_data.value->'sourceOrderSnapshot' ? 'appliedSnapshotSha256'
  ) then
    raise exception 'clinical_master_phase1a3_replay_frozen_invoice_provenance_missing';
  end if;
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', v_admin::text, true);

  -- Confirm and bill the fractional order through the public RPCs. The
  -- invoice line must use the persisted rounded result (ceil), not a fresh
  -- quantity * unit-price multiplication.
  if v_b3_action_runtime then
    v_draft_rows := public.clair_get_chart_order_draft(v_workspace, v_encounter);
    if jsonb_typeof(v_draft_rows) <> 'object'
       or jsonb_typeof(v_draft_rows -> 'rows') <> 'array'
       or v_draft_rows ->> 'etag' is null then
      raise exception 'clinical_master_phase1a3_replay_fractional_draft_response_shape_invalid';
    end if;
    v_draft_etag := v_draft_rows ->> 'etag';
    execute 'select public.clair_save_chart_order_action($1,$2,$3,$4,$5,$6)'
      into v_action_response
      using v_workspace, v_admin, v_encounter, 'confirm',
        array[v_fractional_order_id], v_draft_etag;
    if jsonb_typeof(v_action_response) <> 'object'
       or jsonb_typeof(v_action_response -> 'rows') <> 'array'
       or v_action_response ->> 'etag' is null then
      raise exception 'clinical_master_phase1a3_replay_fractional_action_response_shape_invalid';
    end if;
    v_draft_etag := v_action_response ->> 'etag';
    v_fractional_action_rows := v_action_response -> 'rows';
  else
    v_fractional_action_rows := public.clair_save_chart_order_action(
      v_workspace, v_admin, v_encounter, 'confirm', array[v_fractional_order_id]
    );
  end if;
  v_fractional_billing_rows := public.clair_sync_billing_invoice_candidates_from_chart(
    v_workspace, v_admin, v_encounter, array[v_fractional_order_id]
  );
  if not exists (
    select 1
    from jsonb_array_elements(v_fractional_billing_rows) row_data(value)
    where row_data.value->>'orderId' = v_fractional_order_id::text
      and nullif(row_data.value->>'invoiceId', '')::uuid = v_invoice_id
  ) then
    raise exception 'clinical_master_phase1a3_replay_fractional_invoice_missing';
  end if;
  reset role;
  select (o.calculation_outputs->>'roundingResultKrw')::numeric
    into v_fractional_expected
  from public.orders o
  where o.workspace_id = v_workspace and o.id = v_fractional_order_id;
  select il.line_total, il.unit_price, il.discount_amount
    into v_fractional_line_total, v_fractional_line_unit_price,
      v_fractional_line_discount_amount
  from public.invoice_lines il
  where il.workspace_id = v_workspace and il.order_id = v_fractional_order_id;
  if v_fractional_line_total is distinct from v_fractional_expected
     or v_fractional_line_total = (v_fractional_quantity * 1001)::numeric(12,2)
     or v_fractional_line_discount_amount < 0
     or not exists (
       select 1
       from public.invoice_lines il
       join public.orders o
         on o.workspace_id = il.workspace_id and o.id = il.order_id
       where il.workspace_id = v_workspace
         and il.order_id = v_fractional_order_id
         and il.source_order_snapshot->'calculationOutputs' = o.calculation_outputs
         and il.source_order_snapshot->>'roundingRule' = 'ceil'
         and (il.source_order_snapshot->>'lineTotalSnapshot')::numeric
             = v_fractional_expected
     ) then
    raise exception 'clinical_master_phase1a3_replay_fractional_invoice_rounding_mismatch';
  end if;
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', v_admin::text, true);

  -- B3 set parents persist lineTotalKrw as the parent-only amount while
  -- roundingResultKrw includes explicit-extra child subtotal. When the later
  -- set tables/functions are present, build both fixed and range parent rows
  -- with one explicit extra child and send all four persisted rows through
  -- the A3 billing wrapper. This stays dynamic so an A3-only database parses
  -- and replays without B2/B3 relations.
  if to_regclass('public.order_set_revisions') is not null
     and to_regprocedure('private.clair_b3_sha256(jsonb)') is not null
     and to_regprocedure(
       'private.clair_b3_expand_chart_order_set(text,uuid,text,uuid,jsonb,text,uuid)'
     ) is not null then
    execute $b3_regression$
    do $b3_inner$
    declare
      v_actor uuid := '00000000-0000-4000-8000-000000000001';
      v_workspace text := 'clair-demo';
      v_encounter uuid := '26000000-0000-4000-8000-000000000001';
      v_catalog_revision integer;
      v_request uuid;
      v_seed_result jsonb;
      v_revision uuid;
      v_item uuid;
      v_preview jsonb;
      v_item_json jsonb;
      v_parent_snapshot jsonb;
      v_parent_price_snapshot jsonb;
      v_parent_calc_inputs jsonb;
      v_parent_calc_outputs jsonb;
      v_child_snapshot jsonb;
      v_child_price_snapshot jsonb;
      v_child_calc_inputs jsonb;
      v_child_calc_outputs jsonb;
      v_parent_hash text;
      v_child_hash text;
      v_billing_rows jsonb;
      v_fixed_parent uuid := 'a3020000-0000-4000-8000-000000000001';
      v_fixed_child uuid := 'a3020000-0000-4000-8000-000000000002';
      v_range_parent uuid := 'a3020000-0000-4000-8000-000000000003';
      v_range_child uuid := 'a3020000-0000-4000-8000-000000000004';
      v_fixed_line_total numeric;
      v_fixed_child_total numeric;
      v_range_line_total numeric;
      v_range_child_total numeric;
      v_fixed_child_count integer;
      v_range_child_count integer;
    begin
      reset role;
      select catalog_revision
        into v_catalog_revision
      from public.order_catalog_items
      where workspace_id = v_workspace
        and id = 'a3-replay-catalog-medication';
      if v_catalog_revision is null then
        raise exception 'clinical_master_phase1a3_replay_b3_catalog_missing';
      end if;

      v_request := private.clair_b2_deterministic_uuid(
        'replay', array[v_workspace, 'a3-b3-fixed', '2026-08-20']::text[]
      );
      v_seed_result := private.clair_seed_order_set_compatibility_projection(
        v_workspace,
        'a3-replay-b3-fixed',
        jsonb_build_object(
          'setCategory', 'A3 B3 regression',
          'setName', 'A3 B3 fixed parent',
          'billingName', 'A3 B3 fixed parent billing',
          'amountBasis', 'set_fixed_price',
          'setPriceKrw', 5000,
          'rangeBasis', null,
          'salesUnit', 'per_each',
          'billingReflectionEnabled', true,
          'taxType', 'non_taxable',
          'targetSpecies', jsonb_build_array('dog'),
          'careGuide', null,
          'internalInstruction', null,
          'items', jsonb_build_array(jsonb_build_object(
            'childKind', 'atomic',
            'childOrderCatalogItemId', 'a3-replay-catalog-medication',
            'childOrderCatalogRevision', v_catalog_revision,
            'childOrderSetId', null,
            'childSetRevisionId', null,
            'sortOrder', 1,
            'defaultSelected', true,
            'billingReflectionDefault', true,
            'defaultQuantity', 1,
            'quantitySource', 'fixed_one'
          )),
          'priceRanges', jsonb_build_array()
        ),
        'active', v_actor, v_request
      );
      if v_seed_result->>'outcome' <> 'created' then
        raise exception 'clinical_master_phase1a3_replay_b3_fixed_seed_failed:%', v_seed_result;
      end if;
      select current_revision_id
        into v_revision
      from public.order_sets
      where workspace_id = v_workspace and id = 'a3-replay-b3-fixed';
      select id
        into v_item
      from public.order_set_revision_items
      where workspace_id = v_workspace
        and order_set_id = 'a3-replay-b3-fixed'
        and revision_id = v_revision
        and child_kind = 'atomic';
      v_preview := private.clair_b3_expand_chart_order_set(
        v_workspace, v_encounter, 'a3-replay-b3-fixed', v_revision,
        jsonb_build_object('items', jsonb_build_array(jsonb_build_object(
          'revisionItemId', v_item, 'selected', true, 'quantity', 1
        ))),
        'draft', v_fixed_parent
      );

      v_parent_snapshot := jsonb_build_object(
        'schemaVersion', 1,
        'rowType', 'set',
        'orderId', v_fixed_parent,
        'parentOrderId', null,
        'sourceSetId', v_preview -> 'set' -> 'sourceSetId',
        'sourceSetRevisionId', v_preview -> 'set' -> 'sourceSetRevisionId',
        'sourceSetRevisionNo', v_preview -> 'set' -> 'sourceSetRevisionNo',
        'sourceSetVersion', v_preview -> 'set' -> 'sourceSetVersion',
        'sourceSetRevisionItemId', null,
        'childSetId', null,
        'childSetRevisionId', null,
        'childSetRevisionNo', null,
        'sourcePresetId', null,
        'sourcePresetVersion', null,
        'workspaceCatalogItemId', null,
        'workspaceCatalogRevision', null,
        'sourceMasterRecordId', null,
        'sourceMasterRevision', null,
        'path', '[]'::jsonb,
        'standardOrderName', v_preview -> 'set' ->> 'displayName',
        'displayName', v_preview -> 'set' ->> 'displayName',
        'billingName', v_preview -> 'set' ->> 'billingName',
        'categoryGroup', 'set',
        'billingCategory', 'other',
        'orderType', 'set',
        'destinationModule', null,
        'taskRequired', false,
        'targetSpecies', v_preview -> 'set' -> 'targetSpecies',
        'salesUnit', v_preview -> 'set' -> 'salesUnit',
        'careGuide', v_preview -> 'set' -> 'careGuide',
        'internalInstruction', v_preview -> 'set' -> 'internalInstruction',
        'typeSpecificRuntimeContext', null,
        'sourceOrderId', null,
        'sourceOrderVersion', null,
        'billingReflectionEnabled', true,
        'taxIncluded', false,
        'quantitySource', 'fixed_one',
        'defaultQuantity', 1,
        'quantity', 1,
        'selected', true,
        'roundingRule', v_preview -> 'calculationInputs' ->> 'roundingRule',
        'items', v_preview -> 'items'
      );
      v_parent_price_snapshot := jsonb_build_object(
        'schemaVersion', 1,
        'amountBasis', v_preview -> 'set' ->> 'amountBasis',
        'setPriceKrw', v_preview -> 'set' -> 'setPriceKrw',
        'priceKrw', v_preview -> 'set' -> 'setPriceKrw',
        'taxType', 'non_taxable',
        'taxIncluded', false,
        'billedAs', 'set_parent',
        'billingReflectionEnabled', true,
        'explicitExtra', false,
        'roundingRule', v_preview -> 'calculationOutputs' ->> 'roundingRule',
        'roundingResultKrw', v_preview -> 'calculationOutputs' -> 'roundingResultKrw'
      );
      v_parent_calc_inputs := v_preview -> 'calculationInputs';
      v_parent_calc_outputs := v_preview -> 'calculationOutputs';
      v_parent_hash := private.clair_b3_sha256(jsonb_build_object(
        'appliedSnapshot', v_parent_snapshot,
        'appliedPriceSnapshot', v_parent_price_snapshot,
        'calculationInputs', v_parent_calc_inputs,
        'calculationOutputs', v_parent_calc_outputs
      ));
      insert into public.orders (
        id, workspace_id, encounter_id, order_type, display_name,
        billing_display_name, status, work_status, priority, quantity,
        unit_price_snapshot, requested_by_user_id, requested_at, sort_order,
        row_type, row_depth, source_set_id, source_set_version,
        source_set_revision_id, source_set_revision_no,
        applied_snapshot, applied_price_snapshot, calculation_inputs,
        calculation_outputs, quantity_source, price_rule_source,
        billing_reflection_enabled, order_confirmation_status,
        billing_candidate_status, applied_snapshot_schema_version,
        applied_snapshot_sha256, updated_at
      ) values (
        v_fixed_parent, v_workspace, v_encounter, 'set',
        v_preview -> 'set' ->> 'displayName',
        v_preview -> 'set' ->> 'billingName', 'confirmed', 'pending',
        'normal', 1, (v_preview -> 'set' ->> 'setPriceKrw')::numeric,
        v_actor, now(), 200, 'set', 0,
        v_preview -> 'set' ->> 'sourceSetId',
        v_preview -> 'set' ->> 'sourceSetVersion',
        (v_preview -> 'set' ->> 'sourceSetRevisionId')::uuid,
        (v_preview -> 'set' ->> 'sourceSetRevisionNo')::integer,
        v_parent_snapshot, v_parent_price_snapshot, v_parent_calc_inputs,
        v_parent_calc_outputs, 'fixed_one', 'set_fixed_price', true,
        'confirmed', 'not_requested', 1, v_parent_hash, now()
      );
      v_item_json := v_preview -> 'items' -> 0;
      v_child_snapshot := v_item_json -> 'appliedSnapshot' || jsonb_build_object(
        'orderId', v_fixed_child,
        'parentOrderId', v_fixed_parent
      );
      v_child_price_snapshot := jsonb_build_object(
        'schemaVersion', 1,
        'amountBasis', v_preview -> 'set' ->> 'amountBasis',
        'setPriceKrw', v_preview -> 'set' -> 'setPriceKrw',
        'priceKrw', v_item_json -> 'priceKrw',
        'taxType', v_item_json ->> 'taxType',
        'taxIncluded', v_item_json -> 'taxIncluded',
        'billedAs', 'atomic_child',
        'billingReflectionEnabled', true,
        'explicitExtra', true,
        'roundingRule', v_item_json ->> 'roundingRule',
        'roundingResultKrw', v_item_json -> 'roundingResultKrw'
      );
      v_child_calc_inputs := v_preview -> 'calculationInputs' || jsonb_build_object(
        'quantity', v_item_json -> 'quantity',
        'roundingRule', v_item_json ->> 'roundingRule'
      );
      v_child_calc_outputs := jsonb_build_object(
        'schemaVersion', 1,
        'childSubtotalKrw', (v_item_json ->> 'roundingResultKrw')::numeric,
        'explicitExtraSubtotalKrw', (v_item_json ->> 'roundingResultKrw')::numeric,
        'taxAmountKrw', 0,
        'finalTotalKrw', (v_item_json ->> 'roundingResultKrw')::numeric,
        'lineTotalKrw', (v_item_json ->> 'roundingResultKrw')::numeric,
        'taxType', v_item_json ->> 'taxType',
        'roundingRule', v_item_json ->> 'roundingRule',
        'roundingResultKrw', v_item_json -> 'roundingResultKrw'
      );
      v_child_hash := private.clair_b3_sha256(jsonb_build_object(
        'appliedSnapshot', v_child_snapshot,
        'appliedPriceSnapshot', v_child_price_snapshot,
        'calculationInputs', v_child_calc_inputs,
        'calculationOutputs', v_child_calc_outputs
      ));
      insert into public.orders (
        id, workspace_id, encounter_id, parent_chart_order_line_id,
        order_type, display_name, billing_display_name, status, work_status,
        priority, quantity, unit_price_snapshot, requested_by_user_id,
        requested_at, sort_order, row_type, row_depth, source_set_id,
        source_set_version, source_set_revision_id, source_set_revision_no,
        source_set_revision_item_id, set_item_id, workspace_catalog_item_id,
        source_master_record_id, source_master_revision,
        workspace_catalog_revision, applied_snapshot, applied_price_snapshot,
        calculation_inputs, calculation_outputs, quantity_source,
        price_rule_source, billing_reflection_enabled,
        order_confirmation_status, billing_candidate_status,
        applied_snapshot_schema_version, applied_snapshot_sha256, updated_at
      ) values (
        v_fixed_child, v_workspace, v_encounter, v_fixed_parent,
        v_child_snapshot ->> 'orderType', v_child_snapshot ->> 'displayName',
        v_child_snapshot ->> 'billingName', 'confirmed', 'pending', 'normal',
        (v_item_json ->> 'quantity')::numeric,
        (v_item_json ->> 'priceKrw')::numeric, v_actor, now(), 201,
        'set_child', jsonb_array_length(v_child_snapshot -> 'path'),
        v_preview -> 'set' ->> 'sourceSetId',
        v_preview -> 'set' ->> 'sourceSetVersion',
        (v_preview -> 'set' ->> 'sourceSetRevisionId')::uuid,
        (v_preview -> 'set' ->> 'sourceSetRevisionNo')::integer,
        (v_item_json ->> 'revisionItemId')::uuid,
        v_item_json ->> 'revisionItemId',
        v_item_json ->> 'workspaceCatalogItemId',
        nullif(v_child_snapshot ->> 'sourceMasterRecordId', '')::uuid,
        nullif(v_child_snapshot ->> 'sourceMasterRevision', '')::integer,
        (v_item_json ->> 'appliedCatalogRevision')::integer,
        v_child_snapshot, v_child_price_snapshot, v_child_calc_inputs,
        v_child_calc_outputs, v_item_json ->> 'quantitySource',
        v_preview -> 'set' ->> 'amountBasis', true, 'confirmed',
        'not_requested', 1, v_child_hash, now()
      );

      v_request := private.clair_b2_deterministic_uuid(
        'replay', array[v_workspace, 'a3-b3-range', '2026-08-20']::text[]
      );
      v_seed_result := private.clair_seed_order_set_compatibility_projection(
        v_workspace,
        'a3-replay-b3-range',
        jsonb_build_object(
          'setCategory', 'A3 B3 regression',
          'setName', 'A3 B3 range parent',
          'billingName', 'A3 B3 range parent billing',
          'amountBasis', 'range_price',
          'setPriceKrw', null,
          'rangeBasis', 'patient_weight_kg',
          'salesUnit', 'per_each',
          'billingReflectionEnabled', true,
          'taxType', 'taxable',
          'targetSpecies', jsonb_build_array('dog'),
          'careGuide', null,
          'internalInstruction', null,
          'items', jsonb_build_array(jsonb_build_object(
            'childKind', 'atomic',
            'childOrderCatalogItemId', 'a3-replay-catalog-medication',
            'childOrderCatalogRevision', v_catalog_revision,
            'childOrderSetId', null,
            'childSetRevisionId', null,
            'sortOrder', 1,
            'defaultSelected', true,
            'billingReflectionDefault', true,
            'defaultQuantity', 1,
            'quantitySource', 'fixed_one'
          )),
          'priceRanges', jsonb_build_array(
            jsonb_build_object('sortOrder', 1, 'lowerBound', 0,
              'upperBound', 10, 'priceKrw', 7000),
            jsonb_build_object('sortOrder', 2, 'lowerBound', 10,
              'upperBound', null, 'priceKrw', 9000)
          )
        ),
        'active', v_actor, v_request
      );
      if v_seed_result->>'outcome' <> 'created' then
        raise exception 'clinical_master_phase1a3_replay_b3_range_seed_failed:%', v_seed_result;
      end if;
      select current_revision_id
        into v_revision
      from public.order_sets
      where workspace_id = v_workspace and id = 'a3-replay-b3-range';
      select id
        into v_item
      from public.order_set_revision_items
      where workspace_id = v_workspace
        and order_set_id = 'a3-replay-b3-range'
        and revision_id = v_revision
        and child_kind = 'atomic';
      v_preview := private.clair_b3_expand_chart_order_set(
        v_workspace, v_encounter, 'a3-replay-b3-range', v_revision,
        jsonb_build_object(
          'rangeInput', 1,
          'items', jsonb_build_array(jsonb_build_object(
            'revisionItemId', v_item, 'selected', true, 'quantity', 1
          ))
        ),
        'draft', v_range_parent
      );
      v_parent_snapshot := jsonb_build_object(
        'schemaVersion', 1, 'rowType', 'set', 'orderId', v_range_parent,
        'parentOrderId', null,
        'sourceSetId', v_preview -> 'set' -> 'sourceSetId',
        'sourceSetRevisionId', v_preview -> 'set' -> 'sourceSetRevisionId',
        'sourceSetRevisionNo', v_preview -> 'set' -> 'sourceSetRevisionNo',
        'sourceSetVersion', v_preview -> 'set' -> 'sourceSetVersion',
        'sourceSetRevisionItemId', null, 'childSetId', null,
        'childSetRevisionId', null, 'childSetRevisionNo', null,
        'sourcePresetId', null, 'sourcePresetVersion', null,
        'workspaceCatalogItemId', null, 'workspaceCatalogRevision', null,
        'sourceMasterRecordId', null, 'sourceMasterRevision', null,
        'path', '[]'::jsonb,
        'standardOrderName', v_preview -> 'set' ->> 'displayName',
        'displayName', v_preview -> 'set' ->> 'displayName',
        'billingName', v_preview -> 'set' ->> 'billingName',
        'categoryGroup', 'set', 'billingCategory', 'other',
        'orderType', 'set', 'destinationModule', null, 'taskRequired', false,
        'targetSpecies', v_preview -> 'set' -> 'targetSpecies',
        'salesUnit', v_preview -> 'set' -> 'salesUnit',
        'careGuide', v_preview -> 'set' -> 'careGuide',
        'internalInstruction', v_preview -> 'set' -> 'internalInstruction',
        'typeSpecificRuntimeContext', null, 'sourceOrderId', null,
        'sourceOrderVersion', null, 'billingReflectionEnabled', true,
        'taxIncluded', true, 'quantitySource', 'fixed_one',
        'defaultQuantity', 1, 'quantity', 1, 'selected', true,
        'roundingRule', v_preview -> 'calculationInputs' ->> 'roundingRule',
        'items', v_preview -> 'items'
      );
      v_parent_price_snapshot := jsonb_build_object(
        'schemaVersion', 1,
        'amountBasis', v_preview -> 'set' ->> 'amountBasis',
        'setPriceKrw', v_preview -> 'set' -> 'setPriceKrw',
        'priceKrw', v_preview -> 'set' -> 'setPriceKrw',
        'taxType', 'taxable', 'taxIncluded', true, 'billedAs', 'set_parent',
        'billingReflectionEnabled', true, 'explicitExtra', false,
        'roundingRule', v_preview -> 'calculationOutputs' ->> 'roundingRule',
        'roundingResultKrw', v_preview -> 'calculationOutputs' -> 'roundingResultKrw'
      );
      v_parent_calc_inputs := v_preview -> 'calculationInputs';
      v_parent_calc_outputs := v_preview -> 'calculationOutputs';
      v_parent_hash := private.clair_b3_sha256(jsonb_build_object(
        'appliedSnapshot', v_parent_snapshot,
        'appliedPriceSnapshot', v_parent_price_snapshot,
        'calculationInputs', v_parent_calc_inputs,
        'calculationOutputs', v_parent_calc_outputs
      ));
      insert into public.orders (
        id, workspace_id, encounter_id, order_type, display_name,
        billing_display_name, status, work_status, priority, quantity,
        unit_price_snapshot, requested_by_user_id, requested_at, sort_order,
        row_type, row_depth, source_set_id, source_set_version,
        source_set_revision_id, source_set_revision_no,
        applied_snapshot, applied_price_snapshot, calculation_inputs,
        calculation_outputs, quantity_source, price_rule_source,
        billing_reflection_enabled, order_confirmation_status,
        billing_candidate_status, applied_snapshot_schema_version,
        applied_snapshot_sha256, updated_at
      ) values (
        v_range_parent, v_workspace, v_encounter, 'set',
        v_preview -> 'set' ->> 'displayName',
        v_preview -> 'set' ->> 'billingName', 'confirmed', 'pending',
        'normal', 1, (v_preview -> 'set' ->> 'setPriceKrw')::numeric,
        v_actor, now(), 202, 'set', 0,
        v_preview -> 'set' ->> 'sourceSetId',
        v_preview -> 'set' ->> 'sourceSetVersion',
        (v_preview -> 'set' ->> 'sourceSetRevisionId')::uuid,
        (v_preview -> 'set' ->> 'sourceSetRevisionNo')::integer,
        v_parent_snapshot, v_parent_price_snapshot, v_parent_calc_inputs,
        v_parent_calc_outputs, 'fixed_one', 'range_price', true,
        'confirmed', 'not_requested', 1, v_parent_hash, now()
      );
      v_item_json := v_preview -> 'items' -> 0;
      v_child_snapshot := v_item_json -> 'appliedSnapshot' || jsonb_build_object(
        'orderId', v_range_child, 'parentOrderId', v_range_parent
      );
      v_child_price_snapshot := jsonb_build_object(
        'schemaVersion', 1,
        'amountBasis', v_preview -> 'set' ->> 'amountBasis',
        'setPriceKrw', v_preview -> 'set' -> 'setPriceKrw',
        'priceKrw', v_item_json -> 'priceKrw',
        'taxType', v_item_json ->> 'taxType',
        'taxIncluded', v_item_json -> 'taxIncluded',
        'billedAs', 'atomic_child', 'billingReflectionEnabled', true,
        'explicitExtra', true, 'roundingRule', v_item_json ->> 'roundingRule',
        'roundingResultKrw', v_item_json -> 'roundingResultKrw'
      );
      v_child_calc_inputs := v_preview -> 'calculationInputs' || jsonb_build_object(
        'quantity', v_item_json -> 'quantity',
        'roundingRule', v_item_json ->> 'roundingRule'
      );
      v_child_calc_outputs := jsonb_build_object(
        'schemaVersion', 1,
        'childSubtotalKrw', (v_item_json ->> 'roundingResultKrw')::numeric,
        'explicitExtraSubtotalKrw', (v_item_json ->> 'roundingResultKrw')::numeric,
        'taxAmountKrw', 0,
        'finalTotalKrw', (v_item_json ->> 'roundingResultKrw')::numeric,
        'lineTotalKrw', (v_item_json ->> 'roundingResultKrw')::numeric,
        'taxType', v_item_json ->> 'taxType',
        'roundingRule', v_item_json ->> 'roundingRule',
        'roundingResultKrw', v_item_json -> 'roundingResultKrw'
      );
      v_child_hash := private.clair_b3_sha256(jsonb_build_object(
        'appliedSnapshot', v_child_snapshot,
        'appliedPriceSnapshot', v_child_price_snapshot,
        'calculationInputs', v_child_calc_inputs,
        'calculationOutputs', v_child_calc_outputs
      ));
      insert into public.orders (
        id, workspace_id, encounter_id, parent_chart_order_line_id,
        order_type, display_name, billing_display_name, status, work_status,
        priority, quantity, unit_price_snapshot, requested_by_user_id,
        requested_at, sort_order, row_type, row_depth, source_set_id,
        source_set_version, source_set_revision_id, source_set_revision_no,
        source_set_revision_item_id, set_item_id, workspace_catalog_item_id,
        source_master_record_id, source_master_revision,
        workspace_catalog_revision, applied_snapshot, applied_price_snapshot,
        calculation_inputs, calculation_outputs, quantity_source,
        price_rule_source, billing_reflection_enabled,
        order_confirmation_status, billing_candidate_status,
        applied_snapshot_schema_version, applied_snapshot_sha256, updated_at
      ) values (
        v_range_child, v_workspace, v_encounter, v_range_parent,
        v_child_snapshot ->> 'orderType', v_child_snapshot ->> 'displayName',
        v_child_snapshot ->> 'billingName', 'confirmed', 'pending', 'normal',
        (v_item_json ->> 'quantity')::numeric,
        (v_item_json ->> 'priceKrw')::numeric, v_actor, now(), 203,
        'set_child', jsonb_array_length(v_child_snapshot -> 'path'),
        v_preview -> 'set' ->> 'sourceSetId',
        v_preview -> 'set' ->> 'sourceSetVersion',
        (v_preview -> 'set' ->> 'sourceSetRevisionId')::uuid,
        (v_preview -> 'set' ->> 'sourceSetRevisionNo')::integer,
        (v_item_json ->> 'revisionItemId')::uuid,
        v_item_json ->> 'revisionItemId',
        v_item_json ->> 'workspaceCatalogItemId',
        nullif(v_child_snapshot ->> 'sourceMasterRecordId', '')::uuid,
        nullif(v_child_snapshot ->> 'sourceMasterRevision', '')::integer,
        (v_item_json ->> 'appliedCatalogRevision')::integer,
        v_child_snapshot, v_child_price_snapshot, v_child_calc_inputs,
        v_child_calc_outputs, v_item_json ->> 'quantitySource',
        v_preview -> 'set' ->> 'amountBasis', true, 'confirmed',
        'not_requested', 1, v_child_hash, now()
      );

      set local role authenticated;
      perform set_config('request.jwt.claim.sub', v_actor::text, true);
      v_billing_rows := public.clair_sync_billing_invoice_candidates_from_chart(
        v_workspace, v_actor, v_encounter,
        array[v_fixed_parent, v_fixed_child, v_range_parent, v_range_child]
      );
      reset role;
      select il.line_total
        into v_fixed_line_total
      from public.invoice_lines il
      where il.workspace_id = v_workspace and il.order_id = v_fixed_parent;
      select il.line_total
        into v_fixed_child_total
      from public.invoice_lines il
      where il.workspace_id = v_workspace and il.order_id = v_fixed_child;
      select il.line_total
        into v_range_line_total
      from public.invoice_lines il
      where il.workspace_id = v_workspace and il.order_id = v_range_parent;
      select il.line_total
        into v_range_child_total
      from public.invoice_lines il
      where il.workspace_id = v_workspace and il.order_id = v_range_child;
      select count(*)
        into v_fixed_child_count
      from public.invoice_lines il
      where il.workspace_id = v_workspace and il.order_id = v_fixed_child;
      select count(*)
        into v_range_child_count
      from public.invoice_lines il
      where il.workspace_id = v_workspace and il.order_id = v_range_child;
      if v_fixed_line_total is distinct from 5000
         or v_fixed_child_total is distinct from 1001
         or v_range_line_total is distinct from 7000
         or v_range_child_total is distinct from 1001
         or v_fixed_child_count <> 1
         or v_range_child_count <> 1 then
        raise exception 'clinical_master_phase1a3_replay_b3_fixed_range_amount_mismatch';
      end if;
      set local role authenticated;
      perform set_config('request.jwt.claim.sub', v_actor::text, true);
    end
    $b3_inner$
    $b3_regression$;
    v_b3_fixed_range_regression := true;
  end if;

  -- Fulfillment sync is an authenticated public-RPC boundary. Only a
  -- confirmed/billed order with a supported, task-required frozen route can
  -- create a work item; the source JSON is frozen on the first insert.
  v_fulfillment_rows := public.clair_sync_fulfillment_work_items_from_orders(
    v_workspace, v_admin, v_encounter, array[v_lab_order_id]
  );
  select nullif(row_data.value->>'id', '')::uuid
    into v_work_item_id
  from jsonb_array_elements(v_fulfillment_rows) row_data(value)
  limit 1;
  if v_work_item_id is null then
    raise exception 'clinical_master_phase1a3_replay_fulfillment_work_item_missing';
  end if;
  if jsonb_typeof((v_fulfillment_rows->0)->'sourceSnapshot'->'detail'->'taskRequired')
       <> 'boolean' then
    raise exception 'clinical_master_phase1a3_replay_fulfillment_task_required_not_boolean';
  end if;
  v_before_fulfillment_snapshot := (v_fulfillment_rows->0)->'sourceSnapshot';

  -- A catalog edit between retries cannot rewrite the frozen fulfillment
  -- snapshot. This update is transaction-local synthetic catalog churn.
  reset role;
  update public.order_catalog_items
  set billing_name = billing_name || ' changed after fulfillment'
  where id = 'a3-replay-catalog-lab';
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  v_fulfillment_rows := public.clair_sync_fulfillment_work_items_from_orders(
    v_workspace, v_admin, v_encounter, array[v_lab_order_id]
  );
  v_after_fulfillment_snapshot := (v_fulfillment_rows->0)->'sourceSnapshot';
  if v_after_fulfillment_snapshot is distinct from v_before_fulfillment_snapshot then
    raise exception 'clinical_master_phase1a3_replay_fulfillment_snapshot_mutated_on_retry';
  end if;

  -- Direct sync attacks: actor spoof, missing chart:update, draft/pending,
  -- and billing-only route are all rejected before work-item creation.
  begin
    perform public.clair_sync_fulfillment_work_items_from_orders(
      v_workspace, v_front_desk, v_encounter, array[v_lab_order_id]
    );
    raise exception 'clinical_master_phase1a3_replay_sync_actor_spoof_accepted';
  exception when others then
    if sqlerrm not like '%workspace_membership_missing%' then raise; end if;
  end;
  perform set_config('request.jwt.claim.sub', v_front_desk::text, true);
  begin
    perform public.clair_sync_fulfillment_work_items_from_orders(
      v_workspace, v_front_desk, v_encounter, array[v_lab_order_id]
    );
    raise exception 'clinical_master_phase1a3_replay_sync_ordinary_accepted';
  exception when others then
    if sqlerrm not like '%permission_missing%' then raise; end if;
  end;
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  begin
    perform public.clair_sync_fulfillment_work_items_from_orders(
      v_workspace, v_admin, v_encounter, array[v_misc_order_id]
    );
    raise exception 'clinical_master_phase1a3_replay_sync_draft_accepted';
  exception when others then
    if sqlerrm not like '%order_unavailable%' then raise; end if;
  end;
  begin
    perform public.clair_sync_fulfillment_work_items_from_orders(
      v_workspace, v_admin, v_encounter, array[v_hospitalization_order_id]
    );
    raise exception 'clinical_master_phase1a3_replay_sync_billing_only_accepted';
  exception when others then
    if sqlerrm not like '%order_unavailable%' then raise; end if;
  end;

  -- The replaced transition RPC denies spoofed actors, wrong workspace,
  -- ordinary queue users, and inactive memberships before update/audit.
  begin
    perform public.clair_update_fulfillment_work_item(
      v_workspace, v_front_desk, v_work_item_id, 'accepted'
    );
    raise exception 'clinical_master_phase1a3_replay_transition_actor_spoof_accepted';
  exception when others then
    if sqlerrm not like '%workspace_membership_missing%' then raise; end if;
  end;
  begin
    perform public.clair_update_fulfillment_work_item(
      v_cross_workspace, v_admin, v_work_item_id, 'accepted'
    );
    raise exception 'clinical_master_phase1a3_replay_transition_wrong_workspace_accepted';
  exception when others then
    if sqlerrm not like '%workspace_membership_missing%' then raise; end if;
  end;
  perform set_config('request.jwt.claim.sub', v_front_desk::text, true);
  begin
    perform public.clair_update_fulfillment_work_item(
      v_workspace, v_front_desk, v_work_item_id, 'accepted'
    );
    raise exception 'clinical_master_phase1a3_replay_transition_queue_permission_accepted';
  exception when others then
    if sqlerrm not like '%permission_missing%' then raise; end if;
  end;
  perform set_config('request.jwt.claim.sub', v_inactive_front_desk::text, true);
  begin
    perform public.clair_update_fulfillment_work_item(
      v_workspace, v_inactive_front_desk, v_work_item_id, 'accepted'
    );
    raise exception 'clinical_master_phase1a3_replay_transition_inactive_accepted';
  exception when others then
    if sqlerrm not like '%workspace_membership_missing%' then raise; end if;
  end;
  perform set_config('request.jwt.claim.sub', v_admin::text, true);

  -- Fulfillment billing rejects incomplete, missing, wrong-scope, and
  -- wrong-queue work items before the private invoice helper.
  begin
    perform public.clair_sync_billing_invoice_candidates_from_fulfillment(
      v_workspace, v_admin, v_encounter, array[v_lab_order_id]
    );
    raise exception 'clinical_master_phase1a3_replay_billing_incomplete_accepted';
  exception when others then
    if sqlerrm not like '%work_item_unavailable%' then raise; end if;
  end;
  begin
    perform public.clair_sync_billing_invoice_candidates_from_fulfillment(
      v_workspace, v_admin, v_cross_encounter, array[v_lab_order_id]
    );
    raise exception 'clinical_master_phase1a3_replay_billing_wrong_scope_accepted';
  exception when others then
    if sqlerrm not like '%work_item_unavailable%' then raise; end if;
  end;
  begin
    perform public.clair_sync_billing_invoice_candidates_from_fulfillment(
      v_workspace, v_admin, v_encounter, array[v_imaging_order_id]
    );
    raise exception 'clinical_master_phase1a3_replay_billing_wrong_queue_accepted';
  exception when others then
    if sqlerrm not like '%work_item_unavailable%' then raise; end if;
  end;

  -- Complete the queue item through the same public transition path, then
  -- prove the completed wrapper can reach the existing invoice anchor.
  perform public.clair_update_fulfillment_work_item(
    v_workspace, v_admin, v_work_item_id, 'accepted'
  );
  perform public.clair_update_fulfillment_work_item(
    v_workspace, v_admin, v_work_item_id, 'in_progress'
  );
  v_billing_rows := public.clair_update_fulfillment_work_item(
    v_workspace, v_admin, v_work_item_id, 'completed'
  );
  v_billing_rows := public.clair_sync_billing_invoice_candidates_from_fulfillment(
    v_workspace, v_admin, v_encounter, array[v_lab_order_id]
  );
  if jsonb_array_length(v_billing_rows) < 1 then
    raise exception 'clinical_master_phase1a3_replay_billing_completed_missing';
  end if;
  perform set_config('request.jwt.claim.sub', v_front_desk::text, true);
  begin
    perform public.clair_sync_billing_invoice_candidates_from_fulfillment(
      v_workspace, v_front_desk, v_encounter, array[v_lab_order_id]
    );
    raise exception 'clinical_master_phase1a3_replay_billing_queue_permission_accepted';
  exception when others then
    if sqlerrm not like '%permission_missing%' then raise; end if;
  end;
  perform set_config('request.jwt.claim.sub', v_admin::text, true);

  begin
    if v_b3_runtime then
      execute 'select public.clair_save_chart_order_draft($1,$2,$3,$4)'
        into v_zero_draft_rows
        using v_workspace, v_admin::text, v_cross_encounter,
          jsonb_build_object(
            'expectedEtag', '"' || repeat('0', 64) || '"',
            'rows', jsonb_build_array(jsonb_build_object(
              'orderId', 'a3000000-0000-4000-8000-000000000601',
              'workspaceCatalogItemId', 'a3-replay-catalog-consultation',
              'quantity', 1,
              'rowType', 'individual'
            ))
          );
    else
      perform public.clair_save_chart_order_draft(
        v_workspace, v_admin::text, v_cross_encounter,
        jsonb_build_array(jsonb_build_object(
          'orderId', 'a3000000-0000-4000-8000-000000000601',
          'workspaceCatalogItemId', 'a3-replay-catalog-consultation',
          'quantity', 1,
          'rowType', 'individual'
        ))
      );
    end if;
    raise exception 'clinical_master_phase1a3_replay_cross_workspace_encounter_accepted';
  exception when others then
    if sqlerrm not like '%encounter_unavailable%' then raise; end if;
  end;
  reset role;

  -- Pending/paused/inactive rows never enter a draft snapshot. A billable
  -- NULL is rejected by the A2 catalog check before a live active row exists;
  -- the helper still retains the explicit billable_price_required guard.
  update public.order_catalog_items
  set availability_status = 'paused'
  where id = 'a3-replay-catalog-consultation';
  begin
    perform private.clair_build_catalog_order_snapshot(
      v_workspace, 'a3-replay-catalog-consultation', 1
    );
    raise exception 'clinical_master_phase1a3_replay_paused_row_accepted';
  exception when others then
    if sqlerrm not like '%catalog_item_unavailable%' then raise; end if;
  end;
  update public.order_catalog_items
  set availability_status = 'active'
  where id = 'a3-replay-catalog-consultation';

  begin
    perform private.clair_build_catalog_order_snapshot(
      'other-workspace', 'a3-replay-catalog-consultation', 1
    );
    raise exception 'clinical_master_phase1a3_replay_cross_workspace_catalog_accepted';
  exception when others then
    if sqlerrm not like '%catalog_item_unavailable%' then raise; end if;
  end;

  -- A legacy set remains a set and is rejected by the action RPC. It does not
  -- acquire catalog lineage or a service projection.
  if to_regclass('public.order_set_revisions') is null
     or to_regprocedure('private.clair_b3_sha256(jsonb)') is null then
    insert into public.orders (
      id, workspace_id, encounter_id, order_type, display_name, status,
      work_status, requested_at, row_type, applied_snapshot, applied_price_snapshot,
      calculation_inputs, calculation_outputs, order_confirmation_status,
      billing_candidate_status
    ) values (
      v_set_order_id, v_workspace, v_encounter, 'treatment', 'A3 set probe',
      'requested', 'pending', now(), 'set', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb,
      '{}'::jsonb, 'draft', 'not_requested'
    );
  else
    -- When a local database also has the later B3 set constraints applied,
    -- seed the smallest valid root shape dynamically. The A3 action boundary
    -- still receives the row as a set and must reject it as unsupported.
    execute $sql$
      with payload as (
        select
          revision.id as revision_id,
          revision.revision_no,
          revision.order_set_id,
          jsonb_build_object(
            'schemaVersion', 1,
            'rowType', 'set',
            'orderId', $1::uuid,
            'sourceSetId', revision.order_set_id,
            'sourceSetRevisionId', revision.id,
            'sourceSetRevisionNo', revision.revision_no,
            'sourceSetVersion', 'order-set-revision-' || revision.revision_no::text,
            'categoryGroup', 'set',
            'billingCategory', 'other',
            'orderType', 'set',
            'path', '[]'::jsonb,
            'items', jsonb_build_array(jsonb_build_object(
              'path', '[]'::jsonb,
              'leafRevisionItemId', item.id,
              'workspaceCatalogItemId', item.child_order_catalog_item_id,
              'appliedSnapshot', jsonb_build_object(
                'schemaVersion', 1,
                'rowType', 'set_child'
              )
            ))
          ) as applied_snapshot,
          jsonb_build_object(
            'schemaVersion', 1,
            'billedAs', 'nonbillable_parent',
            'taxType', 'derived',
            'billingReflectionEnabled', false,
            'roundingRule', 'as_is',
            'roundingResultKrw', null
          ) as applied_price_snapshot,
          jsonb_build_object(
            'schemaVersion', 1,
            'selectionFingerprint', 'a3-replay-set',
            'roundingRule', 'as_is',
            'storageScale', 2
          ) as calculation_inputs,
          jsonb_build_object(
            'schemaVersion', 1,
            'taxType', 'derived',
            'roundingRule', 'as_is',
            'roundingResultKrw', null
          ) as calculation_outputs
        from public.order_set_revisions revision
        join lateral (
          select revision_item.id, revision_item.child_order_catalog_item_id
          from public.order_set_revision_items revision_item
          where revision_item.workspace_id = revision.workspace_id
            and revision_item.order_set_id = revision.order_set_id
            and revision_item.revision_id = revision.id
            and revision_item.child_kind = 'atomic'
            and revision_item.child_order_catalog_item_id is not null
          order by revision_item.sort_order
          limit 1
        ) item on true
        where revision.workspace_id = $2
          and revision.amount_basis = 'included_order_sum'
        order by revision.id
        limit 1
      ), hashed as (
        select payload.*,
          private.clair_b3_sha256(jsonb_build_object(
            'appliedSnapshot', payload.applied_snapshot,
            'appliedPriceSnapshot', payload.applied_price_snapshot,
            'calculationInputs', payload.calculation_inputs,
            'calculationOutputs', payload.calculation_outputs
          )) as snapshot_hash
        from payload
      )
      insert into public.orders (
        id, workspace_id, encounter_id, order_type, display_name, status,
        work_status, quantity, quantity_source, requested_by_user_id, requested_at,
        row_type, row_depth, source_set_id, source_set_version,
        source_set_revision_id, source_set_revision_no,
        applied_snapshot, applied_price_snapshot, calculation_inputs,
        calculation_outputs, billing_reflection_enabled,
        order_confirmation_status, billing_candidate_status,
        applied_snapshot_schema_version, applied_snapshot_sha256
      )
      select
        $1::uuid, $2, $3::uuid, 'set', 'A3 set probe', 'requested', 'pending',
        1, 'fixed_one', $4::uuid, now(), 'set', 0, hashed.order_set_id,
        'order-set-revision-' || hashed.revision_no::text,
        hashed.revision_id, hashed.revision_no,
        hashed.applied_snapshot, hashed.applied_price_snapshot,
        hashed.calculation_inputs, hashed.calculation_outputs, false,
        'draft', 'not_requested', 1, hashed.snapshot_hash
      from hashed
    $sql$ using v_set_order_id, v_workspace, v_encounter, v_admin;
  end if;

  -- The two rows below are created as postgres, then the action call is
  -- evaluated as an authenticated actor to exercise the public boundary.
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  if not v_b3_action_runtime then
    begin
      perform public.clair_save_chart_order_action(
        v_workspace, v_admin, v_encounter, 'confirm', array[v_set_order_id]
      );
      raise exception 'clinical_master_phase1a3_replay_set_confirmed';
    exception when others then
      if sqlerrm not like '%unsupported_order_type%' then raise; end if;
    end;
  end if;

  -- Authenticated direct catalog DML is denied by the A2/A3 boundary.
  v_denied := false;
  begin
    update public.order_catalog_items
    set billing_name = 'tampered'
    where id = 'a3-replay-catalog-consultation';
  exception when insufficient_privilege then
    v_denied := true;
  end;
  if not v_denied then
    raise exception 'clinical_master_phase1a3_replay_direct_catalog_dml_allowed';
  end if;

  -- Direct SQL attacks prove the draft RPC rejects non-finite/non-positive
  -- and over-limit quantity/client-price strings before touching the row.
  reset role;
  select quantity, applied_snapshot
    into v_before_misc_quantity, v_before_misc_snapshot
  from public.orders
  where id = v_misc_order_id;
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  foreach v_attack_value in array array['NaN', 'Infinity', '-Infinity', '0', '-1', '10000', '1000000000'] loop
    if v_b3_runtime then
      v_draft_rows := public.clair_get_chart_order_draft(v_workspace, v_encounter);
      if jsonb_typeof(v_draft_rows) <> 'object'
         or jsonb_typeof(v_draft_rows -> 'rows') <> 'array'
         or v_draft_rows ->> 'etag' is null then
        raise exception 'clinical_master_phase1a3_replay_quantity_attack_draft_response_shape_invalid';
      end if;
      v_draft_etag := v_draft_rows ->> 'etag';
    end if;
    begin
      if v_b3_runtime then
        execute 'select public.clair_save_chart_order_draft($1,$2,$3,$4)'
          into v_zero_draft_rows
          using v_workspace, v_admin::text, v_encounter,
            jsonb_build_object(
              'expectedEtag', v_draft_etag,
              'rows', jsonb_build_array(jsonb_build_object(
                'orderId', v_misc_order_id,
                'workspaceCatalogItemId', 'a3-replay-catalog-misc',
                'quantity', v_attack_value,
                'unitPriceSnapshot', '1000',
                'rowType', 'individual'
              ))
            );
      else
        perform public.clair_save_chart_order_draft(
          v_workspace, v_admin::text, v_encounter,
          jsonb_build_array(jsonb_build_object(
            'orderId', v_misc_order_id,
            'workspaceCatalogItemId', 'a3-replay-catalog-misc',
            'quantity', v_attack_value,
            'unitPriceSnapshot', '1000',
            'rowType', 'individual'
          ))
        );
      end if;
      raise exception 'clinical_master_phase1a3_replay_invalid_quantity_accepted:%', v_attack_value;
    exception when others then
      if sqlerrm not like '%invalid_order_rows%' then raise; end if;
    end;
  end loop;
  foreach v_attack_value in array array['NaN', 'Infinity', '-Infinity', '-1', '10000000000'] loop
    if v_b3_runtime then
      v_draft_rows := public.clair_get_chart_order_draft(v_workspace, v_encounter);
      if jsonb_typeof(v_draft_rows) <> 'object'
         or jsonb_typeof(v_draft_rows -> 'rows') <> 'array'
         or v_draft_rows ->> 'etag' is null then
        raise exception 'clinical_master_phase1a3_replay_price_attack_draft_response_shape_invalid';
      end if;
      v_draft_etag := v_draft_rows ->> 'etag';
    end if;
    begin
      if v_b3_runtime then
        execute 'select public.clair_save_chart_order_draft($1,$2,$3,$4)'
          into v_zero_draft_rows
          using v_workspace, v_admin::text, v_encounter,
            jsonb_build_object(
              'expectedEtag', v_draft_etag,
              'rows', jsonb_build_array(jsonb_build_object(
                'orderId', v_misc_order_id,
                'workspaceCatalogItemId', 'a3-replay-catalog-misc',
                'quantity', 1,
                'unitPriceSnapshot', v_attack_value,
                'rowType', 'individual'
              ))
            );
      else
        perform public.clair_save_chart_order_draft(
          v_workspace, v_admin::text, v_encounter,
          jsonb_build_array(jsonb_build_object(
            'orderId', v_misc_order_id,
            'workspaceCatalogItemId', 'a3-replay-catalog-misc',
            'quantity', '1',
            'unitPriceSnapshot', v_attack_value,
            'rowType', 'individual'
          ))
        );
      end if;
      raise exception 'clinical_master_phase1a3_replay_invalid_client_price_accepted:%', v_attack_value;
    exception when others then
      if sqlerrm not like '%invalid_order_rows%' then raise; end if;
    end;
  end loop;
  reset role;
  if (select quantity from public.orders where id = v_misc_order_id) is distinct from v_before_misc_quantity
     or (select applied_snapshot from public.orders where id = v_misc_order_id)
          is distinct from v_before_misc_snapshot then
    raise exception 'clinical_master_phase1a3_replay_invalid_numeric_mutated_row';
  end if;
  if (select jsonb_typeof(applied_snapshot->'priceKrw') <> 'null'
      from public.orders where id = v_misc_order_id)
     or (select jsonb_typeof(applied_price_snapshot->'priceKrw') <> 'null'
      from public.orders where id = v_misc_order_id) then
    raise exception 'clinical_master_phase1a3_replay_null_price_snapshot_lost';
  end if;

  -- Explicit zero must survive the full catalog draft -> confirmation ->
  -- frozen snapshot -> invoice/readback path as numeric zero. It is not an
  -- invalid client price and is never normalized to NULL.
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  if v_b3_action_runtime then
    v_draft_rows := public.clair_get_chart_order_draft(v_workspace, v_encounter);
    if jsonb_typeof(v_draft_rows) <> 'object'
       or jsonb_typeof(v_draft_rows -> 'rows') <> 'array'
       or v_draft_rows ->> 'etag' is null then
      raise exception 'clinical_master_phase1a3_replay_zero_draft_response_shape_invalid';
    end if;
    v_draft_etag := v_draft_rows ->> 'etag';
    execute 'select public.clair_save_chart_order_draft($1,$2,$3,$4)'
      into v_action_response
      using v_workspace, v_admin::text, v_encounter,
        jsonb_build_object(
          'expectedEtag', v_draft_etag,
          'rows', jsonb_build_array(jsonb_build_object(
            'orderId', v_zero_order_id,
            'workspaceCatalogItemId', 'a3-replay-catalog-hospitalization',
            'quantity', 2,
            'rowType', 'individual'
          ))
        );
    if jsonb_typeof(v_action_response) <> 'object'
       or jsonb_typeof(v_action_response -> 'rows') <> 'array'
       or v_action_response ->> 'etag' is null then
      raise exception 'clinical_master_phase1a3_replay_zero_draft_response_shape_invalid';
    end if;
    v_draft_etag := v_action_response ->> 'etag';
    v_zero_draft_rows := v_action_response -> 'rows';
  else
    v_zero_draft_rows := public.clair_save_chart_order_draft(
      v_workspace, v_admin::text, v_encounter,
      jsonb_build_array(jsonb_build_object(
        'orderId', v_zero_order_id,
        'workspaceCatalogItemId', 'a3-replay-catalog-hospitalization',
        'quantity', '2',
        'unitPriceSnapshot', '0',
        'rowType', 'individual'
      ))
    );
  end if;
  if not exists (
    select 1
    from jsonb_array_elements(v_zero_draft_rows) row_data(value)
    where row_data.value->>'orderId' = v_zero_order_id::text
      and (row_data.value->>'unitPriceSnapshot')::numeric = 0
      and row_data.value->'appliedSnapshot'->>'priceKrw' = '0'
  ) then
    raise exception 'clinical_master_phase1a3_replay_explicit_zero_draft_lost';
  end if;
  if v_b3_action_runtime then
    execute 'select public.clair_save_chart_order_action($1,$2,$3,$4,$5,$6)'
      into v_action_response
      using v_workspace, v_admin, v_encounter, 'confirm',
        array[v_zero_order_id], v_draft_etag;
    if jsonb_typeof(v_action_response) <> 'object'
       or jsonb_typeof(v_action_response -> 'rows') <> 'array'
       or v_action_response ->> 'etag' is null then
      raise exception 'clinical_master_phase1a3_replay_zero_action_response_shape_invalid';
    end if;
    v_draft_etag := v_action_response ->> 'etag';
    v_zero_action_rows := v_action_response -> 'rows';
  else
    v_zero_action_rows := public.clair_save_chart_order_action(
      v_workspace, v_admin, v_encounter, 'confirm', array[v_zero_order_id]
    );
  end if;
  if not exists (
    select 1
    from jsonb_array_elements(v_zero_action_rows) row_data(value)
    where row_data.value->>'orderId' = v_zero_order_id::text
      and row_data.value->'appliedSnapshot'->>'priceKrw' = '0'
      and row_data.value->'appliedPriceSnapshot'->>'priceKrw' = '0'
  ) then
    raise exception 'clinical_master_phase1a3_replay_explicit_zero_confirmation_lost';
  end if;
  v_zero_billing_rows := public.clair_sync_billing_invoice_candidates_from_chart(
    v_workspace, v_admin, v_encounter, array[v_zero_order_id]
  );
  select nullif(row_data.value->>'invoiceId', '')::uuid
    into v_zero_invoice_id
  from jsonb_array_elements(v_zero_billing_rows) row_data(value)
  where row_data.value->>'orderId' = v_zero_order_id::text
  limit 1;
  if v_zero_invoice_id is null then
    raise exception 'clinical_master_phase1a3_replay_explicit_zero_invoice_missing';
  end if;
  v_zero_invoice_rows := public.clair_get_billing_invoice_lines(
    v_workspace, v_zero_invoice_id
  );
  if not exists (
    select 1
    from jsonb_array_elements(v_zero_invoice_rows->'lines') row_data(value)
    where row_data.value->>'orderId' = v_zero_order_id::text
      and (row_data.value->>'unitPrice')::numeric = 0
      and row_data.value->'sourceOrderSnapshot'->'appliedSnapshot'->>'priceKrw' = '0'
  ) then
    raise exception 'clinical_master_phase1a3_replay_explicit_zero_invoice_readback_lost';
  end if;
  reset role;

  -- Build a paid legacy line with a NULL order anchor. Adoption changes only
  -- orders.invoice_line_id and returns the exact same line on retry. The
  -- legacy service-backed row is confirmed and handed off first, proving the
  -- compatibility path does not require catalog routing fields.
  insert into public.invoices (
    id, workspace_id, encounter_id, invoice_no, status, payment_state,
    subtotal_amount, total_amount, issued_at, paid_at
  ) values (
    v_legacy_invoice_id, v_workspace, v_encounter, 'A3-LEGACY-PAID', 'paid',
    'paid', 12000, 12000, now(), now()
  );
  insert into public.orders (
    id, workspace_id, encounter_id, order_type, service_item_id, display_name,
    billing_display_name, status, work_status, quantity, unit_price_snapshot,
    requested_by_user_id, requested_at,
    row_type, applied_snapshot, applied_price_snapshot,
    calculation_inputs, calculation_outputs, order_confirmation_status,
    billing_candidate_status
  ) values (
    v_legacy_order_id, v_workspace, v_encounter, 'treatment',
    v_legacy_service_item_id, 'A3 legacy order',
    'A3 legacy billing', 'requested', 'pending', 1, 12000, v_admin, now(),
    'individual', jsonb_build_object('legacy', true), '{}'::jsonb, '{}'::jsonb,
    '{}'::jsonb, 'draft', 'not_requested'
  );
  insert into public.invoice_lines (
    id, workspace_id, invoice_id, order_id, description, quantity, unit_price,
    billing_name_snapshot, source_order_snapshot, tax_type
  ) values (
    v_legacy_line_id, v_workspace, v_legacy_invoice_id, v_legacy_order_id,
    'A3 user edited legacy line', 3, 7777, 'A3 edited billing name',
    jsonb_build_object('userEdited', true), 'non_taxable'
  );
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  begin
    perform public.clair_sync_fulfillment_work_items_from_orders(
      v_workspace, v_admin, v_encounter, array[v_legacy_order_id]
    );
    raise exception 'clinical_master_phase1a3_replay_legacy_sync_draft_accepted';
  exception when others then
    if sqlerrm <> 'order_unavailable' then raise; end if;
  end;
  select count(*)
    into v_legacy_draft_work_item_count
  from public.order_fulfillment_work_items
  where workspace_id = v_workspace
    and encounter_id = v_encounter
    and order_id = v_legacy_order_id;
  if v_legacy_draft_work_item_count <> 0 then
    raise exception 'clinical_master_phase1a3_replay_legacy_draft_created_work_item';
  end if;
  if v_b3_action_runtime then
    v_draft_rows := public.clair_get_chart_order_draft(v_workspace, v_encounter);
    if jsonb_typeof(v_draft_rows) <> 'object'
       or jsonb_typeof(v_draft_rows -> 'rows') <> 'array'
       or v_draft_rows ->> 'etag' is null then
      raise exception 'clinical_master_phase1a3_replay_legacy_draft_response_shape_invalid';
    end if;
    v_draft_etag := v_draft_rows ->> 'etag';
    execute 'select public.clair_save_chart_order_action($1,$2,$3,$4,$5,$6)'
      into v_action_response
      using v_workspace, v_admin, v_encounter, 'confirm',
        array[v_legacy_order_id], v_draft_etag;
    if jsonb_typeof(v_action_response) <> 'object'
       or jsonb_typeof(v_action_response -> 'rows') <> 'array'
       or v_action_response ->> 'etag' is null then
      raise exception 'clinical_master_phase1a3_replay_legacy_action_response_shape_invalid';
    end if;
    v_draft_etag := v_action_response ->> 'etag';
    v_legacy_action_rows := v_action_response -> 'rows';
  else
    v_legacy_action_rows := public.clair_save_chart_order_action(
      v_workspace, v_admin, v_encounter, 'confirm', array[v_legacy_order_id]
    );
  end if;
  v_legacy_fulfillment_rows := public.clair_sync_fulfillment_work_items_from_orders(
    v_workspace, v_admin, v_encounter, array[v_legacy_order_id]
  );
  select nullif(row_data.value->>'id', '')::uuid
    into v_legacy_work_item_id
  from jsonb_array_elements(v_legacy_fulfillment_rows) row_data(value)
  limit 1;
  if v_legacy_work_item_id is null then
    raise exception 'clinical_master_phase1a3_replay_legacy_fulfillment_work_item_missing';
  end if;
  if not exists (
    select 1
    from jsonb_array_elements(v_legacy_fulfillment_rows) row_data(value)
    where row_data.value->>'orderId' = v_legacy_order_id::text
      and row_data.value->'sourceSnapshot'->>'serviceItemId'
        = v_legacy_service_item_id::text
      and not (row_data.value->'sourceSnapshot'->'frozenOrderSnapshot' ? 'taskRequired')
      and not (row_data.value->'sourceSnapshot'->'frozenOrderSnapshot' ? 'destinationModule')
  ) then
    raise exception 'clinical_master_phase1a3_replay_legacy_routing_inferred';
  end if;
  reset role;
  select display_name, applied_snapshot
    into v_before_order_name, v_before_order_snapshot
  from public.orders where id = v_legacy_order_id;
  select description, quantity, unit_price, source_order_snapshot
    into v_before_line_description, v_before_line_quantity,
      v_before_line_unit_price, v_before_line_snapshot
  from public.invoice_lines where id = v_legacy_line_id;

  reset role;
  perform pg_advisory_xact_lock(
    hashtextextended('clinical_billing:' || v_workspace || ':' || v_encounter::text, 0)
  );
  perform 1 from public.orders where workspace_id = v_workspace and id = v_legacy_order_id for update;
  select count(*), (array_agg(l.id order by l.id))[1]
    into v_line_count, v_legacy_line_id
  from public.invoice_lines l
  join public.invoices i on i.workspace_id = l.workspace_id and i.id = l.invoice_id
  where l.workspace_id = v_workspace and l.order_id = v_legacy_order_id
    and i.encounter_id = v_encounter;
  if v_line_count <> 1 then
    raise exception 'clinical_master_phase1a3_replay_adoption_not_deterministic';
  end if;
  perform 1 from public.invoice_lines where workspace_id = v_workspace and id = v_legacy_line_id for update;
  update public.orders
  set invoice_line_id = v_legacy_line_id
  where workspace_id = v_workspace and id = v_legacy_order_id and invoice_line_id is null;
  if (select invoice_line_id from public.orders where id = v_legacy_order_id) <> v_legacy_line_id then
    raise exception 'clinical_master_phase1a3_replay_adoption_failed';
  end if;
  if (select display_name from public.orders where id = v_legacy_order_id) <> v_before_order_name
     or (select applied_snapshot from public.orders where id = v_legacy_order_id) <> v_before_order_snapshot
     or (select description from public.invoice_lines where id = v_legacy_line_id) <> v_before_line_description
     or (select quantity from public.invoice_lines where id = v_legacy_line_id) <> v_before_line_quantity
     or (select unit_price from public.invoice_lines where id = v_legacy_line_id) <> v_before_line_unit_price
     or (select source_order_snapshot from public.invoice_lines where id = v_legacy_line_id) <> v_before_line_snapshot then
    raise exception 'clinical_master_phase1a3_replay_adoption_mutated_history';
  end if;

  -- Idempotent rerun: matching anchor is a no-op and all frozen values remain.
  perform 1 from public.orders where workspace_id = v_workspace and id = v_legacy_order_id for update;
  update public.orders
  set invoice_line_id = v_legacy_line_id
  where workspace_id = v_workspace and id = v_legacy_order_id and invoice_line_id is null;
  if (select invoice_line_id from public.orders where id = v_legacy_order_id) <> v_legacy_line_id then
    raise exception 'clinical_master_phase1a3_replay_adoption_retry_failed';
  end if;

  insert into clinical_master_phase1a3_replay_state(state_key, state_value)
  values (
    'clinical_master_phase1a3_replay_ok',
    jsonb_build_object(
      'categoryMappings', 7,
      'directCatalogOrders', 7,
      'masterLineageOrders', v_master_lineage_count,
      'chartGetterRows', v_getter_count,
      'actionRows', jsonb_array_length(v_action_rows),
      'billingReaderRows', v_invoice_line_count,
      'explicitZero', true,
      'explicitZeroDraftConfirmInvoiceReadback', true,
      'nonBillableNull', true,
      'setConfirm', 'unsupported_order_type',
      'adoptedLegacyAnchor', v_legacy_line_id,
      'adoptionRetryIdempotent', true,
      'directCatalogDmlDenied', true,
      'fulfillmentTaskRequiredBoolean', true,
      'legacyConfirmSyncCompatibility', true,
      'legacyDraftSyncDenied', true,
      'fulfillmentSnapshotRetryImmutable', true,
      'fulfillmentTransitionDirectRpcDenied', true,
      'fulfillmentBillingWrapperGuards', true,
      'draftFiniteNumericDirectRpcDenied', true,
      'nullPriceSnapshotPreserved', true,
      'roundingModes', 4,
      'fractionalRoundingInvoice', true,
      'fractionalQuantity', v_fractional_quantity,
      'fractionalExpected', v_fractional_expected,
      'fractionalLineTotal', v_fractional_line_total,
      'fractionalRawProduct', (v_fractional_quantity * 1001)::numeric(12,2),
      'b3FixedRangeExplicitExtraInvoice', v_b3_fixed_range_regression,
      'nonTaxableFrozenProvenance', true,
      'billableIdsOnly', true,
      'frozenInvoiceProvenance', true
    )
  );
end
$replay$;

select state_key, state_value
from clinical_master_phase1a3_replay_state;

-- The optional B3 regression creates four synthetic orders and two set
-- definitions.  Remove those rows before the catalog rows they reference;
-- keep every statement dynamic so this A3 replay remains valid on an A3-only
-- database where the B2/B3 set tables do not exist.
do $cleanup_b3$
begin
  if to_regclass('public.order_set_revisions') is not null then
    execute $sql$
      update public.orders
      set invoice_line_id = null
      where id in (
        'a3020000-0000-4000-8000-000000000001',
        'a3020000-0000-4000-8000-000000000002',
        'a3020000-0000-4000-8000-000000000003',
        'a3020000-0000-4000-8000-000000000004'
      )
    $sql$;
    execute $sql$
      delete from public.invoice_lines
      where order_id in (
        'a3020000-0000-4000-8000-000000000001',
        'a3020000-0000-4000-8000-000000000002',
        'a3020000-0000-4000-8000-000000000003',
        'a3020000-0000-4000-8000-000000000004'
      )
    $sql$;
    execute $sql$
      delete from public.order_events
      where order_id in (
        'a3020000-0000-4000-8000-000000000001',
        'a3020000-0000-4000-8000-000000000002',
        'a3020000-0000-4000-8000-000000000003',
        'a3020000-0000-4000-8000-000000000004'
      )
    $sql$;
    execute $sql$
      delete from public.orders
      where id in (
        'a3020000-0000-4000-8000-000000000001',
        'a3020000-0000-4000-8000-000000000002',
        'a3020000-0000-4000-8000-000000000003',
        'a3020000-0000-4000-8000-000000000004'
      )
    $sql$;
    execute $sql$
      select set_config('clinical_master.b2_internal_write', 'on', true)
    $sql$;
    execute $sql$
      update public.order_sets
      set current_revision_id = null,
          source_set_version = 'order-set-pending'
      where workspace_id = 'clair-demo'
        and id in ('a3-replay-b3-fixed', 'a3-replay-b3-range')
    $sql$;
    execute $sql$
      delete from public.order_set_revision_update_reviews
      where parent_order_set_id in ('a3-replay-b3-fixed', 'a3-replay-b3-range')
         or child_order_set_id in ('a3-replay-b3-fixed', 'a3-replay-b3-range')
    $sql$;
    execute $sql$
      delete from public.order_set_revisions
      where workspace_id = 'clair-demo'
        and order_set_id in ('a3-replay-b3-fixed', 'a3-replay-b3-range')
    $sql$;
    execute $sql$
      delete from public.order_set_items
      where workspace_id = 'clair-demo'
        and order_set_id in ('a3-replay-b3-fixed', 'a3-replay-b3-range')
    $sql$;
    execute $sql$
      delete from public.order_sets
      where workspace_id = 'clair-demo'
        and id in ('a3-replay-b3-fixed', 'a3-replay-b3-range')
    $sql$;
  end if;
end
$cleanup_b3$;

update public.orders
set invoice_line_id = null
where id = 'a3000000-0000-4000-8000-000000000201';
delete from public.invoice_lines where id = 'a3000000-0000-4000-8000-000000000203';
delete from public.invoices where id = 'a3000000-0000-4000-8000-000000000202';
delete from public.orders where id in (
  'a3000000-0000-4000-8000-000000000099',
  'a3000000-0000-4000-8000-000000000201',
  'a3000000-0000-4000-8000-000000000001',
  'a3000000-0000-4000-8000-000000000002',
  'a3000000-0000-4000-8000-000000000003',
  'a3000000-0000-4000-8000-000000000004',
  'a3000000-0000-4000-8000-000000000005',
  'a3000000-0000-4000-8000-000000000006',
  'a3000000-0000-4000-8000-000000000007',
  'a3000000-0000-4000-8000-000000000008',
  'a3010000-0000-4000-8000-000000000009'
);
delete from public.order_catalog_items where id like 'a3-replay-catalog-%';

do $cleanup$
begin
  if exists (select 1 from public.order_catalog_items where id like 'a3-replay-catalog-%')
     or exists (select 1 from public.orders where id::text like 'a3000000-0000-4000-8000-%')
     or exists (select 1 from public.orders where id = 'a3010000-0000-4000-8000-000000000009')
     or exists (select 1 from public.invoice_lines where id = 'a3000000-0000-4000-8000-000000000203')
     or exists (select 1 from public.invoices where id = 'a3000000-0000-4000-8000-000000000202') then
    raise exception 'clinical_master_phase1a3_replay_cleanup_failed';
  end if;
  raise notice 'clinical_master_phase1a3_replay_cleanup_ok';
end
$cleanup$;

rollback;
