# Workspace Role Status DB Persistence

Updated: 2026-05-18
Linear: DEN-50
Project: `02 Workspace & Membership Live Persistence`

## Summary

DEN-50 adds local-first DB transaction wrappers for role changes and membership status changes.

The public RPC wrappers call the existing private membership update helper, so the DB-level last active `hospital_admin` trigger remains the final safety guard.

## What Changed

- Added `PATCH /api/workspaces/[workspaceId]/memberships/[membershipId]/status`.
- Extended the role update route to call `public.clair_update_workspace_membership_roles(...)` in Supabase mode.
- Added `public.clair_update_workspace_membership_status(...)`.
- Updated deactivation UI to call the server status route before applying local fallback state.
- Added audit hook comments for future audit persistence.

## DB Guard

Both role and status wrappers use `private.update_workspace_membership_roles(...)`.

That helper updates `public.user_memberships`, and the existing `protect_last_active_hospital_admin` trigger blocks demotion or deactivation that would leave a workspace with no active `hospital_admin`.

## Current Limitations

- Audit persistence is not implemented yet.
- Role policy design is unchanged.
- Billing/seat enforcement is out of scope.
- Remote Supabase validation remains approval-gated.

## Verification

- `npx playwright test tests/workspace-role-status-write-server.spec.ts tests/auth.spec.ts tests/server-permission-enforcement.spec.ts tests/permission-resolver.spec.ts --reporter=line`
- `npx tsc --noEmit`
- `npx supabase db reset --local`
- Focused local SQL role update, status update, last-admin guard, and non-admin denial checks
- `npm run build`
