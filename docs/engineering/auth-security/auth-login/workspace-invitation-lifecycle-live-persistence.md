# Workspace Invitation Lifecycle Live Persistence

Updated: 2026-05-18
Linear: DEN-47
Project: `02 Workspace & Membership Live Persistence`

## Summary

DEN-47 connects invitation resend, cancel, and accept actions to server routes and local-first Supabase transaction functions.

Mock/demo UI still updates the existing browser fallback state after each route succeeds. Supabase mode persists lifecycle transitions through DB functions.

## What Changed

- Added `POST /api/workspaces/[workspaceId]/invitations/[invitationId]/resend`.
- Added `POST /api/workspaces/[workspaceId]/invitations/[invitationId]/cancel`.
- Added `POST /api/workspaces/[workspaceId]/invitations/[invitationId]/accept`.
- Added `src/features/auth/server-workspace-invitation-lifecycle.ts`.
- Added local migration `supabase/migrations/20260518123000_workspace_invitation_lifecycle_transactions.sql`.
- Updated invitation action buttons to call server routes before applying mock/browser fallback state.
- Added focused lifecycle route tests and auth regression coverage.

## State Machine

Pending invitations support:

- `resend`: keeps status `pending`, updates `resent_at`, increments `resend_count`, and extends expiry.
- `cancel`: changes status from `pending` to `canceled`.
- `accept`: changes status from `pending` to `accepted` and creates or activates the invited user's membership.

Invalid lifecycle transitions are blocked with `invitation_not_pending`.

## Permission And Identity

- Resend and cancel require `role_permission:manage`.
- Accept requires an authenticated invited user with matching email in Supabase mode.
- Mock/demo accept remains a local simulation path for the current membership UI until public invite landing pages are approved.

## Current Limitations

- No real email delivery.
- No public invite landing page.
- No billing seat enforcement.
- Persisted member status list/read UI remains DEN-48 scope.
- Remote Supabase validation remains approval-gated.

## Verification

- `npx playwright test tests/workspace-invitation-lifecycle-server.spec.ts tests/auth.spec.ts -g "invitation lifecycle|route-backed member invitations|pending invitations can be canceled" --reporter=line`
- `npx playwright test tests/workspace-invitation-lifecycle-server.spec.ts tests/workspace-invitation-server.spec.ts tests/auth.spec.ts --reporter=line`
- `npx tsc --noEmit`
- `npx supabase db reset --local`
- Focused local SQL calls to `public.clair_resend_workspace_invitation(...)`, `public.clair_cancel_workspace_invitation(...)`, and `public.clair_accept_workspace_invitation(...)`
- `npm run build`
