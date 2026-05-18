# AUTH-PR-018 DB-Level Last Admin Protection Foundation

Linear: DEN-36
Status: human_review
Area: auth
Priority: P0
Date: 2026-05-18

## Goal

Add a DB-level foundation that protects the last active `hospital_admin` membership from demotion, deactivation, deletion, or workspace movement.

## Scope

- Create a local-first Supabase migration using the CLI workflow.
- Define the last active `hospital_admin` condition against `public.user_memberships`.
- Add a private trigger guard for unsafe direct updates/deletes.
- Add a private transaction helper skeleton for future trusted server writes.
- Keep privileged helpers outside the exposed `public` schema.
- Add focused migration contract tests and run existing permission last-admin tests.
- Update auth status/current-status references.
- Create a Korean HTML closeout report and Linear handoff comment.

## Out Of Scope

- No role management UI live conversion.
- No full membership write API.
- No payment or seat rules.
- No remote Supabase project mutation.
- No Project 02 work.

## Done When

- DB boundary protection strategy is visible in SQL and tests.
- Direct unsafe updates/deletes are guarded by a trigger.
- Future server writes have a private helper skeleton to call after permission checks.
- Required verification commands are recorded.
- DEN-36 is ready for Human Review.

## Verification

- Red: `npx playwright test tests/workspace-last-admin-protection-migration.spec.ts --reporter=line` failed while the generated migration file was empty.
- `npx playwright test tests/workspace-last-admin-protection-migration.spec.ts --reporter=line`
- `npx playwright test tests/permission-resolver.spec.ts --reporter=line`
- `npx tsc --noEmit`
- `npm run lint -- --ignore-pattern '.worktrees/**'`
- `npm run docs:check`

Result: passed on 2026-05-18. Actual DB apply remains blocked in this environment because Docker/local Supabase Postgres is unavailable.

## Handoff Notes

DEN-37 should build RLS policies assuming last-admin mutation safety is handled by the private trigger/helper pair. Before live use, apply these migrations in local Supabase and run DB lint/advisors in a Docker-capable environment.
