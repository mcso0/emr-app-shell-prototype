import "server-only";

import type {
  SessionWorkspace,
  SessionWorkspaceInvitation,
} from "@/features/auth/workspace-session";
import type { InviteAcceptanceRecord } from "@/features/auth/invite-acceptance-model";
import { createClient } from "@/lib/supabase/server";

export type SupabaseInviteAcceptanceLookupClient = {
  rpc(
    functionName: "clair_get_workspace_invitation_for_acceptance",
    args: Record<string, unknown>,
  ): Promise<{ data: unknown; error: { message?: string } | null }>;
};

export async function readServerInviteAcceptanceRecord({
  invitationId,
  workspaceId,
  email,
}: {
  invitationId: string;
  workspaceId: string | null;
  email: string | null;
}): Promise<InviteAcceptanceRecord | null> {
  if (!workspaceId || !email || !isUuid(invitationId)) return null;

  const client = await createClient();
  if (!client) return null;

  const { data, error } = await (
    client as unknown as SupabaseInviteAcceptanceLookupClient
  ).rpc("clair_get_workspace_invitation_for_acceptance", {
    p_workspace_id: workspaceId,
    p_invitation_id: invitationId,
    p_email: email,
  });

  if (error) return null;

  return mapInviteAcceptanceRpcData(data);
}

function mapInviteAcceptanceRpcData(
  data: unknown,
): InviteAcceptanceRecord | null {
  const value = data as {
    status?: InviteAcceptanceRecord["status"];
    accountState?: InviteAcceptanceRecord["accountState"];
    workspace?: Partial<SessionWorkspace> | null;
    invitation?: Partial<SessionWorkspaceInvitation> | null;
  } | null;

  if (!value || value.status === "missing") {
    return {
      status: "missing",
      accountState: "unknown",
      workspace: null,
      invitation: null,
    };
  }

  if (
    !isInviteAcceptanceStatus(value.status) ||
    !value.workspace?.id ||
    !value.invitation?.id ||
    !value.invitation.email
  ) {
    return null;
  }

  const now = new Date().toISOString();
  const workspace: SessionWorkspace = {
    id: value.workspace.id,
    displayName: value.workspace.displayName ?? value.workspace.id,
    representativeName: "Staging workspace",
    contactEmail: null,
    contactPhone: null,
    subscriptionStatus: "trialing",
    createdBySessionId: value.workspace.createdBySessionId ?? "",
    createdAt: value.workspace.createdAt ?? now,
  };
  const invitation: SessionWorkspaceInvitation = {
    id: value.invitation.id,
    workspaceId: value.invitation.workspaceId ?? workspace.id,
    email: value.invitation.email,
    invitedRoles: Array.isArray(value.invitation.invitedRoles)
      ? value.invitation.invitedRoles.filter(isSessionWorkspaceRole)
      : [],
    title: value.invitation.title ?? null,
    department: value.invitation.department ?? null,
    status: value.status,
    invitedBySessionId: value.invitation.invitedBySessionId ?? "",
    acceptedBySessionId: value.invitation.acceptedBySessionId ?? null,
    expiresAt: value.invitation.expiresAt ?? now,
    acceptedAt: value.invitation.acceptedAt ?? null,
    canceledAt: value.invitation.canceledAt ?? null,
    resentAt: value.invitation.resentAt ?? null,
    resendCount: value.invitation.resendCount ?? 0,
    createdAt: value.invitation.createdAt ?? now,
    updatedAt: value.invitation.updatedAt ?? now,
  };

  return {
    status: value.status,
    accountState: isInviteAcceptanceAccountState(value.accountState)
      ? value.accountState
      : "unknown",
    workspace,
    invitation,
  };
}

function isInviteAcceptanceStatus(
  status: unknown,
): status is InviteAcceptanceRecord["status"] {
  return (
    status === "pending" ||
    status === "expired" ||
    status === "canceled" ||
    status === "accepted" ||
    status === "missing"
  );
}

function isSessionWorkspaceRole(
  role: string,
): role is SessionWorkspaceInvitation["invitedRoles"][number] {
  return (
    role === "hospital_admin" ||
    role === "vet" ||
    role === "technician" ||
    role === "front_desk"
  );
}

function isInviteAcceptanceAccountState(
  value: unknown,
): value is InviteAcceptanceRecord["accountState"] {
  return value === "new" || value === "existing" || value === "unknown";
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
