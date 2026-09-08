-- Additive support only. No catalog reset, resource assignment or service
-- review activation is performed by installing this migration.
alter table public.order_sets add column archived_at timestamptz;
alter table public.order_sets add constraint order_set_archive_inactive check (archived_at is null or availability_status='inactive');
do $patch$
declare body text; anchor text:='where s.workspace_id=p_workspace_id and (nullif(btrim(p_query)';
begin
  body:=pg_get_functiondef('public.clair_list_order_sets(text,text)'::regprocedure);
  if (length(body)-length(replace(body,anchor,'')))/length(anchor)<>1 then raise exception 'archived_set_list_anchor'; end if;
  execute replace(body,anchor,'where s.workspace_id=p_workspace_id and s.archived_at is null and (nullif(btrim(p_query)');
end $patch$;

-- A default is explicitly selected, never inferred from the first location.
-- Deactivation removes it from resolution without changing existing order pins.
alter table public.workspace_inpatient_locations add column is_default boolean not null default false;
create unique index inpatient_one_active_default_per_workspace
  on public.workspace_inpatient_locations(workspace_id) where is_default and active;
alter function private.clair_catalog_effective_default_detail_inputs(public.order_catalog_items)
  rename to clair_catalog_effective_defaults_before_workspace_location;
create function private.clair_catalog_effective_default_detail_inputs(p_catalog public.order_catalog_items)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,private as $f$
declare inputs jsonb; location_id uuid;
begin
  inputs:=private.clair_catalog_effective_defaults_before_workspace_location(p_catalog);
  if p_catalog.clinical_order_type='hospitalization'
    and p_catalog.default_detail_input_policies->>'wardOrCage'='workspace_resolved'
    and nullif(inputs->>'wardOrCage','') is null then
    select id into location_id from public.workspace_inpatient_locations
      where workspace_id=p_catalog.workspace_id and active and is_default;
    if location_id is not null then inputs:=jsonb_set(inputs,'{wardOrCage}',to_jsonb(location_id::text)); end if;
  end if;
  return inputs;
end $f$;
revoke all on function private.clair_catalog_effective_default_detail_inputs(public.order_catalog_items)
  from public,anon,authenticated,service_role;

-- The user's four-workspace synthetic scope includes the previously empty
-- foreign fixture. It still requires an explicit operator review event and
-- never grants clinical approval or permits another workspace.
alter function private.clair_dispensing_service_review_allowed(text,uuid)
  rename to clair_dispensing_service_review_before_wp10;
create function private.clair_dispensing_service_review_allowed(p_workspace_id text,p_release_id uuid)
returns boolean language sql stable security definer set search_path=pg_catalog,public,private,master as $f$
select private.clair_dispensing_service_review_before_wp10(p_workspace_id,p_release_id)
  or (p_workspace_id='clair-foreign-demo'
    and exists(select 1 from master.master_releases where id=p_release_id and status='published')
    and coalesce((select action='enabled' and approval_reference like 'wp10:%'
      from private.clinical_master_dispensing_service_review_events
      where workspace_id=p_workspace_id and release_id=p_release_id
      order by created_at desc,id desc limit 1),false));
$f$;
revoke all on function private.clair_dispensing_service_review_allowed(text,uuid)
  from public,anon,authenticated,service_role;

-- The cumulative publisher stores the new immutable deprecated snapshot but
-- retains the live lifecycle column. Reconcile only this fixed retirement
-- release, with the corresponding append-only review event.
create function private.clair_wp10_apply_retirement(p_release_id uuid,p_retired_keys text[],p_actor_user_id uuid,p_packet_sha256 text)
returns integer language plpgsql security invoker set search_path=pg_catalog,public,private,master as $f$
declare source master.master_records; changed integer:=0;
begin
  if cardinality(p_retired_keys) is distinct from 51
    or (select count(distinct k) from unnest(p_retired_keys) k)<>51
    or p_actor_user_id is null or not exists(select 1 from public.users where id=p_actor_user_id and status='active')
    or p_packet_sha256 is null or p_packet_sha256 !~ '^[a-f0-9]{64}$'
    or not exists(select 1 from master.master_releases where id=p_release_id
      and release_key='cm.release.ready-orders.2026-09-08.v1' and status='published') then raise exception 'wp10_retirement_scope_invalid'; end if;
  if (select count(*) from master.master_records where master_key=any(p_retired_keys) and record_type='order')<>51 then
    raise exception 'wp10_retirement_identities_missing'; end if;
  for source in select * from master.master_records where master_key=any(p_retired_keys) order by id for update loop
    if source.current_release_id<>p_release_id or not exists(select 1 from master.master_record_versions v
      where v.master_record_id=source.id and v.revision=source.current_revision
        and v.snapshot->>'lifecycleStatus'='deprecated') then raise exception 'wp10_retirement_source_drift'; end if;
    if source.lifecycle_status='deprecated' then continue; end if;
    update master.master_records set lifecycle_status='deprecated',deprecated_at=now(),updated_at=now() where id=source.id;
    insert into master.master_review_events(master_record_id,revision,event_type,actor_user_id,actor_label,source_surface,reason)
      values(source.id,source.current_revision,'deprecated',p_actor_user_id,'WP10 synthetic catalog reset','server_admin',
        'Retire future selection; preserve historical identities. Packet '||p_packet_sha256);
    changed:=changed+1;
  end loop;
  return changed;
end $f$;
revoke all on function private.clair_wp10_apply_retirement(uuid,text[],uuid,text)
  from public,anon,authenticated,service_role;

-- Complete the fresh adopter's product linkage from current immutable master
-- profiles. This does not carry old hospital prescription metadata forward.
create function private.clair_wp10_project_dispensing(p_workspace_id text,p_packet_sha256 text)
returns integer language plpgsql security invoker set search_path=pg_catalog,public,private,master as $f$
declare profile master.dispensing_order_profiles; product master.medication_products;
  c public.order_catalog_items; next public.order_catalog_items; snapshot jsonb; metadata jsonb; n integer:=0;
begin
  if p_workspace_id<>all(array['clair-demo','clair-foreign-demo','workspace-clair-cheongdam','workspace-clinical-master-pilot-v1'])
    or auth.uid() is null or not private.clair_is_active_workspace_member(p_workspace_id)
    or not private.clair_current_user_has_workspace_permission(p_workspace_id,'service_catalog:manage')
    or p_packet_sha256 is null or p_packet_sha256 !~ '^[a-f0-9]{64}$' then raise exception 'wp10_projection_scope_invalid'; end if;
  for profile in select p.* from master.dispensing_order_profiles p join master.master_records m
    on m.id=p.order_record_id and m.current_revision=p.order_record_revision
    where m.lifecycle_status='published' order by p.order_record_id loop
    if profile.prescription_default_status<>'none' or profile.prescription_defaults is not null
      or master.clair_dispensing_profile_clinical_use_allowed(profile.id,profile.profile_revision) then
      raise exception 'wp10_non_synthetic_dispensing_source'; end if;
    select * into strict product from master.medication_products where id=profile.product_id and revision=profile.product_revision;
    select * into strict c from public.order_catalog_items where workspace_id=p_workspace_id and source_master_record_id=profile.order_record_id for update;
    if c.origin_type<>'clair_master' or c.source_master_revision<>profile.order_record_revision then raise exception 'wp10_dispensing_owner_drift'; end if;
    snapshot:=jsonb_build_object('schemaVersion',1,'sourceDispensingProfileId',profile.id,
      'sourceDispensingProfileRevision',profile.profile_revision,'sourceMedicationProductId',product.id,
      'sourceMedicationProductRevision',product.revision,'productKey',product.product_key,
      'englishProductName',product.english_product_name,'koreanDraftName',product.korean_draft_name,
      'koreanReviewStatus',product.korean_review_status,'dosageForm',product.dosage_form,
      'routes',to_jsonb(profile.allowed_routes),'strengthSnapshot',product.strength_snapshot,
      'targetSpecies',(select coalesce(jsonb_agg(s.species_code order by s.species_code),'[]')
        from master.medication_species_applicability a join master.species s on s.master_record_id=a.species_record_id
        where a.product_id=product.id and a.product_revision=product.revision),'clinicalUseAllowed',false);
    metadata:=coalesce(private.clair_current_dispensing_master_preset_metadata(profile.id,profile.profile_revision),'{}')
      ||jsonb_build_object('defaultDetailInputs',c.default_detail_inputs);
    if c.source_dispensing_profile_id=profile.id and c.source_dispensing_profile_revision=profile.profile_revision
      and c.source_medication_product_id=product.id and c.source_medication_product_revision=product.revision
      and c.dispensing_profile_snapshot=snapshot and c.medication_metadata=metadata
      and c.availability_status='pending_activation' and not c.clinical_use_allowed then n:=n+1; continue; end if;
    update public.order_catalog_items set source_dispensing_profile_id=profile.id,source_dispensing_profile_revision=profile.profile_revision,
      source_medication_product_id=product.id,source_medication_product_revision=product.revision,
      source_clinical_review_id=null,clinical_use_allowed=false,dispensing_profile_snapshot=snapshot,
      dispensing_profile_snapshot_sha256=private.clinical_master_sha256(snapshot),
      medication_metadata=metadata,
      availability_status='pending_activation',catalog_revision=catalog_revision+1,updated_at=now()
      where workspace_id=p_workspace_id and id=c.id returning * into next;
    perform private.clair_pr020_append_order_catalog_audit(p_workspace_id,'order_catalog.updated',c.id,c,next,
      'wp10_pristine_product_projection:'||p_packet_sha256,array['sourceDispensingProfileId','medicationMetadata']);
    n:=n+1;
  end loop;
  if n<>108 then raise exception 'wp10_exact_dispensing108_required'; end if;
  return n;
end $f$;
revoke all on function private.clair_wp10_project_dispensing(text,text) from public,anon,authenticated,service_role;

-- Positive field allowlist: identities, import history, immutable revisions,
-- catalog revision counters and workspace-local lab pins are never copied.
create function private.clair_wp10_common_catalog_values(c public.order_catalog_items)
returns jsonb language sql immutable set search_path=pg_catalog as $f$
select jsonb_object_agg(key,value) from jsonb_each(to_jsonb(c)) where key=any(array[
 'standard_order_id','source_preset_version','category_group','category_label','t_code','t_code_label',
 'standard_order_name','in_hospital_order_name','billing_name','aliases','availability_status','price_krw','sales_unit',
 'target_species','default_destination_module','default_task_required','billing_reflection_enabled','care_guide',
 'care_guide_delivery_enabled','internal_instruction','internal_instruction_delivery_enabled','tax_included','rounding_rule',
 'pricing_rule','medication_metadata','vaccine_metadata','last_auto_merged_preset_version','customization_state','customized_fields',
 'last_customized_at','last_customized_by_user_id','preset_merge_status','origin_type','source_master_record_id',
 'admin_subcategory_code','lab_family_code','taxonomy_source_baseline','taxonomy_merge_conflict',
 'source_master_revision','last_auto_merged_revision','classification_path_id','source_projection_snapshot','source_projection_fingerprint',
 'clinical_order_type','is_external_lab','destination_module','execution_mode','detail_schema_version','detail_field_schema','billing_eligible',
 'source_dispensing_profile_id','source_dispensing_profile_revision','source_medication_product_id','source_medication_product_revision',
 'source_clinical_review_id','source_evidence_fingerprint','clinical_use_allowed','dispensing_profile_snapshot','dispensing_profile_snapshot_sha256',
 'workspace_dispensing_review_status','workspace_dispensing_review_revision','workspace_dispensing_authored_by_user_id',
 'workspace_dispensing_authored_at','workspace_dispensing_reviewed_by_user_id','workspace_dispensing_reviewed_at','workspace_dispensing_review_note',
 'default_detail_inputs','default_detail_input_policies','source_execution_preset_id','source_execution_preset_revision','source_execution_preset_sha256',
 'execution_source_baseline','execution_merge_conflicts','archived_at']);
$f$;
revoke all on function private.clair_wp10_common_catalog_values(public.order_catalog_items) from public,anon,authenticated,service_role;

create function private.clair_wp10_copy_pristine_catalog(p_workspace_id text,p_baseline_sha256 text,p_packet_sha256 text)
returns integer language plpgsql security invoker set search_path=pg_catalog,public,private,master as $f$
declare baseline public.order_catalog_items; c public.order_catalog_items; next public.order_catalog_items;
  values_json jsonb; columns_sql text; expected text; n integer:=0;
begin
  if p_workspace_id<>all(array['clair-demo','workspace-clair-cheongdam','workspace-clinical-master-pilot-v1'])
    or auth.uid() is null or not private.clair_is_active_workspace_member(p_workspace_id)
    or not private.clair_current_user_has_workspace_permission(p_workspace_id,'service_catalog:manage')
    or p_packet_sha256 is null or p_packet_sha256 !~ '^[a-f0-9]{64}$' then raise exception 'wp10_copy_scope_invalid'; end if;
  -- Exact baseline/target membership must remain stable through readback.
  lock table public.order_catalog_items in share row exclusive mode;
  select private.clinical_master_sha256(jsonb_agg(private.clair_wp10_common_catalog_values(i) order by i.standard_order_id)) into expected
    from public.order_catalog_items i where workspace_id='clair-foreign-demo' and archived_at is null;
  if expected is distinct from p_baseline_sha256 then raise exception 'wp10_pristine_baseline_drift'; end if;
  for baseline in select * from public.order_catalog_items where workspace_id='clair-foreign-demo' and archived_at is null order by id loop
    if baseline.origin_type<>'clair_master' or baseline.customization_state<>'unmodified' or cardinality(baseline.customized_fields)>0
      or baseline.classification_path_id is null or baseline.clinical_use_allowed
      or baseline.workspace_dispensing_authored_by_user_id is not null or baseline.workspace_dispensing_reviewed_by_user_id is not null
      or not exists(select 1 from master.master_records m join master.order_execution_preset_current p on p.order_record_id=m.id
        where m.id=baseline.source_master_record_id and m.current_revision=baseline.source_master_revision and m.lifecycle_status='published'
          and p.preset_id=baseline.source_execution_preset_id and p.preset_revision=baseline.source_execution_preset_revision)
      then raise exception 'wp10_baseline_not_pristine'; end if;
    select * into strict c from public.order_catalog_items where workspace_id=p_workspace_id and source_master_record_id=baseline.source_master_record_id for update;
    values_json:=private.clair_wp10_common_catalog_values(baseline);
    if private.clair_wp10_common_catalog_values(c)=values_json then n:=n+1; continue; end if;
    select string_agg(quote_ident(key),',' order by key) into columns_sql from jsonb_object_keys(values_json) key;
    execute format('update public.order_catalog_items set (%s)=(select %s from jsonb_populate_record(null::public.order_catalog_items,$1)),catalog_revision=catalog_revision+1,updated_at=now() where workspace_id=$2 and id=$3 returning *',columns_sql,columns_sql)
      into next using values_json,p_workspace_id,c.id;
    if private.clair_wp10_common_catalog_values(next) is distinct from values_json then raise exception 'wp10_projection_trigger_drift'; end if;
    perform private.clair_pr020_append_order_catalog_audit(p_workspace_id,'order_catalog.updated',c.id,c,next,
      'wp10_pristine_master_reset:'||p_packet_sha256,array['sourceMasterRevision','defaultDetailInputs','customizedFields']);
    n:=n+1;
  end loop;
  if n<>524 then raise exception 'wp10_exact_pristine524_required'; end if;
  return n;
end $f$;
revoke all on function private.clair_wp10_copy_pristine_catalog(text,text,text) from public,anon,authenticated,service_role;

create function private.clair_wp10_archive_extra_catalogs(p_workspace_id text,p_master_keys text[],p_expected_extra_ids text[],p_packet_sha256 text)
returns integer language plpgsql security invoker set search_path=pg_catalog,public,private,master as $f$
declare actual_ids text[]; expected_ids text[]; c public.order_catalog_items; next public.order_catalog_items; n integer:=0;
begin
  if p_workspace_id<>all(array['clair-demo','clair-foreign-demo','workspace-clair-cheongdam','workspace-clinical-master-pilot-v1'])
    or auth.uid() is null or not private.clair_is_active_workspace_member(p_workspace_id)
    or not private.clair_current_user_has_workspace_permission(p_workspace_id,'service_catalog:manage')
    or cardinality(p_master_keys) is distinct from 524
    or (select count(distinct k) from unnest(p_master_keys) k)<>524
    or p_packet_sha256 is null or p_packet_sha256 !~ '^[a-f0-9]{64}$' then raise exception 'wp10_archive_scope_invalid'; end if;
  lock table public.order_catalog_items in share row exclusive mode;
  select coalesce(array_agg(item.id order by item.id),'{}') into actual_ids from public.order_catalog_items item
    left join master.master_records m on m.id=item.source_master_record_id
    where item.workspace_id=p_workspace_id and (item.origin_type<>'clair_master' or m.master_key is null or not m.master_key=any(p_master_keys));
  select coalesce(array_agg(id order by id),'{}') into expected_ids from unnest(p_expected_extra_ids) id;
  if actual_ids is distinct from expected_ids then raise exception 'wp10_archive_preflight_drift'; end if;
  for c in select * from public.order_catalog_items where workspace_id=p_workspace_id and id=any(actual_ids) order by id for update loop
    if c.archived_at is not null and c.availability_status='inactive' then continue; end if;
    update public.order_catalog_items set availability_status='inactive',archived_at=now(),catalog_revision=catalog_revision+1,updated_at=now()
      where workspace_id=p_workspace_id and id=c.id returning * into next;
    perform private.clair_pr020_append_order_catalog_audit(p_workspace_id,'order_catalog.updated',c.id,c,next,
      'wp10_archive_preserve_history:'||p_packet_sha256,array['availabilityStatus','archivedAt']);
    n:=n+1;
  end loop;
  return n;
end $f$;
revoke all on function private.clair_wp10_archive_extra_catalogs(text,text[],text[],text) from public,anon,authenticated,service_role;

create function private.clair_wp10_clinical_history_fingerprint()
returns jsonb language plpgsql stable security invoker set search_path=pg_catalog,public,private as $f$
declare name text; fingerprint jsonb; result jsonb:='{}';
  scopes constant text[]:=array['clair-demo','clair-foreign-demo','workspace-clair-cheongdam','workspace-clinical-master-pilot-v1'];
begin
  foreach name in array array['patients','encounters','orders','order_tasks','order_task_events','order_confirmation_commands',
    'order_fulfillment_work_items','order_billing_candidates','order_execution_result_versions','lab_result_entries',
    'lab_result_entry_rows','lab_atomic_retest_requests','invoices','invoice_lines','invoice_adjustments','payments','payment_allocations'] loop
    execute format($sql$select jsonb_build_object('count',count(*),'sha256',
      encode(extensions.digest(coalesce(string_agg(row_hash,'' order by row_hash),''),'sha256'),'hex'))
      from (select encode(extensions.digest(to_jsonb(row_value)::text,'sha256'),'hex') row_hash
        from public.%I row_value where workspace_id=any($1)) hashes$sql$,name) into fingerprint using scopes;
    result:=jsonb_set(result,array[name],fingerprint);
  end loop;
  return result;
end $f$;
revoke all on function private.clair_wp10_clinical_history_fingerprint() from public,anon,authenticated,service_role;

-- Private operator helper; the outer packet must freeze the configuration and
-- every target's before fingerprint. Public registration/binding/composer RPCs
-- retain their normal workspace/permission and immutable-history checks.
create function private.clair_wp10_normalize_resources(p_workspace_id text,p_config jsonb,p_packet_sha text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,private,master as $f$
declare x jsonb; profile_id uuid; catalog_id text; before_value jsonb; after_value jsonb;
  device public.workspace_lab_devices; binding public.workspace_lab_result_profile_bindings;
  current_set public.order_sets; source_revision uuid; v_request_id uuid; set_id text; canonical_sets text[]:='{}';
  result jsonb; location public.workspace_inpatient_locations; original_revision uuid;
begin
  if p_workspace_id<>all(array['clair-demo','clair-foreign-demo','workspace-clair-cheongdam','workspace-clinical-master-pilot-v1'])
    or coalesce(p_packet_sha,'') !~ '^[0-9a-f]{64}$' or auth.uid() is null or not private.clair_is_workspace_admin(p_workspace_id) then
    raise exception 'wp10_resource_scope_invalid'; end if;
  if (select count(*) from jsonb_array_elements(p_config->'devices') r where r->>'workspaceId'=p_workspace_id)<>3
    or (select count(*) from jsonb_array_elements(p_config->'bindings') r where r->>'workspaceId'=p_workspace_id)<>173
    or (select count(*) from jsonb_array_elements(p_config->'compositions') r where r->>'workspaceId'=p_workspace_id)<>30
    or (select count(*) from jsonb_array_elements(p_config->'locations') r where r->>'workspaceId'=p_workspace_id)<>1 then
    raise exception 'wp10_resource_configuration_incomplete'; end if;
  perform pg_advisory_xact_lock(hashtextextended('clinical_master_workspace_adoption:'||p_workspace_id,0));
  -- Lock current-pointer tables before comparing, then use row-revision CAS.
  lock table public.workspace_lab_devices,public.workspace_lab_result_profile_bindings,public.order_sets,
    public.workspace_inpatient_locations in share row exclusive mode;
  for x in select value from jsonb_array_elements(p_config->'devices') where value->>'workspaceId'=p_workspace_id order by value->>'id' loop
    select id into strict profile_id from master.lab_result_profile_versions p where p.definition#>>'{device,manufacturer}'='CLAiR'
      and p.definition#>>'{device,model}'=x->>'model' and p.definition#>>'{device,kind}'='manual' order by p.id limit 1;
    perform public.clair_register_workspace_lab_device(p_workspace_id,(x->>'id')::uuid,x->>'name',profile_id);
    select * into strict device from public.workspace_lab_devices where workspace_id=p_workspace_id and id=(x->>'id')::uuid for update;
    if not device.active then
      update public.workspace_lab_devices set active=true,row_revision=row_revision+1 where workspace_id=p_workspace_id and id=device.id returning to_jsonb(workspace_lab_devices.*) into after_value;
      insert into public.workspace_lab_profile_events(workspace_id,actor_user_id,event_type,target_id,before_snapshot,after_snapshot)
        values(p_workspace_id,auth.uid(),'wp10_device_reactivated:'||p_packet_sha,device.id::text,to_jsonb(device),after_value);
    end if;
  end loop;
  for binding in select b.* from public.workspace_lab_result_profile_bindings b
    where b.workspace_id=p_workspace_id and not exists(select 1 from jsonb_array_elements(p_config->'bindings') proposed
      join public.order_catalog_items c on c.workspace_id=p_workspace_id and c.standard_order_id=proposed->>'orderMasterKey'
      where proposed->>'workspaceId'=p_workspace_id and c.id=b.order_catalog_item_id and proposed->>'species'=b.species) for update loop
    -- Orders pin immutable profile/device/override versions, not this pointer.
    delete from public.workspace_lab_result_profile_bindings where workspace_id=p_workspace_id
      and order_catalog_item_id=binding.order_catalog_item_id and species=binding.species;
    insert into public.workspace_lab_profile_events(workspace_id,actor_user_id,event_type,target_id,before_snapshot,after_snapshot)
      values(p_workspace_id,auth.uid(),'wp10_extra_binding_removed:'||p_packet_sha,binding.order_catalog_item_id,to_jsonb(binding),'{}');
  end loop;
  for x in select value from jsonb_array_elements(p_config->'bindings') where value->>'workspaceId'=p_workspace_id order by value->>'orderMasterKey',value->>'species' loop
    select id into strict catalog_id from public.order_catalog_items where workspace_id=p_workspace_id and standard_order_id=x->>'orderMasterKey' and archived_at is null;
    select * into binding from public.workspace_lab_result_profile_bindings where workspace_id=p_workspace_id and order_catalog_item_id=catalog_id and species=x->>'species' for update;
    if binding.override_version_id is not null then
      before_value:=to_jsonb(binding);
      update public.workspace_lab_result_profile_bindings set override_version_id=null,row_revision=row_revision+1,selected_by_user_id=auth.uid(),selected_at=now()
        where workspace_id=p_workspace_id and order_catalog_item_id=catalog_id and species=binding.species returning * into binding;
      insert into public.workspace_lab_profile_events(workspace_id,actor_user_id,event_type,target_id,before_snapshot,after_snapshot)
        values(p_workspace_id,auth.uid(),'wp10_override_pointer_reset:'||p_packet_sha,catalog_id,before_value,to_jsonb(binding));
    end if;
    perform public.clair_bind_workspace_lab_result_profile(p_workspace_id,catalog_id,(x->>'profileVersionId')::uuid,(x->>'deviceId')::uuid,coalesce(binding.row_revision,0));
  end loop;
  for x in select value from jsonb_array_elements(p_config->'compositions') where value->>'workspaceId'=p_workspace_id order by value->>'masterKey' loop
    if x->>'billingPolicy'<>'preserve_parent_price' then raise exception 'wp10_composition_billing_invalid'; end if;
    set_id:='lab-composition:'||private.clair_b2_deterministic_uuid('lab-composition',array[p_workspace_id,x->>'masterKey'])::text;
    canonical_sets:=array_append(canonical_sets,set_id);
    select * into current_set from public.order_sets where workspace_id=p_workspace_id and id=set_id for update;
    v_request_id:=private.clair_b2_deterministic_uuid('wp10-composition',array[p_packet_sha,p_workspace_id,x->>'masterKey']);
    select outcome into result from public.workspace_lab_composition_apply_requests where workspace_id=p_workspace_id and request_id=v_request_id;
    if found and (result->>'orderSetRevisionId' is distinct from current_set.current_revision_id::text
      or result->>'compositionVersionId' is distinct from x->>'versionId') then raise exception 'wp10_composition_retry_drift'; end if;
    original_revision:=current_set.current_revision_id;
    before_value:=coalesce(to_jsonb(current_set),'{}');
    -- Explicitly reconcile a workspace-authored current revision through its
    -- last immutable source revision; never forge source provenance for it.
    if current_set.id is not null and not exists(select 1 from public.workspace_lab_composition_revisions r
      where r.workspace_id=p_workspace_id and r.order_set_revision_id=current_set.current_revision_id) then
      select r.order_set_revision_id into source_revision from public.workspace_lab_composition_revisions r
        join public.order_set_revisions sr on sr.workspace_id=r.workspace_id and sr.id=r.order_set_revision_id
        where r.workspace_id=p_workspace_id and r.order_set_id=set_id order by sr.revision_no desc limit 1;
      if source_revision is null then raise exception 'wp10_canonical_set_identity_collision'; end if;
      perform private.clair_b2_apply_projection(p_workspace_id,set_id,source_revision,current_set.availability_status,false,auth.uid());
      current_set.current_revision_id:=source_revision;
    end if;
    -- Same exact reset request is a no-op. The composer stores the CAS input
    -- hash, so a repeated operator uses the prior request's original CAS value.
    v_request_id:=private.clair_b2_deterministic_uuid('wp10-composition',array[p_packet_sha,p_workspace_id,x->>'masterKey']);
    if not exists(select 1 from public.workspace_lab_composition_apply_requests where workspace_id=p_workspace_id and request_id=v_request_id) then
      result:=public.clair_apply_lab_composition(p_workspace_id,(x->>'versionId')::uuid,x->>'billingPolicy',current_set.current_revision_id,v_request_id);
    end if;
    select * into strict current_set from public.order_sets where workspace_id=p_workspace_id and id=set_id;
    if current_set.archived_at is not null then update public.order_sets set archived_at=null where workspace_id=p_workspace_id and id=set_id; end if;
    if current_set.availability_status<>'active' or current_set.needs_composition_review then
      perform private.clair_b2_apply_projection(p_workspace_id,set_id,current_set.current_revision_id,'active',false,auth.uid());
    end if;
    select to_jsonb(s) into after_value from public.order_sets s where workspace_id=p_workspace_id and id=set_id;
    if before_value is distinct from after_value then
      insert into public.audit_events(id,workspace_id,actor_user_id,event_type,target_type,target_id,reason,before_snapshot,after_snapshot,metadata)
        values(extensions.gen_random_uuid()::text,p_workspace_id,auth.uid(),'order_catalog.updated','order_set',set_id,'wp10_master_pristine_reset',before_value,after_value,jsonb_build_object('packetSha256',p_packet_sha));
    end if;
  end loop;
  for current_set in select * from public.order_sets where workspace_id=p_workspace_id and not id=any(canonical_sets) and archived_at is null for update loop
    before_value:=to_jsonb(current_set);
    perform set_config('clinical_master.b2_internal_write','on',true);
    update public.order_sets set availability_status='inactive',archived_at=now(),updated_by_user_id=auth.uid(),updated_at=now()
      where workspace_id=p_workspace_id and id=current_set.id returning to_jsonb(order_sets.*) into after_value;
    insert into public.audit_events(id,workspace_id,actor_user_id,event_type,target_type,target_id,reason,before_snapshot,after_snapshot,metadata)
      values(extensions.gen_random_uuid()::text,p_workspace_id,auth.uid(),'order_catalog.updated','order_set',current_set.id,'wp10_extra_set_archived',before_value,after_value,jsonb_build_object('packetSha256',p_packet_sha));
  end loop;
  select value into strict x from jsonb_array_elements(p_config->'locations') where value->>'workspaceId'=p_workspace_id;
  select * into location from public.workspace_inpatient_locations where workspace_id=p_workspace_id and id=(x->>'id')::uuid for update;
  if location.id is null or location.label is distinct from x->>'label' or not location.active or location.kind is distinct from x->>'kind' then
    perform public.clair_save_workspace_inpatient_location(p_workspace_id,(x-'workspaceId')||jsonb_build_object('active',true,'expectedRevision',coalesce(location.row_revision,0)));
  end if;
  for location in select * from public.workspace_inpatient_locations where workspace_id=p_workspace_id
    and is_default is distinct from (id=(x->>'id')::uuid) order by is_default desc,id for update loop
    before_value:=to_jsonb(location);
    update public.workspace_inpatient_locations set is_default=(id=(x->>'id')::uuid),row_revision=row_revision+1,updated_by_user_id=auth.uid(),updated_at=now()
      where workspace_id=p_workspace_id and id=location.id returning to_jsonb(workspace_inpatient_locations.*) into after_value;
    insert into public.workspace_inpatient_location_events(workspace_id,location_id,actor_user_id,before_snapshot,after_snapshot)
      values(p_workspace_id,location.id,auth.uid(),before_value,after_value);
  end loop;
  return jsonb_build_object('workspaceId',p_workspace_id,'bindings',173,'compositions',30,'devices',3);
end $f$;
revoke all on function private.clair_wp10_normalize_resources(text,jsonb,text) from public,anon,authenticated,service_role;

create function private.clair_wp10_enable_service_review(p_workspace_id text,p_packet_sha text) returns void
language plpgsql security definer set search_path=pg_catalog,public,private,master as $f$
declare profile_release uuid;
begin
  if p_workspace_id<>all(array['clair-demo','clair-foreign-demo','workspace-clair-cheongdam','workspace-clinical-master-pilot-v1'])
    or coalesce(p_packet_sha,'') !~ '^[0-9a-f]{64}$' or auth.uid() is null or not private.clair_is_workspace_admin(p_workspace_id) then
    raise exception 'wp10_service_review_scope_invalid'; end if;
  if (select count(*) from public.order_catalog_items where workspace_id=p_workspace_id and archived_at is null and source_dispensing_profile_id is not null)<>108 then
    raise exception 'wp10_service_review_profile_count'; end if;
  for profile_release in select distinct p.source_release_id from public.order_catalog_items c join master.dispensing_order_profiles p
    on p.id=c.source_dispensing_profile_id and p.profile_revision=c.source_dispensing_profile_revision
    where c.workspace_id=p_workspace_id and c.archived_at is null loop
    if private.clair_dispensing_service_review_allowed(p_workspace_id,profile_release) then continue; end if;
    insert into private.clinical_master_dispensing_service_review_events(workspace_id,release_id,action,review_mode,actor_user_id,approval_reference,reason)
      values(p_workspace_id,profile_release,'enabled','service_operations_review',auth.uid(),'wp10:'||p_packet_sha,
        'User-approved four synthetic workspace functional verification; no clinical approval.');
  end loop;
end $f$;
revoke all on function private.clair_wp10_enable_service_review(text,text) from public,anon,authenticated,service_role;

create table private.wp10_ready_orders_receipt (
  release_key text primary key check(release_key='cm.release.ready-orders.2026-09-08.v1'),
  packet_sha256 text not null check(packet_sha256 ~ '^[a-f0-9]{64}$'),
  outcome jsonb not null,created_at timestamptz not null default now()
);
revoke all on private.wp10_ready_orders_receipt from public,anon,authenticated,service_role;

create function private.clair_wp10_state_fingerprint() returns jsonb
language plpgsql security invoker set search_path=pg_catalog,public,private,master as $f$
declare result jsonb:=private.clair_oed_20260906_fingerprints(); r record; scope text; fingerprint jsonb;
  targets text[]:=array['clair-demo','clair-foreign-demo','workspace-clair-cheongdam','workspace-clinical-master-pilot-v1'];
begin
  for r in select schemaname,tablename from pg_tables where schemaname='master'
    or (schemaname='private' and tablename='clinical_master_dispensing_service_review_events') order by schemaname,tablename loop
    execute format('select jsonb_build_object(''schema'',$1,''table'',$2,''count'',count(*),''sha256'',encode(extensions.digest(coalesce(string_agg(hash,'''' order by hash),''''),''sha256''),''hex'')) from (select encode(extensions.digest(to_jsonb(t)::text,''sha256''),''hex'') hash from %I.%I t) rows',r.schemaname,r.tablename)
      into fingerprint using r.schemaname,r.tablename;
    result:=result||jsonb_build_array(fingerprint);
  end loop;
  foreach scope in array targets loop
    for r in select unnest(array['workspace_inpatient_locations','workspace_inpatient_location_events','user_memberships',
      'workspace_permission_roles','workspace_membership_permission_role_assignments']) as tablename loop
      execute format('select jsonb_build_object(''workspaceId'',$1,''tableName'',$2,''count'',count(*),''sha256'',encode(extensions.digest(coalesce(string_agg(hash,'''' order by hash),''''),''sha256''),''hex'')) from (select encode(extensions.digest(to_jsonb(t)::text,''sha256''),''hex'') hash from public.%I t where workspace_id=$1) rows',r.tablename)
        into fingerprint using scope,r.tablename;
      result:=result||jsonb_build_array(fingerprint);
    end loop;
  end loop;
  return jsonb_build_object('state',result,'clinicalHistory',private.clair_wp10_clinical_history_fingerprint());
end $f$;
revoke all on function private.clair_wp10_state_fingerprint() from public,anon,authenticated,service_role;

create function private.clair_apply_wp10_ready_orders(p_packet jsonb,p_packet_sha text,p_commit boolean default false) returns jsonb
language plpgsql security invoker set search_path=pg_catalog,public,private,master as $f$
declare targets text[]:=array['clair-demo','clair-foreign-demo','workspace-clair-cheongdam','workspace-clinical-master-pilot-v1'];
  proposal jsonb:=p_packet->'proposal'; resources jsonb:=p_packet->'resources'; prices jsonb:=p_packet->'prices';
  receipt private.wp10_ready_orders_receipt; before_state jsonb; after_state jsonb; history_before jsonb; outcome jsonb;
  w text; actor uuid; original_actor text:=current_setting('request.jwt.claim.sub',true); v_release_id uuid; result jsonb;
  keys text[]; retired text[]; extras text[]; baseline_sha text; price jsonb; v_catalog public.order_catalog_items; next public.order_catalog_items;
  review record; revision integer; defaults jsonb; n integer; sequence_before jsonb; sequence_after jsonb;
begin
  if p_commit is null or private.clinical_master_sha256(p_packet) is distinct from p_packet_sha
    or proposal#>>'{payload,releaseKey}' is distinct from 'cm.release.ready-orders.2026-09-08.v1'
    or resources->'workspaceAllowlist' is distinct from to_jsonb(targets)
    or proposal->'applied' is distinct from 'false'::jsonb then raise exception 'wp10_packet_contract_invalid'; end if;
  select array_agg(value order by value) into keys from jsonb_array_elements_text(proposal->'selectableKeys');
  select array_agg(value order by value) into retired from jsonb_array_elements_text(proposal->'retiredKeys');
  if cardinality(keys)<>524 or cardinality(retired)<>51 or keys && retired
    or (select count(distinct k) from unnest(keys) k)<>524 or (select count(distinct k) from unnest(retired) k)<>51
    or jsonb_array_length(prices->'entries')<>524 or jsonb_array_length(resources->'devices')<>12
    or jsonb_array_length(resources->'bindings')<>692 or jsonb_array_length(resources->'compositions')<>120 then
    raise exception 'wp10_packet_scope_invalid'; end if;
  if (select array_agg(r->>'masterKey' order by r->>'masterKey')
      from jsonb_array_elements(proposal#>'{payload,records}') r where r->>'recordType'='order')
      is distinct from (select array_agg(k order by k) from unnest(keys||retired) k)
    or exists(select 1 from jsonb_array_elements(proposal#>'{payload,records}') r where r->>'recordType'='order'
      and r->>'lifecycleStatus' is distinct from (case when r->>'masterKey'=any(retired) then 'deprecated' else 'published' end))
    or (select array_agg(p->>'orderMasterKey' order by p->>'orderMasterKey') from jsonb_array_elements(prices->'entries') p)
      is distinct from keys then raise exception 'wp10_packet_identity_scope_invalid'; end if;
  -- Publisher first, workspace locks in deterministic order. Current pointer
  -- tables are locked before checking the full before fingerprint.
  perform pg_advisory_xact_lock(hashtextextended('clinical_master_phase_1a1_publication',0));
  foreach w in array targets loop
    actor:=nullif(p_packet#>>array['actors',w],'')::uuid;
    if actor is null or not private.clair_user_has_workspace_permission(w,actor,'service_catalog:manage')
      or not private.clair_user_has_workspace_permission(w,actor,'hospital_settings:manage') then
      raise exception 'wp10_existing_operator_permission_missing:%',w using errcode='42501'; end if;
    perform pg_advisory_xact_lock(hashtextextended('clinical_master_workspace_adoption:'||w,0));
  end loop;
  lock table private.wp10_ready_orders_receipt,public.order_catalog_items,public.workspace_lab_devices,
    public.workspace_lab_result_profile_bindings,public.order_sets,public.workspace_inpatient_locations in share row exclusive mode;
  select * into receipt from private.wp10_ready_orders_receipt where release_key='cm.release.ready-orders.2026-09-08.v1';
  if found then
    if receipt.packet_sha256 is distinct from p_packet_sha then raise exception 'wp10_receipt_packet_conflict'; end if;
    if private.clair_wp10_state_fingerprint() is distinct from receipt.outcome->'afterState' then raise exception 'wp10_receipt_state_drift'; end if;
    return receipt.outcome;
  end if;
  select coalesce(jsonb_object_agg(sequencename,last_value),'{}'::jsonb) into sequence_before from pg_sequences where schemaname='master';
  before_state:=private.clair_wp10_state_fingerprint();
  if before_state is distinct from p_packet#>'{preflight,state}' then raise exception 'wp10_preflight_drift' using errcode='40001'; end if;
  if exists(select 1 from public.order_catalog_items where workspace_id='clair-foreign-demo') then raise exception 'wp10_pristine_baseline_not_empty'; end if;
  if exists(select 1 from jsonb_array_elements(resources->'bindings') b where not exists(
      select 1 from jsonb_array_elements(proposal#>'{payload,labResultProfiles}') p where p->>'id'=b->>'profileVersionId' and p->>'species'=b->>'species'
        and p->'clinicalUseAllowed'='false'::jsonb and p#>>'{device,kind}'='manual')
    or not exists(select 1 from jsonb_array_elements(resources->'devices') d where d->>'workspaceId'=b->>'workspaceId' and d->>'id'=b->>'deviceId'))
    or exists(select 1 from jsonb_array_elements(resources->'compositions') c where not exists(
      select 1 from jsonb_array_elements(proposal#>'{payload,labCompositions}') source where source->>'id'=c->>'versionId' and source->>'masterKey'=c->>'masterKey')) then
    raise exception 'wp10_resource_source_mismatch'; end if;
  history_before:=private.clair_wp10_clinical_history_fingerprint();
  begin
    actor:=(p_packet#>>'{actors,clair-foreign-demo}')::uuid;
    perform set_config('request.jwt.claim.sub',actor::text,true);
    result:=private.publish_clinical_master_release(proposal->'payload',actor); v_release_id:=(result->>'releaseId')::uuid;
    perform private.clair_wp10_apply_retirement(v_release_id,retired,actor,p_packet_sha);
    perform private.clair_adopt_master_release_to_workspace('clair-foreign-demo',v_release_id);
    perform private.clair_wp10_project_dispensing('clair-foreign-demo',p_packet_sha);
    -- Establish the one pristine catalog without workspace-authored identities.
    for price in select value from jsonb_array_elements(prices->'entries') order by value->>'orderMasterKey' loop
      select * into strict v_catalog from public.order_catalog_items where workspace_id='clair-foreign-demo' and standard_order_id=price->>'orderMasterKey' for update;
      update public.order_catalog_items set price_krw=(price->>'priceKrw')::integer,
        billing_reflection_enabled=(price->>'billingReflectionEnabled')::boolean,billing_eligible=(price->>'billingReflectionEnabled')::boolean,
        pricing_rule=jsonb_build_object('priceKrw',price->'priceKrw'),availability_status=case when source_dispensing_profile_id is null then 'active' else 'pending_activation' end,
        catalog_revision=catalog_revision+1 where workspace_id='clair-foreign-demo' and id=v_catalog.id returning * into next;
      perform private.clair_pr020_append_order_catalog_audit('clair-foreign-demo','order_catalog.updated',v_catalog.id,v_catalog,next,'wp10_common_synthetic_price:'||p_packet_sha,array['priceKrw','billingReflectionEnabled']);
    end loop;
    select coalesce(array_agg(c.id),'{}') into extras from public.order_catalog_items c left join master.master_records m on m.id=c.source_master_record_id
      where c.workspace_id='clair-foreign-demo' and (m.master_key is null or not m.master_key=any(keys));
    perform private.clair_wp10_archive_extra_catalogs('clair-foreign-demo',keys,extras,p_packet_sha);
    select private.clinical_master_sha256(jsonb_agg(private.clair_wp10_common_catalog_values(c) order by c.standard_order_id)) into baseline_sha
      from public.order_catalog_items c where c.workspace_id='clair-foreign-demo' and c.archived_at is null;
    foreach w in array array['clair-demo','workspace-clair-cheongdam','workspace-clinical-master-pilot-v1'] loop
      actor:=(p_packet#>>array['actors',w])::uuid; perform set_config('request.jwt.claim.sub',actor::text,true);
      perform private.clair_adopt_master_release_to_workspace(w,v_release_id);
      for price in select value from jsonb_array_elements(prices->'entries') order by value->>'orderMasterKey' loop
        select * into strict v_catalog from public.order_catalog_items where workspace_id=w and standard_order_id=price->>'orderMasterKey' for update;
        if v_catalog.price_krw is distinct from (price->>'priceKrw')::integer then
          update public.order_catalog_items set price_krw=(price->>'priceKrw')::integer,
            pricing_rule=jsonb_set(pricing_rule,'{priceKrw}',price->'priceKrw'),catalog_revision=catalog_revision+1
            where workspace_id=w and id=v_catalog.id returning * into next;
          perform private.clair_pr020_append_order_catalog_audit(w,'order_catalog.updated',v_catalog.id,v_catalog,next,'wp10_source_accept_price_preparation:'||p_packet_sha,array['priceKrw']);
        end if;
      end loop;
      for review in select u.* from public.workspace_master_updates u join master.master_records m on m.id=u.source_master_record_id
        where u.workspace_id=w and u.release_id=v_release_id and u.status='pending' and m.master_key=any(keys) order by u.id loop
        select catalog_revision into strict revision from public.order_catalog_items where workspace_id=w and id=review.order_catalog_item_id;
        perform public.clair_resolve_workspace_master_update(w,review.id,revision,'accept_source');
      end loop;
      for review in select u.* from public.workspace_lab_catalog_updates u where u.workspace_id=w and u.source_release_id=v_release_id and u.status='pending' order by u.id loop
        select catalog_revision into strict revision from public.order_catalog_items where workspace_id=w and id=review.order_catalog_item_id;
        result:=public.clair_resolve_workspace_lab_definition_update(w,review.id,actor,revision,'accept');
        if result->>'cascadeOnly' is distinct from 'true' then raise exception 'wp10_unexpected_lab_membership_change'; end if;
      end loop;
      perform private.clair_wp10_copy_pristine_catalog(w,baseline_sha,p_packet_sha);
      select coalesce(array_agg(c.id),'{}') into extras from public.order_catalog_items c left join master.master_records m on m.id=c.source_master_record_id
        where c.workspace_id=w and (c.origin_type<>'clair_master' or m.master_key is null or not m.master_key=any(keys));
      perform private.clair_wp10_archive_extra_catalogs(w,keys,extras,p_packet_sha);
    end loop;
    foreach w in array targets loop
      actor:=(p_packet#>>array['actors',w])::uuid; perform set_config('request.jwt.claim.sub',actor::text,true);
      perform private.clair_wp10_enable_service_review(w,p_packet_sha);
      perform private.clair_wp10_normalize_resources(w,resources,p_packet_sha);
      select count(*) into n from public.order_catalog_items c where c.workspace_id=w and c.archived_at is null
        and c.classification_path_id is not null and c.admin_subcategory_code is not null and c.customization_state='unmodified'
        and (c.availability_status='active' or private.clair_dispensing_service_review_catalog_item_allowed(w,c.id));
      if n<>524 then raise exception 'wp10_selectable_classified524_missing:%:%',w,n; end if;
      for v_catalog in select * from public.order_catalog_items where workspace_id=w and archived_at is null loop
        if private.clair_lab_catalog_has_active_composition(w,v_catalog.id) then continue; end if;
        defaults:=private.clair_catalog_effective_default_detail_inputs(v_catalog)-array['planOrderAuthority','manualQuantityReason','autoDispenseQuantityEnabled'];
        -- Structural readiness uses a verified active actor identity only as a
        -- validator probe; no encounter/order or reusable clinician default is written.
        if v_catalog.clinical_order_type='consultation' then defaults:=private.clair_pr022_resolve_consultation_detail_inputs(defaults,actor); end if;
        if not private.clair_order_detail_inputs_are_valid(v_catalog.clinical_order_type,v_catalog.detail_schema_version,defaults,true) then raise exception 'wp10_required_default_invalid:%:%',w,v_catalog.standard_order_id; end if;
      end loop;
      if (select count(*) from public.workspace_lab_result_profile_bindings where workspace_id=w and override_version_id is null)<>173
        or (select count(*) from public.order_sets where workspace_id=w and availability_status='active' and archived_at is null)<>30
        or (select count(*) from public.workspace_inpatient_locations where workspace_id=w and active and is_default)<>1 then raise exception 'wp10_resource_readback_failed'; end if;
    end loop;
    if private.clair_wp10_clinical_history_fingerprint() is distinct from history_before then raise exception 'wp10_clinical_history_changed'; end if;
    after_state:=private.clair_wp10_state_fingerprint();
    select coalesce(jsonb_object_agg(sequencename,last_value),'{}'::jsonb) into sequence_after from pg_sequences where schemaname='master';
    outcome:=jsonb_build_object('releaseId',v_release_id,'packetSha256',p_packet_sha,'applied',p_commit,'rehearsal',not p_commit,
      'masterSequenceBefore',sequence_before,'masterSequenceAfter',sequence_after,'sequenceRollbackSupported',false,
      'workspaceIds',targets,'catalogsPerWorkspace',524,'bindingsPerWorkspace',173,'setsPerWorkspace',30,'beforeState',before_state,'afterState',after_state,'clinicalApprovalGranted',false);
    if not p_commit then raise exception 'wp10_rehearsal_complete' using errcode='P0910'; end if;
    insert into private.wp10_ready_orders_receipt(release_key,packet_sha256,outcome) values('cm.release.ready-orders.2026-09-08.v1',p_packet_sha,outcome);
  exception when sqlstate 'P0910' then
    if p_commit or outcome is null then raise; end if;
  end;
  perform set_config('request.jwt.claim.sub',coalesce(original_actor,''),true);
  if not p_commit and private.clair_wp10_state_fingerprint() is distinct from before_state then raise exception 'wp10_rehearsal_residue'; end if;
  return outcome;
end $f$;
revoke all on function private.clair_apply_wp10_ready_orders(jsonb,text,boolean) from public,anon,authenticated,service_role;
