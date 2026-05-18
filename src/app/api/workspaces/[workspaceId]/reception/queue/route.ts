import { readServerSession } from "@/features/auth/server-session-reader";
import {
  demoSessionUserIdHeader,
  resolveRoleUpdateActorIdentity,
} from "@/features/auth/server-role-update-identity";
import {
  createSupabaseReceptionQueueReadGateway,
  readReceptionQueue,
  type SupabaseReceptionQueueReadRpcClient,
} from "@/features/reception/server-reception-queue-read";
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
  const result = await readReceptionQueue({
    actorUserId: identity.actorUserId,
    workspaceId,
    gateway: client
      ? createSupabaseReceptionQueueReadGateway(
          client as unknown as SupabaseReceptionQueueReadRpcClient
        )
      : undefined,
  });

  return Response.json(result, { status: result.status });
}
