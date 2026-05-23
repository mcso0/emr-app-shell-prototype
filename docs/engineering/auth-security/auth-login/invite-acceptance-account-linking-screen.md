# Invite Acceptance Account Linking Screen

Updated: 2026-05-20
Linear: DEN-160
Initiative: `CLAiR EMR SaaS Launch Foundation`
Project: `03 Invite-Based Member Onboarding`

## Purpose

This document records the local-first invite acceptance screen for staff onboarding.

The screen lets an invited staff user open a valid invite link, choose new-account or existing-account linking, activate the invited workspace membership through the server accept route, and enter the workspace. Invalid invitations do not create local session or membership state.

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
| `pending` | `초대 수락` | User selects `신규 계정으로 시작` or `기존 계정에 연결` | Calls server accept route, creates local mock session, stores active membership, redirects to workspace. |
| `expired` | `초대가 만료되었습니다` | Blocked | No account or membership state is created. |
| `canceled` | `취소된 초대입니다` | Blocked | No account or membership state is created. |
| `accepted` | `이미 수락된 초대입니다` | Blocked | No duplicate membership is created. |
| `missing` | `초대 링크를 확인할 수 없습니다` | Blocked | No account or membership state is created. |

## New And Existing Account Handling

For DEN-160, both account options are local-first contracts:

- `신규 계정으로 시작`: creates a mock session for `invitee:[email]`, maps the invitation role to the closest mock role, persists active workspace membership, and redirects to `/w/[workspaceId]/reception`.
- `기존 계정에 연결`: uses the same verified-email account-linking contract, but records the selected mode so the future Supabase implementation can preserve the UX path.

Supabase Auth still owns real identity creation, password setup, email verification, recovery, and future MFA. CLAiR app state owns invitation validity, membership activation, workspace access, duplicate/conflict handling, and audit handoff.

## Safe Redirect

Successful local-first acceptance redirects only to the invited workspace:

```text
/w/[workspaceId]/reception?modulePanel=open&aside=closed
```

The screen does not accept arbitrary `next` URLs from invite links.

## Current Limits

This work does not implement:

- Real Supabase signup or password creation.
- Real existing Supabase account linking.
- Email provider templates or delivery.
- MFA.
- Production invite token verification.
- New DB/RLS migration.
- Remote Supabase or production execution.
- Real hospital staff data.

## Staging Flow Update

For DEN-187 staging email validation, use the current design flow as the UX and scenario-test basis:

- `docs/design/flows/invite-acceptance-account-onboarding-flow.md`

The local-first screen contract above remains useful for mock/demo coverage, but staging Supabase UX should separate `신규 계정으로 시작` and `기존 계정에 연결` into explicit account creation/login paths before membership activation.

## Source References

- `docs/engineering/auth-security/auth-login/account-recovery-and-invite-account-policy.md`
- `docs/engineering/auth-security/auth-login/hospital-admin-staff-invitation-creation-contract.md`
- `docs/engineering/auth-security/auth-login/workspace-member-server-route-contract.md`
- Supabase Auth users docs: https://supabase.com/docs/guides/auth/users
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
