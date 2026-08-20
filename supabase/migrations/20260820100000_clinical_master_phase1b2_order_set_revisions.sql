-- CLINICAL-MASTER-PR-005 / Phase 1B-2
-- Workspace-owned immutable Order Set revisions.
-- Synthetic/local Supabase only.  B3 chart expansion, fulfillment, billing,
-- and removal of unsupported_order_type remain out of scope.

begin;

create schema if not exists private;
create extension if not exists pgcrypto with schema extensions;

-- The B2 contract uses one tenant lock shared with A2/B1 catalog/adoption
-- writers.  All public writers authenticate/authorize before this lock.
create or replace function private.clair_b2_deterministic_uuid(
  p_domain text,
  p_parts text[]
)
returns uuid
language plpgsql
immutable
security invoker
set search_path = public, private, extensions, pg_catalog
as $$
declare
  v_frame text := 'clair-b2:v1:' || length(coalesce(p_domain, ''))::text || ':' || coalesce(p_domain, '') || ':';
  v_part text;
  v_hash bytea;
  v_hex text;
begin
  if p_domain is null or btrim(p_domain) = '' then
    raise exception 'deterministic_uuid_domain_required' using errcode = '22023';
  end if;
  if p_parts is null then
    raise exception 'deterministic_uuid_parts_required' using errcode = '22023';
  end if;
  foreach v_part in array p_parts loop
    if v_part is null then
      v_frame := v_frame || '-1:';
    else
      v_frame := v_frame || length(v_part)::text || ':' || v_part || ':';
    end if;
  end loop;
  v_hash := extensions.digest(pg_catalog.convert_to(v_frame, 'UTF8'), 'sha256');
  v_hash := set_byte(v_hash, 6, (get_byte(v_hash, 6) & 15) | 128);
  v_hash := set_byte(v_hash, 8, (get_byte(v_hash, 8) & 63) | 128);
  v_hex := encode(substring(v_hash from 1 for 16), 'hex');
  return (substr(v_hex, 1, 8) || '-' || substr(v_hex, 9, 4) || '-' ||
    substr(v_hex, 13, 4) || '-' || substr(v_hex, 17, 4) || '-' ||
    substr(v_hex, 21, 12))::uuid;
end;
$$;

revoke all on function private.clair_b2_deterministic_uuid(text, text[]) from public, anon, authenticated, service_role;

create or replace function private.clair_b2_sha256(p_value jsonb)
returns text
language sql
immutable
security invoker
set search_path = public, private, extensions, pg_catalog
as $$
  select encode(
    extensions.digest(
      pg_catalog.convert_to(p_value::text, 'UTF8'),
      'sha256'
    ),
    'hex'
  );
$$;

revoke all on function private.clair_b2_sha256(jsonb) from public, anon, authenticated, service_role;

create or replace function private.clair_b2_internal_write()
returns boolean
language sql
stable
security invoker
set search_path = public, private, pg_catalog
as $$
  select pg_catalog.current_setting('clinical_master.b2_internal_write', true) = 'on';
$$;

revoke all on function private.clair_b2_internal_write() from public, anon, authenticated, service_role;

-- Existing projection columns are retained for compatibility, but the
-- current revision is now the sole authoring authority.
alter table public.order_sets
  alter column set_price_krw drop default,
  alter column set_price_krw drop not null,
  add column if not exists current_revision_id uuid,
  add column if not exists needs_composition_review boolean not null default false,
  add column if not exists range_basis text,
  add column if not exists range_price_ranges jsonb not null default '[]'::jsonb,
  add column if not exists tax_type text not null default 'derived',
  add column if not exists created_by_user_id uuid,
  add column if not exists updated_by_user_id uuid;

alter table public.order_sets
  drop constraint if exists order_sets_set_price_krw_check,
  drop constraint if exists order_sets_tax_type_check,
  drop constraint if exists order_sets_range_basis_check,
  drop constraint if exists order_sets_range_price_ranges_check,
  drop constraint if exists order_sets_range_price_ranges_array_check,
  drop constraint if exists order_sets_sales_unit_check,
  add constraint order_sets_set_price_krw_check check (set_price_krw is null or set_price_krw >= 0),
  add constraint order_sets_tax_type_check check (tax_type in ('taxable', 'non_taxable', 'derived')),
  add constraint order_sets_range_basis_check check (range_basis is null or range_basis in ('patient_weight_kg', 'manual_value')),
  add constraint order_sets_range_price_ranges_array_check check (jsonb_typeof(range_price_ranges) = 'array'),
  add constraint order_sets_sales_unit_check check (sales_unit in ('per_order', 'per_each', 'per_day', 'per_frequency', 'per_ml', 'per_kg'));

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.order_sets'::regclass and conname = 'order_sets_workspace_id_id_key') then
    alter table public.order_sets add constraint order_sets_workspace_id_id_key unique (workspace_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.order_sets'::regclass and conname = 'order_sets_created_by_user_id_fkey') then
    alter table public.order_sets add constraint order_sets_created_by_user_id_fkey foreign key (created_by_user_id) references public.users(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.order_sets'::regclass and conname = 'order_sets_updated_by_user_id_fkey') then
    alter table public.order_sets add constraint order_sets_updated_by_user_id_fkey foreign key (updated_by_user_id) references public.users(id) on delete set null;
  end if;
end
$$;

create table if not exists public.order_set_revisions (
  id uuid primary key,
  workspace_id text not null references public.workspaces(id) on delete cascade,
  order_set_id text not null,
  revision_no integer not null check (revision_no > 0),
  validation_status text not null default 'valid' check (validation_status in ('valid', 'invalid')),
  validation_errors jsonb not null default '[]'::jsonb check (jsonb_typeof(validation_errors) = 'array'),
  set_category text,
  set_name text not null check (length(btrim(set_name)) > 0),
  billing_name text not null check (length(btrim(billing_name)) > 0),
  amount_basis text not null check (amount_basis in ('included_order_sum', 'set_fixed_price', 'range_price')),
  set_price_krw integer check (set_price_krw is null or set_price_krw >= 0),
  range_basis text check (range_basis is null or range_basis in ('patient_weight_kg', 'manual_value')),
  sales_unit text not null check (sales_unit in ('per_order', 'per_each', 'per_day', 'per_frequency', 'per_ml', 'per_kg')),
  billing_reflection_enabled boolean not null,
  tax_type text not null check (tax_type in ('taxable', 'non_taxable', 'derived')),
  target_species text[] not null check (cardinality(target_species) > 0 and target_species <@ array['dog', 'cat', 'other']::text[]),
  care_guide text,
  internal_instruction text,
  created_by_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint order_set_revisions_workspace_id_key unique (workspace_id, id),
  constraint order_set_revisions_workspace_order_set_id_key unique (workspace_id, order_set_id, id),
  constraint order_set_revisions_workspace_order_set_revision_no_key unique (workspace_id, order_set_id, revision_no),
  constraint order_set_revisions_owner_same_workspace_fk foreign key (workspace_id, order_set_id)
    references public.order_sets(workspace_id, id) on delete restrict deferrable initially deferred,
  constraint order_set_revisions_pricing_mode_ck check (
    validation_status = 'invalid'
    or (amount_basis = 'set_fixed_price' and set_price_krw is not null and range_basis is null and billing_reflection_enabled and tax_type in ('taxable', 'non_taxable'))
    or (amount_basis = 'included_order_sum' and set_price_krw is null and range_basis is null and not billing_reflection_enabled and tax_type = 'derived')
    or (amount_basis = 'range_price' and set_price_krw is null and range_basis is not null and billing_reflection_enabled and tax_type in ('taxable', 'non_taxable'))
  ),
  constraint order_set_revisions_valid_errors_empty_ck check (validation_status = 'invalid' or validation_errors = '[]'::jsonb)
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.order_set_revisions'::regclass
      and conname = 'order_set_revisions_owner_same_workspace_fk'
  ) then
    alter table public.order_set_revisions
      add constraint order_set_revisions_owner_same_workspace_fk
      foreign key (workspace_id, order_set_id)
      references public.order_sets(workspace_id, id)
      on delete restrict deferrable initially deferred;
  end if;
end
$$;

create index if not exists order_set_revisions_order_set_revision_no_idx
  on public.order_set_revisions (workspace_id, order_set_id, revision_no desc);

create table if not exists public.order_set_revision_items (
  id uuid primary key,
  workspace_id text not null references public.workspaces(id) on delete cascade,
  order_set_id text not null,
  revision_id uuid not null,
  -- The spec-facing name is a generated compatibility projection; revision_id
  -- is the single internal writer key and the generated value cannot diverge.
  order_set_revision_id uuid generated always as (revision_id) stored,
  child_kind text not null check (child_kind in ('atomic', 'order_set')),
  child_order_catalog_item_id text,
  child_order_catalog_revision integer,
  child_order_set_id text,
  child_set_revision_id uuid,
  sort_order integer not null check (sort_order > 0),
  default_selected boolean not null default true,
  billing_reflection_default boolean not null default false,
  default_quantity numeric(12,3) not null check (default_quantity > 0),
  quantity_source text not null check (quantity_source in ('fixed_one', 'preset_quantity', 'manual_at_apply')),
  created_at timestamptz not null default now(),
  unique (workspace_id, revision_id, sort_order),
  constraint order_set_revision_items_revision_fk foreign key (workspace_id, order_set_id, revision_id)
    references public.order_set_revisions(workspace_id, order_set_id, id) on delete cascade,
  constraint order_set_revision_items_atomic_fk foreign key (workspace_id, child_order_catalog_item_id)
    references public.order_catalog_items(workspace_id, id) on delete restrict,
  constraint order_set_revision_items_child_set_fk foreign key (workspace_id, child_order_set_id)
    references public.order_sets(workspace_id, id) on delete restrict,
  constraint order_set_revision_items_child_revision_fk foreign key (workspace_id, child_order_set_id, child_set_revision_id)
    references public.order_set_revisions(workspace_id, order_set_id, id) on delete restrict,
  constraint order_set_revision_items_union_ck check (
    (child_kind = 'atomic'
      and child_order_catalog_item_id is not null
      and child_order_catalog_revision is not null and child_order_catalog_revision > 0
      and child_order_set_id is null and child_set_revision_id is null)
    or
    (child_kind = 'order_set'
      and child_order_catalog_item_id is null and child_order_catalog_revision is null
      and child_order_set_id is not null and child_set_revision_id is not null
      and quantity_source = 'fixed_one' and default_quantity = 1
      and billing_reflection_default = false)
  ),
  constraint order_set_revision_items_quantity_ck check (
    (quantity_source = 'fixed_one' and default_quantity = 1)
    or (quantity_source in ('preset_quantity', 'manual_at_apply') and default_quantity > 0)
  )
);

create index if not exists order_set_revision_items_revision_sort_idx
  on public.order_set_revision_items (workspace_id, order_set_id, revision_id, sort_order);

create table if not exists public.order_set_revision_price_ranges (
  id uuid primary key,
  workspace_id text not null references public.workspaces(id) on delete cascade,
  order_set_id text not null,
  revision_id uuid not null,
  order_set_revision_id uuid generated always as (revision_id) stored,
  sort_order integer not null check (sort_order > 0),
  lower_bound numeric(12,3) not null check (lower_bound >= 0),
  upper_bound numeric(12,3) check (upper_bound is null or upper_bound > lower_bound),
  price_krw integer not null check (price_krw >= 0),
  created_at timestamptz not null default now(),
  unique (workspace_id, revision_id, sort_order),
  constraint order_set_revision_price_ranges_revision_fk foreign key (workspace_id, order_set_id, revision_id)
    references public.order_set_revisions(workspace_id, order_set_id, id) on delete cascade
);

create index if not exists order_set_revision_price_ranges_revision_sort_idx
  on public.order_set_revision_price_ranges (workspace_id, order_set_id, revision_id, sort_order);

create table if not exists public.order_set_revision_update_reviews (
  id uuid primary key,
  workspace_id text not null references public.workspaces(id) on delete cascade,
  parent_order_set_id text not null,
  parent_revision_id uuid not null,
  child_order_set_id text not null,
  pinned_child_revision_id uuid not null,
  available_child_revision_id uuid not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'dismissed', 'superseded')),
  result_parent_revision_id uuid,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by_user_id uuid references public.users(id) on delete set null,
  constraint order_set_revision_update_reviews_identity_key unique (workspace_id, parent_revision_id, pinned_child_revision_id, available_child_revision_id),
  constraint order_set_revision_update_reviews_parent_set_fk foreign key (workspace_id, parent_order_set_id)
    references public.order_sets(workspace_id, id) on delete restrict,
  constraint order_set_revision_update_reviews_child_set_fk foreign key (workspace_id, child_order_set_id)
    references public.order_sets(workspace_id, id) on delete restrict,
  constraint order_set_revision_update_reviews_parent_revision_fk foreign key (workspace_id, parent_order_set_id, parent_revision_id)
    references public.order_set_revisions(workspace_id, order_set_id, id) on delete restrict deferrable initially deferred,
  constraint order_set_revision_update_reviews_pinned_child_revision_fk foreign key (workspace_id, child_order_set_id, pinned_child_revision_id)
    references public.order_set_revisions(workspace_id, order_set_id, id) on delete restrict deferrable initially deferred,
  constraint order_set_revision_update_reviews_available_child_revision_fk foreign key (workspace_id, child_order_set_id, available_child_revision_id)
    references public.order_set_revisions(workspace_id, order_set_id, id) on delete restrict deferrable initially deferred,
  constraint order_set_revision_update_reviews_result_parent_revision_fk foreign key (workspace_id, parent_order_set_id, result_parent_revision_id)
    references public.order_set_revisions(workspace_id, order_set_id, id) on delete restrict deferrable initially deferred,
  constraint order_set_revision_update_reviews_status_ck check (
    (status = 'pending' and result_parent_revision_id is null and resolved_at is null and resolved_by_user_id is null)
    or (status = 'accepted' and result_parent_revision_id is not null and resolved_at is not null and resolved_by_user_id is not null)
    or (status in ('dismissed', 'superseded') and result_parent_revision_id is null and resolved_at is not null and resolved_by_user_id is not null)
  )
);

create index if not exists order_set_revision_update_reviews_pending_idx
  on public.order_set_revision_update_reviews (workspace_id, parent_order_set_id, status, created_at desc);

create table if not exists private.order_set_legacy_quarantine (
  workspace_id text not null,
  legacy_order_set_id text not null,
  quarantine_id uuid not null,
  reason_code text not null,
  source_hash text not null check (source_hash ~ '^[0-9a-f]{64}$'),
  source_snapshot jsonb not null check (jsonb_typeof(source_snapshot) = 'object'),
  created_at timestamptz not null default now(),
  primary key (workspace_id, legacy_order_set_id),
  unique (workspace_id, quarantine_id)
);

create table if not exists private.order_set_legacy_classifications (
  workspace_id text not null,
  source_kind text not null check (source_kind in ('order_set', 'order_set_item')),
  source_id text not null,
  classification text not null check (classification in (
    'malformed_cross_workspace', 'duplicate', 'invalid_quantity',
    'unsupported_range', 'member_unavailable', 'member_invalid',
    'member_billable_price_unset', 'sum_billing_inconsistent',
    'legacy_fixed_tax_unset', 'empty_active', 'empty_unavailable', 'valid_sum'
  )),
  reason_code text not null check (length(btrim(reason_code)) > 0),
  action text not null check (action in ('backfill', 'quarantine', 'demote_and_backfill')),
  source_row jsonb not null check (jsonb_typeof(source_row) = 'object'),
  source_sha256 text not null check (source_sha256 ~ '^[0-9a-f]{64}$'),
  deterministic_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (workspace_id, source_kind, source_id),
  unique (workspace_id, deterministic_id)
);

create table if not exists private.order_set_revision_save_requests (
  workspace_id text not null,
  request_id uuid not null,
  actor_user_id uuid not null,
  order_set_id text not null,
  base_current_revision_id uuid,
  payload_sha256 text not null check (payload_sha256 ~ '^[0-9a-f]{64}$'),
  result_revision_id uuid,
  result_current_revision_id uuid,
  outcome text not null check (outcome in ('applied', 'rejected', 'conflict')),
  result_envelope jsonb not null check (jsonb_typeof(result_envelope) = 'object'),
  created_at timestamptz not null,
  completed_at timestamptz not null,
  primary key (workspace_id, request_id),
  constraint order_set_revision_save_requests_result_envelope_outcome_ck check (
    (outcome = 'applied' and result_envelope->>'ok' = 'true' and result_envelope->>'outcome' = 'applied')
    or (outcome in ('rejected', 'conflict') and result_envelope->>'ok' = 'false' and result_envelope->>'outcome' = outcome)
  )
);

create table if not exists private.order_set_creation_requests (
  workspace_id text not null,
  request_id uuid not null,
  actor_user_id uuid not null,
  order_set_id text not null,
  payload_sha256 text not null check (payload_sha256 ~ '^[0-9a-f]{64}$'),
  outcome text not null check (outcome in ('created', 'rejected')),
  result_envelope jsonb not null check (jsonb_typeof(result_envelope) = 'object'),
  created_at timestamptz not null,
  completed_at timestamptz not null,
  primary key (workspace_id, request_id),
  constraint order_set_creation_requests_result_envelope_outcome_ck check (
    (outcome = 'created' and result_envelope->>'ok' = 'true' and result_envelope->>'outcome' = 'created')
    or (outcome = 'rejected' and result_envelope->>'ok' = 'false' and result_envelope->>'outcome' = 'rejected')
  )
);

create table if not exists private.order_set_review_resolution_requests (
  workspace_id text not null,
  request_id uuid not null,
  actor_user_id uuid not null,
  review_id uuid not null,
  base_parent_revision_id uuid not null,
  expected_child_revision_id uuid not null,
  payload_sha256 text not null check (payload_sha256 ~ '^[0-9a-f]{64}$'),
  result_parent_revision_id uuid,
  result_parent_current_revision_id uuid,
  outcome text not null check (outcome in ('accepted', 'dismissed', 'superseded', 'conflict', 'obsolete')),
  result_envelope jsonb not null check (jsonb_typeof(result_envelope) = 'object'),
  created_at timestamptz not null,
  completed_at timestamptz not null,
  primary key (workspace_id, request_id),
  constraint order_set_review_resolution_requests_result_envelope_outcome_ck check (
    (outcome in ('accepted', 'dismissed') and result_envelope->>'ok' = 'true' and result_envelope->>'outcome' = outcome)
    or (outcome in ('superseded', 'conflict', 'obsolete') and result_envelope->>'ok' = 'false' and result_envelope->>'outcome' = outcome)
  )
);

create table if not exists private.order_set_review_notification_resolutions (
  workspace_id text not null,
  review_id uuid not null,
  notification_id text not null,
  resolution_status text not null check (resolution_status in ('pending', 'accepted', 'dismissed', 'superseded', 'obsolete')),
  resolved_by_user_id uuid references public.users(id) on delete set null,
  resolved_at timestamptz,
  resolution_payload jsonb not null check (jsonb_typeof(resolution_payload) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, review_id),
  unique (workspace_id, notification_id),
  constraint order_set_review_notification_resolution_status_ck check (
    (resolution_status = 'pending' and resolved_by_user_id is null and resolved_at is null)
    or (resolution_status in ('accepted', 'dismissed', 'superseded', 'obsolete') and resolved_by_user_id is not null and resolved_at is not null)
  )
);

revoke all on table private.order_set_legacy_quarantine,
  private.order_set_legacy_classifications,
  private.order_set_revision_save_requests,
  private.order_set_creation_requests,
  private.order_set_review_resolution_requests,
  private.order_set_review_notification_resolutions
  from public, anon, authenticated, service_role;

create or replace function private.clair_b2_assert_legacy_quarantine_match(
  p_workspace_id text,
  p_legacy_order_set_id text,
  p_quarantine_id uuid,
  p_reason_code text,
  p_source_hash text,
  p_source_snapshot jsonb
)
returns void
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
declare
  v_existing private.order_set_legacy_quarantine%rowtype;
begin
  select * into v_existing
  from private.order_set_legacy_quarantine
  where workspace_id=p_workspace_id and legacy_order_set_id=p_legacy_order_set_id;
  if found and (
    v_existing.quarantine_id is distinct from p_quarantine_id
    or v_existing.reason_code is distinct from p_reason_code
    or v_existing.source_hash is distinct from p_source_hash
    or v_existing.source_snapshot is distinct from p_source_snapshot
  ) then
    raise exception 'legacy_replay_payload_mismatch';
  end if;
end;
$$;
revoke all on function private.clair_b2_assert_legacy_quarantine_match(text,text,uuid,text,text,jsonb)
  from public, anon, authenticated, service_role;

create or replace function private.clair_b2_record_legacy_classification(
  p_workspace_id text,
  p_source_kind text,
  p_source_id text,
  p_classification text,
  p_reason_code text,
  p_action text,
  p_source_row jsonb,
  p_source_hash text,
  p_deterministic_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
declare
  v_existing private.order_set_legacy_classifications%rowtype;
  v_collision private.order_set_legacy_classifications%rowtype;
begin
  select * into v_existing
  from private.order_set_legacy_classifications
  where workspace_id=p_workspace_id and source_kind=p_source_kind and source_id=p_source_id;
  if found then
    if v_existing.classification is distinct from p_classification
       or v_existing.reason_code is distinct from p_reason_code
       or v_existing.action is distinct from p_action
       or v_existing.source_row is distinct from p_source_row
       or v_existing.source_sha256 is distinct from p_source_hash
       or v_existing.deterministic_id is distinct from p_deterministic_id then
      raise exception 'legacy_replay_payload_mismatch';
    end if;
    return;
  end if;
  select * into v_collision
  from private.order_set_legacy_classifications
  where workspace_id=p_workspace_id and deterministic_id=p_deterministic_id;
  if found then raise exception 'legacy_deterministic_id_collision'; end if;
  insert into private.order_set_legacy_classifications(
    workspace_id,source_kind,source_id,classification,reason_code,action,
    source_row,source_sha256,deterministic_id
  ) values (
    p_workspace_id,p_source_kind,p_source_id,p_classification,p_reason_code,p_action,
    p_source_row,p_source_hash,p_deterministic_id
  );
end;
$$;
revoke all on function private.clair_b2_record_legacy_classification(text,text,text,text,text,text,jsonb,text,uuid)
  from public, anon, authenticated, service_role;

-- A replay must never let ON CONFLICT DO NOTHING hide a changed payload.  The
-- deterministic identity is only a row address; these helpers compare every
-- immutable value supplied by the backfill before an idempotent re-run may
-- continue.  created_at is deliberately excluded because it is generated by
-- the native row, while the source hash/evidence table covers the legacy
-- timestamp and complete source payload.
create or replace function private.clair_b2_assert_legacy_revision_match(
  p_revision_id uuid,
  p_expected jsonb
)
returns void
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
declare
  v_existing jsonb;
  v_key text;
begin
  select to_jsonb(r) into v_existing
  from public.order_set_revisions r
  where r.id = p_revision_id;
  if not found then return; end if;
  for v_key in select jsonb_object_keys(p_expected) loop
    if (v_existing -> v_key) is distinct from (p_expected -> v_key) then
      raise exception 'legacy_replay_payload_mismatch';
    end if;
  end loop;
end;
$$;
revoke all on function private.clair_b2_assert_legacy_revision_match(uuid,jsonb)
  from public, anon, authenticated, service_role;

create or replace function private.clair_b2_assert_legacy_item_match(
  p_item_id uuid,
  p_expected jsonb
)
returns void
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
declare
  v_existing jsonb;
  v_key text;
begin
  select to_jsonb(i) into v_existing
  from public.order_set_revision_items i
  where i.id = p_item_id;
  if not found then return; end if;
  for v_key in select jsonb_object_keys(p_expected) loop
    if (v_existing -> v_key) is distinct from (p_expected -> v_key) then
      raise exception 'legacy_replay_payload_mismatch';
    end if;
  end loop;
end;
$$;
revoke all on function private.clair_b2_assert_legacy_item_match(uuid,jsonb)
  from public, anon, authenticated, service_role;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.order_sets'::regclass
      and conname = 'order_sets_current_revision_same_set_fk'
  ) then
    alter table public.order_sets
      add constraint order_sets_current_revision_same_set_fk
      foreign key (workspace_id, id, current_revision_id)
      references public.order_set_revisions(workspace_id, order_set_id, id)
      on delete restrict deferrable initially deferred;
  end if;
end
$$;

-- The old chart search union exposed mutable Order Set rows.  Preserve its
-- exact eight-column return signature while making B2 atomic-only.
drop function if exists public.clair_list_order_catalog_chart_search(text);
create function public.clair_list_order_catalog_chart_search(p_workspace_id text)
returns table (
  row_type text, source_preset_id text, source_preset_version text,
  display_name text, billing_name text, category_group text,
  target_species text[], applied_snapshot jsonb
)
language sql
security invoker
set search_path = public
as $$
  select 'individual'::text, item.standard_order_id, item.source_preset_version,
    item.in_hospital_order_name, item.billing_name, item.category_group,
    item.target_species,
    jsonb_build_object(
      'sourcePresetId', item.standard_order_id,
      'sourcePresetVersion', item.source_preset_version,
      'workspaceCatalogItemId', item.id,
      'appliedStandardOrderName', item.standard_order_name,
      'appliedDisplayName', item.in_hospital_order_name,
      'appliedBillingName', item.billing_name,
      'appliedPriceKrw', item.price_krw,
      'appliedSalesUnit', item.sales_unit,
      'appliedTaxIncluded', item.tax_included,
      'appliedAmountBasis', item.pricing_rule ->> 'priceBasis',
      'appliedTargetSpecies', to_jsonb(item.target_species),
      'appliedCareGuide', item.care_guide,
      'appliedInternalInstruction', item.internal_instruction,
      'appliedDestinationModule', item.default_destination_module,
      'appliedTaskRequired', item.default_task_required,
      'billingReflectionEnabled', item.billing_reflection_enabled
    )
  from public.order_catalog_items item
  where item.workspace_id = p_workspace_id
    and item.availability_status = 'active';
$$;

revoke all on function public.clair_list_order_catalog_chart_search(text) from public, anon, service_role;
grant execute on function public.clair_list_order_catalog_chart_search(text) to authenticated;

-- The legacy view must not remain an alternate set-search path.  Keep its
-- existing eight-column shape but expose atomic catalog rows only until B3
-- owns a discriminated set projection.
create or replace view public.order_catalog_chart_search as
select
  'individual'::text as row_type,
  item.id as source_preset_id,
  item.source_preset_version,
  item.in_hospital_order_name as display_name,
  item.billing_name,
  item.category_group,
  item.target_species,
  jsonb_build_object(
    'sourcePresetId', item.standard_order_id,
    'sourcePresetVersion', item.source_preset_version,
    'appliedDisplayName', item.in_hospital_order_name,
    'appliedBillingName', item.billing_name,
    'appliedPriceKrw', item.price_krw,
    'appliedSalesUnit', item.sales_unit,
    'appliedTaxIncluded', item.tax_included,
    'appliedAmountBasis', item.pricing_rule ->> 'priceBasis',
    'billingReflectionEnabled', item.billing_reflection_enabled
  ) as applied_snapshot
from public.order_catalog_items item
where item.availability_status = 'active';

-- Internal immutable-row gate.  Normal application roles have no DML grants;
-- this trigger also protects an owner session from accidentally mutating old
-- revision history outside the B2 primitives.
create or replace function private.clair_b2_immutable_revision_guard()
returns trigger
language plpgsql
security invoker
set search_path = public, private, pg_catalog
as $$
begin
  if not private.clair_b2_internal_write() then
    raise exception 'order_set_revision_immutable' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists order_set_revisions_immutable on public.order_set_revisions;
create trigger order_set_revisions_immutable
before update or delete on public.order_set_revisions
for each row execute function private.clair_b2_immutable_revision_guard();
drop trigger if exists order_set_revision_items_immutable on public.order_set_revision_items;
create trigger order_set_revision_items_immutable
before update or delete on public.order_set_revision_items
for each row execute function private.clair_b2_immutable_revision_guard();
drop trigger if exists order_set_revision_price_ranges_immutable on public.order_set_revision_price_ranges;
create trigger order_set_revision_price_ranges_immutable
before update or delete on public.order_set_revision_price_ranges
for each row execute function private.clair_b2_immutable_revision_guard();
revoke all on function private.clair_b2_immutable_revision_guard() from public, anon, authenticated, service_role;

create or replace function private.clair_b2_projection_write_guard()
returns trigger
language plpgsql
security invoker
set search_path = public, private, pg_catalog
as $$
begin
  if not private.clair_b2_internal_write()
     and (
       old.current_revision_id is distinct from new.current_revision_id
       or old.availability_status is distinct from new.availability_status
       or old.needs_composition_review is distinct from new.needs_composition_review
       or old.source_set_version is distinct from new.source_set_version
       or old.set_category is distinct from new.set_category
       or old.set_name is distinct from new.set_name
       or old.billing_name is distinct from new.billing_name
       or old.amount_basis is distinct from new.amount_basis
       or old.set_price_krw is distinct from new.set_price_krw
       or old.range_basis is distinct from new.range_basis
       or old.range_price_ranges is distinct from new.range_price_ranges
       or old.sales_unit is distinct from new.sales_unit
       or old.billing_reflection_enabled is distinct from new.billing_reflection_enabled
       or old.target_species is distinct from new.target_species
       or old.tax_type is distinct from new.tax_type
       or old.care_guide is distinct from new.care_guide
       or old.internal_instruction is distinct from new.internal_instruction
       or old.created_by_user_id is distinct from new.created_by_user_id
       or old.updated_by_user_id is distinct from new.updated_by_user_id
       or old.updated_at is distinct from new.updated_at
     ) then
    raise exception 'order_set_projection_writer_required' using errcode='42501';
  end if;
  return new;
end;
$$;

drop trigger if exists order_sets_b2_projection_write_guard on public.order_sets;
create trigger order_sets_b2_projection_write_guard
before update on public.order_sets
for each row execute function private.clair_b2_projection_write_guard();
revoke all on function private.clair_b2_projection_write_guard() from public, anon, authenticated, service_role;

create or replace function private.clair_b2_validate_current_projection(p_workspace_id text, p_order_set_id text)
returns void
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
declare
  v_set public.order_sets%rowtype;
  v_revision public.order_set_revisions%rowtype;
begin
  select * into v_set from public.order_sets where workspace_id = p_workspace_id and id = p_order_set_id;
  if not found then return; end if;
  if v_set.current_revision_id is null then
    if not exists (
      select 1
      from private.order_set_legacy_quarantine q
      where q.workspace_id = p_workspace_id
        and q.legacy_order_set_id = p_order_set_id
        and q.reason_code in ('legacy_malformed','legacy_duplicate_atomic','legacy_invalid_quantity','legacy_range_unsupported','legacy_member_unavailable','legacy_member_invalid','legacy_member_billable_price_unset','sum_billing_inconsistent','legacy_fixed_tax_unset')
        and q.quarantine_id = private.clair_b2_deterministic_uuid('quarantine',array[p_workspace_id::text,'order_set',p_order_set_id::text,q.reason_code]::text[])
        and v_set.availability_status = 'inactive'
        and not v_set.needs_composition_review
        and v_set.source_set_version = 'order-set-quarantine-' || q.quarantine_id::text
        and v_set.set_category is null
        and v_set.set_name = 'Quarantined Order Set ' || q.quarantine_id::text
        and v_set.billing_name = 'Quarantined Order Set ' || q.quarantine_id::text
        and v_set.amount_basis = 'included_order_sum'
        and v_set.set_price_krw is null
        and v_set.range_basis is null
        and v_set.range_price_ranges = '[]'::jsonb
        and v_set.sales_unit = 'per_each'
        and not v_set.billing_reflection_enabled
        and v_set.tax_type = 'derived'
        and v_set.target_species = array['dog','cat','other']::text[]
        and v_set.care_guide is null
        and v_set.internal_instruction is null
    ) then
      raise exception 'order_set_current_revision_required';
    end if;
    return;
  end if;
  select * into v_revision from public.order_set_revisions
  where workspace_id = p_workspace_id and order_set_id = p_order_set_id and id = v_set.current_revision_id;
  if not found or v_revision.validation_status <> 'valid' then raise exception 'order_set_current_revision_invalid'; end if;
  if v_set.source_set_version <> 'order-set-revision-' || v_revision.revision_no::text
     or v_set.set_name is distinct from v_revision.set_name
     or v_set.billing_name is distinct from v_revision.billing_name
     or v_set.set_category is distinct from v_revision.set_category
     or v_set.amount_basis is distinct from v_revision.amount_basis
     or v_set.set_price_krw is distinct from v_revision.set_price_krw
     or v_set.range_basis is distinct from v_revision.range_basis
     or v_set.sales_unit is distinct from v_revision.sales_unit
     or v_set.billing_reflection_enabled is distinct from v_revision.billing_reflection_enabled
     or v_set.tax_type is distinct from v_revision.tax_type
     or v_set.target_species is distinct from v_revision.target_species
     or v_set.care_guide is distinct from v_revision.care_guide
     or v_set.internal_instruction is distinct from v_revision.internal_instruction then
    raise exception 'order_set_current_projection_mismatch';
  end if;
  if v_set.amount_basis <> 'range_price' and v_set.range_price_ranges <> '[]'::jsonb then
    raise exception 'order_set_range_projection_mismatch';
  end if;
  if v_set.amount_basis = 'range_price' and (v_set.range_basis is null or jsonb_array_length(v_set.range_price_ranges) < 1) then
    raise exception 'order_set_range_projection_mismatch';
  end if;
  if v_set.availability_status = 'active' and not v_set.needs_composition_review then
    if not exists (
      select 1
      from public.order_set_revision_items i
      left join public.order_catalog_items c
        on c.workspace_id = i.workspace_id and c.id = i.child_order_catalog_item_id
      where i.workspace_id = p_workspace_id
        and i.order_set_id = p_order_set_id
        and i.revision_id = v_revision.id
        and i.default_selected
        and (
          (
            i.child_kind = 'atomic'
            and c.id is not null
            and c.availability_status = 'active'
            and (not i.billing_reflection_default or c.price_krw is not null)
          )
          or (
            i.child_kind = 'order_set'
            and exists (
              select 1
              from public.order_sets child
              join public.order_set_revisions child_revision
                on child_revision.workspace_id = child.workspace_id
               and child_revision.order_set_id = child.id
               and child_revision.id = i.child_set_revision_id
              join public.order_set_revision_items nested_i
                on nested_i.workspace_id = child_revision.workspace_id
               and nested_i.order_set_id = child_revision.order_set_id
               and nested_i.revision_id = child_revision.id
              left join public.order_catalog_items nested_c
                on nested_c.workspace_id = nested_i.workspace_id
               and nested_c.id = nested_i.child_order_catalog_item_id
              where child.workspace_id = i.workspace_id
                and child.id = i.child_order_set_id
                and child.availability_status = 'active'
                and not child.needs_composition_review
                and child_revision.validation_status = 'valid'
                and nested_i.child_kind = 'atomic'
                and nested_i.default_selected
                and nested_c.id is not null
                and nested_c.availability_status = 'active'
                and (not nested_i.billing_reflection_default or nested_c.price_krw is not null)
            )
          )
        )
    ) then
      raise exception 'order_set_active_member_required';
    end if;
    if private.clair_b2_revision_composition_blocked(p_workspace_id, p_order_set_id, v_revision.id) then
      raise exception 'order_set_active_member_required';
    end if;
  end if;
end;
$$;

revoke all on function private.clair_b2_validate_current_projection(text, text) from public, anon, authenticated, service_role;

create or replace function private.clair_b2_current_projection_trigger()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
begin
  if new.current_revision_id is null
     and new.source_set_version = 'order-set-pending'
     and private.clair_b2_internal_write() then
    return new;
  end if;
  perform private.clair_b2_validate_current_projection(new.workspace_id, new.id);
  return new;
end;
$$;

revoke all on function private.clair_b2_current_projection_trigger() from public, anon, authenticated, service_role;

-- Legacy backfill runs before the public pointer primitive is declared below,
-- so install the same trusted writer here with an inline range projection.
-- The later CREATE OR REPLACE is intentionally identical in contract.
create or replace function private.clair_b2_apply_projection(
  p_workspace_id text,
  p_order_set_id text,
  p_revision_id uuid,
  p_availability_status text,
  p_needs_composition_review boolean,
  p_actor_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
declare
  v_revision public.order_set_revisions%rowtype;
begin
  if p_availability_status not in ('active','paused','inactive') then raise exception 'availability_status_invalid'; end if;
  select * into v_revision
  from public.order_set_revisions
  where workspace_id=p_workspace_id and order_set_id=p_order_set_id and id=p_revision_id
  for update;
  if not found or v_revision.validation_status <> 'valid' then raise exception 'order_set_revision_invalid'; end if;
  perform set_config('clinical_master.b2_internal_write','on',true);
  update public.order_sets set
    current_revision_id=v_revision.id,
    source_set_version='order-set-revision-' || v_revision.revision_no::text,
    set_category=v_revision.set_category,
    set_name=v_revision.set_name,
    billing_name=v_revision.billing_name,
    amount_basis=v_revision.amount_basis,
    set_price_krw=v_revision.set_price_krw,
    range_basis=v_revision.range_basis,
    range_price_ranges=coalesce((select jsonb_agg(jsonb_build_object('id',pr.id::text,'sortOrder',pr.sort_order,'lowerBound',pr.lower_bound,'upperBound',pr.upper_bound,'priceKrw',pr.price_krw) order by pr.sort_order) from public.order_set_revision_price_ranges pr where pr.workspace_id=p_workspace_id and pr.order_set_id=p_order_set_id and pr.revision_id=v_revision.id),'[]'::jsonb),
    sales_unit=v_revision.sales_unit,
    billing_reflection_enabled=v_revision.billing_reflection_enabled,
    tax_type=v_revision.tax_type,
    target_species=v_revision.target_species,
    care_guide=v_revision.care_guide,
    internal_instruction=v_revision.internal_instruction,
    availability_status=p_availability_status,
    needs_composition_review=p_needs_composition_review,
    updated_by_user_id=p_actor_user_id,
    updated_at=now()
  where workspace_id=p_workspace_id and id=p_order_set_id;
  if not found then raise exception 'order_set_not_found'; end if;
end;
$$;
revoke all on function private.clair_b2_apply_projection(text,text,uuid,text,boolean,uuid) from public, anon, authenticated, service_role;

create or replace function private.clair_b2_apply_quarantine_projection(
  p_workspace_id text,
  p_order_set_id text,
  p_actor_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
declare
  v_quarantine_id uuid;
begin
  select q.quarantine_id into v_quarantine_id
  from private.order_set_legacy_quarantine q
  where q.workspace_id=p_workspace_id and q.legacy_order_set_id=p_order_set_id;
  if not found then raise exception 'legacy_quarantine_evidence_required'; end if;
  perform set_config('clinical_master.b2_internal_write','on',true);
  update public.order_sets set
    current_revision_id=null,
    availability_status='inactive',
    needs_composition_review=false,
    set_name='Quarantined Order Set ' || v_quarantine_id::text,
    billing_name='Quarantined Order Set ' || v_quarantine_id::text,
    source_set_version='order-set-quarantine-' || v_quarantine_id::text,
    set_category=null,
    amount_basis='included_order_sum',
    set_price_krw=null,
    range_basis=null,
    range_price_ranges='[]'::jsonb,
    sales_unit='per_each',
    billing_reflection_enabled=false,
    tax_type='derived',
    target_species=array['dog','cat','other']::text[],
    care_guide=null,
    internal_instruction=null,
    updated_by_user_id=p_actor_user_id,
    updated_at=now()
  where workspace_id=p_workspace_id and id=p_order_set_id;
  if not found then raise exception 'order_set_not_found'; end if;
end;
$$;
revoke all on function private.clair_b2_apply_quarantine_projection(text,text,uuid) from public, anon, authenticated, service_role;

-- Reapply must inspect the immutable original evidence first.  Projection
-- columns may now contain the quarantine sentinel or normalized revision
-- fields, so they are never re-hashed as if they were the legacy source.
create or replace function private.clair_b2_assert_legacy_replay_artifacts(
  p_workspace_id text,
  p_order_set_id text,
  p_classification text,
  p_reason_code text,
  p_source_row jsonb,
  p_source_hash text,
  p_deterministic_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
declare
  v_set public.order_sets%rowtype;
  v_revision public.order_set_revisions%rowtype;
  v_revision_item public.order_set_revision_items%rowtype;
  v_item public.order_set_items%rowtype;
  v_evidence private.order_set_legacy_classifications%rowtype;
  v_quarantine private.order_set_legacy_quarantine%rowtype;
  v_revision_id uuid;
  v_item_count integer;
  v_revision_item_count integer;
  v_rank integer;
  v_expected_availability text;
  v_expected_target_species text[];
  v_expected_ranges jsonb;
begin
  if private.clair_b2_sha256(p_source_row) is distinct from p_source_hash
     or private.clair_b2_deterministic_uuid('quarantine',array[p_workspace_id,'order_set',p_order_set_id,p_reason_code]::text[]) is distinct from p_deterministic_id then
    raise exception 'legacy_replay_payload_mismatch';
  end if;
  select * into v_set from public.order_sets where workspace_id=p_workspace_id and id=p_order_set_id;
  if not found then raise exception 'legacy_replay_payload_mismatch'; end if;
  if p_classification in ('valid_sum','empty_active','empty_unavailable') then
    v_revision_id := private.clair_b2_deterministic_uuid('revision',array[p_workspace_id,p_order_set_id,'1']::text[]);
    if v_set.current_revision_id is distinct from v_revision_id then raise exception 'legacy_replay_payload_mismatch'; end if;
    select * into v_revision from public.order_set_revisions where workspace_id=p_workspace_id and order_set_id=p_order_set_id and id=v_revision_id;
    if not found or v_revision.validation_status <> 'valid' then raise exception 'legacy_replay_payload_mismatch'; end if;
    select coalesce(array_agg(value order by ordinality),'{}'::text[]) into v_expected_target_species
    from jsonb_array_elements_text(p_source_row->'targetSpecies') with ordinality as species(value,ordinality);
    if v_revision.set_category is distinct from p_source_row->>'setCategory'
       or v_revision.set_name is distinct from p_source_row->>'setName'
       or v_revision.billing_name is distinct from p_source_row->>'billingName'
       or v_revision.amount_basis is distinct from 'included_order_sum'
       or v_revision.set_price_krw is not null
       or v_revision.range_basis is not null
       or v_revision.sales_unit is distinct from p_source_row->>'salesUnit'
       or v_revision.billing_reflection_enabled is not false
       or v_revision.tax_type is distinct from 'derived'
       or v_revision.target_species is distinct from v_expected_target_species
       or v_revision.care_guide is distinct from p_source_row->>'careGuide'
       or v_revision.internal_instruction is distinct from p_source_row->>'internalInstruction' then
      raise exception 'legacy_replay_payload_mismatch';
    end if;
    select coalesce(jsonb_agg(jsonb_build_object('id',pr.id::text,'sortOrder',pr.sort_order,'lowerBound',pr.lower_bound,'upperBound',pr.upper_bound,'priceKrw',pr.price_krw) order by pr.sort_order),'[]'::jsonb) into v_expected_ranges
    from public.order_set_revision_price_ranges pr
    where pr.workspace_id=p_workspace_id and pr.order_set_id=p_order_set_id and pr.revision_id=v_revision_id;
    if v_set.current_revision_id is distinct from v_revision_id
       or v_set.source_set_version is distinct from 'order-set-revision-1'
       or v_set.set_category is distinct from v_revision.set_category
       or v_set.set_name is distinct from v_revision.set_name
       or v_set.billing_name is distinct from v_revision.billing_name
       or v_set.amount_basis is distinct from v_revision.amount_basis
       or v_set.set_price_krw is distinct from v_revision.set_price_krw
       or v_set.range_basis is distinct from v_revision.range_basis
       or v_set.range_price_ranges is distinct from v_expected_ranges
       or v_set.sales_unit is distinct from v_revision.sales_unit
       or v_set.billing_reflection_enabled is distinct from v_revision.billing_reflection_enabled
       or v_set.tax_type is distinct from v_revision.tax_type
       or v_set.target_species is distinct from v_revision.target_species
       or v_set.care_guide is distinct from v_revision.care_guide
       or v_set.internal_instruction is distinct from v_revision.internal_instruction
       or v_set.needs_composition_review is not false then
      raise exception 'legacy_replay_payload_mismatch';
    end if;
    if p_classification in ('empty_active','empty_unavailable') then
      if exists (select 1 from public.order_set_revision_items where workspace_id=p_workspace_id and order_set_id=p_order_set_id and revision_id=v_revision_id)
         or exists (select 1 from public.order_set_revision_price_ranges where workspace_id=p_workspace_id and order_set_id=p_order_set_id and revision_id=v_revision_id) then
        raise exception 'legacy_replay_payload_mismatch';
      end if;
      for v_item in select i.* from public.order_set_items i where i.workspace_id=p_workspace_id and i.order_set_id=p_order_set_id loop
        select * into v_evidence from private.order_set_legacy_classifications c where c.workspace_id=p_workspace_id and c.source_kind='order_set_item' and c.source_id=v_item.id::text;
        if not found
           or v_evidence.source_sha256 is distinct from private.clair_b2_sha256(to_jsonb(v_item))
           or v_evidence.deterministic_id is distinct from private.clair_b2_deterministic_uuid('quarantine',array[p_workspace_id,'order_set_item',v_item.id::text,v_evidence.reason_code]::text[]) then
          raise exception 'legacy_replay_payload_mismatch';
        end if;
      end loop;
      select count(*) into v_item_count from public.order_set_items i where i.workspace_id=p_workspace_id and i.order_set_id=p_order_set_id;
      if v_item_count <> jsonb_array_length(coalesce(p_source_row->'items','[]'::jsonb)) then raise exception 'legacy_replay_payload_mismatch'; end if;
      v_expected_availability := case when p_classification='empty_active' then 'paused' else p_source_row->>'availabilityStatus' end;
      if v_set.availability_status is distinct from v_expected_availability then raise exception 'legacy_replay_payload_mismatch'; end if;
    else
      select count(*) into v_item_count from public.order_set_items i where i.workspace_id=p_workspace_id and i.order_set_id=p_order_set_id;
      select count(*) into v_revision_item_count from public.order_set_revision_items i where i.workspace_id=p_workspace_id and i.order_set_id=p_order_set_id and i.revision_id=v_revision_id;
      if v_item_count <> v_revision_item_count or v_item_count <> jsonb_array_length(coalesce(p_source_row->'items','[]'::jsonb)) then raise exception 'legacy_replay_payload_mismatch'; end if;
      for v_item in
        select i.*
        from public.order_set_items i
        where i.workspace_id=p_workspace_id and i.order_set_id=p_order_set_id
        order by i.sort_order,i.id
      loop
        select ranked.item_rank into v_rank
        from (
          select i.id, row_number() over (order by i.sort_order,i.id)::integer as item_rank
          from public.order_set_items i
          where i.workspace_id=p_workspace_id and i.order_set_id=p_order_set_id
        ) ranked
        where ranked.id=v_item.id;
        select * into v_evidence
        from private.order_set_legacy_classifications c
        where c.workspace_id=p_workspace_id and c.source_kind='order_set_item' and c.source_id=v_item.id::text;
        if not found
           or v_evidence.source_sha256 is distinct from private.clair_b2_sha256(to_jsonb(v_item))
           or v_evidence.deterministic_id is distinct from private.clair_b2_deterministic_uuid('quarantine',array[p_workspace_id,'order_set_item',v_item.id::text,v_evidence.reason_code]::text[]) then
          raise exception 'legacy_replay_payload_mismatch';
        end if;
        select * into v_revision_item
        from public.order_set_revision_items i
        where i.workspace_id=p_workspace_id and i.order_set_id=p_order_set_id and i.revision_id=v_revision_id and i.sort_order=v_rank;
        if not found or v_revision_item.child_kind <> 'atomic'
           or v_revision_item.child_order_catalog_item_id is distinct from v_item.child_order_id
           or v_revision_item.id is distinct from private.clair_b2_deterministic_uuid('item',array[
             p_workspace_id,p_order_set_id,v_revision_id::text,v_rank::text,'atomic',
             v_item.child_order_id::text,v_revision_item.child_order_catalog_revision::text,null,null
           ]::text[])
           or v_revision_item.default_selected is distinct from v_item.default_selected
           or v_revision_item.billing_reflection_default is distinct from v_item.billing_reflection_default
           or v_revision_item.default_quantity is distinct from v_item.default_quantity
           or v_revision_item.quantity_source is distinct from v_item.quantity_source then
          raise exception 'legacy_replay_payload_mismatch';
        end if;
      end loop;
    end if;
    if p_classification in ('empty_active','empty_unavailable') then
      select * into v_quarantine from private.order_set_legacy_quarantine q where q.workspace_id=p_workspace_id and q.legacy_order_set_id=p_order_set_id;
      if not found
         or v_quarantine.quarantine_id is distinct from private.clair_b2_deterministic_uuid('quarantine',array[p_workspace_id,'order_set',p_order_set_id,p_reason_code]::text[])
         or v_quarantine.reason_code is distinct from p_reason_code
         or v_quarantine.source_hash is distinct from p_source_hash
         or v_quarantine.source_snapshot is distinct from p_source_row then
        raise exception 'legacy_replay_payload_mismatch';
      end if;
    end if;
    return;
  end if;
  select * into v_quarantine from private.order_set_legacy_quarantine q where q.workspace_id=p_workspace_id and q.legacy_order_set_id=p_order_set_id;
  if not found
     or v_quarantine.quarantine_id is distinct from private.clair_b2_deterministic_uuid('quarantine',array[p_workspace_id,'order_set',p_order_set_id,p_reason_code]::text[])
     or v_quarantine.reason_code is distinct from p_reason_code
     or v_quarantine.source_hash is distinct from p_source_hash
     or v_quarantine.source_snapshot is distinct from p_source_row
     or v_set.current_revision_id is not null
     or v_set.availability_status <> 'inactive'
     or v_set.needs_composition_review is not false
     or v_set.source_set_version is distinct from 'order-set-quarantine-' || v_quarantine.quarantine_id::text
     or v_set.set_category is not null
     or v_set.set_name is distinct from 'Quarantined Order Set ' || v_quarantine.quarantine_id::text
     or v_set.billing_name is distinct from 'Quarantined Order Set ' || v_quarantine.quarantine_id::text
     or v_set.amount_basis is distinct from 'included_order_sum'
     or v_set.set_price_krw is not null
     or v_set.range_basis is not null
     or v_set.range_price_ranges is distinct from '[]'::jsonb
     or v_set.sales_unit is distinct from 'per_each'
     or v_set.billing_reflection_enabled is not false
     or v_set.tax_type is distinct from 'derived'
     or v_set.target_species is distinct from array['dog','cat','other']::text[] then
    raise exception 'legacy_replay_payload_mismatch';
  end if;
  for v_item in select i.* from public.order_set_items i where i.workspace_id=p_workspace_id and i.order_set_id=p_order_set_id loop
    select * into v_evidence from private.order_set_legacy_classifications c where c.workspace_id=p_workspace_id and c.source_kind='order_set_item' and c.source_id=v_item.id::text;
    if not found
       or v_evidence.source_sha256 is distinct from private.clair_b2_sha256(to_jsonb(v_item))
       or v_evidence.deterministic_id is distinct from private.clair_b2_deterministic_uuid('quarantine',array[p_workspace_id,'order_set_item',v_item.id::text,v_evidence.reason_code]::text[]) then
      raise exception 'legacy_replay_payload_mismatch';
    end if;
  end loop;
  select count(*) into v_item_count from public.order_set_items i where i.workspace_id=p_workspace_id and i.order_set_id=p_order_set_id;
  if v_item_count <> jsonb_array_length(coalesce(p_source_row->'items','[]'::jsonb)) then raise exception 'legacy_replay_payload_mismatch'; end if;
end;
$$;
revoke all on function private.clair_b2_assert_legacy_replay_artifacts(text,text,text,text,jsonb,text,uuid) from public, anon, authenticated, service_role;

-- Backfill first.  The deferred invariant is installed after legacy rows have
-- received either a valid revision pointer or the deterministic quarantine
-- sentinel, so a reset cannot fail on the intermediate legacy shape.
drop trigger if exists order_sets_current_projection_deferred on public.order_sets;

-- Existing legacy rows are classified once.  The original source row is never
-- treated as a price snapshot authority.
do $$
declare
  v_set public.order_sets%rowtype;
  v_item record;
  v_revision uuid;
  v_hash text;
  v_reason text;
  v_count integer;
  v_source jsonb;
  v_existing_hash text;
  v_classification text;
  v_reason_code text;
  v_action text;
  v_quarantine_id uuid;
  v_item_classification text;
  v_item_reason_code text;
  v_item_action text;
  v_item_hash text;
  v_item_id uuid;
  v_item_sort integer;
  v_catalog_revision integer;
  v_expected jsonb;
  v_existing_classification private.order_set_legacy_classifications%rowtype;
  v_now timestamptz := now();
begin
  for v_set in select * from public.order_sets order by workspace_id, id loop
    select * into v_existing_classification
    from private.order_set_legacy_classifications c
    where c.workspace_id=v_set.workspace_id and c.source_kind='order_set' and c.source_id=v_set.id;
    if found then
      perform private.clair_b2_assert_legacy_replay_artifacts(
        v_set.workspace_id,
        v_set.id,
        v_existing_classification.classification,
        v_existing_classification.reason_code,
        v_existing_classification.source_row,
        v_existing_classification.source_sha256,
        v_existing_classification.deterministic_id
      );
      continue;
    end if;
    v_source := jsonb_build_object(
      'id', v_set.id, 'workspaceId', v_set.workspace_id, 'sourceSetVersion', v_set.source_set_version,
      'setCategory', v_set.set_category, 'setName', v_set.set_name, 'billingName', v_set.billing_name,
      'availabilityStatus', v_set.availability_status, 'amountBasis', v_set.amount_basis,
      'setPriceKrw', v_set.set_price_krw, 'salesUnit', v_set.sales_unit,
      'billingReflectionEnabled', v_set.billing_reflection_enabled, 'targetSpecies', v_set.target_species,
      'careGuide', v_set.care_guide, 'internalInstruction', v_set.internal_instruction,
      'items', coalesce((select jsonb_agg(to_jsonb(i) order by i.sort_order, i.id) from public.order_set_items i where i.workspace_id = v_set.workspace_id and i.order_set_id = v_set.id), '[]'::jsonb)
    );
    v_hash := private.clair_b2_sha256(v_source);
    if v_set.current_revision_id is not null then
      -- Rows created by the native B2 seed/API have no legacy evidence row;
      -- their revision/pointer contract is validated by the later deferred
      -- trigger.  A pre-existing legacy row with a pointer but no immutable
      -- classification is an unsafe partial backfill and must stop.
      if exists (
        select 1 from public.order_set_revisions r
        where r.workspace_id=v_set.workspace_id
          and r.order_set_id=v_set.id
          and r.id=v_set.current_revision_id
          and v_set.source_set_version = 'order-set-revision-' || r.revision_no::text
      ) then
        continue;
      end if;
      raise exception 'legacy_replay_payload_mismatch';
    end if;
    select count(*) into v_count from public.order_set_items i where i.workspace_id = v_set.workspace_id and i.order_set_id = v_set.id;
    v_reason := null;
    v_classification := null;
    v_reason_code := null;
    v_action := 'quarantine';
    -- Physical source-shape failures are quarantined before empty/mode
    -- classification.  This keeps the classes mutually exclusive and avoids
    -- attempting a native revision from malformed metadata.
    if length(btrim(coalesce(v_set.set_name,''))) = 0
       or length(btrim(coalesce(v_set.billing_name,''))) = 0
       or v_set.sales_unit not in ('per_order','per_each','per_day','per_frequency','per_ml','per_kg')
       or cardinality(coalesce(v_set.target_species,'{}'::text[])) = 0
       or exists (
         select 1 from unnest(coalesce(v_set.target_species,'{}'::text[])) as species(value)
         where species.value is null or species.value not in ('dog','cat','other')
       )
       or exists (
         select 1 from public.order_set_items i
         join public.order_catalog_items c on c.id=i.child_order_id
         where i.workspace_id=v_set.workspace_id and i.order_set_id=v_set.id
           and c.workspace_id <> v_set.workspace_id
       )
       or exists (
         select 1 from public.order_set_items i
         where i.workspace_id=v_set.workspace_id and i.order_set_id=v_set.id
           and not exists (select 1 from public.order_catalog_items c where c.workspace_id=v_set.workspace_id and c.id=i.child_order_id)
       ) then
      v_classification := 'malformed_cross_workspace';
      v_reason_code := 'legacy_malformed';
    elsif exists (
      select 1
      from public.order_set_items i
      where i.workspace_id = v_set.workspace_id and i.order_set_id = v_set.id
      group by i.child_order_id
      having count(*) > 1
    ) or exists (
      select 1
      from public.order_set_items i
      where i.workspace_id = v_set.workspace_id and i.order_set_id = v_set.id
      group by i.sort_order
      having count(*) > 1
    ) then
      v_classification := 'duplicate';
      v_reason_code := 'legacy_duplicate_atomic';
    elsif exists (
      select 1 from public.order_set_items i
      where i.workspace_id = v_set.workspace_id and i.order_set_id = v_set.id
        and (i.default_quantity is null or i.default_quantity <= 0 or i.quantity_source is null
          or i.quantity_source not in ('fixed_one','preset_quantity','manual_at_apply')
          or (i.quantity_source='fixed_one' and i.default_quantity is distinct from 1))
    ) then
      v_classification := 'invalid_quantity';
      v_reason_code := 'legacy_invalid_quantity';
    elsif v_set.amount_basis = 'range_price'
       or coalesce(jsonb_array_length(v_set.range_price_ranges),0) > 0 then
      v_classification := 'unsupported_range';
      v_reason_code := 'legacy_range_unsupported';
    elsif exists (
      select 1
      from public.order_set_items i
      join public.order_catalog_items c on c.workspace_id=v_set.workspace_id and c.id=i.child_order_id
      where i.workspace_id=v_set.workspace_id and i.order_set_id=v_set.id
        and c.availability_status in ('paused','inactive')
    ) then
      v_classification := 'member_unavailable';
      v_reason_code := 'legacy_member_unavailable';
    elsif exists (
      select 1
      from public.order_set_items i
      join public.order_catalog_items c on c.workspace_id=v_set.workspace_id and c.id=i.child_order_id
      where i.workspace_id=v_set.workspace_id and i.order_set_id=v_set.id
        and c.availability_status='active'
        and (c.catalog_revision is null or c.catalog_revision <= 0
          or length(btrim(coalesce(c.standard_order_name,'')))=0
          or length(btrim(coalesce(c.in_hospital_order_name,'')))=0
          or length(btrim(coalesce(c.billing_name,'')))=0
          or c.sales_unit not in ('per_order','per_each','per_day','per_frequency','per_ml','per_kg'))
    ) then
      v_classification := 'member_invalid';
      v_reason_code := 'legacy_member_invalid';
    elsif exists (
      select 1
      from public.order_set_items i
      join public.order_catalog_items c on c.workspace_id=v_set.workspace_id and c.id=i.child_order_id
      where i.workspace_id=v_set.workspace_id and i.order_set_id=v_set.id
        and c.availability_status='active'
        and c.billing_reflection_enabled and c.price_krw is null
    ) then
      v_classification := 'member_billable_price_unset';
      v_reason_code := 'legacy_member_billable_price_unset';
    elsif v_set.amount_basis = 'included_order_sum' and v_set.billing_reflection_enabled then
      v_classification := 'sum_billing_inconsistent';
      v_reason_code := 'sum_billing_inconsistent';
    elsif v_set.amount_basis = 'set_fixed_price' then
      if v_set.set_price_krw is null or v_set.set_price_krw < 0 then
        v_classification := 'malformed_cross_workspace';
        v_reason_code := 'legacy_malformed';
      else
        v_classification := 'legacy_fixed_tax_unset';
        v_reason_code := 'legacy_fixed_tax_unset';
      end if;
    elsif v_set.amount_basis is distinct from 'included_order_sum' then
      v_classification := 'malformed_cross_workspace';
      v_reason_code := 'legacy_malformed';
    end if;

    if v_classification is null and (v_count = 0 or not exists (
      select 1
      from public.order_set_items i
      where i.workspace_id = v_set.workspace_id
        and i.order_set_id = v_set.id
        and i.default_selected
    )) then
      v_classification := case when v_set.availability_status = 'active' then 'empty_active' else 'empty_unavailable' end;
      v_reason_code := case when v_set.availability_status = 'active' then 'legacy_empty_active_was_demoted' else 'empty_unavailable' end;
      v_action := case when v_classification='empty_active' then 'demote_and_backfill' else 'backfill' end;
    end if;

    if v_classification is null then
      v_classification := 'valid_sum';
      v_reason_code := 'legacy_valid_sum';
      v_action := 'backfill';
    end if;

    perform private.clair_b2_record_legacy_classification(
      v_set.workspace_id,'order_set',v_set.id,v_classification,v_reason_code,
      v_action,v_source,v_hash,
      private.clair_b2_deterministic_uuid('quarantine',array[v_set.workspace_id::text,'order_set',v_set.id::text,v_reason_code]::text[])
    );

    -- Preserve the existing branch shape while making the evidence taxonomy
    -- authoritative and mutually exclusive.
    v_reason := case
      when v_classification='empty_active' then 'legacy_empty_active'
      when v_classification='empty_unavailable' then 'legacy_empty_unavailable'
      when v_classification='valid_sum' then null
      else v_reason_code
    end;

    if v_reason in ('legacy_empty_active', 'legacy_empty_unavailable') then
      v_revision := private.clair_b2_deterministic_uuid('revision', array[v_set.workspace_id::text, v_set.id::text, '1']::text[]);
      v_expected := jsonb_build_object(
        'id',v_revision,'workspace_id',v_set.workspace_id,'order_set_id',v_set.id,
        'revision_no',1,'validation_status','valid','validation_errors','[]'::jsonb,
        'set_category',v_set.set_category,'set_name',v_set.set_name,'billing_name',v_set.billing_name,
        'amount_basis','included_order_sum','set_price_krw',null,'range_basis',null,
        'sales_unit',v_set.sales_unit,'billing_reflection_enabled',false,'tax_type','derived',
        'target_species',coalesce(v_set.target_species,array['dog','cat','other']::text[]),
        'care_guide',v_set.care_guide,'internal_instruction',v_set.internal_instruction,
        'created_by_user_id',v_set.created_by_user_id
      );
      perform private.clair_b2_assert_legacy_revision_match(v_revision,v_expected);
      perform set_config('clinical_master.b2_internal_write', 'on', true);
      insert into public.order_set_revisions(id, workspace_id, order_set_id, revision_no, validation_status, validation_errors, set_category, set_name, billing_name, amount_basis, set_price_krw, range_basis, sales_unit, billing_reflection_enabled, tax_type, target_species, care_guide, internal_instruction, created_by_user_id, created_at)
      values(v_revision, v_set.workspace_id, v_set.id, 1, 'valid', '[]'::jsonb, v_set.set_category, v_set.set_name, v_set.billing_name, 'included_order_sum', null, null, v_set.sales_unit, false, 'derived', coalesce(v_set.target_species, array['dog','cat','other']::text[]), v_set.care_guide, v_set.internal_instruction, v_set.created_by_user_id, v_set.created_at)
      on conflict (id) do nothing;
      perform private.clair_b2_apply_projection(
        v_set.workspace_id,
        v_set.id,
        v_revision,
        case when v_reason='legacy_empty_active' then 'paused' else v_set.availability_status end,
        false,
        coalesce(v_set.updated_by_user_id,v_set.created_by_user_id)
      );
      v_quarantine_id := private.clair_b2_deterministic_uuid('quarantine',array[v_set.workspace_id::text,'order_set',v_set.id::text,v_reason_code]::text[]);
      perform private.clair_b2_assert_legacy_quarantine_match(v_set.workspace_id,v_set.id,v_quarantine_id,v_reason_code,v_hash,v_source);
      insert into private.order_set_legacy_quarantine(workspace_id, legacy_order_set_id, quarantine_id, reason_code, source_hash, source_snapshot)
      values(v_set.workspace_id, v_set.id, v_quarantine_id, v_reason_code, v_hash, v_source)
      on conflict (workspace_id, legacy_order_set_id) do nothing;
      for v_item in select i.* from public.order_set_items i where i.workspace_id=v_set.workspace_id and i.order_set_id=v_set.id order by i.sort_order, i.id loop
        v_item_hash := private.clair_b2_sha256(to_jsonb(v_item));
        perform private.clair_b2_record_legacy_classification(
          v_set.workspace_id,'order_set_item',v_item.id::text,v_classification,
          v_reason_code,v_action,to_jsonb(v_item),v_item_hash,
          private.clair_b2_deterministic_uuid('quarantine',array[v_set.workspace_id::text,'order_set_item',v_item.id::text,v_reason_code]::text[])
        );
      end loop;
    elsif v_reason is null then
      v_revision := private.clair_b2_deterministic_uuid('revision', array[v_set.workspace_id::text, v_set.id::text, '1']::text[]);
      v_expected := jsonb_build_object(
        'id',v_revision,'workspace_id',v_set.workspace_id,'order_set_id',v_set.id,
        'revision_no',1,'validation_status','valid','validation_errors','[]'::jsonb,
        'set_category',v_set.set_category,'set_name',v_set.set_name,'billing_name',v_set.billing_name,
        'amount_basis','included_order_sum','set_price_krw',null,'range_basis',null,
        'sales_unit',v_set.sales_unit,'billing_reflection_enabled',false,'tax_type','derived',
        'target_species',coalesce(v_set.target_species,array['dog','cat','other']::text[]),
        'care_guide',v_set.care_guide,'internal_instruction',v_set.internal_instruction,
        'created_by_user_id',v_set.created_by_user_id
      );
      perform private.clair_b2_assert_legacy_revision_match(v_revision,v_expected);
      perform set_config('clinical_master.b2_internal_write', 'on', true);
      insert into public.order_set_revisions(id, workspace_id, order_set_id, revision_no, validation_status, validation_errors, set_category, set_name, billing_name, amount_basis, set_price_krw, range_basis, sales_unit, billing_reflection_enabled, tax_type, target_species, care_guide, internal_instruction, created_by_user_id, created_at)
      values(v_revision, v_set.workspace_id, v_set.id, 1, 'valid', '[]'::jsonb, v_set.set_category, v_set.set_name, v_set.billing_name, 'included_order_sum', null, null, v_set.sales_unit, false, 'derived', coalesce(v_set.target_species, array['dog','cat','other']::text[]), v_set.care_guide, v_set.internal_instruction, v_set.created_by_user_id, v_set.created_at)
      on conflict (id) do nothing;
      for v_item in
        select i.*
        from public.order_set_items i
        where i.workspace_id=v_set.workspace_id and i.order_set_id=v_set.id
        order by i.sort_order, i.id
      loop
        select ranked.item_rank into v_item_sort
        from (
          select i.id, row_number() over (order by i.sort_order, i.id)::integer as item_rank
          from public.order_set_items i
          where i.workspace_id=v_set.workspace_id and i.order_set_id=v_set.id
        ) ranked
        where ranked.id=v_item.id;
        select c.catalog_revision into v_catalog_revision
        from public.order_catalog_items c
        where c.workspace_id=v_set.workspace_id and c.id=v_item.child_order_id;
        v_item_id := private.clair_b2_deterministic_uuid('item',array[
          v_set.workspace_id::text,v_set.id::text,v_revision::text,v_item_sort::text,
          'atomic',v_item.child_order_id::text,v_catalog_revision::text,null,null
        ]::text[]);
        v_expected := jsonb_build_object(
          'id',v_item_id,'workspace_id',v_set.workspace_id,'order_set_id',v_set.id,
          'revision_id',v_revision,'child_kind','atomic',
          'child_order_catalog_item_id',v_item.child_order_id,
          'child_order_catalog_revision',v_catalog_revision,
          'child_order_set_id',null,'child_set_revision_id',null,
          'sort_order',v_item_sort,'default_selected',v_item.default_selected,
          'billing_reflection_default',v_item.billing_reflection_default,
          'default_quantity',v_item.default_quantity,'quantity_source',v_item.quantity_source
        );
        perform private.clair_b2_assert_legacy_item_match(v_item_id,v_expected);
        insert into public.order_set_revision_items(id,workspace_id,order_set_id,revision_id,child_kind,child_order_catalog_item_id,child_order_catalog_revision,sort_order,default_selected,billing_reflection_default,default_quantity,quantity_source,created_at)
        values(v_item_id,v_set.workspace_id,v_set.id,v_revision,'atomic',v_item.child_order_id,v_catalog_revision,v_item_sort,v_item.default_selected,v_item.billing_reflection_default,v_item.default_quantity,v_item.quantity_source,v_item.created_at)
        on conflict (id) do nothing;
        v_item_classification := v_classification;
        v_item_reason_code := v_reason_code;
        v_item_action := v_action;
        v_item_hash := private.clair_b2_sha256(to_jsonb(v_item));
        perform private.clair_b2_record_legacy_classification(
          v_set.workspace_id,'order_set_item',v_item.id::text,v_item_classification,
          v_item_reason_code,v_item_action,to_jsonb(v_item),v_item_hash,
          private.clair_b2_deterministic_uuid('quarantine',array[v_set.workspace_id::text,'order_set_item',v_item.id::text,v_item_reason_code]::text[])
        );
      end loop;
      perform private.clair_b2_apply_projection(
        v_set.workspace_id,
        v_set.id,
        v_revision,
        v_set.availability_status,
        false,
        coalesce(v_set.updated_by_user_id,v_set.created_by_user_id)
      );
    else
      v_quarantine_id := private.clair_b2_deterministic_uuid('quarantine',array[v_set.workspace_id::text,'order_set',v_set.id::text,v_reason_code]::text[]);
      perform private.clair_b2_assert_legacy_quarantine_match(v_set.workspace_id,v_set.id,v_quarantine_id,v_reason_code,v_hash,v_source);
      insert into private.order_set_legacy_quarantine(workspace_id, legacy_order_set_id, quarantine_id, reason_code, source_hash, source_snapshot)
      values(v_set.workspace_id, v_set.id, v_quarantine_id, v_reason_code, v_hash, v_source)
      on conflict (workspace_id, legacy_order_set_id) do nothing;
      perform set_config('clinical_master.b2_internal_write', 'on', true);
      for v_item in select i.* from public.order_set_items i where i.workspace_id=v_set.workspace_id and i.order_set_id=v_set.id order by i.sort_order, i.id loop
        v_item_classification := v_classification;
        if not exists (select 1 from public.order_catalog_items c where c.workspace_id=v_set.workspace_id and c.id=v_item.child_order_id) then
          v_item_classification := 'malformed_cross_workspace';
        elsif exists (select 1 from public.order_catalog_items c where c.workspace_id=v_set.workspace_id and c.id=v_item.child_order_id and c.availability_status in ('paused','inactive')) then
          v_item_classification := 'member_unavailable';
        elsif v_item.default_quantity is null or v_item.default_quantity <= 0 or v_item.quantity_source is null or v_item.quantity_source not in ('fixed_one','preset_quantity','manual_at_apply') then
          v_item_classification := 'invalid_quantity';
        elsif exists (select 1 from public.order_catalog_items c where c.workspace_id=v_set.workspace_id and c.id=v_item.child_order_id and c.availability_status='active' and c.billing_reflection_enabled and c.price_krw is null) then
          v_item_classification := 'member_billable_price_unset';
        end if;
        v_item_reason_code := case v_item_classification
          when 'malformed_cross_workspace' then 'legacy_malformed'
          when 'duplicate' then 'legacy_duplicate_atomic'
          when 'invalid_quantity' then 'legacy_invalid_quantity'
          when 'member_unavailable' then 'legacy_member_unavailable'
          when 'member_invalid' then 'legacy_member_invalid'
          when 'member_billable_price_unset' then 'legacy_member_billable_price_unset'
          else v_reason_code
        end;
        v_item_hash := private.clair_b2_sha256(to_jsonb(v_item));
        perform private.clair_b2_record_legacy_classification(v_set.workspace_id,'order_set_item',v_item.id::text,v_item_classification,v_item_reason_code,'quarantine',to_jsonb(v_item),v_item_hash,private.clair_b2_deterministic_uuid('quarantine',array[v_set.workspace_id::text,'order_set_item',v_item.id::text,v_item_reason_code]::text[]));
      end loop;
      -- The physical-failure branch records item-level evidence before the
      -- safe NULL-current quarantine projection is installed.
      perform private.clair_b2_apply_quarantine_projection(
        v_set.workspace_id,
        v_set.id,
        coalesce(v_set.updated_by_user_id,v_set.created_by_user_id)
      );
    end if;
  end loop;
  if exists (
    select 1 from public.order_sets s
    where s.current_revision_id is null
      and not exists (
        select 1 from private.order_set_legacy_classifications c
        where c.workspace_id=s.workspace_id and c.source_kind='order_set' and c.source_id=s.id
      )
  ) then
    raise exception 'legacy_unclassified_order_set';
  end if;
end
$$;

create or replace function private.clair_assert_order_set_revision_integrity(
  p_workspace_id text,
  p_order_set_id text,
  p_revision_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
declare
  v_revision public.order_set_revisions%rowtype;
  v_range record;
  v_previous_upper numeric(12,3);
  v_seen_open boolean := false;
  v_range_count integer := 0;
begin
  select * into v_revision
  from public.order_set_revisions
  where workspace_id=p_workspace_id and order_set_id=p_order_set_id and id=p_revision_id;
  if not found then raise exception 'order_set_revision_missing'; end if;
  if v_revision.validation_status = 'invalid' then return; end if;
  if v_revision.validation_errors <> '[]'::jsonb then raise exception 'order_set_revision_validation_errors_nonempty'; end if;
  select count(*) into v_range_count
  from public.order_set_revision_price_ranges
  where workspace_id=p_workspace_id and order_set_id=p_order_set_id and revision_id=p_revision_id;
  if v_revision.amount_basis <> 'range_price' and v_range_count <> 0 then raise exception 'order_set_revision_range_rows_for_non_range'; end if;
  if v_revision.amount_basis = 'range_price' then
    if v_range_count < 1 then raise exception 'order_set_revision_range_rows_required'; end if;
    v_previous_upper := null;
    for v_range in
      select lower_bound, upper_bound
      from public.order_set_revision_price_ranges
      where workspace_id=p_workspace_id and order_set_id=p_order_set_id and revision_id=p_revision_id
      order by sort_order
    loop
      if v_seen_open then raise exception 'order_set_revision_range_after_open'; end if;
      if v_previous_upper is null and v_range.lower_bound <> 0 then raise exception 'order_set_revision_range_start_must_be_zero'; end if;
      if v_previous_upper is not null and v_range.lower_bound <> v_previous_upper then raise exception 'order_set_revision_range_gap_or_overlap'; end if;
      if v_range.upper_bound is null then v_seen_open := true; end if;
      v_previous_upper := v_range.upper_bound;
    end loop;
    if not v_seen_open then raise exception 'order_set_revision_range_open_ended_final_required'; end if;
  end if;
  if exists (
    select 1
    from public.order_set_revision_items i
    where i.workspace_id=p_workspace_id and i.order_set_id=p_order_set_id and i.revision_id=p_revision_id
      and i.child_kind='order_set'
      and exists (
        select 1 from public.order_set_revision_items nested_i
        where nested_i.workspace_id=i.workspace_id and nested_i.order_set_id=i.child_order_set_id
          and nested_i.revision_id=i.child_set_revision_id and nested_i.child_kind='order_set'
      )
  ) then
    raise exception 'order_set_revision_nested_depth_exceeded';
  end if;
end;
$$;

revoke all on function private.clair_assert_order_set_revision_integrity(text,text,uuid) from public, anon, authenticated, service_role;

create or replace function private.clair_assert_order_set_revision_integrity_trigger()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
declare
  v_revision_id uuid;
begin
  if tg_op = 'DELETE' then
    return old;
  end if;
  v_revision_id := coalesce(
    nullif(to_jsonb(new)->>'revision_id','')::uuid,
    nullif(to_jsonb(new)->>'id','')::uuid
  );
  perform private.clair_assert_order_set_revision_integrity(new.workspace_id,new.order_set_id,v_revision_id);
  return new;
end;
$$;

revoke all on function private.clair_assert_order_set_revision_integrity_trigger() from public, anon, authenticated, service_role;

drop trigger if exists order_set_revision_integrity_deferred on public.order_set_revisions;
create constraint trigger order_set_revision_integrity_deferred
after insert on public.order_set_revisions
deferrable initially deferred
for each row execute function private.clair_assert_order_set_revision_integrity_trigger();
drop trigger if exists order_set_revision_integrity_deferred on public.order_set_revision_items;
create constraint trigger order_set_revision_integrity_deferred
after insert on public.order_set_revision_items
deferrable initially deferred
for each row execute function private.clair_assert_order_set_revision_integrity_trigger();
drop trigger if exists order_set_revision_integrity_deferred on public.order_set_revision_price_ranges;
create constraint trigger order_set_revision_integrity_deferred
after insert on public.order_set_revision_price_ranges
deferrable initially deferred
for each row execute function private.clair_assert_order_set_revision_integrity_trigger();

-- Legacy backfill updates ran while the same-workspace revision FKs were
-- intentionally deferred.  Flush and validate those events before
-- PostgreSQL ALTER TABLE operations, then restore the intended deferred mode
-- for the rest of this transaction and the runtime constraint contract.
set constraints all immediate;

-- Read/write grants and policies are deliberately narrow.  Legacy
-- order_set_items remains SELECT-compatible and has no mutation path.
alter table public.order_sets enable row level security;
alter table public.order_set_revisions enable row level security;
alter table public.order_set_revision_items enable row level security;
alter table public.order_set_revision_price_ranges enable row level security;
alter table public.order_set_revision_update_reviews enable row level security;
alter table public.order_set_items enable row level security;

drop policy if exists order_sets_workspace_member_select on public.order_sets;
drop policy if exists order_set_items_workspace_member_select on public.order_set_items;
drop policy if exists order_sets_workspace_catalog_view on public.order_sets;
drop policy if exists order_set_revisions_workspace_catalog_view on public.order_set_revisions;
drop policy if exists order_set_revision_items_workspace_catalog_view on public.order_set_revision_items;
drop policy if exists order_set_revision_price_ranges_workspace_catalog_view on public.order_set_revision_price_ranges;
drop policy if exists order_set_revision_update_reviews_workspace_catalog_view on public.order_set_revision_update_reviews;
drop policy if exists order_set_items_workspace_catalog_view on public.order_set_items;

create policy order_sets_workspace_catalog_view on public.order_sets for select to authenticated
using (private.clair_is_active_workspace_member(workspace_id) and private.clair_current_user_has_workspace_permission(workspace_id, 'service_catalog:view'));
create policy order_set_revisions_workspace_catalog_view on public.order_set_revisions for select to authenticated
using (private.clair_is_active_workspace_member(workspace_id) and private.clair_current_user_has_workspace_permission(workspace_id, 'service_catalog:view'));
create policy order_set_revision_items_workspace_catalog_view on public.order_set_revision_items for select to authenticated
using (private.clair_is_active_workspace_member(workspace_id) and private.clair_current_user_has_workspace_permission(workspace_id, 'service_catalog:view'));
create policy order_set_revision_price_ranges_workspace_catalog_view on public.order_set_revision_price_ranges for select to authenticated
using (private.clair_is_active_workspace_member(workspace_id) and private.clair_current_user_has_workspace_permission(workspace_id, 'service_catalog:view'));
create policy order_set_revision_update_reviews_workspace_catalog_view on public.order_set_revision_update_reviews for select to authenticated
using (private.clair_is_active_workspace_member(workspace_id) and private.clair_current_user_has_workspace_permission(workspace_id, 'service_catalog:view'));
create policy order_set_items_workspace_catalog_view on public.order_set_items for select to authenticated
using (private.clair_is_active_workspace_member(workspace_id) and private.clair_current_user_has_workspace_permission(workspace_id, 'service_catalog:view'));

revoke all on table public.order_sets, public.order_set_revisions, public.order_set_revision_items, public.order_set_revision_price_ranges, public.order_set_revision_update_reviews, public.order_set_items from public, anon, service_role;
grant select on table public.order_sets, public.order_set_revisions, public.order_set_revision_items, public.order_set_revision_price_ranges, public.order_set_revision_update_reviews, public.order_set_items to authenticated;
revoke insert, update, delete on table public.order_sets, public.order_set_revisions, public.order_set_revision_items, public.order_set_revision_price_ranges, public.order_set_revision_update_reviews, public.order_set_items from public, anon, authenticated, service_role;

set constraints all deferred;

-- Install the deferred compatibility invariant only after all table-level
-- ALTERs/RLS changes are complete.  Legacy backfill writes above intentionally
-- precede this trigger, so PostgreSQL has no pending trigger events while the
-- tables are altered in the same transaction.
drop trigger if exists order_sets_current_projection_deferred on public.order_sets;
create constraint trigger order_sets_current_projection_deferred
after insert or update of current_revision_id, availability_status, needs_composition_review,
  source_set_version, set_category, set_name, billing_name, amount_basis, set_price_krw,
  range_basis, range_price_ranges, sales_unit, billing_reflection_enabled, target_species,
  tax_type, care_guide, internal_instruction on public.order_sets
deferrable initially deferred
for each row execute function private.clair_b2_current_projection_trigger();

create or replace function private.clair_b2_revision_ranges_json(p_workspace_id text, p_order_set_id text, p_revision_id uuid)
returns jsonb language sql stable security definer set search_path = public, private, pg_catalog as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id::text, 'sortOrder', sort_order, 'lowerBound', lower_bound, 'upperBound', upper_bound, 'priceKrw', price_krw) order by sort_order), '[]'::jsonb)
  from public.order_set_revision_price_ranges
  where workspace_id=p_workspace_id and order_set_id=p_order_set_id and revision_id=p_revision_id;
$$;
revoke all on function private.clair_b2_revision_ranges_json(text,text,uuid) from public, anon, authenticated, service_role;

create or replace function private.clair_b2_revision_json(p_workspace_id text, p_order_set_id text, p_revision_id uuid)
returns jsonb language sql stable security definer set search_path = public, private, pg_catalog as $$
  select to_jsonb(r) || jsonb_build_object(
    'items', coalesce((select jsonb_agg(to_jsonb(i) order by i.sort_order) from public.order_set_revision_items i where i.workspace_id=r.workspace_id and i.order_set_id=r.order_set_id and i.revision_id=r.id), '[]'::jsonb),
    'priceRanges', private.clair_b2_revision_ranges_json(r.workspace_id,r.order_set_id,r.id),
    'currentEtag', 'order-set-revision-' || r.id::text
  )
  from public.order_set_revisions r
  where r.workspace_id=p_workspace_id and r.order_set_id=p_order_set_id and r.id=p_revision_id;
$$;
revoke all on function private.clair_b2_revision_json(text,text,uuid) from public, anon, authenticated, service_role;

create or replace function private.clair_b2_apply_projection(
  p_workspace_id text,
  p_order_set_id text,
  p_revision_id uuid,
  p_availability_status text,
  p_needs_composition_review boolean,
  p_actor_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
declare
  v_revision public.order_set_revisions%rowtype;
begin
  if p_availability_status not in ('active','paused','inactive') then raise exception 'availability_status_invalid'; end if;
  select * into v_revision from public.order_set_revisions where workspace_id=p_workspace_id and order_set_id=p_order_set_id and id=p_revision_id for update;
  if not found or v_revision.validation_status <> 'valid' then raise exception 'order_set_revision_invalid'; end if;
  perform set_config('clinical_master.b2_internal_write','on',true);
  update public.order_sets set
    current_revision_id=v_revision.id,
    source_set_version='order-set-revision-' || v_revision.revision_no::text,
    set_category=v_revision.set_category,
    set_name=v_revision.set_name,
    billing_name=v_revision.billing_name,
    amount_basis=v_revision.amount_basis,
    set_price_krw=v_revision.set_price_krw,
    range_basis=v_revision.range_basis,
    range_price_ranges=private.clair_b2_revision_ranges_json(p_workspace_id,p_order_set_id,v_revision.id),
    sales_unit=v_revision.sales_unit,
    billing_reflection_enabled=v_revision.billing_reflection_enabled,
    tax_type=v_revision.tax_type,
    target_species=v_revision.target_species,
    care_guide=v_revision.care_guide,
    internal_instruction=v_revision.internal_instruction,
    availability_status=p_availability_status,
    needs_composition_review=p_needs_composition_review,
    updated_by_user_id=p_actor_user_id,
    updated_at=now()
  where workspace_id=p_workspace_id and id=p_order_set_id;
  if not found then raise exception 'order_set_not_found'; end if;
end;
$$;
revoke all on function private.clair_b2_apply_projection(text,text,uuid,text,boolean,uuid) from public, anon, authenticated, service_role;

-- Canonicalize the allow-listed JSON input.  JSONB has already erased lexical
-- exponent/trailing-zero spelling; numeric scale is validated before the
-- numeric(12,3) cast and trim_scale makes 1, 1.0, and 1.00 identical.
create or replace function private.clair_b2_normalize_definition(p_definition jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
declare
  v_key text;
  v_allowed constant text[] := array['setCategory','setName','billingName','amountBasis','setPriceKrw','rangeBasis','salesUnit','billingReflectionEnabled','taxType','targetSpecies','careGuide','internalInstruction','items','priceRanges'];
  v_items jsonb := '[]'::jsonb;
  v_ranges jsonb := '[]'::jsonb;
  v_item jsonb;
  v_range jsonb;
  v_child_kind text;
  v_catalog_id text;
  v_set_id text;
  v_catalog_revision integer;
  v_child_revision uuid;
  v_sort integer;
  v_default_selected boolean;
  v_billing boolean;
  v_qty numeric(12,3);
  v_quantity_source text;
  v_seen_sorts integer[] := '{}';
  v_seen_range_sorts integer[] := '{}';
  v_lower numeric(12,3);
  v_upper numeric(12,3);
  v_prev_upper numeric(12,3);
  v_raw numeric;
  v_seen_open boolean := false;
  v_price integer;
  v_amount_basis text;
  v_range_basis text;
  v_set_price integer;
  v_target_species text[];
  v_required text[];
begin
  if p_definition is null or jsonb_typeof(p_definition) <> 'object' then
    raise exception 'invalid_order_set_definition';
  end if;
  if (select count(*) from jsonb_object_keys(p_definition)) <> cardinality(v_allowed)
     or exists (select 1 from jsonb_object_keys(p_definition) k where not (k = any(v_allowed))) then
    raise exception 'invalid_order_set_definition';
  end if;
  if jsonb_typeof(p_definition->'setName') <> 'string' or length(btrim(p_definition->>'setName')) = 0
     or jsonb_typeof(p_definition->'billingName') <> 'string' or length(btrim(p_definition->>'billingName')) = 0 then
    raise exception 'invalid_order_set_definition';
  end if;
  v_amount_basis := p_definition->>'amountBasis';
  if v_amount_basis not in ('included_order_sum','set_fixed_price','range_price') then raise exception 'invalid_order_set_definition'; end if;
  if jsonb_typeof(p_definition->'salesUnit') <> 'string' or p_definition->>'salesUnit' not in ('per_order','per_each','per_day','per_frequency','per_ml','per_kg') then raise exception 'invalid_order_set_definition'; end if;
  if jsonb_typeof(p_definition->'billingReflectionEnabled') <> 'boolean' then raise exception 'invalid_order_set_definition'; end if;
  if jsonb_typeof(p_definition->'targetSpecies') <> 'array' then raise exception 'invalid_order_set_definition'; end if;
  select coalesce(array_agg(value order by value), '{}') into v_target_species from jsonb_array_elements_text(p_definition->'targetSpecies') values(value);
  if cardinality(v_target_species) = 0 or exists(select 1 from unnest(v_target_species) s where s not in ('dog','cat','other')) then raise exception 'invalid_order_set_definition'; end if;
  if (p_definition->'setCategory' <> 'null'::jsonb and jsonb_typeof(p_definition->'setCategory') <> 'string')
     or (p_definition->'rangeBasis' <> 'null'::jsonb and jsonb_typeof(p_definition->'rangeBasis') <> 'string')
     or (p_definition->'taxType' <> 'null'::jsonb and jsonb_typeof(p_definition->'taxType') <> 'string')
     or (p_definition->'careGuide' <> 'null'::jsonb and jsonb_typeof(p_definition->'careGuide') <> 'string')
     or (p_definition->'internalInstruction' <> 'null'::jsonb and jsonb_typeof(p_definition->'internalInstruction') <> 'string') then
    raise exception 'invalid_order_set_definition';
  end if;
  if jsonb_typeof(p_definition->'items') <> 'array' or jsonb_typeof(p_definition->'priceRanges') <> 'array' then raise exception 'invalid_order_set_definition'; end if;
  if v_amount_basis = 'included_order_sum' then
    if p_definition->'setPriceKrw' is distinct from 'null'::jsonb or p_definition->'rangeBasis' is distinct from 'null'::jsonb or (p_definition->>'billingReflectionEnabled')::boolean or p_definition->>'taxType' <> 'derived' or jsonb_array_length(p_definition->'priceRanges') <> 0 then
      raise exception 'invalid_order_set_definition';
    end if;
  elsif v_amount_basis = 'set_fixed_price' then
    if jsonb_typeof(p_definition->'setPriceKrw') <> 'number' or p_definition->'rangeBasis' is distinct from 'null'::jsonb or not (p_definition->>'billingReflectionEnabled')::boolean or p_definition->>'taxType' not in ('taxable','non_taxable') or jsonb_array_length(p_definition->'priceRanges') <> 0 then raise exception 'invalid_order_set_definition'; end if;
    begin v_raw := (p_definition->>'setPriceKrw')::numeric; if pg_catalog.scale(v_raw) > 3 then raise exception 'invalid_order_set_definition'; end if; v_set_price := pg_catalog.trim_scale(v_raw::numeric(12,3))::integer; exception when others then raise exception 'invalid_order_set_definition'; end;
    if v_raw <> v_set_price or v_set_price < 0 then raise exception 'invalid_order_set_definition'; end if;
  else
    v_range_basis := p_definition->>'rangeBasis';
    if v_range_basis not in ('patient_weight_kg','manual_value') or p_definition->'setPriceKrw' is distinct from 'null'::jsonb or not (p_definition->>'billingReflectionEnabled')::boolean or p_definition->>'taxType' not in ('taxable','non_taxable') or jsonb_array_length(p_definition->'priceRanges') = 0 then raise exception 'invalid_order_set_definition'; end if;
  end if;
  for v_item in select value from jsonb_array_elements(p_definition->'items') items(value) loop
    if jsonb_typeof(v_item) <> 'object' or (select count(*) from jsonb_object_keys(v_item)) <> 10
       or exists(select 1 from jsonb_object_keys(v_item) k where k not in ('childKind','childOrderCatalogItemId','childOrderCatalogRevision','childOrderSetId','childSetRevisionId','sortOrder','defaultSelected','billingReflectionDefault','defaultQuantity','quantitySource')) then
      raise exception 'invalid_order_set_definition';
    end if;
    v_child_kind := v_item->>'childKind';
    if v_child_kind not in ('atomic','order_set') then raise exception 'invalid_order_set_definition'; end if;
    if jsonb_typeof(v_item->'sortOrder') <> 'number'
       or jsonb_typeof(v_item->'defaultQuantity') <> 'number'
       or jsonb_typeof(v_item->'childOrderCatalogItemId') not in ('string','null')
       or jsonb_typeof(v_item->'childOrderCatalogRevision') not in ('number','null')
       or jsonb_typeof(v_item->'childOrderSetId') not in ('string','null')
       or jsonb_typeof(v_item->'childSetRevisionId') not in ('string','null') then
      raise exception 'invalid_order_set_definition';
    end if;
    begin
      v_raw := (v_item->>'sortOrder')::numeric;
      if pg_catalog.scale(v_raw) > 0 then raise exception 'invalid_order_set_definition'; end if;
      v_sort := v_raw::integer;
      v_raw := (v_item->>'defaultQuantity')::numeric;
      if pg_catalog.scale(v_raw) > 3 then raise exception 'invalid_order_set_definition'; end if;
      v_qty := pg_catalog.trim_scale(v_raw::numeric(12,3));
    exception when others then raise exception 'invalid_order_set_definition'; end;
    if v_sort <= 0 or v_sort = any(v_seen_sorts) or v_qty <= 0 then raise exception 'invalid_order_set_definition'; end if;
    v_seen_sorts := array_append(v_seen_sorts,v_sort);
    if v_item->>'quantitySource' not in ('fixed_one','preset_quantity','manual_at_apply') or jsonb_typeof(v_item->'defaultSelected') <> 'boolean' or jsonb_typeof(v_item->'billingReflectionDefault') <> 'boolean' then raise exception 'invalid_order_set_definition'; end if;
    v_default_selected := (v_item->>'defaultSelected')::boolean;
    v_billing := (v_item->>'billingReflectionDefault')::boolean;
    v_quantity_source := v_item->>'quantitySource';
    if v_quantity_source = 'fixed_one' and v_qty <> 1 then raise exception 'invalid_order_set_definition'; end if;
    if v_child_kind = 'atomic' then
      v_catalog_id := nullif(btrim(v_item->>'childOrderCatalogItemId'),'');
      if v_catalog_id is null or jsonb_typeof(v_item->'childOrderCatalogRevision') <> 'number' or v_item->'childOrderSetId' is distinct from 'null'::jsonb or v_item->'childSetRevisionId' is distinct from 'null'::jsonb then raise exception 'invalid_order_set_definition'; end if;
      begin
        v_raw := (v_item->>'childOrderCatalogRevision')::numeric;
        if pg_catalog.scale(v_raw) > 0 then raise exception 'invalid_order_set_definition'; end if;
        v_catalog_revision := v_raw::integer;
      exception when others then raise exception 'invalid_order_set_definition'; end;
      if v_catalog_revision <= 0 then raise exception 'invalid_order_set_definition'; end if;
    else
      v_set_id := nullif(btrim(v_item->>'childOrderSetId'),'');
      begin v_child_revision := (v_item->>'childSetRevisionId')::uuid; exception when others then raise exception 'invalid_order_set_definition'; end;
      if v_set_id is null or v_item->'childOrderCatalogItemId' is distinct from 'null'::jsonb or v_item->'childOrderCatalogRevision' is distinct from 'null'::jsonb or v_qty <> 1 or v_quantity_source <> 'fixed_one' or v_billing then raise exception 'invalid_order_set_definition'; end if;
    end if;
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'childKind',v_child_kind,
      'childOrderCatalogItemId',case when v_child_kind='atomic' then v_catalog_id else null end,
      'childOrderCatalogRevision',case when v_child_kind='atomic' then v_catalog_revision else null end,
      'childOrderSetId',case when v_child_kind='order_set' then v_set_id else null end,
      'childSetRevisionId',case when v_child_kind='order_set' then v_child_revision else null end,
      'sortOrder',v_sort,'defaultSelected',v_default_selected,
      'billingReflectionDefault',v_billing,'defaultQuantity',v_qty,
      'quantitySource',v_quantity_source));
  end loop;
  v_items := coalesce(
    (select jsonb_agg(value order by (value->>'sortOrder')::integer)
       from jsonb_array_elements(v_items) values(value)),
    '[]'::jsonb
  );
  for v_range in select value from jsonb_array_elements(p_definition->'priceRanges') ranges(value) loop
    if jsonb_typeof(v_range) <> 'object' or (select count(*) from jsonb_object_keys(v_range)) <> 4
       or exists(select 1 from jsonb_object_keys(v_range) k where k not in ('sortOrder','lowerBound','upperBound','priceKrw')) then raise exception 'invalid_order_set_definition'; end if;
    if jsonb_typeof(v_range->'sortOrder') <> 'number'
       or jsonb_typeof(v_range->'lowerBound') <> 'number'
       or jsonb_typeof(v_range->'upperBound') not in ('number','null')
       or jsonb_typeof(v_range->'priceKrw') <> 'number' then
      raise exception 'invalid_order_set_definition';
    end if;
    begin
      v_raw := (v_range->>'sortOrder')::numeric;
      if pg_catalog.scale(v_raw) > 0 then raise exception 'invalid_order_set_definition'; end if;
      v_sort := v_raw::integer;
      v_raw := (v_range->>'lowerBound')::numeric;
      if pg_catalog.scale(v_raw) > 3 then raise exception 'invalid_order_set_definition'; end if;
      v_lower := pg_catalog.trim_scale(v_raw::numeric(12,3));
      if v_range->'upperBound' = 'null'::jsonb then v_upper := null; else v_raw := (v_range->>'upperBound')::numeric; if pg_catalog.scale(v_raw) > 3 then raise exception 'invalid_order_set_definition'; end if; v_upper := pg_catalog.trim_scale(v_raw::numeric(12,3)); end if;
      v_raw := (v_range->>'priceKrw')::numeric;
      if pg_catalog.scale(v_raw) > 0 then raise exception 'invalid_order_set_definition'; end if;
      v_price := v_raw::integer;
    exception when others then raise exception 'invalid_order_set_definition'; end;
    if v_sort <= 0 or v_sort = any(v_seen_range_sorts) or v_lower < 0 or v_price < 0 then raise exception 'invalid_order_set_definition'; end if;
    if v_upper is not null and v_upper <= v_lower then raise exception 'invalid_order_set_definition'; end if;
    v_seen_range_sorts := array_append(v_seen_range_sorts,v_sort);
    if v_amount_basis <> 'range_price' then raise exception 'invalid_order_set_definition'; end if;
    v_ranges := v_ranges || jsonb_build_array(jsonb_build_object('sortOrder',v_sort,'lowerBound',v_lower,'upperBound',v_upper,'priceKrw',v_price));
  end loop;
  if v_amount_basis = 'range_price' then
    v_ranges := (select jsonb_agg(value order by (value->>'sortOrder')::integer) from jsonb_array_elements(v_ranges) values(value));
    if jsonb_array_length(v_ranges) < 1 then raise exception 'invalid_order_set_definition'; end if;
    v_prev_upper := null;
    v_seen_open := false;
    for v_range in select value from jsonb_array_elements(v_ranges) ranges(value) loop
      v_lower := (v_range->>'lowerBound')::numeric;
      v_upper := case when v_range->'upperBound' = 'null'::jsonb then null else (v_range->>'upperBound')::numeric end;
      if v_seen_open then raise exception 'invalid_order_set_definition'; end if;
      if v_prev_upper is null and v_lower <> 0 then raise exception 'invalid_order_set_definition'; end if;
      if v_prev_upper is not null and v_lower <> v_prev_upper then raise exception 'invalid_order_set_definition'; end if;
      if v_upper is null then v_seen_open := true; end if;
      v_prev_upper := v_upper;
    end loop;
    if not v_seen_open then raise exception 'invalid_order_set_definition'; end if;
  end if;
  return jsonb_build_object(
    'setCategory', case when p_definition->'setCategory' = 'null'::jsonb then null else p_definition->>'setCategory' end,
    'setName', btrim(p_definition->>'setName'), 'billingName', btrim(p_definition->>'billingName'),
    'amountBasis',v_amount_basis,'setPriceKrw',case when p_definition->'setPriceKrw'='null'::jsonb then null else v_set_price end,
    'rangeBasis',case when p_definition->'rangeBasis'='null'::jsonb then null else p_definition->>'rangeBasis' end,
    'salesUnit',p_definition->>'salesUnit','billingReflectionEnabled',(p_definition->>'billingReflectionEnabled')::boolean,
    'taxType',p_definition->>'taxType','targetSpecies',to_jsonb(v_target_species),
    'careGuide',case when p_definition->'careGuide'='null'::jsonb then null else p_definition->>'careGuide' end,
    'internalInstruction',case when p_definition->'internalInstruction'='null'::jsonb then null else p_definition->>'internalInstruction' end,
    'items',coalesce(v_items,'[]'::jsonb),'priceRanges',coalesce(v_ranges,'[]'::jsonb));
end;
$$;

revoke all on function private.clair_b2_normalize_definition(jsonb) from public, anon, authenticated, service_role;

create or replace function private.clair_b2_write_revision(
  p_workspace_id text,
  p_order_set_id text,
  p_revision_no integer,
  p_definition jsonb,
  p_actor_user_id uuid,
  p_allow_unusable boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
declare
  v_revision_id uuid := private.clair_b2_deterministic_uuid('revision', array[p_workspace_id::text,p_order_set_id::text,p_revision_no::text]::text[]);
  v_item jsonb;
  v_child public.order_sets%rowtype;
  v_child_revision public.order_set_revisions%rowtype;
  v_catalog public.order_catalog_items%rowtype;
  v_item_id uuid;
  v_direct_atomic_ids text[] := '{}';
  v_nested_atomic_ids text[] := '{}';
  v_kind text;
  v_catalog_id text;
  v_child_id text;
  v_child_revision_id uuid;
  v_catalog_revision integer;
  v_sort integer;
  v_qty numeric(12,3);
  v_error_code text;
  v_error_message text;
begin
  if p_revision_no is null or p_revision_no <= 0 then return jsonb_build_object('ok',false,'code','invalid_order_set_definition','message','revision_no must be positive'); end if;
  if p_definition is null then return jsonb_build_object('ok',false,'code','invalid_order_set_definition','message','definition is required'); end if;
  for v_item in select value from jsonb_array_elements(coalesce(p_definition->'items','[]'::jsonb)) items(value) loop
    v_kind := v_item->>'childKind';
    v_sort := (v_item->>'sortOrder')::integer;
    v_qty := (v_item->>'defaultQuantity')::numeric;
    if v_kind = 'atomic' then
      v_catalog_id := v_item->>'childOrderCatalogItemId';
      v_catalog_revision := (v_item->>'childOrderCatalogRevision')::integer;
      if v_catalog_id = any(v_direct_atomic_ids) then v_error_code := 'invalid_order_set_definition'; v_error_message := 'duplicate atomic order'; exit; end if;
      v_direct_atomic_ids := array_append(v_direct_atomic_ids,v_catalog_id);
      select * into v_catalog from public.order_catalog_items where workspace_id=p_workspace_id and id=v_catalog_id;
      if not found then
        v_error_code := 'order_set_member_unavailable'; v_error_message := 'atomic member is unavailable or billable price is unset'; exit;
      end if;
      if v_catalog.catalog_revision is distinct from v_catalog_revision then v_error_code := 'revision_conflict'; v_error_message := 'atomic catalog revision is stale'; exit; end if;
      if (v_catalog.availability_status <> 'active' or ((v_item->>'billingReflectionDefault')::boolean and v_catalog.price_krw is null)) and not p_allow_unusable then
        v_error_code := 'order_set_member_unavailable'; v_error_message := 'atomic member is unavailable or billable price is unset'; exit;
      end if;
    elsif v_kind = 'order_set' then
      v_child_id := v_item->>'childOrderSetId';
      v_child_revision_id := (v_item->>'childSetRevisionId')::uuid;
      if v_child_id = p_order_set_id then v_error_code := 'invalid_order_set_definition'; v_error_message := 'order set cycle'; exit; end if;
      select * into v_child from public.order_sets where workspace_id=p_workspace_id and id=v_child_id;
      if not found then v_error_code := 'order_set_member_unavailable'; v_error_message := 'child order set is not found'; exit; end if;
      select * into v_child_revision from public.order_set_revisions where workspace_id=p_workspace_id and order_set_id=v_child_id and id=v_child_revision_id and validation_status='valid';
      if not found or v_child.current_revision_id is distinct from v_child_revision_id then v_error_code := 'revision_conflict'; v_error_message := 'child revision is not current'; exit; end if;
      if (v_child.availability_status <> 'active' or v_child.needs_composition_review) and not p_allow_unusable then v_error_code := 'order_set_member_unavailable'; v_error_message := 'child order set is not active and usable'; exit; end if;
      if exists (select 1 from public.order_set_revision_items where workspace_id=p_workspace_id and order_set_id=v_child_id and revision_id=v_child_revision_id and child_kind='order_set') then v_error_code := 'invalid_order_set_definition'; v_error_message := 'nested child depth exceeds one'; exit; end if;
      if exists (
        select 1 from public.order_set_revision_items i join public.order_catalog_items c on c.workspace_id=i.workspace_id and c.id=i.child_order_catalog_item_id
        where i.workspace_id=p_workspace_id and i.order_set_id=v_child_id and i.revision_id=v_child_revision_id and i.child_kind='atomic'
          and (c.availability_status <> 'active' or (i.billing_reflection_default and c.price_krw is null))
      ) and not p_allow_unusable then v_error_code := 'order_set_member_unavailable'; v_error_message := 'nested atomic member is unavailable'; exit; end if;
      select v_nested_atomic_ids || coalesce(array_agg(i.child_order_catalog_item_id order by i.sort_order), '{}')
        into v_nested_atomic_ids
      from public.order_set_revision_items i
      where i.workspace_id=p_workspace_id and i.order_set_id=v_child_id
        and i.revision_id=v_child_revision_id and i.child_kind='atomic';
      if exists (
        select 1 from unnest(v_nested_atomic_ids) nested(id)
        group by nested.id having count(*) > 1
      ) or exists (
        select 1 from unnest(v_nested_atomic_ids) nested(id)
        where nested.id = any(v_direct_atomic_ids)
      ) then
        v_error_code := 'invalid_order_set_definition';
        v_error_message := 'duplicate atomic order across direct and nested paths';
        exit;
      end if;
    else
      v_error_code := 'invalid_order_set_definition'; v_error_message := 'unknown child kind'; exit;
    end if;
  end loop;
  if exists (
    select 1 from unnest(v_nested_atomic_ids) nested(id)
    where nested.id = any(v_direct_atomic_ids)
  ) or exists (
    select 1 from unnest(v_nested_atomic_ids) nested(id)
    group by nested.id having count(*) > 1
  ) then
    return jsonb_build_object(
      'ok',false,
      'code','invalid_order_set_definition',
      'message','duplicate atomic order across direct and nested paths'
    );
  end if;
  if v_error_code is not null then return jsonb_build_object('ok',false,'code',v_error_code,'message',v_error_message); end if;
  if (p_definition->>'amountBasis') = 'range_price' then
    -- Option A, approved for both bases: continuous [0,+infinity), lower
    -- inclusive/upper exclusive, one final open-ended bracket.
    if jsonb_array_length(p_definition->'priceRanges') < 1 then return jsonb_build_object('ok',false,'code','invalid_order_set_definition','message','range requires one or more brackets'); end if;
  end if;
  perform set_config('clinical_master.b2_internal_write','on',true);
  insert into public.order_set_revisions(id,workspace_id,order_set_id,revision_no,validation_status,validation_errors,set_category,set_name,billing_name,amount_basis,set_price_krw,range_basis,sales_unit,billing_reflection_enabled,tax_type,target_species,care_guide,internal_instruction,created_by_user_id)
  values(v_revision_id,p_workspace_id,p_order_set_id,p_revision_no,'valid','[]'::jsonb,p_definition->>'setCategory',p_definition->>'setName',p_definition->>'billingName',p_definition->>'amountBasis',nullif(p_definition->>'setPriceKrw','')::integer,nullif(p_definition->>'rangeBasis',''),p_definition->>'salesUnit',(p_definition->>'billingReflectionEnabled')::boolean,p_definition->>'taxType',array(select jsonb_array_elements_text(p_definition->'targetSpecies')),p_definition->>'careGuide',p_definition->>'internalInstruction',p_actor_user_id);
  for v_item in select value from jsonb_array_elements(p_definition->'items') items(value) loop
    v_item_id := private.clair_b2_deterministic_uuid('revision-item',array[v_revision_id::text,(v_item->>'sortOrder')]::text[]);
    insert into public.order_set_revision_items(id,workspace_id,order_set_id,revision_id,child_kind,child_order_catalog_item_id,child_order_catalog_revision,child_order_set_id,child_set_revision_id,sort_order,default_selected,billing_reflection_default,default_quantity,quantity_source)
    values(v_item_id,p_workspace_id,p_order_set_id,v_revision_id,v_item->>'childKind',nullif(v_item->>'childOrderCatalogItemId',''),nullif(v_item->>'childOrderCatalogRevision','')::integer,nullif(v_item->>'childOrderSetId',''),nullif(v_item->>'childSetRevisionId','')::uuid,(v_item->>'sortOrder')::integer,(v_item->>'defaultSelected')::boolean,(v_item->>'billingReflectionDefault')::boolean,(v_item->>'defaultQuantity')::numeric,v_item->>'quantitySource');
  end loop;
  for v_item in select value from jsonb_array_elements(p_definition->'priceRanges') items(value) loop
    insert into public.order_set_revision_price_ranges(id,workspace_id,order_set_id,revision_id,sort_order,lower_bound,upper_bound,price_krw)
    values(private.clair_b2_deterministic_uuid('revision-range',array[v_revision_id::text,(v_item->>'sortOrder')]::text[]),p_workspace_id,p_order_set_id,v_revision_id,(v_item->>'sortOrder')::integer,(v_item->>'lowerBound')::numeric,nullif(v_item->>'upperBound','')::numeric,(v_item->>'priceKrw')::integer);
  end loop;
  if p_allow_unusable and private.clair_b2_revision_composition_blocked(p_workspace_id,p_order_set_id,v_revision_id) then
    update public.order_set_revisions
    set validation_status='invalid',
        validation_errors=jsonb_build_array(jsonb_build_object(
          'code','order_set_member_unavailable',
          'field','items',
          'message','revision contains an unavailable or invalid pinned member'
        ))
    where id=v_revision_id;
    return jsonb_build_object('ok',true,'revisionId',v_revision_id,'validationStatus','invalid');
  end if;
  return jsonb_build_object('ok',true,'revisionId',v_revision_id);
exception when unique_violation then
  return jsonb_build_object('ok',false,'code','deterministic_id_collision','message','immutable revision identity collision');
end;
$$;

revoke all on function private.clair_b2_write_revision(text,text,integer,jsonb,uuid,boolean) from public, anon, authenticated, service_role;

create or replace function private.clair_b2_revision_composition_blocked(
  p_workspace_id text,
  p_order_set_id text,
  p_revision_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, private, pg_catalog
as $$
  select exists (
    select 1
    from public.order_set_revision_items i
    left join public.order_catalog_items c
      on c.workspace_id=i.workspace_id and c.id=i.child_order_catalog_item_id
    where i.workspace_id=p_workspace_id and i.order_set_id=p_order_set_id
      and i.revision_id=p_revision_id and i.child_kind='atomic'
      and (
        c.id is null
        or c.availability_status <> 'active'
        or (i.billing_reflection_default and c.price_krw is null)
      )
  )
  or exists (
    select 1
    from public.order_set_revision_items i
    join public.order_sets child
      on child.workspace_id=i.workspace_id and child.id=i.child_order_set_id
    join public.order_set_revisions child_revision
      on child_revision.workspace_id=i.workspace_id
     and child_revision.order_set_id=i.child_order_set_id
     and child_revision.id=i.child_set_revision_id
    where i.workspace_id=p_workspace_id and i.order_set_id=p_order_set_id
      and i.revision_id=p_revision_id and i.child_kind='order_set'
      and (
        child.availability_status <> 'active'
        or child.needs_composition_review
        or child_revision.validation_status <> 'valid'
        or exists (
          select 1
          from public.order_set_revision_items nested_i
          left join public.order_catalog_items nested_c
            on nested_c.workspace_id=nested_i.workspace_id
           and nested_c.id=nested_i.child_order_catalog_item_id
          where nested_i.workspace_id=child_revision.workspace_id
            and nested_i.order_set_id=child_revision.order_set_id
            and nested_i.revision_id=child_revision.id
            and nested_i.child_kind='atomic'
            and (
              nested_c.id is null
              or nested_c.availability_status <> 'active'
              or (nested_i.billing_reflection_default and nested_c.price_krw is null)
            )
        )
      )
  );
$$;

revoke all on function private.clair_b2_revision_composition_blocked(text,text,uuid) from public, anon, authenticated, service_role;

-- All create/save writers discover dependencies without locks, then lock the
-- complete affected catalog-id set in deterministic order before touching a
-- stable set or revision row.  The child one-level expansion is included so
-- a nested atomic pin participates in the same lock order.
create or replace function private.clair_b2_lock_catalog_dependencies(
  p_workspace_id text,
  p_order_set_id text,
  p_definition jsonb
)
returns void
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
begin
  perform 1
  from public.order_catalog_items c
  where c.workspace_id = p_workspace_id
    and c.id in (
      select i.child_order_catalog_item_id
      from public.order_set_revision_items i
      join public.order_sets s
        on s.workspace_id = i.workspace_id
       and s.id = i.order_set_id
       and s.current_revision_id = i.revision_id
      where s.workspace_id = p_workspace_id
        and s.id = p_order_set_id
        and i.child_kind = 'atomic'
      union
      select x.value->>'childOrderCatalogItemId'
      from jsonb_array_elements(coalesce(p_definition->'items','[]'::jsonb)) x(value)
      where x.value->>'childKind' = 'atomic'
      union
      select nested_i.child_order_catalog_item_id
      from jsonb_array_elements(coalesce(p_definition->'items','[]'::jsonb)) x(value)
      join public.order_set_revision_items nested_i
        on nested_i.workspace_id = p_workspace_id
       and nested_i.order_set_id = x.value->>'childOrderSetId'
       and nested_i.revision_id = nullif(x.value->>'childSetRevisionId','')::uuid
       and nested_i.child_kind = 'atomic'
      where x.value->>'childKind' = 'order_set'
    )
  order by c.id
  for update;
end;
$$;
revoke all on function private.clair_b2_lock_catalog_dependencies(text,text,jsonb)
  from public, anon, authenticated, service_role;

create or replace function private.clair_b2_make_result_envelope(
  p_ok boolean,
  p_outcome text,
  p_request_id uuid,
  p_error_code text,
  p_error_message text,
  p_order_set jsonb,
  p_revision jsonb,
  p_review jsonb,
  p_current_revision_id uuid
)
returns jsonb
language sql
immutable
security invoker
set search_path = public, private, pg_catalog
as $$
  select jsonb_build_object(
    'ok',p_ok,'outcome',p_outcome,'requestId',p_request_id::text,
    'error',case when p_error_code is null then null else jsonb_build_object('code',p_error_code,'field',null,'message',coalesce(p_error_message,p_error_code)) end,
    'result',case when p_ok then jsonb_build_object('orderSet',p_order_set,'revision',p_revision,'review',p_review,'current',case when p_current_revision_id is null then null else jsonb_build_object('revisionId',p_current_revision_id::text,'etag','order-set-revision-'||p_current_revision_id::text) end) else null end
  );
$$;

revoke all on function private.clair_b2_make_result_envelope(boolean,text,uuid,text,text,jsonb,jsonb,jsonb,uuid) from public, anon, authenticated, service_role;

create or replace function private.clair_b2_actor_can_manage(p_workspace_id text, p_actor_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private, pg_catalog
as $$
  select p_actor_user_id is not null
    and private.clair_is_active_workspace_member(p_workspace_id)
    and p_actor_user_id = auth.uid()
    and private.clair_current_user_has_workspace_permission(p_workspace_id,'service_catalog:manage');
$$;

revoke all on function private.clair_b2_actor_can_manage(text,uuid) from public, anon, authenticated, service_role;

-- A2's original catalog writer is retained behind a forward replacement so
-- every public catalog mutation takes the shared workspace lock only after
-- the existing authentication/admin boundary has passed.  B1's public
-- dispatcher continues to call this exact A2-compatible signature.
do $$
begin
  if to_regprocedure('public.clair_update_order_catalog_item_a2_base(text,text,integer,jsonb)') is null then
    raise exception 'b2_a2_catalog_writer_missing';
  end if;
  if to_regprocedure('public.clair_update_order_catalog_item_a2_unlocked(text,text,integer,jsonb)') is null then
    alter function public.clair_update_order_catalog_item_a2_base(text,text,integer,jsonb)
      rename to clair_update_order_catalog_item_a2_unlocked;
  end if;
end
$$;

create or replace function public.clair_update_order_catalog_item_a2_base(
  p_workspace_id text,
  p_item_id text,
  p_expected_catalog_revision integer,
  p_patch jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp, pg_catalog
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if not private.clair_is_active_workspace_member(p_workspace_id)
     or not private.clair_is_workspace_admin(p_workspace_id) then
    raise exception 'workspace_admin_required' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(
    pg_catalog.hashtextextended('clinical_master_workspace_adoption:' || p_workspace_id, 0)
  );
  return public.clair_update_order_catalog_item_a2_unlocked(
    p_workspace_id, p_item_id, p_expected_catalog_revision, p_patch
  );
end;
$$;

revoke all on function public.clair_update_order_catalog_item_a2_base(text,text,integer,jsonb)
  from public, anon, service_role;
grant execute on function public.clair_update_order_catalog_item_a2_base(text,text,integer,jsonb)
  to authenticated;

-- B1's owner-only lab adoption path is private and intentionally receives no
-- authenticated grant.  Its immutable implementation is retained behind a
-- lock wrapper so the exact adoption helper participates in the shared
-- publication -> workspace lock order used by the A2/B1 writers.
do $$
begin
  if to_regprocedure('private.clair_adopt_lab_master_projection_to_workspace(text,uuid)') is null then
    raise exception 'b2_b1_adoption_writer_missing';
  end if;
  if to_regprocedure('private.clair_adopt_lab_master_projection_to_workspace_b1_unlocked(text,uuid)') is null then
    alter function private.clair_adopt_lab_master_projection_to_workspace(text,uuid)
      rename to clair_adopt_lab_master_projection_to_workspace_b1_unlocked;
  end if;
end
$$;

create or replace function private.clair_adopt_lab_master_projection_to_workspace(
  p_workspace_id text,
  p_release_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, master, extensions, pg_temp, pg_catalog
as $$
begin
  perform pg_advisory_xact_lock(
    pg_catalog.hashtextextended('clinical_master_phase_1a_1_publication', 0)
  );
  perform pg_advisory_xact_lock(
    pg_catalog.hashtextextended('clinical_master_workspace_adoption:' || p_workspace_id, 0)
  );
  return private.clair_adopt_lab_master_projection_to_workspace_b1_unlocked(
    p_workspace_id,
    p_release_id
  );
end;
$$;
revoke all on function private.clair_adopt_lab_master_projection_to_workspace(text,uuid)
  from public, anon, authenticated, service_role;

create or replace function private.clair_b2_apply_catalog_invalidation(
  p_workspace_id text,
  p_catalog_item_id text
)
returns integer
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
declare
  v_count integer := 0;
  v_set record;
begin
  perform pg_advisory_xact_lock(pg_catalog.hashtextextended('clinical_master_workspace_adoption:'||p_workspace_id,0));
  for v_set in
    select distinct
      s.workspace_id,
      s.id,
      s.current_revision_id,
      s.availability_status,
      s.needs_composition_review,
      s.updated_by_user_id,
      s.created_by_user_id
    from public.order_sets s
    join public.order_set_revisions r on r.workspace_id=s.workspace_id and r.order_set_id=s.id and r.id=s.current_revision_id
    join public.order_set_revision_items i on i.workspace_id=r.workspace_id and i.order_set_id=r.order_set_id and i.revision_id=r.id
    where s.workspace_id=p_workspace_id
      and (
        (i.child_kind='atomic' and i.child_order_catalog_item_id=p_catalog_item_id)
        or (
          i.child_kind='order_set'
          and exists (
            select 1
            from public.order_set_revision_items nested_i
            where nested_i.workspace_id=i.workspace_id
              and nested_i.order_set_id=i.child_order_set_id
              and nested_i.revision_id=i.child_set_revision_id
              and nested_i.child_kind='atomic'
              and nested_i.child_order_catalog_item_id=p_catalog_item_id
          )
        )
      )
    order by s.id
  loop
    if not v_set.needs_composition_review then
      perform private.clair_b2_apply_projection(
        v_set.workspace_id,
        v_set.id,
        v_set.current_revision_id,
        v_set.availability_status,
        true,
        coalesce(v_set.updated_by_user_id, v_set.created_by_user_id)
      );
    end if;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
revoke all on function private.clair_b2_apply_catalog_invalidation(text,text) from public, anon, authenticated, service_role;

create or replace function private.clair_mark_order_set_composition_review_for_catalog_member(
  p_workspace_id text,
  p_catalog_item_id text,
  p_reason_code text,
  p_actor_user_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
begin
  if p_reason_code is null or btrim(p_reason_code) = '' then
    raise exception 'composition_review_reason_required';
  end if;
  return private.clair_b2_apply_catalog_invalidation(p_workspace_id, p_catalog_item_id);
end;
$$;
revoke all on function private.clair_mark_order_set_composition_review_for_catalog_member(text,text,text,uuid)
  from public, anon, authenticated, service_role;

create or replace function private.clair_b2_catalog_unusable_trigger()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
begin
  if (old.availability_status='active' and (not old.billing_reflection_enabled or old.price_krw is not null))
     and not (new.availability_status='active' and (not new.billing_reflection_enabled or new.price_krw is not null)) then
    perform private.clair_mark_order_set_composition_review_for_catalog_member(
      new.workspace_id,
      new.id,
      'catalog_member_unusable',
      auth.uid()
    );
  end if;
  return new;
end;
$$;
drop trigger if exists order_catalog_items_b2_composition_invalidation on public.order_catalog_items;
create trigger order_catalog_items_b2_composition_invalidation
after update of availability_status, price_krw, billing_reflection_enabled on public.order_catalog_items
for each row execute function private.clair_b2_catalog_unusable_trigger();
revoke all on function private.clair_b2_catalog_unusable_trigger() from public, anon, authenticated, service_role;

create or replace function private.clair_b2_order_set_detail_json(p_workspace_id text, p_order_set_id text)
returns jsonb
language sql
stable
security definer
set search_path = public, private, pg_catalog
as $$
  select to_jsonb(s) || jsonb_build_object(
    'currentEtag', case when s.current_revision_id is null then null else 'order-set-revision-' || s.current_revision_id::text end,
    'currentRevision', case when s.current_revision_id is null then null else private.clair_b2_revision_json(s.workspace_id,s.id,s.current_revision_id) end
  )
  from public.order_sets s
  where s.workspace_id=p_workspace_id and s.id=p_order_set_id;
$$;
revoke all on function private.clair_b2_order_set_detail_json(text,text) from public, anon, authenticated, service_role;

create or replace function private.clair_b2_create_core(
  p_workspace_id text,
  p_definition jsonb,
  p_availability_status text,
  p_actor_user_id uuid,
  p_request_id uuid,
  p_forced_order_set_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
declare
  v_normalized jsonb;
  v_hash text;
  v_error_code text;
  v_error_message text;
  v_existing record;
  v_order_set_id text;
  v_revision_id uuid;
  v_composition_blocked boolean := false;
  v_revision_result jsonb;
  v_envelope jsonb;
begin
  if p_request_id is null then raise exception 'request_id_required'; end if;
  if p_availability_status not in ('active','paused','inactive') then raise exception 'availability_status_invalid'; end if;
  begin
    v_normalized := private.clair_b2_normalize_definition(p_definition);
    v_hash := private.clair_b2_sha256(jsonb_build_object(
      'op','order_set_create',
      'workspaceId',p_workspace_id,
      'definition',v_normalized,
      'availabilityStatus',p_availability_status
    ));
  exception when others then
    v_normalized := null;
    v_hash := private.clair_b2_sha256(jsonb_build_object(
      'op','order_set_create',
      'workspaceId',p_workspace_id,
      'definition',coalesce(p_definition,'null'::jsonb),
      'availabilityStatus',p_availability_status
    ));
    v_error_code := 'invalid_order_set_definition';
    v_error_message := 'definition failed allow-list or pricing validation';
  end;
  select * into v_existing from private.order_set_creation_requests r where r.workspace_id=p_workspace_id and r.request_id=p_request_id;
  if found then
    if v_existing.actor_user_id is distinct from p_actor_user_id or v_existing.payload_sha256 is distinct from v_hash then
      return private.clair_b2_make_result_envelope(false,'conflict',p_request_id,'idempotency_conflict','request identity already has a different actor or payload',null,null,null,null);
    end if;
    return v_existing.result_envelope;
  end if;
  perform pg_advisory_xact_lock(pg_catalog.hashtextextended('clinical_master_workspace_adoption:'||p_workspace_id,0));
  select * into v_existing from private.order_set_creation_requests r where r.workspace_id=p_workspace_id and r.request_id=p_request_id;
  if found then
    if v_existing.actor_user_id is distinct from p_actor_user_id or v_existing.payload_sha256 is distinct from v_hash then return private.clair_b2_make_result_envelope(false,'conflict',p_request_id,'idempotency_conflict','request identity already has a different actor or payload',null,null,null,null); end if;
    return v_existing.result_envelope;
  end if;
  v_order_set_id := coalesce(p_forced_order_set_id, private.clair_b2_deterministic_uuid('creation',array[p_workspace_id::text,p_request_id::text]::text[])::text);
  if v_normalized is not null then
    perform private.clair_b2_lock_catalog_dependencies(p_workspace_id, v_order_set_id, v_normalized);
  end if;
  if v_error_code is null and jsonb_array_length(v_normalized->'items') = 0 and p_availability_status = 'active' then
    v_error_code := 'invalid_order_set_definition'; v_error_message := 'active order set requires at least one item';
  end if;
  if v_error_code is not null then
    v_envelope := private.clair_b2_make_result_envelope(false,'rejected',p_request_id,v_error_code,v_error_message,null,null,null,null);
    insert into private.order_set_creation_requests(workspace_id,request_id,actor_user_id,order_set_id,payload_sha256,outcome,result_envelope,created_at,completed_at) values(p_workspace_id,p_request_id,p_actor_user_id,v_order_set_id,v_hash,'rejected',v_envelope,now(),now());
    return v_envelope;
  end if;
  if exists(select 1 from public.order_sets where workspace_id=p_workspace_id and id=v_order_set_id) then
    v_envelope := private.clair_b2_make_result_envelope(false,'rejected',p_request_id,'idempotency_conflict','stable Order Set identity already exists',null,null,null,null);
    insert into private.order_set_creation_requests(workspace_id,request_id,actor_user_id,order_set_id,payload_sha256,outcome,result_envelope,created_at,completed_at) values(p_workspace_id,p_request_id,p_actor_user_id,v_order_set_id,v_hash,'rejected',v_envelope,now(),now());
    return v_envelope;
  end if;
  perform set_config('clinical_master.b2_internal_write','on',true);
  insert into public.order_sets(id,workspace_id,source_set_version,set_category,set_name,billing_name,availability_status,amount_basis,set_price_krw,sales_unit,billing_reflection_enabled,target_species,care_guide,internal_instruction,range_basis,range_price_ranges,tax_type,created_by_user_id,updated_by_user_id)
  values(v_order_set_id,p_workspace_id,'order-set-pending',v_normalized->>'setCategory',v_normalized->>'setName',v_normalized->>'billingName',p_availability_status,v_normalized->>'amountBasis',nullif(v_normalized->>'setPriceKrw','')::integer,v_normalized->>'salesUnit',(v_normalized->>'billingReflectionEnabled')::boolean,array(select jsonb_array_elements_text(v_normalized->'targetSpecies')),v_normalized->>'careGuide',v_normalized->>'internalInstruction',nullif(v_normalized->>'rangeBasis',''),'[]'::jsonb,v_normalized->>'taxType',p_actor_user_id,p_actor_user_id);
  -- Every new non-empty revision must be valid and usable.  Paused/inactive
  -- metadata-only sets are represented by a valid zero-item revision; they do
  -- not permit an unavailable member to enter native history.
  v_revision_result := private.clair_b2_write_revision(p_workspace_id,v_order_set_id,1,v_normalized,p_actor_user_id,false);
  if not coalesce((v_revision_result->>'ok')::boolean,false) then
    delete from public.order_sets where workspace_id=p_workspace_id and id=v_order_set_id;
    v_envelope := private.clair_b2_make_result_envelope(false,'rejected',p_request_id,v_revision_result->>'code',v_revision_result->>'message',null,null,null,null);
    insert into private.order_set_creation_requests(workspace_id,request_id,actor_user_id,order_set_id,payload_sha256,outcome,result_envelope,created_at,completed_at) values(p_workspace_id,p_request_id,p_actor_user_id,v_order_set_id,v_hash,'rejected',v_envelope,now(),now());
    return v_envelope;
  end if;
  v_revision_id := (v_revision_result->>'revisionId')::uuid;
  v_composition_blocked := private.clair_b2_revision_composition_blocked(p_workspace_id,v_order_set_id,v_revision_id);
  perform private.clair_b2_apply_projection(p_workspace_id,v_order_set_id,v_revision_id,p_availability_status,v_composition_blocked,p_actor_user_id);
  v_envelope := private.clair_b2_make_result_envelope(true,'created',p_request_id,null,null,private.clair_b2_order_set_detail_json(p_workspace_id,v_order_set_id),private.clair_b2_revision_json(p_workspace_id,v_order_set_id,v_revision_id),null,v_revision_id);
  insert into private.order_set_creation_requests(workspace_id,request_id,actor_user_id,order_set_id,payload_sha256,outcome,result_envelope,created_at,completed_at) values(p_workspace_id,p_request_id,p_actor_user_id,v_order_set_id,v_hash,'created',v_envelope,now(),now());
  return v_envelope;
end;
$$;
revoke all on function private.clair_b2_create_core(text,jsonb,text,uuid,uuid,text) from public, anon, authenticated, service_role;

create or replace function private.clair_b2_record_invalid_revision(
  p_workspace_id text,
  p_order_set_id text,
  p_revision_no integer,
  p_base_revision_id uuid,
  p_actor_user_id uuid,
  p_error_code text,
  p_error_field text,
  p_error_message text
)
returns uuid
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
declare
  v_base public.order_set_revisions%rowtype;
  v_existing public.order_set_revisions%rowtype;
  v_revision_id uuid := private.clair_b2_deterministic_uuid('revision',array[p_workspace_id,p_order_set_id,p_revision_no::text]::text[]);
  v_errors jsonb := jsonb_build_array(jsonb_build_object(
    'code',coalesce(nullif(btrim(p_error_code),''),'invalid_order_set_definition'),
    'field',coalesce(nullif(btrim(p_error_field),''),'definition'),
    'message',coalesce(nullif(btrim(p_error_message),''),'order set definition is invalid')
  ));
begin
  if p_revision_no is null or p_revision_no <= 0 or p_base_revision_id is null then raise exception 'invalid_order_set_definition'; end if;
  select * into v_base
  from public.order_set_revisions
  where workspace_id=p_workspace_id and order_set_id=p_order_set_id and id=p_base_revision_id
  for update;
  if not found or v_base.validation_status <> 'valid' then raise exception 'order_set_revision_invalid'; end if;
  perform set_config('clinical_master.b2_internal_write','on',true);
  insert into public.order_set_revisions(
    id,workspace_id,order_set_id,revision_no,validation_status,validation_errors,
    set_category,set_name,billing_name,amount_basis,set_price_krw,range_basis,
    sales_unit,billing_reflection_enabled,tax_type,target_species,care_guide,
    internal_instruction,created_by_user_id
  ) values (
    v_revision_id,p_workspace_id,p_order_set_id,p_revision_no,'invalid',v_errors,
    v_base.set_category,v_base.set_name,v_base.billing_name,v_base.amount_basis,
    v_base.set_price_krw,v_base.range_basis,v_base.sales_unit,
    v_base.billing_reflection_enabled,v_base.tax_type,v_base.target_species,
    v_base.care_guide,v_base.internal_instruction,p_actor_user_id
  ) on conflict (id) do nothing;
  select * into v_existing from public.order_set_revisions where id=v_revision_id;
  if not found or v_existing.validation_status <> 'invalid' or v_existing.validation_errors is distinct from v_errors then
    raise exception 'deterministic_id_collision';
  end if;
  return v_revision_id;
end;
$$;
revoke all on function private.clair_b2_record_invalid_revision(text,text,integer,uuid,uuid,text,text,text)
  from public, anon, authenticated, service_role;

create or replace function private.clair_b2_save_core(
  p_workspace_id text,
  p_order_set_id text,
  p_expected_current_revision_id uuid,
  p_definition jsonb,
  p_availability_status text,
  p_actor_user_id uuid,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
declare
  v_normalized jsonb;
  v_hash text;
  v_error_code text;
  v_error_message text;
  v_existing record;
  v_set public.order_sets%rowtype;
  v_next_revision_no integer;
  v_revision_id uuid;
  v_composition_blocked boolean := false;
  v_revision_result jsonb;
  v_envelope jsonb;
begin
  if p_request_id is null or p_expected_current_revision_id is null then raise exception 'request_id_and_base_required'; end if;
  if p_availability_status not in ('active','paused','inactive') then raise exception 'availability_status_invalid'; end if;
  begin v_normalized := private.clair_b2_normalize_definition(p_definition); v_hash := private.clair_b2_sha256(jsonb_build_object('op','order_set_revision_save','workspaceId',p_workspace_id,'orderSetId',p_order_set_id,'expectedCurrentRevisionId',p_expected_current_revision_id::text,'definition',v_normalized,'availabilityStatus',p_availability_status)); exception when others then v_normalized := null; v_hash := private.clair_b2_sha256(jsonb_build_object('op','order_set_revision_save','workspaceId',p_workspace_id,'orderSetId',p_order_set_id,'expectedCurrentRevisionId',p_expected_current_revision_id::text,'definition',coalesce(p_definition,'null'::jsonb),'availabilityStatus',p_availability_status)); v_error_code := 'invalid_order_set_definition'; v_error_message := 'definition failed allow-list or pricing validation'; end;
  select * into v_existing from private.order_set_revision_save_requests r where r.workspace_id=p_workspace_id and r.request_id=p_request_id;
  if found then
    if v_existing.actor_user_id is distinct from p_actor_user_id or v_existing.payload_sha256 is distinct from v_hash or v_existing.base_current_revision_id is distinct from p_expected_current_revision_id then return private.clair_b2_make_result_envelope(false,'conflict',p_request_id,'idempotency_conflict','request identity already has a different actor, payload, or base',null,null,null,null); end if;
    return v_existing.result_envelope;
  end if;
  perform pg_advisory_xact_lock(pg_catalog.hashtextextended('clinical_master_workspace_adoption:'||p_workspace_id,0));
  select * into v_existing from private.order_set_revision_save_requests r where r.workspace_id=p_workspace_id and r.request_id=p_request_id;
  if found then
    if v_existing.actor_user_id is distinct from p_actor_user_id or v_existing.payload_sha256 is distinct from v_hash or v_existing.base_current_revision_id is distinct from p_expected_current_revision_id then return private.clair_b2_make_result_envelope(false,'conflict',p_request_id,'idempotency_conflict','request identity already has a different actor, payload, or base',null,null,null,null); end if;
    return v_existing.result_envelope;
  end if;
  if v_normalized is not null then
    perform private.clair_b2_lock_catalog_dependencies(p_workspace_id, p_order_set_id, v_normalized);
  end if;
  select * into v_set from public.order_sets where workspace_id=p_workspace_id and id=p_order_set_id for update;
  if not found then raise exception 'order_set_not_found'; end if;
  if v_set.current_revision_id is distinct from p_expected_current_revision_id then
    v_envelope := private.clair_b2_make_result_envelope(false,'conflict',p_request_id,'revision_conflict','current revision changed',null,null,null,v_set.current_revision_id);
    insert into private.order_set_revision_save_requests(workspace_id,request_id,actor_user_id,order_set_id,base_current_revision_id,payload_sha256,result_current_revision_id,outcome,result_envelope,created_at,completed_at) values(p_workspace_id,p_request_id,p_actor_user_id,p_order_set_id,p_expected_current_revision_id,v_hash,v_set.current_revision_id,'conflict',v_envelope,now(),now());
    return v_envelope;
  end if;
  select coalesce(max(revision_no),0)+1 into v_next_revision_no
  from public.order_set_revisions
  where workspace_id=p_workspace_id and order_set_id=p_order_set_id;
  if v_error_code is null and jsonb_array_length(v_normalized->'items')=0 and p_availability_status='active' then v_error_code:='invalid_order_set_definition'; v_error_message:='active order set requires at least one item'; end if;
  if v_error_code is not null then
    if p_availability_status='inactive' and v_set.current_revision_id is not null then
      v_revision_id := private.clair_b2_record_invalid_revision(
        p_workspace_id,p_order_set_id,v_next_revision_no,v_set.current_revision_id,
        p_actor_user_id,'invalid_order_set_definition','definition',v_error_message
      );
      perform private.clair_b2_apply_projection(
        p_workspace_id,p_order_set_id,v_set.current_revision_id,
        'inactive',v_set.needs_composition_review,p_actor_user_id
      );
      v_envelope := private.clair_b2_make_result_envelope(
        false,'rejected',p_request_id,'invalid_order_set_definition',
        v_error_message,null,null,null,v_set.current_revision_id
      );
      insert into private.order_set_revision_save_requests(
        workspace_id,request_id,actor_user_id,order_set_id,base_current_revision_id,
        payload_sha256,result_revision_id,result_current_revision_id,outcome,
        result_envelope,created_at,completed_at
      ) values (
        p_workspace_id,p_request_id,p_actor_user_id,p_order_set_id,
        p_expected_current_revision_id,v_hash,v_revision_id,v_set.current_revision_id,
        'rejected',v_envelope,now(),now()
      );
      return v_envelope;
    end if;
    v_envelope := private.clair_b2_make_result_envelope(false,'rejected',p_request_id,v_error_code,v_error_message,null,null,null,v_set.current_revision_id);
    insert into private.order_set_revision_save_requests(workspace_id,request_id,actor_user_id,order_set_id,base_current_revision_id,payload_sha256,result_current_revision_id,outcome,result_envelope,created_at,completed_at) values(p_workspace_id,p_request_id,p_actor_user_id,p_order_set_id,p_expected_current_revision_id,v_hash,v_set.current_revision_id,'rejected',v_envelope,now(),now());
    return v_envelope;
  end if;
  v_revision_result := private.clair_b2_write_revision(
    p_workspace_id,p_order_set_id,v_next_revision_no,v_normalized,p_actor_user_id,
    p_availability_status='inactive'
  );
  if not coalesce((v_revision_result->>'ok')::boolean,false) then
    if p_availability_status='inactive'
       and v_set.current_revision_id is not null
       and v_revision_result->>'code' not in ('revision_conflict','deterministic_id_collision') then
      v_revision_id := private.clair_b2_record_invalid_revision(
        p_workspace_id,p_order_set_id,v_next_revision_no,v_set.current_revision_id,
        p_actor_user_id,'invalid_order_set_definition','items',v_revision_result->>'message'
      );
      perform private.clair_b2_apply_projection(
        p_workspace_id,p_order_set_id,v_set.current_revision_id,
        'inactive',v_set.needs_composition_review,p_actor_user_id
      );
      v_envelope := private.clair_b2_make_result_envelope(
        false,'rejected',p_request_id,'invalid_order_set_definition',
        v_revision_result->>'message',null,null,null,v_set.current_revision_id
      );
      insert into private.order_set_revision_save_requests(
        workspace_id,request_id,actor_user_id,order_set_id,base_current_revision_id,
        payload_sha256,result_revision_id,result_current_revision_id,outcome,
        result_envelope,created_at,completed_at
      ) values (
        p_workspace_id,p_request_id,p_actor_user_id,p_order_set_id,
        p_expected_current_revision_id,v_hash,v_revision_id,v_set.current_revision_id,
        'rejected',v_envelope,now(),now()
      );
      return v_envelope;
    end if;
    v_envelope := private.clair_b2_make_result_envelope(false,case when v_revision_result->>'code'='revision_conflict' then 'conflict' else 'rejected' end,p_request_id,v_revision_result->>'code',v_revision_result->>'message',null,null,null,v_set.current_revision_id);
    insert into private.order_set_revision_save_requests(workspace_id,request_id,actor_user_id,order_set_id,base_current_revision_id,payload_sha256,result_current_revision_id,outcome,result_envelope,created_at,completed_at) values(p_workspace_id,p_request_id,p_actor_user_id,p_order_set_id,p_expected_current_revision_id,v_hash,v_set.current_revision_id,case when v_revision_result->>'code'='revision_conflict' then 'conflict' else 'rejected' end,v_envelope,now(),now());
    return v_envelope;
  end if;
  v_revision_id := (v_revision_result->>'revisionId')::uuid;
  if v_revision_result->>'validationStatus' = 'invalid' then
    -- An inactive edit that contains an unusable member is retained as an
    -- immutable invalid revision for audit/quarantine.  It never becomes the
    -- current pointer or projection; the existing current revision remains
    -- the read authority while the stable set is safely inactive.
    perform private.clair_b2_apply_projection(
      p_workspace_id,p_order_set_id,v_set.current_revision_id,
      'inactive',v_set.needs_composition_review,p_actor_user_id
    );
    v_envelope := private.clair_b2_make_result_envelope(
      false,'rejected',p_request_id,'invalid_order_set_definition',
      'inactive revision retained as immutable invalid history',null,null,null,
      v_set.current_revision_id
    );
    insert into private.order_set_revision_save_requests(
      workspace_id,request_id,actor_user_id,order_set_id,
      base_current_revision_id,payload_sha256,result_revision_id,
      result_current_revision_id,outcome,result_envelope,created_at,completed_at
    ) values (
      p_workspace_id,p_request_id,p_actor_user_id,p_order_set_id,
      p_expected_current_revision_id,v_hash,v_revision_id,
      v_set.current_revision_id,'rejected',v_envelope,now(),now()
    );
    return v_envelope;
  end if;
  v_composition_blocked := private.clair_b2_revision_composition_blocked(p_workspace_id,p_order_set_id,v_revision_id);
  perform private.clair_b2_apply_projection(p_workspace_id,p_order_set_id,v_revision_id,p_availability_status,v_composition_blocked,p_actor_user_id);
  perform private.clair_b2_supersede_reviews_for_parent_revision(
    p_workspace_id,p_order_set_id,p_expected_current_revision_id,p_actor_user_id
  );
  v_envelope := private.clair_b2_make_result_envelope(true,'applied',p_request_id,null,null,private.clair_b2_order_set_detail_json(p_workspace_id,p_order_set_id),private.clair_b2_revision_json(p_workspace_id,p_order_set_id,v_revision_id),null,v_revision_id);
  insert into private.order_set_revision_save_requests(workspace_id,request_id,actor_user_id,order_set_id,base_current_revision_id,payload_sha256,result_revision_id,result_current_revision_id,outcome,result_envelope,created_at,completed_at) values(p_workspace_id,p_request_id,p_actor_user_id,p_order_set_id,p_expected_current_revision_id,v_hash,v_revision_id,v_revision_id,'applied',v_envelope,now(),now());
  return v_envelope;
end;
$$;
revoke all on function private.clair_b2_save_core(text,text,uuid,jsonb,text,uuid,uuid) from public, anon, authenticated, service_role;

create or replace function public.clair_create_order_set(
  p_workspace_id text,
  p_definition jsonb,
  p_availability_status text,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if not private.clair_is_active_workspace_member(p_workspace_id) or not private.clair_current_user_has_workspace_permission(p_workspace_id,'service_catalog:manage') then raise exception 'permission_missing' using errcode='42501'; end if;
  return private.clair_b2_create_core(p_workspace_id,p_definition,p_availability_status,auth.uid(),p_request_id,null);
end;
$$;
revoke all on function public.clair_create_order_set(text,jsonb,text,uuid) from public, anon, service_role;
grant execute on function public.clair_create_order_set(text,jsonb,text,uuid) to authenticated;

create or replace function public.clair_save_order_set_revision(
  p_workspace_id text,
  p_order_set_id text,
  p_expected_current_revision_id uuid,
  p_definition jsonb,
  p_availability_status text,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if not private.clair_is_active_workspace_member(p_workspace_id) or not private.clair_current_user_has_workspace_permission(p_workspace_id,'service_catalog:manage') then raise exception 'permission_missing' using errcode='42501'; end if;
  return private.clair_b2_save_core(p_workspace_id,p_order_set_id,p_expected_current_revision_id,p_definition,p_availability_status,auth.uid(),p_request_id);
end;
$$;
revoke all on function public.clair_save_order_set_revision(text,text,uuid,jsonb,text,uuid) from public, anon, service_role;
grant execute on function public.clair_save_order_set_revision(text,text,uuid,jsonb,text,uuid) to authenticated;

create or replace function public.clair_list_order_sets(p_workspace_id text, p_query text default null)
returns table(order_set_id text,current_revision_id uuid,current_revision_no integer,availability_status text,current_etag text,needs_composition_review boolean,set_name text,billing_name text,sales_unit text,target_species text[],amount_basis text,set_price_krw integer,range_basis text,tax_type text,range_price_ranges jsonb,pending_review_count integer)
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if not private.clair_is_active_workspace_member(p_workspace_id) or not private.clair_current_user_has_workspace_permission(p_workspace_id,'service_catalog:view') then raise exception 'permission_missing' using errcode='42501'; end if;
  return query
  select s.id,s.current_revision_id,r.revision_no,s.availability_status,case when s.current_revision_id is null then null else 'order-set-revision-'||s.current_revision_id::text end,s.needs_composition_review,s.set_name,s.billing_name,s.sales_unit,s.target_species,s.amount_basis,s.set_price_krw,s.range_basis,s.tax_type,s.range_price_ranges,(select count(*)::integer from public.order_set_revision_update_reviews rv where rv.workspace_id=s.workspace_id and rv.parent_order_set_id=s.id and rv.status='pending')
  from public.order_sets s left join public.order_set_revisions r on r.workspace_id=s.workspace_id and r.order_set_id=s.id and r.id=s.current_revision_id
  where s.workspace_id=p_workspace_id and (nullif(btrim(p_query),'') is null or s.set_name ilike '%'||btrim(p_query)||'%' or s.billing_name ilike '%'||btrim(p_query)||'%')
  order by s.set_name,s.id;
end;
$$;
revoke all on function public.clair_list_order_sets(text,text) from public, anon, service_role;
grant execute on function public.clair_list_order_sets(text,text) to authenticated;

create or replace function public.clair_get_order_set(p_workspace_id text, p_order_set_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
declare v_exists boolean;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if not private.clair_is_active_workspace_member(p_workspace_id) or not private.clair_current_user_has_workspace_permission(p_workspace_id,'service_catalog:view') then raise exception 'permission_missing' using errcode='42501'; end if;
  select exists(select 1 from public.order_sets where workspace_id=p_workspace_id and id=p_order_set_id) into v_exists;
  if not v_exists then raise exception 'order_set_not_found' using errcode='P0002'; end if;
  return jsonb_build_object('orderSet',private.clair_b2_order_set_detail_json(p_workspace_id,p_order_set_id),'history',coalesce((select jsonb_agg(private.clair_b2_revision_json(r.workspace_id,r.order_set_id,r.id) order by r.revision_no desc) from public.order_set_revisions r where r.workspace_id=p_workspace_id and r.order_set_id=p_order_set_id),'[]'::jsonb),'reviews',coalesce((select jsonb_agg(to_jsonb(rv) order by rv.created_at desc) from public.order_set_revision_update_reviews rv where rv.workspace_id=p_workspace_id and rv.parent_order_set_id=p_order_set_id),'[]'::jsonb));
end;
$$;
revoke all on function public.clair_get_order_set(text,text) from public, anon, service_role;
grant execute on function public.clair_get_order_set(text,text) to authenticated;

-- B2 review notifications have one private writer.  Keep the predecessor
-- emitter available for its existing event kinds, but reject the exact B2
-- event scope before it can upsert or bump a notification/user-state row.
do $$
begin
  if to_regprocedure('public.clair_emit_notification_event(text,uuid,jsonb)') is null then
    raise exception 'b2_notification_emitter_missing';
  end if;
  if to_regprocedure('public.clair_emit_notification_event_legacy(text,uuid,jsonb)') is null then
    alter function public.clair_emit_notification_event(text,uuid,jsonb)
      rename to clair_emit_notification_event_legacy;
  end if;
end
$$;

create or replace function public.clair_emit_notification_event(
  p_workspace_id text,
  p_actor_user_id uuid,
  p_event jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp, pg_catalog
as $$
begin
  if coalesce(p_event ->> 'eventScopeId', '') = 'order-set-review' then
    raise exception 'order_set_notification_writer_required' using errcode = '42501';
  end if;
  return public.clair_emit_notification_event_legacy(p_workspace_id, p_actor_user_id, p_event);
end;
$$;
revoke all on function public.clair_emit_notification_event(text,uuid,jsonb)
  from public, anon, service_role;
grant execute on function public.clair_emit_notification_event(text,uuid,jsonb)
  to authenticated;

-- Extend the existing notification vocabulary without creating a second event
-- kind column.  The old checks are replaced in place and all predecessor
-- values remain valid.
alter table public.notification_events
  drop constraint if exists notification_events_event_key_check,
  drop constraint if exists notification_events_domain_check;
alter table public.notification_events
  add constraint notification_events_event_key_check check (event_key in ('order_urgent_handoff','order_recheck_requested','assigned_order_completed','clinical_result_completed','device_result_received','imaging_result_completed','waiting_over_30m','dispensing_treatment_completed','billing_waiting_ready','inpatient_care_delayed','clinical_master_update_available')),
  add constraint notification_events_domain_check check (domain in ('reception','chart','lab','imaging','dispensing_treatment','billing','inpatient','hospital_admin'));

alter table private.order_set_review_notification_resolutions
  drop constraint if exists order_set_review_notification_resolution_payload_ck,
  add constraint order_set_review_notification_resolution_payload_ck check (
    resolution_payload = jsonb_build_object(
      'reviewId', review_id::text,
      'resolution', resolution_status,
      'resolvedByUserId', resolved_by_user_id::text,
      'resolvedAt', resolved_at
    )
  );

create or replace function private.clair_b2_resolution_payload(
  p_review_id uuid,
  p_resolution text,
  p_actor_user_id uuid,
  p_resolved_at timestamptz
)
returns jsonb
language sql
immutable
security invoker
set search_path = public, private, pg_catalog
as $$
  select jsonb_build_object('reviewId',p_review_id::text,'resolution',p_resolution,'resolvedByUserId',p_actor_user_id::text,'resolvedAt',p_resolved_at);
$$;
revoke all on function private.clair_b2_resolution_payload(uuid,text,uuid,timestamptz) from public, anon, authenticated, service_role;

create or replace function private.clair_b2_create_review_notification(
  p_workspace_id text,
  p_review_id uuid,
  p_parent_order_set_id text,
  p_parent_revision_id uuid,
  p_child_order_set_id text,
  p_pinned_child_revision_id uuid,
  p_available_child_revision_id uuid,
  p_pinned_revision_no integer,
  p_available_revision_no integer,
  p_actor_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
declare
  v_notification_id text := 'order-set-review-' || p_review_id::text;
  v_source_payload jsonb := jsonb_build_object('reviewId',p_review_id::text,'parentOrderSetId',p_parent_order_set_id,'parentRevisionId',p_parent_revision_id::text,'childOrderSetId',p_child_order_set_id,'pinnedChildRevisionId',p_pinned_child_revision_id::text,'availableChildRevisionId',p_available_child_revision_id::text,'pinnedRevisionNo',p_pinned_revision_no,'availableRevisionNo',p_available_revision_no);
  v_route text := '/w/' || replace(replace(p_workspace_id,chr(10),''),chr(13),'') || '/orders?modulePanel=open&section=order-sets&orderSetId=' || replace(replace(p_parent_order_set_id,chr(10),''),chr(13),'') || '&reviewId=' || p_review_id::text;
begin
  perform set_config('clinical_master.b2_internal_write','on',true);
  insert into public.notification_events(workspace_id,notification_id,event_scope_id,event_key,dedupe_key,domain,priority,toast_policy,title,preview,detail,work_type_label,source_label,source_action_label,recipient_kind,recipient_id,recipient_label,recipient_payload,source_kind,source_entity_id,source_route,source_payload,fallback_reason,requires_action,badge_count,actor_user_id,issued_at_label,occurred_at,bump_count,created_at,updated_at)
  values(p_workspace_id,v_notification_id,'order-set-review','clinical_master_update_available','order-set-child-review:'||p_review_id::text,'hospital_admin','normal','role_active','Order Set update available','A pinned child Order Set revision has a newer eligible revision.','A pinned child Order Set revision has a newer eligible revision.','Order Set review','Order Set management','Review','active_role','hospital_admin','Hospital admin',jsonb_build_object('workspaceId',p_workspace_id,'role','hospital_admin'),'fallback_detail',p_review_id::text,v_route,v_source_payload,null,true,true,p_actor_user_id,'방금 전',now(),1,now(),now())
  on conflict (workspace_id,event_scope_id,dedupe_key) do nothing;
  insert into private.order_set_review_notification_resolutions(workspace_id,review_id,notification_id,resolution_status,resolved_by_user_id,resolved_at,resolution_payload)
  values(p_workspace_id,p_review_id,v_notification_id,'pending',null,null,private.clair_b2_resolution_payload(p_review_id,'pending',null,null))
  on conflict (workspace_id,review_id) do nothing;
end;
$$;
revoke all on function private.clair_b2_create_review_notification(text,uuid,text,uuid,text,uuid,uuid,integer,integer,uuid) from public, anon, authenticated, service_role;

create or replace function private.clair_b2_resolve_review_notification(
  p_workspace_id text,
  p_review_id uuid,
  p_resolution text,
  p_actor_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
declare
  v_now timestamptz := now();
  v_notification_id text := 'order-set-review-' || p_review_id::text;
begin
  if p_resolution not in ('accepted','dismissed','superseded','obsolete') then raise exception 'review_resolution_invalid'; end if;
  perform set_config('clinical_master.b2_internal_write','on',true);
  update private.order_set_review_notification_resolutions
  set resolution_status=p_resolution,resolved_by_user_id=p_actor_user_id,resolved_at=v_now,resolution_payload=private.clair_b2_resolution_payload(p_review_id,p_resolution,p_actor_user_id,v_now),updated_at=v_now
  where workspace_id=p_workspace_id and review_id=p_review_id;
  update public.notification_events
  set requires_action=false,badge_count=false,updated_at=v_now
  where workspace_id=p_workspace_id and notification_id=v_notification_id;
end;
$$;
revoke all on function private.clair_b2_resolve_review_notification(text,uuid,text,uuid) from public, anon, authenticated, service_role;

create or replace function private.clair_b2_supersede_pending_review(
  p_workspace_id text,
  p_parent_order_set_id text,
  p_pinned_child_revision_id uuid,
  p_available_child_revision_id uuid,
  p_actor_user_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
declare
  v_review record;
  v_count integer := 0;
begin
  for v_review in
    select * from public.order_set_revision_update_reviews
    where workspace_id=p_workspace_id and parent_order_set_id=p_parent_order_set_id and status='pending'
      and (p_pinned_child_revision_id is null or pinned_child_revision_id=p_pinned_child_revision_id)
      and (p_available_child_revision_id is null or available_child_revision_id<>p_available_child_revision_id)
    order by id
    for update
  loop
    perform set_config('clinical_master.b2_internal_write','on',true);
    update public.order_set_revision_update_reviews set status='superseded',resolved_at=now(),resolved_by_user_id=p_actor_user_id where workspace_id=p_workspace_id and id=v_review.id;
    perform private.clair_b2_resolve_review_notification(p_workspace_id,v_review.id,'superseded',p_actor_user_id);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
revoke all on function private.clair_b2_supersede_pending_review(text,text,uuid,uuid,uuid) from public, anon, authenticated, service_role;

create or replace function private.clair_b2_supersede_reviews_for_parent_revision(
  p_workspace_id text,
  p_parent_order_set_id text,
  p_parent_revision_id uuid,
  p_actor_user_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
declare
  v_review record;
  v_count integer := 0;
begin
  for v_review in
    select id
    from public.order_set_revision_update_reviews
    where workspace_id=p_workspace_id
      and parent_order_set_id=p_parent_order_set_id
      and parent_revision_id=p_parent_revision_id
      and status='pending'
    order by id
    for update
  loop
    perform set_config('clinical_master.b2_internal_write','on',true);
    update public.order_set_revision_update_reviews
    set status='superseded',resolved_at=now(),resolved_by_user_id=p_actor_user_id
    where workspace_id=p_workspace_id and id=v_review.id;
    perform private.clair_b2_resolve_review_notification(
      p_workspace_id,v_review.id,'superseded',p_actor_user_id
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
revoke all on function private.clair_b2_supersede_reviews_for_parent_revision(text,text,uuid,uuid)
  from public, anon, authenticated, service_role;

create or replace function private.clair_b2_child_revision_advance_trigger()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
declare
  v_parent record;
  v_review_id uuid;
  v_child_revision_no integer;
  v_actor uuid := coalesce(new.updated_by_user_id, new.created_by_user_id);
begin
  if old.current_revision_id is null or new.current_revision_id is null or old.current_revision_id = new.current_revision_id then return new; end if;
  perform pg_advisory_xact_lock(pg_catalog.hashtextextended('clinical_master_workspace_adoption:'||new.workspace_id,0));
  if new.availability_status <> 'active' or new.needs_composition_review then
    perform private.clair_mark_order_set_composition_review_for_child_set(
      new.workspace_id,
      new.id,
      'child_set_unusable',
      coalesce(new.updated_by_user_id, new.created_by_user_id, auth.uid())
    );
    return new;
  end if;
  select revision_no into v_child_revision_no from public.order_set_revisions where workspace_id=new.workspace_id and order_set_id=new.id and id=new.current_revision_id;
  for v_parent in
    select distinct
      s.id as parent_id,
      r.id as parent_revision_id,
      i.child_order_set_id,
      i.child_set_revision_id,
      pinned_revision.revision_no as pinned_child_revision_no
    from public.order_sets s
    join public.order_set_revisions r on r.workspace_id=s.workspace_id and r.order_set_id=s.id and r.id=s.current_revision_id
    join public.order_set_revision_items i on i.workspace_id=r.workspace_id and i.order_set_id=r.order_set_id and i.revision_id=r.id
    join public.order_set_revisions pinned_revision
      on pinned_revision.workspace_id=i.workspace_id
     and pinned_revision.order_set_id=i.child_order_set_id
     and pinned_revision.id=i.child_set_revision_id
    where s.workspace_id=new.workspace_id
      and s.id<>new.id
      and i.child_kind='order_set'
      and i.child_order_set_id=new.id
      and pinned_revision.revision_no < v_child_revision_no
    order by s.id,r.id
  loop
    v_review_id := private.clair_b2_deterministic_uuid('review',array[new.workspace_id::text,v_parent.parent_revision_id::text,v_parent.child_set_revision_id::text,new.current_revision_id::text]::text[]);
    perform private.clair_b2_supersede_pending_review(
      new.workspace_id,
      v_parent.parent_id,
      v_parent.child_set_revision_id,
      new.current_revision_id,
      v_actor
    );
    perform set_config('clinical_master.b2_internal_write','on',true);
    insert into public.order_set_revision_update_reviews(id,workspace_id,parent_order_set_id,parent_revision_id,child_order_set_id,pinned_child_revision_id,available_child_revision_id,status)
    values(v_review_id,new.workspace_id,v_parent.parent_id,v_parent.parent_revision_id,new.id,v_parent.child_set_revision_id,new.current_revision_id,'pending')
    on conflict (id) do nothing;
    perform private.clair_b2_create_review_notification(new.workspace_id,v_review_id,v_parent.parent_id,v_parent.parent_revision_id,new.id,v_parent.child_set_revision_id,new.current_revision_id,v_parent.pinned_child_revision_no,v_child_revision_no,v_actor);
  end loop;
  return new;
end;
$$;

drop trigger if exists order_sets_b2_child_revision_advance on public.order_sets;
create trigger order_sets_b2_child_revision_advance
after update of current_revision_id on public.order_sets
for each row execute function private.clair_b2_child_revision_advance_trigger();
revoke all on function private.clair_b2_child_revision_advance_trigger() from public, anon, authenticated, service_role;

create or replace function private.clair_b2_apply_child_invalidation(p_workspace_id text, p_child_order_set_id text, p_child_revision_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
declare v_parent record; v_count integer := 0;
begin
  perform pg_advisory_xact_lock(pg_catalog.hashtextextended('clinical_master_workspace_adoption:'||p_workspace_id,0));
  for v_parent in
    select distinct s.id from public.order_sets s join public.order_set_revisions r on r.workspace_id=s.workspace_id and r.order_set_id=s.id and r.id=s.current_revision_id join public.order_set_revision_items i on i.workspace_id=r.workspace_id and i.order_set_id=r.order_set_id and i.revision_id=r.id where s.workspace_id=p_workspace_id and i.child_kind='order_set' and i.child_order_set_id=p_child_order_set_id and (p_child_revision_id is null or i.child_set_revision_id=p_child_revision_id) order by s.id
  loop
    perform private.clair_b2_apply_projection(
      p_workspace_id,
      v_parent.id,
      (select current_revision_id from public.order_sets where workspace_id=p_workspace_id and id=v_parent.id),
      (select availability_status from public.order_sets where workspace_id=p_workspace_id and id=v_parent.id),
      true,
      (select coalesce(updated_by_user_id, created_by_user_id) from public.order_sets where workspace_id=p_workspace_id and id=v_parent.id)
    );
    perform private.clair_b2_supersede_pending_review(
      p_workspace_id,
      v_parent.id,
      p_child_revision_id,
      null,
      (select coalesce(updated_by_user_id, created_by_user_id) from public.order_sets where workspace_id=p_workspace_id and id=v_parent.id)
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
revoke all on function private.clair_b2_apply_child_invalidation(text,text,uuid) from public, anon, authenticated, service_role;

create or replace function private.clair_mark_order_set_composition_review_for_child_set(
  p_workspace_id text,
  p_child_order_set_id text,
  p_reason_code text,
  p_actor_user_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
begin
  if p_reason_code is null or btrim(p_reason_code) = '' then
    raise exception 'composition_review_reason_required';
  end if;
  return private.clair_b2_apply_child_invalidation(
    p_workspace_id,
    p_child_order_set_id,
    null
  );
end;
$$;
revoke all on function private.clair_mark_order_set_composition_review_for_child_set(text,text,text,uuid)
  from public, anon, authenticated, service_role;

create or replace function private.clair_b2_apply_child_unusable_trigger()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
begin
  if old.current_revision_id is not null and new.current_revision_id is not null and old.current_revision_id = new.current_revision_id and old.availability_status='active' and (new.availability_status<>'active' or new.needs_composition_review) then
    perform private.clair_mark_order_set_composition_review_for_child_set(
      new.workspace_id,
      new.id,
      'child_set_unusable',
      coalesce(new.updated_by_user_id, new.created_by_user_id, auth.uid())
    );
  end if;
  return new;
end;
$$;
drop trigger if exists order_sets_b2_child_unusable on public.order_sets;
create trigger order_sets_b2_child_unusable
after update of availability_status,needs_composition_review on public.order_sets
for each row execute function private.clair_b2_apply_child_unusable_trigger();
revoke all on function private.clair_b2_apply_child_unusable_trigger() from public, anon, authenticated, service_role;

create or replace function private.clair_b2_resolve_review_core(
  p_workspace_id text,
  p_review_id uuid,
  p_expected_parent_revision_id uuid,
  p_action text,
  p_actor_user_id uuid,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
declare
  v_review public.order_set_revision_update_reviews%rowtype;
  v_parent public.order_sets%rowtype;
  v_child public.order_sets%rowtype;
  v_child_revision public.order_set_revisions%rowtype;
  v_existing record;
  v_hash text;
  v_envelope jsonb;
  v_code text;
  v_message text;
  v_outcome text;
  v_revision_result jsonb;
  v_definition jsonb;
  v_next_no integer;
  v_revision_id uuid;
  v_item record;
begin
  if p_request_id is null or p_expected_parent_revision_id is null or p_action not in ('accept','dismiss') then raise exception 'review_request_invalid'; end if;
  select * into v_review from public.order_set_revision_update_reviews where workspace_id=p_workspace_id and id=p_review_id;
  if not found then raise exception 'order_set_review_not_found' using errcode='P0002'; end if;
  v_hash := private.clair_b2_sha256(jsonb_build_object('op','order_set_review_resolution','workspaceId',p_workspace_id,'reviewId',p_review_id::text,'action',p_action,'expectedParentRevisionId',p_expected_parent_revision_id::text,'storedPinnedChildRevisionId',v_review.pinned_child_revision_id::text,'storedAvailableChildRevisionId',v_review.available_child_revision_id::text,'actorUserId',p_actor_user_id::text));
  select * into v_existing from private.order_set_review_resolution_requests r where r.workspace_id=p_workspace_id and r.request_id=p_request_id;
  if found then
    if v_existing.actor_user_id is distinct from p_actor_user_id or v_existing.payload_sha256 is distinct from v_hash or v_existing.base_parent_revision_id is distinct from p_expected_parent_revision_id then return private.clair_b2_make_result_envelope(false,'conflict',p_request_id,'idempotency_conflict','request identity already has a different actor, payload, or base',null,null,null,null); end if;
    return v_existing.result_envelope;
  end if;
  perform pg_advisory_xact_lock(pg_catalog.hashtextextended('clinical_master_workspace_adoption:'||p_workspace_id,0));
  select * into v_existing from private.order_set_review_resolution_requests r where r.workspace_id=p_workspace_id and r.request_id=p_request_id;
  if found then
    if v_existing.actor_user_id is distinct from p_actor_user_id or v_existing.payload_sha256 is distinct from v_hash or v_existing.base_parent_revision_id is distinct from p_expected_parent_revision_id then return private.clair_b2_make_result_envelope(false,'conflict',p_request_id,'idempotency_conflict','request identity already has a different actor, payload, or base',null,null,null,null); end if;
    return v_existing.result_envelope;
  end if;
  -- Discovery above was non-locking.  Every review writer now locks catalog
  -- members, stable sets, revisions/items/ranges, and the review last.
  perform 1
  from public.order_catalog_items c
  where c.workspace_id = p_workspace_id
    and c.id in (
      select i.child_order_catalog_item_id
      from public.order_set_revision_items i
      where i.workspace_id = p_workspace_id
        and i.order_set_id in (v_review.parent_order_set_id, v_review.child_order_set_id)
        and i.revision_id in (v_review.parent_revision_id, v_review.pinned_child_revision_id, v_review.available_child_revision_id)
        and i.child_kind = 'atomic'
    )
  order by c.id
  for update;
  if v_review.parent_order_set_id <= v_review.child_order_set_id then
    select * into v_parent from public.order_sets where workspace_id=p_workspace_id and id=v_review.parent_order_set_id for update;
    select * into v_child from public.order_sets where workspace_id=p_workspace_id and id=v_review.child_order_set_id for update;
  else
    select * into v_child from public.order_sets where workspace_id=p_workspace_id and id=v_review.child_order_set_id for update;
    select * into v_parent from public.order_sets where workspace_id=p_workspace_id and id=v_review.parent_order_set_id for update;
  end if;
  perform 1
  from public.order_set_revisions r
  where r.workspace_id = p_workspace_id
    and r.order_set_id in (v_review.parent_order_set_id, v_review.child_order_set_id)
    and r.id in (v_review.parent_revision_id, v_review.pinned_child_revision_id, v_review.available_child_revision_id)
  order by r.order_set_id, r.id
  for update;
  perform 1
  from public.order_set_revision_items i
  where i.workspace_id = p_workspace_id
    and i.order_set_id in (v_review.parent_order_set_id, v_review.child_order_set_id)
    and i.revision_id in (v_review.parent_revision_id, v_review.pinned_child_revision_id, v_review.available_child_revision_id)
  order by i.order_set_id, i.revision_id, i.id
  for update;
  perform 1
  from public.order_set_revision_price_ranges r
  where r.workspace_id = p_workspace_id
    and r.order_set_id in (v_review.parent_order_set_id, v_review.child_order_set_id)
    and r.revision_id in (v_review.parent_revision_id, v_review.pinned_child_revision_id, v_review.available_child_revision_id)
  order by r.order_set_id, r.revision_id, r.id
  for update;
  select * into v_review from public.order_set_revision_update_reviews where workspace_id=p_workspace_id and id=p_review_id for update;
  if v_review.status <> 'pending' then
    -- Terminal review state is durable.  A retry returns the stored terminal
    -- outcome and never changes notification resolution/read state.
    if v_review.status='accepted' then
      v_envelope := private.clair_b2_make_result_envelope(
        true,'accepted',p_request_id,null,null,
        private.clair_b2_order_set_detail_json(p_workspace_id,v_parent.id),
        private.clair_b2_revision_json(p_workspace_id,v_parent.id,v_review.result_parent_revision_id),
        to_jsonb(v_review),v_parent.current_revision_id
      );
      v_outcome := 'accepted';
    elsif v_review.status='dismissed' then
      v_envelope := private.clair_b2_make_result_envelope(
        true,'dismissed',p_request_id,null,null,
        private.clair_b2_order_set_detail_json(p_workspace_id,v_parent.id),null,
        to_jsonb(v_review),v_parent.current_revision_id
      );
      v_outcome := 'dismissed';
    else
      v_envelope := private.clair_b2_make_result_envelope(
        false,'superseded',p_request_id,'order_set_review_obsolete',
        'review already has a terminal superseded outcome',null,null,
        to_jsonb(v_review),v_parent.current_revision_id
      );
      v_outcome := 'superseded';
    end if;
    insert into private.order_set_review_resolution_requests(
      workspace_id,request_id,actor_user_id,review_id,base_parent_revision_id,
      expected_child_revision_id,payload_sha256,result_parent_revision_id,
      result_parent_current_revision_id,outcome,result_envelope,created_at,completed_at
    ) values (
      p_workspace_id,p_request_id,p_actor_user_id,p_review_id,
      p_expected_parent_revision_id,v_review.available_child_revision_id,v_hash,
      v_review.result_parent_revision_id,v_parent.current_revision_id,v_outcome,
      v_envelope,now(),now()
    );
    return v_envelope;
  end if;
  if v_parent.current_revision_id is distinct from p_expected_parent_revision_id then
    perform set_config('clinical_master.b2_internal_write','on',true);
    update public.order_set_revision_update_reviews
    set status='superseded',resolved_at=now(),resolved_by_user_id=p_actor_user_id
    where workspace_id=p_workspace_id and id=p_review_id;
    perform private.clair_b2_resolve_review_notification(
      p_workspace_id,p_review_id,'superseded',p_actor_user_id
    );
    v_envelope := private.clair_b2_make_result_envelope(
      false,'superseded',p_request_id,'order_set_review_obsolete',
      'review target is no longer current',null,null,null,v_parent.current_revision_id
    );
    insert into private.order_set_review_resolution_requests(
      workspace_id,request_id,actor_user_id,review_id,base_parent_revision_id,
      expected_child_revision_id,payload_sha256,result_parent_current_revision_id,
      outcome,result_envelope,created_at,completed_at
    ) values (
      p_workspace_id,p_request_id,p_actor_user_id,p_review_id,
      p_expected_parent_revision_id,v_review.available_child_revision_id,v_hash,
      v_parent.current_revision_id,'superseded',v_envelope,now(),now()
    );
    return v_envelope;
  end if;
  if p_action='dismiss' then
    perform set_config('clinical_master.b2_internal_write','on',true);
    update public.order_set_revision_update_reviews set status='dismissed',resolved_at=now(),resolved_by_user_id=p_actor_user_id where workspace_id=p_workspace_id and id=p_review_id;
    perform private.clair_b2_resolve_review_notification(p_workspace_id,p_review_id,'dismissed',p_actor_user_id);
    select * into v_review from public.order_set_revision_update_reviews where workspace_id=p_workspace_id and id=p_review_id;
    v_envelope := private.clair_b2_make_result_envelope(true,'dismissed',p_request_id,null,null,private.clair_b2_order_set_detail_json(p_workspace_id,v_parent.id),null,to_jsonb(v_review),v_parent.current_revision_id);
    insert into private.order_set_review_resolution_requests(workspace_id,request_id,actor_user_id,review_id,base_parent_revision_id,expected_child_revision_id,payload_sha256,result_parent_current_revision_id,outcome,result_envelope,created_at,completed_at) values(p_workspace_id,p_request_id,p_actor_user_id,p_review_id,p_expected_parent_revision_id,v_review.available_child_revision_id,v_hash,v_parent.current_revision_id,'dismissed',v_envelope,now(),now());
    return v_envelope;
  end if;
  select * into v_child_revision from public.order_set_revisions where workspace_id=p_workspace_id and order_set_id=v_review.child_order_set_id and id=v_review.available_child_revision_id;
  if not found or v_child.availability_status <> 'active' or v_child.needs_composition_review then
    perform private.clair_b2_apply_child_invalidation(p_workspace_id,v_review.child_order_set_id,v_review.pinned_child_revision_id);
    perform set_config('clinical_master.b2_internal_write','on',true);
    update public.order_set_revision_update_reviews set status='superseded',resolved_at=now(),resolved_by_user_id=p_actor_user_id where workspace_id=p_workspace_id and id=p_review_id;
    perform private.clair_b2_resolve_review_notification(p_workspace_id,p_review_id,'superseded',p_actor_user_id);
    v_envelope := private.clair_b2_make_result_envelope(false,'superseded',p_request_id,'order_set_member_unavailable','accepted child revision is unavailable',null,null,null,v_parent.current_revision_id);
    insert into private.order_set_review_resolution_requests(workspace_id,request_id,actor_user_id,review_id,base_parent_revision_id,expected_child_revision_id,payload_sha256,result_parent_current_revision_id,outcome,result_envelope,created_at,completed_at) values(p_workspace_id,p_request_id,p_actor_user_id,p_review_id,p_expected_parent_revision_id,v_review.available_child_revision_id,v_hash,v_parent.current_revision_id,'superseded',v_envelope,now(),now());
    return v_envelope;
  end if;
  if v_child.current_revision_id is distinct from v_review.available_child_revision_id then
    -- A newer child current revision makes this review obsolete, but the
    -- child remains usable.  Do not composition-block the selectable parent.
    perform set_config('clinical_master.b2_internal_write','on',true);
    update public.order_set_revision_update_reviews
    set status='superseded',resolved_at=now(),resolved_by_user_id=p_actor_user_id
    where workspace_id=p_workspace_id and id=p_review_id;
    perform private.clair_b2_resolve_review_notification(
      p_workspace_id,p_review_id,'superseded',p_actor_user_id
    );
    v_envelope := private.clair_b2_make_result_envelope(
      false,'superseded',p_request_id,'order_set_review_obsolete',
      'review target was superseded by a newer usable child revision',null,null,null,
      v_parent.current_revision_id
    );
    insert into private.order_set_review_resolution_requests(
      workspace_id,request_id,actor_user_id,review_id,base_parent_revision_id,
      expected_child_revision_id,payload_sha256,result_parent_current_revision_id,
      outcome,result_envelope,created_at,completed_at
    ) values (
      p_workspace_id,p_request_id,p_actor_user_id,p_review_id,
      p_expected_parent_revision_id,v_review.available_child_revision_id,v_hash,
      v_parent.current_revision_id,'superseded',v_envelope,now(),now()
    );
    return v_envelope;
  end if;
  if exists (select 1 from public.order_set_revision_items i join public.order_catalog_items c on c.workspace_id=i.workspace_id and c.id=i.child_order_catalog_item_id where i.workspace_id=p_workspace_id and i.order_set_id=v_child.id and i.revision_id=v_child_revision.id and i.child_kind='atomic' and (c.availability_status <> 'active' or c.catalog_revision is distinct from i.child_order_catalog_revision or (i.billing_reflection_default and c.price_krw is null))) then
    if exists (select 1 from public.order_set_revision_items i join public.order_catalog_items c on c.workspace_id=i.workspace_id and c.id=i.child_order_catalog_item_id where i.workspace_id=p_workspace_id and i.order_set_id=v_child.id and i.revision_id=v_child_revision.id and i.child_kind='atomic' and (c.availability_status <> 'active' or (i.billing_reflection_default and c.price_krw is null))) then
      v_code := 'order_set_member_unavailable'; v_message := 'nested atomic member is unavailable';
    elsif exists (select 1 from public.order_set_revision_items i join public.order_catalog_items c on c.workspace_id=i.workspace_id and c.id=i.child_order_catalog_item_id where i.workspace_id=p_workspace_id and i.order_set_id=v_child.id and i.revision_id=v_child_revision.id and i.child_kind='atomic' and c.catalog_revision is distinct from i.child_order_catalog_revision and (not i.billing_reflection_default or c.price_krw is not null)) then
      v_code := 'child_revision_requires_refresh'; v_message := 'nested atomic pins are stale but usable';
    else
      v_code := 'order_set_member_unavailable'; v_message := 'nested atomic member is unavailable';
    end if;
    perform set_config('clinical_master.b2_internal_write','on',true);
    update public.order_set_revision_update_reviews set status='superseded',resolved_at=now(),resolved_by_user_id=p_actor_user_id where workspace_id=p_workspace_id and id=p_review_id;
    if v_code='order_set_member_unavailable' then perform private.clair_b2_apply_child_invalidation(p_workspace_id,v_review.child_order_set_id,v_review.pinned_child_revision_id); end if;
    perform private.clair_b2_resolve_review_notification(p_workspace_id,p_review_id,'superseded',p_actor_user_id);
    v_envelope := private.clair_b2_make_result_envelope(false,'superseded',p_request_id,v_code,v_message,null,null,null,v_parent.current_revision_id);
    insert into private.order_set_review_resolution_requests(workspace_id,request_id,actor_user_id,review_id,base_parent_revision_id,expected_child_revision_id,payload_sha256,result_parent_current_revision_id,outcome,result_envelope,created_at,completed_at) values(p_workspace_id,p_request_id,p_actor_user_id,p_review_id,p_expected_parent_revision_id,v_review.available_child_revision_id,v_hash,v_parent.current_revision_id,'superseded',v_envelope,now(),now());
    return v_envelope;
  end if;
  select jsonb_build_object('setCategory',r.set_category,'setName',r.set_name,'billingName',r.billing_name,'amountBasis',r.amount_basis,'setPriceKrw',r.set_price_krw,'rangeBasis',r.range_basis,'salesUnit',r.sales_unit,'billingReflectionEnabled',r.billing_reflection_enabled,'taxType',r.tax_type,'targetSpecies',to_jsonb(r.target_species),'careGuide',r.care_guide,'internalInstruction',r.internal_instruction,'items',coalesce((select jsonb_agg(jsonb_build_object('childKind',i.child_kind,'childOrderCatalogItemId',case when i.child_kind='atomic' then i.child_order_catalog_item_id else null end,'childOrderCatalogRevision',case when i.child_kind='atomic' then c.catalog_revision else null end,'childOrderSetId',case when i.child_kind='order_set' then i.child_order_set_id else null end,'childSetRevisionId',case when i.child_kind='order_set' and i.child_order_set_id=v_review.child_order_set_id then v_review.available_child_revision_id when i.child_kind='order_set' then i.child_set_revision_id else null end,'sortOrder',i.sort_order,'defaultSelected',i.default_selected,'billingReflectionDefault',i.billing_reflection_default,'defaultQuantity',i.default_quantity,'quantitySource',i.quantity_source) order by i.sort_order) from public.order_set_revision_items i left join public.order_catalog_items c on c.workspace_id=i.workspace_id and c.id=i.child_order_catalog_item_id where i.workspace_id=r.workspace_id and i.order_set_id=r.order_set_id and i.revision_id=r.id),'[]'::jsonb),'priceRanges',private.clair_b2_revision_ranges_json(r.workspace_id,r.order_set_id,r.id)) into v_definition from public.order_set_revisions r where r.workspace_id=p_workspace_id and r.order_set_id=v_parent.id and r.id=v_parent.current_revision_id;
  select coalesce(max(revision_no),0)+1 into v_next_no from public.order_set_revisions where workspace_id=p_workspace_id and order_set_id=v_parent.id;
  v_revision_result := private.clair_b2_write_revision(p_workspace_id,v_parent.id,v_next_no,v_definition,p_actor_user_id,false);
  if not coalesce((v_revision_result->>'ok')::boolean,false) then
    v_envelope := private.clair_b2_make_result_envelope(false,'superseded',p_request_id,v_revision_result->>'code',v_revision_result->>'message',null,null,null,v_parent.current_revision_id);
    perform set_config('clinical_master.b2_internal_write','on',true);
    if v_revision_result->>'code' = 'order_set_member_unavailable' then
      perform private.clair_b2_apply_projection(
        p_workspace_id,
        v_parent.id,
        v_parent.current_revision_id,
        v_parent.availability_status,
        true,
        p_actor_user_id
      );
    end if;
    update public.order_set_revision_update_reviews set status='superseded',resolved_at=now(),resolved_by_user_id=p_actor_user_id where workspace_id=p_workspace_id and id=p_review_id;
    perform private.clair_b2_resolve_review_notification(p_workspace_id,p_review_id,'superseded',p_actor_user_id);
    insert into private.order_set_review_resolution_requests(workspace_id,request_id,actor_user_id,review_id,base_parent_revision_id,expected_child_revision_id,payload_sha256,result_parent_current_revision_id,outcome,result_envelope,created_at,completed_at) values(p_workspace_id,p_request_id,p_actor_user_id,p_review_id,p_expected_parent_revision_id,v_review.available_child_revision_id,v_hash,v_parent.current_revision_id,'superseded',v_envelope,now(),now());
    return v_envelope;
  end if;
  v_revision_id := (v_revision_result->>'revisionId')::uuid;
  perform private.clair_b2_apply_projection(p_workspace_id,v_parent.id,v_revision_id,v_parent.availability_status,false,p_actor_user_id);
  perform set_config('clinical_master.b2_internal_write','on',true);
  update public.order_set_revision_update_reviews set status='accepted',result_parent_revision_id=v_revision_id,resolved_at=now(),resolved_by_user_id=p_actor_user_id where workspace_id=p_workspace_id and id=p_review_id;
  perform private.clair_b2_resolve_review_notification(p_workspace_id,p_review_id,'accepted',p_actor_user_id);
  select * into v_review from public.order_set_revision_update_reviews where workspace_id=p_workspace_id and id=p_review_id;
  v_envelope := private.clair_b2_make_result_envelope(true,'accepted',p_request_id,null,null,private.clair_b2_order_set_detail_json(p_workspace_id,v_parent.id),private.clair_b2_revision_json(p_workspace_id,v_parent.id,v_revision_id),to_jsonb(v_review),v_revision_id);
  insert into private.order_set_review_resolution_requests(workspace_id,request_id,actor_user_id,review_id,base_parent_revision_id,expected_child_revision_id,payload_sha256,result_parent_revision_id,result_parent_current_revision_id,outcome,result_envelope,created_at,completed_at) values(p_workspace_id,p_request_id,p_actor_user_id,p_review_id,p_expected_parent_revision_id,v_review.available_child_revision_id,v_hash,v_revision_id,v_revision_id,'accepted',v_envelope,now(),now());
  return v_envelope;
end;
$$;
revoke all on function private.clair_b2_resolve_review_core(text,uuid,uuid,text,uuid,uuid) from public, anon, authenticated, service_role;

create or replace function public.clair_resolve_order_set_update_review(
  p_workspace_id text,
  p_review_id uuid,
  p_expected_parent_revision_id uuid,
  p_action text,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if not private.clair_is_active_workspace_member(p_workspace_id) or not private.clair_current_user_has_workspace_permission(p_workspace_id,'service_catalog:manage') then raise exception 'permission_missing' using errcode='42501'; end if;
  return private.clair_b2_resolve_review_core(p_workspace_id,p_review_id,p_expected_parent_revision_id,p_action,auth.uid(),p_request_id);
end;
$$;
revoke all on function public.clair_resolve_order_set_update_review(text,uuid,uuid,text,uuid) from public, anon, service_role;
grant execute on function public.clair_resolve_order_set_update_review(text,uuid,uuid,text,uuid) to authenticated;

-- Native seed adapter.  It is owner-only and accepts a validated synthetic
-- actor explicitly; no auth.uid/service_role shortcut is exposed to the Data
-- API.  The adapter reuses the same creation ledger and immutable core.
create or replace function private.clair_seed_order_set_compatibility_projection(
  p_workspace_id text,
  p_legacy_set_id text,
  p_definition jsonb,
  p_availability_status text,
  p_actor_user_id uuid,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
declare
  v_allowed boolean;
begin
  select exists(
    select 1 from public.users u
    join public.user_memberships m on m.user_id=u.id and m.workspace_id=p_workspace_id and m.status='active'
    where u.id=p_actor_user_id and u.status='active'
      and (m.roles @> array['hospital_admin']::text[] or exists(select 1 from public.permission_policies pp where pp.workspace_id=p_workspace_id and ((pp.scope='role' and pp.target_role=any(m.roles)) or (pp.scope='user' and pp.target_user_id=p_actor_user_id)) and coalesce(pp.permissions->'allowed','[]'::jsonb) ? 'service_catalog:manage'))
  ) into v_allowed;
  if not v_allowed then raise exception 'seed_actor_permission_missing' using errcode='42501'; end if;
  if p_legacy_set_id is null or btrim(p_legacy_set_id)='' or p_request_id is null then raise exception 'seed_identity_required'; end if;
  return private.clair_b2_create_core(p_workspace_id,p_definition,p_availability_status,p_actor_user_id,p_request_id,p_legacy_set_id);
end;
$$;
revoke all on function private.clair_seed_order_set_compatibility_projection(text,text,jsonb,text,uuid,uuid) from public, anon, authenticated, service_role;

commit;
