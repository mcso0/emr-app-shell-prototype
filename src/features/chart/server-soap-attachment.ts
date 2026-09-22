import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  SOAP_ATTACHMENT_BUCKET,
  soapAttachmentUrl,
  type SoapAttachmentGateway,
  type SoapAttachmentMime,
  type SoapAttachmentRecord,
} from "./soap-attachment-core";

export function createSupabaseSoapAttachmentGateway(client: SupabaseClient, trustedClient: SupabaseClient | null): SoapAttachmentGateway {
  const bucket = client.storage.from(SOAP_ATTACHMENT_BUCKET);
  return {
    async encounterStatus(workspaceId, encounterId) {
      const { data, error } = await client.rpc("clair_get_chart_soap_attachment_encounter_status", {
        p_workspace_id: workspaceId,
        p_encounter_id: encounterId,
      });
      return error ? null : typeof data === "string" ? data : null;
    },
    async insertPending(record) {
      const { error } = await client.from("chart_soap_attachments").insert({
        id: record.id,
        workspace_id: record.workspaceId,
        encounter_id: record.encounterId,
        actor_user_id: record.actorUserId,
        storage_path: record.storagePath,
        pending_path: record.pendingPath,
        mime_type: record.mimeType,
        byte_size: record.size,
        file_name: record.name,
      });
      return !error;
    },
    async find(workspaceId, encounterId, id) {
      const { data, error } = await client.from("chart_soap_attachments")
        .select("id, workspace_id, encounter_id, actor_user_id, storage_path, pending_path, mime_type, byte_size, file_name, ready_at, cancelled_at")
        .eq("workspace_id", workspaceId).eq("encounter_id", encounterId).eq("id", id).maybeSingle();
      return error ? null : mapRecord(data);
    },
    async createUploadUrl(path) {
      const { data, error } = await bucket.createSignedUploadUrl(path);
      return error ? null : data?.signedUrl ?? null;
    },
    async download(path) {
      const { data, error } = await bucket.download(path);
      if (error || !data) return null;
      return { bytes: new Uint8Array(await data.arrayBuffer()), contentType: data.type || null };
    },
    async markReady(record, bytes) {
      if (!trustedClient) return false;
      const trustedBucket = trustedClient.storage.from(SOAP_ATTACHMENT_BUCKET);
      const promoted = await trustedBucket.upload(record.storagePath, bytes, {
        upsert: false,
        contentType: record.mimeType,
        cacheControl: "300",
      });
      if (promoted.error) {
        // A prior finalize may have promoted the same immutable bytes before
        // its DB response was lost. Never overwrite a final object.
        const existing = await trustedBucket.download(record.storagePath);
        if (existing.error || !existing.data || existing.data.type !== record.mimeType ||
          !equalBytes(new Uint8Array(await existing.data.arrayBuffer()), bytes)) return false;
      }
      const { data, error } = await trustedClient.from("chart_soap_attachments")
        .update({ ready_at: new Date().toISOString() })
        .eq("id", record.id).eq("workspace_id", record.workspaceId)
        .eq("encounter_id", record.encounterId).eq("actor_user_id", record.actorUserId)
        .eq("storage_path", record.storagePath).eq("pending_path", record.pendingPath)
        .is("ready_at", null).is("cancelled_at", null).select("id").maybeSingle();
      // A failed response can mean the DB committed. Keep the immutable final
      // bytes for a safe retry/readback instead of risking a broken reference.
      if (error || data?.id !== record.id) return false;
      await trustedBucket.remove([record.pendingPath]);
      return true;
    },
    async signRead(path) {
      const { data, error } = await bucket.createSignedUrl(path, 60);
      return error ? null : data?.signedUrl ?? null;
    },
    async discard(record) {
      if (record.ready || record.cancelled || !trustedClient) return false;
      const { data, error } = await trustedClient.from("chart_soap_attachments")
        .update({ cancelled_at: new Date().toISOString() })
        .eq("id", record.id).eq("workspace_id", record.workspaceId)
        .eq("actor_user_id", record.actorUserId).is("ready_at", null)
        .is("cancelled_at", null).select("id").maybeSingle();
      if (error || data?.id !== record.id) return false;
      await trustedClient.storage.from(SOAP_ATTACHMENT_BUCKET).remove([record.pendingPath, record.storagePath]);
      return true;
    },
  };
}

function equalBytes(left: Uint8Array, right: Uint8Array) {
  return left.length === right.length && left.every((byte, index) => byte === right[index]);
}

function mapRecord(value: unknown): SoapAttachmentRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (
    typeof row.id !== "string" || typeof row.workspace_id !== "string" ||
    typeof row.encounter_id !== "string" || typeof row.actor_user_id !== "string" ||
    typeof row.storage_path !== "string" || typeof row.pending_path !== "string" || typeof row.mime_type !== "string" ||
    typeof row.byte_size !== "number" || typeof row.file_name !== "string"
  ) return null;
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    encounterId: row.encounter_id,
    actorUserId: row.actor_user_id,
    storagePath: row.storage_path,
    pendingPath: row.pending_path,
    mimeType: row.mime_type as SoapAttachmentMime,
    size: row.byte_size,
    name: row.file_name,
    ready: typeof row.ready_at === "string",
    cancelled: typeof row.cancelled_at === "string",
    url: soapAttachmentUrl(row.workspace_id, row.encounter_id, row.id),
  };
}
