import type { PermissionId } from "@/types/emr-domain";
import type {
  WorkspaceMembership,
  WorkspacePermissionAdapter,
  WorkspacePermissionUser,
  WorkspaceRoleId,
  WorkspaceRolePermissionPolicy,
} from "@/features/auth/permission-resolver";

export type WorkspacePermissionDbUserRow = {
  id: string;
  status: string;
  display_name?: string | null;
};

export type WorkspacePermissionDbMembershipRow = {
  id: string;
  workspace_id: string;
  user_id: string;
  roles: string[] | null;
  status: string;
};

export type WorkspacePermissionDbPolicyRow = {
  workspace_id: string;
  scope: string;
  target_role: string | null;
  permissions: { allowed?: string[] } | null;
};

export type WorkspacePermissionDbGateway = {
  listMemberships(
    workspaceId: string,
    userId: string
  ): Promise<WorkspacePermissionDbMembershipRow[]>;
  listUsers(userIds: string[]): Promise<WorkspacePermissionDbUserRow[]>;
  listPermissionPolicies(workspaceId: string): Promise<WorkspacePermissionDbPolicyRow[]>;
};

export type WorkspacePermissionDbAdapterInput = {
  now?: string;
  users: WorkspacePermissionDbUserRow[];
  memberships: WorkspacePermissionDbMembershipRow[];
  permissionPolicies?: WorkspacePermissionDbPolicyRow[];
};

export async function loadWorkspacePermissionAdapterFromDb({
  gateway,
  workspaceId,
  sessionUserId,
  now = new Date().toISOString(),
}: {
  gateway: WorkspacePermissionDbGateway;
  workspaceId: string;
  sessionUserId: string;
  now?: string;
}): Promise<WorkspacePermissionAdapter> {
  const memberships = await gateway.listMemberships(workspaceId, sessionUserId);
  const userIds = Array.from(new Set([sessionUserId, ...memberships.map((row) => row.user_id)]));
  const users = await gateway.listUsers(userIds);
  const permissionPolicies = await gateway.listPermissionPolicies(workspaceId);

  return createWorkspacePermissionAdapterFromDbRows({
    now,
    users,
    memberships,
    permissionPolicies,
  });
}

export function createWorkspacePermissionAdapterFromDbRows({
  now = new Date().toISOString(),
  users,
  memberships,
  permissionPolicies = [],
}: WorkspacePermissionDbAdapterInput): WorkspacePermissionAdapter {
  return {
    now,
    users: users.map(mapDbUser),
    memberships: memberships.map(mapDbMembership).filter(Boolean) as WorkspaceMembership[],
    permissionPolicies: permissionPolicies
      .map(mapDbPermissionPolicy)
      .filter(Boolean) as WorkspaceRolePermissionPolicy[],
  };
}

function mapDbUser(row: WorkspacePermissionDbUserRow): WorkspacePermissionUser {
  return {
    id: row.id,
    status: mapUserStatus(row.status),
    displayName: row.display_name ?? undefined,
  };
}

function mapDbMembership(row: WorkspacePermissionDbMembershipRow): WorkspaceMembership | null {
  const roles = (row.roles ?? []).filter(isWorkspaceRoleId);

  if (roles.length === 0 && row.status === "active") {
    return null;
  }

  return {
    id: row.id,
    workspaceId: row.workspace_id,
    userId: row.user_id,
    roles,
    status: mapMembershipStatus(row.status),
  };
}

function mapDbPermissionPolicy(
  row: WorkspacePermissionDbPolicyRow
): WorkspaceRolePermissionPolicy | null {
  if (row.scope !== "role" || !row.target_role || !isWorkspaceRoleId(row.target_role)) {
    return null;
  }

  const allowed = row.permissions?.allowed ?? [];

  return {
    workspaceId: row.workspace_id,
    role: row.target_role,
    permissionIds: allowed.includes("*")
      ? ["*"]
      : (allowed.filter(isPermissionIdLike) as PermissionId[]),
  };
}

function mapUserStatus(status: string): WorkspacePermissionUser["status"] {
  if (status === "active" || status === "inactive" || status === "invited") {
    return status;
  }

  return "inactive";
}

function mapMembershipStatus(status: string): WorkspaceMembership["status"] {
  if (status === "active" || status === "inactive" || status === "pending") {
    return status;
  }

  return "inactive";
}

function isWorkspaceRoleId(role: string): role is WorkspaceRoleId {
  return (
    role === "hospital_admin" ||
    role === "vet" ||
    role === "technician" ||
    role === "front_desk"
  );
}

function isPermissionIdLike(permissionId: string): permissionId is PermissionId {
  return permissionId.includes(":");
}
