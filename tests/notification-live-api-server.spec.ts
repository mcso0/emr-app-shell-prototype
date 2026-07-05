import { expect, test } from "@playwright/test";

import { createMockWorkspacePermissionAdapter } from "../src/features/auth/permission-resolver";
import { mockGlobalNotifications } from "../src/features/notifications/mock-notifications";
import {
  archiveLiveNotification,
  createDemoLiveNotificationEventStore,
  createDemoLiveNotificationStateStore,
  createDemoNotificationPermissionAdapter,
  emitLiveNotificationEvent,
  markAllLiveNotificationsRead,
  markLiveNotificationRead,
  readLiveNotificationCounts,
  readLiveNotifications,
  restoreLiveNotification,
} from "../src/features/notifications/server-notifications-core";

const workspaceId = "clair-demo";
const actorUserId = "user-vet";

test("live notification core filters by workspace membership and recipient ownership", async () => {
  const denied = await readLiveNotifications({
    actorUserId,
    workspaceId,
    permissionAdapter: createMockWorkspacePermissionAdapter({
      users: [{ id: actorUserId, status: "active" }],
      memberships: [],
    }),
  });

  expect(denied).toMatchObject({
    ok: false,
    status: 403,
    denialReason: "workspace_membership_missing",
  });

  const result = await readLiveNotifications({
    actorUserId,
    workspaceId,
    permissionAdapter: createDemoNotificationPermissionAdapter(),
  });

  expect(result).toMatchObject({
    ok: true,
    status: 200,
    enforcedBy: "live-notification-reader",
    workspaceId,
  });
  expect(result.ok && result.notifications.map((notification) => notification.id)).toEqual([
    "notif-lab-result-kong",
    "notif-assigned-order-completed-lulu-fluid",
  ]);
});

test("live notification DTO returns safe display fields and suppresses unsafe source routes", async () => {
  const sourceMismatchNotification = {
    ...mockGlobalNotifications.find((notification) => notification.id === "notif-lab-result-kong")!,
    id: "notif-cross-workspace-source",
    source: {
      kind: "lab_result" as const,
      route: "/w/workspace-other/lab?modulePanel=open&labResultId=lab-result-kong-cbc",
      entity_id: "lab-result-kong-cbc",
    },
  };

  const result = await readLiveNotifications({
    actorUserId,
    workspaceId,
    notifications: [sourceMismatchNotification],
    permissionAdapter: createDemoNotificationPermissionAdapter(),
  });

  expect(result.ok && result.notifications[0]).toMatchObject({
    id: "notif-cross-workspace-source",
    issuedAtLabel: "7분 전",
    recipientLabel: "담당 수의사",
    sourceKind: "lab_result",
    sourceRoute: null,
    workTypeLabel: "검사",
    fallbackReason: "permission_unavailable",
  });
  expect(result.ok && result.notifications[0]).not.toHaveProperty("patient_context");
  expect(result.ok && result.notifications[0]).not.toHaveProperty("order_context");
});

test("live notification reader hides source rows when effective source permission is missing", async () => {
  const billingNotification = mockGlobalNotifications.find(
    (notification) => notification.id === "notif-billing-ready-gamja",
  )!;
  const result = await readLiveNotifications({
    actorUserId: "user-desk-no-billing",
    workspaceId,
    notifications: [billingNotification],
    permissionAdapter: createMockWorkspacePermissionAdapter({
      users: [{ id: "user-desk-no-billing", status: "active" }],
      memberships: [
        {
          id: "membership-desk-no-billing",
          workspaceId,
          userId: "user-desk-no-billing",
          roles: ["front_desk"],
          permissionRole: {
            key: "desk-no-billing",
            label: "Desk without billing",
            permissionIds: ["reception:view"],
            roleType: "custom",
          },
          status: "active",
        },
      ],
    }),
  });

  expect(result).toMatchObject({
    ok: true,
    counts: {
      badge: 0,
      unread: 0,
    },
    notifications: [],
  });
});

test("live notification core allows hospital admin to review role and direct-user operational notifications", async () => {
  const result = await readLiveNotifications({
    actorUserId: "user-admin",
    workspaceId,
    permissionAdapter: createDemoNotificationPermissionAdapter(),
  });

  expect(result).toMatchObject({
    ok: true,
    status: 200,
    counts: {
      badge: 7,
      unread: 9,
      important: 7,
      archived: 1,
    },
  });
  expect(result.ok && result.notifications).toHaveLength(9);
  expect(result.ok && result.notifications.map((notification) => notification.id)).toContain(
    "notif-assigned-order-completed-lulu-fluid",
  );
});

test("live notification read and archive state is per user", async () => {
  const stateStore = createDemoLiveNotificationStateStore();
  const firstRead = await readLiveNotifications({
    actorUserId,
    workspaceId,
    permissionAdapter: createDemoNotificationPermissionAdapter(),
    stateStore,
  });

  expect(firstRead.ok && firstRead.counts.badge).toBe(2);

  const read = await markLiveNotificationRead({
    actorUserId,
    notificationId: "notif-lab-result-kong",
    workspaceId,
    permissionAdapter: createDemoNotificationPermissionAdapter(),
    stateStore,
  });

  expect(read).toMatchObject({ ok: true, status: 200 });

  const afterRead = await readLiveNotificationCounts({
    actorUserId,
    workspaceId,
    permissionAdapter: createDemoNotificationPermissionAdapter(),
    stateStore,
  });
  expect(afterRead.ok && afterRead.counts.badge).toBe(1);
  expect(afterRead.ok && afterRead.counts.unread).toBe(1);

  const archived = await archiveLiveNotification({
    actorUserId,
    notificationId: "notif-assigned-order-completed-lulu-fluid",
    workspaceId,
    permissionAdapter: createDemoNotificationPermissionAdapter(),
    stateStore,
  });
  expect(archived).toMatchObject({ ok: true, status: 200 });

  const archiveFilter = await readLiveNotifications({
    actorUserId,
    workspaceId,
    filter: "archived",
    permissionAdapter: createDemoNotificationPermissionAdapter(),
    stateStore,
  });
  expect(archiveFilter.ok && archiveFilter.notifications.map((notification) => notification.id)).toContain(
    "notif-assigned-order-completed-lulu-fluid",
  );

  const restored = await restoreLiveNotification({
    actorUserId,
    notificationId: "notif-assigned-order-completed-lulu-fluid",
    workspaceId,
    permissionAdapter: createDemoNotificationPermissionAdapter(),
    stateStore,
  });
  expect(restored).toMatchObject({ ok: true, status: 200 });

  const afterRestore = await readLiveNotificationCounts({
    actorUserId,
    workspaceId,
    permissionAdapter: createDemoNotificationPermissionAdapter(),
    stateStore,
  });
  expect(afterRestore.ok && afterRestore.counts).toMatchObject({
    badge: 0,
    unread: 0,
  });

  const readAll = await markAllLiveNotificationsRead({
    actorUserId,
    workspaceId,
    permissionAdapter: createDemoNotificationPermissionAdapter(),
    stateStore,
  });
  expect(readAll).toMatchObject({ ok: true, status: 200, updatedCount: 0 });

  const afterReadAll = await readLiveNotificationCounts({
    actorUserId,
    workspaceId,
    permissionAdapter: createDemoNotificationPermissionAdapter(),
    stateStore,
  });
  expect(afterReadAll.ok && afterReadAll.counts).toMatchObject({
    badge: 0,
    unread: 0,
  });
});

test("live notification event producer upserts safe server notifications and reopens read state", async () => {
  const eventStore = createDemoLiveNotificationEventStore();
  const stateStore = createDemoLiveNotificationStateStore();
  const permissionAdapter = createDemoNotificationPermissionAdapter();
  const event = {
    workspaceId,
    eventKey: "waiting_over_30m" as const,
    dedupeKey: "patient-mango-waiting_over_30m",
    domain: "reception" as const,
    priority: "high" as const,
    toastPolicy: "role_active" as const,
    title: "망고 대기 시간이 30분을 넘었습니다",
    preview: "데스크 안내 필요 · 보호자에게 예상 대기 시간을 안내해 주세요.",
    detail: "망고 보호자가 30분 넘게 대기 중입니다. 접수 화면에서 대기 상태를 확인하세요.",
    workTypeLabel: "접수",
    sourceLabel: "접수 대기 · 망고",
    sourceActionLabel: "접수 대기 열기",
    recipient: { kind: "role_queue" as const, id: "desk", label: "데스크 역할" },
    source: {
      kind: "reception_queue" as const,
      route: "/w/clair-demo/reception?modulePanel=open&encounterId=encounter-mango-260705",
      entity_id: "encounter-mango-260705",
    },
    requiresAction: true,
    badgeCount: true,
    occurredAt: "2026-07-05T09:30:00.000+09:00",
    issuedAtLabel: "방금 전",
  };

  const created = emitLiveNotificationEvent({ event, eventStore, stateStore });
  expect(created).toMatchObject({
    ok: true,
    action: "created",
    enforcedBy: "live-notification-producer",
  });

  const firstRead = await readLiveNotifications({
    actorUserId: "user-front-desk",
    workspaceId,
    eventStore,
    notifications: [],
    permissionAdapter,
    stateStore,
  });
  expect(firstRead).toMatchObject({
    ok: true,
    counts: {
      badge: 1,
      unread: 1,
      important: 1,
    },
  });
  expect(firstRead.ok && firstRead.notifications[0]).toMatchObject({
    id: "notif-live-patient-mango-waiting-over-30m",
    eventKey: "waiting_over_30m",
    sourceRoute: "/w/clair-demo/reception?modulePanel=open&encounterId=encounter-mango-260705",
    title: "망고 대기 시간이 30분을 넘었습니다",
    workTypeLabel: "접수",
  });
  expect(firstRead.ok && firstRead.notifications[0]).not.toHaveProperty("patient_context");

  await markLiveNotificationRead({
    actorUserId: "user-front-desk",
    notificationId: "notif-live-patient-mango-waiting-over-30m",
    workspaceId,
    eventStore,
    notifications: [],
    permissionAdapter,
    stateStore,
  });

  const afterRead = await readLiveNotificationCounts({
    actorUserId: "user-front-desk",
    workspaceId,
    eventStore,
    notifications: [],
    permissionAdapter,
    stateStore,
  });
  expect(afterRead.ok && afterRead.counts.badge).toBe(0);

  const bumped = emitLiveNotificationEvent({
    event: {
      ...event,
      detail: "망고 보호자가 추가 안내 없이 계속 대기 중입니다. 접수 화면에서 즉시 확인하세요.",
      occurredAt: "2026-07-05T09:35:00.000+09:00",
    },
    eventStore,
    stateStore,
  });
  expect(bumped).toMatchObject({
    ok: true,
    action: "bumped",
  });

  const afterBump = await readLiveNotifications({
    actorUserId: "user-front-desk",
    workspaceId,
    eventStore,
    notifications: [],
    permissionAdapter,
    stateStore,
  });
  expect(afterBump.ok && afterBump.counts).toMatchObject({
    badge: 1,
    unread: 1,
  });
  expect(afterBump.ok && afterBump.notifications).toHaveLength(1);
  expect(afterBump.ok && afterBump.notifications[0]).toMatchObject({
    bumpCount: 2,
    detail: "망고 보호자가 추가 안내 없이 계속 대기 중입니다. 접수 화면에서 즉시 확인하세요.",
    readAt: null,
    updatedAt: "2026-07-05T09:35:00.000+09:00",
  });
});

test("scoped produced event bumps do not clear read state from another demo client session", async () => {
  const eventStore = createDemoLiveNotificationEventStore();
  const stateStore = createDemoLiveNotificationStateStore();
  const permissionAdapter = createDemoNotificationPermissionAdapter();
  const event = {
    workspaceId,
    eventKey: "billing_waiting_ready" as const,
    dedupeKey: "encounter-scope-test-order-scope-test-billing_waiting_ready",
    domain: "billing" as const,
    priority: "reference" as const,
    toastPolicy: "drawer_only" as const,
    title: "스코프 테스트 수납 준비가 완료되었습니다",
    preview: "완료된 오더가 수납 후보에 반영되었습니다.",
    detail: "스코프 테스트 오더가 수납 후보에 반영되었습니다.",
    workTypeLabel: "수납",
    sourceLabel: "수납 · 후보 목록",
    sourceActionLabel: "수납 후보 열기",
    recipient: { kind: "role_queue" as const, id: "billing", label: "수납" },
    source: {
      kind: "billing_candidate" as const,
      route: "/w/clair-demo/billing?modulePanel=open&encounterId=encounter-scope-test",
      entity_id: "billcand-order-scope-test",
    },
    requiresAction: false,
    badgeCount: false,
    occurredAt: "2026-07-05T09:30:00.000+09:00",
    issuedAtLabel: "방금 전",
  };

  emitLiveNotificationEvent({
    event: { ...event, eventScopeId: "scope-a" },
    eventStore,
    stateStore,
  });
  emitLiveNotificationEvent({
    event: { ...event, eventScopeId: "scope-b" },
    eventStore,
    stateStore,
  });

  await markLiveNotificationRead({
    actorUserId: "user-front-desk",
    eventScopeId: "scope-b",
    eventStore,
    notificationId:
      "notif-live-encounter-scope-test-order-scope-test-billing-waiting-ready",
    notifications: [],
    permissionAdapter,
    stateScopeId: "user-front-desk:scope-b",
    stateStore,
    workspaceId,
  });

  emitLiveNotificationEvent({
    event: {
      ...event,
      detail: "스코프 A에서만 수납 후보 알림이 갱신되었습니다.",
      eventScopeId: "scope-a",
      occurredAt: "2026-07-05T09:35:00.000+09:00",
    },
    eventStore,
    stateStore,
  });

  const scopeBRead = await readLiveNotifications({
    actorUserId: "user-front-desk",
    eventScopeId: "scope-b",
    eventStore,
    notifications: [],
    permissionAdapter,
    stateScopeId: "user-front-desk:scope-b",
    stateStore,
    workspaceId,
  });

  expect(scopeBRead).toMatchObject({
    ok: true,
    counts: {
      badge: 0,
      unread: 0,
    },
    notifications: [
      expect.objectContaining({
        detail: "스코프 테스트 오더가 수납 후보에 반영되었습니다.",
        readAt: expect.any(String),
      }),
    ],
  });
});

test("live notification list API returns enforced counts for demo actor", async ({ request }) => {
  const response = await request.get(`/api/workspaces/${workspaceId}/notifications?filter=unread`, {
    headers: { "x-clair-demo-session-user-id": actorUserId },
  });

  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body).toMatchObject({
    ok: true,
    enforcedBy: "live-notification-reader",
    counts: {
      badge: 2,
      unread: 2,
    },
  });
  expect(body.notifications.map((notification: { id: string }) => notification.id)).toEqual([
    "notif-lab-result-kong",
    "notif-assigned-order-completed-lulu-fluid",
  ]);
});
