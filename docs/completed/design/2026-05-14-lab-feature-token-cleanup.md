---
area: "design-system"
completed: "2026-05-14"
source_docs:
  - "docs/design/system/DESIGN.md"
  - "docs/design/system/light-operational-foundation.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-006-lab-feature-token-cleanup.md"
---

# Lab Feature Semantic Token Cleanup Closeout

## Summary

Completed the third feature-screen cleanup after chart and reception. This pass scoped `src/features/lab-imaging/module.tsx` to lab-specific ranges and the shared attachment strip used by lab. Imaging-only ranges in the same file remain deferred to the next feature-screen PR.

## Color Usage Found

Audit pattern: direct Tailwind color utilities, hex/rgba, `clair-color-atomic-*`, `clair-color-background-*`, `clair-color-primary-*`, `clair-color-label-*`, `clair-color-line-*`, and `clair-color-static-*`.

- Lab judgment markers and badges: direct red, orange, blue, green, and gray atomic tones.
- Lab status grouping: direct gray, blue, orange, green, and mint status indicator token names.
- Lab queue and history structure: direct gray text and Clair line separators.
- Lab result table: direct neutral table header fills, label colors, row hover fill, and assignee text.
- Normal range chart and attachment previews: direct atomic chart strokes, marker fallback, surface token, gradient colors, and file/icon colors.
- Lab equipment receipt panel: direct black-alpha hover/badge border, gray text, line separators, neutral preview table headers, and direct sky action button colors.

## Completed

- Converted lab judgment and status semantics to `--emr-status-danger-*`, `--emr-status-warning-*`, `--emr-status-info-*`, `--emr-status-success-*`, and `--emr-status-neutral-*`.
- Converted neutral lab queue/table/receipt structure to `text-foreground`, `text-muted-foreground`, `bg-card`, `--emr-text-secondary`, `--emr-text-tertiary`, `--emr-line-subtle`, `--emr-surface-muted`, and `--emr-state-hover`.
- Converted lab normal range chart strokes and marker fallback to EMR status aliases.
- Converted the shared lab attachment strip preview surface and image affordance to EMR surface/status aliases.
- Added a lab-scoped source audit test that avoids imaging-only ranges in the shared `lab-imaging` module.

## Deferred

- Imaging-only ranges in `src/features/lab-imaging/module.tsx`.
- `src/features/reception/profile-drawer.tsx`.
- Then 조제/처치, 수납, 입원, 고객관리, 병원관리, and home kanban as separate feature-screen cleanup units.

## Verification

- `npx playwright test tests/design-tokens.spec.ts -g "lab workspace source uses semantic color tokens" --reporter=line` (`1 passed`)
- `npm run lint` (passed)
- `npx tsc --noEmit` (passed)
- `npm run docs:check` (passed, 225 docs/agent markdown files checked)
- `npx playwright test tests/design-tokens.spec.ts tests/lab-imaging.spec.ts --reporter=line` (`9 passed`)
