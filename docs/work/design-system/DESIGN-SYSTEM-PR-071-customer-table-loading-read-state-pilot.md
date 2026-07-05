---
id: "DESIGN-SYSTEM-PR-071"
status: "human_review"
area: "design-system"
priority: "P1"
target_pr: "User request / Customer table loading read-state pilot"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/DESIGN.md"
  - "docs/design/system/empty-info-state-contract.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-050-customer-hospital-table-content-layout.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-070-emr-empty-state-component-storybook.md"
updated: "2026-07-05"
---

# Customer Table Loading Read-State Pilot

## Goal

Separate customer-management table loading from true-empty table states so Cheongdam seed/API reads do not flash `0건` or no-data empty copy before the read resolves.

## Scope

- Add customer profile read status for the customer workspace and side panel.
- Show customer table skeleton rows during initial Cheongdam profile lookup.
- Keep existing rows visible during background loading when rows are already available.
- Preserve customer search, filter, density, row selection, and drawer behavior.
- Add focused customer/app-shell regression coverage.
- Record the table loading versus empty-state contract in the design-system source doc.

## Out Of Scope

- New customer list API routes or persistence boundaries.
- Broad table/data-grid component extraction.
- Hospital-admin behavior changes beyond keeping existing skeleton regression coverage passing.
- DB, Supabase migration, RLS, server enforcement, production deploy, remote validation, provider integration, or real data work.

## Done Criteria

- Initial customer profile read shows table skeleton rows instead of a no-data empty state.
- Side-panel and page-header customer counts do not show `0` as a resolved value while the initial read is unresolved.
- True-empty and filter-empty table states continue to use `EmrEmptyState` only after loading resolves.
- Customer table keeps a full-height table frame in the workspace.
- Focused lint, TypeScript, Playwright, and docs checks pass or any pre-existing failure is recorded.

## Verification

- `npx eslint src/features/customer/module.tsx tests/customer.spec.ts tests/app-shell.spec.ts`
- `npx tsc --noEmit`
- `npx playwright test tests/customer.spec.ts tests/hospital-admin.spec.ts --grep "customer|skeleton|hospital admin order table shows skeleton" --reporter=line`
- `npm run docs:check`

## Follow-Up Notes

- 2026-07-05: Added a pre-paint customer read-state sync so a stale SPA `ready` state with empty Cheongdam rows cannot briefly render the table empty copy before the lookup effect marks the read as loading.
