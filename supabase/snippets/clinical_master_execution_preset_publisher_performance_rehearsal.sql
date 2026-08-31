-- Rollback-only rehearsal for the CLINICAL-MASTER-PR-022 performance candidate.
--
-- LOCAL DISPOSABLE DATABASE ONLY. Run as a local superuser after copying the
-- exact fixture into the database container:
--
--   psql -U supabase_admin \
--     -v payload_server_path=/tmp/clinical-master-execution-preset-release-v1.json \
--     -f supabase/snippets/clinical_master_execution_preset_publisher_performance_rehearsal.sql
--
-- The script requires the exact 510-order / 108-preset pre-publish baseline.
-- It never commits the candidate release and proves the baseline is restored.

\set ON_ERROR_STOP on
\timing on

\if :{?payload_server_path}
\else
  \echo 'payload_server_path is required'
  \quit 2
\endif

create temp table clinical_master_publisher_rehearsal_input (
  payload jsonb not null
);

insert into clinical_master_publisher_rehearsal_input(payload)
values (
  pg_catalog.pg_read_file(:'payload_server_path')::jsonb
);

do $preflight$
begin
  if (
    select pg_catalog.count(*)
    from master.master_records
    where record_type = 'order'
  ) <> 510 then
    raise exception 'publisher_rehearsal_master_order_baseline_mismatch';
  end if;
  if (
    select pg_catalog.count(*)
    from master.dispensing_order_prescription_presets
    where is_current
  ) <> 108 then
    raise exception 'publisher_rehearsal_dispensing_baseline_mismatch';
  end if;
  if (select pg_catalog.count(*) from master.order_execution_presets) <> 108
    or (
      select pg_catalog.count(*)
      from master.order_execution_preset_current
    ) <> 108
  then
    raise exception 'publisher_rehearsal_execution_preset_baseline_mismatch';
  end if;
  if exists (
    select 1
    from master.master_releases
    where source_fingerprint =
      '8b939f7a0c752bb7b8989aca80380e51c1a720a8b98ccb35d1ceb1408648a0f0'
  ) then
    raise exception 'publisher_rehearsal_release_already_exists';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_proc function
    join pg_catalog.pg_namespace namespace
      on namespace.oid = function.pronamespace
    where namespace.nspname = 'private'
      and function.proname in (
        'publish_clinical_master_release',
        'publish_clinical_master_release_cumulative',
        'clair_order_detail_inputs_are_valid_for_schema_v1',
        'clair_order_execution_preset_contract_is_valid'
      )
      and (
        pg_catalog.pg_get_userbyid(function.proowner) <> 'postgres'
        or not function.prosecdef
        or function.proconfig is null
        or pg_catalog.has_function_privilege('anon', function.oid, 'execute')
        or pg_catalog.has_function_privilege(
          'authenticated',
          function.oid,
          'execute'
        )
        or pg_catalog.has_function_privilege(
          'service_role',
          function.oid,
          'execute'
        )
        or exists (
          select 1
          from pg_catalog.aclexplode(
            coalesce(
              function.proacl,
              pg_catalog.acldefault('f', function.proowner)
            )
          ) acl
          where acl.grantee = 0
            and acl.privilege_type = 'EXECUTE'
        )
      )
  ) or (
    select pg_catalog.count(*)
    from pg_catalog.pg_proc function
    join pg_catalog.pg_namespace namespace
      on namespace.oid = function.pronamespace
    where namespace.nspname = 'private'
      and function.proname in (
        'publish_clinical_master_release',
        'publish_clinical_master_release_cumulative',
        'clair_order_detail_inputs_are_valid_for_schema_v1',
        'clair_order_execution_preset_contract_is_valid'
      )
  ) <> 4 then
    raise exception 'publisher_rehearsal_function_security_contract_mismatch';
  end if;

  if (
    select pg_catalog.count(*)
    from pg_catalog.pg_proc function
    join pg_catalog.pg_namespace namespace
      on namespace.oid = function.pronamespace
    where namespace.nspname = 'private'
      and function.proname in (
        'publish_clinical_master_release',
        'publish_clinical_master_release_cumulative'
      )
      and function.proconfig = array[
        'search_path=public, private, master, extensions, pg_catalog'
      ]::text[]
  ) <> 2
    or (
      select pg_catalog.count(*)
      from pg_catalog.pg_proc function
      join pg_catalog.pg_namespace namespace
        on namespace.oid = function.pronamespace
      where namespace.nspname = 'private'
        and function.proname in (
          'clair_order_detail_inputs_are_valid_for_schema_v1',
          'clair_order_execution_preset_contract_is_valid'
        )
        and function.proconfig = array['search_path=""']::text[]
    ) <> 2
  then
    raise exception 'publisher_rehearsal_function_search_path_mismatch';
  end if;
end;
$preflight$;

do $validator_equivalence$
declare
  v_clinical_order_type text;
  v_detail_schema_version integer;
  v_default_detail_inputs jsonb;
  v_schema jsonb;
  v_old_result boolean;
  v_new_result boolean;
begin
  if (
    select pg_catalog.count(distinct record.value -> 'detail'
      -> 'executionPreset' ->> 'clinicalOrderType')
    from clinical_master_publisher_rehearsal_input input,
      lateral pg_catalog.jsonb_array_elements(input.payload -> 'records') record(value)
    where record.value ->> 'recordType' = 'order'
  ) <> 8 then
    raise exception 'publisher_rehearsal_fixture_clinical_type_coverage_mismatch';
  end if;

  -- The exact candidate fixture has no external_lab record. Exercise one
  -- schema-valid empty partial input for that ninth supported type so the old
  -- and optimized validators are compared across the complete contract.
  for v_clinical_order_type, v_detail_schema_version, v_default_detail_inputs in
    select distinct on (
      record.value -> 'detail' -> 'executionPreset' ->> 'clinicalOrderType'
    )
      record.value -> 'detail' -> 'executionPreset' ->> 'clinicalOrderType',
      (record.value -> 'detail' -> 'executionPreset'
        ->> 'detailSchemaVersion')::integer,
      record.value -> 'detail' -> 'executionPreset' -> 'defaultDetailInputs'
    from clinical_master_publisher_rehearsal_input input,
      lateral pg_catalog.jsonb_array_elements(input.payload -> 'records') record(value)
    where record.value ->> 'recordType' = 'order'
    union all
    select 'external_lab', 1, '{}'::jsonb
  loop
    v_schema := private.clair_order_detail_field_schema_v1(
      v_clinical_order_type
    );
    v_old_result := private.clair_order_detail_inputs_are_valid(
      v_clinical_order_type,
      v_detail_schema_version,
      v_default_detail_inputs,
      false
    );
    v_new_result := private.clair_order_detail_inputs_are_valid_for_schema_v1(
      v_clinical_order_type,
      v_detail_schema_version,
      v_default_detail_inputs,
      false,
      v_schema
    );
    if v_old_result is distinct from v_new_result
      or v_old_result is distinct from true
    then
      raise exception 'publisher_rehearsal_valid_validator_mismatch';
    end if;

    v_old_result := private.clair_order_detail_inputs_are_valid(
      v_clinical_order_type,
      v_detail_schema_version,
      '{"__unknownField":true}'::jsonb,
      false
    );
    v_new_result := private.clair_order_detail_inputs_are_valid_for_schema_v1(
      v_clinical_order_type,
      v_detail_schema_version,
      '{"__unknownField":true}'::jsonb,
      false,
      v_schema
    );
    if v_old_result is distinct from v_new_result
      or v_old_result is distinct from false
    then
      raise exception 'publisher_rehearsal_invalid_validator_mismatch';
    end if;
  end loop;
end;
$validator_equivalence$;

do $negative_contracts$
declare
  v_payload jsonb := (
    select payload
    from clinical_master_publisher_rehearsal_input
  );
  v_order_index integer;
  v_mutated jsonb;
  v_message text;
begin
  select (record.ordinality - 1)::integer
  into v_order_index
  from pg_catalog.jsonb_array_elements(v_payload -> 'records')
    with ordinality record(value, ordinality)
  where record.value ->> 'recordType' = 'order'
  limit 1;

  v_mutated := pg_catalog.jsonb_set(
    v_payload,
    array[
      'records', v_order_index::text, 'detail', 'executionPreset',
      'clinicalUseAllowed'
    ],
    'true'::jsonb
  );
  begin
    perform private.publish_clinical_master_release(v_mutated, null);
    raise exception 'publisher_rehearsal_clinical_gate_unexpected_success';
  exception when others then
    v_message := sqlerrm;
    if sqlstate <> '42501'
      or v_message <> 'clinical_master_execution_preset_clinical_use_forbidden'
    then
      raise exception 'publisher_rehearsal_clinical_gate_wrong_error:%', v_message;
    end if;
  end;

  v_mutated := pg_catalog.jsonb_set(
    v_payload,
    array[
      'records', v_order_index::text, 'detail', 'executionPreset',
      'presetStatus'
    ],
    '"clinically_reviewed"'::jsonb
  );
  begin
    perform private.publish_clinical_master_release(v_mutated, null);
    raise exception 'publisher_rehearsal_preset_status_unexpected_success';
  exception when others then
    v_message := sqlerrm;
    if v_message <> 'clinical_master_execution_preset_status_invalid' then
      raise exception 'publisher_rehearsal_preset_status_wrong_error:%', v_message;
    end if;
  end;

  v_mutated := pg_catalog.jsonb_set(
    v_payload,
    array['records', v_order_index::text, 'detail', '__unknownDetailField'],
    'true'::jsonb
  );
  begin
    perform private.publish_clinical_master_release(v_mutated, null);
    raise exception 'publisher_rehearsal_unknown_detail_unexpected_success';
  exception when others then
    v_message := sqlerrm;
    if v_message <> 'clinical_master_unknown_detail_field'
      and v_message not like 'clinical_master_unknown_detail_field:%'
    then
      raise exception 'publisher_rehearsal_unknown_detail_wrong_error:%', v_message;
    end if;
  end;
end;
$negative_contracts$;

-- Force a non-canonical record order so both legacy fallback paths must
-- canonicalize before computing the known source fingerprint. The exact-
-- digest fast path is exercised later through the outer publisher.
create temp table clinical_master_publisher_fallback_input as
select pg_catalog.jsonb_set(
  payload,
  '{records}',
  (
    select pg_catalog.jsonb_agg(record.value order by record.ordinality desc)
    from pg_catalog.jsonb_array_elements(payload -> 'records')
      with ordinality record(value, ordinality)
  )
) as payload
from clinical_master_publisher_rehearsal_input;

create temp table clinical_master_publisher_fallback_result (
  result jsonb not null
);

begin;
set constraints all deferred;
set local statement_timeout = '60s';
set local clinical_master.adoption_scope = 'payload';

insert into clinical_master_publisher_fallback_result(result)
select private.publish_clinical_master_release_cumulative(payload, null)
from clinical_master_publisher_fallback_input;

do $assert_absent_marker_fallback$
begin
  if (
    select result ->> 'sourceFingerprint'
    from clinical_master_publisher_fallback_result
  ) <> '8b939f7a0c752bb7b8989aca80380e51c1a720a8b98ccb35d1ceb1408648a0f0'
    or (
      select (result ->> 'recordCount')::integer
      from clinical_master_publisher_fallback_result
    ) <> 689
    or (select pg_catalog.count(*) from master.order_execution_presets) <> 630
    or (
      select pg_catalog.count(*)
      from master.order_execution_preset_current
    ) <> 522
  then
    raise exception 'publisher_rehearsal_absent_marker_fallback_mismatch';
  end if;
end;
$assert_absent_marker_fallback$;

rollback;

do $assert_absent_marker_rollback$
begin
  if exists (
    select 1
    from master.master_releases
    where source_fingerprint =
      '8b939f7a0c752bb7b8989aca80380e51c1a720a8b98ccb35d1ceb1408648a0f0'
  )
    or (select pg_catalog.count(*) from master.order_execution_presets) <> 108
    or (
      select pg_catalog.count(*)
      from master.order_execution_preset_current
    ) <> 108
    or coalesce(
      pg_catalog.current_setting(
        'clinical_master.publisher_canonical_sha256',
        true
      ),
      ''
    ) <> ''
  then
    raise exception 'publisher_rehearsal_absent_marker_rollback_residue';
  end if;
end;
$assert_absent_marker_rollback$;

begin;
set constraints all deferred;
set local statement_timeout = '60s';
set local clinical_master.adoption_scope = 'payload';
set local clinical_master.publisher_canonical_sha256 =
  '0000000000000000000000000000000000000000000000000000000000000000';

insert into clinical_master_publisher_fallback_result(result)
select private.publish_clinical_master_release_cumulative(payload, null)
from clinical_master_publisher_fallback_input;

do $assert_wrong_marker_fallback$
begin
  if (
    select result ->> 'sourceFingerprint'
    from clinical_master_publisher_fallback_result
  ) <> '8b939f7a0c752bb7b8989aca80380e51c1a720a8b98ccb35d1ceb1408648a0f0'
    or (
      select (result ->> 'recordCount')::integer
      from clinical_master_publisher_fallback_result
    ) <> 689
    or (select pg_catalog.count(*) from master.order_execution_presets) <> 630
    or (
      select pg_catalog.count(*)
      from master.order_execution_preset_current
    ) <> 522
  then
    raise exception 'publisher_rehearsal_wrong_marker_fallback_mismatch';
  end if;
end;
$assert_wrong_marker_fallback$;

rollback;

do $assert_wrong_marker_rollback$
begin
  if exists (
    select 1
    from master.master_releases
    where source_fingerprint =
      '8b939f7a0c752bb7b8989aca80380e51c1a720a8b98ccb35d1ceb1408648a0f0'
  )
    or (select pg_catalog.count(*) from master.order_execution_presets) <> 108
    or (
      select pg_catalog.count(*)
      from master.order_execution_preset_current
    ) <> 108
    or coalesce(
      pg_catalog.current_setting(
        'clinical_master.publisher_canonical_sha256',
        true
      ),
      ''
    ) <> ''
  then
    raise exception 'publisher_rehearsal_wrong_marker_rollback_residue';
  end if;
end;
$assert_wrong_marker_rollback$;

create temp table clinical_master_publisher_rehearsal_result (
  attempt smallint primary key,
  result jsonb not null
);

begin;
set constraints all deferred;
set local statement_timeout = '60s';

insert into clinical_master_publisher_rehearsal_result(attempt, result)
select 1, private.publish_clinical_master_release(payload, null)
from clinical_master_publisher_rehearsal_input;

select result as first_publisher_result
from clinical_master_publisher_rehearsal_result;

do $assert_publish$
declare
  v_release_id uuid := (
    select (result ->> 'releaseId')::uuid
    from clinical_master_publisher_rehearsal_result
    where attempt = 1
  );
begin
  if (
    select result ->> 'sourceFingerprint'
    from clinical_master_publisher_rehearsal_result
    where attempt = 1
  ) <> '8b939f7a0c752bb7b8989aca80380e51c1a720a8b98ccb35d1ceb1408648a0f0'
    or (
      select (result ->> 'recordCount')::integer
      from clinical_master_publisher_rehearsal_result
      where attempt = 1
    ) <> 689
    or (
      select (result ->> 'idempotent')::boolean
      from clinical_master_publisher_rehearsal_result
      where attempt = 1
    )
    or (
      select result ->> 'adoptionScope'
      from clinical_master_publisher_rehearsal_result
      where attempt = 1
    ) <> 'payload'
    or coalesce(
      pg_catalog.current_setting(
        'clinical_master.publisher_canonical_sha256',
        true
      ),
      ''
    ) <> ''
    or coalesce(
      pg_catalog.current_setting('clinical_master.adoption_scope', true),
      ''
    ) <> ''
    or coalesce(
      pg_catalog.current_setting(
        'clinical_master.manifest_write_release_id',
        true
      ),
      ''
    ) <> ''
  then
    raise exception 'publisher_rehearsal_result_contract_mismatch';
  end if;

  if (
    select pg_catalog.count(*)
    from master.master_releases
    where id = v_release_id
      and status = 'published'
      and record_count = 689
  ) <> 1 then
    raise exception 'publisher_rehearsal_release_mismatch';
  end if;
  if (select pg_catalog.count(*) from master.order_execution_presets) <> 630
    or (
      select pg_catalog.count(*)
      from master.order_execution_preset_current
    ) <> 522
  then
    raise exception 'publisher_rehearsal_preset_projection_mismatch';
  end if;
  if (
    select pg_catalog.count(*)
    from private.clinical_master_release_payload_owner_manifest
    where release_id = v_release_id
  ) <> 689 then
    raise exception 'publisher_rehearsal_manifest_mismatch';
  end if;
  if (
    select pg_catalog.count(*)
    from master.master_record_versions
    where release_id = v_release_id
  ) <> 535 or exists (
    select 1
    from master.master_record_versions version
    join private.clinical_master_lab_publish_stage stage
      on stage.release_id = version.release_id
     and stage.master_record_id = version.master_record_id
    where version.release_id = v_release_id
      and (
        version.revision is distinct from stage.effective_revision
        or (version.snapshot - 'revision')
          is distinct from stage.base_content || stage.relation_content
      )
  ) or exists (
    select 1
    from private.clinical_master_lab_publish_stage stage
    join master.master_records owner on owner.id = stage.master_record_id
    where stage.release_id = v_release_id
      and owner.current_revision is distinct from stage.effective_revision
  ) then
    raise exception 'publisher_rehearsal_stage_version_mismatch';
  end if;
  if (
    select pg_catalog.count(*)
    from master.master_review_events event
    join master.master_record_versions version
      on version.master_record_id = event.master_record_id
     and version.revision = event.revision
    where version.release_id = v_release_id
  ) <> 1070 then
    raise exception 'publisher_rehearsal_review_event_mismatch';
  end if;
  if exists (
    select 1
    from master.order_execution_preset_current current_preset
    join master.order_execution_presets preset
      on preset.order_record_id = current_preset.order_record_id
     and preset.id = current_preset.preset_id
     and preset.preset_revision = current_preset.preset_revision
    where preset.preset_status <> 'synthetic_unreviewed'
      or preset.clinical_use_allowed
      or current_preset.activated_in_release_id
        is distinct from preset.source_release_id
  ) then
    raise exception 'publisher_rehearsal_safety_or_lineage_mismatch';
  end if;
end;
$assert_publish$;

insert into clinical_master_publisher_rehearsal_result(attempt, result)
select 2, private.publish_clinical_master_release(payload, null)
from clinical_master_publisher_rehearsal_input;

select result as retry_publisher_result
from clinical_master_publisher_rehearsal_result
where attempt = 2;

do $assert_retry$
declare
  v_first jsonb := (
    select result
    from clinical_master_publisher_rehearsal_result
    where attempt = 1
  );
  v_retry jsonb := (
    select result
    from clinical_master_publisher_rehearsal_result
    where attempt = 2
  );
begin
  if (v_retry ->> 'idempotent')::boolean is distinct from true
    or v_retry ->> 'releaseId' is distinct from v_first ->> 'releaseId'
    or v_retry ->> 'sourceFingerprint'
      is distinct from v_first ->> 'sourceFingerprint'
    or (select pg_catalog.count(*) from master.order_execution_presets) <> 630
    or (
      select pg_catalog.count(*)
      from master.order_execution_preset_current
    ) <> 522
    or (
      select pg_catalog.count(*)
      from private.clinical_master_release_payload_owner_manifest
      where release_id = (v_first ->> 'releaseId')::uuid
    ) <> 689
    or (
      select pg_catalog.count(*)
      from master.master_record_versions
      where release_id = (v_first ->> 'releaseId')::uuid
    ) <> 535
    or coalesce(
      pg_catalog.current_setting(
        'clinical_master.publisher_canonical_sha256',
        true
      ),
      ''
    ) <> ''
    or coalesce(
      pg_catalog.current_setting('clinical_master.adoption_scope', true),
      ''
    ) <> ''
    or coalesce(
      pg_catalog.current_setting(
        'clinical_master.manifest_write_release_id',
        true
      ),
      ''
    ) <> ''
  then
    raise exception 'publisher_rehearsal_retry_mismatch';
  end if;
end;
$assert_retry$;

rollback;

do $assert_rollback$
begin
  if exists (
    select 1
    from master.master_releases
    where source_fingerprint =
      '8b939f7a0c752bb7b8989aca80380e51c1a720a8b98ccb35d1ceb1408648a0f0'
  )
    or (select pg_catalog.count(*) from master.order_execution_presets) <> 108
    or (
      select pg_catalog.count(*)
      from master.order_execution_preset_current
    ) <> 108
    or exists (
      select 1
      from private.clinical_master_release_payload_owner_manifest manifest
      join master.master_releases release
        on release.id = manifest.release_id
      where release.source_fingerprint =
        '8b939f7a0c752bb7b8989aca80380e51c1a720a8b98ccb35d1ceb1408648a0f0'
    )
    or coalesce(
      pg_catalog.current_setting(
        'clinical_master.publisher_canonical_sha256',
        true
      ),
      ''
    ) <> ''
  then
    raise exception 'publisher_rehearsal_rollback_residue';
  end if;
end;
$assert_rollback$;

create temp table clinical_master_publisher_timeout_input as
select pg_catalog.jsonb_set(
  pg_catalog.jsonb_set(
    payload,
    '{releaseKey}',
    '"clinical-master-execution-preset-timeout-rehearsal-v1"'::jsonb
  ),
  '{releaseNotes}',
  '"rollback-only timeout rehearsal"'::jsonb
) as payload
from clinical_master_publisher_rehearsal_input;

\set ON_ERROR_STOP off
begin;
set local statement_timeout = '1500ms';
select private.publish_clinical_master_release(payload, null)
from clinical_master_publisher_timeout_input;
\if :ERROR
  \set publisher_timeout_sqlstate :SQLSTATE
  rollback;
  select :'publisher_timeout_sqlstate' = '57014'
    as publisher_timeout_was_canceled \gset
  \if :publisher_timeout_was_canceled
  \else
    \echo 'publisher timeout rehearsal returned unexpected SQLSTATE' :publisher_timeout_sqlstate
    \quit 4
  \endif
\else
  rollback;
  \echo 'publisher timeout rehearsal unexpectedly succeeded'
  \quit 3
\endif
\set ON_ERROR_STOP on

do $assert_timeout_rollback$
begin
  if exists (
    select 1
    from master.master_releases
    where release_key =
      'clinical-master-execution-preset-timeout-rehearsal-v1'
  )
    or (select pg_catalog.count(*) from master.order_execution_presets) <> 108
    or (
      select pg_catalog.count(*)
      from master.order_execution_preset_current
    ) <> 108
    or exists (
      select 1
      from private.clinical_master_release_payload_owner_manifest manifest
      join master.master_releases release
        on release.id = manifest.release_id
      where release.release_key =
        'clinical-master-execution-preset-timeout-rehearsal-v1'
    )
    or coalesce(
      pg_catalog.current_setting(
        'clinical_master.publisher_canonical_sha256',
        true
      ),
      ''
    ) <> ''
  then
    raise exception 'publisher_rehearsal_timeout_rollback_residue';
  end if;
end;
$assert_timeout_rollback$;

select 'clinical_master_publisher_performance_rehearsal_ok' as result;
