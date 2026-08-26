import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const RELEASE_PATH = resolve(
  ROOT,
  "docs/work/clinical-master/clinical-master-pr-017/supabase/dispensing-order-release-payload.v1.json",
);
const SOURCE_PATH = resolve(
  ROOT,
  "docs/work/clinical-master/clinical-master-pr-019/dispensing-default-source-extracts.v1.json",
);
const OUTPUT_PATH = resolve(
  ROOT,
  "docs/work/clinical-master/clinical-master-pr-019/dispensing-master-presets.v1.json",
);

const release = JSON.parse(readFileSync(RELEASE_PATH, "utf8"));
const sourceExtracts = JSON.parse(readFileSync(SOURCE_PATH, "utf8"));

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function canonical(value) {
  return JSON.stringify(value);
}

function seedFor(value, salt = "") {
  return Number.parseInt(sha256(`${value}:${salt}`).slice(0, 8), 16);
}

function choose(values, seed, offset = 0) {
  return values[(seed + offset) % values.length];
}

function deterministicUuid(value) {
  const hex = sha256(value).slice(0, 32).split("");
  hex[12] = "5";
  hex[16] = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].map((part) => part.join("")).join("-");
}

function earliestPattern(text, patterns) {
  const matches = patterns
    .map((pattern) => {
      const match = pattern.regex.exec(text);
      return match ? { ...pattern, index: match.index, match } : null;
    })
    .filter(Boolean)
    .sort((left, right) => left.index - right.index);
  return matches[0] ?? null;
}

const ROUTES = {
  oral: "PO",
  cutaneous: "topical",
  ophthalmic: "ophthalmic",
  otic: "otic",
  transdermal: "transdermal",
  oromucosal: "oromucosal",
};

const FREQUENCY_COUNT = {
  once: 1,
  sid: 1,
  bid: 2,
  tid: 3,
  qid: 4,
};

const CATEGORY_DURATION = {
  anti_inflammatory_other: [5, 7, 10],
  antimicrobial_antifungal: [7, 10, 14],
  antiparasitic: [1, 3, 5],
  cardiovascular: [28, 30],
  dermatology_topical: [7, 10, 14],
  emergency_supportive: [3, 5, 7],
  endocrine: [28, 30],
  gastrointestinal: [3, 5, 7],
  immunomodulator: [28, 30],
  neurology_behavior: [14, 21, 30],
  ophthalmic_otic: [7, 10, 14],
  other: [5, 7, 14],
  pain_nsaid: [3, 5, 7],
  respiratory: [5, 7, 10],
  urinary: [7, 14, 30],
};

function selectFrequency({ category, dosageForm, route, seed, text }) {
  if (route === "cutaneous" && /spot-on/i.test(`${dosageForm} ${text}`)) return { value: "once", evidenceMode: "spc_direct" };
  if (route === "oromucosal" || (route === "otic" && /ear gel/i.test(dosageForm))) {
    return { value: "once", evidenceMode: "product_form_inference" };
  }
  const direct = earliestPattern(text.slice(0, 3000), [
    { value: "qid", regex: /(?:every\s+6\s+hours|four\s+times\s+(?:daily|a\s+day))/i },
    { value: "tid", regex: /(?:every\s+8\s+hours|three\s+times\s+(?:daily|a\s+day))/i },
    { value: "bid", regex: /(?:every\s+12\s+hours|twice\s+(?:daily|a\s+day))/i },
    { value: "sid", regex: /(?:every\s+24\s+hours|once\s+(?:daily|a\s+day)|daily\s+administration)/i },
    { value: "once", regex: /(?:single\s+(?:oral\s+)?(?:dose|administration))/i },
  ]);
  if (direct) return { value: direct.value, evidenceMode: "spc_direct" };
  const defaults = {
    antimicrobial_antifungal: ["bid", "sid", "tid"],
    cardiovascular: ["sid", "bid"],
    dermatology_topical: ["sid", "bid"],
    endocrine: ["sid", "bid"],
    gastrointestinal: ["sid", "bid"],
    immunomodulator: ["sid", "bid"],
    neurology_behavior: ["sid", "bid"],
    ophthalmic_otic: ["bid", "tid"],
    pain_nsaid: ["sid", "bid"],
  };
  return {
    value: choose(defaults[category] ?? ["sid", "bid"], seed, 11),
    evidenceMode: "synthetic_inference",
  };
}

function selectDuration({ category, dosageForm, route, seed, text }) {
  if (route === "cutaneous" && /spot-on/i.test(`${dosageForm} ${text}`)) return { value: 1, evidenceMode: "spc_direct" };
  if (route === "oromucosal" || (route === "otic" && /ear gel/i.test(dosageForm))) {
    return { value: 1, evidenceMode: "product_form_inference" };
  }
  const direct = earliestPattern(text.slice(0, 3500), [
    { regex: /for\s+(?:a\s+minimum\s+of\s+|at\s+least\s+|up\s+to\s+)?(\d+)\s*(?:-|–|to)\s*(\d+)\s+(?:consecutive\s+)?days?/i },
    { regex: /for\s+(?:a\s+minimum\s+of\s+|at\s+least\s+|up\s+to\s+)?(\d+)\s+(?:consecutive\s+)?days?/i },
    { regex: /(?:treatment|therapy)\s+(?:is\s+)?(?:usually\s+)?(?:recommended\s+)?for\s+(\d+)\s+days?/i },
  ]);
  if (direct) {
    const values = direct.match.slice(1).filter(Boolean).map(Number);
    const picked = Math.max(...values);
    return { value: Math.min(30, Math.max(1, picked)), evidenceMode: "spc_direct" };
  }
  const duration = choose(CATEGORY_DURATION[category] ?? [5, 7, 10], seed, 23);
  return { value: duration, evidenceMode: "synthetic_inference" };
}

function selectDoseUnit(product) {
  const form = product.dosageForm.toLowerCase();
  const route = product.routes[0];
  if (route === "ophthalmic" || form.includes("eye drops")) return "drop";
  if (route === "otic" && form.includes("drops")) return "drop";
  if (form.includes("spot-on")) return "pipette";
  if (route === "transdermal") return "ml";
  if (form.includes("spray")) return "spray";
  if (form.includes("shampoo")) return "ml";
  if (form.includes("ointment") || form.includes("ear gel")) return "application";
  if (form.includes("capsule")) return "capsule";
  if (form.includes("tablet")) return "tablet";
  if (form.includes("powder for oral suspension")) return "ml";
  if (form.includes("powder")) return "g";
  if (form.includes("solution") || form.includes("suspension") || form.includes("syrup") || form.includes("gel")) return "ml";
  return "application";
}

function selectDose({ product, seed, species }) {
  const unit = selectDoseUnit(product);
  const strength = product.strengthSnapshot[0]?.numeratorValue ?? 1;
  const catOnly = species.length === 1 && species[0] === "cat";
  let options;
  switch (unit) {
    case "tablet":
      if (/modified-release|prolonged-release/i.test(product.dosageForm)) options = [1];
      else if (strength >= 100) options = catOnly ? [0.25, 0.5] : [0.25, 0.5, 1];
      else if (strength >= 20) options = catOnly ? [0.25, 0.5, 1] : [0.5, 1, 1.5];
      else options = catOnly ? [0.5, 1] : [0.5, 1, 1.5, 2];
      break;
    case "capsule":
      options = [1, 2];
      break;
    case "drop":
      options = [1, 2];
      break;
    case "pipette":
    case "application":
      options = [1];
      break;
    case "spray":
      options = [1, 2, 3];
      break;
    case "g":
      options = [0.5, 1, 2];
      break;
    case "ml":
      if (/shampoo/i.test(product.dosageForm)) options = [10, 15, 20];
      else if (product.routes[0] === "transdermal") options = [0.1, 0.2];
      else if (strength >= 50) options = [0.2, 0.4, 0.5, 1];
      else if (strength <= 1) options = [0.5, 1, 1.5];
      else options = [0.5, 0.8, 1, 1.2, 1.5, 2];
      break;
    default:
      options = [1];
  }
  return { amount: choose(options, seed, 37), unit };
}

function selectMedicationInstruction(text) {
  const sample = text.slice(0, 3500);
  if (/with\s+or\s+without\s+food/i.test(sample)) return "any_time";
  const direct = earliestPattern(sample, [
    { value: "before_meal", regex: /(?:without\s+food|empty\s+stomach|before\s+(?:feeding|food)|at\s+least\s+one\s+hour\s+before)/i },
    { value: "with_meal", regex: /(?:with\s+food|mixed\s+with\s+food|during\s+feeding)/i },
    { value: "after_meal", regex: /(?:after\s+(?:feeding|food|a\s+meal))/i },
  ]);
  return direct?.value ?? "any_time";
}

function selectStorageMethod(text) {
  const refrigerated = /(?:2\s*°?c\s*(?:-|–|to)\s*8\s*°?c|refrigerat)/i.test(text);
  const protectedFromLight = /protect(?:ed)?\s+from\s+light|light-protected/i.test(text);
  if (refrigerated && protectedFromLight) return "refrigerated_light_protected";
  if (refrigerated) return "refrigerated";
  if (protectedFromLight) return "room_temp_light_protected";
  return "room_temp";
}

function roundQuantity(value, unit) {
  if (["tablet", "capsule"].includes(unit)) return Math.ceil(value * 2) / 2;
  if (["drop", "pipette", "application", "spray"].includes(unit)) return Math.ceil(value);
  return Math.round(value * 10) / 10;
}

function guardianNote({ amount, durationDays, frequency, route, unit, instruction }) {
  const frequencyLabels = { once: "1회", sid: "하루 1회", bid: "하루 2회", tid: "하루 3회", qid: "하루 4회" };
  const unitLabels = { tablet: "정", capsule: "캡슐", drop: "방울", pipette: "피펫", application: "회분", spray: "회 분사", ml: "mL", g: "g" };
  const mealLabels = { before_meal: "식전에", after_meal: "식후에", with_meal: "식사와 함께", any_time: "정해진 시간에" };
  if (route === "ophthalmic") return `해당 눈에 ${amount}${unitLabels[unit]}씩 ${frequencyLabels[frequency]}, ${durationDays}일간 점안하세요.`;
  if (route === "otic") return `해당 귀에 ${amount}${unitLabels[unit]}씩 ${frequencyLabels[frequency]}, ${durationDays}일간 적용한 뒤 귀 바닥을 가볍게 마사지하세요.`;
  if (route === "cutaneous" && unit === "pipette") return "피부를 갈라 1피펫 전량을 도포하고 마를 때까지 핥지 않게 해주세요.";
  if (route === "cutaneous" || route === "transdermal") return `지정 부위에 ${amount}${unitLabels[unit]}씩 ${frequencyLabels[frequency]}, ${durationDays}일간 적용하고 핥지 않게 해주세요.`;
  if (route === "oromucosal") return `입안 지정 부위에 ${amount}${unitLabels[unit]}씩 ${frequencyLabels[frequency]}, ${durationDays}일간 적용하세요.`;
  return `${mealLabels[instruction]} 1회 ${amount}${unitLabels[unit]}씩 ${frequencyLabels[frequency]}, ${durationDays}일간 투여하세요.`;
}

function compoundNote(product) {
  const form = product.dosageForm.toLowerCase();
  const label = `${product.englishProductName}:`;
  if (form.includes("suspension") || form.includes("shampoo")) return `${label} 사용 전 충분히 흔든 뒤 계량하고, 조제 라벨의 총량과 일수를 대조한다.`;
  if (form.includes("tablet")) return `${label} 총 정수와 분할 단위를 확인하고, 분할 정제는 확정된 수의사 지시와 대조한다.`;
  if (form.includes("capsule")) return `${label} 총 캡슐 수를 계수하고 제품명·함량·투여 일수를 라벨과 대조한다.`;
  if (product.routes[0] === "ophthalmic" || product.routes[0] === "otic") return `${label} 적용 부위와 용기를 확인하고 다른 환자용 용기와 혼용하지 않는다.`;
  if (product.routes[0] === "cutaneous" || product.routes[0] === "transdermal") return `${label} 도포 부위와 1회 사용량을 확인하고 접촉·핥기 주의 문구를 라벨에 반영한다.`;
  return `${label} 제품명·함량·1회량·빈도·총량을 확정된 오더와 대조한다.`;
}

const sourceByProductId = new Map(sourceExtracts.entries.map((entry) => [entry.productId, entry]));
const profileByProductId = new Map(release.dispensingProfiles.map((profile) => [profile.productId, profile]));
const speciesByProductId = new Map();
for (const row of release.speciesApplicability) {
  const values = speciesByProductId.get(row.productId) ?? [];
  values.push(row.speciesCode);
  speciesByProductId.set(row.productId, values);
}

const entries = release.products
  .map((product) => {
    const profile = profileByProductId.get(product.id);
    const source = sourceByProductId.get(product.id);
    const species = [...(speciesByProductId.get(product.id) ?? [])].sort();
    const seed = seedFor(product.sourceProductId, "dispensing-master-preset-v1");
    const frequency = selectFrequency({ category: product.coverageCategory, dosageForm: product.dosageForm, route: product.routes[0], seed, text: source.posologyExtract });
    const selectedDuration = selectDuration({ category: product.coverageCategory, dosageForm: product.dosageForm, route: product.routes[0], seed, text: source.posologyExtract });
    const duration = frequency.value === "once" && selectedDuration.value > 1
      ? { value: 1, evidenceMode: "frequency_derived_single_administration" }
      : selectedDuration;
    const dose = selectDose({ product, seed, species });
    const instruction = selectMedicationInstruction(source.posologyExtract);
    const storage = selectStorageMethod(source.storageExtract);
    const frequencyDailyCount = FREQUENCY_COUNT[frequency.value];
    const totalQuantity = roundQuantity(dose.amount * frequencyDailyCount * duration.value, dose.unit);
    const route = ROUTES[product.routes[0]];
    const presetId = deterministicUuid(`clair:dispensing-preset:${profile.id}:v1`);
    const detailInputs = {
      doseBasis: "patient",
      dose: dose.amount,
      doseUnit: dose.unit,
      route,
      frequency: frequency.value,
      durationDays: duration.value,
      totalQuantity,
      totalQuantityUnit: dose.unit,
      medicationInstruction: instruction,
      storageMethod: storage,
      compoundNote: compoundNote(product),
      guardianNote: guardianNote({ amount: dose.amount, durationDays: duration.value, frequency: frequency.value, route: product.routes[0], unit: dose.unit, instruction }),
      extraLabelSpeciesConfirmed: false,
    };
    const medicationMetadata = {
      schemaVersion: 2,
      presetOrigin: "clair_master",
      presetStatus: "synthetic_unreviewed",
      sourcePrescriptionPresetId: presetId,
      sourcePrescriptionPresetRevision: 1,
      defaultDetailInputs: detailInputs,
      autoDispenseQuantityEnabled: true,
      administrationDays: duration.value,
      dailyFrequencyCode: frequency.value,
      frequencyDailyCount,
      doseBasis: "prescribed_quantity",
      doseAmount: dose.amount,
      doseAmountUnit: dose.unit,
      administrationRoute: route,
      dispenseUnit: dose.unit,
      dispenseRoundingRule: ["tablet", "capsule"].includes(dose.unit) ? "ceil_0_5" : ["ml", "g"].includes(dose.unit) ? "ceil_0_25" : "ceil",
      medicationInstruction: instruction,
      storageMethod: storage,
      ingredientEnglishName: product.koreanDraftName.split(" ")[0],
    };
    const contentSha256 = sha256(canonical({
      detailInputs,
      medicationMetadata,
      presetStatus: "synthetic_unreviewed",
      provenance: {
        sourceUri: source.sourceUri,
        sourceExtractEntriesSha256: sourceExtracts.entriesSha256,
        posologyExtractSha256: sha256(source.posologyExtract),
        storageExtractSha256: sha256(source.storageExtract),
      },
    }));
    return {
      presetId,
      presetKey: `preset:dispensing-v1-${product.sourceProductId.toLowerCase()}`,
      presetRevision: 1,
      dispensingProfileId: profile.id,
      dispensingProfileRevision: profile.profileRevision,
      orderMasterKey: profile.orderMasterKey,
      productId: product.id,
      productRevision: product.revision,
      sourceProductId: product.sourceProductId,
      productName: product.englishProductName,
      targetSpecies: species,
      dosageForm: product.dosageForm,
      productRoute: product.routes[0],
      coverageCategory: product.coverageCategory,
      presetStatus: "synthetic_unreviewed",
      detailSchemaVersion: 1,
      detailInputs,
      medicationMetadata,
      contentSha256,
      provenance: {
        sourceUri: source.sourceUri,
        sourceExtractEntriesSha256: sourceExtracts.entriesSha256,
        posologyExtractSha256: sha256(source.posologyExtract),
        storageExtractSha256: sha256(source.storageExtract),
        fieldEvidence: {
          productIdentity: "master_direct",
          route: "master_direct",
          dosageForm: "master_direct",
          frequency: frequency.evidenceMode,
          durationDays: duration.evidenceMode,
          dose: "synthetic_product_shaped_inference",
          totalQuantity: "derived_from_synthetic_dose_frequency_duration",
          medicationInstruction: instruction === "any_time" ? "synthetic_inference" : "spc_direct",
          storageMethod: "spc_direct_normalized",
        },
        inferenceNotice: "Service-review synthetic preset; a veterinarian must review before real clinical use.",
      },
      clinicalUseAllowed: false,
    };
  })
  .sort((left, right) => left.orderMasterKey.localeCompare(right.orderMasterKey));

const detailFingerprints = new Set(entries.map((entry) => sha256(canonical(entry.detailInputs))));
const output = {
  schemaVersion: 1,
  datasetRevision: "dispensing-master-presets-v1-2026-08-26",
  sourceReleaseId: "78a57bf0-10a8-47db-9ae1-8a8cff79b2c4",
  sourcePayloadSha256: release.payloadSha256,
  sourceExtractEntriesSha256: sourceExtracts.entriesSha256,
  recordCount: entries.length,
  presetStatus: "synthetic_unreviewed",
  clinicalUseAllowed: false,
  uniqueDetailFingerprintCount: detailFingerprints.size,
  entriesSha256: sha256(canonical(entries)),
  entries,
};

writeFileSync(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify({
  output: OUTPUT_PATH,
  recordCount: output.recordCount,
  uniqueDetailFingerprintCount: output.uniqueDetailFingerprintCount,
  entriesSha256: output.entriesSha256,
}, null, 2));
