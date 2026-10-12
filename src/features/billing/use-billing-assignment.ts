"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useQueueRealtimeRefresh } from "@/features/work-queue/queue-realtime-refresh";
import { useAuthClient } from "@/features/auth/auth-client";
import { getDemoActorHeaders } from "@/features/auth/demo-actor";
import { parseBillingAssignment, type BillingAssignment } from "./assignment";
import { useBillingStore } from "./store";

export function useBillingAssignment(workspaceId: string | undefined, invoiceId: string | undefined) {
  const { session } = useAuthClient();
  const actorKey = session && "userId" in session ? session.userId : session?.id ?? "";
  const key = `${workspaceId}:${invoiceId}:${actorKey}`;
  const requestSequence = useRef(0);
  const [state, setState] = useState<{ key: string; data: BillingAssignment | null }>({ key: "", data: null });
  const endpoint = workspaceId ? `/api/workspaces/${encodeURIComponent(workspaceId)}/billing/assignment` : "";
  const refresh = useCallback(async () => {
    if (!workspaceId || !invoiceId) return;
    const seq = ++requestSequence.current;
    try {
      const response = await fetch(`${endpoint}?invoiceId=${encodeURIComponent(invoiceId)}`, { cache: "no-store", headers: getDemoActorHeaders(session) });
      const body = await response.json();
      if (seq !== requestSequence.current) return;
      const data = response.ok && body.ok ? parseBillingAssignment(body.assignment) : null;
      setState({ key, data });
      useBillingStore.getState().assignInvoice(invoiceId, data?.assignedToDisplayName ?? "");
    } catch { if (seq === requestSequence.current) setState({ key, data: null }); }
  }, [endpoint, invoiceId, key, session, workspaceId]);
  useEffect(() => {
    queueMicrotask(() => { void refresh(); });
    const update = () => { void refresh(); };
    window.addEventListener("clair-billing-assignment", update);
    window.addEventListener("focus", update);
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") update(); }, 10000);
    return () => { requestSequence.current += 1; window.clearInterval(timer); window.removeEventListener("clair-billing-assignment", update); window.removeEventListener("focus", update); };
  }, [refresh]);
  useQueueRealtimeRefresh({ workspaceId: workspaceId ?? "", enabled: Boolean(invoiceId), scopeKey: `billing-owner:${invoiceId}`, onQueueChange: refresh });
  const data = state.key === key ? state.data : null;
  const transition = async (action: "claim" | "assign" | "unassign", assignedToUserId?: string | null) => {
    if (!data?.canManage || !invoiceId) return false;
    try {
      const response = await fetch(endpoint, { method: "PATCH", headers: { "content-type": "application/json", ...getDemoActorHeaders(session) }, body: JSON.stringify({ invoiceId, action, assignedToUserId, expectedRevision: data.revision }) });
      await refresh();
      window.dispatchEvent(new Event("clair-billing-assignment"));
      return response.ok;
    } catch { await refresh(); return false; }
  };
  return { data, canExecute: Boolean(data?.canManage && data.assignedToUserId), transition, refresh };
}
