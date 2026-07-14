---
id: "DESIGN-SYSTEM-PR-077"
status: implemented
area: design-system
priority: P1
target_pr: "Browser comment / shared workspace right-panel header height"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/DESIGN.md"
  - "docs/design/system/component-ownership-rules.md"
  - "docs/design/system/right-panel-header-contract.md"
updated: 2026-07-14
---

# DESIGN-SYSTEM-PR-077: Shared Right-Panel Header Height

## Goal

Give every content-area right-panel header the same shared `56px` frame instead of maintaining feature-local `52px` or one-off heights.

## Scope

- Add the shared `EmrRightPanelHeader` component and right-panel-only height token.
- Adopt the component in Reception, Lab, Imaging, and Billing right panels.
- Preserve each panel's existing title, actions, border, and interaction behavior.
- Add focused browser geometry coverage for representative right panels.

## Out of scope

- `EmrSubpanelTitle` module side-panel headers.
- Workspace overlay drawers, content asides, top toolbars, dialogs, and modal headers.
- Responsive breakpoint, data, API, permission, routing, or persistence changes.

## Done criteria

- All registered workspace right-panel headers use `EmrRightPanelHeader`.
- The shared computed height is `56px`.
- The existing `--clair-layout-drawer-header` value remains unchanged.
- Representative Reception, Lab, and Imaging Playwright checks pass.
- Focused lint, typecheck, build, docs, secret, and diff checks pass.

## Verification

- TDD RED: Reception's default right panel could not find the new shared header slot before implementation.
- GREEN: Reception, Lab, and Imaging representative geometry checks pass with a computed `56px` height.
- Passed: `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3108 npx playwright test tests/right-panel-header.spec.ts --project=chromium --reporter=line` (`3 passed`; Reception, Lab, Imaging, Billing, 1024px frame, and 767px mobile-hidden behavior).
- Passed: focused ESLint, `npx tsc --noEmit --pretty false --incremental false`, production build, docs check, secret scan, and `git diff --check`.
- The production build retained the existing worktree-root inference and broad `doc-reader.ts` trace warnings; compilation, TypeScript, static generation, and route output completed successfully.
- A broad pre-final Playwright grep also selected an unrelated Cheongdam Imaging scenario that failed before the header assertion because `영상검사 Order 상세` was absent. The dedicated right-panel header regression suite is isolated from that baseline flow and passes.

## Result report

- `docs/completed/design-system/2026-07-14-shared-right-panel-header-height-report.html`
