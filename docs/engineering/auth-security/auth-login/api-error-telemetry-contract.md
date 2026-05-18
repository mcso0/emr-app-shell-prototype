# API Error And Telemetry Contract

Updated: 2026-05-18
Linear: DEN-96
Project: `02 Workspace & Membership Live Persistence`

## Summary

Workspace/member live APIs must return typed, non-secret error responses and log enough request context to debug failures without leaking tokens, passwords, raw DB errors, or stack traces.

## Response Envelope

Success:

```json
{
  "ok": true,
  "requestId": "req_...",
  "data": {}
}
```

Failure:

```json
{
  "ok": false,
  "requestId": "req_...",
  "error": "validation_failed",
  "denialReason": "permission_missing",
  "fieldErrors": {}
}
```

Rules:

- `ok` is always present.
- `requestId` should be present on all live API responses once the route is updated to the shared helper.
- `error` is a stable machine-readable category, not a raw exception message.
- `denialReason` is allowed for auth, permission, state, and conflict denials.
- `fieldErrors` is allowed only for user-correctable validation errors.
- Raw token, password, invite secret, DB connection string, SQL text, stack trace, or provider response body must never be returned.

## Status Code Matrix

| Status | Use For | Envelope |
| --- | --- | --- |
| `400` | Invalid input, invalid JSON, forbidden profile authority field | `{ ok: false, error: "validation_failed" }` or `{ ok: false, denialReason: "profile_authority_field_forbidden" }` |
| `401` | Missing or invalid authenticated actor | `{ ok: false, denialReason: "unauthenticated" }` |
| `403` | Active membership or permission missing | `{ ok: false, denialReason: "permission_missing" }` |
| `404` | Target workspace, invitation, or membership is unavailable to the actor | `{ ok: false, denialReason: "target_membership_missing" }` |
| `409` | Duplicate, stale state, last-admin guard, already active member | `{ ok: false, denialReason: "duplicate_pending_invitation" }` |
| `429` | Route-level rate limit exceeded | `{ ok: false, error: "rate_limited" }` |
| `500` | Unexpected persistence/server failure | `{ ok: false, error: "db_write_failed" }` or `{ ok: false, error: "server_error" }` |

## Logging Contract

Server logs may include:

- `requestId`
- route operation name
- actor user id
- workspace id when present
- target id when present
- status code
- stable `error` or `denialReason`

Server logs must not include:

- raw cookies or authorization headers
- service role, DB password, JWT, invite token, or provider secret
- full SQL error text when it contains connection details
- request body fields that can contain secret values
- stack traces in client responses

## Route Handoff Checklist

Before a workspace/member/profile route is considered live-ready:

- Return the envelope above.
- Include a `requestId`.
- Map validation, auth, permission, conflict, rate-limit, and DB failure to the status matrix.
- Catch unexpected errors and return a stable `500` envelope.
- Log only safe context.
- Add a regression that proves raw secret-shaped values are not returned.
- Keep mock fallback behavior compatible with the same envelope.

## Current Route Review

Reviewed routes and server modules:

- `src/app/api/workspaces/route.ts`
- `src/app/api/workspaces/[workspaceId]/invitations/**`
- `src/app/api/workspaces/[workspaceId]/memberships/**`
- `src/app/api/users/me/profile/route.ts`
- `src/features/auth/server-workspace-*`
- `src/features/auth/server-role-update-enforcement.ts`
- `src/features/auth/server-personal-profile.ts`

Current routes already use typed `ok`, `error`, `denialReason`, and status codes in most paths. The main follow-up is applying a shared helper so `requestId`, `429`, and safe logging are consistent everywhere.

## Verification

- `rg -n "Response.json|NextResponse.json|catch|requestId|denialReason|db_write_failed" src/app/api src/features/auth`
- `npm run docs:check`

No external observability vendor, production log pipeline, or clinical/domain persistence route design was added.
