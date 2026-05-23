import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const seed = readFileSync("supabase/seed.sql", "utf8");
const replaySql = readFileSync(
  "supabase/snippets/den-197_role_tenant_audit_isolation_replay.sql",
  "utf8"
);
const den197Start = seed.indexOf("-- DEN-197:");
const den197End = seed.indexOf("-- DEN-194:", den197Start);
const den197Seed = seed.slice(den197Start, den197End);

function withoutSqlComments(sql: string) {
  return sql
    .replace(/--.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .toLowerCase();
}

test("DEN-197 seed declares tenant isolation actors without production data", () => {
  expect(den197Seed).toContain("role_tenant_audit_isolation_seed_contract_version:2026-05-21-den-197");
  expect(den197Seed).toContain("'clair-foreign-demo'");
  expect(den197Seed).toContain("'foreign-admin@clair.local'");
  expect(den197Seed).toContain("'inactive-front-desk@clair.local'");
  expect(den197Seed).toContain("'no-membership@clair.local'");
  expect(den197Seed).toContain("'DEN-197 Foreign Admin'");
  expect(den197Seed).toContain("'DEN-197 Inactive Front Desk'");
  expect(den197Seed).toContain("'DEN-197 No Membership Actor'");

  expect(den197Seed).not.toMatch(/real clinic|real patient|real identity|real staff/i);
});

test("DEN-197 replay SQL exercises RLS actors and stays transaction scoped", () => {
  const executableSql = withoutSqlComments(replaySql);

  for (const actor of [
    "00000000-0000-4000-8000-000000000001",
    "00000000-0000-4000-8000-000000000012",
    "00000000-0000-4000-8000-000000000013",
    "00000000-0000-4000-8000-000000000014",
  ]) {
    expect(replaySql).toContain(actor);
  }

  expect(executableSql).toContain("set local role authenticated");
  expect(executableSql).toContain("request.jwt.claim.sub");
  expect(executableSql).toContain("rollback");
  expect(executableSql).toContain("clair-foreign-demo");
  expect(executableSql).toContain("canseeforeignworkspace");
  expect(executableSql).toContain("canseeanyworkspace");

  expect(executableSql).not.toMatch(/\b(insert|update|delete|truncate|drop|alter|create|grant|revoke)\b/);
});

test("DEN-197 replay SQL covers permissions, audit, and unsafe payload checks", () => {
  for (const token of [
    "permissionMatrix",
    "auditCoverage",
    "unsafeAuditPayloadChecks",
    "serviceRoleMentions",
    "secretMentions",
    "foreignWorkspaceHiddenFromClairAdmin",
    "foreignWorkspaceVisibleToForeignAdmin",
    "inactiveMemberExists",
    "noMembershipActorHasNoMembership",
  ]) {
    expect(replaySql).toContain(token);
  }
});
