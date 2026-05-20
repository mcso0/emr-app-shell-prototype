# Login, Logout, and Stale Session UX

Updated: 2026-05-20
Linear: DEN-152
Initiative: `CLAiR EMR SaaS Launch Foundation`

## Purpose

This document records the login/logout/stale-session UX hardening for the SaaS launch runtime readiness phase. It keeps the existing mock/demo fallback intact while making auth state transitions clearer for users before staging/live work begins.

## UX Decision

The login screen now distinguishes three auth-state contexts:

| Context | URL signal | User-facing message | Behavior |
| --- | --- | --- | --- |
| Protected route without session | `reason=session_required` | `로그인이 필요하거나 세션이 만료되었습니다.` | Login preserves safe `next` and returns the user to the requested workspace route after login. |
| Logout completed | `reason=signed_out` | `안전하게 로그아웃되었습니다.` | User lands on `/login?reason=signed_out` and can start a new session. |
| Unauthorized placeholder | `reason=unauthorized` | `이 워크스페이스에 접근할 권한이 없습니다.` | The login screen can explain permission denial when a server/route later redirects with this reason. |

The current implementation does not add a new authorization redirect route. It adds the copy and rendering support so future server/route denials can reuse the same login-state surface.

## Safe Redirect Contract

The login flow continues to use `getSafeNextHref(...)`:

- Missing `next` returns the default MVP workspace route.
- External URLs are ignored.
- Protocol-relative URLs such as `//example.com` are ignored.
- `/login` redirects are ignored to avoid loops.
- Safe internal paths are preserved.

This follows the Next.js `useRouter()` guidance that untrusted or unsanitized URLs must not be passed to `router.push` or `router.replace`.

## Client Behavior

| Surface | Behavior |
| --- | --- |
| `AuthGate` | Redirects unauthenticated protected workspace access to `/login?next=<requested>&reason=session_required`. |
| `LoginForm` | Renders contextual status copy for `session_required`, `signed_out`, and `unauthorized`. |
| `TopMenu` | Redirects logout to `/login?reason=signed_out`. |
| `WorkspaceTabsBar` | Uses the same logout redirect behavior as `TopMenu`. |

## Mock/Staging Separation

- Mock/local demo role login is unchanged.
- Supabase runtime provider selection from DEN-151 is unchanged.
- This work does not create public signup, MFA, password reset, email invite delivery, remote Supabase operations, DB/RLS changes, production deploy, or role-policy changes.
- Staging/live still needs the DEN-150 approval gates and the DEN-151 runtime blockers before target-environment validation.

## Verification

- Red: `npx playwright test tests/auth.spec.ts -g "workspace routes require login|login ignores unsafe next|logout clears mock session" --reporter=line`
- Green: `npx playwright test tests/auth.spec.ts -g "workspace routes require login|login ignores unsafe next|logout clears mock session" --reporter=line`
- `npx playwright test tests/auth.spec.ts tests/app-shell.spec.ts --reporter=line` (`60 passed`)
- `npm run lint` (passed with existing warnings only)
- `npx tsc --noEmit`
- `npm run docs:check`
- `npm run build`
- `npm run security:secrets`
- `git diff --check`
