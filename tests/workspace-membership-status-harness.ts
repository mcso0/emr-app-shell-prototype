import {
  loadWorkspacePermissionAdapterFromDb,
} from "../src/features/auth/db-workspace-permission-adapter-core";
import type { WorkspacePermissionAdapter } from "../src/features/auth/permission-resolver";
import { resolveWorkspacePermission } from "../src/features/auth/permission-resolver";
import type { ServerSessionReaderResult } from "../src/features/auth/server-session-contract";
import type {
  WorkspaceMembershipStatusGateway,
  WorkspaceMembershipStatusResult,
} from "../src/features/auth/server-workspace-membership-status";
import type {
  SessionWorkspaceInvitation,
  SessionWorkspaceMembership,
} from "../src/features/auth/workspace-session";
import type { MembershipRouteDependencies } from "../src/app/api/workspaces/[workspaceId]/memberships/route-core";

type PermissionMode = "authorized" | "denied" | "fail";

type FakeSupabaseClient = {
  readonly label: string;
};

export function createMembershipStatusRouteHarness(
  permissionMode: PermissionMode
): MembershipRouteDependencies<FakeSupabaseClient> {
  const client: FakeSupabaseClient = { label: "db-client" };

  return {
    async readServerSession() {
      return authenticatedSession("user-live");
    },
    async createClient() {
      return client;
    },
    loadWorkspacePermissionAdapterFromDb,
    createSupabaseWorkspacePermissionGateway() {
      return {
        async listMemberships(workspaceId, userId) {
          if (permissionMode === "fail") {
            throw new Error("permission gateway read failed");
          }

          return [
            {
              id: "membership-live",
              workspace_id: workspaceId,
              user_id: userId,
              roles: ["vet"],
              status: "active",
            },
          ];
        },
        async listUsers(userIds) {
          return userIds.map((id) => ({
            id,
            status: "active",
            display_name: id === "user-live" ? "Live Admin" : null,
          }));
        },
        async listPermissionPolicies(workspaceId) {
          void workspaceId;
          return [];
        },
        async listPermissionRoleAssignments(workspaceId, membershipIds) {
          if (permissionMode !== "authorized") {
            return [];
          }

          return [
            {
              workspace_id: workspaceId,
              membership_id: membershipIds[0] ?? "membership-live",
              permission_role_id: "role-admin",
              role_key: "admin",
              label: "관리자",
              role_type: "admin",
              permissions: { allowed: ["role_permission:manage"] },
            },
          ];
        },
        async listJobPositionAssignments(workspaceId, membershipIds) {
          void workspaceId;
          void membershipIds;
          return [];
        },
      };
    },
    createSupabaseWorkspaceMembershipStatusGateway(_statusClient, workspaceId) {
      return {
        async listWorkspaceMembershipStatus() {
          return {
            ok: true,
            memberships: [persistedMember(workspaceId)],
            invitations: [],
          };
        },
      };
    },
    readWorkspaceMembershipStatus,
  };
}

export function persistedMembershipStatusBody(workspaceId: string): {
  readonly ok: true;
  readonly memberships: SessionWorkspaceMembership[];
  readonly invitations: SessionWorkspaceInvitation[];
  readonly enforcedBy: "workspace-membership-status-reader";
} {
  return {
    ok: true,
    memberships: activeAndInactiveMembers(workspaceId),
    invitations: [pendingInvitation(workspaceId)],
    enforcedBy: "workspace-membership-status-reader",
  };
}

function authenticatedSession(sessionUserId: string): ServerSessionReaderResult {
  return {
    ok: true,
    status: "authenticated",
    sessionUserId,
    email: "live-admin@clair.local",
    role: "authenticated",
    aal: "aal1",
    sessionId: "session-live",
    source: "supabase_claims",
  };
}

function activeAndInactiveMembers(workspaceId: string): SessionWorkspaceMembership[] {
  return [
    {
      id: "membership-admin",
      workspaceId,
      userSessionId: "user-admin",
      displayName: "송민재",
      email: "admin@clair.local",
      roles: ["hospital_admin"],
      status: "active",
      title: "병원장",
      department: "운영",
      createdAt: "2026-05-18T00:00:00.000Z",
      activatedAt: "2026-05-18T00:00:00.000Z",
      deactivatedAt: null,
    },
    {
      id: "membership-vet",
      workspaceId,
      userSessionId: "user-vet",
      displayName: "이수지",
      email: "vet@clair.local",
      roles: ["vet"],
      status: "active",
      title: "수의사",
      department: "진료",
      createdAt: "2026-05-18T00:00:00.000Z",
      activatedAt: "2026-05-18T00:00:00.000Z",
      deactivatedAt: null,
    },
    {
      id: "membership-inactive",
      workspaceId,
      userSessionId: "user-old",
      displayName: "비활성",
      email: "old@clair.local",
      roles: ["front_desk"],
      status: "inactive",
      title: "데스크",
      department: "원무",
      createdAt: "2026-05-18T00:00:00.000Z",
      activatedAt: null,
      deactivatedAt: "2026-05-18T01:00:00.000Z",
    },
  ];
}

function persistedMember(workspaceId: string): SessionWorkspaceMembership {
  return {
    id: "membership-persisted",
    workspaceId,
    userSessionId: "user-persisted",
    displayName: "Persisted Member",
    email: "persisted@clair.local",
    roles: ["vet"],
    status: "active",
    title: "수의사",
    department: "진료",
    createdAt: "2026-07-02T00:00:00.000Z",
    activatedAt: "2026-07-02T00:00:00.000Z",
    deactivatedAt: null,
  };
}

function pendingInvitation(workspaceId: string): SessionWorkspaceInvitation {
  return {
    id: "invite-persisted",
    workspaceId,
    email: "pending@clair.local",
    invitedRoles: ["technician"],
    title: "테크니션",
    department: "검사",
    status: "pending",
    invitedBySessionId: "user-admin",
    acceptedBySessionId: null,
    expiresAt: "2026-05-25T00:00:00.000Z",
    acceptedAt: null,
    canceledAt: null,
    resentAt: null,
    resendCount: 0,
    createdAt: "2026-05-18T00:00:00.000Z",
    updatedAt: "2026-05-18T00:00:00.000Z",
  };
}

async function readWorkspaceMembershipStatus({
  actorUserId,
  workspaceId,
  permissionAdapter,
  gateway,
}: {
  readonly actorUserId: string | null;
  readonly workspaceId: string;
  readonly permissionAdapter?: WorkspacePermissionAdapter;
  readonly gateway?: WorkspaceMembershipStatusGateway;
}): Promise<WorkspaceMembershipStatusResult> {
  if (!actorUserId) {
    return { ok: false, status: 401, denialReason: "unauthenticated" };
  }

  if (!permissionAdapter) {
    return { ok: false, status: 500, error: "supabase_client_missing" };
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

  const result = await gateway?.listWorkspaceMembershipStatus();

  if (!result?.ok) {
    return { ok: false, status: 500, error: "db_read_failed" };
  }

  return {
    ok: true,
    status: 200,
    memberships: result.memberships,
    invitations: result.invitations,
    enforcedBy: "workspace-membership-status-reader",
  };
}
