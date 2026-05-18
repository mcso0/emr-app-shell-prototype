# AUTH-PR-016 Workspace Auth Schema Migration

Linear: DEN-34
Status: human_review
Area: auth
Priority: P0
Date: 2026-05-18

## Goal

Draft the local-first workspace auth schema migration for Project 01.

## Scope

- Review Supabase auth mapping, workspace membership/security plan, and DB structure draft.
- Check current Supabase changelog/docs for schema, RLS, and Data API exposure risks.
- Create a Supabase migration file using the CLI workflow.
- Define minimum tables for `users`, `workspaces`, `user_profiles`, `user_memberships`, `workspace_invitations`, and `permission_policies`.
- Include canonical role constraints, status constraints, workspace scoping columns, timestamps, indexes, and RLS enablement.
- Add static migration contract tests.
- Update auth status/current-status references.
- Create a Korean HTML closeout report and Linear handoff comment.

## Out Of Scope

- No full RLS policies.
- No business domain table migration.
- No live project application.
- No billing/payment schema.
- No remote Supabase project mutation.
- No Project 02 work.

## Done When

- A reviewable local migration file exists.
- Follow-up RLS work has a clear table and column contract.
- Role and membership constraints are visible in SQL and tests.
- Required verification commands are recorded.
- DEN-34 is ready for Human Review.

## Verification

- Red: `npx playwright test tests/workspace-auth-schema-migration.spec.ts --reporter=line` failed while the generated migration file was empty.
- `npx playwright test tests/workspace-auth-schema-migration.spec.ts --reporter=line`
- `npx tsc --noEmit`
- `npx supabase migration list --local` attempted but failed because local Postgres at `127.0.0.1:54322` was not running.
- `npm run lint -- --ignore-pattern '.worktrees/**'`
- `npm run docs:check`

Result: static migration tests, TypeScript, lint, and docs check passed on 2026-05-18. Local DB migration listing could not run until Supabase local DB is started.

## Handoff Notes

DEN-35 should start or configure local Supabase validation, then apply/verify this migration locally and define the auth seed contract. Do not run remote Supabase SQL without explicit approval.
