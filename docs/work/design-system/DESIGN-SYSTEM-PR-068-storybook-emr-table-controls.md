---
id: "DESIGN-SYSTEM-PR-068"
status: "human_review"
area: "design-system"
priority: "P1"
target_pr: "User request / Storybook EMR table controls"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/storybook-operating-rules.md"
  - "docs/design/system/table-density-and-grid-ergonomics.md"
updated: "2026-06-15"
---

# Storybook EMR Table Controls

## Goal

Register EMR table controls and primitives in Storybook.

## Scope

- Add stories for `EmrTableFilterBuilder`, `EmrTableDensitySelector`, `EmrTableCheckbox`, and `EmrTablePrimitives`.
- Keep titles under `Design System/EMR/...`.
- Include autodocs tags, args, argTypes, component docs descriptions, and short story descriptions with "사용할 때 / 쓰지 말아야 할 때".
- Use synthetic demo text only.
- Use local story state only; do not change runtime APIs.
- Update design-system README and work index.

## Out Of Scope

- Runtime component behavior changes.
- Feature workflow stories or real table data.
- Server query, persistence, DB, Supabase, RLS, payment, email, deploy, external provider, or real data work.
- Fixing unrelated existing worktree changes.

## Verification

- Passed on 2026-06-15:
  - `npm run lint` passed with existing unrelated warnings.
  - `npx tsc --noEmit` passed.
  - `npm run docs:check` passed.
  - `npm run build-storybook` passed with existing Storybook build warnings.
  - `npm run storybook -- --ci --smoke-test` passed.
  - Storybook MCP docs visibility check found `EmrTableFilterBuilder`, `EmrTableDensitySelector`, `EmrTableCheckbox`, and `EmrTablePrimitives`.
  - Focused Storybook MCP `run-story-tests` passed for the new table control stories.

## Handoff Notes

Ready for Human Review.
