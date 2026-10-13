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
- `docs/completed/design/2026-10-14-login-figma-application-report.md` (approved local Figma/OTP/recovery follow-up; phone verification pending vendor)

## Follow-up Notes

- 2026-10-14 approved local follow-up: apply the reviewed Figma/HTML login design; preserve password login, invite OTP/password setup, safe redirects, membership checks, and entry splash. Enable login on a valid email and a nonempty password; connect ordinary email OTP for existing accounts and restyle the existing password recovery flow. No provider policy, remote config, schema/RLS, production, or real email/SMS actions are authorized.
- Local verification uses synthetic auth responses and isolated browser storage only. The source checkout's unrelated WIP is preserved in a separate managed worktree.
- Dependency confirmed by 승욱: no phone identity verification vendor is selected. 아이디 찾기 must show an explicit unavailable state; editable contact phone numbers are not identity proof. SMS delivery and account lookup require a separately scoped provider integration. Do not simulate successful verification in the product.

- 2026-07-07: Added a logo-only animated workspace entry loading screen for post-login route transition and protected workspace access checks. No auth provider, session, permission, Supabase, or redirect policy behavior was changed.

- 2026-10-14 evidence: 45 unique relevant tests passed (22 existing auth/invite/recovery, 2 input/redirect, 14 synthetic-provider integration, 7 Storybook). Three stale demo-data/default-route expectations also fail on base `513143f9`; preserve them as unrelated findings. Lint, TypeScript, build, docs, secrets, UX copy and diff checks pass. Built app visual QA confirms 440×548 at x740/y266 with 376px inputs and responsive entry screens. Hosted numeric OTP mail/redirect config and real delivery remain unverified. No main merge or deployment.

## Production release preparation (2026-10-14)

승욱 explicitly requested hosted authentication configuration inspection, a PR, origin/main merge and deployment, preserving password/invite authentication and leaving 아이디 찾기 unavailable. This authorizes release preparation; the exact candidate gate remains in release-deployment-ops. No identity records or mail/SMS are in the inspection scope.

- Production and Preview both use Supabase Auth with the same configured project. Hosted email OTP length is 8, expiry is 3600 seconds, SMTP is configured, and both new-user Confirmation and existing-user Magic Link templates contain numeric Token. The recovery template uses provider ConfirmationURL, preserving PKCE recovery.
- Align ordinary OTP and local email OTP configuration to the observed hosted 8-digit contract. Keep signed recent recovery AMR checks and existing invitation guards.
- Auth URL issue: Site URL still points to localhost; the canonical Production origin only explicitly allowlists the recovery callback. A two-field URL proposal preserves every existing entry and adds ordinary OTP and invite callback paths and their query forms. Remote configuration changes require target-specific approval.

- Existing hosted email controls are unchanged: minimum send interval 60 seconds and project email rate limit 2/hour. This is a real operating constraint for OTP/invitation/recovery traffic, not proof of production mail delivery. Increasing limits or sending real mail requires separate scope.
