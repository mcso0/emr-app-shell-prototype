import "server-only";

import {
  assertLastWorkspaceAdminGuard,
  createMockWorkspacePermissionAdapter,
  resolveWorkspacePermission,
  type WorkspacePermissionAdapter,
  type WorkspacePermissionDenialReason,
  type WorkspaceRoleId,
} from "@/features/auth/permission-resolver";

export type WorkspaceRoleUpdateAuthorizationRequest = {
  actorUserId: string | null;
  workspaceId: string;
  targetMembershipId: string;
  nextRoles: string[];
  adapter?: WorkspacePermissionAdapter;
};

export type WorkspaceRoleUpdateAuthorizationResult =
  | {
      ok: true;
      status: 200;
      workspaceId: string;
      targetMembershipId: string;
      updatedRoles: WorkspaceRoleId[];
      enforcedBy: "server-permission-resolver";
    }
  | {
      ok: false;
      status: 400;
      error: "invalid_roles";
    }
  | {
      ok: false;
      status: 401 | 403 | 404 | 409;
      denialReason:
        | WorkspacePermissionDenialReason
        | "target_membership_missing";
    };

const roleIds = new Set<WorkspaceRoleId>([
  "hospital_admin",
  "vet",
  "technician",
  "front_desk",
]);

export function createDemoRoleUpdatePermissionAdapter({
  now = new Date().toISOString(),
  workspaceId = "workspace-a",
  targetMembershipId = "membership-vet",
}: {
  now?: string;
  workspaceId?: string;
  targetMembershipId?: string;
} = {}) {
  const demoWorkspaceId = workspaceId === "workspace-b" ? "workspace-a" : workspaceId;

  return createMockWorkspacePermissionAdapter({
    now,
    users: [
      { id: "user-admin", status: "active", displayName: "송민재" },
      { id: "user-vet", status: "active", displayName: "이수지" },
      { id: "user-desk", status: "active", displayName: "최유나" },
      { id: "user-tech", status: "active", displayName: "송하윤" },
      { id: "user-suspended", status: "active", displayName: "정지 사용자" },
      { id: "user-no-membership", status: "active", displayName: "외부 사용자" },
    ],
    memberships: [
      {
        id: "membership-admin",
        workspaceId: demoWorkspaceId,
        userId: "user-admin",
        roles: ["hospital_admin"],
        status: "active",
      },
      {
        id: targetMembershipId === "membership-admin" ? "membership-vet" : targetMembershipId,
        workspaceId: demoWorkspaceId,
        userId: "user-vet",
        roles: ["vet"],
        status: "active",
      },
      {
        id: "membership-desk",
        workspaceId: demoWorkspaceId,
        userId: "user-desk",
        roles: ["front_desk"],
        status: "active",
      },
      {
        id: "membership-tech",
        workspaceId: demoWorkspaceId,
        userId: "user-tech",
        roles: ["technician"],
        status: "active",
      },
      {
        id: "membership-suspended",
        workspaceId: demoWorkspaceId,
        userId: "user-suspended",
        roles: ["hospital_admin"],
        status: "suspended",
      },
    ],
  });
}

export function authorizeWorkspaceRoleUpdate({
  actorUserId,
  workspaceId,
  targetMembershipId,
  nextRoles,
  adapter,
}: WorkspaceRoleUpdateAuthorizationRequest): WorkspaceRoleUpdateAuthorizationResult {
  const permissionAdapter =
    adapter ?? createDemoRoleUpdatePermissionAdapter({ workspaceId, targetMembershipId });
  const normalizedRoles = normalizeRequestedRoles(nextRoles);

  if (normalizedRoles.length === 0) {
    return { ok: false, status: 400, error: "invalid_roles" };
  }

  const actorResolution = resolveWorkspacePermission(permissionAdapter, {
    sessionUserId: actorUserId,
    workspaceId,
    requiredPermission: "role_permission:manage",
  });

  if (!actorResolution.allowed) {
    return {
      ok: false,
      status: actorResolution.denialReason === "unauthenticated" ? 401 : 403,
      denialReason: actorResolution.denialReason ?? "permission_missing",
    };
  }

  const targetMembership = permissionAdapter.memberships.find(
    (membership) =>
      membership.workspaceId === workspaceId && membership.id === targetMembershipId
  );

  if (!targetMembership) {
    return {
      ok: false,
      status: 404,
      denialReason: "target_membership_missing",
    };
  }

  const lastAdminGuard = assertLastWorkspaceAdminGuard(permissionAdapter, {
    workspaceId,
    targetMembershipId,
    nextRoles: normalizedRoles,
    nextStatus: targetMembership.status,
  });

  if (!lastAdminGuard.allowed) {
    return {
      ok: false,
      status: 409,
      denialReason: lastAdminGuard.denialReason,
    };
  }

  return {
    ok: true,
    status: 200,
    workspaceId,
    targetMembershipId,
    updatedRoles: normalizedRoles,
    enforcedBy: "server-permission-resolver",
  };
}

function normalizeRequestedRoles(roles: string[]) {
  return Array.from(new Set(roles)).filter(isWorkspaceRoleId);
}

function isWorkspaceRoleId(role: string): role is WorkspaceRoleId {
  return roleIds.has(role as WorkspaceRoleId);
}
