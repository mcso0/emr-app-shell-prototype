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
