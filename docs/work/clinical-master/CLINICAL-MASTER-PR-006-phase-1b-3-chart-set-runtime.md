---
id: "CLINICAL-MASTER-PR-006"
status: "human_review"
area: "clinical-master"
priority: "P0"
target_pr: "A1/A2/A3/B1/B2/B3 local synthetic gates PASS; migration reapply, parents=10 children=11, range=2, rollback cleanup, focused 13/13; Sol APPROVE/MUST-FIX 0; local-only human review"
updated: "2026-08-20"
---

# Clinical Master Phase 1B-3: Chart Order Set Runtime

## Status

This is the approved implementation contract for the bounded local B3 slice
and remains in `human_review` pending human acceptance. A1/A2/A3/B1/B2/B3
local synthetic runtime/security gates PASS: migration direct reapply and
replay produced `parents=10`, `children=11`, `range=2`, and rollback cleanup;
focused B3 verification passed `13/13`. Independent Sol review is `APPROVE`
with `MUST-FIX 0`. No remote Supabase, real data, production, deployment,
commit, push, PR, or external write was performed.

The boundary is runtime consumption of immutable Phase 1B-2 Order Set
revisions: trusted chart expansion into encounter-owned draft and selected
atomic child rows, frozen provenance/snapshots, and reuse of A3 order,
fulfillment, and billing authorities. It does not redesign catalog, package
billing, fulfillment, checkout, or the existing individual flow.

## Entry gates and boundary

The following entry gates are recorded as PASS and remain the baseline for
this human-review closeout:

1. PR-001 PostgreSQL reset/replay, rollback, role/grant, and two-session gates.
2. PR-002 workspace adoption, nullable/zero, catalog_revision, composite-key,
   RLS/grant, direct-DML, CAS/retry, and notification gates.
3. PR-003 sole catalog-order authority, service_item_id NULL for new catalog
   orders, immutable fulfillment/billing snapshot, permission, and retry gates.
   The A3 gate must also evidence the frozen roundingRule
   (as_is|ceil|floor|round) and calculation result consumed by B3; if that
   calculation contract is absent, A3 is a predecessor gate failure and B3
   does not invent a fallback.
4. PR-004 laboratory runtime/security/freeze gate and actual post-A3 ACLs.
5. PR-005 immutable revision, exact child pin, composition-review, and B2
   atomic-only chart-search runtime/security gates.
6. PR-005 Option A range coverage/no-match semantics: both
   `patient_weight_kg` and `manual_value` use a continuous `[0,+infinity)`
   domain, lower-inclusive/upper-exclusive brackets, first lower bound `0`,
   contiguous ranges, and exactly one final open-ended range.

Gate 6 is now recorded by PR-005 Option A. Range activation, selection,
confirmation, replay, and focused tests use that contract; no additional B3
domain decision is introduced. The frozen-pin conflict rule remains an
implementation invariant required to avoid silent repricing.

Included: v2 chart search, read-only preview, one-level nested expansion,
encounter defaults/selection/quantity edits, fixed, included-order-sum, and
approved range runtime, direct lineage, frozen snapshots, fulfillment/billing
reuse, and focused security/concurrency/regression tests.

Excluded: a third set layer, client authority, new table/ledger/dependency/
generic framework/notification, new service_* writes, chart preset mutation,
historical mutable joins, unrelated cleanup, and any invented range rule.

The only new database columns are the B3 order revision-item lineage and
snapshot schema/hash columns. Existing orders, order_events, audit_events,
fulfillment uniqueness, and A3 invoice anchors remain authorities.

## Current owners and forward replacements

| Surface | Current source | B3 owner/action |
| --- | --- | --- |
| Current search RPC | supabase/migrations/20260527090000_order_catalog_chart_search_rpc.sql:5-88 | PR-005 forward-replaces public.clair_list_order_catalog_chart_search(text) as atomic-only. B3 adds v2 below. |
| Search types/gateway | src/features/hospital-admin/server-order-catalog-core.ts:236-331, 379-404, 471-503, 995-1112, 1581-1714 | Forward-replace the mapper/union/RPC method; remove numeric-only set mapping and use NULL safely. |
| Search route | src/app/api/workspaces/[workspaceId]/hospital-admin/order-catalog/route.ts:33-73 | Retain DB permission adapter and service_catalog:view; no client source authority. |
| Old expansion | src/app/api/workspaces/[workspaceId]/hospital-admin/order-sets/[orderSetId]/expand/route.ts:12-38 | Forward-replace 404 path with authenticated preview using the same private SQL helper. |
| Draft core/RPC | src/features/chart/server-order-draft-persistence-core.ts:10-35, 245-355, 534-558 | Replace client snapshot/price input; retain function owner and server readback. |
| Draft route | src/app/api/workspaces/[workspaceId]/chart/order-drafts/route.ts:31-155 | Add server ETag/If-Match only; no direct DML. |
| Action stop/gateway | src/features/chart/server-order-action-persistence-core.ts:36-76, 267-443, 548-643, 862-1033 | Remove unsupported_order_type; remove mergeCatalogSnapshotRows authority; action reads persisted rows and private expansion. |
| Action route | src/app/api/workspaces/[workspaceId]/chart/order-actions/route.ts:50-199 | Retain identity, chart:update, rate limit, audit ID, fulfillment/billing gateways. |
| Snapshot bridge | supabase/migrations/20260519170000_chart_order_snapshot_bridge.sql:4-129, 188-278 | Add B3 lineage/hash/checks/indexes in this owner; no snapshot table. |
| Base orders | supabase/migrations/20260519160000_clinical_order_billing_schema_foundation.sql:116-149 | A3 remains sole writer; only set parent gets order_type=set, children retain operational type. |
| Fulfillment | src/features/fulfillment/server-fulfillment-work-item-core.ts:60-86, 176-191, 404-452, 934-1060; supabase/migrations/20260523094400_order_fulfillment_work_item_contract.sql:147-299 | Remove caller enrichment; selected atomic children only; preserve unique retry. |
| Billing | src/features/billing/server-invoice-candidate-sync-core.ts:20-51, 208-261, 304-442; supabase/migrations/20260530141423_den_329_billing_candidate_invoice_anchor.sql:5-230 | Use A3 private/chart wrapper; fixed/range parent once plus extras, sum children only. |
| Chart UI | src/features/chart/module.tsx:294-335, 2350-2430, 4682-4751, 4764-4900, 4928-5120, 5261-5460, 5700-5880 | Existing order dialog/area remains owner; replace local set snapshot with server preview and children. |
| Domain types | src/types/emr-domain.ts:60-103, 390-410, 452-461 | Add feature-local chart union/minimal nullable lineage; do not widen fulfillment queue type just for parent set. |

## B3 forward migration: exact preflight and order constraints

The B3 worker owns one forward migration after the actual A3 migration. It
must fail before any DDL if A3 direct catalog lineage columns and the
composite catalog FK are absent. The first transaction is a read-only
preflight and raises clinical_master_b3_preflight_confirmed_set_unresolved
for any confirmed/billed set or set_child that lacks an exact revision/item
pin, schema-1 snapshot, or hash. It raises
clinical_master_b3_preflight_legacy_set_draft_unresolved for a draft/pending
legacy set and emits its workspace/order IDs for reviewed quarantine. It does
not cancel, delete, reinterpret, attach the current revision, or create a
quarantine table. Any error aborts the migration; no constraint is weakened
to make old data pass.

The only B3-owned order columns are source_set_revision_id uuid,
source_set_revision_no integer, source_set_revision_item_id uuid,
applied_snapshot_schema_version integer, and applied_snapshot_sha256 text.
The migration expects A3's workspace_catalog_item_id,
source_master_record_id/source_master_revision, and
workspace_catalog_revision columns/FKs to exist; it does not duplicate those
owners. source_set_version remains the text compatibility projection
order-set-revision-<revision_no>, while source_set_revision_no and the UUID
are persisted separately.

Before the tenant-safe revision-item FK, preflight duplicate
(workspace_id,id) in PR-005 items. A collision raises
clinical_master_b3_revision_item_workspace_key_collision and stops. With no
collision, create the exact target:

~~~sql
create unique index order_set_revision_items_workspace_id_key
  on public.order_set_revision_items(workspace_id, id);
~~~

The migration validates the named owners by complete normalized
`pg_get_constraintdef` equality (whitespace, redundant grouping parentheses,
and implicit text casts are canonicalized), `contype`, validation, and
non-deferrability before it drops/recreates, in one transaction, the current A3/base owners
orders_order_type_check, orders_row_type_check,
orders_chart_row_hierarchy_check, orders_quantity_source_check, and
orders_catalog_individual_check. Each accepts only its exact predecessor or
already-B3-owned replacement definition; the hierarchy owner additionally
accepts only the exact predecessor bridge definition or exact already-B3-owned revision-pinned
definition on reapply; a missing or unexpected definition is a hard migration
error, not an IF NOT EXISTS pass. All other current constraints remain
untouched. The recreated row_type check retains
individual|set|set_child|temporary for legacy compatibility. The new
order_type check is dispensing|treatment|lab|imaging|set; only a parent has
set. Fulfillment queue constraints remain the four operational values.

The forward-replaced lineage checks are exact:

- row_type = individual permits the existing service lineage or the A3 direct
  catalog lineage; a direct catalog row has workspace_catalog_item_id NOT
  NULL, service_item_id NULL, and a positive workspace_catalog_revision.
- row_type = set requires order_type = set, row_depth = 0, source_set_id,
  source_set_revision_id, and a positive source_set_revision_no;
  source_set_version must equal 'order-set-revision-' ||
  source_set_revision_no. It forbids service_item_id,
  workspace_catalog_item_id, source_master_record_id,
  source_master_revision, workspace_catalog_revision,
  source_set_revision_item_id, set_item_id, and parent_chart_order_line_id.
- row_type = set_child requires an operational order_type (never set),
  row_depth IN (1,2), parent UUID, root set ID/revision/no/version, exact
  positive workspace/catalog revision, and source_set_revision_item_id. It
  forbids service_item_id, binds (workspace_id,source_set_revision_id) to the
  root revision, and uses the leaf FK
  (workspace_id,source_set_revision_item_id) to the exact revision item. The
  deferred parent trigger verifies that the leaf owner is the root revision's
  direct item or the one exact child-set revision pinned by that root. For
  compatibility with the existing text field, set_item_id is required to
  equal source_set_revision_item_id::text; it is not an independent lineage
  value. The path and root revision item are frozen in the snapshot.
- row_type = temporary remains a legacy compatibility row accepted by the
  recreated row_type check, but it cannot carry B3 set/catalog lineage and no
  new writer may create it.
- Catalog lineage is allowed only when row_type IN ('individual','set_child');
  a set parent can never carry catalog or service lineage. A direct catalog
  individual has no set lineage; a set_child has both root and leaf lineage.
  workspace_catalog_item_id and service_item_id are never both present.

Add these exact restrictive, initially-deferred tenant-safe FKs after the
unique index:

~~~sql
alter table public.orders
  add constraint orders_source_set_revision_workspace_fk
  foreign key (workspace_id, source_set_revision_id)
  references public.order_set_revisions(workspace_id, id)
  on delete restrict deferrable initially deferred;

alter table public.orders
  add constraint orders_source_set_revision_item_workspace_fk
  foreign key (workspace_id, source_set_revision_item_id)
  references public.order_set_revision_items(workspace_id, id)
  on delete restrict deferrable initially deferred;
~~~

The leaf FK uses only the planned exact unique (workspace_id,id); it does not
pretend that root revision and leaf item are one composite owner key. Delete
behavior is RESTRICT; collision, missing target, cross-workspace target, or
any partial set lineage aborts. The migration and focused DB spec assert
parent/child order-type branches, the set_item_id compatibility equality,
catalog/service exclusion, both FKs, and fulfillment rejection of a parent.

The existing parent workspace/id FK remains and B3 adds one narrowly scoped
deferred constraint trigger, orders_set_child_parent_lineage_trg. It requires
every set_child parent row to be the same-workspace, same-encounter row_type
set/order_type set with matching source_set_id and source_set_revision_id;
the leaf row identified by (workspace_id,source_set_revision_item_id) must
belong either directly to source_set_revision_id or to the one exact child-set
revision pinned by a root revision item of source_set_revision_id. The
trigger reads the immutable revision-item graph and schema-1 path; it rejects
any second nested layer, unrelated owner revision, or path mismatch. It is
part of the same forward migration, has no new table or generic framework, and
prevents a valid UUID from being used with an unrelated set. The private
helper repeats this check under the lock before every write.

## B3 quantity precision and source contract

The current base has orders.quantity numeric(12,2) at
supabase/migrations/20260519160000_clinical_order_billing_schema_foundation.sql:128-133
and invoice_lines.quantity numeric(12,2) with a generated line_total at
that migration:215-224. B3 preflight first reports the numeric(12,3) storage
range advisory: 0 < quantity <= 999999999.999. Any out-of-range row is a
fatal preflight result because the target typmod cannot represent it; the
migration never clamps or silently changes it. It also rejects a non-positive
value or any value that changes when cast to numeric(12,3) with
clinical_master_b3_quantity_precision_conflict. In the same forward migration,
drop/recreate only the dependent generated columns, alter both quantity
columns to numeric(12,3), and recreate:

~~~sql
orders.line_total_snapshot =
  orders.quantity * coalesce(orders.unit_price_snapshot, 0)
invoice_lines.line_total =
  (invoice_lines.quantity * invoice_lines.unit_price)
  - invoice_lines.discount_amount
~~~

The money columns remain numeric(12,2) storage types; their scale is not a
business rounding authority. The generated expressions preserve the A3
persisted shape, and the database typmod stores the result. discount_amount <=
quantity * unit_price is evaluated at three-decimal quantity precision and the
generated invoice line is the persisted parity check. The generated line-total
expression may use zero as the arithmetic identity for a NULL nonbillable unit
price, but the unit_price_snapshot, DTO, snapshot, billing reflection, and
billable-NULL decision remain NULL; no price is coerced to zero. No existing
quantity is silently rounded.

The recreated orders_quantity_source_check is exactly:

~~~sql
(
  row_type in ('set','set_child')
  and quantity_source in ('fixed_one','preset_quantity','manual_at_apply')
)
or (
  row_type not in ('set','set_child')
  and quantity_source in
    ('manual','days','total_count','dispense_quantity',
     'actual_dispense_quantity','fixed_one')
)
~~~

A set parent and every child-set row are fixed_one with quantity 1; an atomic
set_child may use the pinned preset_quantity or edited manual_at_apply.
quantitySource is server-derived in preview, draft getter, action result, and
snapshot; it is never client-authored.
The DTO/readback union uses exactly fixed_one|preset_quantity|manual_at_apply
for B3 rows.

The focused test inserts 0.001, checks 1, 1.0, and 1.00 normalize to the same
quantity/fingerprint, exercises the max-range advisory, and proves billable
order/invoice line parity from the A3 frozen rounding result for fixed, sum,
and explicit-zero cases. The generated compatibility column is not a second
rounding authority; a nonbillable sum parent readback keeps its line total
NULL.

The target graph/pricing/snapshot contracts are
docs/engineering/data-model/clair-clinical-master-data-target-architecture.md:345-388,
:597-665; order lineage/runtime is
docs/engineering/data-model/clair-clinical-master-data-phase-1-db-spec.md:689-750;
A3 authority is
docs/work/clinical-master/CLINICAL-MASTER-PR-003-phase-1a-3-sole-order-authority.md:430-622;
and B2/v2/NULL/lineage/range handoff is
docs/work/clinical-master/CLINICAL-MASTER-PR-005-phase-1b-2-order-set-revisions.md:1940-2118, 3138-3170.

## v2 chart search projection

The additive function is exact:

~~~sql
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
language sql security invoker set search_path = public;
~~~

The query asserts the first eight fields non-null. Atomic rows have every
source_set field NULL. Set rows are filtered to
source_set_availability_status = active, source_set_validation_status = valid,
and source_set_needs_composition_review = false. The migration revokes
public/anon/service_role and grants authenticated only. The existing
eight-column function remains atomic-only with its existing invoker,
search-path, and ACL contract.

The SQL set branch returns a non-NULL source_set_price_ranges array: [] for
included_order_sum and set_fixed_price, and the ordered non-empty range array
for range_price. Only atomic rows return NULL for that column. Sum price is
NULL with tax type derived; fixed price is non-NULL and may be zero; range
price is NULL until a bracket is approved; fixed/sum range basis is NULL and
range basis is non-NULL only for range mode. source_set_tax_type is derived
only when source_set_amount_basis = included_order_sum, and is taxable or
non_taxable for set_fixed_price and range_price. These are SQL predicates,
not client repair rules.

The returned SQL columns remain nullable for wire compatibility, but the
forward-replaced gateway calls strict parseChartOrderCatalogSearchRow before
any UI mapping. Its closed union is:

~~~ts
type OrderSetPriceRange = {
  id: string;
  sortOrder: number;
  lowerBound: number;
  upperBound: number | null;
  priceKrw: number;
};

type AtomicChartCatalogSnapshot = {
  sourcePresetId: string;
  sourcePresetVersion: string;
  workspaceCatalogItemId: string;
  appliedStandardOrderName: string;
  appliedDisplayName: string;
  appliedBillingName: string;
  appliedPriceKrw: number | null;
  appliedTaxType: "taxable" | "non_taxable";
  appliedAmountBasis: string;
  appliedSalesUnit: string;
  roundingRule: "as_is" | "ceil" | "floor" | "round";
  careGuide: string | null;
  internalInstruction: string | null;
  destinationModule: string | null;
  taskRequired: boolean;
  typeSpecificRuntimeContext: Record<string, unknown> | null;
  billingReflectionEnabled: boolean;
};

type AtomicChartCatalogSearchRow = {
  rowType: "individual";
  sourcePresetId: string;
  sourcePresetVersion: string;
  displayName: string;
  billingName: string;
  categoryGroup: ServiceItemType;
  targetSpecies: Species[];
  appliedSnapshot: AtomicChartCatalogSnapshot;
};

type SetChartSearchSnapshot = {
  sourceSetId: string;
  sourceSetRevisionId: string;
  sourceSetRevisionNo: number;
  amountBasis: "included_order_sum";
  setPriceKrw: null;
  taxType: "derived";
  priceRanges: [];
} | {
  sourceSetId: string;
  sourceSetRevisionId: string;
  sourceSetRevisionNo: number;
  amountBasis: "set_fixed_price";
  setPriceKrw: number;
  taxType: "taxable" | "non_taxable";
  priceRanges: [];
} | {
  sourceSetId: string;
  sourceSetRevisionId: string;
  sourceSetRevisionNo: number;
  amountBasis: "range_price";
  setPriceKrw: null;
  taxType: "taxable" | "non_taxable";
  priceRanges: [OrderSetPriceRange, ...OrderSetPriceRange[]];
};

type ChartOrderSearchCommon = {
  rowType: "set";
  sourcePresetId: string;
  sourcePresetVersion: string;
  displayName: string;
  billingName: string;
  categoryGroup: "set";
  targetSpecies: Species[];
  appliedSnapshot: SetChartSearchSnapshot;
  sourceSetId: string;
  sourceSetRevisionId: string;
  sourceSetRevisionNo: number;
  sourceSetAvailabilityStatus: "active";
  sourceSetNeedsCompositionReview: false;
  sourceSetValidationStatus: "valid";
  sourceSetPendingReviewCount: number;
};

type ChartOrderCatalogSearchRow =
  | (AtomicChartCatalogSearchRow & {
      rowType: "individual";
      sourceSetId: null;
      sourceSetRevisionId: null;
      sourceSetRevisionNo: null;
      sourceSetAmountBasis: null;
      sourceSetPriceKrw: null;
      sourceSetRangeBasis: null;
      sourceSetTaxType: null;
      sourceSetAvailabilityStatus: null;
      sourceSetNeedsCompositionReview: null;
      sourceSetValidationStatus: null;
      sourceSetPriceRanges: null;
      sourceSetPendingReviewCount: null;
    })
  | (ChartOrderSearchCommon & {
      sourceSetAmountBasis: "included_order_sum";
      sourceSetPriceKrw: null;
      sourceSetRangeBasis: null;
      sourceSetTaxType: "derived";
      sourceSetPriceRanges: [];
    })
  | (ChartOrderSearchCommon & {
      sourceSetAmountBasis: "set_fixed_price";
      sourceSetPriceKrw: number;
      sourceSetRangeBasis: null;
      sourceSetTaxType: "taxable" | "non_taxable";
      sourceSetPriceRanges: [];
    })
  | (ChartOrderSearchCommon & {
      sourceSetAmountBasis: "range_price";
      sourceSetPriceKrw: null;
      sourceSetRangeBasis: "patient_weight_kg" | "manual_value";
      sourceSetTaxType: "taxable" | "non_taxable";
      sourceSetPriceRanges: [OrderSetPriceRange, ...OrderSetPriceRange[]];
    });
~~~

The exact aliases are source_set_id/sourceSetId,
source_set_revision_id/sourceSetRevisionId,
source_set_revision_no/sourceSetRevisionNo,
source_set_amount_basis/sourceSetAmountBasis,
source_set_price_krw/sourceSetPriceKrw,
source_set_range_basis/sourceSetRangeBasis,
source_set_tax_type/sourceSetTaxType,
source_set_availability_status/sourceSetAvailabilityStatus,
source_set_needs_composition_review/sourceSetNeedsCompositionReview,
source_set_validation_status/sourceSetValidationStatus,
source_set_price_ranges/sourceSetPriceRanges, and
source_set_pending_review_count/sourceSetPendingReviewCount. The validator
rejects unknown row_type/amount basis, absent set arrays, non-active/invalid/
review-blocked rows, a NULL set price in fixed mode, a non-NULL sum price,
non-NULL fixed/sum ranges, a NULL range array, derived tax on fixed/range,
taxable/non_taxable tax on sum, and any attempted NULL-to-zero coercion.
Fixed zero is valid; billable NULL remains a failure at expansion. Range rows
are active in search, preview, selection, confirmation, and the focused replay
fixture under the approved Option A contract. Applied snapshots are
cross-checked, never used to override typed source fields. The old
numeric-only set mapper is forward-replaced.

## Selection versus confirmation

1. Search returns the stable set ID and exact current revision pin. The client
   stores only that pin and staff intent.
2. The existing expand route becomes a read-only preview. It returns ordered
   defaults, flattened atomic leaf paths, quantity modes, revision-pinned
   billing status, and a pricing preview; it inserts no orders and does not
   grant snapshot authority.
3. Staff selects/deselects only flattened atomic leaf revision-item IDs and
   edits allowed quantities. A nested set is a container; no container ID may
   be selected and no transactional container row is created.
4. Draft input contains the set ID, exact root revision ID/no, leaf
   revision-item IDs, selected flags, and quantities only. It contains no
   name, price, tax, snapshot, catalog display, source hash, parent ID, child
   ID, billing amount, or source compatibility value. Billing status is
   displayed read-only from the pinned revision; there is no interactive
   billing control.
5. Draft save re-reads exact set/revision/items and current atomic usability
   under the workspace/encounter lock, then writes server-built parent/child
   draft rows and freezes the draft's effective price/tax pins.
6. Confirm reads the persisted draft and uses those frozen pins exactly. It
   checks the current pinned set/revision/item/catalog rows only for
   usability, never reprices or rebinds from a newer pointer. If a frozen
   member is unavailable, invalid, review-blocked, cross-workspace, or
   billable with NULL price, confirmation returns an explicit conflict/block.
7. Confirmed/billed rows return the stored snapshot without a mutable catalog
   or set join. Historical reads use frozen snapshot only.

This is the single safe change rule between selection and confirmation:
mutable names/prices that leave the exact saved pin usable do not change the
saved total; an unusable pin returns catalog_revision_requires_refresh,
order_set_member_unavailable, order_set_composition_review_required, or
order_set_price_unset as applicable. There is no silent repricing or
reinterpretation.

## Single private SQL expansion authority

There is one private SQL helper; TypeScript does not recurse or flatten:

~~~sql
private.clair_b3_expand_chart_order_set(
  p_workspace_id text,
  p_encounter_id uuid,
  p_set_id text,
  p_revision_id uuid,
  p_selection_intent jsonb,
  p_operation text default 'preview',
  p_parent_order_id uuid default null
) returns jsonb
~~~

p_operation is exactly preview, draft, or confirm. Its authenticated callers
perform actor, workspace, encounter, and chart permission checks; the helper
obtains
pg_advisory_xact_lock(hashtextextended(
'clinical_master_workspace_adoption:' || p_workspace_id, 0)); locks the
encounter and the pinned set/revision/item/range rows under that workspace
lock; validates the exact revision triples; follows root -> one child-set
revision -> atomic only; applies defaults and staff intent; returns canonical
ordered paths/pricing/tax and a selectionFingerprint; and writes only in
draft/confirm mode. The lock is acquired only after caller authorization.

The public preview wrapper has this exact signature:

~~~sql
public.clair_preview_chart_order_set(
  workspace_id text,
  encounter_id uuid,
  set_id text,
  revision_id uuid,
  selection_intent jsonb
) returns jsonb
~~~

It derives actor_user_id from auth.uid(), verifies active membership and the
existing chart:update permission already used by the action owner at
src/features/chart/server-order-action-persistence-core.ts:267-443, verifies
the encounter belongs to the same workspace and is usable in the database,
then calls the private helper with parent_order_id = NULL and operation =
preview. Search alone uses the existing service_catalog:view permission. The
wrapper never trusts a client
actor, parent UUID, price, tax, name, or source compatibility value and has no
new permission.

selection_intent is exactly an object with `items` containing flattened
atomic-leaf entries of the form
`{"revisionItemId":"uuid","selected":true,"quantity":1}`. Range mode
also requires the numeric `rangeInput` key; fixed and sum mode rejects that
key. No other selection key is accepted.
The server verifies that every ID is a flattened atomic leaf of the supplied
root revision, rejects containers/unknowns/duplicates, applies nested defaults
before the explicit leaf flags, and returns no client-authored pricing or
lineage. UUID parsing accepts canonical UUID variants, including the UUIDv8
revision-item IDs generated by the B2 deterministic identity function; the
workspace, root-revision, leaf-revision-item, and catalog-pin checks remain
database-owned.

The canonical return object is:

~~~json
{
  "schemaVersion":1,
  "operation":"preview",
  "set":{"sourceSetId":"set-1","sourceSetRevisionId":"uuid",
    "sourceSetRevisionNo":3,"sourceSetVersion":"order-set-revision-3",
    "amountBasis":"included_order_sum","setPriceKrw":null,
    "rangeBasis":null,"taxType":"derived"},
  "items":[{
    "revisionItemId":"uuid","itemKind":"atomic",
    "path":[{"setId":"set-1","revisionId":"uuid","revisionItemId":"uuid"}],
    "workspaceCatalogItemId":"catalog-1","pinnedCatalogRevision":4,
    "appliedCatalogRevision":4,"defaultSelected":true,"selected":true,
    "defaultQuantity":1,"quantity":1,"quantitySource":"preset_quantity",
    "billingReflectionEnabled":true,"priceKrw":12000,"taxType":"taxable"
  }],
  "pricing":{"selectedSetInput":null,"selectedRangeId":null,
    "rangeInput":null,"childSubtotalKrw":12000,
    "explicitExtraSubtotalKrw":0,"finalTotalKrw":12000},
  "selectionFingerprint":"64-lower-hex-characters"
}
~~~

The preview selectionFingerprint is drift metadata only. It is not the
persisted applied_snapshot_sha256 and does not populate any order hash
column; draft/confirm later persist the separate selection fingerprint in
calculation_inputs and the four-object frozen envelope hash.

Nested paths include root revision item, child revision, and leaf revision
item. Deterministic order is root sort_order, child sort_order, catalog ID,
revision-item UUID. No intermediate transactional child-set row exists.
public.clair_preview_chart_order_set(text, uuid, text, uuid, jsonb) is the
authenticated fixed-search-path wrapper; draft/action call the same helper.

## Exact intent DTOs and draft/action RPCs

~~~ts
type ChartOrderQuantitySource =
  | "fixed_one"
  | "preset_quantity"
  | "manual_at_apply";

type ChartOrderReadbackQuantitySource =
  | ChartOrderQuantitySource
  | "manual"
  | "days"
  | "total_count"
  | "dispense_quantity"
  | "actual_dispense_quantity";

type ChartOrderSetLeafIntent = {
  revisionItemId: string;
  selected: boolean;
  quantity: number;
};

type ChartOrderSetSelectionIntent = {
  items: ChartOrderSetLeafIntent[];
  rangeInput?: never;
} | {
  items: ChartOrderSetLeafIntent[];
  rangeInput: number;
};

type ChartOrderDraftInput =
  | {
      rowType: "individual";
      orderId: string;
      workspaceCatalogItemId: string;
      quantity: number;
    }
  | {
      rowType: "set";
      orderId: string;
      sourceSetId: string;
      sourceSetRevisionId: string;
      sourceSetRevisionNo: number;
      selectionIntent: ChartOrderSetSelectionIntent;
    };

type ChartOrderServerQuantity = {
  quantity: number;
  quantitySource: ChartOrderQuantitySource;
};
~~~

The validator rejects an individual without orderId,
workspaceCatalogItemId, or positive quantity; a set without all three exact
revision pins and selectionIntent; a container revision-item ID; an unknown,
duplicate, cross-workspace, or non-leaf revision-item ID; and any client
name/price/tax/snapshot/source compatibility field. It strips no invalid
field silently. The server derives quantitySource, display/billing names,
category, operational order type, tax, prices, lineage, IDs, and all four
snapshots.

Existing public functions retain the draft getter name and actor/security
boundary but now return {etag, rows} and accept an object:

~~~sql
public.clair_get_chart_order_draft(text, uuid) returns jsonb
public.clair_save_chart_order_draft(text, text, uuid, jsonb) returns jsonb
public.clair_get_chart_order_actions(text, uuid) returns jsonb
public.clair_save_chart_order_action(
  text, uuid, uuid, text, uuid[], text
) returns jsonb
~~~

Draft p_orders is exactly {"expectedEtag":"hash","rows":[ChartOrderDraftInput]}.
The draft getter result is exactly
{"etag":"quoted-sha256","rows":[ChartOrderRuntimeRow]}.
The action function input is
{"action":"confirm"|"bill","orderIds":["root-or-individual-uuid"],
"expectedEtag":"quoted-sha256"} and its result is
{"action":"confirm"|"bill","etag":"quoted-sha256",
"rows":[ChartOrderRuntimeRow],"stored":boolean}. The action RPC's exact
forward signature is

~~~sql
public.clair_save_chart_order_action(
  p_workspace_id text,
  p_actor_user_id uuid,
  p_encounter_id uuid,
  p_action text,
  p_order_ids uuid[],
  p_expected_etag text
) returns jsonb
~~~

The server requires p_actor_user_id = auth.uid() and derives permission from
that session; the actor field is not a client-editable source value. The
draft save keeps the predecessor signature
public.clair_save_chart_order_draft(text, text, uuid, jsonb), with expectedEtag
inside the body so the route can require exact header/body equality. The
getter/action result DTOs are read-only server projections; no input can
author a name, price, tax, source ID, revision, snapshot, billable flag, or
child UUID.

The migration revokes the predecessor draft-save signature and the
five-argument action signature, then grants only the exact authenticated
signatures listed here. It revokes any stale public preview/expansion
execution, grants the preview wrapper to authenticated only, leaves the
private helper without an authenticated grant, and keeps existing RLS plus
workspace composite FKs as the database boundary.

The getter rows include order ID, row/parent type, operational type, set ID,
root revision UUID/no/version, revision-item ID, catalog ID/revisions,
quantity, quantitySource, nullable unit price, generated line total, billing
flag, snapshot schema version/hash, persisted applied/calculation snapshots,
and updated_at. It does not COALESCE NULL prices. The action function drops/
revokes the old five-argument signature before granting authenticated
execution to the six-argument replacement.

The draft/action server DTO is:

~~~ts
type ChartOrderRuntimeRow = {
  orderId: string;
  rowType: "individual" | "set" | "set_child";
  orderType: "set" | "lab" | "imaging" | "dispensing" | "treatment";
  parentOrderId: string | null;
  sourceSetId: string | null;
  sourceSetRevisionId: string | null;
  sourceSetRevisionNo: number | null;
  sourceSetVersion: string | null;
  sourceSetRevisionItemId: string | null;
  workspaceCatalogItemId: string | null;
  workspaceCatalogRevision: number | null;
  quantity: number;
  quantitySource: ChartOrderReadbackQuantitySource;
  unitPriceSnapshot: number | null;
  lineTotalSnapshot: number | null;
  snapshotSchemaVersion: 0 | 1;
  snapshotHash: string | null;
  appliedSnapshot: Record<string, unknown>;
  appliedPriceSnapshot: Record<string, unknown>;
  calculationInputs: Record<string, unknown>;
  calculationOutputs: Record<string, unknown>;
  billingReflectionEnabled: boolean;
  updatedAt: string;
};
~~~

snapshotSchemaVersion = 1 and snapshotHash non-NULL is legal only for
rowType set/set_child; rowType individual readback remains the A3 schema-0
shape with hash NULL. No temporary row is part of this runtime DTO.

The draft and action functions return persisted rows, never client
catalogSelections or a TypeScript merge. Draft/preview invoke the private
expansion helper; confirm validates the persisted root revision, child
availability, and frozen catalog revisions without recalculating price, then
updates parent/selected children and emits the existing A3 order audit/event
records with set/revision/hash metadata. Bill only advances the billing state
from stored confirmed rows. No new event type, notification, or ledger is
introduced.

## ETag/CAS, retry, lock order, and failure atomicity

The route always checks that If-Match and body expectedEtag are byte-for-byte
equal before continuing. Missing maps to if_match_required/428; inequality
maps to etag_header_body_mismatch/400. After actor, workspace, encounter, and
order scope authorization, it loads the root lifecycle. For a terminal root
(confirmed or billed), it compares the exact terminal tuple
(root/individual order IDs, operation, frozen selection fingerprint, snapshot
hash, lifecycle state) before reading mutable catalog definitions or running
current-ETag CAS. An exact confirm/bill retry returns the stored result; a
changed tuple returns idempotency_conflict/409. Terminal retries never
re-expand or read mutable catalog state.

Only mutable draft/pending transitions run current-ETag CAS. The getter ETag
is a server SHA-256 over canonical JSONB of non-cancelled draft/pending rows
ordered by sort_order, created_at, and UUID. Its projection includes IDs,
parent/row type, set/revision/item/catalog lineage, server effective names,
quantity/source, status, snapshots, calculations, and updated_at. The route
returns one quoted ETag. A stale but byte-equal mutable ETag maps to
revision_conflict/409. Encounter locking is retained around CAS.

An update with a fresh matching ETag keeps the same set parent UUID. Within
that transaction the server reconciles children by
(parent_chart_order_line_id, source_set_revision_id,
source_set_revision_item_id). An existing selected leaf keeps its UUID; a
newly selected leaf receives one server UUID; a deselected draft child is
cancelled with cancellation_reason = set_selection_removed and is omitted
from the active getter. Child IDs are never client input. A root revision
mismatch on an existing parent is revision_conflict; the caller creates a new
parent rather than silently replacing its history.

The action endpoint accepts individual order IDs or root set-parent IDs only.
It rejects any set_child ID, a parent plus one of its children, duplicate
roots, or a mixed parent/child request with invalid_order_selection 409/422.
The server derives selected child IDs and billable IDs from persisted rows.
Confirm then bill is a valid status transition; a set_child can never be
confirmed independently.

No Idempotency-Key argument or durable ledger is added because PR-002 forbids
that without a ledger. The terminal tuple above contains no ETag, audit
request ID, or x-request-id. An equal confirm retry is safe, and a
confirm-to-bill transition is not treated as a duplicate.
Order events, the fulfillment workspace/order unique key, and the A3 invoice
anchor are duplicate-prevention evidence and readback sources, not equality
inputs. x-request-id remains metadata-only.

Lock order is: authorize; shared workspace advisory lock; encounter; existing
orders in UUID order; catalog IDs; stable sets; revisions/items/ranges;
reviews last. Non-locking discovery is repeated under the lock. A1 global
publication lock remains first for A2/B1 adoption writers; B3 never reverses
it.

One SQL transaction covers validation, exact reads, all parent/child rows,
lineage, snapshot/hash, calculations, and order events/status. Any failure
rolls back all B3 rows. Fulfillment and billing remain post-order A3
idempotent wrappers; their failure cannot cause a second expansion or rewrite
the committed frozen order.

## Validation, defaults, quantities, and lineage

- Root -> optional child set -> atomic is the only graph. Third layer returns
  order_set_depth_exceeded.
- DFS stack repeated set/revision returns order_set_cycle_detected.
- A flattened atomic stable catalog ID may occur once; repeated IDs return
  order_set_duplicate_atomic with deterministic paths, never deduplication.
- Every lookup has the same workspace ID; mismatch returns
  order_set_workspace_mismatch without cross-workspace detail.
- Exact root/child revision pins are verified; unavailable/invalid/
  paused/inactive/composition-blocked members return
  order_set_member_unavailable or order_set_composition_review_required.
- Missing/stale/unusable catalog pins return catalog_revision_requires_refresh
  or order_set_member_unavailable. Billable NULL returns order_set_price_unset;
  nonbillable NULL remains NULL; explicit zero remains zero.
- Defaults are ordered by revision-item sort_order. False root selection excludes
  descendants. At least one atomic remains selected.
- Default propagation is exact: a selected root includes each nested
  set_revision item's default_selected leaf descendants in sort order; a
  deselected container excludes every descendant; an explicit leaf selection
  overrides only that leaf. A child-set container itself is never accepted as
  a selected ID or billable ID.
- Child-set and fixed_one quantities equal 1. preset_quantity and
  manual_at_apply accept positive numeric(12,3), including fractions;
  trim_scale makes 1/1.0/1.00 hash-equivalent. Invalid/duplicate/unknown
  quantities return order_set_quantity_invalid.
- Existing chart maximum is enforced in one read-only pass across all set roots
  in a draft request as at most 100 total transactional rows (each root plus
  its selected children); an expansion with more than 100 active transactional rows returns
  `order_set_too_many_rows`. Flattened but unselected leaves remain preview
  provenance and do not count as writes. No arbitrary set-size framework is
  created.

Parent row: row_type=set, order_type=set, row_depth=0, source_set_id/root
source_set_revision_id, source_set_revision_item_id NULL,
source_set_version=order-set-revision-<revision_no>, service_item_id and
workspace_catalog_item_id NULL, quantity 1/fixed_one, no fulfillment, and
fixed/range billing only. Sum parent is nonbillable with NULL unit price.

Selected atomic row: row_type=set_child, operational order type, parent
pointer, row_depth 1 direct or 2 nested, root set/revision/version,
source_set_revision_item_id equal to the exact leaf item, full path in
snapshot, workspace catalog/master/catalog revision lineage, service_item_id
NULL, server quantity/price/tax/routing/billing, and fulfillment only when
the selected atomic requires it. No intermediate child-set order row exists.

B3 adds the root FK from orders.source_set_revision_id to the revision using
the PR-005 workspace/revision key and the leaf FK from
orders.source_set_revision_item_id to order_set_revision_items(workspace_id,id)
using the planned tenant unique key, plus indexes on workspace/revision and
workspace/item. Existing source_set_id, set_item_id, source_set_version,
row_depth, and parent columns remain compatibility/history fields.
sourceSetRevisionNo is a separate integer; it never replaces the UUID.

## Snapshot schema/hash and historical immutability

Use the existing applied_snapshot, applied_price_snapshot, calculation_inputs,
and calculation_outputs columns. Add only:

~~~sql
orders.applied_snapshot_schema_version integer not null default 0,
orders.applied_snapshot_sha256 text
~~~

Legacy rows stay schema 0/hash NULL. Only B3 row_type set and set_child use
schema 1 and a lowercase 64-hex hash; individual remains the A3 schema-0
contract and is not widened by B3. No client hash is accepted. The exact
schema-1
applied_snapshot keys are below; quoted type annotations describe the stored
value type/nullability and are not literal strings. This is one literal B3
envelope, not a generic schema registry or abstraction.

~~~json
{
  "schemaVersion": 1,
  "rowType": "set | set_child",
  "orderId": "uuid",
  "parentOrderId": "uuid | null",
  "sourceSetId": "text",
  "sourceSetRevisionId": "uuid",
  "sourceSetRevisionNo": "integer",
  "sourceSetVersion": "text",
  "sourceSetRevisionItemId": "uuid | null",
  "childSetId": "text | null",
  "childSetRevisionId": "uuid | null",
  "childSetRevisionNo": "integer | null",
  "sourcePresetId": "text | null",
  "sourcePresetVersion": "text | null",
  "workspaceCatalogItemId": "text | null",
  "workspaceCatalogRevision": "integer | null",
  "sourceMasterRecordId": "uuid | null",
  "sourceMasterRevision": "integer | null",
  "path": [
    {"setId":"text","revisionId":"uuid","revisionItemId":"uuid"}
  ],
  "standardOrderName": "text",
  "displayName": "text",
  "billingName": "text",
  "categoryGroup": "set | atomic category",
  "billingCategory": "existing A3 category",
  "orderType": "set | dispensing | treatment | lab | imaging",
  "destinationModule": "text | null",
  "taskRequired": "boolean",
  "targetSpecies": ["text"],
  "salesUnit": "text | null",
  "careGuide": "text | null",
  "internalInstruction": "text | null",
  "typeSpecificRuntimeContext": "object | null",
  "sourceOrderId": "text | null",
  "sourceOrderVersion": "text | null",
  "billingReflectionEnabled": "boolean",
  "taxIncluded": "boolean | null",
  "quantitySource": "fixed_one | preset_quantity | manual_at_apply",
  "defaultQuantity": "numeric(12,3) | null",
  "quantity": "numeric(12,3)",
  "selected": "boolean | null",
  "roundingRule": "as_is | ceil | floor | round",
  "items": "SetSnapshotLeafItem[] | null"
}
~~~

The parent object above is exactly 42 keys. The exact 52-key
\`set_child\` object adds \`rootRevisionItemId\`, \`directRevisionItemId\`,
\`nestedRevisionItemId\`, \`leafRevisionItemId\`,
\`pinnedCompositionCatalogRevision\`, \`appliedCatalogRevision\`,
\`defaultQuantitySource\`, \`defaultSelected\`, \`priceKrw\`, \`taxType\`, and
\`roundingResultKrw\`; it omits the parent-only
\`workspaceCatalogRevision\` key. Its \`items\` value is JSON null. The
parent \`items\` array uses the exact 39-key leaf-item object below. No extra
or missing key is accepted in any of these objects.

For a set parent, rowType/orderType are set, all catalog/service/master and
revision-item fields are NULL, path is [], sourcePresetId/version are NULL,
items is the ordered flattened leaf array, billingCategory is existing A3
other, categoryGroup is set, quantitySource is fixed_one, quantity is 1,
selected is true, and billingReflectionEnabled is true exactly for a
fixed/range parent and false for a sum parent. For a set_child, rowType is
set_child, orderType is one of the four operational values, all root set
fields are non-null, sourceSetRevisionItemId is the leaf item,
sourcePresetId/version and workspace/catalog lineage are non-null,
care/internal/type-specific context and A3 compatibility fields are copied
from the frozen atomic snapshot, items is NULL, and path is the deterministic
root-to-leaf array. For a direct child, childSetId/revision fields are NULL;
for a nested child, they are the exact one-level child-set ID/revision/no and
the path carries both root and child revisions.
Individual rows remain the A3 schema-0 snapshot and are not represented by
this B3 envelope. No new billing category is introduced.

The parent items array contains every flattened atomic leaf, selected or not,
in root sort_order, one-level child sort_order, catalog ID, revision-item UUID
order. Each item has exactly:

~~~json
{
  "itemIndex": "integer",
  "revisionItemId": "uuid",
  "itemKind": "atomic",
  "path": "[{setId:text,revisionId:uuid,revisionItemId:uuid}]",
  "rootRevisionItemId": "uuid",
  "directRevisionItemId": "uuid",
  "nestedRevisionItemId": "uuid | null",
  "leafRevisionItemId": "uuid",
  "workspaceCatalogItemId": "text",
  "pinnedCompositionCatalogRevision": "integer",
  "appliedCatalogRevision": "integer",
  "defaultSelected": "boolean",
  "selected": "boolean",
  "defaultQuantity": "numeric(12,3)",
  "defaultQuantitySource": "fixed_one | preset_quantity | manual_at_apply",
  "quantity": "numeric(12,3)",
  "quantitySource": "fixed_one | preset_quantity | manual_at_apply",
  "billingReflectionEnabled": "boolean",
  "standardOrderName": "text",
  "displayName": "text",
  "billingName": "text",
  "categoryGroup": "atomic category",
  "billingCategory": "existing A3 category",
  "orderType": "dispensing | treatment | lab | imaging",
  "destinationModule": "text | null",
  "taskRequired": "boolean",
  "targetSpecies": "text[]",
  "salesUnit": "text | null",
  "careGuide": "text | null",
  "internalInstruction": "text | null",
  "typeSpecificRuntimeContext": "object | null",
  "sourcePresetId": "text",
  "sourcePresetVersion": "text",
  "priceKrw": "numeric(12,2) | null",
  "taxType": "taxable | non_taxable",
  "taxIncluded": "boolean | null",
  "roundingRule": "as_is | ceil | floor | round",
  "roundingResultKrw": "numeric(12,2) | null",
  "appliedSnapshot": "object"
}
~~~

For a direct leaf, rootRevisionItemId = directRevisionItemId =
leafRevisionItemId and nestedRevisionItemId is NULL. For a one-level nested
leaf, rootRevisionItemId = directRevisionItemId is the root's child-set item,
nestedRevisionItemId = leafRevisionItemId is the child revision's atomic
item, and the path contains both origins. This is the only nested form.

The exact applied_price_snapshot keys are:

~~~json
{
  "schemaVersion": 1,
  "amountBasis": "included_order_sum | set_fixed_price | range_price",
  "setPriceKrw": "numeric(12,2) >= 0 | null",
  "priceKrw": "numeric(12,2) >= 0 | null",
  "taxType": "taxable | non_taxable; derived only for included_order_sum",
  "taxIncluded": "boolean | null",
  "billedAs": "set_parent | atomic_child | nonbillable_parent",
  "billingReflectionEnabled": "boolean",
  "explicitExtra": "boolean",
  "roundingRule": "as_is | ceil | floor | round",
  "roundingResultKrw": "numeric(12,2) | null"
}
~~~

The exact calculation_inputs keys are schemaVersion, selectionFingerprint
(lowercase SHA-256 text), selectedSetInput (number or null), rangeBasis
(patient_weight_kg, manual_value, or null), rangeInput (number or null),
rangeId (UUID or null), quantity (numeric(12,3)), roundingRule (the A3 leaf
rule for child rows, neutral `as_is` for the set aggregate), and storageScale
(integer 2). The exact
calculation_outputs keys are schemaVersion, childSubtotalKrw
(numeric(12,2)), explicitExtraSubtotalKrw (numeric(12,2)), taxAmountKrw
(numeric(12,2)), finalTotalKrw (numeric(12,2)), lineTotalKrw (numeric(12,2)),
taxType (taxable/non_taxable; derived only for included_order_sum),
roundingRule (the A3 leaf rule for child rows, neutral `as_is` for the set
aggregate), and roundingResultKrw (numeric(12,2) or null).
Range keys are populated from the approved bracket and no absent range is
inferred. storageScale records the numeric persistence typmod only; it is not
a business rounding rule. If the A3 gate does not provide the required
roundingRule/result for a catalog leaf, the predecessor gate fails; the
neutral parent `as_is` marker is not a substitute for a missing child result.

For a set parent, `lineTotalKrw` is the parent-only persisted amount: the
fixed/range set price (including explicit zero), or numeric zero as the
nonbillable sum identity while the order/readback unit price stays NULL.
`childSubtotalKrw` is the selected billable atomic-child subtotal and
`finalTotalKrw = lineTotalKrw + childSubtotalKrw`; in fixed/range mode
`explicitExtraSubtotalKrw` is that same selected billable-child subtotal.
`roundingResultKrw` on a set parent equals `finalTotalKrw` and records neutral
`as_is` only to mean that B3 applies no second aggregate rounding; the
aggregate is the deterministic sum of already-rounded A3 child results plus
the server-owned set price. Each child stores its own A3 rule/result. Invoice persistence consumes the
parent `lineTotalKrw` once and the selected billable child line totals once;
it never uses the aggregate result as a second parent charge. A set-child
`lineTotalKrw`, `childSubtotalKrw`, and `finalTotalKrw` are its own frozen
line amount.

For applied_price_snapshot and calculation_outputs, derived is legal only for
the included_order_sum parent; fixed/range parent and every set_child use
taxable or non_taxable. billedAs = set_parent is legal only for a fixed/range
set parent, billedAs = nonbillable_parent only for a sum set parent, and
billedAs = atomic_child only for a set_child. No individual row uses these
B3 billedAs variants. B3 never chooses a child rule by selection order and
never rounds an already-frozen child line a second time; the A3/catalog rule
and result remain authoritative on each child.

Canonical key order is PostgreSQL jsonb canonical order; array order is root
revision-item sort_order, child revision-item sort_order, then leaf catalog ID
and revision-item UUID. The one hash authority is the canonical four-part
envelope, not applied_snapshot alone:

~~~sql
lower(encode(extensions.digest(
  convert_to(jsonb_build_object(
    'appliedSnapshot', applied_snapshot,
    'appliedPriceSnapshot', applied_price_snapshot,
    'calculationInputs', calculation_inputs,
    'calculationOutputs', calculation_outputs
  )::text, 'UTF8'),
  'sha256'
), 'hex'))
~~~

The migration constrains all four objects to schemaVersion 1 only for set and
set_child, requires individual rows to retain A3 schema 0/hash NULL, and
checks exactly: parent/child row and lineage IDs; every selected parent item
versus its persisted child frozen projection and embedded snapshot (not just
path/leaf IDs); default/final selection and quantity/source; pinned versus
applied catalog revisions; billing reflection; amount basis, billedAs, NULL/
zero, tax union, and price; and roundingRule/result against the A3 calculator
output. It stores this envelope hash only in applied_snapshot_sha256. Getter
rows return snapshotSchemaVersion, snapshotHash, and all four objects.
Historical getters, fulfillment, and invoice lines use these frozen objects
only; they never join mutable definitions. A3 copies the frozen order snapshot
to invoice_lines without adding an invoice hash column.

The exact cross-object assertions are: a set parent has items non-NULL,
sourceSetRevisionItemId NULL, billedAs set_parent or nonbillable_parent, and
no catalog price; a set_child has items NULL, a non-empty path,
sourceSetRevisionItemId equal to the path leaf, billedAs atomic_child, and its
sourcePreset/catalog/revision fields equal to the leaf item; every item and
child quantity/source, default/final selection, billing flag, price/tax,
roundingRule, and roundingResult match; included_order_sum has setPriceKrw
NULL and taxType derived; set_fixed_price/range_price have taxType
taxable/non_taxable and no derived sentinel. For the parent, lineTotalKrw
equals the persisted parent/invoice money value and finalTotalKrw includes
the child subtotal; for a child, all three line-total fields equal that
child's frozen amount. A failed assertion rolls back the whole expansion.

## Pricing, tax, fulfillment, billing

Fixed mode: parent is one line with the saved revision-pinned set amount
(zero is free); included children are nonbillable. Only revision-pinned
atomic rows whose billing reflection is true are explicit extras, and each
bills once from its saved draft price/tax and A3 frozen roundingRule/result;
staff cannot toggle this status.
Parent tax is the saved fixed tax type; a billable NULL fixed amount returns
order_set_price_unset.

Sum mode: parent is nonbillable with unit price NULL and tax derived; selected
billable atomic children bill once from their saved draft price/tax and A3
frozen roundingRule/result;
nonbillable NULL remains NULL; billable NULL at draft/confirm rejects before
confirmation; zero is an accepted zero line; parent and nested containers
never bill; mixed tax is derived by the existing A3 policy. A catalog price/
tax change after draft save does not reprice a usable frozen pin. A fixed
parent-once, fixed explicit-extra, sum child-only, nested nonbillable,
tax-mixed, zero, and billable-NULL regression fixture is required.

Range mode uses PR-005 Option A: `patient_weight_kg` and `manual_value` are
continuous `[0,+infinity)`, lower-inclusive/upper-exclusive, start at `0`,
remain contiguous, and end with exactly one open upper bound. The server
selects the one bracket from the frozen revision and uses its amount as the
parent price, with the range basis/input/bracket/tax/total frozen in the four
snapshot objects. A valid Option A revision has no no-match case; malformed
input is rejected before expansion.

Fulfillment receives selected atomic child IDs only and builds immutable
source_snapshot from frozen orders; remove caller orderSnapshots and
persistSupabaseSnapshotEnrichment in the A3 owner. Billing uses the A3 chart
wrapper: fixed/range parent once plus revision-pinned explicit extras, sum
selected child lines only; NULL billable rejects, zero persists, invoice
  source snapshot stays anchored. Downstream retry never expands again. The
  action's live root-set, nested-set, catalog availability, and catalog-revision
  checks run only for confirm; bill uses the persisted confirmed parent/child
  rows, frozen snapshots, and billing flags without rejoining mutable catalog
  or set definitions.

## Permissions and safe errors

Search requires active member plus service_catalog:view. Encounter preview
requires active member plus the existing chart:update permission and the
same-workspace encounter DB check; it then calls the private helper. Draft/
confirm/bill require active member plus chart:update. Management remains
service_catalog:manage. auth.uid equals actor; encounter/order/set/revision/
item/catalog all share workspace. Public RPCs have fixed search path, revoke
public/anon/service_role, and grant authenticated only. Private expansion has
no authenticated grant. Direct DML and service_role shortcuts are denied.

| Error | HTTP | Contract |
| --- | --- | --- |
| unauthenticated | 401 | No actor session. |
| workspace_membership_missing, permission_missing | 403 | Membership/DB permission denied. |
| order_set_not_found, order_set_workspace_mismatch | 404 | Hide other-workspace identity. |
| encounter_unavailable | existing 409 | Existing chart route contract. |
| if_match_required | 428 | Missing ETag header/body. |
| etag_header_body_mismatch | 400 | Header and body ETag are not byte-equal. |
| revision_conflict, draft_revision_conflict, stale_status, idempotency_conflict | 409 | CAS/lifecycle/retry conflict. |
| child_revision_requires_refresh, catalog_revision_requires_refresh | 409 | Exact pin cannot apply. |
| order_set_member_unavailable | 422 | Composition-review-blocked, unavailable, or invalid member. |
| order_set_cycle_detected, order_set_depth_exceeded, order_set_duplicate_atomic | 422 | Invalid graph; rollback. |
| order_set_quantity_invalid, invalid_order_selection | 422 | Invalid selection/quantity; rollback. |
| order_set_price_unset | 422 | Billable NULL price. |
| order_set_range_input_required, order_set_range_input_invalid, order_set_range_no_match | 422 | Range input is missing, out of numeric(12,3) bounds, or cannot match the frozen revision range. |

Return a typed failure envelope and safe Korean message; never expose raw SQL,
another workspace, source instructions, or client-calculated amount. Preserve
the existing copy: `아직 완료되지 않은 오더가 있습니다. 수납을 진행할까요?`.
No new notification is emitted for chart selection. The existing A3 central
audit/event contract carries set/revision/hash metadata; PR-005 review
notifications remain the review owner.

## Chart UI states and copy

The existing chart Order area/dialog remains the presentation owner; no new
component or UI dependency is introduced.

- Search ready: an atomic row keeps its current display. A fixed set shows
  `세트 금액` and the server amount, including `무료` for explicit zero. A sum set
  shows `구성 항목 합계` and does not show a fabricated set price. A NULL
  non-billable atomic value displays `가격 미설정` only as a display state; it
  never becomes a zero charge.
- Preview loading: show `Order 세트 구성을 불러오는 중이에요.` and disable
  the add/confirm controls for that row. Preview failure keeps the row
  uncommitted and shows `Order 세트 구성을 불러오지 못했어요. 다시 시도해 주세요.`.
- Expanded copy: show `Order 세트 구성`, selected count, default-selected
  atomic members, quantity input, revision-pinned billing status as
  read-only, and the server total. The child-set container is labelled `구성 묶음`
  and cannot be independently billed or confirmed. Billing status remains
  revision-pinned and read-only.
- Empty selection: disable `저장` and `확정` and show
  `하나 이상의 구성 항목을 선택해 주세요.` Invalid quantity shows
  `수량을 확인해 주세요.`. A server
  409/422 maps to the safe domain message and leaves the local draft dirty.
- Range selection: require the approved numeric range input, show the matched
  frozen bracket and server total, and keep the revision-pinned billing status
  read-only. A missing, invalid, or unmatched input leaves the row
  uncommitted and shows `가격 범위를 확인해 주세요.`.
- Draft saved: use the existing `Order 업데이트 저장` flow and show
  `Order 업데이트를 저장했어요.` The server ETag is retained; a stale ETag
  shows `다른 사용자가 오더를 변경했어요. 다시 불러온 뒤 저장해 주세요.`.
- Confirmation: keep the existing `Order 확정` and `Order 청구` actions and the
  exact copy `아직 완료되지 않은 오더가 있습니다. 수납을 진행할까요?`.
  A successful set confirmation shows `Order 확정 상태를 저장했어요.` A
  permission, pin, price, or composition failure does not optimistically
  mark any parent or child confirmed.

## Existing-row preflight and quarantine

Before B3 constraints/writes, the replay reads:

- Existing individual/service rows: untouched. New catalog rows use A3
  service_item_id NULL.
- Existing set/set_child rows missing revision/item lineage, schema 1, or
  hash: never reinterpreted. Any confirmed/billed such row raises
  clinical_master_b3_preflight_confirmed_set_unresolved and aborts before
  DDL. A draft/pending row with the same gap is emitted as
  clinical_master_b3_preflight_legacy_set_draft_unresolved, requires reviewed
  cancel/re-entry, and also aborts before DDL. A valid pinned schema-1 draft
  passes reapply and is never classified as legacy merely because it is a
  draft; no row is silently excluded while the migration continues.
  Any cancelled or otherwise non-terminal legacy set row with the same gap
  raises clinical_master_b3_preflight_set_snapshot_unresolved and aborts;
  no status is silently converted to schema 1.
- B2 native revisions: consume only exact stable/revision/item rows; never
  read mutable order_set_items as a new authority.
- The preflight reports temporary-row count as
  clinical_master_b3_legacy_temporary_row_present and stops before DDL. The
  fresh B3 fixture must prove zero; existing rows require the explicit A3
  legacy read path and predecessor-gate remediation before the migration is
  rerun. Such rows stay excluded from the B3 runtime DTO union and have no new
  writer; B3 never widens its DTO or reinterprets them.
- Any cross-workspace, duplicate, invalid hash, billable NULL, partial
  confirmed/billed set snapshot, or revision-item workspace-key collision is a
  deterministic fatal report. Draft/pending rows are quarantined by report
  only for reviewed remediation; no physical quarantine table, auto-cancel,
  delete, conversion, or current-definition reattachment is allowed.

The complete preflight runs before the named constraint drop/recreate, quantity
generated-column replacement, unique indexes, and FKs. A successful preflight
is the only path to DDL. Legacy snapshots remain readable through legacy paths;
historical B3 reads never join current mutable definitions.

## Exact implementation allowlist

SQL/replay:

- supabase/migrations/20260820140000_clinical_master_phase1b3_chart_set_runtime.sql
  for B3 lineage/snapshot columns, preflight, named constraint
  drop/recreate, numeric(12,3) quantity/generated totals, the
  order_set_revision_items workspace unique target, root-revision and leaf
  tenant FKs, one-level lineage trigger, v2 search, private expansion,
  preview, forward-replaced draft/action RPCs,
  grants/revokes/RLS, and safe errors. Old migrations are not edited.
- New supabase/snippets/clinical_master_phase1b3_replay.sql for reset,
  preflight, fixed/sum/Option-A-range fixtures, permission, and barriers. The
  range fixture uses the B2 native revision adapter and never writes a mutable
  legacy range source.
- supabase/seed.sql only for the existing B2 adapter if a fixed/sum native
  fresh-reset fixture is genuinely absent; never mutable order_set_items or
  range seed.

Server/gateway/type:

- src/features/hospital-admin/server-order-catalog-core.ts
- src/features/hospital-admin/server-order-catalog.ts
- src/app/api/workspaces/[workspaceId]/hospital-admin/order-catalog/route.ts
- src/app/api/workspaces/[workspaceId]/hospital-admin/order-sets/[orderSetId]/expand/route.ts
- src/features/chart/server-order-draft-persistence-core.ts
- src/features/chart/server-order-draft-persistence.ts
- src/features/chart/server-order-action-persistence-core.ts
- src/features/chart/server-order-action-persistence.ts
- src/app/api/workspaces/[workspaceId]/chart/order-drafts/route.ts
- src/app/api/workspaces/[workspaceId]/chart/order-actions/route.ts
- src/features/chart/module.tsx
- src/features/fulfillment/server-fulfillment-work-item-core.ts
- src/features/fulfillment/server-fulfillment-work-item.ts
- src/features/billing/server-invoice-candidate-sync-core.ts
- src/features/billing/server-invoice-candidate-sync.ts
- src/features/billing/server-invoice-line-persistence-core.ts only for the
  existing A3 reader compatibility assertion: frozen set parent
  categoryGroup=set maps to billingCategory=other. No new billing mapper or
  category is added.
- src/types/emr-domain.ts only for minimal nullable lineage/chart union after
  actual A3; do not alter global queue order type for parent display.

The caller snapshot/enrichment path, client merge authority, old unsupported
branch, and old expansion 404 are forward-replaced in these owners. No
parallel writer is added. Existing UI other-category mapping remains unchanged
after the focused invoice-line reader test proves the frozen set-parent
projection.

Tests/fixtures:

- New tests/fixtures/clinical-master-phase1b3.fixture.json
- New tests/clinical-master-phase1b3.spec.ts
- New tests/clinical-master-phase1b3-chart-search-migration.spec.ts
- tests/chart.spec.ts
- tests/chart-order-draft-persistence-server.spec.ts
- tests/chart-order-action-persistence-server.spec.ts
- tests/fulfillment-work-item-server.spec.ts
- tests/billing-invoice-candidate-sync-server.spec.ts
- tests/billing-invoice-line-persistence-server.spec.ts

The migration spec owns preflight, named constraint branches,
numeric(12,3) max-range advisory/generated parity, leaf owner-FK and
one-level parent trigger, revision-item unique, and role/RLS checks. The chart
spec owns schema-1 set/set_child only (individual stays A3 schema 0), the
parent ordered items array, root/direct/nested origin IDs, pinned/applied
catalog revisions, A3 sourcePreset/version and runtime-context fields,
roundingRule/result, and all four-object cross-field/hash assertions.
The chart specs own closed search parsing, flattened defaults, DTO rejection,
fresh-ETag child reconciliation, confirmation/retry, and frozen snapshots.
Existing fulfillment/billing specs own selected-child-only work items,
fixed/sum invoice parity, set-parent categoryGroup=set/billingCategory=other
readback, A3 rounding parity, and duplicate-anchor regression. This is the
focused B3 set; no notification test or broad suite expansion is added.

After implementation review, the only documentation closeout allowlist is
this PR-006 file and its single PR-006 row in docs/work/index.md for reviewed
status/closeout wording. No other work item, status, or architecture file is
part of B3 closeout.

No new production notification, generic framework, dependency, ledger, or
unrelated documentation file is allowed.

## Focused executable verification

Run only after gates, locally:

1. Exact reset/replay:

~~~sh
supabase db reset --local
psql "$LOCAL_DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f supabase/snippets/clinical_master_phase1b3_replay.sql
~~~

   Assert fresh reset uses B2 native revision seed, fixed/sum/Option-A range,
   and no mutable set authority.
2. Test anonymous, inactive, ordinary, chart:update,
   service_catalog:view/manage, billing:issue, queue permissions, direct DML,
   private helper, service_role shortcut, cross-workspace, and actor mismatch.
3. Run two-session draft CAS, same-set expansion, confirm, fulfillment unique,
   and invoice anchor barriers; assert exactly one conflict and no duplicate
   parent/child/order/invoice line.
4. Assert old eight-column search remains atomic-only and exact signature/ACL;
   v2 exact aliases/union; pending/review-blocked/inactive/invalid sets absent;
   sum set price NULL and fixed zero 0 across SQL/TS/UI/billing.
5. Add set, preview, verify defaults/order/path/quantity/parent-child DTO/ETag;
   tampered client price/snapshot/category is ignored or rejected. Save/reload
   getter and compare every lineage, snapshot/hash, NULL/zero, selection,
   quantity, and ETag; stale mutable draft/pending If-Match is
   revision_conflict/409 with no writes; an exact terminal confirm/bill tuple
   returns the stored result; a changed terminal tuple is
   idempotency_conflict/409; header/body ETag inequality is always 400.
6. Confirm fixed/sum/range. Assert fixed parent
   once plus extras, sum child lines only, nested containers never bill,
   tax/mixed derivation, zero versus billable NULL, exact rejection codes for
   cycles/depth/duplicates/workspace/pins/selection/quantity/price/range.
7. Confirm selected atomic lab/imaging/dispensing/treatment rows. Assert
   frozen-order fulfillment, children only, no enrichment/parent work item,
   and idempotent retry. Assert A3 billing wrapper, frozen invoice lines, no
   duplicate anchor.
8. Change current catalog/set data after application; assert historical draft/
   confirmed/fulfillment/invoice rows and hashes remain unchanged. Run the
   stale mutable ETag, exact terminal retry, and changed terminal tuple as
   separate cases; assert no mutable catalog read or partial child write on
   terminal retry. Preserve existing Korean billing copy and individual search
   behavior.

The focused executable commands are:

~~~sh
npx playwright test \
  tests/clinical-master-phase1b3.spec.ts \
  tests/clinical-master-phase1b3-chart-search-migration.spec.ts \
  tests/chart.spec.ts \
  tests/chart-order-draft-persistence-server.spec.ts \
  tests/chart-order-action-persistence-server.spec.ts \
  tests/fulfillment-work-item-server.spec.ts \
  tests/billing-invoice-candidate-sync-server.spec.ts \
  tests/billing-invoice-line-persistence-server.spec.ts \
  --project=chromium
npx tsc --noEmit
npm run lint -- \
  src/features/hospital-admin/server-order-catalog-core.ts \
  src/features/hospital-admin/server-order-catalog.ts \
  src/features/chart/server-order-draft-persistence-core.ts \
  src/features/chart/server-order-draft-persistence.ts \
  src/features/chart/server-order-action-persistence-core.ts \
  src/features/chart/server-order-action-persistence.ts \
  src/features/fulfillment/server-fulfillment-work-item-core.ts \
  src/features/fulfillment/server-fulfillment-work-item.ts \
  src/features/billing/server-invoice-candidate-sync-core.ts \
  src/features/billing/server-invoice-candidate-sync.ts \
  src/features/billing/server-invoice-line-persistence-core.ts \
  'src/app/api/workspaces/[workspaceId]/hospital-admin/order-catalog/route.ts' \
  'src/app/api/workspaces/[workspaceId]/hospital-admin/order-sets/[orderSetId]/expand/route.ts' \
  'src/app/api/workspaces/[workspaceId]/chart/order-drafts/route.ts' \
  'src/app/api/workspaces/[workspaceId]/chart/order-actions/route.ts' \
  src/types/emr-domain.ts \
  src/features/chart/module.tsx
~~~

No broad test suite, notification test, runtime command, Docker, or remote
execution is part of this planning task.

No runtime command is executed by this worker; the parent owns local Docker,
reset/replay, permission, and two-session runtime gates.

## Sol xhigh review handoff

The six predecessor gates, clean existing-row preflight, and actual A3
signatures/ACLs are recorded as confirmed; human delivery review remains.

Independent review should challenge: v2 NULL/zero and closed union; every
client snapshot writer; private helper/lock order/exact pin and rollback;
fixed/sum billing/tax/fulfillment/invoice reuse; legacy quarantine without
 reinterpretation; and the Option-A lower-inclusive/upper-exclusive range
 boundary.
