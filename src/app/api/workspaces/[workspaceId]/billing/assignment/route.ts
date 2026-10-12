import { mockBillingAssignments, mockBillingAssignmentStaff } from "@/features/billing/server-assignment";
import { readServerSession } from "@/features/auth/server-session-reader";
import { demoSessionUserIdHeader, resolveRoleUpdateActorIdentity } from "@/features/auth/server-role-update-identity";
import { createClient } from "@/lib/supabase/server";
import { parseBillingAssignment, type BillingAssignment } from "@/features/billing/assignment";
import { enforceWorkspaceMutationRateLimit } from "@/lib/security/rate-limit";

type Context = { params: Promise<{ workspaceId: string }> };
// Mock runtime only. Live ownership is always read/written through the database.
const mockAssignments = mockBillingAssignments;
const staff = mockBillingAssignmentStaff;
const respond = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
async function execute(request: Request, context: Context, write: boolean) {
  const { workspaceId } = await context.params;
  const identity = resolveRoleUpdateActorIdentity({ serverSession: await readServerSession(), demoHeaderUserId: request.headers.get(demoSessionUserIdHeader) });
  if (!identity.ok) return respond({ ok: false, error: "unauthenticated" }, 401);
  let input: Record<string, unknown>;
  try { input = write ? await request.json() : { invoiceId: new URL(request.url).searchParams.get("invoiceId") }; }
  catch { return respond({ ok: false, error: "invalid_input" }, 400); }
  if (!input || typeof input.invoiceId !== "string" || !input.invoiceId || input.invoiceId.length > 200
    || write && (!["claim", "assign", "unassign"].includes(String(input.action)) || !Number.isSafeInteger(input.expectedRevision)
      || Number(input.expectedRevision) < 0 || input.action === "assign" && typeof input.assignedToUserId !== "string")) return respond({ ok: false, error: "invalid_input" }, 400);
  if (write) {
    const limited = enforceWorkspaceMutationRateLimit({ request, actorUserId: identity.actorUserId, workspaceId, operation: "billing_assignment" });
    if (limited) return limited;
  }
  if (identity.source === "supabase_session") {
    const client = await createClient();
    if (!client) return respond({ ok: false, error: "configured_data_source_required" }, 503);
    const { data, error } = await client.rpc(write ? "clair_change_billing_assignment" : "clair_get_billing_assignment", {
      p_workspace_id: workspaceId, p_invoice_id: input.invoiceId,
      ...(write ? { p_action: input.action, p_expected_revision: input.expectedRevision, p_assigned_to_user_id: input.assignedToUserId ?? null } : {}),
    });
    if (error) return respond({ ok: false, error: error.code === "42501" ? "current_assignee_required" : "assignment_conflict" }, error.code === "42501" ? 403 : 409);
    const assignment = parseBillingAssignment(data);
    return assignment ? respond({ ok: true, assignment }) : respond({ ok: false, error: "invalid_assignment_response" }, 502);
  }
  if (workspaceId !== "clair-demo" || !staff.some(x => x.userId === identity.actorUserId)) return respond({ ok: false, error: "permission_missing" }, 403);
  const key = `${workspaceId}:${input.invoiceId}`;
  const previous = mockAssignments.get(key) ?? { userId: null, revision: 0 };
  if (write) {
    if (previous.revision !== input.expectedRevision) return respond({ ok: false, error: "revision_conflict" }, 409);
    if (input.action === "claim" ? previous.userId !== null : previous.userId !== identity.actorUserId) return respond({ ok: false, error: "current_assignee_required" }, 403);
    const userId = input.action === "claim" ? identity.actorUserId : input.action === "assign" ? String(input.assignedToUserId) : null;
    if (userId && !staff.some(x => x.userId === userId)) return respond({ ok: false, error: "assignee_ineligible" }, 403);
    mockAssignments.set(key, { userId, revision: previous.revision + 1 });
  }
  const current = mockAssignments.get(key) ?? previous;
  const assignment: BillingAssignment = { assignedToUserId: current.userId, assignedToDisplayName: staff.find(x => x.userId === current.userId)?.displayName ?? null,
    revision: current.revision, canManage: current.userId === null || current.userId === identity.actorUserId, assignees: staff };
  return respond({ ok: true, assignment });
}
export const GET = (request: Request, context: Context) => execute(request, context, false);
export const PATCH = (request: Request, context: Context) => execute(request, context, true);
