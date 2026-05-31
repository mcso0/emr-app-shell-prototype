-- DEN-329: let billing candidate sync create the draft invoice anchor for
-- newly received live encounters. This keeps reception lightweight while
-- ensuring billable chart/fulfillment paths are not limited to seeded invoices.

create or replace function public.clair_sync_billing_invoice_candidates(
  p_workspace_id text,
  p_actor_user_id uuid,
  p_encounter_id uuid,
  p_order_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_invoice_id uuid;
  v_now timestamptz := now();
  v_selected_count integer := coalesce(array_length(p_order_ids, 1), 0);
  v_matched_count integer := 0;
  v_rows jsonb;
begin
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing';
  end if;

  if not exists (
    select 1
    from public.encounters e
    where e.workspace_id = p_workspace_id
      and e.id = p_encounter_id
      and e.status <> 'cancelled'
  ) then
    raise exception 'encounter_unavailable';
  end if;

  if v_selected_count = 0 or v_selected_count > 100 then
    raise exception 'order_unavailable';
  end if;

  select count(*)
  into v_matched_count
  from public.orders o
  where o.workspace_id = p_workspace_id
    and o.encounter_id = p_encounter_id
    and o.id = any(p_order_ids)
    and o.status <> 'cancelled'
    and o.billing_reflection_enabled = true
    and (
      o.order_confirmation_status = 'confirmed'
      or o.billing_candidate_status = 'candidate_created'
    );

  if v_matched_count <> v_selected_count then
    raise exception 'order_unavailable';
  end if;

  select i.id
  into v_invoice_id
  from public.invoices i
  where i.workspace_id = p_workspace_id
    and i.encounter_id = p_encounter_id
    and i.status in ('draft', 'issued')
  order by i.created_at desc, i.id
  limit 1;

  if v_invoice_id is null then
    insert into public.invoices (
      workspace_id,
      encounter_id,
      guardian_id,
      invoice_no,
      status,
      payment_state,
      created_at,
      updated_at
    )
    select
      e.workspace_id,
      e.id,
      e.guardian_id,
      'INV-' || to_char(v_now, 'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
      'draft',
      'none',
      v_now,
      v_now
    from public.encounters e
    where e.workspace_id = p_workspace_id
      and e.id = p_encounter_id
      and e.status <> 'cancelled'
    returning id into v_invoice_id;
  end if;

  if v_invoice_id is null then
    raise exception 'invoice_unavailable';
  end if;

  update public.orders o
  set
    billing_candidate_status = 'candidate_created',
    billing_candidate_id = coalesce(o.billing_candidate_id, concat('billcand-', o.id::text)),
    updated_at = v_now
  where o.workspace_id = p_workspace_id
    and o.encounter_id = p_encounter_id
    and o.id = any(p_order_ids);

  insert into public.invoice_lines (
    workspace_id,
    invoice_id,
    service_item_id,
    order_id,
    description,
    quantity,
    unit_price,
    billing_candidate_id,
    billing_name_snapshot,
    source_order_snapshot,
    created_at,
    updated_at
  )
  select
    o.workspace_id,
    v_invoice_id,
    o.service_item_id,
    o.id,
    coalesce(nullif(btrim(o.billing_display_name), ''), o.display_name),
    o.quantity,
    coalesce(o.unit_price_snapshot, 0),
    o.billing_candidate_id,
    coalesce(nullif(btrim(o.billing_display_name), ''), o.display_name),
    jsonb_build_object(
      'orderId', o.id,
      'displayName', o.display_name,
      'appliedSnapshot', o.applied_snapshot,
      'calculationInputs', o.calculation_inputs,
      'calculationOutputs', o.calculation_outputs,
      'orderConfirmationStatus', o.order_confirmation_status,
      'billingCandidateStatus', o.billing_candidate_status
    ),
    v_now,
    v_now
  from public.orders o
  where o.workspace_id = p_workspace_id
    and o.encounter_id = p_encounter_id
    and o.id = any(p_order_ids)
    and not exists (
      select 1
      from public.invoice_lines existing
      where existing.workspace_id = p_workspace_id
        and existing.invoice_id = v_invoice_id
        and existing.order_id = o.id
    );

  update public.invoice_lines il
  set
    description = coalesce(nullif(btrim(o.billing_display_name), ''), o.display_name),
    quantity = o.quantity,
    unit_price = coalesce(o.unit_price_snapshot, 0),
    billing_candidate_id = o.billing_candidate_id,
    billing_name_snapshot = coalesce(nullif(btrim(o.billing_display_name), ''), o.display_name),
    source_order_snapshot = jsonb_build_object(
      'orderId', o.id,
      'displayName', o.display_name,
      'appliedSnapshot', o.applied_snapshot,
      'calculationInputs', o.calculation_inputs,
      'calculationOutputs', o.calculation_outputs,
      'orderConfirmationStatus', o.order_confirmation_status,
      'billingCandidateStatus', o.billing_candidate_status
    ),
    updated_at = v_now
  from public.orders o
  where il.workspace_id = p_workspace_id
    and il.invoice_id = v_invoice_id
    and il.order_id = o.id
    and o.workspace_id = p_workspace_id
    and o.encounter_id = p_encounter_id
    and o.id = any(p_order_ids);

  update public.invoices i
  set
    subtotal_amount = totals.subtotal_amount,
    total_amount = greatest(totals.subtotal_amount - i.discount_amount + i.tax_amount, 0),
    updated_at = v_now
  from (
    select coalesce(sum(il.line_total), 0) as subtotal_amount
    from public.invoice_lines il
    where il.workspace_id = p_workspace_id
      and il.invoice_id = v_invoice_id
  ) totals
  where i.workspace_id = p_workspace_id
    and i.id = v_invoice_id;

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
      'action', 'billing_invoice_candidate_sync',
      'billingCandidateId', o.billing_candidate_id,
      'invoiceId', v_invoice_id,
      'serverCalculatedLineTotal', o.line_total_snapshot
    ),
    v_now
  from public.orders o
  where o.workspace_id = p_workspace_id
    and o.encounter_id = p_encounter_id
    and o.id = any(p_order_ids);

  select coalesce(
    jsonb_agg(row_data.value order by row_data.value->>'orderId'),
    '[]'::jsonb
  )
  into v_rows
  from jsonb_array_elements(public.clair_list_billing_invoice_candidates(p_workspace_id, p_encounter_id)) as row_data(value)
  where nullif(row_data.value->>'orderId', '')::uuid = any(p_order_ids);

  return v_rows;
end;
$$;

revoke all on function public.clair_sync_billing_invoice_candidates(text, uuid, uuid, uuid[]) from public;
grant execute on function public.clair_sync_billing_invoice_candidates(text, uuid, uuid, uuid[]) to authenticated;

comment on function public.clair_sync_billing_invoice_candidates(text, uuid, uuid, uuid[]) is
  'DEN-329 billing candidate sync that lazily creates a draft invoice anchor for live reception encounters after order validation.';
