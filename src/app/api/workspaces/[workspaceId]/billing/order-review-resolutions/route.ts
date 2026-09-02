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
  createSupabaseOrderBillingReviewResolutionGateway,
  reverseOrderBillingReviewInvoice,
  type SupabaseOrderBillingReviewResolutionRpcClient,
} from "@/features/billing/server-order-billing-review-resolution";
import { enforceWorkspaceMutationRateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ workspaceId: string }> };
type RequestBody = {
  expectedInvoiceUpdatedAt?: string;
  idempotencyKey?: string;
  invoiceId?: string;
  reason?: string;
};

export async function POST(request: Request, { params }: RouteContext) {
  const { workspaceId } = await params;
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
    operation: "order_billing_review_resolution",
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
  const result = await reverseOrderBillingReviewInvoice({
    actorUserId: identity.actorUserId,
    expectedInvoiceUpdatedAt: body.expectedInvoiceUpdatedAt,
    gateway: client
      ? createSupabaseOrderBillingReviewResolutionGateway(
          client as unknown as SupabaseOrderBillingReviewResolutionRpcClient,
        )
      : undefined,
    idempotencyKey: body.idempotencyKey,
    invoiceId: body.invoiceId,
    permissionAdapter,
    reason: body.reason,
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
