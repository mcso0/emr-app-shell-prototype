---
id: "DESIGN-SYSTEM-PR-029"
status: "done"
area: "design-system"
priority: "P0"
target_pr: "Project 13 / DEN-273"
linear: "DEN-273"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/table-sort-filter-behavior.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-024-customer-table-shared-primitives.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-027-billing-table-sort-filter-behavior.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-028-chart-order-table-sort-filter-behavior.md"
dependencies:
  - "DEN-270"
  - "DEN-271"
  - "DEN-272"
updated: "2026-05-25"
---

# Customer Table Sort And Filter Behavior

## Goal

Apply the Project 13 real sort/filter behavior pattern to the customer management table after the billing and chart/order pilots.

## Scope

- Keep customer table headers focused on single-column sort only.
- Add real local sorting for stable customer table columns:
  - patient table: patient code, patient name, birth date/age, and registration date.
  - guardian table: guardian name and registration date.
- Add a section-level Filter button in each customer table action area.
- Add a filter builder for stable categorical customer fields:
  - patient table: breed, sex, status badges, and message consent.
  - guardian table: consent summary.
- Compose multiple active filter rows with AND.
- Keep reset inside the filter dropdown footer with `Apply filters` and `Close`.
- Preserve search, detail drawers, row selection, row actions, column visibility, density, mock auth, and session behavior.

## Out Of Scope

- Multi-sort.
- Header filter triggers.
- Save view, saved filters, URL persistence, localStorage persistence, Supabase persistence, migrations, RLS, or server-side sorting/filtering.
- Broad adoption across hospital admin order catalog or every customer/admin table.
- Real customer data import or role/permission policy changes.
- Changing DEN-270, DEN-271, DEN-272, or follow-up issue statuses.

## Implementation Notes

- Sorting/filtering stays local to `src/features/customer/module.tsx`.
- Sorting derives visible row order and does not mutate mock/session source arrays.
- Filtering narrows visible rows after the existing customer search query.
- Checkbox, action, phone, and compound relationship/work-summary columns remain display/static for this slice.

## Verification

- `npm run lint`
- `npx tsc --noEmit`
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3104 npx playwright test tests/customer.spec.ts -g "customer patient table supports single sort and section filter builder" --reporter=line`
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3104 npx playwright test tests/customer.spec.ts --reporter=line`
- Mock-auth Playwright screenshot evidence under `docs/completed/design/evidence/`.
- `npm run docs:check`

## Handoff Notes

Ready for Human Review as DEN-273. Follow-up implementation should continue with DEN-274 hospital admin order catalog adoption only after this customer table slice is reviewed.
