# Workspace Selector Active Membership Runtime

Updated: 2026-05-20

This document records the DEN-153 runtime hardening for workspace entry and selector membership state behavior.

## Decision

Workspace entry and selector display must depend on active workspace membership, not client-local role labels.

The current SaaS launch foundation keeps two compatible paths:

- Session-only mock/local path: browser workspace state is allowed only when the current session has an `active` membership for the requested workspace.
- Persisted membership path: `GET /api/workspaces` returns active workspace memberships from the server-side membership reader. Client runtime treats a missing active row as unauthorized.

The demo workspace `clair-demo` remains the local MVP fallback workspace.

## Membership State Access Table

| Membership state | Workspace list/selector | Direct `/w/:workspaceId/...` entry | Runtime result |
|---|---|---|---|
| `active` | Included | Allowed | User can enter the workspace. |
| `pending` | Excluded | Blocked | User is not an active member yet. |
| `inactive` | Excluded | Blocked | Access is removed until reactivated. |
| `suspended` | Excluded | Blocked | Access is blocked while suspended. |
| missing membership | Excluded | Blocked | User has no tenant relationship. |
| missing session | N/A | Blocked | User is redirected to login with `reason=session_required`. |

## Runtime Behavior

`AuthGate` now accepts an optional `workspaceId`.

- If no session exists, it redirects to `/login?reason=session_required&next=...`.
- If a session exists but the workspace membership is not active, it redirects to `/login?reason=unauthorized&next=...`.
- For session-only workspaces, it reads `clair.sessionWorkspaces.v1` and checks the current session id against the membership user session id.
- For persisted workspaces, it calls `GET /api/workspaces` and allows only rows with the requested workspace id and `status: "active"`.

## Server List Boundary

`server-workspace-list-core.ts` maps persisted workspace list rows and drops non-active rows defensively. The SQL reader is already expected to return only active rows, but the mapper keeps selector behavior stable if a stale or malformed row reaches the app boundary.

## Remaining Route/Server Hardening Needs

- This does not replace route-level permission checks on clinical, billing, reception, or admin APIs.
- Workspace entry is still a client runtime guard for the page shell. Protected data routes must continue to enforce active membership server-side.
- Remote Supabase staging/live validation, production deploy, email delivery, and role-policy changes remain approval-gated.
- A future production UX can replace the login-page unauthorized notice with a dedicated access-denied page or workspace request-access flow.

## Verification

- Red: `npx playwright test tests/workspace-list-server.spec.ts -g "active memberships only" --reporter=line` failed before the active-only mapper existed.
- Red: `npx playwright test tests/auth.spec.ts -g "workspace route blocks session workspaces|session workspace access contract" --reporter=line` failed before workspace entry checked active membership.
- Green: the same focused tests passed after implementation.
