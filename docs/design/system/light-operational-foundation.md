---
status: "approved"
area: "design-system"
updated: "2026-08-25"
source_docs:
  - "docs/design/references/linear-app/DESIGN.md"
  - "docs/engineering/current-status.md"
---

# Light Operational Foundation

This document translates the Linear `DESIGN.md` reference into a CLAiR EMR design-system direction.

## Intent

CLAiR EMR should remain a bright, long-session operational workspace. The Linear reference is useful for its precision, restrained hierarchy, and product-first density, not for its dark marketing canvas.

The first foundation pass should make shared EMR surfaces quieter and more consistent:

- use a small equal-channel Neutral surface ladder for app background,
  workspaces, panels, muted headers, and disabled surfaces
- use black-alpha interaction overlays for hover, selected, and active states
- prefer hairline borders over heavy shadow
- keep compact control and panel radii, mostly 8px and 12px
- keep primary emphasis on command ink, use 4%/6%/8% black overlays for
  hover/selected/active, and keep focus on its dedicated ring token
- let real product screens and dense workflow data carry the interface

## Explicit Non-Goals

- Do not introduce dark mode in this pass.
- Do not restyle every feature screen independently.
- Do not replace medical, billing, warning, danger, success, or status colors with a single brand accent.
- Do not edit generated Clair token output directly.

## Token Direction

`src/styles/tokens/clair.css` remains the generated token source. EMR-specific operational aliases live above it as a thin layer in `src/styles/tokens/emr-foundation.css`.

The public alias set for the first pass is:

- `--emr-surface-app`
- `--emr-surface-workspace`
- `--emr-surface-panel`
- `--emr-surface-muted`
- `--emr-state-hover`
- `--emr-state-selected`
- `--emr-state-active`
- `--emr-border-subtle`
- `--emr-border-default`
- `--emr-border-strong`
- `--emr-accent`
- `--emr-accent-subtle`
- `--emr-radius-control`
- `--emr-radius-panel`

These aliases are intentionally small. They should cover shared panel, list, table, and selected-surface behavior before any screen-level visual expansion.

The static surface ladder resolves to equal-channel Neutral values: white app
and panel surfaces, `#FCFCFC` workspaces, Neutral 50 muted surfaces, and Neutral
100 disabled surfaces. Interaction states are separate overlays: black 4% for
hover, black 6% for selected, and black 8% for active. The older
`--emr-surface-hover` and `--emr-surface-selected` names remain compatibility
aliases only.

The 2026-05-13 token direction clarifies that shadcn `--primary` is command ink rather than brand blue. Brand blue remains available through a limited identity token, while workflow and clinical colors move through explicit EMR status aliases.

## Component Application

The first implementation pass applies the aliases only to common EMR primitives:

- side panels and subpanel bodies
- list cards and selected list rows
- side-panel queue cards
- dense table header, row, hover, and selected surfaces
- the common `.emr-selected-surface` state utility

Buttons, status badges, semantic status colors, and screen-specific layouts should stay visually compatible unless a future work item explicitly scopes them.

## Design.md Timing

CLAiR's own `DESIGN.md` now lives at `docs/design/system/DESIGN.md`. It documents the implemented light operational system after the first foundation pass rather than speculating ahead of implementation.
