"use client";

import type { ChartPatientHistoryResponse } from "@/features/chart/chart-patient-history";

export async function loadChartPatientHistoryPage({
  actorHeaders,
  cursor,
  limit = 50,
  patientId,
  workspaceId,
}: {
  actorHeaders?: Record<string, string>;
  cursor?: string;
  limit?: number;
  patientId: string;
  workspaceId: string;
}): Promise<ChartPatientHistoryResponse> {
  const searchParams = new URLSearchParams({
    limit: String(limit),
    patientId,
  });
  if (cursor) searchParams.set("cursor", cursor);

  try {
    const response = await fetch(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/chart/history?${searchParams.toString()}`,
      {
        cache: "no-store",
        headers: actorHeaders,
      },
    );
    const body = (await response.json()) as ChartPatientHistoryResponse;

    if (!response.ok || !body.ok) {
      if (!body.ok) return { ...body, status: response.status };
      return { ok: false, status: response.status, error: "db_read_failed" };
    }

    return body;
  } catch {
    return { ok: false, status: 500, error: "db_read_failed" };
  }
}

export async function loadCompleteChartPatientHistory({
  actorHeaders,
  patientId,
  workspaceId,
  loadPage = loadChartPatientHistoryPage,
}: {
  actorHeaders?: Record<string, string>;
  patientId: string;
  workspaceId: string;
  loadPage?: typeof loadChartPatientHistoryPage;
}): Promise<ChartPatientHistoryResponse> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const recordsByHistoryId = new Map<
      string,
      Extract<ChartPatientHistoryResponse, { ok: true }>["items"][number]
    >();
    const seenCursors = new Set<string>();
    let cursor: string | undefined;
    let totalCount = 0;

    while (true) {
      const result = await loadPage({
        actorHeaders,
        cursor,
        patientId,
        workspaceId,
      });
      if (!result.ok) return result;

      for (const record of result.items) {
        const historyId = record.chart?.id ?? `waiting:${record.encounter.id}`;
        recordsByHistoryId.set(historyId, record);
      }
      totalCount = result.totalCount;

      if (!result.nextCursor) break;
      if (seenCursors.has(result.nextCursor)) {
        return { ok: false, status: 500, error: "db_read_failed" };
      }
      seenCursors.add(result.nextCursor);
      cursor = result.nextCursor;
    }

    if (recordsByHistoryId.size === totalCount) {
      return {
        enforcedBy: "chart-patient-history-read",
        items: [...recordsByHistoryId.values()].sort(
          (a, b) =>
            getChartHistorySortAt(b).localeCompare(getChartHistorySortAt(a)) ||
            getChartHistoryStableId(b).localeCompare(getChartHistoryStableId(a)),
        ),
        nextCursor: null,
        ok: true,
        status: 200,
        totalCount,
      };
    }
  }

  return { ok: false, status: 500, error: "db_read_failed" };
}

function getChartHistorySortAt(
  record: Extract<ChartPatientHistoryResponse, { ok: true }>["items"][number],
) {
  return record.chart?.createdAt ?? record.encounter.checkedInAt ?? record.encounter.createdAt;
}

function getChartHistoryStableId(
  record: Extract<ChartPatientHistoryResponse, { ok: true }>["items"][number],
) {
  return record.chart?.id ?? record.encounter.id;
}
