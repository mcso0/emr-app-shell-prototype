"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getModule } from "@/modules/registry";
import { useLayoutStore } from "@/stores/layout-store";
import { useWorkspaceTabsStore } from "@/stores/workspace-tabs-store";
import { NavRail } from "@/shell/nav-rail";
import { WorkspaceFrame } from "@/shell/workspace-frame";
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

function getCrossModuleNavigationSearch(search: string) {
  const currentParams = new URLSearchParams(search);
  const nextParams = new URLSearchParams();

  crossModuleQueryKeys.forEach((key) => {
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
  const moduleDefinition = useMemo(() => getModule(moduleId), [moduleId]);
  const navigationSearch = useMemo(() => getCrossModuleNavigationSearch(search), [search]);
  const currentRoute = `${pathname}${search ? `?${search}` : ""}`;
  const pendingUrlStateRef = useRef<PendingUrlState | null>(null);
  const pendingTabRouteRef = useRef<string | null>(null);
  const tabsInitializedRef = useRef<string | null>(null);
  const urlStateReadyRef = useRef(false);
  const [urlStateVersion, setUrlStateVersion] = useState(0);
  const {
    activeTabId,
    activateTab,
    closeTab,
    createTab,
    goBack,
    goForward,
    initialize,
    syncActiveRoute,
    tabs,
  } = useWorkspaceTabsStore();
  const activeTab = tabs.find((tab) => tab.id === activeTabId);
  const {
    activeDrawer,
    contentAsideOpen,
    enterModule,
    modulePanelOpen,
    rightPanelOpen,
    setActiveDrawer,
    setContentAsideOpen,
    setModulePanelOpen,
    setRightPanelOpen,
  } = useLayoutStore();

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
    const route = `/w/${workspaceId}/home?modulePanel=open`;
    navigateToTabRoute(createTab({ workspaceId, route, moduleId: "home" }));
  }

  function handleTabBack() {
    navigateToTabRoute(goBack());
  }

  function handleTabForward() {
    navigateToTabRoute(goForward());
  }

  return (
    <div className="h-screen min-h-0 overflow-hidden bg-[var(--emr-surface-app)] text-foreground">
      <WorkspaceTabsBar
        activeTabId={activeTabId}
        canGoBack={Boolean(activeTab && activeTab.historyIndex > 0)}
        canGoForward={Boolean(activeTab && activeTab.historyIndex < activeTab.history.length - 1)}
        tabs={tabs}
        workspaceId={workspaceId}
        onActivateTab={handleActivateTab}
        onBack={handleTabBack}
        onCloseTab={handleCloseTab}
        onForward={handleTabForward}
        onNewTab={handleNewTab}
      />
      <div className="grid h-[calc(100vh-58px)] grid-cols-[48px_1fr] gap-2.5 px-2.5 pb-2.5">
        <NavRail
          activeModuleId={moduleDefinition.id}
          navigationSearch={navigationSearch}
          workspaceId={workspaceId}
        />
        <WorkspaceFrame moduleDefinition={moduleDefinition} workspaceId={workspaceId} />
      </div>
    </div>
  );
}
