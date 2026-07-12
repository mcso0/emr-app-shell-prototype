import "server-only";

export type WorkspaceJobPositionDefinition = {
  id: string;
  workspaceId: string;
  positionKey: string;
  label: string;
  description: string | null;
  isSystem: boolean;
  isActive: boolean;
  retainedMembershipCount: number;
  pendingInvitationCount: number;
};

export function normalizeJobPositionMutationInput(input: { label: string; description?: string | null }) {
  const label = input.label.trim();
  const description = input.description?.trim() || null;
  return label && label.length <= 80 ? { label, description } : null;
}

export function mapWorkspaceJobPositionDefinition(row: Record<string, unknown>): WorkspaceJobPositionDefinition {
  return {
    id: String(row.id ?? ""),
    workspaceId: String(row.workspace_id ?? ""),
    positionKey: String(row.position_key ?? ""),
    label: String(row.label ?? ""),
    description: typeof row.description === "string" ? row.description : null,
    isSystem: row.is_system === true,
    isActive: row.is_active !== false,
    retainedMembershipCount: Number(row.retained_membership_count ?? 0),
    pendingInvitationCount: Number(row.pending_invitation_count ?? 0),
  };
}
