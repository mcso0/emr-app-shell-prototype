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
  amount_basis, billing_reflection_enabled, created_by_user_id, updated_by_user_id
) values (
  'phase4-set',
  'workspace-clair-cheongdam',
  'phase4-set-v1',
  '혼합',
  'Phase4 Mixed Set',
  'Phase4 Mixed Set',
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
  '94000000-0000-4000-8000-000000000020',
  'workspace-clair-cheongdam',
  'phase4-set',
  1,
  'valid',
  '[]'::jsonb,
  '혼합',
  'Phase4 Mixed Set',
  'Phase4 Mixed Set',
  'included_order_sum',
  null,
  'per_each',
  false,
  'derived',
  array['dog','cat','other'],
  '49110000-0000-4000-8000-000000000003'
);

update public.order_sets
set current_revision_id = '94000000-0000-4000-8000-000000000020'
where workspace_id = 'workspace-clair-cheongdam' and id = 'phase4-set';

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
        )
      )
    )
  );

  v_confirmed := public.clair_confirm_chart_order_candidates(
    'workspace-clair-cheongdam',
    '49110000-0000-4000-8000-000000000003',
    '94000000-0000-4000-8000-000000000002',
    array[
      '94000000-0000-4000-8000-000000000101'::uuid,
      '94000000-0000-4000-8000-000000000102'::uuid,
      '94000000-0000-4000-8000-000000000104'::uuid
    ],
    v_saved ->> 'etag',
    '  phase4-confirm-0001  '
  );

  v_command_id := (v_confirmed ->> 'commandId')::uuid;
  if jsonb_array_length(v_confirmed -> 'tasks') <> 5
    or jsonb_array_length(v_confirmed -> 'queueProjectionIds') <> 2
    or jsonb_array_length(v_confirmed -> 'billingCandidates') <> 4
    or jsonb_array_length(v_confirmed #> '{remainingDraft,rows}') <> 1
    or v_confirmed #>> '{remainingDraft,rows,0,orderId}'
      <> '94000000-0000-4000-8000-000000000103'
  then
    raise exception 'phase4_confirmation_result_shape_mismatch';
  end if;

  v_replayed := public.clair_confirm_chart_order_candidates(
    'workspace-clair-cheongdam',
    '49110000-0000-4000-8000-000000000003',
    '94000000-0000-4000-8000-000000000002',
    array[
      '94000000-0000-4000-8000-000000000101'::uuid,
      '94000000-0000-4000-8000-000000000102'::uuid,
      '94000000-0000-4000-8000-000000000104'::uuid
    ],
    v_saved ->> 'etag',
    'phase4-confirm-0001'
  );
  if v_replayed is distinct from v_confirmed then
    raise exception 'phase4_idempotent_result_not_deterministic';
  end if;

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
begin
  select command.id into v_command_id
  from public.order_confirmation_commands command
  where command.workspace_id = 'workspace-clair-cheongdam'
    and command.idempotency_key = 'phase4-confirm-0001';

  if (
    select count(*) from public.orders orders
    where orders.encounter_id = '94000000-0000-4000-8000-000000000002'
      and orders.order_confirmation_status = 'confirmed'
  ) <> 5
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
  ) <> 5
  or (
    select count(*) from public.order_fulfillment_work_items item
    where item.encounter_id = '94000000-0000-4000-8000-000000000002'
  ) <> 2
  or (
    select count(*) from public.order_billing_candidates candidate
    where candidate.encounter_id = '94000000-0000-4000-8000-000000000002'
  ) <> 4
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

  if v_command_id is null
  or (
    select count(*) from public.order_confirmation_commands command
    where command.encounter_id = '94000000-0000-4000-8000-000000000002'
  ) <> 1
  or (
    select count(*) from public.order_task_events event
    where event.command_id = v_command_id and event.event_type = 'created'
  ) <> 5
  or (
    select count(*) from public.order_execution_outbox outbox
    where outbox.confirmation_command_id = v_command_id
  ) <> 3
  then
    raise exception 'phase4_command_event_outbox_count_mismatch';
  end if;
  raise notice 'phase4_atomic_db_invariants_ok';
end;
$db_test$;

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
