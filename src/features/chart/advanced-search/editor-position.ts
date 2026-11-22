"use client";

import { createContext, useContext } from "react";

export type ChartEditorPosition = {
  workspaceId: string;
  encounterId: string;
  chartId: string;
  scope: string;
  blockId: string;
  offset: number;
  editorScroll: number;
  chartScroll: number;
};

export function createChartSearchEditorBridge() {
  let capture: (() => ChartEditorPosition | null) | null = null;
  let pending: ChartEditorPosition | null = null;
  return {
    capture: () => capture?.() ?? null,
    register(reader: () => ChartEditorPosition | null) {
      capture = reader;
      return () => { if (capture === reader) capture = null; };
    },
    pending: () => pending,
    restore(position: ChartEditorPosition | null) { pending = position; },
  };
}
export type ChartSearchEditorBridge = ReturnType<typeof createChartSearchEditorBridge>;

export const ChartSearchEditorContext = createContext<ChartSearchEditorBridge | null>(null);

export function useChartReturnScope(workspaceId: string, encounterId: string, chartId?: string) {
  const position = useContext(ChartSearchEditorContext)?.pending();
  return position?.workspaceId === workspaceId && position.encounterId === encounterId && position.chartId === chartId
    ? position.scope
    : undefined;
}
