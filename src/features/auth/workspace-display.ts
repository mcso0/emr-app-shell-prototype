"use client";

import { useEffect, useState } from "react";
import {
  DEMO_WORKSPACE_DISPLAY_NAME,
  getSessionWorkspaceDisplayName,
  SESSION_WORKSPACES_STORAGE_KEY,
} from "@/features/auth/workspace-session";

export const WORKSPACE_IDENTITY_CHANGED_EVENT =
  "clair.workspaceIdentity.changed";

type WorkspaceIdentity = {
  displayName: string;
  logoRevision: number | null;
  logoUrl: string | null;
};

export function notifyWorkspaceIdentityChanged(workspaceId: string) {
  window.dispatchEvent(
    new CustomEvent(WORKSPACE_IDENTITY_CHANGED_EVENT, {
      detail: { workspaceId },
    })
  );
}

export function useSessionWorkspaceIdentity(workspaceId: string) {
  const [identity, setIdentity] = useState<WorkspaceIdentity>(() => ({
    displayName: workspaceId ? workspaceId : DEMO_WORKSPACE_DISPLAY_NAME,
    logoRevision: null,
    logoUrl: null,
  }));

  useEffect(() => {
    let ignore = false;

    function syncDisplayName() {
      setIdentity((current) => ({
        ...current,
        displayName: getSessionWorkspaceDisplayName(
          workspaceId,
          window.sessionStorage,
          window.localStorage
        ),
      }));
    }

    async function syncPersistedDisplayName() {
      try {
        const response = await fetch("/api/workspaces");
        if (!response.ok) return;
        const result = (await response.json()) as {
          ok?: boolean;
          workspaces?: Array<{
            id?: unknown;
            displayName?: unknown;
            logo?: { revision?: unknown; url?: unknown };
          }>;
        };
        const workspace = result.workspaces?.find((item) => item.id === workspaceId);

        if (!ignore && typeof workspace?.displayName === "string") {
          setIdentity({
            displayName: workspace.displayName,
            logoRevision: Number.isSafeInteger(workspace.logo?.revision)
              ? Number(workspace.logo?.revision)
              : null,
            logoUrl:
              typeof workspace.logo?.url === "string"
                ? workspace.logo.url
                : null,
          });
        }
      } catch {
        // Keep browser-state fallback for mock/demo and offline local use.
      }
    }

    syncDisplayName();
    void syncPersistedDisplayName();
    const syncChangedWorkspace = (event: Event) => {
      const changedWorkspaceId =
        event instanceof CustomEvent &&
        typeof event.detail?.workspaceId === "string"
          ? event.detail.workspaceId
          : null;
      if (!changedWorkspaceId || changedWorkspaceId === workspaceId) {
        void syncPersistedDisplayName();
      }
    };
    window.addEventListener("storage", syncDisplayName);
    window.addEventListener(SESSION_WORKSPACES_STORAGE_KEY, syncDisplayName);
    window.addEventListener(
      WORKSPACE_IDENTITY_CHANGED_EVENT,
      syncChangedWorkspace
    );

    return () => {
      ignore = true;
      window.removeEventListener("storage", syncDisplayName);
      window.removeEventListener(SESSION_WORKSPACES_STORAGE_KEY, syncDisplayName);
      window.removeEventListener(
        WORKSPACE_IDENTITY_CHANGED_EVENT,
        syncChangedWorkspace
      );
    };
  }, [workspaceId]);

  return identity;
}

export function useSessionWorkspaceDisplayName(workspaceId: string) {
  return useSessionWorkspaceIdentity(workspaceId).displayName;
}
