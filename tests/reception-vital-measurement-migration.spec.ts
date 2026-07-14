import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const migrationPath =
  "supabase/migrations/20260714113000_reception_vital_measurement_history.sql";
const migration = readFileSync(migrationPath, "utf8");

test("vital history migration defines a tenant-bound measurement set", () => {
  expect(migration).toContain("create table public.patient_vital_measurements");
  for (const column of [
    "workspace_id text not null",
    "patient_id uuid not null",
    "encounter_id uuid not null",
    "measured_at timestamptz not null",
    "recorded_by_user_id uuid not null",
    "weight_kg numeric(6,2)",
    "temperature_c numeric(4,1)",
    "respiratory_rate_rpm integer",
    "blood_pressure_systolic_mmhg integer",
    "blood_pressure_diastolic_mmhg integer",
  ]) {
    expect(migration).toContain(column);
  }

  expect(migration).toContain(
    "foreign key (workspace_id, patient_id) references public.patients(workspace_id, id)",
  );
  expect(migration).toContain(
    "foreign key (workspace_id, encounter_id) references public.encounters(workspace_id, id)",
  );
  expect(migration).toContain("patient_vital_measurements_has_value_check");
  expect(migration).toContain("patient_vital_measurements_positive_values_check");
  expect(migration).toContain("patient_vital_measurements_blood_pressure_pair_check");
});

test("vital history migration denies direct browser writes and adds history indexes", () => {
  expect(migration).toContain(
    "alter table public.patient_vital_measurements enable row level security",
  );
  expect(migration).toContain(
    "revoke all privileges on table public.patient_vital_measurements from public, anon, authenticated",
  );
  expect(migration).not.toMatch(
    /grant\s+(insert|update|delete|all).*patient_vital_measurements/i,
  );
  expect(migration).toContain(
    "patient_vital_measurements_workspace_patient_measured_idx",
  );
  expect(migration).toContain(
    "patient_vital_measurements_workspace_encounter_idx",
  );
});

test("walk-in RPC binds the actor and writes nested vitals in the same function", () => {
  expect(migration).toContain(
    "create or replace function public.clair_create_reception_walk_in_encounter",
  );
  expect(migration).toContain("v_vitals jsonb := p_walk_in -> 'vitals'");
  expect(migration).toContain("v_actor_user_id <> auth.uid()");
  expect(migration).toContain(
    "private.clair_is_active_workspace_member(p_workspace_id)",
  );
  expect(migration).toContain("insert into public.encounters");
  expect(migration).toContain("insert into public.waiting_queue_entries");
  expect(migration).toContain(
    "insert into public.patient_vital_measurements",
  );
  expect(migration).toContain("weight_kg = v_weight_kg");
  expect(migration.indexOf("insert into public.encounters")).toBeLessThan(
    migration.indexOf("insert into public.patient_vital_measurements"),
  );
  expect(migration).toContain(
    "grant execute on function public.clair_create_reception_walk_in_encounter(text, text, jsonb) to authenticated",
  );
});
