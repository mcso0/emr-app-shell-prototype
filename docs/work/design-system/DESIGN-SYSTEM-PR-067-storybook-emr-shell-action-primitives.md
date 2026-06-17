---
id: "DESIGN-SYSTEM-PR-067"
status: "human_review"
area: "design-system"
priority: "P1"
target_pr: "User request / Storybook EMR shell-action primitives"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/storybook-operating-rules.md"
  - "docs/design/system/dialog-shell-rules.md"
  - "docs/design/system/row-action-menu-rules.md"
updated: "2026-06-15"
---

# Storybook EMR Shell Action Primitives

## Goal

Register EMR shell/action primitives in Storybook: `EmrDialogShell`, `EmrRowActionMenu`, and `EmrPageHeader`.

## Scope

- Add co-located stories under `src/components/emr`.
- Keep titles under `Design System/EMR/...`.
- Include autodocs tags, args, argTypes, component docs descriptions, and short story descriptions with "사용할 때 / 쓰지 말아야 할 때".
- Use synthetic demo text only.
- Use DOM API play functions for dialog/menu open checks.
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
  - `design-system-emr-emrdialogshell`
  - `design-system-emr-emrrowactionmenu`
  - `design-system-emr-emrpageheader`
- Passed Storybook MCP focused `run-story-tests`:
  - `design-system-emr-emrdialogshell--confirm`
  - `design-system-emr-emrrowactionmenu--default`
  - `design-system-emr-emrpageheader--default`

## Handoff Notes

Ready for Human Review.

`EmrDialogShell` is rendered inside the shared `Dialog` root in stories because the shell wraps `DialogContent` and depends on dialog context. `EmrRowActionMenu` keeps the DOM API open check to verify portal menu rendering.
