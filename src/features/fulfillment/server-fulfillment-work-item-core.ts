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
import {
  createMockInvoiceCandidateSyncGateway,
  type BillingInvoiceCandidateLine,
  type InvoiceCandidateSyncGateway,
} from "@/features/billing/server-invoice-candidate-sync-core";
import {
  createMockChartOrderLifecycleGateway,
  type ChartOrderLifecycleGateway,
  type ChartOrderLifecycleStatus,
} from "@/features/chart/server-order-lifecycle-persistence-core";
import {
  mockEncounters,
  mockGuardians,
  mockOrders,
  mockPatients,
} from "@/mocks/emr-domain";
import {
  emitLiveNotificationEvent,
  type LiveNotificationEventInput,
  type LiveNotificationEventStore,
  type LiveNotificationStateStore,
} from "@/features/notifications/server-notifications";
import {
  emitPersistedLiveNotificationEvent,
  type NotificationPersistenceGateway,
} from "@/features/notifications/server-notification-persistence";
import {
  getOperatingDateFromIso,
  isIsoOperatingDate,
} from "@/lib/emr-domain/demo-date";
import {
  mapDispensingOrderLineageSnapshot,
  type DispensingOrderLineageSnapshot,
} from "@/features/hospital-admin/server-order-catalog-core";
import type {
  ClinicalOrderDestinationModule,
  ClinicalOrderType,
  EmrOrder,
  EmrOrderType,
  Encounter,
  Guardian,
  OrderPriority,
  Patient,
  PermissionId,
  UniversalOrderTaskStatus,
} from "@/types/emr-domain";

export type FulfillmentQueueType = EmrOrderType;
export type FulfillmentWorkItemStatus =
  | "requested"
  | "accepted"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "returned";

export type FulfillmentSourceSnapshot = {
  billingReflectionEnabled: boolean;
  detail: Record<string, unknown>;
  dispensingLineage?: DispensingOrderLineageSnapshot;
  frozenOrderSnapshot?: Record<string, unknown>;
  guardianName?: string;
  instruction?: string;
  orderDisplayName: string;
  patientName?: string;
  requestingVetName?: string;
  rowType?: "individual" | "set_child";
  serviceItemId?: string;
  sourceOrderSnapshot?: Record<string, unknown>;
  workspaceCatalogItemId?: string;
  sourceMasterRecordId?: string;
  sourceMasterRevision?: number;
  workspaceCatalogRevision?: number;
  categoryGroup?: string;
  billingCategory?: string;
};

export type FulfillmentOrderSnapshotInput = {
  amountBasis?:
    "included_order_sum" | "set_fixed_price" | "range_price" | string;
  appliedPriceSnapshot?: Record<string, unknown>;
  appliedSnapshot?: Record<string, unknown>;
  billedAs?: "set_parent" | "atomic_child" | "nonbillable_parent";
  billingName?: string;
  billingReflectionEnabled: boolean;
  billingCategory?: string;
  categoryGroup?: string;
  destinationModule?: string;
  explicitExtra?: boolean;
  frozenOrderSnapshot?: Record<string, unknown>;
  guardianName?: string;
  inHospitalOrderName?: string;
  internalInstruction?: string;
  lineTotalSnapshot?: number | null;
  orderId: string;
  patientName?: string;
  priceKrw?: number | null;
  quantity?: number;
  parentOrderId?: string | null;
  rangeBasis?: "patient_weight_kg" | "manual_value" | string | null;
  rangeId?: string | null;
  rangeInput?: number | null;
  roundingResultKrw?: number | null;
  roundingRule?: "as_is" | "ceil" | "floor" | "round";
  rowType?: "individual" | "set" | "set_child" | string;
  sourceOrderSnapshot?: Record<string, unknown>;
  sourceSetId?: string;
  sourceSetRevisionId?: string;
  sourceSetRevisionItemId?: string;
  sourceSetRevisionNo?: number;
  sourcePresetId?: string;
  workspaceCatalogItemId?: string;
  sourceMasterRecordId?: string;
  sourceMasterRevision?: number;
  workspaceCatalogRevision?: number;
  standardOrderName?: string;
  taskRequired?: boolean;
};

export type FulfillmentWorkItem = {
  assignedToUserId?: string | null;
  cancelledAt?: string | null;
  clinicalOrderType?: ClinicalOrderType | null;
  completedAt?: string | null;
  createdAt: string;
  dueAt?: string | null;
  destinationModule?: ClinicalOrderDestinationModule | null;
  encounterId: string;
  id: string;
  orderId: string;
  orderType: FulfillmentQueueType;
  patientId?: string | null;
  priority: OrderPriority;
  queueType: FulfillmentQueueType;
  reason?: string | null;
  requestedByUserId: string;
  returnedAt?: string | null;
  sourceSnapshot: FulfillmentSourceSnapshot;
  status: FulfillmentWorkItemStatus;
  taskAttemptNo?: number | null;
  taskId?: string | null;
  taskStatus?: UniversalOrderTaskStatus | null;
  updatedAt: string;
  workspaceId: string;
};

export type FulfillmentWorkItemHistoryEvent = {
  actorUserId: string | null;
  createdAt: string;
  id: string;
  nextStatus: FulfillmentWorkItemStatus;
  orderId: string;
  previousStatus: FulfillmentWorkItemStatus | null;
  reason: string | null;
  source: "work_item_created" | "order_event";
  workItemId: string;
};

export type FulfillmentWorkItemHistoryCursor = {
  createdAt: string;
  eventId: string;
};

export type FulfillmentWorkItemHistorySnapshot = {
  events: FulfillmentWorkItemHistoryEvent[];
  hasMore: boolean;
  nextCursor: FulfillmentWorkItemHistoryCursor | null;
  orderId: string;
  queueType: FulfillmentQueueType;
  workItemId: string;
  workspaceId: string;
};

export type FulfillmentWorkItemReadSummary = {
  activeCount: number;
  date?: string;
  encounterId?: string;
  orderId?: string;
  queueType: FulfillmentQueueType;
  status?: FulfillmentWorkItemStatus;
  statusCounts: Record<FulfillmentWorkItemStatus, number>;
  totalCount: number;
  workspaceId: string;
};

export type FulfillmentWorkItemFilters = {
  date?: string | null;
  encounterId?: string | null;
  orderId?: string | null;
  queueType?: string | null;
  status?: string | null;
};

export type FulfillmentSyncInput = {
  encounterId?: string;
  orderIds?: string[];
};

export type FulfillmentWorkItemUpdateInput = {
  assignedToUserId?: string | null;
  reason?: string | null;
  status?: FulfillmentWorkItemStatus;
};

export type FulfillmentVetReviewBillingInput = {
  encounterId?: string;
  orderIds?: string[];
};

export type FulfillmentDownstreamSyncSummary = {
  auditEventCount: number;
  billingCandidateCount: number;
  billingReadyNotificationCount?: number;
  billingSkippedReason?:
    | "billing_reflection_disabled"
    | "billable_price_required"
    | "encounter_unavailable"
    | "invoice_anchor_conflict"
    | "not_completed_status"
    | "invoice_unavailable"
    | "order_unavailable"
    | "vet_review_required";
  lifecycleStatus?: ChartOrderLifecycleStatus;
};

export type FulfillmentGatewayResult =
  | { ok: true; workItems: FulfillmentWorkItem[] }
  | {
      ok: false;
      status: 409;
      denialReason:
        | "encounter_unavailable"
        | "invalid_transition"
        | "order_unavailable"
        | "unsupported_order_type"
        | "work_item_unavailable";
    }
  | { ok: false; status: 500; error: "db_read_failed" | "db_write_failed" };
type FulfillmentGatewayFailure = Exclude<
  FulfillmentGatewayResult,
  { ok: true }
>;

export type FulfillmentHistoryGatewayResult =
  | { ok: true; history: FulfillmentWorkItemHistorySnapshot }
  | {
      ok: false;
      status: 409;
      denialReason: "work_item_unavailable";
    }
  | { ok: false; status: 500; error: "db_read_failed" };

export type FulfillmentWorkItemGateway = {
  listWorkItemHistory(input: {
    beforeCreatedAt?: string;
    beforeEventId?: string;
    limit?: number;
    workItemId: string;
    workspaceId: string;
  }): Promise<FulfillmentHistoryGatewayResult>;
  listWorkItems(input: {
    date?: string;
    encounterId?: string;
    orderId?: string;
    queueType: FulfillmentQueueType;
    status?: FulfillmentWorkItemStatus;
    workspaceId: string;
  }): Promise<FulfillmentGatewayResult>;
  syncFromOrders(input: {
    actorUserId: string;
    encounterId: string;
    orderIds: string[];
    orderSnapshots?: FulfillmentOrderSnapshotInput[];
    workspaceId: string;
  }): Promise<FulfillmentGatewayResult>;
  updateWorkItem(input: {
    actorUserId: string;
    assignedToUserId?: string | null;
    reason?: string | null;
    status: FulfillmentWorkItemStatus;
    workItemId: string;
    workspaceId: string;
  }): Promise<FulfillmentGatewayResult>;
};

export type FulfillmentWorkItemReadResult =
  | {
      ok: true;
      status: 200;
      enforcedBy: "fulfillment-work-item-persistence";
      summary: FulfillmentWorkItemReadSummary;
      workItems: FulfillmentWorkItem[];
    }
  | {
      ok: false;
      status: 400;
      error: "invalid_input";
      fieldErrors: Partial<Record<"date" | "queueType" | "status", string>>;
    }
  | {
      ok: false;
      status: 401 | 403;
      denialReason: WorkspacePermissionDenialReason;
    }
  | FulfillmentGatewayFailure;

export type FulfillmentWorkItemHistoryReadResult =
  | {
      ok: true;
      status: 200;
      enforcedBy: "fulfillment-work-item-history-persistence";
      history: FulfillmentWorkItemHistorySnapshot;
    }
  | {
      ok: false;
      status: 400;
      error: "invalid_input";
      fieldErrors: Partial<Record<"cursor" | "limit" | "workItemId", string>>;
    }
  | {
      ok: false;
      status: 401 | 403;
      denialReason: WorkspacePermissionDenialReason;
    }
  | Exclude<FulfillmentHistoryGatewayResult, { ok: true }>;

export type FulfillmentWorkItemSyncResult =
  | {
      ok: true;
      status: 200;
      enforcedBy: "fulfillment-work-item-persistence";
      workItems: FulfillmentWorkItem[];
    }
  | {
      ok: false;
      status: 400;
      error: "invalid_input";
      fieldErrors: Partial<Record<"encounterId" | "orderIds", string>>;
    }
  | {
      ok: false;
      status: 401 | 403;
      denialReason: WorkspacePermissionDenialReason;
    }
  | FulfillmentGatewayFailure;

export type FulfillmentWorkItemUpdateResult =
  | {
      ok: true;
      status: 200;
      enforcedBy: "fulfillment-work-item-persistence";
      downstreamSync?: FulfillmentDownstreamSyncSummary;
      workItems: FulfillmentWorkItem[];
    }
  | {
      ok: false;
      status: 400;
      error: "invalid_input";
      fieldErrors: Partial<Record<"reason" | "status" | "workItemId", string>>;
    }
  | {
      ok: false;
      status: 401 | 403;
      denialReason: WorkspacePermissionDenialReason;
    }
  | FulfillmentGatewayFailure;

export type FulfillmentVetReviewBillingResult =
  | {
      ok: true;
      status: 200;
      auditEventCount: number;
      billingCandidates: BillingInvoiceCandidateLine[];
      enforcedBy: "fulfillment-vet-review-billing-gate";
      emittedNotifications?: {
        billingWaitingReady: number;
      };
      reviewedWorkItems: FulfillmentWorkItem[];
    }
  | {
      ok: false;
      status: 400;
      error: "invalid_input";
      fieldErrors: Partial<Record<"encounterId" | "orderIds", string>>;
    }
  | {
      ok: false;
      status: 401 | 403;
      denialReason: WorkspacePermissionDenialReason;
    }
  | {
      ok: false;
      status: 409;
      denialReason:
        | "encounter_unavailable"
        | "invalid_review_gate"
        | "invoice_anchor_conflict"
        | "invoice_unavailable"
        | "billable_price_required"
        | "order_unavailable";
    }
  | { ok: false; status: 500; error: "db_read_failed" | "db_write_failed" };

const fulfillmentMockStore = new Map<string, FulfillmentWorkItem>();
const fulfillmentMockHistoryStore = new Map<
  string,
  FulfillmentWorkItemHistoryEvent[]
>();

const fulfillmentStatuses: FulfillmentWorkItemStatus[] = [
  "requested",
  "accepted",
  "in_progress",
  "completed",
  "cancelled",
  "returned",
];

export async function readFulfillmentWorkItems({
  actorUserId,
  filters,
  gateway = createMockFulfillmentWorkItemGateway(),
  permissionAdapter = createDemoFulfillmentPermissionAdapter(),
  workspaceId,
}: {
  actorUserId: string | null;
  filters: FulfillmentWorkItemFilters;
  gateway?: Pick<FulfillmentWorkItemGateway, "listWorkItems">;
  permissionAdapter?: WorkspacePermissionAdapter;
  workspaceId: string;
}): Promise<FulfillmentWorkItemReadResult> {
  const normalized = normalizeFilters(filters);
  const validation = validateReadFilters(normalized);
  if (!validation.valid) {
    return {
      ok: false,
      status: 400,
      error: "invalid_input",
      fieldErrors: validation.fieldErrors,
    };
  }

  const queueType = normalized.queueType as FulfillmentQueueType;
  const permission = resolveWorkspacePermission(permissionAdapter, {
    sessionUserId: actorUserId,
    workspaceId,
    requiredPermission: permissionForQueue(queueType, "read"),
  });
  if (!permission.allowed) return mapPermissionDenial(permission.denialReason);

  const result = await gateway.listWorkItems({
    encounterId: normalized.encounterId,
    date: normalized.date,
    orderId: normalized.orderId,
    queueType,
    status: normalized.status,
    workspaceId,
  });

  if (!result.ok) {
    if (result.status === 409) return result;
    return { ok: false, status: 500, error: "db_read_failed" };
  }

  return {
    ok: true,
    status: 200,
    enforcedBy: "fulfillment-work-item-persistence",
    summary: getFulfillmentWorkItemReadSummary({
      filters: normalized,
      queueType,
      workItems: result.workItems,
      workspaceId,
    }),
    workItems: result.workItems,
  };
}

export async function readFulfillmentWorkItemHistory({
  actorUserId,
  beforeCreatedAt,
  beforeEventId,
  gateway = createMockFulfillmentWorkItemGateway(),
  limit = 50,
  permissionAdapter = createDemoFulfillmentPermissionAdapter(),
  workItemId,
  workspaceId,
}: {
  actorUserId: string | null;
  beforeCreatedAt?: string | null;
  beforeEventId?: string | null;
  gateway?: Pick<FulfillmentWorkItemGateway, "listWorkItemHistory">;
  limit?: number | null;
  permissionAdapter?: WorkspacePermissionAdapter;
  workItemId: string | null | undefined;
  workspaceId: string;
}): Promise<FulfillmentWorkItemHistoryReadResult> {
  const normalizedWorkItemId = trimToUndefined(workItemId) ?? "";
  const normalizedBeforeCreatedAt = trimToUndefined(beforeCreatedAt);
  const normalizedBeforeEventId = trimToUndefined(beforeEventId);
  if (
    !normalizedWorkItemId ||
    !Number.isInteger(limit) ||
    (limit ?? 0) < 1 ||
    (limit ?? 0) > 100 ||
    Boolean(normalizedBeforeCreatedAt) !== Boolean(normalizedBeforeEventId) ||
    (normalizedBeforeCreatedAt !== undefined &&
      Number.isNaN(Date.parse(normalizedBeforeCreatedAt)))
  ) {
    return {
      ok: false,
      status: 400,
      error: "invalid_input",
      fieldErrors: {
        ...(!normalizedWorkItemId
          ? { workItemId: "업무 항목을 선택해 주세요." }
          : {}),
        ...(!Number.isInteger(limit) || (limit ?? 0) < 1 || (limit ?? 0) > 100
          ? { limit: "이력 조회 수는 1~100이어야 합니다." }
          : {}),
        ...(Boolean(normalizedBeforeCreatedAt) !== Boolean(normalizedBeforeEventId) ||
        (normalizedBeforeCreatedAt !== undefined &&
          Number.isNaN(Date.parse(normalizedBeforeCreatedAt)))
          ? { cursor: "이력 커서를 확인해 주세요." }
          : {}),
      },
    };
  }

  const result = await gateway.listWorkItemHistory({
    beforeCreatedAt: normalizedBeforeCreatedAt,
    beforeEventId: normalizedBeforeEventId,
    limit: limit ?? 50,
    workItemId: normalizedWorkItemId,
    workspaceId,
  });
  if (!result.ok) return result;
  if (
    result.history.workspaceId !== workspaceId ||
    result.history.workItemId !== normalizedWorkItemId
  ) {
    return {
      ok: false,
      status: 409,
      denialReason: "work_item_unavailable",
    };
  }

  const permission = resolveWorkspacePermission(permissionAdapter, {
    sessionUserId: actorUserId,
    workspaceId,
    requiredPermission: permissionForQueue(result.history.queueType, "read"),
  });
  if (!permission.allowed) return mapPermissionDenial(permission.denialReason);

  return {
    ok: true,
    status: 200,
    enforcedBy: "fulfillment-work-item-history-persistence",
    history: result.history,
  };
}

export function getFulfillmentWorkItemReadSummary({
  filters,
  queueType,
  workItems,
  workspaceId,
}: {
  filters: FulfillmentWorkItemFilters;
  queueType: FulfillmentQueueType;
  workItems: FulfillmentWorkItem[];
  workspaceId: string;
}): FulfillmentWorkItemReadSummary {
  const statusCounts = fulfillmentStatuses.reduce(
    (counts, status) => ({
      ...counts,
      [status]: 0,
    }),
    {} as Record<FulfillmentWorkItemStatus, number>,
  );

  workItems.forEach((item) => {
    statusCounts[item.status] += 1;
  });

  return {
    activeCount:
      workItems.length - statusCounts.completed - statusCounts.cancelled,
    ...(filters.date ? { date: filters.date } : {}),
    ...(filters.encounterId ? { encounterId: filters.encounterId } : {}),
    ...(filters.orderId ? { orderId: filters.orderId } : {}),
    queueType,
    ...(filters.status
      ? { status: filters.status as FulfillmentWorkItemStatus }
      : {}),
    statusCounts,
    totalCount: workItems.length,
    workspaceId,
  };
}

export async function syncFulfillmentWorkItemsFromOrders({
  actorUserId,
  gateway = createMockFulfillmentWorkItemGateway(),
  input,
  permissionAdapter = createDemoFulfillmentPermissionAdapter(),
  workspaceId,
}: {
  actorUserId: string | null;
  gateway?: Pick<FulfillmentWorkItemGateway, "syncFromOrders">;
  input: FulfillmentSyncInput;
  permissionAdapter?: WorkspacePermissionAdapter;
  workspaceId: string;
}): Promise<FulfillmentWorkItemSyncResult> {
  const normalized = normalizeSyncInput(input);
  const validation = validateSyncInput(normalized);
  if (!validation.valid) {
    return {
      ok: false,
      status: 400,
      error: "invalid_input",
      fieldErrors: validation.fieldErrors,
    };
  }

  const permission = resolveWorkspacePermission(permissionAdapter, {
    sessionUserId: actorUserId,
    workspaceId,
    requiredPermission: "chart:update",
  });
  if (!permission.allowed) return mapPermissionDenial(permission.denialReason);

  const result = await gateway.syncFromOrders({
    actorUserId: actorUserId ?? "",
    encounterId: normalized.encounterId,
    orderIds: normalized.orderIds,
    workspaceId,
  });

  if (!result.ok) {
    if (result.status === 409) return result;
    return { ok: false, status: 500, error: "db_write_failed" };
  }

  return {
    ok: true,
    status: 200,
    enforcedBy: "fulfillment-work-item-persistence",
    workItems: result.workItems,
  };
}

export async function updateFulfillmentWorkItem({
  actorUserId,
  auditGateway,
  auditNow,
  auditRequestId,
  emitBillingReadyNotifications,
  invoiceCandidateGateway = createMockInvoiceCandidateSyncGateway(),
  gateway = createMockFulfillmentWorkItemGateway(),
  input,
  lifecycleGateway = createMockChartOrderLifecycleGateway(),
  notificationEventStore,
  notificationEventScopeId,
  notificationPersistenceGateway,
  notificationStateStore,
  permissionAdapter = createDemoFulfillmentPermissionAdapter(),
  workItemId,
  workspaceId,
}: {
  actorUserId: string | null;
  auditGateway?: LiveMutationAuditOptions["auditGateway"];
  auditNow?: LiveMutationAuditOptions["auditNow"];
  auditRequestId?: LiveMutationAuditOptions["auditRequestId"];
  emitBillingReadyNotifications?: boolean;
  gateway?: Pick<
    FulfillmentWorkItemGateway,
    "listWorkItems" | "updateWorkItem"
  >;
  invoiceCandidateGateway?: Pick<
    InvoiceCandidateSyncGateway,
    "syncInvoiceCandidates"
  >;
  input: FulfillmentWorkItemUpdateInput;
  lifecycleGateway?: Pick<
    ChartOrderLifecycleGateway,
    "saveOrderLifecycleStatus"
  >;
  notificationEventStore?: LiveNotificationEventStore;
  notificationEventScopeId?: string | null;
  notificationPersistenceGateway?: NotificationPersistenceGateway;
  notificationStateStore?: LiveNotificationStateStore;
  permissionAdapter?: WorkspacePermissionAdapter;
  workItemId: string | null | undefined;
  workspaceId: string;
}): Promise<FulfillmentWorkItemUpdateResult> {
  const normalized = normalizeUpdateInput(workItemId, input);
  const validation = validateUpdateInput(normalized);
  if (!validation.valid) {
    return {
      ok: false,
      status: 400,
      error: "invalid_input",
      fieldErrors: validation.fieldErrors,
    };
  }

  const workItem = await findWorkItemForPermission({
    gateway,
    workItemId: normalized.workItemId,
    workspaceId,
  });
  if (!workItem.ok) return workItem;

  const permission = resolveWorkspacePermission(permissionAdapter, {
    sessionUserId: actorUserId,
    workspaceId,
    requiredPermission: permissionForQueue(
      workItem.workItem.queueType,
      "mutate",
    ),
  });
  if (!permission.allowed) return mapPermissionDenial(permission.denialReason);

  const assignmentUnchanged =
    normalized.assignedToUserId === undefined ||
    normalized.assignedToUserId ===
      (workItem.workItem.assignedToUserId ?? undefined);
  const reasonUnchanged =
    normalized.reason === undefined ||
    normalized.reason === (workItem.workItem.reason ?? undefined);
  if (
    normalized.status === workItem.workItem.status &&
    assignmentUnchanged &&
    reasonUnchanged
  ) {
    if (normalized.status === "completed") {
      const downstreamSync = await syncDownstreamFromFulfillmentUpdate({
        actorUserId,
        auditGateway,
        auditNow,
        auditRequestId,
        emitBillingReadyNotifications,
        invoiceCandidateGateway,
        lifecycleGateway,
        notificationEventStore,
        notificationEventScopeId,
        notificationPersistenceGateway,
        notificationStateStore,
        requestedStatus: normalized.status,
        updatedWorkItem: workItem.workItem,
        workspaceId,
      });
      if (!downstreamSync.ok) return downstreamSync;
      return {
        ok: true,
        status: 200,
        enforcedBy: "fulfillment-work-item-persistence",
        downstreamSync: downstreamSync.summary,
        workItems: [workItem.workItem],
      };
    }
    return {
      ok: true,
      status: 200,
      enforcedBy: "fulfillment-work-item-persistence",
      workItems: [workItem.workItem],
    };
  }

  const result = await gateway.updateWorkItem({
    actorUserId: actorUserId ?? "",
    assignedToUserId: normalized.assignedToUserId,
    reason: normalized.reason,
    status: normalized.status as FulfillmentWorkItemStatus,
    workItemId: normalized.workItemId,
    workspaceId,
  });

  if (!result.ok) {
    if (result.status === 409) return result;
    return { ok: false, status: 500, error: "db_write_failed" };
  }

  const downstreamSync = await syncDownstreamFromFulfillmentUpdate({
    actorUserId,
    auditGateway,
    auditNow,
    auditRequestId,
    emitBillingReadyNotifications,
    invoiceCandidateGateway,
    lifecycleGateway,
    notificationEventStore,
    notificationEventScopeId,
    notificationPersistenceGateway,
    notificationStateStore,
    requestedStatus: normalized.status as FulfillmentWorkItemStatus,
    updatedWorkItem: result.workItems[0],
    workspaceId,
  });
  if (!downstreamSync.ok) return downstreamSync;

  return {
    ok: true,
    status: 200,
    enforcedBy: "fulfillment-work-item-persistence",
    downstreamSync: downstreamSync.summary,
    workItems: result.workItems,
  };
}

export async function syncVetReviewedBillingCandidates({
  actorUserId,
  auditGateway,
  auditNow,
  auditRequestId,
  emitBillingReadyNotifications,
  gateway = createMockFulfillmentWorkItemGateway(),
  input,
  invoiceCandidateGateway = createMockInvoiceCandidateSyncGateway(),
  notificationEventStore,
  notificationEventScopeId,
  notificationPersistenceGateway,
  notificationStateStore,
  permissionAdapter = createDemoFulfillmentPermissionAdapter(),
  workspaceId,
}: {
  actorUserId: string | null;
  auditGateway?: LiveMutationAuditOptions["auditGateway"];
  auditNow?: LiveMutationAuditOptions["auditNow"];
  auditRequestId?: LiveMutationAuditOptions["auditRequestId"];
  emitBillingReadyNotifications?: boolean;
  gateway?: Pick<FulfillmentWorkItemGateway, "listWorkItems">;
  input: FulfillmentVetReviewBillingInput;
  invoiceCandidateGateway?: Pick<
    InvoiceCandidateSyncGateway,
    "syncInvoiceCandidates"
  >;
  notificationEventStore?: LiveNotificationEventStore;
  notificationEventScopeId?: string | null;
  notificationPersistenceGateway?: NotificationPersistenceGateway;
  notificationStateStore?: LiveNotificationStateStore;
  permissionAdapter?: WorkspacePermissionAdapter;
  workspaceId: string;
}): Promise<FulfillmentVetReviewBillingResult> {
  const normalized = normalizeVetReviewBillingInput(input);
  const validation = validateVetReviewBillingInput(normalized);
  if (!validation.valid) {
    return {
      ok: false,
      status: 400,
      error: "invalid_input",
      fieldErrors: validation.fieldErrors,
    };
  }

  const completedReviewItems: FulfillmentWorkItem[] = [];
  for (const queueType of ["lab", "imaging"] as const) {
    const result = await gateway.listWorkItems({
      encounterId: normalized.encounterId,
      queueType,
      workspaceId,
    });
    if (!result.ok) {
      if (result.status === 409) {
        if (result.denialReason === "encounter_unavailable") {
          return {
            ok: false,
            status: 409,
            denialReason: "encounter_unavailable",
          };
        }
        if (result.denialReason === "order_unavailable") {
          return {
            ok: false,
            status: 409,
            denialReason: "order_unavailable",
          };
        }
        return { ok: false, status: 409, denialReason: "invalid_review_gate" };
      }
      return { ok: false, status: 500, error: "db_read_failed" };
    }
    completedReviewItems.push(
      ...result.workItems.filter(
        (item) =>
          normalized.orderIds.includes(item.orderId) &&
          item.status === "completed",
      ),
    );
  }

  const reviewItemByOrderId = new Map(
    completedReviewItems.map((item) => [item.orderId, item]),
  );
  if (
    normalized.orderIds.some((orderId) => !reviewItemByOrderId.has(orderId))
  ) {
    return { ok: false, status: 409, denialReason: "invalid_review_gate" };
  }

  for (const queueType of new Set(
    completedReviewItems.map((item) => item.queueType),
  )) {
    const permission = resolveWorkspacePermission(permissionAdapter, {
      sessionUserId: actorUserId,
      workspaceId,
      requiredPermission: permissionForQueue(queueType, "mutate"),
    });
    if (!permission.allowed)
      return mapPermissionDenial(permission.denialReason);
  }

  const billingResult = await invoiceCandidateGateway.syncInvoiceCandidates({
    actorUserId: actorUserId ?? "",
    encounterId: normalized.encounterId,
    orderIds: normalized.orderIds,
    orderSnapshots: normalized.orderIds.map((orderId) =>
      mapWorkItemToBillingSnapshot(reviewItemByOrderId.get(orderId)!),
    ),
    surface: "fulfillment",
    workspaceId,
  });
  if (!billingResult.ok) {
    if (billingResult.status === 409) return billingResult;
    return { ok: false, status: 500, error: "db_write_failed" };
  }

  const auditResult = await emitVetReviewedBillingAuditEvents({
    actorUserId,
    auditGateway,
    auditNow,
    auditRequestId,
    billingCandidates: billingResult.candidates,
    reviewItemByOrderId,
    workspaceId,
  });
  if (!auditResult.ok)
    return { ok: false, status: 500, error: "db_write_failed" };

  const billingWaitingReadyNotificationCount = emitBillingReadyNotifications
    ? await emitBillingWaitingReadyNotifications({
        actorUserId,
        billingCandidates: billingResult.candidates,
        notificationEventStore,
        notificationEventScopeId,
        notificationPersistenceGateway,
        notificationStateStore,
        sourceWorkItems: normalized.orderIds.map((orderId) =>
          reviewItemByOrderId.get(orderId)!,
        ),
        workspaceId,
      })
    : 0;

  return {
    ok: true,
    status: 200,
    auditEventCount: auditResult.eventCount,
    billingCandidates: billingResult.candidates,
    enforcedBy: "fulfillment-vet-review-billing-gate",
    ...(emitBillingReadyNotifications
      ? {
          emittedNotifications: {
            billingWaitingReady: billingWaitingReadyNotificationCount,
          },
        }
      : {}),
    reviewedWorkItems: normalized.orderIds.map((orderId) =>
      reviewItemByOrderId.get(orderId)!,
    ),
  };
}

export function createMockFulfillmentWorkItemGateway(
  dataset: {
    encounters?: Encounter[];
    guardians?: Guardian[];
    orders?: EmrOrder[];
    patients?: Patient[];
  } = {
    encounters: mockEncounters,
    guardians: mockGuardians,
    orders: mockOrders,
    patients: mockPatients,
  },
  now = () => new Date().toISOString(),
): FulfillmentWorkItemGateway {
  const encounters = dataset.encounters ?? [];
  const guardians = dataset.guardians ?? [];
  const orders = dataset.orders ?? [];
  const patients = dataset.patients ?? [];

  return {
    async listWorkItemHistory({ workItemId, workspaceId }) {
      const item = seedWorkItems({
        encounters,
        guardians,
        orders,
        patients,
        workspaceId,
      }).find((row) => row.id === workItemId);
      if (!item) {
        return {
          ok: false,
          status: 409,
          denialReason: "work_item_unavailable",
        };
      }

      return {
        ok: true,
        history: {
          events: getOrSeedMockFulfillmentHistory(item),
          hasMore: false,
          nextCursor: null,
          orderId: item.orderId,
          queueType: item.queueType,
          workItemId: item.id,
          workspaceId: item.workspaceId,
        },
      };
    },
    async listWorkItems({
      encounterId,
      date,
      orderId,
      queueType,
      status,
      workspaceId,
    }) {
      const seeded = seedWorkItems({
        encounters,
        guardians,
        orders,
        patients,
        workspaceId,
      });
      const rows = seeded
        .filter((item) => item.queueType === queueType)
        .filter(
          (item) => !date || getFulfillmentWorkItemOperatingDate(item) === date,
        )
        .filter((item) => !encounterId || item.encounterId === encounterId)
        .filter((item) => !orderId || item.orderId === orderId)
        .filter((item) => !status || item.status === status)
        .sort(
          (a, b) =>
            a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
        );

      return { ok: true, workItems: rows };
    },
    async syncFromOrders({
      actorUserId,
      encounterId,
      orderIds,
      orderSnapshots,
      workspaceId,
    }) {
      const encounter = findEncounter(encounters, workspaceId, encounterId);
      if (!encounter)
        return {
          ok: false,
          status: 409,
          denialReason: "encounter_unavailable",
        };

      const selectedSeedOrders = orders.filter(
        (order) =>
          order.workspaceId === workspaceId &&
          order.encounterId === encounterId &&
          orderIds.includes(order.id) &&
          isAtomicFulfillmentOrder(order),
      );
      const snapshotByOrderId = new Map(
        (orderSnapshots ?? []).map((snapshot) => [snapshot.orderId, snapshot]),
      );
      const selectedOrders = [
        ...selectedSeedOrders.map((order) => ({
          order,
          snapshot: snapshotByOrderId.get(order.id),
        })),
        ...orderIds
          .filter(
            (orderId) =>
              !selectedSeedOrders.some((order) => order.id === orderId),
          )
          .map((orderId) => {
            const snapshot = snapshotByOrderId.get(orderId);
            if (!snapshot || !isSnapshotFulfillmentRequired(snapshot))
              return null;
            const orderType = mapSnapshotDestinationToQueue(
              snapshot.destinationModule,
            );
            if (!orderType) return null;
            return {
              order: createVirtualOrderFromSnapshot({
                actorUserId,
                encounterId,
                now: now(),
                orderId,
                orderType,
                snapshot,
                workspaceId,
              }),
              snapshot,
            };
          })
          .filter(
            (
              entry,
            ): entry is {
              order: EmrOrder;
              snapshot: FulfillmentOrderSnapshotInput;
            } => Boolean(entry),
          ),
      ];
      const expectedAtomicOrderIds = orderIds.filter((orderId) => {
        const order = orders.find(
          (item) =>
            item.workspaceId === workspaceId &&
            item.encounterId === encounterId &&
            item.id === orderId,
        );
        if (order) return isAtomicFulfillmentOrder(order);
        const snapshot = snapshotByOrderId.get(orderId);
        return Boolean(snapshot && isSnapshotFulfillmentRequired(snapshot));
      });
      if (selectedOrders.length !== expectedAtomicOrderIds.length) {
        return { ok: false, status: 409, denialReason: "order_unavailable" };
      }

      const timestamp = now();
      const workItems = selectedOrders.map(({ order, snapshot }) => {
        if (
          !isSupportedOrderType(order.orderType) ||
          !isAtomicFulfillmentOrder(order)
        ) {
          return null;
        }

        const existing = fulfillmentMockStore.get(
          buildWorkItemKey(workspaceId, order.id),
        );
        const item =
          existing ??
          buildWorkItemFromOrder({
            actorUserId,
            encounter,
            guardians,
            now: timestamp,
            order,
            orderSnapshot: snapshot,
            patients,
          });

        const next = {
          ...item,
          updatedAt: timestamp,
        } satisfies FulfillmentWorkItem;
        fulfillmentMockStore.set(buildWorkItemKey(workspaceId, order.id), next);
        return next;
      });

      if (workItems.some((item) => item === null)) {
        return {
          ok: false,
          status: 409,
          denialReason: "unsupported_order_type",
        };
      }

      return { ok: true, workItems: workItems as FulfillmentWorkItem[] };
    },
    async updateWorkItem({
      actorUserId,
      assignedToUserId,
      reason,
      status,
      workItemId,
      workspaceId,
    }) {
      const item = seedWorkItems({
        encounters,
        guardians,
        orders,
        patients,
        workspaceId,
      }).find((row) => row.id === workItemId);
      if (!item)
        return {
          ok: false,
          status: 409,
          denialReason: "work_item_unavailable",
        };
      if (!canTransition(item.status, status)) {
        return { ok: false, status: 409, denialReason: "invalid_transition" };
      }

      const timestamp = now();
      const next = {
        ...item,
        assignedToUserId: assignedToUserId ?? item.assignedToUserId ?? null,
        cancelledAt:
          status === "cancelled" ? timestamp : (item.cancelledAt ?? null),
        completedAt:
          status === "completed" ? timestamp : (item.completedAt ?? null),
        reason: normalizeOptionalField(reason) ?? item.reason ?? null,
        returnedAt:
          status === "returned" ? timestamp : (item.returnedAt ?? null),
        status,
        updatedAt: timestamp,
      } satisfies FulfillmentWorkItem;
      fulfillmentMockStore.set(
        buildWorkItemKey(workspaceId, next.orderId),
        next,
      );
      const history = getOrSeedMockFulfillmentHistory(item);
      history.push({
        actorUserId: actorUserId || null,
        createdAt: timestamp,
        id: `history-${workItemId}-${history.length + 1}`,
        nextStatus: status,
        orderId: item.orderId,
        previousStatus: item.status,
        reason: normalizeOptionalField(reason) ?? null,
        source: "order_event",
        workItemId,
      });
      fulfillmentMockHistoryStore.set(
        buildWorkItemKey(workspaceId, item.orderId),
        history,
      );

      return { ok: true, workItems: [next] };
    },
  };
}

export type SupabaseFulfillmentWorkItemRpcClient = {
  rpc(
    functionName: "clair_list_fulfillment_work_item_history_v2",
    args: {
      p_before_created_at?: string | null;
      p_before_event_id?: string | null;
      p_limit?: number;
      p_workspace_id: string;
      p_work_item_id: string;
    },
  ): Promise<{ data: unknown; error: { message?: string } | null }>;
  rpc(
    functionName: "clair_list_fulfillment_work_items",
    args: {
      p_workspace_id: string;
      p_queue_type: FulfillmentQueueType;
      p_encounter_id?: string;
      p_order_id?: string;
      p_status?: FulfillmentWorkItemStatus;
    },
  ): Promise<{ data: unknown; error: { message?: string } | null }>;
  rpc(
    functionName: "clair_sync_fulfillment_work_items_from_orders",
    args: {
      p_workspace_id: string;
      p_actor_user_id: string;
      p_encounter_id: string;
      p_order_ids: string[];
    },
  ): Promise<{ data: unknown; error: { message?: string } | null }>;
  rpc(
    functionName: "clair_update_fulfillment_work_item",
    args: {
      p_workspace_id: string;
      p_actor_user_id: string;
      p_work_item_id: string;
      p_status: FulfillmentWorkItemStatus;
      p_assigned_to_user_id?: string | null;
      p_reason?: string | null;
    },
  ): Promise<{ data: unknown; error: { message?: string } | null }>;
};

export function createSupabaseFulfillmentWorkItemGateway(
  client: SupabaseFulfillmentWorkItemRpcClient,
): FulfillmentWorkItemGateway {
  return {
    async listWorkItemHistory({
      beforeCreatedAt,
      beforeEventId,
      limit,
      workItemId,
      workspaceId,
    }) {
      const { data, error } = await client.rpc(
        "clair_list_fulfillment_work_item_history_v2",
        {
          p_before_created_at: beforeCreatedAt ?? null,
          p_before_event_id:
            normalizeUuidForRpc(beforeEventId) ?? beforeEventId ?? null,
          p_limit: limit ?? 50,
          p_workspace_id: workspaceId,
          p_work_item_id: normalizeUuidForRpc(workItemId) ?? workItemId,
        },
      );
      if (error) return mapHistoryGatewayError(error.message);
      const history = mapWorkItemHistorySnapshot(data);
      if (!history) {
        return { ok: false, status: 500, error: "db_read_failed" };
      }
      return { ok: true, history };
    },
    async listWorkItems({
      encounterId,
      date,
      orderId,
      queueType,
      status,
      workspaceId,
    }) {
      const { data, error } = await client.rpc(
        "clair_list_fulfillment_work_items",
        {
          p_workspace_id: workspaceId,
          p_queue_type: queueType,
          p_encounter_id: normalizeUuidForRpc(encounterId),
          p_order_id: normalizeUuidForRpc(orderId),
          p_status: status,
        },
      );
      if (error) return mapGatewayError(error.message, "db_read_failed");
      return {
        ok: true,
        workItems: mapWorkItemRows(data).filter(
          (item) => !date || getFulfillmentWorkItemOperatingDate(item) === date,
        ),
      };
    },
    async syncFromOrders({ actorUserId, encounterId, orderIds, workspaceId }) {
      const { data, error } = await client.rpc(
        "clair_sync_fulfillment_work_items_from_orders",
        {
          p_workspace_id: workspaceId,
          p_actor_user_id: actorUserId,
          p_encounter_id: normalizeUuidForRpc(encounterId) ?? encounterId,
          p_order_ids: orderIds
            .map(normalizeUuidForRpc)
            .filter((orderId): orderId is string => Boolean(orderId)),
        },
      );
      if (error) return mapGatewayError(error.message, "db_write_failed");
      return { ok: true, workItems: mapWorkItemRows(data) };
    },
    async updateWorkItem({
      actorUserId,
      assignedToUserId,
      reason,
      status,
      workItemId,
      workspaceId,
    }) {
      const { data, error } = await client.rpc(
        "clair_update_fulfillment_work_item",
        {
          p_workspace_id: workspaceId,
          p_actor_user_id: actorUserId,
          p_work_item_id: normalizeUuidForRpc(workItemId) ?? workItemId,
          p_status: status,
          p_assigned_to_user_id:
            normalizeUuidForRpc(assignedToUserId ?? undefined) ?? null,
          p_reason: normalizeOptionalField(reason) ?? null,
        },
      );
      if (error) return mapGatewayError(error.message, "db_write_failed");
      return { ok: true, workItems: mapWorkItemRows(data) };
    },
  };
}

export function createDemoFulfillmentPermissionAdapter() {
  return createMockWorkspacePermissionAdapter({
    users: [
      {
        id: "playwright-default-session",
        status: "active",
        displayName: "Playwright Admin",
      },
      { id: "user-admin", status: "active", displayName: "송민재" },
      { id: "user-front-desk", status: "active", displayName: "최유나" },
      { id: "user-vet", status: "active", displayName: "이수지" },
      { id: "user-tech", status: "active", displayName: "송하윤" },
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
        id: "membership-front-desk",
        workspaceId: "clair-demo",
        userId: "user-front-desk",
        roles: ["front_desk"],
        status: "active",
      },
      {
        id: "membership-vet",
        workspaceId: "clair-demo",
        userId: "user-vet",
        roles: ["vet"],
        status: "active",
      },
      {
        id: "membership-tech",
        workspaceId: "clair-demo",
        userId: "user-tech",
        roles: ["technician"],
        status: "active",
      },
    ],
    // Vet review is a queue-scoped billing transition. Keep the ordinary vet
    // chart/read permissions and grant only the three completion permissions
    // required by the fulfillment wrapper call graph.
    permissionPolicies: [
      {
        workspaceId: "clair-demo",
        role: "vet",
        permissionIds: [
          "reception:view",
          "patient:view",
          "patient:create",
          "patient:update",
          "encounter:view",
          "chart:view",
          "chart:update",
          "vital:write",
          "order:view",
          "order:request",
          "order:update",
          "dispensing:view",
          "dispensing:complete",
          "lab:view",
          "lab:complete",
          "imaging:view",
          "imaging:complete",
          "billing:view",
          "service_catalog:view",
          "hospital_settings:view",
        ],
      },
      {
        workspaceId: "clair-demo",
        role: "technician",
        permissionIds: [
          "reception:view",
          "patient:view",
          "patient:create",
          "patient:update",
          "encounter:view",
          "chart:view",
          "vital:write",
          "order:view",
          "dispensing:view",
          "dispensing:complete",
          "lab:view",
          "lab:complete",
          "imaging:view",
          "imaging:complete",
          "billing:view",
          "billing:issue",
          "service_catalog:view",
          "hospital_settings:view",
        ],
      },
      {
        workspaceId: "clair-demo",
        role: "front_desk",
        permissionIds: [
          "reception:view",
          "reception:create",
          "reception:update",
          "patient:view",
          "patient:create",
          "patient:update",
          "encounter:view",
          "encounter:create",
          "encounter:update",
          "chart:view",
          "order:view",
          "billing:view",
          "billing:issue",
          "service_catalog:view",
          "hospital_settings:view",
        ],
      },
    ],
  });
}

async function findWorkItemForPermission({
  gateway,
  workItemId,
  workspaceId,
}: {
  gateway: Pick<FulfillmentWorkItemGateway, "listWorkItems">;
  workItemId: string;
  workspaceId: string;
}): Promise<
  | { ok: true; workItem: FulfillmentWorkItem }
  | { ok: false; status: 409; denialReason: "work_item_unavailable" }
  | { ok: false; status: 500; error: "db_read_failed" }
> {
  for (const queueType of [
    "lab",
    "imaging",
    "dispensing",
    "treatment",
  ] satisfies FulfillmentQueueType[]) {
    const result = await gateway.listWorkItems({ queueType, workspaceId });
    if (!result.ok) {
      if (result.status === 409) continue;
      return { ok: false, status: 500, error: "db_read_failed" };
    }
    const workItem = result.workItems.find((item) => item.id === workItemId);
    if (workItem) return { ok: true, workItem };
  }

  return { ok: false, status: 409, denialReason: "work_item_unavailable" };
}

function seedWorkItems({
  encounters,
  guardians,
  orders,
  patients,
  workspaceId,
}: {
  encounters: Encounter[];
  guardians: Guardian[];
  orders: EmrOrder[];
  patients: Patient[];
  workspaceId: string;
}) {
  const rows = orders
    .filter(
      (order) =>
        order.workspaceId === workspaceId && order.status !== "cancelled",
    )
    .map((order) => {
      const encounter = findEncounter(
        encounters,
        workspaceId,
        order.encounterId,
      );
      if (
        !encounter ||
        !isSupportedOrderType(order.orderType) ||
        !isAtomicFulfillmentOrder(order)
      )
        return null;
      return (
        fulfillmentMockStore.get(buildWorkItemKey(workspaceId, order.id)) ??
        buildWorkItemFromOrder({
          actorUserId: order.requestedByUserId,
          encounter,
          guardians,
          now: order.updatedAt,
          order,
          patients,
        })
      );
    })
    .filter((item): item is FulfillmentWorkItem => Boolean(item));

  return rows;
}

function buildWorkItemFromOrder({
  actorUserId,
  encounter,
  guardians,
  now,
  order,
  orderSnapshot,
  patients,
}: {
  actorUserId: string;
  encounter: Encounter;
  guardians: Guardian[];
  now: string;
  order: EmrOrder;
  orderSnapshot?: FulfillmentOrderSnapshotInput;
  patients: Patient[];
}): FulfillmentWorkItem {
  const patient = patients.find((item) => item.id === encounter.patientId);
  const guardian = guardians.find((item) => item.id === encounter.guardianId);
  const frozenSnapshot = getFrozenOrderSnapshot(order);
  const categoryGroup =
    readSnapshotString(frozenSnapshot, "categoryGroup") ??
    orderSnapshot?.categoryGroup ??
    order.categoryGroup;
  const billingCategory =
    mapFulfillmentBillingCategory(
      readSnapshotString(frozenSnapshot, "billingCategory") ??
        orderSnapshot?.billingCategory ??
        order.billingCategory,
      categoryGroup,
    ) ?? undefined;
  const billingReflectionEnabled =
    readSnapshotBoolean(frozenSnapshot, "billingReflectionEnabled") ??
    orderSnapshot?.billingReflectionEnabled ??
    true;
  const sourceOrderSnapshot =
    frozenSnapshot ??
    orderSnapshot?.sourceOrderSnapshot ??
    orderSnapshot?.frozenOrderSnapshot ??
    orderSnapshot?.appliedSnapshot;
  const dispensingLineage = getApprovedDispensingLineage({
    frozenOrderSnapshot: frozenSnapshot,
    sourceOrderSnapshot,
  });

  return {
    assignedToUserId: order.currentAssigneeUserId ?? null,
    cancelledAt: null,
    completedAt:
      order.status === "completed" || order.workStatus === "completed"
        ? order.updatedAt
        : null,
    createdAt: order.createdAt,
    dueAt: order.dueAt ?? null,
    encounterId: order.encounterId,
    id: `fulfill-${order.id}`,
    orderId: order.id,
    orderType: order.orderType,
    priority: order.priority,
    queueType: order.orderType,
    reason: null,
    requestedByUserId: actorUserId || order.requestedByUserId,
    returnedAt: null,
    sourceSnapshot: {
      billingReflectionEnabled,
      detail: buildSnapshotDetail(order, orderSnapshot, frozenSnapshot),
      ...(dispensingLineage ? { dispensingLineage } : {}),
      guardianName:
        readSnapshotString(frozenSnapshot, "guardianName") ??
        orderSnapshot?.guardianName ??
        guardian?.name,
      instruction:
        readSnapshotString(
          frozenSnapshot,
          "internalInstruction",
          "instruction",
        ) ??
        orderSnapshot?.internalInstruction ??
        order.instruction,
      orderDisplayName:
        readSnapshotString(
          frozenSnapshot,
          "effectiveDisplayName",
          "displayName",
          "inHospitalOrderName",
        ) ??
        orderSnapshot?.inHospitalOrderName ??
        order.displayName,
      patientName:
        readSnapshotString(frozenSnapshot, "patientName") ??
        orderSnapshot?.patientName ??
        patient?.name,
      ...(readSnapshotString(frozenSnapshot, "rowType") === "set_child"
        ? { rowType: "set_child" as const }
        : {}),
      serviceItemId:
        (readSnapshotString(frozenSnapshot, "workspaceCatalogItemId") ??
        orderSnapshot?.workspaceCatalogItemId ??
        order.workspaceCatalogItemId)
          ? undefined
          : (readSnapshotString(frozenSnapshot, "sourcePresetId") ??
            orderSnapshot?.sourcePresetId ??
            order.serviceItemId),
      ...(sourceOrderSnapshot ? { sourceOrderSnapshot } : {}),
      workspaceCatalogItemId:
        readSnapshotString(frozenSnapshot, "workspaceCatalogItemId") ??
        orderSnapshot?.workspaceCatalogItemId ??
        order.workspaceCatalogItemId,
      sourceMasterRecordId:
        readSnapshotString(frozenSnapshot, "sourceMasterRecordId") ??
        orderSnapshot?.sourceMasterRecordId ??
        order.sourceMasterRecordId,
      sourceMasterRevision:
        readSnapshotNumber(frozenSnapshot, "sourceMasterRevision") ??
        orderSnapshot?.sourceMasterRevision ??
        order.sourceMasterRevision,
      workspaceCatalogRevision:
        readSnapshotNumber(
          frozenSnapshot,
          "workspaceCatalogRevision",
          "appliedCatalogRevision",
        ) ??
        orderSnapshot?.workspaceCatalogRevision ??
        order.workspaceCatalogRevision,
      ...(categoryGroup ? { categoryGroup } : {}),
      ...(billingCategory ? { billingCategory } : {}),
    },
    status: mapOrderStatusToWorkItemStatus(order.status, order.workStatus),
    updatedAt: now,
    workspaceId: order.workspaceId,
  };
}

async function syncDownstreamFromFulfillmentUpdate({
  actorUserId,
  auditGateway,
  auditNow,
  auditRequestId,
  emitBillingReadyNotifications,
  invoiceCandidateGateway,
  lifecycleGateway,
  notificationEventStore,
  notificationEventScopeId,
  notificationPersistenceGateway,
  notificationStateStore,
  requestedStatus,
  updatedWorkItem,
  workspaceId,
}: {
  actorUserId: string | null;
  auditGateway?: LiveMutationAuditOptions["auditGateway"];
  auditNow?: LiveMutationAuditOptions["auditNow"];
  auditRequestId?: LiveMutationAuditOptions["auditRequestId"];
  emitBillingReadyNotifications?: boolean;
  invoiceCandidateGateway: Pick<
    InvoiceCandidateSyncGateway,
    "syncInvoiceCandidates"
  >;
  lifecycleGateway: Pick<
    ChartOrderLifecycleGateway,
    "saveOrderLifecycleStatus"
  >;
  notificationEventStore?: LiveNotificationEventStore;
  notificationEventScopeId?: string | null;
  notificationPersistenceGateway?: NotificationPersistenceGateway;
  notificationStateStore?: LiveNotificationStateStore;
  requestedStatus: FulfillmentWorkItemStatus;
  updatedWorkItem: FulfillmentWorkItem | undefined;
  workspaceId: string;
}): Promise<
  | { ok: true; summary: FulfillmentDownstreamSyncSummary }
  | {
      ok: false;
      status: 409;
      denialReason:
        "encounter_unavailable" | "order_unavailable" | "invalid_transition";
    }
  | { ok: false; status: 500; error: "db_write_failed" }
> {
  const summary: FulfillmentDownstreamSyncSummary = {
    auditEventCount: 0,
    billingCandidateCount: 0,
  };
  if (!updatedWorkItem) return { ok: true, summary };

  const lifecycleStatus =
    mapFulfillmentStatusToLifecycleStatus(requestedStatus);
  if (lifecycleStatus) {
    const lifecycleResult = await saveLifecycleWithBridge({
      actorUserId: actorUserId ?? "",
      lifecycleGateway,
      status: lifecycleStatus,
      workItem: updatedWorkItem,
      workspaceId,
    });
    if (!lifecycleResult.ok) {
      if (lifecycleResult.status === 409) return lifecycleResult;
      return { ok: false, status: 500, error: "db_write_failed" };
    }
    summary.lifecycleStatus = lifecycleStatus;
  }

  let billingCandidates: BillingInvoiceCandidateLine[] = [];
  if (requestedStatus === "completed") {
    if (updatedWorkItem.sourceSnapshot.billingReflectionEnabled === false) {
      summary.billingSkippedReason = "billing_reflection_disabled";
    } else if (requiresVetReviewBeforeBilling(updatedWorkItem.queueType)) {
      summary.billingSkippedReason = "vet_review_required";
    } else {
      const billingResult = await invoiceCandidateGateway.syncInvoiceCandidates(
        {
          actorUserId: actorUserId ?? "",
          encounterId: updatedWorkItem.encounterId,
          orderIds: [updatedWorkItem.orderId],
          orderSnapshots: [mapWorkItemToBillingSnapshot(updatedWorkItem)],
          surface: "fulfillment",
          workspaceId,
        },
      );
      if (billingResult.ok) {
        billingCandidates = billingResult.candidates;
        summary.billingCandidateCount = billingCandidates.length;
      } else if (billingResult.status === 409) {
        summary.billingSkippedReason = billingResult.denialReason;
      } else {
        return { ok: false, status: 500, error: "db_write_failed" };
      }
    }
  } else {
    summary.billingSkippedReason = "not_completed_status";
  }

  const auditResult = await emitFulfillmentDownstreamAuditEvents({
    actorUserId,
    auditGateway,
    auditNow,
    auditRequestId,
    billingCandidates,
    lifecycleStatus: summary.lifecycleStatus,
    requestedStatus,
    workItem: updatedWorkItem,
    workspaceId,
  });
  if (!auditResult.ok)
    return { ok: false, status: 500, error: "db_write_failed" };
  summary.auditEventCount = auditResult.eventCount;

  if (emitBillingReadyNotifications) {
    const billingReadyNotificationCount =
      await emitBillingWaitingReadyNotifications({
        actorUserId,
        billingCandidates,
        notificationEventStore,
        notificationEventScopeId,
        notificationPersistenceGateway,
        notificationStateStore,
        sourceWorkItems: updatedWorkItem ? [updatedWorkItem] : [],
        workspaceId,
      });
    summary.billingReadyNotificationCount = billingReadyNotificationCount;
  }

  return { ok: true, summary };
}

async function emitVetReviewedBillingAuditEvents({
  actorUserId,
  auditGateway,
  auditNow,
  auditRequestId,
  billingCandidates,
  reviewItemByOrderId,
  workspaceId,
}: {
  actorUserId: string | null;
  auditGateway?: LiveMutationAuditOptions["auditGateway"];
  auditNow?: LiveMutationAuditOptions["auditNow"];
  auditRequestId?: LiveMutationAuditOptions["auditRequestId"];
  billingCandidates: BillingInvoiceCandidateLine[];
  reviewItemByOrderId: Map<string, FulfillmentWorkItem>;
  workspaceId: string;
}) {
  let eventCount = 0;

  for (const candidate of billingCandidates) {
    const workItem = reviewItemByOrderId.get(candidate.orderId);
    const audit = await emitLiveMutationAuditEvent({
      auditGateway,
      auditNow,
      input: {
        workspaceId,
        actorUserId,
        eventType: "billing.invoice_candidate_generated",
        targetType: "invoice",
        targetId: candidate.invoiceId,
        encounterId: workItem?.encounterId,
        requestId: auditRequestId,
        after: {
          billingCandidateId: candidate.billingCandidateId,
          lineTotal: candidate.lineTotal,
          orderId: candidate.orderId,
        },
        metadata: {
          source: "fulfillment-vet-review-billing-gate",
          ...(workItem
            ? {
                queueType: workItem.queueType,
                workItemId: workItem.id,
              }
            : {}),
        },
      },
    });
    if (!audit.ok) return { ok: false as const };
    eventCount += 1;
  }

  return { ok: true as const, eventCount };
}

async function emitBillingWaitingReadyNotifications({
  actorUserId,
  billingCandidates,
  notificationEventStore,
  notificationEventScopeId,
  notificationPersistenceGateway,
  notificationStateStore,
  sourceWorkItems,
  workspaceId,
}: {
  actorUserId: string | null;
  billingCandidates: BillingInvoiceCandidateLine[];
  notificationEventStore?: LiveNotificationEventStore;
  notificationEventScopeId?: string | null;
  notificationPersistenceGateway?: NotificationPersistenceGateway;
  notificationStateStore?: LiveNotificationStateStore;
  sourceWorkItems: FulfillmentWorkItem[];
  workspaceId: string;
}) {
  if (!billingCandidates.length) return 0;

  const workItemByOrderId = new Map(
    sourceWorkItems.map((workItem) => [workItem.orderId, workItem]),
  );
  let emittedCount = 0;

  for (const candidate of billingCandidates) {
    const workItem = workItemByOrderId.get(candidate.orderId);
    const patientLabel = trimToUndefined(workItem?.sourceSnapshot.patientName);
    const orderLabel =
      trimToUndefined(workItem?.sourceSnapshot.orderDisplayName) ??
      trimToUndefined(candidate.description) ??
      "완료 오더";

    const event = buildBillingWaitingReadyNotificationEvent({
      actorUserId,
      candidate,
      notificationEventScopeId,
      orderLabel,
      patientLabel,
      workItem,
      workspaceId,
    });

    if (notificationPersistenceGateway) {
      const result = await safeEmitPersistedLiveNotificationEvent({
        event,
        gateway: notificationPersistenceGateway,
      });
      if (result.ok) emittedCount += 1;
    } else {
      emitLiveNotificationEvent({
        event,
        eventStore: notificationEventStore,
        stateStore: notificationStateStore,
      });
      emittedCount += 1;
    }
  }

  return emittedCount;
}

async function safeEmitPersistedLiveNotificationEvent({
  event,
  gateway,
}: {
  event: LiveNotificationEventInput;
  gateway: NotificationPersistenceGateway;
}) {
  try {
    return await emitPersistedLiveNotificationEvent({ event, gateway });
  } catch {
    return {
      ok: false as const,
      status: 500 as const,
      error: "db_write_failed" as const,
    };
  }
}

function buildBillingWaitingReadyNotificationEvent({
  actorUserId,
  candidate,
  notificationEventScopeId,
  orderLabel,
  patientLabel,
  workItem,
  workspaceId,
}: {
  actorUserId: string | null;
  candidate: BillingInvoiceCandidateLine;
  notificationEventScopeId?: string | null;
  orderLabel: string;
  patientLabel?: string;
  workItem?: FulfillmentWorkItem;
  workspaceId: string;
}): LiveNotificationEventInput {
  return {
    workspaceId,
    eventKey: "billing_waiting_ready",
    dedupeKey: `${workItem?.encounterId ?? candidate.invoiceId}-${candidate.orderId}-billing_waiting_ready`,
    domain: "billing",
    priority: "reference",
    toastPolicy: "drawer_only",
    title: patientLabel
      ? `${patientLabel} 수납 준비가 완료되었습니다`
      : "수납 준비가 완료되었습니다",
    preview: "완료된 오더가 수납 후보에 반영되었습니다.",
    detail: `${orderLabel} 오더가 수납 후보에 반영되었습니다. 수납 화면에서 보호자 안내 준비를 확인하세요.`,
    workTypeLabel: "수납",
    sourceLabel: "수납 · 후보 목록",
    sourceActionLabel: "수납 후보 열기",
    recipient: { kind: "role_queue", id: "billing", label: "수납" },
    source: {
      kind: "billing_candidate",
      route: buildBillingCandidateNotificationRoute({
        candidate,
        encounterId: workItem?.encounterId,
        workspaceId,
      }),
      entity_id: candidate.billingCandidateId,
    },
    requiresAction: false,
    badgeCount: false,
    actorUserId,
    eventScopeId: notificationEventScopeId,
    occurredAt: candidate.syncedAt,
    issuedAtLabel: "방금 전",
  };
}

function buildBillingCandidateNotificationRoute({
  candidate,
  encounterId,
  workspaceId,
}: {
  candidate: BillingInvoiceCandidateLine;
  encounterId?: string;
  workspaceId: string;
}) {
  const baseRoute = `/w/${workspaceId}/billing?modulePanel=open`;
  if (encounterId) {
    return `${baseRoute}&encounterId=${encodeURIComponent(encounterId)}`;
  }

  return `${baseRoute}&invoiceId=${encodeURIComponent(candidate.invoiceId)}`;
}

async function saveLifecycleWithBridge({
  actorUserId,
  lifecycleGateway,
  status,
  workItem,
  workspaceId,
}: {
  actorUserId: string;
  lifecycleGateway: Pick<
    ChartOrderLifecycleGateway,
    "saveOrderLifecycleStatus"
  >;
  status: ChartOrderLifecycleStatus;
  workItem: FulfillmentWorkItem;
  workspaceId: string;
}) {
  const result = await lifecycleGateway.saveOrderLifecycleStatus({
    actorUserId,
    cancellationReason:
      status === "cancelled"
        ? (workItem.reason ?? "fulfillment_cancelled")
        : undefined,
    encounterId: workItem.encounterId,
    orderId: workItem.orderId,
    status,
    workspaceId,
  });
  if (
    result.ok ||
    result.status !== 409 ||
    result.denialReason !== "invalid_transition" ||
    status === "in_progress"
  ) {
    return result;
  }

  const bridge = await lifecycleGateway.saveOrderLifecycleStatus({
    actorUserId,
    encounterId: workItem.encounterId,
    orderId: workItem.orderId,
    status: "in_progress",
    workspaceId,
  });
  if (
    !bridge.ok &&
    (bridge.status !== 409 || bridge.denialReason !== "invalid_transition")
  )
    return bridge;

  return lifecycleGateway.saveOrderLifecycleStatus({
    actorUserId,
    cancellationReason:
      status === "cancelled"
        ? (workItem.reason ?? "fulfillment_cancelled")
        : undefined,
    encounterId: workItem.encounterId,
    orderId: workItem.orderId,
    status,
    workspaceId,
  });
}

async function emitFulfillmentDownstreamAuditEvents({
  actorUserId,
  auditGateway,
  auditNow,
  auditRequestId,
  billingCandidates,
  lifecycleStatus,
  requestedStatus,
  workItem,
  workspaceId,
}: {
  actorUserId: string | null;
  auditGateway?: LiveMutationAuditOptions["auditGateway"];
  auditNow?: LiveMutationAuditOptions["auditNow"];
  auditRequestId?: LiveMutationAuditOptions["auditRequestId"];
  billingCandidates: BillingInvoiceCandidateLine[];
  lifecycleStatus?: ChartOrderLifecycleStatus;
  requestedStatus: FulfillmentWorkItemStatus;
  workItem: FulfillmentWorkItem;
  workspaceId: string;
}) {
  let eventCount = 0;
  if (lifecycleStatus) {
    const audit = await emitLiveMutationAuditEvent({
      auditGateway,
      auditNow,
      input: {
        workspaceId,
        actorUserId,
        eventType: "order.status_changed",
        targetType: "order",
        targetId: workItem.orderId,
        encounterId: workItem.encounterId,
        requestId: auditRequestId,
        after: {
          fulfillmentStatus: requestedStatus,
          orderLifecycleStatus: lifecycleStatus,
        },
        metadata: {
          source: "fulfillment-work-item-persistence",
          workItemId: workItem.id,
          queueType: workItem.queueType,
        },
      },
    });
    if (!audit.ok) return { ok: false as const };
    eventCount += 1;
  }

  for (const candidate of billingCandidates) {
    const audit = await emitLiveMutationAuditEvent({
      auditGateway,
      auditNow,
      input: {
        workspaceId,
        actorUserId,
        eventType: "billing.invoice_candidate_generated",
        targetType: "invoice",
        targetId: candidate.invoiceId,
        encounterId: workItem.encounterId,
        requestId: auditRequestId,
        after: {
          billingCandidateId: candidate.billingCandidateId,
          lineTotal: candidate.lineTotal,
          orderId: candidate.orderId,
        },
        metadata: {
          source: "fulfillment-work-item-persistence",
          workItemId: workItem.id,
          queueType: workItem.queueType,
        },
      },
    });
    if (!audit.ok) return { ok: false as const };
    eventCount += 1;
  }

  return { ok: true as const, eventCount };
}

function mapFulfillmentStatusToLifecycleStatus(
  status: FulfillmentWorkItemStatus,
): ChartOrderLifecycleStatus | null {
  if (status === "accepted" || status === "in_progress") return "in_progress";
  if (status === "completed") return "completed";
  if (status === "cancelled") return "cancelled";
  if (status === "returned") return "re_requested";
  return null;
}

function requiresVetReviewBeforeBilling(queueType: FulfillmentQueueType) {
  return queueType === "lab" || queueType === "imaging";
}

function mapWorkItemToBillingSnapshot(workItem: FulfillmentWorkItem) {
  const detail = workItem.sourceSnapshot.detail;
  const sourceOrderSnapshot =
    workItem.sourceSnapshot.sourceOrderSnapshot ??
    asSnapshotRecord(detail.frozenOrderSnapshot) ??
    asSnapshotRecord(detail.appliedSnapshot);
  const frozenPriceSnapshot = asSnapshotRecord(detail.frozenPriceSnapshot);
  return {
    amountBasis: readSnapshotString(sourceOrderSnapshot, "amountBasis"),
    appliedPriceSnapshot: frozenPriceSnapshot,
    appliedSnapshot: sourceOrderSnapshot,
    billedAs: readSnapshotString(detail, "billedAs") as
      "set_parent" | "atomic_child" | "nonbillable_parent" | undefined,
    billingName:
      typeof detail.billingName === "string" ? detail.billingName : undefined,
    billingReflectionEnabled: workItem.sourceSnapshot.billingReflectionEnabled,
    destinationModule:
      typeof detail.destinationModule === "string"
        ? detail.destinationModule
        : workItem.queueType,
    explicitExtra: readSnapshotBoolean(sourceOrderSnapshot, "explicitExtra"),
    frozenOrderSnapshot: sourceOrderSnapshot,
    inHospitalOrderName: workItem.sourceSnapshot.orderDisplayName,
    lineTotalSnapshot:
      typeof detail.lineTotalSnapshot === "number" ||
      detail.lineTotalSnapshot === null
        ? detail.lineTotalSnapshot
        : undefined,
    orderId: workItem.orderId,
    priceKrw:
      detail.unitPriceSnapshot === null
        ? null
        : typeof detail.unitPriceSnapshot === "number"
          ? detail.unitPriceSnapshot
          : undefined,
    quantity: typeof detail.quantity === "number" ? detail.quantity : undefined,
    parentOrderId:
      readSnapshotString(sourceOrderSnapshot, "parentOrderId") ?? null,
    rangeBasis: readSnapshotString(sourceOrderSnapshot, "rangeBasis"),
    rangeId: readSnapshotString(sourceOrderSnapshot, "rangeId") ?? null,
    rangeInput: readSnapshotNumberOrNull(sourceOrderSnapshot, "rangeInput"),
    roundingResultKrw: readSnapshotNumberOrNull(
      frozenPriceSnapshot ?? sourceOrderSnapshot,
      "roundingResultKrw",
      "roundingResult",
    ),
    roundingRule: readSnapshotString(
      frozenPriceSnapshot ?? sourceOrderSnapshot,
      "roundingRule",
    ) as "as_is" | "ceil" | "floor" | "round" | undefined,
    rowType: readSnapshotString(sourceOrderSnapshot, "rowType") as
      "individual" | "set" | "set_child" | undefined,
    sourceOrderSnapshot,
    sourceSetId: readSnapshotString(sourceOrderSnapshot, "sourceSetId"),
    sourceSetRevisionId: readSnapshotString(
      sourceOrderSnapshot,
      "sourceSetRevisionId",
    ),
    sourceSetRevisionItemId: readSnapshotString(
      sourceOrderSnapshot,
      "sourceSetRevisionItemId",
    ),
    sourceSetRevisionNo: readSnapshotNumber(
      sourceOrderSnapshot,
      "sourceSetRevisionNo",
    ),
    sourcePresetId: workItem.sourceSnapshot.serviceItemId,
    workspaceCatalogItemId: workItem.sourceSnapshot.workspaceCatalogItemId,
    sourceMasterRecordId: workItem.sourceSnapshot.sourceMasterRecordId,
    sourceMasterRevision: workItem.sourceSnapshot.sourceMasterRevision,
    workspaceCatalogRevision: workItem.sourceSnapshot.workspaceCatalogRevision,
    categoryGroup:
      workItem.sourceSnapshot.categoryGroup ??
      readSnapshotString(sourceOrderSnapshot, "categoryGroup"),
    billingCategory:
      workItem.sourceSnapshot.billingCategory ??
      readSnapshotString(sourceOrderSnapshot, "billingCategory"),
    standardOrderName:
      typeof detail.standardOrderName === "string"
        ? detail.standardOrderName
        : undefined,
    taskRequired: true,
  };
}

function buildSnapshotDetail(
  order: EmrOrder,
  orderSnapshot?: FulfillmentOrderSnapshotInput,
  frozenSnapshot?: Record<string, unknown>,
) {
  const frozenPrice = readSnapshotNumberOrNull(
    frozenSnapshot,
    "priceKrw",
    "unitPriceSnapshot",
  );
  const frozenLineTotal = readSnapshotNumberOrNull(
    frozenSnapshot,
    "lineTotalSnapshot",
  );
  return {
    billingName:
      readSnapshotString(
        frozenSnapshot,
        "effectiveBillingName",
        "billingName",
      ) ?? orderSnapshot?.billingName,
    destinationModule:
      readSnapshotString(frozenSnapshot, "destinationModule") ??
      orderSnapshot?.destinationModule,
    lineTotalSnapshot:
      frozenLineTotal !== undefined
        ? frozenLineTotal
        : orderSnapshot?.lineTotalSnapshot,
    orderType: order.orderType,
    priority: order.priority,
    quantity:
      readSnapshotNumber(frozenSnapshot, "quantity") ?? orderSnapshot?.quantity,
    standardOrderName:
      readSnapshotString(frozenSnapshot, "standardOrderName") ??
      orderSnapshot?.standardOrderName,
    unitPriceSnapshot:
      frozenPrice !== undefined ? frozenPrice : orderSnapshot?.priceKrw,
    warningMessage: order.warningMessage,
  };
}

function isSnapshotFulfillmentRequired(
  snapshot: FulfillmentOrderSnapshotInput,
) {
  if (isContainerSnapshot(snapshot)) return false;
  if (snapshot.taskRequired === false) return false;
  return Boolean(mapSnapshotDestinationToQueue(snapshot.destinationModule));
}

function mapSnapshotDestinationToQueue(
  value?: string,
): FulfillmentQueueType | null {
  if (
    value === "lab" ||
    value === "imaging" ||
    value === "dispensing" ||
    value === "treatment"
  ) {
    return value;
  }
  return null;
}

function createVirtualOrderFromSnapshot({
  actorUserId,
  encounterId,
  now,
  orderId,
  orderType,
  snapshot,
  workspaceId,
}: {
  actorUserId: string;
  encounterId: string;
  now: string;
  orderId: string;
  orderType: FulfillmentQueueType;
  snapshot: FulfillmentOrderSnapshotInput;
  workspaceId: string;
}): EmrOrder {
  return {
    id: orderId,
    workspaceId,
    encounterId,
    serviceItemId: snapshot.workspaceCatalogItemId
      ? undefined
      : snapshot.sourcePresetId,
    workspaceCatalogItemId: snapshot.workspaceCatalogItemId,
    sourceMasterRecordId: snapshot.sourceMasterRecordId,
    sourceMasterRevision: snapshot.sourceMasterRevision,
    workspaceCatalogRevision: snapshot.workspaceCatalogRevision,
    categoryGroup: snapshot.categoryGroup as EmrOrder["categoryGroup"],
    billingCategory: snapshot.billingCategory as EmrOrder["billingCategory"],
    unitPriceSnapshot: snapshot.priceKrw,
    appliedSnapshot:
      snapshot.appliedSnapshot ??
      snapshot.frozenOrderSnapshot ??
      snapshot.sourceOrderSnapshot,
    orderType,
    displayName:
      snapshot.inHospitalOrderName ??
      snapshot.standardOrderName ??
      snapshot.billingName ??
      "Catalog Order",
    status: "confirmed",
    workStatus: "pending",
    priority: "normal",
    requestedByUserId: actorUserId,
    requestedAt: now,
    instruction: snapshot.internalInstruction,
    sortOrder: 0,
    createdAt: now,
    updatedAt: now,
  };
}

function mapOrderStatusToWorkItemStatus(
  orderStatus: EmrOrder["status"],
  workStatus: EmrOrder["workStatus"],
): FulfillmentWorkItemStatus {
  if (orderStatus === "cancelled") return "cancelled";
  if (orderStatus === "re_requested") return "returned";
  if (orderStatus === "in_progress") return "in_progress";
  if (orderStatus === "completed" || workStatus === "completed")
    return "completed";
  return "requested";
}

function getFulfillmentWorkItemOperatingDate(item: FulfillmentWorkItem) {
  return (
    getOperatingDateFromIso(item.dueAt ?? undefined) ??
    getOperatingDateFromIso(item.createdAt)
  );
}

function canTransition(
  current: FulfillmentWorkItemStatus,
  next: FulfillmentWorkItemStatus,
) {
  if (current === next) return true;
  const allowed: Record<
    FulfillmentWorkItemStatus,
    FulfillmentWorkItemStatus[]
  > = {
    requested: ["accepted", "cancelled", "returned"],
    accepted: ["in_progress", "cancelled", "returned"],
    in_progress: ["completed", "cancelled", "returned"],
    completed: [],
    cancelled: [],
    returned: ["requested", "cancelled"],
  };
  return allowed[current].includes(next);
}

function normalizeFilters(input: FulfillmentWorkItemFilters) {
  return {
    date: trimToUndefined(input.date),
    encounterId: trimToUndefined(input.encounterId),
    orderId: trimToUndefined(input.orderId),
    queueType: trimToUndefined(input.queueType) as
      FulfillmentQueueType | undefined,
    status: trimToUndefined(input.status) as
      FulfillmentWorkItemStatus | undefined,
  };
}

function validateReadFilters(input: ReturnType<typeof normalizeFilters>) {
  const fieldErrors: Partial<Record<"date" | "queueType" | "status", string>> =
    {};
  if (input.date && !isIsoOperatingDate(input.date)) {
    fieldErrors.date = "invalid_date";
  }
  if (!input.queueType || !isSupportedOrderType(input.queueType)) {
    fieldErrors.queueType = "업무 queue를 선택해 주세요.";
  }
  if (input.status && !isFulfillmentStatus(input.status)) {
    fieldErrors.status = "업무 상태를 확인해 주세요.";
  }
  return Object.keys(fieldErrors).length > 0
    ? { valid: false as const, fieldErrors }
    : { valid: true as const, fieldErrors: {} };
}

function normalizeSyncInput(input: FulfillmentSyncInput) {
  return {
    encounterId: trimToUndefined(input.encounterId) ?? "",
    orderIds: Array.isArray(input.orderIds)
      ? [
          ...new Set(
            input.orderIds
              .map(trimToUndefined)
              .filter((item): item is string => Boolean(item)),
          ),
        ]
      : [],
  };
}

function validateSyncInput(input: ReturnType<typeof normalizeSyncInput>) {
  const fieldErrors: Partial<Record<"encounterId" | "orderIds", string>> = {};
  if (!input.encounterId)
    fieldErrors.encounterId = "진료 차트를 선택해 주세요.";
  if (input.orderIds.length < 1 || input.orderIds.length > 100) {
    fieldErrors.orderIds = "연결할 오더를 확인해 주세요.";
  }
  return Object.keys(fieldErrors).length > 0
    ? { valid: false as const, fieldErrors }
    : { valid: true as const, fieldErrors: {} };
}

function normalizeVetReviewBillingInput(
  input: FulfillmentVetReviewBillingInput,
) {
  return normalizeSyncInput(input);
}

function validateVetReviewBillingInput(
  input: ReturnType<typeof normalizeVetReviewBillingInput>,
) {
  return validateSyncInput(input);
}

function normalizeUpdateInput(
  workItemId: string | null | undefined,
  input: FulfillmentWorkItemUpdateInput,
) {
  return {
    assignedToUserId: normalizeOptionalField(input.assignedToUserId),
    reason: normalizeOptionalField(input.reason),
    status: input.status,
    workItemId: trimToUndefined(workItemId) ?? "",
  };
}

function validateUpdateInput(input: ReturnType<typeof normalizeUpdateInput>) {
  const fieldErrors: Partial<Record<"reason" | "status" | "workItemId", string>> = {};
  if (!input.workItemId) fieldErrors.workItemId = "업무 항목을 선택해 주세요.";
  if (!input.status || !isFulfillmentStatus(input.status)) {
    fieldErrors.status = "변경할 상태를 선택해 주세요.";
  }
  if (input.reason && input.reason.length > 500) {
    fieldErrors.reason = "변경 사유는 500자 이하로 입력해 주세요.";
  }
  return Object.keys(fieldErrors).length > 0
    ? { valid: false as const, fieldErrors }
    : { valid: true as const, fieldErrors: {} };
}

function permissionForQueue(
  queueType: FulfillmentQueueType,
  action: "mutate" | "read",
): PermissionId {
  if (queueType === "lab")
    return action === "read" ? "lab:view" : "lab:complete";
  if (queueType === "imaging")
    return action === "read" ? "imaging:view" : "imaging:complete";
  // DEN-301: phase 1 intentionally shares dispensing permissions with treatment.
  return action === "read" ? "dispensing:view" : "dispensing:complete";
}

function mapPermissionDenial(denialReason?: WorkspacePermissionDenialReason) {
  return {
    ok: false as const,
    status:
      denialReason === "unauthenticated" ? (401 as const) : (403 as const),
    denialReason: denialReason ?? ("permission_missing" as const),
  };
}

function mapGatewayError(
  message: string | undefined,
  fallback: "db_read_failed" | "db_write_failed",
): FulfillmentGatewayResult {
  if (message?.includes("encounter_unavailable"))
    return { ok: false, status: 409, denialReason: "encounter_unavailable" };
  if (message?.includes("invalid_transition"))
    return { ok: false, status: 409, denialReason: "invalid_transition" };
  if (message?.includes("order_unavailable"))
    return { ok: false, status: 409, denialReason: "order_unavailable" };
  if (message?.includes("unsupported_order_type"))
    return { ok: false, status: 409, denialReason: "unsupported_order_type" };
  if (message?.includes("work_item_unavailable"))
    return { ok: false, status: 409, denialReason: "work_item_unavailable" };
  return { ok: false, status: 500, error: fallback };
}

function mapHistoryGatewayError(
  message: string | undefined,
): FulfillmentHistoryGatewayResult {
  if (message?.includes("work_item_unavailable")) {
    return { ok: false, status: 409, denialReason: "work_item_unavailable" };
  }
  return { ok: false, status: 500, error: "db_read_failed" };
}

function findEncounter(
  encounters: Encounter[],
  workspaceId: string,
  encounterId: string,
) {
  return encounters.find(
    (encounter) =>
      encounter.id === encounterId &&
      encounter.workspaceId === workspaceId &&
      encounter.status !== "cancelled",
  );
}

function buildWorkItemKey(workspaceId: string, orderId: string) {
  return `${workspaceId}:${orderId}`;
}

function getOrSeedMockFulfillmentHistory(item: FulfillmentWorkItem) {
  const key = buildWorkItemKey(item.workspaceId, item.orderId);
  const existing = fulfillmentMockHistoryStore.get(key);
  if (existing) return [...existing];

  const createdEvent: FulfillmentWorkItemHistoryEvent = {
    actorUserId: item.requestedByUserId || null,
    createdAt: item.createdAt,
    id: `history-${item.id}-created`,
    nextStatus: "requested",
    orderId: item.orderId,
    previousStatus: null,
    reason: null,
    source: "work_item_created",
    workItemId: item.id,
  };
  fulfillmentMockHistoryStore.set(key, [createdEvent]);
  return [createdEvent];
}

function isSupportedOrderType(value: unknown): value is FulfillmentQueueType {
  return (
    value === "lab" ||
    value === "imaging" ||
    value === "dispensing" ||
    value === "treatment"
  );
}

function isAtomicFulfillmentOrder(order: EmrOrder) {
  if (!isSupportedOrderType(order.orderType)) return false;
  const snapshot = asSnapshotRecord(order.appliedSnapshot);
  const rowType =
    readSnapshotString(
      order as EmrOrder & Record<string, unknown>,
      "rowType",
    ) ?? readSnapshotString(snapshot, "rowType");
  return (
    rowType !== "set" &&
    rowType !== "set_child_container" &&
    rowType !== "order_set" &&
    readSnapshotString(snapshot, "orderType") !== "set" &&
    readSnapshotString(
      order as EmrOrder & Record<string, unknown>,
      "orderType",
    ) !== "set"
  );
}

function getFrozenOrderSnapshot(order: EmrOrder) {
  return asSnapshotRecord(order.appliedSnapshot);
}

function isContainerSnapshot(snapshot: FulfillmentOrderSnapshotInput) {
  const rowType = snapshot.rowType;
  const appliedSnapshot = asSnapshotRecord(
    snapshot.appliedSnapshot ??
      snapshot.frozenOrderSnapshot ??
      snapshot.sourceOrderSnapshot,
  );
  return (
    rowType === "set" ||
    rowType === "set_child_container" ||
    rowType === "order_set" ||
    readSnapshotString(appliedSnapshot, "rowType") === "set" ||
    readSnapshotString(appliedSnapshot, "itemKind", "childKind") === "order_set"
  );
}

function mapFulfillmentBillingCategory(value?: string, categoryGroup?: string) {
  if (
    value === "consultation" ||
    value === "laboratory" ||
    value === "imaging" ||
    value === "dispensing" ||
    value === "treatment" ||
    value === "other"
  ) {
    return value;
  }
  if (categoryGroup === "set") return "other";
  return undefined;
}

function asSnapshotRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function readSnapshotString(
  value: unknown,
  ...keys: string[]
): string | undefined {
  const record = asSnapshotRecord(value);
  if (!record) return undefined;
  for (const key of keys) {
    const candidate = record[key];
    if (typeof candidate === "string" && candidate.trim()) return candidate;
  }
  return undefined;
}

function readSnapshotNumber(
  value: unknown,
  ...keys: string[]
): number | undefined {
  const record = asSnapshotRecord(value);
  if (!record) return undefined;
  for (const key of keys) {
    const candidate = record[key];
    if (typeof candidate === "number" && Number.isFinite(candidate))
      return candidate;
  }
  return undefined;
}

function readSnapshotNumberOrNull(
  value: unknown,
  ...keys: string[]
): number | null | undefined {
  const record = asSnapshotRecord(value);
  if (!record) return undefined;
  for (const key of keys) {
    const candidate = record[key];
    if (candidate === null) return null;
    if (typeof candidate === "number" && Number.isFinite(candidate))
      return candidate;
  }
  return undefined;
}

function readSnapshotBoolean(
  value: unknown,
  ...keys: string[]
): boolean | undefined {
  const record = asSnapshotRecord(value);
  if (!record) return undefined;
  for (const key of keys) {
    const candidate = record[key];
    if (typeof candidate === "boolean") return candidate;
  }
  return undefined;
}

function isFulfillmentStatus(
  value: unknown,
): value is FulfillmentWorkItemStatus {
  return fulfillmentStatuses.includes(value as FulfillmentWorkItemStatus);
}

function isUniversalOrderTaskStatus(
  value: unknown,
): value is UniversalOrderTaskStatus {
  return [
    "pending",
    "in_progress",
    "paused",
    "partial_complete",
    "complete",
    "cancelled",
  ].includes(String(value));
}

function normalizeOptionalField(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function trimToUndefined(value?: string | null) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeUuidForRpc(value?: string | null) {
  return value &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
    ? value
    : undefined;
}

function mapWorkItemRows(value: unknown): FulfillmentWorkItem[] {
  if (!Array.isArray(value)) return [];
  return value.reduce<FulfillmentWorkItem[]>((rows, item) => {
    const row = mapWorkItemRow(item);
    if (row) rows.push(row);
    return rows;
  }, []);
}

function mapWorkItemHistorySnapshot(
  value: unknown,
): FulfillmentWorkItemHistorySnapshot | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<FulfillmentWorkItemHistorySnapshot>;
  if (
    typeof row.workspaceId !== "string" ||
    typeof row.workItemId !== "string" ||
    typeof row.orderId !== "string" ||
    !isSupportedOrderType(row.queueType) ||
    !Array.isArray(row.events) ||
    typeof row.hasMore !== "boolean" ||
    (row.nextCursor !== null && !isFulfillmentHistoryCursor(row.nextCursor))
  ) {
    return null;
  }

  const events = row.events.reduce<FulfillmentWorkItemHistoryEvent[]>(
    (mapped, event) => {
      const historyEvent = mapWorkItemHistoryEvent(event);
      if (historyEvent) mapped.push(historyEvent);
      return mapped;
    },
    [],
  );
  if (events.length !== row.events.length) return null;

  return {
    events,
    hasMore: row.hasMore,
    nextCursor: row.nextCursor,
    orderId: row.orderId,
    queueType: row.queueType,
    workItemId: row.workItemId,
    workspaceId: row.workspaceId,
  };
}

function isFulfillmentHistoryCursor(
  value: unknown,
): value is FulfillmentWorkItemHistoryCursor {
  if (!value || typeof value !== "object") return false;
  const cursor = value as Partial<FulfillmentWorkItemHistoryCursor>;
  return (
    typeof cursor.createdAt === "string" &&
    !Number.isNaN(Date.parse(cursor.createdAt)) &&
    typeof cursor.eventId === "string"
  );
}

function mapWorkItemHistoryEvent(
  value: unknown,
): FulfillmentWorkItemHistoryEvent | null {
  if (!value || typeof value !== "object") return null;
  const event = value as Partial<FulfillmentWorkItemHistoryEvent>;
  if (
    typeof event.id !== "string" ||
    typeof event.workItemId !== "string" ||
    typeof event.orderId !== "string" ||
    (event.previousStatus !== null &&
      !isFulfillmentStatus(event.previousStatus)) ||
    !isFulfillmentStatus(event.nextStatus) ||
    (event.actorUserId !== null && typeof event.actorUserId !== "string") ||
    (event.reason !== null && typeof event.reason !== "string") ||
    (event.source !== "work_item_created" && event.source !== "order_event") ||
    typeof event.createdAt !== "string"
  ) {
    return null;
  }

  return event as FulfillmentWorkItemHistoryEvent;
}

function mapWorkItemRow(value: unknown): FulfillmentWorkItem | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<FulfillmentWorkItem>;
  if (
    typeof row.id !== "string" ||
    typeof row.workspaceId !== "string" ||
    typeof row.encounterId !== "string" ||
    typeof row.orderId !== "string" ||
    !isSupportedOrderType(row.orderType) ||
    !isSupportedOrderType(row.queueType) ||
    !isFulfillmentStatus(row.status) ||
    typeof row.priority !== "string" ||
    typeof row.requestedByUserId !== "string" ||
    typeof row.createdAt !== "string" ||
    typeof row.updatedAt !== "string" ||
    !row.sourceSnapshot ||
    typeof row.sourceSnapshot !== "object"
  ) {
    return null;
  }
  if (
    (row.taskId !== undefined &&
      row.taskId !== null &&
      typeof row.taskId !== "string") ||
    (row.taskAttemptNo !== undefined &&
      row.taskAttemptNo !== null &&
      (!Number.isInteger(row.taskAttemptNo) || row.taskAttemptNo <= 0)) ||
    (row.patientId !== undefined &&
      row.patientId !== null &&
      typeof row.patientId !== "string") ||
    (row.taskStatus !== undefined &&
      row.taskStatus !== null &&
      !isUniversalOrderTaskStatus(row.taskStatus)) ||
    (row.clinicalOrderType !== undefined &&
      row.clinicalOrderType !== null &&
      !isClinicalOrderType(row.clinicalOrderType)) ||
    (row.destinationModule !== undefined &&
      row.destinationModule !== null &&
      !isClinicalOrderDestinationModule(row.destinationModule)) ||
    (row.taskId === null || row.taskId === undefined) !==
      (row.taskAttemptNo === null || row.taskAttemptNo === undefined)
  ) {
    return null;
  }
  // system_exam completes in the chart with no fulfillment destination. A
  // queue projection carrying that type is invalid and must fail closed.
  if (row.clinicalOrderType === "system_exam") return null;
  const sourceSnapshot = row.sourceSnapshot as FulfillmentSourceSnapshot;
  const frozenSnapshot =
    asSnapshotRecord(
      (
        row.sourceSnapshot as FulfillmentSourceSnapshot & {
          frozenOrderSnapshot?: unknown;
        }
      ).frozenOrderSnapshot,
    ) ??
    asSnapshotRecord(
      (
        row.sourceSnapshot as FulfillmentSourceSnapshot & {
          appliedSnapshot?: unknown;
        }
      ).appliedSnapshot,
    );
  if (
    readSnapshotString(row.sourceSnapshot, "rowType") === "set" ||
    readSnapshotString(frozenSnapshot, "rowType") === "set" ||
    readSnapshotString(row.sourceSnapshot, "itemKind", "childKind") ===
      "order_set" ||
    readSnapshotString(frozenSnapshot, "itemKind", "childKind") === "order_set"
  ) {
    return null;
  }

  const sourceSnapshotWithoutLineage = { ...sourceSnapshot };
  delete sourceSnapshotWithoutLineage.dispensingLineage;
  const dispensingLineage = getApprovedDispensingLineage(sourceSnapshot);

  return {
    ...row,
    sourceSnapshot: {
      ...sourceSnapshotWithoutLineage,
      ...(dispensingLineage ? { dispensingLineage } : {}),
    },
  } as FulfillmentWorkItem;
}

function getApprovedDispensingLineage(
  sourceSnapshot: Partial<FulfillmentSourceSnapshot>,
) {
  const candidates = [
    sourceSnapshot.dispensingLineage,
    asSnapshotRecord(sourceSnapshot.frozenOrderSnapshot)?.dispensingLineage,
    asSnapshotRecord(
      (
        sourceSnapshot as FulfillmentSourceSnapshot & {
          appliedSnapshot?: unknown;
        }
      ).appliedSnapshot,
    )?.dispensingLineage,
    asSnapshotRecord(sourceSnapshot.sourceOrderSnapshot)?.dispensingLineage,
  ];

  for (const candidate of candidates) {
    const lineage = mapDispensingOrderLineageSnapshot(candidate);
    if (lineage?.clinicalUseAllowed || lineage?.serviceReviewOnly) return lineage;
  }
  return undefined;
}

function isClinicalOrderType(value: unknown): value is ClinicalOrderType {
  return [
    "consultation",
    "clinical_lab",
    "imaging",
    "external_lab",
    "dispensing",
    "treatment",
    "hospitalization",
    "system_exam",
    "other",
  ].includes(String(value));
}

function isClinicalOrderDestinationModule(
  value: unknown,
): value is ClinicalOrderDestinationModule {
  return [
    "consultation",
    "lab",
    "imaging",
    "external_lab",
    "dispensing",
    "treatment",
    "hospitalization",
    "other",
  ].includes(String(value));
}
