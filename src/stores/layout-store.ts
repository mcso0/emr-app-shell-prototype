"use client";

import { create } from "zustand";
import type { DrawerState, ProfileDrawerState } from "@/types/emr";
import { SHELL_LAYOUT } from "@/shell/layout-contract";

export type ModuleRefreshAction = {
  isRefreshing?: boolean;
  label: string;
  onRefresh: () => void | Promise<void>;
};

type LayoutStore = {
  activeDrawer: DrawerState;
  activeProfileDrawer: ProfileDrawerState;
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
  setActiveProfileDrawer: (drawer: ProfileDrawerState) => void;
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
  activeProfileDrawer: null,
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
  setActiveProfileDrawer: (drawer) =>
    set((state) => {
      if (!drawer) return state.activeProfileDrawer ? { activeProfileDrawer: null } : state;

      let returnFocusId = drawer.returnFocusId ?? state.activeProfileDrawer?.returnFocusId;
      if (typeof document !== "undefined") {
        const opener = document.activeElement;
        if (opener instanceof HTMLElement && opener !== document.body &&
            !opener.closest('[data-testid="workspace-profile-drawer"]')) {
          if (!opener.id) opener.id = `profile-drawer-opener-${crypto.randomUUID()}`;
          returnFocusId = drawer.returnFocusId ?? opener.id;
        }
      }
      const activeProfileDrawer = { ...drawer, returnFocusId };
      if (JSON.stringify(state.activeProfileDrawer) === JSON.stringify(activeProfileDrawer)) return state;
      return { activeProfileDrawer };
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
    set((state) =>
      state.activeDrawer === null && state.activeProfileDrawer === null
        ? state
        : { activeDrawer: null, activeProfileDrawer: null },
    ),
}));
