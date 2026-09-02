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
  createSupabaseOrderIntendedAssigneeGateway,
  readOrderIntendedAssignees,
  saveOrderIntendedAssignee,
  type SupabaseOrderIntendedAssigneeRpcClient,
} from "@/features/chart/server-order-intended-assignee";
import { enforceWorkspaceMutationRateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ orderId: string; workspaceId: string }>;
};
type RequestBody = {
  expectedOrderUpdatedAt?: string;
  idempotencyKey?: string;
  intendedAssigneeUserId?: string | null;
};

async function getContext(request: Request, workspaceId: string) {
  const identity = resolveRoleUpdateActorIdentity({
    demoHeaderUserId: request.headers.get(demoSessionUserIdHeader),
    serverSession: await readServerSession(),
  });
  if (!identity.ok) return { identity } as const;
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
  const gateway = client
    ? createSupabaseOrderIntendedAssigneeGateway(
        client as unknown as SupabaseOrderIntendedAssigneeRpcClient,
      )
    : undefined;
  return { gateway, identity, permissionAdapter } as const;
}

export async function GET(request: Request, { params }: RouteContext) {
  const { orderId, workspaceId } = await params;
  const context = await getContext(request, workspaceId);
  if (!context.identity.ok) {
    return Response.json(
      { denialReason: context.identity.denialReason, ok: false },
      { status: 401 },
    );
  }
  const result = await readOrderIntendedAssignees({
    actorUserId: context.identity.actorUserId,
    gateway: context.gateway,
    orderId,
    permissionAdapter: context.permissionAdapter,
    workspaceId,
  });
  return Response.json(result, { status: result.status });
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const { orderId, workspaceId } = await params;
  const body = await readBody(request);
  const context = await getContext(request, workspaceId);
  if (!context.identity.ok) {
    return Response.json(
      { denialReason: context.identity.denialReason, ok: false },
      { status: 401 },
    );
  }
  const rateLimitResponse = enforceWorkspaceMutationRateLimit({
    actorUserId: context.identity.actorUserId,
    operation: "order_intended_assignee",
    request,
    workspaceId,
  });
  if (rateLimitResponse) return rateLimitResponse;
  const result = await saveOrderIntendedAssignee({
    actorUserId: context.identity.actorUserId,
    expectedOrderUpdatedAt: body.expectedOrderUpdatedAt,
    gateway: context.gateway,
    idempotencyKey: body.idempotencyKey,
    intendedAssigneeUserId: body.intendedAssigneeUserId,
    orderId,
    permissionAdapter: context.permissionAdapter,
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
