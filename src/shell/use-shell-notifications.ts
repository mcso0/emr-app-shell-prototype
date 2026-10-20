"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { coalescePendingRefresh, subscribeVisibleRefresh } from "@/lib/visible-refresh";
import type { GlobalNotification } from "@/features/notifications/mock-notifications";
import {
  emptyLiveNotificationCounts,
  fetchLiveNotificationSnapshot,
  mutateLiveNotification,
  type LiveNotificationCounts,
  type LiveNotificationMutationAction,
  type LiveNotificationSnapshotResult,
} from "@/features/notifications/live-notifications-client";

import { createNotificationPollSharing, type NotificationPollSharing } from "@/features/notifications/notification-poll-sharing";
import { subscribeNotificationSessionLifecycle } from "@/features/notifications/notification-session-lifecycle";

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
  const [deliveryGeneration, setDeliveryGeneration] = useState(0);
  const generation = useRef(0);
  const runtime = useRef<{
    refresh: () => void;
    invalidate: () => void;
    reject: (result: Extract<LiveNotificationSnapshotResult, { ok: false }>) => void;
    controllers: Set<AbortController>;
    enabled: () => boolean;
  } | null>(null);

  useEffect(() => {
    if (!authHydrated) return;
    const ownGeneration = ++generation.current;
    const controllers = new Set<AbortController>();
    const readControllers = new Set<AbortController>();
    let active = true;
    let ended = false;
    let denied = false;
    let readVersion = 0;
    let sharing: NotificationPollSharing | undefined;

    function clear() {
      setDeliveryGeneration(generation.current);
      setNotificationSnapshotScope(null);
      setNotifications(emptyGlobalNotifications);
      setNotificationCounts(emptyLiveNotificationCounts);
      setNotificationErrorMessage(null);
      setNotificationRequestState("idle");
    }
    function cancelReads() {
      readVersion += 1;
      for (const controller of readControllers) controller.abort();
      readControllers.clear();
    }
    function endSession(broadcast = true) {
      if (!active) return;
      ended = true;
      generation.current += 1;
      cancelReads();
      for (const controller of controllers) controller.abort();
      sharing?.close({ sessionEnded: broadcast });
      sharing = undefined;
      clear();
    }
    function apply(result: LiveNotificationSnapshotResult) {
      if (!active || ended) return;
      if (result.ok) {
        setNotificationSnapshotScope(`${workspaceId}:${sessionId ?? ""}`);
        setNotifications(result.notifications);
        setNotificationCounts(result.counts);
        setNotificationErrorMessage(null);
        setNotificationRequestState("ready");
      } else if (!result.aborted) {
        denied = result.error.status === 401 || result.error.status === 403;
        if (denied) {
          generation.current += 1;
          setDeliveryGeneration(generation.current);
          cancelReads();
          for (const controller of controllers) controller.abort();
          sharing?.close();
          sharing = undefined;
        }
        setNotificationSnapshotScope(null);
        setNotifications(emptyGlobalNotifications);
        setNotificationCounts(emptyLiveNotificationCounts);
        setNotificationErrorMessage(result.error.message);
        setNotificationRequestState(denied ? "permission_denied" : "error");
      }
    }
    async function load() {
      if (!active || ended || denied) return;
      const version = ++readVersion;
      const group = sharing;
      const fence = group?.readStarted();
      const controller = new AbortController();
      controllers.add(controller);
      readControllers.add(controller);
      setNotificationRequestState(state => state === "ready" ? "ready" : "loading");
      const result = await fetchLiveNotificationSnapshot({ actorHeaders, signal: controller.signal, workspaceId });
      controllers.delete(controller);
      readControllers.delete(controller);
      if (!active || ended || version !== readVersion || (group && fence && !group.accepts(fence))) return;
      if (group && fence) group.publish(result, fence);
      apply(result);
      if (!result.ok || sessionRole !== "supabase") return;
      if (sharing?.scope !== result.sharingScope) {
        sharing?.close();
        sharing = undefined;
      }
      if (result.sharingScope && !sharing) sharing = createNotificationPollSharing({
        scope: result.sharingScope,
        onRefresh: reason => {
          if (reason === "poll") void automatic();
          else { cancelReads(); void load(); }
        },
        onInvalidate: cancelReads,
        onSnapshot: shared => { cancelReads(); apply(shared); },
        onEnd: () => endSession(false),
      });
    }
    const automatic = coalescePendingRefresh(load);
    function retry() {
      if (!active || ended) return;
      denied = false;
      cancelReads();
      void load();
    }
    runtime.current = {
      refresh: retry,
      invalidate: () => { sharing?.invalidate(); },
      reject: result => {
        if (result.error.status !== 401 && result.error.status !== 403) {
          setNotificationErrorMessage(result.error.message);
          setNotificationRequestState("error");
          return;
        }
        // A denial is broadcast before disposal, including silent source reads.
        const fence = sharing?.readStarted();
        if (sharing && fence) sharing.publish(result, fence);
        apply(result);
      },
      controllers,
      enabled: () => active && !ended && !denied,
    };
    const unsubscribeAuth = sessionRole === "supabase"
      ? subscribeNotificationSessionLifecycle({
        onEnd: () => endSession(),
        onChange: () => {
          endSession();
          ended = false;
          denied = false;
          void load();
        },
      }) : undefined;
    void Promise.resolve().then(() => { if (active) { clear(); void automatic(); } });
    const unsubscribeRefresh = sessionRole === "supabase"
      ? subscribeVisibleRefresh({ intervalMs: 30_000, onRefresh: reason => {
        if (ended || denied) return;
        if (reason === "resume") {
          sharing?.visibilityChanged();
          void automatic();
        } else if (sharing) sharing.poll();
        else void automatic();
      } }) : undefined;
    const visibilityChanged = () => { sharing?.visibilityChanged(); };
    const pageHidden = () => { sharing?.suspend(); };
    const pageShown = () => {
      if (!ended && !denied && document.visibilityState === "visible") {
        sharing?.visibilityChanged();
        void automatic();
      }
    };
    document.addEventListener("visibilitychange", visibilityChanged);
    window.addEventListener("pagehide", pageHidden);
    window.addEventListener("pageshow", pageShown);
    return () => {
      active = false;
      generation.current += 1;
      cancelReads();
      for (const controller of controllers) controller.abort();
      sharing?.close();
      unsubscribeAuth?.();
      unsubscribeRefresh?.();
      document.removeEventListener("visibilitychange", visibilityChanged);
      window.removeEventListener("pagehide", pageHidden);
      window.removeEventListener("pageshow", pageShown);
      if (generation.current >= ownGeneration) runtime.current = null;
    };
  }, [actorHeaders, authHydrated, sessionId, sessionRole, workspaceId]);

  function handleRetryNotifications() {
    runtime.current?.refresh();
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
    const owner = runtime.current;
    if (!owner || !owner.enabled()) return false;
    const ownGeneration = generation.current;
    const controller = new AbortController();
    owner.controllers.add(controller);
    const result = await mutateLiveNotification({
      action, actorHeaders, notificationId, workspaceId, signal: controller.signal,
    });
    owner.controllers.delete(controller);
    if (runtime.current !== owner || generation.current !== ownGeneration || controller.signal.aborted) return false;
    if (!result.ok) {
      if (!result.aborted) {
        if (!silent) toast.error(result.error.message);
        if (!silent || result.error.status === 401 || result.error.status === 403) owner.reject(result);
      }
      return false;
    }
    setNotificationCounts(result.counts);
    setNotificationErrorMessage(null);
    setNotificationRequestState("ready");
    owner.invalidate();
    owner.refresh();
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

  const scopeMatches = authHydrated && notificationSnapshotScope === `${workspaceId}:${sessionId ?? ""}`;
  return {
    notifications: scopeMatches ? notifications : emptyGlobalNotifications,
    counts: scopeMatches ? notificationCounts : emptyLiveNotificationCounts,
    snapshotScope: notificationSnapshotScope,
    deliveryGeneration,
    requestState: notificationRequestState,
    errorMessage: notificationErrorMessage,
    retry: handleRetryNotifications,
    markRead: handleMarkNotificationRead,
    archive: handleArchiveNotification,
    restore: handleRestoreNotification,
    markAllRead: handleMarkAllNotificationsRead,
  };
}
