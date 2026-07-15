---
id: "RECEPTION-LIVE-PR-014"
status: "planned"
area: "reception"
priority: "P0"
target_pr: "Workspace-scoped staff status-message persistence"
source_docs:
  - "docs/design/system/staff-operational-profile-drawer.md"
  - "docs/product/domain/workspace-auth-permissions.md"
dependencies:
  - "RECEPTION-PR-013"
updated: "2026-07-16"
---

# Workspace Status Message Persistence

## Goal

Persist a workspace-scoped status message that only the current member can
mutate while other active members of the same workspace may read it.

## Scope

- Add the minimal status-message schema and migration with `<= 60` normalized
  character validation, update timestamp, and workspace/user ownership.
- Add RLS for same-workspace reads and self-only insert/update/delete.
- Add `PATCH /api/workspaces/{workspaceId}/members/me/status-message` with
  authentication, workspace membership, payload/content-type/size validation,
  trim/empty-delete semantics, and safe audit metadata.
- Wire Enter/blur save, Escape cancel, optimistic update, rollback, retry, and
  accessible announcement into the panel.

## Alternatives And Impact

- A `user_profiles` global field is rejected because the requirement is
  workspace-scoped.
- Client-only ownership is rejected because it cannot protect direct API/DB
  access.
- The migration is additive and does not change existing auth/session behavior.

## Done When

- DB constraints, RLS, API authorization, normalization, concurrent failure,
  and cross-workspace denial tests pass.
- Scoped synthetic/demo create, same-workspace readback, unauthorized denial,
  and cleanup pass on the approved remote target with no real staff data.
- UI rollback/retry and keyboard tests, migration drift review, lint, typecheck,
  build, and docs checks pass.
