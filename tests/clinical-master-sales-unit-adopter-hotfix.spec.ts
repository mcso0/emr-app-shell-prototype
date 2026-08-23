import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/20260823142511_clinical_master_sales_unit_adopter_hotfix.sql",
  "utf8",
);
const replay = readFileSync(
  "supabase/snippets/clinical_master_sales_unit_adopter_hotfix_replay.sql",
  "utf8",
);

test("sales-unit hotfix keeps one canonical normalization boundary", () => {
  expect(migration).toContain("private.clinical_master_normalize_sales_unit");
  expect(migration).toContain("when 'EA' then 'per_each'");
  expect(migration).toContain("when 'CASE' then 'per_order'");
  expect(migration).toContain("when 'DAY' then 'per_day'");
  expect(migration).toContain("when 'ML' then 'per_ml'");
  expect(migration).toContain("when 'KG' then 'per_kg'");
  expect(migration).toContain("else 'per_each'");
  expect(migration).toContain("defaultSalesUnitCode");
  expect(migration).toContain("'{salesUnit}'");
  expect(migration).toContain("v_normalized_sales_unit");
});

test("sales-unit hotfix stays additive and leaves publisher/B1/table contracts alone", () => {
  expect(migration).not.toContain("create or replace function private.publish_clinical_master_release");
  expect(migration).not.toContain("airtable");
  expect(migration).not.toContain("backfill");
  expect(migration).not.toContain("create table");
  expect(migration).not.toContain("alter table");
  expect(migration).not.toContain("create or replace function private.clair_adopt_master_release_to_workspace(");
  expect(migration).toContain("revoke all on function private.clair_adopt_master_release_to_workspace_a2_base(text, uuid)");
  expect(migration).toContain("grant execute on function public.clair_resolve_workspace_master_update(text, uuid, integer, text)");
});

test("sales-unit hotfix replay covers reapply, CASE, CAS/accept, preservation, ACL, and rollback", () => {
  expect(replay).toContain("\\ir ../migrations/20260823142511_clinical_master_sales_unit_adopter_hotfix.sql");
  expect(replay).toContain("clinical_master_normalize_sales_unit('cAsE'");
  expect(replay).toContain("clinical_master_sales_unit_replay_fresh_case_adoption_failed");
  expect(replay).toContain("clair_update_order_catalog_item");
  expect(replay).toContain("priceKrw', 2600");
  expect(replay).toContain("accept_source");
  expect(replay).toContain("customized_fields");
  expect(replay).toContain("has_function_privilege");
  expect(replay).toContain("search_path=public, private, master, pg_temp");
  expect(replay).toContain("rollback;");
  expect(replay).toContain("rollback_zero_residual");
});
