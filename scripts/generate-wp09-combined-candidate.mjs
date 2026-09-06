// Offline authoring only. Does not publish, adopt, activate or retire anything.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { canonicalize } from "./generate-clinical-master-execution-preset-release-v1.mjs";
const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const base = "docs/work/clinical-master/order-execution-defaults/artifacts/";
const read = path => JSON.parse(readFileSync(resolve(root, path), "utf8"));
const hash = value => createHash("sha256").update(canonicalize(value)).digest("hex");
export function buildCombinedCandidate() {
  const original = read("tests/fixtures/clinical-master-execution-preset-release-v1.json");
  const taxonomy = read(base + "wp-01b/taxonomy-mapping.non-applied.v1.json");
  const dispensing = read(base + "wp-03/dispensing-definitions.non-applied.v2.json");
  const treatment = read(base + "wp-04/treatment-definitions.non-applied.v2.json");
  const lab = read(base + "oed-lab-04/all-runtime.non-applied.v1.json");
  const imaging = read(base + "wp-06/imaging-definitions.non-applied.v1.json");
  const remaining = read(base + "wp-07/remaining-definitions.non-applied.v1.json");
  const records = new Map(original.records.map(r => [r.masterKey, structuredClone(r)]));
  const retired = new Map(dispensing.replacementLedger.map(r => [r.originalMasterKey, r]));
  for (const key of retired.keys()) records.delete(key);
  for (const r of [...dispensing.records, ...treatment.records, ...lab.records, ...imaging.records, ...remaining.supportingRecords, ...remaining.records]) records.set(r.masterKey, structuredClone(r));
  const mappings = new Map(taxonomy.rows.map(r => [r.orderId, r.proposed]));
  const taxonomyEvidence = [];
  const routeTaxonomy = { PO: "oral-medication", SC: "injection", IM: "injection", IV: "injection", topical: "topical", ophthalmic: "ophthalmic", otic: "otic", transdermal: "transdermal", oromucosal: "oromucosal" };
  const atomicFamilies = { NA: "electrolyte-abg", K: "electrolyte-abg", CL: "electrolyte-abg", CA: "chemistry", PHOS: "chemistry", ALB: "chemistry", AST: "chemistry", TBIL: "chemistry", UA_PROTEIN: "urinalysis", UA_SG: "urinalysis" };
  for (const r of records.values()) {
    // Official product references remain in immutable product/preset provenance;
    // these new order revisions contain synthetic plans, not official prescriptions.
    if (r.source.sourceType !== "synthetic") r.source = { ...r.source, sourceType: "synthetic", title: `Synthetic prototype derivative: ${r.source.title}` };
    if (r.recordType !== "order") continue;
    if (r.masterKey === "phase1.optionb.v1.order.metabolic") {
      // This formerly unclassified row now has explicit atomic composition/profile authority.
      r.detail.classificationPathKey = "cm.path.laboratory";
    }
    let fields = mappings.get(r.masterKey); let evidence = "reviewed_original_identity";
    const preset = r.detail.executionPreset;
    if (!fields && preset.clinicalOrderType === "dispensing") {
      const route = preset.defaultDetailInputs.route;
      if (!routeTaxonomy[route]) throw Error(`unauthored_product_taxonomy:${r.masterKey}:${route}`);
      fields = { adminSubcategoryCode: routeTaxonomy[route], labFamilyCode: null }; evidence = `explicit_product_route:${route}`;
    }
    if (!fields && preset.clinicalOrderType === "clinical_lab") {
      const roots = lab.expandedCompositions.filter(c => c.leaves.some(l => l.masterKey === r.masterKey));
      const families = [...new Set(roots.map(c => mappings.get(c.masterKey)?.labFamilyCode).filter(Boolean))];
      // New leaf identities are authored beneath exact source panels, not inferred from labels.
      const assay = lab.labOrderProfiles.find(p => p.orderMasterKey === r.masterKey)?.labTestMasterKey;
      const assayCode = records.get(assay)?.detail.testCode;
      const family = atomicFamilies[assayCode] ?? (families.includes("cbc") ? "cbc" : families.length === 1 ? families[0] : null);
      if (!family) throw Error(`ambiguous_atomic_taxonomy:${r.masterKey}:${families.join(",")}`);
      fields = { adminSubcategoryCode: "clinical-pathology", labFamilyCode: family }; evidence = atomicFamilies[assayCode] ? `explicit_atomic_assay:${assay}:${assayCode}` : `source_compositions:${roots.map(c => c.masterKey).join(",")}`;
    }
    if (!fields) throw Error(`missing_taxonomy:${r.masterKey}`);
    Object.assign(r.detail, fields); taxonomyEvidence.push({ masterKey: r.masterKey, ...fields, evidence });
  }
  const paths = new Map([...original.classificationPaths, ...remaining.classificationPaths].map(p => [p.pathKey, p]));
  const usedPaths = new Set([...records.values()].filter(r => r.recordType === "order").map(r => r.detail.classificationPathKey));
  const profiles = new Map(original.labOrderProfiles.map(p => [p.orderMasterKey, p]));
  for (const p of lab.labOrderProfiles) profiles.set(p.orderMasterKey, p);
  const payload = { ...original, releaseKey: "cm.release.order-defaults-complete.2026-09-06.v1", releaseNotes: "Synthetic prototype full-category candidate; explicit replacement retirement and workspace activation are separate scoped operations.", adoptionScope: "payload",
    records: [...records.values()].sort((a,b) => a.masterKey.localeCompare(b.masterKey)),
    classificationPaths: [...paths.values()].filter(p => usedPaths.has(p.pathKey)),
    labOrderProfiles: [...profiles.values()].filter(p => records.has(p.orderMasterKey)),
    labResultProfiles: lab.profiles, labResultProfileOrderKeys: lab.requiresProfileOrderKeys, labCompositions: lab.compositions };
  const originalOrders = original.records.filter(r => r.recordType === "order");
  const ledger = originalOrders.map(r => ({ originalMasterKey: r.masterKey, originalClinicalType: r.detail.executionPreset.clinicalOrderType,
    disposition: retired.has(r.masterKey) ? "explicit_product_redefinition" : lab.compositions.some(c => c.originalOrderMasterKey === r.masterKey) ? "preserved_identity_compiled_composition" : "preserved_identity_revised",
    successorMasterKey: retired.get(r.masterKey)?.replacementMasterKey ?? r.masterKey,
    historicalRewriteAllowed: false }));
  if (ledger.length !== 522 || new Set(ledger.map(r => r.originalMasterKey)).size !== 522 || ledger.some(r => !records.has(r.successorMasterKey))) throw Error("original522_reconciliation_failed");
  const originalKeys = new Set(originalOrders.map(r => r.masterKey));
  const newOrders = payload.records.filter(r => r.recordType === "order" && !originalKeys.has(r.masterKey)).map(r => r.masterKey);
  return { schemaVersion: 1, applied: false, runtimeImportAllowed: false, payload, ledger, newOrders, retirementPlan: dispensing.replacementLedger,
    taxonomyEvidence, counts: { originalOrders: 522, retiredOriginals: retired.size, additionalOrders: newOrders.length, candidateOrders: payload.records.filter(r => r.recordType === "order").length,
      atomicLabOrders: lab.requiresProfileOrderKeys.length, originalLabIdentities: lab.reconciliation.length, labCompositions: lab.compositions.length, resultProfiles: lab.profiles.length },
    candidateSemanticSha256: hash(payload), reconciliationSha256: hash(ledger),
    pendingRemoteGates: ["exact_workspace_allowlist_and_foreign_control", "fresh_before_fingerprints", "explicit_profile_and_set_billing_choices", "replacement_future_selection_stop_preserving_history", "authenticated_deployed_acceptance"] };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const artifact = buildCombinedCandidate(); const folder = resolve(root, base + "wp-09"); mkdirSync(folder, { recursive: true });
  writeFileSync(resolve(folder, "combined-release.non-applied.v1.json"), JSON.stringify(artifact, null, 2) + "\n");
  console.log(JSON.stringify({ ...artifact.counts, candidateSemanticSha256: artifact.candidateSemanticSha256, applied: false }));
}
