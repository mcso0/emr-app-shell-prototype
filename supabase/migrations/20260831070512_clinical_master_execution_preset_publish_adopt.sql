-- CLINICAL-MASTER-PR-022 publication/adoption transport.
--
-- This migration is deliberately additive.  The existing release-scoped
-- adopter implementations are retained under private legacy names and
-- called by a guarded compatibility wrapper below.  That keeps the
-- payload/cumulative traversal, lock ordering, idempotency, review ledger,
-- and notification behavior byte-for-byte while adding the generic
-- execution-preset copy only to newly-created or unmodified catalog rows.
-- Confirmed/draft order rows and their snapshots are outside this migration's
-- write set.

set lock_timeout = '5s';
set statement_timeout = '120s';

-- Payload lab adoption is idempotent, but the legacy result counter advanced
-- even when ON CONFLICT DO NOTHING inserted no link. Keep the reviewed write
-- path unchanged and make both panel and standalone counters truthful.
do $patch_lab_link_insert_counter$
declare
  v_definition text;
  v_old text := $old$      v_created_links := v_created_links + 1;$old$;
  v_new text := $new$      if found then
        v_created_links := v_created_links + 1;
      end if;$new$;
begin
  select pg_catalog.pg_get_functiondef(
    'private.clair_adopt_lab_master_projection_to_workspace_payload(text,uuid)'::pg_catalog.regprocedure
  ) into v_definition;

  if pg_catalog.strpos(v_definition, v_old) > 0 then
    execute pg_catalog.replace(v_definition, v_old, v_new);
  elsif pg_catalog.strpos(
    v_definition,
    'if found then' || pg_catalog.chr(10) ||
    '        v_created_links := v_created_links + 1;'
  ) = 0 then
    raise exception 'clinical_master_lab_link_counter_patch_anchor_missing'
      using errcode = '55000';
  end if;
end;
$patch_lab_link_insert_counter$;

revoke all on function private.clair_adopt_lab_master_projection_to_workspace_payload(
  text, uuid
) from public, anon, authenticated, service_role;

-- The source projection is the only canonical publication payload consumed by
-- the adopter.  An execution-preset envelope is included only when the
-- current pointer is exact for the source order's current immutable revision.
-- A stale pointer is handled fail-closed by the adoption wrapper below.
create or replace function private.clinical_master_order_source_projection(
  p_master_record_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select
    (
      pg_catalog.jsonb_build_object(
        'masterRecordId', record_row.id,
        'masterKey', record_row.master_key,
        'recordType', record_row.record_type,
        'revision', record_row.current_revision,
        'lifecycleStatus', record_row.lifecycle_status,
        'safetyStatus', record_row.safety_status,
        'replacementRecordId', record_row.replacement_record_id,
        'names', coalesce((
          select pg_catalog.jsonb_agg(
            pg_catalog.jsonb_build_object(
              'languageCode', name_row.language_code,
              'nameKind', name_row.name_kind,
              'name', name_row.name,
              'sortOrder', name_row.sort_order
            ) order by name_row.language_code, name_row.name_kind,
              name_row.sort_order, name_row.id
          )
          from master.master_record_names name_row
          where name_row.master_record_id = record_row.id
            and name_row.name_kind in ('preferred', 'alias')
        ), '[]'::jsonb),
        'classification', (
          select pg_catalog.jsonb_build_object(
            'pathKey', path.path_key,
            'clinicalActionKey', action_record.master_key,
            'itemType', action.item_type,
            'isOtherUnclassified', action.is_other_unclassified,
            'chartGroupCode', chart.group_code,
            'taskRouteCode', route.route_code,
            'destinationModule', route.destination_module,
            'taskRequired', route.task_required,
            'runtimeStatus', route.runtime_status
          )
          from master.orders order_row
          join master.classification_paths path
            on path.id = order_row.classification_path_id
          join master.clinical_actions action
            on action.master_record_id = path.clinical_action_id
          join master.master_records action_record
            on action_record.id = action.master_record_id
          join master.chart_groups chart
            on chart.master_record_id = path.chart_group_id
          join master.task_routes route
            on route.master_record_id = path.task_route_id
          where order_row.master_record_id = record_row.id
        ),
        'order', (
          select pg_catalog.jsonb_build_object(
            'defaultSalesUnitCode', unit.unit_code,
            'defaultQuantity', order_row.default_quantity,
            'defaultBillingReflectionEnabled',
              order_row.default_billing_reflection_enabled,
            'species', coalesce((
              select pg_catalog.jsonb_agg(
                species.species_code order by species.species_code
              )
              from master.order_species_links link
              join master.species species
                on species.master_record_id = link.species_record_id
              where link.order_record_id = order_row.master_record_id
            ), '[]'::jsonb)
          )
          from master.orders order_row
          left join master.units unit
            on unit.master_record_id = order_row.default_sales_unit_id
          where order_row.master_record_id = record_row.id
        )
      )
      || coalesce((
        select pg_catalog.jsonb_build_object(
          'executionPreset', pg_catalog.jsonb_build_object(
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
          )
        )
        from master.order_execution_preset_current current_preset
        join master.order_execution_presets preset
          on preset.order_record_id = current_preset.order_record_id
         and preset.id = current_preset.preset_id
         and preset.preset_revision = current_preset.preset_revision
         and preset.order_record_revision = record_row.current_revision
        where current_preset.order_record_id = record_row.id
      ), '{}'::jsonb)
    )
  from master.master_records record_row
  where record_row.id = p_master_record_id;
$function$;

revoke all on function private.clinical_master_order_source_projection(uuid)
  from public, anon, authenticated, service_role;

-- Source/workspace matching remains backward compatible with legacy snapshots:
-- before PR-022 they have no executionPreset key and therefore cannot be
-- compared against a field that did not exist at the time of capture.
create or replace function private.clinical_master_catalog_source_matches_snapshot(
  p_item public.order_catalog_items,
  p_snapshot jsonb
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_classification jsonb := coalesce(p_snapshot -> 'classification', '{}'::jsonb);
  v_order jsonb := coalesce(p_snapshot -> 'order', '{}'::jsonb);
  v_execution_preset jsonb := p_snapshot -> 'executionPreset';
  v_expected_species text[];
  v_actual_species text[];
  v_expected_aliases text[];
  v_actual_aliases text[];
  v_path_key text;
begin
  if p_snapshot is null or pg_catalog.jsonb_typeof(p_snapshot) <> 'object' then
    return false;
  end if;

  select coalesce(pg_catalog.array_agg(value ->> 'name' order by ordinality), '{}')
    into v_expected_aliases
  from pg_catalog.jsonb_array_elements(
    coalesce(p_snapshot -> 'names', '[]'::jsonb)
  ) with ordinality
  where value ->> 'nameKind' = 'alias';
  v_actual_aliases := coalesce(p_item.aliases, '{}');

  select coalesce(pg_catalog.array_agg(value #>> '{}' order by value #>> '{}'), '{}')
    into v_expected_species
  from pg_catalog.jsonb_array_elements(
    coalesce(v_order -> 'species', '[]'::jsonb)
  );
  select coalesce(pg_catalog.array_agg(species_code order by species_code), '{}')
    into v_actual_species
  from pg_catalog.unnest(coalesce(p_item.target_species, '{}')) as species_code;

  select path_key into v_path_key
  from master.classification_paths
  where id = p_item.classification_path_id;

  return p_item.standard_order_id = coalesce(p_snapshot ->> 'masterKey', '')
    and p_item.category_group = coalesce(v_classification ->> 'itemType', '')
    and p_item.standard_order_name = coalesce((
      select value ->> 'name'
      from pg_catalog.jsonb_array_elements(
        coalesce(p_snapshot -> 'names', '[]'::jsonb)
      )
      where value ->> 'languageCode' = 'ko'
        and value ->> 'nameKind' = 'preferred'
      order by (value ->> 'sortOrder')::integer, value ->> 'name'
      limit 1
    ), '')
    and p_item.sales_unit = case v_order ->> 'defaultSalesUnitCode'
      when 'EA' then 'per_each'
      when 'DAY' then 'per_day'
      when 'ML' then 'per_ml'
      when 'KG' then 'per_kg'
      else coalesce(v_order ->> 'defaultSalesUnitCode', p_item.sales_unit)
    end
    and p_item.default_destination_module = case
      when v_classification ->> 'destinationModule' = 'inpatient'
        then 'billing_only'
      else coalesce(
        v_classification ->> 'destinationModule',
        p_item.default_destination_module
      )
    end
    and p_item.default_task_required = coalesce(
      (v_classification ->> 'taskRequired')::boolean,
      p_item.default_task_required
    )
    and p_item.billing_reflection_enabled = coalesce(
      (v_order ->> 'defaultBillingReflectionEnabled')::boolean,
      p_item.billing_reflection_enabled
    )
    and v_path_key = v_classification ->> 'pathKey'
    and v_expected_aliases = v_actual_aliases
    and v_expected_species = v_actual_species
    and (
      v_execution_preset is null
      or (
        v_execution_preset ?& array[
          'id', 'revision', 'orderRecordRevision', 'clinicalOrderType',
          'detailSchemaVersion', 'defaultDetailInputs', 'fieldPolicies',
          'contentSha256'
        ]
        and p_item.source_execution_preset_id =
          nullif(v_execution_preset ->> 'id', '')::uuid
        and p_item.source_execution_preset_revision =
          (v_execution_preset ->> 'revision')::integer
        and p_item.source_execution_preset_sha256 =
          v_execution_preset ->> 'contentSha256'
        and p_item.default_detail_inputs =
          v_execution_preset -> 'defaultDetailInputs'
        and p_item.default_detail_input_policies =
          v_execution_preset -> 'fieldPolicies'
        and p_item.clinical_order_type =
          v_execution_preset ->> 'clinicalOrderType'
        and p_item.detail_schema_version =
          (v_execution_preset ->> 'detailSchemaVersion')::integer
      )
    );
end;
$function$;

revoke all on function private.clinical_master_catalog_source_matches_snapshot(
  public.order_catalog_items, jsonb
) from public, anon, authenticated, service_role;

create or replace function private.clinical_master_workspace_snapshot(
  p_item public.order_catalog_items
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select pg_catalog.jsonb_build_object(
    'itemId', p_item.id,
    'catalogRevision', p_item.catalog_revision,
    'inHospitalOrderName', p_item.in_hospital_order_name,
    'billingName', p_item.billing_name,
    'aliases', pg_catalog.to_jsonb(coalesce(p_item.aliases, '{}')),
    'availabilityStatus', p_item.availability_status,
    'priceKrw', p_item.price_krw,
    'salesUnit', p_item.sales_unit,
    'billingReflectionEnabled', p_item.billing_reflection_enabled,
    'careGuide', p_item.care_guide,
    'careGuideDeliveryEnabled', p_item.care_guide_delivery_enabled,
    'internalInstruction', p_item.internal_instruction,
    'internalInstructionDeliveryEnabled',
      p_item.internal_instruction_delivery_enabled,
    'taxIncluded', p_item.tax_included,
    'roundingRule', p_item.rounding_rule,
    'pricingRule', p_item.pricing_rule,
    'medicationMetadata', p_item.medication_metadata,
    'vaccineMetadata', p_item.vaccine_metadata,
    'defaultDetailInputs', p_item.default_detail_inputs,
    'defaultDetailInputPolicies', p_item.default_detail_input_policies,
    'sourceExecutionPresetId', p_item.source_execution_preset_id,
    'sourceExecutionPresetRevision', p_item.source_execution_preset_revision,
    'sourceExecutionPresetSha256', p_item.source_execution_preset_sha256
  );
$function$;

revoke all on function private.clinical_master_workspace_snapshot(
  public.order_catalog_items
) from public, anon, authenticated, service_role;

-- Copy the exact source preset into workspace-owned catalog state after the
-- historical adopter has classified a row as newly-created or unmodified.
-- Review/customized rows deliberately do not enter this loop: their existing
-- values remain untouched and the review snapshot produced by the historical
-- body carries those values for an explicit accept_source decision.
create or replace function private.clair_sync_adopted_execution_preset_copy(
  p_workspace_id text,
  p_release_id uuid,
  p_adoption_scope text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_item record;
  v_schema jsonb;
  v_synced integer := 0;
begin
  for v_item in
    select
      item.id,
      item.category_group as item_category_group,
      item.clinical_order_type as item_clinical_order_type,
      item.source_master_revision as item_source_revision,
      item.source_projection_snapshot,
      item.customization_state,
      item.customized_fields,
      preset.id as preset_id,
      preset.preset_revision,
      preset.order_record_id,
      preset.order_record_revision,
      preset.clinical_order_type as preset_clinical_order_type,
      preset.detail_schema_version as preset_detail_schema_version,
      preset.default_detail_inputs,
      preset.field_policies,
      preset.content_sha256
    from public.order_catalog_items item
    join master.master_records source_record
      on source_record.id = item.source_master_record_id
    join master.order_execution_preset_current current_preset
      on current_preset.order_record_id = source_record.id
    join master.order_execution_presets preset
      on preset.order_record_id = current_preset.order_record_id
     and preset.id = current_preset.preset_id
     and preset.preset_revision = current_preset.preset_revision
     and preset.order_record_revision = source_record.current_revision
    where item.workspace_id = p_workspace_id
      and item.origin_type = 'clair_master'
      and item.source_master_revision = preset.order_record_revision
      and item.source_projection_snapshot ? 'executionPreset'
      and item.customization_state = 'unmodified'
      and coalesce(pg_catalog.cardinality(item.customized_fields), 0) = 0
      and (
        p_adoption_scope = 'cumulative'
        or exists (
          select 1
          from private.clinical_master_release_payload_owner_manifest manifest
          where manifest.release_id = p_release_id
            and manifest.master_record_id = source_record.id
            and manifest.included
            and manifest.record_type = 'order'
            and manifest.effective_revision = preset.order_record_revision
        )
      )
    order by item.id
    for update of item
  loop
    -- The current catalog contract is the runtime type/schema authority.  The
    -- preset's type may be extended by a later taxonomy migration (for
    -- example system_exam), so this code intentionally delegates validation
    -- to the private schema functions instead of maintaining a second type
    -- allowlist here.  A mismatch in the currently deployed derivation is a
    -- fail-closed condition and must be resolved by the taxonomy migration
    -- before its release is adopted.
    if v_item.item_clinical_order_type is distinct from v_item.preset_clinical_order_type
      and not (
        v_item.item_category_group = 'misc'
        and v_item.item_clinical_order_type = 'other'
        and v_item.preset_clinical_order_type = 'system_exam'
      )
      and not (
        v_item.item_category_group = 'medication'
        and v_item.item_clinical_order_type = 'dispensing'
        and v_item.preset_clinical_order_type = 'other'
      )
    then
      raise exception 'clinical_master_execution_preset_catalog_type_mismatch'
        using errcode = '23514', detail = pg_catalog.concat_ws(
          ':',
          v_item.id,
          v_item.item_category_group,
          v_item.item_clinical_order_type,
          v_item.preset_clinical_order_type
        );
    end if;
    v_schema := private.clair_order_detail_field_schema_v1(
      v_item.preset_clinical_order_type
    );
    if v_schema is null
      or not private.clair_order_field_schema_is_valid(
        v_item.preset_clinical_order_type,
        v_item.preset_detail_schema_version,
        v_schema
      ) then
      raise exception 'clinical_master_execution_preset_catalog_schema_invalid'
        using errcode = '23514';
    end if;
    update public.order_catalog_items item
    set default_detail_inputs = v_item.default_detail_inputs,
        default_detail_input_policies = v_item.field_policies,
        source_execution_preset_id = v_item.preset_id,
        source_execution_preset_revision = v_item.preset_revision,
        source_execution_preset_sha256 = v_item.content_sha256,
        clinical_order_type = v_item.preset_clinical_order_type,
        is_external_lab = v_item.preset_clinical_order_type = 'external_lab',
        detail_schema_version = v_item.preset_detail_schema_version,
        detail_field_schema = v_schema,
        updated_at = pg_catalog.now()
    where item.workspace_id = p_workspace_id
      and item.id = v_item.id
      and (
        item.default_detail_inputs is distinct from v_item.default_detail_inputs
        or item.default_detail_input_policies is distinct from v_item.field_policies
        or item.source_execution_preset_id is distinct from v_item.preset_id
        or item.source_execution_preset_revision is distinct from v_item.preset_revision
        or item.source_execution_preset_sha256 is distinct from v_item.content_sha256
        or item.clinical_order_type is distinct from v_item.preset_clinical_order_type
        or item.detail_schema_version is distinct from v_item.preset_detail_schema_version
        or item.detail_field_schema is distinct from v_schema
      );
    if found then
      v_synced := v_synced + 1;
    end if;
  end loop;

  return pg_catalog.jsonb_build_object(
    'syncedCount', v_synced,
    'enforcedBy', 'clinical-master-execution-preset-copy'
  );
end;
$function$;

revoke all on function private.clair_sync_adopted_execution_preset_copy(
  text, uuid, text
) from public, anon, authenticated, service_role;

-- Keep the original A2 dispatcher available as a private implementation
-- detail, then add the execution-preset guard/copy around it.  The dispatcher
-- still selects the exact payload or cumulative body, so both modes retain
-- the same lock, release-scope, review, notification, and idempotency rules.
do $preserve_a2_base$
begin
  if pg_catalog.to_regprocedure(
    'private.clair_adopt_master_release_to_workspace_a2_base_legacy_pr022(text,uuid)'
  ) is null then
    if pg_catalog.to_regprocedure(
      'private.clair_adopt_master_release_to_workspace_a2_base(text,uuid)'
    ) is null then
      raise exception 'clinical_master_a2_base_missing_before_pr022'
        using errcode = '55000';
    end if;
    alter function private.clair_adopt_master_release_to_workspace_a2_base(
      text, uuid
    ) rename to clair_adopt_master_release_to_workspace_a2_base_legacy_pr022;
  end if;
end;
$preserve_a2_base$;

revoke all on function private.clair_adopt_master_release_to_workspace_a2_base_legacy_pr022(
  text, uuid
) from public, anon, authenticated, service_role;

create or replace function private.clair_adopt_master_release_to_workspace_a2_base(
  p_workspace_id text,
  p_release_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_scope text;
  v_result jsonb;
begin
  select release_row.adoption_scope
    into v_scope
  from master.master_releases release_row
  where release_row.id = p_release_id;
  if v_scope is null then
    raise exception 'clinical_master_release_not_published' using errcode = '22023';
  end if;
  if v_scope not in ('cumulative', 'payload') then
    raise exception 'clinical_master_adoption_scope_invalid' using errcode = '22023';
  end if;

  -- Every in-scope order must have one exact current preset for its immutable
  -- master revision.  A missing pointer is just as unsafe as a stale pointer.
  -- Scope the check to this release so unrelated staged work cannot block an
  -- adoption.
  if exists (
    select 1
    from master.master_records source_record
    join master.orders source_order
      on source_order.master_record_id = source_record.id
    where source_record.record_type = 'order'
      and source_record.safety_status = 'normal'
      and source_record.lifecycle_status in (
        'published', 'deprecation_pending', 'deprecated'
      )
      and (
        v_scope = 'cumulative'
        or exists (
          select 1
          from private.clinical_master_release_payload_owner_manifest manifest
          where manifest.release_id = p_release_id
            and manifest.master_record_id = source_record.id
            and manifest.included
            and manifest.record_type = 'order'
        )
      )
      and not exists (
        select 1
        from master.order_execution_preset_current current_preset
        join master.order_execution_presets preset
          on preset.order_record_id = current_preset.order_record_id
         and preset.id = current_preset.preset_id
         and preset.preset_revision = current_preset.preset_revision
        where current_preset.order_record_id = source_record.id
          and preset.order_record_revision = source_record.current_revision
      )
  ) then
    raise exception 'clinical_master_execution_preset_source_revision_mismatch'
      using errcode = '23514';
  end if;

  v_result := private.clair_adopt_master_release_to_workspace_a2_base_legacy_pr022(
    p_workspace_id, p_release_id
  );

  v_result := v_result || private.clair_sync_adopted_execution_preset_copy(
    p_workspace_id, p_release_id, v_scope
  );
  return v_result || pg_catalog.jsonb_build_object('executionPresetTransport', 'v1');
end;
$function$;

revoke all on function private.clair_adopt_master_release_to_workspace_a2_base(
  text, uuid
) from public, anon, authenticated, service_role;
revoke all on function private.clair_adopt_master_release_to_workspace(
  text, uuid
) from public, anon, authenticated, service_role;

-- Resolve through the existing authenticated/CAS/review implementation first,
-- then apply the source execution preset captured in its server-owned review
-- snapshot.  Legacy snapshots have no executionPreset envelope and therefore
-- retain the pre-PR-022 generic catalog copy unchanged.
do $preserve_workspace_resolver$
begin
  if pg_catalog.to_regprocedure(
    'public.clair_resolve_workspace_master_update_legacy_pr022(text,uuid,integer,text)'
  ) is null then
    if pg_catalog.to_regprocedure(
      'public.clair_resolve_workspace_master_update(text,uuid,integer,text)'
    ) is null then
      raise exception 'clinical_master_workspace_resolver_missing_before_pr022'
        using errcode = '55000';
    end if;
    alter function public.clair_resolve_workspace_master_update(
      text, uuid, integer, text
    ) rename to clair_resolve_workspace_master_update_legacy_pr022;
  end if;
end;
$preserve_workspace_resolver$;

revoke all on function public.clair_resolve_workspace_master_update_legacy_pr022(
  text, uuid, integer, text
) from public, anon, authenticated, service_role;

create or replace function public.clair_resolve_workspace_master_update(
  p_workspace_id text,
  p_update_id uuid,
  p_expected_catalog_revision integer,
  p_action text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_result jsonb;
  v_update public.workspace_master_updates%rowtype;
  v_before public.order_catalog_items%rowtype;
  v_item public.order_catalog_items%rowtype;
  v_snapshot jsonb;
  v_execution_preset jsonb;
  v_preset master.order_execution_presets%rowtype;
  v_current master.order_execution_preset_current%rowtype;
  v_source_record master.master_records%rowtype;
  v_schema jsonb;
begin
  -- This authenticated wrapper is a public catalog writer.  Recheck the
  -- canonical assignment-based permission before any privileged row read or
  -- legacy resolver call; a hospital_admin label alone is not authority.
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if not private.clair_is_active_workspace_member(p_workspace_id)
    or not private.clair_current_user_has_workspace_permission(
      p_workspace_id, 'service_catalog:manage'
    ) then
    raise exception 'workspace_admin_required' using errcode = '42501';
  end if;

  -- Capture the actual pre-resolution row for the atomic catalog audit.  The
  -- legacy resolver below remains the row-lock, review-status, and CAS
  -- authority; any rejection rolls this transaction back before this snapshot
  -- can be observed by the caller.
  select update_row.*
    into v_update
  from public.workspace_master_updates update_row
  where update_row.id = p_update_id
    and update_row.workspace_id = p_workspace_id;
  if found then
    select item.*
      into v_before
    from public.order_catalog_items item
    where item.workspace_id = p_workspace_id
      and item.id = v_update.order_catalog_item_id;
  end if;

  -- The legacy resolver still owns its compatibility authorization checks,
  -- review status, and catalog CAS. Calling it preserves those guards and
  -- ensures all failures roll back this transaction.
  v_result := public.clair_resolve_workspace_master_update_legacy_pr022(
    p_workspace_id,
    p_update_id,
    p_expected_catalog_revision,
    p_action
  );

  if p_action <> 'accept_source' then
    return v_result;
  end if;

  if v_update.id is null then
    raise exception 'workspace_master_update_not_found' using errcode = 'P0002';
  end if;
  v_snapshot := v_update.source_snapshot;
  v_execution_preset := v_snapshot -> 'executionPreset';
  if v_execution_preset is null then
    return v_result;
  end if;
  if pg_catalog.jsonb_typeof(v_execution_preset) <> 'object'
    or not v_execution_preset ?& array[
      'id', 'revision', 'orderRecordRevision', 'clinicalOrderType',
      'detailSchemaVersion', 'defaultDetailInputs', 'fieldPolicies',
      'presetStatus', 'clinicalUseAllowed', 'contentSha256',
      'sourceArtifactSha256', 'sourceReleaseId', 'activatedReleaseId'
    ] then
    raise exception 'clinical_master_execution_preset_snapshot_invalid'
      using errcode = '23514';
  end if;

  select source_record.*
    into v_source_record
  from master.master_records source_record
  where source_record.id = v_update.source_master_record_id
    and source_record.record_type = 'order';
  if not found then
    raise exception 'clinical_master_execution_preset_source_missing'
      using errcode = '23503';
  end if;
  select current_row.*
    into v_current
  from master.order_execution_preset_current current_row
  where current_row.order_record_id = v_source_record.id;
  if not found then
    raise exception 'clinical_master_execution_preset_current_missing'
      using errcode = '23503';
  end if;
  select preset_row.*
    into v_preset
  from master.order_execution_presets preset_row
  where preset_row.id = v_current.preset_id
    and preset_row.preset_revision = v_current.preset_revision
    and preset_row.order_record_id = v_source_record.id;
  if not found
    or v_preset.order_record_revision <> v_source_record.current_revision
    or v_preset.order_record_revision <> v_update.source_revision
    or (v_execution_preset ->> 'id')::uuid <> v_preset.id
    or (v_execution_preset ->> 'revision')::integer <> v_preset.preset_revision
    or (v_execution_preset ->> 'orderRecordRevision')::integer
       <> v_preset.order_record_revision
    or v_execution_preset ->> 'clinicalOrderType'
       <> v_preset.clinical_order_type
    or (v_execution_preset ->> 'detailSchemaVersion')::integer
       <> v_preset.detail_schema_version
    or v_execution_preset -> 'defaultDetailInputs'
       is distinct from v_preset.default_detail_inputs
    or v_execution_preset -> 'fieldPolicies'
       is distinct from v_preset.field_policies
    or v_execution_preset ->> 'presetStatus'
       <> v_preset.preset_status
    or (v_execution_preset ->> 'clinicalUseAllowed')::boolean
       <> v_preset.clinical_use_allowed
    or v_execution_preset ->> 'contentSha256'
       <> v_preset.content_sha256
    or v_execution_preset ->> 'sourceArtifactSha256'
       <> v_preset.source_artifact_sha256
    or (v_execution_preset ->> 'sourceReleaseId')::uuid
       <> v_preset.source_release_id
    or (v_execution_preset ->> 'activatedReleaseId')::uuid
       <> v_current.activated_in_release_id then
    raise exception 'clinical_master_execution_preset_snapshot_lineage_conflict'
      using errcode = '40901';
  end if;

  v_schema := private.clair_order_detail_field_schema_v1(
    v_preset.clinical_order_type
  );
  if v_schema is null
    or not private.clair_order_field_schema_is_valid(
      v_preset.clinical_order_type,
      v_preset.detail_schema_version,
      v_schema
    ) then
    raise exception 'clinical_master_execution_preset_catalog_schema_invalid'
      using errcode = '23514';
  end if;

  select item.*
    into v_item
  from public.order_catalog_items item
  where item.workspace_id = p_workspace_id
    and item.id = v_update.order_catalog_item_id;
  if not found then
    raise exception 'order_catalog_item_not_found' using errcode = 'P0002';
  end if;

  -- Accepting the source is the explicit authority transition for the
  -- catalog row.  Do not increment catalog_revision a second time: the
  -- legacy resolver already performed the single CAS-protected increment.
  update public.order_catalog_items item
  set default_detail_inputs = v_preset.default_detail_inputs,
      default_detail_input_policies = v_preset.field_policies,
      source_execution_preset_id = v_preset.id,
      source_execution_preset_revision = v_preset.preset_revision,
      source_execution_preset_sha256 = v_preset.content_sha256,
      clinical_order_type = v_preset.clinical_order_type,
      is_external_lab = v_preset.clinical_order_type = 'external_lab',
      detail_schema_version = v_preset.detail_schema_version,
      detail_field_schema = v_schema,
      updated_at = pg_catalog.now()
  where item.workspace_id = p_workspace_id
    and item.id = v_item.id;

  select item.*
    into v_item
  from public.order_catalog_items item
  where item.workspace_id = p_workspace_id
    and item.id = v_item.id;

  perform private.clair_pr020_append_order_catalog_audit(
    p_workspace_id,
    'order_catalog.updated',
    v_item.id,
    v_before,
    v_item,
    'accept_master_source',
    array[
      'defaultDetailInputs',
      'defaultDetailInputPolicies',
      'executionPresetLineage'
    ]::text[]
  );

  return v_result || pg_catalog.jsonb_build_object(
    'item', pg_catalog.to_jsonb(v_item),
    'databaseAuditWritten', true
  );
end;
$function$;

revoke all on function public.clair_resolve_workspace_master_update(
  text, uuid, integer, text
) from public, anon, service_role;
grant execute on function public.clair_resolve_workspace_master_update(
  text, uuid, integer, text
) to authenticated;

comment on function private.clair_adopt_master_release_to_workspace_a2_base(
  text, uuid
) is
  'PR-022 guarded release adopter. Preserves cumulative/payload traversal and copies exact current execution presets only to new or unmodified catalog rows.';
comment on function public.clair_resolve_workspace_master_update(
  text, uuid, integer, text
) is
  'PR-022 authenticated CAS review resolver. Accepts a server-captured execution-preset envelope only after exact current lineage verification.';
