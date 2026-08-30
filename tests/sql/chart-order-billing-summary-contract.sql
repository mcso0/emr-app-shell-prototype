-- Runs inside a disposable transaction after the target migration is loaded.
-- It uses only the local synthetic clair-demo fixture and is rolled back by the caller.

delete from public.invoice_lines
where workspace_id = 'clair-demo'
  and order_id = '29500000-0000-4000-8000-000000000001';

update public.orders
set status = 'confirmed',
    order_confirmation_status = 'confirmed',
    billing_candidate_status = 'candidate_created',
    billing_candidate_id = 'billcand-contract-295',
    invoice_line_id = null,
    updated_at = now()
where workspace_id = 'clair-demo'
  and id = '29500000-0000-4000-8000-000000000001';

insert into public.order_confirmation_commands(
  id, workspace_id, encounter_id, actor_user_id, idempotency_key,
  request_sha256, expected_draft_etag, selected_root_order_ids,
  status, result, completed_at
) values (
  '29510000-0000-4000-8000-000000000001',
  'clair-demo',
  '26000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000001',
  'billing-contract-confirmation',
  repeat('a', 64),
  '"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"',
  array['29500000-0000-4000-8000-000000000001'::uuid],
  'completed',
  '{}'::jsonb,
  now()
);

insert into public.order_tasks(
  id, workspace_id, encounter_id, order_id, task_role,
  clinical_order_type, destination_module, status, priority, attempt_no,
  effective_snapshot, created_by_user_id, completed_at
) values (
  '29520000-0000-4000-8000-000000000001',
  'clair-demo',
  '26000000-0000-4000-8000-000000000001',
  '29500000-0000-4000-8000-000000000001',
  'execution', 'clinical_lab', null, 'complete', 'normal', 1,
  '{}'::jsonb, '00000000-0000-4000-8000-000000000001', now()
);

insert into public.order_tasks(
  id, workspace_id, encounter_id, order_id, task_role,
  clinical_order_type, destination_module, status, priority, attempt_no,
  re_requested_from_task_id, effective_snapshot, created_by_user_id
) values (
  '29520000-0000-4000-8000-000000000002',
  'clair-demo',
  '26000000-0000-4000-8000-000000000001',
  '29500000-0000-4000-8000-000000000001',
  'execution', 'clinical_lab', null, 'pending', 'normal', 2,
  '29520000-0000-4000-8000-000000000001',
  '{}'::jsonb, '00000000-0000-4000-8000-000000000001'
);

insert into public.order_billing_candidates(
  id, workspace_id, encounter_id, order_id, task_id, task_attempt_no,
  status, billing_name_snapshot, quantity, unit_price, amount, currency,
  source_snapshot, created_by_user_id, confirmation_command_id
) values (
  'billcand-contract-295',
  'clair-demo',
  '26000000-0000-4000-8000-000000000001',
  '29500000-0000-4000-8000-000000000001',
  '29520000-0000-4000-8000-000000000001',
  1, 'candidate_created', '정정된 CBC 청구명', 2, 12345, 24689, 'KRW',
  '{"fixture":"chart-order-billing-contract"}'::jsonb,
  '00000000-0000-4000-8000-000000000001',
  '29510000-0000-4000-8000-000000000001'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000001',
  true
);

create temp table chart_order_billing_test_state as
select public.clair_get_chart_order_billing_summary(
  'clair-demo',
  '26000000-0000-4000-8000-000000000001'
) summary;

reset role;
update public.order_billing_candidates
set amount = 24688, updated_at = now()
where workspace_id = 'clair-demo'
  and id = 'billcand-contract-295';
set local role authenticated;

do $$
begin
  begin
    perform public.clair_request_chart_order_billing(
      'clair-demo',
      '00000000-0000-4000-8000-000000000001',
      '26000000-0000-4000-8000-000000000001',
      (select summary->>'etag' from chart_order_billing_test_state),
      'billing-contract-stale-correction',
      true
    );
    raise exception 'candidate_correction_did_not_invalidate_etag';
  exception when others then
    if sqlerrm not like '%revision_conflict%' then raise; end if;
  end;
end
$$;

reset role;
update public.order_billing_candidates
set amount = 24689, updated_at = now()
where workspace_id = 'clair-demo'
  and id = 'billcand-contract-295';
set local role authenticated;

do $$
declare
  v_summary jsonb;
begin
  select summary into v_summary from chart_order_billing_test_state;
  if jsonb_array_length(v_summary->'unfinishedOrders') is distinct from 1 then
    raise exception 'latest_task_attempt_not_reflected';
  end if;
  if (v_summary->'amounts'->>'confirmed')::numeric is distinct from 24689::numeric
     or (v_summary->'amounts'->>'requestableTotal')::numeric is distinct from 24689::numeric then
    raise exception 'candidate_amount_not_used_by_summary';
  end if;
  begin
    perform public.clair_request_chart_order_billing(
      'clair-demo',
      '00000000-0000-4000-8000-000000000001',
      '26000000-0000-4000-8000-000000000001',
      v_summary->>'etag',
      'billing-contract-request-1',
      false
    );
    raise exception 'unfinished_ack_was_not_required';
  exception when others then
    if sqlerrm not like '%unfinished_ack_required%' then raise; end if;
  end;
end
$$;

create temp table chart_order_billing_success as
select public.clair_request_chart_order_billing(
  'clair-demo',
  '00000000-0000-4000-8000-000000000001',
  '26000000-0000-4000-8000-000000000001',
  (select summary->>'etag' from chart_order_billing_test_state),
  'billing-contract-request-1',
  true
) summary;

reset role;

do $$
declare
  v_invoice_id uuid;
  v_replay jsonb;
  v_command_count bigint;
begin
  select (summary->>'invoiceId')::uuid into v_invoice_id
  from chart_order_billing_success;

  if not exists (
    select 1
    from public.invoice_lines line
    where line.workspace_id = 'clair-demo'
      and line.invoice_id = v_invoice_id
      and line.order_id = '29500000-0000-4000-8000-000000000001'
      and line.description = '정정된 CBC 청구명'
      and line.billing_name_snapshot = '정정된 CBC 청구명'
      and line.quantity = 2
      and line.unit_price = 12345
      and line.discount_amount = 1
      and line.line_total = 24689
      and line.source_order_snapshot->>'billingAuthority' = 'order_billing_candidates'
  ) then
    raise exception 'candidate_snapshot_did_not_reach_invoice_line';
  end if;

  if exists (
    select 1 from public.audit_events event
    where event.workspace_id = 'clair-demo'
      and event.event_type = 'billing.invoice_candidate_generated'
      and (
        event.before_snapshot::text like '%정정된 CBC 청구명%'
        or event.before_snapshot ? 'context'
        or event.after_snapshot ? 'context'
      )
  ) then
    raise exception 'audit_snapshot_contains_display_context';
  end if;

  select count(*) into v_command_count
  from public.order_billing_request_commands;
  begin
    perform public.clair_request_chart_order_billing(
      'clair-foreign-demo',
      '00000000-0000-4000-8000-000000000001',
      '26000000-0000-4000-8000-000000000001',
      '"foreign"',
      'billing-contract-foreign',
      false
    );
    raise exception 'cross_workspace_request_was_allowed';
  exception when others then
    if sqlerrm not like '%workspace_membership_missing%' then raise; end if;
  end;
  begin
    perform public.clair_request_chart_order_billing(
      'clair-demo',
      '00000000-0000-4000-8000-000000000002',
      '26000000-0000-4000-8000-000000000001',
      '"actor-mismatch"',
      'billing-contract-actor-mismatch',
      false
    );
    raise exception 'actor_mismatch_request_was_allowed';
  exception when others then
    if sqlerrm not like '%workspace_membership_missing%' then raise; end if;
  end;
  if (select count(*) from public.order_billing_request_commands)
      is distinct from v_command_count then
    raise exception 'denied_request_changed_command_state';
  end if;

  -- A later draft must not change the invoice returned by an idempotent replay.
  insert into public.invoices(
    id, workspace_id, encounter_id, guardian_id, invoice_no, status,
    payment_state, created_at, updated_at
  )
  select
    '29530000-0000-4000-8000-000000000001',
    encounter.workspace_id,
    encounter.id,
    encounter.guardian_id,
    'INV-IDEMPOTENCY-NEWER',
    'draft',
    'none',
    now() + interval '1 minute',
    now() + interval '1 minute'
  from public.encounters encounter
  where encounter.workspace_id = 'clair-demo'
    and encounter.id = '26000000-0000-4000-8000-000000000001';

  v_replay := public.clair_request_chart_order_billing(
    'clair-demo',
    '00000000-0000-4000-8000-000000000001',
    '26000000-0000-4000-8000-000000000001',
    (select summary->>'etag' from chart_order_billing_test_state),
    'billing-contract-request-1',
    true
  );
  if (v_replay->>'invoiceId')::uuid is distinct from v_invoice_id then
    raise exception 'idempotent_replay_changed_invoice';
  end if;
  if (
    select count(*) from public.order_billing_request_commands command
    where command.workspace_id = 'clair-demo'
      and command.idempotency_key = 'billing-contract-request-1'
  ) is distinct from 1::bigint then
    raise exception 'idempotent_replay_duplicated_command';
  end if;
end
$$;
