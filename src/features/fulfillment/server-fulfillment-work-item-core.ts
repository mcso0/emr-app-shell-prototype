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
import type {
  EmrOrder,
  EmrOrderType,
  Encounter,
  Guardian,
  OrderPriority,
  Patient,
  PermissionId,
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
  guardianName?: string;
  instruction?: string;
  orderDisplayName: string;
  patientName?: string;
  requestingVetName?: string;
  serviceItemId?: string;
};

export type FulfillmentOrderSnapshotInput = {
  billingName?: string;
  billingReflectionEnabled: boolean;
  destinationModule?: string;
  guardianName?: string;
  inHospitalOrderName?: string;
  internalInstruction?: string;
  lineTotalSnapshot?: number;
  orderId: string;
  patientName?: string;
  priceKrw?: number;
  quantity?: number;
  sourcePresetId?: string;
  standardOrderName?: string;
  taskRequired?: boolean;
};

export type FulfillmentWorkItem = {
  assignedToUserId?: string | null;
  cancelledAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  dueAt?: string | null;
  encounterId: string;
  id: string;
  orderId: string;
  orderType: FulfillmentQueueType;
  priority: OrderPriority;
  queueType: FulfillmentQueueType;
  reason?: string | null;
  requestedByUserId: string;
  returnedAt?: string | null;
  sourceSnapshot: FulfillmentSourceSnapshot;
  status: FulfillmentWorkItemStatus;
  updatedAt: string;
  workspaceId: string;
};

export type FulfillmentWorkItemReadSummary = {
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
    | "encounter_unavailable"
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

export type FulfillmentWorkItemGateway = {
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
      fieldErrors: Partial<Record<"status" | "workItemId", string>>;
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
        | "invoice_unavailable"
        | "order_unavailable";
    }
  | { ok: false; status: 500; error: "db_read_failed" | "db_write_failed" };

const fulfillmentMockStore = new Map<string, FulfillmentWorkItem>();

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
    ...(filters.date ? { date: filters.date } : {}),
    ...(filters.encounterId ? { encounterId: filters.encounterId } : {}),
    ...(filters.orderId ? { orderId: filters.orderId } : {}),
    queueType,
    ...(filters.status ? { status: filters.status as FulfillmentWorkItemStatus } : {}),
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

  const permission = resolveWorkspacePermission(permissionAdapter, {
    sessionUserId: actorUserId,
    workspaceId,
    requiredPermission: "chart:update",
  });
  if (!permission.allowed) return mapPermissionDenial(permission.denialReason);

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

  const billingResult = await invoiceCandidateGateway.syncInvoiceCandidates({
    actorUserId: actorUserId ?? "",
    encounterId: normalized.encounterId,
    orderIds: normalized.orderIds,
    orderSnapshots: normalized.orderIds.map((orderId) =>
      mapWorkItemToBillingSnapshot(reviewItemByOrderId.get(orderId)!),
    ),
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
        sourceWorkItems: normalized.orderIds.map(
          (orderId) => reviewItemByOrderId.get(orderId)!,
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
    reviewedWorkItems: normalized.orderIds.map(
      (orderId) => reviewItemByOrderId.get(orderId)!,
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
        .filter((item) => !date || getFulfillmentWorkItemOperatingDate(item) === date)
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
          orderIds.includes(order.id),
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
      if (
        selectedOrders.length !==
        orderIds.filter((orderId) => {
          const snapshot = snapshotByOrderId.get(orderId);
          return !snapshot || isSnapshotFulfillmentRequired(snapshot);
        }).length
      ) {
        return { ok: false, status: 409, denialReason: "order_unavailable" };
      }

      const timestamp = now();
      const workItems = selectedOrders.map(({ order, snapshot }) => {
        if (!isSupportedOrderType(order.orderType)) {
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

      return { ok: true, workItems: [next] };
    },
  };
}

export type SupabaseFulfillmentWorkItemRpcClient = {
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
    functionName: "clair_enrich_fulfillment_work_item_snapshots",
    args: {
      p_workspace_id: string;
      p_actor_user_id: string;
      p_snapshots: Array<{
        orderId: string;
        sourceSnapshot: FulfillmentSourceSnapshot;
      }>;
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
    async syncFromOrders({
      actorUserId,
      encounterId,
      orderIds,
      orderSnapshots,
      workspaceId,
    }) {
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
      const workItems = mapWorkItemRows(data);
      const enriched = await persistSupabaseSnapshotEnrichment({
        actorUserId,
        client,
        orderSnapshots,
        workItems,
        workspaceId,
      });
      return { ok: true, workItems: enriched.workItems };
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

async function persistSupabaseSnapshotEnrichment({
  actorUserId,
  client,
  orderSnapshots,
  workItems,
  workspaceId,
}: {
  actorUserId: string;
  client: SupabaseFulfillmentWorkItemRpcClient;
  orderSnapshots?: FulfillmentOrderSnapshotInput[];
  workItems: FulfillmentWorkItem[];
  workspaceId: string;
}): Promise<{ ok: true; workItems: FulfillmentWorkItem[] }> {
  if (!orderSnapshots?.length || !workItems.length) {
    return { ok: true, workItems };
  }

  const snapshotByOrderId = new Map(
    orderSnapshots.map((snapshot) => [snapshot.orderId, snapshot]),
  );
  const enrichedWorkItems: FulfillmentWorkItem[] = [];
  const snapshots: Array<{
    orderId: string;
    sourceSnapshot: FulfillmentSourceSnapshot;
  }> = [];

  for (const workItem of workItems) {
    const snapshot = snapshotByOrderId.get(workItem.orderId);
    if (!snapshot) {
      enrichedWorkItems.push(workItem);
      continue;
    }

    const sourceSnapshot = mergeOrderSnapshotIntoSourceSnapshot(
      workItem.sourceSnapshot,
      snapshot,
    );
    const nextWorkItem = { ...workItem, sourceSnapshot };
    snapshots.push({
      orderId: normalizeUuidForRpc(workItem.orderId) ?? workItem.orderId,
      sourceSnapshot,
    });
    enrichedWorkItems.push(nextWorkItem);
  }

  if (!snapshots.length) return { ok: true, workItems: enrichedWorkItems };

  const { data, error } = await client.rpc(
    "clair_enrich_fulfillment_work_item_snapshots",
    {
      p_workspace_id: workspaceId,
      p_actor_user_id: actorUserId,
      p_snapshots: snapshots,
    },
  );

  if (error) return { ok: true, workItems: enrichedWorkItems };

  const persistedWorkItems = mapWorkItemRows(data);
  return {
    ok: true,
    workItems: persistedWorkItems.length ? persistedWorkItems : enrichedWorkItems,
  };
}

function mergeOrderSnapshotIntoSourceSnapshot(
  sourceSnapshot: FulfillmentSourceSnapshot,
  orderSnapshot: FulfillmentOrderSnapshotInput,
): FulfillmentSourceSnapshot {
  return {
    ...sourceSnapshot,
    billingReflectionEnabled:
      orderSnapshot.billingReflectionEnabled ??
      sourceSnapshot.billingReflectionEnabled,
    detail: {
      ...sourceSnapshot.detail,
      billingName: orderSnapshot.billingName,
      destinationModule: orderSnapshot.destinationModule,
      lineTotalSnapshot: orderSnapshot.lineTotalSnapshot,
      quantity: orderSnapshot.quantity,
      standardOrderName: orderSnapshot.standardOrderName,
      unitPriceSnapshot: orderSnapshot.priceKrw,
    },
    guardianName: orderSnapshot.guardianName ?? sourceSnapshot.guardianName,
    instruction:
      orderSnapshot.internalInstruction ?? sourceSnapshot.instruction,
    orderDisplayName:
      orderSnapshot.inHospitalOrderName ?? sourceSnapshot.orderDisplayName,
    patientName: orderSnapshot.patientName ?? sourceSnapshot.patientName,
    serviceItemId: orderSnapshot.sourcePresetId ?? sourceSnapshot.serviceItemId,
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
      if (!encounter || !isSupportedOrderType(order.orderType)) return null;
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
      billingReflectionEnabled: orderSnapshot?.billingReflectionEnabled ?? true,
      detail: buildSnapshotDetail(order, orderSnapshot),
      guardianName: orderSnapshot?.guardianName ?? guardian?.name,
      instruction: orderSnapshot?.internalInstruction ?? order.instruction,
      orderDisplayName: orderSnapshot?.inHospitalOrderName ?? order.displayName,
      patientName: orderSnapshot?.patientName ?? patient?.name,
      serviceItemId: orderSnapshot?.sourcePresetId ?? order.serviceItemId,
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
        | "encounter_unavailable"
        | "order_unavailable"
        | "invalid_transition";
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
    const billingReadyNotificationCount = await emitBillingWaitingReadyNotifications({
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
    return { ok: false as const, status: 500 as const, error: "db_write_failed" as const };
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
  return {
    billingName:
      typeof detail.billingName === "string" ? detail.billingName : undefined,
    billingReflectionEnabled: workItem.sourceSnapshot.billingReflectionEnabled,
    destinationModule:
      typeof detail.destinationModule === "string"
        ? detail.destinationModule
        : workItem.queueType,
    inHospitalOrderName: workItem.sourceSnapshot.orderDisplayName,
    lineTotalSnapshot:
      typeof detail.lineTotalSnapshot === "number"
        ? detail.lineTotalSnapshot
        : undefined,
    orderId: workItem.orderId,
    priceKrw:
      typeof detail.unitPriceSnapshot === "number"
        ? detail.unitPriceSnapshot
        : undefined,
    quantity: typeof detail.quantity === "number" ? detail.quantity : undefined,
    sourcePresetId: workItem.sourceSnapshot.serviceItemId,
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
) {
  return {
    billingName: orderSnapshot?.billingName,
    destinationModule: orderSnapshot?.destinationModule,
    lineTotalSnapshot: orderSnapshot?.lineTotalSnapshot,
    orderType: order.orderType,
    priority: order.priority,
    quantity: orderSnapshot?.quantity,
    standardOrderName: orderSnapshot?.standardOrderName,
    unitPriceSnapshot: orderSnapshot?.priceKrw,
    warningMessage: order.warningMessage,
  };
}

function isSnapshotFulfillmentRequired(
  snapshot: FulfillmentOrderSnapshotInput,
) {
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
    serviceItemId: snapshot.sourcePresetId,
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
  return getOperatingDateFromIso(item.dueAt ?? undefined) ?? getOperatingDateFromIso(item.createdAt);
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
      | FulfillmentQueueType
      | undefined,
    status: trimToUndefined(input.status) as
      | FulfillmentWorkItemStatus
      | undefined,
  };
}

function validateReadFilters(input: ReturnType<typeof normalizeFilters>) {
  const fieldErrors: Partial<Record<"date" | "queueType" | "status", string>> = {};
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
  const fieldErrors: Partial<Record<"status" | "workItemId", string>> = {};
  if (!input.workItemId) fieldErrors.workItemId = "업무 항목을 선택해 주세요.";
  if (!input.status || !isFulfillmentStatus(input.status)) {
    fieldErrors.status = "변경할 상태를 선택해 주세요.";
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

function isSupportedOrderType(value: unknown): value is FulfillmentQueueType {
  return (
    value === "lab" ||
    value === "imaging" ||
    value === "dispensing" ||
    value === "treatment"
  );
}

function isFulfillmentStatus(
  value: unknown,
): value is FulfillmentWorkItemStatus {
  return fulfillmentStatuses.includes(value as FulfillmentWorkItemStatus);
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

  return row as FulfillmentWorkItem;
}
