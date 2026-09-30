"use client";

import { create } from "zustand";
import type { DrawerState } from "@/types/emr";
import { SHELL_LAYOUT } from "@/shell/layout-contract";

export type ModuleRefreshAction = {
  isRefreshing?: boolean;
  label: string;
  onRefresh: () => void | Promise<void>;
};

type LayoutStore = {
  documentWidthModes: Record<string, "narrow" | "wide">;
  lastContentPanelOpened: "left" | "right";
  setDocumentWidthMode: (key: string, mode: "narrow" | "wide") => void;
  activeDrawer: DrawerState;
  retainedReceptionDrawer: DrawerState;
  receptionCalendarScope: string | null;
  contentAsideOpen: boolean;
  moduleRefreshActions: Record<string, ModuleRefreshAction | undefined>;
  modulePanelOpen: boolean;
  rightPanelOpen: boolean;
  notificationNavigationDirty: boolean;
  selectedQueueItemIds: Record<string, string>;
  moduleSidePanelWidth: number;
  contentAsideWidth: number;
  rightPanelWidth: number;
  setActiveDrawer: (drawer: DrawerState) => void;
  setReceptionCalendarScope: (scope: string | null) => void;
  setReceptionCalendarDrawer: (drawer: DrawerState) => void;
  setReceptionCalendarOpen: (open: boolean) => void;
  setContentAsideOpen: (open: boolean) => void;
  setModuleRefreshAction: (
    moduleId: string,
    action: ModuleRefreshAction,
  ) => void;
  clearModuleRefreshAction: (moduleId: string) => void;
  setModulePanelOpen: (open: boolean) => void;
  setNotificationNavigationDirty: (dirty: boolean) => void;
  setRightPanelOpen: (open: boolean) => void;
  setSelectedQueueItem: (moduleId: string, itemId: string) => void;
  enterModule: () => void;
};

const isReceptionCalendarDrawer = (drawer: DrawerState) => Boolean(drawer && [
  "reception-appointment", "reception-appointment-check-in-form", "reception-encounter",
  "reception-form", "reception-reservation-form",
].includes(drawer.type));
const isProfileDrawer = (drawer: DrawerState) => Boolean(drawer && [
  "patient", "guardian", "reception-patient", "reception-guardian", "staff-operational-profile",
].includes(drawer.type));

export const useLayoutStore = create<LayoutStore>()((set, get) => ({
  documentWidthModes: {},
  lastContentPanelOpened: "right",
  setDocumentWidthMode: (key, mode) => set((state) => ({
    documentWidthModes: { ...state.documentWidthModes, [key]: mode },
  })),
  activeDrawer: null,
  retainedReceptionDrawer: null,
  receptionCalendarScope: null,
  contentAsideOpen: false,
  moduleRefreshActions: {},
  modulePanelOpen: true,
  notificationNavigationDirty: false,
  rightPanelOpen: true,
  selectedQueueItemIds: {},
  moduleSidePanelWidth: SHELL_LAYOUT.moduleSidePanel.defaultWidth,
  contentAsideWidth: SHELL_LAYOUT.contentAside.defaultWidth,
  rightPanelWidth: SHELL_LAYOUT.rightPanel.defaultWidth,
  setActiveDrawer: (activeDrawer) =>
    set((state) => {
      if (state.receptionCalendarScope && isProfileDrawer(activeDrawer) && isReceptionCalendarDrawer(state.activeDrawer)) {
        return { activeDrawer, retainedReceptionDrawer: state.activeDrawer };
      }
      if (state.retainedReceptionDrawer && isProfileDrawer(state.activeDrawer)) {
        if (activeDrawer === null) {
          return { activeDrawer: state.retainedReceptionDrawer, retainedReceptionDrawer: null };
        }
        if (isReceptionCalendarDrawer(activeDrawer)) {
          return { retainedReceptionDrawer: activeDrawer };
        }
      }
      if (
        state.activeDrawer?.type === activeDrawer?.type &&
        state.activeDrawer?.id === activeDrawer?.id &&
        state.activeDrawer?.hasUnsavedChanges ===
          activeDrawer?.hasUnsavedChanges &&
        state.activeDrawer?.initialOperatingDate ===
          activeDrawer?.initialOperatingDate &&
        state.activeDrawer?.initialPatientId === activeDrawer?.initialPatientId &&
        state.activeDrawer?.profileTab === activeDrawer?.profileTab &&
        JSON.stringify(state.activeDrawer?.returnTo) ===
          JSON.stringify(activeDrawer?.returnTo) &&
        state.activeDrawer?.subtitle === activeDrawer?.subtitle &&
        JSON.stringify(state.activeDrawer?.rightPanelPresentation) ===
          JSON.stringify(activeDrawer?.rightPanelPresentation)
      ) {
        return state;
      }

      return { activeDrawer, ...(isProfileDrawer(activeDrawer) ? {} : { retainedReceptionDrawer: null }) };
    }),
  setReceptionCalendarScope: (receptionCalendarScope) =>
    set((state) => state.receptionCalendarScope === receptionCalendarScope ? state : {
      receptionCalendarScope, retainedReceptionDrawer: null,
    }),
  setReceptionCalendarDrawer: (drawer) => {
    // Explicit form return targets replace the form; opening a profile from
    // outside the calendar uses setActiveDrawer and retains the form instead.
    if (drawer && !isReceptionCalendarDrawer(drawer)) {
      set({ activeDrawer: drawer, retainedReceptionDrawer: null });
      return;
    }
    const state = get();
    if (state.receptionCalendarScope && isProfileDrawer(state.activeDrawer)) {
      set({ retainedReceptionDrawer: drawer });
      return;
    }
    get().setActiveDrawer(drawer);
  },
  setReceptionCalendarOpen: (open) => {
    const state = get();
    if (state.receptionCalendarScope && isProfileDrawer(state.activeDrawer)) {
      if (!open) set({ retainedReceptionDrawer: null });
      return;
    }
    get().setRightPanelOpen(open);
  },
  setContentAsideOpen: (contentAsideOpen) =>
    set((state) =>
      state.contentAsideOpen === contentAsideOpen ? state : {
        contentAsideOpen,
        ...(contentAsideOpen ? { lastContentPanelOpened: "left" as const } : {}),
      }
    ),
  setModuleRefreshAction: (moduleId, action) =>
    set((state) => ({
      moduleRefreshActions: {
        ...state.moduleRefreshActions,
        [moduleId]: action,
      },
    })),
  clearModuleRefreshAction: (moduleId) =>
    set((state) => {
      if (!state.moduleRefreshActions[moduleId]) return state;

      const moduleRefreshActions = { ...state.moduleRefreshActions };
      delete moduleRefreshActions[moduleId];

      return { moduleRefreshActions };
    }),
  setModulePanelOpen: (modulePanelOpen) =>
    set((state) =>
      state.modulePanelOpen === modulePanelOpen ? state : { modulePanelOpen }
    ),
  setNotificationNavigationDirty: (notificationNavigationDirty) =>
    set((state) =>
      state.notificationNavigationDirty === notificationNavigationDirty
        ? state
        : { notificationNavigationDirty }
    ),
  setRightPanelOpen: (rightPanelOpen) =>
    set((state) =>
      state.rightPanelOpen === rightPanelOpen ? state : {
        rightPanelOpen,
        ...(rightPanelOpen ? { lastContentPanelOpened: "right" as const } : {}),
      }
    ),
  setSelectedQueueItem: (moduleId, itemId) =>
    set((state) =>
      state.selectedQueueItemIds[moduleId] === itemId
        ? state
        : {
            selectedQueueItemIds: {
              ...state.selectedQueueItemIds,
              [moduleId]: itemId,
            },
          }
    ),
  enterModule: () =>
    set((state) => (state.activeDrawer === null && state.retainedReceptionDrawer === null ? state : {
      activeDrawer: null, retainedReceptionDrawer: null,
    })),
}));
