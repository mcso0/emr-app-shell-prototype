import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildWp09WorkspaceConfiguration as buildConfiguration, wp09WorkspaceAllowlist, wp09VirtualDeviceModels, wp09ForeignControl } from "../scripts/generate-wp09-workspace-configuration.mjs";
import { hashCanonical } from "../scripts/generate-clinical-master-execution-preset-release-v1.mjs";
const folder = "docs/work/clinical-master/order-execution-defaults/artifacts/wp-09/";
const readSource = () => JSON.parse(readFileSync(`${folder}remote-release.non-applied.v1.json`, "utf8"));
const readCombined = () => JSON.parse(readFileSync(`${folder}combined-release.non-applied.v1.json`, "utf8"));
const buildWp09WorkspaceConfiguration = (source, combined = readCombined()) => buildConfiguration(source, combined);
const rehash = source => ({ ...source, candidateSemanticSha256: hashCanonical(source.payload) });

test("three exact workspaces freeze519 assignments,9 explicitly virtual devices and90 root compositions", () => {
  const artifact = buildWp09WorkspaceConfiguration(readSource());
  assert.deepEqual(artifact.workspaceAllowlist, wp09WorkspaceAllowlist); assert.equal(artifact.foreignControl, wp09ForeignControl);
  assert.equal(artifact.bindings.length, 519); assert.equal(artifact.devices.length, 9); assert.equal(artifact.compositionAssignments.length, 90);
  assert.equal(new Set(artifact.devices.map(device => device.id)).size, 9);
  for (const workspaceId of wp09WorkspaceAllowlist) {
    const devices = artifact.devices.filter(device => device.workspaceId === workspaceId);
    assert.deepEqual(devices.map(device => device.model), wp09VirtualDeviceModels);
    assert.equal(artifact.bindings.filter(binding => binding.workspaceId === workspaceId).length, 173);
    assert.equal(artifact.compositionAssignments.filter(assignment => assignment.workspaceId === workspaceId).length, 30);
    assert.equal(new Set(artifact.bindings.filter(binding => binding.workspaceId === workspaceId).map(binding => binding.orderMasterKey)).size, 90);
  }
  for (const device of artifact.devices) {
    assert.equal(device.manufacturer, "CLAiR"); assert.equal(device.kind, "manual"); assert.equal(device.integrationStatus, "not_integrated");
    assert.equal(device.clinicalUseAllowed, false); assert.match(device.name, /합성.*실제 장비 아님/);
    assert.match(device.id, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  }
  assert.equal(JSON.stringify(artifact).includes("analyzer_reference"), false);
  assert.equal(artifact.applied, false); assert.equal(artifact.runtimeImportAllowed, false);
});
test("each order/species maps to one exact supported assay/specimen/manual profile without copied or inferred ranges", () => {
  const source = readSource(); const artifact = buildWp09WorkspaceConfiguration(source);
  const orders = new Map(source.payload.records.filter(record => record.recordType === "order").map(record => [record.masterKey, record]));
  for (const binding of artifact.bindings) {
    const order = orders.get(binding.orderMasterKey); assert.ok(order.detail.species.includes(binding.species));
    const sourceLink = source.payload.labOrderProfiles.find(link => link.orderMasterKey === binding.orderMasterKey);
    assert.equal(binding.labTestMasterKey, sourceLink.labTestMasterKey); assert.equal(binding.specimenMasterKey, sourceLink.specimenMasterKey);
    const matches = source.payload.labResultProfiles.filter(profile => profile.species === binding.species && profile.specimenMasterKey === binding.specimenMasterKey
      && profile.device.manufacturer === "CLAiR" && profile.device.kind === "manual"
      && profile.rules.some(rule => rule.testMasterKey === binding.labTestMasterKey && rule.supported));
    assert.equal(matches.length, 1); const profile = matches[0];
    assert.equal(binding.profileVersionId, profile.id); assert.equal(binding.profileKey, profile.profileKey); assert.equal(binding.profileRevision, profile.revision);
    assert.equal(binding.sourceProfileSha256, hashCanonical(profile)); assert.equal(binding.sourceOrderSha256, hashCanonical(order));
    assert.equal(binding.sourceOrderProfileSha256, hashCanonical(sourceLink));
    assert.equal(binding.sourceRuleSha256, hashCanonical(profile.rules.find(rule => rule.testMasterKey === binding.labTestMasterKey && rule.supported)));
    assert.ok(artifact.devices.some(device => device.id === binding.deviceId && device.workspaceId === binding.workspaceId && device.model === profile.device.model));
    assert.equal(binding.referenceInterval, undefined); assert.equal(binding.defaultRetestBillingPolicy, "no_charge");
    assert.notEqual(binding.workspaceId, wp09ForeignControl);
  }
});
test("only pilot metabolic composition is no_charge;89 preserve parent price and all retests stay no_charge", () => {
  const source = readSource(); const artifact = buildWp09WorkspaceConfiguration(source);
  assert.equal(artifact.compositionAssignments.filter(assignment => assignment.billingPolicy === "preserve_parent_price").length, 89);
  const exceptions = artifact.compositionAssignments.filter(assignment => assignment.billingPolicy === "no_charge");
  assert.equal(exceptions.length, 1); assert.equal(exceptions[0].workspaceId, "workspace-clinical-master-pilot-v1");
  assert.equal(exceptions[0].originalOrderMasterKey, "phase1.optionb.v1.order.metabolic");
  for (const assignment of artifact.compositionAssignments) {
    const composition = source.payload.labCompositions.find(item => item.originalOrderMasterKey === assignment.originalOrderMasterKey);
    assert.ok(composition); assert.equal(assignment.compositionVersionId, composition.id); assert.equal(assignment.compositionRevision, composition.revision);
    assert.equal(assignment.sourceCompositionSha256, hashCanonical(composition)); assert.deepEqual(assignment.targetSpecies, composition.targetSpecies);
    assert.equal(assignment.defaultRetestBillingPolicy, "no_charge"); assert.notEqual(assignment.workspaceId, wp09ForeignControl);
  }
});
test("source drift, scope changes and missing or ambiguous profile matches fail closed", () => {
  let source = readSource(); source.payload.records[0].names[0].name += " drift";
  assert.throws(() => buildWp09WorkspaceConfiguration(source), /hash_mismatch/);
  source = readSource(); source.workspaceAllowlist.push(wp09ForeignControl);
  assert.throws(() => buildWp09WorkspaceConfiguration(source), /workspace_scope_mismatch/);
  source = readSource(); const selected = buildWp09WorkspaceConfiguration(source).bindings[0].profileVersionId;
  source.payload.labResultProfiles = source.payload.labResultProfiles.filter(profile => profile.id !== selected);
  assert.throws(() => buildWp09WorkspaceConfiguration(rehash(source)), /manual_profile_not_unique/);
  source = readSource(); const duplicate = structuredClone(source.payload.labResultProfiles.find(profile => profile.id === selected));
  duplicate.id = "97090000-0000-4000-8000-000000000001"; source.payload.labResultProfiles.push(duplicate);
  assert.throws(() => buildWp09WorkspaceConfiguration(rehash(source)), /manual_profile_not_unique/);
});
test("configuration and component checksums reproduce exactly from the pinned source artifact", () => {
  const source = readSource(); const before = structuredClone(source); const artifact = buildWp09WorkspaceConfiguration(source);
  assert.deepEqual(source, before); assert.equal(artifact.sourceArtifactSha256, hashCanonical(source));
  const { artifactSha256, ...body } = artifact; assert.equal(artifactSha256, hashCanonical(body));
  for (const key of ["devices", "bindings", "compositionAssignments", "pricingAssignments", "syntheticPriceMap"]) assert.equal(artifact.snapshotSha256[key], hashCanonical(artifact[key]));
  assert.deepEqual(JSON.parse(readFileSync(`${folder}workspace-configuration.non-applied.v1.json`, "utf8")), artifact);
});
test("approved differentiated case fees apply only to exact new53 orders across3 workspaces", () => {
  const source = readSource(); const combined = readCombined(); const artifact = buildWp09WorkspaceConfiguration(source, combined);
  assert.equal(artifact.pricingAssignments.length, 159); assert.equal(artifact.counts.newDispensingOrders, 19); assert.equal(artifact.counts.newAtomicLabOrders, 34);
  assert.equal(artifact.approvedOptionalChoices.newPrices.approved, true);
  assert.equal(artifact.approvedOptionalChoices.newPrices.existingPrices, "preserve");
  assert.equal(artifact.approvedOptionalChoices.newPrices.pilotMetabolic, "remain_nonbillable");
  assert.equal(artifact.approvedOptionalChoices.newPrices.salesUnitCode, "case");
  assert.equal(artifact.syntheticPriceMap.length, 53);
  const prices = new Map(artifact.syntheticPriceMap.map(row => [row.orderMasterKey, row]));
  assert.equal(prices.size, 53); assert.deepEqual([...prices.keys()], [...combined.newOrders].sort());
  const originalKeys = new Set(combined.ledger.map(entry => entry.originalMasterKey));
  for (const workspaceId of wp09WorkspaceAllowlist) {
    const assignments = artifact.pricingAssignments.filter(assignment => assignment.workspaceId === workspaceId);
    assert.deepEqual(assignments.map(assignment => assignment.orderMasterKey), [...combined.newOrders].sort());
  }
  for (const assignment of artifact.pricingAssignments) {
    assert.equal(originalKeys.has(assignment.orderMasterKey), false); assert.equal(assignment.priceKrw, prices.get(assignment.orderMasterKey).priceKrw);
    assert.equal(assignment.salesUnitCode, "case");
    assert.equal(assignment.billingReflectionEnabled, true); assert.equal(assignment.syntheticPriceNotClinicalRecommendation, true);
    assert.notEqual(assignment.workspaceId, wp09ForeignControl); assert.notEqual(assignment.orderMasterKey, "phase1.optionb.v1.order.metabolic");
    assert.equal(assignment.sourceOrderSha256, hashCanonical(source.payload.records.find(record => record.masterKey === assignment.orderMasterKey)));
  }
  for (const price of prices.values()) {
    assert.equal(price.salesUnitCode, "case"); assert.equal(price.currency, "KRW");
    assert.equal(price.priceBasis, "synthetic_per_case_demo_fee"); assert.match(price.provenance, /not_item_level_market_evidence/);
    assert.ok(price.rationale.length > 40); assert.notEqual(price.priceKrw, 1000);
  }
  assert.deepEqual(artifact.approvedOptionalChoices.newPrices.summary, {
    all: { orders: 53, minKrw: 5000, maxKrw: 45000, checksumSumKrwNotAnInvoice: 613000 },
    dispensing: { orders: 19, minKrw: 7000, maxKrw: 45000, checksumSumKrwNotAnInvoice: 343000 },
    atomicLab: { orders: 34, minKrw: 5000, maxKrw: 20000, checksumSumKrwNotAnInvoice: 270000 },
  });
});
test("exact synthetic item choices and broad panel context cannot become market or panel-sum claims", () => {
  const artifact = buildWp09WorkspaceConfiguration(readSource());
  const prices = new Map(artifact.syntheticPriceMap.map(row => [row.orderMasterKey, row.priceKrw]));
  const dispensing = {
    "caplin-ofloxacin-0-3-percent": 18000, "cerenia-maropitant-10mg-ml-sc": 25000, "durvet-chlorhexidine-2-percent": 12000,
    "epi-otic-za-ear-cleaner": 25000, "famotidine-20mg-tablet": 7000, "fortiflora-canine-1g-sachet": 15000,
    "humilac-jp-moisturizer-spray": 25000, "legalon-silymarin-140mg-capsule": 12000, "muricin-mupirocin-2-percent": 18000,
    "neurontin-100mg-capsule": 10000, "omeprazole-10mg-delayed-capsule": 10000, "optimmune-ciclosporin-0-2-percent": 45000,
    "oralade-advanced-gi-500ml": 25000, "prilactone-next-10mg-tablet": 18000, "refresh-tears-cmc-0-5-percent": 10000,
    "silvadene-silver-sulfadiazine-1-percent": 18000, "topcare-povidone-iodine-10-percent": 10000,
    "ursodiol-300mg-capsule": 15000, "vetmedin-1-25mg-tablet": 25000,
  };
  for (const [key, expected] of Object.entries(dispensing)) assert.equal(prices.get(`cm.order.dispensing-wp03.${key}`), expected);
  const serum = { "03": 12000, "04": 12000, "05": 12000, "06": 12000, "07": 12000, "08": 10000, "09": 10000, "10": 10000 };
  for (const [key, expected] of Object.entries(serum)) assert.equal(prices.get(`cm.order.lab.atomic.cm-lab-test-synthetic-${key}.cm-specimen-serum`), expected);
  for (const key of ["11", "12"]) assert.equal(prices.get(`cm.order.lab.atomic.cm-lab-test-synthetic-${key}.cm-specimen-citrate-plasma`), 20000);
  assert.equal(prices.get("cm.order.lab.atomic.cm-lab-test-synthetic-15.cm-specimen-urine"), 5000);
  assert.equal(prices.get("cm.order.lab.atomic.cm-lab-test-synthetic-16.cm-specimen-urine"), 10000);
  assert.equal(prices.get("cm.order.lab.atomic.phase1-optionb-v1-test-glucose.phase1-optionb-v1-specimen-serum"), 8000);
  const basicCbc = ["baso-abs", "baso-pct", "eos-abs", "eos-pct", "hgb", "lym-abs", "lym-pct", "mch", "mchc", "mcv", "mono-abs", "mono-pct", "mpv", "neu-abs", "neu-pct", "pct", "pdw", "rbc", "rdw"];
  for (const key of basicCbc) assert.equal(prices.get(`cm.order.lab.test.cbc-${key}`), 5000);
  assert.equal(prices.get("cm.order.lab.test.cbc-retic-abs"), 10000); assert.equal(prices.get("cm.order.lab.test.cbc-retic-hgb"), 12000);
  const context = artifact.approvedOptionalChoices.newPrices.priceContext;
  assert.equal(context.sourceUrl, "https://www.mafra.go.kr/bbs/home/792/592824/download.do");
  assert.equal(context.publicationDate, "2025-12-22"); assert.equal(context.pdfPage, 3);
  assert.deepEqual(context.panelMedianKrw, { cbc: 34000, serumChemistry: 80000, electrolytes: 32000 });
  assert.match(context.use, /no item-level or dispensing price evidence/); assert.match(context.panelBilling, /never sum atomic/);
});
test("price identity corruption cannot add an existing or duplicate order", () => {
  const source = readSource(); const combined = readCombined();
  combined.newOrders[0] = combined.ledger[0].originalMasterKey;
  assert.throws(() => buildWp09WorkspaceConfiguration(source, combined), /new_price53_identity_mismatch/);
  const duplicate = readCombined(); duplicate.newOrders[0] = duplicate.newOrders[1];
  assert.throws(() => buildWp09WorkspaceConfiguration(source, duplicate), /new_price53_identity_mismatch/);
});
test("an unknown new order or medicine unit drift cannot receive a fallback case price", () => {
  const source = readSource(); const combined = readCombined();
  const key = combined.newOrders.find(key => key.startsWith("cm.order.dispensing-wp03."));
  const order = source.payload.records.find(record => record.masterKey === key);
  order.detail.defaultSalesUnitCode = "tablet";
  assert.throws(() => buildWp09WorkspaceConfiguration(rehash(source), combined), /synthetic_price_unit_or_category_mismatch/);
  order.detail.defaultSalesUnitCode = "case";
  order.masterKey = "cm.order.dispensing-wp03.unapproved-synthetic-price";
  combined.newOrders[combined.newOrders.indexOf(key)] = order.masterKey;
  assert.throws(() => buildWp09WorkspaceConfiguration(rehash(source), combined), /synthetic_price_map_exact_new53_required/);
});
