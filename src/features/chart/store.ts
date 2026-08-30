"use client";

import { create } from "zustand";
import type { ChartLiveQueueRecord } from "@/features/chart/chart-live-queue";
import type { ChartPatientHistoryRecord } from "@/features/chart/chart-patient-history";
import type { EmrId } from "@/types/emr-domain";

type ChartStore = {
  chartHistoryError?: string;
  chartHistoryRecords: ChartPatientHistoryRecord[];
  chartHistoryRefreshNonce: number;
  chartHistoryScope?: {
    patientId: EmrId;
    workspaceId: EmrId;
  };
  chartHistoryStatus: "idle" | "loading" | "ready" | "error";
  chartHistoryTotalCount: number;
  historyViewEncounterId: EmrId;
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
  requestChartHistoryRefresh: () => void;
  requestConsultationCall: (encounterId: EmrId) => void;
  selectEncounter: (encounterId: EmrId) => void;
  selectHistoryEncounter: (encounterId: EmrId) => void;
  selectOperatingDate: (workspaceId: EmrId, date: string) => void;
  setChartHistoryState: (state: {
    error?: string;
    records?: ChartPatientHistoryRecord[];
    scope?: ChartStore["chartHistoryScope"];
    status: ChartStore["chartHistoryStatus"];
    totalCount?: number;
  }) => void;
  setLiveQueueState: (state: {
    error?: string;
    records?: ChartLiveQueueRecord[];
    scope?: ChartStore["liveQueueScope"];
    status: ChartStore["liveQueueStatus"];
  }) => void;
  updateLiveQueueRecord: (record: ChartLiveQueueRecord) => void;
};

export const useChartStore = create<ChartStore>()((set) => ({
  chartHistoryError: undefined,
  chartHistoryRecords: [],
  chartHistoryRefreshNonce: 0,
  chartHistoryScope: undefined,
  chartHistoryStatus: "idle",
  chartHistoryTotalCount: 0,
  historyViewEncounterId: "",
  liveQueueError: undefined,
  liveQueueRecords: [],
  liveQueueScope: undefined,
  liveQueueStatus: "idle",
  pendingConsultationCallEncounterId: "",
  selectedEncounterId: "",
  selectedOperatingDateByWorkspace: {},
  clearPendingConsultationCall: () =>
    set({ pendingConsultationCallEncounterId: "" }),
  requestChartHistoryRefresh: () =>
    set((current) => ({
      chartHistoryRefreshNonce: current.chartHistoryRefreshNonce + 1,
    })),
  requestConsultationCall: (pendingConsultationCallEncounterId) =>
    set({ pendingConsultationCallEncounterId }),
  selectEncounter: (selectedEncounterId) =>
    set({ historyViewEncounterId: "", selectedEncounterId }),
  selectHistoryEncounter: (historyViewEncounterId) =>
    set({ historyViewEncounterId }),
  selectOperatingDate: (workspaceId, date) =>
    set((current) => ({
      historyViewEncounterId: "",
      selectedOperatingDateByWorkspace: {
        ...current.selectedOperatingDateByWorkspace,
        [workspaceId]: date,
      },
    })),
  setChartHistoryState: ({ error, records, scope, status, totalCount }) =>
    set((current) => ({
      chartHistoryError: error,
      chartHistoryRecords: records ?? current.chartHistoryRecords,
      chartHistoryScope: scope ?? current.chartHistoryScope,
      chartHistoryStatus: status,
      chartHistoryTotalCount: totalCount ?? current.chartHistoryTotalCount,
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
