---
id: "DESIGN-SYSTEM-PR-081"
status: implemented
area: design-system
priority: P1
target_pr: "User request / shared workspace right-panel layout"
source_docs:
  - "docs/design/system/right-panel-header-contract.md"
  - "docs/design/system/component-ownership-rules.md"
  - "docs/design/system/ui-refactor-dod.md"
updated: 2026-07-21
---

# DESIGN-SYSTEM-PR-081: Shared Workspace Right-Panel Layout

## Goal

Make the workspace right panel use one common header/body/footer composition so a
long Reception create form scrolls only in its body and its action footer stays visible.

## Research and decision

- `WorkspaceFrame` owns the outer right-panel slot and clipping; it is intentionally
  outside this change.
- Reception, Lab, Imaging, and Billing already share the standard `56px`
  `EmrRightPanelHeader`, but previously implemented their own internal height chains.
- Real footer shapes are `compact` (Imaging, `53px`), `single` (Reception, `65px`),
  `stacked` (Billing, `105px`), and omitted (Lab).
- The adopted compound API is `EmrRightPanel` with a required `header`, followed by
  one `EmrRightPanelBody` and an optional `EmrRightPanelFooter` sibling. The body
  contains the feature's own `ScrollArea`.
- The staff operational profile keeps its intentional `150px` custom header and is
  outside this standard layout.

## Scope

- Add shared root/body/footer components, exact footer-height tokens, and Storybook
  examples.
- Adopt the composition in Reception, Lab, Imaging, and Billing workspace panels.
- Preserve feature actions, data, routes, permissions, focus behavior, copy, outer
  shell ownership, breakpoints, overlay drawers, content asides, and profile panel.
- Add narrow-view Reception scroll/visible-footer regression coverage and cross-screen
  footer variant coverage.

## Done criteria

- Header is `56px`; only Body is fluid and `min-h-0`.
- Footer is outside body scrolling and uses `compact` `53px`, `single` `65px`, or
  `stacked` `105px` as appropriate.
- Lab has no footer and its body fills the remaining panel height.
- Reception create footer stays within the visible right-panel frame at `1024px` width.
- Focused browser tests, lint, typecheck, build, Storybook build, docs check, secret
  scan, and diff check pass.

## Verification

- Passed: `npx playwright test tests/right-panel-header.spec.ts --project=chromium --reporter=line` (5 passed).
- Passed: `npx playwright test tests/reception.spec.ts -g "reception encounter edit keeps long content and footer usable at a narrow viewport" --project=chromium --reporter=line` (1 passed).
- Passed: `npm run lint`, `npx tsc --noEmit --pretty false --incremental false`, `npm run build`, `npm run build-storybook`, `npm run docs:check`, `npm run security:secrets`, and `git diff --check`.
- Result report: [2026-07-21 shared right-panel layout report](../../completed/design-system/2026-07-21-design-system-pr-081-shared-right-panel-layout-report.html).
