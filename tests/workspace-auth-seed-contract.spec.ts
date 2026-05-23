import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const seed = readFileSync("supabase/seed.sql", "utf8");
const validationDoc = readFileSync(
  "docs/engineering/auth-security/auth-login/workspace-auth-local-validation-and-seed.md",
  "utf8"
);

test("workspace auth seed contract creates deterministic MVP users and memberships", () => {
  expect(seed).toContain("insert into auth.users");
  expect(seed).toContain("insert into auth.identities");
  expect(seed).toContain("insert into public.workspaces");
  expect(seed).toContain("insert into public.user_memberships");
  expect(seed).toContain("'clair-demo'");
  expect(seed).toContain("'hospital_admin'");
  expect(seed).toContain("'vet'");
  expect(seed).toContain("'technician'");
  expect(seed).toContain("'front_desk'");
  expect(seed).toContain("workspace_auth_seed_contract_version");
});

test("workspace auth seed contract qualifies pgcrypto functions for remote Supabase", () => {
  expect(seed).toContain("extensions.crypt('local-password', extensions.gen_salt('bf'))");
  expect(seed).not.toContain("crypt('local-password', gen_salt('bf'))");
});

test("workspace auth seed contract creates email identities for Supabase password login", () => {
  const identitySeedStart = seed.indexOf("DEN-200: Supabase Auth email identities");
  const identitySeedEnd = seed.indexOf("DEN-201: normalize synthetic Supabase Auth users", identitySeedStart);
  const identitySeed = seed.slice(identitySeedStart, identitySeedEnd);

  expect(identitySeedStart).toBeGreaterThanOrEqual(0);
  expect(identitySeed).toContain("provider_id");
  expect(identitySeed).toContain("identity_data");
  expect(identitySeed).toContain("'email_verified', true");
  expect(identitySeed).toContain("on conflict (provider_id, provider) do update");
  expect(identitySeed).not.toMatch(/updated_at,\s*email/);
  expect(identitySeed).not.toContain("email = excluded.email");

  for (const email of [
    "admin@clair.local",
    "vet@clair.local",
    "technician@clair.local",
    "front-desk@clair.local",
  ]) {
    expect(identitySeed).toContain(email);
  }
});

test("workspace auth seed contract normalizes synthetic Auth user login fields", () => {
  const authUserSeedStart = seed.indexOf("DEN-201: normalize synthetic Supabase Auth users");
  const authUserSeedEnd = seed.indexOf("insert into public.guardians", authUserSeedStart);
  const authUserSeed = seed.slice(authUserSeedStart, authUserSeedEnd);

  expect(authUserSeedStart).toBeGreaterThanOrEqual(0);
  expect(authUserSeed).toContain("update auth.users");
  expect(authUserSeed).toContain("instance_id = '00000000-0000-0000-0000-000000000000'::uuid");
  expect(authUserSeed).toContain("confirmation_token = coalesce(confirmation_token, '')");
  expect(authUserSeed).toContain("email_change_token_current = coalesce(email_change_token_current, '')");
  expect(authUserSeed).toContain("reauthentication_token = coalesce(reauthentication_token, '')");
  expect(authUserSeed).toContain("where email in");
  expect(authUserSeed).toContain("'admin@clair.local'");
  expect(authUserSeed).toContain("'no-membership@clair.local'");
  expect(authUserSeed).not.toContain("confirmed_at =");
  expect(authUserSeed).not.toMatch(/service_role|supabase_secret|db_password/i);
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
