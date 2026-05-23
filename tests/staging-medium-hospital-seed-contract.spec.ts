import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const seed = readFileSync("supabase/seed.sql", "utf8");

const scenarioCodes = [
  "kong-vomit",
  "nabi-urinary",
  "bori-allergy",
  "mango-wellness",
  "choco-rehab",
];

function countMatches(pattern: RegExp) {
  return seed.match(pattern)?.length ?? 0;
}

test("DEN-194 medium hospital seed declares a synthetic-only staging contract", () => {
  expect(seed).toContain("synthetic_medium_hospital_seed_contract_version:2026-05-21-den-194");
  expect(seed).toContain("CLAiR Medium Animal Hospital");
  expect(seed).toContain("DEN-194 fixture id map");

  for (const scenarioCode of scenarioCodes) {
    expect(seed).toContain(`"scenario_code":"${scenarioCode}"`);
  }

  expect(seed).not.toMatch(/service[_-]?role|db_password|real patient|real guardian/i);
});

test("DEN-194 medium hospital seed covers the required staff scale", () => {
  expect(countMatches(/@clair\.local'/g)).toBeGreaterThanOrEqual(11);
  expect(countMatches(/array\['hospital_admin'\]/g)).toBeGreaterThanOrEqual(1);
  expect(countMatches(/array\['vet'\]/g)).toBeGreaterThanOrEqual(3);
  expect(countMatches(/array\['technician'\]/g)).toBeGreaterThanOrEqual(4);
  expect(countMatches(/array\['front_desk'\]/g)).toBeGreaterThanOrEqual(3);
});

test("DEN-194 medium hospital seed covers guardian, patient, reception, and customer fixtures", () => {
  expect(countMatches(/'DEN-194-G-[0-9]{2}'/g)).toBeGreaterThanOrEqual(12);
  expect(countMatches(/'P-DEN194-[0-9]{2}'/g)).toBeGreaterThanOrEqual(15);
  expect(countMatches(/insert into public\.appointments/g)).toBeGreaterThanOrEqual(2);
  expect(countMatches(/insert into public\.encounters/g)).toBeGreaterThanOrEqual(2);
  expect(countMatches(/insert into public\.waiting_queue_entries/g)).toBeGreaterThanOrEqual(2);
  expect(countMatches(/insert into public\.patient_staff_assignments/g)).toBeGreaterThanOrEqual(2);
});

test("DEN-194 medium hospital seed covers orders, completion evidence, billing, and audit", () => {
  for (const orderType of ["'lab'", "'imaging'", "'treatment'", "'dispensing'"]) {
    expect(seed).toContain(orderType);
  }

  expect(seed).toContain("insert into public.order_events");
  expect(seed).toContain("'result_entered'");
  expect(seed).toContain("'completed'");
  expect(seed).toContain("insert into public.payments");
  expect(seed).toContain("insert into public.audit_events");
  expect(seed).toContain("'billing.payment_state_changed'");
});
