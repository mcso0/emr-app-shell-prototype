import "server-only";

import type { SessionWorkspaceMembershipStatus, SessionWorkspaceRole } from "@/features/auth/workspace-session";

export type WorkspaceListItem = {
  id: string;
  displayName: string;
  membershipId: string;
  roles: SessionWorkspaceRole[];
  status: SessionWorkspaceMembershipStatus;
};

export type WorkspaceListGateway = {
  listActiveWorkspacesForCurrentUser(): Promise<
    | { ok: true; workspaces: WorkspaceListItem[] }
    | { ok: false; error: "db_read_failed" }
  >;
};

export type WorkspaceListResult =
  | {
      ok: true;
      status: 200;
      workspaces: WorkspaceListItem[];
      enforcedBy: "workspace-membership-reader";
    }
  | {
      ok: false;
      status: 401;
      denialReason: "unauthenticated";
    }
  | {
      ok: false;
      status: 500;
      error: "db_read_failed" | "supabase_client_missing";
    };

export async function listActorWorkspaces({
  actorUserId,
  gateway,
}: {
  actorUserId: string | null;
  gateway?: WorkspaceListGateway;
}): Promise<WorkspaceListResult> {
  if (!actorUserId) {
    return { ok: false, status: 401, denialReason: "unauthenticated" };
  }

  if (!gateway) {
    return {
      ok: true,
      status: 200,
      workspaces: [],
      enforcedBy: "workspace-membership-reader",
    };
  }

  const result = await gateway.listActiveWorkspacesForCurrentUser();

  if (!result.ok) {
    return { ok: false, status: 500, error: result.error };
  }

  return {
    ok: true,
    status: 200,
    workspaces: result.workspaces,
    enforcedBy: "workspace-membership-reader",
  };
}

export type SupabaseWorkspaceListRpcClient = {
  rpc(
    functionName: "clair_list_active_workspaces_for_current_user",
    args?: Record<string, never>
  ): Promise<{ data: unknown; error: { message?: string } | null }>;
};

export function createSupabaseWorkspaceListGateway(
  client: SupabaseWorkspaceListRpcClient
): WorkspaceListGateway {
  return {
    async listActiveWorkspacesForCurrentUser() {
      const { data, error } = await client.rpc(
        "clair_list_active_workspaces_for_current_user"
      );

      if (error) {
        return { ok: false, error: "db_read_failed" };
      }

      return { ok: true, workspaces: mapWorkspaceListData(data) };
    },
  };
}

function mapWorkspaceListData(data: unknown): WorkspaceListItem[] {
  if (!Array.isArray(data)) return [];

  return data
    .map((item) => {
      const value = item as Partial<WorkspaceListItem>;
      const roles = Array.isArray(value.roles)
        ? value.roles.filter(isWorkspaceRole)
        : [];

      if (
        typeof value.id !== "string" ||
        typeof value.displayName !== "string" ||
        typeof value.membershipId !== "string" ||
        roles.length === 0
      ) {
        return null;
      }

      return {
        id: value.id,
        displayName: value.displayName,
        membershipId: value.membershipId,
        roles,
        status: value.status === "active" ? "active" : "inactive",
      };
    })
    .filter((item): item is WorkspaceListItem => Boolean(item));
}

function isWorkspaceRole(role: unknown): role is SessionWorkspaceRole {
  return (
    role === "hospital_admin" ||
    role === "vet" ||
    role === "technician" ||
    role === "front_desk"
  );
}
