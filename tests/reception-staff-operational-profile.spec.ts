import { expect, test, type Page } from "@playwright/test";

async function mockStaffProfileApis(
  page: Page,
  options: { work?: boolean } = {},
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
            "/w/clair-demo/hospital-admin?modulePanel=open&section=schedule&staffId=staff-suji&weekStart=2026-04-27",
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
  const { trigger } = await openStaffProfile(page);

  const panel = page.getByRole("region", { name: "직원 운영 프로필" });
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("이수지");
  await expect(panel).toContainText("계정 정보");
  await expect(panel).toContainText("오늘 근무 정보");
  await expect(panel).toContainText("오늘 게시된 근무가 없어요");
  await expect(panel).not.toContainText("선택 날짜 예약");
  await expect(panel.getByRole("tab", { name: "프로필" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(panel.getByRole("tab")).toHaveCount(2);
  await expect(panel.getByRole("tab", { name: "업무 현황" })).toBeEnabled();
  await expect(page.locator('[data-slot="sheet-overlay"]')).toHaveCount(0);
  await expect(
    page.getByRole("dialog", { name: "직원 운영 프로필" }),
  ).toHaveCount(0);

  const contentBox = await page
    .getByTestId("workspace-main-content")
    .boundingBox();
  const panelBox = await page
    .getByTestId("workspace-right-panel")
    .boundingBox();
  expect(contentBox).not.toBeNull();
  expect(panelBox).not.toBeNull();
  expect(panelBox!.width).toBeCloseTo(380, 0);
  expect(panelBox!.x - (contentBox!.x + contentBox!.width)).toBeCloseTo(10, 0);
  await expect(page.getByTestId("workspace-right-panel")).toHaveCSS(
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
  await panel.getByRole("tab", { name: "업무 현황" }).click();

  const cards = panel.locator("[data-work-item-id]");
  await expect(cards).toHaveCount(2);
  await expect(cards.nth(0)).toContainText("합성 CBC");
  await expect(cards.nth(1)).toContainText("합성 처치");
  await expect(panel.getByText("오늘", { exact: true })).toHaveCount(1);
  await panel.getByRole("button", { name: "이전 업무 더보기" }).click();
  await expect(cards).toHaveCount(3);
  await expect(cards.nth(2)).toContainText("합성 X-ray");
  await expect(panel.getByText("오늘", { exact: true })).toHaveCount(1);

  await cards.nth(0).getByRole("button", { name: "합성 CBC 더보기" }).click();
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
  await panel.getByRole("tab", { name: "업무 현황" }).click();
  await expect(panel).toContainText("이수지 업무");

  await openStaffProfile(page, "김도윤");
  await expect(panel.getByRole("tab", { name: "프로필" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(panel).toContainText("김도윤");
  await expect(panel).not.toContainText("이수지 업무");
  await panel.getByRole("tab", { name: "업무 현황" }).click();
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
    "운영 프로필을 불러오지 못했어",
  );
  allowSuccess = true;
  await drawer.getByRole("button", { name: "다시 시도" }).click();
  await expect(drawer).toContainText("상태 확인 중");
  await expect(drawer).toContainText("오늘 게시된 근무가 없어요");
});

test("touch viewport keeps the lane action visible and uses a full-width panel", async ({
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

  const drawer = page.getByRole("region", { name: "직원 운영 프로필" });
  await expect
    .poll(async () => (await drawer.boundingBox())?.x ?? 999)
    .toBeLessThanOrEqual(1);
  const box = await drawer.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeLessThanOrEqual(1);
  expect(box!.width).toBeGreaterThanOrEqual(389);
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
  await expect(drawer).toContainText("09:00–18:00");
  await expect(drawer).toContainText("제2진료실");
  await expect(drawer).toContainText("근무 예정");
  await expect(drawer).toContainText("5월 4일 휴무");
  await expect(drawer).toContainText("5월 5일 10:00 복귀");
  await expect(drawer).toContainText("suji@example.test");
  await expect(drawer).toContainText("010-0000-0000");
  await drawer.getByRole("button", { name: "이메일 복사" }).click();
  await expect(page.getByText("이메일을 복사했어요")).toBeVisible();
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
