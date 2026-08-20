-- CLINICAL-MASTER-PR-003: sole order authority.
-- This migration is intentionally additive. Existing service-backed rows and
-- their historical snapshots remain compatibility data; only new individual
-- rows with a direct catalog selection use the catalog authority below.

set check_function_bodies = off;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'order_catalog_items'
      and column_name = 'catalog_revision'
  ) then
    raise exception 'clinical_master_phase1a3_preflight_a2_catalog_revision_missing';
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.order_catalog_items'::regclass
      and conname = 'order_catalog_items_workspace_id_id_key'
  ) then
    raise exception 'clinical_master_phase1a3_preflight_a2_workspace_catalog_key_missing';
  end if;
end
$$;

alter table public.orders
  add column if not exists workspace_catalog_item_id text,
  add column if not exists source_master_record_id uuid,
  add column if not exists source_master_revision integer,
  add column if not exists workspace_catalog_revision integer;

-- The report is emitted before any A3 FK, CHECK, or unique index is added.
-- It is deliberately read-only: no legacy provenance is inferred or rewritten.
do $$
declare
  v_bucket record;
  v_fatal integer := 0;
begin
  for v_bucket in
    select * from (
      select 'catalog_service_dual' bucket, count(*) count
      from public.orders
      where workspace_catalog_item_id is not null and service_item_id is not null
      union all
      select 'catalog_missing_or_cross_workspace', count(*)
      from public.orders o
      where o.workspace_catalog_item_id is not null
        and not exists (
          select 1 from public.order_catalog_items c
          where c.workspace_id = o.workspace_id and c.id = o.workspace_catalog_item_id
        )
      union all
      select 'catalog_non_individual', count(*)
      from public.orders
      where workspace_catalog_item_id is not null and row_type is distinct from 'individual'
      union all
      select 'catalog_revision_invalid', count(*)
      from public.orders
      where workspace_catalog_item_id is not null
        and (workspace_catalog_revision is null or workspace_catalog_revision <= 0)
      union all
      select 'master_lineage_partial', count(*)
      from public.orders
      where workspace_catalog_item_id is not null
        and (source_master_record_id is null) <> (source_master_revision is null)
      union all
      select 'master_lineage_missing', count(*)
      from public.orders o
      where o.workspace_catalog_item_id is not null
        and (
          (o.source_master_record_id is not null and not exists (
            select 1 from master.master_records m where m.id = o.source_master_record_id
          ))
          or (o.source_master_revision is not null and not exists (
            select 1 from master.master_record_versions v
            where v.master_record_id = o.source_master_record_id
              and v.revision = o.source_master_revision
          ))
        )
      union all
      select 'catalog_snapshot_mismatch_confirmed_or_billed', count(*)
      from public.orders o
      where o.workspace_catalog_item_id is not null
        and o.order_confirmation_status in ('confirmed','billed')
        and (
          jsonb_typeof(o.applied_snapshot) is distinct from 'object'
          or o.applied_snapshot->>'workspaceCatalogItemId' is distinct from o.workspace_catalog_item_id
          or o.applied_snapshot->>'workspaceCatalogRevision' is distinct from o.workspace_catalog_revision::text
        )
      union all
      select 'catalog_snapshot_mismatch_cancelled', count(*)
      from public.orders o
      where o.workspace_catalog_item_id is not null
        and o.order_confirmation_status = 'cancelled'
        and (
          jsonb_typeof(o.applied_snapshot) is distinct from 'object'
          or o.applied_snapshot->>'workspaceCatalogItemId' is distinct from o.workspace_catalog_item_id
          or o.applied_snapshot->>'workspaceCatalogRevision' is distinct from o.workspace_catalog_revision::text
        )
      union all
      select 'invoice_line_duplicate_order', count(*)
      from (
        select workspace_id, order_id from public.invoice_lines
        where order_id is not null
        group by workspace_id, order_id having count(*) > 1
      ) duplicate_rows
      union all
      select 'invoice_line_order_missing_or_cross_workspace', count(*)
      from public.invoice_lines l
      left join public.orders o on o.id = l.order_id
      where l.order_id is not null
        and (o.id is null or l.workspace_id is distinct from o.workspace_id)
      union all
      select 'order_anchor_mismatch', count(*)
      from public.orders o
      join public.invoice_lines l on l.id = o.invoice_line_id
      where l.order_id is distinct from o.id or l.workspace_id is distinct from o.workspace_id
      union all
      select 'invoice_line_anchor_multiple_orders', count(*)
      from (
        select workspace_id, invoice_line_id from public.orders
        where invoice_line_id is not null
        group by workspace_id, invoice_line_id having count(*) > 1
      ) duplicate_anchors
      union all
      select 'order_multiple_same_order_lines', count(*)
      from public.orders o
      where o.invoice_line_id is not null
        and exists (
        select 1 from public.invoice_lines l
        where l.workspace_id = o.workspace_id and l.order_id = o.id
          and l.id is distinct from o.invoice_line_id
      )
      union all
      select 'invoice_order_encounter_mismatch', count(*)
      from public.invoice_lines l
      join public.orders o on o.id = l.order_id
      join public.invoices i on i.id = l.invoice_id
      where l.order_id is not null
        and (
          i.workspace_id is distinct from o.workspace_id
          or i.encounter_id is distinct from o.encounter_id
        )
    ) buckets
    order by bucket
  loop
    raise notice 'A3 preflight bucket=% count=%', v_bucket.bucket, v_bucket.count;
    if v_bucket.count > 0 then
      v_fatal := v_fatal + v_bucket.count;
    end if;
  end loop;
  if v_fatal > 0 then
    raise exception 'clinical_master_phase1a3_preflight_fatal bucket_count=%', v_fatal;
  end if;
end
$$;

-- These compatibility and adoption buckets are report-only. They are
-- deliberately emitted after the fatal pass and before any constraint/index
-- write so reviewers can distinguish tolerated legacy state from a blocked
-- migration without inferring catalog provenance.
do $$
declare
  v_bucket record;
begin
  for v_bucket in
    select * from (
      select 'legacy_service_item' bucket, count(*) count
      from public.orders
      where workspace_catalog_item_id is null and service_item_id is not null
      union all
      select 'legacy_null_service_confirmed_or_billed', count(*)
      from public.orders
      where workspace_catalog_item_id is null and service_item_id is null
        and order_confirmation_status in ('confirmed','billed')
      union all
      select 'legacy_null_service_cancelled', count(*)
      from public.orders
      where workspace_catalog_item_id is null and service_item_id is null
        and order_confirmation_status = 'cancelled'
      union all
      select 'legacy_null_service_draft_or_pending', count(*)
      from public.orders
      where workspace_catalog_item_id is null and service_item_id is null
        and order_confirmation_status in ('draft','pending')
      union all
      select 'legacy_json_catalog_claim', count(*)
      from public.orders
      where workspace_catalog_item_id is null
        and applied_snapshot->>'workspaceCatalogItemId' is not null
      union all
      select 'legacy_compatibility_metadata_only', count(*)
      from public.orders
      where workspace_catalog_item_id is null
        and (
          source_order_id is not null
          or source_order_version is not null
          or calculation_inputs->'pricingRule'->>'linkedServiceItemId' is not null
          or calculation_outputs->'pricingRule'->>'linkedServiceItemId' is not null
        )
      union all
      select 'catalog_snapshot_mismatch_draft_or_pending', count(*)
      from public.orders o
      where o.workspace_catalog_item_id is not null
        and o.order_confirmation_status in ('draft','pending')
        and (
          jsonb_typeof(o.applied_snapshot) is distinct from 'object'
          or o.applied_snapshot->>'workspaceCatalogItemId' is distinct from o.workspace_catalog_item_id
          or o.applied_snapshot->>'workspaceCatalogRevision' is distinct from o.workspace_catalog_revision::text
        )
      union all
      select 'legacy_anchor_adoption_candidate', count(*)
      from public.orders o
      where o.invoice_line_id is null
        and (
          select count(*)
          from public.invoice_lines l
          join public.invoices i
            on i.workspace_id = l.workspace_id and i.id = l.invoice_id
          where l.workspace_id = o.workspace_id
            and l.order_id = o.id
            and i.encounter_id = o.encounter_id
        ) = 1
      union all
      select 'legacy_unanchored_no_order_line', count(*)
      from public.orders o
      where o.invoice_line_id is null
        and not exists (
          select 1
          from public.invoice_lines l
          join public.invoices i
            on i.workspace_id = l.workspace_id and i.id = l.invoice_id
          where l.workspace_id = o.workspace_id
            and l.order_id = o.id
            and i.encounter_id = o.encounter_id
        )
    ) buckets
    order by bucket
  loop
    raise notice 'A3 preflight tolerated bucket=% count=%', v_bucket.bucket, v_bucket.count;
  end loop;
end
$$;

-- A3 is replayed directly during the local gate. Guard each named
-- constraint so a second application reaches the adoption/RPC replacement
-- phase instead of failing on duplicate_object.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.orders'::regclass
      and conname = 'orders_workspace_catalog_item_fk'
  ) then
    alter table public.orders
      add constraint orders_workspace_catalog_item_fk
        foreign key (workspace_id, workspace_catalog_item_id)
        references public.order_catalog_items(workspace_id, id)
        on delete restrict;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.orders'::regclass
      and conname = 'orders_source_master_record_fk'
  ) then
    alter table public.orders
      add constraint orders_source_master_record_fk
        foreign key (source_master_record_id)
        references master.master_records(id)
        on delete restrict;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.orders'::regclass
      and conname = 'orders_source_master_revision_fk'
  ) then
    alter table public.orders
      add constraint orders_source_master_revision_fk
        foreign key (source_master_record_id, source_master_revision)
        references master.master_record_versions(master_record_id, revision)
        on delete restrict;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.orders'::regclass
      and conname = 'orders_catalog_service_dual_check'
  ) then
    alter table public.orders
      add constraint orders_catalog_service_dual_check
        check (workspace_catalog_item_id is null or service_item_id is null);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.orders'::regclass
      and conname = 'orders_catalog_individual_check'
  ) then
    alter table public.orders
      add constraint orders_catalog_individual_check
        check (workspace_catalog_item_id is null or row_type = 'individual');
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.orders'::regclass
      and conname = 'orders_catalog_revision_check'
  ) then
    alter table public.orders
      add constraint orders_catalog_revision_check
        check (workspace_catalog_item_id is null or workspace_catalog_revision > 0);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.orders'::regclass
      and conname = 'orders_master_lineage_pair_check'
  ) then
    alter table public.orders
      add constraint orders_master_lineage_pair_check
        check ((source_master_record_id is null) = (source_master_revision is null));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.orders'::regclass
      and conname = 'orders_catalog_snapshot_check'
  ) then
    alter table public.orders
      add constraint orders_catalog_snapshot_check
        check (
          workspace_catalog_item_id is null
          or (
            jsonb_typeof(applied_snapshot) = 'object'
            and applied_snapshot->>'workspaceCatalogItemId' = workspace_catalog_item_id
            and applied_snapshot->>'workspaceCatalogRevision' = workspace_catalog_revision::text
          )
        );
  end if;
end
$$;

create index if not exists orders_workspace_catalog_item_idx
  on public.orders (workspace_id, workspace_catalog_item_id)
  where workspace_catalog_item_id is not null;
create index if not exists orders_source_master_revision_idx
  on public.orders (workspace_id, source_master_record_id, source_master_revision)
  where source_master_record_id is not null;

-- Existing line/order links are adopted only when the relationship is already
-- proven by workspace + encounter. No line, invoice, or user-entered field is
-- changed by this block.
do $$
declare
  v_scope record;
  v_order record;
  v_line_id uuid;
  v_line_count integer;
begin
  -- The advisory lock is deliberately acquired before any order row lock.
  -- This is the same lock order used by the billing anchor RPC and prevents
  -- migration-time adoption from deadlocking a concurrent anchor attempt.
  for v_scope in
    select distinct o.workspace_id, o.encounter_id
    from public.orders o
    where o.invoice_line_id is null
    order by o.workspace_id, o.encounter_id
  loop
    perform pg_advisory_xact_lock(
      hashtextextended('clinical_billing:' || v_scope.workspace_id || ':' || v_scope.encounter_id::text, 0)
    );
    for v_order in
      select o.workspace_id, o.encounter_id, o.id
      from public.orders o
      where o.workspace_id = v_scope.workspace_id
        and o.encounter_id = v_scope.encounter_id
        and o.invoice_line_id is null
      order by o.id
      for update
    loop
      select count(*), (array_agg(l.id order by l.id))[1]
        into v_line_count, v_line_id
      from public.invoice_lines l
      join public.invoices i
        on i.workspace_id = l.workspace_id and i.id = l.invoice_id
      where l.workspace_id = v_order.workspace_id
        and l.order_id = v_order.id
        and i.encounter_id = v_order.encounter_id;
      if v_line_count = 1 then
        perform 1
        from public.invoice_lines
        where workspace_id = v_order.workspace_id and id = v_line_id
        for update;
        update public.orders
        set invoice_line_id = v_line_id
        where workspace_id = v_order.workspace_id and id = v_order.id and invoice_line_id is null;
      end if;
    end loop;
  end loop;
end
$$;

create unique index if not exists invoice_lines_workspace_order_unique
  on public.invoice_lines (workspace_id, order_id)
  where order_id is not null;
create unique index if not exists orders_workspace_invoice_line_unique
  on public.orders (workspace_id, invoice_line_id)
  where invoice_line_id is not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.order_catalog_items'::regclass
      and conname = 'order_catalog_items_rounding_rule_check'
  ) then
    alter table public.order_catalog_items
      add constraint order_catalog_items_rounding_rule_check
      check (rounding_rule in ('as_is', 'ceil', 'floor', 'round'));
  end if;
end
$$;

-- The catalog/category mapping is private SQL authority. The TypeScript
-- mirror is test/display-only and is never used to persist a billing category.
create or replace function private.clair_map_catalog_category_to_billing_category(p_category_group text)
returns text
language plpgsql
immutable
security definer
set search_path = public, private, pg_temp
as $$
begin
  return case p_category_group
    when 'consultation' then 'consultation'
    when 'medication' then 'dispensing'
    when 'treatment' then 'treatment'
    when 'lab' then 'laboratory'
    when 'imaging' then 'imaging'
    when 'hospitalization' then 'other'
    when 'misc' then 'other'
    else null
  end;
end
$$;
revoke all on function private.clair_map_catalog_category_to_billing_category(text) from public, anon, authenticated;

create or replace function private.clair_round_catalog_order_amount(
  p_amount numeric,
  p_rounding_rule text
)
returns numeric
language plpgsql
immutable
security definer
set search_path = public, private, pg_temp
as $$
begin
  if p_rounding_rule not in ('as_is', 'ceil', 'floor', 'round') then
    raise exception 'invalid_rounding_rule';
  end if;
  if p_amount is null then
    return null;
  end if;
  return case p_rounding_rule
    when 'as_is' then p_amount::numeric(12,2)
    when 'ceil' then ceil(p_amount)::numeric(12,2)
    when 'floor' then floor(p_amount)::numeric(12,2)
    when 'round' then round(p_amount)::numeric(12,2)
  end;
end
$$;

revoke all on function private.clair_round_catalog_order_amount(numeric, text)
  from public, anon, authenticated;


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
as $$
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
  if c.availability_status <> 'active' then
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
end
$$;

revoke all on function private.clair_build_catalog_order_snapshot(text,text,numeric)
  from public, anon, authenticated;

create or replace function public.clair_get_chart_order_draft(
  p_workspace_id text,
  p_encounter_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions, pg_temp
as $$
declare
  v_order_rows jsonb;
begin
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing';
  end if;
  if not exists (
    select 1 from public.encounters e
    where e.workspace_id = p_workspace_id and e.id = p_encounter_id and e.status <> 'cancelled'
  ) then
    raise exception 'encounter_unavailable';
  end if;
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'orderId', o.id,
      'workspaceId', o.workspace_id,
      'encounterId', o.encounter_id,
      'billingDisplayName', coalesce(o.billing_display_name, o.display_name),
      'displayName', o.display_name,
      'quantity', o.quantity,
      'unitPriceSnapshot', o.unit_price_snapshot,
      'lineTotalSnapshot', o.line_total_snapshot,
      'rowType', o.row_type,
      'serviceItemId', o.service_item_id,
      'workspaceCatalogItemId', o.workspace_catalog_item_id,
      'sourceMasterRecordId', o.source_master_record_id,
      'sourceMasterRevision', o.source_master_revision,
      'workspaceCatalogRevision', o.workspace_catalog_revision,
      'sourceOrderId', o.source_order_id,
      'sourceOrderVersion', o.source_order_version,
      'appliedSnapshot', nullif(o.applied_snapshot, '{}'::jsonb),
      'appliedPriceSnapshot', nullif(o.applied_price_snapshot, '{}'::jsonb),
      'billingReflectionEnabled', o.billing_reflection_enabled,
      'orderConfirmationStatus', o.order_confirmation_status,
      'status', o.status,
      'updatedAt', o.updated_at
    )
    order by o.sort_order, o.created_at, o.id
  ), '[]'::jsonb)
  into v_order_rows
  from public.orders o
  where o.workspace_id = p_workspace_id
    and o.encounter_id = p_encounter_id
    and o.status <> 'cancelled'
    and o.order_confirmation_status in ('draft', 'pending');
  return v_order_rows;
end
$$;

create or replace function public.clair_save_chart_order_draft(
  p_workspace_id text,
  p_actor_user_id text,
  p_encounter_id uuid,
  p_orders jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions, pg_temp
as $$
declare
  v_actor_user_id uuid := private.clair_safe_uuid(p_actor_user_id);
  v_now timestamptz := now();
  v_order_rows jsonb;
  v_bad_count integer;
  v_numeric_pattern text := '^\+?([0-9]+(\.[0-9]+)?|\.[0-9]+)$';
  v_quantity_max numeric := 9999;
  v_price_max numeric := 9999999999.99;
begin
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing';
  end if;
  if v_actor_user_id is null or v_actor_user_id is distinct from auth.uid() then
    raise exception 'workspace_membership_missing';
  end if;
  if not private.clair_current_user_has_workspace_permission(p_workspace_id, 'chart:update') then
    raise exception 'permission_missing';
  end if;
  if jsonb_typeof(coalesce(p_orders, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_orders, '[]'::jsonb)) > 100 then
    raise exception 'invalid_order_rows';
  end if;
  if not exists (
    select 1 from public.encounters e
    where e.workspace_id = p_workspace_id and e.id = p_encounter_id and e.status <> 'cancelled'
    for update
  ) then
    raise exception 'encounter_unavailable';
  end if;

  -- Validate client numeric input in the database before any cast or row
  -- mutation. Nonfinite/malformed values, nonpositive quantities, negative
  -- prices, and over-limit values are rejected; explicit zero prices remain
  -- valid, while NULL remains the explicit legacy price value and is
  -- preserved in historical snapshots.
  if exists (
    with input_values as (
      select
        value->>'quantity' as quantity_text,
        value->>'unitPriceSnapshot' as price_text
      from jsonb_array_elements(coalesce(p_orders, '[]'::jsonb)) row_data(value)
    )
    select 1
    from input_values
    where quantity_text is null
       or quantity_text !~ v_numeric_pattern
       or case when quantity_text ~ v_numeric_pattern then quantity_text::numeric end <= 0
       or case when quantity_text ~ v_numeric_pattern then quantity_text::numeric end > v_quantity_max
       or (
         price_text is not null
         and (
           price_text !~ v_numeric_pattern
           or case when price_text ~ v_numeric_pattern then price_text::numeric end < 0
           or case when price_text ~ v_numeric_pattern then price_text::numeric end > v_price_max
         )
       )
  ) then
    raise exception 'invalid_order_rows';
  end if;

  create temporary table if not exists pg_temp.clinical_master_a3_draft_input (
    input_index integer not null,
    order_id uuid not null,
    row_value jsonb not null,
    workspace_catalog_item_id text,
    source_preset_id text,
    source_preset_version text,
    billing_display_name text not null,
    display_name text not null,
    category_group text,
    row_type text not null,
    quantity numeric not null,
    client_unit_price numeric,
    client_task_required boolean,
    client_billing_reflection_enabled boolean
  ) on commit drop;
  truncate pg_temp.clinical_master_a3_draft_input;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(p_orders, '[]'::jsonb)) row_data(value)
    where private.clair_safe_uuid(row_data.value->>'orderId') is null
      and nullif(btrim(row_data.value->>'workspaceCatalogItemId'), '') is null
  ) then
    raise exception 'catalog_item_required_for_new_order';
  end if;

  insert into pg_temp.clinical_master_a3_draft_input (
    input_index, order_id, row_value, workspace_catalog_item_id,
    source_preset_id, source_preset_version, billing_display_name,
    display_name, category_group, row_type, quantity, client_unit_price,
    client_task_required, client_billing_reflection_enabled
  )
  select
    row_number() over (),
    coalesce(private.clair_safe_uuid(value->>'orderId'), gen_random_uuid()),
    value,
    nullif(btrim(value->>'workspaceCatalogItemId'), ''),
    nullif(btrim(value->>'sourcePresetId'), ''),
    nullif(btrim(value->>'sourcePresetVersion'), ''),
    coalesce(nullif(btrim(value->>'billingDisplayName'), ''), 'Unnamed order'),
    coalesce(
      nullif(btrim(value->>'displayName'), ''),
      nullif(btrim(value->'appliedSnapshot'->>'appliedDisplayName'), ''),
      nullif(btrim(value->>'billingDisplayName'), ''),
      'Unnamed order'
    ),
    nullif(value->>'categoryGroup', ''),
    case when value->>'rowType' = 'set' then 'set' else 'individual' end,
    (value->>'quantity')::numeric,
    nullif(value->>'unitPriceSnapshot', '')::numeric,
    (value->'appliedSnapshot'->>'appliedTaskRequired')::boolean,
    (value->'appliedSnapshot'->>'billingReflectionEnabled')::boolean
  from jsonb_array_elements(coalesce(p_orders, '[]'::jsonb)) row_data(value)
  where (private.clair_safe_uuid(value->>'orderId') is not null
         or nullif(btrim(value->>'workspaceCatalogItemId'), '') is not null)
    and (value->>'quantity')::numeric > 0;

  select count(*)
  into v_bad_count
  from pg_temp.clinical_master_a3_draft_input input
  where input.workspace_catalog_item_id is not null
    and not exists (
      select 1 from public.order_catalog_items c
      where c.workspace_id = p_workspace_id and c.id = input.workspace_catalog_item_id
    );
  if v_bad_count > 0 then
    raise exception 'catalog_item_unavailable';
  end if;

  if exists (
    select 1
    from pg_temp.clinical_master_a3_draft_input input
    where input.workspace_catalog_item_id is not null
      and input.row_type <> 'individual'
  ) then
    raise exception 'unsupported_order_type';
  end if;

  -- Lock all selected catalog rows before building any preview.
  perform 1
  from public.order_catalog_items c
  join pg_temp.clinical_master_a3_draft_input input
    on input.workspace_catalog_item_id = c.id
  where c.workspace_id = p_workspace_id
  order by c.id
  for update;

  -- Existing service-backed rows remain legacy and cannot be converted by a
  -- client request that merely claims a catalog ID.
  if exists (
    select 1
    from pg_temp.clinical_master_a3_draft_input input
    join public.orders o
      on o.workspace_id = p_workspace_id and o.encounter_id = p_encounter_id and o.id = input.order_id
    where input.workspace_catalog_item_id is not null
      and o.workspace_catalog_item_id is null
      and o.service_item_id is not null
  ) then
    raise exception 'legacy_order_origin_immutable';
  end if;

  -- New catalog-origin rows are inserted only from the locked catalog row.
  insert into public.orders (
    id, workspace_id, encounter_id, service_item_id, workspace_catalog_item_id,
    source_master_record_id, source_master_revision, workspace_catalog_revision,
    order_type, display_name, billing_display_name, status, work_status, priority,
    quantity, unit_price_snapshot, requested_by_user_id, requested_at,
    instruction, sort_order, row_type, source_order_id, source_order_version,
    applied_snapshot, applied_price_snapshot, calculation_inputs,
    calculation_outputs, quantity_source, price_rule_source,
    billing_reflection_enabled, order_confirmation_status,
    billing_candidate_status, task_status, created_at, updated_at
  )
  select
    input.order_id, p_workspace_id, p_encounter_id, null, c.id,
    c.source_master_record_id, c.source_master_revision, c.catalog_revision,
    case c.category_group when 'lab' then 'lab'
         when 'imaging' then 'imaging' when 'medication' then 'dispensing'
         else 'treatment' end,
    c.in_hospital_order_name, c.billing_name, 'requested', 'pending', 'normal',
    input.quantity, c.price_krw, v_actor_user_id, v_now, c.internal_instruction,
    input.input_index * 10, input.row_type, c.standard_order_id,
    c.source_preset_version,
    private.clair_build_catalog_order_snapshot(p_workspace_id, c.id, input.quantity),
    jsonb_build_object(
      'priceKrw', c.price_krw, 'quantity', input.quantity,
      'lineTotalSnapshot', private.clair_round_catalog_order_amount(
        input.quantity * coalesce(c.price_krw, 0), c.rounding_rule
      ),
      'roundingRule', c.rounding_rule,
      'roundingResultKrw', case when c.price_krw is null then null
        else private.clair_round_catalog_order_amount(
          input.quantity * c.price_krw, c.rounding_rule
        ) end,
      'taxIncluded', c.tax_included,
      'taxType', case when c.tax_included then 'taxable' else 'non_taxable' end,
      'workspaceCatalogItemId', c.id,
      'workspaceCatalogRevision', c.catalog_revision,
      'source', 'order_catalog_items'
    ),
    jsonb_build_object(
      'quantitySource', 'manual',
      'roundingRule', c.rounding_rule,
      'storageScale', 2,
      'source', 'order_catalog_items'
    ),
    jsonb_build_object(
      'lineTotalSnapshot', private.clair_round_catalog_order_amount(
        input.quantity * coalesce(c.price_krw, 0), c.rounding_rule
      ),
      'priceKrw', c.price_krw,
      'roundingRule', c.rounding_rule,
      'roundingResultKrw', case when c.price_krw is null then null
        else private.clair_round_catalog_order_amount(
          input.quantity * c.price_krw, c.rounding_rule
        ) end,
      'taxType', case when c.tax_included then 'taxable' else 'non_taxable' end
    ),
    'manual', 'preset_price', c.billing_reflection_enabled, 'draft',
    'not_requested',
    case when c.default_task_required then 'pending' else null end,
    v_now, v_now
  from pg_temp.clinical_master_a3_draft_input input
  join public.order_catalog_items c
    on c.workspace_id = p_workspace_id and c.id = input.workspace_catalog_item_id
  where not exists (
    select 1 from public.orders o
    where o.workspace_id = p_workspace_id and o.encounter_id = p_encounter_id and o.id = input.order_id
  );

  -- Catalog-origin drafts are rebuilt from the active catalog row. This is a
  -- preview boundary only; confirmed/billed rows are never refreshed here.
  update public.orders o
  set display_name = c.in_hospital_order_name,
      billing_display_name = c.billing_name,
      quantity = input.quantity,
      unit_price_snapshot = c.price_krw,
      source_master_record_id = c.source_master_record_id,
      source_master_revision = c.source_master_revision,
      workspace_catalog_revision = c.catalog_revision,
      order_type = case c.category_group when 'lab' then 'lab'
        when 'imaging' then 'imaging' when 'medication' then 'dispensing'
        else 'treatment' end,
      instruction = c.internal_instruction,
      billing_reflection_enabled = c.billing_reflection_enabled,
      applied_snapshot = private.clair_build_catalog_order_snapshot(p_workspace_id, c.id, input.quantity),
      applied_price_snapshot = jsonb_build_object(
        'priceKrw', c.price_krw, 'quantity', input.quantity,
        'lineTotalSnapshot', private.clair_round_catalog_order_amount(
          input.quantity * coalesce(c.price_krw, 0), c.rounding_rule
        ),
        'roundingRule', c.rounding_rule,
        'roundingResultKrw', case when c.price_krw is null then null
          else private.clair_round_catalog_order_amount(
            input.quantity * c.price_krw, c.rounding_rule
          ) end,
        'taxIncluded', c.tax_included,
        'taxType', case when c.tax_included then 'taxable' else 'non_taxable' end,
        'workspaceCatalogItemId', c.id,
        'workspaceCatalogRevision', c.catalog_revision,
        'source', 'order_catalog_items'
      ),
      calculation_inputs = coalesce(o.calculation_inputs, '{}'::jsonb)
        || jsonb_build_object(
          'quantitySource', 'manual',
          'roundingRule', c.rounding_rule,
          'storageScale', 2,
          'source', 'order_catalog_items'
        ),
      calculation_outputs = jsonb_build_object(
        'lineTotalSnapshot', private.clair_round_catalog_order_amount(
          input.quantity * coalesce(c.price_krw, 0), c.rounding_rule
        ),
        'priceKrw', c.price_krw,
        'roundingRule', c.rounding_rule,
        'roundingResultKrw', case when c.price_krw is null then null
          else private.clair_round_catalog_order_amount(
            input.quantity * c.price_krw, c.rounding_rule
          ) end,
        'taxType', case when c.tax_included then 'taxable' else 'non_taxable' end
      ),
      quantity_source = 'manual',
      price_rule_source = 'preset_price',
      task_status = case when c.default_task_required then 'pending' else null end,
      updated_at = v_now
  from pg_temp.clinical_master_a3_draft_input input
  join public.order_catalog_items c
    on c.workspace_id = p_workspace_id and c.id = input.workspace_catalog_item_id
  where o.workspace_id = p_workspace_id
    and o.encounter_id = p_encounter_id
    and o.id = input.order_id
    and o.workspace_catalog_item_id is not null
    and o.order_confirmation_status in ('draft', 'pending');

  -- Legacy rows are updated only with their existing compatibility fields.
  update public.orders o
  set billing_display_name = input.billing_display_name,
      display_name = input.display_name,
      quantity = input.quantity,
      unit_price_snapshot = case
        when input.client_unit_price is null then o.unit_price_snapshot
        else greatest(input.client_unit_price, 0)
      end,
      calculation_inputs = coalesce(o.calculation_inputs, '{}'::jsonb)
        || jsonb_build_object('quantitySource', 'manual', 'updatedByUserId', v_actor_user_id::text),
      calculation_outputs = coalesce(o.calculation_outputs, '{}'::jsonb)
        || jsonb_build_object('lineTotalSnapshot',
          input.quantity * greatest(coalesce(input.client_unit_price, o.unit_price_snapshot, 0), 0)),
      updated_at = v_now
  from pg_temp.clinical_master_a3_draft_input input
  where o.workspace_id = p_workspace_id
    and o.encounter_id = p_encounter_id
    and o.id = input.order_id
    and o.workspace_catalog_item_id is null
    and o.order_confirmation_status in ('draft', 'pending')
    and input.workspace_catalog_item_id is null;

  delete from public.orders o
  where o.workspace_id = p_workspace_id
    and o.encounter_id = p_encounter_id
    and o.order_confirmation_status in ('draft', 'pending')
    and o.invoice_line_id is null
    and not exists (
      select 1 from pg_temp.clinical_master_a3_draft_input input
      where input.order_id = o.id
    );

  update public.encounters
  set status = case when status = 'waiting' then 'ordered' else status end,
      started_at = coalesce(started_at, v_now),
      updated_at = v_now
  where workspace_id = p_workspace_id and id = p_encounter_id and status <> 'cancelled';

  select public.clair_get_chart_order_draft(p_workspace_id, p_encounter_id)
    into v_order_rows;
  return v_order_rows;
end
$$;

revoke all on function public.clair_get_chart_order_draft(text,uuid) from public, anon;
grant execute on function public.clair_get_chart_order_draft(text,uuid) to authenticated;
revoke all on function public.clair_save_chart_order_draft(text,text,uuid,jsonb) from public, anon;
grant execute on function public.clair_save_chart_order_draft(text,text,uuid,jsonb) to authenticated;


create or replace function public.clair_get_chart_order_actions(
  p_workspace_id text,
  p_encounter_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions, pg_temp
as $$
declare
  v_rows jsonb;
begin
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing';
  end if;
  if not exists (
    select 1 from public.encounters e
    where e.workspace_id = p_workspace_id and e.id = p_encounter_id and e.status <> 'cancelled'
  ) then
    raise exception 'encounter_unavailable';
  end if;
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'appliedSnapshot', nullif(o.applied_snapshot, '{}'::jsonb),
      'appliedPriceSnapshot', nullif(o.applied_price_snapshot, '{}'::jsonb),
      'billingCandidateId', o.billing_candidate_id,
      'billingCandidateStatus', o.billing_candidate_status,
      'confirmedAt', o.confirmed_at,
      'confirmedByUserId', o.confirmed_by_user_id,
      'encounterId', o.encounter_id,
      'orderConfirmationStatus', o.order_confirmation_status,
      'orderId', o.id,
      'workspaceId', o.workspace_id,
      'serviceItemId', o.service_item_id,
      'workspaceCatalogItemId', o.workspace_catalog_item_id,
      'sourceMasterRecordId', o.source_master_record_id,
      'sourceMasterRevision', o.source_master_revision,
      'workspaceCatalogRevision', o.workspace_catalog_revision,
      'sourceOrderId', o.source_order_id,
      'sourceOrderVersion', o.source_order_version,
      'status', o.status,
      'quantity', o.quantity,
      'unitPriceSnapshot', o.unit_price_snapshot,
      'lineTotalSnapshot', o.line_total_snapshot,
      'updatedAt', o.updated_at
    )
    order by o.sort_order, o.created_at, o.id
  ), '[]'::jsonb)
  into v_rows
  from public.orders o
  where o.workspace_id = p_workspace_id and o.encounter_id = p_encounter_id
    and o.status <> 'cancelled';
  return v_rows;
end
$$;

create or replace function public.clair_save_chart_order_action(
  p_workspace_id text,
  p_actor_user_id uuid,
  p_encounter_id uuid,
  p_action text,
  p_order_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions, pg_temp
as $$
declare
  v_now timestamptz := now();
  v_selected_count integer := coalesce(array_length(p_order_ids, 1), 0);
  v_matched_count integer;
  v_rows jsonb;
  v_order record;
  v_snapshot jsonb;
  v_actor_membership_id uuid;
begin
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing';
  end if;
  if p_actor_user_id is distinct from auth.uid() then
    raise exception 'workspace_membership_missing';
  end if;
  if not private.clair_current_user_has_workspace_permission(p_workspace_id, 'chart:update') then
    raise exception 'permission_missing';
  end if;
  if p_action not in ('confirm', 'bill') or v_selected_count = 0 or v_selected_count > 100 then
    raise exception 'invalid_order_action';
  end if;
  if not exists (
    select 1 from public.encounters e
    where e.workspace_id = p_workspace_id and e.id = p_encounter_id and e.status <> 'cancelled'
    for update
  ) then
    raise exception 'encounter_unavailable';
  end if;
  select count(*) into v_matched_count
  from public.orders o
  where o.workspace_id = p_workspace_id and o.encounter_id = p_encounter_id
    and o.id = any(p_order_ids) and o.status <> 'cancelled'
    and o.order_confirmation_status <> 'cancelled';
  if v_matched_count <> v_selected_count then
    raise exception 'order_unavailable';
  end if;

  select membership.id into v_actor_membership_id
  from public.user_memberships membership
  where membership.workspace_id = p_workspace_id
    and membership.user_id = auth.uid() and membership.status = 'active'
  limit 1;

  -- Sorted row locks make concurrent confirmation deterministic.
  for v_order in
    select o.*
    from public.orders o
    where o.workspace_id = p_workspace_id and o.encounter_id = p_encounter_id
      and o.id = any(p_order_ids) and o.status <> 'cancelled'
    order by o.id
    for update
  loop
    if p_action = 'confirm' then
      if v_order.row_type = 'set' then
        raise exception 'unsupported_order_type';
      end if;
      -- Confirmed and billed retries return the persisted snapshot and do not
      -- re-read mutable catalog data.
      if v_order.order_confirmation_status in ('confirmed','billed') then
        continue;
      end if;
      if v_order.workspace_catalog_item_id is not null then
        select private.clair_build_catalog_order_snapshot(
          v_order.workspace_id,
          c.id,
          v_order.quantity
        )
        into v_snapshot
        from public.order_catalog_items c
        where c.workspace_id = v_order.workspace_id
          and c.id = v_order.workspace_catalog_item_id
          and c.availability_status = 'active'
        for update;
        if v_snapshot is null then
          raise exception 'catalog_item_unavailable';
        end if;
        update public.orders o
        set service_item_id = null,
            source_master_record_id = nullif(v_snapshot->>'sourceMasterRecordId', '')::uuid,
            source_master_revision = nullif(v_snapshot->>'sourceMasterRevision', '')::integer,
            workspace_catalog_revision = (v_snapshot->>'workspaceCatalogRevision')::integer,
            unit_price_snapshot = (v_snapshot->>'priceKrw')::numeric,
            applied_snapshot = v_snapshot,
            applied_price_snapshot = jsonb_build_object(
              'priceKrw', (v_snapshot->>'priceKrw')::numeric,
              'quantity', v_order.quantity,
              'lineTotalSnapshot', (v_snapshot->>'lineTotalSnapshot')::numeric,
              'roundingRule', v_snapshot->>'roundingRule',
              'roundingResultKrw', v_snapshot->'roundingResultKrw',
              'taxIncluded', (v_snapshot->>'taxIncluded')::boolean,
              'taxType', v_snapshot->>'taxType',
              'workspaceCatalogItemId', v_order.workspace_catalog_item_id,
              'workspaceCatalogRevision', (v_snapshot->>'workspaceCatalogRevision')::integer,
              'source', 'order_catalog_items'
            ),
            calculation_inputs = coalesce(o.calculation_inputs, '{}'::jsonb)
              || jsonb_build_object(
                'roundingRule', v_snapshot->>'roundingRule',
                'storageScale', 2
              ),
            calculation_outputs = jsonb_build_object(
              'lineTotalSnapshot', (v_snapshot->>'lineTotalSnapshot')::numeric,
              'priceKrw', (v_snapshot->>'priceKrw')::numeric,
              'roundingRule', v_snapshot->>'roundingRule',
              'roundingResultKrw', v_snapshot->'roundingResultKrw',
              'taxType', v_snapshot->>'taxType'
            ),
            billing_reflection_enabled = coalesce((v_snapshot->>'billingReflectionEnabled')::boolean, true),
            order_type = coalesce(v_snapshot->>'orderType', v_order.order_type),
            status = case when o.status in ('draft','requested','re_requested') then 'confirmed' else o.status end,
            work_status = 'pending',
            order_confirmation_status = 'confirmed',
            confirmed_by_user_id = p_actor_user_id,
            confirmed_at = coalesce(o.confirmed_at, v_now),
            task_status = case when coalesce((v_snapshot->>'taskRequired')::boolean, true) then 'pending' else null end,
            updated_at = v_now
        where o.workspace_id = p_workspace_id and o.id = v_order.id;
      else
        update public.orders o
        set status = case when o.status in ('draft','requested','re_requested') then 'confirmed' else o.status end,
            order_confirmation_status = 'confirmed',
            confirmed_by_user_id = p_actor_user_id,
            confirmed_at = coalesce(o.confirmed_at, v_now),
            task_status = coalesce(o.task_status, 'pending'),
            updated_at = v_now
        where o.workspace_id = p_workspace_id and o.id = v_order.id;
      end if;
    else
      if v_order.order_confirmation_status not in ('confirmed','billed')
         and v_order.status not in ('completed','ready_for_billing') then
        raise exception 'order_unavailable';
      end if;
      update public.orders o
      set billing_candidate_status = case
            when o.invoice_line_id is not null then 'invoice_linked'
            else 'candidate_created'
          end,
          billing_candidate_id = coalesce(o.billing_candidate_id, concat('billcand-', o.id::text)),
          order_confirmation_status = case
            when o.invoice_line_id is not null then 'billed'
            else o.order_confirmation_status
          end,
          updated_at = v_now
      where o.workspace_id = p_workspace_id and o.id = v_order.id;
    end if;

    insert into public.order_events (
      workspace_id, order_id, event_type, performed_by_user_id, payload, created_at
    )
    values (
      p_workspace_id, v_order.id, 'edited', p_actor_user_id,
      jsonb_build_object(
        'action', p_action,
        'orderConfirmationStatus',
          case when p_action = 'confirm' then 'confirmed' else v_order.order_confirmation_status end,
        'snapshotSource', case when v_order.workspace_catalog_item_id is not null
          then 'order_catalog_items' else 'legacy_compatibility' end
      ),
      v_now
    );
  end loop;

  insert into public.audit_events (
    id, workspace_id, actor_user_id, actor_membership_id, event_type,
    target_type, target_id, encounter_id, patient_id, guardian_id,
    after_snapshot, metadata, occurred_at, created_at
  )
  select
    'audit_rpc_order_' || substr(encode(extensions.digest(
      p_workspace_id || ':' || o.id::text || ':' || p_action || ':' || v_now::text,
      'sha256'
    ), 'hex'), 1, 24),
    p_workspace_id, p_actor_user_id, v_actor_membership_id,
    case when p_action = 'confirm' then 'order.confirmed'
         else 'order.billing_candidate_requested' end,
    'order', o.id::text, p_encounter_id, e.patient_id, e.guardian_id,
    jsonb_build_object(
      'billingCandidateStatus', o.billing_candidate_status,
      'orderConfirmationStatus', o.order_confirmation_status,
      'status', o.status,
      'workspaceCatalogItemId', o.workspace_catalog_item_id,
      'workspaceCatalogRevision', o.workspace_catalog_revision
    ),
    jsonb_build_object('action', p_action, 'rpc', 'clair_save_chart_order_action'),
    v_now, v_now
  from public.orders o
  join public.encounters e on e.workspace_id = o.workspace_id and e.id = o.encounter_id
  where o.workspace_id = p_workspace_id and o.encounter_id = p_encounter_id
    and o.id = any(p_order_ids)
  on conflict (id) do update set id = excluded.id;

  select coalesce(jsonb_agg(row_data.value order by row_data.value->>'orderId'), '[]'::jsonb)
    into v_rows
  from jsonb_array_elements(public.clair_get_chart_order_actions(p_workspace_id, p_encounter_id))
    row_data(value)
  where nullif(row_data.value->>'orderId', '')::uuid = any(p_order_ids);
  return v_rows;
end
$$;

revoke all on function public.clair_get_chart_order_actions(text,uuid) from public, anon;
grant execute on function public.clair_get_chart_order_actions(text,uuid) to authenticated;
revoke all on function public.clair_save_chart_order_action(text,uuid,uuid,text,uuid[]) from public, anon;
grant execute on function public.clair_save_chart_order_action(text,uuid,uuid,text,uuid[]) to authenticated;


-- Guard the revoke for direct migration reapply: the first application
-- removes the deprecated writer, while a later application must still reach
-- the remaining A3 RPC replacements.
do $$
begin
  if to_regprocedure(
    'public.clair_enrich_fulfillment_work_item_snapshots(text,uuid,jsonb)'
  ) is not null then
    revoke all on function public.clair_enrich_fulfillment_work_item_snapshots(text,uuid,jsonb)
      from public, anon, authenticated;
  end if;
end
$$;
drop function if exists public.clair_enrich_fulfillment_work_item_snapshots(text,uuid,jsonb);

-- The legacy public transition RPC remains the only fulfillment mutation
-- surface. A3 replaces its body in place so existing callers keep the exact
-- signature while the actor, membership, row-lock, and queue permission
-- boundary is enforced before any status/assignment/audit write.
create or replace function public.clair_update_fulfillment_work_item(
  p_workspace_id text,
  p_actor_user_id uuid,
  p_work_item_id uuid,
  p_status text,
  p_assigned_to_user_id uuid default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions, pg_temp
as $$
declare
  v_item public.order_fulfillment_work_items%rowtype;
  v_now timestamptz := now();
  v_permission text;
begin
  if p_actor_user_id is distinct from auth.uid() then
    raise exception 'workspace_membership_missing';
  end if;
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing';
  end if;

  select *
  into v_item
  from public.order_fulfillment_work_items item
  where item.workspace_id = p_workspace_id
    and item.id = p_work_item_id
  for update;

  if v_item.id is null then
    raise exception 'work_item_unavailable';
  end if;

  if p_status not in ('requested', 'accepted', 'in_progress', 'completed', 'cancelled', 'returned') then
    raise exception 'invalid_transition';
  end if;

  if not private.clair_fulfillment_transition_allowed(v_item.status, p_status) then
    raise exception 'invalid_transition';
  end if;

  v_permission := case v_item.queue_type
    when 'lab' then 'lab:complete'
    when 'imaging' then 'imaging:complete'
    else 'dispensing:complete'
  end;
  if not private.clair_current_user_has_workspace_permission(
    p_workspace_id,
    v_permission
  ) then
    raise exception 'permission_missing';
  end if;

  update public.order_fulfillment_work_items item
  set
    status = p_status,
    assigned_to_user_id = coalesce(p_assigned_to_user_id, item.assigned_to_user_id),
    completed_at = case when p_status = 'completed' then v_now else item.completed_at end,
    cancelled_at = case when p_status = 'cancelled' then v_now else item.cancelled_at end,
    returned_at = case when p_status = 'returned' then v_now else item.returned_at end,
    reason = coalesce(nullif(btrim(p_reason), ''), item.reason),
    updated_at = v_now
  where item.workspace_id = p_workspace_id
    and item.id = p_work_item_id;

  insert into public.order_events (
    workspace_id,
    order_id,
    event_type,
    performed_by_user_id,
    payload,
    created_at
  )
  values (
    p_workspace_id,
    v_item.order_id,
    case when p_status = 'completed' then 'completed' else 'edited' end,
    p_actor_user_id,
    jsonb_build_object(
      'action', 'fulfillment_work_item_update',
      'fulfillmentWorkItemId', p_work_item_id,
      'previousStatus', v_item.status,
      'nextStatus', p_status
    ),
    v_now
  );

  return public.clair_list_fulfillment_work_items(
    p_workspace_id,
    v_item.queue_type,
    v_item.encounter_id,
    v_item.order_id,
    null
  );
end;
$$;

revoke all on function public.clair_update_fulfillment_work_item(text,uuid,uuid,text,uuid,text)
  from public, anon;
grant execute on function public.clair_update_fulfillment_work_item(text,uuid,uuid,text,uuid,text)
  to authenticated;

create or replace function public.clair_sync_fulfillment_work_items_from_orders(
  p_workspace_id text,
  p_actor_user_id uuid,
  p_encounter_id uuid,
  p_order_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions, pg_temp
as $$
declare
  v_now timestamptz := now();
  v_selected_count integer := coalesce(array_length(p_order_ids, 1), 0);
  v_matched_count integer;
  v_rows jsonb;
begin
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing';
  end if;
  if p_actor_user_id is distinct from auth.uid() then
    raise exception 'workspace_membership_missing';
  end if;
  if not private.clair_current_user_has_workspace_permission(p_workspace_id, 'chart:update') then
    raise exception 'permission_missing';
  end if;
  if v_selected_count = 0 or v_selected_count > 100 then
    raise exception 'order_unavailable';
  end if;
  -- Fulfillment and billing share one canonical lock order:
  -- encounter scope is checked after the advisory lock, then sorted orders,
  -- then existing work items. This prevents a retry racing the fulfillment
  -- billing wrapper from taking the same rows in reverse order.
  perform pg_advisory_xact_lock(
    hashtextextended('clinical_billing:' || p_workspace_id || ':' || p_encounter_id::text, 0)
  );
  if not exists (
    select 1 from public.encounters e
    where e.workspace_id = p_workspace_id and e.id = p_encounter_id and e.status <> 'cancelled'
    for update
  ) then
    raise exception 'encounter_unavailable';
  end if;
  -- Lock every selected order before validating its frozen routing/status.
  -- The same sorted order lock is held through the insert/upsert below.
  perform 1
  from public.orders o
  where o.workspace_id = p_workspace_id
    and o.encounter_id = p_encounter_id
    and o.id = any(p_order_ids)
  order by o.id
  for update;
  select count(*) into v_matched_count
  from public.orders o
  where o.workspace_id = p_workspace_id and o.encounter_id = p_encounter_id
    and o.id = any(p_order_ids)
    and o.status <> 'cancelled'
    and o.order_type in ('lab','imaging','dispensing','treatment')
    and o.order_confirmation_status in ('confirmed', 'billed')
    and (
      o.workspace_catalog_item_id is null
      or (
        jsonb_typeof(o.applied_snapshot->'taskRequired') = 'boolean'
        and (o.applied_snapshot->>'taskRequired')::boolean
        and o.applied_snapshot->>'destinationModule' = o.order_type
      )
    );
  if v_matched_count <> v_selected_count then
    raise exception 'order_unavailable';
  end if;

  -- Re-lock existing work items only after the canonical order lock. A first
  -- handoff has no row to lock; the insert below then owns its source snapshot.
  perform 1
  from public.order_fulfillment_work_items item
  where item.workspace_id = p_workspace_id
    and item.encounter_id = p_encounter_id
    and item.order_id = any(p_order_ids)
  order by item.order_id
  for update;

  -- The source snapshot is built once from the frozen order snapshot. On
  -- conflict only operational work-item fields are refreshed.
  insert into public.order_fulfillment_work_items (
    workspace_id, encounter_id, order_id, order_type, queue_type, status,
    priority, requested_by_user_id, assigned_to_user_id, due_at,
    completed_at, returned_at, source_snapshot, created_at, updated_at
  )
  select
    o.workspace_id, o.encounter_id, o.id, o.order_type, o.order_type,
    case when o.status = 're_requested' then 'returned'
         when o.status = 'in_progress' then 'in_progress'
         when o.status = 'completed' or o.work_status = 'completed' then 'completed'
         else 'requested' end,
    o.priority, coalesce(o.requested_by_user_id, p_actor_user_id),
    o.current_assignee_user_id, o.due_at,
    case when o.status = 'completed' or o.work_status = 'completed' then v_now end,
    case when o.status = 're_requested' then v_now end,
    jsonb_build_object(
      'patientName', p.name,
      'guardianName', g.name,
      'orderDisplayName', o.display_name,
      'serviceItemId', o.service_item_id,
      'workspaceCatalogItemId', o.workspace_catalog_item_id,
      'sourceMasterRecordId', o.source_master_record_id,
      'sourceMasterRevision', o.source_master_revision,
      'workspaceCatalogRevision', o.workspace_catalog_revision,
      'billingReflectionEnabled', coalesce(o.billing_reflection_enabled, true),
      'instruction', o.instruction,
      'frozenOrderSnapshot', o.applied_snapshot,
      'frozenPriceSnapshot', o.applied_price_snapshot,
      'detail', jsonb_build_object(
        'orderType', o.order_type,
        'categoryGroup', o.applied_snapshot->>'categoryGroup',
        'billingCategory', o.applied_snapshot->>'billingCategory',
        'priceKrw', o.unit_price_snapshot,
        'unitPriceSnapshot', o.unit_price_snapshot,
        'quantity', o.quantity,
        'lineTotalSnapshot', o.line_total_snapshot,
        'destinationModule', o.applied_snapshot->'destinationModule',
        'taskRequired', o.applied_snapshot->'taskRequired',
        'warningMessage', o.warning_message
      )
    ),
    v_now, v_now
  from public.orders o
  join public.encounters e on e.workspace_id = o.workspace_id and e.id = o.encounter_id
  left join public.patients p on p.workspace_id = o.workspace_id and p.id = e.patient_id
  left join public.guardians g on g.workspace_id = o.workspace_id and g.id = e.guardian_id
  where o.workspace_id = p_workspace_id and o.encounter_id = p_encounter_id
    and o.id = any(p_order_ids)
  on conflict (workspace_id, order_id)
  do update set
    assigned_to_user_id = excluded.assigned_to_user_id,
    due_at = excluded.due_at,
    priority = excluded.priority,
    updated_at = v_now;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', item.id,
    'workspaceId', item.workspace_id,
    'encounterId', item.encounter_id,
    'orderId', item.order_id,
    'orderType', item.order_type,
    'queueType', item.queue_type,
    'status', item.status,
    'priority', item.priority,
    'requestedByUserId', item.requested_by_user_id,
    'assignedToUserId', item.assigned_to_user_id,
    'dueAt', item.due_at,
    'completedAt', item.completed_at,
    'cancelledAt', item.cancelled_at,
    'returnedAt', item.returned_at,
    'reason', item.reason,
    'sourceSnapshot', item.source_snapshot,
    'createdAt', item.created_at,
    'updatedAt', item.updated_at
  ) order by item.updated_at desc, item.id), '[]'::jsonb)
    into v_rows
  from public.order_fulfillment_work_items item
  where item.workspace_id = p_workspace_id and item.encounter_id = p_encounter_id
    and item.order_id = any(p_order_ids);
  return v_rows;
end
$$;

revoke all on function public.clair_sync_fulfillment_work_items_from_orders(text,uuid,uuid,uuid[]) from public, anon;
grant execute on function public.clair_sync_fulfillment_work_items_from_orders(text,uuid,uuid,uuid[]) to authenticated;


create or replace function private.clair_assert_billing_surface_permission(
  p_workspace_id text,
  p_surface text,
  p_order_ids uuid[]
)
returns void
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_order_type text;
  v_permission text;
begin
  if p_surface = 'direct' then
    if not private.clair_current_user_has_workspace_permission(p_workspace_id, 'billing:issue') then
      raise exception 'permission_missing';
    end if;
    return;
  end if;
  if p_surface = 'chart' then
    if not private.clair_current_user_has_workspace_permission(p_workspace_id, 'chart:update') then
      raise exception 'permission_missing';
    end if;
    return;
  end if;
  if p_surface <> 'fulfillment' then
    raise exception 'billing_surface_invalid';
  end if;
  for v_order_type in
    select distinct o.order_type
    from public.orders o
    where o.workspace_id = p_workspace_id and o.id = any(p_order_ids)
  loop
    v_permission := case v_order_type
      when 'lab' then 'lab:complete'
      when 'imaging' then 'imaging:complete'
      else 'dispensing:complete'
    end;
    if not private.clair_current_user_has_workspace_permission(p_workspace_id, v_permission) then
      raise exception 'permission_missing';
    end if;
  end loop;
end
$$;

revoke all on function private.clair_assert_billing_surface_permission(text,text,uuid[])
  from public, anon, authenticated;

create or replace function private.clair_sync_billing_invoice_candidates_internal(
  p_workspace_id text,
  p_actor_user_id uuid,
  p_encounter_id uuid,
  p_order_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions, pg_temp
as $$
declare
  v_now timestamptz := now();
  v_selected_count integer := coalesce(array_length(p_order_ids, 1), 0);
  v_matched_count integer;
  v_invoice_id uuid;
  v_anchor_invoice_id uuid;
  v_anchor_status text;
  v_order record;
  v_line record;
  v_line_id uuid;
  v_line_count integer;
  v_billable_order_ids uuid[];
  v_invoice_unit_price numeric;
  v_invoice_line_total numeric;
  v_invoice_line_unit_price numeric;
  v_invoice_line_discount_amount numeric;
  v_invoice_tax_type text;
  v_rows jsonb;
begin
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing';
  end if;
  if p_actor_user_id is distinct from auth.uid() then
    raise exception 'workspace_membership_missing';
  end if;
  if v_selected_count = 0 or v_selected_count > 100 then
    raise exception 'order_unavailable';
  end if;
  if not exists (
    select 1 from public.encounters e
    where e.workspace_id = p_workspace_id and e.id = p_encounter_id and e.status <> 'cancelled'
  ) then
    raise exception 'encounter_unavailable';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('clinical_billing:' || p_workspace_id || ':' || p_encounter_id::text, 0)
  );

  -- Sorted order locks are held before invoice/line locks.
  perform 1
  from public.orders o
  where o.workspace_id = p_workspace_id and o.encounter_id = p_encounter_id
    and o.id = any(p_order_ids) and o.status <> 'cancelled'
  order by o.id
  for update;
  select count(*) into v_matched_count
  from public.orders o
  where o.workspace_id = p_workspace_id and o.encounter_id = p_encounter_id
    and o.id = any(p_order_ids) and o.status <> 'cancelled'
    and o.order_confirmation_status in ('confirmed','billed')
    and o.billing_reflection_enabled = true;
  if v_matched_count <> v_selected_count then
    raise exception 'order_unavailable';
  end if;
  select coalesce(array_agg(o.id order by o.id), '{}'::uuid[])
    into v_billable_order_ids
  from public.orders o
  where o.workspace_id = p_workspace_id
    and o.encounter_id = p_encounter_id
    and o.id = any(p_order_ids)
    and o.status <> 'cancelled'
    and o.order_confirmation_status in ('confirmed','billed')
    and o.billing_reflection_enabled = true;
  if coalesce(array_length(v_billable_order_ids, 1), 0) <> v_selected_count then
    raise exception 'order_unavailable';
  end if;
  -- Invoice candidates are selected from the persisted billable order set;
  -- caller-supplied IDs never widen the frozen billing scope.
  p_order_ids := v_billable_order_ids;

  if exists (
    select 1 from public.orders o
    where o.workspace_id = p_workspace_id and o.encounter_id = p_encounter_id
      and o.id = any(p_order_ids)
      and o.billing_reflection_enabled and o.unit_price_snapshot is null
  ) then
    raise exception 'billable_price_required';
  end if;

  -- Existing anchors define the invoice. A single request may not span
  -- multiple invoices, and an issued/paid invoice cannot accept a new line.
  for v_order in
    select o.*
    from public.orders o
    where o.workspace_id = p_workspace_id and o.encounter_id = p_encounter_id
      and o.id = any(p_order_ids)
    order by o.id
  loop
    if v_order.invoice_line_id is not null then
      select il.*, i.status invoice_status, i.workspace_id invoice_workspace_id,
             i.encounter_id invoice_encounter_id
        into v_line
      from public.invoice_lines il
      join public.invoices i
        on i.workspace_id = il.workspace_id and i.id = il.invoice_id
      where il.workspace_id = p_workspace_id and il.id = v_order.invoice_line_id
      for update;
      if not found or v_line.order_id is distinct from v_order.id
         or v_line.invoice_workspace_id is distinct from p_workspace_id
         or v_line.invoice_encounter_id is distinct from p_encounter_id then
        raise exception 'invoice_anchor_conflict';
      end if;
      if v_anchor_invoice_id is not null and v_anchor_invoice_id is distinct from v_line.invoice_id then
        raise exception 'invoice_anchor_conflict';
      end if;
      v_anchor_invoice_id := v_line.invoice_id;
      v_anchor_status := v_line.invoice_status;
    end if;
  end loop;

  if v_anchor_invoice_id is not null then
    select i.id into v_invoice_id
    from public.invoices i
    where i.workspace_id = p_workspace_id and i.id = v_anchor_invoice_id
    for update;
    if v_anchor_status in ('issued','paid') and exists (
      select 1 from public.orders o
      where o.workspace_id = p_workspace_id and o.encounter_id = p_encounter_id
        and o.id = any(p_order_ids) and o.invoice_line_id is null
    ) then
      raise exception 'invoice_anchor_conflict';
    end if;
  else
    select i.id into v_invoice_id
    from public.invoices i
    where i.workspace_id = p_workspace_id and i.encounter_id = p_encounter_id
      and i.status = 'draft'
    order by i.created_at, i.id
    limit 1
    for update;
    if v_invoice_id is null then
      insert into public.invoices (
        workspace_id, encounter_id, guardian_id, invoice_no, status,
        payment_state, created_at, updated_at
      )
      select e.workspace_id, e.id, e.guardian_id,
        'INV-' || to_char(v_now, 'YYMMDD') || '-'
          || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
        'draft', 'none', v_now, v_now
      from public.encounters e
      where e.workspace_id = p_workspace_id and e.id = p_encounter_id
      returning id into v_invoice_id;
    end if;
  end if;
  if v_invoice_id is null then
    raise exception 'invoice_unavailable';
  end if;

  for v_order in
    select o.*
    from public.orders o
    where o.workspace_id = p_workspace_id and o.encounter_id = p_encounter_id
      and o.id = any(p_order_ids)
    order by o.id
  loop
    if v_order.invoice_line_id is not null then
      continue;
    end if;
    if exists (
      select 1 from public.invoices i
      where i.workspace_id = p_workspace_id and i.id = v_invoice_id
        and i.status in ('issued','paid')
    ) then
      raise exception 'invoice_anchor_conflict';
    end if;
    v_invoice_unit_price := case
      when v_order.applied_price_snapshot ? 'priceKrw'
        then nullif(v_order.applied_price_snapshot->>'priceKrw', '')::numeric
      else v_order.unit_price_snapshot
    end;
    if v_invoice_unit_price is null then
      raise exception 'billable_price_required';
    end if;
    -- Invoice lines retain the order quantity and frozen unit-price
    -- provenance, but the generated amount must equal the persisted A3
    -- calculation result. Derive the line inputs from that result and use a
    -- non-negative rounding adjustment only for the existing generated-line
    -- schema; never recompute the billable amount from the mutable catalog.
    -- Set/range parents persist the parent-only amount in lineTotalKrw while
    -- roundingResultKrw may include explicit-extra child subtotal. Prefer the
    -- persisted line-total fields so a parent is billed once; A3 individual
    -- rows retain their rounded line-total snapshot and use roundingResultKrw
    -- only as the older individual fallback.
    v_invoice_line_total := coalesce(
      nullif(v_order.calculation_outputs->>'lineTotalKrw', '')::numeric,
      nullif(v_order.applied_price_snapshot->>'lineTotalKrw', '')::numeric,
      nullif(v_order.calculation_outputs->>'lineTotalSnapshot', '')::numeric,
      nullif(v_order.applied_price_snapshot->>'lineTotalSnapshot', '')::numeric,
      nullif(v_order.applied_snapshot->>'lineTotalSnapshot', '')::numeric,
      nullif(v_order.calculation_outputs->>'roundingResultKrw', '')::numeric,
      nullif(v_order.applied_price_snapshot->>'roundingResultKrw', '')::numeric,
      v_order.line_total_snapshot
    );
    if v_invoice_line_total is null or v_invoice_line_total < 0 then
      raise exception 'frozen_amount_missing';
    end if;
    v_invoice_line_unit_price := v_invoice_unit_price;
    if (v_invoice_line_unit_price * v_order.quantity)::numeric(12,2)
        < v_invoice_line_total then
      v_invoice_line_unit_price := (
        ceil((v_invoice_line_total / v_order.quantity) * 100) / 100
      )::numeric(12,2);
    end if;
    v_invoice_line_discount_amount := (
      v_invoice_line_unit_price * v_order.quantity - v_invoice_line_total
    )::numeric(12,2);
    if v_invoice_line_discount_amount < 0 then
      raise exception 'frozen_amount_unrepresentable';
    end if;
    v_invoice_tax_type := coalesce(
      nullif(v_order.applied_price_snapshot->>'taxType', ''),
      nullif(v_order.calculation_outputs->>'taxType', ''),
      nullif(v_order.applied_snapshot->>'taxType', '')
    );
    if v_invoice_tax_type is null then
      if v_order.workspace_catalog_item_id is not null then
        raise exception 'frozen_tax_missing';
      end if;
      -- Legacy rows predate A3's frozen tax fields; preserve their existing
      -- taxable compatibility while never consulting mutable catalog data.
      v_invoice_tax_type := 'taxable';
    end if;
    if v_invoice_tax_type not in ('taxable', 'non_taxable') then
      raise exception 'frozen_tax_invalid';
    end if;
    insert into public.invoice_lines (
      workspace_id, invoice_id, service_item_id, order_id, description,
      quantity, unit_price, discount_amount, billing_candidate_id, billing_name_snapshot,
      source_order_snapshot, tax_type, created_at, updated_at
    )
    values (
      p_workspace_id, v_invoice_id, v_order.service_item_id, v_order.id,
      coalesce(nullif(btrim(v_order.billing_display_name), ''), v_order.display_name),
      v_order.quantity, v_invoice_line_unit_price, v_invoice_line_discount_amount,
      coalesce(v_order.billing_candidate_id, 'billcand-' || v_order.id::text),
      coalesce(nullif(btrim(v_order.billing_display_name), ''), v_order.display_name),
      jsonb_build_object(
        'orderId', v_order.id,
        'workspaceId', v_order.workspace_id,
        'encounterId', v_order.encounter_id,
        'displayName', v_order.display_name,
        'billingDisplayName', v_order.billing_display_name,
        'serviceItemId', v_order.service_item_id,
        'workspaceCatalogItemId', v_order.workspace_catalog_item_id,
        'sourceMasterRecordId', v_order.source_master_record_id,
        'sourceMasterRevision', v_order.source_master_revision,
        'workspaceCatalogRevision', v_order.workspace_catalog_revision,
        'sourceOrderId', v_order.source_order_id,
        'sourceOrderVersion', v_order.source_order_version,
        'sourceSetId', v_order.source_set_id,
        'sourceSetVersion', v_order.source_set_version,
        'setItemId', v_order.set_item_id,
        'parentChartOrderLineId', v_order.parent_chart_order_line_id,
        'rowDepth', v_order.row_depth,
        'rowType', v_order.row_type,
        'orderType', v_order.order_type,
        'sourceSetRevisionId', to_jsonb(v_order)->'source_set_revision_id',
        'sourceSetRevisionNo', to_jsonb(v_order)->'source_set_revision_no',
        'sourceSetRevisionItemId', to_jsonb(v_order)->'source_set_revision_item_id',
        'appliedSnapshotSchemaVersion', to_jsonb(v_order)->'applied_snapshot_schema_version',
        'appliedSnapshotSha256', to_jsonb(v_order)->'applied_snapshot_sha256',
        'appliedSnapshot', v_order.applied_snapshot,
        'appliedPriceSnapshot', v_order.applied_price_snapshot,
        'quantity', v_order.quantity,
        'unitPriceSnapshot', v_invoice_unit_price,
        'lineTotalSnapshot', to_jsonb(v_invoice_line_total),
        'invoiceLineUnitPrice', v_invoice_line_unit_price,
        'invoiceLineDiscountAmount', v_invoice_line_discount_amount,
        'roundingRule', coalesce(
          v_order.applied_price_snapshot->>'roundingRule',
          v_order.calculation_outputs->>'roundingRule'
        ),
        'roundingResultKrw', coalesce(
          v_order.applied_price_snapshot->'roundingResultKrw',
          v_order.calculation_outputs->'roundingResultKrw'
        ),
        'taxType', v_invoice_tax_type,
        'calculationInputs', v_order.calculation_inputs,
        'calculationOutputs', v_order.calculation_outputs,
        'billingCategory', v_order.applied_snapshot->>'billingCategory',
        'categoryGroup', v_order.applied_snapshot->>'categoryGroup',
        'snapshotSource', case when v_order.workspace_catalog_item_id is not null
          then 'order_catalog_items' else 'legacy_compatibility' end
      ),
      v_invoice_tax_type,
      v_now, v_now
    )
    returning id into v_line_id;
    if not exists (
      select 1
      from public.invoice_lines il
      where il.workspace_id = p_workspace_id
        and il.id = v_line_id
        and il.line_total = v_invoice_line_total
    ) then
      raise exception 'frozen_amount_unrepresentable';
    end if;

    update public.orders o
    set invoice_line_id = v_line_id,
        billing_candidate_status = 'invoice_linked',
        billing_candidate_id = coalesce(o.billing_candidate_id, 'billcand-' || o.id::text),
        order_confirmation_status = case when o.order_confirmation_status = 'confirmed'
          then 'billed' else o.order_confirmation_status end,
        updated_at = v_now
    where o.workspace_id = p_workspace_id and o.id = v_order.id
      and o.invoice_line_id is null;
  end loop;

  update public.invoices i
  set subtotal_amount = totals.subtotal_amount,
      total_amount = greatest(totals.subtotal_amount - i.discount_amount + i.tax_amount, 0),
      updated_at = v_now
  from (
    select coalesce(sum(il.line_total), 0) subtotal_amount
    from public.invoice_lines il
    where il.workspace_id = p_workspace_id and il.invoice_id = v_invoice_id
  ) totals
  where i.workspace_id = p_workspace_id and i.id = v_invoice_id
    and i.status = 'draft';

  insert into public.order_events (
    workspace_id, order_id, event_type, performed_by_user_id, payload, created_at
  )
  select p_workspace_id, o.id, 'edited', p_actor_user_id,
    jsonb_build_object(
      'action', 'billing_invoice_candidate_sync',
      'invoiceId', o.invoice_line_id,
      'snapshotSource', case when o.workspace_catalog_item_id is not null
        then 'order_catalog_items' else 'legacy_compatibility' end
    ),
    v_now
  from public.orders o
  where o.workspace_id = p_workspace_id and o.id = any(p_order_ids);

  select coalesce(jsonb_agg(jsonb_build_object(
    'billingCandidateId', il.billing_candidate_id,
    'description', il.description,
    'invoiceId', il.invoice_id,
    'lineTotal', il.line_total,
    'orderId', il.order_id,
    'quantity', il.quantity,
    'syncedAt', il.updated_at,
    'unitPrice', il.unit_price,
    'serviceItemId', il.service_item_id,
    'workspaceCatalogItemId', il.source_order_snapshot->>'workspaceCatalogItemId',
    'sourceMasterRecordId', il.source_order_snapshot->>'sourceMasterRecordId',
    'sourceMasterRevision', nullif(il.source_order_snapshot->>'sourceMasterRevision','')::integer,
    'workspaceCatalogRevision', nullif(il.source_order_snapshot->>'workspaceCatalogRevision','')::integer,
    'categoryGroup', il.source_order_snapshot->>'categoryGroup',
    'billingCategory', il.source_order_snapshot->>'billingCategory',
    'sourceOrderSnapshot', il.source_order_snapshot
  ) order by il.created_at, il.id), '[]'::jsonb)
  into v_rows
  from public.invoice_lines il
  where il.workspace_id = p_workspace_id and il.invoice_id = v_invoice_id
    and il.order_id = any(p_order_ids);
  return v_rows;
end
$$;

create or replace function public.clair_sync_billing_invoice_candidates(
  p_workspace_id text,
  p_actor_user_id uuid,
  p_encounter_id uuid,
  p_order_ids uuid[]
)
returns jsonb
language plpgsql security definer
set search_path = public, private, extensions, pg_temp
as $$
begin
  perform private.clair_assert_billing_surface_permission(
    p_workspace_id, 'direct', p_order_ids
  );
  return private.clair_sync_billing_invoice_candidates_internal(
    p_workspace_id, p_actor_user_id, p_encounter_id, p_order_ids
  );
end
$$;

create or replace function public.clair_sync_billing_invoice_candidates_from_chart(
  p_workspace_id text,
  p_actor_user_id uuid,
  p_encounter_id uuid,
  p_order_ids uuid[]
)
returns jsonb
language plpgsql security definer
set search_path = public, private, extensions, pg_temp
as $$
begin
  perform private.clair_assert_billing_surface_permission(
    p_workspace_id, 'chart', p_order_ids
  );
  return private.clair_sync_billing_invoice_candidates_internal(
    p_workspace_id, p_actor_user_id, p_encounter_id, p_order_ids
  );
end
$$;

create or replace function public.clair_sync_billing_invoice_candidates_from_fulfillment(
  p_workspace_id text,
  p_actor_user_id uuid,
  p_encounter_id uuid,
  p_order_ids uuid[]
)
returns jsonb
language plpgsql security definer
set search_path = public, private, extensions, pg_temp
as $$
declare
  v_selected_count integer := coalesce(array_length(p_order_ids, 1), 0);
  v_order_count integer;
  v_matched_count integer;
begin
  if p_actor_user_id is distinct from auth.uid() then
    raise exception 'workspace_membership_missing';
  end if;
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing';
  end if;
  if v_selected_count = 0 or v_selected_count > 100 then
    raise exception 'order_unavailable';
  end if;

  -- Fulfillment billing uses the same canonical sequence as sync and the
  -- private invoice helper: advisory, sorted order rows, then work items.
  -- The private helper re-enters the first two transaction locks only after
  -- this wrapper has finished its exact work-item verification, so no caller
  -- can acquire work-item before order locks in the cross-RPC race.
  perform pg_advisory_xact_lock(
    hashtextextended('clinical_billing:' || p_workspace_id || ':' || p_encounter_id::text, 0)
  );
  perform 1
  from public.orders o
  where o.workspace_id = p_workspace_id
    and o.encounter_id = p_encounter_id
    and o.id = any(p_order_ids)
  order by o.id
  for update;
  select count(*)
    into v_order_count
  from public.orders o
  where o.workspace_id = p_workspace_id
    and o.encounter_id = p_encounter_id
    and o.id = any(p_order_ids);
  if v_order_count <> v_selected_count then
    raise exception 'work_item_unavailable';
  end if;

  -- Fulfillment billing is allowed only for the exact, completed queue item
  -- belonging to this workspace/encounter/order set. Lock those rows only
  -- after the canonical advisory/order locks and before the private helper.
  perform 1
  from public.order_fulfillment_work_items item
  join public.orders o
    on o.workspace_id = item.workspace_id
   and o.encounter_id = item.encounter_id
   and o.id = item.order_id
  where item.workspace_id = p_workspace_id
    and item.encounter_id = p_encounter_id
    and item.order_id = any(p_order_ids)
    and item.status = 'completed'
    and item.queue_type = item.order_type
    and item.order_type = o.order_type
    and item.order_type in ('lab', 'imaging', 'dispensing', 'treatment')
  order by item.order_id
  for update of item;
  select count(*)
    into v_matched_count
  from public.order_fulfillment_work_items item
  join public.orders o
    on o.workspace_id = item.workspace_id
   and o.encounter_id = item.encounter_id
   and o.id = item.order_id
  where item.workspace_id = p_workspace_id
    and item.encounter_id = p_encounter_id
    and item.order_id = any(p_order_ids)
    and item.status = 'completed'
    and item.queue_type = item.order_type
    and item.order_type = o.order_type
    and item.order_type in ('lab', 'imaging', 'dispensing', 'treatment');
  if v_matched_count <> v_selected_count then
    raise exception 'work_item_unavailable';
  end if;

  perform private.clair_assert_billing_surface_permission(
    p_workspace_id, 'fulfillment', p_order_ids
  );
  return private.clair_sync_billing_invoice_candidates_internal(
    p_workspace_id, p_actor_user_id, p_encounter_id, p_order_ids
  );
end
$$;

revoke all on function private.clair_sync_billing_invoice_candidates_internal(text,uuid,uuid,uuid[])
  from public, anon, authenticated;
revoke all on function public.clair_sync_billing_invoice_candidates(text,uuid,uuid,uuid[])
  from public, anon;
revoke all on function public.clair_sync_billing_invoice_candidates_from_chart(text,uuid,uuid,uuid[])
  from public, anon;
revoke all on function public.clair_sync_billing_invoice_candidates_from_fulfillment(text,uuid,uuid,uuid[])
  from public, anon;
grant execute on function public.clair_sync_billing_invoice_candidates(text,uuid,uuid,uuid[]) to authenticated;
grant execute on function public.clair_sync_billing_invoice_candidates_from_chart(text,uuid,uuid,uuid[]) to authenticated;
grant execute on function public.clair_sync_billing_invoice_candidates_from_fulfillment(text,uuid,uuid,uuid[]) to authenticated;

create or replace function public.clair_list_billing_invoice_candidates(
  p_workspace_id text,
  p_encounter_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions, pg_temp
as $$
declare
  v_rows jsonb;
begin
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing';
  end if;
  if not exists (
    select 1 from public.encounters e
    where e.workspace_id = p_workspace_id and e.id = p_encounter_id and e.status <> 'cancelled'
  ) then
    raise exception 'encounter_unavailable';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'billingCandidateId', il.billing_candidate_id,
    'description', il.description,
    'invoiceId', il.invoice_id,
    'lineTotal', il.line_total,
    'orderId', il.order_id,
    'quantity', il.quantity,
    'syncedAt', il.updated_at,
    'unitPrice', il.unit_price,
    'serviceItemId', il.service_item_id,
    'workspaceCatalogItemId', il.source_order_snapshot->>'workspaceCatalogItemId',
    'sourceMasterRecordId', il.source_order_snapshot->>'sourceMasterRecordId',
    'sourceMasterRevision', nullif(il.source_order_snapshot->>'sourceMasterRevision','')::integer,
    'workspaceCatalogRevision', nullif(il.source_order_snapshot->>'workspaceCatalogRevision','')::integer,
    'categoryGroup', il.source_order_snapshot->>'categoryGroup',
    'billingCategory', il.source_order_snapshot->>'billingCategory',
    'sourceOrderSnapshot', il.source_order_snapshot
  ) order by il.created_at, il.id), '[]'::jsonb)
  into v_rows
  from public.invoice_lines il
  join public.invoices i on i.workspace_id = il.workspace_id and i.id = il.invoice_id
  where il.workspace_id = p_workspace_id and i.encounter_id = p_encounter_id
    and il.order_id is not null
    and il.billing_candidate_id is not null;
  return v_rows;
end
$$;

revoke all on function public.clair_list_billing_invoice_candidates(text,uuid) from public, anon;
grant execute on function public.clair_list_billing_invoice_candidates(text,uuid) to authenticated;


create or replace function public.clair_get_billing_invoice_lines(
  p_workspace_id text,
  p_invoice_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions, pg_temp
as $$
declare
  v_payload jsonb;
begin
  if not private.clair_is_active_workspace_member(p_workspace_id) then
    raise exception 'workspace_membership_missing';
  end if;
  if not exists (
    select 1
    from public.invoices i
    join public.encounters e
      on e.workspace_id = i.workspace_id and e.id = i.encounter_id
    where i.workspace_id = p_workspace_id and i.id = p_invoice_id and e.status <> 'cancelled'
  ) then
    raise exception 'invoice_unavailable';
  end if;
  select jsonb_build_object(
    'invoice', jsonb_build_object(
      'id', i.id, 'workspaceId', i.workspace_id, 'encounterId', i.encounter_id,
      'guardianId', i.guardian_id, 'invoiceNo', i.invoice_no, 'status', i.status,
      'subtotalAmount', i.subtotal_amount, 'discountAmount', i.discount_amount,
      'taxAmount', i.tax_amount, 'totalAmount', i.total_amount,
      'issuedAt', i.issued_at, 'issuedByUserId', i.issued_by_user_id,
      'createdAt', i.created_at
    ),
    'lines', coalesce(jsonb_agg(jsonb_build_object(
      'id', il.id,
      'invoiceId', il.invoice_id,
      'serviceItemId', il.service_item_id,
      'orderId', il.order_id,
      'description', il.description,
      'quantity', il.quantity,
      'unitPrice', il.unit_price,
      'lineTotal', il.line_total,
      'billingNameSnapshot', il.billing_name_snapshot,
      'sourceOrderSnapshot', il.source_order_snapshot,
      'workspaceCatalogItemId', il.source_order_snapshot->>'workspaceCatalogItemId',
      'sourceMasterRecordId', il.source_order_snapshot->>'sourceMasterRecordId',
      'sourceMasterRevision', nullif(il.source_order_snapshot->>'sourceMasterRevision','')::integer,
      'workspaceCatalogRevision', nullif(il.source_order_snapshot->>'workspaceCatalogRevision','')::integer,
      'categoryGroup', il.source_order_snapshot->>'categoryGroup',
      'billingCategory', il.source_order_snapshot->>'billingCategory',
      'taxType', il.tax_type,
      'nonTaxReason', il.non_tax_reason
    ) order by il.created_at, il.id) filter (where il.id is not null), '[]'::jsonb)
  )
  into v_payload
  from public.invoices i
  left join public.invoice_lines il
    on il.workspace_id = i.workspace_id and il.invoice_id = i.id
  where i.workspace_id = p_workspace_id and i.id = p_invoice_id
  group by i.id;
  return v_payload;
end
$$;

revoke all on function public.clair_get_billing_invoice_lines(text,uuid) from public, anon;
grant execute on function public.clair_get_billing_invoice_lines(text,uuid) to authenticated;
