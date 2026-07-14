import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const migrationPath =
  "supabase/migrations/20260714194500_reception_staff_operational_status_snapshot.sql";
const backfillPath =
  "supabase/migrations/20260714202000_cheongdam_reception_staff_schedule_backfill.sql";

test("reception staff status snapshot is workspace-scoped and fact-based", () => {
  const migration = readFileSync(migrationPath, "utf8");

  expect(migration).toContain(
    "function public.reception_staff_operational_status_snapshot",
  );
  expect(migration).toContain("private.clair_is_active_workspace_member");
  expect(migration).toContain("timezone('Asia/Seoul', now())");
  expect(migration).toContain("clocked_out");
  expect(migration).toContain("shift_ended");
  expect(migration).toContain("scheduled");
  expect(migration).toContain("available");
  expect(migration).toContain("leave");
  expect(migration).toContain("off");
  expect(migration).toContain("unknown");
  expect(migration).toContain("'userId'");
  expect(migration).toContain("'statusCode'");
  expect(migration).toContain("'source'");
  expect(migration).not.toContain("'clockInAt'");
  expect(migration).not.toContain("'clockOutAt'");
  expect(migration).toContain("revoke all on function");
  expect(migration).toContain("grant execute on function");
  expect(migration).toContain("to authenticated");
});

test("Cheongdam reception backfill stores six synthetic clock-out facts idempotently", () => {
  const backfill = readFileSync(backfillPath, "utf8");

  expect(backfill).toContain("2026-07-14 청담 접수 합성 시나리오");
  expect(backfill).toContain("date '2026-07-14'");
  expect(backfill).toContain("timestamptz '2026-07-14 19:00:00+09'");
  expect(backfill).toContain("on conflict (workspace_id, membership_id) do nothing");
  expect(backfill).toContain("where not exists");
  expect(backfill.match(/49110000-0000-4000-8000-0000000000(?:03|06|07|08|10|11)/g)).toHaveLength(18);
  expect(backfill).not.toContain("delete from");
  expect(backfill).not.toContain("truncate");
});
