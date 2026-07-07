# Workspace Live API Rate Limiting

Updated: 2026-07-07
Linear: DEN-97
Project: `02 Workspace & Membership Live Persistence`

## Summary

DEN-97 added a route-level rate limit boundary to workspace/member/profile
mutation APIs. The 2026-07-07 application security review extended the same
boundary to additional invite, lab result, and notification mutations.

## Boundary

The shared boundary lives in `src/lib/security/rate-limit.ts`.

Default local/dev/test policy:

- Window: 60 seconds.
- Limit: 60 requests.
- Key: operation + actor user id + workspace id or `self` + client fingerprint.
- Response: `429` with `{ ok: false, error: "rate_limited", retryAfterSeconds }`.
- Header: `Retry-After`.

The current adapter is in-memory and intentionally local-first.

## Production Storage Decision

Decision date: 2026-07-07

Use a managed Redis-compatible shared store for production and production-demo
deployments that can run more than one server instance. Prefer the hosting
platform's managed Redis/KV-compatible product when it provides atomic increment
plus expiry; otherwise use an equivalent managed Redis service.

Requirements:

- Server-only access. No client-visible token or browser bundle access.
- Atomic increment and expiry per key, matching the existing key shape:
  operation + actor/request boundary + workspace or `self` + client fingerprint.
- `429`, `{ ok: false, error: "rate_limited", retryAfterSeconds }`, and
  `Retry-After` response compatibility with the current helper.
- Separate local/test in-memory adapter from production shared storage.
- Provisioning and production secret wiring require the normal approval gate;
  this document records the decision only.

## Protected Routes

- `POST /api/workspaces`
- `POST /api/workspaces/[workspaceId]/invitations`
- `POST /api/workspaces/[workspaceId]/invitations/[invitationId]/reinvite-request`
- `POST /api/workspaces/[workspaceId]/invitations/[invitationId]/resend`
- `POST /api/workspaces/[workspaceId]/invitations/[invitationId]/cancel`
- `POST /api/workspaces/[workspaceId]/invitations/[invitationId]/accept`
- `POST /api/workspaces/[workspaceId]/memberships/[membershipId]/roles`
- `PATCH /api/workspaces/[workspaceId]/memberships/[membershipId]/status`
- `POST /api/workspaces/[workspaceId]/lab-imaging/result-entries`
- `POST /api/workspaces/[workspaceId]/notifications/[notificationId]/archive`
- `POST /api/workspaces/[workspaceId]/notifications/[notificationId]/read`
- `POST /api/workspaces/[workspaceId]/notifications/[notificationId]/restore`
- `POST /api/workspaces/[workspaceId]/notifications/order-recheck-requests`
- `POST /api/workspaces/[workspaceId]/notifications/read-all`
- `PATCH /api/users/me/profile`

Most workspace mutation limiters run after actor identity resolution and before
DB/permission mutation work continues. The reinvite request route also uses a
request fingerprint limiter before invite lookup so unknown invitation IDs cannot
be repeated without throttling.

## Verification

- `npx playwright test tests/workspace-rate-limit-server.spec.ts --reporter=line`
- `npx playwright test tests/workspace-rate-limit-server.spec.ts tests/server-permission-enforcement.spec.ts tests/workspace-invitation-server.spec.ts --reporter=line`
- `npx tsc --noEmit`

Remote infrastructure provisioning, production analytics, bot detection, WAF,
and external Redis/KV setup remain out of scope until an approved deployment
work item provisions the shared store.
