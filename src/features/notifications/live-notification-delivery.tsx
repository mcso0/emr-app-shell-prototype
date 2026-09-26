"use client";

import { useEffect, useRef, useState } from "react";
import type { GlobalNotification } from "./mock-notifications";
import { resolveNotificationSurfaceVisibility } from "./notification-surface-rules";
import {
  defaultNotificationPreferences,
  NOTIFICATION_PREFERENCES_EVENT,
  parseNotificationPreferences,
  resolvePreferredNotificationDelivery,
  type NotificationPreferences,
} from "./notification-preferences";
import { NotificationToastCard } from "./notification-toast";
import {
  createNotificationToastStackState,
  dismissNotificationToast,
  enqueueNotificationToast,
} from "./notification-toast-rules";

type Props = {
  workspaceId: string;
  userId: string;
  notifications: GlobalNotification[];
  ready: boolean;
  currentRoute: string;
  onArchive: (notificationId: string) => Promise<boolean>;
  onOpenSource: (notification: GlobalNotification) => void;
};

// Only pass the server-authorized notification snapshot. Preference state never
// filters the inbox or substitutes for the notification reader's authorization.
export function LiveNotificationDelivery({
  workspaceId,
  userId,
  notifications,
  ready,
  currentRoute,
  onArchive,
  onOpenSource,
}: Props) {
  const [preferences, setPreferences] =
    useState<NotificationPreferences | null>(null);
  const [stack, setStack] = useState(createNotificationToastStackState);
  const [archivePendingIds, setArchivePendingIds] = useState<Set<string>>(
    () => new Set(),
  );
  const seen = useRef(new Map<string, string>());
  const initialized = useRef(false);
  const audio = useRef<AudioContext | null>(null);
  const canPlay = useRef(false);
  const toastStackRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const stackElement = toastStackRef.current;
    const root = document.documentElement;
    if (!ready || !stackElement) {
      root.style.removeProperty("--live-notification-toast-stack-height");
      return;
    }
    const observer = new ResizeObserver(([entry]) => {
      root.style.setProperty(
        "--live-notification-toast-stack-height",
        `${Math.ceil(entry.contentRect.height)}px`,
      );
    });
    observer.observe(stackElement);
    return () => {
      observer.disconnect();
      root.style.removeProperty("--live-notification-toast-stack-height");
    };
  }, [ready]);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(
          `/api/workspaces/${encodeURIComponent(workspaceId)}/members/me/notification-preferences`,
          { cache: "no-store", signal: controller.signal },
        );
        const body = await response.json();
        const parsed = parseNotificationPreferences(body.preferences);
        if (response.ok && body.ok && parsed && !controller.signal.aborted)
          setPreferences(parsed);
      } catch {
        /* Preserve last confirmed settings. Unknown preferences mute ordinary delivery. */
      }
    }
    void load();
    window.addEventListener(NOTIFICATION_PREFERENCES_EVENT, load);
    window.addEventListener("focus", load);
    return () => {
      controller.abort();
      window.removeEventListener(NOTIFICATION_PREFERENCES_EVENT, load);
      window.removeEventListener("focus", load);
    };
  }, [workspaceId]);

  useEffect(() => {
    function unlock() {
      if (!preferences?.sound) return;
      try {
        audio.current ??= new AudioContext();
        void audio.current
          .resume()
          .then(() => {
            canPlay.current = audio.current?.state === "running";
          })
          .catch(() => undefined);
      } catch {
        canPlay.current = false;
      }
    }
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [preferences?.sound]);
  useEffect(
    () => () => {
      void audio.current?.close().catch(() => undefined);
    },
    [],
  );

  useEffect(() => {
    if (!ready) return;
    function eligible(notification: GlobalNotification) {
      const context = {
        userId,
        activeRoleIds:
          notification.recipient.kind === "user"
            ? []
            : [notification.recipient.id],
        includeRoleQueue: true,
        sourceContext:
          notification.source.route === currentRoute
            ? {
                entityId: notification.source.entity_id,
                sourceKind: notification.source.kind,
              }
            : undefined,
      };
      return resolveNotificationSurfaceVisibility(notification, context).toast;
    }
    const frame = window.requestAnimationFrame(() => {
      const fallback = {
        ...defaultNotificationPreferences(),
        popup: false,
        sound: false,
      };
      const effective = preferences ?? fallback;
      const arriving: GlobalNotification[] = [];
      let sound = false;
      for (const notification of notifications) {
        const version = `${notification.updated_at}:${notification.bump_count ?? 0}`;
        const previous = seen.current.get(notification.id);
        seen.current.set(notification.id, version);
        if (
          previous === version ||
          (!initialized.current && notification.priority !== "urgent")
        )
          continue;
        // Role IDs here come exclusively from the authenticated, recipient-filtered
        // server response, not editable profile fields or browser membership data.
        const delivery = resolvePreferredNotificationDelivery(
          notification,
          effective,
          eligible(notification),
        );
        if (delivery.popup) arriving.push(notification);
        sound ||= delivery.sound;
      }
      initialized.current = true;
      const currentById = new Map(
        notifications.map((notification) => [notification.id, notification]),
      );
      setStack((current) => {
        let next = current;
        for (const item of [...current.visible, ...current.queued]) {
          const fresh = currentById.get(item.id);
          const allowed =
            fresh &&
            eligible(fresh) &&
            (fresh.priority === "urgent" ||
              (effective.popup &&
                (effective.categories[
                  fresh.event_key as keyof typeof effective.categories
                ] ??
                  true)));
          if (!allowed) next = dismissNotificationToast(next, item.id);
        }
        for (const item of arriving)
          next = enqueueNotificationToast(next, item);
        return next;
      });
      if (sound && canPlay.current && audio.current?.state === "running") {
        const context = audio.current;
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = "sine";
        oscillator.frequency.value = 660;
        gain.gain.setValueAtTime(0.0001, context.currentTime);
        gain.gain.exponentialRampToValueAtTime(
          0.06,
          context.currentTime + 0.02,
        );
        gain.gain.exponentialRampToValueAtTime(
          0.0001,
          context.currentTime + 0.18,
        );
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.onended = () => {
          oscillator.disconnect();
          gain.disconnect();
        };
        oscillator.start();
        oscillator.stop(context.currentTime + 0.2);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [currentRoute, notifications, preferences, ready, userId]);

  useEffect(() => {
    const timers = stack.visible
      .filter((item) => item.priority !== "urgent")
      .map((item) =>
        window.setTimeout(
          () =>
            setStack((current) => dismissNotificationToast(current, item.id)),
          8000,
        ),
      );
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [stack.visible]);
  if (!ready) return null;

  async function handleArchive(notificationId: string) {
    if (archivePendingIds.has(notificationId)) return;
    setArchivePendingIds((current) => new Set(current).add(notificationId));
    try {
      const archived = await onArchive(notificationId);
      if (archived) {
        setStack((current) => dismissNotificationToast(current, notificationId));
      }
    } finally {
      setArchivePendingIds((current) => {
        const next = new Set(current);
        next.delete(notificationId);
        return next;
      });
    }
  }

  return (
    <div
      ref={toastStackRef}
      aria-label="새 알림"
      className="fixed right-4 bottom-4 z-40 grid gap-2"
    >
      {stack.visible.map((notification) => (
        <NotificationToastCard
          key={notification.id}
          archivePending={archivePendingIds.has(notification.id)}
          notification={notification}
          onArchive={(item) => void handleArchive(item.id)}
          onDismiss={(id) =>
            setStack((current) => dismissNotificationToast(current, id))
          }
          onOpenSource={(item) => {
            onOpenSource(item);
            setStack((current) => dismissNotificationToast(current, item.id));
          }}
        />
      ))}
    </div>
  );
}
