"use client";

import { useMemo, useState } from "react";
import { CloseIcon } from "@/components/icons";
import { CdsNavigationExternalLinkIcon } from "@/components/cds-icons/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SegmentedControl, type SegmentedControlItem } from "@/components/ui/segmented-control";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  resolveNotificationUnreadCount,
  type GlobalNotification,
} from "@/features/notifications/mock-notifications";

type NotificationFilter = "all" | "requires_action" | "archived";

type GlobalNotificationDrawerProps = {
  badgeCount: number;
  notifications: GlobalNotification[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const filterLabels: Record<NotificationFilter, string> = {
  all: "전체",
  requires_action: "중요",
  archived: "보관",
};

function getFilteredNotifications(notifications: GlobalNotification[], filter: NotificationFilter) {
  if (filter === "archived") {
    return notifications.filter((notification) => notification.archived);
  }

  if (filter === "requires_action") {
    return notifications.filter(
      (notification) => !notification.archived && notification.unread && notification.requires_action
    );
  }

  return notifications.filter((notification) => !notification.archived);
}

function getFilterItems(notifications: GlobalNotification[]): Array<SegmentedControlItem<NotificationFilter>> {
  return (["all", "requires_action", "archived"] as NotificationFilter[]).map((filter) => ({
    value: filter,
    label: filterLabels[filter],
    count: getFilteredNotifications(notifications, filter).length,
  }));
}

function NotificationRow({ notification }: { notification: GlobalNotification }) {
  return (
    <article
      data-testid={`global-notification-row-${notification.id}`}
      className={cn(
        "grid grid-cols-[18px_minmax(0,1fr)] gap-3 border-b border-[var(--emr-line-hairline)] px-4 py-3",
        notification.unread ? "bg-[var(--emr-surface-app)]" : "bg-transparent opacity-75"
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "mt-1.5 size-2 rounded-full",
          notification.requires_action
            ? "bg-[var(--emr-status-danger-text)]"
            : "bg-[var(--emr-status-neutral-text)]"
        )}
      />
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
            <h3 className="min-w-0 text-[13px] font-semibold leading-5 text-[var(--emr-text-primary)]">
              {notification.title}
            </h3>
          </div>
          <time className="shrink-0 text-[11px] font-medium leading-4 text-[var(--emr-text-tertiary)]">
            {notification.issuedAtLabel}
          </time>
        </div>

        <p className="text-[12px] leading-5 text-[var(--emr-text-secondary)]">
          {notification.detail}
        </p>

        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[11px] leading-4 text-[var(--emr-text-tertiary)]">
          <span className="min-w-0 truncate">{notification.sourceLabel}</span>
          <span aria-hidden="true">·</span>
          <span>{notification.recipientLabel}</span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Button size="xs" variant="outline" disabled>
            <CdsNavigationExternalLinkIcon data-icon="inline-start" />
            원본 열기
          </Button>
          <Button size="xs" variant="ghost" disabled>
            읽음
          </Button>
          <Button size="xs" variant="ghost" disabled>
            보관
          </Button>
        </div>
      </div>
    </article>
  );
}

export function GlobalNotificationDrawer({
  badgeCount,
  notifications,
  open,
  onOpenChange,
}: GlobalNotificationDrawerProps) {
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const unreadCount = useMemo(() => resolveNotificationUnreadCount(notifications), [notifications]);
  const filterItems = useMemo(() => getFilterItems(notifications), [notifications]);
  const visibleNotifications = useMemo(
    () => getFilteredNotifications(notifications, filter),
    [filter, notifications]
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        id="global-notification-drawer"
        side="right"
        showCloseButton={false}
        className="w-[min(100vw,420px)] max-w-[100vw] gap-0 border-[var(--emr-line-default)] bg-[var(--emr-surface-app)] p-0 sm:max-w-[420px]"
      >
        <SheetHeader className="border-b border-[var(--emr-line-hairline)] px-4 py-3">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <SheetTitle className="text-[16px] leading-6">알림</SheetTitle>
              <SheetDescription className="text-[12px] leading-5">
                중요 알림 {badgeCount}개 · 안 읽음 {unreadCount}개
              </SheetDescription>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="알림 닫기"
              className="size-7 rounded-[var(--emr-radius-control)]"
              onClick={() => onOpenChange(false)}
            >
              <CloseIcon aria-hidden="true" />
            </Button>
          </div>
        </SheetHeader>

        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-b border-[var(--emr-line-hairline)] px-4 py-2.5">
          <SegmentedControl
            aria-label="알림 필터"
            value={filter}
            items={filterItems}
            variant="tabs"
            className="max-w-full"
            itemClassName="h-6 min-h-6 px-2 text-[12px]"
            onValueChange={setFilter}
          />
          <Button size="xs" variant="ghost" disabled>
            전체 읽음
          </Button>
        </div>

        <ScrollArea className="min-h-0 flex-1">
          <div data-testid="global-notification-drawer-list">
            {visibleNotifications.map((notification) => (
              <NotificationRow key={notification.id} notification={notification} />
            ))}
            {visibleNotifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-[12px] leading-5 text-[var(--emr-text-tertiary)]">
                표시할 알림이 없습니다.
              </p>
            ) : null}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
