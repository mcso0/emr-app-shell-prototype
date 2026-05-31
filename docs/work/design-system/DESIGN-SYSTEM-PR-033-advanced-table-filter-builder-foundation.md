---
id: "DESIGN-SYSTEM-PR-033"
status: "done"
area: "design-system"
priority: "P0"
target_pr: "Project 13 / DEN-293"
linear: "DEN-293"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/DESIGN.md"
  - "docs/design/system/component-ownership-rules.md"
  - "docs/design/system/table-sort-filter-behavior.md"
  - "docs/design/system/ux-ui-research-before-implementation.md"
dependencies:
  - "DEN-270"
  - "DEN-276"
updated: "2026-05-26"
---

# Advanced Table Filter Builder Foundation

## Goal

Build a reusable advanced table filter builder foundation using CLAiR EMR components while keeping the internal filter state shaped like a query-builder model.

## Scope

- Create a reusable EMR table filter builder component under `src/components/emr/`.
- Create a pure model/helper layer for draft rules, active rule counting, AND filtering, and row filtering.
- Keep first-open behavior to one incomplete draft condition row.
- Count only completed field/operator/value rules as active filters.
- Ignore incomplete draft rules when filtering rows.
- Keep the initial model constrained to AND composition; broad OR or nested group behavior remains follow-up scope.
- Keep the UI foundation footer to `+ Add filter` and `Clear all`, with close handled by a top-right icon or parent popover dismissal.

## Out Of Scope

- Applying the builder to every Project 13 table screen.
- Saved views, saved filters, active chip rows, URL/localStorage/session persistence, or server-side filtering.
- Supabase, DB/RLS, migrations, live validation, production data, payment, email, external integrations, or role-policy changes.
- Changing the existing feature-specific filter builders outside the foundation proof.

## Implementation Notes

- Shared model helpers live in `src/components/emr/table-filter-builder-model.ts`.
- Shared UI foundation lives in `src/components/emr/table-filter-builder.tsx`.
- Consumers provide table-specific field configs so checkbox/action/display-only columns are not exposed as filters.
- Consumers should initialize popover/open state with `createInitialEmrTableFilterBuilderModel(...)` so the first visible state is a single draft row.
- `filterRowsByEmrTableFilterBuilder(...)` applies completed active rules with AND and leaves incomplete draft rows inert.

## Verification

- `npx tsc --noEmit`
- `npx eslint src/components/emr/table-filter-builder-model.ts src/components/emr/table-filter-builder.tsx tests/table-filter-builder-foundation.spec.ts`
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3107 npx playwright test tests/table-filter-builder-foundation.spec.ts`
- `npm run docs:check`

## Handoff Notes

Accepted and moved to Done in Linear as DEN-293. DEN-294 handles screen adoption.

Full `npm run lint` is currently blocked by an existing dirty-worktree lint error in `src/features/hospital-admin/module.tsx`; the new foundation files passed targeted ESLint.
