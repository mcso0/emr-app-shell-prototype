import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

import fixtureJson from "./fixtures/clinical-master-phase1a1.fixture.json";
import {
  ClinicalMasterValidationError,
  normalizeClinicalMasterPublishPayload,
  publishClinicalMasterRelease,
  serializeClinicalMasterPayloadForTest,
  validateClinicalMasterPublishPayload,
  type ClinicalMasterPublishPayload,
  type ClinicalMasterPublisherExecutor,
} from "../src/features/clinical-master/server-clinical-master-publisher-core";

const migration = readFileSync(
  "supabase/migrations/20260818120000_clinical_master_phase_1a1_private_foundation.sql",
  "utf8"
);
const publisherSource = readFileSync(
  "src/features/clinical-master/server-clinical-master-publisher-core.ts",
  "utf8"
);
const replay = readFileSync("supabase/snippets/clinical_master_phase1a1_replay.sql", "utf8");
const config = readFileSync("supabase/config.toml", "utf8");
const fixture = fixtureJson as unknown as ClinicalMasterPublishPayload;

function cloneFixture(): ClinicalMasterPublishPayload {
  return JSON.parse(JSON.stringify(fixture)) as ClinicalMasterPublishPayload;
}

test("Phase 1A-1 migration contains only the private master foundation", () => {
  for (const table of [
    "master_releases",
    "master_records",
    "master_record_names",
    "master_sources",
    "master_record_sources",
    "master_record_versions",
    "master_review_events",
    "order_categories",
    "clinical_actions",
    "chart_groups",
    "task_routes",
    "classification_paths",
    "species",
    "units",
    "specimen_types",
    "result_input_types",
    "orders",
    "order_species_links",
  ]) {
    expect(migration).toContain(`create table if not exists master.${table}`);
    expect(migration).toContain(`alter table master.${table} enable row level security`);
  }

  expect(migration).toContain("release_no bigint generated always as identity");
  expect(migration).toContain("release_key text unique");
  expect(migration).toContain("record_count integer not null check (record_count > 0)");
  expect(migration).toContain("source_fingerprint text not null unique");
  expect(migration).toContain("current_revision integer not null check (current_revision > 0)");
  expect(migration).toContain("master_records_current_version_fk");
  expect(migration).toContain("deferrable initially deferred");
  expect(migration).toContain("master_record_names_preferred_ko_key");
  expect(migration).toContain("master_record_names_preferred_en_key");
  expect(migration).toContain("master_record_names_normalized_unique_key");
  expect(migration).toContain("master_classification_paths_active_action_key");
  expect(migration).toContain("unique (clinical_action_id, chart_group_id, task_route_id)");
  expect(migration).toContain("'CG_MEDICATION_SUPPLY'");
  expect(migration).toContain("'NT_CHART_ONLY'");
  expect(migration).toContain("clinical_master_path_retirement_release_order_invalid");
  expect(migration).toContain("clinical_master_has_forbidden_key");
  expect(migration).toContain("clinical_master_assert_contract_keys");
  expect(migration).toContain("clinical_master_canonicalize_detail");
  expect(migration).toContain("regexp_replace(pg_catalog.lower(item.key), '[^a-z0-9_]', '', 'g')");
  expect(migration).toContain("before update or delete on master.order_categories");
  expect(migration).toContain("before update or delete on master.orders");
  expect(migration).toContain("before insert or update on master.classification_paths");
  expect(migration).toContain("extensions.digest");
  expect(migration).toContain("pg_catalog.convert_to(v_payload::text, 'UTF8')");
  expect(migration).toContain("pg_catalog.pg_advisory_xact_lock");
  expect(migration).not.toMatch(/^\s*(price|price_krw|priceKrw|canonical_price)\s+\w+/im);
  expect(migration).not.toMatch(/public\.(order_catalog_items|order_sets|orders|order_revisions)/);
  expect(migration).not.toContain("fixture.");
});

test("private master is denied to Data API/client roles", () => {
  expect(config).not.toMatch(/master/);
  expect(migration).toContain("revoke all on schema master from public, anon, authenticated, service_role");
  expect(migration).toContain("revoke all on all tables in schema master from public, anon, authenticated, service_role");
  expect(migration).toContain("revoke all on all sequences in schema master from public, anon, authenticated, service_role");
  expect(migration).toContain("revoke all on all functions in schema master from public, anon, authenticated, service_role");
  expect(migration).toContain("revoke all on function private.publish_clinical_master_release(jsonb, uuid)");
  expect(migration).toContain("set search_path = ''");
  expect(migration).not.toContain("grant execute");
  expect(publisherSource).toContain("PostgreSQL remains the sole release fingerprint authority");
  expect(publisherSource).not.toMatch(/createHash|sha256|sourceFingerprint.*hash/i);
});

test("synthetic fixture structurally covers X/T/A, Other, CG/NT, dog/cat, and atomic order", () => {
  expect(validateClinicalMasterPublishPayload(fixture)).toEqual([]);
  expect(fixture.records).toHaveLength(25);
  expect(fixture.records.filter((record) => record.recordType === "order_category")).toHaveLength(2);
  expect(fixture.records.filter((record) => record.recordType === "clinical_action")).toHaveLength(2);
  expect(fixture.records.filter((record) => record.recordType === "chart_group")).toHaveLength(8);
  expect(fixture.records.filter((record) => record.recordType === "task_route")).toHaveLength(7);
  expect(fixture.records.filter((record) => record.recordType === "species").map((record) => record.detail.speciesCode)).toEqual([
    "dog",
    "cat",
  ]);
  expect(fixture.records.filter((record) => record.detail.isOtherUnclassified === true)).toHaveLength(1);
  expect(fixture.classificationPaths).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ clinicalActionKey: "fixture.action.consultation.other" }),
    ])
  );
  expect(fixture.records.find((record) => record.detail.routeCode === "NT_INPATIENT")?.detail).toMatchObject({
    destinationModule: "inpatient",
    taskRequired: true,
    runtimeStatus: "held",
  });
  expect(fixture.records.find((record) => record.recordType === "order")?.detail).toMatchObject({
    defaultSalesUnitCode: "EA",
    species: ["dog", "cat"],
  });
});

test("publisher transports Plan/Order authority but never fills missing values", () => {
  const configured = cloneFixture();
  const order = configured.records.find((record) => record.recordType === "order");
  if (!order) throw new Error("fixture order missing");
  order.detail.planOrderAuthority = {
    schemaVersion: 1,
    calculationMode: "fixed_product",
    dispenseUnit: "vial",
    fixedProductQuantity: 1,
    fixedProductQuantityBasis: "head",
    priceBasis: "per_order",
    billingUnit: "case",
    taxClass: "non_taxable",
  };
  expect(validateClinicalMasterPublishPayload(configured)).toEqual([]);
  expect(
    normalizeClinicalMasterPublishPayload(configured).records.find(
      (record) => record.recordType === "order",
    )?.detail.planOrderAuthority,
  ).toEqual(order.detail.planOrderAuthority);

  const missing = normalizeClinicalMasterPublishPayload(fixture);
  expect(
    missing.records.find((record) => record.recordType === "order")?.detail,
  ).not.toHaveProperty("planOrderAuthority");
});

test("normalization is deterministic while PostgreSQL remains fingerprint authority", () => {
  const reordered = cloneFixture();
  reordered.records.reverse();
  reordered.records.forEach((record) => {
    record.names.reverse();
    if (Array.isArray(record.detail.species)) record.detail.species.reverse();
  });
  reordered.classificationPaths?.reverse();
  expect(serializeClinicalMasterPayloadForTest(reordered)).toBe(serializeClinicalMasterPayloadForTest(fixture));

  const composed = cloneFixture();
  const decomposed = cloneFixture();
  const composedName = "가";
  const decomposedName = "가";
  composed.records[0].names[0].name = composedName;
  decomposed.records[0].names[0].name = decomposedName;
  expect(serializeClinicalMasterPayloadForTest(composed)).not.toBe(
    serializeClinicalMasterPayloadForTest(decomposed)
  );

  const callerPayload = { ...fixture, sourceFingerprint: "a".repeat(64) } as ClinicalMasterPublishPayload & {
    sourceFingerprint: string;
  };
  expect(
    (normalizeClinicalMasterPublishPayload(callerPayload) as ClinicalMasterPublishPayload & {
      sourceFingerprint?: string;
    }).sourceFingerprint
  ).toBeUndefined();
  expect(publisherSource).not.toContain("computeClinicalMasterSourceFingerprint");
});

test("TypeScript validation rejects nested prices, unknown fields, tuple conflicts, and name collisions", () => {
  const invalid = cloneFixture();
  const order = invalid.records.find((record) => record.recordType === "order");
  if (!order) throw new Error("fixture order missing");
  order.detail.unsupportedMetadata = { nested: { price: 100 } };
  order.detail.species = ["horse"];
  const route = invalid.records.find((record) => record.detail.routeCode === "NT_LAB");
  if (!route) throw new Error("fixture route missing");
  route.detail.destinationModule = "imaging";
  const issues = validateClinicalMasterPublishPayload(invalid);
  expect(issues.map((issue) => issue.code)).toEqual(
    expect.arrayContaining(["canonical_price_forbidden", "detail_field_unknown", "species_scope_invalid", "route_tuple_mismatch"])
  );

  const duplicateName = cloneFixture();
  duplicateName.records[0].names.push(
    {
      languageCode: "ko",
      nameKind: "alias",
      name: "진료 별칭",
    },
    {
    languageCode: "ko",
    nameKind: "alias",
      name: " 진료 별칭 ",
    }
  );
  expect(validateClinicalMasterPublishPayload(duplicateName).map((issue) => issue.code)).toContain(
    "normalized_name_duplicate"
  );
});

test("runtime contract validation rejects unknown fields at every layer and malformed typed details structurally", () => {
  const layerCases: Array<{ mutate: (payload: ClinicalMasterPublishPayload) => void; code: string }> = [
    { mutate: (payload) => ((payload as unknown as Record<string, unknown>).unknownPayloadField = true), code: "payload_field_unknown" },
    { mutate: (payload) => ((payload.records[0] as unknown as Record<string, unknown>).unknownRecordField = true), code: "record_field_unknown" },
    { mutate: (payload) => ((payload.records[0].names[0] as unknown as Record<string, unknown>).unknownNameField = true), code: "name_field_unknown" },
    { mutate: (payload) => ((payload.records[0].source as unknown as Record<string, unknown>).unknownSourceField = true), code: "source_field_unknown" },
    { mutate: (payload) => (((payload.classificationPaths ?? [])[0] as unknown as Record<string, unknown>).unknownPathField = true), code: "path_field_unknown" },
    { mutate: (payload) => ((payload.records[0].detail as unknown as Record<string, unknown>).unknownDetailField = true), code: "detail_field_unknown" },
  ];

  for (const { mutate, code } of layerCases) {
    const invalid = cloneFixture();
    mutate(invalid);
    expect(validateClinicalMasterPublishPayload(invalid).map((issue) => issue.code)).toContain(code);
  }

  for (const malformedDetail of [null, [], "scalar"] as const) {
    const invalid = cloneFixture();
    (invalid.records[0] as unknown as Record<string, unknown>).detail = malformedDetail;
    expect(validateClinicalMasterPublishPayload(invalid).some((issue) => issue.code === "detail_object_required")).toBe(true);
  }

  const missingDetail = cloneFixture();
  delete (missingDetail.records[0] as unknown as Record<string, unknown>).detail;
  expect(validateClinicalMasterPublishPayload(missingDetail).some((issue) => issue.code === "detail_object_required")).toBe(true);
});

test("runtime validation preserves scalar types and rejects raw-record nested prices before executor dispatch", async () => {
  const scalarCases: Array<{ label: string; mutate: (payload: ClinicalMasterPublishPayload) => void; issueCode: string }> = [
    {
      label: "publishedByLabel object",
      mutate: (payload) => ((payload as unknown as Record<string, unknown>).publishedByLabel = {}),
      issueCode: "required_string",
    },
    {
      label: "publishedByLabel array",
      mutate: (payload) => ((payload as unknown as Record<string, unknown>).publishedByLabel = []),
      issueCode: "required_string",
    },
    {
      label: "masterKey object",
      mutate: (payload) => (((payload.records[0] as unknown) as Record<string, unknown>).masterKey = {}),
      issueCode: "required_string",
    },
    {
      label: "masterKey array",
      mutate: (payload) => (((payload.records[0] as unknown) as Record<string, unknown>).masterKey = []),
      issueCode: "required_string",
    },
    {
      label: "name object",
      mutate: (payload) => (((payload.records[0].names[0] as unknown) as Record<string, unknown>).name = {}),
      issueCode: "required_string",
    },
    {
      label: "name array",
      mutate: (payload) => (((payload.records[0].names[0] as unknown) as Record<string, unknown>).name = []),
      issueCode: "required_string",
    },
    {
      label: "source title object",
      mutate: (payload) => (((payload.records[0].source as unknown) as Record<string, unknown>).title = {}),
      issueCode: "required_string",
    },
    {
      label: "source title array",
      mutate: (payload) => (((payload.records[0].source as unknown) as Record<string, unknown>).title = []),
      issueCode: "required_string",
    },
    {
      label: "path key object",
      mutate: (payload) => {
        ((payload.classificationPaths ?? [])[0] as unknown as Record<string, unknown>).pathKey = {};
      },
      issueCode: "required_string",
    },
    {
      label: "path key array",
      mutate: (payload) => {
        ((payload.classificationPaths ?? [])[0] as unknown as Record<string, unknown>).pathKey = [];
      },
      issueCode: "required_string",
    },
    {
      label: "release notes object",
      mutate: (payload) => ((payload as unknown as Record<string, unknown>).releaseNotes = {}),
      issueCode: "string_type_invalid",
    },
    {
      label: "release notes array",
      mutate: (payload) => ((payload as unknown as Record<string, unknown>).releaseNotes = []),
      issueCode: "string_type_invalid",
    },
  ];

  let executorCalls = 0;
  const executor: ClinicalMasterPublisherExecutor = {
    async publish() {
      executorCalls += 1;
      return {
        releaseId: "00000000-0000-4000-8000-000000000001",
        releaseNo: 1,
        sourceFingerprint: "0".repeat(64),
        idempotent: false,
        recordCount: 25,
      };
    },
  };

  for (const scalarCase of scalarCases) {
    const invalid = cloneFixture();
    scalarCase.mutate(invalid);
    expect(validateClinicalMasterPublishPayload(invalid).map((issue) => issue.code), scalarCase.label).toContain(scalarCase.issueCode);
    await expect(publishClinicalMasterRelease({ payload: invalid, executor })).rejects.toBeInstanceOf(ClinicalMasterValidationError);
  }

  for (const priceKey of ["price", "priceKrw", "PRICE_KRW", "canonicalPrice"]) {
    const invalid = cloneFixture();
    const source = invalid.records[0].source as unknown as Record<string, unknown>;
    source.licenseNotes = { nested: { [priceKey]: 100 } };
    const issues = validateClinicalMasterPublishPayload(invalid);
    expect(issues.map((issue) => issue.code), priceKey).toContain("canonical_price_forbidden");
    await expect(publishClinicalMasterRelease({ payload: invalid, executor })).rejects.toBeInstanceOf(ClinicalMasterValidationError);
  }

  expect(executorCalls).toBe(0);
});

test("typed defaults and exact NT tuples normalize to one deterministic client payload", () => {
  const explicitDefaults = cloneFixture();
  explicitDefaults.records.forEach((record) => {
    if (record.recordType === "order_category" || record.recordType === "chart_group") record.detail.sortOrder = 0;
  });
  const omitted = cloneFixture();
  omitted.records.forEach((record) => {
    if (record.recordType === "order_category" || record.recordType === "chart_group") {
      record.detail.sortOrder = 0;
      delete record.detail.sortOrder;
    }
    if (record.recordType === "clinical_action" && record.detail.isOtherUnclassified === false) delete record.detail.isOtherUnclassified;
    if (record.recordType === "task_route") {
      delete record.detail.destinationModule;
      delete record.detail.taskRequired;
      delete record.detail.runtimeStatus;
    }
    if (record.recordType === "unit") delete record.detail.decimalScale;
    if (record.recordType === "order") {
      delete record.detail.defaultBillingReflectionEnabled;
      delete record.detail.defaultQuantity;
    }
  });
  expect(serializeClinicalMasterPayloadForTest(omitted)).toBe(serializeClinicalMasterPayloadForTest(explicitDefaults));
  expect(normalizeClinicalMasterPublishPayload(omitted).records.find((record) => record.detail.routeCode === "NT_INPATIENT")?.detail).toMatchObject({
    destinationModule: "inpatient",
    taskRequired: true,
    runtimeStatus: "held",
  });
});

test("publisher delegates only validated normalized data to the server executor", async () => {
  let received: ClinicalMasterPublishPayload | undefined;
  const executor: ClinicalMasterPublisherExecutor = {
    async publish(payload) {
      received = payload;
      return {
        releaseId: "00000000-0000-4000-8000-000000000001",
        releaseNo: 1,
        sourceFingerprint: "0".repeat(64),
        idempotent: false,
        recordCount: payload.records.length,
      };
    },
  };
  const result = await publishClinicalMasterRelease({ payload: fixture, executor });
  expect(result.recordCount).toBe(25);
  expect(received?.records[0]?.masterKey).toBe("fixture.action.consultation");
  expect(received?.records.some((record) => "sourceFingerprint" in record)).toBe(false);

  const invalid = cloneFixture();
  invalid.records[0].detail.unapprovedClaim = "clinical guidance";
  await expect(publishClinicalMasterRelease({ payload: invalid, executor })).rejects.toBeInstanceOf(
    ClinicalMasterValidationError
  );
});

test("SQL replay documents database-backed golden vectors and local concurrency instructions", () => {
  expect(replay).toContain("private.publish_clinical_master_release(v_payload, null)");
  expect(replay).toContain("same-payload retry did not return the same release");
  expect(replay).toContain("metadata-only release changed record history");
  expect(replay).toContain("changed record did not advance exactly one revision");
  expect(replay).toContain("nested canonical price vector");
  expect(replay).toContain("unknown clinical field was accepted or misclassified");
  expect(replay).toContain("route tuple mismatch was accepted or misclassified");
  expect(replay).toContain("typed-code conflict left release/history residue");
  expect(replay).toContain("classification path retirement did not preserve history");
  expect(replay).toContain("typed DELETE guard failed");
  expect(replay).toContain("typed master_record_id re-key guard failed");
  expect(replay).toContain("invalid path retirement order was not rejected exactly");
  expect(replay).toContain("omitted and explicit typed defaults did not converge");
  expect(replay).toContain("normalized-name duplicate was accepted");
  expect(replay).toContain("clinical_master_action_code_immutable");
  expect(replay).toContain("v_action_code_before is distinct from v_action_code_after");
  expect(replay).toContain("v_action_revision_before is distinct from v_action_revision_after");
  expect(replay).toContain("anon private-master boundary failed");
  expect(replay).toContain("authenticated private-master boundary failed");
  expect(replay).toContain("service_role private-master boundary failed");
  expect(replay).toContain("clinical_master_phase1a1_replay_cleanup_ok");
  expect(replay).toContain("two-session advisory-lock run");
  expect(replay.match(/\brollback\b/gi)?.length).toBeGreaterThanOrEqual(1);
});
