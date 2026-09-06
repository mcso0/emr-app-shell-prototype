import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { TREATMENT_FIELD_SCHEMA_V2 } from "../src/features/chart/order-execution-domain.ts";
import { publisherContentHash, canonicalize } from "./generate-clinical-master-execution-preset-release-v1.mjs";
import { uuidV5 } from "./generate-clinical-master-order-execution-presets-v1.mjs";
import { wp04TreatmentDefinitions, wp04MedicationLinkedKeys, wp04MaterialSelectionKeys, wp04DeviceKeys, wp04Sources } from "./lib/wp04-treatment-definitions.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const artifacts = "docs/work/clinical-master/order-execution-defaults/artifacts";
const output = `${artifacts}/wp-04/treatment-definitions.non-applied.v2.json`;
const read = path => JSON.parse(readFileSync(resolve(root, path), "utf8"));
const hash = value => createHash("sha256").update(canonicalize(value)).digest("hex");
const status = { availabilityIntent: "active", dataOrigin: "synthetic", clinicalValidation: "not_clinically_validated", intendedUse: "prototype_only", clinicalUseAllowed: false };
const sourceReferences = {
  D07: { name: "B. Braun 0.9% Sodium Chloride Irrigation USP PIC", route: "periodontal_irrigation", species: ["human"], uri: "https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=0d59a04a-32e6-485b-b638-a1e6c09e9642&version=17", caveat: "General tissue irrigation identity only; veterinary periodontal mapping is synthetic and not a verified label indication" },
  D17: { name: "Virbac Hexarinse Oral Hygiene Rinse chlorhexidine gluconate 0.12%", route: "oral_topical_rinse", species: ["dog","cat"], uri: "https://uk.virbac.com/products/hexarinse-oral-rinse-oral-hygiene-for-dogs-cats?category=106", caveat: "Teeth and gum-line topical rinse, not swallowed drug or deep periodontal-pocket indication" },
  ST01: { name: "Aqupharm 11 (Hartmann's) Solution for Infusion", route: "IV", species: ["dog","cat"], uri: "https://vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_1051408.PDF", caveat: "IV reference only, not label support for SC" },
  ST02: { name: "Nova-Tech Lactated Ringer's Injection", route: "SC", species: ["cattle","horse","sheep","swine"], uri: "https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=96c083ec-bd76-4959-abc9-9b48be7f6f70&version=5", caveat: "No dog/cat labeled species; patient product and route decision required, no label-backed dog/cat SC default" },
  ST07: { name: "Vetericyn Plus Antimicrobial All Animal Eye Wash hypochlorous acid 0.010%", route: "external_ophthalmic_irrigation", species: ["dog","cat"], uri: "https://vetericyn.com/products/vetericyn-plus-antimicrobial-eye-wash", caveat: "External intact-cornea synthetic scenario; not intraocular surgical irrigation" },
  ST14: { name: "Baxter 0.9% Sodium Chloride Irrigation USP UROMATIC", route: "urologic_irrigation", species: ["human"], uri: "https://meded.baxter.com/sites/g/files/ebysai4096/files/2024-12/Dear_HCP_Letter_%2319_Product_from_Thetford_Labeled_in_English.pdf", caveat: "Human UROMATIC irrigation comparator; not saline injection" },
  T14: { name: "PET-EMA docusate sodium 250 mg/12 mL", route: "rectal", species: ["dog","cat"], uri: "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=8fd895c3-78b0-45b9-a338-a724f6b1ba9e", caveat: "Package volume is not dose; unapproved drug other" },
  T16: { name: "BioGlo fluorescein sodium sterile strip 1 mg/strip", route: "ophthalmic", species: ["human"], uri: "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=f72b68c7-a52f-40df-a47d-8e2d8174091d", caveat: "Human diagnostic strip, not drops or mg/mL; supply not verified" },
  T01: { name: "Vetericyn Plus All Animal Antimicrobial Wound Care Spray hypochlorous acid 0.013%", route: "topical_wound_cleansing", species: ["dog","cat"], uri: "https://vetericyn.com/products/vetericyn-plus-antimicrobial-all-animal-wound-and-skin-care", caveat: "Single-product antimicrobial cleansing fixture, not sterilization or a combined lavage/antiseptic quantity" },
  T17: { name: "Virbac Epiotic Advanced salicylic acid 0.2 g/100 mL (Costa Rica formulation)", route: "external_ear_canal", species: ["dog","cat"], uri: "https://cr.virbac.com/products/oticos/epiotic-advanced", caveat: "Pinned regional formulation; not for ruptured tympanum" },
  T18: { name: "Malaseb Shampoo chlorhexidine digluconate 20 mg/mL + miconazole nitrate 20 mg/mL", route: "cutaneous", species: ["dog","cat"], uri: "https://www.vmd.defra.gov.uk/productinformationdatabase/files/QRD_Documents/QRD-Auth_515974.PDF", caveat: "Shampoo identity, not generic chlorhexidine irrigation" },
  A25: { name: "Alfaxan Multidose alfaxalone 10 mg/mL solution for injection", route: "IV", species: ["dog","cat","rabbit"], uri: "https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_1365063.PDF", caveat: "Induction reference; no dose default or analgesia claim" },
  A28: { name: "Alfaxan Multidose alfaxalone 10 mg/mL solution for injection", route: "IV", species: ["dog","cat"], uri: "https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_1365063.PDF", caveat: "Separate injectable anesthesia intent; no IM/SC inference" },
  A27: { name: "IsoFlo isoflurane 100% w/w Inhalation Vapour Liquid", route: "inhalation", species: ["dog","cat"], uri: "https://www.vmd.defra.gov.uk/productinformationdatabase/files/SPC_Documents/SPC_120473.PDF", caveat: "Stock liquid strength is not inspired concentration or administered amount" },
};
sourceReferences["ear-cleaning"] = { ...sourceReferences.T17 };
sourceReferences["wound-cleaning"] = { ...sourceReferences.D07, route: "external_wound_irrigation", caveat: "Human wound-irrigation identity, not veterinary approval or antisepsis" };

export function buildWp04TreatmentDefinitions() {
  const original = read("tests/fixtures/clinical-master-execution-preset-release-v1.json");
  const frozen = read(`${artifacts}/wp-00-frozen-manifest.v1.json`);
  const candidates = read(`${artifacts}/wp-01a-order-default-candidates.non-applied.v1.json`).candidates.filter(r => r.clinicalOrderType === "treatment");
  const expected = new Set(candidates.map(r => r.orderId));
  const definitions = wp04TreatmentDefinitions;
  if (definitions.length !== 111 || expected.size !== 111 || new Set(definitions.map(d => d.orderMasterKey)).size !== 111 || definitions.some(d => !expected.has(d.orderMasterKey))) throw Error("treatment_coverage_mismatch");
  const sourceArtifactSha256 = hash({ frozen: frozen.semanticFingerprint, definitions, schema: TREATMENT_FIELD_SCHEMA_V2, sourceReferences,
    authoringSha: createHash("sha256").update(readFileSync(fileURLToPath(import.meta.url))).digest("hex") });
  const records = definitions.map(d => {
    const record = structuredClone(original.records.find(r => r.masterKey === d.orderMasterKey));
    if (!record?.detail.executionPreset) throw Error(`missing_original:${d.orderMasterKey}`);
    const old = record.detail.executionPreset;
    const linkedMedication = wp04MedicationLinkedKeys.includes(d.key);
    const device = wp04DeviceKeys.includes(d.key);
    const material = wp04MaterialSelectionKeys.includes(d.key);
    const preparation = d.procedureKind === "preparation";
    const values = { procedureKind: d.procedureKind, method: d.method, site: d.site,
      plannedProcedureCount: 1, procedureCountUnit: d.key === "A33" ? "load" : "session", frequency: "once", schedule: d.schedule,
      administrationPolicy: linkedMedication ? "separate_medication_order" : "not_applicable",
      stagedInstructions: [
        `합성 데모 시나리오 ${d.key}: 환자·범위·계획을 확인한다.`, d.method + ".",
        preparation ? "준비 확인 결과만 기록한다. 실제 수술·천자·마취·멸균 완료로 기록하지 않는다." : "실제 수행한 범위와 결과를 수행기록에 직접 입력한다.",
        linkedMedication ? "약품 제품·용량·경로는 같은 진료의 별도 약품 오더를 연결한다. 이 처치의 1 session을 약품 용량으로 해석하지 않는다." : "추가 약품 사용은 별도 약품 오더로 분리한다.",
        material ? "환자별 사용할 재료·용액을 확인하고 계획과 실제 사용량을 별도로 기록한다." : "관찰값·완료 상태를 미리 채우지 않는다.",
      ].join("\n"),
      exceptions: "합성 기능 검증용이며 실제 진료 지시가 아님. 환자·부위·연결 오더·재료가 계획과 다르면 시작 전 확인하고, 시행 차이와 중단 사유를 기록한다.",
    };
    if (material) {
      const reference = sourceReferences[d.key];
      if (!reference) throw Error(`missing_material_identity:${d.key}`);
      Object.assign(values, { administrationPolicy: "direct_quantity", productReference: reference.name,
        plannedRoute: reference.route, plannedAmount: 1, plannedAmountUnit: d.key === "T16" ? "strip" : "mL" });
      values.stagedInstructions += "\n예정량 1은 저장·수정·단위 비교를 검증하는 임의 합성값이며 적정 사용량이나 투여 지시가 아니다. 실제 수행량에 복사하지 않는다.";
      values.exceptions += ` 제품 참조 범위: ${reference.caveat}`;
    }
    if (device) values.deviceProtocol = d.key === "T15"
      ? "TONOVET Plus 반발식 안압계 식별 참조 · mmHg 결과는 수기 입력 · 장비 연동 없음 · 정상범위를 기기 측정범위로 만들지 않음"
      : `CLAiR SIM-${d.key}-MANUAL-01 · 합성 수기 프로토콜 · 장비 연동 없음. 기기/설정 식별, 세션 범위, 실제 점검/관찰 결과를 각각 기록한다. 제조사 IFU나 임상 수치 설정을 대체하지 않는다.`;
    if (d.procedureKind === "monitoring") {
      values.observationDomains = d.key === "A29" ? ["체온","측정 시각"] : d.key === "A30" ? ["혈압","측정 방식","측정 시각"]
        : d.key === "A31" ? ["호흡 양상","호흡 관찰 시각"] : d.key === "A34" ? ["행동 변화","자세 변화","접촉 반응"]
          : ["의식·반응","호흡 상태","순환 상태","체온","관찰 시각"];
      if (d.key === "A34") values.deviceProtocol = "CLAiR SIM-PAIN-OBSERVATION-01 · 비점수화 합성 관찰 체크리스트 · 검증된 통증 척도나 임상 점수로 해석하지 않음";
    }
    if (d.key === "T15") values.measurementUnit = "mmHg";
    const policies = Object.fromEntries(TREATMENT_FIELD_SCHEMA_V2.fields.map(field => [field.key,
      Object.hasOwn(values, field.key) ? "preset_fixed" : field.key === "linkedMedicationOrderId" && linkedMedication ? "required_manual" : "not_applicable"]));
    const evidence = d.key === "T15" ? [wp04Sources.tonometry] : /^(SD|D)/.test(d.key) ? [wp04Sources.dental]
      : /^(SA|A)/.test(d.key) ? [wp04Sources.anesthesia] : ["ST01","ST02"].includes(d.key) ? [wp04Sources.fluids] : [];
    const preset = { ...old, presetRevision: old.presetRevision + 1, detailSchemaVersion: 2,
      defaultDetailInputs: values, fieldPolicies: policies, sourceArtifactSha256,
      provenance: { ...old.provenance, prototypeContract: status, generatorProfileKey: `wp04.${d.key}.v2`,
        sourceType: "primary-workflow-plus-explicit-synthetic-functional-fixture", workflowSourceUris: evidence,
        referenceProduct: sourceReferences[d.key] ?? null,
        fieldEvidence: { method: "synthetic_assumption", site: "synthetic_scope_not_patient_finding", plannedProcedureCount: "synthetic_session_count_not_dose",
          schedule: "synthetic_workflow_phase", deviceProtocol: device ? "explicit_synthetic_manual_unintegrated" : "not_applicable",
          measurementUnit: d.key === "T15" ? "manufacturer_display_unit_not_reference_range" : "not_applicable" },
        materialQuantityEvidence: material ? "arbitrary_synthetic_test_value_not_clinical_quantity" : "not_applicable",
        sourceNotes: "111 explicit procedure identities. Sources support workflow separation/product identity only; authored scenarios are not clinical protocols or dosing guidance.",
        unresolvedClinicalAuthority: [], clinicalUseNotice: "합성 데모 전용 · 임상 검증 안 됨 · 실제 진료에 사용 금지" },
      presetStatus: "synthetic_unreviewed", clinicalUseAllowed: false };
    preset.presetId = uuidV5(`preset-version:${preset.presetKey}:${preset.presetRevision}:${sourceArtifactSha256}`);
    preset.contentSha256 = publisherContentHash(preset);
    record.detail.executionPreset = preset;
    return record;
  });
  return { schemaVersion: 2, artifactState: "non_applied", runtimeImportAllowed: false, applied: false, targetStatus: status,
    originalTreatmentCount: 111, successorTreatmentCount: 111, originalManifestFingerprint: frozen.semanticFingerprint,
    sourceArtifactSha256, sourceReferences, schema: TREATMENT_FIELD_SCHEMA_V2,
    categoryCounts: Object.fromEntries([...new Set(definitions.map(d => d.procedureKind))].sort().map(kind => [kind, definitions.filter(d => d.procedureKind === kind).length])),
    patientInputPolicy: "Medication-order IDs are encounter-owned; planned session count never fills a missing medicine dose. Source products are references, not silently selected medication orders.",
    remainingReview: [],
    clinicalLimitations: ["Material planned quantities are arbitrary storage/UI fixtures, not recommended quantities or clinical defaults",
      "Device protocols are explicitly synthetic manual metadata, not manufacturer settings or an integration",
      "Human/regional source and unverified veterinary-route limits remain explicit on each affected reference"],
    records, semanticFingerprint: hash(records) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const artifact = buildWp04TreatmentDefinitions();
  mkdirSync(resolve(root, `${artifacts}/wp-04`), { recursive: true });
  writeFileSync(resolve(root, output), JSON.stringify(artifact, null, 2) + "\n");
  console.log(JSON.stringify({ output, count: artifact.records.length, applied: false, kinds: artifact.categoryCounts }));
}
