import { expect, test } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/20260824091724_clinical_master_release_scoped_workspace_adoption.sql",
  "utf8",
);
const replay = readFileSync(
  "supabase/snippets/clinical_master_release_scoped_workspace_adoption_replay.sql",
  "utf8",
);
const operationManifest = JSON.parse(
  readFileSync("tests/fixtures/clinical-master-operational-v3-phase-c-operation-manifest.json", "utf8"),
) as { inputs: Record<string, unknown> };
const cumulativePublisher = readFileSync(
  "supabase/migrations/20260823124500_clinical_master_publisher_full_type_hotfix.sql",
  "utf8",
);
const adapter = JSON.parse(
  readFileSync("tests/fixtures/clinical-master-operational-v3-adapter-output.json", "utf8"),
) as { payload: { adoptionScope?: string; records: Array<{ masterKey: string; recordType: string }> } };

test("release scope persists, fingerprints, and dispatches cumulative versus payload adoption", () => {
  expect(migration).toContain("add column if not exists adoption_scope text not null default 'cumulative'");
  expect(migration).not.toMatch(/update\s+master\.master_releases\s+set\s+adoption_scope/i);
  expect(migration).toContain("clinical_master_release_adoption_scope_column_state_invalid");
  expect(migration).toContain("check (adoption_scope in ('cumulative', 'payload'))");
  expect(migration).toContain("clinical_master_canonicalize_payload");
  expect(migration).toContain("case when p_payload ? 'adoptionScope'");
  expect(migration).toContain("else '{}'::jsonb");
  expect(migration).toContain("'adoptionScope',(select value from normalized_scope)");
  expect(migration).toContain("publish_clinical_master_release_cumulative");
  expect(migration).toContain("clinical_master.adoption_scope");
  expect(migration).toContain("clair_adopt_master_release_to_workspace_a2_cumulative");
  expect(migration).toContain("clair_adopt_master_release_to_workspace_payload");
  expect(migration).toContain("if v_scope = 'cumulative'");
  expect(migration).toContain("elsif v_scope = 'payload'");
  expect(cumulativePublisher).toContain("'idempotent',true");
});

test("payload mode is manifest-bound, exact, and excludes every nonpayload write surface", () => {
  expect(migration).toContain("clinical_master_release_payload_owner_manifest");
  expect(migration).toContain("clinical_master.manifest_write_release_id");
  expect(migration).toContain("clinical_master_payload_manifest_content_sha256");
  expect(migration).toContain("clinical_master_payload_adoption_manifest_parity_invalid");
  expect(migration).toContain("stage.record_type = 'order'");
  expect(migration).toContain("owner.master_key is distinct from stage.master_key");
  expect(migration).toContain("owner.current_revision is distinct from stage.effective_revision");
  expect(migration).toContain("clinical_master_payload_adoption_owner_identity_invalid");
  expect(migration).toContain("clinical_master_payload_adoption_owner_traversal_count_invalid");
  expect(migration).toContain("owner_manifest.master_record_id = record_row.id");
  expect(migration).toContain("clinical_master_payload_adoption_stage_parity_invalid");
  expect(migration).toContain("v_stage_record_count is distinct from v_release.record_count");
  expect(migration).toContain("v_general_order_stage_count is distinct from v_specialized_order_stage_count");
  expect(migration).toContain("specialized_stage.content_sha256 is distinct from private.clinical_master_sha256");
  expect(migration).toContain("(version.snapshot - 'revision') is distinct from");
  expect(migration).toContain("Payload mode traverses the exact release owner stage only");
  expect(migration).not.toContain("plus existing workspace source rows");
  expect(migration).toContain("v_source_revision := case when v_stage_owner_found then v_stage_revision else v_source.current_revision end");
  expect(migration).toContain("legacy initial/metabolic");
  expect(migration).toContain("v_release.adoption_scope is distinct from 'payload'");
  expect(migration).toContain("on conflict (workspace_id, release_id, source_master_record_id, update_type)");
  expect(migration).toContain("clinical-master-lab-adoption-payload-exact");
  expect(migration).toContain("join private.clinical_master_release_payload_owner_manifest manifest");
  const payloadLabBody = migration.slice(
    migration.indexOf("create or replace function private.clair_adopt_lab_master_projection_to_workspace_payload"),
    migration.indexOf("revoke all on function private.clair_adopt_lab_master_projection_to_workspace_payload"),
  );
  expect(payloadLabBody).not.toContain("private.clair_adopt_lab_master_projection_to_workspace(p_workspace_id, p_release_id)");
  expect(payloadLabBody).not.toContain("workspace_lab_catalog_updates");
  expect(payloadLabBody).not.toContain("workspace_lab_item_updates");
  expect(payloadLabBody).not.toContain("notification_events");
});

test("V3 fixture has 120 payload order owners and the focused replay covers ACL/idempotency evidence", () => {
  expect(adapter.payload.adoptionScope).toBe("payload");
  expect(adapter.payload.records.filter((record) => record.recordType === "order")).toHaveLength(120);
  expect(adapter.payload.records.some((record) => record.masterKey === "cm.order.consult.initial")).toBe(false);
  expect(adapter.payload.records.some((record) => record.masterKey === "phase1.optionb.v1.order.metabolic")).toBe(false);
  expect(replay).toContain("\\ir ../migrations/20260824091724_clinical_master_release_scoped_workspace_adoption.sql");
  expect(replay).toContain("private.publish_clinical_master_release(v_payload, null)");
  expect(replay).toContain("private.clair_adopt_master_release_to_workspace(v_workspace_id, v_payload_release_id)");
  expect(replay).toContain("clinical_master_payload_adoption_manifest_parity_invalid");
  expect(replay).toContain("clinical_master_release_scoped_replay_legacy_retry_failed");
  expect(replay).toContain("clinical_master_release_scoped_replay_payload_canonical_fingerprint_changed");
  expect(replay).toContain("clinical_master_release_scoped_replay_omitted_scope_canonical_fingerprint_changed");
  expect(replay).toContain("clinical_master_release_scoped_replay_payload_publish_retry_failed");
  expect(replay).toContain("0225bc6714210cfe663bded97fe6b3cbf76fedf99dce1540a302c0fd46235893");
  expect(replay).toContain("3213a3f84595ae11007970448b670063c49ea167f01e1825258a655b6843c137");
  expect(replay).toContain("clinical_master_release_scoped_replay_existing_nonpayload_surface_mutated");
  expect(replay).toContain("clinical_master_release_scoped_replay_absent_nonpayload_created");
  expect(replay).toContain("clinical_master_replay_workspace_surface");
  expect(replay).toContain("delete from private.clinical_master_lab_publish_stage");
  expect(replay).toContain("delete from private.clinical_master_lab_order_publish_stage");
  expect(replay).toContain("has_function_privilege('service_role'");
  expect(replay).toContain("private.clair_adopt_master_release_to_workspace_a2_cumulative");
  expect(replay).toContain("private.clair_adopt_lab_master_projection_to_workspace");
  expect(replay).toContain("rollback;");
});

test("scope migration statically pins every internal function boundary and column constraint", () => {
  for (const signature of [
    "private.clinical_master_assert_contract_keys(text, jsonb)",
    "private.clinical_master_canonicalize_payload(jsonb)",
    "private.clinical_master_payload_manifest_content_sha256(",
    "private.clinical_master_release_payload_owner_manifest_immutable()",
    "private.clinical_master_set_release_adoption_scope()",
    "private.publish_clinical_master_release_cumulative(jsonb, uuid)",
    "private.publish_clinical_master_release(jsonb, uuid)",
    "private.clair_adopt_master_release_to_workspace_a2_cumulative(text, uuid)",
    "private.clair_adopt_master_release_to_workspace_payload(text, uuid)",
    "private.clair_adopt_master_release_to_workspace_a2_base(text, uuid)",
    "private.clair_adopt_lab_master_projection_to_workspace_payload(text, uuid)",
  ]) {
    expect(migration).toContain(`revoke all on function ${signature}`);
  }
  expect(migration).toContain("security definer");
  expect(migration).toContain("set search_path = ''");
  expect(migration).toContain("set search_path = pg_catalog");
  expect(migration).toContain("set search_path = public, private, master, extensions, pg_temp");
  expect(replay).toContain("pg_get_userbyid(proc.proowner)='postgres'");
  expect(replay).toContain("proc.prosecdef is not distinct from v_function.security_definer");
  expect(replay).toContain("has_function_privilege('anon'");
  expect(replay).toContain("has_function_privilege('authenticated'");
  expect(replay).toContain("has_function_privilege('service_role'");
  expect(replay).toContain("v_column_not_null is distinct from true");
  expect(replay).toContain("master_releases_adoption_scope_check");
});

test("Phase C tracked contract hash-binds the release-scoped migration, spec, and replay", () => {
  const sha256 = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");
  expect(operationManifest.inputs.releaseScopedAdoptionMigrationSha256).toBe(
    sha256("supabase/migrations/20260824091724_clinical_master_release_scoped_workspace_adoption.sql"),
  );
  expect(operationManifest.inputs.releaseScopedAdoptionSpecSha256).toBe(
    sha256("tests/clinical-master-release-scoped-workspace-adoption.spec.ts"),
  );
  expect(operationManifest.inputs.releaseScopedAdoptionReplaySha256).toBe(
    sha256("supabase/snippets/clinical_master_release_scoped_workspace_adoption_replay.sql"),
  );
});
