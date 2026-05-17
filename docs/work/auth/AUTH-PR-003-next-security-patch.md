# AUTH-PR-003 Next.js Security Patch

Status: human_review
Linear: DEN-28
Priority: P0

## Goal

Patch the Next.js security release before workspace creation and server enforcement work depend on the proxy/middleware layer.

## Source Docs

- `docs/agent-start-here.md`
- `docs/engineering/current-status.md`
- `docs/engineering/auth-security/auth-login/status.md`
- `docs/engineering/auth-security/auth-login/workspace-membership-data-security-plan.md`
- `.gstack/security-reports/20260517-161848-cso-auth-scope.json`
- Linear `DEN-28`

## Scope

- Update `next` from `16.2.4` to `16.2.6`.
- Update `eslint-config-next` from `16.2.4` to `16.2.6`.
- Regenerate `package-lock.json` through npm.
- Verify audit, lint, typecheck, build, auth, and app-shell regressions.
- Keep this patch separate from workspace creation implementation.

## Out of Scope

- Workspace creation implementation.
- Permission resolver implementation.
- Migration SQL or RLS SQL.
- Supabase live validation.
- Broad dependency upgrades beyond the Next.js security patch.

## Done Criteria

- `package.json` and `package-lock.json` pin `next@16.2.6`.
- `package.json` and `package-lock.json` pin `eslint-config-next@16.2.6`.
- `npm audit --audit-level=high` reports no vulnerabilities.
- Auth and app-shell regression tests pass.
- Linear `DEN-28` can move to Human Review.

## Verification

```bash
npm audit --audit-level=high
npm run lint -- --ignore-pattern '.worktrees/**'
npx tsc --noEmit
npm run build
npx playwright test tests/auth.spec.ts tests/app-shell.spec.ts --reporter=line
npm run docs:check
```

Results:

- `npm audit --audit-level=high`: passed, `found 0 vulnerabilities`.
- `npm run lint -- --ignore-pattern '.worktrees/**'`: passed.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed with Next.js `16.2.6`.
- `npx playwright test tests/auth.spec.ts tests/app-shell.spec.ts --reporter=line`: passed, `41 passed`.
- `npm run docs:check`: passed.

## Notes

- `npm install --save-exact next@16.2.6 eslint-config-next@16.2.6` emitted an `EBADENGINE` warning because local Node `v23.11.0` is outside `eslint-visitor-keys@5.0.1` supported range (`^20.19.0 || ^22.13.0 || >=24`). Verification still passed. Use Node 22 LTS or Node 24+ for a clean install environment.
- Existing Playwright output still includes non-blocking `NO_COLOR`/`FORCE_COLOR` and Tiptap duplicate extension warnings. They predate this patch and did not fail the regression suite.
