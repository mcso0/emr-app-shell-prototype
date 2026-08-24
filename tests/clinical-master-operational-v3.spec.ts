import { createHash } from "node:crypto";

import { expect, test } from "@playwright/test";

import authoringJson from "./fixtures/clinical-master-operational-v3-authoring.json";
import adapterJson from "./fixtures/clinical-master-operational-v3-adapter-output.json";
import pricingJson from "./fixtures/clinical-master-operational-v3-pricing-adoption.json";
import labSemanticsJson from "./fixtures/clinical-master-operational-v3-lab-semantics.json";
import readbackJson from "./fixtures/clinical-master-airtable-operational-v3-current-readback.json";
import finalReadbackJson from "./fixtures/clinical-master-airtable-operational-v3-final-readback.json";
import manifestJson from "./fixtures/clinical-master-operational-v3-airtable-write-manifest.json";
import deltaManifestJson from "./fixtures/clinical-master-operational-v3-airtable-delta-manifest.json";
import basePublisherJson from "./fixtures/clinical-master-publisher-full-type-hotfix.fixture.json";
import { adaptClinicalMasterAirtableAuthoringExport } from "../src/features/clinical-master/server-clinical-master-airtable-publish-adapter";
import { validateClinicalMasterPublishPayload } from "../src/features/clinical-master/server-clinical-master-publisher-core";

type Name = {
  languageCode: string;
  nameKind: string;
  name: string;
  searchable?: boolean;
  sortOrder?: number;
};
type RecordRow = {
  masterKey: string;
  recordType: string;
  names: Name[];
  detail: Record<string, unknown>;
  [key: string]: unknown;
};
type AuthoringFixture = {
  release: Record<string, unknown>;
  sources: Record<string, unknown>[];
  records: RecordRow[];
  classificationPaths: Record<string, string>[];
  labPanelItems: Record<string, unknown>[];
  labOrderProfiles: Record<string, unknown>[];
  diagnosisCategoryLinks: Record<string, unknown>[];
};
type AdapterFixture = {
  payload: Record<string, unknown> & { records: RecordRow[] };
  excluded: Record<string, unknown>;
};
type CheongdamRow = {
  displayName: string;
  observedCatalogRowId: string;
  observedMasterKey: string | null;
  status: string;
  collisionAction: string;
  semanticFingerprintRequired: boolean;
  semanticCollisionStatus: string;
  order: number;
};
type PricingAdoptionPolicy = {
  heldMasterRouteMapping: Record<string, string>;
  targetWorkspaceIds: string[];
  excludedWorkspaceIds: string[];
  existingCheongdamRows: CheongdamRow[];
  foreignWorkspacePolicy: Record<string, unknown>;
};
type PricingFixture = {
  categoryCounts: Record<string, number>;
  categoryPriceBases: Record<string, number>;
  totalSyntheticWorkspacePriceKrw: number;
  orders: Array<Record<string, unknown> & { masterKey: string; researchCategory: string; syntheticWorkspacePriceKrw: number }>;
  adoptionPolicy: PricingAdoptionPolicy;
};
type ReadbackFixture = {
  baselineSha256: string;
  mutationScope?: string;
  tableCounts: Record<string, number>;
  sourceIdentity: Record<string, unknown>;
  tables: Record<string, {
    tableId: string;
    fieldIdsByName: Record<string, string>;
    recordCount: number;
    records: Array<{ airtableRecordId: string; fields: Record<string, unknown> }>;
  }>;
};
type ManifestPayload = { stableKey: string; expectedComputedRowLabel?: string; fields: Record<string, unknown>; fieldsByFieldId: Record<string, unknown> };
type ManifestTable = Record<string, unknown> & {
  createPayloads: ManifestPayload[];
};
type ManifestFixture = {
  writeAllowed: boolean;
  mutationsPerformed: number;
  sourceOfTruth: Record<string, unknown>;
  semanticDiffAgainstLiveReadback: Record<string, unknown>;
  tables: Record<string, ManifestTable>;
  expectedAirtableTableCounts: Record<string, number>;
  schemaVersion: string;
  casBaselineGate: Record<string, unknown>;
  dependencyOrder: string[];
  rollbackOrder: string[];
  releaseDraft: { airtableRecordId: string; beforeFields: Record<string, unknown>; beforeWritableFields: Record<string, unknown>; afterFields: Record<string, unknown>; rollbackRestore: Record<string, unknown> };
  rollbackJournalTemplate: { mode: string; entries: Array<{ createdRecordId: string | null; stableKey: string }> };
};
type LabSemanticsFixture = {
  tests: Array<Record<string, unknown> & { masterKey: string; testCode: string; resultInputTypeKey: string; canonicalUnitKey: string | null; specimenMasterKey: string }>;
  panelLinks: Array<{ panelMasterKey: string; testMasterKeys: string[] }>;
  profiles: Array<Record<string, string | null>>;
};
type DeltaTable = {
  updateExisting: number;
  create: number;
  createPayloads: unknown[];
  updatePayloads: Array<{
    linkedNameLookup?: {
      recordId: string;
      before: Array<{ id: string; name: string }>;
      after: Array<{ id: string; name: string }>;
      operation: string;
    };
  }>;
};
type DeltaManifestFixture = {
  schemaVersion: string;
  operationMode: string;
  writeAllowed: boolean;
  mutationsPerformed: number;
  executable: boolean;
  executionEligibility: Record<string, unknown>;
  sourceOfTruth: Record<string, unknown>;
  tables: Record<string, DeltaTable>;
  expectedBeforeSha256: Record<string, string>;
  expectedPostSha256: Record<string, string>;
  expectedPostFullReadbackSha256: string;
  rollbackGate: Record<string, unknown>;
  historicalEvidence: Record<string, unknown>;
  safetyChecks: {
    noCreatePayloads: boolean;
    noUnknownGeneratedRecordIds: boolean;
    noSourcePrimaryKeyRemap: boolean;
    noReleaseDraftMutation: boolean;
    noAirtableWritesPerformed: boolean;
  };
};

const authoring = authoringJson as unknown as AuthoringFixture;
const adapterFixture = adapterJson as unknown as AdapterFixture;
const pricing = pricingJson as unknown as PricingFixture;
const labSemantics = labSemanticsJson as unknown as LabSemanticsFixture;
const readback = readbackJson as unknown as ReadbackFixture;
const finalReadback = finalReadbackJson as unknown as ReadbackFixture;
const manifest = manifestJson as unknown as ManifestFixture;
const deltaManifest = deltaManifestJson as unknown as DeltaManifestFixture;
const basePublisher = basePublisherJson as unknown as { records: RecordRow[]; classificationPaths: Record<string, string>[]; labPanelItems: Record<string, unknown>[]; labOrderProfiles: Record<string, unknown>[] };

const expectedCategoryCounts = {
  consultation: 12,
  preventive: 12,
  lab: 30,
  imaging: 12,
  treatment: 18,
  dispensing: 16,
  "surgery/anesthesia": 8,
  inpatient: 6,
  emergency: 3,
  dental: 2,
  "certificate/misc": 1,
};

const expectedTypeCounts = {
  clinical_action: 13,
  chart_group: 8,
  diagnosis: 12,
  diagnosis_category: 12,
  lab_panel: 10,
  lab_test: 36,
  order: 120,
  order_category: 14,
  result_input_type: 3,
  species: 2,
  specimen_type: 8,
  task_route: 7,
  unit: 9,
};

const legacyInitialMasterKey = "cm.order.consult.initial";
const v3InitialMasterKey = "cm.order.consult.first-visit";

function countsBy<T extends string>(values: T[]) {
  return values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function sortCanonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortCanonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortCanonical((value as Record<string, unknown>)[key])]));
  }
  return value;
}

function readbackBaselineHash() {
  return readbackBaselineHashFor(readback);
}

function readbackBaselineHashFor(value: ReadbackFixture) {
  const withoutHash: Record<string, unknown> = { ...value };
  delete withoutHash.baselineSha256;
  return createHash("sha256").update(JSON.stringify(sortCanonical(withoutHash))).digest("hex");
}

function readbackTableHashFor(value: ReadbackFixture, tableName: string) {
  const table = value.tables[tableName];
  const canonicalTable = {
    ...table,
    records: table.records.slice().sort((left, right) => left.airtableRecordId.localeCompare(right.airtableRecordId)),
  };
  return createHash("sha256").update(JSON.stringify(sortCanonical(canonicalTable))).digest("hex");
}

function optionName(value: unknown): unknown {
  if (value && typeof value === "object" && !Array.isArray(value) && "name" in value) return (value as { name: unknown }).name;
  return value;
}

function linkId(value: unknown): string | null {
  if (value && typeof value === "object" && !Array.isArray(value) && "id" in value) return String((value as { id: unknown }).id);
  return null;
}

function keySet(rows: Array<{ masterKey: string }>) {
  return new Set(rows.map((row) => row.masterKey));
}

function scanKeys(value: unknown, keys: string[] = []) {
  if (Array.isArray(value)) {
    value.forEach((item) => scanKeys(item, keys));
  } else if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, child]) => {
      keys.push(key);
      scanKeys(child, keys);
    });
  }
  return keys;
}

function scanLinkRefs(value: unknown, links: Array<{ resolveBy: string; resolvedRecordId: string | null }> = []) {
  if (Array.isArray(value)) {
    value.forEach((item) => scanLinkRefs(item, links));
  } else if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    if (object.resolveBy === "stableKey" && "resolvedRecordId" in object) links.push(object as { resolveBy: string; resolvedRecordId: string | null });
    Object.values(object).forEach((child) => scanLinkRefs(child, links));
  }
  return links;
}

function omitNulls(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(omitNulls);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).filter(([, child]) => child !== null && child !== undefined).map(([key, child]) => [key, omitNulls(child)]));
  }
  return value;
}

test("operational v3 fixture has the exact authoring, publisher, and pricing boundaries", () => {
  expect(authoring.records).toHaveLength(254);
  expect(authoring.records.reduce((total, row) => total + row.names.length, 0)).toBe(254);
  expect(authoring.records.every((row) => row.names.length === 1)).toBe(true);
  expect(new Set(authoring.records.map((row) => row.masterKey)).size).toBe(254);
  expect(countsBy(authoring.records.map((row) => row.recordType))).toEqual(expectedTypeCounts);
  const validChartCodes = new Set(["CG_CONSULTATION", "CG_PREVENTION", "CG_EXAM", "CG_PROCEDURE", "CG_SURGERY", "CG_INPATIENT", "CG_THERAPY", "CG_MEDICATION_SUPPLY"]);
  const chartRows = authoring.records.filter((row) => row.recordType === "chart_group");
  expect(chartRows).toHaveLength(8);
  expect(chartRows.every((row) => validChartCodes.has(String(row.detail.groupCode)))).toBe(true);
  expect(chartRows.map((row) => row.detail.groupCode).sort()).toEqual([
    "CG_CONSULTATION", "CG_EXAM", "CG_INPATIENT", "CG_MEDICATION_SUPPLY", "CG_PREVENTION", "CG_PROCEDURE", "CG_SURGERY", "CG_THERAPY",
  ]);
  const genericOperationalName = /^합성 .*오더 \d+$|^합성 검사 \d+$|^합성 패널 \d+$/u;
  expect(authoring.records.flatMap((row) => row.names).filter((name) => genericOperationalName.test(name.name))).toEqual([]);
  expect(authoring.sources).toHaveLength(1);
  expect(authoring.sources[0]).toMatchObject({
    sourceKey: "source.synthetic.operational-pilot.v1",
    sourceType: "synthetic",
    title: "CLAiR operational pilot fixture",
    sourceVersion: "v1",
  });
  expect(authoring.release).toMatchObject({
    releaseKey: "cm.release.airtable.operational-master.v3",
    status: "approved",
  });

  const adapted = adaptClinicalMasterAirtableAuthoringExport(authoring as never);
  expect(adapted.payload).toEqual(adapterFixture.payload);
  expect(adapted.excluded).toEqual(adapterFixture.excluded);
  expect(adapterFixture.payload.records).toHaveLength(230);
  expect(adapterFixture.excluded).toMatchObject({
    recordCount: 24,
    diagnosisCategoryCount: 12,
    diagnosisCount: 12,
    diagnosisCategoryLinkCount: 12,
  });
  expect(validateClinicalMasterPublishPayload(adapterFixture.payload as never)).toEqual([]);
  expect(adapterFixture.payload.releaseKey).toBe("cm.release.airtable.operational-master.v3");
  expect(adapterFixture.payload.records.some((row) => row.recordType === "diagnosis" || row.recordType === "diagnosis_category")).toBe(false);

  const forbiddenPublisherKey = /(?:price|pricing|weight|orderset|order_set)/iu;
  expect(scanKeys(adapterFixture.payload).filter((key) => forbiddenPublisherKey.test(key))).toEqual([]);
});

test("all thirty current orders and supporting lab rows are preserved while additions are deterministic", () => {
  const authoringByKey = new Map(authoring.records.map((row) => [row.masterKey, row]));
  const currentOrders = basePublisher.records.filter((row) => row.recordType === "order");
  expect(currentOrders).toHaveLength(30);
  for (const current of currentOrders) {
    const expectedMasterKey = current.masterKey === legacyInitialMasterKey ? v3InitialMasterKey : current.masterKey;
    expect(authoringByKey.get(expectedMasterKey)).toMatchObject({
      masterKey: expectedMasterKey,
      recordType: current.recordType,
      detail: current.detail,
      names: current.names,
    });
  }

  for (const current of basePublisher.records) {
    const expectedMasterKey = current.masterKey === legacyInitialMasterKey ? v3InitialMasterKey : current.masterKey;
    const expectedDetail = current.recordType === "task_route"
      ? { routeCode: current.detail.routeCode }
      : current.detail;
    expect(authoringByKey.get(expectedMasterKey)).toMatchObject({
      masterKey: expectedMasterKey,
      recordType: current.recordType,
      detail: expectedDetail,
      names: current.names,
    });
    const adaptedCurrent = adapterFixture.payload.records.find((row) => row.masterKey === expectedMasterKey);
    expect(adaptedCurrent).toMatchObject({
      masterKey: expectedMasterKey,
      recordType: current.recordType,
      detail: current.detail,
      names: current.names,
    });
  }
  for (const currentPath of basePublisher.classificationPaths) {
    expect(authoring.classificationPaths).toContainEqual(currentPath);
  }
  for (const currentLink of basePublisher.labPanelItems) {
    expect(authoring.labPanelItems).toContainEqual(currentLink);
  }
  for (const currentProfile of basePublisher.labOrderProfiles) {
    expect(authoring.labOrderProfiles).toContainEqual(currentProfile);
  }

  const normalizeOperationalName = (value: string) => value.toLocaleLowerCase("ko-KR").replace(/[^0-9a-z가-힣]/gu, "");
  const orderNames = authoring.records.filter((row) => row.recordType === "order").map((row) => normalizeOperationalName(String(row.names[0]?.name ?? "")));
  expect(new Set(orderNames).size).toBe(120);
  const semanticCollisionDenylist = new Set([
    "귀세정처치", "복부초음파추가", "흉부방사선추가", "복부방사선추가", "경구액조제수납", "안약조제수납", "귀약조제수납", "분말조제수납", "정제분할조제수납", "조제용소모품수납", "처방봉투라벨수납", "강아지예방접종추가", "고양이예방접종추가", "건강검진상담",
  ]);
  expect(orderNames.filter((name) => semanticCollisionDenylist.has(name))).toEqual([]);

  expect(pricing.categoryCounts).toEqual(expectedCategoryCounts);
  expect(pricing.orders).toHaveLength(120);
  const pricingKeys = new Set(pricing.orders.map((row) => row.masterKey));
  const orderKeys = new Set(authoring.records.filter((row) => row.recordType === "order").map((row) => row.masterKey));
  expect(pricingKeys.size).toBe(120);
  expect(pricingKeys).toEqual(orderKeys);
  expect(orderKeys.has(legacyInitialMasterKey)).toBe(false);
  expect(pricingKeys.has(legacyInitialMasterKey)).toBe(false);
  expect(orderKeys.has(v3InitialMasterKey)).toBe(true);
  expect(pricingKeys.has(v3InitialMasterKey)).toBe(true);
  expect(pricing.orders.every((row) => Number.isInteger(row.syntheticWorkspacePriceKrw) && row.syntheticWorkspacePriceKrw > 0)).toBe(true);
  expect(new Set(pricing.orders.map((row) => row.syntheticWorkspacePriceKrw)).size).toBe(120);
  expect(pricing.orders.reduce((total, row) => total + row.syntheticWorkspacePriceKrw, 0)).toBe(5529073);
  expect(pricing.totalSyntheticWorkspacePriceKrw).toBe(5529073);
  expect(pricing.categoryPriceBases).toEqual({
    consultation: 28000,
    preventive: 32000,
    lab: 36000,
    imaging: 42000,
    treatment: 48000,
    dispensing: 52000,
    "surgery/anesthesia": 68000,
    inpatient: 76000,
    emergency: 84000,
    dental: 90000,
    "certificate/misc": 96000,
  });
  const categoryPriceSerials = new Map<string, number>();
  for (const row of pricing.orders) {
    const serial = (categoryPriceSerials.get(row.researchCategory) ?? 0) + 1;
    categoryPriceSerials.set(row.researchCategory, serial);
    expect(row.syntheticWorkspacePriceKrw).toBe(pricing.categoryPriceBases[row.researchCategory] + serial);
  }
  expect(pricing.orders.every((row) => typeof row.researchCategory === "string")).toBe(true);
  expect(pricing.orders.find((row) => row.masterKey === "cm.order.consult.followup")?.researchCategory).toBe("consultation");
  expect(pricing.orders.find((row) => row.masterKey === "cm.order.consult.preventive-cat")?.researchCategory).toBe("preventive");

  const labTests = authoring.records.filter((row) => row.recordType === "lab_test");
  const labPanels = authoring.records.filter((row) => row.recordType === "lab_panel");
  expect(labTests).toHaveLength(36);
  expect(labPanels).toHaveLength(10);
  const expectedLabSemantics: Array<[string, string, string, string | null, number | null, string]> = [
    ["01", "RBC", "cm.result-input.numeric", "cm.unit.million-per-ul", 1, "cm.specimen.edta-whole-blood"],
    ["02", "HGB", "cm.result-input.numeric", "cm.unit.g-dl", 1, "cm.specimen.edta-whole-blood"],
    ["03", "AST", "cm.result-input.numeric", "cm.unit.u-l", 0, "cm.specimen.serum"],
    ["04", "TBIL", "cm.result-input.numeric", "cm.unit.mg-dl", 1, "cm.specimen.serum"],
    ["05", "ALB", "cm.result-input.numeric", "cm.unit.g-dl", 1, "cm.specimen.serum"],
    ["06", "CA", "cm.result-input.numeric", "cm.unit.mg-dl", 1, "cm.specimen.serum"],
    ["07", "PHOS", "cm.result-input.numeric", "cm.unit.mg-dl", 1, "cm.specimen.serum"],
    ["08", "NA", "cm.result-input.numeric", "cm.unit.mmol-l", 1, "cm.specimen.serum"],
    ["09", "K", "cm.result-input.numeric", "cm.unit.mmol-l", 1, "cm.specimen.serum"],
    ["10", "CL", "cm.result-input.numeric", "cm.unit.mmol-l", 1, "cm.specimen.serum"],
    ["11", "PT", "cm.result-input.numeric", "cm.unit.seconds", 1, "cm.specimen.citrate-plasma"],
    ["12", "APTT", "cm.result-input.numeric", "cm.unit.seconds", 1, "cm.specimen.citrate-plasma"],
    ["13", "RETIC", "cm.result-input.numeric", "cm.unit.percent", 1, "cm.specimen.edta-whole-blood"],
    ["14", "SMEAR", "cm.result-input.text", null, null, "cm.specimen.edta-whole-blood"],
    ["15", "UA_SG", "cm.result-input.coded", null, null, "cm.specimen.urine"],
    ["16", "UA_PROTEIN", "cm.result-input.numeric", "cm.unit.mg-dl", 1, "cm.specimen.urine"],
    ["17", "HCO3", "cm.result-input.numeric", "cm.unit.mmol-l", 1, "cm.specimen.serum"],
    ["18", "SKIN_CYTOLOGY", "cm.result-input.text", null, null, "cm.specimen.cytology-slide"],
    ["19", "EAR_CYTOLOGY", "cm.result-input.text", null, null, "cm.specimen.swab"],
    ["20", "MASS_CYTOLOGY", "cm.result-input.text", null, null, "cm.specimen.cytology-slide"],
    ["21", "JOINT_FLUID_CYTOLOGY", "cm.result-input.text", null, null, "cm.specimen.joint-fluid"],
    ["22", "MG", "cm.result-input.numeric", "cm.unit.mmol-l", 1, "cm.specimen.serum"],
    ["23", "BLOOD_TYPE", "cm.result-input.coded", null, null, "cm.specimen.edta-whole-blood"],
  ];
  expect(labSemantics.tests).toHaveLength(23);
  for (const [suffix, testCode, resultInputTypeKey, canonicalUnitKey, decimalScale, specimenMasterKey] of expectedLabSemantics) {
    const semantic = labSemantics.tests.find((row) => row.masterKey === `cm.lab-test.synthetic-${suffix}`);
    expect(semantic).toMatchObject({ testCode, resultInputTypeKey, canonicalUnitKey, decimalScale, specimenMasterKey });
    const authoringRow = labTests.find((row) => row.masterKey === semantic?.masterKey);
    expect(authoringRow?.detail).toMatchObject({ testCode, resultInputTypeKey, canonicalUnitKey });
    if (decimalScale === null) expect(authoringRow?.detail).not.toHaveProperty("decimalScale");
    else expect(authoringRow?.detail.decimalScale).toBe(decimalScale);
  }
  expect(labSemantics.panelLinks).toEqual([
    { panelMasterKey: "cm.lab-panel.synthetic-01", testMasterKeys: ["cm.lab-test.synthetic-08", "cm.lab-test.synthetic-09", "cm.lab-test.synthetic-10", "cm.lab-test.synthetic-06", "cm.lab-test.synthetic-07", "cm.lab-test.chem-glucose", "cm.lab-test.chem-creatinine"] },
    { panelMasterKey: "cm.lab-panel.synthetic-02", testMasterKeys: ["cm.lab-test.synthetic-11", "cm.lab-test.synthetic-12"] },
    { panelMasterKey: "cm.lab-panel.synthetic-03", testMasterKeys: ["cm.lab-test.chem-glucose", "cm.lab-test.chem-creatinine", "cm.lab-test.chem-bun", "cm.lab-test.chem-alt", "cm.lab-test.chem-alp", "cm.lab-test.chem-total-protein", "cm.lab-test.synthetic-05", "cm.lab-test.synthetic-06"] },
    { panelMasterKey: "cm.lab-panel.synthetic-04", testMasterKeys: ["cm.lab-test.chem-alt", "cm.lab-test.chem-alp", "cm.lab-test.chem-total-protein", "cm.lab-test.synthetic-03", "cm.lab-test.synthetic-04", "cm.lab-test.synthetic-05", "cm.lab-test.synthetic-06", "cm.lab-test.chem-glucose"] },
    { panelMasterKey: "cm.lab-panel.synthetic-05", testMasterKeys: ["cm.lab-test.chem-bun", "cm.lab-test.chem-creatinine", "cm.lab-test.synthetic-07", "cm.lab-test.synthetic-08", "cm.lab-test.synthetic-09", "cm.lab-test.synthetic-10", "cm.lab-test.synthetic-06", "cm.lab-test.chem-glucose"] },
    { panelMasterKey: "cm.lab-panel.synthetic-06", testMasterKeys: ["cm.lab-test.chem-glucose", "cm.lab-test.chem-total-protein", "cm.lab-test.chem-alt", "cm.lab-test.chem-alp", "cm.lab-test.chem-bun", "cm.lab-test.chem-creatinine", "cm.lab-test.synthetic-03", "cm.lab-test.synthetic-04", "cm.lab-test.synthetic-05", "cm.lab-test.synthetic-06", "cm.lab-test.synthetic-07", "cm.lab-test.synthetic-08", "cm.lab-test.synthetic-09", "cm.lab-test.synthetic-10"] },
  ]);
  const additivePanelMembership = labSemantics.panelLinks.flatMap((panel) => panel.testMasterKeys);
  expect(additivePanelMembership).not.toEqual(expect.arrayContaining([
    "cm.lab-test.synthetic-13", "cm.lab-test.synthetic-14", "cm.lab-test.synthetic-15", "cm.lab-test.synthetic-16", "cm.lab-test.synthetic-23",
    "cm.lab-test.fecal-microscopy", "cm.lab-test.giardia-antigen", "cm.lab-test.ua-sediment", "cm.lab-test.ua-strip",
  ]));
  expect(labSemantics.panelLinks.map((panel) => panel.testMasterKeys.length)).toEqual([7, 2, 8, 8, 8, 14]);
  expect(labSemantics.profiles.find((profile) => profile.orderMasterKey === "cm.order.synthetic.lab-02")?.specimenMasterKey).toBe("cm.specimen.citrate-plasma");
  expect(labSemantics.profiles.find((profile) => profile.orderMasterKey === "cm.order.synthetic.lab-03")?.specimenMasterKey).toBe("cm.specimen.serum");
  expect(labSemantics.profiles).toEqual([
    { orderMasterKey: "cm.order.synthetic.lab-01", labTestMasterKey: null, labPanelMasterKey: "cm.lab-panel.synthetic-01", specimenMasterKey: "cm.specimen.serum" },
    { orderMasterKey: "cm.order.synthetic.lab-02", labTestMasterKey: null, labPanelMasterKey: "cm.lab-panel.synthetic-02", specimenMasterKey: "cm.specimen.citrate-plasma" },
    { orderMasterKey: "cm.order.synthetic.lab-03", labTestMasterKey: null, labPanelMasterKey: "cm.lab-panel.synthetic-03", specimenMasterKey: "cm.specimen.serum" },
    { orderMasterKey: "cm.order.synthetic.lab-04", labTestMasterKey: null, labPanelMasterKey: "cm.lab-panel.synthetic-04", specimenMasterKey: "cm.specimen.serum" },
    { orderMasterKey: "cm.order.synthetic.lab-05", labTestMasterKey: null, labPanelMasterKey: "cm.lab-panel.synthetic-05", specimenMasterKey: "cm.specimen.serum" },
    { orderMasterKey: "cm.order.synthetic.lab-06", labTestMasterKey: null, labPanelMasterKey: "cm.lab-panel.synthetic-06", specimenMasterKey: "cm.specimen.serum" },
    { orderMasterKey: "cm.order.synthetic.lab-07", labTestMasterKey: "cm.lab-test.synthetic-23", labPanelMasterKey: null, specimenMasterKey: "cm.specimen.edta-whole-blood" },
    { orderMasterKey: "cm.order.synthetic.lab-08", labTestMasterKey: "cm.lab-test.synthetic-13", labPanelMasterKey: null, specimenMasterKey: "cm.specimen.edta-whole-blood" },
    { orderMasterKey: "cm.order.synthetic.lab-09", labTestMasterKey: "cm.lab-test.synthetic-14", labPanelMasterKey: null, specimenMasterKey: "cm.specimen.edta-whole-blood" },
    { orderMasterKey: "cm.order.synthetic.lab-10", labTestMasterKey: "cm.lab-test.synthetic-18", labPanelMasterKey: null, specimenMasterKey: "cm.specimen.cytology-slide" },
    { orderMasterKey: "cm.order.synthetic.lab-11", labTestMasterKey: "cm.lab-test.synthetic-19", labPanelMasterKey: null, specimenMasterKey: "cm.specimen.swab" },
    { orderMasterKey: "cm.order.synthetic.lab-12", labTestMasterKey: "cm.lab-test.synthetic-20", labPanelMasterKey: null, specimenMasterKey: "cm.specimen.cytology-slide" },
    { orderMasterKey: "cm.order.synthetic.lab-13", labTestMasterKey: "cm.lab-test.synthetic-21", labPanelMasterKey: null, specimenMasterKey: "cm.specimen.joint-fluid" },
  ]);
  const normalizeSemanticName = (value: string) => value.toLocaleLowerCase("ko-KR").replace(/[^0-9a-z가-힣]/gu, "");
  const newLabTestNames = labTests.filter((row) => row.masterKey.startsWith("cm.lab-test.synthetic-")).map((row) => normalizeSemanticName(String(row.names[0]?.name ?? "")));
  const newLabPanelNames = labPanels.filter((row) => row.masterKey.startsWith("cm.lab-panel.synthetic-")).map((row) => normalizeSemanticName(String(row.names[0]?.name ?? "")));
  expect(new Set(newLabTestNames).size).toBe(23);
  expect(new Set(newLabPanelNames).size).toBe(6);
  expect(newLabPanelNames).not.toContain("혈당검사서비스");
  expect(labSemantics.panelLinks.find((panel) => panel.panelMasterKey === "cm.lab-panel.synthetic-06")?.testMasterKeys).not.toEqual(expect.arrayContaining(["cm.lab-test.synthetic-23", "cm.lab-test.ua-strip", "cm.lab-test.ua-sediment"]));
  expect(authoring.labPanelItems).toHaveLength(60);
  expect(new Set(authoring.labPanelItems.map((row) => `${row.panelMasterKey}|${row.testMasterKey}`)).size).toBe(60);
  const labTestKeys = keySet(labTests);
  const labPanelKeys = keySet(labPanels);
  for (const link of authoring.labPanelItems) {
    expect(labPanelKeys.has(String(link.panelMasterKey))).toBe(true);
    expect(labTestKeys.has(String(link.testMasterKey))).toBe(true);
  }
  expect(authoring.labOrderProfiles).toHaveLength(30);
  const orderKeysWithProfiles = new Set(authoring.labOrderProfiles.map((row) => row.orderMasterKey));
  expect(orderKeysWithProfiles.size).toBe(30);
  for (const profile of authoring.labOrderProfiles) {
    expect(orderKeys.has(String(profile.orderMasterKey))).toBe(true);
    expect(Boolean(profile.labTestMasterKey) !== Boolean(profile.labPanelMasterKey)).toBe(true);
    if (profile.labTestMasterKey) expect(labTestKeys.has(String(profile.labTestMasterKey))).toBe(true);
    if (profile.labPanelMasterKey) expect(labPanelKeys.has(String(profile.labPanelMasterKey))).toBe(true);
  }
});

test("classification routes, diagnosis exclusions, and workspace adoption remain contract-safe", () => {
  expect(authoring.classificationPaths).toHaveLength(13);
  const pathByKey = new Map(authoring.classificationPaths.map((path) => [path.pathKey, path]));
  expect(pathByKey.get("cm.path.inpatient")).toMatchObject({ taskRouteKey: "phase1a2.fallback.route.NT_BILLING_ONLY" });
  expect(pathByKey.get("cm.path.preventive-consultation")).toMatchObject({ chartGroupKey: "cm.chart.prevention" });
  expect(pathByKey.get("cm.path.preventive-treatment")).toMatchObject({ chartGroupKey: "cm.chart.prevention" });
  expect(pathByKey.get("cm.path.surgery-anesthesia")).toMatchObject({ chartGroupKey: "cm.chart.surgery" });
  expect(pathByKey.get("cm.path.inpatient")).toMatchObject({ chartGroupKey: "phase1a2.fallback.chart.CG_INPATIENT" });
  expect(pathByKey.get("cm.path.emergency")).toMatchObject({ chartGroupKey: "phase1a2.fallback.chart.CG_EXAM" });
  expect(pathByKey.get("cm.path.dental")).toMatchObject({ chartGroupKey: "phase1a2.fallback.chart.CG_PROCEDURE" });
  expect(pathByKey.get("cm.path.certificate")).toMatchObject({ chartGroupKey: "phase1a2.fallback.chart.CG_CONSULTATION" });
  expect(pathByKey.get("cm.path.dispensing-billing")).toMatchObject({ chartGroupKey: "phase1a2.fallback.chart.CG_MEDICATION_SUPPLY" });
  const unitCodes = new Set(authoring.records.filter((row) => row.recordType === "unit").map((row) => String(row.detail.unitCode)));
  const specimenCodes = new Set(authoring.records.filter((row) => row.recordType === "specimen_type").map((row) => String(row.detail.specimenCode)));
  expect(unitCodes).toEqual(new Set(["case", "g_dl", "k_per_ul", "mg_dl", "million_per_ul", "percent", "u_l", "mmol_l", "seconds"]));
  expect(specimenCodes).toEqual(new Set(["edta_whole_blood", "feces", "serum", "urine", "cytology_slide", "swab", "joint_fluid", "citrate_plasma"]));
  expect(authoring.classificationPaths.some((path) => path.taskRouteKey === "cm.route.inpatient-held")).toBe(false);
  const routeByKey = new Map(authoring.records.filter((row) => row.recordType === "task_route").map((row) => [row.masterKey, row.detail.routeCode]));
  expect(routeByKey.get("cm.route.inpatient-held")).toBe("NT_INPATIENT");
  expect(routeByKey.get("phase1a2.fallback.route.NT_BILLING_ONLY")).toBe("NT_BILLING_ONLY");
  expect(authoring.records.some((row) => row.masterKey === "cm.chart.inpatient" || row.masterKey === "cm.route.billing-only")).toBe(false);
  expect(authoring.records.some((row) => row.masterKey === "phase1a2.fallback.chart.CG_INPATIENT")).toBe(true);

  const diagnosisCategories = authoring.records.filter((row) => row.recordType === "diagnosis_category");
  const diagnoses = authoring.records.filter((row) => row.recordType === "diagnosis");
  expect(diagnosisCategories).toHaveLength(12);
  expect(diagnoses).toHaveLength(12);
  expect(authoring.diagnosisCategoryLinks).toHaveLength(12);
  const diagnosisKeys = keySet(diagnoses);
  const diagnosisCategoryKeys = keySet(diagnosisCategories);
  for (const link of authoring.diagnosisCategoryLinks) {
    expect(diagnosisKeys.has(String(link.diagnosisMasterKey))).toBe(true);
    expect(diagnosisCategoryKeys.has(String(link.categoryMasterKey))).toBe(true);
  }

  const inpatientRows = pricing.orders.filter((row) => row.researchCategory === "inpatient");
  expect(inpatientRows).toHaveLength(6);
  expect(inpatientRows.every((row) => row.masterRouteCode === "NT_BILLING_ONLY" && row.heldSourceRouteCode === "NT_INPATIENT" && row.workspaceDestinationModule === "billing_only")).toBe(true);
  expect(pricing.adoptionPolicy.heldMasterRouteMapping).toEqual({
    masterRouteCode: "NT_BILLING_ONLY",
    heldSourceRouteCode: "NT_INPATIENT",
    workspaceDestinationModule: "billing_only",
    runtimeStatus: "held",
  });
  expect(pricing.adoptionPolicy.targetWorkspaceIds).toEqual([
    "workspace-clinical-master-pilot-v1",
    "workspace-clair-cheongdam",
    "clair-demo",
  ]);
  expect(pricing.adoptionPolicy.excludedWorkspaceIds).toEqual(["clair-foreign-demo"]);
  expect(pricing.adoptionPolicy.existingCheongdamRows).toHaveLength(13);
  expect(pricing.adoptionPolicy.existingCheongdamRows.every((row) => row.collisionAction === "preserve_no_delete" && row.semanticFingerprintRequired === true)).toBe(true);
  expect(pricing.adoptionPolicy.existingCheongdamRows.every((row) => row.semanticCollisionStatus === "pending_exact_v3_name_fingerprint")).toBe(true);
  expect(pricing.adoptionPolicy.existingCheongdamRows.map((row) => row.observedCatalogRowId)).toEqual([
    "cd-lab-cbc", "cd-imaging-xray2", "cd-dispensing-oral-basic", "cd-treatment-ear-clean", "cd-imaging-us-abdomen", "cd-lab-ua", "cd-hospitalization-day", "cd-consult-revisit", "cd-vaccine-core", "cd-consult-first", "cd-treatment-fluid-sc", "cd-lab-chem10", "master-workspace-clair-cheongdam-phase1.optionb.v1.order.metabolic",
  ]);
  expect(pricing.adoptionPolicy.existingCheongdamRows.map((row) => row.observedMasterKey)).toEqual([
    null, null, null, null, null, null, null, null, null, null, null, null, "phase1.optionb.v1.order.metabolic",
  ]);
  expect(pricing.adoptionPolicy.foreignWorkspacePolicy).toMatchObject({
    workspaceId: "clair-foreign-demo",
    excludedFromAdoption: true,
    negativeControl: true,
    existingRowsUnchanged: true,
    policy: "read_only_pre_post_fingerprint_no_write",
    noWrite: true,
  });
  expect(pricing.adoptionPolicy.foreignWorkspacePolicy).not.toHaveProperty("expectedCatalogRowCount");
  expect(pricing.adoptionPolicy.existingCheongdamRows.map((row) => row.displayName)).toEqual([
    "CBC 혈구검사", "X-ray 2컷", "경구약 조제", "귀 세정", "복부 초음파", "요검사", "입원 1일", "재진 진찰", "종합백신", "초진 진찰", "피하수액", "혈액화학 10종", "합성 기초 혈액검사",
  ]);
});

test("live Airtable readback proves stable identity and the manifest schedules creates only", () => {
  expect(readbackBaselineHash()).toBe(readback.baselineSha256);
  expect(readback.sourceIdentity).toMatchObject({
    airtableRecordId: "recMiLy9KGJECHbvL",
    sourceKey: "source.synthetic.operational-pilot.v1",
    identityPreserved: true,
  });
  expect(readback.tableCounts).toEqual({
    "Release Drafts": 1,
    Sources: 1,
    "Master Records": 107,
    Names: 107,
    "Classification Paths": 5,
    "Lab Panel Items": 13,
    "Lab Order Profiles": 17,
    "Diagnosis Category Links": 12,
  });
  const liveMasterRows = readback.tables["Master Records"].records;
  expect(new Set(liveMasterRows.map((row) => row.airtableRecordId)).size).toBe(107);
  expect(new Set(readback.tables.Names.records.map((row) => row.airtableRecordId)).size).toBe(107);
  const authoringKeys = new Set(authoring.records.map((row) => row.masterKey));
  expect(liveMasterRows.every((row) => authoringKeys.has(String(row.fields.masterKey)) || String(row.fields.masterKey) === legacyInitialMasterKey)).toBe(true);
  const liveNameByRecordId = new Map(readback.tables.Names.records.map((row) => [row.airtableRecordId, row]));
  const liveMasterByKey = new Map(liveMasterRows.map((row) => [String(row.fields.masterKey), row]));
  const currentAuthoringRows = authoring.records.filter((row) => liveMasterByKey.has(row.masterKey) || (row.masterKey === v3InitialMasterKey && liveMasterByKey.has(legacyInitialMasterKey)));
  expect(currentAuthoringRows).toHaveLength(107);
  const addedAuthoringRows = authoring.records.filter((row) => !liveMasterByKey.has(row.masterKey) && row.masterKey !== v3InitialMasterKey);
  expect(addedAuthoringRows).toHaveLength(147);
  expect(addedAuthoringRows.every((row) => row.changeSummary === "synthetic operational master v3 addition" && row.sourceNotes === "synthetic v3 additive operational draft; no external clinical source")).toBe(true);
  for (const row of currentAuthoringRows) {
    const live = liveMasterByKey.get(row.masterKey === v3InitialMasterKey ? legacyInitialMasterKey : row.masterKey)!;
    const fields = live.fields;
    const liveNames = (Array.isArray(fields.names) ? fields.names : []).map((link) => liveNameByRecordId.get(linkId(link) ?? "")).filter((nameRow): nameRow is (typeof readback.tables.Names.records)[number] => Boolean(nameRow)).map((nameRow) => ({
      languageCode: optionName(nameRow.fields.languageCode),
      nameKind: optionName(nameRow.fields.nameKind),
      name: nameRow.fields.name,
      searchable: nameRow.fields.searchable ?? true,
      sortOrder: nameRow.fields.sortOrder ?? 0,
    }));
    expect(omitNulls({
      recordType: optionName(fields.recordType),
      authoringStatus: optionName(fields.authoringStatus),
      lifecycleStatus: optionName(fields.lifecycleStatus),
      safetyStatus: optionName(fields.safetyStatus),
      safetyReason: fields.safetyReason ?? null,
      changeSummary: fields.changeSummary,
      sourceAssertionScope: fields.sourceAssertionScope,
      sourceNotes: fields.sourceNotes,
      detail: JSON.parse(String(fields.detail)),
      sourceKey: Array.isArray(fields.sourceKey) && fields.sourceKey[0] && typeof fields.sourceKey[0] === "object" && "name" in fields.sourceKey[0]
        ? String((fields.sourceKey[0] as { name: unknown }).name)
        : null,
      names: liveNames,
    })).toEqual(omitNulls({
      recordType: row.recordType,
      authoringStatus: row.authoringStatus,
      lifecycleStatus: row.lifecycleStatus,
      safetyStatus: row.safetyStatus,
      safetyReason: row.safetyReason,
      changeSummary: row.changeSummary,
      sourceAssertionScope: row.sourceAssertionScope,
      sourceNotes: row.sourceNotes,
      detail: row.detail,
      sourceKey: row.sourceKey,
      names: row.names,
    }));
  }

  expect(manifest.writeAllowed).toBe(false);
  expect(manifest.mutationsPerformed).toBe(0);
  expect(manifest.schemaVersion).toBe("clinical-master-airtable-additive-write-manifest/v2");
  expect(manifest.sourceOfTruth.baselineSha256).toBe(readback.baselineSha256);
  expect(manifest.sourceOfTruth.airtableWrites).toBe(0);
  expect(manifest.sourceOfTruth.supabaseWrites).toBe(0);
  expect(manifest.semanticDiffAgainstLiveReadback.actionableFieldDifferences).toBe(0);
  expect(manifest.semanticDiffAgainstLiveReadback.normalizedRepresentationDifferences).toBe(11);
  expect(manifest.expectedAirtableTableCounts).toEqual({
    "Release Drafts": 1,
    Sources: 1,
    "Master Records": 254,
    Names: 254,
    "Classification Paths": 13,
    "Lab Panel Items": 60,
    "Lab Order Profiles": 30,
    "Diagnosis Category Links": 12,
  });
  expect(manifest.tables["Release Drafts"]).toMatchObject({ updateExisting: 1, create: 0, preserveRecordId: true });
  expect(manifest.tables.Sources).toMatchObject({ updateExisting: 0, create: 0, preserveRecordId: true });
  expect(manifest.tables["Master Records"]).toMatchObject({ updateExisting: 1, create: 147 });
  expect(manifest.tables.Names).toMatchObject({ updateExisting: 0, create: 147, onePreferredNamePerMasterRow: true });
  expect(manifest.tables["Classification Paths"]).toMatchObject({ updateExisting: 0, create: 8 });
  expect(manifest.tables["Lab Panel Items"]).toMatchObject({ updateExisting: 0, create: 47 });
  expect(manifest.tables["Lab Order Profiles"]).toMatchObject({ updateExisting: 0, create: 13 });
  expect(manifest.tables["Diagnosis Category Links"]).toMatchObject({ updateExisting: 0, create: 0 });
  expect(manifest.casBaselineGate).toMatchObject({
    baselineSha256: readback.baselineSha256,
    expectedTableCounts: readback.tableCounts,
    failClosedOnHashOrCountMismatch: true,
  });
  expect(manifest.dependencyOrder).toEqual([
    "CAS baseline gate",
    "Sources verify by sourceKey",
    "CAS-and-semantic-readback identity fork for the legacy initial Airtable row",
    "Master Records create by masterKey",
    "Names create by masterKey",
    "Classification Paths create by pathKey",
    "Lab Panel Items create by panelMasterKey+testMasterKey",
    "Lab Order Profiles create by orderMasterKey",
    "Diagnosis Category Links verify by diagnosisMasterKey+categoryMasterKey",
    "Release Drafts update existing recordId after all creates and the identity fork verify",
  ]);
  expect(manifest.releaseDraft.airtableRecordId).toBe("rect3dj4tCIGcp06e");
  expect(manifest.releaseDraft.afterFields).toMatchObject({ releaseKey: "cm.release.airtable.operational-master.v3", status: "approved" });
  expect(manifest.tables["Master Records"].createPayloads).toHaveLength(147);
  expect(manifest.tables.Names.createPayloads).toHaveLength(147);
  expect(manifest.tables["Classification Paths"].createPayloads).toHaveLength(8);
  expect(manifest.tables["Lab Panel Items"].createPayloads).toHaveLength(47);
  expect(manifest.tables["Lab Order Profiles"].createPayloads).toHaveLength(13);
  const createPayloads = [
    ...manifest.tables["Master Records"].createPayloads,
    ...manifest.tables.Names.createPayloads,
    ...manifest.tables["Classification Paths"].createPayloads,
    ...manifest.tables["Lab Panel Items"].createPayloads,
    ...manifest.tables["Lab Order Profiles"].createPayloads,
  ];
  expect(createPayloads.every((payload) => payload.stableKey && JSON.stringify(payload).includes("resolveBy"))).toBe(true);
  expect(createPayloads.every((payload) => Object.keys(payload.fieldsByFieldId).length === Object.keys(payload.fields).length && Object.keys(payload.fieldsByFieldId).every((fieldId) => fieldId.startsWith("fld")))).toBe(true);
  const nonWritableFieldIds = new Set(Object.values(readback.tables).flatMap((table) => Object.entries(table.fieldIdsByName)
    .filter(([fieldName]) => fieldName === "rowLabel" || fieldName.includes("display-only"))
    .map(([, fieldId]) => fieldId)));
  expect(nonWritableFieldIds.has("fld8GNoJTzlAYtGnF")).toBe(true);
  expect(nonWritableFieldIds.has("fld1KwiL9b4ipNtyX")).toBe(true);
  expect(createPayloads.every((payload) => Object.keys(payload.fieldsByFieldId).every((fieldId) => !nonWritableFieldIds.has(fieldId)))).toBe(true);
  expect(createPayloads.every((payload) => Object.values(payload.fields).every((value) => value !== null && value !== undefined))).toBe(true);
  expect(manifest.tables["Lab Panel Items"].createPayloads.every((payload) => !Object.prototype.hasOwnProperty.call(payload.fields, "rowLabel") && typeof payload.expectedComputedRowLabel === "string")).toBe(true);
  expect(manifest.tables["Lab Order Profiles"].createPayloads.every((payload) => !Object.prototype.hasOwnProperty.call(payload.fields, "rowLabel") && typeof payload.expectedComputedRowLabel === "string")).toBe(true);
  const linkRefs = createPayloads.flatMap((payload) => scanLinkRefs(payload.fields));
  expect(linkRefs.every((link) => link.resolveBy === "stableKey" && link.resolvedRecordId === null)).toBe(true);
  expect(manifest.releaseDraft.beforeWritableFields).toEqual({
    releaseKey: "cm.release.airtable.operational-pilot.v1",
    status: "approved",
    releaseNotes: "Dog/cat synthetic operational flow pilot; not for clinical use.",
    reviewReason: "구조·시스템 흐름 검증용 합성 파일럿",
    publishedByLabel: "CLAiR synthetic pilot publisher",
    authoredByLabel: "CLAiR synthetic pilot author",
    reviewedByLabel: "CLAiR synthetic pilot reviewer",
  });
  expect(manifest.releaseDraft.rollbackRestore).toMatchObject({
    operation: "restore_existing_by_record_id_before_created_id_rollback",
    airtableRecordId: "rect3dj4tCIGcp06e",
    fields: manifest.releaseDraft.beforeWritableFields,
  });
  expect(manifest.rollbackOrder).toEqual([
    "Restore Release Drafts by current recordId using releaseDraft.rollbackRestore.fields",
    "Restore the audited legacy initial Master Records identity fork by recordId",
    "Rollback created Lab Order Profiles by createdRecordId",
    "Rollback created Lab Panel Items by createdRecordId",
    "Rollback created Classification Paths by createdRecordId",
    "Rollback created Names by createdRecordId",
    "Rollback created Master Records by createdRecordId",
  ]);
  expect(manifest.rollbackJournalTemplate.mode).toBe("created_id_only");
  expect(manifest.rollbackJournalTemplate.entries).toHaveLength(362);
  expect(manifest.rollbackJournalTemplate.entries.every((entry) => entry.createdRecordId === null)).toBe(true);
});

test("final Airtable readback produces a separate identity-fork-only delta", () => {
  expect(readbackBaselineHashFor(finalReadback)).toBe(finalReadback.baselineSha256);
  expect(finalReadback.mutationScope).toBe("read-only-final-verified");
  expect(finalReadback.tableCounts).toEqual({
    "Release Drafts": 1,
    Sources: 1,
    "Master Records": 254,
    Names: 254,
    "Classification Paths": 13,
    "Lab Panel Items": 60,
    "Lab Order Profiles": 30,
    "Diagnosis Category Links": 12,
  });
  const finalMasterRows = finalReadback.tables["Master Records"].records;
  expect(new Set(finalMasterRows.map((row) => row.airtableRecordId)).size).toBe(254);
  const legacyRow = finalMasterRows.find((row) => row.airtableRecordId === "recZW92s9i06wpNp0");
  expect(legacyRow?.fields.masterKey).toBe("cm.order.consult.initial");
  expect(finalMasterRows.some((row) => row.fields.masterKey === "cm.order.consult.first-visit")).toBe(false);
  const linkedName = finalReadback.tables.Names.records.find((row) => {
    const links = row.fields.masterKey;
    return Array.isArray(links) && links.some((link) => linkId(link) === "recZW92s9i06wpNp0");
  });
  expect(linkedName?.airtableRecordId).toBe("rec0Pw4CymPIed8ta");
  expect(linkedName?.fields.masterKey).toEqual([{ id: "recZW92s9i06wpNp0", name: "cm.order.consult.initial" }]);

  expect(deltaManifest.schemaVersion).toBe("clinical-master-airtable-final-delta-manifest/v1");
  expect(deltaManifest.operationMode).toBe("final_state_delta_identity_fork_only");
  expect(deltaManifest.writeAllowed).toBe(false);
  expect(deltaManifest.mutationsPerformed).toBe(0);
  expect(deltaManifest.executable).toBe(false);
  expect(deltaManifest.executionEligibility).toMatchObject({ eligible: false, status: "deferred_until_exact_before_after_gates" });
  expect(deltaManifest.sourceOfTruth).toMatchObject({
    liveReadbackFixture: "tests/fixtures/clinical-master-airtable-operational-v3-final-readback.json",
    baselineSha256: finalReadback.baselineSha256,
    expectedTableCounts: finalReadback.tableCounts,
  });
  const deltaMaster = deltaManifest.tables["Master Records"];
  expect(deltaMaster).toMatchObject({ updateExisting: 1, create: 0 });
  expect(deltaMaster.updatePayloads).toEqual([expect.objectContaining({
    recordId: "recZW92s9i06wpNp0",
    currentMasterKey: "cm.order.consult.initial",
    newMasterKey: "cm.order.consult.first-visit",
    preserveLinkedNameRecordId: "rec0Pw4CymPIed8ta",
  })]);
  const expectedBeforeSha256 = Object.fromEntries(Object.keys(finalReadback.tables).map((tableName) => [tableName, readbackTableHashFor(finalReadback, tableName)]));
  const expectedPostReadback = JSON.parse(JSON.stringify(finalReadback)) as ReadbackFixture;
  const expectedPostMaster = expectedPostReadback.tables["Master Records"].records.find((row) => row.airtableRecordId === "recZW92s9i06wpNp0");
  const expectedPostName = expectedPostReadback.tables.Names.records.find((row) => row.airtableRecordId === "rec0Pw4CymPIed8ta");
  expect(expectedPostMaster).toBeTruthy();
  expect(expectedPostName).toBeTruthy();
  expectedPostMaster!.fields.masterKey = "cm.order.consult.first-visit";
  expectedPostName!.fields.masterKey = [{ id: "recZW92s9i06wpNp0", name: "cm.order.consult.first-visit" }];
  const expectedPostSha256 = Object.fromEntries(Object.keys(expectedPostReadback.tables).map((tableName) => [tableName, readbackTableHashFor(expectedPostReadback, tableName)]));
  expect(deltaManifest.expectedBeforeSha256).toEqual(expectedBeforeSha256);
  expect(deltaManifest.expectedPostSha256).toEqual(expectedPostSha256);
  expect(deltaManifest.expectedPostFullReadbackSha256).toBe(readbackBaselineHashFor(expectedPostReadback));
  expect(deltaManifest.rollbackGate).toMatchObject({ expectedRestoredFullReadbackSha256: finalReadback.baselineSha256, expectedRestoredTableSha256: expectedBeforeSha256 });
  expect(deltaMaster.updatePayloads[0]?.linkedNameLookup).toMatchObject({
    recordId: "rec0Pw4CymPIed8ta",
    before: [{ id: "recZW92s9i06wpNp0", name: "cm.order.consult.initial" }],
    after: [{ id: "recZW92s9i06wpNp0", name: "cm.order.consult.first-visit" }],
    operation: expect.stringContaining("no separate Names write"),
  });
  for (const [tableName, table] of Object.entries(deltaManifest.tables)) {
    if (tableName === "Master Records") continue;
    expect(table.updateExisting, `${tableName} update count`).toBe(0);
    expect(table.create, `${tableName} create count`).toBe(0);
    expect(table.createPayloads, `${tableName} create payloads`).toEqual([]);
    expect(table.updatePayloads, `${tableName} update payloads`).toEqual([]);
  }
  expect(deltaManifest.historicalEvidence).toMatchObject({
    additiveManifest: "tests/fixtures/clinical-master-operational-v3-airtable-write-manifest.json",
  });
  expect(deltaManifest.safetyChecks).toMatchObject({ noUnknownGeneratedRecordIds: true, noSourcePrimaryKeyRemap: true, noAirtableWritesPerformed: true });
});
