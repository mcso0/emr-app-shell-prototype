# SaaS Launch Role Permission Matrix

Updated: 2026-05-20
Linear: DEN-163
Initiative: `CLAiR EMR SaaS Launch Foundation`
Project: `04 Role Permission & Tenant Data Isolation`

## Purpose

This document freezes the SaaS launch role and permission baseline for follow-up launch work.

It does not approve a new role policy. The canonical product source remains `docs/product/domain/workspace-auth-permissions.md`, and this handoff binds Project 04 implementation and review work to that existing source.

## Canonical Launch Roles

| Role ID | Korean label | Launch meaning | Admin authority |
| --- | --- | --- | --- |
| `hospital_admin` | 병원관리자 | Workspace owner/admin role for hospital operations, staff invitation, role/status management, service catalog management, and last-admin responsibility. | Yes |
| `vet` | 수의사 | Clinical role for charting, diagnosis/SOAP work, order request/update, and clinical review. | No |
| `technician` | 테크니션 | Clinical support role for lab/imaging/dispensing/treatment completion and support work. | No |
| `front_desk` | 데스크 | Reception/customer-facing role for appointment, check-in, patient/guardian context, and front-desk billing actions. | No |

Launch rule:

- Only these four role ids can be persisted in `user_memberships.roles` and `workspace_invitations.invited_roles`.
- Effective permissions remain additive union of all active assigned roles.
- `hospital_admin` implies full workspace/admin permission.
- MVP remains allow-only. No deny rules are introduced in this launch foundation.
- Every active workspace must keep at least one active `hospital_admin`.

## Legacy Compatibility Roles

| Legacy role | Launch decision | Follow-up |
| --- | --- | --- |
| `nurse` | `nurse` is not a canonical SaaS launch role. It maps conceptually to `technician` until all mock/demo labels are reconciled. | Rename or alias UI/test/demo references to `technician` before representative pilot rehearsal. |
| `billing_admin` | `billing_admin` is not a canonical SaaS launch role. Billing authority stays inside approved canonical roles until a separate billing role is approved. | Keep as mock/demo compatibility only, or remove after billing policy is separately approved. |

Do not promote `nurse`, `billing_admin`, or another compatibility role to launch canonical status without explicit approval from 승욱.

## Launch Permission Matrix

Legend:

- `View`: read-only access.
- `Mutate`: create/update/complete/issue action where the module supports it.
- `Admin`: settings, membership, permission, or catalog management authority.
- `No`: no intended launch access.

| Area | `hospital_admin` | `vet` | `technician` | `front_desk` |
| --- | --- | --- | --- | --- |
| Home/work dashboard | Admin | Mutate | Mutate | Mutate |
| Reception/appointment | Admin | View | View | Mutate |
| Patient/guardian profile | Admin | Mutate | Mutate | Mutate |
| Encounter status | Admin | View | View | Mutate |
| Chart/medical record | Admin | Mutate | View | View |
| Diagnosis/SOAP mutation | Admin | Mutate | No | No |
| Order request/update | Admin | Mutate | Support completion | View |
| Lab/imaging | Admin | Mutate/review | Complete | View |
| Dispensing/treatment | Admin | Mutate | Complete | View |
| Billing/payment | Admin | View | Support issue actions | Front-desk issue actions |
| Inpatient | Admin | Mutate | Complete care tasks | View |
| Service catalog | Admin | View | View | View |
| Hospital settings | Admin | No | No | No |
| Member/admin settings | Admin | No | No | No |
| Role/permission settings | Admin | No | No | No |
| Personal profile | Own profile only | Own profile only | Own profile only | Own profile only |

## Invitation Eligibility

| Action | Required role/permission |
| --- | --- |
| Create staff invitation | Active workspace membership with `role_permission:manage` |
| Resend invitation | Active workspace membership with `role_permission:manage` |
| Cancel invitation | Active workspace membership with `role_permission:manage` |
| Accept invitation | Pending invitation for the target workspace/email plus account-linking flow |
| Invite assignable roles | `hospital_admin`, `vet`, `technician`, `front_desk` |

The invitation flow must not expose public self-signup, unrestricted workspace creation, or role self-assignment.

## Management Authority

Only `hospital_admin` can manage workspace staff and role/status state in launch scope.

Required server-side checks:

1. Verified actor session, or mock-mode demo actor seam only in approved local fallback.
2. Active actor user.
3. Active actor membership in the target workspace.
4. Required permission such as `role_permission:manage`.
5. Canonical role validation for target roles.
6. Last active `hospital_admin` protection.
7. Stable safe denial category for 401/403 responses.

Client UI gating is only a convenience. It is never the final security boundary.

## Server Enforcement Mapping

| Source | Current alignment |
| --- | --- |
| Product source | `docs/product/domain/workspace-auth-permissions.md` names the four canonical roles and product matrix. |
| Source map | `docs/product/domain/role-permission-source-map.md` marks `nurse` and `billing_admin` as compatibility names only. |
| Permission resolver | `src/features/auth/permission-resolver.ts` uses `hospital_admin`, `vet`, `technician`, and `front_desk` only. |
| DB adapter | `src/features/auth/db-workspace-permission-adapter-core.ts` filters DB roles to the four canonical role ids. |
| Schema docs | `docs/engineering/auth-security/auth-login/workspace-auth-schema-migration.md` requires canonical role subsets for memberships and invitations. |
| Seed | `supabase/seed.sql` creates canonical memberships and role policies for the four launch roles. |
| Mock auth | `src/features/auth/mock-session.ts` still exposes `nurse` and `billing_admin` for older demo compatibility. |
| Demo role seeds | `src/mocks/emr-domain.ts` still contains `nurse` and `billing_admin` role seeds for legacy prototype coverage. |

## Seed And Resolver Notes

The role names are aligned for launch canonical status. Two implementation details still need follow-up before live/staging policy replay:

- `supabase/seed.sql` contains older permission ids such as `order:create`, `lab:update`, and `imaging:update`; the resolver permission vocabulary currently uses `order:request`, `lab:complete`, and `imaging:complete`.
- Billing support authority differs slightly across product matrix, resolver defaults, and old demo role seeds. Keep the product rule: `billing_admin` is not canonical; live payment/refund policy requires a separate approval gate.

Do not treat those seed/demo differences as approval to change launch policy inside Project 04. Reconciliation belongs to focused implementation/regression work after this freeze.

## Follow-Up Required

| Follow-up | Why it matters | Suggested placement |
| --- | --- | --- |
| Replace or alias mock `nurse` display to `technician` | Pilot/demo UI should not imply a fifth launch role. | DEN-164 or Project 05 pilot readiness |
| Remove or quarantine mock `billing_admin` from launch-facing role copy | Billing authority is not a canonical launch role. | DEN-164 or Project 05 pilot readiness |
| Reconcile seed permission ids with resolver vocabulary | Staging replay should not silently drop stale permission ids. | DEN-164 server enforcement expansion |
| Add route inventory against this matrix | Launch-critical routes should be checked against the same permission baseline. | DEN-164 |
| Add cross-tenant denial fixtures using these roles | Tenant isolation should prove each canonical role stays workspace-scoped. | DEN-165 |

## Out Of Scope

- New custom role builder.
- Enterprise SSO or SCIM.
- Real payment/refund authority policy.
- Live Supabase remote mutation.
- Production deployment.
- Broad role-policy code rewrite.

## Verification

- Red: `npx playwright test tests/saas-launch-role-permission-matrix.spec.ts --reporter=line` failed before this document existed.
- Static alignment check added in `tests/saas-launch-role-permission-matrix.spec.ts`.
- Green: `npx playwright test tests/saas-launch-role-permission-matrix.spec.ts --reporter=line` (`2 passed`).
- Regression: `npx playwright test tests/saas-launch-role-permission-matrix.spec.ts tests/permission-resolver.spec.ts tests/db-workspace-permission-adapter.spec.ts tests/server-permission-enforcement.spec.ts tests/workspace-role-status-write-server.spec.ts tests/workspace-role-management-regression.spec.ts tests/workspace-invitation-server.spec.ts --reporter=line` (`25 passed`).
- `npx tsc --noEmit` passed.
- `npm run lint` passed with existing warnings only.
- `npm run docs:check` passed.
- `npm run build` passed.
- `npm run security:secrets` passed.
- `git diff --check` passed.
