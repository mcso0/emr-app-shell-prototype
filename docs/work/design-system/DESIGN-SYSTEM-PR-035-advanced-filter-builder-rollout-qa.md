---
id: "DESIGN-SYSTEM-PR-035"
status: "human_review"
area: "design-system"
priority: "P0"
target_pr: "Project 13 / DEN-295"
linear: "DEN-295"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/table-sort-filter-behavior.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-033-advanced-table-filter-builder-foundation.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-034-advanced-filter-builder-table-adoption.md"
dependencies:
  - "DEN-293"
  - "DEN-294"
updated: "2026-05-26"
---

# Advanced Filter Builder Rollout QA

## Goal

Complete QA and documentation for the advanced filter builder rollout after the reusable foundation and first table adoption.

## Scope

- Verify the shared builder foundation model behavior.
- Verify the two DEN-294 adopted table screens: billing invoice lines and chart/order rows.
- Verify cross-table sort/filter QA still passes with the new shared builder on billing/chart and existing local builders on customer/admin.
- Record evidence paths, verification results, limitations, and follow-up boundaries.

## Out Of Scope

- Additional customer management or hospital admin migration.
- Full all-table rollout.
- Saved views, saved filters, active chip rows, URL/storage persistence, server-side filtering, Supabase, DB/RLS, migrations, or live validation.
- Fixing unrelated existing lint/test failures outside the advanced filter builder rollout.

## QA Notes

- The first-open state is one incomplete draft row.
- `Filter N` counts completed rules only.
- Incomplete rows are ignored by filtering.
- Reset returns the affected table to visible rows.
- Escape closes the filter popover.
- Browser evidence uses mock-auth workspace screens, not login.
- The shared select popup layer is above popover content so dropdowns remain clickable inside the builder.

## Evidence

- `docs/completed/design/evidence/2026-05-26-den-294-billing-advanced-filter-builder.png`
- `docs/completed/design/evidence/2026-05-26-den-294-chart-order-advanced-filter-builder.png`

## Verification

- `npx tsc --noEmit`
- DEN-295 related targeted ESLint command passed with existing chart warnings only.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3107 npx playwright test tests/table-filter-builder-foundation.spec.ts`
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3107 npx playwright test tests/billing.spec.ts -g "billing invoice line table supports single sort and section filter builder"`
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3107 npx playwright test tests/chart.spec.ts -g "chart order table supports single sort and section filter builder"`
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3107 npx playwright test tests/table-sort-filter-qa.spec.ts`
- `npm run docs:check`
- `git diff --check`

## Known Verification Caveats

- Full `npm run lint` is blocked by the existing dirty-worktree `src/features/hospital-admin/module.tsx:1848` React hooks lint error.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3107 npx playwright test tests/billing.spec.ts tests/chart.spec.ts` ran with 25 passed and 1 failed. The failure is `chart SOAP manual save persists through route-backed reload`, a SOAP route-backed save text mismatch outside this filter builder scope.

## Handoff Notes

Ready for Human Review as DEN-295. Future migration of customer/admin to the shared builder should be a separate scoped issue.
