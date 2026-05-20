---
title: "Customer Relationship Management Persistence"
status: "human_review"
updated: "2026-05-20"
source:
  - "DEN-108"
  - "docs/work/customer/CUSTOMER-LIVE-PR-006-relationship-management-persistence.md"
---

# Customer Relationship Management Persistence

Linear: DEN-108
Project: `06 Customer Management Persistence`

## Summary

DEN-108 adds the server-owned patient-guardian relationship management boundary.

The core supports linking an existing guardian, changing the primary guardian, and unlinking an additional guardian without mutating guardian or patient master records. It enforces active workspace membership and `patient:update`, blocks cross-workspace links, blocks duplicate active relationships, and prevents unlinking the current primary relationship.

## Implemented Files

| File | Purpose |
| --- | --- |
| `src/features/customer/server-patient-guardian-relationship-core.ts` | Permissioned relationship action core and mock/local gateway. |
| `src/features/customer/server-patient-guardian-relationship.ts` | Public server feature export. |
| `tests/customer-relationship-management-server.spec.ts` | Focused permission, cross-workspace, duplicate, primary-change, and unlink coverage. |

## Verification Notes

Fresh verification:

- `npx playwright test tests/customer-relationship-management-server.spec.ts --reporter=line` (`5 passed`)
- `npx tsc --noEmit`
- `npm run docs:check`
- `npm run security:secrets`

## Follow-Up

Next Project 06 work should continue with DEN-109, soft delete/restore and deletion locks.
