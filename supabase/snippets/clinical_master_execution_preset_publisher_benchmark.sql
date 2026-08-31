-- Reproducible local-only rollback benchmark for CLINICAL-MASTER-PR-022.
--
-- The runner creates one disposable database per sample and supplies the exact
-- fixture SHA, run ID, and variant. This probe executes only the exact outer
-- publisher once, validates its result, rolls the transaction back, and emits
-- one JSON object. Functional fallback/negative/timeout coverage remains in the
-- separate performance rehearsal.

\set ON_ERROR_STOP on
\set QUIET on
\pset format unaligned
\pset tuples_only on

\if :{?payload_server_path}
\else
  \echo 'payload_server_path is required'
  \quit 2
\endif
\if :{?fixture_sha256}
\else
  \echo 'fixture_sha256 is required'
  \quit 2
\endif
\if :{?run_id}
\else
  \echo 'run_id is required'
  \quit 2
\endif
\if :{?variant}
\else
  \echo 'variant is required'
  \quit 2
\endif

set client_min_messages = warning;

create temp table clinical_master_publisher_benchmark_input (
  payload jsonb not null
);
create temp table clinical_master_publisher_benchmark_result (
  result jsonb not null
);

insert into clinical_master_publisher_benchmark_input(payload)
values (pg_catalog.pg_read_file(:'payload_server_path')::jsonb);

do $benchmark_preflight$
begin
  if (
    select pg_catalog.count(*)
    from master.master_records
    where record_type='order'
  )<>510
    or (select pg_catalog.count(*) from master.order_execution_presets)<>108
    or (
      select pg_catalog.count(*)
      from master.order_execution_preset_current
    )<>108
  then
    raise exception 'publisher_benchmark_baseline_mismatch';
  end if;
  if (
    select pg_catalog.jsonb_array_length(payload->'records')
    from clinical_master_publisher_benchmark_input
  )<>689 or (
    select pg_catalog.count(*)
    from clinical_master_publisher_benchmark_input input,
      lateral pg_catalog.jsonb_array_elements(input.payload->'records') record(value)
    where record.value->>'recordType'='order'
  )<>522 then
    raise exception 'publisher_benchmark_fixture_shape_mismatch';
  end if;
  if exists (
    select 1
    from master.master_releases
    where source_fingerprint=
      '8b939f7a0c752bb7b8989aca80380e51c1a720a8b98ccb35d1ceb1408648a0f0'
  ) then
    raise exception 'publisher_benchmark_target_release_already_exists';
  end if;
end;
$benchmark_preflight$;

select pg_catalog.jsonb_build_object(
  'orders',(select pg_catalog.count(*) from master.master_records where record_type='order'),
  'presetVersions',(select pg_catalog.count(*) from master.order_execution_presets),
  'presetCurrent',(select pg_catalog.count(*) from master.order_execution_preset_current),
  'releaseFingerprintCount',(
    select pg_catalog.count(*)
    from master.master_releases
    where source_fingerprint=
      '8b939f7a0c752bb7b8989aca80380e51c1a720a8b98ccb35d1ceb1408648a0f0'
  ),
  'stageRows',(select pg_catalog.count(*) from private.clinical_master_lab_publish_stage),
  'releaseSequenceLastValue',(
    select last_value from master.master_releases_release_no_seq
  )
)::text as benchmark_baseline \gset

with relations(regclass_name) as (
  values
    ('master.master_releases'::pg_catalog.regclass),
    ('master.master_records'::pg_catalog.regclass),
    ('master.master_record_versions'::pg_catalog.regclass),
    ('master.master_record_names'::pg_catalog.regclass),
    ('master.master_sources'::pg_catalog.regclass),
    ('master.master_record_sources'::pg_catalog.regclass),
    ('private.clinical_master_lab_publish_stage'::pg_catalog.regclass),
    ('master.order_execution_presets'::pg_catalog.regclass),
    ('master.order_execution_preset_current'::pg_catalog.regclass),
    ('master.master_review_events'::pg_catalog.regclass),
    ('private.clinical_master_release_payload_owner_manifest'::pg_catalog.regclass)
)
select pg_catalog.jsonb_object_agg(
  namespace.nspname||'.'||relation.relname,
  pg_catalog.jsonb_build_object(
    'relationBytes',pg_catalog.pg_relation_size(relation.oid),
    'totalBytes',pg_catalog.pg_total_relation_size(relation.oid),
    'toastBytes',case when relation.reltoastrelid=0 then 0
      else pg_catalog.pg_total_relation_size(relation.reltoastrelid) end
  ) order by namespace.nspname,relation.relname
)::text as benchmark_relations_before
from relations target
join pg_catalog.pg_class relation on relation.oid=target.regclass_name
join pg_catalog.pg_namespace namespace on namespace.oid=relation.relnamespace
\gset

with relations(regclass_name) as (
  values
    ('master.master_releases'::pg_catalog.regclass),
    ('master.master_records'::pg_catalog.regclass),
    ('master.master_record_versions'::pg_catalog.regclass),
    ('master.master_record_names'::pg_catalog.regclass),
    ('master.master_sources'::pg_catalog.regclass),
    ('master.master_record_sources'::pg_catalog.regclass),
    ('private.clinical_master_lab_publish_stage'::pg_catalog.regclass),
    ('master.order_execution_presets'::pg_catalog.regclass),
    ('master.order_execution_preset_current'::pg_catalog.regclass),
    ('master.master_review_events'::pg_catalog.regclass),
    ('private.clinical_master_release_payload_owner_manifest'::pg_catalog.regclass)
)
select pg_catalog.jsonb_object_agg(
  stats.schemaname||'.'||stats.relname,
  pg_catalog.jsonb_build_object(
    'liveTuples',stats.n_live_tup,
    'deadTuples',stats.n_dead_tup,
    'lastVacuum',stats.last_vacuum,
    'lastAutovacuum',stats.last_autovacuum,
    'lastAnalyze',stats.last_analyze,
    'lastAutoanalyze',stats.last_autoanalyze
  ) order by stats.schemaname,stats.relname
)::text as benchmark_stats_before
from relations target
join pg_catalog.pg_stat_user_tables stats on stats.relid=target.regclass_name
\gset

select pg_catalog.jsonb_build_object(
  'outerPublisher',pg_catalog.md5(pg_catalog.pg_get_functiondef(
    'private.publish_clinical_master_release(jsonb,uuid)'::pg_catalog.regprocedure
  )),
  'cumulativePublisher',pg_catalog.md5(pg_catalog.pg_get_functiondef(
    'private.publish_clinical_master_release_cumulative(jsonb,uuid)'::pg_catalog.regprocedure
  ))
)::text as benchmark_function_hashes
\gset

select pg_catalog.jsonb_build_object(
  'serverVersion',pg_catalog.current_setting('server_version'),
  'sharedBuffers',pg_catalog.current_setting('shared_buffers'),
  'workMem',pg_catalog.current_setting('work_mem'),
  'effectiveCacheSize',pg_catalog.current_setting('effective_cache_size'),
  'jit',pg_catalog.current_setting('jit'),
  'trackFunctions',pg_catalog.current_setting('track_functions'),
  'trackIoTiming',pg_catalog.current_setting('track_io_timing')
)::text as benchmark_settings
\gset

select pg_catalog.clock_timestamp() as benchmark_started_at \gset

begin;
set constraints all deferred;
set local lock_timeout='5s';
set local statement_timeout='60s';

insert into clinical_master_publisher_benchmark_result(result)
select private.publish_clinical_master_release(payload,null)
from clinical_master_publisher_benchmark_input;

select result::text as benchmark_result
from clinical_master_publisher_benchmark_result
\gset

select pg_catalog.round(
  extract(epoch from (
    pg_catalog.clock_timestamp()-:'benchmark_started_at'::timestamptz
  ))::numeric*1000,
  3
) as benchmark_sql_elapsed_ms
\gset

do $benchmark_publish$
declare
  v_release_id uuid := (
    select (result->>'releaseId')::uuid
    from clinical_master_publisher_benchmark_result
  );
begin
  if (
    select (result->>'recordCount')::integer
    from clinical_master_publisher_benchmark_result
  )<>689 or (
    select (result->>'idempotent')::boolean
    from clinical_master_publisher_benchmark_result
  ) or (
    select result->>'sourceFingerprint'
    from clinical_master_publisher_benchmark_result
  )<>'8b939f7a0c752bb7b8989aca80380e51c1a720a8b98ccb35d1ceb1408648a0f0'
    or (select pg_catalog.count(*) from master.order_execution_presets)<>630
    or (
      select pg_catalog.count(*)
      from master.order_execution_preset_current
    )<>522
    or (
      select pg_catalog.count(*)
      from private.clinical_master_release_payload_owner_manifest
      where release_id=v_release_id
    )<>689
    or (
      select pg_catalog.count(*)
      from master.master_record_versions
      where release_id=v_release_id
    )<>535
    or exists (
      select 1
      from master.master_record_versions version
      join private.clinical_master_lab_publish_stage stage
        on stage.release_id=version.release_id
       and stage.master_record_id=version.master_record_id
      where version.release_id=v_release_id
        and (
          version.revision is distinct from stage.effective_revision
          or (version.snapshot-'revision')
            is distinct from stage.base_content || stage.relation_content
        )
    )
    or exists (
      select 1
      from private.clinical_master_lab_publish_stage stage
      join master.master_records owner on owner.id=stage.master_record_id
      where stage.release_id=v_release_id
        and owner.current_revision is distinct from stage.effective_revision
    )
    or (
      select pg_catalog.count(*)
      from master.master_review_events event
      join master.master_record_versions version
        on version.master_record_id=event.master_record_id
       and version.revision=event.revision
      where version.release_id=v_release_id
    )<>1070
    or exists (
      with finalize as materialized (
        select
          version.master_record_id,
          version.revision,
          records.value->'names' names,
          records.value->'source' source_content
        from master.master_record_versions version
        join private.clinical_master_lab_publish_stage stage
          on stage.release_id=version.release_id
         and stage.master_record_id=version.master_record_id
        join clinical_master_publisher_benchmark_input input on true
        join lateral pg_catalog.jsonb_array_elements(input.payload->'records')
          records(value)
          on pg_catalog.btrim(records.value->>'masterKey')=stage.master_key
        where version.release_id=v_release_id
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
        )
        or exists (
          select 1
          from (values ('validated'::text),('published'::text)) expected(event_type)
          where (
            select pg_catalog.count(*)
            from master.master_review_events review
            where review.master_record_id=finalize.master_record_id
              and review.revision=finalize.revision
              and review.event_type=expected.event_type
              and review.actor_user_id is null
              and review.actor_label=(
                select payload->>'publishedByLabel'
                from clinical_master_publisher_benchmark_input
              )
              and review.source_surface='publisher'
          )<>1
        )
    )
  then
    raise exception 'publisher_benchmark_publish_contract_mismatch';
  end if;
end;
$benchmark_publish$;

rollback;

do $benchmark_rollback$
begin
  if exists (
    select 1 from master.master_releases
    where source_fingerprint=
      '8b939f7a0c752bb7b8989aca80380e51c1a720a8b98ccb35d1ceb1408648a0f0'
  ) or (select pg_catalog.count(*) from master.order_execution_presets)<>108
    or (
      select pg_catalog.count(*)
      from master.order_execution_preset_current
    )<>108
  then
    raise exception 'publisher_benchmark_rollback_residue';
  end if;
end;
$benchmark_rollback$;

with relations(regclass_name) as (
  values
    ('master.master_releases'::pg_catalog.regclass),
    ('master.master_records'::pg_catalog.regclass),
    ('master.master_record_versions'::pg_catalog.regclass),
    ('master.master_record_names'::pg_catalog.regclass),
    ('master.master_sources'::pg_catalog.regclass),
    ('master.master_record_sources'::pg_catalog.regclass),
    ('private.clinical_master_lab_publish_stage'::pg_catalog.regclass),
    ('master.order_execution_presets'::pg_catalog.regclass),
    ('master.order_execution_preset_current'::pg_catalog.regclass),
    ('master.master_review_events'::pg_catalog.regclass),
    ('private.clinical_master_release_payload_owner_manifest'::pg_catalog.regclass)
)
select pg_catalog.jsonb_object_agg(
  namespace.nspname||'.'||relation.relname,
  pg_catalog.jsonb_build_object(
    'relationBytes',pg_catalog.pg_relation_size(relation.oid),
    'totalBytes',pg_catalog.pg_total_relation_size(relation.oid),
    'toastBytes',case when relation.reltoastrelid=0 then 0
      else pg_catalog.pg_total_relation_size(relation.reltoastrelid) end
  ) order by namespace.nspname,relation.relname
)::text as benchmark_relations_after
from relations target
join pg_catalog.pg_class relation on relation.oid=target.regclass_name
join pg_catalog.pg_namespace namespace on namespace.oid=relation.relnamespace
\gset

with relations(regclass_name) as (
  values
    ('master.master_releases'::pg_catalog.regclass),
    ('master.master_records'::pg_catalog.regclass),
    ('master.master_record_versions'::pg_catalog.regclass),
    ('master.master_record_names'::pg_catalog.regclass),
    ('master.master_sources'::pg_catalog.regclass),
    ('master.master_record_sources'::pg_catalog.regclass),
    ('private.clinical_master_lab_publish_stage'::pg_catalog.regclass),
    ('master.order_execution_presets'::pg_catalog.regclass),
    ('master.order_execution_preset_current'::pg_catalog.regclass),
    ('master.master_review_events'::pg_catalog.regclass),
    ('private.clinical_master_release_payload_owner_manifest'::pg_catalog.regclass)
)
select pg_catalog.jsonb_object_agg(
  stats.schemaname||'.'||stats.relname,
  pg_catalog.jsonb_build_object(
    'liveTuples',stats.n_live_tup,
    'deadTuples',stats.n_dead_tup,
    'lastVacuum',stats.last_vacuum,
    'lastAutovacuum',stats.last_autovacuum,
    'lastAnalyze',stats.last_analyze,
    'lastAutoanalyze',stats.last_autoanalyze
  ) order by stats.schemaname,stats.relname
)::text as benchmark_stats_after
from relations target
join pg_catalog.pg_stat_user_tables stats on stats.relid=target.regclass_name
\gset

select pg_catalog.jsonb_build_object(
  'schemaVersion',1,
  'suite','clinical-master-publisher-benchmark',
  'runId',:'run_id',
  'variant',:'variant',
  'mode','rollback_publish',
  'fixture',pg_catalog.jsonb_build_object(
    'sha256',:'fixture_sha256','records',689,'orders',522
  ),
  'timing',pg_catalog.jsonb_build_object(
    'sqlElapsedMs',:'benchmark_sql_elapsed_ms'::numeric
  ),
  'result',:'benchmark_result'::jsonb,
  'baseline',:'benchmark_baseline'::jsonb,
  'relations',pg_catalog.jsonb_build_object(
    'before',:'benchmark_relations_before'::jsonb,
    'afterRollback',:'benchmark_relations_after'::jsonb
  ),
  'tableStats',pg_catalog.jsonb_build_object(
    'before',:'benchmark_stats_before'::jsonb,
    'afterRollback',:'benchmark_stats_after'::jsonb
  ),
  'functionHashes',:'benchmark_function_hashes'::jsonb,
  'postgresSettings',:'benchmark_settings'::jsonb
)::text as benchmark_result;
