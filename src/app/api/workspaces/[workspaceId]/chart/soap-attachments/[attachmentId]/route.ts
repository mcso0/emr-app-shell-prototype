import { readSoapAttachment } from "@/features/chart/soap-attachment-core";
import { loadSoapAttachmentContext } from "@/features/chart/server-soap-attachment-context";

type RouteContext = { params: Promise<{ workspaceId: string; attachmentId: string }> };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export async function GET(request: Request, { params }: RouteContext) {
  const { workspaceId, attachmentId } = await params;
  const encounterId = new URL(request.url).searchParams.get("encounterId");
  if (!encounterId || !uuidPattern.test(encounterId) || !uuidPattern.test(attachmentId)) {
    return Response.json({ ok: false, error: "invalid_input" }, { status: 400 });
  }
  const context = await loadSoapAttachmentContext(request, workspaceId);
  if (!context.ok) return context.response;
  const result = await readSoapAttachment({
    actorUserId: context.actorUserId,
    workspaceId,
    encounterId,
    attachmentId,
    permissionAdapter: context.permissionAdapter,
    gateway: context.gateway,
  });
  if (!result.ok) return Response.json(result, { status: result.status, headers: { "Cache-Control": "no-store" } });
  return new Response(null, {
    status: 307,
    headers: {
      Location: result.value,
      "Cache-Control": "private, no-store",
      Vary: "Cookie",
    },
  });
}
