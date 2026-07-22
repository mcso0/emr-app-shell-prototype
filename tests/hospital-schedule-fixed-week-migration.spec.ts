import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const migrationPath =
  "supabase/migrations/20260722084209_hospital_schedule_fixed_week_batch.sql";

test("fixed weekly schedule batch is atomic, idempotent, and admin-scoped", () => {
  const migration = readFileSync(migrationPath, "utf8");

  expect(migration).toContain("hospital_schedule_apply_fixed_week_v2");
  expect(migration).toContain("private.clair_schedule_v2_can_manage");
  expect(migration).toContain("'apply_fixed_week'");
  expect(migration).toContain("stale_schedule_revision");
  expect(migration).toContain("clair_schedule_v2_assert_work_block_allowed");
  expect(migration).toContain("hospital_schedule_non_work_entries");
  expect(migration).toContain("v_skipped := v_skipped + 1");
  expect(migration).toContain("clair_schedule_v2_append_audit");
  expect(migration).toContain(
    "revoke all on function public.hospital_schedule_apply_fixed_week_v2",
  );
  expect(migration).toContain("to authenticated");
  expect(migration).not.toContain("to anon");
});
