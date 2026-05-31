import {
  createMockWorkspacePermissionAdapter,
  resolveWorkspacePermission,
  type WorkspacePermissionAdapter,
  type WorkspacePermissionDenialReason,
} from "@/features/auth/permission-resolver";
import {
  emitLiveMutationAuditEvent,
  type LiveMutationAuditOptions,
} from "@/features/audit/server-mutation-audit-core";
import type {
  PermissionId,
  ServiceItemType,
  Species,
} from "@/types/emr-domain";

export type OrderCatalogAvailability = "active" | "paused" | "inactive";
export type OrderCatalogDestination =
  | "lab"
  | "imaging"
  | "dispensing"
  | "treatment"
  | "billing_only"
  | "chart_only";
export type OrderCatalogSalesUnit =
  | "per_order"
  | "per_each"
  | "per_day"
  | "per_frequency"
  | "per_ml"
  | "per_kg";
export type OrderCatalogPriceBasis =
  | "unit_price"
  | "fixed_order_price"
  | "set_fixed_price"
  | "included_order_sum"
  | "range_price";
export type SystemOrderPresetStatus = "active" | "deprecated" | "hidden";
export type OrderCatalogCustomizationState =
  | "unmodified"
  | "customized"
  | "detached";
export type OrderCatalogPresetMergeStatus =
  | "current"
  | "update_available"
  | "conflict"
  | "detached";

export type OrderCatalogItem = {
  id: string;
  workspaceId: string;
  standardOrderId: string;
  sourcePresetVersion: string;
  initialImportedPresetVersion?: string;
  lastAutoMergedPresetVersion?: string;
  customizationState?: OrderCatalogCustomizationState;
  customizedFields?: string[];
  lastCustomizedAt?: string;
  lastCustomizedByUserId?: string;
  presetMergeStatus?: OrderCatalogPresetMergeStatus;
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

export type SystemOrderPreset = {
  presetId: string;
  presetVersion: string;
  presetStatus: SystemOrderPresetStatus;
  defaultCatalogItemId?: string;
  categoryGroup: ServiceItemType;
  categoryLabel: string;
  tCode?: string;
  tCodeLabel?: string;
  standardOrderName: string;
  defaultInHospitalOrderName: string;
  defaultBillingName: string;
  aliases: string[];
  defaultAvailabilityStatus: OrderCatalogAvailability;
  defaultPriceKrw: number;
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
};

export type WorkspaceCatalogPresetMergeResult = {
  items: OrderCatalogItem[];
  createdCount: number;
  updatedCount: number;
  preservedCount: number;
};

export type OrderSet = {
  id: string;
  workspaceId: string;
  sourceSetVersion: string;
  setCategory: string;
  setName: string;
  billingName: string;
  availabilityStatus: OrderCatalogAvailability;
  amountBasis: Extract<
    OrderCatalogPriceBasis,
    "set_fixed_price" | "included_order_sum" | "range_price"
  >;
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
  doseBasis:
    | "kg"
    | "head"
    | "ingredient_amount"
    | "total_amount"
    | "prescribed_quantity";
  doseAmount: number;
  doseAmountUnit: string;
  administrationRoute: "PO" | "IV" | "CRI" | "SC";
  dispenseUnit: string;
  dispenseRoundingRule:
    | "as_is"
    | "ceil"
    | "floor"
    | "round"
    | "ceil_0_25"
    | "floor_0_25"
    | "ceil_0_5"
    | "floor_0_5";
  medicationInstruction:
    | "after_meal"
    | "before_meal"
    | "with_meal"
    | "any_time";
  storageMethod:
    | "room_temp"
    | "room_temp_light_protected"
    | "refrigerated"
    | "refrigerated_light_protected";
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
  workspaceCatalogItemId?: string;
  appliedStandardOrderName?: string;
  appliedDisplayName: string;
  appliedBillingName: string;
  appliedPriceKrw: number;
  appliedSalesUnit: OrderCatalogSalesUnit;
  appliedTaxIncluded: boolean;
  appliedAmountBasis: OrderCatalogPriceBasis;
  appliedTargetSpecies?: Species[];
  appliedCareGuide?: string;
  appliedInternalInstruction?: string;
  appliedDestinationModule?: OrderCatalogDestination;
  appliedTaskRequired?: boolean;
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
  | {
      action: "create";
      item: Omit<OrderCatalogItem, "id" | "updatedAt"> & { id?: string };
    }
  | { action: "update"; itemId: string; patch: Partial<OrderCatalogItem> }
  | { action: "pause"; itemId: string };

export type OrderCatalogGateway = {
  listAdminCatalog(input: {
    workspaceId: string;
  }): Promise<{ ok: true; items: OrderCatalogItem[] }>;
  listChartSearch(input: {
    workspaceId: string;
  }): Promise<{ ok: true; rows: ChartOrderCatalogSearchRow[] }>;
  mutateOrder(input: {
    actorUserId: string;
    mutation: OrderCatalogMutationInput;
    workspaceId: string;
  }): Promise<
    | { ok: true; item: OrderCatalogItem }
    | { ok: false; status: 400; error: "invalid_input" }
    | { ok: false; status: 500; error: "db_write_failed" }
    | { ok: false; status: 404; denialReason: "order_not_found" }
  >;
  expandOrderSet(input: { orderSetId: string; workspaceId: string }): Promise<
    | {
        ok: true;
        parentSnapshot: AppliedOrderSnapshot;
        rows: ExpandedOrderSetRow[];
      }
    | { ok: false; status: 404; denialReason: "order_set_not_found" }
  >;
  getLabTestItemDeleteLock(input: {
    testItemId: string;
    workspaceId: string;
  }): Promise<
    | { ok: true; lock: LabTestItemDeleteLock }
    | { ok: false; status: 404; denialReason: "lab_test_item_not_found" }
  >;
};

export type SupabaseOrderCatalogRpcClient = {
  rpc(
    functionName: "clair_list_order_catalog_chart_search",
    args: { p_workspace_id: string },
  ): Promise<{ data: unknown; error: { message?: string } | null }>;
  from?: (table: "order_catalog_items") => SupabaseOrderCatalogItemsQueryBuilder;
};

export type OrderCatalogResult<T> =
  | ({ ok: true; status: 200; enforcedBy: string } & T)
  | {
      ok: false;
      status: 401 | 403;
      denialReason: WorkspacePermissionDenialReason;
    }
  | { ok: false; status: 400; error: "invalid_input" }
  | { ok: false; status: 500; error: "db_write_failed" }
  | {
      ok: false;
      status: 404;
      denialReason:
        | "order_not_found"
        | "order_set_not_found"
        | "lab_test_item_not_found";
    }
  | { ok: false; status: 500; error: "db_write_failed" };

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
  const permission = requirePermission(
    permissionAdapter,
    actorUserId,
    workspaceId,
    "service_catalog:view",
  );
  if (!permission.allowed) return permission.denied;
  const result = await gateway.listAdminCatalog({ workspaceId });
  return {
    ok: true,
    status: 200,
    items: result.items,
    enforcedBy: "order-catalog-admin-read",
  };
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
  const permission = requirePermission(
    permissionAdapter,
    actorUserId,
    workspaceId,
    "service_catalog:view",
  );
  if (!permission.allowed) return permission.denied;
  const result = await gateway.listChartSearch({ workspaceId });
  return {
    ok: true,
    status: 200,
    rows: result.rows,
    enforcedBy: "order-catalog-chart-search",
  };
}

export async function mutateOrderCatalogItem({
  actorUserId,
  auditGateway,
  auditNow,
  auditRequestId,
  gateway = createMockOrderCatalogGateway(),
  input,
  permissionAdapter = createDemoOrderCatalogPermissionAdapter(),
  workspaceId,
}: {
  actorUserId: string | null;
  auditGateway?: LiveMutationAuditOptions["auditGateway"];
  auditNow?: LiveMutationAuditOptions["auditNow"];
  auditRequestId?: LiveMutationAuditOptions["auditRequestId"];
  gateway?: OrderCatalogGateway;
  input: OrderCatalogMutationInput;
  permissionAdapter?: WorkspacePermissionAdapter;
  workspaceId: string;
}): Promise<OrderCatalogResult<{ item: OrderCatalogItem }>> {
  const permission = requirePermission(
    permissionAdapter,
    actorUserId,
    workspaceId,
    "service_catalog:manage",
  );
  if (!permission.allowed) return permission.denied;
  const beforeItem = await readCatalogItemBeforeMutation({
    gateway,
    input,
    workspaceId,
  });
  const result = await gateway.mutateOrder({
    actorUserId: actorUserId ?? "",
    mutation: input,
    workspaceId,
  });
  if (!result.ok) return result;
  const audit = await emitLiveMutationAuditEvent({
    auditGateway,
    auditNow,
    input: {
      workspaceId,
      actorUserId,
      eventType: orderCatalogAuditEventType(input),
      targetType: "order_catalog_item",
      targetId: result.item.id,
      requestId: auditRequestId,
      before: beforeItem ? summarizeCatalogAuditItem(beforeItem) : {},
      after: summarizeCatalogAuditItem(result.item),
      metadata: {
        action: input.action,
        changedFields: orderCatalogChangedFields(input),
        source: "order-catalog-admin-mutation",
      },
    },
  });
  if (!audit.ok) return { ok: false, status: 500, error: "db_write_failed" };
  return {
    ok: true,
    status: 200,
    item: result.item,
    enforcedBy: "order-catalog-admin-mutation",
  };
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
}): Promise<
  OrderCatalogResult<{
    parentSnapshot: AppliedOrderSnapshot;
    rows: ExpandedOrderSetRow[];
  }>
> {
  const permission = requirePermission(
    permissionAdapter,
    actorUserId,
    workspaceId,
    "service_catalog:view",
  );
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
  const permission = requirePermission(
    permissionAdapter,
    actorUserId,
    workspaceId,
    "service_catalog:manage",
  );
  if (!permission.allowed) return permission.denied;
  const result = await gateway.getLabTestItemDeleteLock({
    testItemId,
    workspaceId,
  });
  if (!result.ok) return result;
  return {
    ok: true,
    status: 200,
    lock: result.lock,
    enforcedBy: "lab-test-item-delete-lock",
  };
}

export function createOrderPricingSnapshot(
  item: OrderCatalogItem,
): AppliedOrderSnapshot {
  return {
    sourcePresetId: item.standardOrderId,
    sourcePresetVersion: item.sourcePresetVersion,
    workspaceCatalogItemId: item.id,
    appliedStandardOrderName: item.standardOrderName,
    appliedDisplayName: item.inHospitalOrderName,
    appliedBillingName: item.billingName,
    appliedPriceKrw: item.pricingRule.priceKrw,
    appliedSalesUnit: item.pricingRule.salesUnit,
    appliedTaxIncluded: item.pricingRule.taxIncluded,
    appliedAmountBasis: item.pricingRule.priceBasis,
    appliedTargetSpecies: [...item.targetSpecies],
    appliedCareGuide: item.careGuide,
    appliedInternalInstruction: item.internalInstruction,
    appliedDestinationModule: item.defaultDestinationModule,
    appliedTaskRequired: item.defaultTaskRequired,
    billingReflectionEnabled: item.pricingRule.billingReflectionEnabled,
  };
}

export function createWorkspaceOrderCatalogItemFromPreset({
  createId = createCatalogItemId,
  now,
  preset,
  workspaceId,
}: {
  createId?: (input: {
    preset: SystemOrderPreset;
    workspaceId: string;
  }) => string;
  now: string;
  preset: SystemOrderPreset;
  workspaceId: string;
}): OrderCatalogItem {
  return {
    id: createId({ preset, workspaceId }),
    workspaceId,
    standardOrderId: preset.presetId,
    sourcePresetVersion: preset.presetVersion,
    initialImportedPresetVersion: preset.presetVersion,
    lastAutoMergedPresetVersion: preset.presetVersion,
    customizationState: "unmodified",
    customizedFields: [],
    presetMergeStatus: "current",
    ...copyPresetFields(preset),
    updatedAt: now,
  };
}

export function initializeWorkspaceOrderCatalogFromPresets({
  createId = createCatalogItemId,
  existingItems = [],
  now,
  presets,
  workspaceId,
}: {
  createId?: (input: {
    preset: SystemOrderPreset;
    workspaceId: string;
  }) => string;
  existingItems?: OrderCatalogItem[];
  now: string;
  presets: SystemOrderPreset[];
  workspaceId: string;
}): WorkspaceCatalogPresetMergeResult {
  const workspaceItems = existingItems
    .filter((item) => item.workspaceId === workspaceId)
    .map(cloneItem);
  const outOfWorkspaceItems = existingItems
    .filter((item) => item.workspaceId !== workspaceId)
    .map(cloneItem);
  const itemsByPresetId = new Map(
    workspaceItems.map((item) => [item.standardOrderId, item]),
  );
  let createdCount = 0;
  let updatedCount = 0;
  let preservedCount = 0;

  for (const preset of presets) {
    const current = itemsByPresetId.get(preset.presetId);
    if (!current) {
      if (preset.presetStatus !== "active") continue;
      const created = createWorkspaceOrderCatalogItemFromPreset({
        createId,
        now,
        preset,
        workspaceId,
      });
      itemsByPresetId.set(preset.presetId, created);
      createdCount += 1;
      continue;
    }

    if (preset.presetStatus === "hidden") {
      preservedCount += 1;
      continue;
    }

    const customizationState = getCustomizationState(current);
    if (
      preset.presetStatus === "deprecated" ||
      customizationState !== "unmodified"
    ) {
      itemsByPresetId.set(preset.presetId, {
        ...current,
        presetMergeStatus:
          customizationState === "detached" ? "detached" : "update_available",
      });
      preservedCount += 1;
      continue;
    }

    if (
      current.sourcePresetVersion === preset.presetVersion &&
      current.lastAutoMergedPresetVersion === preset.presetVersion
    ) {
      preservedCount += 1;
      continue;
    }

    itemsByPresetId.set(preset.presetId, {
      ...current,
      ...copyPresetFields(preset),
      sourcePresetVersion: preset.presetVersion,
      initialImportedPresetVersion:
        current.initialImportedPresetVersion ?? current.sourcePresetVersion,
      lastAutoMergedPresetVersion: preset.presetVersion,
      customizationState: "unmodified",
      customizedFields: [],
      presetMergeStatus: "current",
      updatedAt: now,
    });
    updatedCount += 1;
  }

  return {
    items: [...outOfWorkspaceItems, ...itemsByPresetId.values()].map(cloneItem),
    createdCount,
    updatedCount,
    preservedCount,
  };
}

export function createMockOrderCatalogGateway(
  dataset: {
    items?: OrderCatalogItem[];
    labItems?: LabTestItem[];
    orderSets?: OrderSet[];
    systemPresets?: SystemOrderPreset[];
    workspaceId?: string;
  } = {},
  now = new Date().toISOString(),
): OrderCatalogGateway {
  const seedItems =
    dataset.items ??
    (dataset.systemPresets
      ? initializeWorkspaceOrderCatalogFromPresets({
          existingItems: [],
          now,
          presets: dataset.systemPresets,
          workspaceId: dataset.workspaceId ?? "clair-demo",
        }).items
      : defaultOrderCatalogItems);
  const items = new Map(seedItems.map((item) => [item.id, cloneItem(item)]));
  const labItems = dataset.labItems ?? defaultLabTestItems;
  const orderSets = dataset.orderSets ?? defaultOrderSets;

  return {
    async listAdminCatalog({ workspaceId }) {
      return {
        ok: true,
        items: [...items.values()]
          .filter((item) => item.workspaceId === workspaceId)
          .map(cloneItem),
      };
    },
    async listChartSearch({ workspaceId }) {
      const activeItems = [...items.values()]
        .filter(
          (item) =>
            item.workspaceId === workspaceId &&
            item.availabilityStatus === "active",
        )
        .map(
          (item): ChartOrderCatalogSearchRow => ({
            rowType: "individual",
            sourcePresetId: item.standardOrderId,
            sourcePresetVersion: item.sourcePresetVersion,
            displayName: item.inHospitalOrderName,
            billingName: item.billingName,
            categoryGroup: item.categoryGroup,
            targetSpecies: item.targetSpecies,
            appliedSnapshot: createOrderPricingSnapshot(item),
          }),
        );
      const activeSets = orderSets
        .filter(
          (set) =>
            set.workspaceId === workspaceId &&
            set.availabilityStatus === "active",
        )
        .map(
          (set): ChartOrderCatalogSearchRow => ({
            rowType: "set",
            sourcePresetId: set.id,
            sourcePresetVersion: set.sourceSetVersion,
            displayName: set.setName,
            billingName: set.billingName,
            categoryGroup: "set",
            targetSpecies: set.targetSpecies,
            appliedSnapshot: createSetSnapshot(set),
          }),
        );
      return { ok: true, rows: [...activeItems, ...activeSets] };
    },
    async mutateOrder({ actorUserId, mutation, workspaceId }) {
      if (mutation.action === "create") {
        const validation = validateOrderItem(mutation.item);
        if (!validation.valid)
          return { ok: false, status: 400, error: "invalid_input" };
        const id = mutation.item.id ?? `ord-${items.size + 1}`;
        const next = markCatalogItemCustomized(
          {
            ...mutation.item,
            id,
            customizationState: mutation.item.customizationState ?? "detached",
            customizedFields: mutation.item.customizedFields ?? ["*"],
            presetMergeStatus: mutation.item.presetMergeStatus ?? "detached",
            updatedAt: now,
          },
          ["*"],
          now,
          actorUserId,
        );
        items.set(id, next);
        return { ok: true, item: cloneItem(next) };
      }

      const current = items.get(mutation.itemId);
      if (!current || current.workspaceId !== workspaceId) {
        return { ok: false, status: 404, denialReason: "order_not_found" };
      }

      const next =
        mutation.action === "pause"
          ? markCatalogItemCustomized(
              {
                ...current,
                availabilityStatus: "paused" as const,
                updatedAt: now,
              },
              ["availabilityStatus"],
              now,
              actorUserId,
            )
          : markCatalogItemCustomized(
              { ...current, ...mutation.patch, updatedAt: now },
              Object.keys(mutation.patch),
              now,
              actorUserId,
            );
      if (!validateOrderItem(next).valid)
        return { ok: false, status: 400, error: "invalid_input" };
      items.set(next.id, next);
      return { ok: true, item: cloneItem(next) };
    },
    async expandOrderSet({ orderSetId, workspaceId }) {
      const orderSet = orderSets.find(
        (set) => set.id === orderSetId && set.workspaceId === workspaceId,
      );
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
      const item = labItems.find(
        (labItem) =>
          labItem.id === testItemId && labItem.workspaceId === workspaceId,
      );
      if (!item)
        return {
          ok: false,
          status: 404,
          denialReason: "lab_test_item_not_found",
        };
      const linkedOrderCount = [...items.values()].filter((order) =>
        order.linkedLabItemIds.includes(testItemId),
      ).length;
      const deleteLocked =
        linkedOrderCount > 0 || item.savedResultUsageCount > 0;
      return {
        ok: true,
        lock: {
          deleteLocked,
          linkedOrderCount,
          savedResultUsageCount: item.savedResultUsageCount,
          lockReason:
            linkedOrderCount > 0
              ? "linked_order"
              : item.savedResultUsageCount > 0
                ? "saved_result"
                : undefined,
        },
      };
    },
  };
}

const demoOrderCatalogGateways = new Map<string, OrderCatalogGateway>();

export function getDemoOrderCatalogGateway(sessionId = "shared") {
  const key = sessionId.trim() || "shared";
  const current = demoOrderCatalogGateways.get(key);
  if (current) return current;

  const next = createMockOrderCatalogGateway();
  demoOrderCatalogGateways.set(key, next);
  return next;
}

type SupabaseOrderCatalogQueryResult<Row> = PromiseLike<{
  data: Row[] | Row | null;
  error: { message?: string } | null;
}>;

type SupabaseOrderCatalogItemsQueryBuilder = {
  eq(column: string, value: string): SupabaseOrderCatalogItemsQueryBuilder;
  insert(value: Record<string, unknown>): SupabaseOrderCatalogItemsQueryBuilder;
  order(
    column: string,
    options?: { ascending?: boolean },
  ): SupabaseOrderCatalogItemsQueryBuilder;
  select(columns: string): SupabaseOrderCatalogItemsQueryBuilder;
  single(): SupabaseOrderCatalogQueryResult<OrderCatalogItemDbRow>;
  update(value: Record<string, unknown>): SupabaseOrderCatalogItemsQueryBuilder;
  then<
    TResult1 = {
      data: OrderCatalogItemDbRow[] | null;
      error: { message?: string } | null;
    },
    TResult2 = never,
  >(
    onfulfilled?:
      | ((
          value: {
            data: OrderCatalogItemDbRow[] | null;
            error: { message?: string } | null;
          },
        ) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2>;
};

type OrderCatalogItemDbRow = {
  id: string;
  workspace_id: string;
  standard_order_id: string;
  source_preset_version: string;
  initial_imported_preset_version?: string | null;
  last_auto_merged_preset_version?: string | null;
  customization_state?: string | null;
  customized_fields?: string[] | null;
  last_customized_at?: string | null;
  last_customized_by_user_id?: string | null;
  preset_merge_status?: string | null;
  category_group: string;
  category_label: string;
  t_code?: string | null;
  t_code_label?: string | null;
  standard_order_name: string;
  in_hospital_order_name: string;
  billing_name: string;
  aliases?: string[] | null;
  availability_status: string;
  price_krw: number;
  sales_unit: string;
  target_species?: string[] | null;
  default_destination_module: string;
  default_task_required: boolean;
  billing_reflection_enabled: boolean;
  care_guide?: string | null;
  care_guide_delivery_enabled?: boolean | null;
  internal_instruction?: string | null;
  internal_instruction_delivery_enabled?: boolean | null;
  tax_included: boolean;
  rounding_rule: string;
  pricing_rule?: Record<string, unknown> | null;
  medication_metadata?: Record<string, unknown> | null;
  vaccine_metadata?: Record<string, unknown> | null;
  created_at?: string;
  updated_at: string;
};

const orderCatalogItemSelectColumns = [
  "id",
  "workspace_id",
  "standard_order_id",
  "source_preset_version",
  "initial_imported_preset_version",
  "last_auto_merged_preset_version",
  "customization_state",
  "customized_fields",
  "last_customized_at",
  "last_customized_by_user_id",
  "preset_merge_status",
  "category_group",
  "category_label",
  "t_code",
  "t_code_label",
  "standard_order_name",
  "in_hospital_order_name",
  "billing_name",
  "aliases",
  "availability_status",
  "price_krw",
  "sales_unit",
  "target_species",
  "default_destination_module",
  "default_task_required",
  "billing_reflection_enabled",
  "care_guide",
  "care_guide_delivery_enabled",
  "internal_instruction",
  "internal_instruction_delivery_enabled",
  "tax_included",
  "rounding_rule",
  "pricing_rule",
  "medication_metadata",
  "vaccine_metadata",
  "created_at",
  "updated_at",
].join(", ");

export function createSupabaseOrderCatalogGateway(
  client: SupabaseOrderCatalogRpcClient,
): OrderCatalogGateway {
  return {
    async listAdminCatalog({ workspaceId }) {
      const table = getSupabaseOrderCatalogTable(client);
      if (!table) return { ok: true, items: [] };
      const { data, error } = await table
        .select(orderCatalogItemSelectColumns)
        .eq("workspace_id", workspaceId)
        .order("category_group", { ascending: true })
        .order("standard_order_name", { ascending: true });
      if (error) return { ok: true, items: [] };
      return {
        ok: true,
        items: mapOrderCatalogDbRows(data),
      };
    },
    async listChartSearch({ workspaceId }) {
      const { data, error } = await client.rpc(
        "clair_list_order_catalog_chart_search",
        { p_workspace_id: workspaceId },
      );
      if (error) return { ok: true, rows: [] };
      return { ok: true, rows: mapChartSearchRows(data) };
    },
    async mutateOrder({ actorUserId, mutation, workspaceId }) {
      const table = getSupabaseOrderCatalogTable(client);
      if (!table) return { ok: false, status: 500, error: "db_write_failed" };

      if (mutation.action === "create") {
        const validation = validateOrderItem(mutation.item);
        if (!validation.valid)
          return { ok: false, status: 400, error: "invalid_input" };
        const now = new Date().toISOString();
        const id = mutation.item.id ?? `ord-${crypto.randomUUID()}`;
        const next = markCatalogItemCustomized(
          {
            ...mutation.item,
            id,
            customizationState: mutation.item.customizationState ?? "detached",
            customizedFields: mutation.item.customizedFields ?? ["*"],
            presetMergeStatus: mutation.item.presetMergeStatus ?? "detached",
            updatedAt: now,
          },
          ["*"],
          now,
          actorUserId,
        );
        const { data, error } = await table
          .insert(orderCatalogItemToDbRow(next))
          .select(orderCatalogItemSelectColumns)
          .single();
        if (error) return { ok: false, status: 500, error: "db_write_failed" };
        const item = mapOrderCatalogDbRow(data);
        return item
          ? { ok: true, item }
          : { ok: false, status: 500, error: "db_write_failed" };
      }

      const current = await readSupabaseOrderCatalogItem({
        client,
        itemId: mutation.itemId,
        workspaceId,
      });
      if (!current) {
        return { ok: false, status: 404, denialReason: "order_not_found" };
      }

      const now = new Date().toISOString();
      const changedFields =
        mutation.action === "pause"
          ? ["availabilityStatus"]
          : Object.keys(mutation.patch);
      const next =
        mutation.action === "pause"
          ? markCatalogItemCustomized(
              {
                ...current,
                availabilityStatus: "paused",
                updatedAt: now,
              },
              changedFields,
              now,
              actorUserId,
            )
          : markCatalogItemCustomized(
              { ...current, ...mutation.patch, updatedAt: now },
              changedFields,
              now,
              actorUserId,
            );
      if (!validateOrderItem(next).valid)
        return { ok: false, status: 400, error: "invalid_input" };
      const { data, error } = await table
        .update(orderCatalogItemToDbRow(next))
        .eq("workspace_id", workspaceId)
        .eq("id", next.id)
        .select(orderCatalogItemSelectColumns)
        .single();
      if (error) return { ok: false, status: 500, error: "db_write_failed" };
      const item = mapOrderCatalogDbRow(data);
      return item
        ? { ok: true, item }
        : { ok: false, status: 500, error: "db_write_failed" };
    },
    async expandOrderSet() {
      return { ok: false, status: 404, denialReason: "order_set_not_found" };
    },
    async getLabTestItemDeleteLock() {
      return {
        ok: false,
        status: 404,
        denialReason: "lab_test_item_not_found",
      };
    },
  };
}

function getSupabaseOrderCatalogTable(client: SupabaseOrderCatalogRpcClient) {
  return client.from?.("order_catalog_items");
}

async function readSupabaseOrderCatalogItem({
  client,
  itemId,
  workspaceId,
}: {
  client: SupabaseOrderCatalogRpcClient;
  itemId: string;
  workspaceId: string;
}) {
  const table = getSupabaseOrderCatalogTable(client);
  if (!table) return null;
  const { data, error } = await table
    .select(orderCatalogItemSelectColumns)
    .eq("workspace_id", workspaceId)
    .eq("id", itemId)
    .single();
  if (error) return null;
  return mapOrderCatalogDbRow(data);
}

function mapOrderCatalogDbRows(value: unknown): OrderCatalogItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(mapOrderCatalogDbRow)
    .filter((item): item is OrderCatalogItem => Boolean(item));
}

function mapOrderCatalogDbRow(value: unknown): OrderCatalogItem | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<OrderCatalogItemDbRow>;
  if (
    !row.id ||
    !row.workspace_id ||
    !row.standard_order_id ||
    !row.source_preset_version ||
    !row.category_group ||
    !row.category_label ||
    !row.standard_order_name ||
    !row.in_hospital_order_name ||
    !row.billing_name ||
    !row.availability_status ||
    typeof row.price_krw !== "number" ||
    !row.sales_unit ||
    !row.default_destination_module ||
    typeof row.default_task_required !== "boolean" ||
    typeof row.billing_reflection_enabled !== "boolean" ||
    typeof row.tax_included !== "boolean" ||
    !row.rounding_rule ||
    !row.updated_at
  ) {
    return null;
  }

  const pricingRule = mapOrderPricingRule(row);
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    standardOrderId: row.standard_order_id,
    sourcePresetVersion: row.source_preset_version,
    initialImportedPresetVersion:
      row.initial_imported_preset_version ?? undefined,
    lastAutoMergedPresetVersion:
      row.last_auto_merged_preset_version ?? undefined,
    customizationState: isCustomizationState(row.customization_state)
      ? row.customization_state
      : "detached",
    customizedFields: row.customized_fields ?? [],
    lastCustomizedAt: row.last_customized_at ?? undefined,
    lastCustomizedByUserId: row.last_customized_by_user_id ?? undefined,
    presetMergeStatus: isPresetMergeStatus(row.preset_merge_status)
      ? row.preset_merge_status
      : "detached",
    categoryGroup: row.category_group as ServiceItemType,
    categoryLabel: row.category_label,
    tCode: row.t_code ?? undefined,
    tCodeLabel: row.t_code_label ?? undefined,
    standardOrderName: row.standard_order_name,
    inHospitalOrderName: row.in_hospital_order_name,
    billingName: row.billing_name,
    aliases: row.aliases ?? [],
    availabilityStatus: row.availability_status as OrderCatalogAvailability,
    priceKrw: row.price_krw,
    salesUnit: row.sales_unit as OrderCatalogSalesUnit,
    targetSpecies: readSpeciesList(row.target_species),
    defaultDestinationModule:
      row.default_destination_module as OrderCatalogDestination,
    defaultTaskRequired: row.default_task_required,
    billingReflectionEnabled: row.billing_reflection_enabled,
    careGuide: row.care_guide ?? undefined,
    careGuideDeliveryEnabled: row.care_guide_delivery_enabled ?? false,
    internalInstruction: row.internal_instruction ?? undefined,
    internalInstructionDeliveryEnabled:
      row.internal_instruction_delivery_enabled ?? false,
    taxIncluded: row.tax_included,
    roundingRule: row.rounding_rule as OrderCatalogItem["roundingRule"],
    linkedLabItemIds: [],
    linkedLabCategoryIds: [],
    medicationMetadata: hasObjectKeys(row.medication_metadata)
      ? (row.medication_metadata as MedicationOrderMetadata)
      : undefined,
    vaccineMetadata: hasObjectKeys(row.vaccine_metadata)
      ? (row.vaccine_metadata as VaccineOrderMetadata)
      : undefined,
    pricingRule,
    updatedAt: row.updated_at,
  };
}

function orderCatalogItemToDbRow(item: OrderCatalogItem) {
  return {
    id: item.id,
    workspace_id: item.workspaceId,
    standard_order_id: item.standardOrderId,
    source_preset_version: item.sourcePresetVersion,
    initial_imported_preset_version:
      item.initialImportedPresetVersion ?? null,
    last_auto_merged_preset_version:
      item.lastAutoMergedPresetVersion ?? null,
    customization_state: item.customizationState ?? "detached",
    customized_fields: item.customizedFields ?? [],
    last_customized_at: item.lastCustomizedAt ?? null,
    last_customized_by_user_id: item.lastCustomizedByUserId ?? null,
    preset_merge_status: item.presetMergeStatus ?? "detached",
    category_group: item.categoryGroup,
    category_label: item.categoryLabel,
    t_code: item.tCode ?? null,
    t_code_label: item.tCodeLabel ?? null,
    standard_order_name: item.standardOrderName,
    in_hospital_order_name: item.inHospitalOrderName,
    billing_name: item.billingName,
    aliases: item.aliases,
    availability_status: item.availabilityStatus,
    price_krw: item.priceKrw,
    sales_unit: item.salesUnit,
    target_species: item.targetSpecies,
    default_destination_module: item.defaultDestinationModule,
    default_task_required: item.defaultTaskRequired,
    billing_reflection_enabled: item.billingReflectionEnabled,
    care_guide: item.careGuide ?? null,
    care_guide_delivery_enabled: item.careGuideDeliveryEnabled ?? false,
    internal_instruction: item.internalInstruction ?? null,
    internal_instruction_delivery_enabled:
      item.internalInstructionDeliveryEnabled ?? false,
    tax_included: item.taxIncluded,
    rounding_rule: item.roundingRule,
    pricing_rule: item.pricingRule,
    medication_metadata: item.medicationMetadata ?? {},
    vaccine_metadata: item.vaccineMetadata ?? {},
    updated_at: item.updatedAt,
  };
}

function mapOrderPricingRule(row: Partial<OrderCatalogItemDbRow>) {
  const raw =
    row.pricing_rule && typeof row.pricing_rule === "object"
      ? row.pricing_rule
      : {};
  return {
    priceBasis:
      readString(raw.priceBasis ?? raw.price_basis) ??
      ("fixed_order_price" as const),
    priceKrw:
      readNumber(raw.priceKrw ?? raw.price_krw) ?? row.price_krw ?? 0,
    salesUnit:
      readString(raw.salesUnit ?? raw.sales_unit) ??
      row.sales_unit ??
      "per_each",
    taxIncluded:
      readBoolean(raw.taxIncluded ?? raw.tax_included) ??
      row.tax_included ??
      true,
    roundingRule:
      readString(raw.roundingRule ?? raw.rounding_rule) ??
      row.rounding_rule ??
      "as_is",
    billingReflectionEnabled:
      readBoolean(
        raw.billingReflectionEnabled ?? raw.billing_reflection_enabled,
      ) ??
      row.billing_reflection_enabled ??
      true,
  } as OrderPricingRule;
}

function hasObjectKeys(value: unknown) {
  return Boolean(
    value &&
      typeof value === "object" &&
      Object.keys(value as Record<string, unknown>).length > 0,
  );
}

function isCustomizationState(
  value: unknown,
): value is OrderCatalogCustomizationState {
  return (
    value === "unmodified" ||
    value === "customized" ||
    value === "detached"
  );
}

function isPresetMergeStatus(
  value: unknown,
): value is OrderCatalogPresetMergeStatus {
  return (
    value === "current" ||
    value === "update_available" ||
    value === "conflict" ||
    value === "detached"
  );
}

export function createDemoOrderCatalogPermissionAdapter() {
  return createMockWorkspacePermissionAdapter({
    users: [
      { id: "playwright-default-session", status: "active" },
      { id: "user-admin", status: "active" },
      { id: "user-vet", status: "active" },
    ],
    memberships: [
      {
        id: "membership-playwright-admin",
        workspaceId: "clair-demo",
        userId: "playwright-default-session",
        roles: ["hospital_admin"],
        status: "active",
      },
      {
        id: "membership-admin",
        workspaceId: "clair-demo",
        userId: "user-admin",
        roles: ["hospital_admin"],
        status: "active",
      },
      {
        id: "membership-vet",
        workspaceId: "clair-demo",
        userId: "user-vet",
        roles: ["vet"],
        status: "active",
      },
    ],
  });
}

function requirePermission(
  permissionAdapter: WorkspacePermissionAdapter,
  actorUserId: string | null,
  workspaceId: string,
  requiredPermission: PermissionId,
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
      status:
        permission.denialReason === "unauthenticated"
          ? (401 as const)
          : (403 as const),
      denialReason: permission.denialReason ?? "permission_missing",
    },
  };
}

async function readCatalogItemBeforeMutation({
  gateway,
  input,
  workspaceId,
}: {
  gateway: OrderCatalogGateway;
  input: OrderCatalogMutationInput;
  workspaceId: string;
}) {
  if (input.action === "create") return null;
  const current = await gateway.listAdminCatalog({ workspaceId });
  return current.items.find((item) => item.id === input.itemId) ?? null;
}

function orderCatalogAuditEventType(input: OrderCatalogMutationInput) {
  if (input.action === "create") return "order_catalog.created" as const;
  if (input.action === "pause") return "order_catalog.paused" as const;
  return "order_catalog.updated" as const;
}

function orderCatalogChangedFields(input: OrderCatalogMutationInput) {
  if (input.action === "create") return ["*"];
  if (input.action === "pause") return ["availabilityStatus"];
  return Object.keys(input.patch).sort();
}

function summarizeCatalogAuditItem(item: OrderCatalogItem) {
  return {
    id: item.id,
    standardOrderId: item.standardOrderId,
    categoryGroup: item.categoryGroup,
    categoryLabel: item.categoryLabel,
    standardOrderName: item.standardOrderName,
    inHospitalOrderName: item.inHospitalOrderName,
    billingName: item.billingName,
    availabilityStatus: item.availabilityStatus,
    priceKrw: item.priceKrw,
    salesUnit: item.salesUnit,
    defaultDestinationModule: item.defaultDestinationModule,
    defaultTaskRequired: item.defaultTaskRequired,
    billingReflectionEnabled: item.billingReflectionEnabled,
    pricingRule: {
      priceBasis: item.pricingRule.priceBasis,
      priceKrw: item.pricingRule.priceKrw,
      salesUnit: item.pricingRule.salesUnit,
      taxIncluded: item.pricingRule.taxIncluded,
      billingReflectionEnabled: item.pricingRule.billingReflectionEnabled,
    },
    updatedAt: item.updatedAt,
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

function copyPresetFields(
  preset: SystemOrderPreset,
): Omit<
  OrderCatalogItem,
  | "id"
  | "workspaceId"
  | "standardOrderId"
  | "sourcePresetVersion"
  | "initialImportedPresetVersion"
  | "lastAutoMergedPresetVersion"
  | "customizationState"
  | "customizedFields"
  | "lastCustomizedAt"
  | "lastCustomizedByUserId"
  | "presetMergeStatus"
  | "updatedAt"
> {
  return {
    categoryGroup: preset.categoryGroup,
    categoryLabel: preset.categoryLabel,
    tCode: preset.tCode,
    tCodeLabel: preset.tCodeLabel,
    standardOrderName: preset.standardOrderName,
    inHospitalOrderName: preset.defaultInHospitalOrderName,
    billingName: preset.defaultBillingName,
    aliases: [...preset.aliases],
    availabilityStatus: preset.defaultAvailabilityStatus,
    priceKrw: preset.defaultPriceKrw,
    salesUnit: preset.salesUnit,
    targetSpecies: [...preset.targetSpecies],
    defaultDestinationModule: preset.defaultDestinationModule,
    defaultTaskRequired: preset.defaultTaskRequired,
    billingReflectionEnabled: preset.billingReflectionEnabled,
    careGuide: preset.careGuide,
    careGuideDeliveryEnabled: preset.careGuideDeliveryEnabled,
    internalInstruction: preset.internalInstruction,
    internalInstructionDeliveryEnabled:
      preset.internalInstructionDeliveryEnabled,
    taxIncluded: preset.taxIncluded,
    roundingRule: preset.roundingRule,
    linkedLabItemIds: [...preset.linkedLabItemIds],
    linkedLabCategoryIds: [...preset.linkedLabCategoryIds],
    medicationMetadata: preset.medicationMetadata
      ? { ...preset.medicationMetadata }
      : undefined,
    vaccineMetadata: preset.vaccineMetadata
      ? {
          ...preset.vaccineMetadata,
          vaccineTarget: [...preset.vaccineMetadata.vaccineTarget],
        }
      : undefined,
    pricingRule: { ...preset.pricingRule },
  };
}

function createCatalogItemId({
  preset,
  workspaceId,
}: {
  preset: SystemOrderPreset;
  workspaceId: string;
}) {
  if (workspaceId === "clair-demo" && preset.defaultCatalogItemId)
    return preset.defaultCatalogItemId;
  return `ord-${workspaceId}-${preset.presetId}`.replace(
    /[^a-zA-Z0-9_-]/g,
    "-",
  );
}

function getCustomizationState(
  item: OrderCatalogItem,
): OrderCatalogCustomizationState {
  if (item.customizationState) return item.customizationState;
  return item.customizedFields && item.customizedFields.length > 0
    ? "customized"
    : "unmodified";
}

function markCatalogItemCustomized(
  item: OrderCatalogItem,
  fieldNames: string[],
  now: string,
  actorUserId?: string,
): OrderCatalogItem {
  const customizedFields = Array.from(
    new Set([...(item.customizedFields ?? []), ...fieldNames]),
  ).filter(Boolean);
  const detached =
    item.customizationState === "detached" ||
    item.presetMergeStatus === "detached";
  return {
    ...item,
    customizationState: detached ? "detached" : "customized",
    customizedFields,
    lastCustomizedAt: now,
    lastCustomizedByUserId: actorUserId,
    presetMergeStatus: detached
      ? "detached"
      : item.presetMergeStatus === "update_available"
        ? "update_available"
        : "current",
  };
}

function cloneItem(item: OrderCatalogItem): OrderCatalogItem {
  return {
    ...item,
    aliases: [...item.aliases],
    targetSpecies: [...item.targetSpecies],
    linkedLabItemIds: [...item.linkedLabItemIds],
    linkedLabCategoryIds: [...item.linkedLabCategoryIds],
    customizedFields: item.customizedFields
      ? [...item.customizedFields]
      : undefined,
    medicationMetadata: item.medicationMetadata
      ? { ...item.medicationMetadata }
      : undefined,
    vaccineMetadata: item.vaccineMetadata
      ? {
          ...item.vaccineMetadata,
          vaccineTarget: [...item.vaccineMetadata.vaccineTarget],
        }
      : undefined,
    pricingRule: { ...item.pricingRule },
  };
}

function createSetSnapshot(set: OrderSet): AppliedOrderSnapshot {
  return {
    sourcePresetId: set.id,
    sourcePresetVersion: set.sourceSetVersion,
    appliedStandardOrderName: set.setName,
    appliedDisplayName: set.setName,
    appliedBillingName: set.billingName,
    appliedPriceKrw: set.setPriceKrw,
    appliedSalesUnit: set.salesUnit,
    appliedTaxIncluded: true,
    appliedAmountBasis: set.amountBasis,
    appliedTargetSpecies: [...set.targetSpecies],
    appliedCareGuide: set.careGuide,
    appliedInternalInstruction: set.internalInstruction,
    appliedDestinationModule: "chart_only",
    appliedTaskRequired: false,
    billingReflectionEnabled: set.billingReflectionEnabled,
  };
}

function mapChartSearchRows(value: unknown): ChartOrderCatalogSearchRow[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(mapChartSearchRow)
    .filter((row): row is ChartOrderCatalogSearchRow => Boolean(row));
}

function mapChartSearchRow(value: unknown): ChartOrderCatalogSearchRow | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const appliedSnapshot = mapAppliedSnapshot(row.appliedSnapshot ?? row.applied_snapshot);
  const rowType = readString(row.rowType ?? row.row_type);
  const sourcePresetId = readString(row.sourcePresetId ?? row.source_preset_id);
  const sourcePresetVersion = readString(
    row.sourcePresetVersion ?? row.source_preset_version,
  );
  const displayName = readString(row.displayName ?? row.display_name);
  const billingName = readString(row.billingName ?? row.billing_name);
  const categoryGroup = readString(row.categoryGroup ?? row.category_group);
  if (
    !appliedSnapshot ||
    (rowType !== "individual" && rowType !== "set") ||
    !sourcePresetId ||
    !sourcePresetVersion ||
    !displayName ||
    !billingName ||
    !categoryGroup
  ) {
    return null;
  }
  return {
    rowType,
    sourcePresetId,
    sourcePresetVersion,
    displayName,
    billingName,
    categoryGroup: categoryGroup as ServiceItemType | "set",
    targetSpecies: readSpeciesList(row.targetSpecies ?? row.target_species),
    appliedSnapshot,
  };
}

function mapAppliedSnapshot(value: unknown): AppliedOrderSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const sourcePresetId = readString(row.sourcePresetId ?? row.source_preset_id);
  const sourcePresetVersion = readString(
    row.sourcePresetVersion ?? row.source_preset_version,
  );
  const appliedDisplayName = readString(
    row.appliedDisplayName ?? row.applied_display_name,
  );
  const appliedBillingName = readString(
    row.appliedBillingName ?? row.applied_billing_name,
  );
  const appliedPriceKrw = readNumber(
    row.appliedPriceKrw ?? row.applied_price_krw,
  );
  const appliedSalesUnit = readString(
    row.appliedSalesUnit ?? row.applied_sales_unit,
  );
  const appliedTaxIncluded = readBoolean(
    row.appliedTaxIncluded ?? row.applied_tax_included,
  );
  const appliedAmountBasis = readString(
    row.appliedAmountBasis ?? row.applied_amount_basis,
  );
  const billingReflectionEnabled = readBoolean(
    row.billingReflectionEnabled ?? row.billing_reflection_enabled,
  );
  if (
    !sourcePresetId ||
    !sourcePresetVersion ||
    !appliedDisplayName ||
    !appliedBillingName ||
    typeof appliedPriceKrw !== "number" ||
    !appliedSalesUnit ||
    typeof appliedTaxIncluded !== "boolean" ||
    !appliedAmountBasis ||
    typeof billingReflectionEnabled !== "boolean"
  ) {
    return null;
  }
  return {
    sourcePresetId,
    sourcePresetVersion,
    workspaceCatalogItemId: readString(
      row.workspaceCatalogItemId ?? row.workspace_catalog_item_id,
    ),
    appliedStandardOrderName: readString(
      row.appliedStandardOrderName ?? row.applied_standard_order_name,
    ),
    appliedDisplayName,
    appliedBillingName,
    appliedPriceKrw,
    appliedSalesUnit: appliedSalesUnit as OrderCatalogSalesUnit,
    appliedTaxIncluded,
    appliedAmountBasis: appliedAmountBasis as OrderCatalogPriceBasis,
    appliedTargetSpecies: readSpeciesList(
      row.appliedTargetSpecies ?? row.applied_target_species,
    ),
    appliedCareGuide: readString(row.appliedCareGuide ?? row.applied_care_guide),
    appliedInternalInstruction: readString(
      row.appliedInternalInstruction ?? row.applied_internal_instruction,
    ),
    appliedDestinationModule: readString(
      row.appliedDestinationModule ?? row.applied_destination_module,
    ) as OrderCatalogDestination | undefined,
    appliedTaskRequired: readBoolean(
      row.appliedTaskRequired ?? row.applied_task_required,
    ),
    billingReflectionEnabled,
  };
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function readBoolean(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

function readSpeciesList(value: unknown): Species[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Species =>
    ["dog", "cat", "other"].includes(String(item)),
  );
}

function orderCatalogItemToSystemPreset(
  item: OrderCatalogItem,
): SystemOrderPreset {
  return {
    presetId: item.standardOrderId,
    presetVersion: item.sourcePresetVersion,
    presetStatus: "active",
    defaultCatalogItemId: item.id,
    categoryGroup: item.categoryGroup,
    categoryLabel: item.categoryLabel,
    tCode: item.tCode,
    tCodeLabel: item.tCodeLabel,
    standardOrderName: item.standardOrderName,
    defaultInHospitalOrderName: item.inHospitalOrderName,
    defaultBillingName: item.billingName,
    aliases: [...item.aliases],
    defaultAvailabilityStatus: item.availabilityStatus,
    defaultPriceKrw: item.priceKrw,
    salesUnit: item.salesUnit,
    targetSpecies: [...item.targetSpecies],
    defaultDestinationModule: item.defaultDestinationModule,
    defaultTaskRequired: item.defaultTaskRequired,
    billingReflectionEnabled: item.billingReflectionEnabled,
    careGuide: item.careGuide,
    careGuideDeliveryEnabled: item.careGuideDeliveryEnabled,
    internalInstruction: item.internalInstruction,
    internalInstructionDeliveryEnabled: item.internalInstructionDeliveryEnabled,
    taxIncluded: item.taxIncluded,
    roundingRule: item.roundingRule,
    linkedLabItemIds: [...item.linkedLabItemIds],
    linkedLabCategoryIds: [...item.linkedLabCategoryIds],
    medicationMetadata: item.medicationMetadata
      ? { ...item.medicationMetadata }
      : undefined,
    vaccineMetadata: item.vaccineMetadata
      ? {
          ...item.vaccineMetadata,
          vaccineTarget: [...item.vaccineMetadata.vaccineTarget],
        }
      : undefined,
    pricingRule: { ...item.pricingRule },
  };
}

const baseOrder: Omit<
  OrderCatalogItem,
  | "id"
  | "standardOrderId"
  | "categoryGroup"
  | "categoryLabel"
  | "standardOrderName"
  | "inHospitalOrderName"
  | "billingName"
  | "priceKrw"
  | "defaultDestinationModule"
  | "pricingRule"
> = {
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
    pricingRule: {
      priceBasis: "unit_price",
      priceKrw: 12000,
      salesUnit: "per_each",
      taxIncluded: true,
      roundingRule: "as_is",
      billingReflectionEnabled: true,
    },
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
    pricingRule: {
      priceBasis: "unit_price",
      priceKrw: 4500,
      salesUnit: "per_each",
      taxIncluded: true,
      roundingRule: "as_is",
      billingReflectionEnabled: true,
    },
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
    pricingRule: {
      priceBasis: "fixed_order_price",
      priceKrw: 45000,
      salesUnit: "per_each",
      taxIncluded: true,
      roundingRule: "as_is",
      billingReflectionEnabled: true,
    },
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
    pricingRule: {
      priceBasis: "unit_price",
      priceKrw: 0,
      salesUnit: "per_each",
      taxIncluded: true,
      roundingRule: "as_is",
      billingReflectionEnabled: false,
    },
  },
];

export const defaultSystemOrderPresets: SystemOrderPreset[] =
  defaultOrderCatalogItems.map(orderCatalogItemToSystemPreset);

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
      {
        id: "setitem-vomit-baso",
        childOrderId: "ord-lab-cbc-baso",
        sortOrder: 10,
        defaultSelected: true,
        billingReflectionDefault: true,
        defaultQuantity: 1,
        quantitySource: "fixed_one",
        unitPriceSnapshotKrw: 12000,
      },
      {
        id: "setitem-vomit-maropitant",
        childOrderId: "ord-med-maropitant",
        sortOrder: 20,
        defaultSelected: true,
        billingReflectionDefault: true,
        defaultQuantity: 3,
        quantitySource: "preset_quantity",
        unitPriceSnapshotKrw: 4500,
      },
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
