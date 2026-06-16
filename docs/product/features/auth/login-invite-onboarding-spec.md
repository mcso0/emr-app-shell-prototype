# Login Invite Onboarding Spec

Status: draft  
Updated: 2026-06-12

This document defines the product target for CLAiR EMR login, first hospital admin onboarding, and staff invite onboarding. It should be read with [Workspace Auth and Permission Domain](../../domain/workspace-auth-permissions.md), [Workspace Hospital Profile](../../domain/workspace-hospital-profile.md), and [Auth Login And Onboarding Current State](../../current-state/auth-login-onboarding-current-state.md).

## Product Goal

CLAiR EMR should let only approved hospital workspace members enter the product while keeping returning login simple: email and password for daily use, invite links for first account creation or workspace joining, and hospital-admin-controlled staff access after onboarding.

## Scope

In scope:

- Returning user email/password login.
- First hospital owner/admin invite acceptance.
- First hospital admin account creation or existing account login.
- First hospital admin onboarding into a CLAiR-created workspace.
- Hospital profile confirmation during onboarding.
- Hospital admin staff invitation.
- Invited staff account creation or existing account login.
- Workspace membership activation after invite acceptance.
- Safe redirect back to the requested workspace route.
- Session persistence and logout policy draft requirements.

Out of scope for this spec:

- Open self-service hospital signup.
- Demo/mock role selector.
- Real external email delivery implementation.
- OAuth, social login, SSO, SCIM, MFA, and password reset.
- DB schema, migration, RLS, and server/API implementation details.
- Real hospital/customer/patient/guardian/payment data.
- Production launch or public access.

## Product Baseline

- CLAiR EMR is a B2B workspace product.
- CLAiR operations creates the hospital workspace after sales/implementation agreement.
- CLAiR sends the first hospital owner/admin an invitation link by email.
- The first hospital admin accepts the invitation and creates or signs into an account.
- The first hospital admin confirms or edits the workspace hospital profile.
- Hospital admins invite additional staff from inside the workspace.
- Invited staff join through the invitation flow.
- Returning users sign in with email and password.
- The real product does not show mock role selection.

## Primary Actors

| Actor | Meaning |
| --- | --- |
| CLAiR operator | CLAiR-side implementation or operations user who creates the hospital workspace and sends the first invite. |
| First hospital admin | Hospital owner, director, or approved administrator who receives the first invite and gets `hospital_admin` authority. |
| Hospital admin | Workspace admin who can invite staff, manage roles/status, and maintain hospital settings. |
| Staff invitee | Vet, technician, or front-desk user invited into an existing workspace. |
| Returning user | Active workspace member signing in again with email/password. |

## Core User Journeys

### 1. Returning User Login

1. User opens CLAiR EMR.
2. User enters email and password.
3. System authenticates the account.
4. System verifies active workspace membership.
5. If a safe `next` route exists, system returns the user there.
6. If no safe `next` route exists, system opens the user's default workspace route.

Acceptance criteria:

- External or unsafe `next` values are ignored.
- Inactive, suspended, or missing workspace membership cannot enter workspace routes.
- Login error messages do not reveal sensitive account existence details.
- Returning login does not expose mock role selection.

### 2. First Hospital Admin Invite

1. CLAiR operator creates the hospital workspace.
2. CLAiR sends an invite link to the first hospital owner/admin email.
3. The first hospital admin opens the invite link.
4. If no account exists, the admin creates an account with email/password.
5. If an account already exists, the admin signs in with email/password.
6. System activates the first hospital admin membership.
7. System routes the admin to onboarding or the workspace.

Acceptance criteria:

- First hospital admin receives `hospital_admin`.
- The workspace must always retain at least one active `hospital_admin`.
- Invite context should show hospital/workspace name and invited email.
- Account creation must be tied to the invited email.
- Expired, canceled, or already accepted invites show a clear recovery state.

### 3. First Hospital Admin Onboarding

1. First hospital admin enters onboarding after invite acceptance.
2. System shows CLAiR-prefilled hospital profile fields when available.
3. Admin confirms or edits required hospital profile fields.
4. Admin saves and enters the workspace.

Required profile areas:

- Hospital name.
- Workspace ID.
- Hospital address.
- Symbol and logo, optional but recommended.
- Representative phone number.
- Representative contact number.
- Fax number, optional.
- Owner/director or business representative name.
- Business registration number when business/legal setup is in scope.
- Hospital URL, homepage, Instagram, and other public links when available.
- Operating hours and basic operational settings.

Acceptance criteria:

- Onboarding writes or confirms the workspace hospital profile, not personal profile.
- Hospital profile editing is hospital-admin-only.
- Missing required fields are clearly marked.
- Referral settings are not required in phase 1.

### 4. Staff Invitation

1. Hospital admin opens member management.
2. Admin enters staff email.
3. Admin selects one or more canonical roles.
4. Admin optionally enters title and department.
5. System creates a pending invitation.
6. Invitee accepts the invite and creates or signs into an account.
7. System activates membership with assigned role(s).

Acceptance criteria:

- Canonical roles are `hospital_admin`, `vet`, `technician`, and `front_desk`.
- `billing_admin` / `수납 관리자` is not a phase-1 canonical role.
- Duplicate active memberships are blocked.
- Duplicate pending invitations are blocked or resolved through resend.
- Pending invitations can be resent or canceled.
- Staff cannot self-assign roles.

## Session And Logout Policy Draft

This spec records the product need but does not finalize the security policy.

Draft requirements:

- Returning users should not need to log in on every page refresh.
- Shared-device risk should be considered for hospital reception desks.
- The product needs explicit session duration, idle timeout, and absolute timeout rules.
- Logout should clear local app session state and return the user to login.
- Session-expired redirects should preserve the requested route as safe `next`.

Open decisions:

- Default "remember me" behavior.
- Idle timeout duration.
- Absolute session duration.
- Whether high-risk actions require recent re-authentication.

## Error And Recovery States

Required states:

- Login failed.
- Session required or expired.
- Unauthorized workspace access.
- Invite missing.
- Invite expired.
- Invite canceled.
- Invite already accepted.
- Existing-account invite requires login with the invited email.
- New-account invite requires password setup.
- Admin re-request needed for blocked invite recovery.

## Current Implementation Relationship

Current implementation already has useful pieces:

- `/login` email/password entry.
- Supabase password login boundary.
- Mock fallback for development.
- Invite acceptance screens.
- Invite password setup and existing-account login states.
- Safe redirect and workspace access guard.
- Local-first workspace/member invitation foundations.

Known mismatch:

- Current `/workspace/new` is a prototype/local-first workspace creation flow. Product target says CLAiR operations creates the hospital workspace first.
- Mock role selection is still present in non-production development mode. It is not part of real product planning.
- Full real email delivery, production DB/RLS enforcement, and session policy are not complete.

## CLAiR Docs Viewer Placement

This spec should appear in CLAiR Docs under `Features`.

Display intent:

- Feature specs should be separate from `Current State` inventory documents.
- Current-state docs answer "what is implemented now?"
- Feature specs answer "what should the product do?"
- The CLAiR Docs UI may need a later navigation polish so `Current State`, `Domain`, and `Features` are visually easier to distinguish.

## Follow-Up Planning

Recommended next specs:

1. Hospital profile onboarding spec.
2. Member and role management spec.
3. Session and logout security policy.
4. Invite email delivery and recovery policy.
