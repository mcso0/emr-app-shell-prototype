---
id: "DESIGN-SYSTEM-PR-053"
status: "human_review"
area: "design-system"
priority: "P1"
target_pr: "User request / Storybook project-scoped MCP client"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/storybook-operating-rules.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-051-storybook-mcp-local-endpoint.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-052-storybook-mcp-doc-quality.md"
  - "https://developers.openai.com/codex/mcp"
  - "https://developers.openai.com/codex/config-reference"
  - "https://storybook.js.org/docs/ai/mcp/overview"
updated: "2026-06-15"
---

# Storybook Project-Scoped MCP Client

## Goal

Connect Codex to the local Storybook MCP endpoint through repo-scoped configuration so future UI/design-system work can query documented components without global agent setup.

## Scope

- Add a project-scoped Codex MCP server named `clair_storybook`.
- Point the MCP server to the local Storybook endpoint at `http://127.0.0.1:6006/mcp`.
- Keep the server optional so Codex can start when Storybook is not running.
- Allow the documented Storybook docs, development, preview, and focused story-test tools.
- Add short future-agent guidance to `AGENTS.md`.
- Update Storybook operating rules with the MCP client name and expected tool usage.
- Verify the raw Storybook MCP endpoint and Codex MCP configuration listing.

## Out Of Scope

- Editing global `~/.codex/config.toml`.
- Publishing, tunneling, or sharing the Storybook MCP endpoint.
- Adding remote authentication, hosted Storybook, Chromatic publishing, or team-wide distribution.
- Adding new components, stories, or runtime component API changes.
- DB, Supabase, RLS, server enforcement, payment, email, deploy, external provider, or real data work.

## Verification

- `npx tsc --noEmit`
- `npm run docs:check`
- `npm run storybook -- --ci --smoke-test`
- `codex mcp list -c service_tier='"flex"'`
- Local MCP `tools/list` check at `http://127.0.0.1:6006/mcp`
- Local MCP `list-all-documentation` check returns the existing design-system components
- MCP `run-story-tests` focused check for `design-system-ui-button--default`

## Handoff Notes

Ready for Human Review.

Current-session caveat: Codex usually loads MCP client tools at session start, so the newly configured `clair_storybook` tools may require a new Codex session or app reload before they appear as callable tools in-chat.
