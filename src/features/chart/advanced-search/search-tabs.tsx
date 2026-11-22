"use client";

import { useEffect, useMemo, useState } from "react";
import { getOperatingDateFromIso } from "@/lib/emr-domain/demo-date";
import { useWorkspaceTabsStore } from "@/stores/workspace-tabs-store";
import { chartSearchApi } from "./client";
import type { ChartEditorPosition, ChartSearchEditorBridge } from "./editor-position";
import { openSearchEvent, type SearchEntry } from "./events";
import { ChartSearchWorkspace, type ChartLocation } from "./workspace";

type Origin = {
  entry: SearchEntry;
  searchTab: string;
  chartTab: string;
  previousRoute: string;
  returnRoute: string;
  position: ChartEditorPosition | null;
};

export function ChartSearchTabs({ userId, workspace, navigate, withSavedEditors, editor }: {
  userId?: string;
  workspace: string;
  navigate: (route: string | null) => void;
  withSavedEditors: (action: () => void) => Promise<void>;
  editor: ChartSearchEditorBridge;
}) {
  const api = useMemo(() => chartSearchApi(workspace), [workspace]);
  const searchTab = useWorkspaceTabsStore(s => s.workspaceId === workspace
    ? s.tabs.find(t => t.moduleId === "chart-search") : undefined);
  const [origin, setOrigin] = useState<Origin | null>(null);
  const currentOrigin = origin && origin.searchTab === searchTab?.id ? origin : null;
  const activeTabId = useWorkspaceTabsStore(s => s.activeTabId);
  const active = !!searchTab && activeTabId === searchTab.id;
  const [visited, setVisited] = useState<string | null>(null);
  if (active && searchTab && visited !== searchTab.id) setVisited(searchTab.id);
  if (!searchTab && visited) {
    setVisited(null);
    setOrigin(null);
  }
  useEffect(() => {
    const open = (event: Event) => {
      const detail = (event as CustomEvent<SearchEntry>).detail;
      if (detail?.workspaceId !== workspace) return;
      const position = detail.chartId ? editor.capture() : null;
      void withSavedEditors(() => {
        const state = useWorkspaceTabsStore.getState();
        if (state.workspaceId !== workspace) return;
        const sourceTab = state.tabs.find(tab => tab.id === state.activeTabId);
        const existing = state.tabs.find(tab => tab.moduleId === "chart-search");
        const route = existing ? state.activateTab(existing.id) : state.createTab({
          workspaceId: workspace, moduleId: "chart-search",
          route: `/w/${encodeURIComponent(workspace)}/chart-search?modulePanel=closed`,
        });
        if (sourceTab?.moduleId === "treatment" && detail.chartId && detail.encounterId && detail.patientId) {
          const previousRoute = sourceTab.history[sourceTab.historyIndex];
          const url = new URL(previousRoute, window.location.origin);
          if (!url.searchParams.has("historyEncounterId")) url.searchParams.set("encounterId", detail.encounterId);
          url.searchParams.set("chartId", detail.chartId);
          setOrigin({ entry: detail, chartTab: sourceTab.id, searchTab: useWorkspaceTabsStore.getState().activeTabId!,
            previousRoute, returnRoute: url.pathname + url.search, position });
        }
        navigate(route);
      });
    };
    window.addEventListener(openSearchEvent, open);
    return () => window.removeEventListener(openSearchEvent, open);
  }, [workspace, editor, navigate, withSavedEditors]);

  function openTreatment(route: string, tabId?: string) {
    const state = useWorkspaceTabsStore.getState();
    const current = tabId && state.tabs.find(tab => tab.id === tabId);
    if (current) {
      state.activateTab(current.id);
      state.syncActiveRoute(route, "treatment");
      navigate(route);
    } else {
      navigate(state.createTab({ workspaceId: workspace, moduleId: "treatment", route }));
    }
  }
  function returnToOrigin() {
    if (!currentOrigin) return;
    const { chartTab, previousRoute, returnRoute, position } = currentOrigin;
    const tab = useWorkspaceTabsStore.getState().tabs.find(t => t.id === chartTab);
    const currentRoute = tab?.history[tab.historyIndex];
    editor.restore(position);
    const current = currentRoute ? new URL(currentRoute, window.location.origin) : null;
    const expected = new URL(returnRoute, window.location.origin);
    const sameVisit = current?.pathname === expected.pathname &&
      current.searchParams.get("encounterId") === expected.searchParams.get("encounterId") &&
      current.searchParams.get("historyEncounterId") === expected.searchParams.get("historyEncounterId");
    const reuse = currentRoute === previousRoute || (sameVisit &&
      current?.searchParams.get("chartId") === expected.searchParams.get("chartId"));
    openTreatment(returnRoute, reuse ? chartTab : undefined);
    if (!reuse) setOrigin({ ...currentOrigin, chartTab: useWorkspaceTabsStore.getState().activeTabId! });
  }
  function viewChart(chart: ChartLocation) {
    const date = getOperatingDateFromIso(chart.visitAt);
    const params = new URLSearchParams({ patientId: chart.patientId, encounterId: chart.encounterId,
      chartId: chart.chartId, orderChart: "1", ...(date ? { date } : {}) });
    const tab = useWorkspaceTabsStore.getState().tabs.find(t => {
      if (t.moduleId !== "treatment") return false;
      const url = new URL(t.history[t.historyIndex], window.location.origin);
      return url.searchParams.get("chartId") === chart.chartId && url.searchParams.get("encounterId") === chart.encounterId;
    });
    openTreatment(tab?.history[tab.historyIndex] ?? `/w/${encodeURIComponent(workspace)}/treatment?${params}`, tab?.id);
  }
  if (!searchTab || (!active && visited !== searchTab.id)) return null;
  return <div hidden={!active} inert={!active} className="pointer-events-none absolute inset-0 [&>section]:pointer-events-auto">
    <ChartSearchWorkspace key={searchTab.id} entry={currentOrigin?.entry ?? { workspaceId: workspace }}
      userId={userId} independent active={active} api={api}
      onReturnToChart={currentOrigin ? returnToOrigin : undefined}
      onClose={() => navigate(useWorkspaceTabsStore.getState().closeTab(searchTab.id))} onViewChart={viewChart} />
  </div>;
}
