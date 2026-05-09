---
id: CHART-PR-003
status: done
area: chart
priority: P1
target_pr: PR 3
source_docs:
  - docs/engineering/current-status.md
  - docs/work/chart/CHART-PR-001-workspace-restructure.md
  - docs/work/chart/CHART-PR-002-soap-order-scroll-boundary.md
  - docs/design/reference-screen-index.md
dependencies:
  - CHART-PR-001
  - CHART-PR-002
updated: 2026-05-07
---

# Chart Safety MVP UX

## Goal

Reduce wrong-patient, chart completion, and order confirmation mistakes in the 진료(차트) workspace without changing live data or persistence behavior.

## PR Gate

- Goal: make the active patient, chart number, draft/autosave status, and selected order confirmation scope clearer during clinical work.
- PR-sized scope: chart workspace UX only, focused React changes, focused Playwright coverage, work/status/closeout docs.
- Out of scope: live DB/API persistence, audit log events, actual chart/order status transitions, large layout restructuring, repeated order recommendation.
- Done criteria: patient context and chart info show the chart number and guardian context; SOAP status includes last save time; chart completion and order bill/confirm actions show explicit confirmation dialogs; order bill/confirm actions require selected orders.
- Source docs: current MVP status, chart PR 1/2 work items, reference screen index, user-provided UX review.
- Verification: lint, TypeScript, chart/app-shell Playwright checks.
- Status/dependencies: done; depends on the existing chart workspace and SOAP/order scroll boundary work.
- Duplicate check: no existing chart safety UX work item was listed in `docs/work/index.md`.

## Scope

- Update `src/features/chart/module.tsx` only for chart UI behavior.
- Add explicit chart number and guardian context to active patient and chart info areas.
- Change SOAP save copy from generic save to draft save and show autosave time.
- Disable `Order 청구` and `Order 확정` until at least one order is selected.
- Add confirmation dialogs for chart completion and order bill/confirm actions using `EmrConfirmDialogContent`.
- Add Playwright regression coverage in `tests/chart.spec.ts`.

## Out Of Scope

- Mutating mock order status or SOAP status after confirmation.
- Adding backend, Supabase, audit, billing, or order workflow integration.
- Changing 조제/처치 screen behavior.
- Pixel-level alignment with a chart reference image; no chart binary reference asset is currently stored.

## Verification

- `npm run lint`
- `npx tsc --noEmit`
- `npx playwright test tests/chart.spec.ts tests/app-shell.spec.ts --reporter=line`

Completed on 2026-05-07. Closeout: `docs/completed/chart/2026-05-07-chart-safety-mvp-ux.md`.
