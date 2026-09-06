import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildWp03DispensingDefinitions, assertDefinition } from "../scripts/generate-wp03-dispensing-definitions.mjs";

test("all 159 dispensing identities reconcile without clinical equivalence or hidden removals", () => {
  const a = buildWp03DispensingDefinitions();
  assert.equal(a.records.length, 127); assert.equal(a.replacementLedger.length, 51);
  assert.equal(new Set(a.replacementLedger.map(row => row.originalMasterKey)).size, 51);
  assert.ok(a.replacementLedger.every(row => a.records.some(record => record.masterKey === row.replacementMasterKey)));
  assert.ok(a.replacementLedger.every(row => row.relationship === "authored_product_redefinition_not_clinical_equivalence"));
  const frozen = JSON.parse(readFileSync("docs/work/clinical-master/order-execution-defaults/artifacts/wp-00-frozen-manifest.v1.json"));
  const covered = new Set([...a.records.map(record => record.masterKey), ...a.replacementLedger.map(row => row.originalMasterKey)]);
  assert.ok(frozen.entries.filter(row => row.clinicalOrderType === "dispensing").every(row => covered.has(row.orderId)));
  assert.equal(a.applicationStatus, "non_applied");
});

test("all existing product-specific quantities stay unchanged with explicit corrected arithmetic", () => {
  const a = buildWp03DispensingDefinitions();
  const legacy = JSON.parse(readFileSync("docs/work/clinical-master/clinical-master-pr-019/dispensing-master-presets.v1.json"));
  for (const source of legacy.entries) {
    const record = a.records.find(record => record.masterKey === source.orderMasterKey);
    const values = { ...record.detail.executionPreset.defaultDetailInputs }; delete values.planOrderAuthority;
    assert.deepEqual(values, source.detailInputs); assertDefinition(record);
  }
  for (const id of ["a010086", "a010709", "a011395"]) {
    const record = a.records.find(record => record.masterKey.endsWith(id));
    assert.equal(record.detail.executionPreset.defaultDetailInputs.planOrderAuthority.preparationPolicy.increment, 0.1);
    assert.ok(a.roundingReconciliation.some(row => row.orderMasterKey === record.masterKey));
  }
});

test("human source applicability is not promoted to veterinary source evidence", () => {
  const a = buildWp03DispensingDefinitions();
  const human = a.records.filter(record => record.detail.executionPreset.defaultDetailInputs.planOrderAuthority.productReference.referenceSpecies.includes("human"));
  assert.equal(human.length, 9);
  for (const record of human) {
    const p = record.detail.executionPreset;
    assert.equal(p.provenance.fieldEvidence.dose, "synthetic_assumption");
    assert.deepEqual(p.provenance.referenceSpecies, ["human"]);
    assert.equal(p.clinicalUseAllowed, false);
    assert.equal(p.provenance.prototypeContract.clinicalValidation, "not_clinically_validated");
  }
  for (const record of a.records) {
    const a = record.detail.executionPreset.defaultDetailInputs.planOrderAuthority;
    assert.equal(a.calculationMode, "product_unit"); assert.equal(a.unitConversions, undefined);
  }
});

test("checked-in V2 definitions reproduce from pinned authoring inputs", () => {
  assert.deepEqual(JSON.parse(readFileSync("docs/work/clinical-master/order-execution-defaults/artifacts/wp-03/dispensing-definitions.non-applied.v2.json")), buildWp03DispensingDefinitions());
});
