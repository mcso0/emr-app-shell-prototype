# Invite Acceptance Account Linking Screen

Updated: 2026-05-24
Linear: DEN-160, DEN-246, DEN-268, DEN-278
Initiative: `CLAiR EMR SaaS Launch Foundation`
Project: `03 Invite-Based Member Onboarding`

## Purpose

This document records the local-first invite acceptance screen for staff onboarding.

The screen lets an invited staff user open a valid invite link, continue account setup from that confirmed invite context, activate the invited workspace membership through the server accept route, and enter the workspace. Invalid invitations do not create local session or membership state.

## Implemented Route

Public page:

```text
GET /invite/[invitationId]?workspaceId=[workspaceId]&email=[email]
```

Acceptance API reused by the page:

```text
POST /api/workspaces/[workspaceId]/invitations/[invitationId]/accept
```

Blocked-invite recovery API used by expired/canceled invite states:

```text
POST /api/workspaces/[workspaceId]/invitations/[invitationId]/reinvite-request
```

The page is implemented by:

- `src/app/invite/[invitationId]/page.tsx`
- `src/features/auth/invite-acceptance-screen.tsx`
- `src/features/auth/invite-acceptance-model.ts`

## UX State Table

| Invitation state                    | Screen heading                   | Account action                                                                                                                           | Membership effect                                                                                                                             |
| ----------------------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `pending` + `accountState=new`      | `비밀번호 설정`                  | User sets a password for the invited email. The submit CTA is `워크스페이스로 이동` and stays disabled until password validation passes. | Calls server accept route after matching identity, creates local mock session in mock mode, stores active membership, redirects to workspace. |
| `pending` + `accountState=existing` | `초대받은 계정으로 로그인`       | User logs in with the invited email. The submit CTA is `로그인` and stays disabled until a password is entered.                          | Calls server accept route after matching identity, stores active membership in mock mode, redirects to workspace.                             |
| `expired`                           | `초대가 만료되었습니다`          | Blocked, with `관리자에게 재요청` recovery action.                                                                                       | No account or membership state is created. The re-request route validates invite state and email before returning dialog feedback.            |
| `canceled`                          | `취소된 초대입니다`              | Blocked, with `관리자에게 재요청` recovery action.                                                                                       | No account or membership state is created. The re-request route validates invite state and email before returning dialog feedback.            |
| `accepted`                          | `이미 수락된 초대입니다`         | Offers `워크스페이스로 이동` for the accepted workspace.                                                                                 | No duplicate membership is created.                                                                                                           |
| `missing`                           | `초대 링크를 확인할 수 없습니다` | Blocked                                                                                                                                  | No account or membership state is created.                                                                                                    |

## Invite-Link Password Handling

DEN-246 replaced the two equal account-choice cards with an email-first acceptance contract. DEN-247 added the login/signup handoff boundary. DEN-268 added password setup for invited accounts after OTP verification. DEN-278 updates the invite page so the invite email link itself establishes the invite context before the app asks for account credentials:

- Pending new-account invites render password setup directly on the invite page.
- Pending existing-account invites render invited-email password login directly on the invite page.
- Password setup validates required input, minimum length, and confirmation match before enabling the workspace CTA.
- Existing-account login validates that a password is present before enabling the login CTA.
- Supabase mode uses `signUpWithPassword` or `signInWithPassword` and then calls the server accept route only for the invited email context.
- The legacy Supabase OTP handoff can still route unauthenticated users with `reason=invite_email_otp`, `inviteEmail`, and safe `next` context for compatibility coverage.
- `/api/auth/invite-otp/request` validates that the request is tied to a pending invitation, the locked email matches the invite email, and `next` is an internal `/invite/...` path before the client requests OTP.
- `/auth/confirm` handles configured Supabase email links with `token_hash`, verifies the token, and redirects only to the safe invite path.
- The invite accept DB transaction upserts the verified invited identity into `public.users` before activating the workspace membership, so a newly created Supabase Auth user can complete the same invite flow as an existing app user.
- Local/mock mode still creates a mock session for `invitee:[email]`, maps the invitation role to the closest mock role, persists active workspace membership, and redirects to `/w/[workspaceId]/reception`.
- The legacy invite OTP login handoff remains covered for compatibility, but the invite acceptance screen no longer asks a user who opened the invite email link to request another OTP.
- Returning members use the existing email/password login form. Google, social login, SSO, and MFA remain separate future decisions.
- The invite page does not ask the user to choose `new` vs `existing` before email verification.

Supabase Auth still owns real identity creation, password hashing/storage, email verification, recovery, and future MFA. CLAiR app state owns invitation validity, membership activation, workspace access, duplicate/conflict handling, and audit handoff.

## Validation

- Client password setup: required password, minimum 8 characters, matching confirmation, disabled submit until valid.
- Client existing login: required password and disabled submit until present.
- Server re-request: validates that the target invitation exists, the submitted email matches the invited email, and the invitation is expired or canceled before queuing recovery feedback.
- Pending, accepted, missing, and email-mismatched re-request attempts return denial responses instead of pretending recovery was queued.

## Safe Redirect

Successful local-first acceptance redirects only to the invited workspace:

```text
/w/[workspaceId]/reception?modulePanel=open&aside=closed
```

The screen does not accept arbitrary `next` URLs from invite links.

## Current Limits

This work does not implement:

- Production Supabase redirect URL or email template rollout.
- Real account existence preflight outside the invitation lookup contract.
- Email provider templates or delivery.
- Real administrator notification persistence or inbox delivery for re-request.
- Google, social login, or SSO.
- MFA.
- Production invite token verification.
- New RLS policy migration.
- Remote Supabase or production execution.
- Real hospital staff data.

## Staging Flow Update

For DEN-278 invite-link password onboarding, use the current design flow as the UX and scenario-test basis:

- `docs/design/flows/invite-link-password-onboarding-ui-prototype.html`

The local-first screen contract above remains useful for mock/demo coverage. Staging Supabase should keep using the invite link as the email-confirmed context before password setup or existing-account login.

## Source References

- `docs/engineering/auth-security/auth-login/account-recovery-and-invite-account-policy.md`
- `docs/engineering/auth-security/auth-login/hospital-admin-staff-invitation-creation-contract.md`
- `docs/engineering/auth-security/auth-login/workspace-member-server-route-contract.md`
- Supabase Auth users docs: https://supabase.com/docs/guides/auth/users
- Supabase JavaScript sign up docs: https://supabase.com/docs/reference/javascript/auth-signup
- Supabase JavaScript sign in with password docs: https://supabase.com/docs/reference/javascript/auth-signinwithpassword
- Supabase redirect URL docs: https://supabase.com/docs/guides/auth/redirect-urls
- Supabase product security docs: https://supabase.com/docs/guides/security/product-security

## Verification

DEN-278 implementation verification is recorded in:

- `docs/work/auth/AUTH-PR-043-invite-link-password-onboarding-implementation.md`

DEN-265/DEN-258 follow-up verification is recorded in:

- `docs/work/design-system/DESIGN-SYSTEM-PR-022-chart-order-table-shared-primitives.md`
- `docs/completed/auth/2026-05-24-invite-acceptance-app-user-upsert-report.html`
- `docs/completed/saas-launch/2026-05-24-den-258-invite-otp-staging-e2e-closeout-report.html`
- 2026-05-24 follow-up: `npx playwright test tests/workspace-invitation-lifecycle-server.spec.ts -g "links OTP-authenticated" --reporter=line` passed after adding the local-first app-user upsert migration contract.
