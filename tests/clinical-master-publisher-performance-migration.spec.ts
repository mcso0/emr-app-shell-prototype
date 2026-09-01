import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/20260831103000_clinical_master_publisher_performance.sql",
  "utf8",
);
const rehearsal = readFileSync(
  "supabase/snippets/clinical_master_execution_preset_publisher_performance_rehearsal.sql",
  "utf8",
);

test("preset contract validation builds one schema and reuses it", () => {
  expect(migration).toContain(
    "create or replace function private.clair_order_detail_inputs_are_valid_for_schema_v1(",
  );
  expect(migration).toContain(
    "v_schema := private.clair_order_detail_field_schema_v1(p_clinical_order_type);",
  );
  expect(migration).toContain(
    "private.clair_order_detail_inputs_are_valid_for_schema_v1(\n    p_clinical_order_type,",
  );
  expect(migration).not.toContain(
    "or not private.clair_order_detail_inputs_are_valid(\n      p_clinical_order_type,",
  );
});

test("canonical fast path is digest-bound and preserves the cumulative fallback", () => {
  expect(migration).toContain(
    "'clinical_master.publisher_canonical_sha256'",
  );
  expect(migration).toContain(
    "= private.clinical_master_sha256(p_payload) then",
  );
  expect(migration).toContain("v_payload := p_payload;");
  expect(migration).toContain(
    "v_payload := private.clinical_master_canonicalize_payload(p_payload);",
  );
  expect(migration).toContain(
    "clinical_master_cumulative_performance_patch_anchor_missing",
  );
  expect(migration).toContain("v_old_count = 1 and v_new_count = 0");
  expect(migration).toContain("v_old_count <> 0 or v_new_count <> 1");
  expect(migration).toContain(
    "clinical_master_cumulative_performance_patch_postcondition_failed",
  );
});

test("latest diagnosis isolation and payload manifest contract remain present", () => {
  expect(migration).toContain(
    "v_result := private.publish_clinical_master_diagnosis_release(p_payload, p_actor_user_id);",
  );
  expect(migration).toContain(
    "clinical_master_diagnosis_release_must_be_isolated",
  );
  expect(migration).toContain(
    "insert into private.clinical_master_release_payload_owner_manifest(",
  );
  expect(migration).toContain(
    "clinical_master_release_payload_owner_manifest_invalid",
  );
  expect(migration).toContain(
    "return v_result || pg_catalog.jsonb_build_object('adoptionScope', v_scope);",
  );
});

test("publisher marker is transaction-local, cleared on both paths, and private", () => {
  expect(migration).toContain(
    "private.clinical_master_sha256(v_payload),\n    true",
  );
  expect(
    migration.match(
      /set_config\('clinical_master\.publisher_canonical_sha256', '', true\)/g,
    ),
  ).toHaveLength(2);
  expect(migration).toContain(
    "revoke all on function private.publish_clinical_master_release_cumulative(jsonb, uuid)",
  );
  expect(migration).toContain(
    "revoke all on function private.publish_clinical_master_release(jsonb, uuid)",
  );
  expect(migration).toContain(
    "owner to postgres;",
  );
});

test("performance migration does not write workspace, encounter, fulfillment, or billing rows", () => {
  expect(migration).not.toMatch(/(?:insert into|update|delete from)\s+public\./i);
  expect(migration).not.toMatch(/\badopt_clinical_master_release\s*\(/i);
  expect(migration).not.toMatch(/clinicalUseAllowed'\s*,\s*true/i);
  expect(migration).not.toMatch(/statement_timeout\s*=\s*'[^']*(?:3|4|5|6|7|8|9)\d{2}s'/i);
});

test("rollback-only rehearsal freezes the exact baseline and publish contract", () => {
  for (const expected of [
    "publisher_rehearsal_master_order_baseline_mismatch",
    "publisher_rehearsal_execution_preset_baseline_mismatch",
    "publisher_rehearsal_function_security_contract_mismatch",
    "publisher_rehearsal_function_search_path_mismatch",
    "publisher_rehearsal_fixture_clinical_type_coverage_mismatch",
    "select 'external_lab', 1, '{}'::jsonb",
    "publisher_rehearsal_valid_validator_mismatch",
    "publisher_rehearsal_invalid_validator_mismatch",
    "publisher_rehearsal_clinical_gate_wrong_error",
    "publisher_rehearsal_preset_status_wrong_error",
    "publisher_rehearsal_unknown_detail_wrong_error",
    "publisher_rehearsal_absent_marker_fallback_mismatch",
    "publisher_rehearsal_absent_marker_rollback_residue",
    "publisher_rehearsal_wrong_marker_fallback_mismatch",
    "publisher_rehearsal_wrong_marker_rollback_residue",
    "set local statement_timeout = '60s'",
    ") <> 689",
    ") <> 1070",
    ") <> 630",
    ") <> 522",
    "publisher_rehearsal_safety_or_lineage_mismatch",
    "publisher_rehearsal_stage_version_mismatch",
    ") <> 535",
    "publisher_rehearsal_retry_mismatch",
    "publisher_rehearsal_rollback_residue",
    "set local statement_timeout = '1500ms'",
    "publisher_timeout_sqlstate",
    "'57014'",
    "publisher_rehearsal_timeout_rollback_residue",
    "clinical_master_publisher_performance_rehearsal_ok",
  ]) {
    expect(rehearsal).toContain(expected);
  }
  expect(rehearsal).toContain("rollback;");
  expect(
    rehearsal.match(
      /current_setting\(\s*'clinical_master\.publisher_canonical_sha256'/g,
    ),
  ).toHaveLength(6);
  expect(rehearsal).not.toContain("commit;");
});
