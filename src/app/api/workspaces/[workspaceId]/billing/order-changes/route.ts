import { z } from "zod";
import { readServerSession } from "@/features/auth/server-session-reader";
import { resolveRoleUpdateActorIdentity } from "@/features/auth/server-role-update-identity";
import { orderBillingApprovalSchema, orderBillingChangeSchema } from "@/features/billing/order-billing-change-contract";
import { createClient } from "@/lib/supabase/server";
import { enforceWorkspaceMutationRateLimit } from "@/lib/security/rate-limit";
type Context = { params: Promise<{ workspaceId: string }> };
async function handle(request: Request, context: Context, mutate: boolean) {
 const headers = { "Cache-Control": "no-store" };
 const identity = resolveRoleUpdateActorIdentity({ serverSession: await readServerSession(), demoHeaderUserId: null });
 if (!identity.ok) return Response.json({ ok: false, error: "unauthenticated" }, { status: 401, headers });
 if (identity.source !== "supabase_session") return Response.json({ ok: false, error: "unavailable" }, { status: 503, headers });
 const command = mutate ? orderBillingApprovalSchema.safeParse(await request.json().catch(() => null)) : null;
 const invoice = z.uuid().safeParse(command?.success ? command.data.invoiceId : new URL(request.url).searchParams.get("invoiceId"));
 if (!invoice.success || (command && !command.success)) return Response.json({ ok: false, error: "invalid_input" }, { status: 400, headers });
 const { workspaceId } = await context.params;
 if (mutate) { const denied = enforceWorkspaceMutationRateLimit({ request, workspaceId, actorUserId: identity.actorUserId, operation: "order_billing_change" }); if (denied) return denied; }
 const client = await createClient();
 if (!client) return Response.json({ ok: false, error: "unavailable" }, { status: 503, headers });
 const { data, error } = await client.rpc(mutate ? "clair_approve_order_billing_change" : "clair_get_order_billing_changes", {
  p_workspace_id: workspaceId, p_invoice_id: invoice.data,
  ...(command?.success ? { p_order_id: command.data.orderId, p_proposal_id: command.data.proposalId, p_version: command.data.version } : {}),
 });
 const parsed = z.array(orderBillingChangeSchema).safeParse(data);
 if (error || !parsed.success) return Response.json({ ok: false, error: ["permission_missing", "current_assignee_required", "revision_conflict", "payment_locked"].find(code => error?.message.includes(code)) ?? "unavailable" }, { status: error?.code === "42501" ? 403 : 409, headers });
 return Response.json({ ok: true, changes: parsed.data }, { headers });
}
export const GET = (request: Request, context: Context) => handle(request, context, false);
export const POST = (request: Request, context: Context) => handle(request, context, true);
