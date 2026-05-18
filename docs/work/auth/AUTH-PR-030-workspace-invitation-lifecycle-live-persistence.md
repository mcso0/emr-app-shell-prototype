# AUTH-PR-030 Workspace Invitation Lifecycle Live Persistence

Linear: DEN-47
Status: human_review
Area: auth
Priority: P0
Date: 2026-05-18

## Goal

Persist invitation resend, cancel, and accept state transitions through server routes and local-first Supabase transaction functions.

## Scope

- Add resend, cancel, and accept routes.
- Add DB functions for invitation lifecycle transitions.
- Require admin permission for resend/cancel.
- Require invited authenticated user matching email for Supabase accept.
- Preserve mock/demo fallback behavior.
- Add focused route, auth, and local DB verification.

## Out Of Scope

- No real email delivery.
- No external invite landing page.
- No billing seat enforcement.
- No persisted member status read UI.
- No remote Supabase operations or secrets.

## Result

Invitation lifecycle actions now have route-backed and DB-backed boundaries. Pending invitations can be resent, canceled, or accepted; invalid non-pending transitions are blocked. Accept creates or activates an active membership in the DB transaction path.

## Verification

- `npx playwright test tests/workspace-invitation-lifecycle-server.spec.ts tests/auth.spec.ts -g "invitation lifecycle|route-backed member invitations|pending invitations can be canceled" --reporter=line`
- `npx playwright test tests/workspace-invitation-lifecycle-server.spec.ts tests/workspace-invitation-server.spec.ts tests/auth.spec.ts --reporter=line`
- `npx tsc --noEmit`
- `npx supabase db reset --local`
- Focused local SQL lifecycle checks
- `npm run build`

Result: passed on 2026-05-18.

## Handoff Notes

Proceed to DEN-48 for persisted member and invitation status reads in the UI. Keep real email delivery and public invite landing pages out of scope unless separately approved.
