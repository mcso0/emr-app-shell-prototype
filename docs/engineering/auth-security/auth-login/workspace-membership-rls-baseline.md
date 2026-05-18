# Workspace Membership RLS Baseline

Updated: 2026-05-18
Linear: DEN-37

This document summarizes the local-first RLS baseline in `supabase/migrations/20260518024708_workspace_membership_rls_baseline.sql` and the execution grant fix in `supabase/migrations/20260518113052_workspace_rls_helper_function_grants.sql`.

## Helper Functions

RLS policies use private `security definer` helpers to avoid recursive membership policy lookups:

- `private.clair_is_active_workspace_member(workspace_id)`
- `private.clair_is_workspace_admin(workspace_id)`

Both helpers use `auth.uid()` only as identity and check app `users.status = active` plus active `user_memberships`.

Authenticated requests need policy-time access to execute these helpers, so DEN-94 grants:

- `usage` on schema `private` to `authenticated`
- `execute` on both helper functions to `authenticated`

The helpers remain outside exposed API schemas and are not granted to `anon`.

## Policy Groups

| Table | Member read | Admin write | Notes |
| --- | --- | --- | --- |
| `users` | self or same-workspace member | none | App user status remains server/admin controlled. |
| `workspaces` | active member | hospital admin update | No broad insert/delete. |
| `user_profiles` | self or same-workspace member | self insert/update only | Profile is not an authorization source. |
| `user_memberships` | active member in same workspace | hospital admin insert/update/delete | Last-admin trigger remains the DB safety net. |
| `workspace_invitations` | hospital admin only | hospital admin insert/update/delete | Invitation data is admin-scoped. |
| `permission_policies` | active member in same workspace | hospital admin insert/update/delete | Permission source stays workspace scoped. |

## Explicit Non-Goals

- No policies for clinical/business domain tables yet.
- No chart/order/billing RLS yet.
- No payment/email provider policies.
- No anonymous access policies.
- No remote Supabase project mutation.

## Cross-Workspace Denial

The resolver regression now verifies that a `hospital_admin` membership in `workspace-b` does not grant access to `workspace-a`. The RLS baseline mirrors that by requiring active membership for the row's own `workspace_id`.

## Verification

Static RLS migration contract tests passed:

- `npx playwright test tests/workspace-membership-rls-migration.spec.ts tests/permission-resolver.spec.ts --reporter=line`

Local DB RLS execution tests began in DEN-94 after Docker Desktop was enabled. The first execution exposed the missing authenticated helper grants; the grant migration fixes that policy-time execution gap.
