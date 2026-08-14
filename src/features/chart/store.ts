"use client";

import { create } from "zustand";
import type { ChartLiveQueueRecord } from "@/features/chart/chart-live-queue";
import type { EmrId } from "@/types/emr-domain";

type ChartStore = {
  liveQueueError?: string;
  liveQueueRecords: ChartLiveQueueRecord[];
  liveQueueScope?: {
    date: string;
    ignoreExplicitEncounter?: boolean;
    workspaceId: EmrId;
  };
  liveQueueStatus: "idle" | "loading" | "ready" | "error";
  pendingConsultationCallEncounterId: EmrId;
  selectedEncounterId: EmrId;
  selectedOperatingDateByWorkspace: Record<EmrId, string>;
  clearPendingConsultationCall: () => void;
  requestConsultationCall: (encounterId: EmrId) => void;
  selectEncounter: (encounterId: EmrId) => void;
  selectOperatingDate: (workspaceId: EmrId, date: string) => void;
  setLiveQueueState: (state: {
    error?: string;
    records?: ChartLiveQueueRecord[];
    scope?: ChartStore["liveQueueScope"];
    status: ChartStore["liveQueueStatus"];
  }) => void;
  updateLiveQueueRecord: (record: ChartLiveQueueRecord) => void;
};

export const useChartStore = create<ChartStore>()((set) => ({
  liveQueueError: undefined,
  liveQueueRecords: [],
  liveQueueScope: undefined,
  liveQueueStatus: "idle",
  pendingConsultationCallEncounterId: "",
  selectedEncounterId: "",
  selectedOperatingDateByWorkspace: {},
  clearPendingConsultationCall: () =>
    set({ pendingConsultationCallEncounterId: "" }),
  requestConsultationCall: (pendingConsultationCallEncounterId) =>
    set({ pendingConsultationCallEncounterId }),
  selectEncounter: (selectedEncounterId) => set({ selectedEncounterId }),
  selectOperatingDate: (workspaceId, date) =>
    set((current) => ({
      selectedOperatingDateByWorkspace: {
        ...current.selectedOperatingDateByWorkspace,
        [workspaceId]: date,
      },
    })),
  setLiveQueueState: ({ error, records, scope, status }) =>
    set((current) => ({
      liveQueueError: error,
      liveQueueRecords: records ?? current.liveQueueRecords,
      liveQueueScope: scope ?? current.liveQueueScope,
      liveQueueStatus: status,
    })),
  updateLiveQueueRecord: (record) =>
    set((current) => ({
      liveQueueRecords: current.liveQueueRecords.map((item) =>
        item.encounter.id === record.encounter.id ? record : item,
      ),
    })),
}));
