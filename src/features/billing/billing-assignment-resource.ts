"use client";

import type { AuthSession } from "@/features/auth/auth-client";
import { getDemoActorHeaders } from "@/features/auth/demo-actor";
import { getSharedReadActorScope, subscribeSharedReadActorScope } from "@/features/auth/shared-read-actor-scope";
import { getAuthRuntimeMode } from "@/lib/supabase/config";
import { createSharedVisibleResource } from "@/lib/visible-refresh";
import { parseBillingAssignment, type BillingAssignment } from "./assignment";
import { useBillingStore } from "./store";

// Only the resource that last published an invoice may clear its UI mirror.
const invoicePublishers = new Map<string, symbol>();
const resources = new Map<string, ReturnType<typeof createBillingResource>>();
export function getBillingAssignmentScope(workspaceId: string, invoiceId: string, session: AuthSession | null, actorScope?: string) {
  return JSON.stringify([workspaceId, invoiceId, actorScope, session?.role, session?.id,
    session && "userId" in session ? session.userId : null, getDemoActorHeaders(session)]);
}
function createBillingResource(workspaceId: string, invoiceId: string, session: AuthSession | null, actorScope: string | undefined, remove: () => void) {
  const publisher = Symbol(invoiceId);
  const clearPublishedAssignee = () => {
    if (invoicePublishers.get(invoiceId) !== publisher) return;
    invoicePublishers.delete(invoiceId);
    useBillingStore.getState().clearInvoiceAssignee(invoiceId);
  };
  const endpoint = `/api/workspaces/${encodeURIComponent(workspaceId)}/billing/assignment`;
  return createSharedVisibleResource<BillingAssignment | null>({
    initialValue: null,
    intervalMs: 10_000,
    async load(signal) {
      try {
        const response = await fetch(`${endpoint}?invoiceId=${encodeURIComponent(invoiceId)}`, {
          cache: "no-store", headers: getDemoActorHeaders(session), signal,
        });
        const body = await response.json();
        return response.ok && body.ok ? parseBillingAssignment(body.assignment) : null;
      } catch { return null; }
    },
    onValue(data) {
      invoicePublishers.set(invoiceId, publisher);
      if (data?.assignedToUserId && data.assignedToDisplayName) {
        useBillingStore.getState().assignInvoice(invoiceId, data.assignedToDisplayName);
      } else useBillingStore.getState().clearInvoiceAssignee(invoiceId);
    },
    onStart({ refresh, dispose }) {
      const ended = () => { clearPublishedAssignee(); dispose(); };
      window.addEventListener("clair:session-ended", ended);
      const changed = () => { void refresh(); };
      window.addEventListener("clair-billing-assignment", changed);
      const unsubscribeActor = getAuthRuntimeMode().authProvider === "supabase"
        ? subscribeSharedReadActorScope(() => { if (getSharedReadActorScope() !== actorScope) ended(); }) : undefined;
      return () => { window.removeEventListener("clair-billing-assignment", changed); window.removeEventListener("clair:session-ended", ended); unsubscribeActor?.(); };
    },
    onDispose() {
      if (invoicePublishers.get(invoiceId) === publisher) invoicePublishers.delete(invoiceId);
      remove();
    },
  });
}
export function subscribeBillingAssignment({ workspaceId, invoiceId, session, actorScope, listener }: {
  workspaceId: string; invoiceId: string; session: AuthSession | null; actorScope?: string;
  listener: (data: BillingAssignment | null) => void;
}) {
  const key = getBillingAssignmentScope(workspaceId, invoiceId, session, actorScope);
  let resource = resources.get(key);
  if (!resource) {
    resource = createBillingResource(workspaceId, invoiceId, session, actorScope, () => { if (resources.get(key) === resource) resources.delete(key); });
    resources.set(key, resource);
  }
  return { resource, unsubscribe: resource.subscribe(listener) };
}
