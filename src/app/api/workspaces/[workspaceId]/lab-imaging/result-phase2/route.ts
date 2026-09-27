import { loadLabResultPhase2Context } from "@/features/lab-imaging/server-lab-result-phase2-context";
import { enforceWorkspaceMutationRateLimit } from "@/lib/security/rate-limit";

type RouteContext = { params: Promise<{ workspaceId: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  const { workspaceId } = await params;
  const resultId = new URL(request.url).searchParams.get("resultId");
  if (!resultId || resultId.length > 200) return Response.json({ ok: false, error: "invalid_result_id" }, { status: 400 });
  const context = await loadLabResultPhase2Context(request, workspaceId);
  if (!context.ok) return context.response;
  const { data, error } = await context.client.rpc("clair_get_lab_result_phase2", {
    p_workspace_id: workspaceId,
    p_result_id: resultId,
  });
  return error
    ? Response.json({ ok: false, error: "phase2_read_failed" }, { status: error.code === "42501" ? 403 : 500 })
    : Response.json({ ok: true, data: { ...data, canEdit: context.canWrite && data?.editable === true } }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PUT(request: Request, { params }: RouteContext) {
  const { workspaceId } = await params;
  const context = await loadLabResultPhase2Context(request, workspaceId, true);
  if (!context.ok) return context.response;
  const rateLimited = enforceWorkspaceMutationRateLimit({ request, workspaceId, actorUserId: context.actorUserId, operation: "lab_result_overall_finding" });
  if (rateLimited) return rateLimited;
  const body = await readBody(request);
  if (!body || typeof body.resultId !== "string" || !body.resultId || body.resultId.length > 200
    || typeof body.finding !== "string" || body.finding.length > 10000
    || !Number.isSafeInteger(body.expectedRevision) || Number(body.expectedRevision) < 0) {
    return Response.json({ ok: false, error: "invalid_input" }, { status: 400 });
  }
  const { data, error } = await context.client.rpc("clair_save_lab_result_overall_finding", {
    p_workspace_id: workspaceId,
    p_result_id: body.resultId,
    p_expected_revision: body.expectedRevision,
    p_finding: body.finding,
  });
  if (error) {
    const conflict = error.code === "40001" || error.message?.includes("finding_revision_conflict");
    return Response.json({ ok: false, error: conflict ? "revision_conflict" : "finding_save_failed" }, { status: conflict ? 409 : error.code === "42501" ? 403 : 500 });
  }
  return Response.json({ ok: true, data }, { headers: { "Cache-Control": "private, no-store" } });
}

async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  if (!request.headers.get("content-type")?.startsWith("application/json")) return null;
  if (Number(request.headers.get("content-length")) > 12000) return null;
  const raw = await request.text().catch(() => "");
  if (raw.length > 12000) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch { return null; }
}
