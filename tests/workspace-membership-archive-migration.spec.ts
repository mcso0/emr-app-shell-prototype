import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";

const migrationPath =
  "supabase/migrations/20260711162828_workspace_membership_archive_lifecycle.sql";
const migration = readFileSync(migrationPath, "utf8");

test("archive migration adds canonical metadata with legacy read compatibility", () => {
  expect(migration).toContain("'archived'");
  expect(migration).toContain("archived_at");
  expect(migration).toContain("archived_by_user_id");
  expect(migration).toContain("archived_reason");
  expect(migration).toContain("information_schema.columns");
  expect(migration).toContain("'soft_deleted'");
  expect(migration).not.toMatch(/delete\s+from\s+public\.user_memberships/i);
});

test("archive RPC accepts canonical and legacy actions and restores to inactive", () => {
  expect(migration).toContain("public.clair_archive_workspace_membership");
  expect(migration).toContain("p_action in ('archive', 'soft_delete')");
  expect(migration).toContain("status = 'inactive'");
  expect(migration).toContain("last_active_workspace_owner_protected");
  expect(migration).toContain("self_action_protected");
  expect(migration).toContain("role_permission:manage required");
});

test("member reader emits canonical archive metadata and excludes archived rows by default", () => {
  expect(migration).toContain("public.clair_list_workspace_member_statuses");
  expect(migration).toContain("p_include_deleted boolean default false");
  expect(migration).toContain("'archivedAt'");
  expect(migration).toContain("'archivedByUserId'");
  expect(migration).toContain("'archivedReason'");
  expect(migration).toContain("membership.status not in ('archived', 'soft_deleted')");
});

test("archive migration backfills after relaxing the legacy constraint and blocks direct transitions", () => {
  const dropIndex = migration.indexOf("drop constraint if exists user_memberships_status_check");
  const backfillIndex = migration.indexOf("update public.user_memberships");
  expect(dropIndex).toBeGreaterThan(-1);
  expect(dropIndex).toBeLessThan(backfillIndex);
  expect(migration).toContain("membership_lifecycle_rpc_required");
  expect(migration).toContain("clair.membership_archive_rpc");
  expect(migration).toContain("before update on public.user_memberships");
  expect(migration).toContain("old.archived_reason is distinct from new.archived_reason");
  expect(migration).toContain("old.restored_by_user_id is distinct from new.restored_by_user_id");
});

test("archive migration keeps security-definer RPC execution narrowly granted", () => {
  expect(migration).toContain("security definer");
  expect(migration).toContain("set search_path = public, private, extensions");
  expect(migration).toContain(
    "revoke all on function public.clair_archive_workspace_membership(text, uuid, text, text, text) from public, anon"
  );
  expect(migration).toContain(
    "grant execute on function public.clair_archive_workspace_membership(text, uuid, text, text, text) to authenticated"
  );
  expect(migration).toContain(
    "revoke insert on table public.user_memberships from authenticated"
  );
  expect(migration).not.toContain("and 'hospital_admin'=any(membership.roles)");
});

test("archive migration routes matching emails to restore instead of duplicate invitations", () => {
  expect(migration).toContain("archived_membership_requires_restore");
  expect(migration).toContain("existing_membership_requires_status_change");
  expect(migration).toContain("before insert on public.workspace_invitations");
});

test("archive migration permits canonical lifecycle audit events while preserving legacy history", () => {
  expect(migration).toContain("'workspace.membership_archived'");
  expect(migration).toContain("'workspace.membership_deactivated'");
  expect(migration).toContain("'workspace.membership_reactivated'");
  expect(migration).toContain("'workspace.membership_restored'");
  expect(migration).toContain("'workspace.membership_soft_deleted'");
  expect(migration).toContain("audit_events_event_type_check");
  expect(migration).toContain("live_audit_events_event_type_check");
  expect(migration).toContain("public.clair_append_audit_event");
});
