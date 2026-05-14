---
area: "design-system"
completed: "2026-05-14"
source_docs:
  - "docs/design/system/DESIGN.md"
  - "docs/design/system/light-operational-foundation.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-012-hospital-admin-feature-token-cleanup.md"
---

# Hospital Admin Feature Semantic Token Cleanup Closeout

## Summary

Completed the ninth primary feature-screen cleanup after chart, reception, lab, imaging, dispensing/treatment, billing, inpatient, and customer. This pass scoped `src/features/hospital-admin/module.tsx`.

## Color Usage Found

Audit pattern: direct Tailwind color utilities, hex/rgba, and any `clair-color-*` local token usage.

- Order management side-nav group labels used direct Clair label color.
- Workspace and drawer static surfaces used direct Clair background colors.
- The order table header, hover state, and selected row used direct Clair neutral/fill colors.
- Active status text used direct green atomic color.
- Drawer labels and required markers used direct label/primary colors.
- Drawer footer used `bg-white/95` plus an rgba shadow.
- Delete action used direct red atomic border/text colors.

## Completed

- Converted side-nav group labels, workspace surfaces, table header, row hover/selection, drawer field labels, static surfaces, and footer to shadcn/EMR semantic tokens.
- Converted active status text to `--emr-status-success-text`.
- Converted required marker and delete action to EMR danger aliases.
- Added a hospital-admin source audit test in `tests/design-tokens.spec.ts`.

## Deferred

- `src/features/reception/profile-drawer.tsx`, home kanban/workspace, auth/login, and any remaining secondary screen cleanup units.
- Order set management and broader hospital-admin behavior expansion.

## Verification

- `npx playwright test tests/design-tokens.spec.ts -g "hospital admin workspace source" --reporter=line` (`1 passed`, failed first before implementation)
- `npm run lint` (passed)
- `npx tsc --noEmit` (passed)
- `npm run docs:check` (passed, 238 docs/agent markdown files checked)
- `npx playwright test tests/design-tokens.spec.ts tests/hospital-admin.spec.ts --reporter=line` (`15 passed`)
