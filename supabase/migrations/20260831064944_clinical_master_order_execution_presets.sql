-- CLINICAL-MASTER-PR-022 foundation.
-- Add a generic, append-only execution-preset projection and workspace-owned
-- copies. This migration does not publish new clinical content, adopt a new
-- release, change confirmed orders, or activate synthetic content.

set lock_timeout = '5s';
set statement_timeout = '120s';

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
    or not private.clair_order_detail_inputs_are_valid(
      p_clinical_order_type,
      p_detail_schema_version,
      p_default_detail_inputs,
      false
    )
  then
    return false;
  end if;

  if p_default_detail_inputs = '{}'::jsonb
    and p_field_policies = '{}'::jsonb
  then
    return false;
  end if;

  v_schema := private.clair_order_detail_field_schema_v1(p_clinical_order_type);

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

  -- Every schema field needs an explicit resolver. A preset must never
  -- silently omit a required field merely because the detail validator can
  -- fill a schema default at runtime.
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

    -- Required schema fields without a schema default are dynamic inputs.
    -- They can only be resolved from the workspace/runtime or entered by the
    -- author; they may not be mislabeled as a fixed/derived/schema default.
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

create table if not exists master.order_execution_presets (
  id uuid not null,
  preset_key text not null,
  preset_revision integer not null check (preset_revision > 0),
  order_record_id uuid not null,
  order_record_revision integer not null check (order_record_revision > 0),
  clinical_order_type text not null check (clinical_order_type in (
    'consultation',
    'clinical_lab',
    'imaging',
    'external_lab',
    'dispensing',
    'treatment',
    'hospitalization',
    'other'
  )),
  detail_schema_version integer not null check (detail_schema_version = 1),
  default_detail_inputs jsonb not null,
  field_policies jsonb not null,
  provenance jsonb not null
    check (
      pg_catalog.jsonb_typeof(provenance) = 'object'
      and pg_catalog.octet_length(provenance::text) <= 131072
    ),
  preset_status text not null check (
    preset_status in ('synthetic_unreviewed', 'clinically_reviewed')
  ),
  clinical_use_allowed boolean not null default false,
  content_sha256 text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  source_artifact_sha256 text not null check (
    source_artifact_sha256 ~ '^[0-9a-f]{64}$'
  ),
  source_release_id uuid not null
    references master.master_releases(id) on delete restrict,
  created_at timestamptz not null default pg_catalog.now(),
  primary key (id, preset_revision),
  unique (preset_key, preset_revision),
  unique (order_record_id, order_record_revision, preset_revision),
  unique (order_record_id, id, preset_revision),
  foreign key (order_record_id)
    references master.orders(master_record_id) on delete restrict,
  foreign key (order_record_id, order_record_revision)
    references master.master_record_versions(master_record_id, revision)
    on delete restrict,
  check (
    private.clair_order_execution_preset_contract_is_valid(
      clinical_order_type,
      detail_schema_version,
      default_detail_inputs,
      field_policies
    )
  ),
  check (preset_status <> 'synthetic_unreviewed' or not clinical_use_allowed)
);

create table if not exists master.order_execution_preset_current (
  order_record_id uuid primary key
    references master.orders(master_record_id) on delete restrict,
  preset_id uuid not null,
  preset_revision integer not null check (preset_revision > 0),
  activated_in_release_id uuid not null
    references master.master_releases(id) on delete restrict,
  updated_at timestamptz not null default pg_catalog.now(),
  foreign key (order_record_id, preset_id, preset_revision)
    references master.order_execution_presets(
      order_record_id,
      id,
      preset_revision
  ) on delete restrict
);

-- The activated release is a projection of the preset's source release, not
-- an independently writable lifecycle flag. Keep the cross-table invariant in
-- a trigger because PostgreSQL CHECK constraints cannot safely consult another
-- table.
create or replace function master.assert_order_execution_preset_current_release()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_source_release_id uuid;
  v_previous_preset_key text;
  v_next_preset_key text;
begin
  select preset.source_release_id
    into v_source_release_id
  from master.order_execution_presets preset
  where preset.order_record_id = new.order_record_id
    and preset.id = new.preset_id
    and preset.preset_revision = new.preset_revision;

  if not found
    or new.activated_in_release_id is distinct from v_source_release_id
  then
    raise exception 'clinical_master_execution_preset_current_release_mismatch'
      using errcode = '23514';
  end if;

  if tg_op = 'UPDATE'
    and (
      old.preset_id is distinct from new.preset_id
      or old.preset_revision is distinct from new.preset_revision
    )
  then
    select preset.preset_key
      into v_previous_preset_key
    from master.order_execution_presets preset
    where preset.order_record_id = old.order_record_id
      and preset.id = old.preset_id
      and preset.preset_revision = old.preset_revision;
    select preset.preset_key
      into v_next_preset_key
    from master.order_execution_presets preset
    where preset.order_record_id = new.order_record_id
      and preset.id = new.preset_id
      and preset.preset_revision = new.preset_revision;

    if old.preset_id is distinct from new.preset_id
      or v_previous_preset_key is distinct from v_next_preset_key
    then
      raise exception 'clinical_master_execution_preset_replacement_required'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$function$;

revoke all on function master.assert_order_execution_preset_current_release()
  from public, anon, authenticated, service_role;

drop trigger if exists order_execution_preset_current_release_guard
  on master.order_execution_preset_current;
create trigger order_execution_preset_current_release_guard
before insert or update on master.order_execution_preset_current
for each row execute function master.assert_order_execution_preset_current_release();

create index if not exists order_execution_presets_release_idx
  on master.order_execution_presets(source_release_id);
create index if not exists order_execution_presets_order_revision_idx
  on master.order_execution_presets(order_record_id, order_record_revision);

create or replace function master.reject_order_execution_preset_version_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  raise exception 'clinical_master_order_execution_preset_version_immutable'
    using errcode = '55000';
end;
$function$;

revoke all on function master.reject_order_execution_preset_version_mutation()
  from public, anon, authenticated, service_role;

drop trigger if exists order_execution_presets_immutable
  on master.order_execution_presets;
create trigger order_execution_presets_immutable
before update or delete on master.order_execution_presets
for each row execute function master.reject_order_execution_preset_version_mutation();

alter table master.order_execution_presets enable row level security;
alter table master.order_execution_preset_current enable row level security;

revoke all on table master.order_execution_presets,
  master.order_execution_preset_current
  from public, anon, authenticated, service_role;

-- Defense in depth for the pre-existing dispensing-only projection. Its
-- explicit revokes remain in force and no client-readable policy is added.
alter table master.dispensing_order_prescription_presets enable row level security;

comment on table master.order_execution_presets is
  'Append-only runtime projection of versioned order execution defaults. Normalized type-specific master profiles remain the clinical authority.';
comment on table master.order_execution_preset_current is
  'Private current-pointer table for append-only order execution preset versions.';

-- Preserve the 108 dispensing presets as the first compatible projection.
-- The source dispensing rows and their nested workspace metadata remain in
-- place until a later, separately reviewed compatibility cleanup.
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
  preset.id,
  preset.preset_key,
  preset.preset_revision,
  profile.order_record_id,
  profile.order_record_revision,
  'dispensing',
  preset.detail_schema_version,
  preset.default_detail_inputs,
  coalesce((
    select pg_catalog.jsonb_object_agg(
      field.value ->> 'key',
      case
        when preset.default_detail_inputs ? (field.value ->> 'key')
          then 'preset_fixed'
        when coalesce((field.value ->> 'required')::boolean, false)
          and pg_catalog.jsonb_typeof(field.value -> 'defaultValue') <> 'null'
          then 'schema_default'
        when coalesce((field.value ->> 'required')::boolean, false)
          then 'required_manual'
        else 'not_applicable'
      end
    )
    from pg_catalog.jsonb_array_elements(
      private.clair_order_detail_field_schema_v1('dispensing') -> 'fields'
    ) field(value)
  ), '{}'::jsonb),
  preset.provenance || pg_catalog.jsonb_build_object(
    'compatibilitySource', 'master.dispensing_order_prescription_presets'
  ),
  preset.preset_status,
  preset.clinical_use_allowed,
  preset.content_sha256,
  preset.source_artifact_sha256,
  preset.source_release_id,
  preset.created_at
from master.dispensing_order_prescription_presets preset
join master.dispensing_order_profiles profile
  on profile.id = preset.dispensing_profile_id
 and profile.profile_revision = preset.dispensing_profile_revision
on conflict (id, preset_revision) do nothing;

insert into master.order_execution_preset_current (
  order_record_id,
  preset_id,
  preset_revision,
  activated_in_release_id
)
select
  generic_preset.order_record_id,
  generic_preset.id,
  generic_preset.preset_revision,
  generic_preset.source_release_id
from master.order_execution_presets generic_preset
join master.dispensing_order_prescription_presets dispensing_preset
  on dispensing_preset.id = generic_preset.id
 and dispensing_preset.preset_revision = generic_preset.preset_revision
where dispensing_preset.is_current
on conflict (order_record_id) do update
set preset_id = excluded.preset_id,
    preset_revision = excluded.preset_revision,
    activated_in_release_id = excluded.activated_in_release_id,
    updated_at = pg_catalog.now()
where master.order_execution_preset_current.preset_id = excluded.preset_id
  and master.order_execution_preset_current.preset_revision <= excluded.preset_revision;

do $projection_check$
declare
  v_source_count integer;
  v_projected_count integer;
  v_current_count integer;
begin
  select pg_catalog.count(*)::integer
  into v_source_count
  from master.dispensing_order_prescription_presets preset
  where preset.is_current;

  select pg_catalog.count(*)::integer
  into v_projected_count
  from master.dispensing_order_prescription_presets preset
  join master.dispensing_order_profiles profile
    on profile.id = preset.dispensing_profile_id
   and profile.profile_revision = preset.dispensing_profile_revision
  join master.order_execution_presets generic_preset
    on generic_preset.id = preset.id
   and generic_preset.preset_revision = preset.preset_revision
   and generic_preset.order_record_id = profile.order_record_id
   and generic_preset.order_record_revision = profile.order_record_revision
   and generic_preset.clinical_order_type = 'dispensing'
   and generic_preset.detail_schema_version = preset.detail_schema_version
   and generic_preset.default_detail_inputs = preset.default_detail_inputs
   and generic_preset.preset_status = preset.preset_status
   and generic_preset.clinical_use_allowed = preset.clinical_use_allowed
   and generic_preset.content_sha256 = preset.content_sha256
   and generic_preset.source_artifact_sha256 = preset.source_artifact_sha256
   and generic_preset.source_release_id = preset.source_release_id
  where preset.is_current;

  select pg_catalog.count(*)::integer
  into v_current_count
  from master.dispensing_order_prescription_presets preset
  join master.dispensing_order_profiles profile
    on profile.id = preset.dispensing_profile_id
   and profile.profile_revision = preset.dispensing_profile_revision
  join master.order_execution_preset_current current_preset
    on current_preset.order_record_id = profile.order_record_id
   and current_preset.preset_id = preset.id
   and current_preset.preset_revision >= preset.preset_revision
  join master.order_execution_presets current_version
    on current_version.order_record_id = current_preset.order_record_id
   and current_version.id = current_preset.preset_id
   and current_version.preset_revision = current_preset.preset_revision
   and current_version.source_release_id = current_preset.activated_in_release_id
  where preset.is_current;

  if v_source_count <> 108
     or v_projected_count <> v_source_count
     or v_current_count <> v_source_count
  then
    raise exception 'clinical_master_dispensing_generic_projection_mismatch:%/%/%',
      v_source_count,
      v_projected_count,
      v_current_count using errcode = '23514';
  end if;
end;
$projection_check$;

alter table public.order_catalog_items
  add column if not exists default_detail_inputs jsonb not null default '{}'::jsonb,
  add column if not exists default_detail_input_policies jsonb not null default '{}'::jsonb,
  add column if not exists source_execution_preset_id uuid,
  add column if not exists source_execution_preset_revision integer,
  add column if not exists source_execution_preset_sha256 text;

alter table public.order_catalog_items
  drop constraint if exists order_catalog_items_default_detail_inputs_object_check,
  add constraint order_catalog_items_default_detail_inputs_object_check
    check (
      pg_catalog.jsonb_typeof(default_detail_inputs) = 'object'
      and pg_catalog.octet_length(default_detail_inputs::text) <= 65536
      and (
        default_detail_inputs = '{}'::jsonb
        or private.clair_order_detail_inputs_are_valid(
          clinical_order_type,
          coalesce(detail_schema_version, 1),
          default_detail_inputs,
          false
        )
      )
    ),
  drop constraint if exists order_catalog_items_default_detail_input_policies_object_check,
  add constraint order_catalog_items_default_detail_input_policies_object_check
    check (
      pg_catalog.jsonb_typeof(default_detail_input_policies) = 'object'
      and pg_catalog.octet_length(default_detail_input_policies::text) <= 65536
    ),
  drop constraint if exists order_catalog_items_execution_preset_lineage_check,
  add constraint order_catalog_items_execution_preset_lineage_check
    check (
      (source_execution_preset_id is null
        and source_execution_preset_revision is null
        and source_execution_preset_sha256 is null)
      or
      (source_execution_preset_id is not null
        and source_execution_preset_revision > 0
        and source_execution_preset_sha256 ~ '^[0-9a-f]{64}$')
    ),
  drop constraint if exists order_catalog_items_execution_preset_fk,
  add constraint order_catalog_items_execution_preset_fk
    foreign key (
      source_master_record_id,
      source_execution_preset_id,
      source_execution_preset_revision
    )
    references master.order_execution_presets(
      order_record_id,
      id,
      preset_revision
    )
    on delete restrict;

do $migration$
declare
  v_candidates jsonb;
  v_candidate_count integer;
  v_updated_count integer;
  v_foreign_before text;
  v_foreign_after text;
begin
  select private.clinical_master_sha256(
    coalesce(
      pg_catalog.jsonb_agg(pg_catalog.to_jsonb(catalog) order by catalog.id),
      '[]'::jsonb
    )
  )
  into v_foreign_before
  from public.order_catalog_items catalog
  where catalog.workspace_id = 'clair-foreign-demo';

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'workspaceId', catalog.workspace_id,
        'catalogId', catalog.id
      ) order by catalog.workspace_id, catalog.id
    ),
    '[]'::jsonb
  )
  into v_candidates
  from public.order_catalog_items catalog
  join master.order_execution_presets generic_preset
    on catalog.medication_metadata ->> 'sourcePrescriptionPresetId'
      = generic_preset.id::text
   and coalesce(
      nullif(
        catalog.medication_metadata ->> 'sourcePrescriptionPresetRevision',
        ''
      )::integer,
      generic_preset.preset_revision
    ) = generic_preset.preset_revision
  join master.order_execution_preset_current current_preset
    on current_preset.order_record_id = generic_preset.order_record_id
   and current_preset.preset_id = generic_preset.id
   and current_preset.preset_revision = generic_preset.preset_revision
  where catalog.workspace_id in (
      'clair-demo',
      'workspace-clair-cheongdam',
      'workspace-clinical-master-pilot-v1'
    )
    and catalog.origin_type = 'clair_master'
    and catalog.source_master_record_id = generic_preset.order_record_id
    and catalog.source_master_revision = generic_preset.order_record_revision
    and catalog.default_detail_inputs = '{}'::jsonb
    and not (
      coalesce(catalog.customized_fields, array[]::text[])
      && array['defaultDetailInputs', 'default_detail_inputs', '*']::text[]
    )
    and pg_catalog.jsonb_typeof(
      catalog.medication_metadata -> 'defaultDetailInputs'
    ) = 'object'
    and catalog.medication_metadata -> 'defaultDetailInputs'
      = generic_preset.default_detail_inputs;

  v_candidate_count := pg_catalog.jsonb_array_length(v_candidates);

  if v_candidate_count not in (0, 324) then
    raise exception 'clinical_master_execution_preset_backfill_scope_mismatch:%',
      v_candidate_count using errcode = '23514';
  end if;

  update public.order_catalog_items catalog
  set default_detail_inputs = generic_preset.default_detail_inputs,
      default_detail_input_policies = generic_preset.field_policies,
      source_execution_preset_id = generic_preset.id,
      source_execution_preset_revision = generic_preset.preset_revision,
      source_execution_preset_sha256 = generic_preset.content_sha256,
      catalog_revision = catalog.catalog_revision + 1,
      updated_at = pg_catalog.now()
  from master.order_execution_presets generic_preset,
       master.order_execution_preset_current current_preset
  where catalog.workspace_id in (
      'clair-demo',
      'workspace-clair-cheongdam',
      'workspace-clinical-master-pilot-v1'
    )
    and catalog.origin_type = 'clair_master'
    and catalog.source_master_record_id = generic_preset.order_record_id
    and catalog.source_master_revision = generic_preset.order_record_revision
    and current_preset.order_record_id = generic_preset.order_record_id
    and current_preset.preset_id = generic_preset.id
    and current_preset.preset_revision = generic_preset.preset_revision
    and catalog.default_detail_inputs = '{}'::jsonb
    and not (
      coalesce(catalog.customized_fields, array[]::text[])
      && array['defaultDetailInputs', 'default_detail_inputs', '*']::text[]
    )
    and catalog.medication_metadata ->> 'sourcePrescriptionPresetId'
      = generic_preset.id::text
    and coalesce(
      nullif(
        catalog.medication_metadata ->> 'sourcePrescriptionPresetRevision',
        ''
      )::integer,
      generic_preset.preset_revision
    ) = generic_preset.preset_revision
    and pg_catalog.jsonb_typeof(
      catalog.medication_metadata -> 'defaultDetailInputs'
    ) = 'object'
    and catalog.medication_metadata -> 'defaultDetailInputs'
      = generic_preset.default_detail_inputs
    and exists (
      select 1
      from pg_catalog.jsonb_array_elements(v_candidates) candidate(value)
      where candidate.value ->> 'workspaceId' = catalog.workspace_id
        and candidate.value ->> 'catalogId' = catalog.id
    );

  get diagnostics v_updated_count = row_count;
  if v_updated_count <> v_candidate_count then
    raise exception 'clinical_master_execution_preset_backfill_count_mismatch:%/%',
      v_updated_count,
      v_candidate_count using errcode = '23514';
  end if;

  -- Leave a durable audit entry for every row changed by this one-time
  -- backfill. The deterministic id plus DO NOTHING makes a local rehearsal or
  -- a safely re-applied migration idempotent without updating an existing log.
  insert into public.audit_events (
    id,
    workspace_id,
    actor_user_id,
    actor_membership_id,
    event_type,
    target_type,
    target_id,
    encounter_id,
    patient_id,
    guardian_id,
    request_id,
    reason,
    before_snapshot,
    after_snapshot,
    metadata,
    occurred_at
  )
  select
    'clinical_master_execution_preset_backfill:'
      || catalog.workspace_id || ':' || catalog.id,
    catalog.workspace_id,
    null,
    null,
    'order_catalog.updated',
    'order_catalog_item',
    catalog.id,
    null,
    null,
    null,
    null,
    'clinical_master_execution_preset_backfill',
    pg_catalog.jsonb_build_object(
      'defaultDetailInputs', '{}'::jsonb,
      'defaultDetailInputPolicies', '{}'::jsonb,
      'sourceExecutionPresetId', null,
      'sourceExecutionPresetRevision', null,
      'sourceExecutionPresetSha256', null
    ),
    pg_catalog.jsonb_build_object(
      'defaultDetailInputs', catalog.default_detail_inputs,
      'defaultDetailInputPolicies', catalog.default_detail_input_policies,
      'sourceExecutionPresetId', catalog.source_execution_preset_id,
      'sourceExecutionPresetRevision', catalog.source_execution_preset_revision,
      'sourceExecutionPresetSha256', catalog.source_execution_preset_sha256
    ),
    pg_catalog.jsonb_build_object(
      'backfillMigration', '20260831064944',
      'sourceMasterRecordId', generic_preset.order_record_id,
      'sourceMasterRevision', generic_preset.order_record_revision,
      'presetId', generic_preset.id,
      'presetKey', generic_preset.preset_key,
      'presetRevision', generic_preset.preset_revision,
      'sourceReleaseId', generic_preset.source_release_id,
      'contentSha256', generic_preset.content_sha256,
      'candidateCount', v_candidate_count
    ),
    pg_catalog.now()
  from public.order_catalog_items catalog
  join master.order_execution_presets generic_preset
    on generic_preset.order_record_id = catalog.source_master_record_id
   and generic_preset.order_record_revision = catalog.source_master_revision
   and generic_preset.id = catalog.source_execution_preset_id
   and generic_preset.preset_revision = catalog.source_execution_preset_revision
  join master.order_execution_preset_current current_preset
    on current_preset.order_record_id = generic_preset.order_record_id
   and current_preset.preset_id = generic_preset.id
   and current_preset.preset_revision = generic_preset.preset_revision
  where catalog.workspace_id in (
      'clair-demo',
      'workspace-clair-cheongdam',
      'workspace-clinical-master-pilot-v1'
    )
    and catalog.origin_type = 'clair_master'
    and catalog.default_detail_inputs = generic_preset.default_detail_inputs
    and catalog.default_detail_input_policies = generic_preset.field_policies
    and catalog.source_execution_preset_sha256 = generic_preset.content_sha256
    and exists (
      select 1
      from pg_catalog.jsonb_array_elements(v_candidates) candidate(value)
      where candidate.value ->> 'workspaceId' = catalog.workspace_id
        and candidate.value ->> 'catalogId' = catalog.id
    )
  on conflict (id)
  do nothing;

  select private.clinical_master_sha256(
    coalesce(
      pg_catalog.jsonb_agg(pg_catalog.to_jsonb(catalog) order by catalog.id),
      '[]'::jsonb
    )
  )
  into v_foreign_after
  from public.order_catalog_items catalog
  where catalog.workspace_id = 'clair-foreign-demo';

  if v_foreign_after is distinct from v_foreign_before then
    raise exception 'clinical_master_execution_preset_foreign_workspace_changed'
      using errcode = '23514';
  end if;
end;
$migration$;

create or replace function private.clair_catalog_effective_default_detail_inputs(
  p_catalog public.order_catalog_items
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $function$
  select coalesce(
    nullif(p_catalog.default_detail_inputs, '{}'::jsonb),
    case
      when pg_catalog.jsonb_typeof(
        p_catalog.medication_metadata -> 'defaultDetailInputs'
      ) = 'object'
      then p_catalog.medication_metadata -> 'defaultDetailInputs'
      else null
    end,
    '{}'::jsonb
  );
$function$;

revoke all on function private.clair_catalog_effective_default_detail_inputs(
  public.order_catalog_items
) from public, anon, authenticated, service_role;

comment on column public.order_catalog_items.default_detail_inputs is
  'Workspace-owned editable copy of the effective order execution defaults. Empty object means no generic copy; confirmed order snapshots are never backfilled.';
comment on column public.order_catalog_items.default_detail_input_policies is
  'Per-field default source policy copied from the master and editable only through guarded workspace catalog writers.';
