"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { coalescePendingRefresh, subscribeVisibleRefresh } from "@/lib/visible-refresh";
import type { GlobalNotification } from "@/features/notifications/mock-notifications";
import {
  emptyLiveNotificationCounts,
  fetchLiveNotificationSnapshot,
  mutateLiveNotification,
  type LiveNotificationCounts,
  type LiveNotificationMutationAction,
} from "@/features/notifications/live-notifications-client";

type NotificationRequestState = "idle" | "loading" | "ready" | "error" | "permission_denied";
type ShellNotificationsOptions = {
  actorHeaders?: Record<string, string>;
  authHydrated: boolean;
  sessionId?: string;
  sessionRole?: string;
  workspaceId: string;
};

const emptyGlobalNotifications: GlobalNotification[] = [];

// Own API state here; source navigation and clinical editor flushing stay outside.
export function useShellNotifications({
  actorHeaders, authHydrated, sessionId, sessionRole, workspaceId,
}: ShellNotificationsOptions) {
  const [notificationSnapshotScope, setNotificationSnapshotScope] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<GlobalNotification[]>(emptyGlobalNotifications);
  const [notificationCounts, setNotificationCounts] =
    useState<LiveNotificationCounts>(emptyLiveNotificationCounts);
  const [notificationRequestState, setNotificationRequestState] =
    useState<NotificationRequestState>("idle");
  const [notificationErrorMessage, setNotificationErrorMessage] = useState<string | null>(null);
  const [notificationReloadKey, setNotificationReloadKey] = useState(0);

  useEffect(() => {
    if (!authHydrated) return;

    const controller = new AbortController();
    let cancelled = false;

    const refresh = coalescePendingRefresh(async () => {
      if (cancelled) return;
      setNotificationRequestState((state) => (state === "ready" ? "ready" : "loading"));

      const result = await fetchLiveNotificationSnapshot({
        actorHeaders,
        signal: controller.signal,
        workspaceId,
      });
      if (cancelled) return;

      if (result.ok) {
        setNotificationSnapshotScope(`${workspaceId}:${sessionId ?? ""}`);
        setNotifications(result.notifications);
        setNotificationCounts(result.counts);
        setNotificationErrorMessage(null);
        setNotificationRequestState("ready");
        return;
      }

      if (result.aborted) return;

      setNotifications(emptyGlobalNotifications);
      setNotificationCounts(emptyLiveNotificationCounts);
      setNotificationErrorMessage(result.error.message);
      setNotificationRequestState(
        result.error.status === 401 || result.error.status === 403 ? "permission_denied" : "error"
      );
    });

    // Do not start a request from an effect already cleaned up by Strict Mode.
    void Promise.resolve().then(() => { if (!cancelled) void refresh(); });
    const unsubscribe = sessionRole === "supabase"
      ? subscribeVisibleRefresh({ intervalMs: 30_000, onRefresh: () => { void refresh(); } })
      : undefined;

    return () => {
      cancelled = true;
      unsubscribe?.();
      controller.abort();
    };
  }, [actorHeaders, authHydrated, sessionId, sessionRole, notificationReloadKey, workspaceId]);

  function handleRetryNotifications() {
    setNotificationReloadKey((key) => key + 1);
  }

  async function runNotificationMutation({
    action,
    notificationId,
    silent = false,
  }: {
    action: LiveNotificationMutationAction;
    notificationId?: string;
    silent?: boolean;
  }) {
    const result = await mutateLiveNotification({
      action,
      actorHeaders,
      notificationId,
      workspaceId,
    });

    if (!result.ok) {
      if (!result.aborted && !silent) {
        toast.error(result.error.message);
        setNotificationErrorMessage(result.error.message);
        setNotificationRequestState(
          result.error.status === 401 || result.error.status === 403 ? "permission_denied" : "error"
        );
      }

      return false;
    }

    setNotificationCounts(result.counts);
    setNotificationErrorMessage(null);
    setNotificationRequestState("ready");
    setNotificationReloadKey((key) => key + 1);
    return true;
  }

  async function handleMarkNotificationRead(notificationId: string, options?: { silent?: boolean }) {
    return runNotificationMutation({
      action: "read",
      notificationId,
      silent: options?.silent,
    });
  }

  async function handleArchiveNotification(notificationId: string) {
    return runNotificationMutation({
      action: "archive",
      notificationId,
    });
  }

  async function handleRestoreNotification(notificationId: string) {
    await runNotificationMutation({
      action: "restore",
      notificationId,
    });
  }

  async function handleMarkAllNotificationsRead() {
    await runNotificationMutation({
      action: "read-all",
    });
  }

  return {
    notifications,
    counts: notificationCounts,
    snapshotScope: notificationSnapshotScope,
    requestState: notificationRequestState,
    errorMessage: notificationErrorMessage,
    retry: handleRetryNotifications,
    markRead: handleMarkNotificationRead,
    archive: handleArchiveNotification,
    restore: handleRestoreNotification,
    markAllRead: handleMarkAllNotificationsRead,
  };
}
