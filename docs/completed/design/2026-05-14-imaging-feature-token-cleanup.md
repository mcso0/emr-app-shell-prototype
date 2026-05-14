---
area: "design-system"
completed: "2026-05-14"
source_docs:
  - "docs/design/system/DESIGN.md"
  - "docs/design/system/light-operational-foundation.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-007-imaging-feature-token-cleanup.md"
---

# Imaging Feature Semantic Token Cleanup Closeout

## Summary

Completed the fourth feature-screen cleanup after chart, reception, and lab. This pass scoped `src/features/lab-imaging/module.tsx` to imaging-specific ranges after the lab cleanup was completed.

## Color Usage Found

Audit pattern: direct Tailwind color utilities, hex/rgba, `clair-color-atomic-*`, `clair-color-background-*`, `clair-color-primary-*`, `clair-color-label-*`, `clair-color-line-*`, and `clair-color-static-*`.

- Imaging status grouping: direct gray, blue, orange, green, and mint status indicator token names.
- Imaging queue and chart cards: direct gray text, dot separators, and Clair line separators.
- Imaging content aside and status actions: direct line separators, sky action button border/fill/text, and primary local text.
- Imaging order detail table and reading toolbar: direct neutral table header fills and alternative label colors.
- Imaging content/right panel: direct yellow note banner, neutral toolbar/file row fills, primary file link text, and dark media thumbnail gradient.

## Completed

- Converted imaging status semantics to `--emr-status-neutral-text`, `--emr-status-info-text`, `--emr-status-warning-text`, and `--emr-status-success-text`.
- Converted imaging queue/history neutral structure to `text-muted-foreground`, `--emr-text-secondary`, `--emr-text-tertiary`, and `--emr-line-subtle`.
- Converted imaging status action buttons and order detail table headers to EMR/shadcn semantic tokens.
- Converted the reading toolbar, warning note, media thumbnail, summary toolbar, and file rows to EMR surface/text/status aliases.
- Added an imaging-scoped source audit test that complements the existing lab-scoped audit in the shared `lab-imaging` module.

## Deferred

- 조제/처치 feature screen cleanup.
- 수납, 입원, 고객관리, 병원관리 as later feature-screen cleanup units.
- `src/features/reception/profile-drawer.tsx` and home kanban/workspace cleanup after primary feature screens.

## Verification

- `npx playwright test tests/design-tokens.spec.ts -g "imaging workspace source uses semantic color tokens" --reporter=line` (`1 passed`)
- `npm run lint` (passed)
- `npx tsc --noEmit` (passed)
- `npm run docs:check` (passed, 228 docs/agent markdown files checked)
- `npx playwright test tests/design-tokens.spec.ts tests/lab-imaging.spec.ts --reporter=line` (`10 passed`)
