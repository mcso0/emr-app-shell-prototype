import { readServerSession } from "@/features/auth/server-session-reader";
import {
  demoSessionUserIdHeader,
  resolveRoleUpdateActorIdentity,
} from "@/features/auth/server-role-update-identity";
import {
  createSupabaseWorkspaceMembershipStatusGateway,
  readWorkspaceMembershipStatus,
  type SupabaseWorkspaceMembershipStatusRpcClient,
} from "@/features/auth/server-workspace-membership-status";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{
    workspaceId: string;
  }>;
};

export async function GET(request: Request, { params }: RouteContext) {
  const { workspaceId } = await params;
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

  const client = identity.source === "supabase_session" ? await createClient() : null;
  const result = await readWorkspaceMembershipStatus({
    actorUserId: identity.actorUserId,
    workspaceId,
    gateway: client
      ? createSupabaseWorkspaceMembershipStatusGateway(
          client as unknown as SupabaseWorkspaceMembershipStatusRpcClient,
          workspaceId
        )
      : undefined,
  });

  return Response.json(result, { status: result.status });
}
