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

export const useLayoutStore = create<LayoutStore>()((set) => ({
  documentWidthModes: {},
  lastContentPanelOpened: "right",
  setDocumentWidthMode: (key, mode) => set((state) => ({
    documentWidthModes: { ...state.documentWidthModes, [key]: mode },
  })),
  activeDrawer: null,
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

      return { activeDrawer };
    }),
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
    set((state) => (state.activeDrawer === null ? state : { activeDrawer: null })),
}));
