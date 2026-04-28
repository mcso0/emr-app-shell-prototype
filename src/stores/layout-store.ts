"use client";

import { create } from "zustand";
import type { DrawerState } from "@/types/emr";
import { SHELL_LAYOUT } from "@/shell/layout-contract";

type LayoutStore = {
  activeDrawer: DrawerState;
  contentAsideOpen: boolean;
  modulePanelOpen: boolean;
  rightPanelOpen: boolean;
  moduleSidePanelWidth: number;
  contentAsideWidth: number;
  rightPanelWidth: number;
  setActiveDrawer: (drawer: DrawerState) => void;
  setContentAsideOpen: (open: boolean) => void;
  setModulePanelOpen: (open: boolean) => void;
  setRightPanelOpen: (open: boolean) => void;
  enterModule: () => void;
};

export const useLayoutStore = create<LayoutStore>()((set) => ({
  activeDrawer: null,
  contentAsideOpen: false,
  modulePanelOpen: true,
  rightPanelOpen: true,
  moduleSidePanelWidth: SHELL_LAYOUT.moduleSidePanel.defaultWidth,
  contentAsideWidth: SHELL_LAYOUT.contentAside.defaultWidth,
  rightPanelWidth: SHELL_LAYOUT.rightPanel.defaultWidth,
  setActiveDrawer: (activeDrawer) => set({ activeDrawer }),
  setContentAsideOpen: (contentAsideOpen) => set({ contentAsideOpen }),
  setModulePanelOpen: (modulePanelOpen) => set({ modulePanelOpen }),
  setRightPanelOpen: (rightPanelOpen) => set({ rightPanelOpen }),
  enterModule: () => set({ activeDrawer: null }),
}));
