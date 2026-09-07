import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { publisherContentHash, canonicalize } from "./generate-clinical-master-execution-preset-release-v1.mjs";
import { uuidV5 } from "./generate-clinical-master-order-execution-presets-v1.mjs";
const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const folder = "docs/work/clinical-master/order-execution-defaults/artifacts/wp-06";
const digest = value => createHash("sha256").update(canonicalize(value)).digest("hex");
export const imagingScopeCorrections = {
  "cm.order.imaging.echocardiography": { bodyRegion: "심장" },
  "cm.order.synthetic.imaging-08": { bodyRegion: "자궁·태아" },
  "cm.order.v4.imaging.17": { bodyRegion: "흉부·복부 (합성 응급 집중 초음파 시나리오)" },
  "cm.order.v4.imaging.18": { bodyRegion: "흉부 (제공된 합성 CT 판독 범위)", position: "제공된 CT 영상의 기존 촬영 자세 참조",
    contrastRequired: false, sedationRequired: false,
    imagingProtocol: "제공된 합성 CT 영상자료를 검토한다. 신규 촬영·조영·진정을 시행하는 오더가 아니다. 실제 검토한 영상 범위와 판독 결과를 직접 기록한다." },
};
export function buildWp06ImagingDefinitions() {
  const original = JSON.parse(readFileSync(resolve(root, "tests/fixtures/clinical-master-execution-preset-release-v1.json"), "utf8"));
  const source = original.records.filter(r => r.detail?.executionPreset?.clinicalOrderType === "imaging");
  if (source.length !== 30) throw Error("imaging_original30_mismatch");
  const hash = digest({ source, corrections: imagingScopeCorrections, authoring: readFileSync(fileURLToPath(import.meta.url), "utf8") });
  const records = source.map(sourceRecord => {
    const record = structuredClone(sourceRecord); const preset = record.detail.executionPreset;
    const correction = imagingScopeCorrections[record.masterKey] ?? {};
    Object.assign(preset.defaultDetailInputs, correction);
    for (const key of Object.keys(correction)) preset.fieldPolicies[key] = "preset_fixed";
    preset.defaultDetailInputs.exceptions = "합성 기능 검증 시나리오 · 실제 환자와 장비에 적용할 임상 촬영 지시가 아님. 부위·자세·뷰·조영·진정 계획이 다르면 환자별로 수정하고 실제 수행값을 별도로 기록한다.";
    if (record.masterKey === "cm.order.v4.imaging.18") preset.defaultDetailInputs.exceptions += " 조영·진정 false는 이번 판독 오더에서 신규 시행하지 않는다는 뜻이며, 과거 CT 촬영의 시행 여부를 단정하지 않는다. View 수 1은 제공 영상 검토 단위이지 신규 촬영 횟수가 아니다.";
    preset.fieldPolicies.exceptions = "preset_fixed";
    preset.presetRevision += 1; preset.presetId = uuidV5(`${preset.presetKey}:${preset.presetRevision}:${hash}`); preset.sourceArtifactSha256 = hash;
    preset.provenance = { ...preset.provenance, sourceType: "synthetic-imaging-runtime-v1", generatorProfileKey: "wp06.imaging.v1",
      prototypeContract: { availabilityIntent: "active", dataOrigin: "synthetic", clinicalValidation: "not_clinically_validated", intendedUse: "prototype_only", clinicalUseAllowed: false },
      sourceNotes: "Preserved original30 identities and26 authored scopes; four exact-ID synthetic scope corrections. No clinical findings or real device data.",
      unresolvedClinicalAuthority: [], clinicalUseNotice: "합성 데모 전용 · 임상 검증 안 됨 · 실제 진료에 사용 금지" };
    preset.contentSha256 = publisherContentHash(preset);
    return record;
  });
  return { schemaVersion: 1, artifactState: "non_applied", runtimeImportAllowed: false, applied: false, sourceArtifactSha256: hash,
    originalCount: 30, records, corrections: imagingScopeCorrections, semanticFingerprint: digest(records) };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const artifact = buildWp06ImagingDefinitions(); mkdirSync(resolve(root, folder), { recursive: true });
  writeFileSync(resolve(root, `${folder}/imaging-definitions.non-applied.v1.json`), JSON.stringify(artifact, null, 2) + "\n");
  console.log(JSON.stringify({ original: artifact.originalCount, corrections: Object.keys(artifact.corrections).length, applied: false }));
}
