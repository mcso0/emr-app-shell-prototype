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
  createSupabaseChartOrderBillingSummaryGateway,
  readChartOrderBillingSummary,
  requestChartOrderBilling,
  type SupabaseChartOrderBillingSummaryRpcClient,
} from "@/features/chart/server-order-billing-summary";
import type { ChartOrderBillingRequestInput } from "@/features/chart/chart-order-billing-summary-contract";
import {
  resolveServerChartEncounterId,
  type SupabaseEncounterIdBridgeClient,
} from "@/features/chart/server-encounter-id-bridge";
import { enforceWorkspaceMutationRateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ workspaceId: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  const context = await resolveContext(request, await params, new URL(request.url).searchParams.get("encounterId"));
  if (!context.ok) return Response.json(context.body, { status: context.status });
  const result = await readChartOrderBillingSummary({
    actorUserId: context.actorUserId,
    encounterId: context.encounterId,
    workspaceId: context.workspaceId,
    permissionAdapter: context.permissionAdapter,
    gateway: context.client
      ? createSupabaseChartOrderBillingSummaryGateway(
          context.client as unknown as SupabaseChartOrderBillingSummaryRpcClient,
        )
      : undefined,
  });
  const response = Response.json(result, { status: result.status });
  if (result.ok) response.headers.set("ETag", result.summary.etag);
  return response;
}

export async function POST(request: Request, { params }: RouteContext) {
  const body = await readBody(request);
  const context = await resolveContext(request, await params, body.encounterId);
  if (!context.ok) return Response.json(context.body, { status: context.status });
  const rateLimitResponse = enforceWorkspaceMutationRateLimit({
    request,
    actorUserId: context.actorUserId,
    workspaceId: context.workspaceId,
    operation: "chart_order_billing_request",
  });
  if (rateLimitResponse) return rateLimitResponse;
  const ifMatch = request.headers.get("if-match");
  if (!ifMatch || !body.expectedEtag) {
    return Response.json({ ok: false, error: "if_match_required" }, { status: 428 });
  }
  if (ifMatch !== body.expectedEtag) {
    return Response.json({ ok: false, error: "etag_header_body_mismatch" }, { status: 400 });
  }
  const result = await requestChartOrderBilling({
    acknowledgeUnfinished: body.acknowledgeUnfinished,
    actorUserId: context.actorUserId,
    encounterId: context.encounterId,
    expectedEtag: body.expectedEtag,
    idempotencyKey: body.idempotencyKey,
    workspaceId: context.workspaceId,
    permissionAdapter: context.permissionAdapter,
    gateway: context.client
      ? createSupabaseChartOrderBillingSummaryGateway(
          context.client as unknown as SupabaseChartOrderBillingSummaryRpcClient,
        )
      : undefined,
  });
  const response = Response.json(result, { status: result.status });
  if (result.ok) response.headers.set("ETag", result.summary.etag);
  return response;
}

async function resolveContext(
  request: Request,
  { workspaceId }: { workspaceId: string },
  encounterId?: string | null,
) {
  const identity = resolveRoleUpdateActorIdentity({
    serverSession: await readServerSession(),
    demoHeaderUserId: request.headers.get(demoSessionUserIdHeader),
  });
  if (!identity.ok) {
    return { ok: false as const, status: 401, body: { ok: false, denialReason: identity.denialReason } };
  }
  const client = identity.source === "supabase_session" ? await createClient() : null;
  const resolved = await resolveServerChartEncounterId({
    client: client as unknown as SupabaseEncounterIdBridgeClient | null,
    encounterId,
    workspaceId,
  });
  if (!resolved.ok) return { ok: false as const, status: resolved.status, body: resolved };
  const permissionAdapter = client
    ? await loadWorkspacePermissionAdapterFromDb({
        gateway: createSupabaseWorkspacePermissionGateway(
          client as unknown as SupabaseWorkspacePermissionClient,
        ),
        workspaceId,
        sessionUserId: identity.actorUserId,
      })
    : undefined;
  return {
    ok: true as const,
    actorUserId: identity.actorUserId,
    client,
    encounterId: resolved.encounterId,
    permissionAdapter,
    workspaceId,
  };
}

async function readBody(request: Request): Promise<ChartOrderBillingRequestInput> {
  try {
    const value = await request.json() as unknown;
    return value && typeof value === "object" ? value as ChartOrderBillingRequestInput : {};
  } catch {
    return {};
  }
}
