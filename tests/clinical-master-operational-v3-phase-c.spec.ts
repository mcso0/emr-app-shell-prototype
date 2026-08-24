import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test } from "@playwright/test";

import adapterJson from "./fixtures/clinical-master-operational-v3-adapter-output.json";
import airtableManifestJson from "./fixtures/clinical-master-operational-v3-airtable-write-manifest.json";
import manifestJson from "./fixtures/clinical-master-operational-v3-phase-c-operation-manifest.json";
import pricingJson from "./fixtures/clinical-master-operational-v3-pricing-adoption.json";

type JsonRecord = Record<string, unknown>;

const adapter = adapterJson as unknown as { payload: JsonRecord & { records: JsonRecord[] } };
const airtableManifest = airtableManifestJson as unknown as JsonRecord;
const manifest = manifestJson as unknown as JsonRecord;
const pricing = pricingJson as unknown as JsonRecord & {
  orders: Array<JsonRecord & { masterKey: string; researchCategory: string; syntheticWorkspacePriceKrw: number }>;
};
const sqlPath = resolve(process.cwd(), "supabase/snippets/clinical_master_operational_v3_phase_c_rollback.sql");
const renderedSqlPath = resolve(process.cwd(), "supabase/snippets/clinical_master_operational_v3_phase_c_rollback_rendered.sql");
const remoteRenderedSqlPath = resolve(process.cwd(), "supabase/snippets/clinical_master_operational_v3_phase_c_rollback_remote_rendered.sql");
const persistentCommitSqlPath = resolve(process.cwd(), "supabase/snippets/clinical_master_operational_v3_phase_c_commit_candidate.sql");
const preflightSqlPath = resolve(process.cwd(), "supabase/snippets/clinical_master_operational_v3_phase_c_preflight.sql");
const pr014Path = resolve(process.cwd(), "docs/work/clinical-master/CLINICAL-MASTER-PR-014-central-publish-adopt-pricing.md");

function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function record(value: unknown, label: string): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value as JsonRecord;
}

function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return value;
}

function assertBalancedSqlParentheses(sql: string, label: string): void {
  let depth = 0;
  let inSingleQuotedString = false;
  for (let index = 0; index < sql.length; index += 1) {
    const character = sql[index];
    if (character === "'") {
      if (inSingleQuotedString && sql[index + 1] === "'") {
        index += 1;
      } else {
        inSingleQuotedString = !inSingleQuotedString;
      }
      continue;
    }
    if (inSingleQuotedString) continue;
    if (character === "(") depth += 1;
    if (character === ")") {
      depth -= 1;
      if (depth < 0) throw new Error(`${label} closes before it opens at offset ${index}`);
    }
  }
  if (inSingleQuotedString || depth !== 0) throw new Error(`${label} is not balanced (depth=${depth})`);
}

test("Phase C manifest locks the central publish and adoption boundary", () => {
  expect(manifest.schemaVersion).toBe("clinical-master-phase-c-operation-v1");
  expect(manifest.status).toBe("commit_candidate_pending_human_review");
  expect(manifest.writeAllowed).toBe(false);
  expect(manifest.mutationsPerformed).toBe(0);
  expect(manifest.remoteWritesPerformed).toBe(false);

  const inputs = record(manifest.inputs, "manifest.inputs");
  expect(inputs.projectRef).toBe("qmerxgzrwaaahpkhjqlc");
  expect(inputs.adapterFixtureSha256).toBe("ee7c8d0f379c71ac675ad90d9e92abfd17da798785b4e0ebd566c6e8394e8697");
  expect(inputs.pricingFixtureSha256).toBe("7b0e273f9809e9febc2d74a9cc332f1a6fe4866bc112182da58cfba6a9e0ab2b");
  expect(inputs.airtableCasBaselineSha256).toBe("f3ba11edfc20ed0244ca4cb9c5bf0590313a173e2c07478edd35d05fcb059a4f");
  expect(inputs.remotePreflightQuerySha256).toBe("6faf29e765a129c75e7a767331228262ca4ace969ccbba6307612d4a888e57ca");
  expect(inputs.payloadRecordCount).toBe(230);
  expect(inputs.orderCount).toBe(120);
  expect(inputs.adapterAdoptionScope).toBe("payload");
  expect(inputs.publisherSourceFingerprint).toBe("0225bc6714210cfe663bded97fe6b3cbf76fedf99dce1540a302c0fd46235893");
  expect(record(inputs.publisherSourceFingerprintDerivation, "fingerprint derivation")).toEqual({
    canonicalizer: "private.clinical_master_canonicalize_payload(jsonb)",
    serialization: "PostgreSQL jsonb ::text UTF-8",
    digest: "sha256",
    replayEvidence: "supabase/snippets/clinical_master_release_scoped_workspace_adoption_replay.sql",
    scopeEffect: "explicit adoptionScope=payload is included; omitted scope preserves historical canonical bytes",
  });
  expect(inputs.categoryCounts).toEqual({
    consultation: 12,
    preventive: 12,
    lab: 30,
    imaging: 12,
    treatment: 18,
    dispensing: 16,
    "surgery/anesthesia": 8,
    inpatient: 6,
    emergency: 3,
    dental: 2,
    "certificate/misc": 1,
  });

  expect(adapter.payload.records).toHaveLength(230);
  expect(adapter.payload.adoptionScope).toBe("payload");
  expect(pricing.orders).toHaveLength(120);
  expect(new Set(pricing.orders.map((row) => row.masterKey)).size).toBe(120);
  expect(new Set(pricing.orders.map((row) => row.syntheticWorkspacePriceKrw)).size).toBe(120);
  expect(pricing.orders.every((row) => Number.isInteger(row.syntheticWorkspacePriceKrw) && row.syntheticWorkspacePriceKrw > 0)).toBe(true);
  expect(pricing.orders.reduce((sum, row) => sum + row.syntheticWorkspacePriceKrw, 0)).toBe(5529073);
  expect(pricing.totalSyntheticWorkspacePriceKrw).toBe(5529073);

  const adoption = record(manifest.adoptionPlan, "manifest.adoptionPlan");
  expect(adoption.allowlist).toEqual([
    "workspace-clinical-master-pilot-v1",
    "workspace-clair-cheongdam",
    "clair-demo",
  ]);
  expect(adoption.excluded).toEqual([{ workspaceId: "clair-foreign-demo", policy: "read_only_pre_post_fingerprint_no_write" }]);
  expect(adoption.transactionBoundary).toContain("one top-level atomic transaction");
  expect(adoption.transactionBoundary).toContain("cross-workspace partial commit is impossible");
  expect(adoption.finalCounts).toContain("never assume 120 total catalog rows");
  expect(adoption.orderReviewBoundary).toContain("one strict review pass per workspace");
  expect(adoption.orderReviewBoundary).toContain("independently published update and held-version releases");
  expect(adoption.orderReviewBoundary).toContain("held releaseNo <= update releaseNo <= v3 releaseNo");
  expect(adoption.orderReviewBoundary).toContain("update release identity is never required to equal the held version release");
  expect(adoption.orderReviewBoundary).toContain("legacy v2-held payload rows remain eligible");
  expect(adoption.orderReviewBoundary).toContain("nonpayload legacy initial and metabolic rows");
  expect(adoption.preActivationReviewCoverage).toContain("every payload catalog must resolve to the exact current source revision");
  expect(adoption.preActivationReviewCoverage).toContain("resolvedAt");
  expect(adoption.preActivationReviewCoverage).toContain("missingAccepted and pendingLinked");
  expect(record(manifest.legacyNonPayloadGuard, "legacy nonpayload guard")).toMatchObject({ masterKey: "cm.order.consult.initial" });
  expect(record(manifest.freshKeyPreflightAbsence, "fresh consultation preflight absence")).toMatchObject({
    masterKey: "cm.order.consult.first-visit",
    requireAbsentBeforePublish: true,
  });

  const labPlan = record(manifest.labPlan, "manifest.labPlan");
  expect(record(labPlan.sourceLabRecords, "source lab records")).toMatchObject({ tests: 36, referencedTests: 30, panels: 10, panelItems: 60, profiles: 30 });
  const expectedProjection = record(labPlan.expectedAdoptionProjection, "expected lab adoption projection");
  expect(record(expectedProjection.catalogCount, "catalog count semantics")).toMatchObject({ v3Final: 30, rpcSemantics: "exact payload-manifest lab order owners only; existing nonpayload catalogs are excluded" });
  expect(record(expectedProjection.createdItemCount, "created item semantics")).toMatchObject({ semantics: "new lab-test versions only; baseline plus delta must equal the exact 30-test payload target-ID set", strictV3ReferencedTests: 30 });
  expect(record(expectedProjection.createdLinkCount, "created link semantics")).toMatchObject({ semantics: "projection attempts from exact payload-manifest catalog profiles only; not a creation delta", v3Final: 80 });
  expect(record(expectedProjection.workspaceLinkAttemptContract, "workspace link attempt contract")).toMatchObject({ profiles: 30, directProfiles: 20, panelProfiles: 10, panelItems: 60, expandedLinks: 80, formula: "20 direct-test profiles + 60 panel items = 80 links" });
  expect(expectedProjection.finalUniqueProjection).toEqual({ catalogs: 30, tests: 30, links: 80 });
  expect(record(expectedProjection.idempotentRetry, "adopter retry")).toMatchObject({ catalogCount: "same exact payload total", createdItemCount: 0, createdLinkCount: "same exact payload attempt total", finalUniqueProjection: { catalogs: 30, tests: 30, links: 80 } });
  const frozenTargetSet = record(labPlan.frozenEligibleTargetSet, "frozen eligible lab target set");
  expect(frozenTargetSet.semantics).toContain("v3 payload-manifest order profiles and pinned panel expansions");
  expect(frozenTargetSet.semantics).toContain("excludes both missing and existing nonpayload initial/metabolic orders");
  expect(array(frozenTargetSet.identityPolicy, "frozen target identity policy")).toEqual(expect.arrayContaining([
    "reject null target IDs or revisions",
    "reject duplicate targets within one pinned profile",
    "reject duplicate or ambiguous master-key/record-ID identities",
    "use the frozen target-ID set for every version count and semantic fingerprint",
  ]));
  expect(frozenTargetSet.retryPolicy).toContain("after-before version-row count equals returned createdItemCount");
  expect(array(labPlan.projectionAssertions, "lab projection assertions")).toContain("central payload defines 36 lab tests; only 30 referenced test keys are projected");
  expect(array(labPlan.projectionAssertions, "lab projection assertions")).toContain("20 direct-test profiles plus 60 panel items expand to exactly 80 payload-linked workspace lab links");
  expect(array(labPlan.projectionAssertions, "lab projection assertions")).toContain("before/after/retry lab_test_item_versions counts and ordered semantic SHA use the exact payload target-ID set");

  const collision = record(manifest.collisionPolicy, "manifest.collisionPolicy");
  expect(collision.customWins).toBe(true);
  expect(collision.deleteCustomRows).toBe(false);
  expect(array(collision.reviewedRules, "collision rules")).toHaveLength(11);
  expect(array(collision.reviewedRules, "collision rules").every((item) => record(item, "collision rule").workspaceId === "workspace-clair-cheongdam")).toBe(true);
  expect(record(array(collision.reviewedRules, "collision rules")[0], "first collision rule")).toMatchObject({ masterKey: "cm.order.consult.first-visit", customRowId: "cd-consult-first" });
  const airtableMasterTable = record(record(airtableManifest.tables, "airtable manifest.tables")["Master Records"], "Master Records table");
  expect(airtableMasterTable.updateExisting).toBe(1);
  expect(array(airtableMasterTable.updatePayloads, "identity fork update payloads")).toEqual([expect.objectContaining({ recordId: "recZW92s9i06wpNp0", currentMasterKey: "cm.order.consult.initial", newMasterKey: "cm.order.consult.first-visit" })]);
  expect(record(manifest.authenticatedExecution, "manifest.authenticatedExecution")).toMatchObject({
    claimKeys: ["request.jwt.claim.sub", "request.jwt.claims"],
    claimShape: "{sub: selected actor UUID, role: authenticated}",
  });
  const rpcContracts = record(manifest.rpcContracts, "manifest.rpcContracts");
  expect(record(rpcContracts.publisher, "publisher RPC contract")).toMatchObject({
    securityBoundary: "private; effective EXECUTE denied for anon, authenticated, and service_role",
  });
  expect(record(rpcContracts.adopter, "adopter RPC contract")).toMatchObject({
    securityBoundary: "private; effective EXECUTE denied for anon, authenticated, and service_role",
  });

  const preflight = record(manifest.preflight, "manifest.preflight");
  expect(preflight.remoteReadOnlyBaseline).toMatchObject({
    releases: {
      count: 4,
      maxReleaseNo: 6,
      latestSourceFingerprint: "85cb291602f3d177ae11a075b4203bdf9e7cb9a3ac68c5a8245a5a90f739b7c7",
      releaseNoSequence: {
        name: "master.master_releases_release_no_seq",
        lastValue: 8,
        isCalled: true,
        nextReleaseNo: 9,
        exactAtExecution: true,
      },
    },
    masterRecordTypeCounts: {
      chart_group: 6,
      clinical_action: 12,
      lab_panel: 5,
      lab_test: 14,
      order: 31,
      order_category: 8,
      result_input_type: 4,
      species: 2,
      specimen_type: 5,
      task_route: 6,
      unit: 8,
    },
    labPublishStageCount: 172,
    labPublishStageFingerprint: "eac749d40ab0f0e88f9dabed2a5123b85933367d3fae4a3828ad37893e1a45c4",
  });
  expect(record(preflight.remoteReadOnlyBaseline, "remote baseline").catalogFingerprints).toEqual({
    "workspace-clinical-master-pilot-v1": { rowCount: 31, fingerprint: "5fe7ba9e93a045076157a77e5c852a5712660f99a0d2afbb3064a143c7586de0", fullFingerprintRequiredAtExecution: true },
    "workspace-clair-cheongdam": { rowCount: 13, fingerprint: "82b9b2a3e9722093a65709a5a9dbdff19f709a8c00616a8203ec0b55f7d1d3c4", fullFingerprintRequiredAtExecution: true },
    "clair-demo": { rowCount: 19, fingerprint: "c195d802a07ef3f820aed21809bc7d7bf84fa5013ed4e98e4951e64f5242bcf1", fullFingerprintRequiredAtExecution: true },
    "clair-foreign-demo": { rowCount: 0, fingerprint: "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945", fullFingerprintRequiredAtExecution: true },
  });
});

test("Phase C SQL is fail-closed, RPC-only for workspace writes, and restores auth context", () => {
  const sql = readFileSync(sqlPath, "utf8");

  expect(sql).toContain("begin;");
  expect(sql).toContain("rollback;");
  expect(sql).toContain("clinical_master_operational_v3_phase_c_rollback_ok");
  expect(sql).toContain("clinical_master_phase_c_exact_remote_fingerprints_required");
  expect(sql).toContain("clinical_master_phase_c_release_baseline_mismatch");
  expect(sql).toContain("pg_get_serial_sequence('master.master_releases','release_no')");
  expect(sql).toContain("v_release_sequence regclass;");
  expect(sql).toContain("clinical_master_phase_c_release_sequence_binding_invalid");
  expect(sql).toContain("perform setval(v_release_sequence,v_sequence_restore_last_value,v_sequence_restore_is_called);");
  expect(sql).toContain("clinical_master_phase_c_release_sequence_restore_failed");
  expect(sql).toContain("when query_canceled then");
  expect(sql).toContain("when others then");
  expect(sql).toContain("clinical_master_phase_c_foreign_post_adoption_drift");
  expect(sql).toContain("clinical_master_phase_c_existing_master_identity_changed");
  expect(sql).toContain("clinical_master_phase_c_existing_stage_changed");
  expect(sql).toContain("v_publish_result jsonb;");
  expect(sql).toContain("v_publish_result->>'recordCount'");
  expect(sql).toContain("clinical_master_phase_c_order_review_evidence_invalid");
  expect(sql).toContain("clinical_master_phase_c_legacy_initial_surface_changed");
  expect(sql).toContain("clinical_master_phase_c_legacy_initial_row_set_changed");
  expect(sql).toContain("clinical_master_phase_c_lab_item_review_evidence_invalid");
  expect(sql).toContain("clinical_master_phase_c_lab_catalog_review_evidence_invalid");
  expect(sql).not.toContain("clinical_master_phase_c_lab_item_review_evidence_missing");
  expect(sql).not.toContain("clinical_master_phase_c_lab_catalog_review_evidence_missing");
  expect(sql).toContain("optional workspace review ledgers");
  expect(sql).toContain("evidenceMode");
  expect(sql).not.toContain("clinical_master_phase_c_audit_rows_decreased");
  expect(sql).toContain("expected_stage_fingerprint");
  expect(sql).toContain("v_before_stage_fingerprint<>v_expected_stage_fingerprint");
  expect(sql).toContain("v_before_type_counts <> '{\"chart_group\":6,\"clinical_action\":12,\"lab_panel\":5,\"lab_test\":14,\"order\":31,\"order_category\":8,\"result_input_type\":4,\"species\":2,\"specimen_type\":5,\"task_route\":6,\"unit\":8}'::jsonb");
  expect(sql).toContain("private.publish_clinical_master_release(v_payload,null)");
  for (const role of ["anon", "authenticated", "service_role"]) {
    expect(sql).toContain(`has_function_privilege('${role}','private.publish_clinical_master_release(jsonb,uuid)'::regprocedure,'execute')`);
    expect(sql).toContain(`has_function_privilege('${role}','private.clair_adopt_master_release_to_workspace(text,uuid)'::regprocedure,'execute')`);
  }
  for (const signature of [
    "private.clinical_master_assert_contract_keys(text,jsonb)",
    "private.clinical_master_canonicalize_payload(jsonb)",
    "private.clinical_master_payload_manifest_content_sha256(uuid,text,text,boolean,integer,jsonb,jsonb)",
    "private.clinical_master_release_payload_owner_manifest_immutable()",
    "private.clinical_master_set_release_adoption_scope()",
    "private.publish_clinical_master_release_cumulative(jsonb,uuid)",
    "private.publish_clinical_master_release(jsonb,uuid)",
    "private.clair_adopt_master_release_to_workspace_a2_cumulative(text,uuid)",
    "private.clair_adopt_master_release_to_workspace_payload(text,uuid)",
    "private.clair_adopt_master_release_to_workspace_a2_base(text,uuid)",
    "private.clair_adopt_lab_master_projection_to_workspace_payload(text,uuid)",
    "private.clair_adopt_master_release_to_workspace(text,uuid)",
    "private.clair_adopt_lab_master_projection_to_workspace(text,uuid)",
  ]) {
    expect(sql).toContain(`('${signature}',`);
  }
  expect(sql).toContain("proc.proconfig is not distinct from array[");
  expect(sql).toContain("clinical_master_phase_c_release_scope_function_security_failed");
  expect(sql).toContain("clinical_master_phase_c_payload_manifest_table_security_failed");
  expect(sql).toContain("clinical_master_release_payload_owner_manifest_immutable BEFORE INSERT OR DELETE OR UPDATE");
  expect(sql).toContain("master_releases_set_adoption_scope BEFORE INSERT ON master.master_releases");
  expect(sql).toContain("constraint_row.convalidated");
  expect(sql).toContain("CHECK ((adoption_scope = ANY (ARRAY[''cumulative''::text, ''payload''::text])))");
  expect(sql).toContain("clinical_master_phase_c_adoption_scope_schema_invalid");
  expect(sql.indexOf("for v_function in")).toBeLessThan(
    sql.indexOf("v_result := private.publish_clinical_master_release(v_payload,null)"),
  );
  expect(sql).toContain("clinical_master_phase_c_private_execute_leaked");
  expect(sql).toContain("clinical_master_phase_c_authenticated_execute_missing");
  expect(sql).toContain("clinical_master_phase_c_public_execute_leaked");
  expect(sql).toContain("clinical_master_phase_c_payload_master_resolution_invalid");
  expect(sql).toContain("clinical_master_phase_c_payload_master_count_invalid");
  expect(sql).toContain("clinical_master_phase_c_fresh_consultation_key_preflight_present:central");
  expect(sql).toContain("clinical_master_phase_c_fresh_consultation_key_preflight_present:workspace");
  expect(sql).toContain("clinical_master_phase_c_fresh_consultation_key_publish_revision_invalid");
  expect(sql).toContain("version_row.snapshot=payload_first.value || jsonb_build_object(");
  expect(sql).toContain("'labOrderProfiles','[]'::jsonb");
  expect(sql).toContain("master_row.current_revision=1");
  expect(sql).toContain("version_row.snapshot->>'masterKey'='cm.order.consult.first-visit'");
  expect(sql).toContain("private.clair_adopt_master_release_to_workspace(v_workspace,v_release_id)");
  expect(sql).toContain("cm_phase_c_lab_adoption_profile_targets");
  expect(sql).toContain("cm_phase_c_lab_adoption_target_candidates");
  expect(sql).toContain("existing_pinned_profiles");
  expect(sql).not.toContain("current_master_profiles");
  expect(sql).toContain("Payload-scoped adoption");
  expect(sql).toContain("v3_release_profiles");
  expect(sql).toContain("v3_payload_profiles");
  expect(sql).toContain("v_payload->'labOrderProfiles'");
  expect(sql).toContain("v_payload->>'adoptionScope'");
  expect(sql).toContain("adoption_scope='payload'");
  expect(sql).toContain("clinical_master_phase_c_payload_adoption_scope_invalid");
  expect(sql).toContain("clinical_master_phase_c_lab_adoption_target_identity_null");
  expect(sql).toContain("clinical_master_phase_c_lab_adoption_target_duplicate");
  expect(sql).toContain("clinical_master_phase_c_lab_adoption_target_identity_ambiguous");
  expect(sql).toContain("clinical_master_phase_c_lab_adoption_profile_target_ambiguous");
  expect(sql).toContain("public.clair_update_order_catalog_item");
  expect(sql).toContain("update_row.update_type='new'");
  expect(sql).toContain("update_row.status='pending'");
  expect(sql).toContain("review_item.source_master_record_id=update_row.source_master_record_id");
  expect(sql).toContain("update_row.source_snapshot=canonical_projection.value");
  expect(sql).toContain("update_row.source_revision=review_master.current_revision");
  expect(sql).toContain("update_row.source_revision=review_master.current_revision");
  expect(sql).toContain("clinical_master_phase_c_order_review_count_invalid");
  expect(sql).toContain("v_pre_activation_missing jsonb;");
  expect(sql).toContain("v_pre_activation_pending jsonb;");
  expect(sql).toContain("v_pre_activation_coverage jsonb;");
  expect(sql).toContain("clinical_master_phase_c_pre_activation_review_coverage_invalid");
  expect(sql).toContain("'missingAccepted'");
  expect(sql).toContain("'pendingLinked'");
  expect(sql).toContain("'linkedUpdates'");
  expect(sql).toContain("'itemSourceRevision'");
  expect(sql).toContain("'masterCurrentRevision'");
  expect(sql).toContain("'sourceMasterRecordId',update_row.source_master_record_id");
  expect(sql).toContain("'resolvedAt',update_row.resolved_at");
  expect(sql).toMatch(/where update_row\.workspace_id=v_workspace\s+and update_row\.order_catalog_item_id=item\.id\),'\[\]'::jsonb\)/);
  expect(sql).toContain("accepted_row.resolved_by_user_id is not null");
  expect(sql).toContain("accepted_row.resolved_at is not null");
  expect(sql).toContain("cm_phase_c_order_review_targets");
  expect(sql).toContain("update_release_id uuid not null");
  expect(sql).toContain("update_release_key text not null");
  expect(sql).toContain("update_release_no bigint not null");
  expect(sql).toContain("held_version_release_id uuid not null");
  expect(sql).toContain("held_version_release_key text not null");
  expect(sql).toContain("held_version_release_no bigint not null");
  expect(sql).toContain("held_release.release_no<=update_release.release_no");
  expect(sql).toContain("update_release.release_no<=v_release_no");
  expect(sql).toContain("v_update.release_id is distinct from v_target.update_release_id");
  expect(sql).toContain("v_held_version.release_id is distinct from v_target.held_version_release_id");
  expect(sql).toContain("accepted_row.release_id=v_target.update_release_id");
  expect(sql).toContain("accepted_row.release_id=update_release.id");
  expect(sql).not.toContain("update_row.release_id=held_version.release_id");
  expect(sql).not.toContain("accepted_row.release_id=target_row.held_version_release_id");
  expect(sql).toContain("held_version.snapshot->>'recordType'='order'");
  expect(sql).toContain("held_version.snapshot->>'revision'=held_version.revision::text");
  expect(sql).toContain("canonical_source_projection jsonb not null");
  expect(sql).toContain("canonical_source_fingerprint text not null");
  expect(sql).toContain("select private.clinical_master_order_source_projection(review_master.id) as value");
  expect(sql).toContain("canonical_projection.value");
  expect(sql).not.toContain("held_projection");
  expect(sql).not.toContain("held_version_projection");
  expect(sql).not.toContain("'defaultSalesUnitCode',held_version.snapshot");
  expect(sql).toContain("private.clinical_master_projection_fingerprint(v_target.canonical_source_projection)");
  expect(sql).toContain("clinical_master_phase_c_order_review_target_shape_invalid");
  expect(sql).toContain("selectedTargetCount=%:pendingPayloadCount=%:payloadCatalogCount=%:positivePricePayloadCount=%:canonicalProjectionMatchCount=%:versionReleaseMatchCount=%");
  expect(sql).toContain("v_payload_pending_review_count");
  expect(sql).toContain("v_positive_price_payload_count");
  expect(sql).toContain("v_canonical_projection_match_count");
  expect(sql).toContain("v_version_release_match_count");
  expect(sql).toContain("v_order_review_target_count<>120");
  expect(sql).toContain("v_payload_pending_review_count<>120");
  expect(sql).toContain("v_payload_catalog_count<>120");
  expect(sql).toContain("v_positive_price_payload_count<>120");
  expect(sql).toContain("v_canonical_projection_match_count<>120");
  expect(sql).toContain("v_version_release_match_count<>120");
  expect(sql).toContain("coalesce(v_result->>'enforcedBy','')<>'clair_resolve_workspace_master_update'");
  expect(sql).toContain("v_result->'item'->>'source_master_record_id'");
  expect(sql).toContain("v_result->'item'->>'source_master_revision'");
  expect(sql).toContain("'names',coalesce");
  expect(sql).toContain("'recordSources',coalesce");
  expect(sql).toContain("'speciesLinks',coalesce");
  expect(sql).toContain("pending_update.status='pending'");
  expect(sql).toContain("orderReviewScope");
  expect(sql).not.toContain("update_row.release_id=v_release_id and update_row.status='pending'");
  expect(sql).toContain("jsonb_build_object('priceKrw',(v_price->>'syntheticWorkspacePriceKrw')::integer)");
  expect(sql).toContain("jsonb_build_object('availabilityStatus','active')");
  expect((sql.match(/jsonb_build_object\('priceKrw',\(v_price->>'syntheticWorkspacePriceKrw'\)::integer\)/g) ?? []).length).toBe(1);
  expect((sql.match(/jsonb_build_object\('availabilityStatus','active'\)/g) ?? []).length).toBe(1);
  const pricePatchOffset = sql.indexOf("jsonb_build_object('priceKrw',(v_price->>'syntheticWorkspacePriceKrw')::integer)");
  const orderReviewOffset = sql.indexOf("public.clair_resolve_workspace_master_update(v_workspace,v_target.update_id,v_catalog_count,'accept_source')");
  const activePatchOffset = sql.indexOf("jsonb_build_object('availabilityStatus','active')");
  const collisionPauseOffset = sql.indexOf("jsonb_build_object('availabilityStatus','paused')");
  const coverageGuardOffset = sql.indexOf("clinical_master_phase_c_pre_activation_review_coverage_invalid");
  expect(pricePatchOffset).toBeLessThan(orderReviewOffset);
  expect(orderReviewOffset).toBeLessThan(activePatchOffset);
  expect(coverageGuardOffset).toBeLessThan(activePatchOffset);
  expect(activePatchOffset).toBeLessThan(collisionPauseOffset);
  expect(sql).toContain("Resolve one strict pending/new review target per payload catalog");
  expect(sql).not.toContain("cm_phase_c_order_review_pass_a");
  expect(sql).not.toContain("cm_phase_c_order_review_pass_b");
  expect(sql).toContain("update_row.previous_source_revision is null");
  expect(sql).toContain("update_row.workspace_snapshot is null");
  expect(sql).toContain("update_release_id uuid not null");
  expect(sql).toContain("held_version_release_id uuid not null");
  expect(sql).toContain("held_release.release_no<=update_release.release_no");
  expect(sql).toContain("update_release.release_no<=v_release_no");
  expect(sql).not.toContain("update_row.release_id=held_version.release_id");
  expect(sql).toContain("clinical_master_phase_c_order_review_target_invalid");
  expect(sql).toContain("'releaseMatch',diagnostic.release_match");
  expect(sql).toContain("'sourceFingerprintMatch',diagnostic.source_fingerprint_match");
  expect(sql).toContain("'heldPublishedVersionExists',diagnostic.held_published_version_exists");
  expect(sql).toContain("as release_match");
  expect(sql).toContain("as source_fingerprint_match");
  expect(sql).toContain("as held_published_version_exists");
  const invalidDiagnosticLine = sql.split("\n").find((line) => line.includes("clinical_master_phase_c_order_review_target_invalid"));
  expect(invalidDiagnosticLine).toBeDefined();
  expect(invalidDiagnosticLine).toContain("diagnostic.held_published_version_exists))::text;");
  expect(invalidDiagnosticLine).not.toContain("diagnostic.held_published_version_exists)))::text;");
  assertBalancedSqlParentheses(invalidDiagnosticLine ?? "", "order review invalid diagnostic");
  expect(sql).toContain("public.clair_resolve_workspace_master_update");
  expect(sql).toContain("public.clair_resolve_workspace_lab_definition_update");
  expect(sql).toContain("workspace-clinical-master-pilot-v1");
  expect(sql).toContain("workspace-clair-cheongdam");
  expect(sql).toContain("clair-demo");
  expect(sql).toContain("clair-foreign-demo");
  expect(sql).not.toContain("clinical-master-pr012");
  expect(sql).not.toMatch(/\b(?:insert|update|delete)\s+(?:into\s+)?public\.(?:order_catalog_items|workspace_master_updates|workspace_lab_item_updates|workspace_lab_catalog_updates|audit_events)\b/iu);

  expect(sql).toContain("v_original_sub := current_setting('request.jwt.claim.sub',true);");
  expect(sql).toContain("v_original_claims := current_setting('request.jwt.claims',true);");
  expect(sql).toContain("jsonb_build_object('sub',v_actor::text,'role','authenticated')::text");
  expect(sql).toContain("perform set_config('request.jwt.claim.sub',v_actor::text,true);");
  expect(sql).toContain("perform set_config('request.jwt.claim.sub',coalesce(nullif(v_original_sub,''),''),true);");
  expect(sql).toContain("perform set_config('request.jwt.claims',coalesce(nullif(v_original_claims,''),'{}'),true);");
  expect((sql.match(/execute 'set local role authenticated';/g) ?? []).length).toBe(6);
  expect((sql.match(/execute 'set local role postgres';/g) ?? []).length).toBeGreaterThanOrEqual(6);

  let authenticatedRoleOffset = sql.indexOf("execute 'set local role authenticated';");
  while (authenticatedRoleOffset >= 0) {
    const preceding = sql.slice(Math.max(0, authenticatedRoleOffset - 260), authenticatedRoleOffset);
    expect(preceding).toContain("request.jwt.claim.sub");
    expect(preceding).toContain("request.jwt.claims");
    authenticatedRoleOffset = sql.indexOf("execute 'set local role authenticated';", authenticatedRoleOffset + 1);
  }
});

test("Phase C SQL keeps lab and price cardinality separate from the 230-row publisher stage", () => {
  const sql = readFileSync(sqlPath, "utf8");
  const payloadProfiles = array(adapter.payload.labOrderProfiles, "adapter lab order profiles").map((value) => record(value, "lab order profile"));
  const payloadPanelItems = array(adapter.payload.labPanelItems, "adapter lab panel items").map((value) => record(value, "lab panel item"));
  const referencedTestKeys = payloadProfiles.flatMap((profile) => {
    const directTestKey = typeof profile.labTestMasterKey === "string" ? profile.labTestMasterKey.trim() : "";
    if (directTestKey) return [directTestKey];
    const panelKey = typeof profile.labPanelMasterKey === "string" ? profile.labPanelMasterKey.trim() : "";
    return payloadPanelItems
      .filter((panelItem) => panelItem.panelMasterKey === panelKey)
      .map((panelItem) => String(panelItem.testMasterKey));
  });
  const fanoutCounts = new Map<string, number>();
  for (const testKey of referencedTestKeys) fanoutCounts.set(testKey, (fanoutCounts.get(testKey) ?? 0) + 1);
  expect(referencedTestKeys).toHaveLength(80);
  expect(new Set(referencedTestKeys).size).toBe(30);
  expect([...fanoutCounts.values()].filter((count) => count > 1)).toHaveLength(21);
  expect(Math.max(...fanoutCounts.values())).toBeLessThanOrEqual(7);

  expect(sql).toContain("jsonb_array_length(coalesce(v_payload->'records','[]'::jsonb)) <> 230");
  expect(sql).toContain("jsonb_array_length(coalesce(v_payload->'labPanelItems','[]'::jsonb)) <> 60");
  expect(sql).toContain("jsonb_array_length(coalesce(v_payload->'labOrderProfiles','[]'::jsonb)) <> 30");
  expect(sql).toContain("where release_id=v_release_id)<>36");
  expect(sql).toContain("where release_id=v_release_id)<>10");
  expect(sql).toContain("where release_id=v_release_id)<>120");
  expect(sql).toContain("v_result->'labProjection'->>'catalogCount'");
  expect(sql).toContain("v_result->'labProjection'->>'createdItemCount'");
  expect(sql).toContain("v_result->'labProjection'->>'createdLinkCount'");
  expect(sql).not.toContain("v_before_lab_test_version_item_count+v_adoption_created_item_count<>30");
  expect(sql).not.toContain("v_adoption_created_item_count>30");
  expect(sql).toContain("v_before_lab_test_version_count");
  expect(sql).toContain("select count(*),count(distinct item_version.lab_test_item_id) into v_before_lab_test_version_count,v_before_lab_test_version_item_count");
  expect(sql).toContain("v_before_lab_test_version_fingerprint text;");
  expect(sql).toContain("into v_before_lab_test_version_fingerprint");
  expect(sql).toContain("join cm_phase_c_lab_adoption_test_targets frozen_target");
  expect(sql).toContain("v_after_first_lab_test_version_count-v_before_lab_test_version_count<>v_adoption_created_item_count");
  expect(sql).toContain("clinical_master_phase_c_lab_test_version_delta_invalid:workspace=% beforeVersionCount=% afterVersionCount=% returnedCreatedItemCount=%");
  expect(sql).toContain("v_after_first_lab_test_item_count<>30");
  expect(sql).toContain("clinical_master_phase_c_first_lab_test_item_cardinality_invalid:workspace=% actual=% expected=%");
  expect(sql).toContain("clinical_master_phase_c_first_lab_test_source_invalid:%");
  expect(sql).toContain("clinical_master_phase_c_order_catalog_projection_shape_invalid:%");
  expect(sql).toContain("clinical_master_phase_c_order_catalog_projection_final_shape_invalid:%");
  expect((sql.match(/clinical_master_phase_c_order_catalog_projection_shape_invalid:%/g) ?? []).length).toBe(1);
  expect((sql.match(/clinical_master_phase_c_order_catalog_projection_final_shape_invalid:%/g) ?? []).length).toBe(1);
  expect((sql.match(/item\.standard_order_id is distinct from master_row\.master_key/g) ?? []).length).toBe(2);
  expect(sql).toContain("catalog_row_count");
  expect(sql).toContain("v_adoption_created_link_count<>v_expected_initial_workspace_lab_link_attempt_count");
  expect(sql).toContain("v_adoption_catalog_count<>v_expected_workspace_lab_catalog_count");
  expect(sql).toContain("clinical_master_phase_c_lab_adoption_shape_invalid:workspace=% returnedCatalogCount=% returnedCreatedItemCount=% returnedCreatedLinkCount=% expectedLiveCatalogCount=% expectedInitialLiveLinkAttempts=%");
  expect(sql).toContain("v_expected_workspace_lab_catalog_count");
  expect(sql).toContain("v_expected_workspace_lab_link_attempt_count");
  expect(sql).toContain("v_expected_initial_workspace_lab_link_attempt_count");
  expect(sql).toContain("into v_expected_initial_workspace_lab_link_attempt_count");
  expect((sql.match(/v_expected_workspace_lab_link_attempt_count\s*:=/g) ?? []).length).toBe(1);
  expect((sql.match(/into v_expected_workspace_lab_link_attempt_count/g) ?? []).length).toBe(0);
  expect(sql.indexOf("with eligible as (" )).toBeGreaterThan(sql.indexOf("v_result := private.clair_adopt_master_release_to_workspace(v_workspace,v_release_id)"));
  expect(sql).toContain("cm_phase_c_payload_records");
  expect(sql).toContain("cm_phase_c_referenced_test_keys");
  expect(sql).toContain("order_version.snapshot->'labOrderProfiles'");
  expect(sql).toContain("panel_version.snapshot->'labPanelItems'");
  expect(sql).toContain("v_lab_test_count<>30");
  expect(sql).toContain("v_expected_lab_test_count<>30");
  expect(sql).toContain("join cm_phase_c_payload_records link_payload");
  expect(sql).toContain("v_retry_catalog_count<>v_expected_workspace_lab_catalog_count");
  expect(sql).toContain("v_retry_created_link_count<>v_expected_initial_workspace_lab_link_attempt_count");
  expect(sql).toContain("'expectedInitialWorkspaceLabLinkAttemptCount',v_expected_initial_workspace_lab_link_attempt_count");
  expect(sql).toContain("nonpayload metabolic catalog remains outside both totals");
  expect(sql).toContain("clinical_master_phase_c_lab_adoption_retry_not_idempotent");
  expect(sql).toContain("v_after_first_lab_test_version_count");
  expect(sql).toContain("v_after_retry_lab_test_version_count");
  expect(sql).toContain("v_after_first_lab_test_version_fingerprint");
  expect(sql).toContain("v_after_retry_lab_test_version_fingerprint");
  expect(sql).toContain("v_after_retry_lab_test_version_count-v_after_first_lab_test_version_count<>v_retry_created_item_count");
  expect(sql).toContain("clinical_master_phase_c_lab_test_item_versions_retry_drift");
  expect(sql).toContain("'labTestItemId',item_version.lab_test_item_id");
  expect(sql).toContain("v_lab_catalog_count<>v_expected_profile_count");
  expect(sql).toContain("count(distinct link.id)");
  expect(sql).toContain("clinical_master_phase_c_duplicate_lab_test_source");
  expect(sql).toContain("select distinct target_master_record_id");
  expect(sql).toContain("count(distinct target_record.master_key)<>1");
  expect(sql).not.toContain("having count(target_record.id)<>1 or bool_and(target_record.master_key is not null) is not true");
  expect(sql).not.toContain("v_lab_link_count <> v_expected_panel_link_count");
  expect(sql).toContain("v_lab_link_count <> v_expected_workspace_lab_link_attempt_count");
  expect(sql).toContain("v_expected_direct_profile_count<>20");
  expect(sql).toContain("v_expected_panel_profile_count<>10");
  expect(sql).toContain("v_expected_panel_item_count<>60");
  expect(sql).toContain("v_expected_workspace_lab_link_attempt_count<>80");
  expect(sql).toContain("v_expected_direct_profile_count+v_expected_panel_item_count<>v_expected_workspace_lab_link_attempt_count");
  expect(sql).toContain("clinical_master_phase_c_lab_profile_shape_invalid:profiles=% directProfiles=% panelProfiles=% panelItems=%");
  expect(sql).toContain("clinical_master_phase_c_lab_link_attempt_contract_invalid:release=% directProfiles=% panelProfiles=% panelItems=% expandedLinkAttempts=% formulaDirectPlusPanelItems=% profileDiagnostic=%");
  expect(sql).toContain("'stageItemTotal'");
  expect(sql).toContain("'pinnedItemTotal'");
  expect(sql).toContain("'payloadExpandedTotal'");
  expect(sql).toContain("'stageExpandedTotal'");
  expect(sql).toContain("'pinnedExpandedTotal'");
  expect(sql).toContain("'orderMasterKey',order_master_key");
  expect(sql).toContain("'payloadTargetKind',payload_target_kind");
  expect(sql).toContain("'payloadTargetKey',payload_target_key");
  expect(sql).toContain("'payloadTargetMasterId',payload_target_id");
  expect(sql).toContain("'payloadTargetRevision',payload_target_revision");
  expect(sql).toContain("'pinnedTargetKind',pinned_target_kind");
  expect(sql).toContain("'pinnedTargetKey',pinned_target_key");
  expect(sql).toContain("'pinnedTargetMasterId',pinned_target_id");
  expect(sql).toContain("'pinnedTargetRevision',pinned_target_revision");
  expect(sql).toContain("'pinnedExpandedCount',pinned_expanded_count");
  expect(sql).toContain("'targetStageEffectiveRevision',target_stage_effective_revision");
  expect(sql).toContain("profile_rows.stage_profile_values->0 stage_profile");
  expect(sql).not.toContain("stage_profiles.stage_profile_values->0 stage_profile");
  expect(sql).not.toContain("clinical_master_phase_c_lab_link_attempt_contract_invalid:workspace=");
  expect(sql).not.toContain("from jsonb_array_elements(v_payload->'records') records(record_row)");
  expect(sql).toContain("from jsonb_array_elements(v_payload->'records') record_row(value)");
  expect(sql).toContain("'mismatches'");
  expect(sql).toContain("'profiles'");
  expect(sql).toContain("nullif(payload_profile->>'labPanelMasterKey','')");
  expect(sql).toContain("clinical_master_phase_c_lab_link_projection_count_invalid:workspace=% actual=% expected=% directProfiles=% panelProfiles=% panelItems=% expandedLinkAttempts=% formulaDirectPlusPanelItems=%");
  expect(sql).toContain("v_price jsonb;");
  expect(sql).toContain("v_price->>'syntheticWorkspacePriceKrw'");
  expect(sql).not.toContain("v_price->>\'syntheticWorkspacePriceKrw\'\n");
  expect(sql).toContain("v_release_no<=v_before_max_release_no");
  expect(sql).toContain("v_before_release_sequence_last_value");
  expect(sql).toContain("v_before_release_sequence_is_called");
  expect(sql).toContain("v_before_release_sequence_next_no");
  expect(sql).toContain("master.master_releases_release_no_seq");
  expect(sql).toContain("clinical_master_phase_c_release_sequence_baseline_mismatch");
  expect(sql).toContain("v_release_no<>v_before_release_sequence_next_no");
  expect(sql).toContain("existing_release.release_no=v_release_no");
  expect(sql).toContain("v_baseline_mode='local' and v_release_no<=v_before_max_release_no");
  expect(sql).toContain("v_catalog_fingerprint<>v_expected_foreign_fingerprint");
});

test("rendered rehearsal is pure SQL, fixture-generated, and hard-pins all safety constants", () => {
  const sql = readFileSync(renderedSqlPath, "utf8");

  expect(sql.startsWith("-- GENERATED by scripts/generate-clinical-master-operational-v3-phase-c.ts;")).toBe(true);
  expect(sql).toContain("Management-API-compatible pure SQL");
  expect(sql).not.toMatch(/^\\(?:set|if|else|endif|echo|quit)\b/m);
  expect(sql).not.toMatch(/^\s*:\w+/m);
  expect(sql).not.toContain("payload_file");
  expect(sql).not.toContain("pricing_file");
  expect(sql).toContain("0225bc6714210cfe663bded97fe6b3cbf76fedf99dce1540a302c0fd46235893");
  expect(sql).toContain("database-canonicalizer PostgreSQL jsonb hash");
  expect(sql).toContain("35fa6f6ec16f23c43a774b0f8abe03fa43fa8bfd6962278e0a76469580e05abf");
  expect(sql).toContain("8bbbcdbcfab3bf15aa69bcee87be4caab7aefaf9c3a73998640a8332dbb0b6b1");
  expect(sql).toContain("eac749d40ab0f0e88f9dabed2a5123b85933367d3fae4a3828ad37893e1a45c4");
  expect(sql).toContain("5fe7ba9e93a045076157a77e5c852a5712660f99a0d2afbb3064a143c7586de0");
  expect(sql).toContain("82b9b2a3e9722093a65709a5a9dbdff19f709a8c00616a8203ec0b55f7d1d3c4");
  expect(sql).toContain("c195d802a07ef3f820aed21809bc7d7bf84fa5013ed4e98e4951e64f5242bcf1");
  expect(sql).toContain("4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945");
  expect(sql).toContain("clinical_master_phase_c_pre_v3_history_changed");
  expect(sql).toContain("clinical_master_phase_c_foreign_surface_drift:notification_events");
  expect(sql).toContain("clinical_master_phase_c_cheongdam_expected_custom_postcheck_failed");
  expect(sql).toContain("clinical_master_phase_c_actor_service_catalog_manage_missing");
  expect(sql).toContain("clair_resolve_workspace_lab_definition_update");
  expect(sql).toContain("'releaseMatch',diagnostic.release_match");
  expect(sql).toContain("'sourceFingerprintMatch',diagnostic.source_fingerprint_match");
  expect(sql).toContain("'heldPublishedVersionExists',diagnostic.held_published_version_exists");
  const invalidDiagnosticLine = sql.split("\n").find((line) => line.includes("clinical_master_phase_c_order_review_target_invalid"));
  expect(invalidDiagnosticLine).toBeDefined();
  expect(invalidDiagnosticLine).toContain("diagnostic.held_published_version_exists))::text;");
  expect(invalidDiagnosticLine).not.toContain("diagnostic.held_published_version_exists)))::text;");
  assertBalancedSqlParentheses(invalidDiagnosticLine ?? "", "rendered order review invalid diagnostic");
  expect(sql).toContain("set local role authenticated");
  expect(sql).toContain("rollback;");
});

test("remote rendered rehearsal is explicitly full/remote and remains rollback-only", () => {
  const sql = readFileSync(remoteRenderedSqlPath, "utf8");
  const rollback = record(manifest.rollbackRehearsal, "manifest.rollbackRehearsal");

  expect(rollback.remoteRenderedSql).toBe("supabase/snippets/clinical_master_operational_v3_phase_c_rollback_remote_rendered.sql");
  expect(record(rollback.remoteRenderedSqlMode, "remote rendered mode")).toMatchObject({ rehearsalScope: "full", baselineMode: "remote" });
  expect(sql.startsWith("-- GENERATED by scripts/generate-clinical-master-operational-v3-phase-c.ts;")).toBe(true);
  expect(sql).toMatch(/values \([\s\S]*, 'full', 'remote', '85cb291602f3d177ae11a075b4203bdf9e7cb9a3ac68c5a8245a5a90f739b7c7'/);
  expect(sql).toContain("membership.archived_at is null");
  expect(sql).not.toContain("membership.deleted_at");
  expect(sql).toContain("pg_get_serial_sequence('master.master_releases','release_no')");
  expect(sql).toContain("v_release_sequence::text<>'master.master_releases_release_no_seq'");
  expect(sql).toContain("v_before_release_sequence_last_value<>8");
  expect(sql).toContain("v_before_release_sequence_is_called is distinct from true");
  expect(sql).toContain("when query_canceled then");
  expect(sql).toContain("when others then");
  expect(sql).toContain("clinical_master_phase_c_release_sequence_restore_failed");
  expect(sql).toContain("0225bc6714210cfe663bded97fe6b3cbf76fedf99dce1540a302c0fd46235893");
  expect(sql).toContain("'releaseMatch',diagnostic.release_match");
  expect(sql).toContain("'sourceFingerprintMatch',diagnostic.source_fingerprint_match");
  expect(sql).toContain("'heldPublishedVersionExists',diagnostic.held_published_version_exists");
  const invalidDiagnosticLine = sql.split("\n").find((line) => line.includes("clinical_master_phase_c_order_review_target_invalid"));
  expect(invalidDiagnosticLine).toBeDefined();
  expect(invalidDiagnosticLine).toContain("diagnostic.held_published_version_exists))::text;");
  expect(invalidDiagnosticLine).not.toContain("diagnostic.held_published_version_exists)))::text;");
  assertBalancedSqlParentheses(invalidDiagnosticLine ?? "", "remote order review invalid diagnostic");
  expect(sql).not.toMatch(/^\\(?:set|if|else|endif|echo|quit)\b/m);
  expect(sql).not.toMatch(/^\s*:\w+/m);
  expect(sql).not.toContain("commit;");
  expect(sql).toContain("rollback;");
  expect(sql).not.toContain("payload_file");
  expect(sql).not.toContain("pricing_file");
});

test("persistent candidate is one atomic commit and never rewinds the release sequence", () => {
  const sql = readFileSync(persistentCommitSqlPath, "utf8");
  const candidate = record(manifest.persistentCommitCandidate, "manifest.persistentCommitCandidate");
  expect(candidate.sha256).toBe(sha256(persistentCommitSqlPath));
  expect(candidate.transactionBoundary).toContain("one top-level atomic transaction");
  expect(candidate.workspaceOrder).toEqual([
    "workspace-clinical-master-pilot-v1",
    "workspace-clair-cheongdam",
    "clair-demo",
  ]);
  expect(candidate.retryPolicy).toContain("after failure rerun read-only preflight and regenerate");
  expect(sql).toContain("One top-level atomic transaction contains three ordered workspace logical stop-on-error blocks");
  expect(sql).toContain("begin;");
  expect(sql).toContain("commit;");
  expect(sql).toContain("clinical_master_operational_v3_phase_c_commit_candidate_ok");
  expect(sql).not.toMatch(/^rollback;$/m);
  expect(sql).not.toContain("perform setval(v_release_sequence");
  expect(sql).not.toMatch(/^\\(?:set|if|else|endif|echo|quit)\b/m);
  expect(sql).not.toMatch(/^\s*:\w+/m);
  expect(sql).toContain("v_result := private.publish_clinical_master_release(v_payload,null)");
  expect(sql).toContain("v_retry := private.publish_clinical_master_release(v_payload,null)");
  expect(sql).toContain("foreach v_workspace in array array['workspace-clinical-master-pilot-v1','workspace-clair-cheongdam','clair-demo']");
  expect(sql).toContain("clinical_master_phase_c_foreign_post_adoption_drift");
});

test("PR-014 identifies the exact generated Phase C approval candidate", () => {
  const pr014 = readFileSync(pr014Path, "utf8");
  const trackedArtifacts = [
    "scripts/generate-clinical-master-operational-v3-phase-c.ts",
    "tests/clinical-master-operational-v3-phase-c.spec.ts",
    "tests/fixtures/clinical-master-operational-v3-phase-c-operation-manifest.json",
    "supabase/snippets/clinical_master_operational_v3_phase_c_preflight.sql",
    "supabase/snippets/clinical_master_operational_v3_phase_c_rollback.sql",
    "supabase/snippets/clinical_master_operational_v3_phase_c_rollback_rendered.sql",
    "supabase/snippets/clinical_master_operational_v3_phase_c_rollback_remote_rendered.sql",
    "supabase/snippets/clinical_master_operational_v3_phase_c_commit_candidate.sql",
    "supabase/migrations/20260824091724_clinical_master_release_scoped_workspace_adoption.sql",
    "tests/clinical-master-release-scoped-workspace-adoption.spec.ts",
    "supabase/snippets/clinical_master_release_scoped_workspace_adoption_replay.sql",
  ];

  for (const artifact of trackedArtifacts) {
    expect(pr014, `${artifact} SHA must be recorded in PR-014`).toContain(sha256(resolve(process.cwd(), artifact)));
  }
});

test("Phase C preflight query computes the exact five fingerprints read-only", () => {
  const preflightSql = readFileSync(preflightSqlPath, "utf8");

  expect(preflightSql).toContain("latestSourceFingerprint");
  expect(preflightSql).toContain("release_no_sequence_baseline");
  expect(preflightSql).toContain("master.master_releases_release_no_seq");
  expect(preflightSql).toContain("last_value");
  expect(preflightSql).toContain("is_called");
  expect(preflightSql).toContain("lab_publish_stage_fingerprint");
  expect(preflightSql).toContain("workspace-clinical-master-pilot-v1");
  expect(preflightSql).toContain("workspace-clair-cheongdam");
  expect(preflightSql).toContain("clair-demo");
  expect(preflightSql).toContain("clair-foreign-demo");
  expect(preflightSql).toContain("jsonb_agg(to_jsonb(item) order by item.id)");
  expect(preflightSql).toContain("extensions.digest");
  expect(preflightSql.replace(/--.*$/gmu, "")).not.toMatch(/\b(?:insert|update|delete|truncate|create|alter|drop)\b/iu);
});
