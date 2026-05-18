import { readServerSession } from "@/features/auth/server-session-reader";
import {
  demoSessionUserIdHeader,
  resolveRoleUpdateActorIdentity,
} from "@/features/auth/server-role-update-identity";
import {
  createSupabaseWorkspaceInvitationLifecycleGateway,
  mutateWorkspaceInvitationLifecycle,
  type SupabaseWorkspaceInvitationLifecycleRpcClient,
} from "@/features/auth/server-workspace-invitation-lifecycle";
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
    operation: "workspace_invitation_cancel",
  });
  if (rateLimitResponse) return rateLimitResponse;

  const client = identity.source === "supabase_session" ? await createClient() : null;
  const result = await mutateWorkspaceInvitationLifecycle({
    actorUserId: identity.actorUserId,
    workspaceId,
    invitationId,
    action: "cancel",
    gateway: client
      ? createSupabaseWorkspaceInvitationLifecycleGateway(
          client as unknown as SupabaseWorkspaceInvitationLifecycleRpcClient
        )
      : undefined,
  });

  return Response.json(result, { status: result.statusCode });
}
