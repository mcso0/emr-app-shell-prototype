"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { GlobalNotificationDrawer } from "@/features/notifications/global-notification-drawer";
import {
  applyNotificationLocalState,
  getInitialNotificationLocalState,
  mockGlobalNotifications,
  readNotificationLocalState,
  resolveNotificationBadgeCount,
  type GlobalNotification,
  type NotificationLocalState,
  writeNotificationLocalState,
} from "@/features/notifications/mock-notifications";
import { isPreparedEmptyClinicWorkspace } from "@/lib/emr-domain/demo-workspaces";
import { getModule } from "@/modules/registry";
import { useLayoutStore } from "@/stores/layout-store";
import { useWorkspaceTabsStore } from "@/stores/workspace-tabs-store";
import { ShellMain } from "@/shell/shell-main";
import { WorkspaceTabsBar } from "@/shell/workspace-tabs-bar";

type AppShellProps = {
  workspaceId: string;
  moduleId: string;
};

type PendingUrlState = {
  search: string;
  contentAsideOpen?: boolean;
  modulePanelOpen?: boolean;
  rightPanelOpen?: boolean;
};

declare global {
  interface Window {
    __clairSetNotificationNavigationDirty?: (dirty: boolean) => void;
  }
}

const notificationNavigationDirtyConfirmationMessage =
  "작업 중인 내용이 저장되지 않을 수 있습니다. 이동하시겠습니까?";

const crossModuleQueryKeys = [
  "scenario",
  "patientId",
  "encounterId",
  "labResultId",
  "imagingStudyId",
  "invoiceId",
  "modulePanel",
  "aside",
  "context",
  "right",
] as const;

const emptyGlobalNotifications: GlobalNotification[] = [];

function getCrossModuleNavigationSearch(
  search: string,
  currentModuleLayout: { hasContentAside: boolean; hasRightPanel: boolean }
) {
  const currentParams = new URLSearchParams(search);
  const nextParams = new URLSearchParams();

  crossModuleQueryKeys.forEach((key) => {
    if ((key === "aside" || key === "context") && !currentModuleLayout.hasContentAside) return;
    if (key === "right" && !currentModuleLayout.hasRightPanel) return;

    const value = currentParams.get(key);
    if (value) {
      nextParams.set(key, value);
    }
  });

  return nextParams.toString();
}

function getNotificationSourceModuleId(route: string) {
  const pathname = route.split("?")[0];
  const [, workspacePrefix, , moduleId] = pathname.split("/");

  if (workspacePrefix !== "w") return null;

  return moduleId || null;
}

export function AppShell({ workspaceId, moduleId }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const moduleDefinition = useMemo(() => getModule(moduleId), [moduleId]);
  const workspaceNotifications = isPreparedEmptyClinicWorkspace(workspaceId)
    ? emptyGlobalNotifications
    : mockGlobalNotifications;
  const navigationSearch = useMemo(
    () =>
      getCrossModuleNavigationSearch(search, {
        hasContentAside: Boolean(moduleDefinition.contentAside),
        hasRightPanel: Boolean(moduleDefinition.rightPanel),
      }),
    [moduleDefinition.contentAside, moduleDefinition.rightPanel, search]
  );
  const currentRoute = `${pathname}${search ? `?${search}` : ""}`;
  const pendingUrlStateRef = useRef<PendingUrlState | null>(null);
  const pendingTabRouteRef = useRef<string | null>(null);
  const tabsInitializedRef = useRef<string | null>(null);
  const urlStateReadyRef = useRef(false);
  const [notificationDrawerOpen, setNotificationDrawerOpen] = useState(false);
  const [notificationFallbackDetailId, setNotificationFallbackDetailId] = useState<string | null>(null);
  const [notificationLocalState, setNotificationLocalState] = useState<NotificationLocalState>(() =>
    getInitialNotificationLocalState(workspaceNotifications)
  );
  const [notificationLocalStateHydrated, setNotificationLocalStateHydrated] = useState(false);
  const [urlStateVersion, setUrlStateVersion] = useState(0);
  const notifications = useMemo(
    () => applyNotificationLocalState(workspaceNotifications, notificationLocalState),
    [notificationLocalState, workspaceNotifications]
  );
  const notificationBadgeCount = useMemo(
    () => resolveNotificationBadgeCount(notifications),
    [notifications]
  );
  const {
    activeTabId,
    activateTab,
    closeTab,
    createTab,
    goBack,
    goForward,
    initialize,
    pushRoute,
    syncActiveRoute,
    tabs,
  } = useWorkspaceTabsStore();
  const activeTab = tabs.find((tab) => tab.id === activeTabId);
  const {
    activeDrawer,
    contentAsideOpen,
    enterModule,
    modulePanelOpen,
    notificationNavigationDirty,
    rightPanelOpen,
    setActiveDrawer,
    setContentAsideOpen,
    setModulePanelOpen,
    setRightPanelOpen,
  } = useLayoutStore();

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;

    window.__clairSetNotificationNavigationDirty = (dirty: boolean) => {
      useLayoutStore.getState().setNotificationNavigationDirty(dirty);
    };

    return () => {
      delete window.__clairSetNotificationNavigationDirty;
    };
  }, []);

  useEffect(() => {
    if (tabsInitializedRef.current === workspaceId) return;
    initialize({ workspaceId, route: currentRoute, moduleId: moduleDefinition.id });
    tabsInitializedRef.current = workspaceId;
  }, [currentRoute, initialize, moduleDefinition.id, workspaceId]);

  useEffect(() => {
    if (tabsInitializedRef.current !== workspaceId) return;
    if (!activeTab) return;

    if (pendingTabRouteRef.current) {
      if (pendingTabRouteRef.current === currentRoute) {
        pendingTabRouteRef.current = null;
      }
      return;
    }

    const activeRoute = activeTab.history[activeTab.historyIndex];
    if (activeRoute === currentRoute && activeTab.moduleId === moduleDefinition.id) return;

    syncActiveRoute(currentRoute, moduleDefinition.id);
  }, [activeTab, currentRoute, moduleDefinition.id, syncActiveRoute, workspaceId]);

  useLayoutEffect(() => {
    enterModule();
  }, [enterModule, moduleDefinition.id]);

  useEffect(() => {
    const hydrateTimer = window.setTimeout(() => {
      setNotificationLocalState(readNotificationLocalState(window.localStorage, workspaceNotifications));
      setNotificationLocalStateHydrated(true);
    }, 0);

    return () => {
      window.clearTimeout(hydrateTimer);
    };
  }, [workspaceNotifications]);

  useEffect(() => {
    if (!notificationLocalStateHydrated) return;

    writeNotificationLocalState(window.localStorage, notificationLocalState);
  }, [notificationLocalState, notificationLocalStateHydrated]);

  useLayoutEffect(() => {
    urlStateReadyRef.current = false;
    const urlParams = new URLSearchParams(window.location.search || search);
    const modulePanel = urlParams.get("modulePanel");
    const aside = urlParams.get("aside") ?? urlParams.get("context");
    const right = urlParams.get("right");
    const drawer = urlParams.get("drawer");
    const pendingUrlState: PendingUrlState = { search };
    const currentLayoutState = useLayoutStore.getState();
    const moduleHasSidePanel = Boolean(moduleDefinition.sidePanel);

    if (modulePanel || !moduleHasSidePanel) {
      const nextModulePanelOpen = moduleHasSidePanel ? modulePanel === "open" : true;
      if (currentLayoutState.modulePanelOpen !== nextModulePanelOpen) {
        pendingUrlState.modulePanelOpen = nextModulePanelOpen;
      }
      setModulePanelOpen(nextModulePanelOpen);
    }
    if (aside) {
      const nextContentAsideOpen = aside !== "closed";
      if (currentLayoutState.contentAsideOpen !== nextContentAsideOpen) {
        pendingUrlState.contentAsideOpen = nextContentAsideOpen;
      }
      setContentAsideOpen(nextContentAsideOpen);
    } else if (moduleDefinition.contentAside) {
      const nextContentAsideOpen = moduleDefinition.defaultContentAsideOpen ?? false;
      if (currentLayoutState.contentAsideOpen !== nextContentAsideOpen) {
        pendingUrlState.contentAsideOpen = nextContentAsideOpen;
      }
      setContentAsideOpen(nextContentAsideOpen);
    }
    if (right) {
      const nextRightPanelOpen = right !== "closed";
      if (currentLayoutState.rightPanelOpen !== nextRightPanelOpen) {
        pendingUrlState.rightPanelOpen = nextRightPanelOpen;
      }
      setRightPanelOpen(nextRightPanelOpen);
    } else if (moduleDefinition.rightPanel) {
      const nextRightPanelOpen = moduleDefinition.defaultRightPanelOpen ?? true;
      if (currentLayoutState.rightPanelOpen !== nextRightPanelOpen) {
        pendingUrlState.rightPanelOpen = nextRightPanelOpen;
      }
      setRightPanelOpen(nextRightPanelOpen);
    }
    if (drawer) {
      const [type, id] = drawer.split(":");
      if (type && id) {
        const nextDrawer =
          currentLayoutState.activeDrawer?.type === type && currentLayoutState.activeDrawer.id === id
            ? currentLayoutState.activeDrawer
            : { type, id };
        setActiveDrawer(nextDrawer);
      }
    }
    pendingUrlStateRef.current = pendingUrlState;
    const syncReadyTimer = window.setTimeout(() => {
      urlStateReadyRef.current = true;
      setUrlStateVersion((version) => version + 1);
    }, 0);

    return () => {
      window.clearTimeout(syncReadyTimer);
    };
  }, [
    search,
    setActiveDrawer,
    setContentAsideOpen,
    setModulePanelOpen,
    setRightPanelOpen,
    moduleDefinition.defaultContentAsideOpen,
    moduleDefinition.defaultRightPanelOpen,
    moduleDefinition.contentAside,
    moduleDefinition.sidePanel,
    moduleDefinition.rightPanel,
  ]);

  useEffect(() => {
    if (!urlStateReadyRef.current) return;

    const pendingUrlState = pendingUrlStateRef.current;

    if (pendingUrlState?.search === search) {
      const pendingStateApplied =
        (pendingUrlState.modulePanelOpen === undefined ||
          pendingUrlState.modulePanelOpen === modulePanelOpen) &&
        (pendingUrlState.contentAsideOpen === undefined ||
          pendingUrlState.contentAsideOpen === contentAsideOpen) &&
        (pendingUrlState.rightPanelOpen === undefined ||
          pendingUrlState.rightPanelOpen === rightPanelOpen);

      if (!pendingStateApplied) return;

      pendingUrlStateRef.current = null;
    }

    const params = new URLSearchParams(search);
    params.set("modulePanel", modulePanelOpen ? "open" : "closed");
    if (moduleDefinition.contentAside) {
      params.set("aside", contentAsideOpen ? "history" : "closed");
    } else {
      params.delete("aside");
      params.delete("context");
    }
    if (moduleDefinition.rightPanel) {
      params.set("right", rightPanelOpen ? "open" : "closed");
    } else {
      params.delete("right");
    }
    if (activeDrawer) {
      params.set("drawer", `${activeDrawer.type}:${activeDrawer.id}`);
    } else {
      params.delete("drawer");
    }
    const nextSearch = params.toString();
    if (search !== nextSearch) {
      if (window.location.pathname !== pathname) return;
      router.replace(`${pathname}?${nextSearch}`, { scroll: false });
    }
  }, [
    activeDrawer,
    contentAsideOpen,
    moduleDefinition.contentAside,
    moduleDefinition.rightPanel,
    modulePanelOpen,
    pathname,
    rightPanelOpen,
    router,
    search,
    urlStateVersion,
  ]);

  function navigateToTabRoute(route: string | null) {
    if (!route) return;
    pendingTabRouteRef.current = route;
    router.push(route, { scroll: false });
  }

  function handleActivateTab(tabId: string) {
    navigateToTabRoute(activateTab(tabId));
  }

  function handleCloseTab(tabId: string) {
    navigateToTabRoute(closeTab(tabId));
  }

  function handleNewTab() {
    toast.success("새 탭이 생성되었습니다.");
    navigateToTabRoute(createTab({ workspaceId, route: currentRoute, moduleId: moduleDefinition.id }));
  }

  function handleMarkNotificationRead(notificationId: string) {
    setNotificationLocalState((state) =>
      state.readIds.includes(notificationId)
        ? state
        : { ...state, readIds: [...state.readIds, notificationId] }
    );
  }

  function handleArchiveNotification(notificationId: string) {
    setNotificationLocalState((state) => ({
      readIds: state.readIds.includes(notificationId)
        ? state.readIds
        : [...state.readIds, notificationId],
      archivedIds: state.archivedIds.includes(notificationId)
        ? state.archivedIds
        : [...state.archivedIds, notificationId],
    }));
  }

  function handleRestoreNotification(notificationId: string) {
    setNotificationLocalState((state) => ({
      ...state,
      archivedIds: state.archivedIds.filter((id) => id !== notificationId),
    }));
  }

  function handleMarkAllNotificationsRead() {
    setNotificationLocalState((state) => {
      const readIds = new Set(state.readIds);

      notifications.forEach((notification) => {
        if (!notification.archived) {
          readIds.add(notification.id);
        }
      });

      return { ...state, readIds: Array.from(readIds) };
    });
  }

  function handleCloseNotificationFallbackDetail() {
    setNotificationFallbackDetailId(null);
  }

  function handleOpenNotificationSource(notification: GlobalNotification) {
    if (!notification.source.route) {
      handleMarkNotificationRead(notification.id);
      setNotificationFallbackDetailId(notification.id);
      setNotificationDrawerOpen(true);
      return;
    }

    if (notificationNavigationDirty && !window.confirm(notificationNavigationDirtyConfirmationMessage)) {
      return;
    }

    const nextModuleId = getNotificationSourceModuleId(notification.source.route);

    if (!nextModuleId) {
      handleMarkNotificationRead(notification.id);
      setNotificationFallbackDetailId(notification.id);
      setNotificationDrawerOpen(true);
      return;
    }

    handleMarkNotificationRead(notification.id);
    setNotificationFallbackDetailId(null);
    setNotificationDrawerOpen(false);
    handleNavigateModule(notification.source.route, nextModuleId);
  }

  function handleNavigateModule(href: string, nextModuleId: string) {
    if (activeTab?.history[activeTab.historyIndex] === href) return;

    pushRoute(href, nextModuleId);
    pendingTabRouteRef.current = href;
    router.push(href, { scroll: false });
  }

  function handleTabBack() {
    navigateToTabRoute(goBack());
  }

  function handleTabForward() {
    navigateToTabRoute(goForward());
  }

  return (
    <div className="h-screen min-h-0 overflow-hidden bg-[var(--emr-surface-app)] text-foreground">
      <ShellMain
        moduleDefinition={moduleDefinition}
        navigationSearch={navigationSearch}
        topBar={
          <WorkspaceTabsBar
            activeTabId={activeTabId}
            canGoBack={Boolean(activeTab && activeTab.historyIndex > 0)}
            canGoForward={Boolean(activeTab && activeTab.historyIndex < activeTab.history.length - 1)}
            notificationBadgeCount={notificationBadgeCount}
            notificationDrawerOpen={notificationDrawerOpen}
            tabs={tabs}
            workspaceId={workspaceId}
            onActivateTab={handleActivateTab}
            onBack={handleTabBack}
            onCloseTab={handleCloseTab}
            onForward={handleTabForward}
            onNewTab={handleNewTab}
            onOpenNotifications={() => setNotificationDrawerOpen(true)}
          />
        }
        workspaceId={workspaceId}
        onNavigateModule={handleNavigateModule}
      />
      <GlobalNotificationDrawer
        badgeCount={notificationBadgeCount}
        fallbackDetailNotificationId={notificationFallbackDetailId}
        notifications={notifications}
        open={notificationDrawerOpen}
        onArchiveNotification={handleArchiveNotification}
        onCloseFallbackDetail={handleCloseNotificationFallbackDetail}
        onMarkAllRead={handleMarkAllNotificationsRead}
        onMarkNotificationRead={handleMarkNotificationRead}
        onOpenNotificationSource={handleOpenNotificationSource}
        onOpenChange={setNotificationDrawerOpen}
        onRestoreNotification={handleRestoreNotification}
      />
    </div>
  );
}
