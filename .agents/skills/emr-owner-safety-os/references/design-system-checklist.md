# Design System Checklist

Use after approval for UI, visual consistency, shared component, or design-system review.

## Required Context

- `docs/design/system/DESIGN.md`
- `docs/design/system/component-ownership-rules.md`
- Relevant design-system docs for tables, dialogs, feedback, row actions, or token cleanup.

## Checks

- Tokens: uses shadcn semantic tokens and CLAiR EMR alias tokens where established.
- Colors: avoids arbitrary direct color classes unless explicitly allowed by existing docs.
- Typography: size, weight, and hierarchy match dense operational UI.
- Spacing: repeated surfaces use consistent spacing and compact density.
- Components: buttons, badges, cards, tables, dialogs, sheets, popovers, inputs, selects use shared primitives when available.
- Status badges: colors and labels match workflow meaning.
- Surface layers: app shell, panels, cards, drawers, popovers, and modals have consistent hierarchy.
- Generated token files: do not edit generated token outputs directly.

## CLAiR EMR Defaults

- B2B EMR screens should be quiet, dense, and scan-friendly.
- Avoid decorative one-note palettes or marketing-style layouts for operational workspaces.
- Use cards for repeated items or framed tools, not nested page sections.
- Text must not overflow, overlap, or resize layout unexpectedly.

## Report Evidence

For each issue, identify whether it is:

- system violation
- pattern mismatch
- local polish
- acceptable deviation
