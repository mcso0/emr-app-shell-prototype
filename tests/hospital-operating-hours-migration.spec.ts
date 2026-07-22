import { expect, test } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";

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

test("a forward migration allows reception writes during configured breaks", () => {
  const policyPath =
    "supabase/migrations/20260722112803_reception_break_time_creation_policy.sql";
  const policyMigration = existsSync(policyPath)
    ? readFileSync(policyPath, "utf8")
    : "";

  expect(policyMigration).toContain(
    "create or replace function private.clair_assert_reception_time_allowed",
  );
  const assertionFunction =
    policyMigration
      .split(
        "create or replace function private.clair_assert_reception_time_allowed",
      )[1]
      ?.split(
        "revoke all on function private.clair_assert_reception_time_allowed",
      )[0] ?? "";
  expect(assertionFunction).toContain(
    "v_start < (v_schedule->>'treatmentStart')::time",
  );
  expect(assertionFunction).toContain(
    "v_end > (v_schedule->>'treatmentEnd')::time",
  );
  expect(assertionFunction).not.toContain("v_schedule->>'breakStart'");
  expect(assertionFunction).not.toContain("v_schedule->>'breakEnd'");
  expect(policyMigration).toContain(
    "revoke all on function private.clair_assert_reception_time_allowed(text, timestamptz, timestamptz, text) from public, anon, authenticated",
  );

  const futureConflictCheck =
    policyMigration
      .split("select jsonb_agg(")[1]
      ?.split("if v_conflicts is not null")[0] ?? "";
  expect(futureConflictCheck).toContain("a.scheduled_start_at >= now()");
  expect(futureConflictCheck).toContain("treatmentStart");
  expect(futureConflictCheck).toContain("treatmentEnd");
  expect(futureConflictCheck).not.toContain("breakStart");
  expect(futureConflictCheck).not.toContain("breakEnd");
});
