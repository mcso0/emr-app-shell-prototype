import { expect, test } from "@playwright/test";

import { createMockWorkspacePermissionAdapter } from "../src/features/auth/permission-resolver";
import {
  createMockOrderCatalogGateway,
  createOrderPricingSnapshot,
  expandOrderSetForChart,
  listOrderCatalogForAdmin,
  mutateOrderCatalogItem,
  readLabTestItemDeleteLock,
  searchOrderCatalogForChart,
  type OrderCatalogItem,
} from "../src/features/hospital-admin/server-order-catalog-core";

function permissionAdapter(options: { permissionIds?: ["*"] | string[] } = {}) {
  return createMockWorkspacePermissionAdapter({
    users: [{ id: "user-admin", status: "active" }, { id: "user-vet", status: "active" }],
    memberships: [
      { id: "membership-admin", workspaceId: "clair-demo", userId: "user-admin", roles: ["hospital_admin"], status: "active" },
      { id: "membership-vet", workspaceId: "clair-demo", userId: "user-vet", roles: ["vet"], status: "active" },
    ],
    permissionPolicies: [
      { workspaceId: "clair-demo", role: "hospital_admin", permissionIds: (options.permissionIds ?? ["*"]) as never },
      { workspaceId: "clair-demo", role: "vet", permissionIds: ["service_catalog:view"] as never },
    ],
  });
}

test("admin read includes paused rows while chart search excludes paused rows and includes sets", async () => {
  const gateway = createMockOrderCatalogGateway();
  const admin = await listOrderCatalogForAdmin({
    actorUserId: "user-admin",
    workspaceId: "clair-demo",
    gateway,
    permissionAdapter: permissionAdapter(),
  });
  const chart = await searchOrderCatalogForChart({
    actorUserId: "user-vet",
    workspaceId: "clair-demo",
    gateway,
    permissionAdapter: permissionAdapter(),
  });

  expect(admin).toMatchObject({ ok: true, items: expect.arrayContaining([expect.objectContaining({ id: "ord-paused-example" })]) });
  expect(chart).toMatchObject({ ok: true });
  if (chart.ok) {
    expect(chart.rows.map((row) => row.sourcePresetId)).not.toContain("std-ord-paused-example");
    expect(chart.rows).toEqual(expect.arrayContaining([expect.objectContaining({ rowType: "set", sourcePresetId: "set-vomit-basic" })]));
  }
});

test("order mutations require service catalog manage permission and pause future chart selection", async () => {
  const gateway = createMockOrderCatalogGateway();
  const denied = await mutateOrderCatalogItem({
    actorUserId: "user-vet",
    workspaceId: "clair-demo",
    input: { action: "pause", itemId: "ord-lab-cbc-baso" },
    gateway,
    permissionAdapter: permissionAdapter(),
  });
  expect(denied).toMatchObject({ ok: false, status: 403, denialReason: "permission_missing" });

  const paused = await mutateOrderCatalogItem({
    actorUserId: "user-admin",
    workspaceId: "clair-demo",
    input: { action: "pause", itemId: "ord-lab-cbc-baso" },
    gateway,
    permissionAdapter: permissionAdapter(),
  });
  expect(paused).toMatchObject({ ok: true, item: expect.objectContaining({ availabilityStatus: "paused" }) });

  const chart = await searchOrderCatalogForChart({
    actorUserId: "user-vet",
    workspaceId: "clair-demo",
    gateway,
    permissionAdapter: permissionAdapter(),
  });
  expect(chart.ok).toBe(true);
  if (chart.ok) expect(chart.rows.map((row) => row.sourcePresetId)).not.toContain("std-ord-lab-cbc-baso");
});

test("order set expansion preserves child order snapshots and expansion order", async () => {
  const result = await expandOrderSetForChart({
    actorUserId: "user-vet",
    workspaceId: "clair-demo",
    orderSetId: "set-vomit-basic",
    gateway: createMockOrderCatalogGateway(),
    permissionAdapter: permissionAdapter(),
  });

  expect(result).toMatchObject({
    ok: true,
    parentSnapshot: expect.objectContaining({ sourcePresetId: "set-vomit-basic", appliedAmountBasis: "included_order_sum" }),
    rows: [
      expect.objectContaining({ setItemId: "setitem-vomit-baso", sortOrder: 10 }),
      expect.objectContaining({ setItemId: "setitem-vomit-maropitant", sortOrder: 20 }),
    ],
  });
});

test("lab test item delete lock prefers linked order before saved result usage", async () => {
  const result = await readLabTestItemDeleteLock({
    actorUserId: "user-admin",
    workspaceId: "clair-demo",
    testItemId: "labitem-cbc-baso",
    gateway: createMockOrderCatalogGateway(),
    permissionAdapter: permissionAdapter(),
  });

  expect(result).toMatchObject({
    ok: true,
    lock: expect.objectContaining({
      deleteLocked: true,
      linkedOrderCount: 1,
      savedResultUsageCount: 2,
      lockReason: "linked_order",
    }),
  });
});

test("medication vaccine and pricing snapshots remain stable after admin item update", async () => {
  const gateway = createMockOrderCatalogGateway();
  const before = await listOrderCatalogForAdmin({
    actorUserId: "user-admin",
    workspaceId: "clair-demo",
    gateway,
    permissionAdapter: permissionAdapter(),
  });
  expect(before.ok).toBe(true);
  const medication = before.ok ? before.items.find((item) => item.id === "ord-med-maropitant") : undefined;
  const vaccine = before.ok ? before.items.find((item) => item.id === "ord-vaccine-cat-core") : undefined;
  expect(medication?.medicationMetadata).toMatchObject({ administrationRoute: "PO", storageMethod: "room_temp" });
  expect(vaccine?.vaccineMetadata).toMatchObject({ vaccineClassification: "core", doseSequenceLabel: "1차" });

  const snapshot = createOrderPricingSnapshot(medication as OrderCatalogItem);
  await mutateOrderCatalogItem({
    actorUserId: "user-admin",
    workspaceId: "clair-demo",
    input: { action: "update", itemId: "ord-med-maropitant", patch: { priceKrw: 9900, pricingRule: { ...medication!.pricingRule, priceKrw: 9900 } } },
    gateway,
    permissionAdapter: permissionAdapter(),
  });

  expect(snapshot).toMatchObject({ appliedPriceKrw: 4500, appliedSalesUnit: "per_each", appliedAmountBasis: "unit_price" });
});
