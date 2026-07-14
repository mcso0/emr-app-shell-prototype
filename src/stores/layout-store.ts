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
      state.contentAsideOpen === contentAsideOpen ? state : { contentAsideOpen }
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
      state.rightPanelOpen === rightPanelOpen ? state : { rightPanelOpen }
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
