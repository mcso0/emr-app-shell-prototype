-- Forward fix: the chart-search RPC needs definer access to the private/master
-- review evidence while still enforcing the caller's workspace permission.

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
set search_path = 'pg_catalog'
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
        'billingReflectionEnabled', item.billing_reflection_enabled
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
        'billingEligible', false
      )
      else pg_catalog.jsonb_build_object(
        'clinicalOrderType', catalog.clinical_order_type,
        'destinationModule', catalog.destination_module,
        'executionMode', catalog.execution_mode,
        'detailSchemaVersion', catalog.detail_schema_version,
        'billingEligible', catalog.billing_eligible
      ) || case
        when catalog.source_dispensing_profile_id is null then '{}'::jsonb
        else pg_catalog.jsonb_build_object(
          'dispensingLineage', pg_catalog.jsonb_build_object(
            'schemaVersion', 1,
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
