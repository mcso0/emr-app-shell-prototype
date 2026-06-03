# AUTH-PR-043 Invite Link Password Onboarding Implementation

Linear: DEN-278
Status: in review
Area: auth
Priority: P1
Target PR: Project 14 / DEN-278

## Goal

Implement the confirmed invite-link onboarding prototype as production-shaped app UI: the invite link establishes the invite context, then the app shows one state-specific screen for password setup, existing-account login, or blocked invite recovery.

## Scope

- Replace the invite page OTP-first pending copy with invite-link password onboarding UI.
- Keep the prototype-only state tabs out of production UI.
- Use reusable auth/invite UI components rather than hardcoded duplicated card markup.
- Add client validation for password setup and existing-account login.
- Add server/API validation for blocked-invite admin re-request feedback.
- Preserve mock/local invite acceptance and safe workspace redirect behavior.
- Preserve Supabase guardrails without changing production Supabase, DB/RLS, migrations, or email delivery.
- Update focused invite tests and source docs.

## Out Of Scope

- Production Supabase changes.
- DB/RLS/migration changes.
- Real customer email delivery or notification delivery.
- Google, social login, SSO, or MFA rollout.
- Raw invite token, magic link, OTP, password, or secret exposure.

## Done Criteria

- Pending new invite renders password setup with `워크스페이스로 이동` CTA disabled until password validation passes.
- Pending existing-account invite renders login with `로그인` CTA disabled until password is entered.
- Expired/canceled invite renders `관리자에게 재요청` with success/failure dialog feedback from a validated route.
- Accepted invite still offers workspace entry without duplicate membership creation.
- UI derives email, role, workspace, date, and route values from invite/account state.
- Tests cover state rendering, CTA validation, and admin re-request success/failure.
- Verification passes: focused Playwright/tests, `npx tsc --noEmit`, `npm run lint`, `npm run docs:check`, `npm run security:secrets`, `git diff --check`.

## Source Docs

- `docs/agent-start-here.md`
- `docs/engineering/current-status.md`
- `docs/engineering/auth-security/auth-login/README.md`
- `docs/engineering/auth-security/auth-login/invite-acceptance-account-linking-screen.md`
- `docs/design/flows/invite-link-password-onboarding-ui-prototype.html`
- `docs/work/auth/AUTH-PR-041-invite-password-setup-returning-login.md`
- `docs/work/auth/AUTH-PR-042-login-production-entry-polish.md`

## Verification

- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3221 npx playwright test tests/invite-acceptance.spec.ts --reporter=line` (`7 passed`).
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3222 npx playwright test tests/invite-onboarding-regression-handoff.spec.ts tests/last-admin-role-change-launch-safety.spec.ts --reporter=line` (`6 passed`).
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3223 npx playwright test tests/invite-otp-handoff.spec.ts --reporter=line` (`4 passed`).
- `npx tsc --noEmit` passed.
- `npm run lint` passed with existing warning count unchanged at 5.
- `npm run docs:check` passed.
- `npm run security:secrets` passed.
- `git diff --check` passed.
- `npm run build` passed.

## Final Audit - 2026-06-03

- Status sync: `docs/work/index.md` now matches `DEN-278` / this work item as `human_review`; no new Linear project or issue is needed.
- Fresh verification:
  - `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 npx playwright test tests/invite-acceptance.spec.ts --reporter=line` (`7 passed`) after one transient dev-server chunk timeout was retried and passed.
  - `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 npx playwright test tests/invite-onboarding-regression-handoff.spec.ts tests/invite-otp-handoff.spec.ts --reporter=line` (`6 passed`).
  - `npx tsc --noEmit` passed.
  - `npm run lint` passed with 4 existing warnings and 0 errors.
  - `npm run docs:check` passed.
  - `npm run security:secrets` passed.
  - `git diff --check` passed.
  - `npm run build` passed.
- Visual QA evidence:
  - `docs/completed/auth/2026-06-03-den-278-visual-01-pending-new-desktop.png`
  - `docs/completed/auth/2026-06-03-den-278-visual-02-pending-existing-desktop.png`
  - `docs/completed/auth/2026-06-03-den-278-visual-03-expired-desktop.png`
  - `docs/completed/auth/2026-06-03-den-278-visual-04-accepted-desktop.png`
  - `docs/completed/auth/2026-06-03-den-278-visual-05-missing-desktop.png`
  - `docs/completed/auth/2026-06-03-den-278-visual-06-pending-new-mobile.png`
- Closeout: `docs/completed/auth/2026-06-03-den-278-final-audit-report.html`.
