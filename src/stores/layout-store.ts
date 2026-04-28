"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
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

export const useLayoutStore = create<LayoutStore>()(
  persist(
    (set) => ({
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
    }),
    {
      name: "clair-emr-shell-layout",
      partialize: (state) => ({
        contentAsideOpen: state.contentAsideOpen,
        modulePanelOpen: state.modulePanelOpen,
        rightPanelOpen: state.rightPanelOpen,
        moduleSidePanelWidth: state.moduleSidePanelWidth,
        contentAsideWidth: state.contentAsideWidth,
        rightPanelWidth: state.rightPanelWidth,
      }),
    }
  )
);
