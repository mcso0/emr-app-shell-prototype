"use client";

import { useEffect, useRef } from "react";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";

const chartBillingSummaryRealtimeEvent = "billing_summary_changed";
const chartBillingSummaryRealtimeVersion = 1;
const chartBillingSummaryEtagPattern = /^"[0-9a-f]{64}"$/i;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const allowedPayloadKeys = new Set([
  "workspaceId",
  "encounterId",
  "etag",
  "transactionId",
  "occurredAt",
  "version",
]);

export type ChartBillingSummaryRealtimePayload = {
  encounterId: string;
  etag?: string;
  occurredAt: string;
  transactionId: string;
  version: 1;
  workspaceId: string;
};

type UseChartBillingSummaryRealtimeOptions = {
  currentEtag?: string;
  debounceMs?: number;
  encounterId: string;
  hasUnsavedEdits: boolean;
  mutationInFlight: boolean;
  onInvalidated: () => Promise<boolean | void> | boolean | void;
  workspaceId: string;
};

type ChartBillingSummaryRealtimeCoordinatorOptions = {
  debounceMs?: number;
  getCurrentEtag: () => string | undefined;
  isRefreshBlocked: () => boolean;
  onInvalidated: () => Promise<boolean | void> | boolean | void;
};

export function getChartBillingSummaryRealtimeTopic(
  workspaceId: string,
  encounterId: string,
) {
  return `workspace:${workspaceId}:encounter:${encounterId}:billing-summary`;
}

export function parseChartBillingSummaryRealtimePayload(
  value: unknown,
  expectedScope: { encounterId: string; workspaceId: string },
): ChartBillingSummaryRealtimePayload | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const payload = value as Record<string, unknown>;
  if (Object.keys(payload).some((key) => !allowedPayloadKeys.has(key))) {
    return null;
  }
  if (
    payload.version !== chartBillingSummaryRealtimeVersion ||
    typeof payload.workspaceId !== "string" ||
    payload.workspaceId.length === 0 ||
    payload.workspaceId.length > 128 ||
    payload.workspaceId !== expectedScope.workspaceId ||
    typeof payload.encounterId !== "string" ||
    !uuidPattern.test(payload.encounterId) ||
    payload.encounterId !== expectedScope.encounterId ||
    typeof payload.transactionId !== "string" ||
    payload.transactionId.length === 0 ||
    payload.transactionId.length > 128 ||
    typeof payload.occurredAt !== "string" ||
    payload.occurredAt.length === 0 ||
    payload.occurredAt.length > 64 ||
    Number.isNaN(Date.parse(payload.occurredAt)) ||
    (payload.etag !== undefined &&
      (typeof payload.etag !== "string" ||
        !chartBillingSummaryEtagPattern.test(payload.etag)))
  ) {
    return null;
  }

  return {
    encounterId: payload.encounterId,
    etag: payload.etag as string | undefined,
    occurredAt: payload.occurredAt,
    transactionId: payload.transactionId,
    version: chartBillingSummaryRealtimeVersion,
    workspaceId: payload.workspaceId,
  };
}

export function createChartBillingSummaryRealtimeCoordinator({
  debounceMs = 300,
  getCurrentEtag,
  isRefreshBlocked,
  onInvalidated,
}: ChartBillingSummaryRealtimeCoordinatorOptions) {
  let disposed = false;
  let refreshInFlight = false;
  let refreshTimer: ReturnType<typeof setTimeout> | undefined;
  let pendingHasUnknownEtag = false;
  const pendingEtags = new Set<string>();
  const recentTransactionIds = new Set<string>();

  const hasPendingEvent = () => pendingHasUnknownEtag || pendingEtags.size > 0;
  const clearPendingEvents = () => {
    pendingHasUnknownEtag = false;
    pendingEtags.clear();
  };
  const pendingMatchesCurrentSummary = () => {
    const currentEtag = getCurrentEtag();
    return (
      !pendingHasUnknownEtag &&
      pendingEtags.size === 1 &&
      Boolean(currentEtag) &&
      pendingEtags.has(currentEtag as string)
    );
  };

  const runRefresh = async () => {
    if (disposed || !hasPendingEvent() || isRefreshBlocked()) return;
    if (pendingMatchesCurrentSummary()) {
      clearPendingEvents();
      return;
    }
    if (refreshInFlight) return;

    clearPendingEvents();
    refreshInFlight = true;
    try {
      await onInvalidated();
    } finally {
      refreshInFlight = false;
      if (!disposed && hasPendingEvent() && !isRefreshBlocked()) {
        scheduleRefresh();
      }
    }
  };

  const scheduleRefresh = () => {
    if (disposed || !hasPendingEvent() || isRefreshBlocked()) return;
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      refreshTimer = undefined;
      void runRefresh();
    }, debounceMs);
  };

  return {
    dispose() {
      disposed = true;
      if (refreshTimer) clearTimeout(refreshTimer);
    },
    flush() {
      scheduleRefresh();
    },
    handle(payload: ChartBillingSummaryRealtimePayload) {
      if (disposed || recentTransactionIds.has(payload.transactionId)) return;

      recentTransactionIds.add(payload.transactionId);
      if (recentTransactionIds.size > 100) {
        const oldestTransactionId = recentTransactionIds.values().next().value;
        if (oldestTransactionId) {
          recentTransactionIds.delete(oldestTransactionId);
        }
      }
      if (payload.etag === getCurrentEtag()) return;

      if (payload.etag) pendingEtags.add(payload.etag);
      else pendingHasUnknownEtag = true;
      scheduleRefresh();
    },
  };
}

export function useChartBillingSummaryRealtime({
  currentEtag,
  debounceMs = 300,
  encounterId,
  hasUnsavedEdits,
  mutationInFlight,
  onInvalidated,
  workspaceId,
}: UseChartBillingSummaryRealtimeOptions) {
  const currentEtagRef = useRef(currentEtag);
  const hasUnsavedEditsRef = useRef(hasUnsavedEdits);
  const mutationInFlightRef = useRef(mutationInFlight);
  const onInvalidatedRef = useRef(onInvalidated);
  const flushPendingRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    currentEtagRef.current = currentEtag;
    hasUnsavedEditsRef.current = hasUnsavedEdits;
    mutationInFlightRef.current = mutationInFlight;
    onInvalidatedRef.current = onInvalidated;
  }, [currentEtag, hasUnsavedEdits, mutationInFlight, onInvalidated]);

  useEffect(() => {
    if (!hasUnsavedEdits && !mutationInFlight) {
      flushPendingRef.current();
    }
  }, [currentEtag, hasUnsavedEdits, mutationInFlight]);

  useEffect(() => {
    if (!workspaceId || !uuidPattern.test(encounterId)) return;

    const supabase = getBrowserSupabaseClient();
    if (!supabase) return;
    const supabaseClient = supabase;

    let disposed = false;
    const topic = getChartBillingSummaryRealtimeTopic(workspaceId, encounterId);
    const coordinator = createChartBillingSummaryRealtimeCoordinator({
      debounceMs,
      getCurrentEtag: () => currentEtagRef.current,
      isRefreshBlocked: () =>
        hasUnsavedEditsRef.current || mutationInFlightRef.current,
      onInvalidated: () => onInvalidatedRef.current(),
    });

    flushPendingRef.current = coordinator.flush;

    const channel = supabaseClient.channel(topic, {
      config: { private: true },
    });

    async function subscribe() {
      try {
        const { data } = await supabaseClient.auth.getSession();
        await supabaseClient.realtime.setAuth(
          data.session?.access_token ?? null,
        );
        if (disposed) return;

        channel
          .on(
            "broadcast",
            { event: chartBillingSummaryRealtimeEvent },
            (message) => {
              const payload = parseChartBillingSummaryRealtimePayload(
                message.payload,
                { encounterId, workspaceId },
              );
              if (!payload) return;
              coordinator.handle(payload);
            },
          )
          .subscribe();
      } catch {
        // Focus and visibility revalidation remain the safe fallback.
      }
    }

    void subscribe();

    return () => {
      disposed = true;
      flushPendingRef.current = () => undefined;
      coordinator.dispose();
      void supabaseClient.removeChannel(channel);
    };
  }, [debounceMs, encounterId, workspaceId]);
}
