import { readServerSession } from "@/features/auth/server-session-reader";
import {
  demoSessionUserIdHeader,
  resolveRoleUpdateActorIdentity,
} from "@/features/auth/server-role-update-identity";
import { expandOrderSetForChart } from "@/features/hospital-admin/server-order-catalog";

type RouteContext = {
  params: Promise<{ orderSetId: string; workspaceId: string }>;
};

export async function GET(request: Request, { params }: RouteContext) {
  const { orderSetId, workspaceId } = await params;
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

  const result = await expandOrderSetForChart({
    actorUserId: identity.actorUserId,
    workspaceId,
    orderSetId,
  });

  return Response.json(result, { status: result.status });
}
