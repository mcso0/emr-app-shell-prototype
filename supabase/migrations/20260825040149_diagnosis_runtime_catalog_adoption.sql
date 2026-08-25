-- CLINICAL-MASTER-PR-015: diagnosis master publication, workspace adoption,
-- catalog search, and immutable encounter snapshot contract.
--
-- This is an additive synthetic-demo slice. Existing free-text diagnoses are
-- deliberately left untouched. The diagnosis publisher is isolated from the
-- existing order/laboratory publisher so the proven release path stays intact.

set check_function_bodies = off;

do $$
begin
  if to_regclass('master.diagnosis_categories') is null
    or to_regclass('master.diagnoses') is null
    or to_regclass('master.diagnosis_category_links') is null
    or to_regclass('master.master_records') is null
    or to_regclass('master.master_record_versions') is null
    or to_regclass('master.master_record_names') is null
    or to_regclass('master.master_releases') is null
    or to_regclass('master.master_sources') is null
    or to_regclass('master.master_record_sources') is null
    or to_regclass('master.master_review_events') is null
    or to_regclass('private.clinical_master_release_payload_owner_manifest') is null
    or to_regclass('private.clinical_master_lab_publish_stage') is null
    or to_regclass('public.diagnosis_catalog') is null
    or to_regclass('public.diagnoses') is null
    or to_regclass('public.encounters') is null
    or to_regclass('public.user_memberships') is null
    or to_regclass('public.audit_events') is null
    or to_regclass('public.workspaces') is null
    or to_regprocedure('private.clair_is_active_workspace_member(text)') is null
    or to_regprocedure('private.clair_current_user_has_workspace_permission(text,text)') is null
    or to_regprocedure('private.clinical_master_sha256(jsonb)') is null
    or to_regprocedure('private.clinical_master_payload_manifest_content_sha256(uuid,text,text,boolean,integer,jsonb,jsonb)') is null
    or to_regprocedure('private.clinical_master_assert_contract_keys(text,jsonb)') is null
    or to_regprocedure('private.clinical_master_canonicalize_payload(jsonb)') is null
    or to_regprocedure('private.publish_clinical_master_release_cumulative(jsonb,uuid)') is null
    or to_regprocedure('extensions.digest(text,text)') is null
    or to_regprocedure('extensions.gen_random_uuid()') is null then
    raise exception 'diagnosis_runtime_preflight_missing_dependency';
  end if;
  if exists (select 1 from public.diagnosis_catalog where workspace_id is null) then
    raise exception 'diagnosis_runtime_preflight_null_catalog_workspace';
  end if;
end
$$;

create table if not exists private.clinical_master_diagnosis_release_payloads (
  release_id uuid primary key references master.master_releases(id) on delete restrict,
  payload jsonb not null check (pg_catalog.jsonb_typeof(payload) = 'object'),
  payload_fingerprint text not null unique
    check (payload_fingerprint ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default pg_catalog.now()
);

comment on table private.clinical_master_diagnosis_release_payloads is
  'Immutable canonical payload evidence for an atomic diagnosis-only master release.';

revoke all on private.clinical_master_diagnosis_release_payloads from public, anon, authenticated, service_role;

create or replace function private.reject_clinical_master_diagnosis_release_payload_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'clinical_master_diagnosis_release_payload_immutable' using errcode = '55000';
end;
$$;

revoke all on function private.reject_clinical_master_diagnosis_release_payload_mutation()
  from public, anon, authenticated, service_role;

drop trigger if exists clinical_master_diagnosis_release_payload_immutable
  on private.clinical_master_diagnosis_release_payloads;
create trigger clinical_master_diagnosis_release_payload_immutable
before update or delete on private.clinical_master_diagnosis_release_payloads
for each row execute function private.reject_clinical_master_diagnosis_release_payload_mutation();

create or replace function private.publish_clinical_master_diagnosis_release(
  p_payload jsonb,
  p_actor_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payload jsonb;
  v_fingerprint text;
  v_release_key text;
  v_release master.master_releases%rowtype;
  v_existing master.master_releases%rowtype;
  v_record jsonb;
  v_link jsonb;
  v_name jsonb;
  v_source jsonb;
  v_detail jsonb;
  v_master_key text;
  v_record_type text;
  v_record_id uuid;
  v_parent_id uuid;
  v_category_id uuid;
  v_revision integer;
  v_latest_revision integer;
  v_snapshot jsonb;
  v_latest_snapshot jsonb;
  v_relation_snapshot jsonb;
  v_source_id uuid;
  v_record_count integer;
  v_system_count integer;
  v_group_count integer;
  v_diagnosis_count integer;
  v_link_count integer;
  v_primary_count integer;
  v_published_by_label text;
begin
  if p_payload is null or pg_catalog.jsonb_typeof(p_payload) <> 'object' then
    raise exception 'clinical_master_payload_object_required' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('clinical_master_phase_1a_1_publication', 0)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('clinical_master_phase_1a1_publication', 0)
  );
  if exists (
    select 1 from pg_catalog.jsonb_object_keys(p_payload) key
    where key not in ('releaseKey','releaseNotes','publishedByLabel','records','diagnosisCategoryLinks')
  ) then
    raise exception 'clinical_master_diagnosis_payload_field_unknown' using errcode = '22023';
  end if;
  if pg_catalog.jsonb_typeof(p_payload->'records') <> 'array'
    or pg_catalog.jsonb_array_length(p_payload->'records') = 0 then
    raise exception 'clinical_master_records_required' using errcode = '22023';
  end if;
  if pg_catalog.jsonb_typeof(coalesce(p_payload->'diagnosisCategoryLinks','null'::jsonb)) <> 'array' then
    raise exception 'clinical_master_diagnosis_links_array_required' using errcode = '22023';
  end if;
  v_published_by_label := pg_catalog.btrim(coalesce(p_payload->>'publishedByLabel',''));
  if v_published_by_label = '' then
    raise exception 'clinical_master_published_by_label_required' using errcode = '22023';
  end if;

  for v_record in
    select value from pg_catalog.jsonb_array_elements(p_payload->'records') records(value)
  loop
    if pg_catalog.jsonb_typeof(v_record) <> 'object'
      or exists (
        select 1 from pg_catalog.jsonb_object_keys(v_record) key
        where key not in ('masterKey','recordType','lifecycleStatus','safetyStatus','safetyReason','changeSummary','sourceAssertionScope','sourceNotes','names','source','detail')
      ) then
      raise exception 'clinical_master_diagnosis_record_contract_failed' using errcode = '22023';
    end if;
    v_master_key := pg_catalog.btrim(coalesce(v_record->>'masterKey',''));
    v_record_type := pg_catalog.btrim(coalesce(v_record->>'recordType',''));
    if v_master_key = '' or v_record_type not in ('diagnosis_category','diagnosis') then
      raise exception 'clinical_master_diagnosis_record_invalid' using errcode = '22023';
    end if;
    if coalesce(v_record->>'lifecycleStatus','published') <> 'published'
      or coalesce(v_record->>'safetyStatus','normal') <> 'normal' then
      raise exception 'clinical_master_diagnosis_record_not_publishable' using errcode = '22023';
    end if;
    if pg_catalog.jsonb_typeof(coalesce(v_record->'names','null'::jsonb)) <> 'array'
      or not exists (
        select 1 from pg_catalog.jsonb_array_elements(v_record->'names') names(value)
        where value->>'languageCode' = 'ko' and value->>'nameKind' = 'preferred'
          and pg_catalog.btrim(coalesce(value->>'name','')) <> ''
      ) then
      raise exception 'clinical_master_diagnosis_preferred_ko_name_required' using errcode = '22023';
    end if;
    if pg_catalog.jsonb_typeof(coalesce(v_record->'source','null'::jsonb)) <> 'object'
      or v_record->'source'->>'sourceType' <> 'synthetic'
      or pg_catalog.btrim(coalesce(v_record->'source'->>'title','')) = '' then
      raise exception 'clinical_master_diagnosis_synthetic_source_required' using errcode = '22023';
    end if;
    v_detail := coalesce(v_record->'detail','{}'::jsonb);
    if v_record_type = 'diagnosis_category' then
      if exists (
        select 1 from pg_catalog.jsonb_object_keys(v_detail) key
        where key not in ('categoryKind','parentMasterKey','sortOrder')
      ) or v_detail->>'categoryKind' not in ('system','disease_group')
        or coalesce((v_detail->>'sortOrder')::integer, 0) < 0 then
        raise exception 'clinical_master_diagnosis_category_detail_invalid' using errcode = '22023';
      end if;
      if (v_detail->>'categoryKind' = 'system' and nullif(pg_catalog.btrim(coalesce(v_detail->>'parentMasterKey','')), '') is not null)
        or (v_detail->>'categoryKind' = 'disease_group' and nullif(pg_catalog.btrim(coalesce(v_detail->>'parentMasterKey','')), '') is null) then
        raise exception 'clinical_master_diagnosis_category_parent_invalid' using errcode = '23514';
      end if;
    elsif v_detail <> '{}'::jsonb then
      raise exception 'clinical_master_diagnosis_detail_must_be_empty' using errcode = '22023';
    end if;
  end loop;

  if (
    select count(*) from (
      select value->>'masterKey' key
      from pg_catalog.jsonb_array_elements(p_payload->'records') records(value)
      group by value->>'masterKey' having count(*) > 1
    ) duplicates
  ) > 0 then
    raise exception 'clinical_master_diagnosis_master_key_duplicate' using errcode = '23505';
  end if;

  select count(*) filter (where value->>'recordType' = 'diagnosis_category' and value->'detail'->>'categoryKind' = 'system'),
         count(*) filter (where value->>'recordType' = 'diagnosis_category' and value->'detail'->>'categoryKind' = 'disease_group'),
         count(*) filter (where value->>'recordType' = 'diagnosis')
    into v_system_count, v_group_count, v_diagnosis_count
  from pg_catalog.jsonb_array_elements(p_payload->'records') records(value);

  if v_system_count <> 6
    or v_group_count <> 6
    or v_diagnosis_count <> 12
    or pg_catalog.jsonb_array_length(p_payload->'diagnosisCategoryLinks') <> 12 then
    raise exception 'clinical_master_diagnosis_release_shape_invalid'
      using errcode = '23514',
        detail = pg_catalog.format(
          'systems=%s disease_groups=%s diagnoses=%s links=%s',
          v_system_count,
          v_group_count,
          v_diagnosis_count,
          pg_catalog.jsonb_array_length(p_payload->'diagnosisCategoryLinks')
        );
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_payload->'records') groups(value)
    where value->>'recordType' = 'diagnosis_category'
      and value->'detail'->>'categoryKind' = 'disease_group'
      and not exists (
        select 1 from pg_catalog.jsonb_array_elements(p_payload->'records') systems(value)
        where value->>'recordType' = 'diagnosis_category'
          and value->'detail'->>'categoryKind' = 'system'
          and value->>'masterKey' = groups.value->'detail'->>'parentMasterKey'
      )
  ) then
    raise exception 'clinical_master_diagnosis_parent_must_be_payload_system' using errcode = '23503';
  end if;

  for v_link in
    select value from pg_catalog.jsonb_array_elements(p_payload->'diagnosisCategoryLinks') links(value)
  loop
    if pg_catalog.jsonb_typeof(v_link) <> 'object'
      or exists (
        select 1 from pg_catalog.jsonb_object_keys(v_link) key
        where key not in ('diagnosisMasterKey','categoryMasterKey','isPrimary','sortOrder')
      ) or coalesce((v_link->>'sortOrder')::integer, -1) < 0
      or not exists (
        select 1 from pg_catalog.jsonb_array_elements(p_payload->'records') diagnoses(value)
        where value->>'recordType' = 'diagnosis'
          and value->>'masterKey' = v_link->>'diagnosisMasterKey'
      ) or not exists (
        select 1 from pg_catalog.jsonb_array_elements(p_payload->'records') groups(value)
        where value->>'recordType' = 'diagnosis_category'
          and value->'detail'->>'categoryKind' = 'disease_group'
          and value->>'masterKey' = v_link->>'categoryMasterKey'
      ) then
      raise exception 'clinical_master_diagnosis_link_invalid' using errcode = '23514';
    end if;
  end loop;

  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_payload->'records') diagnoses(value)
    where value->>'recordType' = 'diagnosis'
      and (
        select count(*) from pg_catalog.jsonb_array_elements(p_payload->'diagnosisCategoryLinks') links(value)
        where value->>'diagnosisMasterKey' = diagnoses.value->>'masterKey'
      ) < 1
  ) then
    raise exception 'clinical_master_diagnosis_link_required' using errcode = '23514';
  end if;
  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_payload->'records') diagnoses(value)
    where value->>'recordType' = 'diagnosis'
      and (
        select count(*) from pg_catalog.jsonb_array_elements(p_payload->'diagnosisCategoryLinks') links(value)
        where value->>'diagnosisMasterKey' = diagnoses.value->>'masterKey'
          and coalesce((value->>'isPrimary')::boolean, false)
      ) <> 1
  ) then
    raise exception 'clinical_master_diagnosis_exactly_one_primary_required' using errcode = '23514';
  end if;
  if exists (
    select 1 from (
      select value->>'diagnosisMasterKey', value->>'categoryMasterKey'
      from pg_catalog.jsonb_array_elements(p_payload->'diagnosisCategoryLinks') links(value)
      group by value->>'diagnosisMasterKey', value->>'categoryMasterKey'
      having count(*) > 1
    ) duplicates
  ) then
    raise exception 'clinical_master_diagnosis_link_duplicate' using errcode = '23505';
  end if;
  if exists (
    select 1 from (
      select value->>'diagnosisMasterKey', (value->>'sortOrder')::integer
      from pg_catalog.jsonb_array_elements(p_payload->'diagnosisCategoryLinks') links(value)
      group by value->>'diagnosisMasterKey', (value->>'sortOrder')::integer
      having count(*) > 1
    ) duplicates
  ) then
    raise exception 'clinical_master_diagnosis_link_sort_order_duplicate' using errcode = '23505';
  end if;

  select pg_catalog.jsonb_build_object(
    'releaseKey', nullif(pg_catalog.btrim(coalesce(p_payload->>'releaseKey','')), ''),
    'releaseNotes', nullif(pg_catalog.btrim(coalesce(p_payload->>'releaseNotes','')), ''),
    'publishedByLabel', v_published_by_label,
    'records', coalesce(pg_catalog.jsonb_agg(value order by value->>'masterKey'), '[]'::jsonb),
    'diagnosisCategoryLinks', (
      select coalesce(pg_catalog.jsonb_agg(value order by value->>'diagnosisMasterKey', value->>'sortOrder', value->>'categoryMasterKey'), '[]'::jsonb)
      from pg_catalog.jsonb_array_elements(p_payload->'diagnosisCategoryLinks') links(value)
    )
  ) into v_payload
  from pg_catalog.jsonb_array_elements(p_payload->'records') records(value);

  v_fingerprint := private.clinical_master_sha256(v_payload);
  v_release_key := nullif(v_payload->>'releaseKey','');
  select * into v_existing
  from master.master_releases
  where source_fingerprint = v_fingerprint
  for update;
  if found then
    if v_existing.status <> 'published' then
      raise exception 'clinical_master_diagnosis_release_incomplete' using errcode = '40001';
    end if;
    return pg_catalog.jsonb_build_object(
      'releaseId', v_existing.id,
      'releaseNo', v_existing.release_no,
      'sourceFingerprint', v_existing.source_fingerprint,
      'idempotent', true,
      'recordCount', v_existing.record_count
    );
  end if;
  if v_release_key is not null and exists (
    select 1 from master.master_releases where release_key = v_release_key
  ) then
    raise exception 'clinical_master_release_key_payload_conflict' using errcode = '23505';
  end if;

  v_record_count := v_system_count + v_group_count + v_diagnosis_count;
  insert into master.master_releases(
    release_key, record_count, source_fingerprint, status, release_notes,
    published_by_user_id, published_by_label, adoption_scope
  ) values (
    v_release_key, v_record_count, v_fingerprint, 'publishing',
    nullif(v_payload->>'releaseNotes',''), p_actor_user_id, v_published_by_label, 'payload'
  ) returning * into v_release;

  insert into private.clinical_master_diagnosis_release_payloads(
    release_id, payload, payload_fingerprint
  ) values (v_release.id, v_payload, v_fingerprint);

  -- Establish immutable identities first so hierarchy/link references can be
  -- resolved without depending on authoring array order.
  for v_record in
    select value from pg_catalog.jsonb_array_elements(v_payload->'records') records(value)
    order by case
      when value->>'recordType' = 'diagnosis_category' and value->'detail'->>'categoryKind' = 'system' then 0
      when value->>'recordType' = 'diagnosis_category' then 1
      else 2
    end, value->>'masterKey'
  loop
    v_master_key := v_record->>'masterKey';
    v_record_type := v_record->>'recordType';
    select id into v_record_id from master.master_records
    where master_key = v_master_key for update;
    if found then
      if (select record_type from master.master_records where id = v_record_id) <> v_record_type then
        raise exception 'clinical_master_record_type_change_forbidden' using errcode = '23514';
      end if;
      update master.master_records
      set lifecycle_status = 'published', safety_status = 'normal', safety_reason = null,
          published_at = coalesce(published_at, pg_catalog.now()),
          updated_at = pg_catalog.now()
      where id = v_record_id;
    else
      v_record_id := extensions.gen_random_uuid();
      insert into master.master_records(
        id, master_key, record_type, lifecycle_status, safety_status, safety_reason,
        current_revision, current_release_id, published_at
      ) values (
        v_record_id, v_master_key, v_record_type, 'published', 'normal', null,
        1, v_release.id, pg_catalog.now()
      );
    end if;
  end loop;

  for v_record in
    select value from pg_catalog.jsonb_array_elements(v_payload->'records') records(value)
    where value->>'recordType' = 'diagnosis_category'
      and value->'detail'->>'categoryKind' = 'system'
  loop
    select id into v_record_id from master.master_records where master_key = v_record->>'masterKey';
    insert into master.diagnosis_categories(master_record_id, category_kind, parent_category_id, sort_order)
    values (v_record_id, 'system', null, coalesce((v_record->'detail'->>'sortOrder')::integer, 0))
    on conflict (master_record_id) do update
      set parent_category_id = null, sort_order = excluded.sort_order;
  end loop;

  for v_record in
    select value from pg_catalog.jsonb_array_elements(v_payload->'records') records(value)
    where value->>'recordType' = 'diagnosis_category'
      and value->'detail'->>'categoryKind' = 'disease_group'
  loop
    select id into v_record_id from master.master_records where master_key = v_record->>'masterKey';
    select id into v_parent_id from master.master_records
    where master_key = v_record->'detail'->>'parentMasterKey' and record_type = 'diagnosis_category';
    insert into master.diagnosis_categories(master_record_id, category_kind, parent_category_id, sort_order)
    values (v_record_id, 'disease_group', v_parent_id, coalesce((v_record->'detail'->>'sortOrder')::integer, 0))
    on conflict (master_record_id) do update
      set parent_category_id = excluded.parent_category_id, sort_order = excluded.sort_order;
  end loop;

  for v_record in
    select value from pg_catalog.jsonb_array_elements(v_payload->'records') records(value)
    where value->>'recordType' = 'diagnosis'
  loop
    select id into v_record_id from master.master_records where master_key = v_record->>'masterKey';
    insert into master.diagnoses(master_record_id) values (v_record_id)
    on conflict (master_record_id) do nothing;
    delete from master.diagnosis_category_links where diagnosis_record_id = v_record_id;
    for v_link in
      select value from pg_catalog.jsonb_array_elements(v_payload->'diagnosisCategoryLinks') links(value)
      where value->>'diagnosisMasterKey' = v_record->>'masterKey'
      order by (value->>'sortOrder')::integer, value->>'categoryMasterKey'
    loop
      select id into v_category_id from master.master_records
      where master_key = v_link->>'categoryMasterKey' and record_type = 'diagnosis_category';
      insert into master.diagnosis_category_links(
        diagnosis_record_id, diagnosis_category_id, is_primary, sort_order
      ) values (
        v_record_id, v_category_id, coalesce((v_link->>'isPrimary')::boolean, false),
        (v_link->>'sortOrder')::integer
      );
    end loop;
  end loop;

  -- Record names, source evidence, version snapshots, and review events share
  -- the same transaction and release identity.
  for v_record in
    select value from pg_catalog.jsonb_array_elements(v_payload->'records') records(value)
    order by case
      when value->>'recordType' = 'diagnosis_category'
        and value->'detail'->>'categoryKind' = 'system' then 0
      when value->>'recordType' = 'diagnosis_category' then 1
      else 2
    end, value->>'masterKey'
  loop
    select id, current_revision into v_record_id, v_revision
    from master.master_records where master_key = v_record->>'masterKey' for update;

    delete from master.master_record_names where master_record_id = v_record_id;
    for v_name in select value from pg_catalog.jsonb_array_elements(v_record->'names') names(value)
    loop
      insert into master.master_record_names(
        master_record_id, language_code, name_kind, name, normalized_name, searchable, sort_order
      ) values (
        v_record_id, v_name->>'languageCode', v_name->>'nameKind', v_name->>'name',
        pg_catalog.lower(pg_catalog.regexp_replace(pg_catalog.btrim(v_name->>'name'), '[[:space:]]+', ' ', 'g')),
        coalesce((v_name->>'searchable')::boolean, true), coalesce((v_name->>'sortOrder')::integer, 0)
      );
    end loop;

    v_source := v_record->'source';
    insert into master.master_sources(
      source_type, title, reference_uri, source_version, accessed_at, license_notes
    ) values (
      v_source->>'sourceType', v_source->>'title', nullif(v_source->>'referenceUri',''),
      nullif(v_source->>'sourceVersion',''), nullif(v_source->>'accessedAt','')::timestamptz,
      nullif(v_source->>'licenseNotes','')
    ) returning id into v_source_id;
    insert into master.master_record_sources(master_record_id, source_id, assertion_scope, notes)
    values (
      v_record_id, v_source_id,
      coalesce(nullif(v_record->>'sourceAssertionScope',''), 'synthetic diagnosis runtime demo'),
      nullif(v_record->>'sourceNotes','')
    );

    v_relation_snapshot := '{}'::jsonb;
    if v_record->>'recordType' = 'diagnosis_category' and v_record->'detail'->>'categoryKind' = 'disease_group' then
      select pg_catalog.jsonb_build_object(
        'parentMasterRecordId', parent.id,
        'parentMasterKey', parent.master_key,
        'parentRevision', parent.current_revision
      ) into v_relation_snapshot
      from master.master_records parent
      where parent.master_key = v_record->'detail'->>'parentMasterKey';
    elsif v_record->>'recordType' = 'diagnosis' then
      select pg_catalog.jsonb_build_object(
        'diagnosisCategoryLinks', coalesce(pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object(
            'categoryMasterRecordId', category.id,
            'categoryMasterKey', category.master_key,
            'categoryRevision', category.current_revision,
            'isPrimary', link.is_primary,
            'sortOrder', link.sort_order
          ) order by link.sort_order, category.master_key
        ), '[]'::jsonb)
      ) into v_relation_snapshot
      from master.diagnosis_category_links link
      join master.master_records category on category.id = link.diagnosis_category_id
      where link.diagnosis_record_id = v_record_id;
    end if;

    v_snapshot := (v_record - 'changeSummary' - 'sourceAssertionScope' - 'sourceNotes') || v_relation_snapshot;
    select snapshot, revision into v_latest_snapshot, v_latest_revision
    from master.master_record_versions
    where master_record_id = v_record_id
    order by revision desc limit 1;
    -- Every non-idempotent release receives a release-owned version for every
    -- included record. This keeps the deferrable current-version FK valid and
    -- makes historical payload adoption independent of later releases even
    -- when a particular record's content is unchanged.
    v_revision := case
      when v_latest_snapshot is null then 1
      else v_latest_revision + 1
    end;
    insert into master.master_record_versions(
      master_record_id, revision, release_id, snapshot, change_summary,
      authored_by_label, reviewed_by_label
    ) values (
      v_record_id, v_revision, v_release.id, v_snapshot || pg_catalog.jsonb_build_object('revision', v_revision),
      nullif(v_record->>'changeSummary',''), v_published_by_label, v_published_by_label
    );
    insert into master.master_review_events(
      master_record_id, revision, event_type, actor_user_id, actor_label, source_surface
    ) values
      (v_record_id, v_revision, 'authored', p_actor_user_id, v_published_by_label, 'publisher'),
      (v_record_id, v_revision, 'validated', p_actor_user_id, v_published_by_label, 'publisher'),
      (v_record_id, v_revision, 'published', p_actor_user_id, v_published_by_label, 'publisher');
    update master.master_records
    set current_revision = v_revision, current_release_id = v_release.id, updated_at = pg_catalog.now()
    where id = v_record_id;
  end loop;

  select count(*) into v_link_count from master.diagnosis_category_links link
  join master.master_records diagnosis on diagnosis.id = link.diagnosis_record_id
  where diagnosis.current_release_id = v_release.id;
  select count(*) into v_primary_count from master.diagnosis_category_links link
  join master.master_records diagnosis on diagnosis.id = link.diagnosis_record_id
  where diagnosis.current_release_id = v_release.id and link.is_primary;
  if v_link_count <> 12 or v_primary_count <> 12 then
    raise exception 'clinical_master_diagnosis_release_relation_count_invalid' using errcode = '23514';
  end if;

  perform pg_catalog.set_config('clinical_master.manifest_write_release_id', v_release.id::text, true);
  begin
    insert into private.clinical_master_release_payload_owner_manifest(
      release_id, master_record_id, master_key, record_type, included,
      base_content, relation_content, effective_revision, content_sha256
    )
    select
      v_release.id,
      owner.id,
      owner.master_key,
      owner.record_type,
      true,
      record.value - 'changeSummary' - 'sourceAssertionScope' - 'sourceNotes',
      case
        when owner.record_type = 'diagnosis' then
          pg_catalog.jsonb_build_object('diagnosisCategoryLinks', coalesce(version.snapshot->'diagnosisCategoryLinks', '[]'::jsonb))
        when owner.record_type = 'diagnosis_category' and record.value->'detail'->>'categoryKind' = 'disease_group' then
          pg_catalog.jsonb_build_object(
            'parentMasterRecordId', version.snapshot->'parentMasterRecordId',
            'parentMasterKey', version.snapshot->'parentMasterKey',
            'parentRevision', version.snapshot->'parentRevision'
          )
        else '{}'::jsonb
      end,
      owner.current_revision,
      private.clinical_master_payload_manifest_content_sha256(
        owner.id, owner.master_key, owner.record_type, true, owner.current_revision,
        record.value - 'changeSummary' - 'sourceAssertionScope' - 'sourceNotes',
        case
          when owner.record_type = 'diagnosis' then
            pg_catalog.jsonb_build_object('diagnosisCategoryLinks', coalesce(version.snapshot->'diagnosisCategoryLinks', '[]'::jsonb))
          when owner.record_type = 'diagnosis_category' and record.value->'detail'->>'categoryKind' = 'disease_group' then
            pg_catalog.jsonb_build_object(
              'parentMasterRecordId', version.snapshot->'parentMasterRecordId',
              'parentMasterKey', version.snapshot->'parentMasterKey',
              'parentRevision', version.snapshot->'parentRevision'
            )
          else '{}'::jsonb
        end
      )
    from pg_catalog.jsonb_array_elements(v_payload->'records') record(value)
    join master.master_records owner on owner.master_key = record.value->>'masterKey'
    join master.master_record_versions version
      on version.master_record_id = owner.id and version.revision = owner.current_revision;
  exception when others then
    perform pg_catalog.set_config('clinical_master.manifest_write_release_id', '', true);
    raise;
  end;
  perform pg_catalog.set_config('clinical_master.manifest_write_release_id', '', true);
  if (select count(*) from private.clinical_master_release_payload_owner_manifest where release_id = v_release.id) <> v_record_count then
    raise exception 'clinical_master_diagnosis_payload_owner_manifest_invalid' using errcode = '23503';
  end if;

  update master.master_releases
  set status = 'published', published_at = pg_catalog.now()
  where id = v_release.id;

  return pg_catalog.jsonb_build_object(
    'releaseId', v_release.id,
    'releaseNo', v_release.release_no,
    'sourceFingerprint', v_fingerprint,
    'idempotent', false,
    'recordCount', v_record_count,
    'systemCount', v_system_count,
    'diseaseGroupCount', v_group_count,
    'diagnosisCount', v_diagnosis_count,
    'linkCount', v_link_count
  );
end;
$$;

revoke all on function private.publish_clinical_master_diagnosis_release(jsonb, uuid)
  from public, anon, authenticated, service_role;

comment on function private.publish_clinical_master_diagnosis_release(jsonb, uuid) is
  'Atomic, idempotent publisher for synthetic diagnosis categories, diagnoses, and primary category links.';

-- Extend the established entry point without changing legacy canonicalization
-- or fingerprints. Diagnosis-only payloads take the dedicated atomic path;
-- legacy/order/lab payloads execute the previous wrapper byte-for-byte.
create or replace function private.publish_clinical_master_release(
  p_payload jsonb,
  p_actor_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, master, extensions, pg_catalog
as $$
declare
  v_payload jsonb;
  v_scope text;
  v_result jsonb;
  v_release_scope text;
  v_diagnosis_record_count integer;
  v_other_record_count integer;
begin
  if p_payload is null or pg_catalog.jsonb_typeof(p_payload) <> 'object' then
    raise exception 'clinical_master_payload_object_required' using errcode = '22023';
  end if;
  select
    count(*) filter (where value->>'recordType' in ('diagnosis_category','diagnosis')),
    count(*) filter (where value->>'recordType' not in ('diagnosis_category','diagnosis'))
  into v_diagnosis_record_count, v_other_record_count
  from pg_catalog.jsonb_array_elements(coalesce(p_payload->'records','[]'::jsonb)) records(value);
  if v_diagnosis_record_count > 0 then
    if v_other_record_count > 0 then
      raise exception 'clinical_master_diagnosis_release_must_be_isolated' using errcode = '22023';
    end if;
    v_result := private.publish_clinical_master_diagnosis_release(p_payload, p_actor_user_id);
    return v_result || pg_catalog.jsonb_build_object('adoptionScope', 'payload');
  end if;

  perform private.clinical_master_assert_contract_keys('payload', p_payload);
  v_payload := private.clinical_master_canonicalize_payload(p_payload);
  v_scope := coalesce(nullif(pg_catalog.btrim(v_payload->>'adoptionScope'), ''), 'cumulative');
  perform pg_catalog.set_config('clinical_master.adoption_scope', v_scope, true);
  begin
    v_result := private.publish_clinical_master_release_cumulative(v_payload, p_actor_user_id);
  exception when others then
    perform pg_catalog.set_config('clinical_master.adoption_scope', '', true);
    raise;
  end;
  perform pg_catalog.set_config('clinical_master.adoption_scope', '', true);
  select adoption_scope into v_release_scope
  from master.master_releases
  where id = (v_result->>'releaseId')::uuid;
  if v_release_scope is distinct from v_scope then
    raise exception 'clinical_master_release_adoption_scope_persist_failed' using errcode = '55000';
  end if;
  if v_scope = 'payload' then
    perform pg_catalog.set_config('clinical_master.manifest_write_release_id', v_result->>'releaseId', true);
    begin
      insert into private.clinical_master_release_payload_owner_manifest(
        release_id, master_record_id, master_key, record_type, included,
        base_content, relation_content, effective_revision, content_sha256
      )
      select stage.release_id, stage.master_record_id, stage.master_key,
        stage.record_type, stage.included, stage.base_content,
        stage.relation_content, stage.effective_revision,
        private.clinical_master_payload_manifest_content_sha256(
          stage.master_record_id, stage.master_key, stage.record_type,
          stage.included, stage.effective_revision,
          stage.base_content, stage.relation_content
        )
      from private.clinical_master_lab_publish_stage stage
      where stage.release_id = (v_result->>'releaseId')::uuid
      on conflict (release_id, master_record_id) do nothing;
    exception when others then
      perform pg_catalog.set_config('clinical_master.manifest_write_release_id', '', true);
      raise;
    end;
    perform pg_catalog.set_config('clinical_master.manifest_write_release_id', '', true);
    if (select count(*) from private.clinical_master_release_payload_owner_manifest manifest
        where manifest.release_id = (v_result->>'releaseId')::uuid)
       is distinct from (select record_count from master.master_releases where id = (v_result->>'releaseId')::uuid)
       or exists (
         select 1
         from private.clinical_master_lab_publish_stage stage
         left join private.clinical_master_release_payload_owner_manifest manifest
           on manifest.release_id = stage.release_id and manifest.master_record_id = stage.master_record_id
         where stage.release_id = (v_result->>'releaseId')::uuid
           and (manifest.master_record_id is null
             or manifest.master_key is distinct from stage.master_key
             or manifest.record_type is distinct from stage.record_type
             or manifest.included is distinct from stage.included
             or manifest.base_content is distinct from stage.base_content
             or manifest.relation_content is distinct from stage.relation_content
             or manifest.effective_revision is distinct from stage.effective_revision
             or manifest.content_sha256 is distinct from private.clinical_master_payload_manifest_content_sha256(
               stage.master_record_id, stage.master_key, stage.record_type,
               stage.included, stage.effective_revision, stage.base_content, stage.relation_content
             ))
       ) then
      raise exception 'clinical_master_release_payload_owner_manifest_invalid' using errcode = '23503';
    end if;
  end if;
  return v_result || pg_catalog.jsonb_build_object('adoptionScope', v_scope);
end;
$$;

revoke all on function private.publish_clinical_master_release(jsonb, uuid)
  from public, anon, authenticated, service_role;

alter table public.diagnosis_catalog
  alter column workspace_id set not null,
  add column if not exists source_master_record_id uuid references master.master_records(id) on delete restrict,
  add column if not exists master_revision integer,
  add column if not exists catalog_revision integer not null default 1,
  add column if not exists first_adopted_revision integer,
  add column if not exists last_applied_revision integer,
  add column if not exists system_master_record_id uuid references master.master_records(id) on delete restrict,
  add column if not exists system_name text,
  add column if not exists disease_group_master_record_id uuid references master.master_records(id) on delete restrict,
  add column if not exists disease_group_name text,
  add column if not exists source_projection_snapshot jsonb,
  add column if not exists source_projection_fingerprint text,
  add column if not exists availability_state text not null default 'active',
  add column if not exists customization_state text not null default 'unmodified',
  add column if not exists merge_state text not null default 'synced';

alter table public.diagnosis_catalog
  drop constraint if exists diagnosis_catalog_master_revision_check,
  add constraint diagnosis_catalog_master_revision_check check (master_revision is null or master_revision > 0),
  drop constraint if exists diagnosis_catalog_catalog_revision_check,
  add constraint diagnosis_catalog_catalog_revision_check check (catalog_revision > 0),
  drop constraint if exists diagnosis_catalog_first_adopted_revision_check,
  add constraint diagnosis_catalog_first_adopted_revision_check check (first_adopted_revision is null or first_adopted_revision > 0),
  drop constraint if exists diagnosis_catalog_last_applied_revision_check,
  add constraint diagnosis_catalog_last_applied_revision_check check (last_applied_revision is null or last_applied_revision > 0),
  drop constraint if exists diagnosis_catalog_source_projection_snapshot_check,
  add constraint diagnosis_catalog_source_projection_snapshot_check check (source_projection_snapshot is null or pg_catalog.jsonb_typeof(source_projection_snapshot) = 'object'),
  drop constraint if exists diagnosis_catalog_source_projection_fingerprint_check,
  add constraint diagnosis_catalog_source_projection_fingerprint_check check (source_projection_fingerprint is null or source_projection_fingerprint ~ '^[0-9a-f]{64}$'),
  drop constraint if exists diagnosis_catalog_availability_state_check,
  add constraint diagnosis_catalog_availability_state_check check (availability_state in ('active','inactive')),
  drop constraint if exists diagnosis_catalog_customization_state_check,
  add constraint diagnosis_catalog_customization_state_check check (customization_state in ('unmodified','customized')),
  drop constraint if exists diagnosis_catalog_merge_state_check,
  add constraint diagnosis_catalog_merge_state_check check (merge_state in ('synced','review_required'));

create unique index if not exists diagnosis_catalog_workspace_source_master_key
  on public.diagnosis_catalog(workspace_id, source_master_record_id)
  where source_master_record_id is not null;
drop index if exists public.diagnosis_catalog_workspace_id_key;
do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.diagnosis_catalog'::pg_catalog.regclass
      and conname = 'diagnosis_catalog_workspace_id_unique'
  ) then
    alter table public.diagnosis_catalog
      add constraint diagnosis_catalog_workspace_id_unique unique(workspace_id, id);
  end if;
end
$$;
create index if not exists diagnosis_catalog_workspace_classification_idx
  on public.diagnosis_catalog(workspace_id, system_master_record_id, disease_group_master_record_id, availability_state, name, id);

comment on table public.diagnosis_catalog is
  'Workspace-owned diagnosis projection. Canonical lineage is retained while workspace availability and customization remain local.';

alter table public.diagnosis_catalog enable row level security;
revoke all on public.diagnosis_catalog from anon, authenticated, service_role;

create table if not exists public.diagnosis_catalog_classifications (
  workspace_id text not null references public.workspaces(id) on delete cascade,
  diagnosis_catalog_id uuid not null,
  system_master_record_id uuid not null references master.master_records(id) on delete restrict,
  system_name text not null check (pg_catalog.length(pg_catalog.btrim(system_name)) > 0),
  disease_group_master_record_id uuid not null references master.master_records(id) on delete restrict,
  disease_group_name text not null check (pg_catalog.length(pg_catalog.btrim(disease_group_name)) > 0),
  disease_group_master_revision integer not null check (disease_group_master_revision > 0),
  system_master_revision integer not null check (system_master_revision > 0),
  is_primary boolean not null default false,
  sort_order integer not null default 0 check (sort_order >= 0),
  source_projection_snapshot jsonb not null check (pg_catalog.jsonb_typeof(source_projection_snapshot) = 'object'),
  source_projection_fingerprint text not null check (source_projection_fingerprint ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  primary key (workspace_id, diagnosis_catalog_id, disease_group_master_record_id),
  foreign key (workspace_id, diagnosis_catalog_id)
    references public.diagnosis_catalog(workspace_id, id) on delete cascade
);

create unique index if not exists diagnosis_catalog_classifications_one_primary_key
  on public.diagnosis_catalog_classifications(workspace_id, diagnosis_catalog_id)
  where is_primary;
create unique index if not exists diagnosis_catalog_classifications_sort_order_key
  on public.diagnosis_catalog_classifications(workspace_id, diagnosis_catalog_id, sort_order);
create index if not exists diagnosis_catalog_classifications_filter_idx
  on public.diagnosis_catalog_classifications(workspace_id, system_master_record_id, disease_group_master_record_id, diagnosis_catalog_id);

alter table public.diagnosis_catalog_classifications enable row level security;
revoke all on public.diagnosis_catalog_classifications from anon, authenticated, service_role;

comment on table public.diagnosis_catalog_classifications is
  'Workspace-scoped, lossless diagnosis classification projection. Catalog system/group columns cache the primary classification only.';

create table if not exists private.clinical_master_diagnosis_adoption_events (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id text not null references public.workspaces(id) on delete restrict,
  release_id uuid not null references master.master_releases(id) on delete restrict,
  payload_fingerprint text not null check (payload_fingerprint ~ '^[0-9a-f]{64}$'),
  before_count integer not null check (before_count >= 0),
  after_count integer not null check (after_count >= 0),
  before_fingerprint text not null check (before_fingerprint ~ '^[0-9a-f]{64}$'),
  after_fingerprint text not null check (after_fingerprint ~ '^[0-9a-f]{64}$'),
  operation_label text not null check (pg_catalog.length(pg_catalog.btrim(operation_label)) > 0),
  created_at timestamptz not null default pg_catalog.now()
);

revoke all on private.clinical_master_diagnosis_adoption_events
  from public, anon, authenticated, service_role;

create or replace function private.reject_clinical_master_diagnosis_adoption_event_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'clinical_master_diagnosis_adoption_event_immutable' using errcode = '55000';
end;
$$;
revoke all on function private.reject_clinical_master_diagnosis_adoption_event_mutation()
  from public, anon, authenticated, service_role;
drop trigger if exists clinical_master_diagnosis_adoption_event_immutable
  on private.clinical_master_diagnosis_adoption_events;
create trigger clinical_master_diagnosis_adoption_event_immutable
before update or delete on private.clinical_master_diagnosis_adoption_events
for each row execute function private.reject_clinical_master_diagnosis_adoption_event_mutation();

create or replace function private.clair_adopt_diagnosis_release_to_workspace(
  p_workspace_id text,
  p_release_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_release master.master_releases%rowtype;
  v_row record;
  v_classification record;
  v_catalog_id uuid;
  v_customization_state text;
  v_existing_fingerprint text;
  v_projection jsonb;
  v_fingerprint text;
  v_adopted integer := 0;
  v_before_count integer;
  v_after_count integer;
  v_before_fingerprint text;
  v_after_fingerprint text;
begin
  if p_workspace_id not in (
    'workspace-clinical-master-pilot-v1',
    'workspace-clair-cheongdam',
    'clair-demo'
  ) then
    raise exception 'diagnosis_catalog_workspace_not_allowlisted' using errcode = '42501';
  end if;
  if not exists (select 1 from public.workspaces where id = p_workspace_id) then
    raise exception 'diagnosis_catalog_workspace_missing' using errcode = '23503';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('clinical_master_phase_1a_1_publication', 0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('clinical_master_phase_1a1_publication', 0));
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('clinical_master_diagnosis_workspace_adoption:' || p_workspace_id, 0)
  );
  select * into v_release from master.master_releases where id = p_release_id and status = 'published';
  if not found or not exists (
    select 1 from private.clinical_master_diagnosis_release_payloads where release_id = p_release_id
  ) then
    raise exception 'diagnosis_catalog_release_unavailable' using errcode = '22023';
  end if;
  if v_release.record_count <> 24
    or (select count(*) from private.clinical_master_release_payload_owner_manifest
        where release_id = p_release_id) <> 24
    or (select count(*) from private.clinical_master_release_payload_owner_manifest
        where release_id = p_release_id and record_type = 'diagnosis') <> 12
    or (select count(*) from private.clinical_master_release_payload_owner_manifest
        where release_id = p_release_id and record_type = 'diagnosis_category'
          and base_content->'detail'->>'categoryKind' = 'system') <> 6
    or (select count(*) from private.clinical_master_release_payload_owner_manifest
        where release_id = p_release_id and record_type = 'diagnosis_category'
          and base_content->'detail'->>'categoryKind' = 'disease_group') <> 6
    or exists (
      select 1
      from private.clinical_master_release_payload_owner_manifest manifest
      left join master.master_record_versions version
        on version.master_record_id = manifest.master_record_id
       and version.revision = manifest.effective_revision
      where manifest.release_id = p_release_id
        and (
          not manifest.included
          or manifest.content_sha256 is distinct from
            private.clinical_master_payload_manifest_content_sha256(
              manifest.master_record_id,
              manifest.master_key,
              manifest.record_type,
              manifest.included,
              manifest.effective_revision,
              manifest.base_content,
              manifest.relation_content
            )
          or version.snapshot is null
          or (version.snapshot - 'revision') is distinct from
            (manifest.base_content || manifest.relation_content)
        )
    ) then
    raise exception 'diagnosis_catalog_release_manifest_invalid' using errcode = '23503';
  end if;

  perform 1
  from public.diagnosis_catalog
  where workspace_id = p_workspace_id
  order by id
  for update;
  select count(*), private.clinical_master_sha256(coalesce(pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object(
      'id', id, 'sourceMasterRecordId', source_master_record_id,
      'sourceRevision', master_revision, 'catalogRevision', catalog_revision, 'availability', availability_state,
      'customization', customization_state, 'merge', merge_state,
      'sourceFingerprint', source_projection_fingerprint
    ) order by id
  ), '[]'::jsonb))
  into v_before_count, v_before_fingerprint
  from public.diagnosis_catalog where workspace_id = p_workspace_id;

  for v_row in
    select
      diagnosis_manifest.master_record_id as diagnosis_id,
      diagnosis_manifest.master_key,
      diagnosis_manifest.effective_revision as current_revision,
      version.snapshot,
      diagnosis_manifest.relation_content,
      coalesce((
        select name.value->>'name'
        from pg_catalog.jsonb_array_elements(diagnosis_manifest.base_content->'names') name(value)
        where name.value->>'languageCode' = 'ko'
          and name.value->>'nameKind' = 'preferred'
        order by coalesce((name.value->>'sortOrder')::integer, 0), name.value->>'name'
        limit 1
      ), diagnosis_manifest.master_key) as diagnosis_name,
      coalesce((
        select pg_catalog.array_agg(name.value->>'name'
          order by coalesce((name.value->>'sortOrder')::integer, 0), name.value->>'name')
        from pg_catalog.jsonb_array_elements(diagnosis_manifest.base_content->'names') name(value)
        where name.value->>'nameKind' <> 'preferred'
          and coalesce((name.value->>'searchable')::boolean, true)
      ), '{}'::text[]) as synonyms,
      disease_group_manifest.master_record_id as disease_group_id,
      coalesce((
        select name.value->>'name'
        from pg_catalog.jsonb_array_elements(disease_group_manifest.base_content->'names') name(value)
        where name.value->>'languageCode' = 'ko'
          and name.value->>'nameKind' = 'preferred'
        order by coalesce((name.value->>'sortOrder')::integer, 0), name.value->>'name'
        limit 1
      ), disease_group_manifest.master_key) as disease_group_name,
      system_manifest.master_record_id as system_id,
      coalesce((
        select name.value->>'name'
        from pg_catalog.jsonb_array_elements(system_manifest.base_content->'names') name(value)
        where name.value->>'languageCode' = 'ko'
          and name.value->>'nameKind' = 'preferred'
        order by coalesce((name.value->>'sortOrder')::integer, 0), name.value->>'name'
        limit 1
      ), system_manifest.master_key) as system_name
    from private.clinical_master_release_payload_owner_manifest diagnosis_manifest
    join master.master_record_versions version
      on version.master_record_id = diagnosis_manifest.master_record_id
     and version.revision = diagnosis_manifest.effective_revision
    cross join lateral pg_catalog.jsonb_array_elements(
      diagnosis_manifest.relation_content->'diagnosisCategoryLinks'
    ) primary_link(value)
    join private.clinical_master_release_payload_owner_manifest disease_group_manifest
      on disease_group_manifest.release_id = diagnosis_manifest.release_id
     and disease_group_manifest.master_record_id = (primary_link.value->>'categoryMasterRecordId')::uuid
     and disease_group_manifest.record_type = 'diagnosis_category'
    join private.clinical_master_release_payload_owner_manifest system_manifest
      on system_manifest.release_id = diagnosis_manifest.release_id
     and system_manifest.master_record_id =
       (disease_group_manifest.relation_content->>'parentMasterRecordId')::uuid
     and system_manifest.record_type = 'diagnosis_category'
    where diagnosis_manifest.release_id = p_release_id
      and diagnosis_manifest.record_type = 'diagnosis'
      and diagnosis_manifest.included
      and coalesce((primary_link.value->>'isPrimary')::boolean, false)
    order by diagnosis_manifest.master_key
  loop
    v_projection := pg_catalog.jsonb_build_object(
      'source', 'clinical-master',
      'sourceMasterRecordId', v_row.diagnosis_id,
      'masterKey', v_row.master_key,
      'masterRevision', v_row.current_revision,
      'code', null,
      'name', v_row.diagnosis_name,
      'synonyms', pg_catalog.to_jsonb(v_row.synonyms),
      'system', pg_catalog.jsonb_build_object('id', v_row.system_id, 'name', v_row.system_name),
      'diseaseGroup', pg_catalog.jsonb_build_object('id', v_row.disease_group_id, 'name', v_row.disease_group_name),
      'sourceVersionSnapshot', v_row.snapshot
    );
    v_fingerprint := private.clinical_master_sha256(v_projection);
    v_existing_fingerprint := null;
    select source_projection_fingerprint into v_existing_fingerprint
    from public.diagnosis_catalog
    where workspace_id = p_workspace_id
      and source_master_record_id = v_row.diagnosis_id;
    insert into public.diagnosis_catalog(
      workspace_id, code, name, synonyms, is_active,
      source_master_record_id, master_revision, first_adopted_revision, last_applied_revision,
      system_master_record_id, system_name, disease_group_master_record_id, disease_group_name,
      source_projection_snapshot, source_projection_fingerprint,
      availability_state, customization_state, merge_state, updated_at
    ) values (
      p_workspace_id, null, v_row.diagnosis_name, v_row.synonyms, true,
      v_row.diagnosis_id, v_row.current_revision, v_row.current_revision, v_row.current_revision,
      v_row.system_id, v_row.system_name, v_row.disease_group_id, v_row.disease_group_name,
      v_projection, v_fingerprint, 'active', 'unmodified', 'synced', pg_catalog.now()
    )
    on conflict (workspace_id, source_master_record_id) where source_master_record_id is not null
    do update set
      code = case when diagnosis_catalog.customization_state = 'unmodified' then excluded.code else diagnosis_catalog.code end,
      name = case when diagnosis_catalog.customization_state = 'unmodified' then excluded.name else diagnosis_catalog.name end,
      synonyms = case when diagnosis_catalog.customization_state = 'unmodified' then excluded.synonyms else diagnosis_catalog.synonyms end,
      is_active = case when diagnosis_catalog.customization_state = 'unmodified' then true else diagnosis_catalog.is_active end,
      master_revision = excluded.master_revision,
      last_applied_revision = case when diagnosis_catalog.customization_state = 'unmodified' then excluded.last_applied_revision else diagnosis_catalog.last_applied_revision end,
      system_master_record_id = case when diagnosis_catalog.customization_state = 'unmodified' then excluded.system_master_record_id else diagnosis_catalog.system_master_record_id end,
      system_name = case when diagnosis_catalog.customization_state = 'unmodified' then excluded.system_name else diagnosis_catalog.system_name end,
      disease_group_master_record_id = case when diagnosis_catalog.customization_state = 'unmodified' then excluded.disease_group_master_record_id else diagnosis_catalog.disease_group_master_record_id end,
      disease_group_name = case when diagnosis_catalog.customization_state = 'unmodified' then excluded.disease_group_name else diagnosis_catalog.disease_group_name end,
      source_projection_snapshot = excluded.source_projection_snapshot,
      catalog_revision = case
        when diagnosis_catalog.source_projection_fingerprint is distinct from excluded.source_projection_fingerprint
          and diagnosis_catalog.customization_state = 'unmodified'
        then diagnosis_catalog.catalog_revision + 1
        else diagnosis_catalog.catalog_revision
      end,
      source_projection_fingerprint = excluded.source_projection_fingerprint,
      availability_state = case when diagnosis_catalog.customization_state = 'unmodified' then 'active' else diagnosis_catalog.availability_state end,
      merge_state = case when diagnosis_catalog.customization_state = 'unmodified' then 'synced' else 'review_required' end,
      updated_at = pg_catalog.now()
    where diagnosis_catalog.master_revision is distinct from excluded.master_revision
      or diagnosis_catalog.source_projection_fingerprint is distinct from excluded.source_projection_fingerprint
      or diagnosis_catalog.merge_state is distinct from (
        case when diagnosis_catalog.customization_state = 'unmodified' then 'synced' else 'review_required' end
      )
      or (
        diagnosis_catalog.customization_state = 'unmodified'
        and (
          diagnosis_catalog.code is distinct from excluded.code
          or diagnosis_catalog.name is distinct from excluded.name
          or diagnosis_catalog.synonyms is distinct from excluded.synonyms
          or not diagnosis_catalog.is_active
          or diagnosis_catalog.availability_state is distinct from 'active'
          or diagnosis_catalog.system_master_record_id is distinct from excluded.system_master_record_id
          or diagnosis_catalog.system_name is distinct from excluded.system_name
          or diagnosis_catalog.disease_group_master_record_id is distinct from excluded.disease_group_master_record_id
          or diagnosis_catalog.disease_group_name is distinct from excluded.disease_group_name
        )
      );

    select id, customization_state into v_catalog_id, v_customization_state
    from public.diagnosis_catalog
    where workspace_id = p_workspace_id and source_master_record_id = v_row.diagnosis_id;
    if v_customization_state = 'unmodified'
      and (
        v_existing_fingerprint is distinct from v_fingerprint
        or not exists (
          select 1 from public.diagnosis_catalog_classifications
          where workspace_id = p_workspace_id and diagnosis_catalog_id = v_catalog_id
        )
      ) then
      delete from public.diagnosis_catalog_classifications
      where workspace_id = p_workspace_id and diagnosis_catalog_id = v_catalog_id;
      for v_classification in
      select
        system_manifest.master_record_id as system_id,
        coalesce((
          select name.value->>'name'
          from pg_catalog.jsonb_array_elements(system_manifest.base_content->'names') name(value)
          where name.value->>'languageCode' = 'ko'
            and name.value->>'nameKind' = 'preferred'
          order by coalesce((name.value->>'sortOrder')::integer, 0), name.value->>'name'
          limit 1
        ), system_manifest.master_key) as system_name,
        system_manifest.effective_revision as system_revision,
        disease_group_manifest.master_record_id as disease_group_id,
        coalesce((
          select name.value->>'name'
          from pg_catalog.jsonb_array_elements(disease_group_manifest.base_content->'names') name(value)
          where name.value->>'languageCode' = 'ko'
            and name.value->>'nameKind' = 'preferred'
          order by coalesce((name.value->>'sortOrder')::integer, 0), name.value->>'name'
          limit 1
        ), disease_group_manifest.master_key) as disease_group_name,
        disease_group_manifest.effective_revision as disease_group_revision,
        coalesce((link.value->>'isPrimary')::boolean, false) as is_primary,
        (link.value->>'sortOrder')::integer as sort_order
      from pg_catalog.jsonb_array_elements(
        v_row.relation_content->'diagnosisCategoryLinks'
      ) link(value)
      join private.clinical_master_release_payload_owner_manifest disease_group_manifest
        on disease_group_manifest.release_id = p_release_id
       and disease_group_manifest.master_record_id = (link.value->>'categoryMasterRecordId')::uuid
       and disease_group_manifest.record_type = 'diagnosis_category'
      join private.clinical_master_release_payload_owner_manifest system_manifest
        on system_manifest.release_id = p_release_id
       and system_manifest.master_record_id =
         (disease_group_manifest.relation_content->>'parentMasterRecordId')::uuid
       and system_manifest.record_type = 'diagnosis_category'
      order by (link.value->>'sortOrder')::integer, disease_group_manifest.master_key
      loop
      v_projection := pg_catalog.jsonb_build_object(
        'diagnosisCatalogId', v_catalog_id,
        'systemMasterRecordId', v_classification.system_id,
        'systemRevision', v_classification.system_revision,
        'systemLabel', v_classification.system_name,
        'diseaseGroupMasterRecordId', v_classification.disease_group_id,
        'diseaseGroupRevision', v_classification.disease_group_revision,
        'diseaseGroupLabel', v_classification.disease_group_name,
        'isPrimary', v_classification.is_primary,
        'sortOrder', v_classification.sort_order
      );
      insert into public.diagnosis_catalog_classifications(
        workspace_id, diagnosis_catalog_id,
        system_master_record_id, system_name,
        disease_group_master_record_id, disease_group_name,
        disease_group_master_revision, system_master_revision,
        is_primary, sort_order, source_projection_snapshot, source_projection_fingerprint
      ) values (
        p_workspace_id, v_catalog_id,
        v_classification.system_id, v_classification.system_name,
        v_classification.disease_group_id, v_classification.disease_group_name,
        v_classification.disease_group_revision, v_classification.system_revision,
        v_classification.is_primary, v_classification.sort_order,
        v_projection, private.clinical_master_sha256(v_projection)
      );
      end loop;
    end if;
    v_adopted := v_adopted + 1;
  end loop;

  update public.diagnosis_catalog catalog
  set is_active = false, availability_state = 'inactive', updated_at = pg_catalog.now()
  where catalog.workspace_id = p_workspace_id
    and catalog.source_master_record_id is not null
    and catalog.customization_state = 'unmodified'
    and not exists (
      select 1
      from private.clinical_master_release_payload_owner_manifest source
      where source.release_id = p_release_id
        and source.master_record_id = catalog.source_master_record_id
        and source.record_type = 'diagnosis'
        and source.included
    );

  if v_adopted <> 12 then
    raise exception 'diagnosis_catalog_expected_twelve_rows' using errcode = '23514';
  end if;
  select count(*), private.clinical_master_sha256(coalesce(pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object(
      'id', id, 'sourceMasterRecordId', source_master_record_id,
      'sourceRevision', master_revision, 'catalogRevision', catalog_revision, 'availability', availability_state,
      'customization', customization_state, 'merge', merge_state,
      'sourceFingerprint', source_projection_fingerprint
    ) order by id
  ), '[]'::jsonb))
  into v_after_count, v_after_fingerprint
  from public.diagnosis_catalog where workspace_id = p_workspace_id;
  insert into private.clinical_master_diagnosis_adoption_events(
    workspace_id, release_id, payload_fingerprint,
    before_count, after_count, before_fingerprint, after_fingerprint, operation_label
  ) values (
    p_workspace_id, p_release_id, v_release.source_fingerprint,
    v_before_count, v_after_count, v_before_fingerprint, v_after_fingerprint,
    'synthetic-diagnosis-runtime-adoption'
  );
  return pg_catalog.jsonb_build_object(
    'workspaceId', p_workspace_id,
    'releaseId', p_release_id,
    'adoptedCount', v_adopted
  );
end;
$$;

revoke all on function private.clair_adopt_diagnosis_release_to_workspace(text, uuid)
  from public, anon, authenticated, service_role;

comment on function private.clair_adopt_diagnosis_release_to_workspace(text, uuid) is
  'Idempotent diagnosis adoption writer restricted to the three approved synthetic demo workspaces.';

create or replace function public.clair_search_diagnosis_catalog(
  p_workspace_id text,
  p_query text default null,
  p_system_id uuid default null,
  p_disease_group_id uuid default null,
  p_cursor text default null,
  p_limit integer default 50
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 50);
  v_cursor_parts text[];
  v_cursor_name text;
  v_cursor_id uuid;
  v_rows jsonb;
  v_systems jsonb;
  v_groups jsonb;
  v_next_cursor text;
begin
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing' using errcode = '42501';
  end if;
  if not private.clair_current_user_has_workspace_permission(p_workspace_id, 'chart:view') then
    raise exception 'permission_missing' using errcode = '42501';
  end if;
  if pg_catalog.length(coalesce(p_query, '')) > 120 then
    raise exception 'diagnosis_catalog_query_too_long' using errcode = '22023';
  end if;
  if p_cursor is not null then
    v_cursor_parts := pg_catalog.regexp_match(
      p_cursor,
      '^(.*)\|([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$',
      'i'
    );
    if v_cursor_parts is null or pg_catalog.length(v_cursor_parts[1]) = 0
      or pg_catalog.length(v_cursor_parts[1]) > 120 or pg_catalog.length(p_cursor) > 200 then
      raise exception 'diagnosis_catalog_cursor_invalid' using errcode = '22023';
    end if;
    v_cursor_name := v_cursor_parts[1];
    v_cursor_id := v_cursor_parts[2]::uuid;
  end if;

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id', systems.system_master_record_id,
    'name', systems.system_name,
    'count', systems.item_count
  ) order by systems.system_name, systems.system_master_record_id), '[]'::jsonb)
  into v_systems
  from (
    select classification.system_master_record_id, classification.system_name,
      count(distinct classification.diagnosis_catalog_id)::integer item_count
    from public.diagnosis_catalog_classifications classification
    join public.diagnosis_catalog catalog
      on catalog.workspace_id = classification.workspace_id and catalog.id = classification.diagnosis_catalog_id
    where classification.workspace_id = p_workspace_id and catalog.is_active and catalog.availability_state = 'active'
    group by classification.system_master_record_id, classification.system_name
  ) systems;

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id', groups.disease_group_master_record_id,
    'name', groups.disease_group_name,
    'systemId', groups.system_master_record_id,
    'count', groups.item_count
  ) order by groups.disease_group_name, groups.disease_group_master_record_id), '[]'::jsonb)
  into v_groups
  from (
    select classification.disease_group_master_record_id, classification.disease_group_name,
      classification.system_master_record_id,
      count(distinct classification.diagnosis_catalog_id)::integer item_count
    from public.diagnosis_catalog_classifications classification
    join public.diagnosis_catalog catalog
      on catalog.workspace_id = classification.workspace_id and catalog.id = classification.diagnosis_catalog_id
    where classification.workspace_id = p_workspace_id and catalog.is_active and catalog.availability_state = 'active'
      and (p_system_id is null or classification.system_master_record_id = p_system_id)
    group by classification.disease_group_master_record_id, classification.disease_group_name, classification.system_master_record_id
  ) groups;

  with candidates as (
    select catalog.*
    from public.diagnosis_catalog catalog
    where catalog.workspace_id = p_workspace_id
      and catalog.is_active and catalog.availability_state = 'active'
      and ((p_system_id is null and p_disease_group_id is null) or exists (
        select 1 from public.diagnosis_catalog_classifications classification
        where classification.workspace_id = catalog.workspace_id
          and classification.diagnosis_catalog_id = catalog.id
          and (p_system_id is null or classification.system_master_record_id = p_system_id)
          and (p_disease_group_id is null or classification.disease_group_master_record_id = p_disease_group_id)
      ))
      and (
        nullif(pg_catalog.btrim(coalesce(p_query,'')), '') is null
        or catalog.name ilike '%' || pg_catalog.btrim(p_query) || '%'
        or coalesce(catalog.code,'') ilike '%' || pg_catalog.btrim(p_query) || '%'
        or exists (select 1 from pg_catalog.unnest(coalesce(catalog.synonyms, '{}'::text[])) synonym where synonym ilike '%' || pg_catalog.btrim(p_query) || '%')
      )
      and (
        v_cursor_id is null
        or (pg_catalog.lower(catalog.name), catalog.id) > (v_cursor_name, v_cursor_id)
      )
    order by pg_catalog.lower(catalog.name), catalog.id
    limit v_limit + 1
  ), page as (
    select * from candidates
    order by pg_catalog.lower(name), id
    limit v_limit
  )
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'catalogId', page.id,
      'masterId', page.source_master_record_id,
      'masterRevision', page.master_revision,
      'code', page.code,
      'name', page.name,
      'synonyms', pg_catalog.to_jsonb(coalesce(page.synonyms, '{}'::text[])),
      'system', pg_catalog.jsonb_build_object('id', page.system_master_record_id, 'name', page.system_name),
      'diseaseGroup', pg_catalog.jsonb_build_object('id', page.disease_group_master_record_id, 'name', page.disease_group_name)
    ) order by pg_catalog.lower(page.name), page.id), '[]'::jsonb),
    case when (select count(*) from candidates) > v_limit
      then (select pg_catalog.lower(name) || '|' || id::text from page order by pg_catalog.lower(name) desc, id desc limit 1)
      else null end
  into v_rows, v_next_cursor
  from page;

  return pg_catalog.jsonb_build_object(
    'systems', v_systems,
    'diseaseGroups', v_groups,
    'diagnoses', v_rows,
    'nextCursor', v_next_cursor
  );
end;
$$;

revoke all on function public.clair_search_diagnosis_catalog(text,text,uuid,uuid,text,integer)
  from public, anon;
grant execute on function public.clair_search_diagnosis_catalog(text,text,uuid,uuid,text,integer)
  to authenticated;

comment on function public.clair_search_diagnosis_catalog(text,text,uuid,uuid,text,integer) is
  'Route-owned workspace diagnosis catalog search; requires active membership and chart:view.';

alter table public.diagnoses
  add column if not exists diagnosis_catalog_revision integer,
  add column if not exists diagnosis_snapshot jsonb;

alter table public.diagnoses
  drop constraint if exists diagnoses_workspace_catalog_fk,
  add constraint diagnoses_workspace_catalog_fk
    foreign key (workspace_id, diagnosis_catalog_id)
    references public.diagnosis_catalog(workspace_id, id)
    on delete restrict
    not valid;
alter table public.diagnoses validate constraint diagnoses_workspace_catalog_fk;

alter table public.diagnoses
  drop constraint if exists diagnoses_catalog_revision_check,
  add constraint diagnoses_catalog_revision_check check (diagnosis_catalog_revision is null or diagnosis_catalog_revision > 0),
  drop constraint if exists diagnoses_snapshot_check,
  add constraint diagnoses_snapshot_check check (diagnosis_snapshot is null or pg_catalog.jsonb_typeof(diagnosis_snapshot) = 'object'),
  drop constraint if exists diagnoses_catalog_snapshot_pair_check,
  add constraint diagnoses_catalog_snapshot_pair_check check (
    (diagnosis_catalog_id is null and diagnosis_catalog_revision is null and diagnosis_snapshot is null)
    or (diagnosis_catalog_id is not null and diagnosis_catalog_revision is not null and diagnosis_snapshot is not null)
  ) not valid;

-- Existing 14 free-text rows satisfy the pair check. Validate after the
-- additive columns exist without rewriting or backfilling any encounter data.
alter table public.diagnoses validate constraint diagnoses_catalog_snapshot_pair_check;

create unique index if not exists diagnoses_encounter_catalog_unique_key
  on public.diagnoses(workspace_id, encounter_id, diagnosis_catalog_id)
  where diagnosis_catalog_id is not null;

create or replace function public.clair_get_chart_diagnoses(
  p_workspace_id text,
  p_encounter_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_diagnosis_rows jsonb;
begin
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing' using errcode = '42501';
  end if;
  if not private.clair_current_user_has_workspace_permission(p_workspace_id, 'chart:view') then
    raise exception 'permission_missing' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.encounters
    where workspace_id = p_workspace_id and id = p_encounter_id and status <> 'cancelled'
  ) then
    raise exception 'encounter_unavailable';
  end if;
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id', diagnosis.id,
    'encounterId', diagnosis.encounter_id,
    'diagnosisCatalogId', diagnosis.diagnosis_catalog_id,
    'diagnosisCatalogRevision', diagnosis.diagnosis_catalog_revision,
    'diagnosisText', diagnosis.diagnosis_text,
    'diagnosisType', diagnosis.diagnosis_type,
    'systemLabel', diagnosis.diagnosis_snapshot->>'systemLabel',
    'diseaseGroupLabel', diagnosis.diagnosis_snapshot->>'diseaseGroupLabel',
    'isClosed', diagnosis.closed_at is not null,
    'closedAt', diagnosis.closed_at,
    'closedByUserId', diagnosis.closed_by_user_id,
    'isPrimary', diagnosis.is_primary,
    'sortOrder', diagnosis.sort_order,
    'createdByUserId', diagnosis.created_by_user_id,
    'updatedByUserId', diagnosis.updated_by_user_id,
    'createdAt', diagnosis.created_at,
    'updatedAt', diagnosis.updated_at
  ) order by diagnosis.sort_order, diagnosis.created_at, diagnosis.id), '[]'::jsonb)
  into v_diagnosis_rows
  from public.diagnoses diagnosis
  where diagnosis.workspace_id = p_workspace_id and diagnosis.encounter_id = p_encounter_id;
  return v_diagnosis_rows;
end;
$$;

create or replace function public.clair_save_chart_diagnoses(
  p_workspace_id text,
  p_actor_user_id text,
  p_encounter_id uuid,
  p_diagnoses jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_user_id uuid := nullif(p_actor_user_id, '')::uuid;
  v_existing_state jsonb := '{}'::jsonb;
  v_now timestamptz := pg_catalog.now();
  v_rows jsonb;
  v_input jsonb;
  v_actor_membership_id uuid;
  v_patient_id uuid;
  v_guardian_id uuid;
  v_before_audit jsonb;
  v_after_audit jsonb;
begin
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing' using errcode = '42501';
  end if;
  if v_actor_user_id is null or v_actor_user_id is distinct from auth.uid() then
    raise exception 'actor_mismatch' using errcode = '42501';
  end if;
  if not private.clair_current_user_has_workspace_permission(p_workspace_id, 'chart:update') then
    raise exception 'permission_missing' using errcode = '42501';
  end if;
  if pg_catalog.jsonb_typeof(coalesce(p_diagnoses, '[]'::jsonb)) <> 'array' then
    raise exception 'invalid_diagnosis_rows' using errcode = '22023';
  end if;
  if pg_catalog.jsonb_array_length(coalesce(p_diagnoses, '[]'::jsonb)) > 30 then
    raise exception 'too_many_diagnosis_rows' using errcode = '22023';
  end if;
  for v_input in
    select value from pg_catalog.jsonb_array_elements(coalesce(p_diagnoses, '[]'::jsonb)) rows(value)
  loop
    if pg_catalog.jsonb_typeof(v_input) <> 'object'
      or exists (
        select 1 from pg_catalog.jsonb_object_keys(v_input) key
        where key not in ('id','diagnosisCatalogId','diagnosisText','diagnosisType','isClosed','isPrimary','sortOrder')
      ) then
      raise exception 'invalid_diagnosis_row_contract' using errcode = '22023';
    end if;
    if coalesce(nullif(v_input->>'diagnosisType',''), 'suspected') not in ('suspected','confirmed','differential') then
      raise exception 'invalid_diagnosis_type' using errcode = '22023';
    end if;
    if nullif(v_input->>'diagnosisCatalogId','') is null
      and (pg_catalog.length(pg_catalog.btrim(coalesce(v_input->>'diagnosisText',''))) < 1
        or pg_catalog.length(pg_catalog.btrim(coalesce(v_input->>'diagnosisText',''))) > 500) then
      raise exception 'invalid_free_text_diagnosis' using errcode = '22023';
    end if;
    if nullif(v_input->>'id','') is not null and exists (
      select 1 from public.diagnoses existing
      where existing.id = (v_input->>'id')::uuid
        and (existing.workspace_id <> p_workspace_id or existing.encounter_id <> p_encounter_id)
    ) then
      raise exception 'diagnosis_id_outside_target_encounter' using errcode = '42501';
    end if;
  end loop;
  if exists (
    select 1 from (
      select value->>'id' id
      from pg_catalog.jsonb_array_elements(coalesce(p_diagnoses, '[]'::jsonb)) rows(value)
      where nullif(value->>'id','') is not null
      group by value->>'id' having count(*) > 1
    ) duplicates
  ) then
    raise exception 'duplicate_diagnosis_id' using errcode = '23505';
  end if;
  if exists (
    select 1 from (
      select value->>'diagnosisCatalogId' catalog_id
      from pg_catalog.jsonb_array_elements(coalesce(p_diagnoses, '[]'::jsonb)) rows(value)
      where nullif(value->>'diagnosisCatalogId','') is not null
      group by value->>'diagnosisCatalogId' having count(*) > 1
    ) duplicates
  ) then
    raise exception 'duplicate_diagnosis_catalog_id' using errcode = '23505';
  end if;
  if (select count(*) from pg_catalog.jsonb_array_elements(coalesce(p_diagnoses, '[]'::jsonb)) rows(value)
      where coalesce((value->>'isPrimary')::boolean, false)) > 1 then
    raise exception 'multiple_primary_diagnoses' using errcode = '23514';
  end if;
  select patient_id, guardian_id into v_patient_id, v_guardian_id
  from public.encounters
  where workspace_id = p_workspace_id and id = p_encounter_id and status <> 'cancelled'
  for update;
  if not found then
    raise exception 'encounter_unavailable';
  end if;

  -- Serialize catalog availability with the adopter before validating. The
  -- deterministic row order avoids lock-order inversions for multi-select
  -- saves, and FOR UPDATE conflicts with the adopter's availability updates.
  perform catalog.id
  from public.diagnosis_catalog catalog
  join (
    select distinct (value->>'diagnosisCatalogId')::uuid as id
    from pg_catalog.jsonb_array_elements(coalesce(p_diagnoses, '[]'::jsonb)) rows(value)
    where nullif(value->>'diagnosisCatalogId','') is not null
  ) requested on requested.id = catalog.id
  where catalog.workspace_id = p_workspace_id
  order by catalog.id
  for update of catalog;

  if exists (
    select 1 from pg_catalog.jsonb_array_elements(coalesce(p_diagnoses, '[]'::jsonb)) rows(value)
    where nullif(value->>'diagnosisCatalogId','') is not null
      and not exists (
        select 1 from public.diagnosis_catalog catalog
        where catalog.id = (rows.value->>'diagnosisCatalogId')::uuid
          and catalog.workspace_id = p_workspace_id
          and catalog.is_active and catalog.availability_state = 'active'
      )
      and not exists (
        select 1 from public.diagnoses existing
        where existing.workspace_id = p_workspace_id
          and existing.encounter_id = p_encounter_id
          and existing.id = nullif(rows.value->>'id','')::uuid
          and existing.diagnosis_catalog_id = (rows.value->>'diagnosisCatalogId')::uuid
      )
  ) then
    raise exception 'diagnosis_catalog_item_unavailable' using errcode = '23503';
  end if;

  perform 1 from public.diagnoses
  where workspace_id = p_workspace_id and encounter_id = p_encounter_id
  for update;

  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(coalesce(p_diagnoses, '[]'::jsonb)) rows(value)
    join public.diagnoses existing
      on existing.workspace_id = p_workspace_id
      and existing.encounter_id = p_encounter_id
      and existing.id = nullif(rows.value->>'id','')::uuid
    where existing.diagnosis_catalog_id is distinct from nullif(rows.value->>'diagnosisCatalogId','')::uuid
  ) then
    raise exception 'diagnosis_catalog_identity_immutable' using errcode = '23514';
  end if;

  select coalesce(pg_catalog.jsonb_object_agg(id::text, pg_catalog.jsonb_build_object(
    'catalogId', diagnosis_catalog_id,
    'catalogRevision', diagnosis_catalog_revision,
    'snapshot', diagnosis_snapshot,
    'closedAt', closed_at,
    'closedByUserId', closed_by_user_id,
    'createdAt', created_at,
    'createdByUserId', created_by_user_id
  )), '{}'::jsonb) into v_existing_state
  from public.diagnoses where workspace_id = p_workspace_id and encounter_id = p_encounter_id;

  select pg_catalog.jsonb_build_object(
    'count', count(*),
    'rows', coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id', id,
      'catalogId', diagnosis_catalog_id,
      'catalogRevision', diagnosis_catalog_revision,
      'diagnosisMode', case when diagnosis_catalog_id is null then 'free_text' else 'catalog' end,
      'diagnosisTextFingerprint', pg_catalog.encode(extensions.digest(
        coalesce(diagnosis_text, ''), 'sha256'
      ), 'hex'),
      'diagnosisType', diagnosis_type,
      'isClosed', closed_at is not null,
      'isPrimary', is_primary,
      'sortOrder', sort_order
    ) order by sort_order, id), '[]'::jsonb)
  ) into v_before_audit
  from public.diagnoses where workspace_id = p_workspace_id and encounter_id = p_encounter_id;

  delete from public.diagnoses where workspace_id = p_workspace_id and encounter_id = p_encounter_id;

  insert into public.diagnoses(
    id, workspace_id, encounter_id, diagnosis_catalog_id, diagnosis_catalog_revision,
    diagnosis_snapshot, diagnosis_text, diagnosis_type, closed_at, closed_by_user_id,
    is_primary, sort_order, created_by_user_id, updated_by_user_id, created_at, updated_at
  )
  select
    coalesce(nullif(input.value->>'id','')::uuid, extensions.gen_random_uuid()),
    p_workspace_id,
    p_encounter_id,
    catalog.id,
    case
      when catalog.id is not null
        and v_existing_state -> (input.value->>'id') ->> 'catalogId' = catalog.id::text
      then (v_existing_state -> (input.value->>'id') ->> 'catalogRevision')::integer
      else catalog.catalog_revision
    end,
    case when catalog.id is null then null
      when v_existing_state -> (input.value->>'id') ->> 'catalogId' = catalog.id::text
        then v_existing_state -> (input.value->>'id') -> 'snapshot'
      else pg_catalog.jsonb_build_object(
      'catalogId', catalog.id,
      'catalogRevision', catalog.catalog_revision,
      -- Customized workspace projections can intentionally lag behind a newer
      -- source revision. Persist the last revision actually reflected by the
      -- displayed labels, not merely the newest revision observed upstream.
      'sourceMasterRevision', catalog.last_applied_revision,
      'diagnosisName', catalog.name,
      'systemId', catalog.system_master_record_id,
      'systemLabel', catalog.system_name,
      'diseaseGroupId', catalog.disease_group_master_record_id,
      'diseaseGroupLabel', catalog.disease_group_name,
      'sourceMasterRecordId', catalog.source_master_record_id
    ) end,
    case when catalog.id is null then pg_catalog.btrim(input.value->>'diagnosisText')
      when v_existing_state -> (input.value->>'id') ->> 'catalogId' = catalog.id::text
        then coalesce(v_existing_state -> (input.value->>'id') -> 'snapshot' ->> 'diagnosisName', catalog.name)
      else catalog.name end,
    coalesce(nullif(input.value->>'diagnosisType',''), 'suspected'),
    case when coalesce((input.value->>'isClosed')::boolean, false)
      then coalesce(nullif(v_existing_state -> (input.value->>'id') ->> 'closedAt','')::timestamptz, v_now)
      else null end,
    case when coalesce((input.value->>'isClosed')::boolean, false)
      then coalesce(nullif(v_existing_state -> (input.value->>'id') ->> 'closedByUserId','')::uuid, v_actor_user_id)
      else null end,
    coalesce((input.value->>'isPrimary')::boolean, false),
    input.ordinality::integer - 1,
    coalesce(nullif(v_existing_state -> (input.value->>'id') ->> 'createdByUserId','')::uuid, v_actor_user_id),
    v_actor_user_id,
    coalesce(nullif(v_existing_state -> (input.value->>'id') ->> 'createdAt','')::timestamptz, v_now),
    v_now
  from pg_catalog.jsonb_array_elements(coalesce(p_diagnoses, '[]'::jsonb)) with ordinality input(value, ordinality)
  left join public.diagnosis_catalog catalog
    on catalog.id = nullif(input.value->>'diagnosisCatalogId','')::uuid
    and catalog.workspace_id = p_workspace_id
    and (
      (catalog.is_active and catalog.availability_state = 'active')
      or v_existing_state -> (input.value->>'id') ->> 'catalogId' = catalog.id::text
    )
  ;

  update public.encounters
  set status = case when status = 'waiting' then 'in_consultation' else status end,
      started_at = coalesce(started_at, v_now), updated_at = v_now
  where workspace_id = p_workspace_id and id = p_encounter_id and status <> 'cancelled';

  select pg_catalog.jsonb_build_object(
    'count', count(*),
    'rows', coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id', id,
      'catalogId', diagnosis_catalog_id,
      'catalogRevision', diagnosis_catalog_revision,
      'diagnosisMode', case when diagnosis_catalog_id is null then 'free_text' else 'catalog' end,
      'diagnosisTextFingerprint', pg_catalog.encode(extensions.digest(
        coalesce(diagnosis_text, ''), 'sha256'
      ), 'hex'),
      'diagnosisType', diagnosis_type,
      'isClosed', closed_at is not null,
      'isPrimary', is_primary,
      'sortOrder', sort_order
    ) order by sort_order, id), '[]'::jsonb)
  ) into v_after_audit
  from public.diagnoses where workspace_id = p_workspace_id and encounter_id = p_encounter_id;

  select id into v_actor_membership_id
  from public.user_memberships
  where workspace_id = p_workspace_id and user_id = v_actor_user_id and status = 'active'
  limit 1;
  insert into public.audit_events(
    id, workspace_id, actor_user_id, actor_membership_id, event_type,
    target_type, target_id, encounter_id, patient_id, guardian_id,
    before_snapshot, after_snapshot, metadata, occurred_at, created_at
  ) values (
    'audit_rpc_diagnosis_' || pg_catalog.substr(pg_catalog.encode(extensions.digest(
      p_workspace_id || ':' || p_encounter_id::text || ':' || v_now::text || ':' || extensions.gen_random_uuid()::text,
      'sha256'
    ), 'hex'), 1, 24),
    p_workspace_id, v_actor_user_id, v_actor_membership_id, 'diagnosis.changed',
    'encounter_diagnoses', p_encounter_id::text, p_encounter_id, v_patient_id, v_guardian_id,
    v_before_audit, v_after_audit,
    pg_catalog.jsonb_build_object('rpc', 'clair_save_chart_diagnoses'),
    v_now, v_now
  );

  select public.clair_get_chart_diagnoses(p_workspace_id, p_encounter_id) into v_rows;
  return v_rows;
end;
$$;

revoke all on function public.clair_get_chart_diagnoses(text, uuid) from public, anon;
revoke all on function public.clair_save_chart_diagnoses(text, text, uuid, jsonb) from public, anon;
grant execute on function public.clair_get_chart_diagnoses(text, uuid) to authenticated;
grant execute on function public.clair_save_chart_diagnoses(text, text, uuid, jsonb) to authenticated;

comment on column public.diagnoses.diagnosis_catalog_revision is
  'Workspace catalog revision resolved by the server at save time; null for free text.';
comment on column public.diagnoses.diagnosis_snapshot is
  'Immutable diagnosis/classification display snapshot resolved by the server at save time; null for free text.';
