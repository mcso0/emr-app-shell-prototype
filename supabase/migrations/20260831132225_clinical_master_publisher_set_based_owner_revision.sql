-- CLINICAL-MASTER-PR-022 set-based cumulative publisher hardening.
--
-- The previous candidate still decomposed the exact 689-owner payload a second
-- time after the release-scoped stage had already materialized the final owner
-- content and effective revision. Replace that row-wise owner pass with one
-- release-scoped stage update, and make each staged revision refresh read the
-- latest immutable version once per target owner instead of repeating three
-- correlated lookups.
--
-- This migration patches the installed cumulative function additively. It does
-- not change the public publisher signature, advisory lock, transaction scope,
-- release fingerprint, manifest, projection triggers, owner, function config,
-- or ACL boundary.

set lock_timeout = '5s';
set statement_timeout = '120s';

do $patch_cumulative_set_based_owner_revision$
declare
  v_definition text;
  v_old_count integer;
  v_new_count integer;
  v_patch_index integer;
  v_changed boolean := false;
  v_owner oid;
  v_security_definer boolean;
  v_config text[];
  v_acl aclitem[];
  v_volatility "char";
  v_parallel "char";
  v_old text[] := array[
$old_vocabulary_revision$
  update private.clinical_master_lab_publish_stage stage
  set effective_revision=case
    when not exists(select 1 from master.master_record_versions version where version.master_record_id=stage.master_record_id) then 1
    when (select version.snapshot from master.master_record_versions version where version.master_record_id=stage.master_record_id order by version.revision desc limit 1)-'revision' is distinct from stage.base_content || stage.relation_content then
      (select version.revision from master.master_record_versions version where version.master_record_id=stage.master_record_id order by version.revision desc limit 1)+1
    else (select version.revision from master.master_record_versions version where version.master_record_id=stage.master_record_id order by version.revision desc limit 1)
  end
  where stage.release_id=v_release.id and stage.record_type in ('result_input_type','unit','specimen_type','lab_test');
$old_vocabulary_revision$,
$old_panel_revision$
  update private.clinical_master_lab_publish_stage stage
  set effective_revision=case
    when not exists(select 1 from master.master_record_versions version where version.master_record_id=stage.master_record_id) then 1
    when (select version.snapshot from master.master_record_versions version where version.master_record_id=stage.master_record_id order by version.revision desc limit 1)-'revision' is distinct from stage.base_content || stage.relation_content then
      (select version.revision from master.master_record_versions version where version.master_record_id=stage.master_record_id order by version.revision desc limit 1)+1
    else (select version.revision from master.master_record_versions version where version.master_record_id=stage.master_record_id order by version.revision desc limit 1)
  end
  where stage.release_id=v_release.id and stage.record_type='lab_panel';
$old_panel_revision$,
$old_all_revision$
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
$old_all_revision$,
$old_order_revision$
  update private.clinical_master_lab_publish_stage stage
  set effective_revision=case
    when not exists(select 1 from master.master_record_versions version where version.master_record_id=stage.master_record_id) then 1
    when (select version.snapshot from master.master_record_versions version where version.master_record_id=stage.master_record_id order by version.revision desc limit 1)-'revision' is distinct from stage.base_content || stage.relation_content then
      (select version.revision from master.master_record_versions version where version.master_record_id=stage.master_record_id order by version.revision desc limit 1)+1
    else (select version.revision from master.master_record_versions version where version.master_record_id=stage.master_record_id order by version.revision desc limit 1)
  end
  where stage.release_id=v_release.id and stage.record_type='order';
$old_order_revision$,
$old_owner_revision$
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
$old_owner_revision$
  ];
  v_new text[] := array[
$new_vocabulary_revision$
  with target_stage as (
    select stage.master_record_id,stage.base_content,stage.relation_content
    from private.clinical_master_lab_publish_stage stage
    where stage.release_id=v_release.id
      and stage.record_type in ('result_input_type','unit','specimen_type','lab_test')
  ), latest_versions as (
    select distinct on (version.master_record_id)
      version.master_record_id,version.snapshot,version.revision
    from master.master_record_versions version
    join target_stage target on target.master_record_id=version.master_record_id
    order by version.master_record_id,version.revision desc
  )
  update private.clinical_master_lab_publish_stage stage
  set effective_revision=case
    when latest.revision is null then 1
    when (latest.snapshot-'revision') is distinct from target.base_content || target.relation_content then latest.revision+1
    else latest.revision
  end
  from target_stage target
  left join latest_versions latest on latest.master_record_id=target.master_record_id
  where stage.release_id=v_release.id and stage.master_record_id=target.master_record_id;
$new_vocabulary_revision$,
$new_panel_revision$
  with target_stage as (
    select stage.master_record_id,stage.base_content,stage.relation_content
    from private.clinical_master_lab_publish_stage stage
    where stage.release_id=v_release.id and stage.record_type='lab_panel'
  ), latest_versions as (
    select distinct on (version.master_record_id)
      version.master_record_id,version.snapshot,version.revision
    from master.master_record_versions version
    join target_stage target on target.master_record_id=version.master_record_id
    order by version.master_record_id,version.revision desc
  )
  update private.clinical_master_lab_publish_stage stage
  set effective_revision=case
    when latest.revision is null then 1
    when (latest.snapshot-'revision') is distinct from target.base_content || target.relation_content then latest.revision+1
    else latest.revision
  end
  from target_stage target
  left join latest_versions latest on latest.master_record_id=target.master_record_id
  where stage.release_id=v_release.id and stage.master_record_id=target.master_record_id;
$new_panel_revision$,
$new_all_revision$
  with target_stage as (
    select stage.master_record_id,stage.base_content,stage.relation_content
    from private.clinical_master_lab_publish_stage stage
    where stage.release_id=v_release.id
  ), latest_versions as (
    select distinct on (version.master_record_id)
      version.master_record_id,version.snapshot,version.revision
    from master.master_record_versions version
    join target_stage target on target.master_record_id=version.master_record_id
    order by version.master_record_id,version.revision desc
  )
  update private.clinical_master_lab_publish_stage stage
  set effective_revision=case
    when latest.revision is null then 1
    when (latest.snapshot-'revision') is distinct from target.base_content || target.relation_content then latest.revision+1
    else latest.revision
  end
  from target_stage target
  left join latest_versions latest on latest.master_record_id=target.master_record_id
  where stage.release_id=v_release.id and stage.master_record_id=target.master_record_id;
$new_all_revision$,
$new_order_revision$
  with target_stage as (
    select stage.master_record_id,stage.base_content,stage.relation_content
    from private.clinical_master_lab_publish_stage stage
    where stage.release_id=v_release.id and stage.record_type='order'
  ), latest_versions as (
    select distinct on (version.master_record_id)
      version.master_record_id,version.snapshot,version.revision
    from master.master_record_versions version
    join target_stage target on target.master_record_id=version.master_record_id
    order by version.master_record_id,version.revision desc
  )
  update private.clinical_master_lab_publish_stage stage
  set effective_revision=case
    when latest.revision is null then 1
    when (latest.snapshot-'revision') is distinct from target.base_content || target.relation_content then latest.revision+1
    else latest.revision
  end
  from target_stage target
  left join latest_versions latest on latest.master_record_id=target.master_record_id
  where stage.release_id=v_release.id and stage.master_record_id=target.master_record_id;
$new_order_revision$,
$new_owner_revision$
  -- The identity pass above already created and locked every included owner.
  -- The final release-scoped stage is therefore the authoritative owner content
  -- and revision source for this pass; do not decompose the payload or invoke
  -- the relation helper again.
  if (
    select pg_catalog.count(*)
    from private.clinical_master_lab_publish_stage stage
    where stage.release_id=v_release.id
  ) is distinct from v_record_count
    or exists (
      select 1
      from pg_catalog.jsonb_array_elements(v_payload->'records') records(value)
      left join private.clinical_master_lab_publish_stage stage
        on stage.release_id=v_release.id
       and stage.master_key=pg_catalog.btrim(records.value->>'masterKey')
      left join master.master_records owner on owner.id=stage.master_record_id
      where stage.master_record_id is null
        or stage.record_type is distinct from pg_catalog.btrim(records.value->>'recordType')
        or owner.id is null
        or owner.master_key is distinct from stage.master_key
        or owner.record_type is distinct from stage.record_type
        or stage.effective_revision is null
    )
  then
    raise exception 'clinical_master_owner_stage_contract_invalid'
      using errcode='55000';
  end if;

  if exists (
    with target_stage as (
      select stage.master_record_id,stage.base_content,stage.relation_content,
        stage.effective_revision
      from private.clinical_master_lab_publish_stage stage
      where stage.release_id=v_release.id
    ), latest_versions as (
      select distinct on (version.master_record_id)
        version.master_record_id,version.snapshot,version.revision
      from master.master_record_versions version
      join target_stage target on target.master_record_id=version.master_record_id
      order by version.master_record_id,version.revision desc
    )
    select 1
    from target_stage target
    left join latest_versions latest on latest.master_record_id=target.master_record_id
    where target.effective_revision is distinct from case
      when latest.revision is null then 1
      when (latest.snapshot-'revision') is distinct from target.base_content || target.relation_content then latest.revision+1
      else latest.revision
    end
  ) then
    raise exception 'clinical_master_owner_stage_revision_invalid'
      using errcode='55000';
  end if;

  with target_stage as (
    select stage.master_record_id,stage.effective_revision
    from private.clinical_master_lab_publish_stage stage
    where stage.release_id=v_release.id
  ), latest_revisions as (
    select version.master_record_id,pg_catalog.max(version.revision) as revision
    from master.master_record_versions version
    join target_stage target on target.master_record_id=version.master_record_id
    group by version.master_record_id
  )
  update master.master_records owner
  set current_revision=target.effective_revision,
    current_release_id=v_release.id,
    updated_at=pg_catalog.now()
  from target_stage target
  join latest_revisions latest on latest.master_record_id=target.master_record_id
  where owner.id=target.master_record_id
    and target.effective_revision=latest.revision+1;

  if exists (
    select 1
    from private.clinical_master_lab_publish_stage stage
    join master.master_records owner on owner.id=stage.master_record_id
    where stage.release_id=v_release.id
      and owner.current_revision is distinct from stage.effective_revision
  ) then
    raise exception 'clinical_master_owner_stage_current_revision_invalid'
      using errcode='55000';
  end if;
$new_owner_revision$
  ];
begin
  select pg_catalog.pg_get_functiondef(function.oid),function.proowner,
    function.prosecdef,function.proconfig,function.proacl,function.provolatile,
    function.proparallel
  into v_definition,v_owner,v_security_definer,v_config,v_acl,v_volatility,
    v_parallel
  from pg_catalog.pg_proc function
  where function.oid=
    'private.publish_clinical_master_release_cumulative(jsonb,uuid)'::pg_catalog.regprocedure;

  if pg_catalog.strpos(
    v_definition,
    'clinical_master.publisher_canonical_sha256'
  )=0 or pg_catalog.strpos(
    v_definition,
    'clinical_master_omitted_lab_dependency_revision_missing'
  )=0 then
    raise exception 'clinical_master_set_based_publisher_composition_missing'
      using errcode='55000';
  end if;

  for v_patch_index in 1..pg_catalog.array_length(v_old,1) loop
    v_old_count := (
      pg_catalog.length(v_definition)
      - pg_catalog.length(pg_catalog.replace(v_definition,v_old[v_patch_index],''))
    ) / pg_catalog.length(v_old[v_patch_index]);
    v_new_count := (
      pg_catalog.length(v_definition)
      - pg_catalog.length(pg_catalog.replace(v_definition,v_new[v_patch_index],''))
    ) / pg_catalog.length(v_new[v_patch_index]);

    if v_old_count=1 and v_new_count=0 then
      v_definition := pg_catalog.replace(
        v_definition,
        v_old[v_patch_index],
        v_new[v_patch_index]
      );
      v_changed := true;
    elsif v_old_count<>0 or v_new_count<>1 then
      raise exception 'clinical_master_set_based_publisher_patch_anchor_missing:%',
        v_patch_index using errcode='55000';
    end if;
  end loop;

  if v_changed then
    execute v_definition;
  end if;

  select pg_catalog.pg_get_functiondef(
    'private.publish_clinical_master_release_cumulative(jsonb,uuid)'::pg_catalog.regprocedure
  ) into v_definition;

  for v_patch_index in 1..pg_catalog.array_length(v_old,1) loop
    v_old_count := (
      pg_catalog.length(v_definition)
      - pg_catalog.length(pg_catalog.replace(v_definition,v_old[v_patch_index],''))
    ) / pg_catalog.length(v_old[v_patch_index]);
    v_new_count := (
      pg_catalog.length(v_definition)
      - pg_catalog.length(pg_catalog.replace(v_definition,v_new[v_patch_index],''))
    ) / pg_catalog.length(v_new[v_patch_index]);
    if v_old_count<>0 or v_new_count<>1 then
      raise exception 'clinical_master_set_based_publisher_patch_postcondition_failed:%',
        v_patch_index using errcode='55000';
    end if;
  end loop;

  if exists (
    select 1
    from pg_catalog.pg_proc function
    where function.oid=
      'private.publish_clinical_master_release_cumulative(jsonb,uuid)'::pg_catalog.regprocedure
      and (
        function.proowner is distinct from v_owner
        or function.prosecdef is distinct from v_security_definer
        or function.proconfig is distinct from v_config
        or function.proacl is distinct from v_acl
        or function.provolatile is distinct from v_volatility
        or function.proparallel is distinct from v_parallel
      )
  ) then
    raise exception 'clinical_master_set_based_publisher_security_contract_changed'
      using errcode='55000';
  end if;
end;
$patch_cumulative_set_based_owner_revision$;

revoke all on function private.publish_clinical_master_release_cumulative(jsonb,uuid)
  from public, anon, authenticated, service_role;

comment on function private.publish_clinical_master_release_cumulative(jsonb,uuid) is
  'Cumulative synthetic clinical-master publisher with release-scoped set-based effective-revision and owner updates; callable only through the private outer publisher.';
