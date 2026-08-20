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
  mutateWorkspaceLabTestItem,
  searchOrderCatalogForChart,
  createSupabaseOrderCatalogGateway,
  type OrderCatalogMutationInput,
  type WorkspaceLabTestItemMutationInput,
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

  const gateway =
    identity.source === "demo_header_mock_mode"
      ? getDemoOrderCatalogGateway(getDemoClientSessionId(request))
      : client
        ? createSupabaseOrderCatalogGateway(
            client as unknown as SupabaseOrderCatalogRpcClient,
          )
        : undefined;
  const input = await readJsonBody(request);
  const result =
    input.action === "updateLabTestItem"
      ? await mutateWorkspaceLabTestItem({
          actorUserId: identity.actorUserId,
          workspaceId,
          input: input.mutation,
          gateway,
          permissionAdapter,
        })
      : await mutateOrderCatalogItem({
          actorUserId: identity.actorUserId,
          workspaceId,
          input,
          gateway,
          permissionAdapter,
          auditGateway:
            client
              ? createSupabaseLiveAuditAppendGateway(
                  client as unknown as SupabaseLiveAuditAppendRpcClient,
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

async function readJsonBody(
  request: Request,
): Promise<
  | OrderCatalogMutationInput
  | { action: "updateLabTestItem"; mutation: WorkspaceLabTestItemMutationInput }
> {
  try {
    const value = (await request.json()) as unknown;
    if (!value || typeof value !== "object") {
      return { action: "pause", itemId: "", expectedCatalogRevision: 0 };
    }
    const input = value as Record<string, unknown>;
    if (input.action === "updateLabTestItem" || input.action === "update_lab_test_item") {
      const nested =
        input.mutation && typeof input.mutation === "object"
          ? (input.mutation as Record<string, unknown>)
          : input;
      return {
        action: "updateLabTestItem",
        mutation: {
          action: (nested.action === "local_settings" ? "local_settings" : "customize") as WorkspaceLabTestItemMutationInput["action"],
          expectedLocalSettingsRevision:
            typeof nested.expectedLocalSettingsRevision === "number"
              ? nested.expectedLocalSettingsRevision
              : undefined,
          expectedWorkspaceResultRevision:
            typeof nested.expectedWorkspaceResultRevision === "number"
              ? nested.expectedWorkspaceResultRevision
              : undefined,
          itemId: typeof nested.itemId === "string" ? nested.itemId : "",
          patch:
            nested.patch && typeof nested.patch === "object"
              ? (nested.patch as Record<string, unknown>)
              : {},
          targetLinkIds: Array.isArray(nested.targetLinkIds)
            ? nested.targetLinkIds.filter(
                (id): id is string => typeof id === "string",
              )
            : undefined,
        },
      };
    }
    return input as unknown as OrderCatalogMutationInput;
  } catch {
    return { action: "pause", itemId: "", expectedCatalogRevision: 0 };
  }
}

function getDemoClientSessionId(request: Request) {
  return request.headers.get(demoClientSessionIdHeader) ?? "shared";
}
