"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog } from "@/components/ui/dialog";
import { EmrConfirmDialogContent } from "@/components/emr/confirm-dialog-content";
import { EmrDialogShell } from "@/components/emr/dialog-shell";
import { getDemoActorHeaders } from "@/features/auth/demo-actor";
import { useAuthClient } from "@/features/auth/auth-client";
import type { WorkspaceListOption } from "@/features/auth/workspace-display";
import {
  selectSessionWorkspaceForUser,
  SESSION_WORKSPACES_STORAGE_KEY,
} from "@/features/auth/workspace-session";
import { useWorkspaceEntrySplash } from "@/features/auth/workspace-entry-splash-provider";
import { useHospitalAdminStore } from "@/features/hospital-admin/store";
import { useChartStore } from "@/features/chart/store";
import { WorkspaceStaffPresenceReporter } from "@/features/staff/workspace-staff-presence";
import { LiveNotificationDelivery } from "@/features/notifications/live-notification-delivery";
import { GlobalNotificationDrawer } from "@/features/notifications/global-notification-drawer";
import { getModule } from "@/modules/registry";
import { useLayoutStore } from "@/stores/layout-store";
import {
  getWorkspaceTabIdentityFromRoute,
  useWorkspaceTabsStore,
  type WorkspaceTab,
} from "@/stores/workspace-tabs-store";
import { ShellMain } from "@/shell/shell-main";
import { useShellNotifications } from "@/shell/use-shell-notifications";
import { useShellNotificationNavigation } from "@/shell/use-shell-notification-navigation";
import {
  readDuplicateWarningPreference,
  writeDuplicateWarningPreference,
} from "@/shell/workspace-tab-warning-preference";
import {
  buildWorkspaceHomeRoute,
  buildWorkspaceSwitchRoute,
} from "@/shell/workspace-surface-route";
import { WorkspaceTabsBar } from "@/shell/workspace-tabs-bar";

type AppShellProps = {
  workspaceId: string;
  moduleId?: string;
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

declare global {
  interface Window {
    __clairSetNotificationNavigationDirty?: (dirty: boolean) => void;
  }
}

const crossModuleQueryKeys = [
  "scenario",
  "patientId",
  "encounterId",
  "date",
  "modulePanel",
  "aside",
  "context",
  "right",
] as const;

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

export function AppShell({ workspaceId, moduleId }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const currentModuleId = moduleId ?? pathname.split("/")[3] ?? "";
  const moduleDefinition = useMemo(() => getModule(currentModuleId), [currentModuleId]);
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
  const workspaceSwitchScopeRef = useRef<object | null>(null);
  const workspaceSwitchPendingRef = useRef<{
    scope: object;
    discardUnsavedWorkspaceWork: boolean;
  } | null>(null);
  const { completeWorkspaceEntrySplash } = useWorkspaceEntrySplash();
  const [duplicateNavigation, setDuplicateNavigation] = useState<PendingDuplicateTabNavigation | null>(null);
  const duplicateNavigationVersionRef = useRef(0);
  const [pendingWorkspaceSwitch, setPendingWorkspaceSwitch] =
    useState<WorkspaceListOption | null>(null);
  const [skipDuplicateWarning, setSkipDuplicateWarning] = useState(false);
  const [urlStateVersion, setUrlStateVersion] = useState(0);
  const actorHeaders = useMemo(() => getDemoActorHeaders(authSession), [authSession]);
  const {
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
  } = useShellNotifications({
    actorHeaders,
    authHydrated,
    sessionId: authSession?.id,
    sessionRole: authSession?.role,
    workspaceId,
  });
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
  const [renderedTab, setRenderedTab] = useState({ id: activeTabId, revision: 0 });
  // Commit the content reset with its destination route, never with the departing route.
  if (activeTab && activeTab.history[activeTab.historyIndex] === currentRoute && renderedTab.id !== activeTabId) {
    setRenderedTab({ id: activeTabId, revision: renderedTab.revision + (renderedTab.id ? 1 : 0) });
  }
  const tabNavigationPendingRef = useRef(false);
  const {
    activeDrawer,
    retainedReceptionDrawer,
    contentAsideOpen,
    enterModule,
    moduleRefreshActions,
    modulePanelOpen,
    notificationNavigationDirty,
    rightPanelOpen,
    setActiveDrawer,
    setContentAsideOpen,
    setModulePanelOpen,
    setNotificationNavigationDirty,
    setRightPanelOpen,
  } = useLayoutStore();
  const settingsDirty = useHospitalAdminStore((state) => state.settingsDirty);
  const setSettingsDirty = useHospitalAdminStore((state) => state.setSettingsDirty);
  const moduleRefreshAction = moduleRefreshActions[moduleDefinition.id];
  const {
    open: notificationDrawerOpen,
    setOpen: setNotificationDrawerOpen,
    fallbackDetailId: notificationFallbackDetailId,
    closeFallbackDetail: handleCloseNotificationFallbackDetail,
    openSource: handleOpenNotificationSource,
  } = useShellNotificationNavigation({
    notificationNavigationDirty,
    markRead: handleMarkNotificationRead,
    onNavigateModule: handleNavigateModule,
  });

  useLayoutEffect(() => {
    const scope = { workspaceId, sessionId: authSession?.id, role: authSession?.role, moduleId: moduleDefinition.id };
    workspaceSwitchScopeRef.current = scope;
    return () => {
      if (workspaceSwitchScopeRef.current === scope) workspaceSwitchScopeRef.current = null;
      if (workspaceSwitchPendingRef.current?.scope === scope) workspaceSwitchPendingRef.current = null;
    };
  }, [workspaceId, authSession?.id, authSession?.role, moduleDefinition.id]);

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
    const currentUrlDrawer = currentLayoutState.retainedReceptionDrawer ?? currentLayoutState.activeDrawer;

    if (modulePanel) {
      const nextModulePanelOpen = modulePanel === "open";
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
    if (
      drawer &&
      currentUrlDrawer?.rightPanelPresentation?.persistToUrl !== false
    ) {
      const separatorIndex = drawer.indexOf(":");
      const type = separatorIndex >= 0 ? drawer.slice(0, separatorIndex) : "";
      const id = separatorIndex >= 0 ? drawer.slice(separatorIndex + 1) : "";
      if (type && id) {
        const nextDrawer =
          currentUrlDrawer?.type === type && currentUrlDrawer.id === id
            ? currentUrlDrawer
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

    const selectedUrlDrawer = retainedReceptionDrawer ?? activeDrawer;
    const transientDrawer = selectedUrlDrawer?.rightPanelPresentation?.persistToUrl === false;
    const params = new URLSearchParams(search);
    // A concurrent profile does not replace the calendar drawer's URL owner.
    // Once the calendar drawer closes, remove its stale URL even if the staff
    // profile itself is transient.
    if (transientDrawer && (retainedReceptionDrawer || !(
      moduleDefinition.id === "reception" &&
      /^(reception-appointment|reception-appointment-check-in-form|reception-encounter|reception-form|reception-reservation-form):/.test(params.get("drawer") ?? "")
    ))) {
      return;
    }
    const urlDrawer = transientDrawer ? null : selectedUrlDrawer;
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
    if (urlDrawer) {
      params.set("drawer", `${urlDrawer.type}:${urlDrawer.id}`);
    } else {
      params.delete("drawer");
    }
    const nextSearch = params.toString();
    if (search !== nextSearch) {
      if (window.location.pathname !== pathname) return;
      if (moduleDefinition.documentLayout) {
        // Layout-only URL state must not replace the mounted document or race a later close.
        window.history.replaceState(null, "", `${pathname}?${nextSearch}`);
      } else {
        router.replace(`${pathname}?${nextSearch}`, { scroll: false });
      }
    }
  }, [
    activeDrawer,
    retainedReceptionDrawer,
    contentAsideOpen,
    moduleDefinition.contentAside,
    moduleDefinition.documentLayout,
    moduleDefinition.rightPanel,
    moduleDefinition.id,
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
    if (tabId === activeTabId) return;
    void runWithSavedEditors(() => navigateToTabRoute(activateTab(tabId)));
  }

  function handleCloseTab(tabId: string) {
    if (tabs.length <= 1) return;
    if (tabId !== activeTabId) {
      closeTab(tabId);
      return;
    }
    void runWithSavedEditors(() => navigateToTabRoute(closeTab(tabId)));
  }

  function handleNewTab() {
    void runWithSavedEditors(() => {
      const route = buildWorkspaceHomeRoute(workspaceId);
      toast.success("새 탭이 생성되었습니다.");
      navigateToTabRoute(createTab({ workspaceId, route, moduleId: "home" }));
    });
  }

  async function runWithSavedEditors(navigate: () => void) {
    if (tabNavigationPendingRef.current || workspaceSwitchPendingRef.current) return;
    const scope = workspaceSwitchScopeRef.current;
    const state = useWorkspaceTabsStore.getState();
    const tab = state.tabs.find((item) => item.id === state.activeTabId);
    const route = tab?.history[tab.historyIndex];
    tabNavigationPendingRef.current = true;
    try {
      if (!await useChartStore.getState().flushEditors()) return;
      const latest = useWorkspaceTabsStore.getState();
      const currentTab = latest.tabs.find((item) => item.id === latest.activeTabId);
      if (scope !== workspaceSwitchScopeRef.current || latest.activeTabId !== state.activeTabId || currentTab?.history[currentTab.historyIndex] !== route) return;
      navigate();
    } catch {
      if (scope === workspaceSwitchScopeRef.current) toast.error("작업 내용을 저장하지 못했습니다. 다시 시도해주세요.");
    } finally {
      tabNavigationPendingRef.current = false;
    }
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

    void runWithSavedEditors(() => {
      pendingTabRouteRef.current = href;
      router.push(href, { scroll: false });
      pushRoute(href, nextModuleId);
    });
  }

  async function performWorkspaceSwitch(workspace: WorkspaceListOption, discardUnsavedWorkspaceWork = false) {
    const scope = workspaceSwitchScopeRef.current;
    if (!scope || workspaceSwitchPendingRef.current || tabNavigationPendingRef.current || workspace.id === workspaceId) return;
    const request = { scope, discardUnsavedWorkspaceWork };
    workspaceSwitchPendingRef.current = request;
    try {
      let flushed: boolean;
      try {
        flushed = await useChartStore.getState().flushEditors();
      } catch {
        if (workspaceSwitchScopeRef.current === scope) {
          toast.error("작업 내용을 저장하지 못했습니다. 다시 시도해주세요.");
        }
        return;
      }
      if (!flushed || workspaceSwitchScopeRef.current !== scope || workspaceSwitchPendingRef.current !== request) return;

      const targetModuleId =
        moduleDefinition.id === "orders" &&
        !workspace.roles.includes("hospital_admin")
          ? "home"
          : moduleDefinition.id;
      const targetModule = getModule(targetModuleId);
      const targetRoute = buildWorkspaceSwitchRoute({
        contentAsideOpen,
        hasContentAside: Boolean(targetModule.contentAside),
        hasRightPanel: Boolean(targetModule.rightPanel),
        moduleId: targetModule.id,
        modulePanelOpen,
        rightPanelOpen,
        workspaceId: workspace.id,
      });

      if (discardUnsavedWorkspaceWork) {
        setPendingWorkspaceSwitch(null);
        setNotificationNavigationDirty(false);
        setSettingsDirty(false);
      }

      if (authSession?.id) {
        const selected = selectSessionWorkspaceForUser(
          workspace.id,
          authSession.id,
          window.sessionStorage,
          window.localStorage
        );

        if (selected) {
          window.dispatchEvent(new Event(SESSION_WORKSPACES_STORAGE_KEY));
        }
      }

      pendingTabRouteRef.current = targetRoute;
      router.push(targetRoute, { scroll: false });
    } finally {
      if (workspaceSwitchPendingRef.current === request) workspaceSwitchPendingRef.current = null;
    }
  }

  function handleSelectWorkspace(workspace: WorkspaceListOption) {
    const hasUnsavedWorkspaceWork =
      notificationNavigationDirty ||
      (moduleDefinition.id === "orders" && settingsDirty);

    if (hasUnsavedWorkspaceWork) {
      setPendingWorkspaceSwitch(workspace);
      return;
    }

    void performWorkspaceSwitch(workspace);
  }

  function confirmWorkspaceSwitch() {
    if (!pendingWorkspaceSwitch) return;

    const workspace = pendingWorkspaceSwitch;
    void performWorkspaceSwitch(workspace, true);
  }

  function cancelWorkspaceSwitch() {
    setPendingWorkspaceSwitch(null);
    if (workspaceSwitchPendingRef.current?.discardUnsavedWorkspaceWork) {
      workspaceSwitchPendingRef.current = null;
    }
  }

  function activateDuplicateTab() {
    if (!duplicateNavigation) return;
    const version = duplicateNavigationVersionRef.current;
    void runWithSavedEditors(() => {
      if (version !== duplicateNavigationVersionRef.current) return;
      if (skipDuplicateWarning) writeDuplicateWarningPreference(workspaceId);
      const route = activateTab(duplicateNavigation.existingTab.id);
      setDuplicateNavigation(null);
      navigateToTabRoute(route);
    });
  }

  function cancelDuplicateNavigation() {
    duplicateNavigationVersionRef.current += 1;
    setDuplicateNavigation(null);
  }

  function handleTabBack() {
    void runWithSavedEditors(() => navigateToTabRoute(goBack()));
  }

  function handleTabForward() {
    void runWithSavedEditors(() => navigateToTabRoute(goForward()));
  }

  return (
    <div className="h-screen min-h-0 overflow-hidden bg-[var(--emr-surface-app)] text-foreground">
      <WorkspaceStaffPresenceReporter workspaceId={workspaceId} />
      <ShellMain
        key={`${workspaceId}:${authSession?.id ?? "anonymous"}`}
        workspaceTabRevision={renderedTab.revision}
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
            onActivateTab={handleActivateTab}
            onBack={handleTabBack}
            onCloseTab={handleCloseTab}
            onForward={handleTabForward}
            onNewTab={handleNewTab}
            onOpenNotifications={() => setNotificationDrawerOpen(true)}
            onRefresh={moduleRefreshAction?.onRefresh}
          />
        }
        userSessionId={authSession?.id ?? null}
        workspaceId={workspaceId}
        onNavigateModule={handleNavigateModule}
        onSelectWorkspace={handleSelectWorkspace}
      />
      {authSession?.role === "supabase" ? <LiveNotificationDelivery
        key={`${workspaceId}:${authSession.userId}`}
        workspaceId={workspaceId}
        userId={authSession.userId}
        notifications={notifications}
        ready={notificationRequestState === "ready" && notificationSnapshotScope === `${workspaceId}:${authSession.id}`}
        currentRoute={currentRoute}
        onArchive={handleArchiveNotification}
        onOpenSource={handleOpenNotificationSource}
      /> : null}
      <GlobalNotificationDrawer
        badgeCount={notificationBadgeCount}
        globalUnreadCount={notificationCounts.unread}
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
      <Dialog open={Boolean(duplicateNavigation)} onOpenChange={(open) => !open && cancelDuplicateNavigation()}>
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
                    onClick={cancelDuplicateNavigation}
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
      <Dialog
        open={Boolean(pendingWorkspaceSwitch)}
        onOpenChange={(open) => !open && cancelWorkspaceSwitch()}
      >
        {pendingWorkspaceSwitch ? (
          <EmrConfirmDialogContent
            cancelLabel="계속 작성"
            closeAriaLabel="워크스페이스 전환 취소"
            confirmButtonVariant="destructive"
            confirmLabel="저장하지 않고 전환"
            description={`작성 중인 내용은 저장되지 않습니다. 대상 워크스페이스: ${pendingWorkspaceSwitch.displayName}`}
            title="워크스페이스를 전환할까요?"
            onCancel={cancelWorkspaceSwitch}
            onConfirm={confirmWorkspaceSwitch}
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
