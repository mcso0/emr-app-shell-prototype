# Workspace Membership Data and Security Plan

Updated: 2026-05-17
Linear: DEN-20

This is the implementation planning source for workspace membership data, invitation data, subscription linkage, RLS boundaries, and server security gates. This is plan-only: no migration SQL, RLS policy SQL, live Supabase validation, or product code was written in this work.

## Executive Decision

Use a workspace-scoped membership model where Supabase Auth proves identity, app tables own profile and membership state, and server/RLS gates enforce workspace access.

Key decisions:

- `users.id` remains equal to `auth.users.id` for loginable app users.
- `user_memberships` is the workspace-scoped authorization source.
- MVP membership roles are stored as an additive `roles text[]` set on `user_memberships`.
- `hospital_admin` dominates the effective permission union.
- Do not introduce deny rules or custom roles in MVP.
- Personal profile data must not contain role, permission, or membership authority.
- Last active `hospital_admin` protection requires a server-side transaction or privileged RPC, not client-only UI logic.

## Current Official Supabase Constraints Checked

Checked on 2026-05-17:

- Supabase RLS docs: use `auth.uid()`/`auth.jwt()` carefully, specify `TO authenticated`, enable RLS for protected tables, and remember UPDATE also needs a matching SELECT policy.
- Supabase Auth Users docs: `user_metadata` is user-editable and must not be used in RLS or authorization logic.
- Supabase API security docs: Data API object grants and RLS are separate layers. A table can need explicit grants/exposure and still need row policies.
- Supabase changelog: as of 2026-04-28, new public-schema tables are not automatically exposed to Data and GraphQL API for new projects. Future migration work must explicitly check table grants/exposure.
- Supabase changelog: the RLS Tester feature preview is available and should be used during RLS verification once policies exist.

References:

- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/auth/users
- https://supabase.com/docs/guides/api/securing-your-api
- https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically
- https://supabase.com/changelog/45233-feature-preview-rls-tester

## Proposed MVP Table Set

### `workspaces`

Purpose: workspace route and hospital operating scope.

Recommended fields beyond the current draft:

| Field | Purpose |
| --- | --- |
| `id` | Route-safe workspace id. |
| `branch_id` | Hospital branch binding. |
| `display_name` | Workspace display name. |
| `status` | `active`, `archived`, later `suspended`. |
| `created_by_user_id` | Creator user, same UUID space as `auth.users.id`. |
| `created_at`, `updated_at` | Operational timestamps. |

Creation rule:

- Workspace creation, initial subscription placeholder, app user upsert, and creator `hospital_admin` membership should be one server transaction in the future implementation.

### `workspace_subscriptions`

Purpose: represent the subscription/onboarding gate without coupling billing provider details into workspace membership.

Recommended MVP fields:

| Field | Purpose |
| --- | --- |
| `id` | Subscription row id. |
| `workspace_id` | Workspace scope. |
| `status` | `trialing`, `active`, `past_due`, `canceled`, `none`. |
| `provider` | `manual`, later payment provider id. |
| `provider_customer_id`, `provider_subscription_id` | Nullable provider references. |
| `current_period_end` | Nullable provider period boundary. |
| `created_at`, `updated_at` | Operational timestamps. |

MVP rule:

- Real payment integration remains out of scope. This table is a future-ready gate for workspace creation and access decisions.

### `users`

Purpose: app-domain user profile and staff/person reference.

Recommended fields:

| Field | Purpose |
| --- | --- |
| `id` | UUID PK, equal to `auth.users.id` for loginable users. |
| `display_name` | App display source. |
| `initial` | Avatar fallback. |
| `email`, `phone` | App contact/display copy, not login identity source. |
| `status` | `active`, `inactive`, `invited`. |
| `created_at`, `updated_at` | Operational timestamps. |

Security rule:

- `users` is not a permission source except for basic app-user status. Roles and membership authority stay in `user_memberships`.

### `user_profiles`

Purpose: optional user-owned personal settings extension.

Recommended fields:

| Field | Purpose |
| --- | --- |
| `user_id` | PK/FK to `users.id`. |
| `avatar_url` | Nullable avatar reference. |
| `notification_preferences` | JSONB placeholder for user preference, not authorization. |
| `locale`, `timezone` | Nullable personal preference. |
| `updated_at` | Timestamp. |

MVP recommendation:

- Keep profile editing simple. If the first UI only needs display name, initials, and phone, those can live on `users`; `user_profiles` is the extension point for preferences/avatar. It must never contain roles or permission flags.

### `user_memberships`

Purpose: workspace membership, employment metadata, and role assignment source.

Recommended fields:

| Field | Purpose |
| --- | --- |
| `id` | Membership row id. |
| `workspace_id` | Workspace scope. |
| `user_id` | App user id, equal to Supabase auth user id. |
| `roles` | Non-empty canonical role array: `hospital_admin`, `vet`, `technician`, `front_desk`. |
| `department`, `title`, `hire_date` | Staff display/operation metadata. |
| `status` | `pending`, `active`, `inactive`. |
| `invited_by_user_id` | Nullable inviter reference. |
| `activated_at`, `deactivated_at` | Lifecycle timestamps. |
| `created_at`, `updated_at` | Operational timestamps. |

Constraints:

- Unique `(workspace_id, user_id)`.
- `roles` must be non-empty for `active` membership.
- `roles` values must be limited to canonical MVP roles.
- Active membership is required before any workspace product access.
- Last active `hospital_admin` removal, demotion, or deactivation must be blocked server-side.

Why `roles text[]` for MVP:

- It matches the representative requirement that roles can be duplicated/additive.
- It avoids overbuilding a custom role system before the MVP proves real admin workflows.
- It can migrate later to `user_membership_roles` if we add custom roles, deny rules, or detailed role history.

### `workspace_invitations`

Purpose: invite staff before a user has accepted or joined.

Recommended fields:

| Field | Purpose |
| --- | --- |
| `id` | Invitation row id. |
| `workspace_id` | Workspace scope. |
| `email` | Invite target email, case-insensitive. |
| `invited_roles` | Non-empty canonical role array. |
| `status` | `pending`, `accepted`, `canceled`, `expired`. |
| `invited_by_user_id` | Hospital admin that created the invite. |
| `accepted_by_user_id` | User id after acceptance. |
| `expires_at`, `accepted_at`, `created_at`, `updated_at` | Lifecycle timestamps. |

Constraints:

- Only `hospital_admin` can create/cancel/resend invitations.
- Block duplicate pending invitations for the same workspace/email.
- Accepting an invitation should create or activate the corresponding `user_memberships` row in one server transaction.

### `permission_policies`

Purpose: effective permission source by role and later user-specific exception.

Current name stays `permission_policies`. Treat `role_permission_policies` as a descriptive alias, not a second table name.

Recommended fields:

| Field | Purpose |
| --- | --- |
| `id` | Policy row id. |
| `workspace_id` | Workspace scope. |
| `name` | Policy label. |
| `scope` | `role` or future `user`. |
| `target_role` | Required when `scope = role`. |
| `target_user_id` | Required when `scope = user`. |
| `permissions` | JSONB allowed permission ids. |
| `created_at`, `updated_at` | Operational timestamps. |

MVP rule:

- Role policies are allow-only.
- User-scoped overrides are allowed only after a separate product decision.
- No deny rules in MVP.

## Effective Permission Resolution

Resolver input:

- verified session user id
- requested `workspace_id`
- required permission id or operation descriptor

Resolver output:

- app user status
- membership status
- assigned roles
- effective permissions
- denial reason when blocked

Algorithm:

1. Verify Supabase session server-side.
2. Load `users` by session user id and require `status = active`.
3. Load `user_memberships` by `(workspace_id, user_id)` and require `status = active`.
4. Merge all role-scoped `permission_policies` for assigned roles.
5. If `hospital_admin` is present, return full workspace/admin permission set.
6. Return a typed allow/deny decision to server route handlers or data access functions.

Denial reasons to model:

- unauthenticated
- app user missing
- app user inactive
- workspace membership missing
- workspace membership inactive or pending
- required permission missing
- last admin safety violation
- workspace archived or subscription gate blocked

## RLS Boundary Plan

RLS is the database row boundary, not the whole authorization system.

Future policy principles:

- Enable RLS on all exposed-schema tables that carry workspace, user, patient, chart, order, billing, or settings data.
- Use `TO authenticated` explicitly for authenticated policies.
- Use `auth.uid()` only for identity, then join/exists against active membership rows.
- Do not use `user_metadata`, `raw_user_meta_data`, query params, local storage, or client role labels.
- Do not rely on stale JWT `app_metadata` for active membership or permission checks.
- UPDATE policies need matching SELECT policies.
- Views must use `security_invoker = true` on Postgres 15+ or be kept inaccessible/unexposed.
- Security definer functions must live in a private/unexposed schema.
- Data API exposure/grants must be checked separately from RLS policy creation.

RLS scope matrix:

| Table group | Read rule | Mutation rule |
| --- | --- | --- |
| Workspace/profile tables | Active workspace member can read allowed workspace/member rows. | `hospital_admin` for workspace/admin changes; own profile for personal profile only. |
| Invitation tables | `hospital_admin` only. | `hospital_admin` only; invite acceptance through server flow. |
| Clinical/business tables | Active member can read only rows in current workspace, subject to module permission. | Server permission resolver first; RLS prevents cross-workspace writes. |
| Admin/settings tables | `hospital_admin` only. | `hospital_admin` only. |
| Audit tables | Admin read; append by trusted server path. | No broad client mutation. |

## Server Security Gates

The future implementation should add server gates before trusting UI gating:

1. `requireSessionUser()`
2. `requireWorkspaceMembership(workspaceId)`
3. `resolveWorkspacePermissions(workspaceId)`
4. `requireWorkspacePermission(workspaceId, permissionId)`
5. `assertNotLastHospitalAdminChange(workspaceId, targetMembershipId, nextRolesOrStatus)`

Initial endpoints/actions to protect first:

- workspace creation
- invite create/cancel/resend/accept
- membership role/status update
- personal profile update
- chart/SOAP mutation
- billing issue/refund/payment mutation
- service catalog/admin settings mutation

## Audit Events Required

Minimum audit event types for this auth stream:

| Event | Purpose |
| --- | --- |
| `workspace.created` | Workspace and creator membership established. |
| `workspace.subscription_status_changed` | Subscription gate changed. |
| `workspace.invitation_created` | Staff invitation created. |
| `workspace.invitation_resent` | Invite resent. |
| `workspace.invitation_canceled` | Invite canceled. |
| `workspace.invitation_accepted` | Invite accepted and membership activated. |
| `workspace.membership_roles_changed` | Role assignment changed. |
| `workspace.membership_status_changed` | Member activated/deactivated. |
| `workspace.last_admin_change_blocked` | Safety rule blocked an unsafe admin removal. |
| `user.profile_updated` | Personal profile changed. |
| `permission_policy.changed` | Role policy changed. |

Audit guidance:

- Auth/admin audit events should include actor user id, workspace id, target user or invitation id, before/after summary, and request id when available.
- Do not store raw tokens, passwords, or invite secrets in audit payloads.

## Verification Plan for Future Implementation

When migration/RLS/server code is approved:

- Run migration review and Supabase advisor or project-approved SQL verification.
- Confirm Data API grants/exposure for each new table intentionally exposed.
- Use Supabase RLS Tester where available.
- Test unauthenticated denial.
- Test active member read success.
- Test inactive/pending member denial.
- Test workspace mismatch denial.
- Test `hospital_admin` admin success.
- Test vet admin-settings denial.
- Test technician/front desk chart mutation denial.
- Test last active `hospital_admin` demotion/deactivation denial.
- Test own personal profile update success and role update denial.

## Out Of Scope

- Migration SQL.
- RLS policy SQL.
- Live Supabase project validation.
- Server resolver implementation.
- Product UI changes.
- Real payment provider integration.
- Real email delivery.
- Custom role builder, deny rules, SCIM, SSO, or domain auto-join.

## Next Recommended Issue

Proceed to DEN-23 only after this plan is accepted: build the workspace creation foundation for a subscribing hospital admin, keeping the implementation server-boundary-first and session/mock compatible until live Supabase migration scope is explicitly approved.
