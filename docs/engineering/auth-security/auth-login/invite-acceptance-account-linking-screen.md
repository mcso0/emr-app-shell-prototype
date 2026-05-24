# Invite Acceptance Account Linking Screen

Updated: 2026-05-23
Linear: DEN-160, DEN-246, DEN-268
Initiative: `CLAiR EMR SaaS Launch Foundation`
Project: `03 Invite-Based Member Onboarding`

## Purpose

This document records the local-first invite acceptance screen for staff onboarding.

The screen lets an invited staff user open a valid invite link, confirm the invited email, activate the invited workspace membership through the server accept route, and enter the workspace. Invalid invitations do not create local session or membership state.

## Implemented Route

Public page:

```text
GET /invite/[invitationId]?workspaceId=[workspaceId]&email=[email]
```

Acceptance API reused by the page:

```text
POST /api/workspaces/[workspaceId]/invitations/[invitationId]/accept
```

The page is implemented by:

- `src/app/invite/[invitationId]/page.tsx`
- `src/features/auth/invite-acceptance-screen.tsx`
- `src/features/auth/invite-acceptance-model.ts`

## UX State Table

| Invitation state | Screen heading | Account action | Membership effect |
| --- | --- | --- | --- |
| `pending` | `초대 수락` | User continues through invited-email verification. Local/mock mode keeps a deterministic direct accept button for prototype coverage. | Calls server accept route after matching identity, creates local mock session in mock mode, stores active membership, redirects to workspace. |
| `expired` | `초대가 만료되었습니다` | Blocked | No account or membership state is created. |
| `canceled` | `취소된 초대입니다` | Blocked | No account or membership state is created. |
| `accepted` | `이미 수락된 초대입니다` | Blocked | No duplicate membership is created. |
| `missing` | `초대 링크를 확인할 수 없습니다` | Blocked | No account or membership state is created. |

## Email-First Account Handling

DEN-246 replaces the two equal account-choice cards with an email-first acceptance contract. DEN-247 adds the login/signup handoff boundary. DEN-268 adds password setup for invited accounts so accepted members can later return through email/password login:

- Supabase-backed invite flow routes unauthenticated users with `reason=invite_email_otp`, `inviteEmail`, and safe `next` context.
- `/api/auth/invite-otp/request` validates that the request is tied to a pending invitation, the locked email matches the invite email, and `next` is an internal `/invite/...` path before the client requests OTP.
- Supabase mode uses `signInWithOtp` and `verifyOtp`; local/mock mode exposes a deterministic `000000` demo code for browser verification without sending real email.
- Supabase mode updates the verified session password after OTP verification. The password is sent only to Supabase Auth through the browser client and is not stored in CLAiR app state, docs, or logs.
- `/auth/confirm` handles configured Supabase email links with `token_hash`, verifies the token, and redirects only to the safe invite path.
- Returning members use the existing email/password login form. Google, social login, SSO, and MFA remain separate future decisions.
- The invite page does not ask the user to choose `new` vs `existing` before email verification.
- Local/mock mode still creates a mock session for `invitee:[email]`, maps the invitation role to the closest mock role, persists active workspace membership, and redirects to `/w/[workspaceId]/reception`.

Supabase Auth still owns real identity creation, password hashing/storage, email verification, recovery, and future MFA. CLAiR app state owns invitation validity, membership activation, workspace access, duplicate/conflict handling, and audit handoff.

## Safe Redirect

Successful local-first acceptance redirects only to the invited workspace:

```text
/w/[workspaceId]/reception?modulePanel=open&aside=closed
```

The screen does not accept arbitrary `next` URLs from invite links.

## Current Limits

This work does not implement:

- Remote Supabase/staging OTP delivery validation.
- Production Supabase redirect URL or email template rollout.
- Real account existence preflight; the UX must remain generic until Supabase completes auth.
- Email provider templates or delivery.
- Google, social login, or SSO.
- MFA.
- Production invite token verification.
- New DB/RLS migration.
- Remote Supabase or production execution.
- Real hospital staff data.

## Staging Flow Update

For DEN-187 staging email validation, use the current design flow as the UX and scenario-test basis:

- `docs/design/flows/invite-acceptance-account-onboarding-flow.md`

The local-first screen contract above remains useful for mock/demo coverage, but staging Supabase UX now uses a single invited-email verification path before membership activation.

## Source References

- `docs/engineering/auth-security/auth-login/account-recovery-and-invite-account-policy.md`
- `docs/engineering/auth-security/auth-login/hospital-admin-staff-invitation-creation-contract.md`
- `docs/engineering/auth-security/auth-login/workspace-member-server-route-contract.md`
- Supabase Auth users docs: https://supabase.com/docs/guides/auth/users
- Supabase JavaScript OTP docs: https://supabase.com/docs/reference/javascript/auth-signinwithotp
- Supabase redirect URL docs: https://supabase.com/docs/guides/auth/redirect-urls
- Supabase product security docs: https://supabase.com/docs/guides/security/product-security

## Verification

- Red: `npx playwright test tests/invite-acceptance.spec.ts --reporter=line` failed before the invite acceptance page existed.
- Green: `npx playwright test tests/invite-acceptance.spec.ts --reporter=line` (`3 passed`).
- Regression: `npx playwright test tests/invite-acceptance.spec.ts tests/workspace-invitation-lifecycle-server.spec.ts tests/workspace-invitation-server.spec.ts tests/auth.spec.ts --reporter=line` (`41 passed`).
- `npx tsc --noEmit` passed.
- `npm run lint` passed with existing warnings only.
- `npm run docs:check` passed.
- `npm run build` passed.
- `npm run security:secrets` passed.
- `git diff --check` passed.
