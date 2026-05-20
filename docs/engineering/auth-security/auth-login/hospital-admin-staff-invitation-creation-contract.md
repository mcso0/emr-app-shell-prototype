# Hospital Admin Staff Invitation Creation Contract

Updated: 2026-05-20
Linear: DEN-159
Initiative: `CLAiR EMR SaaS Launch Foundation`
Project: `03 Invite-Based Member Onboarding`

## Purpose

This document records the staff invitation creation contract for invite-only hospital onboarding.

Hospital staff must not self-sign up into a workspace. A staff user can enter the product only after a hospital admin creates a pending workspace invitation and the later invite acceptance flow activates membership.

## Implemented Route

Route:

```text
POST /api/workspaces/[workspaceId]/invitations
```

Body:

```json
{
  "email": "staff@hospital.example",
  "roles": ["vet"],
  "title": "진료팀장",
  "department": "진료팀"
}
```

Success response:

```json
{
  "ok": true,
  "status": 201,
  "workspaceId": "workspace-a",
  "invitation": {},
  "emailDelivery": "not_sent_approval_gated",
  "inviteLink": "not_generated_approval_gated",
  "enforcedBy": "workspace-invitation-server-route"
}
```

The response intentionally does not include raw invite tokens, OTPs, magic links, or provider payloads.

## Server Enforcement

The server route now enforces the minimum Project 03 creation contract:

1. Resolve actor identity through `readServerSession()`.
2. Allow deterministic demo actor headers only in mock mode.
3. Rate-limit the mutation by actor/workspace/operation.
4. Validate email shape and canonical role values.
5. Require an active workspace membership with `role_permission:manage`.
6. Create a pending workspace invitation through the gateway.
7. Return stable denial categories for duplicate pending invitation or active member email.
8. Keep real email delivery and public invite link generation approval-gated.

## Denial Scenarios

| Scenario | HTTP | Denial |
| --- | ---: | --- |
| Missing actor | `401` | `unauthenticated` |
| Actor has no workspace membership | `403` | `workspace_membership_missing` |
| Actor membership is inactive/suspended/pending | `403` | `workspace_membership_inactive` |
| Actor lacks `role_permission:manage` | `403` | `permission_missing` |
| Invalid email or empty/invalid role list | `400` | `invalid_input` |
| Pending invitation already exists for workspace/email | `409` | `duplicate_pending_invitation` |
| Active membership already exists for workspace/email | `409` | `active_membership_exists` |
| DB write fails in Supabase-backed mode | `500` | `db_write_failed` |

## Email And Link Gate

Real email delivery remains blocked for launch foundation work.

Before generating or sending real invite links, CLAiR needs:

- Explicit approval for outbound email delivery.
- Approved provider and environment.
- Sender domain/DNS authentication.
- Template copy and token handling review.
- Test-recipient list.
- Rate-limit, bounce, and failure handling.
- Logging rules that never expose raw tokens, OTPs, recovery links, auth headers, or service-role keys.

## Supabase Boundary

Current Supabase guidance keeps the split clear:

- Supabase Auth owns identity, sessions, verified email, password reset, and future MFA.
- CLAiR app server owns workspace invitation state, membership activation, roles, permission checks, duplicate handling, and audit handoff.
- `user_metadata` is not an authorization source.
- Secret/service-role keys stay server-only and must never be exposed through `NEXT_PUBLIC_` variables or browser code.
- Remote Supabase, migrations/RLS changes, production deploy, and real email delivery remain approval-gated.

## Current Limits

This work does not implement:

- Public invitation acceptance/account-linking screen.
- Real email provider delivery.
- Raw invite link or token generation.
- Billing seat count.
- New DB/RLS migration.
- Remote Supabase or production execution.
- Real hospital staff data.

## Source References

- `docs/engineering/auth-security/auth-login/account-recovery-and-invite-account-policy.md`
- `docs/engineering/auth-security/auth-login/approved-tenant-workspace-first-admin-invite-action.md`
- `docs/engineering/auth-security/auth-login/tenant-status-management-ops-audit-handoff.md`
- Supabase changelog: https://supabase.com/changelog
- Supabase Auth users docs: https://supabase.com/docs/guides/auth/users
- Supabase product security docs: https://supabase.com/docs/guides/security/product-security

## Verification

- Red: `npx playwright test tests/workspace-invitation-server.spec.ts --reporter=line` failed because email/link gates and duplicate mock server checks were missing.
- Green: `npx playwright test tests/workspace-invitation-server.spec.ts --reporter=line` (`4 passed`).
- Focused regression: `npx playwright test tests/workspace-invitation-server.spec.ts tests/auth.spec.ts -g "workspace invitation|route-backed member invitations|pending invitations can be canceled|non-admin roles cannot manage workspace invitations|hospital admin can manage route-backed member invitations" --reporter=line` (`8 passed`).
- Regression: `npx playwright test tests/workspace-invitation-server.spec.ts tests/workspace-invitation-lifecycle-server.spec.ts tests/auth.spec.ts --reporter=line` (`38 passed`).
- `npx tsc --noEmit` passed.
- `npm run lint` passed with existing warnings only.
- `npm run docs:check` passed.
- `npm run build` passed.
- `npm run security:secrets` passed.
- `git diff --check` passed.
