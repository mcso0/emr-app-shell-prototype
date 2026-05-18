import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/20260518024425_workspace_last_admin_protection_foundation.sql",
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
