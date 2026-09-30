import { expect, test } from "@playwright/test";

for (const kind of ["patient", "guardian"] as const) {
  test(`${kind} profile shares loading geometry and distinguishes error from unavailable data`, async ({
    page,
  }) => {
    const workspaceId = "workspace-clair-cheongdam";
    const subjectId = "49121000-0000-4000-8000-000000000999";
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    let attempts = 0;
    await page.route(
      `**/api/workspaces/${workspaceId}/reception/patient-guardian-lookup?**`,
      (route) => route.fulfill({ json: { ok: true, patients: [] } }),
    );
    await page.route(
      `**/api/workspaces/${workspaceId}/customer/${kind}/${subjectId}/profile-overview`,
      async (route) => {
        attempts += 1;
        if (attempts === 1) await pending;
        await route.fulfill({
          status: attempts === 1 ? 500 : kind === "patient" ? 404 : 403,
          json: { ok: false },
        });
      },
    );
    await page.goto(
      `/w/${workspaceId}/customer?modulePanel=open&right=closed&drawer=${kind}:${subjectId}`,
    );
    const panel = page.getByTestId("profile-side-panel");
    await expect(
      panel.locator('[data-slot="emr-profile-loading"]'),
    ).toBeVisible();
    await expect(
      panel.locator('[data-slot="emr-profile-header"] [data-slot="skeleton"]'),
    ).toHaveCount(4);
    await expect(
      panel.getByRole("button", { name: "상세 닫기" }),
    ).toBeEnabled();
    expect((await panel.locator("header").boundingBox())!.height).toBe(150);
    await expect(
      panel.locator('[data-slot="scroll-area-viewport"]'),
    ).toHaveCount(1);
    release();
    await expect(panel.getByRole("alert")).toContainText(
      "프로필 정보를 불러오지 못했습니다",
    );
    await panel.getByRole("button", { name: "다시 시도" }).click();
    await expect(
      panel.getByText(
        kind === "patient"
          ? "프로필 정보를 찾을 수 없습니다."
          : "프로필 정보를 볼 권한이 없습니다.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(panel.getByRole("alert")).toHaveCount(0);
    await expect(
      panel.locator('[data-slot="emr-profile-loading"]'),
    ).toHaveCount(0);
    expect(attempts).toBe(2);
  });
}

for (const moduleId of ["customer", "reception", "treatment"]) {
  test(`${moduleId} uses the same profile enter and exit motion`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto(
      `/w/clair-demo/${moduleId}?modulePanel=open&right=closed&drawer=patient:patient-coco`,
    );
    const panel = page.getByTestId("profile-side-panel");
    const column = page.getByTestId("workspace-right-panel");
    await expect(panel).toBeVisible();
    await expect(column).toHaveCSS("transition-duration", "0.16s");
    await expect(
      panel.getByRole("button", { name: "상세 닫기" }),
    ).toBeFocused();
    await panel.getByRole("button", { name: "상세 닫기" }).click();
    await expect(column).toHaveCSS("transition-duration", "0.12s");
    await expect(panel).toHaveCount(0);
    await expect.poll(async () => (await column.boundingBox())!.width).toBe(0);
  });
}

test("profile motion respects reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(
    "/w/clair-demo/reception?modulePanel=open&right=closed&drawer=patient:patient-coco",
  );
  const panel = page.getByTestId("profile-side-panel");
  const column = page.getByTestId("workspace-right-panel");
  await expect(panel).toBeVisible();
  await expect(column).toHaveCSS("transition-duration", "0s");
  await panel.getByRole("button", { name: "상세 닫기" }).click();
  await expect(column).toHaveCSS("transition-duration", "0s");
  await expect(panel).toHaveCount(0);
});

for (const subject of ["patient:patient-coco", "guardian:guardian-lee-jieun"]) {
  test(`${subject} fits a 360px viewport without clipping the close control`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(`/w/clair-demo/customer?modulePanel=open&right=closed&drawer=${subject}`);
    const panel = page.getByTestId("profile-side-panel");
    await expect(panel).toBeVisible();
    expect((await panel.boundingBox())!.width).toBe(360);
    const close = panel.getByRole("button", { name: "상세 닫기" });
    const box = (await close.boundingBox())!;
    expect(box.x + box.width).toBeLessThanOrEqual(360);
    await close.click();
    await expect(panel).toHaveCount(0);
  });
}

test("guardian address icon has a non-empty clipping region", async ({ page }) => {
  await page.goto(
    "/w/clair-demo/customer?modulePanel=open&right=closed&drawer=guardian:guardian-lee-jieun",
  );
  const icon = page.getByTestId("profile-side-panel").locator('[data-profile-definition-icon="map-pin"]');
  await expect(icon).toBeVisible();
  await expect(icon).toHaveCSS("width", "14px");
  await expect(icon.locator("clipPath rect")).toHaveAttribute("width", "24");
  await expect(icon.locator("clipPath rect")).toHaveAttribute("height", "24");
  const clipBounds = await icon.locator("clipPath rect").evaluate((rect) => {
    const bounds = (rect as SVGGraphicsElement).getBBox();
    return { width: bounds.width, height: bounds.height };
  });
  expect(clipBounds).toEqual({ width: 24, height: 24 });
});
