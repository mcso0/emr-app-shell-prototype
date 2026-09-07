"use client";

import { useEffect, useState } from "react";
import type { AuthSession } from "@/features/auth/auth-client";
import {
  PERSONAL_PROFILE_STORAGE_EVENT,
  PERSONAL_PROFILE_CHANGED_KEY,
  PERSONAL_PROFILE_STORAGE_KEY,
  createPersonalProfileSession,
  getDefaultSessionPersonalProfile,
  getSessionPersonalProfile,
  readPersonalProfilesState,
  type CurrentPersonalProfile,
} from "@/features/auth/personal-profile-session";

const personalProfileRefreshIntervalMs = 4 * 60 * 1000;

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
  const [browserOverride, setBrowserOverride] = useState<{
    sessionId: string;
    profile: CurrentPersonalProfile;
  } | null>(null);
  const [remoteProfile, setRemoteProfile] = useState<{
    sessionId: string;
    profile: CurrentPersonalProfile;
  } | null>(null);
  const browserProfile =
    browserOverride && session && browserOverride.sessionId === session.id
      ? browserOverride.profile
      : hydrated && session
        ? readBrowserPersonalProfile(session)
        : null;

  useEffect(() => {
    if (!hydrated || !session) return;
    const currentSession = session;

    let active = true;
    let requestVersion = 0;

    async function loadProfile() {
      const version = ++requestVersion;
      if (currentSession.role !== "supabase") return;

      try {
        const response = await fetch("/api/users/me/profile", {
          cache: "no-store",
        });
        const result = (await response.json()) as {
          ok?: boolean;
          profile?: CurrentPersonalProfile;
        };
        if (
          active &&
          version === requestVersion &&
          response.ok &&
          result.ok &&
          isCurrentPersonalProfile(result.profile)
        ) {
          setRemoteProfile({
            sessionId: currentSession.id,
            profile: result.profile,
          });
        }
      } catch {
        // Keep the browser/session fallback when the canonical read is unavailable.
      }
    }

    function handleProfileChange() {
      setRemoteProfile(null);
      setBrowserOverride({
        sessionId: currentSession.id,
        profile: readBrowserPersonalProfile(currentSession),
      });
      void loadProfile();
    }

    function handleStorage(event: StorageEvent) {
      if (event.key === PERSONAL_PROFILE_CHANGED_KEY || event.key === PERSONAL_PROFILE_STORAGE_KEY) handleProfileChange();
    }
    window.addEventListener("storage", handleStorage);
    void loadProfile();
    const refreshInterval =
      currentSession.role === "supabase"
        ? window.setInterval(() => void loadProfile(), personalProfileRefreshIntervalMs)
        : null;
    window.addEventListener(PERSONAL_PROFILE_STORAGE_EVENT, handleProfileChange);
    return () => {
      active = false;
      requestVersion += 1;
      if (refreshInterval) window.clearInterval(refreshInterval);
      window.removeEventListener(PERSONAL_PROFILE_STORAGE_EVENT, handleProfileChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, [hydrated, session]);

  return remoteProfile && session && remoteProfile.sessionId === session.id
    ? remoteProfile.profile
    : browserProfile;
}

function isCurrentPersonalProfile(
  value: CurrentPersonalProfile | undefined,
): value is CurrentPersonalProfile {
  return Boolean(
    value &&
      typeof value.sessionId === "string" &&
      typeof value.displayName === "string" &&
      typeof value.initials === "string" &&
      (typeof value.avatarUrl === "string" || value.avatarUrl === undefined),
  );
}
