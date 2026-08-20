import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const b2Migration = readFileSync(
  "supabase/migrations/20260820100000_clinical_master_phase1b2_order_set_revisions.sql",
  "utf8",
);
const b3Migration = readFileSync(
  "supabase/migrations/20260820140000_clinical_master_phase1b3_chart_set_runtime.sql",
  "utf8",
);

test("legacy chart search remains the atomic eight-column authority", () => {
  const searchStart = b2Migration.indexOf(
    "create function public.clair_list_order_catalog_chart_search(p_workspace_id text)",
  );
  const searchEnd = b2Migration.indexOf(
    "revoke all on function public.clair_list_order_catalog_chart_search(text)",
    searchStart,
  );
  expect(searchStart).toBeGreaterThanOrEqual(0);
  expect(searchEnd).toBeGreaterThan(searchStart);
  const search = b2Migration.slice(searchStart, searchEnd);

  expect(search).toContain("returns table (");
  expect(search).toContain(
    "row_type text, source_preset_id text, source_preset_version text",
  );
  expect(search).toContain("from public.order_catalog_items item");
  expect(search).not.toContain("from public.order_sets");
  expect(b2Migration).toContain(
    "revoke all on function public.clair_list_order_catalog_chart_search(text) from public, anon, service_role",
  );
  expect(b2Migration).toContain(
    "grant execute on function public.clair_list_order_catalog_chart_search(text) to authenticated",
  );
});

test("B3 v2 search exposes a closed atomic/set union with exact aliases and filters", () => {
  const searchStart = b3Migration.indexOf(
    "create function public.clair_list_order_catalog_chart_search_v2(\n  p_workspace_id text",
  );
  const searchEnd = b3Migration.indexOf(
    "create or replace function private.clair_b3_expand_chart_order_set(",
    searchStart,
  );
  expect(searchStart).toBeGreaterThanOrEqual(0);
  expect(searchEnd).toBeGreaterThan(searchStart);
  const search = b3Migration.slice(searchStart, searchEnd);

  for (const alias of [
    "source_set_id text",
    "source_set_revision_id uuid",
    "source_set_revision_no integer",
    "source_set_amount_basis text",
    "source_set_price_krw integer",
    "source_set_range_basis text",
    "source_set_tax_type text",
    "source_set_availability_status text",
    "source_set_needs_composition_review boolean",
    "source_set_validation_status text",
    "source_set_price_ranges jsonb",
    "source_set_pending_review_count integer",
  ]) {
    expect(search).toContain(alias);
  }
  expect(search).toContain("with atomic_rows as");
  expect(search).toContain("set_rows as");
  expect(search).toContain("union all");
  expect(search).toContain("'individual'::text as row_type");
  expect(search).toContain("'set'::text as row_type");
  expect(search).toContain("s.availability_status = 'active'");
  expect(search).toContain("s.needs_composition_review = false");
  expect(search).toContain("r.validation_status = 'valid'");
  expect(search).toContain("coalesce(ranges.price_ranges, '[]'::jsonb)");
  expect(search).toContain("source_set_range_basis");
  expect(search).toContain("source_set_pending_review_count");
  expect(search).not.toContain("from public.order_set_items");
});

test("B3 v2 search uses the authenticated-only ACL and cannot be called through stale public grants", () => {
  expect(b3Migration).toContain(
    "revoke all on function public.clair_list_order_catalog_chart_search_v2(text)\n  from public, anon, service_role",
  );
  expect(b3Migration).toContain(
    "grant execute on function public.clair_list_order_catalog_chart_search_v2(text)\n  to authenticated",
  );
  expect(b3Migration).toContain(
    "language sql\nsecurity invoker\nset search_path = public, pg_catalog",
  );
  expect(b3Migration).toContain(
    "comment on function public.clair_list_order_catalog_chart_search_v2(text)",
  );
});
