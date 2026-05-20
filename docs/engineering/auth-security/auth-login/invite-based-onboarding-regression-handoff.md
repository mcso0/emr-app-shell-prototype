# Invite-Based Onboarding Regression And Handoff

Updated: 2026-05-20
Linear: DEN-162
Initiative: `CLAiR EMR SaaS Launch Foundation`
Project: `03 Invite-Based Member Onboarding`

## Purpose

This document closes Project 03 by recording the invite-based onboarding vertical slice, regression evidence, remaining launch blockers, and Project 04 tenant boundary inputs.

The slice is local-first and synthetic. It does not send production email, onboard real customers, enforce seat billing, or execute remote Supabase.

## Happy Path Regression

Covered path:

1. Hospital admin creates a pending workspace invitation.
2. The invite acceptance page opens a pending invite.
3. The invited staff user selects new-account or existing-account linking.
4. The page calls the server accept route.
5. A local mock session for `invitee:[email]` is stored.
6. An active workspace membership is stored.
7. The user is redirected only to the invited workspace route.

Primary evidence:

- `tests/workspace-invitation-server.spec.ts`
- `tests/invite-acceptance.spec.ts`
- `tests/invite-onboarding-regression-handoff.spec.ts`

## Invalid Invite Regression

Blocked states:

| Scenario | Expected result |
| --- | --- |
| Expired invite | `invitation_expired`; no membership activation. |
| Canceled invite | `invitation_not_pending`; no membership activation. |
| Already accepted invite | `invitation_not_pending`; no duplicate membership. |
| Unknown invite | `target_invitation_missing`; no membership activation. |
| Missing/invalid account action | No public self-signup fallback. |

Primary evidence:

- `tests/invite-acceptance.spec.ts`
- `tests/workspace-invitation-lifecycle-server.spec.ts`

## Unauthorized Inviter Regression

Staff invitation creation and lifecycle admin actions remain hospital-admin controlled:

- Invitation creation requires active workspace membership with `role_permission:manage`.
- `resend` and `cancel` require active workspace membership with `role_permission:manage`.
- Non-admin actor attempts are denied with stable safe denial categories.
- Existing active member email and duplicate pending invitation email are blocked.

Primary evidence:

- `tests/workspace-invitation-server.spec.ts`
- `tests/workspace-invitation-lifecycle-server.spec.ts`
- `tests/auth.spec.ts`

## Workspace Isolation Smoke

Accepted invite users can enter the invited workspace but cannot enter another workspace by changing the URL.

Primary evidence:

- `tests/invite-onboarding-regression-handoff.spec.ts`
- `tests/auth.spec.ts`

## Passed Scenarios

The current regression pack covers:

- pending invitation creation by hospital admin
- duplicate pending invitation denial
- active member email denial
- unauthorized inviter denial
- pending invite acceptance
- expired/canceled/already accepted/unknown invite denial
- resend timestamp/count behavior
- cancel state transition
- safe audit hook envelope for resend/cancel/accept
- accepted user invited-workspace entry
- accepted user cross-workspace denial smoke

## Remaining Launch Blockers

These are still blockers before a real pilot/live rollout:

- production email delivery approval and provider setup
- production invite token/link generation and storage policy
- Supabase Auth signup/password/existing-account linking implementation
- remote Supabase staging/live validation
- DB/RLS replay for tenant boundary and invitation acceptance in target environment
- production disablement proof for demo actor headers outside mock mode
- real customer onboarding/legal/compliance review
- payment/subscription and seat billing decision

## Project 04 Handoff

Project 04 should focus on tenant boundary and workspace data isolation.

Inputs to Project 04:

1. Workspace id is the tenant boundary for staff onboarding and app access.
2. Public invite acceptance must activate membership only for the invited workspace.
3. Accepted users must not access other workspaces by URL mutation.
4. Server routes must keep using server session identity plus active workspace membership checks.
5. Mock-mode demo actor headers must remain impossible outside mock mode before any remote/live pilot.
6. Supabase/RLS replay should include invitation accept, membership activation, workspace list, and protected workspace route access.
7. Audit event coverage should preserve safe summaries for invitation lifecycle events.

Minimum Project 04 regression inputs:

- accepted invite user can access invited workspace
- accepted invite user cannot access another workspace
- non-member cannot access any workspace route
- inactive/suspended membership cannot access workspace route
- hospital admin in workspace A cannot manage workspace B invitations
- audit review remains workspace-scoped

## Sources

- `docs/engineering/auth-security/auth-login/hospital-admin-staff-invitation-creation-contract.md`
- `docs/engineering/auth-security/auth-login/invite-acceptance-account-linking-screen.md`
- `docs/engineering/auth-security/auth-login/invitation-resend-cancel-expiration-lifecycle.md`
- `docs/engineering/auth-security/auth-login/live-auth-db-rls-workspace-threat-model.md`

## Verification

- Red: `npx playwright test tests/invite-onboarding-regression-handoff.spec.ts --reporter=line` failed before this handoff existed and before the isolation test was corrected.
- Green: `npx playwright test tests/invite-onboarding-regression-handoff.spec.ts --reporter=line` (`2 passed`).
- Regression: `npx playwright test tests/invite-onboarding-regression-handoff.spec.ts tests/invite-acceptance.spec.ts tests/workspace-invitation-lifecycle-server.spec.ts tests/workspace-invitation-server.spec.ts tests/auth.spec.ts --reporter=line` (`44 passed`).
- `npx tsc --noEmit` passed.
- `npm run lint` passed with existing warnings only.
- `npm run docs:check` passed.
- `npm run build` passed.
- `npm run security:secrets` passed.
- `git diff --check` passed.
