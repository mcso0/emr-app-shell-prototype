---
title: "Customer Patient Profile Persistence"
status: "human_review"
updated: "2026-05-20"
source:
  - "DEN-107"
  - "docs/work/customer/CUSTOMER-LIVE-PR-005-patient-profile-persistence.md"
  - "docs/engineering/auth-security/auth-login/customer-guardian-profile-persistence.md"
---

# Customer Patient Profile Persistence

Linear: DEN-107
Project: `06 Customer Management Persistence`

## Summary

DEN-107 adds the patient profile read/write boundary for customer-management persistence.

The server core mirrors the DEN-106 guardian boundary: reads require `patient:view`, updates require `patient:update`, and every operation is scoped by active workspace membership. The shared patient drawer now writes through `/api/workspaces/[workspaceId]/customer/patients/[patientId]/profile` before updating the client store.

## Implemented Files

| File | Purpose |
| --- | --- |
| `src/features/customer/server-patient-profile-core.ts` | Permissioned patient profile read/write core, DTO, validation, and mock/local gateway. |
| `src/features/customer/server-patient-profile.ts` | Public server feature export. |
| `src/app/api/workspaces/[workspaceId]/customer/patients/[patientId]/profile/route.ts` | Route handler for patient profile `GET` and `PATCH`. |
| `src/features/reception/profile-drawer.tsx` | Shared patient drawer save action now calls the persistence route. |
| `tests/customer-patient-profile-server.spec.ts` | Focused permission, validation, normalization, and gateway coverage. |

## Boundary Rules

- Read requires `patient:view`.
- Update requires `patient:update`.
- Workspace scoping is enforced before gateway access.
- Invalid message consent, species/status, empty name, and non-positive weight are rejected.
- Patient context fields used by reception/chart remain mapped through the existing client store shape.
- Guardian relationship changes, reception actions, chart actions, real data import, and remote Supabase migration remain out of scope.

## Verification Notes

Fresh verification:

- `npx playwright test tests/customer-patient-profile-server.spec.ts --reporter=line` (`5 passed`)
- `npx playwright test tests/customer-patient-profile-server.spec.ts tests/customer-guardian-profile-server.spec.ts tests/customer.spec.ts --reporter=line` (`14 passed`)
- `npx tsc --noEmit`

## Follow-Up

Next Project 06 work should continue with DEN-108, persisted patient-guardian relationship management.
