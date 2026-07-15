import { expect, test } from "@playwright/test";
import sharp from "sharp";

import {
  MAX_PROFILE_AVATAR_BYTES,
  normalizeProfileAvatarImage,
  validateProfileAvatarMetadata,
} from "../src/features/staff/server-profile-avatar-image-core";

test("JPEG, PNG, and static WebP avatars decode and normalize to metadata-free 512px WebP", async () => {
  const source = sharp({
    create: {
      width: 320,
      height: 280,
      channels: 4,
      background: { r: 24, g: 120, b: 210, alpha: 0.8 },
    },
  });
  const inputs = [
    { bytes: await source.clone().jpeg().toBuffer(), mime: "image/jpeg" },
    { bytes: await source.clone().png().toBuffer(), mime: "image/png" },
    { bytes: await source.clone().webp().toBuffer(), mime: "image/webp" },
  ];

  for (const input of inputs) {
    const result = await normalizeProfileAvatarImage({
      bytes: input.bytes,
      declaredMime: input.mime,
      storedMime: input.mime,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) continue;
    expect(result.contentType).toBe("image/webp");
    expect(result.width).toBe(512);
    expect(result.height).toBe(512);

    const metadata = await sharp(result.bytes).metadata();
    expect(metadata.format).toBe("webp");
    expect(metadata.pages ?? 1).toBe(1);
    expect(metadata.exif).toBeUndefined();
    expect(metadata.icc).toBeUndefined();
    expect(metadata.xmp).toBeUndefined();
  }
});

test("avatar validation rejects size, MIME, magic, and decode mismatches", async () => {
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
    normalizeProfileAvatarImage({
      bytes: Buffer.alloc(MAX_PROFILE_AVATAR_BYTES + 1),
      declaredMime: "image/png",
      storedMime: "image/png",
    }),
  ).resolves.toEqual({ ok: false, error: "avatar_too_large" });
  await expect(
    normalizeProfileAvatarImage({
      bytes: validPng,
      declaredMime: "image/jpeg",
      storedMime: "image/jpeg",
    }),
  ).resolves.toEqual({ ok: false, error: "avatar_mime_mismatch" });
  await expect(
    normalizeProfileAvatarImage({
      bytes: Buffer.from("not-an-image"),
      declaredMime: "image/png",
      storedMime: "image/png",
    }),
  ).resolves.toEqual({ ok: false, error: "unsupported_avatar_type" });
  await expect(
    normalizeProfileAvatarImage({
      bytes: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      declaredMime: "image/png",
      storedMime: "image/png",
    }),
  ).resolves.toEqual({ ok: false, error: "avatar_decode_failed" });
});

test("avatar validation rejects undersized and excessive pixel dimensions", () => {
  expect(
    validateProfileAvatarMetadata({
      format: "png",
      mediaType: "image/png",
      width: 255,
      height: 300,
      pages: 1,
    }),
  ).toEqual({ ok: false, error: "avatar_dimensions_too_small" });
  expect(
    validateProfileAvatarMetadata({
      format: "jpeg",
      mediaType: "image/jpeg",
      width: 5_001,
      height: 5_000,
      pages: 1,
    }),
  ).toEqual({ ok: false, error: "avatar_pixel_limit_exceeded" });
});

test("animated WebP is rejected before normalization", async () => {
  const first = await sharp({
    create: { width: 300, height: 300, channels: 4, background: "red" },
  })
    .png()
    .toBuffer();
  const second = await sharp({
    create: { width: 300, height: 300, channels: 4, background: "blue" },
  })
    .png()
    .toBuffer();
  const animated = await sharp([first, second], { join: { animated: true } })
    .webp({ delay: [100, 100], loop: 0 })
    .toBuffer();

  await expect(
    normalizeProfileAvatarImage({
      bytes: animated,
      declaredMime: "image/webp",
      storedMime: "image/webp",
    }),
  ).resolves.toEqual({ ok: false, error: "animated_avatar_not_allowed" });
});
