# AUTH-PR-021 Cross-Workspace Denial Regression

Linear: DEN-39
Status: human_review
Area: auth
Priority: P0
Date: 2026-05-18

## Goal

Add focused server and RLS regression coverage for cross-workspace denial.

## Scope

- Add server route regression for an admin from one workspace trying to mutate another workspace.
- Add resolver regression for active membership in a different workspace.
- Add RLS migration regression that policies are pinned to the row `workspace_id`.
- Document the denial matrix and uncovered boundaries.
- Update auth status/current-status references.
- Create a Korean HTML closeout report and Linear handoff comment.

## Out Of Scope

- No full business domain E2E.
- No performance or load tests.
- No production monitoring.
- No remote Supabase project mutation.
- No Project 02 work.

## Done When

- Cross-workspace access fails in server route coverage.
- Cross-workspace access fails in resolver coverage.
- RLS policy contract is pinned to row workspace boundaries.
- Required verification commands pass.
- DEN-39 is ready for Human Review.

## Verification

- `npx playwright test tests/server-permission-enforcement.spec.ts tests/workspace-membership-rls-migration.spec.ts tests/permission-resolver.spec.ts --reporter=line`
- `npm run build`
- `npx tsc --noEmit`
- `npm run lint -- --ignore-pattern '.worktrees/**'`
- `npm run docs:check`

Result: passed on 2026-05-18.

## Handoff Notes

DEN-40 should use the denial matrix and remaining Docker/local DB limitation as security review inputs.
