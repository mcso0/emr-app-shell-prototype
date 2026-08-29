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
last_updated: 2026-08-29
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
- keep Sales Demo and mock fallback paths deterministic

Remote Supabase migration push, remote RLS replay, production deploy, and real hospital data import remain approval-gated.

## Data Families

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
- The Sales Demo workspace must remain deterministic.
- Mock fallback should still work when no live workspace catalog rows are available.
- Existing `defaultOrderCatalogItems` can remain the local fixture source until DEN-282 wires an explicit system preset catalog.
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
6. Keep mock fallback and Sales Demo paths working.
7. Add focused tests for idempotency, non-overwrite behavior, and deterministic demo data.

DEN-282 may write repo migration files and local/static tests if needed. It must not apply remote Supabase changes without explicit approval.

## Related Docs

- [Workspace Order Catalog Platform](../../product/domain/workspace-order-catalog-platform.md)
- [Hospital Admin Order Catalog Schema Plan](../auth-security/auth-login/hospital-admin-order-catalog-schema-plan.md)
- [Order Fulfillment Handoff Engineering Contract](order-fulfillment-handoff-contract.md)
