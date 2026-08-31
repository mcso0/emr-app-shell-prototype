import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

const packetPath =
  "supabase/snippets/clinical_master_execution_preset_workspace_rollout.sql";

test("workspace rollout is pinned to the exact synthetic release and allowlist", async () => {
  const sql = await readFile(packetPath, "utf8");

  expect(sql).toContain("647629e9-41fe-4d75-a572-99f34bf428ea");
  expect(sql).toContain(
    "8b939f7a0c752bb7b8989aca80380e51c1a720a8b98ccb35d1ceb1408648a0f0",
  );
  expect(sql).toContain("'clair-demo'");
  expect(sql).toContain("'workspace-clair-cheongdam'");
  expect(sql).toContain("'workspace-clinical-master-pilot-v1'");
  expect(sql).toContain(
    "v_foreign_workspace constant text := 'clair-foreign-demo'",
  );
  expect(sql).toContain("release_row.adoption_scope = 'payload'");
  expect(sql).toContain("set local role postgres;");
});

test("workspace rollout uses authenticated guarded writers and preserves clinical gate", async () => {
  const sql = await readFile(packetPath, "utf8");

  expect(sql).toContain("public.clair_update_order_catalog_item(");
  expect(sql).toContain("public.clair_resolve_workspace_master_update(");
  expect(sql).toContain("'accept_source'");
  expect(sql).toContain("then 'dismiss'");
  expect(sql).toContain("'availabilityStatus', 'pending_activation'");
  expect(sql).toContain("not item.clinical_use_allowed");
  expect(sql).toContain("preset.preset_status <> 'synthetic_unreviewed'");
  expect(sql).toContain("or preset.clinical_use_allowed");
  expect(sql).not.toMatch(/clinical_use_allowed\s*=\s*true/i);
  expect(sql).not.toMatch(/clinicalUseAllowed'\s*,\s*true/i);
  expect(sql).not.toMatch(/update\s+master\.order_execution_presets/i);
  expect(sql).not.toMatch(
    /private\.clair_adopt_master_release_to_workspace\(/i,
  );
});

test("workspace rollout proves exact preset copy, chart coverage, and foreign isolation", async () => {
  const sql = await readFile(packetPath, "utf8");

  expect(sql).toContain(
    "item.source_execution_preset_id is distinct from preset.id",
  );
  expect(sql).toContain(
    "item.default_detail_inputs is distinct from preset.default_detail_inputs",
  );
  expect(sql).toContain("clinical_master_pr022_chart_search_coverage_failed");
  expect(sql).toContain("clinical_master_pr022_chart_category_coverage_failed");
  expect(sql).toContain("clinical_master_pr022_service_review_count_failed");
  expect(sql).toContain(
    "clinical_master_pr022_service_review_chart_count_failed",
  );
  expect(sql).toContain("v_service_review_count <> 108");
  expect(sql).toContain(
    "clinical_master_pr022_deferred_dispensing_review_count_failed",
  );
  expect(sql).toContain(
    "clinical_master_pr022_deferred_dispensing_preset_mismatch",
  );
  expect(sql).toContain("('system_exam')");
  expect(sql).toContain("('other')");
  expect(sql).toContain(
    "clinical_master_pr022_foreign_workspace_postcondition_failed",
  );
  expect(sql).toContain("\\set ON_ERROR_STOP on");
  expect(sql).toContain("begin;");
  expect(sql).toContain("commit;");
});
