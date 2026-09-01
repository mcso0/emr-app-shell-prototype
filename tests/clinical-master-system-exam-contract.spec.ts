import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  CLINICAL_ORDER_FIELD_SCHEMAS,
  CLINICAL_ORDER_TYPES,
  resolveClinicalOrderMasterContract,
  validateClinicalOrderDetailInputs,
} from "../src/features/chart/order-execution-domain";

const fixturePath = resolve(
  process.cwd(),
  "tests/fixtures/clinical-master-system-exam-authoring-v1.json",
);
const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260831070617_clinical_master_system_exam_order_contract.sql",
);
const generatorPath = resolve(
  process.cwd(),
  "scripts/generate-clinical-master-system-exam-authoring-v1.mjs",
);

type SystemExamFixtureAction = {
  recordType: string;
  tCategoryKey: string;
  itemType: string;
};

type SystemExamFixturePath = {
  chartGroupKey: string;
  taskRouteKey: string;
};

type SystemExamFixturePreset = {
  presetId: string;
  presetKey: string;
  presetRevision: number;
  clinicalOrderType: string;
  destinationModule: string | null;
  executionMode: string;
  detailSchemaVersion: number;
  presetStatus: string;
  clinicalUseAllowed: boolean;
  syntheticUnreviewed: boolean;
  provenance: Record<string, unknown>;
  contentSha256: string;
  sourceArtifactSha256: string;
  defaultDetailInputs: Record<string, unknown>;
  fieldPolicies: Record<string, string>;
};

type SystemExamFixtureRecord = {
  masterKey: string;
  recordType: string;
  lifecycleStatus: string;
  safetyStatus: string;
  source: { sourceType: string };
  detail: Record<string, unknown>;
};

type SystemExamPublisherFragment = {
  records: Array<{
    masterKey: string;
    recordType: string;
    lifecycleStatus: string;
    safetyStatus: string;
    source: { sourceType: string };
    detail: Record<string, unknown>;
  }>;
  classificationPaths: SystemExamFixturePath[];
};

type SystemExamFixture = {
  schemaVersion: string;
  publishState: string;
  clinicalUseAllowed: boolean;
  orderCount: number;
  stableOrderKeys: string[];
  records: SystemExamFixtureRecord[];
  clinicalActions: SystemExamFixtureAction[];
  classificationPaths: SystemExamFixturePath[];
  profiles: unknown[];
  executionPresets: Array<{
    orderKey: string;
    preset: SystemExamFixturePreset;
  }>;
  publisherFragment: SystemExamPublisherFragment;
  taxonomy: {
    newTCategory: Record<string, unknown>;
    reusedChartGroup: Record<string, unknown>;
    reusedTaskRoute: Record<string, unknown>;
    clinicalActionItemType: string;
  };
};

test("system_exam is the ninth additive destinationless clinical type", () => {
  expect(CLINICAL_ORDER_TYPES).toEqual([
    "consultation",
    "clinical_lab",
    "imaging",
    "external_lab",
    "dispensing",
    "treatment",
    "hospitalization",
    "system_exam",
    "other",
  ]);
  expect(resolveClinicalOrderMasterContract({
    categoryGroup: "misc",
    clinicalOrderType: "system_exam",
    destinationModule: null,
    executionMode: "immediate_complete",
    defaultTaskRequired: false,
    billingReflectionEnabled: true,
  })).toMatchObject({
    clinicalOrderType: "system_exam",
    destinationModule: null,
    executionMode: "immediate_complete",
  });
});

test("system_exam v1 requires runtime findings and only fixes safe profile values", () => {
  const schema = CLINICAL_ORDER_FIELD_SCHEMAS.system_exam;
  expect(schema.version).toBe(1);
  expect(schema.defaultDestinationModule).toBeNull();
  expect(schema.defaultExecutionMode).toBe("immediate_complete");
  expect(schema.fields.find((field) => field.key === "bodySystem")).toMatchObject({
    required: true,
    options: expect.arrayContaining(["전신상태·활력", "심혈관계", "말초 림프계"]),
  });
  expect(schema.fields.find((field) => field.key === "findingSummary")).toMatchObject({
    required: true,
    defaultValue: null,
  });

  const profileOnly = validateClinicalOrderDetailInputs({
    clinicalOrderType: "system_exam",
    detailInputs: {
      bodySystem: "심혈관계",
      examScope: "심혈관계 평가",
      examMethod: "표준 신체검사",
    },
    requireComplete: false,
    schemaVersion: 1,
  });
  expect(profileOnly).toEqual({
    valid: true,
    normalized: {
      bodySystem: "심혈관계",
      examScope: "심혈관계 평가",
      examMethod: "표준 신체검사",
    },
  });

  const incomplete = validateClinicalOrderDetailInputs({
    clinicalOrderType: "system_exam",
    detailInputs: {
      bodySystem: "심혈관계",
      examScope: "심혈관계 평가",
      examMethod: "표준 신체검사",
    },
    schemaVersion: 1,
  });
  expect(incomplete).toEqual({
    valid: false,
    fieldErrors: { findingSummary: "required" },
  });

  const complete = validateClinicalOrderDetailInputs({
    clinicalOrderType: "system_exam",
    detailInputs: {
      bodySystem: "심혈관계",
      examScope: "심혈관계 평가",
      examMethod: "표준 신체검사",
      findingSummary: "실제 진찰 소견을 입력",
    },
    schemaVersion: 1,
  });
  expect(complete.valid).toBe(true);
});

test("clinical_lab accepts tissue specimens for in-house cytology profiles", () => {
  expect(
    CLINICAL_ORDER_FIELD_SCHEMAS.clinical_lab.fields.find(
      (field) => field.key === "specimenType",
    )?.options,
  ).toContain("tissue");
});

test("authoring fixture freezes all 12 system-exam identities and taxonomy dependencies", () => {
  const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as SystemExamFixture;
  expect(fixture.schemaVersion).toBe("clinical-master-system-exam-authoring/v1");
  expect(fixture.publishState).toBe("synthetic_unreviewed");
  expect(fixture.clinicalUseAllowed).toBe(false);
  expect(fixture.orderCount).toBe(12);
  expect(fixture.records).toHaveLength(12);
  expect(fixture.clinicalActions).toHaveLength(12);
  expect(fixture.classificationPaths).toHaveLength(12);
  expect(fixture.profiles).toHaveLength(12);
  expect(fixture.executionPresets).toHaveLength(12);
  expect(fixture.publisherFragment.records).toHaveLength(13);
  expect(fixture.publisherFragment.classificationPaths).toHaveLength(12);
  expect(fixture.publisherFragment.classificationPaths).toEqual(fixture.classificationPaths);
  expect(fixture.publisherFragment.records[0]).toMatchObject({
    masterKey: "cm.order-category.t.system-exam",
    recordType: "order_category",
    lifecycleStatus: "published",
    safetyStatus: "normal",
    source: { sourceType: "synthetic" },
    detail: {
      categoryCode: "T-SYSTEM-EXAM",
      categoryLevel: "T",
      parentMasterKey: "cm.order-category.x.clinical",
    },
  });
  expect(fixture.publisherFragment.records.slice(1).every((record, index) =>
    record.masterKey === `cm.action.system-exam.${fixture.stableOrderKeys[index].slice("cm.order.system-exam.".length)}` &&
    record.recordType === "clinical_action" &&
    record.lifecycleStatus === "published" &&
    record.safetyStatus === "normal" &&
    record.source.sourceType === "synthetic" &&
    record.detail.tCategoryKey === "cm.order-category.t.system-exam" &&
    record.detail.itemType === "misc",
  )).toBe(true);
  expect(fixture.taxonomy.newTCategory).toMatchObject({
    masterKey: "cm.order-category.t.system-exam",
    categoryLevel: "T",
    parentMasterKey: "cm.order-category.x.clinical",
  });
  expect(fixture.taxonomy.reusedChartGroup).toMatchObject({
    masterKey: "phase1a2.fallback.chart.CG_EXAM",
    groupCode: "CG_EXAM",
    reuse: true,
  });
  expect(fixture.taxonomy.reusedTaskRoute).toMatchObject({
    masterKey: "phase1a2.fallback.route.NT_CHART_ONLY",
    routeCode: "NT_CHART_ONLY",
    destinationModule: "chart_only",
    taskRequired: false,
    reuse: true,
  });
  expect(fixture.taxonomy.clinicalActionItemType).toBe("misc");
  expect(fixture.clinicalActions.every((action) =>
    action.recordType === "clinical_action" &&
    action.tCategoryKey === "cm.order-category.t.system-exam" &&
    action.itemType === "misc",
  )).toBe(true);
  expect(fixture.classificationPaths.every((path) =>
    path.chartGroupKey === "phase1a2.fallback.chart.CG_EXAM" &&
    path.taskRouteKey === "phase1a2.fallback.route.NT_CHART_ONLY",
  )).toBe(true);

  for (const [index, record] of fixture.records.entries()) {
    const preset = fixture.executionPresets[index].preset;
    expect(record).not.toHaveProperty("systemExamAuthoring");
    expect(preset).toMatchObject({
      clinicalOrderType: "system_exam",
      destinationModule: null,
      executionMode: "immediate_complete",
      detailSchemaVersion: 1,
      presetStatus: "synthetic_unreviewed",
      syntheticUnreviewed: true,
      clinicalUseAllowed: false,
    });
    expect(preset.presetId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(preset.contentSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(preset.sourceArtifactSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(Object.keys(preset.defaultDetailInputs).sort()).toEqual([
      "bodySystem",
      "examMethod",
      "examScope",
    ]);
    expect(preset.defaultDetailInputs).not.toHaveProperty("findingSummary");
    expect(preset.defaultDetailInputs).not.toHaveProperty("normalFinding");
    expect(preset.defaultDetailInputs).not.toHaveProperty("patientId");
    expect(preset.defaultDetailInputs).not.toHaveProperty("assigneeUserId");
    expect(preset.fieldPolicies.findingSummary).toBe("required_manual");
    expect(record.detail).not.toHaveProperty("priceKrw");
    expect(record.detail.defaultBillingReflectionEnabled).toBe(false);
    expect(record.detail).not.toHaveProperty("patientId");
    expect(record.detail).not.toHaveProperty("assigneeUserId");
  }
});

test("system-exam migration preserves wrapper and blocks routed or legacy queue use", () => {
  const migration = readFileSync(migrationPath, "utf8");
  expect(migration).toContain("clair_order_detail_field_schema_v1_pr022_base");
  expect(migration).toContain("'system_exam'");
  expect(migration).toContain(
    '["blood","serum","plasma","urine","feces","swab","tissue","other"]',
  );
  expect(migration).toContain("order_catalog_items_system_exam_execution_check");
  expect(migration).toContain("orders_system_exam_execution_check");
  expect(migration).toContain("order_tasks_clinical_order_type_v2_check");
  expect(migration).toContain("order_fulfillment_work_items_clinical_type_v2_check");
  expect(migration).toContain("new.clinical_order_type = 'system_exam'");
  expect(migration).toContain("clinical_order_type in (");
  expect(migration).toContain("defaultDestinationModule', null");
  expect(migration).toContain("'defaultExecutionMode', 'immediate_complete'");
  expect(migration).toContain("from public, anon, authenticated, service_role");
  expect(migration).not.toContain("update public.orders");
  expect(migration).not.toContain("delete from public.orders");
});

test("system-exam authoring generator is deterministic and exposes a stable hash check", () => {
  const firstHash = execFileSync("node", [generatorPath, "--hash"], {
    cwd: process.cwd(),
    encoding: "utf8",
  }).trim();
  const secondHash = execFileSync("node", [generatorPath, "--hash"], {
    cwd: process.cwd(),
    encoding: "utf8",
  }).trim();
  expect(firstHash).toBe(secondHash);
  expect(firstHash).toMatch(/^[0-9a-f]{64}$/);
  expect(execFileSync("node", [generatorPath, "--check"], {
    cwd: process.cwd(),
    encoding: "utf8",
  })).toContain("checked");
});
