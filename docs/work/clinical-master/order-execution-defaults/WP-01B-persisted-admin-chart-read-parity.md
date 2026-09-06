---
id: "CLINICAL-MASTER-OED-WP-01B"
type: "Work Item"
title: "Persisted Hospital Admin and Chart Read Parity"
description: "Removes runtime order/value fallbacks and makes Hospital Admin, chart search, and chart draft resolve from the same persisted workspace catalog row."
status: "in_progress"
area: "clinical-master"
priority: "P0"
tags:
  [
    clinical-master,
    order-defaults,
    workspace-catalog,
    hospital-admin,
    chart-orders,
    no-fallback,
  ]
target_pr: "Persisted-only order catalog read parity"
source_docs:
  - "PRODUCT-DOMAIN-WORKSPACE-ORDER-CATALOG-PLATFORM"
  - "ENGINEERING-DATA-MODEL-ORDER-CATALOG-PRESET-INITIALIZATION"
  - "CLINICAL-MASTER-ORDER-EXECUTION-DEFAULTS-REMEDIATION"
dependencies:
  - "CLINICAL-MASTER-OED-WP-00"
  - "CLINICAL-MASTER-OED-WP-01A"
baseline_commit: "f564a493b52be6f5592bda6484dd0bcf9a8a2c4b"
updated: "2026-09-06"
---

# WP-01B: Persisted Hospital Admin and Chart Read Parity

## Goal

Current checkpoint (2026-09-06): Slices 01–02 and local Slice 03 display/read
transport, two-field taxonomy storage/merge and local editor controls are implemented; 147 focused contracts and prior local PostgreSQL rollback
checks pass. **Slice 03 and WP-01B remain in progress**, not deployed or end-to-end
complete. Read-only staging inspection found broad paths, not persisted fine
subtypes. Connecting the UUID is necessary but insufficient. The proposed storage
contract is now drafted; validate its vocabulary against all target orders rather
than infer categories at runtime or silently repair data. Remote application, UI seeds and authenticated
screen/workspace acceptance remain outstanding.
See [taxonomy follow-up](./artifacts/wp-01b/slice-03-taxonomy-read.md).
Design follow-up: [two-field taxonomy proposal](./artifacts/wp-01b/slice-03-taxonomy-design.md)
is now implemented locally for storage, transport and bounded taxonomy inheritance.
See [local implementation and next scope](./artifacts/wp-01b/slice-03-taxonomy-fields-local.md).
The [522-row non-applied mapping](./artifacts/wp-01b/slice-03-taxonomy-mapping.md)
is complete: 33 mapping tests pass, 10 new subtype/12 new lab-family proposals,
fresh identity/revision/path evidence and a separate 13-row workspace list. This
does not complete clinical defaults or authorize data application. Local additive
storage/publisher/projection/API validation and two-field copy/override/reset/merge
are implemented. The local UI now passes 10 synthetic-browser cases covering editing,
creation, reload, reset/cancel, stale conflict, missing classification, read-only access
and read failures. The draft pins its opening revision to prevent stale inputs from
borrowing a refreshed row's CAS revision. See the [current UI handoff](./artifacts/wp-01b/slice-03-taxonomy-ui.md).
Next trace Slice 04 chart candidate/draft parity, then Slice 05 full-category/authenticated
acceptance and fresh remote application evidence. The full WP-02
execution-default scope remains separate.
See [Slice 03 evidence and handoff](./artifacts/wp-01b/slice-03-classification-core.md)
and the [Korean report](../../../completed/clinical-master/2026-09-06-wp-01b-slice-03-classification-core-report.html).

Make `public.order_catalog_items` the only runtime order source for both
`병원관리 > Order 관리` and chart Plan/Order selection. A displayed order or
default must resolve to the same persisted row in the current workspace.

This package removes order injection, error-to-empty conversion, invented
field values, and label-based classification that can make the two surfaces
disagree. It does not publish the WP-01A candidate dataset or change remote
data.

## Fixed Product Decisions

1. An empty workspace catalog stays empty in Hospital Admin and chart search.
2. A failed or unauthorized read stays an explicit failed or unauthorized
   state. It is never converted to a successful empty response.
3. No runtime path may inject or merge hard-coded, fixture, demo, master-only,
   stale, or foreign-workspace orders into a hospital catalog response.
4. No renderer or mapper may supply dose, unit, route, frequency, duration,
   quantity, price, classification, or another operational value that appears
   persisted when it is missing.
5. A schema may describe fields and validate persisted values. Its
   `defaultValue` must not silently become a runtime order default. A universal
   default is allowed only after it is materialized into the master/workspace
   record before runtime readback.
6. `default_detail_inputs` is the effective generic workspace field. The
   legacy persisted `medication_metadata.defaultDetailInputs` representation
   may be read only as a temporary same-row compatibility projection until a
   data migration materializes the generic field. It must not create a value
   that is absent from both persisted representations.
7. Master-derived prototype orders use independent availability, synthetic
   provenance, and clinical-validation dimensions. They do not enter a
   `검수 대기/검수 완료` lifecycle merely to become usable.
8. The existing veterinarian approval flow for a newly hospital-authored
   dispensing order is a separate workspace-authoring policy. WP-01B must not
   reuse it for master-derived prototype orders or present it as clinical
   validation. Removing that separate policy is outside this package.
9. Active chart-eligible rows appear in chart `전체` and their one persisted
   category. Dispensing maps to `조제`; treatment maps to `처치`. Category tabs
   explain visibility after retrieval but do not explain missing defaults.
10. Hospital Admin table rows show only the category-specific core details
    needed to identify and compare the work. Missing persisted values render
    as `미설정`.

## Scope

- Align the Hospital Admin and chart-search read gateways around a fail-closed
  result type and one persisted workspace authority.
- Preserve the intentional visibility difference: Admin lists current
  workspace rows including paused rows; chart lists only eligible active rows
  and active valid sets.
- Remove runtime fixture/default catalog injection from hospital workspace API
  responses.
- Remove renderer and mapper defaults that resemble saved operational values.
- Define one effective-default parser used by Admin, chart search snapshots,
  and chart draft initialization.
- Preserve explicit legitimate runtime resolution such as the current
  encounter's responsible clinician, with source and timing visible in code.
- Replace heuristic category placement with an explicit persisted
  classification contract or a fail-closed missing-classification state.
- Slice 03 includes local additive Admin RPC classification descriptor transport
  and rollback-only synthetic SQL verification. Remote read-only schema/catalog
  inspection is evidence, not authorization to apply the migration or repair data.
- Add compact category-specific table summaries backed by effective persisted
  values.
- Prove row identity, count, classification, default-value, status, and
  workspace parity through unit, route, and browser tests.

## Out Of Scope

- Applying the 522 WP-01A candidate defaults to master or workspace rows.
- Master publication, workspace adoption, or field-level merge; WP-02 and later
  category packages own those changes.
- Remote Supabase migration, remote data repair, Airtable mutation,
  deployment, or production claim.
- Changing confirmed encounter snapshots, fulfillment history, actual/result
  records, or billing history.
- Removing the separate hospital-created dispensing approval policy.
- Completing category-specific semantic content such as the 51 incomplete
  dispensing identities or laboratory reference ranges.
- Treating synthetic prototype values as suitable for real clinical use.

## Current Repository Audit

This audit covers repository behavior at the declared baseline and the current
working tree. It does not claim current remote database contents or deployed
authenticated behavior.

### Read-path topology

```text
Hospital Admin UI
  -> GET /hospital-admin/order-catalog
  -> listAdminCatalog
  -> clair_list_order_catalog_admin_v2
  -> public.order_catalog_items for the current workspace

Chart Plan/Order dialog
  -> GET /hospital-admin/order-catalog?mode=chart-search
  -> listChartSearch
  -> clair_list_order_catalog_chart_search_v2
  -> active/eligible public.order_catalog_items + active valid sets
  -> client patient-species and category filtering
```

The two surfaces share an HTTP route but not the same database projection.
That separation is valid only if both projections preserve the same persisted
individual-row identity and errors remain observable.

### Confirmed findings

| ID   | Current evidence                                                                                                         | Current behavior                                                                                                                                             | Required WP-01B change                                                                                                                                |
| ---- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| R-01 | `src/features/hospital-admin/server-order-catalog-core.ts:738-744`                                                       | Catalog list gateway results cannot represent a read failure.                                                                                                | Add explicit success/failure result unions for Admin and chart reads.                                                                                 |
| R-02 | `src/features/hospital-admin/server-order-catalog-core.ts:2369-2401`                                                     | Admin RPC failure falls back to a direct table read; table or chart RPC failure becomes a successful empty list.                                             | Remove deploy-order fallback and error-to-empty conversion; preserve typed read errors.                                                               |
| R-03 | `src/features/hospital-admin/server-order-catalog-core.ts:924-985`                                                       | Wrapper functions always return success after permission passes because the gateway cannot fail.                                                             | Propagate database and mapping errors to the API response.                                                                                            |
| R-04 | `src/features/hospital-admin/server-order-catalog-core.ts:1584-1606` and `:4485-4619`                                    | Omitting a gateway creates a runtime mock catalog backed by four hard-coded orders and a hard-coded set.                                                     | Require an explicit gateway in runtime handlers; keep fixtures only in explicitly named tests/stories.                                                |
| R-05 | `src/app/api/workspaces/[workspaceId]/hospital-admin/order-catalog/route.ts:52-73`                                       | Demo-header identity routes hospital workspaces to the session mock catalog.                                                                                 | Remove mock catalog authority from the product route or move it behind an isolated test-only harness that cannot answer a hospital workspace request. |
| R-06 | `src/features/hospital-admin/data.ts:862-919`                                                                            | Missing dispensing fields are synthesized from metadata and final literals such as `1`, `tablet`, `PO`, `sid`, `any_time`, `room_temp`, and `true`.          | Return only persisted values; represent each missing value as missing and render `미설정`.                                                            |
| R-07 | `src/features/hospital-admin/data.ts:734-750` and `:654-700`                                                             | A new dispensing draft starts with realistic-looking clinical values and a review state before user authoring.                                               | Use blank/unset draft values or clearly non-persisted editor suggestions that cannot be saved implicitly; do not call them catalog defaults.          |
| R-08 | `src/features/chart/module.tsx:4703-4708`, `:8542-8545`, and `src/features/chart/order-execution-domain.ts:492-510`      | Schema `defaultValue` is used during display/edit and validation even when absent from the workspace row.                                                    | Stop runtime default substitution; validate only materialized values plus explicit authoritative runtime resolvers.                                   |
| R-09 | `src/features/hospital-admin/module.tsx:3676-3686`                                                                       | Admin tells the user that a missing field will use a chart schema default.                                                                                   | Replace this with `미설정` and the correct remediation/ownership message.                                                                             |
| R-10 | `src/features/hospital-admin/data.ts:1205-1267`                                                                          | Category/subcategory placement partly depends on Korean label substring heuristics and otherwise falls into medical supplies.                                | Resolve from persisted clinical type/classification identity; fail visibly when classification is incomplete.                                         |
| R-11 | `src/features/hospital-admin/server-order-catalog-core.ts:3133-3164` and `:3790-3814`                                    | Invalid rows are filtered out silently by array mappers.                                                                                                     | Return a typed mapping/read error with row identity where safe; never report a partial list as complete.                                              |
| R-12 | `supabase/migrations/20260826190000_clinical_master_dispensing_service_review_pricing.sql:206-246`                       | Admin v2 returns every workspace catalog row, including paused rows.                                                                                         | Keep this intentional Admin history behavior and prove exact persisted counts.                                                                        |
| R-13 | `supabase/migrations/20260820140000_clinical_master_phase1b3_chart_set_runtime.sql:1314-1429` and latest chart transport | Chart returns active individual rows and active valid sets; additional dispensing gates exist.                                                               | Document each eligibility predicate and reconcile the result to Admin rows by ID instead of expecting raw count equality.                             |
| R-14 | `src/features/chart/module.tsx:8870-8879` and `:9090-9130`                                                               | Chart applies patient-species and selected-category filters after retrieval.                                                                                 | Keep the filters, add excluded-reason diagnostics/tests, and prove active rows appear in `전체` plus exactly one correct category.                    |
| R-15 | `src/features/chart/module.tsx:8882-8958`                                                                                | New chart drafts copy the search row's applied snapshot and default details, then add encounter clinician context for consultation.                          | Preserve the copy boundary; ensure its inputs come from the shared persisted-default parser and label runtime-resolved fields separately.             |
| R-16 | `src/features/chart/module.tsx:9430-9522`                                                                                | Chart has explicit loading/error/denied/empty states.                                                                                                        | Preserve these states and ensure the server no longer converts DB failures into an apparent empty success.                                            |
| R-17 | `src/features/hospital-admin/module.tsx:2924-2939` and `:275-289`                                                        | Master rows and hospital-created dispensing rows use different review concepts, but the UI wording can make them appear to be one clinical review lifecycle. | Show master prototype provenance/validation independently; keep hospital-created authoring approval visibly separate.                                 |
| R-18 | `tests/hospital-admin-order-catalog-server.spec.ts:959-1013`                                                             | A regression test explicitly requires the deploy-order fallback.                                                                                             | Replace it with fail-closed error-propagation and no-secondary-read tests.                                                                            |

### Root cause confirmed by the audit

The observed mismatch is not caused by the chart having separate `조제` and
`처치` tabs. The tabs filter already-retrieved rows and can explain absence from
one category, but not absence from `전체` or missing default values.

The repository contains four independent divergence mechanisms:

1. Admin and chart call different database projections.
2. Read failures are converted to successful empty results.
3. Runtime mock data can answer the hospital catalog route in demo-header mode.
4. Admin and chart render or validate missing values through different fallback
   chains.

Label-based category inference and silent row dropping add further count and
classification drift. WP-01B must remove all six divergence classes before a
category data rollout can be trusted.

## Target Read Contract

### Shared individual-row envelope

Both read projections must expose or derive the following from one persisted
current-workspace row:

- `workspaceCatalogItemId` and `workspaceId`;
- catalog revision and source master identity/revision where present;
- persisted availability and category/classification identity;
- standard, in-hospital, and billing names;
- target species;
- typed execution contract;
- effective persisted `defaultDetailInputs` and policies;
- prototype provenance and clinical-validation dimensions;
- source lineage needed for future snapshot and merge verification.

The chart projection may add an immutable applied-snapshot envelope. It may not
change the row's identity, values, or provenance.

### Intentional visibility difference

```text
Admin visible set
  = all readable persisted rows for workspace W

Chart eligible individual set
  = Admin rows
    where availability = active
    and every explicit execution/clinical-use gate passes
    and patient species is supported
    and selected category is all or equals the persisted category
```

Paused and inactive rows are expected in Admin but not chart search. Any other
exclusion needs a machine-readable reason and a test. A chart individual row
without a matching Admin row ID is always a defect.

### Effective default interpretation

```text
effective persisted defaults
  = non-empty order_catalog_items.default_detail_inputs
  else same-row legacy medication_metadata.defaultDetailInputs
       only during the bounded compatibility period
  else missing
```

Schema defaults, UI constants, mock profiles, other orders, master-only rows,
and prior-workspace cache are not part of this resolution. The compatibility
branch must expose a source marker and is removed after materialization.

Slice 02 implementation selects the stored source before removing reserved
policy keys. An empty transported projection with a source marker remains empty;
it must not revive older nested values. Admin writes preserve the raw selected
object (including manual quantity reason and authority), mirror generic/nested
representations, and remove explicitly cleared fields. Chart execution receives
the clinical projection without `planOrderAuthority`, `manualQuantityReason`, or
`autoDispenseQuantityEnabled`. The persisted top-level auto-quantity policy is
read explicitly, never defaulted. Missing and explicit zero/false are distinct.

## Implementation Slices

Each slice should remain reviewable and must pass its exit gate before the next
slice begins.

### Slice 01 — Fail-closed gateway results

- Add typed Admin/chart read failures to `OrderCatalogGateway`.
- Remove direct-table deploy-order fallback.
- Stop converting RPC/table/mapping failures to empty success.
- Make the route return a non-2xx typed response for database and mapping
  errors.
- Require explicit runtime gateway construction; do not use a default mock
  parameter in request-handling functions.

Exit: simulated RPC, table, mapping, auth, and permission failures remain
distinct; no secondary catalog read occurs after the primary RPC fails.

### Slice 02 — Persisted-only effective defaults

Local implementation/checkpoint: 2026-09-06. Mapper/snapshot/validation tests
prove field-deletion parity; screen acceptance is still owned by Slice 05.
See [execution record](./artifacts/wp-01b/slice-02-persisted-defaults.md).

- Centralize the same-row effective-default parser.
- Remove literal dispensing fallback values from read mappers.
- Stop schema-default substitution in chart display, editor initialization, and
  confirmation validation.
- Keep only explicit runtime resolvers and label their ownership.
- Return `미설정` for absent Admin values and block confirmation when a required
  value remains unresolved.

Exit: deleting a persisted field makes both Admin and a new chart draft show it
as missing; neither surface produces a replacement value.

### Slice 03 — Stable classification and Admin summaries

Local display checkpoint: 2026-09-06. Removed label/provenance inference;
known persisted clinical types determine broad category, unresolved fine
classification stays visible in category-wide and confirmation-needed lists.
Fixed core field definitions retain missing columns. Shared core readback and
presence status are also shown in the drawer; presence is not clinical validation.
The opaque UUID alone cannot prove a subtype. A present UUID with missing semantic
transport is `taxonomy_unavailable`, distinct from `subcategory_missing` and
`type_missing`. No protected taxonomy field is added to mutation patches.

Remaining exit gate: connect persisted classification path semantics to Admin
and verify row/drawer/API/readback parity. This will require a separately scoped
read-contract change; do not substitute authoring fixtures, names or arbitrary
UUID mappings. Existing DB unclassified-path creation behavior is not changed.
See [checkpoint and field matrix](./artifacts/wp-01b/slice-03-classification-core.md).

- Resolve category/subcategory from persisted clinical type and classification
  identity, not display-name substring matching.
- Define the smallest core field set per category.
- Use the centralized effective-default parser for table and drawer.
- Keep secondary details, evidence, lineage, and audit context in the drawer.
- Add explicit incomplete-classification and incomplete-default states.

Exit: row, drawer, API, and persisted readback agree for every displayed core
field and category.

### Slice 04 — Chart candidate trace and draft parity

- Reconcile Admin row IDs with chart candidate IDs after eligibility filters.
- Preserve patient-species and category filters with explicit test fixtures.
- Add a stable source marker from candidate to new draft and confirmed
  snapshot.
- Verify chart `전체`, `조제`, `처치`, and other category counts from the same
  eligible set.

Exit: every chart individual candidate and created draft traces to one visible
Admin row in the same workspace and uses identical effective defaults.

### Slice 05 — Browser acceptance and negative controls

- Verify loading, empty, error, unauthorized, stale/conflict, and missing-field
  surfaces.
- Verify exact total/category/subcategory/status/source counts.
- Verify edit-save-close-reopen-reload.
- Verify use-stop removes future chart eligibility and reactivation restores it.
- Verify cross-workspace isolation and no stale row reuse after switching.

Exit: the complete Definition of Done below passes with deterministic fixtures
and one authenticated environment when separately authorized.

## Verification Plan

### Focused unit and route tests

- Admin RPC error returns typed failure and does not call the table builder.
- Chart RPC error returns typed failure rather than `rows: []`.
- Empty successful rows remain distinguishable from read failure.
- Invalid mapped row fails the complete read instead of silently disappearing.
- Explicit mock gateway works only when a test directly injects it.
- Missing dispensing fields remain absent through Admin mapping and chart
  snapshot mapping.
- Persisted generic details win over persisted legacy nested details.
- Legacy nested details work only for the same catalog row and carry a
  compatibility source marker.
- Schema `defaultValue` does not populate an absent runtime field.
- Admin and chart return identical individual-row IDs and values before
  eligibility filters.

### Browser matrix

| Case                              | Hospital Admin                           | Chart Plan/Order                                      |
| --------------------------------- | ---------------------------------------- | ----------------------------------------------------- |
| Empty catalog                     | Explicit zero-row state                  | Zero candidates                                       |
| Read error                        | Retryable error                          | Retryable error                                       |
| Unauthorized                      | Permission state                         | Permission state                                      |
| Missing required persisted detail | Row shows `미설정`; drawer shows missing | Candidate/draft shows missing and confirmation blocks |
| Active supported row              | Visible with core details                | Visible in `전체` and correct category                |
| Paused row                        | Visible as stopped                       | Not a candidate                                       |
| Unsupported patient species       | Visible with species scope               | Excluded for that patient                             |
| Workspace switch                  | Only new workspace rows                  | Only new workspace rows                               |
| Authorized edit                   | Saved value survives reload              | New draft receives saved value                        |
| Use-stop/reactivate               | State changes survive reload             | Candidate disappears/reappears                        |

### Required commands

The implementation package should run the narrowest applicable tests first,
then the related suite:

```bash
npx playwright test --config playwright.catalog-contract.config.ts
npx playwright test tests/chart.spec.ts --grep "order catalog"
npx playwright test tests/auth.spec.ts --grep "hospital-admin.*order"
npm run docs:check
git diff --check
```

Exact commands may be adjusted to the repository's current test runner, but the
covered contracts must not be reduced.

## Definition Of Done

WP-01B is complete only when:

1. Runtime hospital workspace routes cannot return fixture or default catalog
   orders.
2. Empty, error, unauthorized, stale, and malformed reads remain distinct.
3. No Admin or chart renderer invents a missing operational field.
4. Both surfaces use one effective persisted-default interpretation.
5. Every Admin row maps to one persisted current-workspace catalog ID.
6. Every chart individual candidate maps to an Admin row with the same ID,
   revision, category, source, and effective defaults.
7. Intentional chart exclusions are limited to documented availability,
   clinical-use, species, and category filters.
8. Every active eligible row appears in chart `전체` and exactly one correct
   category tab.
9. Hospital Admin exact counts and classification match persisted readback.
10. Every row shows its category-specific core details or `미설정` from the same
    values used by its drawer and chart draft.
11. Authorized edits survive reload and affect only future chart drafts in the
    same workspace.
12. Use-stop/reactivation changes future chart availability without changing
    confirmed history.
13. Master-derived synthetic prototype rows are active without a fabricated
    review-complete state and remain labeled not clinically validated.
14. Focused unit, route, browser, negative-control, docs, and diff checks pass.
15. Remote or deployed completion is claimed only after separately authorized
    authenticated readback; local implementation alone does not satisfy that
    claim.

## Approval Boundary

Local application code, tests, source docs, and new migration files are within
the planned implementation scope once implementation starts. Remote migration,
remote data repair, Airtable mutation, deployment, or production verification
requires a separate explicit approval and is not implied by this ready plan.

## Related Sources

LAB-03 checkpoint (2026-09-06): this is the immediate next implementation package.
The [CBC code/remote audit](./artifacts/oed-lab-03/audit-and-transition-plan.md)
confirms existing default transport and read-error masking. Reuse its fallback
inventory. This package does not add CBC reference profiles or rewrite result
snapshots; those are subsequent OED-LAB-04 slices. Keep cross-category scope.

- [Umbrella remediation plan](../CLINICAL-MASTER-order-execution-defaults-remediation-plan.md)
- [Workspace Order Catalog Platform](../../../product/domain/workspace-order-catalog-platform.md)
- [Order Catalog Preset Initialization Contract](../../../engineering/data-model/order-catalog-preset-initialization-contract.md)
- [WP-00 semantic audit](WP-00-prototype-contract-and-semantic-audit.md)
- [WP-01A research and candidate package](WP-01A-research-and-synthetic-candidate-data.md)
