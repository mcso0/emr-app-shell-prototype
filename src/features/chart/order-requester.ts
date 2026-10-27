export type ChartOrderRequester = {
  requestedByUserId?: string | null;
  requestedByDisplayName?: string | null;
};

export function readChartOrderRequester(row: Record<string, unknown>): ChartOrderRequester {
  if (row.requestedByUserId === undefined) return {};
  const id = typeof row.requestedByUserId === "string" ? row.requestedByUserId.trim() : "";
  return {
    requestedByUserId: id || null,
    requestedByDisplayName: id && typeof row.requestedByDisplayName === "string"
      ? row.requestedByDisplayName.trim() || null : null,
  };
}

export function resolveChartOrderRequester(
  persisted: ChartOrderRequester | undefined,
  fallbackId: string | undefined,
  lookupLegacyName: (id?: string) => string | undefined,
) {
  if (persisted?.requestedByUserId !== undefined) {
    return {
      id: persisted.requestedByUserId ?? "",
      name: persisted.requestedByUserId
        ? persisted.requestedByDisplayName?.trim() || "이름 미확인"
        : "미기록",
    };
  }
  return { id: fallbackId ?? "", name: lookupLegacyName(fallbackId) ?? (fallbackId ? "이름 미확인" : "미기록") };
}
