-- Approved WP09 synthetic transition only. No automatic execution on deployment.
-- Existing clinical gates, products, reviews and confirmed history stay immutable.
set lock_timeout='5s';
set statement_timeout='120s';

create function private.clair_rebind_oed_synthetic_dispensing(
  p_workspace_id text,p_release_id uuid,p_expected jsonb
) returns jsonb language plpgsql security invoker set search_path=pg_catalog,public,private,master as $fn$
declare targets constant text[]:=array['clair-demo','workspace-clair-cheongdam','workspace-clinical-master-pilot-v1'];
  expected jsonb; c public.order_catalog_items; previous master.dispensing_order_profiles;
  next_profile master.dispensing_order_profiles; source master.master_records;
  preset master.order_execution_presets; snapshot jsonb; command_hash text;
  before_hash text; after_hash text; before_count integer; after_count integer;
  event private.clinical_master_dispensing_adoption_events; n integer:=0; revision integer;
begin
  if auth.uid() is null or not p_workspace_id=any(targets)
    or not private.clair_is_active_workspace_member(p_workspace_id)
    or not private.clair_current_user_has_workspace_permission(p_workspace_id,'service_catalog:manage') then
    raise exception 'synthetic_rebind_scope_denied' using errcode='42501'; end if;
  if jsonb_typeof(p_expected) is distinct from 'array' or jsonb_array_length(p_expected)<>108
    or (select count(distinct x->>'catalogId') from jsonb_array_elements(p_expected) x)<>108
    or (select count(distinct x->>'masterKey') from jsonb_array_elements(p_expected) x)<>108 then
    raise exception 'synthetic_rebind_exact108_required'; end if;
  if not exists(select 1 from master.master_releases where id=p_release_id and status='published'
    and release_key='cm.release.order-defaults-complete.2026-09-06.v1' and adoption_scope='payload') then
    raise exception 'synthetic_rebind_release_mismatch'; end if;
  perform pg_advisory_xact_lock(hashtextextended('clinical_master_workspace_adoption:'||p_workspace_id,0));
  perform pg_advisory_xact_lock(hashtextextended('clinical_master_dispensing_workspace_adoption:'||p_workspace_id,0));
  -- Serialize profile creation across the three workspace applications.
  perform pg_advisory_xact_lock(hashtextextended('oed_dispensing_profile_release:'||p_release_id::text,0));
  command_hash:=private.clinical_master_sha256(jsonb_build_object('workspace',p_workspace_id,'release',p_release_id,'expected',p_expected));
  select * into event from private.clinical_master_dispensing_adoption_events
    where workspace_id=p_workspace_id and release_id=p_release_id order by created_at,id limit 1;
  if found then
    if event.payload_sha256<>command_hash then raise exception 'synthetic_rebind_retry_conflict'; end if;
    return jsonb_build_object('eventId',event.id,'profileCount',event.profile_count,'clinicalUseAllowed',false);
  end if;
  select count(*),private.clinical_master_sha256(coalesce(jsonb_agg(to_jsonb(i) order by i.id),'[]'))
    into before_count,before_hash from public.order_catalog_items i where workspace_id=p_workspace_id;
  for expected in select value from jsonb_array_elements(p_expected) order by value->>'catalogId' loop
    select * into c from public.order_catalog_items where workspace_id=p_workspace_id and id=expected->>'catalogId' for update;
    if not found or c.catalog_revision is distinct from (expected->>'catalogRevision')::integer
      or private.clinical_master_sha256(to_jsonb(c)) is distinct from expected->>'catalogSha256'
      or c.source_dispensing_profile_id::text is distinct from expected->>'profileId'
      or c.source_dispensing_profile_revision is distinct from (expected->>'profileRevision')::integer
      or c.origin_type<>'clair_master' or c.customization_state='detached' then
      raise exception 'synthetic_rebind_catalog_conflict' using errcode='40001'; end if;
    select * into previous from master.dispensing_order_profiles where id=c.source_dispensing_profile_id
      and profile_revision=c.source_dispensing_profile_revision;
    if not found or private.clinical_master_sha256(to_jsonb(previous)) is distinct from expected->>'profileSha256'
      or previous.order_record_id<>c.source_master_record_id or previous.order_record_revision<>c.source_master_revision
      or previous.prescription_default_status<>'none' or previous.prescription_defaults is not null then
      raise exception 'synthetic_rebind_profile_conflict' using errcode='40001'; end if;
    select * into source from master.master_records where id=c.source_master_record_id;
    if source.master_key is distinct from expected->>'masterKey' or source.lifecycle_status<>'published'
      or source.safety_status<>'normal' or source.replacement_record_id is not null
      or source.current_revision<=c.source_master_revision
      or not exists(select 1 from private.clinical_master_release_payload_owner_manifest m where m.release_id=p_release_id
        and m.master_record_id=source.id and m.included and m.record_type='order' and m.effective_revision=source.current_revision) then
      raise exception 'synthetic_rebind_source_mismatch'; end if;
    select p.* into preset from master.order_execution_preset_current ptr join master.order_execution_presets p
      on p.order_record_id=ptr.order_record_id and p.id=ptr.preset_id and p.preset_revision=ptr.preset_revision
      where ptr.order_record_id=source.id and p.order_record_revision=source.current_revision;
    if not found or preset.clinical_order_type<>'dispensing' or preset.preset_status<>'synthetic_unreviewed'
      or preset.clinical_use_allowed or preset.content_sha256 is distinct from expected->>'presetSha256' then
      raise exception 'synthetic_rebind_preset_mismatch'; end if;
    select * into next_profile from master.dispensing_order_profiles
      where order_record_id=source.id and order_record_revision=source.current_revision;
    if not found then
      select max(profile_revision)+1 into revision from master.dispensing_order_profiles where profile_key=previous.profile_key;
      insert into master.dispensing_order_profiles(id,profile_key,profile_revision,order_record_id,order_record_revision,
        product_id,product_revision,allowed_routes,prescription_default_status,prescription_defaults,
        korean_translation_review_status,evidence_fingerprint,lifecycle_status,source_release_id)
      values(private.clair_b2_deterministic_uuid('oed-synthetic-profile',array[previous.profile_key,p_release_id::text,revision::text]),
        previous.profile_key,revision,source.id,source.current_revision,previous.product_id,previous.product_revision,
        previous.allowed_routes,'none',null,previous.korean_translation_review_status,previous.evidence_fingerprint,
        'technical_validated',p_release_id) returning * into next_profile;
    end if;
    if (next_profile.source_release_id,next_profile.product_id,next_profile.product_revision,next_profile.allowed_routes,
        next_profile.profile_key,next_profile.korean_translation_review_status,next_profile.evidence_fingerprint)
      is distinct from (p_release_id,previous.product_id,previous.product_revision,previous.allowed_routes,
        previous.profile_key,previous.korean_translation_review_status,previous.evidence_fingerprint)
      or next_profile.profile_revision<=previous.profile_revision or next_profile.prescription_default_status<>'none'
      or next_profile.prescription_defaults is not null or next_profile.lifecycle_status<>'technical_validated'
      or master.clair_dispensing_profile_clinical_use_allowed(next_profile.id,next_profile.profile_revision) then
      raise exception 'synthetic_rebind_new_profile_mismatch'; end if;
    snapshot:=c.dispensing_profile_snapshot||jsonb_build_object('sourceDispensingProfileId',next_profile.id,
      'sourceDispensingProfileRevision',next_profile.profile_revision,'clinicalUseAllowed',false);
    -- All three lineage fields change together. Keep the old source projection
    -- and execution baseline for the normal adopter's presence-aware merge/review.
    update public.order_catalog_items set source_master_revision=source.current_revision,
      source_dispensing_profile_id=next_profile.id,source_dispensing_profile_revision=next_profile.profile_revision,
      dispensing_profile_snapshot=snapshot,dispensing_profile_snapshot_sha256=private.clinical_master_sha256(snapshot),
      availability_status='pending_activation',catalog_revision=catalog_revision+1,updated_at=now()
      where workspace_id=p_workspace_id and id=c.id;
    perform private.clair_pr020_append_order_catalog_audit(p_workspace_id,'order_catalog.updated',c.id,c,
      (select i from public.order_catalog_items i where i.workspace_id=p_workspace_id and i.id=c.id),
      'synthetic_dispensing_profile_rebind',array['sourceMasterRevision','sourceDispensingProfileId','sourceDispensingProfileRevision','availabilityStatus']);
    n:=n+1;
  end loop;
  insert into private.clinical_master_dispensing_service_review_events(workspace_id,release_id,action,review_mode,
    actor_user_id,approval_reference,reason)
  values(p_workspace_id,p_release_id,'enabled','service_operations_review',auth.uid(),
    'oed-2026-09-06-approved-synthetic-selection',
    'Approved synthetic demo selection only; no clinical approval or hardware integration.')
  on conflict(workspace_id,release_id,action,approval_reference) do nothing;
  if n<>108 or (select count(*) from public.order_catalog_items i join master.dispensing_order_profiles p
    on p.id=i.source_dispensing_profile_id and p.profile_revision=i.source_dispensing_profile_revision
    where i.workspace_id=p_workspace_id and p.source_release_id=p_release_id and i.availability_status='pending_activation'
      and not i.clinical_use_allowed)<>108 then raise exception 'synthetic_rebind_postcondition_failed'; end if;
  select count(*),private.clinical_master_sha256(coalesce(jsonb_agg(to_jsonb(i) order by i.id),'[]'))
    into after_count,after_hash from public.order_catalog_items i where workspace_id=p_workspace_id;
  insert into private.clinical_master_dispensing_adoption_events(workspace_id,release_id,payload_sha256,actor_user_id,
    approved_workspace_ids,profile_count,clinical_use_allowed_count,availability_status,
    before_count,after_count,before_fingerprint,after_fingerprint)
  values(p_workspace_id,p_release_id,command_hash,auth.uid(),targets,n,0,'pending_activation',
    before_count,after_count,before_hash,after_hash) returning * into event;
  return jsonb_build_object('eventId',event.id,'profileCount',n,'clinicalUseAllowed',false);
end $fn$;
revoke all on function private.clair_rebind_oed_synthetic_dispensing(text,uuid,jsonb) from public,anon,authenticated,service_role;
