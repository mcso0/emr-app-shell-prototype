-- Runs only inside the named local Docker harness and its outer rollback.
do $chart_pricing$
declare
  w text; actor uuid; original_actor text := current_setting('request.jwt.claim.sub', true);
  selected_id text; scenario jsonb; expected text; actual text; snapshot jsonb;
  baseline jsonb := private.clair_wp10_state_fingerprint();
begin
  foreach w in array array['clair-demo','clair-foreign-demo','workspace-clair-cheongdam','workspace-clinical-master-pilot-v1'] loop
    select u.user_id into strict actor from public.user_memberships u
      where u.workspace_id=w and u.status='active'
        and private.clair_user_has_workspace_permission(w,u.user_id,'service_catalog:view')
      order by u.user_id limit 1;
    perform set_config('request.jwt.claim.sub', actor::text, true);
    if (select count(*) from public.clair_list_order_catalog_chart_search_v2(w)) <> 524
      or exists(select 1 from public.clair_list_order_catalog_chart_search_v2(w)
        where row_type='individual' and applied_snapshot->>'appliedAmountBasis' is distinct from 'fixed_order_price') then
      raise exception 'test full normalized chart pricing response failed: %', w;
    end if;
  end loop;
  -- Exercise the compact rows that already exist in Production, explicit unit
  -- pricing, and the legacy snake_case reader contract. Roll back all fixtures.
  w := 'workspace-clair-cheongdam';
  perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
  select applied_snapshot->>'workspaceCatalogItemId' into strict selected_id
    from public.clair_list_order_catalog_chart_search_v2(w)
    where row_type='individual' and category_group='consultation' limit 1;
  begin
    foreach scenario in array array['{}'::jsonb, '{"priceBasis":null}'::jsonb,
      '{"priceBasis":"unit_price"}'::jsonb, '{"price_basis":"unit_price"}'::jsonb] loop
      update public.order_catalog_items
        set pricing_rule=(pricing_rule-'priceBasis'-'price_basis') || scenario
        where workspace_id=w and id=selected_id;
      expected := coalesce(scenario->>'priceBasis',scenario->>'price_basis','fixed_order_price');
      select applied_snapshot into strict snapshot
        from public.clair_list_order_catalog_chart_search_v2(w)
        where row_type='individual' and applied_snapshot->>'workspaceCatalogItemId'=selected_id;
      actual := snapshot->>'appliedAmountBasis';
      if actual is distinct from expected then raise exception 'test chart amount basis % expected %', actual, expected; end if;
      if (snapshot->>'appliedPriceKrw')::integer is distinct from
        (select price_krw from public.order_catalog_items where workspace_id=w and id=selected_id) then
        raise exception 'test chart amount changed';
      end if;
    end loop;
    raise exception using errcode='W1010',message='rollback pricing fixtures';
  exception when sqlstate 'W1010' then null;
  end;
  perform set_config('request.jwt.claim.sub',coalesce(original_actor,''),true);
  if private.clair_wp10_state_fingerprint() is distinct from baseline then
    raise exception 'test chart pricing probe mutated state';
  end if;
  raise notice 'WP10 chart pricing: all four 524-row RPCs valid; compact/null/explicit-unit/snake-case bases preserved; full row state unchanged';
end $chart_pricing$;
