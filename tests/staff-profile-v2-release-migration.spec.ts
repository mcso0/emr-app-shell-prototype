import { existsSync, readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const migrationPath =
  "supabase/migrations/20260716030000_staff_assigned_work_items_authenticated_select.sql";
const remoteAliasPath =
  "supabase/migrations/20260715180209_remote_history_alias_staff_assigned_work_items_authenticated_select.sql";

test("staff assigned-work API has authenticated read privilege behind workspace RLS", () => {
  expect(existsSync(migrationPath)).toBe(true);
  const source = readFileSync(migrationPath, "utf8");

  expect(source).toContain(
    "grant select on table public.order_fulfillment_work_items to authenticated",
  );
  expect(source).not.toMatch(/grant\s+(insert|update|delete|all)/i);
  expect(source).not.toMatch(/service[_-]?role|db_password|SUPABASE_SECRET/i);

  expect(existsSync(remoteAliasPath)).toBe(true);
  const alias = readFileSync(remoteAliasPath, "utf8");
  expect(alias).toContain(
    "20260716030000_staff_assigned_work_items_authenticated_select.sql",
  );
  expect(alias).not.toMatch(/^\s*grant\s+/im);
});
