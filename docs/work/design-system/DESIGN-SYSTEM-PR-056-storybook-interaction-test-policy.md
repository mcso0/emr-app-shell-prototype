---
id: "DESIGN-SYSTEM-PR-056"
status: "human_review"
area: "design-system"
priority: "P1"
target_pr: "User request / Storybook interaction test policy"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/storybook-operating-rules.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-054-storybook-mcp-dogfood-pass.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-055-storybook-form-feedback-primitives.md"
updated: "2026-06-15"
---

# Storybook Interaction Test Policy

## Goal

Stabilize the near-term Storybook interaction test policy after MCP `run-story-tests` exposed runner fragility around `storybook/test` helpers and Vite dependency optimizer reloads.

## Decision

Use DOM API based `play` functions for now when a story needs interaction coverage. Do not import `storybook/test` helpers in new `play` functions until a dedicated follow-up proves the current Storybook MCP runner and addon-vitest setup initialize those helpers consistently.

This is a policy decision, not a permanent ban. Revisit addon-vitest configuration only when interaction coverage grows enough to justify the config/debug scope or when helper support is needed for maintainability.

## Scope

- Confirm PR-055 completed the form/feedback primitive story registration.
- Document when to add a `play` function versus keeping rendering-only stories.
- Document the DOM API play-function pattern currently allowed.
- Document the correct MCP `run-story-tests` focused argument shape.
- Document how to treat one-time Vite dependency optimizer reload failures.
- Record this work item and a closeout report.

## Out Of Scope

- Changing Storybook, Vitest, Vite, or Playwright configuration.
- Migrating existing stories to `storybook/test` helpers.
- Adding new component stories.
- Debugging unrelated existing worktree warnings or feature changes.
- DB, Supabase, RLS, server enforcement, payment, email, deploy, external provider, or real data work.

## Verification

- `npm run docs:check`
- Confirm `docs/design/system/storybook-operating-rules.md` contains the interaction-test policy.

## Handoff Notes

Ready for Human Review.

Near-term rule: prefer rendering-only stories unless interaction behavior is worth verifying; when interaction is needed, use DOM APIs and plain thrown errors inside `play`. Use MCP focused test calls with `stories: [{ storyId }]`.
