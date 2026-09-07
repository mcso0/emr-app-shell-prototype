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
      setState({ key, status: "loading" });
      try {
        const params = new URLSearchParams({ workItemId, orderId });
        const response = await fetch(`/api/workspaces/${encodeURIComponent(workspaceId)}/lab-imaging/result-entries?${params}`, {
          cache: "no-store", signal: controller.signal,
        });
        const payload = await response.json();
        if (controller.signal.aborted) return;
        setState({ key, payload, status: response.status === 401 || response.status === 403 ? "permission_denied"
          : !response.ok || payload?.ok !== true ? "error" : payload.savedResult === null ? "empty" : "ready" });
      } catch {
        if (!controller.signal.aborted) setState({ key, status: "error" });
      }
    })();
    return () => controller.abort();
  }, [workspaceId, workItemId, orderId, encounterId, enabled, key, reload]);
  const retry = useCallback(() => setReload(value => value + 1), []);
  if (!enabled) return { status: "idle" as const, result: null, retry };
  if (state.key !== key) return { status: "loading" as const, result: null, retry };
  const result = state.status === "ready" && base && workItemId && orderId && encounterId
    ? parsePersistedLabResult(state.payload, { workspaceId, workItemId, orderId, encounterId }, base) : null;
  return { status: state.status === "ready" && !result ? "error" as const : state.status, result, retry };
}
