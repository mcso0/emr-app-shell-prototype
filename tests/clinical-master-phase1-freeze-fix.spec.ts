import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const migrationPath =
  "supabase/migrations/20260820150000_clinical_master_phase1b3_confirm_lab_freeze.sql";
const replayPath =
  "supabase/snippets/clinical_master_phase1b3_confirm_lab_freeze_replay.sql";
const migration = readFileSync(migrationPath, "utf8");
const replay = readFileSync(replayPath, "utf8");

test("B3 confirmation restores the canonical B1 freeze through a private base", () => {
  expect(migration).toContain(
    "alter function public.clair_save_chart_order_action(\n      text,uuid,uuid,text,uuid[],text\n    ) set schema private;",
  );
  expect(migration).toContain(
    "private.clair_create_lab_result_entry_for_confirmed_order(",
  );
  expect(migration).toContain("if p_action = 'confirm' then");
  expect(migration).toContain(
    "order_row.row_type in ('individual', 'set_child')",
  );
  expect(migration).toContain(
    "order_row.workspace_catalog_item_id is not null",
  );
  expect(migration).toContain(
    "order_row.workspace_catalog_revision is not null",
  );
  expect(migration).toContain("order_row.source_master_record_id is not null");
  expect(migration).toContain("order_row.source_master_revision is not null");
  expect(migration).toContain("order_row.service_item_id is null");
  expect(migration).not.toContain("join public.order_catalog_items catalog");
  expect(migration).not.toContain("catalog.origin_type = 'clair_master'");
  expect(migration).not.toContain(
    "catalog.source_master_record_id = order_row.source_master_record_id",
  );
  expect(migration).not.toContain(
    "catalog.source_master_revision = order_row.source_master_revision",
  );
  expect(migration).toContain("order_row.row_type = 'individual'");
  expect(migration).toContain("order_row.row_type = 'set_child'");
  expect(migration).toContain(
    "order_row.parent_chart_order_line_id = any(p_order_ids)",
  );
  expect(migration).toContain(
    "order by order_row.workspace_catalog_item_id, order_row.id",
  );
});

test("B3 action authority and permission boundary remain public/authenticated only", () => {
  expect(migration).toContain(
    "private.clair_save_chart_order_action(\n    p_workspace_id,",
  );
  expect(migration).toContain("security definer");
  expect(migration).toContain(
    "revoke all on function private.clair_save_chart_order_action(",
  );
  expect(migration).toContain(
    "revoke all on function public.clair_save_chart_order_action(",
  );
  expect(migration).toContain(
    "grant execute on function public.clair_save_chart_order_action(\n  text,uuid,uuid,text,uuid[],text\n) to authenticated;",
  );
  expect(migration).toContain(
    "return v_base;",
  );
});

test("focused replay covers individual/set-child freeze, retry, legacy isolation, and ACL", () => {
  for (const token of [
    "clair_save_chart_order_action(text,uuid,uuid,text,uuid[],text)",
    "result_definition_origin <> 'canonical'",
    "result_definition_snapshot_sha256",
    "catalog_projection_stale",
    "catalog_drift_not_atomic",
    "applied_snapshot_schema_version",
    "applied_snapshot_sha256",
    "lab_result_entry_rows",
    "lab-result-row:v1:%s:%s:%s",
    "source_master_test_record_id is distinct from link.source_master_test_record_id",
    "item_version_source_test_revision is distinct from version_row.source_master_revision",
    "savedResultUsageCount",
    "historicalUnattributedUsageResidual",
    "row_type = 'set_child'",
    "result_id <> 'lab-order:'",
    "v_retry->>'stored'",
    "v_after_count <> v_before_count",
    "individual_retry_changed_frozen_state",
    "set_retry_changed_frozen_state",
    "workspace_custom/masterless",
    "set_child_lineage_invalid",
    "non_lab_child_or_parent_frozen",
    "permission_missing",
    "set local role authenticated",
    "has_function_privilege",
    "private_execute_leaked",
    "public_execute_failed",
    "rollback",
  ]) {
    expect(replay).toContain(token);
  }
});
