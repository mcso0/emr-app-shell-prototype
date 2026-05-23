import { readServerSession } from "@/features/auth/server-session-reader";
import {
  demoSessionUserIdHeader,
  resolveRoleUpdateActorIdentity,
} from "@/features/auth/server-role-update-identity";
import {
  type WorkspaceMembershipStatus,
  type WorkspacePermissionAdapter,
  type WorkspaceRoleId,
} from "@/features/auth/permission-resolver";
import {
  createSupabaseWorkspaceInvitationLifecycleGateway,
  mutateWorkspaceInvitationLifecycle,
  type SupabaseWorkspaceInvitationLifecycleRpcClient,
} from "@/features/auth/server-workspace-invitation-lifecycle";
import {
  createSupabaseWorkspaceMembershipStatusGateway,
  type WorkspaceMembershipStatusGateway,
  type SupabaseWorkspaceMembershipStatusRpcClient,
} from "@/features/auth/server-workspace-membership-status";
import {
  createResendWorkspaceInvitationEmailDelivery,
} from "@/features/auth/workspace-invitation-email-delivery";
import { enforceWorkspaceMutationRateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{
    workspaceId: string;
    invitationId: string;
  }>;
};

export async function POST(request: Request, { params }: RouteContext) {
  const { workspaceId, invitationId } = await params;
  const serverSession = await readServerSession();
  const identity = resolveRoleUpdateActorIdentity({
    serverSession,
    demoHeaderUserId: request.headers.get(demoSessionUserIdHeader),
  });

  if (!identity.ok) {
    return Response.json(
      {
        ok: false,
        denialReason: identity.denialReason,
        sessionStatus: identity.sessionStatus,
        sessionReason: identity.sessionReason,
      },
      { status: 401 }
    );
  }

  const rateLimitResponse = enforceWorkspaceMutationRateLimit({
    request,
    actorUserId: identity.actorUserId,
    workspaceId,
    operation: "workspace_invitation_resend",
  });
  if (rateLimitResponse) return rateLimitResponse;

  const client = identity.source === "supabase_session" ? await createClient() : null;
  const membershipStatusGateway = client
    ? createSupabaseWorkspaceMembershipStatusGateway(
        client as unknown as SupabaseWorkspaceMembershipStatusRpcClient,
        workspaceId
      )
    : null;
  const membershipStatus = membershipStatusGateway
    ? await membershipStatusGateway.listWorkspaceMembershipStatus()
    : null;
  const permissionAdapter = client
    ? createPermissionAdapterFromMembershipStatus({
        actorUserId: identity.actorUserId,
        membershipStatus,
      })
    : undefined;
  const result = await mutateWorkspaceInvitationLifecycle({
    actorUserId: identity.actorUserId,
    workspaceId,
    invitationId,
    action: "resend",
    permissionAdapter,
    gateway: client
      ? createSupabaseWorkspaceInvitationLifecycleGateway(
          client as unknown as SupabaseWorkspaceInvitationLifecycleRpcClient
        )
      : undefined,
  });

  if (!result.ok) {
    return Response.json(result, { status: result.statusCode });
  }

  const delivery = await sendResentInvitationEmail({
    membershipStatus,
    workspaceId,
    invitationId,
    requestOrigin: new URL(request.url).origin,
  });

  return Response.json({ ...result, ...delivery }, { status: result.statusCode });
}

async function sendResentInvitationEmail({
  membershipStatus,
  workspaceId,
  invitationId,
  requestOrigin,
}: {
  membershipStatus: Awaited<
    ReturnType<WorkspaceMembershipStatusGateway["listWorkspaceMembershipStatus"]>
  > | null;
  workspaceId: string;
  invitationId: string;
  requestOrigin: string;
}) {
  if (!membershipStatus) {
    return {
      emailDelivery: "not_sent_approval_gated" as const,
      inviteLink: "not_generated_approval_gated" as const,
    };
  }

  if (!membershipStatus.ok) {
    return {
      emailDelivery: "failed_resend_delivery" as const,
      inviteLink: "not_generated_approval_gated" as const,
    };
  }

  const invitation = membershipStatus.invitations.find(
    (candidate) => candidate.id === invitationId
  );

  if (!invitation) {
    return {
      emailDelivery: "failed_resend_delivery" as const,
      inviteLink: "not_generated_approval_gated" as const,
    };
  }

  return createResendWorkspaceInvitationEmailDelivery({
    requestOrigin,
  }).sendInvitationEmail({ workspaceId, invitation });
}

function createPermissionAdapterFromMembershipStatus({
  actorUserId,
  membershipStatus,
}: {
  actorUserId: string;
  membershipStatus: Awaited<
    ReturnType<WorkspaceMembershipStatusGateway["listWorkspaceMembershipStatus"]>
  > | null;
}): WorkspacePermissionAdapter {
  if (!membershipStatus?.ok) {
    return {
      now: new Date().toISOString(),
      users: [{ id: actorUserId, status: "active" }],
      memberships: [],
    };
  }

  return {
    now: new Date().toISOString(),
    users: [{ id: actorUserId, status: "active" }],
    memberships: membershipStatus.memberships.map((membership) => ({
      id: membership.id,
      workspaceId: membership.workspaceId,
      userId: membership.userSessionId,
      roles: membership.roles.filter(isWorkspaceRoleId),
      status: normalizeMembershipStatus(membership.status),
    })),
  };
}

function isWorkspaceRoleId(role: string): role is WorkspaceRoleId {
  return (
    role === "hospital_admin" ||
    role === "vet" ||
    role === "technician" ||
    role === "front_desk"
  );
}

function normalizeMembershipStatus(status: string): WorkspaceMembershipStatus {
  if (status === "active" || status === "inactive" || status === "pending") {
    return status;
  }

  return "inactive";
}
