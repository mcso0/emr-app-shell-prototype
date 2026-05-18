# AUTH-PR-032 Workspace Role Edit Server Enforcement UI

Linear: DEN-49
Status: human_review
Area: auth
Priority: P0
Date: 2026-05-18

## Goal

Route role edit UI submission through server permission enforcement before applying the local UI mutation.

## Scope

- Call the existing role update server route from the role edit confirmation flow.
- Add pending/error UX for server checks.
- Keep session/mock state update only after server success.
- Preserve server permission regression tests.

## Out Of Scope

- No DB role write persistence.
- No new role policy design.
- No invitation flow changes.
- No profile persistence.
- No remote Supabase operations or secrets.

## Result

The role edit UI now requires a successful server enforcement route response before local state changes are applied. DB persistence is intentionally left for DEN-50.

## Verification

- `npx playwright test tests/auth.spec.ts tests/server-permission-enforcement.spec.ts -g "edit active member roles|role update server" --reporter=line`
- `npx tsc --noEmit`
- `npm run build`

Result: passed on 2026-05-18.
