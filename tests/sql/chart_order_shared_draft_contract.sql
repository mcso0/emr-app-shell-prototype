\set ON_ERROR_STOP on

begin;

insert into public.patients (
  id,
  workspace_id,
  patient_no,
  name,
  species
) values (
  '93000000-0000-4000-8000-000000000001',
  'workspace-clair-cheongdam',
  'PHASE3-DRAFT-001',
  'Phase3 합성 환자',
  'dog'
);

insert into public.encounters (
  id,
  workspace_id,
  patient_id,
  primary_veterinarian_id,
  encounter_no,
  reception_type,
  status
) values (
  '93000000-0000-4000-8000-000000000002',
  'workspace-clair-cheongdam',
  '93000000-0000-4000-8000-000000000001',
  '49110000-0000-4000-8000-000000000003',
  'PHASE3-DRAFT-ENC-001',
  'walk_in',
  'in_consultation'
);

insert into public.order_catalog_items (
  id,
  workspace_id,
  standard_order_id,
  source_preset_version,
  category_group,
  category_label,
  standard_order_name,
  in_hospital_order_name,
  billing_name,
  availability_status,
  price_krw,
  default_destination_module,
  default_task_required,
  billing_reflection_enabled,
  origin_type
) values (
  'phase3-local-lab',
  'workspace-clair-cheongdam',
  'phase3-local-lab',
  'phase3-v1',
  'lab',
  '임상',
  'Phase3 Local Lab',
  'Phase3 Local Lab',
  'Phase3 Local Lab',
  'active',
  15000,
  'lab',
  true,
  true,
  'workspace_custom'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '49110000-0000-4000-8000-000000000003',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

do $test$
declare
  v_initial jsonb;
  v_first jsonb;
  v_second jsonb;
  v_current jsonb;
  v_stale_rejected boolean := false;
  v_invalid_rejected boolean := false;
begin
  if not private.clair_current_user_has_workspace_permission(
    'workspace-clair-cheongdam',
    'chart:update'
  ) then
    raise exception 'phase3_fixture_permission_missing';
  end if;

  v_initial := public.clair_get_chart_order_draft(
    'workspace-clair-cheongdam',
    '93000000-0000-4000-8000-000000000002'
  );

  v_first := public.clair_save_chart_order_draft(
    'workspace-clair-cheongdam',
    '49110000-0000-4000-8000-000000000003',
    '93000000-0000-4000-8000-000000000002',
    jsonb_build_object(
      'expectedEtag', v_initial -> 'etag',
      'rows', jsonb_build_array(jsonb_build_object(
        'rowType', 'individual',
        'orderId', '93000000-0000-4000-8000-000000000101',
        'workspaceCatalogItemId', 'phase3-local-lab',
        'quantity', 1,
        'detailInputs', jsonb_build_object(
          'specimenType', 'serum',
          'collectionCondition', 'fasted'
        ),
        'detailSchemaVersion', 1,
        'priority', 'urgent'
      ))
    )
  );

  if v_first #>> '{rows,0,detailInputs,specimenType}' <> 'serum'
    or v_first #>> '{rows,0,priority}' <> 'urgent'
    or v_first #>> '{rows,0,clinicalOrderType}' <> 'clinical_lab'
    or v_first #>> '{rows,0,destinationModule}' <> 'lab'
  then
    raise exception 'phase3_first_device_readback_mismatch';
  end if;

  v_second := public.clair_save_chart_order_draft(
    'workspace-clair-cheongdam',
    '49110000-0000-4000-8000-000000000003',
    '93000000-0000-4000-8000-000000000002',
    jsonb_build_object(
      'expectedEtag', v_first -> 'etag',
      'rows', jsonb_build_array(jsonb_build_object(
        'rowType', 'individual',
        'orderId', '93000000-0000-4000-8000-000000000101',
        'workspaceCatalogItemId', 'phase3-local-lab',
        'quantity', 2,
        'detailInputs', jsonb_build_object(
          'specimenType', 'blood',
          'collectionCondition', 'room temperature'
        ),
        'detailSchemaVersion', 1,
        'priority', 'normal'
      ))
    )
  );

  begin
    perform public.clair_save_chart_order_draft(
      'workspace-clair-cheongdam',
      '49110000-0000-4000-8000-000000000003',
      '93000000-0000-4000-8000-000000000002',
      jsonb_build_object(
        'expectedEtag', v_first -> 'etag',
        'rows', jsonb_build_array(jsonb_build_object(
          'rowType', 'individual',
          'orderId', '93000000-0000-4000-8000-000000000101',
          'workspaceCatalogItemId', 'phase3-local-lab',
          'quantity', 99,
          'detailInputs', jsonb_build_object('specimenType', 'urine'),
          'detailSchemaVersion', 1,
          'priority', 'urgent'
        ))
      )
    );
  exception when others then
    v_stale_rejected := position('revision_conflict' in sqlerrm) > 0;
  end;
  if not v_stale_rejected then raise exception 'phase3_stale_etag_accepted'; end if;

  begin
    perform public.clair_save_chart_order_draft(
      'workspace-clair-cheongdam',
      '49110000-0000-4000-8000-000000000003',
      '93000000-0000-4000-8000-000000000002',
      jsonb_build_object(
        'expectedEtag', v_second -> 'etag',
        'rows', jsonb_build_array(jsonb_build_object(
          'rowType', 'individual',
          'orderId', '93000000-0000-4000-8000-000000000101',
          'workspaceCatalogItemId', 'phase3-local-lab',
          'quantity', 3,
          'detailInputs', jsonb_build_object('inventedClientField', 'unsafe'),
          'detailSchemaVersion', 1,
          'priority', 'normal'
        ))
      )
    );
  exception when others then
    v_invalid_rejected := position('detail_inputs_invalid' in sqlerrm) > 0;
  end;
  if not v_invalid_rejected then raise exception 'phase3_invalid_detail_accepted'; end if;

  v_current := public.clair_get_chart_order_draft(
    'workspace-clair-cheongdam',
    '93000000-0000-4000-8000-000000000002'
  );
  if v_current ->> 'etag' <> v_second ->> 'etag'
    or (v_current #>> '{rows,0,quantity}')::numeric <> 2
    or v_current #>> '{rows,0,detailInputs,specimenType}' <> 'blood'
    or v_current #>> '{rows,0,priority}' <> 'normal'
  then
    raise exception 'phase3_conflict_or_validation_overwrote_latest_draft';
  end if;

  raise notice 'phase3_shared_draft_contract_ok etag=%', v_second ->> 'etag';
end;
$test$;

reset role;

do $artifact$
begin
  if exists (
    select 1 from public.order_tasks
    where encounter_id = '93000000-0000-4000-8000-000000000002'
  ) or exists (
    select 1 from public.order_fulfillment_work_items
    where encounter_id = '93000000-0000-4000-8000-000000000002'
  ) or exists (
    select 1 from public.invoice_lines
    where order_id = '93000000-0000-4000-8000-000000000101'
  ) then
    raise exception 'phase3_draft_created_execution_or_billing_artifact';
  end if;
  raise notice 'phase3_draft_artifact_counts_ok task=0 queue=0 billing=0';
end;
$artifact$;

rollback;
