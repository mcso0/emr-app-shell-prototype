---
area: "design-system"
completed: "2026-05-14"
source_docs:
  - "docs/design/system/DESIGN.md"
  - "docs/design/system/light-operational-foundation.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-013-profile-drawer-token-cleanup.md"
---

# Profile Drawer Semantic Token Cleanup Closeout

## Summary

Completed the first residual screen cleanup after the primary feature screens. This pass scoped the shared 환자/보호자 profile drawer and registration dialog in `src/features/reception/profile-drawer.tsx`.

## Color Usage Found

Audit pattern: direct Tailwind color utilities, hex/rgba, and any `clair-color-*` local token usage.

- Drawer field labels, section legends, and helper counters used direct Clair label/gray colors.
- Registration close/search icons used direct gray colors and local hover surfaces.
- Breed/guardian popover options and registration mode cards used direct selected-state colors.
- Duplicate guardian/patient and validation surfaces used direct red/yellow atomic colors.
- Visit context/session-only notes used direct sky info colors.
- Guardian/patient confirmation summaries used direct sky/green tone colors.
- Dialog footer surfaces still used direct `bg-white`.

## Completed

- Converted profile drawer labels, legends, icons, popover rows, selected states, helper counters, and dialog footers to shadcn/EMR semantic tokens.
- Converted danger, warning, info, and success surfaces to EMR status aliases while preserving the original status meaning.
- Added a profile drawer source audit test in `tests/design-tokens.spec.ts`.

## Deferred

- home kanban/workspace cleanup.
- auth/login cleanup.
- Any remaining secondary shell/app chrome cleanup discovered by broader audit.

## Verification

- `npx playwright test tests/design-tokens.spec.ts -g "profile drawer source" --reporter=line` (`1 passed`, failed first before implementation)
- `npm run lint` (passed)
- `npx tsc --noEmit` (passed)
- `npm run docs:check` (passed, 240 docs/agent markdown files checked)
- `npx playwright test tests/design-tokens.spec.ts tests/reception.spec.ts tests/customer.spec.ts --reporter=line` (`36 passed`)
