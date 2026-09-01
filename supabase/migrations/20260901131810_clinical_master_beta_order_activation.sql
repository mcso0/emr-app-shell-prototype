-- CLINICAL-MASTER-PR-022 synthetic beta activation follow-up.
--
-- The representative confirmed that the exact release-50 order fixture was
-- validated offline for beta usability and designated 이수지 수의사 as the
-- reviewer label. This migration records that bounded decision, appends one
-- immutable reviewed execution-preset revision for each of the exact 522
-- current master orders, and refreshes only execution-default lineage in the
-- three synthetic target workspaces. It does not expose master tables, touch
-- confirmed encounter orders, or overwrite workspace-owned names and prices.

set lock_timeout = '5s';
set statement_timeout = '120s';

create table if not exists master.order_execution_preset_activation_batches (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  source_release_id uuid not null
    references master.master_releases(id) on delete restrict,
  source_set_sha256 text not null check (source_set_sha256 ~ '^[0-9a-f]{64}$'),
  activated_set_sha256 text not null check (activated_set_sha256 ~ '^[0-9a-f]{64}$'),
  preset_count integer not null check (preset_count = 522),
  compatibility_preset_count integer not null check (
    compatibility_preset_count = 108
  ),
  target_workspace_ids text[] not null check (
    target_workspace_ids = array[
      'clair-demo'::text,
      'workspace-clair-cheongdam'::text,
      'workspace-clinical-master-pilot-v1'::text
    ]
  ),
  negative_control_workspace_id text not null check (
    negative_control_workspace_id = 'clair-foreign-demo'
  ),
  reviewer_label text not null check (
    pg_catalog.length(pg_catalog.btrim(reviewer_label)) between 1 and 120
  ),
  reviewer_label_source text not null check (
    reviewer_label_source = 'representative_designation'
  ),
  review_scope text not null check (
    review_scope = 'offline_master_order_validation'
  ),
  usage_scope text not null check (
    usage_scope = 'synthetic_beta_service_validation'
  ),
  approval_reference text not null check (
    pg_catalog.length(pg_catalog.btrim(approval_reference)) between 1 and 200
  ),
  approval_reason text not null check (
    pg_catalog.length(pg_catalog.btrim(approval_reason)) between 1 and 500
  ),
  source_name_price_fingerprints jsonb not null check (
    pg_catalog.jsonb_typeof(source_name_price_fingerprints) = 'object'
  ),
  recorded_at timestamptz not null,
  unique (source_release_id, approval_reference)
);

create or replace function master.reject_order_execution_preset_activation_batch_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  raise exception 'clinical_master_order_execution_preset_activation_batch_immutable'
    using errcode = '55000';
end;
$function$;

revoke all on function master.reject_order_execution_preset_activation_batch_mutation()
  from public, anon, authenticated, service_role;

drop trigger if exists order_execution_preset_activation_batches_immutable
  on master.order_execution_preset_activation_batches;
create trigger order_execution_preset_activation_batches_immutable
before update or delete on master.order_execution_preset_activation_batches
for each row execute function master.reject_order_execution_preset_activation_batch_mutation();

alter table master.order_execution_preset_activation_batches enable row level security;
revoke all on table master.order_execution_preset_activation_batches
  from public, anon, authenticated, service_role;

comment on table master.order_execution_preset_activation_batches is
  'Append-only owner-confirmed offline review batches for exact synthetic beta execution-preset sets. Not a real-patient or public-launch authorization surface.';

do $activation$
declare
  v_release_id constant uuid := '647629e9-41fe-4d75-a572-99f34bf428ea'::uuid;
  v_expected_source_set_sha constant text :=
    'bf03699073c59eb8344ae2011810dfad986ced4134e267e2bf4747b0bdd4f1bc';
  v_approval_reference constant text :=
    'owner-confirmed-offline-validation-2026-09-01';
  v_reviewer_label constant text := '이수지 수의사';
  v_batch_id uuid;
  v_recorded_at timestamptz;
  v_source_set_sha text;
  v_activated_set_sha text;
  v_source_name_price_fingerprints jsonb;
  v_after_name_price_fingerprints jsonb;
  v_foreign_before text;
  v_foreign_after text;
  v_current_count integer;
  v_reviewed_count integer;
  v_inserted_count integer := 0;
  v_compatibility_inserted_count integer := 0;
  v_updated_pointer_count integer := 0;
  v_updated_catalog_count integer := 0;
  v_target record;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'clinical_master_beta_order_activation:' || v_release_id::text,
      0
    )
  );

  if not exists (
    select 1
    from master.master_releases release_row
    where release_row.id = v_release_id
      and release_row.release_no = 50
      and release_row.status = 'published'
  ) then
    raise exception 'clinical_master_beta_activation_release_mismatch'
      using errcode = '23514';
  end if;

  select
    pg_catalog.count(*)::integer,
    pg_catalog.count(*) filter (
      where preset.preset_status = 'clinically_reviewed'
        and preset.clinical_use_allowed
    )::integer,
    private.clinical_master_sha256(
      coalesce(
        pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object(
            'presetId', preset.id,
            'presetKey', preset.preset_key,
            'presetRevision', preset.preset_revision,
            'orderRecordId', preset.order_record_id,
            'orderRecordRevision', preset.order_record_revision,
            'clinicalOrderType', preset.clinical_order_type,
            'detailSchemaVersion', preset.detail_schema_version,
            'defaultDetailInputs', preset.default_detail_inputs,
            'fieldPolicies', preset.field_policies,
            'provenance', preset.provenance,
            'presetStatus', preset.preset_status,
            'clinicalUseAllowed', preset.clinical_use_allowed,
            'contentSha256', preset.content_sha256,
            'sourceArtifactSha256', preset.source_artifact_sha256,
            'sourceReleaseId', preset.source_release_id
          ) order by preset.order_record_id
        ),
        '[]'::jsonb
      )
    )
  into v_current_count, v_reviewed_count, v_source_set_sha
  from master.order_execution_preset_current current_preset
  join master.order_execution_presets preset
    on preset.order_record_id = current_preset.order_record_id
   and preset.id = current_preset.preset_id
   and preset.preset_revision = current_preset.preset_revision;

  if v_current_count <> 522 then
    raise exception 'clinical_master_beta_activation_current_count_mismatch:%',
      v_current_count using errcode = '23514';
  end if;

  select coalesce(
    pg_catalog.jsonb_object_agg(summary.workspace_id, summary.name_price_sha),
    '{}'::jsonb
  )
  into v_source_name_price_fingerprints
  from (
    select
      item.workspace_id,
      private.clinical_master_sha256(
        coalesce(
          pg_catalog.jsonb_agg(
            pg_catalog.jsonb_build_object(
              'id', item.id,
              'name', item.in_hospital_order_name,
              'billingName', item.billing_name,
              'priceKrw', item.price_krw,
              'salesUnit', item.sales_unit
            ) order by item.id
          ),
          '[]'::jsonb
        )
      ) as name_price_sha
    from public.order_catalog_items item
    where item.workspace_id = any(array[
        'clair-demo'::text,
        'workspace-clair-cheongdam'::text,
        'workspace-clinical-master-pilot-v1'::text
      ])
      and item.origin_type = 'clair_master'
    group by item.workspace_id
  ) summary;

  if v_source_name_price_fingerprints is distinct from pg_catalog.jsonb_build_object(
    'clair-demo',
    '21310119241f663fa245f1c59e83d53bddf30aff41cbd7b9acc80352818cfe67',
    'workspace-clair-cheongdam',
    '56355b910d109b8d5d5797f33e8bffe035f66484083efc567aab205a57672c8c',
    'workspace-clinical-master-pilot-v1',
    'd10a8e95ad1da1a81a37b09367ed0a09c82f4b3b1f4951b4d4cfd5e1b56b04b4'
  ) then
    raise exception 'clinical_master_beta_activation_name_price_baseline_drift'
      using errcode = '23514';
  end if;

  select private.clinical_master_sha256(
    coalesce(
      pg_catalog.jsonb_agg(pg_catalog.to_jsonb(item) order by item.id),
      '[]'::jsonb
    )
  )
  into v_foreign_before
  from public.order_catalog_items item
  where item.workspace_id = 'clair-foreign-demo';

  select batch.id, batch.recorded_at
    into v_batch_id, v_recorded_at
  from master.order_execution_preset_activation_batches batch
  where batch.source_release_id = v_release_id
    and batch.approval_reference = v_approval_reference;

  if v_batch_id is null then
    if v_reviewed_count <> 0
      or v_source_set_sha is distinct from v_expected_source_set_sha
      or exists (
        select 1
        from master.order_execution_preset_current current_preset
        join master.order_execution_presets preset
          on preset.order_record_id = current_preset.order_record_id
         and preset.id = current_preset.preset_id
         and preset.preset_revision = current_preset.preset_revision
        where preset.preset_status <> 'synthetic_unreviewed'
           or preset.clinical_use_allowed
           or preset.source_release_id <> v_release_id
      )
    then
      raise exception 'clinical_master_beta_activation_source_set_drift:%/%',
        v_reviewed_count,
        v_source_set_sha using errcode = '23514';
    end if;

    v_batch_id := pg_catalog.gen_random_uuid();
    v_recorded_at := pg_catalog.transaction_timestamp();

    with source_rows as (
      select
        preset.*,
        preset.preset_revision + 1 as next_revision,
        preset.provenance || pg_catalog.jsonb_build_object(
          'activationReview', pg_catalog.jsonb_build_object(
            'schemaVersion', 1,
            'batchId', v_batch_id,
            'reviewerLabel', v_reviewer_label,
            'reviewerLabelSource', 'representative_designation',
            'reviewScope', 'offline_master_order_validation',
            'usageScope', 'synthetic_beta_service_validation',
            'approvalReference', v_approval_reference,
            'recordedAt', v_recorded_at
          )
        ) as next_provenance
      from master.order_execution_preset_current current_preset
      join master.order_execution_presets preset
        on preset.order_record_id = current_preset.order_record_id
       and preset.id = current_preset.preset_id
       and preset.preset_revision = current_preset.preset_revision
    ),
    envelopes as (
      select
        source_rows.*,
        pg_catalog.jsonb_build_object(
          'presetId', source_rows.id,
          'presetKey', source_rows.preset_key,
          'presetRevision', source_rows.next_revision,
          'clinicalOrderType', source_rows.clinical_order_type,
          'detailSchemaVersion', source_rows.detail_schema_version,
          'defaultDetailInputs', source_rows.default_detail_inputs,
          'fieldPolicies', source_rows.field_policies,
          'provenance', source_rows.next_provenance,
          'presetStatus', 'clinically_reviewed',
          'clinicalUseAllowed', true,
          'sourceArtifactSha256', source_rows.source_artifact_sha256
        ) as hash_content
      from source_rows
    )
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
      source_release_id,
      created_at
    )
    select
      envelope.id,
      envelope.preset_key,
      envelope.next_revision,
      envelope.order_record_id,
      envelope.order_record_revision,
      envelope.clinical_order_type,
      envelope.detail_schema_version,
      envelope.default_detail_inputs,
      envelope.field_policies,
      envelope.next_provenance,
      'clinically_reviewed',
      true,
      private.clinical_master_sha256(envelope.hash_content),
      envelope.source_artifact_sha256,
      envelope.source_release_id,
      v_recorded_at
    from envelopes envelope
    order by envelope.order_record_id;

    get diagnostics v_inserted_count = row_count;
    if v_inserted_count <> 522 then
      raise exception 'clinical_master_beta_activation_insert_count_mismatch:%',
        v_inserted_count using errcode = '23514';
    end if;

    update master.order_execution_preset_current current_preset
    set preset_revision = reviewed.preset_revision,
        activated_in_release_id = reviewed.source_release_id,
        updated_at = v_recorded_at
    from master.order_execution_presets reviewed
    where reviewed.order_record_id = current_preset.order_record_id
      and reviewed.id = current_preset.preset_id
      and reviewed.preset_revision = current_preset.preset_revision + 1
      and reviewed.preset_status = 'clinically_reviewed'
      and reviewed.clinical_use_allowed
      and reviewed.provenance #>> '{activationReview,batchId}' = v_batch_id::text;

    get diagnostics v_updated_pointer_count = row_count;
    if v_updated_pointer_count <> 522 then
      raise exception 'clinical_master_beta_activation_pointer_count_mismatch:%',
        v_updated_pointer_count using errcode = '23514';
    end if;

    -- The 108 dispensing profiles intentionally remain pinned to their
    -- existing order-record revision. Append one reviewed compatibility
    -- preset per pinned source identity instead of rewriting the profile,
    -- workspace name, price, or regulatory lineage.
    with pinned_sources as (
      select distinct on (source_preset.id, source_preset.order_record_revision)
        source_preset.*,
        latest.next_revision,
        source_preset.provenance || pg_catalog.jsonb_build_object(
          'activationReview', pg_catalog.jsonb_build_object(
            'schemaVersion', 1,
            'batchId', v_batch_id,
            'reviewerLabel', v_reviewer_label,
            'reviewerLabelSource', 'representative_designation',
            'reviewScope', 'offline_master_order_validation',
            'usageScope', 'synthetic_beta_service_validation',
            'approvalReference', v_approval_reference,
            'recordedAt', v_recorded_at,
            'compatibilityScope', 'workspace_pinned_dispensing_profile',
            'sourcePresetRevision', source_preset.preset_revision
          )
        ) as next_provenance
      from public.order_catalog_items item
      join master.order_execution_presets source_preset
        on source_preset.order_record_id = item.source_master_record_id
       and source_preset.id = item.source_execution_preset_id
       and source_preset.preset_revision = item.source_execution_preset_revision
       and source_preset.order_record_revision = item.source_master_revision
      join master.order_execution_preset_current current_preset
        on current_preset.order_record_id = item.source_master_record_id
      join master.order_execution_presets current_version
        on current_version.order_record_id = current_preset.order_record_id
       and current_version.id = current_preset.preset_id
       and current_version.preset_revision = current_preset.preset_revision
      cross join lateral (
        select pg_catalog.max(version.preset_revision) + 1 as next_revision
        from master.order_execution_presets version
        where version.id = source_preset.id
      ) latest
      where item.workspace_id = any(array[
          'clair-demo'::text,
          'workspace-clair-cheongdam'::text,
          'workspace-clinical-master-pilot-v1'::text
        ])
        and item.origin_type = 'clair_master'
        and item.source_dispensing_profile_id is not null
        and item.source_master_revision <> current_version.order_record_revision
      order by source_preset.id, source_preset.order_record_revision, item.workspace_id
    ),
    compatibility_envelopes as (
      select
        pinned_sources.*,
        pg_catalog.jsonb_build_object(
          'presetId', pinned_sources.id,
          'presetKey', pinned_sources.preset_key,
          'presetRevision', pinned_sources.next_revision,
          'clinicalOrderType', pinned_sources.clinical_order_type,
          'detailSchemaVersion', pinned_sources.detail_schema_version,
          'defaultDetailInputs', pinned_sources.default_detail_inputs,
          'fieldPolicies', pinned_sources.field_policies,
          'provenance', pinned_sources.next_provenance,
          'presetStatus', 'clinically_reviewed',
          'clinicalUseAllowed', true,
          'sourceArtifactSha256', pinned_sources.source_artifact_sha256
        ) as hash_content
      from pinned_sources
    )
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
      source_release_id,
      created_at
    )
    select
      envelope.id,
      envelope.preset_key,
      envelope.next_revision,
      envelope.order_record_id,
      envelope.order_record_revision,
      envelope.clinical_order_type,
      envelope.detail_schema_version,
      envelope.default_detail_inputs,
      envelope.field_policies,
      envelope.next_provenance,
      'clinically_reviewed',
      true,
      private.clinical_master_sha256(envelope.hash_content),
      envelope.source_artifact_sha256,
      envelope.source_release_id,
      v_recorded_at
    from compatibility_envelopes envelope
    order by envelope.order_record_id;

    get diagnostics v_compatibility_inserted_count = row_count;
    if v_compatibility_inserted_count <> 108 then
      raise exception 'clinical_master_beta_activation_compatibility_count_mismatch:%',
        v_compatibility_inserted_count using errcode = '23514';
    end if;
  end if;

  with reviewed_current as (
    select
      current_preset.activated_in_release_id,
      preset.*,
      pg_catalog.jsonb_build_object(
        'id', preset.id,
        'key', preset.preset_key,
        'revision', preset.preset_revision,
        'orderRecordRevision', preset.order_record_revision,
        'clinicalOrderType', preset.clinical_order_type,
        'detailSchemaVersion', preset.detail_schema_version,
        'defaultDetailInputs', preset.default_detail_inputs,
        'fieldPolicies', preset.field_policies,
        'provenance', preset.provenance,
        'presetStatus', preset.preset_status,
        'clinicalUseAllowed', preset.clinical_use_allowed,
        'contentSha256', preset.content_sha256,
        'sourceArtifactSha256', preset.source_artifact_sha256,
        'sourceReleaseId', preset.source_release_id,
        'activatedReleaseId', current_preset.activated_in_release_id
      ) as execution_preset_snapshot
    from master.order_execution_preset_current current_preset
    join master.order_execution_presets preset
      on preset.order_record_id = current_preset.order_record_id
     and preset.id = current_preset.preset_id
     and preset.preset_revision = current_preset.preset_revision
    where preset.preset_status = 'clinically_reviewed'
      and preset.clinical_use_allowed
      and preset.provenance #>> '{activationReview,batchId}' = v_batch_id::text
  ),
  reviewed_compatibility as (
    select
      preset.source_release_id as activated_in_release_id,
      preset.*,
      pg_catalog.jsonb_build_object(
        'id', preset.id,
        'key', preset.preset_key,
        'revision', preset.preset_revision,
        'orderRecordRevision', preset.order_record_revision,
        'clinicalOrderType', preset.clinical_order_type,
        'detailSchemaVersion', preset.detail_schema_version,
        'defaultDetailInputs', preset.default_detail_inputs,
        'fieldPolicies', preset.field_policies,
        'provenance', preset.provenance,
        'presetStatus', preset.preset_status,
        'clinicalUseAllowed', preset.clinical_use_allowed,
        'contentSha256', preset.content_sha256,
        'sourceArtifactSha256', preset.source_artifact_sha256,
        'sourceReleaseId', preset.source_release_id,
        'activatedReleaseId', preset.source_release_id
      ) as execution_preset_snapshot
    from master.order_execution_presets preset
    where preset.preset_status = 'clinically_reviewed'
      and preset.clinical_use_allowed
      and preset.provenance #>> '{activationReview,batchId}' = v_batch_id::text
      and preset.provenance #>> '{activationReview,compatibilityScope}'
        = 'workspace_pinned_dispensing_profile'
  ),
  reviewed_sources as (
    select * from reviewed_current
    union all
    select * from reviewed_compatibility
  ),
  candidates as (
    select
      item.workspace_id,
      item.id,
      reviewed_sources.id as preset_id,
      reviewed_sources.preset_revision,
      reviewed_sources.content_sha256,
      reviewed_sources.default_detail_inputs,
      reviewed_sources.field_policies,
      reviewed_sources.clinical_order_type,
      reviewed_sources.detail_schema_version,
      private.clair_order_detail_field_schema_v1(
        reviewed_sources.clinical_order_type
      ) as detail_field_schema,
      pg_catalog.jsonb_set(
        item.source_projection_snapshot,
        '{executionPreset}',
        reviewed_sources.execution_preset_snapshot,
        true
      ) as source_projection_snapshot,
      case
        when item.source_dispensing_profile_id is null
          and item.price_krw is null
          then false
        else item.billing_reflection_enabled
      end as billing_reflection_enabled,
      case
        when item.source_dispensing_profile_id is not null
          then 'pending_activation'
        else 'active'
      end as availability_status
    from public.order_catalog_items item
    join reviewed_sources
      on reviewed_sources.order_record_id = item.source_master_record_id
     and reviewed_sources.order_record_revision = item.source_master_revision
    where item.workspace_id = any(array[
        'clair-demo'::text,
        'workspace-clair-cheongdam'::text,
        'workspace-clinical-master-pilot-v1'::text
      ])
      and item.origin_type = 'clair_master'
      and not (
        coalesce(item.customized_fields, array[]::text[])
        && array['defaultDetailInputs', 'default_detail_inputs', '*']::text[]
      )
  )
  update public.order_catalog_items item
  set default_detail_inputs = candidate.default_detail_inputs,
      default_detail_input_policies = candidate.field_policies,
      source_execution_preset_id = candidate.preset_id,
      source_execution_preset_revision = candidate.preset_revision,
      source_execution_preset_sha256 = candidate.content_sha256,
      clinical_order_type = candidate.clinical_order_type,
      is_external_lab = candidate.clinical_order_type = 'external_lab',
      detail_schema_version = candidate.detail_schema_version,
      detail_field_schema = candidate.detail_field_schema,
      source_projection_snapshot = candidate.source_projection_snapshot,
      source_projection_fingerprint =
        private.clinical_master_projection_fingerprint(
          candidate.source_projection_snapshot
        ),
      billing_reflection_enabled = candidate.billing_reflection_enabled,
      availability_status = candidate.availability_status,
      catalog_revision = item.catalog_revision + 1,
      updated_at = coalesce(v_recorded_at, pg_catalog.transaction_timestamp())
  from candidates candidate
  where item.workspace_id = candidate.workspace_id
    and item.id = candidate.id
    and (
      item.default_detail_inputs is distinct from candidate.default_detail_inputs
      or item.default_detail_input_policies is distinct from candidate.field_policies
      or item.source_execution_preset_id is distinct from candidate.preset_id
      or item.source_execution_preset_revision is distinct from candidate.preset_revision
      or item.source_execution_preset_sha256 is distinct from candidate.content_sha256
      or item.clinical_order_type is distinct from candidate.clinical_order_type
      or item.detail_schema_version is distinct from candidate.detail_schema_version
      or item.detail_field_schema is distinct from candidate.detail_field_schema
      or item.source_projection_snapshot is distinct from candidate.source_projection_snapshot
      or item.billing_reflection_enabled is distinct from candidate.billing_reflection_enabled
      or item.availability_status is distinct from candidate.availability_status
    );

  get diagnostics v_updated_catalog_count = row_count;
  if v_updated_catalog_count not in (0, 1566) then
    raise exception 'clinical_master_beta_activation_catalog_update_count_mismatch:%',
      v_updated_catalog_count using errcode = '23514';
  end if;

  select private.clinical_master_sha256(
    coalesce(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'presetId', preset.id,
          'presetKey', preset.preset_key,
          'presetRevision', preset.preset_revision,
          'orderRecordId', preset.order_record_id,
          'orderRecordRevision', preset.order_record_revision,
          'clinicalOrderType', preset.clinical_order_type,
          'detailSchemaVersion', preset.detail_schema_version,
          'defaultDetailInputs', preset.default_detail_inputs,
          'fieldPolicies', preset.field_policies,
          'provenance', preset.provenance,
          'presetStatus', preset.preset_status,
          'clinicalUseAllowed', preset.clinical_use_allowed,
          'contentSha256', preset.content_sha256,
          'sourceArtifactSha256', preset.source_artifact_sha256,
          'sourceReleaseId', preset.source_release_id
        ) order by preset.order_record_id
      ),
      '[]'::jsonb
    )
  )
  into v_activated_set_sha
  from master.order_execution_preset_current current_preset
  join master.order_execution_presets preset
    on preset.order_record_id = current_preset.order_record_id
   and preset.id = current_preset.preset_id
   and preset.preset_revision = current_preset.preset_revision;

  select coalesce(
    pg_catalog.jsonb_object_agg(summary.workspace_id, summary.name_price_sha),
    '{}'::jsonb
  )
  into v_after_name_price_fingerprints
  from (
    select
      item.workspace_id,
      private.clinical_master_sha256(
        coalesce(
          pg_catalog.jsonb_agg(
            pg_catalog.jsonb_build_object(
              'id', item.id,
              'name', item.in_hospital_order_name,
              'billingName', item.billing_name,
              'priceKrw', item.price_krw,
              'salesUnit', item.sales_unit
            ) order by item.id
          ),
          '[]'::jsonb
        )
      ) as name_price_sha
    from public.order_catalog_items item
    where item.workspace_id = any(array[
        'clair-demo'::text,
        'workspace-clair-cheongdam'::text,
        'workspace-clinical-master-pilot-v1'::text
      ])
      and item.origin_type = 'clair_master'
    group by item.workspace_id
  ) summary;

  if v_after_name_price_fingerprints is distinct from v_source_name_price_fingerprints then
    raise exception 'clinical_master_beta_activation_name_price_mutation'
      using errcode = '23514';
  end if;

  select private.clinical_master_sha256(
    coalesce(
      pg_catalog.jsonb_agg(pg_catalog.to_jsonb(item) order by item.id),
      '[]'::jsonb
    )
  )
  into v_foreign_after
  from public.order_catalog_items item
  where item.workspace_id = 'clair-foreign-demo';

  if v_foreign_after is distinct from v_foreign_before then
    raise exception 'clinical_master_beta_activation_foreign_workspace_mutation'
      using errcode = '23514';
  end if;

  insert into master.order_execution_preset_activation_batches (
    id,
    source_release_id,
    source_set_sha256,
    activated_set_sha256,
    preset_count,
    compatibility_preset_count,
    target_workspace_ids,
    negative_control_workspace_id,
    reviewer_label,
    reviewer_label_source,
    review_scope,
    usage_scope,
    approval_reference,
    approval_reason,
    source_name_price_fingerprints,
    recorded_at
  ) values (
    v_batch_id,
    v_release_id,
    v_expected_source_set_sha,
    v_activated_set_sha,
    522,
    108,
    array[
      'clair-demo'::text,
      'workspace-clair-cheongdam'::text,
      'workspace-clinical-master-pilot-v1'::text
    ],
    'clair-foreign-demo',
    v_reviewer_label,
    'representative_designation',
    'offline_master_order_validation',
    'synthetic_beta_service_validation',
    v_approval_reference,
    'Representative confirmed offline validation and approved exact synthetic beta master Orders for service usability testing.',
    v_source_name_price_fingerprints,
    v_recorded_at
  )
  on conflict (source_release_id, approval_reference) do nothing;

  if not exists (
    select 1
    from master.order_execution_preset_activation_batches batch
    where batch.id = v_batch_id
      and batch.source_release_id = v_release_id
      and batch.source_set_sha256 = v_expected_source_set_sha
      and batch.activated_set_sha256 = v_activated_set_sha
      and batch.preset_count = 522
      and batch.compatibility_preset_count = 108
      and batch.reviewer_label = v_reviewer_label
      and batch.review_scope = 'offline_master_order_validation'
      and batch.usage_scope = 'synthetic_beta_service_validation'
      and batch.source_name_price_fingerprints = v_source_name_price_fingerprints
  ) then
    raise exception 'clinical_master_beta_activation_batch_mismatch'
      using errcode = '23514';
  end if;

  select pg_catalog.count(*)::integer
  into v_reviewed_count
  from master.order_execution_preset_current current_preset
  join master.order_execution_presets preset
    on preset.order_record_id = current_preset.order_record_id
   and preset.id = current_preset.preset_id
   and preset.preset_revision = current_preset.preset_revision
  where preset.preset_status = 'clinically_reviewed'
    and preset.clinical_use_allowed
    and preset.provenance #>> '{activationReview,batchId}' = v_batch_id::text
    and preset.content_sha256 = private.clinical_master_sha256(
      private.clair_order_execution_preset_hash_content(
        pg_catalog.jsonb_build_object(
          'presetId', preset.id,
          'presetKey', preset.preset_key,
          'presetRevision', preset.preset_revision,
          'clinicalOrderType', preset.clinical_order_type,
          'detailSchemaVersion', preset.detail_schema_version,
          'defaultDetailInputs', preset.default_detail_inputs,
          'fieldPolicies', preset.field_policies,
          'provenance', preset.provenance,
          'presetStatus', preset.preset_status,
          'clinicalUseAllowed', preset.clinical_use_allowed,
          'sourceArtifactSha256', preset.source_artifact_sha256
        )
      )
    );

  if v_reviewed_count <> 522 then
    raise exception 'clinical_master_beta_activation_reviewed_count_mismatch:%',
      v_reviewed_count using errcode = '23514';
  end if;

  select pg_catalog.count(*)::integer
  into v_compatibility_inserted_count
  from master.order_execution_presets preset
  where preset.preset_status = 'clinically_reviewed'
    and preset.clinical_use_allowed
    and preset.provenance #>> '{activationReview,batchId}' = v_batch_id::text
    and preset.provenance #>> '{activationReview,compatibilityScope}'
      = 'workspace_pinned_dispensing_profile'
    and preset.content_sha256 = private.clinical_master_sha256(
      private.clair_order_execution_preset_hash_content(
        pg_catalog.jsonb_build_object(
          'presetId', preset.id,
          'presetKey', preset.preset_key,
          'presetRevision', preset.preset_revision,
          'clinicalOrderType', preset.clinical_order_type,
          'detailSchemaVersion', preset.detail_schema_version,
          'defaultDetailInputs', preset.default_detail_inputs,
          'fieldPolicies', preset.field_policies,
          'provenance', preset.provenance,
          'presetStatus', preset.preset_status,
          'clinicalUseAllowed', preset.clinical_use_allowed,
          'sourceArtifactSha256', preset.source_artifact_sha256
        )
      )
    );

  if v_compatibility_inserted_count <> 108 then
    raise exception 'clinical_master_beta_activation_compatibility_readback_mismatch:%',
      v_compatibility_inserted_count using errcode = '23514';
  end if;

  for v_target in
    select *
    from (values
      ('clair-demo'::text),
      ('workspace-clair-cheongdam'::text),
      ('workspace-clinical-master-pilot-v1'::text)
    ) target(workspace_id)
  loop
    if (
      select pg_catalog.count(*)::integer
      from public.order_catalog_items item
      join master.order_execution_presets copied_preset
        on copied_preset.order_record_id = item.source_master_record_id
       and copied_preset.order_record_revision = item.source_master_revision
       and copied_preset.id = item.source_execution_preset_id
       and copied_preset.preset_revision = item.source_execution_preset_revision
      where item.workspace_id = v_target.workspace_id
        and item.origin_type = 'clair_master'
        and item.default_detail_inputs <> '{}'::jsonb
        and copied_preset.preset_status = 'clinically_reviewed'
        and copied_preset.clinical_use_allowed
        and copied_preset.provenance #>> '{activationReview,batchId}'
          = v_batch_id::text
        and item.source_projection_snapshot #>> '{executionPreset,presetStatus}'
          = 'clinically_reviewed'
        and item.source_projection_snapshot #>> '{executionPreset,clinicalUseAllowed}'
          = 'true'
    ) <> 522 then
      raise exception 'clinical_master_beta_activation_workspace_copy_mismatch:%',
        v_target.workspace_id using errcode = '23514';
    end if;

    if (
      select pg_catalog.count(*)::integer
      from public.order_catalog_items item
      where item.workspace_id = v_target.workspace_id
        and item.origin_type = 'clair_master'
        and item.availability_status = 'active'
    ) <> 414
    or (
      select pg_catalog.count(*)::integer
      from public.order_catalog_items item
      where item.workspace_id = v_target.workspace_id
        and item.origin_type = 'clair_master'
        and item.availability_status = 'pending_activation'
        and item.source_dispensing_profile_id is not null
    ) <> 108
    or exists (
      select 1
      from public.order_catalog_items item
      where item.workspace_id = v_target.workspace_id
        and item.origin_type = 'clair_master'
        and item.availability_status not in ('active', 'pending_activation')
    ) then
      raise exception 'clinical_master_beta_activation_workspace_availability_mismatch:%',
        v_target.workspace_id using errcode = '23514';
    end if;
  end loop;
end;
$activation$;
