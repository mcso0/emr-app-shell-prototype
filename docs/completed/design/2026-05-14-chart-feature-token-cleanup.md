---
area: "design-system"
completed: "2026-05-14"
source_docs:
  - "docs/design/system/DESIGN.md"
  - "docs/design/system/light-operational-foundation.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-004-chart-feature-token-cleanup.md"
---

# Chart Feature Semantic Token Cleanup Closeout

## Summary

Completed the first feature-screen cleanup after shared semantic token adoption. This pass changed only the 진료(차트) screen and left generated Clair tokens untouched.

## Color Usage Found

Audit pattern: direct Tailwind color utilities, hex/rgba, `clair-color-atomic-*`, `clair-color-background-*`, `clair-color-primary-*`, and `clair-color-label-*`.

- `src/features/chart/module.tsx`: local neutral text, tab active/hover colors, SOAP toolbar/link/placeholder colors, popover rgba shadow, diagnosis search selected/hover colors, order draft/info text, quantity error border, delete text, and resize drag colors.
- `src/features/reception/module.tsx`: 96 remaining matches, mostly calendar/event palettes, wait-time/status colors, blue selected/hover affordances, local shadows, dialog/footer surfaces, and label/gray text tokens.
- `src/features/lab-imaging/module.tsx`: 78 remaining matches, mostly result/status marker palettes, result badge tones, SVG chart strokes, table header neutrals, media preview gradients, warning panels, and action button blue affordances.
- `src/features/reception/profile-drawer.tsx`: 67 remaining matches, mostly picker selected/hover states, form icon/text colors, info/warning/danger panels, white dialog footers, and local selection cards.
- `src/features/home/components/home-kanban-workspace.tsx`: 27 remaining matches, mostly kanban status indicators, gradient/white surfaces, blue filter selected states, gray typography, progress bars, and local shadows.

## Completed

- Converted chart screen neutral structure to `text-muted-foreground`, `text-foreground`, `--emr-state-hover`, `--emr-state-selected`, `--emr-state-drag`, and existing EMR surface/line aliases.
- Converted chart informational/link emphasis to `--emr-text-link` and `--emr-status-info-text`.
- Converted chart danger/error affordances to `text-destructive` and `--emr-status-danger-border`.
- Replaced the SOAP floating toolbar rgba shadow with a shared Tailwind shadow utility.
- Confirmed `src/features/chart/module.tsx` has zero remaining matches for the audit pattern.

## Deferred

- `src/features/reception/module.tsx`
- `src/features/lab-imaging/module.tsx`
- `src/features/reception/profile-drawer.tsx`
- `src/features/home/components/home-kanban-workspace.tsx`
- Then auth/login, inpatient, customer, hospital-admin, billing, and dispensing if needed.

## Verification

- `npm run lint`
- `npx tsc --noEmit`
- `npm run docs:check`
- `npx playwright test tests/chart.spec.ts --reporter=line` (`16 passed`)
