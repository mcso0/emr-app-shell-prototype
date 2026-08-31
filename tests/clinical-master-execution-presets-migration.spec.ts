import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/20260831064944_clinical_master_order_execution_presets.sql",
  "utf8",
);

test("generic execution preset versions are private, append-only, and schema validated", () => {
  expect(migration).toContain("create table if not exists master.order_execution_presets");
  expect(migration).toContain("create table if not exists master.order_execution_preset_current");
  expect(migration).toContain("private.clair_order_execution_preset_contract_is_valid");
  expect(migration).toContain("private.clair_order_detail_inputs_are_valid(");
  expect(migration).toContain("p_default_detail_inputs = '{}'::jsonb");
  expect(migration).toContain("and p_field_policies = '{}'::jsonb");
  expect(migration).toContain("Every schema field needs an explicit resolver");
  expect(migration).toContain("v_field_policy in (");
  expect(migration).toContain("'preset_fixed'");
  expect(migration).toContain("'derived_from_profile'");
  expect(migration).toContain("'schema_default'");
  expect(migration).toContain("'workspace_resolved'");
  expect(migration).toContain("'runtime_resolved'");
  expect(migration).toContain("'required_manual'");
  expect(migration).toContain("v_field_policy = 'not_applicable'");
  expect(migration).toContain("and not (p_default_detail_inputs ? v_field_key)");
  expect(migration).toContain("set search_path = ''");
  expect(migration).toContain("clinical_master_order_execution_preset_version_immutable");
  expect(migration).toContain(
    "create or replace function master.assert_order_execution_preset_current_release()",
  );
  expect(migration).toContain(
    "clinical_master_execution_preset_current_release_mismatch",
  );
  expect(migration).toContain(
    "new.activated_in_release_id is distinct from v_source_release_id",
  );
  expect(migration).toContain(
    "clinical_master_execution_preset_replacement_required",
  );
  expect(migration).toContain("order_execution_preset_current_release_guard");
  expect(migration).toContain("before update or delete on master.order_execution_presets");
  expect(migration).toContain("alter table master.order_execution_presets enable row level security");
  expect(migration).toContain("alter table master.order_execution_preset_current enable row level security");
  expect(migration).toContain(
    "revoke all on table master.order_execution_presets,\n  master.order_execution_preset_current\n  from public, anon, authenticated, service_role",
  );
  expect(migration).toContain(
    "alter table master.dispensing_order_prescription_presets enable row level security",
  );
  expect(migration).toContain("v_source_count <> 108");
  expect(migration).toContain("v_projected_count <> v_source_count");
  expect(migration).toContain("v_current_count <> v_source_count");
  expect(migration).toContain(
    "current_preset.preset_revision >= preset.preset_revision",
  );
  expect(migration).toContain(
    "current_version.source_release_id = current_preset.activated_in_release_id",
  );
  expect(migration).toContain(
    "clinical_master_dispensing_generic_projection_mismatch",
  );
  expect(migration).toContain("preset_status <> 'synthetic_unreviewed' or not clinical_use_allowed");
  expect(migration).not.toMatch(/clinical_use_allowed\s*=\s*true/i);
});

test("workspace defaults carry immutable preset lineage without touching encounter orders", () => {
  expect(migration).toContain("add column if not exists default_detail_inputs jsonb");
  expect(migration).toContain("add column if not exists default_detail_input_policies jsonb");
  expect(migration).toContain("add column if not exists source_execution_preset_id uuid");
  expect(migration).toContain("order_catalog_items_execution_preset_fk");
  expect(migration).toContain(
    "source_master_record_id,\n      source_execution_preset_id,\n      source_execution_preset_revision",
  );
  expect(migration).toContain(
    "order_record_id,\n      id,\n      preset_revision",
  );
  expect(migration).toContain("private.clair_catalog_effective_default_detail_inputs");
  expect(migration).toContain("nullif(p_catalog.default_detail_inputs, '{}'::jsonb)");
  expect(migration).toContain("p_catalog.medication_metadata -> 'defaultDetailInputs'");
  expect(migration).not.toMatch(/update\s+public\.orders\b/i);
  expect(migration).not.toMatch(/update\s+public\.order_fulfillment_work_items\b/i);
  expect(migration).not.toMatch(/update\s+public\.invoice_/i);
});

test("compatibility backfill is exact, additive, retry-safe, and workspace allowlisted", () => {
  expect(migration).toContain("'clair-demo'");
  expect(migration).toContain("'workspace-clair-cheongdam'");
  expect(migration).toContain("'workspace-clinical-master-pilot-v1'");
  expect(migration).toContain(
    "where catalog.workspace_id = 'clair-foreign-demo'",
  );
  expect(migration).toContain("v_foreign_after is distinct from v_foreign_before");
  expect(migration).toContain(
    "clinical_master_execution_preset_foreign_workspace_changed",
  );
  expect(migration).toContain("catalog.origin_type = 'clair_master'");
  expect(migration).toContain("catalog.source_master_record_id = generic_preset.order_record_id");
  expect(migration).toContain("catalog.source_master_revision = generic_preset.order_record_revision");
  expect(migration).toContain("catalog.default_detail_inputs = '{}'::jsonb");
  expect(migration).toContain("array['defaultDetailInputs', 'default_detail_inputs', '*']::text[]");
  expect(migration).toContain("v_candidate_count not in (0, 324)");
  expect(migration).toContain("v_candidates jsonb");
  expect(migration).toContain(
    "candidate.value ->> 'catalogId' = catalog.id",
  );
  expect(migration).toContain("catalog_revision = catalog.catalog_revision + 1");
  expect(migration).toContain("v_updated_count <> v_candidate_count");
  expect(migration).toContain("insert into public.audit_events (");
  expect(migration).toContain("'clinical_master_execution_preset_backfill:'");
  expect(migration).toContain("'backfillMigration', '20260831064944'");
  expect(migration).toContain("on conflict (id)");
  expect(migration).toContain("do nothing;");
  expect(migration).not.toMatch(/set\s+customization_state\s*=/i);
  expect(migration).not.toMatch(/set\s+customized_fields\s*=/i);
});
