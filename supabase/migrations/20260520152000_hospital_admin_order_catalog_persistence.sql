-- Project 07: hospital-admin order catalog persistence foundation.
-- Local-first draft only. Remote Supabase application and production deploy are out of scope.

create table if not exists public.order_catalog_items (
  id text primary key,
  workspace_id text not null references public.workspaces(id) on delete cascade,
  standard_order_id text not null,
  source_preset_version text not null,
  category_group text not null
    check (category_group in ('consultation', 'medication', 'treatment', 'lab', 'imaging', 'hospitalization', 'misc')),
  category_label text not null check (length(trim(category_label)) > 0),
  t_code text,
  t_code_label text,
  standard_order_name text not null check (length(trim(standard_order_name)) > 0),
  in_hospital_order_name text not null check (length(trim(in_hospital_order_name)) > 0),
  billing_name text not null check (length(trim(billing_name)) > 0),
  aliases text[] not null default '{}',
  availability_status text not null default 'active'
    check (availability_status in ('active', 'paused', 'inactive')),
  price_krw integer not null default 0 check (price_krw >= 0),
  sales_unit text not null default 'per_each'
    check (sales_unit in ('per_order', 'per_each', 'per_day', 'per_frequency', 'per_ml', 'per_kg')),
  target_species text[] not null default '{dog,cat,other}',
  default_destination_module text not null
    check (default_destination_module in ('lab', 'imaging', 'dispensing', 'treatment', 'billing_only', 'chart_only')),
  default_task_required boolean not null default true,
  billing_reflection_enabled boolean not null default true,
  care_guide text,
  care_guide_delivery_enabled boolean not null default false,
  internal_instruction text,
  internal_instruction_delivery_enabled boolean not null default false,
  tax_included boolean not null default true,
  rounding_rule text not null default 'as_is',
  pricing_rule jsonb not null default '{}'::jsonb check (jsonb_typeof(pricing_rule) = 'object'),
  medication_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(medication_metadata) = 'object'),
  vaccine_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(vaccine_metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_sets (
  id text primary key,
  workspace_id text not null references public.workspaces(id) on delete cascade,
  source_set_version text not null,
  set_category text,
  set_name text not null check (length(trim(set_name)) > 0),
  billing_name text not null check (length(trim(billing_name)) > 0),
  availability_status text not null default 'active'
    check (availability_status in ('active', 'paused', 'inactive')),
  amount_basis text not null
    check (amount_basis in ('set_fixed_price', 'included_order_sum', 'range_price')),
  set_price_krw integer not null default 0 check (set_price_krw >= 0),
  sales_unit text not null default 'per_each',
  billing_reflection_enabled boolean not null default true,
  target_species text[] not null default '{dog,cat,other}',
  care_guide text,
  internal_instruction text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_set_items (
  id text primary key,
  workspace_id text not null references public.workspaces(id) on delete cascade,
  order_set_id text not null references public.order_sets(id) on delete cascade,
  child_order_id text not null references public.order_catalog_items(id) on delete restrict,
  sort_order integer not null default 0,
  default_selected boolean not null default true,
  billing_reflection_default boolean not null default true,
  default_quantity numeric(12,3) not null default 1 check (default_quantity > 0),
  quantity_source text not null default 'fixed_one'
    check (quantity_source in ('fixed_one', 'preset_quantity', 'manual_at_apply')),
  unit_price_snapshot_krw integer not null default 0 check (unit_price_snapshot_krw >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.lab_test_categories (
  id text primary key,
  workspace_id text not null references public.workspaces(id) on delete cascade,
  category_name text not null check (length(trim(category_name)) > 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lab_test_items (
  id text primary key,
  workspace_id text not null references public.workspaces(id) on delete cascade,
  category_id text not null references public.lab_test_categories(id) on delete restrict,
  test_item_name text not null check (length(trim(test_item_name)) > 0),
  result_input_type text not null
    check (result_input_type in ('number', 'text', 'select', 'positive_negative', 'grade')),
  result_unit text,
  sort_order integer not null default 0,
  availability_status text not null default 'active'
    check (availability_status in ('active', 'paused', 'inactive')),
  saved_result_usage_count integer not null default 0 check (saved_result_usage_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_catalog_lab_test_item_links (
  id text primary key,
  workspace_id text not null references public.workspaces(id) on delete cascade,
  order_catalog_item_id text not null references public.order_catalog_items(id) on delete cascade,
  lab_test_item_id text references public.lab_test_items(id) on delete restrict,
  lab_test_category_id text references public.lab_test_categories(id) on delete restrict,
  sort_order integer not null default 0,
  snapshot_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(snapshot_metadata) = 'object'),
  created_at timestamptz not null default now(),
  check (lab_test_item_id is not null or lab_test_category_id is not null)
);

create or replace view public.order_catalog_chart_search as
select
  'individual'::text as row_type,
  id as source_preset_id,
  source_preset_version,
  in_hospital_order_name as display_name,
  billing_name,
  category_group,
  target_species,
  jsonb_build_object(
    'sourcePresetId', standard_order_id,
    'sourcePresetVersion', source_preset_version,
    'appliedDisplayName', in_hospital_order_name,
    'appliedBillingName', billing_name,
    'appliedPriceKrw', price_krw,
    'appliedSalesUnit', sales_unit,
    'appliedTaxIncluded', tax_included,
    'appliedAmountBasis', pricing_rule ->> 'priceBasis',
    'billingReflectionEnabled', billing_reflection_enabled
  ) as applied_snapshot
from public.order_catalog_items
where availability_status = 'active'
union all
select
  'set'::text as row_type,
  id as source_preset_id,
  source_set_version,
  set_name as display_name,
  billing_name,
  'set'::text as category_group,
  target_species,
  jsonb_build_object(
    'sourcePresetId', id,
    'sourcePresetVersion', source_set_version,
    'appliedDisplayName', set_name,
    'appliedBillingName', billing_name,
    'appliedPriceKrw', set_price_krw,
    'appliedSalesUnit', sales_unit,
    'appliedTaxIncluded', true,
    'appliedAmountBasis', amount_basis,
    'billingReflectionEnabled', billing_reflection_enabled
  ) as applied_snapshot
from public.order_sets
where availability_status = 'active';

create or replace view public.lab_test_item_delete_locks as
select
  item.workspace_id,
  item.id as lab_test_item_id,
  count(link.id)::integer as linked_order_count,
  item.saved_result_usage_count,
  (count(link.id) > 0 or item.saved_result_usage_count > 0) as delete_locked
from public.lab_test_items item
left join public.order_catalog_lab_test_item_links link
  on link.workspace_id = item.workspace_id
 and link.lab_test_item_id = item.id
group by item.workspace_id, item.id, item.saved_result_usage_count;

create index if not exists order_catalog_items_workspace_status_idx
  on public.order_catalog_items (workspace_id, availability_status, category_group);

create index if not exists order_set_items_workspace_set_sort_idx
  on public.order_set_items (workspace_id, order_set_id, sort_order);

create index if not exists lab_test_items_workspace_category_sort_idx
  on public.lab_test_items (workspace_id, category_id, sort_order);
