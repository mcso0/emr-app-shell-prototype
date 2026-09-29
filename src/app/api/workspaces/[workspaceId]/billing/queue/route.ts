import { readServerSession } from "@/features/auth/server-session-reader";
import { demoSessionUserIdHeader, resolveRoleUpdateActorIdentity } from "@/features/auth/server-role-update-identity";
import { loadWorkspacePermissionAdapterFromDb } from "@/features/auth/db-workspace-permission-adapter";
import { createSupabaseWorkspacePermissionGateway, type SupabaseWorkspacePermissionClient } from "@/features/auth/supabase-workspace-permission-gateway";
import { createDemoHomeOperationsPermissionAdapter } from "@/features/home/server-home-operations-work-items-core";
import { readBillingQueue, createSupabaseBillingQueueGateway, type BillingQueueRpcClient } from "@/features/billing/server-billing-queue-core";
import { getBillingQueueRows } from "@/features/billing/data";
import { mockInvoices, mockInvoiceLines, mockPayments } from "@/mocks/emr-domain";
import { isLegacySalesDemoWorkspace } from "@/lib/emr-domain/demo-workspaces";
import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ workspaceId: string }> };
export async function GET(request: Request, { params }: RouteContext) {
  const { workspaceId } = await params;
  const identity = resolveRoleUpdateActorIdentity({ serverSession: await readServerSession(), demoHeaderUserId: request.headers.get(demoSessionUserIdHeader) });
  if (!identity.ok) return Response.json({ ok: false, denialReason: identity.denialReason }, { status: 401 });
  const demo = identity.source === "demo_header_mock_mode" && isLegacySalesDemoWorkspace(workspaceId);
  if (!demo && identity.source !== "supabase_session") return Response.json({ ok: false, denialReason: "workspace_membership_missing" }, { status: 403 });
  const client = identity.source === "supabase_session" ? await createClient() : null;
  const permissionAdapter = client ? await loadWorkspacePermissionAdapterFromDb({ gateway: createSupabaseWorkspacePermissionGateway(client as unknown as SupabaseWorkspacePermissionClient), workspaceId, sessionUserId: identity.actorUserId }) : createDemoHomeOperationsPermissionAdapter();
  const result = await readBillingQueue({ actorUserId: identity.actorUserId, workspaceId, date: new URL(request.url).searchParams.get("date"), permissionAdapter,
    gateway: client ? createSupabaseBillingQueueGateway(client as unknown as BillingQueueRpcClient) : { async list() {
      return { ok: true as const, rows: ["waiting", "unpaid", "closed"].flatMap(filter => getBillingQueueRows(mockInvoices, mockInvoiceLines, mockPayments, filter as "waiting" | "unpaid" | "closed")).filter(row => row.invoice.workspaceId === workspaceId) };
    } },
  });
  return Response.json(result, { status: result.status });
}
