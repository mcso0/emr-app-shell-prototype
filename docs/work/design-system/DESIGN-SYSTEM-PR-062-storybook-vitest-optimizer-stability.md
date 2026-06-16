---
id: "DESIGN-SYSTEM-PR-062"
status: "human_review"
area: "design-system"
priority: "P1"
target_pr: "User request / Storybook Vitest optimizer stability"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/storybook-operating-rules.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-056-storybook-interaction-test-policy.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-061-storybook-table-queue-patterns-second-pass.md"
updated: "2026-06-15"
---

# Storybook Vitest Optimizer Stability

## Goal

Reduce first-run Storybook MCP `run-story-tests` instability caused by Vite dependency optimizer reloads during Vitest browser runs.

## Scope

- Update the Storybook Vitest project config with explicit `optimizeDeps.include` entries for Base UI packages currently used by documented primitives and patterns.
- Keep the change limited to test/dev optimization config.
- Preserve the PR-056 DOM API play-function policy.
- Record this work item and a closeout report.

## Out Of Scope

- Changing runtime component APIs or story behavior.
- Migrating play functions to `storybook/test` helpers.
- Upgrading Storybook, Vitest, Vite, Playwright, or Base UI.
- Adding new component stories.
- DB, Supabase, RLS, server enforcement, payment, email, deploy, external provider, or real data work.
- Fixing unrelated existing worktree changes.

## Verification

- Passed `npm run lint`.
  - Existing warnings remain in `scripts/owner-os.mjs`, `src/features/auth/workspace-membership-management.tsx`, `src/features/chart/module.tsx`, and `src/features/hospital-admin/store.ts`.
- Passed `npx tsc --noEmit`.
- Passed `npm run docs:check`.
- Passed `npm run build-storybook`.
  - Existing Storybook build warnings remain: no `src/**/*.mdx`, `.storybook/preview.tsx` docgen skip, unresolved Pretendard font at build time, and chunk-size warnings.
- Passed `npm run storybook -- --ci --smoke-test`.
- Passed Storybook MCP focused `run-story-tests` after restarting the local Storybook server:
  - `design-system-ui-dialog--default`
  - `design-system-ui-popover--default`
  - `design-system-emr-table-queue-patterns--sortable-filterable-header`

## Handoff Notes

Ready for Human Review.

This config change follows the Vitest browser-run warning that recommended adding newly optimized dependencies to `optimizeDeps.include`. After a clean Storybook restart, the representative focused MCP story tests passed on first run without the previous Base UI optimizer reload failure.
