-- DEN-100: chart-applied order snapshot bridge.
-- Local-first draft only. Hospital-admin order catalog CRUD remains a separate project.

alter table public.orders
  add column if not exists row_type text not null default 'individual',
  add column if not exists source_order_id text,
  add column if not exists source_order_version text,
  add column if not exists source_set_id text,
  add column if not exists source_set_version text,
  add column if not exists set_item_id text,
  add column if not exists parent_chart_order_line_id uuid,
  add column if not exists row_depth integer not null default 0,
  add column if not exists applied_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists applied_price_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists calculation_inputs jsonb not null default '{}'::jsonb,
  add column if not exists calculation_outputs jsonb not null default '{}'::jsonb,
  add column if not exists quantity_source text not null default 'manual',
  add column if not exists price_rule_source text not null default 'manual',
  add column if not exists billing_reflection_enabled boolean not null default true,
  add column if not exists order_confirmation_status text not null default 'draft',
  add column if not exists billing_candidate_status text not null default 'not_requested',
  add column if not exists billing_candidate_id text,
  add column if not exists invoice_line_id uuid,
  add column if not exists task_status text;

alter table public.invoice_lines
  add column if not exists billing_candidate_id text,
  add column if not exists billing_name_snapshot text,
  add column if not exists source_order_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists tax_type text not null default 'non_taxable',
  add column if not exists non_tax_reason text,
  add column if not exists discount_adjustment_reason text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_row_type_check'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_row_type_check
      check (row_type in ('individual', 'set', 'set_child', 'temporary'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_snapshot_json_check'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_snapshot_json_check
      check (
        jsonb_typeof(applied_snapshot) = 'object'
        and jsonb_typeof(applied_price_snapshot) = 'object'
        and jsonb_typeof(calculation_inputs) = 'object'
        and jsonb_typeof(calculation_outputs) = 'object'
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_chart_row_hierarchy_check'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_chart_row_hierarchy_check
      check (
        row_depth >= 0
        and (row_type <> 'set_child' or parent_chart_order_line_id is not null)
        and (row_type <> 'set_child' or source_set_id is not null)
        and (row_type <> 'set_child' or set_item_id is not null)
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_quantity_source_check'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_quantity_source_check
      check (
        quantity_source in (
          'manual',
          'days',
          'total_count',
          'dispense_quantity',
          'actual_dispense_quantity',
          'fixed_one'
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_price_rule_source_check'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_price_rule_source_check
      check (
        price_rule_source in (
          'manual',
          'preset_price',
          'per_day',
          'per_frequency',
          'per_each',
          'per_ml',
          'per_kg',
          'set_fixed_price',
          'included_order_sum',
          'range_price'
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_confirmation_status_check'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_confirmation_status_check
      check (order_confirmation_status in ('draft', 'pending', 'confirmed', 'billed', 'cancelled'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_billing_candidate_status_check'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_billing_candidate_status_check
      check (
        billing_candidate_status in (
          'not_requested',
          'candidate_created',
          'invoice_linked',
          'billing_cancelled'
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_task_status_check'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_task_status_check
      check (
        task_status is null
        or task_status in (
          'pending',
          'in_progress',
          'partial_complete',
          'complete',
          'cancelled',
          're_requested',
          'paused'
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_parent_chart_line_workspace_fk'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_parent_chart_line_workspace_fk
      foreign key (workspace_id, parent_chart_order_line_id) references public.orders(workspace_id, id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_invoice_line_workspace_fk'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_invoice_line_workspace_fk
      foreign key (workspace_id, invoice_line_id) references public.invoice_lines(workspace_id, id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'invoice_lines_source_order_snapshot_json_check'
      and conrelid = 'public.invoice_lines'::regclass
  ) then
    alter table public.invoice_lines
      add constraint invoice_lines_source_order_snapshot_json_check
      check (jsonb_typeof(source_order_snapshot) = 'object');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'invoice_lines_tax_type_check'
      and conrelid = 'public.invoice_lines'::regclass
  ) then
    alter table public.invoice_lines
      add constraint invoice_lines_tax_type_check
      check (tax_type in ('taxable', 'non_taxable'));
  end if;
end $$;

create index if not exists orders_workspace_parent_sort_idx
  on public.orders (workspace_id, parent_chart_order_line_id, sort_order)
  where parent_chart_order_line_id is not null;

create index if not exists orders_workspace_row_type_idx
  on public.orders (workspace_id, row_type, sort_order);

create index if not exists orders_workspace_source_order_idx
  on public.orders (workspace_id, source_order_id)
  where source_order_id is not null;

create index if not exists orders_workspace_source_set_idx
  on public.orders (workspace_id, source_set_id, set_item_id)
  where source_set_id is not null;

create index if not exists orders_workspace_billing_candidate_status_idx
  on public.orders (workspace_id, billing_candidate_status, billing_candidate_id)
  where billing_candidate_status <> 'not_requested';

create index if not exists orders_workspace_invoice_line_idx
  on public.orders (workspace_id, invoice_line_id)
  where invoice_line_id is not null;

comment on column public.orders.row_type is
  'Chart-applied row type: individual order, set parent, set child, or temporary demo row.';
comment on column public.orders.applied_snapshot is
  'Frozen catalog/set values copied when the order row is applied to the chart.';
comment on column public.orders.applied_price_snapshot is
  'Frozen price rule values used for server-side billing recalculation.';
comment on column public.orders.calculation_inputs is
  'Source values such as days, frequency, dose basis, quantity source, and manual adjustment inputs.';
comment on column public.orders.calculation_outputs is
  'Server-derived display values such as total count, line subtotal, adjustment, and billing amount.';
comment on column public.orders.billing_reflection_enabled is
  'Whether this chart-applied row contributes to invoice candidate generation.';
comment on column public.orders.order_confirmation_status is
  'Order confirmation lifecycle stored separately from billing candidate lifecycle.';
comment on column public.orders.billing_candidate_status is
  'Billing handoff lifecycle stored separately from order confirmation.';
