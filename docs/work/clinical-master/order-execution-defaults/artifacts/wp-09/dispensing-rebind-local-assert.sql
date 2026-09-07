-- Local synthetic fixture reproduces the remote legacy108 product-profile pins.
do $rebind$
declare profile master.dispensing_order_profiles; c public.order_catalog_items; product master.medication_products;
  snapshot jsonb; p jsonb:=(select payload from wp09_rebind_payload); record jsonb; preset jsonb;
  ptr master.order_execution_preset_current; old master.order_execution_presets; release_id uuid; expected jsonb;
  result jsonb; old_profiles text; old_products text; old_reviews text; old_history text; foreign_before text;
  before_retry text; actor uuid:=auth.uid(); bad jsonb;
  custom_id text;
begin
  result:=private.publish_clinical_master_release(jsonb_set((select payload from wp09_seed_payload),'{releaseKey}','"wp09.synthetic-rebind.baseline"'));
  perform private.clair_adopt_master_release_to_workspace('clair-demo',(result->>'releaseId')::uuid);
  for profile in select * from master.dispensing_order_profiles order by profile_key loop
    select * into strict c from public.order_catalog_items where workspace_id='clair-demo' and source_master_record_id=profile.order_record_id;
    select * into strict product from master.medication_products where id=profile.product_id and revision=profile.product_revision;
    snapshot:=jsonb_build_object('schemaVersion',1,'sourceDispensingProfileId',profile.id,'sourceDispensingProfileRevision',profile.profile_revision,
      'sourceMedicationProductId',product.id,'sourceMedicationProductRevision',product.revision,'productKey',product.product_key,
      'englishProductName',product.english_product_name,'koreanDraftName',product.korean_draft_name,'koreanReviewStatus',product.korean_review_status,
      'dosageForm',product.dosage_form,'routes',to_jsonb(profile.allowed_routes),'strengthSnapshot',product.strength_snapshot,
      'targetSpecies',(select jsonb_agg(s.species_code order by s.species_code) from master.medication_species_applicability a
        join master.species s on s.master_record_id=a.species_record_id where a.product_id=product.id and a.product_revision=product.revision),
      'clinicalUseAllowed',false);
    update public.order_catalog_items set source_master_revision=profile.order_record_revision,
      source_dispensing_profile_id=profile.id,source_dispensing_profile_revision=profile.profile_revision,
      dispensing_profile_snapshot=snapshot,dispensing_profile_snapshot_sha256=private.clinical_master_sha256(snapshot),
      availability_status='pending_activation' where workspace_id='clair-demo' and id=c.id;
  end loop;
  if (select count(*) from public.order_catalog_items where workspace_id='clair-demo' and source_dispensing_profile_id is not null)<>108 then
    raise exception 'test rebind108 fixture missing'; end if;
  select * into strict c from public.order_catalog_items where workspace_id='clair-demo' and source_dispensing_profile_id is not null order by id limit 1;
  custom_id:=c.id;
  -- Fixture only: legacy remote rows already carry hospital price overrides.
  -- The separate WP02 regression exercises the actual public authoring RPC.
  update public.order_catalog_items set price_krw=777,customization_state='customized',customized_fields=array['priceKrw'],
    pricing_rule=pricing_rule||'{"priceKrw":777}'::jsonb where workspace_id='clair-demo' and id=c.id;
  -- Rebase against the named local DB's exact immutable identity/history, as the
  -- delivery generator separately does against the remote preflight.
  for record in select value from jsonb_array_elements(p->'records') where value->>'recordType'='order' loop
    select current_ptr.* into ptr from master.order_execution_preset_current current_ptr join master.master_records m on m.id=current_ptr.order_record_id
      where m.master_key=record->>'masterKey';
    if found then
      select * into strict old from master.order_execution_presets where id=ptr.preset_id and preset_revision=ptr.preset_revision and order_record_id=ptr.order_record_id;
      preset:=record#>'{detail,executionPreset}';
      preset:=preset||jsonb_build_object('presetId',old.id,'presetKey',old.preset_key,'presetRevision',
        (select max(preset_revision)+1 from master.order_execution_presets where order_record_id=ptr.order_record_id));
      preset:=preset||jsonb_build_object('contentSha256',private.clinical_master_sha256(private.clair_order_execution_preset_hash_content(preset)));
      record:=jsonb_set(record,'{detail,executionPreset}',preset);
      select jsonb_set(p,'{records}',jsonb_agg(case when r->>'masterKey'=record->>'masterKey' then record else r end order by ordinal))
        into p from jsonb_array_elements(p->'records') with ordinality rows(r,ordinal);
    end if;
  end loop;
  select private.clinical_master_sha256(jsonb_agg(to_jsonb(x) order by x.id)) into old_profiles from master.dispensing_order_profiles x;
  select private.clinical_master_sha256(jsonb_agg(to_jsonb(x) order by x.id)) into old_products from master.medication_products x;
  select private.clinical_master_sha256(coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]')) into old_reviews from master.clinical_reviews x;
  select private.clinical_master_sha256(coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]')) into old_history from public.orders x;
  select private.clinical_master_sha256(coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]')) into foreign_before from public.order_catalog_items x where workspace_id='clair-foreign-demo';
  select jsonb_agg(jsonb_build_object('catalogId',i.id,'catalogRevision',i.catalog_revision,'catalogSha256',private.clinical_master_sha256(to_jsonb(i)),
    'masterKey',m.master_key,'profileId',pr.id,'profileRevision',pr.profile_revision,'profileSha256',private.clinical_master_sha256(to_jsonb(pr)),
    'presetSha256',(select r#>>'{detail,executionPreset,contentSha256}' from jsonb_array_elements(p->'records') r where r->>'masterKey'=m.master_key)) order by i.id)
    into expected from public.order_catalog_items i join master.dispensing_order_profiles pr on pr.id=i.source_dispensing_profile_id and pr.profile_revision=i.source_dispensing_profile_revision
    join master.master_records m on m.id=i.source_master_record_id where i.workspace_id='clair-demo';
  result:=private.publish_clinical_master_release(p); release_id:=(result->>'releaseId')::uuid;
  begin
    perform private.clair_rebind_oed_synthetic_dispensing('clair-foreign-demo',release_id,expected);
    raise exception 'test rebind foreign accepted';
  exception when insufficient_privilege then null; end;
  begin
    bad:=jsonb_set(expected,'{0,catalogRevision}',to_jsonb((expected#>>'{0,catalogRevision}')::integer+1));
    perform private.clair_rebind_oed_synthetic_dispensing('clair-demo',release_id,bad);
    raise exception 'test rebind stale CAS accepted';
  exception when serialization_failure then null; end;
  result:=private.clair_rebind_oed_synthetic_dispensing('clair-demo',release_id,expected);
  if result->>'profileCount'<>'108' then raise exception 'test rebind count'; end if;
  perform private.clair_adopt_master_release_to_workspace('clair-demo',release_id);
  if (select count(*) from public.order_catalog_items i join master.dispensing_order_profiles pr on pr.id=i.source_dispensing_profile_id
    and pr.profile_revision=i.source_dispensing_profile_revision where i.workspace_id='clair-demo' and pr.source_release_id=release_id
    and i.source_master_revision=pr.order_record_revision and i.availability_status='pending_activation' and not i.clinical_use_allowed
    and i.detail_schema_version=1 and i.default_detail_inputs#>>'{planOrderAuthority,schemaVersion}'='2'
    and exists(select 1 from master.order_execution_presets ep where ep.id=i.source_execution_preset_id
      and ep.preset_revision=i.source_execution_preset_revision and ep.order_record_id=i.source_master_record_id
      and ep.preset_status='synthetic_unreviewed' and not ep.clinical_use_allowed and ep.order_record_revision=pr.order_record_revision)
    and private.clair_dispensing_service_review_catalog_item_allowed('clair-demo',i.id))<>108 then
    raise exception 'test rebind adopted preparation-v2/selectable synthetic lineage incomplete'; end if;
  select * into strict c from public.order_catalog_items where workspace_id='clair-demo' and id=custom_id;
  if c.price_krw<>777 or not ('priceKrw'=any(c.customized_fields)) or c.execution_source_baseline='{}' then
    raise exception 'test rebind customized price or execution baseline lost'; end if;
  snapshot:=private.clair_build_catalog_order_snapshot('clair-demo',c.id,1);
  if snapshot#>>'{executionPresetLineage,presetStatus}' is distinct from 'synthetic_unreviewed'
    or snapshot#>'{executionPresetLineage,clinicalUseAllowed}' is distinct from 'false'::jsonb then
    raise exception 'test rebind chart snapshot inherited old approval'; end if;
  select private.clinical_master_sha256(jsonb_agg(to_jsonb(i) order by i.id)) into before_retry from public.order_catalog_items i where workspace_id='clair-demo';
  if private.clair_rebind_oed_synthetic_dispensing('clair-demo',release_id,expected)<>result then raise exception 'test rebind retry response changed'; end if;
  perform private.clair_adopt_master_release_to_workspace('clair-demo',release_id);
  if before_retry is distinct from(select private.clinical_master_sha256(jsonb_agg(to_jsonb(i) order by i.id)) from public.order_catalog_items i where workspace_id='clair-demo') then
    raise exception 'test rebind retry changed catalog'; end if;
  if old_profiles is distinct from(select private.clinical_master_sha256(jsonb_agg(to_jsonb(x) order by x.id)) from master.dispensing_order_profiles x where x.source_release_id<>release_id)
    or old_products is distinct from(select private.clinical_master_sha256(jsonb_agg(to_jsonb(x) order by x.id)) from master.medication_products x)
    or old_reviews is distinct from(select private.clinical_master_sha256(coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]')) from master.clinical_reviews x)
    or old_history is distinct from(select private.clinical_master_sha256(coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]')) from public.orders x)
    or foreign_before is distinct from(select private.clinical_master_sha256(coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]')) from public.order_catalog_items x where workspace_id='clair-foreign-demo') then
    raise exception 'test rebind immutable or foreign history changed'; end if;
  raise notice 'PASS WP09 linked108 profile append/atomic rebind/preparation-v2/selectable synthetic lineage/adoption/retries/CAS/foreign/products/reviews/orders preserved';
end $rebind$;
