# Workspace Permission Role Model MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist workspace role and job-position catalogs in local Supabase and make the existing role-management UI use that server-backed source in Supabase mode.

**Architecture:** Preserve the current additive schema and legacy role arrays. Add a guarded RPC layer for catalog reads and mutations, expose it through one workspace-scoped server route, then make the client hook select this route only for verified Supabase sessions. Owner reconciliation assigns one explicit owner from a creator-first legacy mapping and surfaces any fallback for confirmation.

**Tech Stack:** Next.js App Router, TypeScript, Supabase Postgres/RLS/RPC, React, Playwright.

## Global Constraints

- Never push a migration to remote Supabase or mutate remote data.
- System roles and default job positions are immutable.
- Custom roles use only `SESSION_WORKSPACE_SAFE_CUSTOM_PERMISSION_CATALOG` permissions.
- Direct table writes by `authenticated` are revoked; checked RPCs enforce actor, workspace, and catalog constraints.
- Retain legacy `roles` and `invited_roles` dual-read/dual-write compatibility.
- Job positions never grant authorization.
- No subagents; implement and review inline.

---

### Task 1: Add executable server-catalog contracts

**Files:**
- Create: `tests/workspace-role-catalog-server.spec.ts`
- Modify: `tests/workspace-auth-schema-migration.spec.ts`
- Modify: `tests/workspace-membership-rls-migration.spec.ts`

**Interfaces:**
- Consumes: role catalog route and SQL migration created in Task 2.
- Produces: tests for explicit owner reconciliation, RPC grants, immutable system catalog rows, custom allow-list, and route denial/success responses.

- [ ] Write failing migration assertions requiring these SQL contracts:

```ts
expect(roleCatalogMigration).toContain("owner_source");
expect(roleCatalogMigration).toContain("legacy_creator");
expect(roleCatalogMigration).toContain("legacy_fallback");
expect(roleCatalogMigration).toContain("clair_mutate_workspace_role_catalog");
expect(roleCatalogMigration).toContain("clair_read_workspace_role_catalog");
expect(roleCatalogMigration).toContain("workspace_permission_role_system_immutable");
expect(roleCatalogMigration).toContain("clair_safe_custom_permission_values");
```

- [ ] Add route harness assertions for these request bodies:

```ts
{ action: "role.create", role: { label: "검사 보조", permissionIds: ["lab:complete"] } }
{ action: "role.update", roleKey: "lab_assistant", role: { label: "검사 보조", permissionIds: ["lab:complete"] } }
{ action: "job.archive", positionKey: "custom_coordinator" }
```

- [ ] Assert `401` without a server identity, `403` for a viewer or foreign workspace, `400` for `*`, owner-only, unknown, or malformed permissions, `409` for a referenced catalog row, and `200` for a permitted custom-role mutation.
- [ ] Run the new spec and record the expected red failure before Task 2.

### Task 2: Strengthen the local Supabase role-catalog boundary

**Files:**
- Create: `supabase/migrations/*_workspace_role_catalog_server_enforcement.sql`
- Modify: `supabase/seed.sql`
- Modify: `tests/workspace-auth-schema-migration.spec.ts`
- Modify: `tests/workspace-membership-rls-migration.spec.ts`
- Modify: `tests/workspace-last-admin-protection-migration.spec.ts`

**Interfaces:**
- Consumes: the existing role tables and assignment tables from `20260702090000_workspace_permission_role_model_foundation.sql`.
- Produces:

```sql
public.clair_read_workspace_role_catalog(p_workspace_id text) returns jsonb
public.clair_mutate_workspace_role_catalog(
  p_workspace_id text,
  p_action text,
  p_role_key text,
  p_position_key text,
  p_label text,
  p_description text,
  p_permission_ids text[]
) returns jsonb
```

- [ ] Generate the migration using `npx supabase migration new workspace_role_catalog_server_enforcement`; use the exact created filename in subsequent commands.
- [ ] Add `owner_source text not null default 'explicit'` to `workspace_membership_permission_role_assignments`, constrained to `explicit`, `legacy_creator`, and `legacy_fallback`.
- [ ] Reconcile legacy `hospital_admin` rows: choose the active membership matching `workspaces.created_by_user_id`; otherwise choose the earliest active membership by `activated_at`, `created_at`, and `id`; assign every other legacy administrator to the system `admin` role.
- [ ] Add `public.clair_safe_custom_permission_values()` returning the exact safe catalog IDs from `workspace-session.ts`, and validate custom role permissions as a duplicate-free subset of it.
- [ ] Add a trigger that rejects insert, update, or delete of `is_system = true` role rows and default job-position rows; archive custom job positions instead of deleting them when assignments exist.
- [ ] Implement `clair_read_workspace_role_catalog` with `auth.uid()`, active-membership verification, workspace-scoped catalog JSON, assignment counts, and fallback-owner metadata.
- [ ] Implement `clair_mutate_workspace_role_catalog` with `auth.uid()`, `private.clair_is_workspace_admin`, strict action allow-list, ownership checks, and custom role/job create-update-archive operations.
- [ ] Revoke direct `insert`, `update`, and `delete` catalog-table grants from `authenticated`; grant only `select` plus execute on the two checked public RPCs. Revoke all public/anon execution and keep private helpers uncallable.
- [ ] Seed Cheongdam with explicit `owner` and `admin` assignments, never relying on role-array inference.
- [ ] Run the Task 1 migration/static tests; they pass before continuing.

### Task 3: Add a server route and gateway for the catalog

**Files:**
- Create: `src/features/auth/server-workspace-role-catalog.ts`
- Create: `src/app/api/workspaces/[workspaceId]/role-permission-management/route.ts`
- Modify: `src/features/auth/server-role-update-identity.ts`
- Modify: `tests/workspace-role-catalog-server.spec.ts`

**Interfaces:**

```ts
export type WorkspaceRoleCatalogSnapshot = {
  permissionRoles: SessionWorkspacePermissionRole[];
  jobPositions: SessionWorkspaceJobPosition[];
  ownerReconciliation: { needsConfirmation: boolean; membershipIds: string[] };
};

export async function readWorkspaceRoleCatalog(input: {
  actorUserId: string;
  workspaceId: string;
  rpc: WorkspaceRoleCatalogRpcClient;
}): Promise<WorkspaceRoleCatalogSnapshot>;
```

- [ ] Write failing route tests that mock `readServerSession`, identity resolution, rate-limit behavior, catalog RPC results, RPC denial, and audit failure.
- [ ] Implement a server-only gateway that validates JSON payloads before calling the RPC and maps SQL errors to stable `400`, `403`, `404`, or `409` route results.
- [ ] Implement `GET` for a verified active member catalog read and `POST`/`PATCH`/`DELETE` for a `role.*` or `job.*` catalog action.
- [ ] Enforce `role_permission:manage` before every mutation, rate-limit mutations, and append a safe audit event with role/job keys only.
- [ ] Keep mock-mode writes in the existing session model; do not expose a browser Supabase table-write path.
- [ ] Run `tests/workspace-role-catalog-server.spec.ts` and existing membership/invitation server specs.

### Task 4: Hydrate the role-management screen from the server

**Files:**
- Create: `src/features/hospital-admin/role-permission-management/server-catalog.ts`
- Modify: `src/features/hospital-admin/role-permission-management/use-workspace-role-state.ts`
- Modify: `src/features/hospital-admin/role-permission-management/screen.tsx`
- Modify: `src/features/auth/workspace-membership-management.tsx`
- Modify: `tests/hospital-admin.spec.ts`
- Modify: `tests/auth.spec.ts`

**Interfaces:**

```ts
export type WorkspaceRoleCatalogApi = {
  load(workspaceId: string): Promise<WorkspaceRoleCatalogSnapshot>;
  mutate(workspaceId: string, input: RoleCatalogMutationInput): Promise<WorkspaceRoleCatalogSnapshot>;
};
```

- [ ] Write failing browser coverage for Supabase-mode server hydration, save/reload persistence, owner-fallback notice, custom role/job mutation error, and mock-mode session fallback.
- [ ] Make `useWorkspaceRoleState` load the route after auth hydration only in Supabase mode, with explicit loading, retry, permission-denied, and storage fallback states.
- [ ] Preserve the current local session behavior in mock mode and make the returned server snapshot update the in-memory catalog used by the screen and invitation/member selects.
- [ ] Wire custom role create/edit/delete and custom job create/edit/archive controls to the route; system rows stay visibly locked even before the route rejects a forged request.
- [ ] Display a compact manager-only `소유자 확인 필요` notice when the snapshot reports a legacy fallback owner. Provide a direct member-management link, not an automatic ownership transfer.
- [ ] Keep `업무 기본값` local-only and state that it does not change permissions or role assignment.
- [ ] Run focused `hospital-admin`, `auth`, and role-regression browser tests at desktop and compact widths.

### Task 5: Verify local database execution and document the boundary

**Files:**
- Modify: `docs/work/auth/AUTH-PR-044-workspace-permission-role-model-mvp.md`
- Modify: `docs/engineering/auth-security/auth-login/status.md`
- Create: `docs/completed/auth/2026-07-11-workspace-permission-role-model-mvp-closeout.html`

- [ ] Run `npx supabase db reset --local` and a focused authenticated SQL/RLS replay for owner/admin/viewer/cross-workspace cases. If Docker is unavailable, record the exact environment block without claiming local DB execution.
- [ ] Run `npx supabase db advisors` when supported by the installed CLI; resolve any new security findings introduced by this migration.
- [ ] Run the scoped Playwright suites, ESLint, TypeScript, build, docs check, and `git diff --check`.
- [ ] Record exactly that local Supabase persistence is implemented; do not claim remote migration push, staging/production data mutation, or complete authorization coverage for all clinical APIs.
- [ ] Commit each independently passing implementation slice with its tests and update the work item status only after verification evidence exists.
