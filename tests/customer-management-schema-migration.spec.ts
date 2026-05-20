import { expect, test } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";

const migrationPath = "supabase/migrations/20260520140000_customer_management_schema_delta.sql";
const migration = existsSync(migrationPath) ? readFileSync(migrationPath, "utf8") : "";
const seed = readFileSync("supabase/seed.sql", "utf8");

test("customer management migration extends Project 03 master tables without parallel customer masters", () => {
  expect(migration).toContain("alter table public.guardians");
  expect(migration).toContain("alter table public.patients");
  expect(migration).toContain("alter table public.patient_guardians");
  expect(migration).toContain("alter table public.consents");

  for (const column of [
    "guardian_code",
    "cash_receipt_type",
    "resident_registration_number_masked",
    "primary_breed_id",
    "weight_kg",
    "message_consent_status",
    "relationship_label",
    "unlinked_at",
    "document_version",
    "source_surface",
  ]) {
    expect(migration).toContain(column);
  }

  expect(migration).not.toMatch(/create table if not exists public\.customers/i);
  expect(migration).not.toMatch(/create table if not exists public\.customer_profiles/i);
});

test("customer management migration adds support tables with workspace scope and RLS", () => {
  for (const table of [
    "guardian_referral_sources",
    "guardian_duplicate_overrides",
    "patient_staff_assignments",
    "customer_profile_change_logs",
  ]) {
    expect(migration).toContain(`create table if not exists public.${table}`);
    expect(migration).toContain(`alter table public.${table} enable row level security`);
  }

  for (const reference of [
    "foreign key (workspace_id, guardian_id) references public.guardians(workspace_id, id)",
    "foreign key (workspace_id, patient_id) references public.patients(workspace_id, id)",
  ]) {
    expect(migration).toContain(reference);
  }

  expect(migration).not.toMatch(/create policy/i);
});

test("customer management migration constrains synthetic profile values and soft delete state", () => {
  for (const value of [
    "personal_income_deduction",
    "business_income_deduction",
    "direct_input",
    "soft_deleted",
    "internal",
    "external",
    "refused",
    "unknown",
    "guardian_detail_edit",
    "primary_change",
  ]) {
    expect(migration).toContain(`'${value}'`);
  }

  for (const indexName of [
    "guardians_workspace_guardian_code_key",
    "guardians_workspace_status_updated_idx",
    "patients_workspace_primary_attending_vet_idx",
    "patient_guardians_workspace_active_patient_primary_key",
    "guardian_referral_sources_workspace_source_idx",
    "patient_staff_assignments_workspace_active_patient_idx",
  ]) {
    expect(migration).toContain(indexName);
  }
});

test("customer management migration exposes deletion lock source without hard deletes", () => {
  expect(migration).toContain("create or replace view public.customer_profile_deletion_locks");

  for (const sourceTable of [
    "public.appointments",
    "public.encounters",
    "public.waiting_queue_entries",
    "public.invoices",
  ]) {
    expect(migration).toContain(sourceTable);
  }

  expect(migration).not.toMatch(/delete from public\.(guardians|patients|patient_guardians|consents)/i);
});

test("customer management seed contract stays synthetic and covers new profile fixtures", () => {
  expect(seed).toContain("customer_management_seed_contract_version:2026-05-20-den-105");

  for (const table of [
    "guardian_referral_sources",
    "patient_staff_assignments",
    "customer_profile_change_logs",
  ]) {
    expect(seed).toContain(`insert into public.${table}`);
  }

  expect(seed).toContain("masked-demo-rrn-token");
  expect(seed).toContain("cash-receipt-demo-placeholder");
  expect(seed).not.toMatch(/service[_-]?role|db_password|real patient|real guardian/i);
});
