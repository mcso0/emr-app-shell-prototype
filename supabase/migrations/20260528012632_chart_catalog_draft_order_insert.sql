-- DEN-304: allow workspace catalog candidates to become live chart draft orders.
-- This keeps the source catalog item editable in hospital admin while storing a
-- chart-order snapshot at the moment the candidate is added to the encounter.

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
        'appliedSnapshot', nullif(o.applied_snapshot, '{}'::jsonb),
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

  insert into public.orders (
    id,
    workspace_id,
    encounter_id,
    service_item_id,
    order_type,
    display_name,
    billing_display_name,
    status,
    work_status,
    priority,
    quantity,
    unit_price_snapshot,
    requested_by_user_id,
    requested_at,
    instruction,
    sort_order,
    row_type,
    source_order_id,
    source_order_version,
    applied_snapshot,
    applied_price_snapshot,
    calculation_inputs,
    calculation_outputs,
    quantity_source,
    price_rule_source,
    billing_reflection_enabled,
    order_confirmation_status,
    billing_candidate_status,
    task_status,
    created_at,
    updated_at
  )
  select
    nullif(row_data.value->>'orderId', '')::uuid,
    p_workspace_id,
    p_encounter_id,
    null,
    case
      when row_data.value->>'categoryGroup' = 'lab' then 'lab'
      when row_data.value->>'categoryGroup' = 'imaging' then 'imaging'
      when row_data.value->>'categoryGroup' = 'medication' then 'dispensing'
      else 'treatment'
    end,
    coalesce(
      nullif(btrim(row_data.value->>'displayName'), ''),
      nullif(btrim(row_data.value->'appliedSnapshot'->>'appliedDisplayName'), ''),
      nullif(btrim(row_data.value->>'billingDisplayName'), '')
    ),
    btrim(row_data.value->>'billingDisplayName'),
    'requested',
    'pending',
    'normal',
    (row_data.value->>'quantity')::numeric,
    greatest(
      0,
      coalesce(
        nullif(row_data.value->>'unitPriceSnapshot', '')::numeric,
        nullif(row_data.value->'appliedSnapshot'->>'appliedPriceKrw', '')::numeric,
        0
      )
    ),
    v_actor_user_id,
    v_now,
    nullif(btrim(row_data.value->'appliedSnapshot'->>'appliedInternalInstruction'), ''),
    (row_number() over () * 10),
    case when row_data.value->>'rowType' = 'set' then 'set' else 'individual' end,
    nullif(row_data.value->>'sourcePresetId', ''),
    nullif(row_data.value->>'sourcePresetVersion', ''),
    case
      when jsonb_typeof(row_data.value->'appliedSnapshot') = 'object'
        then jsonb_build_object(
          'amountBasis', row_data.value->'appliedSnapshot'->>'appliedAmountBasis',
          'billingName', row_data.value->'appliedSnapshot'->>'appliedBillingName',
          'billingReflectionEnabled', coalesce((row_data.value->'appliedSnapshot'->>'billingReflectionEnabled')::boolean, true),
          'careGuide', row_data.value->'appliedSnapshot'->>'appliedCareGuide',
          'destinationModule', row_data.value->'appliedSnapshot'->>'appliedDestinationModule',
          'inHospitalOrderName', row_data.value->'appliedSnapshot'->>'appliedDisplayName',
          'internalInstruction', row_data.value->'appliedSnapshot'->>'appliedInternalInstruction',
          'lineTotalSnapshot',
          (
            (row_data.value->>'quantity')::numeric *
            greatest(
              0,
              coalesce(
                nullif(row_data.value->>'unitPriceSnapshot', '')::numeric,
                nullif(row_data.value->'appliedSnapshot'->>'appliedPriceKrw', '')::numeric,
                0
              )
            )
          ),
          'orderType',
          case
            when row_data.value->>'categoryGroup' = 'lab' then 'lab'
            when row_data.value->>'categoryGroup' = 'imaging' then 'imaging'
            when row_data.value->>'categoryGroup' = 'medication' then 'dispensing'
            else 'treatment'
          end,
          'priceKrw',
          greatest(
            0,
            coalesce(
              nullif(row_data.value->>'unitPriceSnapshot', '')::numeric,
              nullif(row_data.value->'appliedSnapshot'->>'appliedPriceKrw', '')::numeric,
              0
            )
          ),
          'quantity', (row_data.value->>'quantity')::numeric,
          'rowType', 'individual',
          'salesUnit', row_data.value->'appliedSnapshot'->>'appliedSalesUnit',
          'sourcePresetId', coalesce(row_data.value->'appliedSnapshot'->>'sourcePresetId', row_data.value->>'sourcePresetId'),
          'sourcePresetVersion', coalesce(row_data.value->'appliedSnapshot'->>'sourcePresetVersion', row_data.value->>'sourcePresetVersion'),
          'standardOrderName', coalesce(row_data.value->'appliedSnapshot'->>'appliedStandardOrderName', row_data.value->'appliedSnapshot'->>'appliedDisplayName'),
          'targetSpecies', coalesce(row_data.value->'appliedSnapshot'->'appliedTargetSpecies', '[]'::jsonb),
          'taskRequired', coalesce((row_data.value->'appliedSnapshot'->>'appliedTaskRequired')::boolean, true),
          'taxIncluded', coalesce((row_data.value->'appliedSnapshot'->>'appliedTaxIncluded')::boolean, true),
          'workspaceCatalogItemId', row_data.value->'appliedSnapshot'->>'workspaceCatalogItemId'
        )
      else '{}'::jsonb
    end,
    jsonb_build_object(
      'unitPriceSnapshot', greatest(
        0,
        coalesce(
          nullif(row_data.value->>'unitPriceSnapshot', '')::numeric,
          nullif(row_data.value->'appliedSnapshot'->>'appliedPriceKrw', '')::numeric,
          0
        )
      ),
      'source', 'workspace_catalog'
    ),
    jsonb_build_object(
      'quantitySource', 'manual',
      'updatedByUserId', v_actor_user_id::text,
      'source', 'workspace_catalog'
    ),
    jsonb_build_object(
      'lineTotalSnapshot',
      (
        (row_data.value->>'quantity')::numeric *
        greatest(
          0,
          coalesce(
            nullif(row_data.value->>'unitPriceSnapshot', '')::numeric,
            nullif(row_data.value->'appliedSnapshot'->>'appliedPriceKrw', '')::numeric,
            0
          )
        )
      )
    ),
    'manual',
    case when row_data.value ? 'sourcePresetId' then 'preset_price' else 'manual' end,
    coalesce((row_data.value->'appliedSnapshot'->>'billingReflectionEnabled')::boolean, true),
    'draft',
    'not_requested',
    case
      when coalesce((row_data.value->'appliedSnapshot'->>'appliedTaskRequired')::boolean, true)
        then 'pending'
      else null
    end,
    v_now,
    v_now
  from jsonb_array_elements(coalesce(p_orders, '[]'::jsonb)) as row_data(value)
  where nullif(row_data.value->>'orderId', '') is not null
    and length(btrim(row_data.value->>'billingDisplayName')) > 0
    and (row_data.value->>'quantity')::numeric > 0
    and not exists (
      select 1
      from public.orders existing
      where existing.workspace_id = p_workspace_id
        and existing.encounter_id = p_encounter_id
        and existing.id = nullif(row_data.value->>'orderId', '')::uuid
    );

  update public.orders o
  set
    billing_display_name = btrim(row_data.value->>'billingDisplayName'),
    display_name = coalesce(nullif(btrim(row_data.value->>'displayName'), ''), o.display_name),
    quantity = (row_data.value->>'quantity')::numeric,
    unit_price_snapshot = greatest(
      0,
      coalesce(
        nullif(row_data.value->>'unitPriceSnapshot', '')::numeric,
        nullif(row_data.value->'appliedSnapshot'->>'appliedPriceKrw', '')::numeric,
        o.unit_price_snapshot,
        0
      )
    ),
    calculation_inputs = coalesce(o.calculation_inputs, '{}'::jsonb) || jsonb_build_object(
      'quantitySource', 'manual',
      'updatedByUserId', v_actor_user_id::text
    ),
    calculation_outputs = coalesce(o.calculation_outputs, '{}'::jsonb) || jsonb_build_object(
      'lineTotalSnapshot',
      (
        (row_data.value->>'quantity')::numeric *
        greatest(
          0,
          coalesce(
            nullif(row_data.value->>'unitPriceSnapshot', '')::numeric,
            nullif(row_data.value->'appliedSnapshot'->>'appliedPriceKrw', '')::numeric,
            o.unit_price_snapshot,
            0
          )
        )
      )
    ),
    applied_snapshot = case
      when jsonb_typeof(row_data.value->'appliedSnapshot') = 'object'
        then jsonb_build_object(
          'amountBasis', row_data.value->'appliedSnapshot'->>'appliedAmountBasis',
          'billingName', row_data.value->'appliedSnapshot'->>'appliedBillingName',
          'billingReflectionEnabled', coalesce((row_data.value->'appliedSnapshot'->>'billingReflectionEnabled')::boolean, true),
          'careGuide', row_data.value->'appliedSnapshot'->>'appliedCareGuide',
          'destinationModule', row_data.value->'appliedSnapshot'->>'appliedDestinationModule',
          'inHospitalOrderName', row_data.value->'appliedSnapshot'->>'appliedDisplayName',
          'internalInstruction', row_data.value->'appliedSnapshot'->>'appliedInternalInstruction',
          'lineTotalSnapshot',
          (
            (row_data.value->>'quantity')::numeric *
            greatest(
              0,
              coalesce(
                nullif(row_data.value->>'unitPriceSnapshot', '')::numeric,
                nullif(row_data.value->'appliedSnapshot'->>'appliedPriceKrw', '')::numeric,
                o.unit_price_snapshot,
                0
              )
            )
          ),
          'orderType',
          case
            when row_data.value->>'categoryGroup' = 'lab' then 'lab'
            when row_data.value->>'categoryGroup' = 'imaging' then 'imaging'
            when row_data.value->>'categoryGroup' = 'medication' then 'dispensing'
            else 'treatment'
          end,
          'priceKrw',
          greatest(
            0,
            coalesce(
              nullif(row_data.value->>'unitPriceSnapshot', '')::numeric,
              nullif(row_data.value->'appliedSnapshot'->>'appliedPriceKrw', '')::numeric,
              o.unit_price_snapshot,
              0
            )
          ),
          'quantity', (row_data.value->>'quantity')::numeric,
          'rowType', 'individual',
          'salesUnit', row_data.value->'appliedSnapshot'->>'appliedSalesUnit',
          'sourcePresetId', coalesce(row_data.value->'appliedSnapshot'->>'sourcePresetId', row_data.value->>'sourcePresetId'),
          'sourcePresetVersion', coalesce(row_data.value->'appliedSnapshot'->>'sourcePresetVersion', row_data.value->>'sourcePresetVersion'),
          'standardOrderName', coalesce(row_data.value->'appliedSnapshot'->>'appliedStandardOrderName', row_data.value->'appliedSnapshot'->>'appliedDisplayName'),
          'targetSpecies', coalesce(row_data.value->'appliedSnapshot'->'appliedTargetSpecies', '[]'::jsonb),
          'taskRequired', coalesce((row_data.value->'appliedSnapshot'->>'appliedTaskRequired')::boolean, true),
          'taxIncluded', coalesce((row_data.value->'appliedSnapshot'->>'appliedTaxIncluded')::boolean, true),
          'workspaceCatalogItemId', row_data.value->'appliedSnapshot'->>'workspaceCatalogItemId'
        )
      else o.applied_snapshot
    end,
    applied_price_snapshot = case
      when row_data.value ? 'sourcePresetId' then coalesce(o.applied_price_snapshot, '{}'::jsonb) || jsonb_build_object(
        'unitPriceSnapshot',
        greatest(
          0,
          coalesce(
            nullif(row_data.value->>'unitPriceSnapshot', '')::numeric,
            nullif(row_data.value->'appliedSnapshot'->>'appliedPriceKrw', '')::numeric,
            o.unit_price_snapshot,
            0
          )
        ),
        'source',
        'workspace_catalog'
      )
      else o.applied_price_snapshot
    end,
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
      'quantity', (row_data.value->>'quantity')::numeric,
      'source', case when row_data.value ? 'sourcePresetId' then 'workspace_catalog' else 'chart_draft' end
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

create or replace function public.clair_get_chart_order_actions(
  p_workspace_id text,
  p_encounter_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
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

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'appliedSnapshot', nullif(o.applied_snapshot, '{}'::jsonb),
        'billingCandidateId', o.billing_candidate_id,
        'billingCandidateStatus', o.billing_candidate_status,
        'confirmedAt', o.confirmed_at,
        'confirmedByUserId', o.confirmed_by_user_id,
        'encounterId', o.encounter_id,
        'orderConfirmationStatus', o.order_confirmation_status,
        'orderId', o.id,
        'status', o.status,
        'updatedAt', o.updated_at
      )
      order by o.sort_order, o.created_at, o.id
    ),
    '[]'::jsonb
  )
  into v_rows
  from public.orders o
  where o.workspace_id = p_workspace_id
    and o.encounter_id = p_encounter_id
    and o.status <> 'cancelled';

  return v_rows;
end;
$$;

revoke all on function public.clair_get_chart_order_draft(text, uuid) from public;
revoke all on function public.clair_save_chart_order_draft(text, text, uuid, jsonb) from public;
revoke all on function public.clair_get_chart_order_actions(text, uuid) from public;

grant execute on function public.clair_get_chart_order_draft(text, uuid) to authenticated;
grant execute on function public.clair_save_chart_order_draft(text, text, uuid, jsonb) to authenticated;
grant execute on function public.clair_get_chart_order_actions(text, uuid) to authenticated;

comment on function public.clair_save_chart_order_draft(text, text, uuid, jsonb) is
  'DEN-304 chart order draft writer that can insert workspace catalog candidates as live encounter orders.';
