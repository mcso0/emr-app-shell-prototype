import { readServerSession } from "@/features/auth/server-session-reader";
import {
  demoSessionUserIdHeader,
  resolveRoleUpdateActorIdentity,
} from "@/features/auth/server-role-update-identity";
import {
  createSupabaseInvoiceCandidateSyncGateway,
  readInvoiceCandidates,
  syncInvoiceCandidates,
  type InvoiceCandidateSyncInput,
  type SupabaseInvoiceCandidateSyncRpcClient,
} from "@/features/billing/server-invoice-candidate-sync";
import { enforceWorkspaceMutationRateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";

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
  const encounterId = url.searchParams.get("encounterId");
  const client = identity.source === "supabase_session" ? await createClient() : null;
  const result = await readInvoiceCandidates({
    actorUserId: identity.actorUserId,
    workspaceId,
    encounterId,
    gateway: client
      ? createSupabaseInvoiceCandidateSyncGateway(
          client as unknown as SupabaseInvoiceCandidateSyncRpcClient
        )
      : undefined,
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
    operation: "billing_invoice_candidate_sync",
  });
  if (rateLimitResponse) return rateLimitResponse;

  const input = await readJsonBody(request);
  const client = identity.source === "supabase_session" ? await createClient() : null;
  const result = await syncInvoiceCandidates({
    actorUserId: identity.actorUserId,
    workspaceId,
    input,
    gateway: client
      ? createSupabaseInvoiceCandidateSyncGateway(
          client as unknown as SupabaseInvoiceCandidateSyncRpcClient
        )
      : undefined,
  });

  return Response.json(result, { status: result.status });
}

async function readJsonBody(request: Request): Promise<InvoiceCandidateSyncInput> {
  try {
    const value = (await request.json()) as unknown;
    return value && typeof value === "object" ? value as InvoiceCandidateSyncInput : {};
  } catch {
    return {};
  }
}
