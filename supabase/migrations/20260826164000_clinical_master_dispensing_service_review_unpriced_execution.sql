-- Service-review rows intentionally have no customer billing price yet.
-- Keep them non-billable while allowing the synthetic operational workflow.

set lock_timeout = '5s';
set statement_timeout = '120s';

create or replace function private.clair_build_catalog_order_snapshot(
  p_workspace_id text,
  p_catalog_item_id text,
  p_quantity numeric
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, private, master, extensions, pg_temp
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
  v_service_review_allowed boolean := false;
begin
  if p_quantity is null
     or p_quantity <= 0
     or p_quantity > 9999
     or p_quantity::text = 'NaN' then
    raise exception 'invalid_order_quantity';
  end if;

  select *
    into c
  from public.order_catalog_items
  where workspace_id = p_workspace_id
    and id = p_catalog_item_id;

  if not found then
    raise exception 'catalog_item_unavailable';
  end if;

  v_service_review_allowed :=
    private.clair_dispensing_service_review_catalog_item_allowed(
      p_workspace_id,
      c.id
    );

  if c.availability_status <> 'active'
    and not v_service_review_allowed
  then
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

  v_billing_category := private.clair_map_catalog_category_to_billing_category(c.category_group);
  if v_billing_category is null then
    raise exception 'unsupported_category_group';
  end if;
  if c.billing_reflection_enabled
    and c.price_krw is null
    and not v_service_review_allowed
  then
    raise exception 'billable_price_required';
  end if;

  v_order_type := case c.category_group
    when 'lab' then 'lab'
    when 'imaging' then 'imaging'
    when 'medication' then 'dispensing'
    else 'treatment'
  end;
  v_raw_line_total := p_quantity * coalesce(c.price_krw, 0);
  v_rounding_result := private.clair_round_catalog_order_amount(
    v_raw_line_total,
    c.rounding_rule
  );
  if c.price_krw is null then
    v_rounding_result := null;
  end if;
  v_line_total := coalesce(v_rounding_result, v_raw_line_total);

  return jsonb_build_object(
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
    'taxIncluded', c.tax_included,
    'roundingRule', c.rounding_rule,
    'targetSpecies', to_jsonb(c.target_species),
    'destinationModule', c.default_destination_module,
    'taskRequired', c.default_task_required,
    'billingReflectionEnabled', case
      when v_service_review_allowed then false
      else c.billing_reflection_enabled
    end,
    'careGuide', c.care_guide,
    'careGuideDeliveryEnabled', c.care_guide_delivery_enabled,
    'internalInstruction', c.internal_instruction,
    'internalInstructionDeliveryEnabled', c.internal_instruction_delivery_enabled,
    'amountBasis', c.sales_unit,
    'rowType', 'individual',
    'priceRuleSource', 'catalog_price',
    'snapshotSource', 'order_catalog_items'
  );
end;
$function$;

revoke all on function private.clair_build_catalog_order_snapshot(text, text, numeric)
  from public, anon, authenticated, service_role;
