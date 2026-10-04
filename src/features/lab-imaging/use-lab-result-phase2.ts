"use client";

import { useCallback, useEffect, useState } from "react";

export type LabResultAttachment = {
  id: string;
  rowId: string | null;
  name: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  uploadedByUserId: string;
  uploadedByName?: string;
};

export type LabResultHistoryEvent = {
  kind: "row_changed" | "overall_changed" | "retest_requested";
  rowId: string | null;
  resultId: string;
  actorUserId: string | null;
  actorName: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  createdAt: string;
};

export type LabResultPhase2Data = {
  resultId: string;
  orderId: string;
  overallFinding: string;
  overallRevision: number;
  canEdit: boolean;
  events: LabResultHistoryEvent[];
  attachments: LabResultAttachment[];
};

function parsePhase2(value: unknown, resultId: string): LabResultPhase2Data | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  if (data.resultId !== resultId || typeof data.orderId !== "string"
    || typeof data.overallFinding !== "string" || !Number.isSafeInteger(data.overallRevision)
    || typeof data.canEdit !== "boolean"
    || !Array.isArray(data.events) || !Array.isArray(data.attachments)) return null;
  if (!data.attachments.every(item => item && typeof item === "object" &&
    typeof item.id === "string" && (item.rowId === null || typeof item.rowId === "string") &&
    typeof item.name === "string" && typeof item.mimeType === "string" && typeof item.size === "number")) return null;
  return data as LabResultPhase2Data;
}

export function useLabResultPhase2(workspaceId: string, resultId: string | undefined, enabled: boolean) {
  const key = `${workspaceId}:${resultId ?? ""}`;
  const [reload, setReload] = useState(0);
  const [state, setState] = useState<{ key: string; status: "loading" | "ready" | "error" | "permission_denied"; data: LabResultPhase2Data | null }>({ key: "", status: "loading", data: null });
  const refresh = useCallback(() => setReload(value => value + 1), []);
  useEffect(() => {
    if (!enabled || !resultId) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(`/api/workspaces/${encodeURIComponent(workspaceId)}/lab-imaging/result-phase2?resultId=${encodeURIComponent(resultId)}`, { cache: "no-store", signal: controller.signal });
        const body = await response.json();
        if (controller.signal.aborted) return;
        const parsed = response.ok && body.ok ? parsePhase2(body.data, resultId) : null;
        setState({ key, status: parsed ? "ready" : response.status === 401 || response.status === 403 ? "permission_denied" : "error", data: parsed });
      } catch {
        if (!controller.signal.aborted) setState({ key, status: "error", data: null });
      }
    })();
    return () => controller.abort();
  }, [enabled, key, reload, resultId, workspaceId]);
  if (!enabled) return { status: "ready" as const, data: null, refresh };
  if (state.key !== key) return { status: "loading" as const, data: null, refresh };
  return { ...state, refresh };
}
