import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/20260518024708_workspace_membership_rls_baseline.sql",
  "utf8"
);
const helperGrantMigration = readFileSync(
  "supabase/migrations/20260518113052_workspace_rls_helper_function_grants.sql",
  "utf8"
);

test("workspace membership RLS baseline uses private membership helpers", () => {
  expect(migration).toContain("private.clair_is_active_workspace_member");
  expect(migration).toContain("private.clair_is_workspace_admin");
  expect(migration).toContain("security definer");
  expect(migration).toContain("auth.uid()");
  expect(migration).not.toMatch(/user_metadata|raw_user_meta_data/i);
});

test("workspace membership RLS baseline separates member reads from admin writes", () => {
  for (const table of [
    "workspaces",
    "users",
    "user_profiles",
    "user_memberships",
    "workspace_invitations",
    "permission_policies",
  ]) {
    expect(migration).toContain(`alter table public.${table} enable row level security`);
  }

  expect(migration).toContain("to authenticated");
  expect(migration).toContain("workspaces_select_active_member");
  expect(migration).toContain("user_memberships_select_active_member");
  expect(migration).toContain("user_memberships_update_admin");
  expect(migration).toContain("workspace_invitations_insert_admin");
  expect(migration).toContain("permission_policies_update_admin");
  expect(migration).not.toMatch(/to anon/i);
});

test("workspace membership RLS baseline pins policies to the row workspace", () => {
  expect(migration).toContain("membership.workspace_id = p_workspace_id");
  expect(migration).toContain("membership.user_id = auth.uid()");
  expect(migration).toContain("private.clair_is_active_workspace_member(workspace_id)");
  expect(migration).toContain("private.clair_is_workspace_admin(workspace_id)");
  expect(migration).not.toContain("workspace_id = auth.uid()");
});

test("workspace membership RLS grants authenticated policy access to private helpers", () => {
  expect(helperGrantMigration).toContain("grant usage on schema private to authenticated");
  expect(helperGrantMigration).toContain(
    "grant execute on function private.clair_is_active_workspace_member(text) to authenticated"
  );
  expect(helperGrantMigration).toContain(
    "grant execute on function private.clair_is_workspace_admin(text) to authenticated"
  );
  expect(helperGrantMigration).toContain(
    "revoke all on function private.clair_is_active_workspace_member(text) from anon"
  );
  expect(helperGrantMigration).toContain(
    "revoke all on function private.clair_is_workspace_admin(text) from anon"
  );
});
