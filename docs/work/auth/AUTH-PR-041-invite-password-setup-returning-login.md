# AUTH-PR-041 Invite Password Setup and Returning Login

Linear: DEN-268
Status: done
Area: auth
Priority: P0
Date: 2026-05-24

## Goal

Let invited staff verify the invited email, set a password, accept the workspace invitation, and later sign back in with email and password.

## Scope

- Add invite OTP password setup UI after the invited email verification step.
- Use Supabase Auth client password update after OTP verification without storing password material in app state beyond the form submit.
- Keep returning member login on the existing email/password login form.
- Add accepted-invite workspace entry guidance.
- Preserve mock/demo invite coverage.
- Update focused invite tests and auth handoff documentation.

## Out Of Scope

- No Google, social login, or SSO provider rollout.
- No production Supabase changes.
- No production deployment.
- No DB, RLS, or migration changes.
- No real customer email execution.
- No password logging or durable password storage in CLAiR app data.

## Done Criteria

- Invite OTP login in Supabase mode requires password setup before returning to the invite page.
- Returning users can continue to use the existing email/password login form.
- Accepted invite links point users toward the workspace/login path without duplicating memberships.
- Focused invite auth tests pass.
- TypeScript, lint, docs, and secret checks pass for the touched scope.

## Source Docs

- `docs/engineering/auth-security/auth-login/README.md`
- `docs/engineering/auth-security/auth-login/status.md`
- `docs/engineering/auth-security/auth-login/account-recovery-and-invite-account-policy.md`
- `docs/engineering/auth-security/auth-login/invite-acceptance-account-linking-screen.md`
- Supabase password-based Auth docs.

## Verification

- `npx playwright test tests/invite-otp-handoff.spec.ts tests/invite-acceptance.spec.ts --reporter=line`
- `npx tsc --noEmit`
- `npm run docs:check`
- `npm run lint`
- `npm run security:secrets`
- `git diff --check`

Result: passed on 2026-05-24. Focused Playwright verification used `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3218` to avoid reusing an unrelated local dev server.

Staging Preview smoke passed on 2026-05-24:

- Invite OTP request and verification completed with the invited test inbox.
- Password setup completed without recording password material.
- Invitation acceptance opened the `clair-demo` workspace.
- Staging DB check confirmed accepted invitation, app user, and active workspace membership.
- Logout followed by email/password login returned to the workspace.
- No production Supabase, production deploy, DB/RLS/migration, real customer mail, OTP, password, magic link, or raw invite token exposure.

Linear DEN-268 was accepted by 승욱 and moved to Done on 2026-05-24.

## Closeout

- `docs/completed/saas-launch/2026-05-24-den-268-invite-password-setup-login-report.html`
