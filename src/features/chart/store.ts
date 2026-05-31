"use client";

import { create } from "zustand";
import type { ChartLiveQueueRecord } from "@/features/chart/chart-live-queue";
import type { EmrId } from "@/types/emr-domain";

type ChartStore = {
  liveQueueError?: string;
  liveQueueRecords: ChartLiveQueueRecord[];
  liveQueueStatus: "idle" | "loading" | "ready" | "error";
  selectedEncounterId: EmrId;
  selectEncounter: (encounterId: EmrId) => void;
  setLiveQueueState: (state: {
    error?: string;
    records?: ChartLiveQueueRecord[];
    status: ChartStore["liveQueueStatus"];
  }) => void;
};

export const useChartStore = create<ChartStore>()((set) => ({
  liveQueueError: undefined,
  liveQueueRecords: [],
  liveQueueStatus: "idle",
  selectedEncounterId: "encounter-coco-260501",
  selectEncounter: (selectedEncounterId) => set({ selectedEncounterId }),
  setLiveQueueState: ({ error, records, status }) =>
    set((current) => ({
      liveQueueError: error,
      liveQueueRecords: records ?? current.liveQueueRecords,
      liveQueueStatus: status,
    })),
}));
