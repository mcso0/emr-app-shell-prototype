---
area: "design-system"
completed: "2026-05-14"
source_docs:
  - "docs/design/system/DESIGN.md"
  - "docs/design/system/light-operational-foundation.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-003-neutral-command-semantic-status-tokens.md"
---

# Shared Semantic Token Adoption Closeout

## Summary

Applied a focused shared-component follow-up to the Neutral Command + Semantic Status direction. The pass increased EMR semantic token usage in shared UI and EMR primitives while leaving generated Clair tokens untouched and deferring feature-screen color cleanup.

## Color Usage Found

- Shared UI and shell still had local structural colors: shell frame borders, white panel surfaces, gray hover states, text-side-panel active states, input placeholders, disabled controls, line tabs, segmented controls, and content aside surfaces.
- Shared EMR primitives still had direct status or atomic color usage: status badges, side-panel type/status badges, order warning rows, count badges, patient context badges, table checkbox borders, history list hover states, and side-panel collapsible group count tones.
- Feature screens still contain the largest remaining local color surface: reception, lab/imaging, profile drawer, home kanban, chart, auth login, inpatient, customer, hospital admin, billing, and dispensing modules.
- Shell/nav areas still contain intentionally deferred local color usage, especially the dark nav rail, top menu identity moments, auth profile menu, and global command palette.

## Completed

- Converted shared status badge tones to `--emr-status-info-*`, `--emr-status-success-*`, `--emr-status-warning-*`, `--emr-status-danger-*`, and `--emr-status-neutral-*`.
- Converted shared input/select/textarea disabled and placeholder treatment to EMR surface/text aliases.
- Converted shared segmented controls, line tabs, confirm dialogs, instruction headers/filter tabs, text side panel, workspace frame, patient context bar, side-panel cards, collapsible groups, content history list, order group/queue surfaces, table checkbox, and EMR data table warning/selection affordances to shadcn or EMR semantic aliases.
- Preserved semantic status meaning: info remains blue, success green, warning orange, danger red, neutral gray.

## Deferred

- Per-screen cleanup for direct colors in feature modules.
- Dark nav rail and top-menu identity cleanup.
- Dynamic order queue status color token source consolidation.
- Icon artwork with embedded hex colors.

## Verification

Verification commands are recorded in the final result review for this pass.
