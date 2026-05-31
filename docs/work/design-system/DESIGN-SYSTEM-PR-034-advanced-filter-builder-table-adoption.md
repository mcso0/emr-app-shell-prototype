---
id: "DESIGN-SYSTEM-PR-034"
status: "done"
area: "design-system"
priority: "P0"
target_pr: "Project 13 / DEN-294"
linear: "DEN-294"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/table-sort-filter-behavior.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-033-advanced-table-filter-builder-foundation.md"
dependencies:
  - "DEN-293"
updated: "2026-05-26"
---

# Advanced Filter Builder Table Adoption

## Goal

Adopt the reusable advanced table filter builder from DEN-293 in real Project 13 table screens while preserving table sort behavior and existing mock/session workflows.

## Scope

- Replace the feature-local billing invoice line filter builder with the shared `EmrTableFilterBuilder`.
- Replace the feature-local chart/order filter builder with the shared `EmrTableFilterBuilder`.
- Keep table headers sort-only with single-column sorting.
- Keep the section action `Filter` button and `Filter N` active count.
- Apply only completed field/operator/value rules; incomplete draft rows remain inert.
- Keep first-open state to one draft rule row.
- Capture mock-auth evidence for actual billing and chart/order table screens.

## Out Of Scope

- Full all-table migration.
- Customer management and hospital admin table migration in this issue.
- Saved views, saved filters, active chip rows, URL/localStorage/session persistence, server-side filtering, Supabase, DB/RLS, migrations, or live validation.
- Changing SOAP, order draft persistence, billing confirmation, customer/admin workflows, or route behavior.

## Implementation Notes

- Billing now configures fields for `업무` and `청구금액`.
- Chart/order now configures fields for `상태` and `수의사`.
- Both screens use the shared model helpers for active count and AND row filtering.
- `src/components/ui/select.tsx` raises select popup layering above popover content so builder select menus remain clickable inside filter popovers.
- Customer/admin still use their previously implemented feature-local builders and should be migrated in a follow-up issue if broad adoption remains desired.

## Verification

- `npx tsc --noEmit`
- `npx eslint src/components/ui/select.tsx src/components/emr/table-filter-builder-model.ts src/components/emr/table-filter-builder.tsx src/features/billing/module.tsx src/features/chart/module.tsx tests/billing.spec.ts tests/chart.spec.ts tests/table-filter-builder-foundation.spec.ts tests/table-sort-filter-qa.spec.ts`
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3107 npx playwright test tests/table-filter-builder-foundation.spec.ts`
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3107 npx playwright test tests/billing.spec.ts -g "billing invoice line table supports single sort and section filter builder"`
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3107 npx playwright test tests/chart.spec.ts -g "chart order table supports single sort and section filter builder"`
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3107 npx playwright test tests/table-sort-filter-qa.spec.ts`
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3107 npx playwright test tests/billing.spec.ts tests/chart.spec.ts` ran; 25 passed and 1 unrelated SOAP persistence test failed.
- `npm run docs:check`
- `git diff --check`

## Handoff Notes

Accepted and moved to Done in Linear as DEN-294. Full `npm run lint` remains blocked by the pre-existing dirty-worktree `src/features/hospital-admin/module.tsx:1848` React hooks lint error.
