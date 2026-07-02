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
const roleModelMigration = readFileSync(
  "supabase/migrations/20260702090000_workspace_permission_role_model_foundation.sql",
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

test("workspace permission role model RLS uses owner/admin dual-read helpers", () => {
  expect(roleModelMigration).toContain("private.clair_is_workspace_owner");
  expect(roleModelMigration).toContain("private.clair_is_workspace_admin");
  expect(roleModelMigration).toContain("workspace_permission_roles");
  expect(roleModelMigration).toContain("workspace_membership_permission_role_assignments");
  expect(roleModelMigration).toContain("role.role_type in ('owner', 'admin')");
  expect(roleModelMigration).toContain("membership.roles @> array['hospital_admin']::text[]");
  expect(roleModelMigration).not.toMatch(/raw_user_meta_data|user_metadata/i);
});

test("workspace permission role model RLS separates active-member reads from admin writes", () => {
  for (const table of [
    "workspace_permission_roles",
    "workspace_job_positions",
    "workspace_membership_permission_role_assignments",
    "workspace_membership_job_position_assignments",
  ]) {
    expect(roleModelMigration).toContain(`grant select, insert, update, delete on public.${table} to authenticated`);
    expect(roleModelMigration).toContain(`${table}_select_active_member`);
    expect(roleModelMigration).toContain(`${table}_insert_admin`);
    expect(roleModelMigration).toContain(`${table}_update_admin`);
    expect(roleModelMigration).toContain(`${table}_delete_admin`);
  }

  for (const table of [
    "workspace_invitation_permission_role_assignments",
    "workspace_invitation_job_position_assignments",
  ]) {
    expect(roleModelMigration).toContain(`grant select, insert, update, delete on public.${table} to authenticated`);
    expect(roleModelMigration).toContain(`${table}_select_admin`);
    expect(roleModelMigration).toContain(`${table}_insert_admin`);
    expect(roleModelMigration).toContain(`${table}_update_admin`);
    expect(roleModelMigration).toContain(`${table}_delete_admin`);
  }

  expect(roleModelMigration).toContain("to authenticated");
  expect(roleModelMigration).not.toMatch(/create policy[\s\S]+to anon/i);
});

test("workspace permission role model grants authenticated policy access to new private helpers", () => {
  expect(roleModelMigration).toContain("grant usage on schema private to authenticated");
  expect(roleModelMigration).toContain(
    "grant execute on function private.clair_is_workspace_owner(text) to authenticated"
  );
  expect(roleModelMigration).toContain(
    "grant execute on function private.clair_is_workspace_admin(text) to authenticated"
  );
  expect(roleModelMigration).toContain(
    "revoke all on function private.clair_is_workspace_owner(text) from anon"
  );
  expect(roleModelMigration).toContain(
    "revoke all on function private.clair_is_workspace_admin(text) from anon"
  );
});
