#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(
  repoRoot,
  "docs/work/clinical-master/clinical-master-pr-017/supabase/dispensing-order-release-payload.v1.json",
);
const outputPath = path.join(
  repoRoot,
  "docs/work/clinical-master/clinical-master-pr-019/dispensing-service-review-prices.v1.json",
);

const sourceBytes = await readFile(sourcePath);
const source = JSON.parse(sourceBytes.toString("utf8"));

const categoryBaseKrw = {
  anti_inflammatory_other: 9_500,
  antimicrobial_antifungal: 9_500,
  antiparasitic: 8_500,
  cardiovascular: 11_500,
  dermatology_topical: 16_000,
  emergency_supportive: 10_000,
  endocrine: 13_500,
  gastrointestinal: 8_500,
  immunomodulator: 24_000,
  neurology_behavior: 13_500,
  ophthalmic_otic: 14_500,
  other: 12_000,
  pain_nsaid: 10_000,
  respiratory: 7_500,
  urinary: 11_000,
};

const formAdjustmentKrw = {
  "Capsule, hard": 500,
  "Capsule, soft": 2_000,
  "Chewable tablet": 1_500,
  "Coated tablet": 500,
  "Cutaneous spray, solution": 2_500,
  "Ear drops, solution": 4_500,
  "Ear gel": 4_500,
  "Eye drops, solution": 3_000,
  "Eye drops, suspension": 3_500,
  "Eye ointment": 3_000,
  "Film-coated tablet": 1_000,
  "Laryngopharyngeal Spray, Solution": 5_000,
  "Modified-release tablet": 2_500,
  "Ointment": 2_000,
  "Oral drops, suspension": 4_000,
  "Oral gel": 1_500,
  "Oral powder": 1_000,
  "Oral solution": 3_500,
  "Oral suspension": 4_000,
  "Powder for oral suspension": 3_000,
  "Prolonged-release tablet": 2_500,
  "Shampoo": 2_500,
  "Spot-on solution": 3_500,
  "Syrup": 2_500,
  "Tablet": 0,
  "Transdermal Solution": 5_000,
};

const productById = new Map(source.products.map((product) => [product.id, product]));
const ingredientCountByProductId = new Map();
for (const ingredient of source.productIngredients) {
  ingredientCountByProductId.set(
    ingredient.productId,
    (ingredientCountByProductId.get(ingredient.productId) ?? 0) + 1,
  );
}

const variationBandsKrw = [-1_500, -1_000, -500, 0, 500, 1_000, 1_500];
const roundTo500 = (value) => Math.round(value / 500) * 500;
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const stableVariation = (sourceProductId) => {
  const digest = createHash("sha256").update(sourceProductId).digest();
  return variationBandsKrw[digest[0] % variationBandsKrw.length];
};

const entries = source.dispensingProfiles
  .map((profile) => {
    const product = productById.get(profile.productId);
    if (!product) throw new Error(`missing product for ${profile.orderMasterKey}`);
    const ingredientCount = ingredientCountByProductId.get(product.id) ?? 0;
    if (ingredientCount < 1) {
      throw new Error(`missing ingredient count for ${profile.orderMasterKey}`);
    }
    const categoryBase = categoryBaseKrw[product.coverageCategory];
    const formAdjustment = formAdjustmentKrw[product.dosageForm];
    if (categoryBase === undefined || formAdjustment === undefined) {
      throw new Error(
        `unpriced policy dimension: ${product.coverageCategory}/${product.dosageForm}`,
      );
    }
    const multiIngredientAdjustment = Math.max(0, ingredientCount - 1) * 1_500;
    const variation = stableVariation(product.sourceProductId);
    const priceKrw = Math.min(
      32_000,
      Math.max(
        3_000,
        roundTo500(categoryBase + formAdjustment + multiIngredientAdjustment + variation),
      ),
    );

    return {
      orderMasterKey: profile.orderMasterKey,
      sourceProductId: product.sourceProductId,
      englishProductName: product.englishProductName,
      koreanDraftName: product.koreanDraftName,
      coverageCategory: product.coverageCategory,
      dosageForm: product.dosageForm,
      ingredientCount,
      priceKrw,
      pricingBasis: {
        categoryBaseKrw: categoryBase,
        dosageFormAdjustmentKrw: formAdjustment,
        multiIngredientAdjustmentKrw: multiIngredientAdjustment,
        deterministicVariationKrw: variation,
      },
    };
  })
  .sort((left, right) => left.orderMasterKey.localeCompare(right.orderMasterKey));

if (entries.length !== 108 || new Set(entries.map((entry) => entry.orderMasterKey)).size !== 108) {
  throw new Error("expected exactly 108 unique dispensing price targets");
}

const sortedPrices = entries.map((entry) => entry.priceKrw).sort((a, b) => a - b);
const medianPriceKrw =
  (sortedPrices[sortedPrices.length / 2 - 1] + sortedPrices[sortedPrices.length / 2]) / 2;
const entriesSha256 = sha256(JSON.stringify(entries));
const artifact = {
  schemaVersion: 1,
  policyVersion: "dispensing-service-review-price-v1",
  generatedAt: "2026-08-26T00:00:00.000Z",
  scope: {
    workspaceId: "workspace-clair-cheongdam",
    releaseId: "78a57bf0-10a8-47db-9ae1-8a8cff79b2c4",
    serviceReviewOnly: true,
    clinicalUseAllowed: false,
  },
  source: {
    path: path.relative(repoRoot, sourcePath),
    sourceDatasetSha256: source.sourceDatasetSha256,
    payloadSha256: source.payloadSha256,
    sourceFileSha256: sha256(sourceBytes),
  },
  assumptions: [
    "Synthetic service-review prices, not surveyed per-product market prices.",
    "Workspace-owned per-order sales price; no CLAiR canonical suggested price is created.",
    "The 2025 Korean public fee medians anchor the range, while dosage form, category, ingredient count, and a deterministic small variation differentiate products.",
    "Clinical and regulatory approval state remains unchanged and false/pending.",
  ],
  research: [
    {
      authority: "대한민국 농림축산식품부",
      title: "2025 전국 동물병원 진료비 현황",
      url: "https://www.mafra.go.kr/bbs/home/792/592824/download.do",
      anchor: {
        broadSpectrumDewormingMedianKrw: 3_000,
        externalParasitePreventionMedianKrw: 16_000,
        heartwormPreventionMedianKrw: 16_500,
      },
    },
    {
      authority: "동물병원 진료비 조사 공개 시스템",
      title: "투약/조제비 공개 항목 및 지역별 가격",
      url: "https://www.animalclinicfee.or.kr/info/payInfo.do",
      note: "Official figures cover three preventive-medication categories at 5 kg; they do not provide authoritative prices for all 108 products.",
    },
  ],
  summary: {
    count: entries.length,
    minimumPriceKrw: sortedPrices[0],
    medianPriceKrw,
    maximumPriceKrw: sortedPrices.at(-1),
    uniquePriceCount: new Set(sortedPrices).size,
    entriesSha256,
  },
  entries,
};

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`);
console.log(JSON.stringify(artifact.summary));
