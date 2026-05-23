import "server-only";

import {
  createMockWorkspacePermissionAdapter,
  resolveWorkspacePermission,
  type WorkspacePermissionAdapter,
  type WorkspacePermissionDenialReason,
} from "@/features/auth/permission-resolver";
import {
  createSessionWorkspaceInvitation,
  isSessionWorkspaceRole,
  normalizeWorkspaceInviteEmail,
  type SessionWorkspaceInvitation,
  type SessionWorkspaceRole,
  type WorkspaceInvitationFieldErrors,
  type WorkspaceInvitationInput,
} from "@/features/auth/workspace-session";
import {
  createNoopWorkspaceInvitationEmailDelivery,
  type WorkspaceInvitationEmailDeliveryAdapter,
  type WorkspaceInvitationEmailDeliveryStatus,
  type WorkspaceInvitationInviteLinkStatus,
} from "@/features/auth/workspace-invitation-email-delivery";

export type WorkspaceInvitationRouteInput = {
  email: string;
  roles: string[];
  title: string;
  department: string;
  expiresAt?: string | null;
};

export type WorkspaceInvitationWrite = {
  workspaceId: string;
  email: string;
  roles: SessionWorkspaceRole[];
  title: string | null;
  department: string | null;
  invitedByUserId: string;
  expiresAt: string;
  now: string;
};

export type WorkspaceInvitationCreatedAuditEvent = {
  type: "workspace.invitation_created";
  workspaceId: string;
  invitationId: string;
  actorUserId: string;
  targetType: "workspace_invitation";
  targetId: string;
  at: string;
  metadata: {
    invitedRoles: SessionWorkspaceRole[];
    invitedEmailDomain: string | null;
  };
};

export type WorkspaceInvitationGatewayResult =
  | { ok: true; invitation: SessionWorkspaceInvitation }
  | {
      ok: false;
      status: 409;
      denialReason: "duplicate_pending_invitation" | "active_membership_exists";
    }
  | { ok: false; status: 500; error: "db_write_failed" };

export type WorkspaceInvitationGateway = {
  createInvitation(
    write: WorkspaceInvitationWrite
  ): Promise<WorkspaceInvitationGatewayResult>;
};

export type WorkspaceInvitationResult =
  | {
      ok: true;
      status: 201;
      workspaceId: string;
      invitation: SessionWorkspaceInvitation;
      auditEvents: WorkspaceInvitationCreatedAuditEvent[];
      emailDelivery: WorkspaceInvitationEmailDeliveryStatus;
      inviteLink: WorkspaceInvitationInviteLinkStatus;
      enforcedBy: "workspace-invitation-server-route";
    }
  | {
      ok: false;
      status: 400;
      error: "invalid_input";
      fieldErrors: WorkspaceInvitationFieldErrors;
    }
  | {
      ok: false;
      status: 401 | 403;
      denialReason: WorkspacePermissionDenialReason;
    }
  | {
      ok: false;
      status: 409;
      denialReason: "duplicate_pending_invitation" | "active_membership_exists";
    }
  | {
      ok: false;
      status: 500;
      error: "db_write_failed" | "supabase_client_missing";
    };

export async function createWorkspaceInvitation({
  actorUserId,
  workspaceId,
  input,
  permissionAdapter = createDemoWorkspaceInvitationPermissionAdapter(workspaceId),
  gateway = createDemoWorkspaceInvitationGateway(),
  emailDelivery = createNoopWorkspaceInvitationEmailDelivery(),
  now = new Date().toISOString(),
}: {
  actorUserId: string | null;
  workspaceId: string;
  input: WorkspaceInvitationRouteInput;
  permissionAdapter?: WorkspacePermissionAdapter;
  gateway?: WorkspaceInvitationGateway;
  emailDelivery?: WorkspaceInvitationEmailDeliveryAdapter;
  now?: string;
}): Promise<WorkspaceInvitationResult> {
  if (!actorUserId) {
    return { ok: false, status: 401, denialReason: "unauthenticated" };
  }

  const normalized = normalizeInvitationInput(input);
  const validation = validateInvitationInput(normalized);

  if (!validation.valid) {
    return {
      ok: false,
      status: 400,
      error: "invalid_input",
      fieldErrors: validation.fieldErrors,
    };
  }

  const permission = resolveWorkspacePermission(permissionAdapter, {
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

  const invitation = createSessionWorkspaceInvitation(
    normalized,
    workspaceId,
    { sessionId: actorUserId, storageMode: "cookie" },
    now
  );
  const write: WorkspaceInvitationWrite = {
    workspaceId,
    email: invitation.email,
    roles: invitation.invitedRoles,
    title: invitation.title,
    department: invitation.department,
    invitedByUserId: actorUserId,
    expiresAt: input.expiresAt && isValidDate(input.expiresAt)
      ? new Date(input.expiresAt).toISOString()
      : invitation.expiresAt,
    now,
  };

  const persisted = await gateway.createInvitation(write);

  if (!persisted.ok) {
    if (persisted.status === 409) {
      return {
        ok: false,
        status: 409,
        denialReason: persisted.denialReason,
      };
    }

    return { ok: false, status: 500, error: persisted.error };
  }

  const delivery = await emailDelivery.sendInvitationEmail({
    workspaceId,
    invitation: persisted.invitation,
  });

  return {
    ok: true,
    status: 201,
    workspaceId,
    invitation: persisted.invitation,
    auditEvents: createWorkspaceInvitationCreatedAuditEvents({
      workspaceId,
      invitation: persisted.invitation,
      actorUserId,
      at: now,
    }),
    emailDelivery: delivery.emailDelivery,
    inviteLink: delivery.inviteLink,
    enforcedBy: "workspace-invitation-server-route",
  };
}

export type SupabaseWorkspaceInvitationRpcClient = {
  rpc(
    functionName: "clair_create_workspace_invitation",
    args: Record<string, unknown>
  ): Promise<{ data: unknown; error: { message?: string } | null }>;
};

export function createSupabaseWorkspaceInvitationGateway(
  client: SupabaseWorkspaceInvitationRpcClient
): WorkspaceInvitationGateway {
  return {
    async createInvitation(write) {
      const { data, error } = await client.rpc("clair_create_workspace_invitation", {
        p_workspace_id: write.workspaceId,
        p_email: write.email,
        p_invited_roles: write.roles,
        p_title: write.title,
        p_department: write.department,
        p_expires_at: write.expiresAt,
      });

      if (error) {
        if (error.message?.includes("duplicate_pending_invitation")) {
          return {
            ok: false,
            status: 409,
            denialReason: "duplicate_pending_invitation",
          };
        }

        if (error.message?.includes("active_membership_exists")) {
          return {
            ok: false,
            status: 409,
            denialReason: "active_membership_exists",
          };
        }

        return { ok: false, status: 500, error: "db_write_failed" };
      }

      return {
        ok: true,
        invitation: mapInvitationRpcData(data, write),
      };
    },
  };
}

function normalizeInvitationInput(input: WorkspaceInvitationRouteInput): WorkspaceInvitationInput {
  return {
    email: normalizeWorkspaceInviteEmail(input.email),
    roles: Array.from(new Set(input.roles)).filter(isSessionWorkspaceRole),
    title: input.title,
    department: input.department,
  };
}

function validateInvitationInput(input: WorkspaceInvitationInput) {
  const fieldErrors: WorkspaceInvitationFieldErrors = {};

  if (!input.email) {
    fieldErrors.email = "초대 이메일을 입력하세요.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
    fieldErrors.email = "올바른 이메일 형식으로 입력하세요.";
  }

  if (input.roles.length === 0) {
    fieldErrors.roles = "하나 이상의 역할을 선택하세요.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { valid: false as const, fieldErrors };
  }

  return { valid: true as const, fieldErrors: {} };
}

function createDemoWorkspaceInvitationGateway(): WorkspaceInvitationGateway {
  return {
    async createInvitation(write) {
      const pendingEmails = new Set(["pending.staff@hanbit.test"]);
      const activeMemberEmails = new Set(["active.member@hanbit.test"]);

      if (pendingEmails.has(write.email)) {
        return {
          ok: false,
          status: 409,
          denialReason: "duplicate_pending_invitation",
        };
      }

      if (activeMemberEmails.has(write.email)) {
        return {
          ok: false,
          status: 409,
          denialReason: "active_membership_exists",
        };
      }

      return {
        ok: true,
        invitation: createSessionWorkspaceInvitation(
          {
            email: write.email,
            roles: write.roles,
            title: write.title ?? "",
            department: write.department ?? "",
          },
          write.workspaceId,
          { sessionId: write.invitedByUserId, storageMode: "cookie" },
          write.now
        ),
      };
    },
  };
}

function createDemoWorkspaceInvitationPermissionAdapter(workspaceId: string) {
  const demoMembershipWorkspaceId = workspaceId === "workspace-b" ? "workspace-a" : workspaceId;

  return createMockWorkspacePermissionAdapter({
    now: new Date().toISOString(),
    users: [
      { id: "user-admin", status: "active", displayName: "송민재" },
      { id: "user-vet", status: "active", displayName: "이수지" },
      { id: "user-desk", status: "active", displayName: "최유나" },
      { id: "user-tech", status: "active", displayName: "송하윤" },
    ],
    memberships: [
      {
        id: "membership-admin",
        workspaceId: demoMembershipWorkspaceId,
        userId: "user-admin",
        roles: ["hospital_admin"],
        status: "active",
      },
      {
        id: "membership-vet",
        workspaceId: demoMembershipWorkspaceId,
        userId: "user-vet",
        roles: ["vet"],
        status: "active",
      },
      {
        id: "membership-desk",
        workspaceId: demoMembershipWorkspaceId,
        userId: "user-desk",
        roles: ["front_desk"],
        status: "active",
      },
      {
        id: "membership-tech",
        workspaceId: demoMembershipWorkspaceId,
        userId: "user-tech",
        roles: ["technician"],
        status: "active",
      },
    ],
  });
}

function mapInvitationRpcData(
  data: unknown,
  fallback: WorkspaceInvitationWrite
): SessionWorkspaceInvitation {
  const value = data as Partial<SessionWorkspaceInvitation>;

  return {
    id: typeof value.id === "string"
      ? value.id
      : `${fallback.workspaceId}:invite:${fallback.email}`,
    workspaceId: value.workspaceId ?? fallback.workspaceId,
    email: value.email ?? fallback.email,
    invitedRoles: Array.isArray(value.invitedRoles)
      ? value.invitedRoles.filter(isSessionWorkspaceRole)
      : fallback.roles,
    title: value.title ?? fallback.title,
    department: value.department ?? fallback.department,
    status: value.status ?? "pending",
    invitedBySessionId: value.invitedBySessionId ?? fallback.invitedByUserId,
    acceptedBySessionId: value.acceptedBySessionId ?? null,
    expiresAt: value.expiresAt ?? fallback.expiresAt,
    acceptedAt: value.acceptedAt ?? null,
    canceledAt: value.canceledAt ?? null,
    resentAt: value.resentAt ?? null,
    resendCount: value.resendCount ?? 0,
    createdAt: value.createdAt ?? fallback.now,
    updatedAt: value.updatedAt ?? fallback.now,
  };
}

function createWorkspaceInvitationCreatedAuditEvents({
  workspaceId,
  invitation,
  actorUserId,
  at,
}: {
  workspaceId: string;
  invitation: SessionWorkspaceInvitation;
  actorUserId: string;
  at: string;
}): WorkspaceInvitationCreatedAuditEvent[] {
  return [
    {
      type: "workspace.invitation_created",
      workspaceId,
      invitationId: invitation.id,
      actorUserId,
      targetType: "workspace_invitation",
      targetId: invitation.id,
      at,
      metadata: {
        invitedRoles: invitation.invitedRoles,
        invitedEmailDomain: invitation.email.split("@")[1] ?? null,
      },
    },
  ];
}

function isValidDate(value: string) {
  return !Number.isNaN(Date.parse(value));
}
