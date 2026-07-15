---
id: "RECEPTION-LIVE-PR-014"
status: "implemented"
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

| Option                                        | Benefit                                                                      | Cost / Risk                                                                                                                                                          | Decision                                                   |
| --------------------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Extend `user_memberships`                     | No additional identity join and one fewer table                              | Mixes user-authored profile content into the authorization/lifecycle record; self-write grants need a narrow column boundary so role/status fields cannot be changed | Rejected                                                   |
| Add a workspace member profile/settings table | Clean workspace/user ownership and direct same-workspace read/self-write RLS | A broad profile/settings container invites unrelated fields later                                                                                                    | Narrowed to one-purpose `workspace_member_status_messages` |
| Extend `workspace_member_activity`            | Reuses the existing workspace/user key                                       | Mixes intentional profile content with throttled Presence heartbeat observations and couples two unrelated retention/lifecycle rules                                 | Rejected                                                   |

Selected model:

- Add `workspace_member_status_messages` keyed by `(workspace_id, user_id)` and
  backed by the existing composite membership foreign key. Empty values delete
  the row; there is no empty placeholder record.
- Keep `user_profiles` unchanged because its profile fields are global while
  this value belongs to one workspace.
- Enforce trim, non-empty storage, and at most 60 Unicode code points in both
  the server mutation contract and a database constraint.
- Use same-workspace active-member select plus active self-only insert/update/
  delete RLS. The API repeats authentication, active membership, ownership, and
  optimistic concurrency checks; the client editor is not a security boundary.
- Use an atomic self-write RPC with the last confirmed `updated_at` as the
  compare-and-set version. Stale saves return a conflict instead of overwriting
  a value saved from another tab.
- Emit `user.workspace_status_message_updated` through a database trigger so
  RPC and any RLS-authorized direct mutation share the same audit path. Audit
  snapshots contain only presence/length/operation metadata, never message
  content.
- The migration is additive and does not change auth/session/provider behavior.
  Rollback drops the RPC, audit trigger/function, policies, and one-purpose
  table; the only lost data would be status messages created by this feature.
- Apply and catalog-verify the migration on the Vercel-linked synthetic/demo
  Supabase target before merging application code that requires the table.

Remote application evidence:

- Applied the canonical `20260716010000` SQL to the linked
  `clair-emr-staging` synthetic/demo project on 2026-07-16 under remote version
  `20260715164007`.
- Applied the scoped RLS init-plan optimization under remote version
  `20260715164307`; it preserves the same self-only write predicates while
  avoiding per-row `auth.uid()` evaluation.
- Catalog verification confirms RLS enabled, four scoped policies, authenticated
  table/RPC grants, no anonymous table/RPC access, and the safe audit trigger.
- Preserved the generated remote timestamp as a comment-only compatibility alias;
  no previously pending migration or seed was replayed.
- The advisor's authenticated `SECURITY DEFINER` warning is intentional: the RPC
  is the atomic self-write/CAS boundary, checks `auth.uid()` plus active workspace
  membership internally, accepts no target user ID, and is not executable by
  anonymous callers.

## Done When

- DB constraints, RLS, API authorization, normalization, concurrent failure,
  and cross-workspace denial tests pass.
- Scoped synthetic/demo create, same-workspace readback, unauthorized denial,
  and cleanup pass on the approved remote target with no real staff data.
- UI rollback/retry and keyboard tests, migration drift review, lint, typecheck,
  build, and docs checks pass.

## Implemented Result

- The operational-profile read joins the dedicated status table and exposes an
  edit capability only when actor and target user IDs match.
- The header uses the shared editor with 60-code-point input, Enter/blur save,
  Escape cancel, optimistic rollback, retry, and accessible status/error text.
- The Supabase-session-only PATCH route and atomic RPC enforce active membership,
  self ownership, normalization, empty-delete, and last-confirmed-version CAS.
- Remote schema and policy optimization migrations were catalog-verified; the
  transaction-backed synthetic authorization probe rolled back cleanly with zero
  persistent status, audit, or workspace rows.

## Focused Verification

- `npx supabase db reset --local --yes --no-seed` — passed through both canonical
  migrations and their remote-history aliases on a clean local database.
- Local rollback-only SQL probe — passed self save, whitespace normalization,
  same-workspace read, other-user and inactive/cross-workspace denial, stale CAS,
  empty-delete, two safe audit events, and zero persistent QA rows.
- Remote rollback-only synthetic probe — passed the same authorization boundary
  and cleanup checks on the linked synthetic/demo project.
- Focused Playwright contract/browser suite — 26 passed.
- Focused Storybook interaction suite — 15 passed.
- `npm run lint`, `npx tsc --noEmit`, `npm run docs:check`, and
  `npm run security:secrets` — passed.
- `npm run build` — passed; the existing broad NFT trace warning for the docs
  reader remains unchanged and is outside this work item.
