\set ON_ERROR_STOP on
begin;
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

end;
$smoke$;

do $adjustment$
declare
  v_result jsonb;
  v_first jsonb;
  v_base bigint;
begin
  select amount into strict v_base from public.order_billing_candidates
  where order_id = '97000000-0000-4000-8000-000000000004';
  begin
    perform public.clair_save_chart_order_prebilling_override(
      'workspace-clair-cheongdam','49110000-0000-4000-8000-000000000003',
      '97000000-0000-4000-8000-000000000002','97000000-0000-4000-8000-000000000004',
      0,'pr038-unknown-field','{"unexpected":true}');
    raise exception 'unknown override field accepted';
  exception when others then
    if SQLERRM <> 'unknown_prebilling_override_field' then raise; end if;
  end;
  v_first := public.clair_save_chart_order_prebilling_override(
    'workspace-clair-cheongdam','49110000-0000-4000-8000-000000000003',
    '97000000-0000-4000-8000-000000000002','97000000-0000-4000-8000-000000000004',
    0,'pr038-percent-discount','{"adjustmentSource":"percent","adjustmentPercent":-10,"adjustmentReason":null}');
  if (v_first->>'chargeAmountKrw')::bigint <> round(v_base * 0.9)
    or v_first->>'adjustmentReason' is not null then
    raise exception 'optional signed discount failed';
  end if;
  v_result := public.clair_save_chart_order_prebilling_override(
    'workspace-clair-cheongdam','49110000-0000-4000-8000-000000000003',
    '97000000-0000-4000-8000-000000000002','97000000-0000-4000-8000-000000000004',
    0,'pr038-percent-discount','{"adjustmentSource":"percent","adjustmentPercent":-10,"adjustmentReason":null}');
  if v_result <> v_first then raise exception 'idempotent replay changed'; end if;
  begin
    perform public.clair_save_chart_order_prebilling_override(
      'workspace-clair-cheongdam','49110000-0000-4000-8000-000000000003',
      '97000000-0000-4000-8000-000000000002','97000000-0000-4000-8000-000000000004',
      0,'pr038-percent-discount','{"adjustmentSource":"percent","adjustmentPercent":10}');
    raise exception 'changed idempotent command accepted';
  exception when others then
    if SQLERRM <> 'idempotency_conflict' then raise; end if;
  end;
  begin
    perform public.clair_save_chart_order_prebilling_override(
      'workspace-clair-cheongdam','97000000-0000-4000-8000-000000000099',
      '97000000-0000-4000-8000-000000000002','97000000-0000-4000-8000-000000000004',
      1,'pr038-spoofed-actor','{"adjustmentReason":"spoof"}');
    raise exception 'spoofed actor accepted';
  exception when others then
    if SQLERRM <> 'actor_mismatch' then raise; end if;
  end;
  begin
    perform public.clair_save_chart_order_prebilling_override(
      'pr038-other-workspace','49110000-0000-4000-8000-000000000003',
      '97000000-0000-4000-8000-000000000002','97000000-0000-4000-8000-000000000004',
      1,'pr038-foreign-workspace','{"adjustmentReason":"foreign"}');
    raise exception 'foreign workspace accepted';
  exception when others then
    if SQLERRM <> 'permission_missing' then raise; end if;
  end;
  begin
    perform public.clair_save_chart_order_prebilling_override(
      'workspace-clair-cheongdam','49110000-0000-4000-8000-000000000003',
      '97000000-0000-4000-8000-000000000099','97000000-0000-4000-8000-000000000004',
      1,'pr038-wrong-encounter','{"adjustmentReason":"foreign encounter"}');
    raise exception 'wrong encounter accepted';
  exception when others then
    if SQLERRM <> 'order_unavailable' then raise; end if;
  end;
  v_result := public.clair_save_chart_order_prebilling_override(
    'workspace-clair-cheongdam','49110000-0000-4000-8000-000000000003',
    '97000000-0000-4000-8000-000000000002','97000000-0000-4000-8000-000000000004',
    1,'pr038-arbitrary-reason','{"adjustmentReason":"free text <b> arbitrary"}');
  if v_result->>'adjustmentSource' <> 'percent' or (v_result->>'adjustmentPercent')::numeric <> -10
    or v_result->>'adjustmentReason' <> 'free text <b> arbitrary' then
    raise exception 'reason-only source preservation failed';
  end if;
  v_result := public.clair_save_chart_order_prebilling_override(
    'workspace-clair-cheongdam','49110000-0000-4000-8000-000000000003',
    '97000000-0000-4000-8000-000000000002','97000000-0000-4000-8000-000000000004',
    2,'pr038-clear-reason','{"adjustmentReason":"   "}');
  if v_result->>'adjustmentReason' is not null or (v_result->>'adjustmentPercent')::numeric <> -10
    then raise exception 'reason clear failed'; end if;
  v_result := public.clair_save_chart_order_prebilling_override(
    'workspace-clair-cheongdam','49110000-0000-4000-8000-000000000003',
    '97000000-0000-4000-8000-000000000002','97000000-0000-4000-8000-000000000004',
    3,'pr038-amount-surcharge',jsonb_build_object('adjustmentSource','amount','adjustmentAmountKrw',v_base / 10));
  if (v_result->>'adjustmentPercent')::numeric <> 10
    or (v_result->>'chargeAmountKrw')::bigint <> v_base + v_base / 10
    then raise exception 'amount surcharge linkage failed'; end if;
  begin
    perform public.clair_save_chart_order_prebilling_override(
      'workspace-clair-cheongdam','49110000-0000-4000-8000-000000000003',
      '97000000-0000-4000-8000-000000000002','97000000-0000-4000-8000-000000000004',
      3,'pr038-stale-reason','{"adjustmentReason":"stale"}');
    raise exception 'stale mutation accepted';
  exception when others then
    if SQLERRM <> 'revision_conflict' then raise; end if;
  end;
  begin
    perform public.clair_save_chart_order_prebilling_override(
      'workspace-clair-cheongdam','49110000-0000-4000-8000-000000000003',
      '97000000-0000-4000-8000-000000000002','97000000-0000-4000-8000-000000000004',
      4,'pr038-negative-charge',jsonb_build_object('adjustmentSource','amount','adjustmentAmountKrw',-v_base-1));
    raise exception 'negative total accepted';
  exception when others then
    if SQLERRM <> 'negative_charge' then raise; end if;
  end;
  if (select count(*) from public.order_prebilling_overrides where order_id='97000000-0000-4000-8000-000000000004') <> 4
    then raise exception 'immutable history count incorrect'; end if;
  if (select count(*) from public.audit_events where target_id='97000000-0000-4000-8000-000000000004'
      and metadata->>'source'='order-prebilling-override-v1') <> 4
    then raise exception 'audit count incorrect'; end if;
  begin
    update public.order_prebilling_overrides set adjustment_reason='rewrite'
    where order_id='97000000-0000-4000-8000-000000000004';
    raise exception 'history mutation accepted';
  exception when others then
    if SQLERRM <> 'prebilling_override_immutable' then raise; end if;
  end;
  if not has_function_privilege('authenticated',
    'public.clair_save_chart_order_prebilling_override(text,uuid,uuid,uuid,integer,text,jsonb)', 'EXECUTE')
    or has_function_privilege('anon',
    'public.clair_save_chart_order_prebilling_override(text,uuid,uuid,uuid,integer,text,jsonb)', 'EXECUTE')
    or has_function_privilege('service_role',
    'public.clair_save_chart_order_prebilling_override(text,uuid,uuid,uuid,integer,text,jsonb)', 'EXECUTE')
    then raise exception 'RPC privileges changed'; end if;
  if not (select relrowsecurity from pg_class where oid='public.order_prebilling_overrides'::regclass)
    then raise exception 'history RLS disabled'; end if;
end;
$adjustment$;
set constraints all immediate;
rollback;
select 'PASS plan_order_optional_reason_contract' as verification;
