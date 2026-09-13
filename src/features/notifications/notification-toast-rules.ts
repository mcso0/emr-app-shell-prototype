import type { GlobalNotification } from "@/features/notifications/mock-notifications";

export const NOTIFICATION_TOAST_MAX_VISIBLE = 3;

export type NotificationToastVariant = "urgent" | "high" | "info" | "success" | "warning";

export type NotificationToastStackState = {
  visible: GlobalNotification[];
  queued: GlobalNotification[];
};

export type NotificationToastStackResult = NotificationToastStackState & {
  action: "shown" | "queued" | "bumped";
  notification: GlobalNotification;
};

function bumpToastNotification(existing: GlobalNotification, incoming: GlobalNotification): GlobalNotification {
  return {
    ...existing,
    ...incoming,
    id: existing.id,
    unread: existing.unread,
    archived: existing.archived,
    bump_count: (existing.bump_count ?? 1) + 1,
  };
}

function isPriorityToast(notification: GlobalNotification) {
  return notification.priority === "urgent" || notification.priority === "high";
}

export function resolveNotificationToastVariant(notification: GlobalNotification): NotificationToastVariant {
  if (notification.priority === "urgent") return "urgent";
  if (notification.priority === "high") return "high";
  if (notification.toast_policy === "inline_first" || notification.source.kind === "fallback_detail") {
    return "warning";
  }
  if (!notification.requires_action && notification.event_key.endsWith("_completed")) {
    return "success";
  }
  return "info";
}

export function canArchiveNotificationFromToast(notification: GlobalNotification) {
  return notification.event_key === "waiting_over_30m";
}

export function createNotificationToastStackState(
  notifications: GlobalNotification[] = [],
  maxVisible = NOTIFICATION_TOAST_MAX_VISIBLE
): NotificationToastStackState {
  return {
    visible: notifications.slice(0, maxVisible),
    queued: notifications.slice(maxVisible),
  };
}

export function enqueueNotificationToast(
  state: NotificationToastStackState,
  notification: GlobalNotification,
  maxVisible = NOTIFICATION_TOAST_MAX_VISIBLE
): NotificationToastStackResult {
  const visibleIndex = state.visible.findIndex((item) => item.dedupe_key === notification.dedupe_key);

  if (visibleIndex >= 0) {
    const visible = [...state.visible];
    const bumpedNotification = bumpToastNotification(visible[visibleIndex], notification);
    visible[visibleIndex] = bumpedNotification;

    return {
      visible,
      queued: state.queued,
      action: "bumped",
      notification: bumpedNotification,
    };
  }

  const queuedIndex = state.queued.findIndex((item) => item.dedupe_key === notification.dedupe_key);

  if (queuedIndex >= 0) {
    const queued = [...state.queued];
    const bumpedNotification = bumpToastNotification(queued[queuedIndex], notification);
    queued[queuedIndex] = bumpedNotification;

    return {
      visible: state.visible,
      queued,
      action: "bumped",
      notification: bumpedNotification,
    };
  }

  if (state.visible.length < maxVisible) {
    const visible = isPriorityToast(notification)
      ? [notification, ...state.visible]
      : [...state.visible, notification];

    return {
      visible,
      queued: state.queued,
      action: "shown",
      notification,
    };
  }

  return {
    visible: state.visible,
    queued: [...state.queued, notification],
    action: "queued",
    notification,
  };
}

export function dismissNotificationToast(
  state: NotificationToastStackState,
  notificationId: string,
  maxVisible = NOTIFICATION_TOAST_MAX_VISIBLE
): NotificationToastStackState {
  const visible = state.visible.filter((notification) => notification.id !== notificationId);
  const queued = state.queued.filter((notification) => notification.id !== notificationId);

  if (visible.length === state.visible.length) {
    return { visible, queued };
  }

  if (visible.length >= maxVisible || queued.length === 0) {
    return { visible, queued };
  }

  const [nextNotification, ...remainingQueued] = queued;

  return {
    visible: [...visible, nextNotification],
    queued: remainingQueued,
  };
}
