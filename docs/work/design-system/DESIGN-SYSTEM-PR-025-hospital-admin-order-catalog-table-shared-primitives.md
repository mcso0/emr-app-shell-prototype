---
id: "DESIGN-SYSTEM-PR-025"
status: "human_review"
area: "design-system"
priority: "P0"
target_pr: "Project 12 / DEN-269"
linear: "DEN-269"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/table-density-and-grid-ergonomics.md"
dependencies:
  - "DEN-250"
  - "DEN-251"
  - "DEN-264"
  - "DEN-265"
  - "DEN-266"
  - "DEN-267"
updated: "2026-05-24"
---

# Hospital Admin Order Catalog Table Shared Primitives

## Goal

Apply the DEN-264 shared table header and cell text primitives to the hospital admin Order catalog table only, extending the pilot policy to an admin/master-data table without widening adoption to every table.

## Scope

- Inspect the hospital admin Order catalog table structure and classify columns by role.
- Apply `EmrTableHeaderCell` to the hospital admin Order catalog table headers.
- Apply `EmrTableCellText` to scalar and long-name cells in the visible Order catalog rows.
- Keep scalar values one-line by default.
- Allow limited two-line text for high-meaning Order names: standard Order name, in-hospital Order name, and billing name.
- Exclude checkbox and row action columns from resize policy.
- Preserve hospital admin category navigation, search/filter controls, row selection, drawer open/edit/delete, row action menu, and mock/session behavior.
- Capture browser evidence with mock auth so the report shows the actual Order catalog table, not the login screen.

## Out Of Scope

- Broad table primitive adoption across all EMR tables.
- New sort, filter, column menu, resize, persistence, Supabase, DB/RLS, server enforcement, pricing, or role/permission behavior.
- Status changes for DEN-250, DEN-251, DEN-264, DEN-265, DEN-266, or DEN-267.

## Column Role Classification

| Column | Header interaction | Resize policy | Cell text policy |
| --- | --- | --- | --- |
| Select checkbox | `static` | `none` | control column |
| Type | `filterable` | `data-column` | badge/control content |
| Standard Order name | `sortable` | `data-column` | `two-line-if-long` |
| In-hospital Order name | `sortable` | `data-column` | `two-line-if-long` |
| Billing name | `sortable` | `data-column` | `two-line-if-long` |
| Status | `filterable` | `data-column` | `one-line` |
| Price | `sortable` | `data-column` | `one-line` |
| Target | `filterable` | `data-column` | `one-line` |
| Actions | `static` | `none` | action menu |

## Verification

- `npx eslint src/features/hospital-admin/module.tsx tests/hospital-admin.spec.ts`
- `npx tsc --noEmit`
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3079 npx playwright test tests/hospital-admin.spec.ts -g "shared header and cell text primitives"`
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3079 npx playwright test tests/hospital-admin.spec.ts`
- Browser QA for `/w/clair-demo/orders?modulePanel=open&aside=closed` with mock auth storage state.
- `npm run lint`
- `npm run docs:check`

## Handoff Notes

Ready for Human Review as DEN-269. This issue intentionally touches only the hospital admin Order catalog table and leaves previous DEN issue states unchanged.
