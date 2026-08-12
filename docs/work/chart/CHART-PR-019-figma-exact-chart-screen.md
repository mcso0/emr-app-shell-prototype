---
id: "CHART-PR-019"
status: "implemented"
area: "chart"
priority: "P0"
target_pr: "User request / Figma-exact chart workspace implementation"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/DESIGN.md"
  - "docs/design/qa/core-workspace-ui-review-checklist.md"
  - "docs/design/qa/responsive-dense-layout-audit.md"
  - "docs/work/chart/CHART-PR-006-soap-editor-ux-foundation.md"
  - "docs/work/chart/CHART-PR-007-editable-order-table.md"
dependencies:
  - "CHART-PR-006"
  - "CHART-PR-007"
updated: "2026-08-12"
---

# Figma-exact Chart Workspace

## Goal

Implement the approved Figma chart workspace at node `27946:58868` with source-matched geometry and visual hierarchy while preserving the current chart data, permission, persistence, and consultation workflow contracts.

## Scope

- Match the `1540 x 1024` source frame for the chart patient context bar, action bar, three-column clinical workspace, and order workspace.
- Reuse repository tokens and documented shared components where their contracts match the source; keep chart-only composition feature-local.
- Preserve current SOAP editing, assessment, encounter history, order editing, chart completion, and local-first/live handoff behavior.
- Represent unavailable source actions as disabled controls with a `준비 중` explanation instead of inventing workflows.
- Add deterministic, synthetic, test-only visual-regression fixture coverage without replacing runtime data.
- Cover loading, empty, error, partial data, long content, large order sets, invalid/deleted encounters, no-result filtering, rapid patient switching, double submission, offline/stale state, narrow viewport fallback, 200% zoom, keyboard use, and reduced motion.

## Out Of Scope

- Schema, migration, API, RLS, permission, billing, inpatient, PACS, care-guide, or result-analysis workflow changes.
- New shared design-system APIs without a second proven caller and an approved reusable contract.
- Replacing runtime chart records with fixture data.
- Fixed-staging alias changes, environment/secret changes, schema or live-data operations. The later user-authorized release request is handled through the repository production gate without broadening the feature scope.

## Done Criteria

1. The default chart surface matches Figma node `27946:58868` at `1540 x 1024`, including the 56px patient bar, 48px chart action bar, three equal clinical columns, and order region.
2. Existing chart read/write, encounter selection, consultation completion, order editing, and persistence contracts remain functional.
3. Unsupported source actions are visibly unavailable and explain `준비 중`; no placeholder action mutates data.
4. The implementation uses existing tokens/components where compatible and keeps new chart-specific composition small, typed, and feature-local.
5. Focused type, lint, browser, edge-state, responsive, accessibility, and visual-comparison checks pass or have an evidence-backed baseline explanation.
6. The standalone implementation report is synchronized with implementation evidence and remaining gaps.

## Verification Plan

- Capture the Figma source and implementation at the exact `1540 x 1024` viewport and compare geometry and visible differences.
- Exercise the 20-state matrix recorded in the standalone implementation report, prioritizing unsafe and high-frequency transitions.
- Run focused chart TypeScript/ESLint checks and existing chart browser regression coverage.
- Verify keyboard focus, 200% zoom, narrow fallback, reduced motion, table overflow, and unavailable-action messaging.
- Run repository docs and secret checks for the final local slice.

## Implementation

- Added `ChartPatientContextBar`, `ChartActionBar`, `ChartWorkspacePanel`, and panel action primitives in one chart-local component module. Existing shared tokens, button, tooltip, avatar, memo, table, and editor contracts remain the source of behavior.
- Replaced the chart body with the Figma 56px patient bar, 48px action bar, equal Subject/Object · Assessment · History columns, and Plan/Order workspace while preserving existing chart data and mutation handlers.
- Kept unsupported admission, care-guide, analysis, PACS, search/filter, maximize, and overflow actions visible in their Figma positions but disabled with a keyboard-reachable `준비 중` explanation.
- Added a deterministic Kong scenario screenshot baseline. The browser viewport is `1622 × 1086`, which yields the Figma-source chart workspace element at exactly `1540 × 1024`; runtime data remains unchanged outside tests.
- Updated only the chart and app-shell assertions affected by moving History inline and separating patient/guardian labels.

## Edge-case contract

- Loading, partial data, empty queue/history/diagnosis/order, request failure, permission denial, stale SOAP save, deleted or temporarily omitted encounter, no-result filtering, long SOAP, large orders, rapid patient switching, duplicate submission, offline/stale state, narrow viewport, 200% zoom, keyboard control, reduced motion, and unsupported actions are tracked in the standalone implementation report.
- Existing runtime handlers remain authoritative for save, retry, permission, confirmation, selection, and completion states. Figma does not define those states, so they render inside the new geometry without inventing a new data or workflow contract.
- Narrow and zoomed layouts keep document overflow at zero and use internal horizontal scrolling for dense fixed-geometry regions. The source viewport remains the exact visual target.

## Verification

- `tests/chart.spec.ts` on Chromium: 34 passed, including the new screenshot regression and existing SOAP, diagnosis, history, Order, permission, queue, and completion workflows.
- Target geometry: chart main `1540 × 1024`; top/order grid rows `503.219 / 8 / 406.781px`; three top panels `502px` each; document horizontal overflow `0`.
- Narrow `800 × 650`: document overflow `0`; patient bar, action bar, top grid, and order toolbar retain internal scroll. Reduced-motion scrolling updates immediately.
- Full repository ESLint, TypeScript, production build, docs link check, secret scan, and diff check passed for the release candidate. The build retains the existing broad NFT trace warning rooted in `src/lib/prd-viewer/doc-reader.ts`.
- The standalone report contract, production build, and embedded HTML validation passed with 99 tracked decisions, 20 state cards, 11 verification checks, and three visual evidence records.

## Remaining review boundary

- The Figma source and runtime screenshot use different displayed records, so the source-to-runtime comparison is exact geometry plus side-by-side visual inspection, not a misleading raw-pixel assertion. The committed Playwright baseline detects future implementation drift for the deterministic test scenario.
- The feature is ready for the separately requested commit, PR, and production gate. Release completion still requires exact candidate approval, merged `origin/main` evidence, Vercel Ready status, and scoped production smoke.
