import { expect, test } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";

const migrationPath = "supabase/migrations/20260519090000_reception_domain_schema_foundation.sql";
const migration = existsSync(migrationPath) ? readFileSync(migrationPath, "utf8") : "";
const seed = readFileSync("supabase/seed.sql", "utf8");

test("reception domain schema migration defines the minimum Project 03 tables", () => {
  for (const table of [
    "guardians",
    "patients",
    "patient_guardians",
    "consents",
    "appointments",
    "appointment_change_logs",
    "encounters",
    "waiting_queue_entries",
  ]) {
    expect(migration).toContain(`create table if not exists public.${table}`);
    expect(migration).toContain(`alter table public.${table} enable row level security`);
  }

  expect(migration).not.toMatch(/create policy/i);
});

test("reception domain schema migration pins workspace-scoped identifiers and duplicate guards", () => {
  expect(migration).toContain("references public.workspaces(id)");
  expect(migration).toContain("guardians_workspace_mobile_phone_normalized_key");
  expect(migration).toContain("patients_workspace_patient_no_key");
  expect(migration).toContain("patients_workspace_microchip_no_key");
  expect(migration).toContain("patients_workspace_patient_registration_no_key");
  expect(migration).toContain("patient_guardians_workspace_patient_primary_key");
  expect(migration).toContain("encounters_appointment_id_key");
  expect(migration).toContain("encounters_workspace_encounter_no_key");
});

test("reception domain schema migration prevents cross-workspace domain links with composite foreign keys", () => {
  for (const reference of [
    "foreign key (workspace_id, patient_id) references public.patients(workspace_id, id)",
    "foreign key (workspace_id, guardian_id) references public.guardians(workspace_id, id)",
    "foreign key (workspace_id, appointment_id) references public.appointments(workspace_id, id)",
    "foreign key (workspace_id, encounter_id) references public.encounters(workspace_id, id)",
  ]) {
    expect(migration).toContain(reference);
  }
});

test("reception domain schema migration constrains status values and reception handoff fields", () => {
  for (const value of [
    "requested",
    "confirmed",
    "checked_in",
    "no_show",
    "waiting",
    "in_consultation",
    "ready_for_billing",
    "walk_in",
    "appointment",
    "consultation",
  ]) {
    expect(migration).toContain(`'${value}'`);
  }

  for (const field of [
    "reception_type",
    "department",
    "duration_minutes",
    "reception_memo",
    "checked_in_by_user_id",
  ]) {
    expect(migration).toContain(field);
  }
});

test("reception domain schema migration includes lookup and queue indexes", () => {
  for (const indexName of [
    "guardians_workspace_name_idx",
    "patients_workspace_name_idx",
    "appointments_workspace_status_start_idx",
    "encounters_workspace_status_checked_in_idx",
    "waiting_queue_entries_workspace_queue_status_idx",
  ]) {
    expect(migration).toContain(indexName);
  }
});

test("reception domain seed contract uses synthetic Project 03 fixture rows", () => {
  expect(seed).toContain("reception_domain_seed_contract_version:2026-05-19-den-56");

  for (const table of [
    "guardians",
    "patients",
    "patient_guardians",
    "consents",
    "appointments",
    "encounters",
    "waiting_queue_entries",
  ]) {
    expect(seed).toContain(`insert into public.${table}`);
  }

  expect(seed).toContain("20000000-0000-4000-8000-000000000001");
  expect(seed).toContain("21000000-0000-4000-8000-000000000001");
  expect(seed).toContain("24000000-0000-4000-8000-000000000001");
  expect(seed).toContain("26000000-0000-4000-8000-000000000001");
  expect(seed).not.toMatch(/service[_-]?role|db_password|real patient/i);
});
