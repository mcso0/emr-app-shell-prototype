"use client";

import { create } from "zustand";
import type { DrawerState } from "@/types/emr";
import { SHELL_LAYOUT } from "@/shell/layout-contract";

type LayoutStore = {
  activeDrawer: DrawerState;
  contentAsideOpen: boolean;
  modulePanelOpen: boolean;
  rightPanelOpen: boolean;
  notificationNavigationDirty: boolean;
  selectedQueueItemIds: Record<string, string>;
  moduleSidePanelWidth: number;
  contentAsideWidth: number;
  rightPanelWidth: number;
  setActiveDrawer: (drawer: DrawerState) => void;
  setContentAsideOpen: (open: boolean) => void;
  setModulePanelOpen: (open: boolean) => void;
  setNotificationNavigationDirty: (dirty: boolean) => void;
  setRightPanelOpen: (open: boolean) => void;
  setSelectedQueueItem: (moduleId: string, itemId: string) => void;
  enterModule: () => void;
};

export const useLayoutStore = create<LayoutStore>()((set) => ({
  activeDrawer: null,
  contentAsideOpen: false,
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
        state.activeDrawer?.subtitle === activeDrawer?.subtitle
      ) {
        return state;
      }

      return { activeDrawer };
    }),
  setContentAsideOpen: (contentAsideOpen) =>
    set((state) =>
      state.contentAsideOpen === contentAsideOpen ? state : { contentAsideOpen }
    ),
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
