# AUTH-PR-033 Workspace Role Status DB Persistence

Linear: DEN-50
Status: human_review
Area: auth
Priority: P0
Date: 2026-05-18

## Goal

Persist role changes and membership deactivation through DB-backed mutation paths with last-admin protection.

## Scope

- Add DB wrappers for role and status mutation.
- Add status mutation route.
- Connect deactivation UI to the server route.
- Preserve server and DB last active `hospital_admin` guards.
- Add audit hook comments for later audit persistence.

## Out Of Scope

- No full audit persistence implementation.
- No role policy redesign.
- No billing/seat logic.
- No remote Supabase operations or secrets.

## Result

Role changes and member status changes now have local-first DB transaction wrappers. Last active `hospital_admin` protection is enforced by the existing DB trigger and verified with focused SQL.

## Verification

- `npx playwright test tests/workspace-role-status-write-server.spec.ts tests/auth.spec.ts tests/server-permission-enforcement.spec.ts tests/permission-resolver.spec.ts --reporter=line`
- `npx tsc --noEmit`
- `npx supabase db reset --local`
- Focused local SQL mutation checks
- `npm run build`

Result: passed on 2026-05-18.
