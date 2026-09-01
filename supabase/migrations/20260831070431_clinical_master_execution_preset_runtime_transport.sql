-- CLINICAL-MASTER-PR-022 runtime transport.
--
-- The order execution preset is copied at the master -> workspace boundary and
-- then copied again into a chart draft/snapshot.  This migration only replaces
-- the transport/read and catalog-writer edges.  It never rewrites orders or
-- confirmation snapshots that already exist.

set lock_timeout = '5s';
set statement_timeout = '120s';

create or replace function public.clair_list_order_catalog_chart_search_v2(
  p_workspace_id text
)
returns table (
  row_type text,
  source_preset_id text,
  source_preset_version text,
  display_name text,
  billing_name text,
  category_group text,
  target_species text[],
  applied_snapshot jsonb,
  source_set_id text,
  source_set_revision_id uuid,
  source_set_revision_no integer,
  source_set_amount_basis text,
  source_set_price_krw integer,
  source_set_range_basis text,
  source_set_tax_type text,
  source_set_availability_status text,
  source_set_needs_composition_review boolean,
  source_set_validation_status text,
  source_set_price_ranges jsonb,
  source_set_pending_review_count integer
)
language sql
security definer
set search_path = ''
as $function$
  with base_rows as (
    select *
    from public.clair_list_order_catalog_chart_search_v2_phase2_base(p_workspace_id)
  ),
  service_review_rows as (
    select
      'individual'::text as row_type,
      item.standard_order_id as source_preset_id,
      item.source_preset_version,
      item.in_hospital_order_name as display_name,
      item.billing_name,
      item.category_group,
      item.target_species,
      pg_catalog.jsonb_build_object(
        'sourcePresetId', item.standard_order_id,
        'sourcePresetVersion', item.source_preset_version,
        'workspaceCatalogItemId', item.id,
        'appliedStandardOrderName', item.standard_order_name,
        'appliedDisplayName', item.in_hospital_order_name,
        'appliedBillingName', item.billing_name,
        'appliedPriceKrw', item.price_krw,
        'appliedSalesUnit', item.sales_unit,
        'appliedTaxIncluded', item.tax_included,
        'appliedAmountBasis', item.pricing_rule ->> 'priceBasis',
        'appliedTargetSpecies', pg_catalog.to_jsonb(item.target_species),
        'appliedCareGuide', item.care_guide,
        'appliedInternalInstruction', item.internal_instruction,
        'appliedDestinationModule', item.default_destination_module,
        'appliedTaskRequired', item.default_task_required,
        'appliedBillingReflectionEnabled', item.billing_reflection_enabled,
        'roundingRule', item.rounding_rule,
        'billingReflectionEnabled', item.billing_reflection_enabled,
        'defaultDetailInputs', private.clair_catalog_effective_default_detail_inputs(item),
        'defaultDetailInputPolicies', item.default_detail_input_policies,
        'executionPresetLineage', case
          when item.source_execution_preset_id is null then null
          else pg_catalog.jsonb_build_object(
            'sourceExecutionPresetId', item.source_execution_preset_id,
            'sourceExecutionPresetRevision', item.source_execution_preset_revision,
            'sourceExecutionPresetSha256', item.source_execution_preset_sha256,
            'presetStatus', (
              select preset.preset_status
              from master.order_execution_presets preset
              where preset.id = item.source_execution_preset_id
                and preset.preset_revision = item.source_execution_preset_revision
            ),
            'clinicalUseAllowed', (
              select preset.clinical_use_allowed
              from master.order_execution_presets preset
              where preset.id = item.source_execution_preset_id
                and preset.preset_revision = item.source_execution_preset_revision
            )
          )
        end,
        'medicationMetadata', item.medication_metadata
      ) as applied_snapshot,
      null::text as source_set_id,
      null::uuid as source_set_revision_id,
      null::integer as source_set_revision_no,
      null::text as source_set_amount_basis,
      null::integer as source_set_price_krw,
      null::text as source_set_range_basis,
      null::text as source_set_tax_type,
      null::text as source_set_availability_status,
      null::boolean as source_set_needs_composition_review,
      null::text as source_set_validation_status,
      null::jsonb as source_set_price_ranges,
      null::integer as source_set_pending_review_count
    from public.order_catalog_items item
    join master.dispensing_order_profiles profile
      on profile.id = item.source_dispensing_profile_id
     and profile.profile_revision = item.source_dispensing_profile_revision
    where item.workspace_id = p_workspace_id
      and item.availability_status = 'pending_activation'
      and item.clinical_use_allowed = false
      and private.clair_dispensing_service_review_allowed(
        p_workspace_id,
        profile.source_release_id
      )
  ),
  catalog_rows as (
    select * from base_rows
    union all
    select * from service_review_rows
  )
  select
    base.row_type,
    base.source_preset_id,
    base.source_preset_version,
    base.display_name,
    base.billing_name,
    base.category_group,
    base.target_species,
    base.applied_snapshot || case
      when base.row_type = 'set' then pg_catalog.jsonb_build_object(
        'clinicalOrderType', 'other',
        'destinationModule', null,
        'executionMode', 'aggregate',
        'detailSchemaVersion', 1,
        'billingEligible', false,
        'defaultDetailInputs', '{}'::jsonb,
        'defaultDetailInputPolicies', '{}'::jsonb,
        'executionPresetLineage', null
      )
      else pg_catalog.jsonb_build_object(
        'clinicalOrderType', catalog.clinical_order_type,
        'destinationModule', catalog.destination_module,
        'executionMode', catalog.execution_mode,
        'detailSchemaVersion', catalog.detail_schema_version,
        'billingEligible', catalog.billing_eligible,
        'defaultDetailInputs', private.clair_catalog_effective_default_detail_inputs(catalog),
        'defaultDetailInputPolicies', catalog.default_detail_input_policies,
        'executionPresetLineage', case
          when catalog.source_execution_preset_id is null then null
          else pg_catalog.jsonb_build_object(
            'sourceExecutionPresetId', catalog.source_execution_preset_id,
            'sourceExecutionPresetRevision', catalog.source_execution_preset_revision,
            'sourceExecutionPresetSha256', catalog.source_execution_preset_sha256,
            'presetStatus', (
              select preset.preset_status
              from master.order_execution_presets preset
              where preset.id = catalog.source_execution_preset_id
                and preset.preset_revision = catalog.source_execution_preset_revision
            ),
            'clinicalUseAllowed', (
              select preset.clinical_use_allowed
              from master.order_execution_presets preset
              where preset.id = catalog.source_execution_preset_id
                and preset.preset_revision = catalog.source_execution_preset_revision
            )
          )
        end,
        'medicationMetadata', catalog.medication_metadata
      ) || case
        when catalog.source_dispensing_profile_id is null then '{}'::jsonb
        else pg_catalog.jsonb_build_object(
          'dispensingLineage', pg_catalog.jsonb_build_object(
            'schemaVersion', 2,
            'sourceDispensingProfileId', catalog.source_dispensing_profile_id,
            'sourceDispensingProfileRevision', catalog.source_dispensing_profile_revision,
            'sourceMedicationProductId', catalog.source_medication_product_id,
            'sourceMedicationProductRevision', catalog.source_medication_product_revision,
            'sourceClinicalReviewId', catalog.source_clinical_review_id,
            'sourceEvidenceFingerprint', catalog.source_evidence_fingerprint,
            'clinicalUseAllowed', catalog.clinical_use_allowed,
            'serviceReviewOnly', (
              not catalog.clinical_use_allowed
              and catalog.availability_status = 'pending_activation'
              and private.clair_dispensing_service_review_allowed(
                p_workspace_id,
                profile.source_release_id
              )
            ),
            'serviceReviewReleaseId', case
              when not catalog.clinical_use_allowed then profile.source_release_id
              else null
            end,
            'dispensingProfileSnapshot', catalog.dispensing_profile_snapshot,
            'dispensingProfileSnapshotSha256', catalog.dispensing_profile_snapshot_sha256
          )
        )
      end
    end as applied_snapshot,
    base.source_set_id,
    base.source_set_revision_id,
    base.source_set_revision_no,
    base.source_set_amount_basis,
    base.source_set_price_krw,
    base.source_set_range_basis,
    base.source_set_tax_type,
    base.source_set_availability_status,
    base.source_set_needs_composition_review,
    base.source_set_validation_status,
    base.source_set_price_ranges,
    base.source_set_pending_review_count
  from catalog_rows base
  left join public.order_catalog_items catalog
    on base.row_type = 'individual'
   and catalog.workspace_id = p_workspace_id
   and catalog.id = base.applied_snapshot ->> 'workspaceCatalogItemId'
  left join master.dispensing_order_profiles profile
    on profile.id = catalog.source_dispensing_profile_id
   and profile.profile_revision = catalog.source_dispensing_profile_revision
  where private.clair_current_user_has_workspace_permission(
      p_workspace_id,
      'service_catalog:view'
    )
    and (
      base.row_type = 'set'
      or catalog.source_dispensing_profile_id is null
      or (
        catalog.clinical_use_allowed
        and master.clair_dispensing_profile_clinical_use_allowed(
          catalog.source_dispensing_profile_id,
          catalog.source_dispensing_profile_revision
        )
      )
      or (
        catalog.availability_status = 'pending_activation'
        and catalog.clinical_use_allowed = false
        and private.clair_dispensing_service_review_allowed(
          p_workspace_id,
          profile.source_release_id
        )
      )
    );
$function$;

revoke all on function public.clair_list_order_catalog_chart_search_v2(text)
  from public, anon, service_role;
grant execute on function public.clair_list_order_catalog_chart_search_v2(text)
  to authenticated;

create or replace function private.clair_build_catalog_order_snapshot(
  p_workspace_id text,
  p_catalog_item_id text,
  p_quantity numeric
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  c public.order_catalog_items%rowtype;
  v_billing_category text;
  v_order_type text;
  v_rounding_result numeric;
  v_raw_line_total numeric;
  v_line_total numeric;
  v_path_key text;
  v_path_item_type text;
  v_price_basis text;
  v_service_review_allowed boolean := false;
begin
  if p_quantity is null or p_quantity <= 0 or p_quantity > 9999
     or p_quantity::text = 'NaN' then
    raise exception 'invalid_order_quantity';
  end if;
  select * into c
  from public.order_catalog_items
  where workspace_id = p_workspace_id and id = p_catalog_item_id;
  if not found then raise exception 'catalog_item_unavailable'; end if;
  v_service_review_allowed :=
    private.clair_dispensing_service_review_catalog_item_allowed(
      p_workspace_id,
      c.id
    );
  if c.availability_status <> 'active' and not v_service_review_allowed then
    raise exception 'catalog_item_unavailable';
  end if;
  select path.path_key, action.item_type
    into v_path_key, v_path_item_type
  from master.classification_paths path
  join master.clinical_actions action
    on action.master_record_id = path.clinical_action_id
  where path.id = c.classification_path_id
    and path.retired_in_release_id is null;
  if v_path_key is null or v_path_item_type is distinct from c.category_group then
    raise exception 'catalog_classification_unavailable';
  end if;
  v_billing_category :=
    private.clair_map_catalog_category_to_billing_category(c.category_group);
  if v_billing_category is null then raise exception 'unsupported_category_group'; end if;
  if c.billing_reflection_enabled and c.price_krw is null
     and not v_service_review_allowed then
    raise exception 'billable_price_required';
  end if;
  v_order_type := case c.category_group
    when 'lab' then 'lab'
    when 'imaging' then 'imaging'
    when 'medication' then 'dispensing'
    else 'treatment'
  end;
  v_price_basis := coalesce(c.pricing_rule ->> 'priceBasis', 'unit_price');
  v_raw_line_total := case
    when v_price_basis = 'fixed_order_price' then coalesce(c.price_krw, 0)
    else p_quantity * coalesce(c.price_krw, 0)
  end;
  v_rounding_result := private.clair_round_catalog_order_amount(
    v_raw_line_total,
    c.rounding_rule
  );
  if c.price_krw is null then v_rounding_result := null; end if;
  v_line_total := coalesce(v_rounding_result, v_raw_line_total);

  return pg_catalog.jsonb_build_object(
    'workspaceCatalogItemId', c.id,
    'workspaceCatalogRevision', c.catalog_revision,
    'sourceMasterRecordId', c.source_master_record_id,
    'sourceMasterRevision', c.source_master_revision,
    'classificationPathId', c.classification_path_id,
    'classificationPathKey', v_path_key,
    'sourcePresetId', c.standard_order_id,
    'sourcePresetVersion', c.source_preset_version,
    'standardOrderName', c.standard_order_name,
    'inHospitalOrderName', c.in_hospital_order_name,
    'billingName', c.billing_name,
    'categoryGroup', c.category_group,
    'billingCategory', v_billing_category,
    'orderType', v_order_type,
    'priceKrw', c.price_krw,
    'taxType', case when c.tax_included then 'taxable' else 'non_taxable' end,
    'quantity', p_quantity,
    'lineTotalSnapshot', v_line_total,
    'roundingResultKrw', v_rounding_result,
    'salesUnit', c.sales_unit,
    'amountBasis', v_price_basis,
    'taxIncluded', c.tax_included,
    'roundingRule', c.rounding_rule,
    'targetSpecies', pg_catalog.to_jsonb(c.target_species),
    'destinationModule', c.default_destination_module,
    'taskRequired', c.default_task_required,
    'billingReflectionEnabled', case
      when v_service_review_allowed
        then c.billing_reflection_enabled and c.price_krw is not null
      else c.billing_reflection_enabled
    end,
    'careGuide', c.care_guide,
    'careGuideDeliveryEnabled', c.care_guide_delivery_enabled,
    'internalInstruction', c.internal_instruction,
    'internalInstructionDeliveryEnabled', c.internal_instruction_delivery_enabled,
    'defaultDetailInputs', private.clair_catalog_effective_default_detail_inputs(c),
    'defaultDetailInputPolicies', c.default_detail_input_policies,
    'executionPresetLineage', case
      when c.source_execution_preset_id is null then null
      else pg_catalog.jsonb_build_object(
        'sourceExecutionPresetId', c.source_execution_preset_id,
        'sourceExecutionPresetRevision', c.source_execution_preset_revision,
        'sourceExecutionPresetSha256', c.source_execution_preset_sha256,
        'presetStatus', (
          select preset.preset_status
          from master.order_execution_presets preset
          where preset.id = c.source_execution_preset_id
            and preset.preset_revision = c.source_execution_preset_revision
        ),
        'clinicalUseAllowed', (
          select preset.clinical_use_allowed
          from master.order_execution_presets preset
          where preset.id = c.source_execution_preset_id
            and preset.preset_revision = c.source_execution_preset_revision
        )
      )
    end,
    'medicationMetadata', c.medication_metadata,
    'workspaceDispensingReview', pg_catalog.jsonb_build_object(
      'status', c.workspace_dispensing_review_status,
      'revision', c.workspace_dispensing_review_revision,
      'authoredByUserId', c.workspace_dispensing_authored_by_user_id,
      'authoredAt', c.workspace_dispensing_authored_at,
      'reviewedByUserId', c.workspace_dispensing_reviewed_by_user_id,
      'reviewedAt', c.workspace_dispensing_reviewed_at
    ),
    'rowType', 'individual',
    'priceRuleSource', case
      when v_service_review_allowed then 'workspace_service_review_price'
      else 'catalog_price'
    end,
    'snapshotSource', 'order_catalog_items'
  );
end;
$function$;

revoke all on function private.clair_build_catalog_order_snapshot(
  text, text, numeric
) from public, anon, authenticated, service_role;

-- A2 is the leaf for non-dispensing catalog edits.  Keep the established
-- scalar fields and CAS behavior, while allowing only the workspace-owned
-- execution-default copy.  Source preset identifiers and fingerprints remain
-- server-owned and are intentionally rejected below.
create or replace function public.clair_update_order_catalog_item_a2_unlocked(
  p_workspace_id text,
  p_item_id text,
  p_expected_catalog_revision integer,
  p_patch jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_item public.order_catalog_items%rowtype;
  v_next public.order_catalog_items%rowtype;
  v_key text;
  v_changed_fields text[] := '{}'::text[];
  v_known_keys text[] := array[
    'inHospitalOrderName', 'billingName', 'aliases', 'availabilityStatus',
    'priceKrw', 'salesUnit', 'targetSpecies', 'billingReflectionEnabled',
    'careGuide', 'careGuideDeliveryEnabled', 'internalInstruction',
    'internalInstructionDeliveryEnabled', 'taxIncluded', 'roundingRule',
    'pricingRule', 'medicationMetadata', 'vaccineMetadata',
    'in_hospital_order_name', 'billing_name', 'availability_status',
    'price_krw', 'sales_unit', 'target_species', 'billing_reflection_enabled',
    'care_guide', 'care_guide_delivery_enabled', 'internal_instruction',
    'internal_instruction_delivery_enabled', 'tax_included', 'rounding_rule',
    'pricing_rule', 'medication_metadata', 'vaccine_metadata',
    'defaultDetailInputs', 'default_detail_inputs'
  ];
  v_protected_keys text[] := array[
    'id', 'workspaceId', 'workspace_id', 'standardOrderId', 'standard_order_id',
    'sourcePresetVersion', 'source_preset_version', 'initialImportedPresetVersion',
    'initial_imported_preset_version', 'lastAutoMergedPresetVersion',
    'last_auto_merged_preset_version', 'customizationState', 'customization_state',
    'customizedFields', 'customized_fields', 'presetMergeStatus', 'preset_merge_status',
    'originType', 'origin_type', 'sourceMasterRecordId', 'source_master_record_id',
    'sourceMasterRevision', 'source_master_revision', 'initialImportedRevision',
    'initial_imported_revision', 'lastAutoMergedRevision', 'last_auto_merged_revision',
    'classificationPathId', 'classification_path_id', 'catalogRevision', 'catalog_revision',
    'sourceProjectionSnapshot', 'source_projection_snapshot',
    'sourceProjectionFingerprint', 'source_projection_fingerprint',
    'sourceExecutionPresetId', 'source_execution_preset_id',
    'sourceExecutionPresetRevision', 'source_execution_preset_revision',
    'sourceExecutionPresetSha256', 'source_execution_preset_sha256',
    'defaultDetailInputPolicies', 'default_detail_input_policies',
    'categoryGroup', 'category_group', 'categoryLabel', 'category_label', 'tCode',
    't_code', 'tCodeLabel', 't_code_label', 'standardOrderName', 'standard_order_name',
    'defaultDestinationModule', 'default_destination_module', 'defaultTaskRequired',
    'default_task_required', 'clinicalOrderType', 'clinical_order_type',
    'detailSchemaVersion', 'detail_schema_version', 'detailFieldSchema',
    'detail_field_schema', 'updatedAt', 'updated_at'
  ];
  v_has_default boolean := false;
  v_requested_default jsonb;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if p_patch is null or pg_catalog.jsonb_typeof(p_patch) <> 'object' then
    raise exception 'catalog_patch_object_required' using errcode = '22023';
  end if;
  if p_expected_catalog_revision is null or p_expected_catalog_revision <= 0 then
    raise exception 'catalog_revision_required' using errcode = '22023';
  end if;
  if not private.clair_is_active_workspace_member(p_workspace_id)
    or not private.clair_current_user_has_workspace_permission(
      p_workspace_id, 'service_catalog:manage'
    ) then
    raise exception 'workspace_admin_required' using errcode = '42501';
  end if;

  select * into v_item
  from public.order_catalog_items
  where workspace_id = p_workspace_id and id = p_item_id
  for update;
  if not found then
    raise exception 'order_catalog_item_not_found' using errcode = 'P0002';
  end if;
  if v_item.catalog_revision <> p_expected_catalog_revision then
    raise exception 'catalog_revision_conflict' using errcode = '40001';
  end if;

  if p_patch ? 'defaultDetailInputs'
     and p_patch ? 'default_detail_inputs'
     and (p_patch -> 'defaultDetailInputs') is distinct from
         (p_patch -> 'default_detail_inputs') then
    raise exception 'catalog_default_detail_inputs_alias_conflict'
      using errcode = '22023';
  end if;
  v_has_default := p_patch ? 'defaultDetailInputs'
    or p_patch ? 'default_detail_inputs';
  if v_has_default then
    v_requested_default := coalesce(
      p_patch -> 'defaultDetailInputs',
      p_patch -> 'default_detail_inputs'
    );
    if pg_catalog.jsonb_typeof(v_requested_default) <> 'object'
       or pg_catalog.octet_length(v_requested_default::text) > 65536 then
      raise exception 'catalog_default_detail_inputs_invalid' using errcode = '22023';
    end if;
  end if;

  for v_key in select pg_catalog.jsonb_object_keys(p_patch) loop
    if v_key = any(v_protected_keys) then
      raise exception 'catalog_protected_field_rejected:%', v_key using errcode = '42501';
    end if;
    if not v_key = any(v_known_keys) then
      raise exception 'catalog_patch_field_rejected:%', v_key using errcode = '22023';
    end if;
    v_changed_fields := pg_catalog.array_append(v_changed_fields, v_key);
  end loop;

  v_next := v_item;
  if p_patch ? 'inHospitalOrderName' or p_patch ? 'in_hospital_order_name' then
    v_next.in_hospital_order_name := coalesce(
      p_patch ->> 'inHospitalOrderName', p_patch ->> 'in_hospital_order_name'
    );
  end if;
  if p_patch ? 'billingName' or p_patch ? 'billing_name' then
    v_next.billing_name := coalesce(p_patch ->> 'billingName', p_patch ->> 'billing_name');
  end if;
  if p_patch ? 'aliases' then
    if pg_catalog.jsonb_typeof(p_patch -> 'aliases') <> 'array' then
      raise exception 'catalog_aliases_array_required' using errcode = '22023';
    end if;
    select coalesce(pg_catalog.array_agg(value #>> '{}' order by ordinality), '{}')
      into v_next.aliases
    from pg_catalog.jsonb_array_elements(p_patch -> 'aliases') with ordinality;
  end if;
  if p_patch ? 'targetSpecies' then
    if pg_catalog.jsonb_typeof(p_patch -> 'targetSpecies') <> 'array' then
      raise exception 'catalog_species_array_required' using errcode = '22023';
    end if;
    select coalesce(pg_catalog.array_agg(value #>> '{}' order by ordinality), '{}')
      into v_next.target_species
    from pg_catalog.jsonb_array_elements(p_patch -> 'targetSpecies') with ordinality;
  elsif p_patch ? 'target_species' then
    if pg_catalog.jsonb_typeof(p_patch -> 'target_species') <> 'array' then
      raise exception 'catalog_species_array_required' using errcode = '22023';
    end if;
    select coalesce(pg_catalog.array_agg(value #>> '{}' order by ordinality), '{}')
      into v_next.target_species
    from pg_catalog.jsonb_array_elements(p_patch -> 'target_species') with ordinality;
  end if;
  if p_patch ? 'availabilityStatus' or p_patch ? 'availability_status' then
    v_next.availability_status := coalesce(
      p_patch ->> 'availabilityStatus', p_patch ->> 'availability_status'
    );
  end if;
  if p_patch ? 'priceKrw' or p_patch ? 'price_krw' then
    v_next.price_krw := case
      when coalesce(p_patch ->> 'priceKrw', p_patch ->> 'price_krw') is null then null
      else (coalesce(p_patch ->> 'priceKrw', p_patch ->> 'price_krw'))::integer
    end;
  end if;
  if p_patch ? 'salesUnit' or p_patch ? 'sales_unit' then
    v_next.sales_unit := coalesce(p_patch ->> 'salesUnit', p_patch ->> 'sales_unit');
  end if;
  if p_patch ? 'billingReflectionEnabled' or p_patch ? 'billing_reflection_enabled' then
    v_next.billing_reflection_enabled := coalesce(
      (p_patch ->> 'billingReflectionEnabled')::boolean,
      (p_patch ->> 'billing_reflection_enabled')::boolean
    );
  end if;
  if p_patch ? 'careGuide' or p_patch ? 'care_guide' then
    v_next.care_guide := coalesce(p_patch ->> 'careGuide', p_patch ->> 'care_guide');
  end if;
  if p_patch ? 'careGuideDeliveryEnabled' or p_patch ? 'care_guide_delivery_enabled' then
    v_next.care_guide_delivery_enabled := coalesce(
      (p_patch ->> 'careGuideDeliveryEnabled')::boolean,
      (p_patch ->> 'care_guide_delivery_enabled')::boolean
    );
  end if;
  if p_patch ? 'internalInstruction' or p_patch ? 'internal_instruction' then
    v_next.internal_instruction := coalesce(
      p_patch ->> 'internalInstruction', p_patch ->> 'internal_instruction'
    );
  end if;
  if p_patch ? 'internalInstructionDeliveryEnabled'
     or p_patch ? 'internal_instruction_delivery_enabled' then
    v_next.internal_instruction_delivery_enabled := coalesce(
      (p_patch ->> 'internalInstructionDeliveryEnabled')::boolean,
      (p_patch ->> 'internal_instruction_delivery_enabled')::boolean
    );
  end if;
  if p_patch ? 'taxIncluded' or p_patch ? 'tax_included' then
    v_next.tax_included := coalesce(
      (p_patch ->> 'taxIncluded')::boolean, (p_patch ->> 'tax_included')::boolean
    );
  end if;
  if p_patch ? 'roundingRule' or p_patch ? 'rounding_rule' then
    v_next.rounding_rule := coalesce(p_patch ->> 'roundingRule', p_patch ->> 'rounding_rule');
  end if;
  if p_patch ? 'pricingRule' or p_patch ? 'pricing_rule' then
    v_next.pricing_rule := coalesce(p_patch -> 'pricingRule', p_patch -> 'pricing_rule');
    if pg_catalog.jsonb_typeof(v_next.pricing_rule) <> 'object' then
      raise exception 'catalog_pricing_rule_object_required' using errcode = '22023';
    end if;
  end if;
  if p_patch ? 'medicationMetadata' or p_patch ? 'medication_metadata' then
    v_next.medication_metadata := coalesce(
      p_patch -> 'medicationMetadata', p_patch -> 'medication_metadata'
    );
    if pg_catalog.jsonb_typeof(v_next.medication_metadata) <> 'object' then
      raise exception 'catalog_medication_metadata_object_required' using errcode = '22023';
    end if;
  end if;
  if p_patch ? 'vaccineMetadata' or p_patch ? 'vaccine_metadata' then
    v_next.vaccine_metadata := coalesce(
      p_patch -> 'vaccineMetadata', p_patch -> 'vaccine_metadata'
    );
  end if;
  -- These JSON columns are table-owned non-null compatibility state. A
  -- partial execution-default patch must never clear them while copying the
  -- composite row through a function compiled across additive migrations.
  v_next.pricing_rule := coalesce(v_next.pricing_rule, v_item.pricing_rule, '{}'::jsonb);
  v_next.medication_metadata := coalesce(
    v_next.medication_metadata,
    v_item.medication_metadata,
    '{}'::jsonb
  );
  v_next.vaccine_metadata := coalesce(
    v_next.vaccine_metadata,
    v_item.vaccine_metadata,
    '{}'::jsonb
  );
  if v_has_default then
    v_next.default_detail_inputs := v_requested_default;
    if v_next.default_detail_inputs <> '{}'::jsonb
       and coalesce(v_next.default_detail_input_policies, '{}'::jsonb) = '{}'::jsonb then
      select coalesce(pg_catalog.jsonb_object_agg(input_key, 'workspace_resolved'), '{}'::jsonb)
        into v_next.default_detail_input_policies
      from pg_catalog.jsonb_object_keys(v_next.default_detail_inputs) input_key;
    end if;
    -- A caller may edit values, but never the policy object itself.  Mark only
    -- keys present in this patch as workspace-resolved; untouched keys retain
    -- their master provenance policy.
    for v_key in select pg_catalog.jsonb_object_keys(v_requested_default) loop
      v_next.default_detail_input_policies := pg_catalog.jsonb_set(
        coalesce(v_next.default_detail_input_policies, '{}'::jsonb),
        array[v_key], '"workspace_resolved"'::jsonb, true
      );
    end loop;
  end if;

  if v_next.availability_status not in ('pending_activation', 'active', 'paused', 'inactive') then
    raise exception 'catalog_availability_invalid' using errcode = '22023';
  end if;
  if v_next.price_krw is not null and v_next.price_krw < 0 then
    raise exception 'catalog_price_invalid' using errcode = '22023';
  end if;
  if v_next.availability_status = 'active'
    and v_item.origin_type = 'clair_master'
    and not exists (
      select 1 from public.workspace_master_updates accepted_new
      where accepted_new.workspace_id = p_workspace_id
        and accepted_new.order_catalog_item_id = v_item.id
        and accepted_new.source_master_record_id = v_item.source_master_record_id
        and accepted_new.update_type = 'new'
        and accepted_new.status = 'accepted'
    ) then
    raise exception 'pending_activation_requires_accepted_review' using errcode = '42501';
  end if;
  if v_next.availability_status = 'active'
    and v_next.billing_reflection_enabled
    and v_next.price_krw is null then
    raise exception 'active_billable_price_required' using errcode = '23514';
  end if;
  if v_next.pricing_rule ? 'priceKrw' then
    v_next.pricing_rule := pg_catalog.jsonb_set(
      v_next.pricing_rule,
      '{priceKrw}',
      coalesce(pg_catalog.to_jsonb(v_next.price_krw), 'null'::jsonb),
      true
    );
  end if;
  if not private.clair_order_execution_preset_contract_is_valid(
    v_next.clinical_order_type,
    coalesce(v_next.detail_schema_version, 1),
    v_next.default_detail_inputs,
    coalesce(v_next.default_detail_input_policies, '{}'::jsonb)
  ) then
    raise exception 'catalog_default_detail_inputs_invalid' using errcode = '22023';
  end if;

  v_next.catalog_revision := v_item.catalog_revision + 1;
  v_next.customization_state := case
    when v_item.customization_state = 'detached' then 'detached' else 'customized' end;
  select coalesce(pg_catalog.array_agg(distinct field_name order by field_name), '{}')
    into v_next.customized_fields
  from pg_catalog.unnest(coalesce(v_item.customized_fields, '{}') || v_changed_fields) field_name;
  v_next.last_customized_at := pg_catalog.now();
  v_next.last_customized_by_user_id := auth.uid()::text;
  v_next.updated_at := pg_catalog.now();

  update public.order_catalog_items
  set in_hospital_order_name = v_next.in_hospital_order_name,
      billing_name = v_next.billing_name,
      aliases = v_next.aliases,
      availability_status = v_next.availability_status,
      price_krw = v_next.price_krw,
      sales_unit = v_next.sales_unit,
      target_species = v_next.target_species,
      billing_reflection_enabled = v_next.billing_reflection_enabled,
      care_guide = v_next.care_guide,
      care_guide_delivery_enabled = v_next.care_guide_delivery_enabled,
      internal_instruction = v_next.internal_instruction,
      internal_instruction_delivery_enabled = v_next.internal_instruction_delivery_enabled,
      tax_included = v_next.tax_included,
      rounding_rule = v_next.rounding_rule,
      pricing_rule = v_next.pricing_rule,
      medication_metadata = v_next.medication_metadata,
      vaccine_metadata = v_next.vaccine_metadata,
      default_detail_inputs = v_next.default_detail_inputs,
      default_detail_input_policies = v_next.default_detail_input_policies,
      catalog_revision = v_next.catalog_revision,
      customization_state = v_next.customization_state,
      customized_fields = v_next.customized_fields,
      last_customized_at = v_next.last_customized_at,
      last_customized_by_user_id = v_next.last_customized_by_user_id,
      updated_at = v_next.updated_at
  where workspace_id = p_workspace_id and id = p_item_id
  returning * into v_next;

  perform private.clair_pr020_append_order_catalog_audit(
    p_workspace_id,
    case when pg_catalog.cardinality(v_changed_fields) = 1
      and v_changed_fields && array['availabilityStatus', 'availability_status']::text[]
      and v_next.availability_status = 'paused'
      then 'order_catalog.paused' else 'order_catalog.updated' end,
    v_next.id,
    v_item,
    v_next,
    case when pg_catalog.cardinality(v_changed_fields) = 1
      and v_changed_fields && array['availabilityStatus', 'availability_status']::text[]
      and v_next.availability_status = 'paused'
      then 'pause' else 'update' end,
    v_changed_fields
  );
  return pg_catalog.jsonb_build_object(
    'ok', true, 'status', 200, 'item', pg_catalog.to_jsonb(v_next),
    'databaseAuditWritten', true, 'enforcedBy', 'clair_update_order_catalog_item_a2_unlocked'
  );
end;
$function$;

revoke all on function public.clair_update_order_catalog_item_a2_unlocked(
  text, text, integer, jsonb
) from public, anon, authenticated, service_role;

-- Dispensing keeps the historical medicationMetadata representation as a
-- compatibility surface.  A non-empty generic patch is mirrored into that
-- nested object; legacy-only nested patches are promoted to the generic copy.
-- An explicit empty generic patch clears only the generic override, preserving
-- the old nested fallback (the helper above remains the effective-value rule).
create or replace function private.clair_update_workspace_dispensing_order(
  p_workspace_id text,
  p_item_id text,
  p_expected_catalog_revision integer,
  p_patch jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_item public.order_catalog_items%rowtype;
  v_next public.order_catalog_items%rowtype;
  v_key text;
  v_changed text[] := array[]::text[];
  v_substantive boolean := false;
  v_known text[] := array[
    'inHospitalOrderName', 'billingName', 'aliases', 'availabilityStatus',
    'priceKrw', 'salesUnit', 'targetSpecies', 'billingReflectionEnabled',
    'careGuide', 'internalInstruction', 'taxIncluded', 'roundingRule',
    'pricingRule', 'medicationMetadata', 'defaultDetailInputs',
    'default_detail_inputs'
  ];
  v_protected text[] := array[
    'sourceExecutionPresetId', 'source_execution_preset_id',
    'sourceExecutionPresetRevision', 'source_execution_preset_revision',
    'sourceExecutionPresetSha256', 'source_execution_preset_sha256',
    'defaultDetailInputPolicies', 'default_detail_input_policies',
    'originType', 'origin_type', 'sourceMasterRecordId', 'source_master_record_id',
    'sourceMasterRevision', 'source_master_revision', 'catalogRevision',
    'catalog_revision', 'customizationState', 'customization_state',
    'customizedFields', 'customized_fields', 'presetMergeStatus',
    'preset_merge_status', 'sourceProjectionSnapshot', 'source_projection_snapshot',
    'sourceProjectionFingerprint', 'source_projection_fingerprint'
  ];
  v_generic_present boolean := false;
  v_nested_present boolean := false;
  v_generic jsonb;
  v_nested jsonb;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if not private.clair_is_active_workspace_member(p_workspace_id)
     or not private.clair_current_user_has_workspace_permission(
       p_workspace_id, 'service_catalog:manage'
     ) then
    raise exception 'dispensing_author_required' using errcode = '42501';
  end if;
  if p_patch is null or pg_catalog.jsonb_typeof(p_patch) <> 'object'
     or p_expected_catalog_revision is null
     or p_expected_catalog_revision <= 0 then
    raise exception 'catalog_patch_invalid' using errcode = '22023';
  end if;
  select * into v_item
  from public.order_catalog_items
  where workspace_id = p_workspace_id and id = p_item_id
  for update;
  if not found then
    raise exception 'order_catalog_item_not_found' using errcode = 'P0002';
  end if;
  if v_item.category_group <> 'medication'
     or v_item.default_destination_module <> 'dispensing' then
    raise exception 'workspace_dispensing_update_only' using errcode = '22023';
  end if;
  if v_item.catalog_revision <> p_expected_catalog_revision then
    raise exception 'catalog_revision_conflict' using errcode = '40001';
  end if;

  v_generic_present := p_patch ? 'defaultDetailInputs'
    or p_patch ? 'default_detail_inputs';
  if p_patch ? 'defaultDetailInputs'
     and p_patch ? 'default_detail_inputs'
     and (p_patch -> 'defaultDetailInputs') is distinct from
         (p_patch -> 'default_detail_inputs') then
    raise exception 'catalog_default_detail_inputs_alias_conflict' using errcode = '22023';
  end if;
  if v_generic_present then
    v_generic := case when p_patch ? 'defaultDetailInputs'
      then p_patch -> 'defaultDetailInputs'
      else p_patch -> 'default_detail_inputs' end;
    if pg_catalog.jsonb_typeof(v_generic) <> 'object'
       or pg_catalog.octet_length(v_generic::text) > 65536 then
      raise exception 'catalog_default_detail_inputs_invalid' using errcode = '22023';
    end if;
  end if;

  for v_key in select pg_catalog.jsonb_object_keys(p_patch) loop
    if v_key = any(v_protected) then
      raise exception 'catalog_protected_field_rejected:%', v_key using errcode = '42501';
    end if;
    if not v_key = any(v_known) then
      raise exception 'catalog_patch_field_rejected:%', v_key using errcode = '22023';
    end if;
    v_changed := pg_catalog.array_append(v_changed, v_key);
    if v_key <> 'availabilityStatus' then v_substantive := true; end if;
  end loop;

  v_next := v_item;
  if p_patch ? 'inHospitalOrderName' then v_next.in_hospital_order_name := p_patch ->> 'inHospitalOrderName'; end if;
  if p_patch ? 'billingName' then v_next.billing_name := p_patch ->> 'billingName'; end if;
  if p_patch ? 'aliases' then
    if pg_catalog.jsonb_typeof(p_patch -> 'aliases') <> 'array' then
      raise exception 'catalog_aliases_array_required' using errcode = '22023';
    end if;
    select coalesce(pg_catalog.array_agg(value #>> '{}' order by ordinality), '{}')
      into v_next.aliases
    from pg_catalog.jsonb_array_elements(p_patch -> 'aliases') with ordinality;
  end if;
  if p_patch ? 'availabilityStatus' then v_next.availability_status := p_patch ->> 'availabilityStatus'; end if;
  if p_patch ? 'priceKrw' then v_next.price_krw := (p_patch ->> 'priceKrw')::integer; end if;
  if p_patch ? 'salesUnit' then v_next.sales_unit := p_patch ->> 'salesUnit'; end if;
  if p_patch ? 'targetSpecies' then
    if pg_catalog.jsonb_typeof(p_patch -> 'targetSpecies') <> 'array' then
      raise exception 'catalog_species_array_required' using errcode = '22023';
    end if;
    select coalesce(pg_catalog.array_agg(value #>> '{}' order by ordinality), '{}')
      into v_next.target_species
    from pg_catalog.jsonb_array_elements(p_patch -> 'targetSpecies') with ordinality;
  end if;
  if p_patch ? 'billingReflectionEnabled' then
    v_next.billing_reflection_enabled := (p_patch ->> 'billingReflectionEnabled')::boolean;
  end if;
  if p_patch ? 'careGuide' then v_next.care_guide := p_patch ->> 'careGuide'; end if;
  if p_patch ? 'internalInstruction' then v_next.internal_instruction := p_patch ->> 'internalInstruction'; end if;
  if p_patch ? 'taxIncluded' then v_next.tax_included := (p_patch ->> 'taxIncluded')::boolean; end if;
  if p_patch ? 'roundingRule' then v_next.rounding_rule := p_patch ->> 'roundingRule'; end if;
  if p_patch ? 'pricingRule' then
    v_next.pricing_rule := p_patch -> 'pricingRule';
    if pg_catalog.jsonb_typeof(v_next.pricing_rule) <> 'object' then
      raise exception 'catalog_pricing_rule_object_required' using errcode = '22023';
    end if;
  end if;
  if p_patch ? 'medicationMetadata' then
    v_next.medication_metadata := p_patch -> 'medicationMetadata';
    if pg_catalog.jsonb_typeof(v_next.medication_metadata) <> 'object' then
      raise exception 'catalog_medication_metadata_object_required' using errcode = '22023';
    end if;
  end if;

  if p_patch ? 'medicationMetadata'
     and v_next.medication_metadata ? 'defaultDetailInputs' then
    v_nested_present := true;
    v_nested := v_next.medication_metadata -> 'defaultDetailInputs';
    if pg_catalog.jsonb_typeof(v_nested) <> 'object'
       or pg_catalog.octet_length(v_nested::text) > 65536 then
      raise exception 'catalog_default_detail_inputs_invalid' using errcode = '22023';
    end if;
  end if;
  if v_generic_present and v_nested_present
     and v_generic is distinct from v_nested then
    raise exception 'catalog_default_detail_inputs_mirror_conflict' using errcode = '22023';
  end if;
  if v_generic_present then
    v_next.default_detail_inputs := v_generic;
    -- Empty generic means "use the legacy nested value".  This is a
    -- deliberate compatibility clear and must not erase medication details.
    if v_generic <> '{}'::jsonb then
      v_next.medication_metadata := pg_catalog.jsonb_set(
        v_next.medication_metadata, '{defaultDetailInputs}', v_generic, true
      );
    end if;
  elsif v_nested_present then
    v_next.default_detail_inputs := v_nested;
    v_next.medication_metadata := pg_catalog.jsonb_set(
      v_next.medication_metadata, '{defaultDetailInputs}', v_nested, true
    );
  end if;

  if v_next.default_detail_inputs <> '{}'::jsonb
     and coalesce(v_next.default_detail_input_policies, '{}'::jsonb) = '{}'::jsonb then
    select coalesce(pg_catalog.jsonb_object_agg(input_key, 'workspace_resolved'), '{}'::jsonb)
      into v_next.default_detail_input_policies
      from pg_catalog.jsonb_object_keys(v_next.default_detail_inputs) input_key;
  end if;
  if v_generic_present or v_nested_present then
    for v_key in select pg_catalog.jsonb_object_keys(
      case when v_generic_present then v_generic else v_nested end
    ) loop
      v_next.default_detail_input_policies := pg_catalog.jsonb_set(
        coalesce(v_next.default_detail_input_policies, '{}'::jsonb),
        array[v_key], '"workspace_resolved"'::jsonb, true
      );
    end loop;
  end if;
  if not private.clair_order_execution_preset_contract_is_valid(
    v_next.clinical_order_type,
    coalesce(v_next.detail_schema_version, 1),
    v_next.default_detail_inputs,
    coalesce(v_next.default_detail_input_policies, '{}'::jsonb)
  ) then
    raise exception 'catalog_default_detail_inputs_invalid' using errcode = '22023';
  end if;
  v_next.pricing_rule := v_next.pricing_rule || pg_catalog.jsonb_build_object(
    'priceKrw', v_next.price_krw,
    'salesUnit', v_next.sales_unit,
    'taxIncluded', v_next.tax_included,
    'roundingRule', v_next.rounding_rule,
    'billingReflectionEnabled', v_next.billing_reflection_enabled
  );
  perform private.clair_validate_workspace_dispensing_preset(
    v_next.medication_metadata, v_next.price_krw, v_next.pricing_rule
  );
  if exists (
    select 1 from pg_catalog.unnest(v_next.target_species) species_code
    where species_code not in ('dog', 'cat', 'other')
  ) then
    raise exception 'catalog_species_invalid' using errcode = '22023';
  end if;
  if v_next.availability_status not in ('pending_activation', 'active', 'paused', 'inactive') then
    raise exception 'catalog_availability_invalid' using errcode = '22023';
  end if;

  if v_item.origin_type = 'workspace_custom' and v_substantive then
    v_next.availability_status := 'pending_activation';
    v_next.workspace_dispensing_review_status := 'pending';
    v_next.workspace_dispensing_review_revision := v_item.workspace_dispensing_review_revision + 1;
    v_next.workspace_dispensing_authored_by_user_id := auth.uid();
    v_next.workspace_dispensing_authored_at := pg_catalog.now();
    v_next.workspace_dispensing_reviewed_by_user_id := null;
    v_next.workspace_dispensing_reviewed_at := null;
    v_next.workspace_dispensing_review_note := null;
  elsif v_item.origin_type = 'workspace_custom'
        and v_next.availability_status = 'active'
        and v_item.workspace_dispensing_review_status <> 'approved' then
    raise exception 'dispensing_review_required' using errcode = '42501';
  end if;

  v_next.catalog_revision := v_item.catalog_revision + 1;
  v_next.customization_state := case
    when v_item.customization_state = 'detached' then 'detached' else 'customized' end;
  select coalesce(pg_catalog.array_agg(distinct field_name order by field_name), '{}')
    into v_next.customized_fields
  from pg_catalog.unnest(coalesce(v_item.customized_fields, '{}') || v_changed) field_name;
  v_next.last_customized_at := pg_catalog.now();
  v_next.last_customized_by_user_id := auth.uid()::text;
  v_next.updated_at := pg_catalog.now();

  update public.order_catalog_items set
    in_hospital_order_name = v_next.in_hospital_order_name,
    billing_name = v_next.billing_name,
    aliases = v_next.aliases,
    availability_status = v_next.availability_status,
    price_krw = v_next.price_krw,
    sales_unit = v_next.sales_unit,
    target_species = v_next.target_species,
    billing_reflection_enabled = v_next.billing_reflection_enabled,
    care_guide = v_next.care_guide,
    internal_instruction = v_next.internal_instruction,
    tax_included = v_next.tax_included,
    rounding_rule = v_next.rounding_rule,
    pricing_rule = v_next.pricing_rule,
    medication_metadata = v_next.medication_metadata,
    default_detail_inputs = v_next.default_detail_inputs,
    default_detail_input_policies = v_next.default_detail_input_policies,
    catalog_revision = v_next.catalog_revision,
    customization_state = v_next.customization_state,
    customized_fields = v_next.customized_fields,
    last_customized_at = v_next.last_customized_at,
    last_customized_by_user_id = v_next.last_customized_by_user_id,
    workspace_dispensing_review_status = v_next.workspace_dispensing_review_status,
    workspace_dispensing_review_revision = v_next.workspace_dispensing_review_revision,
    workspace_dispensing_authored_by_user_id = v_next.workspace_dispensing_authored_by_user_id,
    workspace_dispensing_authored_at = v_next.workspace_dispensing_authored_at,
    workspace_dispensing_reviewed_by_user_id = v_next.workspace_dispensing_reviewed_by_user_id,
    workspace_dispensing_reviewed_at = v_next.workspace_dispensing_reviewed_at,
    workspace_dispensing_review_note = v_next.workspace_dispensing_review_note,
    updated_at = v_next.updated_at
  where workspace_id = p_workspace_id and id = p_item_id
  returning * into v_next;

  perform private.clair_pr020_append_order_catalog_audit(
    p_workspace_id,
    case when pg_catalog.cardinality(v_changed) = 1
      and 'availabilityStatus' = any(v_changed)
      and v_next.availability_status = 'paused'
      then 'order_catalog.paused' else 'order_catalog.updated' end,
    v_next.id,
    v_item,
    v_next,
    case when pg_catalog.cardinality(v_changed) = 1
      and 'availabilityStatus' = any(v_changed)
      and v_next.availability_status = 'paused'
      then 'pause' else 'update' end,
    v_changed
  );
  return pg_catalog.jsonb_build_object(
    'ok', true,
    'status', 200,
    'item', pg_catalog.to_jsonb(v_next),
    'databaseAuditWritten', true,
    'enforcedBy', 'clair_update_workspace_dispensing_order'
  );
end;
$function$;

revoke all on function private.clair_update_workspace_dispensing_order(
  text, text, integer, jsonb
) from public, anon, authenticated, service_role;

-- The PR-020 public create dispatcher sends non-dispensing custom rows to
-- this renamed compatibility writer.  Preserve that branch, but make the
-- writer carry the same generic execution-default contract as the dispensing
-- branch.  Source preset lineage and policy maps remain server-owned.
create or replace function public.clair_create_order_catalog_item_pr020_legacy(
  p_workspace_id text,
  p_item jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_item public.order_catalog_items%rowtype;
  v_id text := coalesce(
    nullif(pg_catalog.btrim(p_item ->> 'id'), ''),
    'ord-' || pg_catalog.replace(extensions.gen_random_uuid()::text, '-', '')
  );
  v_requested_category text := coalesce(
    p_item ->> 'categoryGroup', p_item ->> 'category_group'
  );
  v_category text;
  v_clinical_order_type text;
  v_path_id uuid;
  v_requested_path_id text := nullif(coalesce(
    p_item ->> 'classificationPathId', p_item ->> 'classification_path_id'
  ), '');
  v_path master.classification_paths%rowtype;
  v_action master.clinical_actions%rowtype;
  v_chart master.chart_groups%rowtype;
  v_route master.task_routes%rowtype;
  v_t_category master.order_categories%rowtype;
  v_t_category_record master.master_records%rowtype;
  v_t_code_label text;
  v_price integer;
  v_sales_unit text := coalesce(
    p_item ->> 'salesUnit', p_item ->> 'sales_unit', 'per_each'
  );
  v_target_species text[];
  v_tax_included boolean := coalesce(
    (p_item ->> 'taxIncluded')::boolean,
    (p_item ->> 'tax_included')::boolean,
    true
  );
  v_rounding_rule text := coalesce(
    p_item ->> 'roundingRule', p_item ->> 'rounding_rule', 'as_is'
  );
  v_availability text := coalesce(
    p_item ->> 'availabilityStatus', p_item ->> 'availability_status', 'active'
  );
  v_billing boolean := coalesce(
    (p_item ->> 'billingReflectionEnabled')::boolean,
    (p_item ->> 'billing_reflection_enabled')::boolean,
    true
  );
  v_pricing jsonb;
  v_source_key text;
  v_generic_present boolean := false;
  v_generic jsonb := '{}'::jsonb;
  v_supplied_generic jsonb := '{}'::jsonb;
  v_schema jsonb;
  v_policies jsonb := '{}'::jsonb;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if p_item is null or pg_catalog.jsonb_typeof(p_item) <> 'object' then
    raise exception 'catalog_item_object_required' using errcode = '22023';
  end if;
  if not private.clair_is_active_workspace_member(p_workspace_id)
    or not private.clair_current_user_has_workspace_permission(
      p_workspace_id, 'service_catalog:manage'
    ) then
    raise exception 'workspace_admin_required' using errcode = '42501';
  end if;
  if p_item ? 'originType' or p_item ? 'origin_type'
    or p_item ? 'sourceMasterRecordId' or p_item ? 'source_master_record_id'
    or p_item ? 'sourceMasterRevision' or p_item ? 'source_master_revision'
    or p_item ? 'initialImportedRevision' or p_item ? 'initial_imported_revision'
    or p_item ? 'lastAutoMergedRevision' or p_item ? 'last_auto_merged_revision'
    or p_item ? 'sourceProjectionSnapshot' or p_item ? 'source_projection_snapshot'
    or p_item ? 'sourceProjectionFingerprint' or p_item ? 'source_projection_fingerprint'
    or p_item ? 'catalogRevision' or p_item ? 'catalog_revision'
    or p_item ? 'customizationState' or p_item ? 'customization_state'
    or p_item ? 'customizedFields' or p_item ? 'customized_fields'
    or p_item ? 'presetMergeStatus' or p_item ? 'preset_merge_status'
    or p_item ? 'sourceExecutionPresetId' or p_item ? 'source_execution_preset_id'
    or p_item ? 'sourceExecutionPresetRevision' or p_item ? 'source_execution_preset_revision'
    or p_item ? 'sourceExecutionPresetSha256' or p_item ? 'source_execution_preset_sha256'
    or p_item ? 'defaultDetailInputPolicies' or p_item ? 'default_detail_input_policies' then
    raise exception 'catalog_lineage_client_write_rejected' using errcode = '42501';
  end if;
  if p_item ? 'defaultDetailInputs' and p_item ? 'default_detail_inputs'
     and (p_item -> 'defaultDetailInputs') is distinct from
         (p_item -> 'default_detail_inputs') then
    raise exception 'catalog_default_detail_inputs_alias_conflict' using errcode = '22023';
  end if;
  v_generic_present := p_item ? 'defaultDetailInputs'
    or p_item ? 'default_detail_inputs';
  if v_generic_present then
    v_generic := case when p_item ? 'defaultDetailInputs'
      then p_item -> 'defaultDetailInputs'
      else p_item -> 'default_detail_inputs' end;
    if pg_catalog.jsonb_typeof(v_generic) <> 'object'
       or pg_catalog.octet_length(v_generic::text) > 65536 then
      raise exception 'catalog_default_detail_inputs_invalid' using errcode = '22023';
    end if;
  end if;

  if v_requested_path_id is not null then
    begin
      v_path_id := v_requested_path_id::uuid;
    exception when invalid_text_representation then
      raise exception 'catalog_classification_path_invalid' using errcode = '22023';
    end;
    select * into v_path
    from master.classification_paths
    where id = v_path_id and retired_in_release_id is null
    for update;
  else
    if v_requested_category not in (
      'consultation', 'medication', 'treatment', 'lab', 'imaging',
      'hospitalization', 'misc'
    ) then
      raise exception 'catalog_category_invalid' using errcode = '22023';
    end if;
    v_path_id := private.clinical_master_fallback_path_for_item_type(
      v_requested_category
    );
    select * into v_path
    from master.classification_paths
    where id = v_path_id
    for update;
  end if;
  if not found or v_path.retired_in_release_id is not null then
    raise exception 'clinical_master_classification_fallback_missing' using errcode = '23503';
  end if;

  select * into v_action
  from master.clinical_actions
  where master_record_id = v_path.clinical_action_id;
  select * into v_chart
  from master.chart_groups
  where master_record_id = v_path.chart_group_id;
  select * into v_route
  from master.task_routes
  where master_record_id = v_path.task_route_id;
  select * into v_t_category
  from master.order_categories
  where master_record_id = v_action.t_category_id;
  select * into v_t_category_record
  from master.master_records
  where id = v_action.t_category_id;
  if v_route.runtime_status <> 'active' then
    raise exception 'clinical_master_held_task_route_rejected' using errcode = '23514';
  end if;
  if v_action.item_type is null
     or v_chart.group_code is null
     or v_route.destination_module is null then
    raise exception 'clinical_master_classification_path_unusable' using errcode = '23503';
  end if;
  v_category := v_action.item_type;
  v_clinical_order_type := case v_category
    when 'consultation' then 'consultation'
    when 'lab' then 'clinical_lab'
    when 'imaging' then 'imaging'
    when 'medication' then 'dispensing'
    when 'treatment' then 'treatment'
    when 'hospitalization' then 'hospitalization'
    else 'other'
  end;
  v_t_code_label := coalesce((
    select name_row.name
    from master.master_record_names name_row
    where name_row.master_record_id = v_t_category_record.id
      and name_row.language_code = 'ko'
      and name_row.name_kind = 'preferred'
    order by name_row.sort_order, name_row.id
    limit 1
  ), v_t_category.category_code);

  if p_item ? 'targetSpecies'
       and pg_catalog.jsonb_typeof(p_item -> 'targetSpecies') <> 'array'
    or p_item ? 'target_species'
       and pg_catalog.jsonb_typeof(p_item -> 'target_species') <> 'array' then
    raise exception 'catalog_species_array_required' using errcode = '22023';
  end if;
  v_target_species := coalesce(
    array(
      select value #>> '{}'
      from pg_catalog.jsonb_array_elements(coalesce(
        p_item -> 'targetSpecies',
        p_item -> 'target_species',
        '["dog","cat"]'::jsonb
      ))
    ),
    '{dog,cat}'
  );
  if exists (
    select 1
    from pg_catalog.unnest(v_target_species) species_code
    where species_code not in ('dog', 'cat', 'other')
  ) then
    raise exception 'catalog_species_invalid' using errcode = '22023';
  end if;
  if v_sales_unit not in (
    'per_order', 'per_each', 'per_day', 'per_frequency', 'per_ml', 'per_kg'
  ) then
    raise exception 'catalog_sales_unit_invalid' using errcode = '22023';
  end if;
  if v_availability not in ('pending_activation', 'active', 'paused', 'inactive') then
    raise exception 'catalog_availability_invalid' using errcode = '22023';
  end if;
  v_price := case
    when coalesce(p_item ->> 'priceKrw', p_item ->> 'price_krw') is null then null
    else (coalesce(p_item ->> 'priceKrw', p_item ->> 'price_krw'))::integer
  end;
  if v_price is not null and v_price < 0 then
    raise exception 'catalog_price_invalid' using errcode = '22023';
  end if;
  if v_availability = 'active' and v_billing and v_price is null then
    raise exception 'active_billable_price_required' using errcode = '23514';
  end if;

  v_supplied_generic := v_generic;
  v_schema := private.clair_order_detail_field_schema_v1(v_clinical_order_type);
  select coalesce(
    pg_catalog.jsonb_object_agg(
      field.value ->> 'key',
      case
        when v_supplied_generic ? (field.value ->> 'key')
          then 'workspace_resolved'
        when field.value -> 'defaultValue' is not null
             and pg_catalog.jsonb_typeof(field.value -> 'defaultValue') <> 'null'
          then 'schema_default'
        when coalesce((field.value ->> 'required')::boolean, false)
          then 'required_manual'
        else 'not_applicable'
      end
    ),
    '{}'::jsonb
  )
  into v_policies
  from pg_catalog.jsonb_array_elements(v_schema -> 'fields') field(value);
  select coalesce(
    pg_catalog.jsonb_object_agg(field.value ->> 'key', field.value -> 'defaultValue')
      filter (
        where field.value -> 'defaultValue' is not null
          and pg_catalog.jsonb_typeof(field.value -> 'defaultValue') <> 'null'
      ),
    '{}'::jsonb
  )
  into v_generic
  from pg_catalog.jsonb_array_elements(v_schema -> 'fields') field(value);
  v_generic := v_generic || v_supplied_generic;
  if pg_catalog.octet_length(v_generic::text) > 65536 then
    raise exception 'catalog_default_detail_inputs_invalid' using errcode = '22023';
  end if;
  if not private.clair_order_execution_preset_contract_is_valid(
    v_clinical_order_type,
    1,
    v_generic,
    v_policies
  ) then
    raise exception 'catalog_default_detail_inputs_invalid' using errcode = '22023';
  end if;

  v_pricing := pg_catalog.jsonb_build_object(
    'priceBasis', case
      when v_sales_unit = 'per_day' then 'unit_price'
      else 'fixed_order_price'
    end,
    'priceKrw', v_price,
    'salesUnit', v_sales_unit,
    'taxIncluded', v_tax_included,
    'roundingRule', v_rounding_rule,
    'billingReflectionEnabled', v_billing
  );
  v_source_key := coalesce(
    nullif(pg_catalog.btrim(p_item ->> 'standardOrderId'), ''),
    nullif(pg_catalog.btrim(p_item ->> 'standard_order_id'), ''),
    v_id
  );

  insert into public.order_catalog_items (
    id, workspace_id, standard_order_id, source_preset_version,
    initial_imported_preset_version, last_auto_merged_preset_version,
    customization_state, customized_fields, last_customized_at,
    last_customized_by_user_id, preset_merge_status, category_group,
    category_label, t_code, t_code_label, standard_order_name,
    in_hospital_order_name, billing_name, aliases, availability_status,
    price_krw, sales_unit, target_species, default_destination_module,
    default_task_required, billing_reflection_enabled, care_guide,
    care_guide_delivery_enabled, internal_instruction,
    internal_instruction_delivery_enabled, tax_included, rounding_rule,
    pricing_rule, medication_metadata, vaccine_metadata, origin_type,
    classification_path_id, catalog_revision, default_detail_inputs,
    default_detail_input_policies
  ) values (
    v_id, p_workspace_id, v_source_key,
    coalesce(
      p_item ->> 'sourcePresetVersion',
      p_item ->> 'source_preset_version',
      'workspace-custom-v1'
    ),
    null, null, 'detached', array['*'], pg_catalog.now(), auth.uid()::text,
    'detached', v_category, v_chart.group_code, v_t_category.category_code,
    v_t_code_label,
    coalesce(
      p_item ->> 'standardOrderName',
      p_item ->> 'standard_order_name',
      v_source_key
    ),
    coalesce(
      p_item ->> 'inHospitalOrderName',
      p_item ->> 'in_hospital_order_name',
      v_source_key
    ),
    coalesce(
      p_item ->> 'billingName', p_item ->> 'billing_name', v_source_key
    ),
    coalesce(
      array(
        select value #>> '{}'
        from pg_catalog.jsonb_array_elements(
          coalesce(p_item -> 'aliases', '[]'::jsonb)
        )
      ), '{}'
    ),
    v_availability, v_price, v_sales_unit, v_target_species,
    case v_route.destination_module
      when 'inpatient' then 'billing_only'
      else v_route.destination_module
    end,
    v_route.task_required, v_billing, p_item ->> 'careGuide',
    coalesce((p_item ->> 'careGuideDeliveryEnabled')::boolean, false),
    p_item ->> 'internalInstruction',
    coalesce((p_item ->> 'internalInstructionDeliveryEnabled')::boolean, false),
    v_tax_included, v_rounding_rule, v_pricing,
    coalesce(p_item -> 'medicationMetadata', '{}'::jsonb),
    coalesce(p_item -> 'vaccineMetadata', '{}'::jsonb),
    'workspace_custom', v_path_id, 1, v_generic, v_policies
  ) returning * into v_item;

  perform private.clair_pr020_append_order_catalog_audit(
    p_workspace_id,
    'order_catalog.created',
    v_item.id,
    null::public.order_catalog_items,
    v_item,
    'create',
    array['*']::text[]
  );
  return pg_catalog.jsonb_build_object(
    'ok', true,
    'status', 200,
    'item', pg_catalog.to_jsonb(v_item),
    'databaseAuditWritten', true,
    'enforcedBy', 'clair_create_order_catalog_item_pr020_legacy'
  );
end;
$function$;

revoke all on function public.clair_create_order_catalog_item_pr020_legacy(
  text, jsonb
) from public, anon, authenticated, service_role;

-- New workspace-custom dispensing rows receive the same generic copy at
-- creation time.  The public dispatcher in PR-020 already routes medication
-- creates here, so no client can bypass its review gate.
create or replace function public.clair_create_workspace_dispensing_order(
  p_workspace_id text,
  p_item jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_item public.order_catalog_items%rowtype;
  v_id text := 'ord-' || pg_catalog.replace(extensions.gen_random_uuid()::text, '-', '');
  v_path_id uuid;
  v_path master.classification_paths%rowtype;
  v_action master.clinical_actions%rowtype;
  v_chart master.chart_groups%rowtype;
  v_route master.task_routes%rowtype;
  v_t_category master.order_categories%rowtype;
  v_t_record master.master_records%rowtype;
  v_t_code_label text;
  v_price integer;
  v_sales_unit text;
  v_species text[];
  v_tax boolean;
  v_rounding text;
  v_billing boolean;
  v_pricing jsonb;
  v_metadata jsonb;
  v_source_key text;
  v_generic_present boolean := false;
  v_generic jsonb;
  v_nested jsonb;
  v_schema jsonb;
  v_policies jsonb := '{}'::jsonb;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if not private.clair_is_active_workspace_member(p_workspace_id)
     or not private.clair_current_user_has_workspace_permission(
       p_workspace_id, 'service_catalog:manage'
     ) then
    raise exception 'dispensing_author_required' using errcode = '42501';
  end if;
  if p_item is null or pg_catalog.jsonb_typeof(p_item) <> 'object' then
    raise exception 'catalog_item_object_required' using errcode = '22023';
  end if;
  if coalesce(p_item ->> 'categoryGroup', '') <> 'medication'
     or coalesce(p_item ->> 'defaultDestinationModule', '') <> 'dispensing' then
    raise exception 'workspace_dispensing_create_only' using errcode = '22023';
  end if;
  if p_item ? 'originType' or p_item ? 'origin_type'
     or p_item ? 'sourceMasterRecordId' or p_item ? 'source_master_record_id'
     or p_item ? 'sourceMasterRevision' or p_item ? 'source_master_revision'
     or p_item ? 'sourceProjectionSnapshot' or p_item ? 'source_projection_snapshot'
     or p_item ? 'workspaceDispensingReview' or p_item ? 'workspace_dispensing_review'
     or p_item ? 'sourceExecutionPresetId' or p_item ? 'source_execution_preset_id'
     or p_item ? 'sourceExecutionPresetRevision' or p_item ? 'source_execution_preset_revision'
     or p_item ? 'sourceExecutionPresetSha256' or p_item ? 'source_execution_preset_sha256'
     or p_item ? 'defaultDetailInputPolicies' or p_item ? 'default_detail_input_policies' then
    raise exception 'catalog_lineage_client_write_rejected' using errcode = '42501';
  end if;
  if p_item ? 'defaultDetailInputs' and p_item ? 'default_detail_inputs'
     and (p_item -> 'defaultDetailInputs') is distinct from
         (p_item -> 'default_detail_inputs') then
    raise exception 'catalog_default_detail_inputs_alias_conflict' using errcode = '22023';
  end if;
  v_generic_present := p_item ? 'defaultDetailInputs'
    or p_item ? 'default_detail_inputs';
  if v_generic_present then
    v_generic := case when p_item ? 'defaultDetailInputs'
      then p_item -> 'defaultDetailInputs' else p_item -> 'default_detail_inputs' end;
    if pg_catalog.jsonb_typeof(v_generic) <> 'object'
       or pg_catalog.octet_length(v_generic::text) > 65536 then
      raise exception 'catalog_default_detail_inputs_invalid' using errcode = '22023';
    end if;
  end if;

  v_price := (p_item ->> 'priceKrw')::integer;
  v_sales_unit := coalesce(p_item ->> 'salesUnit', 'per_each');
  v_tax := coalesce((p_item ->> 'taxIncluded')::boolean, true);
  v_rounding := coalesce(p_item ->> 'roundingRule', 'as_is');
  v_billing := coalesce((p_item ->> 'billingReflectionEnabled')::boolean, true);
  v_pricing := coalesce(p_item -> 'pricingRule', '{}'::jsonb)
    || pg_catalog.jsonb_build_object(
      'priceKrw', v_price, 'salesUnit', v_sales_unit, 'taxIncluded', v_tax,
      'roundingRule', v_rounding, 'billingReflectionEnabled', v_billing
    );
  v_metadata := coalesce(p_item -> 'medicationMetadata', '{}'::jsonb);
  if pg_catalog.jsonb_typeof(v_metadata) <> 'object' then
    raise exception 'catalog_medication_metadata_object_required' using errcode = '22023';
  end if;
  if v_metadata ? 'defaultDetailInputs' then
    v_nested := v_metadata -> 'defaultDetailInputs';
    if pg_catalog.jsonb_typeof(v_nested) <> 'object'
       or pg_catalog.octet_length(v_nested::text) > 65536 then
      raise exception 'catalog_default_detail_inputs_invalid' using errcode = '22023';
    end if;
  end if;
  if v_generic_present and v_metadata ? 'defaultDetailInputs'
     and v_generic is distinct from v_nested then
    raise exception 'catalog_default_detail_inputs_mirror_conflict' using errcode = '22023';
  end if;
  if v_generic_present then
    if v_generic <> '{}'::jsonb then
      v_metadata := pg_catalog.jsonb_set(v_metadata, '{defaultDetailInputs}', v_generic, true);
    end if;
  elsif v_metadata ? 'defaultDetailInputs' then
    v_generic := v_nested;
    v_generic_present := true;
  else
    v_generic := '{}'::jsonb;
  end if;
  v_schema := private.clair_order_detail_field_schema_v1('dispensing');
  select coalesce(
    pg_catalog.jsonb_object_agg(
      field.value ->> 'key',
      case
        when v_generic ? (field.value ->> 'key')
          then 'workspace_resolved'
        when coalesce((field.value ->> 'required')::boolean, false)
          then 'required_manual'
        else 'not_applicable'
      end
    ),
    '{}'::jsonb
  )
  into v_policies
  from pg_catalog.jsonb_array_elements(v_schema -> 'fields') field(value);
  if not private.clair_order_execution_preset_contract_is_valid(
    'dispensing', 1, v_generic, v_policies
  ) then
    raise exception 'catalog_default_detail_inputs_invalid' using errcode = '22023';
  end if;
  perform private.clair_validate_workspace_dispensing_preset(
    v_metadata, v_price, v_pricing
  );
  if v_sales_unit not in (
      'per_order', 'per_each', 'per_day', 'per_frequency', 'per_ml', 'per_kg'
    ) then
    raise exception 'catalog_sales_unit_invalid' using errcode = '22023';
  end if;
  if v_rounding not in ('as_is', 'ceil', 'floor', 'round') then
    raise exception 'catalog_rounding_invalid' using errcode = '22023';
  end if;
  if p_item ? 'targetSpecies'
     and pg_catalog.jsonb_typeof(p_item -> 'targetSpecies') <> 'array' then
    raise exception 'catalog_species_array_required' using errcode = '22023';
  end if;
  v_species := coalesce(array(
    select value #>> '{}'
    from pg_catalog.jsonb_array_elements(coalesce(p_item -> 'targetSpecies', '["dog","cat"]'::jsonb))
  ), '{dog,cat}'::text[]);
  if exists (
    select 1 from pg_catalog.unnest(v_species) species_code
    where species_code not in ('dog', 'cat', 'other')
  ) then
    raise exception 'catalog_species_invalid' using errcode = '22023';
  end if;

  v_path_id := private.clinical_master_fallback_path_for_item_type('medication');
  select * into v_path from master.classification_paths
  where id = v_path_id and retired_in_release_id is null;
  if not found then raise exception 'clinical_master_classification_fallback_missing' using errcode = '23503'; end if;
  select * into v_action from master.clinical_actions where master_record_id = v_path.clinical_action_id;
  select * into v_chart from master.chart_groups where master_record_id = v_path.chart_group_id;
  select * into v_route from master.task_routes where master_record_id = v_path.task_route_id;
  select * into v_t_category from master.order_categories where master_record_id = v_action.t_category_id;
  select * into v_t_record from master.master_records where id = v_action.t_category_id;
  if v_route.runtime_status <> 'active' or v_route.destination_module <> 'dispensing' then
    raise exception 'clinical_master_dispensing_route_unavailable' using errcode = '23514';
  end if;
  select name_row.name into v_t_code_label
  from master.master_record_names name_row
  where name_row.master_record_id = v_t_record.id
    and name_row.language_code = 'ko' and name_row.name_kind = 'preferred'
  order by name_row.sort_order, name_row.id limit 1;
  v_source_key := 'workspace-custom-' || v_id;

  insert into public.order_catalog_items (
    id, workspace_id, standard_order_id, source_preset_version,
    initial_imported_preset_version, last_auto_merged_preset_version,
    customization_state, customized_fields, last_customized_at,
    last_customized_by_user_id, preset_merge_status, category_group,
    category_label, t_code, t_code_label, standard_order_name,
    in_hospital_order_name, billing_name, aliases, availability_status,
    price_krw, sales_unit, target_species, default_destination_module,
    default_task_required, billing_reflection_enabled, care_guide,
    care_guide_delivery_enabled, internal_instruction,
    internal_instruction_delivery_enabled, tax_included, rounding_rule,
    pricing_rule, medication_metadata, vaccine_metadata, origin_type,
    classification_path_id, catalog_revision,
    workspace_dispensing_review_status, workspace_dispensing_review_revision,
    workspace_dispensing_authored_by_user_id, workspace_dispensing_authored_at,
    default_detail_inputs, default_detail_input_policies
  ) values (
    v_id, p_workspace_id, v_source_key, coalesce(p_item ->> 'sourcePresetVersion', 'workspace-custom-v1'),
    null, null, 'detached', array['*'], pg_catalog.now(), auth.uid()::text,
    'detached', 'medication', v_chart.group_code, v_t_category.category_code,
    coalesce(v_t_code_label, v_t_category.category_code),
    coalesce(nullif(pg_catalog.btrim(p_item ->> 'standardOrderName'), ''), v_source_key),
    coalesce(nullif(pg_catalog.btrim(p_item ->> 'inHospitalOrderName'), ''), v_source_key),
    coalesce(nullif(pg_catalog.btrim(p_item ->> 'billingName'), ''), v_source_key),
    coalesce(array(select value #>> '{}' from pg_catalog.jsonb_array_elements(coalesce(p_item -> 'aliases', '[]'::jsonb))), array[]::text[]),
    'pending_activation', v_price, v_sales_unit, v_species, 'dispensing', true,
    v_billing, p_item ->> 'careGuide', false, p_item ->> 'internalInstruction', false,
    v_tax, v_rounding, v_pricing, v_metadata, '{}'::jsonb, 'workspace_custom',
    v_path_id, 1, 'pending', 1, auth.uid(), pg_catalog.now(), v_generic, v_policies
  ) returning * into v_item;

  perform private.clair_pr020_append_order_catalog_audit(
    p_workspace_id, 'order_catalog.created', v_item.id,
    null::public.order_catalog_items, v_item, 'create', array['*']::text[]
  );
  return pg_catalog.jsonb_build_object(
    'ok', true, 'status', 200, 'item', pg_catalog.to_jsonb(v_item),
    'databaseAuditWritten', true, 'enforcedBy', 'clair_create_workspace_dispensing_order'
  );
end;
$function$;

revoke all on function public.clair_create_workspace_dispensing_order(text, jsonb)
  from public, anon, service_role;
grant execute on function public.clair_create_workspace_dispensing_order(text, jsonb)
  to authenticated;

-- Include the new workspace-owned copy and the immutable source-preset lineage
-- in the existing atomic audit envelope.  Lineage is captured for evidence but
-- remains server-owned and is rejected by every client-facing writer.
create or replace function private.clair_pr020_order_catalog_audit_snapshot(
  p_item public.order_catalog_items
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if p_item is null then
    return '{}'::jsonb;
  end if;
  return pg_catalog.jsonb_build_object(
    'id', (p_item).id,
    'standardOrderId', (p_item).standard_order_id,
    'categoryGroup', (p_item).category_group,
    'categoryLabel', (p_item).category_label,
    'standardOrderName', (p_item).standard_order_name,
    'inHospitalOrderName', (p_item).in_hospital_order_name,
    'billingName', (p_item).billing_name,
    'availabilityStatus', (p_item).availability_status,
    'priceKrw', (p_item).price_krw,
    'salesUnit', (p_item).sales_unit,
    'defaultDestinationModule', (p_item).default_destination_module,
    'defaultTaskRequired', (p_item).default_task_required,
    'billingReflectionEnabled', (p_item).billing_reflection_enabled,
    'defaultDetailInputs', (p_item).default_detail_inputs,
    'defaultDetailInputPolicies', (p_item).default_detail_input_policies,
    'executionPresetLineage', case
      when (p_item).source_execution_preset_id is null then null
      else pg_catalog.jsonb_build_object(
        'sourceExecutionPresetId', (p_item).source_execution_preset_id,
        'sourceExecutionPresetRevision', (p_item).source_execution_preset_revision,
        'sourceExecutionPresetSha256', (p_item).source_execution_preset_sha256,
        'presetStatus', (
          select preset.preset_status
          from master.order_execution_presets preset
          where preset.id = (p_item).source_execution_preset_id
            and preset.preset_revision = (p_item).source_execution_preset_revision
        ),
        'clinicalUseAllowed', (
          select preset.clinical_use_allowed
          from master.order_execution_presets preset
          where preset.id = (p_item).source_execution_preset_id
            and preset.preset_revision = (p_item).source_execution_preset_revision
        )
      )
    end,
    'workspaceDispensingReview', pg_catalog.jsonb_build_object(
      'status', (p_item).workspace_dispensing_review_status,
      'revision', (p_item).workspace_dispensing_review_revision,
      'authoredByUserId', (p_item).workspace_dispensing_authored_by_user_id,
      'authoredAt', (p_item).workspace_dispensing_authored_at,
      'reviewedByUserId', (p_item).workspace_dispensing_reviewed_by_user_id,
      'reviewedAt', (p_item).workspace_dispensing_reviewed_at
    ),
    'pricingRule', pg_catalog.jsonb_build_object(
      'priceBasis', (p_item).pricing_rule ->> 'priceBasis',
      'priceKrw', (p_item).price_krw,
      'salesUnit', (p_item).sales_unit,
      'taxIncluded', (p_item).tax_included,
      'billingReflectionEnabled', (p_item).billing_reflection_enabled
    ),
    'updatedAt', (p_item).updated_at
  );
end;
$function$;

revoke all on function private.clair_pr020_order_catalog_audit_snapshot(
  public.order_catalog_items
) from public, anon, authenticated, service_role;

-- Retain the shared lock wrapper but keep it private to the public dispatcher.
-- In particular, do not restore the historical authenticated grant on this
-- implementation detail.
create or replace function public.clair_update_order_catalog_item_a2_base(
  p_workspace_id text,
  p_item_id text,
  p_expected_catalog_revision integer,
  p_patch jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if not private.clair_is_active_workspace_member(p_workspace_id)
     or not private.clair_current_user_has_workspace_permission(
       p_workspace_id, 'service_catalog:manage'
     ) then
    raise exception 'workspace_admin_required' using errcode = '42501';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'clinical_master_workspace_adoption:' || p_workspace_id,
      0
    )
  );
  return public.clair_update_order_catalog_item_a2_unlocked(
    p_workspace_id, p_item_id, p_expected_catalog_revision, p_patch
  );
end;
$function$;

revoke all on function public.clair_update_order_catalog_item_a2_base(
  text, text, integer, jsonb
) from public, anon, authenticated, service_role;
