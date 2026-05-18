# Workspace and Member Server Route Contract

Updated: 2026-05-18
Linear: DEN-43
Project: `02 Workspace & Membership Live Persistence`

## Executive Summary

Project 02 live persistence work must route workspace and member mutations through server-owned boundaries before trusting UI state.

The first implementation issue after this contract should not invent route semantics ad hoc. It should use this contract for actor identity, workspace scope, permission checks, denial reasons, mock fallback, and regression coverage.

## Contract Principles

1. Server routes must resolve actor identity with `readServerSession()`.
2. The demo actor header is allowed only when the server session result is `mock_mode`, matching the existing role-update route seam.
3. Browser storage, query params, user-editable metadata, and client role labels are not authorization sources.
4. Workspace-scoped mutations must require active membership in that workspace.
5. Admin/member management mutations must require `role_permission:manage`.
6. Personal profile writes are own-user writes and must never accept role, permission, or membership authority fields.
7. Remote Supabase, elevated secret/service-role credentials, real email delivery, and payment/subscription provider effects remain approval-gated.
8. Server modules that perform authorization or DB mutation should stay server-only and be covered by targeted route/contract tests.

## Shared Request Flow

Every protected route should follow this sequence:

1. Parse dynamic route params and JSON body.
2. Read the verified server session.
3. Resolve actor identity:
   - `supabase_session` in Supabase mode.
   - `demo_header_mock_mode` only when mock fallback is active.
4. Validate input shape before DB mutation.
5. Load permission adapter data for the requested workspace and actor.
6. Resolve required permission when the route is workspace/admin scoped.
7. Apply operation-specific safety guards, such as duplicate invite and last active `hospital_admin` protection.
8. Execute the DB transaction or persistence gateway.
9. Return a typed JSON response with `ok`, status, and either persisted result or denial reason.

## Response Envelope

Success:

```json
{
  "ok": true,
  "data": {},
  "enforcedBy": "server-route-contract"
}
```

Failure:

```json
{
  "ok": false,
  "denialReason": "permission_missing"
}
```

For validation failures, use `error: "invalid_input"` plus field-level details only when useful to the UI. Do not echo secrets, invite tokens, raw SQL errors, or credential material.

## Common Denial Reasons

| Reason | HTTP | Meaning |
| --- | ---: | --- |
| `unauthenticated` | 401 | No verified session and no allowed mock fallback actor. |
| `invalid_input` | 400 | Body or params are malformed or unsupported. |
| `invalid_roles` | 400 | Requested roles are empty or outside canonical MVP roles. |
| `inactive_user` | 403 | Actor app user is inactive or suspended. |
| `workspace_membership_missing` | 403 | Actor has no membership in the requested workspace. |
| `workspace_membership_inactive` | 403 | Actor membership is pending, inactive, or suspended. |
| `permission_missing` | 403 | Actor lacks the required permission. |
| `target_membership_missing` | 404 | Target membership does not exist in the workspace. |
| `target_invitation_missing` | 404 | Target invitation does not exist in the workspace. |
| `duplicate_pending_invitation` | 409 | Pending invitation already exists for workspace/email. |
| `active_membership_exists` | 409 | Email or user already has active membership in the workspace. |
| `invitation_not_pending` | 409 | Invitation lifecycle action is invalid for the current status. |
| `last_admin_protected` | 409 | Mutation would remove the last active `hospital_admin`. |
| `profile_authority_field_forbidden` | 400 | Profile body tries to write role, permission, or membership authority. |
| `workspace_archived` | 403 | Workspace is archived or unavailable. |
| `subscription_gate_blocked` | 403 | Future subscription gate blocks the operation. |

## Route Contract Table

| Route | Method | Actor | Workspace scope | Required permission | Main denial reasons | Follow-up |
| --- | --- | --- | --- | --- | --- | --- |
| `/api/workspaces` | `POST` | Verified session user | New workspace | Authenticated app user; no existing workspace permission because workspace is being created | `unauthenticated`, `invalid_input`, `inactive_user`, `subscription_gate_blocked` | DEN-44 |
| `/api/workspaces` | `GET` | Verified session user | Actor memberships | Active membership per returned workspace | `unauthenticated`, `inactive_user` | DEN-45 |
| `/api/workspaces/[workspaceId]/invitations` | `POST` | Active workspace member | Existing workspace | `role_permission:manage` | `workspace_membership_missing`, `workspace_membership_inactive`, `permission_missing`, `invalid_roles`, `duplicate_pending_invitation`, `active_membership_exists` | DEN-46 |
| `/api/workspaces/[workspaceId]/invitations/[invitationId]/resend` | `POST` | Active workspace member | Existing workspace | `role_permission:manage` | `target_invitation_missing`, `invitation_not_pending`, `permission_missing` | DEN-47 |
| `/api/workspaces/[workspaceId]/invitations/[invitationId]/cancel` | `POST` | Active workspace member | Existing workspace | `role_permission:manage` | `target_invitation_missing`, `invitation_not_pending`, `permission_missing` | DEN-47 |
| `/api/workspaces/[workspaceId]/invitations/[invitationId]/accept` | `POST` | Verified invited user | Existing workspace | Matching pending invitation; no admin permission | `target_invitation_missing`, `invitation_not_pending`, `active_membership_exists`, `unauthenticated` | DEN-47 |
| `/api/workspaces/[workspaceId]/memberships` | `GET` | Active workspace member | Existing workspace | `role_permission:view` for full admin list; active member may read own membership | `workspace_membership_missing`, `workspace_membership_inactive`, `permission_missing` | DEN-48 |
| `/api/workspaces/[workspaceId]/memberships/[membershipId]/roles` | `POST` | Active workspace member | Existing workspace | `role_permission:manage` | `invalid_roles`, `target_membership_missing`, `permission_missing`, `last_admin_protected` | DEN-49/DEN-50 |
| `/api/workspaces/[workspaceId]/memberships/[membershipId]/status` | `PATCH` | Active workspace member | Existing workspace | `role_permission:manage` | `invalid_input`, `target_membership_missing`, `permission_missing`, `last_admin_protected` | DEN-50 |
| `/api/users/me/profile` | `PATCH` | Verified session user | Own profile, optional current workspace for shell refresh only | Own-user authenticated write | `unauthenticated`, `invalid_input`, `profile_authority_field_forbidden` | DEN-52 |

## Permission Matrix

| Operation | `hospital_admin` | `vet` | `technician` | `front_desk` |
| --- | --- | --- | --- | --- |
| Create own workspace during onboarding | Yes, as creator after transaction | Yes, if onboarding permits | Yes, if onboarding permits | Yes, if onboarding permits |
| Read own workspace selector list | Yes | Yes | Yes | Yes |
| Create/cancel/resend invitations | Yes | No | No | No |
| Accept own pending invitation | Yes, if invited | Yes, if invited | Yes, if invited | Yes, if invited |
| Read full member management list | Yes | No | No | No |
| Read own membership summary | Yes | Yes | Yes | Yes |
| Change member roles | Yes | No | No | No |
| Deactivate member | Yes, except last active admin | No | No | No |
| Edit own profile fields | Yes | Yes | Yes | Yes |
| Edit roles/permissions from profile | No | No | No | No |

The permission implementation should keep using canonical MVP roles: `hospital_admin`, `vet`, `technician`, and `front_desk`.

## Route Details

### Workspace Creation

`POST /api/workspaces`

Body:

```json
{
  "hospitalName": "Hanbit Animal Hospital",
  "adminName": "Song Minjae",
  "contactEmail": "admin@example.test",
  "contactPhone": "010-0000-0000"
}
```

Contract:

- Creates the workspace and creator active `hospital_admin` membership in one transaction boundary.
- Upserts the app-domain user row only for the verified session user.
- Does not write subscription/payment provider data unless a future approval gate scopes it.
- Does not use service-role or remote Supabase credentials without approval.

### Invitation Creation

`POST /api/workspaces/[workspaceId]/invitations`

Body:

```json
{
  "email": "staff@example.test",
  "roles": ["vet"],
  "expiresAt": "2026-06-01T00:00:00.000Z"
}
```

Contract:

- Requires `role_permission:manage`.
- Normalizes email case for duplicate checks.
- Blocks duplicate pending invitations and existing active memberships.
- Records resend intent later, but does not send real email in Project 02.

### Invitation Lifecycle

`POST /api/workspaces/[workspaceId]/invitations/[invitationId]/resend`

`POST /api/workspaces/[workspaceId]/invitations/[invitationId]/cancel`

`POST /api/workspaces/[workspaceId]/invitations/[invitationId]/accept`

Contract:

- Resend and cancel require `role_permission:manage`.
- Accept requires the invited verified user and a pending invitation.
- Accepting creates or activates the corresponding membership in the same transaction boundary.
- Public invite links and email token validation remain out of scope until separately approved.

### Membership Role and Status Mutation

Existing route:

`POST /api/workspaces/[workspaceId]/memberships/[membershipId]/roles`

Additional status route:

`PATCH /api/workspaces/[workspaceId]/memberships/[membershipId]/status`

Contract:

- Requires `role_permission:manage`.
- Validates canonical roles only.
- Keeps last active `hospital_admin` protection in server authorization and DB guard.
- Uses `target_membership_missing` for workspace-scoped missing targets instead of leaking cross-workspace data.
- Keeps the existing mock-mode actor header behavior only for mock fallback tests.

### Personal Profile

`PATCH /api/users/me/profile`

Body may include:

```json
{
  "displayName": "Song Minjae",
  "initials": "SM",
  "phone": "010-0000-0000",
  "notificationPreference": "workspace"
}
```

Contract:

- Writes only the actor's own user/profile fields.
- Rejects role, permission, membership status, billing authority, and workspace authority fields.
- May return updated shell display data, but role/permission context must continue to come from membership/permission sources.

## Mock Fallback and Live Handoff

| Mode | Behavior |
| --- | --- |
| `NEXT_PUBLIC_AUTH_MODE=mock` | Routes may accept `x-clair-demo-session-user-id` for targeted regression while UI can keep session-only helpers until each handoff issue replaces them. |
| `auto` with missing Supabase public env | Same mock fallback behavior as current local demo. |
| `auto` or `supabase` with Supabase session | Routes must use `readServerSession()` claims as actor identity and ignore demo identity headers. |
| Supabase mode with missing/invalid session | Return `401 unauthenticated`; do not fall back to browser storage. |

UI handoff issues should convert one flow at a time. A route-backed success must come from server response and persisted state, not from localStorage mutation alone.

## Test Strategy

DEN-44 through DEN-52 should add focused tests as routes are implemented:

| Area | Required coverage |
| --- | --- |
| Session identity | Supabase session actor, mock fallback actor, missing session denial, demo header ignored in Supabase mode. |
| Workspace creation | Valid create transaction, invalid input denial, creator active `hospital_admin`, reload/persisted selector follow-up. |
| Invitations | Admin create success, non-admin denial, duplicate pending denial, active membership duplicate denial. |
| Invitation lifecycle | Resend/cancel pending success, invalid status denial, accept creates/activates membership. |
| Membership reads | Admin list read, own membership read, inactive/missing membership denial. |
| Role/status mutation | Admin success, non-admin denial, cross-workspace denial, invalid roles, target missing, last-admin protected. |
| Profile | Own profile update success, role/permission authority fields rejected, shell display refresh, profile not used for authorization. |
| RLS/DB | Local Supabase validation for row workspace scope, admin/member boundaries, and DB last-admin guard where mutation touches DB. |

## Open Questions

- DEN-44 must choose the exact transaction implementation for workspace creation without using unapproved elevated credentials.
- DEN-47 must define the temporary local-only invite acceptance shape while real email delivery and public invite links remain out of scope.
- Audit persistence is not implemented in DEN-43; later implementation should add hook points without storing raw invite secrets or credential material.
- Subscription gating exists as a denial reason, but real provider integration remains out of Project 02 unless separately approved.

## Verification

- `npm run docs:check`
