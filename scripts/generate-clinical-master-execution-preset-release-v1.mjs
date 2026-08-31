#!/usr/bin/env node

/**
 * Compile the local-only PR-022 execution-preset publisher payload.
 *
 * The output is the existing private.publish_clinical_master_release(jsonb,
 * uuid) payload shape. It deliberately contains no generated master UUID,
 * master revision, or release UUID. Existing order records are copied from
 * frozen publisher inputs and only detail.executionPreset is added.
 */

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "..");

const PATHS = Object.freeze({
  v4Payload:
    "tests/fixtures/clinical-master-operational-v4-adapter-output.json",
  dispensingPayload:
    "docs/work/clinical-master/clinical-master-pr-017/supabase/dispensing-order-release-payload.v1.json",
  dispensingPresets:
    "docs/work/clinical-master/clinical-master-pr-019/dispensing-master-presets.v1.json",
  presetArtifact:
    "tests/fixtures/clinical-master-order-execution-presets-v1.json",
  supplementIdentity:
    "tests/fixtures/clinical-master-order-execution-presets-frozen-supplement.v1.json",
  frozenOrders:
    "tests/fixtures/clinical-master-execution-preset-release-frozen-orders.v1.json",
  liveLineage:
    "tests/fixtures/clinical-master-order-execution-presets-live-lineage.v1.json",
  systemExam:
    "tests/fixtures/clinical-master-system-exam-authoring-v1.json",
  output:
    "tests/fixtures/clinical-master-execution-preset-release-v1.json",
});

const RELEASE_KEY = "cm.release.execution-presets.v1.2026-08-31.1";
const PUBLISHED_BY_LABEL = "CLAiR synthetic execution preset compiler";
const EXPECTED_ORDER_COUNT = 522;
const EXPECTED_BASE_PRESET_COUNT = 510;
const EXPECTED_DISPENSING_PRESET_COUNT = 108;
const EXPECTED_SYSTEM_EXAM_COUNT = 12;
const DISPENSING_RELEASE_KEY = "cm.release.dispensing.v1.2026-08-26.1";
const DISPENSING_CURRENT_PRESET_ENTRIES_SHA256 =
  "f522d39ed024849549987be5768b3be7b89f0e308d4658593e2cc266cffc90ae";
const BASE_PRESET_ARTIFACT_SHA256 =
  "02c4ad67463545fa502e263fd7681b203b3e866702d23cbf364edbfe6276f6c0";
const BASE_PRESET_SOURCE_ENTRIES_SHA256 =
  "a3ea174d81325d993aa9cc233d714c4a3eee990392dd7e931f0433bb86c24a25";
const BASE_PRESET_STABLE_KEY_SET_SHA256 =
  "2197c142243464c7d14ffc1ae921106ed609084fb960fd4eba2c309f6fe80164";
const BASE_PRESET_LIVE_IDENTITY_REVISION_SHA256 =
  "b4d56f15dfcf53e867db2e022f6e7c742c2354b507eb4a88feb981b351b039bb";
const BASE_PRESET_INPUT_LINEAGE_SHA256 =
  "e8c5b28660efd3c6c0091a105fcd5e6234010a851f07cc4e16f1da91582b3198";
const SYSTEM_EXAM_ARTIFACT_SHA256 =
  "594241e8d753a9117f18ffc392930f51e01976f6ed19f9f36f341d8f456521c6";

const PAYLOAD_KEYS = Object.freeze([
  "releaseKey",
  "releaseNotes",
  "adoptionScope",
  "publishedByLabel",
  "records",
  "classificationPaths",
  "labPanelItems",
  "labOrderProfiles",
]);

export const EXECUTION_PRESET_ENVELOPE_KEYS = Object.freeze([
  "presetId",
  "presetKey",
  "presetRevision",
  "clinicalOrderType",
  "detailSchemaVersion",
  "defaultDetailInputs",
  "fieldPolicies",
  "provenance",
  "presetStatus",
  "clinicalUseAllowed",
  "contentSha256",
  "sourceArtifactSha256",
]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function canonicalize(value) {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalize(entry)).join(",")}]`;
  }
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function hashCanonical(value) {
  return createHash("sha256").update(canonicalize(value)).digest("hex");
}

function hashText(value) {
  return createHash("sha256").update(value).digest("hex");
}

function comparePostgresJsonbKeys(left, right) {
  const leftBytes = Buffer.from(left, "utf8");
  const rightBytes = Buffer.from(right, "utf8");
  return leftBytes.length - rightBytes.length || Buffer.compare(leftBytes, rightBytes);
}

function compareUtf8Bytewise(left, right) {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

/** Match PostgreSQL jsonb::text key order and spacing for publisher hashes. */
export function canonicalizePostgresJsonbText(value) {
  if (Array.isArray(value)) {
    return `[${value
      .map((entry) => canonicalizePostgresJsonbText(entry))
      .join(", ")}]`;
  }
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort(comparePostgresJsonbKeys)
      .map(
        (key) =>
          `${JSON.stringify(key)}: ${canonicalizePostgresJsonbText(value[key])}`,
      )
      .join(", ")}}`;
  }
  return JSON.stringify(value);
}

export function publisherContentHash(envelope) {
  const hashInput = Object.fromEntries(
    EXECUTION_PRESET_ENVELOPE_KEYS.filter(
      (key) => key !== "contentSha256",
    ).map((key) => [key, envelope[key]]),
  );
  return createHash("sha256")
    .update(canonicalizePostgresJsonbText(hashInput))
    .digest("hex");
}

function assertExactKeys(value, expectedKeys, code) {
  assert(isRecord(value), `${code}_object_required`);
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  assert(
    canonicalize(actual) === canonicalize(expected),
    `${code}_exact_keys:${actual.join(",")}`,
  );
}

function assertUniqueBy(values, readKey, code) {
  const seen = new Set();
  for (const value of values) {
    const key = readKey(value);
    assert(typeof key === "string" && key.length > 0, `${code}_key_missing`);
    assert(!seen.has(key), `${code}_duplicate:${key}`);
    seen.add(key);
  }
}

function sortByKey(values, readKey) {
  return [...values].sort((left, right) =>
    readKey(left).localeCompare(readKey(right)),
  );
}

function publisherPayload(value, key, code) {
  const payload = value?.[key];
  assert(isRecord(payload), `${code}_payload_missing`);
  return payload;
}

function orderRecords(payload) {
  return payload.records.filter((record) => record.recordType === "order");
}

function assertPublisherRecord(record, code) {
  assertExactKeys(
    record,
    [
      "masterKey",
      "recordType",
      "lifecycleStatus",
      "safetyStatus",
      "safetyReason",
      "names",
      "source",
      "detail",
    ],
    code,
  );
  assert(record.lifecycleStatus === "published", `${code}_lifecycle_invalid`);
  assert(record.safetyStatus === "normal", `${code}_safety_invalid`);
  assert(Array.isArray(record.names) && record.names.length > 0, `${code}_names_missing`);
  assert(isRecord(record.source), `${code}_source_missing`);
  assert(isRecord(record.detail), `${code}_detail_missing`);
}

function envelopeFromPreset(preset, code) {
  const sourceArtifactSha256 = preset.sourceArtifactSha256;
  const envelope = {
    presetId: preset.presetId,
    presetKey: preset.presetKey,
    presetRevision: preset.presetRevision,
    clinicalOrderType: preset.clinicalOrderType,
    detailSchemaVersion: preset.detailSchemaVersion,
    defaultDetailInputs: deepClone(preset.defaultDetailInputs),
    fieldPolicies: deepClone(preset.fieldPolicies),
    provenance: deepClone(preset.provenance),
    presetStatus: preset.presetStatus,
    clinicalUseAllowed: preset.clinicalUseAllowed,
    contentSha256: preset.contentSha256,
    sourceArtifactSha256,
  };
  validateExecutionPresetEnvelope(envelope, code);
  return envelope;
}

export function validateExecutionPresetEnvelope(envelope, code = "execution_preset") {
  assertExactKeys(envelope, EXECUTION_PRESET_ENVELOPE_KEYS, code);
  assert(
    typeof envelope.presetId === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(
        envelope.presetId,
      ),
    `${code}_preset_id_invalid`,
  );
  assert(
    typeof envelope.presetKey === "string" && envelope.presetKey.length > 0,
    `${code}_preset_key_invalid`,
  );
  assert(
    Number.isInteger(envelope.presetRevision) && envelope.presetRevision > 0,
    `${code}_preset_revision_invalid`,
  );
  assert(
    typeof envelope.clinicalOrderType === "string" &&
      envelope.clinicalOrderType.length > 0,
    `${code}_clinical_order_type_invalid`,
  );
  assert(
    Number.isInteger(envelope.detailSchemaVersion) &&
      envelope.detailSchemaVersion > 0,
    `${code}_detail_schema_version_invalid`,
  );
  for (const field of ["defaultDetailInputs", "fieldPolicies", "provenance"]) {
    assert(isRecord(envelope[field]), `${code}_${field}_object_required`);
  }
  assert(
    Object.keys(envelope.defaultDetailInputs).length > 0,
    `${code}_defaults_empty`,
  );
  assert(
    envelope.presetStatus === "synthetic_unreviewed",
    `${code}_status_invalid`,
  );
  assert(
    envelope.clinicalUseAllowed === false,
    `${code}_clinical_use_forbidden`,
  );
  for (const field of ["contentSha256", "sourceArtifactSha256"]) {
    assert(
      typeof envelope[field] === "string" &&
        /^[0-9a-f]{64}$/u.test(envelope[field]),
      `${code}_${field}_invalid`,
    );
  }
  assert(
    envelope.contentSha256 === publisherContentHash(envelope),
    `${code}_content_hash_mismatch`,
  );
  return true;
}

function attachExecutionPreset(record, preset) {
  assertPublisherRecord(record, `source_record:${record.masterKey}`);
  assert(
    !Object.hasOwn(record.detail, "executionPreset"),
    `source_execution_preset_already_present:${record.masterKey}`,
  );
  const result = deepClone(record);
  result.detail.executionPreset = envelopeFromPreset(
    preset,
    `execution_preset:${record.masterKey}`,
  );
  return result;
}

function validateFrozenOrders(frozen, identity) {
  assertExactKeys(
    frozen,
    [
      "schemaVersion",
      "capturedAt",
      "captureMode",
      "entries",
      "artifactSha256",
    ],
    "frozen_orders",
  );
  assert(
    frozen?.schemaVersion ===
      "clinical-master-execution-preset-release-frozen-orders/v1",
    "frozen_orders_schema_invalid",
  );
  assert(Array.isArray(frozen.entries), "frozen_orders_entries_missing");
  assert(frozen.entries.length === 2, `frozen_orders_count:${frozen.entries.length}`);
  assertUniqueBy(frozen.entries, (entry) => entry.masterKey, "frozen_order");
  assert(Array.isArray(identity?.records), "supplement_identity_records_missing");
  assert(identity.records.length === 2, "supplement_identity_count_invalid");
  const identityByKey = new Map(
    identity.records.map((entry) => [entry.masterKey, entry]),
  );
  const expectedLiveLineage = new Map([
    [
      "cm.order.consult.initial",
      {
        releaseKey: "cm.release.airtable.operational-pilot.v2",
        snapshotSha256:
          "a8f028ea29c6c24982ed7ead0d7c6c9778c49861e77c46a774435b3fbdc880fd",
      },
    ],
    [
      "phase1.optionb.v1.order.metabolic",
      {
        releaseKey: "phase1-optionb-lab-v1",
        snapshotSha256:
          "50cec96dae46164bc6d9d09aaef8d20661c23fab3cc5162491e3819c769cbb00",
      },
    ],
  ]);
  for (const entry of frozen.entries) {
    assertExactKeys(
      entry,
      [
        "masterKey",
        "masterRecordId",
        "currentRevision",
        "currentReleaseId",
        "releaseNo",
        "releaseKey",
        "snapshotSha256",
        "record",
        "labOrderProfile",
      ],
      `frozen_order:${entry.masterKey}`,
    );
    const expected = identityByKey.get(entry.masterKey);
    const expectedLineage = expectedLiveLineage.get(entry.masterKey);
    assert(expected, `frozen_order_unknown:${entry.masterKey}`);
    assert(expectedLineage, `frozen_order_lineage_unknown:${entry.masterKey}`);
    assert(
      entry.masterRecordId === expected.masterRecordId &&
        entry.currentRevision === expected.currentRevision &&
        entry.currentReleaseId === expected.currentReleaseId &&
        entry.releaseNo === expected.releaseNo,
      `frozen_order_lineage_mismatch:${entry.masterKey}`,
    );
    assert(
      entry.releaseKey === expectedLineage.releaseKey &&
        entry.snapshotSha256 === expectedLineage.snapshotSha256,
      `frozen_order_snapshot_lock_mismatch:${entry.masterKey}`,
    );
    assertPublisherRecord(entry.record, `frozen_order_record:${entry.masterKey}`);
    assert(
      entry.record.masterKey === entry.masterKey,
      `frozen_order_record_key_mismatch:${entry.masterKey}`,
    );
    assert(
      entry.record.names.some(
        (name) =>
          name.languageCode === "ko" &&
          name.nameKind === "preferred" &&
          name.name === expected.name,
      ),
      `frozen_order_name_mismatch:${entry.masterKey}`,
    );
    assert(
      entry.record.detail.classificationPathKey === expected.classificationPathKey,
      `frozen_order_path_mismatch:${entry.masterKey}`,
    );
    if (entry.masterKey === "phase1.optionb.v1.order.metabolic") {
      assert(isRecord(entry.labOrderProfile), "frozen_metabolic_profile_missing");
      assertExactKeys(
        entry.labOrderProfile,
        [
          "orderMasterKey",
          "labTestMasterKey",
          "labPanelMasterKey",
          "specimenMasterKey",
        ],
        "frozen_metabolic_profile",
      );
      assert(
        entry.labOrderProfile.orderMasterKey === entry.masterKey,
        "frozen_metabolic_profile_order_mismatch",
      );
      assert(
        entry.labOrderProfile.labTestMasterKey === null &&
          entry.labOrderProfile.labPanelMasterKey ===
            "phase1.optionb.v1.panel.metabolic" &&
          entry.labOrderProfile.specimenMasterKey ===
            "phase1.optionb.v1.specimen.serum",
        "frozen_metabolic_profile_drift",
      );
    } else {
      assert(
        entry.labOrderProfile === null,
        `frozen_order_unexpected_lab_profile:${entry.masterKey}`,
      );
    }
  }
  const withoutHash = { ...frozen };
  delete withoutHash.artifactSha256;
  assert(
    frozen.artifactSha256 === hashCanonical(withoutHash),
    "frozen_orders_artifact_hash_invalid",
  );
}

function withoutBaseEntryTransportHashes(entry) {
  const sourceEntry = { ...entry };
  delete sourceEntry.contentSha256;
  delete sourceEntry.sourceEntriesSha256;
  delete sourceEntry.sourceArtifactSha256;
  delete sourceEntry.displayName;
  return sourceEntry;
}

function validateLiveLineage(liveLineage) {
  assertExactKeys(
    liveLineage,
    [
      "schemaVersion",
      "capturedAt",
      "captureMode",
      "eligibility",
      "recordCount",
      "stableKeySetSha256",
      "lineageHashPolicy",
      "lineageSha256",
      "records",
    ],
    "live_lineage",
  );
  assert(
    liveLineage.schemaVersion ===
      "clinical-master-order-execution-presets-live-lineage/v1",
    "live_lineage_schema_invalid",
  );
  assert(liveLineage.capturedAt === "2026-08-31", "live_lineage_date_drift");
  assert(
    liveLineage.captureMode ===
      "read_only_live_current_published_normal_orders",
    "live_lineage_capture_mode_invalid",
  );
  assertExactKeys(
    liveLineage.eligibility,
    ["recordType", "lifecycleStatus", "safetyStatus"],
    "live_lineage_eligibility",
  );
  assert(
    canonicalize(liveLineage.eligibility) ===
      canonicalize({
        recordType: "order",
        lifecycleStatus: "published",
        safetyStatus: "normal",
      }),
    "live_lineage_eligibility_drift",
  );
  assert(
    liveLineage.recordCount === EXPECTED_BASE_PRESET_COUNT &&
      Array.isArray(liveLineage.records) &&
      liveLineage.records.length === EXPECTED_BASE_PRESET_COUNT,
    "live_lineage_record_count_invalid",
  );
  assertUniqueBy(liveLineage.records, (entry) => entry.masterKey, "live_lineage");
  assertExactKeys(
    liveLineage.lineageHashPolicy,
    [
      "fields",
      "rowFormat",
      "sort",
      "recordSeparator",
      "trailingNewline",
      "encoding",
      "algorithm",
    ],
    "live_lineage_hash_policy",
  );
  assert(
    canonicalize(liveLineage.lineageHashPolicy) ===
      canonicalize({
        fields: [
          "masterKey",
          "masterRecordId",
          "currentRevision",
          "currentReleaseId",
        ],
        rowFormat:
          "masterKey<TAB>masterRecordId<TAB>currentRevision<TAB>currentReleaseId",
        sort: "masterKey UTF-8 bytewise ascending",
        recordSeparator: "LF",
        trailingNewline: false,
        encoding: "UTF-8",
        algorithm: "SHA-256",
      }),
    "live_lineage_hash_policy_drift",
  );
  for (const entry of liveLineage.records) {
    assertExactKeys(
      entry,
      ["masterKey", "masterRecordId", "currentRevision", "currentReleaseId"],
      `live_lineage:${entry.masterKey}`,
    );
    assert(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(
        entry.masterRecordId,
      ) &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(
          entry.currentReleaseId,
        ) &&
        Number.isInteger(entry.currentRevision) &&
        entry.currentRevision > 0,
      `live_lineage_value_invalid:${entry.masterKey}`,
    );
  }
  const stableKeys = liveLineage.records
    .map((entry) => entry.masterKey)
    .sort(compareUtf8Bytewise);
  assert(
    liveLineage.stableKeySetSha256 === BASE_PRESET_STABLE_KEY_SET_SHA256,
    "live_lineage_stable_key_exact_lock_mismatch",
  );
  assert(
    hashText(stableKeys.join("\n")) === liveLineage.stableKeySetSha256,
    "live_lineage_stable_key_hash_invalid",
  );
  assert(
    liveLineage.lineageSha256 ===
      BASE_PRESET_LIVE_IDENTITY_REVISION_SHA256,
    "live_lineage_exact_lock_mismatch",
  );
  const lineagePreimage = [...liveLineage.records]
    .sort((left, right) => compareUtf8Bytewise(left.masterKey, right.masterKey))
    .map((entry) =>
      [
        entry.masterKey,
        entry.masterRecordId,
        entry.currentRevision,
        entry.currentReleaseId,
      ].join("\t"),
    )
    .join("\n");
  assert(
    hashText(lineagePreimage) === liveLineage.lineageSha256,
    "live_lineage_hash_invalid",
  );
  return new Map(liveLineage.records.map((entry) => [entry.masterKey, entry]));
}

function validateDispensingCurrentPresets({
  dispensingPresets,
  presets,
  dispensingOrders,
  liveLineageByKey,
}) {
  assertExactKeys(
    dispensingPresets,
    [
      "schemaVersion",
      "datasetRevision",
      "sourceReleaseId",
      "sourcePayloadSha256",
      "sourceExtractEntriesSha256",
      "recordCount",
      "presetStatus",
      "clinicalUseAllowed",
      "uniqueDetailFingerprintCount",
      "entriesSha256",
      "entries",
    ],
    "dispensing_current_presets",
  );
  assert(
    dispensingPresets.schemaVersion === 1 &&
      dispensingPresets.datasetRevision ===
        "dispensing-master-presets-v1-2026-08-26" &&
      dispensingPresets.sourceReleaseId ===
        "78a57bf0-10a8-47db-9ae1-8a8cff79b2c4" &&
      dispensingPresets.recordCount === EXPECTED_DISPENSING_PRESET_COUNT &&
      dispensingPresets.presetStatus === "synthetic_unreviewed" &&
      dispensingPresets.clinicalUseAllowed === false,
    "dispensing_current_presets_metadata_drift",
  );
  assert(
    Array.isArray(dispensingPresets.entries) &&
      dispensingPresets.entries.length === EXPECTED_DISPENSING_PRESET_COUNT,
    "dispensing_current_presets_count_invalid",
  );
  assertUniqueBy(
    dispensingPresets.entries,
    (entry) => entry.orderMasterKey,
    "dispensing_current_preset",
  );
  assert(
    dispensingPresets.entriesSha256 ===
      DISPENSING_CURRENT_PRESET_ENTRIES_SHA256,
    "dispensing_current_presets_exact_lock_mismatch",
  );
  assert(
    hashText(JSON.stringify(dispensingPresets.entries)) ===
      dispensingPresets.entriesSha256,
    "dispensing_current_presets_entries_hash_invalid",
  );

  const sourceOrderKeys = new Set(
    dispensingOrders.map((record) => record.masterKey),
  );
  const basePresetByKey = new Map(
    presets.entries.map((entry) => [entry.masterKey, entry]),
  );
  for (const current of dispensingPresets.entries) {
    assert(
      sourceOrderKeys.has(current.orderMasterKey),
      `dispensing_current_preset_unknown_order:${current.orderMasterKey}`,
    );
    const next = basePresetByKey.get(current.orderMasterKey);
    const liveLineage = liveLineageByKey.get(current.orderMasterKey);
    assert(next, `dispensing_current_preset_missing_next:${current.orderMasterKey}`);
    assert(
      current.presetRevision === 1 &&
        next.presetId === current.presetId &&
        next.presetKey === current.presetKey &&
        next.presetRevision === current.presetRevision + 1 &&
        next.provenance?.sourcePresetId === current.presetId &&
        next.provenance?.sourcePresetKey === current.presetKey &&
        next.provenance?.sourcePresetRevision === current.presetRevision &&
        next.provenance?.sourcePresetContentSha256 === current.contentSha256,
      `dispensing_current_preset_lineage_mismatch:${current.orderMasterKey}`,
    );
    assert(
      liveLineage &&
        next.expectedOrderRevisionPolicy?.expectedRevision ===
          liveLineage.currentRevision,
      `dispensing_current_preset_order_revision_mismatch:${current.orderMasterKey}`,
    );
  }
}

function validateBasePresetArtifact({
  presets,
  v4Orders,
  dispensingOrders,
  dispensingPresets,
  frozenOrders,
  liveLineage,
}) {
  assert(
    presets.artifactSha256 === BASE_PRESET_ARTIFACT_SHA256,
    "base_preset_artifact_exact_lock_mismatch",
  );
  assert(
    presets.sourceEntriesSha256 === BASE_PRESET_SOURCE_ENTRIES_SHA256,
    "base_preset_source_entries_exact_lock_mismatch",
  );
  assert(
    presets.expectedStableKeySetSha256 ===
      BASE_PRESET_STABLE_KEY_SET_SHA256,
    "base_preset_stable_key_exact_lock_mismatch",
  );
  assert(
    hashText(
      presets.entries
        .map((entry) => entry.masterKey)
        .sort()
        .join("\n"),
    ) === BASE_PRESET_STABLE_KEY_SET_SHA256,
    "base_preset_stable_key_hash_invalid",
  );
  assert(
    presets.expectedLiveIdentityRevisionSha256 ===
      BASE_PRESET_LIVE_IDENTITY_REVISION_SHA256,
    "base_preset_live_lineage_exact_lock_mismatch",
  );
  assert(
    presets.expectedInputLineageSha256 === BASE_PRESET_INPUT_LINEAGE_SHA256 &&
      presets.inputLineageSha256 === BASE_PRESET_INPUT_LINEAGE_SHA256,
    "base_preset_input_lineage_exact_lock_mismatch",
  );
  assert(
    Array.isArray(presets.inputLineage) &&
      presets.inputLineage.length === EXPECTED_BASE_PRESET_COUNT,
    "base_preset_input_lineage_count_invalid",
  );
  assertUniqueBy(
    presets.inputLineage,
    (entry) => entry.masterKey,
    "base_preset_input_lineage",
  );
  for (const lineage of presets.inputLineage) {
    assertExactKeys(
      lineage,
      ["masterKey", "currentRevision", "currentReleaseIdentity"],
      `base_preset_input_lineage:${lineage.masterKey}`,
    );
    assertExactKeys(
      lineage.currentReleaseIdentity,
      ["releaseKey", "releaseId", "releaseNo"],
      `base_preset_input_lineage_release:${lineage.masterKey}`,
    );
    assert(
      Number.isInteger(lineage.currentRevision) &&
        lineage.currentRevision > 0 &&
        Object.values(lineage.currentReleaseIdentity).some(
          (value) => value !== null,
        ),
      `base_preset_input_lineage_value_invalid:${lineage.masterKey}`,
    );
  }
  assert(
    hashCanonical(presets.inputLineage) === presets.inputLineageSha256,
    "base_preset_input_lineage_hash_invalid",
  );

  const liveLineageByKey = validateLiveLineage(liveLineage);
  validateDispensingCurrentPresets({
    dispensingPresets,
    presets,
    dispensingOrders,
    liveLineageByKey,
  });
  const expectedRevisionByKey = new Map(
    [...liveLineageByKey].map(([masterKey, entry]) => [
      masterKey,
      entry.currentRevision,
    ]),
  );
  assert(
    expectedRevisionByKey.size === EXPECTED_BASE_PRESET_COUNT,
    "base_preset_revision_source_count_invalid",
  );
  const inputLineageByKey = new Map(
    presets.inputLineage.map((entry) => [entry.masterKey, entry]),
  );
  const sourceKeys = [
    ...v4Orders.map((record) => record.masterKey),
    ...dispensingOrders.map((record) => record.masterKey),
    ...frozenOrders.entries.map((entry) => entry.masterKey),
  ].sort(compareUtf8Bytewise);
  assert(
    canonicalize(sourceKeys) ===
      canonicalize([...liveLineageByKey.keys()].sort(compareUtf8Bytewise)),
    "base_preset_live_lineage_key_set_mismatch",
  );
  for (const frozenEntry of frozenOrders.entries) {
    const lineage = liveLineageByKey.get(frozenEntry.masterKey);
    assert(
      lineage &&
        lineage.masterRecordId === frozenEntry.masterRecordId &&
        lineage.currentRevision === frozenEntry.currentRevision &&
        lineage.currentReleaseId === frozenEntry.currentReleaseId,
      `base_preset_frozen_live_lineage_mismatch:${frozenEntry.masterKey}`,
    );
  }
  for (const entry of presets.entries) {
    assertExactKeys(
      entry.expectedOrderRevisionPolicy,
      ["kind", "expectedRevision", "sourceRevisionRequired"],
      `base_preset_revision_policy:${entry.masterKey}`,
    );
    assert(
      entry.expectedOrderRevisionPolicy.kind === "source_current_revision" &&
        entry.expectedOrderRevisionPolicy.sourceRevisionRequired === true &&
        entry.expectedOrderRevisionPolicy.expectedRevision ===
          expectedRevisionByKey.get(entry.masterKey) &&
        entry.expectedOrderRevisionPolicy.expectedRevision ===
          inputLineageByKey.get(entry.masterKey)?.currentRevision,
      `base_preset_revision_lineage_mismatch:${entry.masterKey}`,
    );
  }

  assert(
    presets.sourceEntriesSha256 ===
      hashCanonical(
        presets.entries.map((entry) => withoutBaseEntryTransportHashes(entry)),
      ),
    "base_preset_source_entries_hash_invalid",
  );
  assert(
    presets.entries.every(
      (entry) =>
        entry.sourceEntriesSha256 === presets.sourceEntriesSha256 &&
        entry.sourceArtifactSha256 === presets.sourceEntriesSha256,
    ),
    "base_preset_entry_source_lineage_mismatch",
  );
  const withoutArtifactHash = { ...presets };
  delete withoutArtifactHash.artifactSha256;
  assert(
    presets.artifactSha256 === hashCanonical(withoutArtifactHash),
    "base_preset_artifact_hash_invalid",
  );
}

function validateSystemExamArtifact(systemExam) {
  assert(
    systemExam.artifactSha256 === SYSTEM_EXAM_ARTIFACT_SHA256,
    "system_exam_artifact_exact_lock_mismatch",
  );
  const expectedStableHash = hashCanonical(
    systemExam.stableOrderKeys.join("\n"),
  );
  assert(
    systemExam.stableOrderKeysSha256 === expectedStableHash,
    "system_exam_stable_key_hash_invalid",
  );
  const withoutHashes = { ...systemExam };
  delete withoutHashes.stableOrderKeysSha256;
  delete withoutHashes.artifactSha256;
  assert(
    systemExam.artifactSha256 ===
      hashCanonical({
        ...withoutHashes,
        stableOrderKeysSha256: expectedStableHash,
      }),
    "system_exam_artifact_hash_invalid",
  );
}

function validateSourceInputs({
  v4,
  dispensing,
  dispensingPresets,
  presets,
  supplementIdentity,
  frozenOrders,
  liveLineage,
  systemExam,
}) {
  const v4Payload = publisherPayload(v4, "payload", "v4");
  const dispensingRelease = publisherPayload(
    dispensing,
    "genericReleasePayload",
    "dispensing",
  );
  assertExactKeys(v4Payload, PAYLOAD_KEYS, "v4_payload");
  assertExactKeys(dispensingRelease, PAYLOAD_KEYS, "dispensing_payload");
  assert(
    v4Payload.releaseKey === "cm.release.airtable.operational-master.v4",
    "v4_release_key_drift",
  );
  assert(
    dispensingRelease.releaseKey === DISPENSING_RELEASE_KEY,
    "dispensing_release_key_drift",
  );
  assert(orderRecords(v4Payload).length === 400, "v4_order_count_invalid");
  assert(
    orderRecords(dispensingRelease).length === EXPECTED_DISPENSING_PRESET_COUNT,
    "dispensing_order_count_invalid",
  );
  assert(
    presets?.schemaVersion === "clinical-master-order-execution-presets/v1",
    "preset_artifact_schema_invalid",
  );
  assert(Array.isArray(presets.entries), "preset_entries_missing");
  assert(
    presets.entries.length === EXPECTED_BASE_PRESET_COUNT,
    `preset_entry_count:${presets.entries.length}`,
  );
  assertUniqueBy(presets.entries, (entry) => entry.masterKey, "preset_entry");
  validateFrozenOrders(frozenOrders, supplementIdentity);
  assert(
    systemExam?.schemaVersion === "clinical-master-system-exam-authoring/v1",
    "system_exam_schema_invalid",
  );
  assert(
    systemExam.orderCount === EXPECTED_SYSTEM_EXAM_COUNT,
    "system_exam_order_count_invalid",
  );
  assert(Array.isArray(systemExam.records), "system_exam_records_missing");
  assert(
    systemExam.records.length === EXPECTED_SYSTEM_EXAM_COUNT,
    "system_exam_record_count_invalid",
  );
  assert(
    Array.isArray(systemExam.executionPresets) &&
      systemExam.executionPresets.length === EXPECTED_SYSTEM_EXAM_COUNT,
    "system_exam_presets_missing",
  );
  assert(
    isRecord(systemExam.publisherFragment),
    "system_exam_publisher_fragment_missing",
  );
  assertExactKeys(
    systemExam.publisherFragment,
    ["records", "classificationPaths"],
    "system_exam_publisher_fragment",
  );
  assert(
    Array.isArray(systemExam.publisherFragment.records),
    "system_exam_publisher_records_missing",
  );
  assert(
    Array.isArray(systemExam.publisherFragment.classificationPaths),
    "system_exam_publisher_paths_missing",
  );
  validateBasePresetArtifact({
    presets,
    v4Orders: orderRecords(v4Payload),
    dispensingOrders: orderRecords(dispensingRelease),
    dispensingPresets,
    frozenOrders,
    liveLineage,
  });
  validateSystemExamArtifact(systemExam);
  return { v4Payload, dispensingRelease };
}

function systemPresetMap(systemExam) {
  const result = new Map();
  for (const entry of systemExam.executionPresets) {
    assert(
      typeof entry.orderKey === "string" && isRecord(entry.preset),
      "system_exam_preset_shape_invalid",
    );
    assert(!result.has(entry.orderKey), `system_exam_preset_duplicate:${entry.orderKey}`);
    result.set(entry.orderKey, entry.preset);
  }
  return result;
}

function validateDependencyReuse(v4Payload, dispensingRelease) {
  const v4ByKey = new Map(
    v4Payload.records.map((record) => [record.masterKey, record]),
  );
  for (const record of dispensingRelease.records.filter(
    (entry) => entry.recordType !== "order",
  )) {
    const existing = v4ByKey.get(record.masterKey);
    assert(existing, `dispensing_dependency_missing:${record.masterKey}`);
    assert(
      canonicalize(existing) === canonicalize(record),
      `dispensing_dependency_drift:${record.masterKey}`,
    );
  }
  for (const path of dispensingRelease.classificationPaths) {
    const existing = v4Payload.classificationPaths.find(
      (entry) => entry.pathKey === path.pathKey,
    );
    assert(existing, `dispensing_path_missing:${path.pathKey}`);
    assert(
      canonicalize(existing) === canonicalize(path),
      `dispensing_path_drift:${path.pathKey}`,
    );
  }
}

export function buildReleasePayload(inputs) {
  const { v4Payload, dispensingRelease } = validateSourceInputs(inputs);
  validateDependencyReuse(v4Payload, dispensingRelease);

  const sourceOrders = [
    ...orderRecords(v4Payload),
    ...orderRecords(dispensingRelease),
    ...inputs.frozenOrders.entries.map((entry) => entry.record),
  ];
  assertUniqueBy(sourceOrders, (record) => record.masterKey, "source_order");
  assert(sourceOrders.length === EXPECTED_BASE_PRESET_COUNT, "source_order_count_invalid");

  const presetByKey = new Map(
    inputs.presets.entries.map((entry) => [entry.masterKey, entry]),
  );
  const sourceKeySet = new Set(sourceOrders.map((record) => record.masterKey));
  for (const key of presetByKey.keys()) {
    assert(sourceKeySet.has(key), `unknown_preset_order:${key}`);
  }
  const compiledBaseOrders = sourceOrders.map((record) => {
    const preset = presetByKey.get(record.masterKey);
    assert(preset, `missing_preset_order:${record.masterKey}`);
    return attachExecutionPreset(record, preset);
  });

  const systemPresetByKey = systemPresetMap(inputs.systemExam);
  const compiledSystemOrders = inputs.systemExam.records.map((record) => {
    const preset = systemPresetByKey.get(record.masterKey);
    assert(preset, `missing_system_exam_preset:${record.masterKey}`);
    return attachExecutionPreset(record, preset);
  });
  for (const key of systemPresetByKey.keys()) {
    assert(
      inputs.systemExam.records.some((record) => record.masterKey === key),
      `unknown_system_exam_preset:${key}`,
    );
  }

  const dispensingPresetKeys = new Set(
    orderRecords(dispensingRelease).map((record) => record.masterKey),
  );
  const allCompiledOrders = [...compiledBaseOrders, ...compiledSystemOrders];
  assertUniqueBy(allCompiledOrders, (record) => record.masterKey, "compiled_order");
  assert(allCompiledOrders.length === EXPECTED_ORDER_COUNT, "compiled_order_count_invalid");
  for (const record of allCompiledOrders) {
    const revision = record.detail.executionPreset.presetRevision;
    const expectedRevision = dispensingPresetKeys.has(record.masterKey) ? 2 : 1;
    assert(
      revision === expectedRevision,
      `preset_revision_contract:${record.masterKey}:${revision}`,
    );
  }
  assert(
    allCompiledOrders.filter(
      (record) => record.detail.executionPreset.presetRevision === 2,
    ).length === EXPECTED_DISPENSING_PRESET_COUNT,
    "dispensing_preset_revision_count_invalid",
  );

  const baseNonOrders = v4Payload.records.filter(
    (record) => record.recordType !== "order",
  );
  for (const record of inputs.systemExam.publisherFragment.records) {
    assertPublisherRecord(record, `system_exam_dependency:${record.masterKey}`);
    assert(record.recordType !== "order", `system_exam_dependency_is_order:${record.masterKey}`);
  }
  const records = sortByKey(
    [
      ...baseNonOrders,
      ...inputs.systemExam.publisherFragment.records,
      ...allCompiledOrders,
    ],
    (record) => record.masterKey,
  );
  assertUniqueBy(records, (record) => record.masterKey, "release_record");

  const classificationPaths = sortByKey(
    [
      ...v4Payload.classificationPaths,
      ...inputs.systemExam.publisherFragment.classificationPaths,
    ],
    (path) => path.pathKey,
  );
  assertUniqueBy(classificationPaths, (path) => path.pathKey, "release_path");

  const labOrderProfiles = sortByKey(
    [
      ...v4Payload.labOrderProfiles,
      ...inputs.frozenOrders.entries
        .map((entry) => entry.labOrderProfile)
        .filter((entry) => entry !== null),
    ],
    (profile) => profile.orderMasterKey,
  );
  assertUniqueBy(
    labOrderProfiles,
    (profile) => profile.orderMasterKey,
    "release_lab_order_profile",
  );

  const payload = {
    releaseKey: RELEASE_KEY,
    releaseNotes:
      "Synthetic unreviewed execution presets for 522 frozen clinical master orders; not clinically authorized.",
    adoptionScope: "payload",
    publishedByLabel: PUBLISHED_BY_LABEL,
    records,
    classificationPaths,
    labPanelItems: deepClone(v4Payload.labPanelItems),
    labOrderProfiles,
  };
  validateReleasePayload(payload, {
    sourceOrders: [...sourceOrders, ...inputs.systemExam.records],
  });
  return payload;
}

export function validateReleasePayload(payload, { sourceOrders = null } = {}) {
  assertExactKeys(payload, PAYLOAD_KEYS, "release_payload");
  assert(payload.releaseKey === RELEASE_KEY, "release_key_invalid");
  assert(payload.adoptionScope === "payload", "release_scope_invalid");
  assert(payload.publishedByLabel === PUBLISHED_BY_LABEL, "publisher_label_invalid");
  for (const field of [
    "records",
    "classificationPaths",
    "labPanelItems",
    "labOrderProfiles",
  ]) {
    assert(Array.isArray(payload[field]), `release_${field}_array_required`);
  }
  assertUniqueBy(payload.records, (record) => record.masterKey, "release_record");
  const orders = orderRecords(payload);
  assert(orders.length === EXPECTED_ORDER_COUNT, `release_order_count:${orders.length}`);
  assertUniqueBy(orders, (record) => record.masterKey, "release_order");
  assert(
    canonicalize(orders.map((record) => record.masterKey)) ===
      canonicalize([...orders.map((record) => record.masterKey)].sort()),
    "release_order_sort_invalid",
  );
  for (const record of orders) {
    validateExecutionPresetEnvelope(
      record.detail?.executionPreset,
      `release_execution_preset:${record.masterKey}`,
    );
    assert(
      record.detail.executionPreset.presetStatus === "synthetic_unreviewed" &&
        record.detail.executionPreset.clinicalUseAllowed === false,
      `release_clinical_gate:${record.masterKey}`,
    );
    assert(
      !Object.hasOwn(record, "revision") &&
        !Object.hasOwn(record, "masterRecordId") &&
        !Object.hasOwn(record, "releaseId"),
      `release_generated_lineage_forbidden:${record.masterKey}`,
    );
  }
  assert(
    orders.filter((record) => record.detail.executionPreset.presetRevision === 2)
      .length === EXPECTED_DISPENSING_PRESET_COUNT,
    "release_revision_two_count_invalid",
  );
  assert(
    orders.filter((record) => record.detail.executionPreset.presetRevision === 1)
      .length === EXPECTED_ORDER_COUNT - EXPECTED_DISPENSING_PRESET_COUNT,
    "release_revision_one_count_invalid",
  );
  if (sourceOrders) {
    const sourceByKey = new Map(
      sourceOrders.map((record) => [record.masterKey, record]),
    );
    assert(sourceByKey.size === EXPECTED_ORDER_COUNT, "source_preservation_count_invalid");
    for (const record of orders) {
      const source = sourceByKey.get(record.masterKey);
      assert(source, `source_preservation_missing:${record.masterKey}`);
      const actualWithoutPreset = deepClone(record);
      delete actualWithoutPreset.detail.executionPreset;
      assert(
        canonicalize(actualWithoutPreset) === canonicalize(source),
        `source_order_mutated:${record.masterKey}`,
      );
    }
  }
  return true;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function resolvePath(value, fallback) {
  return resolve(REPO_ROOT, value ?? fallback);
}

export async function loadInputs(options = {}) {
  const [
    v4,
    dispensing,
    dispensingPresets,
    presets,
    supplementIdentity,
    frozenOrders,
    liveLineage,
    systemExam,
  ] =
    await Promise.all([
      readJson(resolvePath(options.v4Payload, PATHS.v4Payload)),
      readJson(resolvePath(options.dispensingPayload, PATHS.dispensingPayload)),
      readJson(resolvePath(options.dispensingPresets, PATHS.dispensingPresets)),
      readJson(resolvePath(options.presetArtifact, PATHS.presetArtifact)),
      readJson(resolvePath(options.supplementIdentity, PATHS.supplementIdentity)),
      readJson(resolvePath(options.frozenOrders, PATHS.frozenOrders)),
      readJson(resolvePath(options.liveLineage, PATHS.liveLineage)),
      readJson(resolvePath(options.systemExam, PATHS.systemExam)),
    ]);
  return {
    v4,
    dispensing,
    dispensingPresets,
    presets,
    supplementIdentity,
    frozenOrders,
    liveLineage,
    systemExam,
  };
}

export async function generateReleasePayload(options = {}) {
  return buildReleasePayload(options.inputs ?? (await loadInputs(options)));
}

function parseArgs(argv) {
  const args = new Set(argv);
  const option = (name) => {
    const index = argv.indexOf(name);
    return index === -1 ? null : argv[index + 1];
  };
  return {
    check: args.has("--check"),
    write: args.has("--write"),
    hash: args.has("--hash"),
    output: option("--output") ?? PATHS.output,
    v4Payload: option("--v4-payload"),
    dispensingPayload: option("--dispensing-payload"),
    dispensingPresets: option("--dispensing-presets"),
    presetArtifact: option("--preset-artifact"),
    supplementIdentity: option("--supplement-identity"),
    frozenOrders: option("--frozen-orders"),
    liveLineage: option("--live-lineage"),
    systemExam: option("--system-exam"),
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  assert(
    [options.check, options.write, options.hash].filter(Boolean).length === 1,
    "usage: exactly one of --check, --write, or --hash",
  );
  const payload = await generateReleasePayload(options);
  const payloadSha256 = hashCanonical(payload);
  if (options.hash) {
    process.stdout.write(`${payloadSha256}\n`);
    return;
  }
  const outputPath = resolvePath(options.output, PATHS.output);
  if (options.write) {
    await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    process.stdout.write(
      `wrote ${outputPath} (${EXPECTED_ORDER_COUNT} orders, sha256 ${payloadSha256})\n`,
    );
    return;
  }
  let existing;
  try {
    existing = await readJson(outputPath);
  } catch {
    throw new Error(`release_payload_missing:${outputPath}`);
  }
  validateReleasePayload(existing);
  assert(canonicalize(existing) === canonicalize(payload), "release_payload_drift");
  process.stdout.write(
    `checked ${outputPath} (${EXPECTED_ORDER_COUNT} orders, sha256 ${payloadSha256})\n`,
  );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
) {
  main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  });
}
