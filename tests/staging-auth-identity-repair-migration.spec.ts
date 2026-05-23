import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/20260521064408_staging_synthetic_auth_identity_repair.sql",
  "utf8"
);

test("DEN-200 migration repairs synthetic Supabase email identities only", () => {
  expect(migration).toContain("DEN-200");
  expect(migration).toContain("insert into auth.identities");
  expect(migration).toContain("from auth.users users");
  expect(migration).toContain("on conflict (provider_id, provider) do update");
  expect(migration).toContain("'email_verified', true");
  expect(migration).toContain("'admin@clair.local'");

  expect(migration).not.toMatch(/updated_at,\s*email/);
  expect(migration).not.toContain("email = excluded.email");
  expect(migration).not.toMatch(/service[_-]?role|db_password|real patient|real guardian/i);
});
