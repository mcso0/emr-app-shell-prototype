"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useQueueRealtimeRefresh } from "@/features/work-queue/queue-realtime-refresh";
import { useAuthClient } from "@/features/auth/auth-client";
import { getDemoActorHeaders } from "@/features/auth/demo-actor";
import { useSharedReadActorScope } from "@/features/auth/shared-read-actor-scope";
import type { BillingAssignment } from "./assignment";
import { getBillingAssignmentScope, subscribeBillingAssignment } from "./billing-assignment-resource";

export function useBillingAssignment(workspaceId: string | undefined, requestedInvoiceId: string | undefined) {
  // Candidate-only invoices are display models, not persisted assignment targets.
  const invoiceId = requestedInvoiceId?.startsWith("invoice-live-") ? undefined : requestedInvoiceId;
  const { session } = useAuthClient();
  const actorScope = useSharedReadActorScope(session);
  const key = workspaceId && invoiceId && actorScope ? getBillingAssignmentScope(workspaceId, invoiceId, session, actorScope) : "";
  const subscription = useRef<ReturnType<typeof subscribeBillingAssignment> & { key: string } | null>(null);
  const [state, setState] = useState<{ key: string; data: BillingAssignment | null }>({ key: "", data: null });
  const refresh = useCallback(async () => {
    if (subscription.current?.key === key) await subscription.current.resource.refresh();
  }, [key]);
  useEffect(() => {
    if (!workspaceId || !invoiceId || !actorScope) return;
    const active = { ...subscribeBillingAssignment({ workspaceId, invoiceId, session, actorScope, listener: data => setState({ key, data }) }), key };
    subscription.current = active;
    return () => {
      if (subscription.current === active) subscription.current = null;
      active.unsubscribe();
    };
    // The stable key includes the request actor, rather than auth object identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const refreshAfterQueueChange = useCallback(async () => {
    if (subscription.current?.key === key) await subscription.current.resource.invalidate();
  }, [key]);
  useQueueRealtimeRefresh({ workspaceId: workspaceId ?? "", enabled: Boolean(invoiceId), scopeKey: `billing-owner:${invoiceId}`, onQueueChange: refreshAfterQueueChange });
  const data = state.key === key ? state.data : null;
  const transition = async (action: "claim" | "assign" | "unassign", assignedToUserId?: string | null) => {
    const active = subscription.current;
    if (!data?.canManage || !invoiceId || !workspaceId || active?.key !== key || active.resource.isDisposed()) return false;
    try {
      const response = await fetch(`/api/workspaces/${encodeURIComponent(workspaceId)}/billing/assignment`, {
        method: "PATCH", headers: { "content-type": "application/json", ...getDemoActorHeaders(session) },
        body: JSON.stringify({ invoiceId, action, assignedToUserId, expectedRevision: data.revision }),
      });
      if (subscription.current !== active || active.resource.isDisposed()) return false;
      // Start a new read after PATCH, never reuse a pre-mutation automatic read.
      // Dispatch before it settles so every consumer shares this newer read.
      const refreshed = active.resource.refresh(true);
      window.dispatchEvent(new Event("clair-billing-assignment"));
      await refreshed;
      return subscription.current === active && !active.resource.isDisposed() && response.ok;
    } catch {
      if (subscription.current === active && !active.resource.isDisposed()) await active.resource.refresh(true);
      return false;
    }
  };
  return { data, canExecute: Boolean(data?.canManage && data.assignedToUserId), transition, refresh };
}
