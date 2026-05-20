# Tenant Application Approval Workspace Model

Updated: 2026-05-20
Linear: DEN-156
Initiative: `CLAiR EMR SaaS Launch Foundation`
Project: `02 CLAiR Ops Admin Tenant Approval`

## Purpose

This document records the minimum tenant application model and local operator surface added for the CLAiR approval-only SaaS launch foundation.

The goal is to prevent unapproved hospitals from entering workspace creation or member onboarding flows. A hospital must first exist as a tenant application, move through the CLAiR review state machine, and only then become eligible for workspace creation and first admin invitation work.

## Implemented Local Model

Added a local-first tenant application model in `src/features/ops/tenant-application-model.ts`.

Tenant application statuses:

| Status | Meaning | Workspace creation |
| --- | --- | --- |
| `pending_review` | CLAiR has received the hospital application and has not decided yet. | Blocked with `tenant_not_approved`. |
| `on_hold` | CLAiR needs more information before approval. | Blocked with `tenant_not_approved`. |
| `approved` | CLAiR approved the hospital. | Allowed only when no workspace exists yet. |
| `rejected` | CLAiR rejected the application. | Blocked with `tenant_rejected`. |

Workspace gate:

| Condition | Result |
| --- | --- |
| Status is not `approved` | `canCreateWorkspace: false`, `reason: tenant_not_approved` |
| Status is `rejected` | `canCreateWorkspace: false`, `reason: tenant_rejected` |
| Status is `approved` and no workspace exists | `canCreateWorkspace: true` |
| `workspaceId` exists | `canCreateWorkspace: false`, `reason: tenant_workspace_exists` |

## Implemented Admin Surface

Added `/ops/tenant-approvals`.

The page is intentionally local/mock and read-only. It is wrapped by the existing `AuthGate` for login/session continuity, but this is not a full CLAiR operator security boundary. DEN-157 must connect server operator guard and persistence before mutation actions are considered secure.

The surface shows:

- Tenant application queue.
- Pending, held, approved, rejected, and workspace-connected states.
- Workspace creation readiness labels.
- First admin invitation placeholder.
- Submitted/reviewed timestamps.
- Tenant state machine summary.
- Audit hook points.

Seed rows live in `src/features/ops/tenant-approval-data.ts` and use synthetic example hospitals only.

## Mock Fallback Decision

Keep the Project 02 tenant approval surface local/mock until the server operator guard and persistence action are explicitly scoped.

Reasons:

- DEN-155 requires CLAiR operator authority to come from server-owned data, not workspace membership or client state.
- DEN-156 needs a surface and state model before mutating tenant/workspace records.
- Remote Supabase, DB/RLS migration, real email, and production data remain approval-gated.

## Audit Hook Points

The local model exposes the event type list for implementation handoff:

- `ops.tenant_application_approved`
- `ops.tenant_application_rejected`
- `ops.tenant_application_held`
- `ops.workspace_created_for_tenant`

DEN-157 should attach these to a server-only mutation boundary and avoid storing raw invite tokens, provider payloads, SQL text, cookies, or secret-shaped values.

## Current Limits

This work does not implement:

- Public customer application form.
- Server-side operator guard.
- Tenant application DB tables or RLS policies.
- Workspace creation mutation from the ops page.
- First `hospital_admin` invitation creation.
- Real email delivery.
- Payment/subscription integration.
- Production data import.

## Source References

- `docs/engineering/auth-security/auth-login/clair-operator-access-model-and-admin-guard.md`
- `docs/engineering/auth-security/auth-login/invite-only-b2b-saas-launch-architecture.md`
- `docs/engineering/auth-security/auth-login/saas-launch-approval-gates.md`
- `docs/engineering/auth-security/auth-login/workspace-member-server-route-contract.md`
- `docs/engineering/auth-security/auth-login/api-error-telemetry-contract.md`

## Verification

- Red: `npx playwright test tests/ops-tenant-approval.spec.ts --reporter=line` failed before the tenant model and ops route existed.
- Green: `npx playwright test tests/ops-tenant-approval.spec.ts --reporter=line`.
- `npx playwright test tests/ops-tenant-approval.spec.ts tests/auth.spec.ts --reporter=line`.
- `npx tsc --noEmit`.
- `npm run lint`.
- `npm run docs:check`.
- `npm run build`.
- `npm run security:secrets`.
- Local Playwright browser smoke against `http://127.0.0.1:3000/ops/tenant-approvals`.
- Further verification recorded in the DEN-156 closeout report.
