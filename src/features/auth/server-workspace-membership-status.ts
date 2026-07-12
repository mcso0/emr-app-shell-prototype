import "server-only";

import {
  createMockWorkspacePermissionAdapter,
  resolveWorkspacePermission,
  type WorkspacePermissionAdapter,
  type WorkspacePermissionDenialReason,
} from "@/features/auth/permission-resolver";
import type {
  SessionWorkspaceInvitation,
  SessionWorkspaceMembership,
} from "@/features/auth/workspace-session";
import { normalizeWorkspaceMembershipStatus } from "@/features/auth/workspace-session";

export type WorkspaceMembershipStatusGateway = {
  listWorkspaceMembershipStatus(includeArchived?: boolean): Promise<
    | {
        ok: true;
        memberships: SessionWorkspaceMembership[];
        invitations: SessionWorkspaceInvitation[];
      }
    | { ok: false; error: "db_read_failed" }
  >;
};

export type WorkspaceMembershipStatusResult =
  | {
      ok: true;
      status: 200;
      memberships: SessionWorkspaceMembership[];
      invitations: SessionWorkspaceInvitation[];
      enforcedBy: "workspace-membership-status-reader";
    }
  | {
      ok: false;
      status: 401 | 403;
      denialReason: WorkspacePermissionDenialReason;
    }
  | { ok: false; status: 500; error: "db_read_failed" | "supabase_client_missing" };

export async function readWorkspaceMembershipStatus({
  actorUserId,
  workspaceId,
  permissionAdapter = createDemoMembershipStatusPermissionAdapter(workspaceId),
  gateway,
  includeArchived = false,
}: {
  actorUserId: string | null;
  workspaceId: string;
  permissionAdapter?: WorkspacePermissionAdapter;
  gateway?: WorkspaceMembershipStatusGateway;
  includeArchived?: boolean;
}): Promise<WorkspaceMembershipStatusResult> {
  if (!actorUserId) {
    return { ok: false, status: 401, denialReason: "unauthenticated" };
  }

  const permission = resolveWorkspacePermission(permissionAdapter, {
    sessionUserId: actorUserId,
    workspaceId,
    requiredPermission: "role_permission:manage",
  });

  if (!permission.allowed) {
    return {
      ok: false,
      status: permission.denialReason === "unauthenticated" ? 401 : 403,
      denialReason: permission.denialReason ?? "permission_missing",
    };
  }

  if (!gateway) {
    return {
      ok: true,
      status: 200,
      memberships: [],
      invitations: [],
      enforcedBy: "workspace-membership-status-reader",
    };
  }

  const result = await gateway.listWorkspaceMembershipStatus(includeArchived);

  if (!result.ok) {
    return { ok: false, status: 500, error: result.error };
  }

  return {
    ok: true,
    status: 200,
    memberships: result.memberships.map(normalizeWorkspaceMembership),
    invitations: result.invitations,
    enforcedBy: "workspace-membership-status-reader",
  };
}

export type SupabaseWorkspaceMembershipStatusRpcClient = {
  rpc(
    functionName: "clair_list_workspace_member_statuses",
    args: Record<string, unknown>
  ): Promise<{ data: unknown; error: { message?: string } | null }>;
};

export function createSupabaseWorkspaceMembershipStatusGateway(
  client: SupabaseWorkspaceMembershipStatusRpcClient,
  workspaceId: string
): WorkspaceMembershipStatusGateway {
  return {
    async listWorkspaceMembershipStatus(includeArchived = false) {
      const { data, error } = await client.rpc("clair_list_workspace_member_statuses", {
        p_workspace_id: workspaceId,
        p_include_deleted: includeArchived,
      });

      if (error) {
        return { ok: false, error: "db_read_failed" };
      }

      const value = data as {
        memberships?: SessionWorkspaceMembership[];
        invitations?: SessionWorkspaceInvitation[];
      };

      return {
        ok: true,
        memberships: Array.isArray(value?.memberships) ? value.memberships : [],
        invitations: Array.isArray(value?.invitations) ? value.invitations : [],
      };
    },
  };
}

function normalizeWorkspaceMembership(
  membership: SessionWorkspaceMembership
): SessionWorkspaceMembership {
  return {
    ...membership,
    status: normalizeWorkspaceMembershipStatus(membership.status),
    archivedAt: membership.archivedAt ?? membership.deletedAt ?? null,
    archivedByUserId: membership.archivedByUserId ?? membership.deletedByUserId ?? null,
    archivedReason: membership.archivedReason ?? membership.deletedReason ?? null,
  };
}

function createDemoMembershipStatusPermissionAdapter(workspaceId: string) {
  const demoMembershipWorkspaceId = workspaceId === "workspace-b" ? "workspace-a" : workspaceId;

  return createMockWorkspacePermissionAdapter({
    now: new Date().toISOString(),
    users: [
      { id: "user-admin", status: "active", displayName: "송민재" },
      { id: "user-vet", status: "active", displayName: "이수지" },
    ],
    memberships: [
      {
        id: "membership-admin",
        workspaceId: demoMembershipWorkspaceId,
        userId: "user-admin",
        roles: ["hospital_admin"],
        status: "active",
      },
      {
        id: "membership-vet",
        workspaceId: demoMembershipWorkspaceId,
        userId: "user-vet",
        roles: ["vet"],
        status: "active",
      },
    ],
  });
}
