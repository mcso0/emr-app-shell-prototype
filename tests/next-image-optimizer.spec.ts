import { expect, test } from "@playwright/test";
import sharp from "sharp";

test("Next.js image optimizer converts a local PNG to a bounded WebP", async ({ request }) => {
  const response = await request.get("/_next/image", {
    params: { url: "/pwa-maskable-512.png", w: "64", q: "75" },
    headers: { accept: "image/webp" },
  });

  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("image/webp");
  expect(await sharp(await response.body()).metadata()).toMatchObject({
    format: "webp",
    width: 64,
    height: 64,
  });
});

test("Next.js image optimizer rejects unconfigured remote sources", async ({ request }) => {
  const response = await request.get("/_next/image", {
    params: { url: "https://example.invalid/image.png", w: "64", q: "75" },
  });

  expect(response.status()).toBe(400);
});
