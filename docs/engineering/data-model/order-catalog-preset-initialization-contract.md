---
id: ENGINEERING-DATA-MODEL-ORDER-CATALOG-PRESET-INITIALIZATION
type: Data Contract
title: "Order Catalog Preset Initialization Contract"
description: "Defines how CLAiR system order presets initialize, merge into, and preserve workspace-owned order catalog rows."
status: approved
area: engineering
doc_type: data-contract
tags: [data-model, order-catalog, presets, workspace, migration-boundary]
related_work:
  - DEN-281
  - DEN-282
  - CLINICAL-MASTER-PR-020
supersedes: []
superseded_by: []
last_updated: 2026-09-06
---

# Order Catalog Preset Initialization Contract

This document defines the engineering data contract for turning CLAiR system order presets into workspace-owned order catalog rows. It supports DEN-281 and is the implementation input for DEN-282.

## Goal

CLAiR owns standard order presets. Each hospital workspace owns its working order catalog.

The system must be able to:

- initialize a new workspace catalog from system presets
- import newly released presets later
- update workspace rows that have not been customized
- preserve hospital-customized values
- keep persisted synthetic demo catalogs deterministic without runtime fallback

Remote Supabase migration push, remote RLS replay, production deploy, and real hospital data import remain approval-gated.

## Runtime read boundary — WP-01B Slice 01

Local implementation on 2026-09-06, not yet deployed:

- Admin and chart catalog RPC failures return typed non-success results. No
  direct-table retry or error-to-empty conversion is allowed. A successful `[]`
  remains a legitimate empty catalog; malformed responses fail as a whole.
- Admin rejects foreign-workspace rows. Individual chart rows require a catalog
  ID and consistent row/snapshot catalog and preset identities. Full cross-view
  ID/eligibility reconciliation remains a later WP-01B slice.
- Catalog request handlers require explicitly supplied gateways and permission
  adapters. The hospital order-catalog route rejects mock/demo-header identity.
  Test fixtures remain available only through explicit core-test injection.
- Catalog-dependent chart draft preparation checks `service_catalog:view`
  before reading, because the underlying SQL may express denial as zero rows.
  Failed reads stop draft save and catalog before-image mutation processing.
- The legacy lab delete-lock route has no explicit persisted gateway and now
  returns `503 catalog_gateway_required` instead of a fabricated fixture lock.
  This is a known unavailable backend, not proof that deletion is safe.

This slice does not remove remaining UI seed rows, schema/default-value
substitution or classification heuristics. See the
[WP-01B execution record](../../work/clinical-master/order-execution-defaults/artifacts/wp-01b/slice-01-read-boundary.md)
for evidence and the next slice.

## Persisted default projection — WP-01B Slice 02

Local implementation on 2026-09-06, not yet deployed:

- `readPersistedOrderDefaults` selects one stored object: non-empty generic
  defaults, otherwise bounded same-row legacy nested defaults, otherwise missing.
  It never fills individual missing fields from other objects or schema defaults.
- Select the source before projecting policy keys. A transported empty generic
  object with a source marker remains authoritative and cannot revive nested data.
- `storedValues` retains the raw object for Admin round-trips. `values` excludes
  `planOrderAuthority`, `manualQuantityReason`, and `autoDispenseQuantityEnabled`
  from chart clinical inputs. These are separate clones, not shared mutable state.
- Admin dispensing creates/updates mirror generic and nested raw defaults. Keep
  manual quantity reason in the nested object because the current SQL validator
  requires it for manual quantity. Clearing an editable field removes it from both
  representations; unrelated stored fields and authority are preserved.
- Auto-quantity policy is read explicitly from saved metadata. Missing does not
  mean true or false. Display/edit/validation do not materialize schema defaults;
  explicit zero and false stay distinct from missing.
- Auto quantity is computed only for explicit per-patient, same-unit inputs with
  known frequency and finite numbers/result. No weight/BSA or strength conversion
  is inferred. Missing unit-price draft quantity stays empty; a fixed-order-price
  billing instance remains quantity one, not a clinical default.

No data migration or remote write occurred. SQL policy defaults, existing
`qod`/`sachet` authoring-versus-chart option mismatches, remaining UI seed removal,
classification and full browser acceptance are not resolved by this slice.
See [Slice 02 evidence](../../work/clinical-master/order-execution-defaults/artifacts/wp-01b/slice-02-persisted-defaults.md).

## Classification and core display — WP-01B Slice 03

WP-01B Slice 03 local display checkpoint (2026-09-06): Admin read responses mark
clinical type as persisted or derived. Explicit invalid types fail mapping;
derived types are not presented as saved taxonomy. Broad category follows saved
clinical type (including system_exam under misc), otherwise a known saved group.
Opaque classification UUIDs, names and dispensing provenance never establish a
fine category. Unresolved rows remain discoverable in category-wide and
confirmation-needed lists. UUID present but semantic transport absent is distinct
from a genuinely absent subtype. Read-only taxonomy fields remain out of updates.

Admin table/drawer share a fixed core field matrix; absent keys remain visible.
Core presence labels are not clinical review or confirmability states.

Slice 03 follow-up (2026-09-06): an additive local migration exposes an exact-row
`classification_path` descriptor through the existing permission-guarded Admin
RPC. The gateway validates identity and types; Admin distinguishes unavailable,
unclassified, retired and conflicting paths. Names are display-only. Mutation
readback checks workspace, row, revision and path identity; failed readback keeps
the committed write successful but explicitly marks taxonomy unavailable, never
reuses stale metadata or invites a duplicate save. Metadata is not in write patches.

Read-only staging inspection established that paths themselves are broad: CBC and
chemistry share a lab path; modalities share an imaging path. There is no persisted
Admin fine-subtype/pathology code. Transport alone cannot supply those values.
Local PostgreSQL rollback checks passed; remote migration and authenticated app
parity remain outstanding. Fine-taxonomy authoring/data scope must be defined
before claiming Slice 03 complete.
See [Slice 03 checkpoint](../../work/clinical-master/order-execution-defaults/artifacts/wp-01b/slice-03-classification-core.md).

## Data Families

### Fine classification extension (local implementation; not remotely applied)

The [Slice 03 design proposal](../../work/clinical-master/order-execution-defaults/artifacts/wp-01b/slice-03-taxonomy-design.md)
defines master/workspace `admin_subcategory_code` and `lab_family_code`, with
parent-category lookup from an explicit vocabulary rather than name inference.
Execution type/path remain separate. Two-field copy/override/merge validation is
a bounded WP-02 prerequisite for deployment. The reviewed 522-row mapping remains
non-applied. Migration `20260906074651` implements local storage, immutable-version
publication, explicit vocabulary validation, workspace merge, and new snapshots.
Per-field `taxonomy_source_baseline` tracks value/revision independently of price
or execution defaults. Explicit null is a local clear, not a request to inherit.
Invalid merged pairs retain both values/baselines and record `taxonomy_merge_conflict`.
Wildcard customization and detached rows are preserved; resets are explicit,
server-resolved and CAS-checked. No historical chart snapshot is enriched.
Generic creation dispatches dispensing through its existing authorized clinical
writer before adding taxonomy atomically; clinical lifecycle is unchanged.
These are local contracts, not deployed schema or remote adoption claims. See
[tests, limitations and next scope](../../work/clinical-master/order-execution-defaults/artifacts/wp-01b/slice-03-taxonomy-fields-local.md).

Local UI extension: editing uses the catalog snapshot captured when the drawer opens,
including its CAS revision. A same-ID background refresh cannot turn a taxonomy-only
edit into a broad clinical patch. Reset sends only `resetTaxonomyFields` for the two
classification fields; merge-conflict metadata is parsed for Admin display and never
copied into chart clinical defaults. See the [UI evidence](../../work/clinical-master/order-execution-defaults/artifacts/wp-01b/slice-03-taxonomy-ui.md).

| Data family | Owner | Persistence meaning |
| --- | --- | --- |
| `system_order_presets` | CLAiR | Canonical default order templates shipped by the service. These are not edited by hospital users. |
| `workspace_order_catalog` | Hospital workspace | Hospital-owned working order rows copied or derived from system presets. |
| `encounter_order_snapshots` | Encounter/chart | Immutable applied snapshots created when a chart user confirms an order. |

Existing Project 07 names `order_catalog_items` for workspace-owned rows. DEN-282 can either keep this table name and add preset-source fields, or introduce a clearer adapter name in application code. Do not rename persisted tables without a scoped migration issue.

## Required Preset Fields

System presets should contain every default value needed to create a workspace catalog row.

| Field | Requirement |
| --- | --- |
| `presetId` | Stable CLAiR-owned identity. Must not change between versions for the same conceptual order. |
| `presetVersion` | Server-assigned positive integer revision that changes when CLAiR updates default names, category, routing, or metadata. It is not manually authored in Airtable. |
| `presetStatus` | `active`, `deprecated`, or `hidden`. Hidden presets are not copied into new workspaces. |
| `categoryGroup` | One of the supported top-level order categories. |
| `categoryLabel` | Hospital-admin-facing subcategory label. |
| `standardOrderName` | Shared preset name. |
| `defaultInHospitalOrderName` | Initial workspace display name. |
| `defaultBillingName` | Initial invoice-facing name. |
| `aliases` | Search aliases. |
| `defaultAvailabilityStatus` | Usually `active`, but can be `inactive` for presets that need setup. |
| `defaultPriceKrw` | Optional synthetic/demo fixture value only. Phase 1 canonical master does not publish an authoritative suggested price. |
| `salesUnit` | Billing unit. |
| `targetSpecies` | Demo filtering field, not medical eligibility guidance. |
| `defaultDestinationModule` | Destination used after chart confirmation. |
| `defaultTaskRequired` | Whether confirmation creates downstream work by default. |
| `billingReflectionEnabled` | Whether the row contributes to billing behavior. |
| `careGuide` / `internalInstruction` | Optional default communication text. |
| `pricingRule` | Default amount calculation rule. |
| `metadata` | Type-specific metadata for lab, imaging, medication, vaccine, treatment, inpatient, or billing-only rows. |

## Required Workspace Catalog Source Fields

Workspace catalog rows need source tracking so automatic preset updates do not overwrite hospital customization.

| Field | Requirement |
| --- | --- |
| `workspaceId` | Required tenant boundary. |
| `catalogItemId` | Workspace-owned row id. Existing `order_catalog_items.id` can serve this role. |
| `sourcePresetId` | Preset id that created or most recently matched this row. Existing `standard_order_id` can serve this role if semantics are kept stable. |
| `sourcePresetVersion` | Preset version currently reflected in the row. Existing `source_preset_version` can serve this role. |
| `initialImportedPresetVersion` | Preset version used at first creation. Required for diagnostics and future diff UX. |
| `lastAutoMergedPresetVersion` | Latest preset version that was auto-applied without overriding customization. |
| `customizationState` | `unmodified`, `customized`, or `detached`. |
| `customizedFields` | List or JSON object of fields hospital staff changed from the preset. |
| `lastCustomizedAt` / `lastCustomizedByUserId` | Audit-friendly metadata for workspace customization. |
| `presetMergeStatus` | `current`, `update_available`, `conflict`, or `detached`. |
| `availabilityStatus` | `active`, `paused`, or `inactive`; product copy should show `사용 중지` for stop-using behavior. |

Existing schema already has `standard_order_id`, `source_preset_version`, `availability_status`, pricing fields, destination, task, billing, and metadata. DEN-282 should add only the minimum source-tracking fields needed for the selected local-first implementation.

The target price contract distinguishes unset from intentional zero/free. The workspace owns price, and a billable catalog row cannot activate while price is unset. Existing persisted non-null zero defaults remain compatibility behavior until a separately scoped migration is approved.

## Initialization Algorithm

For a new workspace:

1. Select eligible system presets where `presetStatus = active`.
2. For each preset, create one workspace catalog row.
3. Set `sourcePresetId = preset.presetId`.
4. Set `sourcePresetVersion`, `initialImportedPresetVersion`, and `lastAutoMergedPresetVersion` to the current preset version.
5. Copy default editable fields into the workspace row.
6. Set `customizationState = unmodified` and `customizedFields = []`.
7. Preserve deterministic ids for demo/mock seeds when the workspace is `clair-demo`.
8. Do not create duplicate rows if initialization is retried.

Initialization must be idempotent. Running the same initialization twice for the same workspace and preset version should leave one row per preset.

## Automatic Preset Merge Algorithm

When CLAiR ships a new preset version:

| Case | Required behavior |
| --- | --- |
| New preset id | Add a new workspace row automatically when eligible. |
| Existing workspace row is `unmodified` | Auto-update copied fields to the new preset version. |
| Existing workspace row is `customized` | Preserve fields named in `customizedFields`, merge newer values into non-customized fields, and mark overlapping differences as `conflict`. |
| Existing workspace row is `detached` | Do not auto-update. |
| Preset was deprecated | Do not hard delete workspace rows. Mark `presetMergeStatus` or future review state. |
| Conflict cannot be safely resolved | Preserve existing workspace row and mark `presetMergeStatus = conflict` or `update_available`. |

The merge remains conservative at the field boundary:

- auto-add new presets
- auto-update unmodified rows
- preserve customized fields
- merge non-customized fields
- surface customized-field overlap as conflict for review

## Customization Detection

Hospital edits should mark fields as customized when a user changes them from the current preset-derived value.

The minimum tracked fields for phase 1:

- `inHospitalOrderName`
- `billingName`
- `aliases`
- `availabilityStatus`
- `priceKrw`
- `salesUnit`
- `targetSpecies`
- `defaultDestinationModule`
- `defaultTaskRequired`
- `billingReflectionEnabled`
- `careGuide`
- `careGuideDeliveryEnabled`
- `internalInstruction`
- `internalInstructionDeliveryEnabled`
- `pricingRule`
- type-specific metadata

Field-level tracking is authoritative for automatic merge. A row with
`customizationState = customized` keeps the hospital values named in
`customizedFields`; newer preset values may replace only fields outside that
set. When the incoming value differs on a customized field, the hospital value
wins and `presetMergeStatus = conflict` until explicit review.

Hospital-created dispensing presets use `customizationState = detached`, have
no CLAiR master lineage, and therefore never participate in master auto-merge.

## Chart Snapshot Boundary

Workspace catalog source tracking does not replace chart snapshots.

When a chart user confirms an order, the encounter-owned snapshot must copy the selected workspace row's applied values. Later preset merges or catalog edits affect future orders only.

Required applied snapshot fields remain defined in [Workspace Order Catalog Platform](../../product/domain/workspace-order-catalog-platform.md).

## Mock And Demo Seed Rules

- Demo seeds must use synthetic data only.
- A demo workspace must remain deterministic through versioned persisted seed or adoption data.
- An empty or failed workspace catalog read must stay empty or failed. Runtime code must not substitute `defaultOrderCatalogItems`, master-only rows, or another fixture catalog.
- `defaultOrderCatalogItems` and equivalent fixtures may remain only in explicitly isolated tests, stories, or development harnesses that inject them directly. They cannot be a default dependency of a hospital workspace route.
- Demo ids should stay stable to preserve Playwright and report evidence.

## Permission And Audit Expectations

- Initialization for new workspaces should be server-owned or operator-owned, not arbitrary client-side mutation.
- Non-dispensing catalog rows use the approved catalog-management permission.
- Active hospital administrators and veterinarians may author workspace
  dispensing presets. Only an active veterinarian may approve or reject a
  hospital-created dispensing preset; administrator-veterinarians may
  self-approve.
- Future auto-merge should produce safe audit or system event metadata sufficient to answer which preset version changed which rows.
- Audit payloads must not include raw SOAP text, secrets, provider payloads, or unnecessary personal data.

## DEN-282 Implementation Notes

DEN-282 should focus on the smallest local-first slice:

1. Add or model source-tracking fields.
2. Create a deterministic system preset source or adapter.
3. Build an idempotent workspace catalog initialization function.
4. Add auto-add/auto-update behavior for unmodified rows.
5. Preserve customized rows.
6. Keep synthetic demo rows deterministic through persisted initialization and prove that missing/failed reads do not fall back to fixtures.
7. Add focused tests for idempotency, non-overwrite behavior, and deterministic demo data.

DEN-282 may write repo migration files and local/static tests if needed. It must not apply remote Supabase changes without explicit approval.

## Related Docs

### WP-02 local execution-field extension

The pending deployment migration `20260906084900` adds presence-aware per-field
execution baselines/conflicts. Untouched values and policies inherit; changed
workspace fields use dotted customization paths and survive source advancement.
Whole-object legacy markers remain protected until explicit source reconciliation.
Field keep/reset decisions require catalog CAS, source-revision agreement and the
existing management permission. No read-time default filling or historical snapshot
enrichment is introduced. New confirmed snapshots freeze per-field provenance.
See [WP-02 contract and evidence](../../work/clinical-master/order-execution-defaults/WP-02-execution-field-lineage-and-merge.md)
for the exact local verification and still-unverified remote acceptance boundary.

- [Workspace Order Catalog Platform](../../product/domain/workspace-order-catalog-platform.md)
- [Hospital Admin Order Catalog Schema Plan](../auth-security/auth-login/hospital-admin-order-catalog-schema-plan.md)
- [Order Fulfillment Handoff Engineering Contract](order-fulfillment-handoff-contract.md)
