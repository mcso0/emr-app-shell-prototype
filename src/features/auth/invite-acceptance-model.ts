import type {
  SessionWorkspace,
  SessionWorkspaceInvitation,
  SessionWorkspaceRole,
} from "@/features/auth/workspace-session";

export type InviteAcceptanceStatus =
  | "pending"
  | "expired"
  | "canceled"
  | "accepted"
  | "missing";

export type InviteAcceptanceAccountState = "new" | "existing" | "unknown";

export type InviteAcceptanceRecord = {
  status: InviteAcceptanceStatus;
  accountState: InviteAcceptanceAccountState;
  workspace: SessionWorkspace | null;
  invitation: SessionWorkspaceInvitation | null;
};

const inviteNow = "2026-05-20T00:00:00.000Z";
const futureExpiry = "2026-05-27T00:00:00.000Z";
const pastExpiry = "2026-05-19T00:00:00.000Z";

const workspaceA: SessionWorkspace = {
  id: "workspace-a",
  displayName: "한빛동물병원",
  representativeName: "송민재",
  contactEmail: "admin@hanbit.test",
  contactPhone: null,
  subscriptionStatus: "trialing",
  createdBySessionId: "user-admin",
  createdAt: inviteNow,
};

export function resolveInviteAcceptanceRecord({
  invitationId,
  workspaceId,
  email,
}: {
  invitationId: string;
  workspaceId: string | null;
  email?: string | null;
}): InviteAcceptanceRecord {
  if (workspaceId !== workspaceA.id) {
    return {
      status: "missing",
      accountState: "unknown",
      workspace: null,
      invitation: null,
    };
  }

  if (invitationId === "invitation-pending") {
    return {
      status: "pending",
      accountState: "new",
      workspace: workspaceA,
      invitation: createInvitation({
        id: invitationId,
        email: email ?? "vet@hanbit.test",
        status: "pending",
        roles: ["vet"],
        expiresAt: futureExpiry,
      }),
    };
  }

  if (invitationId === "invitation-admin-pending") {
    return {
      status: "pending",
      accountState: "new",
      workspace: workspaceA,
      invitation: createInvitation({
        id: invitationId,
        email: email ?? "admin2@hanbit.test",
        status: "pending",
        roles: ["hospital_admin"],
        expiresAt: futureExpiry,
      }),
    };
  }

  if (invitationId === "invitation-existing-account") {
    return {
      status: "pending",
      accountState: "existing",
      workspace: workspaceA,
      invitation: createInvitation({
        id: invitationId,
        email: email ?? "vet@hanbit.test",
        status: "pending",
        roles: ["vet"],
        expiresAt: futureExpiry,
      }),
    };
  }

  if (invitationId === "invitation-expired") {
    return {
      status: "expired",
      accountState: "unknown",
      workspace: workspaceA,
      invitation: createInvitation({
        id: invitationId,
        email: email ?? "expired@hanbit.test",
        status: "expired",
        roles: ["front_desk"],
        expiresAt: pastExpiry,
      }),
    };
  }

  if (invitationId === "invitation-canceled") {
    return {
      status: "canceled",
      accountState: "unknown",
      workspace: workspaceA,
      invitation: createInvitation({
        id: invitationId,
        email: email ?? "canceled@hanbit.test",
        status: "canceled",
        roles: ["technician"],
        expiresAt: futureExpiry,
      }),
    };
  }

  if (invitationId === "invitation-accepted") {
    return {
      status: "accepted",
      accountState: "existing",
      workspace: workspaceA,
      invitation: createInvitation({
        id: invitationId,
        email: email ?? "accepted@hanbit.test",
        status: "accepted",
        roles: ["vet"],
        expiresAt: futureExpiry,
      }),
    };
  }

  return {
    status: "missing",
    accountState: "unknown",
    workspace: null,
    invitation: null,
  };
}

function createInvitation({
  id,
  email,
  status,
  roles,
  expiresAt,
}: {
  id: string;
  email: string;
  status: SessionWorkspaceInvitation["status"];
  roles: SessionWorkspaceRole[];
  expiresAt: string;
}): SessionWorkspaceInvitation {
  return {
    id,
    workspaceId: workspaceA.id,
    email: email.trim().toLowerCase(),
    invitedRoles: roles,
    title: "초대 구성원",
    department: "진료팀",
    status,
    invitedBySessionId: "user-admin",
    acceptedBySessionId: status === "accepted" ? `invitee:${email}` : null,
    expiresAt,
    acceptedAt: status === "accepted" ? inviteNow : null,
    canceledAt: status === "canceled" ? inviteNow : null,
    resentAt: null,
    resendCount: 0,
    createdAt: inviteNow,
    updatedAt: inviteNow,
  };
}
