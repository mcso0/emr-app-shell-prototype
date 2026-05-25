---
id: "DESIGN-SYSTEM-PR-028"
status: "human_review"
area: "design-system"
priority: "P0"
target_pr: "Project 13 / DEN-272"
linear: "DEN-272"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/table-sort-filter-behavior.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-027-billing-table-sort-filter-behavior.md"
dependencies:
  - "DEN-270"
  - "DEN-271"
updated: "2026-05-25"
---

# Chart Order Table Sort And Filter Behavior

## Goal

Apply the Project 13 real sort/filter behavior pattern to the chart/order table after the billing pilot.

## Scope

- Keep chart/order table headers focused on single-column sort only.
- Add real local sorting for stable order table columns: group, type, status, order name, billing name, quantity, unit price, amount, and veterinarian.
- Add a section-level Filter button in the order table action area.
- Keep the existing order type tabs as the primary type filter.
- Add a compact filter builder for status and veterinarian conditions.
- Compose multiple active filter rows with AND.
- Keep reset inside the filter dropdown footer, next to Close.
- Preserve order draft editing, quantity validation, selection, order update, order billing, order confirmation, chart workflow, mock auth, and session behavior.

## Out Of Scope

- Multi-sort.
- Header filter triggers.
- Save view, saved filters, URL persistence, localStorage persistence, Supabase persistence, migrations, RLS, or server-side sorting/filtering.
- Broad adoption across diagnosis, history, customer, billing, hospital admin, or every chart table.
- Changing DEN-270, DEN-271, or follow-up issue statuses.

## Implementation Notes

- Sorting/filtering stays local to `src/features/chart/module.tsx`.
- Sorting derives visible order row order and does not mutate order draft row identity or source arrays.
- Filtering narrows visible order rows after the existing order type tab filter.
- The selected order total and draft total remain based on the existing draft row data and selected order IDs.

## Verification

- `npm run lint`
- `npx tsc --noEmit`
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3103 npx playwright test tests/chart.spec.ts -g "chart order table supports single sort and section filter builder"`
- Browser QA with mock auth storage state and screenshot evidence.
- `npm run docs:check`

## Handoff Notes

Ready for Human Review as DEN-272. Follow-up implementation should continue with DEN-273 customer management table adoption after this chart/order pilot is accepted.
