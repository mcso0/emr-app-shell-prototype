---
id: "CLINICAL-MASTER-PR-005"
status: "completed"
area: "clinical-master"
priority: "P0"
target_pr: "Phase 1 closeout: B2 gate, PR #572/#573/#574 lineage, C2/E and authenticated browser evidence recorded"
updated: "2026-08-21"
---

# Clinical Master Phase 1B-2: Order Set Revisions

## Status and gate

This work item records the approved implementation contract for Phase 1B-2 and
is completed within the scoped Phase 1 closeout. The A1/A2/A3/B1/B2 local
synthetic runtime/security gates PASS. B2's actual two-stage legacy
prepare→migration-twice→verify path and main replay passed, including the
2-item `valid_sum` case. Independent Sol review is `APPROVE` with `MUST-FIX 0`.
The final production and authenticated synthetic evidence is recorded in the
closeout section below.

The predecessor evidence is recorded in the A1/A2/A3/B1 work items:

1. `CLINICAL-MASTER-PR-001` has local PostgreSQL reset/replay, rollback,
   role/privilege, and two-session concurrency evidence.
2. `CLINICAL-MASTER-PR-002` has workspace adoption, nullable-price,
   `catalog_revision`, composite workspace-key, RLS/grant, direct-DML denial,
   CAS/retry, and notification evidence.
3. `CLINICAL-MASTER-PR-003` has catalog-only order lineage,
   `service_item_id IS NULL` for new catalog orders, immutable fulfillment and
   billing snapshots, permission, and retry evidence.
4. `CLINICAL-MASTER-PR-004` has its B1 laboratory runtime/security core gate
   PASS; its optional full 38-case matrix remains unclaimed.

## Intent and approved boundary

Make Order Sets workspace-owned stable identities whose definitions are
immutable revisions. A revision contains atomic workspace catalog members or
an exact child Order Set revision, supports the approved sum/fixed/range price
contracts, and can be reviewed and superseded without silently changing an
existing parent.

Included:

- stable `order_sets` identity and current-revision pointer;
- immutable `order_set_revisions`, revision items, and range rows;
- exact child revision pinning with at most one nested child-set layer;
- trusted cycle, depth, cross-workspace, unavailable-member, and duplicate
  atomic-expansion validation;
- full hospital-admin save as one immutable-revision transaction;
- child-update review, deterministic supersession, and admin resolution;
- compatibility projections on `order_sets` and safe retention of
  `order_set_items`;
- synthetic two-workspace fixture, replay, migration, RLS, grant, CAS, retry,
  notification, and legacy-backfill evidence;
- the B3 chart/search handoff fields required to identify the exact set
  revision, without implementing chart expansion or confirmation.

Explicitly excluded:

- chart expansion, encounter-local set editing, or removal of
  `unsupported_order_type`;
- `orders`, fulfillment, billing, invoice execution, or service-table redesign;
- new `service_*` writes, dual writes, or deletion of legacy set tables;
- private master changes, clinical validation, real data, remote migration,
  deployment, or a new dependency;
- more than one nested child-set level;
- hard deletion of sets, revisions, or historical compatibility rows.

## Current-state evidence and predecessor contracts

### Existing mutable persistence

- `public.order_catalog_items` currently uses text IDs, workspace ownership, and
  non-null/default-zero `price_krw`:
  `supabase/migrations/20260520152000_hospital_admin_order_catalog_persistence.sql:4-39`.
- `public.order_sets` is mutable, with `source_set_version`, names, availability,
  `amount_basis`, and non-null/default-zero `set_price_krw`:
  `supabase/migrations/20260520152000_hospital_admin_order_catalog_persistence.sql:41-60`.
- `public.order_set_items` has only direct `child_order_id`, a single-column
  set FK, quantity/default fields, and non-authoritative
  `unit_price_snapshot_krw`; it has no set revision or nested-child identity:
  `supabase/migrations/20260520152000_hospital_admin_order_catalog_persistence.sql:62-75`.
- Existing set/item RLS grants authenticated SELECT but no set writer; catalog
  still has direct insert/update policies:
  `supabase/migrations/20260528093000_order_catalog_staging_mutation_rls.sql:15-68`.

### Existing read/write surfaces

- Chart search reads active mutable sets directly and returns preset-style
  fields:
  `supabase/migrations/20260527090000_order_catalog_chart_search_rpc.sql:5-88`.
- `OrderSet` and `OrderSetItem` TypeScript types contain mutable set metadata,
  direct child IDs, and numeric prices only:
  `src/features/hospital-admin/server-order-catalog-core.ts:130-162`.
- The gateway has search and individual catalog mutation but no set revision
  writer; the live Supabase set expansion returns 404:
  `src/features/hospital-admin/server-order-catalog-core.ts:291-331,471-503,995-1112`.
- Hospital-admin currently disables the Order Set entry point and fetches only
  individual catalog rows:
  `src/features/hospital-admin/module.tsx:1250-1272,1841-1981`.
- The existing expand route does not load the DB permission adapter and calls
  the 404 gateway path:
  `src/app/api/workspaces/[workspaceId]/hospital-admin/order-sets/[orderSetId]/expand/route.ts:12-38`.

### B3 and downstream boundary

- Chart confirmation still rejects set selections as
  `unsupported_order_type`:
  `src/features/chart/server-order-action-persistence-core.ts:862-972`,
  especially `:889-890`.
- Applied chart snapshots already carry hierarchy, set source, pricing, and
  frozen snapshot fields:
  `supabase/migrations/20260519170000_chart_order_snapshot_bridge.sql:4-129,188-278`.
- Fulfillment and billing currently consume order snapshots through their own
  RPCs and are outside B2:
  `supabase/migrations/20260523094400_order_fulfillment_work_item_contract.sql:147-264`;
  `supabase/migrations/20260520090000_billing_invoice_candidate_sync_rpc.sql:63-208`.

- A2 owns the workspace-adoption lock and catalog CAS signatures:
  `docs/work/clinical-master/CLINICAL-MASTER-PR-002-phase-1a-2-workspace-adoption.md:225-292`
  and `docs/work/clinical-master/CLINICAL-MASTER-PR-002-phase-1a-2-workspace-adoption.md:312-345`;
  B1 extends the exact adoption/lab writers and deterministic row order at
  `docs/work/clinical-master/CLINICAL-MASTER-PR-004-phase-1b-1-laboratory-slice.md:1757-1777`,
  `docs/work/clinical-master/CLINICAL-MASTER-PR-004-phase-1b-1-laboratory-slice.md:1908-1932`,
  `docs/work/clinical-master/CLINICAL-MASTER-PR-004-phase-1b-1-laboratory-slice.md:2022-2045`,
  and `docs/work/clinical-master/CLINICAL-MASTER-PR-004-phase-1b-1-laboratory-slice.md:2225-2233`.
- The existing workspace SELECT security contract is active membership plus
  `private.clair_current_user_has_workspace_permission(workspace_id,'service_catalog:view')`,
  with management enforced through `'service_catalog:manage'`:
  `docs/work/clinical-master/CLINICAL-MASTER-PR-004-phase-1b-1-laboratory-slice.md:2301-2353`;
  the current broad set policies/grants are in
  `supabase/migrations/20260528093000_order_catalog_staging_mutation_rls.sql:29-68`.
- Notification persistence has `requires_action`, `badge_count`, source route/
  payload, and dedupe scope but its normal upsert deletes user read/archive
  state on bump: `supabase/migrations/20260705133000_notification_event_persistence.sql:4-70,559-563`.
- The current chart search type and mapper are owned by
  `src/features/hospital-admin/server-order-catalog-core.ts:236-331,1601-1635`,
  and its SQL source is
  `supabase/migrations/20260527090000_order_catalog_chart_search_rpc.sql:5-88`.

### Approved target and product rules

- The target allows only parent → child set → atomic orders, rejects cycles and
  duplicate atomic results, and requires exact child revision pins:
  `docs/engineering/data-model/clair-clinical-master-data-target-architecture.md`
  (lines 98-107, 351-367).
- The physical B2 target table names, fields, checks, revision save rules, and
  review states are specified at:
  `docs/engineering/data-model/clair-clinical-master-data-phase-1-db-spec.md:558-700`.
- `NULL` means unset, `0` means intentionally free, and current workspace price
  changes affect future orders while applied snapshots remain frozen:
  `docs/engineering/data-model/clair-clinical-master-data-phase-1-db-spec.md:88-115`;
  `docs/product/domain/workspace-order-catalog-platform.md:120-128`.
- Set list/drawer fields, exact child revision behavior, and one-level nesting
  are in `docs/product/demo-data/order-sets-and-templates-v1.md`
  (lines 39-47, 68-92, 114-123).

## Physical data model and one-writer ownership

Phase 1 uses `text` plus `check` constraints, not new PostgreSQL enum types.
All timestamps are `timestamptz`, money is integer KRW, and new revision rows
use UUID IDs.

### `public.order_sets`

Keep the existing stable `id text primary key` and add/retain:

- `workspace_id text not null` retaining the existing
  `order_sets_workspace_id_fkey` to `public.workspaces(id) on delete cascade`;
- `current_revision_id uuid null`;
- `availability_status text not null check (availability_status in
  ('active','paused','inactive'))`;
- `needs_composition_review boolean not null default false`;
- `created_by_user_id uuid null references public.users(id) on delete set null`;
- `updated_by_user_id uuid null references public.users(id) on delete set null`;
- existing timestamps.

The compatibility projection remains on this table, but its authority is the
current revision. The migration must first make the existing mutable price
column able to represent the approved NULL/zero distinction, then add the
projection fields and exact checks:

```sql
alter table public.order_sets
  drop constraint if exists order_sets_set_price_krw_check;

alter table public.order_sets
  alter column set_price_krw drop default,
  alter column set_price_krw drop not null;

alter table public.order_sets
  add column if not exists current_revision_id uuid null,
  add column if not exists needs_composition_review boolean not null default false,
  add column if not exists created_by_user_id uuid null,
  add column if not exists updated_by_user_id uuid null,
  add column if not exists range_basis text null,
  add column if not exists range_price_ranges jsonb not null default '[]'::jsonb,
  add column if not exists tax_type text not null default 'derived',
  add constraint order_sets_workspace_id_id_key unique (workspace_id, id),
  add constraint order_sets_set_price_krw_check
    check (set_price_krw is null or set_price_krw >= 0),
  add constraint order_sets_range_basis_check
    check (range_basis is null or range_basis in ('patient_weight_kg','manual_value')),
  add constraint order_sets_range_price_ranges_array_check
    check (jsonb_typeof(range_price_ranges) = 'array'),
  add constraint order_sets_tax_type_check
    check (tax_type in ('taxable','non_taxable','derived'));

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'order_sets_created_by_user_fk') then
    alter table public.order_sets
      add constraint order_sets_created_by_user_fk
      foreign key (created_by_user_id) references public.users(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'order_sets_updated_by_user_fk') then
    alter table public.order_sets
      add constraint order_sets_updated_by_user_fk
      foreign key (updated_by_user_id) references public.users(id) on delete set null;
  end if;
end $$;
```

`order_sets_set_price_krw_check` is the existing physical check, so the
forward migration drops that old definition before recreating the same named
check with NULL/zero semantics; it does not add a duplicate check. The actor
columns are nullable audit fields, and deleting a user sets them NULL rather
than deleting or rewriting a set.
On replay, each named constraint is looked up in `pg_constraint`: an absent
constraint is installed with the definition above, while an existing one must
match the definition and is retained; a same-name/different-definition result
stops with `constraint_definition_mismatch`.

The same forward migration adds `UNIQUE (workspace_id,id)` to the revision
table before installing the same-set composite foreign key, deferred until the
transaction ends:

```sql
alter table public.order_sets
  add constraint order_sets_current_revision_same_set_fk
  foreign key (workspace_id, id, current_revision_id)
  references public.order_set_revisions (workspace_id, order_set_id, id)
  on delete restrict
  deferrable initially deferred;
```

The referenced revision key is unique both `(workspace_id,id)` and
`(workspace_id,order_set_id,id)`; the latter is required for the triple FK and
the former is required by the explicit stable identity contract. All revision,
item, range, and review foreign keys use `ON DELETE RESTRICT`; no history can be
cascaded or orphaned. Existing `source_set_version`, names, category, billing
name, `amount_basis`, sales unit, species, guide/instruction, price,
`billing_reflection_enabled`, and the new range/tax fields are compatibility
projections only. `range_price_ranges` is `[]` for non-range projections and an
ordered JSON array for a range projection; each element is exactly
`{"id":uuid,"sortOrder":positive integer,"lowerBound":nonnegative number,"upperBound":number|null,"priceKrw":nonnegative integer}`.
It is never an authority for B3 pricing.

For valid/current rows, the one valid-revision pointer primitive
`private.clair_b2_apply_projection` is the only writer
for `current_revision_id`, `availability_status`,
`needs_composition_review`, `updated_by_user_id`, and every compatibility
projection after adoption. Creation sets both audit columns from the derived
actor; only this primitive changes `updated_by_user_id` thereafter.
Its exact state contract is:

- a valid revision saved with requested active sets the pointer to that revision,
  projects every field exactly, and sets the flag false only when all exact
  pinned members are currently usable. An unavailable or invalid pinned member
  makes the candidate invalid and cannot replace the pointer; if a later A2/B1
  mutation makes an exact pinned member of an already-current active set
  unusable, the existing active status/pointer remains historical truth while
  the flag becomes true and B3 is blocked;
- a valid revision saved with requested paused or inactive still becomes the
  current revision and is fully projected, with the requested status. The flag
  is true only for an exact pinned member blocker, not merely because the
  administrator chose paused or inactive;
- an invalid edit to an existing stable set is immutable history only: it never
  becomes current and never overwrites a valid pointer/projection. It may be
  recorded only after the administrator explicitly confirms use-off/inactive;
  otherwise the RPC rejects before inserting the invalid revision. A new
  non-empty set with an invalid or unavailable definition is always rejected
  atomically and creates no stable row, revision, item, range, or notification.
  An explicit inactive edit to an existing set records an invalid history row,
  changes only availability_status to inactive, and retains the previous valid
  current_revision_id and all revision-derived projection fields. A valid
  revision saved with active, paused, or inactive is always the only revision
  eligible for the pointer; the requested status is applied by the same
  pointer/projection primitive. An active save requires a non-empty, fully
  usable expansion. A zero-item revision is valid only with paused or inactive
  and is never selectable as active;
- a metadata-preserving empty definition may be submitted through any trusted
  create or save path, including the owner-only synthetic seed adapter and
  legacy backfill. It creates a stable row plus a zero-item revision with
  validation_status='valid', the submitted metadata, and the requested
  availability only when that status is paused or inactive. A new empty active
  request is a committed invalid_order_set_definition rejection. The zero-item
  revision becomes current through the single pointer/projection primitive, so
  it receives the ordinary UUID ETag and its metadata survives read/create/
  update. A trusted save may later make another zero-item revision only for a
  paused or inactive stable row and uses ordinary UUID ETag/CAS; no provenance
  marker is required. There is no ordinary NULL-current empty sentinel. Only a
  deterministic migration quarantine row may have current_revision_id IS NULL,
  and its projection is the fixed quarantine sentinel documented in the legacy
  section; a trusted backfill must use a metadata-preserving zero-item revision
  instead when the legacy row is physically valid but empty.
- a member invalidation changes only `needs_composition_review` through this
  primitive and leaves the current pointer and its historical projection
  unchanged. A newer valid/active/usable child revision changes neither the
  parent pointer nor this flag: it creates or supersedes a review and
  notification only, and the parent remains selectable. A child or atomic
  member that is paused, inactive, invalid, or otherwise unusable sets this
  flag on every current parent that exact-pins it and supersedes/resolves the
  related pending review notification. A validated new current revision or
  accepted review is the only operation that can clear the flag; dismissal
  never clears a real blocker.

A deferred constraint trigger calls
`private.clair_assert_order_set_current_projection(workspace_id, id)` and
requires an `active` row to have a non-null owned current revision with
`validation_status = 'valid'`; paused/inactive rows may retain a valid current
revision but may not point at an invalid revision. A zero-item valid revision
is permitted as the current revision of any paused/inactive stable row; this
status/validation invariant does not depend on unprovable provenance. Every
non-quarantine paused/inactive row has a non-null owned valid pointer, while only
a deterministic migration-quarantine row may have a NULL pointer.
The trigger recognizes that exception only when exactly one matching private
`order_set_legacy_quarantine` source row exists for the stable `(workspace_id,id)`
and its classification/action has already installed the documented inactive
projection; an ordinary API row can never satisfy the exception. It compares
every compatibility column, including deterministic
`source_set_version = 'order-set-revision-' || revision_no`, range JSON, and
tax, with the current revision. A separate private pointer primitive is not
allowed to write availability or projections.

Thus `current_revision_id IS NULL` is valid only for a deterministic legacy
quarantine sentinel. A failed non-empty create (and a new empty `active`
create) returns `invalid_order_set_definition` and leaves no public stable
identity. An invalid existing-set edit,
when explicitly used-off, remains immutable history while the prior current
pointer/projection continues to describe the set. Every availability change is
therefore either a new immutable revision plus an atomic pointer/projection
update, or the explicit existing-set use-off transition that retains the last
valid pointer and records the invalid history row; that transition calls the
same pointer primitive with `p_revision_id = current_revision_id` and
`p_availability_status = 'inactive'`. No revision-derived metadata is lost: a
metadata-preserving zero-item revision is the only trusted representation of an
empty paused/inactive set. Every trusted create/save, seed-adapter, and
physically valid legacy-backfill path installs that zero-item revision before
returning. Only the private migration-quarantine sentinel retains the NULL
exception.

### `public.order_set_revisions`

Create immutable rows with:

- `id uuid primary key`;
- `workspace_id text not null`, `order_set_id text not null`;
- `revision_no integer not null check (revision_no > 0)`;
- `validation_status text not null check (validation_status in ('valid','invalid'))`;
- `validation_errors jsonb not null default '[]'::jsonb` with
  `check (jsonb_typeof(validation_errors) = 'array')`; every element is exactly
  a server-generated object with nonblank `code`, `field`, and `message` string
  keys plus optional object/array `details`; no scalar/object root, unknown
  server error key, or client-authored error text is accepted;
- `set_category text null`, `set_name text not null check (length(btrim(set_name)) > 0)`,
  `billing_name text not null check (length(btrim(billing_name)) > 0)`;
- `amount_basis text not null check (amount_basis in
  ('included_order_sum','set_fixed_price','range_price'))`;
- `set_price_krw integer null`;
- `range_basis text null check (range_basis is null or range_basis in
  ('patient_weight_kg','manual_value'))`;
- `sales_unit text not null check (sales_unit in
  ('per_order','per_each','per_day','per_frequency','per_ml','per_kg'))`;
- `billing_reflection_enabled boolean not null`;
- `tax_type text not null check (tax_type in
  ('taxable','non_taxable','derived'))`;
- `target_species text[] not null check (cardinality(target_species) > 0 and
  target_species <@ array['dog','cat','other']::text[])`, `care_guide text null`,
  `internal_instruction text null`;
- `created_by_user_id uuid null references public.users(id) on delete set null`,
  `created_at timestamptz not null default now()`.

Add unique `(workspace_id,order_set_id,revision_no)`, unique
`(workspace_id,id)`, and unique `(workspace_id,order_set_id,id)` for the
stable-set/revision triple FK. Add the explicit owner FK
`(workspace_id,order_set_id) references public.order_sets(workspace_id,id)
on delete restrict deferrable initially deferred`, then index
`(workspace_id,order_set_id,revision_no desc)`.
Use exact constraint/index names
`order_set_revisions_workspace_order_set_revision_no_key`,
`order_set_revisions_workspace_id_key`,
`order_set_revisions_workspace_order_set_id_key`,
`order_set_revisions_order_set_revision_no_idx`, and
`order_set_revisions_owner_same_workspace_fk` for these four uniqueness/index
objects and the owner FK respectively.
`revision_no` and all
revision-item/range `sort_order` values are positive (`> 0`); legacy zero-based
sort values are deterministically re-numbered while preserving their order.
Under the workspace lock, a save allocates `revision_no = coalesce(max(revision_no),0) + 1`
for that stable set; numbers are never reused.

Pricing checks are exact:

- `set_fixed_price`: `set_price_krw is not null`, `set_price_krw >= 0`, no
  range rows;
- `included_order_sum`: `set_price_krw is null`, no range rows, and
  `billing_reflection_enabled = false`, `tax_type = 'derived'`;
- `range_price`: `set_price_krw is null`, `range_basis is not null`, and at
  least one valid range row;
- `set_fixed_price` and `range_price` require `billing_reflection_enabled = true`
  so the parent bills once; their child-item defaults remain false;
- all other modes reject a non-null `range_basis`;
- valid rows have an empty validation-error array;
- invalid rows cannot become the active current revision;
- all mode-dependent range cardinality and compatibility projection checks are
  repeated by the deferred `private.clair_assert_order_set_revision_integrity`
  constraint trigger for the current revision.

Install the row-level check as
`order_set_revisions_pricing_mode_ck`:

```sql
check (
  validation_status = 'invalid'
  or (amount_basis = 'set_fixed_price'
    and set_price_krw is not null and set_price_krw >= 0
    and range_basis is null and billing_reflection_enabled = true
    and tax_type in ('taxable','non_taxable'))
  or (amount_basis = 'included_order_sum'
    and set_price_krw is null and range_basis is null
    and billing_reflection_enabled = false and tax_type = 'derived')
  or (amount_basis = 'range_price'
    and set_price_krw is null and range_basis in ('patient_weight_kg','manual_value')
    and billing_reflection_enabled = true
    and tax_type in ('taxable','non_taxable'))
)
```

The trigger, not this row check, enforces zero range rows for fixed/sum and at
least one structurally valid range row for range mode; the approved Option A
validator additionally enforces continuous `[0,+infinity)` coverage for both
bases.
Add named check `order_set_revisions_valid_errors_empty_ck`:
`check (validation_status = 'invalid' or validation_errors = '[]'::jsonb)`.

The exact private writer is
`private.clair_b2_apply_projection(
p_workspace_id text,p_order_set_id text,p_revision_id uuid,
p_availability_status text,p_needs_composition_review boolean,p_actor_user_id uuid)`.
Only the save RPC, accepted-review RPC, and the catalog invalidation helper may
call it. It locks the stable row and the referenced revision, verifies the
same-workspace triple, and writes `current_revision_id`, availability,
`needs_composition_review`, and every old compatibility projection in one
statement. The caller must first perform non-locking discovery and acquire
catalog IDs; this primitive acquires stable sets, revision IDs, items/ranges,
and reviews only in the shared order (reviews last), so it cannot be invoked
outside that common lock order. No independent availability or projection
writer exists. The separate private
`private.clair_b2_apply_quarantine_projection(text,text,uuid)` is migration-only
and is the sole writer for the deterministic NULL-current quarantine sentinel;
it is not callable by API, seed, or runtime availability paths.

Install these exact deferred checks after legacy backfill and before enabling
new public RPCs:

- `order_sets_current_projection_deferred`, a `CONSTRAINT TRIGGER DEFERRABLE
  INITIALLY DEFERRED` on `public.order_sets` after INSERT/UPDATE of pointer,
  availability, flag, or projection columns, calls
  `private.clair_assert_order_set_current_projection_trigger()`;
- `order_set_revision_integrity_deferred`, a `CONSTRAINT TRIGGER DEFERRABLE
  INITIALLY DEFERRED` on revisions, revision items, and price ranges after
  INSERT, calls `private.clair_assert_order_set_revision_integrity_trigger()`.

The trigger functions delegate to
private.clair_assert_order_set_current_projection(workspace_id text,order_set_id text)
and private.clair_assert_order_set_revision_integrity(workspace_id text,order_set_id text,revision_id uuid).
The first requires every non-quarantine stable row to have a non-null current
revision owned by the same (workspace_id,id) triple, validation_status='valid',
and matching compatibility values for source version, names/category, amount
basis, set price/range summary, sales unit, billing flag, tax/species, care, and
instruction. An active stable row additionally requires a non-empty revision
with at least one selected, usable flattened atomic member. A valid zero-item
revision is permitted as the current revision of any paused or inactive stable
row; the trusted create/save, seed-adapter, or legacy-backfill origin is not
part of the invariant. A current valid revision may reference an exact member
that later became unusable only when the stable row has
needs_composition_review = true and the invalidation helper proved and
atomically set that exact blocker; the pointer and historical projection remain
the current truth while chart application is blocked. The second enforces
JSON-array errors, exact item-union FKs, positive revision/sort values, current
catalog/child validity for a newly saved/accepted revision, and these
mode-dependent range cardinalities before a revision can be current. A deferred
check may observe an intermediate pointer during a save, but commit fails
unless every non-quarantine active stable row has a usable current revision with
the flag false or this exact recorded composition-review exception;
paused/inactive rows may be valid zero-item metadata revisions.

No normal application role receives UPDATE or DELETE on this table. A
defense-in-depth immutable trigger rejects those operations; inserts occur only
inside the trusted save/backfill paths.

### Durable request ledgers

Request identity is workspace-scoped and is stored before CAS decisions can be
replayed. The migration creates private, ungranted ledgers:

`private.order_set_revision_save_requests`:

- `workspace_id text not null`, `request_id uuid not null`,
  `actor_user_id uuid not null`, `order_set_id text not null`;
- `base_current_revision_id uuid not null` (a save never targets a NULL
  current revision because collection creation installs metadata revision 1);
- `payload_sha256 text not null check (payload_sha256 ~ '^[0-9a-f]{64}$')`;
- `result_revision_id uuid null`, `result_current_revision_id uuid null`;
- `outcome text not null check (outcome in ('applied','rejected','conflict'))`;
- `result_envelope jsonb not null check (jsonb_typeof(result_envelope) =
  'object')`;
- named check `order_set_revision_save_requests_result_envelope_outcome_ck`:
  ```sql
  check (
    (outcome = 'applied'
      and result_envelope->>'ok' = 'true'
      and result_envelope->>'outcome' = 'applied')
    or (outcome in ('rejected','conflict')
      and result_envelope->>'ok' = 'false'
      and result_envelope->>'outcome' = outcome)
  )
  ```
- `created_at timestamptz not null`, `completed_at timestamptz not null`;
- primary key `(workspace_id,request_id)`.

`private.order_set_review_resolution_requests` uses the same request identity
hash fields plus `review_id uuid not null`, `base_parent_revision_id uuid not null`,
`expected_child_revision_id uuid not null`, `action text not null check (action in ('accept','dismiss'))`,
`result_parent_revision_id uuid null`, `result_parent_current_revision_id uuid null`,
`outcome text not null check (outcome in
('accepted','dismissed','superseded','conflict','obsolete'))`, and timestamps.
It also stores `result_envelope jsonb not null check
(jsonb_typeof(result_envelope) = 'object')`.
Named check `order_set_review_resolution_requests_result_envelope_outcome_ck`
is exactly:

```sql
check (
  (outcome in ('accepted','dismissed')
    and result_envelope->>'ok' = 'true'
    and result_envelope->>'outcome' = outcome)
  or (outcome in ('superseded','conflict','obsolete')
    and result_envelope->>'ok' = 'false'
    and result_envelope->>'outcome' = outcome)
)
```
Both ledgers are append-only, receive no Data API grant or RLS policy, and are
writable only by their fixed-search-path B2 RPCs. No request ID or hash is
stored on an immutable revision or review row.

Collection creation uses a third private, ungranted
`private.order_set_creation_requests` ledger because its stable ID is derived
from the request before the first revision: `(workspace_id text, request_id
uuid, actor_user_id uuid not null, order_set_id text not null,
payload_sha256 text not null, outcome text not null check (outcome in
('created','rejected')), result_envelope jsonb not null check
(jsonb_typeof(result_envelope) = 'object'),
created_at timestamptz not null, completed_at timestamptz not null, primary key
(workspace_id,request_id))`. Creation has no base/current-pointer comparison.
Named check `order_set_creation_requests_result_envelope_outcome_ck` is exactly:

```sql
check (
  (outcome = 'created' and result_envelope->>'ok' = 'true'
    and result_envelope->>'outcome' = 'created')
  or (outcome = 'rejected' and result_envelope->>'ok' = 'false'
    and result_envelope->>'outcome' = 'rejected')
)
```
Its exact canonical object is:

```json
{
  "op":"order_set_create",
  "workspaceId":"<text>",
  "definition":{"<the complete allow-listed definition>":"..."},
  "availabilityStatus":"active|paused|inactive"
}
```

The server derives `order_set_id` from `(workspace_id,request_id)` with the
deterministic UUID helper below; a domain-rejected create stores that derived
ID in its ledger but creates no stable row. An exact replay returns the stored
create envelope. If an existing `(workspace_id,request_id)` row has a
different actor or canonical hash, the RPC returns the deterministic
`idempotency_conflict` response without modifying, replacing, or appending to
the original ledger row. It does not pretend that a second conflicting row was
committed. The same request UUID in another workspace is a separate identity.

The request tuple is all-or-none for each operation: the caller provides
exactly one UUID `p_request_id`; the RPC derives one non-null `actor_user_id`
from `auth.uid()` and computes one non-null `payload_sha256`. Save additionally
requires a non-null submitted expected current revision; review additionally
requires its expected parent and the child expectations read from the stored
review. Creation has no base field at all. Clients never supply or persist a
hash. A missing/partial request tuple or a missing save/review base is rejected
before mutation; a new request receives a committed ledger rejection only when
actor/permission checks have already succeeded.

The DB, not the client, computes every hash. A private normalizer rejects
unknown JSON keys, wrong JSON types, duplicate sort values, and non-canonical
null branches. Before any constrained cast it parses each JSON number as
PostgreSQL numeric, rejects NaN/infinite values, rejects a scale greater than
three with `pg_catalog.scale(value::numeric)`, and rejects values outside their
target SQL domain. Integer normalization applies only to `revision_no`,
`sort_order`, `child_order_catalog_revision`, `set_price_krw`, and `price_krw`:
each must have scale zero and its exact positive/nonnegative integer domain.
`defaultQuantity` is not an integer: it must be a positive `numeric(12,3)`
with scale at most three, then is canonicalized with
`pg_catalog.trim_scale(value::numeric(12,3))`. Lower/upper bounds use the same
finite `numeric(12,3)` domain in `0..999999999.999`. Thus 1, 1.0, and 1.00
have one semantic JSONB number and one hash, while only nested child items and
`fixed_one` items require exactly 1; atomic `preset_quantity` and
`manual_at_apply` may retain any positive canonical quantity. PostgreSQL JSONB
object-key ordering and the validated semantic item/range array order are used;
JSONB has already erased lexical exponent/trailing-zero spelling, so those
spellings are not rejected.
The stored lowercase hash is exactly
encode(extensions.digest(pg_catalog.convert_to(canonical_jsonb::text,'UTF8'),'sha256'),'hex').
The save normalization is exactly this object: availability appears once, the
submitted base is the only base value, and the mutable database pointer is
never read into the hash:

```json
{
  "op":"order_set_revision_save",
  "workspaceId":"<text>",
  "orderSetId":"<text>",
  "expectedCurrentRevisionId":"<uuid>",
  "definition": {"<the complete allow-listed definition>": "..."},
  "availabilityStatus":"active|paused|inactive"
}
```

The server constructs the definition with these exact
`jsonb_build_object` keys: `setCategory`, `setName`, `billingName`,
`amountBasis`, `setPriceKrw`, `rangeBasis`, `salesUnit`,
`billingReflectionEnabled`, `taxType`, `targetSpecies`, `careGuide`,
`internalInstruction`, `items`, and `priceRanges`. Each item object is built
with exactly `childKind`, `childOrderCatalogItemId`,
`childOrderCatalogRevision`, `childOrderSetId`, `childSetRevisionId`,
`sortOrder`, `defaultSelected`, `billingReflectionDefault`, `defaultQuantity`,
and `quantitySource`. The client `OrderSetDefinition` does **not** send a
physical range `id`; range IDs are derived only after the resulting revision
UUID exists. The review normalization is a separate exact object:

The implementation uses the following actual constructor shape (with the
shown key names, not client aliases), then orders arrays before constructing
the parent object:

```sql
v_item := jsonb_build_object(
  'childKind', v_child_kind,
  'childOrderCatalogItemId', v_catalog_item_id,
  'childOrderCatalogRevision', v_catalog_revision,
  'childOrderSetId', v_child_set_id,
  'childSetRevisionId', v_child_revision_id,
  'sortOrder', v_sort_order,
  'defaultSelected', v_default_selected,
  'billingReflectionDefault', v_billing_reflection_default,
  'defaultQuantity', pg_catalog.trim_scale(v_default_quantity::numeric(12,3)),
  'quantitySource', v_quantity_source
);
v_range := jsonb_build_object(
  'sortOrder', v_sort_order,
  'lowerBound', pg_catalog.trim_scale(v_lower_bound::numeric(12,3)),
  'upperBound', case when v_upper_bound is null then null
    else pg_catalog.trim_scale(v_upper_bound::numeric(12,3)) end,
  'priceKrw', v_price_krw
);
v_definition := jsonb_build_object(
  'setCategory', v_set_category, 'setName', v_set_name,
  'billingName', v_billing_name, 'amountBasis', v_amount_basis,
  'setPriceKrw', v_set_price_krw, 'rangeBasis', v_range_basis,
  'salesUnit', v_sales_unit,
  'billingReflectionEnabled', v_billing_reflection_enabled,
  'taxType', v_tax_type, 'targetSpecies', v_target_species,
  'careGuide', v_care_guide, 'internalInstruction', v_internal_instruction,
  'items', v_items_jsonb, 'priceRanges', v_price_ranges_jsonb
);
```

`v_items_jsonb` is the `jsonb_agg` of item objects ordered by the source
columns `(sort_order, child_kind, typed_child_id, typed_child_revision)` and
`v_price_ranges_jsonb` is the `jsonb_agg` of range objects ordered by
`(sort_order, lower_bound)`, with an empty array instead of NULL for non-range
modes. PostgreSQL JSONB canonicalizes object keys semantically; the explicit
aggregate order is the array order hashed.

```json
{
  "op":"order_set_review_resolution",
  "workspaceId":"<text>",
  "reviewId":"<uuid>",
  "action":"accept|dismiss",
  "expectedParentRevisionId":"<uuid>",
  "storedPinnedChildRevisionId":"<uuid>",
  "storedAvailableChildRevisionId":"<uuid>",
  "actorUserId":"<auth.uid() uuid>"
}
```

`storedPinnedChildRevisionId` and `storedAvailableChildRevisionId` are read from
the review row, never supplied by the client; `actorUserId` is derived from
`auth.uid()` and included so a different actor cannot replay an outcome. The
review ledger stores `result_parent_revision_id` and
`result_parent_current_revision_id` (the resulting pointer, or NULL for a
non-accept terminal outcome) alongside its immutable status.
Both normalizers reject omitted/null branch keys where the mode requires a
value, reject unknown keys, and reject client-supplied hashes. The save ledger
stores actor, submitted base, computed hash, result revision/pointer, and
immutable `applied|rejected|conflict` ledger outcome. The review ledger stores
actor, submitted parent base, stored child expectation, computed hash, result
parent revision/pointer, and immutable
`accepted|dismissed|superseded|conflict|obsolete` ledger outcome plus the exact
response envelope. Ledger outcomes map to the common envelope as follows:
`created|applied|accepted|dismissed` are the only `ok=true` outcomes, and
`rejected|conflict|obsolete|superseded` are the only `ok=false` outcomes.

`priceRanges` is always present exactly once in the canonical save definition.
For `included_order_sum` and `set_fixed_price` it is exactly `[]`; for
`range_price` it is a non-empty array sorted by ascending normalized
`sortOrder`, then normalized lower bound. Each client element has exactly these
keys, in this canonical `jsonb_build_object` call: `sortOrder`, `lowerBound`,
`upperBound`, `priceKrw`. `sortOrder` is a positive integer, `lowerBound` is a
nonnegative `numeric` JSON number, `upperBound` is either a nonnegative
`numeric` JSON number or JSON `null` only for the single open-ended final row,
and `priceKrw` is a nonnegative integer (zero is valid). No client physical ID,
extra key, or other null is accepted. The canonicalizer emits object keys in
PostgreSQL JSONB canonical key order and arrays in the validated order; it does
not inspect or reject original lexical exponent/trailing-zero spellings.
After the revision UUID is allocated, each physical range row gets the
server-derived deterministic UUID
clair_deterministic_uuid('range',
ARRAY[workspace_id::text,order_set_id::text,revision_id::text,
normalized_ordinal::text,lower_bound::text,upper_bound::text,
price_krw::text]::text[]). The ordinal is the one-based position in that
normalized array. Each physical revision-item ID is similarly server-derived
from the resulting revision UUID, normalized sort, and the complete typed
child-pin fields with the item domain; neither item IDs nor range IDs are
accepted from OrderSetDefinition.

Each new create, save, and review request returns and persists the same exact
JSON result envelope before commit. An exact replay returns that already stored
envelope; a reused request key with an actor/hash/base mismatch returns the
response-only idempotency_conflict envelope and does not write a second ledger
row. Success has ok=true, error=null, and a non-null result; a new-request
domain outcome has ok=false, an exact error object, and result=null.

The success JSON envelope is (these are the only success outcomes):

    {
      "ok": true,
      "outcome": "created|applied|accepted|dismissed",
      "requestId": "<uuid>",
      "error": null,
      "result": {
        "orderSet": {"<stable projection>" : "..."},
        "revision": {"<immutable revision>" : "..."},
        "review": null,
        "current": {"revisionId":"<uuid>","etag":"<quoted-etag>"}
      }
    }

The failure JSON envelope is:

    {"ok":false,"outcome":"rejected|conflict|obsolete|superseded",
     "requestId":"<uuid>",
     "error":{"code":"<allow-listed-domain-code>","field":"<field-or-null>","message":"<server-message>"},
     "result":null}


There are no alternate top-level `orderSet`, `revision`, `review`, or `current`
keys; irrelevant result members are JSON `null` inside a successful `result`.
Create success is HTTP `201`/`ok=true,outcome=created`; applied save,
accepted review, and dismissed review are HTTP `200` with their corresponding
successful outcome. Domain validation rejection, including
invalid_order_set_definition, is HTTP 422 with
ok=false,outcome=rejected, its allow-listed error, and a committed ledger row
for that new request. The nested-review terminal
`order_set_member_unavailable` branch is the exception: it is HTTP 422 with
`ok=false,outcome='superseded'`, `result_parent_revision_id = NULL`, review
status `superseded`, and a resolved notification. A stale base or obsolete
review target is HTTP 409 with ok=false,outcome=conflict|obsolete and a
committed ledger row for that new request. The nested stale-but-usable branch
is HTTP 409 with `ok=false,outcome='superseded'`,
`error.code='child_revision_requires_refresh'`, no parent result revision,
review status `superseded`, and a resolved notification. A payload/actor
mismatch for an already-used request ID is HTTP 409
with the same failure shape but does not modify the original ledger or create a
second row; it is never replayed as success for a distinct request.
Authentication, membership, permission, malformed transport, and unexpected
internal failures alone may raise/rollback and create no domain-outcome ledger
row. New-request domain rejection/conflict paths never raise or roll back after
their ledger row is written; the reused-key idempotency_conflict response is not
such a ledger outcome. Replay lookup occurs before any current-pointer/status row
lock and returns the stored envelope byte-for-byte.

Every RPC first derives the actor and enforces active membership plus
`service_catalog:manage`; only then does it acquire the shared workspace
advisory lock. Under that lock it looks up `(workspace_id,request_id)` before
any current-pointer/status CAS. An existing row with the same actor, computed
hash, workspace-scoped base, and (for review) locked child expectations returns
its immutable stored outcome even if the pointer has moved. An existing row
with any mismatch returns the deterministic `idempotency_conflict` failure
without touching that original row. Only a new request ID can receive a
committed domain `rejected` or `conflict` ledger outcome. A new request then
performs CAS, mutation, and complete ledger insert atomically. The same UUID in
another workspace is a separate request and is never a global conflict.

### `public.order_set_revision_items`

Create:

- `id uuid primary key`;
- `workspace_id text not null`;
- `order_set_revision_id uuid not null`;
- `child_kind text not null check (child_kind in ('order','set_revision'))`;
- `child_order_catalog_item_id text null`;
- `child_order_catalog_revision integer null check
  (child_order_catalog_revision is null or child_order_catalog_revision > 0)`;
- `child_order_set_id text null`;
- `child_set_revision_id uuid null`;
- `sort_order integer not null check (sort_order > 0)`;
- `default_selected boolean not null`;
- `billing_reflection_default boolean not null`;
- `default_quantity numeric(12,3) not null check (default_quantity > 0)`;
- `quantity_source text not null check (quantity_source in
  ('fixed_one','preset_quantity','manual_at_apply'))`;
- `created_at timestamptz not null default now()`.

Checks/FKs/indexes:

- `child_kind = 'order'` requires exactly the atomic ID and catalog revision,
-  with no child set ID or child revision ID;
- `child_kind = 'set_revision'` requires exactly both
  `child_order_set_id` and `child_set_revision_id`, with no atomic ID/revision;
- the owning revision uses `(workspace_id,order_set_revision_id)` →
  `order_set_revisions(workspace_id,id) on delete restrict`; atomic members use
  the A2 composite `(workspace_id,child_order_catalog_item_id)` →
  `order_catalog_items(workspace_id,id) on delete restrict`;
- child-set members use this exact triple FK with `on delete restrict`:
  `(workspace_id,child_order_set_id,child_set_revision_id)` →
  `order_set_revisions(workspace_id,order_set_id,id) on delete restrict`;
- unique `(workspace_id,order_set_revision_id,sort_order)`;
- partial unique direct atomic child on
  `(workspace_id,order_set_revision_id,child_order_catalog_item_id)`;
- `quantity_source = 'fixed_one'` requires `default_quantity = 1`; a nested
  child-set item always uses `fixed_one` and `1`;
- `billing_reflection_default` is false for child sets and for fixed/range
  parents; only an explicit atomic extra may be true;
- revision/item rows have no UPDATE/DELETE grants and immutable triggers.

Name these objects exactly
`order_set_revision_items_workspace_revision_sort_key`,
`order_set_revision_items_direct_atomic_key`,
`order_set_revision_items_owner_revision_fk`,
`order_set_revision_items_atomic_catalog_fk`, and
`order_set_revision_items_child_revision_fk`; every FK is `ON DELETE RESTRICT`
and the two revision FKs are `DEFERRABLE INITIALLY DEFERRED`.

The atomic pair `(child_order_catalog_item_id,child_order_catalog_revision)` is
composition lineage, not a historical price snapshot. A2 currently exposes a
mutable workspace row with a monotonic `catalog_revision`, not an immutable
catalog-version table. B2 therefore does not invent a historical FK or claim
that old catalog content can be reconstructed. At B2 save/activation, the
validator requires the pinned integer to equal the member row's current
`catalog_revision`; later catalog mutation leaves the old pair untouched. Only
an A2/B1 mutation that makes this exact pinned member unusable—unavailable or
invalid, including an active billable member changing to NULL price—marks its
containing current set for composition review. Name, price, or current-version
updates that leave the exact pinned member usable are future-only and do not set
the flag. At B3 application, the server checks the member ID/current
availability and resolves the current active workspace price; the applied order
freezes both the applied catalog revision and effective price. If a future
requirement demands historical atomic content at the old revision, stop and add
an approved A2 catalog-version design before B2; do not reuse
`unit_price_snapshot_krw`.

### `public.order_set_revision_price_ranges`

Create:

- `id uuid primary key`;
- `workspace_id text not null`;
- `order_set_revision_id uuid not null`;
- `sort_order integer not null check (sort_order > 0)`;
- `lower_bound numeric(12,3) not null check (lower_bound >= 0)` (inclusive);
- `upper_bound numeric(12,3) null` (exclusive; NULL is open-ended);
- `price_krw integer not null check (price_krw >= 0)`;
- `created_at timestamptz not null default now()`.

Add unique `(workspace_id,order_set_revision_id,sort_order)` and the composite
FK `(workspace_id,order_set_revision_id)` → `order_set_revisions(workspace_id,id)`
`on delete restrict`. The trusted validator requires lower-inclusive/
upper-exclusive intervals, `lower_bound >= 0`,
`upper_bound is null or upper_bound > lower_bound`, deterministic positive sort,
last in sort order. Option A is now approved for both `patient_weight_kg` and
`manual_value`: the first lower bound is `0`, each next lower bound equals the
previous upper bound, and exactly one final upper bound is NULL, so every
nonnegative input matches exactly one bracket (`docs/engineering/data-model/clair-clinical-master-data-phase-1-db-spec.md:641-655`).
No `EXCLUDE` constraint is
added: the repository does not provide `btree_gist`, and the spec assigns range validation to the trusted
validator rather than introducing a new extension.
Name the unique object `order_set_revision_price_ranges_workspace_revision_sort_key`
and the FK `order_set_revision_price_ranges_owner_revision_fk`.

### `public.order_set_revision_update_reviews`

Create:

- `id uuid primary key`;
- `workspace_id text not null`;
- `parent_order_set_id text not null`;
- `parent_revision_id uuid not null`;
- `child_order_set_id text not null`;
- `pinned_child_revision_id uuid not null`;
- `available_child_revision_id uuid not null`;
- `status text not null check (status in
  ('pending','accepted','dismissed','superseded'))`;
- `result_parent_revision_id uuid null`;
- `resolved_by_user_id uuid null references public.users(id) on delete set null`,
  `resolved_at timestamptz null`;
- `created_at timestamptz not null default now()`;

Add stable identity FKs `(workspace_id,parent_order_set_id)` and
`(workspace_id,child_order_set_id)` → `order_sets(workspace_id,id) on delete
restrict`; exact triple revision FKs for the parent, pinned child, available
child, and nullable result parent, all with `on delete restrict`:

```sql
(workspace_id,parent_order_set_id,parent_revision_id)
  references public.order_set_revisions(workspace_id,order_set_id,id)
  on delete restrict deferrable initially deferred
(workspace_id,child_order_set_id,pinned_child_revision_id)
  references public.order_set_revisions(workspace_id,order_set_id,id)
  on delete restrict deferrable initially deferred
(workspace_id,child_order_set_id,available_child_revision_id)
  references public.order_set_revisions(workspace_id,order_set_id,id)
  on delete restrict deferrable initially deferred
(workspace_id,parent_order_set_id,result_parent_revision_id)
  references public.order_set_revisions(workspace_id,order_set_id,id)
  on delete restrict deferrable initially deferred
```

All four revision FKs are `deferrable initially deferred`; the first three are
not nullable in the row and the result triple is nullable as a unit. Add unique
`(workspace_id,parent_revision_id,pinned_child_revision_id,available_child_revision_id)`
and index pending reviews by `(workspace_id,parent_order_set_id,status,created_at desc)`.
Name the stable FKs
`order_set_revision_update_reviews_parent_set_fk` and
`order_set_revision_update_reviews_child_set_fk`; name the four revision FKs
`order_set_revision_update_reviews_parent_revision_fk`,
`order_set_revision_update_reviews_pinned_child_revision_fk`,
`order_set_revision_update_reviews_available_child_revision_fk`, and
`order_set_revision_update_reviews_result_parent_revision_fk`. Name the unique
object `order_set_revision_update_reviews_identity_key` and the pending index
`order_set_revision_update_reviews_pending_idx`.

The exact status check is mutually exclusive: `pending` requires null
`result_parent_revision_id`, `resolved_by_user_id`, and `resolved_at`;
`accepted` requires all three; `dismissed` and `superseded` require
`resolved_by_user_id`/`resolved_at` and a null result. Review rows do not carry
request hashes or request IDs; the private resolution ledger owns durable retry
identity.
Install it as named check `order_set_revision_update_reviews_status_ck` with
the equivalent SQL predicate:

```sql
check (
  (status = 'pending'
    and result_parent_revision_id is null
    and resolved_by_user_id is null and resolved_at is null)
  or (status = 'accepted'
    and result_parent_revision_id is not null
    and resolved_by_user_id is not null and resolved_at is not null)
  or (status in ('dismissed','superseded')
    and result_parent_revision_id is null
    and resolved_by_user_id is not null and resolved_at is not null)
)
```

Install `order_set_revision_integrity_deferred` as a `CONSTRAINT TRIGGER
DEFERRABLE INITIALLY DEFERRED` after backfill. It invokes
`private.clair_assert_order_set_revision_integrity(workspace_id,parent_order_set_id,parent_revision_id)`
for parent rows and `private.clair_assert_order_set_revision_integrity` for each
child revision. It rejects a pending review whose parent/child revisions are not
valid, or whose pinned/available child revisions are not same-workspace members.

## Graph, expansion, and child-update contract

The trusted validator receives a complete candidate definition and expands it
in deterministic positive `sort_order` order, returning flattened atomic rows
and their paths. It must:

1. verify the root set, every revision, every catalog item, and every child
   reference belongs to the request workspace;
2. require every atomic member to exist in `order_catalog_items`, match the
   pinned `(child_order_catalog_item_id,child_order_catalog_revision)` lineage,
   and be usable in the workspace; an active billable atomic member must have a
   non-null configured price, while zero is valid and a nonbillable NULL price is
   valid;
3. require a child-set member's exact triple to resolve to a `valid` child
   revision whose stable set is `active` and whose revision is the child set's
   current pointer when the parent is activated; paused/inactive/unavailable
   members block activation;
4. traverse exactly root → child revision → atomic order; reject a child
   revision containing another child revision, including a self-reference;
5. reject cycles before any revision/current-pointer write, reject a third set
   layer, and reject every cross-workspace reference;
6. reject duplicate atomic IDs across direct and nested paths rather than
   silently deduplicating;
7. return deterministic atomic paths such as `[rootRevisionId,itemId]` or
   `[rootRevisionId,parentItemId,childRevisionId,childItemId]`; at each level
   order by `(sort_order, child_kind, typed child ID, typed child revision ID)`
   and preserve that order in the flattened result;
8. reject an empty expanded atomic result and a revision with no selected
   flattened atomic member when activation is requested;
9. mark a current set `needs_composition_review` and block B3 application only
   when an exact pinned atomic member or exact pinned child set is paused,
   inactive, invalid, or otherwise unusable, including a billable atomic member
   becoming NULL-priced. An ordinary usable catalog name, price, or current-
   version change is future-only and does not set the flag. A newer valid,
   active, usable child revision is a review/notification event only; the
   current parent remains selectable until an administrator accepts or
   dismisses the review.

The child pointer is always the exact `child_set_revision_id`. It never follows
the child set's latest pointer automatically.

### Shared lock, row order, and composition invalidation

Every public B2 save, review resolution, child-pointer advancement, and
authenticated A2/B1 catalog mutation derives `auth.uid()`, rejects an absent
actor, and verifies active workspace membership plus
`private.clair_current_user_has_workspace_permission(workspace_id,
'service_catalog:manage')` **before** acquiring this exact lock. The private A2
master-adoption/release path retains its already-approved trusted publisher
boundary and global publication lock; it is not exposed as a service-role
shortcut and enters the shared lock only after that boundary.
After that authorization boundary, it acquires the lock, performs non-locking
discovery and the request-ledger lookup, and only then takes workspace rows;
the ledger lookup itself is not a row lock and always precedes current-pointer
or status CAS:

```sql
pg_advisory_xact_lock(
  hashtextextended('clinical_master_workspace_adoption:' || p_workspace_id, 0)
)
```

The A2 adoption path retains the A1 global publication lock first and then this
workspace lock. B2 uses the workspace lock directly. The one deterministic row
order for all writers is: affected catalog IDs sorted by `(workspace_id,id)`,
stable set IDs sorted by `(workspace_id,id)`, then revision IDs, item IDs, range
IDs, and review IDs sorted by their typed UUID/text values. No writer may acquire
these rows in a different order.

The B2 migration forward-replaces/hooks the exact A2/B1 writer boundaries after
their gates, preserving signatures and lock order:

- `private.clair_adopt_master_release_to_workspace(p_workspace_id text,p_release_id uuid)`;
- `private.clair_adopt_lab_master_projection_to_workspace(p_workspace_id text,p_release_id uuid)`;
- `public.clair_update_order_catalog_item(p_workspace_id text,p_item_id text,p_expected_catalog_revision integer,p_patch jsonb)`;
- `public.clair_update_workspace_lab_test_item(p_workspace_id text,p_item_id text,p_actor_user_id uuid,p_expected_workspace_result_revision integer,p_expected_local_settings_revision integer,p_action text,p_patch jsonb,p_target_link_ids text[])`;
- `private.clair_apply_workspace_lab_test_item_local_settings`;
- `private.clair_apply_workspace_lab_test_item_version`;
- `private.clair_resolve_workspace_lab_definition_update_target`.

The exact private B2 hook for atomic members is
`private.clair_mark_order_set_composition_review_for_catalog_member(
p_workspace_id text,p_catalog_item_id text,p_reason_code text,p_actor_user_id uuid)`.
The exact child-lifecycle hook is
`private.clair_mark_order_set_composition_review_for_child_set(
p_workspace_id text,p_child_order_set_id text,p_reason_code text,p_actor_user_id uuid)`.
The A2/B1 writers call the atomic hook in the same transaction only when the
exact pinned catalog member is unusable: unavailable or invalid, including a
billable member changing to NULL price or a linked lab member becoming
unusable. They do not call it for ordinary name, price, or current-version
changes while the pinned member remains usable; those changes are future-only.
The child hook is called only when the exact pinned child set becomes paused,
inactive, invalid, or otherwise unusable. It discovers affected current parent
rows without locks, then locks catalog IDs, stable sets, revisions/items/ranges,
and reviews last in the common order before the one pointer primitive sets
`needs_composition_review = true` for every current parent that exact-pins the
child. It never mutates a revision, price, or current pointer. A child pointer
advance to a newer valid/active/usable revision **does not** set this flag: it
only creates or supersedes the deterministic parent review and notification,
and the parent remains selectable. The child hook supersedes/resolves pending
reviews whose target is now unusable. Dismissing a review does not invent a
block or clear a real blocker; a real blocker remains true until a validated
current revision clears it. Chart selection is blocked by
`needs_composition_review = true` only; `pending_review_count` is informational
and never a selection predicate.

Only a new validated current revision save or accepted child-review revision may
clear `needs_composition_review`, and only after revalidating current child and
catalog availability. There is no bare flag-update RPC. A parent edit or current
pointer change atomically supersedes pending reviews whose parent current pointer
no longer equals `parent_revision_id` or whose child current pointer no longer
equals `available_child_revision_id`, and resolves their notifications in that
same transaction.

### Child review lifecycle

When a child stable set's current pointer advances to a new valid, active, and
usable revision:

- discover affected parent revisions and pending review candidates without
  locking; then, under the shared advisory lock, lock catalog IDs first, the
  affected child/parent stable sets next, their revisions/items/ranges next,
  and reviews last in sorted typed-ID order;
- after those locks are held, require the available target to be the child's
  current valid revision, active and usable;
- insert one pending review per deterministic
  `(workspace_id,parent_revision_id,pinned_child_revision_id,available_child_revision_id)`;
- if a newer child revision appears, mark the earlier pending target
  `superseded`, resolve its notification, and create exactly one pending review
  for the latest eligible target. The parent remains selectable because this
  path does not set `needs_composition_review`; `pending_review_count` is only
  informational;
- preserve the parent pointer and old child pin until explicit resolution.

When the exact pinned child set becomes paused, inactive, invalid, or otherwise
unusable, `private.clair_mark_order_set_composition_review_for_child_set` marks
every current parent that exact-pins it, leaves each parent pointer/projection
unchanged, and supersedes/resolves any pending review whose available target is
no longer eligible. This is the only child lifecycle path that sets the block;
ordinary child price/name/current-version changes and a newer usable child are
future-only/review-only.

Accepting a review first discovers the candidate without locks, then acquires
catalog IDs, stable sets, revisions/items/ranges, and reviews last in the shared
order. It requires exactly
`parent.current_revision_id = review.parent_revision_id` and
`child.current_revision_id = review.available_child_revision_id`. Before any
recursive nested validation, the RPC also requires the review's pinned and
available child identities to name the same `(workspace_id, child_order_set_id)`
stable row, that stable child to be `active`, and the available child triple
`(workspace_id, child_order_set_id, available_child_revision_id)` to exist as a
`valid` revision. Failure of any of those identity/current/validity checks is a
terminal obsolete target: the new-request ledger result has
`outcome = 'superseded'`, `ok = false`, `error.code =
'order_set_review_obsolete'`, `result_parent_revision_id = NULL`, and the review
is marked `superseded` with its notification resolved. The parent pointer and
flag are unchanged. A child pointer is never followed automatically.

For a target that passes those checks, acceptance changes the pinned child item
to the accepted child revision and refreshes only the direct atomic items in the
parent candidate to their locked current `order_catalog_items.catalog_revision`.
Nested atomic items remain inside the immutable accepted child revision; a
parent acceptance never rewrites or refreshes those nested item rows. Before
any parent revision is inserted, the validator recursively checks every nested
atomic pin inside that accepted child revision against the locked current catalog
rows. Both terminal branches below are review terminal outcomes, not parent
revision outcomes:

- if a nested member is usable but its pinned `catalog_revision` is stale, return
  HTTP 409 with the committed durable `child_revision_requires_refresh` domain
  error, envelope `ok = false, outcome = 'superseded'`, and
  `result_parent_revision_id = NULL`; the review-resolution ledger row records
  immutable `outcome = 'superseded'`; atomically mark this review `superseded`
  and set its notification resolution to `superseded`, leave the parent pointer and
  `needs_composition_review` unchanged (the parent remains selectable), and
  create no parent revision. A separately saved newer child revision is
  required; that save creates the next review/event identity;
- if a nested member is unavailable, invalid, or otherwise unusable, return
  HTTP 422 with the committed `order_set_member_unavailable` domain error,
  envelope `ok = false, outcome = 'superseded'`, and
  `result_parent_revision_id = NULL`; the review-resolution ledger row records
  immutable `outcome = 'superseded'`; atomically mark this review `superseded`,
  set its notification resolution to `superseded`, and set the composition block on every current
  parent that exact-pins the unusable member. The reviewed parent's pointer is
  unchanged and no parent revision is created.

For a usable accepted child revision, the RPC clones the full parent definition,
applies the child pin plus the direct-parent atomic refreshes, revalidates graph,
availability, duplicates, pricing, and the approved continuous range coverage,
inserts
exactly one immutable parent revision, advances the parent pointer/projection,
clears the composition flag only if validation proves it clear, resolves the
review and notification, and inserts one ledger outcome in one transaction.
The resulting revision's atomic catalog pins are composition lineage only:
B2 stores no child price snapshot, so an atomic catalog price bump before
acceptance is future-only and B3 resolves current price/tax at application before
freezing its own snapshot. Dismissal leaves the parent pointer unchanged and
resolves only the review/notification.

## Pricing, defaults, tax, and atomic revision save

The physical range row has only an integer `price_krw`; therefore B2 adopts the
target architecture's fixed bracket amount model
(`docs/engineering/data-model/clair-clinical-master-data-target-architecture.md:367-379`),
not the demo document's optional per-unit display concept. No per-unit range
column is added. Option A is approved for both range bases: continuous
`[0,+infinity)` coverage, lower-inclusive/upper-exclusive contiguous brackets,
and exactly one final open-ended row; there is no B3 no-match state.

- `range_basis` is exactly `patient_weight_kg` or `manual_value`; applied inputs
  are nonnegative. Brackets are lower-inclusive/upper-exclusive, lower bounds
  are nonnegative, upper bounds are greater than lower bounds, and exactly one
  open-ended bracket is required and must be last. Positive `sort_order` is the
  deterministic evaluation order. The first lower bound is `0`, each next
  lower bound equals the previous upper bound, and the final upper bound is
  NULL, so every nonnegative input matches exactly one bracket.
- `set_fixed_price` requires non-null `set_price_krw >= 0` (zero means free) and
  zero range rows. `included_order_sum` requires NULL set price, zero range rows,
  `billing_reflection_enabled = false`, and `tax_type = 'derived'`.
  `range_price` requires NULL set price, a non-null
  basis, and at least one structurally valid range row; it cannot become active
  until the coverage decision is approved. Mode transitions create a new
  revision and clear incompatible fields/ranges; old revisions do not change.
- Fixed/range defaults set `billing_reflection_default = false`; the parent is
  billed once and a nested container is never a billable line. An explicit
  atomic revision-item flag may mark an extra as billable, but it cannot double
  bill an already included atomic line. Sum parents are nonbillable; selected
  flattened atomic children use their current catalog price and tax. Fixed/range
  revisions require `tax_type in ('taxable','non_taxable')`; explicit extras
  retain their atomic tax. `derived` is the approved sum-mode storage sentinel,
  not a new B2 tax vocabulary.
- A child-set item always has `quantity_source = 'fixed_one'` and normalized
  quantity `1`; atomic `fixed_one` also requires exactly `1`. Atomic
  `preset_quantity` and `manual_at_apply` require a positive `numeric(12,3)`
  value, may be fractional, and use `trim_scale` canonicalization (so `1`,
  `1.0`, and `1.00` hash identically). A selected child set propagates the child
  revision's default-selected flags one level; a false root path excludes that
  path. Activation requires at least one selected flattened atomic member,
  while all referenced members still undergo availability validation.
- A2 active billable atomics with NULL price block active current set validation;
  nonbillable NULL is allowed and zero is allowed. B2 stores no child price
  snapshot. B3 resolves the current price/tax and freezes its applied price,
  catalog revision, quantity, and tax snapshot; B2 does not implement billing.

## Atomic revision save and availability ownership

There is one mutation authority:
`public.clair_save_order_set_revision(
p_workspace_id text,p_order_set_id text,p_expected_current_revision_id uuid,
p_definition jsonb,p_availability_status text,p_request_id uuid) returns jsonb`.
It accepts the workspace, stable set ID, complete intended definition, expected
current revision ID, availability intent, and request ID. It derives actor from
`auth.uid()`; payload hash is never a client input. Price authority, catalog
metadata, child expansion, and snapshot claims are ignored/rejected. Request
UUID and DB-derived actor/hash are all-or-none; an absent/partial request tuple
is rejected.

Inside one transaction it:

1. derives actor from `auth.uid()`, rejects a missing actor, and checks active
   membership plus
   `private.clair_current_user_has_workspace_permission(workspace_id,'service_catalog:manage')`;
2. acquires the exact shared workspace advisory lock and performs only
   non-locking discovery;
3. canonicalizes the submitted JSON and computes the DB SHA-256 using the save
   object above; the submitted expected base is used and the mutable DB pointer
   is not part of that hash;
4. looks up `(workspace_id,request_id)` in the private save ledger before any
   catalog, stable-set, revision, item, range, review, current-pointer, or
   status row lock; an existing row with the same actor/hash/base returns its
   immutable stored outcome even if the pointer has since moved, while any
   actor/hash/base mismatch returns `idempotency_conflict` without changing or
   replacing that original row;
5. for a new request, locks catalog IDs first, stable sets next,
   revisions/items/ranges next, and reviews last in the common deterministic
   order, then checks the expected current revision (CAS), validates graph,
   availability, prices, ranges, and activation rules;
6. inserts exactly one immutable revision plus items/ranges and the complete
   ledger result envelope;
7. if valid and the requested status is active, paused, or inactive, calls the
   one pointer/projection primitive to update current pointer, availability,
   review flag, and all compatibility projections atomically. Active requires a
   valid usable expansion; paused/inactive may point to that same valid revision;
8. if the definition is invalid or unavailable, reject a new non-empty set
   before inserting its stable row or revision; return and commit the exact
   rejected envelope with
   `invalid_order_set_definition`.
   For an existing set, an invalid definition is recorded as immutable invalid
   history only when the administrator explicitly confirms use-off/inactive; it
   never replaces a valid current pointer/projection. An explicit use-off/
   inactive edit may retain that valid pointer/projection while changing only
   stable availability to `inactive`; a genuinely empty set may be created by
   any trusted create/save path only as the metadata-preserving zero-item
   revision with `paused` or `inactive` status, or by physically valid legacy
   backfill. Physical legacy failures are
   quarantine-only and never become public invalid revisions. These domain
   rejection/conflict outcomes are returned and committed in the ledger; only
   auth/internal failures may raise or roll back.

No separate availability writer exists. Availability and
`needs_composition_review` changes are part of this same save/pointer RPC.
Review acceptance uses a separate `public.clair_resolve_order_set_update_review`
RPC because it has a distinct durable review state, but it creates the parent
revision and pointer change atomically.

Review resolution is the separate mutation authority
`public.clair_resolve_order_set_update_review(
p_workspace_id text,p_review_id uuid,p_expected_parent_revision_id uuid,
p_action text,p_request_id uuid) returns jsonb`.
It derives actor and checks active membership plus `service_catalog:manage`, then
uses the exact shared lock. It performs a non-locking read of the review to
compute canonical input, looks up the workspace-scoped request **before any
parent/child/current/status row lock**, and returns the stored envelope for an
exact replay. A new request then locks catalog IDs, stable sets,
revisions/items/ranges, and reviews last in that order. Same actor/hash/
submitted parent/stored child expectation returns the stored result. A mismatch
returns the deterministic `idempotency_conflict` envelope without modifying
the original ledger row; only a new request ID can receive a committed domain
outcome. A request against an already
superseded review records and commits `superseded`, and a request whose exact
CAS target is no longer current records and commits `obsolete`. Accept and
dismiss record `accepted` and `dismissed` respectively. New review mutation,
parent revision creation, notification resolution, and the complete result
envelope/ledger outcome are one atomic transaction. No request identity or
payload hash is stored on an immutable revision/review row; domain outcomes do
not raise or roll back, while auth/internal failures may.

## Migration and compatibility contract

Create one forward migration after the actual B1 migration. Never edit an
earlier migration. Preflight actual A2/A3/B1 columns, composite keys, function
signatures, ACLs, RLS, notification vocabulary, and legacy counts; stop if any
predecessor contract is absent. Install tables, composite unique keys/FKs, and
private quarantine first; classify/backfill before installing the deferred
integrity triggers; then enforce all new writes. This preserves every
quarantined legacy row and makes replay idempotent.

Use private clair_deterministic_uuid(p_domain text,p_fields text[]) with
SHA-256. The literal v1 is the algorithm namespace identifier, not an RFC UUID
version. The helper receives the exact UTF-8 field array, turns each element
into a length-prefixed frame, and joins frames with ASCII unit separator 31:
input = 'clair-uuid:v1' || chr(31) || p_domain || chr(31) ||
array_to_string(frames,chr(31)). A non-NULL field frame is
octet_length(pg_catalog.convert_to(field,'UTF8')) || ':' || field. Every NULL
field frame is exactly -1:, including the open upper bound; there is no empty
segment. The input framing is therefore unambiguous even when a future text ID
contains the delimiter.

The helper computes extensions.digest(pg_catalog.convert_to(input,'UTF8'),
'sha256'), takes the first 16 bytes, sets byte[6] =
(byte[6] & 0x0f) | 0x80 for the RFC UUIDv8 version nibble, sets byte[8] =
(byte[8] & 0x3f) | 0x80 for the RFC variant, and formats lowercase
8-4-4-4-12. These are the exact server call shapes; every array is explicitly
typed text[]:

- revision:
  clair_deterministic_uuid('revision',
  ARRAY[workspace_id::text,order_set_id::text,revision_no::text]::text[]);
- item:
  clair_deterministic_uuid('item',
  ARRAY[workspace_id::text,order_set_id::text,revision_id::text,
  normalized_sort_order::text,child_kind::text,
  child_order_catalog_item_id::text,child_order_catalog_revision::text,
  child_order_set_id::text,child_set_revision_id::text]::text[]);
- range:
  clair_deterministic_uuid('range',
  ARRAY[workspace_id::text,order_set_id::text,revision_id::text,
  normalized_ordinal::text,lower_bound::text,upper_bound::text,
  price_krw::text]::text[]);
- review:
  clair_deterministic_uuid('review',
  ARRAY[workspace_id::text,parent_revision_id::text,
  pinned_child_revision_id::text,available_child_revision_id::text]::text[]);
- quarantine:
  clair_deterministic_uuid('quarantine',
  ARRAY[workspace_id::text,source_kind::text,source_id::text,
  reason_code::text]::text[]);
- seed:
  clair_deterministic_uuid('seed',
  ARRAY[workspace_id::text,legacy_set_id::text,seed_release::text]::text[]);
- creation:
  clair_deterministic_uuid('creation',
  ARRAY[workspace_id::text,request_id::text]::text[]).

No RFC-version label is used in an ID input: the output is UUIDv8-shaped while
the algorithm namespace remains the literal v1 framing tag.

The migration creates two private, ungranted replay tables before classification:
`private.order_set_legacy_classifications` has
`workspace_id text not null`, `source_kind text not null`, `source_id text not
null`, `classification text not null check (classification in
('malformed_cross_workspace','duplicate','invalid_quantity','unsupported_range',
'member_unavailable','member_invalid','member_billable_price_unset',
'sum_billing_inconsistent','legacy_fixed_tax_unset','empty_active',
'empty_unavailable','valid_sum'))`,
`reason_code text not null`,
`source_row jsonb not null check (jsonb_typeof(source_row) = 'object')`,
`source_sha256 text not null check (source_sha256 ~ '^[0-9a-f]{64}$')`,
`deterministic_id uuid not null`, `created_at timestamptz not null default now()`,
primary key `(workspace_id,source_kind,source_id)`, and unique
`(workspace_id,deterministic_id)`. `private.order_set_legacy_quarantine` has
`id uuid primary key`, the same source key/reason fields, `classification text not
null`, `source_row jsonb not null` object, `validation_errors jsonb not null`
array, `source_sha256 text not null check (source_sha256 ~ '^[0-9a-f]{64}$')`,
and `created_at timestamptz not null`; unique
`(workspace_id,source_kind,source_id,reason_code)`. Neither table is exposed to
the Data API.

Legacy classification is mutually exclusive, in this precedence order:

| Classification | Exact predicate | Action |
| --- | --- | --- |
| malformed/cross-workspace | set/member missing, `workspace_id` mismatch, blank required name, unsupported sales unit, or invalid amount basis | Quarantine with deterministic identity; leave the legacy row readable |
| duplicate | duplicate direct `(order_set_id,child_order_id)` or duplicate normalized positive sort within a set | Quarantine the affected set/items; never guess which row wins |
| invalid quantity | `default_quantity <= 0`, NULL, a quantity source outside `fixed_one|preset_quantity|manual_at_apply`, or `quantity_source='fixed_one'` with `default_quantity <> 1` | Quarantine the affected set/items before any native revision-item CHECK can reject the source |
| unsupported range | legacy amount basis is `range_price` or any legacy range-shaped row exists without native brackets | Quarantine; never invent brackets |
| member unavailable | all preceding predicates false; the same-workspace catalog member exists and the exact A2/B1 usability predicate returns `unavailable` (`availability_status in ('paused','inactive')`) | Quarantine the set/items; no public invalid revision and no pointer; retain the member/status reason |
| member invalid | all preceding predicates false; the same-workspace catalog member exists with `availability_status='active'`, but the exact B2 member validator returns `invalid` for a failed catalog-revision, required-field, or B1 linked-item validity check (not an availability state) | Quarantine the set/items; no public invalid revision and no pointer; retain the validator reason |
| member billable price unset | all preceding predicates false; the member is otherwise usable but `billing_reflection_enabled = true` and its current A2 price is `NULL` | Quarantine as `member_billable_price_unset`; zero is valid and nonbillable `NULL` is not this class |
| sum billing inconsistent | all preceding predicates false, `amount_basis='included_order_sum'`, and the legacy set-level `billing_reflection_enabled` is not `false`, or an item flag cannot be represented by the already-approved B2 explicit atomic-item billing rule | Quarantine; copy an item billing flag only after the approved B2 rule proves it representable; never silently normalize |
| legacy fixed tax unset | all preceding predicates false, `amount_basis='set_fixed_price'`, `set_price_krw is not null and set_price_krw >= 0`, and the actual legacy schema has no authoritative set-level tax column | Quarantine with reason `legacy_fixed_tax_unset`; never infer `taxable` or `non_taxable` |
| empty-active | all preceding predicates false and a physically valid legacy sum set is active but has no item or no default-selected flattened atomic member | Preserve all source metadata in a deterministic zero-item revision, set its stable availability to paused, point/projection it through the trusted primitive, and quarantine/audit reason legacy_empty_active_was_demoted; never leave an active zero-item current row |
| empty-unavailable | all preceding predicates false and a physically valid legacy sum set is paused or inactive but has no item or no default-selected flattened atomic member | Preserve all source metadata in a deterministic valid zero-item revision, retain paused/inactive availability, point/projection it through the trusted primitive, and retain quarantine/audit reason empty_unavailable; do not use a NULL pointer sentinel |
| valid sum | all prior predicates false, `amount_basis='included_order_sum'`, the set-level billing flag is `false`, every item billing flag is representable by the approved explicit atomic-item rule, and all members are valid | Backfill rev1/items with NULL set price and derived tax; point/projection only through the trusted primitive |

The predicates are evaluated once into a private classification table with a
unique source key, in the displayed precedence order, so no row can receive
two classes. The preflight asserts `classified_count = source_set_count +
source_item_count` and that every source set/item has exactly one class; a
nonzero unclassified count aborts the migration rather than inventing a
fallback class. Existing columns map
exactly: set `id`, `workspace_id`, category/name/billing fields, availability,
the six actual sales units (`per_order|per_each|per_day|per_frequency|per_ml|per_kg`),
`target_species`, `billing_reflection_enabled`, care/instruction, and set price
copy to revision fields. Existing `created_at`/`updated_at` remain on the stable
row; the revision/item creation timestamps use the source timestamp where
available and retain the raw source row in classification evidence. Existing
`source_set_version` is retained only as the server-generated projection
`order-set-revision-<revision_no>`; its old value is report/quarantine metadata,
never authority. Legacy item `id` is only the deterministic UUID input/evidence;
`workspace_id`, `order_set_id`, `child_order_id`, `default_selected`,
`billing_reflection_default`, `default_quantity`, `quantity_source`, and
`created_at` map to revision items. For every item that reaches `valid_sum`,
the workspace lock first reads and pins the current A2
`order_catalog_items.catalog_revision` into `child_order_catalog_revision`; a
missing/current-unusable member is classified above and quarantined, never
guessed. Legacy zero-based sort is re-numbered with `row_number()` ordered by
`(sort_order,id)`. The old `unit_price_snapshot_krw` is never mapped or used as
price authority. Sum rows
use `tax_type='derived'`; the old schema has no set-level tax column, so a fixed
legacy row without an authoritative set tax is quarantined as
`legacy_fixed_tax_unset` rather than assigned an invented tax. There is no
authoritative fixed-set tax column in the legacy schema, so every physically
well-formed legacy fixed row reaches that one quarantine class; there is no
legacy valid-fixed backfill class. Native B2 seed rows are the only fixed
and range inputs and provide explicit fixed/range tax. The source schema's
`billing_reflection_default` is not price authority: it is copied only for a
sum item after the approved B2 explicit atomic-item rule proves it
representable. If that rule is absent from the gated predecessor contract or
the row is inconsistent, the row is `sum_billing_inconsistent` quarantine
evidence, not a silently normalized revision.

Rows that fail a physical predicate (malformed/cross-workspace, duplicate,
invalid quantity, unsupported range, member unavailable/invalid,
member-billable-price-unset, sum-billing-inconsistent, or legacy fixed tax
unset) are quarantine-only: they never receive a public invalid revision. The
physically valid empty_active class is not a malformed revision: it receives a
deterministic metadata-preserving zero-item revision with validation_status
valid, availability paused, and a legacy_empty_active_was_demoted audit/
quarantine reason. The physically valid empty_unavailable class receives the
same metadata-preserving zero-item revision with its source paused/inactive
availability and empty_unavailable quarantine reason. Neither empty class has
a NULL current pointer after backfill.

Before enabling the deferred current/projection and revision-integrity
constraints, every existing stable row is first given a deterministic safe
projection in the same migration transaction. Malformed, duplicate, invalid
quantity, unsupported range, member unavailable/invalid, member-billable-price-
unset, sum-billing-inconsistent, and legacy fixed-tax-unset rows use
current_revision_id = NULL, availability_status = 'inactive',
needs_composition_review = false, set_name =
'Quarantined Order Set ' || deterministic_id::text, billing_name =
'Quarantined Order Set ' || deterministic_id::text, set_category = NULL,
sales_unit = 'per_each', target_species = ARRAY['dog','cat','other']::text[],
care_guide = NULL, internal_instruction = NULL, source_set_version =
'order-set-quarantine-' || deterministic_id::text, amount_basis =
'included_order_sum', set_price_krw = NULL, range_basis = NULL,
range_price_ranges = '[]'::jsonb, billing_reflection_enabled = false, and
tax_type = 'derived'. The empty_active and empty_unavailable rows instead
retain every mapped source projection field, are assigned paused or their
source inactive status, receive their deterministic zero-item revision, and
call the trusted pointer/projection primitive to install that revision and
source_set_version = 'order-set-revision-1'. Valid included-sum rows call the
same primitive to install their valid rev1. Fixed rows are not
legacy-backfilled; native fixed seed rows call the named seed adapter later.

The migration asserts the safe projection and current pointer for every source
class before enabling deferred constraints; a quarantined physical failure has
the NULL pointer sentinel, while both physically valid empty classes have a
non-NULL metadata revision and a normal UUID ETag. No malformed row is
represented as a public invalid revision. Only after this deterministic
sentinel/backfill pass does the migration enable the deferred triggers, so
migration commit cannot fail on a quarantined legacy row and replay produces
the same state.

Migration/replay is idempotent by construction: table/index/constraint installs
use existence checks. On reapply, the existing order-set classification is
looked up before reading any mutable compatibility projection; its stored
`source_row`, source SHA-256, reason, action, deterministic identity, generated
revision/items, and quarantine/sentinel artifact are compared, so a normalized
projection or quarantine sentinel is never re-hashed as legacy source. Any
changed original evidence or generated artifact fails with
`legacy_replay_payload_mismatch` rather than rewriting evidence. Classification
and quarantine inserts use the unique source key; deterministic revision/item/
quarantine inserts use `ON CONFLICT` only when every immutable field matches,
otherwise fail; pointer/projection calls use the workspace lock and the trusted
valid-revision or migration-only quarantine primitive. A fresh local reset is
the rollback/replay oracle; a failed transaction leaves no partial sentinel,
revision, item, range, review, notification, or ledger row.

Existing `order_set_items` remains readable for compatibility and receives no
new authoritative writes. Do not drop or clean it in B2. Quarantine rows retain
the original source key, mutually exclusive reason code, and safe validation
metadata; no stale snapshot or price is promoted.

### Exact ACL/RLS and direct-DML boundary

Drop the existing broad `order_sets_workspace_member_select` and
`order_set_items_workspace_member_select` policies. Create these exact SELECT
policies, each `FOR SELECT TO authenticated USING (
private.clair_is_active_workspace_member(workspace_id) and
private.clair_current_user_has_workspace_permission(workspace_id,'service_catalog:view'))`:

- `order_sets_workspace_catalog_view`;
- `order_set_revisions_workspace_catalog_view`;
- `order_set_revision_items_workspace_catalog_view`;
- `order_set_revision_price_ranges_workspace_catalog_view`;
- `order_set_revision_update_reviews_workspace_catalog_view`;
- `order_set_items_workspace_catalog_view`.

The forward migration runs `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` for
`order_sets`,
`order_set_revisions`, `order_set_revision_items`,
`order_set_revision_price_ranges`, `order_set_revision_update_reviews`, and
legacy `order_set_items` before granting the policies. There are no mutation
policies and therefore no `WITH CHECK` path.

Grant SELECT only to `authenticated` with this exact table ACL sequence:

```sql
revoke all on table public.order_sets, public.order_set_revisions,
  public.order_set_revision_items, public.order_set_revision_price_ranges,
  public.order_set_revision_update_reviews, public.order_set_items
  from public, anon, service_role;
grant select on table public.order_sets, public.order_set_revisions,
  public.order_set_revision_items, public.order_set_revision_price_ranges,
  public.order_set_revision_update_reviews, public.order_set_items
  to authenticated;
revoke insert, update, delete on table public.order_sets,
  public.order_set_revisions, public.order_set_revision_items,
  public.order_set_revision_price_ranges, public.order_set_revision_update_reviews,
  public.order_set_items from authenticated;
```

The final revoke denies direct Data API INSERT/UPDATE/DELETE on stable sets,
revisions, items, ranges, reviews, and legacy `order_set_items` from
`public`, `anon`, `authenticated`, **and `service_role`**. There is no
approved trusted service-role exception; the owner/private fixed-search-path
RPC path is the sole writer. There are no direct-write policies, so no `WITH
CHECK` bypass exists; if a predecessor policy has a write name, drop it in the
forward migration. Revoke public/anon/service_role EXECUTE on every B2 RPC
except the authenticated allow-list and grant authenticated EXECUTE only on
the named read/save/review APIs. Private primitives, request ledgers,
classifications, and quarantine receive no grants.
Every authenticated/public SECURITY DEFINER mutation wrapper uses
`SET search_path = public, private, pg_temp`, derives actor from `auth.uid()`,
and requires active membership plus the actual DB helper
`service_catalog:manage`, with no invented app role. The owner-only synthetic
seed adapter is the sole explicit-actor exception: it validates its supplied
seed actor and has no Data API grant.
Same-workspace users without `service_catalog:view` see zero rows through the
Data API; users without `service_catalog:manage` cannot call a mutation.

The public EXECUTE allow-list is exactly these signatures for `authenticated`:

```sql
public.clair_list_order_sets(text,text)
  returns table(order_set_id text,current_revision_id uuid,
    current_revision_no integer,availability_status text,
    current_etag text,needs_composition_review boolean,set_name text,
    billing_name text,sales_unit text,target_species text[],amount_basis text,
    set_price_krw integer,range_basis text,tax_type text,
    range_price_ranges jsonb,pending_review_count integer);
public.clair_get_order_set(text,text) returns jsonb;
public.clair_create_order_set(text,jsonb,text,uuid) returns jsonb;
public.clair_save_order_set_revision(text,text,uuid,jsonb,text,uuid) returns jsonb;
public.clair_resolve_order_set_update_review(text,uuid,uuid,text,uuid) returns jsonb;
```

`clair_list_order_sets` returns one row per stable set using exactly those
columns; every non-quarantine stable row, including a newly created zero-item
metadata revision, has `current_etag = "order-set-revision-<revision_uuid>"`.
Only a deterministic migration-quarantine row may return `current_etag = NULL`.
`clair_get_order_set` returns
one JSON object with exactly
`{"orderSet":<stable projection plus currentEtag>,"history":[<immutable revisions>],"reviews":[<review rows>]}`;
missing workspace/set returns `order_set_not_found`, not an empty success.

For every listed signature the migration executes
`REVOKE ALL ON FUNCTION ... FROM public, anon, service_role; GRANT EXECUTE ON
FUNCTION ... TO authenticated;` and applies the existing
`service_catalog:view` predicate to list/get and `service_catalog:manage` to
create/save/review. Revoke `EXECUTE` from `public`, `anon`, and `service_role`
on every private helper and every non-allow-listed overload; no function is
left reachable through an overload. The list and detail RPCs repeat the view
predicate, while mutation RPCs derive `auth.uid()` and repeat the manage
predicate.

Migration replay uses one transaction and the exact shared advisory/row-lock
ordering. Rollback is transaction rollback or local reset followed by predecessor
replay; no Git reset, remote change, or hard delete is allowed.

### Mandatory native seed ownership

Because `supabase db reset` loads seed files after migrations, B2 must update
`supabase/seed.sql` and
`supabase/snippets/den-468-491_cheongdam_master_seed.sql` as mandatory B2-owned
files. The existing read-only oracle
`supabase/snippets/demo_seed_inventory_readback.sql`, its authoritative contract
`docs/engineering/data-model/demo-seed-inventory-readback-contract.md`, and
`tests/demo-seed-inventory-readback-contract.spec.ts` are also mandatory B2
files. The contract, snippet, and test must be updated together: the snippet
must read native revision/item rows, the stable `current_revision_id`, and the
server-generated projection version rather than counting mutable legacy writes;
the current direct `order_sets`/`order_set_items` count and direct-insert
assertions are removed from that oracle in the implementation pass. Both seed
files call exactly one named trusted compatibility path:
`private.clair_seed_order_set_compatibility_projection(
p_workspace_id text,p_legacy_set_id text,p_definition jsonb,
p_availability_status text,p_actor_user_id uuid,p_request_id uuid) returns
jsonb`. This owner-only synthetic adapter requires an explicit validated
synthetic actor UUID; it does not call `auth.uid()` and never accepts a caller
payload hash. The reset seed passes
`00000000-0000-4000-8000-000000000001` (the seeded active hospital-admin user)
for both `clair-demo` and `workspace-clair-cheongdam`; the adapter proves that
the UUID exists in `public.users`, is an active member of the target workspace,
and has the actual `service_catalog:manage` permission. Each request ID is
deterministic:
clair_deterministic_uuid('seed',
ARRAY[workspace_id::text,legacy_set_id::text,seed_release::text]::text[])
with seed_release = '2026-08-19'. The adapter computes
the canonical DB payload hash, uses the same workspace-scoped save ledger,
audit actor, CAS, immutable revision, and pointer/projection primitive as the
public writer, and returns the same result envelope. An exact replay returns
the stored envelope; the same workspace/request with a different actor or
canonical payload returns the deterministic `idempotency_conflict` response
without modifying the original ledger row; only a distinct request ID can
receive a committed domain rejection/conflict; a
deterministic ID collision returns committed `deterministic_id_collision`. It
is invoked by the local reset owner inside the seed transaction; no
`service_role`, `authenticated`, `anon`, or `public` EXECUTE grant is added.
Seed files must
not directly insert/update `order_sets`, `order_set_items`, revisions, or
projection columns and must never reintroduce authoritative mutable
`order_set_items` writes. The readback snippet remains SELECT-only and is not a
hidden projection writer. Update the authoritative contract, readback snippet,
and current literal/readback assertions in
`tests/demo-seed-inventory-readback-contract.spec.ts` and
`tests/hospital-admin-order-catalog-schema-migration.spec.ts` to assert this
adapter (and no direct `insert into public.order_sets`/
`public.order_set_items` literals) and native
`public.order_set_revisions`/`public.order_set_revision_items` rows plus
`order_sets.current_revision_id`/projection readback; the legacy table is
SELECT-only compatibility evidence. Keep a separate synthetic
legacy fixture/replay path for backfill and quarantine tests; it is not a
production seed.

## Notification contract

Reuse the approved A2 notification vocabulary and persistence fields from
`docs/work/clinical-master/CLINICAL-MASTER-PR-002-phase-1a-2-workspace-adoption.md:312-331`
The deterministic review identity is
clair_deterministic_uuid('review',
ARRAY[workspace_id::text,parent_revision_id::text,
pinned_child_revision_id::text,available_child_revision_id::text]::text[]);
The literal v1 framing namespace is not an RFC UUID version.
The event contract is:

- `event_key = 'clinical_master_update_available'`, `domain = 'hospital_admin'`.
  The forward migration drops and recreates the actual predecessor checks
  `notification_events_event_key_check` and `notification_events_domain_check`
  to append exactly these values while preserving every existing allowed value;
  it does not invent a second event-kind column;
- `event_scope_id = 'order-set-review'`, `notification_id =
  'order-set-review-' || review.id::text`, and `dedupe_key =
  'order-set-child-review:' || review.id::text`;
- `recipient_kind = 'active_role'`, `recipient_id = 'hospital_admin'`,
  `recipient_label = 'Hospital admin'`, and `recipient_payload =
  {"workspaceId":"<workspace>","role":"hospital_admin"}`;
- `source_kind = 'fallback_detail'`, `source_entity_id = review.id::text`,
  `priority = 'normal'`, `toast_policy = 'role_active'`,
  `requires_action = true`, and `badge_count = true` while pending;
- all required text columns are nonblank and deterministic: `title = 'Order Set
  update available'`, `preview = 'A pinned child Order Set revision has a newer
  eligible revision.'`, `detail` is the same review-safe sentence with parent
  and child IDs, `work_type_label = 'Order Set review'`, `source_label = 'Order
  Set management'`, `source_action_label = 'Review'`,
  `fallback_reason = NULL`, `issued_at_label = '방금 전'`,
  `actor_user_id = auth.uid()`, and `occurred_at` is the transaction timestamp.

In the existing notification schema `event_key` is the event kind; do not add a
second `event_kind` column or a new domain vocabulary.

`source_route` is exactly the URL-encoded safe route
`/w/<workspace>/orders?modulePanel=open&section=order-sets&orderSetId=<parent>&reviewId=<review>`;
IDs are trusted text/UUID values encoded with no newline. `source_payload` is one
immutable object and never changes after insert:
`{"reviewId":"<uuid>","parentOrderSetId":"<text>","parentRevisionId":"<uuid>","childOrderSetId":"<text>","pinnedChildRevisionId":"<uuid>","availableChildRevisionId":"<uuid>","pinnedRevisionNo":<positive integer>,"availableRevisionNo":<positive integer>}`.
It contains no prices, instructions, snapshots, SOAP, secrets, or tokens.
Pending creation uses private
`private.clair_b2_create_review_notification(...)` with
`INSERT ... ON CONFLICT (workspace_id,event_scope_id,dedupe_key) DO NOTHING`
for exactly one stable dedupe. Badge/toast behavior is the normal A2 active-role
badge/toast; the admin drawer resolves the same event. The B2 migration also
forward-replaces the generic emitter guard so
`public.clair_emit_notification_event` rejects the B2
`event_key/domain/event_scope_id` triple; it remains available for predecessor
event kinds, while only the private B2 creator can insert the immutable source
payload.

Resolution state is separate from the immutable source payload. Create private
`private.order_set_review_notification_resolutions` with these exact fields:
`workspace_id text not null`, `review_id uuid not null`,
`notification_id text not null`, `resolution_status text not null`,
`resolved_by_user_id uuid null`, `resolved_at timestamptz null`,
`resolution_payload jsonb not null`, `created_at timestamptz not null default now()`,
and `updated_at timestamptz not null default now()`, primary key
`(workspace_id,review_id)`, plus a unique `(workspace_id,notification_id)`.
`resolution_status`, `resolution_payload`, both timestamps, and both identity
columns are always `NOT NULL`; only the resolver UUID/time are nullable while
the status is pending. The pending check requires both resolver fields NULL;
each terminal status requires both resolver fields non-NULL, so a terminal
notification can never be mistaken for pending.
Install `order_set_review_notification_resolution_status_ck` exactly as:

```sql
check (
  (resolution_status = 'pending'
    and resolved_by_user_id is null and resolved_at is null)
  or (resolution_status in
      ('accepted','dismissed','superseded','obsolete')
    and resolved_by_user_id is not null and resolved_at is not null)
)
```

and `order_set_review_notification_resolution_payload_ck` exactly as:

```sql
check (
  jsonb_typeof(resolution_payload) = 'object'
  and resolution_payload = jsonb_build_object(
    'reviewId', review_id::text,
    'resolution', resolution_status,
    'resolvedByUserId', resolved_by_user_id::text,
    'resolvedAt', resolved_at
  )
)
```

The resolution payload is therefore exactly
`{"reviewId":"<uuid>","resolution":"pending|accepted|dismissed|superseded|obsolete","resolvedByUserId":"<uuid-or-null>","resolvedAt":"<timestamptz-or-null>"}`;
it never replaces `source_payload`. Review `status` has only
`pending|accepted|dismissed|superseded`; an obsolete accept atomically sets
review status to `superseded`, records resolution status `obsolete`, and makes
the notification non-actionable. Pending, accepted, dismissed, and ordinary
superseded transitions use the same status in both rows.

Do not use `public.clair_emit_notification_event` for resolution: its existing
upsert bumps the event and deletes `notification_user_states`
(`supabase/migrations/20260705133000_notification_event_persistence.sql:559-563`).
Instead the private
`private.clair_b2_resolve_review_notification(p_workspace_id text,p_review_id uuid,p_resolution text,p_actor_user_id uuid)`
updates the review and resolution row, then sets only
`notification_events.requires_action = false`, `badge_count = false`, and
`updated_at`; it does not bump `bump_count`, rewrite immutable source fields,
delete `notification_user_states`, or alter read/archive timestamps. Pending
creation, supersession, accept, dismiss, parent edit, and newer-child
supersession update review, resolution, and notification in one transaction.
An obsolete accept records resolution `obsolete`, sets review `superseded`,
leaves the notification non-actionable, and rejects the parent mutation; the
latest eligible child target receives a new review/event identity. Notification
emission is server/RPC-owned and never client-writable.

## Server, API, UI, and B3 handoff ownership

The implementation worker may touch only these exact production files:

- `supabase/migrations/20260820100000_clinical_master_phase1b2_order_set_revisions.sql`;
- new `supabase/snippets/clinical_master_phase1b2_replay.sql`;
- `src/features/hospital-admin/server-order-catalog-core.ts` (Order Set types,
  gateway methods, and Order Set RPC mapping; the existing chart-search mapper
  remains unchanged in B2);
- `src/features/hospital-admin/server-order-catalog.ts` (the existing barrel);
- `src/features/hospital-admin/data.ts` (admin DTO/model exports);
- `src/features/hospital-admin/store.ts` (add the `order-sets` section state);
- `src/features/hospital-admin/module.tsx` (existing navigation/section owner);
- `src/features/hospital-admin/order-sets-panel.tsx` (minimal current-revision
  list surface; no chart expansion or execution controls);
- new `src/app/api/workspaces/[workspaceId]/hospital-admin/order-sets/route.ts`;
- new `src/app/api/workspaces/[workspaceId]/hospital-admin/order-sets/[orderSetId]/route.ts`;
- new `src/app/api/workspaces/[workspaceId]/hospital-admin/order-sets/[orderSetId]/reviews/[reviewId]/route.ts`.

The existing store has \"orders\" but no \"order-sets\" section
(`src/features/hospital-admin/store.ts:17-27`), and the existing module keeps
the disabled `id=\"order-set\"` entry (`src/features/hospital-admin/module.tsx:1250-1272`).
Add the exact section key \"order-sets\" and use this safe notification URL:
`/w/${encodeURIComponent(workspaceId)}/orders?modulePanel=open&section=order-sets&orderSetId=${encodeURIComponent(parentOrderSetId)}&reviewId=${encodeURIComponent(reviewId)}`.

Core types are `OrderSetDefinition`, `OrderSetSummary`, `OrderSetDetail`,
`OrderSetRevision`, `OrderSetRevisionItem`, `OrderSetRevisionPriceRange`, and
`OrderSetUpdateReview`. `OrderSetSummary.currentEtag` is `string | null` only
for a migration-quarantine sentinel; all API-created sets, including zero-item
paused/inactive sets, return an ordinary UUID ETag. `OrderSetDefinition` excludes server IDs, actor, hashes,
current pointers, prices not defined by its mode, and availability (which is a
separate save field). Add these gateway methods to the existing
`OrderCatalogGateway` owner:

In these types, `OrderSetDefinition.items[].defaultQuantity` and
`OrderSetRevisionItem.defaultQuantity` are positive `number` values representing
SQL `numeric(12,3)`, not integer quantities; the parser rejects scale greater
than three and the RPC applies `trim_scale` before constructing the canonical
JSONB. `quantitySource` is exactly
`'fixed_one'|'preset_quantity'|'manual_at_apply'`; only a nested child-set item
or `fixed_one` requires numeric `1`, while the other two atomic sources accept a
positive fractional value. The constructor and the fixture/type tests must
assert that `1`, `1.0`, and `1.00` produce one hash while `1.5` remains valid for
the non-`fixed_one` atomic sources.

The shared TypeScript response type is a discriminated union with no other
outcome members:

```ts
type OrderSetSuccessOutcome = 'created' | 'applied' | 'accepted' | 'dismissed';
type OrderSetFailureOutcome = 'rejected' | 'conflict' | 'obsolete' | 'superseded';
type OrderSetErrorCode =
  | 'workspace_membership_missing' | 'permission_missing' | 'order_set_not_found'
  | 'revision_conflict' | 'idempotency_conflict' | 'invalid_order_set_definition'
  | 'order_set_member_unavailable' | 'child_revision_requires_refresh'
  | 'order_set_review_obsolete' | 'if_none_match_required' | 'if_match_required';
type OrderSetMutationResult = {
  orderSet: OrderSetDetail | null; revision: OrderSetRevision | null;
  review: OrderSetUpdateReview | null;
  current: { revisionId: string; etag: string } | null;
};
type OrderSetMutationError = {
  code: OrderSetErrorCode; field: string | null; message: string;
};
type OrderSetMutationResponse =
  | { ok: true; outcome: OrderSetSuccessOutcome; requestId: string;
      error: null; result: OrderSetMutationResult }
  | { ok: false; outcome: OrderSetFailureOutcome; requestId: string;
      error: OrderSetMutationError; result: null };
```

`OrderSetMutationResult` carries the nullable operation-specific
`orderSet`/`revision`/`review` members and current ETag; the mapper must narrow
on `ok`, not on an open-ended outcome string. The SQL `result_envelope`, RPC
return, API DTO, gateway mapper, and fixture assertions all use this same union.

- `listOrderSets({workspaceId,query?})` → summaries plus pending review state;
- `getOrderSet({workspaceId,orderSetId})` → current detail and immutable history;
- `createOrderSet({workspaceId,requestId,definition,availabilityStatus})` →
  server-generated stable set ID and first metadata-preserving current revision;
- `saveOrderSetRevision({workspaceId,orderSetId,expectedCurrentRevisionId,requestId,definition,availabilityStatus})`;
- `resolveOrderSetUpdateReview({workspaceId,reviewId,action:'accept'|'dismiss',expectedParentRevisionId,requestId})`.

The API route contract is exact: `GET /api/workspaces/:workspaceId/hospital-admin/order-sets?query=<text>`
returns `{summaries: OrderSetSummary[]}`; `GET /api/workspaces/:workspaceId/hospital-admin/order-sets/:orderSetId`
returns `{orderSet: OrderSetDetail, history: OrderSetRevision[], reviews: OrderSetUpdateReview[]}`;
`POST /api/workspaces/:workspaceId/hospital-admin/order-sets` creates a
collection and requires `If-None-Match: *` plus `Idempotency-Key`; its body is
`{definition: OrderSetDefinition, availabilityStatus: 'active'|'paused'|'inactive'}`.
The server generates the stable UUID (the client cannot choose it), calls
`public.clair_create_order_set(text,jsonb,text,uuid)`, and returns the common
success shape
`201 {ok:true,outcome:'created',requestId,error:null,result:{orderSet:OrderSetDetail,
revision:OrderSetRevision,review:null,current:{revisionId:uuid,etag:string}}}`.
An empty definition is accepted by any trusted create/save path only as a
paused/inactive metadata-preserving zero-item revision; a trusted backfill may
also install the same physically valid legacy empty state. Its submitted
names/sales/species/instructions are preserved, it has zero items, and its
normal ETag is exactly "order-set-revision-<revision_uuid>". The generated ID is
private.clair_b2_deterministic_uuid('creation',
ARRAY[workspace_id::text,request_id::text]::text[]); it is server-owned, so a
retry of the same workspace/request resolves to the same stable identity
without a client ID.
`If-None-Match` returns `428
if_none_match_required`; an idempotent retry returns the stored creation
outcome for the same workspace/request tuple.
`POST /api/workspaces/:workspaceId/hospital-admin/order-sets/:orderSetId` requires
exactly `If-Match: "order-set-revision-<expectedCurrentRevisionId>"` for every
non-quarantine stable row, and
`Idempotency-Key` headers and body
`{definition: OrderSetDefinition, availabilityStatus: 'active'|'paused'|'inactive'}`
and returns the common envelope with
`result.revision: OrderSetRevision|null`; success uses only
`outcome: 'applied'`, while failure uses one of
`'rejected'|'conflict'|'obsolete'|'superseded'`;
the successful response ETag is exactly
`"order-set-revision-<resultCurrentRevisionId>"`,
and a missing/malformed or
stale `If-Match` returns `428 if_match_required` or `409 revision_conflict`.
`POST /api/workspaces/:workspaceId/hospital-admin/order-sets/:orderSetId/reviews/:reviewId`
requires `If-Match: "order-set-revision-<expectedParentRevisionId>"` and
`Idempotency-Key`, body
`{action: 'accept'|'dismiss'}`, and returns the common envelope with
`result.review: OrderSetUpdateReview|null, result.orderSet: OrderSetDetail|null,
outcome: 'accepted'|'dismissed'` on success; a domain failure has `result=null`
and outcome `'rejected'|'conflict'|'obsolete'|'superseded'`.
An accepted or dismissed success returns the quoted
`ETag: "order-set-revision-<resultCurrentRevisionId>"`; a superseded/obsolete
failure does not mutate the parent and may echo its unchanged ETag as a header,
but its envelope remains `ok=false` with `result=null`.
GET returns `200`/`404`; successful save/review returns `200`; CAS or retry
conflicts return `409` with one of the exact error strings below. No route
accepts a client actor, hash, current pointer, price snapshot, or direct item
mutation.

The list/detail GET boundary requires active membership plus
`service_catalog:view`; create/save/review requires `service_catalog:manage`.
HTTP create requests send `If-None-Match: *`; update/review requests send the
exact quoted `If-Match` value and every mutation sends
`Idempotency-Key: <workspace-scoped UUID>`. The JSON body is a complete
definition and never carries a client payload hash. Responses include stable
set ID, exact current revision ID/no, availability, validation/review state,
and immutable history. Errors are exactly
workspace_membership_missing|permission_missing|order_set_not_found|revision_conflict|idempotency_conflict|invalid_order_set_definition|order_set_member_unavailable|child_revision_requires_refresh|order_set_review_obsolete|if_none_match_required|if_match_required.
The HTTP map is exact: workspace_membership_missing/permission_missing → 403,
order_set_not_found → 404, if_none_match_required/if_match_required → 428,
invalid_order_set_definition/order_set_member_unavailable → 422, and
revision_conflict/idempotency_conflict/child_revision_requires_refresh/
order_set_review_obsolete → 409; each response is the common envelope, not a
bare error string. For the two nested-review terminal branches, the exact
`superseded` outcome above overrides the ordinary `rejected`/`conflict` label;
the review and notification are resolved in the same transaction. The HTTP
mapper sets `ok=true` only for `created|applied|accepted|dismissed` and
`ok=false` only for `rejected|conflict|obsolete|superseded`; status codes and
error codes never add another outcome member.
Option A makes coverage/no-match semantics resolved: both range bases require
continuous `[0,+infinity)` coverage with one final open bracket, so no
pending-coverage outcome exists. Invalid range input returns
the exact domain envelope with `ok=false,outcome='rejected',error.code=`
`invalid_order_set_definition`, persists that outcome for the new request, and
commits; it does not raise P0001 or roll back. The same return-and-commit rule applies to
new-request invalid_order_set_definition, order_set_member_unavailable,
child_revision_requires_refresh, revision_conflict, and order_set_review_obsolete
outcomes. A reused-key idempotency_conflict is explicitly excluded: the original
ledger row is left unchanged and the mismatch response is not a committed ledger
outcome. Only auth/internal failures may raise/rollback.

The current eight-column workspace order-catalog search referred to in review
notes as `clair_search_workspace_order_catalog` is named in this repository
`public.clair_list_order_catalog_chart_search(text)`
(`supabase/migrations/20260527090000_order_catalog_chart_search_rpc.sql:5-88`);
there is no second function with the shorthand name. B2 **forward-replaces
that exact function** with an atomic-only query while preserving its exact
eight-column `RETURNS TABLE` signature, `security invoker` ACL, and existing
consumer types. The B2 migration must execute this ordered sequence:

```sql
drop function if exists public.clair_list_order_catalog_chart_search(text);
create function public.clair_list_order_catalog_chart_search(p_workspace_id text)
returns table (
  row_type text, source_preset_id text, source_preset_version text,
  display_name text, billing_name text, category_group text,
  target_species text[], applied_snapshot jsonb
)
language sql security invoker set search_path = public
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
revoke all on function public.clair_list_order_catalog_chart_search(text)
  from public, anon, service_role;
grant execute on function public.clair_list_order_catalog_chart_search(text)
  to authenticated;
comment on function public.clair_list_order_catalog_chart_search(text) is
  'DEN-299 workspace-scoped atomic-only chart catalog search RPC used by live chart confirmation snapshot resolution.';
```

The SQL must not read `public.order_sets` or `order_set_revisions`, and the
forward migration/test must assert that active B2 sum and fixed sets are absent
while active atomic rows remain byte-for-byte compatible with the existing
mapper. B2 does not expose a nullable set row through the shared chart RPC;
`AppliedOrderSnapshot` and all current chart consumers remain unchanged. The
B2 chart regression owns the new migration and proves set expansion remains
`404`, set confirmation remains `unsupported_order_type`, and
`pending_review_count` is informational rather than a selection predicate.

The exact additive handoff is B3-owned and is documented here for review only;
no B2 migration or client file implements it. B3 adds a new function rather
than changing the existing one:

```sql
create function public.clair_list_order_catalog_chart_search_v2(
  p_workspace_id text
)
returns table (
  row_type text,
  source_preset_id text,
  source_preset_version text,
  display_name text,
  billing_name text,
  category_group text,
  target_species text[],
  applied_snapshot jsonb,
  source_set_id text,
  source_set_revision_id uuid,
  source_set_revision_no integer,
  source_set_amount_basis text,
  source_set_price_krw integer,
  source_set_range_basis text,
  source_set_tax_type text,
  source_set_availability_status text,
  source_set_needs_composition_review boolean,
  source_set_validation_status text,
  source_set_price_ranges jsonb,
  source_set_pending_review_count integer
)
language sql security invoker
set search_path = public;
```

SQL `RETURNS TABLE` does not accept column-level `NOT NULL`; B3 therefore
asserts at query level that the first eight columns are non-null and that every
`source_set_*` column is nullable exactly as named above.

B3 grants exactly `REVOKE ALL ON FUNCTION
public.clair_list_order_catalog_chart_search_v2(text) FROM public, anon,
service_role; GRANT EXECUTE ON FUNCTION
public.clair_list_order_catalog_chart_search_v2(text) TO authenticated;` and
adds the comment `DEN-299 workspace-scoped chart catalog search RPC used by
live chart confirmation snapshot resolution.` only to the new function. If a
future B3 decision instead replaces the old function, its migration must first
capture this exact existing eight-column return table, execute
`REVOKE ALL ON FUNCTION public.clair_list_order_catalog_chart_search(text) FROM
public, anon, service_role; DROP FUNCTION
public.clair_list_order_catalog_chart_search(text);`, recreate the old eight
columns plus the nullable `source_set_*` columns above with the same
`security invoker`, `set search_path = public`, comment, and authenticated
grant, and prove the fixed signature before changing any consumer. That
drop/recreate/grant sequence is B3-only and is not an allowed B2 edit.

For the additive B3 row, the SQL aliases map exactly:
`source_set_id -> sourceSetId`, `source_set_revision_id -> sourceSetRevisionId`,
`source_set_revision_no -> sourceSetRevisionNo`,
`source_set_amount_basis -> sourceSetAmountBasis`,
`source_set_price_krw -> sourceSetPriceKrw`,
`source_set_range_basis -> sourceSetRangeBasis`,
`source_set_tax_type -> sourceSetTaxType`,
`source_set_availability_status -> sourceSetAvailabilityStatus`,
`source_set_needs_composition_review -> sourceSetNeedsCompositionReview`,
`source_set_validation_status -> sourceSetValidationStatus`,
`source_set_price_ranges -> sourceSetPriceRanges`, and
`source_set_pending_review_count -> sourceSetPendingReviewCount`.
The TypeScript fields are exactly `string | null`, `string | null`,
`number | null`, the three-value amount-basis union or `null`, `number | null`,
the two-value range-basis union or `null`, the three-value tax union or `null`,
the three-value availability union or `null`, `boolean | null`, the
`'valid'|'invalid'` union or `null`, `OrderSetPriceRange[] | null`, and
`number | null`, respectively. `OrderSetPriceRange` is exactly
`{id: string; sortOrder: number; lowerBound: number; upperBound: number | null;
priceKrw: number}`. `source_set_price_ranges` is `[]` for fixed/sum and an
ordered array for range; each JSON element has exactly
`{"id":string,"sortOrder":positive integer,"lowerBound":number,"upperBound":number|null,"priceKrw":nonnegative integer}`.
Only `upperBound` may be null, and NULL prices stay NULL; no mapper coerces
NULL to zero or false.

B3's discriminated set projection is separate from `AppliedOrderSnapshot`:
its fixed mode maps set `priceKrw: integer` (zero means free) and set tax
`taxable|non_taxable`; sum maps set price `NULL`/tax `derived` and resolves
each flattened atomic child's current catalog price/tax (nonbillable NULL is
allowed); range maps set price `NULL` until B3 resolves an approved bracket and
uses set tax `taxable|non_taxable`. B3 owns all range selection and applied
price/tax snapshot writes. B2 does none.

The B3 lineage is a target delta, not existing B2 storage: B3 owns adding
`orders.source_set_revision_id uuid` and
`orders.source_set_revision_item_id uuid` plus their exact revision/revision-item
FKs and indexes. B2 writes neither encounter column. B3 maps the existing
`orders.source_set_id` to the stable set ID, maps existing text
`source_set_version` to `order-set-revision-<revision_no>` (the same value sent
as `sourcePresetVersion`), carries `sourceSetRevisionNo: integer` separately in
the B3 application context/snapshot, and records the exact expansion item in
B3's new `source_set_revision_item_id`. B3 also
copies current price/tax application snapshots into the existing applied
snapshot fields; B2 performs no fulfillment or billing execution.

The future B3 v2 function filters set rows to active, valid current revisions
with `needs_composition_review = false`; `pending_review_count` is informational
and never blocks selection. A child pointer advance therefore creates
review/notification without silently making the parent follow or appear
unselectable. Preserve the old `sourcePresetId` and `sourcePresetVersion`
fields. B2 exposes no revision-backed set row through the current chart RPC.
The expansion route remains 404 and chart
confirmation continues to return `unsupported_order_type` until B3;
`src/features/chart/module.tsx`, chart confirmation, fulfillment, billing,
`orders`, and service dual-write code are out of scope.

## Synthetic fixture, replay, and test matrix

The B2 fixture/replay is primary. It uses exactly two synthetic workspaces with
active members/admins, 20–40 atomic catalog items across the two workspaces, and
3–5 sets including sum, fixed, range, one child set, and one parent with exactly
one child-set layer. It includes atomic pins, exact child revision pins, explicit
numeric/zero/NULL prices, one unavailable billable member, and two child releases.
The range set uses the approved continuous coverage contract and is activated
only when its final open bracket and contiguous lower bounds pass validation.

Required checks:

1. valid direct atomic and one-level nested expansion, deterministic paths and
   order, default-selected propagation, quantity-source behavior, and exact
   `(catalog_item_id,catalog_revision)` lineage for every atomic pin;
2. self-reference/cycle, third-layer/depth, cross-workspace, unavailable or
   invalid member, billable-NULL member, and empty-active activation rejection;
3. direct duplicate and recursively duplicated atomic IDs are rejected with the
   exact deterministic expansion paths, rather than silently deduplicated;
4. the exact child revision triple is pinned and remains unchanged when the
   child current pointer advances; no child-pointer auto-follow occurs;
5. fixed/sum/range pricing, NULL versus zero, fixed bracket amounts, range
   bounds/order/overlap/reversed/open-final structural checks, continuous
   `[0,+infinity)` coverage, tax vocabulary, and quantity rules (including
   numeric `1`/`1.0` canonicalization and nested `fixed_one` rejection of
   values other than 1) pass;
6. every amount-basis transition creates a new immutable revision and clears or
   normalizes incompatible price/range fields before current-pointer save;
   previous revisions and their item/range rows remain unchanged;
7. child revision update → one pending review → newer target supersession →
   latest eligible accept → one new parent revision; before accepting, bump a
   direct parent atomic member and prove acceptance refreshes only that direct
   pin to the locked current revision. Nested atomic pins remain in the
   immutable accepted child revision: a usable-but-stale nested pin returns HTTP
   409 with `error.code = child_revision_requires_refresh`,
   `ok = false, outcome = 'superseded'`, immutable review-ledger
   `outcome = 'superseded'`, no result parent revision, and
   supersedes the review and sets notification resolution to `superseded`; the parent pointer/flag are
   unchanged and the parent remains selectable, requiring a separately saved
   newer child revision. An unusable nested member returns HTTP 422 with
   `error.code = order_set_member_unavailable`, the same `superseded`/`ok=false`
   envelope, immutable review-ledger `outcome = 'superseded'`, and no result
   parent revision, supersedes the review and sets
   notification resolution to `superseded`, leaves the reviewed parent pointer unchanged, and sets the
   flag on every exact-pinning current parent. A newer valid/active/usable child leaves every affected current
   parent selectable, while a paused/inactive/invalid/unusable exact child sets
   every affected parent flag and supersedes/resolves its ineligible review;
   pending_review_count is informational; obsolete accept rejects;
8. review dismiss leaves parent pointer unchanged and notification read/archive
   state unchanged;
9. metadata-preserving empty fields through trusted create/save/backfill with a
   valid zero-item paused/inactive revision, normal UUID ETag and ordinary CAS,
   common result envelopes with only `created|applied|accepted|dismissed` for
   `ok=true` and only `rejected|conflict|obsolete|superseded` for `ok=false`,
   committed validation outcomes, stale
   CAS, identical retry, changed-payload retry, actor mismatch, same UUID in
   another workspace, and two-admin concurrency with distinct requests asserting
   exactly one success and one revision_conflict;
10. old revision UPDATE/DELETE, stable/item/range/review direct DML denial,
    legacy item write denial, composite mismatch, and member-without-view denial;

11. A2/B1 availability pause/inactivate/invalid-or-billable-NULL mutation marks
    every current set containing that exact pinned member (and no unrelated
    set), while ordinary name/price/current-version changes remain future-only;
    a newer valid/active/usable child only creates/supersedes review and
    notification and leaves the parent selectable; a paused/inactive/invalid/
    unusable exact child marks every pinned current parent and resolves its
    ineligible review; `pending_review_count` never blocks; the flag cannot be
    cleared by a bare update; the two-session adoption oracle derives the
    complete distinct direct+nested affected ID set, rejects a missing unflagged
    affected set, and proves every nonmember pointer/flag preserves its baseline;
12. deterministic review/event identity, pending dedupe, supersession, accept,
    dismiss, safe URL/payload, and private notification resolution without unread
    bump or user-state deletion;
13. valid legacy included-sum backfill with each item pinned to current
   `catalog_revision`, native fixed seed, unsupported range, malformed,
   cross-workspace, duplicate, invalid quantity, member unavailable, member
   invalid, member billable NULL, and sum billing inconsistency; the
   `legacy_fixed_tax_unset`, `empty_active`, and mutually exclusive
   `empty_unavailable` quarantine classes; replay/idempotency, deterministic-ID
   collision, old `order_set_items` preservation, and a preflight assertion that
   no source row is unclassified;
14. fresh reset loads native seeds after migration and native seed writes never
    reintroduce authoritative mutable `order_set_items`;
15. B2 forward-replaced current eight-column chart RPC is atomic-only: active
    B2 sum/fixed sets are absent while active atomic rows remain, ACL/signature/
    consumer mapping remain exact, no set row reaches `AppliedOrderSnapshot`,
    chart set confirmation still returns `unsupported_order_type`, and no B3
    chart expansion, fulfillment, billing, or service dual-write behavior appears.

Allowed new/updated test files:

- `tests/clinical-master-phase1b2.spec.ts`;
- `tests/clinical-master-phase1b2-notifications.spec.ts`;
- `tests/hospital-admin-order-catalog-schema-migration.spec.ts`;
- `tests/clinical-master-phase1b2-chart-search-migration.spec.ts` (B2
  forward-replacement signature/ACL and atomic-only regression);
- `tests/hospital-admin-order-catalog-server.spec.ts`;
- `tests/hospital-admin.spec.ts`;
- `tests/chart-order-action-persistence-server.spec.ts` (preserve set rejection);
- `tests/demo-seed-inventory-readback-contract.spec.ts` (native seed readback);
- `docs/engineering/data-model/demo-seed-inventory-readback-contract.md`
  (native revision/item/current-pointer/projection oracle; replace stale direct
  legacy-count assertions);
- `supabase/snippets/demo_seed_inventory_readback.sql` (native revision/item,
  current-pointer, and compatibility-projection readback oracle);
- `supabase/seed.sql` (mandatory synthetic native adapter calls);
- `supabase/snippets/den-468-491_cheongdam_master_seed.sql` (mandatory
  synthetic native adapter calls).

`tests/chart-order-snapshot-bridge-migration.spec.ts` and any additive chart
search set-projection type/RPC test remain B3-owned future files, not B2
ownership. B2 owns only the atomic-only forward replacement and its regression;
set projection, expansion, and confirmation remain B3.

Seed ownership is mandatory because `supabase db reset` loads seeds after
migrations: both seed files call the named
`private.clair_seed_order_set_compatibility_projection` adapter above with
explicit validated synthetic actor `00000000-0000-4000-8000-000000000001`,
deterministic request IDs, and synthetic-only tax/price values. They never
write authoritative mutable `order_set_items`. The readback snippet and
`tests/demo-seed-inventory-readback-contract.spec.ts` assert native
`order_set_revisions`, `order_set_revision_items`, the stable current pointer,
and `source_set_version = 'order-set-revision-' || revision_no`; they do not
invoke a projection writer or use legacy-row counts as the oracle. Keep a
separate synthetic legacy fixture/replay path for backfill/quarantine coverage.
Native seed/replay coverage includes a valid continuous range definition for
`patient_weight_kg`; no no-match fixture is used because the approved contract
has complete nonnegative coverage.

## Exact verification commands

These commands are the implementation-worker verification sequence after all
predecessor gates. The runtime evidence recorded below is limited to commands
actually completed; an unlisted security/readback/browser result remains
unclaimed.

```bash
cd /Users/iseung-ug/project/emr-app-shell-prototype/.worktrees/clinical-master-phase1-active
git diff --check
npm run docs:check
node scripts/check-doc-links.mjs
node_modules/.bin/tsc --noEmit --pretty false
npm run lint
npm run build
npx --no-install playwright test \
  tests/clinical-master-phase1a1.spec.ts \
  tests/clinical-master-phase1a2.spec.ts \
  tests/clinical-master-phase1a2-notifications.spec.ts \
  tests/clinical-master-phase1a3.spec.ts \
  tests/clinical-master-phase1b1.spec.ts \
  tests/clinical-master-phase1b2.spec.ts \
  tests/clinical-master-phase1b2-notifications.spec.ts \
  tests/clinical-master-phase1b2-chart-search-migration.spec.ts \
  tests/hospital-admin-order-catalog-schema-migration.spec.ts \
  tests/hospital-admin-order-catalog-server.spec.ts \
  tests/lab-result-entry-persistence-contract.spec.ts \
  tests/lab-imaging.spec.ts \
  tests/lab-result-entry-notification-server.spec.ts \
  tests/hospital-admin.spec.ts \
  tests/chart.spec.ts \
  tests/chart-order-draft-persistence-server.spec.ts \
  tests/chart-order-action-persistence-server.spec.ts \
  tests/chart-order-snapshot-bridge-migration.spec.ts \
  tests/fulfillment-work-item-server.spec.ts \
  tests/fulfillment-handoff-replay.spec.ts \
  tests/billing-invoice-candidate-sync-server.spec.ts \
  tests/billing-invoice-line-persistence-server.spec.ts \
  tests/billing.spec.ts \
  tests/notification-persistence-contract.spec.ts \
  tests/workspace-membership-rls-migration.spec.ts \
  tests/ui-demo-api-wiring-e2e.spec.ts \
  tests/api-boundary-permission-regression.spec.ts \
  tests/server-permission-enforcement.spec.ts \
  tests/permission-resolver.spec.ts \
  tests/demo-seed-inventory-readback-contract.spec.ts \
  --project=chromium
# Never fall back to an undefined or remote URL. Parse and unquote DB_URL from
# the local Supabase CLI, export it only after validating a localhost host.
set -eu
local_status_env="$(npx supabase@2.115.0 status --output env)"
SUPABASE_LOCAL_DB_URL="$(printf '%s\n' "$local_status_env" | sed -n 's/^DB_URL=//p' | head -n 1 | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")"
unset local_status_env
: "${SUPABASE_LOCAL_DB_URL:?SUPABASE_LOCAL_DB_URL is required}"
case "$SUPABASE_LOCAL_DB_URL" in
  postgresql://*@localhost:*|postgresql://*@127.0.0.1:*|postgresql://*@\[::1\]:*) ;;
  *) echo 'SUPABASE_LOCAL_DB_URL must point to localhost' >&2; exit 1 ;;
esac
export SUPABASE_LOCAL_DB_URL
npx supabase@2.115.0 db reset --local
npm run demo:seed:check -- --readback
psql "$SUPABASE_LOCAL_DB_URL" --username=postgres -v ON_ERROR_STOP=1 \
  -f supabase/snippets/clinical_master_phase1b2_replay.sql
```

### Required two-session barriers

These barriers run only after a fresh local reset and replay. They use the guarded
SUPABASE_LOCAL_DB_URL from the verification section and never use a remote host,
an undefined URL, psql --role, or pg_sleep. Every public writer session starts
as local postgres, executes SET LOCAL ROLE authenticated in its transaction, and
sets JWT claims for an active synthetic administrator. The adoption session is a
separate local postgres owner connection and never switches to authenticated.
The observer is local postgres with pg_monitor in a read-only transaction.

#### Exact session variables and guarded URL

Export values from the fresh replay readback before opening terminals. With
set -u enabled, each colon expansion fails closed if a value is missing:

    set -eu
    : "${WORKSPACE_ID:?WORKSPACE_ID is required}"
    : "${ORDER_SET_ID:?ORDER_SET_ID is required}"
    : "${BASE_REVISION_ID:?BASE_REVISION_ID is required}"
    : "${CHILD_ORDER_SET_ID:?CHILD_ORDER_SET_ID is required}"
    : "${CHILD_REVISION_ID:?CHILD_REVISION_ID is required}"
    : "${PARENT_REVISION_ID:?PARENT_REVISION_ID is required}"
    : "${REVIEW_ID:?REVIEW_ID is required}"
    : "${DEFINITION_JSON:?DEFINITION_JSON is required}"
    : "${REQUEST_A_UUID:?REQUEST_A_UUID is required}"
    : "${REQUEST_B_UUID:?REQUEST_B_UUID is required}"
    : "${ACTOR_A_UUID:?ACTOR_A_UUID is required}"
    : "${ACTOR_B_UUID:?ACTOR_B_UUID is required}"
    : "${ITEM_ID:?ITEM_ID is required}"
    : "${EXPECTED_CATALOG_REVISION:?EXPECTED_CATALOG_REVISION is required}"
    : "${PATCH_JSON:?PATCH_JSON is required}"
    : "${ACTOR_C_UUID:?ACTOR_C_UUID is required}"
    : "${RELEASE_ID:?RELEASE_ID is required}"
    : "${EXPECTED_AFFECTED_IDS:?EXPECTED_AFFECTED_IDS is required}"              # comma-separated, non-empty
    : "${EXPECTED_AFFECTED_BASE_POINTERS:?EXPECTED_AFFECTED_BASE_POINTERS is required}"    # same order as IDs
    : "${EXPECTED_AFFECTED_BASE_FLAGS:?EXPECTED_AFFECTED_BASE_FLAGS is required}"       # same order; every value is false
    : "${EXPECTED_UNAFFECTED_IDS:?EXPECTED_UNAFFECTED_IDS is required}"            # comma-separated, non-empty control set
    : "${EXPECTED_UNAFFECTED_BASE_POINTERS:?EXPECTED_UNAFFECTED_BASE_POINTERS is required}"  # same order as IDs
    : "${EXPECTED_UNAFFECTED_BASE_FLAGS:?EXPECTED_UNAFFECTED_BASE_FLAGS is required}"     # same order as IDs
    : "${BASE_REVISION_COUNT:?BASE_REVISION_COUNT is required}"
    : "${PRE_REVISION_IDS:?PRE_REVISION_IDS is required}"                   # comma-separated historical IDs

Parse and unquote DB_URL without eval, then reject every non-local host. The
format string has exactly one backslash before n:

    set -eu
    local_status_env="$(npx supabase@2.115.0 status --output env)"
    db_url_line="$(printf '%s\n' "$local_status_env" | awk -F= '$1 == "DB_URL" { print; exit }')"
    unset local_status_env
    db_url_value="$(printf '%s\n' "$db_url_line" | sed -e 's/^DB_URL=//' -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")"
    : "${db_url_value:?SUPABASE_LOCAL_DB_URL is required}"
    case "$db_url_value" in
      postgresql://*@localhost:*|postgresql://*@127.0.0.1:*|postgresql://*@\[::1\]:*) ;;
      *) echo 'SUPABASE_LOCAL_DB_URL must point to localhost' >&2; exit 1 ;;
    esac
    export SUPABASE_LOCAL_DB_URL="$db_url_value"

#### Save/save CAS: terminals A and B

Terminal A is a public authenticated writer. Start it with every value passed
through the same uppercase psql variable name, leave the transaction open, and
record the printed backend PID as SESSION_A_PID:

    psql "$SUPABASE_LOCAL_DB_URL" --username=postgres -X -v ON_ERROR_STOP=1 \
      -v WORKSPACE_ID="$WORKSPACE_ID" -v ORDER_SET_ID="$ORDER_SET_ID" \
      -v BASE_REVISION_ID="$BASE_REVISION_ID" -v DEFINITION_JSON="$DEFINITION_JSON" \
      -v REQUEST_A_UUID="$REQUEST_A_UUID" -v ACTOR_A_UUID="$ACTOR_A_UUID"

    begin;
    set local role authenticated;
    select set_config('request.jwt.claim.role','authenticated',true);
    select set_config('request.jwt.claim.sub',:'ACTOR_A_UUID',true);
    select pg_backend_pid() as session_a_pid;
    select public.clair_save_order_set_revision(
      :'WORKSPACE_ID', :'ORDER_SET_ID', :'BASE_REVISION_ID'::uuid,
      :'DEFINITION_JSON'::jsonb, 'active', :'REQUEST_A_UUID'::uuid
    );
    -- do not commit until the observer proves B is waiting

Terminal B uses the same base and definition, a distinct request UUID, and a
different active administrator. Record SESSION_B_PID before its RPC:

    psql "$SUPABASE_LOCAL_DB_URL" --username=postgres -X -v ON_ERROR_STOP=1 \
      -v WORKSPACE_ID="$WORKSPACE_ID" -v ORDER_SET_ID="$ORDER_SET_ID" \
      -v BASE_REVISION_ID="$BASE_REVISION_ID" -v DEFINITION_JSON="$DEFINITION_JSON" \
      -v REQUEST_B_UUID="$REQUEST_B_UUID" -v ACTOR_B_UUID="$ACTOR_B_UUID"

    begin;
    set local role authenticated;
    select set_config('request.jwt.claim.role','authenticated',true);
    select set_config('request.jwt.claim.sub',:'ACTOR_B_UUID',true);
    select pg_backend_pid() as session_b_pid;
    select public.clair_save_order_set_revision(
      :'WORKSPACE_ID', :'ORDER_SET_ID', :'BASE_REVISION_ID'::uuid,
      :'DEFINITION_JSON'::jsonb, 'active', :'REQUEST_B_UUID'::uuid
    );
    -- this call must remain blocked until A commits

The observer is a third local read-only connection. It injects PIDs before the
dollar-quoted DO; the DO reads current_setting and contains no psql variable:

    psql "$SUPABASE_LOCAL_DB_URL" --username=postgres -X -v ON_ERROR_STOP=1 \
      -v SESSION_A_PID="$SESSION_A_PID" -v SESSION_B_PID="$SESSION_B_PID"

    begin;
    set transaction read only;
    set local role pg_monitor;
    select pg_backend_pid() as observer_pid;
    select set_config('clair.test.session_a_pid',:'SESSION_A_PID',true);
    select set_config('clair.test.session_b_pid',:'SESSION_B_PID',true);
    do $assert$
    declare
      v_a integer := current_setting('clair.test.session_a_pid')::integer;
      v_b integer := current_setting('clair.test.session_b_pid')::integer;
      v_wait_event text;
      v_blockers integer[];
    begin
      select a.wait_event_type, pg_blocking_pids(a.pid)
        into v_wait_event, v_blockers
      from pg_stat_activity a
      where a.pid = v_b and a.pid <> pg_backend_pid()
        and a.datname = current_database();
      if v_wait_event <> 'Lock'
         or v_blockers is null
         or not (v_a = any(v_blockers)) then
        raise exception 'save/save barrier: B is not blocked by A';
      end if;
    end $assert$;
    commit;

Commit A, allow B to return, verify its response is exactly
ok=false, outcome=conflict, error.code=revision_conflict, then commit B. Because
the request UUIDs differ, B must never return an idempotent outcome.

Run this post-commit oracle as local postgres. It binds the resulting revision to
the `result_revision_id` stored by A's ledger row, compares the captured
pre/post historical count, and checks that the only new ID is that result (so no
loser revision is orphaned). Every failed assertion raises an exception:

    psql "$SUPABASE_LOCAL_DB_URL" --username=postgres -X -v ON_ERROR_STOP=1 \
      -v WORKSPACE_ID="$WORKSPACE_ID" -v ORDER_SET_ID="$ORDER_SET_ID" \
      -v BASE_REVISION_ID="$BASE_REVISION_ID" \
      -v REQUEST_A_UUID="$REQUEST_A_UUID" -v REQUEST_B_UUID="$REQUEST_B_UUID" \
      -v BASE_REVISION_COUNT="$BASE_REVISION_COUNT" \
      -v PRE_REVISION_IDS="$PRE_REVISION_IDS"

    begin;
    set transaction read only;
    select set_config('clair.test.workspace_id',:'WORKSPACE_ID',true);
    select set_config('clair.test.order_set_id',:'ORDER_SET_ID',true);
    select set_config('clair.test.base_revision_id',:'BASE_REVISION_ID',true);
    select set_config('clair.test.request_a_uuid',:'REQUEST_A_UUID',true);
    select set_config('clair.test.request_b_uuid',:'REQUEST_B_UUID',true);
    select set_config('clair.test.base_revision_count',:'BASE_REVISION_COUNT',true);
    select set_config('clair.test.pre_revision_ids',:'PRE_REVISION_IDS',true);
    do $assert$
    declare
      v_workspace text := current_setting('clair.test.workspace_id');
      v_order_set text := current_setting('clair.test.order_set_id');
      v_base uuid := current_setting('clair.test.base_revision_id')::uuid;
      v_a uuid := current_setting('clair.test.request_a_uuid')::uuid;
      v_b uuid := current_setting('clair.test.request_b_uuid')::uuid;
      v_base_revision_count integer :=
        current_setting('clair.test.base_revision_count')::integer;
      v_pre_revision_ids text[] :=
        string_to_array(current_setting('clair.test.pre_revision_ids'), ',');
      v_applied integer;
      v_conflict integer;
      v_result_revision uuid;
      v_result_pointer uuid;
      v_revision_count integer;
      v_new_revision_ids text[];
      v_pointer uuid;
      v_source_version text;
      v_revision_no integer;
      v_b_result uuid;
    begin
      if cardinality(v_pre_revision_ids) <> v_base_revision_count then
        raise exception 'pre-revision ID snapshot does not match its count';
      end if;
      select count(*) into v_applied
      from private.order_set_revision_save_requests
      where workspace_id = v_workspace and request_id = v_a
        and outcome = 'applied';
      select count(*) into v_conflict
      from private.order_set_revision_save_requests
      where workspace_id = v_workspace and request_id = v_b
        and outcome = 'conflict'
        and result_envelope #>> '{error,code}' = 'revision_conflict';
      if v_applied <> 1 or v_conflict <> 1 then
        raise exception 'save/save outcomes are not exactly applied + revision_conflict';
      end if;
      select result_revision_id, result_current_revision_id
        into v_result_revision, v_result_pointer
      from private.order_set_revision_save_requests
      where workspace_id = v_workspace and request_id = v_a;
      if v_result_revision is null or v_result_pointer is null
         or v_result_revision <> v_result_pointer then
        raise exception 'applied ledger does not identify one resulting revision/pointer';
      end if;
      select count(*) into v_revision_count
      from public.order_set_revisions
      where workspace_id = v_workspace and order_set_id = v_order_set
        and id = v_result_revision;
      if v_revision_count <> 1 then
        raise exception 'ledger result_revision_id does not identify exactly one revision';
      end if;
      select count(*) into v_revision_count
      from public.order_set_revisions
      where workspace_id = v_workspace and order_set_id = v_order_set;
      if v_revision_count <> v_base_revision_count + 1 then
        raise exception 'save/save revision count is not exactly one beyond known base';
      end if;
      select array_agg(r.id::text order by r.id::text)
        into v_new_revision_ids
      from public.order_set_revisions r
      where r.workspace_id = v_workspace and r.order_set_id = v_order_set
        and not (r.id::text = any(v_pre_revision_ids));
      if v_new_revision_ids is distinct from array[v_result_revision::text] then
        raise exception 'save/save produced an orphan loser revision: %',
          coalesce(v_new_revision_ids::text, '<none>');
      end if;
      select result_revision_id into v_b_result
      from private.order_set_revision_save_requests
      where workspace_id = v_workspace and request_id = v_b;
      if v_b_result is not null then
        raise exception 'revision_conflict unexpectedly created a revision';
      end if;
      select current_revision_id into v_pointer
      from public.order_sets
      where workspace_id = v_workspace and id = v_order_set;
      if v_pointer <> v_result_pointer then
        raise exception 'current pointer does not equal applied ledger result pointer';
      end if;
      select revision_no into v_revision_no
      from public.order_set_revisions
      where workspace_id = v_workspace and id = v_result_revision;
      select source_set_version into v_source_version
      from public.order_sets
      where workspace_id = v_workspace and id = v_order_set;
      if v_source_version <> 'order-set-revision-' || v_revision_no::text then
        raise exception 'compatibility projection does not match ledger result revision';
      end if;
      if v_result_revision = v_base then
        raise exception 'applied result revision reused the expected base';
      end if;
    end $assert$;
    commit;

The same request A replay must return the stored envelope byte-for-byte. Reusing
A's UUID with another actor or payload returns response-only idempotency_conflict;
it leaves A's original ledger row unchanged. Only a distinct request UUID can
commit a domain rejection or revision conflict.

#### Child advance/review barrier

Use the same terminal A/B invocation shape, replacing the RPC target with the
child save and review-resolution RPCs and passing CHILD_ORDER_SET_ID,
CHILD_REVISION_ID, PARENT_REVISION_ID, REVIEW_ID, and distinct review request
UUIDs through -v. The observer and set_config/current_setting barrier above is
unchanged. After A commits, a newer valid/active/usable child yields exactly one
pending latest review/event and leaves every exact-pinning parent selectable.
Acceptance changes only direct parent atomic pins. A nested usable-but-stale pin
must return the committed child_revision_requires_refresh outcome, supersede and
resolve its review/notification, leave the parent unchanged, and require a
separately saved newer child revision. A nested unusable pin uses the existing
composition-block branch. Assert these outcomes in a DO block with RAISE
EXCEPTION for every mismatch; do not use a bare boolean SELECT.

#### A2/B1 catalog availability/adoption barrier

Session C is the authenticated public catalog writer. Session D is a separate
owner-only private adoption writer. Capture both backend PIDs while their
transactions remain open:

    psql "$SUPABASE_LOCAL_DB_URL" --username=postgres -X -v ON_ERROR_STOP=1 \
      -v WORKSPACE_ID="$WORKSPACE_ID" -v ITEM_ID="$ITEM_ID" \
      -v EXPECTED_CATALOG_REVISION="$EXPECTED_CATALOG_REVISION" \
      -v PATCH_JSON="$PATCH_JSON" -v ACTOR_C_UUID="$ACTOR_C_UUID"

    begin;
    set local role authenticated;
    select set_config('request.jwt.claim.role','authenticated',true);
    select set_config('request.jwt.claim.sub',:'ACTOR_C_UUID',true);
    select pg_backend_pid() as session_c_pid;
    select public.clair_update_order_catalog_item(
      :'WORKSPACE_ID', :'ITEM_ID', :'EXPECTED_CATALOG_REVISION'::integer,
      :'PATCH_JSON'::jsonb
    );
    -- do not commit until the observer proves the overlap

D is local postgres with no SET LOCAL ROLE and no authenticated grant:

    psql "$SUPABASE_LOCAL_DB_URL" --username=postgres -X -v ON_ERROR_STOP=1 \
      -v WORKSPACE_ID="$WORKSPACE_ID" -v RELEASE_ID="$RELEASE_ID"

    begin;
    select pg_backend_pid() as session_d_pid;
    select private.clair_adopt_lab_master_projection_to_workspace(
      :'WORKSPACE_ID', :'RELEASE_ID'::uuid
    );
    -- do not commit until the observer proves the overlap

The observer receives only the two captured PIDs. It injects them through
set_config before the DO, excludes its own PID, and requires exactly one of the
two target backends to wait on a lock held by the other:

    psql "$SUPABASE_LOCAL_DB_URL" --username=postgres -X -v ON_ERROR_STOP=1 \
      -v SESSION_C_PID="$SESSION_C_PID" -v SESSION_D_PID="$SESSION_D_PID"

    begin;
    set transaction read only;
    set local role pg_monitor;
    select pg_backend_pid() as observer_pid;
    select set_config('clair.test.session_c_pid',:'SESSION_C_PID',true);
    select set_config('clair.test.session_d_pid',:'SESSION_D_PID',true);
    do $assert$
    declare
      v_c integer := current_setting('clair.test.session_c_pid')::integer;
      v_d integer := current_setting('clair.test.session_d_pid')::integer;
      v_waiters integer := 0;
      v_blocker_count integer := 0;
      v_targets integer[] := array[v_c,v_d];
    begin
      select count(*) into v_waiters
      from pg_stat_activity a
      where a.pid = any(v_targets) and a.pid <> pg_backend_pid()
        and a.wait_event_type = 'Lock'
        and cardinality(pg_blocking_pids(a.pid)) > 0;
      select count(*) into v_blocker_count
      from pg_stat_activity a
      where a.pid = any(v_targets) and a.pid <> pg_backend_pid()
        and cardinality(pg_blocking_pids(a.pid)) > 0
        and (pg_blocking_pids(a.pid) && v_targets);
      if v_waiters <> 1 or v_blocker_count <> 1 then
        raise exception 'catalog/adoption barrier has no exact one-way blocker';
      end if;
    end $assert$;
    commit;

Commit C and D only after this observer assertion. Repeat the same protocol for
the B1 public lab writer and the exact owner-only
`private.clair_adopt_lab_master_projection_to_workspace(text,uuid)` function
from the gated B1 contract; no private helper receives authenticated EXECUTE.

Before opening sessions C and D, run a read-only preflight against the fresh
replay. It derives the complete distinct affected set-ID array from the current
revision's direct and exact-pinned one-level nested atomic rows, sorts it, and
requires exact equality with the normalized `EXPECTED_AFFECTED_IDS`; the same
readback emits all baseline pointer/flag arrays in that sorted order. This is
the source of truth before the mutation, not a hand-selected affected set. It
fails if any affected/nonmember ID lacks its baseline pointer or flag, and every
affected baseline flag must be `false` before sessions C/D open:

    psql "$SUPABASE_LOCAL_DB_URL" --username=postgres -X -v ON_ERROR_STOP=1 \
      -v WORKSPACE_ID="$WORKSPACE_ID" -v ITEM_ID="$ITEM_ID" \
      -v EXPECTED_AFFECTED_IDS="$EXPECTED_AFFECTED_IDS" \
      -v EXPECTED_AFFECTED_BASE_POINTERS="$EXPECTED_AFFECTED_BASE_POINTERS" \
      -v EXPECTED_AFFECTED_BASE_FLAGS="$EXPECTED_AFFECTED_BASE_FLAGS" \
      -v EXPECTED_UNAFFECTED_IDS="$EXPECTED_UNAFFECTED_IDS" \
      -v EXPECTED_UNAFFECTED_BASE_POINTERS="$EXPECTED_UNAFFECTED_BASE_POINTERS" \
      -v EXPECTED_UNAFFECTED_BASE_FLAGS="$EXPECTED_UNAFFECTED_BASE_FLAGS"

    begin;
    set transaction read only;
    select set_config('clair.test.workspace_id',:'WORKSPACE_ID',true);
    select set_config('clair.test.item_id',:'ITEM_ID',true);
    select set_config('clair.test.expected_affected_ids',:'EXPECTED_AFFECTED_IDS',true);
    select set_config('clair.test.expected_affected_pointers',:'EXPECTED_AFFECTED_BASE_POINTERS',true);
    select set_config('clair.test.expected_affected_flags',:'EXPECTED_AFFECTED_BASE_FLAGS',true);
    select set_config('clair.test.expected_unaffected_ids',:'EXPECTED_UNAFFECTED_IDS',true);
    select set_config('clair.test.expected_unaffected_pointers',:'EXPECTED_UNAFFECTED_BASE_POINTERS',true);
    select set_config('clair.test.expected_unaffected_flags',:'EXPECTED_UNAFFECTED_BASE_FLAGS',true);
    do $assert$
    declare
      v_workspace text := current_setting('clair.test.workspace_id');
      v_item text := current_setting('clair.test.item_id');
      v_raw_expected text[] :=
        string_to_array(current_setting('clair.test.expected_affected_ids'), ',');
      v_expected_pointers text[] :=
        string_to_array(current_setting('clair.test.expected_affected_pointers'), ',');
      v_expected_flags text[] :=
        string_to_array(current_setting('clair.test.expected_affected_flags'), ',');
      v_raw_unaffected text[] :=
        string_to_array(current_setting('clair.test.expected_unaffected_ids'), ',');
      v_unaffected_pointers text[] :=
        string_to_array(current_setting('clair.test.expected_unaffected_pointers'), ',');
      v_unaffected_flags text[] :=
        string_to_array(current_setting('clair.test.expected_unaffected_flags'), ',');
      v_expected text[];
      v_expected_unaffected text[];
      v_actual text[];
      v_all_set_ids text[];
      v_expected_workspace_ids text[];
      v_id text;
      v_pointer text;
      v_flag boolean;
      v_expected_pointer text;
      v_expected_flag text;
    begin
      select array_agg(x.id order by x.id)
        into v_expected
      from (
        select distinct u.id
        from unnest(v_raw_expected) as u(id)
        where u.id <> ''
      ) x;
      select array_agg(x.id order by x.id)
        into v_expected_unaffected
      from (
        select distinct u.id
        from unnest(v_raw_unaffected) as u(id)
        where u.id <> ''
      ) x;
      if v_raw_expected is null or cardinality(v_raw_expected) = 0
         or v_expected is null
         or cardinality(v_expected) <> cardinality(v_raw_expected)
         or v_expected is distinct from v_raw_expected
         or v_expected_unaffected is null
         or v_expected_unaffected is distinct from v_raw_unaffected
         or cardinality(v_expected) <> cardinality(v_expected_pointers)
         or cardinality(v_expected) <> cardinality(v_expected_flags)
         or cardinality(v_expected_unaffected) <> cardinality(v_unaffected_pointers)
         or cardinality(v_expected_unaffected) <> cardinality(v_unaffected_flags) then
        raise exception 'EXPECTED_AFFECTED_IDS must be non-empty, distinct, and sorted';
      end if;
      if exists (select 1 from unnest(v_expected_flags) as f(value)
                 where value <> 'false') then
        raise exception 'affected baseline flags must all be false';
      end if;
      select array_agg(s.id order by s.id)
        into v_all_set_ids
      from public.order_sets s
      where s.workspace_id = v_workspace;
      select array_agg(x.id order by x.id)
        into v_expected_workspace_ids
      from (
        select distinct u.id
        from unnest(v_expected || v_expected_unaffected) as u(id)
      ) x;
      if v_all_set_ids is distinct from v_expected_workspace_ids
         or (v_expected && v_expected_unaffected) then
        raise exception 'baseline affected/nonmember IDs are not a complete partition';
      end if;
      for v_id, v_expected_pointer, v_expected_flag in
        select x.id, x.pointer, x.flag
        from unnest(v_expected, v_expected_pointers, v_expected_flags)
          as x(id, pointer, flag)
      loop
        select current_revision_id::text, needs_composition_review
          into v_pointer, v_flag
        from public.order_sets
        where workspace_id = v_workspace and id = v_id;
        if not found or v_pointer is distinct from v_expected_pointer
           or v_flag is distinct from v_expected_flag::boolean
           or v_flag is not false then
          raise exception 'affected baseline pointer/flag mismatch for %', v_id;
        end if;
      end loop;
      for v_id, v_expected_pointer, v_expected_flag in
        select x.id, x.pointer, x.flag
        from unnest(v_expected_unaffected, v_unaffected_pointers, v_unaffected_flags)
          as x(id, pointer, flag)
      loop
        select current_revision_id::text, needs_composition_review
          into v_pointer, v_flag
        from public.order_sets
        where workspace_id = v_workspace and id = v_id;
        if not found or v_pointer is distinct from v_expected_pointer
           or v_flag is distinct from v_expected_flag::boolean then
          raise exception 'nonmember baseline pointer/flag mismatch for %', v_id;
        end if;
      end loop;
      with current_atomic_pins as (
        select s.id::text as order_set_id, i.child_order_catalog_item_id
        from public.order_sets s
        join public.order_set_revision_items i
          on i.workspace_id = s.workspace_id
         and i.order_set_revision_id = s.current_revision_id
        where s.workspace_id = v_workspace and i.child_kind = 'order'
        union
        select parent.id::text, nested.child_order_catalog_item_id
        from public.order_sets parent
        join public.order_set_revision_items parent_item
          on parent_item.workspace_id = parent.workspace_id
         and parent_item.order_set_revision_id = parent.current_revision_id
        join public.order_set_revisions child_revision
          on child_revision.workspace_id = parent_item.workspace_id
         and child_revision.order_set_id = parent_item.child_order_set_id
         and child_revision.id = parent_item.child_set_revision_id
        join public.order_set_revision_items nested
          on nested.workspace_id = child_revision.workspace_id
         and nested.order_set_revision_id = child_revision.id
        where parent.workspace_id = v_workspace
          and parent_item.child_kind = 'set_revision'
          and nested.child_kind = 'order'
      )
      select array_agg(p.order_set_id order by p.order_set_id)
        into v_actual
      from current_atomic_pins p
      where p.child_order_catalog_item_id = v_item;
      if v_actual is distinct from v_expected then
        raise exception 'affected set preflight mismatch: actual %, expected %',
          v_actual, v_expected;
      end if;
    end $assert$;
    commit;

Run this exact post-commit adoption oracle with comma-separated arrays exported
from that preflight/readback: `EXPECTED_AFFECTED_IDS`,
`EXPECTED_AFFECTED_BASE_POINTERS`, and `EXPECTED_AFFECTED_BASE_FLAGS` are
same-order arrays for every affected set (all pre-flags must be `false`), while
`EXPECTED_UNAFFECTED_IDS`, `EXPECTED_UNAFFECTED_BASE_POINTERS`, and
`EXPECTED_UNAFFECTED_BASE_FLAGS` cover every unaffected control set. It proves
all-and-only the expected exact-pinning sets changed; it does not assume one
unrelated set. Every failure raises an exception:

    psql "$SUPABASE_LOCAL_DB_URL" --username=postgres -X -v ON_ERROR_STOP=1 \
      -v WORKSPACE_ID="$WORKSPACE_ID" -v ITEM_ID="$ITEM_ID" \
      -v EXPECTED_AFFECTED_IDS="$EXPECTED_AFFECTED_IDS" \
      -v EXPECTED_AFFECTED_BASE_POINTERS="$EXPECTED_AFFECTED_BASE_POINTERS" \
      -v EXPECTED_AFFECTED_BASE_FLAGS="$EXPECTED_AFFECTED_BASE_FLAGS" \
      -v EXPECTED_UNAFFECTED_IDS="$EXPECTED_UNAFFECTED_IDS" \
      -v EXPECTED_UNAFFECTED_BASE_POINTERS="$EXPECTED_UNAFFECTED_BASE_POINTERS" \
      -v EXPECTED_UNAFFECTED_BASE_FLAGS="$EXPECTED_UNAFFECTED_BASE_FLAGS"

    begin;
    set transaction read only;
    select set_config('clair.test.workspace_id',:'WORKSPACE_ID',true);
    select set_config('clair.test.item_id',:'ITEM_ID',true);
    select set_config('clair.test.expected_affected_ids',:'EXPECTED_AFFECTED_IDS',true);
    select set_config('clair.test.expected_affected_pointers',:'EXPECTED_AFFECTED_BASE_POINTERS',true);
    select set_config('clair.test.expected_affected_flags',:'EXPECTED_AFFECTED_BASE_FLAGS',true);
    select set_config('clair.test.expected_unaffected_ids',:'EXPECTED_UNAFFECTED_IDS',true);
    select set_config('clair.test.expected_unaffected_pointers',:'EXPECTED_UNAFFECTED_BASE_POINTERS',true);
    select set_config('clair.test.expected_unaffected_flags',:'EXPECTED_UNAFFECTED_BASE_FLAGS',true);
    do $assert$
    declare
      v_workspace text := current_setting('clair.test.workspace_id');
      v_item text := current_setting('clair.test.item_id');
      v_affected_ids text[] :=
        string_to_array(current_setting('clair.test.expected_affected_ids'), ',');
      v_affected_pointers text[] :=
        string_to_array(current_setting('clair.test.expected_affected_pointers'), ',');
      v_affected_flags text[] :=
        string_to_array(current_setting('clair.test.expected_affected_flags'), ',');
      v_unaffected_ids text[] :=
        string_to_array(current_setting('clair.test.expected_unaffected_ids'), ',');
      v_unaffected_pointers text[] :=
        string_to_array(current_setting('clair.test.expected_unaffected_pointers'), ',');
      v_unaffected_flags text[] :=
        string_to_array(current_setting('clair.test.expected_unaffected_flags'), ',');
      v_expected_affected_ids text[];
      v_expected_unaffected_ids text[];
      v_actual_affected_ids text[];
      v_actual_unaffected_ids text[];
      v_all_set_ids text[];
      v_expected_workspace_ids text[];
      v_id text;
      v_expected_pointer text;
      v_expected_flag text;
      v_pointer uuid;
      v_flag boolean;
      v_found integer;
      v_unexpected integer;
    begin
      select array_agg(x.id order by x.id)
        into v_expected_affected_ids
      from (
        select distinct u.id
        from unnest(v_affected_ids) as u(id)
        where u.id <> ''
      ) x;
      select array_agg(x.id order by x.id)
        into v_expected_unaffected_ids
      from (
        select distinct u.id
        from unnest(v_unaffected_ids) as u(id)
        where u.id <> ''
      ) x;
      if v_expected_affected_ids is null
         or v_expected_unaffected_ids is null
         or cardinality(v_expected_affected_ids) <> cardinality(v_affected_ids)
         or cardinality(v_expected_unaffected_ids) <> cardinality(v_unaffected_ids)
         or v_expected_affected_ids is distinct from v_affected_ids
         or v_expected_unaffected_ids is distinct from v_unaffected_ids then
        raise exception 'expected affected/unaffected IDs must be distinct and sorted';
      end if;
      if cardinality(v_affected_ids) = 0
         or cardinality(v_affected_ids) <> cardinality(v_affected_pointers)
         or cardinality(v_affected_ids) <> cardinality(v_affected_flags)
         or cardinality(v_unaffected_ids) <> cardinality(v_unaffected_pointers)
         or cardinality(v_unaffected_ids) <> cardinality(v_unaffected_flags) then
        raise exception 'affected/unaffected oracle arrays are not aligned';
      end if;
      if exists (select 1 from unnest(v_affected_flags) as f(value)
                 where value <> 'false') then
        raise exception 'an affected set was not pre-flag false';
      end if;
      with current_atomic_pins as (
        select s.id::text as order_set_id, i.child_order_catalog_item_id
        from public.order_sets s
        join public.order_set_revision_items i
          on i.workspace_id = s.workspace_id
         and i.order_set_revision_id = s.current_revision_id
        where s.workspace_id = v_workspace and i.child_kind = 'order'
        union
        select parent.id::text, nested.child_order_catalog_item_id
        from public.order_sets parent
        join public.order_set_revision_items parent_item
          on parent_item.workspace_id = parent.workspace_id
         and parent_item.order_set_revision_id = parent.current_revision_id
        join public.order_set_revisions child_revision
          on child_revision.workspace_id = parent_item.workspace_id
         and child_revision.order_set_id = parent_item.child_order_set_id
         and child_revision.id = parent_item.child_set_revision_id
        join public.order_set_revision_items nested
          on nested.workspace_id = child_revision.workspace_id
         and nested.order_set_revision_id = child_revision.id
        where parent.workspace_id = v_workspace
          and parent_item.child_kind = 'set_revision'
          and nested.child_kind = 'order'
      )
      select array_agg(p.order_set_id order by p.order_set_id)
        into v_actual_affected_ids
      from (
        select distinct p.order_set_id
        from current_atomic_pins p
        where p.child_order_catalog_item_id = v_item
      ) p;
      select array_agg(s.id order by s.id)
        into v_all_set_ids
      from public.order_sets s
      where s.workspace_id = v_workspace;
      select coalesce(array_agg(s.id order by s.id), ARRAY[]::text[])
        into v_actual_unaffected_ids
      from public.order_sets s
      where s.workspace_id = v_workspace
        and not (s.id = any(v_actual_affected_ids));
      select array_agg(x.id order by x.id)
        into v_expected_workspace_ids
      from (
        select distinct u.id
        from unnest(v_expected_affected_ids || v_expected_unaffected_ids) as u(id)
      ) x;
      if v_actual_affected_ids is distinct from v_expected_affected_ids
         or v_actual_unaffected_ids is distinct from v_expected_unaffected_ids then
        raise exception 'complete affected/nonmember set equality failed: actual affected %, expected affected %, actual nonmembers %, expected nonmembers %',
          v_actual_affected_ids, v_expected_affected_ids,
          v_actual_unaffected_ids, v_expected_unaffected_ids;
      end if;
      if v_all_set_ids is null
         or v_all_set_ids is distinct from v_expected_workspace_ids
         or (v_expected_affected_ids && v_expected_unaffected_ids) then
        raise exception 'affected/nonmember arrays are not a complete disjoint workspace partition';
      end if;
      for v_id, v_expected_pointer, v_expected_flag in
        select x.id, x.pointer, x.flag
        from unnest(v_affected_ids, v_affected_pointers, v_affected_flags)
          as x(id, pointer, flag)
      loop
        select current_revision_id, needs_composition_review
          into v_pointer, v_flag
        from public.order_sets
        where workspace_id = v_workspace and id = v_id;
        if not found or v_pointer::text is distinct from v_expected_pointer
           or v_flag is not true then
          raise exception 'affected exact-pinned set pointer/flag oracle failed for %', v_id;
        end if;
      end loop;
      for v_id, v_expected_pointer, v_expected_flag in
        select x.id, x.pointer, x.flag
        from unnest(v_unaffected_ids, v_unaffected_pointers, v_unaffected_flags)
          as x(id, pointer, flag)
      loop
        select current_revision_id, needs_composition_review
          into v_pointer, v_flag
        from public.order_sets
        where workspace_id = v_workspace and id = v_id;
        if not found or v_pointer::text <> v_expected_pointer
           or v_flag is distinct from v_expected_flag::boolean then
          raise exception 'unaffected set pointer/flag changed for %', v_id;
        end if;
      end loop;
      with current_atomic_pins as (
        select s.id, i.child_order_catalog_item_id
        from public.order_sets s
        join public.order_set_revision_items i
          on i.workspace_id = s.workspace_id
         and i.order_set_revision_id = s.current_revision_id
        where s.workspace_id = v_workspace and i.child_kind = 'order'
        union
        select parent.id, nested.child_order_catalog_item_id
        from public.order_sets parent
        join public.order_set_revision_items parent_item
          on parent_item.workspace_id = parent.workspace_id
         and parent_item.order_set_revision_id = parent.current_revision_id
        join public.order_set_revisions child_revision
          on child_revision.workspace_id = parent_item.workspace_id
         and child_revision.order_set_id = parent_item.child_order_set_id
         and child_revision.id = parent_item.child_set_revision_id
        join public.order_set_revision_items nested
          on nested.workspace_id = parent_item.workspace_id
         and nested.order_set_revision_id = child_revision.id
        where parent.workspace_id = v_workspace
          and parent_item.child_kind = 'set_revision'
          and nested.child_kind = 'order'
      )
      select count(*) into v_found
      from public.order_sets s
      join current_atomic_pins p on p.id = s.id
       and p.child_order_catalog_item_id = v_item
      where s.workspace_id = v_workspace
        and s.id = any(v_expected_affected_ids)
        and s.needs_composition_review is true;
      if v_found <> cardinality(v_expected_affected_ids) then
        raise exception 'not every expected exact-pinning set was blocked';
      end if;
      with current_atomic_pins as (
        select s.id, i.child_order_catalog_item_id
        from public.order_sets s
        join public.order_set_revision_items i
          on i.workspace_id = s.workspace_id
         and i.order_set_revision_id = s.current_revision_id
        where s.workspace_id = v_workspace and i.child_kind = 'order'
        union
        select parent.id, nested.child_order_catalog_item_id
        from public.order_sets parent
        join public.order_set_revision_items parent_item
          on parent_item.workspace_id = parent.workspace_id
         and parent_item.order_set_revision_id = parent.current_revision_id
        join public.order_set_revisions child_revision
          on child_revision.workspace_id = parent_item.workspace_id
         and child_revision.order_set_id = parent_item.child_order_set_id
         and child_revision.id = parent_item.child_set_revision_id
        join public.order_set_revision_items nested
          on nested.workspace_id = parent_item.workspace_id
         and nested.order_set_revision_id = child_revision.id
        where parent.workspace_id = v_workspace
          and parent_item.child_kind = 'set_revision'
          and nested.child_kind = 'order'
      )
      select count(*) into v_unexpected
      from public.order_sets s
      join current_atomic_pins p on p.id = s.id
       and p.child_order_catalog_item_id = v_item
      where s.workspace_id = v_workspace
        and not (s.id = any(v_expected_affected_ids))
        and s.needs_composition_review is true;
      if v_unexpected <> 0 then
        raise exception 'an unrelated exact-pinned set was composition-blocked';
      end if;
      if has_function_privilege(
        'authenticated',
        'private.clair_adopt_master_release_to_workspace(text,uuid)',
        'execute') then
        raise exception 'authenticated can execute private master adoption';
      end if;
      if has_function_privilege(
        'authenticated',
        'private.clair_adopt_lab_master_projection_to_workspace(text,uuid)',
        'execute') then
        raise exception 'authenticated can execute private lab adoption';
      end if;
    end $assert$;
    commit;
The same oracle is run against the B1 exact affected/unaffected fixture. It must
prove that ordinary usable name/price/current-version changes do not set the
flag, only an exact pinned unusable member does, current pointers remain
unchanged during invalidation, and only a validated new revision can clear the
flag. Every barrier includes a committed post-commit oracle; a lock wait alone
is not evidence.

## Entry, exit, rollback, and stop criteria

### Entry

- A1 local PostgreSQL reset/replay/role/privilege/two-session evidence passes;
- A2 catalog adoption, nullable price, catalog_revision, composite key,
  RLS/direct-DML, CAS/retry, and notification evidence passes;
- A3 catalog-only order, NULL service ID, immutable snapshot, billing anchor,
  and permission evidence passes;
- B1 lab runtime/security/freeze evidence passes;
- actual post-B1 table/function signatures and ACLs are inspected;
- no unresolved legacy set identity or cross-workspace mapping remains;
- the Option A range-coverage decision recorded in this document and the
  authoritative DB spec is used consistently by migration, seed, and runtime.

Ordering is strict: A1 runtime/security gate → A2 adoption/revision/permission
gate → A3 sole-order-authority/snapshot gate → B1 laboratory gate → B2
migration/replay/admin gate. B3 may consume the explicit chart handoff only
after B2 exit and its own approval; B2 never implements B3 expansion,
encounter-local selection, fulfillment, or billing.

### Exit

- all valid legacy sets have idempotent rev1 backfill or explicit quarantine;
- every accepted admin edit creates one immutable revision;
- current pointer, availability, review flag, and compatibility projection are
  updated atomically with CAS;
- nested/cycle/depth/duplicate/price/workspace rules pass;
- child review supersession/accept/dismiss and notification dedupe pass;
- direct old-revision/legacy-item DML is denied;
- two-workspace fixtures and replay pass;
- no chart expansion, order, fulfillment, billing, or service dual-write code
  was added;
- this work item and its single index row match the evidence.

### Rollback and stop

Rollback is local transaction rollback or a fresh local reset followed by the
A1 → A2 → A3 → B1 → B2 replay. Do not revert other agents' WIP or use
destructive Git commands.

Stop immediately for a missing predecessor gate, missing A2 catalog revision or
composite key, absent notification vocabulary, unresolved legacy identity,
direct authenticated DML, cross-workspace leakage, client price/lineage/
snapshot authority, silent child-pointer advancement, duplicate retry result,
or any request to implement B3/runtime, fulfillment, billing, remote state, or
legacy cleanup.

## Domain decision

**New domain decision required: none.**

The domain owner approved Option A for both `patient_weight_kg` and
`manual_value`: continuous `[0,+infinity)` coverage, lower-inclusive/
upper-exclusive contiguous rows, first lower bound `0`, and exactly one final
open-ended row. Every nonnegative input matches exactly one bracket, so B3 has
no no-match runtime state. This is recorded in the authoritative DB spec at
`docs/engineering/data-model/clair-clinical-master-data-phase-1-db-spec.md:641-655`
and is implemented by the B2 validator/replay. The local B2 runtime/security
gate and independent Sol review (`APPROVE`, `MUST-FIX 0`) are complete. The atomic
pin boundary remains `(catalog item id, catalog_revision)`, with current
price/tax resolved only by future B3 application and frozen in the B3 snapshot.

## Exact file boundary

The implementation allow-list for the B2 slice was the named migration/replay,
native seed and readback adapter/test, server gateway, Order Set routes,
existing hospital-admin section/store/UI wiring, and B2 static tests listed in
the Server/API/UI and Synthetic fixture sections above, plus this work item, its
single index row, and the authoritative DB spec for Option A. It did not edit
PR-001/002/003/004 or their migrations/work items. The separate Phase 1
closeout synchronization is recorded below. Forbidden scope for the B2
implementation was any chart expansion/confirmation change,
`unsupported_order_type` removal, encounter-local selection,
fulfillment/billing execution, `service_*` dual write, catalog historical-
version invention, direct table DML, old-revision mutation, legacy
`order_set_items` cleanup/deletion, clinical validation, real data,
Docker/network/remote DB, deployment, commit, push, PR, or dependency.

## Current implementation candidate versus approval state

The B2 implementation candidate includes the forward migration/replay, native
synthetic seed adapter/readback path, server gateway and Order Set API/UI
owners, and static type/document checks. The current local evidence is: the
actual two-stage legacy `prepare → migration twice → verify` path PASS; pinned
reset (migration plus seed) PASS; direct B2 migration reapply PASS; and main
B2 replay PASS, including the 2-item `valid_sum` case, five `clair-demo`
replay sets, five current pointers, and one isolated second-workspace row.
TypeScript, scoped ESLint, diff check, and docs link check PASS. Focused browser
specs remain subject to the local web-server bind boundary, and
RLS/direct-DML/CAS/range/readback SQL evidence is only claimed when its
explicit SQL output is recorded. The completed work item retains independent
Sol review `APPROVE` with `MUST-FIX 0`. Chart
expansion/confirmation, fulfillment, billing, and service dual-write remain
explicitly out of scope.

## Phase 1 closeout (2026-08-21)

This B2 Order Set revision item is completed within the scoped Phase 1 A1–B3
boundary. PR #572 merged at
`00410c25098d53e20acaa94ad91835c17215339c`, PR #573 at
`5a077058fbd5aa1ee9a75d3df217cb6e39e9985d`, and permission-source PR #574 at
`719f8e225357eedf552e4c304aaabd3347049302`; production deployment
`dpl_A3UCjuuAUiPp6J3r2HmewHdDC4zp` is READY on the production alias.

C2 hash `5181e7c6e2aa9a898dc5d7a0864d1d9eafc3608be7a5174959f619296d4ec0c7`
passed with unconditional `ROLLBACK`; fresh E hash
`6868babe3f5f9e0de22010d7a277604a0677818e0b3a0e7981608d514d3e11a5` passed.
Remote readback recorded durable Order Set revisions/items `2/4`, creation/save
request histories `1/1`, and an inactive current revision `2` requiring review.
The authenticated synthetic Order Set page rendered four rows, including the
inactive revision, without a read error. No Phase 2–5 or clinical-content
validation is claimed; ledger drift remains `39` local-only / `11` remote-only.
See the [Phase 1 closeout report](../../completed/clinical-master/2026-08-21-clinical-master-phase1-closeout-report.html).
