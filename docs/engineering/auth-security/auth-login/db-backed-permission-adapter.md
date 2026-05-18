# DB-Backed Permission Adapter

Updated: 2026-05-18
Linear: DEN-38

This document summarizes the DB-backed adapter boundary added for the workspace permission resolver.

## Files

- `src/features/auth/db-workspace-permission-adapter-core.ts`
- `src/features/auth/db-workspace-permission-adapter.ts`
- `tests/db-workspace-permission-adapter.spec.ts`

## Adapter Selection

The existing mock adapter remains available through `createMockWorkspacePermissionAdapter()`.

The DB-backed path uses:

1. A gateway that loads DB rows for the requested workspace/user.
2. `loadWorkspacePermissionAdapterFromDb(...)` to create the resolver adapter.
3. `resolveWorkspacePermission(adapter, request)` unchanged.

The wrapper file imports `server-only`; the core file is pure and testable.

## DB Query Boundary

The gateway shape is intentionally narrow:

- `listMemberships(workspaceId, userId)`
- `listUsers(userIds)`
- `listPermissionPolicies(workspaceId)`

This keeps Supabase query details outside the resolver and preserves the existing synchronous resolver contract.

## Mapping Rules

- DB roles are filtered to canonical MVP roles: `hospital_admin`, `vet`, `technician`, `front_desk`.
- Unknown DB roles are ignored.
- Active memberships with no canonical roles are dropped.
- DB role permission policies can provide additive allowed permission ids.
- `hospital_admin` still resolves to full workspace access.

## Remaining Policy Decisions

- The actual Supabase client gateway implementation still needs local DB validation.
- Product-level custom roles, deny rules, and user-specific overrides are not added in DEN-38.
- Role management live persistence is still a separate task.
