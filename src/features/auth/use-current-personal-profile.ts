"use client";

import { useEffect, useState } from "react";
import type { AuthSession } from "@/features/auth/auth-client";
import {
  createPersonalProfileSession,
  getDefaultSessionPersonalProfile,
  getSessionPersonalProfile,
  readPersonalProfilesState,
  type CurrentPersonalProfile,
} from "@/features/auth/personal-profile-session";

import { useSharedReadActorScope } from "./shared-read-actor-scope";
import { getPersonalProfileScope, subscribePersonalProfile } from "./personal-profile-resource";

function readBrowserPersonalProfile(session: AuthSession): CurrentPersonalProfile {
  const profileSession = createPersonalProfileSession(session);
  if (typeof window === "undefined") {
    return getDefaultSessionPersonalProfile(profileSession);
  }

  return getSessionPersonalProfile(
    readPersonalProfilesState(window.sessionStorage, window.localStorage),
    profileSession,
  );
}

export function useCurrentPersonalProfile({
  hydrated,
  session,
}: {
  hydrated: boolean;
  session: AuthSession | null;
}) {
  const actorScope = useSharedReadActorScope(session);
  const scope = session && actorScope ? getPersonalProfileScope(session, actorScope) : "";
  const [remote, setRemote] = useState<{ scope: string; profile: CurrentPersonalProfile | null } | null>(null);
  useEffect(() => {
    if (!hydrated || !session || !actorScope) return;
    return subscribePersonalProfile(session, profile => setRemote({ scope, profile }), actorScope);
    // Stable scope intentionally shares reads between independent auth-hook objects.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, scope]);
  if (!hydrated || !session || !actorScope) return null;
  return (remote?.scope === scope ? remote.profile : null) ?? readBrowserPersonalProfile(session);
}
