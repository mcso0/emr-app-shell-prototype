"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useAuthClient } from "@/features/auth/auth-client";

type QueueView = "lab" | "imaging" | "dispensing";
const changeEvent = "clair:queue-view-changed";
const transientChoices = new Map<string, boolean>();
const defaultView = () => true;

function subscribe(notify: () => void) {
  window.addEventListener("storage", notify);
  window.addEventListener(changeEvent, notify);
  return () => {
    window.removeEventListener("storage", notify);
    window.removeEventListener(changeEvent, notify);
  };
}

// `true` preserves the existing highlighted toggle and patient-grouped display.
export function useQueueViewPreference(workspaceId: string | undefined, queue: QueueView) {
  const { session, hydrate } = useAuthClient();
  useEffect(() => { if (workspaceId) hydrate(); }, [hydrate, workspaceId]);
  const actorId = session?.role === "supabase" ? session.userId : session?.id;
  const key = workspaceId && actorId
    ? `clair.queue-view.v1:${JSON.stringify([actorId, workspaceId, queue])}`
    : null;
  const read = useCallback(() => {
    if (!key) return true;
    if (transientChoices.has(key)) return transientChoices.get(key)!;
    try {
      const stored = window.localStorage.getItem(key);
      if (stored === "true" || stored === "false") return stored === "true";
    } catch { /* Storage may be unavailable; switching still works in this visit. */ }
    return transientChoices.get(key) ?? true;
  }, [key]);
  const active = useSyncExternalStore(subscribe, read, defaultView);
  const setActive = useCallback((update: (current: boolean) => boolean) => {
    if (!key) return;
    const next = update(read());
    try {
      window.localStorage.setItem(key, String(next));
      transientChoices.delete(key);
    } catch { transientChoices.set(key, next); }
    window.dispatchEvent(new Event(changeEvent));
  }, [key, read]);
  return [active, setActive, Boolean(key)] as const;
}
