import "server-only";

import {
  createMockWorkspacePermissionAdapter,
  resolveWorkspacePermission,
  type WorkspacePermissionAdapter,
  type WorkspacePermissionDenialReason,
} from "@/features/auth/permission-resolver";
import type {
  SessionWorkspaceInvitationStatus,
  SessionWorkspaceMembership,
} from "@/features/auth/workspace-session";

export type WorkspaceInvitationLifecycleAction = "resend" | "cancel" | "accept";

export type WorkspaceInvitationLifecycleWrite = {
  workspaceId: string;
  invitationId: string;
  actorUserId: string;
  action: WorkspaceInvitationLifecycleAction;
  now: string;
};

export type WorkspaceInvitationLifecycleGatewayResult =
  | {
      ok: true;
      status: SessionWorkspaceInvitationStatus;
      resentAt?: string | null;
      resendCount?: number;
      canceledAt?: string | null;
      acceptedAt?: string | null;
      membership?: SessionWorkspaceMembership;
    }
  | {
      ok: false;
      status: 404;
      denialReason: "target_invitation_missing";
    }
  | {
      ok: false;
      status: 409;
      denialReason: "invitation_not_pending" | "active_membership_exists";
    }
  | { ok: false; status: 500; error: "db_write_failed" };

export type WorkspaceInvitationLifecycleGateway = {
  mutateInvitationLifecycle(
    write: WorkspaceInvitationLifecycleWrite
  ): Promise<WorkspaceInvitationLifecycleGatewayResult>;
};

export type WorkspaceInvitationLifecycleResult =
  | {
      ok: true;
      statusCode: 200;
      workspaceId: string;
      invitationId: string;
      action: WorkspaceInvitationLifecycleAction;
      status: SessionWorkspaceInvitationStatus;
      resentAt?: string | null;
      resendCount?: number;
      canceledAt?: string | null;
      acceptedAt?: string | null;
      membership?: SessionWorkspaceMembership;
      enforcedBy: "workspace-invitation-lifecycle-server-route";
    }
  | {
      ok: false;
      statusCode: 401 | 403;
      denialReason: WorkspacePermissionDenialReason;
    }
  | {
      ok: false;
      statusCode: 404;
      denialReason: "target_invitation_missing";
    }
  | {
      ok: false;
      statusCode: 409;
      denialReason: "invitation_not_pending" | "active_membership_exists";
    }
  | { ok: false; statusCode: 500; error: "db_write_failed" | "supabase_client_missing" };

export async function mutateWorkspaceInvitationLifecycle({
  actorUserId,
  workspaceId,
  invitationId,
  action,
  permissionAdapter = createDemoInvitationLifecyclePermissionAdapter(workspaceId),
  gateway,
  now = new Date().toISOString(),
}: {
  actorUserId: string | null;
  workspaceId: string;
  invitationId: string;
  action: WorkspaceInvitationLifecycleAction;
  permissionAdapter?: WorkspacePermissionAdapter;
  gateway?: WorkspaceInvitationLifecycleGateway;
  now?: string;
}): Promise<WorkspaceInvitationLifecycleResult> {
  if (!actorUserId) {
    return { ok: false, statusCode: 401, denialReason: "unauthenticated" };
  }

  if (action === "resend" || action === "cancel") {
    const permission = resolveWorkspacePermission(permissionAdapter, {
      sessionUserId: actorUserId,
      workspaceId,
      requiredPermission: "role_permission:manage",
    });

    if (!permission.allowed) {
      return {
        ok: false,
        statusCode: permission.denialReason === "unauthenticated" ? 401 : 403,
        denialReason: permission.denialReason ?? "permission_missing",
      };
    }
  }

  if (!gateway) {
    return createMockLifecycleResult({
      actorUserId,
      workspaceId,
      invitationId,
      action,
      now,
    });
  }

  const persisted = await gateway.mutateInvitationLifecycle({
    workspaceId,
    invitationId,
    actorUserId,
    action,
    now,
  });

  if (!persisted.ok) {
    if (persisted.status === 500) return { ok: false, statusCode: 500, error: persisted.error };
    if (persisted.status === 404) {
      return {
        ok: false,
        statusCode: 404,
        denialReason: persisted.denialReason,
      };
    }

    return {
      ok: false,
      statusCode: 409,
      denialReason: persisted.denialReason,
    };
  }

  return {
    ok: true,
    statusCode: 200,
    workspaceId,
    invitationId,
    action,
    status: persisted.status,
    resentAt: persisted.resentAt,
    resendCount: persisted.resendCount,
    canceledAt: persisted.canceledAt,
    acceptedAt: persisted.acceptedAt,
    membership: persisted.membership,
    enforcedBy: "workspace-invitation-lifecycle-server-route",
  };
}

export type SupabaseWorkspaceInvitationLifecycleRpcClient = {
  rpc(
    functionName:
      | "clair_resend_workspace_invitation"
      | "clair_cancel_workspace_invitation"
      | "clair_accept_workspace_invitation",
    args: Record<string, unknown>
  ): Promise<{ data: unknown; error: { message?: string } | null }>;
};

export function createSupabaseWorkspaceInvitationLifecycleGateway(
  client: SupabaseWorkspaceInvitationLifecycleRpcClient
): WorkspaceInvitationLifecycleGateway {
  return {
    async mutateInvitationLifecycle(write) {
      const functionName =
        write.action === "resend"
          ? "clair_resend_workspace_invitation"
          : write.action === "cancel"
            ? "clair_cancel_workspace_invitation"
            : "clair_accept_workspace_invitation";
      const { data, error } = await client.rpc(functionName, {
        p_workspace_id: write.workspaceId,
        p_invitation_id: write.invitationId,
      });

      if (error) {
        if (error.message?.includes("target_invitation_missing")) {
          return { ok: false, status: 404, denialReason: "target_invitation_missing" };
        }

        if (error.message?.includes("invitation_not_pending")) {
          return { ok: false, status: 409, denialReason: "invitation_not_pending" };
        }

        if (error.message?.includes("active_membership_exists")) {
          return { ok: false, status: 409, denialReason: "active_membership_exists" };
        }

        return { ok: false, status: 500, error: "db_write_failed" };
      }

      return {
        ok: true,
        ...mapLifecycleRpcData(data),
      };
    },
  };
}

function createDemoInvitationLifecyclePermissionAdapter(workspaceId: string) {
  return createMockWorkspacePermissionAdapter({
    now: new Date().toISOString(),
    users: [
      { id: "user-admin", status: "active", displayName: "송민재" },
      { id: "user-vet", status: "active", displayName: "이수지" },
    ],
    memberships: [
      {
        id: "membership-admin",
        workspaceId,
        userId: "user-admin",
        roles: ["hospital_admin"],
        status: "active",
      },
      {
        id: "membership-vet",
        workspaceId,
        userId: "user-vet",
        roles: ["vet"],
        status: "active",
      },
    ],
  });
}

function createMockLifecycleResult({
  actorUserId,
  workspaceId,
  invitationId,
  action,
  now,
}: WorkspaceInvitationLifecycleWrite): WorkspaceInvitationLifecycleResult {
  if (action === "resend") {
    return {
      ok: true,
      statusCode: 200,
      workspaceId,
      invitationId,
      action,
      status: "pending",
      resentAt: now,
      resendCount: 1,
      enforcedBy: "workspace-invitation-lifecycle-server-route",
    };
  }

  if (action === "cancel") {
    return {
      ok: true,
      statusCode: 200,
      workspaceId,
      invitationId,
      action,
      status: "canceled",
      canceledAt: now,
      enforcedBy: "workspace-invitation-lifecycle-server-route",
    };
  }

  return {
    ok: true,
    statusCode: 200,
    workspaceId,
    invitationId,
    action,
    status: "accepted",
    acceptedAt: now,
    membership: {
      id: `${workspaceId}:${actorUserId}`,
      workspaceId,
      userSessionId: actorUserId,
      displayName: actorUserId,
      email: null,
      roles: ["vet"],
      status: "active",
      title: null,
      department: null,
      createdAt: now,
      activatedAt: now,
      deactivatedAt: null,
    },
    enforcedBy: "workspace-invitation-lifecycle-server-route",
  };
}

function mapLifecycleRpcData(data: unknown) {
  const value = data as {
    status?: SessionWorkspaceInvitationStatus;
    resentAt?: string | null;
    resendCount?: number;
    canceledAt?: string | null;
    acceptedAt?: string | null;
    membership?: SessionWorkspaceMembership;
  };

  return {
    status: value.status ?? "pending",
    resentAt: value.resentAt ?? null,
    resendCount: value.resendCount ?? 0,
    canceledAt: value.canceledAt ?? null,
    acceptedAt: value.acceptedAt ?? null,
    membership: value.membership,
  };
}
