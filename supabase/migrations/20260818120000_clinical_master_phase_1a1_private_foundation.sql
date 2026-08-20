-- CLINICAL-MASTER-PR-001 / Phase 1A-1
-- Private canonical master foundation and local-only publisher boundary.
-- No workspace catalog, chart, order, billing, service_*, or UI runtime changes.

create extension if not exists pgcrypto with schema extensions;
create schema if not exists master;
create sequence if not exists master.clinical_action_code_seq as bigint;

create table if not exists master.master_releases (
  id uuid primary key default extensions.gen_random_uuid(),
  release_no bigint generated always as identity not null unique,
  release_key text unique check (release_key is null or length(pg_catalog.btrim(release_key)) > 0),
  record_count integer not null check (record_count > 0),
  source_fingerprint text not null unique
    check (source_fingerprint = pg_catalog.lower(source_fingerprint))
    check (source_fingerprint ~ '^[0-9a-f]{64}$'),
  status text not null check (status in ('publishing', 'published', 'failed')),
  release_notes text,
  published_by_user_id uuid references public.users(id) on delete set null,
  published_by_label text not null check (length(pg_catalog.btrim(published_by_label)) > 0),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  check (status <> 'published' or published_at is not null)
);

create table if not exists master.master_records (
  id uuid primary key default extensions.gen_random_uuid(),
  master_key text not null unique check (length(pg_catalog.btrim(master_key)) > 0),
  record_type text not null check (record_type in (
    'order_category', 'clinical_action', 'chart_group', 'task_route', 'order',
    'species', 'unit', 'specimen_type', 'result_input_type'
  )),
  lifecycle_status text not null check (lifecycle_status in ('published', 'deprecation_pending', 'deprecated')),
  safety_status text not null default 'normal' check (safety_status in ('normal', 'blocked')),
  safety_reason text,
  current_revision integer not null check (current_revision > 0),
  current_release_id uuid not null references master.master_releases(id),
  replacement_record_id uuid references master.master_records(id),
  published_at timestamptz,
  deprecated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (safety_status <> 'blocked' or length(pg_catalog.btrim(coalesce(safety_reason, ''))) > 0),
  check ((lifecycle_status = 'deprecated' and deprecated_at is not null)
    or (lifecycle_status <> 'deprecated' and deprecated_at is null)),
  check (published_at is not null)
);

create table if not exists master.master_record_names (
  id uuid primary key default extensions.gen_random_uuid(),
  master_record_id uuid not null references master.master_records(id) on delete restrict,
  language_code text not null check (language_code in ('ko', 'en')),
  name_kind text not null check (name_kind in ('preferred', 'alias', 'abbreviation', 'legacy')),
  name text not null check (length(pg_catalog.btrim(name)) > 0),
  normalized_name text not null check (length(pg_catalog.btrim(normalized_name)) > 0),
  searchable boolean not null default true,
  sort_order integer not null default 0 check (sort_order >= 0)
);

create table if not exists master.master_sources (
  id uuid primary key default extensions.gen_random_uuid(),
  source_type text not null check (source_type in ('synthetic', 'pdf_reference', 'official', 'manual')),
  title text not null check (length(pg_catalog.btrim(title)) > 0),
  reference_uri text,
  source_version text,
  accessed_at timestamptz,
  license_notes text,
  created_at timestamptz not null default now()
);

create table if not exists master.master_record_sources (
  master_record_id uuid not null references master.master_records(id) on delete restrict,
  source_id uuid not null references master.master_sources(id) on delete restrict,
  assertion_scope text not null default 'record' check (length(pg_catalog.btrim(assertion_scope)) > 0),
  notes text,
  primary key (master_record_id, source_id, assertion_scope)
);

create table if not exists master.master_record_versions (
  id uuid primary key default extensions.gen_random_uuid(),
  master_record_id uuid not null references master.master_records(id) on delete restrict,
  revision integer not null check (revision > 0),
  release_id uuid not null references master.master_releases(id) on delete restrict,
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  change_summary text,
  authored_by_label text not null check (length(pg_catalog.btrim(authored_by_label)) > 0),
  reviewed_by_label text,
  clinical_reviewer_label text,
  created_at timestamptz not null default now(),
  unique (master_record_id, revision),
  unique (master_record_id, revision, release_id)
);

create table if not exists master.master_review_events (
  id uuid primary key default extensions.gen_random_uuid(),
  master_record_id uuid not null,
  revision integer not null check (revision > 0),
  event_type text not null check (event_type in (
    'authored', 'validated', 'approved', 'rejected', 'published', 'deprecated', 'safety_blocked'
  )),
  actor_user_id uuid references public.users(id) on delete set null,
  actor_label text not null check (length(pg_catalog.btrim(actor_label)) > 0),
  source_surface text not null check (source_surface in ('airtable', 'publisher', 'server_admin')),
  reason text,
  created_at timestamptz not null default now(),
  foreign key (master_record_id, revision)
    references master.master_record_versions(master_record_id, revision)
    on delete restrict,
  check (event_type not in ('rejected', 'deprecated', 'safety_blocked')
    or length(pg_catalog.btrim(coalesce(reason, ''))) > 0)
);

create table if not exists master.order_categories (
  master_record_id uuid primary key references master.master_records(id) on delete restrict,
  category_code text not null unique check (length(pg_catalog.btrim(category_code)) > 0),
  category_level text not null check (category_level in ('X', 'T')),
  parent_category_id uuid references master.order_categories(master_record_id) on delete restrict,
  sort_order integer not null default 0 check (sort_order >= 0)
);

create table if not exists master.clinical_actions (
  master_record_id uuid primary key references master.master_records(id) on delete restrict,
  action_code text not null unique check (action_code ~ '^A[0-9]{6}$'),
  t_category_id uuid not null references master.order_categories(master_record_id) on delete restrict,
  item_type text not null check (item_type in (
    'consultation', 'medication', 'treatment', 'lab', 'imaging', 'hospitalization', 'misc'
  )),
  is_other_unclassified boolean not null default false
);

create table if not exists master.chart_groups (
  master_record_id uuid primary key references master.master_records(id) on delete restrict,
  group_code text not null unique check (group_code in (
    'CG_CONSULTATION', 'CG_PREVENTION', 'CG_EXAM', 'CG_PROCEDURE',
    'CG_SURGERY', 'CG_INPATIENT', 'CG_THERAPY', 'CG_MEDICATION_SUPPLY'
  )),
  sort_order integer not null default 0 check (sort_order >= 0)
);

create table if not exists master.task_routes (
  master_record_id uuid primary key references master.master_records(id) on delete restrict,
  route_code text not null unique check (route_code in (
    'NT_LAB', 'NT_IMAGING', 'NT_DISPENSING', 'NT_TREATMENT',
    'NT_INPATIENT', 'NT_BILLING_ONLY', 'NT_CHART_ONLY'
  )),
  destination_module text not null check (destination_module in (
    'lab', 'imaging', 'dispensing', 'treatment', 'inpatient', 'billing_only', 'chart_only'
  )),
  task_required boolean not null,
  runtime_status text not null check (runtime_status in ('active', 'held')),
  check (
    (route_code = 'NT_LAB' and destination_module = 'lab' and task_required and runtime_status = 'active')
    or (route_code = 'NT_IMAGING' and destination_module = 'imaging' and task_required and runtime_status = 'active')
    or (route_code = 'NT_DISPENSING' and destination_module = 'dispensing' and task_required and runtime_status = 'active')
    or (route_code = 'NT_TREATMENT' and destination_module = 'treatment' and task_required and runtime_status = 'active')
    or (route_code = 'NT_INPATIENT' and destination_module = 'inpatient' and task_required and runtime_status = 'held')
    or (route_code = 'NT_BILLING_ONLY' and destination_module = 'billing_only' and not task_required and runtime_status = 'active')
    or (route_code = 'NT_CHART_ONLY' and destination_module = 'chart_only' and not task_required and runtime_status = 'active')
  )
);

create table if not exists master.classification_paths (
  id uuid primary key default extensions.gen_random_uuid(),
  path_key text not null unique check (length(pg_catalog.btrim(path_key)) > 0),
  clinical_action_id uuid not null references master.clinical_actions(master_record_id) on delete restrict,
  chart_group_id uuid not null references master.chart_groups(master_record_id) on delete restrict,
  task_route_id uuid not null references master.task_routes(master_record_id) on delete restrict,
  active_from_release_id uuid not null references master.master_releases(id) on delete restrict,
  retired_in_release_id uuid references master.master_releases(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (clinical_action_id, chart_group_id, task_route_id)
);

create table if not exists master.species (
  master_record_id uuid primary key references master.master_records(id) on delete restrict,
  species_code text not null unique check (species_code in ('dog', 'cat'))
);

create table if not exists master.units (
  master_record_id uuid primary key references master.master_records(id) on delete restrict,
  unit_code text not null unique check (length(pg_catalog.btrim(unit_code)) > 0),
  symbol text not null check (length(pg_catalog.btrim(symbol)) > 0),
  decimal_scale integer not null default 0 check (decimal_scale >= 0)
);

create table if not exists master.specimen_types (
  master_record_id uuid primary key references master.master_records(id) on delete restrict,
  specimen_code text not null unique check (length(pg_catalog.btrim(specimen_code)) > 0)
);

create table if not exists master.result_input_types (
  master_record_id uuid primary key references master.master_records(id) on delete restrict,
  input_code text not null unique check (length(pg_catalog.btrim(input_code)) > 0),
  value_kind text not null check (value_kind in ('numeric', 'text', 'coded')),
  supports_unit boolean not null default false
);

create table if not exists master.orders (
  master_record_id uuid primary key references master.master_records(id) on delete restrict,
  classification_path_id uuid not null references master.classification_paths(id) on delete restrict,
  default_sales_unit_id uuid references master.units(master_record_id) on delete restrict,
  default_billing_reflection_enabled boolean not null default true,
  default_quantity numeric(12,3) not null default 1 check (default_quantity > 0)
);

create table if not exists master.order_species_links (
  order_record_id uuid not null references master.orders(master_record_id) on delete restrict,
  species_record_id uuid not null references master.species(master_record_id) on delete restrict,
  primary key (order_record_id, species_record_id)
);

alter table master.master_records
  add constraint master_records_current_version_fk
  foreign key (id, current_revision, current_release_id)
  references master.master_record_versions(master_record_id, revision, release_id)
  deferrable initially deferred;

create unique index if not exists master_classification_paths_active_action_key
  on master.classification_paths (clinical_action_id)
  where retired_in_release_id is null;
create unique index if not exists master_clinical_actions_other_item_type_key
  on master.clinical_actions (item_type)
  where is_other_unclassified;
create unique index if not exists master_record_names_preferred_ko_key
  on master.master_record_names (master_record_id)
  where language_code = 'ko' and name_kind = 'preferred';
create unique index if not exists master_record_names_preferred_en_key
  on master.master_record_names (master_record_id)
  where language_code = 'en' and name_kind = 'preferred';
create unique index if not exists master_record_names_normalized_unique_key
  on master.master_record_names (master_record_id, language_code, name_kind, normalized_name);

create index if not exists master_master_releases_status_created_idx on master.master_releases (status, created_at desc);
create index if not exists master_master_records_type_lifecycle_idx on master.master_records (record_type, lifecycle_status);
create index if not exists master_master_records_current_release_idx on master.master_records (current_release_id);
create index if not exists master_master_record_names_normalized_idx on master.master_record_names (normalized_name);
create index if not exists master_master_record_sources_source_idx on master.master_record_sources (source_id, master_record_id);
create index if not exists master_master_record_versions_release_idx on master.master_record_versions (release_id, created_at desc);
create index if not exists master_master_record_versions_record_revision_idx on master.master_record_versions (master_record_id, revision desc);
create index if not exists master_master_review_events_record_revision_idx on master.master_review_events (master_record_id, revision, created_at desc);
create index if not exists master_order_categories_parent_idx on master.order_categories (parent_category_id, category_level);
create index if not exists master_clinical_actions_t_category_idx on master.clinical_actions (t_category_id);
create index if not exists master_classification_paths_chart_group_idx on master.classification_paths (chart_group_id);
create index if not exists master_classification_paths_task_route_idx on master.classification_paths (task_route_id);
create index if not exists master_classification_paths_active_release_idx on master.classification_paths (active_from_release_id, retired_in_release_id);
create index if not exists master_orders_classification_path_idx on master.orders (classification_path_id);
create index if not exists master_orders_sales_unit_idx on master.orders (default_sales_unit_id) where default_sales_unit_id is not null;
create index if not exists master_order_species_links_species_idx on master.order_species_links (species_record_id, order_record_id);

create or replace function master.set_record_name_normalized()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.name := pg_catalog.btrim(new.name);
  -- Phase 1A-1 trims and folds case for search but preserves Unicode codepoints.
  new.normalized_name := pg_catalog.lower(pg_catalog.regexp_replace(new.name, '[[:space:]]+', ' ', 'g'));
  return new;
end;
$$;

create or replace function master.assert_record_type()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists (
    select 1 from master.master_records
    where id = new.master_record_id and record_type = tg_argv[0]
  ) then
    raise exception 'clinical_master_record_type_mismatch' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function master.assert_order_category_parent()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.category_level = 'X' and new.parent_category_id is not null then
    raise exception 'clinical_master_x_category_parent_forbidden' using errcode = '23514';
  end if;
  if new.category_level = 'T' and new.parent_category_id is null then
    raise exception 'clinical_master_t_category_parent_required' using errcode = '23514';
  end if;
  if new.parent_category_id is not null and not exists (
    select 1 from master.order_categories
    where master_record_id = new.parent_category_id and category_level = 'X'
  ) then
    raise exception 'clinical_master_t_category_parent_must_be_x' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function master.assert_classification_path_refs()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists (
    select 1
    from master.clinical_actions action
    join master.master_records action_record on action_record.id = action.master_record_id
    join master.chart_groups chart on chart.master_record_id = new.chart_group_id
    join master.master_records chart_record on chart_record.id = chart.master_record_id
    join master.task_routes route on route.master_record_id = new.task_route_id
    join master.master_records route_record on route_record.id = route.master_record_id
    where action.master_record_id = new.clinical_action_id
      and action_record.lifecycle_status = 'published'
      and action_record.safety_status = 'normal'
      and chart_record.lifecycle_status = 'published'
      and chart_record.safety_status = 'normal'
      and route_record.lifecycle_status = 'published'
      and route_record.safety_status = 'normal'
      and route.runtime_status = 'active'
  ) then
    raise exception 'clinical_master_classification_path_reference_invalid' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function master.assert_classification_path_retirement_order()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_active_release_no bigint;
  v_retired_release_no bigint;
begin
  if new.retired_in_release_id is not null then
    select release_no into v_active_release_no from master.master_releases where id = new.active_from_release_id;
    select release_no into v_retired_release_no from master.master_releases where id = new.retired_in_release_id;
    if v_retired_release_no is null or v_active_release_no is null or v_retired_release_no <= v_active_release_no then
      raise exception 'clinical_master_path_retirement_release_order_invalid' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create or replace function master.reject_release_identity_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'published' then raise exception 'clinical_master_published_release_immutable' using errcode = '55000'; end if;
    return old;
  end if;
  if new.id is distinct from old.id or new.release_no is distinct from old.release_no
    or new.release_key is distinct from old.release_key
    or new.source_fingerprint is distinct from old.source_fingerprint then
    raise exception 'clinical_master_release_identity_immutable' using errcode = '55000';
  end if;
  if old.status = 'published' then raise exception 'clinical_master_published_release_immutable' using errcode = '55000'; end if;
  return new;
end;
$$;

create or replace function master.reject_master_record_identity_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.id is distinct from old.id or new.master_key is distinct from old.master_key
    or new.record_type is distinct from old.record_type then
    raise exception 'clinical_master_record_identity_immutable' using errcode = '55000';
  end if;
  return new;
end;
$$;

create or replace function master.reject_version_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'clinical_master_record_version_immutable' using errcode = '55000';
end;
$$;

create or replace function master.reject_review_event_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'clinical_master_review_event_append_only' using errcode = '55000';
end;
$$;

create or replace function master.reject_clinical_action_code_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.action_code is not null then raise exception 'clinical_master_action_code_server_generated' using errcode = '22023'; end if;
    new.action_code := 'A' || pg_catalog.lpad(pg_catalog.nextval('master.clinical_action_code_seq')::text, 6, '0');
    return new;
  end if;
  if tg_op = 'DELETE' then
    raise exception 'clinical_master_typed_projection_immutable' using errcode = '55000';
  end if;
  if new.master_record_id is distinct from old.master_record_id then
    raise exception 'clinical_master_typed_identity_immutable' using errcode = '55000';
  end if;
  if new.action_code is distinct from old.action_code then raise exception 'clinical_master_action_code_immutable' using errcode = '55000'; end if;
  return new;
end;
$$;

create or replace function master.reject_code_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'clinical_master_typed_projection_immutable' using errcode = '55000';
  end if;
  if new.master_record_id is distinct from old.master_record_id then raise exception 'clinical_master_typed_identity_immutable' using errcode = '55000'; end if;
  if tg_table_name = 'order_categories'
    and (pg_catalog.to_jsonb(new)->>'category_code') is distinct from (pg_catalog.to_jsonb(old)->>'category_code') then
    raise exception 'clinical_master_category_code_immutable' using errcode = '55000';
  elsif tg_table_name = 'chart_groups'
    and (pg_catalog.to_jsonb(new)->>'group_code') is distinct from (pg_catalog.to_jsonb(old)->>'group_code') then
    raise exception 'clinical_master_chart_group_code_immutable' using errcode = '55000';
  elsif tg_table_name = 'task_routes'
    and (pg_catalog.to_jsonb(new)->>'route_code') is distinct from (pg_catalog.to_jsonb(old)->>'route_code') then
    raise exception 'clinical_master_task_route_code_immutable' using errcode = '55000';
  elsif tg_table_name = 'species'
    and (pg_catalog.to_jsonb(new)->>'species_code') is distinct from (pg_catalog.to_jsonb(old)->>'species_code') then
    raise exception 'clinical_master_species_code_immutable' using errcode = '55000';
  elsif tg_table_name = 'units'
    and (pg_catalog.to_jsonb(new)->>'unit_code') is distinct from (pg_catalog.to_jsonb(old)->>'unit_code') then
    raise exception 'clinical_master_unit_code_immutable' using errcode = '55000';
  elsif tg_table_name = 'specimen_types'
    and (pg_catalog.to_jsonb(new)->>'specimen_code') is distinct from (pg_catalog.to_jsonb(old)->>'specimen_code') then
    raise exception 'clinical_master_specimen_code_immutable' using errcode = '55000';
  elsif tg_table_name = 'result_input_types'
    and (pg_catalog.to_jsonb(new)->>'input_code') is distinct from (pg_catalog.to_jsonb(old)->>'input_code') then
    raise exception 'clinical_master_input_code_immutable' using errcode = '55000';
  end if;
  return new;
end;
$$;

create or replace function master.reject_classification_path_identity_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'clinical_master_classification_path_identity_immutable' using errcode = '55000';
  end if;
  if new.id is distinct from old.id then
    raise exception 'clinical_master_classification_path_identity_immutable' using errcode = '55000';
  end if;
  if new.path_key is distinct from old.path_key or new.clinical_action_id is distinct from old.clinical_action_id
    or new.chart_group_id is distinct from old.chart_group_id or new.task_route_id is distinct from old.task_route_id
    or new.active_from_release_id is distinct from old.active_from_release_id then
    raise exception 'clinical_master_classification_path_identity_immutable' using errcode = '55000';
  end if;
  if old.retired_in_release_id is not null and new.retired_in_release_id is distinct from old.retired_in_release_id then
    raise exception 'clinical_master_classification_path_retirement_immutable' using errcode = '55000';
  end if;
  return new;
end;
$$;

drop trigger if exists master_record_names_normalize on master.master_record_names;
create trigger master_record_names_normalize before insert or update of name, normalized_name on master.master_record_names
for each row execute function master.set_record_name_normalized();
drop trigger if exists master_order_categories_type_guard on master.order_categories;
create trigger master_order_categories_type_guard before insert or update on master.order_categories
for each row execute function master.assert_record_type('order_category');
drop trigger if exists master_order_categories_parent_guard on master.order_categories;
create trigger master_order_categories_parent_guard before insert or update on master.order_categories
for each row execute function master.assert_order_category_parent();
drop trigger if exists master_order_categories_code_guard on master.order_categories;
create trigger master_order_categories_code_guard before update or delete on master.order_categories
for each row execute function master.reject_code_mutation();
drop trigger if exists master_clinical_actions_type_guard on master.clinical_actions;
create trigger master_clinical_actions_type_guard before insert or update on master.clinical_actions
for each row execute function master.assert_record_type('clinical_action');
drop trigger if exists master_clinical_actions_code_guard on master.clinical_actions;
create trigger master_clinical_actions_code_guard before insert or update or delete on master.clinical_actions
for each row execute function master.reject_clinical_action_code_mutation();
drop trigger if exists master_chart_groups_type_guard on master.chart_groups;
create trigger master_chart_groups_type_guard before insert or update on master.chart_groups
for each row execute function master.assert_record_type('chart_group');
drop trigger if exists master_chart_groups_code_guard on master.chart_groups;
create trigger master_chart_groups_code_guard before update or delete on master.chart_groups
for each row execute function master.reject_code_mutation();
drop trigger if exists master_task_routes_type_guard on master.task_routes;
create trigger master_task_routes_type_guard before insert or update on master.task_routes
for each row execute function master.assert_record_type('task_route');
drop trigger if exists master_task_routes_code_guard on master.task_routes;
create trigger master_task_routes_code_guard before update or delete on master.task_routes
for each row execute function master.reject_code_mutation();
drop trigger if exists master_species_type_guard on master.species;
create trigger master_species_type_guard before insert or update on master.species
for each row execute function master.assert_record_type('species');
drop trigger if exists master_species_code_guard on master.species;
create trigger master_species_code_guard before update or delete on master.species
for each row execute function master.reject_code_mutation();
drop trigger if exists master_units_type_guard on master.units;
create trigger master_units_type_guard before insert or update on master.units
for each row execute function master.assert_record_type('unit');
drop trigger if exists master_units_code_guard on master.units;
create trigger master_units_code_guard before update or delete on master.units
for each row execute function master.reject_code_mutation();
drop trigger if exists master_specimen_types_type_guard on master.specimen_types;
create trigger master_specimen_types_type_guard before insert or update on master.specimen_types
for each row execute function master.assert_record_type('specimen_type');
drop trigger if exists master_specimen_types_code_guard on master.specimen_types;
create trigger master_specimen_types_code_guard before update or delete on master.specimen_types
for each row execute function master.reject_code_mutation();
drop trigger if exists master_result_input_types_type_guard on master.result_input_types;
create trigger master_result_input_types_type_guard before insert or update on master.result_input_types
for each row execute function master.assert_record_type('result_input_type');
drop trigger if exists master_result_input_types_code_guard on master.result_input_types;
create trigger master_result_input_types_code_guard before update or delete on master.result_input_types
for each row execute function master.reject_code_mutation();
drop trigger if exists master_orders_type_guard on master.orders;
create trigger master_orders_type_guard before insert or update on master.orders
for each row execute function master.assert_record_type('order');
drop trigger if exists master_orders_identity_guard on master.orders;
create trigger master_orders_identity_guard before update or delete on master.orders
for each row execute function master.reject_code_mutation();
drop trigger if exists master_classification_paths_guard on master.classification_paths;
create trigger master_classification_paths_guard before insert or update on master.classification_paths
for each row execute function master.assert_classification_path_refs();
drop trigger if exists master_classification_paths_retirement_order_guard on master.classification_paths;
create trigger master_classification_paths_retirement_order_guard before insert or update on master.classification_paths
for each row execute function master.assert_classification_path_retirement_order();
drop trigger if exists master_master_records_identity_guard on master.master_records;
create trigger master_master_records_identity_guard before update on master.master_records
for each row execute function master.reject_master_record_identity_mutation();
drop trigger if exists master_master_releases_immutable_guard on master.master_releases;
create trigger master_master_releases_immutable_guard before update or delete on master.master_releases
for each row execute function master.reject_release_identity_mutation();
drop trigger if exists master_master_record_versions_append_only on master.master_record_versions;
create trigger master_master_record_versions_append_only before update or delete on master.master_record_versions
for each row execute function master.reject_version_mutation();
drop trigger if exists master_master_review_events_append_only on master.master_review_events;
create trigger master_master_review_events_append_only before update or delete on master.master_review_events
for each row execute function master.reject_review_event_mutation();
drop trigger if exists master_classification_paths_identity_guard on master.classification_paths;
create trigger master_classification_paths_identity_guard before update or delete on master.classification_paths
for each row execute function master.reject_classification_path_identity_mutation();

create or replace function private.clinical_master_has_forbidden_key(p_value jsonb)
returns boolean language sql immutable set search_path = '' as $$
select case pg_catalog.jsonb_typeof(p_value)
  when 'object' then exists (
    select 1 from pg_catalog.jsonb_each(p_value) as item(key, value)
    where pg_catalog.regexp_replace(pg_catalog.lower(item.key), '[^a-z0-9_]', '', 'g')
      = any (array['price', 'pricekrw', 'canonicalprice', 'price_krw'])
      or private.clinical_master_has_forbidden_key(item.value)
  )
  when 'array' then exists (
    select 1 from pg_catalog.jsonb_array_elements(p_value) as item(value)
    where private.clinical_master_has_forbidden_key(item.value)
  )
  else false
end;
$$;

create or replace function private.clinical_master_assert_detail_keys(p_record_type text, p_detail jsonb)
returns void language plpgsql immutable set search_path = '' as $$
declare
  v_key text;
  v_allowed text[];
begin
  if pg_catalog.jsonb_typeof(p_detail) <> 'object' then
    raise exception 'clinical_master_detail_object_required' using errcode = '22023';
  end if;
  v_allowed := case p_record_type
    when 'order_category' then array['categoryCode','categoryLevel','parentMasterKey','sortOrder']
    when 'clinical_action' then array['tCategoryKey','itemType','isOtherUnclassified']
    when 'chart_group' then array['groupCode','sortOrder']
    when 'task_route' then array['routeCode','destinationModule','taskRequired','runtimeStatus']
    when 'order' then array['classificationPathKey','defaultSalesUnitCode','defaultBillingReflectionEnabled','defaultQuantity','species']
    when 'species' then array['speciesCode']
    when 'unit' then array['unitCode','symbol','decimalScale']
    when 'specimen_type' then array['specimenCode']
    when 'result_input_type' then array['inputCode','valueKind','supportsUnit']
    else array[]::text[]
  end;
  for v_key in select key from pg_catalog.jsonb_object_keys(p_detail) as keys(key) loop
    if not (v_key = any(v_allowed)) then
      raise exception 'clinical_master_unknown_detail_field' using errcode = '22023', detail = v_key;
    end if;
  end loop;
end;
$$;

create or replace function private.clinical_master_canonicalize_detail(p_record_type text, p_detail jsonb)
returns jsonb language sql immutable set search_path = '' as $$
select case p_record_type
  when 'order_category' then pg_catalog.jsonb_build_object(
    'categoryCode', pg_catalog.btrim(p_detail->>'categoryCode'),
    'categoryLevel', pg_catalog.btrim(p_detail->>'categoryLevel'),
    'parentMasterKey', nullif(pg_catalog.btrim(p_detail->>'parentMasterKey'), ''),
    'sortOrder', coalesce((p_detail->>'sortOrder')::integer, 0)
  )
  when 'clinical_action' then pg_catalog.jsonb_build_object(
    'tCategoryKey', pg_catalog.btrim(p_detail->>'tCategoryKey'),
    'itemType', pg_catalog.btrim(p_detail->>'itemType'),
    'isOtherUnclassified', coalesce((p_detail->>'isOtherUnclassified')::boolean, false)
  )
  when 'chart_group' then pg_catalog.jsonb_build_object(
    'groupCode', pg_catalog.btrim(p_detail->>'groupCode'),
    'sortOrder', coalesce((p_detail->>'sortOrder')::integer, 0)
  )
  when 'task_route' then pg_catalog.jsonb_build_object(
    'routeCode', pg_catalog.btrim(p_detail->>'routeCode'),
    'destinationModule', coalesce(
      nullif(pg_catalog.btrim(p_detail->>'destinationModule'), ''),
      case pg_catalog.btrim(p_detail->>'routeCode')
        when 'NT_LAB' then 'lab'
        when 'NT_IMAGING' then 'imaging'
        when 'NT_DISPENSING' then 'dispensing'
        when 'NT_TREATMENT' then 'treatment'
        when 'NT_INPATIENT' then 'inpatient'
        when 'NT_BILLING_ONLY' then 'billing_only'
        when 'NT_CHART_ONLY' then 'chart_only'
      end
    ),
    'taskRequired', coalesce(
      (p_detail->>'taskRequired')::boolean,
      case pg_catalog.btrim(p_detail->>'routeCode')
        when 'NT_LAB' then true
        when 'NT_IMAGING' then true
        when 'NT_DISPENSING' then true
        when 'NT_TREATMENT' then true
        when 'NT_INPATIENT' then true
        when 'NT_BILLING_ONLY' then false
        when 'NT_CHART_ONLY' then false
      end
    ),
    'runtimeStatus', coalesce(
      nullif(pg_catalog.btrim(p_detail->>'runtimeStatus'), ''),
      case pg_catalog.btrim(p_detail->>'routeCode')
        when 'NT_INPATIENT' then 'held'
        when 'NT_LAB' then 'active'
        when 'NT_IMAGING' then 'active'
        when 'NT_DISPENSING' then 'active'
        when 'NT_TREATMENT' then 'active'
        when 'NT_BILLING_ONLY' then 'active'
        when 'NT_CHART_ONLY' then 'active'
      end
    )
  )
  when 'order' then pg_catalog.jsonb_build_object(
    'classificationPathKey', pg_catalog.btrim(p_detail->>'classificationPathKey'),
    'defaultSalesUnitCode', nullif(pg_catalog.btrim(p_detail->>'defaultSalesUnitCode'), ''),
    'defaultBillingReflectionEnabled', coalesce((p_detail->>'defaultBillingReflectionEnabled')::boolean, true),
    'defaultQuantity', (
      case when pg_catalog.strpos(coalesce((p_detail->>'defaultQuantity')::numeric, 1)::text, '.') > 0 then
        pg_catalog.regexp_replace(
          pg_catalog.regexp_replace(coalesce((p_detail->>'defaultQuantity')::numeric, 1)::text, '0+$', ''),
          '[.]$', ''
        )::numeric
      else coalesce((p_detail->>'defaultQuantity')::numeric, 1)
      end
    ),
    'species', coalesce((
      select pg_catalog.jsonb_agg(value order by value #>> '{}')
      from pg_catalog.jsonb_array_elements(coalesce(p_detail->'species', '[]'::jsonb)) as species(value)
    ), '[]'::jsonb)
  )
  when 'species' then pg_catalog.jsonb_build_object(
    'speciesCode', pg_catalog.btrim(p_detail->>'speciesCode')
  )
  when 'unit' then pg_catalog.jsonb_build_object(
    'unitCode', pg_catalog.btrim(p_detail->>'unitCode'),
    'symbol', pg_catalog.btrim(p_detail->>'symbol'),
    'decimalScale', coalesce((p_detail->>'decimalScale')::integer, 0)
  )
  when 'specimen_type' then pg_catalog.jsonb_build_object(
    'specimenCode', pg_catalog.btrim(p_detail->>'specimenCode')
  )
  when 'result_input_type' then pg_catalog.jsonb_build_object(
    'inputCode', pg_catalog.btrim(p_detail->>'inputCode'),
    'valueKind', pg_catalog.btrim(p_detail->>'valueKind'),
    'supportsUnit', coalesce((p_detail->>'supportsUnit')::boolean, false)
  )
  else coalesce(p_detail, '{}'::jsonb)
end;
$$;

create or replace function private.clinical_master_assert_contract_keys(p_contract text, p_value jsonb)
returns void language plpgsql set search_path = '' as $$
declare
  v_key text;
  v_allowed text[];
begin
  if pg_catalog.jsonb_typeof(p_value) <> 'object' then
    raise exception 'clinical_master_contract_object_required' using errcode = '22023', detail = p_contract;
  end if;
  v_allowed := case p_contract
    when 'payload' then array['releaseKey','releaseNotes','publishedByLabel','records','classificationPaths']
    when 'record' then array['masterKey','recordType','lifecycleStatus','safetyStatus','safetyReason','names','source','detail']
    when 'name' then array['languageCode','nameKind','name','searchable','sortOrder']
    when 'source' then array['sourceType','title','referenceUri','sourceVersion','accessedAt','licenseNotes']
    when 'path' then array['pathKey','clinicalActionKey','chartGroupKey','taskRouteKey']
    else array[]::text[]
  end;
  for v_key in select key from pg_catalog.jsonb_object_keys(p_value) as keys(key) loop
    if not (v_key = any(v_allowed)) then
      raise exception 'clinical_master_unknown_contract_field' using errcode = '22023', detail = p_contract || ':' || v_key;
    end if;
  end loop;
end;
$$;

create or replace function private.clinical_master_canonicalize_payload(p_payload jsonb)
returns jsonb language sql immutable set search_path = '' as $$
with record_base as (
  select record_value,
    private.clinical_master_canonicalize_detail(
      pg_catalog.btrim(record_value->>'recordType'), record_value->'detail'
    ) as normalized_detail
  from pg_catalog.jsonb_array_elements(coalesce(p_payload->'records', '[]'::jsonb)) as records(record_value)
), normalized_records as (
  select pg_catalog.jsonb_build_object(
    'masterKey', pg_catalog.btrim(record_value->>'masterKey'),
    'recordType', pg_catalog.btrim(record_value->>'recordType'),
    'lifecycleStatus', coalesce(pg_catalog.btrim(record_value->>'lifecycleStatus'), 'published'),
    'safetyStatus', coalesce(pg_catalog.btrim(record_value->>'safetyStatus'), 'normal'),
    'safetyReason', nullif(pg_catalog.btrim(record_value->>'safetyReason'), ''),
    'names', coalesce((select pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'languageCode', pg_catalog.btrim(name_value->>'languageCode'),
        'nameKind', pg_catalog.btrim(name_value->>'nameKind'),
        'name', pg_catalog.btrim(name_value->>'name'),
        'searchable', coalesce((name_value->>'searchable')::boolean, true),
        'sortOrder', coalesce((name_value->>'sortOrder')::integer, 0)
      ) order by pg_catalog.btrim(name_value->>'languageCode'), pg_catalog.btrim(name_value->>'nameKind'),
        pg_catalog.lower(pg_catalog.btrim(name_value->>'name')), coalesce((name_value->>'sortOrder')::integer, 0)
    ) from pg_catalog.jsonb_array_elements(coalesce(record_value->'names', '[]'::jsonb)) as names(name_value)), '[]'::jsonb),
    'source', pg_catalog.jsonb_build_object(
      'sourceType', pg_catalog.btrim(record_value->'source'->>'sourceType'),
      'title', pg_catalog.btrim(record_value->'source'->>'title'),
      'referenceUri', nullif(pg_catalog.btrim(record_value->'source'->>'referenceUri'), ''),
      'sourceVersion', nullif(pg_catalog.btrim(record_value->'source'->>'sourceVersion'), ''),
      'accessedAt', nullif(pg_catalog.btrim(record_value->'source'->>'accessedAt'), ''),
      'licenseNotes', nullif(pg_catalog.btrim(record_value->'source'->>'licenseNotes'), '')
    ),
    'detail', normalized_detail
  ) as value
  from record_base
), normalized_paths as (
  select pg_catalog.jsonb_build_object(
    'pathKey', pg_catalog.btrim(path_value->>'pathKey'),
    'clinicalActionKey', pg_catalog.btrim(path_value->>'clinicalActionKey'),
    'chartGroupKey', pg_catalog.btrim(path_value->>'chartGroupKey'),
    'taskRouteKey', pg_catalog.btrim(path_value->>'taskRouteKey')
  ) as value
  from pg_catalog.jsonb_array_elements(coalesce(p_payload->'classificationPaths', '[]'::jsonb)) as paths(path_value)
)
select pg_catalog.jsonb_build_object(
  'releaseKey', nullif(pg_catalog.btrim(p_payload->>'releaseKey'), ''),
  'releaseNotes', nullif(pg_catalog.btrim(p_payload->>'releaseNotes'), ''),
  'publishedByLabel', pg_catalog.btrim(p_payload->>'publishedByLabel'),
  'records', coalesce((select pg_catalog.jsonb_agg(value order by value->>'masterKey') from normalized_records), '[]'::jsonb),
  'classificationPaths', coalesce((select pg_catalog.jsonb_agg(value order by value->>'pathKey') from normalized_paths), '[]'::jsonb)
);
$$;

create or replace function private.clinical_master_record_content(p_record jsonb, p_action_code text default null)
returns jsonb language sql immutable set search_path = '' as $$
select case when p_action_code is null then p_record
  else pg_catalog.jsonb_set(p_record, '{detail,actionCode}', to_jsonb(p_action_code), true)
end - 'revision';
$$;

create or replace function private.publish_clinical_master_release(
  p_payload jsonb,
  p_actor_user_id uuid default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_payload jsonb;
  v_fingerprint text;
  v_release_key text;
  v_existing master.master_releases%rowtype;
  v_release master.master_releases%rowtype;
  v_record jsonb;
  v_path jsonb;
  v_detail jsonb;
  v_source jsonb;
  v_names jsonb;
  v_master_key text;
  v_record_type text;
  v_lifecycle_status text;
  v_safety_status text;
  v_record_id uuid;
  v_source_id uuid;
  v_parent_id uuid;
  v_t_category_id uuid;
  v_action_id uuid;
  v_chart_group_id uuid;
  v_task_route_id uuid;
  v_path_id uuid;
  v_unit_id uuid;
  v_species_id uuid;
  v_revision integer;
  v_latest_revision integer;
  v_action_code text;
  v_existing_code text;
  v_snapshot jsonb;
  v_existing_snapshot jsonb;
  v_incoming_content jsonb;
  v_record_count integer;
  v_preferred_ko_count integer;
  v_preferred_en_count integer;
begin
  if p_payload is null or coalesce(pg_catalog.jsonb_typeof(p_payload), '') <> 'object' then
    raise exception 'clinical_master_payload_object_required' using errcode = '22023';
  end if;
  if coalesce(pg_catalog.jsonb_typeof(p_payload->'records'), '') <> 'array'
    or pg_catalog.jsonb_array_length(coalesce(p_payload->'records', '[]'::jsonb)) = 0 then
    raise exception 'clinical_master_records_required' using errcode = '22023';
  end if;
  if length(pg_catalog.btrim(coalesce(p_payload->>'publishedByLabel', ''))) = 0 then
    raise exception 'clinical_master_published_by_label_required' using errcode = '22023';
  end if;

  -- Validate the raw input before canonicalization so unknown contract fields
  -- cannot be silently dropped from the fingerprint input.
  perform private.clinical_master_assert_contract_keys('payload', p_payload);
  for v_record in select value from pg_catalog.jsonb_array_elements(p_payload->'records') as records(value) loop
    perform private.clinical_master_assert_contract_keys('record', v_record);
    if v_record->>'recordType' in (
      'order_category', 'clinical_action', 'chart_group', 'task_route', 'order',
      'species', 'unit', 'specimen_type', 'result_input_type'
    ) then
      perform private.clinical_master_assert_detail_keys(
        v_record->>'recordType', coalesce(v_record->'detail', '{}'::jsonb)
      );
    end if;
    if private.clinical_master_has_forbidden_key(v_record) then
      raise exception 'clinical_master_canonical_price_forbidden' using errcode = '22023';
    end if;
    perform private.clinical_master_assert_contract_keys('source', coalesce(v_record->'source', '{}'::jsonb));
    for v_names in select value from pg_catalog.jsonb_array_elements(coalesce(v_record->'names', '[]'::jsonb)) as names(value) loop
      perform private.clinical_master_assert_contract_keys('name', v_names);
    end loop;
  end loop;
  for v_path in select value from pg_catalog.jsonb_array_elements(coalesce(p_payload->'classificationPaths', '[]'::jsonb)) as paths(value) loop
    perform private.clinical_master_assert_contract_keys('path', v_path);
  end loop;

  v_payload := private.clinical_master_canonicalize_payload(p_payload);
  v_record_count := pg_catalog.jsonb_array_length(v_payload->'records');
  v_fingerprint := pg_catalog.encode(extensions.digest(pg_catalog.convert_to(v_payload::text, 'UTF8'), 'sha256'), 'hex');
  v_release_key := nullif(pg_catalog.btrim(v_payload->>'releaseKey'), '');

  -- One short transaction-scoped lock serializes release fingerprint resolution.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('clinical_master_phase_1a1_publication', 0)
  );

  -- Re-check under the lock so concurrent identical payloads converge on one release.
  select * into v_existing from master.master_releases
  where source_fingerprint = v_fingerprint for update;
  if found then
    if v_existing.status = 'published' then
      return pg_catalog.jsonb_build_object(
        'releaseId', v_existing.id, 'releaseNo', v_existing.release_no,
        'sourceFingerprint', v_existing.source_fingerprint, 'idempotent', true,
        'recordCount', v_existing.record_count
      );
    end if;
    raise exception 'clinical_master_release_incomplete_conflict' using errcode = '40001';
  end if;

  if v_release_key is not null then
    select * into v_existing from master.master_releases
    where release_key = v_release_key for update;
    if found then
      if v_existing.source_fingerprint = v_fingerprint and v_existing.status = 'published' then
        return pg_catalog.jsonb_build_object(
          'releaseId', v_existing.id, 'releaseNo', v_existing.release_no,
          'sourceFingerprint', v_existing.source_fingerprint, 'idempotent', true,
          'recordCount', v_existing.record_count
        );
      end if;
      raise exception 'clinical_master_release_key_conflict' using errcode = '40001';
    end if;
  end if;

  insert into master.master_releases (
    release_key, record_count, source_fingerprint, status, release_notes, published_by_user_id, published_by_label
  ) values (
    v_release_key, v_record_count, v_fingerprint, 'publishing', v_payload->>'releaseNotes', p_actor_user_id, v_payload->>'publishedByLabel'
  ) returning * into v_release;

  if exists (
    select 1 from pg_catalog.jsonb_array_elements(v_payload->'records') as records(record_value)
    group by record_value->>'masterKey'
    having pg_catalog.btrim(record_value->>'masterKey') = '' or count(*) > 1
  ) then
    raise exception 'clinical_master_duplicate_or_empty_master_key' using errcode = '22023';
  end if;

  for v_record in select value from pg_catalog.jsonb_array_elements(v_payload->'records') as records(value) loop
    v_master_key := pg_catalog.btrim(v_record->>'masterKey');
    v_record_type := pg_catalog.btrim(v_record->>'recordType');
    v_lifecycle_status := coalesce(pg_catalog.btrim(v_record->>'lifecycleStatus'), 'published');
    v_safety_status := coalesce(pg_catalog.btrim(v_record->>'safetyStatus'), 'normal');
    v_detail := coalesce(v_record->'detail', '{}'::jsonb);

    if v_record_type not in ('order_category','clinical_action','chart_group','task_route','order','species','unit','specimen_type','result_input_type') then
      raise exception 'clinical_master_record_type_not_allowed' using errcode = '22023';
    end if;
    if v_lifecycle_status <> 'published' or v_safety_status <> 'normal' then
      raise exception 'clinical_master_fixture_records_must_be_published_and_normal' using errcode = '22023';
    end if;
    perform private.clinical_master_assert_detail_keys(v_record_type, v_detail);
    if private.clinical_master_has_forbidden_key(v_detail) then
      raise exception 'clinical_master_canonical_price_forbidden' using errcode = '22023';
    end if;
    if pg_catalog.jsonb_typeof(v_record->'names') <> 'array' or pg_catalog.jsonb_array_length(v_record->'names') = 0 then
      raise exception 'clinical_master_names_required' using errcode = '22023';
    end if;
    select count(*) into v_preferred_ko_count from pg_catalog.jsonb_array_elements(v_record->'names') as names(value)
    where value->>'languageCode' = 'ko' and value->>'nameKind' = 'preferred';
    select count(*) into v_preferred_en_count from pg_catalog.jsonb_array_elements(v_record->'names') as names(value)
    where value->>'languageCode' = 'en' and value->>'nameKind' = 'preferred';
    if v_preferred_ko_count <> 1 or v_preferred_en_count > 1 then
      raise exception 'clinical_master_preferred_name_contract_failed' using errcode = '22023';
    end if;
    v_source := v_record->'source';
    if pg_catalog.jsonb_typeof(v_source) <> 'object' or pg_catalog.btrim(coalesce(v_source->>'sourceType', '')) <> 'synthetic'
      or pg_catalog.btrim(coalesce(v_source->>'title', '')) = '' then
      raise exception 'clinical_master_synthetic_source_required' using errcode = '22023';
    end if;

    select id, current_revision into v_record_id, v_revision
    from master.master_records where master_key = v_master_key for update;
    if found then
      if (select record_type from master.master_records where id = v_record_id) <> v_record_type then
        raise exception 'clinical_master_record_type_change_forbidden' using errcode = '23514';
      end if;
      select action_code into v_action_code from master.clinical_actions where master_record_id = v_record_id;
      select snapshot, revision into v_existing_snapshot, v_latest_revision
      from master.master_record_versions where master_record_id = v_record_id order by revision desc limit 1;
      if v_existing_snapshot is null then raise exception 'clinical_master_current_version_missing' using errcode = '23503'; end if;
      v_incoming_content := private.clinical_master_record_content(v_record, v_action_code);
      if (v_existing_snapshot - 'revision') is distinct from v_incoming_content then
        update master.master_records set
          lifecycle_status = v_lifecycle_status,
          safety_status = v_safety_status,
          safety_reason = nullif(pg_catalog.btrim(v_record->>'safetyReason'), ''),
          current_revision = v_latest_revision + 1,
          current_release_id = v_release.id,
          published_at = coalesce(published_at, now()),
          deprecated_at = case when v_lifecycle_status = 'deprecated' then coalesce(deprecated_at, now()) else null end,
          updated_at = now()
        where id = v_record_id;
      end if;
    else
      v_record_id := extensions.gen_random_uuid();
      insert into master.master_records (
        id, master_key, record_type, lifecycle_status, safety_status, safety_reason,
        current_revision, current_release_id, published_at
      ) values (
        v_record_id, v_master_key, v_record_type, v_lifecycle_status, v_safety_status,
        nullif(pg_catalog.btrim(v_record->>'safetyReason'), ''), 1, v_release.id, now()
      );
    end if;
  end loop;

  for v_record in select value from pg_catalog.jsonb_array_elements(v_payload->'records') as records(value)
    where value->>'recordType' = 'order_category'
    order by case when value->'detail'->>'categoryLevel' = 'X' then 0 else 1 end, value->>'masterKey' loop
    select id into v_record_id from master.master_records where master_key = v_record->>'masterKey';
    v_detail := v_record->'detail';
    v_parent_id := null;
    if v_detail->>'categoryLevel' = 'T' then
      select category.master_record_id into v_parent_id
      from master.order_categories category join master.master_records parent_record on parent_record.id = category.master_record_id
      where parent_record.master_key = v_detail->>'parentMasterKey' and category.category_level = 'X';
      if v_parent_id is null then raise exception 'clinical_master_t_category_parent_missing' using errcode = '23503'; end if;
    end if;
    select category_code into v_existing_code from master.order_categories where master_record_id = v_record_id;
    if v_existing_code is not null and v_existing_code is distinct from pg_catalog.btrim(v_detail->>'categoryCode') then
      raise exception 'clinical_master_category_code_conflict' using errcode = '23514';
    end if;
    insert into master.order_categories (master_record_id, category_code, category_level, parent_category_id, sort_order)
    values (v_record_id, pg_catalog.btrim(v_detail->>'categoryCode'), pg_catalog.btrim(v_detail->>'categoryLevel'), v_parent_id, coalesce((v_detail->>'sortOrder')::integer, 0))
    on conflict (master_record_id) do update set parent_category_id = excluded.parent_category_id, sort_order = excluded.sort_order;
  end loop;

  for v_record in select value from pg_catalog.jsonb_array_elements(v_payload->'records') as records(value)
    where value->>'recordType' = 'clinical_action' loop
    select id into v_record_id from master.master_records where master_key = v_record->>'masterKey';
    v_detail := v_record->'detail';
    select category.master_record_id into v_t_category_id
    from master.order_categories category join master.master_records category_record on category_record.id = category.master_record_id
    where category_record.master_key = v_detail->>'tCategoryKey' and category.category_level = 'T';
    if v_t_category_id is null then raise exception 'clinical_master_clinical_action_t_category_missing' using errcode = '23503'; end if;
    insert into master.clinical_actions (master_record_id, t_category_id, item_type, is_other_unclassified)
    values (v_record_id, v_t_category_id, pg_catalog.btrim(v_detail->>'itemType'), (v_detail->>'isOtherUnclassified')::boolean)
    on conflict (master_record_id) do update set t_category_id = excluded.t_category_id, item_type = excluded.item_type, is_other_unclassified = excluded.is_other_unclassified;
  end loop;

  for v_record in select value from pg_catalog.jsonb_array_elements(v_payload->'records') as records(value)
    where value->>'recordType' = 'chart_group' loop
    select id into v_record_id from master.master_records where master_key = v_record->>'masterKey';
    v_detail := v_record->'detail';
    select group_code into v_existing_code from master.chart_groups where master_record_id = v_record_id;
    if v_existing_code is not null and v_existing_code is distinct from pg_catalog.btrim(v_detail->>'groupCode') then raise exception 'clinical_master_chart_group_code_conflict' using errcode = '23514'; end if;
    insert into master.chart_groups (master_record_id, group_code, sort_order)
    values (v_record_id, pg_catalog.btrim(v_detail->>'groupCode'), coalesce((v_detail->>'sortOrder')::integer, 0))
    on conflict (master_record_id) do update set sort_order = excluded.sort_order;
  end loop;

  for v_record in select value from pg_catalog.jsonb_array_elements(v_payload->'records') as records(value)
    where value->>'recordType' = 'task_route' loop
    select id into v_record_id from master.master_records where master_key = v_record->>'masterKey';
    v_detail := v_record->'detail';
    select route_code into v_existing_code from master.task_routes where master_record_id = v_record_id;
    if v_existing_code is not null and v_existing_code is distinct from pg_catalog.btrim(v_detail->>'routeCode') then raise exception 'clinical_master_task_route_code_conflict' using errcode = '23514'; end if;
    insert into master.task_routes (master_record_id, route_code, destination_module, task_required, runtime_status)
    values (v_record_id, pg_catalog.btrim(v_detail->>'routeCode'), pg_catalog.btrim(v_detail->>'destinationModule'), (v_detail->>'taskRequired')::boolean, pg_catalog.btrim(v_detail->>'runtimeStatus'))
    on conflict (master_record_id) do update set destination_module = excluded.destination_module, task_required = excluded.task_required, runtime_status = excluded.runtime_status;
  end loop;

  for v_record in select value from pg_catalog.jsonb_array_elements(v_payload->'records') as records(value)
    where value->>'recordType' = 'species' loop
    select id into v_record_id from master.master_records where master_key = v_record->>'masterKey';
    v_detail := v_record->'detail';
    select species_code into v_existing_code from master.species where master_record_id = v_record_id;
    if v_existing_code is not null and v_existing_code is distinct from pg_catalog.btrim(v_detail->>'speciesCode') then raise exception 'clinical_master_species_code_conflict' using errcode = '23514'; end if;
    insert into master.species (master_record_id, species_code) values (v_record_id, pg_catalog.btrim(v_detail->>'speciesCode'))
    on conflict (master_record_id) do nothing;
  end loop;

  for v_record in select value from pg_catalog.jsonb_array_elements(v_payload->'records') as records(value)
    where value->>'recordType' = 'unit' loop
    select id into v_record_id from master.master_records where master_key = v_record->>'masterKey';
    v_detail := v_record->'detail';
    select unit_code into v_existing_code from master.units where master_record_id = v_record_id;
    if v_existing_code is not null and v_existing_code is distinct from pg_catalog.btrim(v_detail->>'unitCode') then raise exception 'clinical_master_unit_code_conflict' using errcode = '23514'; end if;
    insert into master.units (master_record_id, unit_code, symbol, decimal_scale)
    values (v_record_id, pg_catalog.btrim(v_detail->>'unitCode'), pg_catalog.btrim(v_detail->>'symbol'), coalesce((v_detail->>'decimalScale')::integer, 0))
    on conflict (master_record_id) do update set symbol = excluded.symbol, decimal_scale = excluded.decimal_scale;
  end loop;

  for v_record in select value from pg_catalog.jsonb_array_elements(v_payload->'records') as records(value)
    where value->>'recordType' = 'specimen_type' loop
    select id into v_record_id from master.master_records where master_key = v_record->>'masterKey';
    v_detail := v_record->'detail';
    select specimen_code into v_existing_code from master.specimen_types where master_record_id = v_record_id;
    if v_existing_code is not null and v_existing_code is distinct from pg_catalog.btrim(v_detail->>'specimenCode') then raise exception 'clinical_master_specimen_code_conflict' using errcode = '23514'; end if;
    insert into master.specimen_types (master_record_id, specimen_code) values (v_record_id, pg_catalog.btrim(v_detail->>'specimenCode'))
    on conflict (master_record_id) do nothing;
  end loop;

  for v_record in select value from pg_catalog.jsonb_array_elements(v_payload->'records') as records(value)
    where value->>'recordType' = 'result_input_type' loop
    select id into v_record_id from master.master_records where master_key = v_record->>'masterKey';
    v_detail := v_record->'detail';
    select input_code into v_existing_code from master.result_input_types where master_record_id = v_record_id;
    if v_existing_code is not null and v_existing_code is distinct from pg_catalog.btrim(v_detail->>'inputCode') then raise exception 'clinical_master_input_code_conflict' using errcode = '23514'; end if;
    insert into master.result_input_types (master_record_id, input_code, value_kind, supports_unit)
    values (v_record_id, pg_catalog.btrim(v_detail->>'inputCode'), pg_catalog.btrim(v_detail->>'valueKind'), (v_detail->>'supportsUnit')::boolean)
    on conflict (master_record_id) do update set value_kind = excluded.value_kind, supports_unit = excluded.supports_unit;
  end loop;

  for v_path in select value from pg_catalog.jsonb_array_elements(coalesce(v_payload->'classificationPaths', '[]'::jsonb)) as paths(value) loop
    select action.master_record_id into v_action_id from master.clinical_actions action
    join master.master_records record_row on record_row.id = action.master_record_id where record_row.master_key = v_path->>'clinicalActionKey';
    select chart.master_record_id into v_chart_group_id from master.chart_groups chart
    join master.master_records record_row on record_row.id = chart.master_record_id where record_row.master_key = v_path->>'chartGroupKey';
    select route.master_record_id into v_task_route_id from master.task_routes route
    join master.master_records record_row on record_row.id = route.master_record_id where record_row.master_key = v_path->>'taskRouteKey';
    if v_action_id is null or v_chart_group_id is null or v_task_route_id is null then raise exception 'clinical_master_classification_path_reference_missing' using errcode = '23503'; end if;
    if exists (select 1 from master.task_routes where master_record_id = v_task_route_id and runtime_status <> 'active') then raise exception 'clinical_master_held_task_route_rejected' using errcode = '23514'; end if;
    select id, clinical_action_id, chart_group_id, task_route_id, retired_in_release_id into v_path_id, v_parent_id, v_t_category_id, v_unit_id, v_source_id
    from master.classification_paths where path_key = v_path->>'pathKey' for update;
    if found then
      if v_source_id is not null or v_parent_id is distinct from v_action_id or v_t_category_id is distinct from v_chart_group_id or v_unit_id is distinct from v_task_route_id then
        raise exception 'clinical_master_classification_path_identity_conflict' using errcode = '23505';
      end if;
    else
      update master.classification_paths set retired_in_release_id = v_release.id
      where clinical_action_id = v_action_id and retired_in_release_id is null;
      insert into master.classification_paths (path_key, clinical_action_id, chart_group_id, task_route_id, active_from_release_id)
      values (pg_catalog.btrim(v_path->>'pathKey'), v_action_id, v_chart_group_id, v_task_route_id, v_release.id)
      returning id into v_path_id;
    end if;
  end loop;

  for v_record in select value from pg_catalog.jsonb_array_elements(v_payload->'records') as records(value)
    where value->>'recordType' = 'order' loop
    select id into v_record_id from master.master_records where master_key = v_record->>'masterKey';
    v_detail := v_record->'detail';
    select path.id into v_path_id from master.classification_paths path
    where path.path_key = v_detail->>'classificationPathKey' and path.retired_in_release_id is null;
    if v_path_id is null then raise exception 'clinical_master_order_classification_path_required' using errcode = '23503'; end if;
    if pg_catalog.jsonb_typeof(v_detail->'species') <> 'array' or pg_catalog.jsonb_array_length(v_detail->'species') = 0 then raise exception 'clinical_master_order_species_required' using errcode = '22023'; end if;
    if exists (select 1 from pg_catalog.jsonb_array_elements(v_detail->'species') as species(value) where value #>> '{}' not in ('dog', 'cat')) then raise exception 'clinical_master_order_species_scope_failed' using errcode = '22023'; end if;
    v_unit_id := null;
    if pg_catalog.btrim(coalesce(v_detail->>'defaultSalesUnitCode', '')) <> '' then
      select unit.master_record_id into v_unit_id from master.units unit where unit.unit_code = pg_catalog.btrim(v_detail->>'defaultSalesUnitCode');
      if v_unit_id is null then raise exception 'clinical_master_order_sales_unit_missing' using errcode = '23503'; end if;
    end if;
    insert into master.orders (master_record_id, classification_path_id, default_sales_unit_id, default_billing_reflection_enabled, default_quantity)
    values (v_record_id, v_path_id, v_unit_id, coalesce((v_detail->>'defaultBillingReflectionEnabled')::boolean, true), coalesce((v_detail->>'defaultQuantity')::numeric, 1))
    on conflict (master_record_id) do update set classification_path_id = excluded.classification_path_id, default_sales_unit_id = excluded.default_sales_unit_id,
      default_billing_reflection_enabled = excluded.default_billing_reflection_enabled, default_quantity = excluded.default_quantity;
    delete from master.order_species_links where order_record_id = v_record_id;
    for v_species_id in select species.master_record_id from master.species species where species.species_code in (
      select value #>> '{}' from pg_catalog.jsonb_array_elements(v_detail->'species') as species_values(value)
    ) loop
      insert into master.order_species_links (order_record_id, species_record_id) values (v_record_id, v_species_id);
    end loop;
    if (select count(*) from master.order_species_links where order_record_id = v_record_id) <> pg_catalog.jsonb_array_length(v_detail->'species') then
      raise exception 'clinical_master_order_species_reference_missing' using errcode = '23503';
    end if;
  end loop;

  -- Names, source provenance, versions, and review events are written only for changed records.
  for v_record in select value from pg_catalog.jsonb_array_elements(v_payload->'records') as records(value) loop
    v_master_key := v_record->>'masterKey';
    select id, current_revision into v_record_id, v_revision from master.master_records where master_key = v_master_key;
    select snapshot, revision into v_existing_snapshot, v_latest_revision from master.master_record_versions
    where master_record_id = v_record_id order by revision desc limit 1;
    select action_code into v_action_code from master.clinical_actions where master_record_id = v_record_id;
    v_incoming_content := private.clinical_master_record_content(v_record, v_action_code);
    if v_existing_snapshot is not null and (v_existing_snapshot - 'revision') is not distinct from v_incoming_content then
      continue;
    end if;
    delete from master.master_record_names where master_record_id = v_record_id;
    for v_names in select value from pg_catalog.jsonb_array_elements(v_record->'names') as names(value) loop
      insert into master.master_record_names (master_record_id, language_code, name_kind, name, normalized_name, searchable, sort_order)
      values (v_record_id, v_names->>'languageCode', v_names->>'nameKind', v_names->>'name', pg_catalog.lower(pg_catalog.regexp_replace(pg_catalog.btrim(v_names->>'name'), '[[:space:]]+', ' ', 'g')),
        coalesce((v_names->>'searchable')::boolean, true), coalesce((v_names->>'sortOrder')::integer, 0));
    end loop;
    v_source := v_record->'source';
    insert into master.master_sources (source_type, title, reference_uri, source_version, accessed_at, license_notes)
    values (v_source->>'sourceType', v_source->>'title', v_source->>'referenceUri', v_source->>'sourceVersion', nullif(v_source->>'accessedAt', '')::timestamptz, v_source->>'licenseNotes') returning id into v_source_id;
    insert into master.master_record_sources (master_record_id, source_id, assertion_scope, notes)
    values (v_record_id, v_source_id, 'record', 'Validated Phase 1A-1 synthetic publisher source.');
    v_snapshot := pg_catalog.jsonb_set(v_incoming_content, '{revision}', to_jsonb(v_revision), true);
    insert into master.master_record_versions (master_record_id, revision, release_id, snapshot, change_summary, authored_by_label, reviewed_by_label)
    values (v_record_id, v_revision, v_release.id, v_snapshot, 'Phase 1A-1 validated synthetic publish.', v_payload->>'publishedByLabel', v_payload->>'publishedByLabel');
    insert into master.master_review_events (master_record_id, revision, event_type, actor_user_id, actor_label, source_surface)
    values (v_record_id, v_revision, 'validated', p_actor_user_id, v_payload->>'publishedByLabel', 'publisher');
    insert into master.master_review_events (master_record_id, revision, event_type, actor_user_id, actor_label, source_surface)
    values (v_record_id, v_revision, 'published', p_actor_user_id, v_payload->>'publishedByLabel', 'publisher');
  end loop;

  update master.master_releases set status = 'published', published_at = now() where id = v_release.id;
  return pg_catalog.jsonb_build_object(
    'releaseId', v_release.id, 'releaseNo', v_release.release_no,
    'sourceFingerprint', v_fingerprint, 'idempotent', false, 'recordCount', v_release.record_count
  );
end;
$$;

alter table master.master_releases enable row level security;
alter table master.master_records enable row level security;
alter table master.master_record_names enable row level security;
alter table master.master_sources enable row level security;
alter table master.master_record_sources enable row level security;
alter table master.master_record_versions enable row level security;
alter table master.master_review_events enable row level security;
alter table master.order_categories enable row level security;
alter table master.clinical_actions enable row level security;
alter table master.chart_groups enable row level security;
alter table master.task_routes enable row level security;
alter table master.classification_paths enable row level security;
alter table master.species enable row level security;
alter table master.units enable row level security;
alter table master.specimen_types enable row level security;
alter table master.result_input_types enable row level security;
alter table master.orders enable row level security;
alter table master.order_species_links enable row level security;

revoke all on schema master from public, anon, authenticated, service_role;
revoke all on all tables in schema master from public, anon, authenticated, service_role;
revoke all on all sequences in schema master from public, anon, authenticated, service_role;
revoke all on all functions in schema master from public, anon, authenticated, service_role;
revoke all on function private.clinical_master_has_forbidden_key(jsonb) from public, anon, authenticated, service_role;
revoke all on function private.clinical_master_assert_detail_keys(text, jsonb) from public, anon, authenticated, service_role;
revoke all on function private.clinical_master_assert_contract_keys(text, jsonb) from public, anon, authenticated, service_role;
revoke all on function private.clinical_master_canonicalize_detail(text, jsonb) from public, anon, authenticated, service_role;
revoke all on function private.clinical_master_canonicalize_payload(jsonb) from public, anon, authenticated, service_role;
revoke all on function private.clinical_master_record_content(jsonb, text) from public, anon, authenticated, service_role;
revoke all on function private.publish_clinical_master_release(jsonb, uuid) from public, anon, authenticated, service_role;
alter default privileges in schema master revoke all on tables from public, anon, authenticated, service_role;
alter default privileges in schema master revoke all on sequences from public, anon, authenticated, service_role;
alter default privileges in schema master revoke all on functions from public, anon, authenticated, service_role;

comment on schema master is 'Private CLAiR clinical master. Not exposed through the Supabase Data API; server/operator publisher only.';
comment on function private.publish_clinical_master_release(jsonb, uuid) is 'Private atomic Phase 1A-1 publisher. PostgreSQL computes the authoritative fingerprint and serializes publication with a transaction advisory lock.';
