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
import { demoClientSessionIdHeader } from "@/features/auth/demo-actor";
import {
  createSupabaseLiveAuditAppendGateway,
  type SupabaseLiveAuditAppendRpcClient,
} from "@/features/audit/server-audit-log-persistence";
import { getAuditRequestId } from "@/features/audit/server-mutation-audit";
import {
  listOrderCatalogForAdmin,
  getDemoOrderCatalogGateway,
  mutateOrderCatalogItem,
  searchOrderCatalogForChart,
  createSupabaseOrderCatalogGateway,
  type OrderCatalogMutationInput,
  type SupabaseOrderCatalogRpcClient,
} from "@/features/hospital-admin/server-order-catalog";
import { enforceWorkspaceMutationRateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ workspaceId: string }>;
};

export async function GET(request: Request, { params }: RouteContext) {
  const { workspaceId } = await params;
  const identity = await resolveIdentity(request);
  if (!identity.ok) return identity.response;

  const url = new URL(request.url);
  const mode = url.searchParams.get("mode");
  const client = identity.source === "supabase_session" ? await createClient() : null;
  const permissionAdapter = client
    ? await loadWorkspacePermissionAdapterFromDb({
        gateway: createSupabaseWorkspacePermissionGateway(
          client as unknown as SupabaseWorkspacePermissionClient
        ),
        workspaceId,
        sessionUserId: identity.actorUserId,
      })
    : undefined;
  const gateway =
    identity.source === "demo_header_mock_mode"
      ? getDemoOrderCatalogGateway(getDemoClientSessionId(request))
      : client
        ? createSupabaseOrderCatalogGateway(
            client as unknown as SupabaseOrderCatalogRpcClient
          )
        : undefined;
  const result =
    mode === "chart-search"
      ? await searchOrderCatalogForChart({
          actorUserId: identity.actorUserId,
          gateway,
          permissionAdapter,
          workspaceId,
        })
      : await listOrderCatalogForAdmin({
          actorUserId: identity.actorUserId,
          gateway,
          permissionAdapter,
          workspaceId,
        });

  return Response.json(result, { status: result.status });
}

export async function POST(request: Request, { params }: RouteContext) {
  const { workspaceId } = await params;
  return mutate(request, workspaceId);
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const { workspaceId } = await params;
  return mutate(request, workspaceId);
}

async function mutate(request: Request, workspaceId: string) {
  const identity = await resolveIdentity(request);
  if (!identity.ok) return identity.response;

  const rateLimitResponse = enforceWorkspaceMutationRateLimit({
    request,
    actorUserId: identity.actorUserId,
    workspaceId,
    operation: "hospital_admin_order_catalog_mutation",
  });
  if (rateLimitResponse) return rateLimitResponse;

  const client = identity.source === "supabase_session" ? await createClient() : null;
  const permissionAdapter = client
    ? await loadWorkspacePermissionAdapterFromDb({
        gateway: createSupabaseWorkspacePermissionGateway(
          client as unknown as SupabaseWorkspacePermissionClient
        ),
        workspaceId,
        sessionUserId: identity.actorUserId,
      })
    : undefined;

  const result = await mutateOrderCatalogItem({
    actorUserId: identity.actorUserId,
    workspaceId,
    input: await readJsonBody(request),
    gateway:
      identity.source === "demo_header_mock_mode"
        ? getDemoOrderCatalogGateway(getDemoClientSessionId(request))
        : client
          ? createSupabaseOrderCatalogGateway(
              client as unknown as SupabaseOrderCatalogRpcClient
            )
          : undefined,
    permissionAdapter,
    auditGateway:
      client
        ? createSupabaseLiveAuditAppendGateway(
            client as unknown as SupabaseLiveAuditAppendRpcClient
          )
        : undefined,
    auditRequestId: getAuditRequestId(request),
  });

  return Response.json(result, { status: result.status });
}

async function resolveIdentity(request: Request) {
  const serverSession = await readServerSession();
  const identity = resolveRoleUpdateActorIdentity({
    serverSession,
    demoHeaderUserId: request.headers.get(demoSessionUserIdHeader),
  });

  if (!identity.ok) {
    return {
      ok: false as const,
      response: Response.json(
        {
          ok: false,
          denialReason: identity.denialReason,
          sessionStatus: identity.sessionStatus,
          sessionReason: identity.sessionReason,
        },
        { status: 401 }
      ),
    };
  }

  return {
    ok: true as const,
    actorUserId: identity.actorUserId,
    source: identity.source,
  };
}

async function readJsonBody(request: Request): Promise<OrderCatalogMutationInput> {
  try {
    const value = (await request.json()) as unknown;
    return value && typeof value === "object"
      ? (value as OrderCatalogMutationInput)
      : { action: "pause", itemId: "" };
  } catch {
    return { action: "pause", itemId: "" };
  }
}

function getDemoClientSessionId(request: Request) {
  return request.headers.get(demoClientSessionIdHeader) ?? "shared";
}
