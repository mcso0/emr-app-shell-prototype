---
id: "DESIGN-SYSTEM-PR-093"
status: "implemented"
area: "design-system"
priority: "P0"
target_pr: "User request / neutral structural border token cleanup"
created: "2026-08-22"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/DESIGN.md"
  - "docs/design/system/border-shadow-depth-contract.md"
  - "docs/design/system/border-token-adoption-inventory.md"
dependencies:
  - "DESIGN-SYSTEM-PR-044"
---

# Neutral Structural Border Token Cleanup

## Goal

Make the approved neutral `100/200/300` semantic border hierarchy the only
structural border contract in runtime source, remove the legacy structural
`--emr-line-*` aliases, and align the global shadcn border/input bridge with
`--emr-border-default`.

## In Scope

- Classify and replace every runtime use of `--emr-line-subtle`,
  `--emr-line-hairline`, `--emr-line-default`, and `--emr-line-strong` with
  `--emr-border-subtle`, `--emr-border-default`, or `--emr-border-strong`.
- Map large workspace and panel outer boundaries to strong, ordinary component
  and internal boundaries to default, and quiet micro dividers to subtle.
- Override the global `--border` and `--input` variables in the hand-authored
  EMR foundation layer so generic shadcn borders resolve to neutral/200.
- Remove the four legacy structural token definitions and prevent their
  reintroduction with source-level tests.
- Add focused computed-style coverage for the global bridge and chart panel
  outer/internal border roles.
- Align the canonical border docs, adoption inventory, work index, changelog,
  and completion report with the implemented state.

## Out Of Scope

- Changing selected, focus, drag, brand, clinician, calendar, or semantic
  status borders.
- Editing generated `src/styles/tokens/clair.css` or
  `src/styles/tokens/shadcn.css`.
- Changing component behavior, layout, data, permissions, persistence, or
  remote environments.
- Commit, push, pull request, merge, or deployment.

## Done Criteria

- Runtime source contains no reference or definition for the four legacy
  structural `--emr-line-*` tokens.
- `--emr-border-subtle/default/strong` continue to resolve to neutral
  100/200/300 (`#F5F5F5`, `#E5E5E5`, `#D4D4D4`).
- Global `--border` and `--input` resolve to `--emr-border-default` in the
  supported light operational theme.
- Chart top-level panel borders resolve to strong, panel-internal dividers to
  default, and quiet micro dividers to subtle.
- Focused token/chart/browser checks, lint, TypeScript, docs, secrets, diff,
  and build gates pass or any existing baseline limitation is recorded.

## Verification Plan

- `npx playwright test tests/design-tokens.spec.ts tests/chart.spec.ts --project=chromium`
- Focused Storybook or Playwright checks for Input, Select, Dialog, Popover,
  Table, workspace shell, and chart chrome.
- `npm run lint`
- `npx tsc --noEmit --pretty false`
- `npm run docs:check`
- `npm run security:secrets`
- `git diff --check`
- `npm run build`

## Release Boundary

This task is local implementation and verification only. Commit, push, PR,
merge to `main`, and production deployment require a separate user request.

## Result

- Reclassified and migrated all 116 runtime use sites of the four legacy
  structural line tokens from the `6608d5ff` baseline.
- Removed the four legacy definitions and the unused `.emr-panel` and
  `.emr-hairline` compatibility utilities.
- Mapped quiet micro dividers to neutral/100, ordinary component boundaries to
  neutral/200, and major workspace boundaries to neutral/300.
- Mapped the global `--border` and `--input` bridge to
  `--emr-border-default`, including the dark override, and removed the
  `InputOTP` structural bypass.
- Kept selected, focus, status, drag, clinician, calendar, and brand borders
  on their owning semantic tokens.
- Added recursive source enforcement and rendered chart/global bridge checks.

## Verification

- Focused Playwright token/chart checks: 4 passed.
- Representative Storybook interaction checks: 33 passed across 9 story files.
- ESLint on changed TypeScript/TSX and TypeScript no-emit checks passed.
- The broader Storybook set reproduced one existing pinned-table interaction
  failure unchanged on clean `origin/main`; it is not introduced by this diff.
- Full repository lint, docs links, secret scan, Next production build,
  Storybook build, and diff checks passed.

## Completion Report

- `docs/completed/design-system/2026-08-22-neutral-border-token-cleanup-report.html`
