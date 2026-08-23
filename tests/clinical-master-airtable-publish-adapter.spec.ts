import { test, expect } from "@playwright/test";
import fixtureJson from "./fixtures/clinical-master-airtable-authoring-export.fixture.json";
import {
  adaptClinicalMasterAirtableAuthoringExport,
  adaptNormalizedClinicalMasterAirtableAuthoringExport,
  ClinicalMasterAirtablePublishAdapterError,
} from "../src/features/clinical-master/server-clinical-master-airtable-publish-adapter";
import { normalizeClinicalMasterAirtableAuthoringExport } from "../src/features/clinical-master/server-clinical-master-airtable-export-core";
import type { ClinicalMasterAirtableAuthoringExportInput } from "../src/features/clinical-master/server-clinical-master-airtable-export-core";
import { validateClinicalMasterPublishPayload } from "../src/features/clinical-master/server-clinical-master-publisher-core";

type JsonRecord = {
  masterKey: string;
  recordType: string;
  detail: Record<string, unknown>;
  [key: string]: unknown;
};
type JsonDetail = Record<string, unknown>;
type AuthoringFixture = ClinicalMasterAirtableAuthoringExportInput & {
  records: JsonRecord[];
  classificationPaths: JsonRecord[];
  labPanelItems: JsonRecord[];
  labOrderProfiles: JsonRecord[];
  diagnosisCategoryLinks: JsonRecord[];
};

const SOURCE_KEY = "source.synthetic.contract.v1";

function cloneFixture(): AuthoringFixture {
  return JSON.parse(JSON.stringify(fixtureJson)) as AuthoringFixture;
}

function names(ko: string, en: string) {
  return [
    { languageCode: "ko", nameKind: "preferred", name: ko, sortOrder: 0 },
    { languageCode: "en", nameKind: "preferred", name: en, sortOrder: 0 },
  ];
}

function addRecord(
  fixture: AuthoringFixture,
  masterKey: string,
  recordType: string,
  ko: string,
  en: string,
  detail: JsonDetail,
) {
  fixture.records.push({
    masterKey,
    recordType,
    authoringStatus: "approved",
    lifecycleStatus: "published",
    safetyStatus: "normal",
    safetyReason: "synthetic",
    changeSummary: "synthetic pilot pack row",
    sourceAssertionScope: "operational flow validation only",
    sourceNotes: "synthetic; not a clinical standard",
    sourceKey: SOURCE_KEY,
    names: names(ko, en),
    detail,
  });
}

function makePilotFixture() {
  const fixture = cloneFixture();

  // 7 additional categories: three X roots and four T children.
  [
    ["cm.order-category.x-imaging", "X", "X-IMAGING", null],
    ["cm.order-category.x-treatment", "X", "X-TREATMENT", null],
    ["cm.order-category.x-dispensing", "X", "X-DISPENSING", null],
    ["cm.order-category.t-imaging", "T", "T-IMAGING", "cm.order-category.x-imaging"],
    ["cm.order-category.t-treatment", "T", "T-TREATMENT", "cm.order-category.x-treatment"],
    ["cm.order-category.t-dispensing", "T", "T-DISPENSING", "cm.order-category.x-dispensing"],
    ["cm.order-category.t-consultation", "T", "T-CONSULTATION", "cm.order-category.x-treatment"],
  ].forEach(([key, level, code, parent], index) =>
    addRecord(fixture, String(key), "order_category", `분류 ${index + 1}`, `Category ${index + 1}`, {
      categoryCode: String(code),
      categoryLevel: String(level),
      parentMasterKey: parent === null ? null : String(parent),
      sortOrder: index + 1,
    }),
  );

  const actions = [
    ["cm.action.imaging", "영상검사", "Imaging", "cm.order-category.t-imaging", "imaging"],
    ["cm.action.dispensing", "조제", "Dispensing", "cm.order-category.t-dispensing", "medication"],
    ["cm.action.treatment", "처치", "Treatment", "cm.order-category.t-treatment", "treatment"],
    ["cm.action.consultation", "상담", "Consultation", "cm.order-category.t-consultation", "consultation"],
    ["cm.action.followup", "추적관리", "Follow-up", "cm.order-category.t-lab", "misc"],
  ] as const;
  actions.forEach(([key, ko, en, category, itemType]) =>
    addRecord(fixture, key, "clinical_action", ko, en, { tCategoryKey: category, itemType, isOtherUnclassified: false }),
  );

  const chartGroups = [
    ["cm.chart.imaging", "영상", "Imaging"],
    ["cm.chart.dispensing", "조제", "Dispensing"],
    ["cm.chart.treatment", "처치", "Treatment"],
    ["cm.chart.consultation", "상담", "Consultation"],
  ] as const;
  chartGroups.forEach(([key, ko, en], index) =>
    addRecord(fixture, key, "chart_group", ko, en, { groupCode: `CG_${String(en).toUpperCase()}`, sortOrder: index + 2 }),
  );

  const routes = [
    ["cm.route.imaging", "영상실", "Imaging", "NT_IMAGING"],
    ["cm.route.dispensing", "조제실", "Dispensing", "NT_DISPENSING"],
    ["cm.route.treatment", "처치실", "Treatment", "NT_TREATMENT"],
    ["cm.route.billing", "수납", "Billing", "NT_BILLING_ONLY"],
  ] as const;
  routes.forEach(([key, ko, en, routeCode]) => addRecord(fixture, key, "task_route", ko, en, { routeCode }));

  const paths = [
    { pathKey: "cm.path.imaging", clinicalActionKey: "cm.action.imaging", chartGroupKey: "cm.chart.imaging", taskRouteKey: "cm.route.imaging" },
    { pathKey: "cm.path.dispensing", clinicalActionKey: "cm.action.dispensing", chartGroupKey: "cm.chart.dispensing", taskRouteKey: "cm.route.dispensing" },
    { pathKey: "cm.path.treatment", clinicalActionKey: "cm.action.treatment", chartGroupKey: "cm.chart.treatment", taskRouteKey: "cm.route.treatment" },
    { pathKey: "cm.path.consultation", clinicalActionKey: "cm.action.consultation", chartGroupKey: "cm.chart.consultation", taskRouteKey: "cm.route.billing" },
  ];
  fixture.classificationPaths.push(...paths);

  [
    ["cm.unit.each", "EA", "ea", "개수", "Each"],
    ["cm.unit.mg", "mg", "mg", "밀리그램", "Milligram"],
    ["cm.unit.hour", "h", "h", "시간", "Hour"],
    ["cm.unit.dose", "dose", "dose", "회", "Dose"],
  ].forEach(([key, code, symbol, ko, en], index) =>
    addRecord(fixture, key, "unit", ko, en, { unitCode: code, symbol, decimalScale: index === 1 ? 1 : 0 }),
  );
  [
    ["cm.specimen.plasma", "혈장", "Plasma", "plasma"],
    ["cm.specimen.urine", "뇨", "Urine", "urine"],
  ].forEach(([key, ko, en, specimenCode]) => addRecord(fixture, key, "specimen_type", ko, en, { specimenCode }));
  [
    ["cm.input.text", "문자", "Text", "text", "text", false],
    ["cm.input.coded", "코드", "Coded", "coded", "coded", false],
  ].forEach(([key, ko, en, inputCode, valueKind, supportsUnit]) => addRecord(fixture, String(key), "result_input_type", String(ko), String(en), { inputCode: String(inputCode), valueKind: String(valueKind), supportsUnit: supportsUnit === true }));

  for (let index = 1; index <= 10; index += 1) {
    addRecord(fixture, `cm.test.pilot-${String(index).padStart(2, "0")}`, "lab_test", `검사 ${index}`, `Pilot Test ${index}`, {
      testCode: `PILOT_${String(index).padStart(2, "0")}`,
      resultInputTypeKey: "cm.input.numeric",
      canonicalUnitKey: "cm.unit.ml",
      decimalScale: 1,
    });
  }
  for (let index = 1; index <= 3; index += 1) {
    addRecord(fixture, `cm.panel.pilot-${index}`, "lab_panel", `패널 ${index}`, `Pilot Panel ${index}`, { panelCode: `PILOT_PANEL_${index}` });
  }

  const panelKeys = ["cm.panel.metabolic", "cm.panel.pilot-1", "cm.panel.pilot-2", "cm.panel.pilot-3"];
  const testKeys = ["cm.test.glucose", ...Array.from({ length: 10 }, (_, index) => `cm.test.pilot-${String(index + 1).padStart(2, "0")}`)];
  for (let panelIndex = 0; panelIndex < panelKeys.length; panelIndex += 1) {
    const count = panelIndex === 0 ? 4 : 3;
    for (let sortOrder = panelIndex === 0 ? 1 : 0; sortOrder < (panelIndex === 0 ? count : count); sortOrder += 1) {
      const testIndex = panelIndex * 3 + (sortOrder === 0 && panelIndex === 0 ? 0 : sortOrder);
      fixture.labPanelItems.push({
        panelMasterKey: panelKeys[panelIndex],
        testMasterKey: testKeys[testIndex % testKeys.length],
        sortOrder,
        required: true,
        displayGroup: `group-${panelIndex + 1}`,
      });
    }
  }

  // 29 additional orders: 16 laboratory profiles and 13 non-laboratory orders.
  for (let index = 1; index <= 16; index += 1) {
    const masterKey = `cm.order.lab-${String(index).padStart(2, "0")}`;
    addRecord(fixture, masterKey, "order", `검사 오더 ${index}`, `Lab Order ${index}`, {
      classificationPathKey: "cm.path.metabolic",
      defaultSalesUnitCode: "mL",
      defaultBillingReflectionEnabled: true,
      defaultQuantity: 1,
      species: ["dog", "cat"],
    });
    const usePanel = index % 3 === 0;
    fixture.labOrderProfiles.push({
      orderMasterKey: masterKey,
      labTestMasterKey: usePanel ? null : testKeys[index % testKeys.length],
      labPanelMasterKey: usePanel ? panelKeys[index % panelKeys.length] : null,
      specimenMasterKey: index % 2 === 0 ? "cm.specimen.plasma" : "cm.specimen.serum",
    });
  }
  const nonLabPaths = ["cm.path.imaging", "cm.path.dispensing", "cm.path.treatment", "cm.path.consultation"];
  for (let index = 1; index <= 13; index += 1) {
    addRecord(fixture, `cm.order.operational-${String(index).padStart(2, "0")}`, "order", `운영 오더 ${index}`, `Operational Order ${index}`, {
      classificationPathKey: nonLabPaths[(index - 1) % nonLabPaths.length],
      defaultSalesUnitCode: index % 2 === 0 ? "EA" : "dose",
      defaultBillingReflectionEnabled: true,
      defaultQuantity: 1,
      species: index % 3 === 0 ? ["cat"] : ["dog", "cat"],
    });
  }

  // 24 authoring-only diagnosis records: 12 categories and 12 identities.
  addRecord(fixture, "cm.diagnosis-category.system-2", "diagnosis_category", "생활습관계", "Lifestyle", { categoryKind: "system", parentMasterKey: null, sortOrder: 1 });
  for (let index = 2; index <= 10; index += 1) {
    addRecord(fixture, `cm.diagnosis-category.group-${index}`, "diagnosis_category", `질환군 ${index}`, `Disease Group ${index}`, {
      categoryKind: "disease_group",
      parentMasterKey: index === 2 ? "cm.diagnosis-category.system" : "cm.diagnosis-category.system-2",
      sortOrder: index,
    });
  }
  for (let index = 1; index <= 11; index += 1) {
    const diagnosisKey = `cm.diagnosis.pilot-${String(index).padStart(2, "0")}`;
    addRecord(fixture, diagnosisKey, "diagnosis", `파일럿 진단 ${index}`, `Pilot Diagnosis ${index}`, {});
    fixture.diagnosisCategoryLinks.push({
      diagnosisMasterKey: diagnosisKey,
      categoryMasterKey: `cm.diagnosis-category.group-${(index % 9) + 2}`,
      isPrimary: true,
      sortOrder: 0,
    });
  }

  return fixture;
}

function issueCodes(error: unknown) {
  return error instanceof ClinicalMasterAirtablePublishAdapterError ? error.issues.map((issue) => issue.code) : [];
}

test("adapts the reviewed pilot snapshot and reports exact diagnosis exclusions", () => {
  const result = adaptClinicalMasterAirtableAuthoringExport(makePilotFixture());
  const typeCounts = result.payload.records.reduce<Record<string, number>>((counts, record) => {
    counts[record.recordType] = (counts[record.recordType] ?? 0) + 1;
    return counts;
  }, {});

  expect(result.payload.records).toHaveLength(83);
  expect(typeCounts.order).toBe(30);
  expect(result.payload.classificationPaths).toHaveLength(5);
  expect(result.payload.labPanelItems).toHaveLength(13);
  expect(result.payload.labOrderProfiles).toHaveLength(17);
  expect(result.payload.records.some((record) => (record.recordType as string) === "diagnosis" || (record.recordType as string) === "diagnosis_category")).toBe(false);
  expect(result.excluded).toMatchObject({
    recordCount: 24,
    diagnosisCategoryCount: 12,
    diagnosisCount: 12,
    diagnosisCategoryLinkCount: 12,
  });
  expect(result.excluded.recordKeys).toHaveLength(24);
  expect(result.excluded.diagnosisCategoryLinkKeys).toHaveLength(12);
  expect(validateClinicalMasterPublishPayload(result.payload)).toEqual([]);
  expect(result.payload.records.every((record) => record.source.sourceType === "synthetic")).toBe(true);
  expect(result.payload.records.every((record) => !("changeSummary" in record) && !("sourceKey" in record))).toBe(true);
});

test("normalizes row order and object order to one deterministic publisher result", () => {
  const first = makePilotFixture();
  const shuffled = makePilotFixture();
  shuffled.records.reverse();
  shuffled.sources.reverse();
  shuffled.classificationPaths.reverse();
  shuffled.labPanelItems.reverse();
  shuffled.labOrderProfiles.reverse();
  shuffled.diagnosisCategoryLinks.reverse();
  const firstResult = adaptClinicalMasterAirtableAuthoringExport(first);
  const shuffledResult = adaptClinicalMasterAirtableAuthoringExport(shuffled);
  expect(JSON.stringify(shuffledResult)).toBe(JSON.stringify(firstResult));
});

test("supports an already-normalized snapshot without reintroducing authoring fields", () => {
  const normalized = normalizeClinicalMasterAirtableAuthoringExport(makePilotFixture());
  const result = adaptNormalizedClinicalMasterAirtableAuthoringExport(normalized);
  expect(result.payload.records).toHaveLength(83);
  expect(result.payload.records[0]).not.toHaveProperty("authoringStatus");
  expect(result.payload.records[0]).not.toHaveProperty("sourceKey");
});

test("preserves fallback identity keys and existing classification-path record relations", () => {
  const fixture = makePilotFixture();
  addRecord(fixture, "cm.route.chart-only", "task_route", "차트 기록", "Chart only", { routeCode: "NT_CHART_ONLY" });
  const fallbackKeys = new Map([
    ["cm.chart.consultation", "phase1a2.fallback.chart.CG_CONSULTATION"],
    ["cm.chart.dispensing", "phase1a2.fallback.chart.CG_MEDICATION_SUPPLY"],
    ["cm.chart.imaging", "phase1a2.fallback.chart.CG_PROCEDURE"],
    ["cm.chart.lab", "phase1a2.fallback.chart.CG_EXAM"],
    ["cm.route.chart-only", "phase1a2.fallback.route.NT_CHART_ONLY"],
    ["cm.route.dispensing", "phase1a2.fallback.route.NT_DISPENSING"],
    ["cm.route.imaging", "phase1a2.fallback.route.NT_IMAGING"],
    ["cm.route.lab", "phase1a2.fallback.route.NT_LAB"],
    ["cm.route.treatment", "phase1a2.fallback.route.NT_TREATMENT"],
    ["cm.species.cat", "phase1a2.fallback.species.cat"],
    ["cm.species.dog", "phase1a2.fallback.species.dog"],
  ]);

  fixture.records.forEach((record) => {
    const fallbackKey = fallbackKeys.get(record.masterKey);
    if (fallbackKey) record.masterKey = fallbackKey;
  });
  fixture.classificationPaths.forEach((path) => {
    path.chartGroupKey = fallbackKeys.get(path.chartGroupKey) ?? path.chartGroupKey;
    path.taskRouteKey = fallbackKeys.get(path.taskRouteKey) ?? path.taskRouteKey;
  });

  const result = adaptClinicalMasterAirtableAuthoringExport(fixture);
  const recordsByKey = new Map(result.payload.records.map((record) => [record.masterKey, record]));
  expect(recordsByKey.has("phase1a2.fallback.chart.CG_CONSULTATION")).toBe(true);
  expect(recordsByKey.has("phase1a2.fallback.chart.CG_MEDICATION_SUPPLY")).toBe(true);
  expect(recordsByKey.has("phase1a2.fallback.chart.CG_PROCEDURE")).toBe(true);
  expect(recordsByKey.has("phase1a2.fallback.chart.CG_EXAM")).toBe(true);
  expect(recordsByKey.has("cm.chart.treatment")).toBe(true);
  expect(recordsByKey.has("phase1a2.fallback.route.NT_CHART_ONLY")).toBe(true);
  expect(recordsByKey.has("phase1a2.fallback.route.NT_DISPENSING")).toBe(true);
  expect(recordsByKey.has("phase1a2.fallback.route.NT_IMAGING")).toBe(true);
  expect(recordsByKey.has("phase1a2.fallback.route.NT_LAB")).toBe(true);
  expect(recordsByKey.has("phase1a2.fallback.route.NT_TREATMENT")).toBe(true);
  expect(recordsByKey.has("phase1a2.fallback.species.cat")).toBe(true);
  expect(recordsByKey.has("phase1a2.fallback.species.dog")).toBe(true);

  expect(result.payload.classificationPaths).toEqual(expect.arrayContaining([
    {
      pathKey: "cm.path.dispensing",
      clinicalActionKey: "cm.action.dispensing",
      chartGroupKey: "phase1a2.fallback.chart.CG_MEDICATION_SUPPLY",
      taskRouteKey: "phase1a2.fallback.route.NT_DISPENSING",
    },
    {
      pathKey: "cm.path.imaging",
      clinicalActionKey: "cm.action.imaging",
      chartGroupKey: "phase1a2.fallback.chart.CG_PROCEDURE",
      taskRouteKey: "phase1a2.fallback.route.NT_IMAGING",
    },
    {
      pathKey: "cm.path.consultation",
      clinicalActionKey: "cm.action.consultation",
      chartGroupKey: "phase1a2.fallback.chart.CG_CONSULTATION",
      taskRouteKey: "cm.route.billing",
    },
    {
      pathKey: "cm.path.metabolic",
      clinicalActionKey: "cm.action.metabolic",
      chartGroupKey: "phase1a2.fallback.chart.CG_EXAM",
      taskRouteKey: "phase1a2.fallback.route.NT_LAB",
    },
    {
      pathKey: "cm.path.treatment",
      clinicalActionKey: "cm.action.treatment",
      chartGroupKey: "cm.chart.treatment",
      taskRouteKey: "phase1a2.fallback.route.NT_TREATMENT",
    },
  ]));
});

test("adapts text and coded unitless lab tests without emitting nullable decimalScale", () => {
  const normalized = normalizeClinicalMasterAirtableAuthoringExport(makePilotFixture());
  const labTests = normalized.records.filter((record) => record.recordType === "lab_test");
  const textDetail = labTests[0].detail as JsonDetail;
  textDetail.resultInputTypeKey = "cm.input.text";
  textDetail.canonicalUnitKey = null;
  textDetail.decimalScale = null;
  const codedDetail = labTests[1].detail as JsonDetail;
  codedDetail.resultInputTypeKey = "cm.input.coded";
  codedDetail.canonicalUnitKey = null;
  codedDetail.decimalScale = null;

  const result = adaptNormalizedClinicalMasterAirtableAuthoringExport(normalized);
  const adaptedLabTests = result.payload.records.filter((record) => record.recordType === "lab_test");
  expect(adaptedLabTests[0].detail).not.toHaveProperty("decimalScale");
  expect(adaptedLabTests[1].detail).not.toHaveProperty("decimalScale");
  expect(adaptedLabTests[0].detail.canonicalUnitKey).toBeNull();
  expect(adaptedLabTests[1].detail.canonicalUnitKey).toBeNull();
  expect(validateClinicalMasterPublishPayload(result.payload)).toEqual([]);
});

test("rejects unsupported types, forbidden pricing data, failed gates, and relation leaks", () => {
  const unsupported = makePilotFixture();
  unsupported.records.push({
    ...unsupported.records[0],
    masterKey: "cm.future.unsupported",
    recordType: "future_type",
  });
  expect(() => adaptClinicalMasterAirtableAuthoringExport(unsupported)).toThrow();

  const priced = makePilotFixture();
  (priced.records.find((record) => record.recordType === "order")!.detail as JsonDetail).weightTierPrice = 1000;
  expect(() => adaptClinicalMasterAirtableAuthoringExport(priced)).toThrow();

  const failedGate = normalizeClinicalMasterAirtableAuthoringExport(makePilotFixture());
  failedGate.records[0].lifecycleStatus = "draft" as never;
  expect(() => adaptNormalizedClinicalMasterAirtableAuthoringExport(failedGate)).toThrow();
  try {
    adaptNormalizedClinicalMasterAirtableAuthoringExport(failedGate);
  } catch (error) {
    expect(issueCodes(error)).toContain("lifecycle_status_invalid");
  }

  const relationLeak = normalizeClinicalMasterAirtableAuthoringExport(makePilotFixture());
  relationLeak.classificationPaths[0].clinicalActionKey = relationLeak.records.find((record) => record.recordType === "diagnosis")!.masterKey;
  expect(() => adaptNormalizedClinicalMasterAirtableAuthoringExport(relationLeak)).toThrow();
  try {
    adaptNormalizedClinicalMasterAirtableAuthoringExport(relationLeak);
  } catch (error) {
    expect(issueCodes(error)).toContain("unsupported_relation_leak");
  }
});
