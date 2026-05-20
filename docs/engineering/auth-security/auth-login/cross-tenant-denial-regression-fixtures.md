# Cross-Tenant Denial Regression Fixtures

Updated: 2026-05-20
Linear: DEN-165

This document records the SaaS launch tenant-boundary regression added for Project 04.
The launch rule is simple: an actor with membership in Hospital A must not gain access to Hospital B by changing the `workspaceId` in a route, invite action, membership read, or clinical handoff request.

## Two-Workspace Fixture

| Workspace | Actor | Membership | Expected authority |
| --- | --- | --- | --- |
| `workspace-a` | `user-admin` | active `hospital_admin` | Can manage own workspace invitation and membership surfaces |
| `workspace-b` | `user-admin-b` | active `hospital_admin` | Owns tenant B in fixture only |
| `workspace-b` | `user-admin` | none | Must receive `403 workspace_membership_missing` |

The mock fallback adapters for invitation creation, invitation lifecycle admin actions, and membership status reads now keep `workspace-b` as a foreign tenant when the caller is the default `user-admin` fixture.

## Denial Matrix

| Boundary | Cross-tenant attempt | Expected result | Coverage |
| --- | --- | --- | --- |
| Invitation create | `user-admin` posts to `/api/workspaces/workspace-b/invitations` | `403 workspace_membership_missing` | `tests/cross-tenant-denial-regression.spec.ts` |
| Membership list | `user-admin` reads `/api/workspaces/workspace-b/memberships` | `403 workspace_membership_missing` | `tests/cross-tenant-denial-regression.spec.ts` |
| Invitation lifecycle | `user-admin` resends `/api/workspaces/workspace-b/invitations/invitation-pending/resend` | `403 workspace_membership_missing` | `tests/cross-tenant-denial-regression.spec.ts` |
| Clinical handoff smoke | `user-admin` requests `patient:view` and `encounter:view` in `workspace-b` | denied with `workspace_membership_missing` | `tests/cross-tenant-denial-regression.spec.ts` |
| Reception patient lookup core | `user-admin` searches patients in `workspace-b` through server core | `403 workspace_membership_missing` | `tests/cross-tenant-denial-regression.spec.ts` |
| User-facing denial UX | unauthorized workspace entry returns the existing login notice | Korean unauthorized notice remains visible | `tests/cross-tenant-denial-regression.spec.ts` |

## Regression Contract

- Route handlers must continue to resolve actor identity through the server session seam.
- Mock-mode demo actor headers may remain for local/demo fallback only.
- Permission decisions must use active membership for the requested `workspaceId`; a role in one workspace is not portable to another workspace.
- Clinical handoff checks should fail at the workspace membership layer before patient, encounter, or guardian data is exposed.
- Denials should use existing safe categories such as `workspace_membership_missing` and the existing unauthorized login notice.

## Remaining Tenant Boundary Risk

- Remote/staging Supabase replay is not executed in this issue.
- Full clinical, billing, customer, lab, imaging, dispensing, and audit route-by-route tenant replay remains broader than this fixture slice.
- Production proof that demo actor headers are disabled outside mock mode remains a launch blocker from DEN-164.
- Domain table RLS coverage for every live clinical/business table remains a future live-readiness gate.
- Real hospital, staff, guardian, patient, and billing data remain out of scope.

## Verification Commands

```bash
npx playwright test tests/cross-tenant-denial-regression.spec.ts --reporter=line
npx playwright test tests/cross-tenant-denial-regression.spec.ts tests/workspace-invitation-server.spec.ts tests/workspace-invitation-lifecycle-server.spec.ts tests/workspace-membership-status-server.spec.ts tests/server-permission-enforcement.spec.ts tests/reception-patient-guardian-lookup-server.spec.ts tests/permission-resolver.spec.ts tests/workspace-membership-rls-migration.spec.ts tests/auth.spec.ts --reporter=line
npx tsc --noEmit
npm run lint
npm run docs:check
npm run build
npm run security:secrets
git diff --check
```
