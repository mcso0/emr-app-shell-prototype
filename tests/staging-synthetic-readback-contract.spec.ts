import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const readbackSql = readFileSync(
  "supabase/snippets/den-195_staging_synthetic_dataset_readback.sql",
  "utf8"
);
const resetContract = readFileSync(
  "docs/engineering/operations/staging-pilot-readback-reset-contract.md",
  "utf8"
);

function withoutSqlComments(sql: string) {
  return sql
    .replace(/--.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .toLowerCase();
}

test("DEN-195 readback SQL is read-only and scoped to staging fixtures", () => {
  const executableSql = withoutSqlComments(readbackSql);

  expect(executableSql).toContain("select jsonb_build_object");
  expect(executableSql).toContain("workspace_id = 'clair-demo'");
  expect(executableSql).toContain("den-194-g-%");
  expect(executableSql).toContain("p-den194-%");
  expect(executableSql).toContain("inv-den194-%");

  expect(executableSql).not.toMatch(/\b(insert|update|delete|truncate|drop|alter|create|grant|revoke)\b/);
});

test("DEN-195 readback SQL covers expected fixture groups and replay scenarios", () => {
  for (const fixture of [
    "guardians",
    "patients",
    "encounters",
    "orders",
    "order_events",
    "invoices",
    "invoice_lines",
    "payments",
    "audit_events",
    "patient_staff_assignments",
  ]) {
    expect(readbackSql).toContain(fixture);
  }

  for (const scenarioCode of [
    "kong-vomit",
    "nabi-urinary",
    "bori-allergy",
    "mango-wellness",
    "choco-rehab",
  ]) {
    expect(readbackSql).toContain(scenarioCode);
  }
});

test("DEN-195 reset contract prefers seed replay over direct SQL repair", () => {
  expect(resetContract).toContain("npx supabase db push --include-seed --dry-run");
  expect(resetContract).toContain("npx supabase db push --include-seed");
  expect(resetContract).toContain("npx supabase db query --linked --file supabase/seed.sql --output json");
  expect(resetContract).toContain("Avoid ad hoc direct SQL mutation");
  expect(resetContract).toContain("DEN-192 can start app-level pilot replay");
});
