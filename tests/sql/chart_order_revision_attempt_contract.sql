\set ON_ERROR_STOP on

begin;

insert into public.workspaces (id, display_name)
values ('workspace-phase5-other', 'Phase5 격리 워크스페이스');

insert into public.patients (
  id, workspace_id, patient_no, name, species
) values (
  '95000000-0000-4000-8000-000000000001',
  'workspace-clair-cheongdam',
  'PHASE5-REVISION-001',
  'Phase5 합성 환자',
  'dog'
);

insert into public.encounters (
  id, workspace_id, patient_id, primary_veterinarian_id,
  encounter_no, reception_type, status
) values (
  '95000000-0000-4000-8000-000000000002',
  'workspace-clair-cheongdam',
  '95000000-0000-4000-8000-000000000001',
  '49110000-0000-4000-8000-000000000003',
  'PHASE5-REVISION-ENC-001',
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
    'phase5-lab', 'workspace-clair-cheongdam', 'phase5-lab', 'phase5-v1',
    'lab', '임상', 'Phase5 Lab', 'Phase5 Lab', 'Phase5 Lab', 'active', 15000,
    'lab', true, true, 'workspace_custom'
  ),
  (
    'phase5-consult', 'workspace-clair-cheongdam', 'phase5-consult', 'phase5-v1',
    'consultation', '진료', 'Phase5 Consult', 'Phase5 Consult', 'Phase5 Consult',
    'active', 10000, 'chart_only', false, true, 'workspace_custom'
  ),
  (
    'phase5-imaging', 'workspace-clair-cheongdam', 'phase5-imaging', 'phase5-v1',
    'imaging', '영상', 'Phase5 Imaging', 'Phase5 Imaging', 'Phase5 Imaging',
    'active', 20000, 'imaging', true, true, 'workspace_custom'
  );

insert into public.order_sets (
  id, workspace_id, source_set_version, set_category, set_name, billing_name,
  amount_basis, billing_reflection_enabled, created_by_user_id, updated_by_user_id
) values (
  'phase5-set',
  'workspace-clair-cheongdam',
  'phase5-set-v1',
  '혼합',
  'Phase5 Mixed Set',
  'Phase5 Mixed Set',
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
  '95000000-0000-4000-8000-000000000020',
  'workspace-clair-cheongdam',
  'phase5-set',
  1,
  'valid',
  '[]'::jsonb,
  '혼합',
  'Phase5 Mixed Set',
  'Phase5 Mixed Set',
  'included_order_sum',
  null,
  'per_each',
  false,
  'derived',
  array['dog','cat','other'],
  '49110000-0000-4000-8000-000000000003'
);

update public.order_sets
set current_revision_id = '95000000-0000-4000-8000-000000000020'
where workspace_id = 'workspace-clair-cheongdam' and id = 'phase5-set';

insert into public.order_set_revision_items (
  id, workspace_id, order_set_id, revision_id,
  child_kind, child_order_catalog_item_id, child_order_catalog_revision,
  sort_order, default_selected, billing_reflection_default,
  default_quantity, quantity_source
) values
  (
    '95000000-0000-4000-8000-000000000021',
    'workspace-clair-cheongdam', 'phase5-set',
    '95000000-0000-4000-8000-000000000020',
    'atomic', 'phase5-lab', 1, 10, true, true, 1, 'fixed_one'
  ),
  (
    '95000000-0000-4000-8000-000000000022',
    'workspace-clair-cheongdam', 'phase5-set',
    '95000000-0000-4000-8000-000000000020',
    'atomic', 'phase5-consult', 1, 20, true, true, 1, 'fixed_one'
  );

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '49110000-0000-4000-8000-000000000003',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

do $confirm_and_correct$
declare
  v_initial jsonb;
  v_saved jsonb;
  v_confirmed jsonb;
  v_result jsonb;
  v_replay jsonb;
  v_rejected boolean;
begin
  v_initial := public.clair_get_chart_order_draft(
    'workspace-clair-cheongdam',
    '95000000-0000-4000-8000-000000000002'
  );
  v_saved := public.clair_save_chart_order_draft(
    'workspace-clair-cheongdam',
    '49110000-0000-4000-8000-000000000003',
    '95000000-0000-4000-8000-000000000002',
    jsonb_build_object(
      'expectedEtag', v_initial -> 'etag',
      'rows', jsonb_build_array(
        jsonb_build_object(
          'rowType', 'individual',
          'orderId', '95000000-0000-4000-8000-000000000101',
          'workspaceCatalogItemId', 'phase5-lab',
          'quantity', 1,
          'detailInputs', jsonb_build_object(
            'specimenType', 'serum',
            'testPanel', 'CBC',
            'collectionCondition', 'fasted'
          ),
          'detailSchemaVersion', 1,
          'priority', 'normal'
        ),
        jsonb_build_object(
          'rowType', 'individual',
          'orderId', '95000000-0000-4000-8000-000000000102',
          'workspaceCatalogItemId', 'phase5-consult',
          'quantity', 1,
          'detailInputs', jsonb_build_object(
            'responsibleClinicianId', '49110000-0000-4000-8000-000000000003',
            'occurrenceCount', 1,
            'timing', 'now',
            'instructionSummary', 'Initial consultation'
          ),
          'detailSchemaVersion', 1,
          'priority', 'normal'
        ),
        jsonb_build_object(
          'rowType', 'set',
          'orderId', '95000000-0000-4000-8000-000000000103',
          'sourceSetId', 'phase5-set',
          'sourceSetRevisionId', '95000000-0000-4000-8000-000000000020',
          'sourceSetRevisionNo', 1,
          'selectionIntent', jsonb_build_object(
            'items', jsonb_build_array(
              jsonb_build_object(
                'revisionItemId', '95000000-0000-4000-8000-000000000021',
                'selected', true,
                'quantity', 1
              ),
              jsonb_build_object(
                'revisionItemId', '95000000-0000-4000-8000-000000000022',
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
              'revisionItemId', '95000000-0000-4000-8000-000000000021',
              'detailInputs', jsonb_build_object(
                'specimenType', 'blood',
                'testPanel', 'CBC',
                'collectionCondition', 'room temperature'
              ),
              'detailSchemaVersion', 1,
              'priority', 'normal'
            ),
            jsonb_build_object(
              'revisionItemId', '95000000-0000-4000-8000-000000000022',
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
          'rowType', 'individual',
          'orderId', '95000000-0000-4000-8000-000000000104',
          'workspaceCatalogItemId', 'phase5-imaging',
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
  if not (v_saved ? 'billingSummary')
    or v_saved -> 'billingSummary' is distinct from
      public.clair_get_chart_order_billing_summary(
        'workspace-clair-cheongdam',
        '95000000-0000-4000-8000-000000000002'
      )
  then
    raise exception 'phase5_draft_mutation_summary_mismatch';
  end if;

  v_confirmed := public.clair_confirm_chart_order_candidates(
    'workspace-clair-cheongdam',
    '49110000-0000-4000-8000-000000000003',
    '95000000-0000-4000-8000-000000000002',
    array[
      '95000000-0000-4000-8000-000000000101'::uuid,
      '95000000-0000-4000-8000-000000000102'::uuid,
      '95000000-0000-4000-8000-000000000103'::uuid,
      '95000000-0000-4000-8000-000000000104'::uuid
    ],
    v_saved ->> 'etag',
    'phase5-confirm-0001'
  );
  if jsonb_array_length(v_confirmed -> 'tasks') <> 6
    or jsonb_array_length(v_confirmed -> 'queueProjectionIds') <> 3
    or jsonb_array_length(v_confirmed -> 'billingCandidates') <> 5
  then
    raise exception 'phase5_confirmation_shape_mismatch';
  end if;

  v_result := public.clair_mutate_chart_order_execution(
    'workspace-clair-cheongdam',
    '49110000-0000-4000-8000-000000000003',
    '95000000-0000-4000-8000-000000000101',
    'amend',
    '검체 채취 조건과 패널을 수정합니다',
    1,
    jsonb_build_object(
      'detailInputs', jsonb_build_object(
        'specimenType', 'plasma',
        'testPanel', 'CBC + chemistry',
        'collectionCondition', 'non-fasted'
      ),
      'detailSchemaVersion', 1
    ),
    'phase5-amend-0001'
  );
  if not (v_result ? 'billingSummary')
    or v_result -> 'billingSummary' is distinct from
      public.clair_get_chart_order_billing_summary(
        'workspace-clair-cheongdam',
        '95000000-0000-4000-8000-000000000002'
      )
  then
    raise exception 'phase5_execution_mutation_summary_mismatch';
  end if;
  if (v_result ->> 'revisionNo')::integer <> 2 then
    raise exception 'phase5_amend_revision_mismatch';
  end if;

  perform public.clair_mutate_chart_order_execution(
    'workspace-clair-cheongdam',
    '49110000-0000-4000-8000-000000000003',
    '95000000-0000-4000-8000-000000000101',
    'priority_change',
    '응급 검사 우선순위를 적용합니다',
    2,
    '{"priority":"urgent"}'::jsonb,
    'phase5-priority-0001'
  );

  v_result := public.clair_mutate_chart_order_execution(
    'workspace-clair-cheongdam',
    '49110000-0000-4000-8000-000000000003',
    '95000000-0000-4000-8000-000000000101',
    'billing_correct',
    '수납 후보 수량과 단가를 정정합니다',
    3,
    '{"billingName":"Phase5 Lab corrected","quantity":2,"unitPrice":9000}'::jsonb,
    'phase5-billing-0001'
  );
  -- Change the current Summary without touching the idempotent mutation's
  -- stored result, then verify replay returns the newly computed Summary.
  perform public.clair_save_chart_order_draft(
    'workspace-clair-cheongdam',
    '49110000-0000-4000-8000-000000000003',
    '95000000-0000-4000-8000-000000000002',
    jsonb_build_object(
      'expectedEtag', public.clair_get_chart_order_draft(
        'workspace-clair-cheongdam',
        '95000000-0000-4000-8000-000000000002'
      ) -> 'etag',
      'rows', jsonb_build_array(
        jsonb_build_object(
          'rowType', 'individual',
          'orderId', '95000000-0000-4000-8000-000000000105',
          'workspaceCatalogItemId', 'phase5-imaging',
          'quantity', 1,
          'detailInputs', jsonb_build_object(
            'bodyRegion', 'thorax',
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
  v_replay := public.clair_mutate_chart_order_execution(
    'workspace-clair-cheongdam',
    '49110000-0000-4000-8000-000000000003',
    '95000000-0000-4000-8000-000000000101',
    'billing_correct',
    '수납 후보 수량과 단가를 정정합니다',
    3,
    '{"billingName":"Phase5 Lab corrected","quantity":2,"unitPrice":9000}'::jsonb,
    ' phase5-billing-0001 '
  );
  if v_replay - 'billingSummary' is distinct from
    v_result - 'billingSummary'
  then
    raise exception 'phase5_mutation_replay_not_deterministic';
  end if;
  if not (v_replay ? 'billingSummary')
    or v_replay -> 'billingSummary' is not distinct from
      v_result -> 'billingSummary'
    or v_replay -> 'billingSummary' is distinct from
      public.clair_get_chart_order_billing_summary(
        'workspace-clair-cheongdam',
        '95000000-0000-4000-8000-000000000002'
      )
  then
    raise exception 'phase5_execution_replay_summary_not_current';
  end if;

  perform public.clair_save_chart_order_draft(
    'workspace-clair-cheongdam',
    '49110000-0000-4000-8000-000000000003',
    '95000000-0000-4000-8000-000000000002',
    jsonb_build_object(
      'expectedEtag', public.clair_get_chart_order_draft(
        'workspace-clair-cheongdam',
        '95000000-0000-4000-8000-000000000002'
      ) -> 'etag',
      'rows', '[]'::jsonb,
      'removedOrderIds', jsonb_build_array(
        '95000000-0000-4000-8000-000000000105'
      )
    )
  );

  v_rejected := false;
  begin
    perform public.clair_mutate_chart_order_execution(
      'workspace-clair-cheongdam',
      '49110000-0000-4000-8000-000000000003',
      '95000000-0000-4000-8000-000000000101',
      'billing_correct',
      '수납 후보 수량과 단가를 정정합니다',
      3,
      '{"billingName":"Conflict","quantity":1,"unitPrice":1}'::jsonb,
      'phase5-billing-0001'
    );
  exception when others then
    v_rejected := position('idempotency_conflict' in sqlerrm) > 0;
  end;
  if not v_rejected then raise exception 'phase5_idempotency_conflict_accepted'; end if;

  if (
    select count(*) from public.order_revisions revision
    where revision.workspace_id = 'workspace-clair-cheongdam'
      and revision.idempotency_key in (
        'phase5-amend-0001',
        'phase5-priority-0001',
        'phase5-billing-0001'
      )
  ) <> 3 then
    raise exception 'phase5_revision_rls_read_mismatch';
  end if;
  v_rejected := false;
  begin
    update public.order_revisions
    set reason = '직접 변경은 허용되지 않습니다'
    where idempotency_key = 'phase5-amend-0001';
  exception when insufficient_privilege then
    v_rejected := true;
  end;
  if not v_rejected then raise exception 'phase5_direct_revision_write_accepted'; end if;

  v_rejected := false;
  begin
    perform public.clair_mutate_chart_order_execution(
      'workspace-phase5-other',
      '49110000-0000-4000-8000-000000000003',
      '95000000-0000-4000-8000-000000000101',
      'cancel',
      '다른 워크스페이스 변경을 차단합니다',
      4,
      '{}'::jsonb,
      'phase5-cross-workspace-0001'
    );
  exception when others then
    v_rejected := sqlstate = '42501';
  end;
  if not v_rejected then raise exception 'phase5_cross_workspace_mutation_accepted'; end if;

  raise notice 'phase5_confirm_amend_priority_billing_ok';
end;
$confirm_and_correct$;

reset role;

do $pre_re_request_invariants$
declare
  v_result_guard boolean := false;
  v_snapshot_guard boolean := false;
  v_child_rejected boolean := false;
  v_child_id uuid;
begin
  select child.id into v_child_id
  from public.orders child
  where child.parent_chart_order_line_id = '95000000-0000-4000-8000-000000000103'
  order by child.id
  limit 1;
  begin
    perform public.clair_mutate_chart_order_execution(
      'workspace-clair-cheongdam',
      '49110000-0000-4000-8000-000000000003',
      v_child_id,
      'cancel',
      '세트 child 독립 취소를 차단합니다',
      1,
      '{}'::jsonb,
      'phase5-child-cancel-0001'
    );
  exception when others then
    v_child_rejected := position(
      'set_child_independent_mutation_forbidden' in sqlerrm
    ) > 0;
  end;
  if not v_child_rejected then
    raise exception 'phase5_set_child_mutation_accepted';
  end if;

  if (
    select revision_no from public.orders
    where id = '95000000-0000-4000-8000-000000000101'
  ) <> 4
  or (
    select count(*) from public.order_tasks
    where order_id = '95000000-0000-4000-8000-000000000101'
  ) <> 1
  or not exists (
    select 1 from public.order_tasks
    where order_id = '95000000-0000-4000-8000-000000000101'
      and attempt_no = 1 and priority = 'urgent' and status = 'pending'
  )
  or not exists (
    select 1 from public.order_fulfillment_work_items
    where order_id = '95000000-0000-4000-8000-000000000101'
      and priority = 'urgent'
  )
  or not exists (
    select 1 from public.order_billing_candidates
    where order_id = '95000000-0000-4000-8000-000000000101'
      and billing_name_snapshot = 'Phase5 Lab corrected'
      and quantity = 2 and unit_price = 9000 and amount = 18000
  )
  then
    raise exception 'phase5_pre_re_request_state_mismatch';
  end if;

  if not exists (
    select 1 from public.order_revision_fields field
    join public.order_revisions revision on revision.id = field.order_revision_id
    where revision.idempotency_key = 'phase5-billing-0001'
      and field.field_name = 'billingCandidate'
      and field.previous_value ->> 'billingName' = 'Phase5 Lab'
      and field.current_value ->> 'billingName' = 'Phase5 Lab corrected'
  ) then
    raise exception 'phase5_billing_before_after_mismatch';
  end if;

  update public.order_tasks
  set
    status = 'complete',
    result_snapshot = '{"result":"immutable phase5 result"}'::jsonb,
    completed_at = now(),
    updated_at = now()
  where order_id = '95000000-0000-4000-8000-000000000101'
    and attempt_no = 1;
  update public.order_fulfillment_work_items
  set status = 'completed', completed_at = now(), updated_at = now()
  where order_id = '95000000-0000-4000-8000-000000000101';

  begin
    update public.order_tasks
    set result_snapshot = '{"result":"overwritten"}'::jsonb
    where order_id = '95000000-0000-4000-8000-000000000101'
      and attempt_no = 1;
  exception when others then
    v_result_guard := position('completed_result_immutable' in sqlerrm) > 0;
  end;
  if not v_result_guard then raise exception 'phase5_completed_result_overwrite_accepted'; end if;

  begin
    update public.orders
    set confirmed_snapshot = confirmed_snapshot || '{"overwritten":true}'::jsonb
    where id = '95000000-0000-4000-8000-000000000101';
  exception when others then
    v_snapshot_guard := position('confirmed_snapshot_immutable' in sqlerrm) > 0;
  end;
  if not v_snapshot_guard then raise exception 'phase5_confirmed_snapshot_overwrite_accepted'; end if;

  raise notice 'phase5_amendment_billing_and_immutability_ok';
end;
$pre_re_request_invariants$;

set local role authenticated;

do $re_request_cases$
begin
  perform public.clair_mutate_chart_order_execution(
    'workspace-clair-cheongdam',
    '49110000-0000-4000-8000-000000000003',
    '95000000-0000-4000-8000-000000000101',
    're_request',
    '완료 결과를 보존하고 재검사를 요청합니다',
    4,
    jsonb_build_object(
      'detailInputs', jsonb_build_object(
        'specimenType', 'serum',
        'testPanel', 'recheck CBC',
        'collectionCondition', 'fasted'
      ),
      'detailSchemaVersion', 1,
      'priority', 'normal'
    ),
    'phase5-rerequest-lab-0001'
  );
  perform public.clair_mutate_chart_order_execution(
    'workspace-clair-cheongdam',
    '49110000-0000-4000-8000-000000000003',
    '95000000-0000-4000-8000-000000000102',
    're_request',
    '차트 소유 진료 작업을 다시 요청합니다',
    1,
    '{}'::jsonb,
    'phase5-rerequest-consult-0001'
  );
  perform public.clair_mutate_chart_order_execution(
    'workspace-clair-cheongdam',
    '49110000-0000-4000-8000-000000000003',
    '95000000-0000-4000-8000-000000000103',
    're_request',
    '세트 전체 실행을 새 attempt로 요청합니다',
    1,
    '{}'::jsonb,
    'phase5-rerequest-set-0001'
  );
  raise notice 'phase5_linked_re_request_calls_ok';
end;
$re_request_cases$;

reset role;

do $re_request_invariants$
begin
  if (
    select count(*) from public.order_tasks
    where order_id = '95000000-0000-4000-8000-000000000101'
  ) <> 2
  or not exists (
    select 1 from public.order_tasks old_task
    where old_task.order_id = '95000000-0000-4000-8000-000000000101'
      and old_task.attempt_no = 1
      and old_task.status = 'complete'
      and old_task.result_snapshot = '{"result":"immutable phase5 result"}'::jsonb
  )
  or not exists (
    select 1 from public.order_tasks new_task
    join public.order_tasks old_task
      on old_task.id = new_task.re_requested_from_task_id
    where new_task.order_id = '95000000-0000-4000-8000-000000000101'
      and new_task.attempt_no = 2 and new_task.status = 'pending'
      and old_task.attempt_no = 1 and old_task.status = 'complete'
  )
  then
    raise exception 'phase5_completed_re_request_link_mismatch';
  end if;

  if not exists (
    select 1 from public.order_tasks
    where order_id = '95000000-0000-4000-8000-000000000102'
      and attempt_no = 2 and destination_module is null and status = 'pending'
  )
  or exists (
    select 1 from public.order_fulfillment_work_items
    where order_id = '95000000-0000-4000-8000-000000000102'
  )
  then
    raise exception 'phase5_destinationless_re_request_projection_mismatch';
  end if;

  if (
    select count(*) from public.order_tasks task
    join public.orders child on child.id = task.order_id
    where child.parent_chart_order_line_id = '95000000-0000-4000-8000-000000000103'
      and task.attempt_no = 2 and task.status = 'pending'
  ) <> 2
  or not exists (
    select 1 from public.order_tasks
    where order_id = '95000000-0000-4000-8000-000000000103'
      and task_role = 'aggregate' and attempt_no = 2 and status = 'pending'
  )
  or exists (
    select 1 from public.order_fulfillment_work_items item
    join public.order_tasks task on task.id = item.task_id
    where task.task_role = 'aggregate'
  )
  then
    raise exception 'phase5_set_re_request_projection_mismatch';
  end if;

  if (
    select count(*) from public.order_execution_outbox
    where event_type = 'order.execution_changed'
      and order_revision_id is not null
      and confirmation_command_id is null
  ) <> 6
  then
    raise exception 'phase5_revision_outbox_before_cancel_mismatch';
  end if;
  raise notice 'phase5_linked_attempt_invariants_ok';
end;
$re_request_invariants$;

create or replace function pg_temp.phase5_fail_cancel_event()
returns trigger
language plpgsql
as $failure$
begin
  if new.event_type = 'cancelled' then
    raise exception 'synthetic_phase5_cancel_failure';
  end if;
  return new;
end;
$failure$;

create trigger phase5_fail_cancel_event_trg
before insert on public.order_task_events
for each row execute function pg_temp.phase5_fail_cancel_event();

set local role authenticated;

do $cancel_rollback$
declare
  v_failed boolean := false;
begin
  begin
    perform public.clair_mutate_chart_order_execution(
      'workspace-clair-cheongdam',
      '49110000-0000-4000-8000-000000000003',
      '95000000-0000-4000-8000-000000000104',
      'cancel',
      '영상 오더를 사유와 함께 취소합니다',
      1,
      '{}'::jsonb,
      'phase5-cancel-failure-0001'
    );
  exception when others then
    v_failed := position('synthetic_phase5_cancel_failure' in sqlerrm) > 0;
  end;
  if not v_failed then raise exception 'phase5_cancel_failure_injection_missed'; end if;
end;
$cancel_rollback$;

reset role;

do $cancel_rollback_invariants$
begin
  if not exists (
    select 1 from public.orders
    where id = '95000000-0000-4000-8000-000000000104'
      and revision_no = 1 and status <> 'cancelled'
  )
  or exists (
    select 1 from public.order_revisions
    where idempotency_key = 'phase5-cancel-failure-0001'
  )
  or not exists (
    select 1 from public.order_tasks
    where order_id = '95000000-0000-4000-8000-000000000104'
      and status = 'pending'
  )
  then
    raise exception 'phase5_cancel_failure_left_partial_artifact';
  end if;
  raise notice 'phase5_cancel_atomic_rollback_ok';
end;
$cancel_rollback_invariants$;

drop trigger phase5_fail_cancel_event_trg on public.order_task_events;

set local role authenticated;

do $cancel_success$
declare
  v_result jsonb;
  v_replay jsonb;
begin
  v_result := public.clair_mutate_chart_order_execution(
    'workspace-clair-cheongdam',
    '49110000-0000-4000-8000-000000000003',
    '95000000-0000-4000-8000-000000000104',
    'cancel',
    '영상 오더를 사유와 함께 취소합니다',
    1,
    '{}'::jsonb,
    'phase5-cancel-0001'
  );
  v_replay := public.clair_mutate_chart_order_execution(
    'workspace-clair-cheongdam',
    '49110000-0000-4000-8000-000000000003',
    '95000000-0000-4000-8000-000000000104',
    'cancel',
    '영상 오더를 사유와 함께 취소합니다',
    1,
    '{}'::jsonb,
    'phase5-cancel-0001'
  );
  if v_replay is distinct from v_result then
    raise exception 'phase5_cancel_replay_not_deterministic';
  end if;
end;
$cancel_success$;

do $phase8_read_model$
declare
  v_model jsonb;
  v_reconciliation jsonb;
  v_rejected boolean := false;
begin
  v_model := public.clair_get_chart_order_execution_read_model(
    'workspace-clair-cheongdam',
    '95000000-0000-4000-8000-000000000002'
  );
  v_reconciliation := v_model -> 'reconciliation';

  if v_model ->> 'workspaceId' <> 'workspace-clair-cheongdam'
    or v_model ->> 'encounterId' <> '95000000-0000-4000-8000-000000000002'
    or jsonb_array_length(v_model -> 'tasks') < 6
    or jsonb_array_length(v_model -> 'events') < 6
    or jsonb_array_length(v_model -> 'revisions') <> 7
    or not exists (
      select 1
      from jsonb_array_elements(v_model -> 'tasks') task
      where task ->> 'reRequestedFromTaskId' is not null
    )
    or coalesce((v_reconciliation ->> 'missingTaskCount')::integer, -1) <> 0
    or coalesce((v_reconciliation ->> 'duplicateTaskCount')::integer, -1) <> 0
    or coalesce((v_reconciliation ->> 'duplicateQueueCount')::integer, -1) <> 0
    or coalesce((v_reconciliation ->> 'duplicateBillingCandidateCount')::integer, -1) <> 0
    or coalesce((v_reconciliation ->> 'destinationlessQueueCount')::integer, -1) <> 0
    or coalesce((v_reconciliation ->> 'aggregateQueueCount')::integer, -1) <> 0
    or coalesce((v_reconciliation ->> 'orphanTaskCount')::integer, -1) <> 0
    or coalesce((v_reconciliation ->> 'orphanQueueCount')::integer, -1) <> 0
    or coalesce((v_reconciliation ->> 'orphanBillingCandidateCount')::integer, -1) <> 0
    or coalesce((v_reconciliation ->> 'draftArtifactCount')::integer, -1) <> 0
  then
    raise exception 'phase8_read_model_or_reconciliation_mismatch';
  end if;

  begin
    perform public.clair_get_chart_order_execution_read_model(
      'workspace-phase5-other',
      '95000000-0000-4000-8000-000000000002'
    );
  exception when insufficient_privilege then
    v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'phase8_cross_workspace_read_not_rejected';
  end if;

  raise notice 'phase8_downstream_read_model_ok';
end;
$phase8_read_model$;

reset role;

do $final_invariants$
begin
  if not exists (
    select 1 from public.orders
    where id = '95000000-0000-4000-8000-000000000104'
      and status = 'cancelled'
      and order_confirmation_status = 'cancelled'
      and cancellation_reason = '영상 오더를 사유와 함께 취소합니다'
      and revision_no = 2
  )
  or not exists (
    select 1 from public.order_tasks
    where order_id = '95000000-0000-4000-8000-000000000104'
      and status = 'cancelled'
  )
  or not exists (
    select 1 from public.order_fulfillment_work_items
    where order_id = '95000000-0000-4000-8000-000000000104'
      and status = 'cancelled'
  )
  or not exists (
    select 1 from public.order_billing_candidates
    where order_id = '95000000-0000-4000-8000-000000000104'
      and status = 'cancelled'
  )
  then
    raise exception 'phase5_cancel_state_mismatch';
  end if;

  if exists (
    select 1 from public.orders
    where encounter_id = '95000000-0000-4000-8000-000000000002'
      and confirmed_snapshot #>> '{revisionNo}' <> '1'
  )
  or (
    select count(*) from public.order_revisions
    where workspace_id = 'workspace-clair-cheongdam'
      and order_id in (
        '95000000-0000-4000-8000-000000000101',
        '95000000-0000-4000-8000-000000000102',
        '95000000-0000-4000-8000-000000000103',
        '95000000-0000-4000-8000-000000000104'
      )
      and idempotency_key is not null
  ) <> 7
  or (
    select count(*) from public.order_execution_outbox
    where event_type = 'order.execution_changed'
  ) <> 7
  or (
    select count(*) from public.audit_events
    where id like 'order-execution-revision-%'
  ) <> 7
  then
    raise exception 'phase5_history_or_outbox_count_mismatch';
  end if;

  if exists (
    select order_id, attempt_no
    from public.order_tasks
    where encounter_id = '95000000-0000-4000-8000-000000000002'
    group by order_id, attempt_no
    having count(*) > 1
  )
  or exists (
    select order_id
    from public.order_fulfillment_work_items
    where encounter_id = '95000000-0000-4000-8000-000000000002'
    group by order_id
    having count(*) > 1
  )
  or exists (
    select order_id
    from public.order_billing_candidates
    where encounter_id = '95000000-0000-4000-8000-000000000002'
    group by order_id
    having count(*) > 1
  )
  then
    raise exception 'phase5_duplicate_task_queue_or_billing_detected';
  end if;

  raise notice 'phase5_revision_attempt_contract_ok';
end;
$final_invariants$;

rollback;
