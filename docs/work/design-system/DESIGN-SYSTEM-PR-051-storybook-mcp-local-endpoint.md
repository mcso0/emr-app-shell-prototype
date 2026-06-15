---
id: "DESIGN-SYSTEM-PR-051"
status: "human_review"
area: "design-system"
priority: "P1"
target_pr: "User request / Storybook MCP local endpoint"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/storybook-operating-rules.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-050-storybook-emr-component-stories.md"
  - "https://storybook.js.org/docs/ai/mcp/overview"
  - "https://storybook.js.org/docs/ai/mcp/api"
updated: "2026-06-14"
---

# Storybook MCP Local Endpoint

## Goal

Enable the local Storybook MCP endpoint so compatible AI agents can inspect CLAiR EMR component stories, docs, manifests, and story-test tools from the current design-system catalog.

## Scope

- Add `@storybook/addon-mcp` as a Storybook dev dependency.
- Register the addon in `.storybook/main.ts`.
- Keep all MCP toolsets enabled for the local endpoint.
- Document local-only MCP operating rules in the Storybook operating rules.
- Verify `/mcp` and Storybook manifests are reachable from the local dev server.

## Out Of Scope

- Configuring Codex, Claude, Cursor, VS Code, or any other agent globally.
- Publishing or sharing the MCP endpoint.
- Chromatic publishing or hosted Storybook access.
- Adding remote auth, tunnel, external access, or team-wide MCP distribution.
- Changing component runtime APIs or adding new stories.
- DB, Supabase, RLS, server enforcement, payment, email, deploy, external provider, or real data work.

## Verification

- `npm run lint`
- `npx tsc --noEmit`
- `npm run docs:check`
- `npm run build-storybook`
- `npm run storybook -- --ci --smoke-test`
- Local endpoint verification:
  - `http://127.0.0.1:6006/mcp`
  - `http://127.0.0.1:6006/manifests/components.json`
  - MCP JSON-RPC `initialize` response from `@storybook/addon-mcp` 0.6.0.
  - MCP `tools/list` returns documentation, preview, and story-test tools.
  - MCP `run-story-tests` passes for `design-system-ui-button--default`.

## Handoff Notes

Ready for Human Review.

Recommended next step: connect a project-scoped agent MCP client manually only when 승욱 wants Codex or another agent to consume this endpoint during UI work.
