# Tenant Status Management And Ops Audit Handoff

Updated: 2026-05-20
Linear: DEN-158
Initiative: `CLAiR EMR SaaS Launch Foundation`
Project: `02 CLAiR Ops Admin Tenant Approval`

## Purpose

This document closes Project 02 by defining tenant operational status policy, audit coverage, and the handoff conditions for Project 03 invite-based member onboarding.

DEN-158 does not build a production support console. It adds the minimum local-first policy and visible handoff criteria needed before the staff invitation flow starts.

## Tenant Operational Status Policy

Implemented in `src/features/ops/tenant-status-policy.ts`.

| Status | Meaning | Workspace entry | First admin invite | Staff invites | Billing enforcement |
| --- | --- | --- | --- | --- | --- |
| `trial` | Approved pilot/trial tenant. | Allowed | Allowed | Allowed | Not enforced |
| `active` | Approved active tenant. | Allowed | Allowed | Allowed | Not enforced |
| `suspended` | Tenant is paused by CLAiR operations. | Blocked | Blocked | Blocked | Not enforced |
| `archived` | Tenant is closed/retired. | Blocked | Blocked | Blocked | Not enforced |

Billing/subscription enforcement remains out of Project 02. `trial` and `active` both allow onboarding for launch foundation purposes.

## Transition Rules

| From | Allowed next statuses |
| --- | --- |
| `trial` | `active`, `suspended`, `archived` |
| `active` | `suspended`, `archived` |
| `suspended` | `active`, `archived` |
| `archived` | none |

Invalid transition result:

```text
invalid_tenant_status_transition
```

Same-status mutation result:

```text
tenant_status_unchanged
```

## Audit Coverage

Project 02 audit hook coverage:

| Event | Source issue | Purpose |
| --- | --- | --- |
| `ops.tenant_application_approved` | DEN-156 | Tenant approval state machine |
| `ops.tenant_application_rejected` | DEN-156 | Rejection state machine |
| `ops.tenant_application_held` | DEN-156 | Hold/review state machine |
| `ops.workspace_created_for_tenant` | DEN-157 | Approved tenant workspace creation |
| `ops.first_admin_invitation_created` | DEN-157 | First `hospital_admin` invite creation |
| `ops.tenant_status_changed` | DEN-158 | Tenant operational status transition |

Audit payloads must not include raw invite tokens, password reset links, cookies, authorization headers, service-role keys, raw SQL, stack traces, or provider payloads.

## UI/Action Scope Decision

The `/ops/tenant-approvals` page now shows the tenant status policy and Project 03 invite handoff criteria.

Status mutation remains a follow-up server persistence action. Reasons:

- Project 02 does not create tenant status DB tables or RLS policies.
- Remote Supabase and live DB/RLS execution remain approval-gated.
- A real status mutation needs the same server operator guard as DEN-157 plus persistence and audit append.
- Production support console scope is explicitly excluded.

Future status mutation route shape:

```text
PATCH /api/ops/tenants/[tenantId]/status
```

Required authority:

```text
tenant_approval:manage
```

Required audit event:

```text
ops.tenant_status_changed
```

## Project 03 Invite Handoff

Project 03 can start from the following assumptions:

1. Public self-signup still cannot create a workspace or membership.
2. CLAiR operator access is a separate server-owned authority source.
3. Tenant applications must be approved before workspace creation.
4. Workspace creation and first `hospital_admin` invitation are server-route-owned.
5. Real email delivery is still approval-gated.
6. Staff invite creation should require:
   - tenant application approved,
   - tenant operational status `trial` or `active`,
   - workspace exists,
   - first `hospital_admin` invitation exists and the hospital admin account/membership path is valid,
   - actor is an active hospital admin for the workspace,
   - no duplicate active membership or duplicate pending invitation.
7. Suspended or archived tenants must not create staff invitations.
8. Staff invitation acceptance still needs account-linking and duplicate/conflict rules from `account-recovery-and-invite-account-policy.md`.

## Current Limits

This work does not implement:

- Billing subscription enforcement.
- Production support console.
- Customer/patient/clinical data mutation.
- Tenant status DB persistence.
- Remote Supabase or production execution.
- Real email delivery.

## Source References

- `docs/engineering/auth-security/auth-login/clair-operator-access-model-and-admin-guard.md`
- `docs/engineering/auth-security/auth-login/tenant-application-approval-workspace-model.md`
- `docs/engineering/auth-security/auth-login/approved-tenant-workspace-first-admin-invite-action.md`
- `docs/engineering/auth-security/auth-login/account-recovery-and-invite-account-policy.md`
- `docs/engineering/auth-security/auth-login/saas-launch-approval-gates.md`

## Verification

- Red: `npx playwright test tests/ops-tenant-status-policy.spec.ts --reporter=line` failed before the tenant status policy module existed.
- Green: `npx playwright test tests/ops-tenant-status-policy.spec.ts --reporter=line` (`4 passed`).
- Regression: `npx playwright test tests/ops-tenant-status-policy.spec.ts tests/ops-tenant-workspace-action.spec.ts tests/ops-tenant-approval.spec.ts tests/auth.spec.ts --reporter=line` (`41 passed`).
- `npx tsc --noEmit` passed.
- `npm run lint` passed with existing warnings only.
- `npm run docs:check` passed.
- `npm run build` passed.
- `npm run security:secrets` passed.
- `git diff --check` passed.
