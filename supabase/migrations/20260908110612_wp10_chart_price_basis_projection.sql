-- Compact workspace pricing rules already use fixed_order_price in the admin
-- reader. Transport that same effective basis to chart snapshots. Keep stored
-- catalog revisions, amounts, set pins and historical order snapshots unchanged.
do $price_basis$
declare
  signature text;
  definition text;
  anchor text := $old$'appliedAmountBasis', item.pricing_rule ->> 'priceBasis'$old$;
  replacement text := $new$'appliedAmountBasis', coalesce(
          nullif(item.pricing_rule ->> 'priceBasis', ''),
          nullif(item.pricing_rule ->> 'price_basis', ''),
          'fixed_order_price')$new$;
begin
  foreach signature in array array[
    'public.clair_list_order_catalog_chart_search(text)',
    'public.clair_list_order_catalog_chart_search_v2_phase2_base(text)',
    'public.clair_list_order_catalog_chart_search_v2(text)'
  ] loop
    definition := pg_get_functiondef(signature::regprocedure);
    if length(definition) - length(replace(definition, anchor, '')) <> length(anchor) then
      raise exception 'wp10_chart_price_basis_projection_drift: %', signature;
    end if;
    execute replace(definition, anchor, replacement);
  end loop;

  -- Future reset execution must write its chosen common fixed-price basis,
  -- alongside the amount. This changes no already-applied receipt or rows.
  definition := pg_get_functiondef('private.clair_apply_wp10_ready_orders(jsonb,text,boolean)'::regprocedure);
  anchor := $old$pricing_rule=jsonb_build_object('priceKrw',price->'priceKrw')$old$;
  replacement := $new$pricing_rule=jsonb_build_object('priceBasis','fixed_order_price','priceKrw',price->'priceKrw')$new$;
  if length(definition) - length(replace(definition, anchor, '')) <> length(anchor) then
    raise exception 'wp10_price_basis_writer_drift';
  end if;
  execute replace(definition, anchor, replacement);
end $price_basis$;
