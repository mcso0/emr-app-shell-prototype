---
id: "DESIGN-SYSTEM-PR-095"
status: "human_review"
area: "design-system"
priority: "P0"
target_pr: "Browser comment / EmrDataTable viewport height contract"
created: "2026-08-29"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/component-ownership-rules.md"
  - "docs/design/system/table-density-and-grid-ergonomics.md"
  - "docs/design/system/ui-refactor-dod.md"
dependencies:
  - "DESIGN-SYSTEM-PR-088"
  - "DESIGN-SYSTEM-PR-092"
---

# EmrDataTable Viewport Height Contract

## Goal

Make every `EmrDataTable` caller declare whether the table fills a bounded
workspace or keeps its natural content height, so the shared scroll owner and
horizontal scrollbar stay aligned with the intended table viewport.

## In Scope

- Add the required `viewportMode: "fill" | "content"` API to
  `EmrDataTable` without a default.
- Keep height, flex growth, and overflow ownership inside the shared table.
- Migrate all 12 feature call sites to an explicit viewport mode.
- Keep `EmrPinnedTableViewport` as the pinned scroll owner and the low-level
  `Table` container as the non-pinned scroll owner.
- Correct the Chart Plan/Order flex frame and remove the audit-log outer
  `ScrollArea`.
- Add Storybook contract coverage and focused browser regressions.
- Update the canonical table overflow contract.

## Out Of Scope

- Data, sorting, filtering, selection, column pinning, or workflow changes.
- New components or dependencies.
- DB, Supabase, permissions, data contracts, merge, deployment, or production
  release work.

## Done Criteria

- All feature call sites declare `viewportMode` and none relies on implicit
  parent flex behavior.
- `fill` tables occupy the bounded parent and place their horizontal scrollbar
  at the viewport bottom.
- `content` tables use header-plus-row natural height and leave vertical page
  scrolling to their parent.
- Pinned and non-pinned tables each have exactly one horizontal scroll owner.
- Chart, customer, hospital-admin, billing, dispensing, inpatient,
  lab/imaging, and membership behavior remains intact.
- Storybook, focused Playwright, build, docs, and secret-scan gates pass or any
  limitation is recorded.

## Verification Plan

- `npm run lint`
- `npx tsc --noEmit --pretty false`
- `npm run build-storybook`
- Focused Storybook viewport interaction checks.
- Related Playwright screen families: chart, customer, hospital-admin,
  billing, dispensing, inpatient, lab-imaging, and auth.
- Browser QA at `2124x1264`, `1440x900`, and `1024x650`.
- `npm run build`
- `npm run docs:check`
- `npm run security:secrets`
- `git diff --check`

## Result

Implemented on `codex/data-table-viewport-contract-20260829` from
`origin/main` at `98797c5fc8e0470e08c43881a4d58425cdfc33da`.

- Added the required `viewportMode: "fill" | "content"` contract and migrated
  every feature call site without a default.
- Kept one scroll owner per table, removed the hospital audit outer
  `ScrollArea`, and aligned Chart Plan/Order's table viewport with its footer.
- Raised the constrained Chart Order track minimum to 220px so a sticky header
  plus one data row remains operable at the smallest supported QA height.
- Added the 12-case Storybook matrix and focused Chart/audit Playwright
  regressions.
- Updated the canonical ownership and grid ergonomics documentation.

Verification passed: lint, TypeScript, Storybook build, 12 Storybook browser
contracts, the focused 8-family Playwright matrix except the known auth
workspace-creation setup timeout (9 passed, 1 failed), Chart QA at
`2124x1264`, `1440x900`, and `1024x650`, docs links, secret scan, and diff
whitespace checks. The exact `npm run build` production build also passed after
materializing the parent checkout dependencies inside the isolated worktree.

## Completion Report

`docs/completed/design-system/2026-08-29-emr-data-table-viewport-height-contract-report.html`
