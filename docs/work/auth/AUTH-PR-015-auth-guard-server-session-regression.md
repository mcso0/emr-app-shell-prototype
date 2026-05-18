# AUTH-PR-015 Auth Guard Server Session Regression

Linear: DEN-33
Status: human_review
Area: auth
Priority: P0
Date: 2026-05-18

## Goal

Harden auth guard and server session mode regression coverage after introducing the verified server session seam.

## Scope

- Review existing `tests/auth.spec.ts` coverage for `/login`, safe `next`, app guard, logout, and mock fallback.
- Add regression coverage that keeps client auth guard and server route identity responsibilities explicit.
- Assert mock fallback and Supabase missing-session behavior for route identity resolution.
- Preserve existing UI and sales demo flows.
- Update auth status/current-status references.
- Create a Korean HTML closeout report and Linear handoff comment.

## Out Of Scope

- No new login design.
- No OAuth, password, MFA, refresh token, or callback implementation.
- No workflow screen changes.
- No DB writes, migration, or RLS implementation.
- No remote Supabase project mutation.
- No Project 02 work.

## Done When

- Auth regression explains both mock/local and server session mode boundaries.
- Client `AuthGate` remains on `useAuthClient()` and does not import server session code.
- Role update route remains on `readServerSession()`.
- Existing sales demo and app-shell regression suite remains green.
- DEN-33 is ready for Human Review.

## Verification

- `npx playwright test tests/auth.spec.ts -g "server session mode regression" --reporter=line`
- `npx playwright test tests/app-shell.spec.ts:70 --reporter=line`
- `npx playwright test tests/auth.spec.ts tests/app-shell.spec.ts --reporter=line`
- `npm run build`
- `npm run lint -- --ignore-pattern '.worktrees/**'`
- `npx tsc --noEmit`
- `npm run docs:check`

Result: passed on 2026-05-18. The first full auth/app-shell run had one app-shell hover timeout; the single retry and full rerun passed.

## Handoff Notes

The verified session milestone is now ready to hand off into migration/schema work. DEN-34 should remain local-first and should not execute remote Supabase SQL without explicit approval.
