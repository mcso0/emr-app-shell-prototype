# AUTH-PR-020 DB-Backed Permission Adapter

Linear: DEN-38
Status: human_review
Area: auth
Priority: P0
Date: 2026-05-18

## Goal

Connect the server-only permission resolver contract to a DB-backed membership and permission policy adapter while preserving the existing resolver interface.

## Scope

- Preserve existing `WorkspacePermissionAdapter` resolver input.
- Add DB row mapping for users, memberships, and role permission policies.
- Add a narrow gateway boundary for future Supabase queries.
- Keep a server-only wrapper and a testable pure core.
- Maintain canonical MVP roles and additive permission union tests.
- Update auth status/current-status references.
- Create a Korean HTML closeout report and Linear handoff comment.

## Out Of Scope

- No role management UI live persistence.
- No business screen mutation connection.
- No permission policy product model change.
- No remote Supabase project mutation.
- No Project 02 work.

## Done When

- Server enforcement can use a DB-backed adapter instead of mock seed rows.
- Existing resolver contract tests remain green.
- DB adapter tests cover role filtering, DB permission union, and server-only wrapper boundary.
- DEN-38 is ready for Human Review.

## Verification

- Red: `npx playwright test tests/db-workspace-permission-adapter.spec.ts --reporter=line` failed because the adapter module did not exist.
- Red: direct `server-only` import failed in Node test runtime; adapter was split into pure core plus server-only wrapper.
- `npx playwright test tests/db-workspace-permission-adapter.spec.ts tests/permission-resolver.spec.ts --reporter=line`
- `npx tsc --noEmit`
- `npm run lint -- --ignore-pattern '.worktrees/**'`
- `npm run docs:check`

Result: passed on 2026-05-18.

## Handoff Notes

DEN-39 should use this adapter boundary when adding server/RLS cross-workspace regression. The actual Supabase client query implementation remains behind the gateway and should be validated in a Docker-capable local Supabase environment.
