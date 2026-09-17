---
id: CHART-PR-036
type: Work Item
title: Plan/Order confirmation and work-state presentation
status: human_review
area: chart
priority: P1
source_docs:
  - docs/product/domain/plan-order-all-tab-legacy-column-contract.md
updated: 2026-09-17
---

# Plan/Order confirmation and work-state presentation

## Goal and approval

Implement the owner-approved final UI criteria from 2026-09-08. Authorization
initially covered local implementation and non-destructive verification. On
2026-09-08 the owner explicitly requested tests, commit, push, PR, origin/main
merge and approved deployment for this same status UI slice. Preserve existing
WIP, notably order-defaults changes in
`src/features/chart/module.tsx`.

## Scope

- `확정 여부` badges; `업무 상태` side-panel icons and cancellation precedence.
- Neutral Plan/Order rows; four pinned identity columns.
- Stable default grouping, deferred reordering while editing, explicit sorting
  precedence, and intact parent/child sets.
- Existing confirmation, selection, removal, history and mutation flows retained.

No DB/API/lifecycle, permission, billing, unrelated quick-add, or shared-table
behavior changes. The earlier CHART-PR-032 is delivered; CHART-PR-035 owns separate
quick-add planning. This item tracks the new status presentation slice.

## Done criteria and verification

- Match the final source contract, including cancelled completed/no-task orders.
- Focused projection/group-order tests and browser editing/selection regression.
- Typecheck, scoped lint, docs links, and relevant existing chart checks.
- Record exact verification results and limits before handoff.

## Local implementation and evidence — 2026-09-08

Implemented the status projection and set-aware display ordering in
`src/features/chart/chart-order-table-presentation.ts`, local badges/tooltips in
`src/features/chart/components/chart-order-status.tsx`, and table integration in
`src/features/chart/module.tsx`. Kept pre-existing order-defaults WIP intact.

- Confirmation badges use existing validation and semantic tokens. Invalid input
  opens the existing editor. Confirmed rows retain selection and actions.
- Work state reuses actual side-panel SVGs; cancellation overrides preserved
  terminal/no-task states without changing stored history.
- Four pinned columns total 410px. Default confirmation grouping preserves sets;
  editing freezes row position until the editing boundary ends.
- Added explicit tooltip role and description linkage locally after the browser
  test exposed missing accessibility semantics in the current shared wrapper.

Passed checks:

- Projection/group-order tests: 7/7 (`/tmp/playwright-order-status.config.cjs`,
  targeting `tests/chart-order-table-presentation.spec.ts`, no web server).
- Storybook Chromium component tests: 2/2 via `npx vitest run --project storybook
  src/features/chart/components/chart-order-status.stories.tsx`.
- Chart Chromium browser checks: 10 unique tests covering pinned scrolling,
  approved columns, explicit sorting, quantity commit, deferred grouping,
  unconfirmed tooltip keyboard focus, selection-scoped confirmation, candidate
  removal failure, ETag conflict, safe cancellation flow, and atomic retry.
  Invoked in focused batches against local mock auth at port 3106. The deferred
  grouping case was rerun successfully after adding the keyboard tooltip check.
- `npx tsc --noEmit`: passed after the dev server completed route generation.
  An overlapping first invocation saw transient generated route-type errors.
- Scoped ESLint on the changed chart implementation and tests: passed (existing
  large-module Babel size notice only).
- `npm run docs:check`: passed, 1052 markdown files checked.
- Scoped `git diff --check`: passed.

Limits: browser scenarios use synthetic/local mock data. Cancelled completed,
returned, pending and no-task projection cases are covered by pure tests and
component rendering, not a new remote cancellation run. The project-scoped
Storybook MCP pointed at another worktree, so validation used this checkout's
Vitest Storybook runner. No production build, remote mutation, commit, push,
merge, or deployment was performed. Human acceptance remains pending.

## Production delivery candidate — 2026-09-08

- Scope: CHART-PR-036 only; 9 application/test/documentation files.
- Source branch: `codex/plan-order-status-delivery`, isolated from the dirty primary
  checkout and based on `origin/main` `04289796dc36d15cb984e63d9ba7a70d94188163`.
- Ported only status UI edits. Preserved the main branch's deployed order-defaults,
  actual execution and continuous quick-add behavior.
- Owner authorization: “구현 다했으면 테스트-검증 하고, 통과하면 커밋, 푸시, 피알,
  오리진-메인에 머지. 배포 승인”. Operation/target/scope are the same release slice.
- Previous Ready Production/rollback candidate:
  `dpl_FCjAcUvS9ynXGUDAXKMm7ZYHtPPd`, source `04289796dc36d15cb984e63d9ba7a70d94188163`.
- Env source: existing Vercel project environment configuration, unchanged.
  No env values, DB migrations, external communications or remote data writes.
- Production smoke: `/login`, existing authenticated synthetic Cheongdam chart,
  confirmation/work-state columns, row retention and read-only table interaction.
  Do not create or cancel remote orders for this presentation release.
- Stop before merge if Release Check, Preview, secrets or focused checks fail,
  the candidate changes, or unrelated scope appears. Report a failed post-merge
  smoke before any separately unapproved rollback mutation.
- Exact PR head, Release Check, Preview and merge/deployment proof will be recorded
  in the PR/release handoff after the candidate commit exists.

### Candidate integration corrections

The latest main includes PR #713 continuous quick-add. Focused integration tests
exposed cell remounting when a freshly allocated validation set recreated column
definitions. The table now follows its existing ref-based callback pattern for
validation reads, preserving input focus and edits during quick-add.
The draft UI browser fixture also explicitly isolates CBC confirmation state
from earlier tests that share the local mock server. Neither correction changes
remote validation or confirmation authority.

### Release verification

The isolated latest-main candidate passed all 13 focused Chromium scenarios in
one run (2026-09-08), including the 10 status/confirmation regression cases and
3 existing continuous quick-add/geometry/scroll scenarios. Projection tests
passed 7/7 and Storybook Chromium tests passed 2/2. Full lint, UX copy, typecheck,
production build, staged-file secret scan, docs links and diff whitespace checks
passed. The final type/build run after the cell-stability correction also passed.
The quick-add viewport assertion now waits for positioning to settle while
retaining its original 1px containment threshold. No product tolerance changed.

Before opening the PR, rebased over home-only PR #715 (`a6441c75`). The chart
slice has no overlap; exact-candidate release checks run after that rebase.

### Final quick-add integration fix

A further exact-candidate run passed 12/13 scenarios but exposed intermittent
keyboard selection clipping in the existing quick-add popup during its opening
scale animation. A settled-position assertion alone was insufficient. The
existing local scroll effect now converts visual distances to layout pixels and
rechecks visibility on list resize; it does not scroll the page or change popup
layout, query, selection or mutation behavior. The same original 1px containment
check passed 3/3 consecutive runs after this correction. The superseded remote
Release Check was cancelled; the final updated head gets its own required run.

## Figma badge label refinement — 2026-09-13

- Renamed the table column from `오더 확정` to `확정 여부` and the three
  presentation labels to `확정 전`, `미입력`, and `확정 후` without changing
  confirmation authority, click behavior, persistence, or row-state derivation.
- Matched Figma node `28382:110989` with existing CLAiR/EMR semantic tokens and
  the shared status typography contract: 22px height, 6px radius, 12px medium
  text, tokenized status surfaces/text/borders, and exact 51/51/48px rendered
  widths. No raw color values or new component abstraction were added.
- Isolated the six-file release slice from latest `origin/main` in
  `codex/order-confirmation-badge-figma`; the owner's commit, push, PR,
  `origin/main` merge, and production deployment approval applies to this exact
  presentation-only scope.
- Focused Storybook Chromium checks passed 2/2 and candidate-only chart Chromium
  checks passed 2/2. Secrets, docs links, diff whitespace, lint, typecheck, and
  production build also passed; lint retained five unrelated existing warnings.
- No DB, environment, permission, API, or remote clinical-data change is in
  scope. The pre-release Ready production rollback candidate is
  `dpl_8aRUtwdZXt4hJhKUbcjw1j44ckw9`.

## Footer status summary refinement — 2026-09-17

- Removed the duplicate `총 오더` badge because the Plan/Order category tab
  already exposes the complete top-level order count.
- Replaced the two billing-oriented footer labels with the Figma node
  `28414:21807` presentation: `미확정 오더`, `미입력 오더`, and
  `확정 오더`, using existing CLAiR semantic tokens and the existing label
  typography, spacing, dividers, background, and radius.
- The three counts are derived from the existing top-level row set and
  `getChartOrderConfirmationState`. This keeps the footer total aligned with
  the top `전체` count, excludes child detail rows, and preserves the current
  confirmation, cancellation, validation, billing, API, and persistence
  contracts.
- Added a focused browser regression that verifies the duplicate total is
  absent, the three counts sum to the `전체` count, and a ready row becoming
  invalid moves exactly one count from `미확정 오더` to `미입력 오더`.
- Owner authorization covers this presentation-only slice through commit,
  push, PR, `origin/main` merge, and production deployment. No DB, environment,
  permission, API, or remote clinical-data change is in scope.
- Focused Chromium status/count regression, secret scan, docs links, diff
  whitespace, full lint, typecheck, and production build passed. Full lint
  retained five unrelated existing script warnings; the build retained the
  existing broad NFT trace warning from the docs reader.
- The broad chart reference screenshot remains stale independently of this
  slice: it failed with 29,261 differing pixels on an untouched `origin/main`
  worktree and 29,356 on this candidate. Its binary baseline was not refreshed
  because that would absorb unrelated existing chart changes. The focused
  footer regression is the acceptance check for this slice.
