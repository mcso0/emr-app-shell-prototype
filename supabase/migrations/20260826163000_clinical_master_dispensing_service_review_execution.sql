-- Let the explicitly authorized synthetic service-review catalog flow through
-- Draft persistence and atomic confirmation without making it clinically active.

set lock_timeout = '5s';
set statement_timeout = '120s';

create or replace function private.clair_dispensing_service_review_catalog_item_allowed(
  p_workspace_id text,
  p_catalog_item_id text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.order_catalog_items item
    join master.dispensing_order_profiles profile
      on profile.id = item.source_dispensing_profile_id
     and profile.profile_revision = item.source_dispensing_profile_revision
    where item.workspace_id = p_workspace_id
      and item.id = p_catalog_item_id
      and item.availability_status = 'pending_activation'
      and item.clinical_use_allowed = false
      and private.clair_dispensing_service_review_allowed(
        p_workspace_id,
        profile.source_release_id
      )
  );
$function$;

revoke all on function private.clair_dispensing_service_review_catalog_item_allowed(text, text)
  from public, anon, authenticated, service_role;

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

  if c.availability_status <> 'active'
    and not private.clair_dispensing_service_review_catalog_item_allowed(
      p_workspace_id,
      c.id
    )
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
  if c.billing_reflection_enabled and c.price_krw is null then
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
    'billingReflectionEnabled', c.billing_reflection_enabled,
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

-- The atomic confirmation function is intentionally owned by the execution
-- contract migration. Patch only its single catalog-active predicate and fail
-- closed if that owning definition ever changes unexpectedly.
do $block$
declare
  v_function regprocedure := to_regprocedure(
    'public.clair_confirm_chart_order_candidates(text,uuid,uuid,uuid[],text,text)'
  );
  v_definition text;
  v_needle text := $needle$        or catalog.availability_status <> 'active'$needle$;
  v_replacement text := $replacement$        or (
          catalog.availability_status <> 'active'
          and not private.clair_dispensing_service_review_catalog_item_allowed(
            atomic.workspace_id,
            catalog.id
          )
        )$replacement$;
  v_needle_count integer;
begin
  if v_function is null then
    raise exception 'clair_confirm_chart_order_candidates_missing';
  end if;

  select pg_get_functiondef(v_function) into v_definition;

  if position(
    'private.clair_dispensing_service_review_catalog_item_allowed' in v_definition
  ) > 0 then
    return;
  end if;

  v_needle_count := (
    length(v_definition) - length(replace(v_definition, v_needle, ''))
  ) / length(v_needle);

  if v_needle_count <> 1 then
    raise exception 'clair_confirm_chart_order_candidates_definition_unexpected';
  end if;

  execute replace(v_definition, v_needle, v_replacement);
end;
$block$;

revoke all on function public.clair_confirm_chart_order_candidates(
  text, uuid, uuid, uuid[], text, text
) from public, anon, service_role;
grant execute on function public.clair_confirm_chart_order_candidates(
  text, uuid, uuid, uuid[], text, text
) to authenticated;

comment on function private.clair_dispensing_service_review_catalog_item_allowed(text, text) is
  'Fail-closed execution gate for the explicitly authorized synthetic dispensing service-review catalog only.';
