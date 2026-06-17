---
id: "DESIGN-SYSTEM-PR-054"
status: "human_review"
area: "design-system"
priority: "P1"
target_pr: "User request / Storybook MCP dogfood pass"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/storybook-operating-rules.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-053-storybook-project-mcp-client.md"
updated: "2026-06-15"
---

# Storybook MCP Dogfood Pass

## Goal

Verify the Storybook MCP workflow by using the local MCP endpoint to inspect documented primitives, then add a small synthetic recipe story composed only from documented `Button`, `Input`, and `Badge` props.

## Scope

- Query the local Storybook MCP endpoint for the component catalog.
- Query Storybook MCP documentation for `Button`, `Input`, and `Badge`.
- Query Storybook MCP story-writing instructions before editing story files.
- Add one recipe story file under `src/components/ui/`.
- Add one Storybook-only helper component file so the MCP manifest can expose recipe props and purpose.
- Use only synthetic labels and no real customer, patient, guardian, hospital, payment, or identity data.
- Add a focused play interaction for the recipe story.
- Update Storybook operating rules for `Design System/Recipes/*` dogfood examples.
- Record this work item and a closeout report.

## Out Of Scope

- New production components or runtime component API changes.
- Exporting the Storybook-only helper from the app component API.
- Feature workflow stories backed by real app providers or data.
- DB, Supabase, RLS, server enforcement, payment, email, deploy, external provider, or real data work.
- Publishing, tunneling, or sharing the Storybook MCP endpoint.
- Fixing unrelated existing worktree changes.

## Verification

- `npm run lint`
- `npx tsc --noEmit`
- `npm run docs:check`
- `npm run build-storybook`
- `npm run storybook -- --ci --smoke-test`
- MCP `list-all-documentation` check includes the recipe story.
- MCP `get-documentation` check for the recipe story.
- MCP `run-story-tests` focused check for `design-system-recipes-storybook-mcp-dogfood--search-form-recipe`.

## Handoff Notes

Ready for Human Review.

This pass confirms the Storybook MCP endpoint is useful for a small agent-assisted composition workflow before expanding into the next component batch.

The recipe play function intentionally uses DOM APIs instead of importing `storybook/test` helpers. In the current local Storybook 10.4.4 / addon-vitest 10.4.4 runner, importing `storybook/test` caused a universal-store initialization failure during MCP `run-story-tests`.
