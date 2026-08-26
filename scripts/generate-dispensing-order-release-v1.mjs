#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const datasetPath = path.join(
  repoRoot,
  "docs/work/clinical-master/clinical-master-pr-017/datasets/dispensing-order-master.v1.json",
);
const operationalFixturePath = path.join(
  repoRoot,
  "tests/fixtures/clinical-master-operational-v4-adapter-output.json",
);
const artifactDir = path.join(
  repoRoot,
  "docs/work/clinical-master/clinical-master-pr-017/supabase",
);
const payloadPath = path.join(artifactDir, "dispensing-order-release-payload.v1.json");
const summaryPath = path.join(artifactDir, "dispensing-order-release-summary.v1.json");

const [datasetBytes, operationalFixtureBytes] = await Promise.all([
  readFile(datasetPath),
  readFile(operationalFixturePath),
]);
const rows = JSON.parse(datasetBytes.toString("utf8"));
const operationalFixture = JSON.parse(operationalFixtureBytes.toString("utf8"));
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const canonicalize = (value) => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
};
const canonicalJson = (value) => JSON.stringify(canonicalize(value));
const stableUuid = (key) => {
  const bytes = createHash("sha256")
    .update(`clair-dispensing-order-master-v1:${key}`)
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

const sourceDatasetSha256 = sha256(datasetBytes);
const ingredientsByKey = new Map();
const evidenceDocuments = [];
const products = [];
const productIngredients = [];
const speciesApplicability = [];
const productHandling = [];
const dispensingProfiles = [];
const evidenceAssertions = [];
const clinicalReviews = [];
const regulatoryProfiles = [];
const genericRecords = [];

const structuralDependencyKeys = [
  "cm.action.dispensing",
  "cm.order-category.t.medication",
  "cm.order-category.x.clinical",
  "cm.unit.case",
  "phase1a2.fallback.chart.CG_MEDICATION_SUPPLY",
  "phase1a2.fallback.route.NT_DISPENSING",
  "phase1a2.fallback.species.cat",
  "phase1a2.fallback.species.dog",
];
const structuralDependencyKeySet = new Set(structuralDependencyKeys);
const structuralDependencyRecords = operationalFixture.payload.records.filter((record) =>
  structuralDependencyKeySet.has(record.masterKey),
);
const dispensingClassificationPath = operationalFixture.payload.classificationPaths.find(
  (classificationPath) => classificationPath.pathKey === "cm.path.dispensing",
);

if (
  structuralDependencyRecords.length !== structuralDependencyKeys.length ||
  !dispensingClassificationPath
) {
  throw new Error("dispensing structural dependencies are incomplete in the V4 fixture");
}

for (const row of rows) {
  const sourceProductId = row.product.sourceProductId;
  const productKey = `product:${sourceProductId.toLowerCase()}`;
  const productId = stableUuid(productKey);
  const evidenceKey = `evidence:${row.evidence.spcDocumentSha256}`;
  const evidenceDocumentId = stableUuid(evidenceKey);
  const profileKey = `profile:${row.masterOrderId}`;
  const profileId = stableUuid(profileKey);
  const orderMasterKey = `cm.order.${row.masterOrderId}`;

  evidenceDocuments.push({
    id: evidenceDocumentId,
    documentKey: evidenceKey,
    revision: 1,
    authority: row.evidence.authority,
    jurisdiction: row.regulatory.sourceJurisdiction,
    documentType: "spc",
    sourceUri: row.evidence.spcUrl,
    contentSha256: row.evidence.spcDocumentSha256,
    pageCount: row.evidence.spcPageCount,
    sourceRevision: row.evidence.spcRevisionRaw,
    accessedAt: row.evidence.sourceSnapshotAccessedAt,
    lifecycleStatus: "captured",
  });

  products.push({
    id: productId,
    productKey,
    revision: 1,
    authority: row.evidence.authority,
    sourceJurisdiction: row.regulatory.sourceJurisdiction,
    sourceProductId,
    authorizationNumber: row.product.authorizationNumber,
    authorizationTerritory: row.product.authorizationTerritory,
    distributionCategory: row.product.distributionCategory,
    englishProductName: row.display.en,
    koreanDraftName: row.display.koDraft,
    koreanReviewStatus: "pending",
    dosageForm: row.product.dosageForm,
    routes: row.product.route,
    strengthSnapshot: row.product.strength.expressions,
    atcVetCode: row.product.atcVetCode,
    coverageCategory: row.product.coverageCategory,
    manufactured: true,
    compounded: false,
    lifecycleStatus: "clinical_review_pending",
  });

  const directPairing =
    row.product.normalizedActiveIngredients.length ===
    row.product.strength.expressions.length;
  row.product.normalizedActiveIngredients.forEach((ingredientName, index) => {
    const ingredientKey = `ingredient:${ingredientName.toLowerCase()}`;
    const ingredientId = stableUuid(ingredientKey);
    ingredientsByKey.set(ingredientKey, {
      id: ingredientId,
      ingredientKey,
      revision: 1,
      normalizedEnglishName: ingredientName,
      koreanName: null,
      koreanReviewStatus: "pending",
      lifecycleStatus: "clinical_review_pending",
    });
    const strength = directPairing ? row.product.strength.expressions[index] : null;
    productIngredients.push({
      productId,
      productRevision: 1,
      ingredientId,
      ingredientRevision: 1,
      ordinal: index + 1,
      strengthKind: !strength
        ? "unpaired"
        : strength.denominatorUnit
          ? "concentration"
          : "presentation",
      numeratorValue: strength?.numeratorValue ?? null,
      numeratorUnit: strength?.numeratorUnit ?? null,
      denominatorValue: strength?.denominatorValue ?? null,
      denominatorUnit: strength?.denominatorUnit ?? null,
      evidenceMode: strength ? "direct" : "not_found",
      pairingStatus: directPairing
        ? "ordinal_direct_pending_review"
        : "manual_review_required",
    });
  });

  for (const speciesCode of row.product.targetSpecies) {
    speciesApplicability.push({
      productId,
      productRevision: 1,
      speciesCode,
      evidenceMode: row.evidence.targetSpecies.status,
      reviewStatus: "pending",
    });
  }

  productHandling.push({
    productId,
    productRevision: 1,
    packagedShelfLifeValue: row.handling.packagedShelfLife?.value ?? null,
    packagedShelfLifeUnit: row.handling.packagedShelfLife?.unit ?? null,
    openedShelfLifeValue: row.handling.shelfLifeAfterOpening?.value ?? null,
    openedShelfLifeUnit: row.handling.shelfLifeAfterOpening?.unit ?? null,
    storageCodes: row.handling.storageCodes,
    beyondUseDateRule: null,
    extractionStatus: "direct_spc_text_clinical_review_pending",
  });

  const assertionDefinitions = [
    ["product.identity", "direct", "VMD product database row and SPC document"],
    ["product.strength", "direct", "Official product name"],
    ["product.dosageForm", "direct", "VMD pharmaceutical form"],
    ["product.route", "direct", row.evidence.routeEvidenceMode],
    ["product.targetSpecies", row.evidence.targetSpecies.status, row.evidence.targetSpecies.locator],
    ["handling.storage", row.evidence.storage.status, row.evidence.storage.locator],
  ];
  for (const [fieldPath, evidenceMode, locator] of assertionDefinitions) {
    const assertionKey = `assertion:${sourceProductId}:${fieldPath}`;
    evidenceAssertions.push({
      id: stableUuid(assertionKey),
      assertionKey,
      productId,
      productRevision: 1,
      fieldPath,
      evidenceDocumentId,
      evidenceDocumentRevision: 1,
      evidenceMode,
      locator: locator ?? "not_found",
      extractionStatus: "clinical_review_pending",
    });
  }

  const evidenceFingerprint = sha256(
    canonicalJson({
      canonicalOrderFingerprint: row.canonicalOrderFingerprint,
      evidenceDocumentSha256: row.evidence.spcDocumentSha256,
      assertions: assertionDefinitions,
    }),
  );
  dispensingProfiles.push({
    id: profileId,
    profileKey,
    profileRevision: 1,
    orderMasterKey,
    productId,
    productRevision: 1,
    allowedRoutes: row.product.route,
    prescriptionDefaultStatus: "none",
    prescriptionDefaults: null,
    koreanTranslationReviewStatus: "pending",
    evidenceFingerprint,
    lifecycleStatus: "clinical_review_pending",
  });

  const reviewKey = `review:${row.masterOrderId}:1`;
  clinicalReviews.push({
    id: stableUuid(reviewKey),
    reviewKey,
    dispensingProfileId: profileId,
    dispensingProfileRevision: 1,
    decision: "pending",
    reviewerUserId: null,
    reviewerEligibility: {},
    decisionReason: "Named eligible veterinarian review required",
    reviewedAt: null,
    supersedesReviewId: null,
  });

  const regulatoryKey = `regulatory:${sourceProductId}:KR`;
  regulatoryProfiles.push({
    id: stableUuid(regulatoryKey),
    regulatoryKey,
    revision: 1,
    productId,
    productRevision: 1,
    jurisdiction: "KR",
    authorizationStatus: "not_verified",
    controlledStatus: "not_screened",
    policyVersion: null,
    reviewStatus: "pending",
    reviewerUserId: null,
    reviewedAt: null,
  });

  genericRecords.push({
    masterKey: orderMasterKey,
    recordType: "order",
    lifecycleStatus: "published",
    safetyStatus: "normal",
    safetyReason: null,
    names: [
      {
        languageCode: "en",
        nameKind: "preferred",
        name: row.display.en,
        searchable: true,
        sortOrder: 0,
      },
    ],
    source: {
      sourceType: "official",
      title: `${row.evidence.authority} SPC`,
      referenceUri: row.evidence.spcUrl,
      sourceVersion: row.evidence.spcRevisionRaw,
      accessedAt: row.evidence.sourceSnapshotAccessedAt,
      licenseNotes: "Official source captured for technical master review; not clinical authorization.",
    },
    detail: {
      classificationPathKey: "cm.path.dispensing",
      defaultSalesUnitCode: "case",
      defaultBillingReflectionEnabled: true,
      defaultQuantity: 1,
      species: row.product.targetSpecies,
    },
  });
}

const byKey = (key) => (a, b) => String(a[key]).localeCompare(String(b[key]));
const payloadWithoutHash = {
  schemaVersion: 1,
  datasetRevision: rows[0]?.datasetRevision,
  sourceDatasetSha256,
  recordCount: rows.length,
  clinicalUseAllowed: false,
  genericReleasePayload: {
    releaseKey: `cm.release.dispensing.v1.${rows[0]?.datasetRevision}`,
    releaseNotes: "Evidence-grounded dispensing technical master; all clinical, translation, and KR regulatory gates remain pending.",
    publishedByLabel: "CLINICAL-MASTER-PR-017 approved publisher",
    adoptionScope: "payload",
    records: [...structuralDependencyRecords, ...genericRecords].sort(byKey("masterKey")),
    classificationPaths: [dispensingClassificationPath],
    labPanelItems: [],
    labOrderProfiles: [],
  },
  ingredients: [...ingredientsByKey.values()].sort(byKey("ingredientKey")),
  evidenceDocuments: evidenceDocuments.sort(byKey("documentKey")),
  products: products.sort(byKey("productKey")),
  productIngredients: productIngredients.sort((a, b) =>
    a.productId.localeCompare(b.productId) || a.ordinal - b.ordinal,
  ),
  speciesApplicability: speciesApplicability.sort((a, b) =>
    a.productId.localeCompare(b.productId) || a.speciesCode.localeCompare(b.speciesCode),
  ),
  productHandling: productHandling.sort(byKey("productId")),
  dispensingProfiles: dispensingProfiles.sort(byKey("profileKey")),
  evidenceAssertions: evidenceAssertions.sort(byKey("assertionKey")),
  clinicalReviews: clinicalReviews.sort(byKey("reviewKey")),
  regulatoryProfiles: regulatoryProfiles.sort(byKey("regulatoryKey")),
};
const payloadSha256 = sha256(canonicalJson(payloadWithoutHash));
const payload = { ...payloadWithoutHash, payloadSha256 };
const payloadText = `${JSON.stringify(payload, null, 2)}\n`;
const counts = Object.fromEntries(
  [
    "ingredients",
    "evidenceDocuments",
    "products",
    "productIngredients",
    "speciesApplicability",
    "productHandling",
    "dispensingProfiles",
    "evidenceAssertions",
    "clinicalReviews",
    "regulatoryProfiles",
  ].map((key) => [key, payload[key].length]),
);
const summary = {
  schemaVersion: "clair-dispensing-release-summary-v1",
  datasetRevision: payload.datasetRevision,
  sourceDatasetSha256,
  payloadSha256,
  payloadFileSha256: sha256(payloadText),
  recordCount: payload.recordCount,
  genericOrderCount: payload.genericReleasePayload.records.filter(
    (record) => record.recordType === "order",
  ).length,
  genericDependencyCount: payload.genericReleasePayload.records.filter(
    (record) => record.recordType !== "order",
  ).length,
  classificationPathCount: payload.genericReleasePayload.classificationPaths.length,
  counts,
  clinicalUseAllowedCount: 0,
  approvedClinicalReviewCount: 0,
  approvedRegulatoryProfileCount: 0,
  approvedKoreanTranslationCount: 0,
};

if (
  payload.recordCount < 100 ||
  summary.genericOrderCount !== payload.recordCount ||
  summary.genericDependencyCount !== structuralDependencyKeys.length ||
  summary.classificationPathCount !== 1 ||
  payload.products.length !== payload.recordCount ||
  payload.dispensingProfiles.length !== payload.recordCount ||
  payload.clinicalReviews.some((review) => review.decision !== "pending") ||
  payload.regulatoryProfiles.some((profile) => profile.reviewStatus !== "pending") ||
  payload.dispensingProfiles.some(
    (profile) =>
      profile.lifecycleStatus !== "clinical_review_pending" ||
      profile.prescriptionDefaults !== null,
  )
) {
  throw new Error(`dispensing release payload invariant failed: ${JSON.stringify(summary)}`);
}

await mkdir(artifactDir, { recursive: true });
await Promise.all([
  writeFile(payloadPath, payloadText),
  writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`),
]);
console.log(JSON.stringify(summary, null, 2));
