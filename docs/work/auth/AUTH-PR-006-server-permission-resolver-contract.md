# AUTH-PR-006 Server Permission Resolver Contract

Status: human_review
Linear: DEN-19
Priority: P0

## Goal

Implement a server-only workspace role and permission resolver contract without DB migration, RLS SQL, or live Supabase validation.

## Source Docs

- `docs/agent-start-here.md`
- `docs/engineering/current-status.md`
- `docs/product/domain/workspace-auth-permissions.md`
- `docs/engineering/auth-security/auth-login/membership-permission-enforcement.md`
- `docs/engineering/auth-security/auth-login/status.md`
- Linear `DEN-19`
- `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`
- `node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-server.md`

## Scope

- Add a typed workspace permission resolver contract for server-side use.
- Add a server-only entrypoint marked with `import "server-only"`.
- Add a mock adapter for users, workspace memberships, canonical roles, membership status, and permission result calculation.
- Support canonical MVP roles: `hospital_admin`, `vet`, `technician`, and `front_desk`.
- Calculate multi-role permissions as an additive union.
- Treat `hospital_admin` as full workspace/admin access.
- Return assigned roles and effective permission IDs for explainability.
- Return typed denial reasons for unauthenticated, inactive user, missing membership, inactive membership, missing permission, and last-admin-protected actions.
- Add helper functions for view/create/update checks.
- Add focused contract tests.

## Out of Scope

- Supabase migration SQL.
- RLS policy SQL.
- Live Supabase DB adapter.
- API Route Handler or Server Action enforcement.
- Business screen redesign.
- Client-only permission gating as security completion.

## Done Criteria

- Permission resolution is deterministic and typed.
- Technician and front desk roles can view charts but cannot update charts.
- Vet can update charts but cannot manage role permissions.
- Multi-role users receive an additive permission union without implicit admin escalation.
- Last active `hospital_admin` demotion/deactivation is blocked by the contract helper.
- Linear `DEN-19` can move to Human Review.

## Verification

```bash
npx playwright test tests/permission-resolver.spec.ts --reporter=line
npm run lint -- --ignore-pattern '.worktrees/**'
npx tsc --noEmit
npm run build
npx playwright test tests/auth.spec.ts tests/permission-resolver.spec.ts --reporter=line
npm run docs:check
```

Results:

- Red: `npx playwright test tests/permission-resolver.spec.ts --reporter=line` failed because `src/features/auth/permission-resolver` did not exist.
- `npx playwright test tests/permission-resolver.spec.ts --reporter=line`: passed, `6 passed`.
- `npm run lint -- --ignore-pattern '.worktrees/**'`: passed.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed.
- `npx playwright test tests/auth.spec.ts tests/permission-resolver.spec.ts --reporter=line`: passed, `26 passed`.
- `npm run docs:check`: passed, `546 docs/agent markdown files` checked.

## Notes

- The implementation remains a contract layer over mock/demo data. It does not query Supabase.
- `src/features/auth/permission-resolver.server.ts` is the server-only entrypoint; tests exercise the pure contract module and assert that the server entrypoint carries the marker.
- Future API routes, server actions, and RLS policies should call or mirror this contract instead of trusting browser session storage or user-editable metadata.
