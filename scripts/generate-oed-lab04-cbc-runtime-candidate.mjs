import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { uuidV5 } from "./generate-clinical-master-order-execution-presets-v1.mjs";
import { canonicalize, publisherContentHash } from "./generate-clinical-master-execution-preset-release-v1.mjs";
import { parseLabResultProfile } from "../src/features/lab-imaging/result-profile-contract.ts";
import { expandLabComposition } from "../src/features/lab-imaging/composition-contract.ts";
const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const folder = "docs/work/clinical-master/order-execution-defaults/artifacts";
const read = path => JSON.parse(readFileSync(resolve(root, path), "utf8"));
const digest = value => createHash("sha256").update(canonicalize(value)).digest("hex");
const testKey = key => key.startsWith("candidate.lab-test.cbc.") ? key.replace("candidate.lab-test.cbc.", "cm.lab-test.cbc-").replace(/\.v1$/, "").replaceAll("_", "-") : key;
const orderKey = key => key.startsWith("candidate.order.cbc.") ? key.replace("candidate.order.cbc.", "cm.order.lab.test.cbc-").replace(/\.v1$/, "").replaceAll("_", "-") : key;
const setKey = key => key.startsWith("candidate.set.cbc.") ? key.replace("candidate.set.cbc.", "cm.lab-composition.cbc-").replace(/\.v1$/, "") : key;
const units = { "10*6/uL": "cm.unit.million-per-ul", "10*3/uL": "cm.unit.k-per-ul", "%": "cm.unit.percent", "g/dL": "cm.unit.g-dl", "fL": "cm.unit.fl", "pg": "cm.unit.pg" };

export function buildCbcRuntimeCandidate() {
  const source = read(`${folder}/oed-lab-02/cbc-result-profiles.non-applied.v1.json`);
  const definitions = read(`${folder}/oed-lab-02/cbc-result-definitions.non-applied.v1.json`).definitions;
  const orders = read(`${folder}/oed-lab-02/cbc-order-candidates.non-applied.v1.json`);
  const original = read("tests/fixtures/clinical-master-execution-preset-release-v1.json");
  const authoringHash = createHash("sha256").update(readFileSync(fileURLToPath(import.meta.url))).digest("hex");
  const sourceHash = digest({ source, definitions, orders, authoringHash });
  const profiles = source.profiles.map(profile => {
    const profileKey = profile.profileId.replace(/^candidate\.profile\./, "cm.lab-profile.").replace(/\.v1$/, "");
    const syntheticManual = profileKey.includes("clair-demo");
    return { schemaVersion: 1, id: uuidV5(`lab-result-profile:${profileKey}:1:${sourceHash}`), profileKey, revision: 1,
      name: `${syntheticManual ? "CLAiR 합성 CBC" : "ProCyte Dx 2019 공개값 참조"} · ${profile.species === "dog" ? "개" : "고양이"}`,
      species: profile.species, specimenMasterKey: profile.specimenKey, method: profile.method,
      device: { manufacturer: syntheticManual ? "CLAiR" : "IDEXX", model: syntheticManual ? "SYNTHETIC-CBC-MANUAL" : "ProCyte Dx", kind: syntheticManual ? "manual" : "analyzer_reference" },
      entryMode: "manual_entry", integrationStatus: "not_integrated", dataOrigin: profile.provenance,
      clinicalUseAllowed: false, clinicalValidation: "not_clinically_validated",
      rules: profile.rules.map(rule => ({ testMasterKey: testKey(rule.resultDefinitionId), code: rule.code,
        resultValueKind: "numeric", unit: rule.unit, decimalScale: rule.decimalScale ?? definitions.find(d => d.code === rule.code).decimalScale,
        supported: rule.resultSupported, numericMin: 0, numericMax: rule.unit === "%" ? 100 : null,
        referenceInterval: rule.referenceInterval ? { low: rule.referenceInterval.low, high: rule.referenceInterval.high, lowInclusive: true, highInclusive: true } : null,
        displayRange: rule.displayRange ? { low: rule.displayRange.low, high: rule.displayRange.high } : null,
        codes: [], referenceStatus: rule.referenceInterval ? syntheticManual ? "synthetic_functional_fixture" : "source_found" : "unavailable",
        provenance: { sourceProfileId: profile.profileId, sourceIds: rule.sourceIds ?? [], sourceLocator: rule.sourceLocator ?? null,
          displayRangeMeaning: rule.displayRange?.meaning ?? null, syntheticRule: rule.syntheticRule ?? null, criticalThresholds: null,
          generatedFromSha256: sourceHash } })),
      provenance: { sourceProfileId: profile.profileId, generatedFromSha256: sourceHash, sourceRevision: source.revision,
        documentRevision: profile.documentRevision ?? null, latestInstalledVersionVerified: false, numericUse: "prototype_only_not_clinically_validated" } };
  });
  for (const species of ["dog", "cat"]) {
    const profileKey = `cm.lab-profile.clair-demo-smear.${species}`;
    profiles.push({ schemaVersion: 1, id: uuidV5(`lab-result-profile:${profileKey}:1:${sourceHash}`), profileKey, revision: 1,
      name: `CLAiR 합성 혈액도말 · ${species === "dog" ? "개" : "고양이"}`, species,
      specimenMasterKey: source.manualProfile.specimenKey, method: "manual_microscopy",
      device: { manufacturer: "CLAiR", model: "SYNTHETIC-SMEAR-MANUAL", kind: "manual" },
      entryMode: "manual_entry", integrationStatus: "not_integrated", dataOrigin: "synthetic_functional_fixture",
      clinicalUseAllowed: false, clinicalValidation: "not_clinically_validated",
      rules: [{ testMasterKey: "cm.lab-test.synthetic-14", code: "SMEAR", resultValueKind: "coded", unit: null, decimalScale: null,
        supported: true, numericMin: null, numericMax: null, referenceInterval: null, displayRange: null,
        codes: [{ code: "unremarkable", label: "특이 소견 없음", judgment: "normal" }, { code: "abnormal", label: "이상 소견", judgment: "abnormal" },
          { code: "inconclusive", label: "판정 불가", judgment: "not_judged" }, { code: "not_performed", label: "미시행", judgment: "not_judged" }],
        referenceStatus: "not_applicable", provenance: { sourceProfileId: source.manualProfile.profileId, generatedFromSha256: sourceHash,
          interpretationMapping: "prototype_qualitative_codes_not_numeric_flags" } }],
      provenance: { sourceProfileId: source.manualProfile.profileId, generatedFromSha256: sourceHash } });
  }
  if (profiles.some(profile => !parseLabResultProfile(profile))) throw Error("runtime_profile_invalid");
  const records = [];
  for (const [unitCode, symbol] of [["fl", "fL"], ["pg", "pg"]]) records.push({
    ...structuredClone(original.records.find(r => r.masterKey === "cm.unit.g-dl")), masterKey: `cm.unit.${unitCode}`,
    names: [{ languageCode: "en", nameKind: "preferred", name: symbol, searchable: true, sortOrder: 0 }],
    detail: { unitCode, symbol, decimalScale: 1 } });
  const orderTemplate = original.records.find(r => r.masterKey === "cm.order.lab.test.cbc-wbc");
  const testTemplate = original.records.find(r => r.masterKey === "cm.lab-test.cbc-wbc");
  for (const definition of definitions) {
    const key = testKey(definition.resultDefinitionId);
    const old = original.records.find(r => r.masterKey === key);
    const coded = definition.kind !== "quantity";
    if (!coded && !units[definition.unit]) throw Error(`unit_mapping_missing:${definition.code}:${definition.unit}`);
    records.push({ ...structuredClone(old ?? testTemplate), masterKey: key,
      names: [{ languageCode: "ko", nameKind: "preferred", name: definition.displayName, searchable: true, sortOrder: 0 }],
      detail: { testCode: old?.detail.testCode ?? definition.code, resultInputTypeKey: coded ? "cm.result-input.coded" : "cm.result-input.numeric",
        canonicalUnitKey: coded ? null : units[definition.unit], decimalScale: coded ? null : definition.decimalScale } });
  }
  const labOrderProfiles = [];
  const idReconciliation = [];
  for (const order of orders.orders) {
    const key = orderKey(order.orderId);
    const old = original.records.find(r => r.masterKey === key);
    const record = structuredClone(old ?? orderTemplate);
    record.masterKey = key;
    record.names = [{ languageCode: "ko", nameKind: "preferred", name: order.displayName, searchable: true, sortOrder: 0 }];
    const preset = record.detail.executionPreset;
    preset.presetKey = `preset:execution:${key}`;
    preset.presetRevision = old ? preset.presetRevision + 1 : 1;
    preset.presetId = uuidV5(`${preset.presetKey}:${preset.presetRevision}:${sourceHash}`);
    preset.sourceArtifactSha256 = sourceHash;
    preset.defaultDetailInputs = { specimenType: "blood", testPanel: order.displayName,
      collectionCondition: "합성 EDTA 전혈 시나리오 · 환자 및 검체 라벨 확인 후 수기 접수",
      pretreatment: "합성 수기 처리 · 선택한 수행 프로필과 검체 상태를 확인하며 장비 연동은 없음" };
    preset.fieldPolicies = { specimenType: "preset_fixed", testPanel: "preset_fixed", collectionCondition: "preset_fixed", pretreatment: "preset_fixed", clinicalContext: "required_manual" };
    preset.provenance = { ...preset.provenance, sourceType: "synthetic-cbc-runtime-v1", generatorProfileKey: "oed-lab04.cbc.v1",
      sourceNotes: "Research-informed synthetic CBC identity; explicit result-profile selection required before confirmation.",
      unresolvedClinicalAuthority: [], clinicalUseNotice: "합성 기능 검증 전용 · 임상 검증 안 됨 · 실제 진료 사용 금지" };
    preset.contentSha256 = publisherContentHash(preset);
    records.push(record);
    labOrderProfiles.push({ orderMasterKey: key, labTestMasterKey: testKey(order.resultDefinitionId), labPanelMasterKey: null, specimenMasterKey: order.specimenKey });
    idReconciliation.push({ code: order.code, candidateOrderKey: order.orderId, orderMasterKey: key, testMasterKey: testKey(order.resultDefinitionId),
      orderDecision: old ? "preserve_existing_identity_new_revision" : "explicit_new_identity", observedTestKey: order.resultDefinitionId });
  }
  const setNames = { "cm.order.lab.panel.cbc-basic": "CBC 검사 세트", "cm.lab-composition.cbc-erythrocytes": "CBC 적혈구 검사 그룹",
    "cm.lab-composition.cbc-leukocytes": "CBC 백혈구 검사 그룹", "cm.lab-composition.cbc-platelets": "CBC 혈소판 검사 그룹",
    "cm.lab-composition.cbc-reticulocytes": "CBC 망상적혈구 검사 그룹" };
  const setKeys = new Set(orders.sets.map(set => setKey(set.setId)));
  const compositions = orders.sets.map(set => {
    const key = setKey(set.setId);
    return { schemaVersion: 1, id: uuidV5(`lab-composition:${key}:1:${sourceHash}`), masterKey: key, revision: 1,
      displayName: setNames[key], originalOrderMasterKey: set.setId.startsWith("cm.order.") ? set.setId : null, targetSpecies: ["dog", "cat"],
      members: set.members.map(member => {
        const key = member.memberId.startsWith("candidate.set.") ? setKey(member.memberId) : orderKey(member.memberId);
        return { kind: setKeys.has(key) ? "composition" : "order", memberKey: key, defaultIncluded: member.defaultIncluded };
      }) };
  });
  // A specifically named synthetic CBC-only checkup verifies three container
  // levels. It is not represented as a complete clinical wellness protocol.
  compositions.push({ schemaVersion: 1, id: uuidV5(`lab-composition:cm.lab-composition.synthetic-cbc-checkup:1:${sourceHash}`),
    masterKey: "cm.lab-composition.synthetic-cbc-checkup", revision: 1, displayName: "합성 CBC 중심 검진 세트", originalOrderMasterKey: null, targetSpecies: ["dog", "cat"],
    members: [{ kind: "composition", memberKey: "cm.order.lab.panel.cbc-basic", defaultIncluded: true }] });
  const expandedCompositions = compositions.map(node => ({ masterKey: node.masterKey, leaves: expandLabComposition(compositions, node.masterKey, new Set(labOrderProfiles.map(p => p.orderMasterKey))) }));
  return { schemaVersion: 1, artifactState: "non_applied", runtimeImportAllowed: false, applied: false,
    sourceArtifactSha256: sourceHash, profiles, records, labOrderProfiles, requiresProfileOrderKeys: labOrderProfiles.map(p => p.orderMasterKey),
    idReconciliation, compositions, expandedCompositions,
    decisionsNotImplied: ["No actual equipment registration or workspace profile selection", "No price or retest billing choice", "No remote publication or adoption"],
    semanticFingerprint: digest({ profiles, records, labOrderProfiles, idReconciliation, compositions }) };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const artifact = buildCbcRuntimeCandidate(); const path = `${folder}/oed-lab-04/cbc-runtime.non-applied.v1.json`;
  mkdirSync(resolve(root, `${folder}/oed-lab-04`), { recursive: true });
  writeFileSync(resolve(root, path), JSON.stringify(artifact, null, 2) + "\n");
  console.log(JSON.stringify({ path, profiles: artifact.profiles.length, records: artifact.records.length, atomicOrders: artifact.labOrderProfiles.length, applied: false }));
}
