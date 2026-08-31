import { readServerSession } from "@/features/auth/server-session-reader";
import { loadWorkspacePermissionAdapterFromDb } from "@/features/auth/db-workspace-permission-adapter";
import {
  demoSessionUserIdHeader,
  resolveRoleUpdateActorIdentity,
} from "@/features/auth/server-role-update-identity";
import {
  createSupabaseWorkspacePermissionGateway,
  type SupabaseWorkspacePermissionClient,
} from "@/features/auth/supabase-workspace-permission-gateway";
import {
  createSupabaseChartOrderExecutionMutationGateway,
  mutateChartOrderExecution,
  type ChartOrderExecutionMutationInput,
  type SupabaseChartOrderExecutionMutationRpcClient,
} from "@/features/chart/server-order-execution-mutation";
import { enforceWorkspaceMutationRateLimit } from "@/lib/security/rate-limit";
import { createServerTimingRecorder } from "@/lib/http/server-timing";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{
    workspaceId: string;
  }>;
};

export async function POST(request: Request, { params }: RouteContext) {
  const timing = createServerTimingRecorder({
    method: "POST",
    route: "chart_order_execution_mutation",
  });
  const { workspaceId } = await params;
  const identity = await timing.measure("session", async () =>
    resolveRoleUpdateActorIdentity({
      serverSession: await readServerSession(),
      demoHeaderUserId: request.headers.get(demoSessionUserIdHeader),
    }),
  );

  if (!identity.ok) {
    return timing.respond(
      Response.json(
        {
          ok: false,
          denialReason: identity.denialReason,
          sessionStatus: identity.sessionStatus,
          sessionReason: identity.sessionReason,
        },
        { status: 401 },
      ),
    );
  }

  const rateLimitResponse = enforceWorkspaceMutationRateLimit({
    request,
    actorUserId: identity.actorUserId,
    workspaceId,
    operation: "chart_order_execution_mutation",
  });
  if (rateLimitResponse) return timing.respond(rateLimitResponse);

  const input = await readJsonBody(request);
  const permissionContext = await timing.measure("permission", async () => {
    const client = identity.source === "supabase_session" ? await createClient() : null;
    const permissionAdapter = client
      ? await loadWorkspacePermissionAdapterFromDb({
          gateway: createSupabaseWorkspacePermissionGateway(
            client as unknown as SupabaseWorkspacePermissionClient,
          ),
          workspaceId,
          sessionUserId: identity.actorUserId,
        })
      : undefined;
    return { client, permissionAdapter };
  });
  const result = await timing.measure("rpc", () =>
    mutateChartOrderExecution({
      actorUserId: identity.actorUserId,
      workspaceId,
      input,
      permissionAdapter: permissionContext.permissionAdapter,
      gateway: permissionContext.client
        ? createSupabaseChartOrderExecutionMutationGateway(
            permissionContext.client as unknown as SupabaseChartOrderExecutionMutationRpcClient,
          )
        : undefined,
    }),
  );

  return timing.respond(Response.json(result, { status: result.status }));
}

async function readJsonBody(request: Request): Promise<ChartOrderExecutionMutationInput> {
  try {
    const value = (await request.json()) as unknown;
    return value && typeof value === "object"
      ? value as ChartOrderExecutionMutationInput
      : {};
  } catch {
    return {};
  }
}
