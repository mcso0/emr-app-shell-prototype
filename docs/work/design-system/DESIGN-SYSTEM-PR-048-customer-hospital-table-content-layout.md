---
id: "DESIGN-SYSTEM-PR-048"
status: "human_review"
area: "design-system"
priority: "P0"
target_pr: "Project 공통 UX/UI 기준 정리 및 화면 적용 / DEN-442"
linear: "DEN-442"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/DESIGN.md"
  - "docs/design/system/tab-table-density-contract.md"
  - "docs/design/system/table-density-and-grid-ergonomics.md"
  - "docs/design/system/table-sort-filter-behavior.md"
  - "docs/completed/design/2026-06-07-customer-hospital-table-layout-proposal.html"
updated: "2026-06-08"
---

# Customer And Hospital Table Content Layout

## Goal

Apply the accepted customer/hospital table layout proposal so list pages share the same content hierarchy: page header, optional tab or scope row, shared table, and drawer detail.

## Scope

- Remove the extra card-like table title wrapper from customer table pages.
- Keep customer page headers focused on page identity and page actions.
- Move customer search and table display controls into a compact scope/control row above the table.
- Move hospital-admin Order search, status filters, density, and filter controls into the tab row's right side.
- Keep row click opening drawers and checkbox selection separate from drawer opening.
- Use the existing dispensing/treatment bulk-selection pattern for selected table rows.

## Out Of Scope

- New table library adoption.
- New customer delete/restore bulk workflows.
- Server/API sort, filter, query, or persistence contract changes.
- Live Supabase, migrations, RLS, server enforcement, production deploy, or real data access.

## Implementation Notes

- `src/features/customer/module.tsx` removes the rounded/shadowed inner table card and moves customer search/display controls into the table scope row.
- Customer pages without meaningful tabs use a compact scope summary, not fake tabs.
- `src/features/hospital-admin/module.tsx` keeps real section tabs on the left and moves search/status/billing/work-type/density/filter controls to the right side of that row.
- Customer checkbox selection now uses the checkbox `onCheckedChange` contract and reveals a small bottom bulk bar without opening the drawer.
- Existing row click still opens the detail drawer.

## Verification

- `npm run lint` passed with 5 pre-existing warnings outside this change.
- `npx tsc --noEmit` passed.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3010 npx playwright test tests/app-shell.spec.ts --grep "orders module renders|customer table uses|hospital order table keeps"` passed.
- `npm run docs:check` passed.

## Handoff Notes

Ready for Human Review.

Closeout: `docs/completed/design/2026-06-08-den-442-customer-hospital-table-layout-implementation.html`
