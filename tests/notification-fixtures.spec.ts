import { expect, test } from "@playwright/test";
import {
  applyNotificationLocalState,
  NOTIFICATION_ARCHIVE_STATE_KEY,
  NOTIFICATION_READ_STATE_KEY,
  createNotificationDedupeKey,
  demoNotificationRecipientContext,
  getInitialNotificationLocalState,
  getWorkspaceScopedNotifications,
  type GlobalNotification,
  mockGlobalNotifications,
  readNotificationLocalState,
  resolveNotificationBadgeCount,
  resolveNotificationRecipientRule,
  shouldCountNotificationBadge,
  upsertNotificationByDedupeKey,
  writeNotificationLocalState,
} from "../src/features/notifications/mock-notifications";

const v0EventKeys = [
  "order_urgent_handoff",
  "order_recheck_requested",
  "assigned_order_completed",
  "clinical_result_completed",
  "device_result_received",
  "imaging_result_completed",
  "waiting_over_30m",
  "dispensing_treatment_completed",
  "billing_waiting_ready",
  "inpatient_care_delayed",
] as const;

const validSourceKinds = [
  "order",
  "lab_result",
  "imaging_result",
  "reception_queue",
  "dispensing_treatment",
  "billing_candidate",
  "inpatient_care",
  "fallback_detail",
] as const;

class MemoryStorage implements Storage {
  private values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

test("notification fixtures cover every v0 event key with required contract fields", () => {
  const eventKeys = new Set(mockGlobalNotifications.map((notification) => notification.event_key));

  for (const eventKey of v0EventKeys) {
    expect(eventKeys.has(eventKey), `${eventKey} fixture exists`).toBe(true);
  }

  for (const notification of mockGlobalNotifications) {
    expect(notification.id).toBeTruthy();
    expect(notification.dedupe_key).toBeTruthy();
    expect(notification.title).toBeTruthy();
    expect(notification.preview).toBeTruthy();
    expect(notification.recipient.id).toBeTruthy();
    expect(notification.source.kind).toBeTruthy();
    expect(validSourceKinds).toContain(notification.source.kind);
    expect(notification.created_at).toBeTruthy();
    expect(notification.updated_at).toBeTruthy();
    expect(notification.read_state_key).toBe("clair.notifications.v0.read");
    expect(notification.archive_state_key).toBe("clair.notifications.v0.archive");

    if (notification.source.kind === "fallback_detail") {
      expect(notification.source.route).toBeUndefined();
      expect(notification.source.fallback_reason).toBeTruthy();
    }
  }
});

test("notification fixtures route every source to a workspace route or explicit fallback", () => {
  for (const notification of mockGlobalNotifications) {
    if (notification.source.kind === "fallback_detail") {
      expect(notification.source.route).toBeUndefined();
      expect(notification.source.fallback_reason).toBeTruthy();
      continue;
    }

    expect(notification.source.route, `${notification.id} has a source route`).toBeTruthy();
    expect(notification.source.route).toMatch(/^\/w\/clair-demo\/[a-z-]+/);
  }
});

test("notification source routes can be scoped to the active workspace", () => {
  const workspaceId = "workspace-demo-active";
  const notifications = getWorkspaceScopedNotifications(workspaceId);

  expect(notifications).toHaveLength(mockGlobalNotifications.length);

  for (const notification of notifications) {
    if (notification.source.kind === "fallback_detail") {
      expect(notification.source.route).toBeUndefined();
      continue;
    }

    expect(notification.source.route).toMatch(new RegExp(`^/w/${workspaceId}/[a-z-]+`));
    expect(notification.source.route).not.toContain("/w/clair-demo");
  }
});

test("notification fixtures preserve badge policy for unread reference rows", () => {
  const referenceEventKeys = ["dispensing_treatment_completed", "billing_waiting_ready"];
  const referenceNotifications = mockGlobalNotifications.filter((notification) =>
    referenceEventKeys.includes(notification.event_key)
  );

  expect(referenceNotifications.length).toBe(referenceEventKeys.length);

  for (const notification of referenceNotifications) {
    expect(notification.unread).toBe(true);
    expect(notification.requires_action).toBe(false);
    expect(notification.badge_count).toBe(false);
  }

  expect(resolveNotificationBadgeCount(mockGlobalNotifications)).toBe(
    mockGlobalNotifications.filter((notification) =>
      shouldCountNotificationBadge(notification, demoNotificationRecipientContext)
    ).length
  );
});

test("notification recipient rules distinguish direct user, active role, and local role queue ownership", () => {
  const directUserNotification = mockGlobalNotifications.find(
    (notification) => notification.id === "notif-assigned-order-completed-lulu-fluid"
  );
  const activeRoleNotification = mockGlobalNotifications.find(
    (notification) => notification.id === "notif-lab-result-kong"
  );
  const roleQueueNotification = mockGlobalNotifications.find(
    (notification) => notification.id === "notif-waiting-bori"
  );
  const referenceRoleQueueNotification = mockGlobalNotifications.find(
    (notification) => notification.id === "notif-billing-ready-gamja"
  );

  expect(directUserNotification).toBeTruthy();
  expect(activeRoleNotification).toBeTruthy();
  expect(roleQueueNotification).toBeTruthy();
  expect(referenceRoleQueueNotification).toBeTruthy();

  expect(
    resolveNotificationRecipientRule(directUserNotification!, {
      userId: "user-vet",
      activeRoleIds: [],
    })
  ).toMatchObject({
    recipientMatched: true,
    actionOwned: true,
    badgeEligible: true,
    ownership: "direct_user",
  });

  expect(
    resolveNotificationRecipientRule(directUserNotification!, {
      userId: "user-other",
      activeRoleIds: ["vet"],
    })
  ).toMatchObject({
    recipientMatched: false,
    badgeEligible: false,
    ownership: "not_recipient",
  });

  expect(
    resolveNotificationRecipientRule(activeRoleNotification!, {
      activeRoleIds: ["vet"],
    })
  ).toMatchObject({
    recipientMatched: true,
    actionOwned: true,
    badgeEligible: true,
    ownership: "active_role",
  });

  expect(
    resolveNotificationRecipientRule(roleQueueNotification!, {
      activeRoleIds: ["desk"],
      includeRoleQueue: true,
    })
  ).toMatchObject({
    recipientMatched: true,
    actionOwned: true,
    badgeEligible: true,
    ownership: "role_queue",
  });

  expect(
    resolveNotificationRecipientRule(roleQueueNotification!, {
      activeRoleIds: ["desk"],
      includeRoleQueue: false,
    })
  ).toMatchObject({
    recipientMatched: false,
    badgeEligible: false,
    ownership: "not_recipient",
  });

  expect(
    resolveNotificationRecipientRule(referenceRoleQueueNotification!, {
      activeRoleIds: ["billing"],
      includeRoleQueue: true,
    })
  ).toMatchObject({
    recipientMatched: false,
    actionOwned: false,
    badgeEligible: false,
    ownership: "not_recipient",
  });
});

test("notification badge count uses recipient ownership, unread state, archive state, and badge_count only", () => {
  expect(resolveNotificationBadgeCount(mockGlobalNotifications)).toBe(7);

  expect(
    resolveNotificationBadgeCount(mockGlobalNotifications, {
      userId: "user-vet",
      activeRoleIds: [],
    })
  ).toBe(1);

  expect(
    resolveNotificationBadgeCount(mockGlobalNotifications, {
      activeRoleIds: ["lab"],
      includeRoleQueue: true,
    })
  ).toBe(3);

  expect(
    resolveNotificationBadgeCount(mockGlobalNotifications, {
      activeRoleIds: ["billing"],
      includeRoleQueue: true,
    })
  ).toBe(0);

  expect(
    resolveNotificationBadgeCount(mockGlobalNotifications, {
      activeRoleIds: ["imaging"],
      includeRoleQueue: true,
    })
  ).toBe(0);
});

test("notification badge count excludes read, archived, and reference-only unread rows", () => {
  const notifications = mockGlobalNotifications.map((notification) => {
    if (notification.id === "notif-order-urgent-handoff-kong-cbc") {
      return { ...notification, archived: true };
    }

    if (notification.id === "notif-lab-result-kong") {
      return { ...notification, unread: false };
    }

    return notification;
  });
  const unreadRows = notifications.filter((notification) => notification.unread && !notification.archived);

  expect(unreadRows).toHaveLength(7);
  expect(resolveNotificationBadgeCount(notifications)).toBe(5);
  expect(
    shouldCountNotificationBadge(
      notifications.find((notification) => notification.id === "notif-billing-ready-gamja")!,
      demoNotificationRecipientContext
    )
  ).toBe(false);
});

test("notification local state falls back safely and ignores unknown persisted ids", () => {
  const storage = new MemoryStorage();
  const initialState = getInitialNotificationLocalState(mockGlobalNotifications);

  expect(readNotificationLocalState(storage, mockGlobalNotifications)).toEqual(initialState);

  storage.setItem(
    NOTIFICATION_READ_STATE_KEY,
    JSON.stringify(["missing-notification", "notif-order-urgent-handoff-kong-cbc"])
  );
  storage.setItem(NOTIFICATION_ARCHIVE_STATE_KEY, "not-json");

  expect(readNotificationLocalState(storage, mockGlobalNotifications)).toEqual({
    readIds: ["notif-order-urgent-handoff-kong-cbc"],
    archivedIds: initialState.archivedIds,
  });
});

test("notification local state writes contract keys and applies read/archive state", () => {
  const storage = new MemoryStorage();
  const localState = {
    readIds: ["notif-order-urgent-handoff-kong-cbc"],
    archivedIds: ["notif-imaging-completed-choco", "notif-order-urgent-handoff-kong-cbc"],
  };

  writeNotificationLocalState(storage, localState);

  expect(storage.getItem(NOTIFICATION_READ_STATE_KEY)).toBe(JSON.stringify(localState.readIds));
  expect(storage.getItem(NOTIFICATION_ARCHIVE_STATE_KEY)).toBe(JSON.stringify(localState.archivedIds));
  expect(readNotificationLocalState(storage, mockGlobalNotifications)).toEqual(localState);

  const notifications = applyNotificationLocalState(mockGlobalNotifications, localState);
  const urgentNotification = notifications.find(
    (notification) => notification.id === "notif-order-urgent-handoff-kong-cbc"
  );
  const labNotification = notifications.find((notification) => notification.id === "notif-lab-result-kong");

  expect(urgentNotification).toMatchObject({
    unread: false,
    archived: true,
  });
  expect(labNotification).toMatchObject({
    unread: true,
    archived: false,
  });
  expect(
    mockGlobalNotifications.find((notification) => notification.id === "notif-order-urgent-handoff-kong-cbc")
  ).toMatchObject({
    unread: true,
    archived: false,
  });
});

test("notification dedupe key generation uses patient, optional order, and event key", () => {
  expect(
    createNotificationDedupeKey({
      patientId: "patient-kong",
      orderId: "order-cbc",
      eventKey: "order_recheck_requested",
    })
  ).toBe("patient-kong-order-cbc-order_recheck_requested");

  expect(
    createNotificationDedupeKey({
      patientId: "patient-bori",
      eventKey: "waiting_over_30m",
    })
  ).toBe("patient-bori-waiting_over_30m");
});

test("notification dedupe bumps an unread matching row instead of appending", () => {
  const existingNotification = mockGlobalNotifications.find(
    (notification) => notification.id === "notif-order-recheck-bori-cbc-sample"
  );
  expect(existingNotification).toBeTruthy();

  const incomingNotification: GlobalNotification = {
    ...existingNotification!,
    id: "notif-order-recheck-bori-cbc-sample-repeat",
    preview: "이수지 수의사가 검체 재채취 가능성까지 다시 확인해달라고 요청했습니다.",
    detail: "이수지 수의사가 검체 재채취 가능성까지 다시 확인해달라고 요청했습니다. 원본 오더에서 최신 요청 사유를 확인하세요.",
    issuedAtLabel: "방금",
    updated_at: "2026-06-02T09:41:00+09:00",
  };

  const result = upsertNotificationByDedupeKey(mockGlobalNotifications, incomingNotification);

  expect(result.action).toBe("bumped");
  expect(result.notifications).toHaveLength(mockGlobalNotifications.length);
  expect(result.notification).toMatchObject({
    id: existingNotification!.id,
    dedupe_key: existingNotification!.dedupe_key,
    preview: incomingNotification.preview,
    detail: incomingNotification.detail,
    issuedAtLabel: "방금",
    updated_at: incomingNotification.updated_at,
    unread: true,
    archived: false,
    bump_count: (existingNotification!.bump_count ?? 1) + 1,
  });
  expect(result.notifications[0].id).toBe(existingNotification!.id);
});

test("notification dedupe appends different events and repeats after read or archive", () => {
  const existingNotification = mockGlobalNotifications.find(
    (notification) => notification.id === "notif-order-recheck-bori-cbc-sample"
  );
  expect(existingNotification).toBeTruthy();

  const differentOrderNotification: GlobalNotification = {
    ...existingNotification!,
    id: "notif-order-recheck-miso-ua",
    dedupe_key: "patient-miso-order-ua-order_recheck_requested",
    title: "미소 요검사 재확인을 진행해 주세요",
  };
  const differentOrderResult = upsertNotificationByDedupeKey(
    mockGlobalNotifications,
    differentOrderNotification
  );

  expect(differentOrderResult.action).toBe("appended");
  expect(differentOrderResult.notifications).toHaveLength(mockGlobalNotifications.length + 1);
  expect(differentOrderResult.notifications[0].id).toBe(differentOrderNotification.id);

  const readExistingNotifications = mockGlobalNotifications.map((notification) =>
    notification.id === existingNotification!.id ? { ...notification, unread: false } : notification
  );
  const readRepeatResult = upsertNotificationByDedupeKey(readExistingNotifications, {
    ...existingNotification!,
    id: "notif-order-recheck-bori-cbc-after-read",
    issuedAtLabel: "방금",
  });

  expect(readRepeatResult.action).toBe("appended");
  expect(readRepeatResult.notifications).toHaveLength(mockGlobalNotifications.length + 1);
  expect(readRepeatResult.notifications[0].id).toBe("notif-order-recheck-bori-cbc-after-read");

  const archivedExistingNotifications = mockGlobalNotifications.map((notification) =>
    notification.id === existingNotification!.id ? { ...notification, archived: true } : notification
  );
  const archivedRepeatResult = upsertNotificationByDedupeKey(archivedExistingNotifications, {
    ...existingNotification!,
    id: "notif-order-recheck-bori-cbc-after-archive",
    issuedAtLabel: "방금",
  });

  expect(archivedRepeatResult.action).toBe("appended");
  expect(archivedRepeatResult.notifications).toHaveLength(mockGlobalNotifications.length + 1);
  expect(archivedRepeatResult.notifications[0].id).toBe("notif-order-recheck-bori-cbc-after-archive");
});
