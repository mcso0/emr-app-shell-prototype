import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { readPersistedOrderDefaults } from "../src/features/hospital-admin/persisted-order-defaults";
import {
  buildWorkspaceCatalogMutationFromHospitalOrder,
  calculateHospitalDispenseQuantity,
  createEmptyHospitalOrderDraft,
  getHospitalFrequencyDailyCount,
  mapWorkspaceCatalogItemToHospitalOrder,
} from "../src/features/hospital-admin/data";
import {
  createOrderPricingSnapshot,
  createSupabaseOrderCatalogGateway,
  defaultSystemOrderPresets,
  initializeWorkspaceOrderCatalogFromPresets,
  type OrderCatalogItem,
} from "../src/features/hospital-admin/server-order-catalog-core";
import {
  CLINICAL_ORDER_FIELD_SCHEMAS,
  CLINICAL_ORDER_TYPES,
  validateClinicalOrderDetailInputs,
} from "../src/features/chart/order-execution-domain";

const seed = initializeWorkspaceOrderCatalogFromPresets({
  now: "2026-09-06T00:00:00.000Z",
  presets: defaultSystemOrderPresets,
  workspaceId: "clair-demo",
}).items;
const complete = {
  doseBasis: "patient",
  dose: 1,
  doseUnit: "tablet",
  route: "PO",
  frequency: "bid",
  durationDays: 5,
  totalQuantity: 10,
  totalQuantityUnit: "tablet",
  medicationInstruction: "after_meal",
  storageMethod: "room_temp",
};
function medication(
  details: Record<string, unknown> = complete,
): OrderCatalogItem {
  const item = structuredClone(
    seed.find(
      (item) =>
        item.categoryGroup === "medication" &&
        item.defaultDestinationModule === "dispensing",
    )!,
  );
  item.defaultDetailInputs = structuredClone(details);
  item.medicationMetadata = {
    ...item.medicationMetadata,
    autoDispenseQuantityEnabled: false,
    defaultDetailInputs: { ...complete, dose: 99 },
    doseAmount: 99,
    administrationDays: 99,
    dailyFrequencyCode: "qid",
    administrationRoute: "IV",
  };
  return item;
}

test("source selection preserves zero, false and arrays without per-field legacy merge", () => {
  const row = {
    defaultDetailInputs: { dose: 0, enabled: false, labels: ["a"] },
    medicationMetadata: { defaultDetailInputs: { dose: 9, route: "PO" } },
  };
  const result = readPersistedOrderDefaults(row);
  expect(result.source).toBe("generic");
  expect(result.values).toEqual({ dose: 0, enabled: false, labels: ["a"] });
  (result.values!.labels as string[]).push("b");
  expect(row.defaultDetailInputs.labels).toEqual(["a"]);
  expect(result.storedValues!.labels).toEqual(["a"]);
});

test("V2 Admin preview follows persisted course preparation instead of unrounded total", () => {
  const authority = { schemaVersion: 2 as const, calculationMode: "product_unit" as const, dispenseUnit: "tablet",
    preparationPolicy: { quantityScope: "course_total" as const, increment: 0.5, roundingMode: "up" as const, displayPrecision: 1 } };
  const item = medication({ ...complete, dose: 0.25, frequency: "tid", durationDays: 5, totalQuantity: 4, planOrderAuthority: authority });
  item.planOrderAuthority = authority;
  const draft = mapWorkspaceCatalogItemToHospitalOrder(item);
  expect(calculateHospitalDispenseQuantity(draft.dispensingPreset!, authority)).toBe(4);
  expect(calculateHospitalDispenseQuantity({ ...draft.dispensingPreset!, dose: 0.5 }, authority)).toBe(7.5);
  expect(readPersistedOrderDefaults(item).values).not.toHaveProperty("planOrderAuthority");
});

test("bounded same-row legacy read is marked, and no record means missing", () => {
  const legacy = readPersistedOrderDefaults({
    defaultDetailInputs: {},
    medicationMetadata: { defaultDetailInputs: { dose: 2 } },
  });
  expect(legacy.source).toBe("legacy_medication_metadata");
  expect(legacy.values).toEqual({ dose: 2 });
  expect(readPersistedOrderDefaults({}).source).toBe("missing");
  expect(
    readPersistedOrderDefaults({ medicationMetadata: { doseAmount: 12 } })
      .values,
  ).toBeUndefined();
});

test("reserved-only generic defaults cannot resurrect old medication defaults", () => {
  const result = readPersistedOrderDefaults({
    defaultDetailInputs: {
      planOrderAuthority: {},
      manualQuantityReason: "explicit",
      autoDispenseQuantityEnabled: false,
    },
    medicationMetadata: { defaultDetailInputs: complete },
  });
  expect(result.source).toBe("generic");
  expect(result.values).toEqual({});
  expect(result.storedValues!.manualQuantityReason).toBe("explicit");
  expect(
    readPersistedOrderDefaults({
      defaultDetailInputs: result.values,
      defaultDetailInputsSource: result.source,
      medicationMetadata: { defaultDetailInputs: complete },
    }).values,
  ).toEqual({});
});

for (const key of Object.keys(complete)) {
  test(`missing ${key} stays missing in Admin and new chart snapshot`, () => {
    const details: Record<string, unknown> = { ...complete };
    delete details[key];
    const item = medication(details);
    const admin = mapWorkspaceCatalogItemToHospitalOrder(item);
    const snapshot = createOrderPricingSnapshot(item);
    expect(admin.defaultDetailInputs).not.toHaveProperty(key);
    expect(snapshot.defaultDetailInputs).not.toHaveProperty(key);
    expect(snapshot.defaultDetailInputsSource).toBe("generic");
    expect(
      admin.dispensingPreset?.[
        key as keyof NonNullable<typeof admin.dispensingPreset>
      ],
    ).toBe(
      ["dose", "durationDays", "totalQuantity"].includes(key) ? undefined : "",
    );
  });
}

test("all categories leave empty partial inputs empty instead of materializing schema defaults", () => {
  for (const clinicalOrderType of CLINICAL_ORDER_TYPES) {
    expect(
      validateClinicalOrderDetailInputs({
        clinicalOrderType,
        detailInputs: {},
        schemaVersion: 1,
        requireComplete: false,
      }),
    ).toEqual({ valid: true, normalized: {} });
    const result = validateClinicalOrderDetailInputs({
      clinicalOrderType,
      detailInputs: {},
      schemaVersion: 1,
    });
    const required = CLINICAL_ORDER_FIELD_SCHEMAS[
      clinicalOrderType
    ].fields.filter((field) => field.required);
    if (required.length) {
      expect(result.valid).toBe(false);
      if (!result.valid)
        for (const field of required)
          expect(result.fieldErrors[field.key]).toBe("required");
    }
  }
  expect(
    validateClinicalOrderDetailInputs({
      clinicalOrderType: "imaging",
      schemaVersion: 1,
      detailInputs: { contrastRequired: false, sedationRequired: false },
      requireComplete: false,
    }),
  ).toEqual({
    valid: true,
    normalized: { contrastRequired: false, sedationRequired: false },
  });
});

test("Admin edits preserve generic-only values and raw policies but never restore cleared fields", () => {
  const item = medication({
    ...complete,
    doseBasis: "kg",
    taperSchedule: "persisted schedule",
    manualQuantityReason: "manual reason",
  });
  const admin = mapWorkspaceCatalogItemToHospitalOrder(item);
  const mutation = buildWorkspaceCatalogMutationFromHospitalOrder({
    draft: {
      ...admin,
      dispensingPreset: {
        ...admin.dispensingPreset!,
        dose: undefined,
        route: "",
      },
    },
    source: item,
    workspaceId: item.workspaceId,
  });
  if (mutation.action !== "update") throw new Error("expected update");
  expect(mutation.patch.defaultDetailInputs).toEqual(
    mutation.patch.medicationMetadata?.defaultDetailInputs,
  );
  expect(mutation.patch.defaultDetailInputs).not.toBe(
    mutation.patch.medicationMetadata?.defaultDetailInputs,
  );
  expect(mutation.patch.defaultDetailInputs).toMatchObject({
    doseBasis: "kg",
    taperSchedule: "persisted schedule",
    manualQuantityReason: "manual reason",
  });
  expect(mutation.patch.defaultDetailInputs).not.toHaveProperty("dose");
  expect(mutation.patch.medicationMetadata?.doseAmount).toBeUndefined();
  expect(
    mutation.patch.medicationMetadata?.administrationRoute,
  ).toBeUndefined();
  const serialized = JSON.parse(JSON.stringify(mutation.patch));
  expect(serialized.medicationMetadata).not.toHaveProperty("doseAmount");
});

test("create mirrors persisted details; manual policy stays raw but is not a chart clinical field", () => {
  const admin = mapWorkspaceCatalogItemToHospitalOrder(
    medication({ ...complete, manualQuantityReason: "rounded by author" }),
  );
  const mutation = buildWorkspaceCatalogMutationFromHospitalOrder({
    draft: { ...admin, sourceCatalogItem: undefined },
    workspaceId: "clair-demo",
  });
  if (mutation.action !== "create") throw new Error("expected create");
  expect(mutation.item.defaultDetailInputs).toEqual(
    mutation.item.medicationMetadata?.defaultDetailInputs,
  );
  expect(mutation.item.defaultDetailInputs).not.toBe(
    mutation.item.medicationMetadata?.defaultDetailInputs,
  );
  expect(mutation.item.defaultDetailInputs!.manualQuantityReason).toBe(
    "rounded by author",
  );
  expect(mutation.item.medicationMetadata?.autoDispenseQuantityEnabled).toBe(
    false,
  );
  const execution = readPersistedOrderDefaults(mutation.item).values;
  expect(execution).not.toHaveProperty("manualQuantityReason");
  expect(execution).not.toHaveProperty("autoDispenseQuantityEnabled");
  expect(
    validateClinicalOrderDetailInputs({
      clinicalOrderType: "dispensing",
      detailInputs: execution,
      schemaVersion: 1,
    }),
  ).toMatchObject({ valid: true });
});

test("new dispensing drafts and unsupported calculations do not invent clinical values", () => {
  const blank = createEmptyHospitalOrderDraft(
    "dispensing",
    "injection",
  ).dispensingPreset!;
  expect(blank).toMatchObject({
    dose: undefined,
    durationDays: undefined,
    totalQuantity: undefined,
    autoDispenseQuantityEnabled: undefined,
    doseUnit: "",
    route: "",
    frequency: "",
  });
  expect(calculateHospitalDispenseQuantity(blank)).toBeUndefined();
  const preset =
    mapWorkspaceCatalogItemToHospitalOrder(medication()).dispensingPreset!;
  expect(calculateHospitalDispenseQuantity(preset)).toBe(10);
  for (const patch of [
    { dose: undefined },
    { dose: Number.MAX_VALUE },
    { frequency: "unknown" },
    { doseBasis: "kg" },
    { doseBasis: "body_surface_area" },
    { totalQuantityUnit: "mg" },
  ])
    expect(
      calculateHospitalDispenseQuantity({ ...preset, ...patch }),
    ).toBeUndefined();
  expect(getHospitalFrequencyDailyCount("unknown")).toBeUndefined();
});

test("serialized empty generic snapshot does not revive nested fields during RPC mapping", async () => {
  const item = medication({ manualQuantityReason: "raw policy only" });
  const snapshot = createOrderPricingSnapshot(item);
  const row = {
    rowType: "individual",
    sourcePresetId: snapshot.sourcePresetId,
    sourcePresetVersion: snapshot.sourcePresetVersion,
    displayName: snapshot.appliedDisplayName,
    billingName: snapshot.appliedBillingName,
    categoryGroup: "medication",
    workspaceCatalogItemId: item.id,
    targetSpecies: item.targetSpecies,
    appliedSnapshot: snapshot,
  };
  const gateway = createSupabaseOrderCatalogGateway({
    async rpc() {
      return { data: [JSON.parse(JSON.stringify(row))], error: null };
    },
  });
  const result = await gateway.listChartSearch({
    workspaceId: item.workspaceId,
  });
  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(result.rows[0].appliedSnapshot.defaultDetailInputs).toEqual({});
    expect(result.rows[0].appliedSnapshot.defaultDetailInputsSource).toBe(
      "generic",
    );
    expect(
      readPersistedOrderDefaults(result.rows[0].appliedSnapshot).values,
    ).toEqual({});
  }
});

test("renderers and correction editors do not substitute schema values for absent inputs", () => {
  const chart = readFileSync("src/features/chart/module.tsx", "utf8");
  const admin = readFileSync("src/features/hospital-admin/module.tsx", "utf8");
  expect(chart).not.toMatch(
    /detailInputs\[definition.key\]\s*\?\?\s*definition.defaultValue/,
  );
  expect(admin).not.toContain("미설정 시 차트 스키마 기본값");
  expect(admin).toContain('typeof value !== "boolean"');
  expect(chart.match(/typeof value !== "boolean"/g)).toHaveLength(2);
  expect(admin).toContain('placeholder="미설정"');
});
