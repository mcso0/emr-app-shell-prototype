"use client";

import { useEffect, useState } from "react";
import {
  DEMO_WORKSPACE_DISPLAY_NAME,
  getSessionWorkspaceDisplayName,
  SESSION_WORKSPACES_STORAGE_KEY,
} from "@/features/auth/workspace-session";

export function useSessionWorkspaceDisplayName(workspaceId: string) {
  const [displayName, setDisplayName] = useState(() =>
    workspaceId ? workspaceId : DEMO_WORKSPACE_DISPLAY_NAME
  );

  useEffect(() => {
    let ignore = false;

    function syncDisplayName() {
      setDisplayName(
        getSessionWorkspaceDisplayName(workspaceId, window.sessionStorage, window.localStorage)
      );
    }

    async function syncPersistedDisplayName() {
      try {
        const response = await fetch("/api/workspaces");
        if (!response.ok) return;
        const result = (await response.json()) as {
          ok?: boolean;
          workspaces?: Array<{ id?: unknown; displayName?: unknown }>;
        };
        const workspace = result.workspaces?.find((item) => item.id === workspaceId);

        if (!ignore && typeof workspace?.displayName === "string") {
          setDisplayName(workspace.displayName);
        }
      } catch {
        // Keep browser-state fallback for mock/demo and offline local use.
      }
    }

    syncDisplayName();
    void syncPersistedDisplayName();
    window.addEventListener("storage", syncDisplayName);
    window.addEventListener(SESSION_WORKSPACES_STORAGE_KEY, syncDisplayName);

    return () => {
      ignore = true;
      window.removeEventListener("storage", syncDisplayName);
      window.removeEventListener(SESSION_WORKSPACES_STORAGE_KEY, syncDisplayName);
    };
  }, [workspaceId]);

  return displayName;
}
