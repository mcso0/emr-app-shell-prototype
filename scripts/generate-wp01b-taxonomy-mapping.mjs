import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { familyForOrder, assertReviewedOrderSet } from "./lib/oed-lab-01-reviewed-classification.mjs";
import { reviewedGroups, subcategoryDefinitions, labTranslations, syntheticDispensingDecisions, explicitNotes } from "./lib/wp01b-taxonomy-reviewed-mapping.mjs";

export const base = "docs/work/clinical-master/order-execution-defaults/artifacts/";
export const sourcePaths = {
  frozen: base + "wp-00-frozen-manifest.v1.json",
  identity: base + "wp-01b/taxonomy-identity.read-only.v1.json",
  legacy: base + "wp-01b/taxonomy-workspace-reconciliation.non-applied.v1.json",
  presets: "tests/fixtures/clinical-master-order-execution-presets-v1.json",
  authoring: "tests/fixtures/clinical-master-operational-v4-authoring.json",
  lab: base + "oed-lab-01/oed-lab-01-order-inventory.v1.json",
  products: "docs/work/clinical-master/clinical-master-pr-017/supabase/dispensing-order-release-payload.v1.json",
  decisions: "scripts/lib/wp01b-taxonomy-reviewed-mapping.mjs",
  labDecisions: "scripts/lib/oed-lab-01-reviewed-classification.mjs",
  generator: "scripts/generate-wp01b-taxonomy-mapping.mjs",
  uiVocabulary: "src/features/hospital-admin/data.ts",
};
export const sha = text => createHash("sha256").update(text).digest("hex");
const invariant = (condition, message) => { if (!condition) throw new Error(message); };
const index = (rows, field, label) => {
  const map = new Map(rows.map(row => [row[field], row]));
  invariant(map.size === rows.length, `Duplicate ${label}`);
  return map;
};
const countBy = (rows, field) => Object.fromEntries([...new Set(rows.map(field))].sort().map(key => [key, rows.filter(row => field(row) === key).length]));
export function loadInputs(root = process.cwd()) {
  const texts = Object.fromEntries(Object.entries(sourcePaths).map(([key, p]) => [key, fs.readFileSync(path.join(root, p), "utf8")]));
  return { texts, data: Object.fromEntries(Object.entries(texts).filter(([key]) => sourcePaths[key].endsWith(".json")).map(([key, text]) => [key, JSON.parse(text)])) };
}

export function validateRows(rows, frozen, identities, vocabulary) {
  const targets = index(frozen.entries, "orderId", "frozen key");
  const ids = index(identities.rows, "orderId", "identity key");
  invariant(targets.size === 522 && ids.size === 522 && rows.length === 522, "Expected exact 522 target set");
  invariant(new Set(rows.map(row => row.orderId)).size === 522, "Duplicate mapping key");
  invariant(new Set(rows.map(row => row.masterRecordId)).size === 522, "Duplicate master UUID");
  const subcategories = index(vocabulary.subcategories, "code", "subcategory");
  const families = index(vocabulary.labFamilies, "code", "family");
  for (const row of rows) {
    const target = targets.get(row.orderId), identity = ids.get(row.orderId);
    invariant(target && identity, `Foreign or missing identity: ${row.orderId}`);
    invariant(/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(row.masterRecordId), "Invalid master UUID");
    invariant(row.masterRecordId === identity.masterRecordId && row.expectedMasterRevision === identity.currentRevision && Number.isInteger(row.expectedMasterRevision) && row.expectedMasterRevision > 0, "Identity/revision mismatch");
    invariant(row.clinicalOrderType === target.clinicalOrderType && row.frozenClassificationPathKey === target.subcategory && row.observedClassificationPathKey === identity.classificationPathKey, "Protected source fields changed");
    invariant(JSON.stringify(Object.keys(row.proposed).sort()) === JSON.stringify(["adminSubcategoryCode", "labFamilyCode"]), "Unexpected proposed field");
    const subtype = subcategories.get(row.proposed.adminSubcategoryCode);
    invariant(subtype?.allowedClinicalTypes.includes(row.clinicalOrderType), `Invalid subcategory/type: ${row.orderId}`);
    invariant(subtype.requiresLabFamily ? families.has(row.proposed.labFamilyCode) : row.proposed.labFamilyCode === null, `Invalid family pair: ${row.orderId}`);
    invariant(row.evidence.length > 0 && row.rationale && row.origin && row.decisionId, "Missing authoring evidence");
  }
}

export function buildPackage({ data, texts }) {
  const { frozen, identity, legacy, presets, authoring, lab, products } = data;
  invariant(frozen.totalOrderCount === 522 && sha(texts.presets) === frozen.fixtureSha256, "Frozen fixture fingerprint changed");
  invariant(identity.applicationAllowed === false && legacy.applicationAllowed === false, "Read-only snapshot boundary changed");
  invariant(legacy.rows.length === 13 && new Set(legacy.rows.map(row => row.catalogItemId)).size === 13 && legacy.rows.every(row => row.workspaceId === "workspace-clair-cheongdam" && row.reconciliationAction === "not_proposed"), "Legacy reconciliation scope changed");
  const lineage = Object.fromEntries(Object.entries(texts).map(([key, text]) => [key, { path: sourcePaths[key], sha256: sha(text) }]));
  const evidence = (key, pointer) => ({ ...lineage[key], pointer });
  const identities = index(identity.rows, "orderId", "identity key");
  const presetByKey = index(presets.entries, "masterKey", "preset key");
  const authors = index(authoring.records, "masterKey", "authoring key");
  const labOrders = index(lab.orders, "orderId", "lab key");
  assertReviewedOrderSet(frozen.entries.filter(row => row.clinicalOrderType === "clinical_lab"));
  assertReviewedOrderSet(lab.orders);
  const profiles = index(products.dispensingProfiles, "orderMasterKey", "product profile");
  const productById = index(products.products, "id", "product");
  const decisions = new Map();
  for (const [code, rationale, keys] of reviewedGroups) {
    for (const key of keys) {
      invariant(!decisions.has(key), `Duplicate authored decision: ${key}`);
      decisions.set(key, { code, rationale });
    }
  }
  const vocabulary = {
    schemaVersion: "wp01b-taxonomy-vocabulary-proposal/v1", applicationAllowed: false, runtimeImportAllowed: false,
    scope: "Frozen 522 only; unused existing codes are neither removed nor asserted supported by this target matrix.",
    subcategories: subcategoryDefinitions.map(([code, parentCode, label, type, existing]) => ({ code, parentCode, label, allowedClinicalTypes: [type], requiresLabFamily: code === "clinical-pathology", status: existing ? "reuse_existing_ui_code" : "proposed_new_code" })),
    labFamilies: labTranslations.map(([researchFamilyId, code, label, existing]) => ({ code, label, researchFamilyId, parentSubcategoryCode: "clinical-pathology", status: existing ? "reuse_existing_ui_code" : "proposed_new_code" })),
    canonicalAliasProposal: { oldUiLeaf: "blood-chemistry", storedPair: { adminSubcategoryCode: "clinical-pathology", labFamilyCode: "chemistry" }, runtimeAliasImplemented: false },
    sourceLineage: { decisions: lineage.decisions, existingUiVocabulary: lineage.uiVocabulary },
  };
  // Explicit source value translation. No default branch and no name/path classifier.
  const routes = { oral: "oral-medication", PO: "oral-medication", cutaneous: "topical", topical: "topical", ophthalmic: "ophthalmic", otic: "otic", transdermal: "transdermal", oromucosal: "oromucosal" };
  let productProfileCount = 0, savedSyntheticRouteCount = 0;
  const usedDecisions = new Set();
  const usedSyntheticDispensingDecisions = new Set();
  const rows = frozen.entries.map(target => {
    const live = identities.get(target.orderId);
    invariant(live, `Missing live identity: ${target.orderId}`);
    const row = {
      orderId: target.orderId, masterRecordId: live.masterRecordId, expectedMasterRevision: live.currentRevision,
      displayName: target.displayName, clinicalOrderType: target.clinicalOrderType,
      clinicalTypeEvidence: "frozen_manifest_not_fresh_remote_type_query",
      frozenClassificationPathKey: target.subcategory, observedClassificationPathKey: live.classificationPathKey,
      proposed: { adminSubcategoryCode: null, labFamilyCode: null }, researchFamilyId: null,
      origin: "synthetic_prototype_authoring", decisionId: null, rationale: null,
      evidence: [evidence("frozen", `entries[orderId=${target.orderId}]`), evidence("identity", `rows[orderId=${target.orderId}]`), evidence("decisions", "offline reviewed decisions")],
      notes: [...(explicitNotes[target.orderId] ?? [])],
    };
    if (authors.has(target.orderId)) row.evidence.push(evidence("authoring", `records[masterKey=${target.orderId}]`));
    if (target.clinicalOrderType === "clinical_lab") {
      const research = familyForOrder(target);
      invariant(labOrders.get(target.orderId)?.familyId === research, "Research classification changed");
      const translated = labTranslations.find(([id]) => id === research);
      invariant(translated, `Unmapped research family: ${research}`);
      row.researchFamilyId = research;
      row.proposed = { adminSubcategoryCode: "clinical-pathology", labFamilyCode: translated[1] };
      row.origin = research === "legacy_exception" ? "synthetic_prototype_authoring" : "reviewed_research_purpose_translation";
      row.decisionId = `lab-purpose:${research}`;
      row.rationale = research === "legacy_exception" ? "Broad synthetic blood-test workflow only; no analyte/panel composition inferred." : "Primary browsing family translated from the reviewed research purpose; not assay, device, result range or panel-membership authority.";
      row.evidence.push(evidence("lab", `orders[orderId=${target.orderId}]`), evidence("labDecisions", `reviewedFamilies[${target.orderId}]`));
    } else if (target.clinicalOrderType === "dispensing") {
      const profile = profiles.get(target.orderId);
      const savedRoute = presetByKey.get(target.orderId)?.defaultDetailInputs?.route;
      let sourceRoute;
      if (profile) {
        const product = productById.get(profile.productId);
        invariant(product && product.revision === profile.productRevision && JSON.stringify(profile.allowedRoutes) === JSON.stringify(product.routes) && profile.allowedRoutes.length === 1, `Conflicting product/profile: ${target.orderId}`);
        sourceRoute = profile.allowedRoutes[0];
        row.origin = "documented_product_profile_route";
        row.evidence.push(evidence("products", `dispensingProfiles[orderMasterKey=${target.orderId}]; products[id=${profile.productId}]`));
        productProfileCount++;
      } else if (Object.hasOwn(syntheticDispensingDecisions, target.orderId)) {
        usedSyntheticDispensingDecisions.add(target.orderId);
        invariant(!savedRoute, "Previously route-missing decision now has a source route; re-review required");
        row.proposed.adminSubcategoryCode = syntheticDispensingDecisions[target.orderId];
        row.notes.push("Explicit synthetic browsing decision; product, administration route, dose and quantity remain unchanged.");
      } else {
        invariant(savedRoute && Object.hasOwn(routes, savedRoute), `Missing/unknown saved route: ${target.orderId}`);
        sourceRoute = savedRoute;
        row.origin = "saved_synthetic_preset_route";
        row.evidence.push(evidence("presets", `entries[masterKey=${target.orderId}].defaultDetailInputs.route`));
        savedSyntheticRouteCount++;
      }
      if (sourceRoute) {
        invariant(Object.hasOwn(routes, sourceRoute), `Unmapped product route: ${sourceRoute}`);
        row.proposed.adminSubcategoryCode = routes[sourceRoute];
        if (profile && savedRoute) invariant(routes[savedRoute] === routes[sourceRoute], "Product and preset route conflict");
      }
      row.decisionId = `dispensing:${row.origin}:${row.proposed.adminSubcategoryCode}`;
      row.rationale = "Use documented product route first, otherwise an explicit saved synthetic route or one of four reviewed scope decisions; never populate missing clinical defaults.";
    } else {
      const decision = decisions.get(target.orderId);
      invariant(decision, `Unassigned order: ${target.orderId}`);
      usedDecisions.add(target.orderId);
      row.proposed.adminSubcategoryCode = decision.code;
      row.decisionId = `authored-service-scope:${decision.code}`;
      row.rationale = decision.rationale;
    }
    if (row.proposed.adminSubcategoryCode === "emergency-service") row.notes.push("Existing other type does not prove emergency fulfillment; resolve execution semantics separately.");
    if (synVaccineIds.has(target.orderId)) row.notes.push("Vaccine-named service retains consultation type; browsing assignment does not authorize administration or repair routing.");
    if (target.subcategory !== live.classificationPathKey) row.notes.push("Fresh observed path differs from frozen source path; both retained. Re-read type, revision, path and field fingerprint before any write.");
    return row;
  });
  invariant(usedDecisions.size === decisions.size, "Foreign or unused explicit decision");
  invariant(usedSyntheticDispensingDecisions.size === Object.keys(syntheticDispensingDecisions).length && usedSyntheticDispensingDecisions.size === 4, "Foreign, missing or unused synthetic dispensing decision");
  invariant(productProfileCount === 108 && savedSyntheticRouteCount === 47, "Dispensing evidence coverage changed");
  validateRows(rows, frozen, identity, vocabulary);
  const gaps = {
    schemaVersion: "wp01b-taxonomy-gap-list/v1", applicationAllowed: false, runtimeImportAllowed: false,
    unresolvedTaxonomyDecisions: [],
    vocabularyAdditions: [...vocabulary.subcategories.filter(v => v.status === "proposed_new_code").map(v => ({ kind: "subcategory", ...v })), ...vocabulary.labFamilies.filter(v => v.status === "proposed_new_code").map(v => ({ kind: "labFamily", ...v }))],
    observedPathDifferences: rows.filter(row => row.frozenClassificationPathKey !== row.observedClassificationPathKey).map(row => ({ orderId: row.orderId, frozen: row.frozenClassificationPathKey, observed: row.observedClassificationPathKey })),
    semanticCautions: rows.filter(row => row.notes.length).map(row => ({ orderId: row.orderId, notes: row.notes })),
    remainingWork: ["Additive storage/publisher/projection/API validation and two-field inheritance are not implemented by this artifact.", "Re-read live clinical type, revision, path, source projection and customization before any write; snapshot only verified identity/revision/path.", "Known clinical-default incompleteness remains separate from taxonomy readiness.", "Nested sets, independent analytes, device profiles and reference ranges remain OED-LAB-04.", "Reconcile 13 workspace-only legacy rows separately; one already has a master link, twelve do not. Never attach by name or delete by default."],
    legacySource: lineage.legacy,
  };
  const mapping = {
    schemaVersion: "wp01b-taxonomy-mapping-candidate/v1", generatedForDate: "2026-09-06",
    artifactState: "offline_authoring_complete_non_applied", applicationAllowed: false, runtimeImportAllowed: false,
    frozenSemanticFingerprint: frozen.semanticFingerprint, sourceLineage: lineage,
    requiresFreshReadBeforeWrite: true, clinicalDefaultsReadinessAssessed: false, clinicalReviewLifecycleChanged: false,
    counts: { total: rows.length, clinicalTypes: countBy(rows, row => row.clinicalOrderType), subcategories: countBy(rows, row => row.proposed.adminSubcategoryCode), labFamilies: countBy(rows.filter(row => row.researchFamilyId), row => row.proposed.labFamilyCode), origins: countBy(rows, row => row.origin), productProfileCount, savedSyntheticRouteCount, explicitDispensingScopeDecisions: usedSyntheticDispensingDecisions.size, legacyWorkspaceRows: legacy.rows.length, masterLinkedLegacyRows: legacy.rows.filter(row => row.sourceMasterRecordId).length, observedPathDifferences: gaps.observedPathDifferences.length, newSubcategoryCodes: vocabulary.subcategories.filter(v => v.status === "proposed_new_code").length, newLabFamilyCodes: vocabulary.labFamilies.filter(v => v.status === "proposed_new_code").length },
    rows,
  };
  mapping.semanticFingerprint = sha(JSON.stringify({ rows, vocabulary, gaps }));
  return { mapping, vocabulary, gaps };
}
const synVaccineIds = new Set([1, 2, 3, 4, 5].map(n => `cm.order.synthetic.preventive-${String(n).padStart(2, "0")}`));

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const outputs = buildPackage(loadInputs());
  const names = { mapping: "taxonomy-mapping.non-applied.v1.json", vocabulary: "taxonomy-vocabulary-proposal.v1.json", gaps: "taxonomy-gap-list.v1.json" };
  for (const [key, value] of Object.entries(outputs)) {
    const destination = path.join(base, "wp-01b", names[key]);
    const text = JSON.stringify(value, null, 2) + "\n";
    if (process.argv.includes("--check")) invariant(fs.readFileSync(destination, "utf8") === text, `Stale artifact: ${destination}`);
    else fs.writeFileSync(destination, text);
  }
  console.log(JSON.stringify(outputs.mapping.counts, null, 2));
}
