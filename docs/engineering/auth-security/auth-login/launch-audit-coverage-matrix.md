# Launch Audit Coverage Matrix

Updated: 2026-05-20
Linear: DEN-167

This document records the pilot launch audit coverage for tenant approval, workspace creation, first/admin invitations, staff invitations, invitation lifecycle, and role/status mutations.
The launch objective is to preserve who did what, when, and to which tenant/workspace resource without storing raw invite links, tokens, secrets, or full clinical payloads in audit metadata.

## Coverage Matrix

| Mutation | Actor | Audit event | Target | Coverage |
| --- | --- | --- | --- | --- |
| Tenant application approval/status policy | CLAiR operator | `ops.tenant_application_approved`, `ops.tenant_status_changed` | tenant application | `tests/ops-tenant-approval.spec.ts`, `tests/ops-tenant-status-policy.spec.ts` |
| Approved tenant workspace creation | CLAiR operator | `ops.workspace_created_for_tenant` | workspace | `tests/ops-tenant-workspace-action.spec.ts`, `tests/launch-audit-coverage-matrix.spec.ts` |
| First admin invitation from approved tenant action | CLAiR operator | `ops.first_admin_invitation_created` | workspace invitation | `tests/ops-tenant-workspace-action.spec.ts`, `tests/launch-audit-coverage-matrix.spec.ts` |
| Direct workspace creation fallback | creator user | `workspace.created` | workspace | `tests/launch-audit-coverage-matrix.spec.ts` |
| Staff invitation creation | hospital admin | `workspace.invitation_created` | workspace invitation | `tests/launch-audit-coverage-matrix.spec.ts`, `tests/workspace-invitation-server.spec.ts` |
| Invitation resend | hospital admin | `workspace.invitation_resent` | workspace invitation | `tests/workspace-invitation-lifecycle-server.spec.ts`, `tests/launch-audit-coverage-matrix.spec.ts` |
| Invitation cancel | hospital admin | `workspace.invitation_canceled` | workspace invitation | `tests/workspace-invitation-lifecycle-server.spec.ts`, `tests/launch-audit-coverage-matrix.spec.ts` |
| Invitation accept | invited member | `workspace.invitation_accepted` | workspace invitation and membership | `tests/workspace-invitation-lifecycle-server.spec.ts`, `tests/launch-audit-coverage-matrix.spec.ts` |
| Membership role change | hospital admin | `workspace.membership_roles_changed` | membership | `tests/live-audit-mutation-emission.spec.ts`, `tests/launch-audit-coverage-matrix.spec.ts` |
| Membership status change | hospital admin | `workspace.membership_status_changed` | membership | `tests/live-audit-mutation-emission.spec.ts`, `tests/launch-audit-coverage-matrix.spec.ts` |
| Audit review | hospital admin | reader surface | audit events | `tests/audit-review-surface.spec.ts`, `tests/launch-audit-coverage-matrix.spec.ts` |

## Actor And Target Requirements

- CLAiR operator actions must include `operatorUserId`, tenant application id, workspace id, and reason.
- Hospital admin workspace actions must include `actorUserId`, `workspaceId`, `targetType`, `targetId`, and occurred timestamp.
- Invitation audit hooks must include invitation id and role summary, but not raw invite token, OTP, magic link, provider payload, auth header, or secret-shaped metadata.
- Role/status mutations must keep request id support through `getAuditRequestId(request)` where routes append live audit events.
- Audit review remains hospital-admin-only and workspace-scoped.

## Remaining Audit Gaps

- Tenant approval and first-admin invite currently use local audit hook objects, not a remote/staging Supabase append replay.
- Workspace creation and staff invitation creation now expose safe audit hooks; full production append wiring remains a future live-readiness gate.
- Long-term retention, SIEM export, alerting, and immutable storage policy are out of scope for DEN-167.
- Production demo-header disablement proof remains a broader launch blocker.
- Real hospital, staff, patient, guardian, and billing data remain out of scope.

## Verification Commands

```bash
npx playwright test tests/launch-audit-coverage-matrix.spec.ts --reporter=line
npx playwright test tests/launch-audit-coverage-matrix.spec.ts tests/ops-tenant-workspace-action.spec.ts tests/ops-tenant-approval.spec.ts tests/ops-tenant-status-policy.spec.ts tests/workspace-creation-server.spec.ts tests/workspace-invitation-server.spec.ts tests/workspace-invitation-lifecycle-server.spec.ts tests/live-audit-log-persistence.spec.ts tests/live-audit-mutation-emission.spec.ts tests/audit-review-surface.spec.ts tests/last-admin-role-change-launch-safety.spec.ts --reporter=line
npx tsc --noEmit
npm run lint
npm run docs:check
npm run build
npm run security:secrets
git diff --check
```
