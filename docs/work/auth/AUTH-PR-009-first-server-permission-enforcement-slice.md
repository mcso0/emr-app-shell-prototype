# AUTH-PR-009 First Server Permission Enforcement Slice

Status: human_review
Linear: DEN-21
Priority: P0

## Goal

Apply the existing server permission resolver to one narrow server boundary so role mutation requests are authorized before they would be persisted by a future backend.

## Source Docs

- `docs/agent-start-here.md`
- `docs/engineering/current-status.md`
- `docs/engineering/auth-security/mvp-auth-transition-roadmap.md`
- `docs/engineering/auth-security/auth-login/membership-permission-enforcement.md`
- `docs/work/auth/AUTH-PR-006-server-permission-resolver-contract.md`
- Linear `DEN-21`
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`

## Boundary Chosen

Role update route:

```text
POST /api/workspaces/[workspaceId]/memberships/[membershipId]/roles
```

This boundary was chosen because DEN-25 introduced session-only role editing. The first server enforcement slice should therefore protect the same high-risk mutation before broader backend conversion.

## Scope

- Add a Next.js Route Handler for role update authorization.
- Add a server-only enforcement module that calls the DEN-19 resolver.
- Require an authenticated actor id from a demo-only request header.
- Require active workspace membership.
- Require `role_permission:manage`.
- Validate canonical role input.
- Block demoting the last active `hospital_admin`.
- Return typed denial reasons and HTTP status codes for allowed and denied paths.
- Add focused Playwright API tests for allowed admin, unauthenticated, no membership, inactive membership, missing permission, invalid role input, and last-admin protection.

## Out of Scope

- Actual DB writes.
- Full backend conversion.
- Supabase session verification.
- Migration/RLS.
- Browser UI conversion to this route.
- OAuth/MFA/password/email flows.

## Important Caveat

The route currently uses `x-clair-demo-session-user-id` as a demo-only identity seam because the app does not yet have live server session validation. This is not a production authentication mechanism. The future Supabase-backed implementation must replace this header with verified server session claims before any real persistence is enabled.

## Done Criteria

- One server route calls the permission resolver before allowing a role update request.
- Tests prove allowed and denied paths.
- Docs and report do not claim full security coverage.
- Linear `DEN-21` can move to Human Review.

## Verification

```bash
npx playwright test tests/server-permission-enforcement.spec.ts --reporter=line
npm run lint -- --ignore-pattern '.worktrees/**'
npx tsc --noEmit
npm run build
npx playwright test tests/auth.spec.ts tests/permission-resolver.spec.ts tests/server-permission-enforcement.spec.ts --reporter=line
npm run docs:check
```

Results:

- Red: `npx playwright test tests/server-permission-enforcement.spec.ts --reporter=line` failed with 404 because the role update route did not exist.
- `npx playwright test tests/server-permission-enforcement.spec.ts --reporter=line`: passed, `4 passed`.
- `npx tsc --noEmit`: passed after tightening the API request helper type.
- `npm run lint -- --ignore-pattern '.worktrees/**'`: passed.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed.
- `npx playwright test tests/auth.spec.ts tests/permission-resolver.spec.ts tests/server-permission-enforcement.spec.ts --reporter=line`: passed, `36 passed`.
- `npm run docs:check`: passed, `549 docs/agent markdown files` checked.

## Notes

- This is an authorization boundary, not a persistence layer.
- DEN-25 client/session-only role edit UI remains unchanged.
- Future work should replace the demo header with Supabase verified session, then apply migration/RLS or route-backed mutation persistence.
