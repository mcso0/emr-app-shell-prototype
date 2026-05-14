---
area: "design-system"
completed: "2026-05-14"
source_docs:
  - "docs/design/system/DESIGN.md"
  - "docs/design/system/light-operational-foundation.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-008-dispensing-treatment-feature-token-cleanup.md"
---

# Dispensing/Treatment Feature Semantic Token Cleanup Closeout

## Summary

Completed the fifth feature-screen cleanup after chart, reception, lab, and imaging. This pass scoped `src/features/dispensing/module.tsx`.

## Color Usage Found

Audit pattern: direct Tailwind color utilities, hex/rgba, `clair-color-atomic-*`, `clair-color-background-*`, `clair-color-primary-*`, `clair-color-label-*`, `clair-color-line-*`, and `clair-color-static-*`.

- Content aside history divider used a direct Clair line token.
- Group status action buttons used direct sky border/fill tokens and primary local text.
- Order group meta and action divider used direct Clair label/line tokens.

## Completed

- Converted the history divider to `--emr-line-subtle`.
- Converted completed action state to `--emr-status-success-*`.
- Converted in-progress action state to `--emr-status-info-*`.
- Converted order group neutral meta text and divider to shadcn/EMR semantic tokens.
- Added a dispensing/treatment source audit test in `tests/design-tokens.spec.ts`.

## Deferred

- 수납, 입원, 고객관리, 병원관리 as later feature-screen cleanup units.
- `src/features/reception/profile-drawer.tsx`, home kanban/workspace, and auth/login cleanup after primary feature screens.

## Verification

- `npx playwright test tests/design-tokens.spec.ts -g "dispensing/treatment workspace source" --reporter=line` (`1 passed`)
- `npm run lint` (passed)
- `npx tsc --noEmit` (passed)
- `npm run docs:check` (passed, 230 docs/agent markdown files checked)
- `npx playwright test tests/design-tokens.spec.ts tests/app-shell.spec.ts --reporter=line` (`28 passed`)
