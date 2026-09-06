import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { publisherContentHash, canonicalize } from "./generate-clinical-master-execution-preset-release-v1.mjs";
import { uuidV5 } from "./generate-clinical-master-order-execution-presets-v1.mjs";
import { wp03NewProducts, wp03ExistingProductReplacements, wp03GenericProductReplacements } from "./lib/wp03-product-definitions.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = path => JSON.parse(readFileSync(resolve(root, path), "utf8"));
const sha = value => createHash("sha256").update(canonicalize(value)).digest("hex");
const artifacts = "docs/work/clinical-master/order-execution-defaults/artifacts";
const outputPath = `${artifacts}/wp-03/dispensing-definitions.non-applied.v2.json`;
const existingKey = id => `cm.order.dispensing-v1-uk-vmd-${id}`;
const newKey = key => `cm.order.dispensing-wp03.${key}`;
const counts = { once: 1, sid: 1, bid: 2, tid: 3, qid: 4 };
const status = { availabilityIntent: "active", dataOrigin: "synthetic", clinicalValidation: "not_clinically_validated", intendedUse: "prototype_only", clinicalUseAllowed: false };

export function buildWp03DispensingDefinitions() {
  const manifest = read(`${artifacts}/wp-00-frozen-manifest.v1.json`);
  const source = read("tests/fixtures/clinical-master-execution-preset-release-v1.json");
  const products = read("docs/work/clinical-master/clinical-master-pr-017/supabase/dispensing-order-release-payload.v1.json");
  const presets = read("docs/work/clinical-master/clinical-master-pr-019/dispensing-master-presets.v1.json");
  const byKey = new Map(source.records.map(record => [record.masterKey, record]));
  const authoringSourceSha256 = createHash("sha256").update(readFileSync(fileURLToPath(import.meta.url))).digest("hex");
  const sourceArtifactSha256 = sha({ manifest: manifest.semanticFingerprint, products: products.payloadSha256,
    presets: presets.entriesSha256, authoringSourceSha256, definitions: wp03NewProducts, existing: wp03ExistingProductReplacements, generic: wp03GenericProductReplacements });
  const records = [];
  const roundingReconciliation = [];
  for (const preset of presets.entries) {
    const record = structuredClone(byKey.get(preset.orderMasterKey));
    if (!record || !manifest.entries.some(entry => entry.orderId === record.masterKey)) throw new Error(`frozen_product_missing:${preset.orderMasterKey}`);
    const product = products.products.find(product => product.id === preset.productId && product.revision === preset.productRevision);
    if (!product || preset.detailInputs.doseUnit !== preset.detailInputs.totalQuantityUnit || preset.detailInputs.doseBasis !== "patient") throw new Error(`product_identity_or_unit_mismatch:${preset.orderMasterKey}`);
    const isMeasuredProduct = ["ml", "g"].includes(preset.detailInputs.doseUnit);
    const increment = isMeasuredProduct ? 0.1 : preset.detailInputs.doseUnit === "capsule" ? 1
      : { ceil_0_5: 0.5, ceil_0_25: 0.25, ceil: 1 }[preset.medicationMetadata.dispenseRoundingRule];
    if (!increment) throw new Error(`unresolved_rounding:${preset.orderMasterKey}`);
    const authority = { schemaVersion: 2, calculationMode: "product_unit", dispenseUnit: preset.detailInputs.doseUnit,
      preparationPolicy: { quantityScope: "course_total", increment, roundingMode: isMeasuredProduct ? "nearest" : "up", displayPrecision: increment === 1 ? 0 : isMeasuredProduct ? 1 : 2 },
      productReference: { referenceKey: product.productKey, productName: product.englishProductName,
        dosageForm: product.dosageForm, strengthDescription: product.englishProductName,
        sourceUri: preset.provenance.sourceUri, referenceSpecies: [...preset.targetSpecies].sort(), clinicalUseAllowed: false } };
    if (isMeasuredProduct || preset.detailInputs.doseUnit === "capsule") roundingReconciliation.push({
      orderMasterKey: preset.orderMasterKey, priorMetadataRule: preset.medicationMetadata.dispenseRoundingRule,
      priorGeneratorRule: isMeasuredProduct ? "Math.round(courseTotal * 10) / 10" : "Math.ceil(courseTotal * 2) / 2",
      successorPolicy: authority.preparationPolicy,
      reason: isMeasuredProduct ? "Metadata conflicted with actual PR019 generator; preserve authored quantity with explicit decimal rounding"
        : "Whole capsule counting only; existing integer dose and total unchanged",
      doseAndDurationAndTotalPreserved: true,
    });
    const inputs = { ...preset.detailInputs, planOrderAuthority: authority };
    const policies = { ...record.detail.executionPreset.fieldPolicies, planOrderAuthority: "preset_fixed", taperSchedule: "not_applicable", extraLabelSpeciesReason: "not_applicable" };
    record.detail.executionPreset = finishPreset({ ...record.detail.executionPreset,
      presetRevision: record.detail.executionPreset.presetRevision + 1, defaultDetailInputs: inputs, fieldPolicies: policies,
      provenance: { ...record.detail.executionPreset.provenance, prototypeContract: status,
        fieldEvidence: preset.provenance.fieldEvidence, sourceNotes: "Exact existing product-specific synthetic quantities retained. Explicit course-total preparation policy reconciles PR019 generator and metadata; see roundingReconciliation.",
        unresolvedClinicalAuthority: [], clinicalUseNotice: "합성 데모 전용 · 임상 검증 안 됨 · 실제 처방에 사용 금지" },
      sourceArtifactSha256, presetStatus: "synthetic_unreviewed", clinicalUseAllowed: false });
    records.push(record);
  }
  for (const definition of wp03NewProducts) {
    const key = newKey(definition.key);
    const increment = definition.unit === "tablet" && definition.dose === 0.5 ? 0.5
      : definition.unit === "g" && definition.dose < 1 ? 0.25 : 1;
    const theoreticalTotal = definition.dose * counts[definition.frequency] * definition.durationDays;
    const total = Math.ceil(theoreticalTotal / increment) * increment;
    const authority = { schemaVersion: 2, calculationMode: "product_unit", dispenseUnit: definition.unit,
      preparationPolicy: { quantityScope: "course_total", increment, roundingMode: "up", displayPrecision: increment === 1 ? 0 : 2 },
      productReference: { referenceKey: `wp03.product.${definition.key}`, productName: definition.productName,
        dosageForm: definition.dosageForm, strengthDescription: definition.strengthDescription, sourceUri: definition.sourceUri,
        referenceSpecies: definition.referenceSpecies, clinicalUseAllowed: false } };
    const defaults = { doseBasis: "patient", dose: definition.dose, doseUnit: definition.unit, route: definition.route,
      frequency: definition.frequency, durationDays: definition.durationDays, totalQuantity: total, totalQuantityUnit: definition.unit,
      compoundNote: definition.instruction,
      guardianNote: "합성 데모의 전달 메모 입력 예시 · 실제 투여 지시가 아님", extraLabelSpeciesConfirmed: false, planOrderAuthority: authority };
    const policies = Object.fromEntries(Object.keys(source.records.find(r => r.masterKey === existingKey("a006858")).detail.executionPreset.fieldPolicies)
      .map(key => [key, Object.hasOwn(defaults, key) ? "preset_fixed" : "not_applicable"]));
    policies.planOrderAuthority = "preset_fixed";
    // Human labels are identity references only; synthetic applicability is its
    // own explicit authored choice, never represented as source species evidence.
    const species = definition.referenceSpecies.includes("human") ? ["cat", "dog"]
      : definition.referenceSpecies.filter(species => ["cat", "dog"].includes(species)).sort();
    const preset = finishPreset({ presetId: uuidV5(`preset:wp03:${definition.key}`), presetKey: `preset:wp03:${definition.key}`,
      presetRevision: 1, clinicalOrderType: "dispensing", detailSchemaVersion: 1, defaultDetailInputs: defaults, fieldPolicies: policies,
      provenance: { prototypeContract: status, generatorProfileKey: `wp03.product.${definition.key}`, sourceType: "official-identity-plus-synthetic-functional-fixture",
        productSourceUri: definition.sourceUri, referenceSpecies: definition.referenceSpecies, syntheticTargetSpecies: species,
        fieldEvidence: { productIdentity: "primary_source", strengthDescription: "primary_source", referenceSpecies: "primary_source",
          dose: "synthetic_assumption", frequency: "synthetic_assumption", durationDays: "synthetic_assumption",
          totalQuantity: "derived_synthetic_course_preparation", syntheticTargetSpecies: "synthetic_assumption", preparationPolicy: "synthetic_assumption" },
        clinicalUseNotice: "합성 데모 전용 · 임상 검증 안 됨 · 실제 처방에 사용 금지", instructionScope: definition.instruction },
      presetStatus: "synthetic_unreviewed", clinicalUseAllowed: false, sourceArtifactSha256 });
    records.push({ masterKey: key, recordType: "order", lifecycleStatus: "published", safetyStatus: "normal", safetyReason: null,
      names: [{ languageCode: "en", nameKind: "preferred", name: definition.productName, searchable: true, sortOrder: 0 }],
      source: { sourceType: "synthetic", title: "WP03 explicitly authored synthetic product order", referenceUri: definition.sourceUri,
        sourceVersion: "wp03.product.v2", accessedAt: "2026-09-06", licenseNotes: "Public identity reference; synthetic functional values, not clinically validated or authorized for real use." },
      detail: { classificationPathKey: "cm.path.dispensing", defaultSalesUnitCode: "case", defaultBillingReflectionEnabled: true,
        defaultQuantity: 1, species, executionPreset: preset } });
  }
  const productKeys = new Set(presets.entries.map(entry => entry.orderMasterKey));
  const ambiguous = manifest.entries.filter(entry => entry.clinicalOrderType === "dispensing" && !productKeys.has(entry.orderId));
  const replacementLedger = ambiguous.map(entry => {
    const key = entry.orderId;
    let target;
    if (key.startsWith("cm.order.v4.dispensing.")) {
      const suffix = key.split(".").at(-1);
      target = wp03ExistingProductReplacements[suffix] ? existingKey(wp03ExistingProductReplacements[suffix])
        : newKey(wp03NewProducts.find(product => product.legacySuffix === suffix)?.key);
    } else if (key === "cm.order.synthetic.dispensing-07") target = newKey(wp03NewProducts.find(product => product.legacySuffix === "synthetic07").key);
    else {
      const suffix = key.startsWith("cm.order.synthetic.dispensing-") ? key.split("-").at(-1) : key;
      target = existingKey(wp03GenericProductReplacements[suffix]);
    }
    const record = records.find(record => record.masterKey === target);
    if (!record) throw new Error(`unmapped_ambiguous_identity:${key}`);
    return { originalMasterKey: key, originalDisplayName: entry.displayName,
      replacementMasterKey: target, replacementDisplayName: record.names[0].name,
      relationship: "authored_product_redefinition_not_clinical_equivalence", originalSpecies: entry.speciesApplicability,
      replacementSyntheticSpecies: record.detail.species, retirementIntent: "stop_future_selection_preserve_historical_orders_and_workspace_overrides" };
  });
  if (ambiguous.length !== 51 || records.length !== 127 || new Set(records.map(record => record.masterKey)).size !== 127) throw new Error("dispensing_denominator_mismatch");
  for (const record of records) assertDefinition(record);
  return { schemaVersion: 2, applicationStatus: "non_applied", sourceArtifactSha256, authoringSourceSha256, prototypeContract: status,
    originalOrderCount: 522, originalDispensingCount: 159, retainedExactProductCount: 108,
    replacedAmbiguousCount: 51, newProductCount: 19, successorDispensingCount: 127,
    successorTotalBeforeOtherPackageAdditions: 490, replacementLedger, roundingReconciliation,
    records: records.sort((a,b) => a.masterKey.localeCompare(b.masterKey)) };
}

function finishPreset(preset) {
  return { ...preset, contentSha256: publisherContentHash(preset) };
}

export function assertDefinition(record) {
  const p = record.detail.executionPreset; const v = p.defaultDetailInputs; const a = v.planOrderAuthority;
  if (!a.productReference || a.productReference.clinicalUseAllowed !== false || p.clinicalUseAllowed !== false ||
    p.provenance.prototypeContract.clinicalValidation !== "not_clinically_validated" ||
    a.calculationMode !== "product_unit" || a.dispenseUnit !== v.doseUnit || v.doseUnit !== v.totalQuantityUnit ||
    a.preparationPolicy.quantityScope !== "course_total" || !counts[v.frequency] || v.durationDays < 1 || v.dose <= 0)
    throw new Error(`invalid_complete_product_definition:${record.masterKey}`);
  const theoretical = v.dose * counts[v.frequency] * v.durationDays;
  const scaled = theoretical / a.preparationPolicy.increment;
  const total = (a.preparationPolicy.roundingMode === "nearest" ? Math.round(scaled)
    : Math.ceil(scaled - Number.EPSILON * Math.max(1, scaled) * 8)) * a.preparationPolicy.increment;
  if (Math.abs(total - v.totalQuantity) > 1e-8 || p.contentSha256 !== publisherContentHash(p)) throw new Error(`quantity_or_hash_mismatch:${record.masterKey}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const artifact = buildWp03DispensingDefinitions();
  writeFileSync(resolve(root, outputPath), `${JSON.stringify(artifact, null, 2)}\n`);
  console.log(JSON.stringify({ outputPath, originalDispensing: 159, successorDispensing: 127, replacements: 51, addedProducts: 19, applied: false }));
}
