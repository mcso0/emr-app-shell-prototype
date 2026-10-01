"use client";

import { useSyncExternalStore } from "react";
import { useMockAuthStore } from "@/features/auth/session-store";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";
import { getAuthRuntimeMode } from "@/lib/supabase/config";

let actorScope: string | null = null;
let authEpoch = 0;
let unsubscribe: (() => void) | undefined;
const listeners = new Set<() => void>();
const getSnapshot = () => actorScope;
const getServerSnapshot = () => null;
const noopSubscribe = () => () => {};

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!unsubscribe) {
    const client = getBrowserSupabaseClient();
    if (client) {
      const { data } = client.auth.onAuthStateChange((event, session) => {
        if (event === "SIGNED_OUT") authEpoch++;
        actorScope = JSON.stringify([session?.user.id ?? "signed-out", authEpoch]);
        listeners.forEach(notify => notify());
      });
      unsubscribe = () => data.subscription.unsubscribe();
    } else {
      actorScope = "unconfigured";
      listener();
    }
  }
  return () => {
    listeners.delete(listener);
    queueMicrotask(() => {
      if (listeners.size) return;
      unsubscribe?.();
      unsubscribe = undefined;
      actorScope = null;
    });
  };
}

export function usePatientVitalActorScope() {
  const mockSessionId = useMockAuthStore(state => state.session?.id ?? "signed-out");
  const live = getAuthRuntimeMode().authProvider === "supabase";
  const liveScope = useSyncExternalStore(live ? subscribe : noopSubscribe, getSnapshot, getServerSnapshot);
  // INITIAL_SESSION supplies the cookie-backed actor before any shared read.
  // Token refreshes for the same actor do not cause new clinical reads.
  return live ? liveScope : `mock:${mockSessionId}`;
}
