import { readServerSession } from "@/features/auth/server-session-reader";
import {
  demoSessionUserIdHeader,
  resolveRoleUpdateActorIdentity,
} from "@/features/auth/server-role-update-identity";
import {
  createMockInvoiceLinePersistenceGateway,
  createSupabaseInvoiceLinePersistenceGateway,
  readInvoiceLines,
  saveInvoiceLineEdits,
  type InvoiceLineEditInput,
  type SupabaseInvoiceLinePersistenceRpcClient,
} from "@/features/billing/server-invoice-line-persistence";
import {
  createSupabaseDemoBillingPermissionAdapter,
  shouldUseSupabaseBillingPersistenceGateway,
} from "@/features/billing/server-demo-billing-persistence-boundary";
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
    ? createSupabaseInvoiceLinePersistenceGateway(
        client as unknown as SupabaseInvoiceLinePersistenceRpcClient
      )
    : createMockInvoiceLinePersistenceGateway(undefined, undefined, demoStoreNamespace);
  const permissionAdapter =
    identity.source === "supabase_session" && !useSupabaseGateway
      ? createSupabaseDemoBillingPermissionAdapter({
          actorUserId: identity.actorUserId,
          workspaceId,
        })
      : undefined;
  const result = await readInvoiceLines({
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
    operation: "billing_invoice_line_persistence",
  });
  if (rateLimitResponse) return rateLimitResponse;

  const input = await readJsonBody(request);
  const useSupabaseGateway = shouldUseSupabaseBillingPersistenceGateway({
    identitySource: identity.source,
    invoiceId: input.invoiceId,
  });
  const client = useSupabaseGateway ? await createClient() : null;
  const demoStoreNamespace = getDemoStoreNamespace(identity.actorUserId, request);
  const gateway = client
    ? createSupabaseInvoiceLinePersistenceGateway(
        client as unknown as SupabaseInvoiceLinePersistenceRpcClient
      )
    : createMockInvoiceLinePersistenceGateway(undefined, undefined, demoStoreNamespace);
  const permissionAdapter =
    identity.source === "supabase_session" && !useSupabaseGateway
      ? createSupabaseDemoBillingPermissionAdapter({
          actorUserId: identity.actorUserId,
          workspaceId,
        })
      : undefined;
  const result = await saveInvoiceLineEdits({
    actorUserId: identity.actorUserId,
    workspaceId,
    input,
    gateway,
    permissionAdapter,
  });

  return Response.json(result, { status: result.status });
}

async function readJsonBody(request: Request): Promise<InvoiceLineEditInput> {
  try {
    const value = (await request.json()) as unknown;
    return value && typeof value === "object" ? value as InvoiceLineEditInput : {};
  } catch {
    return {};
  }
}

function getDemoStoreNamespace(actorUserId: string, request: Request) {
  const clientSessionId = request.headers.get(demoClientSessionIdHeader)?.trim();
  return clientSessionId ? `${actorUserId}:${clientSessionId}` : actorUserId;
}
