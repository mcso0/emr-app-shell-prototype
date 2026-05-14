---
area: "design-system"
completed: "2026-05-14"
source_docs:
  - "docs/design/system/DESIGN.md"
  - "docs/design/system/light-operational-foundation.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-010-inpatient-feature-token-cleanup.md"
---

# Inpatient Feature Semantic Token Cleanup Closeout

## Summary

Completed the seventh feature-screen cleanup after chart, reception, lab, imaging, dispensing/treatment, and billing. This pass scoped `src/features/inpatient/module.tsx`.

## Color Usage Found

Audit pattern: direct Tailwind color utilities, hex/rgba, and any `clair-color-*` local token usage.

- Inpatient status badges used direct blue, red, and green atomic colors.
- Caution tags used direct green, red, orange, and purple atomic colors.
- KPI cards used direct local tone classes for accent bars and icons.
- Summary cards used an rgba shadow value.
- Selected table rows used direct sky selected-state colors.
- Ward section headers, page background, and title icon used direct local fill/text tokens.

## Completed

- Converted admission statuses to `--emr-status-info-*`, `--emr-status-danger-*`, and `--emr-status-success-*`.
- Converted caution tags to success, danger, warning, and neutral status aliases.
- Converted KPI card tones to EMR semantic status aliases, with the previous purple tone mapped to neutral.
- Converted selected rows, ward headers, page background, title icon, and card shadow to shadcn/EMR semantic tokens.
- Added an inpatient source audit test in `tests/design-tokens.spec.ts`.

## Deferred

- 고객관리 and 병원관리 as later primary feature-screen cleanup units.
- `src/features/reception/profile-drawer.tsx`, home kanban/workspace, and auth/login cleanup after primary feature screens.

## Verification

- `npx playwright test tests/design-tokens.spec.ts -g "inpatient workspace source" --reporter=line` (`1 passed`, failed first before implementation)
- `npm run lint` (passed)
- `npx tsc --noEmit` (passed)
- `npm run docs:check` (passed, 234 docs/agent markdown files checked)
- `npx playwright test tests/design-tokens.spec.ts tests/inpatient.spec.ts --reporter=line` (`11 passed`)
