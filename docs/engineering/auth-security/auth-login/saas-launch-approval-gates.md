# SaaS Launch Approval Gates

Updated: 2026-05-20
Linear: DEN-150
Initiative: `CLAiR EMR SaaS Launch Foundation`

## Purpose

This document defines the representative approval gates for risky SaaS launch work. It turns the DEN-148 and DEN-149 decisions into an explicit operating contract for remote Supabase, DB/RLS execution, email delivery, production deploy, role/permission policy changes, rollback/backup expectations, and launch blocker classification.

## Executive Decision

No issue, project, or initiative approval implicitly grants permission to execute high-risk launch operations.

The following always require a separate explicit approval from 승욱 before execution:

- Remote Supabase link, migration push, SQL execution, dashboard mutation, or staging/live secret use.
- Production or customer-facing DB/RLS execution.
- Real email provider setup or outbound invitation email delivery.
- Production deploy or customer-facing environment switch.
- Role/permission product policy change.
- Payment/subscription provider integration.
- Real clinic, staff, guardian, patient, billing, or medical data import.

Approval must name the target environment, allowed operation, input values or configuration source, verification plan, and rollback or stop condition. A broad phrase like "continue launch work" is not enough.

## Safe Work That Can Continue Without Extra Approval

These are allowed when the active issue scopes them and repo guardrails are respected:

- Planning and source-of-truth documentation.
- Local/mock UI and route implementation.
- Local-first Supabase validation against a local Docker-backed stack when the issue explicitly scopes local DB/RLS work.
- Static migration tests, contract tests, and local Playwright regression.
- Secret scanning, docs checks, code review, and security reports.
- Copyable local invite-link UX that does not send real email.

## Gate Summary

| Gate | Risk area | Default status | Required approval before |
| --- | --- | --- | --- |
| G1 | Remote Supabase staging | Blocked | `supabase link`, remote migration push, remote SQL, dashboard mutation, staging secrets |
| G2 | Production/live Supabase | Blocked | Any live DB/RLS/project/auth setting mutation |
| G3 | DB/RLS execution | Local-only by scoped issue | Remote apply, production apply, destructive schema/data operation |
| G4 | Email delivery | Blocked | Provider setup, SMTP/API secret use, outbound invite/password/account email |
| G5 | Production deploy | Blocked | Customer-facing deploy, domain switch, live env var switch, monitoring/log pipeline enablement |
| G6 | Role/permission policy | Blocked | Canonical role change, permission matrix change, admin authority expansion/reduction |
| G7 | Real data | Blocked | Import or manual entry of real clinic, staff, guardian, patient, medical, billing data |
| G8 | Payment/subscription | Blocked | Provider setup, billing logic, subscription enforcement, seat billing |

## Gate Details

### G1 Remote Supabase Staging

Approval must include:

- Target Supabase project name or id.
- Whether the operation is link, migration push, SQL execution, dashboard setting change, auth setting change, advisor run, or secret use.
- Exact migration range, SQL file, or dashboard setting to be touched.
- Secret handling path, without pasting secrets into docs, Linear, chat, logs, or repo files.
- Preflight verification commands from local-first validation.
- Backup/restore or forward-fix expectation.
- Stop conditions.

Preflight:

- `npm run docs:check`
- `npm run security:secrets`
- Confirm no tracked `.env*` or `.vercel/.env*` files contain secrets.
- Confirm local migration/RLS tests passed for the target scope.
- Confirm request id/safe logging, rate limit, RLS/grant, and permission-denial checks are included where the touched routes need them.

Rollback/stop criteria:

- Stop if a required secret is missing, pasted in an unsafe place, or appears in logs.
- Stop if local validation does not match the migration or setting planned for staging.
- Stop if RLS/grants expose more rows or schemas than intended.
- Prefer forward-fix migrations unless a documented backup restore decision exists.

### G2 Production/Live Supabase

Production/live Supabase mutation is a separate launch/deployment event, not an ordinary implementation task.

Approval must include everything in G1 plus:

- Named production environment.
- Expected user impact and maintenance window.
- Backup confirmation or explicit no-restore decision.
- Monitoring and owner during the change.
- Post-change validation checklist.
- Rollback or forward-fix owner.

Production blockers before approval:

- No shared production rate-limit store.
- No route-wide request id/safe logging helper for affected live routes.
- No Supabase advisor/security-definer RPC review for affected DB functions.
- No production log redaction rule for external logs or observability.
- No tested workspace/tenant isolation matrix for the affected data.

### G3 DB/RLS Execution

Local DB/RLS work can proceed only when the active issue explicitly scopes it. Remote execution follows G1 or G2.

Required inputs:

- Migration filename or SQL scope.
- Tables/functions/policies touched.
- Whether data is disposable local seed data or real/staging/live data.
- Expected grants/exposure changes.
- RLS matrix to test: unauthenticated denial, missing membership denial, inactive membership denial, cross-workspace denial, active member allowed path, admin allowed path, and last-admin protection where relevant.

Rollback/stop criteria:

- Stop on destructive operations against non-local data unless the approval explicitly names the destructive operation and backup state.
- Stop if RLS is disabled or grants expose protected rows without an explicit review.
- Stop if service-role or secret credentials are needed but were not approved for the named environment.

### G4 Email Provider And Outbound Email

Real email delivery is blocked until approved. Local/mock invite links can remain available for development.

Approval must include:

- Provider name and target environment.
- Email types allowed, such as invitation, password reset, or account verification.
- Sender domain and DNS/authentication status where relevant.
- Template ids or template copy source.
- Secret storage path.
- Test recipient list.
- Rate limit and abuse prevention plan.
- Bounce/failure handling plan.

Verification:

- Send only to approved test recipients first.
- Confirm no real patient, guardian, clinical, billing, or secret data appears in email content.
- Confirm invite links use token handling that does not expose raw secrets in logs or reports.

Rollback/stop criteria:

- Stop on domain authentication failure, unexpected recipient delivery, leaked token, wrong tenant/workspace link, or bounce/abuse anomaly.
- Disable provider key or environment variable rather than continuing sends with unknown state.

### G5 Production Deploy

Production deploy or customer-facing environment switch is blocked until approved.

Approval must include:

- Target platform and project.
- Branch, commit, or release identifier.
- Environment variables being changed, separated into public and secret/server-only.
- Migration dependency state.
- Smoke test path.
- Rollback mechanism.
- Monitoring/log redaction readiness.

Preflight:

- `npm run lint` where code changed.
- `npx tsc --noEmit` where TypeScript/app code changed.
- `npm run build` where deployable app code changed.
- Relevant Playwright/server tests.
- `npm run security:secrets`.
- `npm run docs:check`.

Rollback/stop criteria:

- Stop if build/test/secret scan fails.
- Stop if production env needs unapproved remote Supabase, email, payment, or real-data operation.
- Roll back deploy or freeze rollout if login, workspace selection, invite acceptance, or tenant isolation smoke test fails.

### G6 Role And Permission Policy

The current canonical MVP roles remain:

- `hospital_admin`
- `vet`
- `technician`
- `front_desk`

Role/permission policy change requires explicit approval before changing product behavior, code enforcement, seed policy, RLS policy, or user-facing admin controls.

Approval must include:

- Current behavior.
- Proposed behavior.
- Who gains or loses access.
- Affected modules and server routes.
- Migration or seed changes.
- Regression tests.
- Rollback or compatibility plan.

Stop criteria:

- Stop if the change weakens tenant isolation or last-admin protection without a specific security review.
- Stop if personal profile or user-editable metadata becomes an authorization source.
- Stop if `billing_admin`, `nurse`, or any compatibility role is promoted to a canonical launch role without product approval.

### G7 Real Data

Real data import or manual entry is blocked until approved.

Approval must include:

- Data source and owner.
- Data categories, including staff, clinic, guardian, patient, medical record, billing, attachments, or identifiers.
- Legal/consent basis and retention expectation.
- Target environment.
- Access controls and deletion plan.
- Redaction/anonymization plan when using demo or QA environments.

Stop criteria:

- Stop if the environment is not approved for real data.
- Stop if data contains clinical, guardian, patient, payment, or staff identifiers without explicit approval.
- Stop if logs, reports, screenshots, or fixtures would contain real sensitive data.

### G8 Payment And Subscription

Payment/subscription work is blocked until approved.

Approval must include:

- Provider and environment.
- Product pricing or seat policy.
- Subscription state model.
- Webhook/security plan.
- Billing admin authority decision.
- Test account and rollback plan.

Stop criteria:

- Stop if role/permission policy must change but G6 has not been approved.
- Stop if real customer billing or payment data would be touched.

## Launch Blockers Vs Non-Blockers

### Blockers Before Pilot/Live

- Remote Supabase target and migration/RLS gate approval.
- Shared production rate-limit store for multi-instance deployment.
- Route-wide request id and safe logging helper for affected launch routes.
- Supabase advisor and security-definer RPC review.
- Production log redaction before external monitoring/logging.
- Email delivery gate for real invite/password/account email.
- Password reset/account recovery policy and smoke test.
- Tenant approval and first hospital admin invite audit path.
- Workspace/tenant isolation regression for launch routes.
- Rollback/forward-fix plan for deploy and remote DB changes.

### Non-Blockers For Local-First Implementation

- Payment/subscription provider integration.
- SSO, SCIM, and domain auto-join.
- Public request-access form, as long as it does not create an active workspace or membership.
- Full production observability vendor setup, as long as no production deploy is being attempted.
- Real email delivery, while local copyable invite links are enough for development.
- Real clinic or patient data import.

## Approval Request Template

Use this format in Linear or chat before any gated operation:

```text
Gate:
Target environment:
Operation requested:
Exact files/settings/routes affected:
Inputs/secrets source:
Preflight verification already passed:
Post-change verification:
Rollback or stop condition:
Expected user/data impact:
What will not be touched:
```

## Verification

- Compared against `manual-linear-ops` guardrails.
- Compared against `docs/engineering/current-status.md` guardrails.
- Reused DEN-29/DEN-30 local-first Supabase and secret-handling gates.
- Reused DEN-96 API error/telemetry and DEN-97 rate-limit constraints.
- Reused DEN-98 remote/staging follow-up blockers.
- `npm run docs:check`
- `git ls-files '.env*' '.vercel/.env*' '**/.env*'`
- `npm run security:secrets`
- Confirmed this DEN-150 work is planning/documentation only and does not execute remote Supabase, email delivery, production deploy, DB/RLS changes, role-policy changes, or real data operations.
