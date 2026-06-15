---
id: "DESIGN-SYSTEM-PR-058"
status: "human_review"
area: "design-system"
priority: "P1"
target_pr: "User request / Design System README Storybook summary"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/README.md"
  - "docs/design/system/storybook-operating-rules.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-048-storybook-foundation.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-057-storybook-table-queue-patterns.md"
updated: "2026-06-15"
---

# Design System README Storybook Summary

## Goal

Summarize the current Storybook state after PR-048 through PR-057 in one design-system entry page.

## Scope

- Update `docs/design/system/README.md` with current Storybook coverage.
- Document local Storybook commands.
- Document local MCP endpoint usage and focused `run-story-tests` argument shape.
- Document the current interaction test policy.
- Document the next Storybook expansion order.
- Record this work item and a closeout report.

## Out Of Scope

- Adding or changing Storybook stories.
- Changing Storybook, MCP, Vitest, Vite, or Playwright configuration.
- Rewriting canonical design-system contracts.
- DB, Supabase, RLS, server enforcement, payment, email, deploy, or external provider work.

## Verification

- `npm run docs:check`

## Handoff Notes

Ready for Human Review.

The README now gives agents and reviewers a single current-state map for Storybook status, usage, MCP workflow, interaction-test policy, and next expansion order.

Verification completed on 2026-06-15:

- `npm run docs:check` passed.
