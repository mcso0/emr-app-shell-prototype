---
area: "design-system"
completed: "2026-05-14"
source_docs:
  - "docs/design/system/DESIGN.md"
  - "docs/design/system/light-operational-foundation.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-011-customer-feature-token-cleanup.md"
---

# Customer Feature Semantic Token Cleanup Closeout

## Summary

Completed the eighth feature-screen cleanup after chart, reception, lab, imaging, dispensing/treatment, billing, and inpatient. This pass scoped `src/features/customer/module.tsx`.

## Color Usage Found

Audit pattern: direct Tailwind color utilities, hex/rgba, and any `clair-color-*` local token usage.

- Customer work badges used direct blue, gray, green, orange, and purple atomic colors.
- Table headers used direct neutral surface tokens.
- Active rows used direct sky selected-state colors and direct label text color.
- The page title icon and workspace background used direct Clair gray/background tokens.

## Completed

- Converted customer work badges to EMR semantic status aliases: info, success, warning, and neutral.
- Converted table headers, active rows, text color, title icon, and workspace background to shadcn/EMR semantic tokens.
- Added a customer source audit test in `tests/design-tokens.spec.ts`.

## Deferred

- 병원관리 as the remaining primary feature-screen cleanup unit.
- `src/features/reception/profile-drawer.tsx`, home kanban/workspace, and auth/login cleanup after primary feature screens.

## Verification

- `npx playwright test tests/design-tokens.spec.ts -g "customer workspace source" --reporter=line` (`1 passed`, failed first before implementation)
- `npm run lint` (passed)
- `npx tsc --noEmit` (passed)
- `npm run docs:check` (passed, 236 docs/agent markdown files checked)
- `npx playwright test tests/design-tokens.spec.ts tests/customer.spec.ts --reporter=line` (`13 passed`)
