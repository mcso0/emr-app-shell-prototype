import {
  validateSoapAttachmentMetadata,
  type SoapAttachment,
} from "./soap-attachment-core";

type UploadInput = {
  workspaceId: string;
  encounterId: string;
  file: File;
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
};

export async function uploadSoapAttachment({
  workspaceId,
  encounterId,
  file,
  onProgress,
  signal,
}: UploadInput): Promise<SoapAttachment> {
  const metadata = validateSoapAttachmentMetadata({ mimeType: file.type, size: file.size, name: file.name });
  if (!metadata.ok) throw new Error(metadata.error);
  if (signal?.aborted) throw new DOMException("Upload cancelled", "AbortError");
  const endpoint = `/api/workspaces/${encodeURIComponent(workspaceId)}/chart/soap-attachments`;
  const prepare = await postAttachment(endpoint, {
    action: "prepare",
    encounterId,
    mimeType: file.type,
    size: file.size,
    name: file.name,
  }, signal);
  if (prepare.ok !== true || typeof prepare.attachmentId !== "string" || typeof prepare.uploadUrl !== "string") {
    throw new Error("attachment_prepare_failed");
  }
  try {
    await uploadFile(prepare.uploadUrl, file, onProgress, signal);
    const finalizeBody = {
      action: "finalize",
      encounterId,
      attachmentId: prepare.attachmentId,
    };
    let finalized: Record<string, unknown>;
    try {
      finalized = await postAttachment(endpoint, finalizeBody, signal);
    } catch (error) {
      if (signal?.aborted) throw error;
      // A lost response may follow a committed finalize. Retry the same ID.
      finalized = await postAttachment(endpoint, finalizeBody, signal);
    }
    if (finalized.ok !== true || !isAttachment(finalized.attachment)) {
      throw new Error("attachment_finalize_failed");
    }
    onProgress?.(100);
    return finalized.attachment;
  } catch (error) {
    // Discard only a pending upload. The server refuses to delete a ready attachment.
    await postAttachment(endpoint, {
      action: "discard",
      encounterId,
      attachmentId: prepare.attachmentId,
    }).catch(() => {});
    throw error;
  }
}

async function postAttachment(
  endpoint: string,
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<Record<string, unknown>> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "same-origin",
    cache: "no-store",
    signal,
  });
  const value: unknown = await response.json().catch(() => null);
  if (!response.ok || !value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(
      value && typeof value === "object" && !Array.isArray(value) && typeof (value as Record<string, unknown>).error === "string"
        ? (value as Record<string, string>).error
        : "attachment_request_failed",
    );
  }
  return value as Record<string, unknown>;
}

function uploadFile(url: string, file: File, onProgress?: (percent: number) => void, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Upload cancelled", "AbortError"));
      return;
    }
    const xhr = new XMLHttpRequest();
    const abort = () => xhr.abort();
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) {
      signal.removeEventListener("abort", abort);
      reject(new DOMException("Upload cancelled", "AbortError"));
      return;
    }
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.setRequestHeader("Cache-Control", "max-age=3600");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress?.(Math.min(99, Math.round((event.loaded / event.total) * 99)));
      }
    };
    xhr.onload = () => {
      signal?.removeEventListener("abort", abort);
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error("attachment_upload_failed"));
    };
    xhr.onerror = () => {
      signal?.removeEventListener("abort", abort);
      reject(new Error("attachment_upload_failed"));
    };
    xhr.onabort = () => {
      signal?.removeEventListener("abort", abort);
      reject(new DOMException("Upload cancelled", "AbortError"));
    };
    if (signal?.aborted) abort();
    else xhr.send(file);
  });
}

function isAttachment(value: unknown): value is SoapAttachment {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const attachment = value as Record<string, unknown>;
  return typeof attachment.id === "string" && typeof attachment.url === "string" &&
    typeof attachment.mimeType === "string" && typeof attachment.name === "string" &&
    typeof attachment.size === "number";
}
