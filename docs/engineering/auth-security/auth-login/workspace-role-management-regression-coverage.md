# Workspace Role Management Regression Coverage

Updated: 2026-05-18
Linear: DEN-51
Project: `02 Workspace & Membership Live Persistence`

## Summary

DEN-51 adds a role management handoff regression matrix so UI, server route, and DB guard coverage remains discoverable.

## What Changed

- Added `tests/workspace-role-management-regression.spec.ts`.
- The regression checks that hospital admin success, non-admin denial, cross-workspace denial, and last-admin demotion/deactivation guards remain covered.
- The regression also checks route and DB wrapper discoverability.

## Verification

- `npx playwright test tests/workspace-role-management-regression.spec.ts tests/auth.spec.ts tests/server-permission-enforcement.spec.ts tests/workspace-role-status-write-server.spec.ts --reporter=line`
