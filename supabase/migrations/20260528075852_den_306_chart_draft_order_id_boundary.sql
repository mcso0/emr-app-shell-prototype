-- DEN-306: keep chart draft order IDs separate from workspace catalog source IDs.
-- Catalog source IDs are text identifiers and must never be cast directly to
-- public.orders.id. Draft order rows use UUIDs; catalog identity is preserved in
-- source_order_id/applied_snapshot.

create or replace function private.clair_safe_uuid(p_value text)
returns uuid
language sql
immutable
as $$
  select case
    when p_value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then p_value::uuid
    else null
  end
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
  v_actor_user_id uuid := private.clair_safe_uuid(p_actor_user_id);
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

  create temporary table if not exists pg_temp.clair_chart_order_draft_input (
    input_index integer not null,
    draft_order_id uuid not null,
    row_value jsonb not null,
    billing_display_name text not null,
    display_name text not null,
    category_group text,
    row_type text not null,
    source_preset_id text,
    source_preset_version text,
    quantity numeric not null,
    unit_price numeric not null,
    task_required boolean not null,
    billing_reflection_enabled boolean not null
  ) on commit drop;

  truncate table pg_temp.clair_chart_order_draft_input;

  insert into pg_temp.clair_chart_order_draft_input (
    input_index,
    draft_order_id,
    row_value,
    billing_display_name,
    display_name,
    category_group,
    row_type,
    source_preset_id,
    source_preset_version,
    quantity,
    unit_price,
    task_required,
    billing_reflection_enabled
  )
  select
    row_number() over (),
    coalesce(private.clair_safe_uuid(row_data.value->>'orderId'), gen_random_uuid()),
    row_data.value,
    btrim(row_data.value->>'billingDisplayName'),
    coalesce(
      nullif(btrim(row_data.value->>'displayName'), ''),
      nullif(btrim(row_data.value->'appliedSnapshot'->>'appliedDisplayName'), ''),
      nullif(btrim(row_data.value->>'billingDisplayName'), '')
    ),
    nullif(row_data.value->>'categoryGroup', ''),
    case when row_data.value->>'rowType' = 'set' then 'set' else 'individual' end,
    nullif(row_data.value->>'sourcePresetId', ''),
    nullif(row_data.value->>'sourcePresetVersion', ''),
    (row_data.value->>'quantity')::numeric,
    greatest(
      0,
      coalesce(
        nullif(row_data.value->>'unitPriceSnapshot', '')::numeric,
        nullif(row_data.value->'appliedSnapshot'->>'appliedPriceKrw', '')::numeric,
        0
      )
    ),
    coalesce((row_data.value->'appliedSnapshot'->>'appliedTaskRequired')::boolean, true),
    coalesce((row_data.value->'appliedSnapshot'->>'billingReflectionEnabled')::boolean, true)
  from jsonb_array_elements(coalesce(p_orders, '[]'::jsonb)) as row_data(value)
  where (
      private.clair_safe_uuid(row_data.value->>'orderId') is not null
      or nullif(row_data.value->>'sourcePresetId', '') is not null
    )
    and length(btrim(row_data.value->>'billingDisplayName')) > 0
    and (row_data.value->>'quantity')::numeric > 0;

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
    input.draft_order_id,
    p_workspace_id,
    p_encounter_id,
    null,
    case
      when input.category_group = 'lab' then 'lab'
      when input.category_group = 'imaging' then 'imaging'
      when input.category_group = 'medication' then 'dispensing'
      else 'treatment'
    end,
    input.display_name,
    input.billing_display_name,
    'requested',
    'pending',
    'normal',
    input.quantity,
    input.unit_price,
    v_actor_user_id,
    v_now,
    nullif(btrim(input.row_value->'appliedSnapshot'->>'appliedInternalInstruction'), ''),
    input.input_index * 10,
    input.row_type,
    input.source_preset_id,
    input.source_preset_version,
    case
      when jsonb_typeof(input.row_value->'appliedSnapshot') = 'object'
        then jsonb_build_object(
          'amountBasis', input.row_value->'appliedSnapshot'->>'appliedAmountBasis',
          'billingName', input.row_value->'appliedSnapshot'->>'appliedBillingName',
          'billingReflectionEnabled', input.billing_reflection_enabled,
          'careGuide', input.row_value->'appliedSnapshot'->>'appliedCareGuide',
          'destinationModule', input.row_value->'appliedSnapshot'->>'appliedDestinationModule',
          'inHospitalOrderName', input.row_value->'appliedSnapshot'->>'appliedDisplayName',
          'internalInstruction', input.row_value->'appliedSnapshot'->>'appliedInternalInstruction',
          'lineTotalSnapshot', input.quantity * input.unit_price,
          'orderType',
          case
            when input.category_group = 'lab' then 'lab'
            when input.category_group = 'imaging' then 'imaging'
            when input.category_group = 'medication' then 'dispensing'
            else 'treatment'
          end,
          'priceKrw', input.unit_price,
          'quantity', input.quantity,
          'rowType', input.row_type,
          'salesUnit', input.row_value->'appliedSnapshot'->>'appliedSalesUnit',
          'sourcePresetId', coalesce(input.row_value->'appliedSnapshot'->>'sourcePresetId', input.source_preset_id),
          'sourcePresetVersion', coalesce(input.row_value->'appliedSnapshot'->>'sourcePresetVersion', input.source_preset_version),
          'standardOrderName', coalesce(input.row_value->'appliedSnapshot'->>'appliedStandardOrderName', input.row_value->'appliedSnapshot'->>'appliedDisplayName'),
          'targetSpecies', coalesce(input.row_value->'appliedSnapshot'->'appliedTargetSpecies', '[]'::jsonb),
          'taskRequired', input.task_required,
          'taxIncluded', coalesce((input.row_value->'appliedSnapshot'->>'appliedTaxIncluded')::boolean, true),
          'workspaceCatalogItemId', input.row_value->'appliedSnapshot'->>'workspaceCatalogItemId'
        )
      else '{}'::jsonb
    end,
    jsonb_build_object(
      'unitPriceSnapshot', input.unit_price,
      'source', case when input.source_preset_id is not null then 'workspace_catalog' else 'chart_draft' end
    ),
    jsonb_build_object(
      'quantitySource', 'manual',
      'updatedByUserId', v_actor_user_id::text,
      'source', case when input.source_preset_id is not null then 'workspace_catalog' else 'chart_draft' end
    ),
    jsonb_build_object('lineTotalSnapshot', input.quantity * input.unit_price),
    'manual',
    case when input.source_preset_id is not null then 'preset_price' else 'manual' end,
    input.billing_reflection_enabled,
    'draft',
    'not_requested',
    case when input.task_required then 'pending' else null end,
    v_now,
    v_now
  from pg_temp.clair_chart_order_draft_input input
  where not exists (
    select 1
    from public.orders existing
    where existing.workspace_id = p_workspace_id
      and existing.encounter_id = p_encounter_id
      and existing.id = input.draft_order_id
  );

  update public.orders o
  set
    billing_display_name = input.billing_display_name,
    display_name = input.display_name,
    quantity = input.quantity,
    unit_price_snapshot = input.unit_price,
    calculation_inputs = coalesce(o.calculation_inputs, '{}'::jsonb) || jsonb_build_object(
      'quantitySource', 'manual',
      'updatedByUserId', v_actor_user_id::text
    ),
    calculation_outputs = coalesce(o.calculation_outputs, '{}'::jsonb) || jsonb_build_object(
      'lineTotalSnapshot', input.quantity * input.unit_price
    ),
    applied_snapshot = case
      when jsonb_typeof(input.row_value->'appliedSnapshot') = 'object'
        then coalesce(o.applied_snapshot, '{}'::jsonb) || jsonb_build_object(
          'amountBasis', input.row_value->'appliedSnapshot'->>'appliedAmountBasis',
          'billingName', input.row_value->'appliedSnapshot'->>'appliedBillingName',
          'billingReflectionEnabled', input.billing_reflection_enabled,
          'careGuide', input.row_value->'appliedSnapshot'->>'appliedCareGuide',
          'destinationModule', input.row_value->'appliedSnapshot'->>'appliedDestinationModule',
          'inHospitalOrderName', input.row_value->'appliedSnapshot'->>'appliedDisplayName',
          'internalInstruction', input.row_value->'appliedSnapshot'->>'appliedInternalInstruction',
          'lineTotalSnapshot', input.quantity * input.unit_price,
          'orderType',
          case
            when input.category_group = 'lab' then 'lab'
            when input.category_group = 'imaging' then 'imaging'
            when input.category_group = 'medication' then 'dispensing'
            else 'treatment'
          end,
          'priceKrw', input.unit_price,
          'quantity', input.quantity,
          'rowType', input.row_type,
          'salesUnit', input.row_value->'appliedSnapshot'->>'appliedSalesUnit',
          'sourcePresetId', coalesce(input.row_value->'appliedSnapshot'->>'sourcePresetId', input.source_preset_id),
          'sourcePresetVersion', coalesce(input.row_value->'appliedSnapshot'->>'sourcePresetVersion', input.source_preset_version),
          'standardOrderName', coalesce(input.row_value->'appliedSnapshot'->>'appliedStandardOrderName', input.row_value->'appliedSnapshot'->>'appliedDisplayName'),
          'targetSpecies', coalesce(input.row_value->'appliedSnapshot'->'appliedTargetSpecies', '[]'::jsonb),
          'taskRequired', input.task_required,
          'taxIncluded', coalesce((input.row_value->'appliedSnapshot'->>'appliedTaxIncluded')::boolean, true),
          'workspaceCatalogItemId', input.row_value->'appliedSnapshot'->>'workspaceCatalogItemId'
        )
      else o.applied_snapshot
    end,
    applied_price_snapshot = case
      when input.source_preset_id is not null then coalesce(o.applied_price_snapshot, '{}'::jsonb) || jsonb_build_object(
        'unitPriceSnapshot', input.unit_price,
        'source', 'workspace_catalog'
      )
      else o.applied_price_snapshot
    end,
    row_type = input.row_type,
    source_order_id = coalesce(input.source_preset_id, o.source_order_id),
    source_order_version = coalesce(input.source_preset_version, o.source_order_version),
    quantity_source = 'manual',
    updated_at = v_now
  from pg_temp.clair_chart_order_draft_input input
  where o.workspace_id = p_workspace_id
    and o.encounter_id = p_encounter_id
    and o.id = input.draft_order_id
    and o.order_confirmation_status in ('draft', 'pending');

  delete from public.orders o
  where o.workspace_id = p_workspace_id
    and o.encounter_id = p_encounter_id
    and o.order_confirmation_status in ('draft', 'pending')
    and o.invoice_line_id is null
    and not exists (
      select 1
      from pg_temp.clair_chart_order_draft_input input
      where input.draft_order_id = o.id
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
    input.draft_order_id,
    'edited',
    v_actor_user_id,
    jsonb_build_object(
      'billingDisplayName', input.billing_display_name,
      'quantity', input.quantity,
      'source', case when input.source_preset_id is not null then 'workspace_catalog' else 'chart_draft' end
    ),
    v_now
  from pg_temp.clair_chart_order_draft_input input
  where exists (
    select 1
    from public.orders o
    where o.workspace_id = p_workspace_id
      and o.encounter_id = p_encounter_id
      and o.id = input.draft_order_id
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

grant execute on function public.clair_save_chart_order_draft(text, text, uuid, jsonb) to authenticated;
