---
id: "CLINICAL-MASTER-PR-003"
status: "human_review"
area: "clinical-master"
priority: "P0"
target_pr: "A1/A2/A3 local synthetic reset/reapply/replay/security/two-session gates PASS; Sol APPROVE/MUST-FIX 0; local-only human review"
updated: "2026-08-20"
---

# Clinical Master Phase 1A-3: Sole Order Authority

## Status and gate

The A1/A2/A3 local synthetic runtime/security gates are PASS. Pinned
`supabase@2.115.0` reset/reapply, ON_ERROR_STOP replay with rollback cleanup,
direct lineage/snapshot readback, RLS/grant and direct-DML denials, wrapper
permission boundaries, immutable retry behavior, and the two-session billing
anchor and fulfillment row-lock races all passed. Independent Sol review is
`APPROVE` with `MUST-FIX 0`; human acceptance remains pending. The approved
set/lab boundary is preserved.

This closeout is local-only. No remote Supabase, real data, production,
deployment, commit, push, PR, or other external state change was performed.

## Intent and approved boundary

Make `public.order_catalog_items` the sole write authority for new individual
order flows. A chart user supplies only workspace-scoped selection and
encounter intent; the trusted server/database reads the active workspace row and
persists the applied snapshot.

Included:

- direct catalog lineage on `public.orders`;
- server-owned draft and confirmation snapshots for new catalog-origin rows;
- `service_item_id` compatibility behavior for existing legacy rows;
- immutable fulfillment and billing handoff snapshots;
- workspace/role/RPC/grant enforcement;
- synthetic local migration, replay, and focused test evidence;
- the narrow billing-reader compatibility change needed to categorize catalog
  invoice lines without a service ID.

Explicitly excluded:

- deletion, replacement, or dual-write authoring of `service_*` tables;
- Order Set revisions, expansion, or runtime;
- laboratory result runtime, result persistence, or a new lab adapter;
- Phase 1B work, diagnosis runtime, safety-blocking policy, or new domain enums;
- remote database, real hospital data, network, Docker, Git, deployment, and PR
  operations.

The existing chart set behavior remains unchanged: catalog set confirmation
continues to return `unsupported_order_type`. A catalog lab order may reach the
generic fulfillment handoff with its catalog lineage, but laboratory
result-sheet/runtime support is not an A3 completion claim.

## Predecessor and current evidence

The target and migration sequence are already approved; this work item does not
re-open those decisions.

- The target declares `order_catalog_items` the sole future workspace order
  authority, `service_*` compatibility-only, and direct order lineage plus
  applied snapshots as historical authority:
  `docs/engineering/data-model/clair-clinical-master-data-phase-1-db-spec.md`
  (lines 76-86, 106-116).
- The approved A3 sequence is to stop new `service_*` authoring, write
  `workspace_catalog_item_id` and catalog snapshots for new confirmations,
  leave `service_item_id` nullable for legacy rows, use only explicit mapping if
  preservation requires it, and not drop `service_*`:
  `docs/engineering/data-model/clair-clinical-master-data-phase-1-db-spec.md`
  (lines 809-836).
- The target order columns and indexes are defined at:
  `docs/engineering/data-model/clair-clinical-master-data-phase-1-db-spec.md`
  (lines 689-726).
- Existing `orders.service_item_id` is already nullable, but the table has no
  direct catalog lineage:
  `supabase/migrations/20260519160000_clinical_order_billing_schema_foundation.sql`
  (lines 116-149);
  `supabase/migrations/20260519170000_chart_order_snapshot_bridge.sql`
  (lines 4-32).
- Existing catalog IDs are text and current price is non-null/default zero:
  `supabase/migrations/20260520152000_hospital_admin_order_catalog_persistence.sql`
  (lines 4-39).
  A2 is responsible for nullable price, catalog revision, master lineage, and
  authenticated direct-DML revocation:
  `docs/work/clinical-master/CLINICAL-MASTER-PR-002-phase-1a-2-workspace-adoption.md`
  (lines 76-130).
- Current chart search places `workspaceCatalogItemId` inside the applied JSON
  snapshot but returns preset identity as `source_preset_id`:
  `supabase/migrations/20260527090000_order_catalog_chart_search_rpc.sql`
  (lines 5-50).
- The latest draft RPC accepts and stores client names, prices, source IDs, and
  snapshots:
  `supabase/migrations/20260528075852_den_306_chart_draft_order_id_boundary.sql`
  (lines 18-121, 123-230, 240-312).
- The latest action RPC changes status/confirmation and billing state but does
  not re-read catalog or persist a server-built confirmation snapshot:
  `supabase/migrations/20260615025340_den_505_rpc_role_audit_hardening.sql`
  (lines 56-150).
- The current draft getter returns `unitPriceSnapshot` with
  `COALESCE(..., 0)` and exposes only a reduced JSON shape:
  `supabase/migrations/20260519210000_chart_order_draft_persistence_rpc.sql`
  (lines 31-51);
  `supabase/migrations/20260528075852_den_306_chart_draft_order_id_boundary.sql`
  (lines 351-354).
- The current action getter returns lifecycle fields but does not return a
  persisted applied snapshot, direct catalog/master lineage, or catalog
  revision:
  `supabase/migrations/20260519220000_chart_order_action_persistence_rpc.sql`
  (lines 30-53);
  `supabase/migrations/20260615025340_den_505_rpc_role_audit_hardening.sql`
  (lines 233-241).
- The TypeScript confirmation resolver matches by `sourcePresetId` and keeps
  set rejection:
  `src/features/chart/server-order-action-persistence-core.ts` (lines 806-930).
- The chart UI currently assigns a catalog preset ID to `serviceItemId` when
  creating and restoring orders:
  `src/features/chart/module.tsx` (lines 3918-3928, 4712-4751).
- Fulfillment currently projects `sourcePresetId` into `serviceItemId` and
  refreshes source snapshots on conflict:
  `src/features/fulfillment/server-fulfillment-work-item-core.ts`
  (lines 1128-1153, 1282-1328);
  `supabase/migrations/20260523094400_order_fulfillment_work_item_contract.sql`
  (lines 195-264).
- Billing currently creates invoice lines from order service IDs/snapshots but
  updates existing line snapshots on retry:
  `supabase/migrations/20260530141423_den_329_billing_candidate_invoice_anchor.sql`
  (lines 107-177).
- Billing UI currently derives category only from service ID prefixes:
  `src/features/billing/module.tsx` (lines 390-398).
- The current billing line read RPC returns persisted line values without a
  canonical catalog/master category projection, while chart confirmation maps
  catalog classification to an operational order type and the UI consumes the
  service-prefix category path:
  `supabase/migrations/20260520100000_billing_invoice_line_persistence_rpc.sql`
  (lines 50-66),
  `src/features/chart/server-order-action-persistence-core.ts` (lines 975-981),
  `src/features/billing/module.tsx` (lines 380-398), and
  `docs/engineering/data-model/clair-clinical-master-data-phase-1-db-spec.md`
  (lines 719-726).
- Fulfillment exposes a SECURITY DEFINER authenticated RPC that replaces
  `source_snapshot` from caller JSON, and the live TypeScript gateway calls it
  after the DB sync:
  `supabase/migrations/20260719051725_performance_batch_rpc_followup.sql`
  (lines 104-112,174-190,239-248);
  `src/features/fulfillment/server-fulfillment-work-item-core.ts`
  (lines 1008-1035,1110-1153).
- Billing candidate sync is called from the direct billing route, chart action,
  and fulfillment transition/review paths, while the current DB RPC only checks
  membership:
  `src/features/billing/server-invoice-candidate-sync-core.ts`
  (lines 208-250);
  `src/features/chart/server-order-action-persistence-core.ts`
  (lines 307-311,387-397);
  `src/features/fulfillment/server-fulfillment-work-item-core.ts`
  (lines 404-440,665-673,1406-1421);
  `supabase/migrations/20260530141423_den_329_billing_candidate_invoice_anchor.sql`
  (lines 23-55,230-231).
- The current TypeScript billing candidate mock/gateway path also normalizes a
  missing price to zero (`src/features/billing/server-invoice-candidate-sync-core.ts`,
  line 367); A3 removes that normalization for the draft/action/fulfillment
  contracts and rejects billable NULL before invoice-line creation.
- The draft contract currently requires a numeric price and rejects a nullable
  persisted row in its mapper (`src/features/chart/server-order-draft-persistence-core.ts`,
  lines 28-35, 534-558); the action snapshot contract and validator do the same
  (`src/features/chart/server-order-action-persistence-core.ts`, lines 60-70,
  1090-1102). These exact type/mapping boundaries are A3 ownership points.
- Existing invoice-line uniqueness is only partial `(invoice_id, order_id)` and
  the billing RPC updates frozen fields on retry:
  `supabase/migrations/20260519160000_clinical_order_billing_schema_foundation.sql`
  (lines 280-285);
  `supabase/migrations/20260530141423_den_329_billing_candidate_invoice_anchor.sql`
  (lines 58-92,154-177).
- The current bridge/seed path can contain an invoice line with `order_id` but
  no corresponding `orders.invoice_line_id`; the billing sync currently does
  not adopt that anchor:
  `supabase/migrations/20260519170000_chart_order_snapshot_bridge.sql`
  (lines 20-24,201-211),
  `supabase/migrations/20260530141423_den_329_billing_candidate_invoice_anchor.sql`
  (lines 98-177), and `supabase/seed.sql` (lines 2430-2453,2470-2492).
- Invoice lines are linked to both invoices and orders, and the current schema
  carries the invoice encounter separately from the order encounter. A3 must
  reject an anchor whose invoice and order encounters differ:
  `supabase/migrations/20260519160000_clinical_order_billing_schema_foundation.sql`
  (lines 181-188, 209-214, 547-570).
- Existing synthetic service/catalog/order/fulfillment/invoice rows must remain
  compatibility data:
  `supabase/seed.sql` (lines 864-944, 951-1029, 2300-2501).

## Authority and provenance invariants

### New catalog-origin rows

Every new individual chart order must satisfy all of the following:

- `orders.workspace_catalog_item_id IS NOT NULL`;
- `orders.service_item_id IS NULL`;
- `orders.row_type = 'individual'`;
- the direct catalog ID belongs to the same workspace and resolves to an active
  catalog row at the time a draft/confirmation snapshot is built;
- an active billable row has non-null `price_krw`; explicit `0` is a valid free
  price; non-billable NULL remains NULL in the snapshot;
- `workspace_catalog_revision > 0`;
- source master ID/revision are both NULL or both present and valid;
- direct lineage and JSON snapshot lineage agree;
- names, category, routing, task/billing flags, tax, unit, price, source
  revisions, and snapshot values come from the locked server catalog row;
- quantity and encounter-specific intent are the only client-controlled order
  inputs;
- confirmation persists the server-built snapshot in the same transaction as
  confirmation state;
- after confirmation, catalog changes and retries never refresh chart,
  fulfillment, or billing snapshots.

### Legacy compatibility rows

`workspace_catalog_item_id IS NULL` is the technical legacy bucket. Existing
`service_item_id` values, service price references, fulfillment snapshots, and
invoice snapshots are preserved. A NULL `service_item_id` in an old row is not
retroactively guessed into catalog provenance.

Do not add a redundant `order_origin` enum or discriminator. Do not infer
provenance from names, price, `source_order_id`, `source_preset_version`,
`t_code`, `origin_code`, or `pricing_rule.linkedServiceItemId`. The direct
catalog lineage column is the new-flow discriminator approved by the target
architecture.

Client price, display/billing name, classification, source IDs, master IDs,
revision fields, and applied snapshots are never authoritative.

## Migration contract

Create one forward migration after the actual A2 migration, for example:

`supabase/migrations/<next-after-A2>_clinical_master_phase1a3_order_authority.sql`

Do not edit A1/A2 predecessor migrations. The implementation worker must fail
preflight if the A2 composite target key or required catalog revision columns do
not exist.

### `public.orders` columns and FKs

Add nullable columns:

- `workspace_catalog_item_id text`;
- `source_master_record_id uuid`;
- `source_master_revision integer`;
- `workspace_catalog_revision integer`.

Add tenant-safe FK `(workspace_id, workspace_catalog_item_id)` to
`order_catalog_items(workspace_id, id)`. Add `source_master_record_id` FK to
`master.master_records(id)` and `(source_master_record_id,
source_master_revision)` FK to `master.master_record_versions(master_record_id,
revision)`. Use restrictive behavior for master/catalog deletion; historical
orders must not lose their source identity.

Keep `service_item_id`, `source_order_id`, `source_order_version`, existing
hierarchy columns, and JSON snapshot columns. For new rows, source order fields
are server-generated compatibility projections only.

### Constraints and indexes

Add constraints that:

- reject `workspace_catalog_item_id IS NOT NULL AND service_item_id IS NOT NULL`;
- require catalog-origin rows to be individual rows;
- require positive catalog revision when direct catalog ID exists;
- require source master ID/revision to be paired;
- require object `applied_snapshot` for catalog-origin rows;
- require `applied_snapshot.workspaceCatalogItemId` and
  `workspaceCatalogRevision` to match direct columns;
- preserve nullable `service_item_id` for all existing compatibility rows.

Add partial indexes on:

- `(workspace_id, workspace_catalog_item_id)`;
- `(workspace_id, source_master_record_id, source_master_revision)`.

Retain existing workspace/service and order status indexes.

### Billing anchor and invoice-line uniqueness

The A3 migration must add a preflight-validated unique partial index on
`invoice_lines(workspace_id, order_id) WHERE order_id IS NOT NULL`. The existing
partial `(invoice_id, order_id)` uniqueness is retained as a local invoice
constraint but is not sufficient to prevent one order from appearing in two
invoices.

`orders.invoice_line_id` is the single order-to-line anchor. Add/retain the
workspace composite FK and a unique partial index on
`orders(workspace_id, invoice_line_id) WHERE invoice_line_id IS NOT NULL`.
When a line is created, the same transaction inserts the line and sets the
order's `invoice_line_id`, then changes `billing_candidate_status` to
`invoice_linked`. A paid/settled transition may set the existing order state to
`billed`; it never creates another line.

#### Existing anchor adoption before the global unique index

Before creating either unique index, the A3 migration must materialize and
abort on these fatal anchor-corruption predicates:

- duplicate lines for one order:
  `invoice_lines.order_id IS NOT NULL GROUP BY
  (workspace_id, order_id) HAVING count(*) > 1`;
- an invoice line whose `order_id` does not resolve to an order in the same
  workspace, including `invoice_lines.workspace_id <> orders.workspace_id`;
- `orders.invoice_line_id` resolving to a line whose `workspace_id` differs or
  whose `order_id IS DISTINCT FROM orders.id`;
- one invoice line referenced by more than one order:
  `orders.invoice_line_id IS NOT NULL GROUP BY
  (workspace_id, invoice_line_id) HAVING count(*) > 1`;
- an order-linked invoice whose `invoices.encounter_id IS DISTINCT FROM
  orders.encounter_id`, including a same-workspace issued/paid invoice line;
- an order with both a non-null anchor and a different same-order
  `invoice_lines.order_id` line, which would make adoption ambiguous.

All six buckets are **fatal** and stop before constraints, FKs, or unique
indexes. No invoice line is merged or deleted. For an order with
`orders.invoice_line_id IS NULL` and exactly one same-workspace
`invoice_lines` row whose `order_id = orders.id` and whose joined invoice has
`invoices.workspace_id = orders.workspace_id` and
`invoices.encounter_id = orders.encounter_id`, the migration adopts the
existing line by setting only `orders.invoice_line_id` under the documented
lock order: workspace/encounter advisory lock, sorted `orders ... FOR UPDATE`,
then the sole candidate `invoice_lines ... FOR UPDATE`. `orders.invoice_line_id`
is the only order field allowed to change; every other order field and every
line/invoice field remains unchanged, including `service_item_id`, invoice
ID/status, description, quantity, unit price, line amount, source snapshot,
issued/paid state, and user edits. A rerun is idempotent: a matching non-null
anchor is a no-op; a NULL anchor adopts the same sole line; any duplicate,
mismatch, or encounter conflict re-enters the fatal report.

An existing issued/paid legacy order whose sole line is adopted returns that
same anchored line unchanged on retry. It never attaches an unanchored order to
a different issued/paid invoice and never rewrites the adopted line. The
same-workspace but cross-encounter issued/paid case is fatal in preflight and
remains unchanged. Synthetic replay must run preflight, adoption,
unique-index creation, reset,
and adoption a second time to prove idempotency.

The private billing helper takes a transaction advisory lock in this order:

1. `pg_advisory_xact_lock(hashtextextended('clinical_billing:' || workspace_id || ':' || encounter_id, 0))`;
2. selected `orders` rows, sorted by UUID, `FOR UPDATE`;
3. the selected draft invoice row `FOR UPDATE`, or the deterministic invoice
   insert while still holding the advisory lock;
4. the anchored `invoice_lines` row `FOR UPDATE` when `orders.invoice_line_id`
   is already populated.

Simultaneous first syncs therefore serialize: the winner creates one draft
invoice/line and anchor; the loser sees the anchor and returns that persisted
line. An existing draft invoice may receive a first line. An existing issued or
paid invoice may only be read through an existing anchor; an unanchored order
must not attach to an issued/paid invoice and returns `invoice_anchor_conflict`.
A paid retry returns the anchored line unchanged. A user-edited line retry
preserves edited description, quantity, amount, billing name, and source
snapshot. A request that names or reaches a different invoice while the order
is anchored returns `invoice_anchor_conflict` without a write.

### Preflight and legacy classification

The migration must materialize a read-only preflight report before adding
constraints. `workspace_catalog_item_id IS NULL` is decisive: a JSON claim does
not promote a row to catalog provenance.

| Bucket and SQL predicate | Status | Treatment | Allowed mapping |
| --- | --- | --- | --- |
| `workspace_catalog_item_id IS NOT NULL AND service_item_id IS NOT NULL` | Fatal | Stop migration; this violates the new-flow no-dual invariant | None. Do not null or rewrite either value automatically |
| `workspace_catalog_item_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM order_catalog_items c WHERE c.workspace_id = orders.workspace_id AND c.id = orders.workspace_catalog_item_id)` | Fatal | Stop migration; direct new-flow lineage is broken or cross-workspace | None; investigate the explicit producer/mapping |
| `workspace_catalog_item_id IS NOT NULL AND row_type IS DISTINCT FROM 'individual'` | Fatal | Stop migration; a direct catalog-origin row cannot be an Order Set/parent row in A3 | None; preserve the row for investigation and do not coerce its row type |
| `workspace_catalog_item_id IS NOT NULL AND (workspace_catalog_revision IS NULL OR workspace_catalog_revision <= 0)` | Fatal | Stop migration; direct catalog lineage has no valid workspace revision | None; do not infer a revision from JSON, price, or preset metadata |
| `workspace_catalog_item_id IS NOT NULL AND (source_master_record_id IS NULL) <> (source_master_revision IS NULL)` | Fatal | Stop migration; partial direct master lineage | None |
| `workspace_catalog_item_id IS NOT NULL AND ((source_master_record_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM master.master_records m WHERE m.id = orders.source_master_record_id)) OR (source_master_revision IS NOT NULL AND NOT EXISTS (SELECT 1 FROM master.master_record_versions v WHERE v.master_record_id = orders.source_master_record_id AND v.revision = orders.source_master_revision)))` | Fatal | Stop migration; direct master lineage is broken or cross-workspace | None; do not backfill from names, category, or JSON |
| `workspace_catalog_item_id IS NOT NULL` with missing/mismatched snapshot catalog ID or revision | Fatal for confirmed/billed; draft/pending is quarantined | Do not allow confirmation or downstream sync until a reviewed server snapshot is rebuilt | Only a reviewed synthetic mapping for a draft/pending row may rebuild the snapshot from the same-workspace catalog row |
| `workspace_catalog_item_id IS NOT NULL AND order_confirmation_status = 'cancelled' AND (applied_snapshot->>'workspaceCatalogItemId' IS DISTINCT FROM workspace_catalog_item_id::text OR applied_snapshot->>'workspaceCatalogRevision' IS DISTINCT FROM workspace_catalog_revision::text)` | Fatal | Stop migration; cancelled history still requires a self-consistent direct lineage snapshot | None; preserve the cancelled row and do not refresh its history |
| `workspace_catalog_item_id IS NULL AND service_item_id IS NOT NULL` | Tolerated/report-only | Legacy compatibility row; preserve service ID and all historical snapshots | No mapping |
| `workspace_catalog_item_id IS NULL AND service_item_id IS NULL AND order_confirmation_status IN ('confirmed','billed')` | Tolerated/report-only | Ambiguous historical compatibility row; preserve as legacy even if JSON contains a catalog claim | No mapping |
| `workspace_catalog_item_id IS NULL AND service_item_id IS NULL AND order_confirmation_status = 'cancelled'` | Tolerated/report-only | Cancelled legacy row; preserve as legacy and retain all historical JSON/snapshots | No mapping |
| `workspace_catalog_item_id IS NULL AND service_item_id IS NULL AND order_confirmation_status IN ('draft','pending')` | Tolerated/report-only before A3; fatal for any new A3 write | Existing ambiguous draft remains legacy and must be re-saved through the new catalog flow; a new A3 row without catalog ID is rejected | Reviewed synthetic mapping may repair only an explicitly identified draft/pending row |
| `workspace_catalog_item_id IS NULL AND applied_snapshot->>'workspaceCatalogItemId' IS NOT NULL` | Tolerated/report-only | Direct NULL wins; retain JSON as historical payload but do not treat it as provenance | No automatic JSON-based mapping |
| `source_order_id`/`source_preset_version` or `pricing_rule.linkedServiceItemId` without direct catalog ID | Tolerated/report-only | Compatibility metadata only | No mapping |
| `EXISTS (SELECT 1 FROM invoice_lines l LEFT JOIN orders o ON o.id = l.order_id WHERE l.order_id IS NOT NULL AND (o.id IS NULL OR l.workspace_id IS DISTINCT FROM o.workspace_id))` | Fatal | Stop billing migration; the line/order workspace boundary is corrupt | No line/order rewrite or deletion |
| `invoice_lines` duplicate `(workspace_id, order_id)` | Fatal | Stop billing migration; resolve the duplicate before the global unique anchor index | No automatic merge or line deletion |
| `EXISTS (SELECT 1 FROM orders o JOIN invoice_lines l ON l.id = o.invoice_line_id WHERE l.order_id IS DISTINCT FROM o.id OR l.workspace_id IS DISTINCT FROM o.workspace_id)` | Fatal | Stop billing migration; the order points to another order's line or a cross-workspace line | No anchor reassignment |
| `orders.invoice_line_id IN (SELECT invoice_line_id FROM orders WHERE invoice_line_id IS NOT NULL GROUP BY invoice_line_id HAVING count(*) > 1)` | Fatal | Stop billing migration; one line cannot be the global anchor for multiple orders | No automatic merge or line deletion |
| `EXISTS (SELECT 1 FROM invoice_lines l WHERE l.workspace_id = orders.workspace_id AND l.order_id = orders.id AND l.id IS DISTINCT FROM orders.invoice_line_id)` | Fatal | Stop billing migration; adoption would have multiple candidate anchors | No automatic selection |
| `EXISTS (SELECT 1 FROM invoice_lines l JOIN invoices i ON i.id = l.invoice_id WHERE l.order_id IS NOT NULL AND (i.workspace_id IS DISTINCT FROM (SELECT o.workspace_id FROM orders o WHERE o.id = l.order_id) OR i.encounter_id IS DISTINCT FROM (SELECT o.encounter_id FROM orders o WHERE o.id = l.order_id)))` | Fatal | Stop billing migration; invoice and order workspace/encounter do not match | No adoption, reassignment, or invoice/line rewrite |
| `orders.invoice_line_id IS NULL` and exactly one same-workspace, same-encounter `invoice_lines` row joined through `invoices` has `order_id = orders.id` | Tolerated until adoption; deterministic backfill | Lock and set only `orders.invoice_line_id`; then re-read and classify as adopted | The existing line is the only allowed mapping; all other order, line, and invoice fields remain unchanged |
| `orders.invoice_line_id IS NULL` and no order-linked invoice line exists | Tolerated/report-only | Leave unanchored; a later eligible billing sync may create one line under the A3 helper | No historical line or invoice is invented |

The preflight must distinguish draft/pending, confirmed/billed, and cancelled
exactly as the table states. Anchor adoption is a separate deterministic
temporary step, not provenance inference: it may set only a NULL
`orders.invoice_line_id` when the one same-workspace, same-encounter line is
proven, and must leave all other order, line, invoice, snapshot, issued/paid,
and user-edited values untouched. A reviewed synthetic catalog mapping must be
an explicit temporary
table or replay input containing workspace, order ID, catalog ID, reviewer
reason, expected pre-state, and expected catalog revision. It must lock both
rows, verify same workspace and draft/pending status, build a server snapshot,
and be idempotent. Neither procedure may use names, price, JSON claims,
`source_order_id`, or `linkedServiceItemId` as identity evidence. No automatic
historical lineage backfill, service-table write, invoice-line merge, or
destructive cleanup is allowed.

### RLS and grants

Keep RLS enabled on orders, invoice lines, and catalog tables. Authenticated
clients receive no direct order/invoice mutation grant. A2 must first revoke
catalog direct insert/update/delete and remove direct mutation policies. A3 must
not grant them again.

Only fixed-search-path `SECURITY DEFINER` chart draft/confirmation and existing
fulfillment/billing wrapper RPCs receive authenticated EXECUTE. Every write RPC
checks active same-workspace membership, `auth.uid()` actor equality, required
permission, encounter scope, selected order scope, and catalog workspace scope.
Unauthenticated, inactive, ordinary unauthorized, and cross-workspace calls fail.

### Server snapshot fields

The server-built `orders.applied_snapshot` and `applied_price_snapshot` must
include, at minimum:

- direct catalog ID and catalog revision;
- source master ID/revision when present;
- source preset/version as compatibility metadata;
- standard/display/billing names;
- source catalog `categoryGroup` plus frozen `billingCategory`, validated against
  the canonical CG/NT/classification path but never reinterpreted as PDF CG or
  operational `order_type`, alongside order type, price, quantity, and line
  total;
- sales unit, tax, amount basis, rounding;
- target species, destination, task-required, billing-reflection;
- care guide/internal instruction and type-specific runtime context;
- row type and server calculation provenance.

`invoice_lines.source_order_snapshot` must copy the frozen order snapshot and
lineage. It must not depend on a later mutable catalog join.

### NULL versus explicit zero

NULL/zero semantics must survive every boundary. The following exact contracts
are required:

- `OrderCatalogItem.priceKrw`, `OrderPricingRule.priceKrw`, and catalog DB row
  mappers are `number | null` after A2.
- `ChartOrderDraftLine.unitPriceSnapshot` and the normalized draft line are
  `number | null`; `ChartOrderAppliedSnapshot.priceKrw` and its readback mapper
  are `number | null`; `lineTotalSnapshot` remains a server-generated number
  using SQL's `quantity * coalesce(price, 0)` only for arithmetic.
- `ChartOrderActionLine.appliedSnapshot.priceKrw`,
  `FulfillmentOrderSnapshotInput.priceKrw`, and
  `InvoiceCandidateOrderSnapshotInput.priceKrw` are explicitly
  `number | null` in their TypeScript contracts. `EmrOrder` and `InvoiceLine`
  retain nullable service identity and add nullable direct catalog lineage;
  persisted `InvoiceLine.unitPrice` is numeric only after the billing wrapper
  has accepted a billable price.
- `FulfillmentOrderSnapshotInput.priceKrw` and source detail
  `unitPriceSnapshot` are `number | null`. A catalog-origin non-billable NULL is
  copied as JSON NULL, not converted to zero.
- `InvoiceCandidateOrderSnapshotInput.priceKrw` is `number | null`, but the
  billing wrapper rejects billable NULL before line creation. An explicit zero
  reaches the invoice line as numeric zero.
- Draft/action getters return the stored nullable value directly. They must not
  use `COALESCE(unit_price_snapshot, 0)` in JSON output.
- `isChartOrderAppliedSnapshot` and all draft/action/fulfillment mappers accept
  NULL only when the frozen snapshot says billing reflection is false; a
  billable NULL is invalid. Reloaded JSON must preserve the distinction.

## RPC and transaction contract

### Draft save

Replace the latest `clair_save_chart_order_draft` implementation in the A3
migration without changing its public argument shape. Its JSON input gains
`workspaceCatalogItemId`.

For a new catalog row, it must:

1. authenticate actor and chart-update permission;
2. lock the encounter and read the same-workspace active catalog row;
3. ignore client snapshot, names, category, billing category, classification,
   source IDs, and price;
4. derive order type, names, price, routing, billing, and lineage from catalog,
   and call the private SQL billing-category mapper;
5. reject active billable NULL price and accept explicit zero;
6. write `service_item_id = NULL` and server-built preview snapshot;
7. allow only draft/pending row edits and deletion.

An existing legacy row may remain on its compatibility path, but a new row
without a catalog ID must not create a new service-backed or unclassified order.
An existing service-backed row must not be silently converted to catalog origin.

### Persisted draft/action readback

The same A3 migration must replace both getters, not only the save functions:

- `public.clair_get_chart_order_draft(text, uuid)`;
- `public.clair_get_chart_order_actions(text, uuid)`.

Each getter remains a fixed-search-path `SECURITY DEFINER` workspace/encounter
read boundary with authenticated EXECUTE only. Each returned row must include
the exact persisted DB values, with no client reconstruction:

- `orderId`, `workspaceId`, `encounterId`, status/confirmation/billing fields;
- nullable `serviceItemId`;
- nullable `workspaceCatalogItemId`;
- nullable `sourceMasterRecordId`, `sourceMasterRevision`, and
  `workspaceCatalogRevision`;
- compatibility `sourceOrderId` and `sourceOrderVersion`;
- nullable `unitPriceSnapshot` without `COALESCE` to zero;
- generated `lineTotalSnapshot`;
- persisted `appliedSnapshot` and `appliedPriceSnapshot` objects, including
  catalog/master lineage, `categoryGroup`, frozen `billingCategory`, and
  nullable `priceKrw`.

`clair_get_chart_order_draft` must replace the current
`coalesce(o.unit_price_snapshot, 0)` output. `clair_get_chart_order_actions`
must return direct columns rather than requiring the TypeScript client to infer
lineage from JSON. Both save RPCs return the same row shape as their getters.
The implementation must prove save-response/reload parity by reading the row
again through the getter and comparing all persisted fields, including NULL,
zero, direct lineage, revisions, and snapshot JSON. Generated timestamps may
only differ when the save intentionally updates the row; the returned snapshot
and financial fields must be identical.

### Confirmation

Replace `clair_save_chart_order_action` so `confirm` locks selected order rows,
then locks/reads each active catalog row for a draft/pending catalog-origin
order. Inside that same transaction it calls the private SQL billing-category
mapper from the locked catalog row, ignores/rejects any client or TypeScript
category input, and builds/persists direct lineage, applied snapshot, price
snapshot, calculation values, confirmation state, actor/time, and events.

If a row is already confirmed/billed, return its stored snapshot without
refreshing it from catalog. This makes retries idempotent and preserves history
after catalog/price changes. `bill` only creates billing candidate state from
the stored order snapshot. Set rows continue to return
`unsupported_order_type`.

The Supabase TypeScript gateway must consume the persisted RPC result; a client
side `mergeCatalogSnapshotRows` must not be used as an authority or substitute
for database persistence.

### Fulfillment and billing RPCs

Fulfillment sync must build the complete source snapshot directly from the
frozen order, including patient/guardian context, catalog lineage, category,
price, routing, and names. The A3 migration must revoke and drop the current
caller-controlled enrichment surface:

```sql
revoke all on function public.clair_enrich_fulfillment_work_item_snapshots(text, uuid, jsonb)
  from public, anon, authenticated;
drop function if exists public.clair_enrich_fulfillment_work_item_snapshots(text, uuid, jsonb);
```

The TypeScript Supabase RPC client type and
`persistSupabaseSnapshotEnrichment` call are removed. No authenticated caller
can replace `source_snapshot` with JSON. The base
`clair_sync_fulfillment_work_items_from_orders` conflict branch updates only
operational queue fields and leaves the original `source_snapshot` unchanged.
Its first insert builds the full immutable snapshot from locked `orders` rows.

Billing candidate sync uses the private helper and anchor/lock contract above.
It sets `invoice_lines.service_item_id` to NULL for catalog-origin orders and
copies the frozen order snapshot. It never overwrites an anchored line's
description, quantity, unit price, billing name, category, or source snapshot.
Existing legacy line service IDs remain unchanged.

### Billing permission call graph

The A3 migration defines one non-public helper and three authenticated wrappers.
The helper is never executable by `public`, `anon`, or `authenticated`:

```text
private.clair_sync_billing_invoice_candidates_internal(
  p_workspace_id text,
  p_actor_user_id uuid,
  p_encounter_id uuid,
  p_order_ids uuid[]
) returns jsonb
```

The helper performs the advisory-lock/order-lock/invoice-anchor transaction and
validates actor equality, active membership, encounter/order workspace scope,
billable snapshot, and immutable-line state. It has no public grant.

Authenticated wrappers are:

| Wrapper | Caller surface | Required DB permission | Required scope |
| --- | --- | --- | --- |
| `public.clair_sync_billing_invoice_candidates` | direct billing route | `billing:issue` | active member, actor = `auth.uid()`, same-workspace encounter/orders |
| `public.clair_sync_billing_invoice_candidates_from_chart` | chart action after `chart:update` | `chart:update` | selected confirmed orders in the same encounter/workspace; no client amount/snapshot |
| `public.clair_sync_billing_invoice_candidates_from_fulfillment` | fulfillment completion or vet-review transition | queue-specific `lab:complete`, `imaging:complete`, or `dispensing:complete` | selected completed work items, same workspace/order/encounter, queue permission matches every order |

Each wrapper is `SECURITY DEFINER`, fixed-search-path, authenticated EXECUTE
only, and independently checks the permission instead of trusting a caller
surface string. The direct billing RPC cannot be called with chart or
fulfillment permission, and chart/fulfillment wrappers cannot be used as a
general billing endpoint. The chart action TypeScript gateway calls the chart
wrapper; the direct billing route calls the direct wrapper; fulfillment update
and result-review billing call the fulfillment wrapper. Public authenticated
users cannot call the private helper directly.

The migration must make the boundary auditable with explicit grants: revoke all
on the private helper from `public`, `anon`, and `authenticated`; revoke
`public`/`anon` execute on each public wrapper; grant execute on each public
wrapper to `authenticated` only; and leave no execute grant on the private
helper. Each wrapper derives actor identity from `auth.uid()` and passes that
identity to the helper; a caller-supplied actor ID that differs is rejected.

`syncVetReviewedBillingCandidates` must replace its current blanket
`chart:update` check with the queue-specific permission check before invoking
the fulfillment wrapper. `updateFulfillmentWorkItem` already resolves
`lab:complete`, `imaging:complete`, or `dispensing:complete` from queue type;
the DB wrapper repeats that check. Negative tests must cover billing-only users
calling chart/fulfillment wrappers, chart-only users calling direct billing,
ordinary members calling all wrappers, actor mismatch, and cross-workspace
order IDs.

### Frozen billing category

`billingCategory` is not derived from operational `order_type`. The source
`categoryGroup` is the approved compatibility projection of the catalog/master
clinical-action item type; it is not PDF CG. During draft preview/confirmation,
the authoritative private SQL function in the A3 migration validates the locked
same-workspace catalog row's canonical classification path and CG/NT projection,
then freezes the source `categoryGroup` and the deterministic `billingCategory`
below. The live owner is exactly
`private.clair_map_catalog_category_to_billing_category(text)`, invoked inside
the draft and action save RPC transactions. It is the sole live Supabase
mapping owner for all seven source values; no client or TypeScript category is
accepted as an RPC input.

`mapCatalogCategoryToBillingCategory` in
`src/features/chart/server-order-action-persistence-core.ts` is only a
demo/mock/test mirror and compatibility mapper for persisted results. It is not
live authority and is never called to supply an RPC category input. A focused
static/replay test must compare its seven-row mirror table with the private SQL
CASE/table and fail on drift.

The migration's live CASE is exactly:

```sql
case p_category_group
  when 'consultation' then 'consultation'
  when 'medication' then 'dispensing'
  when 'treatment' then 'treatment'
  when 'lab' then 'laboratory'
  when 'imaging' then 'imaging'
  when 'hospitalization' then 'other'
  when 'misc' then 'other'
  else null
end
```

The draft and action save RPCs call this function only after locking the
same-workspace catalog row; they ignore or reject caller/TypeScript category,
classification, and billing-category fields. The resulting value is written
to the persisted order snapshot and is then returned unchanged by both chart
getters and the billing invoice-line reader. The private function raises
`unsupported_category_group` if the CASE result is NULL.

| Source catalog row `categoryGroup` | Frozen order snapshot | Invoice-line reader | UI label/test |
| --- | --- | --- | --- |
| `consultation` | `categoryGroup: consultation`, `billingCategory: consultation` | Return both frozen fields from `clair_get_billing_invoice_lines`; do not join the mutable catalog | `진료`; `tests/billing.spec.ts` consultation case |
| `medication` | `categoryGroup: medication`, `billingCategory: dispensing` | Preserve the frozen dispensing category and nullable catalog lineage | `조제`; medication/dispensing case |
| `treatment` | `categoryGroup: treatment`, `billingCategory: treatment` | Preserve the frozen treatment category and snapshot | `처치`; treatment case |
| `lab` | `categoryGroup: lab`, `billingCategory: laboratory` | Preserve the frozen laboratory category and snapshot | `검사`; laboratory case |
| `imaging` | `categoryGroup: imaging`, `billingCategory: imaging` | Preserve the frozen imaging category and snapshot | `영상`; imaging case |
| `hospitalization` | `categoryGroup: hospitalization`, `billingCategory: other` | Return the explicit frozen `other`, never infer from queue routing | `기타`; hospitalization compatibility case |
| `misc` | `categoryGroup: misc`, `billingCategory: other` | Return the explicit frozen `other`, never infer from a NULL service ID | `기타`; misc compatibility case |

The first five mappings follow the established catalog labels/destinations and
billing-prefix semantics. `hospitalization` has no billing UI category, its
current catalog projection is `chart_only`, and `NT_INPATIENT` is held until
inpatient runtime/DB support; therefore its A3 compatibility projection is the
existing `기타` fallback. `misc` is already labeled 기타 and the approved demo
rows are chart/reception, non-billable items. This is a compatibility mapping,
not a new product category decision. A dedicated inpatient billing label or
separate billing category would require a later domain decision outside A3.

The reader returns `billingCategory`, `categoryGroup`, nullable catalog/service
lineage, and the frozen snapshot. The billing module maps consultation→진료,
laboratory→검사, imaging→영상, dispensing→조제, treatment→처치, and
other→기타. A non-`other` frozen category must not fall to 기타 merely because
`service_item_id IS NULL`; an intentional frozen `other` category correctly
renders 기타. Legacy rows without a canonical projection retain
`service_item_id` and use the service-prefix fallback only.

Evidence for this exact projection is the catalog label/destination builder
(`src/features/hospital-admin/data.ts`, lines 568-576, 903-947), the draft
synthetic catalog examples (`docs/product/demo-data/order-catalog-v1.md`,
lines 162-187),
the current billing category list/fallback (`src/features/billing/module.tsx`,
lines 380-398), the target's distinction between compatibility `categoryGroup`
and PDF CG plus held inpatient route
(`docs/engineering/data-model/clair-clinical-master-data-target-architecture.md`,
lines 287, 311-323, 632), and the approved source item-type values
(`docs/engineering/data-model/clair-clinical-master-data-phase-1-db-spec.md`,
lines 320-327).

`public.clair_get_billing_invoice_lines(text, uuid)` is replaced in the A3
migration to return `billingCategory`, `categoryGroup`, nullable catalog/service
lineage, and the frozen `sourceOrderSnapshot`/billing name fields alongside
the existing line values. The read RPC does not derive category from a mutable
catalog join and does not coerce snapshot price NULL to zero. The TypeScript
invoice-line mapper and domain type preserve these fields.

## TypeScript and client ownership

Every file listed below is required ownership for A3. There is no conditional
"if needed" production ownership. A preflight may stop implementation before a
file is changed, but it may not silently move the authority boundary to a
client, route, or legacy service projection.

### Required production files

- `supabase/migrations/<next-after-A2>_clinical_master_phase1a3_order_authority.sql`:
  the single A3 migration owns the `orders` catalog/master columns, composite
  FKs/checks/indexes, legacy preflight, RLS/grants, draft/action save and getter
  RPC replacements, fulfillment enrichment RPC revoke/drop and immutable sync
  branch, billing private helper/wrappers/anchor lock, and the frozen billing
  category read RPC plus the sole live private SQL
  `clair_map_catalog_category_to_billing_category` mapping function. It must
  be timestamped after the actual A2 migration and must not modify A1/A2 files.
- `src/features/hospital-admin/server-order-catalog-core.ts`: retain
  `workspaceCatalogItemId` as text, consume A2 nullable `priceKrw`, catalog
  revision, and source master lineage, and expose the server-read catalog row
  without treating client labels or price as authority.
- `src/features/chart/server-order-draft-persistence-core.ts`: update
  `ChartOrderDraftLine`, `readChartOrderDraft`, `saveChartOrderDraft`,
  `createSupabaseChartOrderDraftGateway`, `mapOrderDraftRow`, and input
  validation so catalog ID is intent, `unitPriceSnapshot` is `number | null`,
  and both save response and getter map the same persisted catalog/master
  lineage, revision, applied snapshot, and nullable price.
- `src/features/chart/server-order-action-persistence-core.ts`: update
  `ChartOrderActionLine`, `readChartOrderActions`, `saveChartOrderAction`,
  `createSupabaseChartOrderActionGateway`, `resolveCatalogSnapshotsForConfirmation`,
  `buildConfirmedCatalogSnapshot`, `mapAppliedSnapshotToBillingInput`, and
  `mapOrderActionRow`; resolve each new individual by direct catalog ID. The
  `mapCatalogCategoryToBillingCategory` TypeScript mirror is demo/mock/test
  compatibility only and never supplies an RPC category input; live category
  authority remains the private SQL function in the A3 migration. Preserve
  `unsupported_order_type` for sets, pass nullable price through, and consume
  the server-persisted confirmation result rather than caller snapshot.
- `src/features/chart/module.tsx`: retain catalog ID in selection, draft, and
  restore state; remove every new-flow assignment of a catalog/preset ID to
  `serviceItemId`; send only quantity/encounter intent and render persisted
  readback.
- `src/features/fulfillment/server-fulfillment-work-item-core.ts`: update
  `syncFulfillmentWorkItemsFromOrders`, `createSupabaseFulfillmentWorkItemGateway`,
  `syncVetReviewedBillingCandidates`, `mapWorkItemToBillingSnapshot`, and
  `buildSnapshotDetail`; remove `persistSupabaseSnapshotEnrichment` and its RPC
  type/call, preserve nullable `priceKrw`, and ensure conflict/retry paths
  never update `sourceSnapshot`.
- `src/features/billing/server-invoice-candidate-sync-core.ts`: update
  `syncInvoiceCandidates`, its gateway RPC type, `createSupabaseInvoiceCandidateSyncGateway`,
  `mapCandidateRows`, and input validation to preserve NULL versus zero and use
  explicit `direct`, `chart`, and `fulfillment` wrapper surfaces. The public
  client cannot call the private internal helper.
- `src/features/billing/server-invoice-line-persistence-core.ts`: update
  `readInvoiceLines`, `createSupabaseInvoiceLinePersistenceGateway`,
  `mapPersistencePayload`, and `isInvoiceLineSnapshot` to consume the replaced
  getter's frozen `categoryGroup`/`billingCategory`, catalog/service lineage,
  and nullable amount fields without a catalog re-join or NULL-to-zero mapping.
- `src/features/billing/module.tsx`: update `getBillingLineCategory`,
  `loadBillingInvoiceLines`, and the invoice-line domain mapping to render the
  frozen category (`consultation`, `laboratory`, `imaging`, `dispensing`,
  `treatment`, `other`) as 진료/검사/영상/조제/처치/기타. Use a service-prefix
  fallback only when the row is legacy (`workspaceCatalogItemId IS NULL`).
- `src/types/emr-domain.ts`: make `EmrOrder.serviceItemId`, invoice-line
  service/catalog lineage, draft/action/fulfillment `priceKrw` and
  `unitPriceSnapshot` nullable, and add the canonical `BillingCategory` and
  `categoryGroup`/frozen billing snapshot types used by all mappers.
- `src/app/api/workspaces/[workspaceId]/billing/invoice-candidates/route.ts`:
  route direct billing requests to the authenticated direct wrapper and keep
  workspace/actor scope in the server call.
- `src/app/api/workspaces/[workspaceId]/chart/order-actions/route.ts`: route
  chart confirmation billing side effects through the authenticated chart
  wrapper; do not expose the private helper.
- `src/app/api/workspaces/[workspaceId]/chart/result-review-billing/route.ts`:
  route result-review billing through the authenticated fulfillment wrapper and
  retain the queue-specific permission check.
- `src/app/api/workspaces/[workspaceId]/fulfillment/work-items/[workItemId]/route.ts`:
  route fulfillment transition billing through the authenticated fulfillment
  wrapper, using actor equality, work-item/order scope, and queue permission.

### Required test/replay files

- new `supabase/snippets/clinical_master_phase1a3_replay.sql`;
- new `tests/fixtures/clinical-master-phase1a3.fixture.json`;
- new `tests/clinical-master-phase1a3.spec.ts` for the seven-row SQL mapping
  parity/static check, tampered category input rejection, and persisted
  snapshot → chart getter → invoice reader path;
- `tests/chart.spec.ts` for catalog add → draft → confirm → reload parity and
  unsupported set confirmation;
- `tests/chart-order-draft-persistence-server.spec.ts`;
- `tests/chart-order-action-persistence-server.spec.ts`;
- `tests/fulfillment-work-item-server.spec.ts` for removal of
  `sourcePresetId`-as-`serviceItemId`, server-built snapshot, enrichment RPC
  removal, NULL/zero, retry, and permission denial;
- `tests/fulfillment-handoff-replay.spec.ts`;
- `tests/notification-persistence-contract.spec.ts` for the enrichment RPC
  contract removal/revocation and notification persistence regression;
- `tests/billing-invoice-candidate-sync-server.spec.ts` for the existing-line
  anchor adoption, issued/paid legacy retry, same-workspace cross-encounter
  fatal preflight, duplicate/mismatch fatal preflight, and migration re-run
  idempotency;
- `tests/billing-invoice-line-persistence-server.spec.ts` for the replaced
  category/read RPC, frozen snapshots, nullable price, and legacy fallback;
- `tests/billing.spec.ts` for all seven source category projections
  (consultation, medication, treatment, lab, imaging, hospitalization, misc)
  and 진료/검사/영상/조제/처치/기타 category UI mapping;
- `tests/fixtures/clinical-master-phase1a3.fixture.json` must include separate
  non-billable NULL and billable explicit-zero rows plus legacy prefix cases.

The existing tests must retain their legacy cases and add catalog-origin NULL
service ID, direct lineage, immutable snapshot, retry, billing-category,
save/reload parity, cross-workspace, and negative wrapper-authorization
assertions. The named existing specs above are required changes, not optional
coverage.

### Explicitly excluded files and triggers

- `src/app/api/workspaces/[workspaceId]/chart/order-drafts/route.ts`: excluded;
  its existing parsed payload boundary is not a billing authority surface. The
  implementation preflight must prove it forwards `workspaceCatalogItemId`
  unchanged; if it does not, stop and obtain a scoped ownership update rather
  than adding client direct-DML or silently changing this file.
- `src/app/api/workspaces/[workspaceId]/fulfillment/work-items/sync-from-orders/route.ts`:
  excluded from billing wrapper dispatch because it only invokes order-to-work-
  item sync; it must not gain a direct billing permission or private-helper
  call.
- `src/features/lab-imaging/module.tsx` and
  `src/app/api/workspaces/[workspaceId]/lab-imaging/result-sheet-catalog/route.ts`:
  excluded because lab runtime is out of scope. A new catalog lab handoff may be
  tested, but a result-sheet adapter is a separate work item.
- `src/lib/emr-domain/service-catalog.ts`: excluded; its existing null-safe
  legacy consistency behavior remains.
- `supabase/seed.sql`: excluded; use the new synthetic A3 fixture/replay and do
  not rewrite legacy seed provenance.
- notification production modules/routes: excluded; only
  `tests/notification-persistence-contract.spec.ts` changes to prove the
  caller-controlled enrichment RPC is gone and notification persistence still
  receives the immutable work-item snapshot.

## Focused test and replay matrix

The A3 fixture must use synthetic data only and cover:

1. `tests/chart.spec.ts`: legacy service confirmation remains unchanged; a new
   catalog selection stores direct catalog ID with NULL service ID, performs no
   service-table write, and follows catalog add → draft → confirm → reload.
2. `tests/chart-order-draft-persistence-server.spec.ts`: draft save response and
   `clair_get_chart_order_draft` readback are byte/field-parity checked for
   direct catalog ID, master ID/revision, catalog revision, applied snapshot,
   and nullable `unitPriceSnapshot`; non-billable NULL remains NULL and explicit
   zero remains `0`.
3. `tests/chart-order-action-persistence-server.spec.ts`: action save response
   and `clair_get_chart_order_actions` readback have the same persisted result;
   confirmation re-reads the catalog, ignores/rejects tampered name, price,
   category, lineage, and snapshot, and retry does not refresh it.
4. `tests/clinical-master-phase1a3.spec.ts`: pending/paused/inactive catalog
   rejection, active billable NULL rejection, explicit zero acceptance, direct
   DML denial, and `unsupported_order_type` for sets.
5. `tests/clinical-master-phase1a3.spec.ts` and the replay snippet: cross-
   workspace catalog/order/encounter and cross-workspace master-lineage calls
   fail without rows or snapshots being written.
6. `tests/fulfillment-work-item-server.spec.ts`: the source snapshot is built
   from the frozen order, contains direct catalog/master lineage, keeps NULL
   price as NULL, has no `sourcePresetId`-as-`serviceItemId` projection, and
   caller enrichment JSON is rejected because the enrichment RPC is absent or
   revoked.
7. `tests/fulfillment-handoff-replay.spec.ts`: two sessions syncing the same
   order converge on one work item; conflict and retry update operational
   fields only and never replace `source_snapshot`.
8. `tests/notification-persistence-contract.spec.ts`: no caller enrichment
   RPC call remains, its authenticated execute grant is denied, and the
   notification event still references the immutable work-item snapshot.
9. `tests/billing-invoice-candidate-sync-server.spec.ts`: two sessions use the
   specified advisory-lock/order-lock sequence and produce one invoice line and
   one `orders.invoice_line_id` anchor; the loser returns the same persisted
   line.
10. The same billing-server test covers an existing draft invoice, rejects an
    unanchored order on issued/paid invoices, returns a paid anchor unchanged,
    preserves a user-edited description/quantity/amount/name/snapshot on
    retry, and rejects a cross-invoice duplicate with
    `invoice_anchor_conflict`.
11. `supabase/snippets/clinical_master_phase1a3_replay.sql` and
    `tests/clinical-master-phase1a3.spec.ts` adopt exactly one same-workspace
    legacy invoice line when `orders.invoice_line_id` is NULL; only
    `orders.invoice_line_id` may change, and every other order field plus every
    invoice-line/invoice field remains unchanged. The test returns the same
    issued/paid line on retry and stops before indexes/adoption for duplicate lines,
    workspace/order mismatch,
    same-workspace cross-encounter issued/paid lines, wrong-order anchor, or
    one-line/multiple-order corruption, and are no-ops on a second migration run.
12. `tests/billing-invoice-line-persistence-server.spec.ts`: the replaced
    `clair_get_billing_invoice_lines` contract returns frozen
    `categoryGroup`/`billingCategory`, direct lineage, nullable price, and
    legacy fallback data without a mutable catalog re-join or NULL-to-zero
    conversion.
13. `tests/billing.spec.ts`: the UI maps all seven source values through the
    frozen projection: consultation→진료, medication→조제, treatment→처치,
    lab→검사, imaging→영상, hospitalization→기타, and misc→기타. A legacy
    service-prefix row still maps through the legacy fallback; a non-`other`
    frozen category must not collapse to 기타 merely because `service_item_id`
    is NULL, while an intentional frozen `other` correctly renders 기타.
14. `supabase/snippets/clinical_master_phase1a3_replay.sql` and
    `tests/clinical-master-phase1a3.spec.ts` exercise all seven source catalog
    rows through private SQL mapping → persisted order snapshot → draft/action
    getter → billing invoice reader, reject tampered client/TypeScript category
    input, and compare the seven-row TypeScript mirror table with the SQL CASE
    table to prevent drift.
15. Direct billing, chart-action, and fulfillment-transition wrapper tests
    cover anonymous, inactive member, actor mismatch, wrong workspace/order,
    missing direct billing permission, missing chart:update, and missing
    queue-specific completion permission. A public authenticated caller cannot
    invoke the private internal helper.
16. A legacy fixture row with service ID, a legacy row with NULL service ID,
    and historical JSON catalog claims remain legacy; no name/price/JSON/
    `source_order_id`/`linkedServiceItemId` inference or service backfill occurs.
17. Draft-only edit/delete behavior, confirmed-row immutability, confirmation
    retry, fulfillment retry, billing retry, and idempotent replay are all
    asserted with persisted snapshots, not only mock return values.
18. A catalog/name/price/routing/classification change after confirmation leaves
    chart, fulfillment, and invoice snapshots unchanged; a separate explicit
    zero fixture remains zero after reload and billing.
19. Lab catalog orders are tested only through the generic fulfillment handoff;
    Order Set revisions/runtime and laboratory result runtime have no A3 test or
    migration ownership.
20. The A1 → A2 → A3 reset/replay/rollback script proves no probe rows remain,
    and its preflight output includes every fatal/tolerated legacy bucket.

## Exact local verification commands

These are the local closeout commands used after the A1/A2 predecessor gates:

```bash
cd /Users/iseung-ug/project/emr-app-shell-prototype/.worktrees/clinical-master-phase1-active
git diff --check
node scripts/check-doc-links.mjs
node_modules/.bin/tsc --noEmit --pretty false
# Supabase local reset generates a minified edge bundle under supabase/.temp;
# exclude that generated output from the repository-source lint pass.
npx eslint --ignore-pattern 'supabase/.temp/**' --max-warnings=0
npx playwright test \
  tests/clinical-master-phase1a3.spec.ts \
  tests/chart.spec.ts \
  tests/chart-order-draft-persistence-server.spec.ts \
  tests/chart-order-action-persistence-server.spec.ts \
  tests/fulfillment-work-item-server.spec.ts \
  tests/fulfillment-handoff-replay.spec.ts \
  tests/notification-persistence-contract.spec.ts \
  tests/billing-invoice-candidate-sync-server.spec.ts \
  tests/billing-invoice-line-persistence-server.spec.ts \
  tests/billing.spec.ts \
  --project=chromium
npx --yes supabase@2.115.0 db reset --local --yes
docker exec -i supabase_db_emr-app-shell-prototype psql -X -v ON_ERROR_STOP=1 \
  -U postgres -d postgres < supabase/snippets/clinical_master_phase1a3_replay.sql
```

The local DB verification must inspect catalog/order composite FKs, grants,
RLS, direct-DML denial, service/catalog discriminator constraints, snapshot
readback, and two-session lock/idempotency behavior. No remote DB or Docker
claim is valid for this work item.

## Entry, exit, rollback, and stop criteria

### Entry

- A1 real local PostgreSQL reset/replay/role/two-session gate passes;
- A2 implementation/runtime/security gate passes;
- A2 direct catalog DML is revoked and catalog composite key/revision columns
  exist;
- A2 nullable-price semantics and classification preflight are proven;
- legacy ambiguity preflight is recorded with zero unresolved rows or a reviewed
  explicit mapping plan.

### Exit

- all new individual chart orders use catalog direct lineage and server snapshots;
- all new catalog-origin service IDs are NULL;
- all existing legacy service rows remain readable and unchanged;
- fulfillment and billing snapshots are immutable across catalog changes/retries;
- workspace, actor, role, direct-DML, and cross-workspace tests pass;
- local reset/replay and two-session evidence pass;
- no set/lab runtime behavior was added.

### Rollback and stop

Rollback is local transaction rollback or full local reset followed by A1 → A2 →
A3 replay. Do not revert unrelated WIP or use destructive Git commands.

Stop immediately for missing A1/A2 runtime gates, unresolved legacy provenance,
catalog/service dual population, client snapshot authority, cross-workspace
leakage, direct authenticated DML, snapshot mutation on retry, duplicate
confirmation/billing rows, or any requirement to implement Order Set/lab
runtime.

## Domain decision

**New domain decision required: none.**

The direct catalog lineage discriminator, nullable legacy service ID, immutable
snapshot rule, no-dual-write boundary, set rejection, and lab boundary are
already approved. Remaining unknowns are implementation preflight/runtime
checks, not new product decisions.

## Explicit implementation verification items

These are mechanical checks for the implementation worker, not open domain
decisions: confirm the actual post-A2 migration timestamp and function overload
signatures before creating the single A3 migration; inspect `pg_proc`/ACLs
before revoking and dropping the enrichment function; prove the order-draft
route forwards `workspaceCatalogItemId` unchanged; and retain the local
PostgreSQL reset/replay/role/two-session evidence recorded for this closeout. A
failure in any item is a stop condition, not permission to infer provenance or
weaken the authority boundary.

## Current implementation and local closeout

The approved Phase 1A-3 slice is implemented in one forward migration after
the actual A2 migration, the synthetic replay/fixture, the named server/UI
contracts, and the required route dispatch points. A1/A2 predecessor gates are
recorded as PASS; A3 local evidence includes reset/reapply, the fatal/tolerated
preflight bucket report, persisted seven-category getter/action/invoice-reader
replay, rollback cleanup, direct-DML/RLS/grant denials, snapshot immutability,
legacy paid-line adoption/idempotency, and two-session billing anchor
serialization.

`supabase/seed.sql` and the A1/A2 migrations remain untouched by the A3 slice.
The result is not a remote/deployment/commit/PR claim; production release and
authenticated production smoke remain out of scope for this local closeout.
