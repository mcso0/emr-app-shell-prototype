import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { publisherContentHash, canonicalize } from "./generate-clinical-master-execution-preset-release-v1.mjs";
import { uuidV5 } from "./generate-clinical-master-order-execution-presets-v1.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const directory = "docs/work/clinical-master/order-execution-defaults/artifacts/wp-07";
const digest = value => createHash("sha256").update(canonicalize(value)).digest("hex");
export const wp07IsolationKeys = ["cm.order.v4.inpatient.02", "cm.order.v4.inpatient.22"];
export const wp07DietPlan = "합성 기능 검증 계획: 급여 여부를 확인하고 식이 인계 내용을 기록한다. 식품·급여량에 대한 임상 처방이 아니며, 실제 급여·섭취 완료는 별도 수행 기록으로 남긴다.";
export function buildWp07RemainingDefinitions() {
  const original = JSON.parse(readFileSync(resolve(root, "tests/fixtures/clinical-master-execution-preset-release-v1.json"), "utf8"));
  const authoring = JSON.parse(readFileSync(resolve(root, "tests/fixtures/clinical-master-system-exam-authoring-v1.json"), "utf8"));
  const expected = { hospitalization: 30, consultation: 55, other: 39, system_exam: 12 };
  const source = original.records.filter(record => Object.hasOwn(expected, record.detail?.executionPreset?.clinicalOrderType));
  for (const [category, count] of Object.entries(expected)) if (source.filter(record => record.detail.executionPreset.clinicalOrderType === category).length !== count) throw Error(`wp07_original_count:${category}`);
  const systemByKey = new Map(authoring.executionPresets.map(entry => [entry.orderKey, entry.preset]));
  if (systemByKey.size !== 12 || source.filter(record => record.detail.executionPreset.clinicalOrderType === "system_exam").some(record => !systemByKey.has(record.masterKey))) throw Error("wp07_system_identity_mismatch");
  const hash = digest({ source, authoring, generator: readFileSync(fileURLToPath(import.meta.url), "utf8") });
  const records = source.map(sourceRecord => {
    const record = structuredClone(sourceRecord);
    const preset = record.detail.executionPreset;
    const type = preset.clinicalOrderType;
    if (type === "system_exam") {
      const system = systemByKey.get(record.masterKey);
      preset.defaultDetailInputs = structuredClone(system.defaultDetailInputs);
      preset.fieldPolicies = structuredClone(system.fieldPolicies);
    }
    if (type === "hospitalization") {
      // The legacy inpatient path is billing-only. Keep it for foreign/history
      // and author an additive care route using the existing treatment queue.
      record.detail.classificationPathKey = "cm.path.inpatient-care-runtime";
      delete preset.defaultDetailInputs.wardOrCage;
      preset.fieldPolicies.wardOrCage = "workspace_resolved";
      preset.defaultDetailInputs.dietPlan = wp07DietPlan;
      preset.fieldPolicies.dietPlan = "preset_fixed";
      if (wp07IsolationKeys.includes(record.masterKey)) {
        preset.defaultDetailInputs.isolationPlan = "합성 격리관리 계획: 등록된 입원 공간을 선택하고 전용 물품·접촉 동선 분리 계획을 인계한다. 실제 격리·소독 시행 여부는 별도 수행 기록으로 남긴다.";
        preset.fieldPolicies.isolationPlan = "preset_fixed";
      }
    }
    if (type === "consultation") {
      delete preset.defaultDetailInputs.responsibleClinicianId;
      preset.fieldPolicies.responsibleClinicianId = "runtime_resolved";
      delete preset.defaultDetailInputs.consultationNote;
    }
    preset.presetRevision += 1;
    preset.presetId = uuidV5(`${preset.presetKey}:${preset.presetRevision}:${hash}`);
    preset.sourceArtifactSha256 = hash;
    preset.provenance = { ...preset.provenance, sourceType: "synthetic-remaining-runtime-v1", generatorProfileKey: `wp07.${type}.v1`,
      prototypeContract: { availabilityIntent: "active", dataOrigin: "synthetic", clinicalValidation: "not_clinically_validated", intendedUse: "prototype_only", clinicalUseAllowed: false },
      sourceNotes: "Preserve exact original identities/species. Registered inpatient locations and clinicians resolve at runtime; synthetic care plans are never actual execution facts. Reuse the existing twelve system-exam authoring identities without normal findings.",
      unresolvedClinicalAuthority: [], clinicalUseNotice: "합성 데모 전용 · 임상 검증 안 됨 · 실제 진료에 사용 금지" };
    preset.contentSha256 = publisherContentHash(preset);
    return record;
  });
  return { schemaVersion: 1, artifactState: "non_applied", runtimeImportAllowed: false, applied: false, sourceArtifactSha256: hash,
    originalCount: source.length, categoryCounts: expected, records,
    supportingRecords: [...authoring.publisherFragment.records.map(record => structuredClone(original.records.find(sourceRecord => sourceRecord.masterKey === record.masterKey) ?? record)), {
      ...structuredClone(original.records.find(record => record.masterKey === "cm.action.inpatient")), masterKey: "cm.action.inpatient-care-runtime",
    }],
    classificationPaths: [...structuredClone(authoring.classificationPaths), {
      ...structuredClone(original.classificationPaths.find(path => path.pathKey === "cm.path.inpatient")),
      pathKey: "cm.path.inpatient-care-runtime", clinicalActionKey: "cm.action.inpatient-care-runtime", taskRouteKey: "phase1a2.fallback.route.NT_TREATMENT",
    }],
    routingCorrections: [{ originalPathKey: "cm.path.inpatient", newPathKey: "cm.path.inpatient-care-runtime",
      previousTaskRouteKey: "phase1a2.fallback.route.NT_BILLING_ONLY", taskRouteKey: "phase1a2.fallback.route.NT_TREATMENT",
      clinicalActionKey: "cm.action.inpatient-care-runtime",
      reason: "Explicit inpatient care execution in the existing treatment queue. A separate supporting action preserves the publisher one-active-path-per-action invariant without retiring the old path for unadopted workspaces and history.", orderCount: 30 }],
    reconciliation: records.map(record => ({ originalMasterKey: record.masterKey, successorMasterKey: record.masterKey, species: record.detail.species, relationship: "same_identity" })),
    systemExamAuthoringArtifactSha256: authoring.artifactSha256, isolationPlanCorrections: wp07IsolationKeys,
    semanticFingerprint: digest(records) };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const artifact = buildWp07RemainingDefinitions(); mkdirSync(resolve(root, directory), { recursive: true });
  writeFileSync(resolve(root, `${directory}/remaining-definitions.non-applied.v1.json`), JSON.stringify(artifact, null, 2) + "\n");
  console.log(JSON.stringify({ original: artifact.originalCount, categories: artifact.categoryCounts, applied: false }));
}
