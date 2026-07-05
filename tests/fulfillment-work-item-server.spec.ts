import { expect, test } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";

import { createMockLiveAuditAppendGateway } from "../src/features/audit/server-audit-log-persistence-core";
import { createMockWorkspacePermissionAdapter } from "../src/features/auth/permission-resolver";
import { createMockInvoiceCandidateSyncGateway } from "../src/features/billing/server-invoice-candidate-sync-core";
import { createMockChartOrderLifecycleGateway } from "../src/features/chart/server-order-lifecycle-persistence-core";
import {
  createMockFulfillmentWorkItemGateway,
  createSupabaseFulfillmentWorkItemGateway,
  readFulfillmentWorkItems,
  syncVetReviewedBillingCandidates,
  syncFulfillmentWorkItemsFromOrders,
  updateFulfillmentWorkItem,
} from "../src/features/fulfillment/server-fulfillment-work-item-core";
import {
  createDemoLiveNotificationEventStore,
  createDemoLiveNotificationStateStore,
  readLiveNotifications,
} from "../src/features/notifications/server-notifications-core";
import type { GlobalNotification } from "../src/features/notifications/mock-notifications";
import type { NotificationPersistenceGateway } from "../src/features/notifications/server-notification-persistence";

const workspaceId = "clair-demo";
const encounterId = "encounter-coco-260501";
const orderId = "order-coco-maropitant";
const workItemId = `fulfill-${orderId}`;
const migrationPath =
  "supabase/migrations/20260523094400_order_fulfillment_work_item_contract.sql";
const migration = existsSync(migrationPath)
  ? readFileSync(migrationPath, "utf8")
  : "";

test("fulfillment work item routes sync from chart orders, read by queue, and mutate lifecycle", async ({
  request,
}) => {
  const clientSessionId = "fulfillment-work-item-route-notification";
  const statusRank = {
    requested: 0,
    accepted: 1,
    in_progress: 2,
    completed: 3,
    cancelled: 3,
    returned: -1,
  } as const;
  async function readCurrentWorkItemStatus() {
    const response = await request.get(
      `/api/workspaces/${workspaceId}/fulfillment/work-items?queueType=dispensing&encounterId=${encounterId}`,
      { headers: { "x-clair-demo-session-user-id": "user-tech" } },
    );
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      ok: true;
      workItems: Array<{ id: string; status: keyof typeof statusRank }>;
    };

    return body.workItems.find((item) => item.id === workItemId)?.status;
  }
  async function transitionOrReadCurrent({
    body,
    target,
  }: {
    body: Record<string, unknown>;
    target: keyof typeof statusRank;
  }) {
    const response = await request.patch(
      `/api/workspaces/${workspaceId}/fulfillment/work-items/${workItemId}`,
      {
        data: body,
        headers: { "x-clair-demo-session-user-id": "user-tech" },
      },
    );
    if (response.status() === 200) return target;
    if (response.status() === 409) {
      const currentStatus = await readCurrentWorkItemStatus();
      expect(currentStatus).toBeDefined();
      expect(statusRank[currentStatus!]).toBeGreaterThanOrEqual(
        statusRank[target],
      );
      return currentStatus!;
    }

    expect(response.status()).toBe(200);
    return target;
  }
  const unauthenticated = await request.post(
    `/api/workspaces/${workspaceId}/fulfillment/work-items/sync-from-orders`,
    { data: { encounterId, orderIds: [orderId] } },
  );
  expect(unauthenticated.status()).toBe(401);
  await expectJson(unauthenticated, {
    ok: false,
    denialReason: "unauthenticated",
  });

  const synced = await request.post(
    `/api/workspaces/${workspaceId}/fulfillment/work-items/sync-from-orders`,
    {
      data: { encounterId, orderIds: [orderId] },
      headers: { "x-clair-demo-session-user-id": "user-vet" },
    },
  );
  expect(synced.status()).toBe(200);
  const syncedBody = (await synced.json()) as {
    ok: true;
    enforcedBy: string;
    workItems: Array<{
      id: string;
      orderId: string;
      queueType: string;
      sourceSnapshot: { orderDisplayName: string; patientName?: string };
      status: string;
    }>;
  };
  expect(syncedBody.enforcedBy).toBe("fulfillment-work-item-persistence");
  expect(syncedBody.workItems).toEqual([
    expect.objectContaining({
      id: workItemId,
      orderId,
      queueType: "dispensing",
      sourceSnapshot: expect.objectContaining({
        orderDisplayName: "Maropitant 16mg T",
        patientName: "코코",
      }),
    }),
  ]);
  const syncedWorkItem = syncedBody.workItems[0];

  const readBack = await request.get(
    `/api/workspaces/${workspaceId}/fulfillment/work-items?queueType=dispensing&encounterId=${encounterId}`,
    { headers: { "x-clair-demo-session-user-id": "user-tech" } },
  );
  expect(readBack.status()).toBe(200);
  const readBody = (await readBack.json()) as {
    ok: true;
    summary: {
      encounterId?: string;
      queueType: string;
      statusCounts: Record<string, number>;
      totalCount: number;
      workspaceId: string;
    };
    workItems: Array<{ id: string; orderId: string }>;
  };
  expect(readBody.summary).toMatchObject({
    encounterId,
    queueType: "dispensing",
    totalCount: expect.any(Number),
    workspaceId,
  });
  expect(readBody.summary.totalCount).toBe(readBody.workItems.length);
  expect(readBody.summary.statusCounts).toEqual(
    expect.objectContaining({
      requested: expect.any(Number),
      accepted: expect.any(Number),
      in_progress: expect.any(Number),
      completed: expect.any(Number),
      cancelled: expect.any(Number),
      returned: expect.any(Number),
    }),
  );
  expect(readBody.workItems).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: workItemId, orderId }),
    ]),
  );

  if (syncedWorkItem?.status === "completed") {
    return;
  }

  const frontDeskDenied = await request.patch(
    `/api/workspaces/${workspaceId}/fulfillment/work-items/${workItemId}`,
    {
      data: { status: "accepted" },
      headers: { "x-clair-demo-session-user-id": "user-front-desk" },
    },
  );
  expect(frontDeskDenied.status()).toBe(403);
  await expectJson(frontDeskDenied, {
    ok: false,
    denialReason: "permission_missing",
  });

  let currentWorkItemStatus = syncedWorkItem?.status;
  if (currentWorkItemStatus === "returned") {
    const requested = await request.patch(
      `/api/workspaces/${workspaceId}/fulfillment/work-items/${workItemId}`,
      {
        data: { status: "requested" },
        headers: { "x-clair-demo-session-user-id": "user-tech" },
      },
    );
    expect(requested.status()).toBe(200);
    currentWorkItemStatus = "requested";
  }

  if (currentWorkItemStatus === "requested") {
    currentWorkItemStatus = await transitionOrReadCurrent({
      body: { status: "accepted", assignedToUserId: "user-tech" },
      target: "accepted",
    });
  }

  if (currentWorkItemStatus === "accepted") {
    const invalidCompletion = await request.patch(
      `/api/workspaces/${workspaceId}/fulfillment/work-items/${workItemId}`,
      {
        data: { status: "completed" },
        headers: { "x-clair-demo-session-user-id": "user-tech" },
      },
    );
    expect(invalidCompletion.status()).toBe(409);
    await expectJson(invalidCompletion, {
      ok: false,
      denialReason: "invalid_transition",
    });

    currentWorkItemStatus = await transitionOrReadCurrent({
      body: { status: "in_progress" },
      target: "in_progress",
    });
  }

  if (currentWorkItemStatus === "completed") {
    return;
  }

  expect(currentWorkItemStatus).toBe("in_progress");

  const completed = await request.patch(
    `/api/workspaces/${workspaceId}/fulfillment/work-items/${workItemId}`,
    {
      data: { status: "completed" },
      headers: {
        "x-clair-demo-client-session-id": clientSessionId,
        "x-clair-demo-session-user-id": "user-tech",
      },
    },
  );
  expect(completed.status()).toBe(200);
  const completedBody = (await completed.json()) as {
    ok: true;
    downstreamSync?: {
      billingCandidateCount: number;
      lifecycleStatus?: string;
    };
    workItems: Array<{ completedAt?: string | null; status: string }>;
  };
  expect(completedBody.workItems[0]).toMatchObject({
    status: "completed",
  });
  expect(completedBody.workItems[0]?.completedAt).toEqual(expect.any(String));
  expect(completedBody.downstreamSync).toMatchObject({
    billingCandidateCount: 1,
    lifecycleStatus: "completed",
  });

  const lifecycleReadBack = await request.get(
    `/api/workspaces/${workspaceId}/chart/order-lifecycle?encounterId=${encounterId}`,
    { headers: { "x-clair-demo-session-user-id": "user-tech" } },
  );
  expect(lifecycleReadBack.status()).toBe(200);
  const lifecycleReadBody = (await lifecycleReadBack.json()) as {
    ok: true;
    lifecycles: Array<{ orderId: string; status: string }>;
  };
  expect(
    lifecycleReadBody.lifecycles.find((row) => row.orderId === orderId)?.status,
  ).toBe("completed");

  const candidateReadBack = await request.get(
    `/api/workspaces/${workspaceId}/billing/invoice-candidates?encounterId=${encounterId}`,
    { headers: { "x-clair-demo-session-user-id": "user-tech" } },
  );
  expect(candidateReadBack.status()).toBe(200);
  const candidateReadBody = (await candidateReadBack.json()) as {
    ok: true;
    candidates: Array<{ orderId: string }>;
  };
  expect(
    candidateReadBody.candidates.some(
      (candidate) => candidate.orderId === orderId,
    ),
  ).toBe(true);

  const notifications = await request.get(
    `/api/workspaces/${workspaceId}/notifications?filter=all&limit=50`,
    {
      headers: {
        "x-clair-demo-client-session-id": clientSessionId,
        "x-clair-demo-session-user-id": "user-front-desk",
      },
    },
  );
  expect(notifications.status()).toBe(200);
  const notificationBody = (await notifications.json()) as {
    ok: true;
    notifications: Array<{
      badgeCount: boolean;
      eventKey: string;
      sourceEntityId: string | null;
      sourceRoute: string | null;
    }>;
  };
  expect(notificationBody.notifications).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        badgeCount: false,
        eventKey: "billing_waiting_ready",
        sourceEntityId: `billcand-${orderId}`,
        sourceRoute: `/w/${workspaceId}/billing?modulePanel=open&encounterId=${encounterId}`,
      }),
    ]),
  );
});

test("fulfillment core enforces chart sync permission and workspace encounter scope", async () => {
  const frontDeskDenied = await syncFulfillmentWorkItemsFromOrders({
    actorUserId: "user-front-desk",
    workspaceId,
    input: { encounterId, orderIds: [orderId] },
  });
  expect(frontDeskDenied).toMatchObject({
    ok: false,
    status: 403,
    denialReason: "permission_missing",
  });

  const crossWorkspaceDenied = await syncFulfillmentWorkItemsFromOrders({
    actorUserId: "user-vet",
    workspaceId: "other-workspace",
    input: { encounterId, orderIds: [orderId] },
    permissionAdapter: createMockWorkspacePermissionAdapter({
      users: [{ id: "user-vet", status: "active" }],
      memberships: [
        {
          id: "membership-vet-other",
          workspaceId: "other-workspace",
          userId: "user-vet",
          roles: ["vet"],
          status: "active",
        },
      ],
    }),
  });
  expect(crossWorkspaceDenied).toMatchObject({
    ok: false,
    status: 409,
    denialReason: "encounter_unavailable",
  });
});

test("phase-1 treatment fulfillment intentionally shares dispensing permissions", async () => {
  const gateway = createMockFulfillmentWorkItemGateway(
    undefined,
    () => "2026-05-27T04:00:00.000Z",
  );
  const treatmentEncounterId = "encounter-kong-260501";
  const treatmentOrderId = "order-kong-fluid";
  const permissionAdapter = createMockWorkspacePermissionAdapter({
    users: [{ id: "user-dispensing-only", status: "active" }],
    memberships: [
      {
        id: "membership-dispensing-only",
        workspaceId,
        userId: "user-dispensing-only",
        roles: ["technician"],
        status: "active",
      },
    ],
    permissionPolicies: [
      {
        workspaceId,
        role: "technician",
        permissionIds: ["dispensing:view", "dispensing:complete"] as never,
      },
    ],
  });

  const read = await readFulfillmentWorkItems({
    actorUserId: "user-dispensing-only",
    filters: { queueType: "treatment", encounterId: treatmentEncounterId },
    gateway,
    permissionAdapter,
    workspaceId,
  });
  expect(read).toMatchObject({
    ok: true,
    status: 200,
    workItems: [expect.objectContaining({ queueType: "treatment" })],
  });

  const accepted = await updateFulfillmentWorkItem({
    actorUserId: "user-dispensing-only",
    gateway,
    input: { status: "accepted" },
    permissionAdapter,
    workItemId: `fulfill-${treatmentOrderId}`,
    workspaceId,
  });
  expect(accepted).toMatchObject({
    ok: true,
    status: 200,
    workItems: [
      expect.objectContaining({ queueType: "treatment", status: "accepted" }),
    ],
  });
});

test("fulfillment read filters work items by selected operating date", async () => {
  const gateway = createMockFulfillmentWorkItemGateway(
    undefined,
    () => "2026-06-25T01:00:00.000Z",
  );
  await syncFulfillmentWorkItemsFromOrders({
    actorUserId: "user-vet",
    gateway,
    input: { encounterId, orderIds: [orderId] },
    workspaceId,
  });

  const selectedDate = await readFulfillmentWorkItems({
    actorUserId: "user-tech",
    filters: { date: "2026-05-01", queueType: "dispensing" },
    gateway,
    workspaceId,
  });
  const otherDate = await readFulfillmentWorkItems({
    actorUserId: "user-tech",
    filters: { date: "2026-06-25", queueType: "dispensing" },
    gateway,
    workspaceId,
  });

  expect(selectedDate).toMatchObject({ ok: true });
  expect(selectedDate.ok ? selectedDate.summary : null).toMatchObject({
    date: "2026-05-01",
    queueType: "dispensing",
    totalCount: selectedDate.ok ? selectedDate.workItems.length : 0,
    workspaceId,
  });
  expect(selectedDate.ok ? selectedDate.workItems : []).toEqual(
    expect.arrayContaining([expect.objectContaining({ id: workItemId })]),
  );
  expect(otherDate).toMatchObject({
    ok: true,
    summary: {
      date: "2026-06-25",
      queueType: "dispensing",
      statusCounts: {
        accepted: 0,
        cancelled: 0,
        completed: 0,
        in_progress: 0,
        requested: 0,
        returned: 0,
      },
      totalCount: 0,
      workspaceId,
    },
    workItems: [],
  });
});

test("fulfillment read rejects invalid selected operating dates", async () => {
  const result = await readFulfillmentWorkItems({
    actorUserId: "user-tech",
    filters: { date: "2026-6-25", queueType: "dispensing" },
    workspaceId,
  });

  expect(result).toMatchObject({
    ok: false,
    status: 400,
    error: "invalid_input",
    fieldErrors: { date: "invalid_date" },
  });
});

test("fulfillment mock gateway routes catalog snapshots idempotently to downstream queues", async () => {
  const gateway = createMockFulfillmentWorkItemGateway(
    undefined,
    () => "2026-05-26T13:10:00.000Z",
  );
  const catalogOrderId = "catalog-order-den-287-cbc";
  const snapshot = {
    billingName: "CBC 검사",
    billingReflectionEnabled: true,
    destinationModule: "lab",
    inHospitalOrderName: "CBC",
    internalInstruction: "채혈 후 검사실로 전달",
    lineTotalSnapshot: 35000,
    orderId: catalogOrderId,
    priceKrw: 35000,
    quantity: 1,
    sourcePresetId: "std-ord-lab-cbc",
    standardOrderName: "CBC 검사",
    taskRequired: true,
  };

  const first = await gateway.syncFromOrders({
    actorUserId: "user-vet",
    encounterId,
    orderIds: [catalogOrderId],
    orderSnapshots: [snapshot],
    workspaceId,
  });
  const second = await gateway.syncFromOrders({
    actorUserId: "user-vet",
    encounterId,
    orderIds: [catalogOrderId],
    orderSnapshots: [snapshot],
    workspaceId,
  });

  expect(first).toMatchObject({
    ok: true,
    workItems: [
      {
        id: `fulfill-${catalogOrderId}`,
        orderId: catalogOrderId,
        queueType: "lab",
        sourceSnapshot: {
          billingReflectionEnabled: true,
          instruction: "채혈 후 검사실로 전달",
          orderDisplayName: "CBC",
          serviceItemId: "std-ord-lab-cbc",
          detail: {
            billingName: "CBC 검사",
            destinationModule: "lab",
            lineTotalSnapshot: 35000,
            quantity: 1,
            standardOrderName: "CBC 검사",
            unitPriceSnapshot: 35000,
          },
        },
        status: "requested",
      },
    ],
  });
  expect(second).toMatchObject(first);

  const chartOnly = await gateway.syncFromOrders({
    actorUserId: "user-vet",
    encounterId,
    orderIds: ["catalog-order-den-287-chart-only"],
    orderSnapshots: [
      {
        ...snapshot,
        destinationModule: "chart_only",
        orderId: "catalog-order-den-287-chart-only",
      },
    ],
    workspaceId,
  });
  expect(chartOnly).toMatchObject({ ok: true, workItems: [] });
});

test("fulfillment core blocks terminal-state transitions", async () => {
  const gateway = createMockFulfillmentWorkItemGateway(
    undefined,
    () => "2026-05-23T09:44:00.000Z",
  );
  await syncFulfillmentWorkItemsFromOrders({
    actorUserId: "user-vet",
    workspaceId,
    input: { encounterId, orderIds: [orderId] },
    gateway,
  });
  await updateFulfillmentWorkItem({
    actorUserId: "user-tech",
    workspaceId,
    workItemId,
    input: { status: "accepted" },
    gateway,
  });
  await updateFulfillmentWorkItem({
    actorUserId: "user-tech",
    workspaceId,
    workItemId,
    input: { status: "in_progress" },
    gateway,
  });
  await updateFulfillmentWorkItem({
    actorUserId: "user-tech",
    workspaceId,
    workItemId,
    input: { status: "completed" },
    gateway,
  });

  const reopenDenied = await updateFulfillmentWorkItem({
    actorUserId: "user-tech",
    workspaceId,
    workItemId,
    input: { status: "returned" },
    gateway,
  });
  expect(reopenDenied).toMatchObject({
    ok: false,
    status: 409,
    denialReason: "invalid_transition",
  });
});

test("fulfillment completion syncs order lifecycle and billing candidates from server-owned snapshots", async () => {
  const timestamp = () => "2026-05-23T10:40:00.000Z";
  const gateway = createMockFulfillmentWorkItemGateway(undefined, timestamp);
  const lifecycleGateway = createMockChartOrderLifecycleGateway(
    undefined,
    timestamp,
  );
  const invoiceCandidateGateway = createMockInvoiceCandidateSyncGateway(
    undefined,
    timestamp,
  );

  await syncFulfillmentWorkItemsFromOrders({
    actorUserId: "user-vet",
    workspaceId,
    input: { encounterId, orderIds: [orderId] },
    gateway,
  });
  await updateFulfillmentWorkItem({
    actorUserId: "user-tech",
    workspaceId,
    workItemId,
    input: { status: "accepted", assignedToUserId: "user-tech" },
    gateway,
    lifecycleGateway,
    invoiceCandidateGateway,
  });
  await updateFulfillmentWorkItem({
    actorUserId: "user-tech",
    workspaceId,
    workItemId,
    input: { status: "in_progress" },
    gateway,
    lifecycleGateway,
    invoiceCandidateGateway,
  });

  const completed = await updateFulfillmentWorkItem({
    actorUserId: "user-tech",
    workspaceId,
    workItemId,
    input: { status: "completed" },
    gateway,
    lifecycleGateway,
    invoiceCandidateGateway,
    auditNow: timestamp,
  });

  expect(completed).toMatchObject({
    ok: true,
    downstreamSync: {
      auditEventCount: 2,
      billingCandidateCount: 1,
      lifecycleStatus: "completed",
    },
  });

  const lifecycles = await lifecycleGateway.readOrderLifecycles({
    encounterId,
    workspaceId,
  });
  expect(lifecycles).toMatchObject({ ok: true });
  expect(
    lifecycles.ok
      ? lifecycles.lifecycles.find((row) => row.orderId === orderId)?.status
      : null,
  ).toBe("completed");

  const candidates = await invoiceCandidateGateway.listInvoiceCandidates({
    encounterId,
    workspaceId,
  });
  expect(candidates).toMatchObject({ ok: true });
  expect(
    candidates.ok
      ? candidates.candidates.find((candidate) => candidate.orderId === orderId)
      : null,
  ).toMatchObject({
    lineTotal: 4500,
    quantity: 1,
    unitPrice: 4500,
  });
});

test("fulfillment completion emits drawer-only billing-ready notification after candidate sync", async () => {
  const timestamp = () => "2026-05-26T14:40:00.000Z";
  const gateway = createMockFulfillmentWorkItemGateway(undefined, timestamp);
  const lifecycleGateway = createMockChartOrderLifecycleGateway(
    undefined,
    timestamp,
  );
  const invoiceCandidateGateway = createMockInvoiceCandidateSyncGateway(
    undefined,
    timestamp,
  );
  const notificationEventStore = createDemoLiveNotificationEventStore();
  const notificationStateStore = createDemoLiveNotificationStateStore();

  await updateFulfillmentWorkItem({
    actorUserId: "user-tech",
    workspaceId,
    workItemId,
    input: { status: "accepted", assignedToUserId: "user-tech" },
    gateway,
    lifecycleGateway,
    invoiceCandidateGateway,
  });
  await updateFulfillmentWorkItem({
    actorUserId: "user-tech",
    workspaceId,
    workItemId,
    input: { status: "in_progress" },
    gateway,
    lifecycleGateway,
    invoiceCandidateGateway,
  });

  const completed = await updateFulfillmentWorkItem({
    actorUserId: "user-tech",
    workspaceId,
    workItemId,
    input: { status: "completed" },
    gateway,
    lifecycleGateway,
    invoiceCandidateGateway,
    notificationEventStore,
    notificationStateStore,
    emitBillingReadyNotifications: true,
  });

  expect(completed).toMatchObject({
    ok: true,
    downstreamSync: {
      billingCandidateCount: 1,
      billingReadyNotificationCount: 1,
    },
  });

  const frontDeskFeed = await readLiveNotifications({
    actorUserId: "user-front-desk",
    eventStore: notificationEventStore,
    filter: "all",
    notifications: [],
    stateStore: notificationStateStore,
    workspaceId,
  });

  expect(frontDeskFeed).toMatchObject({
    ok: true,
    counts: {
      badge: 0,
      unread: 1,
    },
    notifications: [
      expect.objectContaining({
        badgeCount: false,
        dedupeKey: `${encounterId}-${orderId}-billing_waiting_ready`,
        eventKey: "billing_waiting_ready",
        sourceEntityId: `billcand-${orderId}`,
        sourceRoute: `/w/${workspaceId}/billing?modulePanel=open&encounterId=${encounterId}`,
        toastPolicy: "drawer_only",
      }),
    ],
  });

  const techFeed = await readLiveNotifications({
    actorUserId: "user-tech",
    eventStore: notificationEventStore,
    filter: "all",
    notifications: [],
    stateStore: notificationStateStore,
    workspaceId,
  });

  expect(techFeed).toMatchObject({
    ok: true,
    notifications: [],
  });
});

test("fulfillment completion persists billing-ready notification through the DB gateway", async () => {
  const timestamp = () => "2026-05-26T14:40:00.000Z";
  const gateway = createMockFulfillmentWorkItemGateway(undefined, timestamp);
  const lifecycleGateway = createMockChartOrderLifecycleGateway(
    undefined,
    timestamp,
  );
  const invoiceCandidateGateway = createMockInvoiceCandidateSyncGateway(
    undefined,
    timestamp,
  );
  const persistedEvents: Array<
    Parameters<NotificationPersistenceGateway["emitNotificationEvent"]>[0]
  > = [];
  const notificationPersistenceGateway =
    createRecordingNotificationPersistenceGateway(persistedEvents);

  await updateFulfillmentWorkItem({
    actorUserId: "user-tech",
    workspaceId,
    workItemId,
    input: { status: "accepted", assignedToUserId: "user-tech" },
    gateway,
    lifecycleGateway,
    invoiceCandidateGateway,
  });
  await updateFulfillmentWorkItem({
    actorUserId: "user-tech",
    workspaceId,
    workItemId,
    input: { status: "in_progress" },
    gateway,
    lifecycleGateway,
    invoiceCandidateGateway,
  });

  const completed = await updateFulfillmentWorkItem({
    actorUserId: "user-tech",
    workspaceId,
    workItemId,
    input: { status: "completed" },
    gateway,
    lifecycleGateway,
    invoiceCandidateGateway,
    notificationEventScopeId: null,
    notificationPersistenceGateway,
    emitBillingReadyNotifications: true,
  });

  expect(completed).toMatchObject({
    ok: true,
    downstreamSync: {
      billingCandidateCount: 1,
      billingReadyNotificationCount: 1,
    },
  });
  expect(persistedEvents).toEqual([
    expect.objectContaining({
      actorUserId: "user-tech",
      badgeCount: false,
      dedupeKey: `${encounterId}-${orderId}-billing_waiting_ready`,
      eventKey: "billing_waiting_ready",
      eventScopeId: null,
      recipient: expect.objectContaining({ id: "billing", kind: "role_queue" }),
      source: expect.objectContaining({
        entity_id: `billcand-${orderId}`,
        kind: "billing_candidate",
        route: `/w/${workspaceId}/billing?modulePanel=open&encounterId=${encounterId}`,
      }),
      toastPolicy: "drawer_only",
      workspaceId,
    }),
  ]);
});

test("fulfillment completion keeps source mutation successful when DB notification persistence rejects", async () => {
  const timestamp = () => "2026-05-26T14:40:00.000Z";
  const gateway = createMockFulfillmentWorkItemGateway(undefined, timestamp);
  const lifecycleGateway = createMockChartOrderLifecycleGateway(
    undefined,
    timestamp,
  );
  const invoiceCandidateGateway = createMockInvoiceCandidateSyncGateway(
    undefined,
    timestamp,
  );

  await updateFulfillmentWorkItem({
    actorUserId: "user-tech",
    workspaceId,
    workItemId,
    input: { status: "accepted", assignedToUserId: "user-tech" },
    gateway,
    lifecycleGateway,
    invoiceCandidateGateway,
  });
  await updateFulfillmentWorkItem({
    actorUserId: "user-tech",
    workspaceId,
    workItemId,
    input: { status: "in_progress" },
    gateway,
    lifecycleGateway,
    invoiceCandidateGateway,
  });

  const completed = await updateFulfillmentWorkItem({
    actorUserId: "user-tech",
    workspaceId,
    workItemId,
    input: { status: "completed" },
    gateway,
    lifecycleGateway,
    invoiceCandidateGateway,
    notificationPersistenceGateway: createThrowingNotificationPersistenceGateway(),
    emitBillingReadyNotifications: true,
  });

  expect(completed).toMatchObject({
    ok: true,
    downstreamSync: {
      billingCandidateCount: 1,
      billingReadyNotificationCount: 0,
      lifecycleStatus: "completed",
    },
  });

  const candidates = await invoiceCandidateGateway.listInvoiceCandidates({
    encounterId,
    workspaceId,
  });
  expect(candidates).toMatchObject({
    ok: true,
    candidates: expect.arrayContaining([expect.objectContaining({ orderId })]),
  });
});

test("fulfillment completion holds lab and imaging billing until vet review", async () => {
  const timestamp = () => "2026-05-26T14:40:00.000Z";
  const gateway = createMockFulfillmentWorkItemGateway(undefined, timestamp);
  const lifecycleGateway = createMockChartOrderLifecycleGateway(
    undefined,
    timestamp,
  );
  const invoiceCandidateGateway = createMockInvoiceCandidateSyncGateway(
    undefined,
    timestamp,
  );
  const notificationEventStore = createDemoLiveNotificationEventStore();
  const notificationStateStore = createDemoLiveNotificationStateStore();
  const auditGateway = createMockLiveAuditAppendGateway();
  const labOrderId = "order-kong-cbc";

  const completed = await updateFulfillmentWorkItem({
    actorUserId: "user-tech",
    gateway,
    input: { status: "completed" },
    invoiceCandidateGateway,
    lifecycleGateway,
    workItemId: `fulfill-${labOrderId}`,
    workspaceId,
  });

  expect(completed).toMatchObject({
    ok: true,
    downstreamSync: {
      billingCandidateCount: 0,
      billingSkippedReason: "vet_review_required",
      lifecycleStatus: "completed",
    },
  });

  const reviewed = await syncVetReviewedBillingCandidates({
    actorUserId: "user-vet",
    auditGateway,
    auditNow: timestamp,
    auditRequestId: "req-vet-review-billing",
    emitBillingReadyNotifications: true,
    gateway,
    input: {
      encounterId: "encounter-kong-260501",
      orderIds: [labOrderId],
    },
    invoiceCandidateGateway,
    notificationEventStore,
    notificationStateStore,
    workspaceId,
  });
  expect(reviewed).toMatchObject({
    ok: true,
    auditEventCount: 1,
    billingCandidates: [expect.objectContaining({ orderId: labOrderId })],
    enforcedBy: "fulfillment-vet-review-billing-gate",
    emittedNotifications: { billingWaitingReady: 1 },
    reviewedWorkItems: [expect.objectContaining({ orderId: labOrderId })],
    status: 200,
  });
  expect(auditGateway.events).toEqual([
    expect.objectContaining({
      actorUserId: "user-vet",
      encounterId: "encounter-kong-260501",
      eventType: "billing.invoice_candidate_generated",
      requestId: "req-vet-review-billing",
      targetType: "invoice",
      metadata: expect.objectContaining({
        source: "fulfillment-vet-review-billing-gate",
        workItemId: `fulfill-${labOrderId}`,
      }),
    }),
  ]);

  const frontDeskFeed = await readLiveNotifications({
    actorUserId: "user-front-desk",
    eventStore: notificationEventStore,
    filter: "all",
    notifications: [],
    stateStore: notificationStateStore,
    workspaceId,
  });
  expect(frontDeskFeed).toMatchObject({
    ok: true,
    notifications: [
      expect.objectContaining({
        badgeCount: false,
        dedupeKey: `encounter-kong-260501-${labOrderId}-billing_waiting_ready`,
        eventKey: "billing_waiting_ready",
        sourceEntityId: `billcand-${labOrderId}`,
        sourceRoute: `/w/${workspaceId}/billing?modulePanel=open&encounterId=encounter-kong-260501`,
      }),
    ],
  });

  const directSync = await invoiceCandidateGateway.syncInvoiceCandidates({
    actorUserId: "user-tech",
    encounterId: "encounter-kong-260501",
    orderIds: [labOrderId],
    workspaceId,
  });
  expect(directSync).toMatchObject({
    ok: true,
    candidates: [expect.objectContaining({ orderId: labOrderId })],
  });

  const invalidReview = await syncVetReviewedBillingCandidates({
    actorUserId: "user-vet",
    gateway,
    input: {
      encounterId: "encounter-kong-260501",
      orderIds: ["order-kong-maropitant"],
    },
    invoiceCandidateGateway,
    workspaceId,
  });
  expect(invalidReview).toMatchObject({
    ok: false,
    denialReason: "invalid_review_gate",
    status: 409,
  });
});

test("vet-reviewed billing sync persists billing-ready notification through the DB gateway", async () => {
  const timestamp = () => "2026-05-26T14:40:00.000Z";
  const gateway = createMockFulfillmentWorkItemGateway(undefined, timestamp);
  const invoiceCandidateGateway = createMockInvoiceCandidateSyncGateway(
    undefined,
    timestamp,
  );
  const auditGateway = createMockLiveAuditAppendGateway();
  const persistedEvents: Array<
    Parameters<NotificationPersistenceGateway["emitNotificationEvent"]>[0]
  > = [];
  const notificationPersistenceGateway =
    createRecordingNotificationPersistenceGateway(persistedEvents);
  const labOrderId = "order-kong-cbc";

  await updateFulfillmentWorkItem({
    actorUserId: "user-tech",
    gateway,
    input: { status: "completed" },
    invoiceCandidateGateway,
    lifecycleGateway: createMockChartOrderLifecycleGateway(undefined, timestamp),
    workItemId: `fulfill-${labOrderId}`,
    workspaceId,
  });

  const reviewed = await syncVetReviewedBillingCandidates({
    actorUserId: "user-vet",
    auditGateway,
    auditNow: timestamp,
    auditRequestId: "req-vet-review-billing-persisted",
    emitBillingReadyNotifications: true,
    gateway,
    input: {
      encounterId: "encounter-kong-260501",
      orderIds: [labOrderId],
    },
    invoiceCandidateGateway,
    notificationEventScopeId: null,
    notificationPersistenceGateway,
    workspaceId,
  });

  expect(reviewed).toMatchObject({
    ok: true,
    emittedNotifications: { billingWaitingReady: 1 },
  });
  expect(persistedEvents).toEqual([
    expect.objectContaining({
      actorUserId: "user-vet",
      badgeCount: false,
      dedupeKey: `encounter-kong-260501-${labOrderId}-billing_waiting_ready`,
      eventKey: "billing_waiting_ready",
      eventScopeId: null,
      source: expect.objectContaining({
        entity_id: `billcand-${labOrderId}`,
        kind: "billing_candidate",
        route: `/w/${workspaceId}/billing?modulePanel=open&encounterId=encounter-kong-260501`,
      }),
      workspaceId,
    }),
  ]);
});

test("vet-reviewed billing sync keeps audit and candidate success when DB notification persistence rejects", async () => {
  const timestamp = () => "2026-05-26T14:40:00.000Z";
  const gateway = createMockFulfillmentWorkItemGateway(undefined, timestamp);
  const invoiceCandidateGateway = createMockInvoiceCandidateSyncGateway(
    undefined,
    timestamp,
  );
  const auditGateway = createMockLiveAuditAppendGateway();
  const labOrderId = "order-kong-cbc";

  await updateFulfillmentWorkItem({
    actorUserId: "user-tech",
    gateway,
    input: { status: "completed" },
    invoiceCandidateGateway,
    lifecycleGateway: createMockChartOrderLifecycleGateway(undefined, timestamp),
    workItemId: `fulfill-${labOrderId}`,
    workspaceId,
  });

  const reviewed = await syncVetReviewedBillingCandidates({
    actorUserId: "user-vet",
    auditGateway,
    auditNow: timestamp,
    auditRequestId: "req-vet-review-billing-persisted-failure",
    emitBillingReadyNotifications: true,
    gateway,
    input: {
      encounterId: "encounter-kong-260501",
      orderIds: [labOrderId],
    },
    invoiceCandidateGateway,
    notificationPersistenceGateway: createThrowingNotificationPersistenceGateway(),
    workspaceId,
  });

  expect(reviewed).toMatchObject({
    ok: true,
    auditEventCount: 1,
    billingCandidates: [expect.objectContaining({ orderId: labOrderId })],
    emittedNotifications: { billingWaitingReady: 0 },
  });
  expect(auditGateway.events).toEqual([
    expect.objectContaining({
      actorUserId: "user-vet",
      eventType: "billing.invoice_candidate_generated",
      requestId: "req-vet-review-billing-persisted-failure",
    }),
  ]);
});

test("fulfillment Supabase gateway preserves actor, workspace, encounter, selected orders, and transition payload", async () => {
  const calls: string[] = [];
  const tableUpdates: Array<{ column: string; value: string }[]> = [];
  const gateway = createSupabaseFulfillmentWorkItemGateway({
    from(tableName) {
      expect(tableName).toBe("order_fulfillment_work_items");
      const filters: Array<{ column: string; value: string }> = [];
      const builder = {
        eq(column: string, value: string) {
          filters.push({ column, value });
          return builder;
        },
        then<TResult1 = { error: null }, TResult2 = never>(
          onfulfilled?:
            | ((value: { error: null }) => TResult1 | PromiseLike<TResult1>)
            | null,
          _onrejected?:
            | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
            | null,
        ) {
          void _onrejected;
          tableUpdates.push(filters);
          return Promise.resolve(
            onfulfilled
              ? onfulfilled({ error: null })
              : ({ error: null } as TResult1),
          );
        },
      };
      return {
        update(values) {
          expect(values.source_snapshot).toMatchObject({
            guardianName: "DEN-327 Guardian",
            patientName: "DEN-327 Patient",
            orderDisplayName: "DEN-327 CBC",
          });
          return builder;
        },
      };
    },
    async rpc(functionName: string, args: Record<string, unknown>) {
      calls.push(
        `${functionName}:${args.p_workspace_id}:${args.p_encounter_id ?? args.p_work_item_id}:${args.p_actor_user_id ?? "read"}`,
      );
      return {
        data: [
          {
            id: "00000000-0000-4000-8000-000000000901",
            workspaceId,
            encounterId,
            orderId: "00000000-0000-4000-8000-000000000301",
            orderType: "lab",
            queueType: "lab",
            status: "requested",
            priority: "normal",
            requestedByUserId: "00000000-0000-4000-8000-000000000002",
            assignedToUserId: null,
            dueAt: null,
            completedAt: null,
            cancelledAt: null,
            returnedAt: null,
            reason: null,
            sourceSnapshot: {
              orderDisplayName: "CBC 검사",
              billingReflectionEnabled: true,
              detail: {},
            },
            createdAt: "2026-05-23T09:44:00.000Z",
            updatedAt: "2026-05-23T09:44:00.000Z",
          },
        ],
        error: null,
      };
    },
  });

  const synced = await gateway.syncFromOrders({
    actorUserId: "00000000-0000-4000-8000-000000000002",
    workspaceId,
    encounterId: "00000000-0000-4000-8000-000000000101",
    orderIds: ["00000000-0000-4000-8000-000000000301"],
    orderSnapshots: [
      {
        billingReflectionEnabled: true,
        destinationModule: "lab",
        guardianName: "DEN-327 Guardian",
        inHospitalOrderName: "DEN-327 CBC",
        orderId: "00000000-0000-4000-8000-000000000301",
        patientName: "DEN-327 Patient",
        sourcePresetId: "std-den-327-cbc",
      },
    ],
  });
  const updated = await gateway.updateWorkItem({
    actorUserId: "00000000-0000-4000-8000-000000000003",
    workspaceId,
    workItemId: "00000000-0000-4000-8000-000000000901",
    status: "accepted",
    assignedToUserId: "00000000-0000-4000-8000-000000000003",
  });

  expect(calls).toEqual([
    `clair_sync_fulfillment_work_items_from_orders:${workspaceId}:00000000-0000-4000-8000-000000000101:00000000-0000-4000-8000-000000000002`,
    `clair_update_fulfillment_work_item:${workspaceId}:00000000-0000-4000-8000-000000000901:00000000-0000-4000-8000-000000000003`,
  ]);
  expect(synced).toMatchObject({
    ok: true,
    workItems: [
      {
        queueType: "lab",
        sourceSnapshot: {
          guardianName: "DEN-327 Guardian",
          patientName: "DEN-327 Patient",
          orderDisplayName: "DEN-327 CBC",
        },
      },
    ],
  });
  expect(tableUpdates).toEqual([
    [
      { column: "workspace_id", value: workspaceId },
      {
        column: "order_id",
        value: "00000000-0000-4000-8000-000000000301",
      },
    ],
  ]);
  expect(updated).toMatchObject({
    ok: true,
    workItems: [{ status: "requested" }],
  });
});

test("fulfillment snapshot enrichment does not block order confirmation when table update is denied", async () => {
  const gateway = createSupabaseFulfillmentWorkItemGateway({
    from() {
      const builder = {
        eq() {
          return builder;
        },
        then<TResult1 = { error: { message: string } }, TResult2 = never>(
          onfulfilled?:
            | ((value: {
                error: { message: string };
              }) => TResult1 | PromiseLike<TResult1>)
            | null,
          _onrejected?:
            | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
            | null,
        ) {
          void _onrejected;
          const value = {
            error: {
              message:
                "permission denied for table order_fulfillment_work_items",
            },
          };
          return Promise.resolve(
            onfulfilled ? onfulfilled(value) : (value as TResult1),
          );
        },
      };

      return {
        update() {
          return builder;
        },
      };
    },
    async rpc() {
      return {
        data: [
          {
            id: "00000000-0000-4000-8000-000000000902",
            workspaceId,
            encounterId,
            orderId: "00000000-0000-4000-8000-000000000302",
            orderType: "lab",
            queueType: "lab",
            status: "requested",
            priority: "normal",
            requestedByUserId: "00000000-0000-4000-8000-000000000002",
            assignedToUserId: null,
            dueAt: null,
            completedAt: null,
            cancelledAt: null,
            returnedAt: null,
            reason: null,
            sourceSnapshot: {
              orderDisplayName: "CBC 검사",
              billingReflectionEnabled: true,
              detail: {},
            },
            createdAt: "2026-05-23T09:44:00.000Z",
            updatedAt: "2026-05-23T09:44:00.000Z",
          },
        ],
        error: null,
      };
    },
  });

  const synced = await gateway.syncFromOrders({
    actorUserId: "00000000-0000-4000-8000-000000000002",
    workspaceId,
    encounterId: "00000000-0000-4000-8000-000000000101",
    orderIds: ["00000000-0000-4000-8000-000000000302"],
    orderSnapshots: [
      {
        billingReflectionEnabled: true,
        destinationModule: "lab",
        guardianName: "DEN-327 Guardian",
        inHospitalOrderName: "DEN-327 CBC",
        orderId: "00000000-0000-4000-8000-000000000302",
        patientName: "DEN-327 Patient",
      },
    ],
  });

  expect(synced).toMatchObject({
    ok: true,
    workItems: [
      {
        sourceSnapshot: {
          guardianName: "DEN-327 Guardian",
          patientName: "DEN-327 Patient",
          orderDisplayName: "DEN-327 CBC",
        },
      },
    ],
  });
});

test("fulfillment migration defines local-first schema/RPC boundary without secrets", () => {
  expect(migration).toContain(
    "create table if not exists public.order_fulfillment_work_items",
  );
  expect(migration).toContain(
    "workspace_id text not null references public.workspaces",
  );
  expect(migration).toContain(
    "order_id uuid not null references public.orders",
  );
  expect(migration).toContain("source_snapshot jsonb");
  expect(migration).toContain(
    "private.clair_is_active_workspace_member(p_workspace_id)",
  );
  expect(migration).toContain(
    "create or replace function public.clair_list_fulfillment_work_items",
  );
  expect(migration).toContain(
    "create or replace function public.clair_sync_fulfillment_work_items_from_orders",
  );
  expect(migration).toContain(
    "create or replace function public.clair_update_fulfillment_work_item",
  );
  expect(migration).toContain("private.clair_fulfillment_transition_allowed");
  expect(migration).toContain(
    "grant execute on function public.clair_update_fulfillment_work_item",
  );
  expect(migration).not.toMatch(
    /service[_-]?role|db_password|SUPABASE_SECRET|real patient/i,
  );
});

async function expectJson(
  response: { json(): Promise<unknown> },
  expected: Record<string, unknown>,
) {
  const body = await response.json();
  expect(body).toMatchObject(expected);
}

function createRecordingNotificationPersistenceGateway(
  persistedEvents: Array<
    Parameters<NotificationPersistenceGateway["emitNotificationEvent"]>[0]
  >,
): NotificationPersistenceGateway {
  return {
    async emitNotificationEvent(event) {
      persistedEvents.push(event);
      return {
        ok: true,
        status: 200,
        action: "created",
        notification: { id: `persisted-${event.dedupeKey}` } as GlobalNotification,
        enforcedBy: "notification-event-persistence-gateway",
      };
    },
    async listNotificationEvents() {
      return {
        ok: true,
        status: 200,
        notifications: [],
        enforcedBy: "notification-event-persistence-gateway",
      };
    },
    async listNotificationUserStates() {
      return {
        ok: true,
        status: 200,
        states: [],
        enforcedBy: "notification-user-state-persistence-gateway",
      };
    },
    async upsertNotificationUserState() {
      return {
        ok: true,
        status: 200,
        enforcedBy: "notification-user-state-persistence-gateway",
      };
    },
  };
}

function createThrowingNotificationPersistenceGateway(): NotificationPersistenceGateway {
  return {
    async emitNotificationEvent() {
      throw new Error("simulated notification persistence outage");
    },
    async listNotificationEvents() {
      return {
        ok: true,
        status: 200,
        notifications: [],
        enforcedBy: "notification-event-persistence-gateway",
      };
    },
    async listNotificationUserStates() {
      return {
        ok: true,
        status: 200,
        states: [],
        enforcedBy: "notification-user-state-persistence-gateway",
      };
    },
    async upsertNotificationUserState() {
      return {
        ok: true,
        status: 200,
        enforcedBy: "notification-user-state-persistence-gateway",
      };
    },
  };
}
