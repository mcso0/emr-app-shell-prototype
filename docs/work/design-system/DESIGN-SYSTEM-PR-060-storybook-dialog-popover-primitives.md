---
id: "DESIGN-SYSTEM-PR-060"
status: "human_review"
area: "design-system"
priority: "P1"
target_pr: "User request / Storybook dialog-popover primitive stories"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/storybook-operating-rules.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-056-storybook-interaction-test-policy.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-059-storybook-ui-primitives-third-batch.md"
updated: "2026-06-15"
---

# Storybook Dialog/Popover Primitive Stories

## Goal

Continue the Storybook expansion sequence by documenting existing `Dialog` and `Popover` primitives with focused DOM API based interaction stories.

## Scope

- Inspect existing primitive APIs and app usage before adding stories.
- Add co-located stories for:
  - `Dialog`
  - `Popover`
- Keep story titles under `Design System/UI/...`.
- Include autodocs tags, args, argTypes, component descriptions, and story-level "use when / do not use when" guidance.
- Add focused `play` functions using DOM APIs, not `storybook/test` helpers.
- Use synthetic demo text only.
- Update the Design System README coverage table.
- Record this work item and a closeout report.

## Out Of Scope

- New shared runtime APIs.
- Refactoring primitive implementations.
- DropdownMenu, Sheet, or EMR shell stories.
- Changing Storybook/Vitest/Vite/Playwright configuration.
- DB, Supabase, RLS, server enforcement, payment, email, deploy, external provider, or real data work.
- Fixing unrelated existing worktree changes.

## Verification

- `npm run lint`
- `npx tsc --noEmit`
- `npm run docs:check`
- `npm run build-storybook`
- `npm run storybook -- --ci --smoke-test`
- Storybook MCP `list-all-documentation` includes `Dialog` and `Popover`.
- Storybook MCP focused `run-story-tests` checks for the new interaction stories.

## Handoff Notes

Ready for Human Review.

Verification completed on 2026-06-15:

- `npm run lint` passed with 5 pre-existing warnings outside this scope.
- `npx tsc --noEmit` passed.
- `npm run docs:check` passed.
- `npm run build-storybook` passed.
- `npm run storybook -- --ci --smoke-test` passed.
- Storybook MCP `list-all-documentation` includes `DialogExample` and `PopoverExample`.
- Storybook MCP `get-documentation` returned docs for `design-system-ui-dialog` and `design-system-ui-popover`.
- Storybook MCP `run-story-tests` focused checks passed for `design-system-ui-dialog--default` and `design-system-ui-popover--default`.
- The first focused MCP runs hit one-time Vite dependency optimizer dynamic-import failures; reruns passed, matching the PR-056 interaction-test policy.
