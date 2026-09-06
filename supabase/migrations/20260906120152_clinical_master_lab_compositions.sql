-- Immutable laboratory composition source graphs. Source nesting is separate
-- from execution: each compiled workspace set contains pinned atomic orders,
-- while the original checkup/CBC/group path is retained in immutable provenance.
set lock_timeout='5s';
set statement_timeout='120s';

create function private.clair_expand_lab_composition(p_graph jsonb,p_key text,p_path jsonb default '[]',p_selected boolean default true) returns jsonb
language plpgsql immutable set search_path=pg_catalog as $f$
declare node jsonb; member jsonb; ordinal bigint; next_path jsonb; leaves jsonb:='[]';
begin
  if exists(select 1 from jsonb_array_elements(p_path) step where step->>'key'=p_key) then raise exception 'lab_composition_cycle'; end if;
  if jsonb_array_length(p_path)>=4 then raise exception 'lab_composition_depth_exceeded'; end if;
  select value into strict node from jsonb_array_elements(p_graph) where value->>'masterKey'=p_key;
  for member,ordinal in select value,ordinality from jsonb_array_elements(node->'members') with ordinality loop
    next_path:=p_path||jsonb_build_array(jsonb_build_object('key',p_key,'versionId',node->>'id','name',node->>'displayName','ordinal',ordinal));
    if member->>'kind'='composition' then
      leaves:=leaves||private.clair_expand_lab_composition(p_graph,member->>'memberKey',next_path,p_selected and (member->>'defaultIncluded')::boolean);
    else
      leaves:=leaves||jsonb_build_array(jsonb_build_object('masterKey',member->>'memberKey','defaultIncluded',p_selected and (member->>'defaultIncluded')::boolean,'path',next_path));
    end if;
    if jsonb_array_length(leaves)>200 then raise exception 'lab_composition_leaf_limit'; end if;
  end loop;
  if exists(select 1 from jsonb_array_elements(leaves) leaf group by leaf->>'masterKey' having count(*)>1) then raise exception 'lab_composition_duplicate_leaf'; end if;
  return leaves;
exception when no_data_found then raise exception 'lab_composition_child_missing';
end $f$;
revoke all on function private.clair_expand_lab_composition(jsonb,text,jsonb,boolean) from public,anon,authenticated,service_role;

create table master.lab_composition_versions (
  id uuid primary key, master_key text not null, revision integer not null check(revision>0),
  release_id uuid not null references master.master_releases(id), definition jsonb not null,
  source_graph jsonb not null, expanded_leaves jsonb not null, definition_sha256 text not null,
  created_at timestamptz not null default now(), unique(master_key,revision),
  check(definition_sha256=private.clinical_master_sha256(jsonb_build_object('definition',definition,'sourceGraph',source_graph,'expandedLeaves',expanded_leaves)))
);
create table master.lab_composition_release_payloads (
  release_id uuid primary key references master.master_releases(id), payload jsonb not null,
  payload_sha256 text not null, check(payload_sha256=private.clinical_master_sha256(payload))
);
revoke all on master.lab_composition_versions,master.lab_composition_release_payloads from public,anon,authenticated,service_role;
create trigger lab_composition_versions_immutable before update or delete on master.lab_composition_versions
  for each row execute function private.clair_guard_lab_profile_history();
create trigger lab_composition_release_payloads_immutable before update or delete on master.lab_composition_release_payloads
  for each row execute function private.clair_guard_lab_profile_history();

alter function private.publish_clinical_master_release(jsonb,uuid) rename to publish_clinical_master_release_before_lab_compositions;
create function private.publish_clinical_master_release(p_payload jsonb,p_actor_user_id uuid default null) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,private,master as $f$
declare graph jsonb:=p_payload->'labCompositions'; node jsonb; leaves jsonb; leaf jsonb; pinned jsonb; source master.master_records; reachable_graph jsonb;
  result jsonb; released uuid; prior_release uuid; prior_hash text; existing master.lab_composition_versions; hash text;
begin
  if not p_payload ? 'labCompositions' then return private.publish_clinical_master_release_before_lab_compositions(p_payload,p_actor_user_id); end if;
  if jsonb_typeof(graph) is distinct from 'array' or jsonb_array_length(graph) not between 1 and 100 then raise exception 'invalid_lab_composition_graph'; end if;
  if exists(select 1 from jsonb_array_elements(graph) n group by n->>'masterKey' having count(*)>1)
    or exists(select 1 from jsonb_array_elements(graph) n group by n->>'id' having count(*)>1) then raise exception 'invalid_lab_composition_graph'; end if;
  for node in select value from jsonb_array_elements(graph) loop
    if jsonb_typeof(node) is distinct from 'object' or (select count(*) from jsonb_object_keys(node))<>8
      or not node ?& array['schemaVersion','id','masterKey','revision','displayName','originalOrderMasterKey','targetSpecies','members']
      or node->'schemaVersion' is distinct from '1'::jsonb or jsonb_typeof(node->'revision') is distinct from 'number' or node->>'revision' !~ '^[1-9][0-9]*$'
      or exists(select 1 from jsonb_each(node) kv where kv.key in ('id','masterKey','displayName') and (jsonb_typeof(kv.value)<>'string' or length(btrim(kv.value#>>'{}')) not between 1 and 300))
      or jsonb_typeof(node->'originalOrderMasterKey') not in ('null','string')
      or jsonb_typeof(node->'targetSpecies') is distinct from 'array' or jsonb_array_length(node->'targetSpecies') not between 1 and 2
      or exists(select 1 from jsonb_array_elements(node->'targetSpecies') species where species not in ('"dog"'::jsonb,'"cat"'::jsonb))
      or exists(select 1 from jsonb_array_elements(node->'targetSpecies') species group by species having count(*)>1)
      or jsonb_typeof(node->'members') is distinct from 'array' or jsonb_array_length(node->'members') not between 1 and 200
      or exists(select 1 from jsonb_array_elements(node->'members') member where jsonb_typeof(member)<>'object'
        or (select count(*) from jsonb_object_keys(member))<>3 or not member ?& array['kind','memberKey','defaultIncluded']
        or jsonb_typeof(member->'kind')<>'string' or member->>'kind' not in ('order','composition') or jsonb_typeof(member->'memberKey')<>'string' or length(btrim(member->>'memberKey')) not between 1 and 200
        or jsonb_typeof(member->'defaultIncluded')<>'boolean') then raise exception 'invalid_lab_composition_graph'; end if;
    perform (node->>'id')::uuid;
    perform private.clair_expand_lab_composition(graph,node->>'masterKey');
  end loop;
  select id into prior_release from master.master_releases where release_key=p_payload->>'releaseKey';
  result:=private.publish_clinical_master_release_before_lab_compositions(p_payload-'labCompositions',p_actor_user_id);
  released:=(result->>'releaseId')::uuid;
  select payload_sha256 into prior_hash from master.lab_composition_release_payloads where release_id=released;
  if found then
    if prior_hash<>private.clinical_master_sha256(graph) then raise exception 'lab_composition_release_retry_conflict'; end if;
    return result||jsonb_build_object('labCompositionCount',jsonb_array_length(graph));
  end if;
  if prior_release is not null then raise exception 'lab_composition_release_late_attachment'; end if;
  for node in select value from jsonb_array_elements(graph) loop
    pinned:='[]'; leaves:=private.clair_expand_lab_composition(graph,node->>'masterKey');
    if node->>'originalOrderMasterKey' is not null and not exists(select 1 from master.master_records m where m.master_key=node->>'originalOrderMasterKey' and m.record_type='order') then
      raise exception 'lab_composition_original_order_missing'; end if;
    for leaf in select value from jsonb_array_elements(leaves) loop
      select m.* into source from master.master_records m join master.lab_order_profiles p on p.order_record_id=m.id and p.lab_test_id is not null
        where m.master_key=leaf->>'masterKey' and m.record_type='order';
      if not found then raise exception 'lab_composition_atomic_order_missing'; end if;
      pinned:=pinned||jsonb_build_array(leaf||jsonb_build_object('sourceMasterOrderRecordId',source.id,'sourceMasterOrderRevision',source.current_revision));
    end loop;
    -- Unrelated composition additions do not revise this immutable source graph.
    select jsonb_agg(n order by n->>'masterKey') into reachable_graph from jsonb_array_elements(graph) n
      where exists(select 1 from jsonb_array_elements(leaves) l cross join lateral jsonb_array_elements(l->'path') step where step->>'key'=n->>'masterKey');
    hash:=private.clinical_master_sha256(jsonb_build_object('definition',node,'sourceGraph',reachable_graph,'expandedLeaves',pinned));
    select * into existing from master.lab_composition_versions where master_key=node->>'masterKey' and revision=(node->>'revision')::integer;
    if found then
      if existing.id<>(node->>'id')::uuid or existing.definition_sha256<>hash then raise exception 'lab_composition_version_conflict'; end if;
    else insert into master.lab_composition_versions(id,master_key,revision,release_id,definition,source_graph,expanded_leaves,definition_sha256)
      values((node->>'id')::uuid,node->>'masterKey',(node->>'revision')::integer,released,node,reachable_graph,pinned,hash); end if;
  end loop;
  insert into master.lab_composition_release_payloads values(released,graph,private.clinical_master_sha256(graph));
  return result||jsonb_build_object('labCompositionCount',jsonb_array_length(graph));
end $f$;
revoke all on function private.publish_clinical_master_release(jsonb,uuid) from public,anon,authenticated,service_role;

create table public.workspace_lab_composition_revisions (
  workspace_id text not null references public.workspaces(id), composition_version_id uuid not null references master.lab_composition_versions(id),
  order_set_id text not null, order_set_revision_id uuid not null, original_catalog_item_id text,
  billing_policy text not null check(billing_policy in ('preserve_parent_price','sum_leaf_prices','no_charge')),
  compiled_leaves jsonb not null, actor_user_id uuid not null references public.users(id), created_at timestamptz not null default now(),
  primary key(workspace_id,order_set_revision_id), foreign key(workspace_id,order_set_revision_id) references public.order_set_revisions(workspace_id,id),
  foreign key(workspace_id,original_catalog_item_id) references public.order_catalog_items(workspace_id,id)
);
create table public.workspace_lab_composition_apply_requests (
  workspace_id text not null references public.workspaces(id), request_id uuid not null, actor_user_id uuid not null references public.users(id),
  payload_sha256 text not null, outcome jsonb not null, created_at timestamptz not null default now(), primary key(workspace_id,request_id)
);
alter table public.workspace_lab_composition_revisions enable row level security;
alter table public.workspace_lab_composition_apply_requests enable row level security;
revoke all on public.workspace_lab_composition_revisions,public.workspace_lab_composition_apply_requests from public,anon,authenticated,service_role;
create trigger workspace_lab_composition_revisions_immutable before update or delete on public.workspace_lab_composition_revisions
  for each row execute function private.clair_guard_lab_profile_history();
create trigger workspace_lab_composition_apply_requests_immutable before update or delete on public.workspace_lab_composition_apply_requests
  for each row execute function private.clair_guard_lab_profile_history();

create function public.clair_apply_lab_composition(p_workspace_id text,p_version_id uuid,p_billing_policy text,p_expected_set_revision_id uuid,p_request_id uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,private,master as $f$
declare composition master.lab_composition_versions; leaf jsonb; catalog public.order_catalog_items; parent public.order_catalog_items;
  items jsonb:='[]'; compiled jsonb:='[]'; definition jsonb; result jsonb; prior public.workspace_lab_composition_apply_requests;
  hash text; set_id text; current_set public.order_sets; ordinal integer:=0; revision_id uuid; source_revision public.workspace_lab_composition_revisions;
begin
  if auth.uid() is null or not private.clair_is_active_workspace_member(p_workspace_id) then raise exception 'workspace_membership_missing' using errcode='42501'; end if;
  if not private.clair_current_user_has_workspace_permission(p_workspace_id,'service_catalog:manage') then raise exception 'permission_missing' using errcode='42501'; end if;
  if p_version_id is null or p_request_id is null or p_billing_policy is null or p_billing_policy not in ('preserve_parent_price','sum_leaf_prices','no_charge') then raise exception 'invalid_lab_composition_request'; end if;
  hash:=private.clinical_master_sha256(jsonb_build_object('versionId',p_version_id,'billingPolicy',p_billing_policy,'expectedRevision',p_expected_set_revision_id));
  perform pg_advisory_xact_lock(hashtextextended('clinical_master_workspace_adoption:'||p_workspace_id,0));
  select * into prior from public.workspace_lab_composition_apply_requests where workspace_id=p_workspace_id and request_id=p_request_id;
  if found then
    if prior.actor_user_id<>auth.uid() or prior.payload_sha256<>hash then raise exception 'lab_composition_request_conflict'; end if;
    return prior.outcome;
  end if;
  select * into composition from master.lab_composition_versions where id=p_version_id;
  if not found then raise exception 'lab_composition_version_missing'; end if;
  set_id:='lab-composition:'||private.clair_b2_deterministic_uuid('lab-composition',array[p_workspace_id,composition.master_key])::text;
  select * into current_set from public.order_sets where workspace_id=p_workspace_id and id=set_id for update;
  if current_set.current_revision_id is distinct from p_expected_set_revision_id then raise exception 'lab_composition_revision_conflict'; end if;
  if current_set.id is not null and not exists(select 1 from public.workspace_lab_composition_revisions r where r.workspace_id=p_workspace_id
    and r.order_set_revision_id=current_set.current_revision_id) then raise exception 'lab_composition_local_override_requires_explicit_reconciliation'; end if;
  if composition.definition->>'originalOrderMasterKey' is not null then
    select c.* into parent from public.order_catalog_items c join master.master_records m on m.id=c.source_master_record_id
      where c.workspace_id=p_workspace_id and m.master_key=composition.definition->>'originalOrderMasterKey' for share of c;
    if not found then raise exception 'lab_composition_parent_catalog_missing'; end if;
  end if;
  if p_billing_policy='preserve_parent_price' and (parent.id is null or parent.price_krw is null or not parent.billing_eligible or not parent.billing_reflection_enabled) then raise exception 'lab_composition_parent_price_unavailable'; end if;
  for leaf in select value from jsonb_array_elements(composition.expanded_leaves) loop
    select * into catalog from public.order_catalog_items where workspace_id=p_workspace_id and source_master_record_id=(leaf->>'sourceMasterOrderRecordId')::uuid for share;
    if not found or catalog.availability_status<>'active' or catalog.source_master_revision<>(leaf->>'sourceMasterOrderRevision')::integer then raise exception 'lab_composition_catalog_pin_stale'; end if;
    ordinal:=ordinal+1;
    items:=items||jsonb_build_array(jsonb_build_object('childKind','atomic','childOrderCatalogItemId',catalog.id,'childOrderCatalogRevision',catalog.catalog_revision,
      'childOrderSetId',null,'childSetRevisionId',null,'sortOrder',ordinal,'defaultSelected',(leaf->>'defaultIncluded')::boolean,
      'billingReflectionDefault',p_billing_policy='sum_leaf_prices' and catalog.billing_eligible and catalog.billing_reflection_enabled,'defaultQuantity',1,'quantitySource','fixed_one'));
    compiled:=compiled||jsonb_build_array(leaf||jsonb_build_object('workspaceCatalogItemId',catalog.id,'workspaceCatalogRevision',catalog.catalog_revision,'sortOrder',ordinal));
  end loop;
  definition:=jsonb_build_object('setCategory','임상병리검사','setName',coalesce(parent.in_hospital_order_name,composition.definition->>'displayName'),
    'billingName',coalesce(parent.billing_name,composition.definition->>'displayName'),'amountBasis',case when p_billing_policy='preserve_parent_price' then 'set_fixed_price' else 'included_order_sum' end,
    'setPriceKrw',case when p_billing_policy='preserve_parent_price' then parent.price_krw else null end,'rangeBasis',null,'salesUnit','per_order',
    'billingReflectionEnabled',p_billing_policy='preserve_parent_price','taxType',case when p_billing_policy='preserve_parent_price' then case when parent.tax_included then 'taxable' else 'non_taxable' end else 'derived' end,
    'targetSpecies',composition.definition->'targetSpecies','careGuide',parent.care_guide,'internalInstruction',parent.internal_instruction,'items',items,'priceRanges','[]'::jsonb);
  if current_set.id is null then result:=private.clair_b2_create_core(p_workspace_id,definition,'active',auth.uid(),p_request_id,set_id);
  else result:=private.clair_b2_save_core(p_workspace_id,set_id,p_expected_set_revision_id,definition,current_set.availability_status,auth.uid(),p_request_id); end if;
  if result->'ok' is distinct from 'true'::jsonb then raise exception 'lab_composition_workspace_compile_failed: %',result->>'code'; end if;
  select current_revision_id into strict revision_id from public.order_sets where workspace_id=p_workspace_id and id=set_id;
  insert into public.workspace_lab_composition_revisions(workspace_id,composition_version_id,order_set_id,order_set_revision_id,original_catalog_item_id,billing_policy,compiled_leaves,actor_user_id)
    values(p_workspace_id,p_version_id,set_id,revision_id,parent.id,p_billing_policy,compiled,auth.uid());
  result:=jsonb_build_object('ok',true,'status',200,'workspaceId',p_workspace_id,'orderSetId',set_id,'orderSetRevisionId',revision_id,'compositionVersionId',p_version_id,'leafCount',ordinal,'billingPolicy',p_billing_policy);
  insert into public.workspace_lab_composition_apply_requests(workspace_id,request_id,actor_user_id,payload_sha256,outcome) values(p_workspace_id,p_request_id,auth.uid(),hash,result);
  return result;
end $f$;
revoke all on function public.clair_apply_lab_composition(text,uuid,text,uuid,uuid) from public,anon,service_role;
grant execute on function public.clair_apply_lab_composition(text,uuid,text,uuid,uuid) to authenticated;

alter function public.clair_get_lab_result_profile_configuration(text,uuid,text) rename to clair_get_lab_result_profile_configuration_before_compositions;
revoke all on function public.clair_get_lab_result_profile_configuration_before_compositions(text,uuid,text) from public,anon,authenticated,service_role;
create function public.clair_get_lab_result_profile_configuration(p_workspace_id text,p_order_id uuid default null,p_catalog_item_id text default null) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,private,master as $f$
declare result jsonb; rows jsonb;
begin
  result:=public.clair_get_lab_result_profile_configuration_before_compositions(p_workspace_id,p_order_id,p_catalog_item_id);
  select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'masterKey',v.master_key,'revision',v.revision,
    'name',v.definition->>'displayName','leafCount',jsonb_array_length(v.expanded_leaves),'leaves',v.expanded_leaves,
    'currentSetRevisionId',s.current_revision_id,'currentCompositionVersionId',r.composition_version_id,'billingPolicy',r.billing_policy)
    order by v.master_key,v.revision),'[]'::jsonb) into rows
  from master.lab_composition_versions v
  left join public.order_sets s on s.workspace_id=p_workspace_id and s.id='lab-composition:'||private.clair_b2_deterministic_uuid('lab-composition',array[p_workspace_id,v.master_key])::text
  left join public.workspace_lab_composition_revisions r on r.workspace_id=s.workspace_id and r.order_set_revision_id=s.current_revision_id
  where p_order_id is null and (p_catalog_item_id is null or exists(select 1 from public.order_catalog_items c join master.master_records m on m.id=c.source_master_record_id
    where c.workspace_id=p_workspace_id and c.id=p_catalog_item_id and m.master_key=v.definition->>'originalOrderMasterKey'));
  return result||jsonb_build_object('compositions',rows);
end $f$;
revoke all on function public.clair_get_lab_result_profile_configuration(text,uuid,text) from public,anon,service_role;
grant execute on function public.clair_get_lab_result_profile_configuration(text,uuid,text) to authenticated;

create function private.clair_lab_catalog_has_active_composition(p_workspace_id text,p_catalog_id text) returns boolean
language sql stable security definer set search_path=pg_catalog,public,private as $f$
  select private.clair_is_active_workspace_member(p_workspace_id)
    and private.clair_current_user_has_workspace_permission(p_workspace_id,'service_catalog:view')
    and exists(select 1 from public.workspace_lab_composition_revisions r join public.order_sets s
      on s.workspace_id=r.workspace_id and s.id=r.order_set_id and s.current_revision_id=r.order_set_revision_id
      where r.workspace_id=p_workspace_id and r.original_catalog_item_id=p_catalog_id and s.availability_status='active')
$f$;
revoke all on function private.clair_lab_catalog_has_active_composition(text,text) from public,anon,service_role;
grant execute on function private.clair_lab_catalog_has_active_composition(text,text) to authenticated;
do $patch$
declare body text:=pg_get_functiondef('public.clair_list_order_catalog_chart_search_v2(text)'::regprocedure);
  needle text:='where private.clair_current_user_has_workspace_permission(';
begin
  if position(needle in body)=0 then raise exception 'lab_composition_search_patch_target_missing'; end if;
  execute replace(body,needle,'where (base.row_type = ''set'' or not private.clair_lab_catalog_has_active_composition(p_workspace_id,catalog.id)) and private.clair_current_user_has_workspace_permission(');
end $patch$;
