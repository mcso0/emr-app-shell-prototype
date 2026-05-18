import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/20260518023715_workspace_auth_schema_foundation.sql",
  "utf8"
);

test("workspace auth schema migration defines the MVP auth foundation tables", () => {
  for (const table of [
    "users",
    "workspaces",
    "user_profiles",
    "user_memberships",
    "workspace_invitations",
    "permission_policies",
  ]) {
    expect(migration).toContain(`create table if not exists public.${table}`);
    expect(migration).toContain(`alter table public.${table} enable row level security`);
  }
});

test("workspace auth schema migration pins role, status, and workspace constraints", () => {
  expect(migration).toContain("auth.users(id)");
  expect(migration).toContain("roles <@ public.clair_workspace_role_values()");
  expect(migration).toContain("cardinality(roles) > 0");
  expect(migration).toContain("unique (workspace_id, user_id)");
  expect(migration).toContain("workspace_invitations_pending_email_key");
  expect(migration).toContain("permission_policies_role_scope_key");
  expect(migration).not.toMatch(/create policy/i);
});
