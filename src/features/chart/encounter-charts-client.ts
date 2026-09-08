"use client";

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { toast } from "sonner";
import { useChartStore } from "@/features/chart/store";
import type { EncounterChartsInput, EncounterChartsResult } from "@/features/chart/server-encounter-charts-core";

export async function encounterChartsRequest(workspaceId: string, method: "GET" | "POST" | "PATCH", input: EncounterChartsInput,
  actorHeaders?: Record<string, string>): Promise<EncounterChartsResult> {
  const path = `/api/workspaces/${encodeURIComponent(workspaceId)}/chart/encounter-charts`;
  try {
    const response = await fetch(method === "GET" ? `${path}?encounterId=${encodeURIComponent(input.encounterId ?? "")}` : path, {
      method, cache: "no-store", headers: { "Content-Type": "application/json", ...actorHeaders },
      ...(method !== "GET" ? { body: JSON.stringify(input) } : {}),
    });
    const result = await response.json() as EncounterChartsResult;
    return response.ok ? result : { ok: false, status: response.status as 409, ...(!result.ok ? result : {}) };
  } catch { return { ok: false, status: 500, error: "network_error" }; }
}
export function chartLifecycleError(reason?: string) {
  if (reason === "unfinished_charts") return "미완료 차트를 각각 완료한 뒤 진료를 종료해 주세요.";
  if (reason === "soap_note_conflict") return "다른 곳에서 차트가 변경됐어요. 최신 내용을 확인한 뒤 다시 시도해 주세요.";
  if (reason === "stale_status") return "진행 중인 접수에서만 차트를 추가·수정할 수 있어요.";
  if (reason === "permission_missing") return "차트 권한을 확인해 주세요.";
  return "차트를 처리하지 못했어요. 연결을 확인한 뒤 다시 시도해 주세요.";
}

export function useEncounterCharts({ workspaceId, encounterId, actorKey, actorHeaders, enabled, requestedChartId }: {
  workspaceId?: string; encounterId?: string; actorKey: string; actorHeaders?: Record<string, string>;
  enabled: boolean; requestedChartId?: string | null;
}) {
  const scope = `${workspaceId ?? ""}:${actorKey}:${encounterId ?? ""}`;
  const createRequestRef = useRef<{ scope: string; id: string } | null>(null);
  const creatingRef = useRef(false);
  const activeScopeRef = useRef(scope);
  useLayoutEffect(() => { activeScopeRef.current = scope; }, [scope]);
  const setCharts = useChartStore((state) => state.setEncounterCharts);
  const updateChart = useChartStore((state) => state.updateEncounterChart);
  const selectedChartId = useChartStore((state) => state.selectedChartId);
  const storedScope = useChartStore((state) => state.encounterChartsScope);
  const charts = useChartStore((state) => state.encounterCharts);
  const status = useChartStore((state) => state.encounterChartsStatus);
  const requestedChartRef = useRef(requestedChartId);
  useLayoutEffect(() => { requestedChartRef.current = requestedChartId; }, [requestedChartId]);
  const reload = useCallback(async (signal?: AbortSignal) => {
    if (!enabled || !workspaceId || !encounterId) return;
    const result = await encounterChartsRequest(workspaceId, "GET", { encounterId }, actorHeaders);
    if (signal?.aborted || activeScopeRef.current !== scope) return;
    setCharts(scope, result.ok ? result.charts ?? [] : [], result.ok ? "ready" : "error", requestedChartRef.current ?? undefined);
  }, [actorHeaders, enabled, encounterId, scope, setCharts, workspaceId]);
  useEffect(() => {
    if (!enabled || !encounterId || !workspaceId) return;
    const controller = new AbortController();
    setCharts(scope, [], "loading");
    void reload(controller.signal);
    return () => controller.abort();
  }, [enabled, encounterId, reload, scope, setCharts, workspaceId]);
  const create = useCallback(async () => {
    if (!enabled || !workspaceId || !encounterId || creatingRef.current) return;
    creatingRef.current = true;
    useChartStore.setState({ encounterChartCreating: true });
    try {
      if (!await useChartStore.getState().flushEditors()) {
        toast.error("현재 차트를 저장하지 못했어요. 저장 오류를 해결한 뒤 새 차트를 추가해 주세요."); return;
      }
      if (activeScopeRef.current !== scope) return;
      if (createRequestRef.current?.scope !== scope) createRequestRef.current = { scope, id: crypto.randomUUID() };
      const result = await encounterChartsRequest(workspaceId, "POST", { encounterId, creationRequestId: createRequestRef.current!.id }, actorHeaders);
      if (activeScopeRef.current !== scope) return;
      if (!result.ok || !result.chart) { toast.error(chartLifecycleError(!result.ok ? result.denialReason : undefined)); return; }
      createRequestRef.current = null;
      updateChart(scope, result.chart);
      useChartStore.setState({ selectedChartId: result.chart.id });
      toast.success("새 차트를 열었어요.");
    } finally {
      creatingRef.current = false;
      useChartStore.setState({ encounterChartCreating: false });
    }
  }, [actorHeaders, enabled, encounterId, scope, updateChart, workspaceId]);
  useEffect(() => {
    useChartStore.setState({ createEncounterChart: create });
    return () => { if (useChartStore.getState().createEncounterChart === create) useChartStore.setState({ createEncounterChart: undefined }); };
  }, [create]);
  useEffect(() => {
    if (storedScope !== scope || !selectedChartId) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("chartId") === selectedChartId) return;
    url.searchParams.set("chartId", selectedChartId);
    window.history.replaceState(window.history.state, "", url);
  }, [scope, selectedChartId, storedScope]);
  return { scope, charts: storedScope === scope ? charts : [], selectedChartId: storedScope === scope ? selectedChartId : "",
    status: storedScope === scope ? status : "loading" as const, reload, create };
}
