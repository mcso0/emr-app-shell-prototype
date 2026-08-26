-- Assign varied synthetic workspace prices to the exact 108 PR-017
-- dispensing rows in Cheongdam and expose their effective service-review
-- state without changing clinical approval or canonical availability.

set lock_timeout = '5s';
set statement_timeout = '120s';

insert into private.clinical_master_dispensing_service_review_events (
  workspace_id,
  release_id,
  action,
  review_mode,
  actor_user_id,
  approval_reference,
  reason
)
values (
  'workspace-clair-cheongdam',
  '78a57bf0-10a8-47db-9ae1-8a8cff79b2c4'::uuid,
  'enabled',
  'service_operations_review',
  '00000000-0000-4000-8000-000000000001'::uuid,
  'codex-thread-service-review-pricing-2026-08-26',
  'Owner approved varied synthetic workspace pricing and effective use for Cheongdam service review; not clinical or regulatory approval.'
)
on conflict (workspace_id, release_id, action, approval_reference) do nothing;

do $block$
declare
  v_target_count integer;
  v_updated_count integer;
  v_minimum integer;
  v_median numeric;
  v_maximum integer;
  v_unique_count integer;
begin
  select pg_catalog.count(*)
    into v_target_count
  from public.order_catalog_items item
  join master.dispensing_order_profiles profile
    on profile.id = item.source_dispensing_profile_id
   and profile.profile_revision = item.source_dispensing_profile_revision
  where item.workspace_id = 'workspace-clair-cheongdam'
    and profile.source_release_id = '78a57bf0-10a8-47db-9ae1-8a8cff79b2c4'::uuid
    and item.availability_status = 'pending_activation'
    and item.clinical_use_allowed = false;

  if v_target_count <> 108 then
    raise exception 'dispensing_service_review_price_target_count:%', v_target_count;
  end if;

  with ingredient_counts as (
    select
      ingredient.product_id,
      ingredient.product_revision,
      pg_catalog.count(*)::integer as ingredient_count
    from master.medication_product_ingredients ingredient
    where ingredient.source_release_id = '78a57bf0-10a8-47db-9ae1-8a8cff79b2c4'::uuid
    group by ingredient.product_id, ingredient.product_revision
  ),
  product_prices as (
    select
      profile.id as profile_id,
      profile.profile_revision,
      greatest(
        3000,
        least(
          32000,
          (
            pg_catalog.round((
              case product.coverage_category
                when 'anti_inflammatory_other' then 9500
                when 'antimicrobial_antifungal' then 9500
                when 'antiparasitic' then 8500
                when 'cardiovascular' then 11500
                when 'dermatology_topical' then 16000
                when 'emergency_supportive' then 10000
                when 'endocrine' then 13500
                when 'gastrointestinal' then 8500
                when 'immunomodulator' then 24000
                when 'neurology_behavior' then 13500
                when 'ophthalmic_otic' then 14500
                when 'other' then 12000
                when 'pain_nsaid' then 10000
                when 'respiratory' then 7500
                when 'urinary' then 11000
                else null
              end
              + case product.dosage_form
                when 'Capsule, hard' then 500
                when 'Capsule, soft' then 2000
                when 'Chewable tablet' then 1500
                when 'Coated tablet' then 500
                when 'Cutaneous spray, solution' then 2500
                when 'Ear drops, solution' then 4500
                when 'Ear gel' then 4500
                when 'Eye drops, solution' then 3000
                when 'Eye drops, suspension' then 3500
                when 'Eye ointment' then 3000
                when 'Film-coated tablet' then 1000
                when 'Laryngopharyngeal Spray, Solution' then 5000
                when 'Modified-release tablet' then 2500
                when 'Ointment' then 2000
                when 'Oral drops, suspension' then 4000
                when 'Oral gel' then 1500
                when 'Oral powder' then 1000
                when 'Oral solution' then 3500
                when 'Oral suspension' then 4000
                when 'Powder for oral suspension' then 3000
                when 'Prolonged-release tablet' then 2500
                when 'Shampoo' then 2500
                when 'Spot-on solution' then 3500
                when 'Syrup' then 2500
                when 'Tablet' then 0
                when 'Transdermal Solution' then 5000
                else null
              end
              + greatest(0, ingredient_count.ingredient_count - 1) * 1500
              + (array[-1500, -1000, -500, 0, 500, 1000, 1500])[
                  pg_catalog.mod(
                    pg_catalog.get_byte(
                      extensions.digest(
                        pg_catalog.convert_to(product.source_product_id, 'UTF8'),
                        'sha256'
                      ),
                      0
                    ),
                    7
                  ) + 1
                ]
            ) / 500.0) * 500
          )::integer
        )
      ) as price_krw
    from master.dispensing_order_profiles profile
    join master.medication_products product
      on product.id = profile.product_id
     and product.revision = profile.product_revision
    join ingredient_counts ingredient_count
      on ingredient_count.product_id = product.id
     and ingredient_count.product_revision = product.revision
    where profile.source_release_id = '78a57bf0-10a8-47db-9ae1-8a8cff79b2c4'::uuid
      and product.source_release_id = profile.source_release_id
  )
  update public.order_catalog_items item
  set
    price_krw = price.price_krw,
    pricing_rule = pg_catalog.jsonb_set(
      item.pricing_rule,
      '{priceKrw}',
      pg_catalog.to_jsonb(price.price_krw),
      true
    ),
    catalog_revision = item.catalog_revision + 1,
    customization_state = case
      when item.customization_state = 'detached' then 'detached'
      else 'customized'
    end,
    customized_fields = (
      select coalesce(
        pg_catalog.array_agg(distinct field_name order by field_name),
        '{}'::text[]
      )
      from pg_catalog.unnest(
        coalesce(item.customized_fields, '{}'::text[]) || array['priceKrw']
      ) as fields(field_name)
    ),
    last_customized_at = pg_catalog.now(),
    last_customized_by_user_id = '00000000-0000-4000-8000-000000000001',
    updated_at = pg_catalog.now()
  from product_prices price
  where item.workspace_id = 'workspace-clair-cheongdam'
    and item.source_dispensing_profile_id = price.profile_id
    and item.source_dispensing_profile_revision = price.profile_revision
    and item.availability_status = 'pending_activation'
    and item.clinical_use_allowed = false;

  get diagnostics v_updated_count = row_count;
  if v_updated_count <> 108 then
    raise exception 'dispensing_service_review_price_update_count:%', v_updated_count;
  end if;

  select
    pg_catalog.min(item.price_krw),
    pg_catalog.percentile_cont(0.5) within group (order by item.price_krw),
    pg_catalog.max(item.price_krw),
    pg_catalog.count(distinct item.price_krw)
    into v_minimum, v_median, v_maximum, v_unique_count
  from public.order_catalog_items item
  join master.dispensing_order_profiles profile
    on profile.id = item.source_dispensing_profile_id
   and profile.profile_revision = item.source_dispensing_profile_revision
  where item.workspace_id = 'workspace-clair-cheongdam'
    and profile.source_release_id = '78a57bf0-10a8-47db-9ae1-8a8cff79b2c4'::uuid;

  if v_minimum <> 7000
     or v_median <> 12500
     or v_maximum <> 28500
     or v_unique_count <> 30 then
    raise exception 'dispensing_service_review_price_summary_mismatch:%/%/%/%',
      v_minimum, v_median, v_maximum, v_unique_count;
  end if;
end;
$block$;

create or replace function public.clair_list_order_catalog_admin_v2(
  p_workspace_id text
)
returns setof jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select
    pg_catalog.to_jsonb(item)
    || pg_catalog.jsonb_build_object(
      'service_review_only', (
        item.source_dispensing_profile_id is not null
        and item.clinical_use_allowed = false
        and private.clair_dispensing_service_review_allowed(
          p_workspace_id,
          profile.source_release_id
        )
      ),
      'service_review_release_id', case
        when item.source_dispensing_profile_id is not null
          and item.clinical_use_allowed = false
          and private.clair_dispensing_service_review_allowed(
            p_workspace_id,
            profile.source_release_id
          )
        then profile.source_release_id
        else null
      end
    )
  from public.order_catalog_items item
  left join master.dispensing_order_profiles profile
    on profile.id = item.source_dispensing_profile_id
   and profile.profile_revision = item.source_dispensing_profile_revision
  where item.workspace_id = p_workspace_id
    and private.clair_current_user_has_workspace_permission(
      p_workspace_id,
      'service_catalog:view'
    )
  order by item.category_group, item.standard_order_name, item.id;
$function$;

revoke all on function public.clair_list_order_catalog_admin_v2(text)
  from public, anon, service_role;
grant execute on function public.clair_list_order_catalog_admin_v2(text)
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

  v_billing_category :=
    private.clair_map_catalog_category_to_billing_category(c.category_group);
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
    'amountBasis', c.sales_unit,
    'rowType', 'individual',
    'priceRuleSource', case
      when v_service_review_allowed then 'workspace_service_review_price'
      else 'catalog_price'
    end,
    'snapshotSource', 'order_catalog_items'
  );
end;
$function$;

revoke all on function private.clair_build_catalog_order_snapshot(text, text, numeric)
  from public, anon, authenticated, service_role;

comment on function public.clair_list_order_catalog_admin_v2(text) is
  'Permission-checked admin catalog read with release-pinned service-review eligibility; it does not change clinical approval.';
comment on function private.clair_build_catalog_order_snapshot(text, text, numeric) is
  'Server-owned catalog snapshot; priced synthetic service-review rows may reflect into billing without becoming clinically active.';
