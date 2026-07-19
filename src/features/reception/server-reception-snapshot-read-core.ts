import type { WorkspacePermissionAdapter } from "@/features/auth/permission-resolver";
import type {
  LiveNotificationEventStore,
  LiveNotificationStateStore,
} from "@/features/notifications/server-notifications";
import type { NotificationPersistenceGateway } from "@/features/notifications/server-notification-persistence";
import {
  readReceptionDayCalendar,
  type ReceptionCalendarReadGateway,
  type ReceptionCalendarReadResult,
} from "@/features/reception/server-reception-calendar-read-core";
import {
  readReceptionQueue,
  type ReceptionQueueReadGateway,
  type ReceptionQueueReadResult,
} from "@/features/reception/server-reception-queue-read-core";

export type ReceptionSnapshotReadResult = {
  ok: boolean;
  status: 200 | 401 | 403 | 500;
  calendar: ReceptionCalendarReadResult;
  queue: ReceptionQueueReadResult;
  enforcedBy: "reception-snapshot-read";
};

export async function readReceptionSnapshot({
  actorUserId,
  calendarGateway,
  date,
  emitWaitingNotifications,
  notificationEventStore,
  notificationEventScopeId,
  notificationPersistenceGateway,
  notificationStateStore,
  now,
  permissionAdapter,
  queueGateway,
  workspaceId,
}: {
  actorUserId: string | null;
  calendarGateway?: ReceptionCalendarReadGateway;
  date: string;
  emitWaitingNotifications?: boolean;
  notificationEventStore?: LiveNotificationEventStore;
  notificationEventScopeId?: string | null;
  notificationPersistenceGateway?: NotificationPersistenceGateway;
  notificationStateStore?: LiveNotificationStateStore;
  now?: string;
  permissionAdapter?: WorkspacePermissionAdapter;
  queueGateway?: ReceptionQueueReadGateway;
  workspaceId: string;
}): Promise<ReceptionSnapshotReadResult> {
  const [calendar, queue] = await Promise.all([
    readReceptionDayCalendar({
      actorUserId,
      date,
      gateway: calendarGateway,
      permissionAdapter,
      workspaceId,
    }),
    readReceptionQueue({
      actorUserId,
      date,
      emitWaitingNotifications,
      gateway: queueGateway,
      notificationEventStore,
      notificationEventScopeId,
      notificationPersistenceGateway,
      notificationStateStore,
      now,
      permissionAdapter,
      workspaceId,
    }),
  ]);
  const ok = calendar.ok && queue.ok;
  const status = ok ? 200 : Math.max(calendar.status, queue.status);

  return {
    ok,
    status: status as ReceptionSnapshotReadResult["status"],
    calendar,
    queue,
    enforcedBy: "reception-snapshot-read",
  };
}
