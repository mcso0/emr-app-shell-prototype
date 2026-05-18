# AUTH-PR-017 Local Migration Validation Auth Seed Contract

Linear: DEN-35
Status: human_review
Area: auth
Priority: P0
Date: 2026-05-18

## Goal

Document the local Supabase migration validation workflow and add a stable workspace auth seed contract.

## Scope

- Check Supabase CLI commands through current CLI help.
- Document local migration apply/check/reset steps.
- Add deterministic local seed data for canonical MVP roles and sample workspace memberships.
- Document legacy `nurse` and `billing_admin` compatibility direction.
- Add focused seed contract tests.
- Update auth status/current-status references.
- Create a Korean HTML closeout report and Linear handoff comment.

## Out Of Scope

- No live Supabase project application.
- No full business data seed migration.
- No UI changes.
- No remote Supabase project mutation.
- No Project 02 work.

## Done When

- A new environment can replay the intended local migration/seed workflow.
- Follow-up tests have a stable seed contract.
- Local validation blockers are explicit.
- Required verification commands are recorded.
- DEN-35 is ready for Human Review.

## Verification

- Red: `npx playwright test tests/workspace-auth-seed-contract.spec.ts --reporter=line` failed because `supabase/seed.sql` did not exist.
- `npx playwright test tests/workspace-auth-seed-contract.spec.ts --reporter=line`
- `npx playwright test tests/workspace-auth-schema-migration.spec.ts tests/workspace-auth-seed-contract.spec.ts --reporter=line`
- `npm run lint -- --ignore-pattern '.worktrees/**'`
- `npx tsc --noEmit`
- `npm run docs:check`
- `docker info --format '{{.ServerVersion}}'` failed because `docker` is not installed in this environment.

Result: seed/schema contract tests, lint, TypeScript, and docs check passed on 2026-05-18. Actual local Supabase DB apply is blocked until Docker/local Postgres is available.

## Handoff Notes

DEN-36 can reference `supabase/seed.sql` for deterministic local users and memberships. Before treating DB behavior as fully validated, run `npx supabase db reset --local` and `npx supabase db lint --local --schema public,auth` in a Docker-capable environment.
