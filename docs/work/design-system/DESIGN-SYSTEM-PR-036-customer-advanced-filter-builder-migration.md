---
id: "DESIGN-SYSTEM-PR-036"
status: "done"
area: "design-system"
priority: "P0"
target_pr: "Project 13 / DEN-296"
linear: "DEN-296"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/table-sort-filter-behavior.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-029-customer-table-sort-filter-behavior.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-033-advanced-table-filter-builder-foundation.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-034-advanced-filter-builder-table-adoption.md"
dependencies:
  - "DEN-273"
  - "DEN-293"
  - "DEN-294"
updated: "2026-05-26"
---

# Customer Advanced Filter Builder Migration

## Goal

Migrate the customer management table filter UI from its feature-local builder to the reusable `EmrTableFilterBuilder` while preserving the DEN-273 customer sort/filter behavior and customer workflow.

## Scope

- Replace the customer patient/guardian table local filter builder with the shared advanced builder model and UI.
- Keep customer table headers sort-only with single-column sorting.
- Keep the Filter button in the section action area and show `Filter N` from completed active rules only.
- Keep first-open behavior to one incomplete draft condition row.
- Ignore incomplete field/operator/value rows in filtering and active count.
- Preserve existing mock/session behavior, row selection, row actions, detail drawer routing, column visibility, density, and search behavior.
- Keep checkbox, action, phone, relationship summary, work summary, and other display-only columns out of filter field configs.

## Out Of Scope

- Hospital admin/order catalog advanced builder migration.
- Saved views, saved filters, active chip rows, URL/localStorage/session filter persistence, server-side filtering, Supabase, DB/RLS, migrations, or live validation.
- Customer workflow redesign or real customer data import.

## Implementation Notes

- `src/features/customer/module.tsx` now derives customer filter fields from column `filterValues` and `filterOptions`, then passes those fields to `EmrTableFilterBuilder`.
- Customer filters now auto-apply through `filterRowsByEmrTableFilterBuilder(...)`.
- The active Filter button count comes from `getEmrTableFilterBuilderActiveCount(...)`.
- Patient filter fields remain breed, sex, status, and message consent.
- Guardian filter fields remain consent summary.
- Existing single-column sort state and visible-row selection behavior are preserved.

## Evidence

- `docs/completed/design/evidence/2026-05-26-den-296-customer-advanced-filter-builder.png`

## Verification

- `npx eslint src/features/customer/module.tsx tests/customer.spec.ts`
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3108 npx playwright test tests/customer.spec.ts -g "customer patient table supports single sort and section filter builder" --reporter=line`
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3108 npx playwright test tests/customer.spec.ts --reporter=line`
- `npx tsc --noEmit` attempted; latest run is blocked by unrelated dirty-worktree type errors outside DEN-296.
- Mock-auth Playwright screenshot evidence under `docs/completed/design/evidence/`.
- `npm run docs:check`

## Known Verification Caveat

- Full `npm run lint` remains blocked by the pre-existing dirty-worktree React hooks lint error in `src/features/hospital-admin/module.tsx:1848`. Targeted ESLint for the changed customer files passed.
- Full `npx tsc --noEmit` is currently blocked by unrelated dirty-worktree type errors in billing/chart order server specs, including `tests/billing-invoice-candidate-sync-server.spec.ts` and `tests/chart-order-action-persistence-server.spec.ts`.

## Handoff Notes

Accepted by 승욱 and moved to Done in Linear as DEN-296 on 2026-05-26.
