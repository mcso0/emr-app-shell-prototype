import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260826160000_clinical_master_dispensing_service_review.sql",
);
const rpcSecurityMigrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260826161000_clinical_master_dispensing_service_review_rpc_security.sql",
);
const eventIndexMigrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260826162000_clinical_master_dispensing_service_review_event_index.sql",
);

test("service-review migration is bounded to the three target workspaces and keeps clinical approval false", async () => {
  const migration = await readFile(migrationPath, "utf8");

  expect(migration).toContain("'clair-demo'::text");
  expect(migration).toContain("'workspace-clair-cheongdam'::text");
  expect(migration).toContain("'workspace-clinical-master-pilot-v1'::text");
  expect(migration).not.toContain("'clair-foreign-demo'::text");
  expect(migration).toContain("'serviceReviewOnly'");
  expect(migration).toContain("catalog.clinical_use_allowed = false");
  expect(migration).toContain("catalog.availability_status = 'pending_activation'");
  expect(migration).toContain("clinical_master_dispensing_service_review_event_immutable");
});

test("chart-search forward fix keeps definer access behind an explicit workspace permission", async () => {
  const migration = await readFile(rpcSecurityMigrationPath, "utf8");

  expect(migration).toContain("security definer");
  expect(migration).toContain("set search_path = 'pg_catalog'");
  expect(migration).toContain(
    "private.clair_current_user_has_workspace_permission(\n      p_workspace_id,\n      'service_catalog:view'",
  );
  expect(migration).toContain(
    "revoke all on function public.clair_list_order_catalog_chart_search_v2(text)\n  from public, anon, service_role",
  );
  expect(migration).toContain(
    "grant execute on function public.clair_list_order_catalog_chart_search_v2(text)\n  to authenticated",
  );
});

test("service-review event release foreign key has a covering index", async () => {
  const migration = await readFile(eventIndexMigrationPath, "utf8");

  expect(migration).toContain(
    "clinical_master_dispensing_service_review_events (release_id)",
  );
});
