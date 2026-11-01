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
  createSupabaseOrderActualDispenseGateway,
  saveOrderActualDispense,
  type SupabaseOrderActualDispenseRpcClient,
} from "@/features/chart/server-order-actual-dispense";
import { enforceWorkspaceMutationRateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ orderId: string; workspaceId: string }>;
};
type RequestBody = {
  actualQuantity?: number;
  expectedOrderUpdatedAt?: string;
  idempotencyKey?: string;
  mode?: "manual" | "automatic" | "reconfirm" | "legacy";
  reason?: string | null;
};

export async function PATCH(request: Request, { params }: RouteContext) {
  const { orderId, workspaceId } = await params;
  const body = await readBody(request);
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
  const rateLimitResponse = enforceWorkspaceMutationRateLimit({
    actorUserId: identity.actorUserId,
    operation: "order_actual_dispense",
    request,
    workspaceId,
  });
  if (rateLimitResponse) return rateLimitResponse;

  const client = identity.source === "supabase_session" ? await createClient() : null;
  const permissionAdapter = client
    ? await loadWorkspacePermissionAdapterFromDb({
        gateway: createSupabaseWorkspacePermissionGateway(
          client as unknown as SupabaseWorkspacePermissionClient,
        ),
        sessionUserId: identity.actorUserId,
        workspaceId,
      })
    : undefined;
  const result = await saveOrderActualDispense({
    actorUserId: identity.actorUserId,
    actualQuantity: body.actualQuantity,
    expectedOrderUpdatedAt: body.expectedOrderUpdatedAt,
    gateway: client
      ? createSupabaseOrderActualDispenseGateway(
          client as unknown as SupabaseOrderActualDispenseRpcClient,
        )
      : undefined,
    idempotencyKey: body.idempotencyKey,
    orderId,
    permissionAdapter,
    mode: body.mode,
    reason: body.mode === "legacy" ? body.reason : undefined,
    workspaceId,
  });
  return Response.json(result, { status: result.status });
}

async function readBody(request: Request): Promise<RequestBody> {
  try {
    const value = (await request.json()) as unknown;
    return value && typeof value === "object" ? (value as RequestBody) : {};
  } catch {
    return {};
  }
}
