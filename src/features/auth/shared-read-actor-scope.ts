"use client";

import { useSyncExternalStore } from "react";
import type { AuthSession } from "@/features/auth/auth-client";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";
import { getAuthRuntimeMode } from "@/lib/supabase/config";

let actorScope: string | null = null;
let authEpoch = 0;
let stop: (() => void) | undefined;
const listeners = new Set<() => void>();
export const getSharedReadActorScope = () => actorScope;
const serverSnapshot = () => null;
const noSubscription = () => () => {};
function publish(userId: string | undefined) {
  actorScope = userId ? JSON.stringify([userId, authEpoch]) : null;
  listeners.forEach(notify => notify());
}
export function subscribeSharedReadActorScope(listener: () => void) {
  listeners.add(listener);
  if (!stop) {
    let active = true;
    const client = getBrowserSupabaseClient();
    const ended = () => { authEpoch++; publish(undefined); };
    window.addEventListener("clair:session-ended", ended);
    const subscription = client?.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "SIGNED_OUT") authEpoch++;
      publish(session?.user.id);
    });
    stop = () => {
      active = false;
      subscription?.data.subscription.unsubscribe();
      window.removeEventListener("clair:session-ended", ended);
    };
  }
  return () => {
    listeners.delete(listener);
    queueMicrotask(() => {
      if (listeners.size) return;
      stop?.();
      stop = undefined;
      actorScope = null;
    });
  };
}
export function useSharedReadActorScope(session: AuthSession | null) {
  const live = getAuthRuntimeMode().authProvider === "supabase";
  const scope = useSyncExternalStore(live ? subscribeSharedReadActorScope : noSubscription, getSharedReadActorScope, serverSnapshot);
  // INITIAL_SESSION identifies the cookie-backed actor before shared live reads.
  // A token refresh does not replace the same actor's mounted resource.
  if (!live) return JSON.stringify([session?.role, session?.id]);
  // A stale caller session must not be rebound to a different live actor.
  if (scope && session && "userId" in session && JSON.parse(scope)[0] !== session.userId) return null;
  return scope;
}
