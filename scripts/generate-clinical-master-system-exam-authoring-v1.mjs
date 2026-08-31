#!/usr/bin/env node

/**
 * Generate the additive system-exam authoring artifact for PR-022.
 *
 * The output is intentionally a transport artifact, not a live publish call.
 * It contains 12 stable order identities, one new T category, independent
 * clinical actions and paths, and one execution profile per order. Existing
 * X/CG_EXAM/NT_CHART_ONLY records are referenced as dependencies and are never
 * copied or reclassified by this generator.
 */

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "..");
const DEFAULT_OUTPUT = "tests/fixtures/clinical-master-system-exam-authoring-v1.json";

export const SYSTEM_EXAM_ORDER_KEYS = Object.freeze([
  "cm.order.system-exam.general-vitals",
  "cm.order.system-exam.cardiovascular",
  "cm.order.system-exam.respiratory",
  "cm.order.system-exam.digestive-abdominal",
  "cm.order.system-exam.urogenital",
  "cm.order.system-exam.neurologic",
  "cm.order.system-exam.musculoskeletal",
  "cm.order.system-exam.dermatologic-coat",
  "cm.order.system-exam.ophthalmic",
  "cm.order.system-exam.otic",
  "cm.order.system-exam.oral-dental",
  "cm.order.system-exam.peripheral-lymphatic",
]);

const SYSTEM_EXAM_PROFILES = Object.freeze([
  ["general-vitals", "전신상태·활력", "전신 상태와 활력 평가"],
  ["cardiovascular", "심혈관계", "심혈관계 평가"],
  ["respiratory", "호흡기계", "호흡기계 평가"],
  ["digestive-abdominal", "소화기·복부", "소화기 및 복부 평가"],
  ["urogenital", "비뇨생식기계", "비뇨생식기계 평가"],
  ["neurologic", "신경계", "신경계 평가"],
  ["musculoskeletal", "근골격계", "근골격계 평가"],
  ["dermatologic-coat", "피부·피모", "피부 및 피모 평가"],
  ["ophthalmic", "안과", "안과 평가"],
  ["otic", "이과", "이과 평가"],
  ["oral-dental", "구강·치과", "구강 및 치과 평가"],
  ["peripheral-lymphatic", "말초 림프계", "말초 림프계 평가"],
]);

const FIELD_POLICIES = Object.freeze({
  bodySystem: "derived_from_profile",
  examScope: "derived_from_profile",
  examMethod: "preset_fixed",
  findingSummary: "required_manual",
  siteLaterality: "required_manual",
  abnormalFindings: "required_manual",
  attachments: "not_applicable",
  exceptions: "not_applicable",
});

const PRESET_UUID_NAMESPACE = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
const PRESET_CONTENT_FIELDS = Object.freeze([
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
  "sourceArtifactSha256",
]);

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
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

function uuidV5(name) {
  const namespace = Buffer.from(PRESET_UUID_NAMESPACE.replaceAll("-", ""), "hex");
  const digest = createHash("sha1")
    .update(Buffer.concat([namespace, Buffer.from(name, "utf8")]))
    .digest();
  digest[6] = (digest[6] & 0x0f) | 0x50;
  digest[8] = (digest[8] & 0x3f) | 0x80;
  const hex = digest.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function canonicalizePostgresJsonbText(value) {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalizePostgresJsonbText(entry)).join(", ")}]`;
  }
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort((left, right) => {
        const lengthDelta = Buffer.byteLength(left, "utf8") - Buffer.byteLength(right, "utf8");
        return lengthDelta === 0
          ? Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"))
          : lengthDelta;
      })
      .map((key) => `${JSON.stringify(key)}: ${canonicalizePostgresJsonbText(value[key])}`)
      .join(", ")}}`;
  }
  return JSON.stringify(value);
}

function presetContentHash(preset) {
  return createHash("sha256")
    .update(canonicalizePostgresJsonbText(Object.fromEntries(
      PRESET_CONTENT_FIELDS.map((fieldName) => [fieldName, preset[fieldName]]),
    )))
    .digest("hex");
}

function names(name) {
  return [
    {
      languageCode: "ko",
      nameKind: "preferred",
      name,
      searchable: true,
      sortOrder: 0,
    },
  ];
}

function syntheticSource() {
  return {
    sourceType: "synthetic",
    title: "CLAiR system-exam authoring fixture",
    referenceUri: null,
    sourceVersion: "v1",
    accessedAt: "2026-08-31",
    licenseNotes: "Synthetic structural data; not for clinical use.",
  };
}

function recordEnvelope({ masterKey, recordType, name, detail }) {
  return {
    masterKey,
    recordType,
    lifecycleStatus: "published",
    safetyStatus: "normal",
    safetyReason: null,
    names: names(name),
    source: syntheticSource(),
    detail,
  };
}

function makeRecord([slug, label]) {
  const masterKey = `cm.order.system-exam.${slug}`;
  const pathKey = `cm.path.system-exam.${slug}`;
  return recordEnvelope({
    masterKey,
    recordType: "order",
    name: label,
    detail: {
      classificationPathKey: pathKey,
      defaultSalesUnitCode: "case",
      defaultBillingReflectionEnabled: false,
      defaultQuantity: 1,
      species: ["dog", "cat"],
    },
  });
}

function makeExecutionPreset([slug, label, scope], index) {
  const orderKey = `cm.order.system-exam.${slug}`;
  const presetKey = `preset:execution:${orderKey}`;
  return {
    orderKey,
    actionKey: `cm.action.system-exam.${slug}`,
    pathKey: `cm.path.system-exam.${slug}`,
    profileKey: `system_exam.${slug}.v1`,
    profile: {
      label,
      examScope: scope,
      examMethod: "표준 신체검사",
      sortOrder: index + 1,
      findingsEnteredAtRuntime: true,
      noNormalFindingDefaults: true,
    },
    preset: {
      presetId: uuidV5(presetKey),
      presetKey,
      presetRevision: 1,
      clinicalOrderType: "system_exam",
      destinationModule: null,
      executionMode: "immediate_complete",
      detailSchemaVersion: 1,
      defaultDetailInputs: {
        bodySystem: label,
        examScope: scope,
        examMethod: "표준 신체검사",
      },
      fieldPolicies: { ...FIELD_POLICIES },
      provenance: {
        sourceReleaseKey: null,
        sourceReleaseId: null,
        sourceFingerprint: hashCanonical({ orderKey, label, scope }),
        sourceRecordFingerprint: hashCanonical({ orderKey, label, scope }),
        sourceType: "synthetic-system-exam-profile",
        generatorProfileKey: `system_exam.${slug}.v1`,
        sourceNotes: "Synthetic profile. Findings are entered by the clinician at runtime; no normal finding is authored.",
        clinicalUseNotice: "Synthetic transport preset; veterinarian review is required before clinical use.",
      },
      presetStatus: "synthetic_unreviewed",
      syntheticUnreviewed: true,
      clinicalUseAllowed: false,
    },
    provenance: {
      sourceType: "synthetic-system-exam-profile",
      sourceNotes: "No normal/abnormal finding, patient, price, or assignee is authored.",
    },
  };
}

function finalizeExecutionPresets(entries) {
  const sourceEntries = entries.map((entry) => {
    const sourceEntry = {
      ...entry,
      preset: { ...entry.preset },
    };
    delete sourceEntry.preset.contentSha256;
    delete sourceEntry.preset.sourceArtifactSha256;
    return sourceEntry;
  });
  const sourceArtifactSha256 = hashCanonical(sourceEntries);
  return entries.map((entry) => {
    const presetWithSourceHash = {
      ...entry.preset,
      sourceArtifactSha256,
    };
    return {
      ...entry,
      preset: {
        ...presetWithSourceHash,
        contentSha256: presetContentHash(presetWithSourceHash),
      },
    };
  });
}

export function buildArtifact() {
  const records = SYSTEM_EXAM_PROFILES.map(makeRecord);
  const executionPresets = finalizeExecutionPresets(
    SYSTEM_EXAM_PROFILES.map(makeExecutionPreset),
  );
  const publisherFragmentRecords = [
    recordEnvelope({
      masterKey: "cm.order-category.t.system-exam",
      recordType: "order_category",
      name: "계통검사",
      detail: {
        categoryCode: "T-SYSTEM-EXAM",
        categoryLevel: "T",
        parentMasterKey: "cm.order-category.x.clinical",
        sortOrder: 9,
      },
    }),
    ...SYSTEM_EXAM_PROFILES.map(([slug, label]) =>
      recordEnvelope({
        masterKey: `cm.action.system-exam.${slug}`,
        recordType: "clinical_action",
        name: `계통검사 · ${label}`,
        detail: {
          tCategoryKey: "cm.order-category.t.system-exam",
          itemType: "misc",
          isOtherUnclassified: false,
        },
      }),
    ),
  ];
  const classificationPaths = records.map((record) => ({
    pathKey: `cm.path.system-exam.${record.masterKey.slice("cm.order.system-exam.".length)}`,
    clinicalActionKey: `cm.action.system-exam.${record.masterKey.slice("cm.order.system-exam.".length)}`,
    chartGroupKey: "phase1a2.fallback.chart.CG_EXAM",
    taskRouteKey: "phase1a2.fallback.route.NT_CHART_ONLY",
  }));
  const artifactWithoutHash = {
    schemaVersion: "clinical-master-system-exam-authoring/v1",
    artifactRevision: 1,
    publishState: "synthetic_unreviewed",
    clinicalUseAllowed: false,
    orderCount: records.length,
    stableOrderKeys: records.map((record) => record.masterKey),
    taxonomy: {
      newTCategory: {
        masterKey: "cm.order-category.t.system-exam",
        recordType: "order_category",
        categoryCode: "T-SYSTEM-EXAM",
        categoryLevel: "T",
        parentMasterKey: "cm.order-category.x.clinical",
      },
      reusedXCategory: {
        masterKey: "cm.order-category.x.clinical",
        recordType: "order_category",
        reuse: true,
      },
      reusedChartGroup: {
        masterKey: "phase1a2.fallback.chart.CG_EXAM",
        recordType: "chart_group",
        groupCode: "CG_EXAM",
        reuse: true,
      },
      reusedTaskRoute: {
        masterKey: "phase1a2.fallback.route.NT_CHART_ONLY",
        recordType: "task_route",
        routeCode: "NT_CHART_ONLY",
        destinationModule: "chart_only",
        taskRequired: false,
        runtimeStatus: "active",
        reuse: true,
      },
      clinicalActionItemType: "misc",
    },
    clinicalActions: records.map((record) => ({
      masterKey: `cm.action.system-exam.${record.masterKey.slice("cm.order.system-exam.".length)}`,
      recordType: "clinical_action",
      tCategoryKey: "cm.order-category.t.system-exam",
      itemType: "misc",
      isOtherUnclassified: false,
    })),
    classificationPaths,
    publisherFragment: {
      records: publisherFragmentRecords,
      classificationPaths,
    },
    profiles: executionPresets.map((entry) => ({
      profileKey: entry.profileKey,
      orderKey: entry.orderKey,
      ...entry.profile,
    })),
    executionPresets,
    records,
  };
  return {
    ...artifactWithoutHash,
    stableOrderKeysSha256: hashCanonical(artifactWithoutHash.stableOrderKeys.join("\n")),
    artifactSha256: hashCanonical({
      ...artifactWithoutHash,
      stableOrderKeysSha256: hashCanonical(artifactWithoutHash.stableOrderKeys.join("\n")),
    }),
  };
}

export function validateArtifact(artifact) {
  assert(artifact?.schemaVersion === "clinical-master-system-exam-authoring/v1", "schema_invalid");
  assert(artifact.artifactRevision === 1, "artifact_revision_invalid");
  assert(artifact.publishState === "synthetic_unreviewed", "publish_state_invalid");
  assert(artifact.clinicalUseAllowed === false, "clinical_use_gate_invalid");
  assert(artifact.orderCount === 12, "order_count_invalid");
  assert(JSON.stringify(artifact.stableOrderKeys) === JSON.stringify(SYSTEM_EXAM_ORDER_KEYS), "stable_order_keys_invalid");
  assert(new Set(artifact.stableOrderKeys).size === 12, "stable_order_keys_duplicate");
  assert(artifact.taxonomy?.newTCategory?.categoryLevel === "T", "new_t_category_missing");
  assert(artifact.taxonomy?.newTCategory?.parentMasterKey === "cm.order-category.x.clinical", "x_parent_mismatch");
  assert(artifact.taxonomy?.reusedChartGroup?.groupCode === "CG_EXAM", "chart_group_dependency_invalid");
  assert(artifact.taxonomy?.reusedTaskRoute?.routeCode === "NT_CHART_ONLY", "task_route_dependency_invalid");
  assert(artifact.taxonomy?.clinicalActionItemType === "misc", "clinical_action_item_type_invalid");
  assert(Array.isArray(artifact.records) && artifact.records.length === 12, "record_count_invalid");
  assert(Array.isArray(artifact.clinicalActions) && artifact.clinicalActions.length === 12, "action_count_invalid");
  assert(Array.isArray(artifact.classificationPaths) && artifact.classificationPaths.length === 12, "path_count_invalid");
  assert(Array.isArray(artifact.profiles) && artifact.profiles.length === 12, "profile_count_invalid");
  assert(Array.isArray(artifact.executionPresets) && artifact.executionPresets.length === 12, "execution_preset_count_invalid");
  assert(Array.isArray(artifact.publisherFragment?.records) && artifact.publisherFragment.records.length === 13, "publisher_record_count_invalid");
  assert(Array.isArray(artifact.publisherFragment?.classificationPaths) && artifact.publisherFragment.classificationPaths.length === 12, "publisher_path_count_invalid");
  assert(JSON.stringify(artifact.publisherFragment.classificationPaths) === JSON.stringify(artifact.classificationPaths), "publisher_paths_drift");

  const categoryRecord = artifact.publisherFragment.records[0];
  assert(categoryRecord.masterKey === "cm.order-category.t.system-exam", "publisher_t_category_key_invalid");
  assert(categoryRecord.recordType === "order_category", "publisher_t_category_type_invalid");
  assert(categoryRecord.detail?.categoryLevel === "T", "publisher_t_category_level_invalid");
  assert(categoryRecord.detail?.parentMasterKey === "cm.order-category.x.clinical", "publisher_t_category_parent_invalid");
  assert(categoryRecord.source?.sourceType === "synthetic", "publisher_t_category_source_invalid");
  const sourceArtifactHashes = new Set();
  for (const [index, actionRecord] of artifact.publisherFragment.records.slice(1).entries()) {
    const slug = artifact.stableOrderKeys[index].slice("cm.order.system-exam.".length);
    assert(actionRecord.masterKey === `cm.action.system-exam.${slug}`, `publisher_action_key_invalid:${index}`);
    assert(actionRecord.recordType === "clinical_action", `publisher_action_type_invalid:${index}`);
    assert(actionRecord.detail?.tCategoryKey === "cm.order-category.t.system-exam", `publisher_action_category_invalid:${index}`);
    assert(actionRecord.detail?.itemType === "misc", `publisher_action_item_type_invalid:${index}`);
    assert(actionRecord.source?.sourceType === "synthetic", `publisher_action_source_invalid:${index}`);
  }

  for (const [index, record] of artifact.records.entries()) {
    assert(record.masterKey === SYSTEM_EXAM_ORDER_KEYS[index], `record_key_invalid:${index}`);
    assert(record.recordType === "order", `record_type_invalid:${record.masterKey}`);
    assert(record.lifecycleStatus === "published" && record.safetyStatus === "normal", `record_status_invalid:${record.masterKey}`);
    assert(record.source?.sourceType === "synthetic", `record_source_invalid:${record.masterKey}`);
    assert(record.detail?.classificationPathKey === `cm.path.system-exam.${record.masterKey.slice("cm.order.system-exam.".length)}`, `record_path_invalid:${record.masterKey}`);
    assert(record.detail?.defaultSalesUnitCode === "case", `sales_unit_invalid:${record.masterKey}`);
    assert(record.detail?.defaultQuantity === 1, `quantity_invalid:${record.masterKey}`);
    assert(record.detail?.species?.length === 2, `species_scope_invalid:${record.masterKey}`);
    assert(!Object.hasOwn(record, "systemExamAuthoring"), `record_transport_shape_invalid:${record.masterKey}`);
    const authoring = artifact.executionPresets[index];
    const preset = authoring?.preset;
    assert(
      typeof preset?.presetKey === "string" &&
        preset.presetId === uuidV5(preset.presetKey),
      `preset_id_invalid:${record.masterKey}`,
    );
    assert(typeof preset?.contentSha256 === "string" && /^[0-9a-f]{64}$/.test(preset.contentSha256), `preset_content_hash_invalid:${record.masterKey}`);
    assert(typeof preset?.sourceArtifactSha256 === "string" && /^[0-9a-f]{64}$/.test(preset.sourceArtifactSha256), `preset_source_hash_invalid:${record.masterKey}`);
    assert(preset.contentSha256 === presetContentHash(preset), `preset_content_hash_mismatch:${record.masterKey}`);
    sourceArtifactHashes.add(preset.sourceArtifactSha256);
    assert(authoring?.profile?.noNormalFindingDefaults === true, `normal_finding_guard_invalid:${record.masterKey}`);
    assert(authoring?.profile?.findingsEnteredAtRuntime === true, `runtime_finding_guard_invalid:${record.masterKey}`);
    assert(preset?.clinicalOrderType === "system_exam", `preset_type_invalid:${record.masterKey}`);
    assert(preset?.destinationModule === null && preset?.executionMode === "immediate_complete", `preset_transport_invalid:${record.masterKey}`);
    assert(preset?.presetStatus === "synthetic_unreviewed" && preset?.clinicalUseAllowed === false, `preset_safety_invalid:${record.masterKey}`);
    assert(JSON.stringify(Object.keys(preset.defaultDetailInputs).sort()) === JSON.stringify(["bodySystem", "examMethod", "examScope"]), `preset_defaults_invalid:${record.masterKey}`);
    assert(preset.defaultDetailInputs.findingSummary === undefined, `finding_default_present:${record.masterKey}`);
    assert(preset.defaultDetailInputs.normalFinding === undefined, `normal_finding_present:${record.masterKey}`);
    assert(preset.defaultDetailInputs.patientId === undefined, `patient_default_present:${record.masterKey}`);
    assert(preset.defaultDetailInputs.assigneeUserId === undefined, `assignee_default_present:${record.masterKey}`);
    assert(preset.fieldPolicies.findingSummary === "required_manual", `finding_policy_invalid:${record.masterKey}`);
  }
  assert(sourceArtifactHashes.size === 1, "preset_source_hash_not_shared");
  for (const [index, authoring] of artifact.executionPresets.entries()) {
    assert(authoring.orderKey === artifact.stableOrderKeys[index], `execution_preset_order_invalid:${index}`);
    assert(authoring.actionKey === `cm.action.system-exam.${artifact.stableOrderKeys[index].slice("cm.order.system-exam.".length)}`, `execution_preset_action_invalid:${index}`);
    assert(authoring.pathKey === `cm.path.system-exam.${artifact.stableOrderKeys[index].slice("cm.order.system-exam.".length)}`, `execution_preset_path_invalid:${index}`);
  }
  for (const [index, action] of artifact.clinicalActions.entries()) {
    const slug = artifact.stableOrderKeys[index].slice("cm.order.system-exam.".length);
    assert(action.masterKey === `cm.action.system-exam.${slug}`, `action_key_invalid:${index}`);
    assert(action.recordType === "clinical_action", `action_type_invalid:${index}`);
    assert(action.tCategoryKey === "cm.order-category.t.system-exam", `action_category_invalid:${index}`);
    assert(action.itemType === "misc" && action.isOtherUnclassified === false, `action_runtime_type_invalid:${index}`);
  }
  for (const [index, path] of artifact.classificationPaths.entries()) {
    const slug = artifact.stableOrderKeys[index].slice("cm.order.system-exam.".length);
    assert(path.pathKey === `cm.path.system-exam.${slug}`, `path_key_invalid:${index}`);
    assert(path.clinicalActionKey === `cm.action.system-exam.${slug}`, `path_action_invalid:${index}`);
    assert(path.chartGroupKey === "phase1a2.fallback.chart.CG_EXAM", `path_chart_group_invalid:${index}`);
    assert(path.taskRouteKey === "phase1a2.fallback.route.NT_CHART_ONLY", `path_task_route_invalid:${index}`);
  }
  for (const [index, profile] of artifact.profiles.entries()) {
    const slug = artifact.stableOrderKeys[index].slice("cm.order.system-exam.".length);
    assert(profile.profileKey === `system_exam.${slug}.v1`, `profile_key_invalid:${index}`);
    assert(profile.orderKey === artifact.stableOrderKeys[index], `profile_order_invalid:${index}`);
    assert(profile.findingsEnteredAtRuntime === true && profile.noNormalFindingDefaults === true, `profile_finding_guard_invalid:${index}`);
  }

  const expectedStableHash = hashCanonical(artifact.stableOrderKeys.join("\n"));
  assert(artifact.stableOrderKeysSha256 === expectedStableHash, "stable_order_hash_invalid");
  const withoutHashes = { ...artifact };
  delete withoutHashes.stableOrderKeysSha256;
  delete withoutHashes.artifactSha256;
  assert(artifact.artifactSha256 === hashCanonical({
    ...withoutHashes,
    stableOrderKeysSha256: expectedStableHash,
  }), "artifact_hash_invalid");
  return true;
}

function resolveOutput(value) {
  return resolve(REPO_ROOT, value ?? DEFAULT_OUTPUT);
}

function parseArgs(argv) {
  const args = new Set(argv);
  const outputIndex = argv.indexOf("--output");
  return {
    check: args.has("--check"),
    hash: args.has("--hash"),
    write: args.has("--write"),
    output: outputIndex === -1 ? DEFAULT_OUTPUT : argv[outputIndex + 1],
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  assert(options.check || options.hash || options.write, "usage: --check, --hash, or --write");
  const artifact = buildArtifact();
  validateArtifact(artifact);
  if (options.hash) {
    process.stdout.write(`${artifact.artifactSha256}\n`);
    return;
  }
  const outputPath = resolveOutput(options.output);
  if (options.write) {
    await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
    process.stdout.write(`wrote ${outputPath}\n`);
    return;
  }
  let existing;
  try {
    existing = JSON.parse(await readFile(outputPath, "utf8"));
  } catch {
    throw new Error(`artifact_missing:${outputPath}`);
  }
  validateArtifact(existing);
  assert(canonicalize(existing) === canonicalize(artifact), "artifact_drift");
  process.stdout.write(`checked ${outputPath} (${artifact.orderCount} orders)\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
