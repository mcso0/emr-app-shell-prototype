# AUTH-PR-019 Workspace Membership RLS Policy Baseline

Linear: DEN-37
Status: human_review
Area: auth
Priority: P0
Date: 2026-05-18

## Goal

Implement a local-first RLS baseline for workspace auth tables using active membership and hospital admin boundaries.

## Scope

- Create a Supabase migration using the CLI workflow.
- Add private RLS helper functions for active workspace membership and hospital admin checks.
- Enable RLS on workspace auth tables.
- Grant authenticated access only where RLS policies apply.
- Add member read policies and admin write policies.
- Add cross-workspace denial regression coverage.
- Update auth status/current-status references.
- Create a Korean HTML closeout report and Linear handoff comment.

## Out Of Scope

- No full business domain table RLS.
- No chart/order/billing data policies.
- No payment/email provider policies.
- No remote Supabase project mutation.
- No Project 02 work.

## Done When

- Workspace auth tables are protected by active membership boundaries.
- Non-members cannot read protected workspace rows.
- Hospital admin management actions are separated from general member reads.
- Required verification commands are recorded.
- DEN-37 is ready for Human Review.

## Verification

- Red: `npx playwright test tests/workspace-membership-rls-migration.spec.ts --reporter=line` failed while the generated migration file was empty.
- `npx playwright test tests/workspace-membership-rls-migration.spec.ts tests/permission-resolver.spec.ts --reporter=line`
- `npx tsc --noEmit`
- `npm run lint -- --ignore-pattern '.worktrees/**'`
- `npm run docs:check`

Result: passed on 2026-05-18. Actual RLS apply/test remains blocked until Docker/local Supabase Postgres is available.

## Handoff Notes

DEN-38 should connect the permission resolver to a DB-backed membership adapter that matches this RLS model. Domain table RLS remains a later Project 01 scope, not part of this baseline.
