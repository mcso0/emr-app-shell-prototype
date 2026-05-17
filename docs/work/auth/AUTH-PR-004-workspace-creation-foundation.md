# AUTH-PR-004 Workspace Creation Foundation

Status: human_review
Linear: DEN-23
Priority: P0

## Goal

Add a session-only workspace creation foundation where a subscribing hospital owner/admin can create a workspace and receive initial `hospital_admin` membership.

## Source Docs

- `docs/agent-start-here.md`
- `docs/engineering/current-status.md`
- `docs/product/domain/workspace-auth-permissions.md`
- `docs/engineering/auth-security/auth-login/workspace-membership-data-security-plan.md`
- `docs/engineering/auth-security/auth-login/status.md`
- Linear `DEN-23`

## Scope

- Add `/workspace/new` as the workspace onboarding entry point.
- Protect the onboarding page with the existing auth guard and preserve `next=/workspace/new`.
- Add session-only workspace creation state and contract helpers.
- Capture workspace name, representative/admin name, contact email, contact phone, and subscription placeholder status.
- Persist the created workspace and creator membership in browser storage matching mock auth storage mode.
- Assign the creator an active `hospital_admin` membership.
- Route the user into the newly created workspace home view.
- Display custom session workspace names in the app shell switcher.
- Add regression tests for guard, validation, creation, selection, and membership assignment.

## Out of Scope

- Real payment/subscription provider integration.
- Live Supabase persistence, migration SQL, or RLS SQL.
- Server-side permission enforcement.
- Invite/member management beyond the initial creator membership.
- Full organization billing settings.

## Done Criteria

- A representative hospital admin can create/select a workspace in the prototype flow.
- Initial creator receives active `hospital_admin` membership in the session contract.
- Existing login/auth and app-shell tests still pass.
- Linear `DEN-23` can move to Human Review.

## Verification

```bash
npm run lint -- --ignore-pattern '.worktrees/**'
npx tsc --noEmit
npm run build
npx playwright test tests/auth.spec.ts --reporter=line
npx playwright test tests/auth.spec.ts tests/app-shell.spec.ts --reporter=line
npm run docs:check
```

Results:

- `npm run lint -- --ignore-pattern '.worktrees/**'`: passed.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed after adding a Suspense boundary around `/workspace/new`.
- `npx playwright test tests/auth.spec.ts --reporter=line`: passed, `16 passed`.
- `npx playwright test tests/auth.spec.ts tests/app-shell.spec.ts --reporter=line`: passed, `46 passed`.
- `npm run docs:check`: passed.

## Notes

- This is still a session-only prototype. The workspace and membership are stored in browser storage, not Supabase.
- `hospital_admin` initial membership is a front-end contract fixture for the later server transaction/RLS work.
- Real subscription/payment state is represented only as a `trialing` placeholder.
