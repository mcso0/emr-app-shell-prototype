import "server-only";

import {
  createDemoRoleUpdatePermissionAdapter,
} from "@/features/auth/server-role-update-enforcement";
import {
  resolveWorkspacePermission,
  type WorkspacePermissionAdapter,
  type WorkspacePermissionDenialReason,
} from "@/features/auth/permission-resolver";

export type WorkspaceMembershipArchiveAction = "archive" | "restore";

export type WorkspaceMembershipArchiveAuthorizationResult =
  | {
      ok: true;
      status: 200;
      action: WorkspaceMembershipArchiveAction;
      updatedStatus: "archived" | "inactive";
      workspaceId: string;
      targetMembershipId: string;
      enforcedBy: "server-permission-resolver";
    }
  | {
      ok: false;
      status: 401 | 403 | 404 | 409;
      denialReason:
        | WorkspacePermissionDenialReason
        | "target_membership_missing"
        | "self_action_protected"
        | "owner_target_protected"
        | "last_admin_protected";
    };

export function authorizeWorkspaceMembershipArchive({
  action,
  actorUserId,
  workspaceId,
  targetMembershipId,
  adapter = createDemoRoleUpdatePermissionAdapter({ workspaceId, targetMembershipId }),
}: {
  action: WorkspaceMembershipArchiveAction;
  actorUserId: string | null;
  workspaceId: string;
  targetMembershipId: string;
  adapter?: WorkspacePermissionAdapter;
}): WorkspaceMembershipArchiveAuthorizationResult {
  const permission = resolveWorkspacePermission(adapter, {
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

  const targetMembership = adapter.memberships.find(
    (membership) => membership.workspaceId === workspaceId && membership.id === targetMembershipId
  );

  if (!targetMembership) {
    return { ok: false, status: 404, denialReason: "target_membership_missing" };
  }

  if (targetMembership.userId === actorUserId) {
    return { ok: false, status: 409, denialReason: "self_action_protected" };
  }

  const targetIsOwner = targetMembership.permissionRole
    ? targetMembership.permissionRole.roleType === "owner"
    : targetMembership.roles.includes("hospital_admin");
  if (targetIsOwner && !permission.hasOwnerWorkspaceAccess) {
    return { ok: false, status: 409, denialReason: "owner_target_protected" };
  }

  if (
    action === "archive" &&
    targetIsOwner &&
    targetMembership.status === "active"
  ) {
    const remainingActiveAdmins = adapter.memberships.filter(
      (membership) =>
        membership.workspaceId === workspaceId &&
        membership.id !== targetMembershipId &&
        membership.status === "active" &&
        (membership.permissionRole
          ? membership.permissionRole.roleType === "owner"
          : membership.roles.includes("hospital_admin"))
    );

    if (remainingActiveAdmins.length === 0) {
      return { ok: false, status: 409, denialReason: "last_admin_protected" };
    }
  }

  return {
    ok: true,
    status: 200,
    action,
    updatedStatus: action === "archive" ? "archived" : "inactive",
    workspaceId,
    targetMembershipId,
    enforcedBy: "server-permission-resolver",
  };
}

export function normalizeWorkspaceMembershipArchiveAction(
  value: unknown
): WorkspaceMembershipArchiveAction | null {
  if (value === "archive" || value === "restore") return value;
  if (value === "soft_delete") return "archive";
  return null;
}
