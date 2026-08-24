import type { SessionWorkspaceAccessStatus } from "@/features/auth/workspace-session";

export type WorkspaceAccessState = "checking" | "allowed" | "denied";

export type WorkspaceAccessSnapshot = {
  workspaceId: string | null;
  status: WorkspaceAccessState;
};

export type WorkspaceAuthProvider = "mock" | "supabase";

export function shouldVerifyWorkspaceAccessOnServer(
  authProvider: WorkspaceAuthProvider,
  sessionAccess: SessionWorkspaceAccessStatus
) {
  return authProvider === "supabase" || sessionAccess === "unknown";
}

function hasActivePersistedWorkspace(workspaces: unknown, workspaceId: string) {
  if (!Array.isArray(workspaces)) return false;

  if (
    workspaces.some((workspace) => {
      if (!workspace || typeof workspace !== "object") return true;

      const persistedWorkspace = workspace as { id?: unknown; status?: unknown };
      return (
        typeof persistedWorkspace.id !== "string" ||
        typeof persistedWorkspace.status !== "string"
      );
    })
  ) {
    return false;
  }

  return workspaces.some((workspace) => {
    const persistedWorkspace = workspace as { id?: unknown; status?: unknown };
    return persistedWorkspace.id === workspaceId && persistedWorkspace.status === "active";
  });
}

function hasActiveWorkspaceServerResponse(result: unknown, workspaceId: string) {
  if (!result || typeof result !== "object") return false;

  const response = result as { ok?: unknown; workspaces?: unknown };
  return response.ok === true && hasActivePersistedWorkspace(response.workspaces, workspaceId);
}

export function hasActiveWorkspaceServerAccess(
  responseOk: boolean,
  result: unknown,
  workspaceId: string
) {
  return responseOk && hasActiveWorkspaceServerResponse(result, workspaceId);
}

export function isWorkspaceAccessAllowedFor(
  snapshot: WorkspaceAccessSnapshot,
  workspaceId: string | null
) {
  return snapshot.workspaceId === workspaceId && snapshot.status === "allowed";
}
