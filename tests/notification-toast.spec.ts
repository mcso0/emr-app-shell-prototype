import { expect, test } from "@playwright/test";
import { mockGlobalNotifications, type GlobalNotification } from "../src/features/notifications/mock-notifications";
import {
  canArchiveNotificationFromToast,
  createNotificationToastStackState,
  dismissNotificationToast,
  enqueueNotificationToast,
  NOTIFICATION_TOAST_MAX_VISIBLE,
  resolveNotificationToastVariant,
} from "../src/features/notifications/notification-toast-rules";

function getNotification(id: string) {
  const notification = mockGlobalNotifications.find((item) => item.id === id);
  expect(notification).toBeTruthy();
  return notification!;
}

test("notification toast stack shows at most three and queues later notifications", () => {
  const initialNotifications = mockGlobalNotifications.slice(0, 5);
  const state = createNotificationToastStackState(initialNotifications);

  expect(state.visible).toHaveLength(NOTIFICATION_TOAST_MAX_VISIBLE);
  expect(state.queued).toHaveLength(2);

  const dismissed = dismissNotificationToast(state, state.visible[0].id);

  expect(dismissed.visible).toHaveLength(NOTIFICATION_TOAST_MAX_VISIBLE);
  expect(dismissed.queued).toHaveLength(1);
  expect(dismissed.visible.at(-1)?.id).toBe(state.queued[0].id);
});

test("notification toast enqueue queues overflow and promotes queued toast after dismiss", () => {
  const state = createNotificationToastStackState(mockGlobalNotifications.slice(0, 3));
  const queuedNotification = getNotification("notif-waiting-bori");
  const queued = enqueueNotificationToast(state, queuedNotification);

  expect(queued.action).toBe("queued");
  expect(queued.visible).toHaveLength(3);
  expect(queued.queued).toEqual([queuedNotification]);

  const dismissed = dismissNotificationToast(queued, queued.visible[1].id);

  expect(dismissed.visible).toHaveLength(3);
  expect(dismissed.queued).toHaveLength(0);
  expect(dismissed.visible.at(-1)?.id).toBe(queuedNotification.id);
});

test("notification toast dedupe bumps visible and queued items instead of appending", () => {
  const existingVisible = getNotification("notif-order-recheck-bori-cbc-sample");
  const existingQueued = getNotification("notif-waiting-bori");
  const state = createNotificationToastStackState([
    existingVisible,
    getNotification("notif-lab-result-kong"),
    getNotification("notif-assigned-order-completed-lulu-fluid"),
    existingQueued,
  ]);
  const repeatedVisible: GlobalNotification = {
    ...existingVisible,
    id: "notif-order-recheck-bori-cbc-sample-repeat-toast",
    preview: "검체 상태 확인 요청이 다시 들어왔습니다.",
    issuedAtLabel: "방금",
    updated_at: "2026-06-02T09:42:00+09:00",
  };
  const repeatedQueued: GlobalNotification = {
    ...existingQueued,
    id: "notif-waiting-bori-repeat-toast",
    preview: "보리 보호자 대기 안내가 다시 필요합니다.",
    issuedAtLabel: "방금",
    updated_at: "2026-06-02T09:43:00+09:00",
  };

  const visibleBump = enqueueNotificationToast(state, repeatedVisible);

  expect(visibleBump.action).toBe("bumped");
  expect(visibleBump.visible).toHaveLength(3);
  expect(visibleBump.queued).toHaveLength(1);
  expect(visibleBump.notification).toMatchObject({
    id: existingVisible.id,
    preview: repeatedVisible.preview,
    bump_count: (existingVisible.bump_count ?? 1) + 1,
  });

  const queuedBump = enqueueNotificationToast(visibleBump, repeatedQueued);

  expect(queuedBump.action).toBe("bumped");
  expect(queuedBump.visible).toHaveLength(3);
  expect(queuedBump.queued).toHaveLength(1);
  expect(queuedBump.queued[0]).toMatchObject({
    id: existingQueued.id,
    preview: repeatedQueued.preview,
    issuedAtLabel: "방금",
  });
});

test("notification toast variants follow priority, fallback, completion, and info rules", () => {
  expect(resolveNotificationToastVariant(getNotification("notif-order-urgent-handoff-kong-cbc"))).toBe("urgent");
  expect(resolveNotificationToastVariant(getNotification("notif-order-recheck-bori-cbc-sample"))).toBe("high");
  expect(resolveNotificationToastVariant(getNotification("notif-device-result-tori-fuji"))).toBe("warning");
  expect(resolveNotificationToastVariant(getNotification("notif-dispensing-completed-dubu"))).toBe("success");
  expect(resolveNotificationToastVariant(getNotification("notif-lab-result-kong"))).toBe("info");
});

test("notification toast source actions stay navigation-only", () => {
  const forbiddenFinalActionWords = /완료|확정|결제|수납 확정|처치 완료|진료 완료/;

  for (const notification of mockGlobalNotifications) {
    expect(notification.sourceActionLabel).not.toMatch(forbiddenFinalActionWords);
  }
});

test("only reception waiting alerts expose archive from the toast", () => {
  expect(canArchiveNotificationFromToast(getNotification("notif-waiting-bori"))).toBe(true);
  expect(
    canArchiveNotificationFromToast(
      getNotification("notif-order-recheck-bori-cbc-sample"),
    ),
  ).toBe(false);
});
