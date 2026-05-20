# Approved Tenant Workspace And First Admin Invite Action

Updated: 2026-05-20
Linear: DEN-157
Initiative: `CLAiR EMR SaaS Launch Foundation`
Project: `02 CLAiR Ops Admin Tenant Approval`

## Purpose

This document records the local-first server route added for creating a workspace and first `hospital_admin` invitation from an approved tenant application.

This is the server boundary for the first SaaS tenant activation step. It does not send real email and does not execute remote Supabase, production DB/RLS, or service-role operations.

## Implemented Route

Route:

```text
POST /api/ops/tenant-applications/[applicationId]/workspace
```

Body:

```json
{
  "firstAdminEmail": "first.admin@hospital.example",
  "firstAdminDisplayName": "Hospital Admin"
}
```

Response on success:

```json
{
  "ok": true,
  "tenantApplication": {},
  "workspace": {},
  "firstAdminInvitation": {},
  "auditEvents": [],
  "emailDelivery": "not_sent_approval_gated",
  "enforcedBy": "clair-ops-tenant-workspace-action"
}
```

## Creation Flow

1. Resolve actor identity through `readServerSession()`.
2. In mock fallback only, accept the deterministic demo actor header.
3. Resolve CLAiR operator authority through a server-owned operator adapter.
4. Require active operator status and `tenant_approval:manage`.
5. Validate the first admin email and display name.
6. Load the tenant application.
7. Require approved tenant state and no existing workspace.
8. Create a local-first workspace record.
9. Create a first `hospital_admin` pending invitation record.
10. Prepare audit hook events.
11. Return a safe response envelope.

## Denial Scenarios

| Scenario | HTTP | Denial |
| --- | ---: | --- |
| Missing actor | `401` | `unauthenticated` |
| Signed-in user is not a CLAiR operator | `403` | `operator_missing` |
| Operator inactive/suspended | `403` | `operator_inactive` |
| Operator lacks manage permission | `403` | `operator_permission_missing` |
| Invalid first admin email/name | `400` | `invalid_input` |
| Unknown tenant application | `404` | `target_tenant_application_missing` |
| Pending/held tenant | `409` | `tenant_not_approved` |
| Rejected tenant | `409` | `tenant_rejected` |
| Existing workspace | `409` | `tenant_workspace_exists` |
| Existing first admin invitation without workspace | `409` | `first_admin_invitation_exists` |

## Audit Hook

The route prepares these events:

- `ops.workspace_created_for_tenant`
- `ops.first_admin_invitation_created`

The audit payload includes operator id, tenant application id, workspace id, first admin invitation id, reason, and timestamp. It must not include raw invite tokens, password reset links, cookies, authorization headers, service-role keys, raw SQL, or provider payloads.

## Email Delivery Gate

Real email delivery remains blocked.

The route returns a pending invitation record but marks delivery as:

```text
not_sent_approval_gated
```

Before real email can be enabled, the project still needs:

- Explicit 승욱 approval for email provider setup and outbound delivery.
- Approved provider and environment.
- Sender domain/DNS authentication check.
- Template copy and token handling review.
- Test-recipient list.
- Rate limit/abuse handling.
- Bounce/failure handling.
- No raw token logging.

## Supabase Boundary

This work reviewed current Supabase security guidance and kept the route local/mock:

- Supabase Auth user identity can identify a signed-in user, but operator authority still comes from server-owned app data.
- Supabase `user_metadata` must not be used for authorization decisions.
- Service-role or secret keys must not be exposed in browser/client code.
- Remote Supabase, DB/RLS migration, production deploy, and real email remain approval-gated.

## Current Limits

This work does not implement:

- Real email provider sending.
- Public invite acceptance account-linking UX.
- Hospital staff invitation flow.
- Tenant application DB tables.
- Remote Supabase persistence.
- DB/RLS migration.
- Production Supabase execution.
- Payment/subscription policy.

## Source References

- `docs/engineering/auth-security/auth-login/clair-operator-access-model-and-admin-guard.md`
- `docs/engineering/auth-security/auth-login/tenant-application-approval-workspace-model.md`
- `docs/engineering/auth-security/auth-login/account-recovery-and-invite-account-policy.md`
- `docs/engineering/auth-security/auth-login/saas-launch-approval-gates.md`
- `docs/engineering/auth-security/auth-login/api-error-telemetry-contract.md`
- Supabase changelog: https://supabase.com/changelog
- Supabase product security docs: https://supabase.com/docs/guides/security/product-security
- Supabase Auth users docs: https://supabase.com/docs/guides/auth/users

## Verification

- Red: `npx playwright test tests/ops-tenant-workspace-action.spec.ts --reporter=line` failed before the server action module and route existed.
- Green: `npx playwright test tests/ops-tenant-workspace-action.spec.ts --reporter=line`.
- `npx playwright test tests/ops-tenant-workspace-action.spec.ts tests/ops-tenant-approval.spec.ts tests/auth.spec.ts --reporter=line`.
- `npx tsc --noEmit`.
- `npm run lint`.
- `npm run docs:check`.
- `npm run build`.
- `npm run security:secrets`.
- `git diff --check`.
- Further verification recorded in the DEN-157 closeout report.
