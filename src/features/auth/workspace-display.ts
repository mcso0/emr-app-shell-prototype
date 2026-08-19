"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DEMO_WORKSPACE_DISPLAY_NAME,
  getSessionWorkspaceDisplayName,
  getSessionWorkspaceRoleLabels,
  readSessionWorkspacesState,
  SESSION_WORKSPACES_STORAGE_KEY,
  type SessionWorkspaceRole,
} from "@/features/auth/workspace-session";
import { mapActiveWorkspaceListData } from "@/features/auth/server-workspace-list-core";

export type WorkspaceListOption = {
  id: string;
  displayName: string;
  membershipId: string | null;
  roles: SessionWorkspaceRole[];
  status: "active";
};

export type WorkspaceListRequestState = "idle" | "loading" | "ready" | "error";

type UseSessionWorkspaceListOptions = {
  enabled: boolean;
  userSessionId: string | null;
  workspaceId: string;
};

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

export function useSessionWorkspaceList({
  enabled,
  userSessionId,
  workspaceId,
}: UseSessionWorkspaceListOptions) {
  const [reloadKey, setReloadKey] = useState(0);
  const [requestState, setRequestState] =
    useState<WorkspaceListRequestState>("idle");
  const [workspaces, setWorkspaces] = useState<WorkspaceListOption[]>(() => [
    createCurrentWorkspaceFallback(workspaceId),
  ]);

  useEffect(() => {
    if (!enabled) return;

    const browserWorkspaces = readBrowserWorkspaceOptions({
      userSessionId,
      workspaceId,
    });
    const controller = new AbortController();
    let ignore = false;

    void Promise.resolve()
      .then(() => {
        if (ignore) return null;
        setWorkspaces(browserWorkspaces);
        setRequestState("loading");
        return fetch("/api/workspaces", { signal: controller.signal });
      })
      .then(async (response) => {
        if (!response) return null;
        if (!response.ok) throw new Error("workspace-list-unavailable");

        const result = (await response.json()) as {
          ok?: boolean;
          workspaces?: unknown;
        };

        if (!result.ok || !Array.isArray(result.workspaces)) {
          throw new Error("workspace-list-invalid");
        }

        return mapActiveWorkspaceListData(result.workspaces);
      })
      .then((persistedWorkspaces) => {
        if (ignore || !persistedWorkspaces) return;

        setWorkspaces(
          mergeWorkspaceOptions({
            browserWorkspaces,
            persistedWorkspaces,
            workspaceId,
          })
        );
        setRequestState("ready");
      })
      .catch((error: unknown) => {
        if (ignore || (error instanceof DOMException && error.name === "AbortError")) return;
        setRequestState("error");
      });

    return () => {
      ignore = true;
      controller.abort();
    };
  }, [enabled, reloadKey, userSessionId, workspaceId]);

  const reload = useCallback(() => {
    setReloadKey((key) => key + 1);
  }, []);

  return { reload, requestState, workspaces };
}

export function getWorkspaceListOptionRoleLabel(workspace: WorkspaceListOption) {
  return workspace.roles.length > 0
    ? getSessionWorkspaceRoleLabels(workspace.roles)
    : "활성 워크스페이스";
}

function readBrowserWorkspaceOptions({
  userSessionId,
  workspaceId,
}: {
  userSessionId: string | null;
  workspaceId: string;
}) {
  const state = readSessionWorkspacesState(window.sessionStorage, window.localStorage);
  const options = new Map<string, WorkspaceListOption>();

  if (state && userSessionId) {
    state.memberships.forEach((membership) => {
      if (membership.userSessionId !== userSessionId || membership.status !== "active") return;

      const workspace = state.workspaces.find((item) => item.id === membership.workspaceId);
      if (!workspace) return;

      options.set(workspace.id, {
        id: workspace.id,
        displayName: workspace.displayName,
        membershipId: membership.id,
        roles: membership.roles,
        status: "active",
      });
    });
  }

  if (!options.has(workspaceId)) {
    const currentMembership = state?.memberships.find(
      (membership) =>
        membership.workspaceId === workspaceId &&
        membership.userSessionId === userSessionId &&
        membership.status === "active"
    );

    options.set(workspaceId, {
      ...createCurrentWorkspaceFallback(workspaceId),
      roles: currentMembership?.roles ?? [],
      membershipId: currentMembership?.id ?? null,
    });
  }

  return sortWorkspaceOptions([...options.values()], workspaceId);
}

function createCurrentWorkspaceFallback(workspaceId: string): WorkspaceListOption {
  return {
    id: workspaceId,
    displayName:
      typeof window === "undefined"
        ? workspaceId || DEMO_WORKSPACE_DISPLAY_NAME
        : getSessionWorkspaceDisplayName(
            workspaceId,
            window.sessionStorage,
            window.localStorage
          ),
    membershipId: null,
    roles: [],
    status: "active",
  };
}

function mergeWorkspaceOptions({
  browserWorkspaces,
  persistedWorkspaces,
  workspaceId,
}: {
  browserWorkspaces: WorkspaceListOption[];
  persistedWorkspaces: ReturnType<typeof mapActiveWorkspaceListData>;
  workspaceId: string;
}) {
  const merged = new Map<string, WorkspaceListOption>();

  browserWorkspaces.forEach((workspace) => merged.set(workspace.id, workspace));
  persistedWorkspaces.forEach((workspace) => {
    merged.set(workspace.id, workspace);
  });

  if (!merged.has(workspaceId)) {
    merged.set(workspaceId, createCurrentWorkspaceFallback(workspaceId));
  }

  return sortWorkspaceOptions([...merged.values()], workspaceId);
}

function sortWorkspaceOptions(workspaces: WorkspaceListOption[], workspaceId: string) {
  return workspaces.sort((left, right) => {
    if (left.id === workspaceId) return -1;
    if (right.id === workspaceId) return 1;
    return left.displayName.localeCompare(right.displayName, "ko");
  });
}
