// Offline explicit configuration packet. No DB, network, or device operations.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { hashCanonical } from "./generate-clinical-master-execution-preset-release-v1.mjs";
import { uuidV5 } from "./generate-clinical-master-order-execution-presets-v1.mjs";

export const wp09WorkspaceAllowlist = ["clair-demo", "workspace-clair-cheongdam", "workspace-clinical-master-pilot-v1"];
export const wp09ForeignControl = "clair-foreign-demo";
export const wp09VirtualDeviceModels = ["SYNTHETIC-CBC-MANUAL", "SYNTHETIC-SMEAR-MANUAL", "SYNTHETIC-LAB-MANUAL"];
// Explicit case-level demo fees, not market quotes, medicine unit prices, or a panel sum.
const syntheticPriceRows = [
  ...[
    ["caplin-ofloxacin-0-3-percent", 18000], ["cerenia-maropitant-10mg-ml-sc", 25000],
    ["durvet-chlorhexidine-2-percent", 12000], ["epi-otic-za-ear-cleaner", 25000],
    ["famotidine-20mg-tablet", 7000], ["fortiflora-canine-1g-sachet", 15000],
    ["humilac-jp-moisturizer-spray", 25000], ["legalon-silymarin-140mg-capsule", 12000],
    ["muricin-mupirocin-2-percent", 18000], ["neurontin-100mg-capsule", 10000],
    ["omeprazole-10mg-delayed-capsule", 10000], ["optimmune-ciclosporin-0-2-percent", 45000],
    ["oralade-advanced-gi-500ml", 25000], ["prilactone-next-10mg-tablet", 18000],
    ["refresh-tears-cmc-0-5-percent", 10000], ["silvadene-silver-sulfadiazine-1-percent", 18000],
    ["topcare-povidone-iodine-10-percent", 10000], ["ursodiol-300mg-capsule", 15000],
    ["vetmedin-1-25mg-tablet", 25000],
  ].map(([key, priceKrw]) => ({ orderMasterKey: `cm.order.dispensing-wp03.${key}`, priceKrw,
    category: "dispensing", rationale: "Differentiated synthetic dispensing case fee; not a tablet, bottle, mL, dose, or retail price." })),
  ...[
    ["cm-lab-test-synthetic-03.cm-specimen-serum", 12000, "chemistry", "AST"],
    ["cm-lab-test-synthetic-04.cm-specimen-serum", 12000, "chemistry", "TBIL"],
    ["cm-lab-test-synthetic-05.cm-specimen-serum", 12000, "chemistry", "ALB"],
    ["cm-lab-test-synthetic-06.cm-specimen-serum", 12000, "chemistry", "CA"],
    ["cm-lab-test-synthetic-07.cm-specimen-serum", 12000, "chemistry", "PHOS"],
    ["cm-lab-test-synthetic-08.cm-specimen-serum", 10000, "electrolyte", "Na"],
    ["cm-lab-test-synthetic-09.cm-specimen-serum", 10000, "electrolyte", "K"],
    ["cm-lab-test-synthetic-10.cm-specimen-serum", 10000, "electrolyte", "Cl"],
    ["cm-lab-test-synthetic-11.cm-specimen-citrate-plasma", 20000, "coagulation", "PT"],
    ["cm-lab-test-synthetic-12.cm-specimen-citrate-plasma", 20000, "coagulation", "aPTT"],
    ["cm-lab-test-synthetic-15.cm-specimen-urine", 5000, "urine", "SG"],
    ["cm-lab-test-synthetic-16.cm-specimen-urine", 10000, "urine", "protein"],
    ["phase1-optionb-v1-test-glucose.phase1-optionb-v1-specimen-serum", 8000, "glucose", "glucose"],
  ].map(([key, priceKrw, category, assay]) => ({ orderMasterKey: `cm.order.lab.atomic.${key}`, priceKrw,
    category, rationale: `Synthetic standalone ${assay} case fee; not an item-level surveyed price or panel billing component.` })),
  ...[
    ["baso-abs", 5000], ["baso-pct", 5000], ["eos-abs", 5000], ["eos-pct", 5000], ["hgb", 5000],
    ["lym-abs", 5000], ["lym-pct", 5000], ["mch", 5000], ["mchc", 5000], ["mcv", 5000],
    ["mono-abs", 5000], ["mono-pct", 5000], ["mpv", 5000], ["neu-abs", 5000], ["neu-pct", 5000],
    ["pct", 5000], ["pdw", 5000], ["rbc", 5000], ["rdw", 5000], ["retic-abs", 10000], ["retic-hgb", 12000],
  ].map(([key, priceKrw]) => ({ orderMasterKey: `cm.order.lab.test.cbc-${key}`, priceKrw, category: "cbc",
    rationale: key.startsWith("retic-") ? "Synthetic specialized reticulocyte standalone case fee; never added to a parent panel charge."
      : "Synthetic basic CBC/index/differential standalone case fee; never added to a parent panel charge." })),
].map(row => ({ ...row, currency: "KRW", salesUnitCode: "case", priceBasis: "synthetic_per_case_demo_fee",
  provenance: "explicit_wp09_synthetic_price_selection_not_item_level_market_evidence" }));
const priceContext = {
  sourceUrl: "https://www.mafra.go.kr/bbs/home/792/592824/download.do", publicationDate: "2025-12-22", pdfPage: 3,
  sourceTitle: "MAFRA 2025 animal hospital medical fee survey", panelMedianKrw: { cbc: 34000, serumChemistry: 80000, electrolytes: 32000 },
  use: "Broad panel-level sanity context only; no item-level or dispensing price evidence, price derivation, or recommendation.",
  panelBilling: "Preserve parent price; never sum atomic case fees into a panel bill. Pilot metabolic remains nonbillable; retests remain no_charge.",
};
const folder = "docs/work/clinical-master/order-execution-defaults/artifacts/wp-09/";
const byKey = (rows, key, label) => {
  if (!Array.isArray(rows)) throw Error(`${label}_missing`);
  const index = new Map(rows.map(row => [row[key], row]));
  if (index.size !== rows.length || [...index.keys()].some(value => typeof value !== "string" || !value)) throw Error(`${label}_duplicate_or_invalid_identity`);
  return index;
};
export function buildWp09WorkspaceConfiguration(source, combined) {
  if (source?.schemaVersion !== 1 || source.applied !== false || source.runtimeImportAllowed !== false
    || hashCanonical(source.payload) !== source.candidateSemanticSha256) throw Error("remote_candidate_contract_or_hash_mismatch");
  if (JSON.stringify(source.workspaceAllowlist) !== JSON.stringify(wp09WorkspaceAllowlist) || source.foreignControl !== wp09ForeignControl) throw Error("workspace_scope_mismatch");
  const payload = source.payload;
  const orders = byKey(payload.records.filter(record => record.recordType === "order"), "masterKey", "orders");
  const atomicKeys = payload.labResultProfileOrderKeys;
  if (!Array.isArray(atomicKeys) || atomicKeys.length !== 90 || new Set(atomicKeys).size !== 90) throw Error("atomic_order90_identity_mismatch");
  if (!combined || hashCanonical(combined.payload) !== combined.candidateSemanticSha256
    || source.sourceCandidateSemanticSha256 !== combined.candidateSemanticSha256) throw Error("pricing_identity_source_hash_mismatch");
  const newOrders = combined.newOrders;
  const originalKeys = new Set(combined.ledger.map(entry => entry.originalMasterKey));
  if (!Array.isArray(newOrders) || newOrders.length !== 53 || new Set(newOrders).size !== 53 || originalKeys.size !== 522
    || newOrders.some(key => originalKeys.has(key) || !orders.has(key))) throw Error("new_price53_identity_mismatch");
  if (newOrders.filter(key => orders.get(key).detail.executionPreset.clinicalOrderType === "dispensing").length !== 19
    || newOrders.filter(key => atomicKeys.includes(key)).length !== 34) throw Error("new_price19_dispensing34_atomic_required");
  const priceMap = byKey(syntheticPriceRows, "orderMasterKey", "synthetic_price_map");
  if (priceMap.size !== 53 || newOrders.some(key => !priceMap.has(key))
    || [...priceMap.keys()].some(key => !newOrders.includes(key))) throw Error("synthetic_price_map_exact_new53_required");
  for (const [key, price] of priceMap) {
    if (!Number.isSafeInteger(price.priceKrw) || price.priceKrw <= 0 || orders.get(key).detail.defaultSalesUnitCode !== price.salesUnitCode
      || (price.category === "dispensing") !== (orders.get(key).detail.executionPreset.clinicalOrderType === "dispensing")) throw Error(`synthetic_price_unit_or_category_mismatch:${key}`);
  }
  const syntheticPriceMap = [...priceMap.values()].sort((left, right) => left.orderMasterKey.localeCompare(right.orderMasterKey, "en"));
  const priceSummary = rows => ({ orders: rows.length, minKrw: Math.min(...rows.map(row => row.priceKrw)),
    maxKrw: Math.max(...rows.map(row => row.priceKrw)), checksumSumKrwNotAnInvoice: rows.reduce((sum, row) => sum + row.priceKrw, 0) });
  byKey(payload.labResultProfiles, "id", "profile_versions");
  const profiles = payload.labResultProfiles.filter(profile => profile.device?.manufacturer === "CLAiR" && profile.device?.kind === "manual");
  if (profiles.some(profile => !wp09VirtualDeviceModels.includes(profile.device.model)
    || profile.entryMode !== "manual_entry" || profile.integrationStatus !== "not_integrated" || profile.clinicalUseAllowed !== false)) throw Error("manual_profile_contract_invalid");
  const rootCompositions = payload.labCompositions.filter(composition => composition.originalOrderMasterKey != null);
  byKey(payload.labCompositions, "id", "composition_versions");
  byKey(payload.labCompositions, "masterKey", "compositions");
  byKey(rootCompositions, "originalOrderMasterKey", "root_compositions");
  if (rootCompositions.length !== 30 || rootCompositions.some(composition => !orders.has(composition.originalOrderMasterKey)
    || composition.masterKey !== composition.originalOrderMasterKey)) throw Error("original_root_composition30_mismatch");
  for (const composition of rootCompositions) {
    if (!Array.isArray(composition.targetSpecies) || JSON.stringify([...composition.targetSpecies].sort())
      !== JSON.stringify([...orders.get(composition.originalOrderMasterKey).detail.species].sort())) throw Error("root_composition_source_species_mismatch");
  }
  const devices = [];
  const bindings = [];
  const compositionAssignments = [];
  const pricingAssignments = [];
  for (const workspaceId of wp09WorkspaceAllowlist) {
    for (const orderMasterKey of [...newOrders].sort()) pricingAssignments.push({ workspaceId, orderMasterKey,
      priceKrw: priceMap.get(orderMasterKey).priceKrw, salesUnitCode: "case", billingReflectionEnabled: true, syntheticPriceNotClinicalRecommendation: true,
      sourceOrderSha256: hashCanonical(orders.get(orderMasterKey)) });
    const workspaceDevices = wp09VirtualDeviceModels.map(model => ({
      id: uuidV5(`wp09:workspace-lab-device:v1:${workspaceId}:CLAiR:${model}`), workspaceId,
      name: `CLAiR 합성 수동 입력 · ${model} (실제 장비 아님)`, manufacturer: "CLAiR", model,
      kind: "manual", entryMode: "manual_entry", integrationStatus: "not_integrated", active: true,
      dataOrigin: "synthetic", clinicalUseAllowed: false,
    }));
    devices.push(...workspaceDevices);
    for (const orderMasterKey of [...atomicKeys].sort()) {
      const order = orders.get(orderMasterKey);
      const species = order?.detail?.species;
      if (!Array.isArray(species) || species.length === 0 || new Set(species).size !== species.length
        || species.some(value => !["dog", "cat"].includes(value))) throw Error(`order_species_invalid:${orderMasterKey}`);
      const orderProfiles = payload.labOrderProfiles.filter(profile => profile.orderMasterKey === orderMasterKey);
      if (orderProfiles.length !== 1 || !orderProfiles[0].labTestMasterKey || !orderProfiles[0].specimenMasterKey) throw Error(`atomic_assay_specimen_ambiguous:${orderMasterKey}`);
      const orderProfile = orderProfiles[0];
      for (const speciesCode of [...species].sort()) {
        const candidates = profiles.filter(profile => profile.species === speciesCode
          && profile.specimenMasterKey === orderProfile.specimenMasterKey
          && profile.rules.some(rule => rule.supported === true && rule.testMasterKey === orderProfile.labTestMasterKey));
        if (candidates.length !== 1) throw Error(`manual_profile_not_unique:${orderMasterKey}:${speciesCode}:${candidates.length}`);
        const profile = candidates[0];
        const rules = profile.rules.filter(rule => rule.supported === true && rule.testMasterKey === orderProfile.labTestMasterKey);
        if (rules.length !== 1) throw Error(`profile_rule_not_unique:${orderMasterKey}:${speciesCode}`);
        const device = workspaceDevices.find(device => device.model === profile.device.model);
        if (!device) throw Error("manual_device_not_frozen");
        bindings.push({ workspaceId, orderMasterKey, species: speciesCode,
          labTestMasterKey: orderProfile.labTestMasterKey, specimenMasterKey: orderProfile.specimenMasterKey,
          deviceId: device.id, profileVersionId: profile.id, profileKey: profile.profileKey, profileRevision: profile.revision,
          sourceOrderSha256: hashCanonical(order), sourceOrderProfileSha256: hashCanonical(orderProfile),
          sourceProfileSha256: hashCanonical(profile), sourceRuleSha256: hashCanonical(rules[0]),
          defaultRetestBillingPolicy: "no_charge" });
      }
    }
    for (const composition of [...rootCompositions].sort((left, right) => left.masterKey.localeCompare(right.masterKey, "en"))) {
      const noCharge = workspaceId === "workspace-clinical-master-pilot-v1" && composition.originalOrderMasterKey === "phase1.optionb.v1.order.metabolic";
      compositionAssignments.push({ workspaceId, originalOrderMasterKey: composition.originalOrderMasterKey,
        compositionMasterKey: composition.masterKey, compositionVersionId: composition.id, compositionRevision: composition.revision,
        targetSpecies: [...composition.targetSpecies], billingPolicy: noCharge ? "no_charge" : "preserve_parent_price",
        defaultRetestBillingPolicy: "no_charge", sourceCompositionSha256: hashCanonical(composition),
        sourceOrderSha256: hashCanonical(orders.get(composition.originalOrderMasterKey)) });
    }
  }
  if (devices.length !== 9 || new Set(devices.map(device => device.id)).size !== 9 || bindings.length !== 519
    || new Set(bindings.map(binding => `${binding.workspaceId}:${binding.orderMasterKey}:${binding.species}`)).size !== 519
    || compositionAssignments.length !== 90 || compositionAssignments.filter(assignment => assignment.billingPolicy === "no_charge").length !== 1
    || pricingAssignments.length !== 159) throw Error("workspace_configuration_counts_mismatch");
  const configuration = { schemaVersion: 1, artifactState: "non_applied", applied: false, runtimeImportAllowed: false,
    sourceArtifact: `${folder}remote-release.non-applied.v1.json`, sourceArtifactSha256: hashCanonical(source),
    sourceCandidateSemanticSha256: source.candidateSemanticSha256,
    newPriceIdentitySource: { artifact: `${folder}combined-release.non-applied.v1.json`, artifactSha256: hashCanonical(combined),
      candidateSemanticSha256: combined.candidateSemanticSha256, newOrdersSha256: hashCanonical(newOrders) },
    workspaceAllowlist: [...wp09WorkspaceAllowlist], foreignControl: wp09ForeignControl,
    approvedOptionalChoices: { newPrices: { approved: true, choice: "explicit_differentiated_synthetic_per_case_krw_new53_only",
      currency: "KRW", salesUnitCode: "case", billingReflectionEnabled: true, existingPrices: "preserve", existingBillingReflection: "preserve",
      pilotMetabolic: "remain_nonbillable", syntheticPriceNotClinicalRecommendation: true, priceContext,
      summary: { all: priceSummary(syntheticPriceMap), dispensing: priceSummary(syntheticPriceMap.filter(row => row.category === "dispensing")),
        atomicLab: priceSummary(syntheticPriceMap.filter(row => row.category !== "dispensing")) } } },
    syntheticPriceMap,
    defaultRetestBillingPolicy: "no_charge", devices, bindings, compositionAssignments, pricingAssignments,
    counts: { workspaces: 3, atomicOrdersPerWorkspace: 90, bindingsPerWorkspace: 173, bindings: 519,
      devicesPerWorkspace: 3, devices: 9, rootCompositionsPerWorkspace: 30, compositionAssignments: 90,
      preserveParentPriceAssignments: 89, noChargeAssignments: 1, newPricedOrders: 53, newDispensingOrders: 19,
      newAtomicLabOrders: 34, pricingAssignments: 159 },
    snapshotSha256: { devices: hashCanonical(devices), bindings: hashCanonical(bindings), compositionAssignments: hashCanonical(compositionAssignments),
      pricingAssignments: hashCanonical(pricingAssignments), syntheticPriceMap: hashCanonical(syntheticPriceMap) } };
  return { ...configuration, artifactSha256: hashCanonical(configuration) };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const source = JSON.parse(readFileSync(`${folder}remote-release.non-applied.v1.json`, "utf8"));
  const combined = JSON.parse(readFileSync(`${folder}combined-release.non-applied.v1.json`, "utf8"));
  const artifact = buildWp09WorkspaceConfiguration(source, combined);
  writeFileSync(`${folder}workspace-configuration.non-applied.v1.json`, JSON.stringify(artifact, null, 2) + "\n");
  console.log(JSON.stringify({ artifactSha256: artifact.artifactSha256, sourceCandidateSemanticSha256: artifact.sourceCandidateSemanticSha256, ...artifact.counts, applied: false }));
}
