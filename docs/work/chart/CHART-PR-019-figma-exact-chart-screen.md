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
  - "docs/completed/chart/2026-08-13-chart-pr-019-figma-fidelity-follow-up-report.html"
dependencies:
  - "CHART-PR-006"
  - "CHART-PR-007"
updated: "2026-09-13"
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

## 2026-08-13 Figma fidelity follow-up

### Requested outcome

Use Figma frame `27946:58868` as the visual source of truth, correct the regressions called out on the deployed chart screen, and verify both appearance and interaction before review. This follow-up is limited to the chart title/action bar, chart workspace surfaces, panel header actions, and the Plan/Order toolbar. It does not change chart data, permissions, persistence, order behavior, or remote environments.

### Requirement, investigation, and implementation plan

| ID | Requirement | Verified evidence | Planned correction | Acceptance criteria |
| --- | --- | --- | --- | --- |
| F1 | Restore the visit/chart-history icon button beside the chart title, including its former interaction. | Production renders a decorative `◴` span rather than a button. The repository still contains `EmrInstructionHistoryToggle`, `ChartContentAside`, and URL-backed `aside` layout state. Figma action bar node `27946:59006` includes a `24 × 24` leading icon-button node `27946:59009`, and the source frame contains the hidden chart-history content panel. | Replace the decorative span with the existing history toggle behavior, use the Figma compact `24 × 24` presentation with a `16px` history icon, restore slot availability, and connect it to the existing URL-backed content-aside open/close state. | The control has button semantics and an accessible name; it is `24 × 24`; click opens `#chart-content-aside` and sets `aside=history`; a second click closes it and restores `aside=closed`. |
| F2 | Remove the line below the chart header/action bar. | Figma divider node `27946:59030` is hidden. Production currently applies a bottom border. | Remove the action-bar bottom-border class without changing its `48px` height. | Computed `border-bottom-width` is `0px`; action bar remains `48px` high. |
| F3 | Show maximize, add, and overflow panel actions only while hovering each section. | Production keeps the actions visible at rest. Figma positions them in each panel header, while the requested interaction defines hover reveal. | Apply one chart-local action-group contract to Subject/Object, Assessment, History, and Plan/Order. Hide it only on hover-capable devices; reveal it on the owning panel's hover or `focus-within`; keep it visible on coarse/touch input and honor reduced motion. | Mouse: actions are hidden at rest and visible on their panel hover. Keyboard: focused actions remain visible. Touch/coarse pointer: actions are not permanently hidden. |
| F4 | Make all controls in the right side of the Plan/Order toolbar `28px` high by using the existing component size variant. | `Button` defines `size="sm"` as `--clair-control-height-sm`, which is `28px`; `xs` is `24px`. The density selector uses `sm` internally but currently overrides it to `32px`. | Use `size="sm"` for Search, Filter, Instructions, Result analysis, PACS, and + Order. Keep the existing density component and override only its chart caller height to the same `sm` token. | Every named toolbar control has a `28px` computed height; no new size token or shared variant is introduced. |
| F5 | Set the chart header/action-bar background to `#FCFCFC`. | The chart bar currently uses the workspace surface token, which resolves to white. Existing repository table workspace code already uses exact `#FCFCFC`; no exact `#FCFCFC` semantic token exists (`surface-2` is `#FCFCFD`). | Use exact `#FCFCFC` for the chart action bar. | Computed background is `rgb(252, 252, 252)`. |
| F6 | Set the workspace canvas behind and between sections to `#FCFCFC`. | The deployed chart workspace resolves to white, flattening the Figma surface hierarchy. | Apply exact `#FCFCFC` to the chart content/workspace canvas and top-grid gutters. | Canvas and visible inter-panel gutters compute to `rgb(252, 252, 252)`. |
| F7 | Set Subject/Object, Assessment, and History section surfaces to common white. | The design token `--clair-color-atomic-common-100` resolves to `#FFFFFF`. | Apply the common white token at each top panel root; retain existing table and editor sub-surface contracts. | All three top panel roots compute to `rgb(255, 255, 255)`. |
| F8 | Set the Plan/Order section surface to common white. | The same common white token is the existing design-system source for the requested `common` color. | Apply the common white token at the Plan/Order panel root. | Plan/Order panel root computes to `rgb(255, 255, 255)`. |

### Planned code boundary

- `src/features/chart/components/chart-figma-workspace.tsx`: action-bar chrome and reusable chart-panel hover/focus action group.
- `src/features/chart/module.tsx`: restore history toggle wiring, surface assignments, and Plan/Order size variants.
- `tests/chart.spec.ts`: focused interaction and computed-style regression coverage.
- This work item and `docs/work/index.md`: keep request, evidence, status, and verification results synchronized.

### Verification matrix

1. Static checks: focused ESLint, TypeScript, `git diff --check`, and docs checks.
2. Browser behavior: history button semantics, URL transition, content-aside open/close, and no regression to inline chart History.
3. Browser styling: action-bar border/background, workspace and section backgrounds, `24px` history button, and all `28px` Plan/Order toolbar controls.
4. Interaction states: panel actions hidden at rest, revealed on hover and keyboard focus, plus a non-hover input fallback review.
5. Layout regression: existing chart Chromium coverage and the deterministic Figma-sized screenshot test; update a committed baseline only after inspecting the intentional visual delta.
6. Boundary note: local candidate verification proves the code change; the deployed Vercel URL remains unchanged until a separate commit/PR/release request.

### Implemented follow-up

- Restored the chart-history control with the existing `EmrInstructionHistoryToggle` behavior and URL-backed content-aside state. The chart caller constrains the shared control to the Figma `24 × 24` frame while retaining the existing `16px` history icon, tooltip, pressed state, and accessible label.
- Re-enabled chart content-aside availability only when a chart bundle is selected. The inline History column remains unchanged; the title control opens the separate historical content panel as it did before the regression.
- Removed the chart action-bar bottom border and assigned exact `#FCFCFC` to the action bar and chart workspace canvas.
- Assigned `--clair-color-atomic-common-100` (`#FFFFFF`) to all four section roots.
- Added one chart-local panel-action group used by Subject/Object, Assessment, History, and Plan/Order. It is hidden at rest only when `hover: hover` is available, appears immediately on panel hover or keyboard focus, remains visible while a popup trigger is expanded, and stays visible on touch input.
- Switched the seven Plan/Order right-toolbar buttons to the existing `sm` control size and aligned the density selector caller to the same `--clair-control-height-sm` (`28px`) token.

### Follow-up verification results

- Focused Figma contract + app-shell Chromium group: **4 passed**. Verified the restored title control, open/close URL state, `24px` size, `48px` action bar, no bottom border, `#FCFCFC` canvas, white panels, hover reveal, keyboard focus reveal, expanded-menu persistence, seven `28px` toolbar controls, touch visibility, app-shell integration, and the existing `1540 × 1024` screenshot baseline.
- Existing chart workflow checks run separately on fresh local servers passed for queue/History/SOAP/Assessment/Order rendering, history selection, restored history aside, and the app-shell treatment route.
- Full `tests/chart.spec.ts` single-server diagnostic: **31 passed, 4 failed** after 2.4 minutes. The four failures were non-deterministic Base UI/Tiptap popup detachment or instability under the long-lived Next development server; the server also reported repeated `MaxListenersExceededWarning` and `ECONNRESET`. The focused change contract remained green on a fresh supported Node 24 process. This is recorded as a test-harness limitation rather than hidden as a clean full-suite result.
- A later isolated rerun of the existing SOAP add/delete automation again hit DOM replacement, this time at the confirmation button instead of the menu item. Direct local-browser QA remained healthy, so the release gate uses the green focused change contract and records this unrelated automation instability as a residual risk.
- Direct local-browser QA confirmed the action bar at `48px` with `#FCFCFC` and no bottom border, four white panels, `24px` history toggle, seven `28px` toolbar controls, panel actions changing from opacity `0` to `1` on hover, and URL-backed history-aside open/close behavior.
- Focused ESLint, TypeScript (`tsc --noEmit`), docs link check (893 markdown files), `git diff --check`, and the production build passed. The build retains the pre-existing broad NFT trace warning rooted in `src/lib/prd-viewer/doc-reader.ts`.
- No screenshot baseline was updated: the existing deterministic Figma-sized baseline passed within its committed tolerance.

## 2026-09-13 panel action color follow-up

- Used Figma node `28382:90537` as the source for the chart panel action group: transparent `28 × 28` buttons, `8px` radius, `4px` gap, Neutral 900 (`#171717`) icons, and `14 / 14 / 16 / 16px` icon slots.
- Reused `--clair-color-atomic-neutral-900`; no new design token or shared component was added. Chart-local action buttons now retain that color across rest, hover, expanded, and disabled presentation while preserving the existing disabled semantics and permissions.
- Removed the visible Subject/Object autosave text from the panel title. Autosave coordination, manual save, error state, and the existing screen-reader live announcement remain unchanged.
- Kept the existing Plan/Order `Order 추가` behavior only; no action was added to panels where the Figma source shows an unsupported plus slot.
- Focused ESLint, full TypeScript, docs links, secret scan, `git diff --check`, and the focused Chromium computed-style contract passed. Full lint passed with five pre-existing unused-variable warnings in WP10 scripts and no errors.
- `npm run build` was attempted twice. Both attempts remained in Turbopack's optimized-production-build phase without an error or completion output and were stopped after bounded waits. The production build completed successfully with the supported webpack path (`npm run build -- --webpack`); the default Turbopack path remains an environment-level candidate limitation for the integration gate. Human visual and usage review remains pending as requested.
