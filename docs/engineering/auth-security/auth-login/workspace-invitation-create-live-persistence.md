# Workspace Invitation Create Live Persistence

Updated: 2026-05-18
Linear: DEN-46
Project: `02 Workspace & Membership Live Persistence`

## Summary

DEN-46 moves staff invitation creation from session-only UI state toward a server-owned persistence boundary.

Hospital admins now create invitations through `POST /api/workspaces/[workspaceId]/invitations`. Mock/demo mode still keeps the browser-state fallback after the route response, while Supabase mode writes a pending invitation through a local-first DB transaction RPC.

## What Changed

- Added `src/app/api/workspaces/[workspaceId]/invitations/route.ts`.
- Added `src/features/auth/server-workspace-invitation.ts`.
- Added local migration `supabase/migrations/20260518122000_workspace_invitation_create_transaction.sql`.
- Updated `WorkspaceMembershipManagement` so `초대 만들기` calls the server route before updating local fallback state.
- Added focused server route and auth regression tests.

## Live Write Path

Route: `POST /api/workspaces/[workspaceId]/invitations`

Actor identity:

- Uses `readServerSession()`.
- Allows the demo actor header only in mock mode fallback.

Permission:

- Requires `role_permission:manage`.
- Mock fallback maps the hospital admin demo flow to a server-side admin actor.
- Supabase mode relies on the DB RPC and existing workspace admin helper.

Supabase mode:

- Calls `public.clair_create_workspace_invitation(...)`.
- Stores normalized email, invited roles, `invited_by_user_id`, `expires_at`, pending status, and optional title/department metadata.
- Blocks duplicate pending invitations and existing active member email.

Mock fallback:

- The route returns a session-compatible pending invitation.
- The UI stores that response in the existing browser workspace state so demo reload behavior remains intact.

## Current Limitations

- No real email delivery.
- No public invite link or token validation.
- Resend, cancel, and accept persistence remain DEN-47 scope.
- Member status read UI remains DEN-48 scope.
- Remote Supabase validation remains approval-gated.

## Verification

- `npx playwright test tests/workspace-invitation-server.spec.ts tests/auth.spec.ts -g "workspace invitation|route-backed member invitations" --reporter=line`
- `npx playwright test tests/workspace-invitation-server.spec.ts tests/auth.spec.ts --reporter=line`
- `npx tsc --noEmit`
- `npx supabase db reset --local`
- Focused local SQL calls to `public.clair_create_workspace_invitation(...)`
- `npm run build`
