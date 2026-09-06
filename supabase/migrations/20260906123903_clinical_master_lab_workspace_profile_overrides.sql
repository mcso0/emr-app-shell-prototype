-- Workspace-authored reference intervals are immutable local revisions, never
-- global master edits. Existing orders/results retain their chosen local pin.
set lock_timeout='5s';
set statement_timeout='120s';
create table public.workspace_lab_profile_override_versions (
  workspace_id text not null references public.workspaces(id), id uuid not null,
  order_catalog_item_id text not null, base_profile_version_id uuid not null references master.lab_result_profile_versions(id),
  revision integer not null check(revision>0), rules jsonb not null, rules_sha256 text not null,
  expected_binding_revision integer not null, actor_user_id uuid not null references public.users(id), created_at timestamptz not null default now(),
  primary key(workspace_id,id), unique(workspace_id,order_catalog_item_id,base_profile_version_id,revision),
  foreign key(workspace_id,order_catalog_item_id) references public.order_catalog_items(workspace_id,id),
  check(jsonb_typeof(rules)='array' and jsonb_array_length(rules) between 1 and 200), check(rules_sha256=private.clinical_master_sha256(rules))
);
alter table public.workspace_lab_profile_override_versions enable row level security;
revoke all on public.workspace_lab_profile_override_versions from public,anon,authenticated,service_role;
create trigger workspace_lab_profile_overrides_immutable before update or delete on public.workspace_lab_profile_override_versions
  for each row execute function private.clair_guard_lab_profile_history();
alter table public.workspace_lab_result_profile_bindings add column override_version_id uuid;
alter table public.workspace_lab_result_profile_bindings add foreign key(workspace_id,override_version_id) references public.workspace_lab_profile_override_versions(workspace_id,id);
alter table public.orders add column selected_lab_profile_override_id uuid;
alter table public.orders add foreign key(workspace_id,selected_lab_profile_override_id) references public.workspace_lab_profile_override_versions(workspace_id,id);

create function private.clair_lab_profile_with_override(p_workspace_id text,p_catalog_id text,p_base_profile_id uuid,p_override_id uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public,private,master as $f$
declare definition jsonb; override_row public.workspace_lab_profile_override_versions;
begin
  select v.definition into strict definition from master.lab_result_profile_versions v where id=p_base_profile_id;
  if p_override_id is null then return definition; end if;
  select * into override_row from public.workspace_lab_profile_override_versions where workspace_id=p_workspace_id and id=p_override_id
    and order_catalog_item_id=p_catalog_id and base_profile_version_id=p_base_profile_id;
  if not found then raise exception 'lab_profile_override_scope_mismatch'; end if;
  return jsonb_set(definition,'{rules}',override_row.rules);
end $f$;
revoke all on function private.clair_lab_profile_with_override(text,text,uuid,uuid) from public,anon,authenticated,service_role;

create function public.clair_save_lab_profile_intervals(p_workspace_id text,p_catalog_item_id text,p_profile_version_id uuid,p_expected_binding_revision integer,p_request_id uuid,p_intervals jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,private,master as $f$
declare binding public.workspace_lab_result_profile_bindings; source master.lab_result_profile_versions; prior public.workspace_lab_profile_override_versions;
  intervals jsonb; rules jsonb:='[]'; rule jsonb; patch jsonb; result public.workspace_lab_profile_override_versions; revision integer;
begin
  if auth.uid() is null or not private.clair_is_active_workspace_member(p_workspace_id) then raise exception 'workspace_membership_missing' using errcode='42501'; end if;
  if not private.clair_current_user_has_workspace_permission(p_workspace_id,'service_catalog:manage') then raise exception 'permission_missing' using errcode='42501'; end if;
  if p_catalog_item_id is null or length(btrim(p_catalog_item_id))=0 or p_profile_version_id is null or p_request_id is null or p_expected_binding_revision is null or p_expected_binding_revision<1 or jsonb_typeof(p_intervals) is distinct from 'array'
    or jsonb_array_length(p_intervals) not between 1 and 200 then raise exception 'invalid_lab_profile_intervals'; end if;
  perform pg_advisory_xact_lock(hashtextextended('clinical_master_workspace_adoption:'||p_workspace_id,0));
  select * into strict source from master.lab_result_profile_versions where id=p_profile_version_id;
  if exists(select 1 from jsonb_array_elements(p_intervals) p where jsonb_typeof(p)<>'object' or (select count(*) from jsonb_object_keys(p))<>2
    or not p ?& array['testMasterKey','referenceInterval'] or jsonb_typeof(p->'testMasterKey')<>'string'
    or not exists(select 1 from jsonb_array_elements(source.definition->'rules') r where r->>'testMasterKey'=p->>'testMasterKey' and r->>'resultValueKind'='numeric'))
    or exists(select 1 from jsonb_array_elements(p_intervals) p group by p->>'testMasterKey' having count(*)>1) then raise exception 'invalid_lab_profile_intervals'; end if;
  -- A full numeric interval set makes clear/reset explicit and retries independent
  -- of subsequent master or binding changes. No unit/kind/analyte replacement.
  if jsonb_array_length(p_intervals)<>(select count(*) from jsonb_array_elements(source.definition->'rules') r where r->>'resultValueKind'='numeric') then raise exception 'invalid_lab_profile_intervals'; end if;
  for rule in select value from jsonb_array_elements(source.definition->'rules') loop
    select value into patch from jsonb_array_elements(p_intervals) p where p->>'testMasterKey'=rule->>'testMasterKey';
    if found then rule:=rule||jsonb_build_object('referenceInterval',patch->'referenceInterval','referenceStatus',case when patch->'referenceInterval'='null'::jsonb then 'unavailable' else 'synthetic_functional_fixture' end,
      'provenance',rule->'provenance'||jsonb_build_object('workspaceAuthored',true,'clinicalUseAllowed',false)); end if;
    if not private.clair_lab_profile_rule_valid(rule) then raise exception 'invalid_lab_profile_intervals'; end if;
    rules:=rules||jsonb_build_array(rule);
  end loop;
  select * into prior from public.workspace_lab_profile_override_versions where workspace_id=p_workspace_id and id=p_request_id;
  if found then
    if prior.order_catalog_item_id<>p_catalog_item_id or prior.base_profile_version_id<>p_profile_version_id or prior.expected_binding_revision<>p_expected_binding_revision
      or prior.actor_user_id<>auth.uid() or prior.rules<>rules then raise exception 'lab_profile_override_request_conflict'; end if;
    return jsonb_build_object('workspaceId',p_workspace_id,'catalogItemId',p_catalog_item_id,'overrideVersionId',prior.id,'revision',prior.revision);
  end if;
  perform 1 from public.order_catalog_items where workspace_id=p_workspace_id and id=p_catalog_item_id for update;
  select * into binding from public.workspace_lab_result_profile_bindings where workspace_id=p_workspace_id and order_catalog_item_id=p_catalog_item_id
    and species=source.definition->>'species' for update;
  if not found or binding.profile_version_id<>p_profile_version_id or binding.row_revision<>p_expected_binding_revision then raise exception 'lab_profile_binding_revision_conflict'; end if;
  select coalesce(max(v.revision),0)+1 into revision from public.workspace_lab_profile_override_versions v where v.workspace_id=p_workspace_id
    and v.order_catalog_item_id=p_catalog_item_id and v.base_profile_version_id=p_profile_version_id;
  insert into public.workspace_lab_profile_override_versions values(p_workspace_id,p_request_id,p_catalog_item_id,p_profile_version_id,revision,rules,
    private.clinical_master_sha256(rules),p_expected_binding_revision,auth.uid(),now()) returning * into result;
  update public.workspace_lab_result_profile_bindings set override_version_id=p_request_id,row_revision=row_revision+1,selected_by_user_id=auth.uid(),selected_at=now()
    where workspace_id=p_workspace_id and order_catalog_item_id=p_catalog_item_id and species=binding.species;
  insert into public.workspace_lab_profile_events(workspace_id,actor_user_id,event_type,target_id,before_snapshot,after_snapshot)
    values(p_workspace_id,auth.uid(),'profile_intervals_authored',p_catalog_item_id,to_jsonb(binding),to_jsonb(result));
  return jsonb_build_object('workspaceId',p_workspace_id,'catalogItemId',p_catalog_item_id,'overrideVersionId',result.id,'revision',result.revision);
end $f$;
revoke all on function public.clair_save_lab_profile_intervals(text,text,uuid,integer,uuid,jsonb) from public,anon,service_role;
grant execute on function public.clair_save_lab_profile_intervals(text,text,uuid,integer,uuid,jsonb) to authenticated;

create function private.clair_guard_lab_profile_override_pin() returns trigger
language plpgsql security definer set search_path=pg_catalog,public,private as $f$
begin
  if tg_op='UPDATE' and old.order_confirmation_status<>'draft' and new.selected_lab_profile_override_id is distinct from old.selected_lab_profile_override_id then raise exception 'confirmed_lab_profile_immutable'; end if;
  if tg_op='INSERT' and new.selected_lab_profile_override_id is null then
    select b.override_version_id into new.selected_lab_profile_override_id from public.workspace_lab_result_profile_bindings b
      join public.workspace_lab_devices d on d.workspace_id=b.workspace_id and d.id=b.device_id and d.active
      join public.encounters e on e.workspace_id=b.workspace_id and e.id=new.encounter_id
      join public.patients p on p.workspace_id=e.workspace_id and p.id=e.patient_id and p.species=b.species
      where b.workspace_id=new.workspace_id and b.order_catalog_item_id=new.workspace_catalog_item_id
        and (new.selected_lab_profile_version_id is null or b.profile_version_id=new.selected_lab_profile_version_id);
  end if;
  if new.selected_lab_profile_override_id is not null and not exists(select 1 from public.workspace_lab_profile_override_versions v
    where v.workspace_id=new.workspace_id and v.id=new.selected_lab_profile_override_id and v.order_catalog_item_id=new.workspace_catalog_item_id
      and (new.selected_lab_profile_version_id is null and tg_op='INSERT' or v.base_profile_version_id=new.selected_lab_profile_version_id)) then raise exception 'lab_profile_override_scope_mismatch'; end if;
  return new;
end $f$;
revoke all on function private.clair_guard_lab_profile_override_pin() from public,anon,authenticated,service_role;
create trigger orders_lab_profile_override_pin before insert or update on public.orders for each row execute function private.clair_guard_lab_profile_override_pin();

do $patch$
declare body text; needle text;
begin
  body:=pg_get_functiondef('public.clair_bind_workspace_lab_result_profile(text,text,uuid,uuid,integer)'::regprocedure);
  needle:='profile_version_id=excluded.profile_version_id,';
  if position(needle in body)=0 then raise exception 'lab_override_bind_patch_missing'; end if;
  execute replace(body,needle,needle||'override_version_id=case when public.workspace_lab_result_profile_bindings.profile_version_id=excluded.profile_version_id then public.workspace_lab_result_profile_bindings.override_version_id else null end,');
  body:=pg_get_functiondef('public.clair_select_lab_order_result_profile(text,uuid,timestamptz,uuid,uuid)'::regprocedure);
  needle:='if o.selected_lab_profile_version_id=p_profile_version_id and o.selected_lab_device_id=p_device_id then';
  if position(needle in body)=0 then raise exception 'lab_override_select_patch_missing'; end if;
  body:=replace(body,needle,'if o.selected_lab_profile_version_id=p_profile_version_id and o.selected_lab_device_id=p_device_id and o.selected_lab_profile_override_id is not distinct from (select b.override_version_id from public.workspace_lab_result_profile_bindings b where b.workspace_id=p_workspace_id and b.order_catalog_item_id=o.workspace_catalog_item_id and b.species=v_patient_species) then');
  body:=replace(body,'set selected_lab_profile_version_id=p_profile_version_id,','set selected_lab_profile_override_id=(select b.override_version_id from public.workspace_lab_result_profile_bindings b where b.workspace_id=p_workspace_id and b.order_catalog_item_id=o.workspace_catalog_item_id and b.species=v_patient_species),selected_lab_profile_version_id=p_profile_version_id,');
  execute body;
  body:=pg_get_functiondef('private.clair_freeze_lab_result_profile(text,uuid,jsonb)'::regprocedure);
  needle:='for row in select value from jsonb_array_elements(s->''rows'') loop';
  if position(needle in body)=0 then raise exception 'lab_override_freeze_patch_missing'; end if;
  body:=replace(body,needle,'profile.definition:=private.clair_lab_profile_with_override(p_workspace_id,o.workspace_catalog_item_id,profile.id,o.selected_lab_profile_override_id);'||needle);
  body:=replace(body,'''versionId'',profile.id,','''workspaceOverride'',(select jsonb_build_object(''id'',v.id,''revision'',v.revision,''rulesSha256'',v.rules_sha256,''catalogItemId'',v.order_catalog_item_id) from public.workspace_lab_profile_override_versions v where v.workspace_id=p_workspace_id and v.id=o.selected_lab_profile_override_id),''versionId'',profile.id,');
  execute body;
  body:=pg_get_functiondef('private.clair_assert_lab_result_profile_snapshot(text,jsonb)'::regprocedure);
  needle:='for row in select value from jsonb_array_elements(s->''rows'') loop';
  if position(needle in body)=0 then raise exception 'lab_override_assert_patch_missing'; end if;
  execute replace(body,needle,$a$
    if chosen->'workspaceOverride' is not null and chosen->'workspaceOverride'<>'null'::jsonb then
      if not exists(select 1 from public.workspace_lab_profile_override_versions v where v.workspace_id=p_workspace_id and v.id=(chosen#>>'{workspaceOverride,id}')::uuid
        and v.base_profile_version_id=profile.id and v.order_catalog_item_id=chosen#>>'{workspaceOverride,catalogItemId}'
        and v.order_catalog_item_id=s#>>'{source,workspaceCatalogItemId}' and v.revision=(chosen#>>'{workspaceOverride,revision}')::integer and v.rules_sha256=chosen#>>'{workspaceOverride,rulesSha256}') then
        raise exception 'lab_result_definition_snapshot_invalid'; end if;
      profile.definition:=private.clair_lab_profile_with_override(p_workspace_id,chosen#>>'{workspaceOverride,catalogItemId}',profile.id,(chosen#>>'{workspaceOverride,id}')::uuid);
    end if;
  $a$||needle);
end $patch$;

alter function public.clair_get_lab_result_profile_configuration(text,uuid,text) rename to clair_get_lab_result_profile_configuration_before_overrides;
revoke all on function public.clair_get_lab_result_profile_configuration_before_overrides(text,uuid,text) from public,anon,authenticated,service_role;
create function public.clair_get_lab_result_profile_configuration(p_workspace_id text,p_order_id uuid default null,p_catalog_item_id text default null) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,private as $f$
declare result jsonb; overrides jsonb;
begin
  result:=public.clair_get_lab_result_profile_configuration_before_overrides(p_workspace_id,p_order_id,p_catalog_item_id);
  select coalesce(jsonb_agg(to_jsonb(v) order by v.order_catalog_item_id,v.revision),'[]'::jsonb) into overrides from public.workspace_lab_profile_override_versions v
    where v.workspace_id=p_workspace_id and (result->>'catalogItemId' is null or v.order_catalog_item_id=result->>'catalogItemId');
  if p_order_id is not null then result:=jsonb_set(result,'{order,selectedOverrideVersionId}',coalesce((select to_jsonb(o.selected_lab_profile_override_id) from public.orders o where o.workspace_id=p_workspace_id and o.id=p_order_id),'null'::jsonb)); end if;
  return result||jsonb_build_object('overrides',overrides);
end $f$;
revoke all on function public.clair_get_lab_result_profile_configuration(text,uuid,text) from public,anon,service_role;
grant execute on function public.clair_get_lab_result_profile_configuration(text,uuid,text) to authenticated;
