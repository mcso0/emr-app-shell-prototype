import { readServerSession } from "@/features/auth/server-session-reader";
import { demoSessionUserIdHeader, resolveRoleUpdateActorIdentity } from "@/features/auth/server-role-update-identity";
import { enforceWorkspaceMutationRateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { dispenseRuleErrorStatus, isDispenseRuleMutation } from "@/features/hospital-admin/dispense-quantity-rule-contract";

type Context = { params: Promise<{ workspaceId: string }> };
async function handle(request: Request, context: Context, mutate: boolean) {
  const { workspaceId } = await context.params;
  const identity = resolveRoleUpdateActorIdentity({ demoHeaderUserId: request.headers.get(demoSessionUserIdHeader), serverSession: await readServerSession() });
  if (!identity.ok) return Response.json({ ok: false, error: identity.denialReason }, { status: 401 });
  if (mutate) {
    const limit = enforceWorkspaceMutationRateLimit({ actorUserId: identity.actorUserId, workspaceId, request, operation: "dispense_quantity_rules" });
    if (limit) return limit;
  }
  // No demo fallback: a settings save must be backed by the authenticated DB.
  const client = identity.source === "supabase_session" ? await createClient() : null;
  if (!client) return Response.json({ ok: false, error: "rule_gateway_required" }, { status: 503 });
  try {
    const input: unknown = mutate ? await request.json() : null;
    if (mutate && !isDispenseRuleMutation(input)) return Response.json({ ok: false, error: "invalid_rule_input" }, { status: 400 });
    const result = mutate && isDispenseRuleMutation(input)
      ? await client.rpc("clair_save_dispense_quantity_rules", {
          p_workspace_id: workspaceId, p_expected_revision: input.expectedRevision, p_target: input.target,
          p_rule: input.rule, p_catalog_item_ids: input.catalogItemIds, p_unit: input.unit,
        })
      : await client.rpc("clair_get_dispense_quantity_rules", { p_workspace_id: workspaceId });
    if (result.error) {
      const status = dispenseRuleErrorStatus(result.error.message);
      const error = status === 403 ? "permission_missing" : status === 409 ? "revision_conflict" : status === 422 ? "invalid_rule_input" : "rule_gateway_unavailable";
      return Response.json({ ok: false, error }, { status });
    }
    return Response.json({ ok: true, settings: result.data });
  } catch {
    return Response.json({ ok: false, error: "rule_request_failed" }, { status: 503 });
  }
}
export async function GET(request: Request, context: Context) { return handle(request, context, false); }
export async function PATCH(request: Request, context: Context) { return handle(request, context, true); }
