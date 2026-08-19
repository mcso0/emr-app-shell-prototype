# Workspace Membership List Live Read

Updated: 2026-05-18
Linear: DEN-45
Project: `02 Workspace & Membership Live Persistence`

## Summary

DEN-45 adds a persisted membership-backed workspace list reader for shell workspace context.

The top menu and navigation-column workspace switcher still preserve browser-state fallback for mock/demo flows, but they now also query `GET /api/workspaces`. In Supabase mode, that route uses a local-first DB reader RPC to return active workspaces for the verified user based on active persisted memberships.

## What Changed

- Extended `src/app/api/workspaces/route.ts` with `GET`.
- Added `src/features/auth/server-workspace-list.ts`.
- Added local migration `supabase/migrations/20260518121000_workspace_membership_list_reader.sql`.
- Updated `useSessionWorkspaceDisplayName()` to read persisted workspace display names from the server list.
- Added focused server and app-shell regression coverage.

## Live Read Path

Route: `GET /api/workspaces`

Actor identity:

- Uses `readServerSession()`.
- Allows the demo actor header only in mock mode fallback.

Supabase mode:

- Calls `public.clair_list_active_workspaces_for_current_user()`.
- The function uses `auth.uid()` and returns only active workspace memberships for active app users and active workspaces.

Mock fallback:

- Returns an empty server list.
- Existing browser workspace state remains the fallback source for demo-created workspaces.

## Current Limitations

- AUTH-PR-045 connects the App Shell switcher to this active-membership list and provides safe route-backed workspace navigation. The switcher keeps only layout state and does not carry tenant-scoped patient, encounter, order, invoice, or drawer identifiers into the target workspace.
- Public workspace discovery, self-service join requests, and a pending-invitation inbox remain separate invite-only product and security work.
- DEN-46 through DEN-48 will add invitation and member status persistence.
- No clinical/domain workspace data is read in this route.
- Remote Supabase validation remains approval-gated.

## Verification

- `npx playwright test tests/workspace-list-server.spec.ts tests/app-shell.spec.ts -g "workspace list|persisted workspace display" --reporter=line`
- `npx playwright test tests/workspace-list-server.spec.ts tests/app-shell.spec.ts tests/auth.spec.ts -g "workspace list|persisted workspace display|route-backed workspace" --reporter=line`
- `npx tsc --noEmit`
- `npx supabase db reset --local`
- Focused local SQL calls to `public.clair_list_active_workspaces_for_current_user()`
- `npm run build`
