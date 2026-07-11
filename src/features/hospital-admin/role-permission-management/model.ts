import {
  SESSION_WORKSPACE_OWNER_ONLY_PERMISSION_IDS,
  SESSION_WORKSPACE_SAFE_CUSTOM_PERMISSION_CATALOG,
  getSessionWorkspaceEffectivePermissionRoleKey,
  getSessionWorkspacePermissionRoles,
  type SessionWorkspaceMembership,
  type SessionWorkspacePermissionRole,
  type SessionWorkspacesState,
} from "@/features/auth/workspace-session";

export type RolePermissionGroupId =
  | "reception_customer"
  | "clinical"
  | "fulfillment"
  | "billing"
  | "hospital_admin"
  | "owner_only";

export type RolePermissionRow = {
  id: string;
  label: string;
  allowed: boolean;
  editable: boolean;
  lockReason: "owner_only" | "system_role" | null;
};

export type RolePermissionGroup = {
  id: RolePermissionGroupId;
  label: string;
  allowedCount: number;
  rows: RolePermissionRow[];
};

export type RoleDraft = {
  roleKey: string | null;
  label: string;
  description: string;
  permissionIds: string[];
};

export type RoleDraftValidationResult =
  | { valid: true }
  | { valid: false; reason: "empty_label" | "empty_permissions" | "owner_only_permission" | "invalid_permission" };

export type RoleManagementViewer = {
  id: string;
  role: string;
} | null;

const groupDefinitions: Array<{
  id: Exclude<RolePermissionGroupId, "owner_only">;
  label: string;
  permissionIds: string[];
}> = [
  {
    id: "reception_customer",
    label: "접수 · 고객",
    permissionIds: ["reception:view", "reception:create", "reception:update", "patient:view"],
  },
  {
    id: "clinical",
    label: "진료 · 차트",
    permissionIds: ["chart:view", "chart:update", "order:request", "order:update"],
  },
  {
    id: "fulfillment",
    label: "검사 · 조제",
    permissionIds: ["lab:complete"],
  },
  {
    id: "billing",
    label: "수납",
    permissionIds: ["billing:view", "billing:issue"],
  },
  {
    id: "hospital_admin",
    label: "병원 관리",
    permissionIds: ["service_catalog:view"],
  },
];

const permissionLabels = new Map<string, string>(
  SESSION_WORKSPACE_SAFE_CUSTOM_PERMISSION_CATALOG.map((permission) => [permission.id, permission.label])
);
const safePermissionIds = new Set<string>(permissionLabels.keys());
const ownerOnlyPermissionIds = new Set<string>(SESSION_WORKSPACE_OWNER_ONLY_PERMISSION_IDS);
const ownerOnlyRows = [
  { id: "workspace:delete", label: "워크스페이스 삭제" },
  { id: "workspace:ownership_transfer", label: "소유권 이전" },
  { id: "billing:contract_manage", label: "계약 및 청구 관리" },
  { id: "data:dangerous_delete", label: "위험 데이터 삭제" },
];

function roleAllows(role: SessionWorkspacePermissionRole, permissionId: string) {
  return role.permissionIds.includes("*") || role.permissionIds.includes(permissionId);
}

export function buildRolePermissionGroups(role: SessionWorkspacePermissionRole): RolePermissionGroup[] {
  const groups = groupDefinitions.map((group) => {
    const rows: RolePermissionRow[] = group.permissionIds.map((permissionId) => ({
      id: permissionId,
      label: permissionLabels.get(permissionId) ?? permissionId,
      allowed: roleAllows(role, permissionId),
      editable: !role.isSystem,
      lockReason: role.isSystem ? ("system_role" as const) : null,
    }));

    return {
      ...group,
      allowedCount: rows.filter((row) => row.allowed).length,
      rows,
    };
  });

  const ownerRows: RolePermissionRow[] = ownerOnlyRows.map((permission) => ({
    ...permission,
    allowed: role.roleType === "owner",
    editable: false,
    lockReason: "owner_only" as const,
  }));

  return [
    ...groups,
    {
      id: "owner_only",
      label: "소유자 전용",
      allowedCount: ownerRows.filter((row) => row.allowed).length,
      rows: ownerRows,
    },
  ];
}

export function getRoleAssignedMembers(
  state: Pick<SessionWorkspacesState, "memberships">,
  workspaceId: string,
  roleKey: string
) {
  return state.memberships.filter(
    (membership) =>
      membership.workspaceId === workspaceId &&
      membership.status === "active" &&
      getSessionWorkspaceEffectivePermissionRoleKey(membership) === roleKey
  );
}

export function createRoleDraft(role?: SessionWorkspacePermissionRole | null): RoleDraft {
  return {
    roleKey: role?.isSystem ? null : role?.roleKey ?? null,
    label: role?.isSystem ? "" : role?.label ?? "",
    description: role?.isSystem ? "" : role?.description ?? "",
    permissionIds: (role?.permissionIds ?? []).filter((permissionId) => safePermissionIds.has(permissionId)),
  };
}

export function isRoleDraftDirty(draft: RoleDraft, role?: SessionWorkspacePermissionRole | null) {
  const saved = createRoleDraft(role);
  const draftPermissions = [...draft.permissionIds].sort();
  const savedPermissions = [...saved.permissionIds].sort();

  return (
    draft.roleKey !== saved.roleKey ||
    draft.label.trim() !== saved.label.trim() ||
    draft.description.trim() !== saved.description.trim() ||
    draftPermissions.join("|") !== savedPermissions.join("|")
  );
}

export function validateRoleDraft(draft: RoleDraft): RoleDraftValidationResult {
  if (!draft.label.trim()) return { valid: false, reason: "empty_label" };

  const permissionIds = Array.from(new Set(draft.permissionIds.map((permissionId) => permissionId.trim()).filter(Boolean)));
  if (permissionIds.length === 0) return { valid: false, reason: "empty_permissions" };
  if (permissionIds.some((permissionId) => ownerOnlyPermissionIds.has(permissionId))) {
    return { valid: false, reason: "owner_only_permission" };
  }
  if (permissionIds.some((permissionId) => !safePermissionIds.has(permissionId))) {
    return { valid: false, reason: "invalid_permission" };
  }

  return { valid: true };
}

export function getRoleMemberLabel(member: SessionWorkspaceMembership) {
  return member.displayName || member.email || member.userSessionId;
}

export function getRoleManagementAccess(
  state: Pick<SessionWorkspacesState, "memberships" | "permissionRoles">,
  workspaceId: string,
  viewer: RoleManagementViewer
) {
  const canManage = viewer?.role === "hospital_admin" || viewer?.role === "supabase";
  const membership = viewer
    ? state.memberships.find(
        (item) =>
          item.workspaceId === workspaceId && item.userSessionId === viewer.id && item.status === "active"
      )
    : null;
  const permissionRole = membership
    ? getSessionWorkspacePermissionRoles(state, workspaceId).find(
        (role) => role.roleKey === getSessionWorkspaceEffectivePermissionRoleKey(membership)
      )
    : null;
  const canView =
    canManage ||
    Boolean(
      permissionRole?.permissionIds.includes("*") ||
        permissionRole?.permissionIds.includes("role_permission:view")
    );

  return { canManage, canView };
}
