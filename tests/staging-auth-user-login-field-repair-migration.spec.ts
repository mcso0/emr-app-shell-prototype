import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/20260521070445_staging_synthetic_auth_user_login_field_repair.sql",
  "utf8"
);

test("DEN-201 migration normalizes synthetic auth user fields required by hosted password login", () => {
  expect(migration).toContain("DEN-201");
  expect(migration).toContain("update auth.users");
  expect(migration).toContain("instance_id = '00000000-0000-0000-0000-000000000000'::uuid");
  expect(migration).toContain("confirmation_token = coalesce(confirmation_token, '')");
  expect(migration).toContain("recovery_token = coalesce(recovery_token, '')");
  expect(migration).toContain("email_change_token_current = coalesce(email_change_token_current, '')");
  expect(migration).toContain("reauthentication_token = coalesce(reauthentication_token, '')");
  expect(migration).toContain("is_sso_user = false");
  expect(migration).toContain("is_anonymous = false");
  expect(migration).toContain("'admin@clair.local'");
  expect(migration).toContain("'no-membership@clair.local'");
});

test("DEN-201 migration stays scoped to synthetic fixture auth users", () => {
  expect(migration).toContain("where email in");
  expect(migration).toContain("@clair.local");
  expect(migration).not.toContain("confirmed_at =");
  expect(migration).not.toMatch(/service_role|supabase_secret|db_password/i);
  expect(migration).not.toMatch(/real patient|real guardian/i);
  expect(migration).not.toContain("delete from auth.users");
  expect(migration).not.toContain("truncate");
});
