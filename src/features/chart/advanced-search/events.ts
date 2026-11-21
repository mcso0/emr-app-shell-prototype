import type { PendingCopy, SearchChart } from "./contract";

export type SearchEntry = {
  workspaceId: string;
  chartId?: string;
  encounterId?: string;
  patientId?: string;
  resume?: { pending: PendingCopy; target: SearchChart; source: SearchChart };
};
export const openSearchEvent = "clair:open-advanced-chart-search";
export const copiedEvent = "clair:advanced-chart-copied";
export const openChartSearch = (detail: SearchEntry) =>
  window.dispatchEvent(new CustomEvent(openSearchEvent, { detail }));

export const receptionCreatedEvent = "clair:chart-search-reception-created";
