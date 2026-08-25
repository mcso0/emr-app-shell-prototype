---
id: "DESIGN-SYSTEM-PR-094"
status: "implemented"
area: "design-system"
priority: "P0"
target_pr: "User request / Neutral surface and interaction-state token alignment"
created: "2026-08-25"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/DESIGN.md"
  - "docs/design/system/light-operational-foundation.md"
  - "docs/design/system/table-density-and-grid-ergonomics.md"
dependencies:
  - "DESIGN-SYSTEM-PR-088"
  - "DESIGN-SYSTEM-PR-093"
---

# Neutral Surface and Interaction-State Tokens

## Goal

Align implemented app surfaces to the equal-channel Neutral palette and make
hover, selected, and active feedback a clear black-alpha state ladder.

## In Scope

- Normalize the hand-authored app, workspace, panel, muted, and disabled
  surface aliases without editing generated Clair tokens.
- Map hover to black 4%, selected to black 6%, and active to black 8%.
- Keep legacy surface-state names as compatibility aliases while moving active
  runtime consumers to `--emr-state-*`.
- Apply semantic workspace and muted tokens to existing `#FCFCFC` and
  `#FAFAFA` runtime surfaces.
- Keep shared table rows and pinned cells visually aligned and pinned cells
  opaque in hover and selected states.
- Update focused browser tests and the canonical design-system contracts.

## Out Of Scope

- Generated `src/styles/tokens/clair.css` edits.
- Navigation-rail Gray palette replacement or text-color migration.
- Semantic info, success, warning, danger, billing, or clinical status colors.
- Layout, data, API, permission, drawer, persistence, or Order-set behavior.
- Commit, push, pull request, merge, or deployment.

## Done Criteria

- Workspace and table-header surfaces resolve to `#FCFCFC` and Neutral 50.
- Hover, selected, and active state aliases resolve to black 4%, 6%, and 8%.
- Data-table rows and pinned cells show matching hover and selected results
  without sticky-cell scroll-through.
- New runtime interaction code does not depend on the legacy surface-state
  aliases.
- Focused table/token checks and repository quality gates pass, or limitations
  are recorded.

## Verification Plan

- `npx playwright test tests/design-tokens.spec.ts --project=chromium`
- Focused customer and hospital-admin pinned-row Playwright checks.
- `npm run lint`
- `npx tsc --noEmit --pretty false`
- `npm run docs:check`
- `npm run security:secrets`
- `git diff --check`
- `npm run build-storybook`
- `npm run build`

## Result

- The EMR foundation now exposes an equal-channel Neutral static surface ladder
  and a separate black-alpha interaction-state ladder.
- Shared data tables use the state tokens for whole-row hover/selection and
  compose the same overlays over opaque pinned-cell bases.
- Customer, hospital-admin, Order-set, chart, role/permission, and shared table
  workspace backgrounds now use semantic surface aliases instead of local
  `#FCFCFC` literals.
- Navigation Gray and semantic status palettes remain unchanged for a separate
  review.

## Verification

- Focused Playwright checks passed for the 4%/6%/8% computed token contract,
  legacy-alias/local-neutral source guard, customer pinned hover/selection,
  hospital-admin active Order rows, Order-set navigation, and customer module
  selection.
- Toggle and table-workspace-header Storybook interaction checks passed (6/6).
- ESLint, TypeScript no-emit, docs links, secret scan, diff check, Storybook
  build, and Next production build passed.
- The shared Table Storybook suite passed 5/6. Its existing pinned-content 10px
  inset assertion also failed on an untouched `origin/main` worktree and is not
  caused by this change.
- The broader design-token suite still contains unrelated current-main source
  guard and stale fixture failures; the two checks added or changed for this
  scope pass.

## Completion Report

- `docs/completed/design-system/2026-08-25-neutral-surface-state-token-alignment-report.html`
