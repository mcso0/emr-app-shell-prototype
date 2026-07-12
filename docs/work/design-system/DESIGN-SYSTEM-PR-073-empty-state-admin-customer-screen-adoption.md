---
id: "DESIGN-SYSTEM-PR-073"
status: implemented
area: design-system
priority: P1
target_pr: "User request / hospital-admin and customer-management empty states"
source_docs:
  - "docs/design/system/empty-info-state-contract.md"
  - "docs/work/design-system/DESIGN-SYSTEM-PR-070-emr-empty-state-component-storybook.md"
  - "docs/design/system/component-ownership-rules.md"
---

# DESIGN-SYSTEM-PR-073: Hospital Admin And Customer Empty State Adoption

## Goal

Apply the CDS.V2 empty-state size contract to missing or inconsistent empty states in customer management and hospital administration.

## Scope

- Customer deleted guardian/patient list.
- Hospital-admin audit log table and membership directory.
- Compact nested lists in operating hours, schedule, and role-assignment surfaces.
- Explicit `md` (`mg`) size declarations for already-adopted customer and Order table states.

## Out Of Scope

- Queue-side empty-state replacement.
- Loading, read-failure, permission, or disabled-feature placeholder redesign.
- New icon artwork or new alpha/color tokens.
- Database, API, RLS, server-permission, or persistence behavior.

## Size Contract

- `lg`: full main-content empty state only.
- `md` (`mg`): large table/list body and large side-panel list.
- `sm`: modal, drawer, card, or nested list.

## Verification

- Focused customer, audit-review, hospital-admin, and auth/member Playwright coverage.
- TypeScript, lint, docs check, and build.
- Browser checks must confirm that loading, permission, and error states remain distinct from empty states.

2026-07-12 verification:

- Passed focused Playwright coverage: 43 tests.
- Passed the new empty-state adoption coverage: 4 tests.
- Passed `npx tsc --noEmit`.
- Passed focused ESLint for changed source and test files.
- Browser screenshots confirmed stable `md` empty states for deleted customer history and audit review, with the existing alpha token hierarchy.

## Changed Files

- `src/features/customer/module.tsx`
- `src/features/hospital-admin/module.tsx`
- `src/features/auth/workspace-membership-management.tsx`
- `src/features/hospital-admin/settings/hospital-operating-hours-editor.tsx`
- `src/features/hospital-admin/schedule/hospital-schedule-screen.tsx`
- `src/features/hospital-admin/role-permission-management/screen.tsx`
- `tests/customer.spec.ts`
- `tests/audit-review-surface.spec.ts`
- `tests/hospital-admin.spec.ts`

## Follow-Up

- Review the schedule `empty` branch visually before choosing between full-content `lg` and local compact treatment if the rendered grid remains visible.
