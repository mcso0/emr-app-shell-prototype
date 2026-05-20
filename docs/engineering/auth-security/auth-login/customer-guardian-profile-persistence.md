---
title: "Customer Guardian Profile Persistence"
status: "human_review"
updated: "2026-05-20"
source:
  - "DEN-106"
  - "docs/work/customer/CUSTOMER-LIVE-PR-004-guardian-profile-persistence.md"
  - "docs/engineering/auth-security/auth-login/customer-management-schema-migration.md"
---

# Customer Guardian Profile Persistence

Linear: DEN-106
Project: `06 Customer Management Persistence`

## Summary

DEN-106 adds the guardian profile read/write boundary for customer-management persistence.

The server core enforces active workspace membership and `patient:view`/`patient:update` permissions before returning or mutating guardian profile data. The route supports `GET` and `PATCH` at `/api/workspaces/[workspaceId]/customer/guardians/[guardianId]/profile`, and the shared guardian drawer now writes through that route before updating the client store.

Remote Supabase is only used when a Supabase session is available. Mock/demo-header mode uses the local mock gateway and remains synthetic.

## Implemented Files

| File | Purpose |
| --- | --- |
| `src/features/customer/server-guardian-profile-core.ts` | Permissioned read/write core, DTO minimization, validation, mock gateway, Supabase gateway. |
| `src/features/customer/server-guardian-profile.ts` | Public server feature export. |
| `src/app/api/workspaces/[workspaceId]/customer/guardians/[guardianId]/profile/route.ts` | Route handler for guardian profile `GET` and `PATCH`. |
| `src/features/reception/profile-drawer.tsx` | Shared guardian drawer save action now calls the persistence route. |
| `tests/customer-guardian-profile-server.spec.ts` | Focused permission, validation, normalization, and gateway coverage. |

## Boundary Rules

- Read requires `patient:view`.
- Update requires `patient:update`.
- Workspace scoping is enforced before gateway access.
- Update rejects raw identifier-shaped resident registration tokens and cash receipt numbers.
- Returned DTO is limited to display/edit fields needed by customer-management guardian profile surfaces.
- Update writes a customer profile change-log hook point through the Supabase gateway.
- Soft delete, restore, relationship changes, real identifiers, provider payloads, and remote/live migration are out of scope.

## Verification Notes

Fresh verification:

- `npx playwright test tests/customer-guardian-profile-server.spec.ts --reporter=line` (`5 passed`)
- `npx playwright test tests/customer-guardian-profile-server.spec.ts tests/customer.spec.ts --reporter=line` (`9 passed`)
- `npx tsc --noEmit`
- `npm run docs:check`
- `npm run security:secrets`

## Follow-Up

Next Project 06 work should continue with DEN-107, the persisted patient profile read/write boundary.
