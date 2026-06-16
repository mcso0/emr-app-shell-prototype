---
id: "DESIGN-SYSTEM-PR-064"
status: "human_review"
area: "design-system"
priority: "P1"
target_pr: "User request / Storybook empty-info-feedback patterns"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/empty-info-state-contract.md"
  - "docs/design/system/inline-alert-feedback-rules.md"
  - "docs/design/system/storybook-operating-rules.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-045-empty-info-state-contract.md"
updated: "2026-06-15"
---

# Storybook Empty Info Feedback Patterns

## Goal

Document the empty state, info box, and inline alert boundary in Storybook without creating a new shared runtime API.

## Scope

- Add Storybook-only EMR pattern helper for empty/info/alert-boundary examples.
- Add `Design System/EMR/Empty Info Feedback Patterns` stories.
- Keep copy synthetic and avoid real patient, guardian, hospital, payment, or identity data.
- Include autodocs tags, args, argTypes, component docs description, and short story descriptions with "사용할 때 / 쓰지 말아야 할 때".
- Use existing `EmrInlineAlert` for the alert boundary example.
- Update design-system README and work index.

## Out Of Scope

- Creating shared runtime `EmrEmptyState` or `EmrInfoBox` components.
- Rewriting feature-local empty states.
- Changing `EmrInlineAlert` behavior.
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
  - `design-system-emr-empty-info-feedback-patterns`
- Passed Storybook MCP focused `run-story-tests`:
  - `design-system-emr-empty-info-feedback-patterns--empty-state`

## Handoff Notes

Ready for Human Review.

This pass intentionally keeps empty/info surfaces Storybook-only. The approved contract still says shared runtime extraction should wait until repeated screen families prove the same layout and behavior.
