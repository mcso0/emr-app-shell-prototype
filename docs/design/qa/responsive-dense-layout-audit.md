---
status: "active"
updated: "2026-05-20"
linear_issue: "DEN-146"
linear_project: "09 시각 QA 및 인터랙션 품질 게이트"
source_docs:
  - "docs/design/qa/core-workspace-ui-review-checklist.md"
  - "docs/design/system/ui-refactor-dod.md"
  - "docs/engineering/current-status.md"
---

# Responsive Dense Layout Audit

This audit records the current responsive and dense-table baseline for the UI/UX refactor initiative.

## Covered Surfaces

- App Shell chrome: nav rail, workspace tabs, command palette, top controls.
- Dense clinical tables: chart order table, lab result table, imaging order table, billing invoice lines.
- Operational admin tables: inpatient ward table, customer guardian/patient tables, hospital order catalog, workspace membership table.
- Form-heavy auth/workspace surfaces from Project 07.

## Current Baseline

- Shared `Table` wraps content in horizontal overflow by default; feature modules add explicit minimum table widths when columns should not be crushed.
- Chart order table uses a `min-w-[1160px]` fixed table with truncation and title attributes on dense clinical columns.
- Lab result and imaging tables use horizontal overflow with minimum widths, preserving analyte/order readability.
- Billing invoice lines use a `min-w-[720px]` fixed table and right-aligned tabular amount cells.
- Customer management uses table mode-specific minimum widths for guardian and patient lists.
- Inpatient, hospital admin, and workspace membership tables use minimum-width table contracts instead of compressing all columns into narrow viewports.
- Global command palette uses `w-[min(720px,calc(100vw-32px))]`, preserving dialog containment on narrow screens.
- Workspace tabs and command launcher use truncation and max-width caps to prevent tab text from pushing shell controls out of view.

## Intentional Exceptions

- `src/features/inpatient/module.tsx` keeps `min-w-[1180px]` for ward rows because diagnosis, memo, cautions, and care actions need stable scanning.
- `src/features/hospital-admin/module.tsx` keeps `min-w-[1060px]` and local column recipes for catalog operations.
- `src/features/auth/workspace-membership-management.tsx` keeps `min-w-[820px]` so email, role, status, permission summary, title/department, and actions remain readable.
- `src/features/customer/module.tsx` keeps wider patient/guardian table widths because master-data rows include identifiers, contact details, notes, and relationship context.
- Some icon dimensions and fixed chrome widths are asset/alignment constraints rather than responsive defects.

## Gaps And Follow-Up Candidates

- Dense table acceptance should include visual browser captures at desktop and narrow widths before final initiative sign-off.
- Sticky selection bars, sticky table headers, and drawer footers should be manually checked for overlap on smaller laptop heights.
- Wide customer and chart tables are currently usable through overflow, but long Korean labels should be sampled with real hospital data before pilot.
- Inpatient filters use a `min-w-[360px]` search cluster; check narrow route behavior before broad release.
- Feature-local drawers use several `max-h-[calc(100vh-5rem)]` dialog contracts; final QA should verify footer and field visibility on shorter viewports.

## Acceptance Guidance

- Prefer horizontal overflow for information-dense tables over compressing clinical or billing columns.
- Use truncation only when the full value is available through row context, title text, drawer detail, or a natural drill-in.
- Block regressions where text overlaps adjacent controls, sticky footers cover fields, or primary actions become unreachable.
- Treat viewport-specific refinements as follow-up when the current issue preserves the existing workflow and does not introduce clipping.
