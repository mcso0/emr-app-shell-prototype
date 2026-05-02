"use client";

import { create } from "zustand";
import type { EmrId } from "@/types/emr-domain";

type ChartStore = {
  selectedEncounterId: EmrId;
  selectEncounter: (encounterId: EmrId) => void;
};

export const useChartStore = create<ChartStore>()((set) => ({
  selectedEncounterId: "encounter-coco-260501",
  selectEncounter: (selectedEncounterId) => set({ selectedEncounterId }),
}));
