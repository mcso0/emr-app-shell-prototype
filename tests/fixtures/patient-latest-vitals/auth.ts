import { useEffect, useRef } from "react";
type Session = { user: { id: string } } | null;
const listeners = new Set<(event: string, session: Session) => void>();
export function useMockAuthStore<T>(selector: (state: { session: { id: string } }) => T) {
  const actor = (window as unknown as { syntheticActor: string }).syntheticActor;
  const previous = useRef(actor);
  useEffect(() => { if (previous.current !== actor) { previous.current = actor; listeners.forEach(listener => listener("SIGNED_IN", { user: { id: actor } })); } }, [actor]);
  return selector({ session: { id: actor } });
}
export function getAuthRuntimeMode() { return { authProvider: (window as unknown as { syntheticLive: boolean }).syntheticLive ? "supabase" : "mock" }; }
export function getBrowserSupabaseClient() {
  return { auth: { onAuthStateChange(listener: (event: string, session: Session) => void) {
    listeners.add(listener);
    if (!(window as unknown as { syntheticDelayAuth: boolean }).syntheticDelayAuth) queueMicrotask(() => { if (listeners.has(listener)) listener("INITIAL_SESSION", { user: { id: (window as unknown as { syntheticActor: string }).syntheticActor } }); });
    Object.assign(window, { emitAuth: (event: string, actor: string | null) => listeners.forEach(callback => callback(event, actor ? { user: { id: actor } } : null)) });
    return { data: { subscription: { unsubscribe: () => listeners.delete(listener) } } };
  } } };
}
