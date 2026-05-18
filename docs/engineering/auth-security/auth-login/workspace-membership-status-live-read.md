# Workspace Membership Status Live Read

Updated: 2026-05-18
Linear: DEN-48
Project: `02 Workspace & Membership Live Persistence`

## Summary

DEN-48 connects the hospital admin membership screen to a persisted member and invitation status reader.

The screen still preserves mock/browser fallback behavior, but it now calls `GET /api/workspaces/[workspaceId]/memberships` and can replace its active, pending, and inactive rows with server-provided status data.

## What Changed

- Added `GET /api/workspaces/[workspaceId]/memberships`.
- Added `src/features/auth/server-workspace-membership-status.ts`.
- Added local migration `supabase/migrations/20260518124000_workspace_member_status_reader.sql`.
- Updated `WorkspaceMembershipManagement` to fetch persisted member/invitation status rows.
- Added loading/error fallback text for the server read.
- Added focused route and UI regression coverage.

## Read Path

Route: `GET /api/workspaces/[workspaceId]/memberships`

Actor identity:

- Uses `readServerSession()`.
- Allows the demo actor header only in mock mode fallback.

Permission:

- Full status list is a hospital admin surface.
- Supabase mode uses `public.clair_list_workspace_member_statuses(...)`.
- The DB function treats this as a membership admin `role_permission:view` style read and gates it with the workspace admin helper.

UI behavior:

- If server rows are available, active/pending/inactive counts and rows come from the route.
- If the server read fails or returns an empty mock fallback, the existing browser-state display remains in place.

## Current Limitations

- Role/status mutation persistence remains DEN-49/DEN-50 scope.
- Real email delivery remains out of scope.
- Profile persistence remains DEN-52 scope.
- Remote Supabase validation remains approval-gated.

## Verification

- `npx playwright test tests/workspace-membership-status-server.spec.ts --reporter=line`
- `npx playwright test tests/workspace-membership-status-server.spec.ts tests/auth.spec.ts --reporter=line`
- `npx tsc --noEmit`
- `npx supabase db reset --local`
- Focused local SQL calls to `public.clair_list_workspace_member_statuses(...)`
- `npm run build`
