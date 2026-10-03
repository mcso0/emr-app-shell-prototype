"use client";

import type { ChartPatientHistoryResponse } from "@/features/chart/chart-patient-history";

export async function loadChartPatientHistoryPage({
  actorHeaders,
  cursor,
  limit = 50,
  patientId,
  signal,
  workspaceId,
}: {
  actorHeaders?: Record<string, string>;
  cursor?: string;
  limit?: number;
  patientId: string;
  signal?: AbortSignal;
  workspaceId: string;
}): Promise<ChartPatientHistoryResponse> {
  signal?.throwIfAborted();
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
        signal,
      },
    );
    const body = (await response.json()) as ChartPatientHistoryResponse;
    signal?.throwIfAborted();

    if (!response.ok || !body.ok) {
      if (!body.ok) return { ...body, status: response.status };
      return { ok: false, status: response.status, error: "db_read_failed" };
    }

    return body;
  } catch {
    signal?.throwIfAborted();
    return { ok: false, status: 500, error: "db_read_failed" };
  }
}

export async function loadCompleteChartPatientHistory({
  actorHeaders,
  patientId,
  signal,
  workspaceId,
  loadPage = loadChartPatientHistoryPage,
}: {
  actorHeaders?: Record<string, string>;
  patientId: string;
  signal?: AbortSignal;
  workspaceId: string;
  loadPage?: typeof loadChartPatientHistoryPage;
}): Promise<ChartPatientHistoryResponse> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    signal?.throwIfAborted();
    const recordsByHistoryId = new Map<
      string,
      Extract<ChartPatientHistoryResponse, { ok: true }>["items"][number]
    >();
    const seenCursors = new Set<string>();
    let cursor: string | undefined;
    let totalCount = 0;

    while (true) {
      signal?.throwIfAborted();
      const result = await loadPage({
        actorHeaders,
        cursor,
        patientId,
        signal,
        workspaceId,
      });
      // Also guard loaders that resolve after cancellation instead of rejecting.
      signal?.throwIfAborted();
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
