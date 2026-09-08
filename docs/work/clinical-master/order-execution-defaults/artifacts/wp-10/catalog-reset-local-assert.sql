-- Enclosing harness seeds a current synthetic profile release, then rolls back.
do $reset$
declare proposal jsonb:=(select proposal from wp10_input); payload jsonb; record jsonb; preset jsonb;
  ptr master.order_execution_preset_current; current_preset master.order_execution_presets;
  changed_keys text[]; master_keys text[]; retired_keys text[]; extras text[]; w text; actor uuid;
  target_release_id uuid; result jsonb; baseline_sha text; before_history jsonb; after_history jsonb;
  before_retry jsonb; after_retry jsonb; review record; revision integer; price jsonb;
begin
  if has_function_privilege('authenticated','private.clair_wp10_project_dispensing(text,text)','EXECUTE')
    or has_function_privilege('service_role','private.clair_wp10_copy_pristine_catalog(text,text,text)','EXECUTE') then
    raise exception 'test wp10 mutation helper privilege leak'; end if;
  payload:=proposal->'payload';
  select array_agg(value->>'masterKey') into changed_keys from jsonb_array_elements(proposal->'changes');
  select array_agg(value) into master_keys from jsonb_array_elements_text(proposal->'selectableKeys');
  select array_agg(value) into retired_keys from jsonb_array_elements_text(proposal->'retiredKeys');
  -- Local identities/revision counters differ from the remote read; preserve the
  -- exact requested semantic delta while rebasing only those counters for tests.
  for record in select value from jsonb_array_elements(payload->'records') where value->>'recordType'='order' loop
    select p.* into strict ptr from master.order_execution_preset_current p join master.master_records m on m.id=p.order_record_id
      where m.master_key=record->>'masterKey';
    select * into strict current_preset from master.order_execution_presets where id=ptr.preset_id and preset_revision=ptr.preset_revision;
    if record->>'masterKey'=any(changed_keys) then
      preset:=record#>'{detail,executionPreset}';
      preset:=preset||jsonb_build_object('presetId',current_preset.id,'presetKey',current_preset.preset_key,
        'presetRevision',(select max(preset_revision)+1 from master.order_execution_presets where id=current_preset.id));
      preset:=preset||jsonb_build_object('contentSha256',private.clinical_master_sha256(private.clair_order_execution_preset_hash_content(preset)));
    else
      preset:=jsonb_build_object('presetId',current_preset.id,'presetKey',current_preset.preset_key,'presetRevision',current_preset.preset_revision,
        'clinicalOrderType',current_preset.clinical_order_type,'detailSchemaVersion',current_preset.detail_schema_version,
        'defaultDetailInputs',current_preset.default_detail_inputs,'fieldPolicies',current_preset.field_policies,
        'provenance',current_preset.provenance,'presetStatus',current_preset.preset_status,'clinicalUseAllowed',current_preset.clinical_use_allowed,
        'contentSha256',current_preset.content_sha256,'sourceArtifactSha256',current_preset.source_artifact_sha256);
    end if;
    record:=jsonb_set(record,'{detail,executionPreset}',preset);
    select jsonb_set(payload,'{records}',jsonb_agg(case when r->>'masterKey'=record->>'masterKey' then record else r end order by ordinal))
      into payload from jsonb_array_elements(payload->'records') with ordinality rows(r,ordinal);
  end loop;
  before_history:=private.clair_wp10_clinical_history_fingerprint();
  result:=private.publish_clinical_master_release(payload); target_release_id:=(result->>'releaseId')::uuid;
  if private.clair_wp10_apply_retirement(target_release_id,retired_keys,auth.uid(),proposal->>'payloadSha256')<>51 then raise exception 'test retirement count'; end if;
  if private.clair_wp10_apply_retirement(target_release_id,retired_keys,auth.uid(),proposal->>'payloadSha256')<>0 then raise exception 'test retirement retry mutated'; end if;
  if (select count(*) from master.master_records where record_type='order' and lifecycle_status='published')<>524 then raise exception 'test current master count'; end if;
  -- Populate the formerly empty authorized target first, with its own fixture
  -- admin. These local JWTs are scoped test actors; no roles are granted.
  select u.user_id into strict actor from public.user_memberships u join public.users a on a.id=u.user_id and a.status='active'
    where u.workspace_id='clair-foreign-demo' and u.status='active' and u.roles @> array['hospital_admin']::text[] and private.clair_user_has_workspace_permission(u.workspace_id,u.user_id,'hospital_settings:manage')
      and private.clair_user_has_workspace_permission(u.workspace_id,u.user_id,'service_catalog:manage') order by u.user_id limit 1;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  perform private.clair_adopt_master_release_to_workspace('clair-foreign-demo',target_release_id);
  perform private.clair_wp10_project_dispensing('clair-foreign-demo',proposal->>'payloadSha256');
  select private.clair_oed_20260906_fingerprints() into before_retry;
  perform private.clair_wp10_project_dispensing('clair-foreign-demo',proposal->>'payloadSha256');
  if private.clair_oed_20260906_fingerprints() is distinct from before_retry then raise exception 'test product projection retry mutated'; end if;
  for price in select value from jsonb_array_elements((select prices from wp10_input)->'entries') loop
    update public.order_catalog_items set price_krw=(price->>'priceKrw')::integer,
      billing_reflection_enabled=(price->>'billingReflectionEnabled')::boolean,billing_eligible=(price->>'billingReflectionEnabled')::boolean,
      pricing_rule=jsonb_build_object('priceKrw',price->'priceKrw'),availability_status=case when source_dispensing_profile_id is null then 'active' else 'pending_activation' end,
      catalog_revision=catalog_revision+1 where workspace_id='clair-foreign-demo' and standard_order_id=price->>'orderMasterKey';
  end loop;
  select coalesce(array_agg(c.id),'{}') into extras from public.order_catalog_items c left join master.master_records m on m.id=c.source_master_record_id
    where c.workspace_id='clair-foreign-demo' and (m.master_key is null or not m.master_key=any(master_keys));
  perform private.clair_wp10_archive_extra_catalogs('clair-foreign-demo',master_keys,extras,proposal->>'payloadSha256');
  select private.clinical_master_sha256(jsonb_agg(private.clair_wp10_common_catalog_values(i) order by i.standard_order_id)) into baseline_sha
    from public.order_catalog_items i where workspace_id='clair-foreign-demo' and archived_at is null;
  foreach w in array array['clair-demo','workspace-clair-cheongdam','workspace-clinical-master-pilot-v1'] loop
    select u.user_id into strict actor from public.user_memberships u join public.users a on a.id=u.user_id and a.status='active'
      where u.workspace_id=w and u.status='active' and u.roles @> array['hospital_admin']::text[] and private.clair_user_has_workspace_permission(u.workspace_id,u.user_id,'hospital_settings:manage')
      and private.clair_user_has_workspace_permission(u.workspace_id,u.user_id,'service_catalog:manage') order by u.user_id limit 1;
    perform set_config('request.jwt.claim.sub',actor::text,true);
    perform private.clair_adopt_master_release_to_workspace(w,target_release_id);
    -- Source acceptance may restore billing on old nonbillable fixtures. Supply
    -- the approved common synthetic amount before that existing validation gate.
    for price in select value from jsonb_array_elements((select prices from wp10_input)->'entries') loop
      update public.order_catalog_items set price_krw=(price->>'priceKrw')::integer,
        pricing_rule=jsonb_set(pricing_rule,'{priceKrw}',price->'priceKrw'),catalog_revision=catalog_revision+1
        where workspace_id=w and standard_order_id=price->>'orderMasterKey';
    end loop;
    for review in select * from public.workspace_master_updates u where u.workspace_id=w and u.release_id=target_release_id and status='pending' loop
      select catalog_revision into revision from public.order_catalog_items where workspace_id=w and id=review.order_catalog_item_id;
      if review.order_catalog_item_id is not null and review.source_master_record_id in
        (select id from master.master_records where master_key=any(master_keys)) then
        perform public.clair_resolve_workspace_master_update(w,review.id,revision,'accept_source');
      end if;
    end loop;
    for review in select * from public.workspace_lab_catalog_updates u where workspace_id=w and source_release_id=target_release_id and status='pending' loop
      select catalog_revision into revision from public.order_catalog_items where workspace_id=w and id=review.order_catalog_item_id;
      result:=public.clair_resolve_workspace_lab_definition_update(w,review.id,actor,revision,'accept');
      if result->>'cascadeOnly' is distinct from 'true' then raise exception 'test unexpected lab membership rewrite'; end if;
    end loop;
    perform private.clair_wp10_copy_pristine_catalog(w,baseline_sha,proposal->>'payloadSha256');
    select coalesce(array_agg(c.id),'{}') into extras from public.order_catalog_items c left join master.master_records m on m.id=c.source_master_record_id
      where c.workspace_id=w and (c.origin_type<>'clair_master' or m.master_key is null or not m.master_key=any(master_keys));
    perform private.clair_wp10_archive_extra_catalogs(w,master_keys,extras,proposal->>'payloadSha256');
    before_retry:=private.clair_oed_20260906_fingerprints();
    perform private.clair_wp10_copy_pristine_catalog(w,baseline_sha,proposal->>'payloadSha256');
    perform private.clair_wp10_archive_extra_catalogs(w,master_keys,extras,proposal->>'payloadSha256');
    if private.clair_oed_20260906_fingerprints() is distinct from before_retry then raise exception 'test reset retry mutated'; end if;
    if (select count(*) from public.order_catalog_items where workspace_id=w and archived_at is null)<>524 then raise exception 'test pristine count'; end if;
  end loop;
  foreach w in array array['clair-demo','clair-foreign-demo','workspace-clair-cheongdam','workspace-clinical-master-pilot-v1'] loop
    select u.user_id into strict actor from public.user_memberships u join public.users a on a.id=u.user_id and a.status='active'
      where u.workspace_id=w and u.status='active' and u.roles @> array['hospital_admin']::text[] and private.clair_user_has_workspace_permission(u.workspace_id,u.user_id,'hospital_settings:manage')
      and private.clair_user_has_workspace_permission(u.workspace_id,u.user_id,'service_catalog:manage') order by u.user_id limit 1;
    perform set_config('request.jwt.claim.sub',actor::text,true);
    perform private.clair_wp10_enable_service_review(w,proposal->>'payloadSha256');
    perform private.clair_wp10_normalize_resources(w,(select resources from wp10_input),proposal->>'payloadSha256');
    before_retry:=private.clair_oed_20260906_fingerprints();
    perform private.clair_wp10_normalize_resources(w,(select resources from wp10_input),proposal->>'payloadSha256');
    if private.clair_oed_20260906_fingerprints() is distinct from before_retry then raise exception 'test resource retry mutated'; end if;
    if (select count(*) from public.workspace_lab_result_profile_bindings where workspace_id=w and override_version_id is null)<>173
      or (select count(*) from public.order_sets where workspace_id=w and availability_status='active' and archived_at is null)<>30
      or (select count(*) from public.workspace_inpatient_locations where workspace_id=w and is_default and active)<>1 then raise exception 'test canonical resource counts'; end if;
  end loop;
  after_history:=private.clair_wp10_clinical_history_fingerprint();
  if after_history is distinct from before_history then raise exception 'test order history changed'; end if;
  raise notice 'WP10 four catalogs: source retirement51, pristine524, product108, resources173/30/1 per workspace, archived extras, history and mutation-free retries passed';
end $reset$;
