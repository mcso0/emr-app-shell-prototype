# AUTH-PR-013 Server-Side Supabase Session Reader Contract

Linear: DEN-31
Status: human_review
Area: auth
Priority: P0
Date: 2026-05-18

## Goal

Add a server-only Supabase session reader contract that can identify the current authenticated Supabase user without browser storage.

## Scope

- Read the relevant Next.js server/cookies and route handler docs before coding.
- Add a typed server session result contract for authenticated, mock fallback, unauthenticated, misconfigured, and error states.
- Use Supabase `auth.getClaims()` from the server client entrypoint.
- Preserve mock fallback behavior for `NEXT_PUBLIC_AUTH_MODE=mock` and env-missing `auto` mode.
- Add focused contract tests and update auth status/current-status references.
- Create a Korean HTML closeout report and Linear handoff comment.

## Out Of Scope

- No route migration from demo headers.
- No DB writes.
- No migration or RLS implementation.
- No password, OAuth, MFA, refresh token, or callback implementation.
- No remote Supabase project mutation.
- No Project 02 work.

## Done When

- Server code can return a typed user/session state without `sessionStorage`, `localStorage`, or `window`.
- Mock fallback and Supabase mode boundaries are covered by tests.
- DEN-32 has a clear seam to replace the demo identity header.
- Required verification commands pass.
- DEN-31 is ready for Human Review.

## Verification

- `npx playwright test tests/server-session-reader.spec.ts --reporter=line`
- `npm run lint -- --ignore-pattern '.worktrees/**'`
- `npx tsc --noEmit`
- `npx playwright test tests/server-session-reader.spec.ts tests/auth.spec.ts tests/server-permission-enforcement.spec.ts --reporter=line`
- `npm run docs:check`

Result: passed on 2026-05-18.

## Handoff Notes

The new reader is intentionally a contract and entrypoint only. DEN-32 should wire the first role-update route from demo header identity to this server session seam while keeping mock/test behavior explicit.
