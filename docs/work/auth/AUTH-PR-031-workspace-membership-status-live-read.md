# AUTH-PR-031 Workspace Membership Status Live Read

Linear: DEN-48
Status: human_review
Area: auth
Priority: P0
Date: 2026-05-18

## Goal

Read persisted active, pending, and inactive member state in the hospital admin membership UI.

## Scope

- Add a member/invitation status reader route.
- Add a local-first DB reader RPC.
- Connect the UI list and counts to server-provided rows.
- Add loading/error fallback handling.
- Preserve mock/browser fallback behavior.

## Out Of Scope

- No role mutation write persistence.
- No member status mutation write persistence.
- No real email delivery.
- No profile edit persistence.
- No remote Supabase operations or secrets.

## Result

`GET /api/workspaces/[workspaceId]/memberships` now returns persisted memberships and invitations for the workspace admin view. The hospital admin UI can show active, pending, and inactive counts/list rows from that server response while keeping browser fallback for mock/demo mode.

## Verification

- `npx playwright test tests/workspace-membership-status-server.spec.ts --reporter=line`
- `npx playwright test tests/workspace-membership-status-server.spec.ts tests/auth.spec.ts --reporter=line`
- `npx tsc --noEmit`
- `npx supabase db reset --local`
- Focused local SQL status read checks
- `npm run build`

Result: passed on 2026-05-18.

## Handoff Notes

Proceed to DEN-49/DEN-50 for role/status mutation server enforcement and persistence. Keep real email delivery, profile persistence, and remote Supabase out of scope unless separately approved.
