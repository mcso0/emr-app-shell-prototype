-- DEN-505: harden direct RPC role gates and central audit evidence.
-- Synthetic/demo staging scope only. No real payment/provider side effects are introduced.

create or replace function private.clair_current_user_has_workspace_permission(
  p_workspace_id text,
  p_permission_id text
)
returns boolean
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  with active_membership as (
    select membership.user_id, membership.roles
    from public.user_memberships membership
    join public.users app_user
      on app_user.id = membership.user_id
    where membership.workspace_id = p_workspace_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
      and app_user.status = 'active'
  )
  select exists (
    select 1
    from active_membership membership
    where membership.roles @> array['hospital_admin']::text[]
      or exists (
        select 1
        from public.permission_policies policy
        where policy.workspace_id = p_workspace_id
          and (
            (
              policy.scope = 'role'
              and policy.target_role = any(membership.roles)
            )
            or (
              policy.scope = 'user'
              and policy.target_user_id = membership.user_id
            )
          )
          and (
            coalesce(policy.permissions -> 'allowed', '[]'::jsonb) ? '*'
            or coalesce(policy.permissions -> 'allowed', '[]'::jsonb) ? p_permission_id
          )
      )
  );
$$;

revoke all on function private.clair_current_user_has_workspace_permission(text, text) from public;
grant execute on function private.clair_current_user_has_workspace_permission(text, text) to authenticated;

comment on function private.clair_current_user_has_workspace_permission(text, text) is
  'DEN-505 helper: true when auth.uid() is an active workspace member with the requested DB-backed permission policy.';

create or replace function public.clair_save_chart_order_action(
  p_workspace_id text,
  p_actor_user_id uuid,
  p_encounter_id uuid,
  p_action text,
  p_order_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_now timestamptz := now();
  v_selected_count integer := coalesce(array_length(p_order_ids, 1), 0);
  v_matched_count integer := 0;
  v_rows jsonb;
  v_actor_membership_id uuid;
begin
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing';
  end if;

  if p_actor_user_id is distinct from auth.uid() then
    raise exception 'workspace_membership_missing';
  end if;

  if not private.clair_current_user_has_workspace_permission(p_workspace_id, 'chart:update') then
    raise exception 'permission_missing';
  end if;

  select membership.id
  into v_actor_membership_id
  from public.user_memberships membership
  where membership.workspace_id = p_workspace_id
    and membership.user_id = auth.uid()
    and membership.status = 'active'
  limit 1;

  if not exists (
    select 1
    from public.encounters e
    where e.workspace_id = p_workspace_id
      and e.id = p_encounter_id
      and e.status <> 'cancelled'
  ) then
    raise exception 'encounter_unavailable';
  end if;

  if p_action not in ('confirm', 'bill') or v_selected_count = 0 or v_selected_count > 100 then
    raise exception 'invalid_order_action';
  end if;

  select count(*)
  into v_matched_count
  from public.orders o
  where o.workspace_id = p_workspace_id
    and o.encounter_id = p_encounter_id
    and o.id = any(p_order_ids)
    and o.status <> 'cancelled'
    and o.order_confirmation_status <> 'cancelled';

  if v_matched_count <> v_selected_count then
    raise exception 'order_unavailable';
  end if;

  if p_action = 'confirm' then
    update public.orders o
    set
      status = case
        when o.status in ('draft', 'requested', 're_requested') then 'confirmed'
        else o.status
      end,
      order_confirmation_status = 'confirmed',
      confirmed_by_user_id = p_actor_user_id,
      confirmed_at = coalesce(o.confirmed_at, v_now),
      task_status = coalesce(o.task_status, 'pending'),
      updated_at = v_now
    where o.workspace_id = p_workspace_id
      and o.encounter_id = p_encounter_id
      and o.id = any(p_order_ids)
      and o.status <> 'cancelled'
      and o.order_confirmation_status <> 'cancelled';
  else
    update public.orders o
    set
      billing_candidate_status = 'candidate_created',
      billing_candidate_id = coalesce(o.billing_candidate_id, concat('billcand-', o.id::text)),
      updated_at = v_now
    where o.workspace_id = p_workspace_id
      and o.encounter_id = p_encounter_id
      and o.id = any(p_order_ids)
      and o.status <> 'cancelled'
      and o.order_confirmation_status <> 'cancelled';
  end if;

  insert into public.order_events (
    workspace_id,
    order_id,
    event_type,
    performed_by_user_id,
    payload,
    created_at
  )
  select
    p_workspace_id,
    o.id,
    'edited',
    p_actor_user_id,
    jsonb_build_object(
      'action', p_action,
      'orderConfirmationStatus', o.order_confirmation_status,
      'billingCandidateStatus', o.billing_candidate_status,
      'billingCandidateId', o.billing_candidate_id,
      'billingSyncHookPoint', p_action = 'bill'
    ),
    v_now
  from public.orders o
  where o.workspace_id = p_workspace_id
    and o.encounter_id = p_encounter_id
    and o.id = any(p_order_ids);

  insert into public.audit_events (
    id,
    workspace_id,
    actor_user_id,
    actor_membership_id,
    event_type,
    target_type,
    target_id,
    encounter_id,
    patient_id,
    guardian_id,
    after_snapshot,
    metadata,
    occurred_at,
    created_at
  )
  select
    'audit_rpc_order_' || substr(encode(extensions.digest(
      p_workspace_id || ':' || o.id::text || ':' || p_action || ':' || v_now::text,
      'sha256'
    ), 'hex'), 1, 24),
    p_workspace_id,
    p_actor_user_id,
    v_actor_membership_id,
    case
      when p_action = 'confirm' then 'order.confirmed'
      else 'order.billing_candidate_requested'
    end,
    'order',
    o.id::text,
    p_encounter_id,
    e.patient_id,
    e.guardian_id,
    jsonb_build_object(
      'billingCandidateStatus', o.billing_candidate_status,
      'orderConfirmationStatus', o.order_confirmation_status,
      'status', o.status
    ),
    jsonb_build_object(
      'action', p_action,
      'rpc', 'clair_save_chart_order_action',
      'source', 'chart-order-action-rpc'
    ),
    v_now,
    v_now
  from public.orders o
  join public.encounters e
    on e.workspace_id = o.workspace_id
   and e.id = o.encounter_id
  where o.workspace_id = p_workspace_id
    and o.encounter_id = p_encounter_id
    and o.id = any(p_order_ids)
  on conflict (id) do update
    set id = excluded.id;

  select coalesce(
    jsonb_agg(row_data.value order by row_data.value->>'orderId'),
    '[]'::jsonb
  )
  into v_rows
  from jsonb_array_elements(public.clair_get_chart_order_actions(p_workspace_id, p_encounter_id)) as row_data(value)
  where nullif(row_data.value->>'orderId', '')::uuid = any(p_order_ids);

  return v_rows;
end;
$$;

revoke all on function public.clair_save_chart_order_action(text, uuid, uuid, text, uuid[]) from public;
grant execute on function public.clair_save_chart_order_action(text, uuid, uuid, text, uuid[]) to authenticated;

create or replace function public.clair_transition_billing_invoice_status(
  p_workspace_id text,
  p_actor_user_id uuid,
  p_invoice_id uuid,
  p_target text,
  p_payment_method text default 'card',
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_invoice public.invoices%rowtype;
  v_next_invoice public.invoices%rowtype;
  v_now timestamptz := now();
  v_payload jsonb;
  v_previous_status text;
  v_next_status text;
  v_actor_membership_id uuid;
begin
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing';
  end if;

  if p_actor_user_id is distinct from auth.uid() then
    raise exception 'workspace_membership_missing';
  end if;

  if not private.clair_current_user_has_workspace_permission(p_workspace_id, 'billing:issue') then
    raise exception 'permission_missing';
  end if;

  select membership.id
  into v_actor_membership_id
  from public.user_memberships membership
  where membership.workspace_id = p_workspace_id
    and membership.user_id = auth.uid()
    and membership.status = 'active'
  limit 1;

  if p_target not in ('waiting', 'unpaid', 'paid', 'voided') then
    raise exception 'invoice_unavailable';
  end if;

  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'transition_reason_required';
  end if;

  if p_payment_method not in ('card', 'cash', 'transfer', 'other') then
    raise exception 'invoice_unavailable';
  end if;

  select i.*
  into v_invoice
  from public.invoices i
  where i.workspace_id = p_workspace_id
    and i.id = p_invoice_id
  for update;

  if v_invoice.id is null then
    raise exception 'invoice_unavailable';
  end if;

  v_previous_status := private.clair_billing_lifecycle_status(
    v_invoice.status,
    v_invoice.payment_state,
    v_invoice.unpaid_reason
  );

  if p_target = 'paid' then
    update public.invoices
    set
      status = 'paid',
      payment_state = 'paid',
      selected_payment_method = p_payment_method,
      unpaid_reason = null,
      issued_at = coalesce(issued_at, v_now),
      paid_at = v_now,
      voided_at = null,
      voided_reason = null,
      updated_at = v_now
    where workspace_id = p_workspace_id and id = p_invoice_id
    returning * into v_next_invoice;

    insert into public.payments (
      workspace_id,
      invoice_id,
      payment_method,
      amount,
      status,
      paid_at,
      metadata,
      created_at
    )
    values (
      p_workspace_id,
      p_invoice_id,
      p_payment_method,
      v_next_invoice.total_amount,
      'approved',
      v_now,
      jsonb_build_object('prototype', true, 'source', 'billing_invoice_status_transition'),
      v_now
    )
    on conflict do nothing;
  elsif p_target = 'unpaid' then
    update public.invoices
    set
      status = 'issued',
      payment_state = 'unpaid',
      selected_payment_method = p_payment_method,
      unpaid_reason = nullif(btrim(p_reason), ''),
      issued_at = coalesce(issued_at, v_now),
      paid_at = null,
      voided_at = null,
      voided_reason = null,
      updated_at = v_now
    where workspace_id = p_workspace_id and id = p_invoice_id
    returning * into v_next_invoice;

    update public.payments
    set status = 'cancelled'
    where workspace_id = p_workspace_id
      and invoice_id = p_invoice_id
      and status = 'approved';
  elsif p_target = 'voided' then
    update public.invoices
    set
      status = 'voided',
      payment_state = 'none',
      paid_at = null,
      unpaid_reason = null,
      voided_at = v_now,
      voided_reason = nullif(btrim(p_reason), ''),
      updated_at = v_now
    where workspace_id = p_workspace_id and id = p_invoice_id
    returning * into v_next_invoice;

    update public.payments
    set status = 'cancelled'
    where workspace_id = p_workspace_id
      and invoice_id = p_invoice_id
      and status = 'approved';
  else
    update public.invoices
    set
      status = 'draft',
      payment_state = 'none',
      selected_payment_method = null,
      unpaid_reason = null,
      paid_at = null,
      voided_at = null,
      voided_reason = null,
      updated_at = v_now
    where workspace_id = p_workspace_id and id = p_invoice_id
    returning * into v_next_invoice;

    update public.payments
    set status = 'cancelled'
    where workspace_id = p_workspace_id
      and invoice_id = p_invoice_id
      and status = 'approved';
  end if;

  v_next_status := private.clair_billing_lifecycle_status(
    v_next_invoice.status,
    v_next_invoice.payment_state,
    v_next_invoice.unpaid_reason
  );

  insert into public.billing_invoice_status_transition_events (
    workspace_id,
    invoice_id,
    actor_user_id,
    previous_status,
    next_status,
    previous_payment_state,
    next_payment_state,
    amount_snapshot,
    reason,
    source,
    payment_side_effect,
    created_at
  )
  values (
    p_workspace_id,
    p_invoice_id,
    p_actor_user_id,
    v_previous_status,
    v_next_status,
    v_invoice.payment_state,
    v_next_invoice.payment_state,
    v_invoice.total_amount,
    nullif(btrim(p_reason), ''),
    'guardian_checkout',
    jsonb_build_object('target', p_target, 'paymentMethod', p_payment_method),
    v_now
  );

  insert into public.audit_events (
    id,
    workspace_id,
    actor_user_id,
    actor_membership_id,
    event_type,
    target_type,
    target_id,
    encounter_id,
    guardian_id,
    reason,
    before_snapshot,
    after_snapshot,
    metadata,
    occurred_at,
    created_at
  )
  values (
    'audit_rpc_billing_' || substr(encode(extensions.digest(
      p_workspace_id || ':' || p_invoice_id::text || ':' || p_target || ':' || v_now::text,
      'sha256'
    ), 'hex'), 1, 24),
    p_workspace_id,
    p_actor_user_id,
    v_actor_membership_id,
    'billing.payment_state_changed',
    'invoice',
    p_invoice_id::text,
    v_next_invoice.encounter_id,
    v_next_invoice.guardian_id,
    nullif(btrim(p_reason), ''),
    jsonb_build_object(
      'invoiceStatus', v_invoice.status,
      'lifecycleStatus', v_previous_status,
      'paymentState', v_invoice.payment_state
    ),
    jsonb_build_object(
      'invoiceStatus', v_next_invoice.status,
      'lifecycleStatus', v_next_status,
      'paymentState', v_next_invoice.payment_state
    ),
    jsonb_build_object(
      'paymentMethod', p_payment_method,
      'rpc', 'clair_transition_billing_invoice_status',
      'source', 'billing-invoice-status-transition-rpc',
      'target', p_target
    ),
    v_now,
    v_now
  )
  on conflict (id) do update
    set id = excluded.id;

  select jsonb_build_object(
    'invoice',
    jsonb_build_object(
      'id', v_next_invoice.id,
      'workspaceId', v_next_invoice.workspace_id,
      'encounterId', v_next_invoice.encounter_id,
      'guardianId', v_next_invoice.guardian_id,
      'invoiceNo', v_next_invoice.invoice_no,
      'status', v_next_invoice.status,
      'paymentState', v_next_invoice.payment_state,
      'selectedPaymentMethod', v_next_invoice.selected_payment_method,
      'unpaidReason', v_next_invoice.unpaid_reason,
      'subtotalAmount', v_next_invoice.subtotal_amount,
      'discountAmount', v_next_invoice.discount_amount,
      'taxAmount', v_next_invoice.tax_amount,
      'totalAmount', v_next_invoice.total_amount,
      'issuedAt', v_next_invoice.issued_at,
      'paidAt', v_next_invoice.paid_at,
      'createdAt', v_next_invoice.created_at
    ),
    'payments',
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'invoiceId', p.invoice_id,
        'paymentMethod', p.payment_method,
        'amount', p.amount,
        'status', p.status,
        'paidAt', p.paid_at,
        'metadata', p.metadata
      ) order by p.paid_at desc, p.id)
      from public.payments p
      where p.workspace_id = p_workspace_id
        and p.invoice_id = p_invoice_id
    ), '[]'::jsonb),
    'auditEvent',
    jsonb_build_object(
      'eventType', 'billing.invoice_status_transitioned',
      'invoiceId', p_invoice_id,
      'actorUserId', p_actor_user_id,
      'previousStatus', v_previous_status,
      'targetStatus', v_next_status,
      'amountSnapshot', v_invoice.total_amount,
      'reason', nullif(btrim(p_reason), ''),
      'source', 'guardian_checkout',
      'transitionedAt', v_now
    )
  )
  into v_payload;

  return v_payload;
end;
$$;

revoke all on function public.clair_transition_billing_invoice_status(text, uuid, uuid, text, text, text) from public;
grant execute on function public.clair_transition_billing_invoice_status(text, uuid, uuid, text, text, text) to authenticated;

comment on function public.clair_save_chart_order_action(text, uuid, uuid, text, uuid[]) is
  'DEN-505 hardened chart order action RPC. Requires auth.uid actor match, chart:update permission, and emits central audit_events.';
comment on function public.clair_transition_billing_invoice_status(text, uuid, uuid, text, text, text) is
  'DEN-505 hardened invoice status transition RPC. Requires auth.uid actor match, billing:issue permission, and emits central audit_events.';;
