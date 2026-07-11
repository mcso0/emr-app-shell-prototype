import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const migrationPath = "supabase/migrations/20260711112810_hospital_schedule_operations.sql";

test("schedule migration keeps RLS, operational RPCs, and authenticated grants together", () => {
  const migration = readFileSync(migrationPath, "utf8");

  for (const table of [
    "hospital_schedule_staff_profiles",
    "hospital_schedule_weeks",
    "hospital_schedule_shifts",
    "hospital_schedule_requests",
    "hospital_time_clock_entries",
    "hospital_schedule_payroll_previews",
    "hospital_schedule_notifications",
  ]) {
    expect(migration).toContain(`alter table public.${table} enable row level security;`);
  }

  for (const rpc of [
    "hospital_schedule_read_snapshot",
    "hospital_schedule_create_request",
    "hospital_schedule_review_request",
    "hospital_schedule_save_shift",
    "hospital_schedule_delete_shift",
    "hospital_schedule_clock_in",
    "hospital_schedule_clock_out",
    "hospital_schedule_publish_week",
    "hospital_schedule_create_payroll_preview",
  ]) {
    expect(migration).toContain(`function public.${rpc}`);
  }

  expect(migration).toContain("to authenticated;");
  expect(migration).toContain("schedule_clock_in_not_allowed");
  expect(migration).toContain("hospital_schedule_request_created_notification");
});
