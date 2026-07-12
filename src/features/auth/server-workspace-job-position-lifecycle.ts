import "server-only";

export function normalizeJobPositionLifecycleInput(value: unknown): {
  action: "deactivate" | "reactivate";
  pendingInvitationReplacementPositionId: string | null;
} | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  if (input.action !== "deactivate" && input.action !== "reactivate") return null;
  const replacement = typeof input.pendingInvitationReplacementPositionId === "string" && input.pendingInvitationReplacementPositionId.trim()
    ? input.pendingInvitationReplacementPositionId.trim()
    : null;
  return { action: input.action, pendingInvitationReplacementPositionId: replacement };
}

export function mapJobPositionLifecycleError(message?: string) {
  if (message?.includes("replacement_position_required")) return { status: 409, denialReason: "replacement_position_required" } as const;
  if (message?.includes("replacement_position_invalid")) return { status: 409, denialReason: "replacement_position_invalid" } as const;
  if (message?.includes("cross_workspace_target")) return { status: 404, denialReason: "cross_workspace_target" } as const;
  if (message?.includes("state_conflict")) return { status: 409, denialReason: "state_conflict" } as const;
  return { status: 403, denialReason: "permission_missing" } as const;
}
