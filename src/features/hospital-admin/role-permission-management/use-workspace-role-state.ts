"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuthClient } from "@/features/auth/auth-client";
import {
  SESSION_WORKSPACES_STORAGE_KEY,
  createEmptySessionWorkspacesState,
  persistSessionWorkspacesState,
  readSessionWorkspacesState,
  type SessionWorkspacesState,
} from "@/features/auth/workspace-session";
import type {
  WorkspaceRoleCatalogMutation,
  WorkspaceRoleCatalogSnapshot,
} from "@/features/auth/server-workspace-role-catalog";
import { getRoleManagementAccess } from "@/features/hospital-admin/role-permission-management/model";
import {
  createWorkspaceRoleCatalogApi,
  type WorkspaceRoleCatalogApi,
} from "@/features/hospital-admin/role-permission-management/server-catalog";

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
  const [catalogSnapshot, setCatalogSnapshot] = useState<WorkspaceRoleCatalogSnapshot | null>(null);
  const [catalogStatus, setCatalogStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const catalogApi = useMemo<WorkspaceRoleCatalogApi>(() => createWorkspaceRoleCatalogApi(), []);
  const usesServerCatalog = session?.role === "supabase";

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const reload = useCallback(() => {
    setState(readBrowserWorkspaceState());
  }, []);

  const reloadCatalog = useCallback(async () => {
    if (!usesServerCatalog) return null;

    setCatalogStatus("loading");
    setCatalogError(null);

    try {
      const snapshot = await catalogApi.load(workspaceId);
      setCatalogSnapshot(snapshot);
      setCatalogStatus("ready");
      return snapshot;
    } catch {
      setCatalogSnapshot(null);
      setCatalogStatus("error");
      setCatalogError("역할 정보를 불러오지 못했습니다. 권한 또는 연결 상태를 확인한 뒤 다시 시도하세요.");
      return null;
    }
  }, [catalogApi, usesServerCatalog, workspaceId]);

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

  useEffect(() => {
    if (!hydrated) return;

    if (!usesServerCatalog) {
      return;
    }

    const loadTimer = window.setTimeout(() => {
      void reloadCatalog();
    }, 0);

    return () => window.clearTimeout(loadTimer);
  }, [hydrated, reloadCatalog, usesServerCatalog]);

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

  const access = getRoleManagementAccess(state, workspaceId, session);

  const mutateCatalog = useCallback(
    async (mutation: WorkspaceRoleCatalogMutation) => {
      if (!usesServerCatalog) return null;

      try {
        const snapshot = await catalogApi.mutate(workspaceId, mutation);
        setCatalogSnapshot(snapshot);
        setCatalogStatus("ready");
        setCatalogError(null);
        window.dispatchEvent(new Event("clair.workspaceRoleCatalog.v1"));
        return snapshot;
      } catch {
        setCatalogError("역할 변경을 저장하지 못했습니다. 권한 또는 연결 상태를 확인한 뒤 다시 시도하세요.");
        return null;
      }
    },
    [catalogApi, usesServerCatalog, workspaceId]
  );

  const canView = usesServerCatalog ? catalogStatus === "ready" : access.canView;
  const canManage = usesServerCatalog ? catalogSnapshot?.access.canManage === true : access.canManage;

  return {
    state,
    updateState,
    hydrated,
    canView,
    canManage,
    workspaceId,
    permissionRoles: usesServerCatalog ? catalogSnapshot?.permissionRoles : undefined,
    jobPositions: usesServerCatalog
      ? catalogSnapshot?.jobPositions.filter((position) => position.isActive)
      : undefined,
    ownerReconciliation: usesServerCatalog ? catalogSnapshot?.ownerReconciliation : undefined,
    usesServerCatalog,
    catalogStatus,
    catalogError,
    reloadCatalog,
    mutateCatalog,
  };
}
