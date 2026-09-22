"use client";

import { createInitialEmrTableFilterBuilderModel, type EmrTableFilterBuilderModel } from "@/components/emr/table-filter-builder-model";
import { create } from "zustand";
import { isIsoOperatingDate } from "@/lib/emr-domain/demo-date";
import type { HospitalSort } from "@/features/home/home-hospital-presentation";
import { hospitalStatuses } from "@/features/home/home-hospital-presentation";

export type HomeView = "hospital" | "mine";
export type HomePersonalTab = "assigned" | "requested";
export type HomeViewQuery = {
  date: string;
  search: string;
  owners: string[] | null;
  includeCompleted: boolean;
  includeCancelled: boolean;
};
export type HomeDisplayPreferences = {
  layout: "board" | "list";
  hidden: string[];
  collapsed: string[];
  hiddenStatuses: string[];
  collapsedStatuses: string[];
};
type ScrollPosition = { left: number; top: number };
type HomeSessionState = {
  view: HomeView;
  personalTab: HomePersonalTab;
  queries: Record<HomeView, HomeViewQuery>;
  scroll: Record<string, ScrollPosition>;
  hospitalWorkType: string;
  hospitalSort: HospitalSort;
};
type HomeWorkspaceStore = HomeSessionState & {
  scopeKey: string | null;
  filters: Record<HomeView, EmrTableFilterBuilderModel>;
  updateFilter: (view: HomeView, model: EmrTableFilterBuilderModel) => void;
  preferences: HomeDisplayPreferences;
  activate: (scopeKey: string, today: string) => void;
  setView: (view: HomeView) => void;
  setPersonalTab: (tab: HomePersonalTab) => void;
  setHospitalWorkType: (type: string) => void;
  setHospitalSort: (sort: HospitalSort) => void;
  updateQuery: (view: HomeView, patch: Partial<HomeViewQuery>) => void;
  updatePreferences: (patch: Partial<HomeDisplayPreferences>) => void;
  rememberScroll: (key: string, position: ScrollPosition) => void;
  endSession: () => void;
};

// Match the shared customer filter builder: runtime-only rules, isolated by view and scope.
const initialFilters = () => ({ hospital: createInitialEmrTableFilterBuilderModel("home-hospital"), mine: createInitialEmrTableFilterBuilderModel("home-mine") });

const prefix = "clair.home.v2:";
const allowedWorkTypes = new Set(["all", "waiting", "reservation", "chart", "lab", "imaging", "dispensing", "treatment", "billing"]);
const allowedStatuses = new Set<string>(hospitalStatuses.map((status) => status.id));
const defaultPreferences: HomeDisplayPreferences = { layout: "board", hidden: [], collapsed: [], hiddenStatuses: [], collapsedStatuses: [] };
const query = (date: string): HomeViewQuery => ({ date, search: "", owners: null, includeCompleted: false, includeCancelled: false });
function initialSession(today: string): HomeSessionState {
  return { view: "hospital", personalTab: "assigned", queries: { hospital: query(today), mine: query(today) }, scroll: {}, hospitalWorkType: "all", hospitalSort: "priority" };
}
function read(storage: Storage, key: string): Record<string, unknown> {
  try { return JSON.parse(storage.getItem(key) ?? "null") ?? {}; } catch { return {}; }
}
function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}
function restoreQuery(value: unknown, today: string): HomeViewQuery {
  const saved = value && typeof value === "object" ? value as Partial<HomeViewQuery> : {};
  return {
    date: typeof saved.date === "string" && isIsoOperatingDate(saved.date) ? saved.date : today,
    search: typeof saved.search === "string" ? saved.search : "",
    owners: Array.isArray(saved.owners) ? strings(saved.owners) : null,
    includeCompleted: saved.includeCompleted === true,
    includeCancelled: saved.includeCancelled === true,
  };
}
function persist(state: HomeWorkspaceStore) {
  if (!state.scopeKey || typeof window === "undefined") return;
  try {
    localStorage.setItem(prefix + state.scopeKey, JSON.stringify(state.preferences));
    sessionStorage.setItem(prefix + state.scopeKey, JSON.stringify({
      view: state.view, personalTab: state.personalTab, queries: state.queries, scroll: state.scroll,
      hospitalWorkType: state.hospitalWorkType, hospitalSort: state.hospitalSort,
    }));
  } catch { /* UI remains usable when browser storage is unavailable. */ }
}

export const useHomeWorkspaceStore = create<HomeWorkspaceStore>()((set, get) => ({
  ...initialSession(""), filters: initialFilters(), updateFilter: (view, model) => set((state) => ({ filters: { ...state.filters, [view]: model } })), scopeKey: null, preferences: defaultPreferences,
  activate: (scopeKey, today) => {
    if (get().scopeKey === scopeKey) return;
    let preferences = defaultPreferences;
    let session = initialSession(today);
    if (typeof window !== "undefined") {
      try {
        const display = read(localStorage, prefix + scopeKey);
        preferences = { layout: display.layout === "list" ? "list" : "board", hidden: strings(display.hidden), collapsed: strings(display.collapsed), hiddenStatuses: strings(display.hiddenStatuses).filter((status) => allowedStatuses.has(status)), collapsedStatuses: strings(display.collapsedStatuses).filter((status) => allowedStatuses.has(status)) };
        const saved = read(sessionStorage, prefix + scopeKey);
        const queries = saved.queries as Partial<Record<HomeView, HomeViewQuery>> | undefined;
        session = {
          view: saved.view === "mine" ? "mine" : "hospital",
          personalTab: saved.personalTab === "requested" ? "requested" : "assigned",
          hospitalWorkType: typeof saved.hospitalWorkType === "string" && allowedWorkTypes.has(saved.hospitalWorkType) ? saved.hospitalWorkType : "all",
          hospitalSort: saved.hospitalSort === "oldest" || saved.hospitalSort === "newest" ? saved.hospitalSort : "priority",
          queries: { hospital: restoreQuery(queries?.hospital, today), mine: restoreQuery(queries?.mine, today) },
          scroll: {},
        };
        if (saved.scroll && typeof saved.scroll === "object") {
          for (const [key, value] of Object.entries(saved.scroll)) {
            if (value && typeof value === "object" && Number.isFinite(value.left) && Number.isFinite(value.top)) {
              session.scroll[key] = { left: Math.max(0, value.left), top: Math.max(0, value.top) };
            }
          }
        }
      } catch { /* Keep defaults if storage is blocked. */ }
    }
    set({ ...session, filters: initialFilters(), scopeKey, preferences });
  },
  setView: (view) => { set({ view }); persist(get()); },
  setPersonalTab: (personalTab) => { set({ personalTab }); persist(get()); },
  setHospitalWorkType: (hospitalWorkType) => { set({ hospitalWorkType }); persist(get()); },
  setHospitalSort: (hospitalSort) => { set({ hospitalSort }); persist(get()); },
  updateQuery: (view, patch) => {
    set((state) => ({ queries: { ...state.queries, [view]: { ...state.queries[view], ...patch } } }));
    persist(get());
  },
  updatePreferences: (patch) => {
    set((state) => ({ preferences: { ...state.preferences, ...patch } })); persist(get());
  },
  rememberScroll: (key, position) => {
    set((state) => ({ scroll: { ...state.scroll, [key]: position } })); persist(get());
  },
  endSession: () => {
    if (typeof window !== "undefined") {
      try { Object.keys(sessionStorage).filter((key) => key.startsWith(prefix)).forEach((key) => sessionStorage.removeItem(key)); } catch { /* No stored query to clear. */ }
    }
    set({ ...initialSession(""), filters: initialFilters(), scopeKey: null });
  },
}));

if (typeof window !== "undefined") {
  window.addEventListener("clair:session-ended", () => useHomeWorkspaceStore.getState().endSession());
}
