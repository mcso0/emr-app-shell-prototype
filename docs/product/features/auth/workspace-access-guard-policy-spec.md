# Workspace Access Guard Policy Spec

Status: draft  
Updated: 2026-06-12

This document defines the product policy for entering workspace routes and protected actions. It should be read with [Workspace Auth and Permission Domain](../../domain/workspace-auth-permissions.md), [Session Logout Policy Spec](session-logout-policy-spec.md), and [Role Permission Detail Spec](role-permission-detail-spec.md).

## Product Goal

Every protected CLAiR EMR workspace route should be gated consistently: account session first, workspace membership second, membership status third, role/permission fourth, and recent-auth only for high-impact actions.

## Scope

In scope:

- Workspace route entry checks.
- Safe redirect behavior.
- Membership status gating.
- Role and permission gating.
- Protected action checks.
- Recent-auth escalation for sensitive actions.

Out of scope:

- Server implementation details.
- DB/RLS policy SQL.
- Middleware code.
- Production security certification.

## Guard Order

Use this order for product behavior:

1. Account session exists.
2. Requested workspace exists and is accessible to the account.
3. Workspace membership exists.
4. Membership status is `active`.
5. Role/permission allows the screen or action.
6. Recent-auth is valid for high-impact actions.

If any step fails, the user should see the correct state and recovery action.

## Route Entry Outcomes

| Failed check | Product outcome |
| --- | --- |
| No session | Redirect to login with safe `next`. |
| Invalid workspace | Show inaccessible workspace or route fallback. |
| Missing membership | Block and ask for invite/admin support. |
| Inactive membership | Block and ask hospital admin or support. |
| Missing permission | Show permission denied and offer the first allowed module when available. |
| Recent-auth stale | Ask for fresh authentication before action continues. |

## Protected Action Policy

Screen access and mutation access are separate:

- A user may view a screen but not perform all actions on it.
- Hidden buttons are not sufficient security.
- Server-side checks are required before production security claims.
- Later DB/RLS enforcement remains required for live data security.

## Safe Redirect Policy

- Preserve only safe internal `next` routes.
- Ignore external URLs.
- If target route is no longer authorized, route to the best allowed workspace screen.
- If membership is inactive, do not route into workspace modules.
- The default landing for a limited-permission user is the first allowed module.
- Multi-workspace switching is out of MVP scope.

## CLAiR Docs Viewer Placement

This spec should appear in CLAiR Docs under `Features`.

## MVP Decisions

- Limited-permission users land on the first allowed module.
- Permission denied should show a clear blocked state and a path to the first allowed module when available.
- Inactive membership should show hospital admin contact when available, and CLAiR support only when the user cannot recover through the hospital admin path.
- A single account belonging to multiple hospital workspaces is not included in MVP.
