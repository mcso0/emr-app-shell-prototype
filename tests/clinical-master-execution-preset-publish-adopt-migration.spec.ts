import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/20260831070512_clinical_master_execution_preset_publish_adopt.sql",
  "utf8",
);

test("source projection carries an exact current execution-preset envelope", () => {
  expect(migration).toContain(
    "create or replace function private.clinical_master_order_source_projection(",
  );
  expect(migration).toContain("'executionPreset', pg_catalog.jsonb_build_object(");
  for (const key of [
    "'id', preset.id",
    "'key', preset.preset_key",
    "'revision', preset.preset_revision",
    "'orderRecordRevision', preset.order_record_revision",
    "'clinicalOrderType', preset.clinical_order_type",
    "'detailSchemaVersion', preset.detail_schema_version",
    "'defaultDetailInputs', preset.default_detail_inputs",
    "'fieldPolicies', preset.field_policies",
    "'presetStatus', preset.preset_status",
    "'clinicalUseAllowed', preset.clinical_use_allowed",
    "'contentSha256', preset.content_sha256",
    "'sourceArtifactSha256', preset.source_artifact_sha256",
    "'sourceReleaseId', preset.source_release_id",
    "'activatedReleaseId', current_preset.activated_in_release_id",
  ]) {
    expect(migration).toContain(key);
  }
  expect(migration).toContain(
    "and preset.order_record_revision = record_row.current_revision",
  );
  expect(migration).toContain("|| coalesce((");
  expect(migration).toContain("), '{}'::jsonb)");
});

test("source matching and review snapshots preserve legacy compatibility and generic lineage", () => {
  expect(migration).toContain(
    "create or replace function private.clinical_master_catalog_source_matches_snapshot(",
  );
  expect(migration).toContain("v_execution_preset jsonb := p_snapshot -> 'executionPreset';");
  expect(migration).toContain("v_execution_preset is null");
  expect(migration).toContain("p_item.default_detail_inputs =");
  expect(migration).toContain("p_item.default_detail_input_policies =");
  expect(migration).toContain("p_item.source_execution_preset_id =");
  expect(migration).toContain("p_item.source_execution_preset_sha256 =");
  expect(migration).toContain(
    "create or replace function private.clinical_master_workspace_snapshot(",
  );
  for (const key of [
    "'defaultDetailInputs', p_item.default_detail_inputs",
    "'defaultDetailInputPolicies', p_item.default_detail_input_policies",
    "'sourceExecutionPresetId', p_item.source_execution_preset_id",
    "'sourceExecutionPresetRevision', p_item.source_execution_preset_revision",
    "'sourceExecutionPresetSha256', p_item.source_execution_preset_sha256",
  ]) {
    expect(migration).toContain(key);
  }
});

test("cumulative and payload adoption share the guarded copy and fail closed on missing or stale current presets", () => {
  expect(migration).toContain("patch_lab_link_insert_counter");
  expect(migration).toContain("if found then");
  expect(migration).toContain(
    "clinical_master_lab_link_counter_patch_anchor_missing",
  );
  expect(migration).toContain(
    "create or replace function private.clair_sync_adopted_execution_preset_copy(",
  );
  expect(migration).toContain("p_adoption_scope = 'cumulative'");
  expect(migration).toContain(
    "private.clinical_master_release_payload_owner_manifest manifest",
  );
  expect(migration).toContain("item.customization_state = 'unmodified'");
  expect(migration).toContain(
    "coalesce(pg_catalog.cardinality(item.customized_fields), 0) = 0",
  );
  expect(migration).toContain("item.category_group as item_category_group");
  expect(migration).toContain("v_item.item_category_group = 'misc'");
  expect(migration).toContain("v_item.preset_clinical_order_type = 'system_exam'");
  expect(migration).toContain("v_item.item_category_group = 'medication'");
  expect(migration).toContain("v_item.preset_clinical_order_type = 'other'");
  expect(migration).not.toContain("set customization_state =");
  expect(migration).not.toContain("set customized_fields =");
  expect(migration).toContain(
    "alter function private.clair_adopt_master_release_to_workspace_a2_base(",
  );
  expect(migration).toContain("text, uuid\n    ) rename to");
  expect(migration).toContain(
    "clair_adopt_master_release_to_workspace_a2_base_legacy_pr022",
  );
  expect(migration).toContain("do $preserve_a2_base$");
  expect(migration).toContain("do $preserve_workspace_resolver$");
  expect(migration).toContain(
    "clinical_master_execution_preset_source_revision_mismatch",
  );
  expect(migration).toContain("and not exists (");
  expect(migration).toContain(
    "and preset.order_record_revision = source_record.current_revision",
  );
  expect(migration).toContain("'executionPresetTransport', 'v1'");
});

test("accept_source requires server-captured exact lineage and keeps legacy snapshots unchanged", () => {
  expect(migration).toContain(
    "alter function public.clair_resolve_workspace_master_update(",
  );
  expect(migration).toContain("clair_resolve_workspace_master_update_legacy_pr022");
  expect(migration).toContain("v_execution_preset is null");
  expect(migration).toContain(
    "clinical_master_execution_preset_snapshot_lineage_conflict",
  );
  expect(migration).toContain("v_preset.order_record_revision <> v_source_record.current_revision");
  expect(migration).toContain("v_execution_preset -> 'defaultDetailInputs'");
  expect(migration).toContain("v_execution_preset -> 'fieldPolicies'");
  expect(migration).toContain("v_execution_preset ->> 'contentSha256'");
  expect(migration).toContain("v_execution_preset ->> 'sourceReleaseId'");
  expect(migration).toContain("v_execution_preset ->> 'activatedReleaseId'");
  expect(migration).toContain("private.clair_pr020_append_order_catalog_audit(");
  expect(migration).toContain("'accept_master_source'");
  expect(migration).toContain("'databaseAuditWritten', true");
  expect(migration).toContain("grant execute on function public.clair_resolve_workspace_master_update(");
  expect(migration).toContain("to authenticated;");
});

test("master-update resolver enforces canonical catalog permission before reads and legacy mutation", () => {
  const resolverStart = migration.indexOf(
    "create or replace function public.clair_resolve_workspace_master_update(",
  );
  const resolverEnd = migration.indexOf(
    "revoke all on function public.clair_resolve_workspace_master_update(",
    resolverStart,
  );
  const resolverBody = migration.slice(resolverStart, resolverEnd);
  const authIndex = resolverBody.indexOf("if auth.uid() is null then");
  const membershipIndex = resolverBody.indexOf(
    "private.clair_is_active_workspace_member(p_workspace_id)",
  );
  const permissionIndex = resolverBody.indexOf(
    "p_workspace_id, 'service_catalog:manage'",
  );
  const firstPrivilegedReadIndex = resolverBody.indexOf(
    "from public.workspace_master_updates update_row",
  );
  const legacyCallIndex = resolverBody.indexOf(
    "public.clair_resolve_workspace_master_update_legacy_pr022(",
  );

  expect(authIndex).toBeGreaterThan(-1);
  expect(membershipIndex).toBeGreaterThan(authIndex);
  expect(permissionIndex).toBeGreaterThan(membershipIndex);
  expect(firstPrivilegedReadIndex).toBeGreaterThan(permissionIndex);
  expect(legacyCallIndex).toBeGreaterThan(firstPrivilegedReadIndex);
  expect(resolverBody).toContain(
    "raise exception 'workspace_admin_required' using errcode = '42501'",
  );
});

test("transport is security-definer/private and never updates order execution records", () => {
  expect(migration).toContain("security definer");
  expect(migration).toContain("set search_path = ''");
  expect(migration).toContain(
    "revoke all on function private.clinical_master_order_source_projection(uuid)",
  );
  expect(migration).toContain(
    "revoke all on function private.clair_adopt_master_release_to_workspace_a2_base(",
  );
  expect(migration).toContain(
    "revoke all on function private.clair_adopt_master_release_to_workspace(",
  );
  expect(migration).toContain(
    "revoke all on function public.clair_resolve_workspace_master_update(",
  );
  expect(migration).not.toMatch(/update\s+public\.orders\b/i);
  expect(migration).not.toMatch(/update\s+public\.order_fulfillment_work_items\b/i);
  expect(migration).not.toMatch(/update\s+public\.invoice_/i);
  const copyBody = migration.slice(
    migration.indexOf("create or replace function private.clair_sync_adopted_execution_preset_copy"),
    migration.indexOf("revoke all on function private.clair_sync_adopted_execution_preset_copy"),
  );
  expect(copyBody).toContain("item.customized_fields");
  expect(copyBody).not.toMatch(/price_krw\s*=/i);
  expect(copyBody).not.toMatch(/availability_status\s*=/i);
  expect(copyBody).not.toMatch(/customized_fields\s*=/i);
  const resolveBody = migration.slice(
    migration.indexOf("create or replace function public.clair_resolve_workspace_master_update("),
    migration.indexOf("revoke all on function public.clair_resolve_workspace_master_update("),
  );
  expect(resolveBody).not.toMatch(/price_krw\s*=/i);
  expect(resolveBody).not.toMatch(/availability_status\s*=/i);
  expect(resolveBody).not.toMatch(/customized_fields\s*=/i);
});
