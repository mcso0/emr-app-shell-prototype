-- PR-011 additive publisher hotfix. The prior B1 migration remains immutable.
-- This migration is intentionally local/replayable; remote application is gated
-- by the approved PR-011 review chain.

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'private.clinical_master_lab_publish_stage'::regclass
      and conname = 'clinical_master_lab_publish_stage_record_type_check'
  ) then
    alter table private.clinical_master_lab_publish_stage
      drop constraint clinical_master_lab_publish_stage_record_type_check;
  end if;
  alter table private.clinical_master_lab_publish_stage
    add constraint clinical_master_lab_publish_stage_record_type_check
    check (record_type in (
      'order_category','clinical_action','chart_group','task_route','order',
      'species','unit','specimen_type','result_input_type','lab_test','lab_panel'
    ));
end
$$;

create or replace function private.publish_clinical_master_release(
  p_payload jsonb,
  p_actor_user_id uuid default null
)
returns jsonb language plpgsql security definer set search_path = public, private, master, extensions, pg_catalog as $$
declare
  v_payload jsonb;
  v_fingerprint text;
  v_release_key text;
  v_existing master.master_releases%rowtype;
  v_release master.master_releases%rowtype;
  v_record jsonb;
  v_rel jsonb;
  v_path jsonb;
  v_detail jsonb;
  v_source jsonb;
  v_names jsonb;
  v_master_key text;
  v_record_type text;
  v_record_id uuid;
  v_revision integer;
  v_latest_revision integer;
  v_existing_snapshot jsonb;
  v_incoming_content jsonb;
  v_snapshot jsonb;
  v_action_code text;
  v_record_count integer;
  v_preferred_ko_count integer;
  v_preferred_en_count integer;
  v_unit_id uuid;
  v_parent_id uuid;
  v_t_category_id uuid;
  v_input_id uuid;
  v_specimen_id uuid;
  v_panel_id uuid;
  v_test_id uuid;
  v_order_id uuid;
  v_path_id uuid;
  v_species_id uuid;
  v_action_id uuid;
  v_chart_id uuid;
  v_route_id uuid;
  v_existing_code text;
  v_relation_changed boolean;
  v_profile_test_key text;
  v_profile_panel_key text;
  v_profile_specimen_key text;
  v_relation jsonb := '[]'::jsonb;
  v_target_id uuid;
  v_target_revision integer;
  v_input_revision integer;
  v_unit_revision integer;
  v_input_key text;
  v_unit_key text;
  v_input_value_kind text;
  v_input_supports_unit boolean;
  v_unit_code text;
  v_test_vocabulary jsonb;
  v_vocabulary_snapshot jsonb;
  v_dependency_key text;
  v_dependency_type text;
  v_dependency_record_id uuid;
  v_dependency_revision integer;
  v_dependency_snapshot jsonb;
  v_record_found boolean;
begin
  if p_payload is null or pg_catalog.jsonb_typeof(p_payload) <> 'object' then raise exception 'clinical_master_payload_object_required' using errcode = '22023'; end if;
  if pg_catalog.jsonb_typeof(p_payload->'records') <> 'array' or jsonb_array_length(coalesce(p_payload->'records','[]'::jsonb)) = 0 then raise exception 'clinical_master_records_required' using errcode = '22023'; end if;
  if length(pg_catalog.btrim(coalesce(p_payload->>'publishedByLabel',''))) = 0 then raise exception 'clinical_master_published_by_label_required' using errcode = '22023'; end if;
  perform private.clinical_master_assert_contract_keys('payload', p_payload);

  for v_record in select value from jsonb_array_elements(p_payload->'records') records(value) loop
    perform private.clinical_master_assert_contract_keys('record', v_record);
    v_record_type := pg_catalog.btrim(v_record->>'recordType');
    if v_record_type not in ('order_category','clinical_action','chart_group','task_route','order','species','unit','specimen_type','result_input_type','lab_test','lab_panel') then raise exception 'clinical_master_record_type_not_allowed' using errcode = '22023'; end if;
    perform private.clinical_master_assert_detail_keys(v_record_type, coalesce(v_record->'detail','{}'::jsonb));
    if private.clinical_master_has_forbidden_key(v_record) then raise exception 'clinical_master_canonical_price_forbidden' using errcode = '22023'; end if;
    perform private.clinical_master_assert_contract_keys('source', coalesce(v_record->'source','{}'::jsonb));
    for v_names in select value from jsonb_array_elements(coalesce(v_record->'names','[]'::jsonb)) names(value) loop perform private.clinical_master_assert_contract_keys('name', v_names); end loop;
  end loop;
  for v_rel in select value from jsonb_array_elements(coalesce(p_payload->'labPanelItems','[]'::jsonb)) items(value) loop
    if jsonb_typeof(v_rel) <> 'object' or (select count(*) from jsonb_object_keys(v_rel)) not between 4 and 5
       or exists (select 1 from jsonb_object_keys(v_rel) key where key not in ('panelMasterKey','testMasterKey','sortOrder','required','displayGroup')) then raise exception 'clinical_master_lab_panel_item_contract_failed' using errcode = '22023'; end if;
    if length(btrim(coalesce(v_rel->>'panelMasterKey',''))) = 0 or length(btrim(coalesce(v_rel->>'testMasterKey',''))) = 0 or (v_rel->>'sortOrder')::integer < 0 then raise exception 'clinical_master_lab_panel_item_invalid' using errcode = '22023'; end if;
  end loop;
  for v_rel in select value from jsonb_array_elements(coalesce(p_payload->'labOrderProfiles','[]'::jsonb)) profiles(value) loop
    if jsonb_typeof(v_rel) <> 'object' or (select count(*) from jsonb_object_keys(v_rel)) <> 4
       or exists (select 1 from jsonb_object_keys(v_rel) key where key not in ('orderMasterKey','labTestMasterKey','labPanelMasterKey','specimenMasterKey')) then raise exception 'clinical_master_lab_order_profile_contract_failed' using errcode = '22023'; end if;
    if length(btrim(coalesce(v_rel->>'orderMasterKey',''))) = 0 then raise exception 'clinical_master_lab_order_profile_invalid' using errcode = '22023'; end if;
  end loop;
  -- Relation owners are the only records whose content can be replaced by a
  -- relation declaration.  A relation for an owner omitted from this
  -- release would otherwise disappear silently and leave a false revision
  -- snapshot.  Referenced vocabulary/test/panel records may be omitted and
  -- are pinned to their immutable current revision below.
  if exists (
    select 1
    from jsonb_array_elements(coalesce(p_payload->'labPanelItems','[]'::jsonb)) items(value)
    where not exists (
      select 1 from jsonb_array_elements(p_payload->'records') records(value)
      where value->>'masterKey'=items.value->>'panelMasterKey' and value->>'recordType'='lab_panel'
    )
  ) then
    raise exception 'clinical_master_lab_panel_owner_not_included' using errcode='23503';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(coalesce(p_payload->'labOrderProfiles','[]'::jsonb)) profiles(value)
    where not exists (
      select 1 from jsonb_array_elements(p_payload->'records') records(value)
      where value->>'masterKey'=profiles.value->>'orderMasterKey' and value->>'recordType'='order'
    )
  ) then
    raise exception 'clinical_master_lab_order_profile_owner_not_included' using errcode='23503';
  end if;

  v_payload := private.clinical_master_canonicalize_payload(p_payload);
  v_fingerprint := lower(encode(extensions.digest(convert_to(v_payload::text,'UTF8'),'sha256'),'hex'));
  v_release_key := nullif(btrim(v_payload->>'releaseKey'),'');
  perform pg_advisory_xact_lock(hashtextextended('clinical_master_phase_1a_1_publication',0));
  select * into v_existing from master.master_releases where source_fingerprint = v_fingerprint for update;
  if found then
    if v_existing.status = 'published' then return jsonb_build_object('releaseId',v_existing.id,'releaseNo',v_existing.release_no,'sourceFingerprint',v_existing.source_fingerprint,'idempotent',true,'recordCount',v_existing.record_count); end if;
    raise exception 'clinical_master_release_incomplete_conflict' using errcode = '40001';
  end if;
  if v_release_key is not null then
    select * into v_existing from master.master_releases where release_key = v_release_key for update;
    if found then raise exception 'clinical_master_release_key_conflict' using errcode = '40001'; end if;
  end if;
  v_record_count := jsonb_array_length(v_payload->'records');
  insert into master.master_releases (release_key,record_count,source_fingerprint,status,release_notes,published_by_user_id,published_by_label)
  values (v_release_key,v_record_count,v_fingerprint,'publishing',v_payload->>'releaseNotes',p_actor_user_id,v_payload->>'publishedByLabel') returning * into v_release;

  if exists (select 1 from jsonb_array_elements(v_payload->'records') records(value) group by value->>'masterKey' having btrim(value->>'masterKey') = '' or count(*) > 1) then raise exception 'clinical_master_duplicate_or_empty_master_key' using errcode = '22023'; end if;

  -- Materialize owner identities before the effective pass.  This lets the
  -- four stage rows resolve both included and omitted referenced owners while
  -- keeping the existing A1 identity/revision loop as the final authority.
  for v_record in select value from jsonb_array_elements(v_payload->'records') records(value) loop
    v_master_key := btrim(v_record->>'masterKey');
    v_record_type := btrim(v_record->>'recordType');
    select id into v_record_id from master.master_records where master_key=v_master_key for update;
    if not found then
      v_record_id := extensions.gen_random_uuid();
      insert into master.master_records(id,master_key,record_type,lifecycle_status,safety_status,safety_reason,current_revision,current_release_id,published_at)
      values(v_record_id,v_master_key,v_record_type,'published','normal',null,1,v_release.id,now());
    elsif (select record_type from master.master_records where id=v_record_id) is distinct from v_record_type then
      raise exception 'clinical_master_record_type_change_forbidden' using errcode='23514';
    end if;
  end loop;
  -- Restore the A1 typed materialization boundary before any path or order
  -- resolution. X categories must exist before their T children.
  for v_record in select value from jsonb_array_elements(v_payload->'records') records(value)
    where value->>'recordType'='order_category'
    order by case when value->'detail'->>'categoryLevel'='X' then 0 else 1 end, value->>'masterKey' loop
    select id into v_record_id from master.master_records where master_key=v_record->>'masterKey';
    v_detail := v_record->'detail';
    v_parent_id := null;
    if v_detail->>'categoryLevel'='T' then
      select category.master_record_id into v_parent_id
      from master.order_categories category
      join master.master_records parent_record on parent_record.id=category.master_record_id
      where parent_record.master_key=v_detail->>'parentMasterKey' and category.category_level='X';
      if v_parent_id is null then
        raise exception 'clinical_master_t_category_parent_missing' using errcode='23503';
      end if;
    end if;
    select category_code into v_existing_code
    from master.order_categories where master_record_id=v_record_id;
    if v_existing_code is not null and v_existing_code is distinct from btrim(v_detail->>'categoryCode') then
      raise exception 'clinical_master_category_code_conflict' using errcode='23514';
    end if;
    insert into master.order_categories(master_record_id,category_code,category_level,parent_category_id,sort_order)
    values(v_record_id,btrim(v_detail->>'categoryCode'),btrim(v_detail->>'categoryLevel'),v_parent_id,coalesce((v_detail->>'sortOrder')::integer,0))
    on conflict(master_record_id) do update
      set parent_category_id=excluded.parent_category_id,sort_order=excluded.sort_order;
  end loop;

  for v_record in select value from jsonb_array_elements(v_payload->'records') records(value)
    where value->>'recordType'='clinical_action' loop
    select id into v_record_id from master.master_records where master_key=v_record->>'masterKey';
    v_detail := v_record->'detail';
    select category.master_record_id into v_t_category_id
    from master.order_categories category
    join master.master_records category_record on category_record.id=category.master_record_id
    where category_record.master_key=v_detail->>'tCategoryKey' and category.category_level='T';
    if v_t_category_id is null then
      raise exception 'clinical_master_clinical_action_t_category_missing' using errcode='23503';
    end if;
    insert into master.clinical_actions(master_record_id,t_category_id,item_type,is_other_unclassified)
    values(v_record_id,v_t_category_id,btrim(v_detail->>'itemType'),coalesce((v_detail->>'isOtherUnclassified')::boolean,false))
    on conflict(master_record_id) do update
      set t_category_id=excluded.t_category_id,item_type=excluded.item_type,
          is_other_unclassified=excluded.is_other_unclassified;
  end loop;

  for v_record in select value from jsonb_array_elements(v_payload->'records') records(value)
    where value->>'recordType'='chart_group' loop
    select id into v_record_id from master.master_records where master_key=v_record->>'masterKey';
    v_detail := v_record->'detail';
    select group_code into v_existing_code
    from master.chart_groups where master_record_id=v_record_id;
    if v_existing_code is not null and v_existing_code is distinct from btrim(v_detail->>'groupCode') then
      raise exception 'clinical_master_chart_group_code_conflict' using errcode='23514';
    end if;
    insert into master.chart_groups(master_record_id,group_code,sort_order)
    values(v_record_id,btrim(v_detail->>'groupCode'),coalesce((v_detail->>'sortOrder')::integer,0))
    on conflict(master_record_id) do update set sort_order=excluded.sort_order;
  end loop;

  for v_record in select value from jsonb_array_elements(v_payload->'records') records(value)
    where value->>'recordType'='task_route' loop
    select id into v_record_id from master.master_records where master_key=v_record->>'masterKey';
    v_detail := v_record->'detail';
    select route_code into v_existing_code
    from master.task_routes where master_record_id=v_record_id;
    if v_existing_code is not null and v_existing_code is distinct from btrim(v_detail->>'routeCode') then
      raise exception 'clinical_master_task_route_code_conflict' using errcode='23514';
    end if;
    insert into master.task_routes(master_record_id,route_code,destination_module,task_required,runtime_status)
    values(v_record_id,btrim(v_detail->>'routeCode'),nullif(btrim(v_detail->>'destinationModule'),''),(v_detail->>'taskRequired')::boolean,nullif(btrim(v_detail->>'runtimeStatus'),''))
    on conflict(master_record_id) do update
      set destination_module=excluded.destination_module,task_required=excluded.task_required,
          runtime_status=excluded.runtime_status;
  end loop;

  delete from private.clinical_master_lab_publish_stage where release_id=v_release.id;
  insert into private.clinical_master_lab_publish_stage(
    release_id,master_record_id,master_key,record_type,included,base_content,effective_revision
  )
  select v_release.id,owner.id,owner.master_key,owner.record_type,true,
    private.clinical_master_record_content(records.value,case when records.value->>'recordType'='clinical_action' then (select action.action_code from master.clinical_actions action where action.master_record_id=owner.id) end),
    coalesce(latest.revision,1) + case
      when latest.snapshot is null then 0
      when (latest.snapshot-'revision') is distinct from private.clinical_master_record_content(records.value,case when records.value->>'recordType'='clinical_action' then (select action.action_code from master.clinical_actions action where action.master_record_id=owner.id) end) then 1
      else 0
    end
  from jsonb_array_elements(v_payload->'records') records(value)
  join master.master_records owner on owner.master_key=records.value->>'masterKey'
  left join lateral (
    select version.snapshot,version.revision
    from master.master_record_versions version
    where version.master_record_id=owner.id
    order by version.revision desc
    limit 1
  ) latest on true;
  -- The test pass is self-contained as well as the panel/order relation
  -- passes.  Resolve the vocabulary owners once from the immutable stage
  -- rows (or their latest immutable version when omitted), then carry the
  -- effective UUID/revision and typed vocabulary facts in a separate test
  -- relation object.  This is deliberately independent of the mutable
  -- current_revision columns and keeps omitted vocabulary owners pinned.
  for v_record in select value from jsonb_array_elements(v_payload->'records') records(value) where value->>'recordType'='lab_test' loop
    v_input_key := nullif(btrim(v_record->'detail'->>'resultInputTypeKey'),'');
    v_unit_key := nullif(btrim(v_record->'detail'->>'canonicalUnitKey'),'');
    select owner.id into v_input_id
    from master.master_records owner
    where owner.master_key=v_input_key and owner.record_type='result_input_type';
    if v_input_id is null then raise exception 'clinical_master_lab_test_result_input_missing' using errcode='23503'; end if;
    select stage.effective_revision, stage.base_content->'detail'
      into v_input_revision, v_vocabulary_snapshot
    from private.clinical_master_lab_publish_stage stage
    where stage.release_id=v_release.id and stage.master_record_id=v_input_id;
    if v_input_revision is null then
      select version.revision, version.snapshot->'detail'
        into v_input_revision, v_vocabulary_snapshot
      from master.master_record_versions version
      where version.master_record_id=v_input_id
      order by version.revision desc limit 1;
    end if;
    if v_input_revision is null or v_vocabulary_snapshot is null then raise exception 'clinical_master_lab_test_result_input_version_missing' using errcode='23503'; end if;
    v_input_value_kind := nullif(btrim(v_vocabulary_snapshot->>'valueKind'),'');
    v_input_supports_unit := coalesce((v_vocabulary_snapshot->>'supportsUnit')::boolean,false);
    if v_input_value_kind not in ('numeric','text','coded') then raise exception 'clinical_master_result_value_kind_invalid' using errcode='22023'; end if;
    v_unit_id := null;
    v_unit_revision := null;
    v_unit_code := null;
    if v_unit_key is not null then
      select owner.id into v_unit_id
      from master.master_records owner
      where owner.master_key=v_unit_key and owner.record_type='unit';
      if v_unit_id is null then raise exception 'clinical_master_lab_test_unit_missing' using errcode='23503'; end if;
      select stage.effective_revision, stage.base_content->'detail'
        into v_unit_revision, v_vocabulary_snapshot
      from private.clinical_master_lab_publish_stage stage
      where stage.release_id=v_release.id and stage.master_record_id=v_unit_id;
      if v_unit_revision is null then
        select version.revision, version.snapshot->'detail'
          into v_unit_revision, v_vocabulary_snapshot
        from master.master_record_versions version
        where version.master_record_id=v_unit_id
        order by version.revision desc limit 1;
      end if;
      if v_unit_revision is null or v_vocabulary_snapshot is null then raise exception 'clinical_master_lab_test_unit_version_missing' using errcode='23503'; end if;
      v_unit_code := nullif(btrim(v_vocabulary_snapshot->>'unitCode'),'');
      if not v_input_supports_unit then raise exception 'clinical_master_lab_test_unit_not_supported' using errcode='22023'; end if;
    end if;
    v_test_vocabulary := jsonb_build_object(
      'resultInputTypeKey',v_input_key,
      'resultInputTypeMasterRecordId',v_input_id,
      'resultInputTypeRevision',v_input_revision,
      'resultInputTypeValueKind',v_input_value_kind,
      'resultInputTypeSupportsUnit',v_input_supports_unit,
      'canonicalUnitKey',v_unit_key,
      'canonicalUnitMasterRecordId',v_unit_id,
      'canonicalUnitRevision',v_unit_revision,
      'canonicalUnitCode',v_unit_code
    );
    update private.clinical_master_lab_publish_stage
    set relation_content=jsonb_build_object('labTestVocabulary',v_test_vocabulary)
    where release_id=v_release.id and master_key=v_record->>'masterKey';
  end loop;
  -- Close the vocabulary -> test pass before panel relations read test pins.
  -- A same-release vocabulary change therefore advances the test owner first,
  -- even when the lab-test typed detail itself is unchanged.
  update private.clinical_master_lab_publish_stage stage
  set effective_revision=case
    when not exists(select 1 from master.master_record_versions version where version.master_record_id=stage.master_record_id) then 1
    when (select version.snapshot from master.master_record_versions version where version.master_record_id=stage.master_record_id order by version.revision desc limit 1)-'revision' is distinct from stage.base_content || stage.relation_content then
      (select version.revision from master.master_record_versions version where version.master_record_id=stage.master_record_id order by version.revision desc limit 1)+1
    else (select version.revision from master.master_record_versions version where version.master_record_id=stage.master_record_id order by version.revision desc limit 1)
  end
  where stage.release_id=v_release.id and stage.record_type in ('result_input_type','unit','specimen_type','lab_test');
  -- A relation's effective content is self-contained: every referenced
  -- record carries its UUID and immutable effective revision, including an
  -- omitted owner that remains at its existing revision.
  for v_record in select value from jsonb_array_elements(v_payload->'records') records(value) where value->>'recordType'='lab_panel' loop
    v_relation := '[]'::jsonb;
    for v_rel in select value from jsonb_array_elements(coalesce(v_payload->'labPanelItems','[]'::jsonb)) items(value) where value->>'panelMasterKey'=v_record->>'masterKey' order by (value->>'sortOrder')::integer,value->>'testMasterKey' loop
      select owner.id,coalesce(stage.effective_revision,latest.revision)
        into v_target_id,v_target_revision
      from master.master_records owner
      left join private.clinical_master_lab_publish_stage stage on stage.release_id=v_release.id and stage.master_record_id=owner.id
      left join lateral (
        select version.revision
        from master.master_record_versions version
        where version.master_record_id=owner.id
        order by version.revision desc
        limit 1
      ) latest on true
      where owner.master_key=v_rel->>'testMasterKey' and owner.record_type='lab_test';
      if v_target_id is null or v_target_revision is null then raise exception 'clinical_master_lab_panel_test_version_missing' using errcode='23503'; end if;
      v_relation := v_relation || jsonb_build_array(v_rel || jsonb_build_object('testMasterRecordId',v_target_id,'testMasterRevision',v_target_revision));
    end loop;
    update private.clinical_master_lab_publish_stage set relation_content=jsonb_build_object('labPanelItems',v_relation) where release_id=v_release.id and master_key=v_record->>'masterKey';
  end loop;
  -- Close the test -> panel pass before order profiles read panel pins.
  update private.clinical_master_lab_publish_stage stage
  set effective_revision=case
    when not exists(select 1 from master.master_record_versions version where version.master_record_id=stage.master_record_id) then 1
    when (select version.snapshot from master.master_record_versions version where version.master_record_id=stage.master_record_id order by version.revision desc limit 1)-'revision' is distinct from stage.base_content || stage.relation_content then
      (select version.revision from master.master_record_versions version where version.master_record_id=stage.master_record_id order by version.revision desc limit 1)+1
    else (select version.revision from master.master_record_versions version where version.master_record_id=stage.master_record_id order by version.revision desc limit 1)
  end
  where stage.release_id=v_release.id and stage.record_type='lab_panel';
  for v_record in select value from jsonb_array_elements(v_payload->'records') records(value) where value->>'recordType'='order' loop
    v_relation := '[]'::jsonb;
    for v_rel in select value from jsonb_array_elements(coalesce(v_payload->'labOrderProfiles','[]'::jsonb)) profiles(value) where value->>'orderMasterKey'=v_record->>'masterKey' loop
      v_target_id := null; v_target_revision := null;
      if nullif(btrim(v_rel->>'labTestMasterKey'),'') is not null then
        select owner.id,coalesce(stage.effective_revision,latest.revision) into v_target_id,v_target_revision
        from master.master_records owner
        left join private.clinical_master_lab_publish_stage stage on stage.release_id=v_release.id and stage.master_record_id=owner.id
        left join lateral (
          select version.revision
          from master.master_record_versions version
          where version.master_record_id=owner.id
          order by version.revision desc
          limit 1
        ) latest on true
        where owner.master_key=v_rel->>'labTestMasterKey' and owner.record_type='lab_test';
        if v_target_id is null or v_target_revision is null then raise exception 'clinical_master_lab_order_profile_reference_version_missing' using errcode='23503'; end if;
        v_relation := v_relation || jsonb_build_array(v_rel || jsonb_build_object('labTestMasterRecordId',v_target_id,'labTestMasterRevision',v_target_revision));
      else
        select owner.id,coalesce(stage.effective_revision,latest.revision) into v_target_id,v_target_revision
        from master.master_records owner
        left join private.clinical_master_lab_publish_stage stage on stage.release_id=v_release.id and stage.master_record_id=owner.id
        left join lateral (
          select version.revision
          from master.master_record_versions version
          where version.master_record_id=owner.id
          order by version.revision desc
          limit 1
        ) latest on true
        where owner.master_key=v_rel->>'labPanelMasterKey' and owner.record_type='lab_panel';
        if v_target_id is null or v_target_revision is null then raise exception 'clinical_master_lab_order_profile_reference_version_missing' using errcode='23503'; end if;
        v_relation := v_relation || jsonb_build_array(v_rel || jsonb_build_object('labPanelMasterRecordId',v_target_id,'labPanelMasterRevision',v_target_revision));
      end if;
      if nullif(btrim(v_rel->>'specimenMasterKey'),'') is not null then
        select owner.id,coalesce(stage.effective_revision,latest.revision)
          into v_target_id,v_target_revision
        from master.master_records owner
        left join private.clinical_master_lab_publish_stage stage
          on stage.release_id=v_release.id and stage.master_record_id=owner.id
        left join lateral (
          select version.revision
          from master.master_record_versions version
          where version.master_record_id=owner.id
          order by version.revision desc
          limit 1
        ) latest on true
        where owner.master_key=v_rel->>'specimenMasterKey' and owner.record_type='specimen_type';
        if v_target_id is null or v_target_revision is null then raise exception 'clinical_master_lab_order_profile_reference_version_missing' using errcode='23503'; end if;
        v_relation := jsonb_set(
          v_relation,
          array[(jsonb_array_length(v_relation)-1)::text],
          (v_relation->-1) || jsonb_build_object('specimenMasterRecordId',v_target_id,'specimenMasterRevision',v_target_revision)
        );
      end if;
    end loop;
    update private.clinical_master_lab_publish_stage set relation_content=jsonb_build_object('labOrderProfiles',v_relation) where release_id=v_release.id and master_key=v_record->>'masterKey';
  end loop;
  update private.clinical_master_lab_publish_stage stage
  set effective_revision=case
    when not exists(select 1 from master.master_record_versions version where version.master_record_id=stage.master_record_id) then 1
    when (
      (select version.snapshot from master.master_record_versions version where version.master_record_id=stage.master_record_id order by version.revision desc limit 1)-'revision'
    ) is distinct from stage.base_content || stage.relation_content then
      (select version.revision from master.master_record_versions version where version.master_record_id=stage.master_record_id order by version.revision desc limit 1)+1
    else (select version.revision from master.master_record_versions version where version.master_record_id=stage.master_record_id order by version.revision desc limit 1)
  end
  where stage.release_id=v_release.id;
  -- Order profiles pin the panel/test effective revision computed by the
  -- preceding owner stages.  Refresh those embedded pins before the final
  -- owner pass so a panel-only relation revision is visible to its order
  -- profile without advancing the referenced test owners.
  for v_record in select value from jsonb_array_elements(v_payload->'records') records(value) where value->>'recordType'='order' loop
    v_relation := '[]'::jsonb;
    for v_rel in select value from jsonb_array_elements(coalesce((select stage.relation_content->'labOrderProfiles' from private.clinical_master_lab_publish_stage stage where stage.release_id=v_release.id and stage.master_key=v_record->>'masterKey'),'[]'::jsonb)) profiles(value) loop
      if nullif(v_rel->>'labPanelMasterRecordId','') is not null then
        select stage.effective_revision into v_target_revision from private.clinical_master_lab_publish_stage stage where stage.release_id=v_release.id and stage.master_record_id=(v_rel->>'labPanelMasterRecordId')::uuid;
        v_rel := v_rel || jsonb_build_object('labPanelMasterRevision',v_target_revision);
      elsif nullif(v_rel->>'labTestMasterRecordId','') is not null then
        select stage.effective_revision into v_target_revision from private.clinical_master_lab_publish_stage stage where stage.release_id=v_release.id and stage.master_record_id=(v_rel->>'labTestMasterRecordId')::uuid;
        v_rel := v_rel || jsonb_build_object('labTestMasterRevision',v_target_revision);
      end if;
      v_relation := v_relation || jsonb_build_array(v_rel);
    end loop;
    update private.clinical_master_lab_publish_stage set relation_content=jsonb_build_object('labOrderProfiles',v_relation) where release_id=v_release.id and master_key=v_record->>'masterKey';
  end loop;
  update private.clinical_master_lab_publish_stage stage
  set effective_revision=case
    when not exists(select 1 from master.master_record_versions version where version.master_record_id=stage.master_record_id) then 1
    when (select version.snapshot from master.master_record_versions version where version.master_record_id=stage.master_record_id order by version.revision desc limit 1)-'revision' is distinct from stage.base_content || stage.relation_content then
      (select version.revision from master.master_record_versions version where version.master_record_id=stage.master_record_id order by version.revision desc limit 1)+1
    else (select version.revision from master.master_record_versions version where version.master_record_id=stage.master_record_id order by version.revision desc limit 1)
  end
  where stage.release_id=v_release.id and stage.record_type='order';

  -- Materialize the same effective pass into the four contract-named stage
  -- tables.  The publisher body above keeps its compact compatibility stage,
  -- but these rows are the durable, independently queryable evidence used by
  -- adoption/review diagnostics and make omitted dependency pins explicit.
  delete from private.clinical_master_lab_vocabulary_publish_stage where release_id=v_release.id;
  delete from private.clinical_master_lab_test_publish_stage where release_id=v_release.id;
  delete from private.clinical_master_lab_panel_publish_stage where release_id=v_release.id;
  delete from private.clinical_master_lab_order_publish_stage where release_id=v_release.id;
  insert into private.clinical_master_lab_vocabulary_publish_stage(
    release_id,owner_record_id,master_key,record_type,included,base_content,effective_revision,
    value_kind,supports_unit,canonical_code,content_sha256
  )
  select stage.release_id,stage.master_record_id,stage.master_key,stage.record_type,stage.included,
    stage.base_content,stage.effective_revision,
    case when stage.record_type='result_input_type' then stage.base_content->'detail'->>'valueKind' end,
    case when stage.record_type='result_input_type' then coalesce((stage.base_content->'detail'->>'supportsUnit')::boolean,false) end,
    case stage.record_type
      when 'result_input_type' then stage.base_content->'detail'->>'inputCode'
      when 'unit' then stage.base_content->'detail'->>'unitCode'
      when 'specimen_type' then stage.base_content->'detail'->>'specimenCode'
    end,
    private.clinical_master_sha256(stage.base_content)
  from private.clinical_master_lab_publish_stage stage
  where stage.release_id=v_release.id and stage.record_type in ('result_input_type','unit','specimen_type');
  -- Omitted vocabulary owners are pinned to the immutable latest version,
  -- never synthesized from a mutable typed row or current_revision.
  insert into private.clinical_master_lab_vocabulary_publish_stage(
    release_id,owner_record_id,master_key,record_type,included,base_content,effective_revision,
    value_kind,supports_unit,canonical_code,content_sha256
  )
  with dependencies as (
    select distinct pg_catalog.btrim(value->'detail'->>'resultInputTypeKey') as master_key,'result_input_type'::text as record_type
    from pg_catalog.jsonb_array_elements(v_payload->'records') records(value)
    where value->>'recordType'='lab_test'
    union
    select distinct nullif(pg_catalog.btrim(value->'detail'->>'canonicalUnitKey'),'') as master_key,'unit'::text
    from pg_catalog.jsonb_array_elements(v_payload->'records') records(value)
    where value->>'recordType'='lab_test' and nullif(pg_catalog.btrim(value->'detail'->>'canonicalUnitKey'),'') is not null
    union
    select distinct nullif(pg_catalog.btrim(value->>'specimenMasterKey'),'') as master_key,'specimen_type'::text
    from pg_catalog.jsonb_array_elements(coalesce(v_payload->'labOrderProfiles','[]'::jsonb)) profiles(value)
    where nullif(pg_catalog.btrim(value->>'specimenMasterKey'),'') is not null
  ), resolved as (
    select owner.id,owner.master_key,owner.record_type,
      coalesce(stage.included,false) as included,
      coalesce(stage.base_content,latest.snapshot-'revision') as base_content,
      coalesce(stage.effective_revision,latest.revision) as effective_revision
    from dependencies dependency
    join master.master_records owner on owner.master_key=dependency.master_key and owner.record_type=dependency.record_type
    left join private.clinical_master_lab_publish_stage stage on stage.release_id=v_release.id and stage.master_record_id=owner.id
    left join lateral (
      select version.snapshot,version.revision
      from master.master_record_versions version
      where version.master_record_id=owner.id
      order by version.revision desc limit 1
    ) latest on true
  )
  select v_release.id,resolved.id,resolved.master_key,resolved.record_type,resolved.included,
    resolved.base_content,resolved.effective_revision,
    case when resolved.record_type='result_input_type' then resolved.base_content->'detail'->>'valueKind' end,
    case when resolved.record_type='result_input_type' then coalesce((resolved.base_content->'detail'->>'supportsUnit')::boolean,false) end,
    case resolved.record_type
      when 'result_input_type' then resolved.base_content->'detail'->>'inputCode'
      when 'unit' then resolved.base_content->'detail'->>'unitCode'
      when 'specimen_type' then resolved.base_content->'detail'->>'specimenCode'
    end,
    private.clinical_master_sha256(resolved.base_content)
  from resolved
  where not exists (
    select 1 from private.clinical_master_lab_vocabulary_publish_stage existing
    where existing.release_id=v_release.id and existing.owner_record_id=resolved.id
  ) and resolved.effective_revision is not null;
  insert into private.clinical_master_lab_test_publish_stage(
    release_id,owner_record_id,master_key,included,base_content,relation_content,effective_revision,
    result_input_type_master_record_id,result_input_type_revision,result_input_type_key,
    result_input_type_value_kind,result_input_type_supports_unit,canonical_unit_master_record_id,
    canonical_unit_revision,canonical_unit_key,canonical_unit_code,decimal_scale,content_sha256
  )
  select stage.release_id,stage.master_record_id,stage.master_key,stage.included,stage.base_content,
    stage.relation_content,stage.effective_revision,
    (stage.relation_content->'labTestVocabulary'->>'resultInputTypeMasterRecordId')::uuid,
    (stage.relation_content->'labTestVocabulary'->>'resultInputTypeRevision')::integer,
    stage.relation_content->'labTestVocabulary'->>'resultInputTypeKey',
    stage.relation_content->'labTestVocabulary'->>'resultInputTypeValueKind',
    (stage.relation_content->'labTestVocabulary'->>'resultInputTypeSupportsUnit')::boolean,
    nullif(stage.relation_content->'labTestVocabulary'->>'canonicalUnitMasterRecordId','')::uuid,
    nullif(stage.relation_content->'labTestVocabulary'->>'canonicalUnitRevision','')::integer,
    nullif(stage.relation_content->'labTestVocabulary'->>'canonicalUnitKey',''),
    nullif(stage.relation_content->'labTestVocabulary'->>'canonicalUnitCode',''),
    nullif(stage.base_content->'detail'->>'decimalScale','')::integer,
    private.clinical_master_sha256(stage.base_content || stage.relation_content)
  from private.clinical_master_lab_publish_stage stage
  where stage.release_id=v_release.id and stage.record_type='lab_test';
  insert into private.clinical_master_lab_panel_publish_stage(
    release_id,owner_record_id,master_key,included,base_content,relation_content,effective_revision,content_sha256
  )
  select stage.release_id,stage.master_record_id,stage.master_key,stage.included,stage.base_content,
    stage.relation_content,stage.effective_revision,private.clinical_master_sha256(stage.base_content || stage.relation_content)
  from private.clinical_master_lab_publish_stage stage
  where stage.release_id=v_release.id and stage.record_type='lab_panel';
  insert into private.clinical_master_lab_order_publish_stage(
    release_id,owner_record_id,master_key,included,base_content,relation_content,effective_revision,
    specimen_master_record_id,specimen_revision,content_sha256
  )
  select stage.release_id,stage.master_record_id,stage.master_key,stage.included,stage.base_content,
    stage.relation_content,stage.effective_revision,
    nullif((select value->>'specimenMasterRecordId' from pg_catalog.jsonb_array_elements(coalesce(stage.relation_content->'labOrderProfiles','[]'::jsonb)) profiles(value) limit 1),'')::uuid,
    nullif((select value->>'specimenMasterRevision' from pg_catalog.jsonb_array_elements(coalesce(stage.relation_content->'labOrderProfiles','[]'::jsonb)) profiles(value) limit 1),'')::integer,
    private.clinical_master_sha256(stage.base_content || stage.relation_content)
  from private.clinical_master_lab_publish_stage stage
  where stage.release_id=v_release.id and stage.record_type='order';

  -- Resolve identity/revision once for every owner.  Relation declarations are
  -- folded into the owning snapshot so a relation-only change advances that
  -- owner exactly once and cannot cascade to an omitted owner.
  for v_record in select value from jsonb_array_elements(v_payload->'records') records(value) loop
    v_master_key := btrim(v_record->>'masterKey');
    v_record_type := btrim(v_record->>'recordType');
    select id,current_revision into v_record_id,v_revision from master.master_records where master_key = v_master_key for update;
    v_record_found := found;
    select action_code into v_action_code from master.clinical_actions where master_record_id=v_record_id;
    v_incoming_content := private.clinical_master_record_content(v_record,v_action_code);
    if v_record_type in ('lab_test','lab_panel','order') then v_incoming_content := v_incoming_content || private.clinical_master_lab_relation_content(v_payload,v_master_key,v_record_type); end if;
    if v_record_found then
      if (select record_type from master.master_records where id = v_record_id) is distinct from v_record_type then raise exception 'clinical_master_record_type_change_forbidden' using errcode = '23514'; end if;
      select snapshot,revision into v_existing_snapshot,v_latest_revision from master.master_record_versions where master_record_id = v_record_id order by revision desc limit 1;
      if v_existing_snapshot is not null and (v_existing_snapshot - 'revision') is distinct from v_incoming_content then
        update master.master_records set current_revision = v_latest_revision + 1, current_release_id = v_release.id, updated_at = now() where id = v_record_id;
      end if;
    else
      v_record_id := extensions.gen_random_uuid();
      insert into master.master_records (id,master_key,record_type,lifecycle_status,safety_status,safety_reason,current_revision,current_release_id,published_at)
      values (v_record_id,v_master_key,v_record_type,'published','normal',null,1,v_release.id,now());
    end if;
  end loop;

  -- Vocabulary and typed rows.
  for v_record in select value from jsonb_array_elements(v_payload->'records') records(value) where value->>'recordType' = 'species' loop
    select id into v_record_id from master.master_records where master_key = v_record->>'masterKey'; v_detail := v_record->'detail';
    insert into master.species(master_record_id,species_code) values(v_record_id,btrim(v_detail->>'speciesCode')) on conflict(master_record_id) do update set species_code=excluded.species_code;
  end loop;
  for v_record in select value from jsonb_array_elements(v_payload->'records') records(value) where value->>'recordType' = 'unit' loop
    select id into v_record_id from master.master_records where master_key = v_record->>'masterKey'; v_detail := v_record->'detail';
    insert into master.units(master_record_id,unit_code,symbol,decimal_scale) values(v_record_id,btrim(v_detail->>'unitCode'),btrim(v_detail->>'symbol'),coalesce((v_detail->>'decimalScale')::integer,0)) on conflict(master_record_id) do update set unit_code=excluded.unit_code,symbol=excluded.symbol,decimal_scale=excluded.decimal_scale;
  end loop;
  for v_record in select value from jsonb_array_elements(v_payload->'records') records(value) where value->>'recordType' = 'specimen_type' loop
    select id into v_record_id from master.master_records where master_key = v_record->>'masterKey'; v_detail := v_record->'detail';
    insert into master.specimen_types(master_record_id,specimen_code) values(v_record_id,btrim(v_detail->>'specimenCode')) on conflict(master_record_id) do update set specimen_code=excluded.specimen_code;
  end loop;
  for v_record in select value from jsonb_array_elements(v_payload->'records') records(value) where value->>'recordType' = 'result_input_type' loop
    select id into v_record_id from master.master_records where master_key = v_record->>'masterKey'; v_detail := v_record->'detail';
    if v_detail->>'valueKind' not in ('numeric','text','coded') then raise exception 'clinical_master_result_value_kind_invalid' using errcode='22023'; end if;
    insert into master.result_input_types(master_record_id,input_code,value_kind,supports_unit) values(v_record_id,btrim(v_detail->>'inputCode'),btrim(v_detail->>'valueKind'),coalesce((v_detail->>'supportsUnit')::boolean,false)) on conflict(master_record_id) do update set input_code=excluded.input_code,value_kind=excluded.value_kind,supports_unit=excluded.supports_unit;
  end loop;
  for v_record in select value from jsonb_array_elements(v_payload->'records') records(value) where value->>'recordType' = 'lab_test' loop
    select id into v_record_id from master.master_records where master_key = v_record->>'masterKey'; v_detail := v_record->'detail';
    select id into v_input_id from master.master_records where master_key = v_detail->>'resultInputTypeKey' and record_type='result_input_type';
    if v_input_id is null then raise exception 'clinical_master_lab_test_result_input_missing' using errcode='23503'; end if;
    select id into v_unit_id from master.master_records where master_key = v_detail->>'canonicalUnitKey' and record_type='unit';
    if nullif(btrim(v_detail->>'canonicalUnitKey'),'') is not null and v_unit_id is null then raise exception 'clinical_master_lab_test_unit_missing' using errcode='23503'; end if;
    if exists(select 1 from master.result_input_types where master_record_id=v_input_id and not supports_unit and v_unit_id is not null) then raise exception 'clinical_master_lab_test_unit_not_supported' using errcode='22023'; end if;
    insert into master.lab_tests(master_record_id,test_code,result_input_type_id,canonical_unit_id,decimal_scale)
    values(v_record_id,btrim(v_detail->>'testCode'),v_input_id,v_unit_id,(v_detail->>'decimalScale')::integer)
    on conflict(master_record_id) do update set test_code=excluded.test_code,result_input_type_id=excluded.result_input_type_id,canonical_unit_id=excluded.canonical_unit_id,decimal_scale=excluded.decimal_scale;
  end loop;
  for v_record in select value from jsonb_array_elements(v_payload->'records') records(value) where value->>'recordType' = 'lab_panel' loop
    select id into v_record_id from master.master_records where master_key = v_record->>'masterKey';
    insert into master.lab_panels(master_record_id,panel_code) values(v_record_id,btrim(v_record->'detail'->>'panelCode')) on conflict(master_record_id) do update set panel_code=excluded.panel_code;
  end loop;

  -- Paths must exist before the order/profile pass resolves the lab action.
  for v_path in select value from jsonb_array_elements(coalesce(v_payload->'classificationPaths','[]'::jsonb)) paths(value) loop
    select action.master_record_id into v_action_id from master.clinical_actions action join master.master_records r on r.id=action.master_record_id where r.master_key=v_path->>'clinicalActionKey';
    select chart.master_record_id into v_chart_id from master.chart_groups chart join master.master_records r on r.id=chart.master_record_id where r.master_key=v_path->>'chartGroupKey';
    select route.master_record_id into v_route_id from master.task_routes route join master.master_records r on r.id=route.master_record_id where r.master_key=v_path->>'taskRouteKey';
    if v_action_id is null or v_chart_id is null or v_route_id is null then raise exception 'clinical_master_classification_path_reference_missing' using errcode='23503'; end if;
    if not exists(select 1 from master.classification_paths where path_key=v_path->>'pathKey') then
      update master.classification_paths set retired_in_release_id=v_release.id where clinical_action_id=v_action_id and retired_in_release_id is null;
      insert into master.classification_paths(path_key,clinical_action_id,chart_group_id,task_route_id,active_from_release_id) values(v_path->>'pathKey',v_action_id,v_chart_id,v_route_id,v_release.id);
    end if;
  end loop;

  -- Existing A1 typed order/path handling is retained for all order rows.
  for v_record in select value from jsonb_array_elements(v_payload->'records') records(value) where value->>'recordType' = 'order' loop
    select id into v_order_id from master.master_records where master_key = v_record->>'masterKey'; v_detail := v_record->'detail';
    select id into v_path_id from master.classification_paths where path_key=v_detail->>'classificationPathKey' and retired_in_release_id is null;
    if v_path_id is null then raise exception 'clinical_master_order_classification_path_required' using errcode='23503'; end if;
    v_unit_id := null;
    if nullif(btrim(v_detail->>'defaultSalesUnitCode'),'') is not null then select master_record_id into v_unit_id from master.units where unit_code=btrim(v_detail->>'defaultSalesUnitCode'); if v_unit_id is null then raise exception 'clinical_master_order_sales_unit_missing' using errcode='23503'; end if; end if;
    insert into master.orders(master_record_id,classification_path_id,default_sales_unit_id,default_billing_reflection_enabled,default_quantity)
    values(v_order_id,v_path_id,v_unit_id,coalesce((v_detail->>'defaultBillingReflectionEnabled')::boolean,true),coalesce((v_detail->>'defaultQuantity')::numeric,1))
    on conflict(master_record_id) do update set classification_path_id=excluded.classification_path_id,default_sales_unit_id=excluded.default_sales_unit_id,default_billing_reflection_enabled=excluded.default_billing_reflection_enabled,default_quantity=excluded.default_quantity;
    delete from master.order_species_links where order_record_id=v_order_id;
    for v_species_id in select master_record_id from master.species where species_code in(select value#>>'{}' from jsonb_array_elements(v_detail->'species') species(value)) loop insert into master.order_species_links(order_record_id,species_record_id) values(v_order_id,v_species_id); end loop;
    if (select count(*) from master.order_species_links where order_record_id=v_order_id) <> jsonb_array_length(v_detail->'species') then raise exception 'clinical_master_order_species_reference_missing' using errcode='23503'; end if;
  end loop;

  -- Full-set panel relation replacement, with deterministic duplicate/order
  -- checks and no implicit owner cascade.
  for v_record in select value from jsonb_array_elements(v_payload->'records') records(value) where value->>'recordType'='lab_panel' loop
    v_master_key := v_record->>'masterKey'; select id into v_panel_id from master.master_records where master_key=v_master_key;
    if not exists(select 1 from jsonb_array_elements(v_payload->'labPanelItems') items(value) where value->>'panelMasterKey'=v_master_key) then raise exception 'clinical_master_lab_panel_items_required' using errcode='22023'; end if;
    if exists(select 1 from jsonb_array_elements(v_payload->'labPanelItems') items(value) where value->>'panelMasterKey'=v_master_key group by value->>'testMasterKey' having count(*)>1) then raise exception 'clinical_master_lab_panel_item_duplicate' using errcode='22023'; end if;
    if exists(select 1 from jsonb_array_elements(v_payload->'labPanelItems') items(value) where value->>'panelMasterKey'=v_master_key group by (value->>'sortOrder')::integer having count(*)>1) then raise exception 'clinical_master_lab_panel_sort_duplicate' using errcode='22023'; end if;
    delete from master.lab_panel_items where lab_panel_id=v_panel_id;
    for v_rel in select value from jsonb_array_elements(v_payload->'labPanelItems') items(value) where value->>'panelMasterKey'=v_master_key order by (value->>'sortOrder')::integer,value->>'testMasterKey' loop
      select id into v_test_id from master.master_records where master_key=v_rel->>'testMasterKey' and record_type='lab_test';
      if v_test_id is null then raise exception 'clinical_master_lab_panel_test_missing' using errcode='23503'; end if;
      insert into master.lab_panel_items(lab_panel_id,lab_test_id,sort_order,required,display_group) values(v_panel_id,v_test_id,(v_rel->>'sortOrder')::integer,coalesce((v_rel->>'required')::boolean,true),nullif(btrim(v_rel->>'displayGroup'),''));
    end loop;
  end loop;

  for v_record in select value from jsonb_array_elements(v_payload->'records') records(value) where value->>'recordType'='order' loop
    v_master_key := v_record->>'masterKey';
    if exists(select 1 from master.classification_paths path join master.task_routes route on route.master_record_id=path.task_route_id where path.id=(select classification_path_id from master.orders where master_record_id=(select id from master.master_records where master_key=v_master_key)) and route.route_code='NT_LAB') then
      if (select count(*) from jsonb_array_elements(v_payload->'labOrderProfiles') profiles(value) where value->>'orderMasterKey'=v_master_key) <> 1 then raise exception 'clinical_master_lab_order_profile_exactly_one' using errcode='22023'; end if;
      select id into v_order_id from master.master_records where master_key=v_master_key;
      select nullif(btrim(value->>'labTestMasterKey'),''),nullif(btrim(value->>'labPanelMasterKey'),''),nullif(btrim(value->>'specimenMasterKey'),'') into v_profile_test_key,v_profile_panel_key,v_profile_specimen_key from jsonb_array_elements(v_payload->'labOrderProfiles') profiles(value) where value->>'orderMasterKey'=v_record->>'masterKey';
      if (v_profile_test_key is null) = (v_profile_panel_key is null) then raise exception 'clinical_master_lab_order_profile_target_exactly_one' using errcode='22023'; end if;
      v_test_id := null; v_panel_id := null; v_specimen_id := null;
      if v_profile_test_key is not null then select id into v_test_id from master.master_records where master_key=v_profile_test_key and record_type='lab_test'; else select id into v_panel_id from master.master_records where master_key=v_profile_panel_key and record_type='lab_panel'; end if;
      if v_profile_specimen_key is not null then select id into v_specimen_id from master.master_records where master_key=v_profile_specimen_key and record_type='specimen_type'; end if;
      if (v_profile_test_key is not null and v_test_id is null) or (v_profile_panel_key is not null and v_panel_id is null) or (v_profile_specimen_key is not null and v_specimen_id is null) then raise exception 'clinical_master_lab_order_profile_reference_missing' using errcode='23503'; end if;
      insert into master.lab_order_profiles(order_record_id,lab_test_id,lab_panel_id,specimen_type_id) values(v_order_id,v_test_id,v_panel_id,v_specimen_id) on conflict(order_record_id) do update set lab_test_id=excluded.lab_test_id,lab_panel_id=excluded.lab_panel_id,specimen_type_id=excluded.specimen_type_id;
    end if;
  end loop;

  -- Classification paths are the same A1 identity boundary.
  for v_path in select value from jsonb_array_elements(coalesce(v_payload->'classificationPaths','[]'::jsonb)) paths(value) loop
    select action.master_record_id into v_action_id from master.clinical_actions action join master.master_records r on r.id=action.master_record_id where r.master_key=v_path->>'clinicalActionKey';
    select chart.master_record_id into v_chart_id from master.chart_groups chart join master.master_records r on r.id=chart.master_record_id where r.master_key=v_path->>'chartGroupKey';
    select route.master_record_id into v_route_id from master.task_routes route join master.master_records r on r.id=route.master_record_id where r.master_key=v_path->>'taskRouteKey';
    if v_action_id is null or v_chart_id is null or v_route_id is null then raise exception 'clinical_master_classification_path_reference_missing' using errcode='23503'; end if;
    select id into v_path_id from master.classification_paths where path_key=v_path->>'pathKey' for update;
    if v_path_id is null then update master.classification_paths set retired_in_release_id=v_release.id where clinical_action_id=v_action_id and retired_in_release_id is null; insert into master.classification_paths(path_key,clinical_action_id,chart_group_id,task_route_id,active_from_release_id) values(v_path->>'pathKey',v_action_id,v_chart_id,v_route_id,v_release.id); end if;
  end loop;

  -- Names, provenance, immutable version rows, and publication events.
  for v_record in select value from jsonb_array_elements(v_payload->'records') records(value) loop
    v_master_key := v_record->>'masterKey'; select id,current_revision into v_record_id,v_revision from master.master_records where master_key=v_master_key;
    select action_code into v_action_code from master.clinical_actions where master_record_id=v_record_id;
    v_incoming_content := private.clinical_master_record_content(v_record,v_action_code) || private.clinical_master_lab_relation_content(v_payload,v_master_key,v_record->>'recordType');
    select snapshot,revision into v_existing_snapshot,v_latest_revision from master.master_record_versions where master_record_id=v_record_id order by revision desc limit 1;
    if v_existing_snapshot is not null and (v_existing_snapshot-'revision') is not distinct from v_incoming_content then continue; end if;
    delete from master.master_record_names where master_record_id=v_record_id;
    for v_names in select value from jsonb_array_elements(v_record->'names') names(value) loop
      insert into master.master_record_names(master_record_id,language_code,name_kind,name,normalized_name,searchable,sort_order) values(v_record_id,v_names->>'languageCode',v_names->>'nameKind',v_names->>'name',lower(regexp_replace(btrim(v_names->>'name'),'[[:space:]]+',' ','g')),coalesce((v_names->>'searchable')::boolean,true),coalesce((v_names->>'sortOrder')::integer,0));
    end loop;
    v_source := v_record->'source';
    insert into master.master_sources(source_type,title,reference_uri,source_version,accessed_at,license_notes) values(v_source->>'sourceType',v_source->>'title',v_source->>'referenceUri',v_source->>'sourceVersion',nullif(v_source->>'accessedAt','')::timestamptz,v_source->>'licenseNotes') returning id into v_unit_id;
    insert into master.master_record_sources(master_record_id,source_id,assertion_scope,notes) values(v_record_id,v_unit_id,'record','Validated Phase 1B-1 synthetic publisher source.');
    v_snapshot := jsonb_set(v_incoming_content,'{revision}',to_jsonb(v_revision),true);
    insert into master.master_record_versions(master_record_id,revision,release_id,snapshot,change_summary,authored_by_label,reviewed_by_label) values(v_record_id,v_revision,v_release.id,v_snapshot,'Phase 1B-1 validated synthetic publish.',v_payload->>'publishedByLabel',v_payload->>'publishedByLabel');
    insert into master.master_review_events(master_record_id,revision,event_type,actor_user_id,actor_label,source_surface) values(v_record_id,v_revision,'validated',p_actor_user_id,v_payload->>'publishedByLabel','publisher'),(v_record_id,v_revision,'published',p_actor_user_id,v_payload->>'publishedByLabel','publisher');
  end loop;
  update master.master_releases set status='published',published_at=now() where id=v_release.id;
  return jsonb_build_object('releaseId',v_release.id,'releaseNo',v_release.release_no,'sourceFingerprint',v_fingerprint,'idempotent',false,'recordCount',v_release.record_count);
end
$$;

revoke all on function private.publish_clinical_master_release(jsonb,uuid) from public, anon, authenticated, service_role;
