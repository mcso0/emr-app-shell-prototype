---
id: "DESIGN-SYSTEM-PR-031"
status: "done"
area: "design-system"
priority: "P0"
target_pr: "Project 13 / DEN-275"
linear: "DEN-275"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/table-sort-filter-behavior.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-027-billing-table-sort-filter-behavior.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-028-chart-order-table-sort-filter-behavior.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-029-customer-table-sort-filter-behavior.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-030-hospital-admin-order-catalog-sort-filter-behavior.md"
dependencies:
  - "DEN-270"
  - "DEN-271"
  - "DEN-272"
  - "DEN-273"
  - "DEN-274"
updated: "2026-05-25"
---

# Adopted Table Sort And Filter QA

## Goal

Run focused QA across the adopted Project 13 sort/filter tables before the final closeout issue.

## Scope

- Verify the billing invoice line table, chart/order table, customer management patient table, and hospital admin order catalog table.
- Verify accessible sort/filter labels, active sorted state visibility, section-level `Filter N` active state, keyboard close behavior, empty states, and reset behavior.
- Verify a representative narrow viewport for customer/admin table filter reachability.
- Capture mock-auth evidence screenshots from real workspace screens, not login.
- Document residual risks and excluded table families.

## Out Of Scope

- New table adoption.
- New saved view, saved filter, chip row, multi-sort, URL persistence, localStorage persistence, Supabase persistence, migrations, RLS, or server-side sort/filter behavior.
- Live Supabase validation, DB/RLS/server enforcement, production data validation, pricing model, or role policy changes.

## Implementation Notes

- Added `tests/table-sort-filter-qa.spec.ts` for cross-table QA coverage.
- Raised the shared popover positioner layer so filter popovers are not visually covered by shell chrome in narrow viewport QA.
- No new sort/filter behavior was added to additional tables.

## Verification

- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3107 npx playwright test tests/table-sort-filter-qa.spec.ts --reporter=line`
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3107 npx playwright test tests/billing.spec.ts tests/chart.spec.ts tests/customer.spec.ts tests/hospital-admin.spec.ts tests/table-sort-filter-qa.spec.ts --reporter=line`
- Mock-auth Playwright screenshot evidence under `docs/completed/design/evidence/`.
- `npm run lint`
- `npx tsc --noEmit`
- `npm run docs:check`

## Handoff Notes

DEN-275 moved to Done on 2026-05-25 after representative approval. The next Project 13 issue is DEN-276 final sort/filter behavior closeout.
