import type {
  SessionWorkspaceMembershipStatus,
  SessionWorkspaceRole,
} from "@/features/auth/workspace-session";

export type WorkspaceListItem = {
  id: string;
  displayName: string;
  membershipId: string;
  roles: SessionWorkspaceRole[];
  status: Extract<SessionWorkspaceMembershipStatus, "active">;
};

export function mapActiveWorkspaceListData(data: unknown): WorkspaceListItem[] {
  if (!Array.isArray(data)) return [];

  return data
    .map((item) => {
      const value = item as Partial<WorkspaceListItem>;
      const roles = Array.isArray(value.roles)
        ? value.roles.filter(isWorkspaceRole)
        : [];

      if (
        typeof value.id !== "string" ||
        typeof value.displayName !== "string" ||
        typeof value.membershipId !== "string" ||
        value.status !== "active" ||
        roles.length === 0
      ) {
        return null;
      }

      return {
        id: value.id,
        displayName: value.displayName,
        membershipId: value.membershipId,
        roles,
        status: "active" as const,
      };
    })
    .filter((item): item is WorkspaceListItem => Boolean(item));
}

function isWorkspaceRole(role: unknown): role is SessionWorkspaceRole {
  return (
    role === "hospital_admin" ||
    role === "vet" ||
    role === "technician" ||
    role === "front_desk"
  );
}
