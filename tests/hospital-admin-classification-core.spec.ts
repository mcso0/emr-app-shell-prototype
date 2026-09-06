import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import {
  buildWorkspaceCatalogMutationFromHospitalOrder,
  formatHospitalOrderClassification,
  isHospitalOrderInCategory,
  mapWorkspaceCatalogItemToHospitalOrder,
  resolveHospitalOrderPlacement,
} from "../src/features/hospital-admin/data";
import {
  getHospitalOrderCoreDetails,
  getHospitalOrderCoreStatus,
  HOSPITAL_ORDER_CORE_FIELD_KEYS,
} from "../src/features/hospital-admin/order-core-details";
import {
  createSupabaseOrderCatalogGateway,
  defaultSystemOrderPresets,
  initializeWorkspaceOrderCatalogFromPresets,
  type OrderCatalogItem,
} from "../src/features/hospital-admin/server-order-catalog-core";
import {
  CLINICAL_ORDER_FIELD_SCHEMAS,
  CLINICAL_ORDER_TYPES,
} from "../src/features/chart/order-execution-domain";

const seed = initializeWorkspaceOrderCatalogFromPresets({
  now: "2026-09-06T00:00:00.000Z",
  workspaceId: "clair-demo",
  presets: defaultSystemOrderPresets,
}).items;
function item(patch: Partial<OrderCatalogItem> = {}): OrderCatalogItem {
  return { ...structuredClone(seed[0]), ...patch };
}

const categories = {
  consultation: "consultation",
  clinical_lab: "lab",
  system_exam: "lab",
  external_lab: "lab",
  imaging: "imaging",
  dispensing: "dispensing",
  treatment: "treatment",
  hospitalization: "hospitalization",
  other: "misc",
} as const;
for (const type of CLINICAL_ORDER_TYPES) {
  test(`${type}: explicit type determines coarse category, independent of names`, () => {
    const original = item({
      clinicalOrderType: type,
      categoryGroup: "misc",
      classificationPathId: "opaque-uuid",
      categoryLabel: "초음파 수술 주사 CBC",
      standardOrderName: "misleading name",
    });
    const placement = resolveHospitalOrderPlacement(original);
    expect(placement.categoryId).toBe(categories[type]);
    expect(
      resolveHospitalOrderPlacement({
        ...original,
        categoryLabel: "renamed",
        standardOrderName: "other",
        classificationPathId: "opaque-uuid",
      }),
    ).toEqual(placement);
  });
  test(`${type}: fixed core columns retain absent fields without expanding notes`, () => {
    const admin = mapWorkspaceCatalogItemToHospitalOrder(
      item({
        clinicalOrderType: type,
        defaultDetailInputs: {
          clinicalContext: "private long note",
          exceptions: "long exception",
        },
        medicationMetadata: undefined,
      }),
    );
    const fields = getHospitalOrderCoreDetails(admin);
    expect(fields.map((f) => f.definition.key)).toEqual(
      HOSPITAL_ORDER_CORE_FIELD_KEYS[type],
    );
    expect(
      fields.every((f) => f.definition && f.missing && f.value === undefined),
    ).toBe(true);
    expect(
      fields.every((f) =>
        CLINICAL_ORDER_FIELD_SCHEMAS[type].fields.includes(f.definition),
      ),
    ).toBe(true);
    expect(getHospitalOrderCoreStatus(admin)).toBe(
      `핵심 값 ${fields.length}개 미설정`,
    );
  });
}

test("lineage, pathology names and unknown identifiers never invent subcategories", () => {
  const dispensing = item({
    categoryGroup: "medication",
    clinicalOrderType: "dispensing",
    defaultDestinationModule: "dispensing",
    defaultDetailInputs: { route: "PO" },
    dispensingLineage: {} as NonNullable<OrderCatalogItem["dispensingLineage"]>,
  });
  expect(resolveHospitalOrderPlacement(dispensing)).toEqual({
    categoryId: "dispensing",
    subcategoryId: "unclassified",
    classificationStatus: "subcategory_missing",
  });
  const lab = mapWorkspaceCatalogItemToHospitalOrder(
    item({ clinicalOrderType: "clinical_lab", categoryLabel: "CBC검사" }),
  );
  expect(lab.clinicalPathologyCategoryId).toBeUndefined();
  expect(lab.subcategoryId).toBe("unclassified");
  expect(formatHospitalOrderClassification(lab)).toBe("검사 / 미설정");
  const linkedLab = mapWorkspaceCatalogItemToHospitalOrder(item({ clinicalOrderType: "clinical_lab", classificationPathId: "opaque-uuid" }));
  expect(linkedLab.classificationStatus).toBe("taxonomy_unavailable");
  expect(formatHospitalOrderClassification(linkedLab)).toBe("검사 / 저장 분류 조회 불가");
  expect(
    resolveHospitalOrderPlacement(
      item({ clinicalOrderType: "toString" as never, categoryGroup: "misc" }),
    ).categoryId,
  ).toBe("unclassified");
  expect(
    resolveHospitalOrderPlacement(
      item({
        clinicalOrderType: undefined,
        categoryGroup: "toString" as never,
      }),
    ).categoryId,
  ).toBe("unclassified");
});

test("unclassified rows remain visible in their category-wide view and missing-classification list", () => {
  const admin = mapWorkspaceCatalogItemToHospitalOrder(
    item({ clinicalOrderType: "imaging" }),
  );
  expect(isHospitalOrderInCategory(admin, "imaging", "unclassified")).toBe(
    true,
  );
  expect(isHospitalOrderInCategory(admin, "unclassified", "unclassified")).toBe(
    true,
  );
  expect(isHospitalOrderInCategory(admin, "imaging", "radiography")).toBe(
    false,
  );
  expect(isHospitalOrderInCategory(admin, "dispensing", "unclassified")).toBe(
    false,
  );
  const resolved = mapWorkspaceCatalogItemToHospitalOrder(
    item({ clinicalOrderType: "system_exam", categoryGroup: "misc" }),
  );
  expect(isHospitalOrderInCategory(resolved, "lab", "unclassified")).toBe(true);
  expect(
    isHospitalOrderInCategory(resolved, "unclassified", "unclassified"),
  ).toBe(false);
});

test("API marks derived types instead of laundering them into saved classification", async () => {
  for (const type of [null, "clinical_lab", "bogus", " ", 17]) {
    const row = {
      id: "order-lab",
      workspace_id: "clair-demo",
      standard_order_id: "master-lab",
      source_preset_version: "v1",
      category_group: "lab",
      category_label: "CBC검사",
      standard_order_name: "CBC",
      in_hospital_order_name: "CBC",
      billing_name: "CBC",
      availability_status: "active",
      price_krw: 0,
      sales_unit: "per_order",
      default_destination_module: "lab",
      default_task_required: true,
      billing_reflection_enabled: true,
      tax_included: false,
      rounding_rule: "as_is",
      updated_at: "2026-09-06T00:00:00.000Z",
      clinical_order_type: type,
      default_detail_inputs: { specimenType: "blood" },
    };
    const gateway = createSupabaseOrderCatalogGateway({
      async rpc() {
        return { data: [row], error: null };
      },
    });
    const result = await gateway.listAdminCatalog({
      workspaceId: "clair-demo",
    });
    if (type !== null && type !== "clinical_lab") {
      expect(result.ok).toBe(false);
      continue;
    }
    expect(result.ok).toBe(true);
    if (!result.ok) throw Error("expected successful read");
    expect(result.items[0].clinicalOrderTypeSource).toBe(
      type ? "persisted" : "derived",
    );
    const admin = mapWorkspaceCatalogItemToHospitalOrder(result.items[0]);
    expect(admin.clinicalOrderType).toBe(type ?? undefined);
    expect(admin.defaultDetailInputs).toEqual({ specimenType: "blood" });
    expect(admin.classificationStatus).toBe(
      type ? "subcategory_missing" : "type_missing",
    );
  }
});

test("updating an unclassified row does not write protected taxonomy or lose defaults", () => {
  const original = item({
    clinicalOrderType: "clinical_lab",
    defaultDetailInputs: {
      specimenType: "blood",
      testPanel: "CBC",
      collectionCondition: "saved",
      clinicalContext: "keep in drawer",
    },
    classificationPathId: "opaque-uuid",
  });
  const admin = mapWorkspaceCatalogItemToHospitalOrder(original);
  const mutation = buildWorkspaceCatalogMutationFromHospitalOrder({
    draft: { ...admin, inHospitalName: "renamed" },
    source: original,
    workspaceId: original.workspaceId,
  });
  if (mutation.action !== "update") throw Error("expected update");
  for (const key of [
    "categoryGroup",
    "categoryLabel",
    "clinicalOrderType",
    "classificationPathId",
    "clinicalOrderTypeSource",
    "classificationStatus",
  ])
    expect(mutation.patch).not.toHaveProperty(key);
  expect(mutation.patch.defaultDetailInputs).toEqual(
    original.defaultDetailInputs,
  );
  expect(getHospitalOrderCoreDetails(admin).map((f) => f.value)).toEqual([
    "blood",
    "CBC",
    "saved",
  ]);
});

test("core presence preserves false and zero and does not imply validation or review", () => {
  const admin = mapWorkspaceCatalogItemToHospitalOrder(
    item({
      clinicalOrderType: "imaging",
      defaultDetailInputs: {
        bodyRegion: "saved",
        position: "saved",
        viewCount: 0,
        contrastRequired: false,
        sedationRequired: false,
      },
    }),
  );
  expect(getHospitalOrderCoreDetails(admin).every((f) => !f.missing)).toBe(
    true,
  );
  expect(getHospitalOrderCoreStatus(admin)).toBe("핵심 값 입력됨");
});

test("table uses bounded core fields and keeps secondary dispensing details out of column menu", () => {
  const source = readFileSync("src/features/hospital-admin/module.tsx", "utf8");
  const table = source.slice(
    source.indexOf("  const hospitalOrderColumns ="),
    source.indexOf("  const orderRowSelection ="),
  );
  for (const id of [
    "dispensingMedicationInstruction",
    "dispensingStorage",
    "dispensingReview",
  ])
    expect(table).not.toContain(`id: "${id}"`);
  expect(table).toContain('id: "dispensingDoseBasis"');
  expect(source).toContain("getHospitalOrderCoreDetails(draft)");
  expect(source).not.toContain("hasOwnProperty.call(authoredValues");
});
