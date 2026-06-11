---
id: "DEMO-DATA-PR-002"
status: "ready"
area: "demo-data"
priority: "P0"
target_pr: "TBD"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/product/demo-data/README.md"
  - "docs/product/demo-data/clinic-start-state-and-demo-operations-v1.md"
  - "docs/product/roadmap/product-mvp-scope.md"
dependencies:
  - "DEMO-DATA-PR-001"
updated: "2026-06-11"
---

# Clinic Start State and Demo Operations

## Goal

Define and implement the next demo-data baseline so the default portfolio workspace opens as a newly started clinic with realistic setup/master data, no pre-filled daily work, resettable state, date-correct behavior, and no stale mock flash.

## Background

승욱 wants the demo to start like a real newly opened hospital:

- staff, roles, workspace membership, patients, guardians, order catalog, and hospital-admin setup already exist
- order categories, order catalogs, order sets, lab items, pricing, and presets are prepared enough to feel like a real hospital setup
- active work does not already exist
- users can click around and create real workflow state
- stale May 2026 fixture data should not appear by default
- reset should make demos repeatable
- real-time day progression is preferred if previous-day work can remain visible without making the demo brittle

This is a portfolio/demo-readiness scope using synthetic data. It is not a real-data import, remote Supabase mutation, or production launch scope.

## Scope

- Audit current mock, fixture, seed, local-first, and API fallback sources used by main workspaces.
- Define the central demo date source and remove hardcoded stale daily work from the default path.
- Add or adapt the synthetic empty-clinic seed:
  - one workspace
  - users and role memberships
  - patient and guardian master records
  - order categories, order catalog, order sets, lab items, pricing examples, and admin presets
  - no active reception, appointment, encounter, fulfillment, or billing work by default
- Define reset behavior for returning to the empty clinic baseline.
- Ensure legacy fixtures, old log-style records, and stale dummy daily work do not appear in the default path.
- Preserve older Sales Demo fixture behavior only behind developer/test opt-in if still needed.
- Assess real-time day progression versus fixed review-date reset:
  - preferred: June 11 work remains available on June 12/13 via date picker or calendar views
  - fallback: fixed review date plus reset if multi-day state is too complex for this demo phase
- Add basic role-specific workflow checks for administrator, veterinarian, technician, front desk, and fulfillment staff:
  - administrator can review/manage almost everything, including sensitive settings
  - veterinarian can handle most clinical work but not sensitive hospital/security settings or restricted admin configuration
  - technician/front desk/fulfillment can view and act in their work areas but cannot edit veterinarian chart authority, order catalog/admin setup, or sensitive settings
- Reframe the audit-style surface as staff-readable `변경 이력` where this can be done without deep security expansion.
- Add first-pass empty/loading/error/validation UX hooks where stale fallback flashes occur.
- Verify cross-workflow status consistency for chart, fulfillment, and billing on the main golden path.
- Add a concise demo script that 승욱 can click through and judge manually.
- Add focused regression coverage for the empty baseline, demo date correctness, reset behavior, role smoke paths, and chart/fulfillment/billing readback.

## Out Of Scope

- Real patient, guardian, hospital, billing, identity, or payment data.
- Remote Supabase validation, mutation, migration push, or staging replay without explicit approval.
- Production deploy or production monitoring.
- Full production-grade RLS/security certification.
- Payment, email, KakaoTalk, PACS, device, accounting, or provider integrations.
- Scenario replay implementation in the first pass.
- Automatic long-running multi-day simulation before resettable baseline and date-history behavior are validated.
- Detailed visual redesign of empty/loading/error states beyond reliable first-pass UX hooks.
- Deep cross-workspace isolation work beyond basic demo confidence checks.

## Done Criteria

- The default demo workspace opens with master/setup data but no active daily work.
- Order categories, order catalog, order sets, patient/guardian master records, users, and roles are ready enough to support real workflow creation.
- Screens do not show stale May 2026 work by default on a current-date review.
- Data-source precedence is documented and implemented for touched surfaces.
- Reset restores the empty clinic baseline.
- The implementation decision for real-time day progression versus fixed review-date reset is recorded with rationale.
- Focused test setup can create a bounded outpatient workflow from the empty baseline.
- Role-specific smoke coverage verifies the main action boundaries for admin, vet, technician, front desk, and fulfillment staff.
- Chart, fulfillment, and billing status readback stay consistent on the covered golden path.
- Empty/loading/error/validation hooks prevent stale mock flash on touched screens.
- A first demo script exists for owner review.
- Documentation links point to the updated product source doc.

## Verification

- `npm run docs:check`
- `npm run lint`
- `npx tsc --noEmit`
- focused Playwright coverage for:
  - empty clinic baseline
  - demo date correctness
  - reset behavior
  - role-specific smoke paths
  - chart/fulfillment/billing status readback

## Approval Gates

Stop and ask 승욱 before:

- remote Supabase staging/live validation or mutation
- migration push or remote SQL/RLS work
- production deploy
- real hospital, patient, guardian, staff, billing, identity, or payment data
- provider/payment/email/KakaoTalk/PACS/device integration

## Notes

- Keep the implementation PR-sized. If the audit finds broad churn, split into:
  1. data-source/date audit and contract
  2. empty-clinic seed and reset
  3. loading/error/validation UX pass
  4. role, change-history, and golden-path QA

- Do not implement scenario replay in the first pass unless 승욱 separately approves that scope after the baseline exists.
