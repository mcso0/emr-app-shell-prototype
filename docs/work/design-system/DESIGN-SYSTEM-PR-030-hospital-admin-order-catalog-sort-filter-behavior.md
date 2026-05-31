---
id: "DESIGN-SYSTEM-PR-030"
status: "done"
area: "design-system"
priority: "P0"
target_pr: "Project 13 / DEN-274"
linear: "DEN-274"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/table-sort-filter-behavior.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-025-hospital-admin-order-catalog-table-shared-primitives.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-027-billing-table-sort-filter-behavior.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-028-chart-order-table-sort-filter-behavior.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-029-customer-table-sort-filter-behavior.md"
dependencies:
  - "DEN-270"
  - "DEN-271"
  - "DEN-272"
  - "DEN-273"
updated: "2026-05-25"
---

# Hospital Admin Order Catalog Sort And Filter Behavior

## Goal

Apply the Project 13 real sort/filter behavior pattern to the hospital admin order catalog table after the billing, chart/order, and customer table pilots.

## Scope

- Keep order catalog table headers focused on single-column sort only.
- Add real local sorting for stable order catalog columns:
  - standard order name.
  - in-hospital order name.
  - billing name.
  - sale price.
- Add a section-level Filter button in the order catalog action area.
- Add a filter builder for stable order catalog fields:
  - status.
  - target species.
  - service item type.
  - billing linkage.
  - sale price threshold.
- Compose multiple active filter rows with AND.
- Keep reset inside the filter dropdown footer with `Apply filters` and `Close`.
- Preserve category navigation, search, existing status/billing/work-type controls, row actions, row selection, detail drawer, mock auth, and session behavior.

## Out Of Scope

- Multi-sort.
- Header filter triggers.
- Save view, saved filters, active chip rows, URL persistence, localStorage persistence, Supabase persistence, migrations, RLS, or server-side sorting/filtering.
- Broad adoption across every hospital admin table or every customer/admin table.
- Pricing model changes, role policy changes, live validation, or DB enforcement.
- Changing DEN-270, DEN-271, DEN-272, DEN-273, or follow-up issue statuses.

## Implementation Notes

- Sorting/filtering stays local to `src/features/hospital-admin/module.tsx`.
- Sorting derives visible row order and does not mutate mock/session source arrays.
- Table filters narrow rows after existing category, search, status, billing, and work-type controls.
- Checkbox, action, display-only code, target summary, and memo/history columns remain static for this slice.

## Verification

- `npm run lint`
- `npx tsc --noEmit`
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3106 npx playwright test tests/hospital-admin.spec.ts -g "hospital admin order catalog supports single sort and section filter builder" --reporter=line`
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3106 npx playwright test tests/hospital-admin.spec.ts --reporter=line`
- Mock-auth Playwright screenshot evidence under `docs/completed/design/evidence/`.
- `npm run docs:check`

## Handoff Notes

Ready for Human Review as DEN-274. Follow-up work should continue with DEN-275 QA across the adopted table workflows after this hospital admin order catalog slice is reviewed.
