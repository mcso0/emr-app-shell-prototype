# Session Logout Policy Spec

Status: draft  
Updated: 2026-06-12

This document defines the product target for CLAiR EMR session persistence, automatic sign-in, logout, session expiry, and recent-auth requirements. It should be read with [Login Invite Onboarding Spec](login-invite-onboarding-spec.md), [Member Role Management Spec](member-role-management-spec.md), and [Workspace Auth and Permission Domain](../../domain/workspace-auth-permissions.md).

## Product Goal

CLAiR EMR should keep daily returning login simple while protecting shared hospital workstations and high-impact admin actions. Users should not need to sign in again on every refresh, but the product must clearly define when a session remains valid, when it expires, and when a sensitive action requires fresh authentication.

## Scope

In scope:

- Returning-user session persistence.
- Automatic sign-in expectation.
- Logout behavior.
- Session-expired redirect behavior.
- Idle timeout and absolute session timeout product targets.
- Shared-device risk for reception desks and common workstations.
- Recent-auth requirement for high-impact actions.
- User-facing states for expired sessions, inactive memberships, and unsafe redirects.

Out of scope for this spec:

- OAuth, SSO, SCIM, MFA, and passkeys.
- Password reset and email identity change.
- Auth provider implementation details.
- Cookie, token, storage, and server-session engineering design.
- DB schema, RLS, migration, and backend enforcement implementation.
- Real external email delivery.
- Production launch or public access.

## Baseline Decisions

- Returning users sign in with email and password.
- Automatic sign-in/session persistence is allowed by default for normal daily use.
- Login must still verify active workspace membership before entering workspace routes.
- Logout must clear the app's authenticated session and return the user to login.
- Unsafe external `next` URLs must be ignored.
- Session-expired redirects should preserve only safe internal routes.
- Shared hospital devices require visible logout and idle-expiry behavior.
- High-impact actions should require recent authentication before production use.

## Recommended MVP Policy

Use this as the product target unless later security review changes it:

| Policy | Recommended MVP target | Reason |
| --- | --- | --- |
| Default session persistence | On by default | Hospital staff should not re-login on every refresh during normal work. |
| Remember-me checkbox | Not required in MVP | A default session policy is simpler than exposing another choice too early. |
| Idle timeout | 8 hours | Covers a normal work shift while still expiring abandoned shared devices. |
| Absolute timeout | 30 days | Prevents indefinite sessions while keeping daily use practical. |
| Session-expired route recovery | Preserve safe internal `next` only | Users should return to their intended workspace page after login. |
| Manual logout | Always visible from app shell/profile surface | Shared reception/admin devices need an obvious exit. |
| High-impact recent-auth window | 15 minutes | Admin and security-sensitive changes should not rely on an old unattended session. |

These are product targets, not implementation claims.

## Session States

| State | Meaning | Expected behavior |
| --- | --- | --- |
| `anonymous` | No valid session. | Show login. |
| `authenticated` | Account session is valid. | Verify workspace membership before route entry. |
| `workspace_active` | Account session and active workspace membership are valid. | Allow workspace route access based on roles and permissions. |
| `workspace_inactive` | Account exists but membership is inactive for this workspace. | Block workspace route and show access-recovery state. |
| `session_expired` | Account session expired or cannot be refreshed. | Redirect to login with safe `next`. |
| `recent_auth_required` | Session is valid, but high-impact action needs fresh authentication. | Ask user to re-enter password or complete the approved fresh-auth step. |
| `logged_out` | User intentionally logged out. | Clear session and return to login without auto-entering the workspace. |

## Core User Journeys

### 1. Returning User Opens CLAiR EMR

1. User opens CLAiR EMR.
2. System checks whether the account session is still valid.
3. System verifies active workspace membership.
4. If valid, user enters the default workspace or safe requested route.
5. If invalid or expired, user returns to login.

Acceptance criteria:

- A page refresh does not force login when the session is valid.
- Active membership is required for workspace entry.
- Inactive membership blocks workspace entry even if the account session is valid.
- Unsafe external redirects are ignored.

### 2. Session Expires During Work

1. User is working in a workspace route.
2. Session expires by idle timeout, absolute timeout, provider invalidation, or manual security event.
3. System blocks protected interactions.
4. User is redirected to login with a safe internal `next`.
5. After login, user returns to the intended route when still authorized.

Acceptance criteria:

- Expiry state is clear and not treated as a generic error.
- Unsaved clinical or billing work should have a later implementation strategy before production use.
- The system must not continue protected mutations after session expiry.
- Redirect recovery never uses an external URL.

### 3. Manual Logout

1. User clicks logout from the app shell or profile/account menu.
2. System clears the authenticated session.
3. User returns to login.
4. User does not automatically re-enter the workspace until signing in again.

Acceptance criteria:

- Logout is visible and reachable.
- Logout clears local authenticated app state.
- Logout does not delete workspace data, account data, or membership.
- On shared devices, logout is the recommended handoff action.

### 4. High-Impact Action Requires Recent Auth

1. User starts a high-impact action.
2. System checks whether the user's recent-auth window is valid.
3. If stale, system asks for fresh authentication.
4. After successful fresh auth, the action can continue.

High-impact actions should include:

- Promoting a member to `hospital_admin`.
- Removing `hospital_admin` from a member.
- Deactivating a member.
- Changing member roles.
- Canceling or resending sensitive invitations when abuse risk is identified.
- Editing security-sensitive workspace settings.
- CLAiR internal operator recovery actions.

Acceptance criteria:

- Recent-auth requirement does not replace role/permission checks.
- Recent-auth success should be time-limited.
- Failed recent-auth should not reveal sensitive account details.
- High-impact action attempts should be auditable where useful.

## Shared-Device Requirements

CLAiR EMR is used in hospital environments where reception desks, treatment rooms, and shared back-office PCs may be used by multiple staff members.

Requirements:

- Logout should be visible in the main app shell or profile menu.
- Session timeout copy should explain that the user must sign in again.
- Idle timeout should protect unattended shared workstations.
- Users should not be encouraged to share accounts.
- Role and audit behavior should assume actions are tied to the signed-in account.

Deferred:

- Kiosk/shared-device mode.
- Per-workstation trust settings.
- Device management or managed browser policy.
- SSO/device compliance integrations.

## Error And Recovery States

Required states:

- Session expired.
- Login required.
- Workspace membership inactive.
- Workspace membership missing.
- Unauthorized workspace route.
- Recent authentication required.
- Recent authentication failed.
- Logout complete.
- Unsafe redirect ignored.

## Current Implementation Relationship

Current implementation already has related foundations:

- `/login` email/password entry.
- Safe redirect and workspace access guard.
- Supabase/server-session boundaries.
- Mock fallback for development.
- Workspace membership and role-management foundations.

Known mismatch:

- The final production session duration, idle timeout, absolute timeout, and recent-auth enforcement are not complete claims.
- Mock/development role behavior should not be treated as product login behavior.
- Client-only route gating is not complete security. Server-side checks and later DB/RLS enforcement remain required for production security claims.

## CLAiR Docs Viewer Placement

This spec should appear in CLAiR Docs under `Features`.

Display intent:

- This document explains the product session policy.
- Engineering auth docs should own provider, cookie, token, route-handler, DB, and RLS implementation details.
- Current-state docs should continue to record what is implemented now.

## Open Questions

- Should idle timeout be shorter for front-desk/shared-device roles than for hospital admins or vets?
- Should high-impact recent-auth require password re-entry only, or later support MFA/passkey if introduced?
- How should unsaved chart, billing, or reception work be recovered after session expiry?
- Should hospital admins be able to configure workspace session policy later, or should CLAiR keep a fixed policy?

## Follow-Up Planning

Recommended next specs:

1. Invite email delivery and recovery policy.
2. CLAiR internal operator recovery and audit policy.
3. Unsaved-work recovery behavior for session expiry.
