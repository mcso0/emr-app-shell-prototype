# CLAiR Operator Access Model And Admin Guard

Updated: 2026-05-20
Linear: DEN-155
Initiative: `CLAiR EMR SaaS Launch Foundation`
Project: `02 CLAiR Ops Admin Tenant Approval`

## Purpose

This document defines the access model for CLAiR internal operator administration before the Project 02 tenant approval UI and server actions are implemented.

CLAiR operator authority is stronger than hospital `hospital_admin` authority. A hospital admin can administer one approved workspace. A CLAiR operator can approve tenants, create hospital workspaces, and create the first hospital admin invitation. That authority must not be inferred from ordinary workspace membership, browser state, or user-editable profile data.

## Decision

CLAiR operator access is a separate server-owned authority source.

For launch foundation work, do not model CLAiR operators as a normal hospital workspace role. The existing canonical MVP workspace roles remain unchanged:

- `hospital_admin`
- `vet`
- `technician`
- `front_desk`

CLAiR operator authority must be resolved after verified identity/session resolution and before tenant approval mutations. The operator guard must be server-side and must not be satisfied by client-only UI checks.

## Identity Sources

| Source | Allowed use | Not allowed |
| --- | --- | --- |
| Supabase Auth verified session | Identify the signed-in user id and authentication assurance context. | Tenant approval authority by itself. |
| App DB operator allowlist or operator table | Source of CLAiR internal operator authority for pilot/local-first implementation. | User-editable profile or browser-configured role. |
| Workspace membership | Hospital workspace access and hospital admin/member management. | CLAiR tenant approval or cross-tenant operation authority. |
| Supabase `user_metadata` / `raw_user_meta_data` | Display/profile preferences only when explicitly safe. | Operator authority, role, permission, tenant access, or RLS policy decisions. |
| Supabase `app_metadata` / `raw_app_meta_data` | Optional future coarse identity signal only after security review. | Sole source of tenant approval authority without app DB/server verification. |
| Browser storage, query params, headers from browser UI | Mock/local convenience only where explicitly scoped. | Security completion or live operator authorization. |

Recommended local-first model:

1. Resolve actor identity through `readServerSession()`.
2. In mock/local fallback only, allow deterministic test operator identities from a server-owned fixture.
3. In Supabase/staging/live mode, require an app DB row such as `clair_operators` or equivalent server-owned allowlist keyed by verified auth user id.
4. Require active operator status before any tenant approval mutation.
5. Optionally require an operator permission enum later, but start with the minimum `tenant_approval:manage` authority.

## Operator Role Scope

Initial CLAiR operator authority is intentionally narrow.

Allowed for Project 02:

- Read tenant applications and tenant approval status.
- Approve, reject, or hold tenant applications.
- Create or approve one workspace for an approved tenant.
- Create the first `hospital_admin` invitation for that tenant.
- Change tenant status between launch-approved states only after the status model is defined.
- View operator action audit entries needed for handoff/QA.

Not allowed for Project 02:

- Directly edit clinical, guardian, patient, billing, or medical data.
- Bypass workspace membership checks for normal hospital workspace routes.
- Change canonical hospital roles or permission policy.
- Use service-role credentials from the browser.
- Execute remote Supabase, live DB/RLS, real email delivery, real data import, or production deploy without the approval gates in `saas-launch-approval-gates.md`.

## Route Guard Contract

Every CLAiR ops route should use a guard shape equivalent to:

1. Parse route params and request body.
2. Resolve verified server session with `readServerSession()`.
3. Resolve CLAiR operator authority from server-owned data.
4. Validate the required operator permission for the route, initially `tenant_approval:manage`.
5. Validate tenant/application state transition.
6. Apply duplicate and safety guards, such as existing workspace and first-admin invitation conflicts.
7. Execute the operation through a server-only persistence boundary.
8. Emit a safe audit event.
9. Return the standard safe response envelope.

Recommended route families:

| Route family | Required authority | Main denial reasons |
| --- | --- | --- |
| `GET /api/ops/tenant-applications` | `tenant_approval:view` or `tenant_approval:manage` | `unauthenticated`, `operator_missing`, `operator_inactive`, `operator_permission_missing` |
| `POST /api/ops/tenant-applications/[applicationId]/approve` | `tenant_approval:manage` | `target_tenant_application_missing`, `tenant_application_not_pending`, `operator_permission_missing` |
| `POST /api/ops/tenant-applications/[applicationId]/reject` | `tenant_approval:manage` | `target_tenant_application_missing`, `tenant_application_not_pending`, `operator_permission_missing` |
| `POST /api/ops/tenant-applications/[applicationId]/workspace` | `tenant_approval:manage` | `tenant_not_approved`, `tenant_workspace_exists`, `first_admin_invitation_exists` |
| `PATCH /api/ops/tenants/[tenantId]/status` | `tenant_approval:manage` plus DEN-158 status policy | `invalid_tenant_status_transition`, `operator_permission_missing` |

Suggested new denial reasons:

| Reason | HTTP | Meaning |
| --- | ---: | --- |
| `operator_missing` | 403 | Verified user is not a CLAiR operator. |
| `operator_inactive` | 403 | Operator record exists but is disabled or suspended. |
| `operator_permission_missing` | 403 | Operator lacks the required CLAiR internal permission. |
| `target_tenant_application_missing` | 404 | Tenant application does not exist or is unavailable to this operator route. |
| `tenant_application_not_pending` | 409 | Requested approval/rejection is invalid for current application status. |
| `tenant_not_approved` | 409 | Workspace creation was attempted before approved status. |
| `tenant_workspace_exists` | 409 | Tenant already has a workspace. |
| `first_admin_invitation_exists` | 409 | A first admin invitation already exists or is still pending. |
| `invalid_tenant_status_transition` | 409 | Requested tenant status transition is not allowed. |

Do not return raw provider errors, invite tokens, SQL text, stack traces, cookies, authorization headers, service-role material, or secret-shaped values.

## MFA And Strong Auth Policy

MFA is recommended for CLAiR operators before pilot/live because operator accounts can create tenants and first admin invitations.

For launch foundation:

- Record MFA as a pilot/live hardening requirement for CLAiR operators.
- Do not implement MFA inside DEN-155.
- Do not block local-first docs or mock UI work on MFA.
- Do not mark a staging/live operator console ready until strong-auth requirements are reviewed.

Strong-auth target for pilot/live:

| Actor | Minimum launch recommendation |
| --- | --- |
| CLAiR operator | MFA required before staging/live operator mutations, preferably Supabase `aal2` for sensitive routes when MFA is enabled. |
| Hospital admin | MFA strongly recommended before pilot; can be phased after first vertical slice if explicitly accepted. |
| Staff member | MFA optional for MVP unless clinic policy requires it. |

Supabase Auth MFA supports assurance levels in the JWT. `aal1` means conventional login, and `aal2` means the user completed an additional verified factor. Future enforcement can check the current session assurance level on server routes or DB/RLS policies where appropriate, but the app must still verify operator authority from server-owned data.

## Audit Requirements

Operator actions must produce audit events before Project 02 is considered pilot-ready.

Minimum event set:

| Event | Required context | Must not include |
| --- | --- | --- |
| `ops.tenant_application_approved` | request id, operator user id, application id, tenant id if available, previous status, next status | Raw documents with sensitive customer data, stack traces |
| `ops.tenant_application_rejected` | request id, operator user id, application id, previous status, rejection category | Private notes beyond approved audit summary |
| `ops.workspace_created_for_tenant` | request id, operator user id, tenant id, workspace id | Service-role keys, raw SQL/provider payload |
| `ops.first_admin_invitation_created` | request id, operator user id, tenant id, workspace id, invite id, target email hash or normalized email policy decision | Raw invite token or password/reset link |
| `ops.tenant_status_changed` | request id, operator user id, tenant id, previous status, next status, reason category | Raw billing/payment/customer records |
| `ops.operator_denied` | request id, actor user id when available, route operation, denial reason | Cookies, authorization headers, raw JWT |

Audit storage should reuse the existing audit foundation where possible, but tenant approval events need an explicit event matrix before live persistence.

## Break-Glass And Emergency Operations

Break-glass is excluded from Project 02 implementation.

For launch foundation, break-glass means any emergency operation that bypasses normal CLAiR operator guard, normal tenant approval state, or standard audit flow. It must not be hidden inside routine admin UI.

If a future break-glass flow is approved, it must require:

- Named approval owner.
- Named target environment.
- Time-limited access.
- Reason category and incident/reference id.
- Strong authentication.
- Mandatory audit event.
- Post-action review.

Until then, direct DB edits, manual Supabase dashboard mutation, service-role scripts, and production support console shortcuts are outside the current project.

## Security Blockers Before Implementation Handoff

Project 02 implementation issues should treat these as blockers:

1. Operator authority source is not defined in server-owned data.
2. Operator guard would rely on browser state, personal profile, workspace role, query param, or user-editable metadata.
3. Ops route would use service-role credentials in browser/client code.
4. Tenant approval or first-admin invitation would not be audited.
5. Workspace creation could run for an unapproved tenant.
6. Duplicate workspace or duplicate first-admin invitation conflicts are not blocked.
7. MFA/strong-auth requirement is omitted from staging/live readiness.
8. A route claims security completion with only client UI gating.
9. Remote Supabase, real email, production deploy, role policy, or real data work is attempted without the approval gates.

## Fit With Existing Permission Resolver

This model does not change the hospital workspace permission resolver.

- `resolveWorkspacePermission(...)` continues to govern workspace-scoped EMR and hospital admin actions.
- CLAiR operator guard is a separate precondition for ops routes only.
- A CLAiR operator does not automatically become a member of every hospital workspace.
- A hospital `hospital_admin` cannot approve tenants or create first-admin invitations for other hospitals.
- Existing last active `hospital_admin` protection still applies to hospital membership changes after the first admin is active.

## Source References

- `docs/engineering/auth-security/auth-login/saas-launch-foundation-scope-audit.md`
- `docs/engineering/auth-security/auth-login/invite-only-b2b-saas-launch-architecture.md`
- `docs/engineering/auth-security/auth-login/saas-launch-approval-gates.md`
- `docs/engineering/auth-security/auth-login/workspace-member-server-route-contract.md`
- `docs/engineering/auth-security/auth-login/api-error-telemetry-contract.md`
- `docs/product/domain/workspace-auth-permissions.md`
- Supabase MFA docs: https://supabase.com/docs/guides/auth/auth-mfa
- Supabase product security docs: https://supabase.com/docs/guides/security/product-security
- Supabase changelog: https://supabase.com/changelog

## Verification

- Reviewed existing permission resolver, workspace/member server route contract, invite-only launch architecture, and launch approval gates for conflict.
- Checked current Supabase MFA docs and changelog for strong-auth implications.
- Confirmed no canonical hospital role or role-policy change is introduced.
- No UI implementation, DB/RLS migration, remote Supabase operation, real email delivery, production deploy, or real data access was performed.
