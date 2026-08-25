import { expect, test } from "@playwright/test";

import { adaptClinicalMasterAirtableAuthoringExport } from "../src/features/clinical-master/server-clinical-master-airtable-publish-adapter";
import { validateClinicalMasterPublishPayload } from "../src/features/clinical-master/server-clinical-master-publisher-core";
import adapterJson from "./fixtures/clinical-master-operational-v4-adapter-output.json";
import airtableManifestJson from "./fixtures/clinical-master-operational-v4-airtable-write-manifest.json";
import authoringJson from "./fixtures/clinical-master-operational-v4-authoring.json";
import labSemanticsJson from "./fixtures/clinical-master-operational-v4-lab-semantics.json";
import orderSetManifestJson from "./fixtures/clinical-master-operational-v4-order-set-manifest.json";
import packageManifestJson from "./fixtures/clinical-master-operational-v4-package-manifest.json";
import pricingJson from "./fixtures/clinical-master-operational-v4-pricing-adoption.json";
import v3AuthoringJson from "./fixtures/clinical-master-operational-v3-authoring.json";
import v3PricingJson from "./fixtures/clinical-master-operational-v3-pricing-adoption.json";

type JsonObject = Record<string, unknown>;
type MasterRecord = JsonObject & {
  masterKey: string;
  recordType: string;
  names: Array<{ name: string }>;
  detail: JsonObject;
};
type AuthoringFixture = JsonObject & {
  release: JsonObject;
  records: MasterRecord[];
  classificationPaths: JsonObject[];
  labPanelItems: JsonObject[];
  labOrderProfiles: JsonObject[];
  diagnosisCategoryLinks: JsonObject[];
};
type AdapterFixture = {
  payload: JsonObject & { records: MasterRecord[] };
  excluded: JsonObject;
};
type PricingFixture = JsonObject & {
  categoryCounts: Record<string, number>;
  orders: Array<JsonObject & { masterKey: string; researchCategory: string; syntheticWorkspacePriceKrw: number }>;
  adoptionPolicy: JsonObject;
};
type ManifestTable = JsonObject & {
  create: number;
  updateExisting: number;
  createPayloads: Array<JsonObject & { stableKey: string; fields: JsonObject; fieldsByFieldId: JsonObject }>;
};
type AirtableManifest = JsonObject & {
  writeAllowed: boolean;
  mutationsPerformed: number;
  casGate: JsonObject;
  tables: Record<string, ManifestTable>;
  rollbackJournalTemplate: { mode: string; entries: Array<JsonObject & { createdRecordId: string | null }> };
};
type OrderSetTemplate = JsonObject & {
  templateKey: string;
  dependencyTemplateKeys: string[];
  availabilityStatus: string;
  definitionTemplate: JsonObject & { amountBasis: string; items: JsonObject[]; priceRanges: JsonObject[] };
};
type OrderSetOperation = JsonObject & {
  operationId: string;
  sequence: number;
  workspaceId: string;
  headers: Record<string, string>;
  bodyTemplate: { availabilityStatus: string; definition: JsonObject };
  dependencyOperationIds: string[];
};
type OrderSetManifest = JsonObject & {
  writeAllowed: boolean;
  mutationsPerformed: number;
  targetWorkspaceIds: string[];
  excludedWorkspacePolicy: JsonObject;
  templates: OrderSetTemplate[];
  operations: OrderSetOperation[];
};

const authoring = authoringJson as unknown as AuthoringFixture;
const v3Authoring = v3AuthoringJson as unknown as AuthoringFixture;
const adapter = adapterJson as unknown as AdapterFixture;
const pricing = pricingJson as unknown as PricingFixture;
const v3Pricing = v3PricingJson as unknown as PricingFixture;
const airtable = airtableManifestJson as unknown as AirtableManifest;
const orderSets = orderSetManifestJson as unknown as OrderSetManifest;
const labSemantics = labSemanticsJson as unknown as JsonObject;
const packageManifest = packageManifestJson as unknown as JsonObject;

const expectedCategoryCounts = {
  consultation: 28,
  preventive: 26,
  lab: 85,
  imaging: 30,
  treatment: 45,
  dispensing: 53,
  "surgery/anesthesia": 42,
  inpatient: 30,
  emergency: 24,
  dental: 24,
  "certificate/misc": 13,
};

function canonical(value: unknown) {
  return JSON.stringify(value);
}

function countBy(values: string[]) {
  return values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function scanKeys(value: unknown, keys: string[] = []) {
  if (Array.isArray(value)) value.forEach((item) => scanKeys(item, keys));
  else if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, child]) => {
      keys.push(key);
      scanKeys(child, keys);
    });
  }
  return keys;
}

function scanObjects(value: unknown, objects: JsonObject[] = []) {
  if (Array.isArray(value)) value.forEach((item) => scanObjects(item, objects));
  else if (value && typeof value === "object") {
    const object = value as JsonObject;
    objects.push(object);
    Object.values(object).forEach((child) => scanObjects(child, objects));
  }
  return objects;
}

test("V4 preserves V3 and reaches the exact 400-order publisher boundary", () => {
  expect(authoring.release.releaseKey).toBe("cm.release.airtable.operational-master.v4");
  expect(authoring.records).toHaveLength(578);
  expect(authoring.records.every((row) => row.names.length === 1)).toBe(true);
  expect(new Set(authoring.records.map((row) => row.masterKey)).size).toBe(578);
  expect(authoring.records.filter((row) => row.recordType === "order")).toHaveLength(400);
  expect(authoring.records.filter((row) => row.recordType === "lab_test")).toHaveLength(72);
  expect(authoring.records.filter((row) => row.recordType === "lab_panel")).toHaveLength(18);
  expect(authoring.classificationPaths).toHaveLength(13);
  expect(authoring.labPanelItems).toHaveLength(120);
  expect(authoring.labOrderProfiles).toHaveLength(85);
  expect(authoring.diagnosisCategoryLinks).toHaveLength(12);

  const v4ByKey = new Map(authoring.records.map((row) => [row.masterKey, row]));
  for (const prior of v3Authoring.records) expect(canonical(v4ByKey.get(prior.masterKey))).toBe(canonical(prior));
  expect(authoring.classificationPaths).toEqual(v3Authoring.classificationPaths);
  expect(authoring.diagnosisCategoryLinks).toEqual(v3Authoring.diagnosisCategoryLinks);

  const adapted = adaptClinicalMasterAirtableAuthoringExport(authoring as never);
  expect(adapted.payload).toEqual(adapter.payload);
  expect(adapted.excluded).toEqual(adapter.excluded);
  expect(adapter.payload.records).toHaveLength(554);
  expect(adapter.excluded.recordCount).toBe(24);
  expect(validateClinicalMasterPublishPayload(adapter.payload as never)).toEqual([]);
  expect(scanKeys(adapter.payload).filter((key) => /(?:price|pricing|weight|orderset|order_set)/iu.test(key))).toEqual([]);
});

test("order names, category totals, and workspace-only synthetic prices are deterministic", () => {
  const orderRecords = authoring.records.filter((row) => row.recordType === "order");
  const normalizedNames = orderRecords.map((row) => row.names[0]?.name.toLocaleLowerCase("ko-KR").replace(/[^0-9a-z가-힣]/gu, ""));
  expect(new Set(normalizedNames).size).toBe(400);
  expect(normalizedNames.every(Boolean)).toBe(true);
  expect(orderRecords.filter((row) => /(?:용량|mg\/kg|1일 \d회|마약|펜타닐|모르핀)/iu.test(row.names[0]?.name ?? ""))).toEqual([]);

  expect(pricing.categoryCounts).toEqual(expectedCategoryCounts);
  expect(pricing.orders).toHaveLength(400);
  expect(countBy(pricing.orders.map((row) => row.researchCategory))).toEqual(expectedCategoryCounts);
  expect(new Set(pricing.orders.map((row) => row.masterKey)).size).toBe(400);
  expect(new Set(pricing.orders.map((row) => row.syntheticWorkspacePriceKrw)).size).toBe(400);
  expect(pricing.orders.every((row) => Number.isInteger(row.syntheticWorkspacePriceKrw) && row.syntheticWorkspacePriceKrw > 0)).toBe(true);
  const v4PriceByKey = new Map(pricing.orders.map((row) => [row.masterKey, row.syntheticWorkspacePriceKrw]));
  expect(v3Pricing.orders.every((row) => v4PriceByKey.get(row.masterKey) === row.syntheticWorkspacePriceKrw)).toBe(true);
  expect(pricing.orders.filter((row) => row.masterKey.startsWith("cm.order.v4.")).every((row) => row.syntheticWorkspacePriceKrw % 100 === 0)).toBe(true);
  expect((pricing.adoptionPolicy.targetWorkspaceIds as string[])).toEqual([
    "workspace-clinical-master-pilot-v1", "workspace-clair-cheongdam", "clair-demo",
  ]);
  expect((pricing.adoptionPolicy.excludedWorkspaceIds as string[])).toEqual(["clair-foreign-demo"]);
  expect((pricing.adoptionPolicy.foreignWorkspacePolicy as JsonObject)).toMatchObject({
    workspaceId: "clair-foreign-demo",
    noWrite: true,
    policy: "read_only_pre_post_fingerprint_no_write",
  });
});

test("the 72/18/120/85 laboratory graph is fully resolvable and non-authoritative", () => {
  const byKey = new Map(authoring.records.map((row) => [row.masterKey, row]));
  for (const link of authoring.labPanelItems) {
    expect(byKey.get(String(link.panelMasterKey))?.recordType).toBe("lab_panel");
    expect(byKey.get(String(link.testMasterKey))?.recordType).toBe("lab_test");
  }
  for (const profile of authoring.labOrderProfiles) {
    expect(byKey.get(String(profile.orderMasterKey))?.recordType).toBe("order");
    expect(Boolean(profile.labTestMasterKey)).not.toBe(Boolean(profile.labPanelMasterKey));
    if (profile.labTestMasterKey) expect(byKey.get(String(profile.labTestMasterKey))?.recordType).toBe("lab_test");
    if (profile.labPanelMasterKey) expect(byKey.get(String(profile.labPanelMasterKey))?.recordType).toBe("lab_panel");
    expect(byKey.get(String(profile.specimenMasterKey))?.recordType).toBe("specimen_type");
  }
  expect((labSemantics.addedTests as unknown[])).toHaveLength(36);
  expect((labSemantics.addedPanels as unknown[])).toHaveLength(8);
  expect((labSemantics.addedPanelLinks as unknown[])).toHaveLength(60);
  expect((labSemantics.addedOrderProfiles as unknown[])).toHaveLength(55);
  expect(labSemantics).toMatchObject({ syntheticOnly: true, clinicalAuthority: false });
  expect(scanKeys(labSemantics).filter((key) => /referenceRange|dose|dosage|frequency/iu.test(key))).toEqual([]);
});

test("the Airtable delta is exact, additive, write-disabled, and rollback-addressable", () => {
  expect(airtable).toMatchObject({ writeAllowed: false, mutationsPerformed: 0 });
  expect(airtable.casGate).toMatchObject({
    requiredBaselineSha256: "34554f2c7f7d6cb2720e298a5baed778b493b988eba945855071bdf22f55eb12",
    failureMode: "abort_before_first_write",
  });
  expect(airtable.tables["Master Records"]).toMatchObject({ expectedBefore: 254, expectedAfter: 578, create: 324, updateExisting: 0 });
  expect(airtable.tables.Names).toMatchObject({ expectedBefore: 254, expectedAfter: 578, create: 324, updateExisting: 0 });
  expect(airtable.tables["Classification Paths"]).toMatchObject({ expectedBefore: 13, expectedAfter: 13, create: 0 });
  expect(airtable.tables["Lab Panel Items"]).toMatchObject({ expectedBefore: 60, expectedAfter: 120, create: 60 });
  expect(airtable.tables["Lab Order Profiles"]).toMatchObject({ expectedBefore: 30, expectedAfter: 85, create: 55 });
  expect(airtable.tables["Diagnosis Category Links"]).toMatchObject({ expectedBefore: 12, expectedAfter: 12, create: 0 });

  const writablePayloads = ["Master Records", "Names", "Lab Panel Items", "Lab Order Profiles"]
    .flatMap((tableName) => airtable.tables[tableName]?.createPayloads ?? []);
  expect(writablePayloads).toHaveLength(763);
  expect(writablePayloads.every((payload) => Object.values(payload.fieldsByFieldId).every((value) => value !== null && value !== undefined))).toBe(true);
  expect(writablePayloads.some((payload) => "fld8GNoJTzlAYtGnF" in payload.fieldsByFieldId || "fld1KwiL9b4ipNtyX" in payload.fieldsByFieldId)).toBe(false);
  expect(scanObjects(writablePayloads).filter((object) => object.resolveBy === "stableKey").every((object) => object.resolvedRecordId === null)).toBe(true);
  expect(airtable.rollbackJournalTemplate.mode).toBe("created_record_id_only");
  expect(airtable.rollbackJournalTemplate.entries).toHaveLength(763);
  expect(airtable.rollbackJournalTemplate.entries.every((entry) => entry.createdRecordId === null)).toBe(true);
});

test("twenty Order Sets materialize to sixty guarded workspace operations", () => {
  expect(orderSets).toMatchObject({ writeAllowed: false, mutationsPerformed: 0 });
  expect(orderSets.targetWorkspaceIds).toEqual([
    "workspace-clinical-master-pilot-v1", "workspace-clair-cheongdam", "clair-demo",
  ]);
  expect(orderSets.excludedWorkspacePolicy).toMatchObject({ workspaceId: "clair-foreign-demo", noWrite: true, operationCount: 0 });
  expect(orderSets.templates).toHaveLength(20);
  expect(orderSets.operations).toHaveLength(60);
  expect(new Set(orderSets.templates.map((template) => template.templateKey)).size).toBe(20);
  expect(new Set(orderSets.operations.map((operation) => operation.operationId)).size).toBe(60);
  expect(countBy(orderSets.templates.map((template) => template.definitionTemplate.amountBasis))).toEqual({
    set_fixed_price: 4,
    included_order_sum: 14,
    range_price: 2,
  });

  const nested = orderSets.templates.filter((template) => template.dependencyTemplateKeys.length > 0);
  expect(nested.map((template) => template.templateKey)).toEqual(["dog-neuter", "cat-neuter", "intensive-inpatient-monitoring"]);
  expect(nested.map((template) => template.dependencyTemplateKeys[0])).toEqual(["preanesthetic-evaluation", "preanesthetic-evaluation", "inpatient-basic-monitoring"]);
  for (const template of orderSets.templates) {
    expect(template.availabilityStatus).toBe("active");
    expect(template.definitionTemplate.items.length).toBeGreaterThan(0);
    if (template.definitionTemplate.amountBasis !== "included_order_sum") {
      expect(template.definitionTemplate.items.every((item) => item.billingReflectionDefault === false)).toBe(true);
    }
    if (template.definitionTemplate.amountBasis === "range_price") expect(template.definitionTemplate.priceRanges).toHaveLength(3);
  }

  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
  for (const operation of orderSets.operations) {
    expect(operation.workspaceId).not.toBe("clair-foreign-demo");
    expect(operation.headers["If-None-Match"]).toBe("*");
    expect(operation.headers["Idempotency-Key"]).toMatch(uuid);
    expect(operation.bodyTemplate.availabilityStatus).toBe("active");
    for (const dependencyId of operation.dependencyOperationIds) {
      const dependency = orderSets.operations.find((candidate) => candidate.operationId === dependencyId);
      expect(dependency?.workspaceId).toBe(operation.workspaceId);
      expect(dependency?.sequence).toBeLessThan(operation.sequence);
    }
  }
  const unresolved = scanObjects(orderSets.operations).filter((object) => typeof object.resolveBy === "string");
  expect(unresolved.length).toBeGreaterThan(0);
  expect(unresolved.every((object) => object.resolvedValue === null)).toBe(true);
  expect(packageManifest).toMatchObject({ status: "local_review_candidate", remoteWritesPerformed: 0 });
});
