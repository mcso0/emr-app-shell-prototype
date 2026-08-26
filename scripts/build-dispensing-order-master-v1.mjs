#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spreadsheetSafeCsvCell } from "./lib/dispensing-order-artifact-safety.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const datasetDir = path.join(
  repoRoot,
  "docs/work/clinical-master/clinical-master-pr-017/datasets",
);
const inputPath = path.join(
  datasetDir,
  "dispensing-order-candidates-140.enriched.v1.json",
);
const outputJsonPath = path.join(datasetDir, "dispensing-order-master.v1.json");
const outputCsvPath = path.join(datasetDir, "dispensing-order-master.v1.csv");
const summaryPath = path.join(datasetDir, "dispensing-order-master.v1.summary.json");

const sourceRows = JSON.parse(await readFile(inputPath, "utf8"));

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizedToken(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function strengthToken(value) {
  const denominator = value.denominatorUnit
    ? `/${value.denominatorValue ?? 1}${normalizedToken(value.denominatorUnit)}`
    : "";
  return `${value.numeratorValue}${normalizedToken(value.numeratorUnit)}${denominator}`;
}

function canonicalKey(row) {
  return [
    [...row.normalizedActiveIngredients].map(normalizedToken).sort().join("+"),
    row.strengthExpressions.map(strengthToken).sort().join("+"),
    normalizedToken(row.dosageFormRaw),
    [...row.route].map(normalizedToken).sort().join("+"),
    [...row.targetSpecies].map(normalizedToken).sort().join("+"),
    "manufactured",
  ].join("|");
}

const finalRows = sourceRows
  .filter(
    (row) =>
      row.candidateStatus === "validated_candidate" &&
      row.qualityStatus === "pass_technical_evidence",
  )
  .map((row) => {
    const key = canonicalKey(row);
    const concentration = row.strengthExpressions.filter(
      (value) => value.denominatorUnit !== null,
    );
    const presentation = row.strengthExpressions.filter(
      (value) => value.denominatorUnit === null,
    );

    return {
      schemaVersion: "clair-dispensing-order-master-v1",
      datasetRevision: "2026-08-26.1",
      masterOrderId: `dispensing-v1-uk-vmd-${row.sourceProductId.toLowerCase()}`,
      canonicalOrderKey: key,
      canonicalOrderFingerprint: sha256(key),
      lifecycleStatus: "technical_validated_clinical_review_pending",
      clinicalReviewStatus: "pending",
      clinicalUseAllowed: false,
      clinicalOrderType: "dispensing",
      destination: "dispensing",
      display: {
        en: row.productNameEnglish,
        koDraft: row.productNameKorean,
        koStatus: "partial_ko_form_only__clinical_translation_review_pending",
      },
      product: {
        sourceProductId: row.sourceProductId,
        authorizationNumber: row.authorizationNumber,
        authorizationTerritory: row.authorizationTerritory,
        authorizationRoute: row.authorizationRoute,
        distributionCategory: row.distributionCategory,
        activeIngredientsRaw: row.activeIngredientsRaw,
        normalizedActiveIngredients: row.normalizedActiveIngredients,
        dosageForm: row.dosageFormRaw,
        route: row.route,
        targetSpecies: [...row.targetSpecies].sort(),
        therapeuticGroup: row.therapeuticGroupRaw,
        coverageCategory: row.coverageCategory,
        strength: {
          expressions: row.strengthExpressions,
          presentation,
          concentration,
          parseStatus: row.strengthParseStatus,
        },
        atcVetCode: row.atcVetCode,
        manufactured: true,
        compounded: false,
      },
      orderDefaults: {
        dose: null,
        frequency: null,
        duration: null,
        quantity: null,
        repeats: null,
        instructions: null,
        nullReason: "named_veterinary_clinical_review_required",
      },
      handling: {
        packagedShelfLife: row.shelfLifePackaged,
        shelfLifeAfterOpening: row.shelfLifeAfterOpening,
        beyondUseDateRule: null,
        beyondUseDateStatus: "not_applicable_to_manufactured_product_master",
        storageCodes: row.storageCodes,
        extractionStatus: "direct_spc_text__clinical_review_pending",
      },
      safetyReviewSignals: {
        safetyFlags: row.safetyFlags,
        monitoringFlags: row.monitoringFlags,
        interactionReviewRequired: row.interactionReviewRequired,
        extractionMode: "keyword_signal_only",
        intendedUse: "review_queue_routing_only",
        clinicalDecisionSupportAllowed: false,
      },
      regulatory: {
        sourceJurisdiction: row.sourceJurisdiction,
        koreanAuthorizationStatus: "not_verified",
        koreanControlledSubstanceStatus: "not_screened",
        extraLabelStatus: row.extraLabelStatus,
      },
      evidence: {
        authority: row.sourceAuthority,
        sourceSnapshotAccessedAt: row.sourceSnapshotAccessedAt,
        spcUrl: row.spcUrl,
        spcDocumentSha256: row.spcDocumentSha256,
        spcPageCount: row.spcPageCount,
        spcRevisionRaw: row.spcRevisionRaw,
        routeEvidenceMode: row.routeEvidenceMode,
        targetSpecies: row.targetSpeciesEvidence,
        indication: row.indicationEvidence,
        contraindication: row.contraindicationEvidence,
        warning: row.warningEvidence,
        storage: row.storageEvidence,
      },
      activationBlockReasons: [
        "named_veterinary_clinical_review_missing",
        "korean_authorization_not_verified",
        "korean_controlled_substance_screening_missing",
        "korean_display_translation_review_missing",
      ],
      quality: {
        status: row.qualityStatus,
        candidateId: row.candidateId,
        candidateDatasetRevision: row.datasetRevision,
        sourceFieldsDirect: row.sourceFieldsDirect,
        noDoseOrBudInferred: true,
      },
    };
  })
  .sort((a, b) => a.masterOrderId.localeCompare(b.masterOrderId));

const jsonText = `${JSON.stringify(finalRows, null, 2)}\n`;

const csvColumns = [
  "masterOrderId",
  "displayEn",
  "displayKoDraft",
  "activeIngredients",
  "strength",
  "dosageForm",
  "route",
  "targetSpecies",
  "coverageCategory",
  "atcVetCode",
  "sourceProductId",
  "spcUrl",
  "lifecycleStatus",
  "clinicalUseAllowed",
  "canonicalOrderFingerprint",
];
const csvRows = finalRows.map((row) => [
  row.masterOrderId,
  row.display.en,
  row.display.koDraft,
  row.product.normalizedActiveIngredients,
  row.product.strength.expressions.map(strengthToken),
  row.product.dosageForm,
  row.product.route,
  row.product.targetSpecies,
  row.product.coverageCategory,
  row.product.atcVetCode,
  row.product.sourceProductId,
  row.evidence.spcUrl,
  row.lifecycleStatus,
  row.clinicalUseAllowed,
  row.canonicalOrderFingerprint,
]);
const csvText = [csvColumns, ...csvRows]
  .map((row) => row.map(spreadsheetSafeCsvCell).join(","))
  .join("\n") + "\n";

const countBy = (values) =>
  Object.fromEntries(
    [...values.reduce((counts, value) => counts.set(value, (counts.get(value) ?? 0) + 1), new Map())]
      .sort(([a], [b]) => a.localeCompare(b)),
  );

const summary = {
  schemaVersion: "clair-dispensing-order-master-summary-v1",
  generatedAt: "2026-08-26",
  inputCandidateCount: sourceRows.length,
  finalTechnicalValidatedCount: finalRows.length,
  excludedCounts: countBy(
    sourceRows
      .filter((row) => row.candidateStatus !== "validated_candidate")
      .map((row) => row.candidateStatus),
  ),
  uniqueMasterOrderIdCount: new Set(finalRows.map((row) => row.masterOrderId)).size,
  uniqueCanonicalOrderKeyCount: new Set(finalRows.map((row) => row.canonicalOrderKey)).size,
  uniqueSourceProductIdCount: new Set(
    finalRows.map((row) => row.product.sourceProductId),
  ).size,
  clinicalUseAllowedCount: finalRows.filter((row) => row.clinicalUseAllowed).length,
  categories: countBy(finalRows.map((row) => row.product.coverageCategory)),
  forms: countBy(finalRows.map((row) => row.product.dosageForm)),
  routes: countBy(finalRows.flatMap((row) => row.product.route)),
  species: countBy(finalRows.flatMap((row) => row.product.targetSpecies)),
  sourceJurisdictions: countBy(
    finalRows.map((row) => row.regulatory.sourceJurisdiction),
  ),
  jsonSha256: sha256(jsonText),
  csvSha256: sha256(csvText),
};

await Promise.all([
  writeFile(outputJsonPath, jsonText),
  writeFile(outputCsvPath, csvText),
  writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`),
]);

console.log(JSON.stringify(summary, null, 2));
