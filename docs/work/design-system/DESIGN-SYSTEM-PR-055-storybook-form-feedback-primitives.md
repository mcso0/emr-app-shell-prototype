---
id: "DESIGN-SYSTEM-PR-055"
status: "human_review"
area: "design-system"
priority: "P1"
target_pr: "User request / Storybook form-feedback primitive stories"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/storybook-operating-rules.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-054-storybook-mcp-dogfood-pass.md"
updated: "2026-06-15"
---

# Storybook Form/Feedback Primitive Stories

## Goal

Continue Storybook stage 5 by registering a second batch of existing form/feedback primitives after PR-048 through PR-054.

## Scope

- Inspect `src/components/ui` and `src/components/emr` before choosing targets.
- Add co-located Storybook stories for three existing UI primitives:
  - `Textarea`
  - `Select`
  - `Field` / `FieldError`
- Keep story titles under `Design System/UI/...`.
- Include `tags: ["autodocs"]`, `args`, `argTypes`, and `parameters.docs.description.component`.
- Include short "use when / do not use when" guidance in story descriptions.
- Use only synthetic demo text.
- Keep the work limited to Storybook story registration and documentation records.

## Out Of Scope

- New shared runtime component APIs.
- Runtime component refactors for story convenience.
- EMR feature workflow stories.
- DB, Supabase, RLS, server enforcement, payment, email, deploy, external provider, or real data work.
- Publishing, tunneling, or sharing the Storybook MCP endpoint.
- Fixing unrelated existing chart, fulfillment, lab-imaging, or previous Storybook worktree changes.

## Verification

- `npm run lint`
- `npx tsc --noEmit`
- `npm run docs:check`
- `npm run build-storybook`
- `npm run storybook -- --ci --smoke-test`
- MCP or local endpoint check that the new stories appear in `list-all-documentation`.
- Focused `run-story-tests` check for at least one new story when available.

## Handoff Notes

Ready for Human Review.

This pass adds the next Storybook form/feedback primitive batch without changing runtime component APIs. The selected targets are existing primitives in `src/components/ui`; no matching `EmptyState` primitive was present in `src/components/ui` or `src/components/emr` during the initial scan.

Verification completed on 2026-06-15:

- `npm run lint` passed with 5 pre-existing warnings outside this scope.
- `npx tsc --noEmit` passed.
- `npm run docs:check` passed.
- `npm run build-storybook` passed.
- `npm run storybook -- --ci --smoke-test` passed.
- Storybook MCP `list-all-documentation` includes `Field`, `Select`, and `Textarea`.
- Storybook MCP `get-documentation` returned docs for `design-system-ui-field`, `design-system-ui-select`, and `design-system-ui-textarea`.
- Storybook MCP `run-story-tests` focused check passed for `design-system-ui-textarea--default`.
- While the dev server was watching, the first broad MCP test pass hit a transient Vite dependency optimizer reload; the automatic rerun passed all 40 stories.
