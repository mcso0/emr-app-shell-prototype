import { mockPermissionSeeds } from "@/mocks/emr-domain";
import type { PermissionId, PermissionResource } from "@/types/emr-domain";

export type WorkspaceRoleId = "hospital_admin" | "vet" | "technician" | "front_desk";
export type WorkspacePermissionRoleType = "owner" | "admin" | "standard" | "custom";
export type WorkspacePermissionUserStatus = "active" | "inactive" | "suspended" | "invited";
export type WorkspaceMembershipStatus = "active" | "inactive" | "suspended" | "pending";

export type WorkspacePermissionUser = {
  id: string;
  status: WorkspacePermissionUserStatus;
  displayName?: string;
};

export type WorkspaceMembership = {
  id: string;
  workspaceId: string;
  userId: string;
  roles: WorkspaceRoleId[];
  permissionRole?: WorkspaceAssignedPermissionRole;
  jobPosition?: WorkspaceAssignedJobPosition;
  status: WorkspaceMembershipStatus;
};

export type WorkspaceAssignedPermissionRole = {
  id?: string;
  key: string;
  label: string;
  roleType: WorkspacePermissionRoleType;
  permissionIds: PermissionId[] | ["*"];
};

export type WorkspaceAssignedJobPosition = {
  id?: string;
  key: string;
  label: string;
};

export type WorkspaceRolePermissionPolicy = {
  workspaceId: string;
  role: WorkspaceRoleId;
  permissionIds: PermissionId[] | ["*"];
};

export type WorkspacePermissionAdapter = {
  now: string;
  users: WorkspacePermissionUser[];
  memberships: WorkspaceMembership[];
  permissionPolicies?: WorkspaceRolePermissionPolicy[];
};

export type WorkspacePermissionDenialReason =
  | "unauthenticated"
  | "inactive_user"
  | "workspace_membership_missing"
  | "workspace_membership_inactive"
  | "permission_missing"
  | "last_admin_protected";

export type WorkspacePermissionResolution = {
  allowed: boolean;
  denialReason?: WorkspacePermissionDenialReason;
  userId: string | null;
  workspaceId: string;
  membershipId: string | null;
  assignedRoles: WorkspaceRoleId[];
  assignedPermissionRole?: WorkspaceAssignedPermissionRole;
  jobPosition?: WorkspaceAssignedJobPosition;
  effectivePermissionIds: PermissionId[];
  hasFullWorkspaceAccess: boolean;
  hasOwnerWorkspaceAccess: boolean;
};

export type WorkspacePermissionRequest = {
  sessionUserId: string | null | undefined;
  workspaceId: string;
  requiredPermission?: PermissionId;
};

export type LastWorkspaceAdminGuardRequest = {
  workspaceId: string;
  targetMembershipId: string;
  nextRoles: WorkspaceRoleId[];
  nextStatus: WorkspaceMembershipStatus;
};

export type LastWorkspaceAdminGuardResult =
  | { allowed: true; denialReason?: never }
  | { allowed: false; denialReason: "last_admin_protected" };

const allPermissionIds = mockPermissionSeeds.map((permission) => permission.id);
const allPermissionIdSet = new Set<PermissionId>(allPermissionIds);

const canonicalRolePermissions: Record<WorkspaceRoleId, PermissionId[]> = {
  hospital_admin: allPermissionIds,
  vet: [
    "reception:view",
    "patient:view",
    "patient:create",
    "patient:update",
    "encounter:view",
    "chart:view",
    "chart:update",
    "order:view",
    "order:request",
    "order:update",
    "dispensing:view",
    "lab:view",
    "imaging:view",
    "billing:view",
    "service_catalog:view",
  ],
  technician: [
    "reception:view",
    "patient:view",
    "patient:create",
    "patient:update",
    "encounter:view",
    "chart:view",
    "order:view",
    "dispensing:view",
    "dispensing:complete",
    "lab:view",
    "lab:complete",
    "imaging:view",
    "imaging:complete",
    "billing:view",
    "billing:issue",
    "service_catalog:view",
  ],
  front_desk: [
    "reception:view",
    "reception:create",
    "reception:update",
    "patient:view",
    "patient:create",
    "patient:update",
    "encounter:view",
    "encounter:create",
    "encounter:update",
    "chart:view",
    "order:view",
    "billing:view",
    "billing:issue",
    "service_catalog:view",
  ],
};

export function createMockWorkspacePermissionAdapter(
  input: Partial<WorkspacePermissionAdapter> = {}
): WorkspacePermissionAdapter {
  return {
    now: input.now ?? new Date().toISOString(),
    users: input.users ?? [],
    memberships: input.memberships ?? [],
    permissionPolicies: input.permissionPolicies,
  };
}

export function resolveWorkspacePermission(
  adapter: WorkspacePermissionAdapter,
  request: WorkspacePermissionRequest
): WorkspacePermissionResolution {
  const denied = createPermissionResultFactory(adapter, request);

  if (!request.sessionUserId) {
    return denied("unauthenticated");
  }

  const user = adapter.users.find((item) => item.id === request.sessionUserId);

  if (user && user.status !== "active") {
    return denied("inactive_user", request.sessionUserId);
  }

  const membership = adapter.memberships.find(
    (item) => item.workspaceId === request.workspaceId && item.userId === request.sessionUserId
  );

  if (!membership) {
    return denied("workspace_membership_missing", request.sessionUserId);
  }

  if (membership.status !== "active") {
    return denied("workspace_membership_inactive", request.sessionUserId, membership);
  }

  const permissionContext = resolveMembershipPermissionContext(
    adapter,
    request.workspaceId,
    membership
  );

  if (
    request.requiredPermission &&
    !permissionContext.effectivePermissionIds.includes(request.requiredPermission)
  ) {
    return {
      allowed: false,
      denialReason: "permission_missing",
      userId: request.sessionUserId,
      workspaceId: request.workspaceId,
      membershipId: membership.id,
      ...permissionContext,
    };
  }

  return {
    allowed: true,
    userId: request.sessionUserId,
    workspaceId: request.workspaceId,
    membershipId: membership.id,
    ...permissionContext,
  };
}

export function canView(
  adapter: WorkspacePermissionAdapter,
  sessionUserId: string | null | undefined,
  workspaceId: string,
  resource: PermissionResource
) {
  return can(adapter, sessionUserId, workspaceId, `${resource}:view`);
}

export function canCreate(
  adapter: WorkspacePermissionAdapter,
  sessionUserId: string | null | undefined,
  workspaceId: string,
  resource: PermissionResource
) {
  return can(adapter, sessionUserId, workspaceId, `${resource}:create`);
}

export function canUpdate(
  adapter: WorkspacePermissionAdapter,
  sessionUserId: string | null | undefined,
  workspaceId: string,
  resource: PermissionResource
) {
  return can(adapter, sessionUserId, workspaceId, `${resource}:update`);
}

export function assertLastWorkspaceAdminGuard(
  adapter: WorkspacePermissionAdapter,
  request: LastWorkspaceAdminGuardRequest
): LastWorkspaceAdminGuardResult {
  const activeAdminMemberships = adapter.memberships.filter(
    (membership) =>
      membership.workspaceId === request.workspaceId &&
      membership.status === "active" &&
      membership.roles.includes("hospital_admin")
  );

  const target = activeAdminMemberships.find(
    (membership) => membership.id === request.targetMembershipId
  );

  if (!target) {
    return { allowed: true };
  }

  const targetRemainsActiveAdmin =
    request.nextStatus === "active" && request.nextRoles.includes("hospital_admin");

  if (activeAdminMemberships.length === 1 && !targetRemainsActiveAdmin) {
    return { allowed: false, denialReason: "last_admin_protected" };
  }

  return { allowed: true };
}

function can(
  adapter: WorkspacePermissionAdapter,
  sessionUserId: string | null | undefined,
  workspaceId: string,
  permissionId: PermissionId
) {
  return resolveWorkspacePermission(adapter, {
    sessionUserId,
    workspaceId,
    requiredPermission: permissionId,
  }).allowed;
}

function resolveEffectivePermissionIds(
  adapter: WorkspacePermissionAdapter,
  workspaceId: string,
  roles: WorkspaceRoleId[]
): PermissionId[] {
  if (roles.includes("hospital_admin")) {
    return allPermissionIds;
  }

  if (adapter.permissionPolicies) {
    const allowed = adapter.permissionPolicies
      .filter((policy) => policy.workspaceId === workspaceId && roles.includes(policy.role))
      .flatMap((policy) => policy.permissionIds);

    if (allowed.includes("*")) {
      return allPermissionIds;
    }

    return Array.from(
      new Set(allowed.filter((permissionId): permissionId is PermissionId => {
        return permissionId !== "*" && allPermissionIdSet.has(permissionId);
      }))
    ).sort();
  }

  return Array.from(
    new Set(roles.flatMap((role) => canonicalRolePermissions[role] ?? []))
  ).sort();
}

function resolveMembershipPermissionContext(
  adapter: WorkspacePermissionAdapter,
  workspaceId: string,
  membership: WorkspaceMembership
): Pick<
  WorkspacePermissionResolution,
  | "assignedRoles"
  | "assignedPermissionRole"
  | "jobPosition"
  | "effectivePermissionIds"
  | "hasFullWorkspaceAccess"
  | "hasOwnerWorkspaceAccess"
> {
  const assignedRoles = normalizeRoles(membership.roles);
  const effectivePermissionIds = membership.permissionRole
    ? resolvePermissionRolePermissionIds(membership.permissionRole)
    : resolveEffectivePermissionIds(adapter, workspaceId, assignedRoles);
  const hasFullWorkspaceAccess = membership.permissionRole
    ? hasWildcardPermission(membership.permissionRole.permissionIds)
    : assignedRoles.includes("hospital_admin");
  const hasOwnerWorkspaceAccess = membership.permissionRole
    ? membership.permissionRole.roleType === "owner"
    : assignedRoles.includes("hospital_admin");

  return {
    assignedRoles,
    effectivePermissionIds,
    hasFullWorkspaceAccess,
    hasOwnerWorkspaceAccess,
    ...(membership.permissionRole ? { assignedPermissionRole: membership.permissionRole } : {}),
    ...(membership.jobPosition ? { jobPosition: membership.jobPosition } : {}),
  };
}

function resolvePermissionRolePermissionIds(
  permissionRole: WorkspaceAssignedPermissionRole
): PermissionId[] {
  if (hasWildcardPermission(permissionRole.permissionIds)) {
    return allPermissionIds;
  }

  return Array.from(
    new Set(permissionRole.permissionIds.filter((permissionId) => {
      return allPermissionIdSet.has(permissionId);
    }))
  ).sort();
}

function hasWildcardPermission(permissionIds: PermissionId[] | ["*"]): permissionIds is ["*"] {
  return permissionIds.length === 1 && permissionIds[0] === "*";
}

function normalizeRoles(roles: WorkspaceRoleId[]): WorkspaceRoleId[] {
  return Array.from(new Set(roles));
}

function createPermissionResultFactory(
  adapter: WorkspacePermissionAdapter,
  request: WorkspacePermissionRequest
) {
  return (
    denialReason: WorkspacePermissionDenialReason,
    userId: string | null = request.sessionUserId ?? null,
    membership?: WorkspaceMembership
  ): WorkspacePermissionResolution => ({
    allowed: false,
    denialReason,
    userId,
    workspaceId: request.workspaceId,
    membershipId: membership?.id ?? null,
    ...(membership
      ? resolveMembershipPermissionContext(adapter, request.workspaceId, membership)
      : {
          assignedRoles: [],
          effectivePermissionIds: [],
          hasFullWorkspaceAccess: false,
          hasOwnerWorkspaceAccess: false,
        }),
  });
}
