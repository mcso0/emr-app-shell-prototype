import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const canonicalRoles = ["hospital_admin", "vet", "technician", "front_desk"];
const legacyRoles = ["nurse", "billing_admin"];
const matrixDocPath =
  "docs/engineering/auth-security/auth-login/saas-launch-role-permission-matrix.md";

test("SaaS launch role matrix document freezes canonical roles and legacy handling", () => {
  const document = readFileSync(matrixDocPath, "utf8");

  for (const role of canonicalRoles) {
    expect(document).toContain(`\`${role}\``);
  }

  expect(document).toContain("Launch Permission Matrix");
  expect(document).toContain("Invitation Eligibility");
  expect(document).toContain("Management Authority");
  expect(document).toContain("Server Enforcement Mapping");
  expect(document).toContain("Follow-Up Required");

  for (const role of legacyRoles) {
    expect(document).toContain(`\`${role}\``);
  }

  expect(document).toContain("not a canonical SaaS launch role");
});

test("canonical role source, resolver, DB adapter, and seed stay aligned", () => {
  const productDoc = readFileSync("docs/product/domain/workspace-auth-permissions.md", "utf8");
  const sourceMap = readFileSync("docs/product/domain/role-permission-source-map.md", "utf8");
  const resolver = readFileSync("src/features/auth/permission-resolver.ts", "utf8");
  const dbAdapter = readFileSync(
    "src/features/auth/db-workspace-permission-adapter-core.ts",
    "utf8"
  );
  const seed = readFileSync("supabase/seed.sql", "utf8");

  for (const role of canonicalRoles) {
    expect(productDoc).toContain(`\`${role}\``);
    expect(sourceMap).toContain(`\`${role}\``);
    expect(resolver).toContain(`${role}:`);
    expect(dbAdapter).toContain(`role === "${role}"`);
    expect(seed).toContain(`'${role}'`);
  }

  for (const role of legacyRoles) {
    expect(seed).not.toContain(`array['${role}']`);
    expect(productDoc).toContain(`\`${role}\``);
    expect(sourceMap).toContain(`\`${role}\``);
  }
});
