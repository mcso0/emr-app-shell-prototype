#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "..");
const ARTIFACT_DIR = resolve(
  REPO_ROOT,
  "docs/work/clinical-master/order-execution-defaults/artifacts",
);
const CONTRACT_PATH = resolve(ARTIFACT_DIR, "wp-00-field-ownership.v1.json");
const AUDIT_PATH = resolve(ARTIFACT_DIR, "wp-00-semantic-audit.v1.json");
const MANIFEST_PATH = resolve(ARTIFACT_DIR, "wp-00-frozen-manifest.v1.json");
const V4_PATH = resolve(
  REPO_ROOT,
  "tests/fixtures/clinical-master-operational-v4-authoring.json",
);
const DISPENSING_PATH = resolve(
  REPO_ROOT,
  "docs/work/clinical-master/clinical-master-pr-017/supabase/dispensing-order-release-payload.v1.json",
);
const FROZEN_ORDERS_PATH = resolve(
  REPO_ROOT,
  "tests/fixtures/clinical-master-execution-preset-release-frozen-orders.v1.json",
);

const PASS_CODES = Object.freeze({
  master_default: "PASS_MASTER_BACKED",
  schema_default: "PASS_SCHEMA_SAFE_DEFAULT",
  workspace_override: "PASS_MASTER_BACKED",
  workspace_resolver: "PASS_WORKSPACE_RESOLVER",
  runtime_resolver: "PASS_RUNTIME_RESOLVER",
  encounter_input: "PASS_ENCOUNTER_INPUT",
  actual_result: "PASS_ACTUAL_RESULT",
  not_applicable: "PASS_NOT_APPLICABLE",
});

const BLOCKING_CODES = new Set([
  "BLOCK_MISSING_MASTER_DEFAULT",
  "BLOCK_MISSING_RESOLVER",
  "BLOCK_MISOWNED_FIELD",
  "BLOCK_INVALID_UNIT_OR_FORMULA",
  "BLOCK_FALLBACK_ONLY",
  "BLOCK_NOT_PERSISTED",
  "BLOCK_PROJECTION_MISMATCH",
  "BLOCK_DUPLICATE_OR_FOREIGN_ROW",
  "BLOCK_UNAVAILABLE_OR_CONFLATED_STATUS",
  "BLOCK_UNKNOWN_SCHEMA_FIELD",
]);

const FREQUENCY_PER_DAY = Object.freeze({
  once: 1,
  sid: 1,
  bid: 2,
  tid: 3,
  qid: 4,
});

function canonicalize(value) {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function fileSha256(path) {
  return sha256(await readFile(path));
}

function hasValue(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function validateValue(value, field) {
  if (!hasValue(value)) return null;
  const actualType = Array.isArray(value) ? "array" : typeof value;
  const expectedType = field.valueType.endsWith("_array")
    ? "array"
    : field.valueType;
  if (actualType !== expectedType) return `type:${actualType}->${expectedType}`;
  if (typeof value === "number") {
    if (field.integer === true && !Number.isInteger(value))
      return "integer_required";
    if (field.minimum !== undefined && value < field.minimum) {
      return `minimum:${field.minimum}`;
    }
    if (
      field.minimumExclusive !== undefined &&
      value <= field.minimumExclusive
    ) {
      return `minimum_exclusive:${field.minimumExclusive}`;
    }
  }
  if (field.allowedValues && !field.allowedValues.includes(value)) {
    return "allowed_value_mismatch";
  }
  if (field.expectedValue !== undefined && value !== field.expectedValue) {
    return "expected_value_mismatch";
  }
  return null;
}

function identityFor(row) {
  return row.masterKey ?? row.stableKey ?? row.proposedIdentity ?? null;
}

function displayNameFor(row) {
  return row.displayName ?? row.profile?.label ?? identityFor(row);
}

function buildSourceMetadata(v4, dispensing, frozenOrders) {
  const byIdentity = new Map();
  for (const record of v4.records.filter(
    (candidate) => candidate.recordType === "order",
  )) {
    byIdentity.set(record.masterKey, {
      classificationPathKey: record.detail?.classificationPathKey ?? null,
      speciesApplicability: record.detail?.species ?? [],
      speciesSource: "clinical-master-operational-v4-authoring",
    });
  }
  for (const record of dispensing.genericReleasePayload.records.filter(
    (candidate) => candidate.recordType === "order",
  )) {
    byIdentity.set(record.masterKey, {
      classificationPathKey: record.detail?.classificationPathKey ?? null,
      speciesApplicability: record.detail?.species ?? [],
      speciesSource: "dispensing-order-release-payload",
    });
  }
  for (const entry of frozenOrders.entries) {
    byIdentity.set(entry.masterKey, {
      classificationPathKey:
        entry.record?.detail?.classificationPathKey ?? null,
      speciesApplicability: entry.record?.detail?.species ?? [],
      speciesSource: "clinical-master-execution-preset-release-frozen-orders",
    });
  }
  return byIdentity;
}

function fieldResult(row, field, contract) {
  const value = row.defaultDetailInputs?.[field.key];
  const currentPolicy = row.fieldPolicies?.[field.key] ?? null;
  const present = hasValue(value);
  const evidence = [];
  let findingCode =
    PASS_CODES[field.targetOwner] ?? "BLOCK_UNKNOWN_SCHEMA_FIELD";

  if (
    field.targetOwner === "runtime_resolver" ||
    field.targetOwner === "workspace_resolver"
  ) {
    const proof = contract.resolverProofs[field.resolverProof];
    if (!proof?.implemented) {
      findingCode = "BLOCK_MISSING_RESOLVER";
    } else if (!field.acceptedPolicies.includes(currentPolicy)) {
      findingCode = "BLOCK_MISOWNED_FIELD";
    } else {
      evidence.push(proof.source, proof.test);
    }
  } else if (field.targetOwner === "actual_result") {
    if (field.required) {
      findingCode = "BLOCK_MISOWNED_FIELD";
      evidence.push(
        "Current chart schema requires an actual/result field before confirmation.",
      );
    } else if (currentPolicy === "not_applicable") {
      findingCode = "PASS_NOT_APPLICABLE";
    }
  } else if (field.targetOwner === "encounter_input") {
    if (currentPolicy && !field.acceptedPolicies.includes(currentPolicy)) {
      findingCode = "BLOCK_MISOWNED_FIELD";
    }
  } else if (field.targetOwner === "schema_default") {
    if (!present) {
      findingCode = "BLOCK_NOT_PERSISTED";
    } else if (!field.acceptedPolicies.includes(currentPolicy)) {
      findingCode = "BLOCK_MISOWNED_FIELD";
    }
  } else if (field.targetOwner === "master_default") {
    if (
      currentPolicy === "not_applicable" &&
      field.acceptedPolicies.includes(currentPolicy)
    ) {
      findingCode = "PASS_NOT_APPLICABLE";
    } else if (
      !field.required &&
      !present &&
      currentPolicy === "required_manual" &&
      field.acceptedPolicies.includes(currentPolicy)
    ) {
      findingCode = "PASS_ENCOUNTER_INPUT";
      evidence.push(
        "Optional conditional value is intentionally chosen per encounter.",
      );
    } else if (!present) {
      findingCode = "BLOCK_MISSING_MASTER_DEFAULT";
    } else if (!field.acceptedPolicies.includes(currentPolicy)) {
      findingCode = "BLOCK_MISOWNED_FIELD";
    }
  } else if (field.targetOwner === "workspace_override") {
    if (currentPolicy && !field.acceptedPolicies.includes(currentPolicy)) {
      findingCode = "BLOCK_MISOWNED_FIELD";
    }
  }

  const valueIssue = validateValue(value, field);
  if (valueIssue) {
    findingCode = "BLOCK_INVALID_UNIT_OR_FORMULA";
    evidence.push(valueIssue);
  }

  return {
    fieldKey: field.key,
    required: field.required,
    present,
    currentValue: present ? value : null,
    currentPolicy,
    targetOwner: field.targetOwner,
    researchRequired: field.researchRequired,
    researchQuestion: field.researchQuestion ?? null,
    acceptableSourceTypes: field.sourceClasses ?? [],
    findingCode,
    blocking: BLOCKING_CODES.has(findingCode),
    evidence: evidence.filter(Boolean),
    targetWorkPackage: field.targetWorkPackage,
  };
}

function extraFieldFindings(row, fieldContracts) {
  const known = new Set(fieldContracts.map((field) => field.key));
  const extraKeys = new Set([
    ...Object.keys(row.defaultDetailInputs ?? {}),
    ...Object.keys(row.fieldPolicies ?? {}),
  ]);
  return [...extraKeys]
    .filter((key) => !known.has(key))
    .sort()
    .map((key) => ({
      fieldKey: key,
      required: null,
      present: hasValue(row.defaultDetailInputs?.[key]),
      currentValue: row.defaultDetailInputs?.[key] ?? null,
      currentPolicy: row.fieldPolicies?.[key] ?? null,
      targetOwner: null,
      researchRequired: false,
      researchQuestion: null,
      acceptableSourceTypes: [],
      findingCode: "BLOCK_UNKNOWN_SCHEMA_FIELD",
      blocking: true,
      evidence: ["Field is absent from the frozen WP-00 ownership contract."],
      targetWorkPackage: "WP-00",
    }));
}

function dispensingFormulaFinding(row) {
  if (row.clinicalOrderType !== "dispensing") return null;
  const detail = row.defaultDetailInputs ?? {};
  const perDay = FREQUENCY_PER_DAY[detail.frequency];
  if (
    detail.doseBasis !== "patient" ||
    !perDay ||
    detail.doseUnit !== detail.totalQuantityUnit ||
    ![detail.dose, detail.durationDays, detail.totalQuantity].every(
      Number.isFinite,
    )
  ) {
    return null;
  }
  const theoreticalTotal = detail.dose * perDay * detail.durationDays;
  if (Math.abs(theoreticalTotal - detail.totalQuantity) < 1e-9) return null;
  return {
    fieldKey: "totalQuantity",
    required: true,
    present: true,
    currentValue: detail.totalQuantity,
    currentPolicy: row.fieldPolicies?.totalQuantity ?? null,
    targetOwner: "master_default",
    researchRequired: true,
    researchQuestion:
      "Which preparation increment, rounding direction, and adjustment reason explain the difference from the theoretical total?",
    acceptableSourceTypes: [
      "official_product_label",
      "veterinary_compounding_guidance",
    ],
    findingCode: "BLOCK_INVALID_UNIT_OR_FORMULA",
    blocking: true,
    evidence: [
      `theoretical_total=${theoreticalTotal}`,
      `stored_total=${detail.totalQuantity}`,
      "No structured preparation increment, rounding direction, or adjustment reason exists in schema v1.",
    ],
    targetWorkPackage: "WP-03",
  };
}

function countBy(values) {
  return Object.fromEntries(
    [
      ...values.reduce(
        (map, value) => map.set(value, (map.get(value) ?? 0) + 1),
        new Map(),
      ),
    ].sort(([left], [right]) => left.localeCompare(right)),
  );
}

function semanticPayload(report) {
  const payload = { ...report };
  delete payload.generatedAt;
  delete payload.semanticFingerprint;
  return payload;
}

export async function buildAudit({ sourceMode = "worktree" } = {}) {
  if (!["worktree", "baseline"].includes(sourceMode)) throw new Error("unknown_audit_source_mode");
  const contract = await readJson(CONTRACT_PATH);
  const fixturePath = resolve(REPO_ROOT, contract.fixturePath);
  const fixture = await readJson(fixturePath);
  const v4 = await readJson(V4_PATH);
  const dispensing = await readJson(DISPENSING_PATH);
  const frozenOrders = await readJson(FROZEN_ORDERS_PATH);
  const sourceMetadata = buildSourceMetadata(v4, dispensing, frozenOrders);
  const rows = [
    ...fixture.entries,
    ...(fixture.proposedSystemExamOrders ?? []),
  ];
  const identities = rows.map(identityFor);
  const identityCounts = countBy(identities);
  const duplicatedIdentities = Object.entries(identityCounts)
    .filter(([, count]) => count > 1)
    .map(([identity]) => identity);

  const fixtureSha256 = await fileSha256(fixturePath);
  // Replaying WP00 verifies its exact historical source, not the later OED
  // implementation. Default worktree mode still detects current source drift.
  // Missing Git history is an explicit error; never fall back to mutable files.
  const sourceHash = async (sourcePath) => sourceMode === "baseline"
    ? sha256(execFileSync("git", ["show", `${contract.baselineCommit}:${sourcePath}`], { cwd: REPO_ROOT, maxBuffer: 2e6 }))
    : fileSha256(resolve(REPO_ROOT, sourcePath));
  const schemaSourceSha256 = await sourceHash(contract.schemaSourcePath);
  const generatorSourceSha256 = await sourceHash(contract.generatorSourcePath);
  const ownershipContractSha256 = await fileSha256(CONTRACT_PATH);

  const globalInputFindings = [];
  if (fixtureSha256 !== contract.expectedFixtureSha256) {
    globalInputFindings.push("fixture_sha256_mismatch");
  }
  if (schemaSourceSha256 !== contract.expectedSchemaSourceSha256) {
    globalInputFindings.push("schema_source_sha256_mismatch");
  }
  if (generatorSourceSha256 !== contract.expectedGeneratorSourceSha256) {
    globalInputFindings.push("generator_source_sha256_mismatch");
  }
  if (rows.length !== contract.expectedOrderCount) {
    globalInputFindings.push("order_count_mismatch");
  }
  if (
    duplicatedIdentities.length > 0 ||
    identities.some((identity) => !identity)
  ) {
    globalInputFindings.push("stable_identity_invalid");
  }

  const orders = rows
    .map((row) => {
      const orderId = identityFor(row);
      const fieldContracts = contract.fieldContracts[row.clinicalOrderType];
      const metadata = sourceMetadata.get(orderId) ?? {
        classificationPathKey:
          row.clinicalOrderType === "system_exam"
            ? "cm.path.system-exam.proposed"
            : null,
        speciesApplicability: [],
        speciesSource: null,
      };
      const fields = fieldContracts
        ? [
            ...fieldContracts.map((field) => fieldResult(row, field, contract)),
            ...extraFieldFindings(row, fieldContracts),
          ]
        : [
            {
              fieldKey: null,
              required: null,
              present: false,
              currentValue: null,
              currentPolicy: null,
              targetOwner: null,
              researchRequired: false,
              researchQuestion: null,
              acceptableSourceTypes: [],
              findingCode: "BLOCK_UNKNOWN_SCHEMA_FIELD",
              blocking: true,
              evidence: [
                "Clinical order type has no frozen ownership contract.",
              ],
              targetWorkPackage: "WP-00",
            },
          ];
      const formulaFinding = dispensingFormulaFinding(row);
      if (formulaFinding) fields.push(formulaFinding);

      const orderFindings = [];
      if (duplicatedIdentities.includes(orderId) || !orderId) {
        orderFindings.push({
          findingCode: "BLOCK_DUPLICATE_OR_FOREIGN_ROW",
          blocking: true,
          evidence: [
            "Stable identity is missing or duplicated in the frozen manifest.",
          ],
        });
      }
      const prohibitedStatus =
        contract.statusContract.prohibitedLifecycleStates.includes(
          row.presetStatus,
        );
      if (prohibitedStatus) {
        orderFindings.push({
          findingCode: "BLOCK_UNAVAILABLE_OR_CONFLATED_STATUS",
          blocking: true,
          evidence: [
            `legacy_preset_status=${row.presetStatus}`,
            "Availability, synthetic provenance, and clinical validation are not separate in fixture schema v1.",
          ],
        });
      }
      if (!row.masterKey) {
        orderFindings.push({
          findingCode: "BLOCK_NOT_PERSISTED",
          blocking: true,
          evidence: [
            "This system-exam row is proposal-only and is excluded from the 510 persisted master identities.",
          ],
        });
      }
      if (metadata.speciesApplicability.length === 0) {
        orderFindings.push({
          findingCode: "BLOCK_NOT_PERSISTED",
          blocking: true,
          evidence: ["Frozen source does not provide species applicability."],
        });
      }

      const blocking =
        fields.some((field) => field.blocking) ||
        orderFindings.some((finding) => finding.blocking);
      return {
        orderId,
        orderCode: row.presetKey ?? null,
        displayName: displayNameFor(row),
        clinicalOrderType: row.clinicalOrderType,
        category: row.clinicalOrderType,
        subcategory: metadata.classificationPathKey,
        speciesApplicability: metadata.speciesApplicability,
        speciesSource: metadata.speciesSource,
        sourceKind: row.masterKey
          ? "persisted_master_fixture"
          : "proposal_only",
        prototypeStatusDimensions: {
          current: {
            presetStatus: row.presetStatus ?? null,
            syntheticUnreviewed: row.syntheticUnreviewed ?? null,
            clinicalUseAllowed: row.clinicalUseAllowed ?? null,
          },
          target: contract.statusContract,
        },
        fields,
        orderFindings,
        blocking,
        targetWorkPackages: [
          ...new Set(
            [...fields.map((field) => field.targetWorkPackage), "WP-01B"]
              .filter(Boolean)
              .sort(),
          ),
        ],
      };
    })
    .sort((left, right) => left.orderId.localeCompare(right.orderId));

  const allFindings = orders.flatMap((order) => [
    ...order.fields.map((field) => field.findingCode),
    ...order.orderFindings.map((finding) => finding.findingCode),
  ]);
  const blockingOrders = orders.filter((order) => order.blocking);
  const reportWithoutFingerprint = {
    auditVersion: "clinical-master-order-semantic-audit/v1",
    baselineCommit: contract.baselineCommit,
    fixturePath: contract.fixturePath,
    fixtureSha256,
    schemaSourcePath: contract.schemaSourcePath,
    schemaSourceSha256,
    generatorSourcePath: contract.generatorSourcePath,
    generatorSourceSha256,
    ownershipContractVersion: contract.schemaVersion,
    ownershipContractSha256,
    generatedAt: new Date().toISOString(),
    totalOrderCount: orders.length,
    persistedMasterOrderCount: orders.filter(
      (order) => order.sourceKind === "persisted_master_fixture",
    ).length,
    proposalOnlyOrderCount: orders.filter(
      (order) => order.sourceKind === "proposal_only",
    ).length,
    categoryCounts: countBy(orders.map((order) => order.clinicalOrderType)),
    speciesScopeCounts: countBy(
      orders.map((order) =>
        order.speciesApplicability.length > 0
          ? [...order.speciesApplicability].sort().join("+")
          : "unresolved",
      ),
    ),
    passCount: orders.length - blockingOrders.length,
    blockingOrderCount: blockingOrders.length,
    findingCounts: countBy(allFindings),
    globalInputFindings,
    duplicatedIdentities,
    runtimeFallbackInspection: {
      verified: false,
      reason:
        "Runtime and Hospital Admin/chart projection inspection is owned by WP-01B and is intentionally outside this local fixture audit.",
      fallbackAllowed: false,
    },
    orders,
  };
  const report = {
    ...reportWithoutFingerprint,
    semanticFingerprint: sha256(
      canonicalize(semanticPayload(reportWithoutFingerprint)),
    ),
  };

  const manifestWithoutFingerprint = {
    schemaVersion: "clinical-master-order-frozen-manifest/v1",
    baselineCommit: contract.baselineCommit,
    fixturePath: contract.fixturePath,
    fixtureSha256,
    schemaSourcePath: contract.schemaSourcePath,
    schemaSourceSha256,
    generatorSourcePath: contract.generatorSourcePath,
    generatorSourceSha256,
    ownershipContractPath:
      "docs/work/clinical-master/order-execution-defaults/artifacts/wp-00-field-ownership.v1.json",
    ownershipContractSha256,
    totalOrderCount: orders.length,
    categoryCounts: countBy(orders.map((order) => order.clinicalOrderType)),
    entries: orders.map((order) => ({
      orderId: order.orderId,
      orderCode: order.orderCode,
      displayName: order.displayName,
      clinicalOrderType: order.clinicalOrderType,
      subcategory: order.subcategory,
      speciesApplicability: order.speciesApplicability,
      speciesSource: order.speciesSource,
      sourceKind: order.sourceKind,
    })),
  };
  const manifest = {
    ...manifestWithoutFingerprint,
    semanticFingerprint: sha256(canonicalize(manifestWithoutFingerprint)),
  };
  return { audit: report, manifest };
}

async function writeArtifacts(result) {
  await writeFile(AUDIT_PATH, `${JSON.stringify(result.audit, null, 2)}\n`);
  await writeFile(
    MANIFEST_PATH,
    `${JSON.stringify(result.manifest, null, 2)}\n`,
  );
}

async function checkArtifacts(result) {
  const checkedAudit = await readJson(AUDIT_PATH);
  const checkedManifest = await readJson(MANIFEST_PATH);
  if (checkedAudit.semanticFingerprint !== result.audit.semanticFingerprint) {
    throw new Error("semantic_audit_fingerprint_mismatch");
  }
  if (
    checkedManifest.semanticFingerprint !== result.manifest.semanticFingerprint
  ) {
    throw new Error("frozen_manifest_fingerprint_mismatch");
  }
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const sourceMode = args.has("--baseline") ? "baseline" : "worktree";
  if (sourceMode === "baseline" && args.has("--write")) throw new Error("historical_baseline_replay_is_read_only");
  const result = await buildAudit({ sourceMode });
  if (args.has("--write")) await writeArtifacts(result);
  if (args.has("--check")) await checkArtifacts(result);
  console.log(
    JSON.stringify({
      totalOrderCount: result.audit.totalOrderCount,
      passCount: result.audit.passCount,
      blockingOrderCount: result.audit.blockingOrderCount,
      semanticFingerprint: result.audit.semanticFingerprint,
      manifestFingerprint: result.manifest.semanticFingerprint,
      wrote: args.has("--write"),
      checked: args.has("--check"),
      sourceMode,
    }),
  );
  if (!args.has("--allow-blocking") && result.audit.blockingOrderCount > 0) {
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
