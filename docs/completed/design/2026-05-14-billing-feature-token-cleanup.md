---
area: "design-system"
completed: "2026-05-14"
source_docs:
  - "docs/design/system/DESIGN.md"
  - "docs/design/system/light-operational-foundation.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-009-billing-feature-token-cleanup.md"
---

# Billing Feature Semantic Token Cleanup Closeout

## Summary

Completed the sixth feature-screen cleanup after chart, reception, lab, imaging, and dispensing/treatment. This pass scoped `src/features/billing/module.tsx`.

## Color Usage Found

Audit pattern: direct Tailwind color utilities, hex/rgba, and any `clair-color-*` local token usage.

- Billing title guidance used direct Clair label text.
- Guardian group cards used direct background and sky selected-state colors.
- Invoice line warning notice used direct Clair status warning tokens.
- Invoice table header used a direct neutral fill.
- Summary lines used direct Clair line, label, and primary text tokens.
- Right-panel payment/read-only note surfaces used direct Clair background surface tokens.

## Completed

- Converted title guidance and summary labels to EMR text aliases and shadcn semantic text.
- Converted guardian group card selected state to `--emr-state-selected-*`.
- Converted warning notice to `--emr-status-warning-*`.
- Converted table header and note surfaces to shadcn/EMR neutral surface tokens.
- Added a billing source audit test in `tests/design-tokens.spec.ts`.

## Deferred

- 입원, 고객관리, 병원관리 as later feature-screen cleanup units.
- `src/features/reception/profile-drawer.tsx`, home kanban/workspace, and auth/login cleanup after primary feature screens.

## Verification

- `npx playwright test tests/design-tokens.spec.ts -g "billing workspace source" --reporter=line` (`1 passed`, failed first before implementation)
- `npm run lint` (passed)
- `npx tsc --noEmit` (passed)
- `npm run docs:check` (passed, 232 docs/agent markdown files checked)
- `npx playwright test tests/design-tokens.spec.ts tests/billing.spec.ts --reporter=line` (`10 passed`)
