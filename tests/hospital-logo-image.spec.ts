import { expect, test } from "@playwright/test";
import sharp from "sharp";

import {
  MAX_HOSPITAL_LOGO_BYTES,
  normalizeHospitalLogoImage,
  validateHospitalLogoMetadata,
} from "@/features/hospital-admin/settings/server-hospital-logo-image-core";

test("hospital logo accepts JPEG and PNG and normalizes with contain fit to metadata-free 512px WebP", async () => {
  for (const source of [
    {
      mime: "image/jpeg",
      bytes: await sharp({
        create: {
          width: 640,
          height: 320,
          channels: 3,
          background: "#2463eb",
        },
      })
        .jpeg()
        .toBuffer(),
    },
    {
      mime: "image/png",
      bytes: await sharp({
        create: {
          width: 320,
          height: 640,
          channels: 4,
          background: { r: 36, g: 99, b: 235, alpha: 0.8 },
        },
      })
        .png()
        .toBuffer(),
    },
  ]) {
    const result = await normalizeHospitalLogoImage({
      bytes: source.bytes,
      declaredMime: source.mime,
      storedMime: source.mime,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) continue;
    expect(result).toMatchObject({
      contentType: "image/webp",
      width: 512,
      height: 512,
    });
    const metadata = await sharp(result.bytes).metadata();
    expect(metadata).toMatchObject({
      format: "webp",
      width: 512,
      height: 512,
      hasAlpha: true,
    });
    expect(metadata.exif).toBeUndefined();
    expect(metadata.icc).toBeUndefined();
    expect(metadata.xmp).toBeUndefined();
    expect((await sharp(result.bytes).stats()).isOpaque).toBe(false);
  }
});

test("hospital logo rejects size, unsupported formats, MIME mismatch, malformed and animated input", async () => {
  const validPng = await sharp({
    create: {
      width: 300,
      height: 300,
      channels: 3,
      background: "#336699",
    },
  })
    .png()
    .toBuffer();

  await expect(
    normalizeHospitalLogoImage({
      bytes: Buffer.alloc(MAX_HOSPITAL_LOGO_BYTES + 1),
      declaredMime: "image/png",
      storedMime: "image/png",
    })
  ).resolves.toEqual({ ok: false, error: "logo_too_large" });
  await expect(
    normalizeHospitalLogoImage({
      bytes: validPng,
      declaredMime: "image/jpeg",
      storedMime: "image/jpeg",
    })
  ).resolves.toEqual({ ok: false, error: "logo_mime_mismatch" });
  await expect(
    normalizeHospitalLogoImage({
      bytes: Buffer.from("<svg></svg>"),
      declaredMime: "image/svg+xml",
      storedMime: "image/svg+xml",
    })
  ).resolves.toEqual({ ok: false, error: "unsupported_logo_type" });
  await expect(
    normalizeHospitalLogoImage({
      bytes: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      declaredMime: "image/png",
      storedMime: "image/png",
    })
  ).resolves.toEqual({ ok: false, error: "logo_decode_failed" });
});

test("hospital logo metadata enforces minimum side, pixel limit, and a single frame", () => {
  expect(
    validateHospitalLogoMetadata({
      format: "png",
      width: 255,
      height: 300,
      pages: 1,
    })
  ).toEqual({ ok: false, error: "logo_dimensions_too_small" });
  expect(
    validateHospitalLogoMetadata({
      format: "jpeg",
      width: 5_001,
      height: 5_000,
      pages: 1,
    })
  ).toEqual({ ok: false, error: "logo_pixel_limit_exceeded" });
  expect(
    validateHospitalLogoMetadata({
      format: "png",
      width: 300,
      height: 300,
      pages: 2,
    })
  ).toEqual({ ok: false, error: "animated_logo_not_allowed" });
  expect(
    validateHospitalLogoMetadata({
      format: "webp",
      width: 300,
      height: 300,
      pages: 1,
    })
  ).toEqual({ ok: false, error: "unsupported_logo_type" });
});
