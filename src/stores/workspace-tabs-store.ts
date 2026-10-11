"use client";

import { create } from "zustand";
import { modules, normalizeModuleId } from "@/modules/registry";

export type WorkspaceTabSurfaceType =
  | "module"
  | "encounter"
  | "labResult"
  | "imagingStudy"
  | "invoice"
  | "queueItem"
  | "patient";

export type WorkspaceTab = {
  id: string;
  title: string;
  closable: boolean;
  history: string[];
  historyIndex: number;
  moduleId: string;
  surfaceType: WorkspaceTabSurfaceType;
  surfaceId: string;
  dedupeKey: string;
  lastRoute: string;
  updatedAt: string;
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
  initialize: (input: { workspaceId: string; route: string; moduleId: string }) => Promise<void>;
  pushRoute: (route: string, moduleId: string) => void;
  activateTab: (tabId: string) => string | null;
  closeTab: (tabId: string) => string | null;
  createTab: (input: { workspaceId: string; route: string; moduleId: string }) => string;
  goBack: () => string | null;
  goForward: () => string | null;
  syncActiveRoute: (route: string, moduleId: string) => void;
};

const STORAGE_PREFIX = "clair-workspace-tabs:v1";
const SERVER_SAVE_DEBOUNCE_MS = 500;
type WorkspaceTabSave = {
  payload: PersistedWorkspaceTabs;
  timer: number | null;
  inFlight: boolean;
  pending: boolean;
};
const serverSaves = new Map<string, WorkspaceTabSave>();
let tabsMutationVersion = 0;

function getStorageKey(workspaceId: string) {
  return `${STORAGE_PREFIX}:${workspaceId}`;
}

function getTabTitle(moduleId: string) {
  const normalizedModuleId = normalizeModuleId(moduleId);

  return modules.find((module) => module.id === normalizedModuleId)?.label ?? moduleId;
}

function getRouteModuleId(route: string) {
  const routeModuleId = route.split("?")[0]?.split("/")[3];

  return routeModuleId ? normalizeModuleId(routeModuleId) : routeModuleId;
}

function isWorkspaceRoute(route: string, workspaceId: string) {
  return route.split("?")[0]?.startsWith(`/w/${workspaceId}/`) ?? false;
}

function getOptionalSearchParam(searchParams: URLSearchParams, key: string) {
  return searchParams.get(key) ?? undefined;
}

export function getWorkspaceTabIdentityFromRoute(workspaceId: string, route: string, fallbackModuleId: string) {
  const moduleId = getRouteModuleId(route) ?? fallbackModuleId;
  const searchParams = new URLSearchParams(route.split("?")[1] ?? "");
  const labResultId = getOptionalSearchParam(searchParams, "labResultId");
  const imagingStudyId = getOptionalSearchParam(searchParams, "imagingStudyId");
  const invoiceId = getOptionalSearchParam(searchParams, "invoiceId");
  const encounterId = getOptionalSearchParam(searchParams, "encounterId");
  const patientId = getOptionalSearchParam(searchParams, "patientId");
  const queueItemId = getOptionalSearchParam(searchParams, "queueItemId");
  let surface: { surfaceType: WorkspaceTabSurfaceType; surfaceId: string } = {
    surfaceType: "module",
    surfaceId: moduleId,
  };

  if ((moduleId === "treatment" || moduleId === "dispensing") && encounterId) {
    surface = { surfaceType: "encounter", surfaceId: encounterId };
  } else if (moduleId === "lab" && labResultId) {
    surface = { surfaceType: "labResult", surfaceId: labResultId };
  } else if (moduleId === "imaging" && imagingStudyId) {
    surface = { surfaceType: "imagingStudy", surfaceId: imagingStudyId };
  } else if (moduleId === "billing" && invoiceId) {
    surface = { surfaceType: "invoice", surfaceId: invoiceId };
  } else if (moduleId === "reception" && queueItemId) {
    surface = { surfaceType: "queueItem", surfaceId: queueItemId };
  } else if (moduleId === "customer" && patientId) {
    surface = { surfaceType: "patient", surfaceId: patientId };
  }

  return {
    ...surface,
    dedupeKey: `${workspaceId}:${surface.surfaceType}:${surface.surfaceId}`,
  };
}

function getRouteMetadata(route: string, fallbackModuleId: string, workspaceId: string) {
  const moduleId = getRouteModuleId(route) ?? fallbackModuleId;
  const searchParams = new URLSearchParams(route.split("?")[1] ?? "");
  const identity = getWorkspaceTabIdentityFromRoute(workspaceId, route, moduleId);

  return {
    title: getTabTitle(moduleId),
    moduleId,
    ...identity,
    lastRoute: route,
    updatedAt: new Date().toISOString(),
    patientId: getOptionalSearchParam(searchParams, "patientId"),
    encounterId: getOptionalSearchParam(searchParams, "encounterId"),
  };
}

function createWorkspaceTab(input: {
  route: string;
  moduleId: string;
  closable: boolean;
  workspaceId: string;
}): WorkspaceTab {
  const metadata = getRouteMetadata(input.route, input.moduleId, input.workspaceId);

  return {
    id: `tab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: metadata.title,
    closable: input.closable,
    history: [input.route],
    historyIndex: 0,
    moduleId: metadata.moduleId,
    surfaceType: metadata.surfaceType,
    surfaceId: metadata.surfaceId,
    dedupeKey: metadata.dedupeKey,
    lastRoute: metadata.lastRoute,
    updatedAt: metadata.updatedAt,
    patientId: metadata.patientId,
    encounterId: metadata.encounterId,
  };
}

function normalizeTabs(tabs: WorkspaceTab[]) {
  if (tabs.length === 0) return tabs;

  return tabs.map((tab, index) => ({
    ...tab,
    closable: tabs.length > 1 && index !== 0 ? tab.closable : tabs.length > 1,
  }));
}

function persist(workspaceId: string | null, tabs: WorkspaceTab[], activeTabId: string | null, saveToServer = true) {
  if (!workspaceId || !activeTabId || typeof window === "undefined") return;

  tabsMutationVersion += 1;
  const payload: PersistedWorkspaceTabs = { workspaceId, tabs, activeTabId };
  try {
    window.sessionStorage.setItem(getStorageKey(workspaceId), JSON.stringify(payload));
  } catch {
    // Persistence is a best-effort shell enhancement; storage failures should not break navigation.
  }

  if (saveToServer) scheduleServerPersist(workspaceId, tabs, activeTabId);
}

function scheduleServerPersist(workspaceId: string, tabs: WorkspaceTab[], activeTabId: string) {
  if (typeof window === "undefined") return;
  const save = serverSaves.get(workspaceId) ?? { payload: { workspaceId, tabs, activeTabId }, timer: null, inFlight: false, pending: false };
  save.payload = { workspaceId, tabs, activeTabId };
  save.pending = true;
  if (save.timer !== null) window.clearTimeout(save.timer);
  save.timer = window.setTimeout(() => {
    save.timer = null;
    void flushServerTabs(workspaceId, save);
  }, SERVER_SAVE_DEBOUNCE_MS);
  serverSaves.set(workspaceId, save);
}

async function flushServerTabs(workspaceId: string, save: WorkspaceTabSave) {
  if (save.inFlight || !save.pending) return;
  save.inFlight = true;
  save.pending = false;
  const { tabs, activeTabId } = save.payload;
  await saveServerTabs(workspaceId, tabs, activeTabId);
  save.inFlight = false;
  if (save.timer !== null) return;
  if (save.pending) void flushServerTabs(workspaceId, save);
  else serverSaves.delete(workspaceId);
}

async function readServerTabs(workspaceId: string): Promise<PersistedWorkspaceTabs | null> {
  if (typeof window === "undefined") return null;

  try {
    const response = await fetch(`/api/workspaces/${encodeURIComponent(workspaceId)}/app-shell/workspace-tabs`, {
      cache: "no-store",
    });
    if (!response.ok) return null;
    const body = await response.json() as {
      ok?: boolean;
      payload?: { tabs?: unknown; activeTabId?: unknown } | null;
    };
    if (!body.ok || !body.payload) return null;
    return sanitizePersistedTabs(
      { workspaceId, tabs: body.payload.tabs, activeTabId: body.payload.activeTabId },
      workspaceId,
    );
  } catch {
    return null;
  }
}

async function saveServerTabs(workspaceId: string, tabs: WorkspaceTab[], activeTabId: string) {
  try {
    const response = await fetch(`/api/workspaces/${encodeURIComponent(workspaceId)}/app-shell/workspace-tabs`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tabs, activeTabId }),
    });
    if (!response.ok) throw new Error("workspace_tabs_save_failed");
  } catch {
    // Server restore is best-effort; sessionStorage remains the immediate fallback.
    console.warn("Workspace tabs could not be saved. The browser session copy is retained.");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizePersistedTab(value: unknown, workspaceId: string): WorkspaceTab | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== "string" || typeof value.closable !== "boolean") return null;
  if (!Array.isArray(value.history) || value.history.length === 0) return null;
  if (!value.history.every((item) => typeof item === "string")) return null;
  const history = value.history;
  if (!history.every((route) => isWorkspaceRoute(route, workspaceId))) return null;
  const historyIndex = value.historyIndex;
  if (typeof historyIndex !== "number" || !Number.isInteger(historyIndex)) return null;
  if (historyIndex < 0 || historyIndex >= history.length) return null;

  const fallbackModuleId = typeof value.moduleId === "string" ? value.moduleId : "home";
  const route = history[historyIndex];
  if (!isWorkspaceRoute(route, workspaceId)) return null;
  const metadata = getRouteMetadata(route, fallbackModuleId, workspaceId);

  return {
    id: value.id,
    title: metadata.title,
    closable: value.closable,
    history,
    historyIndex,
    moduleId: metadata.moduleId,
    surfaceType: metadata.surfaceType,
    surfaceId: metadata.surfaceId,
    dedupeKey: metadata.dedupeKey,
    lastRoute: metadata.lastRoute,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : metadata.updatedAt,
    patientId: metadata.patientId,
    encounterId: metadata.encounterId,
  };
}

function sanitizePersistedTabs(value: unknown, workspaceId: string): PersistedWorkspaceTabs | null {
  if (!isRecord(value)) return null;
  if (value.workspaceId !== workspaceId || typeof value.activeTabId !== "string") return null;
  if (!Array.isArray(value.tabs)) return null;

  const tabs = value.tabs.map((tab) => sanitizePersistedTab(tab, workspaceId));
  if (tabs.some((tab) => tab === null)) return null;

  const sanitizedTabs = normalizeTabs(tabs.filter((tab): tab is WorkspaceTab => tab !== null));
  if (sanitizedTabs.length === 0) return null;
  if (!sanitizedTabs.some((tab) => tab.id === value.activeTabId)) return null;

  return { workspaceId, tabs: sanitizedTabs, activeTabId: value.activeTabId };
}

function readPersistedTabs(workspaceId: string): PersistedWorkspaceTabs | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(getStorageKey(workspaceId));
    if (!raw) return null;
    return sanitizePersistedTabs(JSON.parse(raw), workspaceId);
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
  const activeTab = state.tabs.find((tab) => tab.id === activeTabId);
  if (!activeTab) return state;
  const updatedTab = updater(activeTab);
  if (updatedTab === activeTab) return state;
  const tabs = state.tabs.map((tab) => (tab.id === activeTabId ? updatedTab : tab));
  persist(state.workspaceId, tabs, activeTabId);

  return { ...state, tabs };
}

export const useWorkspaceTabsStore = create<WorkspaceTabsStore>()((set, get) => ({
  workspaceId: null,
  tabs: [],
  activeTabId: null,
  hydrated: false,

  initialize: async ({ workspaceId, route, moduleId }) => {
    const persisted = readPersistedTabs(workspaceId);

    if (persisted) {
      set({
        workspaceId,
        tabs: persisted.tabs,
        activeTabId: persisted.activeTabId,
        hydrated: true,
      });
      get().syncActiveRoute(route, moduleId);
      // The current browser session may contain a save that failed or is still pending.
      return;
    } else {
      const tab = createWorkspaceTab({ route, moduleId, closable: false, workspaceId });
      set({ workspaceId, tabs: [tab], activeTabId: tab.id, hydrated: true });
      // Do not overwrite an existing server session while its restore is pending.
      persist(workspaceId, [tab], tab.id, false);
    }

    const restoreVersion = tabsMutationVersion;
    const serverPersisted = await readServerTabs(workspaceId);
    if (get().workspaceId !== workspaceId || tabsMutationVersion !== restoreVersion) return;

    if (serverPersisted) set({
      workspaceId,
      tabs: serverPersisted.tabs,
      activeTabId: serverPersisted.activeTabId,
      hydrated: true,
    });
    get().syncActiveRoute(route, moduleId);
    persist(workspaceId, get().tabs, get().activeTabId);
  },

  pushRoute: (route, moduleId) => {
    set((state) =>
      updateActiveTab(state, (tab) => {
        if (tab.history[tab.historyIndex] === route) {
          return tab;
        }

        const nextHistory = tab.history.slice(0, tab.historyIndex + 1);
        nextHistory.push(route);
        if (!state.workspaceId) return tab;
        const metadata = getRouteMetadata(route, moduleId, state.workspaceId);

        return {
          ...tab,
          ...metadata,
          title: metadata.title,
          moduleId: metadata.moduleId,
          history: nextHistory,
          historyIndex: nextHistory.length - 1,
        };
      })
    );
  },

  activateTab: (tabId) => {
    if (get().activeTabId === tabId) return null;
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
    const tab = createWorkspaceTab({ route, moduleId, closable: true, workspaceId });

    set((state) => {
      const tabs =
        state.workspaceId && state.workspaceId !== workspaceId
          ? normalizeTabs([tab])
          : normalizeTabs([...state.tabs, tab]);
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
    const workspaceId = get().workspaceId;
    if (!workspaceId) return null;
    const metadata = getRouteMetadata(route, activeTab.moduleId, workspaceId);

    set((state) =>
      updateActiveTab(state, (tab) => ({
        ...tab,
        ...metadata,
        historyIndex: nextIndex,
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
    const workspaceId = get().workspaceId;
    if (!workspaceId) return null;
    const metadata = getRouteMetadata(route, activeTab.moduleId, workspaceId);

    set((state) =>
      updateActiveTab(state, (tab) => ({
        ...tab,
        ...metadata,
        historyIndex: nextIndex,
      }))
    );

    return route;
  },

  syncActiveRoute: (route, moduleId) => {
    set((state) =>
      updateActiveTab(state, (tab) => {
        if (!state.workspaceId) return tab;
        if (tab.history[tab.historyIndex] === route && tab.moduleId === moduleId) return tab;
        const metadata = getRouteMetadata(route, moduleId, state.workspaceId);
        const nextHistory = [...tab.history];

        if (tab.history[tab.historyIndex] === route) {
          return { ...tab, ...metadata };
        }

        nextHistory[tab.historyIndex] = route;

        return {
          ...tab,
          ...metadata,
          history: nextHistory,
        };
      })
    );
  },
}));
