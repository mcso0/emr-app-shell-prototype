# Auth Runtime Mode and Session Contract

Updated: 2026-05-20
Linear: DEN-151
Initiative: `CLAiR EMR SaaS Launch Foundation`

## Purpose

This document fixes the runtime behavior for CLAiR EMR auth mode selection before SaaS launch work continues. It separates local/mock fallback from Supabase Auth runtime behavior and records what is currently verified by tests.

## Decision

The app keeps two explicit auth runtime paths:

- **Mock/local demo path** for deterministic local development, portfolio demo, and Playwright regression.
- **Supabase Auth path** for configured runtime environments where Supabase Auth is the identity/session source.

`NEXT_PUBLIC_AUTH_MODE` controls which path is used. Supabase Auth is identity/session only; workspace membership and permissions still come from app-controlled workspace tables and server/DB enforcement.

## Next.js Environment Note

Next.js inlines `NEXT_PUBLIC_` environment variables into browser code at build time. Runtime mode values must therefore be correct when the app is built for the target environment. `.env*` files are loaded only from the project root, not from `src/`.

Source checked:

- `node_modules/next/dist/docs/01-app/02-guides/environment-variables.md`

## Runtime Mode Table

| `NEXT_PUBLIC_AUTH_MODE` | Supabase public env | Client provider | Client session source | Server session source | Missing config behavior | Launch meaning |
| --- | --- | --- | --- | --- | --- | --- |
| `mock` | Missing or present | Mock | Browser mock storage | Mock fallback only | None | Local/demo regression path. Never proves live auth readiness. |
| `auto` or unset | Missing | Mock | Browser mock storage | Mock fallback only | `auto_mock_fallback` | Safe local default. Does not silently attempt Supabase. |
| `auto` or unset | Present | Supabase | Supabase cookie/session via browser client | Supabase `auth.getClaims()` | None | Runtime switches to Supabase identity path. Needs staging/live gate before remote use. |
| `supabase` | Missing | Supabase | Supabase cookie/session expected | Supabase claims expected | `supabase_configuration_error` / server `supabase_env_missing` | Safe failure. No mock fallback should be treated as live auth. |
| `supabase` | Present | Supabase | Supabase cookie/session via browser client | Supabase `auth.getClaims()` | None | Intended configured runtime path. |
| Invalid value | Missing | Mock via `auto` fallback | Browser mock storage | Mock fallback only | `auto_mock_fallback` | Invalid mode is normalized to `auto`. |

Supabase public env means both values are present:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

## Client Contract

Client auth runs through `useAuthClient()`.

Rules:

- `useAuthClient()` uses `getAuthRuntimeMode()` for provider selection.
- Mock mode uses `sessionStorage` or `localStorage` only for local/demo session state.
- Supabase mode uses `getBrowserSupabaseClient()` and `auth.getUser()` for hydrate.
- Supabase login uses `auth.signInWithPassword()`.
- Supabase logout uses `auth.signOut({ scope: "local" })`.
- Missing Supabase config in explicit `supabase` mode surfaces a safe login error instead of creating a mock session.
- Client `AuthGate` is still UX routing only. It does not replace server session validation or permission checks.

## Server Contract

Server auth runs through `readServerSession()`.

Rules:

- Server session reader uses Supabase `auth.getClaims()` when Supabase runtime is active.
- Server code must not trust browser storage, role labels, query params, or user-editable metadata as authentication source.
- Server code must not use `auth.getSession()` alone for sensitive authorization.
- `mock` and `auto` without Supabase public env return `mock_fallback` status so demo headers remain restricted to mock-mode code paths.
- Explicit `supabase` mode without public env returns a misconfigured result.
- Missing Supabase session returns a typed unauthenticated denial.

## Verified Coverage

DEN-151 added and re-ran coverage for:

- `mock` mode with Supabase env present still choosing the mock provider.
- `auto` mode without Supabase env staying in mock fallback.
- `auto` mode with Supabase env switching to Supabase client/server session sources.
- Explicit `supabase` mode without env staying in Supabase provider mode but reporting configuration error.
- Invalid auth mode normalizing to `auto`.

Existing coverage continues to verify:

- `/login` and workspace routes preserve safe `next`.
- Login/logout mock regression stays deterministic.
- Playwright auth regression pins `NEXT_PUBLIC_AUTH_MODE=mock`.
- Client `AuthGate` uses `useAuthClient()` and does not call `readServerSession()`.
- Server role mutation route reads actor identity through `readServerSession()`.
- Supabase missing session denies demo headers in Supabase mode.
- Server session reader maps missing session and malformed claims to typed denials.

## Remaining Staging/Live Blockers

Before staging/live runtime can be considered ready:

1. Representative approval through `docs/engineering/auth-security/auth-login/saas-launch-approval-gates.md`.
2. Real target Supabase project, public env, and secret handling path approved.
3. Staging build made with the correct `NEXT_PUBLIC_` values.
4. Password reset/account recovery policy confirmed.
5. Invite acceptance public route and account-linking behavior completed.
6. Workspace membership and tenant approval routes verified against the target environment.
7. Shared production rate-limit store selected before multi-instance production.
8. Request id/safe logging helper applied to affected launch routes.
9. Supabase advisor/RPC review completed before remote DB/RLS changes.
10. Production log redaction rules confirmed before external monitoring/logging.

## Out Of Scope

- Public self-signup.
- Email invite delivery.
- Remote Supabase link/push/SQL/dashboard mutation.
- DB migration or RLS policy changes.
- Production deploy.
- Password reset implementation.
- OAuth, MFA, magic link, email OTP, SSO, SCIM.
- Role/permission product policy changes.
- Real clinic, staff, guardian, patient, billing, or clinical data.

## Verification Commands

- Red: `npx playwright test tests/auth.spec.ts -g "auth runtime mode matrix" --reporter=line`
- Green: `npx playwright test tests/auth.spec.ts -g "auth runtime mode matrix" --reporter=line`
- `npm run lint` (passed with existing warnings only)
- `npx tsc --noEmit`
- `npx playwright test tests/auth.spec.ts tests/server-session-reader.spec.ts --reporter=line` (`34 passed`)
- `npm run docs:check`
- `npm run build`
- `npm run security:secrets`
