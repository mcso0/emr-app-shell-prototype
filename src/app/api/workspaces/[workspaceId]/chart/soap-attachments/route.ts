import { randomUUID } from "node:crypto";
import {
  finalizeSoapAttachment,
  prepareSoapAttachment,
} from "@/features/chart/soap-attachment-core";
import { loadSoapAttachmentContext } from "@/features/chart/server-soap-attachment-context";
import { enforceWorkspaceMutationRateLimit } from "@/lib/security/rate-limit";

type RouteContext = { params: Promise<{ workspaceId: string }> };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export async function POST(request: Request, { params }: RouteContext) {
  const { workspaceId } = await params;
  const body = await readBody(request);
  if (!body || typeof body.encounterId !== "string" || !uuidPattern.test(body.encounterId)) {
    return Response.json({ ok: false, error: "invalid_input" }, { status: 400 });
  }
  const context = await loadSoapAttachmentContext(request, workspaceId, true);
  if (!context.ok) return context.response;
  const rateLimited = enforceWorkspaceMutationRateLimit({
    request,
    actorUserId: context.actorUserId,
    workspaceId,
    operation: "chart_soap_attachment",
  });
  if (rateLimited) return rateLimited;
  if (body.action === "prepare") {
    const result = await prepareSoapAttachment({
      actorUserId: context.actorUserId,
      workspaceId,
      encounterId: body.encounterId,
      id: randomUUID(),
      mimeType: body.mimeType,
      size: body.size,
      name: body.name,
      permissionAdapter: context.permissionAdapter,
      gateway: context.gateway,
    });
    return result.ok
      ? Response.json({ ok: true, ...result.value }, { status: result.status, headers: { "Cache-Control": "no-store" } })
      : Response.json(result, { status: result.status });
  }
  if (body.action === "finalize" && typeof body.attachmentId === "string" && uuidPattern.test(body.attachmentId)) {
    const result = await finalizeSoapAttachment({
      actorUserId: context.actorUserId,
      workspaceId,
      encounterId: body.encounterId,
      attachmentId: body.attachmentId,
      permissionAdapter: context.permissionAdapter,
      gateway: context.gateway,
    });
    return result.ok
      ? Response.json({ ok: true, attachment: result.value }, { status: result.status, headers: { "Cache-Control": "no-store" } })
      : Response.json(result, { status: result.status });
  }
  if (body.action === "discard" && typeof body.attachmentId === "string" && uuidPattern.test(body.attachmentId)) {
    const record = await context.gateway.find(workspaceId, body.encounterId, body.attachmentId);
    if (!record || record.actorUserId !== context.actorUserId || record.ready || record.cancelled) {
      return Response.json({ ok: false, error: "attachment_unavailable" }, { status: 403 });
    }
    if (!(await context.gateway.discard(record))) {
      return Response.json({ ok: false, error: "attachment_discard_failed" }, { status: 500 });
    }
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  }
  return Response.json({ ok: false, error: "invalid_input" }, { status: 400 });
}

async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  if (!request.headers.get("content-type")?.startsWith("application/json")) return null;
  if (Number(request.headers.get("content-length")) > 4096) return null;
  const raw = await request.text().catch(() => "");
  if (raw.length > 4096) return null;
  try {
    const body: unknown = JSON.parse(raw);
    return body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : null;
  } catch {
    return null;
  }
}
