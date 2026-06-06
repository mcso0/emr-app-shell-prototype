"use client";

import { create } from "zustand";

type HomeWorkspaceStore = {
  detailOpen: boolean;
  selectedTaskId: string | null;
  clearSelection: () => void;
  closeTaskDetail: () => void;
  selectTask: (taskId: string) => void;
};

export const useHomeWorkspaceStore = create<HomeWorkspaceStore>()((set) => ({
  detailOpen: false,
  selectedTaskId: null,
  clearSelection: () => set({ detailOpen: false, selectedTaskId: null }),
  closeTaskDetail: () => set({ detailOpen: false, selectedTaskId: null }),
  selectTask: (selectedTaskId) => set({ detailOpen: true, selectedTaskId }),
}));
