---
id: "DESIGN-SYSTEM-PR-003"
status: "done"
area: "design-system"
priority: "P1"
target_pr: "PR 3"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/DESIGN.md"
  - "docs/design/system/light-operational-foundation.md"
dependencies:
  - "DESIGN-SYSTEM-PR-001"
  - "DESIGN-SYSTEM-PR-002"
updated: "2026-05-13"
---

# Neutral Command Semantic Status Tokens

## Goal

Align CLAiR's shadcn semantic tokens and shared EMR primitives around neutral command actions, quiet operational surfaces, and distinct semantic status colors.

## Scope

- Move active shadcn overrides into the EMR foundation token layer.
- Treat `--primary` as command ink instead of brand blue.
- Reserve blue for information, links, and limited brand identity moments.
- Apply neutral/cool-neutral hover, selected, focus, border, and text hierarchy tokens to shared UI and EMR primitives.
- Add token contract coverage and update canonical design docs.

## Out Of Scope

- Editing generated Clair token output directly.
- Introducing dark mode.
- Recoloring every feature screen independently.
- Replacing medical, billing, warning, danger, success, or progress statuses with one brand accent.

## Done When

- shadcn `Button`, `Input`, and `Table` primitives use the neutral command token direction.
- Shared EMR card, subpanel, and data table primitives use EMR state aliases for hover and selected states.
- Design docs state that accent no longer owns default selected/focus/primary behavior.

## Verification

- `npm run lint`
- `npx tsc --noEmit`
- `npm run docs:check`
- `npx playwright test tests/design-tokens.spec.ts tests/chart.spec.ts tests/app-shell.spec.ts --reporter=line`

## Handoff Notes

Implemented on 2026-05-13 in `codex/neutral-command-token-rollout`. Existing warning output from Next worktree root inference, Tiptap duplicate extensions, and duplicate encounter keys is not part of this design-token rollout.
