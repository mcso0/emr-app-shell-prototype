import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const seed = readFileSync("supabase/seed.sql", "utf8");
const validationDoc = readFileSync(
  "docs/engineering/auth-security/auth-login/workspace-auth-local-validation-and-seed.md",
  "utf8"
);

test("workspace auth seed contract creates deterministic MVP users and memberships", () => {
  expect(seed).toContain("insert into auth.users");
  expect(seed).toContain("insert into public.workspaces");
  expect(seed).toContain("insert into public.user_memberships");
  expect(seed).toContain("'clair-demo'");
  expect(seed).toContain("'hospital_admin'");
  expect(seed).toContain("'vet'");
  expect(seed).toContain("'technician'");
  expect(seed).toContain("'front_desk'");
  expect(seed).toContain("workspace_auth_seed_contract_version");
});

test("workspace auth seed contract documents legacy role compatibility outside canonical roles", () => {
  expect(seed).toContain("legacy role compatibility");
  expect(seed).toContain("nurse -> technician");
  expect(seed).toContain("billing_admin -> hospital_admin");
  expect(seed).not.toMatch(/array\\[[^\\]]*'nurse'/);
  expect(seed).not.toMatch(/array\\[[^\\]]*'billing_admin'/);

  expect(validationDoc).toContain("nurse -> technician");
  expect(validationDoc).toContain("billing_admin -> hospital_admin");
  expect(validationDoc).toContain("npx supabase db reset --local");
});
