-- Run after the Plan/Order lifecycle migration inside a disposable transaction.
-- Every identifier is synthetic and the harness must roll the transaction back.

insert into public.patients (
  id, workspace_id, patient_no, name, species, sex
) values (
  '97000000-0000-4000-8000-000000000001',
  'workspace-clair-cheongdam', 'PO-SMOKE-1', 'Calc smoke', 'dog', 'unknown'
);

insert into public.encounters (
  id, workspace_id, patient_id, primary_veterinarian_id,
  encounter_no, reception_type, status
) values (
  '97000000-0000-4000-8000-000000000002',
  'workspace-clair-cheongdam',
  '97000000-0000-4000-8000-000000000001',
  '49110000-0000-4000-8000-000000000003',
  'EO-SMOKE-1', 'walk_in', 'in_consultation'
);

insert into public.patient_vital_measurements (
  id, workspace_id, patient_id, encounter_id, measured_at,
  recorded_by_user_id, weight_kg
) values (
  '97000000-0000-4000-8000-000000000003',
  'workspace-clair-cheongdam',
  '97000000-0000-4000-8000-000000000001',
  '97000000-0000-4000-8000-000000000002',
  now() - interval '1 minute',
  '49110000-0000-4000-8000-000000000003', 10
);

insert into public.order_catalog_items (
  id, workspace_id, standard_order_id, source_preset_version,
  category_group, category_label, standard_order_name,
  in_hospital_order_name, billing_name, availability_status,
  billing_reflection_enabled, price_krw, default_destination_module,
  classification_path_id, clinical_order_type, is_external_lab,
  destination_module, execution_mode, detail_schema_version,
  detail_field_schema, billing_eligible
) values (
  'smoke-catalog', 'workspace-clair-cheongdam',
  'smoke-standard', 'smoke-v1', 'medication', '약',
  'Calc smoke', 'Calc smoke', 'Calc smoke', 'active', true, 1000,
  'dispensing', (
    select id from master.classification_paths
    where retired_in_release_id is null
    order by id
    limit 1
  ),
  'dispensing', false, 'dispensing', 'routed', 1,
  private.clair_order_detail_field_schema_v1('dispensing'), true
);

insert into public.orders (
  id, workspace_id, encounter_id, order_type, display_name, status,
  requested_by_user_id, requested_at, clinical_order_type,
  destination_module, execution_mode, detail_inputs, applied_snapshot,
  billing_eligible, billing_reflection_enabled, quantity,
  unit_price_snapshot,
  workspace_catalog_item_id, workspace_catalog_revision
) values (
  '97000000-0000-4000-8000-000000000004',
  'workspace-clair-cheongdam',
  '97000000-0000-4000-8000-000000000002',
  'dispensing', 'Calc smoke', 'requested',
  '49110000-0000-4000-8000-000000000003', now(),
  'dispensing', 'dispensing', 'routed',
  '{
    "doseBasis":"kg","dose":2,"doseUnit":"mg/kg","route":"PO",
    "frequency":"bid","durationDays":2,"totalQuantity":4
  }'::jsonb,
  '{
    "workspaceCatalogItemId":"smoke-catalog",
    "workspaceCatalogRevision":1,
    "planOrderAuthority":{
      "schemaVersion":1,
      "calculationMode":"ingredient_based",
      "dispenseUnit":"mL",
      "referenceIngredientId":"ingredient-smoke",
      "productStrength":{
        "numeratorValue":20,"numeratorUnit":"mg",
        "denominatorValue":1,"denominatorUnit":"mL"
      },
      "preparationPolicy":{
        "increment":0.1,"roundingMode":"nearest",
        "displayPrecision":1,"noReasonTolerance":0.1
      },
      "priceBasis":"per_product_unit",
      "billingUnit":"mL",
      "taxClass":"taxable"
    }
  }'::jsonb,
  true, true, 4, 1000, 'smoke-catalog', 1
);

select set_config(
  'request.jwt.claim.sub',
  '49110000-0000-4000-8000-000000000003',
  true
);

do $security_boundary$
begin
  if not (
    select relation.relrowsecurity
    from pg_catalog.pg_class relation
    join pg_catalog.pg_namespace namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname = 'order_intended_assignee_commands'
  ) then
    raise exception 'intended assignee command RLS disabled';
  end if;
  if has_table_privilege(
    'authenticated',
    'public.order_intended_assignee_commands',
    'SELECT, INSERT, UPDATE, DELETE'
  ) then
    raise exception 'authenticated command ledger access remained granted';
  end if;
end
$security_boundary$;

do $smoke$
declare
  v_etag text;
  v_result jsonb;
  v_updated_at timestamptz;
  v_task_id uuid;
  v_work_item_id uuid;
  v_revision_result jsonb;
  v_immutable_rejected boolean := false;
  v_precheck_denied boolean := false;
begin
  select updated_at into v_updated_at
  from public.orders
  where id = '97000000-0000-4000-8000-000000000004';

  v_result := public.clair_save_order_actual_dispense_override(
    'workspace-clair-cheongdam',
    '49110000-0000-4000-8000-000000000003',
    '97000000-0000-4000-8000-000000000004',
    v_updated_at,
    1.2,
    '계량 단위 보정',
    'actual-dispense-smoke-0001'
  );
  if v_result ->> 'actualDispenseSource' <> 'manual_override'
    or (v_result ->> 'actualDispenseQuantity')::numeric <> 1.2
  then raise exception 'actual dispense override failed: %', v_result; end if;

  v_etag := private.clair_b3_order_draft_etag(
    'workspace-clair-cheongdam',
    '97000000-0000-4000-8000-000000000002'
  );
  v_result := public.clair_confirm_chart_order_candidates(
    'workspace-clair-cheongdam',
    '49110000-0000-4000-8000-000000000003',
    '97000000-0000-4000-8000-000000000002',
    array['97000000-0000-4000-8000-000000000004'::uuid],
    v_etag,
    'confirm-smoke-command-0001'
  );

  if (
    select confirmed_snapshot ->> 'actualDispenseQuantity'
    from public.orders
    where id = '97000000-0000-4000-8000-000000000004'
  ) <> '1.2' then
    raise exception 'confirmed actual dispense missing: %', v_result;
  end if;
  select id into v_task_id
  from public.order_tasks
  where order_id = '97000000-0000-4000-8000-000000000004'
    and attempt_no = 1;
  select id into v_work_item_id
  from public.order_fulfillment_work_items
  where order_id = '97000000-0000-4000-8000-000000000004';
  if not exists (
    select 1 from public.order_tasks
    where id = v_task_id
      and effective_snapshot ->> 'actualDispenseQuantity' = '1.2'
  ) or not exists (
    select 1 from public.order_fulfillment_work_items
    where id = v_work_item_id
      and source_snapshot ->> 'actualDispenseQuantity' = '1.2'
  ) then raise exception 'downstream confirmed snapshot missing'; end if;
  if not exists (
    select 1 from public.order_billing_candidates
    where order_id = '97000000-0000-4000-8000-000000000004'
      and price_basis_snapshot = 'per_product_unit'
      and billing_unit_snapshot = 'mL'
      and tax_class_snapshot = 'taxable'
      and quantity = 4.8
      and amount = 4800
      and source_snapshot ->> 'actualDispenseQuantity' = '1.2'
  ) then raise exception 'calculated billing candidate missing'; end if;

  update public.order_tasks
  set status = 'returned', returned_at = now(), updated_at = now()
  where id = v_task_id;
  update public.order_fulfillment_work_items
  set status = 'returned', returned_at = now(), reason = '조제량 재확인',
      updated_at = now()
  where id = v_work_item_id;

  v_revision_result := public.clair_mutate_chart_order_execution(
    'workspace-clair-cheongdam',
    '49110000-0000-4000-8000-000000000003',
    '97000000-0000-4000-8000-000000000004',
    're_request',
    '처방 변경 후 재확정',
    1,
    '{
      "detailInputs":{
        "doseBasis":"kg","dose":4,"doseUnit":"mg/kg","route":"PO",
        "frequency":"bid","durationDays":2,"totalQuantity":8
      },
      "detailSchemaVersion":1,
      "priority":"normal",
      "actualDispenseQuantity":2.1
    }'::jsonb,
    're-request-smoke-command-0001'
  );
  if (v_revision_result -> 'order' ->> 'revisionNo')::integer <> 2
    or v_revision_result -> 'order' -> 'calculationOutputs'
      ->> 'actualDispenseQuantity' <> '2.1'
    or (v_revision_result ->> 'confirmedSnapshotPreserved')::boolean
  then raise exception 'reconfirmation result invalid: %', v_revision_result; end if;
  if not exists (
    select 1 from public.order_tasks
    where order_id = '97000000-0000-4000-8000-000000000004'
      and attempt_no = 2
      and re_requested_from_task_id = v_task_id
      and effective_snapshot ->> 'actualDispenseQuantity' = '2.1'
  ) then raise exception 'linked reconfirmed task missing'; end if;
  if not exists (
    select 1 from public.order_billing_candidates
    where order_id = '97000000-0000-4000-8000-000000000004'
      and quantity = 8.4
      and amount = 8400
      and source_snapshot ->> 'actualDispenseQuantity' = '2.1'
  ) then raise exception 'reconfirmed billing candidate missing'; end if;
  if (
    select count(*) from public.order_actual_dispense_overrides
    where order_id = '97000000-0000-4000-8000-000000000004'
  ) <> 2 then raise exception 'append-only actual history missing'; end if;

  begin
    update public.order_actual_dispense_overrides
    set reason = '이력 변경 시도'
    where order_id = '97000000-0000-4000-8000-000000000004';
  exception when sqlstate '55000' then
    v_immutable_rejected := true;
  end;
  if not v_immutable_rejected then
    raise exception 'actual dispense history was mutable';
  end if;

  update public.orders orders
  set calculation_outputs = coalesce(orders.calculation_outputs, '{}'::jsonb)
    || jsonb_build_object(
      'dispenseApplicability', true,
      'calculationStatus', 'ready',
      'requiresReconfirmation', true
    )
  where orders.id = '97000000-0000-4000-8000-000000000004';
  perform set_config(
    'request.jwt.claim.sub',
    '98000000-0000-4000-8000-000000000001',
    true
  );
  begin
    perform public.clair_confirm_chart_order_candidates(
      'workspace-clair-cheongdam',
      '98000000-0000-4000-8000-000000000001',
      '97000000-0000-4000-8000-000000000002',
      array['97000000-0000-4000-8000-000000000004'::uuid],
      '"' || repeat('0', 64) || '"',
      'unauthorized-confirm-probe-0001'
    );
  exception when sqlstate '42501' then
    if sqlerrm <> 'permission_missing' then raise; end if;
    v_precheck_denied := true;
  end;
  if not v_precheck_denied then
    raise exception 'confirmation precheck ran before authorization';
  end if;
  perform set_config(
    'request.jwt.claim.sub',
    '49110000-0000-4000-8000-000000000003',
    true
  );
end
$smoke$;
