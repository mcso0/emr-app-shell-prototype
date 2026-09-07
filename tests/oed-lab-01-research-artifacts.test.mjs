import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { assertReviewedOrderSet, familyForOrder } from "../scripts/lib/oed-lab-01-reviewed-classification.mjs";
import { compareSpecimenLabels } from "../scripts/lib/oed-lab-01-specimen-comparison.mjs";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(TEST_DIR, "..");
const ARTIFACT_DIR = resolve(
  REPO_ROOT,
  "docs/work/clinical-master/order-execution-defaults/artifacts/oed-lab-01",
);

async function readJson(name) {
  return JSON.parse(await readFile(resolve(ARTIFACT_DIR, name), "utf8"));
}

function collectSourceIds(value, output = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectSourceIds(item, output);
    return output;
  }

  if (!value || typeof value !== "object") return output;
  for (const [key, child] of Object.entries(value)) {
    if (key === "sourceIds" && Array.isArray(child)) output.push(...child);
    collectSourceIds(child, output);
  }
  return output;
}

test("OED-LAB-01 freezes and classifies all 86 clinical laboratory orders", async () => {
  const [manifest, inventory, setMap, routes, resultShapes, gaps] =
    await Promise.all([
      readJson("artifact-manifest.v1.json"),
      readJson("oed-lab-01-order-inventory.v1.json"),
      readJson("oed-lab-01-set-atomic-map.v1.json"),
      readJson("oed-lab-01-execution-route-matrix.v1.json"),
      readJson("oed-lab-01-result-shape-matrix.v1.json"),
      readJson("oed-lab-01-gap-matrix.v1.json"),
    ]);

  assert.equal(manifest.artifactState, "research_only_non_applied");
  assert.equal(manifest.applicationAllowed, false);
  assert.equal(manifest.runtimeImportAllowed, false);
  assert.equal(manifest.databaseMutationAllowed, false);
  assert.equal(manifest.masterMutationAllowed, false);
  assert.equal(manifest.counts.clinicalLabOrders, 86);
  assert.equal(manifest.counts.currentLabTestDefinitions, 72);
  assert.equal(manifest.counts.labTestsWithoutDirectOrder, 16);
  assert.equal(manifest.counts.unboundClinicalLabOrders, 1);

  const inventoryIds = inventory.orders.map((order) => order.orderId);
  assert.equal(inventoryIds.length, 86);
  assert.equal(new Set(inventoryIds).size, 86);
  assert.ok(inventory.orders.every((order) => order.applicationAllowed === false));

  for (const rows of [setMap.orders, routes.orders]) {
    assert.deepEqual(
      rows.map((order) => order.orderId).sort(),
      [...inventoryIds].sort(),
    );
  }

  assert.equal(resultShapes.currentLabTests.length, 72);
  assert.equal(
    resultShapes.currentLabTests.filter((testDefinition) => !testDefinition.directlyOrderable).length,
    16,
  );
  assert.equal(gaps.gaps.length, 11);
  assert.equal(gaps.counts.blocker, 6);
  assert.equal(gaps.counts.high, 5);
});

test("OED-LAB-01 source references resolve to the source ledger", async () => {
  const [setMap, routes, equipment, ledger] = await Promise.all([
    readJson("oed-lab-01-set-atomic-map.v1.json"),
    readJson("oed-lab-01-execution-route-matrix.v1.json"),
    readJson("oed-lab-01-equipment-landscape.v1.json"),
    readJson("oed-lab-01-source-ledger.v1.json"),
  ]);
  const knownSourceIds = new Set(ledger.sources.map((source) => source.sourceId));
  const referencedSourceIds = new Set([
    ...collectSourceIds(setMap),
    ...collectSourceIds(routes),
    ...collectSourceIds(equipment),
  ]);

  assert.ok(knownSourceIds.size > 0);
  assert.deepEqual(
    [...referencedSourceIds].filter((sourceId) => !knownSourceIds.has(sourceId)),
    [],
  );
});

test("reviewed IDs prevent disease-name collisions and silent chemistry fallback", async () => {
  const inventory = await readJson("oed-lab-01-order-inventory.v1.json");
  const rows = new Map(inventory.orders.map((row) => [row.orderId, row]));
  assert.equal(rows.get("cm.order.v4.lab-test.32").familyId, "infectious_disease");
  assert.equal(rows.get("cm.order.v4.lab-service.preanesthetic-expanded").familyId, "composite_diagnostic_plan");
  assert.equal(inventory.orders.filter((row) => row.familyId === "hematology_cbc").length, 4);
  assert.equal(familyForOrder({ orderId: "cm.order.v4.lab-test.32", displayName: "CBC" }), "infectious_disease");
  assert.throws(() => familyForOrder({ orderId: "unknown", displayName: "CBC" }), /Unreviewed/);
  assertReviewedOrderSet(inventory.orders);
  assert.throws(() => assertReviewedOrderSet([...inventory.orders.slice(1), inventory.orders[1]]), /differ/);
  assert.throws(() => assertReviewedOrderSet([...inventory.orders.slice(1), { orderId: "unknown" }]), /differ/);
});

test("all 86 specimen comparisons preserve candidate and fixture provenance without applying values", async () => {
  const audit = await readJson("oed-lab-01-correction-audit.v1.json");
  const inventory = await readJson("oed-lab-01-order-inventory.v1.json");
  assert.equal(audit.orders.length, 86);
  assert.equal(Object.values(audit.specimenStatusCounts).reduce((sum, count) => sum + count, 0), 86);
  assert.deepEqual(audit.specimenStatusCounts, {
    blood_processing_unspecified: 38, same_source_label: 27, missing_candidate: 12,
    collection_vs_preparation_needs_review: 2, candidate_underspecified: 1,
    conflicting_source_labels: 5, unbound_fixture: 1,
  });
  for (const row of audit.orders) {
    assert.equal(row.appliedSpecimen, null);
    assert.equal(row.comparisonStatus, compareSpecimenLabels(row.fixtureSpecimenKey, row.priorNonAppliedCandidateSpecimen));
  }
  const urine = audit.orders.find((row) => row.orderId === "cm.order.v4.lab-panel.07");
  assert.equal(urine.fixtureSpecimenKey, "cm.specimen.urine");
  assert.equal(urine.priorNonAppliedCandidateSpecimen, "serum");
  assert.equal(urine.comparisonStatus, "conflicting_source_labels");
  for (const row of inventory.orders) {
    assert.equal(row.remoteStateVerified, false);
    assert.equal(row.bindingEvidence, "local_authoring_fixture");
    assert.equal(row.priorCandidateProvenance, "wp-01a_non_applied_candidate_not_current_defaults");
    assert.equal("currentDefaultSummary" in row, false);
  }
});

test("family sources do not imply verified order values, final children, or compatible routes", async () => {
  const [inventory, sets, routes] = await Promise.all([
    readJson("oed-lab-01-order-inventory.v1.json"), readJson("oed-lab-01-set-atomic-map.v1.json"),
    readJson("oed-lab-01-execution-route-matrix.v1.json"),
  ]);
  assert.equal(inventory.orders.filter((row) => row.researchStatus === "source_partial").length, 85);
  for (const row of inventory.orders) {
    assert.equal(row.orderSpecificMethodVerified, false);
    assert.equal(row.numericValuesExtracted, false);
    assert.equal(row.evidenceScope, "family_landscape_only");
  }
  for (const row of sets.orders.filter((row) => row.currentKind === "atomic_order")) {
    assert.deepEqual(row.recommendedChildBlueprint, []);
  }
  for (const row of routes.orders) {
    assert.equal("supportedRoutes" in row, false);
    assert.equal(row.routeValidation, "per_order_method_unverified");
    assert.equal(row.defaultRouteDecision, "workspace_selection_required");
  }
});

test("artifact and actual source-content fingerprints match; source access dates are not refreshed by generation", async () => {
  const manifest = await readJson("artifact-manifest.v1.json");
  const hash = (body) => createHash("sha256").update(body).digest("hex");
  for (const [name, fingerprint] of Object.entries(manifest.artifactFingerprints)) {
    assert.equal(hash(await readFile(resolve(ARTIFACT_DIR, name))), fingerprint, name);
  }
  assert.equal(Object.keys(manifest.sourceFileFingerprints).length, 3);
  for (const [name, fingerprint] of Object.entries(manifest.sourceFileFingerprints)) {
    assert.equal(hash(await readFile(resolve(REPO_ROOT, name))), fingerprint, name);
  }
  const ledger = await readJson("oed-lab-01-source-ledger.v1.json");
  assert.ok(ledger.sources.every((source) => source.accessedAt === "2026-09-04"));
});

test("published Markdown tables match generated research and HTML includes correction and next-step sections", async () => {
  const [draft, report, html] = await Promise.all([
    readFile(resolve(ARTIFACT_DIR, "report-source.draft.md"), "utf8"),
    readFile(resolve(ARTIFACT_DIR, "report-source.md"), "utf8"),
    readFile(resolve(REPO_ROOT, "docs/completed/clinical-master/2026-09-04-oed-lab-01-clinical-laboratory-landscape-report.html"), "utf8"),
  ]);
  const tables = (body) => body.match(/^\|.*(?:\n\|.*)*/gm);
  assert.deepEqual(tables(report), tables(draft));
  const inventory = await readJson("oed-lab-01-order-inventory.v1.json");
  for (const row of inventory.orders) {
    const line = report.split("\n").find((line) => line.includes(`| \`${row.orderId}\` |`));
    assert.ok(line?.includes(`| ${row.familyLabel} |`), row.orderId);
    assert.ok(line?.includes(`\`${row.researchStatus}\``), row.orderId);
  }
  assert.match(html, /id="corrections"/);
  assert.match(html, /id="next-step"/);
  assert.match(html, /검체 표기가 충돌하는 항목은 5건/);
  assert.match(html, /원격 상태 미검증/);
});
