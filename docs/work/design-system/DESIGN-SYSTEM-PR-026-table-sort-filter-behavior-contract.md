---
id: "DESIGN-SYSTEM-PR-026"
status: "done"
area: "design-system"
priority: "P0"
target_pr: "Project 13 / DEN-270"
linear: "DEN-270"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/table-density-and-grid-ergonomics.md"
  - "docs/design/system/table-sort-filter-behavior.md"
dependencies:
  - "DEN-250"
  - "DEN-251"
  - "DEN-264"
updated: "2026-05-24"
---

# Table Sort And Filter Behavior Contract

## Goal

Define the real sort/filter behavior contract for Project 13 before implementing selected EMR data grids.

## Scope

- Review Project 12 header/cell primitive outcomes and preserve their scope boundaries.
- Define sortable column requirements: sort key, data type, empty handling, stable tie-breaker, reset behavior, and active visual state.
- Define filterable column requirements: filter key, option source, active state, empty state, clear/reset behavior, and composition with search.
- Define state policy for the first implementation slices.
- Define keyboard/accessibility expectations.
- Pick the first pilot table and explain why it is safe.
- Add an interactive HTML prototype options report with multiple sort/filter UI directions.
- Record the follow-up implementation order for DEN-271 through DEN-276.

## Out Of Scope

- Implementing actual sort/filter behavior.
- Broad adoption across all EMR tables.
- URL, localStorage, Supabase, RLS, migrations, payment provider, or server-side persistence behavior.
- Changing existing Project 12 Linear issue statuses.

## Implementation Notes

- The behavior contract lives in `docs/design/system/table-sort-filter-behavior.md`.
- The interactive prototype options report lives in `docs/completed/design/2026-05-24-den-270-sort-filter-prototype-options.html`.
- The first implementation pilot should be the billing invoice table (`DEN-271`) because it can prove row identity, amount, and total preservation before chart/order adoption.
- Chart/order, customer management, and hospital admin order catalog adoption stay as separate follow-up issues.

## Verification

- `npm run docs:check`

## Handoff Notes

Ready for Human Review as DEN-270. The next implementation issue is DEN-271.
