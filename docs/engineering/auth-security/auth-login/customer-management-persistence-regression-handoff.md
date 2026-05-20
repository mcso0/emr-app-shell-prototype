---
title: "Customer Management Persistence Regression Handoff"
status: "human_review"
updated: "2026-05-20"
source:
  - "DEN-110"
  - "docs/work/customer/CUSTOMER-LIVE-PR-008-customer-management-regression-handoff.md"
---

# Customer Management Persistence Regression Handoff

Linear: DEN-110
Project: `06 Customer Management Persistence`

## Summary

Project 06 now has a local-first customer-management persistence slice covering scope, schema, guardian profile, patient profile, patient-guardian relationships, and soft delete/restore locks.

The implementation keeps the MVP safety boundary from DEN-101:

- Uses synthetic demo/local fixtures.
- Does not store real resident registration numbers or raw provider payloads.
- Keeps hard delete out of scope.
- Keeps remote Supabase validation and production deploy out of scope.

## Completed Issue Map

| Issue | Result |
| --- | --- |
| DEN-101 | Customer-management persistence scope and sensitive-data boundary. |
| DEN-102 | Schema delta plan for extending existing patient/guardian tables. |
| DEN-105 | Local-first schema migration and synthetic seed fixtures. |
| DEN-106 | Guardian profile read/write boundary and route. |
| DEN-107 | Patient profile read/write boundary and route. |
| DEN-108 | Patient-guardian relationship link, primary-change, and unlink boundary. |
| DEN-109 | Patient/guardian soft delete, restore, active/deleted list, and lock calculation boundary. |

## Regression Coverage

Focused regression set:

- `tests/customer-management-schema-migration.spec.ts`
- `tests/customer-guardian-profile-server.spec.ts`
- `tests/customer-patient-profile-server.spec.ts`
- `tests/customer-relationship-management-server.spec.ts`
- `tests/customer-soft-delete-restore-server.spec.ts`
- `tests/customer.spec.ts`

Supporting gates:

- `npx tsc --noEmit --pretty false`
- `npm run docs:check`
- `npm run security:secrets`

## Remaining Product Gaps

- Supabase runtime replay and remote project validation remain explicitly out of scope.
- Full UI integration exists for profile save, while relationship and archive routes are currently server-boundary first.
- Legal retention policy and refund/deposit provider behavior still need representative/legal decision before live rollout.
- Cross-screen chart/order/billing E2E was excluded from DEN-110 and remains covered by Project 04/05 evidence.

## Handoff

Project 07 can use Project 06's pattern: define scope first, plan schema against DEN-99 data contracts, implement local-first migrations and server boundaries, then close with focused regression and HTML reports.
