# AUTH-PR-034 Workspace Role Management Regression Coverage

Linear: DEN-51
Status: human_review
Area: auth
Priority: P0
Date: 2026-05-18

## Goal

Lock role management live handoff scenarios into automated regression coverage.

## Scope

- Cover hospital admin success path.
- Cover non-admin denial path.
- Cover cross-workspace denial path.
- Cover last-admin demotion/deactivation denial.
- Keep route and DB guard boundaries discoverable.

## Out Of Scope

- No new feature behavior.
- No broad auth redesign.
- No remote Supabase operations or secrets.

## Result

Added a focused regression matrix test that fails if role management UI/server/DB guard coverage is removed or no longer discoverable.

## Verification

- `npx playwright test tests/workspace-role-management-regression.spec.ts tests/auth.spec.ts tests/server-permission-enforcement.spec.ts tests/workspace-role-status-write-server.spec.ts --reporter=line`

Result: passed on 2026-05-18 (`37 passed`).
