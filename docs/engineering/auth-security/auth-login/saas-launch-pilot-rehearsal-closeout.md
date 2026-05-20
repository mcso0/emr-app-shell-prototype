# SaaS Launch Pilot Rehearsal Closeout

Updated: 2026-05-20
Linear: DEN-170
Initiative: CLAiR EMR SaaS Launch Foundation

This closeout records the local-first pilot rehearsal for the SaaS launch foundation.
It does not approve remote Supabase, real email, production deploy, or real data use.

## Pilot Readiness Decision

| Decision | Meaning |
| --- | --- |
| Representative review | READY |
| Local/mock SaaS launch foundation rehearsal | READY |
| Real staging pilot with remote Supabase/email/deploy | BLOCKED until explicit approval gates are satisfied |
| Production/live pilot | BLOCKED |

Plain-language conclusion:

The basic SaaS skeleton is now coherent enough for 승욱 to review: CLAiR operator approval, first-admin invite concept, hospital admin staff invite, invite acceptance, role/permission safety, tenant isolation, audit coverage, rate limiting, and staging readiness checklist are represented in code/tests/docs.

It is not yet a real staging/live launch. Remote Supabase, real email delivery, production deploy, real data, shared production rate-limit storage, and final operational approval remain gated.

## Rehearsal Scenario

| Step | Scenario | Evidence |
| --- | --- | --- |
| 1 | CLAiR operator creates workspace and first admin invite for an approved tenant | `tests/ops-tenant-workspace-action.spec.ts` |
| 2 | Hospital admin creates staff invitation with duplicate/active-member safety | `tests/workspace-invitation-server.spec.ts` |
| 3 | Invite lifecycle supports resend/cancel/accept and closed-state denial | `tests/workspace-invitation-lifecycle-server.spec.ts` |
| 4 | Invite acceptance creates local account membership and blocks invalid links | `tests/invite-acceptance.spec.ts` |
| 5 | Tenant isolation denies cross-workspace invite/member/clinical handoff access | `tests/cross-tenant-denial-regression.spec.ts` |
| 6 | Last active hospital admin cannot be demoted/deactivated | `tests/last-admin-role-change-launch-safety.spec.ts` |
| 7 | Audit coverage tracks tenant, invitation, membership, and review surfaces | `tests/launch-audit-coverage-matrix.spec.ts` |
| 8 | Abuse-prone routes return safe 429/Retry-After and safe duplicate conflicts | `tests/launch-rate-limit-abuse-handling.spec.ts` |
| 9 | Staging env/secret/email/deploy/rollback readiness is checklist-driven | `tests/launch-staging-readiness-checklist.spec.ts` |
| 10 | Base auth/workspace UI regression remains stable | `tests/auth.spec.ts` |

## Happy Path Result

The local-first happy path passes as a representative rehearsal:

1. CLAiR operator-approved tenant action returns workspace and first admin invitation.
2. Hospital admin can create a pending staff invitation.
3. Pending invite can be accepted into an active workspace membership.
4. Accepted user can enter the invited workspace.
5. Admin can manage roles without losing last-admin protection.
6. Audit hooks and review surface cover the launch-critical mutations.

## Failure Path Result

The failure path also passes:

- Unauthenticated mutation attempts return typed 401.
- Non-operator tenant action returns typed 403.
- Unapproved or duplicate tenant workspace action returns typed 409.
- Duplicate pending invite and active member email return typed 409.
- Expired/canceled/accepted/unknown invite states do not create membership.
- Cross-tenant workspace access returns `workspace_membership_missing`.
- Last active `hospital_admin` removal returns `last_admin_protected`.
- Repeated abuse-prone requests return safe `429` and `Retry-After`.
- Staging/live gated actions remain blocked without explicit approval.

## Launch Blockers Before Real Staging Or Live

| Blocker | Why it matters |
| --- | --- |
| Remote Supabase staging approval and replay | Local/static tests do not prove remote project settings, grants, RLS, or RPC behavior. |
| Real email provider approval | Invite/password/account emails are still approval-gated and not sent. |
| Production/shared rate-limit store | Current limiter is process-local and not enough for multi-instance deployment. |
| Demo actor header production disablement proof | Live/staging must prove demo headers cannot authenticate privileged actors. |
| Route-wide request id/safe logging and production log redaction | Needed before external logs/monitoring or production deploy. |
| Supabase advisor/security-definer RPC review | Needed before remote DB/RLS confidence. |
| Real data/legal/compliance decision | No real clinic, staff, guardian, patient, medical, billing, or payment data is approved. |
| Deploy rollback/forward-fix approval | Staging/live deploy requires target platform, commit, env list, smoke path, and rollback owner. |

## Non-Blockers For Foundation Review

- Payment/subscription provider integration.
- Enterprise SSO/SCIM/domain auto-join.
- Long-term SIEM/retention policy.
- Full production observability vendor setup.
- Public request-access form.
- Real customer data import.

These are not required to review the launch foundation, but some become required before a real customer-facing pilot depending on launch scope.

## Approval Or Rework Recommendation

Recommendation:

- Move DEN-170 to Human Review.
- Treat the initiative as local-first foundation ready for representative review.
- Do not mark the initiative Done until 승욱 reviews the closeout and decides the next gated staging action.
- Recommended next approval request: choose whether to prepare a remote Supabase staging replay issue with explicit target project, allowed operation, verification, and stop conditions.

No code rework is required from the local-first rehearsal evidence.
Real staging/live work remains blocked by approval gates, not by this foundation rehearsal.

## Verification

Selected regression:

```bash
npx playwright test tests/ops-tenant-workspace-action.spec.ts tests/invite-acceptance.spec.ts tests/workspace-invitation-server.spec.ts tests/workspace-invitation-lifecycle-server.spec.ts tests/cross-tenant-denial-regression.spec.ts tests/last-admin-role-change-launch-safety.spec.ts tests/launch-audit-coverage-matrix.spec.ts tests/launch-rate-limit-abuse-handling.spec.ts tests/launch-staging-readiness-checklist.spec.ts tests/auth.spec.ts --reporter=line
```

Result: `63 passed`.

Final gates:

```bash
npx tsc --noEmit
npm run lint
npm run docs:check
npm run build
npm run security:secrets
git diff --check
```

Results:

- `npx tsc --noEmit` passed.
- `npm run lint` passed with 5 pre-existing warnings.
- `npm run docs:check` passed, checking 778 docs/agent markdown files.
- `npm run build` passed.
- `npm run security:secrets` passed, checking 1547 tracked files.
- `git diff --check` passed.
