import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildCbcRuntimeCandidate } from "./generate-oed-lab04-cbc-runtime-candidate.mjs";
import { uuidV5 } from "./generate-clinical-master-order-execution-presets-v1.mjs";
import { canonicalize, publisherContentHash } from "./generate-clinical-master-execution-preset-release-v1.mjs";
import { parseLabResultProfile } from "../src/features/lab-imaging/result-profile-contract.ts";
import { expandLabComposition } from "../src/features/lab-imaging/composition-contract.ts";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const folder = "docs/work/clinical-master/order-execution-defaults/artifacts/oed-lab-04";
const read = path => JSON.parse(readFileSync(resolve(root, path), "utf8"));
const digest = value => createHash("sha256").update(canonicalize(value)).digest("hex");
const name = record => record.names.find(n => n.languageCode === "ko" && n.nameKind === "preferred")?.name ?? record.names[0].name;
const code = (value, label, judgment = "not_judged") => ({ code: value, label, judgment });

// Authoring-only explicit assay code sets. Never infer result shape at runtime.
function codesFor(testCode, species) {
  if (testCode === "BLOOD_TYPE") return species === "cat"
    ? [code("A", "A형"), code("B", "B형"), code("AB", "AB형"), code("inconclusive", "판정 불가")]
    : [code("dea1_positive", "DEA 1 양성"), code("dea1_negative", "DEA 1 음성"), code("inconclusive", "판정 불가")];
  if (testCode === "UA_SG") return [code("below_fixture_band", "합성 비중 구간 미만"), code("within_fixture_band", "합성 비중 구간 내"), code("above_fixture_band", "합성 비중 구간 초과")];
  if (["UA_STRIP", "UA_BILIRUBIN", "UA_GLUCOSE", "UA_KETONE"].includes(testCode))
    return [code("negative", "음성", "normal"), code("trace", "미량"), code("1_plus", "1+", "abnormal"), code("2_plus", "2+", "abnormal"), code("3_plus", "3+", "abnormal"), code("inconclusive", "판정 불가")];
  if (["GIARDIA_AG", "BABESIA_PCR", "CDV_AG", "CHW_AG", "CPV_AG", "FECAL_OB", "FCOV_AB", "FIV_AB", "FELV_AG", "FPV_AG"].includes(testCode))
    return [code("negative", "음성", testCode.endsWith("_AB") ? "not_judged" : "normal"), code("positive", "양성", testCode.endsWith("_AB") ? "not_judged" : "abnormal"), code("inconclusive", "판정 불가")];
  throw Error(`unauthored_coded_assay:${testCode}`);
}

export function buildAllLabRuntimeCandidate() {
  const original = read("tests/fixtures/clinical-master-execution-preset-release-v1.json");
  const legacy = read(`${folder}/legacy-metabolic-source-records.v1.json`);
  const cbc = buildCbcRuntimeCandidate();
  const hash = digest({ original, legacy, cbc: cbc.semanticFingerprint, authoring: readFileSync(fileURLToPath(import.meta.url), "utf8") });
  const sources = new Map([...original.records, ...legacy.records].map(r => [r.masterKey, r]));
  const records = new Map(cbc.records.map(r => [r.masterKey, structuredClone(r)]));
  const orderProfiles = new Map(cbc.labOrderProfiles.map(p => [p.orderMasterKey, structuredClone(p)]));
  const compositions = structuredClone(cbc.compositions);
  const panels = [...original.labPanelItems, ...legacy.records.flatMap(r => r.labPanelItems ?? [])];
  const originalProfiles = original.labOrderProfiles;
  const atomicByTestSpecimen = new Map();
  const atomicByTest = new Map();
  for (const p of [...originalProfiles, ...cbc.labOrderProfiles]) if (p.labTestMasterKey)
    { atomicByTestSpecimen.set(`${p.labTestMasterKey}|${p.specimenMasterKey}`, p.orderMasterKey);
      if (!atomicByTest.has(p.labTestMasterKey)) atomicByTest.set(p.labTestMasterKey, new Set());
      atomicByTest.get(p.labTestMasterKey).add(p.orderMasterKey); }
  const template = original.records.find(r => r.masterKey === "cm.order.lab.test.cbc-wbc");
  const newAtomic = [];
  function addOrder(key, test, specimen, old) {
    if (orderProfiles.has(key)) return;
    const record = structuredClone(old ?? template);
    record.masterKey = key;
    if (!old) record.names = [{ languageCode: "ko", nameKind: "preferred", name: name(test), searchable: true, sortOrder: 0 }];
    const preset = record.detail.executionPreset;
    preset.presetKey = `preset:execution:${key}`;
    preset.presetRevision = old ? preset.presetRevision + 1 : 1;
    preset.presetId = uuidV5(`${preset.presetKey}:${preset.presetRevision}:${hash}`);
    preset.sourceArtifactSha256 = hash;
    // Keep authored specimen enum and bind the exact specimen identity separately.
    const specimenEnums = { "cm.specimen.serum": "blood", "cm.specimen.citrate-plasma": "blood", "cm.specimen.urine": "urine", "phase1.optionb.v1.specimen.serum": "blood" };
    if (!old && !specimenEnums[specimen]) throw Error(`unauthored_specimen_enum:${specimen}`);
    preset.defaultDetailInputs = { ...preset.defaultDetailInputs, ...(!old ? { specimenType: specimenEnums[specimen] } : {}), testPanel: name(record),
      collectionCondition: `${name(sources.get(specimen))} · 합성 검체 라벨 및 요청 환자 확인`,
      pretreatment: "합성 수기 수행 · 선택한 프로필과 검체 상태 확인 · 장비 연동 없음" };
    preset.fieldPolicies = { ...preset.fieldPolicies, testPanel: "preset_fixed", collectionCondition: "preset_fixed", pretreatment: "preset_fixed" };
    preset.provenance = { ...preset.provenance, sourceType: "synthetic-lab-runtime-v1", generatorProfileKey: "oed-lab04.all.v1", unresolvedClinicalAuthority: [],
      sourceNotes: "Explicit source assay/specimen identity. Functional fixtures are not clinical reference intervals.", clinicalUseNotice: "합성 기능 검증 전용 · 임상 검증 안 됨 · 실제 진료 사용 금지" };
    preset.contentSha256 = publisherContentHash(preset);
    records.set(key, record);
    orderProfiles.set(key, { orderMasterKey: key, labTestMasterKey: test.masterKey, labPanelMasterKey: null, specimenMasterKey: specimen });
    if (!old) newAtomic.push({ orderMasterKey: key, testMasterKey: test.masterKey, specimenMasterKey: specimen });
  }
  for (const p of originalProfiles.filter(p => p.labTestMasterKey)) addOrder(p.orderMasterKey, sources.get(p.labTestMasterKey), p.specimenMasterKey, sources.get(p.orderMasterKey));
  for (const p of originalProfiles.filter(p => p.labPanelMasterKey)) {
    if (compositions.some(c => c.originalOrderMasterKey === p.orderMasterKey)) continue;
    const members = panels.filter(m => m.panelMasterKey === p.labPanelMasterKey).sort((a, b) => a.sortOrder - b.sortOrder);
    if (!members.length) throw Error(`unresolved_panel:${p.orderMasterKey}`);
    const rootRecord = sources.get(p.orderMasterKey);
    compositions.push({ schemaVersion: 1, id: uuidV5(`lab-composition:${p.orderMasterKey}:1:${hash}`), masterKey: p.orderMasterKey,
      revision: 1, displayName: name(rootRecord), originalOrderMasterKey: p.orderMasterKey, targetSpecies: rootRecord.detail.species,
      members: members.map(member => {
        const pair = `${member.testMasterKey}|${p.specimenMasterKey}`;
        let key = atomicByTestSpecimen.get(pair);
        // A multi-specimen set's root specimen is not an atomic assay specimen.
        // Prefer the exact existing assay's single independently authored order.
        if (!key && atomicByTest.has(member.testMasterKey)) {
          const candidates = [...atomicByTest.get(member.testMasterKey)];
          if (candidates.length !== 1) throw Error(`ambiguous_atomic_specimen:${member.testMasterKey}`);
          key = candidates[0];
        }
        if (!key) {
          key = `cm.order.lab.atomic.${member.testMasterKey.replaceAll(".", "-")}.${p.specimenMasterKey.replaceAll(".", "-")}`;
          atomicByTestSpecimen.set(pair, key);
          addOrder(key, sources.get(member.testMasterKey), p.specimenMasterKey);
        }
        return { kind: "order", memberKey: key, defaultIncluded: member.required };
      }) });
  }
  // Include immutable vocabulary dependencies with unchanged source details.
  for (const p of orderProfiles.values()) {
    const test = records.get(p.labTestMasterKey) ?? sources.get(p.labTestMasterKey);
    if (!test) throw Error(`missing_test:${p.labTestMasterKey}`);
    records.set(test.masterKey, structuredClone(test));
    for (const key of [p.specimenMasterKey, test.detail.resultInputTypeKey, test.detail.canonicalUnitKey].filter(Boolean)) {
      const dependency = sources.get(key) ?? records.get(key);
      if (!dependency) throw Error(`missing_dependency:${key}`);
      if (!records.has(key)) records.set(key, structuredClone(dependency));
    }
  }
  const groups = new Map();
  for (const p of orderProfiles.values()) {
    if (cbc.labOrderProfiles.some(c => c.orderMasterKey === p.orderMasterKey)) continue;
    for (const species of records.get(p.orderMasterKey).detail.species) {
      if (!["dog", "cat"].includes(species)) throw Error(`unsupported_species:${species}`);
      const key = `${species}|${p.specimenMasterKey}`;
      if (!groups.has(key)) groups.set(key, new Set());
      groups.get(key).add(p.labTestMasterKey);
    }
  }
  const profiles = [...cbc.profiles];
  for (const [group, tests] of groups) {
    const [species, specimen] = group.split("|");
    const profileKey = `cm.lab-profile.functional.${specimen}.${species}`;
    const profile = { schemaVersion: 1, id: uuidV5(`lab-result-profile:${profileKey}:1:${hash}`), profileKey, revision: 1,
      name: `CLAiR 합성 수기 · ${name(sources.get(specimen))} · ${species === "dog" ? "개" : "고양이"}`, species, specimenMasterKey: specimen,
      method: "synthetic_manual_entry", device: { manufacturer: "CLAiR", model: "SYNTHETIC-LAB-MANUAL", kind: "manual" }, entryMode: "manual_entry",
      integrationStatus: "not_integrated", dataOrigin: "synthetic_functional_fixture", clinicalUseAllowed: false, clinicalValidation: "not_clinically_validated",
      rules: [...tests].sort().map(key => {
        const test = records.get(key); const kind = records.get(test.detail.resultInputTypeKey).detail.valueKind;
        const numeric = kind === "numeric"; const unit = test.detail.canonicalUnitKey ? records.get(test.detail.canonicalUnitKey).detail : null;
        return { testMasterKey: key, code: test.detail.testCode, resultValueKind: kind, unit: unit?.symbol ?? null,
          decimalScale: numeric ? test.detail.decimalScale ?? unit?.decimalScale ?? 0 : null, supported: true, numericMin: numeric ? 0 : null, numericMax: null,
          referenceInterval: numeric ? { low: 10, high: 20, lowInclusive: true, highInclusive: true } : null, displayRange: null,
          codes: kind === "coded" ? codesFor(test.detail.testCode, species) : [], referenceStatus: numeric ? "synthetic_functional_fixture" : "not_applicable",
          provenance: { generatedFromSha256: hash, authority: "prototype_functional_only", fixtureRule: numeric ? "Deliberately synthetic [10,20] test band in the preserved unit; NOT a species/assay clinical interval." : "Explicit assay-specific prototype codes; no clinical validation", sourceTestMasterKey: key } };
      }), provenance: { generatedFromSha256: hash, clinicalUseNotice: "임의의 기능 검증 구간 · 실제 정상범위 아님 · 실제 진료 사용 금지" } };
    if (!parseLabResultProfile(profile)) throw Error(`invalid_profile:${profileKey}`);
    profiles.push(profile);
  }
  const expandedCompositions = compositions.map(c => ({ masterKey: c.masterKey, leaves: expandLabComposition(compositions, c.masterKey, new Set(orderProfiles.keys())) }));
  const reconciliation = originalProfiles.map(p => ({ originalOrderMasterKey: p.orderMasterKey,
    runtimeKind: p.labPanelMasterKey ? "composition" : "atomic", runtimeKey: p.orderMasterKey,
    sourceSpecimenMasterKey: p.specimenMasterKey, sourceTestMasterKey: p.labTestMasterKey, sourcePanelMasterKey: p.labPanelMasterKey }));
  if (reconciliation.length !== 86 || new Set(reconciliation.map(r => r.originalOrderMasterKey)).size !== 86) throw Error("original86_reconciliation_failed");
  const canonicalRecords = [...records.values()].map(record => Object.fromEntries(Object.entries(record)
    .filter(([key]) => ["masterKey", "recordType", "lifecycleStatus", "safetyStatus", "safetyReason", "names", "source", "detail"].includes(key))));
  const payload = { profiles, records: canonicalRecords, labOrderProfiles: [...orderProfiles.values()], compositions, expandedCompositions, reconciliation, newAtomic };
  return { schemaVersion: 1, artifactState: "non_applied", runtimeImportAllowed: false, applied: false, sourceArtifactSha256: hash,
    ...payload, requiresProfileOrderKeys: [...orderProfiles.keys()], semanticFingerprint: digest(payload) };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const artifact = buildAllLabRuntimeCandidate(); mkdirSync(resolve(root, folder), { recursive: true });
  writeFileSync(resolve(root, `${folder}/all-runtime.non-applied.v1.json`), JSON.stringify(artifact, null, 2) + "\n");
  console.log(JSON.stringify({ original: artifact.reconciliation.length, atomic: artifact.labOrderProfiles.length, compositions: artifact.compositions.length, profiles: artifact.profiles.length, addedBeyondCbc: artifact.newAtomic.length, applied: false }));
}
