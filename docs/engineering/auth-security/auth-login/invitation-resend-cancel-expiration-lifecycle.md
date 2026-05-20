# Invitation Resend Cancel And Expiration Lifecycle

Updated: 2026-05-20
Linear: DEN-161
Initiative: `CLAiR EMR SaaS Launch Foundation`
Project: `03 Invite-Based Member Onboarding`

## Purpose

This document records the invite lifecycle completion for Project 03.

Hospital admins can manage pending invitations through resend and cancel actions, while expired, canceled, accepted, and unknown invitations cannot create active memberships.

## Implemented Routes

```text
POST /api/workspaces/[workspaceId]/invitations/[invitationId]/resend
POST /api/workspaces/[workspaceId]/invitations/[invitationId]/cancel
POST /api/workspaces/[workspaceId]/invitations/[invitationId]/accept
```

The lifecycle contract is implemented in:

- `src/features/auth/server-workspace-invitation-lifecycle.ts`
- `src/app/api/workspaces/[workspaceId]/invitations/[invitationId]/resend/route.ts`
- `src/app/api/workspaces/[workspaceId]/invitations/[invitationId]/cancel/route.ts`
- `src/app/api/workspaces/[workspaceId]/invitations/[invitationId]/accept/route.ts`

## State Machine

| Current state | Action | Result | Notes |
| --- | --- | --- | --- |
| `pending` | `resend` | `pending` | Updates `resentAt`, increments `resendCount`, keeps real email delivery gated. |
| `pending` | `cancel` | `canceled` | Requires `role_permission:manage`. |
| `pending` | `accept` | `accepted` + active membership | Requires authenticated invited actor. |
| `expired` | `accept` | blocked | Returns `invitation_expired`; no membership. |
| `canceled` | `accept` | blocked | Returns `invitation_not_pending`; no membership. |
| `accepted` | `accept` | blocked | Returns `invitation_not_pending`; no duplicate membership. |
| `missing` | `accept` | blocked | Returns `target_invitation_missing`; no membership. |

## Permission Rules

- `resend` and `cancel` require active workspace membership with `role_permission:manage`.
- `accept` does not require hospital admin permission, but still requires authenticated actor identity.
- Mock mode accepts deterministic demo actor headers only through the existing mock-session identity seam.
- Supabase mode continues to use the existing RPC boundary.

## Audit Hook Contract

Successful lifecycle actions now return safe audit hook envelopes:

| Action | Audit type |
| --- | --- |
| `resend` | `workspace.invitation_resent` |
| `cancel` | `workspace.invitation_canceled` |
| `accept` | `workspace.invitation_accepted` |

Audit payloads include workspace id, invitation id, actor user id, timestamp, status, and safe transition metadata. They must not include raw invite tokens, OTPs, magic links, email provider payloads, service-role keys, authorization headers, cookies, raw SQL, or stack traces.

## Current Limits

This work does not implement:

- Real email provider delivery.
- Seat billing.
- Full notification center.
- New DB/RLS migration.
- Remote Supabase or production execution.
- Real staff/customer data.

## Source References

- `docs/engineering/auth-security/auth-login/workspace-invitation-lifecycle-live-persistence.md`
- `docs/engineering/auth-security/auth-login/invite-acceptance-account-linking-screen.md`
- `docs/engineering/auth-security/auth-login/hospital-admin-staff-invitation-creation-contract.md`
- `docs/engineering/auth-security/auth-login/live-mvp-audit-event-matrix.md`
- Supabase changelog: https://supabase.com/changelog
- Supabase Auth users docs: https://supabase.com/docs/guides/auth/users
- Supabase product security docs: https://supabase.com/docs/guides/security/product-security

## Verification

- Red: `npx playwright test tests/workspace-invitation-lifecycle-server.spec.ts --reporter=line` failed before audit events and expired/closed invite denial existed.
- Green: `npx playwright test tests/workspace-invitation-lifecycle-server.spec.ts --reporter=line` (`4 passed`).
- Regression: `npx playwright test tests/workspace-invitation-lifecycle-server.spec.ts tests/invite-acceptance.spec.ts tests/workspace-invitation-server.spec.ts tests/auth.spec.ts --reporter=line` (`42 passed`).
- `npx tsc --noEmit` passed.
- `npm run lint` passed with existing warnings only.
- `npm run docs:check` passed.
- `npm run build` passed.
- `npm run security:secrets` passed.
- `git diff --check` passed.
