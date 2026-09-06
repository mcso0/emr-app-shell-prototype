import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { validateClinicalOrderDetailInputs } from "../src/features/chart/order-execution-domain";
import { parseExecutionPayload } from "../src/features/fulfillment/execution-result-contract";
const artifact = JSON.parse(execFileSync(process.execPath, ["--input-type=module", "-e",
  "import { buildWp06ImagingDefinitions } from './scripts/generate-wp06-imaging-definitions.mjs'; process.stdout.write(JSON.stringify(buildWp06ImagingDefinitions()));"], { encoding: "utf8" }));
const imagingScopeCorrections = artifact.corrections;
const original = JSON.parse(readFileSync("tests/fixtures/clinical-master-execution-preset-release-v1.json", "utf8")).records
  .filter((r: { detail?: { executionPreset?: { clinicalOrderType?: string } } }) => r.detail?.executionPreset?.clinicalOrderType === "imaging");

test("WP06 all30 imaging identities and26 original scopes stay intact; only exact four scopes are corrected", () => {
  expect(artifact.records.map((r: { masterKey: string }) => r.masterKey)).toEqual(original.map((r: { masterKey: string }) => r.masterKey));
  expect(artifact.records).toHaveLength(30);
  expect(Object.keys(imagingScopeCorrections)).toHaveLength(4);
  for (const row of artifact.records) {
    const prior = original.find((r: { masterKey: string }) => r.masterKey === row.masterKey);
    expect({ ...row, detail: undefined }).toEqual({ ...prior, detail: undefined });
    expect({ ...row.detail, executionPreset: undefined }).toEqual({ ...prior.detail, executionPreset: undefined });
    const defaults = row.detail.executionPreset.defaultDetailInputs;
    const corrected = imagingScopeCorrections[row.masterKey as keyof typeof imagingScopeCorrections] ?? {};
    expect(defaults).toEqual({ ...prior.detail.executionPreset.defaultDetailInputs, ...corrected, exceptions: defaults.exceptions });
    expect(validateClinicalOrderDetailInputs({ clinicalOrderType: "imaging", schemaVersion: 1, detailInputs: defaults, requireComplete: true }).valid).toBe(true);
    expect(defaults).not.toHaveProperty("findings");
    expect(defaults).not.toHaveProperty("acquisitionDisposition");
    expect(row.detail.executionPreset.provenance.prototypeContract).toMatchObject({ dataOrigin: "synthetic", clinicalUseAllowed: false });
  }
});

test("WP06 candidate is reproducible and explicitly non-applied", () => {
  expect(JSON.parse(readFileSync("docs/work/clinical-master/order-execution-defaults/artifacts/wp-06/imaging-definitions.non-applied.v1.json", "utf8"))).toEqual(artifact);
  expect(artifact).toMatchObject({ artifactState: "non_applied", runtimeImportAllowed: false, applied: false });
});

test("CT review defaults describe supplied images and never assert new acquisition, contrast or sedation", () => {
  const defaults = artifact.records.find((r: { masterKey: string }) => r.masterKey === "cm.order.v4.imaging.18").detail.executionPreset.defaultDetailInputs;
  expect(defaults).toMatchObject({ contrastRequired: false, sedationRequired: false });
  expect(defaults.imagingProtocol).toContain("신규 촬영·조영·진정을 시행하는 오더가 아니다");
  expect(defaults.exceptions).toContain("과거 CT 촬영의 시행 여부를 단정하지 않는다");
});

test("actual imaging requires explicit acquisition/review disposition, real entered views and interpretation", () => {
  const actual = { acquisitionDisposition: "reviewed_existing", acquiredViews: ["Synthetic supplied CT series"],
    performedProtocol: "Manual supplied-image review", quality: "limited", findings: "Synthetic manually entered finding", interpretation: "Synthetic limited review" };
  expect(parseExecutionPayload("imaging", actual)).toEqual(actual);
  expect(parseExecutionPayload("imaging", { ...actual, acquisitionDisposition: "acquired_new" })).not.toBeNull();
  for (const patch of [{ acquisitionDisposition: undefined }, { acquisitionDisposition: "automatic" }, { acquiredViews: [] },
    { findings: "" }, { quality: "normal" }, { performedByUserId: "spoof" }]) {
    expect(parseExecutionPayload("imaging", { ...actual, ...patch })).toBeNull();
  }
});
