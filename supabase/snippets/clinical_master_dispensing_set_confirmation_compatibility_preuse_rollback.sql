-- PRE-USE ONLY rollback for
-- 20260912113946_dispensing_set_confirmation_compatibility.sql.
--
-- Run only as a separately approved forward recovery migration after the
-- candidate migration has applied and before any row has adopted one of the
-- three new snapshots. The first locked guard fails closed when rollback is
-- no longer safe. After any candidate write, keep the additive schema and ship
-- a reviewed forward fix instead.

begin;

lock table public.orders in access exclusive mode;

do $preuse_guard$
begin
  if to_regprocedure(
    'private.clair_is_set_pricing_calculation_outputs(jsonb)'
  ) is null
    or not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'orders'
        and column_name = 'set_pricing_calculation_outputs'
    )
    or not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'orders'
        and column_name = 'dispensing_authority_snapshot'
    )
    or not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'orders'
        and column_name = 'dispensing_lineage_snapshot'
    )
  then
    raise exception 'dispensing_set_compatibility_rollback_source_missing';
  end if;

  if exists (
    select 1
    from public.orders
    where set_pricing_calculation_outputs <> '{}'::jsonb
      or dispensing_authority_snapshot <> '{}'::jsonb
      or dispensing_lineage_snapshot <> '{}'::jsonb
  ) then
    raise exception 'dispensing_set_compatibility_rollback_after_use_denied'
      using errcode = '55000';
  end if;
end;
$preuse_guard$;

drop trigger orders_execution_contract_zz_set_dispensing_capture_trg
  on public.orders;
drop trigger orders_zz_dispensing_set_lineage_copy_trg on public.orders;
drop trigger orders_dispensing_set_contract_copy_trg on public.orders;

do $restore_b3_writer_conflict_update$
declare
  v_definition text;
  v_anchor text := $anchor$calculation_outputs = case
          when excluded.row_type = 'set_child'
            and excluded.clinical_order_type = 'dispensing'
            and not private.clair_is_set_pricing_calculation_outputs(
              orders.calculation_outputs
            )
            then orders.calculation_outputs
          else excluded.calculation_outputs
        end,
        set_pricing_calculation_outputs = case
          when excluded.row_type = 'set_child'
            then excluded.set_pricing_calculation_outputs
          else orders.set_pricing_calculation_outputs
        end,
        dispensing_authority_snapshot = case
          when excluded.row_type = 'set_child'
            then excluded.dispensing_authority_snapshot
          else orders.dispensing_authority_snapshot
        end,
        dispensing_lineage_snapshot = case
          when excluded.row_type = 'set_child'
            then excluded.dispensing_lineage_snapshot
          else orders.dispensing_lineage_snapshot
        end,$anchor$;
begin
  v_definition := pg_get_functiondef(
    'public.clair_save_chart_order_draft_phase2_base(text,text,uuid,jsonb)'::regprocedure
  );
  if (length(v_definition) - length(replace(v_definition, v_anchor, '')))
       / length(v_anchor) <> 3
  then
    raise exception 'dispensing_set_compatibility_rollback_writer_drift';
  end if;
  execute replace(
    v_definition,
    v_anchor,
    'calculation_outputs = excluded.calculation_outputs,'
  );
end;
$restore_b3_writer_conflict_update$;

do $restore_b3_constraint$
declare
  v_definition text;
  v_anchor text := 'private.clair_b3_pricing_calculation_outputs(new)';
begin
  v_definition := pg_get_functiondef(
    'private.clair_b3_assert_set_child_lineage()'::regprocedure
  );
  if (length(v_definition) - length(replace(v_definition, v_anchor, '')))
       / length(v_anchor) <> 31
  then
    raise exception 'dispensing_set_compatibility_rollback_b3_drift';
  end if;
  execute replace(v_definition, v_anchor, 'new.calculation_outputs');
end;
$restore_b3_constraint$;

do $restore_dispense_projection$
declare
  v_definition text;
  v_authority_anchor text :=
    'a jsonb:=private.clair_order_dispensing_authority(p_order);';
  v_existing_anchor text := $anchor$result jsonb; existing jsonb:=case
    when private.clair_is_set_pricing_calculation_outputs(p_order.calculation_outputs)
      then '{}'::jsonb
    else coalesce(p_order.calculation_outputs,'{}'::jsonb)
  end;$anchor$;
  v_begin_anchor text := $anchor$begin
  scratch.applied_snapshot:=jsonb_set(
    coalesce(scratch.applied_snapshot,'{}'::jsonb),
    '{planOrderAuthority}',
    coalesce(a,'null'::jsonb),
    true
  );
  scratch.calculation_outputs:=existing;
  if a->>'schemaVersion' is distinct from '2' then$anchor$;
  v_base_call_anchor text :=
    'return private.clair_compute_dispense_before_preparation_v2(scratch,p_effective_at)';
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
    raise exception 'dispensing_set_compatibility_rollback_projection_drift';
  end if;

  v_definition := replace(
    v_definition,
    v_authority_anchor,
    'a jsonb:=p_order.applied_snapshot->''planOrderAuthority'';'
  );
  v_definition := replace(
    v_definition,
    v_existing_anchor,
    'result jsonb; existing jsonb:=coalesce(p_order.calculation_outputs,''{}'');'
  );
  v_definition := replace(
    v_definition,
    v_begin_anchor,
    E'begin\n  if a->>''schemaVersion'' is distinct from ''2'' then'
  );
  v_definition := replace(
    v_definition,
    v_base_call_anchor,
    'return private.clair_compute_dispense_before_preparation_v2(p_order,p_effective_at)'
  );
  execute v_definition;
end;
$restore_dispense_projection$;

do $restore_dispensing_lineage$
declare
  v_definition text;
  v_clear_anchor text := $anchor$      if new.row_type = 'set_child' then
        new.dispensing_lineage_snapshot := '{}'::jsonb;
      else
        new.applied_snapshot := coalesce(new.applied_snapshot, '{}'::jsonb)
          - 'dispensingLineage';
      end if;$anchor$;
  v_write_anchor text := $anchor$    if new.row_type = 'set_child' then
      new.dispensing_lineage_snapshot := v_lineage;
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
    end if;$anchor$;
  v_immutable_anchor text := $anchor$  elsif (case
      when new.row_type = 'set_child'
        then new.dispensing_lineage_snapshot
          is distinct from old.dispensing_lineage_snapshot
      else new.applied_snapshot -> 'dispensingLineage'
        is distinct from old.applied_snapshot -> 'dispensingLineage'
    end) then$anchor$;
  v_confirmed_anchor text := $anchor$  if new.confirmed_snapshot <> '{}'::jsonb
    and not (
      old.order_confirmation_status in ('draft', 'pending')
      and not (new.confirmed_snapshot ? 'dispensingLineage')
    )
    and new.confirmed_snapshot -> 'dispensingLineage'
      is distinct from private.clair_order_dispensing_lineage(new) then$anchor$;
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
    raise exception 'dispensing_set_compatibility_rollback_lineage_drift';
  end if;

  v_definition := replace(
    v_definition,
    v_clear_anchor,
    '      new.applied_snapshot := coalesce(new.applied_snapshot, ''{}''::jsonb) - ''dispensingLineage'';'
  );
  v_definition := replace(v_definition, v_write_anchor, $replacement$    new.applied_snapshot := coalesce(new.applied_snapshot, '{}'::jsonb)
      || jsonb_build_object('dispensingLineage', v_lineage);
    if new.applied_snapshot_schema_version = 1
      and new.applied_snapshot_sha256 is not null then
      new.applied_snapshot_sha256 := private.clair_b3_sha256(jsonb_build_object(
        'appliedSnapshot', new.applied_snapshot,
        'appliedPriceSnapshot', new.applied_price_snapshot,
        'calculationInputs', new.calculation_inputs,
        'calculationOutputs', new.calculation_outputs
      ));
    end if;$replacement$);
  v_definition := replace(v_definition, v_immutable_anchor, $replacement$  elsif new.applied_snapshot -> 'dispensingLineage'
      is distinct from old.applied_snapshot -> 'dispensingLineage' then$replacement$);
  v_definition := replace(v_definition, v_confirmed_anchor, $replacement$  if new.confirmed_snapshot <> '{}'::jsonb
    and new.confirmed_snapshot -> 'dispensingLineage'
      is distinct from new.applied_snapshot -> 'dispensingLineage' then$replacement$);
  execute v_definition;
end;
$restore_dispensing_lineage$;

do $restore_confirmation_snapshot$
declare
  v_definition text;
  v_anchor text := $anchor$      'confirmedByUserId', p_actor_user_id,
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
    end$anchor$;
  v_replacement text := $replacement$      'confirmedByUserId', p_actor_user_id,
      'confirmationCommandId', v_command.id
    )$replacement$;
begin
  v_definition := pg_get_functiondef(
    'public.clair_confirm_chart_order_candidates_billing_summary_base(text,uuid,uuid,uuid[],text,text)'::regprocedure
  );
  if (length(v_definition) - length(replace(v_definition, v_anchor, '')))
       / length(v_anchor) <> 1
  then
    raise exception 'dispensing_set_compatibility_rollback_confirmation_drift';
  end if;
  execute replace(v_definition, v_anchor, v_replacement);
end;
$restore_confirmation_snapshot$;

create or replace function private.clair_snapshot_order_billing_authority()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_authority jsonb := coalesce(
    new.source_snapshot -> 'planOrderAuthority',
    new.source_snapshot #> '{appliedSnapshot,planOrderAuthority}',
    '{}'::jsonb
  );
  v_legacy_amount_basis text := coalesce(
    nullif(new.source_snapshot ->> 'appliedAmountBasis', ''),
    nullif(new.source_snapshot ->> 'amountBasis', '')
  );
begin
  new.price_basis_snapshot := coalesce(
    new.price_basis_snapshot,
    nullif(v_authority ->> 'priceBasis', ''),
    case v_legacy_amount_basis
      when 'fixed_order_price' then 'per_order'
      when 'per_frequency' then 'per_administration'
      when 'per_kg' then 'per_kg'
      when 'set_fixed_price' then 'fixed_set'
      else null
    end
  );
  new.billing_unit_snapshot := coalesce(
    new.billing_unit_snapshot,
    nullif(v_authority ->> 'billingUnit', '')
  );
  new.tax_class_snapshot := coalesce(
    new.tax_class_snapshot,
    nullif(v_authority ->> 'taxClass', ''),
    nullif(new.source_snapshot ->> 'taxType', '')
  );
  new.set_billing_owner_snapshot := coalesce(
    new.set_billing_owner_snapshot,
    nullif(v_authority ->> 'setBillingOwner', '')
  );
  new.set_amount_strategy_snapshot := coalesce(
    new.set_amount_strategy_snapshot,
    nullif(v_authority ->> 'setAmountStrategy', '')
  );
  return new;
end;
$function$;

do $restore_confirmation_billing_authority$
declare
  v_definition text;
  v_anchor text :=
    'private.clair_order_dispensing_authority(orders) ->> ''priceBasis''';
begin
  v_definition := pg_get_functiondef(
    'public.clair_confirm_chart_order_candidates_origin_base(text,uuid,uuid,uuid[],text,text)'::regprocedure
  );
  if (length(v_definition) - length(replace(v_definition, v_anchor, '')))
       / length(v_anchor) <> 4
  then
    raise exception 'dispensing_set_compatibility_rollback_billing_drift';
  end if;
  execute replace(
    v_definition,
    v_anchor,
    'orders.applied_snapshot #>> ''{planOrderAuthority,priceBasis}'''
  );
end;
$restore_confirmation_billing_authority$;

create or replace function private.clair_b3_runtime_row_json(
  p_order public.orders
)
returns jsonb
language sql
stable
set search_path = ''
as $function$
  select private.clair_b3_runtime_row_json_origin_base(p_order)
    || pg_catalog.jsonb_build_object('originChartId',p_order.origin_chart_id);
$function$;

drop function private.clair_assert_dispensing_set_contract_copy();
drop function private.clair_sync_set_dispensing_lineage_after();
drop function private.clair_sync_set_dispensing_lineage_copy(
  text, uuid, uuid, jsonb, text
);
drop function private.clair_capture_set_dispensing_contracts();
drop function private.clair_order_dispensing_lineage(public.orders);
drop function private.clair_order_dispensing_authority(public.orders);
drop function private.clair_b3_pricing_calculation_outputs(public.orders);
drop function private.clair_is_set_pricing_calculation_outputs(jsonb);

alter table public.orders
  drop constraint orders_set_pricing_calculation_outputs_object_check,
  drop constraint orders_dispensing_authority_snapshot_object_check,
  drop constraint orders_dispensing_lineage_snapshot_object_check,
  drop column set_pricing_calculation_outputs,
  drop column dispensing_authority_snapshot,
  drop column dispensing_lineage_snapshot;

do $rollback_postcondition$
begin
  if to_regprocedure(
    'private.clair_is_set_pricing_calculation_outputs(jsonb)'
  ) is not null
    or exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'orders'
        and column_name in (
          'set_pricing_calculation_outputs',
          'dispensing_authority_snapshot',
          'dispensing_lineage_snapshot'
        )
    )
  then
    raise exception 'dispensing_set_compatibility_rollback_incomplete';
  end if;
end;
$rollback_postcondition$;

commit;
