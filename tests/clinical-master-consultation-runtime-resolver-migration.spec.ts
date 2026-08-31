import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/20260831070920_clinical_master_consultation_runtime_resolver.sql",
  "utf8",
);
const billingRealtimeMigrationPath =
  "supabase/migrations/20260831073721_chart_order_billing_summary_realtime.sql";
const soapBlockMigrationPath =
  "supabase/migrations/20260831120000_chart_soap_block_document.sql";
const compatibilityMigrationPath =
  "supabase/migrations/20260831120100_clinical_master_consultation_runtime_billing_realtime_compatibility.sql";
const billingRealtimeMigration = readFileSync(billingRealtimeMigrationPath, "utf8");
const compatibilityMigration = readFileSync(compatibilityMigrationPath, "utf8");
const compatibilityRehearsal = readFileSync(
  "supabase/snippets/clinical_master_consultation_runtime_compatibility_rehearsal.sql",
  "utf8",
);

test("draft RPC resolves consultation clinician from the scoped encounter, never the actor", () => {
  expect(migration).toContain("encounter.workspace_id = p_workspace_id");
  expect(migration).toContain("encounter.id = p_encounter_id");
  expect(migration).toContain("encounter.primary_veterinarian_id");
  expect(migration).toContain("- 'responsibleClinicianId'");
  expect(migration).toContain("p_primary_veterinarian_id::text");
  expect(migration).not.toContain(
    "'responsibleClinicianId', p_actor_user_id",
  );
  expect(migration).not.toContain("'responsibleClinicianId', v_actor");
});

test("resolver covers individual and Order Set consultation rows only", () => {
  expect(migration).toContain("v_row ->> 'rowType' = 'individual'");
  expect(migration).toContain("v_row ->> 'rowType' = 'set'");
  expect(migration).toContain("v_row -> 'childInputs'");
  expect(migration).toContain("public.order_set_revision_items");
  expect(migration).toContain("catalog.clinical_order_type = 'consultation'");
  expect(migration).toContain("revision_item.child_kind = 'atomic'");
});

test("resolver preserves the latest CAS/removal writer and closes its direct ACL", () => {
  expect(migration).toContain(
    "rename to clair_save_chart_order_draft_pr022_base",
  );
  expect(migration).toContain(
    "revoke all on function public.clair_save_chart_order_draft_pr022_base(",
  );
  expect(migration).toContain(
    "revoke all on function public.clair_save_chart_order_draft_candidate_base(",
  );
  expect(migration).toContain(
    "revoke all on function public.clair_save_chart_order_draft_phase2_base(",
  );
  expect(migration).toContain(
    "return public.clair_save_chart_order_draft_pr022_base(",
  );
  expect(migration).toContain("private.clair_is_active_workspace_member");
  expect(migration).toContain(
    "private.clair_current_user_has_workspace_permission(",
  );
  expect(migration).toContain("'chart:update'");
  expect(migration).toContain(
    "grant execute on function public.clair_save_chart_order_draft(",
  );
  expect(migration).toContain("to authenticated");
});

test("current-main compatibility migration restores consultation authority after the later billing realtime wrapper", () => {
  expect(
    "20260831070920_clinical_master_consultation_runtime_resolver.sql" <
      billingRealtimeMigrationPath.split("/").at(-1)!,
  ).toBe(true);
  expect(
    soapBlockMigrationPath.split("/").at(-1)! <
      compatibilityMigrationPath.split("/").at(-1)!,
  ).toBe(true);
  expect(billingRealtimeMigration).toContain(
    "public.clair_save_chart_order_draft_billing_summary_base(",
  );
  expect(compatibilityMigration).toContain(
    "v_result := public.clair_save_chart_order_draft_billing_summary_base(",
  );
  expect(compatibilityMigration).toContain(
    "private.clair_get_chart_order_billing_summary_internal(",
  );
  expect(compatibilityMigration).toContain(
    "private.clair_broadcast_chart_billing_summary_changed(",
  );
  expect(compatibilityMigration).toContain(
    "'billingSummary'",
  );
  expect(compatibilityMigration).toContain(
    "private.clair_pr022_resolve_consultation_detail_inputs(",
  );
  expect(compatibilityMigration).toContain(
    "encounter.primary_veterinarian_id",
  );
  expect(compatibilityMigration).toContain("'chart:update'");
  expect(compatibilityMigration).toContain("'chart:view'");
});

test("final wrapper checks update and view before encounter or catalog reads", () => {
  const updatePermission = compatibilityMigration.indexOf("'chart:update'");
  const viewPermission = compatibilityMigration.indexOf("'chart:view'");
  const encounterRead = compatibilityMigration.indexOf(
    "select encounter.primary_veterinarian_id",
  );
  const catalogRead = compatibilityMigration.indexOf(
    "from public.order_catalog_items catalog",
  );
  const setChildRead = compatibilityMigration.indexOf(
    "from public.order_set_revision_items revision_item",
  );

  expect(updatePermission).toBeGreaterThanOrEqual(0);
  expect(viewPermission).toBeGreaterThan(updatePermission);
  expect(encounterRead).toBeGreaterThan(viewPermission);
  expect(catalogRead).toBeGreaterThan(encounterRead);
  expect(setChildRead).toBeGreaterThan(encounterRead);
});

test("current-main compatibility base is private and the final wrapper remains authenticated-only", () => {
  expect(compatibilityMigration).toContain(
    "pg_catalog.pg_get_userbyid(proc.proowner)",
  );
  expect(compatibilityMigration).toContain(
    "private.clair_broadcast_chart_billing_summary_changed(text,uuid,text,text)",
  );
  expect(compatibilityMigration).toContain(
    "owner to %I",
  );
  expect(compatibilityMigration).toContain(
    "revoke all on function public.clair_save_chart_order_draft_billing_summary_base(",
  );
  expect(compatibilityMigration).toContain(
    "from public, anon, authenticated, service_role",
  );
  expect(compatibilityMigration).toContain(
    "revoke all on function public.clair_save_chart_order_draft(",
  );
  expect(compatibilityMigration).toContain("from public, anon, service_role");
  expect(compatibilityMigration).toContain(
    "grant execute on function public.clair_save_chart_order_draft(",
  );
  expect(compatibilityMigration).toContain("to authenticated");
});

test("rollback-only compatibility rehearsal covers direct RPC authority and current-main behavior", () => {
  expect(compatibilityRehearsal).toContain(
    "individual_runtime_resolution_mismatch",
  );
  expect(compatibilityRehearsal).toContain(
    "missing_primary_veterinarian_resolution_mismatch",
  );
  expect(compatibilityRehearsal).toContain(
    "set_child_runtime_resolution_mismatch",
  );
  expect(compatibilityRehearsal).toContain(
    "update_only_denial_mismatch",
  );
  expect(compatibilityRehearsal).toContain("'billingSummary'");
  expect(compatibilityRehearsal).toContain("v_denial_state <> '42501'");
  expect(compatibilityRehearsal).toContain("v_denial_message <> 'permission_missing'");
  expect(compatibilityRehearsal).toContain("rollback;");
});
