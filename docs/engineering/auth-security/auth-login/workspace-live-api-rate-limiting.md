# Workspace Live API Rate Limiting

Updated: 2026-05-18
Linear: DEN-97
Project: `02 Workspace & Membership Live Persistence`

## Summary

DEN-97 adds a route-level rate limit boundary to workspace/member/profile mutation APIs.

## Boundary

The shared boundary lives in `src/lib/security/rate-limit.ts`.

Default local/dev/test policy:

- Window: 60 seconds.
- Limit: 60 requests.
- Key: operation + actor user id + workspace id or `self` + client fingerprint.
- Response: `429` with `{ ok: false, error: "rate_limited", retryAfterSeconds }`.
- Header: `Retry-After`.

The current adapter is in-memory and intentionally local-first. Production should replace the backing store with a shared store such as platform KV or Redis before multi-instance deployment.

## Protected Routes

- `POST /api/workspaces`
- `POST /api/workspaces/[workspaceId]/invitations`
- `POST /api/workspaces/[workspaceId]/invitations/[invitationId]/resend`
- `POST /api/workspaces/[workspaceId]/invitations/[invitationId]/cancel`
- `POST /api/workspaces/[workspaceId]/invitations/[invitationId]/accept`
- `POST /api/workspaces/[workspaceId]/memberships/[membershipId]/roles`
- `PATCH /api/workspaces/[workspaceId]/memberships/[membershipId]/status`
- `PATCH /api/users/me/profile`

The limiter runs after actor identity resolution and before DB/permission mutation work continues.

## Verification

- `npx playwright test tests/workspace-rate-limit-server.spec.ts --reporter=line`
- `npx playwright test tests/workspace-rate-limit-server.spec.ts tests/server-permission-enforcement.spec.ts tests/workspace-invitation-server.spec.ts --reporter=line`
- `npx tsc --noEmit`

Remote infrastructure provisioning, production analytics, clinical/domain routes, bot detection, WAF, and external KV/Redis setup remain out of scope.
