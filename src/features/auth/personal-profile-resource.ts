"use client";

import type { AuthSession } from "./auth-client";
import {
  PERSONAL_PROFILE_CHANGED_KEY, PERSONAL_PROFILE_STORAGE_EVENT, PERSONAL_PROFILE_STORAGE_KEY,
  type CurrentPersonalProfile,
} from "./personal-profile-session";
import { getSharedReadActorScope, subscribeSharedReadActorScope } from "./shared-read-actor-scope";
import { getAuthRuntimeMode } from "@/lib/supabase/config";
import { createSharedVisibleResource } from "@/lib/visible-refresh";

const resources = new Map<string, ReturnType<typeof createProfileResource>>();
export function getPersonalProfileScope(session: AuthSession, actorScope?: string) {
  return JSON.stringify([actorScope, session.role, session.id, "userId" in session ? session.userId : null]);
}
function createProfileResource(session: AuthSession, actorScope: string | undefined, remove: () => void) {
  return createSharedVisibleResource<CurrentPersonalProfile | null>({
    initialValue: null,
    intervalMs: session.role === "supabase" ? 4 * 60 * 1000 : undefined,
    async load(signal) {
      if (session.role !== "supabase") return undefined;
      try {
        const response = await fetch("/api/users/me/profile", { cache: "no-store", signal });
        const result = await response.json() as { ok?: boolean; profile?: CurrentPersonalProfile };
        const profile = result.profile;
        if (response.ok && result.ok && profile && typeof profile.sessionId === "string"
          && typeof profile.displayName === "string" && typeof profile.initials === "string"
          && (profile.avatarUrl === undefined || typeof profile.avatarUrl === "string")) return profile;
      } catch { /* Preserve the browser/last canonical fallback on read failure. */ }
      return undefined;
    },
    onStart({ refresh, publish, dispose }) {
      const changed = () => { publish(null); void refresh(true); };
      const storage = (event: StorageEvent) => {
        if (event.key === PERSONAL_PROFILE_CHANGED_KEY || event.key === PERSONAL_PROFILE_STORAGE_KEY) changed();
      };
      window.addEventListener(PERSONAL_PROFILE_STORAGE_EVENT, changed);
      window.addEventListener("storage", storage);
      const unsubscribeActor = getAuthRuntimeMode().authProvider === "supabase"
        ? subscribeSharedReadActorScope(() => { if (getSharedReadActorScope() !== actorScope) dispose(); }) : undefined;
      return () => {
        unsubscribeActor?.();
        window.removeEventListener(PERSONAL_PROFILE_STORAGE_EVENT, changed);
        window.removeEventListener("storage", storage);
      };
    },
    onDispose: remove,
  });
}
export function subscribePersonalProfile(session: AuthSession, listener: (profile: CurrentPersonalProfile | null) => void, actorScope?: string) {
  const key = getPersonalProfileScope(session, actorScope);
  let resource = resources.get(key);
  if (!resource) {
    resource = createProfileResource(session, actorScope, () => { if (resources.get(key) === resource) resources.delete(key); });
    resources.set(key, resource);
  }
  return resource.subscribe(listener);
}
