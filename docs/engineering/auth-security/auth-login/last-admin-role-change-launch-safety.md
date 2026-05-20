# Last-Admin And Role-Change Launch Safety

Updated: 2026-05-20
Linear: DEN-166

This document records the Project 04 launch safety check for hospital-admin continuity and role-change boundaries.
The launch rule is that a workspace must always keep at least one active `hospital_admin`, and role changes must remain server/DB guarded rather than relying on client UI hiding.

## Safety Matrix

| Flow | Scenario | Expected result | Coverage |
| --- | --- | --- | --- |
| Last-admin demotion | Only active `hospital_admin` is changed to `vet` | `409 last_admin_protected` | `tests/last-admin-role-change-launch-safety.spec.ts` |
| Last-admin deactivation | Only active `hospital_admin` is changed to `inactive` | `409 last_admin_protected` | `tests/last-admin-role-change-launch-safety.spec.ts` |
| Second-admin continuity | Two active `hospital_admin` memberships exist, and one admin is demoted | Allowed by guard because another active admin remains | `tests/last-admin-role-change-launch-safety.spec.ts` |
| Invited admin acceptance | Pending hospital-admin invitation is accepted | Creates an active `hospital_admin` membership for the invitee | `tests/last-admin-role-change-launch-safety.spec.ts` |
| Non-admin mutation attempt | Non-admin actor attempts role/status mutation | `403 permission_missing` | `tests/server-permission-enforcement.spec.ts`, `tests/workspace-role-status-write-server.spec.ts` |
| Cross-tenant role mutation | Workspace A admin mutates Workspace B membership | `403 workspace_membership_missing` | `tests/server-permission-enforcement.spec.ts`, `tests/cross-tenant-denial-regression.spec.ts` |

## Allowed And Denied Role Changes

| Requested change | Launch decision | Reason |
| --- | --- | --- |
| Add `hospital_admin` through an approved pending invitation | Allowed in local-first launch fixture | Supports first/second admin onboarding without custom role UI |
| Demote active admin while another active admin remains | Allowed | Workspace still has an active admin owner |
| Demote the only active admin | Denied | Would orphan the hospital workspace |
| Deactivate the only active admin | Denied | Would orphan the hospital workspace |
| Assign non-canonical role id | Denied as invalid input | Launch canonical roles remain `hospital_admin`, `vet`, `technician`, `front_desk` |
| Non-admin changes another member role/status | Denied | Requires active membership plus `role_permission:manage` |

## Server And DB Guard Surfaces

- `POST /api/workspaces/[workspaceId]/memberships/[membershipId]/roles` reads the server session seam, applies mutation rate limiting, and calls `authorizeWorkspaceRoleUpdate` or the Supabase RPC in live mode.
- `PATCH /api/workspaces/[workspaceId]/memberships/[membershipId]/status` uses the same server actor boundary and last-admin guard semantics.
- `public.clair_update_workspace_membership_roles(...)` and `public.clair_update_workspace_membership_status(...)` are the live DB transaction wrappers.
- The DB write path continues to rely on the existing `protect_last_active_hospital_admin` trigger for last-admin protection.
- Client UI copy and disabled states remain helpful UX only; they are not the security boundary.

## Operator Override Follow-Up

No production support override was implemented in DEN-166.

Project 05 security review should decide whether CLAiR needs a controlled break-glass/operator override for a workspace with no reachable admin. If approved later, it should require:

- explicit CLAiR operator authorization
- auditable reason and request id
- dual-control or representative approval for production
- no client-only bypass
- no ability to bypass tenant isolation

Until that decision is approved, the launch posture is strict denial for last-admin removal.

## Remaining Risk

- Remote/staging Supabase replay is not executed in this issue.
- Production support override and break-glass policy are not implemented.
- Billing owner policy and subscription owner transfer are out of scope.
- Enterprise custom roles are out of scope.
- Real hospital/staff data is out of scope.

## Verification Commands

```bash
npx playwright test tests/last-admin-role-change-launch-safety.spec.ts --reporter=line
npx playwright test tests/last-admin-role-change-launch-safety.spec.ts tests/workspace-role-status-write-server.spec.ts tests/server-permission-enforcement.spec.ts tests/workspace-role-management-regression.spec.ts tests/permission-resolver.spec.ts tests/invite-acceptance.spec.ts tests/workspace-invitation-lifecycle-server.spec.ts tests/cross-tenant-denial-regression.spec.ts --reporter=line
npx tsc --noEmit
npm run lint
npm run docs:check
npm run build
npm run security:secrets
git diff --check
```
