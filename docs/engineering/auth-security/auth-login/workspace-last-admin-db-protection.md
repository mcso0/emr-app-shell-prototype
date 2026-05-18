# Workspace Last Admin DB Protection

Updated: 2026-05-18
Linear: DEN-36

This document summarizes the local-first last active `hospital_admin` protection foundation in `supabase/migrations/20260518024425_workspace_last_admin_protection_foundation.sql`.

## Protection Strategy

Use a private trigger guard plus a private update helper skeleton:

- `private.clair_assert_not_last_active_hospital_admin()`
- `private.update_workspace_membership_roles(...)`

The trigger runs `before update or delete on public.user_memberships` and blocks changes that would leave a workspace with zero active `hospital_admin` memberships.

## Protected Changes

The trigger protects an existing active `hospital_admin` membership when a write attempts to:

- remove `hospital_admin` from `roles`
- change `status` away from `active`
- move the row to a different `workspace_id`
- delete the membership row

If no other active `hospital_admin` remains in the same workspace, the trigger raises `last_active_hospital_admin_protected`.

## Private Helper

`private.update_workspace_membership_roles(...)` is a future trusted DB write helper. It validates canonical roles, validates membership status, rejects active memberships with no roles, and updates roles/status in one transaction boundary.

The helper is intentionally in `private`, not `public`, and execution is revoked from `public`, `anon`, and `authenticated`. Future server code should call it only through a trusted DB path after session and permission checks.

## What This Does Not Do

- It does not implement the role management live write API.
- It does not grant client access to mutate memberships.
- It does not implement payment or seat rules.
- It was not applied to a remote Supabase project.

## Verification

Static migration contract tests passed:

- `npx playwright test tests/workspace-last-admin-protection-migration.spec.ts --reporter=line`
- `npx playwright test tests/permission-resolver.spec.ts --reporter=line`

Local DB apply still needs a Docker-capable environment.
