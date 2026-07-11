import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

const migrationsDirectory = join(process.cwd(), "supabase/migrations");
const receptionFoundation = readFileSync(
  join(migrationsDirectory, "20260519090000_reception_domain_schema_foundation.sql"),
  "utf8"
);
const receptionLookupReader = readFileSync(
  join(migrationsDirectory, "20260519100000_reception_patient_guardian_lookup_reader.sql"),
  "utf8"
);

test("reception foundation defines patient weight before the lookup reader uses it", () => {
  expect(receptionFoundation).toContain("weight_kg numeric(6,2)");
  expect(receptionLookupReader).toContain("'weightKg', weight_kg");
});
