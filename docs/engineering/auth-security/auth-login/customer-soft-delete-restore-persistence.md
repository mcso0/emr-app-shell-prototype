---
title: "Customer Soft Delete Restore Persistence"
status: "human_review"
updated: "2026-05-20"
source:
  - "DEN-109"
  - "docs/work/customer/CUSTOMER-LIVE-PR-007-soft-delete-restore-persistence.md"
---

# Customer Soft Delete Restore Persistence

Linear: DEN-109
Project: `06 Customer Management Persistence`

## Summary

DEN-109 adds the server-owned archive boundary for customer master records.

The implementation supports patient and guardian soft delete, restore, default active listing, deleted-record listing, and audit hook payloads. Deletion locks are calculated on the server before the archive state changes.

## Lock Rules

| Target | Blocking sources |
| --- | --- |
| Patient | Active appointments, active encounters, open invoices derived from active encounters. |
| Guardian | Primary relationship to an active patient, active linked patients, open invoices, deposit-like balance or holds. |

Active appointment statuses are `requested`, `confirmed`, `changed`, and `checked_in`.
Active encounter statuses are `waiting`, `in_consultation`, `ordered`, and `ready_for_billing`.
Open invoice statuses are `draft`, `issued`, `refund_requested`, or unpaid/failed payment state.

## Implemented Files

| File | Purpose |
| --- | --- |
| `src/features/customer/server-customer-archive-core.ts` | Permissioned archive core, lock calculation, active/deleted list behavior, and mock/local gateway. |
| `src/features/customer/server-customer-archive.ts` | Public server feature export. |
| `src/app/api/workspaces/[workspaceId]/customer/patients/[patientId]/archive/route.ts` | Patient archive route. |
| `src/app/api/workspaces/[workspaceId]/customer/guardians/[guardianId]/archive/route.ts` | Guardian archive route. |
| `src/app/api/workspaces/[workspaceId]/customer/archive/route.ts` | Active/deleted archive record listing route. |
| `tests/customer-soft-delete-restore-server.spec.ts` | Permission, lock, active/deleted listing, restore, and cross-workspace denial coverage. |

## Verification Notes

Fresh verification:

- `npx playwright test tests/customer-soft-delete-restore-server.spec.ts --reporter=line` (`5 passed`)
- `npx tsc --noEmit --pretty false`

Remaining Project 06 verification continues in DEN-110, where the whole customer persistence slice is run together.
