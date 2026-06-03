"use client";

import { CdsNavigationExternalLinkIcon } from "@/components/cds-icons/navigation";
import { EmrInlineAlert, type EmrInlineAlertSeverity } from "@/components/emr/inline-alert";
import { Button } from "@/components/ui/button";
import type { GlobalNotification } from "@/features/notifications/mock-notifications";

function resolveNotificationInlineAlertSeverity(
  notification: GlobalNotification
): EmrInlineAlertSeverity {
  if (notification.priority === "urgent") return "error";
  if (notification.priority === "high" || notification.toast_policy === "inline_first") return "warning";
  if (!notification.requires_action && notification.event_key.endsWith("_completed")) return "success";
  return "info";
}

export function NotificationInlineAlert({
  notification,
  onOpenSource,
}: {
  notification: GlobalNotification;
  onOpenSource?: (notification: GlobalNotification) => void;
}) {
  const fallbackAction = notification.source.route ? notification.sourceActionLabel : "알림 상세 보기";

  return (
    <EmrInlineAlert
      testId={`global-notification-inline-alert-${notification.id}`}
      data-notification-event-key={notification.event_key}
      data-notification-toast-policy={notification.toast_policy}
      severity={resolveNotificationInlineAlertSeverity(notification)}
      title={notification.title}
      action={
        <Button type="button" size="xs" variant="outline" onClick={() => onOpenSource?.(notification)}>
          <CdsNavigationExternalLinkIcon data-icon="inline-start" />
          {fallbackAction}
        </Button>
      }
    >
      <p>{notification.detail}</p>
      <p className="mt-1 text-[12px] leading-5">
        {notification.sourceLabel} · {notification.recipientLabel}
      </p>
    </EmrInlineAlert>
  );
}
