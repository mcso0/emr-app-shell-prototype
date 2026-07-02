import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/20260518024425_workspace_last_admin_protection_foundation.sql",
  "utf8"
);
const roleModelMigration = readFileSync(
  "supabase/migrations/20260702090000_workspace_permission_role_model_foundation.sql",
  "utf8"
);

test("last-admin protection migration keeps privileged helpers in a private schema", () => {
  expect(migration).toContain("create schema if not exists private");
  expect(migration).toContain("private.clair_assert_not_last_active_hospital_admin");
  expect(migration).toContain("private.update_workspace_membership_roles");
  expect(migration).toContain("security definer");
  expect(migration).not.toMatch(/create function public\\.update_workspace_membership_roles/i);
});

test("last-admin protection migration blocks unsafe direct membership updates", () => {
  expect(migration).toContain("before update or delete on public.user_memberships");
  expect(migration).toContain("last_active_hospital_admin_protected");
  expect(migration).toContain("roles @> array['hospital_admin']::text[]");
  expect(migration).toContain("id <> old.id");
  expect(migration).toContain("revoke all on function private.update_workspace_membership_roles");
});

test("workspace permission role model protects the last active owner assignment", () => {
  expect(roleModelMigration).toContain("private.clair_assert_not_last_active_workspace_owner");
  expect(roleModelMigration).toContain("last_active_workspace_owner_protected");
  expect(roleModelMigration).toContain("role.role_type = 'owner'");
  expect(roleModelMigration).toContain("workspace_membership_permission_role_assignments");
  expect(roleModelMigration).toContain("protect_last_active_workspace_owner_assignment");
  expect(roleModelMigration).toContain("protect_last_active_workspace_owner_membership");
  expect(roleModelMigration).toContain("before update or delete on public.workspace_membership_permission_role_assignments");
  expect(roleModelMigration).toContain("before update or delete on public.user_memberships");
  expect(roleModelMigration).toContain("revoke all on function private.clair_assert_not_last_active_workspace_owner");
});

test("workspace permission role model keeps legacy hospital_admin guard compatible", () => {
  expect(migration).toContain("roles @> array['hospital_admin']::text[]");
  expect(roleModelMigration).toContain("m.roles @> array['hospital_admin']::text[]");
  expect(roleModelMigration).toContain("role_key = 'owner'");
  expect(roleModelMigration).not.toMatch(/alter\s+table\s+public\.user_memberships\s+drop\s+constraint/i);
});
