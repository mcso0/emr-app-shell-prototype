"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuthClient } from "@/features/auth/auth-client";
import {
  SESSION_WORKSPACES_STORAGE_KEY,
  createEmptySessionWorkspacesState,
  persistSessionWorkspacesState,
  readSessionWorkspacesState,
  type SessionWorkspacesState,
} from "@/features/auth/workspace-session";

function readBrowserWorkspaceState() {
  if (typeof window === "undefined") return createEmptySessionWorkspacesState();

  return (
    readSessionWorkspacesState(window.sessionStorage, window.localStorage) ??
    createEmptySessionWorkspacesState()
  );
}

export function useWorkspaceRoleState(workspaceId: string) {
  const { hydrated, hydrate, session } = useAuthClient();
  const [state, setState] = useState<SessionWorkspacesState>(readBrowserWorkspaceState);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const reload = useCallback(() => {
    setState(readBrowserWorkspaceState());
  }, []);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === SESSION_WORKSPACES_STORAGE_KEY) reload();
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener("clair.sessionWorkspaces.v1", reload);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("clair.sessionWorkspaces.v1", reload);
    };
  }, [reload]);

  const updateState = useCallback(
    (nextState: SessionWorkspacesState) => {
      setState(nextState);
      if (!session) return;

      persistSessionWorkspacesState(
        nextState,
        session.storageMode,
        window.sessionStorage,
        window.localStorage
      );
      window.dispatchEvent(new Event("clair.sessionWorkspaces.v1"));
    },
    [session]
  );

  const canManage = session?.role === "hospital_admin" || session?.role === "supabase";

  return {
    state,
    updateState,
    hydrated,
    canView: Boolean(session),
    canManage,
    workspaceId,
  };
}
