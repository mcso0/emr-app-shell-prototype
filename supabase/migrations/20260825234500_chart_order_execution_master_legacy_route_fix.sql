-- Phase 1 forward-fix: some historical individual Orders predate a durable
-- workspace catalog link. Their existing fulfillment projection is the
-- canonical execution evidence; names remain explicitly excluded from routing.

set lock_timeout = '5s';
set statement_timeout = '120s';

update public.orders orders
set
  destination_module = case queue.queue_type
    when 'lab' then 'lab'
    when 'imaging' then 'imaging'
    when 'dispensing' then 'dispensing'
    when 'treatment' then 'treatment'
    else null
  end,
  execution_mode = case
    when queue.queue_type in ('lab','imaging','dispensing','treatment')
      then 'routed'
    else orders.execution_mode
  end
from public.order_fulfillment_work_items queue
where queue.workspace_id = orders.workspace_id
  and queue.order_id = orders.id
  and orders.row_type in ('individual','set_child')
  and queue.queue_type in ('lab','imaging','dispensing','treatment')
  and (
    orders.destination_module is distinct from queue.queue_type
    or orders.execution_mode <> 'routed'
  );

-- Catalog routing is the second durable source for rows that have no legacy
-- projection yet. billing_only/chart_only stay destinationless.
update public.orders orders
set
  destination_module = catalog.destination_module,
  execution_mode = catalog.execution_mode
from public.order_catalog_items catalog
where catalog.workspace_id = orders.workspace_id
  and catalog.id = orders.workspace_catalog_item_id
  and orders.row_type in ('individual','set_child')
  and not exists (
    select 1
    from public.order_fulfillment_work_items queue
    where queue.workspace_id = orders.workspace_id
      and queue.order_id = orders.id
  )
  and (
    orders.destination_module is distinct from catalog.destination_module
    or orders.execution_mode is distinct from catalog.execution_mode
  );

-- Snapshot correction is safe here because the immutable-snapshot trigger is
-- introduced later in Phase 5. It freezes only durable canonical fields.
update public.orders orders
set confirmed_snapshot = orders.confirmed_snapshot || jsonb_build_object(
  'clinicalOrderType', orders.clinical_order_type,
  'destinationModule', orders.destination_module,
  'executionMode', orders.execution_mode,
  'detailInputs', orders.detail_inputs,
  'detailSchemaVersion', orders.detail_schema_version,
  'priority', case when orders.priority = 'urgent' then 'urgent' else 'normal' end,
  'legacyClassification', case
    when orders.destination_module is null then 'destinationless'
    when exists (
      select 1
      from public.order_fulfillment_work_items queue
      where queue.workspace_id = orders.workspace_id
        and queue.order_id = orders.id
    ) then 'durable_queue_projection'
    else 'workspace_catalog_contract'
  end
)
where orders.order_confirmation_status in ('confirmed','billed')
  and orders.row_type in ('individual','set_child');

do $postcondition$
declare
  v_invalid_count bigint;
begin
  select count(*) into v_invalid_count
  from public.order_fulfillment_work_items queue
  join public.orders orders
    on orders.workspace_id = queue.workspace_id
   and orders.id = queue.order_id
  where orders.order_confirmation_status in ('confirmed','billed')
    and orders.row_type in ('individual','set_child')
    and (
      orders.destination_module is distinct from queue.queue_type
      or orders.execution_mode <> 'routed'
      or orders.confirmed_snapshot ->> 'destinationModule'
        is distinct from queue.queue_type
    );

  if v_invalid_count > 0 then
    raise exception 'legacy_queue_route_reconciliation_invalid:%', v_invalid_count
      using errcode = '23514';
  end if;
end;
$postcondition$;
