---
id: "DESIGN-SYSTEM-PR-063"
status: "human_review"
area: "design-system"
priority: "P1"
target_pr: "User request / Storybook dropdown-sheet primitive stories"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/storybook-operating-rules.md"
  - "docs/design/system/README.md"
updated: "2026-06-15"
---

# Storybook Dropdown Sheet Primitive Stories

## Goal

Continue the Storybook design-system expansion by documenting two existing overlay primitives: `DropdownMenu` and `Sheet`.

## Scope

- Add co-located Storybook stories for existing `src/components/ui/dropdown-menu.tsx`.
- Add co-located Storybook stories for existing `src/components/ui/sheet.tsx`.
- Keep story titles under `Design System/UI/...`.
- Include autodocs tags, args, argTypes, component docs descriptions, and short story descriptions with "사용할 때 / 쓰지 말아야 할 때".
- Use synthetic demo text only.
- Use DOM API based play functions for focused open-state checks.
- Update design-system README and work index.

## Out Of Scope

- New shared runtime APIs.
- Runtime component behavior changes.
- Migrating stories to `storybook/test` helpers.
- Adding feature workflow stories.
- DB, Supabase, RLS, server enforcement, payment, email, deploy, external provider, or real data work.
- Fixing unrelated existing worktree changes.

## Verification

- Passed `npm run lint`.
  - Existing warnings remain in `scripts/owner-os.mjs`, `src/features/auth/workspace-membership-management.tsx`, `src/features/chart/module.tsx`, and `src/features/hospital-admin/store.ts`.
- Passed `npx tsc --noEmit`.
- Passed `npm run docs:check`.
- Passed `npm run build-storybook`.
  - Existing Storybook build warnings remain: no `src/**/*.mdx`, `.storybook/preview.tsx` docgen skip, unresolved Pretendard font at build time, plugin timing notes, and chunk-size warnings.
- Passed `npm run storybook -- --ci --smoke-test`.
- Passed Storybook MCP docs visibility check:
  - `design-system-ui-dropdownmenu`
  - `design-system-ui-sheet`
- Passed Storybook MCP focused `run-story-tests`:
  - `design-system-ui-dropdownmenu--default`
  - `design-system-ui-sheet--default`

## Handoff Notes

Ready for Human Review after verification is complete.

Focused MCP testing caught an initial story composition issue: `DropdownMenuLabel` must be nested inside `DropdownMenuGroup` because Base UI requires `Menu.Group` context for group labels. The story was corrected before final verification.
