# Staging Secret And Deployment Readiness Checklist

Updated: 2026-05-20
Linear: DEN-169

This checklist turns the existing env, secret, Supabase, email, deployment, and rollback guardrails into a staging go/no-go sheet.
It is intentionally written so 승욱 can decide whether staging is ready without reading implementation code.

Source documents:

- `docs/engineering/auth-security/auth-login/auth-db-env-secret-verification-gates.md`
- `docs/engineering/auth-security/auth-login/saas-launch-approval-gates.md`
- `docs/engineering/auth-security/auth-login/supabase-integration-readiness.md`
- `docs/engineering/auth-security/auth-login/launch-rate-limit-abuse-handling.md`

## Non-Developer Go/No-Go Summary

| Area | READY when | BLOCKED when |
| --- | --- | --- |
| Environment | Public and secret env values are separated by environment. | Any real secret is pasted into repo, docs, Linear, chat, screenshots, or logs. |
| Supabase | A named staging project, allowed operations, validation plan, and stop condition are approved. | Remote link, migration push, SQL, dashboard mutation, or staging secret use is requested without 승욱 explicit approval required. |
| Email | Sender domain, from address, provider, test recipients, and no-real-data content are approved. | Real invite, password, verification, or account email would be sent without approval. |
| Deploy | Build/test/secret/doc gates pass and rollback owner/path is known. | Production/customer-facing deploy or live env switch is attempted without approval. |
| Rollback | Stop conditions and forward-fix/rollback decision are written before execution. | The team cannot name how to stop or recover from a failed staging change. |

Decision rule:

- `READY`: every required row in this checklist is checked and no blocked item remains.
- `BLOCKED`: any approval-gated item is missing, any verification command fails, or any real secret/data would be exposed.

## Staging Env Variable Checklist

Public browser-safe values:

| Env | Required for staging Supabase mode | Rule |
| --- | ---: | --- |
| `NEXT_PUBLIC_AUTH_MODE` | Yes | Use `supabase` for a real staging auth check; use `mock` only for local/demo regression. |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Staging project URL only. It is public, but must point to the correct environment. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes | Use publishable key. Legacy anon key is compatibility only. |

Server-only or secret values:

| Secret category | Storage rule | Approval gate |
| --- | --- | --- |
| Supabase secret key | Store only in deployment/CI/Supabase secret manager. Never browser/client. | 승욱 explicit approval required before staging use. |
| Legacy `service_role` key | Avoid by default. If needed, server/admin only. | 승욱 explicit approval required. |
| Database password | Never docs/chat/repo. Use secure credential store only. | 승욱 explicit approval required. |
| Postgres connection string | Local-only unless named staging operation is approved. | 승욱 explicit approval required. |
| Supabase CLI personal access token | Local credential store or CI secret only. | 승욱 explicit approval required for staging automation. |
| Email provider API key | Deployment/CI/provider secret manager only. | 승욱 explicit approval required before real send. |

Ready checks:

- No tracked `.env*` or provider env export files contain real secrets.
- Public env values point to staging, not production.
- No `NEXT_PUBLIC_` env contains a secret/server-only credential.
- Playwright default remains deterministic and does not require real Supabase env.

## Secret Handling And Scanning Checklist

Required before staging:

- Run `npm run security:secrets`.
- Confirm no `.env*`, provider env exports, screenshots, Linear comments, or reports include real secrets.
- Confirm reports use placeholders such as `<staging-publishable-key>` rather than real values.
- Confirm no secret-shaped value appears in route responses, audit metadata, logs, or test snapshots.
- Confirm any use of elevated credentials names target environment, allowed operation, verification plan, and stop condition.

Blocked examples:

- A secret key appears in a `NEXT_PUBLIC_` variable.
- A database URL with an embedded password appears in a tracked file.
- A real email provider key is pasted into a checklist, issue, chat, screenshot, or report.
- A provider error response is copied into docs without redaction.

## Supabase Staging Validation Checklist

Staging Supabase is blocked until the Gate G1 approval in `saas-launch-approval-gates.md` is satisfied.

Required approval fields:

| Field | Required content |
| --- | --- |
| Target project | Exact staging Supabase project name or id |
| Operation | Link, migration push, SQL, dashboard setting, auth setting, advisor run, or secret use |
| Scope | Exact migration files, SQL, tables, functions, RLS policies, or settings |
| Secret path | Where credentials are stored, without exposing values |
| Preflight | Local tests and secret scan already passed |
| Verification | Row isolation, permission denial, RLS/grant checks, and app smoke path |
| Stop condition | When to stop instead of continuing |
| Recovery | Forward-fix or rollback expectation |

Ready checks:

- Local/static migration and RLS tests pass for the touched scope.
- RLS remains enabled for exposed protected tables.
- Grants do not expose protected tables directly to public/anon users.
- Workspace/tenant isolation tests pass for affected data.
- No real clinic, staff, guardian, patient, medical, billing, or payment data is used.

## Email Sender Checklist

Real outbound email is blocked until Gate G4 approval is satisfied.

Required before any staging email send:

- Provider selected and target environment named.
- Sender domain and from address approved.
- DNS/domain authentication status checked by the email provider.
- Allowed email types named: invitation, password reset, account verification, or another specific type.
- Test recipient list approved.
- Template copy reviewed to ensure no real patient, guardian, clinical, billing, or secret data appears.
- Invite/password/account links do not expose raw tokens in logs, screenshots, reports, or analytics.
- Bounce/failure handling and disable/rollback step are known.

Blocked examples:

- Sending real invite email before provider/domain/test recipients are approved.
- Sending to any recipient outside the approved test list.
- Using real customer, patient, guardian, medical, or billing data in email content.

## Deploy And Rollback Preflight

Required before staging deploy or environment switch:

```bash
npm run lint
npx tsc --noEmit
npm run build
npm run security:secrets
npm run docs:check
```

Also run the focused Playwright/server tests for the routes changed by the staging candidate.

Deploy readiness checklist:

- Target platform/project is named.
- Branch, commit, or release identifier is named.
- Public env and server-only secrets are listed separately, with placeholders only.
- Supabase migration/RLS dependency state is known.
- Email delivery state is known.
- Rate-limit and safe error envelope tests pass.
- Audit coverage for touched launch routes is known.
- Rollback owner and rollback/forward-fix path are written.
- Smoke path includes login, workspace entry, invite acceptance, tenant isolation denial, and audit review where applicable.

Stop immediately when:

- Any verification command fails.
- A secret appears in logs, responses, docs, screenshots, or Linear.
- The app points at production resources by mistake.
- Login, workspace entry, invite acceptance, tenant isolation, or audit review smoke fails.
- Required approval is missing or ambiguous.

## Blocked Or Ready Decision Table

| Item | Current launch decision |
| --- | --- |
| Local/mock implementation and tests | READY when focused tests and gates pass |
| Remote Supabase staging mutation | BLOCKED until 승욱 explicit approval required |
| Production/live Supabase mutation | BLOCKED |
| Real email delivery | BLOCKED until sender/provider/test recipients are approved |
| Production/customer-facing deploy | BLOCKED |
| Real clinic/staff/patient/billing data | BLOCKED |
| Shared production rate-limit store | BLOCKED/follow-up before multi-instance production |
| Staging checklist documentation | READY after DEN-169 verification passes |

## Verification Commands

```bash
npx playwright test tests/launch-staging-readiness-checklist.spec.ts --reporter=line
npm run security:secrets
npm run docs:check
git ls-files '.env*' '.vercel/.env*' '**/.env*'
git diff --check
```
