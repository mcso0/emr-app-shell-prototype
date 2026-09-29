import { expect, test, type Page } from "@playwright/test";

async function expectBodyAlignedProfile(page: Page) {
  await expect.poll(async () => {
    const frame = await page.locator("main.emr-workspace-frame-responsive").boundingBox();
    const drawer = await page.getByTestId("workspace-profile-drawer").boundingBox();
    if (!frame || !drawer) return Infinity;
    return Math.max(
      Math.abs(drawer.y - frame.y),
      Math.abs(drawer.y + drawer.height - frame.y - frame.height),
      Math.abs(drawer.x + drawer.width - frame.x - frame.width),
      Math.abs(drawer.width - Math.min(380, frame.width)),
    );
  }).toBeLessThanOrEqual(1);
}

for (const moduleId of ["home", "reception", "treatment", "lab", "imaging", "dispensing", "orders", "billing", "inpatient", "customer"]) {
  for (const profile of ["patient:patient-coco", "guardian:guardian-lee-jieun"]) {
    test(`${moduleId} aligns ${profile.split(":")[0]} profile with its workspace body`, async ({ page }) => {
      await page.goto(`/w/clair-demo/${moduleId}?modulePanel=open&aside=closed&profile=${encodeURIComponent(profile)}`);
      await expectBodyAlignedProfile(page);
    });
  }
}

test("open profile follows workspace resizing without changing content width", async ({ page }) => {
  await page.goto("/w/clair-demo/customer?modulePanel=open");
  const width = (await page.getByTestId("workspace-main-content").boundingBox())!.width;
  await page.getByTestId("customer-patient-row-patient-dubu").click();
  await expectBodyAlignedProfile(page);
  expect((await page.getByTestId("workspace-main-content").boundingBox())!.width).toBeCloseTo(width, 0);
  await page.getByRole("button", { name: "사이드 패널 접기", exact: true }).click();
  await expectBodyAlignedProfile(page);
  await page.getByRole("button", { name: "사이드 패널 펼치기", exact: true }).click();
  await expectBodyAlignedProfile(page);
  for (const size of [{ width: 1280, height: 900 }, { width: 1000, height: 800 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(size);
    await expectBodyAlignedProfile(page);
  }
});

async function openStaffProfile(page: Page) {
  await page.route("**/staff/*/operational-profile?**", (route) =>
    route.fulfill({
      status: 200,
      json: {
        ok: true,
        availability: null,
        currentWork: null,
        capabilities: { canManageMember: false, manageMemberHref: null, scheduleHref: null },
        profile: { displayName: "이수지", initials: "SJ", jobPositionLabel: "수의사", department: "진료", membershipStatus: "active" },
      },
    }),
  );
  const lane = page.getByTestId("veterinarian-lane-header").filter({ hasText: "이수지" });
  const opener = lane.getByRole("button", { name: "이수지 수의사 옵션" });
  await lane.focus();
  await opener.click();
  await page.getByRole("menuitem", { name: "운영 프로필 보기" }).click();
  await expect(page.getByRole("region", { name: "직원 운영 프로필" })).toBeVisible();
  return opener;
}

test("profile drawer preserves the mounted reservation draft and right-panel selection", async ({ page }) => {
  await page.goto("/w/clair-demo/reception?modulePanel=open&right=open&drawer=reception-reservation-form%3Anew");
  const reservation = page.getByTestId("reservation-create-drawer");
  const memo = reservation.getByRole("textbox", { name: "예약 메모" });
  await memo.fill("프로필 확인 후에도 유지할 예약 초안");
  await reservation.evaluate((element) => element.setAttribute("data-mount-probe", "original"));
  const main = page.getByTestId("workspace-main-content");
  const originalWidth = (await main.boundingBox())!.width;
  const opener = await openStaffProfile(page);

  await expectBodyAlignedProfile(page);

  await expect(reservation).toBeAttached();
  await expect(reservation).toHaveAttribute("data-mount-probe", "original");
  await expect(memo).toHaveValue("프로필 확인 후에도 유지할 예약 초안");
  await expect(page.getByTestId("workspace-profile-drawer")).toBeVisible();
  await expect.poll(async () => (await main.boundingBox())!.width).toBeCloseTo(originalWidth, 0);
  await expect.poll(() => new URL(page.url()).searchParams.get("drawer")).toBe("reception-reservation-form:new");
  await expect(page.getByTestId("workspace-drawer")).toHaveCount(0);
  await page.getByRole("button", { name: "직원 운영 프로필 닫기" }).click();

  await expect(page.getByTestId("workspace-profile-drawer")).toHaveCount(0);
  await expect(memo).toHaveValue("프로필 확인 후에도 유지할 예약 초안");
  await expect(page.getByTestId("reception-right-panel")).toContainText("예약 생성");
  await expect(opener).toBeFocused();
});

test("profile URL coexists with reception detail and closing removes only the profile", async ({ page }) => {
  await page.goto("/w/clair-demo/reception?modulePanel=open&right=open&date=2026-05-01&drawer=reception-encounter%3Aencounter-haru-260430&profile=patient%3Apatient-coco");
  const profile = page.getByTestId("profile-side-panel");
  const detail = page.getByTestId("reception-right-panel");
  await expect(profile).toHaveAttribute("data-profile-kind", "patient");
  await expect(detail).toContainText("접수 상세");
  await profile.getByRole("button", { name: "상세 닫기" }).click();
  await expect(profile).toHaveCount(0);
  await expect(detail).toContainText("접수 상세");
  await expect.poll(() => new URL(page.url()).searchParams.has("profile")).toBe(false);
  const params = new URL(page.url()).searchParams;
  expect(params.get("drawer")).toBe("reception-encounter:encounter-haru-260430");
  expect(params.get("right")).toBe("open");
  expect(params.get("date")).toBe("2026-05-01");
});

test("legacy profile links become non-modal overlay drawers without reserving layout space", async ({ page }) => {
  await page.goto("/w/clair-demo/customer?modulePanel=open");
  const main = page.getByTestId("workspace-main-content");
  const originalWidth = (await main.boundingBox())!.width;
  await page.goto("/w/clair-demo/customer?modulePanel=open&drawer=reception-patient%3Apatient-coco");
  const profile = page.getByTestId("profile-side-panel");
  await expect(profile).toHaveAttribute("data-profile-kind", "patient");
  await expect(page.getByTestId("workspace-profile-drawer")).toBeVisible();
  await expect.poll(async () => (await main.boundingBox())!.width).toBeCloseTo(originalWidth, 0);
  await expect(page.locator('[data-slot="sheet-overlay"]')).toHaveCount(0);
  await expect(main).not.toHaveAttribute("inert", "");
  await expect.poll(() => new URL(page.url()).searchParams.get("profile")).toBe("patient:patient-coco");
  await expect.poll(() => new URL(page.url()).searchParams.has("drawer")).toBe(false);
  await main.click({ position: { x: 8, y: 8 } });
  await expect(profile).toBeVisible();
  await profile.getByRole("button", { name: "접수/예약" }).click();
  await expect(page.getByRole("menuitem", { name: "접수하기" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menuitem", { name: "접수하기" })).toHaveCount(0);
  await expect(profile).toBeVisible();
  await profile.getByRole("button", { name: "이지은" }).click();
  await expect(profile).toHaveAttribute("data-profile-kind", "guardian");
  await expect.poll(() => new URL(page.url()).searchParams.get("profile")).toBe("guardian:guardian-lee-jieun");
  await page.keyboard.press("Escape");
  await expect(profile).toHaveCount(0);
});

test("narrow profile drawer stays within the workspace body while reception detail stays a side panel", async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 800 });
  await page.goto("/w/clair-demo/reception?modulePanel=open&right=open&drawer=reception-encounter%3Aencounter-haru-260430&profile=patient%3Apatient-coco");
  const overlay = page.getByTestId("workspace-profile-drawer");
  const detail = page.getByTestId("reception-right-panel");
  await expect(overlay).toBeVisible();
  await expectBodyAlignedProfile(page);
  await expect(detail).toBeAttached();
  await page.getByTestId("profile-side-panel").getByRole("button", { name: "상세 닫기" }).click();
  await expect(overlay).toHaveCount(0);
  await expect(detail).toBeVisible();
  await expect(page.getByTestId("workspace-drawer")).toHaveCount(0);
});

test("reception detail outside reception remains a closable side panel", async ({ page }) => {
  await page.goto("/w/clair-demo/treatment?modulePanel=open&aside=closed&drawer=reception-encounter%3Aencounter-haru-260430");
  const detail = page.getByTestId("reception-right-panel");
  await expect(detail).toContainText("접수 상세");
  await expect(page.getByTestId("workspace-drawer")).toHaveCount(0);
  await detail.getByRole("button", { name: "우측 사이드 패널 닫기" }).click();
  await expect(detail).toHaveCount(0);
  await expect.poll(() => new URL(page.url()).searchParams.has("drawer")).toBe(false);
});

test("customer row opens the profile and Escape restores row focus", async ({ page }) => {
  await page.goto("/w/clair-demo/customer?modulePanel=open");
  const row = page.getByTestId("customer-patient-row-patient-dubu");
  await row.click();
  await expect(page.getByTestId("workspace-profile-drawer")).toBeVisible();
  await expect.poll(() => new URL(page.url()).searchParams.get("profile")).toBe("patient:patient-dubu");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("workspace-profile-drawer")).toHaveCount(0);
  await expect(row).toBeFocused();
  await row.press("Enter");
  await expect(page.getByTestId("workspace-profile-drawer")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(row).toBeFocused();
});
