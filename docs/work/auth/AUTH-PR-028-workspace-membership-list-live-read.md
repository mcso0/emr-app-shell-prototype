# AUTH-PR-028 Workspace Membership List Live Read

Linear: DEN-45
Status: human_review
Area: auth
Priority: P0
Date: 2026-05-18

## Goal

Load top menu workspace selector and shell workspace context from persisted active memberships while preserving mock fallback behavior.

## Scope

- Add a membership-backed workspace list server route.
- Add a local-first DB reader RPC.
- Connect workspace display name lookup to the server list.
- Preserve browser-state fallback for mock/demo workspace flows.
- Add focused route and app-shell regression tests.

## Out Of Scope

- No workspace creation form changes.
- No role editing.
- No invitation persistence.
- No cross-module clinical persistence.
- No remote Supabase operations or secrets.

## Result

`GET /api/workspaces` now returns active workspaces for the verified user in Supabase mode. The shell workspace switcher can use this server list to display a persisted workspace name after reload or direct navigation, while local mock workspaces continue to work through browser-state fallback.

## Verification

- `npx playwright test tests/workspace-list-server.spec.ts tests/app-shell.spec.ts -g "workspace list|persisted workspace display" --reporter=line`
- `npx playwright test tests/workspace-list-server.spec.ts tests/app-shell.spec.ts tests/auth.spec.ts -g "workspace list|persisted workspace display|route-backed workspace" --reporter=line`
- `npx tsc --noEmit`
- `npx supabase db reset --local`
- Focused local SQL calls to `public.clair_list_active_workspaces_for_current_user()`
- `npm run build`

Result: passed on 2026-05-18.

## Handoff Notes

Proceed to DEN-46 for invitation create persistence. Workspace list read is now available as a server route and local DB reader boundary.
