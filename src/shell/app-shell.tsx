"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog } from "@/components/ui/dialog";
import { EmrDialogShell } from "@/components/emr/dialog-shell";
import { getDemoActorHeaders } from "@/features/auth/demo-actor";
import { useAuthClient } from "@/features/auth/auth-client";
import { useWorkspaceEntrySplash } from "@/features/auth/workspace-entry-splash-provider";
import { WorkspaceStaffPresenceReporter } from "@/features/staff/workspace-staff-presence";
import { GlobalNotificationDrawer } from "@/features/notifications/global-notification-drawer";
import {
  type GlobalNotification,
} from "@/features/notifications/mock-notifications";
import {
  emptyLiveNotificationCounts,
  fetchLiveNotificationSnapshot,
  mutateLiveNotification,
  type LiveNotificationCounts,
  type LiveNotificationMutationAction,
} from "@/features/notifications/live-notifications-client";
import { getModule } from "@/modules/registry";
import { useLayoutStore } from "@/stores/layout-store";
import {
  getWorkspaceTabIdentityFromRoute,
  useWorkspaceTabsStore,
  type WorkspaceTab,
} from "@/stores/workspace-tabs-store";
import { ShellMain } from "@/shell/shell-main";
import { buildWorkspaceHomeRoute } from "@/shell/workspace-surface-route";
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

type PendingDuplicateTabNavigation = {
  href: string;
  nextModuleId: string;
  existingTab: WorkspaceTab;
};

type NotificationRequestState = "idle" | "loading" | "ready" | "error" | "permission_denied";

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
const duplicateWarningPreferencePrefix = "clair-workspace-tabs-duplicate-warning-hidden:v1";

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
  const { hydrated: authHydrated, session: authSession, hydrate: hydrateAuth } = useAuthClient();
  const { completeWorkspaceEntrySplash } = useWorkspaceEntrySplash();
  const [notificationDrawerOpen, setNotificationDrawerOpen] = useState(false);
  const [notificationFallbackDetailId, setNotificationFallbackDetailId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<GlobalNotification[]>(emptyGlobalNotifications);
  const [notificationCounts, setNotificationCounts] =
    useState<LiveNotificationCounts>(emptyLiveNotificationCounts);
  const [notificationRequestState, setNotificationRequestState] =
    useState<NotificationRequestState>("idle");
  const [notificationErrorMessage, setNotificationErrorMessage] = useState<string | null>(null);
  const [notificationReloadKey, setNotificationReloadKey] = useState(0);
  const [duplicateNavigation, setDuplicateNavigation] = useState<PendingDuplicateTabNavigation | null>(null);
  const [skipDuplicateWarning, setSkipDuplicateWarning] = useState(false);
  const [urlStateVersion, setUrlStateVersion] = useState(0);
  const actorHeaders = useMemo(() => getDemoActorHeaders(authSession), [authSession]);
  const notificationBadgeCount = notificationCounts.badge;
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
    moduleRefreshActions,
    modulePanelOpen,
    notificationNavigationDirty,
    rightPanelOpen,
    setActiveDrawer,
    setContentAsideOpen,
    setModulePanelOpen,
    setRightPanelOpen,
  } = useLayoutStore();
  const moduleRefreshAction = moduleRefreshActions[moduleDefinition.id];

  useEffect(() => {
    completeWorkspaceEntrySplash();
  }, [completeWorkspaceEntrySplash]);

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
    hydrateAuth();
  }, [hydrateAuth]);

  useEffect(() => {
    if (!authHydrated) return;

    const controller = new AbortController();
    let cancelled = false;

    void Promise.resolve().then(() => {
      if (cancelled) return null;
      setNotificationRequestState((state) => (state === "ready" ? "ready" : "loading"));

      return fetchLiveNotificationSnapshot({
        actorHeaders,
        signal: controller.signal,
        workspaceId,
      });
    }).then((result) => {
      if (!result) return;
      if (cancelled) return;

      if (result.ok) {
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

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [actorHeaders, authHydrated, notificationReloadKey, workspaceId]);

  useEffect(() => {
    if (tabsInitializedRef.current === workspaceId) return;
    void initialize({ workspaceId, route: currentRoute, moduleId: moduleDefinition.id });
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

  useLayoutEffect(() => {
    urlStateReadyRef.current = false;
    const urlParams = new URLSearchParams(window.location.search || search);
    const modulePanel = urlParams.get("modulePanel");
    const aside = urlParams.get("aside") ?? urlParams.get("context");
    const right = urlParams.get("right");
    const drawer = urlParams.get("drawer");
    const receptionRightPanelDrawerFromUrl =
      drawer?.startsWith("reception-appointment:") ||
      drawer?.startsWith("reception-appointment-check-in-form:") ||
      drawer?.startsWith("reception-encounter:") ||
      drawer?.startsWith("reception-form:") ||
      drawer?.startsWith("reception-reservation-form:");
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
      const nextRightPanelOpen =
        moduleDefinition.id === "reception" && receptionRightPanelDrawerFromUrl
          ? true
          : (moduleDefinition.defaultRightPanelOpen ?? true);
      if (currentLayoutState.rightPanelOpen !== nextRightPanelOpen) {
        pendingUrlState.rightPanelOpen = nextRightPanelOpen;
      }
      setRightPanelOpen(nextRightPanelOpen);
    }
    if (drawer) {
      const separatorIndex = drawer.indexOf(":");
      const type = separatorIndex >= 0 ? drawer.slice(0, separatorIndex) : "";
      const id = separatorIndex >= 0 ? drawer.slice(separatorIndex + 1) : "";
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
    moduleDefinition.id,
    moduleDefinition.sidePanel,
    moduleDefinition.rightPanel,
  ]);

  useEffect(() => {
    if (!urlStateReadyRef.current) return;
    if (pendingTabRouteRef.current) return;

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
    if (
      activeDrawer &&
      activeDrawer.rightPanelPresentation?.persistToUrl !== false
    ) {
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
    const route = buildWorkspaceHomeRoute(workspaceId);

    toast.success("새 탭이 생성되었습니다.");
    navigateToTabRoute(createTab({ workspaceId, route, moduleId: "home" }));
  }

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
    await runNotificationMutation({
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

  function handleCloseNotificationFallbackDetail() {
    setNotificationFallbackDetailId(null);
  }

  async function handleOpenNotificationSource(notification: GlobalNotification) {
    if (!notification.source.route) {
      setNotificationFallbackDetailId(notification.id);
      setNotificationDrawerOpen(true);
      await handleMarkNotificationRead(notification.id, { silent: true });
      return;
    }

    if (notificationNavigationDirty && !window.confirm(notificationNavigationDirtyConfirmationMessage)) {
      return;
    }

    const nextModuleId = getNotificationSourceModuleId(notification.source.route);

    if (!nextModuleId) {
      setNotificationFallbackDetailId(notification.id);
      setNotificationDrawerOpen(true);
      await handleMarkNotificationRead(notification.id, { silent: true });
      return;
    }

    const readSucceeded = await handleMarkNotificationRead(notification.id, { silent: true });
    if (!readSucceeded) return;

    setNotificationFallbackDetailId(null);
    setNotificationDrawerOpen(false);
    handleNavigateModule(notification.source.route, nextModuleId);
  }

  function handleNavigateModule(href: string, nextModuleId: string) {
    if (activeTab?.history[activeTab.historyIndex] === href) return;

    const duplicateTab = findDuplicateWorkspaceTab({
      activeTabId,
      href,
      moduleId: nextModuleId,
      tabs,
      workspaceId,
    });

    if (duplicateTab && !readDuplicateWarningPreference(workspaceId)) {
      setSkipDuplicateWarning(false);
      setDuplicateNavigation({ href, nextModuleId, existingTab: duplicateTab });
      return;
    }

    pendingTabRouteRef.current = href;
    router.push(href, { scroll: false });
    pushRoute(href, nextModuleId);
  }

  function activateDuplicateTab() {
    if (!duplicateNavigation) return;
    if (skipDuplicateWarning) writeDuplicateWarningPreference(workspaceId);
    const route = activateTab(duplicateNavigation.existingTab.id);
    setDuplicateNavigation(null);
    navigateToTabRoute(route);
  }

  function handleTabBack() {
    navigateToTabRoute(goBack());
  }

  function handleTabForward() {
    navigateToTabRoute(goForward());
  }

  return (
    <div className="h-screen min-h-0 overflow-hidden bg-[var(--emr-surface-app)] text-foreground">
      <WorkspaceStaffPresenceReporter workspaceId={workspaceId} />
      <ShellMain
        moduleDefinition={moduleDefinition}
        navigationSearch={navigationSearch}
        topBar={
          <WorkspaceTabsBar
            activeTabId={activeTabId}
            canGoBack={Boolean(activeTab && activeTab.historyIndex > 0)}
            canGoForward={Boolean(activeTab && activeTab.historyIndex < activeTab.history.length - 1)}
            isRefreshing={moduleRefreshAction?.isRefreshing}
            notificationBadgeCount={notificationBadgeCount}
            notificationDrawerOpen={notificationDrawerOpen}
            refreshLabel={moduleRefreshAction?.label ?? `${moduleDefinition.label} 새로고침`}
            tabs={tabs}
            workspaceId={workspaceId}
            onActivateTab={handleActivateTab}
            onBack={handleTabBack}
            onCloseTab={handleCloseTab}
            onForward={handleTabForward}
            onNewTab={handleNewTab}
            onOpenNotifications={() => setNotificationDrawerOpen(true)}
            onRefresh={moduleRefreshAction?.onRefresh}
          />
        }
        workspaceId={workspaceId}
        onNavigateModule={handleNavigateModule}
      />
      <GlobalNotificationDrawer
        badgeCount={notificationBadgeCount}
        errorMessage={notificationErrorMessage}
        fallbackDetailNotificationId={notificationFallbackDetailId}
        loading={notificationRequestState === "loading"}
        notifications={notifications}
        open={notificationDrawerOpen}
        onArchiveNotification={handleArchiveNotification}
        onCloseFallbackDetail={handleCloseNotificationFallbackDetail}
        onMarkAllRead={handleMarkAllNotificationsRead}
        onMarkNotificationRead={handleMarkNotificationRead}
        onOpenNotificationSource={handleOpenNotificationSource}
        onOpenChange={setNotificationDrawerOpen}
        onRetry={handleRetryNotifications}
        onRestoreNotification={handleRestoreNotification}
      />
      <Dialog open={Boolean(duplicateNavigation)} onOpenChange={(open) => !open && setDuplicateNavigation(null)}>
        {duplicateNavigation ? (
          <EmrDialogShell
            title="같은 업무가 이미 열려 있습니다"
            description="다른 탭에서 같은 업무를 보고 있습니다. 기존 탭으로 이동하거나 이 알림을 닫을 수 있습니다."
            bodyClassName="hidden"
            className="[&_[data-slot=dialog-title]]:block [&_[data-slot=dialog-title]]:truncate [&_[data-slot=dialog-title]]:whitespace-nowrap"
            footerClassName="items-center"
            footer={
              <div className="flex w-full min-w-0 items-center justify-between gap-3">
                <label className="flex min-w-0 shrink items-center gap-2 text-sm leading-5 text-[var(--emr-text-tertiary)]">
                  <Checkbox
                    checked={skipDuplicateWarning}
                    onCheckedChange={(checked) => setSkipDuplicateWarning(checked === true)}
                    className="shrink-0"
                  />
                  <span className="min-w-0 truncate whitespace-nowrap">다시 보지 않기</span>
                </label>
                <div className="flex shrink-0 items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="whitespace-nowrap px-3"
                    onClick={() => setDuplicateNavigation(null)}
                  >
                    닫기
                  </Button>
                  <Button
                    type="button"
                    className="whitespace-nowrap px-3"
                    onClick={activateDuplicateTab}
                  >
                    이동하기
                  </Button>
                </div>
              </div>
            }
          />
        ) : null}
      </Dialog>
    </div>
  );
}

function findDuplicateWorkspaceTab({
  activeTabId,
  href,
  moduleId,
  tabs,
  workspaceId,
}: {
  activeTabId: string | null;
  href: string;
  moduleId: string;
  tabs: WorkspaceTab[];
  workspaceId: string;
}) {
  const identity = getWorkspaceTabIdentityFromRoute(workspaceId, href, moduleId);

  if (identity.surfaceType === "module") return null;

  return tabs.find((tab) => tab.id !== activeTabId && tab.dedupeKey === identity.dedupeKey) ?? null;
}

function getDuplicateWarningPreferenceKey(workspaceId: string) {
  return `${duplicateWarningPreferencePrefix}:${workspaceId}`;
}

function readDuplicateWarningPreference(workspaceId: string) {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(getDuplicateWarningPreferenceKey(workspaceId)) === "true";
}

function writeDuplicateWarningPreference(workspaceId: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(getDuplicateWarningPreferenceKey(workspaceId), "true");
}
