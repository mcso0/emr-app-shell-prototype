import "server-only";

export type WorkspacePermissionRoleDefinition = {
  id: string;
  workspaceId: string;
  roleKey: string;
  label: string;
  description: string | null;
  roleType: "owner" | "admin" | "standard" | "custom";
  permissionIds: string[];
  status: "active" | "inactive";
  isSystem: boolean;
  isAssignable: boolean;
  affectedMembershipCount: number;
  pendingInvitationCount: number;
};

export type PermissionRoleMutationInput = {
  label: string;
  description?: string | null;
  permissionIds: string[];
};

export function normalizePermissionRoleMutationInput(input: PermissionRoleMutationInput) {
  const label = input.label.trim();
  const description = input.description?.trim() || null;
  const permissionIds = Array.from(new Set(input.permissionIds.map((value) => value.trim()).filter(Boolean)));
  if (!label || label.length > 80 || permissionIds.includes("workspace:transfer_owner")) return null;
  return { label, description, permissionIds };
}

export function mapWorkspacePermissionRoleDefinition(row: Record<string, unknown>): WorkspacePermissionRoleDefinition {
  const permissions = isRecord(row.permissions) && Array.isArray(row.permissions.allowed)
    ? row.permissions.allowed.filter((value): value is string => typeof value === "string")
    : [];
  return {
    id: String(row.id ?? ""),
    workspaceId: String(row.workspace_id ?? ""),
    roleKey: String(row.role_key ?? ""),
    label: String(row.label ?? ""),
    description: typeof row.description === "string" ? row.description : null,
    roleType: isRoleType(row.role_type) ? row.role_type : "custom",
    permissionIds: permissions,
    status: row.status === "inactive" ? "inactive" : "active",
    isSystem: row.is_system === true,
    isAssignable: row.is_assignable !== false,
    affectedMembershipCount: Number(row.affected_membership_count ?? 0),
    pendingInvitationCount: Number(row.pending_invitation_count ?? 0),
  };
}

function isRoleType(value: unknown): value is WorkspacePermissionRoleDefinition["roleType"] {
  return value === "owner" || value === "admin" || value === "standard" || value === "custom";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}
