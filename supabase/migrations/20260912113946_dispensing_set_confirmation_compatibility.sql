-- Preserve the immutable B3 set-composition envelope while retaining the
-- independently mutable dispensing calculation and source-lineage contracts.
alter table public.orders
  add column set_pricing_calculation_outputs jsonb not null default '{}'::jsonb,
  add column dispensing_authority_snapshot jsonb not null default '{}'::jsonb,
  add column dispensing_lineage_snapshot jsonb not null default '{}'::jsonb;

alter table public.orders
  add constraint orders_set_pricing_calculation_outputs_object_check
    check (jsonb_typeof(set_pricing_calculation_outputs) = 'object'),
  add constraint orders_dispensing_authority_snapshot_object_check
    check (jsonb_typeof(dispensing_authority_snapshot) = 'object'),
  add constraint orders_dispensing_lineage_snapshot_object_check
    check (jsonb_typeof(dispensing_lineage_snapshot) = 'object');

comment on column public.orders.set_pricing_calculation_outputs is
  'Immutable B3 set-child price calculation envelope. Dispensing execution calculations remain in calculation_outputs.';
comment on column public.orders.dispensing_authority_snapshot is
  'Revision-pinned server-authored planOrderAuthority for a dispensing set child. It is separate from the exact B3 composition snapshot.';
comment on column public.orders.dispensing_lineage_snapshot is
  'Server-authored dispensing lineage. A set child stores the lineage object and its set root stores a revision-item keyed copy map.';

create function private.clair_is_set_pricing_calculation_outputs(p_value jsonb)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $function$
  select jsonb_typeof(p_value) = 'object'
    and (select count(*) from jsonb_object_keys(p_value)) = 9
    and not exists (
      select 1
      from jsonb_object_keys(p_value) key(name)
      where key.name not in (
        'schemaVersion', 'childSubtotalKrw', 'explicitExtraSubtotalKrw',
        'taxAmountKrw', 'finalTotalKrw', 'lineTotalKrw', 'taxType',
        'roundingRule', 'roundingResultKrw'
      )
    );
$function$;

revoke all on function private.clair_is_set_pricing_calculation_outputs(jsonb)
  from public, anon, authenticated, service_role;

create function private.clair_b3_pricing_calculation_outputs(p_order public.orders)
returns jsonb
language sql
stable
set search_path = pg_catalog
as $function$
  select case
    when p_order.row_type = 'set_child'
      then coalesce(
        nullif(p_order.set_pricing_calculation_outputs, '{}'::jsonb),
        p_order.calculation_outputs
      )
    when p_order.row_type = 'set' then p_order.calculation_outputs
    else null
  end;
$function$;

create function private.clair_order_dispensing_authority(p_order public.orders)
returns jsonb
language sql
stable
set search_path = pg_catalog
as $function$
  select case
    when p_order.row_type = 'set_child'
      and p_order.clinical_order_type = 'dispensing'
      then nullif(p_order.dispensing_authority_snapshot, '{}'::jsonb)
    else p_order.applied_snapshot -> 'planOrderAuthority'
  end;
$function$;

create function private.clair_order_dispensing_lineage(p_order public.orders)
returns jsonb
language sql
stable
set search_path = pg_catalog
as $function$
  select case
    when p_order.row_type in ('set', 'set_child')
      then p_order.dispensing_lineage_snapshot
    else p_order.applied_snapshot -> 'dispensingLineage'
  end;
$function$;

revoke all on function private.clair_b3_pricing_calculation_outputs(public.orders),
  private.clair_order_dispensing_authority(public.orders),
  private.clair_order_dispensing_lineage(public.orders)
  from public, anon, authenticated, service_role;

create function private.clair_capture_set_dispensing_contracts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_authority jsonb;
begin
  if tg_op = 'UPDATE'
    and old.order_confirmation_status not in ('draft', 'pending')
    and (
      new.set_pricing_calculation_outputs
        is distinct from old.set_pricing_calculation_outputs
      or new.dispensing_authority_snapshot
        is distinct from old.dispensing_authority_snapshot
      or new.dispensing_lineage_snapshot
        is distinct from old.dispensing_lineage_snapshot
    )
  then
    raise exception 'confirmed_dispensing_set_contract_immutable'
      using errcode = '55000';
  end if;

  if new.row_type = 'set_child'
    and new.applied_snapshot_schema_version = 1
    and private.clair_is_set_pricing_calculation_outputs(
      new.calculation_outputs
    )
  then
    new.set_pricing_calculation_outputs := new.calculation_outputs;
    if new.clinical_order_type = 'dispensing' then
      select catalog.default_detail_inputs -> 'planOrderAuthority'
      into v_authority
      from public.order_catalog_items catalog
      where catalog.workspace_id = new.workspace_id
        and catalog.id = new.workspace_catalog_item_id
        and catalog.catalog_revision = new.workspace_catalog_revision;

      if v_authority is not null
        and not private.clair_plan_order_authority_is_valid(v_authority)
      then
        raise exception 'catalog_authority_invalid' using errcode = '22023';
      end if;
      new.dispensing_authority_snapshot := coalesce(v_authority, '{}'::jsonb);
    end if;
  end if;

  return new;
end;
$function$;

revoke all on function private.clair_capture_set_dispensing_contracts()
  from public, anon, authenticated, service_role;

-- This trigger runs after the execution-contract projection (which assigns the
-- clinical type) and before the existing plan-order projection trigger.
create trigger orders_execution_contract_zz_set_dispensing_capture_trg
before insert or update on public.orders
for each row execute function private.clair_capture_set_dispensing_contracts();

create function private.clair_sync_set_dispensing_lineage_copy(
  p_workspace_id text,
  p_parent_order_id uuid,
  p_revision_item_id uuid,
  p_lineage jsonb,
  p_child_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if p_parent_order_id is null or p_revision_item_id is null then
    raise exception 'dispensing_set_lineage_parent_missing' using errcode = '23514';
  end if;

  update public.orders parent
  set dispensing_lineage_snapshot = case
    when p_child_status = 'cancelled' or p_lineage = '{}'::jsonb
      then coalesce(parent.dispensing_lineage_snapshot, '{}'::jsonb)
        - p_revision_item_id::text
    else jsonb_set(
      coalesce(parent.dispensing_lineage_snapshot, '{}'::jsonb),
      array[p_revision_item_id::text],
      p_lineage,
      true
    )
  end
  where parent.workspace_id = p_workspace_id
    and parent.id = p_parent_order_id
    and parent.row_type = 'set'
    and parent.dispensing_lineage_snapshot is distinct from case
      when p_child_status = 'cancelled' or p_lineage = '{}'::jsonb
        then coalesce(parent.dispensing_lineage_snapshot, '{}'::jsonb)
          - p_revision_item_id::text
      else jsonb_set(
        coalesce(parent.dispensing_lineage_snapshot, '{}'::jsonb),
        array[p_revision_item_id::text],
        p_lineage,
        true
      )
    end;

  if not found and not exists (
    select 1
    from public.orders parent
    where parent.workspace_id = p_workspace_id
      and parent.id = p_parent_order_id
      and parent.row_type = 'set'
  ) then
    raise exception 'dispensing_set_lineage_parent_missing' using errcode = '23514';
  end if;
end;
$function$;

revoke all on function private.clair_sync_set_dispensing_lineage_copy(
  text, uuid, uuid, jsonb, text
) from public, anon, authenticated, service_role;

-- The B3 constraint must validate the composition-price envelope captured
-- before the dispensing projection replaces calculation_outputs.
do $patch_b3_constraint$
declare
  v_definition text;
  v_anchor text := 'new.calculation_outputs';
begin
  v_definition := pg_get_functiondef(
    'private.clair_b3_assert_set_child_lineage()'::regprocedure
  );
  if (
    length(v_definition) - length(replace(v_definition, v_anchor, ''))
  ) / length(v_anchor) <> 31 then
    raise exception 'dispensing_set_b3_constraint_anchor_drift';
  end if;
  execute replace(
    v_definition,
    v_anchor,
    'private.clair_b3_pricing_calculation_outputs(new)'
  );
end;
$patch_b3_constraint$;

-- Keep plan-order authority out of the exact B3 composition object, but feed
-- the revision-pinned server copy to both V1 and V2 calculation paths.
do $patch_dispense_projection$
declare
  v_definition text;
  v_authority_anchor text :=
    'a jsonb:=p_order.applied_snapshot->''planOrderAuthority'';';
  v_existing_anchor text :=
    'result jsonb; existing jsonb:=coalesce(p_order.calculation_outputs,''{}'');';
  v_begin_anchor text := E'begin\n  if a->>''schemaVersion'' is distinct from ''2'' then';
  v_base_call_anchor text :=
    'private.clair_compute_dispense_before_preparation_v2(p_order,p_effective_at)';
begin
  v_definition := pg_get_functiondef(
    'private.clair_compute_plan_order_dispense_projection(public.orders,timestamptz)'::regprocedure
  );
  if (length(v_definition) - length(replace(v_definition, v_authority_anchor, '')))
       / length(v_authority_anchor) <> 1
    or (length(v_definition) - length(replace(v_definition, v_existing_anchor, '')))
       / length(v_existing_anchor) <> 1
    or (length(v_definition) - length(replace(v_definition, v_begin_anchor, '')))
       / length(v_begin_anchor) <> 1
    or (length(v_definition) - length(replace(v_definition, v_base_call_anchor, '')))
       / length(v_base_call_anchor) <> 2
  then
    raise exception 'dispensing_set_projection_anchor_drift';
  end if;

  v_definition := replace(
    v_definition,
    v_authority_anchor,
    'a jsonb:=private.clair_order_dispensing_authority(p_order);'
  );
  v_definition := replace(
    v_definition,
    v_existing_anchor,
    $replacement$result jsonb; existing jsonb:=case
    when private.clair_is_set_pricing_calculation_outputs(p_order.calculation_outputs)
      then '{}'::jsonb
    else coalesce(p_order.calculation_outputs,'{}'::jsonb)
  end;$replacement$
  );
  v_definition := replace(
    v_definition,
    v_begin_anchor,
    $replacement$begin
  scratch.applied_snapshot:=jsonb_set(
    coalesce(scratch.applied_snapshot,'{}'::jsonb),
    '{planOrderAuthority}',
    coalesce(a,'null'::jsonb),
    true
  );
  scratch.calculation_outputs:=existing;
  if a->>'schemaVersion' is distinct from '2' then$replacement$
  );
  v_definition := replace(
    v_definition,
    v_base_call_anchor,
    'private.clair_compute_dispense_before_preparation_v2(scratch,p_effective_at)'
  );
  execute v_definition;
end;
$patch_dispense_projection$;

-- Move master lineage for a B3 child into its dedicated column and atomically
-- maintain a revision-item keyed source copy on the set root.
do $patch_dispensing_lineage$
declare
  v_definition text;
  v_clear_anchor text :=
    '      new.applied_snapshot := coalesce(new.applied_snapshot, ''{}''::jsonb) - ''dispensingLineage'';';
  v_write_anchor text := $anchor$    new.applied_snapshot := coalesce(new.applied_snapshot, '{}'::jsonb)
      || jsonb_build_object('dispensingLineage', v_lineage);
    if new.applied_snapshot_schema_version = 1
      and new.applied_snapshot_sha256 is not null then
      new.applied_snapshot_sha256 := private.clair_b3_sha256(jsonb_build_object(
        'appliedSnapshot', new.applied_snapshot,
        'appliedPriceSnapshot', new.applied_price_snapshot,
        'calculationInputs', new.calculation_inputs,
        'calculationOutputs', new.calculation_outputs
      ));
    end if;$anchor$;
  v_immutable_anchor text := $anchor$  elsif new.applied_snapshot -> 'dispensingLineage'
      is distinct from old.applied_snapshot -> 'dispensingLineage' then$anchor$;
  v_confirmed_anchor text := $anchor$  if new.confirmed_snapshot <> '{}'::jsonb
    and new.confirmed_snapshot -> 'dispensingLineage'
      is distinct from new.applied_snapshot -> 'dispensingLineage' then$anchor$;
begin
  v_definition := pg_get_functiondef(
    'private.clair_set_dispensing_order_lineage()'::regprocedure
  );
  if (length(v_definition) - length(replace(v_definition, v_clear_anchor, '')))
       / length(v_clear_anchor) <> 1
    or (length(v_definition) - length(replace(v_definition, v_write_anchor, '')))
       / length(v_write_anchor) <> 1
    or (length(v_definition) - length(replace(v_definition, v_immutable_anchor, '')))
       / length(v_immutable_anchor) <> 1
    or (length(v_definition) - length(replace(v_definition, v_confirmed_anchor, '')))
       / length(v_confirmed_anchor) <> 1
  then
    raise exception 'dispensing_set_lineage_anchor_drift';
  end if;

  v_definition := replace(v_definition, v_clear_anchor, $replacement$      if new.row_type = 'set_child' then
        new.dispensing_lineage_snapshot := '{}'::jsonb;
        perform private.clair_sync_set_dispensing_lineage_copy(
          new.workspace_id,
          new.parent_chart_order_line_id,
          new.source_set_revision_item_id,
          '{}'::jsonb,
          new.status
        );
      else
        new.applied_snapshot := coalesce(new.applied_snapshot, '{}'::jsonb)
          - 'dispensingLineage';
      end if;$replacement$);

  v_definition := replace(v_definition, v_write_anchor, $replacement$    if new.row_type = 'set_child' then
      new.dispensing_lineage_snapshot := v_lineage;
      perform private.clair_sync_set_dispensing_lineage_copy(
        new.workspace_id,
        new.parent_chart_order_line_id,
        new.source_set_revision_item_id,
        v_lineage,
        new.status
      );
    else
      new.applied_snapshot := coalesce(new.applied_snapshot, '{}'::jsonb)
        || jsonb_build_object('dispensingLineage', v_lineage);
      if new.applied_snapshot_schema_version = 1
        and new.applied_snapshot_sha256 is not null then
        new.applied_snapshot_sha256 := private.clair_b3_sha256(jsonb_build_object(
          'appliedSnapshot', new.applied_snapshot,
          'appliedPriceSnapshot', new.applied_price_snapshot,
          'calculationInputs', new.calculation_inputs,
          'calculationOutputs', new.calculation_outputs
        ));
      end if;
    end if;$replacement$);

  v_definition := replace(v_definition, v_immutable_anchor, $replacement$  elsif (case
      when new.row_type = 'set_child'
        then new.dispensing_lineage_snapshot
          is distinct from old.dispensing_lineage_snapshot
      else new.applied_snapshot -> 'dispensingLineage'
        is distinct from old.applied_snapshot -> 'dispensingLineage'
    end) then$replacement$);

  v_definition := replace(v_definition, v_confirmed_anchor, $replacement$  if new.confirmed_snapshot <> '{}'::jsonb
    and not (
      old.order_confirmation_status in ('draft', 'pending')
      and not (new.confirmed_snapshot ? 'dispensingLineage')
    )
    and new.confirmed_snapshot -> 'dispensingLineage'
      is distinct from private.clair_order_dispensing_lineage(new) then$replacement$);

  execute v_definition;
end;
$patch_dispensing_lineage$;

-- Freeze both source contracts into the same confirmation snapshot consumed by
-- tasks, fulfillment work items, billing candidates, and audit events.
do $patch_confirmation_snapshot$
declare
  v_definition text;
  v_anchor text := $anchor$      'confirmedByUserId', p_actor_user_id,
      'confirmationCommandId', v_command.id
    )$anchor$;
begin
  v_definition := pg_get_functiondef(
    'public.clair_confirm_chart_order_candidates_billing_summary_base(text,uuid,uuid,uuid[],text,text)'::regprocedure
  );
  if (length(v_definition) - length(replace(v_definition, v_anchor, '')))
       / length(v_anchor) <> 1
  then
    raise exception 'dispensing_set_confirmation_snapshot_anchor_drift';
  end if;
  execute replace(v_definition, v_anchor, $replacement$      'confirmedByUserId', p_actor_user_id,
      'confirmationCommandId', v_command.id
    ) || case
      when orders.row_type = 'set_child'
        and orders.clinical_order_type = 'dispensing'
      then jsonb_build_object(
        'setPricingCalculationOutputs',
          private.clair_b3_pricing_calculation_outputs(orders),
        'dispensingAuthoritySnapshot',
          private.clair_order_dispensing_authority(orders),
        'dispensingLineage',
          private.clair_order_dispensing_lineage(orders)
      )
      when orders.row_type = 'set'
        and orders.dispensing_lineage_snapshot <> '{}'::jsonb
      then jsonb_build_object(
        'dispensingLineage', orders.dispensing_lineage_snapshot
      )
      else '{}'::jsonb
    end$replacement$);
end;
$patch_confirmation_snapshot$;

create or replace function private.clair_b3_runtime_row_json(p_order public.orders)
returns jsonb
language sql
stable
set search_path = ''
as $function$
  select private.clair_b3_runtime_row_json_origin_base(p_order)
    || pg_catalog.jsonb_build_object(
      'originChartId', p_order.origin_chart_id,
      'setPricingCalculationOutputs',
        private.clair_b3_pricing_calculation_outputs(p_order),
      'dispensingAuthoritySnapshot',
        private.clair_order_dispensing_authority(p_order),
      'dispensingLineage',
        private.clair_order_dispensing_lineage(p_order)
    );
$function$;

revoke all on function private.clair_b3_runtime_row_json(public.orders)
  from public, anon, authenticated, service_role;

create function private.clair_assert_dispensing_set_contract_copy()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_parent_lineage jsonb;
  v_catalog_has_profile boolean;
begin
  if new.row_type <> 'set_child'
    or new.clinical_order_type <> 'dispensing'
    or new.status = 'cancelled'
  then
    return new;
  end if;

  if not private.clair_is_set_pricing_calculation_outputs(
    new.set_pricing_calculation_outputs
  ) then
    raise exception 'dispensing_set_pricing_snapshot_missing' using errcode = '23514';
  end if;

  select catalog.source_dispensing_profile_id is not null
  into v_catalog_has_profile
  from public.order_catalog_items catalog
  where catalog.workspace_id = new.workspace_id
    and catalog.id = new.workspace_catalog_item_id
    and catalog.catalog_revision = new.workspace_catalog_revision;

  if coalesce(v_catalog_has_profile, false) then
    select parent.dispensing_lineage_snapshot
      -> new.source_set_revision_item_id::text
    into v_parent_lineage
    from public.orders parent
    where parent.workspace_id = new.workspace_id
      and parent.id = new.parent_chart_order_line_id
      and parent.row_type = 'set';

    if new.dispensing_lineage_snapshot = '{}'::jsonb
      or v_parent_lineage is distinct from new.dispensing_lineage_snapshot
    then
      raise exception 'dispensing_set_lineage_copy_mismatch'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$function$;

revoke all on function private.clair_assert_dispensing_set_contract_copy()
  from public, anon, authenticated, service_role;

create constraint trigger orders_dispensing_set_contract_copy_trg
after insert or update on public.orders
deferrable initially deferred
for each row execute function private.clair_assert_dispensing_set_contract_copy();

-- Repair only mutable drafts. Confirmed/billed/completed rows are intentionally
-- untouched; a failed pre-migration dispensing set could not have crossed the
-- existing deferred B3 constraint.
update public.orders orders
set
  set_pricing_calculation_outputs = case
    when private.clair_is_set_pricing_calculation_outputs(
      orders.calculation_outputs
    ) then orders.calculation_outputs
    else jsonb_build_object(
      'schemaVersion', 1,
      'childSubtotalKrw',
        coalesce((orders.applied_price_snapshot ->> 'roundingResultKrw')::numeric, 0),
      'explicitExtraSubtotalKrw', case
        when coalesce((orders.applied_price_snapshot ->> 'explicitExtra')::boolean, false)
          then coalesce((orders.applied_price_snapshot ->> 'roundingResultKrw')::numeric, 0)
        else 0
      end,
      'taxAmountKrw', 0,
      'finalTotalKrw',
        coalesce((orders.applied_price_snapshot ->> 'roundingResultKrw')::numeric, 0),
      'lineTotalKrw',
        coalesce((orders.applied_price_snapshot ->> 'roundingResultKrw')::numeric, 0),
      'taxType', orders.applied_price_snapshot ->> 'taxType',
      'roundingRule', orders.applied_price_snapshot ->> 'roundingRule',
      'roundingResultKrw', orders.applied_price_snapshot -> 'roundingResultKrw'
    )
  end,
  dispensing_authority_snapshot = coalesce(
    catalog.default_detail_inputs -> 'planOrderAuthority',
    '{}'::jsonb
  ),
  applied_snapshot = orders.applied_snapshot - 'dispensingLineage',
  dispensing_lineage_snapshot = coalesce(
    orders.applied_snapshot -> 'dispensingLineage',
    '{}'::jsonb
  ),
  applied_snapshot_sha256 = private.clair_b3_sha256(jsonb_build_object(
    'appliedSnapshot', orders.applied_snapshot - 'dispensingLineage',
    'appliedPriceSnapshot', orders.applied_price_snapshot,
    'calculationInputs', orders.calculation_inputs,
    'calculationOutputs', case
      when private.clair_is_set_pricing_calculation_outputs(
        orders.calculation_outputs
      ) then orders.calculation_outputs
      else jsonb_build_object(
        'schemaVersion', 1,
        'childSubtotalKrw',
          coalesce((orders.applied_price_snapshot ->> 'roundingResultKrw')::numeric, 0),
        'explicitExtraSubtotalKrw', case
          when coalesce((orders.applied_price_snapshot ->> 'explicitExtra')::boolean, false)
            then coalesce((orders.applied_price_snapshot ->> 'roundingResultKrw')::numeric, 0)
          else 0
        end,
        'taxAmountKrw', 0,
        'finalTotalKrw',
          coalesce((orders.applied_price_snapshot ->> 'roundingResultKrw')::numeric, 0),
        'lineTotalKrw',
          coalesce((orders.applied_price_snapshot ->> 'roundingResultKrw')::numeric, 0),
        'taxType', orders.applied_price_snapshot ->> 'taxType',
        'roundingRule', orders.applied_price_snapshot ->> 'roundingRule',
        'roundingResultKrw', orders.applied_price_snapshot -> 'roundingResultKrw'
      )
    end
  ))
from public.order_catalog_items catalog
where orders.workspace_id = catalog.workspace_id
  and orders.workspace_catalog_item_id = catalog.id
  and orders.workspace_catalog_revision = catalog.catalog_revision
  and orders.row_type = 'set_child'
  and orders.clinical_order_type = 'dispensing'
  and orders.status <> 'cancelled'
  and orders.order_confirmation_status in ('draft', 'pending');

-- Rebuild the root copy map after the mutable-child repair. This is a single
-- statement in the same migration transaction as the child snapshot move.
update public.orders parent
set dispensing_lineage_snapshot = child.lineage_map
from (
  select child.workspace_id,
    child.parent_chart_order_line_id,
    jsonb_object_agg(
      child.source_set_revision_item_id::text,
      child.dispensing_lineage_snapshot
    ) filter (where child.dispensing_lineage_snapshot <> '{}'::jsonb) as lineage_map
  from public.orders child
  where child.row_type = 'set_child'
    and child.clinical_order_type = 'dispensing'
    and child.status <> 'cancelled'
    and child.order_confirmation_status in ('draft', 'pending')
  group by child.workspace_id, child.parent_chart_order_line_id
) child
where parent.workspace_id = child.workspace_id
  and parent.id = child.parent_chart_order_line_id
  and parent.row_type = 'set'
  and child.lineage_map is not null;
