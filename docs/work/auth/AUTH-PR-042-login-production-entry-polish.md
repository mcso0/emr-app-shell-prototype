# AUTH-PR-042 Login Production Entry Polish

Status: human_review  
Area: auth  
Priority: P1  
Target PR: Project 14 / DEN-277

## Goal

Polish the login page into a production-grade product entry surface while preserving the existing mock fallback, Supabase password login, invite OTP, password setup, and safe redirect behavior.

## Background

DEN-268 confirmed the invite-based onboarding loop: invite email OTP, password setup, invite acceptance, workspace entry, logout, and password login. The next step is visual and interaction quality for the `/login` entry point.

The reference direction is a quiet centered login card on a broad neutral canvas, with restrained input/button styling and clear secondary actions. CLAiR EMR should adapt that structure to its clinical operational design system rather than copying another product brand.

## Scope

- Rework `/login` default email/password state around a centered production login card.
- Keep invite OTP and invite password setup states inside the same visual system.
- Use an eight-slot OTP input pattern for invite email verification.
- Move mock role/session controls into a secondary development-only support area that does not compete with the product login flow.
- Preserve safe `next`, mock fallback, Supabase password login, invite OTP handoff, logout, and relogin behavior.
- Add focused regression coverage for visible login structure where useful.
- Produce a concise Korean closeout report with visual QA notes.

## Out Of Scope

- Google, social login, OAuth, or SSO provider rollout.
- Full password reset implementation.
- Email delivery policy changes.
- Supabase DB/RLS/migration changes.
- Production deploy.
- Real customer data, real customer email, secrets, OTP values, magic links, raw invite tokens, or password values.

## Source Docs

- `docs/agent-start-here.md`
- `docs/engineering/current-status.md`
- `docs/design/system/DESIGN.md`
- `docs/engineering/auth-security/auth-login/README.md`
- `docs/work/auth/AUTH-PR-041-invite-password-setup-returning-login.md`

## Done Criteria

- `/login` default state reads as a production login entry surface.
- `/login?reason=invite_email_otp...` remains usable and visually coherent.
- Existing auth and invite Playwright flows continue to pass.
- Desktop and mobile visual QA show no clipped text, major overflow, framework overlay, or obvious layout drift.
- Invite OTP visual QA shows eight OTP slots, one-time-code autocomplete, and paste-friendly input behavior.
- A Korean closeout is added under `docs/completed/`.

## Verification

- `npm run lint`
- `npx tsc --noEmit`
- focused auth/invite Playwright specs
- desktop and mobile rendered visual QA
- `npm run docs:check`
- `npm run security:secrets`
- `npm run build`

## Closeout

- `docs/completed/design/2026-05-24-den-277-login-production-entry-polish-report.html`

## Follow-up Notes

- 2026-07-07: Added a logo-only animated workspace entry loading screen for post-login route transition and protected workspace access checks. No auth provider, session, permission, Supabase, or redirect policy behavior was changed.
