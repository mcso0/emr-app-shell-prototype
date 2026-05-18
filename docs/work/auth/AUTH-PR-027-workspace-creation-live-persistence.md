# AUTH-PR-027 Workspace Creation Live Persistence

Linear: DEN-44
Status: human_review
Area: auth
Priority: P0
Date: 2026-05-18

## Goal

Persist `/workspace/new` workspace creation through a server route and create the creator as an active `hospital_admin` membership.

## Scope

- Add workspace creation server route.
- Add local-first DB transaction RPC for workspace plus creator membership creation.
- Keep mock fallback behavior for local/demo tests.
- Update onboarding UI to call the server route before navigating to the new workspace.
- Add focused route/UI tests and run required verification.

## Out Of Scope

- No remote Supabase link, push, SQL execution, or dashboard mutation.
- No secret/service-role key or DB password use.
- No subscription/payment provider integration.
- No staff invitation persistence.
- No role management UI conversion.
- No Project 03+ clinical persistence.

## Result

`/workspace/new` now calls `POST /api/workspaces`.

Mock fallback still returns a session-compatible workspace state. Supabase mode uses `public.clair_create_workspace_with_creator(...)` to create the workspace and creator active `hospital_admin` membership through a DB transaction boundary.

## Verification

- `npx playwright test tests/workspace-creation-server.spec.ts --reporter=line`
- `npx playwright test tests/auth.spec.ts -g "route-backed workspace" --reporter=line`
- `npx playwright test tests/workspace-creation-server.spec.ts tests/auth.spec.ts -g "route-backed workspace|workspace creation server" --reporter=line`
- `npx tsc --noEmit`
- `npx supabase db reset --local`
- Focused local SQL call to `public.clair_create_workspace_with_creator(...)`
- Focused local SQL duplicate workspace guard check
- `npm run build`

Result: passed on 2026-05-18.

## Handoff Notes

Proceed to DEN-45. Workspace selector and shell context still use temporary browser workspace state after successful creation and should be moved to persisted membership reads next.
