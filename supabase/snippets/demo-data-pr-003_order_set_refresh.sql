-- DEMO-DATA-PR-003. Re-pin Cheongdam order sets to the current catalog revisions.
--
-- Why: master cleanup phases 1 and 2 edited catalog items through
-- clair_update_order_catalog_item, which bumps catalog_revision. An order set
-- pins each member's catalog revision, so 34 active sets now raise
-- "catalog_revision_requires_refresh" when a vet applies them in a chart.
--
-- What it does: for every active set with a stale but active member, saves a new
-- set revision with the same definition and the current member revisions, through
-- the app's own clair_save_order_set_revision as the hospital admin. Sets named
-- like test fixtures ("PR…", "합성 …") are skipped; two of them hold duplicate
-- members and one holds a paused member, so they cannot be re-saved.
--
-- Keep `dry := true` to preview: the block ends with "SETFIX_ROLLBACK {...}" and
-- saves nothing. Set `dry := false` to apply; any failure rolls everything back.
-- Run this again after any later catalog edit that touches set members.

do $fix$
declare
  w constant text := 'workspace-clair-cheongdam';
  admin constant text := '49110000-0000-4000-8000-000000000001';
  dry constant boolean := true;
  st record; def jsonb; r jsonb; fixed int := 0; failed int := 0; errors jsonb := '[]'::jsonb; out jsonb;
begin
  perform set_config('request.jwt.claim.role','authenticated',true);
  perform set_config('request.jwt.claim.sub',admin,true);
  perform set_config('request.jwt.claims', json_build_object('sub', admin, 'role', 'authenticated')::text, true);
  for st in
    select s.id, s.set_name, s.current_revision_id rev_id, s.availability_status
    from public.order_sets s
    where s.workspace_id = w and s.availability_status = 'active' and s.archived_at is null
      and s.set_name !~ '^(PR-?[0-9]|합성 )'
      and exists (select 1 from public.order_set_revision_items i join public.order_catalog_items c on c.workspace_id = s.workspace_id and c.id = i.child_order_catalog_item_id
                  where i.order_set_id = s.id and i.revision_id = s.current_revision_id and i.child_kind = 'atomic' and c.availability_status = 'active'
                    and i.child_order_catalog_revision is distinct from c.catalog_revision)
      and not exists (select 1 from public.order_set_revision_items i join public.order_catalog_items c on c.workspace_id = s.workspace_id and c.id = i.child_order_catalog_item_id
                  where i.order_set_id = s.id and i.revision_id = s.current_revision_id and c.availability_status <> 'active')
    order by s.set_name
  loop
    -- Same definition shape private.clair_b2_resolve_review_core builds from a revision.
    select jsonb_build_object('setCategory',rv.set_category,'setName',rv.set_name,'billingName',rv.billing_name,'amountBasis',rv.amount_basis,'setPriceKrw',rv.set_price_krw,
        'rangeBasis',rv.range_basis,'salesUnit',rv.sales_unit,'billingReflectionEnabled',rv.billing_reflection_enabled,'taxType',rv.tax_type,'targetSpecies',to_jsonb(rv.target_species),
        'careGuide',rv.care_guide,'internalInstruction',rv.internal_instruction,
        'items',coalesce((select jsonb_agg(jsonb_build_object('childKind',i.child_kind,
              'childOrderCatalogItemId',case when i.child_kind='atomic' then i.child_order_catalog_item_id else null end,
              'childOrderCatalogRevision',case when i.child_kind='atomic' then c.catalog_revision else null end,
              'childOrderSetId',case when i.child_kind='order_set' then i.child_order_set_id else null end,
              'childSetRevisionId',case when i.child_kind='order_set' then i.child_set_revision_id else null end,
              'sortOrder',i.sort_order,'defaultSelected',i.default_selected,'billingReflectionDefault',i.billing_reflection_default,'defaultQuantity',i.default_quantity,'quantitySource',i.quantity_source) order by i.sort_order)
            from public.order_set_revision_items i left join public.order_catalog_items c on c.workspace_id=i.workspace_id and c.id=i.child_order_catalog_item_id
            where i.workspace_id=rv.workspace_id and i.order_set_id=rv.order_set_id and i.revision_id=rv.id),'[]'::jsonb),
        'priceRanges',private.clair_b2_revision_ranges_json(rv.workspace_id,rv.order_set_id,rv.id))
      into def from public.order_set_revisions rv where rv.workspace_id=w and rv.order_set_id=st.id and rv.id=st.rev_id;
    -- The RPC reports a rejected definition in its result instead of raising.
    r := public.clair_save_order_set_revision(w, st.id, st.rev_id, def, st.availability_status, gen_random_uuid());
    if coalesce((r->>'ok')::boolean, false) then fixed := fixed + 1;
    else failed := failed + 1; errors := errors || jsonb_build_object('set', st.set_name, 'error', r->'error');
    end if;
  end loop;
  out := jsonb_build_object('dry', dry, 'fixed', fixed, 'failed', failed, 'errors', errors,
    'stillStale', (select jsonb_agg(distinct s.set_name) from public.order_sets s join public.order_set_revision_items i on i.order_set_id=s.id and i.revision_id=s.current_revision_id
        join public.order_catalog_items c on c.workspace_id=s.workspace_id and c.id=i.child_order_catalog_item_id
        where s.workspace_id=w and s.availability_status='active' and i.child_kind='atomic' and i.child_order_catalog_revision is distinct from c.catalog_revision));
  if dry or failed > 0 then
    raise exception 'SETFIX_ROLLBACK %', out::text;
  end if;
end $fix$;
