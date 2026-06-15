---
id: "DESIGN-SYSTEM-PR-066"
status: "human_review"
area: "design-system"
priority: "P1"
target_pr: "User request / Storybook table-separator-inputotp primitives"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/storybook-operating-rules.md"
  - "docs/design/system/README.md"
updated: "2026-06-15"
---

# Storybook Table Separator InputOTP Primitives

## Goal

Continue Storybook registration for existing UI primitives by adding `Table`, `Separator`, and `InputOTP`.

## Scope

- Add co-located stories under `src/components/ui`.
- Keep titles under `Design System/UI/...`.
- Include autodocs tags, args, argTypes, component docs descriptions, and short story descriptions with "사용할 때 / 쓰지 말아야 할 때".
- Use synthetic demo text only.
- Update Vitest Storybook dependency optimizer includes for `input-otp`.
- Update design-system README and work index.

## Out Of Scope

- New shared runtime APIs.
- Runtime component behavior changes.
- Migrating stories to `storybook/test` helpers.
- Feature workflow stories.
- DB, Supabase, RLS, server enforcement, payment, email, deploy, external provider, or real data work.
- Real invite, verification, identity, payment, patient, guardian, or hospital data.
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
  - `design-system-ui-table`
  - `design-system-ui-separator`
  - `design-system-ui-inputotp`
- Passed Storybook MCP focused `run-story-tests`:
  - `design-system-ui-table--default`
  - `design-system-ui-separator--horizontal`
  - `design-system-ui-inputotp--default`

## Handoff Notes

Ready for Human Review.

`InputOTP` stories use controlled synthetic display values with a no-op `onChange`; real invite, verification, identity, or payment codes must not be placed in Storybook.
