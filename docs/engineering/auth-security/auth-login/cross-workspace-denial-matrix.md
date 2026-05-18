# Cross-Workspace Denial Matrix

Updated: 2026-05-18
Linear: DEN-39

This document summarizes Project 01 cross-workspace denial coverage for server enforcement and RLS baseline work.

## Denial Matrix

| Boundary | Scenario | Expected Result | Coverage |
| --- | --- | --- | --- |
| Server route | `user-admin` has active admin membership in `workspace-a` and posts to `workspace-b` | `403`, `workspace_membership_missing` | `tests/server-permission-enforcement.spec.ts` |
| Resolver | user has active `hospital_admin` membership in `workspace-b` but requests `workspace-a` | denied, `workspace_membership_missing` | `tests/permission-resolver.spec.ts` |
| RLS helper | helper checks membership row by `membership.workspace_id = p_workspace_id` and `membership.user_id = auth.uid()` | only row workspace can satisfy membership | `tests/workspace-membership-rls-migration.spec.ts` |
| RLS policy | policies call helpers with row `workspace_id` | no hard-coded or user-id-as-workspace shortcut | `tests/workspace-membership-rls-migration.spec.ts` |

## Flake-Resistant Commands

Use focused commands for CI/local verification:

```bash
npx playwright test tests/server-permission-enforcement.spec.ts tests/workspace-membership-rls-migration.spec.ts tests/permission-resolver.spec.ts --reporter=line
npm run build
npm run docs:check
```

## Remaining Uncovered Boundary

- Actual RLS execution against Postgres is still blocked in this environment because Docker/local Supabase Postgres is unavailable.
- Business domain tables such as chart/order/billing do not have RLS policies yet.
- Production monitoring is outside Project 01 foundation scope.
