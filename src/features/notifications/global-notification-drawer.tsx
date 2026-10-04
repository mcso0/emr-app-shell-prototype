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

type NotificationFilter = "all" | "unread" | "requires_action" | "archived";

type GlobalNotificationDrawerProps = {
  badgeCount: number;
  globalUnreadCount?: number;
  errorMessage?: string | null;
  fallbackDetailNotificationId: string | null;
  loading?: boolean;
  notifications: GlobalNotification[];
  open: boolean;
  stateNotice?: string;
  onArchiveNotification: (notificationId: string) => void | Promise<unknown>;
  onCloseFallbackDetail: () => void;
  onMarkAllRead: () => void | Promise<unknown>;
  onMarkNotificationRead: (notificationId: string) => void | Promise<unknown>;
  onOpenChange: (open: boolean) => void;
  onOpenNotificationSource: (notification: GlobalNotification) => void | Promise<unknown>;
  onRestoreNotification: (notificationId: string) => void | Promise<unknown>;
  onRetry?: () => void;
};

const filterLabels: Record<NotificationFilter, string> = {
  all: "전체",
  unread: "안 읽음",
  requires_action: "중요",
  archived: "보관",
};

function getFilteredNotifications(notifications: GlobalNotification[], filter: NotificationFilter) {
  if (filter === "archived") {
    return notifications.filter((notification) => notification.archived);
  }

  if (filter === "unread") {
    return notifications.filter((notification) => !notification.archived && notification.unread);
  }

  if (filter === "requires_action") {
    return notifications.filter(
      (notification) => !notification.archived && notification.requires_action
    );
  }

  return notifications.filter((notification) => !notification.archived);
}

function getFilterItems(notifications: GlobalNotification[]): Array<SegmentedControlItem<NotificationFilter>> {
  return (["all", "unread", "requires_action", "archived"] as NotificationFilter[]).map((filter) => ({
    value: filter,
    label: (
      <>
        {filterLabels[filter]}
        {" "}
      </>
    ),
    count: getFilteredNotifications(notifications, filter).length,
  }));
}

function NotificationRow({
  notification,
  onArchive,
  onMarkRead,
  onOpenSource,
  onRestore,
}: {
  notification: GlobalNotification;
  onArchive: (notificationId: string) => void;
  onMarkRead: (notificationId: string) => void;
  onOpenSource: (notification: GlobalNotification) => void;
  onRestore: (notificationId: string) => void;
}) {
  const stateLabel = notification.archived ? "보관됨" : notification.unread ? "안 읽음" : "읽음";

  return (
    <article
      data-testid={`global-notification-row-${notification.id}`}
      data-notification-state={notification.unread ? "unread" : "read"}
      data-notification-archived={notification.archived ? "true" : "false"}
      className={cn(
        "grid grid-cols-[18px_minmax(0,1fr)] gap-3 border-b border-[var(--emr-border-default)] px-4 py-3",
        notification.unread
          ? "bg-[var(--emr-surface-app)]"
          : "bg-transparent text-[var(--emr-text-secondary)]"
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "mt-1.5 size-2 rounded-full border",
          notification.unread && notification.requires_action
            ? "bg-[var(--emr-status-danger-text)]"
            : notification.unread
              ? "bg-[var(--emr-status-neutral-text)]"
              : "border-[var(--emr-status-neutral-border)] bg-transparent"
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
              <span className="emr-text-metadata text-[var(--emr-text-tertiary)]">
                {stateLabel}
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
          <Button type="button" size="xs" variant="outline" onClick={() => onOpenSource(notification)}>
            <CdsNavigationExternalLinkIcon data-icon="inline-start" />
            {notification.sourceActionLabel}
          </Button>
          {notification.unread ? (
            <Button
              type="button"
              size="xs"
              variant="ghost"
              aria-label={`${notification.title} 읽음 처리`}
              onClick={() => onMarkRead(notification.id)}
            >
              읽음 처리
            </Button>
          ) : null}
          {notification.archived ? (
            <Button
              type="button"
              size="xs"
              variant="ghost"
              aria-label={`${notification.title} 보관 해제`}
              onClick={() => onRestore(notification.id)}
            >
              보관 해제
            </Button>
          ) : (
            <Button
              type="button"
              size="xs"
              variant="ghost"
              aria-label={`${notification.title} 보관`}
              onClick={() => onArchive(notification.id)}
            >
              보관
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}

const fallbackReasonLabels: Record<NonNullable<GlobalNotification["source"]["fallback_reason"]>, string> = {
  missing_source: "원본 업무 화면을 열 수 없습니다. 연결된 source entity가 현재 mock fixture에 없습니다.",
  closed_encounter: "원본 encounter가 종료되어 바로 이동할 수 없습니다.",
  permission_unavailable: "현재 mock 권한 범위에서 원본 업무 화면을 열 수 없습니다.",
};

function NotificationFallbackDetail({
  notification,
  onClose,
}: {
  notification: GlobalNotification;
  onClose: () => void;
}) {
  const fallbackReason = notification.source.fallback_reason ?? notification.fallback_reason ?? "missing_source";

  return (
    <section
      data-testid="global-notification-fallback-detail"
      className="border-b border-[var(--emr-border-default)] bg-[var(--emr-surface-raised)] px-4 py-3"
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-[12px] font-semibold leading-5 text-[var(--emr-text-primary)]">
            원본 업무 화면을 열 수 없습니다
          </p>
          <p className="text-[12px] leading-5 text-[var(--emr-text-secondary)]">
            {fallbackReasonLabels[fallbackReason]}
          </p>
        </div>
        <Button type="button" size="xs" variant="ghost" onClick={onClose}>
          닫기
        </Button>
      </div>
      <div className="mt-2 space-y-1 text-[11px] leading-4 text-[var(--emr-text-tertiary)]">
        <p>{notification.title}</p>
        <p>{notification.detail}</p>
        <p>
          {notification.sourceLabel} · {notification.recipientLabel}
        </p>
      </div>
    </section>
  );
}

export function GlobalNotificationDrawer({
  badgeCount,
  globalUnreadCount,
  errorMessage,
  fallbackDetailNotificationId,
  loading = false,
  notifications,
  open,
  stateNotice = "v1 알림의 읽음/보관 상태는 서버 API에 저장됩니다. 다른 브라우저에서도 같은 사용자 상태로 동기화됩니다.",
  onArchiveNotification,
  onCloseFallbackDetail,
  onMarkAllRead,
  onMarkNotificationRead,
  onOpenChange,
  onOpenNotificationSource,
  onRestoreNotification,
  onRetry,
}: GlobalNotificationDrawerProps) {
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const loadedUnreadCount = useMemo(() => resolveNotificationUnreadCount(notifications), [notifications]);
  const unreadCount = globalUnreadCount ?? loadedUnreadCount;
  const filterItems = useMemo(() => getFilterItems(notifications), [notifications]);
  const visibleNotifications = useMemo(
    () => getFilteredNotifications(notifications, filter),
    [filter, notifications]
  );
  const fallbackDetailNotification = fallbackDetailNotificationId
    ? notifications.find((notification) => notification.id === fallbackDetailNotificationId)
    : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        id="global-notification-drawer"
        side="right"
        showCloseButton={false}
        className="w-[min(100vw,420px)] max-w-[100vw] gap-0 border-[var(--emr-border-strong)] bg-[var(--emr-surface-app)] p-0 sm:max-w-[420px]"
      >
        <SheetHeader className="border-b border-[var(--emr-border-default)] px-4 py-3">
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

        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-b border-[var(--emr-border-default)] px-4 py-2.5">
          <SegmentedControl
            aria-label="알림 필터"
            value={filter}
            items={filterItems}
            variant="tabs"
            className="max-w-full"
            itemClassName="h-6 min-h-6 px-2 text-[12px]"
            onValueChange={setFilter}
          />
          <Button
            type="button"
            size="xs"
            variant="ghost"
            disabled={unreadCount === 0}
            onClick={onMarkAllRead}
          >
            전체 읽음
          </Button>
        </div>
        <p
          data-testid="global-notification-state-notice"
          className="border-b border-[var(--emr-border-default)] px-4 py-2 text-[11px] leading-4 text-[var(--emr-text-tertiary)]"
        >
          {stateNotice}
        </p>
        {errorMessage ? (
          <div
            data-testid="global-notification-error-state"
            className="flex min-w-0 items-start justify-between gap-3 border-b border-[var(--emr-status-warning-border)] bg-[var(--emr-status-warning-bg)] px-4 py-3 text-[12px] leading-5"
          >
            <p className="min-w-0 text-[var(--emr-status-warning-text)]">{errorMessage}</p>
            {onRetry ? (
              <Button type="button" size="xs" variant="outline" onClick={onRetry}>
                다시 시도
              </Button>
            ) : null}
          </div>
        ) : null}
        {fallbackDetailNotification ? (
          <NotificationFallbackDetail
            notification={fallbackDetailNotification}
            onClose={onCloseFallbackDetail}
          />
        ) : null}

        <ScrollArea className="min-h-0 flex-1">
          <div data-testid="global-notification-drawer-list">
            {loading ? (
              <p
                data-testid="global-notification-loading-state"
                className="px-4 py-8 text-center text-[12px] leading-5 text-[var(--emr-text-tertiary)]"
              >
                알림을 불러오는 중입니다.
              </p>
            ) : null}
            {visibleNotifications.map((notification) => (
              <NotificationRow
                key={notification.id}
                notification={notification}
                onArchive={onArchiveNotification}
                onMarkRead={onMarkNotificationRead}
                onOpenSource={onOpenNotificationSource}
                onRestore={onRestoreNotification}
              />
            ))}
            {!loading && visibleNotifications.length === 0 ? (
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
