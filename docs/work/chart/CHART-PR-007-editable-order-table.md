---
id: CHART-PR-007
status: done
area: chart
priority: P1
target_pr: PR 7
source_docs:
  - docs/engineering/current-status.md
  - docs/work/chart/CHART-PR-002-soap-order-scroll-boundary.md
  - docs/work/chart/CHART-PR-003-chart-safety-mvp-ux.md
  - docs/work/chart/CHART-PR-004-chart-operational-polish.md
dependencies:
  - CHART-PR-002
  - CHART-PR-003
  - CHART-PR-004
updated: 2026-05-13
---

# Chart Editable Order Table

## Goal

Add a first-pass, session-only editable order table to the 진료(차트) prescription/order area.

## PR Gate

- Goal: make order invoice cells editable enough to validate the intended data table direction without introducing a new grid dependency.
- PR-sized scope: chart order table only, session-only draft state, quantity/billing-name editing, row deletion, draft commit/reset controls, focused Playwright coverage, work/status/closeout docs.
- Out of scope: live Supabase persistence, server validation, audit log events, actual order confirmation/billing state mutation, broad reusable grid extraction, AG Grid/MUI Data Grid adoption.
- Done criteria: quantity can be edited in-cell; billing name can be edited in-cell; invalid quantities block update; row deletion uses confirmation; totals recalculate from draft rows; draft changes can be reset or committed for the current session.
- Source docs: current MVP status and existing chart order workspace work items.
- Verification: lint, TypeScript, chart Playwright checks, local browser smoke check.
- Duplicate check: no existing active chart editable order table item was listed in `docs/work/index.md`.

## Scope

- Keep shadcn `Table`, `Input`, `Button`, and `Dialog` composition.
- Add chart-local draft rows derived from order groups and invoice lines.
- Support editable `청구서명` and `수량` cells.
- Recalculate row amount, selected total, and order total from draft rows.
- Add row delete confirmation and remove deleted rows from selection.
- Add footer controls for `변경 취소` and `Order 업데이트`.
- Keep all mutations session-only and avoid implying server persistence.

## Out Of Scope

- Persisting draft order or invoice line changes to the mock domain store or backend.
- Updating billing workspace invoice state from chart order edits.
- Adding a reusable cross-module editable data-grid abstraction.
- Adding virtualization, sorting, column visibility, copy/paste, keyboard grid navigation, or undo history.
- Changing `Order 청구` or `Order 확정` server semantics.

## Verification

- `npm run lint`
- `npx tsc --noEmit`
- `npx playwright test tests/chart.spec.ts --reporter=line`
- Local Playwright smoke check at `/w/clair-demo/treatment?modulePanel=open&aside=closed&right=closed`

Completed on 2026-05-13. Closeout: `docs/completed/chart/2026-05-13-editable-order-table.md`.
