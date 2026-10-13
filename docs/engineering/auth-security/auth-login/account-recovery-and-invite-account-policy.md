# Account Recovery And Invite Account Policy

Updated: 2026-10-14
Linear: DEN-154
Initiative: `CLAiR EMR SaaS Launch Foundation`

## Purpose

This document defines the pilot policy for password reset, account recovery, existing-account invitation conflicts, inactive accounts, and re-invites.

It is the account recovery reference for the future public invite acceptance implementation. It does not implement password reset UI, email provider setup, MFA, or production email delivery.

## Sources Checked

- Supabase changelog: `https://supabase.com/changelog.md`
- Supabase password-based auth: `https://supabase.com/docs/guides/auth/passwords`
- Supabase passwordless email auth: `https://supabase.com/docs/guides/auth/auth-email-passwordless`
- Supabase Auth Admin API: `https://supabase.com/docs/reference/javascript/admin-api`
- Supabase invite and generated-link references:
  - `https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail`
  - `https://supabase.com/docs/reference/javascript/auth-admin-generatelink`

Relevant changelog note: the 2026-05 changelog includes Auth updates, but no breaking change that changes the password reset/account recovery split used here. Recent breaking changes around Data API exposure and self-hosted database behavior do not change this policy.

## Decision

CLAiR EMR should not implement its own password system.

Supabase Auth owns identity, password sign-in, password reset email, recovery sessions, session cookies/tokens, email verification, and future MFA. The CLAiR app owns tenant approval, invitation state, app user profile rows, workspace memberships, roles, permission policies, status transitions, duplicate handling, and audit records.

Public self-signup remains excluded from the launch foundation. A user can become usable in the app only through a valid invitation and active workspace membership.

## Local Login Entry Follow-up (2026-10-14)

The approved Figma/HTML entry design is implemented locally under AUTH-PR-042. This is not a production delivery or provider rollout.

- Password login enables submission when the trimmed email has a valid address format and the password is nonempty. Do not trim the password or apply the new-password minimum to existing-account login.
- Ordinary email OTP explicitly uses `shouldCreateUser: false`. Only the existing invite flow passes `true`, after its pending-invite request guard. OTP verification never activates workspace membership.
- Ordinary OTP code verification reuses Supabase `verifyOtp({ email, token, type: "email" })`. Its separate PKCE mail-link callback is `/auth/login`; `/auth/confirm` remains invite-only. Both password and ordinary OTP destinations must stay on the local origin and exclude login/auth callback loops.
- The generic OTP UI accepts 6–8 digits because local Supabase configuration uses 6 while the existing invite UI uses 8. The provider owns actual validity, expiry and attempt limits. The client uses a 60-second resend delay only as a UI throttle. Hosted token length, numeric-code mail template (`{{ .Token }}`) and callback redirect allowlist remain delivery prerequisites; they were not changed or tested with real mail.
- Password recovery retains `/auth/password-recovery` and server GET/POST checks for the verified actor and a recent recovery AMR claim. Ordinary password/OTP sessions cannot reset passwords through this endpoint. Saving requires matching 8–1024-character passwords; success signs out locally and returns to login.
- 아이디 찾기 shows phone format validation and a clearly unavailable verification state. 승욱 confirmed that no phone identity vendor is selected. It sends no SMS and performs no account lookup. User-editable contact phone fields must never be used as identity proof.
- Verification uses loopback synthetic auth fixtures. No real identities, mail/SMS, provider configuration, DB/RLS, signup policy, or production state are changed.

## Responsibility Split

| Area | Supabase Auth owns | CLAiR app DB/server owns |
|---|---|---|
| Password reset | `resetPasswordForEmail`, recovery redirect, authenticated password update via `updateUser` | Request page copy, generic response, allowed redirect URL, post-reset workspace routing |
| Email login/link | Magic link or OTP mechanics, token verification, session creation | Whether the verified email has a valid invitation or active membership |
| Invite delivery | Auth Admin invite/generate-link mechanics only if approved | Workspace invitation rows, invite token metadata, expiration/cancel/accept state, membership activation |
| Existing user conflict | One Supabase identity per verified email/session | Link verified identity to pending invitation; never duplicate app memberships |
| Account status | Auth user existence/session validity | App `users.status`, `user_memberships.status`, suspension/reactivation policy |
| Authorization | Verified user id/session claims | Active workspace membership, role union, permission resolver, RLS/server checks |
| Secrets | Secret key required for `auth.admin` server methods | Secret must never enter browser/client code |

## Password Reset Policy

Password reset is available only for Supabase Auth users.

Required flow:

1. User enters email on a public `forgot password` page.
2. UI returns a generic success message regardless of whether the account exists.
3. Server/client calls Supabase `resetPasswordForEmail(email, { redirectTo })`.
4. The `redirectTo` must be on the Supabase configured redirect URL allow-list.
5. User opens the recovery link and lands on a change-password page with a valid recovery session.
6. The change-password page accepts the new password and calls Supabase `updateUser({ password })`.
7. After password update, the app routes the user to workspace selection or the originally intended safe workspace if active membership exists.

Policy notes:

- The app must not store, hash, compare, or validate passwords itself.
- Do not reveal whether an email exists.
- Production password reset email delivery requires the email/SMPP approval gate. Supabase's default email service is not a production dependency for CLAiR launch.
- In local development, use Supabase local email capture/Mailpit where available.
- If the user has no active workspace membership after reset, route to an access/help state, not a workspace.

## Invite Acceptance And Existing Account Policy

Invitation acceptance must be driven by verified email identity plus a pending app invitation.

| Scenario | Policy |
|---|---|
| New Supabase Auth user accepts valid pending invite | Create or upsert app `users` row, mark invitation `accepted`, create active membership. |
| Existing Supabase Auth user accepts invite for same email | Do not create a duplicate auth user. Link the verified user id to the pending invite and create/activate membership. |
| Existing user already has active membership in same workspace | Do not create a new invite or membership. Show "already a member" and route to workspace if active. |
| Existing user has active membership in another workspace | Allow multi-workspace membership if invitation is valid for the new workspace. |
| Pending invitation exists for same workspace/email | Block duplicate invite creation; use resend. |
| Invitation is expired/canceled/accepted | Deny acceptance with safe error; admin can issue a new invitation if appropriate. |
| Verified email does not match invitation email | Deny. Do not allow cross-email invite claiming. |
| Workspace is not approved/active | Deny. CLAiR tenant approval remains the outer gate. |

The future invite landing page should use `signInWithOtp` or the Supabase invite/recovery flow only as identity proof. It must call the app server to activate membership after identity is verified.

## Inactive, Suspended, Reinvite, And Deletion Policy

| Account or membership state | Policy |
|---|---|
| App user `active`, membership `pending` | User can authenticate but cannot enter workspace until invitation is accepted and membership becomes `active`. |
| App user `active`, membership `inactive` | User cannot enter. Admin may explicitly reactivate or send a reactivation invite; activation must preserve membership history. |
| App user `active`, membership `suspended` | User cannot self-reactivate through invite acceptance. Hospital admin or CLAiR operator must review/reactivate through an audited server route. |
| App user `inactive` | User may authenticate, but app access is denied until account reactivation. Password reset alone does not reactivate app access. |
| Supabase Auth user exists, no app user row | On valid invite acceptance, create app user row linked to auth user id. Without valid invite, no workspace access. |
| Supabase Auth user deleted | Treat as exceptional support/legal flow. Do not depend on deletion for normal offboarding. Prefer app user/membership deactivation for pilot operations. |
| Reinvite after inactive membership | Prefer reactivation of the existing membership id rather than creating duplicates. |
| Reinvite after suspended membership | Require explicit admin/operator unsuspension decision before activation. |

## Security And UX Rules

- Account recovery must not bypass tenant approval, invitation validity, active membership, or permission resolver checks.
- User profile fields are never authorization sources.
- `auth.admin` methods require a secret key and must only run on trusted server code.
- Do not send service-role/secret key to browser code or `NEXT_PUBLIC_` env.
- Invite tokens, recovery links, OTPs, and raw provider errors must not be logged.
- Use stable denial categories such as `unauthenticated`, `invitation_not_pending`, `active_membership_exists`, `workspace_membership_inactive`, and `workspace_membership_missing`.
- Account recovery UI copy should be neutral: "If an account exists, we sent instructions."
- For pilot, recommend MFA for CLAiR operator and hospital admin accounts, but MFA implementation remains out of DEN-154.

## Follow-Up Implementation Issues

Recommended follow-ups:

1. `01-05 Build forgot-password and reset-password UX contract`
   - Add public forgot-password and authenticated change-password pages.
   - Wire to Supabase Auth boundary only after email/redirect approval gates are satisfied.

2. `01-06 Design public invite acceptance account-linking flow`
   - Define invite landing route, token handling, verified-email matching, existing-account sign-in, and safe denial UX.

3. `01-07 Add account recovery and invite conflict regression matrix`
   - Cover existing account invite, inactive/suspended membership, expired/canceled invite, cross-email denial, and active membership duplicate.

4. `02+ Implement audited reactivation route`
   - Add server-only route for reactivating inactive memberships, preserving last-admin and audit constraints.

## Out Of Scope

- Actual password reset UI implementation.
- Email provider or SMTP setup.
- MFA implementation.
- Remote Supabase staging/live changes.
- New DB migrations/RLS changes.
- Real email delivery.
- Production deploy.
- Real hospital, staff, guardian, patient, or billing data.

## Verification

- Checked Supabase changelog and current Supabase Auth docs.
- Checked existing CLAiR invite-only launch architecture and workspace/member route contract.
- Confirmed this policy keeps Supabase Auth identity mechanics separate from app DB membership/permission authority.
- `npm run docs:check`
- `npm run security:secrets`
