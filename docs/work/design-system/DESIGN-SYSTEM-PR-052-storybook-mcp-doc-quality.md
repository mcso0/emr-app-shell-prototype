---
id: "DESIGN-SYSTEM-PR-052"
status: "human_review"
area: "design-system"
priority: "P1"
target_pr: "User request / Storybook MCP documentation quality"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/storybook-operating-rules.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-051-storybook-mcp-local-endpoint.md"
  - "https://storybook.js.org/docs/ai/best-practices"
  - "https://storybook.js.org/docs/ai/manifests"
  - "https://storybook.js.org/docs/api/main-config/main-config-typescript"
updated: "2026-06-14"
---

# Storybook MCP Documentation Quality

## Goal

Improve the MCP-readable Storybook documentation quality for the six existing design-system stories so agents can see component purpose and prop intent instead of relying only on rendered snippets.

## Scope

- Add JSDoc summaries to the existing shared component source files.
- Add or export explicit prop aliases where the current upstream primitive types hide local EMR intent.
- Document key props for `Button`, `Badge`, `Input`, `SegmentedControl`, `EmrStatusBadge`, and `EmrInlineAlert`.
- Switch Storybook React prop extraction to `react-docgen-typescript`.
- Update Storybook operating rules with MCP doc-quality expectations.
- Verify the local MCP components manifest includes the six documented components.

## Out Of Scope

- Adding new components or new story files.
- Changing runtime component behavior, variants, styling, or public UI behavior.
- Configuring external/global agent clients.
- Publishing or sharing the Storybook MCP endpoint.
- DB, Supabase, RLS, server enforcement, payment, email, deploy, external provider, or real data work.

## Verification

- `npm run lint`
- `npx tsc --noEmit`
- `npm run docs:check`
- `npm run build-storybook`
- `npm run storybook -- --ci --smoke-test`
- Local MCP manifest check at `http://127.0.0.1:6006/manifests/components.json`.
- MCP `run-story-tests` focused check for `design-system-ui-button--default`.

## Handoff Notes

Ready for Human Review.

Recommended next step: connect a project-scoped MCP client only after reviewing the manifest output for whether the prop descriptions are clear enough for agent-assisted UI work.
