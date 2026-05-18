# AUTH-PR-014 Role Update Verified Session Seam

Linear: DEN-32
Status: human_review
Area: auth
Priority: P0
Date: 2026-05-18

## Goal

Replace the role update Route Handler's production-shaped actor identity path with the verified server session seam.

## Scope

- Inspect `POST /api/workspaces/[workspaceId]/memberships/[membershipId]/roles`.
- Read the relevant Next.js Route Handler and cookies docs before coding.
- Resolve the actor user id from `readServerSession()` when a Supabase session is authenticated.
- Permit the demo identity header only when the server session reader is in mock fallback mode.
- Add regression coverage for verified session precedence and invalid/missing session denial.
- Update auth status/current-status references.
- Create a Korean HTML closeout report and Linear handoff comment.

## Out Of Scope

- No role management UI live persistence conversion.
- No DB writes.
- No migration or RLS implementation.
- No broad route migration.
- No remote Supabase project mutation.
- No Project 02 work.

## Done When

- Production-shaped path does not use the demo header as the actor identity source.
- Missing/invalid server session is rejected before role authorization.
- Mock Playwright route tests continue to work through an explicit mock-only demo seam.
- Required verification commands pass.
- DEN-32 is ready for Human Review.

## Verification

- Red: `npx playwright test tests/server-permission-enforcement.spec.ts --reporter=line` failed because `server-role-update-identity` did not exist.
- `npx playwright test tests/server-permission-enforcement.spec.ts --reporter=line`
- `npx tsc --noEmit`
- `npm run lint -- --ignore-pattern '.worktrees/**'`
- `npx playwright test tests/auth.spec.ts --reporter=line`
- `npx playwright test tests/server-session-reader.spec.ts tests/server-permission-enforcement.spec.ts --reporter=line`
- `npm run docs:check`

Result: passed on 2026-05-18.

## Handoff Notes

The remaining demo-only seam is the mock-mode test header. DEN-33 should harden guard/session regression around this behavior before Project 01 moves into schema/RLS work.
