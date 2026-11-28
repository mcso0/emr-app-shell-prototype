-- CLINICAL-BILLING-PR-025. Let a parent-billed order set reach an invoice.
--
-- A set that is billed as one parent line keeps its pricing in
-- orders.applied_price_snapshot (amountBasis, taxType, billedAs). The candidate
-- trigger only read plan-order authority from the candidate source snapshot, so
-- the parent candidate kept null price basis, billing unit, tax class and set
-- owner, and clair_request_selected_chart_order_billing raised
-- billing_authority_incomplete for every fixed-price set.
--
-- This re-creates the trigger function with one extra, lowest-priority source:
-- the set order's own applied price snapshot. Explicit plan-order authority and
-- the legacy amount basis still win. A set whose tax type is not a concrete
-- class (for example "derived") keeps a null tax class and stays blocked.
-- Existing candidates are not rewritten; their snapshots are immutable.

create or replace function private.clair_snapshot_order_billing_authority()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_authority jsonb := coalesce(
    new.source_snapshot -> 'dispensingAuthoritySnapshot',
    new.source_snapshot -> 'planOrderAuthority',
    new.source_snapshot #> '{appliedSnapshot,planOrderAuthority}',
    '{}'::jsonb
  );
  v_legacy_amount_basis text := coalesce(
    nullif(new.source_snapshot ->> 'appliedAmountBasis', ''),
    nullif(new.source_snapshot ->> 'amountBasis', '')
  );
  v_set_price jsonb;
begin
  select orders.applied_price_snapshot into v_set_price
  from public.orders orders
  where orders.workspace_id = new.workspace_id
    and orders.id = new.order_id
    and orders.row_type = 'set'
    and orders.applied_price_snapshot ->> 'billedAs' = 'set_parent'
    and orders.applied_price_snapshot ->> 'amountBasis' in ('set_fixed_price', 'range_price');

  new.price_basis_snapshot := coalesce(
    new.price_basis_snapshot,
    nullif(v_authority ->> 'priceBasis', ''),
    case v_legacy_amount_basis
      when 'fixed_order_price' then 'per_order'
      when 'per_frequency' then 'per_administration'
      when 'per_kg' then 'per_kg'
      when 'set_fixed_price' then 'fixed_set'
      else null
    end,
    case when v_set_price is not null then 'fixed_set' end
  );
  new.billing_unit_snapshot := coalesce(
    new.billing_unit_snapshot,
    nullif(v_authority ->> 'billingUnit', ''),
    case when v_set_price is not null then 'set' end
  );
  new.tax_class_snapshot := coalesce(
    new.tax_class_snapshot,
    nullif(v_authority ->> 'taxClass', ''),
    nullif(new.source_snapshot ->> 'taxType', ''),
    case
      when v_set_price ->> 'taxType' in ('taxable', 'non_taxable')
        then v_set_price ->> 'taxType'
    end
  );
  new.set_billing_owner_snapshot := coalesce(
    new.set_billing_owner_snapshot,
    nullif(v_authority ->> 'setBillingOwner', ''),
    case when v_set_price is not null then 'parent' end
  );
  new.set_amount_strategy_snapshot := coalesce(
    new.set_amount_strategy_snapshot,
    nullif(v_authority ->> 'setAmountStrategy', ''),
    case v_set_price ->> 'amountBasis'
      when 'set_fixed_price' then 'fixed_set'
      when 'range_price' then 'range_price'
    end
  );
  return new;
end;
$function$;

revoke all on function private.clair_snapshot_order_billing_authority()
  from public, anon, authenticated, service_role;
