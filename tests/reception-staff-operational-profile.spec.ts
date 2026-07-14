import { expect, test, type Page } from "@playwright/test";

async function openStaffProfile(page: Page, staffName = "이수지") {
  const lane = page
    .getByTestId("veterinarian-lane-header")
    .filter({ hasText: staffName });
  const trigger = lane.locator(
    `button[aria-label="${staffName} 수의사 옵션"]`,
  );

  await lane.focus();
  await expect(
    lane.getByTestId("veterinarian-lane-header-actions"),
  ).toHaveCSS("opacity", "1");
  await trigger.click();
  const menu = page.getByRole("menu");
  await expect(menu.getByRole("menuitem")).toHaveCount(2);
  await expect(menu.getByRole("menuitem").allTextContents()).resolves.toEqual([
    "캘린더에서 숨기기",
    "운영 프로필 보기",
  ]);
  await menu.getByRole("menuitem", { name: "운영 프로필 보기" }).click();

  return { lane, trigger };
}

test("veterinarian lane menu shares filter state and protects the final lane", async ({
  page,
}) => {
  await page.goto("/w/clair-demo/reception?modulePanel=open&right=closed");

  const calendar = page.getByTestId("reception-day-calendar");
  const lanes = calendar.getByTestId("veterinarian-lane-header");
  await expect(lanes.first()).toBeVisible();
  const originalLaneCount = await lanes.count();
  expect(originalLaneCount).toBeGreaterThan(1);

  const firstLane = calendar.getByTestId("veterinarian-lane-header").first();
  const firstLaneActions = firstLane.getByTestId(
    "veterinarian-lane-header-actions",
  );
  const firstLaneTrigger = firstLane.locator(
    'button[aria-label="이수지 수의사 옵션"]',
  );
  await expect(firstLaneActions).toHaveCSS("opacity", "0");
  const hiddenStaffName =
    (await firstLane.locator("span").last().textContent()) ?? "";
  await firstLane.hover();
  await expect(firstLaneActions).toHaveCSS("opacity", "1");
  await firstLaneTrigger.click();
  await page.getByRole("menuitem", { name: "캘린더에서 숨기기" }).click();
  await expect(calendar.getByTestId("veterinarian-lane-header")).toHaveCount(
    originalLaneCount - 1,
  );

  await page
    .getByTestId("schedule-toolbar")
    .getByRole("button", { name: /\+\d+|수의사/ })
    .first()
    .click();
  await expect(
    page.getByRole("menuitemcheckbox", { name: hiddenStaffName }),
  ).toHaveAttribute("aria-checked", "false");
  await page.keyboard.press("Escape");

  while ((await calendar.getByTestId("veterinarian-lane-header").count()) > 1) {
    const lane = calendar.getByTestId("veterinarian-lane-header").first();
    await lane.hover();
    await lane.getByRole("button", { name: /수의사 옵션/ }).click();
    await page.getByRole("menuitem", { name: "캘린더에서 숨기기" }).click();
  }

  const finalLane = calendar.getByTestId("veterinarian-lane-header").first();
  await finalLane.hover();
  await finalLane.getByRole("button", { name: /수의사 옵션/ }).click();
  const hideFinalLane = page.getByRole("menuitem", {
    name: "캘린더에서 숨기기",
  });
  await expect(hideFinalLane).toHaveAttribute("aria-disabled", "true");
  await expect(hideFinalLane).toHaveAttribute(
    "aria-describedby",
    /last-veterinarian-lane-description/,
  );
  await expect(
    page.getByText("최소 1명의 수의사를 표시해야 해요"),
  ).toBeAttached();
});

test("staff profile panel is non-modal, detached, and returns focus after keyboard close", async ({
  page,
}) => {
  await page.goto("/w/clair-demo/reception?modulePanel=open&right=closed");
  const { trigger } = await openStaffProfile(page);

  const panel = page.getByRole("region", { name: "직원 운영 프로필" });
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("이수지");
  await expect(panel).toContainText("계정 정보");
  await expect(panel).toContainText("오늘 근무 정보");
  await expect(panel).toContainText("오늘 등록된 근무가 없어요");
  await expect(panel).not.toContainText("선택 날짜 예약");
  await expect(panel.getByRole("tab", { name: "프로필" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(panel.getByRole("tab", { name: "tab2" })).toBeDisabled();
  await expect(panel.getByRole("tab", { name: "tab3" })).toBeDisabled();
  await expect(page.locator('[data-slot="sheet-overlay"]')).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: "직원 운영 프로필" })).toHaveCount(0);

  const contentBox = await page.getByTestId("workspace-main-content").boundingBox();
  const panelBox = await page.getByTestId("workspace-right-panel").boundingBox();
  expect(contentBox).not.toBeNull();
  expect(panelBox).not.toBeNull();
  expect(panelBox!.width).toBeCloseTo(336, 0);
  expect(panelBox!.x - (contentBox!.x + contentBox!.width)).toBeCloseTo(10, 0);
  await expect(page.getByTestId("workspace-right-panel")).toHaveCSS(
    "backdrop-filter",
    "none",
  );
  await expect(page.getByTestId("workspace-main-content")).not.toHaveAttribute(
    "inert",
    "",
  );

  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await expect(trigger).toBeFocused();

  await trigger.click();
  await page.getByRole("menuitem", { name: "운영 프로필 보기" }).click();
  await expect(panel).toBeVisible();
  await panel.getByRole("button", { name: "직원 운영 프로필 닫기" }).click();
  await expect(panel).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("staff profile panel keeps loading, error, retry, and offline states distinct", async ({
  page,
}) => {
  let allowSuccess = false;
  await page.route("**/staff/*/operational-profile?**", async (route) => {
    if (!allowSuccess) {
      await new Promise((resolve) => setTimeout(resolve, 1_000));
      await route.fulfill({
        status: 500,
        json: { ok: false, error: "db_read_failed" },
      });
      return;
    }

    await route.fulfill({
      status: 200,
      json: {
        ok: true,
        profile: {
          displayName: "이수지",
          initials: "SJ",
          jobPositionLabel: "수의사",
          title: "수의사",
          department: "진료",
          membershipStatus: "inactive",
        },
        shift: null,
        enforcedBy: "staff-operational-profile-read",
      },
    });
  });
  await page.goto("/w/clair-demo/reception?modulePanel=open&right=closed");
  await openStaffProfile(page);

  const drawer = page.getByRole("region", { name: "직원 운영 프로필" });
  await expect(
    drawer.getByTestId("staff-operational-profile-loading"),
  ).toBeVisible();
  await expect(drawer.getByRole("alert")).toContainText(
    "운영 프로필을 불러오지 못했어",
  );
  allowSuccess = true;
  await drawer.getByRole("button", { name: "다시 시도" }).click();
  await expect(drawer).toContainText("오프라인");
  await expect(drawer).toContainText("오늘 등록된 근무가 없어요");
});

test("touch viewport keeps the lane action visible and uses a full-width panel", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/w/clair-demo/reception?modulePanel=open&right=closed");

  const lane = page.getByTestId("veterinarian-lane-header").first();
  const actions = lane.getByTestId("veterinarian-lane-header-actions");
  const trigger = lane.getByRole("button", {
    name: "이수지 수의사 옵션",
  });
  await expect(actions).toHaveCSS("opacity", "1");
  await trigger.click();
  await page.getByRole("menuitem", { name: "운영 프로필 보기" }).click();

  const drawer = page.getByRole("region", { name: "직원 운영 프로필" });
  await expect
    .poll(async () => (await drawer.boundingBox())?.x ?? 999)
    .toBeLessThanOrEqual(1);
  const box = await drawer.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeLessThanOrEqual(1);
  expect(box!.width).toBeGreaterThanOrEqual(389);
});

test("staff profile panel labels a non-today shift from the selected date source", async ({
  page,
}) => {
  await page.route("**/staff/*/operational-profile?**", async (route) => {
    await route.fulfill({
      status: 200,
      json: {
        ok: true,
        profile: {
          displayName: "이수지",
          email: "suji@example.test",
          initials: "SJ",
          jobPositionLabel: "수의사",
          department: "진료",
          lastSeenAt: "2026-05-02T00:00:00.000Z",
          membershipStatus: "active",
          phone: "010-0000-0000",
        },
        shift: {
          date: "2026-05-02",
          startMinutes: 540,
          endMinutes: 1080,
          kind: "clinical",
          workLabel: "진료",
          locationLabel: "제2진료실",
        },
        enforcedBy: "staff-operational-profile-read",
      },
    });
  });
  await page.goto(
    "/w/clair-demo/reception?modulePanel=open&right=closed&date=2026-05-02",
  );
  await openStaffProfile(page);

  const drawer = page.getByRole("region", { name: "직원 운영 프로필" });
  await expect(drawer).toContainText("5월 2일 근무 정보");
  await expect(drawer).toContainText("09:00 - 18:00");
  await expect(drawer).toContainText("제2진료실");
  await expect(drawer).toContainText("근무 예정");
  await expect(drawer).not.toContainText("오늘 근무 정보");
  await expect(drawer).toContainText("suji@example.test");
  await expect(drawer).toContainText("010-0000-0000");
  await drawer.getByRole("button", { name: "이메일 복사" }).click();
  await expect(page.getByText("이메일을 복사했어")).toBeVisible();
});
