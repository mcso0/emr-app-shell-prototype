import type {
  EmrId,
  InvoiceLine,
  PermissionId,
  PermissionSeed,
  RoleSeed,
  ServiceCategory,
  ServiceItem,
  ServiceItemPrice,
  ServiceItemType,
} from "@/types/emr-domain";
import {
  mockInvoiceLines,
  mockOrders,
  mockPermissionSeeds,
  mockRoleSeeds,
  mockServiceCategories,
  mockServiceItemPrices,
  mockServiceItems,
} from "@/mocks/emr-domain";

export type ServiceCatalogEntry = {
  item: ServiceItem;
  category?: ServiceCategory;
  currentPrice?: ServiceItemPrice;
};

export type ServiceCatalogConsistencyReport = {
  orphanServiceItemCategoryIds: EmrId[];
  orphanPriceServiceItemIds: EmrId[];
  missingActiveBillablePriceItemIds: EmrId[];
  orphanOrderServiceItemIds: EmrId[];
  orphanInvoiceLineServiceItemIds: EmrId[];
  invoiceLinePriceMismatches: InvoiceLine[];
  rolePermissionGaps: Array<{ roleId: RoleSeed["id"]; permissionId: PermissionId }>;
};

const defaultCatalogDate = "2026-05-02";

const serviceCategoryById = new Map(mockServiceCategories.map((category) => [category.id, category]));
const serviceItemById = new Map(mockServiceItems.map((item) => [item.id, item]));
const permissionById = new Map(mockPermissionSeeds.map((permission) => [permission.id, permission]));
const roleById = new Map(mockRoleSeeds.map((role) => [role.id, role]));

export function getMockServiceCategoryById(categoryId: EmrId): ServiceCategory | undefined {
  return serviceCategoryById.get(categoryId);
}

export function getMockServiceItemById(serviceItemId: EmrId): ServiceItem | undefined {
  return serviceItemById.get(serviceItemId);
}

export function getMockServiceItemsByType(itemType: ServiceItemType): ServiceItem[] {
  return mockServiceItems.filter((item) => item.itemType === itemType);
}

export function getMockCurrentServiceItemPrice(
  serviceItemId: EmrId,
  asOf: string = defaultCatalogDate
): ServiceItemPrice | undefined {
  return mockServiceItemPrices
    .filter((price) => {
      return (
        price.serviceItemId === serviceItemId &&
        price.effectiveFrom <= asOf &&
        (!price.effectiveTo || price.effectiveTo >= asOf)
      );
    })
    .sort((left, right) => right.effectiveFrom.localeCompare(left.effectiveFrom))[0];
}

export function getMockServiceCatalogEntry(
  serviceItemId: EmrId,
  asOf: string = defaultCatalogDate
): ServiceCatalogEntry | undefined {
  const item = getMockServiceItemById(serviceItemId);

  if (!item) {
    return undefined;
  }

  return {
    item,
    category: item.categoryId ? getMockServiceCategoryById(item.categoryId) : undefined,
    currentPrice: getMockCurrentServiceItemPrice(item.id, asOf),
  };
}

export function getMockServiceCatalogEntries(asOf: string = defaultCatalogDate): ServiceCatalogEntry[] {
  return mockServiceItems.map((item) => ({
    item,
    category: item.categoryId ? getMockServiceCategoryById(item.categoryId) : undefined,
    currentPrice: getMockCurrentServiceItemPrice(item.id, asOf),
  }));
}

export function getMockPermissionById(permissionId: PermissionId): PermissionSeed | undefined {
  return permissionById.get(permissionId);
}

export function getMockRoleById(roleId: RoleSeed["id"]): RoleSeed | undefined {
  return roleById.get(roleId);
}

export function getMockPermissionsForRole(roleId: RoleSeed["id"]): PermissionSeed[] {
  const role = getMockRoleById(roleId);

  if (!role) {
    return [];
  }

  return role.permissionIds
    .map((permissionId) => getMockPermissionById(permissionId))
    .filter((permission): permission is PermissionSeed => Boolean(permission));
}

export function getMockServiceCatalogConsistencyReport(
  asOf: string = defaultCatalogDate
): ServiceCatalogConsistencyReport {
  const categoryIds = new Set(mockServiceCategories.map((category) => category.id));
  const serviceItemIds = new Set(mockServiceItems.map((item) => item.id));
  const permissionIds = new Set(mockPermissionSeeds.map((permission) => permission.id));

  return {
    orphanServiceItemCategoryIds: mockServiceItems
      .filter((item) => item.categoryId && !categoryIds.has(item.categoryId))
      .map((item) => item.id),
    orphanPriceServiceItemIds: mockServiceItemPrices
      .filter((price) => !serviceItemIds.has(price.serviceItemId))
      .map((price) => price.serviceItemId),
    missingActiveBillablePriceItemIds: mockServiceItems
      .filter((item) => item.isActive && item.isBillable && !getMockCurrentServiceItemPrice(item.id, asOf))
      .map((item) => item.id),
    orphanOrderServiceItemIds: mockOrders
      .filter((order) => order.serviceItemId && !serviceItemIds.has(order.serviceItemId))
      .map((order) => order.id),
    orphanInvoiceLineServiceItemIds: mockInvoiceLines
      .filter((line) => line.serviceItemId && !serviceItemIds.has(line.serviceItemId))
      .map((line) => line.id),
    invoiceLinePriceMismatches: mockInvoiceLines.filter((line) => {
      if (!line.serviceItemId) {
        return false;
      }

      const price = getMockCurrentServiceItemPrice(line.serviceItemId, asOf);

      return Boolean(price && line.unitPrice !== price.price);
    }),
    rolePermissionGaps: mockRoleSeeds.flatMap((role) =>
      role.permissionIds
        .filter((permissionId) => !permissionIds.has(permissionId))
        .map((permissionId) => ({ roleId: role.id, permissionId }))
    ),
  };
}
