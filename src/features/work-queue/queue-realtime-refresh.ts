"use client";

import { useEffect, useRef } from "react";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";

type UseQueueRealtimeRefreshOptions = {
  debounceMs?: number;
  enabled?: boolean;
  onQueueChange: () => Promise<void> | void;
  scopeKey?: string;
  workspaceId: string;
};

export function getQueueRealtimeTopic(workspaceId: string) {
  return `workspace:${workspaceId}:queue`;
}

export function useQueueRealtimeRefresh({
  debounceMs = 400,
  enabled = true,
  onQueueChange,
  scopeKey = "queue",
  workspaceId,
}: UseQueueRealtimeRefreshOptions) {
  const onQueueChangeRef = useRef(onQueueChange);

  useEffect(() => {
    onQueueChangeRef.current = onQueueChange;
  }, [onQueueChange]);

  useEffect(() => {
    if (!enabled || !workspaceId) return;

    return subscribeQueueRealtimeRefresh({
      debounceMs,
      onQueueChange: () => onQueueChangeRef.current(),
      workspaceId,
    });
  }, [debounceMs, enabled, scopeKey, workspaceId]);
}

// A shared read resource can own the same subscription lifecycle as a component.
export function subscribeQueueRealtimeRefresh({
  debounceMs = 400,
  onQueueChange,
  workspaceId,
}: Pick<UseQueueRealtimeRefreshOptions, "debounceMs" | "onQueueChange" | "workspaceId">) {
  const supabase = getBrowserSupabaseClient();
  if (!supabase) return;
  const supabaseClient = supabase;

  let disposed = false;
  let refreshInFlight = false;
  let pendingAfterFlight = false;
  let refreshTimer: ReturnType<typeof setTimeout> | undefined;
  const topic = getQueueRealtimeTopic(workspaceId);

  const runRefresh = async () => {
    if (refreshInFlight) {
      pendingAfterFlight = true;
      return;
    }

    refreshInFlight = true;
    try {
      await onQueueChange();
    } finally {
      refreshInFlight = false;
      if (!disposed && pendingAfterFlight) {
        pendingAfterFlight = false;
        scheduleRefresh();
      }
    }
  };

  const scheduleRefresh = () => {
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      refreshTimer = undefined;
      void runRefresh();
    }, debounceMs);
  };

  const channel = supabaseClient.channel(topic, {
    config: { private: true },
  });

  async function subscribe() {
    const { data } = await supabaseClient.auth.getSession();
    await supabaseClient.realtime.setAuth(data.session?.access_token ?? null);

    if (disposed) return;

    channel
      .on("broadcast", { event: "queue_changed" }, () => {
        scheduleRefresh();
      })
      .subscribe();
  }

  void subscribe();

  return () => {
    disposed = true;
    if (refreshTimer) clearTimeout(refreshTimer);
    void supabaseClient.removeChannel(channel);
  };
}
