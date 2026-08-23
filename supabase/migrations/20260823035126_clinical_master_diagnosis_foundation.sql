-- CLINICAL-MASTER-PR-007: private diagnosis master foundation.
--
-- Additive, private-only diagnosis identity/category/link schema reservation.
-- The existing A1/B1 publisher remains unchanged and continues to reject
-- diagnosis payload records until a separately approved publisher slice.

set check_function_bodies = off;

-- Fail closed when the approved Phase 1 foundation or the B1 publisher surface
-- is absent.  The migration must not silently reconstruct a partial publisher.
do $$
begin
  if to_regclass('master.master_records') is null
    or to_regclass('master.master_record_names') is null
    or to_regclass('master.master_sources') is null
    or to_regclass('master.master_record_sources') is null
    or to_regclass('master.master_record_versions') is null
    or to_regclass('master.master_review_events') is null
    or to_regclass('master.master_releases') is null
    or to_regclass('master.orders') is null
    or to_regclass('master.lab_tests') is null
    or to_regclass('master.lab_panels') is null
    or to_regclass('master.lab_panel_items') is null
    or to_regclass('master.lab_order_profiles') is null then
    raise exception 'clinical_master_diagnosis_foundation_preflight_phase1_schema_missing';
  end if;
  if to_regprocedure('private.publish_clinical_master_release(jsonb,uuid)') is null
    or to_regprocedure('private.clinical_master_assert_contract_keys(text,jsonb)') is null
    or to_regprocedure('private.clinical_master_canonicalize_payload(jsonb)') is null then
    raise exception 'clinical_master_diagnosis_foundation_preflight_publisher_missing';
  end if;
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'master.master_records'::regclass
      and conname = 'master_records_record_type_check'
  ) then
    raise exception 'clinical_master_diagnosis_foundation_preflight_record_type_check_missing';
  end if;
  if exists (
    select 1
    from master.master_records
    where record_type not in (
      'order_category', 'clinical_action', 'chart_group', 'task_route', 'order',
      'species', 'unit', 'specimen_type', 'result_input_type', 'lab_test', 'lab_panel',
      'diagnosis_category', 'diagnosis'
    )
  ) then
    raise exception 'clinical_master_diagnosis_foundation_preflight_unexpected_record_type';
  end if;
end
$$;

-- This is the only existing check being replaced.  All A1/B1 values remain
-- accepted; diagnosis values are additive.
alter table master.master_records
  drop constraint master_records_record_type_check;
alter table master.master_records
  add constraint master_records_record_type_check
  check (record_type = any (array[
    'order_category', 'clinical_action', 'chart_group', 'task_route', 'order',
    'species', 'unit', 'specimen_type', 'result_input_type', 'lab_test', 'lab_panel',
    'diagnosis_category', 'diagnosis'
  ]));

create table if not exists master.diagnosis_categories (
  master_record_id uuid primary key references master.master_records(id) on delete restrict,
  category_kind text not null check (category_kind in ('system', 'disease_group')),
  parent_category_id uuid references master.diagnosis_categories(master_record_id) on delete restrict,
  sort_order integer not null default 0 check (sort_order >= 0),
  check (
    (category_kind = 'system' and parent_category_id is null)
    or (category_kind = 'disease_group' and parent_category_id is not null)
  )
);

create table if not exists master.diagnoses (
  master_record_id uuid primary key references master.master_records(id) on delete restrict
);

create table if not exists master.diagnosis_category_links (
  diagnosis_record_id uuid not null references master.diagnoses(master_record_id) on delete restrict,
  diagnosis_category_id uuid not null references master.diagnosis_categories(master_record_id) on delete restrict,
  is_primary boolean not null default false,
  sort_order integer not null check (sort_order >= 0),
  constraint master_diagnosis_category_links_pkey
    primary key (diagnosis_record_id, diagnosis_category_id),
  constraint master_diagnosis_category_links_diagnosis_sort_key
    unique (diagnosis_record_id, sort_order)
);

create unique index if not exists master_diagnosis_category_links_one_primary_key
  on master.diagnosis_category_links (diagnosis_record_id)
  where is_primary;

create index if not exists master_diagnosis_categories_parent_idx
  on master.diagnosis_categories (parent_category_id, category_kind);
create index if not exists master_diagnosis_category_links_category_idx
  on master.diagnosis_category_links (diagnosis_category_id, diagnosis_record_id);

comment on table master.diagnosis_categories is
  'Private canonical diagnosis hierarchy reservation; system roots own disease groups.';
comment on table master.diagnoses is
  'Private canonical diagnosis identity reservation; no publisher or adoption is included.';
comment on table master.diagnosis_category_links is
  'Private diagnosis-to-disease-group classification links with one primary link per diagnosis.';
comment on column master.diagnosis_categories.category_kind is
  'system is a root; disease_group must reference exactly one system parent.';
comment on column master.diagnosis_categories.parent_category_id is
  'The sole hierarchy parent; only a system category may be referenced.';
comment on column master.diagnosis_category_links.diagnosis_category_id is
  'Must reference a disease_group category, never a system root.';

create or replace function master.assert_diagnosis_category_parent()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.category_kind = 'system' and new.parent_category_id is not null then
    raise exception 'clinical_master_diagnosis_system_parent_forbidden' using errcode = '23514';
  end if;
  if new.category_kind = 'disease_group' and new.parent_category_id is null then
    raise exception 'clinical_master_diagnosis_disease_group_parent_required' using errcode = '23514';
  end if;
  if new.parent_category_id is not null and not exists (
    select 1
    from master.diagnosis_categories parent
    where parent.master_record_id = new.parent_category_id
      and parent.category_kind = 'system'
  ) then
    raise exception 'clinical_master_diagnosis_parent_must_be_system' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function master.reject_diagnosis_category_kind_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'clinical_master_typed_projection_immutable' using errcode = '55000';
  end if;
  if new.master_record_id is distinct from old.master_record_id then
    raise exception 'clinical_master_typed_identity_immutable' using errcode = '55000';
  end if;
  if new.category_kind is distinct from old.category_kind then
    raise exception 'clinical_master_diagnosis_category_kind_immutable' using errcode = '55000';
  end if;
  return new;
end;
$$;

create or replace function master.assert_diagnosis_link_target()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from master.diagnosis_categories category
    where category.master_record_id = new.diagnosis_category_id
      and category.category_kind = 'disease_group'
  ) then
    raise exception 'clinical_master_diagnosis_link_target_must_be_disease_group'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

-- This is a deferred constraint trigger so a diagnosis and all of its links
-- may be inserted in one transaction in any statement order.  It checks the
-- final transaction state, not an intermediate row-by-row state.
create or replace function master.assert_diagnosis_link_completeness()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_diagnosis_id uuid;
  v_link_count bigint;
  v_primary_count bigint;
begin
  for v_diagnosis_id in
    select distinct candidate
    from (
      select case
        when tg_table_name = 'diagnoses' then
          case when tg_op = 'DELETE'
            then (pg_catalog.to_jsonb(old)->>'master_record_id')::uuid
            else (pg_catalog.to_jsonb(new)->>'master_record_id')::uuid
          end
        when tg_table_name = 'diagnosis_category_links' then
          case when tg_op = 'DELETE'
            then (pg_catalog.to_jsonb(old)->>'diagnosis_record_id')::uuid
            else (pg_catalog.to_jsonb(new)->>'diagnosis_record_id')::uuid
          end
      end as candidate
      union all
      select case when tg_op = 'UPDATE' then
        case
          when tg_table_name = 'diagnoses'
            then (pg_catalog.to_jsonb(old)->>'master_record_id')::uuid
          when tg_table_name = 'diagnosis_category_links'
            then (pg_catalog.to_jsonb(old)->>'diagnosis_record_id')::uuid
        end
      else null end
    ) candidates
    where candidate is not null
  loop
    if exists (
      select 1
      from master.diagnoses diagnosis
      where diagnosis.master_record_id = v_diagnosis_id
    ) then
      select count(*), count(*) filter (where link.is_primary)
        into v_link_count, v_primary_count
      from master.diagnosis_category_links link
      where link.diagnosis_record_id = v_diagnosis_id;
      if v_link_count < 1 then
        raise exception 'clinical_master_diagnosis_link_required_at_commit'
          using errcode = '23514';
      end if;
      if v_primary_count <> 1 then
        raise exception 'clinical_master_diagnosis_exactly_one_primary_at_commit'
          using errcode = '23514';
      end if;
    end if;
  end loop;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists master_diagnosis_categories_type_guard on master.diagnosis_categories;
create trigger master_diagnosis_categories_type_guard
before insert or update on master.diagnosis_categories
for each row execute function master.assert_record_type('diagnosis_category');

drop trigger if exists master_diagnosis_categories_parent_guard on master.diagnosis_categories;
create trigger master_diagnosis_categories_parent_guard
before insert or update on master.diagnosis_categories
for each row execute function master.assert_diagnosis_category_parent();

drop trigger if exists master_diagnosis_categories_identity_guard on master.diagnosis_categories;
create trigger master_diagnosis_categories_identity_guard
before update or delete on master.diagnosis_categories
for each row execute function master.reject_diagnosis_category_kind_mutation();

drop trigger if exists master_diagnoses_type_guard on master.diagnoses;
create trigger master_diagnoses_type_guard
before insert or update on master.diagnoses
for each row execute function master.assert_record_type('diagnosis');

drop trigger if exists master_diagnoses_identity_guard on master.diagnoses;
create trigger master_diagnoses_identity_guard
before update or delete on master.diagnoses
for each row execute function master.reject_code_mutation();

drop trigger if exists master_diagnosis_category_links_target_guard on master.diagnosis_category_links;
create trigger master_diagnosis_category_links_target_guard
before insert or update on master.diagnosis_category_links
for each row execute function master.assert_diagnosis_link_target();

drop trigger if exists master_diagnoses_link_completeness on master.diagnoses;
create constraint trigger master_diagnoses_link_completeness
after insert or update on master.diagnoses
deferrable initially deferred
for each row execute function master.assert_diagnosis_link_completeness();

drop trigger if exists master_diagnosis_category_links_completeness on master.diagnosis_category_links;
create constraint trigger master_diagnosis_category_links_completeness
after insert or update or delete on master.diagnosis_category_links
deferrable initially deferred
for each row execute function master.assert_diagnosis_link_completeness();

alter table master.diagnosis_categories enable row level security;
alter table master.diagnoses enable row level security;
alter table master.diagnosis_category_links enable row level security;

revoke all on schema master from public, anon, authenticated, service_role;
revoke all on master.diagnosis_categories, master.diagnoses, master.diagnosis_category_links
  from public, anon, authenticated, service_role;
revoke all on function master.assert_diagnosis_category_parent() from public, anon, authenticated, service_role;
revoke all on function master.reject_diagnosis_category_kind_mutation() from public, anon, authenticated, service_role;
revoke all on function master.assert_diagnosis_link_target() from public, anon, authenticated, service_role;
revoke all on function master.assert_diagnosis_link_completeness() from public, anon, authenticated, service_role;
