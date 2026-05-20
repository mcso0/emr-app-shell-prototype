# Launch Route Permission Enforcement Inventory

Updated: 2026-05-20
Linear: DEN-164
Initiative: `CLAiR EMR SaaS Launch Foundation`
Project: `04 Role Permission & Tenant Data Isolation`

## Purpose

This document records the launch-critical route authorization coverage for the SaaS launch foundation.

It does not expand the role policy. It applies the role baseline from `docs/engineering/auth-security/auth-login/saas-launch-role-permission-matrix.md` to the first launch routes that can create tenants, create workspaces, invite staff, mutate membership authority, update profile state, or review audit evidence.

## Launch-Critical Route Coverage

| Route | Method | Launch operation | Server identity boundary | Required permission or authority | Safe denial contract | Current status |
| --- | --- | --- | --- | --- | --- | --- |
| `/api/ops/tenant-applications/[applicationId]/workspace` | `POST` | CLAiR operator creates workspace plus first `hospital_admin` invite for approved tenant | `readServerSession()` plus mock-mode-only demo actor seam | `tenant_approval:manage` through `OpsOperatorAdapter` | `401 unauthenticated`, `403 operator_missing/operator_inactive/operator_permission_missing`, `404 target_tenant_application_missing`, `409 tenant_*` | Covered |
| `/api/workspaces` | `GET` | Actor workspace selector/list | `readServerSession()` plus mock-mode-only demo actor seam | Authenticated actor; Supabase RPC returns active memberships only in live path | `401 unauthenticated`, `500 db_read_failed/supabase_client_missing` | Covered |
| `/api/workspaces` | `POST` | Workspace creation and creator `hospital_admin` membership | `readServerSession()` plus mock-mode-only demo actor seam | Authenticated actor; creator receives `hospital_admin` by transaction contract | `401 unauthenticated`, `400 invalid_input`, `409 duplicate_workspace` | Covered |
| `/api/workspaces/[workspaceId]/invitations` | `POST` | Staff invitation creation | `readServerSession()` plus mock-mode-only demo actor seam | Active workspace membership with `role_permission:manage` | `401 unauthenticated`, `403 permission/membership denials`, `400 invalid_roles`, `409 duplicate/active member` | Covered |
| `/api/workspaces/[workspaceId]/invitations/[invitationId]/resend` | `POST` | Invitation resend | `readServerSession()` plus mock-mode-only demo actor seam | Active workspace membership with `role_permission:manage` | `401 unauthenticated`, `403 permission/membership denials`, `404 target_invitation_missing`, `409 invitation_not_pending` | Covered |
| `/api/workspaces/[workspaceId]/invitations/[invitationId]/cancel` | `POST` | Invitation cancel | `readServerSession()` plus mock-mode-only demo actor seam | Active workspace membership with `role_permission:manage` | `401 unauthenticated`, `403 permission/membership denials`, `404 target_invitation_missing`, `409 invitation_not_pending` | Covered |
| `/api/workspaces/[workspaceId]/invitations/[invitationId]/accept` | `POST` | Invitation accept and membership activation | `readServerSession()` plus mock-mode-only demo actor seam | Pending invitation match; no admin self-assignment | `401 unauthenticated`, `404 target_invitation_missing`, `409 invitation_not_pending/active_membership_exists` | Covered |
| `/api/workspaces/[workspaceId]/memberships` | `GET` | Member/invitation management status read | `readServerSession()` plus mock-mode-only demo actor seam | Active workspace membership with `role_permission:manage` | `401 unauthenticated`, `403 permission/membership denials` | Covered |
| `/api/workspaces/[workspaceId]/memberships/[membershipId]/roles` | `POST` | Role mutation | `readServerSession()` plus mock-mode-only demo actor seam | Active workspace membership with `role_permission:manage`; canonical role validation; last-admin guard | `401 unauthenticated`, `403 permission/membership denials`, `400 invalid_roles`, `404 target_membership_missing`, `409 last_admin_protected` | Covered |
| `/api/workspaces/[workspaceId]/memberships/[membershipId]/status` | `PATCH` | Membership activation/deactivation | `readServerSession()` plus mock-mode-only demo actor seam | Active workspace membership with `role_permission:manage`; last-admin guard | `401 unauthenticated`, `403 permission/membership denials`, `400 invalid_input`, `404 target_membership_missing`, `409 last_admin_protected` | Covered |
| `/api/users/me/profile` | `PATCH` | Own personal profile edit | `readServerSession()` plus mock-mode-only demo actor seam | Own authenticated user only; authority fields forbidden | `401 unauthenticated`, `400 invalid_input/profile_authority_field_forbidden` | Covered |
| `/api/workspaces/[workspaceId]/audit/events` | `GET` | Launch-critical audit review | `readServerSession()` plus mock-mode-only demo actor seam | Active workspace membership with `role_permission:manage` in mock/core; live RPC uses admin-only DB function boundary | `401 unauthenticated`, `403 permission_missing`, `400 invalid_input`, `500 db_read_failed` | Covered |

## Safe 401/403 Contract

Launch-critical routes should keep response envelopes stable and safe:

- Missing or invalid actor identity returns `401` with `denialReason: "unauthenticated"`.
- Active actor without workspace membership returns `403 workspace_membership_missing`.
- Inactive actor membership returns `403 workspace_membership_inactive`.
- Active actor without required permission returns `403 permission_missing`.
- Operator-only routes use `403 operator_missing`, `operator_inactive`, or `operator_permission_missing`.
- Profile authority-field attempts return `400 profile_authority_field_forbidden`.
- Last active `hospital_admin` removal returns `409 last_admin_protected`.
- Responses must not echo raw SQL errors, tokens, secrets, service-role material, or invite credentials.

## Mock Fallback Boundary

Mock fallback is allowed only for local/demo regression:

1. The route must first call `readServerSession()`.
2. `x-clair-demo-session-user-id` can be used only when the server session reader returns `mock_mode`.
3. Demo actor ids are not accepted when Supabase session mode is missing or unauthenticated.
4. Browser storage, user-editable profile fields, query strings, role labels, and UI state are not authorization sources.
5. Production/staging pilot readiness still needs proof that demo actor headers cannot authorize live mode requests.

## Remaining Enforcement Gap

No new launch role policy or broad server rewrite is approved in DEN-164.

Remaining gaps before a real pilot/live rollout:

| Gap | Why it remains | Suggested next issue |
| --- | --- | --- |
| Full live Supabase permission adapter replay for all launch-critical routes | Several Supabase-mode routes delegate authorization to RPC/private helper boundaries; remote/staging replay is still approval-gated. | DEN-165/DEN-170 or explicit staging gate |
| Demo actor header production disablement proof | Current local fallback is intentional, but live pilot needs explicit negative proof. | DEN-169/DEN-170 |
| Broad clinical/billing/customer route enforcement inventory | This issue focuses launch auth/tenant/member/profile/audit routes, not every outpatient mutation. | Future security review or Project 05 |
| Seed permission id reconciliation | DEN-163 found stale seed permission ids that should be normalized before staging replay. | DEN-164 follow-up or DEN-165 |
| Rate limit and abuse handling | Some routes have mutation rate limits, but dedicated invite/auth abuse coverage is scoped separately. | DEN-168 |

## Verification

- Red: `npx playwright test tests/launch-route-permission-enforcement.spec.ts --reporter=line` failed before this inventory existed.
- Source regression: `tests/launch-route-permission-enforcement.spec.ts` checks launch route handlers keep `readServerSession()` and core permission tokens.
- Green: `npx playwright test tests/launch-route-permission-enforcement.spec.ts --reporter=line` (`2 passed`).
- Regression: `npx playwright test tests/launch-route-permission-enforcement.spec.ts tests/ops-tenant-workspace-action.spec.ts tests/workspace-invitation-server.spec.ts tests/workspace-invitation-lifecycle-server.spec.ts tests/workspace-membership-status-server.spec.ts tests/server-permission-enforcement.spec.ts tests/workspace-role-status-write-server.spec.ts tests/personal-profile-server.spec.ts tests/audit-review-surface.spec.ts tests/permission-resolver.spec.ts --reporter=line` (`38 passed`).
- `npx tsc --noEmit` passed.
- `npm run lint` passed with existing warnings only.
- `npm run docs:check` passed.
- `npm run build` passed.
- `npm run security:secrets` passed.
- `git diff --check` passed.
