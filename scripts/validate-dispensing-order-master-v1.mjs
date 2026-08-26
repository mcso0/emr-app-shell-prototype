#!/usr/bin/env node

import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  isDisallowedNetworkAddress,
  normalizeOfficialVmdSourceUrl,
} from "./lib/dispensing-order-artifact-safety.mjs";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const datasetDir = path.join(
  repoRoot,
  "docs/work/clinical-master/clinical-master-pr-017/datasets",
);
const candidates = JSON.parse(
  await readFile(
    path.join(datasetDir, "dispensing-order-candidates-140.enriched.v1.json"),
    "utf8",
  ),
);
const finalText = await readFile(
  path.join(datasetDir, "dispensing-order-master.v1.json"),
  "utf8",
);
const rows = JSON.parse(finalText);
const summary = JSON.parse(
  await readFile(
    path.join(datasetDir, "dispensing-order-master.v1.summary.json"),
    "utf8",
  ),
);
const releaseDir = path.join(
  repoRoot,
  "docs/work/clinical-master/clinical-master-pr-017/supabase",
);
const releasePayloadText = await readFile(
  path.join(releaseDir, "dispensing-order-release-payload.v1.json"),
  "utf8",
);
const releasePayload = JSON.parse(releasePayloadText);
const releaseSummary = JSON.parse(
  await readFile(
    path.join(releaseDir, "dispensing-order-release-summary.v1.json"),
    "utf8",
  ),
);

const errors = [];
const checkSourceLinks = process.argv.includes("--check-source-links");
const assert = (condition, message) => {
  if (!condition) errors.push(message);
};
const duplicateValues = (values) => [
  ...new Set(values.filter((value, index) => values.indexOf(value) !== index)),
];
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

const checkSourceUrl = async (url) => {
  const request = async (method) => {
    let currentUrl = normalizeOfficialVmdSourceUrl(url);
    for (let redirectCount = 0; redirectCount <= 5; redirectCount += 1) {
      const parsed = new URL(currentUrl);
      const addresses = await lookup(parsed.hostname, {
        all: true,
        verbatim: true,
      });
      if (
        addresses.length === 0 ||
        addresses.some(({ address }) => isDisallowedNetworkAddress(address))
      ) {
        throw new Error("source_url_resolves_to_disallowed_address");
      }

      const response = await fetch(currentUrl, {
        headers: {
          Accept: "application/pdf,*/*;q=0.8",
          ...(method === "GET" ? { Range: "bytes=0-0" } : {}),
          "User-Agent": "CLAiR-clinical-master-source-validator/1.0",
        },
        method,
        redirect: "manual",
        signal: AbortSignal.timeout(15_000),
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        await response.body?.cancel();
        if (!location) throw new Error("source_redirect_location_missing");
        currentUrl = normalizeOfficialVmdSourceUrl(
          new URL(location, currentUrl).href,
        );
        continue;
      }
      await response.body?.cancel();
      return {
        contentType: response.headers.get("content-type"),
        finalUrl: currentUrl,
        ok: response.ok,
        status: response.status,
      };
    }
    throw new Error("source_redirect_limit_exceeded");
  };

  try {
    const head = await request("HEAD");
    if (head.ok) return { ...head, url };
    const get = await request("GET");
    return { ...get, url };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
      ok: false,
      url,
    };
  }
};

const checkSourceUrls = async (urls, concurrency = 6) => {
  const results = [];
  let cursor = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, urls.length) },
    async () => {
      while (cursor < urls.length) {
        const index = cursor;
        cursor += 1;
        results[index] = await checkSourceUrl(urls[index]);
      }
    },
  );
  await Promise.all(workers);
  return results;
};

assert(
  candidates.length >= 120,
  `candidate count ${candidates.length} is below 120`,
);
assert(rows.length >= 100, `final count ${rows.length} is below 100`);
assert(
  rows.length === summary.finalTechnicalValidatedCount,
  "summary final count does not match dataset",
);

for (const [index, row] of rows.entries()) {
  const label = `row ${index + 1} (${row.masterOrderId ?? "missing-id"})`;
  assert(
    row.schemaVersion === "clair-dispensing-order-master-v1",
    `${label}: invalid schema`,
  );
  assert(row.masterOrderId, `${label}: masterOrderId missing`);
  assert(row.canonicalOrderKey, `${label}: canonicalOrderKey missing`);
  assert(row.display?.en, `${label}: English display name missing`);
  assert(row.display?.koDraft, `${label}: Korean draft display name missing`);
  assert(
    row.display?.koStatus ===
      "partial_ko_form_only__clinical_translation_review_pending",
    `${label}: Korean display review status is not pending`,
  );
  assert(
    row.product?.normalizedActiveIngredients?.length > 0,
    `${label}: ingredient missing`,
  );
  assert(
    row.product?.strength?.expressions?.length > 0,
    `${label}: strength missing`,
  );
  assert(row.product?.dosageForm, `${label}: dosage form missing`);
  assert(row.product?.route?.length > 0, `${label}: route missing`);
  assert(
    row.product?.targetSpecies?.length > 0,
    `${label}: target species missing`,
  );
  assert(
    row.clinicalOrderType === "dispensing",
    `${label}: order type is not dispensing`,
  );
  assert(
    row.destination === "dispensing",
    `${label}: destination is not dispensing`,
  );
  assert(
    row.clinicalReviewStatus === "pending",
    `${label}: clinical review is not pending`,
  );
  assert(
    row.clinicalUseAllowed === false,
    `${label}: clinical use must be false`,
  );
  assert(
    row.safetyReviewSignals?.clinicalDecisionSupportAllowed === false,
    `${label}: CDS use must be false`,
  );
  for (const field of [
    "dose",
    "frequency",
    "duration",
    "quantity",
    "repeats",
    "instructions",
  ]) {
    assert(
      row.orderDefaults?.[field] === null,
      `${label}: ${field} must remain null`,
    );
  }
  assert(
    row.handling?.beyondUseDateRule === null,
    `${label}: BUD rule must remain null`,
  );
  assert(
    row.product?.compounded === false,
    `${label}: compounded must be false`,
  );
  assert(
    row.regulatory?.koreanAuthorizationStatus === "not_verified",
    `${label}: Korean authorization must remain unverified`,
  );
  assert(
    row.regulatory?.koreanControlledSubstanceStatus === "not_screened",
    `${label}: Korean controlled-substance status must remain unscreened`,
  );
  try {
    normalizeOfficialVmdSourceUrl(row.evidence?.spcUrl);
  } catch {
    errors.push(`${label}: official VMD SPC URL missing`);
  }
  assert(
    /^[a-f0-9]{64}$/.test(row.evidence?.spcDocumentSha256 ?? ""),
    `${label}: SPC SHA invalid`,
  );
  assert(row.evidence?.spcPageCount > 0, `${label}: SPC page count invalid`);
  assert(
    row.activationBlockReasons?.includes(
      "named_veterinary_clinical_review_missing",
    ),
    `${label}: named veterinarian activation block missing`,
  );
  assert(
    row.quality?.status === "pass_technical_evidence",
    `${label}: technical quality failed`,
  );
  assert(
    row.quality?.noDoseOrBudInferred === true,
    `${label}: inference guard missing`,
  );
}

const duplicateIds = duplicateValues(rows.map((row) => row.masterOrderId));
const duplicateKeys = duplicateValues(rows.map((row) => row.canonicalOrderKey));
const duplicateProducts = duplicateValues(
  rows.map((row) => row.product.sourceProductId),
);
assert(
  duplicateIds.length === 0,
  `duplicate master IDs: ${duplicateIds.join(", ")}`,
);
assert(
  duplicateKeys.length === 0,
  `duplicate canonical keys: ${duplicateKeys.join(", ")}`,
);
assert(
  duplicateProducts.length === 0,
  `duplicate source products: ${duplicateProducts.join(", ")}`,
);
assert(
  summary.jsonSha256 === sha256(finalText),
  "summary JSON SHA does not match dataset",
);

const { payloadSha256, ...releaseWithoutHash } = releasePayload;
const genericOrders = releasePayload.genericReleasePayload.records.filter(
  (record) => record.recordType === "order",
);
const genericDependencies = releasePayload.genericReleasePayload.records.filter(
  (record) => record.recordType !== "order",
);
const productIds = new Set(
  releasePayload.products.map((product) => product.id),
);
const profileIds = new Set(
  releasePayload.dispensingProfiles.map((profile) => profile.id),
);
const evidenceDocumentIds = new Set(
  releasePayload.evidenceDocuments.map((document) => document.id),
);
const orderMasterKeys = new Set(genericOrders.map((order) => order.masterKey));

assert(
  releasePayload.recordCount === rows.length,
  "release record count mismatch",
);
assert(
  releasePayload.sourceDatasetSha256 === sha256(finalText),
  "release source SHA mismatch",
);
assert(
  payloadSha256 === sha256(JSON.stringify(canonicalize(releaseWithoutHash))),
  "release canonical payload SHA mismatch",
);
assert(
  releaseSummary.payloadSha256 === payloadSha256,
  "release summary payload SHA mismatch",
);
assert(
  releaseSummary.payloadFileSha256 === sha256(releasePayloadText),
  "release summary file SHA mismatch",
);
assert(genericOrders.length === rows.length, "generic order count mismatch");
assert(genericDependencies.length === 8, "generic dependency count mismatch");
assert(
  releasePayload.genericReleasePayload.classificationPaths.length === 1 &&
    releasePayload.genericReleasePayload.classificationPaths[0]?.pathKey ===
      "cm.path.dispensing",
  "dispensing classification path mismatch",
);
assert(
  releasePayload.dispensingProfiles.every(
    (profile) =>
      productIds.has(profile.productId) &&
      orderMasterKeys.has(profile.orderMasterKey) &&
      profile.lifecycleStatus === "clinical_review_pending" &&
      profile.koreanTranslationReviewStatus === "pending" &&
      profile.prescriptionDefaults === null,
  ),
  "dispensing profile relation or inactive gate mismatch",
);
assert(
  releasePayload.productIngredients.every((relation) =>
    productIds.has(relation.productId),
  ),
  "product ingredient relation orphan",
);
assert(
  releasePayload.evidenceAssertions.every(
    (assertion) =>
      productIds.has(assertion.productId) &&
      evidenceDocumentIds.has(assertion.evidenceDocumentId),
  ),
  "evidence assertion relation orphan",
);
assert(
  releasePayload.clinicalReviews.every(
    (review) =>
      profileIds.has(review.dispensingProfileId) &&
      review.decision === "pending",
  ),
  "clinical review relation or pending gate mismatch",
);
assert(
  releasePayload.regulatoryProfiles.every(
    (profile) =>
      productIds.has(profile.productId) &&
      profile.reviewStatus === "pending" &&
      profile.authorizationStatus === "not_verified" &&
      profile.controlledStatus === "not_screened",
  ),
  "regulatory profile relation or pending gate mismatch",
);

const sourceUrls = [...new Set(rows.map((row) => row.evidence?.spcUrl))].filter(
  (url) => typeof url === "string" && url.length > 0,
);
const sourceLinkResults = checkSourceLinks
  ? await checkSourceUrls(sourceUrls)
  : [];
const brokenSourceLinks = sourceLinkResults.filter((result) => !result.ok);
if (checkSourceLinks) {
  assert(
    sourceUrls.length === rows.length,
    `source URL uniqueness mismatch: ${sourceUrls.length} URLs for ${rows.length} rows`,
  );
  for (const result of brokenSourceLinks) {
    errors.push(
      `broken source URL: ${result.url} (${result.status ?? result.error ?? "unknown error"})`,
    );
  }
}

const result = {
  status: errors.length === 0 ? "pass" : "fail",
  candidateCount: candidates.length,
  finalCount: rows.length,
  duplicateMasterIdCount: duplicateIds.length,
  duplicateCanonicalKeyCount: duplicateKeys.length,
  duplicateSourceProductCount: duplicateProducts.length,
  clinicalUseAllowedCount: rows.filter((row) => row.clinicalUseAllowed).length,
  releasePayloadSha256: payloadSha256,
  releaseGenericOrderCount: genericOrders.length,
  releaseGenericDependencyCount: genericDependencies.length,
  releaseNormalizedRowCount: Object.values(releaseSummary.counts).reduce(
    (total, count) => total + count,
    0,
  ),
  sourceLinkCheck: {
    brokenCount: brokenSourceLinks.length,
    checkedCount: sourceLinkResults.length,
    mode: checkSourceLinks ? "live_http" : "not_run",
    uniqueUrlCount: sourceUrls.length,
  },
  errorCount: errors.length,
  errors,
};

console.log(JSON.stringify(result, null, 2));
if (errors.length > 0) process.exitCode = 1;
