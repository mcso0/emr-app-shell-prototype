import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const migrationPath =
  "supabase/migrations/20260714194500_reception_staff_operational_status_snapshot.sql";

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
