-- Full packet already applied inside the enclosing rollback-only harness.
-- Create nested extras through the existing immutable B2 core, then exercise
-- the real normalizer while child invalidation updates its parent tuple.
do $nested_extras$
declare actor uuid; catalog public.order_catalog_items; definition jsonb; outcome jsonb;
  child_revision uuid; parent_revision uuid; before_rows jsonb; after_rows jsonb;
  history_before jsonb; packet_sha text; resources jsonb:=(select resources from wp10_input);
  ids text[]:=array['wp10-extra-a-child','wp10-extra-z-parent'];
begin
  select u.user_id into strict actor from public.user_memberships u
    where u.workspace_id='clair-demo' and u.status='active'
      and private.clair_user_has_workspace_permission(u.workspace_id,u.user_id,'service_catalog:manage')
      and private.clair_user_has_workspace_permission(u.workspace_id,u.user_id,'hospital_settings:manage')
    order by u.user_id limit 1;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  select packet_sha256 into strict packet_sha from private.wp10_ready_orders_receipt;
  select * into strict catalog from public.order_catalog_items
    where workspace_id='clair-demo' and availability_status='active' and archived_at is null and price_krw is not null
    order by id limit 1;
  definition:=jsonb_build_object('setCategory','WP10 regression','setName','WP10 extra child','billingName','WP10 extra child',
    'amountBasis','included_order_sum','setPriceKrw',null,'rangeBasis',null,'salesUnit','per_each',
    'billingReflectionEnabled',false,'taxType','derived','targetSpecies',jsonb_build_array('dog'),
    'careGuide',null,'internalInstruction',null,'priceRanges',jsonb_build_array(),
    'items',jsonb_build_array(jsonb_build_object('childKind','atomic','childOrderCatalogItemId',catalog.id,
      'childOrderCatalogRevision',catalog.catalog_revision,'childOrderSetId',null,'childSetRevisionId',null,
      'sortOrder',1,'defaultSelected',true,'billingReflectionDefault',false,'defaultQuantity',1,'quantitySource','fixed_one')));
  outcome:=private.clair_seed_order_set_compatibility_projection('clair-demo',ids[1],definition,'active',actor,
    private.clair_b2_deterministic_uuid('wp10-extra-regression',array[ids[1]]));
  if outcome->>'outcome' is distinct from 'created' then raise exception 'test extra child create failed:%',outcome; end if;
  select current_revision_id into strict child_revision from public.order_sets where workspace_id='clair-demo' and id=ids[1];
  definition:=definition||jsonb_build_object('setName','WP10 extra parent','billingName','WP10 extra parent',
    'items',jsonb_build_array(jsonb_build_object('childKind','order_set','childOrderCatalogItemId',null,
      'childOrderCatalogRevision',null,'childOrderSetId',ids[1],'childSetRevisionId',child_revision,
      'sortOrder',1,'defaultSelected',true,'billingReflectionDefault',false,'defaultQuantity',1,'quantitySource','fixed_one')));
  outcome:=private.clair_seed_order_set_compatibility_projection('clair-demo',ids[2],definition,'active',actor,
    private.clair_b2_deterministic_uuid('wp10-extra-regression',array[ids[2]]));
  if outcome->>'outcome' is distinct from 'created' then raise exception 'test extra parent create failed:%',outcome; end if;
  select current_revision_id into strict parent_revision from public.order_sets where workspace_id='clair-demo' and id=ids[2];
  select jsonb_agg(v order by v::text) into before_rows from (
    select to_jsonb(t) v from public.order_set_revisions t where workspace_id='clair-demo' and order_set_id=any(ids)
    union all select to_jsonb(t) from public.order_set_revision_items t where workspace_id='clair-demo' and order_set_id=any(ids)
    union all select to_jsonb(t) from public.order_set_revision_price_ranges t where workspace_id='clair-demo' and order_set_id=any(ids)
    union all select to_jsonb(t) from private.order_set_creation_requests t where workspace_id='clair-demo' and order_set_id=any(ids)
  ) preserved;
  history_before:=private.clair_wp10_clinical_history_fingerprint();
  perform private.clair_wp10_normalize_resources('clair-demo',resources,packet_sha);
  if (select count(*) from public.order_sets where workspace_id='clair-demo' and id=any(ids)
      and availability_status='inactive' and archived_at is not null)<>2
    or (select count(*) from public.order_sets where workspace_id='clair-demo' and availability_status='active' and archived_at is null)<>30
    or (select current_revision_id from public.order_sets where workspace_id='clair-demo' and id=ids[1]) is distinct from child_revision
    or (select current_revision_id from public.order_sets where workspace_id='clair-demo' and id=ids[2]) is distinct from parent_revision then
    raise exception 'test nested extras archive completeness'; end if;
  select jsonb_agg(v order by v::text) into after_rows from (
    select to_jsonb(t) v from public.order_set_revisions t where workspace_id='clair-demo' and order_set_id=any(ids)
    union all select to_jsonb(t) from public.order_set_revision_items t where workspace_id='clair-demo' and order_set_id=any(ids)
    union all select to_jsonb(t) from public.order_set_revision_price_ranges t where workspace_id='clair-demo' and order_set_id=any(ids)
    union all select to_jsonb(t) from private.order_set_creation_requests t where workspace_id='clair-demo' and order_set_id=any(ids)
  ) preserved;
  if after_rows is distinct from before_rows or private.clair_wp10_clinical_history_fingerprint() is distinct from history_before
    or (select count(*) from public.audit_events where workspace_id='clair-demo' and target_id=any(ids)
      and reason='wp10_extra_set_archived' and before_snapshot->>'availability_status'='active'
      and after_snapshot->>'availability_status'='inactive' and after_snapshot->>'archived_at' is not null)<>2
    or not exists(select 1 from public.audit_events where workspace_id='clair-demo' and target_id=ids[2]
      and reason='wp10_extra_set_archived' and before_snapshot->'needs_composition_review'='true'::jsonb) then
    raise exception 'test nested extra immutable history/audit lost'; end if;
  perform private.clair_wp10_normalize_resources('clair-demo',resources,packet_sha);
  if (select count(*) from public.audit_events where workspace_id='clair-demo' and target_id=any(ids) and reason='wp10_extra_set_archived')<>2 then
    raise exception 'test nested extra retry added archive audit'; end if;
  set constraints all immediate;
  raise notice 'WP10 nested extra sets: child-trigger parent update, complete archive, canonical30, immutable revisions/history, exact audit and retry passed';
end $nested_extras$;
