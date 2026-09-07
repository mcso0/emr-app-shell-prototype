import { expect, test } from "@playwright/test";
import {
  defaultNotificationPreferences,
  parseNotificationPreferences,
  resolvePreferredNotificationDelivery,
} from "../src/features/notifications/notification-preferences";
import { mockGlobalNotifications } from "../src/features/notifications/mock-notifications";
import { resolveNotificationSurfaceVisibility } from "../src/features/notifications/notification-surface-rules";
import {
  validatePersonalPassword,
  isRecentPasswordRecoveryClaim,
} from "../src/features/auth/personal-password";

const baseNotification = mockGlobalNotifications.find(
  (item) => item.event_key === "order_recheck_requested",
)!;

test("notification defaults preserve explicit false values and reject malformed or authority payloads", () => {
  const defaults = defaultNotificationPreferences();
  expect(defaults.popup).toBe(true);
  expect(defaults.sound).toBe(false);
  const custom = {
    ...defaults,
    popup: false,
    sound: true,
    categories: { ...defaults.categories, order_recheck_requested: false },
  };
  expect(parseNotificationPreferences(custom)).toEqual(custom);
  for (const input of [
    null,
    [],
    {},
    { ...defaults, userId: "another-user" },
    { ...defaults, popup: "false" },
    {
      ...defaults,
      categories: { ...defaults.categories, order_recheck_requested: null },
    },
    { ...defaults, categories: { ...defaults.categories, unknown: true } },
    { ...defaults, categories: {} },
  ])
    expect(parseNotificationPreferences(input)).toBeNull();
});

test("muting changes transient delivery only and urgent visual still requires recipient and surface eligibility", () => {
  const settings = defaultNotificationPreferences();
  settings.popup = false;
  settings.categories.order_recheck_requested = false;
  const normal = { ...baseNotification, priority: "high" as const };
  const before = JSON.stringify(normal);
  expect(resolvePreferredNotificationDelivery(normal, settings, true)).toEqual({
    popup: false,
    sound: false,
  });
  expect(JSON.stringify(normal)).toBe(before);
  const urgent = { ...normal, priority: "urgent" as const };
  expect(resolvePreferredNotificationDelivery(urgent, settings, true)).toEqual({
    popup: true,
    sound: false,
  });
  expect(resolvePreferredNotificationDelivery(urgent, settings, false)).toEqual(
    { popup: false, sound: false },
  );
  for (const toast_policy of ["drawer_only", "inline_first"] as const) {
    const notification = { ...urgent, toast_policy };
    const surface = resolveNotificationSurfaceVisibility(notification, {
      userId: "unrelated",
      activeRoleIds: [],
    });
    expect(surface.drawer).toBe(true);
    expect(
      resolvePreferredNotificationDelivery(
        notification,
        settings,
        surface.toast,
      ),
    ).toEqual({ popup: false, sound: false });
  }
});

test("popup and sound are independent while category mute suppresses ordinary sound", () => {
  const settings = defaultNotificationPreferences();
  settings.popup = false;
  settings.sound = true;
  expect(
    resolvePreferredNotificationDelivery(baseNotification, settings, true),
  ).toEqual({ popup: false, sound: true });
  settings.categories.order_recheck_requested = false;
  expect(
    resolvePreferredNotificationDelivery(baseNotification, settings, true),
  ).toEqual({ popup: false, sound: false });
  expect(
    resolvePreferredNotificationDelivery(
      { ...baseNotification, priority: "urgent" },
      settings,
      true,
    ),
  ).toEqual({ popup: true, sound: true });
});

test("password payload requires current password, confirmation, a new value and bounded strings", () => {
  const valid = {
    currentPassword: "old-synthetic-value",
    password: "new-synthetic-value",
    confirmation: "new-synthetic-value",
  };
  expect(validatePersonalPassword(valid)).toEqual(valid);
  for (const input of [
    null,
    {},
    { ...valid, currentPassword: "" },
    { ...valid, currentPassword: valid.password },
    { ...valid, confirmation: "mismatch" },
    { ...valid, password: "short", confirmation: "short" },
    { ...valid, userId: "foreign" },
    { ...valid, currentPassword: "x".repeat(1025) },
  ])
    expect(validatePersonalPassword(input)).toBeNull();
});

test("settings endpoints deny unauthenticated access and unsupported password requests", async ({
  request,
  baseURL,
}) => {
  const url = "/api/workspaces/clair-demo/members/me/notification-preferences";
  expect((await request.get(url)).status()).toBe(403);
  expect(
    (
      await request.patch(url, { data: defaultNotificationPreferences() })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.post("/api/users/me/password", {
        headers: { origin: "https://foreign.example.test" },
        data: {},
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.post("/api/users/me/password", {
        headers: { origin: baseURL! },
        data: {
          currentPassword: "old-synthetic-value",
          password: "new-synthetic-value",
          confirmation: "new-synthetic-value",
        },
      })
    ).status(),
  ).toBe(503);
});

test("recovery claims require the verified actor, recovery method and recent timestamp", () => {
  const now = Date.now();
  const valid = {
    sub: "user-one",
    amr: [{ method: "recovery", timestamp: now / 1000 - 60 }],
  };
  expect(isRecentPasswordRecoveryClaim(valid, "user-one", now)).toBe(true);
  expect(isRecentPasswordRecoveryClaim(valid, "foreign-user", now)).toBe(false);
  expect(
    isRecentPasswordRecoveryClaim(
      { ...valid, amr: [{ method: "password", timestamp: now / 1000 }] },
      "user-one",
      now,
    ),
  ).toBe(false);
  expect(
    isRecentPasswordRecoveryClaim(
      { ...valid, amr: [{ method: "recovery", timestamp: now / 1000 - 3601 }] },
      "user-one",
      now,
    ),
  ).toBe(false);
  expect(
    isRecentPasswordRecoveryClaim(
      { ...valid, amr: [{ method: "recovery", timestamp: now / 1000 + 61 }] },
      "user-one",
      now,
    ),
  ).toBe(false);
});
