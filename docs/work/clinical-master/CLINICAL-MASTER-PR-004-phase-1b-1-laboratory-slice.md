---
id: "CLINICAL-MASTER-PR-004"
status: "human_review"
area: "clinical-master"
priority: "P0"
target_pr: "A1/A2/A3/B1 focused local synthetic/runtime/security gates PASS; Sol APPROVE/MUST-FIX 0; optional full 38-case matrix unclaimed; local-only human review"
updated: "2026-08-20"
---

# Clinical Master Phase 1B-1: Laboratory Slice

## Status and gate

The A1/A2/A3/B1 local synthetic runtime and security gates are PASS, with
independent Sol review `APPROVE` and `MUST-FIX 0`. The focused local evidence
is verified against the synthetic Supabase/PostgreSQL runtime: pinned
reset/reapply, ON_ERROR_STOP replay with rollback cleanup, typed
projection/review CAS, confirmation-time snapshot freeze, entered-only save,
one-order/work-item/billing proof, and RLS/grant/direct-DML evidence all pass.
Human acceptance remains pending.
The full 38-case matrix (including two workspaces/catalogs, a second panel,
standalone/coded/workspace-custom branches, and NULL/zero/positive price
variants) is not claimed by this closeout.

1. `CLINICAL-MASTER-PR-001` has real local PostgreSQL reset/replay, rollback,
   role/privilege, and two-session concurrency evidence;
2. `CLINICAL-MASTER-PR-002` has complete workspace catalog implementation,
   nullable-price, lineage, RLS/grant, and retry/security evidence;
3. `CLINICAL-MASTER-PR-003` has complete sole-order, immutable fulfillment,
   billing-anchor, permission, and retry evidence.

The predecessor evidence is recorded in the A1/A2/A3 work items. The B1
closeout is local-only: it uses the local Docker/Supabase runtime and
synthetic rows only; no remote database, real data, production, deployment,
commit, push, PR, or external write was performed.

## Intent and approved boundary

Prove the minimum Phase 1B-1 laboratory contract:

```text
private canonical lab test/panel/profile
  -> explicit workspace catalog/result-item projection
  -> one locked catalog-origin lab order
  -> one fulfillment unit
  -> one result sheet with multiple ordered result fields
  -> one billing unit / one invoice line
```

Included:

- canonical `master.lab_tests`, `master.lab_panels`,
  `master.lab_panel_items`, and `master.lab_order_profiles`;
- dog/cat, specimen, unit, and result-input vocabulary already in the A1
  master foundation;
- explicit mapping from canonical lab tests/panels to existing workspace lab
  result definitions;
- server/DB-generated frozen result-definition snapshots;
- existing lab result-entry runtime with a constrained canonical write path;
- proof that one panel creates multiple result fields without child orders,
  child fulfillment work items, or child invoice lines;
- workspace isolation, actor equality, permission/RLS/grant checks;
- synthetic fixture, replay, retry, and two-session test plans.

Explicitly excluded:

- Order Set identity, revision, expansion, or runtime;
- LIS, device, PACS, external provider, or external terminology integration;
- LOINC, UCUM, VetSCT, or any other external standard;
- canonical or user-visible clinical reference ranges;
- clinical validation or claims of medical correctness;
- new result-review, finalization, or amendment workflow;
- append-only clinical result history tables unless a later approved decision
  changes this boundary;
- new `service_*` authoring or any new-flow dual write;
- real patient/hospital data and remote/production migration.

No domain decision is reopened by this plan. The implementation worker must
stop at a missing predecessor contract or unresolved mapping rather than infer
identity from names, prices, JSON, or legacy service IDs.

## Current-state evidence and predecessor contracts

### Authoritative target

- Ownership is private canonical master → workspace-owned copy → immutable
  applied snapshot:
  `docs/engineering/data-model/clair-clinical-master-data-target-architecture.md` (lines 80-117).
- Canonical laboratory family and one-test-or-one-panel order profile are
  defined at:
  `docs/engineering/data-model/clair-clinical-master-data-target-architecture.md` (lines 411-440).
- Published revisions and applied snapshots are immutable, while names and
  workspace values are projections/customization:
  `docs/engineering/data-model/clair-clinical-master-data-target-architecture.md` (lines 601-650).
- The approved Phase 1B-1 sequence is canonical tables, two synthetic panels,
  workspace mapping, and one atomic order with multiple result fields:
  `docs/engineering/data-model/clair-clinical-master-data-phase-1-db-spec.md` (lines 809-843).
- The Phase 1 DB specification explicitly defines the four master lab tables,
  but does not define result amendment history or clinical ranges:
  `docs/engineering/data-model/clair-clinical-master-data-phase-1-db-spec.md` (lines 117-145, 413-464).
- The demo contract requires a result sheet to copy item name, input type, unit,
  sort order, and source item ID into the encounter snapshot; later link changes
  do not rewrite existing snapshots:
  `docs/product/demo-data/lab-test-items-v1.md` (lines 100-136).

### A1 foundation

- A1 `master.master_records.record_type` currently excludes `lab_test` and
  `lab_panel`:
  `supabase/migrations/20260818120000_clinical_master_phase_1a1_private_foundation.sql:26-47`.
- A1 typed tables stop at species, units, specimen types, result-input types,
  and canonical orders:
  `supabase/migrations/20260818120000_clinical_master_phase_1a1_private_foundation.sql:174-204`.
- A1 publisher contract, detail-key validation, canonicalization, and publish
  branches only cover the existing record types:
  `supabase/migrations/20260818120000_clinical_master_phase_1a1_private_foundation.sql:542-743,752-1046`.
- A1 private schema access is revoked from browser/client roles; B1 must extend
  the private publisher through a forward migration and must not edit A1:
  `supabase/migrations/20260818120000_clinical_master_phase_1a1_private_foundation.sql:1140-1175`.

### Workspace catalog and current lab definitions

- `public.order_catalog_items` is currently workspace-owned but still uses
  `price_krw integer not null default 0` and preset-string lineage:
  `supabase/migrations/20260520152000_hospital_admin_order_catalog_persistence.sql:4-39`.
- A2 is the owner of catalog lineage, catalog revision, nullable price, and
  direct-DML revocation. B1 consumes those fields and does not reimplement A2:
  `docs/work/clinical-master/CLINICAL-MASTER-PR-002-phase-1a-2-workspace-adoption.md` (lines 76-130).
- Existing workspace result definitions are `lab_test_categories` and
  `lab_test_items`; they have text IDs, enum-like input types, unit text,
  availability, and usage counts but no canonical test identity:
  `supabase/migrations/20260520152000_hospital_admin_order_catalog_persistence.sql:77-100`.
- Existing catalog links can point to a category or explicit item and store
  metadata, but have no first-class panel/profile identity or composite
  workspace foreign key:
  `supabase/migrations/20260520152000_hospital_admin_order_catalog_persistence.sql:102-112`.
- Existing synthetic seed data has two lab categories, eight result items, and
  eight links:
  `supabase/seed.sql:1031-1103`.
- The Cheongdam synthetic snippet already demonstrates multiple linked result
  fields for CBC, chemistry, and UA, but only as link metadata, not a canonical
  panel:
  `supabase/snippets/den-468-491_cheongdam_master_seed.sql:836-905`.

### Order, fulfillment, and billing dependency

- Existing `public.orders` has nullable `service_item_id`, `order_type='lab'`,
  and price snapshots, but no direct A3 catalog/master authority in the
  predecessor schema:
  `supabase/migrations/20260519160000_clinical_order_billing_schema_foundation.sql:116-149`.
- A3 defines the new discriminator and immutable order/fulfillment/billing
  boundary: new rows use `workspace_catalog_item_id`, `service_item_id` stays
  NULL, catalog/master snapshots are server-owned, and one order has one
  invoice anchor:
  `docs/work/clinical-master/CLINICAL-MASTER-PR-003-phase-1a-3-sole-order-authority.md` (lines 200-241, 251-357, 416-479).
- A3 explicitly excludes lab result runtime but allows a catalog lab order to
  reach generic fulfillment; B1 starts only after that generic handoff is
  proven:
  `docs/work/clinical-master/CLINICAL-MASTER-PR-003-phase-1a-3-sole-order-authority.md` (lines 34-64, 836-858).
- Current fulfillment still has caller enrichment and mutable snapshot conflict
  updates; A3, not B1, owns their removal:
  `src/features/fulfillment/server-fulfillment-work-item-core.ts:1008-1153`;
  `supabase/migrations/20260719051725_performance_batch_rpc_followup.sql`.
- Current billing retry can update frozen line fields and lacks the final A3
  anchor contract; B1 must consume A3 and not repair it:
  `supabase/migrations/20260530141423_den_329_billing_candidate_invoice_anchor.sql:107-177`.

### Current result-entry runtime

- `lab_result_entries` is a mutable header and `lab_result_entry_rows` is a
  mutable row table with `analyte_name`, `result_unit`, `reference_range`, and
  `judgment`:
  `supabase/migrations/20260609112000_lab_result_entry_persistence.sql:4-58`.
- The current save RPC deletes/reinserts rows and accepts client-supplied
  definition fields, actor ID, and reference range:
  `supabase/migrations/20260609112000_lab_result_entry_persistence.sql:126-305`.
- Current DB checks membership and order/work-item scope but does not enforce
  `p_actor_user_id = auth.uid()` or the DB permission helper:
  `supabase/migrations/20260609112000_lab_result_entry_persistence.sql:126-305`.
- The result-sheet catalog route resolves current workspace definitions using
  service IDs, pricing-rule links, and display-name fallback:
  `src/app/api/workspaces/[workspaceId]/lab-imaging/result-sheet-catalog/route.ts:234-400`.
  This is current pre-B1 behavior only; the B1 canonical route must use the
  frozen header/row snapshot and never repeat that current-row lookup.
- The lab UI derives judgments from client-visible reference-range strings and
  sends definition metadata in the result save payload:
  `src/features/lab-imaging/module.tsx:244-302,834-988`.
- The API route already names the intended permissions (`lab:view` for reads,
  `lab:complete` for writes), but the DB RPC must repeat them:
  `src/app/api/workspaces/[workspaceId]/lab-imaging/result-entries/route.ts:111-124,184-203`.

### Actual permission and test infrastructure

- The repository helper for DB permission enforcement is
  `private.clair_current_user_has_workspace_permission(text,text)`:
  `supabase/migrations/20260615025340_den_505_rpc_role_audit_hardening.sql:4-53`.
- Membership isolation uses `private.clair_is_active_workspace_member(text)`;
  the baseline RLS contract requires `auth.uid()` and same-workspace policies:
  `supabase/migrations/20260518024708_workspace_membership_rls_baseline.sql`;
  `tests/workspace-membership-rls-migration.spec.ts`.
- Tests are Playwright tests, not a Vitest project. `playwright.config.ts` sets
  `testDir: './tests'`, one worker, and the `chromium` project; its web server
  is `npm run dev` with mock auth.
- Relevant existing specs are:
  `tests/clinical-master-phase1a1.spec.ts`,
  `tests/hospital-admin-order-catalog-schema-migration.spec.ts`,
  `tests/hospital-admin-order-catalog-server.spec.ts`,
  `tests/chart.spec.ts`,
  `tests/chart-order-draft-persistence-server.spec.ts`,
  `tests/chart-order-action-persistence-server.spec.ts`,
  `tests/chart-order-snapshot-bridge-migration.spec.ts`,
  `tests/lab-imaging.spec.ts`,
  `tests/lab-result-entry-persistence-contract.spec.ts`,
  `tests/lab-result-entry-notification-server.spec.ts`,
  `tests/fulfillment-work-item-server.spec.ts`,
  `tests/fulfillment-handoff-replay.spec.ts`,
  `tests/billing-invoice-candidate-sync-server.spec.ts`,
  `tests/billing-invoice-line-persistence-server.spec.ts`,
  `tests/billing.spec.ts`,
  `tests/notification-persistence-contract.spec.ts`,
  `tests/api-boundary-permission-regression.spec.ts`,
  `tests/server-permission-enforcement.spec.ts`,
  `tests/permission-resolver.spec.ts`, and
  `tests/workspace-membership-rls-migration.spec.ts`.

## Scope decision: frozen definition snapshot, not result-revision history

B1 does **not** add `lab_result_entry_revisions` or amendment/finalization
workflow tables. The narrower compliant design is:

1. keep `lab_result_entries` and `lab_result_entry_rows` as the current
   encounter result-entry runtime;
2. at catalog lab-order confirmation, add a server-generated, one-time
   `result_definition_snapshot` and its PostgreSQL-computed fingerprint to the
   result header before the confirmation transaction commits;
3. include ordered item definitions, source item IDs, source master test IDs and
   revisions, input type, unit, display name, sort order, specimen, panel/profile
   lineage, and the catalog/order revision in that frozen object;
4. for canonical catalog-origin results, permit later saves to change only
   nullable result values and notes; server judgment remains `not_judged`, while
   definition identity, names, units, item membership, order, and range fields
   must match the frozen object;
5. preserve the current legacy overwrite behavior for rows that have no direct
   catalog/master lineage, while never using those rows as canonical B1 input.

This satisfies the approved requirement that historical result-definition
snapshots remain immutable (`docs/engineering/data-model/clair-clinical-master-data-target-architecture.md` (lines 647-650) and
`docs/product/demo-data/lab-test-items-v1.md` (lines 108-120)) without inventing
clinical result amendment history. Master revision is the source definition
version; it is not a result revision. Result values remain the existing current
runtime behavior and are not claimed to be append-only clinical history.

The server must stop using the current canonical-path `DELETE`/reinsert behavior
for definition rows. The trusted A3 confirmation transaction creates the result
header and all N null-valued definition rows before commit. A later canonical
save may update result values/notes only after locking the header and verifying
that incoming row IDs exactly match the frozen definition snapshot. The legacy
compatibility path may retain current behavior, but it cannot populate a new
canonical panel result.

## Target data model and invariants

### Canonical master tables

Create the four tables from the authoritative DB spec, without price, clinical
range, external codes, or provider fields:

```text
master.lab_tests
  master_record_id uuid primary key/fk -> master.master_records
  test_code text unique not null
  result_input_type_id uuid not null -> master.result_input_types
  canonical_unit_id uuid null -> master.units
  decimal_scale integer null check (decimal_scale >= 0)

master.lab_panels
  master_record_id uuid primary key/fk -> master.master_records
  panel_code text unique not null

master.lab_panel_items
  id uuid primary key
  lab_panel_id uuid not null -> master.lab_panels
  lab_test_id uuid not null -> master.lab_tests
  sort_order integer not null
  required boolean not null default true
  display_group text null
  unique (lab_panel_id, lab_test_id)
  unique (lab_panel_id, sort_order)

master.lab_order_profiles
  order_record_id uuid primary key/fk -> master.orders
  lab_test_id uuid null -> master.lab_tests
  lab_panel_id uuid null -> master.lab_panels
  specimen_type_id uuid null -> master.specimen_types
  check ((lab_test_id is not null) <> (lab_panel_id is not null))
```

The canonical typed detail is deliberately smaller than the relation payload.
For every `lab_test` owner it is exactly this JSON object, with no additional
keys: `{"testCode": <non-empty trimmed string>,
"resultInputTypeKey": <non-empty trimmed string>,
"canonicalUnitKey": <trimmed string|null>, "decimalScale": <integer|null>}`.
`testCode` and `resultInputTypeKey` are required non-empty strings;
`canonicalUnitKey` is either a non-empty vocabulary key or JSON `null`; and
an empty optional unit key normalizes to JSON `null`. `decimalScale` is either
JSON `null` or a non-negative integer. `lab_panel`
detail is exactly `{"panelCode": <non-empty trimmed string>}`. Membership and
profile relation objects are not folded into either detail object: their exact
keys are the separately validated `labPanelItems` and `labOrderProfiles`
payloads below. The server rejects missing, extra, empty, or wrongly typed keys
before fingerprinting. Unit-table scale/conversion metadata is vocabulary
metadata only; it is not a decimal-scale fallback and is unused for B1 numeric
formatting.

The publisher validates that profile orders use the lab action/NT_LAB path,
that every panel member is a lab test, that every relation reference resolves
either in the same release or to the existing pinned current revision selected
by the three passes below, and that dog/cat species links are valid. Do not extend
`master.result_input_types` with a global options column in B1. `value_kind =
'coded'` is structural-only in the approved Phase 1 schema. B1 freezes the
canonical value kind as `coded`, but the workspace/runtime uses the existing
text input/storage path and accepts an opaque scalar string; there is no select
UI, option authority, or option-membership validation. A later typed coded
options model requires a separately approved work item. A panel member is a
result definition, never an order, fulfillment unit, or invoice line.

### Relation ownership and master revision semantics

Panel membership is versioned content owned by the `lab_panel` master record.
The order profile target/specimen is versioned content owned by the `order`
master record. A relation-only change must advance the owning record exactly
once; it must not advance an unrelated owner or create a new record identity.

The publisher normalizes relation payloads before any comparison:

- missing `labPanelItems`/`labOrderProfiles` is `[]` only at the payload level;
  every included `lab_panel` must have one complete panel-item declaration and
  every included lab `order` must have exactly one complete profile declaration;
  omission for an included owner is a validation error, not an implicit remove;
- trim all master keys, convert empty `displayGroup`/specimen values to
  `null`, default `required` to `true`, and require integer `sortOrder >= 0`;
- reject duplicate `(panelMasterKey,testMasterKey)` or
  `(panelMasterKey,sortOrder)` and reject duplicate `orderMasterKey`; never
  silently deduplicate;
- sort panel items by `(panelMasterKey, sortOrder, testMasterKey)` and profiles
  by `orderMasterKey`; output relation arrays use that order;
- for an included owner, the normalized full set replaces its typed relation
  projection. An omitted old member is an explicit removal only when the new
  full set is supplied and remains valid; a published active panel must retain
  at least one member and an active order profile must retain exactly one
  target. Owners not included in a release are unchanged. A relation array for
  an omitted owner is rejected as `owner_not_included`; it is never an implicit
  owner inclusion or a cascade.

The publisher uses one vocabulary dependency pass followed by three explicit
owner passes inside one release transaction. The passes use immutable stage
rows, not an implicit recursive cascade:

0. **Vocabulary dependency pass.** For every included result-input, unit, and
   specimen vocabulary owner referenced by the release, compare canonical
   typed content and set its effective revision to current or current + 1;
   an omitted vocabulary owner is pinned to its existing current revision and
   never advances implicitly. A referenced result-input owner is required and
   pins immutable `(record_id, revision, key, value_kind, supports_unit)`.
   A non-null canonical unit pins immutable `(record_id, revision, code)` and
   its owner must be included in this pass when the unit changes in the same
   release. A profile specimen pins immutable `(record_id, revision)`.
   Missing keys, wrong vocabulary record types, or a same-release reference
   that cannot resolve to the vocabulary pass's effective revision aborts the
   release. `supports_unit = false` requires `canonicalUnitKey = null`;
   `supports_unit = true` permits a null unit or a valid unit, but a non-null
   unit is allowed only when the input supports units. No unit is inferred from
   a code, and an included vocabulary change never cascades an omitted lab-test,
   panel, or order owner.

1. **Test pass.** Stage one row per included `lab_test` owner in
   `private.clinical_master_lab_test_publish_stage` with the canonical typed
   content, its normalized content fingerprint, current revision, and
   `effective_revision = current_revision + 1` only when the content differs;
   an omitted test owner is staged as `included = false` and pinned to its
   current revision. The owner snapshot pins the vocabulary pass's effective
   result-input ID/revision/key/value-kind/supports-unit and optional unit
   ID/revision/code, plus `decimalScale`; a test relation or profile reference
   cannot change this pass's effective revision.
2. **Panel pass.** Only an included `lab_panel` owner may replace membership.
   For every normalized full set, resolve each test reference to the test
   pass's effective revision when that test is included in the same release,
   otherwise to the test's existing current revision. Stage the complete
   canonical membership and its fingerprint in
   `private.clinical_master_lab_panel_publish_stage`; compare that effective
   content with the current panel owner content and set the panel effective
   revision to current or current + 1. An omitted panel owner keeps its old
   version snapshot and does not advance when a test advances. A panel full-set
   removal is valid only when the resulting active panel cardinality is at
   least one.
3. **Order pass.** Only an included lab `order` owner may replace its one
   `labOrderProfile`. Pin a referenced panel to that panel pass's effective
   revision when the panel is included in this release; otherwise pin its
   existing current panel revision. Pin a standalone test to the test pass's
   effective revision when included, otherwise its existing current revision.
   Stage the complete profile, specimen, and fingerprint in
   `private.clinical_master_lab_order_publish_stage`; compare owner content and
   advance the order owner only when its effective profile differs. An omitted
   order owner never cascades from a changed test or panel.

Stage rows contain release ID, owner record ID/type, `included`, current and
effective revision, canonical typed-content JSON, canonical relation/profile
JSON, pinned referenced record IDs/revisions, content SHA-256, and action
(`unchanged|advance|reject`). The publisher validates active profile/panel
cardinality and all references before any owner version is inserted. It then
persists the stage row's effective snapshot in `master_record_versions`, emits
one immutable revision event for each `advance`, and replaces typed relation
rows only for included owners. The deterministic event order is test owners
by master key, then panel owners by master key, then order owners by master key;
within each owner, version row then `validated`/`published` events then typed
relation replacement. A failure rolls back every pass. The release ID and
normalized stage fingerprints make an unchanged retry return the prior release
without advancing any owner.

Vocabulary stage rows additionally persist the resolved key, record type,
`value_kind`, `supports_unit`, and for units the canonical code; test stage rows
persist the resolved result-input ID/revision and optional unit ID/revision/code
alongside `decimalScale`; order stage rows persist the resolved specimen
ID/revision. These pinned fields are copied into each effective owner version,
so a version snapshot is self-contained and does not depend on a later current
vocabulary row.

The forward B1 migration replaces A1
`private.clinical_master_record_content(jsonb, text)` with the same public
signature. Before comparison, the publisher staging loop embeds the normalized
owner relation content under separate relation keys in the incoming owner
version content; it does not enlarge the typed `lab_panel` detail object:

- panel content includes `panelCode` plus `labPanelItems` containing stable
  target master keys/UUIDs, the **effective pinned test revision** from pass 1,
  sort, required, and display group;
- order content includes its exact one `labOrderProfile` target type, target
  master key/UUID/**effective pinned panel or test revision** from pass 2/1,
  and specimen key/UUID/revision.

The replaced `clinical_master_record_content` canonicalizes these embedded
arrays/objects, injects the generated action code when applicable, and removes
only the non-content `revision` field. For each owner, the publisher executes
this exact sequence before any typed relation replacement: (a) normalize the
typed detail and full relation/profile set, including explicit nulls, stable
sorting, and pinned vocabulary/test/panel revisions; (b) read the current owner
version and compare `(existing_version.snapshot - 'revision')` with the
normalized incoming owner content; (c) when different, set
`current_revision = latest_revision + 1`, insert exactly one immutable
`master_record_versions` row whose snapshot contains the full effective
panel/profile content and pinned revisions, and insert one immutable revision
event pair; and only then (d) replace that included owner's typed relation set.
A relation-only difference therefore changes the owning panel or order content
before relation rows are replaced and advances that owner exactly once. An
unchanged normalized retry advances neither revision nor relation history and
returns the existing release idempotently. If typed relation replacement fails,
the whole release transaction rolls back.

The relation snapshot is part of the owner version, so a panel version fully
describes its ordered components and an order version fully describes its
profile target/specimen. A panel membership change advances only the panel
owner; an order profile target/specimen change advances only the order owner.
The publisher does not silently bump an order owner merely because a referenced
panel later receives a new panel revision; a new profile payload must explicitly
pin the new panel revision.

### Workspace projection

A2 owns the catalog order row and its source master order lineage. B1 resolves
the panel through `master.lab_order_profiles`; it does not create a second
workspace panel authority.

Retain the existing `public.lab_test_items.category_id text not null` column; B1
does not add a second category field or change its product meaning. The current
foundation schema is the actual category contract: `lab_test_categories` has
only `id text primary key`, `workspace_id text not null`,
`category_name text not null`, and `sort_order integer not null` (plus audit
timestamps). It has no `category_group` column. Before adding the B1 item FK,
the forward migration preflights duplicate `(workspace_id,id)` pairs, adds
`unique (workspace_id,id)` to `public.lab_test_categories`, and replaces the
existing `lab_test_items_category_id_fkey` single-column item reference with
the tenant-safe composite FK
`(workspace_id,category_id) references public.lab_test_categories(workspace_id,id)`.

Add only the following B1 columns/constraints to `public.lab_test_items`:

```text
source_master_record_id uuid null
source_master_revision integer null
definition_origin text not null default 'workspace_custom'
  check (definition_origin in
    ('clair_master','workspace_custom','quarantined'))
quarantine_reason text null
customization_state text not null default 'unmodified'
  check (customization_state in ('unmodified','customized'))
workspace_result_revision integer not null default 1 check (workspace_result_revision > 0)
local_settings_revision integer not null default 1 check (local_settings_revision > 0)
result_value_kind text null
  check (result_value_kind is null or result_value_kind in ('numeric','text','coded'))
decimal_scale integer null check (decimal_scale >= 0)
legacy_saved_result_usage_count integer not null default 0
  check (legacy_saved_result_usage_count >= 0)
canonical_saved_result_usage_count integer not null default 0
  check (canonical_saved_result_usage_count >= 0)
quarantined_saved_result_usage_count integer not null default 0
  check (quarantined_saved_result_usage_count >= 0)
historical_unattributed_usage_residual integer not null default 0
  check (historical_unattributed_usage_residual >= 0)
saved_result_usage_count integer not null default 0
  check (saved_result_usage_count =
    historical_unattributed_usage_residual +
    legacy_saved_result_usage_count + canonical_saved_result_usage_count +
    quarantined_saved_result_usage_count)
last_applied_source_projection_snapshot jsonb null
last_applied_source_projection_sha256 text null
last_applied_source_projection_schema_version integer null
```

`definition_origin='quarantined'` requires a non-empty `quarantine_reason` and
both source master fields NULL; the two writable origins require a NULL reason.
The canonical trigger requires canonical identity/lineage and result-kind/input
fields to be non-null; unit, decimal scale, and display metadata remain
nullable. A valid source-null hospital-created item is always
`workspace_custom`; `legacy` is reserved for legacy result/link/header rows,
not item origins.

`category_id`, the hospital-admin list sort, and the B1 `is_active` setting are
live settings on the current item row, not source-content version fields and
not definition JSON. The existing table's compatibility
`lab_test_items.availability_status` remains the persisted item setting
(`is_active` is true only for `active`; false maps to `inactive` in this narrow
CAS), while catalog-level `order_catalog_items.availability_status` remains a
separate `availabilityStatus` field. `local_settings_revision` is their sole
CAS counter. A
`local_settings` mutation updates only those settings, increments
`local_settings_revision` once, leaves `workspace_result_revision`, the pinned
immutable item version, source fingerprint, and `customization_state` alone,
and increments each affected catalog's `catalog_revision` only when
`is_active` changes. Category and admin-sort changes do not change item pins or
catalog revisions. Current/version equality therefore compares only source
content: display name, executable input/result kind, unit, decimal scale,
source lineage/projection, customization state, and definition fingerprint.

The forward DDL installs this mutually exclusive check after classification:
`check ((definition_origin = 'quarantined' and
quarantine_reason is not null and pg_catalog.btrim(quarantine_reason) <> ''
and source_master_record_id is null and source_master_revision is null) or
(definition_origin in ('clair_master','workspace_custom') and
quarantine_reason is null))`. Canonical and workspace-custom typed
non-nullability is enforced by their fixed-search-path origin trigger; retained
legacy/quarantine rows are not made canonical by defaults. The focused
constraint test inserts a quarantined item with NULL and with blank/whitespace
`quarantine_reason` (both reject), a quarantined item with a non-empty reason
(accept), and each writable origin with a non-NULL reason (reject); only a NULL
reason is accepted for `clair_master` and `workspace_custom`.

`saved_result_usage_count` already exists in the legacy table; the forward
migration alters its check to equal the fixed historical residual plus the
three typed components above and adds
`legacy_saved_result_usage_count`, `canonical_saved_result_usage_count`,
`quarantined_saved_result_usage_count`, and the separately persisted
`historical_unattributed_usage_residual`. The migration-only classifier
computes that residual once from the pre-B1 persisted total and the distinct
attributable union; normal usage helpers never recompute or shrink it. Unsafe
cross-workspace or unattributable pre-B1 references are represented by that
fixed residual and reported separately; the residual includes their historical
aggregate and never shrinks. New unsafe references are rejected and rolled
back, never persisted as a new quarantine row or added to the residual.

Add to `public.order_catalog_lab_test_item_links`:

```text
source_master_panel_record_id uuid null
source_master_panel_revision integer null
source_master_test_record_id uuid null
owner_pinned_source_test_revision integer null
required boolean null
display_group text null
source_ordinal integer null check (source_ordinal is null or source_ordinal >= 0)
effective_sort_order integer null check
  (effective_sort_order is null or effective_sort_order >= 0)
pinned_workspace_result_revision integer null
link_revision integer not null default 1 check (link_revision > 0)
link_origin text not null default 'legacy'
  check (link_origin in
    ('clair_master','workspace_custom','legacy','quarantined'))
profile_kind text null
  check (profile_kind is null or profile_kind in ('panel','standalone_test'))
snapshot_metadata_schema_version integer null
snapshot_metadata_sha256 text null
link_quarantine_reason text null
```

The forward trigger/check is branch-specific (and is installed only after the
pre-existing classifier):

```text
link_origin = 'clair_master'
  -> profile_kind in ('panel','standalone_test'),
     source_master_test_record_id and owner_pinned_source_test_revision
     non-null, effective_sort_order non-null,
     source_ordinal non-null exactly when profile_kind = 'panel'
     and source_ordinal null exactly when profile_kind = 'standalone_test',
     snapshot_metadata_schema_version = 2,
     snapshot_metadata_sha256 ~ '^[0-9a-f]{64}$';
link_origin = 'workspace_custom'
  -> profile_kind = 'panel', source_master_test_record_id and
     owner_pinned_source_test_revision null, source_ordinal null,
     effective_sort_order non-null,
     snapshot_metadata_schema_version = 2,
     snapshot_metadata_sha256 ~ '^[0-9a-f]{64}$';
link_origin in ('legacy','quarantined')
  -> profile_kind, source_master_panel_record_id,
     source_master_panel_revision, source_master_test_record_id,
     owner_pinned_source_test_revision, source_ordinal,
     effective_sort_order, pinned_workspace_result_revision, required,
     display_group, snapshot_metadata_schema_version,
     snapshot_metadata_sha256 all null,
     link_quarantine_reason is not null and btrim(link_quarantine_reason) <> ''
     exactly when link_origin = 'quarantined', otherwise null.
```

The typed quarantine-reason check is exact and independent of historical
metadata: `check ((link_origin = 'quarantined' and
link_quarantine_reason is not null and
pg_catalog.btrim(link_quarantine_reason) <> '') or
(link_origin in ('clair_master','workspace_custom','legacy') and
link_quarantine_reason is null))`. The migration classifier writes one
deterministic code to this column for every quarantined link—one of
`cross_workspace_link`, `missing_item_version`, `source_pair_conflict`,
`impossible_profile`, or `untrusted_legacy_parent`—and writes NULL for
`clair_master`, `workspace_custom`, and exact `legacy` links. The reason is
typed report metadata, not part of authored schema-v2 `snapshot_metadata`.
The matching link constraint test rejects NULL and blank/whitespace
`link_quarantine_reason` for `link_origin='quarantined'`, accepts a non-empty
quarantine reason, and rejects any non-NULL reason for `clair_master`,
`workspace_custom`, or `legacy` links.

The selected immutable item version's optional source pair is checked by its
own version-origin predicate and is never copied into the link-level branch.
The trusted parent trigger additionally requires non-null order/panel lineage
for authored panel links, null panel lineage and exactly one link for a
`clair_master` standalone profile, and rejects any workspace-custom standalone
or extra member.

`sort_order` remains the legacy compatibility column. B1 authored links use
the typed `effective_sort_order` as the workspace-owned runtime order. A
`clair_master` panel link has raw normalized publisher
`labPanelItems.sortOrder` as `source_ordinal` (integer >= 0; gaps and zero are
valid); a `clair_master`
standalone link has `source_ordinal IS NULL` because the profile has no source
member order. A `workspace_custom` member added to a trusted master panel also
has `source_ordinal IS NULL`; all authored branches require a non-null
`effective_sort_order`. A unique constraint on
`(workspace_id, order_catalog_item_id, effective_sort_order)` applies to the
full authored `link_origin in ('clair_master','workspace_custom')` set for each
catalog panel, including paused and inactive links; any tie is a deterministic
CAS or adoption rejection, never an automatic renumber. Availability is
filtered only at confirmation. At that point the server sorts included active
members by `(effective_sort_order, stable link id)` and derives the frozen
ordinal as a 1-based contiguous rank; the server row ID uses that ordinal and
the stable link ID. It freezes the typed
`source_ordinal` (raw publisher ordinal for a panel `clair_master` link,
JSON null for standalone `clair_master` and `workspace_custom`) and non-null
`effective_sort_order` in the header/row snapshot. `pinned_workspace_result_revision` must reference the immutable
workspace item version.

Only `link_origin='clair_master'` requires the link-level
`source_master_test_record_id` and `owner_pinned_source_test_revision`; both
must match the immutable owner snapshot. A `clair_master` panel link has
non-null trusted order/panel owner lineage, non-null link-level test record and
owner revision, non-null pinned item-version revision, and an item-version
source pair whose record ID matches the link-level test record (and whose
revision matches the owner revision when unmodified). The only standalone
authored branch is `clair_master`: it has non-null trusted order lineage, null
panel lineage, exactly one non-null link-level test record/revision pair,
exactly one non-null pinned item-version revision, and exactly one member; its
immutable item-version source pair is non-null and matches that link-level test
record/revision. A `link_origin='workspace_custom'` link is panel-only: trusted
master order/panel owner lineage remains non-null, its link-level test
record/revision and `source_ordinal` are NULL, and its pinned item-version
revision is non-null. That selected immutable version has a non-null source
pair with matching record ID/revision exactly when it is master-derived, and
both source fields NULL exactly when it is a workspace-custom item. Its source
pair is never copied into link-level owner lineage. A workspace-custom member
cannot be added to a standalone profile. Legacy/quarantined links are
read-only and may retain only their arbitrary historical metadata; all new B1
typed lineage/pin/profile/hash fields are NULL. These branch checks are
enforced on typed links, adoption, confirmation freeze, and frozen rows.

The link branch contract is exhaustive and is evaluated from trusted immutable
owner/profile rows plus the selected immutable item version; the client never
supplies `linkOrigin`, `profileKind`, lineage, or snapshot metadata. B1
server-authored `clair_master` and `workspace_custom` links use exactly schema
version 2 and this key set:

```json
{
  "schemaVersion": 2,
  "linkOrigin": "clair_master|workspace_custom",
  "profileKind": "panel|standalone_test",
  "workspaceCatalogItemId": "text",
  "masterOrderRecordId": "uuid|null",
  "masterOrderRevision": "integer|null",
  "masterPanelRecordId": "uuid|null",
  "masterPanelRevision": "integer|null",
  "masterTestRecordId": "uuid|null",
  "ownerPinnedSourceTestRevision": "integer|null",
  "itemVersionSourceMasterRecordId": "uuid|null",
  "itemVersionSourceTestRevision": "integer|null",
  "labTestItemId": "text|null",
  "pinnedWorkspaceResultRevision": "integer|null",
  "required": "boolean|null",
  "displayGroup": "text|null",
  "sourceOrdinal": "integer|null",
  "effectiveSortOrder": "integer|null"
}
```

This schema-v2 object is never synthesized for `legacy` or `quarantined` links;
those pre-existing links retain arbitrary historical `snapshot_metadata` and
typed `link_origin/profile_kind/link_quarantine_reason` values only, with all
new B1 metadata fields and hash NULL.

The typed columns and the metadata must agree exactly under this truth table;
`null` means absent, not an inferred value:

| `linkOrigin` / `profileKind` | Enclosing owner lineage | Member-test lineage | Item pin and member fields | Writable? |
| --- | --- | --- | --- | --- |
| `clair_master` / `panel` | `masterOrderRecordId/revision` and `masterPanelRecordId/revision` non-null | `masterTestRecordId` and `ownerPinnedSourceTestRevision` non-null; the selected item-version source pair is non-null, its record ID agrees, and its revision agrees when unmodified | `labTestItemId` and `pinnedWorkspaceResultRevision` non-null; `required`, `displayGroup`, publisher `sourceOrdinal`, and `effectiveSortOrder` non-null | authored |
| `clair_master` / `standalone_test` | order owner pair non-null; panel pair null | exactly one link/member; link-level test record/revision non-null; selected item-version source pair non-null and matching | non-null item pin/revision, `sourceOrdinal` null because there is no source member order, and exactly one row; panel fields null | authored |
| `workspace_custom` / `panel` (custom item added to a trusted master panel/profile) | trusted master order and panel owner pairs remain non-null | link-level `masterTestRecordId` and `ownerPinnedSourceTestRevision` are null; selected item version is master-derived with its own non-null source pair or workspace-custom with both source fields null | item pin/revision and `required`, `displayGroup`, non-null `effectiveSortOrder`; `sourceOrdinal` is null | authored |
| `legacy` / `null` | all B1 order/panel/test lineage and item pin fields null; only the exact permitted same-workspace legacy parent and arbitrary old metadata may remain | null | no B1 member ordering/identity is trusted | read-only legacy compatibility |
| `quarantined` / `null` | any pre-existing impossible, cross-workspace, conflicting, or incomplete branch is preserved with all B1 lineage/pin fields null in the quarantined projection | null | no authored member fields are trusted; typed `link_quarantine_reason` is non-empty | read-only/report-only |

For every authored row `required` is boolean, `displayGroup` is text or null,
`effectiveSortOrder` is an integer >= 0, and `sourceOrdinal` is the raw
normalized publisher `sortOrder` (integer >= 0, with gaps/zero allowed) only
for a panel `clair_master` link. It is JSON null for a standalone
`clair_master` link and for a workspace-custom member added to a trusted
master panel. Legacy/quarantined rows have both ordering fields null.
`masterOrderRecordId/revision` and
`masterPanelRecordId/revision` are both null or both non-null; a member-test
record ID and owner-pinned revision are both null or both non-null. A
`clair_master` item-version source pair is both present and its record ID must
equal the owner test record ID. Its source revision equals the owner-pinned
revision when the projection is unmodified; divergence is allowed only after
explicit reviewed/local customization, and both revisions remain frozen. A
`workspace_custom` selected item version may carry its own master source pair,
but the link-level owner-test pair remains null. The server hashes the exact
normalized object with the PostgreSQL
`jsonb::text` SHA-256 rule already defined; typed columns and this equality
check, not metadata, own identity and authorization. The typed link
`profile_kind` is non-null exactly for authored `clair_master` or
`workspace_custom` links and is null exactly for `legacy` or `quarantined`
links; authored `profile_kind='panel'`/`'standalone_test'` must match the
trusted enclosing profile and the table above.

Backfill may choose the `workspace_custom` branch only for an added member of
a trusted master panel: A2/A3 catalog/order/panel identity must establish the
profile and enclosing owner lineage, and same-workspace item attribution plus
an immutable item version must prove the pin. It may not create a local
standalone profile or add a member to a master standalone profile. An empty
old JSON object alone never promotes a link. If that proof is absent, the
exact legacy predicate is used only when the permitted same-workspace legacy
parent and arbitrary historical metadata are retained with all new B1
lineage/pin/profile/hash/schema fields null; otherwise the link is quarantined
and remains read-only. The catalog membership projection and
frozen result snapshot carry the same `linkOrigin`, `profileKind`, lineage,
pin, required/display/order keys, and null normalization, and fixtures assert
every row of this table.

Add to `public.order_catalog_items` for the separate catalog-level lab
membership projection (not to each item link):

```text
last_applied_lab_membership_projection_snapshot jsonb null
last_applied_lab_membership_projection_sha256 text null
last_applied_lab_membership_projection_schema_version integer null
```

The source ID/revision pairs are both null or both non-null. Source IDs point to
the expected master record type through a fixed-search-path trigger/helper and
source pairs reference `master.master_record_versions(master_record_id,
revision)`. Add `(workspace_id,id)` unique keys and tenant-safe composite FKs
for item/link/catalog references. New master-derived links are explicit item
links; category-only expansion remains legacy compatibility. The B1 authoring
model has no `result_options` column or global options authority. Existing
`snapshot_metadata` is retained only for legacy compatibility; new authored
links use schema version 2 plus the server-computed
`snapshot_metadata_sha256`; typed columns, source IDs/revisions, last-applied
source projections, and `workspace_result_revision` remain the authority. Only
authored `clair_master`/`workspace_custom` link metadata is server-derived with
schema version 2 and a lowercase SHA-256. Pre-B1 `legacy` and `quarantined`
`snapshot_metadata` remains arbitrary historical JSON preserved byte-for-byte
and non-authoritative; no schema, hash, or provenance is inferred from it.
Typed lineage, origin, and `link_quarantine_reason` own the branch
classification and are used by identity and authorization checks.

The server-derived item projection snapshot has exactly schema version 1 and
the source-controlled typed fields `{sourceMasterRecordId, sourceMasterRevision,
testItemName, resultInputType, resultValueKind, resultUnit, decimalScale}`.
It excludes
workspace-owned item `is_active`, local display sort, usage counts, and
other declared local fields. The separate catalog-level membership projection
snapshot has `{sourceMasterOrderRecordId, sourceMasterOrderRevision, targetType,
sourceMasterPanelRecordId, sourceMasterPanelRevision, members}` in canonical
order, where `members` is an ordered array of
`{linkOrigin, profileKind, sourceMasterTestRecordId,
ownerPinnedSourceTestRevision, itemVersionSourceMasterRecordId,
itemVersionSourceTestRevision, labTestItemId, pinnedWorkspaceResultRevision,
sourceOrdinal, effectiveSortOrder, required, displayGroup}`. The array is serialized in
`(effectiveSortOrder, stable link id)` runtime order. The catalog-level source
fingerprint uses the same schema but hashes only source-controlled member
fields (`sourceMasterTestRecordId`, `ownerPinnedSourceTestRevision`,
`sourceOrdinal`,
`required`, and `displayGroup`); `effectiveSortOrder`, availability, local sort,
usage, and other workspace-owned fields are retained and excluded from source
overwrite/fingerprint. The snapshot remains server-derived evidence and is
never an authoring authority.
The link-level schema-version-2 `snapshot_metadata_sha256` and equality check
cover every metadata key, including `linkOrigin`, `profileKind`, all nullable
owner/item lineage, the item pin, and effective/source order. The separate
catalog source fingerprint includes structural `linkOrigin`/`profileKind` and
enclosing owner lineage in addition to its source-controlled member fields;
workspace-owned effective order, availability, local sort, usage, and item
customization values remain excluded from source overwrite. A branch or
profile-kind mismatch therefore creates a durable review target rather than a
silent metadata rewrite.
`sourceOrdinal` is raw publisher evidence and non-null only for a panel
`clair_master`; it is JSON null for a standalone `clair_master` link and for a
workspace-custom member added to a trusted master panel. `ownerPinnedSourceTestRevision` is link-level owner
lineage only for `clair_master` and is null for `workspace_custom`.
`effectiveSortOrder` and the pinned workspace revision are workspace projection
state and runtime authority for both authored branches. Local availability and
other declared workspace membership fields are preserved and excluded from
source overwrite/fingerprint.
Empty
optional values normalize to JSON `null`; the server computes the lowercase
SHA-256. JSON never authorizes a write or replaces a typed column.
`last_applied_*` is audit/version state, not a client authoring surface.
The metadata hash uses the same lowercase PostgreSQL SHA-256 expression as the
result snapshot over the normalized JSONB text. A NULL hash is required for a
pre-B1 legacy or quarantined link; only server-authored `clair_master` and
`workspace_custom` links receive the schema-version-2 hash.

Workspace panel identity is therefore the catalog item's stable ID plus its
direct source master order/profile revision. Workspace result-item identity is
the existing text `lab_test_items.id`; its canonical identity is the source
master ID/revision. Workspace profile identity is the canonical order profile
resolved from the catalog's A2/A3 source master order. Every canonical B1
catalog order must retain non-null trusted master order-profile lineage; B1
does not create a parallel workspace profile authority. A master standalone
profile has exactly one `clair_master` link and cannot accept a
`workspace_custom` extra member. Workspace-custom additions are valid only as
members of a trusted master panel profile.

The existing `lab_test_items.result_input_type` check remains executable with
its current values `number`, `text`, `select`, `positive_negative`, and `grade`;
B1 does not add `coded` to that check. The new canonical typed mapping is
`result_value_kind = numeric -> result_input_type = number`,
`text -> text`, and `coded -> text` (opaque scalar storage, no options/select
authority). `select`, `positive_negative`, and `grade` remain legacy or
workspace-custom values unless a separately approved migration replaces the
old check. `decimal_scale` is server-projected typed numeric metadata and must
be frozen with the result rows. No alternate scale field is part of the
canonical B1 schema or snapshot.

### Encounter result-definition snapshot

Add to `public.lab_result_entries`:

```text
source_workspace_catalog_item_id text null
source_workspace_catalog_revision integer null
source_master_order_record_id uuid null
source_master_order_revision integer null
source_master_panel_record_id uuid null
source_master_panel_revision integer null
source_master_test_record_id uuid null
source_master_test_revision integer null
result_definition_snapshot jsonb not null default '{}'
  check (jsonb_typeof(result_definition_snapshot) = 'object')
result_definition_snapshot_sha256 text null
result_definition_origin text not null
  check (result_definition_origin in ('canonical','legacy','quarantined'))
result_quarantine_reason text null
```

The forward migration drops the existing legacy default before classification,
backfills every old row to exactly one origin, then installs the NOT NULL/check
constraint and migration classifier. New canonical rows must state their origin
explicitly; no default can make a direct-lineage row appear legacy. Only
pre-existing rows may be classified as quarantined.

For a canonical panel result, the snapshot contains the exact ordered panel
component list and each workspace result item projection. For a standalone
canonical test result, it contains exactly one result field and a profile with
`lab_test_id`. The source master/order/catalog pairs are null or complete. The
snapshot is written by the trusted A3 confirmation hook before commit and is
never refreshed from current catalog/master rows. Add a partial unique index on
`(workspace_id, order_id)` where `result_definition_origin = 'canonical'`.
`result_id` is server-derived as `lab-order:<order_uuid>`; the client may echo
that value only after it is returned and cannot choose or re-parent the header.

For a canonical result, `result_definition_snapshot` is schema version 1 with
exact keys and types:

```json
{
  "schemaVersion": 1,
  "source": {
    "workspaceCatalogItemId": "text",
    "workspaceCatalogRevision": 1,
    "masterOrderRecordId": "uuid",
    "masterOrderRevision": 1,
    "profile": {
      "orderRecordId": "uuid",
      "targetType": "panel|test",
      "labPanelRecordId": "uuid|null",
      "labPanelRevision": "integer|null",
      "labTestRecordId": "uuid|null",
      "labTestRevision": "integer|null",
      "specimenTypeRecordId": "uuid|null",
      "specimenTypeRevision": "integer|null"
    }
  },
  "rows": [{
    "rowId": "<lowercase 64-hex server row ID>",
    "rowDefinitionOrigin": "clair_master|workspace_custom",
    "ordinal": 1,
    "labTestItemId": "text",
    "sourceMasterTestRecordId": "uuid|null",
    "ownerPinnedSourceTestRevision": "integer|null",
    "itemVersionSourceMasterRecordId": "uuid|null",
    "itemVersionSourceTestRevision": "integer|null",
    "workspaceResultRevision": 1,
    "sourceOrdinal": 0,
    "effectiveSortOrder": 0,
    "analyteName": "text",
    "resultValueKind": "numeric|text|coded",
    "resultInputType": "number|text|select|positive_negative|grade",
    "unit": "text|null",
    "decimalScale": "integer|null",
    "referenceRange": null,
    "required": true,
    "displayGroup": "text|null"
  }]
}
```

The JSON example shows a panel member with publisher `sourceOrdinal = 0`; the
exact value is `null` for a standalone `clair_master` row and for a
`workspace_custom` panel addition. All optional values are explicitly normalized to `null`; empty strings become
`null`; rows are assigned ordinals after sorting the included active links by
`(effective_sort_order, stable link id)`; and no extra keys are accepted.
`resultValueKind = coded` uses the opaque string/text storage path and has no
options array. PostgreSQL serializes this canonical `jsonb` and computes the
lowercase SHA-256 exclusively as
`lower(encode(extensions.digest(convert_to(snapshot::jsonb::text, 'UTF8'),
'sha256'), 'hex'))`; no client/source insertion order participates. The
server row ID is deterministic SQL text using the immutable server link ID as
the stable member identity:
`lower(encode(extensions.digest(convert_to(format('lab-result-row:v1:%s:%s:%s',
order_id::text, stable_link_id::text, ordinal::text), 'UTF8'), 'sha256'), 'hex'))`.
`stable_link_id` is the server-derived immutable catalog-link ID; the frozen
row also carries the stable `labTestItemId` and pinned lineage fields in the
hash input. The result is a lowercase 64-hex value, is not generated by the
client or a mutable item ID, and uses the 1-based frozen ordinal rather than
publisher source order. The exact header JSONB hash therefore includes the
stable link/item/lineage identities and that frozen ordinal.
The canonical object key order is not authoritative because PostgreSQL `jsonb`
canonicalizes object keys. The exact object key sets/types and exact rows-array
order are authoritative. Row keys are represented as
`rowId`, `rowDefinitionOrigin`, `ordinal`, `labTestItemId`, source test lineage,
`ownerPinnedSourceTestRevision`, `itemVersionSourceMasterRecordId`,
`itemVersionSourceTestRevision`,
`workspaceResultRevision`, `sourceOrdinal`, `effectiveSortOrder`,
`analyteName`, `resultValueKind`, `resultInputType`, `unit`, `decimalScale`,
`referenceRange`, `required`, `displayGroup`. `sourceOrdinal` preserves the
raw normalized publisher `(sortOrder,testMasterKey)` evidence only for a panel
`clair_master` row; it is JSON null for standalone `clair_master` and
`workspace_custom` panel additions. It never overrides the workspace
`effectiveSortOrder`; `ordinal` is the 1-based contiguous frozen rank and is
`1` for a standalone result.
Object insertion/key order is non-authoritative because `jsonb` canonicalizes
keys; tests must compare the database-produced canonical `jsonb::text` and
lowercase hash, not source insertion order. The rows array order remains
authoritative and is exactly the effective-order sequence described above.
Canonical rows require non-empty schema-version/rows, a lowercase 64-character
hash, and typed row equality with the header snapshot. Every canonical frozen
row stores `workspaceResultRevision` and it must equal the link's pinned
immutable `lab_test_item_versions.workspace_result_revision` captured at
confirmation; it need not equal the mutable current item revision. `{}`/NULL
snapshot/hash is allowed only for the exact `legacy_valid` predicate; during
the pre-existing-row migration, a direct lineage row with `{}`/NULL or invalid
hash is `quarantined`, not legacy. A new invalid canonical write rolls back.

The canonical row truth table is exhaustive. With a canonical header, every
row requires non-null `rowId`, item ID, `pinnedWorkspaceResultRevision`,
result value kind, executable input type, ordinal, non-null effective sort
order, `required`, and immutable workspace/header/order parents. A
`rowDefinitionOrigin='clair_master'` panel row additionally requires the
publisher `sourceOrdinal` (integer >= 0), `sourceMasterTestRecordId`,
`ownerPinnedSourceTestRevision`, and
`itemVersionSourceMasterRecordId`/`itemVersionSourceTestRevision`; `unit`,
`decimalScale`, and `displayGroup` remain nullable. A
`rowDefinitionOrigin='clair_master'` standalone row has exactly one row,
null panel lineage and `sourceOrdinal` JSON null, while retaining its
non-null link-level test lineage and item-version source pair. A
`rowDefinitionOrigin='workspace_custom'` row requires the same canonical
identity/typed parent fields but its link-level `sourceMasterTestRecordId` and
`ownerPinnedSourceTestRevision` are NULL, its `sourceOrdinal` is JSON null,
and its `effectiveSortOrder` is non-null. Its item-version source pair is
non-null exactly when the selected immutable item version is master-derived
(with the item-version record ID matching that pair), and is NULL exactly for
a source-null workspace-custom item. Legacy and quarantined migration rows may retain typed
NULLs only under their exact mutually exclusive predicates and are never
accepted by the canonical writer. A canonical header may contain only these
two authored row origins and never a mixed legacy/quarantine row.

`resultInputType` is a frozen executable input/storage contract, distinct from
`resultValueKind`, and is present in every canonical snapshot row, typed frozen
row, equality check, hash input, private serializer, getter/save response, and
result-sheet UI model. A `clair_master` definition maps canonical `coded` to
`resultValueKind='coded'` and executable `resultInputType='text'`. A
`workspace_custom` row preserves exactly one allowed existing executable value
(`number|text|select|positive_negative|grade`) while its value kind remains
`numeric|text|coded`; `coded` still uses the opaque existing text path and has
no option authority. The client may render the returned input type but cannot
author or change it in a result save.

Add/validate these parent constraints and identity rules:

- partial unique index
  `lab_result_entries_canonical_order_unique` on `(workspace_id, order_id)`
  where `result_definition_origin = 'canonical'`;
- composite `(workspace_id, order_id)` FK to the post-A3 `orders` tenant key and
  composite `(workspace_id, encounter_id)` FK to the encounter tenant key;
- composite `(workspace_id, work_item_id)` FK when `work_item_id` is non-null,
  plus a fixed trigger that requires the work item’s `order_id` and
  `encounter_id` to equal the immutable header parents;
- composite `(workspace_id, lab_result_entry_id)` FK from rows to the result
  header and composite `(workspace_id, lab_test_item_id)` FK for new canonical
  rows;
- composite `(workspace_id,lab_test_item_id,workspace_result_revision)` FKs
  from authored `clair_master`/`workspace_custom` links and frozen rows to
  `public.lab_test_item_versions`; confirmation joins each link's
  `pinned_workspace_result_revision` to that immutable version row and never
  requires equality to the mutable current item revision;
- canonical panel headers require non-null panel lineage; each frozen
  `clair_master` panel row requires non-null link-level test record/revision,
  source ordinal, and a pinned master-derived item-version source pair, while
  each frozen `workspace_custom` panel row requires link-level test
  record/revision and source ordinal NULL plus an item-version source pair that
  is both non-null for master-derived or both NULL for workspace-custom.
  Canonical standalone-test headers require null panel lineage and exactly one
  frozen `clair_master` row with non-null link-level test record/revision,
  pinned master-derived item-version source pair, and source ordinal NULL;
- `workspace_id`, `order_id`, `encounter_id`, `result_id`, source catalog/master
  lineage, and the canonical header's parent identity are immutable after
  creation; `work_item_id` may transition only once from NULL to a valid
  same-workspace/same-order work item;
- a canonical header must have exactly one order and one result identity, and a
  canonical row's `workspace_id`/header ID/row ID cannot be changed by any
  authenticated path.

The unique/index and pair checks are concrete migration objects:

```sql
create unique index lab_result_entries_canonical_order_unique
  on public.lab_result_entries (workspace_id, order_id)
  where result_definition_origin = 'canonical';

alter table public.lab_result_entries
  add constraint lab_result_entries_canonical_source_pair_check
  check ((source_master_order_record_id is null) =
         (source_master_order_revision is null));

alter table public.lab_result_entries
  add constraint lab_result_entries_origin_snapshot_check
  check (
    (result_definition_origin = 'legacy'
      and source_workspace_catalog_item_id is null
      and source_workspace_catalog_revision is null
      and source_master_order_record_id is null
      and source_master_order_revision is null
      and source_master_panel_record_id is null
      and source_master_panel_revision is null
      and source_master_test_record_id is null
      and source_master_test_revision is null
      and result_definition_snapshot = '{}'::jsonb
      and result_definition_snapshot_sha256 is null
      and result_quarantine_reason is null)
    or
    (result_definition_origin = 'canonical'
      and source_workspace_catalog_item_id is not null
      and source_workspace_catalog_revision is not null
      and source_master_order_record_id is not null
      and source_master_order_revision is not null
      and result_definition_snapshot <> '{}'::jsonb
      and result_definition_snapshot_sha256 ~ '^[0-9a-f]{64}$'
      and result_quarantine_reason is null
      and ((source_master_panel_record_id is not null
            and source_master_panel_revision is not null
            and source_master_test_record_id is null
            and source_master_test_revision is null)
           or
           (source_master_panel_record_id is null
            and source_master_panel_revision is null
           and source_master_test_record_id is not null
            and source_master_test_revision is not null)))
    or
    (result_definition_origin = 'quarantined'
      and result_quarantine_reason is not null
      and length(pg_catalog.btrim(result_quarantine_reason)) > 0)
  );
```

Add the matching pair checks for every source lineage pair and a fixed
search-path trigger that enforces `definition_origin = 'clair_master'` iff
`source_master_record_id` and `source_master_revision` are both present;
`workspace_custom` requires both source values NULL, while `legacy` is a result
header/link origin and never an item/version origin. The header constraint is
completed by a deferred/fixed trigger with these exact branches: a panel header
has one or more rows; each `clair_master` panel row has non-null link-level test
record/revision, source ordinal, and a pinned immutable item version whose
source pair is non-null with matching record ID, while each
`workspace_custom` panel row has non-null master order/panel owner lineage,
NULL link-level test record/revision and source ordinal, and a pinned immutable
item version whose source pair is either both non-null for a master-derived
version or both NULL for a workspace-custom version. The standalone branch has
null panel lineage and exactly one row whose origin is `clair_master`, with
non-null link-level test record/revision, non-null pinned item-version
revision/source pair matching that lineage, and `sourceOrdinal` NULL. It also
compares each row's `workspace_result_revision`, snapshot row
ID, typed item ID, and typed values to the header snapshot and the immutable
workspace item-version FK. It never compares a post-freeze row to the mutable
current item or catalog projection. A canonical header therefore cannot have a
partial or mixed lineage set; a legacy header has all catalog/master/panel/test IDs,
revisions, and the snapshot hash NULL. A quarantined header may retain the
diagnostic lineage/snapshot values needed for report-only repair, but its
reason, origin, and write-denied state are durable and mutually exclusive with
the canonical and legacy predicates.

The header has no `workspace_catalog_item_id` column; all canonical parent
checks use `source_workspace_catalog_item_id`. The fixed-search-path classifier,
deferred trigger, and confirmation/save RPCs join the immutable parent order on
`orders.workspace_id = lab_result_entries.workspace_id`,
`orders.id = lab_result_entries.order_id`, and
`orders.encounter_id = lab_result_entries.encounter_id`, then require
`orders.workspace_catalog_item_id =
lab_result_entries.source_workspace_catalog_item_id` for canonical rows. The
legacy branch instead requires that same parent order's
`orders.workspace_catalog_item_id IS NULL`, plus the exact empty-snapshot,
NULL-hash, all-lineage-null predicate below. A parent/order/encounter mismatch
is a runtime error for new writes and a migration quarantine for pre-existing
rows.

The origin predicates are exhaustive and mutually exclusive: `canonical` is
allowed only with complete direct catalog/master lineage, a non-empty valid
schema-v1 snapshot/hash, and the panel or standalone row branch; `legacy` is
allowed only with the exact `{}` snapshot, NULL hash, all catalog/master/
panel/test/revision fields NULL, `origin='legacy'`, and the permitted
same-workspace legacy parent; `quarantined` is the migration-only state for
any pre-existing conflict, missing snapshot, cross-workspace parent, impossible
parent, partial lineage, or conflicting requested origin. A runtime invalid
insert is rolled back by the deferred trigger and is never assigned
`quarantined`.

The analogous catalog/panel/test and work-item constraints use the same
workspace key plus the actual post-A3 UUID/text types; the implementation must
inspect those keys before migration rather than cast or infer them.

The fixed-search-path equality helper is:

```text
private.clair_assert_lab_result_definition_snapshot(
  p_workspace_id text,
  p_result_entry_id uuid
) returns void
```

It recomputes the canonical JSONB hash, checks schema version/key set/null
normalization and the lowercase SHA-256, compares the ordered snapshot rows to
the N typed `lab_result_entry_rows`, checks panel-versus-standalone lineage,
and checks every row's `workspaceResultRevision` against its frozen typed
column. It raises `lab_result_definition_snapshot_invalid` before any
canonical read/write if either header or row equality fails. Stable row IDs are
derived once from exactly `(order_id, stable_link_id, frozen_ordinal)` using the
lowercase SHA-256 formula above; post-freeze validation compares only that
stored immutable row ID and header snapshot, and a delete/reinsert cannot
overwrite canonical identity or consult current links.

At confirmation the server joins every authored link by its
`pinned_workspace_result_revision` to `public.lab_test_item_versions` and
freezes that version's typed definition, source pair, effective order, and
availability decision. For a `clair_master` panel or standalone link it also
freezes the non-null link-level test record/revision and the panel publisher
ordinal or standalone `sourceOrdinal=NULL`; for a `workspace_custom` panel
link it freezes link-level test record/revision and `sourceOrdinal` as NULL,
while independently freezing the selected item-version source pair (both
non-null for a master-derived version, both NULL for a workspace-custom
version). The
mutable `lab_test_items` row
may be read only for stable identity and current availability; no latest
revision equality is required. A link pinned at N remains valid when the
shared current item projection advances to N+1. The confirmation-only checks
compare the locked workspace catalog `catalog_revision`, link pins, and the A3
order snapshot against pinned immutable master versions. After the canonical
header/rows commit,
the deferred/fixed immutability trigger, getter, v2 save, result-sheet route,
and attachment helper compare only the stored header snapshot/hash, typed
frozen rows, owner/item-version source revisions, and immutable parent IDs. They never join
or compare against current catalog rows, current workspace item revisions, or
current master typed tables. A later item/catalog/master advance therefore
cannot invalidate historical validation or cause a definition refresh.

Where legacy data prevents immediate validation, the composite constraints may
be added `NOT VALID`: PostgreSQL still enforces all new inserts/updates, while
the preflight reports old invalid rows. B1 must not claim those old rows are
validated or silently repair them.

The existing `lab_result_entry_rows` remains the value/read model. Add typed
`row_definition_origin` (`clair_master|workspace_custom|legacy|quarantined`),
`workspace_result_revision`, `source_master_test_record_id`,
`owner_pinned_source_test_revision`, `item_version_source_master_record_id`,
`item_version_source_test_revision`,
  `result_value_kind`, executable `result_input_type`, `decimal_scale`, `source_ordinal`,
`effective_sort_order`, `required`, and `display_group` columns. For canonical
entries, `source_ordinal` is non-null only for panel `clair_master` rows and is
NULL for standalone `clair_master` and `workspace_custom` rows; unit, decimal
scale, and display group remain nullable. Other typed fields may be nullable
only for exact legacy or quarantined migration rows. For a canonical entry,
`lab_test_item_id`, `analyte_name`,
`result_unit`, `reference_range`, and all those typed definition fields are
definition fields and must match the frozen header snapshot; only `result_value`
and `note` are mutable
  through the canonical save path. Existing legacy values/reference ranges are
  copied as historical compatibility snapshot values only. New B1 definitions
  do not publish ranges, client judgment is rejected, and canonical judgment is
  always persisted as `not_judged`.

The row discriminator has the executable check
`row_definition_origin in ('clair_master','workspace_custom','legacy','quarantined')`;
it is non-null for every canonical row and may remain NULL only where the
exact pre-B1 legacy/quarantine classifier explicitly permits it. Canonical
`workspace_result_revision`, item ID, row ID, result kind/input type, ordinal,
effective sort, and required flag are non-null and must equal the frozen header
snapshot; canonical unit, decimal scale, and display group remain nullable.

The existing delete-lock invariant is preserved through a fixed-search-path
repair function:

```text
private.clair_recompute_lab_test_item_saved_result_usage(
  p_workspace_id text,
  p_lab_test_item_id text
) returns integer
```

The confirmation path uses the deterministic batch wrapper rather than calling
the per-item helper in an arbitrary order:

```text
private.clair_recompute_lab_test_item_saved_result_usage_batch(
  p_workspace_id text,
  p_lab_test_item_ids text[]
) returns jsonb
```

It normalizes to sorted distinct same-workspace item IDs, locks them in that
order, invokes the per-item calculation exactly once per ID, and returns each
old/new current component, the unchanged
`historical_unattributed_usage_residual`, and total. A retry with an existing canonical header passes
an empty set and changes nothing. The per-item helper remains available only
for deterministic single-item repair/CAS paths.

It first partitions attributable pre-B1 references into mutually exclusive
`canonical_refs`, `legacy_refs`, and `quarantine_refs` sets, using the exact
origin/header/link predicates before counting anything. `attributed_preB1_total`
is the count of the distinct union of those three sets, not their overlapping
sum. During migration only, `old_total` is the persisted
`saved_result_usage_count` captured before replacement and
`historical_unattributed_usage_residual = greatest(old_total -
attributed_preB1_total, 0)` is persisted as a separate, fixed historical
baseline. The current components then are
`canonical_saved_result_usage_count = count(canonical_refs)`,
`legacy_saved_result_usage_count = count(legacy_refs)`, and
`quarantined_saved_result_usage_count = count(quarantine_refs)`; none of those
components absorbs the residual. The runtime total is exactly
`historical_unattributed_usage_residual + canonical + legacy + quarantined`.
The residual is non-decreasing and is never recomputed or shrunk by a normal
save, repair, reclassification, or retry. Confirmed null-valued canonical rows
count; cancellation or later history never removes a reference. Quarantined
attributable references count only in the quarantine component and
reclassification moves a reference between mutually exclusive sets exactly
once without changing the distinct union or total.
Unsafe cross-workspace or unattributable pre-B1 references are not assigned to
a current canonical/legacy/quarantine component, but their historical
aggregate is already preserved in `historical_unattributed_usage_residual` and
therefore remains included in the total. They are returned separately by the
fixed-search-path diagnostic
`private.clair_list_lab_usage_count_exceptions(p_workspace_id text,
p_lab_test_item_id text)`, which reports the row identity and exclusion reason.
The confirmation hook calls the batch function once with all N distinct panel
member item IDs after its N-row insert in the same transaction; each count
changes exactly once. An existing canonical header on retry passes no item IDs
and therefore causes no double count. Value/note saves do not call it, and
cancellation/history never decrements it. The v1 legacy writer updates only the
legacy component, then calls the same repair function; it never recomputes the
fixed historical residual, total, or canonical/quarantined components from
legacy rows alone. The
hospital-admin delete-lock reads the persisted total and remains blocked when
it is positive; `ON DELETE RESTRICT` remains in force for attributed items.

### Identity, lifecycle, and pricing invariants

- A master test/panel identity is `(master_record_id, current_revision)`;
  published version rows are immutable and a changed definition receives a new
  master revision/release.
- A workspace result item is `(workspace_id, lab_test_items.id)`; source master
  lineage is optional only for `workspace_custom` items. Legacy/quarantined
  compatibility rows are not workspace item origins and must never be used to
  infer source lineage.
- A panel membership is an explicit authored `clair_master` or
  `workspace_custom` link row with branch-specific source ordinal, workspace
  `effective_sort_order`, typed `required`/`display_group`, and pinned item
  revision. Only `clair_master` carries link-level member-test lineage;
  `workspace_custom` carries null member-test lineage. Authored readers never
  use legacy `sort_order`.
- A canonical order profile has exactly one target: one test or one panel; a
  standalone target has exactly one `clair_master` link and cannot accept a
  workspace-custom extra member.
- At A3 catalog lab-order confirmation, one transaction creates one `orders`
  row, one canonical result header, and N null-valued result rows before commit.
  Later fulfillment attaches at most one same-workspace work item to that header
  without refreshing definitions. A3 then creates one fulfillment row and one
  invoice line when billing rules permit.
- At that confirmation point the server resolves only the immutable
  `master_record_versions` owner snapshots pinned by the A3 catalog/order
  lineage. It does not consult current typed master rows to interpret an old
  revision. Required inactive catalog/result items reject confirmation;
  optional inactive items are omitted from the frozen active set; a standalone
  inactive item rejects; and at least one active explicit panel item is
  required. The snapshot records the included active set and full pinned
  profile revision, effective workspace order, decimal scale, required/display
  group, and workspace result revision. For each panel or standalone
  `clair_master` row the snapshot carries its non-null owner-pinned source
  test revision and matching item-version source record/revision; for each
  `workspace_custom` panel row the link-level owner-pinned source test
  revision is NULL, while the selected item-version source pair is independently
  non-null/matching when master-derived or NULL when workspace-custom.
  A later pause/inactivation never changes the frozen rows.
- `NULL price` remains non-billable/unset per A2/A3; explicit `0` remains a
  billable free price when the catalog says billing is enabled. B1 adds no
  canonical price.
- Existing order, fulfillment, billing, and definition snapshots are historical
  values. A later master/catalog/link change never rewrites them.
- Canonical confirmation starts `received`; canonical save changes status only to
  `entered`. Canonical B1 has no reviewed/cancelled/corrected/finalized/amended
  write path. Those statuses are read-only/write-denied for canonical rows;
  existing legacy behavior remains explicitly legacy-only.
- A parent order with `orders.workspace_catalog_item_id IS NULL` is eligible for
  the A3 technical legacy bucket only when the exact `legacy_valid` predicate
  passes. Existing
  `service_item_id`, legacy result rows, service links, names, and JSON are
  preserved and never promoted by inference. A direct catalog-origin row with
  invalid lineage/snapshot is `quarantined`, not legacy.

## Forward migration contract

Create one migration after the actual A3 migration, for example:

`supabase/migrations/<next>_clinical_master_phase1b1_laboratory_slice.sql`

Do not edit A1, A2, A3, existing seed, or existing predecessor migration files.

### Entry preflight

The migration must stop before schema/backfill changes if any of the following
is missing:

- A1 private master tables/publisher and runtime/security evidence;
- A2 catalog `source_master_record_id`, `source_master_revision`,
  `catalog_revision`, nullable price, and direct-DML revocation;
- A3 `orders.workspace_catalog_item_id`, direct master lineage, immutable
  applied snapshot, fulfillment snapshot, billing anchor, and service NULL
  semantics;
- same-workspace composite target keys required by the new constraints;
- deterministic synthetic mapping for every B1 catalog/item/link fixture.

Preflight classifications:

| Condition | Classification | Allowed outcome |
| --- | --- | --- |
| Existing lab item has explicit deterministic master mapping and matching input/unit shape | Adoptable | Add source lineage and frozen projection metadata. |
| Existing category-only link or link without authored branch identity | Legacy | Preserve; never use for new authored panel flow. |
| Mapping requires name, price, `serviceItemId`, `pricing_rule`, or JSON inference | Quarantine/report-only | Preserve row; no automatic mapping. |
| Existing cross-workspace item/link/order/result parent or missing historical parent | Quarantine/report-only | Preserve and deny both writers; do not rewrite or delete existing rows. |
| New/B1 fixture cross-workspace parent, duplicate authored membership, or conflicting sort | Fatal | Abort before insert/publication; do not infer or repair. |
| Legacy result row has a workspace mismatch | Quarantine/report-only | Keep historical data read-only/reportable; enforce new composite checks for all new rows. |
| B1 synthetic row has any workspace mismatch or incomplete source pair | Fatal | Abort before canonical fixture publication. |

Before installing the usage-count check, the migration drops/replaces any
obsolete count-consistency trigger or check, classifies pre-existing result/link
rows into mutually exclusive canonical, legacy, and quarantined reference sets,
captures `old_total = saved_result_usage_count`, and computes
`attributed_preB1_total` from the distinct union of those sets. It persists
`historical_unattributed_usage_residual = greatest(old_total -
attributed_preB1_total, 0)` as a separate fixed historical baseline, then
backfills the three current components from their distinct sets. The resulting
sum is exactly `historical_unattributed_usage_residual + canonical +
attributable legacy + attributable quarantine`; it is equivalent to
`greatest(old_total, attributed_preB1_total)` without double-counting an
overlapping identity. The residual is never recomputed or shrunk after this
migration step. It locks each workspace item in sorted ID order, then installs
non-negative component/sum checks and fixed-search-path count helpers/triggers
and validates them. Any negative, cross-workspace, or origin-conflicting count
is fatal; it is never repaired by guessing from names, links, or JSON. Unsafe
pre-B1 references are represented only by the fixed residual, which includes
their historical aggregate, and separately reported; unsafe new references are
rejected and rolled back, never persisted as quarantine and never added to the
residual.

Quarantine means “preserved, reported, and excluded from canonical B1 writes”; it
does not mean silently moving data to another workspace or deleting it. A
separate quarantine table is not required by the approved Phase 1 spec.

The result-specific migration classifier must classify each pre-existing header
exactly once, in this order, before adding the canonical partial unique index
or validating composite keys. This classifier is migration-only: it may persist
`canonical`, `legacy`, or `quarantined` for rows that already exist, but it is
never called by a runtime insert/update trigger. A default cannot make one row
satisfy two buckets:

| Bucket | Predicate | Outcome |
| --- | --- | --- |
| `canonical_valid` | Direct A3 catalog/order lineage, same-workspace immutable parents, exactly one order/header, complete panel-or-standalone lineage, non-empty schema-v1 snapshot, valid lowercase hash, and typed rows equal the frozen snapshot | Adopt/read only; v2 writer allowed. |
| `legacy_valid` | exact permitted legacy parent (the joined same-workspace order/encounter/row parents are valid and `orders.workspace_catalog_item_id IS NULL`), `result_definition_origin='legacy'`, exact `result_definition_snapshot = '{}'::jsonb`, `result_definition_snapshot_sha256 IS NULL`, `result_quarantine_reason IS NULL`, and every catalog/master/panel/test ID and revision field NULL | Tolerated read/write only through the explicit v1 legacy path; never canonicalized. |
| `quarantined` | Any direct/catalog lineage with missing or invalid snapshot/hash, cross-workspace or impossible parent, partial lineage pair, conflicting origin, or an existing explicit quarantine reason | Preserve and report; both v1 and v2 write-denied. No inferred repair. |
| `canonical_duplicate_order` | More than one candidate header for `(workspace_id,order_id)` before classification | Fatal migration abort; no merge/delete. |
| `new_unclassifiable` | A B1 fixture/new canonical write that does not satisfy exactly the canonical predicate after direct parent checks | Fatal; the transaction rolls back before commit; no runtime quarantine row is persisted. |

The workspace-projection preflight emits separate source/projection buckets;
availability and local sort are never part of the source comparison:

| Bucket | Predicate | Outcome |
| --- | --- | --- |
| `lab_item_source_match` | `customization_state='unmodified'`, source-controlled typed columns equal the last-applied typed projection and source revision, and the prior snapshot/hash is valid | Safe auto-update through the dedicated item CAS; create one immutable workspace item version, increment `workspace_result_revision` once, and refresh the server-derived snapshot/hash. |
| `lab_item_source_mismatch` | any source-controlled typed field differs, `customization_state='customized'`, or the prior projection/hash is absent or invalid | Preserve the whole workspace item, create a durable lab-item update target, and require the single definition-review resolver's accept/reject decision; no partial overwrite. A master-derived item retains its source provenance; a workspace-custom item remains source-null. |
| `lab_membership_source_match` | catalog's full authored `clair_master`/`workspace_custom` panel membership equals its last-applied catalog projection | Safe full-set link adoption; preserve local availability/sort/other fields and increment `catalog_revision` once. |
| `lab_membership_source_mismatch` | any authored member/profile/ordering field differs from the last-applied catalog projection | Preserve the full local set, create a catalog-level update target with expected `catalog_revision`, and require CAS review. |
| `lab_item_shared_reference` | one workspace item is linked by two or more catalog orders | Report every referencing catalog ID; any accept/update locks all of them, advances the shared item once, and increments `catalog_revision` only for catalogs whose targeted/eligible link pin actually changes. |
| `lab_projection_missing_provenance` | source pair exists but last-applied snapshot/schema/hash is missing or invalid | Quarantine/report-only; never infer provenance or silently backfill from current names/JSON. |

These buckets are fatal if a B1 canonical fixture cannot satisfy the canonical
predicate. Existing legacy rows are tolerated only as read-only/report-only
compatibility where the exact v1 predicate passes; existing quarantined rows
remain operator-owned, reportable, and write-denied.

Composite FKs that encounter old cross-workspace quarantined rows are added
`NOT VALID`: PostgreSQL enforces them for every new insert/update, while the
old rows remain reported and unvalidated. Validation may be a later cleanup
item; B1 cannot call those historical rows canonical, let v1/v2 write them, or
silently repair them.

Constraint ordering is executable: first classify/backfill and preflight every
canonical duplicate item identity, canonical `(workspace_id,
order_catalog_item_id, lab_test_item_id)` tuple, and canonical effective-sort
tuple; quarantine/report pre-existing exception rows and abort B1 fixtures.
Then create both canonical partial unique indexes as ordinary indexes. `NOT
VALID` is never used for an index or a trigger. Next add only eligible
workspace composite FKs and CHECK constraints; validate a constraint only when
the complete retained row set passes. FKs/CHECKs with tolerated legacy or
quarantine exceptions remain `NOT VALID`, with deterministic row-ID reports,
while PostgreSQL still enforces every new insert/update. Install fixed-search-
path and `DEFERRABLE INITIALLY DEFERRED` constraint triggers only after
classification/backfill and index creation; constraint triggers cannot be
`NOT VALID`.

### Canonical master forward extension

The B1 migration transaction ordering is fixed:

1. `BEGIN`, acquire the A1 publication advisory lock, and validate every
   existing `master.master_records.record_type` against the A1 set before
   changing the check constraint. Any unexpected existing value aborts.
2. Drop the exact A1 inline constraint
   `master_records_record_type_check`; add the replacement check containing
   all A1 values plus `lab_test` and `lab_panel` as `NOT VALID`, then
   `VALIDATE CONSTRAINT` before creating any lab release rows.
3. Create `master.lab_tests`, `master.lab_panels`,
   `master.lab_panel_items`, and `master.lab_order_profiles` with their typed
   FKs, exact-one/profile and duplicate membership constraints.
4. Install A1-style fixed-search-path triggers before any typed row can be
   written: `master.lab_tests_record_type_guard` and
   `master.lab_panels_record_type_guard` verify the parent
   `master_records.record_type`; `master.lab_tests_identity_guard` and
   `master.lab_panels_identity_guard` reject parent-ID/code changes and delete
   attempts. Relation rows have no authenticated grants; publisher-only full
   set replacement is protected by panel/order FKs and unique constraints.
5. Replace `private.clinical_master_record_content`, the A1 contract helpers,
   and publisher staging/comparison as described above.
6. Publish the B1 payload: normalize relation arrays, stage owner content,
   lock owners in master-key order, advance only changed owners once, insert
   immutable versions/events, then replace typed lab projections and relation
   rows in panel/order-key order, all before release commit.

The forward publisher replacement creates the four private, release-scoped
staging tables `private.clinical_master_lab_vocabulary_publish_stage`,
`private.clinical_master_lab_test_publish_stage`,
`private.clinical_master_lab_panel_publish_stage`, and
`private.clinical_master_lab_order_publish_stage`, each with primary key
`(release_id, owner_record_id)` and no authenticated grants. Its executable data
flow is: validate all included owners; populate vocabulary stage and effective
revisions; populate test stage from vocabulary-stage effective revisions;
populate panel stage from test-stage effective revisions or existing current
revisions; populate order stage from panel/test effective revisions or existing
current revisions; reject
an owner relation payload whose owner is omitted; validate full-set removal and
active cardinality; compare stage canonical content with the current owner
snapshot; then persist changed owner versions/events and replace only included
typed relation sets. The release row records the ordered stage fingerprints so
replay can prove that the same release did not recompute a different dependency
revision. No stage reads current typed definitions after the owner snapshot has
been selected for confirmation.

The B1 migration must then:

7. extend the payload contract with exact relation arrays:

   ```json
   {
     "labPanelItems": [{
       "panelMasterKey": "...",
       "testMasterKey": "...",
       "sortOrder": 1,
       "required": true,
       "displayGroup": "..."
     }],
     "labOrderProfiles": [{
       "orderMasterKey": "...",
       "labTestMasterKey": null,
       "labPanelMasterKey": "...",
       "specimenMasterKey": "..."
     }]
   }
   ```

8. include those arrays in PostgreSQL canonical fingerprint input;
9. validate relation targets, exact-one profile target, duplicate keys/sorts,
   lab classification/path, specimen, dog/cat links, and no price/range keys;
10. populate the four typed master lab tables in the same private release
   transaction; and
11. preserve A1 advisory locking, release idempotency, immutable version rows,
   review events, and all existing rejection behavior.

The A1 migration file is not edited. A1’s existing fixture/test remains a
regression contract; B1 gets a separate fixture/replay and a new contract spec.

### Workspace and result constraints

Add:

- partial unique `(workspace_id, source_master_record_id)` on master-derived
  lab items;
- retained `lab_test_items.category_id` uses the actual
  `lab_test_categories(id,workspace_id,category_name,sort_order)` schema; add
  `unique (workspace_id,id)` to categories and replace the old single-column
  category FK with `foreign key (workspace_id,category_id) references
  public.lab_test_categories(workspace_id,id) on delete restrict`;
- typed `result_value_kind` and nullable non-negative `decimal_scale` checks on
  `lab_test_items`, while preserving the executable legacy
  `result_input_type` check and canonical text storage for the opaque value kind;
- immutable `public.lab_test_item_versions` with composite current/version
  keys, plus a composite link FK for `pinned_workspace_result_revision`;
- source ID/revision pair checks and composite FKs to master versions;
- `link_origin='clair_master'` requires `source_master_test_record_id` to equal
  the selected immutable item version's `source_master_record_id`; its
  `owner_pinned_source_test_revision` is compared with the immutable panel or
  standalone owner version, never with a mutable current master row.
  `link_origin='workspace_custom'` requires both link-level member-test fields
  NULL; its selected item-version source pair is checked only by the immutable
  item-version origin predicate and is never copied into the link;
- unique `(workspace_id,id)` keys for lab items, categories, catalog items,
  orders/result headers where required by A3;
- composite `(workspace_id,order_catalog_item_id,lab_test_item_id)` identity and
  partial unique `(workspace_id,order_catalog_item_id,effective_sort_order)` for
  the full authored link set `WHERE link_origin in
  ('clair_master','workspace_custom')`, with branch-specific typed
  `required`, `display_group`, source ordinal, owner-pinned source revision,
  and pinned workspace revision; a `clair_master` panel requires non-null
  source ordinal/owner pair, a `clair_master` standalone requires source
  ordinal NULL with its owner pair, and `workspace_custom` requires null source
  ordinal/owner pair. The predicate uses link columns only and never joined item
  availability;
- partial unique `(workspace_id,order_catalog_item_id,lab_test_item_id)` for
  `link_origin in ('clair_master','workspace_custom')`; both authored indexes
  are created normally after
  duplicate preflight, never `NOT VALID`;
- composite workspace FKs for new link/result rows;
- item/result attribution FKs use `ON DELETE RESTRICT` so positive canonical,
  legacy, or attributable quarantined usage cannot be deleted; count repair
  never disables that lock;
- result header source lineage pair checks;
- immutable-definition trigger/helper that rejects authored-link changes to
  `result_definition_snapshot`, source lineage, definition row IDs/names/unit,
  sort order, or panel membership after confirmation;
- the same trigger rejects `DELETE` or delete/reinsert replacement of a
  canonical header/row. Through v2 only `received -> entered` on first save or
  `entered -> entered` thereafter is allowed, together with the named
  actor/timestamp/updated-at fields, one entry-write revision increment, and
  nullable value/note changes; every other status, identity, snapshot, lineage,
  or definition mutation is rejected;
- a PostgreSQL-computed lowercase SHA-256 fingerprint over canonical JSONB
  snapshot serialization. Client-provided fingerprint is ignored/rejected.

The link collision object is concrete and does not inspect item status:

```sql
create unique index order_catalog_lab_test_item_links_canonical_sort_unique
  on public.order_catalog_lab_test_item_links
    (workspace_id, order_catalog_item_id, effective_sort_order)
  where link_origin in ('clair_master','workspace_custom');

create unique index order_catalog_lab_test_item_links_canonical_item_unique
  on public.order_catalog_lab_test_item_links
    (workspace_id, order_catalog_item_id, lab_test_item_id)
  where link_origin in ('clair_master','workspace_custom');
```

Availability filtering is performed only by the confirmation active-set rule;
an item-identity or `effective_sort_order` collision rejects catalog
CAS/adoption even when one of the colliding items is paused or inactive. These
partial unique indexes are ordinary indexes created only after duplicate
preflight; they are never declared `NOT VALID`.

Do not add a free-form workspace `definition_snapshot` authoring field. The
typed `lab_test_items` source-content columns (`test_item_name`,
`result_input_type`, `result_value_kind`, `result_unit`, `decimal_scale`),
source lineage,
last-applied source projection snapshot/hash, and `workspace_result_revision`
own the current workspace definition. The existing executable
input-type check remains unchanged. The canonical coded value kind always
stores the existing `text` input type and
uses the existing text input/storage path. No
global options column or option-membership validation is added. The typed catalog
membership projection snapshot/hash on `order_catalog_items` owns the separate
full-set membership comparison.
Pre-B1 `snapshot_metadata` is arbitrary historical JSON. For an exact
same-workspace legacy link it is preserved byte-for-byte as non-authoritative
compatibility evidence; no schema version, key set, lineage, or provenance is
inferred from it, and its B1 typed lineage/pin/profile/hash/schema fields stay
NULL. Cross-workspace or impossible old links are quarantined and read-only.
Only server-authored `clair_master` and `workspace_custom` links use the
schema-version-2 object and truth table above; canonical workspace identity
remains typed IDs/revisions.

All new definition/lineage columns are physically nullable where retained
legacy or quarantined rows may lack them. The canonical origin trigger requires
non-null item ID, immutable item-version pin, source/effective order, required
flag, value kind/input type, and immutable parent fields. Unit, decimal scale,
and display group are intentionally nullable. A `clair_master` panel row
requires non-null link-level test record/revision and item-version source pair;
a standalone `clair_master` row has exactly one member with those same
non-null fields and source ordinal NULL. A `workspace_custom` panel row has
non-null master order/panel owner lineage, NULL link-level test record/revision
and source ordinal, and an item-version source pair that is either both
non-null for master-derived or both NULL for workspace-custom. The header snapshot/hash remains non-null for every
canonical header, while legacy/quarantine rows follow their exact migration
predicates. No default fills a missing legacy/quarantine field or promotes it
to canonical.

### Item-version and link backfill order

The forward migration must establish immutable item versions before it adds any
link pin FK or link/result trigger. Under the same workspace adoption lock, its
ordered backfill is:

1. Classify every existing `lab_test_items` row without inferring master
   provenance. Every structurally valid source-null hospital-created item is
   `definition_origin='workspace_custom'`, regardless of historical result or
   link usage; it receives `workspace_result_revision = 1`,
   `local_settings_revision = 1`, and remains editable through the dedicated
   CAS. A master-derived item is `clair_master` only when both source master
   fields and a valid source projection already exist. `legacy` is not an item
   origin: it is reserved for exact legacy result headers/links. Any unknown or
   unmappable input, invalid category, source-pair conflict, cross-workspace
   attribution, or missing required structural field becomes
   `definition_origin='quarantined'` with a stable reason and is
   read-only/report-only. B1 fixtures fail fast on any such row.
2. For every valid `workspace_custom` and `clair_master` item, insert immutable
   version 1 before any link pin is written. Workspace-custom maps
   `number -> numeric`, `text -> text`, and
   `select|positive_negative|grade -> coded`, preserves the old executable
   `result_input_type`, sets `decimal_scale = NULL` unless a trusted source
   supplies it, and writes the server-derived local snapshot/hash. A
   `clair_master` version has non-null source master ID/revision and source
   projection snapshot/hash, plus the local definition snapshot. A quarantined
   item gets no canonical version or link pin: its original row and reason
   remain in the migration report and all item/result writers deny it. The
   source-content local snapshot, when present, is schema version 1 with keys
   `{testItemName,resultInputType,resultValueKind,resultUnit,decimalScale}` and
   explicit JSON nulls; category, list sort, and active state are never in this
   source snapshot. `INSERT ... ON CONFLICT
   (workspace_id,lab_test_item_id,workspace_result_revision) DO NOTHING` is
   allowed only when the existing row is byte/hash-equal; otherwise the
   migration aborts.
3. Validate current-row/version equality only for the fields required by each
   origin predicate: canonical and workspace-custom rows require typed fields,
   source/customization state, local snapshot/hash, and
   `workspace_result_revision`; exact legacy may preserve nullable typed fields;
   quarantined rows are excluded from version equality and remain report-only.
   `decimal_scale` is NULL or non-negative, source projection is present iff
   `definition_origin='clair_master'`, and no source pair is inferred. No
   current-row latest check is used by historical result validation after
   confirmation.
4. Classify every existing link before adding link FKs. A link to a source-null
   item receives `link_origin='workspace_custom'` only when it is an added
   member of a trusted master panel: A2/A3 catalog/order/panel identity
   establishes its `profileKind`/enclosing lineage and same-workspace item
   attribution proves the pin. It receives an immutable version-1 pin with
  link-level member-test lineage NULL, `source_ordinal NULL`, and a non-null
  effective sort order. A panel link with complete trusted master panel/owner
  lineage receives `link_origin='clair_master'`, raw normalized publisher
  `source_ordinal` (integer >= 0, including gaps and zero), and the matching
  immutable item version. A standalone `clair_master` link receives
  `source_ordinal=NULL` because its profile has no source member order. A master
   standalone profile must backfill exactly one `clair_master` link; no
   workspace-custom standalone or extra member is created. An empty old JSON
   object or source-null item alone never promotes a link. If the trusted
   workspace-custom proof is absent, only the exact same-workspace legacy
   predicate with arbitrary historical metadata and all new B1 typed
   lineage/pin/profile/hash/schema fields NULL receives `link_origin='legacy'`;
   it remains compatibility/read-only and is not an item-origin
   classification. A missing item/version, cross-workspace attribution,
  source-pair conflict, or impossible pin becomes pre-existing
  `link_origin='quarantined'`, read-only/report-only, and is never repaired by
  inference. The classifier writes exactly one deterministic
  `link_quarantine_reason` code—`cross_workspace_link`,
  `missing_item_version`, `source_pair_conflict`, `impossible_profile`, or
  `untrusted_legacy_parent`—and never stores that reason in or rewrites the
  historical JSON. New authored links are not backfilled from names, JSON, or
  service IDs.
5. Before any unique index, preflight canonical duplicate master-derived item
   identities `(workspace_id,source_master_record_id)`, duplicate canonical
   membership identities `(workspace_id,order_catalog_item_id,lab_test_item_id)`,
   and duplicate canonical effective-sort tuples. Existing exception rows are reclassified as
   quarantined/report-only (B1 fixtures abort); then create the canonical
   partial unique indexes normally, never `NOT VALID`. Only after steps 1–4
   install the composite item/version FKs and eligible CHECK constraints;
   `NOT VALID` is used only for those FK/CHECK constraints whose retained
   legacy/quarantine rows fail validation. Install fixed/constraint triggers
   after classification/backfill because PostgreSQL constraint triggers cannot
   be `NOT VALID`. Validate each FK/CHECK only when its entire retained row set
   passes; exception-bearing constraints remain `NOT VALID`, with reported row
   IDs and new writes still enforced.

### A2 adoption and workspace CAS ownership

Extend the actual A2 private writer
`private.clair_adopt_master_release_to_workspace(p_workspace_id text,
p_release_id uuid)` while retaining its exact lock order: A1 global publication
advisory lock, then the entire-workspace adoption lock keyed by
`hashtextextended('clinical_master_workspace_adoption:' || p_workspace_id, 0)`,
then source/workspace rows in deterministic master-key/item-ID order. The
extension calls a private B1 helper with no authenticated execute grant:

```text
private.clair_adopt_lab_master_projection_to_workspace(
  p_workspace_id text,
  p_release_id uuid
) returns jsonb
```

After the global publication lock, the workspace lock is always the exact A2
key `hashtextextended('clinical_master_workspace_adoption:' ||
p_workspace_id, 0)`, acquired before any workspace row lock. Every catalog CAS,
dedicated item CAS, update-resolution CAS, and adoption path follows the same
post-lock order: determine affected catalog IDs; lock catalog rows sorted by
`(workspace_id,id)`; lock item rows sorted by `(workspace_id,id)`; then lock
links and update targets sorted by `(workspace_id,id)`. This shared order is a
deadlock contract, not an implementation suggestion.

That helper consumes only the trusted A1 publisher release and explicit
canonical panel/profile relations. It may create/update `clair_master` lab
items and explicit links, but it must not overwrite a customized item. A
master-derived item remains `definition_origin='clair_master'` when locally
customized: its source master ID/revision and last-applied source projection
snapshot/hash are retained, while `customization_state` becomes
`customized`. A workspace-custom item is source-null and is never implicitly
detached or reclassified; detach is out of scope. The helper must never accept
client master IDs, revisions, snapshots, names, or prices.
For a new master-derived item, the server derives the text item ID exactly as
`lab-item:v1:<lowercase-sha256(workspace_id || ':' ||
source_master_test_record_id)>`. The unique `(workspace_id,
source_master_record_id)` constraint makes replay return the existing row; if
the deterministic ID already belongs to a different workspace/source pair, the
transaction aborts with `deterministic_item_id_collision` and does not probe or
rename another row.

Because `category_id` is mandatory while canonical master data has no workspace
category authority, adoption creates or reuses one row in the actual
`public.lab_test_categories` schema under the adoption lock. Its exact values
are: `id = 'lab-category:v1:' || lower(encode(extensions.digest(
convert_to(workspace_id || ':unclassified', 'UTF8'), 'sha256'), 'hex'))`,
the same `workspace_id`, `category_name = '카테고리 미설정'`, and deterministic
`sort_order = 2147483647`. The migration first adds the tenant unique key
`unique (workspace_id,id)` and then executes
`INSERT ... ON CONFLICT (workspace_id,id) DO NOTHING`; it re-reads the row and
requires all four values to match. An existing same-ID/different-workspace or
same-workspace/different-name/order row aborts as
`deterministic_category_id_collision` rather than being renamed or inferred.
The fallback label is exactly `카테고리 미설정` and is used only when no
hospital category override is already linked.
Adoption never overwrites an override, and subsequent local category changes
remain workspace-owned.
It compares the incoming source-controlled typed fields with
`last_applied_source_projection_snapshot` plus its lowercase SHA-256. A match
is a safe whole-item source update through the dedicated item CAS, creating one
immutable workspace item version; a mismatch preserves the whole item and
creates a durable lab-item review target. Availability, local sort, usage, and
other declared workspace fields are excluded from the source fingerprint and
are never overwritten. An unchanged retry increments neither result nor
catalog revision. A customized master-derived item receives the B1 lab-item
review/update state and is not auto-overwritten. An accepted source update
preserves workspace availability/local order, refreshes source lineage and the
last-applied snapshot/hash from the trusted target, and resolves
`customization_state` to `unmodified`; a rejected update preserves
the customized version and provenance.

The existing A2 catalog CAS RPC remains the order/catalog metadata authority:

```text
public.clair_update_order_catalog_item(
  p_workspace_id text,
  p_item_id text,
  p_expected_catalog_revision integer,
  p_patch jsonb
) returns jsonb
```

The catalog RPC accepts one exact `p_patch` shape and rejects all extra keys:
`{"labDefinition":{"availabilityStatus":"active|paused|inactive",
"links":[{"labTestItemId":<text>,
"expectedLinkRevision":<positive integer|null>,
"expectedWorkspaceResultRevision":<positive integer|null>,
"effectiveSortOrder":<non-negative integer>,"required":<boolean>,
"displayGroup":<text|null>}]}}`. `p_expected_catalog_revision` is the
separate expected catalog CAS input. `links` is the complete authored
(`clair_master` or `workspace_custom`) set;
omitted old links are intentional removals. `expectedLinkRevision = null`
asserts that the server-derived link is absent and is required for a new link;
a positive value asserts that the retained link has exactly that revision.
`expectedWorkspaceResultRevision` is NULL exactly when the link is new and
positive exactly when it is retained. Duplicate `labTestItemId` values are
rejected before any lock-time DML. `availabilityStatus` is catalog-level and is
distinct from each item's live `is_active`: an active resulting catalog must
contain at least one active explicit authored item; an empty authored set is
allowed only when this same atomic CAS sets the catalog status to `paused` or
`inactive`. The success result returns the new catalog revision, resulting
availability, and every authored link ID/revision. Item availability/is_active
is not a link-patch field, but the catalog-level availabilityStatus above is
required and is not forbidden. The patch cannot contain link IDs, source
IDs/revisions, owner pins, item definitions, snapshots, hashes, prices, or item
availability. The server validates
each expected item/link revision and derives each link ID exactly as
`lab-link:v1:<lowercase-sha256(workspace_id || ':' || order_catalog_item_id ||
':' || lab_test_item_id)>`; a replay returns that same row, while a hash
collision aborts as `deterministic_link_id_collision`.
The server derives `linkOrigin`, `profileKind`, all owner/test lineage, and
`sourceOrdinal`; the client cannot submit those fields. A workspace-custom
entry is accepted only as an added member of the trusted master panel profile,
with `sourceOrdinal=NULL`; a `clair_master` panel entry retains the raw
publisher `sourceOrdinal`, while a `clair_master` standalone entry has
`sourceOrdinal=NULL`. A master standalone profile must remain exactly one
`clair_master` link, so the CAS rejects a workspace-custom standalone member
or any second link. Every authored link has non-null `effectiveSortOrder`.

The dedicated item RPC uses action-specific exact patches. `local_settings`
accepts exactly `{"categoryId":<text>,"localSortOrder":<non-negative
integer>,"isActive":<boolean>}` and changes only the current item's
workspace-owned settings plus `local_settings_revision`; it does not create a
version, move a link pin, or change source fingerprint/customization. An
`isActive` change additionally increments each affected catalog revision once;
category/list-sort changes do not. `customize` accepts exactly
`{"displayName":<non-empty string max 256>,"inputType":"number|text|select|positive_negative|grade",
"resultValueKind":"numeric|text|coded","unit":<text|null>,
"decimalScale":<non-negative integer|null>}`. The server enforces
`numeric -> number`, `text -> text`, and `coded -> text`; legacy input values
are accepted only for a workspace-custom compatibility item and never become
canonical coded input. All actions reject extra keys, wrong types, overlong
strings, and client lineage. Source-content `customize` creates one version,
retains
master lineage/last-applied source state while marking a derived item
`customized`, or advances a source-null `workspace_custom` local definition.
Category, local sort, availability, input/unit/value-kind, and scale changes
never alter historical result snapshots; only source-content customize and a
trusted source-resolution decision increment `workspace_result_revision`.
Detach is unsupported. The expected source revision and
`p_expected_local_settings_revision` are separate CAS arguments, and
`p_target_link_ids` is a duplicate-free array of server-derived link IDs whose
pins are intentionally targeted only by source-content actions.

B1 extends its fixed-search-path, `service_catalog:manage`, auth-derived actor
contract with a server-validated `labDefinition` patch only when the existing
`order_catalog_items.category_group = 'lab'`. A lab patch contains only
catalog-owned membership/local link fields;
any lab item definition mutation is rejected as
`lab_item_mutation_requires_dedicated_cas` and must use the dedicated item CAS
below. It cannot contain source master IDs/revisions,
`snapshot_metadata`, fingerprint, or catalog revision. The same exact A2
advisory lock is `hashtextextended('clinical_master_workspace_adoption:' ||
p_workspace_id, 0)` and is acquired before every row lock; there is no second
workspace-CAS key. Under that lock the transaction first determines all
affected catalog IDs, locks catalog rows sorted by `(workspace_id,id)`, then
locks affected `lab_test_items` sorted by `(workspace_id,id)`, then existing
authored `clair_master`/`workspace_custom` link/update rows sorted by
`(workspace_id,id)`. (Legacy `sort_order`
is not a lock-order authority.)
It validates all rows belong to the workspace, checks
`p_expected_catalog_revision` and each expected link/pin revision,
replaces the full explicit link set (omitted old link = intentional removal;
category-only links cannot be submitted for authored master panels), and
increments `order_catalog_items.catalog_revision` exactly once per successful
logical patch. New links start at `link_revision = 1`; each changed retained
link increments `link_revision` once, while unchanged links retain their
revision. A catalog patch cannot increment `workspace_result_revision`.
A no-op/retry increments neither. Partial or stale expected revisions
return deterministic `catalog_revision_conflict` or
`lab_item_revision_conflict` and write nothing.

Changing only panel membership or link order increments the catalog row's
`catalog_revision` once and does not increment an unchanged item's
`workspace_result_revision`; changing an item definition through the dedicated
item CAS increments that item revision once. The next confirmation freezes both
values in the result header.

The action-specific patches above are the only workspace authoring surface:
local settings own category/local sort/active state, while source-content
customize owns display name, executable input mapping, unit, and scale. Every
item version preserves server-derived snapshots; a master-derived customize
changes typed workspace fields and `customization_state`, never its master
provenance. The workspace-custom origin is source-null. It never promotes a
workspace-custom row to master origin, and it never implicitly detaches a
master-derived row.
The existing A2 review CAS remains exact:

```text
public.clair_resolve_workspace_master_update(
  p_workspace_id text,
  p_update_id uuid,
  p_expected_catalog_revision integer,
  p_action text
) returns jsonb
```

It continues to apply only the trusted saved source projection and increments
the catalog revision once; it cannot accept a client replacement row or
snapshot.

Because one workspace item can serve multiple catalog orders, B1 adds an
immutable workspace item-version owner rather than rereading the mutable
current item row:

```text
public.lab_test_item_versions
  workspace_id text not null
  lab_test_item_id text not null
  workspace_result_revision integer not null check (workspace_result_revision > 0)
  test_item_name text not null
  result_input_type text null check (result_input_type is null or
    result_input_type in ('number','text','select','positive_negative','grade'))
  result_value_kind text null check (result_value_kind is null or
    result_value_kind in ('numeric','text','coded'))
  result_unit text null
  decimal_scale integer null
  definition_origin text not null check (definition_origin in
    ('clair_master','workspace_custom','quarantined'))
  quarantine_reason text null
  customization_state text not null check (customization_state in ('unmodified','customized'))
  source_master_record_id uuid null
  source_master_revision integer null
  source_projection_schema_version integer not null default 1
  source_projection_snapshot jsonb null
  source_projection_sha256 text null
  local_definition_snapshot jsonb null
  local_definition_sha256 text null
  created_by uuid null
  created_at timestamptz not null
  primary key (workspace_id, lab_test_item_id, workspace_result_revision)
```

Each authored `clair_master` or `workspace_custom` link has a composite FK to
this version owner through
`pinned_workspace_result_revision`; a link therefore may continue using item
revision N after the shared current item advances to N+1. The current
`lab_test_items` row is only the latest projection and must equal its latest
immutable version. Version rows and their typed identity/source pairs are
append-only; no update/delete or delete/reinsert replacement is allowed.

Version checks are explicit: `definition_origin='clair_master'` requires both
source master fields and a non-null source projection snapshot/hash;
`definition_origin='workspace_custom'` requires a valid typed local definition
with both source fields/projection fields NULL; `definition_origin='quarantined'`
requires `quarantine_reason is not null` and
`pg_catalog.btrim(quarantine_reason) <> ''`, null source fields/projection,
and is
read-only/report-only. A version owns only source/definition content:
`test_item_name`, executable `result_input_type`, separate
`result_value_kind`, unit, nullable non-negative `decimal_scale`, source
lineage/projection, `customization_state`, and the server-derived definition
snapshot/fingerprint. Category, admin list sort, and `is_active` do not appear
in the version row or definition JSON; they remain current-row settings guarded
by `local_settings_revision`. Writable versions require a non-empty
server-derived `local_definition_snapshot` and lowercase 64-hex
`local_definition_sha256`; quarantined items have no canonical version/pin and
keep raw migration evidence in the quarantine report. `decimal_scale` is NULL
or a non-negative integer. The current row must equal its latest version only
for source-content fields in the origin predicate; a link may pin an older
immutable version without requiring the mutable current row or local settings
to match.

The only workspace lab-item mutation surface is:

```text
public.clair_update_workspace_lab_test_item(
  p_workspace_id text,
  p_item_id text,
  p_actor_user_id uuid,
  p_expected_workspace_result_revision integer,
  p_expected_local_settings_revision integer,
  p_action text, -- 'local_settings' | 'customize'
  p_patch jsonb,
  p_target_link_ids text[]
) returns jsonb
```

The public RPC and the trusted A2 adoption/review wrappers delegate to two
fixed-search-path private primitives with disjoint authority:
`private.clair_apply_workspace_lab_test_item_local_settings` updates only the
current item row and `local_settings_revision`, while
`private.clair_apply_workspace_lab_test_item_version` is the immutable
source-content primitive for `customize` and a trusted source-resolution
decision. Only the latter inserts an N+1 version, repins explicitly targeted
links, and increments affected catalog revisions. The public wrapper is the
only authenticated customizer; trusted adoption may call the version primitive
only from the locked private release transaction. There is no alternate
catalog-row or direct-DML item writer.

The public wrapper requires `p_actor_user_id = auth.uid()`, active membership,
`service_catalog:manage`, and an action-appropriate expected revision:
`local_settings` requires non-null `p_expected_local_settings_revision` and
`p_expected_workspace_result_revision` NULL; `customize` requires non-null
`p_expected_workspace_result_revision` and `p_expected_local_settings_revision`
NULL. `local_settings` also requires `p_target_link_ids` NULL or an empty
array; `customize` may supply only duplicate-free server link IDs. Every catalog
CAS, item CAS, update-resolution CAS, and adoption uses the exact A2 advisory
lock above before any row lock. The common post-lock order is: determine all
affected catalog IDs; lock catalog rows sorted by ID; lock item rows sorted by
ID; then lock link/update rows sorted by ID. The version primitive follows that
order even when one item is shared by many catalogs, and creates exactly one
immutable N+1 item version for `customize` or trusted source resolution. Its
`p_target_link_ids` must be explicit and duplicate-free; an empty list creates
the source version without changing any link pin. It updates only those
targeted link pins, increments only catalogs containing a targeted link whose
pin actually changes, at most once each, and returns every affected
catalog/link ID and old/new revision. It still locks every same-workspace
catalog and link referencing the shared item in sorted ID order, including
non-target references, so stale pins cannot be silently reread or overwritten.
The local-settings primitive never creates an item version, changes a pin or
source fingerprint, or applies empty-target behavior: it checks only
`p_expected_local_settings_revision`, updates category/admin sort/is_active,
and increments affected catalog revisions only for an `is_active` change.

The origin/action matrix is fixed: `clair_master` permits live-settings CAS
without a version, source-content `customize` with provenance retained and
`customization_state='customized'`, and resolver accept/reject only from a
stored durable source target; `workspace_custom` permits live-settings CAS and
source-content `customize` as a local version advance but has no master lineage
to accept; `quarantined` permits report/read only and rejects both actions.
There is no `legacy` item origin. Legacy result headers/links remain the
separate v1 compatibility surface and cannot be edited by either canonical item
action.

`customize` accepts only workspace-owned typed fields. For a master-derived
item it retains `definition_origin='clair_master'`, both source master fields,
and the last-applied source snapshot/hash, while setting
`customization_state='customized'`; it never detaches the item. A
`workspace_custom` item remains source-null. The public resolver accepts only
the stored latest eligible review snapshot for a master-derived item, refreshes
trusted master lineage and last-applied source state, and sets
`customization_state='unmodified'` while preserving availability/local order.
Client source IDs, source revisions,
source hashes, and snapshots are rejected. Without a request/ledger key this
RPC makes no replay-success promise: an exact network retry after a committed
mutation returns deterministic `lab_item_revision_conflict` plus current
state, and the client must reload; a stale retry never partially writes.

Master adoption may advance a link from test revision N to N+1 only when the
immutable panel/standalone owner version pinned by that link expects N+1. Links
whose owner still pins N remain pinned to their old workspace item version.
The adoption helper locks and evaluates those pinned owner versions explicitly;
it never rereads the current master test row to decide whether an old link is
eligible. For a `clair_master` link, the unambiguous fields are
`source_master_test_record_id`, `owner_pinned_source_test_revision`, and
`pinned_workspace_result_revision`; the selected immutable item version owns
its own source pair, whose record ID matches the link-level test record. For a
`workspace_custom` link, the first two link-level member-test fields are NULL;
only its pinned item version's own optional source pair is evaluated. The frozen
result snapshot stores owner-pinned and item-version source identity/revision
separately. For an unmodified master projection the two revisions must equal;
divergence is allowed only after explicit reviewed/local customization, and
both meanings are frozen and retained. `clair_master` panel links require
non-null panel and member-test lineage; `workspace_custom` panel links retain
non-null panel lineage but have null member-test lineage. The only standalone
branch is one `clair_master` link with a null panel pair and exactly one test
pair; workspace-custom local item versions never create a profile or claim
standalone master lineage.

B1 adds two explicit durable targets because the existing A2 review target is
order-only and cannot represent a shared lab item or a full lab membership
projection:

```text
public.workspace_lab_item_updates
  id uuid primary key
  workspace_id text not null
  lab_test_item_id text not null
  source_release_id uuid not null
  source_release_no bigint not null
  source_owner_record_id uuid not null
  source_owner_revision integer not null
  target_key text not null
  replay_key text not null
  source_master_record_id uuid not null
  source_master_revision integer not null
  update_type text not null check (update_type in
    ('source_changed','source_added','source_removed'))
  status text not null check (status in
    ('pending','accepted','dismissed','superseded','quarantined'))
  superseded_by_update_id uuid null
  expected_workspace_result_revision integer not null
  changed_source_fields text[] not null
  source_projection_snapshot jsonb not null
  source_projection_sha256 text not null
  workspace_projection_snapshot jsonb not null
  affected_catalog_item_ids text[] not null default '{}'
  created_by uuid null
  resolved_by uuid null
  created_at timestamptz not null
  resolved_at timestamptz null

public.workspace_lab_catalog_updates
  id uuid primary key
  workspace_id text not null
  order_catalog_item_id text not null
  source_release_id uuid not null
  source_release_no bigint not null
  source_owner_record_id uuid not null
  source_owner_revision integer not null
  target_key text not null
  replay_key text not null
  source_master_order_record_id uuid not null
  source_master_order_revision integer not null
  update_type text not null check (update_type in
    ('membership_changed','profile_changed'))
  status text not null check (status in
    ('pending','accepted','dismissed','superseded','quarantined'))
  superseded_by_update_id uuid null
  expected_catalog_revision integer not null
  source_membership_projection_snapshot jsonb not null
  source_membership_projection_sha256 text not null
  workspace_membership_projection_snapshot jsonb not null
  affected_lab_test_item_ids text[] not null default '{}'
  created_by uuid null
  resolved_by uuid null
  created_at timestamptz not null
  resolved_at timestamptz null
```

Both targets have `(workspace_id,id)` keys, `source_release_id` FKs to
`master.master_releases`, source owner/revision FKs to immutable
`master.master_record_versions`, same-workspace FKs, immutable source lineage,
server-computed lowercase hashes, and these exact replay
constraints: `unique (workspace_id,replay_key)` with
`target_key = '<target-kind>:<workspace-id>:<target-id>:<update-type>'` and
`replay_key = '<target-key>:<source-release-no>:<source-owner-revision>:<source-release-id>'`,
plus a partial unique index on `(workspace_id,target_key)` where
`status = 'pending'`. Creation is `INSERT ... ON CONFLICT
(workspace_id,replay_key) DO UPDATE SET replay_key = excluded.replay_key
RETURNING id`, so a retry returns the original stable update ID. The trusted
adoption writer locks pending targets for the same target, and when the
lexicographic source order `(source_release_no,source_owner_revision,
source_release_id)` is newer, marks the old pending
target `superseded` with `superseded_by_update_id` before inserting the new
target. A lower/equal source release cannot supersede a newer target; ties use
the immutable `source_release_id` lexical order. No client insert/update grant
exists. The adoption helper creates them with exact update IDs and emits the existing A2 notification contract:
`event_key = 'clinical_master_update_available'`, `domain = 'hospital_admin'`,
`source_entity_id = update.id::text`, and dedupe key
`clinical-master-lab-update:<update.id>`. A match auto-applies the complete
trusted source projection. A mismatch preserves the whole item or full
membership set and reports the durable update ID; no inferred provenance or
partial field merge is allowed.

Only the latest non-superseded target for the same target ID, source owner,
source release ordering, and current workspace item/catalog revision is
eligible for CAS. Resolver `accept` rejects `lab_update_target_obsolete` when the
target is superseded, when a newer source release is pending/published, or when
the stored source revision is not the current latest source. The rejection is
write-free. Duplicate adoption emits no duplicate notification because the
dedupe key uses the stable persisted update ID.

There is one public source-review surface for both durable target kinds:

```text
public.clair_resolve_workspace_lab_definition_update(
  p_workspace_id text,
  p_update_id uuid,
  p_actor_user_id uuid,
  p_expected_revision integer,
  p_decision text -- 'accept' | 'reject'
) returns jsonb
```

`public.clair_update_workspace_lab_test_item` accepts only
`local_settings|customize`; it has no accept/reject action. The resolver is the
only authenticated accept/reject surface and dispatches the stored target kind
(`workspace_lab_item_updates` or `workspace_lab_catalog_updates`) to one
private append-only primitive,
`private.clair_resolve_workspace_lab_definition_update_target`. No second
public item/catalog resolver or direct-DML bypass exists. `p_decision='reject'`
records the decision without projection mutation; `accept` consumes only the
stored trusted source snapshot and exact empty patch, never client source
values.

The resolver requires `p_actor_user_id = auth.uid()`, active membership, and
`service_catalog:manage`, then takes the exact A2 workspace advisory lock before
any row lock. It determines all affected catalog IDs, locks catalog rows sorted
by ID, item rows sorted by ID, then target and link/update rows sorted by ID.
It accepts only the latest non-superseded target matching
`p_expected_revision`, the current source release/revision, and the current
workspace item or catalog revision; an obsolete target returns
`lab_update_target_obsolete` with no mutation. For an item target, accept calls
the private item version primitive once, creates one immutable source-content
version, increments the shared item's `workspace_result_revision` once, and
increments only catalogs whose eligible targeted link pin actually changes,
while preserving each catalog's live settings. For a membership target, accept
replaces the complete trusted authored set and increments `catalog_revision`
once. Both return all affected IDs/revisions and the stable update/notification
IDs. A stale expected revision returns a deterministic conflict; no replay
success is promised without a request ledger.

When one source release produces both a shared-item target and an independent
membership/profile target for the same catalog, the existing target rows are
resolved as one overlapping CAS sequence: an item-first accept permits the
catalog target's intervening item revision, while a catalog-first accept keeps
the item target eligible from its stored member projection. Both orders rebuild
the stored item-version member pins and metadata hash from the committed link
rows, consume both targets, and converge to the same catalog/item/link state;
the replay also retries confirmation after the final state. A pure item
revision cascade remains item-owned and does not manufacture a second
membership/profile authority.

When one source item is referenced by multiple catalog orders, adoption and the
resolver always lock and report all references, but only links targeted
by the accepted owner revision and whose pinned owner version is eligible are
changed; other links remain on their old immutable item version and their
catalog revision is not incremented. When the catalog's full membership/profile
set is unmodified, adoption safely updates it from the stored source
projection. When customized, it creates an
`order_catalog_item`-scoped review target (`workspace_lab_catalog_updates`) with
the expected `catalog_revision`; it never silently overwrites local links.

Canonical result-input mapping is exact and server-owned:

| Master `value_kind` | Workspace `result_input_type` | Additional rule |
| --- | --- | --- |
| `numeric` | `number` | `supports_unit=false` requires a null unit; `supports_unit=true` permits a null unit or a pinned unit, and any non-null unit is projected from `master.units`. Unit metadata is not a scale fallback. |
| `text` | `text` | Unit must be null. |
| `coded` | `text` | Set separate `result_value_kind='coded'`; use the existing text input/storage path and accept an opaque scalar string. No select UI or option-membership validation. |
| anything else | reject | Never fall back to `text`. |

Existing `positive_negative` and `grade` values remain
`workspace_custom`/legacy only unless a future canonical input type explicitly
maps them; B1 creates no such implicit mapping. Species and specimen in this
projection are publisher/profile structural validations only. B1 does not
compare a patient species or runtime specimen because the approved repository
has no authoritative patient/specimen source at this boundary.

Where existing legacy rows prevent validating a composite FK, add it `NOT VALID`
so it enforces all new writes, preserve the legacy rows/report, and do not claim
full historical validation. Any B1 synthetic row violating the FK is fatal.

### RLS, grants, and fixed-search-path functions

- Keep `master` private with no authenticated/anon/service-role table or
  publisher execute grant.
- Catalog-definition reads (`lab_test_categories`, `lab_test_items`, and
  explicit links without a patient/order scope) remain a separate
  workspace/catalog surface. The hospital-admin catalog route uses active
  membership plus `service_catalog:view` for reads and `service_catalog:manage`
  for the CAS/adoption writers; it never reads patient result values.
- The exact current membership-only policies from
  `supabase/migrations/20260528093000_order_catalog_staging_mutation_rls.sql`
  are `lab_test_categories_workspace_member_select`,
  `lab_test_items_workspace_member_select`, and
  `order_catalog_lab_links_workspace_member_select`. The B1 forward migration
  explicitly drops those three policies, then creates
  `lab_test_categories_workspace_catalog_view`,
  `lab_test_items_workspace_catalog_view`, and
  `order_catalog_lab_links_workspace_catalog_view`, each `FOR SELECT TO
  authenticated USING (private.clair_is_active_workspace_member(workspace_id)
  and private.clair_current_user_has_workspace_permission(workspace_id,
  'service_catalog:view'))`. It grants SELECT only to authenticated users,
  revokes direct INSERT/UPDATE/DELETE, and applies the same exact view policy
  to `public.lab_test_item_versions`. A same-workspace member without
  `service_catalog:view` receives no Data API rows; a permitted member sees
  only that workspace's definitions.
- Patient-linked result headers/rows have authenticated direct
  `SELECT/INSERT/UPDATE/DELETE` revoked. No membership-only Data API policy
  may bypass `lab:view`. A fixed-search-path RPC is the only result-read/write
  surface.
- Result RLS is enabled with no authenticated direct-read policy for canonical
  rows. The owner/trusted RPC checks active membership, `lab:view` or
  `lab:complete`, workspace/order/encounter/work-item scope, and actor/session
  equality where applicable before returning or writing data. Quarantined rows
  may be returned only as reportable diagnostics through the fixed getter and
  are write-denied by both result writers.
- The migration must explicitly
  `revoke all on public.lab_result_entries, public.lab_result_entry_rows from
  anon, authenticated`, drop the existing member `SELECT`/write policies for
  those patient-linked tables, revoke authenticated execute on the old getter
  overload, and grant `authenticated` execute only on the actor-bound getter
  and save RPCs. The catalog item/link/category tables retain the explicit
  `service_catalog:view` read policy above and never expose result values. Apply
  the same explicit RLS/grant boundary to
  `workspace_lab_item_updates` and `workspace_lab_catalog_updates`: active
  `service_catalog:view` members may read their workspace's review status;
  only the two fixed-search-path CAS RPCs execute with `service_catalog:manage`;
  direct authenticated insert/update/delete is revoked. The result-sheet
  catalog route must perform the `lab:view` check before it reads any
  patient-linked catalog/profile/result definition; its catalog-admin mode is
  separately membership/`service_catalog:view` scoped.
- `public.lab_test_item_versions` is an immutable historical projection: enable
  RLS and grant `SELECT` only to authenticated users who are active members of
  the same workspace and hold `service_catalog:view`; revoke authenticated and
  anon `INSERT`, `UPDATE`, and `DELETE`. The migration executes
  `revoke all on public.lab_test_item_versions from anon, authenticated`,
  `grant select on public.lab_test_item_versions to authenticated`, and adds
  policy `lab_test_item_versions_workspace_catalog_view` whose `USING` clause
  checks `private.clair_is_active_workspace_member(workspace_id)` and
  `private.clair_current_user_has_workspace_permission(workspace_id,
  'service_catalog:view')`; no write policy exists. Revoke `EXECUTE` on
  `public.clair_update_workspace_lab_test_item` from `public` and `anon`,
  grant it to `authenticated` only, and make it check active membership,
  workspace scope, `service_catalog:manage`, `p_actor_user_id = auth.uid()`,
  and the expected item revision before it calls the private append-only
  primitive. Private adoption calls remain ungranted to browser roles. Direct
  version-table DML, wrong-actor calls, and non-member reads must fail.
- Public RPCs use `SET search_path = public, private, pg_temp`; private helpers
  use `SET search_path = ''` where practical.
- RPCs that declare `p_actor_user_id` compare it with `auth.uid()` and check the
  actual helper `private.clair_current_user_has_workspace_permission`.
  `public.clair_update_order_catalog_item` and the existing A2
  `public.clair_resolve_workspace_master_update` preserve their approved
  signatures and derive the actor directly from `auth.uid()`; they do not gain
  a caller-supplied actor parameter. Private publisher/adoption primitives use
  the trusted server actor context and are not browser-callable.

Required permission mapping:

| Operation | Existing repository contract |
| --- | --- |
| Canonical master publish | private server/operator boundary; no browser permission |
| Workspace catalog/result-definition management | `service_catalog:manage` |
| Catalog definition read without patient/order scope | active membership + `service_catalog:view` on the catalog route |
| Patient result/header/row read and result-sheet definitions linked to an order | `lab:view` plus active membership, order/encounter scope |
| Result entry/save | `lab:complete` plus active membership |
| Review/finalization/amendment | no new B1 behavior or RPC; existing status behavior remains outside this work item |

The B1 DB functions must not claim review/amendment permission that the current
infrastructure does not implement. A later workflow item may define that
boundary explicitly. The result-sheet-catalog route must resolve the request
identity, call the existing workspace permission gateway for `lab:view` before
reading any patient-linked definition, and return `403 permission_missing` for
an ordinary member without that permission. Catalog-only admin reads use the
separate `service_catalog:view` contract and must not expose patient result
values.

### Result RPC contract

The B1 migration forward-replaces the outer A3
`public.clair_save_chart_order_action` confirmation RPC only to add the B1
freeze call. Its transaction lock order is exact and must be shared by A2
adoption and the fulfillment attachment path:

1. acquire
   `pg_advisory_xact_lock(hashtextextended('clinical_master_workspace_adoption:' ||
   p_workspace_id, 0))` before any A3 row lock;
2. reuse the A3 confirmation order: lock the same-workspace encounter, then
   selected `orders` rows in deterministic order, then their same-workspace
   `order_catalog_items` rows in deterministic catalog-ID order, then the A3
   server snapshot/billing parent rows required by that function;
3. while those locks remain held, invoke the private B1 freeze hook below;
4. commit order, result header/rows, and A3 downstream state atomically.

The outer RPC must not acquire the adoption advisory lock after an encounter,
order, or catalog row lock. The private hook asserts the same transaction lock
is already held (using the same key/lock-order helper) and never acquires it
after row locks. This outer replacement preserves A3's sole order authority,
snapshot, price, fulfillment, billing, and retry behavior.

The B1 migration adds the private confirmation hook below and replaces the
existing result RPCs. The hook is called by the outer A3 confirmation branch
after its locked server catalog/order snapshot is written and before the
transaction commits:

```text
private.clair_create_lab_result_entry_for_confirmed_order(
  p_workspace_id text,
  p_actor_user_id uuid,
  p_order_id uuid,
  p_encounter_id uuid
) returns jsonb
```

The hook asserts/reuses the already-held workspace adoption advisory lock; it
does not acquire that lock after row locks. It then reuses the outer A3 lock
order and locks current workspace item/link rows in deterministic ID order for
the pre-freeze projection check only. It
reads only immutable
`master_record_versions` owner snapshots pinned by the A3 catalog/order
lineage; it takes no current master typed-row lock and never interprets an old
revision from current tables. It validates the pinned workspace projection and
`catalog_revision`, joins each link's pinned revision to its immutable item
version, and reads the mutable item row only for stable identity/current
availability. A missing or mismatched immutable pin returns
`catalog_projection_stale` and requires adoption or review rather than silently
refreshing.
It also locks the immutable parent order/encounter and requires
`orders.workspace_catalog_item_id =
lab_result_entries.source_workspace_catalog_item_id` before creating a
canonical header; workspace, encounter, and order IDs must match exactly.
The implementation must not acquire a catalog-to-master lock or reverse the A2
adoption order; immutable master versions are read by pinned ID/revision only.

After separately validating catalog status and linked item status (required
inactive rejects, optional inactive is omitted, standalone inactive rejects,
and at least one active explicit panel item remains), it derives
`result_id = 'lab-order:' || p_order_id::text`; inserts exactly one
`lab_result_entries` header with `result_definition_origin='canonical'`,
`result_status='received'`, complete source lineage, schema-version-1 snapshot,
and hash; then inserts N rows with stable lowercase 64-hex IDs derived from
exactly `(order_id, stable_link_id, frozen_ordinal)` using the formula above, the exact captured
`workspaceResultRevision`, null result values, null notes, and
`judgment='not_judged'`. Each row ID is the lowercase SHA-256 of exactly
`(order_id, stable_link_id, frozen_ordinal)` using the formula above; source
ordinal never participates. It commits only as part of the A3 confirmation
transaction. A confirmation retry locks the partial-unique canonical header,
verifies same-workspace/order/encounter/lineage equality, and returns it without
rebuilding or refreshing definitions. A different/stale client result ID is
converged to that server identity or rejected deterministically; it cannot
re-parent a header. The same transaction invokes
`private.clair_recompute_lab_test_item_saved_result_usage_batch` once with all
N distinct linked item IDs after rows are inserted; an existing-header retry
passes no IDs and does not double count. Any mismatch rolls back confirmation.

The B1 migration forward-replaces the A3 confirmation function only to add this
private hook call after the A3 order snapshot/lineage write; it does not move
order authority to the lab module, change A3 price/billing semantics, create a
second order writer, or allow the client to call the hook directly.

Replace the existing save implementation with this canonical v2 RPC in the B1
forward migration; it is the only new-flow writer and does not add an amendment
API:

```text
public.clair_save_lab_result_entry_v2(
  p_workspace_id text,
  p_actor_user_id uuid,
  p_result_id text,
  p_encounter_id uuid,
  p_order_id uuid,
  p_work_item_id uuid,
  p_expected_entry_write_revision integer, -- required, >= 0
  p_request_id uuid, -- required non-null UUID; NULL raises invalid_request_id
  p_rows jsonb -- non-empty array of exact {rowId,value,note} objects
) returns jsonb
```

The forward migration adds this minimal durable request ledger before replacing
the save body:

```text
public.lab_result_entry_write_requests
  workspace_id text not null
  lab_result_entry_id uuid not null
  request_id uuid not null
  normalized_payload_sha256 text not null check (normalized_payload_sha256 ~ '^[0-9a-f]{64}$')
  base_entry_write_revision integer not null check (base_entry_write_revision >= 0)
  resulting_entry_write_revision integer not null check (resulting_entry_write_revision >= 0)
  outcome jsonb not null check (jsonb_typeof(outcome) = 'object')
  actor_user_id uuid not null
  created_at timestamptz not null
  primary key (workspace_id, lab_result_entry_id, request_id)
```

It has composite same-workspace FKs to the immutable result header and actor
identity, no authenticated or anon table grants, and no direct RLS write
policy. The forward migration executes
`revoke all on public.lab_result_entry_write_requests from anon, authenticated`
and does not grant table privileges; only the fixed-search-path v2 save RPC may
insert/read it inside the locked result-header transaction.

Before locking the header for mutation, the RPC normalizes the validated rows
by ascending `rowId` and builds exactly
`jsonb_build_object('baseEntryWriteRevision', p_expected_entry_write_revision,
'rows', <ordered jsonb array>)`. It computes
`lower(encode(extensions.digest(convert_to(normalized_payload::text, 'UTF8'),
'sha256'), 'hex'))` from PostgreSQL's canonical `jsonb::text`. `p_request_id`
is non-null UUID and is the durable ledger key, not a last-request column.

The route uses v2 for canonical rows. `p_result_id` is an echo only: NULL or
the server-derived `lab-order:<order_uuid>` converges to the canonical header;
a different value returns `lab_result_identity_mismatch`. It never creates a
second header or reparents an existing one. The header adds only
`entry_write_revision integer not null default 0`. Request identity, normalized
hash, base revision, resulting revision, actor, timestamp, and outcome live in
the durable ledger; no last-request-only header columns are added.

On every call it must:

1. verify the stored origin against the exact writer predicate. The v2 writer
   accepts only canonical rows and the v1 writer accepts only the exact
   non-quarantined legacy predicate; an invalid new write raises and rolls back
   rather than persisting a quarantine row;
2. verify `p_actor_user_id = auth.uid()`;
3. verify active membership and `lab:complete` using
   `private.clair_current_user_has_workspace_permission(p_workspace_id,
   'lab:complete')`;
4. keep the common write/serialization order: workspace adoption advisory lock
   first; same-workspace encounter rows; same-workspace order rows; the result
   header; the attached work item; the request-ledger key; then result rows in
   sorted row-ID order. The header is never locked before its order. v1 save,
   v2 save, the private serializer invoked by writes, and fulfillment
   attachment use this exact order. The canonical save/get path never reads
   current catalog/master/profile/link rows and never refreshes definitions;
   the stored header/rows and snapshot equality helper are sufficient. Every
   post-freeze row ID is validated only as the lowercase SHA-256 of exactly
   `(order_id, stable_link_id, frozen_ordinal)` and against the stored header
   snapshot; current links are never consulted.
5. reject if the confirmation hook did not create the canonical header with
   `lab_result_not_frozen`; do not create one from mutable current rows;
6. accept only a non-empty JSON array whose objects have exactly the three keys
   `{rowId,value,note}`. Every key is required: `rowId` is a lowercase 64-hex
   server row ID, `value` is `string|null` with maximum length 4096, and
   `note` is `string|null` with maximum length 4096. Empty string is distinct
   from JSON `null` (null clears the field); reject extra keys, non-strings,
   invalid row IDs, duplicate row IDs, and an empty payload. The submitted IDs
   must be a unique subset of the frozen N IDs; omitted rows retain their prior
   value/note (initially NULL). Reject client analyte/name, unit, range,
   panel/profile, price, lineage, snapshot, or judgment fields;
7. require non-null `p_request_id` and non-null integer
   `p_expected_entry_write_revision >= 0`. Under the already-held header lock,
   first SELECT an existing ledger row keyed by
   `(workspace_id,lab_result_entry_id,p_request_id)`. An existing row succeeds
   only when `actor_user_id`, normalized payload hash, and base revision all
   match; any actor/content/base mismatch returns
   `entry_request_id_conflict`, including after intervening writes. If absent,
   validate the expected revision, mutate only submitted value/note columns,
   set every canonical row's `judgment='not_judged'`, increment the header
   revision once, and INSERT a complete non-null ledger outcome/actor/time in
   the same transaction. A new request ID with a stale expected revision
   returns `entry_write_revision_conflict`. Exact retries never duplicate rows
   or headers, and mismatched payloads never silently return success;
8. allow only the header transition `received -> entered` on the first valid
   save or `entered -> entered` thereafter. The first transition sets the
   current-schema actor/timestamp fields `entered_by_user_id = p_actor_user_id`,
   `entered_at = now()`, and `updated_at = now()`; later saves update only
   `updated_at`. Both transitions increment `entry_write_revision` exactly
   once with the row/ledger mutation. Reject every other status transition and
   every identity, workspace, encounter, order, snapshot, hash, lineage, or
   definition-field mutation; the sole later parent change is the one
   NULL-to-valid same-order work-item attachment. Do not emit
   `clinical_result_completed` or any review/finalization/amendment event;
9. if a canonical header is `reviewed`, `cancelled`, or `corrected`, return
   deterministic `lab_result_status_read_only` and write nothing; and
10. return the persisted read shape from
    `private.clair_serialize_lab_result_entry` under the already-authorized
    transaction; do not invoke the public `lab:view` getter.

The existing v1 RPC may remain only as an explicit compatibility writer for
the exact `legacy_valid` predicate above: permitted same-workspace legacy
parent whose joined order has `orders.workspace_catalog_item_id IS NULL`,
`result_definition_origin='legacy'`,
`result_definition_snapshot='{}'::jsonb`, NULL snapshot hash, NULL quarantine
reason, and all catalog/master/panel/test IDs and revisions NULL. It cannot
accept canonical v2 rows, re-parent a header, convert legacy lineage, or write
a cross-workspace or mismatched legacy row. The v2 RPC accepts only the exact
`canonical_valid` predicate. Quarantined rows are read-only/report-only for
both writers.

The migration installs this fixed-search-path classifier for the one-time
pre-existing-row migration only:

```text
private.clair_classify_existing_lab_result_origin(
  p_workspace_id text,
  p_result_entry_id uuid,
  p_requested_origin text
) returns text -- canonical | legacy | quarantined; migration-only
```

It first validates immutable workspace/order/encounter/row parents. Direct
catalog lineage then must satisfy every canonical snapshot/lineage/hash rule or
the migration classifier persists `quarantined` with a deterministic reason
such as `direct_lineage_missing_snapshot`, `cross_workspace_parent`, or
`origin_conflict`. Only the exact legacy predicate above returns `legacy`. No
row can match both buckets. Runtime canonical creation instead inserts the
header and N rows in one transaction and a `DEFERRABLE INITIALLY DEFERRED`
constraint trigger `private.clair_validate_new_canonical_lab_result` validates
the full predicate at transaction end; any failure aborts the transaction and never stores
`quarantined`. The v1/v2 RPCs and confirmation hook call their exact predicate
checks, not the migration classifier, and direct authenticated table writes
cannot bypass the trigger/RPC boundary.

Replace the old getter overload
`public.clair_get_lab_result_entry(text,text,uuid,uuid)` by revoking/dropping
it and creating this exact actor-bound signature:

```text
public.clair_get_lab_result_entry(
  p_workspace_id text,
  p_actor_user_id uuid,
  p_result_id text default null,
  p_work_item_id uuid default null,
  p_order_id uuid default null
) returns jsonb
```

The getter checks `p_actor_user_id = auth.uid()`, active membership,
`lab:view`, and same-workspace order/encounter/work-item scope before returning
the stored immutable definition snapshot and current values, including each
row's frozen `resultValueKind` and executable `resultInputType`. It never rebuilds
definitions from current catalog rows. Existing legacy `referenceRange` values
may be returned as historical values, but B1 never creates or publishes
canonical ranges.
At least one of `p_result_id`, `p_work_item_id`, or `p_order_id` is required;
all-null selectors reject deterministically. Every supplied selector must
converge on exactly one same-workspace encounter/order/work-item/result parent;
cross-parent, ambiguous, or cross-workspace combinations reject. The public
getter enforces `lab:view`; it is not called by the save RPC to obtain that
permission.

The save RPC returns through this fixed-search-path private serializer after its
already-authorized `lab:complete` transaction:

```text
private.clair_serialize_lab_result_entry(
  p_workspace_id text,
  p_result_entry_id uuid
) returns jsonb
```

It assumes the common advisory→encounter→order→header→work-item→ledger/rows
locks are already held and serializes only the stored header/typed rows/snapshot;
the row object always carries both `resultValueKind` and `resultInputType` from
the frozen snapshot, including master-coded-as-text and workspace-custom
select/positive_negative/grade values. It never calls the public `lab:view`
getter or reads current catalog/item/master
definitions.

Add a private attachment helper for the later fulfillment transition:

```text
private.clair_attach_lab_result_work_item(
  p_workspace_id text,
  p_actor_user_id uuid,
  p_order_id uuid,
  p_work_item_id uuid
) returns jsonb
```

It follows the common order exactly: workspace adoption advisory lock first,
then same-workspace encounter, order, result header, and work item; it permits
only `work_item_id IS NULL -> same-workspace/same-order work_item_id` and
rejects replacement/re-parenting. It does not read or rewrite the definition
snapshot. A3 fulfillment remains the
owner of the single work item and A3 billing remains the owner of the single
invoice anchor.

The B1 forward migration also replaces the latest A3-compatible
`public.clair_sync_fulfillment_work_items_from_orders` definition (the current
RPC name in `supabase/migrations/20260719051725_performance_batch_rpc_followup.sql`)
without changing its public inputs. Inside the same work-item upsert
transaction it takes the workspace adoption advisory lock first, then locks
the same-workspace encounter, order, result header, and candidate work item in
that order; it calls
`private.clair_attach_lab_result_work_item` only after verifying the work item's
workspace, order, and encounter. `work_item_id IS NULL` attaches once; an
existing identical attachment returns the same row; a different parent or
work item returns a deterministic conflict. This replacement never resolves
current master/catalog definitions or refreshes the frozen result snapshot.
The fulfillment integration test owns this call and covers retry and two-session
concurrency.

No new result review/finalization/amendment RPC is part of B1. Existing status
fields remain compatibility behavior and are not reinterpreted as immutable
clinical history.

## One-panel order, fulfillment, and billing proof

B1 does not reimplement A3. It consumes the A3 persisted order contract:

1. chart confirmation creates exactly one catalog-origin `orders` row with
   `workspace_catalog_item_id` populated and `service_item_id` NULL, then calls
   `private.clair_create_lab_result_entry_for_confirmed_order` before commit;
2. that order’s pinned immutable master profile version resolves to one panel
   and the hook creates one server-identified header plus N null-valued rows
   only after the workspace projection/revision and active-item checks pass;
   the same transaction calls the sorted-distinct usage batch once for every
   linked panel item, updates only each item's canonical current component
   exactly once, and leaves its legacy, quarantine, and fixed historical
   residual components unchanged;
3. the forward replacement of
   `public.clair_sync_fulfillment_work_items_from_orders` creates/returns
   exactly one fulfillment work item keyed by workspace/order, and B1 attaches
   it once through `private.clair_attach_lab_result_work_item` without
   refreshing the frozen definitions;
4. canonical result saves fill only nullable values/notes and leave status
   `entered` with judgment `not_judged`;
5. A3 billing receives the one order/work-item identity and creates at most one
   anchored invoice line according to its frozen price/billing snapshot;
6. panel components never enter chart order creation, fulfillment creation, or
   billing candidate creation independently.

With `price_krw = NULL` and non-billable catalog semantics, no invoice line is
expected. With explicit `0` and billing enabled, one zero-valued invoice line
remains one billing unit. A positive synthetic price proves ordinary billing.
Retries lock the order/result/anchor and return the existing persisted result;
they never refresh snapshots from a changed catalog or master revision. A
second confirmation with a stale/different client result ID returns the one
server result identity or deterministic `lab_result_identity_mismatch`; it
never creates or reparents a header.

## Server/client ownership

### Exact production files allowed for B1

- `supabase/migrations/<next>_clinical_master_phase1b1_laboratory_slice.sql`:
  canonical master extension, workspace lab lineage/constraints, frozen result
  definition snapshot, RLS/grants, RPC replacements, and preflight checks.
- `supabase/snippets/clinical_master_phase1b1_replay.sql`: local synthetic
  publication, explicit workspace mapping, one-panel order/result/billing
  replay, retry, two-session instructions, and rollback assertions.
- `src/features/clinical-master/server-clinical-master-publisher-core.ts`:
  lab record/relation payload types and validation mirror. PostgreSQL remains
  fingerprint authority.
- `src/features/lab-imaging/module.tsx`:
  canonical result definitions come from the server snapshot, including frozen
  `resultValueKind` and executable `resultInputType`; the client renders those
  fields but sends values and notes only. The master coded mapping is therefore
  rendered as text, while existing workspace-custom input types round-trip
  without giving the client definition authority; the legacy service/name path
  is visibly compatibility-only.
- `src/features/lab-imaging/data.ts`: synthetic panel/result fixture data only.
- `src/types/emr-domain.ts`: panel/profile/source-lineage and frozen definition
  snapshot types; no external standard or clinical range types.
- `src/features/hospital-admin/server-order-catalog-core.ts`: extend the
  existing `mutateOrderCatalogItem`/`createSupabaseOrderCatalogGateway`
  boundary to carry only workspace-owned `labDefinition` membership/local link
  fields to the catalog CAS, and add the dedicated
  `updateWorkspaceLabTestItem` gateway call for the item CAS; it cannot carry
  master lineage or snapshots.
- `src/features/hospital-admin/server-order-catalog.ts`: preserve the existing
  server export boundary for the catalog gateway and mutation types.
- `src/features/hospital-admin/module.tsx`: send the typed lab-definition patch
  through the existing hospital-admin catalog mutation; it does not author
  master IDs, source hashes, prices, or result snapshots. Item definition
  edits call the dedicated item-CAS action, never the catalog `labDefinition`
  patch.
- `src/app/api/workspaces/[workspaceId]/hospital-admin/order-catalog/route.ts`:
  preserve the authenticated `GET`/`POST`/`PATCH` route and
  `mutateOrderCatalogItem` call, and dispatch the explicit
  `updateWorkspaceLabTestItem` action to the dedicated item CAS; this is the
  server boundary for lab-definition/catalog CAS, not a direct Data API write.
- `src/app/api/workspaces/[workspaceId]/lab-imaging/result-sheet-catalog/route.ts`:
  call the existing permission gateway for `lab:view` before any patient-linked
  lookup, then read the stored result header/row snapshot through the actor-bound
  getter; it never rebuilds a canonical definition from current catalog/master/
  profile/link rows. A missing permission returns `403` and no
  result-definition read is attempted. Catalog-only admin reads remain on the
  separate hospital-admin route and `service_catalog:view` boundary.
- `src/app/api/workspaces/[workspaceId]/lab-imaging/result-entries/route.ts`:
  actor/permission boundary and new canonical RPC payload; no client definition
  authority.

B1 does not edit `server-order-action-persistence-core.ts`,
`server-fulfillment-work-item-core.ts`, or billing cores to reimplement A3. If
the A3 gate does not expose the required direct lineage/frozen snapshot, B1
stops rather than adding a second authority path.

### Exact test and fixture files

Add:

- `tests/fixtures/clinical-master-phase1b1.fixture.json`;
- `tests/clinical-master-phase1b1.spec.ts`;
- `supabase/snippets/clinical_master_phase1b1_replay.sql`.

Update only the lab-specific contracts/UI assertions in:

- `tests/clinical-master-phase1b1.spec.ts` for publisher relation ownership,
  revision-only changes, typed workspace item versions/link pins, replay-safe
  update targets, workspace CAS/type mapping, snapshot schema/hash, usage
  recompute, and mutually exclusive legacy/quarantine preflight;
- `tests/lab-result-entry-persistence-contract.spec.ts`;
- `tests/lab-imaging.spec.ts`;
- `tests/lab-result-entry-notification-server.spec.ts`.
- `tests/hospital-admin-order-catalog-server.spec.ts` for the exact A2 writer
  extension/CAS lock, full-set link replacement, removal, revision conflict,
  immutable item-version pins, usage-count recompute, and delete-lock;
- `tests/hospital-admin.spec.ts` for the existing hospital-admin lab-item
  delete-lock/UI behavior after canonical confirmation and legacy recompute;
- `tests/chart-order-action-persistence-server.spec.ts` for confirmation-time
  result freeze and retry identity;
- `tests/fulfillment-work-item-server.spec.ts` and
  `tests/fulfillment-handoff-replay.spec.ts` for one-time work-item attachment
  and no definition refresh;
- `tests/ui-demo-api-wiring-e2e.spec.ts` for the result-sheet catalog and result
  entry route wiring, including `lab:view` denial before patient-linked reads;
- `tests/api-boundary-permission-regression.spec.ts` for authenticated direct
  Data API result-table denial and route/RPC permission parity.

Run, but do not broaden ownership of, these predecessor/regression specs:

- publisher: `tests/clinical-master-phase1a1.spec.ts`;
- predecessor gates:
  `tests/clinical-master-phase1a2.spec.ts`,
  `tests/clinical-master-phase1a2-notifications.spec.ts`, and
  `tests/clinical-master-phase1a3.spec.ts`;
- catalog/RLS: `tests/hospital-admin-order-catalog-schema-migration.spec.ts`,
  `tests/hospital-admin-order-catalog-server.spec.ts`,
  `tests/workspace-membership-rls-migration.spec.ts`;
- chart/A3 authority: `tests/chart.spec.ts`,
  `tests/chart-order-draft-persistence-server.spec.ts`,
  `tests/chart-order-action-persistence-server.spec.ts`,
  `tests/chart-order-snapshot-bridge-migration.spec.ts`;
- fulfillment: `tests/fulfillment-work-item-server.spec.ts`,
  `tests/fulfillment-handoff-replay.spec.ts`; the former must assert the
  `clair_sync_fulfillment_work_items_from_orders` replacement invokes the
  attachment helper in the same transaction and the latter must replay its
  one-time attachment/concurrency behavior;
- billing: `tests/billing-invoice-candidate-sync-server.spec.ts`,
  `tests/billing-invoice-line-persistence-server.spec.ts`,
  `tests/billing.spec.ts`;
- notification/permissions: `tests/notification-persistence-contract.spec.ts`,
  `tests/ui-demo-api-wiring-e2e.spec.ts`,
  `tests/api-boundary-permission-regression.spec.ts`,
  `tests/server-permission-enforcement.spec.ts`,
  `tests/permission-resolver.spec.ts`.

### Forbidden files/actions

- A1/A2/A3 migration, work-item, fixture, or source-spec edits;
- `supabase/seed.sql` and `supabase/snippets/den-468-491_cheongdam_master_seed.sql`
  changes to promote current rows;
- `service_*` writes or new dual-write adapters;
- chart-side client snapshot/price/name authority;
- result revision/amendment workflow tables;
- reference-range publication/calculation;
- Order Set, LIS/device/PACS/external standards, real data, remote DB,
  deployment, commit, push, PR, or runtime execution during this plan.

## Synthetic fixture, replay, and test matrix

The fixture uses only synthetic dog/cat data and must not be described as
clinically validated.

### Master and workspace fixture

- two workspaces;
- dog and cat patients/orders;
- two canonical panels, each with at least two ordered result tests;
- one standalone canonical test profile with exactly one `clair_master` link;
- numeric, text, and coded result-input shapes;
- one unit-bearing numeric test with decimal scale and one unitless
  test;
- synthetic blood/urine specimen labels for publisher/profile structural
  validation only; no patient/specimen runtime mismatch fixture;
- two explicit workspace item/link mappings per panel, including one
  `workspace_custom` member added to a trusted master panel with all link-level
  member-test lineage NULL and `source_ordinal=NULL`;
- authored links (`clair_master` or `workspace_custom`) with distinct
  branch-valid source/effective ordering (`source_ordinal` non-null only for
  panel `clair_master`; NULL for standalone `clair_master` and
  `workspace_custom`; `effective_sort_order` non-null for both),
  required/display group, and non-null owner-pinned source-test revision only
  on `clair_master` links; `workspace_custom` link-level owner-test fields are
  NULL. Every link pins a non-null item version whose own source pair is
  non-null/matching when master-derived and NULL when workspace-custom. One
  shared item is referenced by multiple catalogs with one older link
  intentionally left on its prior immutable item version;
- positive price, explicit zero, and non-billable NULL catalog rows;
- one paused/inactive item and one legacy service-backed order.

### Required assertions

1. Publisher accepts the exact lab-test detail (`testCode`,
   `resultInputTypeKey`, `canonicalUnitKey|null`, `decimalScale|null`) and
   panel detail (`panelCode`) plus their separate relation payloads. It rejects
   unknown keys, wrong types, duplicate panel membership, sort collision, wrong
   record type, price keys, invalid profile exact-one target, and missing
   relation declarations for an included owner. The vocabulary dependency pass
   proves result-input/unit/specimen effective revisions, `supports_unit`/unit
   nullability, and same-release pins before test/panel/order staging. Coded is
   structural-only; no option list is accepted.
2. The deterministic same-release publisher passes are exercised for (a) test +
   panel + order included together, (b) only test included, (c) panel included
   with test omitted, (d) order included with panel omitted, (e) relation payload
   for an omitted owner, (f) full-set removal, and (g) unchanged retry. The
   expected vocabulary→test→panel→order pinned revisions and owner-only
   revision advances are asserted in each case; omitted owners do not cascade.
3. Explicit relation removal replaces the full supplied set, retains a valid
   non-empty published panel, and never silently removes relations when an
   included owner omits its declaration.
4. Workspace mapping is idempotent by explicit workspace/master/catalog IDs;
   new master-derived item IDs match the exact `lab-item:v1:<sha256>` format,
   replay returns the same row, and a deterministic collision aborts. Every
   new item has the stable workspace-local `카테고리 미설정` fallback category unless a
   hospital override already exists; category schema/id/workspace/name/sort
   identity is checked on replay; name/price/JSON/service-ID inference never
   maps a row. Valid source-null hospital items backfill as editable
   `workspace_custom`; only explicit legacy evidence uses `legacy`, and invalid
   rows are quarantined.
5. Canonical input mapping proves numeric→number and text→text; a master coded
   definition remains `resultValueKind='coded'` with executable
   `resultInputType='text'`, the existing text input/storage path, and an opaque
   scalar string. Workspace-custom `select`, `positive_negative`, and `grade`
   rows round-trip their preserved executable `resultInputType` while retaining
   `resultValueKind='coded'`; coded still has no options authority, option
   membership validation, or new select UI. Unknown inputs reject and never
   fall back to text. Tests assert the master coded→text mapping and each of
   the three workspace-custom input values.
6. Same-workspace panel catalog confirmation calls the private freeze hook and
   commits with `service_item_id IS NULL`, one order, one result header, N
   null-valued rows, and no invoice child rows.
7. Panel component rows never create child order/fulfillment/invoice records.
8. The standalone test profile creates exactly one frozen result field through
   exactly one `clair_master` link while preserving one order and one billing
   unit; a workspace-custom extra member or local standalone profile is
   rejected.
9. A result-definition snapshot contains schema version 1, canonical source
   lineage, catalog revision, panel/profile/specimen structure,
   resultValueKind/resultInputType/unit/decimal scale/name/sourceOrdinal/
   effectiveSortOrder/required/displayGroup, owner-pinned source, item-version
   source, and workspace
   revisions, a `workspaceResultRevision` for every row, stable row IDs,
   explicit `referenceRange: null`, canonical key normalization, and a lowercase
   SHA-256 matching PostgreSQL recomputation. Every `rowId` is lowercase
   64-hex; panel and standalone `clair_master` rows carry non-null
   `ownerPinnedSourceTestRevision` checked against the immutable owner version,
   while `workspace_custom` rows carry that link-level field NULL. The selected
   item-version source pair is non-null/matching for a master-derived version
   and NULL for a workspace-custom version. `itemVersionSourceMasterRecordId` and
   `itemVersionSourceTestRevision` are separately checked against the selected
   immutable item version. Object insertion order is ignored while the rows
   array order is exact. Tests compare DB-produced canonical `jsonb::text` and
   lowercase SHA-256, not source insertion order. Panel snapshots have
   non-null panel lineage; `clair_master` rows have per-row test lineage while
   `workspace_custom` rows have member-test lineage NULL. `sourceOrdinal` is
   the raw normalized publisher integer (zero and gaps allowed) only for panel
   `clair_master` rows; it is null for standalone `clair_master` rows and
   workspace-custom panel additions. Every authored row has non-null effective
   order. Standalone snapshots have null panel lineage and exactly one
   `clair_master` row with null source ordinal.
   Legacy link metadata is arbitrary historical JSON preserved without schema
   or provenance inference, while legacy result headers remain explicitly
   discriminated by their approved compatibility predicate.
10. A later catalog/master/link change does not change the stored result
   definition snapshot, typed frozen rows, or its SHA-256.
11. Re-saving a canonical result accepts only a non-empty unique subset of
   exact three-key `{rowId,value,note}` objects: lowercase 64-hex row ID,
   string/null value max 4096, string/null note max 4096, with null distinct
   from empty string. It rejects extra keys, non-strings, duplicate IDs, and
   empty payloads; allows nullable partial values while omitted rows retain
   their prior values/notes; enforces expected entry-write revision/CAS and
   request-id plus normalized-payload-hash/base-revision/actor integrity, persists
   status `entered` and `not_judged`, and
   rejects client item/name/unit/range/panel/profile/price/lineage/snapshot/
   judgment tampering. A canonical v2 writer never accepts legacy/quarantined
   rows; the legacy v1 writer cannot re-parent or convert them.
12. Canonical confirmation creates the server ID
   `lab-order:<order_uuid>`; a null/different/stale client result ID converges
   to that identity or returns `lab_result_identity_mismatch`, never creates a
   second header, and never reparents an existing header.
13. Existing legacy result rows with reference ranges remain readable as
    historical compatibility values; no new canonical range is published.
14. NULL price stays NULL/non-billable; explicit zero stays numeric zero and
    creates one free invoice line when A3 billing is enabled.
15. Confirmation separately proves required inactive items reject, optional
    inactive panel items are omitted, standalone inactive items reject, and a
    panel with no active explicit item rejects. Paused/inactive changes after
    confirmation do not alter frozen rows. Species/specimen tests are
    publisher/profile structural tests only; no patient/specimen runtime
    mismatch test is claimed.
16. Two workspace sessions cannot read/write each other’s catalog, result, or
    authored `clair_master`/`workspace_custom` panel links; actor mismatch,
    missing `lab:view`, and missing `lab:complete`
    fail at RLS/RPC/route boundaries.
17. Direct authenticated SELECT from patient result tables fails, while the
    actor-bound getter and result-sheet-catalog route return `403` without
    `lab:view`; catalog-only admin reads remain separately service-catalog
    scoped. A same-workspace member without `service_catalog:view` receives no
    Data API rows for categories/items/links/item versions, while a permitted
    viewer can read only that workspace.
18. Two concurrent partial saves of the same result converge on one frozen
    header and one definition snapshot; one stale entry-write CAS is rejected,
    while a non-null UUID request-ID retry reads the durable ledger and is
    idempotent only for the same normalized payload hash and base revision, even
   after an intervening write. The same request ID with changed content, base,
   or actor is rejected; a new request with a stale expected revision conflicts,
   direct ledger DML is denied, insert-after-mutation is atomic, and omitted rows retain their prior
    values/notes.
19. Two concurrent confirmations/billing calls are covered by the A3
    predecessor replay and return one order, one fulfillment unit, and one
    invoice anchor.
20. Two sessions submitting distinct/stale result IDs for the same order return
    one server identity or deterministic mismatch, with no second header.
21. Legacy `service_item_id`/name/price/JSON rows remain legacy and are not
    converted; no service_* new-flow write occurs.
22. Canonical partial/entered saves do not emit `clinical_result_completed`;
    existing notification tests continue to pass only for their explicit
    legacy/demo path.
23. Notification/task handoff refers to the single lab work item and does not
    fan out by panel component.
24. A2 adoption compares typed source fields against the server-derived
    last-applied item snapshot/hash and separately compares the full catalog
    membership snapshot/hash. A customized shared item creates one durable
    review target; accepting it updates the item once and increments
    `catalog_revision` once only for referencing catalogs whose eligible link
    pin changes, reports all affected IDs, and preserves
    each catalog's local fields. A customized membership set creates a catalog
    review target with expected `catalog_revision`; stale accept/reject CAS is
    rejected. The customize → newer source release → review → accept and reject
    paths prove master-derived provenance is retained during customization,
    workspace-custom items remain source-null, and accept resolves
    `customization_state` without overwriting availability/local order.
25. Confirmation takes the A2 adoption advisory lock first, then encounter,
    order, catalog, item/link locks in deterministic order; it resolves only
    pinned immutable master version snapshots and joins each link's exact
    `pinned_workspace_result_revision` to `lab_test_item_versions`; a link pinned
    at N remains valid after the mutable current item advances to N+1. It reads
    current item rows only for identity/current availability and rejects stale
    catalog/link pins. Included rows whose source order differs from their
    effective workspace order are frozen and returned in effective order;
    panel `clair_master` rows retain raw normalized publisher source ordinal
    (zero/gaps allowed) as evidence; standalone `clair_master` rows and
    workspace-custom panel additions freeze `sourceOrdinal=null`. The
    result-sheet route/getter and
    later save read only stored header/row snapshots.
26. Replacing
    `clair_sync_fulfillment_work_items_from_orders` attaches the same-workspace
    work item once inside its upsert transaction, survives retry and two-session
    concurrency, and never refreshes definitions. The final counts remain one
    order, one header, N rows, one fulfillment unit, and at most one invoice
    line.
27. One session runs trusted A2 adoption while another starts catalog lab-order
    confirmation. Both take the workspace adoption advisory lock first; one
    waits, then the loser rechecks the pinned catalog/item revisions and either
    freezes the adopted projection or deterministically returns
    `catalog_projection_stale` for retry. The overlap completes without a
    deadlock, stale freeze, or current-row reread.
28. The dedicated item CAS rejects lab-item mutation through the single-catalog
    `labDefinition` patch. Its `customize`/trusted-resolution branch creates
    one immutable item version, pins only the
    intended links, increments `catalog_revision` once only for catalogs whose
    targeted links change, while its `local_settings` branch is current-row-only
    and creates no version or pin.
    leaves non-target links on their old workspace item version. Master
    adoption advances only links whose immutable owner snapshot expects the new
    source test revision, preserves source lineage on customized master-derived
    items, and keeps source-null local items detached from master authority. A
    stale or exact network retry without a request key
    returns deterministic revision conflict/current state and requires reload;
    it does not claim to replay the prior success.
    Catalog membership CAS uses NULL expected link revision for absence, rejects
    duplicate test IDs before DML, enforces both canonical item/sort indexes,
    and permits an empty authored set only when the same CAS changes catalog
    availabilityStatus to paused or inactive; active requires an active
    explicit item.
29. Review/update target creation is replay-safe: duplicate adoption returns
    one stable update ID and one notification; a newer release supersedes the
    older pending target; accepting the obsolete target is rejected without
    mutation; current eligible CAS accepts only the latest source/revision.
30. The mutually exclusive migration classifier yields exactly one of canonical,
    legacy, or quarantined for every existing row. Direct-lineage missing
    snapshot, cross-workspace, impossible-parent, partial-lineage, and origin
    conflict rows are quarantined and rejected by both writers; v1 accepts only
    exact legacy (`{}` snapshot, NULL hash, all lineage NULL, permitted legacy
    parent) and v2 only exact canonical. A new invalid canonical insert rolls
    back at the deferred trigger and never persists quarantine. The separate
    link classifier preserves arbitrary same-workspace legacy `snapshot_metadata`
    without schema/provenance inference and keeps every new B1 link field/hash
    NULL; impossible or cross-workspace links are read-only quarantined.
31. After confirmation, advance the current workspace item/catalog/master
    revisions and retry getter/save/result-sheet reads. The historical header,
    N typed frozen rows, hash, and entered-only partial save remain valid and
    unchanged; no current-row comparison or definition refresh occurs.
32. Confirmation creates N canonical rows and calls the sorted-distinct batch
    usage helper once; all N panel member items update their three current
    usage components exactly once; confirmation retry does not double count,
    value-only saves do not change them, and cancellation does not decrement
    them. Migration-only backfill partitions canonical/legacy/quarantine
    references into a distinct union, persists
    `historical_unattributed_usage_residual = greatest(old_total -
    attributed_preB1_total, 0)` separately, and proves the runtime sum
    `historical_unattributed_usage_residual + canonical + legacy + quarantine`.
    The residual is fixed and never recomputed or shrunk; a valid authored
    confirmation increases only the canonical current component, and
    reclassification moves a reference between current components without
    changing the union or total. Unsafe pre-B1 references appear in the
    exception diagnostic and are represented only by the residual, which
    includes their historical aggregate; unsafe new references are rejected
    and rolled back and never become quarantine rows or residual additions.
    Hospital-admin
    delete-lock remains active for positive usage, `ON DELETE RESTRICT` rejects
    deletion, quarantined references count only in the quarantine component,
    and quarantined rows cannot become writable through repair.
33. `public.lab_test_item_versions` permits same-workspace
    `service_catalog:view` reads only; direct authenticated/anon DML, wrong
    actor, non-member reads, and item CAS calls without
    `service_catalog:manage` fail. The dedicated CAS preserves the exact A2
    advisory lock and common catalog→item→link/update lock order.
34. The item-version backfill creates version 1 before link FKs, maps legacy
    input types exactly, preserves legacy UI input values, and classifies valid
    source-null hospital items as editable `workspace_custom` regardless of
    historical result/link usage. A link is promoted to the
    `workspace_custom` branch only as an added member of a trusted master panel;
    trusted catalog/order/panel identity, profile kind, and same-workspace item
    attribution must prove the branch, with `source_ordinal=NULL` and a
    non-null effective order. A master standalone backfills exactly one
    `clair_master` link; no workspace-custom standalone or extra member is
    created. An arbitrary old `{}` or other JSON link snapshot never supplies
    provenance. Otherwise the exact same-workspace legacy predicate preserves
    the arbitrary historical JSON with every new B1 typed field NULL, or the
    link is quarantined. `legacy` is reserved for result/header/link
    compatibility only, and unmappable items are quarantined. It writes local
    definition snapshots only for origins whose typed mapping is valid. The
    authored link partial unique indexes use only `link_origin` and link
    columns; availability changes do not hide item or sort collisions.
35. A v1 compatibility save, canonical v2 partial save, private serializer, and
    fulfillment attachment all take the workspace advisory lock first, then
    encounter, order, result header, work item, ledger/rows; a two-session
    save-versus-attachment overlap has no deadlock, never locks the header before
    its order, attaches at most once, and preserves the entered-only snapshot.
36. A local-settings CAS changes category, admin sort, and item isActive with
    `local_settings_revision` only: it takes no target links, creates no item
    version, performs no link repin, and leaves source-content
    fingerprint/customization and `workspace_result_revision` unchanged.
    Catalog revisions remain unchanged for category/sort, while an isActive
    change increments only affected catalog revisions. A source-content
    `customize` or trusted source-resolution decision, and only those branches,
    creates one new immutable item version and preserves master provenance or
    source-null workspace-custom origin.
37. The synthetic link fixture covers every branch of the exhaustive typed and
    schema-version-2 `snapshot_metadata` truth table: master panel member,
    exactly-one-link master standalone test, workspace-custom member retained
    under a trusted master panel, exact legacy with arbitrary historical JSON,
    and quarantined. It asserts that no workspace-custom standalone/local
    profile or standalone extra member can be created. It asserts each
    `linkOrigin`/`profileKind`, catalog/order/panel/test owner
    lineage, independent item-version source lineage, pinned workspace revision,
    required/display/source/effective ordering, exact null normalization, and
    read-only legacy/quarantine behavior; the legacy link's arbitrary
    `snapshot_metadata` is preserved byte-for-byte, with no schema/provenance
    inference and all new B1 typed fields/hash NULL. Quarantine backfill writes
    exactly one deterministic `link_quarantine_reason` code, preserves the
    historical JSON byte-for-byte, and report/read surfaces return both reason
    and metadata while all direct mutation remains denied. A source/effective-order mismatch is
    returned in effective order; raw publisher source order is evidence only
    for panel `clair_master` links, while standalone `clair_master` and
    workspace-custom panel additions carry null source order. Fixtures include
    zero and gapped publisher source ordinals and prove that confirmation
    derives a contiguous 1-based frozen ordinal from unique effective order
    (including a deliberately reversed source/effective order). No link is
    promoted from old JSON without trusted A2/A3 panel identity and
    same-workspace attribution.
38. Item and link quarantine CHECK fixtures cover NULL, blank, whitespace,
    valid non-empty, and disallowed-origin reasons independently: quarantined
    items/links reject NULL or blank reasons and accept only non-empty reasons;
    `clair_master`, `workspace_custom`, and `legacy` links reject any
    non-NULL link reason, while writable item origins reject any non-NULL item
    reason. These are DB constraint failures, not CHECK-UNKNOWN passes.

## Exact verification commands and evidence

These local-only commands were run after the predecessor gates. The standard
replay remains transaction-clean; the separate concurrency exercise committed
only synthetic rows and was followed by a fresh reset.

```bash
cd /Users/iseung-ug/project/emr-app-shell-prototype/.worktrees/clinical-master-phase1-active
git diff --check
node scripts/check-doc-links.mjs
node_modules/.bin/tsc --noEmit --pretty false
npx eslint --max-warnings=0 \
  src/features/clinical-master/server-clinical-master-publisher-core.ts \
  src/features/lab-imaging/module.tsx \
  src/features/lab-imaging/data.ts \
  src/features/hospital-admin/server-order-catalog-core.ts \
  src/features/hospital-admin/server-order-catalog.ts \
  src/features/hospital-admin/module.tsx \
  src/types/emr-domain.ts \
  'src/app/api/workspaces/[workspaceId]/hospital-admin/order-catalog/route.ts' \
  'src/app/api/workspaces/[workspaceId]/lab-imaging/result-sheet-catalog/route.ts' \
  'src/app/api/workspaces/[workspaceId]/lab-imaging/result-entries/route.ts'
npx playwright test \
  tests/clinical-master-phase1a1.spec.ts \
  tests/clinical-master-phase1a2.spec.ts \
  tests/clinical-master-phase1a2-notifications.spec.ts \
  tests/clinical-master-phase1a3.spec.ts \
  tests/clinical-master-phase1b1.spec.ts \
  tests/hospital-admin-order-catalog-schema-migration.spec.ts \
  tests/hospital-admin-order-catalog-server.spec.ts \
  tests/hospital-admin.spec.ts \
  tests/lab-result-entry-persistence-contract.spec.ts \
  tests/lab-imaging.spec.ts \
  tests/lab-result-entry-notification-server.spec.ts \
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
  --project=chromium
npx --yes supabase@2.115.0 db reset --workdir . --yes
docker exec -i supabase_db_emr-app-shell-prototype psql -U postgres -d postgres \
  -v ON_ERROR_STOP=1 < supabase/snippets/clinical_master_phase1b1_replay.sql
docker exec -i supabase_db_emr-app-shell-prototype psql -U postgres -d postgres \
  -v ON_ERROR_STOP=1 < supabase/migrations/20260819172501_clinical_master_phase1b1_laboratory_slice.sql
```

The replay must be followed by read-only SQL assertions for private-master
grants, workspace composite FKs, result snapshot hash/readback, one order/N
fields/one invoice line, NULL-versus-zero, legacy discrimination, and no
cross-workspace rows.

The two-session catalog CAS exercise used the committed synthetic replay
workspace. Session A held the exact workspace advisory lock after a successful
lab-definition CAS and committed after the overlap; session B started while A
held the lock with the same expected catalog revision and returned the
deterministic `catalog_revision_conflict` after waiting. Final readback was
catalog revision 7, two canonical links, one result header, one fulfillment
work item, and one invoice line; only A's display-group change persisted.
The lock-held overlap was observed with timestamps in both sessions, not
inferred from a single-session sleep.

For result identity/retry coverage, the replay's server-generated
`lab-order:<order_uuid>` identity and v2 writer assertions are the required
single-session proof; direct stale-ID and cross-selector attacks are covered
by the B1 route/DB contract tests. A future expanded replay may add an
interactive confirmation barrier without changing the B1 authority boundary.

The current replay does not advertise unsupported barrier variables. The
verified two-session evidence is the catalog CAS race above; confirmation
identity/retry is proven by the server-generated stable result ID, the unique
canonical order header, and the v2 stale-selector/request-revision guards in
the replay and focused route/DB contracts. A future interactive confirmation
race can be added only as a narrow replay extension and must preserve these
same persisted-count and snapshot readbacks.

## Entry, exit, rollback, and stop criteria

### Entry

- A1 local PostgreSQL reset/replay/role/two-session evidence passes;
- A2 catalog implementation/RLS/direct-DML/nullable-price evidence passes;
- A3 catalog-only new order, NULL service ID, immutable fulfillment snapshot,
  billing anchor, and permission-wrapper evidence passes;
- actual post-A3 table/function signatures are inspected before writing B1;
- all synthetic catalog/item/link mappings are explicit and same-workspace;
- A3 confirmation can call the B1 freeze hook in the same transaction, with
  order/catalog/master revisions available before commit;
- the A2 writer exposes the trusted lab source projection, separate catalog
  membership projection, shared-item review/CAS targets, and actual
  `catalog_revision`/`workspace_result_revision` lock contracts;
- the latest fulfillment sync function exposes the one-time result work-item
  attachment helper inside its upsert transaction;
- current legacy mismatches are reported and no B1 fixture depends on them.

### Exit

- four canonical master lab tables publish and replay idempotently;
- two synthetic panels map to explicit workspace result definitions;
- relation-only panel/profile changes advance only their owning master revision;
- confirmation freezes one server result identity plus N rows before commit;
- one panel proves N result fields with one order/fulfillment/billing identity;
- relation-only publisher passes pin same-release effective revisions without
  implicit cascades, and omitted owners remain unchanged;
- A2 projection adoption/review proves typed source snapshot/hash comparison,
  shared-item affected-catalog CAS, and separate membership/profile review;
- definition snapshot is schema-valid, server-generated, hashed, and immutable;
- canonical entered-only result save cannot mutate definition identity, use
  client ranges/judgment, or emit completion/review events;
- actor, permission, RLS, composite workspace FK, retry, and concurrency tests
  pass;
- direct Data API result reads and result-sheet reads without `lab:view` fail;
- legacy service/result rows remain readable and untouched;
- no Order Set, external integration, clinical validation, or new amendment
  workflow was introduced.

### Rollback and stop

Rollback is a local transaction rollback or a fresh local reset followed by the
predecessor replay and B1 replay. Do not edit/revert other agents’ WIP and do
not use destructive Git commands.

Stop immediately for:

- any missing A1/A2/A3 predecessor gate;
- no feasible composite key/FK against actual post-A3 types;
- unresolved cross-workspace B1 fixture mapping;
- any need to infer identity from names, prices, service IDs, or JSON;
- client-authored definition/range/price/snapshot authority;
- panel fan-out into child orders, fulfillment, or invoice lines;
- direct authenticated DML or actor/permission mismatch;
- result-definition snapshot mutation on retry;
- request for amendment history, reference-range publication, Order Set, or
  external provider behavior.

## Domain decision

**New domain decision required: none.**

The choice to use existing result-entry structures plus a frozen definition
snapshot is an implementation-scope decision required to keep B1 minimal; it
does not define clinical amendment history. Any future append-only result
history, review/finalization, or canonical reference-range policy requires a
separate approved work item.

## Current implementation and local closeout

The approved B1 slice is implemented in one forward migration after the actual
A3 migration, the synthetic fixture/replay, the named lab/catalog route and UI
owners, and the focused server/UI contracts. The replay proves two ordered
panel rows, one result identity/header, one fulfillment work item, one billing
line, entered-only value/note save, relation-only review target/notification/
accept, ordinal-bound callable row IDs, owner-eligible shared-link acceptance
with typed/metadata pin parity, stale-target rejection, exact top-level/row
JSON types, targeted shared-owner preservation, item-first/catalog-first
overlap convergence with no pending targets and confirmation retry, and
transaction rollback cleanup. Direct reapply is
idempotent and the
preflight buckets remain explicit: seeded items are `workspace_custom`, seeded
links are `legacy`, and no seeded result headers exist.

The focused B1/server/regression suite is 61/61 and the dedicated B1 suite is
6/6; TypeScript compilation passes. The latest named broader matrix is
280 tests: 272 pass and 8 fail. Those failures are the four existing
hospital-admin geometry/content assertions, one live lab-imaging demo click,
two UI-demo reception fixture assertions, and one billing retry assertion;
they remain outside the B1 ownership slice and are recorded rather than
masked or broadened here. The focused hospital-admin/lab-imaging rerun is
45/50 with the same four hospital-admin and one imaging-demo failure.
The broader matrix and those UI/demo failures are retained as source-level
evidence only; they do not establish the unverified full B1 matrix.
`supabase/seed.sql`
and the A1/A2/A3 migrations remain untouched by B1. This is not a
remote/deployment/commit/PR claim, and no B2/B3 behavior is included.
