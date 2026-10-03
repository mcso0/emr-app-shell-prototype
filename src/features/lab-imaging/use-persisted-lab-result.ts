"use client";

import { useCallback, useEffect, useState } from "react";
import type { LabResult } from "@/types/emr-domain";
import { parsePersistedLabResult } from "./persisted-result-contract";

export function usePersistedLabResult(workspaceId: string, workItemId: string | undefined, base: LabResult | undefined, enabled: boolean) {
  const orderId = base?.orderId;
  const encounterId = base?.encounterId;
  const key = `${workspaceId}:${workItemId}:${orderId}:${encounterId}`;
  const [reload, setReload] = useState(0);
  const [state, setState] = useState<{ key: string; status: "loading" | "ready" | "empty" | "error" | "permission_denied"; payload?: unknown }>({ key: "", status: "loading" });
  useEffect(() => {
    if (!enabled || !workItemId || !orderId || !encounterId) return;
    const controller = new AbortController();
    void (async () => {
      setState(previous => ({ key, status: "loading", payload: previous.key === key ? previous.payload : undefined }));
      try {
        const params = new URLSearchParams({ workItemId, orderId });
        const response = await fetch(`/api/workspaces/${encodeURIComponent(workspaceId)}/lab-imaging/result-entries?${params}`, {
          cache: "no-store", signal: controller.signal,
        });
        const payload = await response.json();
        if (controller.signal.aborted) return;
        const status = response.status === 401 || response.status === 403 ? "permission_denied"
          : !response.ok || payload?.ok !== true ? "error" : payload.savedResult === null ? "empty" : "ready";
        setState(previous => ({ key, status, payload: status === "error" && previous.key === key
          ? previous.payload : status === "permission_denied" ? undefined : payload }));
      } catch {
        if (!controller.signal.aborted) setState(previous => ({ key, status: "error", payload: previous.key === key ? previous.payload : undefined }));
      }
    })();
    return () => controller.abort();
  }, [workspaceId, workItemId, orderId, encounterId, enabled, key, reload]);
  const retry = useCallback(() => setReload(value => value + 1), []);
  if (!enabled) return { status: "idle" as const, result: null, retry };
  if (state.key !== key) return { status: "loading" as const, result: null, retry };
  const result = (state.status === "ready" || state.status === "loading" || state.status === "error") && base && workItemId && orderId && encounterId
    ? parsePersistedLabResult(state.payload, { workspaceId, workItemId, orderId, encounterId }, base) : null;
  return { status: state.status === "ready" && !result ? "error" as const : state.status, result, retry };
}
