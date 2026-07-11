import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";

const source = readFileSync(
  "supabase/migrations/20260711164114_workspace_permission_role_lifecycle.sql",
  "utf8"
);

test("permission role lifecycle adds inactive metadata and keeps assignment compatibility", () => {
  expect(source).toContain("status text not null default 'active'");
  expect(source).toContain("deactivated_at");
  expect(source).toContain("deactivated_by_user_id");
  expect(source).toContain("is_assignable = false");
});

test("permission role deactivation atomically reassigns active and inactive members only", () => {
  expect(source).toContain("public.clair_update_workspace_permission_role_lifecycle");
  expect(source).toContain("membership.status in ('active', 'inactive')");
  expect(source).toContain("invitation.status = 'pending'");
  expect(source).toContain("system_role_protected");
  expect(source).toContain("replacement_role_invalid");
  expect(source).toContain("owner_scope_required");
  expect(source).not.toMatch(/delete\s+from\s+public\.workspace_permission_roles/i);
});

test("permission role lifecycle RPC is narrowly granted", () => {
  expect(source).toContain("security definer");
  expect(source).toContain("set search_path = public, private, extensions");
  expect(source).toContain("from public, anon");
  expect(source).toContain("to authenticated");
});
