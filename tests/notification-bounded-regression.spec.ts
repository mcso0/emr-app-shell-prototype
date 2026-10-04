import { expect, test } from "@playwright/test";
import { createMockWorkspacePermissionAdapter } from "../src/features/auth/permission-resolver";
import { mockGlobalNotifications } from "../src/features/notifications/mock-notifications";
import {
  archiveLiveNotification, createDemoLiveNotificationStateStore, markAllLiveNotificationsRead,
  markLiveNotificationRead, readLiveNotifications, restoreLiveNotification,
} from "../src/features/notifications/server-notifications-core";
import { createSupabaseNotificationPersistenceGateway, readPersistedLiveNotifications } from "../src/features/notifications/server-notification-persistence";

test("full authorized mock set supports positions beyond 50/100 and archived restore", async () => {
  const rows = Array.from({ length: 250 }, (_, i) => ({ ...mockGlobalNotifications[0],
    id: `synthetic-${String(i).padStart(4, "0")}`, updated_at: "2026-10-04T00:00:00Z", unread: true, archived: false,
  }));
  const stateStore = createDemoLiveNotificationStateStore();
  const input = { actorUserId: "user-admin", workspaceId: "clair-demo", notifications: rows, stateStore };
  const snapshot = await readLiveNotifications({ ...input, filter: "snapshot", limit: 100 });
  expect(snapshot).toMatchObject({ ok: true, counts: { unread: 250 } });
  expect(snapshot.ok && snapshot.notifications.map(n => n.id)).toEqual(rows.slice(0, 100).map(n => n.id));
  for (const index of [50, 199]) {
    expect(await markLiveNotificationRead({ ...input, notificationId: rows[index].id })).toMatchObject({ ok: true, notification: { readAt: expect.any(String) } });
  }
  expect(await archiveLiveNotification({ ...input, notificationId: rows[249].id })).toMatchObject({ ok: true });
  expect(await restoreLiveNotification({ ...input, notificationId: rows[249].id })).toMatchObject({ ok: true, notification: { archivedAt: null, readAt: expect.any(String) } });
  expect(await markAllLiveNotificationsRead(input)).toMatchObject({ ok: true, updatedCount: 247, counts: { unread: 0, archived: 0 } });
  expect(await markAllLiveNotificationsRead(input)).toMatchObject({ ok: true, updatedCount: 0 });
});

test("bounded RPC keeps normalized external options and DB-authoritative permissions/counts", async () => {
  const calls: unknown[] = [];
  const actorUserId = "synthetic-actor";
  // Adapter was loaded before a grant; DB snapshot is the final authority.
  const permissionAdapter = createMockWorkspacePermissionAdapter({ users: [{ id: actorUserId, status: "active" }],
    memberships: [{ id: "synthetic-member", workspaceId: "clair-demo", userId: actorUserId,
      roles: ["front_desk"], status: "active", permissionRole: { key: "old", label: "Old", roleType: "custom", permissionIds: [] } }],
  });
  const gateway = createSupabaseNotificationPersistenceGateway({ async rpc(name, args) {
    expect(name).toBe("clair_read_notification_snapshot_v2"); calls.push(args);
    return { error: null, data: { ok: true, notifications: [mockGlobalNotifications[0]], states: [],
      counts: { badge: 200, unread: 200, important: 200, archived: 0 }, nextCursor: null } };
  } });
  for (const [limit, expected] of [[0, 20], [-1, 1], [2.7, 2], [NaN, 20], [99999, 50]]) {
    const result = await readPersistedLiveNotifications({ actorUserId, workspaceId: "clair-demo", permissionAdapter, gateway, filter: "", limit });
    expect(result).toMatchObject({ ok: true, counts: { unread: 200 } });
    expect(result.ok && result.notifications).toHaveLength(1);
    expect(calls.at(-1)).toMatchObject({ p_filter: "all", p_limit: expected });
  }
  const count = calls.length;
  expect(await readPersistedLiveNotifications({ actorUserId, workspaceId: "clair-demo", permissionAdapter, gateway, filter: "invalid" })).toMatchObject({ ok: false, status: 400 });
  expect(calls).toHaveLength(count);
});

test("invalid v2 snapshot fails closed without legacy full-history fallback", async () => {
  const calls: string[] = [];
  const gateway = createSupabaseNotificationPersistenceGateway({ async rpc(name) {
    calls.push(name); return { data: { ok: true, notifications: [], states: [], counts: { unread: -1 } }, error: null };
  } });
  expect(await readPersistedLiveNotifications({ actorUserId: "user-admin", workspaceId: "clair-demo", gateway })).toMatchObject({ ok: false, error: "db_read_failed" });
  expect(calls).toEqual(["clair_read_notification_snapshot_v2"]);
});
