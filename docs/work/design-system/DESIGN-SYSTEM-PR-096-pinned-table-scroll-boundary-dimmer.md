---
id: "DESIGN-SYSTEM-PR-096"
status: "human_review"
area: "design-system"
priority: "P0"
target_pr: "Browser comment / shared pinned-table scroll boundary dimmer"
created: "2026-08-30"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/component-ownership-rules.md"
  - "docs/design/system/table-density-and-grid-ergonomics.md"
  - "docs/design/system/ui-refactor-dod.md"
dependencies:
  - "DESIGN-SYSTEM-PR-088"
  - "DESIGN-SYSTEM-PR-092"
  - "DESIGN-SYSTEM-PR-095"
---

# Pinned Table Scroll Boundary Dimmer

## Goal

Remove the unnecessary black-alpha boundary overlay when a pinned table is at
its horizontal start, then reveal the overlay as soon as scrollable content
moves behind the pinned region.

## In Scope

- Apply the behavior once in the shared `EmrPinnedTableViewport` CSS contract.
- Use the existing Base UI `data-overflow-x-start` and
  `data-overflow-x-end` state attributes.
- Keep the 1px pinned divider visible at every scroll position.
- Apply the inverse rule to right-pinned columns.
- Add shared Storybook coverage for start, middle, and end positions.
- Update the hospital-admin Order regression for the production-reported case.
- Update the canonical pinned-table overflow contract.

## Out Of Scope

- Feature-local table implementations, data, API, Supabase, permissions, or
  persistence changes.
- New React state, scroll listeners, component props, or dependencies.
- Changes to pinned widths, sticky geometry, row surfaces, or scrollbar layout.

## Done Criteria

- At horizontal start, the left dimmer is hidden and the divider remains.
- After scrolling right, the left dimmer is visible without moving its fixed
  boundary geometry.
- Right-pinned tables apply the symmetric end-state behavior.
- A non-overflowing pinned table shows neither dimmer.
- Shared Storybook and focused hospital-admin browser regressions pass.
- Lint, TypeScript, build, docs, secret scan, and diff checks pass or any
  limitation is recorded.

## Verification Plan

- Focused Storybook `LeftAndRightPinned` interaction check.
- Focused hospital-admin Playwright pinned-boundary regression at 1024x768.
- `npm run lint`
- `npx tsc --noEmit --pretty false`
- `npm run build-storybook`
- `npm run build`
- `npm run docs:check`
- `npm run security:secrets`
- `git diff --check`

## Result

Implemented on `codex/pinned-dimmer-scroll-state-20260830-v2` from
`origin/main` at `bc43077db6933bac5ccc421844df59bf6dd9e39b`.

- The shared dimmer is hidden by default and becomes visible only when Base UI
  exposes overflow beyond the matching pinned boundary.
- The left boundary follows `data-overflow-x-start`; the right boundary follows
  `data-overflow-x-end`. The 1px divider remains visible in every state.
- The shared Storybook interaction now verifies horizontal start, middle, end,
  and no-overflow states.
- The hospital-admin Order regression verifies the production-reported 1024px
  case, including dimmer opacity and fixed boundary geometry before and after
  scrolling.

Verification passed: focused Storybook (25 tests), focused hospital-admin
Playwright (1 test), lint, TypeScript, Storybook build, production build, docs
links, secret scan, and diff whitespace check. The builds retained only existing
unrelated warnings for Next.js NFT tracing, the Pretendard runtime font path,
Lottie direct eval, and Storybook chunk size.

## Completion Report

`docs/completed/design-system/2026-08-30-pinned-table-scroll-boundary-dimmer-report.html`
