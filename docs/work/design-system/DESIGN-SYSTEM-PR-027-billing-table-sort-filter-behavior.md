---
id: "DESIGN-SYSTEM-PR-027"
status: "done"
area: "design-system"
priority: "P0"
target_pr: "Project 13 / DEN-271"
linear: "DEN-271"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/table-density-and-grid-ergonomics.md"
  - "docs/design/system/table-sort-filter-behavior.md"
dependencies:
  - "DEN-270"
updated: "2026-05-24"
---

# Billing Table Sort And Filter Behavior Pilot

## Goal

Implement the first real table sort/filter behavior pilot in the billing invoice line table, using the DEN-270 behavior contract.

## Scope

- Keep table headers focused on single-column sort only.
- Add real local sorting for billing invoice line scalar columns.
- Add a section-level Filter button in the billing invoice line table action area.
- Show active filter count on the Filter button as `Filter N`.
- Support a focused filter builder for invoice line category and amount conditions.
- Compose multiple active filter rows with AND.
- Keep reset inside the filter dropdown footer, next to Close.
- Preserve editable quantity inputs, billing totals, confirmation/payment dialogs, mock auth, and session behavior.

## Out Of Scope

- Multi-sort.
- Header filter triggers.
- Save view, saved filters, URL persistence, localStorage persistence, Supabase persistence, migrations, RLS, or server-side sorting/filtering.
- Broad adoption across chart/order, customer, hospital admin, or other tables.
- Changing DEN-270 or follow-up issue statuses.

## Implementation Notes

- Sorting/filtering stays local to `src/features/billing/module.tsx`.
- Sorting derives a visible row order and does not mutate invoice line source arrays.
- Filtering narrows visible invoice rows and keeps the invoice total based on the actual invoice lines, not the filtered view.
- Static/display-only concepts remain outside sorting/filtering.

## Verification

- `npm run lint`
- `npx tsc --noEmit`
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3101 npx playwright test tests/billing.spec.ts -g "billing invoice line table supports single sort and section filter builder"`
- Browser QA with mock auth storage state and screenshot evidence.
- `npm run docs:check`

## Handoff Notes

Ready for Human Review as DEN-271. Follow-up implementation should continue with DEN-272 chart/order table adoption only after this pilot is accepted.
