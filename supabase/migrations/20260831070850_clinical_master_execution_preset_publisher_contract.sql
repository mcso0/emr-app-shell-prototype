-- CLINICAL-MASTER-PR-022 publisher contract.
--
-- The publisher payload carries an additive order.detail.executionPreset
-- envelope.  The envelope contains only preset content and identity; the
-- authoritative master order UUID, order revision, and release UUID are
-- derived from master.master_record_versions by the projection trigger below.
-- Existing publisher behavior remains fail-closed for every other detail key,
-- record type, price field, and unknown payload field.

set lock_timeout = '5s';
set statement_timeout = '120s';

-- Keep the previously deployed implementation under a stable private name.
-- The DO guards make this migration safe to replay after a failed local reset.
do $rename_detail_contract$
begin
  if pg_catalog.to_regprocedure(
    'private.clinical_master_assert_detail_keys_base(text,jsonb)'
  ) is null then
    alter function private.clinical_master_assert_detail_keys(text, jsonb)
      rename to clinical_master_assert_detail_keys_base;
  end if;
  if pg_catalog.to_regprocedure(
    'private.clinical_master_canonicalize_detail_base(text,jsonb)'
  ) is null then
    alter function private.clinical_master_canonicalize_detail(text, jsonb)
      rename to clinical_master_canonicalize_detail_base;
  end if;
end;
$rename_detail_contract$;

-- The content hash intentionally excludes contentSha256 itself and the source
-- master version fields derived by the trigger.  This exact subset is shared
-- with the deterministic artifact contract:
-- presetId, presetKey, presetRevision, clinicalOrderType,
-- detailSchemaVersion, defaultDetailInputs, fieldPolicies, provenance,
-- presetStatus, clinicalUseAllowed, sourceArtifactSha256.
create or replace function private.clair_order_execution_preset_hash_content(
  p_execution_preset jsonb
)
returns jsonb
language sql
immutable
security definer
set search_path = ''
as $function$
  select pg_catalog.jsonb_build_object(
    'presetId', (p_execution_preset ->> 'presetId')::uuid,
    'presetKey', pg_catalog.btrim(p_execution_preset ->> 'presetKey'),
    'presetRevision', (p_execution_preset ->> 'presetRevision')::integer,
    'clinicalOrderType', pg_catalog.btrim(p_execution_preset ->> 'clinicalOrderType'),
    'detailSchemaVersion', (p_execution_preset ->> 'detailSchemaVersion')::integer,
    'defaultDetailInputs', p_execution_preset -> 'defaultDetailInputs',
    'fieldPolicies', p_execution_preset -> 'fieldPolicies',
    'provenance', p_execution_preset -> 'provenance',
    'presetStatus', pg_catalog.btrim(p_execution_preset ->> 'presetStatus'),
    'clinicalUseAllowed', (p_execution_preset ->> 'clinicalUseAllowed')::boolean,
    'sourceArtifactSha256', pg_catalog.btrim(p_execution_preset ->> 'sourceArtifactSha256')
  );
$function$;

revoke all on function private.clair_order_execution_preset_hash_content(jsonb)
  from public, anon, authenticated, service_role;

-- The order detail contract is unchanged unless the additive envelope is
-- present.  The base receives detail minus executionPreset, so all legacy
-- keys and unknown-key failures retain their previous behavior.
create or replace function private.clinical_master_assert_detail_keys(
  p_record_type text,
  p_detail jsonb
)
returns void
language plpgsql
immutable
set search_path = ''
as $function$
declare
  v_key text;
  v_execution_preset jsonb;
  v_preset_id uuid;
  v_preset_revision integer;
  v_detail_schema_version integer;
  v_clinical_use_allowed boolean;
  v_required_keys constant text[] := array[
    'presetId',
    'presetKey',
    'presetRevision',
    'clinicalOrderType',
    'detailSchemaVersion',
    'defaultDetailInputs',
    'fieldPolicies',
    'provenance',
    'presetStatus',
    'clinicalUseAllowed',
    'contentSha256',
    'sourceArtifactSha256'
  ];
begin
  if p_record_type <> 'order' or not (p_detail ? 'executionPreset') then
    perform private.clinical_master_assert_detail_keys_base(p_record_type, p_detail);
    return;
  end if;

  perform private.clinical_master_assert_detail_keys_base(
    p_record_type,
    p_detail - 'executionPreset'
  );

  v_execution_preset := p_detail -> 'executionPreset';
  if pg_catalog.jsonb_typeof(v_execution_preset) is distinct from 'object'
    or (
      select pg_catalog.count(*)::integer
      from pg_catalog.jsonb_object_keys(v_execution_preset)
    ) <> pg_catalog.cardinality(v_required_keys)
    or not (v_execution_preset ?& v_required_keys)
  then
    raise exception 'clinical_master_execution_preset_exact_keys_required'
      using errcode = '22023';
  end if;

  for v_key in
    select key from pg_catalog.jsonb_object_keys(v_execution_preset) as keys(key)
  loop
    if not (v_key = any(v_required_keys)) then
      raise exception 'clinical_master_execution_preset_unknown_field'
        using errcode = '22023', detail = v_key;
    end if;
  end loop;

  if pg_catalog.jsonb_typeof(v_execution_preset -> 'presetId') <> 'string'
    or pg_catalog.jsonb_typeof(v_execution_preset -> 'presetKey') <> 'string'
    or pg_catalog.jsonb_typeof(v_execution_preset -> 'presetRevision') <> 'number'
    or pg_catalog.jsonb_typeof(v_execution_preset -> 'clinicalOrderType') <> 'string'
    or pg_catalog.jsonb_typeof(v_execution_preset -> 'detailSchemaVersion') <> 'number'
    or pg_catalog.jsonb_typeof(v_execution_preset -> 'presetStatus') <> 'string'
    or pg_catalog.jsonb_typeof(v_execution_preset -> 'clinicalUseAllowed') <> 'boolean'
    or pg_catalog.jsonb_typeof(v_execution_preset -> 'contentSha256') <> 'string'
    or pg_catalog.jsonb_typeof(v_execution_preset -> 'sourceArtifactSha256') <> 'string'
  then
    raise exception 'clinical_master_execution_preset_scalar_types_invalid'
      using errcode = '22023';
  end if;

  begin
    v_preset_id := (v_execution_preset ->> 'presetId')::uuid;
  exception when others then
    raise exception 'clinical_master_execution_preset_id_invalid'
      using errcode = '22023';
  end;
  if v_preset_id is null then
    raise exception 'clinical_master_execution_preset_id_required'
      using errcode = '22023';
  end if;

  if pg_catalog.btrim(coalesce(v_execution_preset ->> 'presetKey', '')) = ''
    or pg_catalog.length(pg_catalog.btrim(v_execution_preset ->> 'presetKey')) > 240
  then
    raise exception 'clinical_master_execution_preset_key_required'
      using errcode = '22023';
  end if;

  begin
    v_preset_revision := (v_execution_preset ->> 'presetRevision')::integer;
    v_detail_schema_version := (v_execution_preset ->> 'detailSchemaVersion')::integer;
  exception when others then
    raise exception 'clinical_master_execution_preset_revision_invalid'
      using errcode = '22023';
  end;
  if v_preset_revision is null or v_preset_revision <= 0 then
    raise exception 'clinical_master_execution_preset_revision_invalid'
      using errcode = '22023';
  end if;
  if v_detail_schema_version is null or v_detail_schema_version <= 0 then
    raise exception 'clinical_master_execution_preset_schema_version_invalid'
      using errcode = '22023';
  end if;

  if pg_catalog.btrim(coalesce(v_execution_preset ->> 'clinicalOrderType', '')) not in (
    'consultation', 'clinical_lab', 'imaging', 'external_lab', 'dispensing',
    'treatment', 'hospitalization', 'system_exam', 'other'
  ) then
    raise exception 'clinical_master_execution_preset_type_invalid'
      using errcode = '22023';
  end if;
  if pg_catalog.jsonb_typeof(v_execution_preset -> 'defaultDetailInputs') is distinct from 'object'
    or pg_catalog.jsonb_typeof(v_execution_preset -> 'fieldPolicies') is distinct from 'object'
    or pg_catalog.jsonb_typeof(v_execution_preset -> 'provenance') is distinct from 'object'
  then
    raise exception 'clinical_master_execution_preset_object_fields_required'
      using errcode = '22023';
  end if;

  if pg_catalog.btrim(coalesce(v_execution_preset ->> 'presetStatus', ''))
       <> 'synthetic_unreviewed'
  then
    raise exception 'clinical_master_execution_preset_status_invalid'
      using errcode = '22023';
  end if;
  begin
    v_clinical_use_allowed := (v_execution_preset ->> 'clinicalUseAllowed')::boolean;
  exception when others then
    raise exception 'clinical_master_execution_preset_clinical_gate_invalid'
      using errcode = '22023';
  end;
  if v_clinical_use_allowed is distinct from false then
    raise exception 'clinical_master_execution_preset_clinical_use_forbidden'
      using errcode = '42501';
  end if;
  if pg_catalog.btrim(coalesce(v_execution_preset ->> 'contentSha256', ''))
       !~ '^[0-9a-f]{64}$'
    or pg_catalog.btrim(coalesce(v_execution_preset ->> 'sourceArtifactSha256', ''))
       !~ '^[0-9a-f]{64}$'
  then
    raise exception 'clinical_master_execution_preset_hash_invalid'
      using errcode = '22023';
  end if;

  if not private.clair_order_execution_preset_contract_is_valid(
    pg_catalog.btrim(v_execution_preset ->> 'clinicalOrderType'),
    v_detail_schema_version,
    v_execution_preset -> 'defaultDetailInputs',
    v_execution_preset -> 'fieldPolicies'
  ) then
    raise exception 'clinical_master_execution_preset_detail_contract_invalid'
      using errcode = '22023';
  end if;
end;
$function$;

revoke all on function private.clinical_master_assert_detail_keys_base(text, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function private.clinical_master_assert_detail_keys(text, jsonb)
  from public, anon, authenticated, service_role;

-- Canonicalization is equally additive: canonicalize the legacy detail with
-- the original implementation, then append an exact canonical envelope.
create or replace function private.clinical_master_canonicalize_detail(
  p_record_type text,
  p_detail jsonb
)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $function$
declare
  v_base jsonb;
  v_execution_preset jsonb;
begin
  perform private.clinical_master_assert_detail_keys(p_record_type, p_detail);
  v_base := private.clinical_master_canonicalize_detail_base(
    p_record_type,
    case when p_record_type = 'order' then p_detail - 'executionPreset' else p_detail end
  );
  if p_record_type <> 'order' or not (p_detail ? 'executionPreset') then
    return v_base;
  end if;

  v_execution_preset := p_detail -> 'executionPreset';
  return v_base || pg_catalog.jsonb_build_object(
    'executionPreset', pg_catalog.jsonb_build_object(
      'presetId', (v_execution_preset ->> 'presetId')::uuid,
      'presetKey', pg_catalog.btrim(v_execution_preset ->> 'presetKey'),
      'presetRevision', (v_execution_preset ->> 'presetRevision')::integer,
      'clinicalOrderType', pg_catalog.btrim(v_execution_preset ->> 'clinicalOrderType'),
      'detailSchemaVersion', (v_execution_preset ->> 'detailSchemaVersion')::integer,
      'defaultDetailInputs', v_execution_preset -> 'defaultDetailInputs',
      'fieldPolicies', v_execution_preset -> 'fieldPolicies',
      'provenance', v_execution_preset -> 'provenance',
      'presetStatus', pg_catalog.btrim(v_execution_preset ->> 'presetStatus'),
      'clinicalUseAllowed', (v_execution_preset ->> 'clinicalUseAllowed')::boolean,
      'contentSha256', pg_catalog.btrim(v_execution_preset ->> 'contentSha256'),
      'sourceArtifactSha256', pg_catalog.btrim(v_execution_preset ->> 'sourceArtifactSha256')
    )
  );
end;
$function$;

revoke all on function private.clinical_master_canonicalize_detail_base(text, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function private.clinical_master_canonicalize_detail(text, jsonb)
  from public, anon, authenticated, service_role;

-- The cumulative publisher already resolves omitted lab dependencies to their
-- immutable latest revision in its first profile pass. A legacy refresh pass
-- then looked only in the current release stage and overwrote that valid pin
-- with NULL when the referenced panel/test owner was intentionally omitted.
-- Patch only those two lookups in place so the payload fingerprint, record
-- count, and every other reviewed publisher branch remain unchanged.
do $patch_cumulative_omitted_lab_dependency$
declare
  v_definition text;
  v_old text := $old$
      if nullif(v_rel->>'labPanelMasterRecordId','') is not null then
        select stage.effective_revision into v_target_revision from private.clinical_master_lab_publish_stage stage where stage.release_id=v_release.id and stage.master_record_id=(v_rel->>'labPanelMasterRecordId')::uuid;
        v_rel := v_rel || jsonb_build_object('labPanelMasterRevision',v_target_revision);
      elsif nullif(v_rel->>'labTestMasterRecordId','') is not null then
        select stage.effective_revision into v_target_revision from private.clinical_master_lab_publish_stage stage where stage.release_id=v_release.id and stage.master_record_id=(v_rel->>'labTestMasterRecordId')::uuid;
        v_rel := v_rel || jsonb_build_object('labTestMasterRevision',v_target_revision);
      end if;
$old$;
  v_new text := $new$
      if nullif(v_rel->>'labPanelMasterRecordId','') is not null then
        select coalesce(stage.effective_revision, latest.revision)
          into v_target_revision
        from master.master_records owner
        left join private.clinical_master_lab_publish_stage stage
          on stage.release_id=v_release.id
         and stage.master_record_id=owner.id
        left join lateral (
          select version.revision
          from master.master_record_versions version
          where version.master_record_id=owner.id
          order by version.revision desc
          limit 1
        ) latest on true
        where owner.id=(v_rel->>'labPanelMasterRecordId')::uuid;
        if v_target_revision is null then
          raise exception 'clinical_master_omitted_lab_dependency_revision_missing'
            using errcode='23503';
        end if;
        v_rel := v_rel || jsonb_build_object('labPanelMasterRevision',v_target_revision);
      elsif nullif(v_rel->>'labTestMasterRecordId','') is not null then
        select coalesce(stage.effective_revision, latest.revision)
          into v_target_revision
        from master.master_records owner
        left join private.clinical_master_lab_publish_stage stage
          on stage.release_id=v_release.id
         and stage.master_record_id=owner.id
        left join lateral (
          select version.revision
          from master.master_record_versions version
          where version.master_record_id=owner.id
          order by version.revision desc
          limit 1
        ) latest on true
        where owner.id=(v_rel->>'labTestMasterRecordId')::uuid;
        if v_target_revision is null then
          raise exception 'clinical_master_omitted_lab_dependency_revision_missing'
            using errcode='23503';
        end if;
        v_rel := v_rel || jsonb_build_object('labTestMasterRevision',v_target_revision);
      end if;
$new$;
begin
  select pg_catalog.pg_get_functiondef(
    'private.publish_clinical_master_release_cumulative(jsonb,uuid)'::pg_catalog.regprocedure
  ) into v_definition;

  if pg_catalog.strpos(v_definition, v_old) > 0 then
    execute pg_catalog.replace(v_definition, v_old, v_new);
  elsif pg_catalog.strpos(
    v_definition,
    'clinical_master_omitted_lab_dependency_revision_missing'
  ) = 0 then
    raise exception 'clinical_master_cumulative_publisher_patch_anchor_missing'
      using errcode = '55000';
  end if;
end;
$patch_cumulative_omitted_lab_dependency$;

revoke all on function private.publish_clinical_master_release_cumulative(jsonb, uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.publish_clinical_master_release(jsonb, uuid)
  from public, anon, authenticated, service_role;

-- The trigger is the only writer for generic master execution-preset rows
-- produced by the publisher. It runs after the immutable master version exists,
-- so all lineage is derived from NEW and the insert is atomic with publication.
create or replace function private.clair_project_order_execution_preset_after_master_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_detail jsonb;
  v_execution_preset jsonb;
  v_preset_id uuid;
  v_preset_key text;
  v_preset_revision integer;
  v_clinical_order_type text;
  v_detail_schema_version integer;
  v_current_id uuid;
  v_current_key text;
  v_current_revision integer;
  v_latest_identity_revision integer;
  v_existing_order_id uuid;
begin
  if new.snapshot ->> 'recordType' <> 'order' then
    return new;
  end if;

  v_detail := new.snapshot -> 'detail';
  if pg_catalog.jsonb_typeof(v_detail) is distinct from 'object' then
    raise exception 'clinical_master_order_detail_object_required'
      using errcode = '22023';
  end if;

  if not (v_detail ? 'executionPreset') then
    if exists (
      select 1
      from master.order_execution_preset_current current_preset
      where current_preset.order_record_id = new.master_record_id
    ) then
      raise exception 'execution_preset_removal_forbidden'
        using errcode = '23514';
    end if;
    return new;
  end if;

  perform private.clinical_master_assert_detail_keys('order', v_detail);
  v_execution_preset := v_detail -> 'executionPreset';
  v_preset_id := (v_execution_preset ->> 'presetId')::uuid;
  v_preset_key := pg_catalog.btrim(v_execution_preset ->> 'presetKey');
  v_preset_revision := (v_execution_preset ->> 'presetRevision')::integer;
  v_clinical_order_type := pg_catalog.btrim(v_execution_preset ->> 'clinicalOrderType');
  v_detail_schema_version := (v_execution_preset ->> 'detailSchemaVersion')::integer;

  if v_execution_preset ->> 'contentSha256' is distinct from
    private.clinical_master_sha256(
      private.clair_order_execution_preset_hash_content(v_execution_preset)
    ) then
    raise exception 'clinical_master_execution_preset_content_hash_mismatch'
      using errcode = '23514';
  end if;

  -- Serialize generic projection per order so a direct operator insert cannot
  -- bypass the monotonic revision check under concurrent publication.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'clinical_master_order_execution_preset_projection:' || new.master_record_id::text,
      0
    )
  );

  select current_preset.preset_id,
         current_preset.preset_revision,
         existing_preset.preset_key
    into v_current_id, v_current_revision, v_current_key
  from master.order_execution_preset_current current_preset
  join master.order_execution_presets existing_preset
    on existing_preset.order_record_id = current_preset.order_record_id
   and existing_preset.id = current_preset.preset_id
   and existing_preset.preset_revision = current_preset.preset_revision
  where current_preset.order_record_id = new.master_record_id
  for update;

  if found and v_current_id = v_preset_id
    and v_preset_revision <= v_current_revision then
    raise exception 'clinical_master_execution_preset_revision_not_monotonic'
      using errcode = '23514';
  end if;
  if found and (
    v_current_id is distinct from v_preset_id
    or v_current_key is distinct from v_preset_key
  ) then
    raise exception 'clinical_master_execution_preset_replacement_required'
      using errcode = '23514';
  end if;
  if found and v_current_key = v_preset_key
    and v_current_id is distinct from v_preset_id then
    raise exception 'clinical_master_execution_preset_identity_conflict'
      using errcode = '23505';
  end if;

  select max(preset_revision)
    into v_latest_identity_revision
  from master.order_execution_presets existing_preset
  where existing_preset.order_record_id = new.master_record_id
    and (
      existing_preset.id = v_preset_id
      or existing_preset.preset_key = v_preset_key
    );
  if v_latest_identity_revision is not null
    and v_preset_revision <= v_latest_identity_revision then
    raise exception 'clinical_master_execution_preset_revision_not_monotonic'
      using errcode = '23514';
  end if;

  select existing_preset.order_record_id
    into v_existing_order_id
  from master.order_execution_presets existing_preset
  where existing_preset.id = v_preset_id
    and existing_preset.preset_revision = v_preset_revision
    and existing_preset.order_record_id <> new.master_record_id
  limit 1;
  if found then
    raise exception 'clinical_master_execution_preset_id_conflict'
      using errcode = '23505';
  end if;
  if exists (
    select 1
    from master.order_execution_presets existing_preset
    where existing_preset.preset_key = v_preset_key
      and existing_preset.preset_revision = v_preset_revision
      and existing_preset.id <> v_preset_id
  ) then
    raise exception 'clinical_master_execution_preset_key_conflict'
      using errcode = '23505';
  end if;

  insert into master.order_execution_presets (
    id,
    preset_key,
    preset_revision,
    order_record_id,
    order_record_revision,
    clinical_order_type,
    detail_schema_version,
    default_detail_inputs,
    field_policies,
    provenance,
    preset_status,
    clinical_use_allowed,
    content_sha256,
    source_artifact_sha256,
    source_release_id
  ) values (
    v_preset_id,
    v_preset_key,
    v_preset_revision,
    new.master_record_id,
    new.revision,
    v_clinical_order_type,
    v_detail_schema_version,
    v_execution_preset -> 'defaultDetailInputs',
    v_execution_preset -> 'fieldPolicies',
    v_execution_preset -> 'provenance',
    v_execution_preset ->> 'presetStatus',
    (v_execution_preset ->> 'clinicalUseAllowed')::boolean,
    v_execution_preset ->> 'contentSha256',
    v_execution_preset ->> 'sourceArtifactSha256',
    new.release_id
  );

  insert into master.order_execution_preset_current (
    order_record_id,
    preset_id,
    preset_revision,
    activated_in_release_id
  ) values (
    new.master_record_id,
    v_preset_id,
    v_preset_revision,
    new.release_id
  )
  on conflict (order_record_id) do update
    set preset_id = excluded.preset_id,
        preset_revision = excluded.preset_revision,
        activated_in_release_id = excluded.activated_in_release_id,
        updated_at = pg_catalog.now();

  return new;
end;
$function$;

revoke all on function private.clair_project_order_execution_preset_after_master_version()
  from public, anon, authenticated, service_role;

drop trigger if exists master_order_execution_preset_projection_after_insert
  on master.master_record_versions;
create trigger master_order_execution_preset_projection_after_insert
after insert on master.master_record_versions
for each row execute function private.clair_project_order_execution_preset_after_master_version();

comment on function private.clair_order_execution_preset_hash_content(jsonb) is
  'Canonical PR-022 content subset: presetId, presetKey, presetRevision, clinicalOrderType, detailSchemaVersion, defaultDetailInputs, fieldPolicies, provenance, presetStatus, clinicalUseAllowed, sourceArtifactSha256. contentSha256 and DB-derived master lineage are excluded.';
comment on function private.clair_project_order_execution_preset_after_master_version() is
  'Atomically projects validated order.detail.executionPreset into append-only generic master rows and advances the private current pointer. Missing executionPreset is forbidden once a current pointer exists.';
