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
const executionMigrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260826163000_clinical_master_dispensing_service_review_execution.sql",
);
const unpricedExecutionMigrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260826164000_clinical_master_dispensing_service_review_unpriced_execution.sql",
);
const speciesExecutionMigrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260826165000_clinical_master_dispensing_service_review_species_execution.sql",
);
const queuePatientContextMigrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260826173000_fulfillment_queue_patient_context_readback.sql",
);
const assignmentCancelMigrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260826180000_fulfillment_assignment_cancel_return.sql",
);
const pricingMigrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260826190000_clinical_master_dispensing_service_review_pricing.sql",
);
const pricingArtifactPath = resolve(
  process.cwd(),
  "docs/work/clinical-master/clinical-master-pr-019/dispensing-service-review-prices.v1.json",
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

test("service-review execution remains pending, clinically disabled, and allowlisted", async () => {
  const migration = await readFile(executionMigrationPath, "utf8");

  expect(migration).toContain(
    "private.clair_dispensing_service_review_catalog_item_allowed",
  );
  expect(migration).toContain("item.availability_status = 'pending_activation'");
  expect(migration).toContain("item.clinical_use_allowed = false");
  expect(migration).toContain(
    "private.clair_dispensing_service_review_allowed(\n        p_workspace_id,\n        profile.source_release_id",
  );
  expect(migration).toContain("if c.availability_status <> 'active'");
  expect(migration).toContain("raise exception 'catalog_item_unavailable'");
});

test("atomic confirmation forward patch is fail-closed and changes one predicate", async () => {
  const migration = await readFile(executionMigrationPath, "utf8");

  expect(migration).toContain("select pg_get_functiondef(v_function) into v_definition");
  expect(migration).toContain("if v_needle_count <> 1 then");
  expect(migration).toContain(
    "raise exception 'clair_confirm_chart_order_candidates_definition_unexpected'",
  );
  expect(migration).toContain(
    "and not private.clair_dispensing_service_review_catalog_item_allowed(\n            atomic.workspace_id,\n            catalog.id",
  );
});

test("unpriced service-review orders stay outside billing reflection", async () => {
  const migration = await readFile(unpricedExecutionMigrationPath, "utf8");

  expect(migration).toContain("v_service_review_allowed boolean := false");
  expect(migration).toContain(
    "and c.price_krw is null\n    and not v_service_review_allowed",
  );
  expect(migration).toContain(
    "when v_service_review_allowed then false\n      else c.billing_reflection_enabled",
  );
  expect(migration).toContain("raise exception 'billable_price_required'");
});

test("service-review species usage is labeled operational and does not claim approval", async () => {
  const migration = await readFile(speciesExecutionMigrationPath, "utf8");

  expect(migration).toContain("and not v_service_review_allowed");
  expect(migration).toContain(
    "when v_service_review_allowed then 'service_operations_review'",
  );
  expect(migration).toContain(
    "when v_master_species_approved or v_service_review_allowed then null",
  );
  expect(migration).toContain("if v_count <> 1 then");
  expect(migration).not.toContain("then 'master_reviewed_service_review'");
});

test("Cheongdam service-review pricing stays synthetic, varied, and clinically inactive", async () => {
  const [migration, artifactSource] = await Promise.all([
    readFile(pricingMigrationPath, "utf8"),
    readFile(pricingArtifactPath, "utf8"),
  ]);
  const artifact = JSON.parse(artifactSource) as {
    scope: { workspaceId: string; clinicalUseAllowed: boolean };
    summary: {
      count: number;
      minimumPriceKrw: number;
      medianPriceKrw: number;
      maximumPriceKrw: number;
      uniquePriceCount: number;
      entriesSha256: string;
    };
    entries: Array<{ orderMasterKey: string; priceKrw: number }>;
  };

  expect(artifact.scope).toEqual({
    workspaceId: "workspace-clair-cheongdam",
    releaseId: "78a57bf0-10a8-47db-9ae1-8a8cff79b2c4",
    serviceReviewOnly: true,
    clinicalUseAllowed: false,
  });
  expect(artifact.summary).toMatchObject({
    count: 108,
    minimumPriceKrw: 7000,
    medianPriceKrw: 12500,
    maximumPriceKrw: 28500,
    uniquePriceCount: 30,
    entriesSha256: "53a9b7fde84c76b8b35286f0981515e2df8692c52687276edceb80239b413499",
  });
  expect(new Set(artifact.entries.map((entry) => entry.orderMasterKey)).size).toBe(108);
  expect(new Set(artifact.entries.map((entry) => entry.priceKrw)).size).toBe(30);

  expect(migration).toContain("'workspace-clair-cheongdam'");
  expect(migration).not.toContain("'clair-foreign-demo'");
  expect(migration).toContain("item.availability_status = 'pending_activation'");
  expect(migration).toContain("item.clinical_use_allowed = false");
  expect(migration).toContain("clair_list_order_catalog_admin_v2");
  expect(migration).toContain("set search_path = ''");
  expect(migration).toContain("'workspace_service_review_price'");
  expect(migration).toContain(
    "then c.billing_reflection_enabled and c.price_krw is not null",
  );
  expect(migration).not.toMatch(/clinical_use_allowed\s*=\s*true/i);
});

test("fulfillment queue readback restores encounter patient context without weakening queue permissions", async () => {
  const migration = await readFile(queuePatientContextMigrationPath, "utf8");

  expect(migration).toContain("private.clair_is_active_workspace_member");
  expect(migration).toContain(
    "private.clair_queue_permission_for_destination(p_queue_type, 'read')",
  );
  expect(migration).toContain("left join public.patients patient");
  expect(migration).toContain("left join public.guardians guardian");
  expect(migration).toContain("'patientName', patient.name");
  expect(migration).toContain("'guardianName', guardian.name");
  expect(migration).toContain(
    ")) || item.source_snapshot",
  );
  expect(migration).not.toMatch(/\b(drop|truncate|delete)\b/i);
});

test("fulfillment assignment cancellation requires an audited return and releases the assignee", async () => {
  const migration = await readFile(assignmentCancelMigrationPath, "utf8");

  expect(migration).toContain("p_actor_user_id is distinct from auth.uid()");
  expect(migration).toContain("private.clair_is_active_workspace_member");
  expect(migration).toContain(
    "private.clair_queue_permission_for_destination",
  );
  expect(migration).toContain("raise exception 'reason_required'");
  expect(migration).toContain(
    "when p_status = 'returned' and p_assigned_to_user_id is null then null",
  );
  expect(migration).toContain("insert into public.order_task_events");
  expect(migration).toContain("insert into public.order_events");
  expect(migration).not.toMatch(/\b(drop|truncate|delete)\b/i);
});
