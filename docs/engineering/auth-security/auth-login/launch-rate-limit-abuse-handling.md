# Launch Rate Limit And Abuse Handling

Updated: 2026-05-20
Linear: DEN-168

This document records the pilot launch rate-limit and abuse-handling coverage for auth/workspace, invite, tenant approval, and role/status mutation routes.
The launch goal is not a complete production WAF. It is to ensure abuse-prone app routes have a shared typed boundary, safe `429` response, and a clear production follow-up for shared storage.

## Route Coverage

| Route | Abuse risk | Rate-limit status | Coverage |
| --- | --- | --- | --- |
| `POST /api/ops/tenant-applications/[applicationId]/workspace` | tenant approval action replay, first-admin invite spam | Covered with `ops_tenant_workspace_action` | `tests/launch-rate-limit-abuse-handling.spec.ts` |
| `POST /api/workspaces` | workspace creation spam | Covered with `workspace_create` | `tests/workspace-rate-limit-server.spec.ts`, `tests/launch-rate-limit-abuse-handling.spec.ts` |
| `POST /api/workspaces/[workspaceId]/invitations` | staff invite spam | Covered with `workspace_invitation_create` | `tests/workspace-rate-limit-server.spec.ts`, `tests/launch-rate-limit-abuse-handling.spec.ts` |
| `POST /api/workspaces/[workspaceId]/invitations/[invitationId]/resend` | invite resend spam | Covered with invitation lifecycle operation key | `tests/workspace-rate-limit-server.spec.ts`, `tests/launch-rate-limit-abuse-handling.spec.ts` |
| `POST /api/workspaces/[workspaceId]/invitations/[invitationId]/cancel` | repeated lifecycle mutation | Covered with invitation lifecycle operation key | `tests/workspace-rate-limit-server.spec.ts`, `tests/launch-rate-limit-abuse-handling.spec.ts` |
| `POST /api/workspaces/[workspaceId]/invitations/[invitationId]/accept` | invite acceptance probing/replay | Covered with invitation lifecycle operation key | `tests/workspace-rate-limit-server.spec.ts`, `tests/launch-rate-limit-abuse-handling.spec.ts` |
| `POST /api/workspaces/[workspaceId]/memberships/[membershipId]/roles` | permission probing/escalation attempts | Covered with `workspace_membership_role_update` | `tests/workspace-rate-limit-server.spec.ts`, `tests/launch-rate-limit-abuse-handling.spec.ts` |
| `PATCH /api/workspaces/[workspaceId]/memberships/[membershipId]/status` | deactivation/reactivation abuse | Covered with `workspace_membership_status_update` | `tests/workspace-rate-limit-server.spec.ts`, `tests/launch-rate-limit-abuse-handling.spec.ts` |
| `PATCH /api/users/me/profile` | profile write spam | Covered with profile operation key and direct 429 smoke | `tests/workspace-rate-limit-server.spec.ts` |

## Response Contract

All covered routes use `enforceWorkspaceMutationRateLimit(...)`.
When the boundary is exceeded, the response is:

```json
{
  "ok": false,
  "error": "rate_limited",
  "retryAfterSeconds": 1
}
```

The HTTP status is `429`, and the `Retry-After` header is present.
The response must not include raw tokens, passwords, secrets, stack traces, SQL errors, provider payloads, or invite links.

## Duplicate And Abuse Handling

- Duplicate pending invite email remains `409 duplicate_pending_invitation`, not an internal error.
- Existing active member email remains `409 active_membership_exists`.
- Unknown or unauthorized actors remain typed 401/403 before mutation side effects.
- Rate limiting is per operation, actor, workspace/application scope, and client fingerprint.

## Production Follow-Up

- The current store is process-local and suitable only for local-first/single-instance validation.
- Before multi-instance production, replace or back the limiter with a shared store such as Redis, managed edge rate limits, or an equivalent platform primitive.
- Add production log redaction and request-id correlation across all public auth/invite routes.
- External WAF setup and enterprise monitoring remain outside DEN-168.

## Verification Commands

```bash
npx playwright test tests/launch-rate-limit-abuse-handling.spec.ts --reporter=line
npx playwright test tests/launch-rate-limit-abuse-handling.spec.ts tests/workspace-rate-limit-server.spec.ts tests/ops-tenant-workspace-action.spec.ts tests/workspace-invitation-server.spec.ts tests/workspace-invitation-lifecycle-server.spec.ts tests/server-permission-enforcement.spec.ts tests/last-admin-role-change-launch-safety.spec.ts --reporter=line
npx tsc --noEmit
npm run lint
npm run docs:check
npm run build
npm run security:secrets
git diff --check
```
