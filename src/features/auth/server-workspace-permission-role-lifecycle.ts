import "server-only";

export type WorkspacePermissionRoleLifecycleAction = "deactivate" | "reactivate";

export function normalizePermissionRoleLifecycleInput(value: unknown): {
  action: WorkspacePermissionRoleLifecycleAction;
  replacementRoleId: string | null;
} | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  if (input.action !== "deactivate" && input.action !== "reactivate") return null;
  const replacementRoleId = typeof input.replacementRoleId === "string" && input.replacementRoleId.trim()
    ? input.replacementRoleId.trim()
    : null;
  if (input.action === "deactivate" && !replacementRoleId) return null;
  return { action: input.action, replacementRoleId };
}

export function mapPermissionRoleLifecycleError(message?: string) {
  if (message?.includes("system_role_protected")) return { status: 409, denialReason: "system_role_protected" } as const;
  if (message?.includes("owner_scope_required")) return { status: 403, denialReason: "owner_scope_required" } as const;
  if (message?.includes("replacement_role_invalid")) return { status: 409, denialReason: "replacement_role_invalid" } as const;
  if (message?.includes("cross_workspace_target")) return { status: 404, denialReason: "cross_workspace_target" } as const;
  if (message?.includes("state_conflict")) return { status: 409, denialReason: "state_conflict" } as const;
  return { status: 403, denialReason: "permission_missing" } as const;
}
