"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { DrawerState, ModuleDefinition } from "@/types/emr";

type LayoutStore = {
  activeDrawer: DrawerState;
  contextPanelOpen: boolean;
  modulePanelOpen: boolean;
  rightPanelOpen: boolean;
  rightPanelWidth: number;
  setActiveDrawer: (drawer: DrawerState) => void;
  setContextPanelOpen: (open: boolean) => void;
  setModulePanelOpen: (open: boolean) => void;
  setRightPanelOpen: (open: boolean) => void;
  applyDefaults: (definition: ModuleDefinition) => void;
};

export const useLayoutStore = create<LayoutStore>()(
  persist(
    (set) => ({
      activeDrawer: null,
      contextPanelOpen: false,
      modulePanelOpen: true,
      rightPanelOpen: true,
      rightPanelWidth: 300,
      setActiveDrawer: (activeDrawer) => set({ activeDrawer }),
      setContextPanelOpen: (contextPanelOpen) => set({ contextPanelOpen }),
      setModulePanelOpen: (modulePanelOpen) => set({ modulePanelOpen }),
      setRightPanelOpen: (rightPanelOpen) => set({ rightPanelOpen }),
      applyDefaults: (definition) =>
        set({
          activeDrawer: null,
          contextPanelOpen: Boolean(definition.defaultLayout.contextPanelOpen),
          modulePanelOpen: definition.defaultLayout.modulePanelOpen,
          rightPanelOpen: Boolean(definition.defaultLayout.rightPanelOpen),
          rightPanelWidth: definition.defaultLayout.rightPanelWidth ?? 300,
        }),
    }),
    {
      name: "clair-emr-shell-layout",
      partialize: (state) => ({
        contextPanelOpen: state.contextPanelOpen,
        modulePanelOpen: state.modulePanelOpen,
        rightPanelOpen: state.rightPanelOpen,
        rightPanelWidth: state.rightPanelWidth,
      }),
    }
  )
);
