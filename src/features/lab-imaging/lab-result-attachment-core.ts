export const LAB_RESULT_ATTACHMENT_BUCKET = "lab-result-attachments";

export const labResultAttachmentExtensions = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
  "text/csv": "csv",
  "text/plain": "txt",
} as const;

export type LabResultAttachmentMime = keyof typeof labResultAttachmentExtensions;

export function validateLabResultAttachment(input: {
  name: unknown;
  mimeType: unknown;
  size: unknown;
}) {
  if (typeof input.mimeType !== "string" || !Object.hasOwn(labResultAttachmentExtensions, input.mimeType)) {
    return { ok: false as const, status: 415 as const, error: "unsupported_media_type" };
  }
  const mimeType = input.mimeType as LabResultAttachmentMime;
  const max = mimeType === "application/pdf" ? 20 * 1024 * 1024 : 5 * 1024 * 1024;
  if (typeof input.size !== "number" || !Number.isInteger(input.size) || input.size < 1 || input.size > max) {
    return { ok: false as const, status: 413 as const, error: "invalid_size" };
  }
  if (typeof input.name !== "string" || input.name.trim().length < 1 || input.name.length > 200 || /[\x00-\x1f\x7f]/.test(input.name)) {
    return { ok: false as const, status: 400 as const, error: "invalid_name" };
  }
  return { ok: true as const, name: input.name.trim(), mimeType, size: input.size };
}

export function labResultAttachmentPath(workspaceId: string, entryId: string, id: string, mimeType: LabResultAttachmentMime) {
  return `${workspaceId}/${entryId}/${id}.${labResultAttachmentExtensions[mimeType]}`;
}

export function matchesLabResultAttachmentBytes(mimeType: LabResultAttachmentMime, bytes: Uint8Array) {
  if (mimeType === "image/jpeg") return bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff && bytes.at(-2) === 0xff && bytes.at(-1) === 0xd9;
  if (mimeType === "image/png") return bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value);
  if (mimeType === "image/webp") return bytes.length >= 12 && ascii(bytes, 0, "RIFF") && ascii(bytes, 8, "WEBP");
  if (mimeType === "application/pdf") return bytes.length >= 8 && ascii(bytes, 0, "%PDF-") && new TextDecoder().decode(bytes.subarray(Math.max(0, bytes.length - 1024))).includes("%%EOF");
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return !bytes.includes(0);
  } catch {
    return false;
  }
}

function ascii(bytes: Uint8Array, offset: number, expected: string) {
  return [...expected].every((letter, index) => bytes[offset + index] === letter.charCodeAt(0));
}
