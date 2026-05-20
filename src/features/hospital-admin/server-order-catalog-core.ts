import {
  createMockWorkspacePermissionAdapter,
  resolveWorkspacePermission,
  type WorkspacePermissionAdapter,
  type WorkspacePermissionDenialReason,
} from "@/features/auth/permission-resolver";
import type { PermissionId, ServiceItemType, Species } from "@/types/emr-domain";

export type OrderCatalogAvailability = "active" | "paused" | "inactive";
export type OrderCatalogDestination = "lab" | "imaging" | "dispensing" | "treatment" | "billing_only" | "chart_only";
export type OrderCatalogSalesUnit = "per_order" | "per_each" | "per_day" | "per_frequency" | "per_ml" | "per_kg";
export type OrderCatalogPriceBasis = "unit_price" | "fixed_order_price" | "set_fixed_price" | "included_order_sum" | "range_price";

export type OrderCatalogItem = {
  id: string;
  workspaceId: string;
  standardOrderId: string;
  sourcePresetVersion: string;
  categoryGroup: ServiceItemType;
  categoryLabel: string;
  tCode?: string;
  tCodeLabel?: string;
  standardOrderName: string;
  inHospitalOrderName: string;
  billingName: string;
  aliases: string[];
  availabilityStatus: OrderCatalogAvailability;
  priceKrw: number;
  salesUnit: OrderCatalogSalesUnit;
  targetSpecies: Species[];
  defaultDestinationModule: OrderCatalogDestination;
  defaultTaskRequired: boolean;
  billingReflectionEnabled: boolean;
  careGuide?: string;
  careGuideDeliveryEnabled?: boolean;
  internalInstruction?: string;
  internalInstructionDeliveryEnabled?: boolean;
  taxIncluded: boolean;
  roundingRule: "as_is" | "ceil" | "floor" | "round";
  linkedLabItemIds: string[];
  linkedLabCategoryIds: string[];
  medicationMetadata?: MedicationOrderMetadata;
  vaccineMetadata?: VaccineOrderMetadata;
  pricingRule: OrderPricingRule;
  updatedAt: string;
};

export type OrderSet = {
  id: string;
  workspaceId: string;
  sourceSetVersion: string;
  setCategory: string;
  setName: string;
  billingName: string;
  availabilityStatus: OrderCatalogAvailability;
  amountBasis: Extract<OrderCatalogPriceBasis, "set_fixed_price" | "included_order_sum" | "range_price">;
  setPriceKrw: number;
  salesUnit: OrderCatalogSalesUnit;
  billingReflectionEnabled: boolean;
  targetSpecies: Species[];
  careGuide?: string;
  internalInstruction?: string;
  includedOrders: OrderSetItem[];
};

export type OrderSetItem = {
  id: string;
  childOrderId: string;
  sortOrder: number;
  defaultSelected: boolean;
  billingReflectionDefault: boolean;
  defaultQuantity: number;
  quantitySource: "fixed_one" | "preset_quantity" | "manual_at_apply";
  unitPriceSnapshotKrw: number;
};

export type LabTestCategory = {
  id: string;
  workspaceId: string;
  name: string;
  sortOrder: number;
};

export type LabTestItem = {
  id: string;
  workspaceId: string;
  categoryId: string;
  name: string;
  resultInputType: "number" | "text" | "select" | "positive_negative" | "grade";
  resultUnit?: string;
  sortOrder: number;
  availabilityStatus: OrderCatalogAvailability;
  savedResultUsageCount: number;
};

export type MedicationOrderMetadata = {
  autoDispenseQuantityEnabled: boolean;
  administrationDays: number;
  dailyFrequencyCode: string;
  frequencyDailyCount: number;
  doseBasis: "kg" | "head" | "ingredient_amount" | "total_amount" | "prescribed_quantity";
  doseAmount: number;
  doseAmountUnit: string;
  administrationRoute: "PO" | "IV" | "CRI" | "SC";
  dispenseUnit: string;
  dispenseRoundingRule: "as_is" | "ceil" | "floor" | "round" | "ceil_0_25" | "floor_0_25" | "ceil_0_5" | "floor_0_5";
  medicationInstruction: "after_meal" | "before_meal" | "with_meal" | "any_time";
  storageMethod: "room_temp" | "room_temp_light_protected" | "refrigerated" | "refrigerated_light_protected";
  ingredientKoreanName?: string;
  ingredientEnglishName?: string;
};

export type VaccineOrderMetadata = {
  vaccineTarget: Species[];
  vaccineClassification: "core" | "non_core" | "rabies" | "other";
  doseSequenceEnabled: boolean;
  doseSequenceLabel?: string;
  doseSequenceNumber?: number;
};

export type OrderPricingRule = {
  priceBasis: OrderCatalogPriceBasis;
  priceKrw: number;
  salesUnit: OrderCatalogSalesUnit;
  taxIncluded: boolean;
  roundingRule: string;
  billingReflectionEnabled: boolean;
};

export type ChartOrderCatalogSearchRow = {
  rowType: "individual" | "set";
  sourcePresetId: string;
  sourcePresetVersion: string;
  displayName: string;
  billingName: string;
  categoryGroup: ServiceItemType | "set";
  targetSpecies: Species[];
  appliedSnapshot: AppliedOrderSnapshot;
};

export type AppliedOrderSnapshot = {
  sourcePresetId: string;
  sourcePresetVersion: string;
  appliedDisplayName: string;
  appliedBillingName: string;
  appliedPriceKrw: number;
  appliedSalesUnit: OrderCatalogSalesUnit;
  appliedTaxIncluded: boolean;
  appliedAmountBasis: OrderCatalogPriceBasis;
  billingReflectionEnabled: boolean;
};

export type ExpandedOrderSetRow = {
  parentSetId: string;
  setItemId: string;
  childOrderId: string;
  sortOrder: number;
  quantity: number;
  billingReflectionEnabled: boolean;
  appliedSnapshot: AppliedOrderSnapshot;
};

export type LabTestItemDeleteLock = {
  deleteLocked: boolean;
  linkedOrderCount: number;
  savedResultUsageCount: number;
  lockReason?: "linked_order" | "saved_result";
};

export type OrderCatalogMutationInput =
  | { action: "create"; item: Omit<OrderCatalogItem, "id" | "updatedAt"> & { id?: string } }
  | { action: "update"; itemId: string; patch: Partial<OrderCatalogItem> }
  | { action: "pause"; itemId: string };

export type OrderCatalogGateway = {
  listAdminCatalog(input: { workspaceId: string }): Promise<{ ok: true; items: OrderCatalogItem[] }>;
  listChartSearch(input: { workspaceId: string }): Promise<{ ok: true; rows: ChartOrderCatalogSearchRow[] }>;
  mutateOrder(input: {
    actorUserId: string;
    mutation: OrderCatalogMutationInput;
    workspaceId: string;
  }): Promise<
    | { ok: true; item: OrderCatalogItem }
    | { ok: false; status: 400; error: "invalid_input" }
    | { ok: false; status: 404; denialReason: "order_not_found" }
  >;
  expandOrderSet(input: { orderSetId: string; workspaceId: string }): Promise<
    | { ok: true; parentSnapshot: AppliedOrderSnapshot; rows: ExpandedOrderSetRow[] }
    | { ok: false; status: 404; denialReason: "order_set_not_found" }
  >;
  getLabTestItemDeleteLock(input: { testItemId: string; workspaceId: string }): Promise<
    | { ok: true; lock: LabTestItemDeleteLock }
    | { ok: false; status: 404; denialReason: "lab_test_item_not_found" }
  >;
};

export type OrderCatalogResult<T> =
  | ({ ok: true; status: 200; enforcedBy: string } & T)
  | { ok: false; status: 401 | 403; denialReason: WorkspacePermissionDenialReason }
  | { ok: false; status: 400; error: "invalid_input" }
  | { ok: false; status: 404; denialReason: "order_not_found" | "order_set_not_found" | "lab_test_item_not_found" };

export async function listOrderCatalogForAdmin({
  actorUserId,
  gateway = createMockOrderCatalogGateway(),
  permissionAdapter = createDemoOrderCatalogPermissionAdapter(),
  workspaceId,
}: {
  actorUserId: string | null;
  gateway?: OrderCatalogGateway;
  permissionAdapter?: WorkspacePermissionAdapter;
  workspaceId: string;
}): Promise<OrderCatalogResult<{ items: OrderCatalogItem[] }>> {
  const permission = requirePermission(permissionAdapter, actorUserId, workspaceId, "service_catalog:view");
  if (!permission.allowed) return permission.denied;
  const result = await gateway.listAdminCatalog({ workspaceId });
  return { ok: true, status: 200, items: result.items, enforcedBy: "order-catalog-admin-read" };
}

export async function searchOrderCatalogForChart({
  actorUserId,
  gateway = createMockOrderCatalogGateway(),
  permissionAdapter = createDemoOrderCatalogPermissionAdapter(),
  workspaceId,
}: {
  actorUserId: string | null;
  gateway?: OrderCatalogGateway;
  permissionAdapter?: WorkspacePermissionAdapter;
  workspaceId: string;
}): Promise<OrderCatalogResult<{ rows: ChartOrderCatalogSearchRow[] }>> {
  const permission = requirePermission(permissionAdapter, actorUserId, workspaceId, "service_catalog:view");
  if (!permission.allowed) return permission.denied;
  const result = await gateway.listChartSearch({ workspaceId });
  return { ok: true, status: 200, rows: result.rows, enforcedBy: "order-catalog-chart-search" };
}

export async function mutateOrderCatalogItem({
  actorUserId,
  gateway = createMockOrderCatalogGateway(),
  input,
  permissionAdapter = createDemoOrderCatalogPermissionAdapter(),
  workspaceId,
}: {
  actorUserId: string | null;
  gateway?: OrderCatalogGateway;
  input: OrderCatalogMutationInput;
  permissionAdapter?: WorkspacePermissionAdapter;
  workspaceId: string;
}): Promise<OrderCatalogResult<{ item: OrderCatalogItem }>> {
  const permission = requirePermission(permissionAdapter, actorUserId, workspaceId, "service_catalog:manage");
  if (!permission.allowed) return permission.denied;
  const result = await gateway.mutateOrder({ actorUserId: actorUserId ?? "", mutation: input, workspaceId });
  if (!result.ok) return result;
  return { ok: true, status: 200, item: result.item, enforcedBy: "order-catalog-admin-mutation" };
}

export async function expandOrderSetForChart({
  actorUserId,
  gateway = createMockOrderCatalogGateway(),
  orderSetId,
  permissionAdapter = createDemoOrderCatalogPermissionAdapter(),
  workspaceId,
}: {
  actorUserId: string | null;
  gateway?: OrderCatalogGateway;
  orderSetId: string;
  permissionAdapter?: WorkspacePermissionAdapter;
  workspaceId: string;
}): Promise<OrderCatalogResult<{ parentSnapshot: AppliedOrderSnapshot; rows: ExpandedOrderSetRow[] }>> {
  const permission = requirePermission(permissionAdapter, actorUserId, workspaceId, "service_catalog:view");
  if (!permission.allowed) return permission.denied;
  const result = await gateway.expandOrderSet({ orderSetId, workspaceId });
  if (!result.ok) return result;
  return {
    ok: true,
    status: 200,
    parentSnapshot: result.parentSnapshot,
    rows: result.rows,
    enforcedBy: "order-set-expansion",
  };
}

export async function readLabTestItemDeleteLock({
  actorUserId,
  gateway = createMockOrderCatalogGateway(),
  permissionAdapter = createDemoOrderCatalogPermissionAdapter(),
  testItemId,
  workspaceId,
}: {
  actorUserId: string | null;
  gateway?: OrderCatalogGateway;
  permissionAdapter?: WorkspacePermissionAdapter;
  testItemId: string;
  workspaceId: string;
}): Promise<OrderCatalogResult<{ lock: LabTestItemDeleteLock }>> {
  const permission = requirePermission(permissionAdapter, actorUserId, workspaceId, "service_catalog:manage");
  if (!permission.allowed) return permission.denied;
  const result = await gateway.getLabTestItemDeleteLock({ testItemId, workspaceId });
  if (!result.ok) return result;
  return { ok: true, status: 200, lock: result.lock, enforcedBy: "lab-test-item-delete-lock" };
}

export function createOrderPricingSnapshot(item: OrderCatalogItem): AppliedOrderSnapshot {
  return {
    sourcePresetId: item.standardOrderId,
    sourcePresetVersion: item.sourcePresetVersion,
    appliedDisplayName: item.inHospitalOrderName,
    appliedBillingName: item.billingName,
    appliedPriceKrw: item.pricingRule.priceKrw,
    appliedSalesUnit: item.pricingRule.salesUnit,
    appliedTaxIncluded: item.pricingRule.taxIncluded,
    appliedAmountBasis: item.pricingRule.priceBasis,
    billingReflectionEnabled: item.pricingRule.billingReflectionEnabled,
  };
}

export function createMockOrderCatalogGateway(
  dataset: {
    items?: OrderCatalogItem[];
    labItems?: LabTestItem[];
    orderSets?: OrderSet[];
  } = {},
  now = new Date().toISOString()
): OrderCatalogGateway {
  const items = new Map((dataset.items ?? defaultOrderCatalogItems).map((item) => [item.id, { ...item }]));
  const labItems = dataset.labItems ?? defaultLabTestItems;
  const orderSets = dataset.orderSets ?? defaultOrderSets;

  return {
    async listAdminCatalog({ workspaceId }) {
      return {
        ok: true,
        items: [...items.values()].filter((item) => item.workspaceId === workspaceId).map(cloneItem),
      };
    },
    async listChartSearch({ workspaceId }) {
      const activeItems = [...items.values()]
        .filter((item) => item.workspaceId === workspaceId && item.availabilityStatus === "active")
        .map((item): ChartOrderCatalogSearchRow => ({
          rowType: "individual",
          sourcePresetId: item.standardOrderId,
          sourcePresetVersion: item.sourcePresetVersion,
          displayName: item.inHospitalOrderName,
          billingName: item.billingName,
          categoryGroup: item.categoryGroup,
          targetSpecies: item.targetSpecies,
          appliedSnapshot: createOrderPricingSnapshot(item),
        }));
      const activeSets = orderSets
        .filter((set) => set.workspaceId === workspaceId && set.availabilityStatus === "active")
        .map((set): ChartOrderCatalogSearchRow => ({
          rowType: "set",
          sourcePresetId: set.id,
          sourcePresetVersion: set.sourceSetVersion,
          displayName: set.setName,
          billingName: set.billingName,
          categoryGroup: "set",
          targetSpecies: set.targetSpecies,
          appliedSnapshot: createSetSnapshot(set),
        }));
      return { ok: true, rows: [...activeItems, ...activeSets] };
    },
    async mutateOrder({ mutation, workspaceId }) {
      if (mutation.action === "create") {
        const validation = validateOrderItem(mutation.item);
        if (!validation.valid) return { ok: false, status: 400, error: "invalid_input" };
        const id = mutation.item.id ?? `ord-${items.size + 1}`;
        const next = { ...mutation.item, id, updatedAt: now };
        items.set(id, next);
        return { ok: true, item: cloneItem(next) };
      }

      const current = items.get(mutation.itemId);
      if (!current || current.workspaceId !== workspaceId) {
        return { ok: false, status: 404, denialReason: "order_not_found" };
      }

      const next =
        mutation.action === "pause"
          ? { ...current, availabilityStatus: "paused" as const, updatedAt: now }
          : { ...current, ...mutation.patch, updatedAt: now };
      if (!validateOrderItem(next).valid) return { ok: false, status: 400, error: "invalid_input" };
      items.set(next.id, next);
      return { ok: true, item: cloneItem(next) };
    },
    async expandOrderSet({ orderSetId, workspaceId }) {
      const orderSet = orderSets.find((set) => set.id === orderSetId && set.workspaceId === workspaceId);
      if (!orderSet || orderSet.availabilityStatus !== "active") {
        return { ok: false, status: 404, denialReason: "order_set_not_found" };
      }
      const rows = orderSet.includedOrders
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((setItem) => {
          const child = items.get(setItem.childOrderId);
          if (!child) return null;
          return {
            parentSetId: orderSet.id,
            setItemId: setItem.id,
            childOrderId: child.id,
            sortOrder: setItem.sortOrder,
            quantity: setItem.defaultQuantity,
            billingReflectionEnabled: setItem.billingReflectionDefault,
            appliedSnapshot: createOrderPricingSnapshot(child),
          };
        })
        .filter((row): row is ExpandedOrderSetRow => Boolean(row));
      return { ok: true, parentSnapshot: createSetSnapshot(orderSet), rows };
    },
    async getLabTestItemDeleteLock({ testItemId, workspaceId }) {
      const item = labItems.find((labItem) => labItem.id === testItemId && labItem.workspaceId === workspaceId);
      if (!item) return { ok: false, status: 404, denialReason: "lab_test_item_not_found" };
      const linkedOrderCount = [...items.values()].filter((order) => order.linkedLabItemIds.includes(testItemId)).length;
      const deleteLocked = linkedOrderCount > 0 || item.savedResultUsageCount > 0;
      return {
        ok: true,
        lock: {
          deleteLocked,
          linkedOrderCount,
          savedResultUsageCount: item.savedResultUsageCount,
          lockReason: linkedOrderCount > 0 ? "linked_order" : item.savedResultUsageCount > 0 ? "saved_result" : undefined,
        },
      };
    },
  };
}

export function createDemoOrderCatalogPermissionAdapter() {
  return createMockWorkspacePermissionAdapter({
    users: [
      { id: "playwright-default-session", status: "active" },
      { id: "user-admin", status: "active" },
      { id: "user-vet", status: "active" },
    ],
    memberships: [
      { id: "membership-playwright-admin", workspaceId: "clair-demo", userId: "playwright-default-session", roles: ["hospital_admin"], status: "active" },
      { id: "membership-admin", workspaceId: "clair-demo", userId: "user-admin", roles: ["hospital_admin"], status: "active" },
      { id: "membership-vet", workspaceId: "clair-demo", userId: "user-vet", roles: ["vet"], status: "active" },
    ],
  });
}

function requirePermission(
  permissionAdapter: WorkspacePermissionAdapter,
  actorUserId: string | null,
  workspaceId: string,
  requiredPermission: PermissionId
) {
  const permission = resolveWorkspacePermission(permissionAdapter, {
    sessionUserId: actorUserId,
    workspaceId,
    requiredPermission,
  });
  if (permission.allowed) return { allowed: true as const };
  return {
    allowed: false as const,
    denied: {
      ok: false as const,
      status: permission.denialReason === "unauthenticated" ? (401 as const) : (403 as const),
      denialReason: permission.denialReason ?? "permission_missing",
    },
  };
}

function validateOrderItem(item: Partial<OrderCatalogItem>) {
  const valid =
    Boolean(item.standardOrderName?.trim()) &&
    Boolean(item.inHospitalOrderName?.trim()) &&
    Boolean(item.billingName?.trim()) &&
    typeof item.priceKrw === "number" &&
    item.priceKrw >= 0 &&
    item.pricingRule !== undefined &&
    item.pricingRule.priceKrw >= 0;
  return { valid };
}

function cloneItem(item: OrderCatalogItem): OrderCatalogItem {
  return {
    ...item,
    aliases: [...item.aliases],
    targetSpecies: [...item.targetSpecies],
    linkedLabItemIds: [...item.linkedLabItemIds],
    linkedLabCategoryIds: [...item.linkedLabCategoryIds],
    medicationMetadata: item.medicationMetadata ? { ...item.medicationMetadata } : undefined,
    vaccineMetadata: item.vaccineMetadata ? { ...item.vaccineMetadata, vaccineTarget: [...item.vaccineMetadata.vaccineTarget] } : undefined,
    pricingRule: { ...item.pricingRule },
  };
}

function createSetSnapshot(set: OrderSet): AppliedOrderSnapshot {
  return {
    sourcePresetId: set.id,
    sourcePresetVersion: set.sourceSetVersion,
    appliedDisplayName: set.setName,
    appliedBillingName: set.billingName,
    appliedPriceKrw: set.setPriceKrw,
    appliedSalesUnit: set.salesUnit,
    appliedTaxIncluded: true,
    appliedAmountBasis: set.amountBasis,
    billingReflectionEnabled: set.billingReflectionEnabled,
  };
}

const baseOrder: Omit<OrderCatalogItem, "id" | "standardOrderId" | "categoryGroup" | "categoryLabel" | "standardOrderName" | "inHospitalOrderName" | "billingName" | "priceKrw" | "defaultDestinationModule" | "pricingRule"> = {
  workspaceId: "clair-demo",
  sourcePresetVersion: "v3",
  aliases: [],
  availabilityStatus: "active",
  salesUnit: "per_each",
  targetSpecies: ["dog", "cat", "other"],
  defaultTaskRequired: true,
  billingReflectionEnabled: true,
  taxIncluded: true,
  roundingRule: "as_is",
  linkedLabItemIds: [],
  linkedLabCategoryIds: [],
  updatedAt: "2026-05-20T00:00:00.000Z",
};

const defaultOrderCatalogItems: OrderCatalogItem[] = [
  {
    ...baseOrder,
    id: "ord-lab-cbc-baso",
    standardOrderId: "std-ord-lab-cbc-baso",
    categoryGroup: "lab",
    categoryLabel: "CBC검사",
    tCode: "T04",
    tCodeLabel: "임상",
    standardOrderName: "[CBC 검사] #BASO",
    inHospitalOrderName: "[CBC 검사] #BASO",
    billingName: "CBC 검사 BASO",
    aliases: ["BASO", "CBC"],
    priceKrw: 12000,
    defaultDestinationModule: "lab",
    linkedLabItemIds: ["labitem-cbc-baso"],
    linkedLabCategoryIds: ["labcat-cbc"],
    pricingRule: { priceBasis: "unit_price", priceKrw: 12000, salesUnit: "per_each", taxIncluded: true, roundingRule: "as_is", billingReflectionEnabled: true },
  },
  {
    ...baseOrder,
    id: "ord-med-maropitant",
    standardOrderId: "std-ord-med-maropitant",
    categoryGroup: "medication",
    categoryLabel: "처방",
    standardOrderName: "Maropitant 16mg T",
    inHospitalOrderName: "Maropitant 16mg T",
    billingName: "항구토제",
    aliases: ["세레니아", "구토억제"],
    priceKrw: 4500,
    defaultDestinationModule: "dispensing",
    medicationMetadata: {
      autoDispenseQuantityEnabled: true,
      administrationDays: 3,
      dailyFrequencyCode: "sid",
      frequencyDailyCount: 1,
      doseBasis: "prescribed_quantity",
      doseAmount: 1,
      doseAmountUnit: "T",
      administrationRoute: "PO",
      dispenseUnit: "T",
      dispenseRoundingRule: "ceil_0_5",
      medicationInstruction: "after_meal",
      storageMethod: "room_temp",
      ingredientEnglishName: "Maropitant",
    },
    pricingRule: { priceBasis: "unit_price", priceKrw: 4500, salesUnit: "per_each", taxIncluded: true, roundingRule: "as_is", billingReflectionEnabled: true },
  },
  {
    ...baseOrder,
    id: "ord-vaccine-cat-core",
    standardOrderId: "std-ord-vaccine-cat-core",
    categoryGroup: "treatment",
    categoryLabel: "예방",
    standardOrderName: "고양이 종합백신",
    inHospitalOrderName: "고양이 종합백신",
    billingName: "고양이 종합백신",
    priceKrw: 45000,
    targetSpecies: ["cat"],
    defaultDestinationModule: "treatment",
    vaccineMetadata: {
      vaccineTarget: ["cat"],
      vaccineClassification: "core",
      doseSequenceEnabled: true,
      doseSequenceLabel: "1차",
      doseSequenceNumber: 1,
    },
    pricingRule: { priceBasis: "fixed_order_price", priceKrw: 45000, salesUnit: "per_each", taxIncluded: true, roundingRule: "as_is", billingReflectionEnabled: true },
  },
  {
    ...baseOrder,
    id: "ord-paused-example",
    standardOrderId: "std-ord-paused-example",
    categoryGroup: "lab",
    categoryLabel: "미사용",
    standardOrderName: "일시중지 예시",
    inHospitalOrderName: "일시중지 예시",
    billingName: "일시중지 예시",
    availabilityStatus: "paused",
    priceKrw: 0,
    defaultDestinationModule: "lab",
    pricingRule: { priceBasis: "unit_price", priceKrw: 0, salesUnit: "per_each", taxIncluded: true, roundingRule: "as_is", billingReflectionEnabled: false },
  },
];

const defaultOrderSets: OrderSet[] = [
  {
    id: "set-vomit-basic",
    workspaceId: "clair-demo",
    sourceSetVersion: "v1",
    setCategory: "내복약 조제 세트",
    setName: "구토 기본 세트",
    billingName: "구토 기본 세트",
    availabilityStatus: "active",
    amountBasis: "included_order_sum",
    setPriceKrw: 0,
    salesUnit: "per_each",
    billingReflectionEnabled: true,
    targetSpecies: ["dog", "cat", "other"],
    includedOrders: [
      { id: "setitem-vomit-baso", childOrderId: "ord-lab-cbc-baso", sortOrder: 10, defaultSelected: true, billingReflectionDefault: true, defaultQuantity: 1, quantitySource: "fixed_one", unitPriceSnapshotKrw: 12000 },
      { id: "setitem-vomit-maropitant", childOrderId: "ord-med-maropitant", sortOrder: 20, defaultSelected: true, billingReflectionDefault: true, defaultQuantity: 3, quantitySource: "preset_quantity", unitPriceSnapshotKrw: 4500 },
    ],
  },
];

const defaultLabTestItems: LabTestItem[] = [
  {
    id: "labitem-cbc-baso",
    workspaceId: "clair-demo",
    categoryId: "labcat-cbc",
    name: "BASO",
    resultInputType: "number",
    resultUnit: "%",
    sortOrder: 60,
    availabilityStatus: "active",
    savedResultUsageCount: 2,
  },
];
