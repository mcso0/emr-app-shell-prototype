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
    function syncDisplayName() {
      setDisplayName(
        getSessionWorkspaceDisplayName(workspaceId, window.sessionStorage, window.localStorage)
      );
    }

    syncDisplayName();
    window.addEventListener("storage", syncDisplayName);
    window.addEventListener(SESSION_WORKSPACES_STORAGE_KEY, syncDisplayName);

    return () => {
      window.removeEventListener("storage", syncDisplayName);
      window.removeEventListener(SESSION_WORKSPACES_STORAGE_KEY, syncDisplayName);
    };
  }, [workspaceId]);

  return displayName;
}
