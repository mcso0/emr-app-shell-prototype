import { expect, test, type Page } from "@playwright/test";

async function mockStaffProfileApis(
  page: Page,
  options: { schedule?: boolean; work?: boolean } = {},
) {
  await page.route("**/staff/*/operational-profile?**", async (route) => {
    await route.fulfill({
      status: 200,
      json: {
        ok: true,
        availability: null,
        capabilities: {
          canManageMember: false,
          manageMemberHref: null,
          scheduleHref:
            options.schedule === false
              ? null
              : "/w/clair-demo/hospital-admin?modulePanel=open&section=schedule&staffId=staff-suji&weekStart=2026-04-27",
        },
        profile: {
          displayName: "이수지",
          initials: "SJ",
          jobPositionLabel: "수의사",
          department: "진료",
          membershipStatus: "active",
        },
        shift: null,
        enforcedBy: "staff-operational-profile-read",
      },
    });
  });
  if (options.work === false) return;
  await page.route("**/staff/*/work-items**", async (route) => {
    await route.fulfill({
      status: 200,
      json: {
        ok: true,
        items: [],
        nextCursor: null,
        timezone: "Asia/Seoul",
        enforcedBy: "staff-assigned-work-items-read",
      },
    });
  });
}

async function openStaffProfile(page: Page, staffName = "이수지") {
  const lane = page
    .getByTestId("veterinarian-lane-header")
    .filter({ hasText: staffName });
  const trigger = lane.locator(`button[aria-label="${staffName} 수의사 옵션"]`);

  await lane.focus();
  await expect(lane.getByTestId("veterinarian-lane-header-actions")).toHaveCSS(
    "opacity",
    "1",
  );
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
  await mockStaffProfileApis(page);
  await page.goto("/w/clair-demo/reception?modulePanel=open&right=closed");
  const originalContentWidth = (await page.getByTestId("workspace-main-content").boundingBox())!.width;
  const { trigger } = await openStaffProfile(page);

  const panel = page.getByRole("region", { name: "직원 운영 프로필" });
  await expect(panel).toBeVisible();
  await expect
    .poll(() =>
      panel.evaluate((element) => {
        const styles = getComputedStyle(element);
        return {
          overflowX: styles.overflowX,
          overscrollBehaviorX: styles.overscrollBehaviorX,
          touchAction: styles.touchAction,
        };
      }),
    )
    .toEqual({
      overflowX: "hidden",
      overscrollBehaviorX: "none",
      touchAction: "pan-y",
    });
  for (const tabName of ["프로필", "업무현황", "일정"]) {
    await panel.getByRole("tab", { name: tabName, exact: true }).click();
    const activeTabPanel = panel.locator('[data-slot="tabs-content"]:visible');
    await expect(activeTabPanel).toHaveCount(1);
    await expect
      .poll(() =>
        activeTabPanel.evaluate((element) => {
          const styles = getComputedStyle(element);
          return {
            overflowX: styles.overflowX,
            overscrollBehaviorX: styles.overscrollBehaviorX,
            scrollLeft: element.scrollLeft,
            touchAction: styles.touchAction,
          };
        }),
      )
      .toEqual({
        overflowX: "hidden",
        overscrollBehaviorX: "none",
        scrollLeft: 0,
        touchAction: "pan-y",
      });
    await activeTabPanel.hover();
    await page.mouse.wheel(120, 0);
    await expect
      .poll(() => activeTabPanel.evaluate((element) => element.scrollLeft))
      .toBe(0);
  }
  await panel.getByRole("tab", { name: "프로필", exact: true }).click();
  await expect(panel).toContainText("이수지");
  await expect(panel).toContainText("계정 정보");
  await expect(panel).toContainText("오늘 근무 정보");
  await expect(panel).toContainText("오늘 게시된 근무가 없어요");
  await expect(panel).not.toContainText("09:30 - 10:00");
  await expect(panel).not.toContainText("예약 진료");
  await expect(panel).not.toContainText("콩이 · 김하늘 외 1건");
  await expect(panel).not.toContainText("선택 날짜 예약");
  await expect(panel.getByRole("tab", { name: "프로필" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(panel.getByRole("tab")).toHaveCount(3);
  await expect(panel.getByRole("tab", { name: "업무현황" })).toBeEnabled();
  await expect(panel.getByRole("tab", { name: "일정" })).toBeEnabled();
  await expect(page.locator('[data-slot="sheet-overlay"]')).toHaveCount(0);
  await expect(
    page.getByRole("dialog", { name: "직원 운영 프로필" }),
  ).toBeVisible();

  const contentBox = await page
    .getByTestId("workspace-main-content")
    .boundingBox();
  const panelBox = await page
    .getByTestId("workspace-profile-drawer")
    .boundingBox();
  expect(contentBox).not.toBeNull();
  expect(panelBox).not.toBeNull();
  expect(panelBox!.width).toBeCloseTo(380, 0);
  expect(contentBox!.width).toBeCloseTo(originalContentWidth, 0);
  const frameBox = (await page.locator("main.emr-workspace-frame-responsive").boundingBox())!;
  expect(panelBox!.x + panelBox!.width).toBeCloseTo(frameBox.x + frameBox.width - 1, 0);
  await expect(page.getByTestId("workspace-profile-drawer")).toHaveCSS(
    "backdrop-filter",
    "none",
  );
  await expect(page.getByTestId("workspace-main-content")).not.toHaveAttribute(
    "inert",
    "",
  );
  expect((await panel.locator("header").boundingBox())?.height).toBeCloseTo(
    150,
    0,
  );
  expect(
    (await panel.locator("[data-slot='avatar']").boundingBox())?.width,
  ).toBeCloseTo(84, 0);

  const tabListBox = await panel.getByRole("tablist").boundingBox();
  const profileTabBox = await panel
    .getByRole("tab", { name: "프로필" })
    .boundingBox();
  const workTabBox = await panel
    .getByRole("tab", { name: "업무현황" })
    .boundingBox();
  const scheduleTabBox = await panel
    .getByRole("tab", { name: "일정" })
    .boundingBox();
  expect(tabListBox?.width).toBeCloseTo(175, 0);
  expect(profileTabBox?.width).toBeCloseTo(53, 0);
  expect(workTabBox?.width).toBeCloseTo(65, 0);
  expect(scheduleTabBox?.width).toBeCloseTo(41, 0);
  expect(
    (await panel.getByRole("heading", { name: "오늘 근무 정보" }).boundingBox())
      ?.x,
  ).toBeCloseTo(
    (
      await panel
        .getByRole("heading", { name: "다가오는 일정" })
        .boundingBox()
    )?.x ?? 0,
    0,
  );

  await panel.getByRole("tab", { name: "일정" }).click();
  await expect(
    panel.getByRole("heading", { name: "일정", exact: true }),
  ).toBeVisible();
  await expect(
    panel.getByText("근무 일정은 일정 화면에서 확인할 수 있어요"),
  ).toBeVisible();
  await expect(panel.getByRole("button", { name: "일정 확인" })).toBeVisible();

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

test("non-veterinarian appointment assignees receive the same profile workload", async ({
  page,
}) => {
  await page.route("**/staff/*/operational-profile?**", async (route) => {
    const isTechnician = route.request().url().includes("user-tech-hayun");
    await route.fulfill({
      status: 200,
      json: {
        ok: true,
        availability: null,
        capabilities: {
          canManageMember: false,
          manageMemberHref: null,
          scheduleHref: null,
        },
        profile: {
          displayName: isTechnician ? "송하윤" : "이수지",
          initials: isTechnician ? "HY" : "SJ",
          jobPositionLabel: isTechnician ? "테크니션" : "수의사",
          membershipStatus: "active",
        },
        shift: null,
        enforcedBy: "staff-operational-profile-read",
      },
    });
  });
  await page.route("**/staff/*/work-items**", async (route) => {
    await route.fulfill({
      status: 200,
      json: {
        ok: true,
        items: [],
        nextCursor: null,
        timezone: "Asia/Seoul",
        enforcedBy: "staff-assigned-work-items-read",
      },
    });
  });

  await page.goto("/w/clair-demo/reception?modulePanel=open&right=closed");
  await page.getByRole("button", { name: "더보기" }).click();
  await page
    .getByRole("menuitem", { name: "송하윤 · 테크니션" })
    .click();

  const panel = page.getByRole("region", { name: "직원 운영 프로필" });
  await expect(panel).toContainText("송하윤");
  await expect(panel).toContainText("오늘 게시된 근무가 없어요");
  await expect(panel).not.toContainText("09:42 - 10:12");
  await expect(panel).not.toContainText("현장 접수");

  await panel.getByRole("tab", { name: "업무현황" }).click();
  await expect(panel).toContainText("접수/예약");
  await expect(panel).toContainText("예약 진료");
  await expect(panel).toContainText("현장 접수");
});

test("walk-in reception assigned to a staff member appears in profile and workload", async ({
  page,
}) => {
  await mockStaffProfileApis(page);
  await page.goto("/w/clair-demo/reception?modulePanel=open&right=closed");
  await openStaffProfile(page, "김도윤");

  const panel = page.getByRole("region", { name: "직원 운영 프로필" });
  await expect(panel).toContainText("오늘 게시된 근무가 없어요");
  await expect(panel).not.toContainText("09:42 - 10:12");
  await expect(panel).not.toContainText("현장 접수");

  await panel.getByRole("tab", { name: "업무현황" }).click();
  await expect(panel).toContainText("접수/예약");
  await expect(panel).toContainText("현장 접수");
});

test("staff work tab keeps server order, merges cursor pages by hospital date, and confirms permitted navigation", async ({
  page,
}) => {
  await mockStaffProfileApis(page, { work: false });
  let pageCount = 0;
  await page.route("**/staff/*/work-items**", async (route) => {
    pageCount += 1;
    await route.fulfill({
      status: 200,
      json:
        pageCount === 1
          ? {
              ok: true,
              items: [
                {
                  category: "lab",
                  categoryLabel: "임상병리",
                  description: "혈구 검사",
                  guardianName: "합성 보호자",
                  href: "/w/clair-demo/lab?encounterId=encounter-1&orderId=order-1&modulePanel=open",
                  id: "work-newest",
                  operatingDate: "2026-05-01",
                  orderId: "order-1",
                  patientName: "합성 환자",
                  queueType: "lab",
                  requestedAt: "2026-05-01T09:00:00.000Z",
                  requestedByName: "합성 요청자",
                  status: "requested",
                  statusLabel: "요청",
                  title: "합성 CBC",
                },
                {
                  category: "procedure",
                  categoryLabel: "처치",
                  href: null,
                  id: "work-second",
                  operatingDate: "2026-05-01",
                  orderId: "order-2",
                  queueType: "treatment",
                  requestedAt: "2026-05-01T08:00:00.000Z",
                  status: "in_progress",
                  statusLabel: "진행 중",
                  title: "합성 처치",
                },
              ],
              nextCursor: "opaque-next",
              timezone: "Asia/Seoul",
            }
          : {
              ok: true,
              items: [
                {
                  category: "imaging",
                  categoryLabel: "영상검사",
                  href: null,
                  id: "work-older",
                  operatingDate: "2026-05-01",
                  orderId: "order-3",
                  queueType: "imaging",
                  requestedAt: "2026-05-01T07:00:00.000Z",
                  status: "completed",
                  statusLabel: "완료",
                  title: "합성 X-ray",
                },
              ],
              nextCursor: null,
              timezone: "Asia/Seoul",
            },
    });
  });
  await page.goto("/w/clair-demo/reception?modulePanel=open&right=closed");
  await openStaffProfile(page);
  const panel = page.getByRole("region", { name: "직원 운영 프로필" });
  await panel.getByRole("tab", { name: "업무현황" }).click();

  const cards = panel.locator("[data-work-item-id]");
  await expect(cards).toHaveCount(4);
  await expect(cards.nth(0)).toContainText("콩이 · 김하늘");
  await expect(cards.nth(1)).toContainText("코코 · 이지은");
  await expect(cards.nth(2)).toContainText("합성 CBC");
  await expect(cards.nth(3)).toContainText("합성 처치");
  await expect(cards.nth(0)).toContainText("접수/예약");
  await expect(panel.getByText("오늘", { exact: true })).toHaveCount(1);
  await panel.getByRole("button", { name: "이전 업무 더보기" }).click();
  await expect(cards).toHaveCount(5);
  await expect(cards.nth(4)).toContainText("합성 X-ray");
  await expect(panel.getByText("오늘", { exact: true })).toHaveCount(1);

  await panel.getByRole("button", { name: "합성 CBC 더보기" }).click();
  await page.getByRole("menuitem", { name: "업무 보러가기" }).click();
  const dialog = page.getByRole("dialog", {
    name: "업무 화면으로 이동할까요?",
  });
  await expect(dialog).toContainText("합성 환자 · 합성 보호자 · 합성 CBC");
  await dialog.getByRole("button", { name: "이동" }).click();
  await expect(page).toHaveURL(
    /\/w\/clair-demo\/lab\?encounterId=encounter-1&orderId=order-1&modulePanel=open/,
  );
});

test("schedule tab keeps a missing authorized destination neutral", async ({ page }) => {
  await mockStaffProfileApis(page, { schedule: false });
  await page.goto("/w/clair-demo/reception?modulePanel=open&right=closed");
  await openStaffProfile(page);

  const panel = page.getByRole("region", { name: "직원 운영 프로필" });
  await panel.getByRole("tab", { name: "일정" }).click();
  await expect(panel.getByText("표시할 일정이 없어요")).toBeVisible();
  await expect(panel.getByRole("button", { name: "일정 확인" })).toHaveCount(0);
});

test("switching staff remounts the panel and never reuses the previous staff work state", async ({
  page,
}) => {
  await page.route("**/staff/*/operational-profile?**", async (route) => {
    const isDoyun = route.request().url().includes("user-vet-doyun");
    await route.fulfill({
      status: 200,
      json: {
        ok: true,
        availability: null,
        capabilities: {
          canManageMember: false,
          manageMemberHref: null,
          scheduleHref: null,
        },
        profile: {
          displayName: isDoyun ? "김도윤" : "이수지",
          initials: isDoyun ? "DY" : "SJ",
          jobPositionLabel: "수의사",
          membershipStatus: "active",
        },
        shift: null,
        enforcedBy: "staff-operational-profile-read",
      },
    });
  });
  await page.route("**/staff/*/work-items**", async (route) => {
    const isDoyun = route.request().url().includes("user-vet-doyun");
    await route.fulfill({
      status: 200,
      json: {
        ok: true,
        items: [
          {
            category: "lab",
            categoryLabel: "임상병리",
            href: null,
            id: isDoyun ? "work-doyun" : "work-suji",
            operatingDate: "2026-05-01",
            orderId: isDoyun ? "order-doyun" : "order-suji",
            queueType: "lab",
            requestedAt: "2026-05-01T09:00:00.000Z",
            status: "requested",
            statusLabel: "요청",
            title: isDoyun ? "김도윤 업무" : "이수지 업무",
          },
        ],
        nextCursor: null,
        timezone: "Asia/Seoul",
        enforcedBy: "staff-assigned-work-items-read",
      },
    });
  });

  await page.goto("/w/clair-demo/reception?modulePanel=open&right=closed");
  await openStaffProfile(page, "이수지");
  const panel = page.getByRole("region", { name: "직원 운영 프로필" });
  await panel.getByRole("tab", { name: "업무현황" }).click();
  await expect(panel).toContainText("이수지 업무");

  await openStaffProfile(page, "김도윤");
  await expect(panel.getByRole("tab", { name: "프로필" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(panel).toContainText("김도윤");
  await expect(panel).not.toContainText("이수지 업무");
  await panel.getByRole("tab", { name: "업무현황" }).click();
  await expect(panel).toContainText("김도윤 업무");
  await expect(panel).not.toContainText("이수지 업무");
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
        availability: null,
        capabilities: {
          canManageMember: false,
          manageMemberHref: null,
          scheduleHref: null,
        },
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
    "운영 프로필을 불러오지 못했어요",
  );
  allowSuccess = true;
  await drawer.getByRole("button", { name: "다시 시도" }).click();
  await expect(drawer).toContainText("상태 확인 중");
  await expect(drawer).toContainText("오늘 게시된 근무가 없어요");
  await expect(drawer).not.toContainText("예약 진료");
});

test("touch viewport keeps the lane action visible and fits the profile within the workspace body", async ({
  page,
}) => {
  await mockStaffProfileApis(page);
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

  const drawer = page.getByTestId("workspace-profile-drawer");
  await expect.poll(async () => {
    const frame = await page.locator("main.emr-workspace-frame-responsive").boundingBox();
    const box = await drawer.boundingBox();
    if (!frame || !box) return Infinity;
    return Math.max(
      Math.abs(box.x - frame.x - 1),
      Math.abs(box.y - frame.y - 1),
      Math.abs(box.width - Math.min(380, frame.width - 2)),
      Math.abs(box.height - frame.height + 2),
    );
  }).toBeLessThanOrEqual(1);
});

test("staff profile reflows at a 200 percent zoom equivalent without hiding long content or self actions", async ({
  page,
}) => {
  await page.route("**/staff/*/operational-profile?**", async (route) => {
    await route.fulfill({
      status: 200,
      json: {
        ok: true,
        availability: null,
        capabilities: {
          canEditAvatar: true,
          canEditStatusMessage: true,
          canManageMember: false,
          manageMemberHref: null,
          scheduleHref: null,
        },
        profile: {
          displayName: "이수지 아주 긴 이름이 표시되는 접근성 확대 검증용 직원",
          email: "staff-profile-v2-accessibility-long-address@example.test",
          initials: "이수",
          jobPositionLabel: "수의사",
          department: "진료 및 중환자 입원 환자 관리 지원 부서",
          membershipStatus: "active",
          phone: "010-1234-5678",
          statusMessage:
            "수술 중이며 종료 후 순서대로 연락드릴 예정입니다. 긴 상태 메시지 표시를 확인합니다.",
          statusMessageUpdatedAt: "2026-07-16T01:00:00.000Z",
        },
        shift: null,
        enforcedBy: "staff-operational-profile-read",
      },
    });
  });
  await page.setViewportSize({ width: 640, height: 450 });
  await page.goto("/w/clair-demo/reception?modulePanel=open&right=closed");
  await openStaffProfile(page);

  const panel = page.getByRole("region", { name: "직원 운영 프로필" });
  await expect.poll(async () => {
    const box = await panel.boundingBox();
    return box ? box.x + box.width : Infinity;
  }).toBeLessThanOrEqual(640);
  const panelBox = await panel.boundingBox();
  expect(panelBox).not.toBeNull();
  expect(panelBox!.x).toBeGreaterThanOrEqual(0);
  expect(panelBox!.x + panelBox!.width).toBeLessThanOrEqual(640);
  await expect(panel.getByRole("tab")).toHaveCount(3);
  await expect(panel.getByRole("tab", { name: "프로필" })).toBeVisible();
  await expect(panel.getByRole("tab", { name: "업무현황" })).toBeVisible();
  await expect(panel.getByRole("tab", { name: "일정" })).toBeVisible();
  await expect(panel.getByText(/이수지 아주 긴 이름/)).toBeVisible();
  await expect(panel.getByText(/수술 중이며 종료 후/)).toBeVisible();
  await expect(
    panel.getByRole("button", { name: "상태 메시지 수정" }),
  ).toBeVisible();

  const avatarMenuTrigger = panel.getByRole("button", {
    name: "프로필 이미지 메뉴 열기",
  });
  await avatarMenuTrigger.focus();
  await expect(avatarMenuTrigger).toBeFocused();
  await avatarMenuTrigger.press("Enter");
  await expect(page.getByRole("menuitem")).toHaveCount(2);
  await expect(
    page.getByRole("menuitem", { name: "프로필 이미지 업로드" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");

  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
});

test("staff profile panel renders account, published shift, availability, and permission-filtered header menu", async ({
  page,
}) => {
  await page.route("**/staff/*/operational-profile?**", async (route) => {
    await route.fulfill({
      status: 200,
      json: {
        ok: true,
        availability: {
          event: { date: "2026-05-04", kind: "off" },
          returnShift: {
            date: "2026-05-05",
            startMinutes: 600,
            endMinutes: 1080,
            kind: "clinical",
            workLabel: "진료",
            locationLabel: "제2진료실",
          },
        },
        capabilities: {
          canManageMember: false,
          manageMemberHref: null,
          scheduleHref:
            "/w/clair-demo/hospital-admin?modulePanel=open&section=schedule&staffId=staff-suji&weekStart=2026-04-27",
        },
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
        currentWork: {
          date: "2026-05-02",
          state: "in_consultation",
          startMinutes: 540,
          endMinutes: 1080,
          detailLabel: "1진료실",
          source: "encounter",
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
  await expect(drawer).toContainText("오늘 근무 정보");
  await expect(drawer).toContainText("09:00 - 18:00");
  await expect(drawer).toContainText("진료중");
  await expect(drawer).toContainText("1진료실");
  await expect(drawer).not.toContainText("제2진료실");
  await expect(drawer).toContainText("휴무");
  await expect(drawer).toContainText("5월 5일 10:00 복귀");
  await expect(drawer).toContainText("suji@example.test");
  await expect(drawer).toContainText("010-0000-0000");
  const emailCopy = drawer.getByRole("button", { name: "이메일 복사" });
  const phoneCopy = drawer.getByRole("button", { name: "전화번호 복사" });
  await expect(emailCopy).toHaveCSS("opacity", "1");
  await emailCopy.click();
  await expect(page.getByText("이메일을 복사했어요")).toBeVisible();
  await expect(phoneCopy).toHaveCSS("opacity", "1");
  await drawer.getByRole("button", { name: "프로필 작업 더보기" }).click();
  await expect(page.getByRole("menuitem")).toHaveCount(2);
  await expect(page.getByRole("menuitem").allTextContents()).resolves.toEqual([
    "전체 근무표 보기",
    "연락처 복사",
  ]);
  await expect(
    page.getByRole("menuitem", { name: "멤버 관리에서 보기" }),
  ).toHaveCount(0);
});

test("today work card renders schedule, clock-out, leave, and closure states without reception details", async ({
  page,
}) => {
  let currentWork = {
    date: "2026-07-20",
    state: "working",
    startMinutes: 540,
    endMinutes: 1140,
    detailLabel: null as string | null,
    source: "schedule",
  };
  await page.route("**/staff/*/operational-profile?**", async (route) => {
    await route.fulfill({
      status: 200,
      json: {
        ok: true,
        availability: null,
        capabilities: {
          canManageMember: false,
          manageMemberHref: null,
          scheduleHref: null,
        },
        currentWork,
        profile: {
          displayName: "이수지",
          initials: "SJ",
          jobPositionLabel: "수의사",
          membershipStatus: "active",
        },
        shift: null,
      },
    });
  });
  await page.route("**/staff/*/work-items**", async (route) => {
    await route.fulfill({
      status: 200,
      json: {
        ok: true,
        items: [],
        nextCursor: null,
        timezone: "Asia/Seoul",
      },
    });
  });

  const scenarios = [
    { state: "working", label: "근무중", detail: null },
    { state: "scheduled", label: "근무 예정", detail: null },
    { state: "clocked_out", label: "퇴근", detail: null },
    { state: "shift_ended", label: "업무 종료", detail: null },
    { state: "off", label: "휴무일", detail: "개인 일정" },
    { state: "leave", label: "연차", detail: "7월 20일" },
    { state: "same_day_leave", label: "당일 연차", detail: "7월 20일" },
    { state: "hospital_closed", label: "병원 휴무일", detail: "7월 20일" },
  ];

  await page.goto("/w/clair-demo/reception?modulePanel=open&right=closed");
  for (const [index, scenario] of scenarios.entries()) {
    currentWork = { ...currentWork, state: scenario.state };
    await openStaffProfile(page);
    const drawer = page.getByRole("region", { name: "직원 운영 프로필" });
    await expect(drawer).toContainText(scenario.label);
    if (scenario.detail) await expect(drawer).toContainText(scenario.detail);
    await expect(drawer).not.toContainText("초코");
    await expect(drawer).not.toContainText("예약 진료");
    if (index < scenarios.length - 1) {
      await drawer.getByRole("button", { name: "직원 운영 프로필 닫기" }).click();
    }
  }
});

test("self status message saves optimistically, rolls back, retries, cancels, and saves on blur", async ({
  page,
}) => {
  await page.route("**/staff/*/operational-profile?**", async (route) => {
    await route.fulfill({
      status: 200,
      json: {
        ok: true,
        availability: null,
        capabilities: {
          canEditStatusMessage: true,
          canManageMember: false,
          manageMemberHref: null,
          scheduleHref: null,
        },
        profile: {
          displayName: "이수지",
          initials: "SJ",
          jobPositionLabel: "수의사",
          membershipStatus: "active",
          statusMessage: "진료 중입니다",
          statusMessageUpdatedAt: "2026-07-16T01:00:00.000Z",
        },
        shift: null,
        enforcedBy: "staff-operational-profile-read",
      },
    });
  });
  const requests: Array<Record<string, unknown>> = [];
  await page.route("**/members/me/status-message", async (route) => {
    const payload = route.request().postDataJSON() as Record<string, unknown>;
    requests.push(payload);
    if (requests.length === 1) {
      await route.fulfill({
        status: 500,
        json: { ok: false, error: "db_write_failed" },
      });
      return;
    }
    await route.fulfill({
      status: 200,
      json: {
        ok: true,
        message: payload.message,
        updatedAt:
          requests.length === 2
            ? "2026-07-16T01:01:00.000Z"
            : "2026-07-16T01:02:00.000Z",
        enforcedBy: "workspace-status-message-self-write",
      },
    });
  });

  await page.goto("/w/clair-demo/reception?modulePanel=open&right=closed");
  await openStaffProfile(page);
  const panel = page.getByRole("region", { name: "직원 운영 프로필" });
  await expect(panel).toContainText("진료 중입니다");

  await panel.getByRole("button", { name: "상태 메시지 수정" }).click();
  const input = panel.getByRole("textbox", { name: "상태 메시지" });
  await input.fill("  곧 복귀합니다  ");
  await input.press("Enter");
  await expect(panel.getByRole("alert")).toContainText("저장하지 못했어요");
  await expect(panel).toContainText("진료 중입니다");
  await panel.getByRole("button", { name: "다시 시도" }).click();
  await expect(panel).toContainText("곧 복귀합니다");
  await expect(panel.getByRole("alert")).toHaveCount(0);

  await panel.getByRole("button", { name: "상태 메시지 수정" }).click();
  await panel.getByRole("textbox", { name: "상태 메시지" }).fill("취소할 문구");
  await panel.getByRole("textbox", { name: "상태 메시지" }).press("Escape");
  await expect(panel).toContainText("곧 복귀합니다");
  expect(requests).toHaveLength(2);

  await panel.getByRole("button", { name: "상태 메시지 수정" }).click();
  await panel.getByRole("textbox", { name: "상태 메시지" }).fill("회의 중");
  await panel
    .getByRole("textbox", { name: "상태 메시지" })
    .evaluate((element) => (element as HTMLInputElement).blur());
  await expect(panel).toContainText("회의 중");
  expect(requests).toEqual([
    {
      expectedUpdatedAt: "2026-07-16T01:00:00.000Z",
      message: "곧 복귀합니다",
    },
    {
      expectedUpdatedAt: "2026-07-16T01:00:00.000Z",
      message: "곧 복귀합니다",
    },
    {
      expectedUpdatedAt: "2026-07-16T01:01:00.000Z",
      message: "회의 중",
    },
  ]);
});
