---
id: "HOSPITAL-ADMIN-LIVE-PR-019"
status: "human_review"
area: "hospital-admin"
priority: "P0"
target_pr: "Required workspace vitals and removable optional presets"
source_docs:
  - "docs/product/features/hospital-admin/workspace-vital-settings.md"
  - "docs/design/screens/hospital-admin/hospital-admin-settings-hub-ux.md"
  - "docs/engineering/data-model/patient-vital-measurements.md"
  - "docs/superpowers/plans/2026-07-22-workspace-vital-required-removal-ux.md"
dependencies:
  - "HOSPITAL-ADMIN-LIVE-PR-018"
updated: "2026-07-22"
---

# Required Workspace Vitals And Removal UX

## Goal

Keep weight and temperature permanently available in every workspace, let administrators remove optional preset rows without deleting patient history, and replace the current list-shaped reorder icon with a conventional accessible grip.

## Scope

- Curated `required_in_workspace` metadata for weight and temperature.
- Additive backfill and TypeScript/RPC enforcement for required presence and `enabled = true`.
- Six-dot grip with transparent hover, activator ref, and pointer/touch/keyboard ordering.
- `필수` metadata instead of disabled switches for weight and temperature.
- Optional-row `목록에서 제거`, toast undo, add-back, and save-confirmation summary.
- Reception/chart/history regression proof without measurement deletion or rewrite.

## Out Of Scope

- Mandatory patient measurement entry.
- Species ranges, warning thresholds, or clinical decision support.
- Custom workspace-defined vital types.

## Done When

- UI, server validation, and SQL RPC all prevent omission or disabling of weight and temperature.
- Optional presets can be disabled, removed, undone, added again, and saved with normalized order.
- Existing measurements are unchanged and become visible again after add-back.
- Grip, focus, menu, undo, and compact-screen behavior meet the linked implementation plan.
- Focused tests, local DB replay, lint, typecheck, build, docs, secret scan, and diff check pass or precisely document pre-existing failures.

## Verification

- `npx playwright test tests/workspace-vital-settings-model.spec.ts tests/workspace-vital-settings-server.spec.ts tests/workspace-vital-settings-migration.spec.ts --reporter=line`
- `npx playwright test tests/hospital-admin.spec.ts --grep "hospital vital settings" --reporter=line`
- Focused reception/chart vital tests.
- Local Supabase reset, rollback-only settings replay, and schema lint.
- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- `npm run docs:check`
- `npm run security:secrets`
- `git diff --check`

## Implementation Result

- Added `required_in_workspace` catalog metadata and enforced enabled weight/temperature in the parser, server boundary, and replacement RPC.
- Replaced the list icon with the installed Obra six-dot grip, kept hover transparent, and preserved pointer/touch/keyboard DnD semantics.
- Added optional-row removal, toast undo, add-back, and save-confirmation history copy without changing measurement rows.
- Added reception omission and chart history hide/re-add regression coverage.
- Local Supabase reset and rollback-only replay passed.
- The approved synthetic/demo remote migration was applied as `20260722130209_required_workspace_vitals`; catalog checks and the authenticated rollback-only replay confirmed required metadata, writer rejection, optional removal/re-add, front-desk denial, and unchanged measurement rows.
- Delivery PR #483 passed exact-candidate Release Check and Vercel Preview before the production merge gate.

## Verification Result

- Focused settings model/server/migration tests: passed.
- Hospital-admin interaction test: passed.
- Reception configured-vital test and chart history hide/re-add test: passed.
- Local DB reset and rollback-only permission/data-integrity replay: passed.
- TypeScript, ESLint, and production build: passed.
- DB lint reported only pre-existing findings outside the new vital-settings functions.
- Remote catalog and rollback-only transaction replay: passed; `patient_vital_measurements` remained at 9 rows before and after verification.
