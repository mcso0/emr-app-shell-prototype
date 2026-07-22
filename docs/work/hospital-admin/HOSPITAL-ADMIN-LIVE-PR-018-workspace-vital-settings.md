---
id: "HOSPITAL-ADMIN-LIVE-PR-018"
status: "human_review"
area: "hospital-admin"
priority: "P0"
target_pr: "User-approved workspace vital settings V3"
source_docs:
  - "docs/product/features/hospital-admin/workspace-vital-settings.md"
  - "docs/engineering/data-model/patient-vital-measurements.md"
  - "docs/design/screens/hospital-admin/hospital-admin-settings-hub-ux.md"
dependencies:
  - "RECEPTION-QA-PR-011"
  - "CHART-PR-015"
  - "CHART-PR-016"
updated: "2026-07-22"
---

# Workspace Vital Settings

## Goal

Replace the static hospital-admin vital concept with a persisted workspace-wide vital configuration and apply the same enabled order and units to reception and chart vital entry.

## Scope

- Product preset and workspace configuration schema, RLS, member-read/admin-write RPCs, audit event, and safe default fallback.
- GET/PUT route with server session, workspace permission, payload validation, and mock fallback.
- Approved V3 hospital-admin screen with disabled-until-dirty header actions, reset icon, save confirmation, add dialog, unit controls, switches, and accessible library-backed drag ordering.
- Default weight, temperature, heart rate, and respiratory rate; optional blood-pressure addition.
- Canonical kg/°C storage with kg/g and °C/°F display/input conversion.
- Reception walk-in and chart waiting-vital consumers use saved enabled order and units.
- Heart-rate measurement persistence and systolic-only blood-pressure support.

## Out Of Scope

- Species normal ranges and warning automation.
- Custom workspace-defined vital types.
- Reservation-create vital entry.
- Remote real-customer data or external provider integration.

## Done When

- `hospital_settings:view` can read and `hospital_settings:manage` can replace one workspace configuration; cross-workspace and direct-write paths remain denied.
- Settings UI matches the approved V3 interaction contract and supports keyboard reordering.
- Reception and chart hide disabled fields and use saved order/units while keeping all fields optional.
- Existing measurement values are never deleted when a setting is disabled.
- Heart rate round-trips through walk-in/chart writes and current/prior chart reads.
- Systolic blood pressure saves without diastolic; diastolic without systolic is rejected.
- Focused model/server/migration/UI tests, lint, typecheck, build, docs, and secret checks pass.

## Verification

- `npx playwright test tests/workspace-vital-settings-*.spec.ts tests/patient-vital-server.spec.ts`
- `npx playwright test tests/hospital-admin.spec.ts tests/reception.spec.ts tests/chart.spec.ts`
- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- `npm run docs:check`
- `npm run security:secrets`
- `git diff --check`

## Result

- Implemented the persisted preset/workspace configuration, authenticated API, audit-emitting replacement RPC, and local mock boundary.
- Replaced the static concept with the approved V3 editor using dnd-kit pointer and keyboard sensors.
- Connected reception and waiting-chart entry/comparison to the same enabled order and display units.
- Added canonical unit conversion, heart-rate persistence, and systolic-only blood-pressure handling.
- Local Supabase full reset and rollback-only RPC readback passed. Remote migration application remains release-gated.
- A broader chart/reception batch was stopped after five unrelated existing chart failures and socket-listener accumulation warnings; all 43 focused affected tests passed.
