import type { PermissionId } from "@/types/emr-domain";
import type {
  WorkspaceAssignedJobPosition,
  WorkspaceAssignedPermissionRole,
  WorkspaceMembership,
  WorkspacePermissionAdapter,
  WorkspacePermissionRoleType,
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

export type WorkspacePermissionDbRoleAssignmentRow = {
  workspace_id: string;
  membership_id: string;
  permission_role_id: string;
  role_key: string;
  label: string;
  role_type: string;
  permissions: { allowed?: string[] } | null;
};

export type WorkspacePermissionDbJobPositionAssignmentRow = {
  workspace_id: string;
  membership_id: string;
  job_position_id: string;
  position_key: string;
  label: string;
};

export type WorkspacePermissionDbGateway = {
  listMemberships(
    workspaceId: string,
    userId: string
  ): Promise<WorkspacePermissionDbMembershipRow[]>;
  listUsers(userIds: string[]): Promise<WorkspacePermissionDbUserRow[]>;
  listPermissionPolicies(workspaceId: string): Promise<WorkspacePermissionDbPolicyRow[]>;
  listPermissionRoleAssignments(
    workspaceId: string,
    membershipIds: string[]
  ): Promise<WorkspacePermissionDbRoleAssignmentRow[]>;
  listJobPositionAssignments(
    workspaceId: string,
    membershipIds: string[]
  ): Promise<WorkspacePermissionDbJobPositionAssignmentRow[]>;
};

export type WorkspacePermissionDbAdapterInput = {
  now?: string;
  users: WorkspacePermissionDbUserRow[];
  memberships: WorkspacePermissionDbMembershipRow[];
  permissionPolicies?: WorkspacePermissionDbPolicyRow[];
  permissionRoleAssignments?: WorkspacePermissionDbRoleAssignmentRow[];
  jobPositionAssignments?: WorkspacePermissionDbJobPositionAssignmentRow[];
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
  const membershipIds = memberships.map((row) => row.id);
  const users = await gateway.listUsers(userIds);
  const permissionPolicies = await gateway.listPermissionPolicies(workspaceId);
  const permissionRoleAssignments = await gateway.listPermissionRoleAssignments(
    workspaceId,
    membershipIds
  );
  const jobPositionAssignments = await gateway.listJobPositionAssignments(workspaceId, membershipIds);

  return createWorkspacePermissionAdapterFromDbRows({
    now,
    users,
    memberships,
    permissionPolicies,
    permissionRoleAssignments,
    jobPositionAssignments,
  });
}

export function createWorkspacePermissionAdapterFromDbRows({
  now = new Date().toISOString(),
  users,
  memberships,
  permissionPolicies = [],
  permissionRoleAssignments = [],
  jobPositionAssignments = [],
}: WorkspacePermissionDbAdapterInput): WorkspacePermissionAdapter {
  const permissionRolesByMembershipId = mapPermissionRoleAssignmentsByMembershipId(
    permissionRoleAssignments
  );
  const jobPositionsByMembershipId = mapJobPositionAssignmentsByMembershipId(jobPositionAssignments);

  return {
    now,
    users: users.map(mapDbUser),
    memberships: memberships
      .map((membership) => {
        return mapDbMembership(
          membership,
          permissionRolesByMembershipId.get(membership.id),
          jobPositionsByMembershipId.get(membership.id)
        );
      })
      .filter(isWorkspaceMembership),
    permissionPolicies: permissionPolicies
      .map(mapDbPermissionPolicy)
      .filter(isWorkspaceRolePermissionPolicy),
  };
}

function mapDbUser(row: WorkspacePermissionDbUserRow): WorkspacePermissionUser {
  return {
    id: row.id,
    status: mapUserStatus(row.status),
    displayName: row.display_name ?? undefined,
  };
}

function mapDbMembership(
  row: WorkspacePermissionDbMembershipRow,
  permissionRole?: WorkspaceAssignedPermissionRole,
  jobPosition?: WorkspaceAssignedJobPosition
): WorkspaceMembership | null {
  const roles = (row.roles ?? []).filter(isWorkspaceRoleId);

  if (roles.length === 0 && !permissionRole && row.status === "active") {
    return null;
  }

  return {
    id: row.id,
    workspaceId: row.workspace_id,
    userId: row.user_id,
    roles,
    status: mapMembershipStatus(row.status),
    ...(permissionRole ? { permissionRole } : {}),
    ...(jobPosition ? { jobPosition } : {}),
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

function mapPermissionRoleAssignmentsByMembershipId(
  rows: WorkspacePermissionDbRoleAssignmentRow[]
): Map<string, WorkspaceAssignedPermissionRole> {
  const assignments = new Map<string, WorkspaceAssignedPermissionRole>();

  for (const row of rows) {
    const assignment = mapDbPermissionRoleAssignment(row);
    if (assignment) {
      assignments.set(row.membership_id, assignment);
    }
  }

  return assignments;
}

function mapJobPositionAssignmentsByMembershipId(
  rows: WorkspacePermissionDbJobPositionAssignmentRow[]
): Map<string, WorkspaceAssignedJobPosition> {
  const assignments = new Map<string, WorkspaceAssignedJobPosition>();

  for (const row of rows) {
    assignments.set(row.membership_id, {
      id: row.job_position_id,
      key: row.position_key,
      label: row.label,
    });
  }

  return assignments;
}

function mapDbPermissionRoleAssignment(
  row: WorkspacePermissionDbRoleAssignmentRow
): WorkspaceAssignedPermissionRole | null {
  if (!isWorkspacePermissionRoleType(row.role_type)) {
    return null;
  }

  const allowed = row.permissions?.allowed ?? [];

  return {
    id: row.permission_role_id,
    key: row.role_key,
    label: row.label,
    roleType: row.role_type,
    permissionIds: allowed.includes("*")
      ? ["*"]
      : allowed.filter(isPermissionIdLike),
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

function isWorkspacePermissionRoleType(value: string): value is WorkspacePermissionRoleType {
  return (
    value === "owner" ||
    value === "admin" ||
    value === "standard" ||
    value === "custom"
  );
}

function isPermissionIdLike(permissionId: string): permissionId is PermissionId {
  return permissionId.includes(":");
}

function isWorkspaceMembership(value: WorkspaceMembership | null): value is WorkspaceMembership {
  return value !== null;
}

function isWorkspaceRolePermissionPolicy(
  value: WorkspaceRolePermissionPolicy | null
): value is WorkspaceRolePermissionPolicy {
  return value !== null;
}
