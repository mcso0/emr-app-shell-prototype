# AUTH-PR-012 Auth DB Env Secret Verification Gates

Linear: DEN-30
Status: human_review
Area: auth
Priority: P0
Date: 2026-05-18

## Goal

Define the environment variable matrix, secret-handling rules, and verification gates for Project 01 auth/DB/RLS work.

## Scope

- Separate browser-safe public env from server-only/elevated secrets.
- Document local, mock, server-session, local migration/RLS, remote staging, and production verification gates.
- Confirm existing repo env usage and mock Playwright behavior.
- Update auth status/current-status references.
- Create a Korean HTML closeout report and Linear handoff comment.

## Out Of Scope

- No secret creation or storage.
- No real `.env*` file creation.
- No Supabase project setting changes.
- No migration/RLS implementation.
- No product code changes.
- No Project 02 work.

## Done When

- Auth/DB workers can distinguish public env from secret/server-only env.
- Verification gates are explicit for DEN-31 through DEN-39.
- Mock Playwright regression policy is documented.
- `npm run docs:check` passes.
- DEN-30 is ready for Human Review.

## Verification

- `npm run docs:check`

Result: passed on 2026-05-18.

## Handoff Notes

Keep default regression in mock mode. Remote Supabase secrets or project mutation need a separate representative approval gate naming the target environment and allowed operation.
