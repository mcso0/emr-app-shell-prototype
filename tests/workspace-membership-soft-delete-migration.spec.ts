import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const migrationPath =
  "supabase/migrations/20260711150000_workspace_membership_soft_delete_lifecycle.sql";

test("soft-delete migration preserves memberships and exposes a guarded archive lifecycle", () => {
  const migration = readFileSync(migrationPath, "utf8");

  expect(migration).toContain("'soft_deleted'");
  expect(migration).toContain("deleted_at");
  expect(migration).toContain("deleted_by_user_id");
  expect(migration).toContain("deleted_reason");
  expect(migration).toContain("restored_at");
  expect(migration).toContain("restored_by_user_id");
  expect(migration).toContain("private.archive_workspace_membership");
  expect(migration).toContain("public.clair_archive_workspace_membership");
  expect(migration).toContain("self_action_protected");
  expect(migration).toContain("last_active_workspace_owner_protected");
  expect(migration).toContain("status = 'inactive'");
  expect(migration).not.toMatch(/delete\s+from\s+public\.user_memberships/i);
});

test("soft-delete migration records audit event types without enabling hard delete", () => {
  const migration = readFileSync(migrationPath, "utf8");

  expect(migration).toContain("workspace.membership_soft_deleted");
  expect(migration).toContain("workspace.membership_restored");
  expect(migration).not.toMatch(/hard[_ -]?delete/i);
});
