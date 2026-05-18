# Docker Local Supabase RLS Execution Gate

Updated: 2026-05-18
Linear: DEN-94

## Summary

Project 02 started with a local DB/RLS execution gate instead of UI persistence work. Docker Desktop was enabled, local Supabase was initialized, and the Project 01 migrations plus seed data were applied to a real local Postgres database.

This found and fixed one real RLS execution blocker.

## What Changed

- Added local Supabase config with `npx supabase init`.
- Started the Docker-backed Supabase stack with `npx supabase start`.
- Applied all Project 01 migrations and seed data with `npx supabase db reset --local`.
- Added `supabase/migrations/20260518113052_workspace_rls_helper_function_grants.sql`.
- Updated RLS contract coverage in `tests/workspace-membership-rls-migration.spec.ts`.

## Root Cause

The private RLS helper pattern was correct, but the helper functions were too aggressively revoked from `authenticated`.

During actual RLS table reads, policies needed to evaluate:

- `private.clair_is_active_workspace_member(text)`
- `private.clair_is_workspace_admin(text)`

Without `authenticated` policy-time access to the private schema/functions, local Postgres terminated the query process during RLS evaluation. A temporary transaction-level grant proved the root cause because the same admin workspace query succeeded after granting helper access.

## Fix

The new migration grants only what policy evaluation needs:

- `grant usage on schema private to authenticated`
- `grant execute` on both private RLS helpers to `authenticated`

It keeps anonymous access blocked:

- no `anon` usage on `private`
- no `anon` execute on the helper functions

The helpers remain outside exposed API schemas.

## Execution Evidence

Local Supabase status:

- Docker CLI works.
- Supabase local stack starts.
- Local DB is healthy.
- Migrations apply in order.
- Seed data loads.

Seeded data:

- 4 app users
- 1 workspace
- 4 memberships
- 4 role permission policies

RLS/guard checks:

- Admin user sees 1 workspace and 4 memberships.
- Vet user sees 1 workspace and 4 memberships in the same workspace.
- Unknown authenticated user sees 0 workspaces and 0 memberships.
- Last active `hospital_admin` demotion is blocked by the DB trigger.

## Verification Commands

- `docker --version`
- `docker ps`
- `npx supabase init`
- `npx supabase start`
- `npx supabase db reset --local`
- `npx supabase migration list --local`
- focused `docker exec ... psql` RLS checks
- `npx playwright test tests/workspace-membership-rls-migration.spec.ts tests/workspace-last-admin-protection-migration.spec.ts --reporter=line`

## Do Not Do

- Do not paste local secret values into docs, Linear, chat, or reports.
- Do not use remote Supabase link/push/SQL without explicit representative approval.
- Do not use real clinic, guardian, patient, or staff data in this local gate.
- Do not treat chart/order/billing domain RLS as complete; DEN-94 only validates workspace auth tables.

## References

- Supabase RLS docs: `https://supabase.com/docs/guides/database/postgres/row-level-security`
- Supabase security definer troubleshooting: `https://supabase.com/docs/guides/troubleshooting/do-i-need-to-expose-security-definer-functions-in-row-level-security-policies-iI0uOw`
