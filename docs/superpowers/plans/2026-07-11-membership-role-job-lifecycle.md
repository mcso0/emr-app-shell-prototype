# Membership, Permission Role, and Job Position Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the draft `soft_deleted` member behavior with the approved `보관됨` lifecycle, add safe permission-role and job-position deactivation, and deploy the result without breaking environments that already recorded earlier migrations.

**Architecture:** Use a forward-only compatibility migration, server-owned permission/RPC boundaries, and feature-local React components. Database functions enforce workspace scope, self-action protection, owner safety, replacement validity, and atomic reassignment; HTTP routes translate these outcomes into stable product errors and append audit events. Apply backward-compatible schema first, then server/API behavior, then UI terminology, and remove legacy fields only in a later cleanup migration.

**Tech Stack:** Next.js App Router, React, TypeScript, Supabase Postgres/Auth/RLS/RPC, shadcn/EMR components, Playwright, ESLint, repository docs checks.

## Global Constraints

* Product membership states are `active`, `inactive`, and `archived`; `pending`, `suspended`, and `soft_deleted` are read-only transition compatibility values.
* User-facing copy uses `보관됨`, `구성원 보관`, and `구성원 복구`; do not show `삭제됨`, `Soft delete`, or a 90-day deletion review.
* Restore always returns `inactive` and never grants workspace access automatically.
* Default system permission roles `owner`, `admin`, and `general` cannot be deactivated.
* Custom-role deactivation requires an active same-workspace replacement and atomically migrates active/inactive members plus pending invitations; archived member history is unchanged.
* Job-position deactivation preserves current member assignments, blocks new selection, and requires a replacement only for affected pending invitations.
* Self-deactivation/self-archive, owner mutation by non-owners, and last-active-owner removal are blocked in server and database boundaries.
* No hard delete, platform user-account deletion, purge scheduler, real email delivery, SCIM, SSO, or external HR integration.
* Use existing EMR and shadcn components and semantic tokens; add no dependency and no new shared primitive.
* Do not edit `supabase/migrations/20260711150000_workspace_membership_soft_delete_lifecycle.sql` to change an already-recorded environment. Generate a new migration with `npx supabase migration new`.
* Do not mutate remote migration history or push remote schema until the reconciliation report is reviewed and the destructive remote step receives explicit approval.

## Recommended PR Boundaries

1. **PR A — Local migration integrity prerequisite:** repair fresh local replay blockers in a separate DB-hygiene change without claiming any remote schema change.
2. **PR B — Membership archive compatibility:** forward migration, archive/list RPCs, server contracts, audit types, and compatibility reads.
3. **PR C — Permission-role and job-position lifecycle:** lifecycle RPCs, routes, atomic replacement, and audit emission.
4. **PR D — Hospital-admin UI adoption:** directory terminology, detail/history, role/job dialogs, invitation selection rules, responsive/accessibility QA.
5. **Release gate — Remote reconciliation and deployment:** reviewed migration-history map, explicit approval, schema/API/UI rollout, and synthetic browser verification.

---

### Task 1: Isolate And Prove The Existing Local Replay Prerequisite

**Files:**
- Modify in a separate PR: `supabase/migrations/20260519100000_reception_patient_guardian_lookup_reader.sql`
- Modify in a separate PR: `supabase/migrations/20260702142317_cheongdam_realistic_roster_remote_backfill.sql`
- Modify: `tests/reception-patient-guardian-lookup-server.spec.ts`
- Create: `tests/supabase-fresh-replay-ordering.spec.ts`
- Document: `docs/engineering/testing/api-backed-demo-runbook.md`

**Interfaces:**
- Consumes: the ordered migration directory and local Docker Supabase.
- Produces: a fresh local database that can apply every repository migration in timestamp order before lifecycle work begins.

- [ ] **Step 1: Write static failing tests for both replay blockers**

```ts
test("the reception reader does not require the later weight column", () => {
  const source = readFileSync(
    "supabase/migrations/20260519100000_reception_patient_guardian_lookup_reader.sql",
    "utf8"
  );
  expect(source).toContain("'weightKg', null::numeric");
  expect(source).not.toContain("'weightKg', weight_kg");
});

test("Cheongdam backfill creates auth identities before public users", () => {
  const source = readFileSync(
    "supabase/migrations/20260702142317_cheongdam_realistic_roster_remote_backfill.sql",
    "utf8"
  );
  expect(source.indexOf("insert into auth.users")).toBeLessThan(
    source.indexOf("insert into public.users")
  );
});
```

- [ ] **Step 2: Run the tests and capture the expected failures**

Run:

```bash
npx playwright test tests/reception-patient-guardian-lookup-server.spec.ts tests/supabase-fresh-replay-ordering.spec.ts --reporter=line
```

Expected: the weight placeholder and/or auth-before-public ordering assertion fails on the uncorrected branch.

- [ ] **Step 3: Make only replay-safe historical-file corrections**

Use `null::numeric` in the early reader because the later migration replaces the function after `weight_kg` exists. Reorder the synthetic backfill so `auth.users` rows exist before `public.users` foreign-key rows. Do not use these historical edits to claim that an already-applied remote database changed.

- [ ] **Step 4: Run a full local replay from an empty database**

Run:

```bash
npx supabase start
npx supabase db reset --local --yes
npx supabase migration list --local
```

Expected: reset completes, seed runs, and the latest local migration version appears in the applied column.

- [ ] **Step 5: Re-run focused tests and commit the prerequisite separately**

```bash
npx playwright test tests/reception-patient-guardian-lookup-server.spec.ts tests/supabase-fresh-replay-ordering.spec.ts --reporter=line
git add supabase/migrations/20260519100000_reception_patient_guardian_lookup_reader.sql supabase/migrations/20260702142317_cheongdam_realistic_roster_remote_backfill.sql tests/reception-patient-guardian-lookup-server.spec.ts tests/supabase-fresh-replay-ordering.spec.ts docs/engineering/testing/api-backed-demo-runbook.md
git commit -m "fix(db): restore deterministic local migration replay"
```

Expected: focused tests pass; no membership lifecycle behavior is included in this commit.

### Task 2: Add Canonical Archive Types With One-Rollout Compatibility

**Files:**
- Modify: `src/features/auth/workspace-session.ts`
- Modify: `src/features/auth/server-workspace-membership-status.ts`
- Modify: `src/app/api/workspaces/[workspaceId]/memberships/route.ts`
- Modify: `tests/workspace-membership-status-server.spec.ts`
- Modify: `tests/auth.spec.ts`

**Interfaces:**
- Produces: `CanonicalWorkspaceMembershipStatus`, `isArchivedMembershipStatus`, `normalizeWorkspaceMembershipStatus`, `includeArchived` HTTP input.
- Compatibility: accepts persisted `soft_deleted` and maps it to canonical `archived`; the database RPC argument remains `p_include_deleted` for one rollout window because old server builds call that named parameter.

- [ ] **Step 1: Write failing status-normalization tests**

```ts
expect(normalizeWorkspaceMembershipStatus("soft_deleted")).toBe("archived");
expect(normalizeWorkspaceMembershipStatus("archived")).toBe("archived");
expect(isArchivedMembershipStatus("inactive")).toBe(false);
```

Add a route test proving `?includeArchived=true` calls the gateway with `true`, while `?includeDeleted=true` remains a temporary alias.

- [ ] **Step 2: Run the focused tests and verify red**

```bash
npx playwright test tests/workspace-membership-status-server.spec.ts tests/auth.spec.ts --reporter=line
```

Expected: missing normalizer and `includeArchived` assertions fail.

- [ ] **Step 3: Add canonical and compatibility types**

```ts
export type CanonicalWorkspaceMembershipStatus = "active" | "inactive" | "archived";
export type SessionWorkspaceMembershipStatus =
  | CanonicalWorkspaceMembershipStatus
  | "pending"
  | "suspended"
  | "soft_deleted";

export function normalizeWorkspaceMembershipStatus(
  status: SessionWorkspaceMembershipStatus
): SessionWorkspaceMembershipStatus {
  return status === "soft_deleted" ? "archived" : status;
}

export function isArchivedMembershipStatus(status: SessionWorkspaceMembershipStatus) {
  return status === "archived" || status === "soft_deleted";
}
```

Add canonical metadata to `SessionWorkspaceMembership`:

```ts
archivedAt?: string | null;
archivedByUserId?: string | null;
archivedReason?: string | null;
```

Keep the existing `deleted*` fields as read compatibility only.

- [ ] **Step 4: Rename HTTP and server variables without breaking the RPC name**

```ts
const params = new URL(request.url).searchParams;
const includeArchived =
  params.get("includeArchived") === "true" || params.get("includeDeleted") === "true";
```

Use `includeArchived` in TypeScript interfaces and keep:

```ts
p_include_deleted: includeArchived
```

until the later cleanup migration.

- [ ] **Step 5: Run tests and commit**

```bash
npx playwright test tests/workspace-membership-status-server.spec.ts tests/auth.spec.ts --reporter=line
npx tsc --noEmit
git add src/features/auth/workspace-session.ts src/features/auth/server-workspace-membership-status.ts 'src/app/api/workspaces/[workspaceId]/memberships/route.ts' tests/workspace-membership-status-server.spec.ts tests/auth.spec.ts
git commit -m "refactor(auth): add canonical archived membership state"
```

### Task 3: Generate The Forward Membership Archive Migration

**Files:**
- Create with CLI: the file printed by `npx supabase migration new workspace_membership_archive_lifecycle`
- Create: `tests/workspace-membership-archive-migration.spec.ts`
- Modify: `tests/workspace-membership-soft-delete-migration.spec.ts` to identify the old migration as compatibility history only

**Interfaces:**
- Produces: `public.clair_archive_workspace_membership(text, uuid, text, text)` accepting `archive`, temporary `soft_delete`, and `restore`; `public.clair_list_workspace_member_statuses(text, boolean)` returning canonical `archived` rows.
- Produces columns: `archived_at`, `archived_by_user_id`, `archived_reason`, `restored_at`, `restored_by_user_id`.

- [ ] **Step 1: Generate the migration through the CLI**

```bash
npx supabase migration new workspace_membership_archive_lifecycle
ARCHIVE_MIGRATION="$(ls -t supabase/migrations/*_workspace_membership_archive_lifecycle.sql | head -1)"
test -n "$ARCHIVE_MIGRATION"
```

Do not rename the generated version manually.

- [ ] **Step 2: Write failing migration contract tests**

```ts
expect(source).toContain("'archived'");
expect(source).toContain("archived_at");
expect(source).toContain("archived_by_user_id");
expect(source).toContain("archived_reason");
expect(source).toContain("p_action in ('archive', 'soft_delete')");
expect(source).toContain("status = 'inactive'");
expect(source).toContain("last_active_workspace_owner_protected");
expect(source).not.toMatch(/delete\s+from\s+public\.user_memberships/i);
```

- [ ] **Step 3: Implement additive columns and backfill**

The SQL must:

```sql
alter table public.user_memberships
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by_user_id uuid references public.users(id) on delete set null,
  add column if not exists archived_reason text;

update public.user_memberships
set status = 'archived',
    archived_at = coalesce(archived_at, deleted_at),
    archived_by_user_id = coalesce(archived_by_user_id, deleted_by_user_id),
    archived_reason = coalesce(archived_reason, deleted_reason)
where status = 'soft_deleted';
```

Wrap references to legacy `deleted*` columns in a `DO` block that checks `information_schema.columns`, because the remote database currently lacks them. Keep both `archived` and `soft_deleted` in the temporary status constraint for one rollout window; new writes use only `archived`.

- [ ] **Step 4: Replace the archive/list RPC implementations safely**

Normalize actions inside the function:

```sql
v_action text := case
  when p_action = 'soft_delete' then 'archive'
  else p_action
end;
```

Archive sets canonical metadata and status. Restore requires `archived` or legacy `soft_deleted`, then returns `inactive`. The list function excludes both archive representations unless its compatibility boolean is true and emits canonical JSON keys `archivedAt`, `archivedByUserId`, and `archivedReason`.

Replace the invitation-creation RPC body in the same forward migration so a matching archived/legacy-soft-deleted membership raises `archived_membership_requires_restore`. Active/inactive membership continues to raise the existing membership conflict, and only invitation status owns new `pending` writes.

- [ ] **Step 5: Secure functions and audit constraints**

Keep `SECURITY DEFINER` only with `auth.uid()` validation, same-workspace checks, owner protection, explicit `search_path`, and revoked `PUBLIC`/`anon` execution. Add both old and new audit event names during the compatibility window.

- [ ] **Step 6: Apply locally and execute transactional SQL probes**

```bash
npx supabase db reset --local --yes
npx supabase db query --local "select column_name from information_schema.columns where table_schema='public' and table_name='user_memberships' and column_name like 'archived%';"
npx supabase db lint --local --schema public,private --fail-on error
```

Use a transaction with synthetic auth users and memberships to prove archive, default exclusion, `includeArchived`, restore-to-inactive, self-block, owner-block, cross-workspace block, and rollback.

- [ ] **Step 7: Run tests and commit**

```bash
npx playwright test tests/workspace-membership-archive-migration.spec.ts tests/workspace-membership-soft-delete-migration.spec.ts tests/workspace-last-admin-protection-migration.spec.ts --reporter=line
git add "$ARCHIVE_MIGRATION" tests/workspace-membership-archive-migration.spec.ts tests/workspace-membership-soft-delete-migration.spec.ts
git commit -m "feat(db): add archived membership lifecycle migration"
```

### Task 4: Convert The Membership Archive Route And Audit Contract

**Files:**
- Modify: `src/features/auth/server-workspace-membership-archive.ts`
- Modify: `src/app/api/workspaces/[workspaceId]/memberships/[membershipId]/archive/route.ts`
- Modify: `src/app/api/workspaces/[workspaceId]/memberships/[membershipId]/status/route.ts`
- Modify: `src/features/auth/server-workspace-invitation.ts`
- Modify: `src/app/api/workspaces/[workspaceId]/invitations/route.ts`
- Modify: `src/features/audit/server-audit-log-persistence-core.ts`
- Modify: `tests/workspace-membership-archive-server.spec.ts`
- Modify: `tests/workspace-invitation-server.spec.ts`
- Modify: `tests/workspace-role-status-write-server.spec.ts`
- Modify: `tests/live-audit-log-persistence.spec.ts`

**Interfaces:**
- Produces: `WorkspaceMembershipArchiveAction = "archive" | "restore"`.
- Temporary input compatibility: route accepts `soft_delete` and normalizes it to `archive`; responses and new audit events are canonical.

- [ ] **Step 1: Change tests to canonical request and response values**

```ts
type Action = "archive" | "restore";

expect(body).toMatchObject({
  ok: true,
  action: "archive",
  updatedStatus: "archived",
});
```

Add tests for owner target denial by non-owner actor and for legacy `soft_delete` normalization.

Add an invitation test proving an archived membership email returns `archived_membership_requires_restore` instead of creating another membership. Add status-route tests proving inactive and active transitions emit `workspace.membership_deactivated` and `workspace.membership_reactivated`.

- [ ] **Step 2: Run tests and verify failures**

```bash
npx playwright test tests/workspace-membership-archive-server.spec.ts tests/live-audit-log-persistence.spec.ts --reporter=line
```

- [ ] **Step 3: Implement canonical server types and normalization**

```ts
export type WorkspaceMembershipArchiveAction = "archive" | "restore";

export function normalizeWorkspaceMembershipArchiveAction(value: unknown) {
  if (value === "archive" || value === "restore") return value;
  if (value === "soft_delete") return "archive";
  return null;
}
```

Use `updatedStatus: "archived" | "inactive"`, require a reason only for archive, and map RPC denial strings to stable 401/403/404/409 responses.

- [ ] **Step 4: Emit canonical audit events**

Add `workspace.membership_archived`, `workspace.membership_restored`, `workspace.membership_deactivated`, and `workspace.membership_reactivated` to `liveAuditEventTypes`. New route writes use `workspace.membership_archived`; keep `workspace.membership_soft_deleted` readable for historical events.

The invitation server and its DB RPC must check the same-workspace membership before creating an invitation:

```ts
if (existingMembership?.status === "archived" || existingMembership?.status === "soft_deleted") {
  return { ok: false, status: 409, denialReason: "archived_membership_requires_restore" };
}
```

The status route emits the canonical activate/deactivate event based on the requested next state while preserving the existing generic status-change event only for historical reads.

- [ ] **Step 5: Run tests, typecheck, and commit**

```bash
npx playwright test tests/workspace-membership-archive-server.spec.ts tests/workspace-invitation-server.spec.ts tests/workspace-role-status-write-server.spec.ts tests/live-audit-log-persistence.spec.ts tests/workspace-membership-status-server.spec.ts --reporter=line
npx tsc --noEmit
git add src/features/auth/server-workspace-membership-archive.ts src/features/auth/server-workspace-invitation.ts 'src/app/api/workspaces/[workspaceId]/memberships/[membershipId]/archive/route.ts' 'src/app/api/workspaces/[workspaceId]/memberships/[membershipId]/status/route.ts' 'src/app/api/workspaces/[workspaceId]/invitations/route.ts' src/features/audit/server-audit-log-persistence-core.ts tests/workspace-membership-archive-server.spec.ts tests/workspace-invitation-server.spec.ts tests/workspace-role-status-write-server.spec.ts tests/live-audit-log-persistence.spec.ts
git commit -m "feat(auth): expose canonical member archive API"
```

### Task 5: Add Permission-Role Lifecycle RPC And API

**Files:**
- Add to the CLI-generated lifecycle migration or generate a second migration with: `npx supabase migration new workspace_permission_role_lifecycle`
- Create: `src/features/auth/server-workspace-permission-role-management.ts`
- Create: `src/features/auth/server-workspace-permission-role-lifecycle.ts`
- Create: `src/app/api/workspaces/[workspaceId]/permission-roles/route.ts`
- Create: `src/app/api/workspaces/[workspaceId]/permission-roles/[roleId]/route.ts`
- Create: `src/app/api/workspaces/[workspaceId]/permission-roles/[roleId]/lifecycle/route.ts`
- Create: `tests/workspace-permission-role-management-server.spec.ts`
- Create: `tests/workspace-permission-role-lifecycle-server.spec.ts`
- Create: `tests/workspace-permission-role-lifecycle-migration.spec.ts`

**Interfaces:**
- Input: `{ action: "deactivate"; replacementRoleId: string } | { action: "reactivate" }`.
- RPC: `clair_update_workspace_permission_role_lifecycle(p_workspace_id text, p_role_id uuid, p_action text, p_replacement_role_id uuid default null)`.
- Output: role status, replacement role, affected membership count, affected pending invitation count.
- Management routes: `GET/POST /permission-roles`, `PATCH /permission-roles/[roleId]`, and `GET/POST /permission-roles/[roleId]/lifecycle` for impact preview and mutation.

- [ ] **Step 1: Write authorization and transaction tests**

Cover list, create, and edit permission checks plus unauthenticated, permission missing, non-owner mutating owner, system role protected, cross-workspace role, inactive replacement, same-role replacement, grant-ceiling violation, active/inactive reassignment, archived history preservation, pending invitation reassignment, impact preview, and reactivation without automatic reassignment.

- [ ] **Step 2: Run tests and verify red**

```bash
npx playwright test tests/workspace-permission-role-management-server.spec.ts tests/workspace-permission-role-lifecycle-server.spec.ts tests/workspace-permission-role-lifecycle-migration.spec.ts --reporter=line
```

- [ ] **Step 3: Extend the role table additively**

Add `status text not null default 'active'`, `deactivated_at`, and `deactivated_by_user_id`. Keep `is_assignable` synchronized for existing readers. System roles reject deactivation.

- [ ] **Step 4: Implement the atomic RPC**

Within one transaction/function invocation:

```sql
update public.workspace_membership_permission_role_assignments assignment
set permission_role_id = p_replacement_role_id,
    assigned_by_user_id = auth.uid(),
    updated_at = now()
from public.user_memberships membership
where assignment.workspace_id = p_workspace_id
  and assignment.permission_role_id = p_role_id
  and membership.workspace_id = assignment.workspace_id
  and membership.id = assignment.membership_id
  and membership.status in ('active', 'inactive');
```

Update pending invitation role assignments, then mark the custom role inactive. Do not rewrite archived membership assignments.

- [ ] **Step 5: Implement server-owned role listing, creation, and editing**

`server-workspace-permission-role-management.ts` exposes:

```ts
export type WorkspacePermissionRoleDefinition = {
  id: string;
  workspaceId: string;
  roleKey: string;
  label: string;
  roleType: "owner" | "admin" | "standard" | "custom";
  permissionIds: string[];
  status: "active" | "inactive";
  isSystem: boolean;
  isAssignable: boolean;
  affectedMembershipCount: number;
  pendingInvitationCount: number;
};
```

POST creates only `custom` roles with allow-only permissions below the actor's grant ceiling. PATCH edits label, description, and allowed permission IDs but does not change lifecycle state. GET returns definitions plus impact counts and never exposes rows from another workspace.

- [ ] **Step 6: Implement server authorization and route mapping**

The server helper returns typed denials:

```ts
type PermissionRoleLifecycleDenial =
  | "permission_missing"
  | "owner_scope_required"
  | "system_role_protected"
  | "replacement_role_invalid"
  | "cross_workspace_target"
  | "state_conflict";
```

The route rate-limits the mutation, calls the RPC for Supabase sessions, and emits `workspace.permission_role_deactivated` or `workspace.permission_role_reactivated` with counts and replacement ID in metadata.

- [ ] **Step 7: Verify and commit**

```bash
npx playwright test tests/workspace-permission-role-management-server.spec.ts tests/workspace-permission-role-lifecycle-server.spec.ts tests/workspace-permission-role-lifecycle-migration.spec.ts tests/workspace-last-admin-protection-migration.spec.ts --reporter=line
npx tsc --noEmit
git add supabase/migrations src/features/auth/server-workspace-permission-role-management.ts src/features/auth/server-workspace-permission-role-lifecycle.ts 'src/app/api/workspaces/[workspaceId]/permission-roles/route.ts' 'src/app/api/workspaces/[workspaceId]/permission-roles/[roleId]/route.ts' 'src/app/api/workspaces/[workspaceId]/permission-roles/[roleId]/lifecycle/route.ts' tests/workspace-permission-role-management-server.spec.ts tests/workspace-permission-role-lifecycle-server.spec.ts tests/workspace-permission-role-lifecycle-migration.spec.ts
git commit -m "feat(auth): add permission role lifecycle"
```

### Task 6: Add Job-Position Lifecycle RPC And API

**Files:**
- Add to the CLI-generated lifecycle migration or generate a second migration with: `npx supabase migration new workspace_job_position_lifecycle`
- Create: `src/features/auth/server-workspace-job-position-management.ts`
- Create: `src/features/auth/server-workspace-job-position-lifecycle.ts`
- Create: `src/app/api/workspaces/[workspaceId]/job-positions/route.ts`
- Create: `src/app/api/workspaces/[workspaceId]/job-positions/[positionId]/route.ts`
- Create: `src/app/api/workspaces/[workspaceId]/job-positions/[positionId]/lifecycle/route.ts`
- Create: `tests/workspace-job-position-management-server.spec.ts`
- Create: `tests/workspace-job-position-lifecycle-server.spec.ts`
- Create: `tests/workspace-job-position-lifecycle-migration.spec.ts`

**Interfaces:**
- Input: `{ action: "deactivate"; pendingInvitationReplacementPositionId?: string } | { action: "reactivate" }`.
- RPC: `clair_update_workspace_job_position_lifecycle(p_workspace_id text, p_position_id uuid, p_action text, p_pending_invitation_replacement_position_id uuid default null)`.
- Output: position active state, retained member count, affected pending invitation count, replacement position.
- Management routes: `GET/POST /job-positions`, `PATCH /job-positions/[positionId]`, and `GET/POST /job-positions/[positionId]/lifecycle` for impact preview and mutation.

- [ ] **Step 1: Write failing lifecycle tests**

Cover list, create, and edit permission checks plus retained active/inactive member assignments, retained archived history, pending-invitation replacement required, active same-workspace replacement, cross-workspace denial, new-selection exclusion, impact preview, and reactivation without assignment mutation.

- [ ] **Step 2: Run tests and verify red**

```bash
npx playwright test tests/workspace-job-position-management-server.spec.ts tests/workspace-job-position-lifecycle-server.spec.ts tests/workspace-job-position-lifecycle-migration.spec.ts --reporter=line
```

- [ ] **Step 3: Add deactivation metadata and RPC**

Keep the existing `is_active` source, add `deactivated_at` and `deactivated_by_user_id`, update pending invitation assignments only when needed, and never update membership job assignments during deactivation.

- [ ] **Step 4: Implement server-owned job-position listing, creation, and editing**

`server-workspace-job-position-management.ts` exposes:

```ts
export type WorkspaceJobPositionDefinition = {
  id: string;
  workspaceId: string;
  positionKey: string;
  label: string;
  isSystem: boolean;
  isActive: boolean;
  retainedMembershipCount: number;
  pendingInvitationCount: number;
};
```

POST creates a workspace-scoped custom position. PATCH edits label and description without changing active state. GET returns definitions plus retained-member and pending-invitation counts. All mutations require server-resolved `role_permission:manage` and same-workspace targets.

- [ ] **Step 5: Implement lifecycle route and audit events**

Return `replacement_position_required` when pending invitations exist without a replacement. Emit `workspace.job_position_deactivated` or `workspace.job_position_reactivated` with retained-member and pending-invitation counts.

- [ ] **Step 6: Verify and commit**

```bash
npx playwright test tests/workspace-job-position-management-server.spec.ts tests/workspace-job-position-lifecycle-server.spec.ts tests/workspace-job-position-lifecycle-migration.spec.ts --reporter=line
npx tsc --noEmit
git add supabase/migrations src/features/auth/server-workspace-job-position-management.ts src/features/auth/server-workspace-job-position-lifecycle.ts 'src/app/api/workspaces/[workspaceId]/job-positions/route.ts' 'src/app/api/workspaces/[workspaceId]/job-positions/[positionId]/route.ts' 'src/app/api/workspaces/[workspaceId]/job-positions/[positionId]/lifecycle/route.ts' tests/workspace-job-position-management-server.spec.ts tests/workspace-job-position-lifecycle-server.spec.ts tests/workspace-job-position-lifecycle-migration.spec.ts
git commit -m "feat(auth): add job position lifecycle"
```

### Task 7: Refactor The Member Directory To Canonical Archive UX

**Files:**
- Modify: `src/features/auth/workspace-membership-management.tsx`
- Create: `src/features/auth/workspace-membership-directory.tsx`
- Create: `src/features/auth/workspace-membership-row-actions.tsx`
- Create: `src/features/auth/workspace-membership-detail-sheet.tsx`
- Create: `src/features/auth/workspace-membership-archive-dialog.tsx`
- Modify: `tests/workspace-membership-status-server.spec.ts`
- Modify: `tests/auth.spec.ts`

**Interfaces:**
- `workspace-membership-management.tsx` owns data orchestration and mutually exclusive Sheet/Dialog state.
- Directory consumes normalized member rows and emits `onOpenMember`, `onDeactivate`, `onReactivate`, `onArchive`, and `onRestore` callbacks.
- Archive dialog returns a trimmed non-empty reason.

- [ ] **Step 1: Change UI tests to the approved copy and actions**

Assert `보관됨`, `구성원 보관`, `구성원 복구`, absence of `삭제됨`, absence of 90-day copy, disabled self/owner actions with reasons, row keyboard open, and restore-to-inactive feedback.

- [ ] **Step 2: Run focused UI tests and verify red**

```bash
npx playwright test tests/auth.spec.ts tests/workspace-membership-status-server.spec.ts --reporter=line
```

- [ ] **Step 3: Split feature-local components without adding primitives**

Move presentation and dialog concerns into the four new auth feature files. Reuse existing `Sheet`, `Dialog`, `Table`, `Badge`, `Avatar`, `Select`, `Tabs`, `Tooltip`, `EmrPageHeader`, and `EmrRowActionMenu`.

- [ ] **Step 4: Replace draft query/action values**

Use:

```ts
fetch(`/api/workspaces/${workspaceId}/memberships?includeArchived=true`)
```

and:

```ts
body: JSON.stringify({ action: "archive", reason })
```

Normalize legacy `soft_deleted` rows before rendering so they appear as `보관됨` during the compatibility window.

- [ ] **Step 5: Preserve responsive and accessibility behavior**

Desktop renders the table; narrow view renders compact cards with the same member, role, job, login, and state information. Row `Enter`/`Space`, focus return, Escape close, menu labels, disabled reasons, loading Skeleton, per-filter empty state, and retryable error remain covered.

- [ ] **Step 6: Verify and commit**

```bash
npx playwright test tests/auth.spec.ts tests/workspace-membership-status-server.spec.ts tests/workspace-membership-archive-server.spec.ts --reporter=line
npx eslint src/features/auth/workspace-membership-management.tsx src/features/auth/workspace-membership-directory.tsx src/features/auth/workspace-membership-row-actions.tsx src/features/auth/workspace-membership-detail-sheet.tsx src/features/auth/workspace-membership-archive-dialog.tsx
npx tsc --noEmit
git add src/features/auth tests/auth.spec.ts tests/workspace-membership-status-server.spec.ts tests/workspace-membership-archive-server.spec.ts
git commit -m "feat(hospital-admin): adopt archived member lifecycle"
```

### Task 8: Connect Role And Job Management UI To Server Lifecycle

**Files:**
- Modify: `src/features/auth/workspace-role-permission-management.tsx`
- Create: `src/features/auth/workspace-permission-role-lifecycle-dialog.tsx`
- Create: `src/features/auth/workspace-job-position-lifecycle-dialog.tsx`
- Modify: `src/features/auth/workspace-membership-management.tsx`
- Modify: `tests/workspace-role-management-regression.spec.ts`
- Create: `tests/workspace-role-job-lifecycle-ui.spec.ts`

**Interfaces:**
- Role dialog consumes impact counts and active replacement roles, then POSTs `deactivate` or `reactivate`.
- Job dialog consumes retained-member/pending-invitation counts and requests replacement only when the server reports pending invitation references.
- Invitation and member edit Select components receive only active/assignable definitions.

- [ ] **Step 1: Write UI tests for role and job lifecycle**

Cover system-role protection, replacement-role requirement, impact counts, pending-invitation replacement, retained `비활성 직무` Badge, exclusion from new selections, reactivation, loading, permission denial, and retryable failures.

- [ ] **Step 2: Run tests and verify red**

```bash
npx playwright test tests/workspace-role-management-regression.spec.ts tests/workspace-role-job-lifecycle-ui.spec.ts --reporter=line
```

- [ ] **Step 3: Replace session-only disable mutations with server calls**

Remove direct array mutation from `disable(key)`. Fetch lifecycle definitions and impact counts from server-owned endpoints, then update local state only from successful canonical responses.

- [ ] **Step 4: Implement dialogs and active-only selectors**

Role dialog always requires a replacement for a custom role. Job dialog requires a replacement only for pending invitations. Existing member rows retain inactive positions and show `비활성 직무`; invitation/member edit dropdowns filter inactive definitions.

- [ ] **Step 5: Verify and commit**

```bash
npx playwright test tests/workspace-role-management-regression.spec.ts tests/workspace-role-job-lifecycle-ui.spec.ts tests/auth.spec.ts --reporter=line
npx eslint src/features/auth/workspace-role-permission-management.tsx src/features/auth/workspace-permission-role-lifecycle-dialog.tsx src/features/auth/workspace-job-position-lifecycle-dialog.tsx src/features/auth/workspace-membership-management.tsx
npx tsc --noEmit
git add src/features/auth tests/workspace-role-management-regression.spec.ts tests/workspace-role-job-lifecycle-ui.spec.ts tests/auth.spec.ts
git commit -m "feat(hospital-admin): connect role and job lifecycle UI"
```

### Task 9: Run Full Local Security And Regression Verification

**Files:**
- Update: `docs/work/hospital-admin/HOSPITAL-ADMIN-PR-004-membership-directory-soft-delete.md`
- Update: `docs/completed/hospital-admin/2026-07-11-hospital-membership-role-job-lifecycle-contract-report.html`

**Interfaces:**
- Consumes all prior task outputs.
- Produces an evidence-backed local completion record without claiming remote deployment.

- [ ] **Step 1: Replay and query the local database**

```bash
npx supabase db reset --local --yes
npx supabase migration list --local
npx supabase db lint --local --schema public,private --fail-on error
```

Expected: all migrations and seed complete. Lifecycle tables/functions have RLS or explicit privileged function boundaries. Report unrelated pre-existing advisor findings separately; do not enable RLS on unrelated tables without policies.

- [ ] **Step 2: Run the focused server and UI suite**

```bash
npx playwright test tests/workspace-membership-archive-migration.spec.ts tests/workspace-membership-archive-server.spec.ts tests/workspace-membership-status-server.spec.ts tests/workspace-permission-role-lifecycle-server.spec.ts tests/workspace-job-position-lifecycle-server.spec.ts tests/workspace-role-management-regression.spec.ts tests/workspace-role-job-lifecycle-ui.spec.ts tests/auth.spec.ts --reporter=line
```

- [ ] **Step 3: Run repository gates**

```bash
npx tsc --noEmit
npm run lint
npm run docs:check
npm run build
npm run security:secrets
```

- [ ] **Step 4: Perform desktop and narrow browser QA**

Verify member directory, archive/restore Dialog, detail Sheet, role replacement, job-position deactivation, pending invitation replacement, focus return, keyboard activation, error recovery, and no `삭제됨`/90-day copy.

- [ ] **Step 5: Update docs and commit the local completion record**

```bash
git add docs/work/hospital-admin/HOSPITAL-ADMIN-PR-004-membership-directory-soft-delete.md docs/completed/hospital-admin/2026-07-11-hospital-membership-role-job-lifecycle-contract-report.html
git commit -m "docs(hospital-admin): record lifecycle implementation verification"
```

### Task 10: Reconcile Remote Migration History And Deploy Behind An Approval Gate

**Files:**
- Update with a dedicated reconciliation section: `docs/work/hospital-admin/HOSPITAL-ADMIN-PR-004-membership-directory-soft-delete.md`
- Update after success: `docs/completed/hospital-admin/2026-07-11-hospital-membership-role-job-lifecycle-contract-report.html`

**Interfaces:**
- Consumes: approved local migrations and the linked remote project's migration-history rows.
- Produces: a reviewed mapping, an explicit remote operation packet, and post-deploy schema/RPC/browser evidence.

- [ ] **Step 1: Collect read-only remote evidence**

```bash
npx supabase migration list --linked
npx supabase db push --linked --dry-run
npx supabase db query --linked "select version from supabase_migrations.schema_migrations order by version;"
```

Record local-only, remote-only, equivalent-renamed, and pending versions. Do not print credentials, pooler URLs, access tokens, or passwords in the reconciliation document.

- [ ] **Step 2: Map every remote-only version to a source migration or mark it unexplained**

For each version, compare schema objects and migration intent. The report must contain the exact version, local equivalent when proven, evidence query, and proposed action. An unexplained version blocks repair and deployment.

- [ ] **Step 3: Prepare the exact approval packet**

The packet lists:

* migration-history rows that would be marked applied or reverted;
* schema migrations that would be pushed;
* expected locks and affected tables/functions;
* rollback or forward-fix strategy;
* synthetic post-deploy queries;
* confirmation that no real patient, guardian, payment, or identity data is touched.

Stop and request explicit approval for the exact remote mutations.

- [ ] **Step 4: After approval, repair only reviewed history rows and dry-run again**

Use only the fully expanded `supabase migration repair --linked --status applied|reverted VERSION` commands copied from the approved packet; do not infer or batch unreviewed versions. Then run:

```bash
npx supabase db push --linked --dry-run
```

Expected: only the reviewed forward lifecycle migrations remain pending.

- [ ] **Step 5: Push schema and verify remote contracts**

```bash
npx supabase db push --linked
npx supabase db query --linked "select column_name from information_schema.columns where table_schema='public' and table_name='user_memberships' and column_name like 'archived%';"
npx supabase db query --linked "select oid::regprocedure::text from pg_proc where pronamespace='public'::regnamespace and proname in ('clair_archive_workspace_membership','clair_update_workspace_permission_role_lifecycle','clair_update_workspace_job_position_lifecycle') order by 1;"
```

- [ ] **Step 6: Deploy application code and run synthetic browser QA**

Verify the deployed Cheongdam synthetic workspace reads server data without the browser fallback banner, archives and restores a synthetic non-owner member, blocks protected actions, replaces a custom role, deactivates a job position, and emits audit events.

- [ ] **Step 7: Update completion claims**

Record exact migration versions, deployment URL, verification commands, results, and remaining global RLS findings. Do not claim global RLS completeness or production launch readiness from this feature deployment.

## Plan Completion Criteria

* All tasks are implemented through TDD with focused commits.
* Local fresh replay succeeds from an empty Docker Supabase database.
* The canonical archive, role replacement, and job-position retention contracts pass DB, server, and UI tests.
* Remote migration history is mapped and reviewed before repair.
* Remote schema and application deployment occur only after explicit mutation approval.
* Deployed synthetic browser QA shows server-backed data with no membership fallback banner.
* Legacy `soft_deleted` read compatibility remains for one rollout window; legacy removal is a later separately reviewed migration.
