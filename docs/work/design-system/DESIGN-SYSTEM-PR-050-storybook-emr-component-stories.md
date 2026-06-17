---
id: "DESIGN-SYSTEM-PR-050"
status: "human_review"
area: "design-system"
priority: "P1"
target_pr: "User request / Storybook EMR component stories"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/DESIGN.md"
  - "docs/design/system/component-ownership-rules.md"
  - "docs/design/system/inline-alert-feedback-rules.md"
  - "docs/design/system/storybook-operating-rules.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-049-storybook-first-ui-stories.md"
updated: "2026-06-14"
---

# Storybook EMR Component Stories

## Goal

Extend the first Storybook catalog from generic UI primitives into the next stable reusable controls: `SegmentedControl`, `EmrStatusBadge`, and `EmrInlineAlert`.

## Scope

- Add a co-located story for `SegmentedControl`.
- Add co-located stories for `EmrStatusBadge` and `EmrInlineAlert`.
- Use `args`, `argTypes`, `tags: ["autodocs"]`, and docs descriptions.
- Document usage boundaries for compact filters, EMR workflow status labels, and persistent inline feedback.
- Preserve runtime component APIs and implementation files.

## Out Of Scope

- Storybook MCP / AI addon setup.
- Chromatic publishing or hosted Storybook access.
- Feature workflow stories for chart, reception, billing, or other app screens.
- New status tone resolver API or expanded domain status taxonomy.
- DB, Supabase, RLS, server enforcement, payment, email, deploy, external provider, or real data work.

## Verification

- `npm run lint`
- `npx tsc --noEmit`
- `npm run docs:check`
- `npm run build-storybook`
- `npm run storybook -- --ci --smoke-test`
- Browser verification at local Storybook confirms `Design System/UI/SegmentedControl`, `Design System/EMR/EmrStatusBadge`, and `Design System/EMR/EmrInlineAlert` appear in the sidebar and render previews.

## Handoff Notes

Ready for Human Review.

Recommended next step: evaluate Storybook MCP / AI addon setup after reviewing whether these six stories are clear enough for agent reuse.
