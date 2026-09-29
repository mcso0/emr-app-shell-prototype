import { randomUUID } from "node:crypto";
import { LAB_RESULT_ATTACHMENT_BUCKET, labResultAttachmentPath, matchesLabResultAttachmentBytes, validateLabResultAttachment } from "@/features/lab-imaging/lab-result-attachment-core";
import { loadLabResultPhase2Context, resolveLabResultEntry } from "@/features/lab-imaging/server-lab-result-phase2-context";
import { enforceWorkspaceMutationRateLimit } from "@/lib/security/rate-limit";

type RouteContext = { params: Promise<{ workspaceId: string }> };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export async function POST(request: Request, { params }: RouteContext) {
  const { workspaceId } = await params;
  const body = await readBody(request);
  if (!body || typeof body.action !== "string" || typeof body.resultId !== "string"
    || !body.resultId || body.resultId.length > 200) return invalid();
  const context = await loadLabResultPhase2Context(request, workspaceId, true, true);
  if (!context.ok) return context.response;
  const rateLimited = enforceWorkspaceMutationRateLimit({ request, actorUserId: context.actorUserId, workspaceId, operation: `lab_result_attachment_${body.action}` });
  if (rateLimited) return rateLimited;
  if (body.action === "prepare" && (typeof body.rowId !== "string" || !body.rowId || body.rowId.length > 200)) return invalid();
  const entry = await resolveLabResultEntry(context.client, workspaceId, body.resultId, body.action === "prepare" ? body.rowId as string : undefined);
  if (!entry || (body.action !== "discard" && !["received", "entered"].includes(entry.result_status))) {
    return Response.json({ ok: false, error: "result_unavailable" }, { status: 409 });
  }
  if (body.action === "prepare") {
    const metadata = validateLabResultAttachment({ name: body.name, mimeType: body.mimeType, size: body.size });
    if (!metadata.ok) return Response.json(metadata, { status: metadata.status });
    const attachmentId = randomUUID();
    const path = labResultAttachmentPath(workspaceId, entry.id, attachmentId, metadata.mimeType);
    const inserted = await context.client.rpc("clair_prepare_lab_result_attachment", {
      p_workspace_id: workspaceId, p_result_id: body.resultId, p_row_id: body.rowId,
      p_attachment_id: attachmentId, p_file_name: metadata.name,
      p_mime_type: metadata.mimeType, p_byte_size: metadata.size,
    });
    if (inserted.error || inserted.data !== path) return Response.json({ ok: false, error: "attachment_prepare_failed" }, { status: 500 });
    const signed = await context.trusted!.storage.from(LAB_RESULT_ATTACHMENT_BUCKET).createSignedUploadUrl(path);
    if (signed.error || !signed.data?.token || !signed.data?.signedUrl) {
      await context.trusted!.from("lab_result_attachments").delete().eq("workspace_id", workspaceId).eq("id", attachmentId).is("ready_at", null);
      return Response.json({ ok: false, error: "upload_sign_failed" }, { status: 500 });
    }
    return Response.json({ ok: true, attachmentId, objectPath: path, uploadToken: signed.data.token, uploadUrl: signed.data.signedUrl }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  }
  if (body.action === "finalize" && typeof body.attachmentId === "string" && uuid.test(body.attachmentId)) {
    const found = await context.trusted!.from("lab_result_attachments")
      .select("id, row_id, uploaded_by_user_id, mime_type, byte_size, storage_path, ready_at, abandoned_at, deleted_at")
      .eq("workspace_id", workspaceId).eq("lab_result_entry_id", entry.id).eq("id", body.attachmentId).maybeSingle();
    const record = found.data;
    if (found.error || !record || record.abandoned_at || record.deleted_at || record.uploaded_by_user_id !== context.actorUserId) {
      return Response.json({ ok: false, error: "attachment_unavailable" }, { status: 404 });
    }
    if (record.ready_at) return Response.json({ ok: true, attachmentId: record.id }, { headers: { "Cache-Control": "private, no-store" } });
    const downloaded = await context.trusted!.storage.from(LAB_RESULT_ATTACHMENT_BUCKET).download(record.storage_path);
    if (downloaded.error || !downloaded.data) return Response.json({ ok: false, error: "upload_incomplete" }, { status: 409 });
    const bytes = new Uint8Array(await downloaded.data.arrayBuffer());
    if (bytes.length !== record.byte_size ||
      !matchesLabResultAttachmentBytes(record.mime_type, bytes) ||
      (downloaded.data.type && downloaded.data.type !== record.mime_type)) {
      return Response.json({ ok: false, error: "invalid_file_content" }, { status: 415 });
    }
    const ready = await context.trusted!.from("lab_result_attachments")
      .update({ ready_at: new Date().toISOString() })
      .eq("workspace_id", workspaceId).eq("lab_result_entry_id", entry.id).eq("id", record.id)
      .is("ready_at", null).is("abandoned_at", null).is("deleted_at", null).select("id").maybeSingle();
    if (ready.error || ready.data?.id !== record.id) return Response.json({ ok: false, error: "attachment_finalize_failed" }, { status: 409 });
    return Response.json({ ok: true, attachmentId: record.id }, { headers: { "Cache-Control": "private, no-store" } });
  }
  if (body.action === "discard" && typeof body.attachmentId === "string" && uuid.test(body.attachmentId)) {
    const pending = await context.trusted!.from("lab_result_attachments")
      .select("id, uploaded_by_user_id, storage_path, ready_at, abandoned_at")
      .eq("workspace_id", workspaceId).eq("lab_result_entry_id", entry.id).eq("id", body.attachmentId).maybeSingle();
    if (!pending.data || pending.data.uploaded_by_user_id !== context.actorUserId || pending.data.ready_at) {
      return Response.json({ ok: false, error: "attachment_unavailable" }, { status: 404 });
    }
    if (pending.data.abandoned_at) return Response.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
    const abandoned = await context.trusted!.from("lab_result_attachments")
      .update({ abandoned_at: new Date().toISOString() })
      .eq("workspace_id", workspaceId).eq("lab_result_entry_id", entry.id).eq("id", pending.data.id)
      .is("ready_at", null).is("abandoned_at", null).select("id").maybeSingle();
    if (abandoned.error || !abandoned.data) return Response.json({ ok: false, error: "discard_conflict" }, { status: 409 });
    // Signed upload tokens remain usable for two hours. Keep this metadata
    // until the three-hour reconciliation sweep can remove a late object.
    return Response.json({ ok: true, storageCleanupPending: true }, { headers: { "Cache-Control": "private, no-store" } });
  }
  return invalid();
}

function invalid() { return Response.json({ ok: false, error: "invalid_input" }, { status: 400 }); }

async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  if (!request.headers.get("content-type")?.startsWith("application/json")) return null;
  if (Number(request.headers.get("content-length")) > 4096) return null;
  const raw = await request.text().catch(() => "");
  if (raw.length > 4096) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch { return null; }
}
