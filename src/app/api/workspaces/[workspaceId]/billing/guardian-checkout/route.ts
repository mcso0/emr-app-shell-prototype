import { loadWorkspacePermissionAdapterFromDb } from "@/features/auth/db-workspace-permission-adapter";
import { createSupabaseWorkspacePermissionGateway, type SupabaseWorkspacePermissionClient } from "@/features/auth/supabase-workspace-permission-gateway";
import { mockBillingOwnerAllowed } from "@/features/billing/server-assignment";
import { readServerSession } from "@/features/auth/server-session-reader";
import {
  demoSessionUserIdHeader,
  resolveRoleUpdateActorIdentity,
} from "@/features/auth/server-role-update-identity";
import {
  createMockGuardianCheckoutGateway,
  createSupabaseGuardianCheckoutGateway,
  listGuardianBillingLedger,
  prepareGuardianCheckoutSession,
  transitionBillingInvoiceStatus,
  type BillingInvoiceTransitionInput,
  type GuardianBillingLedgerInput,
  type GuardianCheckoutPrepareInput,
  type SupabaseGuardianCheckoutRpcClient,
} from "@/features/billing/server-guardian-checkout";
import {
  createSupabaseDemoBillingPermissionAdapter,
} from "@/features/billing/server-demo-billing-persistence-boundary";
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
  const guardianId = url.searchParams.get("guardianId") ?? undefined;
  const useSupabaseGateway = identity.source === "supabase_session" && isUuid(guardianId);
  const client = useSupabaseGateway ? await createClient() : null;
  const gateway = client
    ? createSupabaseGuardianCheckoutGateway(client as unknown as SupabaseGuardianCheckoutRpcClient)
    : createMockGuardianCheckoutGateway();
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
  const result = await listGuardianBillingLedger({
    actorUserId: identity.actorUserId,
    workspaceId,
    input: {
      guardianId,
      includeCoGuardianInvoices: url.searchParams.get("includeCoGuardianInvoices") === "true",
      statusFilter: normalizeStatusFilter(url.searchParams.get("statusFilter")),
    },
    gateway,
    permissionAdapter,
  });

  return Response.json(result, { status: result.status });
}

export async function POST(request: Request, { params }: RouteContext) {
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
    operation: "billing_guardian_checkout_prepare",
  });
  if (rateLimitResponse) return rateLimitResponse;

  const input = await readPrepareBody(request);
  if (identity.source !== "supabase_session" && (input.invoiceIds?.some(id => !mockBillingOwnerAllowed(workspaceId, id, identity.actorUserId)))) {
    return Response.json({ ok: false, denialReason: "permission_missing" }, { status: 403 });
  }
  const useSupabaseGateway = identity.source === "supabase_session" && input.invoiceIds?.every(isUuid);
  const client = useSupabaseGateway ? await createClient() : null;
  const gateway = client
    ? createSupabaseGuardianCheckoutGateway(client as unknown as SupabaseGuardianCheckoutRpcClient)
    : createMockGuardianCheckoutGateway();
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
  const result = await prepareGuardianCheckoutSession({
    actorUserId: identity.actorUserId,
    workspaceId,
    input,
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
    operation: "billing_invoice_status_transition",
  });
  if (rateLimitResponse) return rateLimitResponse;

  const input = await readTransitionBody(request);
  if (identity.source !== "supabase_session" && (typeof input.invoiceId === "string" && !mockBillingOwnerAllowed(workspaceId, input.invoiceId, identity.actorUserId))) {
    return Response.json({ ok: false, denialReason: "permission_missing" }, { status: 403 });
  }
  const useSupabaseGateway = identity.source === "supabase_session" && isUuid(input.invoiceId);
  const client = useSupabaseGateway ? await createClient() : null;
  const gateway = client
    ? createSupabaseGuardianCheckoutGateway(client as unknown as SupabaseGuardianCheckoutRpcClient)
    : createMockGuardianCheckoutGateway();
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
  const result = await transitionBillingInvoiceStatus({
    actorUserId: identity.actorUserId,
    workspaceId,
    input,
    gateway,
    permissionAdapter,
  });

  return Response.json(result, { status: result.status });
}

function normalizeStatusFilter(value: string | null): GuardianBillingLedgerInput["statusFilter"] {
  if (
    value === "waiting" ||
    value === "unpaid" ||
    value === "paid" ||
    value === "voided" ||
    value === "refunded"
  ) {
    return value;
  }

  return "all";
}

async function readPrepareBody(request: Request): Promise<GuardianCheckoutPrepareInput> {
  try {
    const value = (await request.json()) as unknown;
    if (!value || typeof value !== "object") return {};
    const row = value as Partial<GuardianCheckoutPrepareInput>;
    return {
      adjustmentReason: typeof row.adjustmentReason === "string" ? row.adjustmentReason : undefined,
      adjustments: Array.isArray(row.adjustments) ? row.adjustments : undefined,
      invoiceIds: Array.isArray(row.invoiceIds)
        ? row.invoiceIds.filter((invoiceId): invoiceId is string => typeof invoiceId === "string")
        : undefined,
      paymentMemo: typeof row.paymentMemo === "string" ? row.paymentMemo : undefined,
      paymentMethod: row.paymentMethod,
    };
  } catch {
    return {};
  }
}

async function readTransitionBody(request: Request): Promise<BillingInvoiceTransitionInput> {
  try {
    const value = (await request.json()) as unknown;
    if (!value || typeof value !== "object") return {};
    const row = value as Partial<BillingInvoiceTransitionInput>;
    return {
      invoiceId: typeof row.invoiceId === "string" ? row.invoiceId : undefined,
      paymentMethod: row.paymentMethod,
      reason: typeof row.reason === "string" ? row.reason : undefined,
      target: row.target,
    };
  } catch {
    return {};
  }
}

function isUuid(value: string | null | undefined) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
