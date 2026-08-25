\set ON_ERROR_STOP on

begin;

insert into public.patients (
  id, workspace_id, patient_no, name, species
) values (
  '96000000-0000-4000-8000-000000000001',
  'workspace-clair-cheongdam',
  'PHASE9-BACKFILL-001',
  'Phase9 합성 환자',
  'dog'
);

insert into public.encounters (
  id, workspace_id, patient_id, primary_veterinarian_id,
  encounter_no, reception_type, status
) values (
  '96000000-0000-4000-8000-000000000002',
  'workspace-clair-cheongdam',
  '96000000-0000-4000-8000-000000000001',
  '49110000-0000-4000-8000-000000000003',
  'PHASE9-BACKFILL-ENC-001',
  'walk_in',
  'in_consultation'
);

insert into public.order_catalog_items (
  id, workspace_id, standard_order_id, source_preset_version,
  category_group, category_label, standard_order_name,
  in_hospital_order_name, billing_name, availability_status, price_krw,
  default_destination_module, default_task_required,
  billing_reflection_enabled, origin_type
) values
  (
    'phase9-set-lab', 'workspace-clair-cheongdam', 'phase9-set-lab', 'phase9-v1',
    'lab', '임상', 'Phase9 Set Lab', 'Phase9 Set Lab', 'Phase9 Set Lab',
    'active', 12000, 'lab', true, true, 'workspace_custom'
  ),
  (
    'phase9-set-consult', 'workspace-clair-cheongdam',
    'phase9-set-consult', 'phase9-v1',
    'consultation', '진료', 'Phase9 Set Consult', 'Phase9 Set Consult',
    'Phase9 Set Consult', 'active', 8000, 'chart_only', false, true,
    'workspace_custom'
  );

insert into public.order_sets (
  id, workspace_id, source_set_version, set_category, set_name, billing_name,
  amount_basis, billing_reflection_enabled, created_by_user_id, updated_by_user_id
) values (
  'phase9-set',
  'workspace-clair-cheongdam',
  'phase9-set-v1',
  '혼합',
  'Phase9 Durable Set',
  'Phase9 Durable Set',
  'included_order_sum',
  false,
  '49110000-0000-4000-8000-000000000003',
  '49110000-0000-4000-8000-000000000003'
);

insert into public.order_set_revisions (
  id, workspace_id, order_set_id, revision_no, validation_status,
  validation_errors, set_category, set_name, billing_name, amount_basis,
  set_price_krw, sales_unit, billing_reflection_enabled, tax_type,
  target_species, created_by_user_id
) values (
  '96000000-0000-4000-8000-000000000020',
  'workspace-clair-cheongdam',
  'phase9-set',
  1,
  'valid',
  '[]'::jsonb,
  '혼합',
  'Phase9 Durable Set',
  'Phase9 Durable Set',
  'included_order_sum',
  null,
  'per_each',
  false,
  'derived',
  array['dog','cat','other'],
  '49110000-0000-4000-8000-000000000003'
);

update public.order_sets
set current_revision_id = '96000000-0000-4000-8000-000000000020'
where workspace_id = 'workspace-clair-cheongdam' and id = 'phase9-set';

insert into public.order_set_revision_items (
  id, workspace_id, order_set_id, revision_id,
  child_kind, child_order_catalog_item_id, child_order_catalog_revision,
  sort_order, default_selected, billing_reflection_default,
  default_quantity, quantity_source
) values
  (
    '96000000-0000-4000-8000-000000000021',
    'workspace-clair-cheongdam', 'phase9-set',
    '96000000-0000-4000-8000-000000000020',
    'atomic', 'phase9-set-lab', 1, 10, true, true, 1, 'fixed_one'
  ),
  (
    '96000000-0000-4000-8000-000000000022',
    'workspace-clair-cheongdam', 'phase9-set',
    '96000000-0000-4000-8000-000000000020',
    'atomic', 'phase9-set-consult', 1, 20, true, true, 1, 'fixed_one'
  );

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '49110000-0000-4000-8000-000000000003',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

do $create_legacy_set_draft$
declare
  v_initial jsonb;
  v_saved jsonb;
begin
  v_initial := public.clair_get_chart_order_draft(
    'workspace-clair-cheongdam',
    '96000000-0000-4000-8000-000000000002'
  );
  v_saved := public.clair_save_chart_order_draft(
    'workspace-clair-cheongdam',
    '49110000-0000-4000-8000-000000000003',
    '96000000-0000-4000-8000-000000000002',
    jsonb_build_object(
      'expectedEtag', v_initial -> 'etag',
      'rows', jsonb_build_array(
        jsonb_build_object(
          'rowType', 'set',
          'orderId', '96000000-0000-4000-8000-000000000104',
          'sourceSetId', 'phase9-set',
          'sourceSetRevisionId', '96000000-0000-4000-8000-000000000020',
          'sourceSetRevisionNo', 1,
          'selectionIntent', jsonb_build_object(
            'items', jsonb_build_array(
              jsonb_build_object(
                'revisionItemId', '96000000-0000-4000-8000-000000000021',
                'selected', true,
                'quantity', 1
              ),
              jsonb_build_object(
                'revisionItemId', '96000000-0000-4000-8000-000000000022',
                'selected', true,
                'quantity', 1
              )
            )
          ),
          'detailInputs', '{}'::jsonb,
          'detailSchemaVersion', 1,
          'priority', 'normal',
          'childInputs', jsonb_build_array(
            jsonb_build_object(
              'revisionItemId', '96000000-0000-4000-8000-000000000021',
              'detailInputs', jsonb_build_object(
                'specimenType', 'blood',
                'testPanel', 'CBC',
                'collectionCondition', 'room temperature'
              ),
              'detailSchemaVersion', 1,
              'priority', 'normal'
            ),
            jsonb_build_object(
              'revisionItemId', '96000000-0000-4000-8000-000000000022',
              'detailInputs', jsonb_build_object(
                'responsibleClinicianId', '49110000-0000-4000-8000-000000000003',
                'occurrenceCount', 1,
                'timing', 'now',
                'instructionSummary', 'Phase9 legacy set consultation'
              ),
              'detailSchemaVersion', 1,
              'priority', 'normal'
            )
          )
        )
      )
    )
  );
end;
$create_legacy_set_draft$;

reset role;

update public.orders
set
  status = 'confirmed',
  order_confirmation_status = 'confirmed',
  confirmed_by_user_id = '49110000-0000-4000-8000-000000000003',
  confirmed_at = now() - interval '45 minutes'
where workspace_id = 'workspace-clair-cheongdam'
  and encounter_id = '96000000-0000-4000-8000-000000000002'
  and (
    id = '96000000-0000-4000-8000-000000000104'
    or parent_chart_order_line_id = '96000000-0000-4000-8000-000000000104'
  );

insert into public.orders (
  id, workspace_id, encounter_id, order_type, display_name,
  billing_display_name, status, priority, quantity, unit_price_snapshot,
  requested_by_user_id, requested_at, confirmed_by_user_id, confirmed_at,
  row_type, applied_snapshot, billing_reflection_enabled,
  order_confirmation_status, clinical_order_type, destination_module,
  execution_mode, detail_inputs, detail_schema_version, confirmed_snapshot,
  billing_eligible
) values
  (
    '96000000-0000-4000-8000-000000000101',
    'workspace-clair-cheongdam',
    '96000000-0000-4000-8000-000000000002',
    'lab', 'Phase9 routed completed', 'Phase9 routed completed',
    'completed', 'normal', 1, 15000,
    '49110000-0000-4000-8000-000000000003', now() - interval '2 hours',
    '49110000-0000-4000-8000-000000000003', now() - interval '2 hours',
    'individual', '{"source":"phase9-fixture"}'::jsonb, true,
    'confirmed', 'clinical_lab', 'lab', 'routed', '{}'::jsonb, 1,
    '{"source":"phase9-fixture","clinicalOrderType":"clinical_lab"}'::jsonb,
    true
  ),
  (
    '96000000-0000-4000-8000-000000000102',
    'workspace-clair-cheongdam',
    '96000000-0000-4000-8000-000000000002',
    'treatment', 'Phase9 destinationless', 'Phase9 destinationless',
    'confirmed', 'normal', 1, 10000,
    '49110000-0000-4000-8000-000000000003', now() - interval '90 minutes',
    '49110000-0000-4000-8000-000000000003', now() - interval '90 minutes',
    'individual', '{"source":"phase9-fixture"}'::jsonb, true,
    'confirmed', 'consultation', null, 'immediate_complete', '{}'::jsonb, 1,
    '{"source":"phase9-fixture","clinicalOrderType":"consultation"}'::jsonb,
    true
  ),
  (
    '96000000-0000-4000-8000-000000000103',
    'workspace-clair-cheongdam',
    '96000000-0000-4000-8000-000000000002',
    'imaging', 'Phase9 routed missing queue', 'Phase9 routed missing queue',
    'confirmed', 'normal', 1, 20000,
    '49110000-0000-4000-8000-000000000003', now() - interval '1 hour',
    '49110000-0000-4000-8000-000000000003', now() - interval '1 hour',
    'individual', '{"source":"phase9-fixture"}'::jsonb, true,
    'confirmed', 'imaging', 'imaging', 'routed', '{}'::jsonb, 1,
    '{"source":"phase9-fixture","clinicalOrderType":"imaging"}'::jsonb,
    true
  );

insert into public.order_fulfillment_work_items (
  id, workspace_id, encounter_id, order_id, order_type, queue_type,
  status, priority, requested_by_user_id, source_snapshot,
  completed_at, created_at, updated_at
) values (
  '96000000-0000-4000-8000-000000000201',
  'workspace-clair-cheongdam',
  '96000000-0000-4000-8000-000000000002',
  '96000000-0000-4000-8000-000000000101',
  'lab', 'lab', 'completed', 'normal',
  '49110000-0000-4000-8000-000000000003',
  '{"source":"phase9-existing-queue"}'::jsonb,
  now() - interval '30 minutes',
  now() - interval '2 hours',
  now() - interval '30 minutes'
);

insert into public.invoices (
  id, workspace_id, encounter_id, invoice_no, status, payment_state
) values (
  '96000000-0000-4000-8000-000000000301',
  'workspace-clair-cheongdam',
  '96000000-0000-4000-8000-000000000002',
  'PHASE9-INVOICE-001',
  'draft',
  'none'
);

insert into public.invoice_lines (
  id, workspace_id, invoice_id, order_id, description, quantity, unit_price
) values (
  '96000000-0000-4000-8000-000000000302',
  'workspace-clair-cheongdam',
  '96000000-0000-4000-8000-000000000301',
  '96000000-0000-4000-8000-000000000101',
  'Phase9 routed completed',
  1,
  15000
);

do $verify_phase9_backfill$
declare
  v_first jsonb;
  v_second jsonb;
begin
  v_first := private.clair_backfill_chart_order_execution();

  if (v_first ->> 'commandsInserted')::integer <> 4
    or (v_first ->> 'executionTasksInserted')::integer <> 5
    or (v_first ->> 'queueRowsInsertedOrLinked')::integer <> 3
    or (v_first ->> 'billingCandidatesInserted')::integer <> 5
    or (v_first ->> 'taskEventsInserted')::integer <> 6
  then
    raise exception 'phase9_backfill_count_mismatch:%', v_first;
  end if;

  if 5 <> (
    select count(*)
    from public.order_tasks
    where workspace_id = 'workspace-clair-cheongdam'
      and encounter_id = '96000000-0000-4000-8000-000000000002'
      and task_role = 'execution'
      and attempt_no = 1
  ) then
    raise exception 'phase9_task_count_mismatch';
  end if;

  if not exists (
    select 1
    from public.order_tasks task
    where task.workspace_id = 'workspace-clair-cheongdam'
      and task.order_id = '96000000-0000-4000-8000-000000000102'
      and task.status = 'complete'
      and task.destination_module is null
  ) or exists (
    select 1
    from public.order_fulfillment_work_items queue
    where queue.workspace_id = 'workspace-clair-cheongdam'
      and queue.order_id = '96000000-0000-4000-8000-000000000102'
  ) then
    raise exception 'phase9_destinationless_contract_mismatch';
  end if;

  if not exists (
    select 1
    from public.order_fulfillment_work_items queue
    join public.order_tasks task
      on task.workspace_id = queue.workspace_id and task.id = queue.task_id
    where queue.workspace_id = 'workspace-clair-cheongdam'
      and queue.order_id = '96000000-0000-4000-8000-000000000103'
      and queue.destination_module = 'imaging'
      and task.destination_module = 'imaging'
  ) then
    raise exception 'phase9_missing_queue_not_repaired';
  end if;

  if not exists (
    select 1
    from public.order_billing_candidates candidate
    where candidate.workspace_id = 'workspace-clair-cheongdam'
      and candidate.order_id = '96000000-0000-4000-8000-000000000101'
      and candidate.status = 'invoice_linked'
      and candidate.invoice_line_id = '96000000-0000-4000-8000-000000000302'
  ) then
    raise exception 'phase9_invoice_link_reconciliation_mismatch';
  end if;

  if not exists (
    select 1
    from public.order_tasks aggregate_task
    where aggregate_task.workspace_id = 'workspace-clair-cheongdam'
      and aggregate_task.order_id = '96000000-0000-4000-8000-000000000104'
      and aggregate_task.task_role = 'aggregate'
      and aggregate_task.status = 'partial_complete'
      and 2 = (
        select count(*)
        from public.order_tasks child_task
        where child_task.workspace_id = aggregate_task.workspace_id
          and child_task.parent_task_id = aggregate_task.id
          and child_task.task_role = 'execution'
      )
      and not exists (
        select 1
        from public.order_fulfillment_work_items queue
        where queue.workspace_id = aggregate_task.workspace_id
          and queue.task_id = aggregate_task.id
      )
  ) then
    raise exception 'phase9_durable_set_aggregate_mismatch';
  end if;

  v_second := private.clair_backfill_chart_order_execution();
  if (v_second ->> 'commandsInserted')::integer <> 0
    or (v_second ->> 'executionTasksInserted')::integer <> 0
    or (v_second ->> 'queueRowsInsertedOrLinked')::integer <> 0
    or (v_second ->> 'billingCandidatesInserted')::integer <> 0
    or (v_second ->> 'taskEventsInserted')::integer <> 0
  then
    raise exception 'phase9_backfill_not_idempotent:%', v_second;
  end if;

  raise notice 'phase9_production_backfill_ok first=% second=%', v_first, v_second;
end;
$verify_phase9_backfill$;

rollback;
