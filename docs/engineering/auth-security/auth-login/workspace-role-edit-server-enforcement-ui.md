# Workspace Role Edit Server Enforcement UI

Updated: 2026-05-18
Linear: DEN-49
Project: `02 Workspace & Membership Live Persistence`

## Summary

DEN-49 routes the role edit confirmation path through the existing server enforcement route before applying the local UI state update.

This is a server-enforcement handoff only. DB write persistence remains DEN-50 scope.

## What Changed

- Updated `WorkspaceMembershipManagement` role change confirmation to call `POST /api/workspaces/[workspaceId]/memberships/[membershipId]/roles`.
- Added pending/error handling for server denial or route failure.
- Adjusted the mock server permission adapter so route-backed UI tests can use dynamic demo workspace/member ids while preserving cross-workspace denial regression.

## Current Limitations

- The route still returns an authorized mutation intent; it does not persist DB role changes yet.
- Member deactivation/status write persistence remains DEN-50 scope.
- Remote Supabase validation remains approval-gated.

## Verification

- `npx playwright test tests/auth.spec.ts tests/server-permission-enforcement.spec.ts -g "edit active member roles|role update server" --reporter=line`
- `npx tsc --noEmit`
- `npm run build`
