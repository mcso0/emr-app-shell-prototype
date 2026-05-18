-- DEN-68: clinical/order/billing schema foundation.
-- Local-first draft only. Remote Supabase application and final domain RLS policy details are follow-up scopes.

create table if not exists public.service_categories (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.workspaces(id) on delete cascade,
  parent_id uuid references public.service_categories(id) on delete set null,
  name text not null check (length(trim(name)) > 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.service_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.workspaces(id) on delete cascade,
  category_id uuid references public.service_categories(id) on delete set null,
  name text not null check (length(trim(name)) > 0),
  item_type text not null
    check (item_type in ('consultation', 'medication', 'treatment', 'lab', 'imaging', 'hospitalization', 'misc')),
  description text,
  default_duration_minutes integer check (default_duration_minutes is null or default_duration_minutes > 0),
  is_orderable boolean not null default true,
  is_billable boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.service_item_prices (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.workspaces(id) on delete cascade,
  service_item_id uuid not null references public.service_items(id) on delete cascade,
  price numeric(12,2) not null check (price >= 0),
  currency text not null default 'KRW' check (currency = 'KRW'),
  effective_from date not null,
  effective_to date,
  created_at timestamptz not null default now(),
  check (effective_to is null or effective_to > effective_from)
);

create table if not exists public.soap_notes (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.workspaces(id) on delete cascade,
  encounter_id uuid not null references public.encounters(id) on delete cascade,
  author_user_id uuid references public.users(id) on delete set null,
  subjective text,
  objective text,
  assessment text,
  plan text,
  status text not null default 'draft'
    check (status in ('draft', 'autosaved', 'signed', 'amended', 'voided')),
  autosaved_at timestamptz,
  signed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.soap_note_revisions (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.workspaces(id) on delete cascade,
  soap_note_id uuid not null references public.soap_notes(id) on delete cascade,
  revision_no integer not null check (revision_no > 0),
  changed_by_user_id uuid references public.users(id) on delete set null,
  change_reason text,
  snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(snapshot) = 'object'),
  created_at timestamptz not null default now()
);

create table if not exists public.diagnosis_catalog (
  id uuid primary key default gen_random_uuid(),
  workspace_id text references public.workspaces(id) on delete cascade,
  code text,
  name text not null check (length(trim(name)) > 0),
  species text,
  synonyms text[],
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.diagnoses (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.workspaces(id) on delete cascade,
  encounter_id uuid not null references public.encounters(id) on delete cascade,
  diagnosis_catalog_id uuid references public.diagnosis_catalog(id) on delete set null,
  diagnosis_text text not null check (length(trim(diagnosis_text)) > 0),
  diagnosis_type text not null default 'suspected'
    check (diagnosis_type in ('suspected', 'confirmed', 'differential')),
  is_primary boolean not null default false,
  sort_order integer not null default 0,
  created_by_user_id uuid references public.users(id) on delete set null,
  updated_by_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_groups (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.workspaces(id) on delete cascade,
  encounter_id uuid not null references public.encounters(id) on delete cascade,
  group_type text not null
    check (group_type in ('dispensing', 'treatment', 'lab', 'imaging', 'mixed')),
  title text not null check (length(trim(title)) > 0),
  label text,
  status text not null default 'requested'
    check (status in ('requested', 'in_progress', 'completed', 'cancelled')),
  priority text not null default 'normal'
    check (priority in ('urgent', 'high', 'normal', 'low')),
  sort_order integer not null default 0,
  created_by_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.workspaces(id) on delete cascade,
  encounter_id uuid not null references public.encounters(id) on delete cascade,
  order_group_id uuid references public.order_groups(id) on delete set null,
  service_item_id uuid references public.service_items(id) on delete set null,
  order_type text not null
    check (order_type in ('dispensing', 'treatment', 'lab', 'imaging')),
  display_name text not null check (length(trim(display_name)) > 0),
  billing_display_name text,
  status text not null default 'draft'
    check (status in ('draft', 'confirmed', 'requested', 're_requested', 'in_progress', 'ready_for_billing', 'completed', 'cancelled')),
  work_status text not null default 'pending'
    check (work_status in ('pending', 'completed')),
  priority text not null default 'normal'
    check (priority in ('urgent', 'high', 'normal', 'low')),
  quantity numeric(12,2) not null default 1 check (quantity > 0),
  unit_price_snapshot numeric(12,2) check (unit_price_snapshot is null or unit_price_snapshot >= 0),
  line_total_snapshot numeric(12,2) generated always as (quantity * coalesce(unit_price_snapshot, 0)) stored,
  requested_by_user_id uuid references public.users(id) on delete set null,
  requested_at timestamptz,
  confirmed_by_user_id uuid references public.users(id) on delete set null,
  confirmed_at timestamptz,
  due_at timestamptz,
  current_assignee_user_id uuid references public.users(id) on delete set null,
  instruction text,
  warning_message text,
  cancellation_reason text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'cancelled' or cancellation_reason is not null),
  check (status <> 'requested' or requested_at is not null)
);

create table if not exists public.order_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.workspaces(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  event_type text not null
    check (event_type in ('requested', 'sent', 'assigned', 'started', 'completed', 'cancelled', 'edited', 'result_entered')),
  performed_by_user_id uuid references public.users(id) on delete set null,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now()
);

create table if not exists public.order_revisions (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.workspaces(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  revision_no integer not null check (revision_no > 0),
  reason text,
  created_by_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.order_revision_fields (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.workspaces(id) on delete cascade,
  order_revision_id uuid not null references public.order_revisions(id) on delete cascade,
  field_name text not null check (length(trim(field_name)) > 0),
  previous_value jsonb,
  current_value jsonb
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.workspaces(id) on delete cascade,
  encounter_id uuid not null references public.encounters(id) on delete cascade,
  guardian_id uuid references public.guardians(id) on delete set null,
  invoice_no text not null check (length(trim(invoice_no)) > 0),
  status text not null default 'draft'
    check (status in ('draft', 'issued', 'paid', 'refund_requested', 'refunded', 'voided')),
  payment_state text not null default 'none'
    check (payment_state in ('none', 'unpaid', 'paid', 'failed', 'refunded')),
  selected_payment_method text
    check (selected_payment_method is null or selected_payment_method in ('card', 'cash', 'transfer', 'other')),
  unpaid_reason text,
  subtotal_amount numeric(12,2) not null default 0 check (subtotal_amount >= 0),
  discount_amount numeric(12,2) not null default 0 check (discount_amount >= 0),
  tax_amount numeric(12,2) not null default 0 check (tax_amount >= 0),
  total_amount numeric(12,2) not null default 0 check (total_amount >= 0),
  issued_by_user_id uuid references public.users(id) on delete set null,
  issued_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (discount_amount <= subtotal_amount),
  check (status <> 'issued' or issued_at is not null),
  check (payment_state <> 'unpaid' or unpaid_reason is not null),
  check (payment_state <> 'paid' or paid_at is not null)
);

create table if not exists public.invoice_lines (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.workspaces(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  service_item_id uuid references public.service_items(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  description text not null check (length(trim(description)) > 0),
  quantity numeric(12,2) not null default 1 check (quantity > 0),
  unit_price numeric(12,2) not null default 0 check (unit_price >= 0),
  discount_amount numeric(12,2) not null default 0 check (discount_amount >= 0),
  line_total numeric(12,2) generated always as ((quantity * unit_price) - discount_amount) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (discount_amount <= quantity * unit_price)
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null references public.workspaces(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  payment_method text not null check (payment_method in ('card', 'cash', 'transfer', 'other')),
  amount numeric(12,2) not null check (amount >= 0),
  status text not null default 'approved'
    check (status in ('approved', 'cancelled', 'refunded', 'failed')),
  paid_at timestamptz not null default now(),
  metadata jsonb check (metadata is null or jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create unique index if not exists service_categories_workspace_id_key
  on public.service_categories (workspace_id, id);

create unique index if not exists service_items_workspace_id_key
  on public.service_items (workspace_id, id);

create unique index if not exists service_item_prices_workspace_id_key
  on public.service_item_prices (workspace_id, id);

create unique index if not exists soap_notes_workspace_id_key
  on public.soap_notes (workspace_id, id);

create unique index if not exists soap_notes_workspace_encounter_active_key
  on public.soap_notes (workspace_id, encounter_id)
  where status <> 'voided';

create unique index if not exists diagnosis_catalog_workspace_id_key
  on public.diagnosis_catalog (workspace_id, id)
  where workspace_id is not null;

create unique index if not exists diagnoses_workspace_id_key
  on public.diagnoses (workspace_id, id);

create unique index if not exists diagnoses_workspace_encounter_primary_key
  on public.diagnoses (workspace_id, encounter_id)
  where is_primary = true;

create unique index if not exists order_groups_workspace_id_key
  on public.order_groups (workspace_id, id);

create unique index if not exists orders_workspace_id_key
  on public.orders (workspace_id, id);

create unique index if not exists order_revisions_workspace_id_key
  on public.order_revisions (workspace_id, id);

create unique index if not exists invoices_workspace_id_key
  on public.invoices (workspace_id, id);

create unique index if not exists invoices_workspace_invoice_no_key
  on public.invoices (workspace_id, invoice_no);

create unique index if not exists invoice_lines_workspace_id_key
  on public.invoice_lines (workspace_id, id);

create unique index if not exists invoice_lines_invoice_order_key
  on public.invoice_lines (invoice_id, order_id)
  where order_id is not null;

create index if not exists service_categories_workspace_parent_idx
  on public.service_categories (workspace_id, parent_id, sort_order);

create index if not exists service_items_workspace_type_active_idx
  on public.service_items (workspace_id, item_type, is_active);

create index if not exists service_items_workspace_category_idx
  on public.service_items (workspace_id, category_id);

create index if not exists service_item_prices_service_item_effective_idx
  on public.service_item_prices (workspace_id, service_item_id, effective_from desc)
  where effective_to is null;

create index if not exists soap_notes_workspace_encounter_updated_idx
  on public.soap_notes (workspace_id, encounter_id, updated_at desc);

create index if not exists soap_note_revisions_workspace_note_idx
  on public.soap_note_revisions (workspace_id, soap_note_id, revision_no desc);

create index if not exists diagnosis_catalog_workspace_name_idx
  on public.diagnosis_catalog (workspace_id, name)
  where workspace_id is not null;

create index if not exists diagnoses_workspace_encounter_sort_idx
  on public.diagnoses (workspace_id, encounter_id, sort_order);

create index if not exists order_groups_workspace_encounter_sort_idx
  on public.order_groups (workspace_id, encounter_id, sort_order);

create index if not exists orders_workspace_encounter_status_idx
  on public.orders (workspace_id, encounter_id, status);

create index if not exists orders_workspace_status_priority_due_idx
  on public.orders (workspace_id, status, priority, due_at);

create index if not exists orders_workspace_assignee_status_due_idx
  on public.orders (workspace_id, current_assignee_user_id, status, due_at)
  where current_assignee_user_id is not null;

create index if not exists orders_workspace_service_item_idx
  on public.orders (workspace_id, service_item_id)
  where service_item_id is not null;

create index if not exists order_events_workspace_order_created_idx
  on public.order_events (workspace_id, order_id, created_at desc);

create index if not exists order_revisions_workspace_order_revision_idx
  on public.order_revisions (workspace_id, order_id, revision_no desc);

create index if not exists order_revision_fields_workspace_revision_idx
  on public.order_revision_fields (workspace_id, order_revision_id);

create index if not exists invoices_workspace_status_issued_idx
  on public.invoices (workspace_id, status, issued_at);

create index if not exists invoices_workspace_encounter_idx
  on public.invoices (workspace_id, encounter_id);

create index if not exists invoice_lines_workspace_invoice_idx
  on public.invoice_lines (workspace_id, invoice_id);

create index if not exists invoice_lines_workspace_order_idx
  on public.invoice_lines (workspace_id, order_id)
  where order_id is not null;

create index if not exists payments_workspace_invoice_paid_idx
  on public.payments (workspace_id, invoice_id, paid_at desc);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'service_items_category_workspace_fk'
      and conrelid = 'public.service_items'::regclass
  ) then
    alter table public.service_items
      add constraint service_items_category_workspace_fk
      foreign key (workspace_id, category_id) references public.service_categories(workspace_id, id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'service_item_prices_item_workspace_fk'
      and conrelid = 'public.service_item_prices'::regclass
  ) then
    alter table public.service_item_prices
      add constraint service_item_prices_item_workspace_fk
      foreign key (workspace_id, service_item_id) references public.service_items(workspace_id, id)
      on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'soap_notes_encounter_workspace_fk'
      and conrelid = 'public.soap_notes'::regclass
  ) then
    alter table public.soap_notes
      add constraint soap_notes_encounter_workspace_fk
      foreign key (workspace_id, encounter_id) references public.encounters(workspace_id, id)
      on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'soap_note_revisions_note_workspace_fk'
      and conrelid = 'public.soap_note_revisions'::regclass
  ) then
    alter table public.soap_note_revisions
      add constraint soap_note_revisions_note_workspace_fk
      foreign key (workspace_id, soap_note_id) references public.soap_notes(workspace_id, id)
      on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'diagnoses_encounter_workspace_fk'
      and conrelid = 'public.diagnoses'::regclass
  ) then
    alter table public.diagnoses
      add constraint diagnoses_encounter_workspace_fk
      foreign key (workspace_id, encounter_id) references public.encounters(workspace_id, id)
      on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'order_groups_encounter_workspace_fk'
      and conrelid = 'public.order_groups'::regclass
  ) then
    alter table public.order_groups
      add constraint order_groups_encounter_workspace_fk
      foreign key (workspace_id, encounter_id) references public.encounters(workspace_id, id)
      on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_encounter_workspace_fk'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_encounter_workspace_fk
      foreign key (workspace_id, encounter_id) references public.encounters(workspace_id, id)
      on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_order_group_workspace_fk'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_order_group_workspace_fk
      foreign key (workspace_id, order_group_id) references public.order_groups(workspace_id, id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_service_item_workspace_fk'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_service_item_workspace_fk
      foreign key (workspace_id, service_item_id) references public.service_items(workspace_id, id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'order_events_order_workspace_fk'
      and conrelid = 'public.order_events'::regclass
  ) then
    alter table public.order_events
      add constraint order_events_order_workspace_fk
      foreign key (workspace_id, order_id) references public.orders(workspace_id, id)
      on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'order_revisions_order_workspace_fk'
      and conrelid = 'public.order_revisions'::regclass
  ) then
    alter table public.order_revisions
      add constraint order_revisions_order_workspace_fk
      foreign key (workspace_id, order_id) references public.orders(workspace_id, id)
      on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'order_revision_fields_revision_workspace_fk'
      and conrelid = 'public.order_revision_fields'::regclass
  ) then
    alter table public.order_revision_fields
      add constraint order_revision_fields_revision_workspace_fk
      foreign key (workspace_id, order_revision_id) references public.order_revisions(workspace_id, id)
      on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'invoices_encounter_workspace_fk'
      and conrelid = 'public.invoices'::regclass
  ) then
    alter table public.invoices
      add constraint invoices_encounter_workspace_fk
      foreign key (workspace_id, encounter_id) references public.encounters(workspace_id, id)
      on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'invoices_guardian_workspace_fk'
      and conrelid = 'public.invoices'::regclass
  ) then
    alter table public.invoices
      add constraint invoices_guardian_workspace_fk
      foreign key (workspace_id, guardian_id) references public.guardians(workspace_id, id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'invoice_lines_invoice_workspace_fk'
      and conrelid = 'public.invoice_lines'::regclass
  ) then
    alter table public.invoice_lines
      add constraint invoice_lines_invoice_workspace_fk
      foreign key (workspace_id, invoice_id) references public.invoices(workspace_id, id)
      on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'invoice_lines_order_workspace_fk'
      and conrelid = 'public.invoice_lines'::regclass
  ) then
    alter table public.invoice_lines
      add constraint invoice_lines_order_workspace_fk
      foreign key (workspace_id, order_id) references public.orders(workspace_id, id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'invoice_lines_service_item_workspace_fk'
      and conrelid = 'public.invoice_lines'::regclass
  ) then
    alter table public.invoice_lines
      add constraint invoice_lines_service_item_workspace_fk
      foreign key (workspace_id, service_item_id) references public.service_items(workspace_id, id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'payments_invoice_workspace_fk'
      and conrelid = 'public.payments'::regclass
  ) then
    alter table public.payments
      add constraint payments_invoice_workspace_fk
      foreign key (workspace_id, invoice_id) references public.invoices(workspace_id, id)
      on delete cascade;
  end if;
end $$;

drop trigger if exists set_service_categories_updated_at on public.service_categories;
create trigger set_service_categories_updated_at
before update on public.service_categories
for each row execute function public.clair_set_updated_at();

drop trigger if exists set_service_items_updated_at on public.service_items;
create trigger set_service_items_updated_at
before update on public.service_items
for each row execute function public.clair_set_updated_at();

drop trigger if exists set_soap_notes_updated_at on public.soap_notes;
create trigger set_soap_notes_updated_at
before update on public.soap_notes
for each row execute function public.clair_set_updated_at();

drop trigger if exists set_diagnosis_catalog_updated_at on public.diagnosis_catalog;
create trigger set_diagnosis_catalog_updated_at
before update on public.diagnosis_catalog
for each row execute function public.clair_set_updated_at();

drop trigger if exists set_diagnoses_updated_at on public.diagnoses;
create trigger set_diagnoses_updated_at
before update on public.diagnoses
for each row execute function public.clair_set_updated_at();

drop trigger if exists set_order_groups_updated_at on public.order_groups;
create trigger set_order_groups_updated_at
before update on public.order_groups
for each row execute function public.clair_set_updated_at();

drop trigger if exists set_orders_updated_at on public.orders;
create trigger set_orders_updated_at
before update on public.orders
for each row execute function public.clair_set_updated_at();

drop trigger if exists set_invoices_updated_at on public.invoices;
create trigger set_invoices_updated_at
before update on public.invoices
for each row execute function public.clair_set_updated_at();

drop trigger if exists set_invoice_lines_updated_at on public.invoice_lines;
create trigger set_invoice_lines_updated_at
before update on public.invoice_lines
for each row execute function public.clair_set_updated_at();

alter table public.service_categories enable row level security;
alter table public.service_items enable row level security;
alter table public.service_item_prices enable row level security;
alter table public.soap_notes enable row level security;
alter table public.soap_note_revisions enable row level security;
alter table public.diagnosis_catalog enable row level security;
alter table public.diagnoses enable row level security;
alter table public.order_groups enable row level security;
alter table public.orders enable row level security;
alter table public.order_events enable row level security;
alter table public.order_revisions enable row level security;
alter table public.order_revision_fields enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_lines enable row level security;
alter table public.payments enable row level security;

comment on table public.service_categories is
  'Workspace-scoped service item category foundation for clinical/order/billing persistence. Full service catalog management remains follow-up scope.';
comment on table public.service_items is
  'Workspace-scoped service item foundation used by order and invoice rows. Full service catalog live conversion remains follow-up scope.';
comment on table public.service_item_prices is
  'Effective-dated service price snapshots. Billing routes must calculate amounts server-side from stored prices.';
comment on table public.soap_notes is
  'Encounter-scoped SOAP note persistence for Project 04 chart save and autosave flows.';
comment on table public.soap_note_revisions is
  'SOAP revision snapshots for future amendment and audit workflows.';
comment on table public.diagnosis_catalog is
  'Optional system/workspace diagnosis lookup table. Real diagnosis catalog API is out of scope.';
comment on table public.diagnoses is
  'Encounter-scoped diagnosis rows supporting catalog-linked and free-text entries.';
comment on table public.order_groups is
  'Encounter-scoped visible order groups for the chart order table.';
comment on table public.orders is
  'Encounter-scoped order rows with draft quantity and price snapshot fields for billing sync.';
comment on table public.order_events is
  'Order lifecycle event hook table. Full audit persistence remains a later project.';
comment on table public.order_revisions is
  'Order edit/cancel revision header rows.';
comment on table public.order_revision_fields is
  'Order revision field-level before/after values.';
comment on table public.invoices is
  'Encounter-scoped billing document header with invoice and payment-state fields.';
comment on table public.invoice_lines is
  'Server-calculated invoice line rows generated from confirmed orders or manual billing items.';
comment on table public.payments is
  'Payment record rows for local-first billing state only. Real PG transactions remain out of scope.';
