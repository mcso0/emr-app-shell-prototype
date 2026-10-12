import { LAB_RESULT_ATTACHMENT_BUCKET } from "@/features/lab-imaging/lab-result-attachment-core";
import { loadLabResultPhase2Context, resolveLabResultEntry } from "@/features/lab-imaging/server-lab-result-phase2-context";
import { enforceWorkspaceMutationRateLimit } from "@/lib/security/rate-limit";

type RouteContext = { params: Promise<{ workspaceId: string; attachmentId: string }> };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export async function GET(request: Request, { params }: RouteContext) {
  const { workspaceId, attachmentId } = await params;
  const resultId = new URL(request.url).searchParams.get("resultId");
  if (!uuid.test(attachmentId) || !resultId || resultId.length > 200) return invalid();
  const context = await loadLabResultPhase2Context(request, workspaceId, false, true);
  if (!context.ok) return context.response;
  const entry = await resolveLabResultEntry(context.client, workspaceId, resultId);
  if (!entry) return unavailable();
  const found = await context.trusted!.from("lab_result_attachments")
    .select("id, mime_type, file_name, byte_size, storage_path, ready_at, deleted_at")
    .eq("workspace_id", workspaceId).eq("lab_result_entry_id", entry.id).eq("id", attachmentId).maybeSingle();
  if (found.error || !found.data?.ready_at || found.data.deleted_at) return unavailable();
  const file = await context.trusted!.storage.from(LAB_RESULT_ATTACHMENT_BUCKET).download(found.data.storage_path);
  if (file.error || !file.data) return Response.json({ ok: false, error: "file_read_failed" }, { status: 500 });
  const disposition = new URL(request.url).searchParams.get("download") === "1" ? "attachment" : "inline";
  // The legacy filename parameter must remain ASCII; filename* preserves the original Unicode name.
  const filename = found.data.file_name.replace(/[^\x20-\x7E]|["\\]/g, "_");
  const encodedFilename = encodeURIComponent(found.data.file_name)
    .replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
  return new Response(file.data, { headers: {
    "Content-Type": found.data.mime_type,
    "Content-Disposition": `${disposition}; filename="${filename}"; filename*=UTF-8''${encodedFilename}`,
    "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
  } });
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const { workspaceId, attachmentId } = await params;
  const resultId = new URL(request.url).searchParams.get("resultId");
  if (!uuid.test(attachmentId) || !resultId || resultId.length > 200) return invalid();
  const context = await loadLabResultPhase2Context(request, workspaceId, true, true);
  if (!context.ok) return context.response;
  const rateLimited = enforceWorkspaceMutationRateLimit({ request, actorUserId: context.actorUserId, workspaceId, operation: "lab_result_attachment_delete" });
  if (rateLimited) return rateLimited;
  const entry = await resolveLabResultEntry(context.client, workspaceId, resultId);
  if (!entry) return unavailable();
  const removed = await context.client.rpc("clair_mutate_lab_attachment", {
    p_workspace_id: workspaceId, p_result_id: resultId, p_attachment_id: attachmentId,
    p_action: "delete", p_actor_user_id: context.actorUserId,
  });
  if (removed.error || !removed.data) return Response.json({ ok: false, error: "attachment_delete_failed" }, { status: removed.error?.code === "42501" ? 403 : 409 });
  // Tombstone commits first: every subsequent read checks it. Storage cleanup
  // is retried by the bounded reconciliation job when the remove call fails.
  const cleanup = await context.trusted!.storage.from(LAB_RESULT_ATTACHMENT_BUCKET).remove([removed.data.storage_path]);
  const marked = cleanup.error ? null : await context.trusted!.from("lab_result_attachments")
    .update({ storage_deleted_at: new Date().toISOString() })
    .eq("workspace_id", workspaceId).eq("lab_result_entry_id", entry.id).eq("id", attachmentId)
    .not("deleted_at", "is", null).is("storage_deleted_at", null);
  return Response.json({ ok: true, storageCleanupPending: Boolean(cleanup.error || marked?.error) }, { headers: { "Cache-Control": "private, no-store" } });
}

function invalid() { return Response.json({ ok: false, error: "invalid_input" }, { status: 400 }); }
function unavailable() { return Response.json({ ok: false, error: "attachment_unavailable" }, { status: 404 }); }
