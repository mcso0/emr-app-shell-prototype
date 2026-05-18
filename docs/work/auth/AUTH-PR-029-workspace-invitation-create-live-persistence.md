# AUTH-PR-029 Workspace Invitation Create Live Persistence

Linear: DEN-46
Status: human_review
Area: auth
Priority: P0
Date: 2026-05-18

## Goal

Persist hospital admin staff invitations through a server route and local-first Supabase transaction boundary.

## Scope

- Add an invitation create server route.
- Add a local-first DB RPC for pending workspace invitations.
- Require `role_permission:manage`.
- Normalize invited email and roles.
- Preserve mock/demo browser-state fallback.
- Add focused route, auth, and local DB verification.

## Out Of Scope

- No real email delivery.
- No public invite link delivery.
- No seat billing.
- No resend/cancel/accept persistence.
- No Project 03+ clinical persistence.
- No remote Supabase operations or secrets.

## Result

`POST /api/workspaces/[workspaceId]/invitations` now creates a pending invitation for an authorized workspace admin. In Supabase mode it uses `public.clair_create_workspace_invitation(...)`; in mock mode it returns a session-compatible invitation that the existing UI fallback can retain.

The DB function blocks duplicate pending invitations, non-admin actors, and existing active member email.

## Verification

- `npx playwright test tests/workspace-invitation-server.spec.ts tests/auth.spec.ts -g "workspace invitation|route-backed member invitations" --reporter=line`
- `npx playwright test tests/workspace-invitation-server.spec.ts tests/auth.spec.ts --reporter=line`
- `npx tsc --noEmit`
- `npx supabase db reset --local`
- Focused local SQL calls to `public.clair_create_workspace_invitation(...)`
- `npm run build`

Result: passed on 2026-05-18.

## Handoff Notes

Proceed to DEN-47 for persisted invitation resend, cancel, and accept lifecycle actions. Keep real email delivery and public invite links out of scope unless separately approved.
