"use client";

import { useState } from "react";
import type { GlobalNotification } from "@/features/notifications/mock-notifications";

type ShellNotificationNavigationOptions = {
  notificationNavigationDirty: boolean;
  markRead: (notificationId: string, options?: { silent?: boolean }) => Promise<boolean>;
  onNavigateModule: (href: string, moduleId: string) => void;
};

const notificationNavigationDirtyConfirmationMessage =
  "작업 중인 내용이 저장되지 않을 수 있습니다. 이동하시겠습니까?";

function getNotificationSourceModuleId(route: string) {
  const pathname = route.split("?")[0];
  const [, workspacePrefix, , moduleId] = pathname.split("/");

  if (workspacePrefix !== "w") return null;

  return moduleId || null;
}

// The drawer and toast share one source action and unsaved-work confirmation.
export function useShellNotificationNavigation({
  notificationNavigationDirty, markRead, onNavigateModule,
}: ShellNotificationNavigationOptions) {
  const [notificationDrawerOpen, setNotificationDrawerOpen] = useState(false);
  const [notificationFallbackDetailId, setNotificationFallbackDetailId] = useState<string | null>(null);

  function handleCloseNotificationFallbackDetail() {
    setNotificationFallbackDetailId(null);
  }

  async function handleOpenNotificationSource(notification: GlobalNotification) {
    if (!notification.source.route) {
      setNotificationFallbackDetailId(notification.id);
      setNotificationDrawerOpen(true);
      await markRead(notification.id, { silent: true });
      return;
    }

    if (notificationNavigationDirty && !window.confirm(notificationNavigationDirtyConfirmationMessage)) {
      return;
    }

    const nextModuleId = getNotificationSourceModuleId(notification.source.route);

    if (!nextModuleId) {
      setNotificationFallbackDetailId(notification.id);
      setNotificationDrawerOpen(true);
      await markRead(notification.id, { silent: true });
      return;
    }

    const readSucceeded = await markRead(notification.id, { silent: true });
    if (!readSucceeded) return;

    setNotificationFallbackDetailId(null);
    setNotificationDrawerOpen(false);
    onNavigateModule(notification.source.route, nextModuleId);
  }

  return {
    open: notificationDrawerOpen,
    setOpen: setNotificationDrawerOpen,
    fallbackDetailId: notificationFallbackDetailId,
    closeFallbackDetail: handleCloseNotificationFallbackDetail,
    openSource: handleOpenNotificationSource,
  };
}
