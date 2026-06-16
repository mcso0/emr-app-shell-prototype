---
id: "DESIGN-SYSTEM-PR-049"
status: "human_review"
area: "design-system"
priority: "P1"
target_pr: "User request / Storybook first UI primitive stories"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/DESIGN.md"
  - "docs/design/system/component-ownership-rules.md"
  - "docs/design/system/ui-refactor-dod.md"
  - "docs/design/system/storybook-operating-rules.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-048-storybook-foundation.md"
updated: "2026-06-14"
---

# Storybook First UI Primitive Stories

## Goal

Turn the empty Storybook foundation into the first AI- and human-readable CLAiR EMR component catalog by adding stable stories for `Button`, `Badge`, and `Input`.

## Scope

- Add Storybook operating rules for design-system stories.
- Add co-located stories for `Button`, `Badge`, and `Input`.
- Use `args`, `argTypes`, `tags: ["autodocs"]`, and docs descriptions.
- Document generic UI usage boundaries, including the rule that domain status belongs in EMR-specific status components.
- Preserve runtime component APIs and implementation files.

## Out Of Scope

- `SegmentedControl`, `EmrStatusBadge`, `EmrInlineAlert`, or other follow-up stories.
- Storybook MCP / AI addon setup.
- Chromatic publishing or hosted Storybook access.
- Feature workflow stories for chart, reception, billing, or other app screens.
- DB, Supabase, RLS, server enforcement, payment, email, deploy, external provider, or real data work.

## Verification

- `npm run lint`
- `npx tsc --noEmit`
- `npm run docs:check`
- `npm run build-storybook`
- `npm run storybook -- --ci --smoke-test`
- Browser verification at local Storybook confirms `Design System/UI/Button`, `Design System/UI/Badge`, and `Design System/UI/Input` appear in the sidebar.

## Handoff Notes

Ready for Human Review.

Recommended next step: add EMR-specific stories for `SegmentedControl`, `EmrStatusBadge`, and `EmrInlineAlert`, then evaluate Storybook MCP / AI addon setup.
