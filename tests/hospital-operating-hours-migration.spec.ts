import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const path = "supabase/migrations/20260715100000_workspace_operating_hours.sql";
const migration = readFileSync(path, "utf8");

test("operating-hours migration creates tenant-bound weekly and exception tables", () => {
  expect(migration).toContain("create table public.workspace_operating_hours");
  expect(migration).toContain("create table public.workspace_operating_hour_exceptions");
  expect(migration).toContain("timezone text not null default 'Asia/Seoul'");
  expect(migration).toContain("holiday_policy text not null default 'closed'");
  expect(migration).toContain("unique (workspace_id, day_of_week)");
  expect(migration).toContain("unique (workspace_id, operating_date)");
});
test("operating-hours tables use workspace RLS and explicit grants", () => {
  expect(migration).toContain("enable row level security");
  expect(migration).toContain("private.clair_is_active_workspace_member(workspace_id)");
  expect(migration).toContain("private.clair_is_workspace_admin(workspace_id)");
  expect(migration).toContain("revoke all privileges on table public.workspace_operating_hours");
  expect(migration).toContain("grant select on table public.workspace_operating_hours to authenticated");
});

test("migration resolves dates, audits settings writes, and blocks future conflicts", () => {
  expect(migration).toContain("private.clair_resolve_effective_operating_hours");
  expect(migration).toContain("public.clair_get_effective_operating_hours");
  expect(migration).toContain("public.clair_replace_workspace_operating_hours");
  expect(migration).toContain("future_appointment_conflict");
  expect(migration).toContain("hospital.operating_hours_updated");
  expect(migration).toContain("appointment_outside_business_hours");
  expect(migration).toContain("walk_in_outside_business_hours");
  expect(migration).not.toContain("< 540");
  expect(migration).not.toContain("> 1140");
});
