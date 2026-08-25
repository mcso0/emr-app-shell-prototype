import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

import authoringJson from "./fixtures/clinical-master-operational-v3-authoring.json";
import { adaptClinicalMasterDiagnosisPublishPayload } from "../src/features/clinical-master/server-clinical-master-diagnosis-publish-adapter";

const migration = readFileSync(
  "supabase/migrations/20260825040149_diagnosis_runtime_catalog_adoption.sql",
  "utf8",
);

test("diagnosis authoring adapter emits the exact deterministic synthetic release", () => {
  const payload = adaptClinicalMasterDiagnosisPublishPayload(authoringJson as never);
  expect(payload.releaseKey).toBe(
    "cm.release.airtable.operational-master.v3.diagnosis-runtime-v1",
  );
  expect(payload.records).toHaveLength(24);
  expect(payload.records.filter((row) => row.recordType === "diagnosis_category")).toHaveLength(12);
  expect(payload.records.filter((row) => row.recordType === "diagnosis_category" && row.detail.categoryKind === "system")).toHaveLength(6);
  expect(payload.records.filter((row) => row.recordType === "diagnosis_category" && row.detail.categoryKind === "disease_group")).toHaveLength(6);
  expect(payload.records.filter((row) => row.recordType === "diagnosis")).toHaveLength(12);
  expect(payload.diagnosisCategoryLinks).toHaveLength(12);
  expect(payload.records.map((row) => row.masterKey)).toEqual(
    [...payload.records.map((row) => row.masterKey)].sort(),
  );
  expect(payload.diagnosisCategoryLinks.every((link) => link.isPrimary)).toBe(true);
});

test("migration keeps publication, adoption, workspace, snapshot, and privilege boundaries explicit", () => {
  for (const token of [
    "private.publish_clinical_master_diagnosis_release",
    "clinical_master_diagnosis_release_must_be_isolated",
    "clinical_master_diagnosis_exactly_one_primary_required",
    "clinical_master_diagnosis_release_shape_invalid",
    "clinical_master_diagnosis_link_sort_order_duplicate",
    "clinical_master_release_payload_owner_manifest",
    "adoption_scope",
    "'payload'",
    "diagnosis_catalog_workspace_id_unique unique(workspace_id, id)",
    "foreign key (workspace_id, diagnosis_catalog_id)",
    "on delete restrict",
    "diagnoses_encounter_catalog_unique_key",
    "public.diagnosis_catalog_classifications",
    "diagnosis_catalog_classifications_one_primary_key",
    "diagnosis_catalog_classifications_sort_order_key",
    "source_projection_snapshot",
    "source_projection_fingerprint",
    "private.clair_adopt_diagnosis_release_to_workspace",
    "diagnosis_catalog_release_manifest_invalid",
    "workspace-clinical-master-pilot-v1",
    "workspace-clair-cheongdam",
    "clair-demo",
    "diagnosis_catalog_workspace_not_allowlisted",
    "public.clair_search_diagnosis_catalog",
    "private.clair_is_active_workspace_member",
    "private.clair_current_user_has_workspace_permission",
    "diagnosis_catalog_identity_immutable",
    "diagnosis_catalog_item_unavailable",
    "order by id\n  for update",
    "for update of catalog",
    "diagnosis_catalog_revision",
    "diagnosis_snapshot",
    "sourceMasterRevision",
    "catalog.last_applied_revision",
    "diagnosisMode",
    "diagnosisTextFingerprint",
  ]) {
    expect(migration).toContain(token);
  }
  expect(migration).not.toContain("CL-DX-");
  expect(migration).toContain("p_workspace_id not in (");
  expect(migration).toContain("manifest.effective_revision");
  expect(migration).toContain("version.snapshot - 'revision'");
  expect(migration).toContain("diagnosis_manifest.relation_content");
  expect(migration).toContain("not diagnosis_catalog.is_active");
  expect(migration).toContain("from public, anon, authenticated, service_role");
});

test("migration preserves legacy publisher behavior and routes diagnosis-only payloads", () => {
  expect(migration).toContain(
    "v_result := private.publish_clinical_master_release_cumulative(v_payload, p_actor_user_id)",
  );
  expect(migration).toContain(
    "v_result := private.publish_clinical_master_diagnosis_release(p_payload, p_actor_user_id)",
  );
  expect(migration).toContain("clinical_master_phase_1a_1_publication");
  expect(migration).toContain("clinical_master_phase_1a1_publication");
});
