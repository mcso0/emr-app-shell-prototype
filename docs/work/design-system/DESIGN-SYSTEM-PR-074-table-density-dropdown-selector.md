---
id: "DESIGN-SYSTEM-PR-074"
status: implemented
area: design-system
priority: P1
target_pr: "User request / shared table-density dropdown selector"
source_docs:
  - "docs/design/system/DESIGN.md"
  - "docs/design/system/table-density-and-grid-ergonomics.md"
  - "docs/design/system/tab-table-density-contract.md"
  - "docs/design/system/component-ownership-rules.md"
updated: 2026-07-12
---

# Shared Table-Density Dropdown Selector

## Goal

Replace the icon-only density toggle group with a shared button that shows the
current density and opens the `좁게`, `기본`, `넓게` choice menu.

## Scope

- Update `EmrTableDensitySelector` only; preserve all existing callers and props.
- Reuse the existing density values, row-spacing icon, Button, and DropdownMenu radio primitives.
- Add Storybook and chart/order browser coverage.
- Update the density design-system contracts to make the selected-value dropdown the default.

## Out Of Scope

- Row/header height tokens, table data, selection, sorting, filtering, or toolbar placement changes.
- URL state, localStorage, saved views, server preferences, APIs, DB, RLS, permissions, or persistence.

## Done Criteria

- Trigger displays the active Korean density option, row-spacing icon, and downward chevron.
- Menu exposes all three density options as a single radio group and marks the active option.
- Existing caller-owned density state continues to update table spacing immediately.
- Storybook interaction test and focused chart/order Playwright coverage pass.
- Lint, TypeScript, documentation, and Storybook build verification pass.

## Verification

- `npx vitest run --project storybook src/components/emr/table-density-selector.stories.tsx`
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3111 npx playwright test tests/chart-order-table-density.spec.ts --reporter=line`
- `npm run lint`
- `npx tsc --noEmit`
- `npm run docs:check`
- `npm run build-storybook`

## Verification Results (2026-07-12)

- Passed: focused Storybook interaction and chart/order Playwright regression.
- Passed: lint, TypeScript, docs link check, production build, Storybook build, and diff check.
- Visual check: the Storybook preview showed the selected `좁게` trigger and all three radio-menu options with the active check state.
- Closeout: `docs/completed/design/2026-07-12-table-density-dropdown-selector-report.html`
