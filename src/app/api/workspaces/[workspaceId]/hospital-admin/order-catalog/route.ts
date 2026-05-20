import { readServerSession } from "@/features/auth/server-session-reader";
import {
  demoSessionUserIdHeader,
  resolveRoleUpdateActorIdentity,
} from "@/features/auth/server-role-update-identity";
import {
  listOrderCatalogForAdmin,
  mutateOrderCatalogItem,
  searchOrderCatalogForChart,
  type OrderCatalogMutationInput,
} from "@/features/hospital-admin/server-order-catalog";
import { enforceWorkspaceMutationRateLimit } from "@/lib/security/rate-limit";

type RouteContext = {
  params: Promise<{ workspaceId: string }>;
};

export async function GET(request: Request, { params }: RouteContext) {
  const { workspaceId } = await params;
  const identity = await resolveIdentity(request);
  if (!identity.ok) return identity.response;

  const url = new URL(request.url);
  const mode = url.searchParams.get("mode");
  const result =
    mode === "chart-search"
      ? await searchOrderCatalogForChart({ actorUserId: identity.actorUserId, workspaceId })
      : await listOrderCatalogForAdmin({ actorUserId: identity.actorUserId, workspaceId });

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

  const result = await mutateOrderCatalogItem({
    actorUserId: identity.actorUserId,
    workspaceId,
    input: await readJsonBody(request),
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

  return { ok: true as const, actorUserId: identity.actorUserId };
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
