---
id: "DESIGN-SYSTEM-PR-061"
status: "human_review"
area: "design-system"
priority: "P1"
target_pr: "User request / Storybook table-queue pattern second pass"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/storybook-operating-rules.md"
  - "docs/design/system/table-density-and-grid-ergonomics.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-057-storybook-table-queue-patterns.md"
updated: "2026-06-15"
---

# Storybook Table/Queue Pattern Second Pass

## Goal

Expand the Storybook-only EMR table/queue pattern entry with the next repeated table behaviors after the initial status/action/filter/empty pass.

## Scope

- Extend the existing Storybook-only helper without adding production APIs.
- Add pattern stories for:
  - sortable/filterable header
  - row selection
  - density selector
  - long text cell
- Use existing shared primitives only.
- Use synthetic demo text only.
- Record this work item and a closeout report.

## Out Of Scope

- New shared runtime table or queue APIs.
- Refactoring `EmrDataTable`, queue side panels, feature modules, or table density internals.
- Storybook/Vitest/Vite/Playwright configuration changes.
- DB, Supabase, RLS, server enforcement, payment, email, deploy, external provider, or real data work.
- Fixing unrelated existing worktree changes.

## Verification

- `npm run lint`
- `npx tsc --noEmit`
- `npm run docs:check`
- `npm run build-storybook`
- `npm run storybook -- --ci --smoke-test`
- Storybook MCP `get-documentation` includes the new pattern stories.
- Storybook MCP focused `run-story-tests` check for one new pattern story.

## Handoff Notes

Ready for Human Review.

Verification completed on 2026-06-15:

- `npm run lint` passed with 5 pre-existing warnings outside this scope.
- `npx tsc --noEmit` passed.
- `npm run docs:check` passed.
- `npm run build-storybook` passed.
- `npm run storybook -- --ci --smoke-test` passed.
- Storybook MCP `get-documentation` for `design-system-emr-table-queue-patterns` includes `Sortable Filterable Header`, `Row Selection`, `Density Selector`, and `Long Text Cell`.
- Storybook MCP `run-story-tests` focused check passed for `design-system-emr-table-queue-patterns--sortable-filterable-header`.
- The first focused MCP run hit a one-time Vite dependency optimizer dynamic-import failure; rerun passed, matching the PR-056 interaction-test policy.
