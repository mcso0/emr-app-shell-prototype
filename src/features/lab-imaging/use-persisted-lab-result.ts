"use client";

import { useCallback, useEffect, useState } from "react";
import type { LabResult } from "@/types/emr-domain";
import { loadPersistedLabResult } from "./persisted-lab-result-client";
import { getPersistedLabResultView, type PersistedLabResultState } from "./persisted-lab-result-state";

export function usePersistedLabResult(workspaceId: string, workItemId: string | undefined, base: LabResult | undefined, enabled: boolean) {
  const orderId = base?.orderId;
  const encounterId = base?.encounterId;
  const key = `${workspaceId}:${workItemId}:${orderId}:${encounterId}`;
  const [reload, setReload] = useState(0);
  const [state, setState] = useState<PersistedLabResultState>({ key: "", status: "loading" });
  useEffect(() => {
    if (!enabled || !workItemId || !orderId || !encounterId) return;
    const controller = new AbortController();
    void (async () => {
      setState(previous => ({ key, status: "loading", payload: previous.key === key ? previous.payload : undefined }));
      try {
        const reply = await loadPersistedLabResult({ workspaceId, workItemId, orderId, encounterId }, controller.signal);
        if (!reply || controller.signal.aborted) return;
        const { status, payload } = reply;
        setState(previous => ({ key, status, payload: status === "error" && previous.key === key
          ? previous.payload : status === "permission_denied" ? undefined : payload }));
      } catch {
        if (!controller.signal.aborted) setState(previous => ({ key, status: "error", payload: previous.key === key ? previous.payload : undefined }));
      }
    })();
    return () => controller.abort();
  }, [workspaceId, workItemId, orderId, encounterId, enabled, key, reload]);
  const retry = useCallback(() => setReload(value => value + 1), []);
  return { ...getPersistedLabResultView({ enabled, state, key, base, workspaceId, workItemId }), retry };
}
