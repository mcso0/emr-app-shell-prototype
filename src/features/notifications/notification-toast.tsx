"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CircleCheckIcon,
  InfoIcon,
  WarningIcon,
} from "@/components/icons";
import { CdsNavigationExternalLinkIcon } from "@/components/cds-icons/navigation";
import { cn } from "@/lib/utils";
import type { GlobalNotification } from "@/features/notifications/mock-notifications";
import {
  resolveNotificationToastVariant,
  type NotificationToastVariant,
} from "@/features/notifications/notification-toast-rules";

export {
  createNotificationToastStackState,
  dismissNotificationToast,
  enqueueNotificationToast,
  NOTIFICATION_TOAST_MAX_VISIBLE,
  resolveNotificationToastVariant,
  type NotificationToastStackResult,
  type NotificationToastStackState,
  type NotificationToastVariant,
} from "@/features/notifications/notification-toast-rules";

const statusVariantClasses: Record<NotificationToastVariant, string> = {
  urgent: "border-[var(--emr-status-danger-border)] text-[var(--emr-status-danger-text)]",
  high: "border-[var(--emr-status-warning-border)] text-[var(--emr-status-warning-text)]",
  warning: "border-[var(--emr-status-warning-border)] text-[var(--emr-status-warning-text)]",
  info: "border-[var(--emr-status-info-border)] text-[var(--emr-status-info-text)]",
  success: "border-[var(--emr-status-success-border)] text-[var(--emr-status-success-text)]",
};

function NotificationToastStatusIcon({ variant }: { variant: NotificationToastVariant }) {
  const className = "size-4";

  if (variant === "urgent" || variant === "high" || variant === "warning") {
    return <WarningIcon className={className} aria-hidden="true" />;
  }

  if (variant === "success") {
    return <CircleCheckIcon className={className} aria-hidden="true" />;
  }

  return <InfoIcon className={className} aria-hidden="true" />;
}

export function NotificationToastCard({
  notification,
  onDismiss,
  onOpenSource,
}: {
  notification: GlobalNotification;
  onDismiss?: (notificationId: string) => void;
  onOpenSource?: (notification: GlobalNotification) => void;
}) {
  const variant = resolveNotificationToastVariant(notification);

  return (
    <article
      role="status"
      data-testid={`global-notification-toast-${notification.id}`}
      data-toast-variant={variant}
      className="grid w-[min(360px,calc(100vw-32px))] grid-cols-[28px_minmax(0,1fr)] gap-3 rounded-[var(--emr-radius-card)] border border-[var(--emr-line-default)] bg-[var(--emr-surface-app)] p-3 text-[var(--emr-text-primary)] shadow-[var(--emr-shadow-panel)]"
    >
      <span
        className={cn(
          "flex size-7 items-center justify-center rounded-full border bg-[var(--emr-surface-raised)]",
          statusVariantClasses[variant]
        )}
      >
        <NotificationToastStatusIcon variant={variant} />
      </span>
      <div className="min-w-0 space-y-2">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <Badge
                variant={notification.requires_action ? "destructive" : "outline"}
                className="h-5 rounded-[var(--emr-radius-control)] px-1.5 py-0 text-[11px] leading-4"
              >
                {notification.workTypeLabel}
              </Badge>
              <span className="emr-text-metadata text-[var(--emr-text-tertiary)]">
                {notification.requires_action ? "중요 알림" : "참고 알림"}
              </span>
            </div>
            <h3 className="min-w-0 text-[13px] font-semibold leading-5">{notification.title}</h3>
          </div>
          <time className="shrink-0 text-[11px] font-medium leading-4 text-[var(--emr-text-tertiary)]">
            {notification.issuedAtLabel}
          </time>
        </div>
        <p className="text-[12px] leading-5 text-[var(--emr-text-secondary)]">
          {notification.preview}
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            type="button"
            size="xs"
            variant="outline"
            disabled={!notification.source.route}
            onClick={() => onOpenSource?.(notification)}
          >
            <CdsNavigationExternalLinkIcon data-icon="inline-start" />
            {notification.sourceActionLabel}
          </Button>
          <Button type="button" size="xs" variant="ghost" onClick={() => onDismiss?.(notification.id)}>
            나중에 보기
          </Button>
        </div>
      </div>
    </article>
  );
}
