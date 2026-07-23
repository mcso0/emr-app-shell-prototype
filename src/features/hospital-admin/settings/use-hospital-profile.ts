"use client";

import { useCallback, useEffect } from "react";

import { useMockAuthStore } from "@/features/auth/session-store";
import type { HospitalProfile } from "@/features/hospital-admin/settings/hospital-profile-model";
import { useHospitalBasicSettingsStore } from "@/features/hospital-admin/settings/hospital-basic-settings-store";

const emptyProfileState = {
  status: "idle" as const,
  profile: null,
};

export function useHospitalProfile(workspaceId: string) {
  const session = useMockAuthStore((state) => state.session);
  const demoActorId =
    session?.role === "hospital_admin" ? "user-admin" : session?.id;
  const state = useHospitalBasicSettingsStore(
    (store) => store.profiles[workspaceId] ?? emptyProfileState
  );
  const hydrateProfile = useHospitalBasicSettingsStore(
    (store) => store.hydrateProfile
  );
  const setProfileReadStatus = useHospitalBasicSettingsStore(
    (store) => store.setProfileReadStatus
  );

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setProfileReadStatus(workspaceId, "loading");
      try {
        const response = await fetch(
          `/api/workspaces/${encodeURIComponent(
            workspaceId
          )}/hospital-admin/settings/profile`,
          {
            cache: "no-store",
            signal,
            headers: demoActorId
              ? { "x-clair-demo-session-user-id": demoActorId }
              : undefined,
          }
        );
        const body = (await response.json()) as {
          ok?: boolean;
          profile?: HospitalProfile;
        };
        if (!response.ok || !body.ok || !body.profile) {
          setProfileReadStatus(
            workspaceId,
            response.status === 401 || response.status === 403
              ? "denied"
              : "error"
          );
          return;
        }
        hydrateProfile(workspaceId, body.profile);
      } catch (error) {
        if ((error as { name?: string }).name !== "AbortError") {
          setProfileReadStatus(workspaceId, "error");
        }
      }
    },
    [
      demoActorId,
      hydrateProfile,
      setProfileReadStatus,
      workspaceId,
    ]
  );

  useEffect(() => {
    const currentStatus =
      useHospitalBasicSettingsStore.getState().profiles[workspaceId]?.status ??
      "idle";
    if (currentStatus === "ready") return;
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load, workspaceId]);

  return { ...state, demoActorId, reload: load };
}
