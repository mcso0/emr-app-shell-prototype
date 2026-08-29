---
id: "CLINICAL-MASTER-PR-020"
type: "Work Item"
title: "Workspace dispensing preset management and veterinarian approval"
description: "Adds project-aligned dispensing preset fields to the existing Order drawer, workspace-owned direct creation with veterinarian approval, two price modes, and immutable chart/fulfillment snapshots for every workspace."
status: "human_review"
area: "clinical-master"
priority: "P0"
tags: ["clinical-master", "dispensing", "hospital-admin", "workspace", "review", "pricing"]
target_pr: "Workspace dispensing preset management"
source_docs:
  - "docs/product/domain/workspace-order-catalog-platform.md"
  - "docs/product/domain/workspace-auth-permissions.md"
  - "docs/engineering/data-model/order-catalog-preset-initialization-contract.md"
  - "docs/work/clinical-master/CLINICAL-MASTER-PR-019-dispensing-service-review-pricing.md"
dependencies: ["CLINICAL-MASTER-PR-019"]
updated: "2026-08-29"
remote_writes: 0
---

# Clinical Master PR-020: Workspace dispensing preset management

## Goal

Keep the existing hospital-admin Order drawer structure while making a
dispensing row's dose, route, frequency, duration, dispense quantity,
administration timing, storage, compounding note, guardian instruction, and
price calculation visible and editable. Allow a hospital to create its own
workspace-only dispensing preset when no CLAiR master fits, but require an
active veterinarian to approve it before chart search can use it.

## Approved Product Decisions

- The feature is generic to every `workspaceId`. Cheongdam is a representative
  verification workspace, not a hard-coded product exception.
- Workspace admins and veterinarians may author a workspace dispensing preset.
- Only an active veterinarian may approve one. A veterinarian who is also an
  admin may approve their own preset; creator and reviewer facts remain in the
  audit history.
- A direct-created preset starts in `pending_review` and is excluded from chart
  search until approved. It never becomes a CLAiR global master automatically.
- Both quantity-linked price (`final dispense quantity × unit price`) and fixed
  prescription price are supported. The selected basis, inputs, and final
  amount are frozen on chart confirmation.
- Required dispensing fields cannot be removed. Optional instructions may be
  cleared. Automatic dispense quantity shows the formula; manual override
  requires a reason.
- Existing confirmed, dispensing, and billing snapshots are immutable. Catalog
  edits affect newly added chart orders only. Existing unconfirmed drafts are
  not silently overwritten.
- Hospital target species may be changed as a workspace operating choice; the
  UI must not present that as an expansion of CLAiR clinical review evidence.

## Scope

- Existing-drawer conditional dispensing fields and source/review explanation.
- Workspace catalog mapping and validation for `medicationMetadata` presets.
- Workspace-only direct creation, duplicate warning, review lifecycle, CAS,
  server/DB role enforcement, and audit facts.
- Quantity-linked and fixed pricing in admin, chart draft, confirmation,
  fulfillment, and billing snapshots.
- Field-aware preset merge for non-conflicting fields while preserving hospital
  overrides and surfacing conflicts.
- Focused unit, route, migration, browser, accessibility, and multi-workspace
  isolation verification.

## Out Of Scope

- Controlled-substance workflows.
- Automatic promotion of hospital-created rows into the CLAiR master.
- Claiming named-veterinarian review for the 108 synthetic CLAiR master rows.
- Real patient, guardian, staff, payment, or prescription data.
- Retrospective mutation of confirmed chart orders or active fulfillment work.

## Done Criteria

- A master dispensing row shows and saves all supported preset fields in the
  current drawer without changing unrelated Order detail layouts.
- A direct-created dispensing row is workspace-owned, starts pending, records
  creator/revision, and stays out of chart search until veterinarian approval.
- Admin-only approval is denied. Vet approval and admin+vet self-approval pass.
- Both price modes calculate correctly and freeze the same amount through chart,
  Task/Queue, dispensing/treatment, and billing readback.
- Two synthetic workspaces can create same-named local presets without reading
  or using each other's row.
- Cheongdam authenticated smoke verifies visible defaults, enabled approved row,
  chart defaults, explicit confirmation, and dispensing/treatment handoff.
- Focused tests, TypeScript, lint, docs check, production build, PR checks,
  `origin/main` merge, Ready deployment, and scoped production smoke pass.

## Rollback

1. Pause affected workspace-created rows; do not delete historical catalog or
   chart snapshots.
2. Disable the direct-create/review UI while keeping master preset reads.
3. Revert the application to the immediately preceding Ready deployment.
4. Verify chart search excludes pending rows and both comparison workspaces
   retain their original master/catalog counts.

## Implementation Result

- The existing Hospital Admin Order drawer now exposes dispensing-only source,
  review, dose, route, frequency, duration, total quantity, administration,
  storage, compounding, guardian instruction, and pricing fields without
  changing the unrelated Order drawer sections.
- Workspace admins and veterinarians can create a workspace-owned dispensing
  preset. The server owns its ID and lineage, starts it as pending, and excludes
  it from chart search until an active veterinarian approves it.
- The existing generic catalog create/update RPC names remain compatible for
  non-dispensing callers, but medication/dispensing creation is routed through
  the new pending-review writer. Renamed legacy create/update layers have no
  `authenticated` execution grant, preventing direct Data API calls from
  bypassing the veterinarian-review dispatcher.
- Workspace dispensing create, update/pause, and review now append a safe
  central `audit_events` row inside the same database transaction. Direct RPC
  calls cannot omit audit history, and the application skips its legacy
  follow-up audit call when the database reports `databaseAuditWritten=true`.
- Quantity-linked and fixed prescription prices now use the same selected
  pricing basis in the admin drawer, chart draft calculation, and frozen order
  snapshot. A confirmed order remains immutable when the catalog changes.
- The chart confirmation browser regression now verifies both the redirect to
  dispensing/treatment and the visible fulfillment work-item row for the same
  encounter.
- The implementation report remains available at the previously reviewed
  interactive artifact path and was rebuilt against the approved decisions.

## Verification Evidence

- `npx tsc --noEmit --pretty false` — passed.
- Focused Hospital Admin, chart default/edit, confirmation redirect, visible
  dispensing work-item, and existing drawer edit Playwright checks — 5/5 passed.
- Order-catalog permission, merge, audit, snapshot, and migration contract
  checks — 20/20 passed, including the legacy-RPC bypass guard.
- Broader Hospital Admin/fulfillment/audit run — 74/84 passed. The one
  newly-ambiguous switch locator was corrected and passed alone. The remaining
  failures reproduce existing suite drift outside this change, including the
  old fulfillment replay payload omitting the now-required idempotency key,
  stale 56px-versus-44px geometry assertions, and unrelated audit expectations.
- The new migration applied successfully to the local schema, and a rolled-back
  SQL transaction passed admin authoring, admin approval denial, veterinarian
  approval/use activation, server-owned ID, and cross-workspace denial.
- A remote read-only ACL preflight found the pre-existing generic create and A2
  update layers were executable by `authenticated`; the release candidate now
  revokes those internal grants and keeps only the guarded public wrappers.
  A local authenticated rollback replay proved a disguised medication
  classification still routes to pending review, all four renamed/internal
  writer calls are denied, non-dispensing creation remains compatible, and no
  probe row persists.
- A clean repository-wide `supabase db reset --no-seed` is currently blocked
  before this migration by the pre-existing `20260826160000` migration assuming
  remote-authored workspace/release rows. This migration itself introduces no
  new `db lint` finding after the explicit `text[]` cast repair.
- `npm run lint`, `npm run docs:check`, `npm run security:secrets`, and the
  interactive report build/contract test passed for the release candidate.

Remote Supabase migration application, PR preview, `origin/main` merge,
production deployment, and authenticated Cheongdam smoke are release-gate
actions and are intentionally not claimed by this pre-merge work item update.
