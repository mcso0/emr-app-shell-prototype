import sharp from "sharp";

export const MAX_PROFILE_AVATAR_BYTES = 5 * 1024 * 1024;
export const MAX_PROFILE_AVATAR_PIXELS = 25_000_000;
export const MIN_PROFILE_AVATAR_SIDE = 256;
export const NORMALIZED_PROFILE_AVATAR_SIDE = 512;

type SupportedAvatarMime = "image/jpeg" | "image/png" | "image/webp";

export type ProfileAvatarImageError =
  | "animated_avatar_not_allowed"
  | "avatar_decode_failed"
  | "avatar_dimensions_too_small"
  | "avatar_mime_mismatch"
  | "avatar_pixel_limit_exceeded"
  | "avatar_too_large"
  | "unsupported_avatar_type";

type AvatarMetadata = {
  autoOrient?: { height?: number; width?: number };
  format?: string;
  height?: number;
  mediaType?: string;
  pages?: number;
  width?: number;
};

export async function normalizeProfileAvatarImage({
  bytes,
  declaredMime,
  storedMime,
}: {
  bytes: Uint8Array;
  declaredMime: string;
  storedMime?: string | null;
}): Promise<
  | {
      ok: true;
      bytes: Buffer;
      contentType: "image/webp";
      height: 512;
      width: 512;
    }
  | { ok: false; error: ProfileAvatarImageError }
> {
  if (bytes.byteLength > MAX_PROFILE_AVATAR_BYTES) {
    return { ok: false, error: "avatar_too_large" };
  }
  const detectedMime = detectAvatarMime(bytes);
  if (!detectedMime) return { ok: false, error: "unsupported_avatar_type" };
  if (
    detectedMime !== declaredMime ||
    (storedMime && storedMime !== detectedMime)
  ) {
    return { ok: false, error: "avatar_mime_mismatch" };
  }

  const input = Buffer.from(bytes);
  const options = {
    animated: true,
    failOn: "warning" as const,
    limitInputPixels: MAX_PROFILE_AVATAR_PIXELS,
  };
  try {
    const metadata = await sharp(input, options).metadata();
    if (metadata.format !== formatForMime(detectedMime)) {
      return { ok: false, error: "avatar_mime_mismatch" };
    }
    const validation = validateProfileAvatarMetadata(metadata);
    if (!validation.ok) return validation;

    const { data, info } = await sharp(input, options)
      .rotate()
      .resize(NORMALIZED_PROFILE_AVATAR_SIDE, NORMALIZED_PROFILE_AVATAR_SIDE, {
        fit: "cover",
        position: "centre",
      })
      .webp({ effort: 4, quality: 82 })
      .toBuffer({ resolveWithObject: true });
    if (
      info.format !== "webp" ||
      info.width !== NORMALIZED_PROFILE_AVATAR_SIDE ||
      info.height !== NORMALIZED_PROFILE_AVATAR_SIDE
    ) {
      return { ok: false, error: "avatar_decode_failed" };
    }
    return {
      ok: true,
      bytes: data,
      contentType: "image/webp",
      height: NORMALIZED_PROFILE_AVATAR_SIDE,
      width: NORMALIZED_PROFILE_AVATAR_SIDE,
    };
  } catch (error) {
    return {
      ok: false,
      error: isPixelLimitError(error)
        ? "avatar_pixel_limit_exceeded"
        : "avatar_decode_failed",
    };
  }
}

export function validateProfileAvatarMetadata(
  metadata: AvatarMetadata,
):
  | { ok: true }
  | {
      ok: false;
      error:
        | "animated_avatar_not_allowed"
        | "avatar_decode_failed"
        | "avatar_dimensions_too_small"
        | "avatar_pixel_limit_exceeded"
        | "unsupported_avatar_type";
    } {
  if (
    metadata.format !== "jpeg" &&
    metadata.format !== "png" &&
    metadata.format !== "webp"
  ) {
    return { ok: false, error: "unsupported_avatar_type" };
  }
  if ((metadata.pages ?? 1) !== 1) {
    return { ok: false, error: "animated_avatar_not_allowed" };
  }
  const width = metadata.autoOrient?.width ?? metadata.width;
  const height = metadata.autoOrient?.height ?? metadata.height;
  if (!width || !height) return { ok: false, error: "avatar_decode_failed" };
  if (width * height > MAX_PROFILE_AVATAR_PIXELS) {
    return { ok: false, error: "avatar_pixel_limit_exceeded" };
  }
  if (
    width < MIN_PROFILE_AVATAR_SIDE ||
    height < MIN_PROFILE_AVATAR_SIDE
  ) {
    return { ok: false, error: "avatar_dimensions_too_small" };
  }
  return { ok: true };
}

function detectAvatarMime(bytes: Uint8Array): SupportedAvatarMime | null {
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    Buffer.from(bytes.subarray(0, 4)).toString("ascii") === "RIFF" &&
    Buffer.from(bytes.subarray(8, 12)).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

function formatForMime(mime: SupportedAvatarMime) {
  return mime === "image/jpeg" ? "jpeg" : mime.slice("image/".length);
}

function isPixelLimitError(error: unknown) {
  return (
    error instanceof Error &&
    /pixel limit|input image exceeds pixel limit/i.test(error.message)
  );
}
