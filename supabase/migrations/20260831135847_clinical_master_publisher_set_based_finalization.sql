-- CLINICAL-MASTER-PR-022 set-based cumulative publisher finalization.
--
-- The first set-based candidate moved the remote timeout beyond owner revision
-- resolution. The next observed interruption was inside the final 535-record
-- loop while each row inserted its source link and triggered a foreign-key
-- key-share check. Materialize the exact changed/new release owners once, then
-- replace the row-wise name/source/version/review writes with bounded set-based
-- statements. The release-scoped stage remains the authoritative content and
-- revision source.

set lock_timeout = '5s';
set statement_timeout = '120s';

do $patch_cumulative_set_based_finalization$
declare
  v_definition text;
  v_old_count integer;
  v_new_count integer;
  v_changed boolean := false;
  v_owner oid;
  v_security_definer boolean;
  v_config text[];
  v_acl aclitem[];
  v_volatility "char";
  v_parallel "char";
  v_old text := $old_finalization$
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
$old_finalization$;
  v_new text := $new_finalization$
  -- Names, provenance, immutable version rows, and publication events. The
  -- existing release stage is the only materialized boundary. Each bounded
  -- statement derives the same changed/new set from its release id and
  -- effective revision; no caller-controlled temporary object is introduced.
  select pg_catalog.count(*)
  into v_preferred_ko_count
  from private.clinical_master_lab_publish_stage stage
  where stage.release_id=v_release.id
    and not exists (
      select 1
      from master.master_record_versions version
      where version.master_record_id=stage.master_record_id
        and version.revision=stage.effective_revision
    );

  select pg_catalog.count(*),coalesce(
    pg_catalog.sum(pg_catalog.jsonb_array_length(records.value->'names')),
    0::bigint
  )
  into v_preferred_en_count,v_latest_revision
  from private.clinical_master_lab_publish_stage stage
  join pg_catalog.jsonb_array_elements(v_payload->'records') records(value)
    on pg_catalog.btrim(records.value->>'masterKey')=stage.master_key
  where stage.release_id=v_release.id
    and not exists (
      select 1
      from master.master_record_versions version
      where version.master_record_id=stage.master_record_id
        and version.revision=stage.effective_revision
    )
    and pg_catalog.jsonb_typeof(records.value->'names')='array'
    and pg_catalog.jsonb_array_length(records.value->'names')>0
    and pg_catalog.jsonb_typeof(records.value->'source')='object';

  if v_preferred_ko_count is distinct from v_preferred_en_count then
    raise exception 'clinical_master_finalization_stage_contract_invalid'
      using errcode='55000';
  end if;

  with finalize as materialized (
    select stage.master_record_id
    from private.clinical_master_lab_publish_stage stage
    where stage.release_id=v_release.id
      and not exists (
        select 1
        from master.master_record_versions version
        where version.master_record_id=stage.master_record_id
          and version.revision=stage.effective_revision
      )
  )
  delete from master.master_record_names name using finalize
  where name.master_record_id=finalize.master_record_id;

  with finalize as materialized (
    select stage.master_record_id,records.value->'names' names
    from private.clinical_master_lab_publish_stage stage
    join pg_catalog.jsonb_array_elements(v_payload->'records') records(value)
      on pg_catalog.btrim(records.value->>'masterKey')=stage.master_key
    where stage.release_id=v_release.id
      and not exists (
        select 1
        from master.master_record_versions version
        where version.master_record_id=stage.master_record_id
          and version.revision=stage.effective_revision
      )
  )
  insert into master.master_record_names(
    master_record_id,language_code,name_kind,name,normalized_name,searchable,sort_order
  )
  select
    finalize.master_record_id,
    name.value->>'languageCode',
    name.value->>'nameKind',
    name.value->>'name',
    pg_catalog.lower(
      pg_catalog.regexp_replace(
        pg_catalog.btrim(name.value->>'name'),
        '[[:space:]]+',
        ' ',
        'g'
      )
    ),
    coalesce((name.value->>'searchable')::boolean,true),
    coalesce((name.value->>'sortOrder')::integer,0)
  from finalize
  cross join lateral pg_catalog.jsonb_array_elements(finalize.names) name(value);
  get diagnostics v_preferred_en_count = row_count;
  if v_preferred_en_count is distinct from v_latest_revision then
    raise exception 'clinical_master_finalization_name_count_invalid'
      using errcode='55000';
  end if;

  with finalize as materialized (
    select
      stage.master_record_id,
      records.value->'source' source_content,
      extensions.gen_random_uuid() source_id
    from private.clinical_master_lab_publish_stage stage
    join pg_catalog.jsonb_array_elements(v_payload->'records') records(value)
      on pg_catalog.btrim(records.value->>'masterKey')=stage.master_key
    where stage.release_id=v_release.id
      and not exists (
        select 1
        from master.master_record_versions version
        where version.master_record_id=stage.master_record_id
          and version.revision=stage.effective_revision
      )
  ), inserted_sources as (
    insert into master.master_sources(
      id,source_type,title,reference_uri,source_version,accessed_at,license_notes
    )
    select
      finalize.source_id,
      finalize.source_content->>'sourceType',
      finalize.source_content->>'title',
      finalize.source_content->>'referenceUri',
      finalize.source_content->>'sourceVersion',
      nullif(finalize.source_content->>'accessedAt','')::timestamptz,
      finalize.source_content->>'licenseNotes'
    from finalize
    returning id
  ), inserted_links as (
    insert into master.master_record_sources(
      master_record_id,source_id,assertion_scope,notes
    )
    select
      finalize.master_record_id,
      finalize.source_id,
      'record',
      'Validated Phase 1B-1 synthetic publisher source.'
    from finalize
    join inserted_sources source on source.id=finalize.source_id
    returning source_id
  )
  select
    (select pg_catalog.count(*) from inserted_sources),
    (select pg_catalog.count(*) from inserted_links)
  into v_preferred_en_count,v_latest_revision;
  if v_preferred_en_count is distinct from v_preferred_ko_count
    or v_latest_revision is distinct from v_preferred_ko_count
  then
    raise exception 'clinical_master_finalization_source_count_invalid'
      using errcode='55000';
  end if;

  with finalize as materialized (
    select
      stage.master_record_id,
      stage.effective_revision revision,
      pg_catalog.jsonb_set(
        stage.base_content || stage.relation_content,
        '{revision}',
        pg_catalog.to_jsonb(stage.effective_revision),
        true
      ) snapshot
    from private.clinical_master_lab_publish_stage stage
    where stage.release_id=v_release.id
      and not exists (
        select 1
        from master.master_record_versions version
        where version.master_record_id=stage.master_record_id
          and version.revision=stage.effective_revision
      )
  )
  insert into master.master_record_versions(
    master_record_id,revision,release_id,snapshot,change_summary,
    authored_by_label,reviewed_by_label
  )
  select
    finalize.master_record_id,
    finalize.revision,
    v_release.id,
    finalize.snapshot,
    'Phase 1B-1 validated synthetic publish.',
    v_payload->>'publishedByLabel',
    v_payload->>'publishedByLabel'
  from finalize;
  get diagnostics v_preferred_en_count = row_count;
  if v_preferred_en_count is distinct from v_preferred_ko_count then
    raise exception 'clinical_master_finalization_version_count_invalid'
      using errcode='55000';
  end if;

  insert into master.master_review_events(
    master_record_id,revision,event_type,actor_user_id,actor_label,source_surface
  )
  select
    version.master_record_id,
    version.revision,
    event.event_type,
    p_actor_user_id,
    v_payload->>'publishedByLabel',
    'publisher'
  from master.master_record_versions version
  cross join lateral (
    values ('validated'::text),('published'::text)
  ) event(event_type)
  where version.release_id=v_release.id;
  get diagnostics v_preferred_en_count = row_count;
  if v_preferred_en_count is distinct from 2*v_preferred_ko_count then
    raise exception 'clinical_master_finalization_review_count_invalid'
      using errcode='55000';
  end if;

  if (
    select pg_catalog.count(*)
    from master.master_record_versions version
    where version.release_id=v_release.id
  ) is distinct from v_preferred_ko_count or exists (
    with finalize as materialized (
      select
        version.master_record_id,
        version.revision,
        pg_catalog.jsonb_set(
          stage.base_content || stage.relation_content,
          '{revision}',
          pg_catalog.to_jsonb(stage.effective_revision),
          true
        ) snapshot
      from master.master_record_versions version
      join private.clinical_master_lab_publish_stage stage
        on stage.release_id=version.release_id
       and stage.master_record_id=version.master_record_id
      where version.release_id=v_release.id
    )
    select 1
    from finalize
    left join master.master_record_versions version
      on version.master_record_id=finalize.master_record_id
     and version.revision=finalize.revision
     and version.release_id=v_release.id
    left join master.master_records owner on owner.id=finalize.master_record_id
    where version.master_record_id is null
      or version.snapshot is distinct from finalize.snapshot
      or owner.current_revision is distinct from finalize.revision
      or owner.current_release_id is distinct from v_release.id
  ) or exists (
    with finalize as materialized (
      select
        version.master_record_id,
        records.value->'names' names,
        records.value->'source' source_content,
        version.revision
      from master.master_record_versions version
      join private.clinical_master_lab_publish_stage stage
        on stage.release_id=version.release_id
       and stage.master_record_id=version.master_record_id
      join pg_catalog.jsonb_array_elements(v_payload->'records') records(value)
        on pg_catalog.btrim(records.value->>'masterKey')=stage.master_key
      where version.release_id=v_release.id
    )
    select 1
    from finalize
    where (
      select pg_catalog.count(*)
      from master.master_record_names actual
      where actual.master_record_id=finalize.master_record_id
    ) is distinct from pg_catalog.jsonb_array_length(finalize.names)
      or exists (
        select 1
        from pg_catalog.jsonb_array_elements(finalize.names) expected(value)
        where not exists (
          select 1
          from master.master_record_names actual
          where actual.master_record_id=finalize.master_record_id
            and actual.language_code=expected.value->>'languageCode'
            and actual.name_kind=expected.value->>'nameKind'
            and actual.name=pg_catalog.btrim(expected.value->>'name')
            and actual.normalized_name=pg_catalog.lower(
              pg_catalog.regexp_replace(
                pg_catalog.btrim(expected.value->>'name'),
                '[[:space:]]+',
                ' ',
                'g'
              )
            )
            and actual.searchable is not distinct from
              coalesce((expected.value->>'searchable')::boolean,true)
            and actual.sort_order is not distinct from
              coalesce((expected.value->>'sortOrder')::integer,0)
        )
      )
      or not exists (
        select 1
        from master.master_record_sources link
        join master.master_sources source on source.id=link.source_id
        where link.master_record_id=finalize.master_record_id
          and link.assertion_scope='record'
          and link.notes='Validated Phase 1B-1 synthetic publisher source.'
          and source.source_type is not distinct from finalize.source_content->>'sourceType'
          and source.title is not distinct from finalize.source_content->>'title'
          and source.reference_uri is not distinct from finalize.source_content->>'referenceUri'
          and source.source_version is not distinct from finalize.source_content->>'sourceVersion'
          and source.accessed_at is not distinct from
            nullif(finalize.source_content->>'accessedAt','')::timestamptz
          and source.license_notes is not distinct from finalize.source_content->>'licenseNotes'
      ) or exists (
        select 1
        from (values ('validated'::text),('published'::text)) expected(event_type)
        where (
          select pg_catalog.count(*)
          from master.master_review_events review
          where review.master_record_id=finalize.master_record_id
            and review.revision=finalize.revision
            and review.event_type=expected.event_type
            and review.actor_user_id is not distinct from p_actor_user_id
            and review.actor_label is not distinct from v_payload->>'publishedByLabel'
            and review.source_surface='publisher'
        )<>1
      )
  ) then
    raise exception 'clinical_master_finalization_postcondition_failed'
      using errcode='55000';
  end if;
$new_finalization$;
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
    'clinical_master_owner_stage_contract_invalid'
  )=0 or pg_catalog.strpos(
    v_definition,
    'clinical_master.publisher_canonical_sha256'
  )=0 or pg_catalog.strpos(
    v_definition,
    'clinical_master_omitted_lab_dependency_revision_missing'
  )=0 then
    raise exception 'clinical_master_set_based_finalization_composition_missing'
      using errcode='55000';
  end if;

  v_old_count := (
    pg_catalog.length(v_definition)
    - pg_catalog.length(pg_catalog.replace(v_definition,v_old,''))
  ) / pg_catalog.length(v_old);
  v_new_count := (
    pg_catalog.length(v_definition)
    - pg_catalog.length(pg_catalog.replace(v_definition,v_new,''))
  ) / pg_catalog.length(v_new);

  if v_old_count=1 and v_new_count=0 then
    v_definition := pg_catalog.replace(v_definition,v_old,v_new);
    v_changed := true;
  elsif v_old_count<>0 or v_new_count<>1 then
    raise exception 'clinical_master_set_based_finalization_patch_anchor_missing'
      using errcode='55000';
  end if;

  if v_changed then
    execute v_definition;
  end if;

  select pg_catalog.pg_get_functiondef(
    'private.publish_clinical_master_release_cumulative(jsonb,uuid)'::pg_catalog.regprocedure
  ) into v_definition;
  v_old_count := (
    pg_catalog.length(v_definition)
    - pg_catalog.length(pg_catalog.replace(v_definition,v_old,''))
  ) / pg_catalog.length(v_old);
  v_new_count := (
    pg_catalog.length(v_definition)
    - pg_catalog.length(pg_catalog.replace(v_definition,v_new,''))
  ) / pg_catalog.length(v_new);
  if v_old_count<>0 or v_new_count<>1 then
    raise exception 'clinical_master_set_based_finalization_patch_postcondition_failed'
      using errcode='55000';
  end if;

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
    raise exception 'clinical_master_set_based_finalization_security_contract_changed'
      using errcode='55000';
  end if;
end;
$patch_cumulative_set_based_finalization$;

revoke all on function private.publish_clinical_master_release_cumulative(jsonb,uuid)
  from public, anon, authenticated, service_role;

comment on function private.publish_clinical_master_release_cumulative(jsonb,uuid) is
  'Cumulative synthetic clinical-master publisher with release-scoped set-based revision, owner, and finalization writes; callable only through the private outer publisher.';
