#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "..");
const ARTIFACT_DIR = resolve(
  REPO_ROOT,
  "docs/work/clinical-master/order-execution-defaults/artifacts",
);
const MANIFEST_PATH = resolve(ARTIFACT_DIR, "wp-00-frozen-manifest.v1.json");
const AUDIT_PATH = resolve(ARTIFACT_DIR, "wp-00-semantic-audit.v1.json");
const LEDGER_PATH = resolve(ARTIFACT_DIR, "wp-01a-source-ledger.v1.json");
const PROFILES_PATH = resolve(ARTIFACT_DIR, "wp-01a-research-profiles.v1.json");
const OUTPUT_PATH = resolve(
  ARTIFACT_DIR,
  "wp-01a-order-default-candidates.non-applied.v1.json",
);

function canonicalize(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
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

function profileKeyFor(order) {
  if (order.clinicalOrderType === "dispensing") {
    return order.orderId.startsWith("cm.order.dispensing-v1-uk-vmd-")
      ? "dispensing.product-specific.v1"
      : "dispensing.generic-unresolved.v1";
  }
  return {
    consultation: "consultation.general.v1",
    clinical_lab: "laboratory.order-result-graph.v1",
    external_lab: "laboratory.order-result-graph.v1",
    treatment: "treatment.planned-actual-split.v1",
    imaging: "imaging.study-protocol.v1",
    hospitalization: "hospitalization.care-plan.v1",
    system_exam: "system-exam.structured-result.v1",
    other: "other.typed-work-output.v1",
  }[order.clinicalOrderType];
}

function actionFor(field) {
  if (field.findingCode === "BLOCK_INVALID_UNIT_OR_FORMULA") {
    return "unresolved_formula_or_unit";
  }
  if (field.findingCode === "BLOCK_MISSING_MASTER_DEFAULT") {
    return "unresolved_reusable_default";
  }
  if (field.findingCode === "BLOCK_MISSING_RESOLVER") {
    return "unresolved_fail_closed_resolver";
  }
  if (field.findingCode === "BLOCK_MISOWNED_FIELD") {
    return field.targetOwner === "actual_result"
      ? "remove_from_plan_prefill_and_move_to_actual_result"
      : "correct_field_ownership";
  }
  if (field.findingCode === "BLOCK_NOT_PERSISTED") {
    return "persist_before_application";
  }
  if (field.targetOwner === "actual_result")
    return "retain_in_actual_result_layer";
  if (field.targetOwner === "encounter_input")
    return "retain_as_encounter_input";
  if (field.targetOwner?.endsWith("resolver"))
    return "retain_fail_closed_resolver";
  if (field.findingCode === "PASS_NOT_APPLICABLE")
    return "retain_explicit_not_applicable";
  return "retain_as_non_applied_candidate_default";
}

function evidenceClassForField(field, order) {
  if (field.blocking) return "unresolved";
  if (
    [
      "actual_result",
      "encounter_input",
      "runtime_resolver",
      "workspace_resolver",
    ].includes(field.targetOwner)
  ) {
    return "derived_source";
  }
  if (order.clinicalOrderType === "dispensing") return "derived_source";
  return "synthetic_assumption";
}

function candidateMasterValues(order) {
  const values = {};
  const policies = {};
  const rejectedKeys = new Set(
    order.fields
      .filter((field) => field.findingCode === "BLOCK_INVALID_UNIT_OR_FORMULA")
      .map((field) => field.fieldKey),
  );
  for (const field of order.fields) {
    if (!["master_default", "schema_default"].includes(field.targetOwner))
      continue;
    if (rejectedKeys.has(field.fieldKey)) continue;
    if (field.currentValue !== null && field.currentValue !== undefined) {
      values[field.fieldKey] = field.currentValue;
    }
    if (
      field.currentPolicy &&
      !["BLOCK_MISSING_MASTER_DEFAULT", "BLOCK_MISOWNED_FIELD"].includes(
        field.findingCode,
      )
    ) {
      policies[field.fieldKey] = field.currentPolicy;
    }
  }
  return {
    values,
    policies,
    source:
      "current fixture values retained only where the WP-00 field audit did not reject them",
  };
}

function contentDisposition(order, profile) {
  const blockingFieldFindings = order.fields.filter((field) => field.blocking);
  if (
    profile.candidateDisposition === "unresolved_blocking" ||
    blockingFieldFindings.length > 0 ||
    order.sourceKind === "proposal_only" ||
    order.subcategory?.toLowerCase().includes("fallback")
  ) {
    return "unresolved_blocking";
  }
  return profile.candidateDisposition;
}

function evidenceFor(profile, claimsById) {
  const claimIds = profile.sourceClaimIds ?? [];
  const sourceIds = new Set(profile.sourceIds ?? []);
  for (const claimId of claimIds) {
    const claim = claimsById.get(claimId);
    if (!claim) throw new Error(`unknown_claim_reference:${claimId}`);
    for (const sourceId of claim.sourceIds) sourceIds.add(sourceId);
  }
  return {
    claimIds,
    sourceIds: [...sourceIds].sort(),
  };
}

function unresolvedFor(order, profile) {
  const findings = order.fields
    .filter((field) => field.blocking)
    .map((field) => ({
      code: field.findingCode,
      fieldKey: field.fieldKey,
      evidence: field.evidence,
      targetWorkPackage: field.targetWorkPackage,
    }));
  for (const finding of order.orderFindings) {
    if (finding.findingCode === "BLOCK_UNAVAILABLE_OR_CONFLATED_STATUS")
      continue;
    findings.push({
      code: finding.findingCode,
      fieldKey: null,
      evidence: finding.evidence,
      targetWorkPackage: "WP-01A",
    });
  }
  if (order.subcategory?.toLowerCase().includes("fallback")) {
    findings.push({
      code: "BLOCK_LEGACY_FALLBACK_CLASSIFICATION_KEY",
      fieldKey: "subcategory",
      evidence: [order.subcategory],
      targetWorkPackage: "WP-01B",
    });
  }
  return {
    gapIds: profile.gapIds ?? [],
    findings,
  };
}

export async function buildCandidates() {
  const [manifest, audit, ledger, profiles] = await Promise.all([
    readJson(MANIFEST_PATH),
    readJson(AUDIT_PATH),
    readJson(LEDGER_PATH),
    readJson(PROFILES_PATH),
  ]);
  const auditById = new Map(
    audit.orders.map((order) => [order.orderId, order]),
  );
  const claimsById = new Map(
    ledger.claims.map((claim) => [claim.claimId, claim]),
  );
  const sourcesById = new Map(
    ledger.sources.map((source) => [source.sourceId, source]),
  );

  if (manifest.totalOrderCount !== 522 || manifest.entries.length !== 522) {
    throw new Error("frozen_manifest_count_mismatch");
  }
  if (new Set(manifest.entries.map((entry) => entry.orderId)).size !== 522) {
    throw new Error("frozen_manifest_identity_mismatch");
  }

  const candidates = manifest.entries.map((manifestEntry) => {
    const order = auditById.get(manifestEntry.orderId);
    if (!order) throw new Error(`audit_order_missing:${manifestEntry.orderId}`);
    const profileRef = profileKeyFor(order);
    const profile = profiles.profiles[profileRef];
    if (!profile) throw new Error(`profile_missing:${profileRef}`);
    const evidence = evidenceFor(profile, claimsById);
    for (const sourceId of evidence.sourceIds) {
      if (!sourcesById.has(sourceId))
        throw new Error(`unknown_source_reference:${sourceId}`);
    }
    const unresolved = unresolvedFor(order, profile);
    const disposition = contentDisposition(order, profile);
    const evidenceClasses =
      disposition === "unresolved_blocking"
        ? ["unresolved"]
        : order.clinicalOrderType === "dispensing"
          ? ["direct_source", "derived_source"]
          : ["synthetic_assumption"];
    const candidateWithoutFingerprint = {
      orderId: order.orderId,
      orderCode: order.orderCode,
      displayName: order.displayName,
      clinicalOrderType: order.clinicalOrderType,
      subcategory: order.subcategory,
      speciesApplicability: order.speciesApplicability,
      speciesSource: order.speciesSource,
      sourceKind: order.sourceKind,
      artifactState: "non_applied_candidate",
      applicationAllowed: false,
      contentDisposition: disposition,
      targetStatus: profiles.statusContract,
      profileRef,
      profileRevision: profiles.profileRevision,
      evidence: {
        ...evidence,
        evidenceClasses,
        clinicalAuthority: false,
      },
      proposedMasterDefaults: candidateMasterValues(order),
      workContractRef: {
        path: "docs/work/clinical-master/order-execution-defaults/artifacts/wp-01a-research-profiles.v1.json",
        profileRef,
        profileSemanticFingerprint: sha256(canonicalize(profile)),
      },
      fieldAssessments: order.fields.map((field) => ({
        fieldKey: field.fieldKey,
        required: field.required,
        currentValue: field.currentValue,
        currentPolicy: field.currentPolicy,
        targetOwner: field.targetOwner,
        findingCode: field.findingCode,
        evidenceClass: evidenceClassForField(field, order),
        evidenceRef: "candidate.evidence",
        action: actionFor(field),
        targetWorkPackage: field.targetWorkPackage,
      })),
      unresolved,
      applicationBlockerCodes: [
        "STATUS_DIMENSIONS_NOT_IMPLEMENTED",
        "PRODUCT_AND_DOWNSTREAM_GATES_NOT_ACCEPTED",
        ...(disposition === "unresolved_blocking"
          ? ["CONTENT_OWNERSHIP_PERSISTENCE_OR_RESOLVER_GAP"]
          : []),
      ],
      targetWorkPackages: order.targetWorkPackages,
    };
    return {
      ...candidateWithoutFingerprint,
      semanticFingerprint: sha256(canonicalize(candidateWithoutFingerprint)),
    };
  });

  const sourceLedgerSha256 = await fileSha256(LEDGER_PATH);
  const researchProfilesSha256 = await fileSha256(PROFILES_PATH);
  const resultWithoutFingerprint = {
    schemaVersion: "clinical-master-order-default-candidates/v1",
    artifactState: "non_applied_candidate_package",
    applicationAllowed: false,
    runtimeImportAllowed: false,
    baselineCommit: audit.baselineCommit,
    frozenManifestFingerprint: manifest.semanticFingerprint,
    semanticAuditFingerprint: audit.semanticFingerprint,
    sourceLedgerPath:
      "docs/work/clinical-master/order-execution-defaults/artifacts/wp-01a-source-ledger.v1.json",
    sourceLedgerSha256,
    researchProfilesPath:
      "docs/work/clinical-master/order-execution-defaults/artifacts/wp-01a-research-profiles.v1.json",
    researchProfilesSha256,
    targetStatus: profiles.statusContract,
    totalOrderCount: candidates.length,
    categoryCounts: countBy(
      candidates.map((candidate) => candidate.clinicalOrderType),
    ),
    contentDispositionCounts: countBy(
      candidates.map((candidate) => candidate.contentDisposition),
    ),
    categoryDispositionCounts: Object.fromEntries(
      Object.entries(
        candidates.reduce((summary, candidate) => {
          summary[candidate.clinicalOrderType] ??= [];
          summary[candidate.clinicalOrderType].push(
            candidate.contentDisposition,
          );
          return summary;
        }, {}),
      )
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([category, dispositions]) => [category, countBy(dispositions)]),
    ),
    unresolvedOrderCount: candidates.filter(
      (candidate) => candidate.contentDisposition === "unresolved_blocking",
    ).length,
    candidates,
  };
  return {
    ...resultWithoutFingerprint,
    semanticFingerprint: sha256(canonicalize(resultWithoutFingerprint)),
  };
}

async function writeArtifact(result) {
  await writeFile(OUTPUT_PATH, `${JSON.stringify(result, null, 2)}\n`);
}

async function checkArtifact(result) {
  const checked = await readJson(OUTPUT_PATH);
  if (checked.semanticFingerprint !== result.semanticFingerprint) {
    throw new Error("candidate_semantic_fingerprint_mismatch");
  }
  if (canonicalize(checked) !== canonicalize(result)) {
    throw new Error("candidate_artifact_content_mismatch");
  }
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const result = await buildCandidates();
  if (args.has("--write")) await writeArtifact(result);
  if (args.has("--check")) await checkArtifact(result);
  console.log(
    JSON.stringify({
      totalOrderCount: result.totalOrderCount,
      contentDispositionCounts: result.contentDispositionCounts,
      semanticFingerprint: result.semanticFingerprint,
      wrote: args.has("--write"),
      checked: args.has("--check"),
    }),
  );
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
