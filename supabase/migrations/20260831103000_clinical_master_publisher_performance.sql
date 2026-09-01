-- CLINICAL-MASTER-PR-022 publisher performance hardening.
--
-- Keep the public/private publisher contract, diagnosis dispatch, fingerprint,
-- advisory lock, transaction boundary, and projection triggers unchanged.
-- Remove two proven sources of duplicate CPU work only:
--   1. validate preset detail inputs against the already-built schema; and
--   2. do not canonicalize a payload a second time when the private outer
--      publisher passes the exact canonical payload to the cumulative core.

set lock_timeout = '5s';
set statement_timeout = '120s';

create or replace function private.clair_order_detail_inputs_are_valid_for_schema_v1(
  p_clinical_order_type text,
  p_schema_version integer,
  p_detail_inputs jsonb,
  p_require_complete boolean,
  p_schema jsonb
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_field jsonb;
  v_key text;
  v_value jsonb;
  v_default jsonb;
  v_validation jsonb;
  v_value_type text;
begin
  if p_schema_version is distinct from 1
    or pg_catalog.jsonb_typeof(p_detail_inputs) is distinct from 'object'
    or not private.clair_order_field_schema_is_valid(
      p_clinical_order_type,
      p_schema_version,
      p_schema
    )
  then
    return false;
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_object_keys(p_detail_inputs) input_key
    where not exists (
      select 1
      from pg_catalog.jsonb_array_elements(p_schema -> 'fields') field(value)
      where field.value ->> 'key' = input_key
    )
  ) then
    return false;
  end if;

  for v_field in
    select value
    from pg_catalog.jsonb_array_elements(p_schema -> 'fields') fields(value)
  loop
    v_key := v_field ->> 'key';
    v_value := p_detail_inputs -> v_key;
    v_default := v_field -> 'defaultValue';
    v_validation := v_field -> 'validation';
    v_value_type := v_field ->> 'valueType';

    if v_value is null or pg_catalog.jsonb_typeof(v_value) = 'null' then
      v_value := v_default;
    end if;

    if p_require_complete
      and (v_field ->> 'required')::boolean
      and (
        v_value is null
        or pg_catalog.jsonb_typeof(v_value) = 'null'
        or (
          pg_catalog.jsonb_typeof(v_value) = 'string'
          and pg_catalog.btrim(v_value #>> '{}') = ''
        )
        or (
          pg_catalog.jsonb_typeof(v_value) = 'array'
          and pg_catalog.jsonb_array_length(v_value) = 0
        )
      )
    then
      return false;
    end if;

    if v_value is null or pg_catalog.jsonb_typeof(v_value) = 'null' then
      continue;
    end if;

    if v_value_type = 'string' then
      if pg_catalog.jsonb_typeof(v_value) <> 'string'
        or (
          v_validation ? 'minLength'
          and pg_catalog.length(pg_catalog.btrim(v_value #>> '{}'))
            < (v_validation ->> 'minLength')::integer
        )
        or (
          v_validation ? 'maxLength'
          and pg_catalog.length(v_value #>> '{}')
            > (v_validation ->> 'maxLength')::integer
        )
        or (
          pg_catalog.jsonb_array_length(v_field -> 'options') > 0
          and not (v_field -> 'options' ? (v_value #>> '{}'))
        )
      then
        return false;
      end if;
    elsif v_value_type = 'number' then
      if pg_catalog.jsonb_typeof(v_value) <> 'number'
        or (
          v_validation ? 'min'
          and (v_value #>> '{}')::numeric < (v_validation ->> 'min')::numeric
        )
        or (
          v_validation ? 'max'
          and (v_value #>> '{}')::numeric > (v_validation ->> 'max')::numeric
        )
        or (
          v_validation ->> 'precision' = '0'
          and (v_value #>> '{}')::numeric
            <> pg_catalog.trunc((v_value #>> '{}')::numeric)
        )
      then
        return false;
      end if;
    elsif v_value_type = 'boolean' then
      if pg_catalog.jsonb_typeof(v_value) <> 'boolean' then
        return false;
      end if;
    elsif v_value_type = 'string_array' then
      if pg_catalog.jsonb_typeof(v_value) <> 'array'
        or exists (
          select 1
          from pg_catalog.jsonb_array_elements(v_value) entry(value)
          where pg_catalog.jsonb_typeof(entry.value) <> 'string'
        )
      then
        return false;
      end if;
    elsif v_value_type = 'attachment_array' then
      if pg_catalog.jsonb_typeof(v_value) <> 'array' then
        return false;
      end if;
    else
      return false;
    end if;
  end loop;

  return true;
end;
$function$;

alter function private.clair_order_detail_inputs_are_valid_for_schema_v1(
  text,
  integer,
  jsonb,
  boolean,
  jsonb
) owner to postgres;

revoke all on function private.clair_order_detail_inputs_are_valid_for_schema_v1(
  text,
  integer,
  jsonb,
  boolean,
  jsonb
) from public, anon, authenticated, service_role;

create or replace function private.clair_order_execution_preset_contract_is_valid(
  p_clinical_order_type text,
  p_detail_schema_version integer,
  p_default_detail_inputs jsonb,
  p_field_policies jsonb
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_schema jsonb;
  v_field jsonb;
  v_field_key text;
  v_field_policy text;
  v_field_default jsonb;
begin
  if pg_catalog.jsonb_typeof(p_default_detail_inputs) is distinct from 'object'
    or pg_catalog.jsonb_typeof(p_field_policies) is distinct from 'object'
    or pg_catalog.octet_length(p_default_detail_inputs::text) > 65536
    or pg_catalog.octet_length(p_field_policies::text) > 65536
  then
    return false;
  end if;

  v_schema := private.clair_order_detail_field_schema_v1(p_clinical_order_type);
  if not private.clair_order_detail_inputs_are_valid_for_schema_v1(
    p_clinical_order_type,
    p_detail_schema_version,
    p_default_detail_inputs,
    false,
    v_schema
  ) then
    return false;
  end if;

  if p_default_detail_inputs = '{}'::jsonb
    and p_field_policies = '{}'::jsonb
  then
    return false;
  end if;

  if pg_catalog.jsonb_typeof(v_schema) is distinct from 'object'
    or pg_catalog.jsonb_typeof(v_schema -> 'fields') is distinct from 'array'
    or pg_catalog.jsonb_array_length(v_schema -> 'fields') = 0
  then
    return false;
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_each(p_field_policies) policy(key, value)
    where pg_catalog.jsonb_typeof(policy.value) <> 'string'
      or policy.value #>> '{}' not in (
        'preset_fixed',
        'derived_from_profile',
        'schema_default',
        'workspace_resolved',
        'runtime_resolved',
        'required_manual',
        'not_applicable'
      )
      or not exists (
        select 1
        from pg_catalog.jsonb_array_elements(v_schema -> 'fields') field(value)
        where field.value ->> 'key' = policy.key
      )
  ) then
    return false;
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_object_keys(p_default_detail_inputs) input_key
    where not p_field_policies ? input_key
  ) then
    return false;
  end if;

  for v_field in
    select value
    from pg_catalog.jsonb_array_elements(v_schema -> 'fields') fields(value)
  loop
    v_field_key := v_field ->> 'key';
    v_field_policy := p_field_policies ->> v_field_key;
    v_field_default := p_default_detail_inputs -> v_field_key;

    if v_field_policy is null then
      return false;
    end if;

    if coalesce((v_field ->> 'required')::boolean, false)
      and v_field_policy = 'not_applicable'
    then
      return false;
    end if;

    if v_field_policy in (
      'preset_fixed',
      'derived_from_profile',
      'schema_default'
    ) and (
      not (p_default_detail_inputs ? v_field_key)
      or v_field_default is null
      or pg_catalog.jsonb_typeof(v_field_default) = 'null'
    ) then
      return false;
    end if;

    if coalesce((v_field ->> 'required')::boolean, false)
      and not (p_default_detail_inputs ? v_field_key)
      and (
        v_field -> 'defaultValue' is null
        or pg_catalog.jsonb_typeof(v_field -> 'defaultValue') = 'null'
      )
      and v_field_policy not in (
        'workspace_resolved',
        'runtime_resolved',
        'required_manual'
      )
    then
      return false;
    end if;
  end loop;

  return true;
end;
$function$;

revoke all on function private.clair_order_execution_preset_contract_is_valid(
  text,
  integer,
  jsonb,
  jsonb
) from public, anon, authenticated, service_role;

-- The cumulative core is still callable only by the postgres-owned private
-- publisher. A digest-bound transaction-local marker prevents a stale or
-- different payload from taking the fast path.
do $patch_cumulative_canonical_payload$
declare
  v_definition text;
  v_old_count integer;
  v_new_count integer;
  v_old text := $old$
  v_payload := private.clinical_master_canonicalize_payload(p_payload);
  v_fingerprint := lower(encode(extensions.digest(convert_to(v_payload::text,'UTF8'),'sha256'),'hex'));
$old$;
  v_new text := $new$
  if coalesce(
    pg_catalog.current_setting(
      'clinical_master.publisher_canonical_sha256',
      true
    ),
    ''
  ) = private.clinical_master_sha256(p_payload) then
    v_payload := p_payload;
  else
    v_payload := private.clinical_master_canonicalize_payload(p_payload);
  end if;
  v_fingerprint := lower(encode(extensions.digest(convert_to(v_payload::text,'UTF8'),'sha256'),'hex'));
$new$;
begin
  select pg_catalog.pg_get_functiondef(
    'private.publish_clinical_master_release_cumulative(jsonb,uuid)'::pg_catalog.regprocedure
  ) into v_definition;

  v_old_count := (
    pg_catalog.length(v_definition)
    - pg_catalog.length(pg_catalog.replace(v_definition, v_old, ''))
  ) / pg_catalog.length(v_old);
  v_new_count := (
    pg_catalog.length(v_definition)
    - pg_catalog.length(pg_catalog.replace(v_definition, v_new, ''))
  ) / pg_catalog.length(v_new);

  if v_old_count = 1 and v_new_count = 0 then
    execute pg_catalog.replace(v_definition, v_old, v_new);
  elsif v_old_count <> 0 or v_new_count <> 1 then
    raise exception 'clinical_master_cumulative_performance_patch_anchor_missing'
      using errcode = '55000';
  end if;

  select pg_catalog.pg_get_functiondef(
    'private.publish_clinical_master_release_cumulative(jsonb,uuid)'::pg_catalog.regprocedure
  ) into v_definition;
  v_old_count := (
    pg_catalog.length(v_definition)
    - pg_catalog.length(pg_catalog.replace(v_definition, v_old, ''))
  ) / pg_catalog.length(v_old);
  v_new_count := (
    pg_catalog.length(v_definition)
    - pg_catalog.length(pg_catalog.replace(v_definition, v_new, ''))
  ) / pg_catalog.length(v_new);
  if v_old_count <> 0 or v_new_count <> 1 then
    raise exception 'clinical_master_cumulative_performance_patch_postcondition_failed'
      using errcode = '55000';
  end if;
end;
$patch_cumulative_canonical_payload$;

-- Preserve the latest diagnosis dispatcher and the non-diagnosis result and
-- manifest contract. Only the digest-bound marker around the cumulative call
-- is additive.
create or replace function private.publish_clinical_master_release(
  p_payload jsonb,
  p_actor_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, master, extensions, pg_catalog
as $function$
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
  perform pg_catalog.set_config(
    'clinical_master.publisher_canonical_sha256',
    private.clinical_master_sha256(v_payload),
    true
  );
  begin
    v_result := private.publish_clinical_master_release_cumulative(v_payload, p_actor_user_id);
  exception when others then
    perform pg_catalog.set_config('clinical_master.publisher_canonical_sha256', '', true);
    perform pg_catalog.set_config('clinical_master.adoption_scope', '', true);
    raise;
  end;
  perform pg_catalog.set_config('clinical_master.publisher_canonical_sha256', '', true);
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
$function$;

revoke all on function private.publish_clinical_master_release_cumulative(jsonb, uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.publish_clinical_master_release(jsonb, uuid)
  from public, anon, authenticated, service_role;

comment on function private.clair_order_detail_inputs_are_valid_for_schema_v1(
  text,
  integer,
  jsonb,
  boolean,
  jsonb
) is
  'Validates V1 order detail inputs against a caller-supplied schema so execution preset validation builds each schema once.';

comment on function private.publish_clinical_master_release(jsonb, uuid) is
  'Diagnosis-isolating clinical master publisher. The non-diagnosis path passes one digest-bound canonical payload to the cumulative core and preserves atomic payload-manifest publication.';
