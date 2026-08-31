\set ON_ERROR_STOP on

begin;

insert into public.patients (
  id, workspace_id, patient_no, name, species
) values (
  '94000000-0000-4000-8000-000000000001',
  'workspace-clair-cheongdam',
  'PHASE4-CONFIRM-001',
  'Phase4 합성 환자',
  'dog'
);

insert into public.encounters (
  id, workspace_id, patient_id, primary_veterinarian_id,
  encounter_no, reception_type, status
) values (
  '94000000-0000-4000-8000-000000000002',
  'workspace-clair-cheongdam',
  '94000000-0000-4000-8000-000000000001',
  '49110000-0000-4000-8000-000000000003',
  'PHASE4-CONFIRM-ENC-001',
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
    'phase4-lab', 'workspace-clair-cheongdam', 'phase4-lab', 'phase4-v1',
    'lab', '임상', 'Phase4 Lab', 'Phase4 Lab', 'Phase4 Lab', 'active', 15000,
    'lab', true, true, 'workspace_custom'
  ),
  (
    'phase4-consult', 'workspace-clair-cheongdam', 'phase4-consult', 'phase4-v1',
    'consultation', '진료', 'Phase4 Consult', 'Phase4 Consult', 'Phase4 Consult',
    'active', 10000, 'chart_only', false, true, 'workspace_custom'
  ),
  (
    'phase4-imaging', 'workspace-clair-cheongdam', 'phase4-imaging', 'phase4-v1',
    'imaging', '영상', 'Phase4 Imaging', 'Phase4 Imaging', 'Phase4 Imaging',
    'active', 20000, 'imaging', true, true, 'workspace_custom'
  );

insert into public.order_sets (
  id, workspace_id, source_set_version, set_category, set_name, billing_name,
  amount_basis, set_price_krw, range_basis, range_price_ranges, sales_unit,
  billing_reflection_enabled, tax_type, created_by_user_id, updated_by_user_id
) values
  (
    'phase4-set', 'workspace-clair-cheongdam', 'phase4-set-v1',
    '혼합', 'Phase4 Mixed Set', 'Phase4 Mixed Set',
    'included_order_sum', null, null, '[]'::jsonb, 'per_each', false, 'derived',
    '49110000-0000-4000-8000-000000000003',
    '49110000-0000-4000-8000-000000000003'
  ),
  (
    'phase4-fixed-set', 'workspace-clair-cheongdam', 'phase4-fixed-set-v1',
    '혼합', 'Phase4 Fixed Set', 'Phase4 Fixed Set',
    'set_fixed_price', 50000, null, '[]'::jsonb, 'per_order', true, 'taxable',
    '49110000-0000-4000-8000-000000000003',
    '49110000-0000-4000-8000-000000000003'
  ),
  (
    'phase4-range-set', 'workspace-clair-cheongdam', 'phase4-range-set-v1',
    '혼합', 'Phase4 Range Set', 'Phase4 Range Set',
    'range_price', null, 'manual_value', '[]'::jsonb, 'per_order', true, 'taxable',
    '49110000-0000-4000-8000-000000000003',
    '49110000-0000-4000-8000-000000000003'
  );

insert into public.order_set_revisions (
  id, workspace_id, order_set_id, revision_no, validation_status,
  validation_errors, set_category, set_name, billing_name, amount_basis,
  set_price_krw, range_basis, sales_unit, billing_reflection_enabled, tax_type,
  target_species, created_by_user_id
) values
  (
    '94000000-0000-4000-8000-000000000020',
    'workspace-clair-cheongdam', 'phase4-set', 1, 'valid', '[]'::jsonb,
    '혼합', 'Phase4 Mixed Set', 'Phase4 Mixed Set',
    'included_order_sum', null, null, 'per_each', false, 'derived',
    array['dog','cat','other'],
    '49110000-0000-4000-8000-000000000003'
  ),
  (
    '94000000-0000-4000-8000-000000000030',
    'workspace-clair-cheongdam', 'phase4-fixed-set', 1, 'valid', '[]'::jsonb,
    '혼합', 'Phase4 Fixed Set', 'Phase4 Fixed Set',
    'set_fixed_price', 50000, null, 'per_order', true, 'taxable',
    array['dog','cat','other'],
    '49110000-0000-4000-8000-000000000003'
  ),
  (
    '94000000-0000-4000-8000-000000000040',
    'workspace-clair-cheongdam', 'phase4-range-set', 1, 'valid', '[]'::jsonb,
    '혼합', 'Phase4 Range Set', 'Phase4 Range Set',
    'range_price', null, 'manual_value', 'per_order', true, 'taxable',
    array['dog','cat','other'],
    '49110000-0000-4000-8000-000000000003'
  );

update public.order_sets
set current_revision_id = case id
  when 'phase4-set' then '94000000-0000-4000-8000-000000000020'::uuid
  when 'phase4-fixed-set' then '94000000-0000-4000-8000-000000000030'::uuid
  when 'phase4-range-set' then '94000000-0000-4000-8000-000000000040'::uuid
end
where workspace_id = 'workspace-clair-cheongdam'
  and id in ('phase4-set','phase4-fixed-set','phase4-range-set');

insert into public.order_set_revision_items (
  id, workspace_id, order_set_id, revision_id,
  child_kind, child_order_catalog_item_id, child_order_catalog_revision,
  sort_order, default_selected, billing_reflection_default,
  default_quantity, quantity_source
) values
  (
    '94000000-0000-4000-8000-000000000021',
    'workspace-clair-cheongdam', 'phase4-set',
    '94000000-0000-4000-8000-000000000020',
    'atomic', 'phase4-lab', 1, 10, true, true, 1, 'fixed_one'
  ),
  (
    '94000000-0000-4000-8000-000000000022',
    'workspace-clair-cheongdam', 'phase4-set',
    '94000000-0000-4000-8000-000000000020',
    'atomic', 'phase4-consult', 1, 20, true, true, 1, 'fixed_one'
  ),
  (
    '94000000-0000-4000-8000-000000000031',
    'workspace-clair-cheongdam', 'phase4-fixed-set',
    '94000000-0000-4000-8000-000000000030',
    'atomic', 'phase4-lab', 1, 10, true, false, 1, 'fixed_one'
  ),
  (
    '94000000-0000-4000-8000-000000000041',
    'workspace-clair-cheongdam', 'phase4-range-set',
    '94000000-0000-4000-8000-000000000040',
    'atomic', 'phase4-lab', 1, 10, true, false, 1, 'fixed_one'
  );

insert into public.order_set_revision_price_ranges (
  id, workspace_id, order_set_id, revision_id,
  sort_order, lower_bound, upper_bound, price_krw
) values (
  '94000000-0000-4000-8000-000000000042',
  'workspace-clair-cheongdam', 'phase4-range-set',
  '94000000-0000-4000-8000-000000000040',
  1, 0, null, 60000
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
  v_saved jsonb;
  v_confirmed jsonb;
  v_replayed jsonb;
  v_conflict_rejected boolean := false;
  v_command_id uuid;
begin
  v_initial := public.clair_get_chart_order_draft(
    'workspace-clair-cheongdam',
    '94000000-0000-4000-8000-000000000002'
  );

  v_saved := public.clair_save_chart_order_draft(
    'workspace-clair-cheongdam',
    '49110000-0000-4000-8000-000000000003',
    '94000000-0000-4000-8000-000000000002',
    jsonb_build_object(
      'expectedEtag', v_initial -> 'etag',
      'rows', jsonb_build_array(
        jsonb_build_object(
          'rowType', 'individual',
          'orderId', '94000000-0000-4000-8000-000000000101',
          'workspaceCatalogItemId', 'phase4-lab',
          'quantity', 1,
          'detailInputs', jsonb_build_object(
            'specimenType', 'serum',
            'testPanel', 'CBC',
            'collectionCondition', 'fasted'
          ),
          'detailSchemaVersion', 1,
          'priority', 'urgent'
        ),
        jsonb_build_object(
          'rowType', 'individual',
          'orderId', '94000000-0000-4000-8000-000000000102',
          'workspaceCatalogItemId', 'phase4-consult',
          'quantity', 1,
          'detailInputs', jsonb_build_object(
            'responsibleClinicianId', '49110000-0000-4000-8000-000000000003',
            'occurrenceCount', 1,
            'timing', 'now',
            'instructionSummary', 'Review patient'
          ),
          'detailSchemaVersion', 1,
          'priority', 'normal'
        ),
        jsonb_build_object(
          'rowType', 'individual',
          'orderId', '94000000-0000-4000-8000-000000000103',
          'workspaceCatalogItemId', 'phase4-imaging',
          'quantity', 1,
          'detailInputs', jsonb_build_object(
            'bodyRegion', 'abdomen',
            'position', 'VD',
            'viewCount', 2,
            'contrastRequired', false,
            'sedationRequired', false
          ),
          'detailSchemaVersion', 1,
          'priority', 'normal'
        ),
        jsonb_build_object(
          'rowType', 'set',
          'orderId', '94000000-0000-4000-8000-000000000104',
          'sourceSetId', 'phase4-set',
          'sourceSetRevisionId', '94000000-0000-4000-8000-000000000020',
          'sourceSetRevisionNo', 1,
          'selectionIntent', jsonb_build_object(
            'items', jsonb_build_array(
              jsonb_build_object(
                'revisionItemId', '94000000-0000-4000-8000-000000000021',
                'selected', true,
                'quantity', 1
              ),
              jsonb_build_object(
                'revisionItemId', '94000000-0000-4000-8000-000000000022',
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
              'revisionItemId', '94000000-0000-4000-8000-000000000021',
              'detailInputs', jsonb_build_object(
                'specimenType', 'blood',
                'testPanel', 'CBC',
                'collectionCondition', 'room temperature'
              ),
              'detailSchemaVersion', 1,
              'priority', 'urgent'
            ),
            jsonb_build_object(
              'revisionItemId', '94000000-0000-4000-8000-000000000022',
              'detailInputs', jsonb_build_object(
                'responsibleClinicianId', '49110000-0000-4000-8000-000000000003',
                'occurrenceCount', 1,
                'timing', 'now',
                'instructionSummary', 'Set consultation'
              ),
              'detailSchemaVersion', 1,
              'priority', 'normal'
            )
          )
        ),
        jsonb_build_object(
          'rowType', 'set',
          'orderId', '94000000-0000-4000-8000-000000000105',
          'sourceSetId', 'phase4-fixed-set',
          'sourceSetRevisionId', '94000000-0000-4000-8000-000000000030',
          'sourceSetRevisionNo', 1,
          'selectionIntent', jsonb_build_object(
            'items', jsonb_build_array(
              jsonb_build_object(
                'revisionItemId', '94000000-0000-4000-8000-000000000031',
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
              'revisionItemId', '94000000-0000-4000-8000-000000000031',
              'detailInputs', jsonb_build_object(
                'specimenType', 'blood',
                'testPanel', 'Fixed set lab',
                'collectionCondition', 'room temperature'
              ),
              'detailSchemaVersion', 1,
              'priority', 'normal'
            )
          )
        ),
        jsonb_build_object(
          'rowType', 'set',
          'orderId', '94000000-0000-4000-8000-000000000106',
          'sourceSetId', 'phase4-range-set',
          'sourceSetRevisionId', '94000000-0000-4000-8000-000000000040',
          'sourceSetRevisionNo', 1,
          'selectionIntent', jsonb_build_object(
            'rangeInput', 10,
            'items', jsonb_build_array(
              jsonb_build_object(
                'revisionItemId', '94000000-0000-4000-8000-000000000041',
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
              'revisionItemId', '94000000-0000-4000-8000-000000000041',
              'detailInputs', jsonb_build_object(
                'specimenType', 'blood',
                'testPanel', 'Range set lab',
                'collectionCondition', 'room temperature'
              ),
              'detailSchemaVersion', 1,
              'priority', 'normal'
            )
          )
        )
      )
    )
  );
  if not (v_saved ? 'billingSummary')
    or v_saved -> 'billingSummary' is distinct from
      public.clair_get_chart_order_billing_summary(
        'workspace-clair-cheongdam',
        '94000000-0000-4000-8000-000000000002'
      )
  then
    raise exception 'phase4_draft_mutation_summary_mismatch';
  end if;

  v_confirmed := public.clair_confirm_chart_order_candidates(
    'workspace-clair-cheongdam',
    '49110000-0000-4000-8000-000000000003',
    '94000000-0000-4000-8000-000000000002',
    array[
      '94000000-0000-4000-8000-000000000101'::uuid,
      '94000000-0000-4000-8000-000000000102'::uuid,
      '94000000-0000-4000-8000-000000000104'::uuid,
      '94000000-0000-4000-8000-000000000105'::uuid,
      '94000000-0000-4000-8000-000000000106'::uuid
    ],
    v_saved ->> 'etag',
    '  phase4-confirm-0001  '
  );

  v_command_id := (v_confirmed ->> 'commandId')::uuid;
  if not (v_confirmed ? 'billingSummary')
    or v_confirmed -> 'billingSummary' is distinct from
      public.clair_get_chart_order_billing_summary(
        'workspace-clair-cheongdam',
        '94000000-0000-4000-8000-000000000002'
      )
  then
    raise exception 'phase4_confirmation_mutation_summary_mismatch';
  end if;
  if jsonb_array_length(v_confirmed -> 'tasks') <> 9
    or jsonb_array_length(v_confirmed -> 'queueProjectionIds') <> 4
    or jsonb_array_length(v_confirmed -> 'billingCandidates') <> 6
    or jsonb_array_length(v_confirmed #> '{remainingDraft,rows}') <> 1
    or v_confirmed #>> '{remainingDraft,rows,0,orderId}'
      <> '94000000-0000-4000-8000-000000000103'
  then
    raise exception 'phase4_confirmation_result_shape_mismatch';
  end if;

  perform public.clair_save_chart_order_draft(
    'workspace-clair-cheongdam',
    '49110000-0000-4000-8000-000000000003',
    '94000000-0000-4000-8000-000000000002',
    jsonb_build_object(
      'expectedEtag', v_confirmed #> '{remainingDraft,etag}',
      'rows', jsonb_build_array(
        jsonb_build_object(
          'rowType', 'individual',
          'orderId', '94000000-0000-4000-8000-000000000103',
          'workspaceCatalogItemId', 'phase4-imaging',
          'quantity', 2,
          'detailInputs', jsonb_build_object(
            'bodyRegion', 'abdomen',
            'position', 'VD',
            'viewCount', 2,
            'contrastRequired', false,
            'sedationRequired', false
          ),
          'detailSchemaVersion', 1,
          'priority', 'normal'
        )
      )
    )
  );

  v_replayed := public.clair_confirm_chart_order_candidates(
    'workspace-clair-cheongdam',
    '49110000-0000-4000-8000-000000000003',
    '94000000-0000-4000-8000-000000000002',
    array[
      '94000000-0000-4000-8000-000000000101'::uuid,
      '94000000-0000-4000-8000-000000000102'::uuid,
      '94000000-0000-4000-8000-000000000104'::uuid,
      '94000000-0000-4000-8000-000000000105'::uuid,
      '94000000-0000-4000-8000-000000000106'::uuid
    ],
    v_saved ->> 'etag',
    'phase4-confirm-0001'
  );
  if v_replayed - 'billingSummary' is distinct from
    v_confirmed - 'billingSummary'
  then
    raise exception 'phase4_idempotent_result_not_deterministic';
  end if;
  if not (v_replayed ? 'billingSummary')
    or v_replayed -> 'billingSummary' is not distinct from
      v_confirmed -> 'billingSummary'
    or v_replayed -> 'billingSummary' is distinct from
      public.clair_get_chart_order_billing_summary(
        'workspace-clair-cheongdam',
        '94000000-0000-4000-8000-000000000002'
      )
  then
    raise exception 'phase4_confirmation_replay_summary_not_current';
  end if;

  perform public.clair_save_chart_order_draft(
    'workspace-clair-cheongdam',
    '49110000-0000-4000-8000-000000000003',
    '94000000-0000-4000-8000-000000000002',
    jsonb_build_object(
      'expectedEtag', public.clair_get_chart_order_draft(
        'workspace-clair-cheongdam',
        '94000000-0000-4000-8000-000000000002'
      ) -> 'etag',
      'rows', jsonb_build_array(
        jsonb_build_object(
          'rowType', 'individual',
          'orderId', '94000000-0000-4000-8000-000000000103',
          'workspaceCatalogItemId', 'phase4-imaging',
          'quantity', 1,
          'detailInputs', jsonb_build_object(
            'bodyRegion', 'abdomen',
            'position', 'VD',
            'viewCount', 2,
            'contrastRequired', false,
            'sedationRequired', false
          ),
          'detailSchemaVersion', 1,
          'priority', 'normal'
        )
      )
    )
  );

  begin
    perform public.clair_confirm_chart_order_candidates(
      'workspace-clair-cheongdam',
      '49110000-0000-4000-8000-000000000003',
      '94000000-0000-4000-8000-000000000002',
      array['94000000-0000-4000-8000-000000000103'::uuid],
      v_confirmed ->> 'etag',
      'phase4-confirm-0001'
    );
  exception when others then
    v_conflict_rejected := position('idempotency_conflict' in sqlerrm) > 0;
  end;
  if not v_conflict_rejected then raise exception 'phase4_idempotency_conflict_accepted'; end if;

  raise notice 'phase4_atomic_confirmation_ok command=%', v_command_id;
end;
$test$;

reset role;

do $db_test$
declare
  v_command_id uuid;
  v_summary jsonb;
begin
  select command.id into v_command_id
  from public.order_confirmation_commands command
  where command.workspace_id = 'workspace-clair-cheongdam'
    and command.idempotency_key = 'phase4-confirm-0001';

  if (
    select count(*) from public.orders orders
    where orders.encounter_id = '94000000-0000-4000-8000-000000000002'
      and orders.order_confirmation_status = 'confirmed'
  ) <> 9
  or (
    select count(*) from public.orders orders
    where orders.encounter_id = '94000000-0000-4000-8000-000000000002'
      and orders.order_confirmation_status in ('draft','pending')
  ) <> 1
  or exists (
    select 1 from public.orders orders
    where orders.encounter_id = '94000000-0000-4000-8000-000000000002'
      and orders.order_confirmation_status = 'confirmed'
      and (orders.confirmed_snapshot = '{}'::jsonb or orders.revision_no <> 1)
  )
  then
    raise exception 'phase4_partial_confirmation_or_snapshot_mismatch';
  end if;

  if (
    select count(*) from public.order_tasks task
    where task.encounter_id = '94000000-0000-4000-8000-000000000002'
  ) <> 9
  or (
    select count(*) from public.order_fulfillment_work_items item
    where item.encounter_id = '94000000-0000-4000-8000-000000000002'
  ) <> 4
  or (
    select count(*) from public.order_billing_candidates candidate
    where candidate.encounter_id = '94000000-0000-4000-8000-000000000002'
  ) <> 6
  then
    raise exception 'phase4_task_queue_billing_count_mismatch';
  end if;

  if not exists (
    select 1 from public.order_tasks task
    where task.order_id = '94000000-0000-4000-8000-000000000102'
      and task.task_role = 'execution'
      and task.destination_module is null
      and task.status = 'complete'
  ) or exists (
    select 1 from public.order_fulfillment_work_items item
    where item.order_id = '94000000-0000-4000-8000-000000000102'
  ) or not exists (
    select 1 from public.order_tasks task
    where task.order_id = '94000000-0000-4000-8000-000000000104'
      and task.task_role = 'aggregate'
      and task.status = 'partial_complete'
  ) or exists (
    select 1 from public.order_fulfillment_work_items item
    join public.order_tasks task on task.id = item.task_id
    where task.task_role = 'aggregate'
  )
  then
    raise exception 'phase4_destinationless_or_aggregate_projection_mismatch';
  end if;

  if not exists (
    select 1
    from public.order_billing_candidates candidate
    join public.order_tasks task
      on task.workspace_id = candidate.workspace_id
     and task.id = candidate.task_id
    where candidate.order_id = '94000000-0000-4000-8000-000000000105'
      and candidate.amount = 50000
      and task.task_role = 'aggregate'
  ) or not exists (
    select 1
    from public.order_billing_candidates candidate
    join public.order_tasks task
      on task.workspace_id = candidate.workspace_id
     and task.id = candidate.task_id
    where candidate.order_id = '94000000-0000-4000-8000-000000000106'
      and candidate.amount = 60000
      and task.task_role = 'aggregate'
  ) or exists (
    select 1
    from public.order_billing_candidates candidate
    join public.orders orders
      on orders.workspace_id = candidate.workspace_id
     and orders.id = candidate.order_id
    where orders.parent_chart_order_line_id in (
      '94000000-0000-4000-8000-000000000105',
      '94000000-0000-4000-8000-000000000106'
    )
  ) or exists (
    select 1
    from public.order_billing_candidates candidate
    where candidate.order_id = '94000000-0000-4000-8000-000000000104'
  ) then
    raise exception 'phase4_set_parent_billing_candidate_mismatch';
  end if;

  if v_command_id is null
  or (
    select count(*) from public.order_confirmation_commands command
    where command.encounter_id = '94000000-0000-4000-8000-000000000002'
  ) <> 1
  or (
    select count(*) from public.order_task_events event
    where event.command_id = v_command_id and event.event_type = 'created'
  ) <> 9
  or (
    select count(*) from public.order_execution_outbox outbox
    where outbox.confirmation_command_id = v_command_id
  ) <> 5
  then
    raise exception 'phase4_command_event_outbox_count_mismatch';
  end if;

  v_summary := private.clair_get_chart_order_billing_summary_internal(
    'workspace-clair-cheongdam',
    '94000000-0000-4000-8000-000000000002'
  );
  if (v_summary #>> '{amounts,gross}')::numeric <> 180000
    or (v_summary #>> '{amounts,confirmed}')::numeric <> 160000
    or (v_summary #>> '{amounts,draft}')::numeric <> 20000
    or (v_summary #>> '{amounts,requestableTotal}')::numeric <> 160000
    or jsonb_array_length(v_summary -> 'unfinishedOrders') <> 4
    or not exists (
      select 1
      from jsonb_array_elements(v_summary -> 'unfinishedOrders') item
      where item ->> 'orderId' = '94000000-0000-4000-8000-000000000105'
        and item ->> 'status' = 'pending'
    )
    or not exists (
      select 1
      from jsonb_array_elements(v_summary -> 'unfinishedOrders') item
      where item ->> 'orderId' = '94000000-0000-4000-8000-000000000106'
        and item ->> 'status' = 'pending'
    )
  then
    raise exception 'phase4_set_parent_billing_summary_mismatch:%', v_summary;
  end if;
  raise notice 'phase4_atomic_db_invariants_ok';
end;
$db_test$;

\if :{?pr019_migration_reapply}
set local session_replication_role = replica;

do $historical_setup$
declare
  v_legacy_command_id uuid := private.clair_chart_order_backfill_uuid(
    'chart-order-backfill-command-v1|workspace-clair-cheongdam|94000000-0000-4000-8000-000000000105'
  );
begin
  delete from public.audit_events
  where workspace_id = 'workspace-clair-cheongdam'
    and target_type = 'order_billing_candidate'
    and target_id = 'billcand-94000000-0000-4000-8000-000000000105';

  update public.orders
  set confirmed_snapshot = confirmed_snapshot - 'confirmationCommandId',
      billing_candidate_status = 'not_requested',
      billing_candidate_id = null
  where workspace_id = 'workspace-clair-cheongdam'
    and id = '94000000-0000-4000-8000-000000000105';

  update public.order_tasks
  set effective_snapshot = (effective_snapshot - 'confirmationCommandId') || jsonb_build_object(
    'legacyBackfill', jsonb_build_object(
      'version', 1,
      'classification', 'durable_set_parent',
      'backfilledAt', now()
    )
  )
  where workspace_id = 'workspace-clair-cheongdam'
    and order_id = '94000000-0000-4000-8000-000000000105'
    and task_role = 'aggregate'
    and attempt_no = 1;

  delete from public.order_billing_candidates
  where workspace_id = 'workspace-clair-cheongdam'
    and order_id = '94000000-0000-4000-8000-000000000105';

  insert into public.order_confirmation_commands(
    id, workspace_id, encounter_id, actor_user_id, idempotency_key,
    request_sha256, expected_draft_etag, selected_root_order_ids,
    status, result, created_at, completed_at
  ) values (
    v_legacy_command_id,
    'workspace-clair-cheongdam',
    '94000000-0000-4000-8000-000000000002',
    '49110000-0000-4000-8000-000000000003',
    'legacy-order-backfill-94000000-0000-4000-8000-000000000105',
    repeat('0', 64),
    '"' || repeat('0', 64) || '"',
    array['94000000-0000-4000-8000-000000000105'::uuid],
    'completed',
    jsonb_build_object(
      'version', 1,
      'source', 'legacy-production-backfill',
      'rootOrderId', '94000000-0000-4000-8000-000000000105'::uuid,
      'workspaceId', 'workspace-clair-cheongdam',
      'encounterId', '94000000-0000-4000-8000-000000000002'::uuid
    ),
    now(),
    now()
  );
end;
$historical_setup$;

set local session_replication_role = origin;

-- PR019_MIGRATION_REAPPLY

do $historical_assertion$
declare
  v_legacy_command_id uuid := private.clair_chart_order_backfill_uuid(
    'chart-order-backfill-command-v1|workspace-clair-cheongdam|94000000-0000-4000-8000-000000000105'
  );
  v_conflict_rejected boolean := false;
  v_invoice_conflict_rejected boolean := false;
begin
  if not exists (
    select 1
    from public.order_billing_candidates candidate
    join public.orders orders
      on orders.workspace_id = candidate.workspace_id
     and orders.id = candidate.order_id
    join public.order_tasks task
      on task.workspace_id = candidate.workspace_id
     and task.id = candidate.task_id
     and task.attempt_no = candidate.task_attempt_no
    join public.order_confirmation_commands command
      on command.workspace_id = candidate.workspace_id
     and command.id = candidate.confirmation_command_id
    where candidate.workspace_id = 'workspace-clair-cheongdam'
      and candidate.id = 'billcand-94000000-0000-4000-8000-000000000105'
      and candidate.encounter_id = orders.encounter_id
      and candidate.billing_name_snapshot = orders.applied_snapshot ->> 'billingName'
      and candidate.quantity = orders.quantity
      and candidate.unit_price = orders.unit_price_snapshot
      and candidate.amount = orders.line_total_snapshot
      and candidate.source_snapshot = task.effective_snapshot
      and candidate.created_by_user_id = command.actor_user_id
      and candidate.confirmation_command_id = v_legacy_command_id
      and task.task_role = 'aggregate'
      and task.effective_snapshot ? 'legacyBackfill'
      and orders.billing_candidate_id = candidate.id
      and orders.billing_candidate_status = candidate.status
  ) then
    raise exception 'phase4_historical_set_parent_backfill_mismatch';
  end if;

  if not exists (
    select 1
    from public.audit_events event
    join public.order_confirmation_commands command
      on command.workspace_id = event.workspace_id
     and command.id = v_legacy_command_id
    where event.id = 'billing-candidate-' || v_legacy_command_id::text ||
        '-94000000-0000-4000-8000-000000000105'
      and event.actor_user_id = command.actor_user_id
      and event.encounter_id = command.encounter_id
      and event.request_id = command.id::text
      and event.metadata ->> 'source' = 'chart-order-billing-summary-integrity-v1'
  ) or not exists (
    select 1
    from public.order_confirmation_commands command
    cross join lateral jsonb_array_elements(command.result -> 'billingCandidates') item
    where command.id = v_legacy_command_id
      and item ->> 'billingCandidateId' =
        'billcand-94000000-0000-4000-8000-000000000105'
      and item ->> 'orderId' = '94000000-0000-4000-8000-000000000105'
      and (item ->> 'amount')::numeric = 50000
  ) then
    raise exception 'phase4_historical_result_or_audit_repair_mismatch';
  end if;

  begin
    update public.order_billing_candidates
    set created_by_user_id = '49110000-0000-4000-8000-000000000004',
        billing_name_snapshot = 'corrupt conflict row'
    where workspace_id = 'workspace-clair-cheongdam'
      and order_id = '94000000-0000-4000-8000-000000000105';

    perform private.clair_assert_set_parent_billing_candidate_integrity(
      'workspace-clair-cheongdam',
      '94000000-0000-4000-8000-000000000105',
      true
    );
  exception when others then
    v_conflict_rejected := position(
      'set_parent_billing_candidate_integrity_mismatch' in sqlerrm
    ) > 0;
  end;

  if not v_conflict_rejected then
    raise exception 'phase4_set_parent_conflict_not_rejected';
  end if;

  insert into public.invoices(
    id, workspace_id, encounter_id, invoice_no, status, payment_state,
    subtotal_amount, discount_amount, tax_amount, total_amount
  ) values (
    '94000000-0000-4000-8000-000000000070',
    'workspace-clair-cheongdam',
    '94000000-0000-4000-8000-000000000002',
    'PHASE4-HISTORICAL-LINK-001', 'draft', 'none',
    50000, 0, 0, 50000
  );

  insert into public.invoice_lines(
    id, workspace_id, invoice_id, order_id, description,
    quantity, unit_price, discount_amount, billing_candidate_id,
    billing_name_snapshot, source_order_snapshot, tax_type
  )
  select
    '94000000-0000-4000-8000-000000000071',
    candidate.workspace_id,
    '94000000-0000-4000-8000-000000000070',
    candidate.order_id,
    candidate.billing_name_snapshot,
    candidate.quantity,
    candidate.unit_price,
    0,
    candidate.id,
    candidate.billing_name_snapshot,
    candidate.source_snapshot,
    'taxable'
  from public.order_billing_candidates candidate
  where candidate.workspace_id = 'workspace-clair-cheongdam'
    and candidate.order_id = '94000000-0000-4000-8000-000000000105';

  update public.orders
  set invoice_line_id = '94000000-0000-4000-8000-000000000071',
      billing_candidate_status = 'invoice_linked',
      order_confirmation_status = 'billed'
  where workspace_id = 'workspace-clair-cheongdam'
    and id = '94000000-0000-4000-8000-000000000105';

  update public.order_billing_candidates
  set invoice_line_id = '94000000-0000-4000-8000-000000000071',
      status = 'invoice_linked'
  where workspace_id = 'workspace-clair-cheongdam'
    and order_id = '94000000-0000-4000-8000-000000000105';

  perform private.clair_assert_set_parent_billing_candidate_integrity(
    'workspace-clair-cheongdam',
    '94000000-0000-4000-8000-000000000105',
    true
  );

  begin
    update public.invoice_lines
    set billing_candidate_id = 'corrupt-billing-authority'
    where id = '94000000-0000-4000-8000-000000000071';

    perform private.clair_assert_set_parent_billing_candidate_integrity(
      'workspace-clair-cheongdam',
      '94000000-0000-4000-8000-000000000105',
      true
    );
  exception when others then
    v_invoice_conflict_rejected := position(
      'set_parent_billing_candidate_integrity_mismatch' in sqlerrm
    ) > 0;
  end;

  if not v_invoice_conflict_rejected then
    raise exception 'phase4_invoice_authority_conflict_not_rejected';
  end if;

  update public.orders
  set invoice_line_id = null,
      billing_candidate_status = 'candidate_created',
      order_confirmation_status = 'confirmed'
  where workspace_id = 'workspace-clair-cheongdam'
    and id = '94000000-0000-4000-8000-000000000105';

  update public.order_billing_candidates
  set invoice_line_id = null,
      status = 'candidate_created'
  where workspace_id = 'workspace-clair-cheongdam'
    and order_id = '94000000-0000-4000-8000-000000000105';

  delete from public.invoice_lines
  where id = '94000000-0000-4000-8000-000000000071';
  delete from public.invoices
  where id = '94000000-0000-4000-8000-000000000070';

  raise notice 'phase4_historical_set_parent_backfill_ok';
  raise notice 'phase4_set_parent_conflict_fail_closed_ok';
  raise notice 'phase4_invoice_authority_conflict_fail_closed_ok';
end;
$historical_assertion$;
\endif

create temp table phase4_billing_summary_before_void as
select private.clair_get_chart_order_billing_summary_internal(
  'workspace-clair-cheongdam',
  '94000000-0000-4000-8000-000000000002'
) summary;

insert into public.invoices(
  id, workspace_id, encounter_id, invoice_no, status, payment_state,
  subtotal_amount, discount_amount, tax_amount, total_amount,
  voided_at, voided_reason
) values (
  '94000000-0000-4000-8000-000000000060',
  'workspace-clair-cheongdam',
  '94000000-0000-4000-8000-000000000002',
  'PHASE4-VOIDED-001', 'voided', 'none',
  999, 0, 0, 999, now(), 'synthetic integrity contract'
);

insert into public.payments(
  id, workspace_id, invoice_id, payment_method, amount, status
) values (
  '94000000-0000-4000-8000-000000000061',
  'workspace-clair-cheongdam',
  '94000000-0000-4000-8000-000000000060',
  'card', 777, 'approved'
);

insert into public.invoice_adjustments(
  id, workspace_id, invoice_id, adjustment_type, amount, reason,
  created_by_user_id
) values (
  '94000000-0000-4000-8000-000000000062',
  'workspace-clair-cheongdam',
  '94000000-0000-4000-8000-000000000060',
  'surcharge', 333, 'synthetic integrity contract',
  '49110000-0000-4000-8000-000000000003'
);

do $voided_invoice_test$
declare
  v_before jsonb;
  v_after jsonb;
begin
  select summary into v_before from phase4_billing_summary_before_void;
  v_after := private.clair_get_chart_order_billing_summary_internal(
    'workspace-clair-cheongdam',
    '94000000-0000-4000-8000-000000000002'
  );
  if (v_after #>> '{amounts,paid}')::numeric <> 0
    or (v_after #>> '{amounts,surcharge}')::numeric <> 0
    or v_after -> 'invoiceId' <> 'null'::jsonb
    or v_after ->> 'etag' is distinct from v_before ->> 'etag'
  then
    raise exception 'phase4_voided_invoice_money_leaked_into_summary:%', v_after;
  end if;
  raise notice 'phase4_voided_invoice_money_excluded_ok';
end;
$voided_invoice_test$;

create or replace function pg_temp.phase4_fail_billing_candidate()
returns trigger
language plpgsql
as $failure$
begin
  raise exception 'synthetic_mid_commit_failure';
end;
$failure$;

create trigger phase4_fail_billing_candidate_trg
before insert on public.order_billing_candidates
for each row execute function pg_temp.phase4_fail_billing_candidate();

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '49110000-0000-4000-8000-000000000003',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

do $rollback_test$
declare
  v_draft jsonb;
  v_failed boolean := false;
begin
  v_draft := public.clair_get_chart_order_draft(
    'workspace-clair-cheongdam',
    '94000000-0000-4000-8000-000000000002'
  );
  begin
    perform public.clair_confirm_chart_order_candidates(
      'workspace-clair-cheongdam',
      '49110000-0000-4000-8000-000000000003',
      '94000000-0000-4000-8000-000000000002',
      array['94000000-0000-4000-8000-000000000103'::uuid],
      v_draft ->> 'etag',
      'phase4-confirm-failure-0002'
    );
  exception when others then
    v_failed := position('synthetic_mid_commit_failure' in sqlerrm) > 0;
  end;
  if not v_failed then raise exception 'phase4_failure_injection_did_not_fire'; end if;

  raise notice 'phase4_mid_commit_rollback_ok';
end;
$rollback_test$;

reset role;

do $rollback_db_test$
begin
  if not exists (
    select 1 from public.orders orders
    where orders.id = '94000000-0000-4000-8000-000000000103'
      and orders.order_confirmation_status in ('draft','pending')
      and orders.confirmed_snapshot = '{}'::jsonb
  ) or exists (
    select 1 from public.order_confirmation_commands command
    where command.idempotency_key = 'phase4-confirm-failure-0002'
  ) or exists (
    select 1 from public.order_tasks task
    where task.order_id = '94000000-0000-4000-8000-000000000103'
  ) or exists (
    select 1 from public.order_fulfillment_work_items item
    where item.order_id = '94000000-0000-4000-8000-000000000103'
  ) or exists (
    select 1 from public.order_billing_candidates candidate
    where candidate.order_id = '94000000-0000-4000-8000-000000000103'
  ) then
    raise exception 'phase4_mid_commit_failure_left_partial_artifact';
  end if;
  raise notice 'phase4_mid_commit_db_rollback_ok';
end;
$rollback_db_test$;

drop trigger phase4_fail_billing_candidate_trg on public.order_billing_candidates;

rollback;
