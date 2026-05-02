import { expect, test } from "@playwright/test";
import {
  getMockCurrentServiceItemPrice,
  getMockPermissionsForRole,
  getMockRoleById,
  getMockServiceCatalogConsistencyReport,
  getMockServiceCatalogEntry,
  getMockServiceItemsByType,
} from "../src/lib/emr-domain/service-catalog";
import {
  mockInvoiceLines,
  mockOrders,
  mockPermissionSeeds,
  mockRoleSeeds,
  mockServiceCategories,
} from "../src/mocks/emr-domain";

test("role and permission seeds expose the MVP foundation without enforcement", () => {
  expect(mockRoleSeeds.map((role) => role.id)).toEqual([
    "front_desk",
    "vet",
    "nurse",
    "billing_admin",
    "hospital_admin",
  ]);

  const hospitalAdmin = getMockRoleById("hospital_admin");
  expect(hospitalAdmin?.permissionIds).toEqual(mockPermissionSeeds.map((permission) => permission.id));

  const vetPermissions = getMockPermissionsForRole("vet").map((permission) => permission.id);
  expect(vetPermissions).toEqual(
    expect.arrayContaining(["chart:update", "order:request", "service_catalog:view"])
  );
  expect(vetPermissions).not.toContain("role_permission:manage");

  const billingPermissions = getMockPermissionsForRole("billing_admin").map(
    (permission) => permission.id
  );
  expect(billingPermissions).toEqual(
    expect.arrayContaining(["billing:view", "billing:issue", "service_catalog:view"])
  );
});

test("service catalog lookup resolves common categories, items, and current prices", () => {
  expect(mockServiceCategories.map((category) => category.name)).toEqual([
    "진료",
    "처방/조제",
    "처치",
    "검사",
    "영상",
    "수납",
  ]);

  expect(getMockServiceItemsByType("consultation").map((item) => item.id)).toContain(
    "svc-consult-general"
  );
  expect(getMockServiceItemsByType("medication").map((item) => item.id)).toEqual(
    expect.arrayContaining(["svc-med-maropitant", "svc-med-carprofen"])
  );
  expect(getMockServiceItemsByType("lab").map((item) => item.id)).toEqual(
    expect.arrayContaining(["svc-lab-cbc", "svc-lab-chemistry"])
  );
  expect(getMockServiceItemsByType("imaging").map((item) => item.id)).toEqual(
    expect.arrayContaining(["svc-imaging-thorax", "svc-imaging-abdomen"])
  );

  expect(getMockServiceCatalogEntry("svc-med-maropitant")).toMatchObject({
    item: {
      name: "Maropitant 16mg T",
      itemType: "medication",
      isOrderable: true,
      isBillable: true,
    },
    category: { name: "처방/조제" },
    currentPrice: { price: 4500, currency: "KRW" },
  });
  expect(getMockCurrentServiceItemPrice("svc-imaging-abdomen")?.price).toBe(77000);
});

test("orders and invoice lines consistently reference service catalog seed", () => {
  const report = getMockServiceCatalogConsistencyReport();

  expect(report.orphanServiceItemCategoryIds).toEqual([]);
  expect(report.orphanPriceServiceItemIds).toEqual([]);
  expect(report.missingActiveBillablePriceItemIds).toEqual([]);
  expect(report.orphanOrderServiceItemIds).toEqual([]);
  expect(report.orphanInvoiceLineServiceItemIds).toEqual([]);
  expect(report.invoiceLinePriceMismatches).toEqual([]);
  expect(report.rolePermissionGaps).toEqual([]);

  for (const line of mockInvoiceLines) {
    expect(line.lineTotal).toBe(line.quantity * line.unitPrice);

    if (!line.serviceItemId) {
      continue;
    }

    const catalogEntry = getMockServiceCatalogEntry(line.serviceItemId);
    expect(catalogEntry?.item.isBillable).toBe(true);
    expect(catalogEntry?.currentPrice?.price).toBe(line.unitPrice);

    if (line.orderId) {
      const order = mockOrders.find((item) => item.id === line.orderId);
      expect(order?.serviceItemId).toBe(line.serviceItemId);
    }
  }
});
