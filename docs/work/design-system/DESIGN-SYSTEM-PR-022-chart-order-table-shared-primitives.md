---
id: "DESIGN-SYSTEM-PR-022"
status: "human_review"
area: "design-system"
priority: "P0"
target_pr: "Project 12 / DEN-265"
linear: "DEN-265"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/DESIGN.md"
  - "docs/design/system/component-ownership-rules.md"
  - "docs/design/system/table-density-and-grid-ergonomics.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-021-shared-table-header-cell-text-primitives.md"
dependencies:
  - "DEN-250"
  - "DEN-251"
  - "DEN-264"
updated: "2026-05-24"
---

# Chart/order Table Shared Primitive Adoption

## Goal

Apply the DEN-264 `EmrTableHeaderCell` and `EmrTableCellText` primitives to the chart/order dense clinical table without broad table migration or new sort/filter behavior.

## Scope

- Inspect chart/order table structure and classify column roles.
- Apply `EmrTableHeaderCell` to chart/order table headers.
- Apply `EmrTableCellText` to chart/order table text cells.
- Keep scalar values one-line by default.
- Allow limited two-line preview only for high-value long clinical text such as order names and diagnosis names.
- Keep checkbox, action, and display-only columns out of resize affordance scope.
- Preserve chart workflow, order draft editing, order confirmation, mock auth, and session behavior.

## Out Of Scope

- Whole-app table migration.
- New live sort or filter behavior.
- New data grid library adoption.
- Supabase validation, DB migration, RLS, server enforcement, or role-policy changes.
- Moving DEN-250, DEN-251, DEN-264, or other Linear issues to Done.

## Verification

- `npm run lint`
- `npx tsc --noEmit`
- Focused Playwright for chart/order workflow
- Browser QA with mock auth and chart/order table evidence screenshot
- `npm run docs:check`

## Handoff Notes

Ready for Human Review as DEN-265. The implementation stays limited to chart/order table primitive adoption, with evidence and closeout at `docs/completed/design/2026-05-24-den-265-chart-order-table-shared-primitives-report.html`.
