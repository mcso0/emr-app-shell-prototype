import {
  resolveWorkspacePermission,
  type WorkspacePermissionAdapter,
} from "@/features/auth/permission-resolver";

export const SOAP_ATTACHMENT_BUCKET = "chart-soap-attachments";
export const SOAP_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const SOAP_VIDEO_MAX_BYTES = 20 * 1024 * 1024;

const mimeExtensions = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/webm": "webm",
} as const;

export type SoapAttachmentMime = keyof typeof mimeExtensions;
export type SoapAttachment = {
  id: string;
  url: string;
  mimeType: SoapAttachmentMime;
  name: string;
  size: number;
};
export type SoapAttachmentRecord = SoapAttachment & {
  workspaceId: string;
  encounterId: string;
  actorUserId: string;
  storagePath: string;
  pendingPath: string;
  ready: boolean;
  cancelled: boolean;
};
export type SoapAttachmentGateway = {
  encounterStatus(workspaceId: string, encounterId: string): Promise<string | null>;
  insertPending(record: SoapAttachmentRecord): Promise<boolean>;
  find(workspaceId: string, encounterId: string, id: string): Promise<SoapAttachmentRecord | null>;
  createUploadUrl(path: string): Promise<string | null>;
  download(path: string): Promise<{ bytes: Uint8Array; contentType: string | null } | null>;
  markReady(record: SoapAttachmentRecord, bytes: Uint8Array): Promise<boolean>;
  signRead(path: string): Promise<string | null>;
  discard(record: SoapAttachmentRecord): Promise<boolean>;
};
export type SoapAttachmentResult<T> =
  | { ok: true; status: 200 | 201; value: T }
  | { ok: false; status: 400 | 401 | 403 | 409 | 413 | 415 | 500; error: string };

export function soapAttachmentUrl(workspaceId: string, encounterId: string, id: string) {
  return `/api/workspaces/${workspaceId}/chart/soap-attachments/${id}?encounterId=${encounterId}`;
}

export function soapAttachmentPath(workspaceId: string, encounterId: string, id: string, mimeType: SoapAttachmentMime) {
  return `${workspaceId}/${encounterId}/ready/${id}.${mimeExtensions[mimeType]}`;
}

export function soapAttachmentPendingPath(workspaceId: string, encounterId: string, id: string, mimeType: SoapAttachmentMime) {
  return `${workspaceId}/${encounterId}/pending/${id}.${mimeExtensions[mimeType]}`;
}

export function validateSoapAttachmentMetadata(input: { mimeType: unknown; size: unknown; name: unknown }) {
  const mimeType = input.mimeType;
  if (typeof mimeType !== "string" || !Object.hasOwn(mimeExtensions, mimeType)) {
    return { ok: false as const, status: 415 as const, error: "unsupported_media_type" };
  }
  const max = mimeType.startsWith("image/") ? SOAP_IMAGE_MAX_BYTES : SOAP_VIDEO_MAX_BYTES;
  if (typeof input.size !== "number" || !Number.isInteger(input.size) || input.size < 1 || input.size > max) {
    return { ok: false as const, status: 413 as const, error: "invalid_size" };
  }
  if (typeof input.name !== "string" || input.name.trim().length < 1 || input.name.length > 200 || /[\x00-\x1f\x7f]/.test(input.name)) {
    return { ok: false as const, status: 400 as const, error: "invalid_name" };
  }
  return { ok: true as const, mimeType: mimeType as SoapAttachmentMime, size: input.size, name: input.name.trim() };
}

export function matchesSoapAttachmentBytes(mimeType: SoapAttachmentMime, bytes: Uint8Array) {
  if (mimeType === "image/jpeg") return bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff && bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9;
  if (mimeType === "image/png") return bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte);
  if (mimeType === "image/webp") return bytes.length >= 12 && ascii(bytes, 0, "RIFF") && ascii(bytes, 8, "WEBP");
  if (mimeType === "video/mp4") return bytes.length >= 12 && ascii(bytes, 4, "ftyp");
  return bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
}

function ascii(bytes: Uint8Array, offset: number, expected: string) {
  return [...expected].every((character, index) => bytes[offset + index] === character.charCodeAt(0));
}

function authorize(actorUserId: string | null, workspaceId: string, permissionAdapter: WorkspacePermissionAdapter, write: boolean) {
  const permission = resolveWorkspacePermission(permissionAdapter, {
    sessionUserId: actorUserId,
    workspaceId,
    requiredPermission: write ? "chart:update" : "chart:view",
  });
  return permission.allowed ? null : {
    ok: false as const,
    status: (permission.denialReason === "unauthenticated" ? 401 : 403) as 401 | 403,
    error: permission.denialReason ?? "permission_missing",
  };
}

export async function prepareSoapAttachment(input: {
  actorUserId: string | null;
  workspaceId: string;
  encounterId: string;
  id: string;
  mimeType: unknown;
  size: unknown;
  name: unknown;
  permissionAdapter: WorkspacePermissionAdapter;
  gateway: SoapAttachmentGateway;
}): Promise<SoapAttachmentResult<{ attachmentId: string; uploadUrl: string }>> {
  const denied = authorize(input.actorUserId, input.workspaceId, input.permissionAdapter, true);
  if (denied) return denied;
  const metadata = validateSoapAttachmentMetadata(input);
  if (!metadata.ok) return metadata;
  const status = await input.gateway.encounterStatus(input.workspaceId, input.encounterId);
  if (!status || status === "cancelled") return { ok: false, status: 409, error: "encounter_unavailable" };
  if (status !== "in_consultation" && status !== "ordered") return { ok: false, status: 409, error: "stale_status" };
  const record: SoapAttachmentRecord = {
    id: input.id,
    workspaceId: input.workspaceId,
    encounterId: input.encounterId,
    actorUserId: input.actorUserId!,
    mimeType: metadata.mimeType,
    size: metadata.size,
    name: metadata.name,
    storagePath: soapAttachmentPath(input.workspaceId, input.encounterId, input.id, metadata.mimeType),
    pendingPath: soapAttachmentPendingPath(input.workspaceId, input.encounterId, input.id, metadata.mimeType),
    url: soapAttachmentUrl(input.workspaceId, input.encounterId, input.id),
    ready: false,
    cancelled: false,
  };
  if (!(await input.gateway.insertPending(record))) return { ok: false, status: 500, error: "db_write_failed" };
  const uploadUrl = await input.gateway.createUploadUrl(record.pendingPath);
  if (!uploadUrl) {
    await input.gateway.discard(record);
    return { ok: false, status: 500, error: "storage_sign_failed" };
  }
  return { ok: true, status: 201, value: { attachmentId: record.id, uploadUrl } };
}

export async function finalizeSoapAttachment(input: {
  actorUserId: string | null;
  workspaceId: string;
  encounterId: string;
  attachmentId: string;
  permissionAdapter: WorkspacePermissionAdapter;
  gateway: SoapAttachmentGateway;
}): Promise<SoapAttachmentResult<SoapAttachment>> {
  const denied = authorize(input.actorUserId, input.workspaceId, input.permissionAdapter, true);
  if (denied) return denied;
  const status = await input.gateway.encounterStatus(input.workspaceId, input.encounterId);
  if (!status || status === "cancelled") return { ok: false, status: 409, error: "encounter_unavailable" };
  if (status !== "in_consultation" && status !== "ordered") return { ok: false, status: 409, error: "stale_status" };
  const record = await input.gateway.find(input.workspaceId, input.encounterId, input.attachmentId);
  if (!record || record.actorUserId !== input.actorUserId || record.cancelled) return { ok: false, status: 403, error: "attachment_unavailable" };
  if (record.ready) return { ok: true, status: 200, value: { id: record.id, url: record.url, mimeType: record.mimeType, size: record.size, name: record.name } };
  const downloaded = await input.gateway.download(record.pendingPath);
  if (!downloaded || downloaded.bytes.length !== record.size || !matchesSoapAttachmentBytes(record.mimeType, downloaded.bytes) || (downloaded.contentType && downloaded.contentType !== record.mimeType)) {
    return { ok: false, status: 415, error: "invalid_media_content" };
  }
  if (!(await input.gateway.markReady(record, downloaded.bytes))) return { ok: false, status: 500, error: "db_write_failed" };
  return { ok: true, status: 200, value: { id: record.id, url: record.url, mimeType: record.mimeType, size: record.size, name: record.name } };
}

export async function readSoapAttachment(input: {
  actorUserId: string | null;
  workspaceId: string;
  encounterId: string;
  attachmentId: string;
  permissionAdapter: WorkspacePermissionAdapter;
  gateway: SoapAttachmentGateway;
}): Promise<SoapAttachmentResult<string>> {
  const denied = authorize(input.actorUserId, input.workspaceId, input.permissionAdapter, false);
  if (denied) return denied;
  const status = await input.gateway.encounterStatus(input.workspaceId, input.encounterId);
  if (!status || status === "cancelled") return { ok: false, status: 409, error: "encounter_unavailable" };
  const record = await input.gateway.find(input.workspaceId, input.encounterId, input.attachmentId);
  if (!record?.ready || record.cancelled) return { ok: false, status: 403, error: "attachment_unavailable" };
  const signedUrl = await input.gateway.signRead(record.storagePath);
  return signedUrl ? { ok: true, status: 200, value: signedUrl } : { ok: false, status: 500, error: "storage_sign_failed" };
}
