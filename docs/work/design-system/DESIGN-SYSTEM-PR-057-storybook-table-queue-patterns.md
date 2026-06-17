---
id: "DESIGN-SYSTEM-PR-057"
status: "human_review"
area: "design-system"
priority: "P1"
target_pr: "User request / Storybook table-queue pattern entry"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/storybook-operating-rules.md"
  - "docs/design/system/table-density-and-grid-ergonomics.md"
  - "docs/design/system/empty-info-state-contract.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-056-storybook-interaction-test-policy.md"
updated: "2026-06-15"
---

# Storybook Table/Queue Pattern Entry

## Goal

Start Storybook coverage for repeated EMR table and queue patterns without introducing new production component APIs.

## Scope

- Inspect existing table/queue shared components before choosing implementation.
- Add a Storybook-only helper that composes existing primitives.
- Add `Design System/EMR/Table Queue Patterns` stories for:
  - status cell
  - action cell
  - filter toolbar
  - empty table
- Use synthetic demo text only.
- Keep feature workflow stories and provider-backed data out of scope.

## Out Of Scope

- New shared runtime table or queue APIs.
- Refactoring `EmrDataTable`, queue side panels, or feature modules.
- Live data, provider state, DB, Supabase, RLS, server enforcement, payment, email, deploy, or external integrations.
- Pixel-perfect visual QA for every feature table.
- Fixing unrelated existing chart, fulfillment, lab-imaging, or previous Storybook worktree changes.

## Verification

- `npm run lint`
- `npx tsc --noEmit`
- `npm run docs:check`
- `npm run build-storybook`
- `npm run storybook -- --ci --smoke-test`
- Storybook MCP `list-all-documentation` includes `StorybookTableQueuePatterns`.
- Storybook MCP `run-story-tests` focused check for `design-system-emr-table-queue-patterns--status-cell`.

## Handoff Notes

Ready for Human Review.

This is intentionally a Storybook-only pattern entry. It documents repeated compositions using current primitives, but it does not promote a new shared production abstraction.

Verification completed on 2026-06-15:

- `npm run lint` passed with 5 pre-existing warnings outside this scope.
- `npx tsc --noEmit` passed.
- `npm run docs:check` passed.
- `npm run build-storybook` passed.
- `npm run storybook -- --ci --smoke-test` passed.
- Storybook MCP `list-all-documentation` includes `StorybookTableQueuePatterns`.
- Storybook MCP `get-documentation` returned docs for `design-system-emr-table-queue-patterns`.
- Storybook MCP `run-story-tests` focused check passed for `design-system-emr-table-queue-patterns--status-cell`.
- The first focused MCP run hit a one-time Vite dependency optimizer reload after `@base-ui/react/menu` optimization; rerun passed, matching the PR-056 interaction-test policy.
