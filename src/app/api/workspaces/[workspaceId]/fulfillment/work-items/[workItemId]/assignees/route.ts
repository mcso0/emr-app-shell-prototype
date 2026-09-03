import { readServerSession } from "@/features/auth/server-session-reader";
import {
  demoSessionUserIdHeader,
  resolveRoleUpdateActorIdentity,
} from "@/features/auth/server-role-update-identity";
import {
  createSupabaseFulfillmentEligibleAssigneeGateway,
  readFulfillmentEligibleAssignees,
  type SupabaseFulfillmentEligibleAssigneeRpcClient,
} from "@/features/fulfillment/server-fulfillment-assignee";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ workItemId: string; workspaceId: string }>;
};

export async function GET(request: Request, { params }: RouteContext) {
  const { workItemId, workspaceId } = await params;
  const identity = resolveRoleUpdateActorIdentity({
    demoHeaderUserId: request.headers.get(demoSessionUserIdHeader),
    serverSession: await readServerSession(),
  });
  if (!identity.ok) {
    return Response.json(
      { denialReason: identity.denialReason, ok: false },
      { status: 401 },
    );
  }
  const client = identity.source === "supabase_session" ? await createClient() : null;
  const result = await readFulfillmentEligibleAssignees({
    actorUserId: identity.actorUserId,
    gateway: client
      ? createSupabaseFulfillmentEligibleAssigneeGateway(
          client as unknown as SupabaseFulfillmentEligibleAssigneeRpcClient,
        )
      : undefined,
    workItemId,
    workspaceId,
  });
  return Response.json(result, { status: result.status });
}
