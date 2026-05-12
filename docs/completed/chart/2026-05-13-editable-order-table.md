# Editable Order Table Closeout

Date: 2026-05-13

## Summary

CHART-PR-007 added a first-pass editable order table to the 진료(차트) prescription/order area. The implementation keeps the current shadcn table surface and uses chart-local session draft state instead of adding a third-party grid dependency.

## Completed

- Added editable `청구서명` and `수량` cells.
- Recalculated row amount, selected total, and order total from draft rows.
- Added invalid quantity feedback that blocks `Order 업데이트`.
- Added row deletion with confirmation dialog and selection cleanup.
- Added `변경 취소` and `Order 업데이트` controls for current-session draft management.
- Added chart Playwright coverage for edit, commit, invalid quantity, delete, and reset behavior.

## Out Of Scope

- Live Supabase persistence, migrations, RLS, or server validation.
- Audit log event generation.
- Billing workspace invoice state synchronization.
- Reusable cross-module editable grid extraction.
- Advanced grid behaviors such as virtualization, sorting, copy/paste, keyboard spreadsheet navigation, or undo history.

## Verification

- `npm run lint`
- `npx tsc --noEmit`
- `npx playwright test tests/chart.spec.ts --reporter=line`
- Local Playwright smoke check at `/w/clair-demo/treatment?modulePanel=open&aside=closed&right=closed`
