"use client";

import type { ChartOrderCatalogSearchRow } from "@/features/hospital-admin/server-order-catalog";

type ChartOrderCatalogRouteResponse =
  | {
      ok: true;
      status?: number;
      rows: ChartOrderCatalogSearchRow[];
    }
  | {
      ok: false;
      status?: number;
      denialReason?: string;
      error?: string;
    };

const chartOrderCatalogFreshMs = 60_000;

async function loadChartOrderCatalog({
  actorHeaders,
  workspaceId,
}: {
  actorHeaders?: Record<string, string>;
  workspaceId: string;
}): Promise<ChartOrderCatalogRouteResponse> {
  try {
    const response = await fetch(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/hospital-admin/order-catalog?mode=chart-search`,
      {
        cache: "no-store",
        headers: actorHeaders,
      },
    );
    const body = (await response.json()) as ChartOrderCatalogRouteResponse;

    if (!response.ok || !body.ok) {
      if (!body.ok) return { ...body, status: response.status };
      return { ok: false, status: response.status, error: "db_read_failed" };
    }

    return body;
  } catch {
    return { ok: false, status: 500, error: "db_read_failed" };
  }
}

const chartOrderCatalogCache = new Map<
  string,
  { loadedAt: number; rows: ChartOrderCatalogSearchRow[] }
>();

const chartOrderCatalogRequests = new Map<
  string,
  Promise<ChartOrderCatalogRouteResponse>
>();

export function getFreshChartOrderCatalog(cacheKey: string) {
  const cached = chartOrderCatalogCache.get(cacheKey);
  if (!cached) return null;
  if (Date.now() - cached.loadedAt < chartOrderCatalogFreshMs) return cached.rows;
  chartOrderCatalogCache.delete(cacheKey);
  return null;
}

export function loadCachedChartOrderCatalog({
  actorHeaders,
  cacheKey,
  force = false,
  workspaceId,
}: {
  actorHeaders?: Record<string, string>;
  cacheKey: string;
  force?: boolean;
  workspaceId: string;
}): Promise<ChartOrderCatalogRouteResponse> {
  const cached = force ? null : getFreshChartOrderCatalog(cacheKey);
  if (cached) return Promise.resolve({ ok: true, rows: cached });

  const inFlight = chartOrderCatalogRequests.get(cacheKey);
  if (inFlight) return inFlight;

  const request = loadChartOrderCatalog({ actorHeaders, workspaceId })
    .then((result) => {
      if (result.ok) {
        chartOrderCatalogCache.set(cacheKey, {
          loadedAt: Date.now(),
          rows: result.rows,
        });
      } else {
        chartOrderCatalogCache.delete(cacheKey);
      }
      return result;
    })
    .finally(() => chartOrderCatalogRequests.delete(cacheKey));
  chartOrderCatalogRequests.set(cacheKey, request);
  return request;
}
