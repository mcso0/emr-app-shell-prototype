-- DEN-78: persist selected payment method, unpaid, and completed payment states.
-- Local-first RPC boundary only. Real PG confirmation and accounting settlement are intentionally out of scope.

create or replace function public.clair_get_billing_payment_status(
  p_workspace_id text,
  p_invoice_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_payload jsonb;
begin
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing';
  end if;

  if not exists (
    select 1
    from public.invoices i
    join public.encounters e
      on e.id = i.encounter_id
     and e.workspace_id = i.workspace_id
    where i.workspace_id = p_workspace_id
      and i.id = p_invoice_id
      and e.status <> 'cancelled'
  ) then
    raise exception 'invoice_unavailable';
  end if;

  select jsonb_build_object(
    'invoice',
    jsonb_build_object(
      'id', i.id,
      'workspaceId', i.workspace_id,
      'encounterId', i.encounter_id,
      'guardianId', i.guardian_id,
      'invoiceNo', i.invoice_no,
      'status', i.status,
      'paymentState', i.payment_state,
      'selectedPaymentMethod', i.selected_payment_method,
      'unpaidReason', i.unpaid_reason,
      'subtotalAmount', i.subtotal_amount,
      'discountAmount', i.discount_amount,
      'taxAmount', i.tax_amount,
      'totalAmount', i.total_amount,
      'issuedAt', i.issued_at,
      'issuedByUserId', i.issued_by_user_id,
      'paidAt', i.paid_at,
      'createdAt', i.created_at
    ),
    'payments',
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'invoiceId', p.invoice_id,
          'paymentMethod', p.payment_method,
          'amount', p.amount,
          'status', p.status,
          'paidAt', p.paid_at,
          'metadata', p.metadata
        )
        order by p.paid_at desc, p.id
      ) filter (where p.id is not null),
      '[]'::jsonb
    )
  )
  into v_payload
  from public.invoices i
  left join public.payments p
    on p.invoice_id = i.id
   and p.workspace_id = i.workspace_id
  where i.workspace_id = p_workspace_id
    and i.id = p_invoice_id
  group by i.id;

  return v_payload;
end;
$$;

create or replace function public.clair_save_billing_payment_status(
  p_workspace_id text,
  p_actor_user_id uuid,
  p_invoice_id uuid,
  p_action text,
  p_payment_method text,
  p_unpaid_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_invoice public.invoices%rowtype;
  v_now timestamptz := now();
begin
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing';
  end if;

  if p_action not in ('select_payment_method', 'mark_unpaid', 'complete_payment') then
    raise exception 'invoice_unavailable';
  end if;

  if p_payment_method not in ('card', 'cash', 'transfer', 'other') then
    raise exception 'invoice_unavailable';
  end if;

  select i.*
  into v_invoice
  from public.invoices i
  join public.encounters e
    on e.id = i.encounter_id
   and e.workspace_id = i.workspace_id
  where i.workspace_id = p_workspace_id
    and i.id = p_invoice_id
    and i.status in ('draft', 'issued', 'paid')
    and e.status <> 'cancelled';

  if v_invoice.id is null then
    raise exception 'invoice_unavailable';
  end if;

  if p_action = 'select_payment_method' then
    update public.invoices i
    set
      selected_payment_method = p_payment_method,
      updated_at = v_now
    where i.workspace_id = p_workspace_id
      and i.id = p_invoice_id;
  elsif p_action = 'mark_unpaid' then
    update public.invoices i
    set
      status = 'issued',
      payment_state = 'unpaid',
      selected_payment_method = p_payment_method,
      unpaid_reason = coalesce(nullif(btrim(p_unpaid_reason), ''), 'billing_unpaid'),
      issued_by_user_id = coalesce(i.issued_by_user_id, p_actor_user_id),
      issued_at = coalesce(i.issued_at, v_now),
      paid_at = null,
      updated_at = v_now
    where i.workspace_id = p_workspace_id
      and i.id = p_invoice_id;

    update public.payments p
    set status = 'cancelled'
    where p.workspace_id = p_workspace_id
      and p.invoice_id = p_invoice_id
      and p.status = 'approved';
  elsif p_action = 'complete_payment' then
    update public.invoices i
    set
      status = 'paid',
      payment_state = 'paid',
      selected_payment_method = p_payment_method,
      unpaid_reason = null,
      issued_by_user_id = coalesce(i.issued_by_user_id, p_actor_user_id),
      issued_at = coalesce(i.issued_at, v_now),
      paid_at = v_now,
      updated_at = v_now
    where i.workspace_id = p_workspace_id
      and i.id = p_invoice_id;

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
    select
      p_workspace_id,
      p_invoice_id,
      p_payment_method,
      i.total_amount,
      'approved',
      v_now,
      jsonb_build_object('prototype', true, 'externalProvider', 'not_connected'),
      v_now
    from public.invoices i
    where i.workspace_id = p_workspace_id
      and i.id = p_invoice_id
      and not exists (
        select 1
        from public.payments existing
        where existing.workspace_id = p_workspace_id
          and existing.invoice_id = p_invoice_id
          and existing.status = 'approved'
      );

    update public.payments p
    set
      payment_method = p_payment_method,
      amount = i.total_amount,
      paid_at = v_now,
      metadata = coalesce(p.metadata, '{}'::jsonb) || jsonb_build_object('externalProvider', 'not_connected')
    from public.invoices i
    where p.workspace_id = p_workspace_id
      and p.invoice_id = p_invoice_id
      and p.status = 'approved'
      and i.workspace_id = p_workspace_id
      and i.id = p_invoice_id;

    update public.encounters e
    set
      status = 'completed',
      completed_at = coalesce(e.completed_at, v_now),
      updated_at = v_now
    from public.invoices i
    where i.workspace_id = p_workspace_id
      and i.id = p_invoice_id
      and e.workspace_id = i.workspace_id
      and e.id = i.encounter_id
      and e.status <> 'cancelled';
  end if;

  return public.clair_get_billing_payment_status(p_workspace_id, p_invoice_id);
end;
$$;

revoke all on function public.clair_get_billing_payment_status(text, uuid) from public;
revoke all on function public.clair_save_billing_payment_status(text, uuid, uuid, text, text, text) from public;

grant execute on function public.clair_get_billing_payment_status(text, uuid) to authenticated;
grant execute on function public.clair_save_billing_payment_status(text, uuid, uuid, text, text, text) to authenticated;
