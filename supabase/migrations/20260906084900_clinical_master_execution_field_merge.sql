-- WP-02: execution inputs merge as typed, presence-aware fields. Array/object
-- values are atomic fields, not recursively merged clinical instructions.
alter table public.order_catalog_items
  add column execution_source_baseline jsonb not null default '{}'::jsonb,
  add column execution_merge_conflicts jsonb not null default '{}'::jsonb;

-- Once field lineage exists, the old whole-object copier must not preempt the
-- three-way merge. Keep its initial import and legacy taxonomy normalization.
do $patch_copy$
declare body text; anchor text:='and item.customization_state = ''unmodified''';
begin
  body:=pg_get_functiondef('private.clair_sync_adopted_execution_preset_copy(text,uuid,text)'::regprocedure);
  if (length(body)-length(replace(body,anchor,'')))/length(anchor)<>1 then
    raise exception 'execution_copy_patch_anchor_mismatch'; end if;
  execute replace(body,anchor,anchor||' and item.execution_source_baseline = ''{}''::jsonb');
end;
$patch_copy$;

-- Full-object replacement clears omitted keys. Let the existing leaf validators
-- see an explicit workspace resolver for those cleared keys as well; the outer
-- writer restores the original policy of every truly unchanged field.
do $patch_clear$
declare body text; anchor text;
begin
  body:=pg_get_functiondef('public.clair_update_order_catalog_item_a2_unlocked(text,text,integer,jsonb)'::regprocedure);
  anchor:='jsonb_object_keys(v_requested_default)';
  if (length(body)-length(replace(body,anchor,'')))/length(anchor)<>1 then raise exception 'execution_clear_patch_anchor_mismatch'; end if;
  execute replace(body,anchor,'jsonb_object_keys(v_requested_default || v_item.default_detail_inputs)');
  body:=pg_get_functiondef('private.clair_update_workspace_dispensing_order(text,text,integer,jsonb)'::regprocedure);
  anchor:='case when v_generic_present then v_generic else v_nested end';
  if (length(body)-length(replace(body,anchor,'')))/length(anchor)<>1 then raise exception 'execution_dispensing_clear_patch_anchor_mismatch'; end if;
  execute replace(body,anchor,'(case when v_generic_present then v_generic else v_nested end) || v_item.default_detail_inputs');
end;
$patch_clear$;

create function private.clair_execution_field_cell(p_values jsonb,p_policies jsonb,p_key text)
returns jsonb language sql immutable set search_path='' as $fn$
  select jsonb_build_object('present',p_values ? p_key,'policyPresent',p_policies ? p_key)
    || case when p_values ? p_key then jsonb_build_object('value',p_values->p_key) else '{}'::jsonb end
    || case when p_policies ? p_key then jsonb_build_object('policy',p_policies->p_key) else '{}'::jsonb end;
$fn$;

-- Bootstrap only from the exact immutable preset previously copied into this
-- row. Never label the newest master as the base for old local edits.
create function private.clair_execution_baseline(p_item public.order_catalog_items)
returns jsonb language plpgsql stable security definer set search_path='' as $fn$
declare p master.order_execution_presets%rowtype; b jsonb:=p_item.execution_source_baseline; k text;
begin
  select * into p from master.order_execution_presets where id=p_item.source_execution_preset_id
    and preset_revision=p_item.source_execution_preset_revision
    and order_record_id=p_item.source_master_record_id
    and content_sha256=p_item.source_execution_preset_sha256;
  if not found then return b; end if;
  for k in select jsonb_object_keys(p.default_detail_inputs || p.field_policies) loop
    if not (b ? k) then
      b:=jsonb_set(b,array[k],jsonb_build_object(
        'cell',private.clair_execution_field_cell(p.default_detail_inputs,p.field_policies,k),
        'masterRevision',p.order_record_revision,'presetRevision',p.preset_revision,
        'presetId',p.id,'sha256',p.content_sha256));
    end if;
  end loop;
  return b;
end;
$fn$;

create function private.clair_merge_order_execution_fields(p_workspace_id text,p_item_id text)
returns boolean language plpgsql security definer set search_path='' as $fn$
declare c public.order_catalog_items%rowtype; n public.order_catalog_items%rowtype;
  p master.order_execution_presets%rowtype; b jsonb; conflicts jsonb; custom text[];
  vals jsonb; policies jsonb; k text; oldcell jsonb; localcell jsonb; incoming jsonb;
  stamp jsonb; overridden boolean;
begin
  select * into c from public.order_catalog_items where workspace_id=p_workspace_id and id=p_item_id for update;
  if not found or c.origin_type<>'clair_master' or c.customization_state='detached' then return false; end if;
  select preset.* into p from master.order_execution_preset_current ptr
    join master.order_execution_presets preset on preset.id=ptr.preset_id and preset.preset_revision=ptr.preset_revision
      and preset.order_record_id=ptr.order_record_id
    join master.master_records r on r.id=ptr.order_record_id and r.current_revision=preset.order_record_revision
    where r.id=c.source_master_record_id and r.lifecycle_status='published' and r.safety_status='normal'
      and r.replacement_record_id is null;
  if not found then raise exception 'catalog_execution_current_source_missing' using errcode='23514'; end if;
  b:=private.clair_execution_baseline(c); conflicts:=c.execution_merge_conflicts;
  custom:=coalesce(c.customized_fields,'{}'); vals:=c.default_detail_inputs; policies:=c.default_detail_input_policies;
  if exists(select 1 from jsonb_each(b) e where (e.value->>'masterRevision')::integer>p.order_record_revision
      or (e.value->>'presetRevision')::integer>p.preset_revision) then
    raise exception 'catalog_execution_source_revision_stale' using errcode='40001';
  end if;
  -- Legacy whole-object edits retain whole-object protection until explicitly
  -- reconciled. New writes below record only changed dotted field paths.
  if custom && array['*','defaultDetailInputs','default_detail_inputs'] then return false; end if;
  if c.clinical_order_type<>p.clinical_order_type or c.detail_schema_version<>p.detail_schema_version then
    conflicts:=jsonb_build_object('$schema',jsonb_build_object('masterRevision',p.order_record_revision,
      'presetRevision',p.preset_revision,'clinicalOrderType',p.clinical_order_type,'detailSchemaVersion',p.detail_schema_version));
  else
    conflicts:=conflicts-array['$schema','$contract'];
    for k in select jsonb_object_keys(b || vals || policies || p.default_detail_inputs || p.field_policies) order by 1 loop
      oldcell:=b->k->'cell';
      localcell:=private.clair_execution_field_cell(vals,policies,k);
      incoming:=private.clair_execution_field_cell(p.default_detail_inputs,p.field_policies,k);
      stamp:=jsonb_build_object('cell',incoming,'masterRevision',p.order_record_revision,
        'presetRevision',p.preset_revision,'presetId',p.id,'sha256',p.content_sha256);
      overridden:=('defaultDetailInputs.'||k)=any(custom)
        or (oldcell is not null and localcell is distinct from oldcell)
        or (oldcell is null and localcell is distinct from '{"present":false,"policyPresent":false}'::jsonb);
      if overridden then
        if not (('defaultDetailInputs.'||k)=any(custom)) then custom:=array_append(custom,'defaultDetailInputs.'||k); end if;
        if localcell is not distinct from incoming then conflicts:=conflicts-k;
        elsif oldcell is distinct from incoming then
          conflicts:=jsonb_set(conflicts,array[k],jsonb_build_object('base',oldcell,'local',localcell,'incoming',stamp));
        elsif conflicts ? k then
          -- Another source field may advance the preset while this unresolved
          -- proposal stays equal. Refresh its decision revision, not its base.
          conflicts:=jsonb_set(conflicts,array[k,'incoming'],stamp);
        end if;
      else
        vals:=vals-k; policies:=policies-k;
        if p.default_detail_inputs ? k then vals:=jsonb_set(vals,array[k],p.default_detail_inputs->k); end if;
        if p.field_policies ? k then policies:=jsonb_set(policies,array[k],p.field_policies->k); end if;
        conflicts:=conflicts-k;
      end if;
      b:=jsonb_set(b,array[k],stamp);
    end loop;
    if not private.clair_order_execution_preset_contract_is_valid(c.clinical_order_type,c.detail_schema_version,vals,policies) then
      -- A valid field-level merge may violate a cross-field contract. Preserve
      -- the complete current object and its baseline; expose the proposal.
      conflicts:=jsonb_build_object('$contract',jsonb_build_object('masterRevision',p.order_record_revision,
        'presetRevision',p.preset_revision,'proposedValues',vals,'proposedPolicies',policies));
      vals:=c.default_detail_inputs; policies:=c.default_detail_input_policies; b:=c.execution_source_baseline;
    end if;
  end if;
  n:=c; n.default_detail_inputs:=vals; n.default_detail_input_policies:=policies;
  n.execution_source_baseline:=b; n.execution_merge_conflicts:=conflicts; n.customized_fields:=custom;
  -- Baseline was captured from the old exact pointer above. After a valid merge,
  -- identify the new source even when hospital field overrides remain. Otherwise
  -- new synthetic inputs could inherit an old clinically-reviewed safety label.
  if not (conflicts ?| array['$schema','$contract']) then
    n.source_execution_preset_id:=p.id; n.source_execution_preset_revision:=p.preset_revision;
    n.source_execution_preset_sha256:=p.content_sha256;
  end if;
  if (vals,policies,b,conflicts,custom,n.source_execution_preset_id,n.source_execution_preset_revision,n.source_execution_preset_sha256) is not distinct from
    (c.default_detail_inputs,c.default_detail_input_policies,c.execution_source_baseline,c.execution_merge_conflicts,c.customized_fields,
      c.source_execution_preset_id,c.source_execution_preset_revision,c.source_execution_preset_sha256) then return false; end if;
  update public.order_catalog_items set default_detail_inputs=vals,default_detail_input_policies=policies,
    execution_source_baseline=b,execution_merge_conflicts=conflicts,customized_fields=custom,
    source_execution_preset_id=n.source_execution_preset_id,source_execution_preset_revision=n.source_execution_preset_revision,
    source_execution_preset_sha256=n.source_execution_preset_sha256,
    customization_state=case when cardinality(custom)>0 then 'customized' else customization_state end,
    -- Keep a persisted compatibility mirror, including an explicit empty copy.
    medication_metadata=case when clinical_order_type='dispensing' then jsonb_set(medication_metadata,'{defaultDetailInputs}',vals) else medication_metadata end,
    catalog_revision=catalog_revision+1,updated_at=now()
    where workspace_id=p_workspace_id and id=p_item_id returning * into n;
  perform private.clair_pr020_append_order_catalog_audit(p_workspace_id,'order_catalog.updated',c.id,c,n,
    'execution_field_source_merge',array['defaultDetailInputs']);
  return true;
end;
$fn$;

alter function private.clair_adopt_master_release_to_workspace_a2_base(text,uuid) rename to clair_adopt_master_release_before_execution_fields;
create function private.clair_adopt_master_release_to_workspace_a2_base(p_workspace_id text,p_release_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare result jsonb; r record; scope text; merged integer:=0;
begin
  -- Existing owner manifest, release revision, permission, workspace lock and
  -- historical whole-row review paths remain authoritative.
  result:=private.clair_adopt_master_release_before_execution_fields(p_workspace_id,p_release_id);
  select adoption_scope into scope from master.master_releases where id=p_release_id;
  for r in select c.id from public.order_catalog_items c join master.master_records m on m.id=c.source_master_record_id
    where c.workspace_id=p_workspace_id and c.origin_type='clair_master' and c.customization_state<>'detached'
      and m.lifecycle_status='published' and m.safety_status='normal' and m.replacement_record_id is null
      and (scope='cumulative' or exists(select 1 from private.clinical_master_release_payload_owner_manifest o
        where o.release_id=p_release_id and o.master_record_id=m.id and o.included and o.record_type='order'
          and o.effective_revision=m.current_revision)) order by c.id
  loop
    if private.clair_merge_order_execution_fields(p_workspace_id,r.id) then merged:=merged+1; end if;
  end loop;
  return result||jsonb_build_object('executionFieldMergedItemCount',merged);
end;
$fn$;

-- The transport predecessor narrowed the dispensing-specific writer to catalog
-- managers despite its public capability retaining active veterinarian authors.
-- Restore that existing author contract only in this dispensing-only function;
-- preserve its row classification check, CAS, clinical gate and review lifecycle.
do $patch_dispensing_author$
declare body text; anchor text:=$anchor$or not private.clair_current_user_has_workspace_permission(
       p_workspace_id, 'service_catalog:manage'
     ) then
    raise exception 'dispensing_author_required'$anchor$;
begin
  body:=pg_get_functiondef('private.clair_update_workspace_dispensing_order(text,text,integer,jsonb)'::regprocedure);
  if (length(body)-length(replace(body,anchor,'')))/length(anchor)<>1 then
    raise exception 'dispensing_author_patch_anchor_mismatch'; end if;
  execute replace(body,anchor,$replacement$or not (
       private.clair_current_user_has_workspace_permission(p_workspace_id,'service_catalog:manage')
       or private.clair_is_workspace_admin(p_workspace_id)
       or private.clair_is_active_veterinarian_member(p_workspace_id,auth.uid())
     ) then
    raise exception 'dispensing_author_required'$replacement$);
end;
$patch_dispensing_author$;

-- Preserve the existing clinical writer and its validation/CAS/review behavior.
-- New full-object edits derive per-key changes; omission is an explicit clear.
alter function public.clair_update_order_catalog_item(text,text,integer,jsonb) rename to clair_update_order_catalog_item_before_execution_fields;
create function public.clair_update_order_catalog_item(p_workspace_id text,p_item_id text,p_expected_catalog_revision integer,p_patch jsonb)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare c public.order_catalog_items%rowtype; n public.order_catalog_items%rowtype;
  patch jsonb:=p_patch; vals jsonb; policies jsonb; baseline jsonb; conflicts jsonb; custom text[];
  resets jsonb:=coalesce(p_patch->'resetExecutionFields','[]'::jsonb);
  keeps jsonb:=coalesce(p_patch->'keepExecutionFields','[]'::jsonb);
  metadata jsonb; supplied jsonb; source jsonb; preset jsonb; k text; changed text[]:='{}'; result jsonb;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if jsonb_typeof(p_patch) is distinct from 'object' then raise exception 'catalog_patch_object_required' using errcode='22023'; end if;
  metadata:=coalesce(p_patch->'medicationMetadata',p_patch->'medication_metadata');
  if not (p_patch ?| array['defaultDetailInputs','default_detail_inputs','resetExecutionFields','keepExecutionFields'])
    and not coalesce(metadata ? 'defaultDetailInputs',false) then
    return public.clair_update_order_catalog_item_before_execution_fields(p_workspace_id,p_item_id,p_expected_catalog_revision,p_patch);
  end if;
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_admin_required' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('clinical_master_workspace_adoption:'||p_workspace_id,0));
  select * into c from public.order_catalog_items where workspace_id=p_workspace_id and id=p_item_id for update;
  if not found then raise exception 'order_catalog_item_not_found' using errcode='P0002'; end if;
  -- Preserve the existing dispensing-author boundary, without granting a
  -- veterinarian generic catalog management rights.
  if not private.clair_current_user_has_workspace_permission(p_workspace_id,'service_catalog:manage')
    and not (c.category_group='medication' and c.default_destination_module='dispensing'
      and (private.clair_is_workspace_admin(p_workspace_id)
        or private.clair_is_active_veterinarian_member(p_workspace_id,auth.uid()))) then
    raise exception 'workspace_admin_required' using errcode='42501'; end if;
  if c.catalog_revision is distinct from p_expected_catalog_revision then raise exception 'catalog_revision_conflict' using errcode='40001'; end if;
  if jsonb_typeof(resets)<>'array' or jsonb_typeof(keeps)<>'array' then
    raise exception 'catalog_execution_resolution_invalid' using errcode='22023'; end if;
  if (p_patch ? 'resetExecutionFields' and jsonb_array_length(resets)=0)
    or (p_patch ? 'keepExecutionFields' and jsonb_array_length(keeps)=0)
    or jsonb_array_length(resets||keeps)>100 then
    raise exception 'catalog_execution_resolution_invalid' using errcode='22023'; end if;
  if exists(select 1 from jsonb_array_elements(resets||keeps) x where jsonb_typeof(x)<>'string' or x#>>'{}' !~ '^[A-Za-z][A-Za-z0-9_]{0,99}$')
    or jsonb_array_length(resets||keeps)<>(select count(distinct x) from jsonb_array_elements(resets||keeps) x) then
    raise exception 'catalog_execution_resolution_invalid' using errcode='22023'; end if;
  if p_patch ? 'defaultDetailInputs' and p_patch ? 'default_detail_inputs'
    and p_patch->'defaultDetailInputs' is distinct from p_patch->'default_detail_inputs' then
    raise exception 'catalog_default_detail_inputs_alias_conflict' using errcode='22023'; end if;
  supplied:=coalesce(p_patch->'defaultDetailInputs',p_patch->'default_detail_inputs',metadata->'defaultDetailInputs');
  if supplied is not null and jsonb_typeof(supplied)<>'object' then raise exception 'catalog_default_detail_inputs_invalid' using errcode='22023'; end if;
  if supplied is not null and metadata ? 'defaultDetailInputs' and supplied is distinct from metadata->'defaultDetailInputs' then
    raise exception 'catalog_default_detail_inputs_mirror_conflict' using errcode='22023'; end if;
  if supplied is not null and jsonb_array_length(resets||keeps)>0 then
    raise exception 'catalog_execution_edit_resolution_mixed' using errcode='22023'; end if;
  vals:=coalesce(supplied,c.default_detail_inputs); policies:=c.default_detail_input_policies;
  baseline:=private.clair_execution_baseline(c); conflicts:=c.execution_merge_conflicts; custom:=coalesce(c.customized_fields,'{}');
  if jsonb_array_length(resets||keeps)>0 then
    if c.origin_type<>'clair_master' or c.customization_state='detached'
      or custom && array['*','defaultDetailInputs','default_detail_inputs'] then
      raise exception 'catalog_execution_resolution_requires_reconciliation' using errcode='22023'; end if;
    source:=private.clinical_master_order_source_projection(c.source_master_record_id); preset:=source->'executionPreset';
    if preset is null or source->>'lifecycleStatus'<>'published' or source->>'safetyStatus'<>'normal'
      or nullif(source->>'replacementRecordId','') is not null
      or preset->>'clinicalOrderType'<>c.clinical_order_type
      or (preset->>'detailSchemaVersion')::integer<>c.detail_schema_version then
      raise exception 'catalog_execution_resolution_source_invalid' using errcode='22023'; end if;
  end if;
  if supplied is not null then
    for k in select jsonb_object_keys(vals||c.default_detail_inputs) loop
      if (vals ? k) is distinct from (c.default_detail_inputs ? k) or vals->k is distinct from c.default_detail_inputs->k then
        changed:=array_append(changed,k);
        policies:=jsonb_set(policies,array[k],'"workspace_resolved"');
        if not (('defaultDetailInputs.'||k)=any(custom)) then custom:=array_append(custom,'defaultDetailInputs.'||k); end if;
        conflicts:=conflicts-k;
      end if;
    end loop;
  end if;
  for k in select x#>>'{}' from jsonb_array_elements(resets||keeps) x loop
    if not (baseline ? k or preset->'defaultDetailInputs' ? k or preset->'fieldPolicies' ? k) then
      raise exception 'catalog_execution_resolution_field_unknown' using errcode='22023'; end if;
    if keeps ? k and not (conflicts ? k) then raise exception 'catalog_execution_conflict_missing' using errcode='22023'; end if;
    -- Reject a stale source decision even if the catalog CAS happens to match.
    if keeps ? k and (conflicts->k->'incoming'->>'presetRevision')::integer is distinct from (preset->>'revision')::integer then
      raise exception 'catalog_execution_source_revision_stale' using errcode='40001'; end if;
    if resets ? k and (baseline->k->>'presetRevision')::integer is distinct from (preset->>'revision')::integer then
      raise exception 'catalog_execution_source_revision_stale' using errcode='40001'; end if;
    if resets ? k then
      vals:=vals-k; policies:=policies-k;
      if preset->'defaultDetailInputs' ? k then vals:=jsonb_set(vals,array[k],preset->'defaultDetailInputs'->k); end if;
      if preset->'fieldPolicies' ? k then policies:=jsonb_set(policies,array[k],preset->'fieldPolicies'->k); end if;
      custom:=array_remove(custom,'defaultDetailInputs.'||k);
    end if;
    baseline:=jsonb_set(baseline,array[k],jsonb_build_object(
      'cell',private.clair_execution_field_cell(preset->'defaultDetailInputs',preset->'fieldPolicies',k),
      'masterRevision',(source->>'revision')::integer,'presetRevision',(preset->>'revision')::integer,
      'presetId',preset->'id','sha256',preset->'contentSha256'));
    conflicts:=conflicts-k; changed:=array_append(changed,k);
  end loop;
  if not private.clair_order_execution_preset_contract_is_valid(c.clinical_order_type,c.detail_schema_version,vals,policies) then
    raise exception 'catalog_default_detail_inputs_invalid' using errcode='22023'; end if;
  conflicts:=conflicts-'$contract';
  patch:=(patch-array['resetExecutionFields','keepExecutionFields','default_detail_inputs'])||jsonb_build_object('defaultDetailInputs',vals);
  result:=public.clair_update_order_catalog_item_before_execution_fields(p_workspace_id,p_item_id,p_expected_catalog_revision,patch);
  select * into n from public.order_catalog_items where workspace_id=p_workspace_id and id=p_item_id;
  if n.clinical_order_type='dispensing' then
    perform private.clair_validate_workspace_dispensing_preset(
      jsonb_set(n.medication_metadata,'{defaultDetailInputs}',vals),n.price_krw,n.pricing_rule);
  end if;
  -- Remove only aggregate markers introduced by this write. Pre-migration
  -- whole-object customizations remain protected until explicit reconciliation.
  select coalesce(array_agg(distinct f order by f),'{}') into custom
    from unnest(custom || n.customized_fields) f where
      f not in ('defaultDetailInputs','default_detail_inputs') or f=any(c.customized_fields);
  -- A reset removes its dotted marker even when the legacy writer retained it.
  for k in select x#>>'{}' from jsonb_array_elements(resets) x loop custom:=array_remove(custom,'defaultDetailInputs.'||k); end loop;
  update public.order_catalog_items set default_detail_inputs=vals,default_detail_input_policies=policies,
    execution_source_baseline=baseline,execution_merge_conflicts=conflicts,customized_fields=custom,
    customization_state=case when c.customization_state='detached' then 'detached' when cardinality(custom)=0 then 'unmodified' else 'customized' end,
    medication_metadata=case when clinical_order_type='dispensing' then jsonb_set(medication_metadata,'{defaultDetailInputs}',vals) else medication_metadata end
    where workspace_id=p_workspace_id and id=p_item_id returning * into n;
  perform private.clair_pr020_append_order_catalog_audit(p_workspace_id,'order_catalog.updated',c.id,c,n,
    case when jsonb_array_length(resets)>0 then 'execution_field_accept_source'
      when jsonb_array_length(keeps)>0 then 'execution_field_keep_local' else 'execution_field_workspace_edit' end,changed);
  return result||jsonb_build_object('item',to_jsonb(n));
end;
$fn$;

revoke all on function public.clair_update_order_catalog_item_before_execution_fields(text,text,integer,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.clair_update_order_catalog_item(text,text,integer,jsonb) from public,anon,service_role;
grant execute on function public.clair_update_order_catalog_item(text,text,integer,jsonb) to authenticated;

-- A legacy whole-row accept is an explicit reconciliation. Its established
-- server-captured source/CAS checks run first, then reset field lineage to that
-- exact accepted copy. Reject/keep actions retain local field decisions.
alter function public.clair_resolve_workspace_master_update(text,uuid,integer,text) rename to clair_resolve_workspace_master_update_before_execution_fields;
create function public.clair_resolve_workspace_master_update(p_workspace_id text,p_update_id uuid,p_expected_catalog_revision integer,p_action text)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare result jsonb; c public.order_catalog_items%rowtype; n public.order_catalog_items%rowtype; baseline jsonb; custom text[];
begin
  result:=public.clair_resolve_workspace_master_update_before_execution_fields(p_workspace_id,p_update_id,p_expected_catalog_revision,p_action);
  if p_action<>'accept_source' then return result; end if;
  select i.* into strict c from public.order_catalog_items i join public.workspace_master_updates u
    on u.workspace_id=i.workspace_id and u.order_catalog_item_id=i.id
    where u.workspace_id=p_workspace_id and u.id=p_update_id;
  n:=c; n.execution_source_baseline:='{}'; baseline:=private.clair_execution_baseline(n);
  -- Accepting the complete execution copy resolves its legacy aggregate marker,
  -- not unrelated hospital-owned edits. Expand '*' into their named protection.
  select coalesce(array_agg(distinct f order by f),'{}') into custom from unnest(
    c.customized_fields || case when '*'=any(c.customized_fields) then array[
      'inHospitalOrderName','billingName','aliases','availabilityStatus','priceKrw','salesUnit','targetSpecies',
      'billingReflectionEnabled','careGuide','careGuideDeliveryEnabled','internalInstruction',
      'internalInstructionDeliveryEnabled','taxIncluded','roundingRule','pricingRule','medicationMetadata',
      'vaccineMetadata','adminSubcategoryCode','labFamilyCode'] else '{}'::text[] end) f
    where f not in ('*','defaultDetailInputs','default_detail_inputs') and f not like 'defaultDetailInputs.%';
  update public.order_catalog_items set execution_source_baseline=baseline,execution_merge_conflicts='{}',
    customized_fields=custom,customization_state=case when cardinality(custom)>0 then 'customized' else 'unmodified' end
    where workspace_id=p_workspace_id and id=c.id returning * into n;
  perform private.clair_pr020_append_order_catalog_audit(p_workspace_id,'order_catalog.updated',c.id,c,n,
    'execution_field_whole_source_reconciliation',array['executionSourceBaseline','executionMergeConflicts']);
  return result||jsonb_build_object('item',to_jsonb(n),'databaseAuditWritten',true);
end;
$fn$;
revoke all on function public.clair_resolve_workspace_master_update_before_execution_fields(text,uuid,integer,text) from public,anon,authenticated,service_role;
revoke all on function public.clair_resolve_workspace_master_update(text,uuid,integer,text) from public,anon,service_role;
grant execute on function public.clair_resolve_workspace_master_update(text,uuid,integer,text) to authenticated;

-- Freeze per-field provenance together with the new planned snapshot. Older
-- snapshots stay byte-for-byte unchanged and have no invented field lineage.
alter function private.clair_build_catalog_order_snapshot(text,text,numeric) rename to clair_build_catalog_order_snapshot_before_execution_fields;
create function private.clair_build_catalog_order_snapshot(p_workspace_id text,p_catalog_item_id text,p_quantity numeric)
returns jsonb language plpgsql stable security definer set search_path='' as $fn$
declare result jsonb; c public.order_catalog_items%rowtype;
begin
  result:=private.clair_build_catalog_order_snapshot_before_execution_fields(p_workspace_id,p_catalog_item_id,p_quantity);
  select * into strict c from public.order_catalog_items where workspace_id=p_workspace_id and id=p_catalog_item_id;
  return result||jsonb_build_object('executionSourceBaseline',c.execution_source_baseline,
    'executionCustomizedFields',to_jsonb(array(select f from unnest(c.customized_fields) f
      where f like 'defaultDetailInputs.%' or f in ('*','defaultDetailInputs','default_detail_inputs'))));
end;
$fn$;
alter function private.clair_pr020_order_catalog_audit_snapshot(public.order_catalog_items) rename to clair_pr020_catalog_audit_before_execution_fields;
create function private.clair_pr020_order_catalog_audit_snapshot(p_item public.order_catalog_items)
returns jsonb language sql stable security definer set search_path='' as $fn$
  select private.clair_pr020_catalog_audit_before_execution_fields(p_item)||
    jsonb_build_object('executionSourceBaseline',p_item.execution_source_baseline,'executionMergeConflicts',p_item.execution_merge_conflicts);
$fn$;
do $patch_search$
declare body text; anchor text:='''clinicalOrderType'', catalog.clinical_order_type,';
begin
  body:=pg_get_functiondef('public.clair_list_order_catalog_chart_search_v2(text)'::regprocedure);
  if (length(body)-length(replace(body,anchor,'')))/length(anchor)<>1 then raise exception 'execution_search_patch_anchor_mismatch'; end if;
  execute replace(body,anchor,anchor||E'\n        ''executionSourceBaseline'', catalog.execution_source_baseline,\n        ''executionCustomizedFields'', to_jsonb(array(select f from unnest(catalog.customized_fields) f where f like ''defaultDetailInputs.%'' or f in (''*'',''defaultDetailInputs'',''default_detail_inputs''))),');
end;
$patch_search$;
revoke all on function private.clair_build_catalog_order_snapshot_before_execution_fields(text,text,numeric),
  private.clair_build_catalog_order_snapshot(text,text,numeric),
  private.clair_pr020_catalog_audit_before_execution_fields(public.order_catalog_items),
  private.clair_pr020_order_catalog_audit_snapshot(public.order_catalog_items)
  from public,anon,authenticated,service_role;

revoke all on function private.clair_execution_field_cell(jsonb,jsonb,text),
  private.clair_execution_baseline(public.order_catalog_items),
  private.clair_merge_order_execution_fields(text,text),
  private.clair_adopt_master_release_before_execution_fields(text,uuid),
  private.clair_adopt_master_release_to_workspace_a2_base(text,uuid)
  from public,anon,authenticated,service_role;
