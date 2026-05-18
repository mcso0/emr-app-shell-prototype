# Workspace Creation Live Persistence

Updated: 2026-05-18
Linear: DEN-44
Project: `02 Workspace & Membership Live Persistence`

## Summary

DEN-44 moves `/workspace/new` from a purely session-only creation helper to a server route boundary.

The UI now submits workspace creation to `POST /api/workspaces`. In mock/local fallback mode, the route returns the same session-compatible workspace and creator membership shape so existing demo flows remain stable. In Supabase mode, the route calls a local-first DB transaction RPC that creates the workspace and creator active `hospital_admin` membership without using service-role credentials.

## What Changed

- Added `POST /api/workspaces`.
- Added `src/features/auth/server-workspace-creation.ts`.
- Added local migration `supabase/migrations/20260518120000_workspace_creation_transaction.sql`.
- Updated `/workspace/new` to call the server route before updating browser-side temporary workspace state.
- Added focused route and UI regression coverage.

## Server Route Behavior

Route: `POST /api/workspaces`

Actor identity:

- Uses `readServerSession()`.
- Allows `x-clair-demo-session-user-id` only in mock mode fallback.
- Does not trust browser storage as an authorization source.

Input:

- `hospitalName`
- `adminDisplayName`
- `contactEmail`
- `contactPhone`

Success:

- Returns the created workspace.
- Returns the creator membership with `roles: ["hospital_admin"]` and `status: "active"`.
- Uses `201`.

Denials:

- `401 unauthenticated`
- `400 invalid_input`
- `409 duplicate_workspace`
- `500 db_write_failed` for unexpected DB/RPC failures

## DB Transaction Boundary

Function: `public.clair_create_workspace_with_creator(...)`

The function:

- Requires `auth.uid()`.
- Upserts the creator app-domain `users` row for the verified user.
- Inserts `workspaces`.
- Inserts creator `user_memberships` with active `hospital_admin`.
- Returns a JSON shape compatible with the UI workspace state.
- Blocks duplicate workspace ids.

Credential boundary:

- No remote Supabase operation was performed.
- No secret/service-role key was added or used.
- The function grants execute to `authenticated`, not `anon`.

## Current Limitations

- Workspace selector still reads the temporary browser workspace state after route success. DEN-45 will move selector/shell context to persisted membership reads.
- Real subscription/payment provider data is still out of scope.
- Staff invitations and role management live writes are still later Project 02 issues.
- Remote Supabase validation remains approval-gated.

## Verification

- `npx playwright test tests/workspace-creation-server.spec.ts --reporter=line`
- `npx playwright test tests/auth.spec.ts -g "route-backed workspace" --reporter=line`
- `npx playwright test tests/workspace-creation-server.spec.ts tests/auth.spec.ts -g "route-backed workspace|workspace creation server" --reporter=line`
- `npx tsc --noEmit`
- `npx supabase db reset --local`
- Focused local SQL call to `public.clair_create_workspace_with_creator(...)`
- Focused local SQL duplicate workspace guard check
- `npm run build`
