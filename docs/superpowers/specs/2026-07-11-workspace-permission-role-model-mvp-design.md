# Workspace Permission Role Model MVP Design

**Status:** approved by 승욱 on 2026-07-11

## Goal

Finish `AUTH-PR-044` by making the hospital role and job-position catalog durable in local Supabase, moving the Roles & Permissions screen to a server-backed source in Supabase mode, and recording an explicit owner assignment for legacy workspaces.

## Constraints

- Preserve `user_memberships.roles`, `workspace_invitations.invited_roles`, and `permission_policies` during this additive rollout.
- Do not push migrations to remote Supabase or mutate staging/production data.
- Keep job positions as display/filter metadata; they must never authorize an action.
- Keep system roles immutable and custom roles allow-only.
- Custom roles must reject wildcard, owner-only, unknown, and cross-workspace permissions.
- Every active workspace retains at least one active owner.
- Client state is a mock-mode fallback and UI convenience, not an authorization boundary.

## Options Considered

### 1. Browser storage remains the catalog source

This keeps implementation small but makes invitations and member assignment disagree across devices and cannot support server-side authorization. Rejected.

### 2. Replace legacy role arrays immediately

This would remove compatibility from invitations, resolver paths, and existing tests in one change. It risks lockout and breaks the staged migration contract. Rejected.

### 3. Additive server-backed catalog with dual-read compatibility

Use the already-created `workspace_permission_roles`, `workspace_job_positions`, and assignment tables as the Supabase-mode source. Keep the legacy arrays as synchronized compatibility values until a future removal PR. All catalog mutations go through validated RPCs and server routes. Selected.

## Owner Reconciliation

The old `hospital_admin` array does not identify a true owner when it contains several people. The migration therefore records an explicit owner assignment using this deterministic order:

1. The active membership whose `user_id` equals `workspaces.created_by_user_id` becomes `owner`.
2. If no such active membership exists, the oldest active `hospital_admin` membership becomes `owner` and receives a `legacy_fallback` source marker.
3. Other active legacy `hospital_admin` memberships become `admin`.

The UI shows the fallback marker only to users who can manage roles, so the clinic can confirm or transfer ownership. This avoids granting owner-only authority to every historical administrator while preserving a continuous protected owner.

## Architecture

### Database and RLS

A new additive migration strengthens the existing role-model foundation:

- add `owner_source` metadata to membership permission-role assignments (`explicit`, `legacy_creator`, `legacy_fallback`);
- reconcile legacy `hospital_admin` assignments with the deterministic rule above;
- expose the safe custom-permission catalog as a database validation function;
- add security-definer RPCs for catalog read/create/update/delete and job-position read/create/update/archive;
- reject edits or deletion of system roles and system job positions;
- revoke direct catalog writes from `authenticated`; mutation is possible only through checked RPCs;
- preserve active-member read RLS and workspace-scoped foreign-key checks;
- retain and extend the existing last-active-owner trigger.

### Server contract

`GET /api/workspaces/[workspaceId]/role-permission-management` returns the role catalog, job catalog, membership assignment summary, and owner-reconciliation status. `POST`, `PATCH`, and `DELETE` on the same route carry typed catalog operations. The route resolves the verified actor, rate-limits mutations, invokes the checked RPC, and emits an audit event. Mock mode continues to use the existing session model.

### Client contract

The role-management hook hydrates from the route in Supabase mode and remains browser-backed in mock mode. The screen keeps its existing optimistic draft UI but refreshes from the returned server snapshot after each mutation. Server errors are rendered as actionable `role="alert"` feedback. `업무 기본값` remains browser-only by design and is labelled as such.

### Membership and invitations

The existing membership/invitation server writes continue to send the selected permission-role and job-position keys. They read the server catalog in Supabase mode; mock mode consumes the existing session catalog. No invitation flow creates catalog items inline.

## Verification

- SQL/static migration tests: explicit owner reconciliation, last-owner protection, immutable system rows, custom allow-list, workspace isolation, and revoked direct writes.
- Route tests: unauthenticated, member/viewer, administrator, cross-workspace, malformed input, audit failure, and RPC denial paths.
- Browser tests: server-hydrated catalog, custom role/job create-edit-archive, invitation assignment, reload persistence, owner-fallback notice, compact layout, and mock fallback.
- Run the scoped auth/hospital-admin Playwright suites, ESLint, TypeScript, build, docs check, `git diff --check`, local Supabase migration reset/replay, and database advisors when the CLI supports them.

## Out of Scope

- Remote Supabase migration application, staging/production data mutation, email delivery, guest roles, denial rules, user-specific permission overrides, and removal of legacy role columns.
