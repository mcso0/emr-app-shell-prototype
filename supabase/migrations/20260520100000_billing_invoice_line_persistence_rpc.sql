-- DEN-77: persist billing invoice line edits and billing confirmation.
-- Local-first RPC boundary only. Remote Supabase application is intentionally out of scope.

create or replace function public.clair_get_billing_invoice_lines(
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
      'subtotalAmount', i.subtotal_amount,
      'discountAmount', i.discount_amount,
      'taxAmount', i.tax_amount,
      'totalAmount', i.total_amount,
      'issuedAt', i.issued_at,
      'issuedByUserId', i.issued_by_user_id,
      'createdAt', i.created_at
    ),
    'lines',
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', il.id,
          'invoiceId', il.invoice_id,
          'serviceItemId', il.service_item_id,
          'orderId', il.order_id,
          'description', il.description,
          'quantity', il.quantity,
          'unitPrice', il.unit_price,
          'lineTotal', il.line_total
        )
        order by il.created_at, il.id
      ) filter (where il.id is not null),
      '[]'::jsonb
    )
  )
  into v_payload
  from public.invoices i
  left join public.invoice_lines il
    on il.invoice_id = i.id
   and il.workspace_id = i.workspace_id
  where i.workspace_id = p_workspace_id
    and i.id = p_invoice_id
  group by i.id;

  return v_payload;
end;
$$;

create or replace function public.clair_save_billing_invoice_lines(
  p_workspace_id text,
  p_actor_user_id uuid,
  p_invoice_id uuid,
  p_lines jsonb,
  p_confirm_billing boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_line_count integer := coalesce(jsonb_array_length(p_lines), 0);
  v_matched_count integer := 0;
  v_now timestamptz := now();
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
      and i.status in ('draft', 'issued')
      and e.status <> 'cancelled'
  ) then
    raise exception 'invoice_unavailable';
  end if;

  if v_line_count > 100 then
    raise exception 'line_unavailable';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_lines, '[]'::jsonb)) as line_data("invoiceLineId" uuid, quantity numeric)
    where line_data."invoiceLineId" is null
       or line_data.quantity is null
       or line_data.quantity <= 0
  ) then
    raise exception 'line_unavailable';
  end if;

  select count(*)
  into v_matched_count
  from public.invoice_lines il
  join jsonb_to_recordset(coalesce(p_lines, '[]'::jsonb)) as line_data("invoiceLineId" uuid, quantity numeric)
    on line_data."invoiceLineId" = il.id
  where il.workspace_id = p_workspace_id
    and il.invoice_id = p_invoice_id;

  if v_matched_count <> v_line_count then
    raise exception 'line_unavailable';
  end if;

  update public.invoice_lines il
  set
    quantity = line_data.quantity,
    updated_at = v_now
  from jsonb_to_recordset(coalesce(p_lines, '[]'::jsonb)) as line_data("invoiceLineId" uuid, quantity numeric)
  where il.workspace_id = p_workspace_id
    and il.invoice_id = p_invoice_id
    and il.id = line_data."invoiceLineId";

  update public.invoices i
  set
    subtotal_amount = totals.subtotal_amount,
    total_amount = greatest(totals.subtotal_amount - i.discount_amount + i.tax_amount, 0),
    status = case when p_confirm_billing then 'issued' else i.status end,
    payment_state = case when p_confirm_billing then 'unpaid' else i.payment_state end,
    unpaid_reason = case when p_confirm_billing then coalesce(i.unpaid_reason, 'billing_confirmed') else i.unpaid_reason end,
    issued_by_user_id = case when p_confirm_billing then p_actor_user_id else i.issued_by_user_id end,
    issued_at = case when p_confirm_billing then v_now else i.issued_at end,
    updated_at = v_now
  from (
    select coalesce(sum(il.line_total), 0) as subtotal_amount
    from public.invoice_lines il
    where il.workspace_id = p_workspace_id
      and il.invoice_id = p_invoice_id
  ) totals
  where i.workspace_id = p_workspace_id
    and i.id = p_invoice_id;

  return public.clair_get_billing_invoice_lines(p_workspace_id, p_invoice_id);
end;
$$;

revoke all on function public.clair_get_billing_invoice_lines(text, uuid) from public;
revoke all on function public.clair_save_billing_invoice_lines(text, uuid, uuid, jsonb, boolean) from public;

grant execute on function public.clair_get_billing_invoice_lines(text, uuid) to authenticated;
grant execute on function public.clair_save_billing_invoice_lines(text, uuid, uuid, jsonb, boolean) to authenticated;
