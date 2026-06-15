---
id: "DESIGN-SYSTEM-PR-059"
status: "human_review"
area: "design-system"
priority: "P1"
target_pr: "User request / Storybook UI primitive third batch"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/storybook-operating-rules.md"
  - "docs/design/system/README.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-058-design-system-readme-storybook-summary.md"
updated: "2026-06-15"
---

# Storybook UI Primitive Third Batch

## Goal

Continue Storybook primitive registration after the form/feedback batch by adding documentation coverage for existing `Checkbox`, `Switch`, and `Tooltip` primitives.

## Scope

- Inspect existing `src/components/ui` primitives and app usage first.
- Add co-located stories for:
  - `Checkbox`
  - `Switch`
  - `Tooltip`
- Keep titles under `Design System/UI/...`.
- Include autodocs tags, args, argTypes, component descriptions, and story-level "use when / do not use when" guidance.
- Use synthetic demo text only.
- Update the Design System README coverage table.
- Record this work item and a closeout report.

## Out Of Scope

- New shared runtime APIs.
- Refactoring primitive implementations.
- Dialog, popover, dropdown, or sheet stories.
- DB, Supabase, RLS, server enforcement, payment, email, deploy, external provider, or real data work.
- Fixing unrelated existing worktree changes.

## Verification

- `npm run lint`
- `npx tsc --noEmit`
- `npm run docs:check`
- `npm run build-storybook`
- `npm run storybook -- --ci --smoke-test`
- Storybook MCP `list-all-documentation` includes `Checkbox`, `Switch`, and `Tooltip`.
- Storybook MCP focused `run-story-tests` check for at least one new story.

## Handoff Notes

Ready for Human Review.

Verification completed on 2026-06-15:

- `npm run lint` passed with 5 pre-existing warnings outside this scope.
- `npx tsc --noEmit` passed.
- `npm run docs:check` passed.
- `npm run build-storybook` passed.
- `npm run storybook -- --ci --smoke-test` passed.
- Storybook MCP `list-all-documentation` includes `Checkbox`, `Switch`, and `Tooltip`.
- Storybook MCP `get-documentation` returned docs for `design-system-ui-checkbox`, `design-system-ui-switch`, and `design-system-ui-tooltip`.
- Storybook MCP `run-story-tests` focused check passed for `design-system-ui-checkbox--default`.
- The first focused MCP run hit a one-time Vite dependency optimizer dynamic-import failure; rerun passed, matching the PR-056 interaction-test policy.
