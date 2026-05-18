# AUTH-PR-024 Docker Local Supabase RLS Execution Gate

Linear: DEN-94
Status: human_review
Area: auth
Priority: P0
Date: 2026-05-18

## Goal

Prepare Docker-backed local Supabase and execute the Project 01 DB/RLS gate before Project 02 live persistence implementation.

## Scope

- Confirm Docker Desktop is available from the CLI.
- Initialize the local Supabase project config.
- Start the local Supabase stack.
- Apply Project 01 migrations and seed data to a real local Postgres database.
- Execute focused RLS and DB guard checks for admin/member/unknown users.
- Fix only the DB/RLS execution blocker found during this gate.
- Document results and hand off DEN-94 to Human Review.

## Out Of Scope

- No remote Supabase project link, push, or SQL execution.
- No production secrets, service-role keys, DB passwords, or real clinic data.
- No workspace/member live UI persistence implementation.
- No Project 03+ work.

## Result

Docker and local Supabase are now usable for Project 02 DB/RLS validation.

The first RLS execution attempt exposed a real blocker: private RLS helper functions were correctly placed outside exposed schemas, but the `authenticated` role lacked policy-time `usage`/`execute` access to evaluate them. This caused local Postgres to terminate the query process during authenticated RLS table reads.

DEN-94 added `supabase/migrations/20260518113052_workspace_rls_helper_function_grants.sql` to grant the minimum required helper access to `authenticated` while keeping `anon` blocked.

## Verified Behavior

- Project 01 migrations and seed apply in local Supabase.
- RLS is enabled on workspace auth tables.
- `authenticated` can execute private helper functions for policy evaluation.
- `anon` does not receive private helper execution access.
- Active admin/member users see the seeded workspace and memberships.
- Unknown authenticated user sees zero workspaces and zero memberships.
- DB last active `hospital_admin` guard blocks demotion.

## Verification

- `docker --version`
- `docker ps`
- `npx supabase init`
- `npx supabase start`
- `npx supabase db reset --local`
- `npx supabase migration list --local`
- focused local SQL checks through `docker exec ... psql`
- `npx playwright test tests/workspace-membership-rls-migration.spec.ts tests/workspace-last-admin-protection-migration.spec.ts --reporter=line`

Result: passed on 2026-05-18.

## Handoff Notes

Project 02 can continue to DEN-42 scope/dependency confirmation or split a follow-up execution issue for broader server route and UI persistence tests. Keep all remote Supabase operations approval-gated.
