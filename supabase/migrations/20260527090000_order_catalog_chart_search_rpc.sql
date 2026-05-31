-- DEN-299: live chart confirmation must resolve workspace catalog snapshots
-- through a workspace-scoped RPC instead of falling back to mock catalog data.
-- Remote Supabase application is approval-gated; this file is repo-local only.

create or replace function public.clair_list_order_catalog_chart_search(
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
  applied_snapshot jsonb
)
language sql
security invoker
set search_path = public
as $$
  select
    'individual'::text as row_type,
    item.standard_order_id as source_preset_id,
    item.source_preset_version,
    item.in_hospital_order_name as display_name,
    item.billing_name,
    item.category_group,
    item.target_species,
    jsonb_build_object(
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
      'appliedTargetSpecies', to_jsonb(item.target_species),
      'appliedCareGuide', item.care_guide,
      'appliedInternalInstruction', item.internal_instruction,
      'appliedDestinationModule', item.default_destination_module,
      'appliedTaskRequired', item.default_task_required,
      'billingReflectionEnabled', item.billing_reflection_enabled
    ) as applied_snapshot
  from public.order_catalog_items item
  where item.workspace_id = p_workspace_id
    and item.availability_status = 'active'

  union all

  select
    'set'::text as row_type,
    order_set.id as source_preset_id,
    order_set.source_set_version as source_preset_version,
    order_set.set_name as display_name,
    order_set.billing_name,
    'set'::text as category_group,
    order_set.target_species,
    jsonb_build_object(
      'sourcePresetId', order_set.id,
      'sourcePresetVersion', order_set.source_set_version,
      'appliedStandardOrderName', order_set.set_name,
      'appliedDisplayName', order_set.set_name,
      'appliedBillingName', order_set.billing_name,
      'appliedPriceKrw', order_set.set_price_krw,
      'appliedSalesUnit', order_set.sales_unit,
      'appliedTaxIncluded', true,
      'appliedAmountBasis', order_set.amount_basis,
      'appliedTargetSpecies', to_jsonb(order_set.target_species),
      'appliedCareGuide', order_set.care_guide,
      'appliedInternalInstruction', order_set.internal_instruction,
      'appliedDestinationModule', 'chart_only',
      'appliedTaskRequired', false,
      'billingReflectionEnabled', order_set.billing_reflection_enabled
    ) as applied_snapshot
  from public.order_sets order_set
  where order_set.workspace_id = p_workspace_id
    and order_set.availability_status = 'active';
$$;

grant execute on function public.clair_list_order_catalog_chart_search(text)
  to authenticated;

comment on function public.clair_list_order_catalog_chart_search(text) is
  'DEN-299 workspace-scoped chart catalog search RPC used by live chart confirmation snapshot resolution.';
