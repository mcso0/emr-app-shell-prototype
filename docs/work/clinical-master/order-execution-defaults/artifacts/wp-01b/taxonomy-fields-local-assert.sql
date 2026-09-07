-- Executed by scripts/test-wp01b-taxonomy-local.mjs inside BEGIN/ROLLBACK only.
create temp table taxonomy_foreign_before as select to_jsonb(c) row from public.order_catalog_items c where workspace_id='clair-foreign-demo';
create temp table taxonomy_orders_before as select md5(coalesce(jsonb_agg(to_jsonb(o) order by o.id)::text,'')) fingerprint from public.orders o;
create temp table taxonomy_release_result as select private.publish_clinical_master_release((select payload from taxonomy_test_payload)) result;

do $test$
declare p jsonb; result jsonb; c public.order_catalog_items%rowtype; before_row jsonb;
  source jsonb; baseline jsonb; revision_before integer; master_id uuid; release_id uuid; snapshot jsonb;
begin
  select id into master_id from master.master_records where master_key='cm.order.lab.panel.cbc-basic';
  source:=private.clinical_master_order_source_projection(master_id);
  if source->'taxonomy' is distinct from '{"adminSubcategoryCode":"clinical-pathology","labFamilyCode":"cbc"}'::jsonb then raise exception 'test publisher projection failed'; end if;
  if not exists(select 1 from master.master_record_versions v where v.master_record_id=master_id
    and v.revision=(source->>'revision')::integer and v.snapshot->'detail'->>'labFamilyCode'='cbc') then raise exception 'test immutable taxonomy missing'; end if;
  release_id:=((select r.result from taxonomy_release_result r)->>'releaseId')::uuid;
  result:=private.clair_adopt_master_release_to_workspace('clair-demo',release_id);
  select * into strict c from public.order_catalog_items where workspace_id='clair-demo' and source_master_record_id=master_id;
  if c.lab_family_code<>'cbc' or c.taxonomy_source_baseline->'labFamilyCode'->>'value'<>'cbc' then raise exception 'test new adoption failed'; end if;
  revision_before:=c.catalog_revision;
  result:=private.clair_adopt_master_release_to_workspace('clair-demo',release_id);
  if (select catalog_revision from public.order_catalog_items where id=c.id)<>revision_before then raise exception 'test retry changed revision'; end if;
  -- Only make this local synthetic item available for snapshot/clinical-invariance tests.
  update public.order_catalog_items set price_krw=0,pricing_rule=jsonb_set(pricing_rule,'{priceKrw}','0'),availability_status='active' where id=c.id;
  select * into c from public.order_catalog_items where id=c.id;
  before_row:=to_jsonb(c);
  result:=public.clair_update_order_catalog_item('clair-demo',c.id,c.catalog_revision,'{"labFamilyCode":"chemistry"}');
  select * into c from public.order_catalog_items where id=c.id;
  if c.lab_family_code<>'chemistry' or not('labFamilyCode'=any(c.customized_fields)) then raise exception 'test override failed'; end if;
  if (to_jsonb(c)-array['lab_family_code','catalog_revision','customized_fields','customization_state','last_customized_at','last_customized_by_user_id','updated_at'])
    is distinct from (before_row-array['lab_family_code','catalog_revision','customized_fields','customization_state','last_customized_at','last_customized_by_user_id','updated_at']) then raise exception 'test taxonomy changed clinical fields'; end if;
  perform private.clair_merge_order_taxonomy('clair-demo',c.id,source);
  if (select lab_family_code from public.order_catalog_items where id=c.id)<>'chemistry' then raise exception 'test override overwritten'; end if;
  select * into c from public.order_catalog_items where id=c.id;
  result:=public.clair_update_order_catalog_item('clair-demo',c.id,c.catalog_revision,'{"resetTaxonomyFields":["labFamilyCode"]}');
  select * into c from public.order_catalog_items where id=c.id;
  if c.lab_family_code<>'cbc' or 'labFamilyCode'=any(c.customized_fields) then raise exception 'test reset failed'; end if;
  snapshot:=private.clair_build_catalog_order_snapshot('clair-demo',c.id,1);
  if snapshot->>'labFamilyCode'<>'cbc' then raise exception 'test new snapshot missing taxonomy'; end if;
  if snapshot->>'workspaceId'<>'clair-demo' or snapshot->>'workspaceCatalogItemId'<>c.id
    or (snapshot->>'workspaceCatalogRevision')::integer<>c.catalog_revision
    or snapshot->>'sourceMasterRecordId'<>c.source_master_record_id::text then
    raise exception 'test catalog snapshot lineage mismatch';
  end if;
  select applied_snapshot into result from public.clair_list_order_catalog_chart_search_v2('clair-demo')
    where row_type='individual' and applied_snapshot->>'workspaceCatalogItemId'=c.id;
  if result is null or result->>'workspaceId'<>'clair-demo'
    or (result->>'workspaceCatalogRevision')::integer<>c.catalog_revision
    or result->>'sourceMasterRecordId'<>c.source_master_record_id::text then
    raise exception 'test chart search lineage mismatch';
  end if;
  result:=public.clair_update_order_catalog_item('clair-demo',c.id,c.catalog_revision,'{"adminSubcategoryCode":null,"labFamilyCode":null}');
  perform private.clair_merge_order_taxonomy('clair-demo',c.id,source);
  select * into c from public.order_catalog_items where id=c.id;
  if c.admin_subcategory_code is not null or c.lab_family_code is not null then raise exception 'test explicit clear overwritten'; end if;
  if snapshot->>'labFamilyCode'<>'cbc' then raise exception 'test historical snapshot changed'; end if;
  -- Pair conflict: one cleared override and one unmodified field must not half-merge.
  update public.order_catalog_items set customized_fields=array['adminSubcategoryCode'],taxonomy_source_baseline='{}' where id=c.id;
  select taxonomy_source_baseline into baseline from public.order_catalog_items where id=c.id;
  perform private.clair_merge_order_taxonomy('clair-demo',c.id,source);
  select * into c from public.order_catalog_items where id=c.id;
  if c.taxonomy_merge_conflict is null or c.lab_family_code is not null or c.taxonomy_source_baseline<>baseline then raise exception 'test conflict half applied'; end if;
  revision_before:=c.catalog_revision;
  perform private.clair_merge_order_taxonomy('clair-demo',c.id,source);
  if (select catalog_revision from public.order_catalog_items where id=c.id)<>revision_before then raise exception 'test conflict retry wrote again'; end if;
  -- Wildcard and detached are independent preservation boundaries.
  update public.order_catalog_items set customized_fields=array['*'],taxonomy_merge_conflict=null where id=c.id;
  perform private.clair_merge_order_taxonomy('clair-demo',c.id,source);
  select * into c from public.order_catalog_items where id=c.id;
  if c.lab_family_code is not null then raise exception 'test wildcard overwritten'; end if;
  begin
    perform public.clair_update_order_catalog_item('clair-demo',c.id,c.catalog_revision,'{"resetTaxonomyFields":["labFamilyCode"]}');
    raise exception 'test wildcard reset accepted';
  exception when invalid_parameter_value then null; end;
  update public.order_catalog_items set customized_fields='{}',customization_state='detached' where id=c.id;
  if private.clair_merge_order_taxonomy('clair-demo',c.id,source) then raise exception 'test detached changed'; end if;
  -- Bad pair, protected field and stale revision are rejected transactionally.
  select * into c from public.order_catalog_items where id=c.id;
  begin
    perform public.clair_update_order_catalog_item('clair-demo',c.id,c.catalog_revision,'{"adminSubcategoryCode":"oral-medication"}');
    raise exception 'test invalid pair accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.clair_update_order_catalog_item('clair-demo',c.id,c.catalog_revision,'{"adminSubcategoryCode":null,"taxonomy_source_baseline":{}}');
    raise exception 'test client baseline accepted';
  exception when invalid_parameter_value or insufficient_privilege then null; end;
  begin
    perform public.clair_update_order_catalog_item('clair-demo',c.id,c.catalog_revision-1,'{"adminSubcategoryCode":null}');
    raise exception 'test stale accepted';
  exception when serialization_failure then null; end;
  begin
    perform private.clair_build_catalog_order_snapshot('clair-demo','wp01b-taxonomy-foreign',1);
    raise exception 'test foreign snapshot returned';
  exception when raise_exception then if sqlerrm<>'catalog_item_unavailable' then raise; end if; end;
  begin
    perform private.clair_build_catalog_order_snapshot('clair-demo','missing',0);
    raise exception 'test invalid quantity accepted';
  exception when raise_exception then if sqlerrm<>'invalid_order_quantity' then raise; end if; end;
  perform set_config('request.jwt.claim.sub','',true);
  begin
    perform public.clair_update_order_catalog_item('clair-demo',c.id,c.catalog_revision,'{"adminSubcategoryCode":null}');
    raise exception 'test anonymous accepted';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub',(select user_id::text from wp01b_actor),true);
  if has_function_privilege('authenticated','private.clair_merge_order_taxonomy(text,text,jsonb)','EXECUTE')
    or has_function_privilege('anon','public.clair_update_order_catalog_item(text,text,integer,jsonb)','EXECUTE')
    or has_function_privilege('authenticated','public.clair_update_order_catalog_item_before_taxonomy(text,text,integer,jsonb)','EXECUTE') then raise exception 'test helper privilege leak'; end if;
  -- A real second publication must refresh untouched taxonomy despite a customized price.
  update public.order_catalog_items set customization_state='customized',customized_fields=array['priceKrw'],
    admin_subcategory_code='clinical-pathology',lab_family_code='cbc',taxonomy_merge_conflict=null,
    taxonomy_source_baseline=jsonb_build_object(
      'adminSubcategoryCode',jsonb_build_object('value','clinical-pathology','revision',(source->>'revision')::integer),
      'labFamilyCode',jsonb_build_object('value','cbc','revision',(source->>'revision')::integer)),
    price_krw=777,pricing_rule=jsonb_set(pricing_rule,'{priceKrw}','777') where id=c.id;
  p:=(select payload from taxonomy_test_payload);
  p:=jsonb_set(p,'{releaseKey}','"wp01b.taxonomy.local-test.r2"');
  p:=jsonb_set(p,'{records,0,detail,labFamilyCode}','"chemistry"');
  p:=jsonb_set(p,'{records,0,detail,executionPreset,presetRevision}','2');
  p:=jsonb_set(p,'{records,0,detail,executionPreset,contentSha256}',to_jsonb(
    private.clinical_master_sha256(private.clair_order_execution_preset_hash_content(p#>'{records,0,detail,executionPreset}'))));
  result:=private.publish_clinical_master_release(p);
  release_id:=(result->>'releaseId')::uuid;
  result:=private.clair_adopt_master_release_to_workspace('clair-demo',release_id);
  select * into c from public.order_catalog_items where id=c.id;
  if c.lab_family_code<>'chemistry' or c.price_krw<>777 or not('priceKrw'=any(c.customized_fields)) then
    raise exception 'test independent taxonomy refresh failed'; end if;
  revision_before:=c.catalog_revision;
  result:=private.clair_adopt_master_release_to_workspace('clair-demo',release_id);
  if (select catalog_revision from public.order_catalog_items where id=c.id)<>revision_before then
    raise exception 'test customized retry wrote again'; end if;
  p:=jsonb_build_object('id','wp01b-taxonomy-created','categoryGroup','lab',
    'classificationPathId',c.classification_path_id,'standardOrderName','Synthetic taxonomy create',
    'inHospitalOrderName','Synthetic taxonomy create','billingName','Synthetic taxonomy create',
    'priceKrw',0,'adminSubcategoryCode','clinical-pathology','labFamilyCode','cbc');
  result:=public.clair_create_order_catalog_item('clair-demo',p);
  if result->'item'->>'lab_family_code'<>'cbc' or not exists(
    select 1 from public.order_catalog_items where id='wp01b-taxonomy-created'
      and workspace_id='clair-demo' and admin_subcategory_code='clinical-pathology' and lab_family_code='cbc') then
    raise exception 'test create taxonomy lost'; end if;
  begin
    perform public.clair_create_order_catalog_item('clair-demo',p||'{"id":"wp01b-taxonomy-invalid-create","labFamilyCode":"unknown"}'::jsonb);
    raise exception 'test invalid create accepted';
  exception when invalid_parameter_value then null; end;
  if exists(select 1 from public.order_catalog_items where id='wp01b-taxonomy-invalid-create') then
    raise exception 'test invalid create leaked row'; end if;
  p:='{"categoryGroup":"medication","defaultDestinationModule":"dispensing","standardOrderName":"Synthetic dispensing create","inHospitalOrderName":"Synthetic dispensing create","billingName":"Synthetic dispensing create","priceKrw":0,"pricingRule":{"priceBasis":"unit_price"},"adminSubcategoryCode":"oral-medication","labFamilyCode":null,"medicationMetadata":{"ingredientEnglishName":"Synthetic fixture only","autoDispenseQuantityEnabled":true,"defaultDetailInputs":{"dose":1,"doseUnit":"mg","route":"PO","frequency":"once","durationDays":1,"totalQuantity":1,"totalQuantityUnit":"unit"}}}'::jsonb;
  p:=jsonb_set(p,'{medicationMetadata,defaultDetailInputs,totalQuantityUnit}','"tablet"');
  p:=jsonb_set(p,'{medicationMetadata,defaultDetailInputs,doseBasis}','"patient"');
  result:=public.clair_create_order_catalog_item('clair-demo',p);
  if result->'item'->>'admin_subcategory_code'<>'oral-medication'
    or result->'item'->>'clinical_order_type'<>'dispensing'
    or result->'item'->>'availability_status'<>'pending_activation'
    or result->'item'->'medication_metadata' is distinct from p->'medicationMetadata' then
    raise exception 'test dispensing create lost taxonomy or changed clinical lifecycle'; end if;
  revision_before:=(select count(*) from public.order_catalog_items);
  begin
    perform public.clair_create_order_catalog_item('clair-demo',p||'{"labFamilyCode":"cbc"}'::jsonb);
    raise exception 'test invalid dispensing create accepted';
  exception when invalid_parameter_value then null; end;
  if (select count(*) from public.order_catalog_items)<>revision_before then
    raise exception 'test invalid dispensing create leaked row'; end if;
  perform set_config('request.jwt.claim.sub','99999999-9999-4999-8999-999999999999',true);
  begin
    perform public.clair_update_order_catalog_item('clair-demo',c.id,c.catalog_revision,'{"labFamilyCode":"cbc"}');
    raise exception 'test nonmember accepted';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub',(select user_id::text from wp01b_actor),true);
  if (select jsonb_agg(to_jsonb(x)) from (select to_jsonb(foreign_item) row from public.order_catalog_items foreign_item where workspace_id='clair-foreign-demo') x)
    is distinct from (select jsonb_agg(to_jsonb(x)) from taxonomy_foreign_before x) then raise exception 'test foreign catalog changed'; end if;
  if (select md5(coalesce(jsonb_agg(to_jsonb(o) order by o.id)::text,'')) from public.orders o)
    is distinct from (select fingerprint from taxonomy_orders_before) then raise exception 'test confirmed history changed'; end if;
  raise notice 'taxonomy SQL assertions passed: publish, immutable projection, adoption/retry, override/reset/clear/conflict/wildcard/detached, CAS, permissions, foreign/history';
end;
$test$;
