import { expect, test } from "@playwright/test";

import { CLINICAL_ORDER_FIELD_SCHEMAS } from "../src/features/chart/order-execution-domain";
import {
  createMockOrderCatalogGateway,
  createOrderPricingSnapshot,
  mapDispensingOrderLineageSnapshot,
  type DispensingOrderLineageSnapshot,
  type OrderCatalogItem,
} from "../src/features/hospital-admin/server-order-catalog-core";

const sha = (character: string) => character.repeat(64);

function lineage(
  clinicalUseAllowed: boolean,
  serviceReviewOnly = false,
): DispensingOrderLineageSnapshot {
  return {
    schemaVersion: 1,
    sourceDispensingProfileId: "01740000-0000-4000-8000-000000000001",
    sourceDispensingProfileRevision: 1,
    sourceMedicationProductId: "01730000-0000-4000-8000-000000000001",
    sourceMedicationProductRevision: 1,
    sourceClinicalReviewId: clinicalUseAllowed
      ? "01750000-0000-4000-8000-000000000001"
      : null,
    sourceEvidenceFingerprint: sha("a"),
    clinicalUseAllowed,
    ...(serviceReviewOnly
      ? {
          serviceReviewOnly: true as const,
          serviceReviewReleaseId: "78a57bf0-10a8-47db-9ae1-8a8cff79b2c4",
        }
      : {}),
    dispensingProfileSnapshot: {
      sourceDispensingProfileId: "01740000-0000-4000-8000-000000000001",
      sourceDispensingProfileRevision: 1,
    },
    dispensingProfileSnapshotSha256: sha("b"),
  };
}

function item(
  id: string,
  clinicalUseAllowed: boolean,
  workspaceId = "clair-demo",
  serviceReviewOnly = false,
): OrderCatalogItem {
  return {
    id,
    workspaceId,
    standardOrderId: `std-${id}`,
    sourcePresetVersion: "pr017-v1",
    categoryGroup: "medication",
    categoryLabel: "조제",
    standardOrderName: `PR-017 ${id}`,
    inHospitalOrderName: `PR-017 ${id}`,
    billingName: `PR-017 ${id}`,
    aliases: [],
    availabilityStatus: serviceReviewOnly ? "pending_activation" : "active",
    priceKrw: 1000,
    salesUnit: "per_each",
    targetSpecies: ["dog"],
    defaultDestinationModule: "dispensing",
    defaultTaskRequired: true,
    billingReflectionEnabled: true,
    taxIncluded: true,
    roundingRule: "as_is",
    linkedLabItemIds: [],
    linkedLabCategoryIds: [],
    pricingRule: {
      priceBasis: "unit_price",
      priceKrw: 1000,
      salesUnit: "per_each",
      taxIncluded: true,
      roundingRule: "as_is",
      billingReflectionEnabled: true,
    },
    sourceMasterRecordId: "01700000-0000-4000-8000-000000000001",
    sourceMasterRevision: 1,
    catalogRevision: 1,
    clinicalOrderType: "dispensing",
    destinationModule: "dispensing",
    executionMode: "routed",
    detailSchemaVersion: 1,
    billingEligible: true,
    dispensingLineage: lineage(clinicalUseAllowed, serviceReviewOnly),
    updatedAt: "2026-08-26T00:00:00.000Z",
  };
}

test("chart search includes approved and explicitly scoped service-review dispensing rows", async () => {
  const approved = item("dispensing-approved", true);
  const serviceReview = item(
    "dispensing-service-review",
    false,
    "clair-demo",
    true,
  );
  const pending = item("dispensing-pending", false);
  const gateway = createMockOrderCatalogGateway({
    items: [approved, serviceReview, pending],
    workspaceId: "clair-demo",
  });

  const result = await gateway.listChartSearch({ workspaceId: "clair-demo" });
  if (!result.ok) throw new Error(`catalog read failed: ${result.error}`);
  const individualRows = result.rows.filter((row) => row.rowType === "individual");
  expect(individualRows.map((row) => row.workspaceCatalogItemId)).toEqual([
    approved.id,
    serviceReview.id,
  ]);
  expect(individualRows[0]?.dispensingLineage).toEqual(approved.dispensingLineage);
  expect(individualRows[0]?.appliedSnapshot.dispensingLineage).toEqual(
    approved.dispensingLineage,
  );
  expect(individualRows[1]?.dispensingLineage?.serviceReviewOnly).toBe(true);
});

test("chart search retains 108 unique reviewed dispensing rows at target scale", async () => {
  const workspaceId = "pr017-scale-replay";
  const approved = Array.from({ length: 108 }, (_, index) =>
    item(
      `dispensing-approved-${String(index + 1).padStart(3, "0")}`,
      true,
      workspaceId,
    ),
  );
  const pending = item("dispensing-pending-scale-control", false, workspaceId);
  const gateway = createMockOrderCatalogGateway({
    items: [...approved, pending],
    workspaceId,
  });

  const result = await gateway.listChartSearch({ workspaceId });
  if (!result.ok) throw new Error(`catalog read failed: ${result.error}`);
  const ids = result.rows.map((row) => row.workspaceCatalogItemId);
  expect(ids).toHaveLength(108);
  expect(new Set(ids).size).toBe(108);
  expect(ids).not.toContain(pending.id);
  expect(
    result.rows.every((row) => row.dispensingLineage?.clinicalUseAllowed),
  ).toBe(true);
});

test("pricing snapshot carries immutable dispensing lineage without clinical prescription defaults", () => {
  const approved = item("dispensing-snapshot", true);
  const snapshot = createOrderPricingSnapshot(approved);

  expect(snapshot.dispensingLineage).toEqual(approved.dispensingLineage);
  expect(snapshot).not.toHaveProperty("dose");
  expect(snapshot).not.toHaveProperty("frequency");
  expect(snapshot).not.toHaveProperty("durationDays");
  expect(snapshot).not.toHaveProperty("totalQuantity");
});

test("lineage parser accepts only complete revision-pinned fingerprints", () => {
  const valid = lineage(true);
  expect(mapDispensingOrderLineageSnapshot(valid)).toEqual(valid);
  expect(
    mapDispensingOrderLineageSnapshot({
      ...valid,
      sourceEvidenceFingerprint: "not-a-sha",
    }),
  ).toBeUndefined();
  expect(
    mapDispensingOrderLineageSnapshot({
      ...valid,
      sourceDispensingProfileRevision: 0,
    }),
  ).toBeUndefined();
  expect(
    mapDispensingOrderLineageSnapshot({
      ...valid,
      dispensingProfileSnapshot: null,
    }),
  ).toBeUndefined();
  expect(
    mapDispensingOrderLineageSnapshot({
      ...valid,
      sourceClinicalReviewId: null,
    }),
  ).toBeUndefined();

  const serviceReview = lineage(false, true);
  expect(mapDispensingOrderLineageSnapshot(serviceReview)).toEqual(serviceReview);
  expect(
    mapDispensingOrderLineageSnapshot({
      ...serviceReview,
      serviceReviewReleaseId: undefined,
    }),
  ).toBeUndefined();
});

test("dispensing detail contract requires clinician-entered prescription values and supplies no defaults", () => {
  const schema = CLINICAL_ORDER_FIELD_SCHEMAS.dispensing;
  const required = schema.fields.filter((field) => field.required);
  expect(required.map((field) => field.key)).toEqual([
    "doseBasis",
    "dose",
    "doseUnit",
    "route",
    "frequency",
    "durationDays",
    "totalQuantity",
  ]);
  expect(required.every((field) => field.defaultValue === null)).toBe(true);
  expect(schema.defaultDestinationModule).toBe("dispensing");
  expect(schema.defaultExecutionMode).toBe("routed");
});
