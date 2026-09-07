import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { buildPackage, loadInputs, validateRows, base, sha } from "../scripts/generate-wp01b-taxonomy-mapping.mjs";
const inputs = loadInputs();
const output = buildPackage(inputs);
const row = id => output.mapping.rows.find(row => row.orderId === id);
const check = rows => validateRows(rows, inputs.data.frozen, inputs.data.identity, output.vocabulary);

test("exact frozen522 identities and valid classification pairs", () => {
  check(output.mapping.rows);
  assert.equal(output.mapping.counts.total, 522);
  assert.deepEqual(output.mapping.counts.clinicalTypes, inputs.data.frozen.categoryCounts);
  assert.equal(output.gaps.unresolvedTaxonomyDecisions.length, 0);
});
test("deterministic generation and materialized output equality", () => {
  assert.deepEqual(buildPackage(inputs), output);
  for (const [key, name] of Object.entries({ mapping: "taxonomy-mapping.non-applied.v1.json", vocabulary: "taxonomy-vocabulary-proposal.v1.json", gaps: "taxonomy-gap-list.v1.json" })) {
    assert.deepEqual(JSON.parse(fs.readFileSync(base + "wp-01b/" + name)), output[key]);
  }
});
test("source hashes reference exact current inputs", () => {
  for (const [key, value] of Object.entries(output.mapping.sourceLineage)) assert.equal(value.sha256, sha(inputs.texts[key]));
});
for (const [label, mutate, match] of [
  ["omitted target", rows => rows.pop(), /522/],
  ["duplicate key", rows => { rows[1].orderId = rows[0].orderId; }, /Duplicate mapping/],
  ["duplicate UUID", rows => { rows[1].masterRecordId = rows[0].masterRecordId; }, /Duplicate master/],
  ["foreign key", rows => { rows[0].orderId = "foreign"; }, /Foreign/],
  ["wrong UUID", rows => { rows[0].masterRecordId = "fake"; }, /UUID/],
  ["changed revision", rows => { rows[0].expectedMasterRevision++; }, /revision/],
  ["changed clinical type", rows => { rows[0].clinicalOrderType = "imaging"; }, /Protected/],
  ["changed frozen path", rows => { rows[0].frozenClassificationPathKey = "inferred"; }, /Protected/],
  ["changed observed path", rows => { rows[0].observedClassificationPathKey = "inferred"; }, /Protected/],
  ["unknown subtype", rows => { rows[0].proposed.adminSubcategoryCode = "etc"; }, /subcategory/],
  ["null subtype", rows => { rows[0].proposed.adminSubcategoryCode = null; }, /subcategory/],
  ["invalid subtype type", rows => { rows[0].proposed.adminSubcategoryCode = "ultrasound"; }, /subcategory/],
  ["nonlab family", rows => { rows[0].proposed.labFamilyCode = "cbc"; }, /family/],
  ["missing lab family", rows => { rows.find(row => row.clinicalOrderType === "clinical_lab").proposed.labFamilyCode = null; }, /family/],
  ["unknown lab family", rows => { rows.find(row => row.clinicalOrderType === "clinical_lab").proposed.labFamilyCode = "made-up"; }, /family/],
  ["missing evidence", rows => { rows[0].evidence = []; }, /evidence/],
  ["clinical default hidden in proposed fields", rows => { rows[0].proposed.dose = 1; }, /Unexpected proposed field/],
]) test(`reject ${label}`, () => { const rows = structuredClone(output.mapping.rows); mutate(rows); assert.throws(() => check(rows), match); });

test("changed frozen source fingerprint fails closed", () => {
  const copy = structuredClone(inputs); copy.texts.presets += " ";
  assert.throws(() => buildPackage(copy), /fingerprint/);
});
test("missing actual identity fails closed", () => {
  const copy = structuredClone(inputs); copy.data.identity.rows.pop();
  assert.throws(() => buildPackage(copy), /Missing live identity/);
});
test("product/profile route disagreement fails closed", () => {
  const copy = structuredClone(inputs); copy.data.products.dispensingProfiles[0].allowedRoutes = ["foreign-route"];
  assert.throws(() => buildPackage(copy), /Conflicting product/);
});
test("product revision and saved preset disagreement fail closed", () => {
  const revisionCopy = structuredClone(inputs);
  revisionCopy.data.products.dispensingProfiles[0].productRevision++;
  assert.throws(() => buildPackage(revisionCopy), /Conflicting product/);
  const routeCopy = structuredClone(inputs);
  const key = routeCopy.data.products.dispensingProfiles.find(p => p.allowedRoutes[0] === "oral").orderMasterKey;
  routeCopy.data.presets.entries.find(p => p.masterKey === key).defaultDetailInputs.route = "otic";
  assert.throws(() => buildPackage(routeCopy), /preset route conflict/);
});
test("source route changes on reviewed route-missing scopes require rereview", () => {
  const copy = structuredClone(inputs);
  copy.data.presets.entries.find(p => p.masterKey === "cm.order.synthetic.dispensing-07").defaultDetailInputs.route = "PO";
  assert.throws(() => buildPackage(copy), /re-review required/);
});
test("missing synthetic route fails instead of selecting a default", () => {
  const copy = structuredClone(inputs);
  const profileIds = new Set(copy.data.products.dispensingProfiles.map(p => p.orderMasterKey));
  delete copy.data.presets.entries.find(p => p.clinicalOrderType === "dispensing" && !profileIds.has(p.masterKey) && p.defaultDetailInputs.route).defaultDetailInputs.route;
  assert.throws(() => buildPackage(copy), /Missing\/unknown saved route/);
});
test("build does not mutate source data or source text", () => {
  const before = JSON.stringify(inputs);
  buildPackage(inputs);
  assert.equal(JSON.stringify(inputs), before);
});
test("unknown synthetic route is not PO fallback", () => {
  const copy = structuredClone(inputs);
  const profileIds = new Set(copy.data.products.dispensingProfiles.map(p => p.orderMasterKey));
  copy.data.presets.entries.find(p => p.clinicalOrderType === "dispensing" && !profileIds.has(p.masterKey) && p.defaultDetailInputs.route).defaultDetailInputs.route = "unknown";
  assert.throws(() => buildPackage(copy), /unknown saved route/);
});
test("laboratory correction and legacy authored scope preserved", () => {
  assert.equal(row("cm.order.v4.lab-test.32").proposed.labFamilyCode, "infectious-disease");
  assert.equal(row("cm.order.synthetic.lab-03").proposed.labFamilyCode, "organ-metabolic");
  assert.equal(row("cm.order.v4.lab-service.preanesthetic-expanded").proposed.labFamilyCode, "composite-assessment");
  assert.equal(row("cm.order.v4.lab-service.renal").proposed.labFamilyCode, "organ-metabolic");
  assert.equal(row("cm.order.v4.lab-service.pu-pd").proposed.labFamilyCode, "urinalysis");
  const legacy = row("phase1.optionb.v1.order.metabolic");
  assert.equal(legacy.proposed.labFamilyCode, "in-house-blood");
  assert.equal(legacy.origin, "synthetic_prototype_authoring");
});
test("dispensing4explicit assignments do not invent clinical defaults", () => {
  assert.equal(output.mapping.counts.productProfileCount, 108);
  assert.equal(output.mapping.counts.savedSyntheticRouteCount, 47);
  for (const [key, code] of [["cm.order.dispensing.topical", "topical"], ["cm.order.synthetic.dispensing-07", "injection"], ["cm.order.synthetic.dispensing-11", "dispensing-packaging"], ["cm.order.synthetic.dispensing-12", "dispensing-packaging"]]) {
    assert.equal(row(key).proposed.adminSubcategoryCode, code);
    assert.deepEqual(Object.keys(row(key).proposed), ["adminSubcategoryCode", "labFamilyCode"]);
    assert.equal(row(key).origin, "synthetic_prototype_authoring");
  }
});
test("CT interpretation and dental current type never silently change execution", () => {
  assert.equal(row("cm.order.v4.imaging.18").proposed.adminSubcategoryCode, "image-interpretation");
  assert.equal(row("cm.order.v4.dental.03").clinicalOrderType, "treatment");
  assert.equal(row("cm.order.synthetic.preventive-01").clinicalOrderType, "consultation");
  assert.equal(row("cm.order.synthetic.dispensing-13").proposed.adminSubcategoryCode, "medical-supply");
});
test("legacy13 stays separate, including one preexisting master link", () => {
  assert.equal(output.mapping.counts.legacyWorkspaceRows, 13);
  assert.equal(output.mapping.counts.masterLinkedLegacyRows, 1);
  assert.ok(inputs.data.legacy.rows.every(row => row.reconciliationAction === "not_proposed"));
});
test("path discrepancies preserved and prohibited lifecycle/actions absent", () => {
  assert.equal(output.gaps.observedPathDifferences.length, 12);
  assert.ok(output.gaps.observedPathDifferences.every(row => row.orderId.startsWith("cm.order.system-exam.")));
  for (const artifact of Object.values(output)) {
    assert.equal(artifact.applicationAllowed, false);
    assert.equal(artifact.runtimeImportAllowed, false);
  }
  assert.equal(output.mapping.clinicalDefaultsReadinessAssessed, false);
  assert.equal(output.mapping.clinicalReviewLifecycleChanged, false);
  assert.ok(output.mapping.rows.every(row => Object.keys(row.proposed).length === 2));
});
