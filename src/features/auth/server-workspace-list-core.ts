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
  logo: {
    revision: number | null;
    url: string | null;
  };
};

export type WorkspaceLogoSummary = {
  workspaceId: string;
  revision: number;
  url: string | null;
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

      const workspace: WorkspaceListItem = {
        id: value.id,
        displayName: value.displayName,
        membershipId: value.membershipId,
        roles,
        status: "active" as const,
        logo: { revision: null, url: null },
      };
      return workspace;
    })
    .filter((item): item is WorkspaceListItem => Boolean(item));
}

export function mergeWorkspaceLogoSummaries(
  workspaces: WorkspaceListItem[],
  summaries: WorkspaceLogoSummary[]
): WorkspaceListItem[] {
  const summaryByWorkspaceId = new Map(
    summaries.map((summary) => [summary.workspaceId, summary])
  );

  return workspaces.map((workspace) => {
    const summary = summaryByWorkspaceId.get(workspace.id);
    return summary
      ? {
          ...workspace,
          logo: {
            revision: summary.revision,
            url: summary.url,
          },
        }
      : workspace;
  });
}

function isWorkspaceRole(role: unknown): role is SessionWorkspaceRole {
  return (
    role === "hospital_admin" ||
    role === "vet" ||
    role === "technician" ||
    role === "front_desk"
  );
}
