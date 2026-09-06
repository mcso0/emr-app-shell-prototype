-- WP-01B taxonomy storage only. No data backfill, release publication or remote apply.
-- Vocabulary materialized from reviewed proposal; contains no order-ID mapping.
alter table master.orders add column admin_subcategory_code text, add column lab_family_code text;
alter table public.order_catalog_items
  add column admin_subcategory_code text, add column lab_family_code text,
  add column taxonomy_source_baseline jsonb not null default '{}'::jsonb,
  add column taxonomy_merge_conflict jsonb;
create function private.clair_order_taxonomy_valid(p_type text, p_sub text, p_family text)
returns boolean language sql immutable set search_path = '' as $fn$
  select case when p_sub is null then p_family is null
  else exists(select 1 from (values
    ('basic-consultation', 'consultation'),
    ('other-consultation', 'consultation'),
    ('prevention', 'consultation'),
    ('clinical-pathology', 'clinical_lab'),
    ('system-exam', 'system_exam'),
    ('radiography', 'imaging'),
    ('ultrasound', 'imaging'),
    ('image-interpretation', 'imaging'),
    ('dental-care', 'treatment'),
    ('basic-treatment', 'treatment'),
    ('anesthesia', 'treatment'),
    ('surgery', 'treatment'),
    ('therapy', 'treatment'),
    ('hospitalization', 'hospitalization'),
    ('document-service', 'other'),
    ('emergency-service', 'other'),
    ('medical-supply', 'other'),
    ('oral-medication', 'dispensing'),
    ('injection', 'dispensing'),
    ('topical', 'dispensing'),
    ('ophthalmic', 'dispensing'),
    ('otic', 'dispensing'),
    ('transdermal', 'dispensing'),
    ('oromucosal', 'dispensing'),
    ('dispensing-packaging', 'dispensing')
  ) v(code,clinical_type) where v.code=p_sub and v.clinical_type=p_type)
  and case when p_sub='clinical-pathology' then p_family is not null and p_family in ('cbc','chemistry','fecal-parasitology','urinalysis','electrolyte-abg','coagulation','organ-metabolic','blood-typing','reticulocyte','blood-smear','cell','pancreatic','inflammation','thyroid','adrenal','infectious-disease','composite-assessment','in-house-blood')
    else p_family is null end end;
$fn$;
revoke all on function private.clair_order_taxonomy_valid(text,text,text) from public, anon, authenticated, service_role;
alter table public.order_catalog_items add constraint order_catalog_taxonomy_valid
  check(private.clair_order_taxonomy_valid(clinical_order_type,admin_subcategory_code,lab_family_code));

-- Keep old payload hashes stable when the two new keys are absent.
alter function private.clinical_master_assert_detail_keys(text,jsonb) rename to clinical_master_assert_detail_keys_before_taxonomy;
create function private.clinical_master_assert_detail_keys(p_record_type text,p_detail jsonb)
returns void language plpgsql immutable set search_path='' as $fn$
begin
  perform private.clinical_master_assert_detail_keys_before_taxonomy(p_record_type,
    case when p_record_type='order' then p_detail - array['adminSubcategoryCode','labFamilyCode'] else p_detail end);
  if p_record_type='order' and (p_detail ? 'adminSubcategoryCode' or p_detail ? 'labFamilyCode') then
    if not (p_detail ?& array['adminSubcategoryCode','labFamilyCode'])
      or jsonb_typeof(p_detail->'adminSubcategoryCode') not in ('null','string')
      or jsonb_typeof(p_detail->'labFamilyCode') not in ('null','string')
      or not private.clair_order_taxonomy_valid(p_detail->'executionPreset'->>'clinicalOrderType',
        p_detail->>'adminSubcategoryCode',p_detail->>'labFamilyCode') then
      raise exception 'catalog_taxonomy_pair_invalid' using errcode='22023';
    end if;
  end if;
end;
$fn$;
alter function private.clinical_master_canonicalize_detail(text,jsonb) rename to clinical_master_canonicalize_detail_before_taxonomy;
create function private.clinical_master_canonicalize_detail(p_record_type text,p_detail jsonb)
returns jsonb language plpgsql immutable set search_path='' as $fn$
declare v_base jsonb;
begin
  perform private.clinical_master_assert_detail_keys(p_record_type,p_detail);
  v_base := private.clinical_master_canonicalize_detail_before_taxonomy(p_record_type,
    case when p_record_type='order' then p_detail - array['adminSubcategoryCode','labFamilyCode'] else p_detail end);
  if p_record_type='order' and p_detail ? 'adminSubcategoryCode' then
    return v_base || jsonb_build_object('adminSubcategoryCode',p_detail->'adminSubcategoryCode','labFamilyCode',p_detail->'labFamilyCode');
  end if;
  return v_base;
end;
$fn$;

-- Publish from the immutable version, like the existing execution-preset projector.
-- Existing preset revision/hash/removal guards still execute; never bypass them.
create function private.clair_project_order_taxonomy_after_version()
returns trigger language plpgsql security definer set search_path='' as $fn$
declare v_detail jsonb := new.snapshot->'detail';
begin
  if new.snapshot->>'recordType' <> 'order' then return new; end if;
  if not (v_detail ? 'adminSubcategoryCode') then
    if exists(select 1 from master.master_record_versions v where v.master_record_id=new.master_record_id
      and v.revision<new.revision and v.snapshot->'detail' ? 'adminSubcategoryCode') then
      raise exception 'catalog_taxonomy_omission_forbidden' using errcode='23514';
    end if;
    return new;
  end if;
  perform private.clinical_master_assert_detail_keys('order',v_detail);
  update master.orders set admin_subcategory_code=v_detail->>'adminSubcategoryCode',
    lab_family_code=v_detail->>'labFamilyCode' where master_record_id=new.master_record_id;
  if not found then raise exception 'catalog_taxonomy_order_projection_missing' using errcode='23503'; end if;
  return new;
end;
$fn$;
create trigger master_order_taxonomy_projection_after_insert after insert on master.master_record_versions
for each row execute function private.clair_project_order_taxonomy_after_version();

alter function private.clinical_master_order_source_projection(uuid) rename to clinical_master_order_source_projection_before_taxonomy;
create function private.clinical_master_order_source_projection(p_master_record_id uuid)
returns jsonb language sql stable security definer set search_path='' as $fn$
  select private.clinical_master_order_source_projection_before_taxonomy(p_master_record_id) ||
    case when version.snapshot->'detail' ? 'adminSubcategoryCode' then jsonb_build_object('taxonomy',
      jsonb_build_object('adminSubcategoryCode',o.admin_subcategory_code,'labFamilyCode',o.lab_family_code))
    else '{}'::jsonb end
  from master.orders o join master.master_records r on r.id=o.master_record_id
  join master.master_record_versions version on version.master_record_id=r.id and version.revision=r.current_revision
  where r.id=p_master_record_id;
$fn$;

-- Separate per-field applied baselines: unrelated customized fields do not block taxonomy.
create function private.clair_merge_order_taxonomy(p_workspace_id text,p_item_id text,p_source jsonb)
returns boolean language plpgsql security definer set search_path='' as $fn$
declare c public.order_catalog_items%rowtype; n public.order_catalog_items%rowtype;
  v_pair jsonb; v_key text; v_revision integer; v_custom text[]; v_baseline jsonb;
begin
  if p_source is null or not (p_source ? 'taxonomy') then return false; end if;
  select * into c from public.order_catalog_items where workspace_id=p_workspace_id and id=p_item_id for update;
  if not found or c.customization_state='detached' or c.origin_type<>'clair_master'
    or c.source_master_record_id is distinct from (p_source->>'masterRecordId')::uuid then return false; end if;
  v_revision := (p_source->>'revision')::integer;
  if v_revision is null or v_revision<=0 or exists(select 1 from jsonb_each(c.taxonomy_source_baseline) b
    where (b.value->>'revision')::integer>v_revision) or (c.taxonomy_merge_conflict->>'revision')::integer>v_revision then
    raise exception 'catalog_taxonomy_source_revision_stale' using errcode='40001';
  end if;
  v_pair := jsonb_build_object('adminSubcategoryCode',c.admin_subcategory_code,'labFamilyCode',c.lab_family_code);
  v_baseline := c.taxonomy_source_baseline;
  v_custom := coalesce(c.customized_fields,'{}');
  foreach v_key in array array['adminSubcategoryCode','labFamilyCode'] loop
    if not (v_key=any(v_custom) or '*'=any(v_custom)) then
      -- Detect untracked divergence, including legacy non-null values without a baseline.
      if (v_baseline ? v_key and v_pair->v_key is distinct from v_baseline->v_key->'value')
        or (not (v_baseline ? v_key) and v_pair->v_key <> 'null'::jsonb) then
        v_custom := array_append(v_custom,v_key);
      else
        v_pair := jsonb_set(v_pair,array[v_key],p_source->'taxonomy'->v_key);
        v_baseline := jsonb_set(v_baseline,array[v_key],
          jsonb_build_object('value',p_source->'taxonomy'->v_key,'revision',v_revision));
      end if;
    end if;
  end loop;
  n := c;
  if private.clair_order_taxonomy_valid(c.clinical_order_type,v_pair->>'adminSubcategoryCode',v_pair->>'labFamilyCode') then
    n.admin_subcategory_code := v_pair->>'adminSubcategoryCode';
    n.lab_family_code := v_pair->>'labFamilyCode';
    n.taxonomy_source_baseline := v_baseline;
    n.taxonomy_merge_conflict := null;
  else
    -- Preserve BOTH values and BOTH applied baselines on a pair conflict.
    n.taxonomy_merge_conflict := jsonb_build_object('revision',v_revision,'proposed',v_pair);
  end if;
  n.customized_fields := v_custom;
  if v_custom is distinct from c.customized_fields and cardinality(v_custom)>0 then n.customization_state:='customized'; end if;
  if (n.admin_subcategory_code,n.lab_family_code,n.taxonomy_source_baseline,n.taxonomy_merge_conflict,n.customized_fields)
    is not distinct from (c.admin_subcategory_code,c.lab_family_code,c.taxonomy_source_baseline,c.taxonomy_merge_conflict,c.customized_fields) then return false; end if;
  update public.order_catalog_items set admin_subcategory_code=n.admin_subcategory_code,lab_family_code=n.lab_family_code,
    taxonomy_source_baseline=n.taxonomy_source_baseline,taxonomy_merge_conflict=n.taxonomy_merge_conflict,
    customized_fields=n.customized_fields,customization_state=n.customization_state,
    catalog_revision=catalog_revision+1,updated_at=now()
    where workspace_id=p_workspace_id and id=p_item_id returning * into n;
  perform private.clair_pr020_append_order_catalog_audit(p_workspace_id,'order_catalog.updated',c.id,c,n,'taxonomy_source_merge',array['adminSubcategoryCode','labFamilyCode']);
  return true;
end;
$fn$;

alter function private.clair_adopt_master_release_to_workspace_a2_base(text,uuid) rename to clair_adopt_master_release_before_taxonomy;
create function private.clair_adopt_master_release_to_workspace_a2_base(p_workspace_id text,p_release_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare v_result jsonb; v_row record; v_scope text; v_count integer:=0;
begin
  -- Reuse exact release eligibility, owner manifest, preset guards and workspace lock.
  v_result := private.clair_adopt_master_release_before_taxonomy(p_workspace_id,p_release_id);
  select adoption_scope into v_scope from master.master_releases where id=p_release_id;
  for v_row in select c.id,private.clinical_master_order_source_projection(r.id) as source
    from public.order_catalog_items c join master.master_records r on r.id=c.source_master_record_id
    where c.workspace_id=p_workspace_id and c.origin_type='clair_master' and c.customization_state<>'detached'
      and r.safety_status='normal' and r.lifecycle_status='published' and r.replacement_record_id is null
      and (v_scope='cumulative' or exists(select 1 from private.clinical_master_release_payload_owner_manifest m
        where m.release_id=p_release_id and m.master_record_id=r.id and m.included and m.record_type='order'
          and m.effective_revision=r.current_revision))
    order by c.id
  loop
    if private.clair_merge_order_taxonomy(p_workspace_id,v_row.id,v_row.source) then v_count:=v_count+1; end if;
  end loop;
  return v_result || jsonb_build_object('taxonomyMergedItemCount',v_count);
end;
$fn$;

-- Existing public writer still owns clinical edits. Taxonomy-only patches bypass
-- clinical revalidation/review resets, but not membership, management permission or CAS.
alter function public.clair_update_order_catalog_item(text,text,integer,jsonb) rename to clair_update_order_catalog_item_before_taxonomy;
create function public.clair_update_order_catalog_item(p_workspace_id text,p_item_id text,p_expected_catalog_revision integer,p_patch jsonb)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare c public.order_catalog_items%rowtype; n public.order_catalog_items%rowtype;
  v_rest jsonb; v_pair jsonb; v_key text; v_reset jsonb; v_source jsonb; v_result jsonb;
  v_fields text[]:='{}'; v_baseline jsonb; v_custom text[];
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if p_patch is null or jsonb_typeof(p_patch)<>'object' then raise exception 'catalog_patch_object_required' using errcode='22023'; end if;
  if not (p_patch ?| array['adminSubcategoryCode','labFamilyCode','resetTaxonomyFields']) then
    return public.clair_update_order_catalog_item_before_taxonomy(p_workspace_id,p_item_id,p_expected_catalog_revision,p_patch);
  end if;
  if not private.clair_is_active_workspace_member(p_workspace_id)
    or not private.clair_current_user_has_workspace_permission(p_workspace_id,'service_catalog:manage') then
    raise exception 'workspace_admin_required' using errcode='42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('clinical_master_workspace_adoption:'||p_workspace_id,0));
  select * into c from public.order_catalog_items where workspace_id=p_workspace_id and id=p_item_id for update;
  if not found then raise exception 'order_catalog_item_not_found' using errcode='P0002'; end if;
  if p_expected_catalog_revision is null or c.catalog_revision<>p_expected_catalog_revision then
    raise exception 'catalog_revision_conflict' using errcode='40001'; end if;
  v_reset := coalesce(p_patch->'resetTaxonomyFields','[]'::jsonb);
  if jsonb_typeof(v_reset)<>'array' then raise exception 'catalog_taxonomy_reset_invalid' using errcode='22023'; end if;
  if exists(select 1 from jsonb_array_elements(v_reset) x where jsonb_typeof(x)<>'string'
    or x#>>'{}' not in ('adminSubcategoryCode','labFamilyCode') or p_patch ? (x#>>'{}'))
    or jsonb_array_length(v_reset)<>(select count(distinct x) from jsonb_array_elements(v_reset) x) then
    raise exception 'catalog_taxonomy_reset_invalid' using errcode='22023'; end if;
  v_pair:=jsonb_build_object('adminSubcategoryCode',c.admin_subcategory_code,'labFamilyCode',c.lab_family_code);
  v_baseline:=c.taxonomy_source_baseline; v_custom:=coalesce(c.customized_fields,'{}');
  if jsonb_array_length(v_reset)>0 then
    if '*'=any(v_custom) then raise exception 'catalog_taxonomy_wildcard_reset_requires_reconciliation' using errcode='22023'; end if;
    if c.origin_type<>'clair_master' or c.customization_state='detached' then
      raise exception 'catalog_taxonomy_reset_source_missing' using errcode='22023'; end if;
    v_source:=private.clinical_master_order_source_projection(c.source_master_record_id);
    if v_source is null or not(v_source ? 'taxonomy') or v_source->>'lifecycleStatus'<>'published'
      or v_source->>'safetyStatus'<>'normal' or nullif(v_source->>'replacementRecordId','') is not null then
      raise exception 'catalog_taxonomy_reset_source_missing' using errcode='22023'; end if;
  end if;
  foreach v_key in array array['adminSubcategoryCode','labFamilyCode'] loop
    if p_patch ? v_key then
      if jsonb_typeof(p_patch->v_key) not in ('null','string') then raise exception 'catalog_taxonomy_pair_invalid' using errcode='22023'; end if;
      v_pair:=jsonb_set(v_pair,array[v_key],p_patch->v_key);
      if not(v_key=any(v_custom)) then v_custom:=array_append(v_custom,v_key); end if;
      v_fields:=array_append(v_fields,v_key);
    elsif v_reset ? v_key then
      v_pair:=jsonb_set(v_pair,array[v_key],v_source->'taxonomy'->v_key);
      v_baseline:=jsonb_set(v_baseline,array[v_key],jsonb_build_object('value',v_source->'taxonomy'->v_key,'revision',(v_source->>'revision')::integer));
      v_custom:=array_remove(v_custom,v_key); v_fields:=array_append(v_fields,v_key);
    end if;
  end loop;
  if not private.clair_order_taxonomy_valid(c.clinical_order_type,v_pair->>'adminSubcategoryCode',v_pair->>'labFamilyCode') then
    raise exception 'catalog_taxonomy_pair_invalid' using errcode='22023'; end if;
  v_rest:=p_patch-array['adminSubcategoryCode','labFamilyCode','resetTaxonomyFields'];
  if v_rest<>'{}'::jsonb then
    v_result:=public.clair_update_order_catalog_item_before_taxonomy(p_workspace_id,p_item_id,p_expected_catalog_revision,v_rest);
    select * into c from public.order_catalog_items where workspace_id=p_workspace_id and id=p_item_id;
    -- Keep customizations created by the clinical writer during this same transaction.
    select coalesce(array_agg(distinct x order by x),'{}') into v_custom
    from unnest(v_custom || array(select x from unnest(coalesce(c.customized_fields,'{}')) x
      where x not in ('adminSubcategoryCode','labFamilyCode'))) x;
  end if;
  if (c.admin_subcategory_code,c.lab_family_code,c.taxonomy_source_baseline,c.customized_fields,c.taxonomy_merge_conflict)
    is not distinct from (v_pair->>'adminSubcategoryCode',v_pair->>'labFamilyCode',v_baseline,v_custom,null::jsonb) then
    return jsonb_build_object('ok',true,'status',200,'item',to_jsonb(c),'databaseAuditWritten',true);
  end if;
  update public.order_catalog_items set admin_subcategory_code=v_pair->>'adminSubcategoryCode',
    lab_family_code=v_pair->>'labFamilyCode',taxonomy_source_baseline=v_baseline,taxonomy_merge_conflict=null,
    customized_fields=v_custom,customization_state=case when c.customization_state='detached' then 'detached'
      when cardinality(v_custom)>0 then 'customized' else 'unmodified' end,
    last_customized_at=now(),last_customized_by_user_id=auth.uid()::text,
    catalog_revision=catalog_revision+1,updated_at=now()
    where workspace_id=p_workspace_id and id=p_item_id returning * into n;
  perform private.clair_pr020_append_order_catalog_audit(p_workspace_id,'order_catalog.updated',c.id,c,n,'taxonomy_update',v_fields);
  return jsonb_build_object('ok',true,'status',200,'item',to_jsonb(n),'databaseAuditWritten',true);
end;
$fn$;

alter function public.clair_create_order_catalog_item(text,jsonb) rename to clair_create_order_catalog_item_before_taxonomy;
create function public.clair_create_order_catalog_item(p_workspace_id text,p_item jsonb)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare v_result jsonb; v_patch jsonb:='{}'; v_key text;
  c public.order_catalog_items%rowtype; n public.order_catalog_items%rowtype;
begin
  v_result:=public.clair_create_order_catalog_item_before_taxonomy(p_workspace_id,
    p_item-array['adminSubcategoryCode','labFamilyCode']);
  foreach v_key in array array['adminSubcategoryCode','labFamilyCode'] loop
    if p_item ? v_key then v_patch:=v_patch||jsonb_build_object(v_key,p_item->v_key); end if;
  end loop;
  if v_patch<>'{}'::jsonb then
    -- The predecessor authorized this exact new row (including veterinarian
    -- dispensing authors). Do not impose generic manage permission afterwards.
    select * into strict c from public.order_catalog_items
      where workspace_id=p_workspace_id and id=v_result->'item'->>'id' for update;
    if not private.clair_order_taxonomy_valid(c.clinical_order_type,
      v_patch->>'adminSubcategoryCode',v_patch->>'labFamilyCode') then
      raise exception 'catalog_taxonomy_pair_invalid' using errcode='22023';
    end if;
    update public.order_catalog_items set admin_subcategory_code=v_patch->>'adminSubcategoryCode',
      lab_family_code=v_patch->>'labFamilyCode',catalog_revision=catalog_revision+1,updated_at=now()
      where workspace_id=p_workspace_id and id=c.id returning * into n;
    perform private.clair_pr020_append_order_catalog_audit(p_workspace_id,'order_catalog.updated',c.id,c,n,'taxonomy_create',array['adminSubcategoryCode','labFamilyCode']);
    v_result:=v_result||jsonb_build_object('item',to_jsonb(n),'databaseAuditWritten',true);
  end if;
  return v_result;
end;
$fn$;
revoke all on function public.clair_create_order_catalog_item_before_taxonomy(text,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.clair_create_order_catalog_item(text,jsonb) from public,anon,service_role;
grant execute on function public.clair_create_order_catalog_item(text,jsonb) to authenticated;

-- Snapshot wrappers preserve all prior billing/eligibility/permission checks.
alter function private.clair_build_catalog_order_snapshot(text,text,numeric) rename to clair_build_catalog_order_snapshot_before_taxonomy;
create function private.clair_build_catalog_order_snapshot(p_workspace_id text,p_catalog_item_id text,p_quantity numeric)
returns jsonb language plpgsql stable security definer set search_path='' as $fn$
declare v_base jsonb; c public.order_catalog_items%rowtype;
begin
  v_base:=private.clair_build_catalog_order_snapshot_before_taxonomy(p_workspace_id,p_catalog_item_id,p_quantity);
  select * into strict c from public.order_catalog_items where workspace_id=p_workspace_id and id=p_catalog_item_id;
  return v_base || jsonb_build_object('adminSubcategoryCode',c.admin_subcategory_code,'labFamilyCode',c.lab_family_code);
end;
$fn$;
alter function private.clair_pr020_order_catalog_audit_snapshot(public.order_catalog_items) rename to clair_pr020_order_catalog_audit_snapshot_before_taxonomy;
create function private.clair_pr020_order_catalog_audit_snapshot(p_item public.order_catalog_items)
returns jsonb language sql stable security definer set search_path='' as $fn$
  select private.clair_pr020_order_catalog_audit_snapshot_before_taxonomy(p_item) ||
    jsonb_build_object('adminSubcategoryCode',(p_item).admin_subcategory_code,'labFamilyCode',(p_item).lab_family_code,
      'taxonomySourceBaseline',(p_item).taxonomy_source_baseline,'taxonomyMergeConflict',(p_item).taxonomy_merge_conflict);
$fn$;

-- Patch only exact snapshot construction anchors; refuse unexpected predecessor drift.
do $patch_search$
declare d text; anchor text := '''clinicalOrderType'', catalog.clinical_order_type,';
begin
  d:=pg_get_functiondef('public.clair_list_order_catalog_chart_search_v2(text)'::regprocedure);
  if (length(d)-length(replace(d,anchor,'')))/length(anchor)<>1 then raise exception 'catalog_taxonomy_search_anchor_missing'; end if;
  execute replace(d,anchor,anchor|| E'\n        ''adminSubcategoryCode'', catalog.admin_subcategory_code,\n        ''labFamilyCode'', catalog.lab_family_code,');
end;
$patch_search$;

-- None of these helpers are new public endpoints. Retain the one existing RPC grant.
revoke all on function public.clair_update_order_catalog_item_before_taxonomy(text,text,integer,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.clair_update_order_catalog_item(text,text,integer,jsonb) from public,anon,service_role;
grant execute on function public.clair_update_order_catalog_item(text,text,integer,jsonb) to authenticated;
revoke all on function private.clinical_master_assert_detail_keys_before_taxonomy(text,jsonb),
 private.clinical_master_assert_detail_keys(text,jsonb),
 private.clinical_master_canonicalize_detail_before_taxonomy(text,jsonb),
 private.clinical_master_canonicalize_detail(text,jsonb),
 private.clair_project_order_taxonomy_after_version(),
 private.clinical_master_order_source_projection_before_taxonomy(uuid),
 private.clinical_master_order_source_projection(uuid),
 private.clair_merge_order_taxonomy(text,text,jsonb),
 private.clair_adopt_master_release_before_taxonomy(text,uuid),
 private.clair_adopt_master_release_to_workspace_a2_base(text,uuid),
 private.clair_build_catalog_order_snapshot_before_taxonomy(text,text,numeric),
 private.clair_build_catalog_order_snapshot(text,text,numeric),
 private.clair_pr020_order_catalog_audit_snapshot_before_taxonomy(public.order_catalog_items),
 private.clair_pr020_order_catalog_audit_snapshot(public.order_catalog_items)
 from public,anon,authenticated,service_role;
