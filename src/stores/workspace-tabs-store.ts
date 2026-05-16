"use client";

import { create } from "zustand";
import { modules } from "@/modules/registry";

export type WorkspaceTab = {
  id: string;
  title: string;
  closable: boolean;
  history: string[];
  historyIndex: number;
  moduleId: string;
  patientId?: string;
  encounterId?: string;
};

type PersistedWorkspaceTabs = {
  workspaceId: string;
  tabs: WorkspaceTab[];
  activeTabId: string;
};

type WorkspaceTabsStore = {
  workspaceId: string | null;
  tabs: WorkspaceTab[];
  activeTabId: string | null;
  hydrated: boolean;
  initialize: (input: { workspaceId: string; route: string; moduleId: string }) => void;
  pushRoute: (route: string, moduleId: string) => void;
  activateTab: (tabId: string) => string | null;
  closeTab: (tabId: string) => string | null;
  createTab: (input: { workspaceId: string; route: string; moduleId: string }) => string;
  goBack: () => string | null;
  goForward: () => string | null;
  syncActiveRoute: (route: string, moduleId: string) => void;
};

const STORAGE_PREFIX = "clair-workspace-tabs:v1";

function getStorageKey(workspaceId: string) {
  return `${STORAGE_PREFIX}:${workspaceId}`;
}

function getTabTitle(moduleId: string) {
  return modules.find((module) => module.id === moduleId)?.label ?? moduleId;
}

function getRouteModuleId(route: string) {
  return route.split("?")[0]?.split("/")[3];
}

function getOptionalSearchParam(searchParams: URLSearchParams, key: string) {
  return searchParams.get(key) ?? undefined;
}

function createWorkspaceTab(input: {
  route: string;
  moduleId: string;
  closable: boolean;
}): WorkspaceTab {
  const searchParams = new URLSearchParams(input.route.split("?")[1] ?? "");

  return {
    id: `tab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: getTabTitle(input.moduleId),
    closable: input.closable,
    history: [input.route],
    historyIndex: 0,
    moduleId: input.moduleId,
    patientId: getOptionalSearchParam(searchParams, "patientId"),
    encounterId: getOptionalSearchParam(searchParams, "encounterId"),
  };
}

function normalizeTabs(tabs: WorkspaceTab[]) {
  if (tabs.length === 0) return tabs;

  return tabs.map((tab, index) => ({
    ...tab,
    closable: tabs.length > 1 && index !== 0 ? tab.closable : tabs.length > 1,
  }));
}

function persist(workspaceId: string | null, tabs: WorkspaceTab[], activeTabId: string | null) {
  if (!workspaceId || !activeTabId || typeof window === "undefined") return;

  const payload: PersistedWorkspaceTabs = { workspaceId, tabs, activeTabId };
  window.sessionStorage.setItem(getStorageKey(workspaceId), JSON.stringify(payload));
}

function readPersistedTabs(workspaceId: string): PersistedWorkspaceTabs | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(getStorageKey(workspaceId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedWorkspaceTabs;
    if (parsed.workspaceId !== workspaceId || parsed.tabs.length === 0) return null;
    if (!parsed.tabs.some((tab) => tab.id === parsed.activeTabId)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function updateActiveTab(
  state: WorkspaceTabsStore,
  updater: (tab: WorkspaceTab) => WorkspaceTab
): WorkspaceTabsStore {
  const activeTabId = state.activeTabId;
  if (!activeTabId) return state;

  const tabs = state.tabs.map((tab) => (tab.id === activeTabId ? updater(tab) : tab));
  persist(state.workspaceId, tabs, activeTabId);

  return { ...state, tabs };
}

export const useWorkspaceTabsStore = create<WorkspaceTabsStore>()((set, get) => ({
  workspaceId: null,
  tabs: [],
  activeTabId: null,
  hydrated: false,

  initialize: ({ workspaceId, route, moduleId }) => {
    const persisted = readPersistedTabs(workspaceId);

    if (persisted) {
      const tabs = persisted.tabs;
      const activeTabId = persisted.activeTabId;
      set({ workspaceId, tabs, activeTabId, hydrated: true });
      get().syncActiveRoute(route, moduleId);
      return;
    }

    const tab = createWorkspaceTab({ route, moduleId, closable: false });
    set({ workspaceId, tabs: [tab], activeTabId: tab.id, hydrated: true });
    persist(workspaceId, [tab], tab.id);
  },

  pushRoute: (route, moduleId) => {
    set((state) =>
      updateActiveTab(state, (tab) => {
        const nextHistory = tab.history.slice(0, tab.historyIndex + 1);
        nextHistory.push(route);
        const searchParams = new URLSearchParams(route.split("?")[1] ?? "");

        return {
          ...tab,
          title: getTabTitle(moduleId),
          moduleId,
          history: nextHistory,
          historyIndex: nextHistory.length - 1,
          patientId: getOptionalSearchParam(searchParams, "patientId"),
          encounterId: getOptionalSearchParam(searchParams, "encounterId"),
        };
      })
    );
  },

  activateTab: (tabId) => {
    const tab = get().tabs.find((item) => item.id === tabId);
    if (!tab) return null;
    set({ activeTabId: tabId });
    persist(get().workspaceId, get().tabs, tabId);
    return tab.history[tab.historyIndex] ?? null;
  },

  closeTab: (tabId) => {
    const state = get();
    if (state.tabs.length <= 1) return null;

    const closingIndex = state.tabs.findIndex((tab) => tab.id === tabId);
    if (closingIndex < 0) return null;

    const nextTabs = state.tabs.filter((tab) => tab.id !== tabId);
    const fallbackIndex = Math.max(0, closingIndex - 1);
    const nextActiveTab =
      state.activeTabId === tabId
        ? nextTabs[fallbackIndex] ?? nextTabs[0]
        : nextTabs.find((tab) => tab.id === state.activeTabId) ?? nextTabs[0];

    set({
      tabs: normalizeTabs(nextTabs),
      activeTabId: nextActiveTab.id,
    });
    persist(state.workspaceId, normalizeTabs(nextTabs), nextActiveTab.id);

    return nextActiveTab.history[nextActiveTab.historyIndex] ?? null;
  },

  createTab: ({ workspaceId, route, moduleId }) => {
    const tab = createWorkspaceTab({ route, moduleId, closable: true });

    set((state) => {
      const tabs = normalizeTabs([...state.tabs, tab]);
      persist(workspaceId, tabs, tab.id);
      return { workspaceId, tabs, activeTabId: tab.id, hydrated: true };
    });

    return route;
  },

  goBack: () => {
    const activeTab = get().tabs.find((tab) => tab.id === get().activeTabId);
    if (!activeTab || activeTab.historyIndex === 0) return null;
    const nextIndex = activeTab.historyIndex - 1;
    const route = activeTab.history[nextIndex];
    if (!route) return null;
    const routeModuleId = getRouteModuleId(route) ?? activeTab.moduleId;

    set((state) =>
      updateActiveTab(state, (tab) => ({
        ...tab,
        historyIndex: nextIndex,
        moduleId: routeModuleId,
        title: getTabTitle(routeModuleId),
      }))
    );

    return route;
  },

  goForward: () => {
    const activeTab = get().tabs.find((tab) => tab.id === get().activeTabId);
    if (!activeTab || activeTab.historyIndex >= activeTab.history.length - 1) return null;
    const nextIndex = activeTab.historyIndex + 1;
    const route = activeTab.history[nextIndex];
    if (!route) return null;
    const routeModuleId = getRouteModuleId(route) ?? activeTab.moduleId;

    set((state) =>
      updateActiveTab(state, (tab) => ({
        ...tab,
        historyIndex: nextIndex,
        moduleId: routeModuleId,
        title: getTabTitle(routeModuleId),
      }))
    );

    return route;
  },

  syncActiveRoute: (route, moduleId) => {
    set((state) =>
      updateActiveTab(state, (tab) => {
        if (tab.history[tab.historyIndex] === route) {
          return { ...tab, title: getTabTitle(moduleId), moduleId };
        }

        return {
          ...tab,
          title: getTabTitle(moduleId),
          moduleId,
          history: [route],
          historyIndex: 0,
        };
      })
    );
  },
}));
