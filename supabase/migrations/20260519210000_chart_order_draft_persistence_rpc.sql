-- DEN-72: local-first chart order draft persistence RPC boundary.
-- Created manually because the Supabase CLI is not installed in this workspace.
-- Remote Supabase application remains approval-gated.

create or replace function public.clair_get_chart_order_draft(
  p_workspace_id text,
  p_encounter_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  v_order_rows jsonb;
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

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'orderId', o.id::text,
        'encounterId', o.encounter_id::text,
        'billingDisplayName', coalesce(o.billing_display_name, o.display_name),
        'quantity', o.quantity,
        'unitPriceSnapshot', coalesce(o.unit_price_snapshot, 0),
        'lineTotalSnapshot', o.line_total_snapshot,
        'updatedAt', o.updated_at
      )
      order by o.sort_order, o.created_at, o.id
    ),
    '[]'::jsonb
  )
    into v_order_rows
  from public.orders o
  where o.workspace_id = p_workspace_id
    and o.encounter_id = p_encounter_id
    and o.status <> 'cancelled'
    and o.order_confirmation_status in ('draft', 'pending');

  return v_order_rows;
end;
$$;

create or replace function public.clair_save_chart_order_draft(
  p_workspace_id text,
  p_actor_user_id text,
  p_encounter_id uuid,
  p_orders jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  v_actor_user_id uuid := nullif(p_actor_user_id, '')::uuid;
  v_now timestamptz := now();
  v_order_rows jsonb;
begin
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing';
  end if;

  if jsonb_typeof(coalesce(p_orders, '[]'::jsonb)) <> 'array' then
    raise exception 'invalid_order_rows';
  end if;

  if jsonb_array_length(coalesce(p_orders, '[]'::jsonb)) > 100 then
    raise exception 'too_many_order_rows';
  end if;

  if not exists (
    select 1
    from public.encounters e
    where e.workspace_id = p_workspace_id
      and e.id = p_encounter_id
      and e.status <> 'cancelled'
    for update
  ) then
    raise exception 'encounter_unavailable';
  end if;

  update public.orders o
  set
    billing_display_name = btrim(row_data.value->>'billingDisplayName'),
    quantity = (row_data.value->>'quantity')::numeric,
    calculation_inputs = coalesce(o.calculation_inputs, '{}'::jsonb) || jsonb_build_object(
      'quantitySource', 'manual',
      'updatedByUserId', v_actor_user_id::text
    ),
    calculation_outputs = coalesce(o.calculation_outputs, '{}'::jsonb) || jsonb_build_object(
      'lineTotalSnapshot', ((row_data.value->>'quantity')::numeric * coalesce(o.unit_price_snapshot, 0))
    ),
    quantity_source = 'manual',
    updated_at = v_now
  from jsonb_array_elements(coalesce(p_orders, '[]'::jsonb)) as row_data(value)
  where o.workspace_id = p_workspace_id
    and o.encounter_id = p_encounter_id
    and o.id = nullif(row_data.value->>'orderId', '')::uuid
    and o.order_confirmation_status in ('draft', 'pending')
    and length(btrim(row_data.value->>'billingDisplayName')) > 0
    and (row_data.value->>'quantity')::numeric > 0;

  delete from public.orders o
  where o.workspace_id = p_workspace_id
    and o.encounter_id = p_encounter_id
    and o.order_confirmation_status in ('draft', 'pending')
    and o.invoice_line_id is null
    and not exists (
      select 1
      from jsonb_array_elements(coalesce(p_orders, '[]'::jsonb)) as row_data(value)
      where o.id = nullif(row_data.value->>'orderId', '')::uuid
    );

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
    nullif(row_data.value->>'orderId', '')::uuid,
    'edited',
    v_actor_user_id,
    jsonb_build_object(
      'billingDisplayName', btrim(row_data.value->>'billingDisplayName'),
      'quantity', (row_data.value->>'quantity')::numeric
    ),
    v_now
  from jsonb_array_elements(coalesce(p_orders, '[]'::jsonb)) as row_data(value)
  where exists (
    select 1
    from public.orders o
    where o.workspace_id = p_workspace_id
      and o.encounter_id = p_encounter_id
      and o.id = nullif(row_data.value->>'orderId', '')::uuid
  );

  update public.encounters
  set
    status = case when status = 'waiting' then 'ordered' else status end,
    started_at = coalesce(started_at, v_now),
    updated_at = v_now
  where workspace_id = p_workspace_id
    and id = p_encounter_id
    and status <> 'cancelled';

  select public.clair_get_chart_order_draft(p_workspace_id, p_encounter_id)
    into v_order_rows;

  return v_order_rows;
end;
$$;

revoke all on function public.clair_get_chart_order_draft(text, uuid) from public;
revoke all on function public.clair_save_chart_order_draft(text, text, uuid, jsonb) from public;
grant execute on function public.clair_get_chart_order_draft(text, uuid) to authenticated;
grant execute on function public.clair_save_chart_order_draft(text, text, uuid, jsonb) to authenticated;

comment on function public.clair_get_chart_order_draft(text, uuid) is
  'DEN-72 local-first route-owned chart order draft reader scoped by active workspace membership and encounter workspace.';
comment on function public.clair_save_chart_order_draft(text, text, uuid, jsonb) is
  'DEN-72 local-first route-owned chart order draft writer for billing display name, quantity, and draft row deletion.';
