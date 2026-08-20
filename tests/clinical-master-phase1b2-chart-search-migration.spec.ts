import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/20260820100000_clinical_master_phase1b2_order_set_revisions.sql",
  "utf8",
);

test("B2 chart search forward replacement preserves atomic eight-column contract", () => {
  expect(migration).toContain("drop function if exists public.clair_list_order_catalog_chart_search(text)");
  expect(migration).toContain("returns table (");
  expect(migration).toContain("row_type text, source_preset_id text, source_preset_version text");
  expect(migration).toContain("from public.order_catalog_items item");
  expect(migration).not.toContain("from public.order_sets set_row");
  expect(migration).toContain("grant execute on function public.clair_list_order_catalog_chart_search(text) to authenticated");
  expect(migration).toContain("revoke all on function public.clair_list_order_catalog_chart_search(text) from public, anon, service_role");
});
