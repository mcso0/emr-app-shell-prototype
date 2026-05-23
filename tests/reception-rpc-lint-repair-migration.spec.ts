import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const repairMigration = readFileSync(
  "supabase/migrations/20260521010000_reception_rpc_lint_blocker_repair.sql",
  "utf8"
);
const appointmentLogRepairMigration = readFileSync(
  "supabase/migrations/20260521011000_reception_appointment_log_change_type_repair.sql",
  "utf8"
);

test("DEN-199 repair rewrites appointment check-in log insert to the existing actor column", () => {
  expect(repairMigration).toContain("create or replace function public.clair_check_in_reception_appointment");
  expect(repairMigration).toContain("insert into public.appointment_change_logs");
  expect(repairMigration).toContain("changed_by_user_id");
  expect(repairMigration).not.toContain("actor_user_id,\n    action");
  expect(repairMigration).toContain("grant execute on function public.clair_check_in_reception_appointment(text, text, text) to authenticated");
});

test("DEN-199 follow-up repair rewrites appointment check-in log insert to change_type", () => {
  expect(appointmentLogRepairMigration).toContain("create or replace function public.clair_check_in_reception_appointment");
  expect(appointmentLogRepairMigration).toContain("insert into public.appointment_change_logs");
  expect(appointmentLogRepairMigration).toContain("changed_by_user_id");
  expect(appointmentLogRepairMigration).toContain("change_type");
  expect(appointmentLogRepairMigration).not.toContain("actor_user_id,\n    change_type");
  expect(appointmentLogRepairMigration).not.toContain("action,\n    before_value");
  expect(appointmentLogRepairMigration).toContain("grant execute on function public.clair_check_in_reception_appointment(text, text, text) to authenticated");
});

test("DEN-199 repair replaces the uuid queue reader with the workspace text signature", () => {
  expect(repairMigration).toContain("drop function if exists public.clair_list_reception_queue(uuid, integer)");
  expect(repairMigration).toContain("create or replace function public.clair_list_reception_queue(\n  p_workspace_id text");
  expect(repairMigration).toContain("private.clair_is_active_workspace_member(p_workspace_id)");
  expect(repairMigration).toContain("q.workspace_id = p_workspace_id");
  expect(repairMigration).toContain("grant execute on function public.clair_list_reception_queue(text, integer) to authenticated");
});

test("DEN-199 repair stays inside reception RPC scope and avoids seed or secret-shaped operations", () => {
  expect(repairMigration).not.toMatch(/\bdelete\s+from\b|\btruncate\s+table\b/i);
  expect(repairMigration).not.toMatch(/supabase\/seed|include-seed|seed.sql/i);
  expect(repairMigration).not.toMatch(/service[_-]?role|db_password|SUPABASE_SECRET/i);
});
