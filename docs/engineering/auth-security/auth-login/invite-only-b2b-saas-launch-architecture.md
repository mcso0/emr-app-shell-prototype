# Invite-Only B2B SaaS Launch Architecture

Updated: 2026-05-20
Linear: DEN-149
Initiative: `CLAiR EMR SaaS Launch Foundation`

## Purpose

This document fixes the launch architecture for CLAiR EMR as an approved-hospital-only B2B SaaS. It uses the DEN-148 scope audit as input and prevents the launch work from drifting into public self-service signup, duplicate auth implementation, or unapproved live infrastructure work.

## Decision

CLAiR EMR should launch with an invite-only B2B onboarding model:

1. CLAiR internally approves a hospital tenant.
2. A CLAiR operator creates or approves the hospital workspace.
3. The first hospital administrator is invited by CLAiR.
4. Hospital administrators invite staff into the approved workspace.
5. Staff join only through invitation links and active workspace membership.

Public self-signup must not create a workspace, tenant, membership, or usable EMR account in the launch foundation.

## Why Public Signup Is Excluded

CLAiR EMR is not a low-risk consumer app. A public signup flow would create avoidable operational and security risk:

- Orphan workspaces for unverified hospitals.
- Clinic impersonation or duplicate tenant records.
- Ambiguous support, billing, and data ownership before the hospital is approved.
- Higher tenant-isolation risk once clinical, guardian, patient, billing, and staff data become live.
- Harder incident response because anyone could create an account or workspace before CLAiR has verified the organization.

Future expansion may add a public "request access" or "demo request" form, but that form should create a tenant application record only. It should not create an active workspace or membership.

## Actors

| Actor | Product role | Authority boundary |
| --- | --- | --- |
| CLAiR operator | Internal CLAiR operations/admin user | Can review/approve hospital tenants and create the first hospital admin invitation. This actor is stronger than a hospital admin and needs a separate server-side guard, audit trail, and MFA recommendation before pilot/live. |
| Hospital admin | Approved workspace administrator | Can manage workspace staff invitations, roles, membership status, and workspace settings inside their own hospital workspace. Cannot approve tenants or operate other hospitals. |
| Staff member | Invited hospital worker | Can accept an invitation and use the workspace according to active membership roles such as `vet`, `technician`, or `front_desk`. Cannot create a workspace through signup. |
| Supabase Auth user | Identity/session record | Represents login identity and session claims. It is not the source of workspace permissions. |
| App user/member | Application authorization record | `users`, `user_memberships`, `workspace_invitations`, and `permission_policies` determine workspace access and effective permissions. |

## Launch Flow

1. **Hospital approval**
   - CLAiR receives and evaluates the hospital through an internal or manual process.
   - Approval creates or updates a tenant/application state owned by CLAiR operations.
   - No public visitor can skip this step.

2. **Workspace creation**
   - A CLAiR operator creates or approves one workspace for the approved hospital.
   - The implementation should reuse the existing workspace creation foundation where possible, but add a CLAiR-operator-only gate above ordinary hospital-admin workspace behavior.

3. **First hospital admin invitation**
   - CLAiR creates the first invitation with `hospital_admin`.
   - The first admin should not self-create the workspace through public signup.
   - The invitation should carry workspace id, target email, selected roles, expiration, and safe token metadata.

4. **Hospital admin account setup**
   - The hospital admin signs in or creates an identity through Supabase Auth.
   - The app links the verified identity to the pending invitation and activates the membership only when the invite is valid.
   - Supabase Auth owns password/session mechanics; the app owns membership activation.

5. **Staff invitation**
   - The hospital admin invites staff from the approved workspace.
   - Existing invitation create/resend/cancel/accept lifecycle should be reused.
   - Real email delivery remains approval-gated; local/mock delivery can expose copyable invite links for development.

6. **Staff acceptance**
   - Staff open the invite link, authenticate or create an account, and accept the invitation.
   - Valid acceptance creates or activates one membership in the invited workspace.
   - Expired, canceled, duplicate, or cross-workspace invite attempts must be safely denied.

7. **Workspace entry and permission enforcement**
   - Active membership determines workspace selector visibility and route access.
   - Server-side permission checks remain authoritative.
   - Client UI gating is a convenience layer only.

8. **Audit and safety**
   - Tenant approval, first admin invitation, invitation acceptance, role changes, status changes, and denial outcomes should be auditable before pilot/live.

## Responsibility Split

| Layer | Owns | Must not own |
| --- | --- | --- |
| Supabase Auth | Identity, password sign-in, session cookies/tokens, verified user claims, refresh/session mechanics, email verification, MFA, password reset when enabled. | Workspace authority, tenant approval, app permissions, role policy, or hospital data ownership. |
| App database | `users`, `workspaces`, tenant/application state, `user_memberships`, `workspace_invitations`, `permission_policies`, profile rows, audit events, launch approval state. | Password validation, OAuth callback internals, refresh token behavior, or browser-only permission truth. |
| Server routes/RPC | Actor verification, CLAiR operator guard, hospital-admin guard, duplicate checks, invite token validation, last-admin protection, safe error envelope, rate limiting, audit append. | Unverified client-side trust or public workspace creation. |
| Client UI | Forms, pending/error states, invite acceptance UX, workspace selector display, admin convenience controls. | Security completion, tenant isolation, role authority, or final permission enforcement. |
| CLAiR operations | Hospital approval decision, first admin invite ownership, staging/live rollout approval. | Direct database mutation outside approved operational tooling and audit trail. |

## First Vertical Slice Acceptance Criteria

The first implementation slice should be considered acceptable when all criteria below are true in local-first or explicitly approved staging mode:

1. A CLAiR operator-only path can create or approve one hospital tenant/workspace.
2. The first `hospital_admin` invitation is created by CLAiR, not public signup.
3. The invited hospital admin can authenticate and enter only the approved workspace after invitation acceptance.
4. The hospital admin can invite one staff member with one or more canonical roles.
5. The invited staff member can authenticate, accept the invite, and receive one active membership.
6. Workspace selector and server routes deny users without active membership in that workspace.
7. Expired, canceled, duplicate, already-accepted, and cross-workspace invite attempts return safe errors.
8. The last active `hospital_admin` protection remains intact.
9. Tenant approval, first admin invite, staff invite, acceptance, denial, role, and status changes have an audit plan or event path.
10. Remote Supabase, real email delivery, production deploy, payment/subscription, and role-policy changes remain blocked unless separately approved.

## Reuse Decisions

| Existing foundation | Launch use |
| --- | --- |
| `/login`, `useAuthClient()`, Supabase adapter, server session reader | Reuse for identity and session entry. Add account recovery/password reset as a runtime readiness task, not a custom password system. |
| Workspace creation route and transaction foundation | Reuse the creation mechanics, but add a CLAiR-operator tenant approval layer before hospital launch creation. |
| Workspace invitation create/resend/cancel/accept lifecycle | Reuse for hospital admin and staff invites. New work focuses on public invite-link UX, token/account-linking behavior, and email delivery gates. |
| Permission resolver, DB-backed adapter, RLS baseline, cross-workspace tests | Reuse as the security baseline. Expand only for tenant approval and public invite surfaces. |
| API error telemetry contract and rate-limit boundary | Reuse for new launch routes. Shared production storage and route-wide adoption remain launch-readiness follow-ups. |

## Out Of Scope For DEN-149

- UI implementation.
- Supabase dashboard changes, remote project link, migration push, SQL execution, or secret creation.
- Real email provider setup or outbound invite delivery.
- Payment/subscription provider policy or implementation.
- Production deploy.
- Real clinic, guardian, patient, or staff data import.
- SSO, SCIM, domain auto-join, delegated admin hierarchy, or public marketplace signup.

## Future Extensions

The invite-only foundation can later support:

- Public request-access form that creates a tenant application only.
- Domain verification for approved hospitals.
- SSO/SCIM for enterprise hospitals.
- More granular CLAiR internal roles such as support, implementation, billing operations, and security admin.
- Subscription and seat-limit checks after the payment policy is approved.

## Source Documents

- `docs/engineering/auth-security/auth-login/saas-launch-foundation-scope-audit.md`
- `docs/product/domain/workspace-auth-permissions.md`
- `docs/engineering/auth-security/auth-login/supabase-auth-mapping.md`
- `docs/engineering/auth-security/auth-login/supabase-integration-readiness.md`
- `docs/engineering/auth-security/auth-login/workspace-live-persistence-scope.md`
- `docs/engineering/auth-security/auth-login/workspace-member-server-route-contract.md`
- `docs/engineering/auth-security/auth-login/auth-db-env-secret-verification-gates.md`
- `docs/engineering/auth-security/auth-login/api-error-telemetry-contract.md`

## Verification

- Reviewed DEN-148 launch scope audit and existing auth/workspace source-of-truth docs.
- Confirmed the architecture reuses existing Supabase Auth, workspace, invitation, membership, RLS, and permission foundations.
- Confirmed public signup remains excluded from launch workspace creation.
- No code implementation, DB migration, remote Supabase operation, real email delivery, production deploy, or real data access was performed.
