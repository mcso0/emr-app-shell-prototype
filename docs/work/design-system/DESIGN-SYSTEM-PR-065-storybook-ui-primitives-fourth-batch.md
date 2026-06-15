---
id: "DESIGN-SYSTEM-PR-065"
status: "human_review"
area: "design-system"
priority: "P1"
target_pr: "User request / Storybook UI primitive fourth batch"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/storybook-operating-rules.md"
  - "docs/design/system/README.md"
updated: "2026-06-15"
---

# Storybook UI Primitive Fourth Batch

## Goal

Continue Storybook registration for existing UI primitives by adding `Card`, `Tabs`, `RadioGroup`, and `Skeleton`.

## Scope

- Add co-located stories under `src/components/ui`.
- Keep titles under `Design System/UI/...`.
- Include autodocs tags, args, argTypes, component docs descriptions, and short story descriptions with "사용할 때 / 쓰지 말아야 할 때".
- Use synthetic demo text only.
- Use DOM API play functions only where interaction behavior is meaningful.
- Update Vitest Storybook dependency optimizer includes for new Base UI-backed stories.
- Update design-system README and work index.

## Out Of Scope

- New shared runtime APIs.
- Runtime component behavior changes.
- Migrating stories to `storybook/test` helpers.
- Feature workflow stories.
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
- Passed Storybook MCP docs visibility check:
  - `design-system-ui-card`
  - `design-system-ui-tabs`
  - `design-system-ui-radiogroup`
  - `design-system-ui-skeleton`
- Passed Storybook MCP focused `run-story-tests`:
  - `design-system-ui-card--default`
  - `design-system-ui-tabs--default`
  - `design-system-ui-radiogroup--default`
  - `design-system-ui-skeleton--default`

## Handoff Notes

Ready for Human Review.

`Tabs` keeps a DOM API play function because it documents meaningful panel switching. `RadioGroup` is rendering-only for this pass: a first DOM check that assumed `data-checked` on the radio root was too implementation-specific for Base UI's hidden input behavior, so the story now avoids a brittle assertion.
