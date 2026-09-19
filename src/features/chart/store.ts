"use client";

import { create } from "zustand";
import type { ChartLiveQueueRecord } from "@/features/chart/chart-live-queue";
import type { ChartPatientHistoryRecord } from "@/features/chart/chart-patient-history";
import type { EmrId, SoapNote } from "@/types/emr-domain";

type ChartStore = {
  selectedChartId: string;
  encounterCharts: SoapNote[];
  encounterChartsScope?: string;
  encounterChartsStatus: "idle" | "loading" | "ready" | "error";
  encounterChartCreating: boolean;
  createEncounterChart?: (encounterId?: EmrId) => Promise<boolean>;
  diagnosisSaving: boolean;
  flushEditors: () => Promise<boolean>;
  flushOrderEdits?: () => Promise<boolean>;
  flushActiveChart?: () => Promise<boolean>;
  selectChart: (chartId: string) => Promise<void>;
  setEncounterCharts: (scope: string, charts: SoapNote[], status: "loading" | "ready" | "error", preferredChartId?: string) => void;
  updateEncounterChart: (scope: string, chart: SoapNote) => void;

  chartHistoryError?: string;
  chartHistoryRecords: ChartPatientHistoryRecord[];
  chartHistoryRefreshNonce: number;
  chartHistoryScope?: {
    patientId: EmrId;
    workspaceId: EmrId;
  };
  chartHistoryStatus: "idle" | "loading" | "ready" | "error";
  chartHistoryTotalCount: number;
  historyViewChartId: EmrId;
  historyViewEncounterId: EmrId;
  newChartDialogOpen: boolean;
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
  setNewChartDialogOpen: (open: boolean) => void;
  selectEncounter: (encounterId: EmrId) => void;
  selectHistoryChart: (
    encounterId: EmrId,
    chartId: EmrId,
    beforeSelect?: () => void,
  ) => Promise<boolean>;
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

export const useChartStore = create<ChartStore>()((set, get) => ({
  diagnosisSaving: false,
  flushEditors: async () => {
    if (get().diagnosisSaving) return false;
    if (get().flushActiveChart && !await get().flushActiveChart!()) return false;
    if (get().flushOrderEdits && !await get().flushOrderEdits!()) return false;
    return !get().diagnosisSaving;
  },
  selectedChartId: "",
  encounterCharts: [],
  encounterChartsStatus: "idle",
  encounterChartCreating: false,
  selectChart: async (selectedChartId) => {
    if (get().selectedChartId === selectedChartId) return;
    const scope = get().encounterChartsScope;
    if (!await get().flushEditors()) return;
    if (get().encounterChartsScope === scope && get().encounterCharts.some((chart) => chart.id === selectedChartId)) {
      set({ historyViewChartId: selectedChartId, selectedChartId });
    }
  },
  setEncounterCharts: (scope, charts, status, preferredChartId) => set((current) => ({
    encounterChartsScope: scope, encounterCharts: charts, encounterChartsStatus: status,
    selectedChartId: charts.some((chart) => chart.id === preferredChartId) ? preferredChartId!
      : scope === current.encounterChartsScope && charts.some((chart) => chart.id === current.selectedChartId)
        ? current.selectedChartId : charts[0]?.id ?? "",
  })),
  updateEncounterChart: (scope, chart) => set((current) => current.encounterChartsScope !== scope ? {} : ({
    encounterCharts: [...current.encounterCharts.filter((row) => row.id !== chart.id), chart]
      .sort((a, b) => (b.clinicalAt ?? b.createdAt).localeCompare(a.clinicalAt ?? a.createdAt) || b.id.localeCompare(a.id)),
  })),
  chartHistoryError: undefined,
  chartHistoryRecords: [],
  chartHistoryRefreshNonce: 0,
  chartHistoryScope: undefined,
  chartHistoryStatus: "idle",
  chartHistoryTotalCount: 0,
  historyViewChartId: "",
  historyViewEncounterId: "",
  newChartDialogOpen: false,
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
  setNewChartDialogOpen: (newChartDialogOpen) => set({ newChartDialogOpen }),
  selectEncounter: async (selectedEncounterId) => {
    if (get().selectedEncounterId === selectedEncounterId && !get().historyViewEncounterId) return;
    if (!await get().flushEditors()) return;
    set({ historyViewChartId: "", historyViewEncounterId: "", selectedEncounterId, selectedChartId: "" });
  },
  selectHistoryChart: async (encounterId, chartId, beforeSelect) => {
    const chartAlreadyLoaded = get().encounterCharts.some(
      (chart) => chart.id === chartId,
    );
    if (
      get().historyViewEncounterId === encounterId &&
      get().historyViewChartId === chartId
    ) {
      beforeSelect?.();
      if (chartAlreadyLoaded && get().selectedChartId !== chartId) {
        set({ selectedChartId: chartId });
      }
      return true;
    }
    if (!await get().flushEditors()) return false;
    beforeSelect?.();
    const selectingCurrentEncounter = encounterId === get().selectedEncounterId;
    set({
      historyViewChartId: chartId,
      historyViewEncounterId: selectingCurrentEncounter ? "" : encounterId,
      selectedChartId: chartAlreadyLoaded ? chartId : "",
    });
    return true;
  },
  selectHistoryEncounter: async (historyViewEncounterId) => {
    if (get().historyViewEncounterId === historyViewEncounterId) return;
    if (!await get().flushEditors()) return;
    set({ historyViewChartId: "", historyViewEncounterId, selectedChartId: "" });
  },
  selectOperatingDate: (workspaceId, date) =>
    set((current) => ({
      historyViewChartId: "",
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
