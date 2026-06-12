# Password Reset Account Recovery Policy Spec

Status: draft  
Updated: 2026-06-12

This document defines the product policy for password reset, account recovery, and account-access failures. It should be read with [Login Invite Onboarding Spec](login-invite-onboarding-spec.md), [Session Logout Policy Spec](session-logout-policy-spec.md), and [Invite Email Delivery Recovery Policy Spec](invite-email-delivery-recovery-policy-spec.md).

## Product Goal

CLAiR EMR should let legitimate users recover account access without letting account recovery become a workspace access bypass. Account recovery restores account sign-in; workspace access still depends on active membership and roles.

## Scope

In scope:

- Forgot-password flow policy.
- Password reset link lifecycle.
- Existing-account invite recovery.
- Account access lost cases.
- Workspace membership checks after recovery.
- Recovery copy and error-state expectations.

Out of scope:

- Email provider implementation.
- MFA, SSO, SCIM, passkeys, and social login.
- Email identity change implementation.
- Account deletion.
- DB schema, RLS, migration, and server/API implementation.
- Production launch or public access.

## Baseline Policy

- Returning users sign in with email and password.
- Password reset should be available for an existing account.
- Password reset does not create workspace membership.
- Password reset does not reactivate inactive membership.
- Password reset should not reveal whether an email exists.
- Invite acceptance for an existing account should require sign-in with the invited email.

## Password Reset Flow

1. User chooses forgot password from login.
2. User enters email.
3. System shows a neutral "check your email if an account exists" response.
4. User opens reset link within the valid window.
5. User sets a new password.
6. User signs in and workspace membership is checked.

Acceptance criteria:

- Reset response does not expose account existence.
- Expired or invalid reset links show recovery guidance.
- Reset cannot change workspace roles or membership status.
- After reset, inactive members remain blocked from workspace access.

## Account Recovery Cases

| Case | Product behavior |
| --- | --- |
| Forgot password | Use password reset. |
| Existing account receives invite | Sign in with invited email, then accept invite. |
| User cannot access invited email | Ask hospital admin or CLAiR support for corrected invite; do not transfer link casually. |
| Account exists but membership inactive | Show admin/support recovery state. |
| User tries different email | Block invite acceptance and ask for invited email. |

## Security Expectations

- Reset links should be single-use or invalidated after success.
- Reset links should expire.
- Password reset should not bypass recent-auth requirements for high-impact actions.
- Sensitive changes after reset may require fresh authentication.
- Account recovery attempts should be rate-limited in implementation.

## CLAiR Docs Viewer Placement

This spec should appear in CLAiR Docs under `Features`.

## Open Questions

- What should the MVP password reset link expiry be?
- Should password reset immediately sign the user in, or require explicit login after reset?
- Should a password reset force logout from other sessions?
- Should staff without email access be handled only through hospital admin reinvite, or can CLAiR support correct it?
