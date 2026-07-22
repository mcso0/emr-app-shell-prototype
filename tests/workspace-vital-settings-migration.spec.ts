import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const migrationPath = "supabase/migrations/20260722143000_workspace_vital_settings.sql";

test("workspace vital migration owns curated presets and workspace configuration", () => {
  const sql = readFileSync(migrationPath, "utf8");

  expect(sql).toContain("create table public.vital_presets");
  expect(sql).toContain("create table public.workspace_vital_settings");
  expect(sql).toContain("enable row level security");
  expect(sql).toContain("revoke all privileges on table public.workspace_vital_settings");
  expect(sql).toContain("clair_get_workspace_vital_settings");
  expect(sql).toContain("clair_replace_workspace_vital_settings");
  expect(sql).toContain("private.clair_is_active_workspace_member");
  expect(sql).toContain("private.clair_current_user_has_workspace_permission(p_workspace_id, 'hospital_settings:manage')");
  expect(sql).toContain("hospital.vital_settings_updated");
  for (const key of ["weight", "temperature", "heart_rate", "respiratory_rate", "blood_pressure"]) {
    expect(sql).toContain(`'${key}'`);
  }
});

test("workspace vital migration extends measurements without deleting historical values", () => {
  const sql = readFileSync(migrationPath, "utf8");

  expect(sql).toContain("add column if not exists heart_rate_bpm integer");
  expect(sql).toContain("drop constraint if exists patient_vital_measurements_blood_pressure_pair_check");
  expect(sql).toContain("blood_pressure_diastolic_mmhg is null or blood_pressure_systolic_mmhg is not null");
  expect(sql).not.toContain("delete from public.patient_vital_measurements");
  expect(sql).toContain("'heartRateBpm'");
});
