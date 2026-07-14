---
id: "DESIGN-SYSTEM-PR-072"
status: implemented
area: design-system
priority: P1
target_pr: "User request / shared side-panel header spacing"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/README.md"
  - "docs/design/system/side-panel-header-contract.md"
updated: 2026-07-14
---

# Shared Side-Panel Header Spacing

## Goal

Align the shared module side-panel title/collapse header to the requested `56px` frame and spacing contract across all consumers.

## Revision history

- 2026-07-12: implemented the initial shared `52px` frame contract.
- 2026-07-14: follow-up request updated the shared frame to `56px`; unrelated dirty-branch changes and separate right-drawer headers remain out of scope.

## Scope

- Update `EmrSubpanelTitle`, the shared module side-panel header.
- Set the header frame to `56px`.
- Remove vertical padding while preserving `16px` horizontal padding.
- Promote the values to EMR foundation tokens.
- Add a browser geometry regression test.
- Record the reusable design-system contract.

## Out of Scope

- Content-aside headers, queue list headers, text-navigation headers, or module-list item/group headers. A module-list shell title that uses `EmrSubpanelTitle` inherits this shared frame.
- Feature-local header overrides.
- Responsive breakpoint changes.
- Any data, API, persistence, or permission behavior.

## Done Criteria

- Every `EmrSubpanelTitle` consumer uses the shared `56px` header frame.
- Computed padding is `0px 16px 0px 16px`.
- The Lab side panel and other shared consumers retain their existing title, collapse, and queue behavior.
- The focused Playwright assertion passes.
- Lint, typecheck, build, docs, and secret checks pass.

## Verification

- `npx playwright test tests/app-shell.spec.ts --project=chromium -g "shared side-panel header uses the 52px frame" --reporter=line`
- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- `npm run docs:check`
- `npm run security:secrets`
- `git diff --check`

## Verification Results (2026-07-12)

- Passed: focused shared side-panel header geometry assertion.
- Passed: existing order-queue side-panel status-title and collapse tests.
- Passed: lint, typecheck, production build, docs check, secret scan, and diff check.
- Known baseline issue: the existing app-shell workspace-switcher test fails on `origin/main`-based code while asserting unrelated workspace-switcher font-size/padding geometry. It is outside this change and was not modified.

## Follow-up verification (2026-07-14)

- Updated the shared geometry assertion and design contract from `52px` to `56px`.
- The separate reception right-drawer header assertion remains `52px` because it is not owned by `EmrSubpanelTitle`.
