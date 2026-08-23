-- Clinical master sales-unit adopter hotfix.
--
-- This is intentionally additive: the B1 adoption wrapper, publisher, Airtable
-- contract, tables, constraints, and B1 result wrapper remain unchanged.  The
-- helper is the single normalization boundary for source unit codes while the
-- three affected functions retain their existing security and CAS semantics.

create or replace function private.clinical_master_normalize_sales_unit(
  p_code text,
  p_fallback text default 'per_each'
)
returns text
language sql
immutable
security definer
set search_path = pg_catalog
as $$
  select case upper(nullif(btrim(p_code), ''))
    when 'EA' then 'per_each'
    when 'PER_EACH' then 'per_each'
    when 'CASE' then 'per_order'
    when 'PER_ORDER' then 'per_order'
    when 'DAY' then 'per_day'
    when 'PER_DAY' then 'per_day'
    when 'ML' then 'per_ml'
    when 'PER_ML' then 'per_ml'
    when 'KG' then 'per_kg'
    when 'PER_KG' then 'per_kg'
    when 'PER_FREQUENCY' then 'per_frequency'
    else case lower(nullif(btrim(p_fallback), ''))
      when 'per_each' then 'per_each'
      when 'per_order' then 'per_order'
      when 'per_day' then 'per_day'
      when 'per_frequency' then 'per_frequency'
      when 'per_ml' then 'per_ml'
      when 'per_kg' then 'per_kg'
      else 'per_each'
    end
  end;
$$;

revoke all on function private.clinical_master_normalize_sales_unit(text, text)
  from public, anon, authenticated, service_role;

create or replace function private.clinical_master_catalog_source_matches_snapshot(
  p_item public.order_catalog_items,
  p_snapshot jsonb
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, private, master, pg_temp
as $$
declare
  v_classification jsonb := coalesce(p_snapshot -> 'classification', '{}'::jsonb);
  v_order jsonb := coalesce(p_snapshot -> 'order', '{}'::jsonb);
  v_expected_species text[];
  v_actual_species text[];
  v_expected_aliases text[];
  v_actual_aliases text[];
  v_path_key text;
begin
  if p_snapshot is null or jsonb_typeof(p_snapshot) <> 'object' then
    return false;
  end if;
  select coalesce(array_agg(value ->> 'name' order by ordinality), '{}')
    into v_expected_aliases
  from jsonb_array_elements(coalesce(p_snapshot -> 'names', '[]'::jsonb)) with ordinality
  where value ->> 'nameKind' = 'alias';
  v_actual_aliases := coalesce(p_item.aliases, '{}');
  select coalesce(array_agg(value #>> '{}' order by value #>> '{}'), '{}')
    into v_expected_species
  from jsonb_array_elements(coalesce(v_order -> 'species', '[]'::jsonb));
  select coalesce(array_agg(species_code order by species_code), '{}')
    into v_actual_species
  from unnest(coalesce(p_item.target_species, '{}')) as species_code;
  select path_key into v_path_key
  from master.classification_paths
  where id = p_item.classification_path_id;

  return p_item.standard_order_id = coalesce(p_snapshot ->> 'masterKey', '')
    and p_item.category_group = coalesce(v_classification ->> 'itemType', '')
    and p_item.standard_order_name = coalesce((
      select value ->> 'name'
      from jsonb_array_elements(coalesce(p_snapshot -> 'names', '[]'::jsonb))
      where value ->> 'languageCode' = 'ko'
        and value ->> 'nameKind' = 'preferred'
      order by (value ->> 'sortOrder')::integer, value ->> 'name'
      limit 1
    ), '')
    and p_item.sales_unit = private.clinical_master_normalize_sales_unit(
      v_order ->> 'defaultSalesUnitCode', p_item.sales_unit
    )
    and p_item.default_destination_module = case v_classification ->> 'destinationModule'
      when 'inpatient' then 'billing_only'
      else coalesce(v_classification ->> 'destinationModule', p_item.default_destination_module)
    end
    and p_item.default_task_required = coalesce((v_classification ->> 'taskRequired')::boolean, p_item.default_task_required)
    and p_item.billing_reflection_enabled = coalesce((v_order ->> 'defaultBillingReflectionEnabled')::boolean, p_item.billing_reflection_enabled)
    and v_path_key = v_classification ->> 'pathKey'
    and v_expected_aliases = v_actual_aliases
    and v_expected_species = v_actual_species;
end;
$$;

revoke all on function private.clinical_master_catalog_source_matches_snapshot(public.order_catalog_items, jsonb)
  from public, anon, authenticated, service_role;

create or replace function private.clair_adopt_master_release_to_workspace_a2_base(
  p_workspace_id text,
  p_release_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, master, extensions, pg_temp
as $$
declare
  v_release master.master_releases%rowtype;
  v_source record;
  v_item public.order_catalog_items%rowtype;
  v_path master.classification_paths%rowtype;
  v_action master.clinical_actions%rowtype;
  v_chart master.chart_groups%rowtype;
  v_route master.task_routes%rowtype;
  v_projection jsonb;
  v_fingerprint text;
  v_normalized_sales_unit text;
  v_existing_update public.workspace_master_updates%rowtype;
  v_update_id uuid;
  v_standard_name text;
  v_aliases text[];
  v_species text[];
  v_source_revision integer;
  v_unmodified boolean;
  v_requires_review boolean;
  v_item_found boolean;
  v_created integer := 0;
  v_auto_applied integer := 0;
  v_reviews integer := 0;
  v_notifications integer := 0;
  v_update_type text;
  v_status text;
  v_merge_status text;
begin
  if p_workspace_id is null or length(pg_catalog.btrim(p_workspace_id)) = 0 then
    raise exception 'workspace_id_required' using errcode = '22023';
  end if;

  -- This order is part of the concurrency contract.  Do not move the
  -- workspace lock before the A1 publication lock.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('clinical_master_phase_1a1_publication', 0)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('clinical_master_workspace_adoption:' || p_workspace_id, 0)
  );

  select * into v_release
  from master.master_releases
  where id = p_release_id
  for update;
  if not found or v_release.status <> 'published' then
    raise exception 'clinical_master_release_not_published' using errcode = '22023';
  end if;
  if exists (
    select 1 from master.master_releases newer
    where newer.status = 'published' and newer.release_no > v_release.release_no
  ) then
    raise exception 'clinical_master_release_not_latest' using errcode = '40001';
  end if;

  -- Lock every existing row before source upserts, in stable row-ID order.
  perform 1
  from public.order_catalog_items item
  where item.workspace_id = p_workspace_id
  order by item.id
  for update;

  for v_source in
    select record_row.*, order_row.classification_path_id as source_path_id,
      order_row.default_sales_unit_id, order_row.default_billing_reflection_enabled,
      order_row.default_quantity, unit.unit_code as default_sales_unit_code
    from master.master_records record_row
    join master.orders order_row on order_row.master_record_id = record_row.id
    left join master.units unit on unit.master_record_id = order_row.default_sales_unit_id
    where record_row.record_type = 'order'
      and record_row.safety_status = 'normal'
      and record_row.lifecycle_status in ('published', 'deprecation_pending', 'deprecated')
    order by record_row.master_key
    for update of record_row, order_row
  loop
    select * into v_path
    from master.classification_paths
    where id = v_source.source_path_id
    for update;
    select * into v_action from master.clinical_actions where master_record_id = v_path.clinical_action_id;
    select * into v_chart from master.chart_groups where master_record_id = v_path.chart_group_id;
    select * into v_route from master.task_routes where master_record_id = v_path.task_route_id;
    v_projection := private.clinical_master_order_source_projection(v_source.id);
    v_source_revision := v_source.current_revision;
    select coalesce((
      select name_row.name from master.master_record_names name_row
      where name_row.master_record_id = v_source.id
        and name_row.language_code = 'ko' and name_row.name_kind = 'preferred'
      order by name_row.sort_order, name_row.id limit 1
    ), v_source.master_key) into v_standard_name;
    select coalesce(array_agg(name_row.name order by name_row.language_code, name_row.name_kind, name_row.sort_order, name_row.id), '{}')
      into v_aliases
    from master.master_record_names name_row
    where name_row.master_record_id = v_source.id and name_row.name_kind = 'alias';
    select coalesce(array_agg(species.species_code order by species.species_code), '{dog,cat}')
      into v_species
    from master.order_species_links link
    join master.species species on species.master_record_id = link.species_record_id
    where link.order_record_id = v_source.id;

    select * into v_item
    from public.order_catalog_items item
    where item.workspace_id = p_workspace_id
      and item.source_master_record_id = v_source.id
    for update;
    v_item_found := found;
    v_normalized_sales_unit := private.clinical_master_normalize_sales_unit(
      v_source.default_sales_unit_code,
      case when v_item_found then v_item.sales_unit else 'per_each' end
    );
    v_fingerprint := private.clinical_master_projection_fingerprint(v_projection);

    if not v_item_found then
      v_update_type := case
        when v_source.replacement_record_id is not null then 'replacement'
        when v_source.lifecycle_status in ('deprecated', 'deprecation_pending') then 'deprecated'
        else 'new'
      end;
      v_status := 'pending';
      v_merge_status := case
        when v_source.lifecycle_status in ('deprecated', 'deprecation_pending') then 'deprecated_source'
        else 'current'
      end;
      insert into public.order_catalog_items (
        id, workspace_id, standard_order_id, source_preset_version,
        initial_imported_preset_version, last_auto_merged_preset_version,
        customization_state, customized_fields, preset_merge_status,
        category_group, category_label, standard_order_name,
        in_hospital_order_name, billing_name, aliases, availability_status,
        price_krw, sales_unit, target_species, default_destination_module,
        default_task_required, billing_reflection_enabled, care_guide_delivery_enabled,
        internal_instruction_delivery_enabled, tax_included, rounding_rule,
        pricing_rule, medication_metadata, vaccine_metadata, origin_type,
        source_master_record_id, source_master_revision, initial_imported_revision,
        last_auto_merged_revision, classification_path_id, catalog_revision,
        source_projection_snapshot, source_projection_fingerprint
      ) values (
        'master-' || p_workspace_id || '-' || v_source.master_key, p_workspace_id, v_source.master_key,
        'master-r' || v_source_revision, v_source_revision, v_source_revision,
        'unmodified', '{}', v_merge_status, v_action.item_type,
        coalesce(v_chart.group_code, v_action.item_type), v_standard_name,
        v_standard_name, v_standard_name, v_aliases, 'pending_activation', null,
        v_normalized_sales_unit, v_species,
        case v_route.destination_module when 'inpatient' then 'billing_only' else v_route.destination_module end,
        v_route.task_required, v_source.default_billing_reflection_enabled,
        false, false, true, 'as_is',
        jsonb_build_object('priceBasis', 'fixed_order_price', 'priceKrw', null,
          'salesUnit', v_normalized_sales_unit,
          'taxIncluded', true, 'roundingRule', 'as_is',
          'billingReflectionEnabled', v_source.default_billing_reflection_enabled),
        '{}'::jsonb, '{}'::jsonb, 'clair_master', v_source.id, v_source_revision,
        v_source_revision, v_source_revision, v_path.id, 1, v_projection, v_fingerprint
      )
      returning * into v_item;
      v_created := v_created + 1;
    else
      if v_item.origin_type <> 'clair_master' then
        continue;
      end if;
      v_existing_update := null;
      select * into v_existing_update
      from public.workspace_master_updates update_row
      where update_row.workspace_id = p_workspace_id
        and update_row.source_master_record_id = v_source.id
        and update_row.status in ('pending', 'dismissed')
        and update_row.source_snapshot = v_projection
        and private.clinical_master_projection_fingerprint(update_row.source_snapshot) = v_fingerprint
      order by update_row.created_at desc, update_row.id desc
      limit 1;
      if (
        v_item.source_projection_fingerprint = v_fingerprint
        and (
          v_item.source_master_revision = v_source_revision
          or v_item.source_projection_snapshot = v_projection
        )
      ) or v_existing_update.id is not null then
        continue;
      end if;
      v_requires_review := v_source.lifecycle_status <> 'published'
        or v_source.replacement_record_id is not null;
      v_unmodified := private.clinical_master_catalog_source_matches_snapshot(
        v_item, v_item.source_projection_snapshot
      ) and not v_requires_review
        and v_item.source_projection_fingerprint = private.clinical_master_projection_fingerprint(v_item.source_projection_snapshot)
        and v_item.customization_state = 'unmodified'
        and coalesce(cardinality(v_item.customized_fields), 0) = 0;
      if v_unmodified then
        if v_item.source_master_revision = v_source_revision
          and v_item.source_projection_fingerprint = v_fingerprint then
          continue;
        end if;
        update public.order_catalog_items
        set source_preset_version = 'master-r' || v_source_revision,
            last_auto_merged_preset_version = 'master-r' || v_source_revision,
            standard_order_id = v_source.master_key,
            standard_order_name = v_standard_name,
            category_group = v_action.item_type,
            category_label = coalesce(v_chart.group_code, v_action.item_type),
            aliases = v_aliases,
            sales_unit = v_normalized_sales_unit,
            pricing_rule = jsonb_set(
              coalesce(pricing_rule, '{}'::jsonb), '{salesUnit}',
              to_jsonb(v_normalized_sales_unit), true
            ),
            target_species = v_species,
            default_destination_module = case v_route.destination_module when 'inpatient' then 'billing_only' else v_route.destination_module end,
            default_task_required = v_route.task_required,
            billing_reflection_enabled = v_source.default_billing_reflection_enabled,
            classification_path_id = v_path.id,
            source_master_revision = v_source_revision,
            last_auto_merged_revision = v_source_revision,
            source_projection_snapshot = v_projection,
            source_projection_fingerprint = v_fingerprint,
            catalog_revision = catalog_revision + 1,
            preset_merge_status = 'current',
            updated_at = now()
        where workspace_id = p_workspace_id and id = v_item.id;
        v_auto_applied := v_auto_applied + 1;
        v_update_type := 'changed';
        v_status := 'auto_applied';
        v_merge_status := 'current';
      else
        v_update_type := case when v_source.replacement_record_id is not null then 'replacement'
          when v_source.lifecycle_status = 'deprecated' then 'deprecated' else 'changed' end;
        v_status := 'pending';
        v_merge_status := case when v_source.lifecycle_status = 'deprecated' then 'deprecated_source'
          else 'update_available' end;
        update public.order_catalog_items
        set preset_merge_status = v_merge_status, updated_at = now()
        where workspace_id = p_workspace_id and id = v_item.id;
      end if;
    end if;

    if v_status = 'auto_applied' then
      insert into public.workspace_master_updates (
        workspace_id, release_id, source_master_record_id, order_catalog_item_id,
        update_type, status, previous_source_revision, source_revision,
        changed_fields, source_snapshot, workspace_snapshot
      ) values (
        p_workspace_id, v_release.id, v_source.id, v_item.id, v_update_type,
        v_status, v_item.source_master_revision, v_source_revision,
        array['source_projection'], v_projection, null
      ) on conflict (workspace_id, release_id, source_master_record_id, update_type)
        do nothing;
    else
      insert into public.workspace_master_updates (
        workspace_id, release_id, source_master_record_id, order_catalog_item_id,
        update_type, status, previous_source_revision, source_revision,
        changed_fields, source_snapshot, workspace_snapshot
      ) values (
        p_workspace_id, v_release.id, v_source.id, v_item.id, v_update_type,
        v_status, case when v_item_found then v_item.source_master_revision else null end,
        v_source_revision,
        case when v_update_type = 'new' then array['source_projection'] else array['source_projection', 'lifecycle'] end,
        v_projection, case when v_item_found then private.clinical_master_workspace_snapshot(v_item) else null end
      ) on conflict (workspace_id, release_id, source_master_record_id, update_type)
        do nothing
        returning id into v_update_id;
      if v_update_id is not null then
        v_reviews := v_reviews + 1;
        perform private.clinical_master_emit_update_notification(p_workspace_id, v_update_id);
        v_notifications := v_notifications + 1;
      end if;
    end if;
    v_update_id := null;
  end loop;

  return jsonb_build_object(
    'ok', true, 'workspaceId', p_workspace_id, 'releaseId', p_release_id,
    'createdCount', v_created, 'autoAppliedCount', v_auto_applied,
    'reviewCount', v_reviews, 'notificationCount', v_notifications,
    'enforcedBy', 'clinical-master-workspace-adoption'
  );
end;
$$;

revoke all on function private.clair_adopt_master_release_to_workspace_a2_base(text, uuid)
  from public, anon, authenticated, service_role;

create or replace function public.clair_resolve_workspace_master_update(
  p_workspace_id text,
  p_update_id uuid,
  p_expected_catalog_revision integer,
  p_action text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, master, pg_temp
as $$
declare
  v_update public.workspace_master_updates%rowtype;
  v_item public.order_catalog_items%rowtype;
  v_snapshot jsonb;
  v_classification jsonb;
  v_order jsonb;
  v_path_id uuid;
  v_standard_name text;
  v_aliases text[];
  v_species text[];
  v_sales_unit text;
  v_source_revision integer;
  v_billing boolean;
  v_next_availability text;
  v_next_merge_status text;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if p_expected_catalog_revision is null or p_expected_catalog_revision <= 0 then
    raise exception 'catalog_revision_required' using errcode = '22023';
  end if;
  if p_action not in ('accept_source', 'dismiss') then
    raise exception 'workspace_master_update_action_invalid' using errcode = '22023';
  end if;
  if not private.clair_is_active_workspace_member(p_workspace_id)
    or not private.clair_is_workspace_admin(p_workspace_id) then
    raise exception 'workspace_admin_required' using errcode = '42501';
  end if;

  select * into v_update
  from public.workspace_master_updates
  where id = p_update_id and workspace_id = p_workspace_id
  for update;
  if not found then
    raise exception 'workspace_master_update_not_found' using errcode = 'P0002';
  end if;
  if v_update.status <> 'pending' then
    raise exception 'workspace_master_update_already_resolved' using errcode = '40901';
  end if;
  if v_update.order_catalog_item_id is null then
    raise exception 'workspace_master_update_item_required' using errcode = '23503';
  end if;

  select * into v_item
  from public.order_catalog_items
  where workspace_id = p_workspace_id and id = v_update.order_catalog_item_id
  for update;
  if not found then
    raise exception 'order_catalog_item_not_found' using errcode = 'P0002';
  end if;
  if v_item.catalog_revision <> p_expected_catalog_revision then
    raise exception 'catalog_revision_conflict' using errcode = '40001';
  end if;

  if p_action = 'dismiss' then
    update public.workspace_master_updates
    set status = 'dismissed', resolved_by_user_id = auth.uid(), resolved_at = now()
    where id = v_update.id;
    return jsonb_build_object(
      'ok', true, 'status', 200, 'action', p_action,
      'item', to_jsonb(v_item), 'update', to_jsonb(v_update),
      'enforcedBy', 'clair_resolve_workspace_master_update'
    );
  end if;

  if v_item.origin_type <> 'clair_master'
    or v_item.source_master_record_id <> v_update.source_master_record_id then
    raise exception 'workspace_master_update_lineage_conflict' using errcode = '40901';
  end if;
  v_snapshot := v_update.source_snapshot;
  v_classification := coalesce(v_snapshot -> 'classification', '{}'::jsonb);
  v_order := coalesce(v_snapshot -> 'order', '{}'::jsonb);
  if v_snapshot ->> 'masterKey' is null
    or v_classification ->> 'pathKey' is null
    or v_classification ->> 'itemType' is null then
    raise exception 'workspace_master_update_snapshot_invalid' using errcode = '22023';
  end if;
  select id into v_path_id
  from master.classification_paths
  where path_key = v_classification ->> 'pathKey'
    and retired_in_release_id is null
  order by path_key
  limit 1;
  if v_path_id is null then
    raise exception 'workspace_master_classification_path_missing' using errcode = '23503';
  end if;
  v_source_revision := v_update.source_revision;
  v_standard_name := coalesce(
    (
      select value ->> 'name'
      from jsonb_array_elements(coalesce(v_snapshot -> 'names', '[]'::jsonb))
      where value ->> 'languageCode' = 'ko'
        and value ->> 'nameKind' = 'preferred'
      order by (value ->> 'sortOrder')::integer, value ->> 'name'
      limit 1
    ), v_snapshot ->> 'masterKey'
  );
  select coalesce(array_agg(value ->> 'name' order by (value ->> 'sortOrder')::integer, value ->> 'name'), '{}')
  into v_aliases
  from jsonb_array_elements(coalesce(v_snapshot -> 'names', '[]'::jsonb))
  where value ->> 'nameKind' = 'alias';
  v_species := coalesce(
    array(select value #>> '{}' from jsonb_array_elements(coalesce(v_order -> 'species', '[]'::jsonb))),
    '{dog,cat}'
  );
  v_sales_unit := private.clinical_master_normalize_sales_unit(
    v_order ->> 'defaultSalesUnitCode', v_item.sales_unit
  );
  v_billing := coalesce(
    (v_order ->> 'defaultBillingReflectionEnabled')::boolean,
    v_item.billing_reflection_enabled
  );
  v_next_availability := case
    when v_update.update_type = 'new' then 'active'
    else v_item.availability_status
  end;
  if v_next_availability = 'active' and v_billing and v_item.price_krw is null then
    raise exception 'active_billable_price_required' using errcode = '23514';
  end if;
  v_next_merge_status := case
    when v_snapshot ->> 'lifecycleStatus' in ('deprecated', 'deprecation_pending')
      then 'deprecated_source'
    else 'current'
  end;

  update public.order_catalog_items
  set standard_order_id = v_snapshot ->> 'masterKey',
      source_preset_version = 'master-r' || v_source_revision,
      last_auto_merged_preset_version = 'master-r' || v_source_revision,
      category_group = v_classification ->> 'itemType',
      category_label = coalesce(v_classification ->> 'chartGroupCode', v_item.category_label),
      standard_order_name = v_standard_name,
      aliases = v_aliases,
      availability_status = v_next_availability,
      sales_unit = v_sales_unit,
      pricing_rule = jsonb_set(
        coalesce(pricing_rule, '{}'::jsonb), '{salesUnit}',
        to_jsonb(v_sales_unit), true
      ),
      target_species = v_species,
      default_destination_module = case v_classification ->> 'destinationModule'
        when 'inpatient' then 'billing_only'
        else coalesce(v_classification ->> 'destinationModule', v_item.default_destination_module)
      end,
      default_task_required = coalesce((v_classification ->> 'taskRequired')::boolean, v_item.default_task_required),
      billing_reflection_enabled = v_billing,
      source_master_revision = v_source_revision,
      last_auto_merged_revision = v_source_revision,
      classification_path_id = v_path_id,
      source_projection_snapshot = v_snapshot,
      source_projection_fingerprint = private.clinical_master_projection_fingerprint(v_snapshot),
      catalog_revision = catalog_revision + 1,
      preset_merge_status = v_next_merge_status,
      updated_at = now()
  where workspace_id = p_workspace_id and id = v_item.id;

  update public.workspace_master_updates
  set status = 'accepted', resolved_by_user_id = auth.uid(), resolved_at = now()
  where id = v_update.id;
  return jsonb_build_object(
    'ok', true, 'status', 200, 'action', p_action,
    'item', to_jsonb((select item from public.order_catalog_items item
      where item.workspace_id = p_workspace_id and item.id = v_item.id)),
    'update', to_jsonb(v_update),
    'enforcedBy', 'clair_resolve_workspace_master_update'
  );
end;
$$;

revoke all on function public.clair_resolve_workspace_master_update(text, uuid, integer, text)
  from public, anon, service_role;
grant execute on function public.clair_resolve_workspace_master_update(text, uuid, integer, text)
  to authenticated;

comment on function private.clair_adopt_master_release_to_workspace_a2_base(text, uuid) is
  'Phase 1A-2 private adoption writer with canonical source sales-unit normalization.';
