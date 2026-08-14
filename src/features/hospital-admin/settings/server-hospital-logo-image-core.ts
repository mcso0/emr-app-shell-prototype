import sharp from "sharp";

export const MAX_HOSPITAL_LOGO_BYTES = 5 * 1024 * 1024;
export const MAX_HOSPITAL_LOGO_PIXELS = 25_000_000;
export const MIN_HOSPITAL_LOGO_SIDE = 256;
export const NORMALIZED_HOSPITAL_LOGO_SIDE = 512;

type SupportedLogoMime = "image/jpeg" | "image/png";

export type HospitalLogoImageError =
  | "animated_logo_not_allowed"
  | "logo_decode_failed"
  | "logo_dimensions_too_small"
  | "logo_mime_mismatch"
  | "logo_pixel_limit_exceeded"
  | "logo_too_large"
  | "unsupported_logo_type";

type HospitalLogoMetadata = {
  autoOrient?: { height?: number; width?: number };
  format?: string;
  height?: number;
  pages?: number;
  width?: number;
};

export async function normalizeHospitalLogoImage({
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
  | { ok: false; error: HospitalLogoImageError }
> {
  if (bytes.byteLength > MAX_HOSPITAL_LOGO_BYTES) {
    return { ok: false, error: "logo_too_large" };
  }
  const detectedMime = detectHospitalLogoMime(bytes);
  if (!detectedMime) return { ok: false, error: "unsupported_logo_type" };
  if (
    detectedMime !== declaredMime ||
    (storedMime && storedMime !== detectedMime)
  ) {
    return { ok: false, error: "logo_mime_mismatch" };
  }

  const input = Buffer.from(bytes);
  const options = {
    animated: true,
    failOn: "warning" as const,
    limitInputPixels: MAX_HOSPITAL_LOGO_PIXELS,
  };
  try {
    const metadata = await sharp(input, options).metadata();
    if (metadata.format !== formatForMime(detectedMime)) {
      return { ok: false, error: "logo_mime_mismatch" };
    }
    const validation = validateHospitalLogoMetadata(metadata);
    if (!validation.ok) return validation;

    const { data, info } = await sharp(input, options)
      .rotate()
      .resize(NORMALIZED_HOSPITAL_LOGO_SIDE, NORMALIZED_HOSPITAL_LOGO_SIDE, {
        fit: "contain",
        position: "centre",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .webp({ effort: 4, quality: 84, alphaQuality: 100 })
      .toBuffer({ resolveWithObject: true });
    if (
      info.format !== "webp" ||
      info.width !== NORMALIZED_HOSPITAL_LOGO_SIDE ||
      info.height !== NORMALIZED_HOSPITAL_LOGO_SIDE
    ) {
      return { ok: false, error: "logo_decode_failed" };
    }
    return {
      ok: true,
      bytes: data,
      contentType: "image/webp",
      width: NORMALIZED_HOSPITAL_LOGO_SIDE,
      height: NORMALIZED_HOSPITAL_LOGO_SIDE,
    };
  } catch (error) {
    return {
      ok: false,
      error: isPixelLimitError(error)
        ? "logo_pixel_limit_exceeded"
        : "logo_decode_failed",
    };
  }
}

export function validateHospitalLogoMetadata(
  metadata: HospitalLogoMetadata
):
  | { ok: true }
  | {
      ok: false;
      error:
        | "animated_logo_not_allowed"
        | "logo_decode_failed"
        | "logo_dimensions_too_small"
        | "logo_pixel_limit_exceeded"
        | "unsupported_logo_type";
    } {
  if (metadata.format !== "jpeg" && metadata.format !== "png") {
    return { ok: false, error: "unsupported_logo_type" };
  }
  if ((metadata.pages ?? 1) !== 1) {
    return { ok: false, error: "animated_logo_not_allowed" };
  }
  const width = metadata.autoOrient?.width ?? metadata.width;
  const height = metadata.autoOrient?.height ?? metadata.height;
  if (!width || !height) return { ok: false, error: "logo_decode_failed" };
  if (width * height > MAX_HOSPITAL_LOGO_PIXELS) {
    return { ok: false, error: "logo_pixel_limit_exceeded" };
  }
  if (width < MIN_HOSPITAL_LOGO_SIDE || height < MIN_HOSPITAL_LOGO_SIDE) {
    return { ok: false, error: "logo_dimensions_too_small" };
  }
  return { ok: true };
}

function detectHospitalLogoMime(
  bytes: Uint8Array
): SupportedLogoMime | null {
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
  return null;
}

function formatForMime(mime: SupportedLogoMime) {
  return mime === "image/jpeg" ? "jpeg" : "png";
}

function isPixelLimitError(error: unknown) {
  return (
    error instanceof Error &&
    /pixel limit|input image exceeds pixel limit/i.test(error.message)
  );
}
