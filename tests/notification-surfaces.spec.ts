import { expect, test } from "@playwright/test";
import {
  demoNotificationRecipientContext,
  type GlobalNotification,
  mockGlobalNotifications,
} from "../src/features/notifications/mock-notifications";
import { resolveNotificationSurfaceVisibility } from "../src/features/notifications/notification-surface-rules";

function getNotification(id: string) {
  const notification = mockGlobalNotifications.find((item) => item.id === id);
  expect(notification).toBeTruthy();
  return notification!;
}

test("notification surface mapping keeps every v0 fixture reviewable in the drawer", () => {
  for (const notification of mockGlobalNotifications) {
    const visibility = resolveNotificationSurfaceVisibility(notification, demoNotificationRecipientContext);

    expect(visibility.drawer, `${notification.id} remains reviewable`).toBe(true);
  }
});

test("notification surface mapping suppresses toast for drawer-only and inline-first events", () => {
  const drawerOnlyNotifications = mockGlobalNotifications.filter(
    (notification) => notification.toast_policy === "drawer_only"
  );
  const inlineFirstNotification = getNotification("notif-device-result-tori-fuji");

  expect(drawerOnlyNotifications).toHaveLength(2);

  for (const notification of drawerOnlyNotifications) {
    const visibility = resolveNotificationSurfaceVisibility(notification, demoNotificationRecipientContext);

    expect(visibility.toast, `${notification.id} does not toast`).toBe(false);
    expect(visibility.inlineAlert, `${notification.id} does not inline-alert`).toBe(false);
  }

  expect(
    resolveNotificationSurfaceVisibility(inlineFirstNotification, demoNotificationRecipientContext)
  ).toMatchObject({
    toast: false,
    inlineAlert: true,
  });
});

test("notification surface mapping gates role-active toasts by recipient ownership and current state", () => {
  expect(
    resolveNotificationSurfaceVisibility(getNotification("notif-lab-result-kong"), {
      activeRoleIds: ["vet"],
      includeRoleQueue: true,
    })
  ).toMatchObject({
    toast: true,
    inlineAlert: false,
  });

  expect(
    resolveNotificationSurfaceVisibility(getNotification("notif-lab-result-kong"), {
      activeRoleIds: ["desk"],
      includeRoleQueue: true,
    })
  ).toMatchObject({
    toast: false,
    inlineAlert: false,
  });

  expect(
    resolveNotificationSurfaceVisibility(getNotification("notif-imaging-completed-choco"), {
      activeRoleIds: ["vet"],
      includeRoleQueue: true,
    })
  ).toMatchObject({
    toast: false,
    inlineAlert: false,
  });
});

test("notification surface mapping allows source-context-only toast only near the source workflow", () => {
  const sourceContextNotification: GlobalNotification = {
    ...getNotification("notif-dispensing-completed-dubu"),
    id: "notif-dispensing-completed-dubu-source-context",
    toast_policy: "source_context_only",
  };

  expect(
    resolveNotificationSurfaceVisibility(sourceContextNotification, {
      activeRoleIds: ["desk"],
      includeRoleQueue: true,
      sourceContext: { domain: "dispensing_treatment" },
    })
  ).toMatchObject({
    toast: true,
    inlineAlert: false,
  });

  expect(
    resolveNotificationSurfaceVisibility(sourceContextNotification, {
      activeRoleIds: ["desk"],
      includeRoleQueue: true,
      sourceContext: { domain: "reception" },
    })
  ).toMatchObject({
    toast: false,
    inlineAlert: false,
  });
});

test("notification surface actions stay navigation or detail only", () => {
  const forbiddenFinalActionWords = /완료|확정|결제|수납 확정|처치 완료|진료 완료/;

  for (const notification of mockGlobalNotifications) {
    expect(notification.sourceActionLabel).not.toMatch(forbiddenFinalActionWords);
  }
});
