---
id: "CHART-PR-021"
status: "implemented"
area: "chart"
priority: "P0"
target_pr: "User request / Figma chart contents V2 fidelity"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/DESIGN.md"
  - "docs/design/system/component-ownership-rules.md"
  - "docs/design/system/ui-refactor-dod.md"
  - "docs/work/chart/CHART-PR-019-figma-exact-chart-screen.md"
  - "docs/work/chart/CHART-PR-020-collapsible-clinical-panels.md"
dependencies:
  - "CHART-PR-019"
  - "CHART-PR-020"
result_report: "docs/completed/chart/2026-08-13-chart-pr-021-chart-contents-v2-report.html"
updated: "2026-08-13"
---

# Chart Contents V2 Fidelity

## Goal

Bring only the chart/treatment contents workspace into pixel-level alignment with Figma section `27946:60564`, while preserving the current application data, API, persistence, permission, and consultation contracts.

## Scope

- Keep the patient information bar, global navigation, top bar, module side panel, and shell-level aside out of the implementation boundary.
- Match the 1540 × 968 contents composition: 48px action bar and 1540 × 920 workspace.
- Match the workspace inner geometry: 8px horizontal inset, 8px bottom inset, 452px top row, 8px resizer, and 452px Plan/Order row.
- Match the expanded clinical panel tracks to 566.5px S/O, 566.5px Assessment, and 375px History at the reference width, while preserving 8px gaps and the existing 46px collapsed rails.
- Keep panel action groups hidden at rest and visible on panel hover, keyboard focus-within, and non-hover/coarse-pointer environments.
- Reuse the current live/demo chart bundle, SOAP, diagnosis, history, Order draft/action, billing, and permission boundaries instead of Figma placeholder data.
- Implement Plan/Order as a 394px pinned region plus a horizontally scrollable detail region at the reference width, using the shared TanStack `EmrDataTable` primitives.
- Use the existing shadcn `Skeleton` component for loading states; do not introduce a custom pulse/skeleton implementation.
- Cover empty, loading, partial loading, error, permission-denied, overflow, reduced-motion, keyboard, and narrow viewport states.

## Out Of Scope

- Figma dummy copy or fake records replacing the current application data.
- Schema, migration, RLS, API contract, permission, billing, consultation lifecycle, or Supabase changes.
- Patient context bar, global navigation, shell top bar, module list panel, or shell History aside changes.
- New workflow semantics for Figma-only buttons that have no current application owner.
- Persisting local panel geometry across sessions.

## Element Plan

### IMP-001 Baseline and current-data fixture

- Record the current 1540 × 1024 chart fixture and retain its actual `kong-vomit` scenario data.
- Assert content bounds independently from the excluded patient bar and shell surfaces.
- Treat the preconsultation lock as the existing route/data gate; do not present an active-chart empty state before that gate resolves.

### IMP-002 Action bar, workspace, and resizer geometry

- Preserve the existing 48px action bar and current encounter metadata/actions.
- Apply the Figma workspace inner bounds and 452/8/452 default row split.
- Preserve pointer and keyboard resize behavior, minimum heights, focus visibility, and reduced motion.

### IMP-003 S/O panel

- Preserve mounted SOAP editor state, current tabs, save state, and actions.
- Keep contextual panel actions on hover/focus/touch.
- Align the 38px header, 44px tab toolbar, padding, typography, border, radius, and empty editor presentation to Figma.

### IMP-004 Assessment and History

- Assessment continues to use current diagnosis rows, search, add/remove, type, primary, save, and permission behavior.
- History continues to use current encounter history and selection; it remains independent from the shell History aside.
- Match each panel's 38px header, 44px toolbar, table/empty-state surface, and reference-width track.

### IMP-005 Plan/Order pinned and scroll regions

- Use the shared `EmrDataTable` and TanStack column pinning.
- Pin checkbox, classification, status, and Order identity columns into a 394px reference-width region.
- Keep group, instruction, billing name, quantity, price, amount, veterinarian, and row actions in the horizontally scrollable region.
- Preserve sorting, resizing, selection, draft editing, persistence, billing candidates, lifecycle actions, and scroll containment.

### IMP-006 State matrix

- Initial loading: shared shadcn `Skeleton` through `EmrDataTable` or feature-local compositions of that primitive.
- Partial loading: preserve already rendered current data and show a non-blocking pending state.
- Empty: use `EmrEmptyState` with current application semantics and a valid recovery action where one exists.
- Error/permission: preserve current inline alert, retry, disabled-write, and denial behavior without optimistic fake success.
- Overflow/responsive: keep horizontal scrolling at narrow widths; do not compress clinical or Order columns below their safe minimums.

### IMP-007 Verification and result report

- Focused Playwright assertions for pixel geometry, hover/focus action disclosure, pinned/scroll behavior, real fixture data, empty/loading/error boundaries, keyboard resizing, collapse state, and narrow overflow.
- Run focused ESLint, TypeScript, Playwright, docs link, secret scan, and diff checks.
- Produce the Korean HTML result report with before/after captures and traceable command evidence.

## Approval Boundaries

- The user approved the contents-only implementation, exact Figma UI/UX, current application data, contextual header actions, shadcn Skeleton loading, and the 394px pinned plus 1128px scroll Plan/Order layout.
- Preserve existing behavior for any Figma-only control until its product/API owner is defined; render such controls only through the repository's existing unavailable/disabled pattern.
- If a later phase requires changing consultation, billing, admission, combined tab, or completion semantics, stop that phase and ask before expanding scope.

## Done Criteria

1. The reference viewport matches the Figma contents geometry within browser subpixel rounding.
2. Current chart data and existing APIs remain the source of content; no Figma dummy records are introduced.
3. S/O, Assessment, and History keep their current editing, persistence, selection, and collapse contracts.
4. Plan/Order exposes a 394px pinned identity region and independently scrollable detail columns without page-level horizontal overflow.
5. Loading uses the repository shadcn `Skeleton`; empty, error, permission, partial-load, narrow, and reduced-motion states are covered.
6. Focused behavior and visual checks pass and the result report records any remaining product decision explicitly.

## Verification Plan

- `npx eslint src/features/chart/module.tsx src/features/chart/components/chart-collapsible-panel-group.tsx src/features/chart/components/chart-figma-workspace.tsx src/components/emr/emr-data-table.tsx tests/chart.spec.ts`
- `npx tsc --noEmit`
- Focused `tests/chart.spec.ts` geometry, collapse, data, loading, and Plan/Order scroll tests.
- `npm run docs:check`
- `npm run security:secrets`
- `git diff --check`

## Implementation Result

- The contents-only reference fixture is now `1540 × 968`, independently measured from the excluded patient context bar and shell chrome.
- The workspace defaults to `452px / 8px / 452px` rows with an 8px horizontal and bottom inset.
- Expanded clinical panel tracks use the Figma `566.5 / 566.5 / 375` ratio, with 46px collapsed rails and existing mounted-state preservation.
- Panel surfaces share the 8px radius, hairline border, and `shadow-xs` contract; action groups remain contextual on hover/focus and available on touch input.
- Plan/Order uses TanStack column pinning with a `28 + 80 + 88 + 198 = 394px` fixed identity region. Remaining current-data columns stay horizontally scrollable.
- Loading states compose the existing shadcn `Skeleton`. Assessment, History, and Order empty states use `EmrEmptyState`; live-queue denial and SOAP/diagnosis/Order errors retain explicit recovery guidance.
- No Figma dummy records, schema changes, API changes, permission changes, or shell/patient-bar changes were introduced.

## Verification Result

- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3100 npx playwright test tests/chart.spec.ts --reporter=dot`: 40/40 passed on a fresh development server.
- Focused Figma geometry, panel chrome, pinned/scroll, collapse, permission, and shadcn Skeleton tests: 6/6 passed.
- Focused ESLint and `npx tsc --noEmit`: passed.
- `npm run build`: passed with the repository's existing NFT tracing warning.
- `npm run docs:check`, `npm run security:secrets`, `npm run ux-copy:check`, and `git diff --check`: passed.
- Result report: `docs/completed/chart/2026-08-13-chart-pr-021-chart-contents-v2-report.html`.

## Remaining Risks

- The development server still logs the pre-existing Tiptap duplicate extension and MaxListeners warnings during the long chart suite. They did not fail the fresh 40-test run and are outside this contents-only scope.
- Remote delivery, merge, deployment, and production smoke evidence are tracked separately from this implementation verification; do not infer them from the local result report.
