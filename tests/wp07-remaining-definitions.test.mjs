import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildWp07RemainingDefinitions, wp07DietPlan, wp07IsolationKeys } from "../scripts/generate-wp07-remaining-definitions.mjs";
import { publisherContentHash } from "../scripts/generate-clinical-master-execution-preset-release-v1.mjs";

test("remaining136 preserve original identities, source species and original system-exam identities", () => {
  const result = buildWp07RemainingDefinitions();
  const source = JSON.parse(readFileSync("tests/fixtures/clinical-master-execution-preset-release-v1.json", "utf8"));
  assert.equal(result.records.length, 136); assert.equal(new Set(result.records.map(record => record.masterKey)).size, 136);
  for (const record of result.records) {
    const original = source.records.find(row => row.masterKey === record.masterKey);
    assert.ok(original); assert.deepEqual(record.detail.species, original.detail.species);
    assert.equal(record.detail.executionPreset.contentSha256, publisherContentHash(record.detail.executionPreset));
    assert.equal(record.detail.executionPreset.clinicalUseAllowed, false);
  }
  assert.deepEqual(result.categoryCounts, { hospitalization: 30, consultation: 55, other: 39, system_exam: 12 });
  assert.equal(result.supportingRecords.length, 14); assert.equal(result.classificationPaths.length, 13);
  for (const path of result.classificationPaths.filter(path => path.pathKey.includes("system-exam"))) assert.ok(result.supportingRecords.some(record => record.masterKey === path.clinicalActionKey));
});
test("inpatient plans are authored synthetic policy, resources and actual facts are never invented", () => {
  const result = buildWp07RemainingDefinitions();
  for (const record of result.records.filter(record => record.detail.executionPreset.clinicalOrderType === "hospitalization")) {
    const preset = record.detail.executionPreset;
    assert.equal(record.detail.classificationPathKey, "cm.path.inpatient-care-runtime");
    assert.equal(preset.defaultDetailInputs.wardOrCage, undefined); assert.equal(preset.fieldPolicies.wardOrCage, "workspace_resolved");
    assert.equal(preset.defaultDetailInputs.dietPlan, wp07DietPlan);
    if (wp07IsolationKeys.includes(record.masterKey)) assert.ok(preset.defaultDetailInputs.isolationPlan);
  }
  for (const record of result.records.filter(record => ["consultation", "system_exam"].includes(record.detail.executionPreset.clinicalOrderType))) {
    for (const key of ["responsibleClinicianId", "consultationNote", "findingSummary", "abnormalFindings"]) assert.equal(record.detail.executionPreset.defaultDetailInputs[key], undefined);
  }
});
test("checked-in WP07 artifact reproduces exactly", () => {
  assert.deepEqual(JSON.parse(readFileSync("docs/work/clinical-master/order-execution-defaults/artifacts/wp-07/remaining-definitions.non-applied.v1.json", "utf8")), buildWp07RemainingDefinitions());
});
