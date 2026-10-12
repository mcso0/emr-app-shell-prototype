import { loadWorkspacePermissionAdapterFromDb } from "@/features/auth/db-workspace-permission-adapter";
import { createSupabaseWorkspacePermissionGateway, type SupabaseWorkspacePermissionClient } from "@/features/auth/supabase-workspace-permission-gateway";
import { mockBillingOwnerAllowed } from "@/features/billing/server-assignment";
import { readServerSession } from "@/features/auth/server-session-reader";
import {
  demoSessionUserIdHeader,
  resolveRoleUpdateActorIdentity,
} from "@/features/auth/server-role-update-identity";
import {
  createMockBillingPaymentStatusGateway,
  createSupabaseBillingPaymentStatusGateway,
  readBillingPaymentStatus,
  saveBillingPaymentStatus,
  type BillingPaymentStatusInput,
  type SupabaseBillingPaymentStatusRpcClient,
} from "@/features/billing/server-payment-status-persistence";
import {
  createSupabaseDemoBillingPermissionAdapter,
  shouldUseSupabaseBillingPersistenceGateway,
} from "@/features/billing/server-demo-billing-persistence-boundary";
import {
  createSupabaseLiveAuditAppendGateway,
  type SupabaseLiveAuditAppendRpcClient,
} from "@/features/audit/server-audit-log-persistence";
import { getAuditRequestId } from "@/features/audit/server-mutation-audit";
import { enforceWorkspaceMutationRateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";

const demoClientSessionIdHeader = "x-clair-demo-client-session-id";

type RouteContext = {
  params: Promise<{
    workspaceId: string;
  }>;
};

export async function GET(request: Request, { params }: RouteContext) {
  const { workspaceId } = await params;
  const serverSession = await readServerSession();
  const identity = resolveRoleUpdateActorIdentity({
    serverSession,
    demoHeaderUserId: request.headers.get(demoSessionUserIdHeader),
  });

  if (!identity.ok) {
    return Response.json({ ok: false, denialReason: identity.denialReason }, { status: 401 });
  }

  const url = new URL(request.url);
  const invoiceId = url.searchParams.get("invoiceId");
  const useSupabaseGateway = shouldUseSupabaseBillingPersistenceGateway({
    identitySource: identity.source,
    invoiceId,
  });
  const client = useSupabaseGateway ? await createClient() : null;
  const demoStoreNamespace = getDemoStoreNamespace(identity.actorUserId, request);
  const gateway = client
    ? createSupabaseBillingPaymentStatusGateway(
        client as unknown as SupabaseBillingPaymentStatusRpcClient
      )
    : createMockBillingPaymentStatusGateway(undefined, undefined, demoStoreNamespace);
  const permissionAdapter = client
    ? await loadWorkspacePermissionAdapterFromDb({
        gateway: createSupabaseWorkspacePermissionGateway(client as unknown as SupabaseWorkspacePermissionClient),
        workspaceId,
        sessionUserId: identity.actorUserId,
      })
    : identity.source === "supabase_session" && !useSupabaseGateway
      ? createSupabaseDemoBillingPermissionAdapter({
          actorUserId: identity.actorUserId,
          workspaceId,
        })
      : undefined;
  const result = await readBillingPaymentStatus({
    actorUserId: identity.actorUserId,
    workspaceId,
    invoiceId,
    gateway,
    permissionAdapter,
  });

  return Response.json(result, { status: result.status });
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const { workspaceId } = await params;
  const serverSession = await readServerSession();
  const identity = resolveRoleUpdateActorIdentity({
    serverSession,
    demoHeaderUserId: request.headers.get(demoSessionUserIdHeader),
  });

  if (!identity.ok) {
    return Response.json({ ok: false, denialReason: identity.denialReason }, { status: 401 });
  }

  const rateLimitResponse = enforceWorkspaceMutationRateLimit({
    request,
    actorUserId: identity.actorUserId,
    workspaceId,
    operation: "billing_payment_status_persistence",
  });
  if (rateLimitResponse) return rateLimitResponse;

  const input = await readJsonBody(request);
  if (identity.source !== "supabase_session" && typeof input.invoiceId === "string" && !mockBillingOwnerAllowed(workspaceId, input.invoiceId, identity.actorUserId)) {
    return Response.json({ ok: false, denialReason: "permission_missing" }, { status: 403 });
  }
  const useSupabaseGateway = shouldUseSupabaseBillingPersistenceGateway({
    identitySource: identity.source,
    invoiceId: input.invoiceId,
  });
  const client = useSupabaseGateway ? await createClient() : null;
  const demoStoreNamespace = getDemoStoreNamespace(identity.actorUserId, request);
  const gateway = client
    ? createSupabaseBillingPaymentStatusGateway(
        client as unknown as SupabaseBillingPaymentStatusRpcClient
      )
    : createMockBillingPaymentStatusGateway(undefined, undefined, demoStoreNamespace);
  const permissionAdapter = client
    ? await loadWorkspacePermissionAdapterFromDb({
        gateway: createSupabaseWorkspacePermissionGateway(client as unknown as SupabaseWorkspacePermissionClient),
        workspaceId,
        sessionUserId: identity.actorUserId,
      })
    : identity.source === "supabase_session" && !useSupabaseGateway
      ? createSupabaseDemoBillingPermissionAdapter({
          actorUserId: identity.actorUserId,
          workspaceId,
        })
      : undefined;
  const result = await saveBillingPaymentStatus({
    actorUserId: identity.actorUserId,
    workspaceId,
    input,
    gateway,
    permissionAdapter,
    auditGateway: client
      ? createSupabaseLiveAuditAppendGateway(
          client as unknown as SupabaseLiveAuditAppendRpcClient
        )
      : undefined,
    auditRequestId: getAuditRequestId(request),
  });

  return Response.json(result, { status: result.status });
}

async function readJsonBody(request: Request): Promise<BillingPaymentStatusInput> {
  try {
    const value = (await request.json()) as unknown;
    return value && typeof value === "object" ? value as BillingPaymentStatusInput : {};
  } catch {
    return {};
  }
}

function getDemoStoreNamespace(actorUserId: string, request: Request) {
  const clientSessionId = request.headers.get(demoClientSessionIdHeader)?.trim();
  return clientSessionId ? `${actorUserId}:${clientSessionId}` : actorUserId;
}
