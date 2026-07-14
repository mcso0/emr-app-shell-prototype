import { expect, test, type Locator, type Page } from "@playwright/test";

type MockKakaoPostcodeResult = {
  readonly address: string;
  readonly autoJibunAddress: string;
  readonly autoRoadAddress: string;
  readonly jibunAddress: string;
  readonly roadAddress: string;
  readonly userSelectedType: string;
  readonly zonecode: string;
};

async function openWalkInReceptionForm(page: Page) {
  await page.getByTestId("schedule-check-in-button").click();
  await page.getByRole("menuitem", { name: "접수하기" }).click();
}

async function mockKakaoPostcodeSearch(page: Page, result: MockKakaoPostcodeResult) {
  await page.addInitScript((mockResult: MockKakaoPostcodeResult) => {
    type MockPostcodeOptions = {
      readonly oncomplete: (data: MockKakaoPostcodeResult) => void;
    };

    class MockPostcode {
      readonly options: MockPostcodeOptions;

      constructor(options: MockPostcodeOptions) {
        this.options = options;
      }

      open() {
        this.options.oncomplete(mockResult);
      }
    }

    Object.defineProperty(window, "kakao", {
      configurable: true,
      value: {
        Postcode: MockPostcode,
      },
    });
  }, result);
}

async function openAppointmentCheckInConfirm(page: Page) {
  await page.getByTestId("reservation-before-check-in-notice-action").click();
  const dialog = page
    .getByRole("dialog")
    .filter({ hasText: "예약을 접수 확정하시겠습니까?" })
    .last();
  await expect(dialog).toBeVisible();

  return dialog;
}

async function submitAppointmentCheckInConfirm(page: Page) {
  const dialog = await openAppointmentCheckInConfirm(page);
  await dialog.getByRole("button", { exact: true, name: "접수" }).click();
}

async function freezeBrowserClock(page: Page, iso: string) {
  await page.addInitScript((fixedIso) => {
    const RealDate = Date;
    const fixedTime = new RealDate(fixedIso).getTime();

    class MockDate extends RealDate {
      constructor(value?: string | number | Date) {
        if (value === undefined) {
          super(fixedTime);
          return;
        }

        super(value);
      }

      static now() {
        return fixedTime;
      }
    }

    window.Date = MockDate as DateConstructor;
  }, iso);
}

async function expectScrollFadeViewport(viewport: Locator) {
  await expect(viewport).toHaveClass(/scroll-fade-y/);
  await expect(viewport).toHaveClass(/scroll-fade-8/);

  const maskState = await viewport.evaluate((element) => {
    const style = getComputedStyle(element);

    return {
      maskImage: style.maskImage,
      webkitMaskImage: style.webkitMaskImage,
    };
  });

  expect(
    [maskState.maskImage, maskState.webkitMaskImage].some(
      (value) => value && value !== "none",
    ),
  ).toBe(true);
}

async function expectRegistrationDialogsWithDimAndWithoutZoom(page: Page) {
  const contentClassNames = await page
    .locator('[data-slot="dialog-content"]')
    .evaluateAll((elements) =>
      elements.map((element) => element.getAttribute("class") ?? ""),
    );

  expect(contentClassNames.length).toBeGreaterThan(0);

  for (const className of contentClassNames) {
    expect(className).not.toContain("zoom-in-95");
    expect(className).not.toContain("zoom-out-95");
    expect(className).not.toContain("data-open:animate-in");
    expect(className).not.toContain("data-closed:animate-out");
  }

  const overlayStates = await page
    .locator('[data-slot="dialog-overlay"]')
    .evaluateAll((elements) =>
      elements.map((element) => {
        const style = getComputedStyle(element);

        return {
          backdropFilter:
            style.getPropertyValue("backdrop-filter") ||
            style.getPropertyValue("-webkit-backdrop-filter") ||
            "none",
          backgroundColor: style.backgroundColor,
          className: element.getAttribute("class") ?? "",
        };
      }),
    );

  expect(overlayStates.length).toBeGreaterThan(0);

  for (const state of overlayStates) {
    expect(state.className).toContain("bg-black/10");
    expect(state.className).not.toContain("bg-transparent");
    expect(state.className).not.toContain("backdrop-blur-xs");
    expect(["", "none"]).toContain(state.backdropFilter);
    expect([
      "rgba(0, 0, 0, 0)",
      "oklab(0 0 0 / 0)",
      "transparent",
    ]).not.toContain(state.backgroundColor);
  }
}

function getLocalDatePrefix(date = new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function mockReceptionWalkInCreate(
  page: Page,
  {
    checkedInAt,
    encounterId,
    guardianId,
    patientId,
    primaryVeterinarianId,
    queueId,
  }: {
    checkedInAt: string;
    encounterId: string;
    guardianId: string;
    patientId: string;
    primaryVeterinarianId?: string;
    queueId: string;
  },
) {
  const state = {
    count: 0,
    latestBody: undefined as Record<string, unknown> | undefined,
  };

  await page.route(
    "**/api/workspaces/clair-demo/reception/walk-in-encounters",
    async (route) => {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      state.count += 1;
      state.latestBody = body;

      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 201,
          workspaceId: "clair-demo",
          walkIn: {
            encounter: {
              id: encounterId,
              workspaceId: "clair-demo",
              patientId,
              guardianId,
              primaryVeterinarianId,
              encounterNo: "E-LIVE-CALENDAR",
              receptionType: "walk_in",
              department:
                typeof body.department === "string" ? body.department : "재활",
              durationMinutes:
                typeof body.durationMinutes === "number" ? body.durationMinutes : 30,
              chiefComplaint: body.visitPurpose ?? "현장 접수",
              visitPurpose: body.visitPurpose ?? "현장 접수",
              status: "waiting",
              checkedInAt,
              createdAt: checkedInAt,
              updatedAt: checkedInAt,
            },
            queueEntry: {
              id: queueId,
              workspaceId: "clair-demo",
              encounterId,
              queueType: "consultation",
              status: "waiting",
              priority: "normal",
              enteredAt: checkedInAt,
            },
          },
          enforcedBy: "reception-walk-in-encounter",
        }),
      });
    },
  );

  return state;
}

test("reception renders the first-path workspace instead of the placeholder", async ({
  page,
}) => {
  await page.goto("/w/clair-demo/reception");

  const sidePanel = page.locator("aside").first();

  await expect(sidePanel).toHaveCSS("background-color", "rgb(249, 249, 249)");
  await expect(page.getByText("접수 워크스페이스")).toHaveCount(0);
  await expect(page.getByText("예약 3건")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "환자/보호자 등록" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "접수/예약 생성", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "26.05.01 (금) 날짜 선택" }),
  ).toBeVisible();
  const dateControl = page.getByTestId("reception-date-control");
  const scheduleToolbar = page.getByTestId("schedule-toolbar");
  const selectedDateButton = dateControl.getByRole("button", {
    name: "26.05.01 (금) 날짜 선택",
  });
  const calendarViewTabs = page.getByRole("group", {
    name: "접수 캘린더 보기",
  });
  await expect(selectedDateButton).toHaveCSS("font-size", "16px");
  await expect(selectedDateButton).toHaveCSS("font-weight", "600");
  await expect(selectedDateButton).toHaveCSS("height", "32px");
  await expect(selectedDateButton).toHaveCSS("color", "rgb(26, 32, 44)");
  await expect
    .poll(() =>
      dateControl
        .getByRole("button")
        .evaluateAll((buttons) =>
          buttons.map((button) => button.getAttribute("aria-label")),
        ),
    )
    .toEqual([
      "이전 날짜",
      "다음 날짜",
      "26.05.01 (금) 날짜 선택",
    ]);
  await expect(
    dateControl.getByRole("button", { name: "오늘 일자로 이동" }),
  ).toHaveCount(0);
  await expect(
    scheduleToolbar.getByRole("button", { name: "오늘 일자로 이동" }),
  ).toBeDisabled();
  const [veterinarianFilterBox, todayShortcutBox, calendarViewTabsBox] =
    await Promise.all([
      scheduleToolbar
        .getByRole("button", { name: /이수지 \+\d+/ })
        .boundingBox(),
      scheduleToolbar
        .getByRole("button", { name: "오늘 일자로 이동" })
        .boundingBox(),
      calendarViewTabs.boundingBox(),
    ]);
  expect(veterinarianFilterBox).not.toBeNull();
  expect(todayShortcutBox).not.toBeNull();
  expect(calendarViewTabsBox).not.toBeNull();
  expect(todayShortcutBox!.x).toBeGreaterThan(
    veterinarianFilterBox!.x + veterinarianFilterBox!.width,
  );
  expect(todayShortcutBox!.x + todayShortcutBox!.width).toBeLessThan(
    calendarViewTabsBox!.x,
  );
  await selectedDateButton.click();
  await expect(page.getByText("2026년 5월")).toBeVisible();
  await page.keyboard.press("Escape");
  await calendarViewTabs.getByRole("button", { name: "주" }).click();
  await expect(
    page.getByRole("button", { name: "26.04.26 - 26.05.02 주 선택" }),
  ).toBeVisible();
  await expect
    .poll(() =>
      dateControl
        .getByRole("button")
        .evaluateAll((buttons) =>
          buttons.map((button) => button.getAttribute("aria-label")),
        ),
    )
    .toEqual([
      "이전 주",
      "다음 주",
      "26.04.26 - 26.05.02 주 선택",
    ]);
  await dateControl
    .getByRole("button", { name: "26.04.26 - 26.05.02 주 선택" })
    .click();
  await expect(
    page.getByRole("button", { name: "26.04.26 - 26.05.02 선택됨" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await calendarViewTabs.getByRole("button", { name: "월" }).click();
  await expect(
    page.getByRole("button", { name: "26.05 월 선택" }),
  ).toBeVisible();
  await expect
    .poll(() =>
      dateControl
        .getByRole("button")
        .evaluateAll((buttons) =>
          buttons.map((button) => button.getAttribute("aria-label")),
        ),
    )
    .toEqual([
      "이전 월",
      "다음 월",
      "26.05 월 선택",
    ]);
  await dateControl.getByRole("button", { name: "26.05 월 선택" }).click();
  await expect(
    page.getByRole("button", { name: "26.05 선택됨" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await calendarViewTabs.getByRole("button", { name: "일" }).click();
  await expect(page.getByText("영업시간 09:00-19:00")).toHaveCount(0);
  await expect(page.getByTestId("schedule-toolbar")).toHaveCSS(
    "height",
    "52px",
  );
  await expect
    .poll(() =>
      page
        .getByTestId("appointment-card-appointment-coco-260501")
        .evaluate((card) => getComputedStyle(card).boxShadow),
    )
    .toContain("rgba(0, 0, 0, 0.05) 0px 1px 2px 0px");
  const appointmentCard = page.getByTestId(
    "appointment-card-appointment-coco-260501",
  );
  await expect(appointmentCard).toHaveCSS("row-gap", "4px");
  const compactContentGap = await appointmentCard
    .locator('[data-testid$="-badge"]')
    .first()
    .evaluate((badge) => {
      const content = badge.parentElement;
      if (!content) throw new Error("Expected calendar task content wrapper");

      return getComputedStyle(content).columnGap;
    });
  expect(compactContentGap).toBe("6px");
  await expect
    .poll(async () => {
      const box = await page.getByTestId("schedule-toolbar").boundingBox();
      return Math.round(box?.height ?? 0);
    })
    .toBe(52);
  const calendarFrameAlignment = await page
    .getByTestId("reception-calendar-frame")
    .evaluate((frameElement) => {
      const toolbar = document.querySelector(
        '[data-testid="schedule-toolbar"]',
      );

      if (!toolbar) return null;

      const frameBox = frameElement.getBoundingClientRect();
      const toolbarBox = toolbar.getBoundingClientRect();

      return {
        leftGap: Math.abs(frameBox.left - toolbarBox.left),
        rightGap: Math.abs(frameBox.right - toolbarBox.right),
      };
  });

  if (!calendarFrameAlignment)
    throw new Error("Expected reception calendar frame alignment data");

  expect(calendarFrameAlignment.leftGap).toBeLessThanOrEqual(1);
  expect(calendarFrameAlignment.rightGap).toBeLessThanOrEqual(1);
  await expect(page.getByText("00:00")).toBeVisible();
  await expect(page.getByText("24:00")).toBeVisible();
  await expect(page.getByText("reception workspace")).toHaveCount(0);
  const sideTabs = sidePanel.getByRole("group", { name: "접수 목록 유형" });
  await expect(sideTabs).toBeVisible();
  await expect(sidePanel.getByText("접수 작업")).toHaveCount(0);
  await expect
    .poll(() =>
      sideTabs
        .getByRole("button")
        .evaluateAll((buttons) =>
          buttons.map((button) => button.textContent?.trim()),
        ),
    )
    .toEqual(["전체 6", "외래 2", "예약 4"]);
  await expect
    .poll(() =>
      sidePanel
        .locator('[data-testid^="patient-card-"]')
        .evaluateAll((cards) =>
          cards.map((card) => card.getAttribute("data-testid")),
        ),
    )
    .toEqual([
      "patient-card-patient-haru",
      "patient-card-patient-kong",
      "patient-card-patient-dubu",
      "patient-card-patient-coco",
    ]);
  await expect(sidePanel.getByTestId("reception-queue-status-waiting")).toContainText(
    "대기",
  );
  await expect(sidePanel.getByTestId("patient-card-patient-nabi")).toHaveCount(
    0,
  );
  await sideTabs.getByRole("button", { name: /예약/ }).click();
  await expect(sidePanel.getByText("예약 작업")).toHaveCount(0);
  await expect(
    sidePanel.getByTestId("appointment-queue-card-appointment-nabi-260501"),
  ).toContainText("나비");
  await expect(
    sidePanel.getByTestId("appointment-queue-card-appointment-nabi-260501"),
  ).toContainText("예약");
  await expect(
    sidePanel.getByRole("searchbox", { name: "대기열 검색" }),
  ).toHaveCount(0);
  await sidePanel.getByRole("button", { name: "검색" }).click();
  await expect(
    sidePanel.getByRole("searchbox", { name: "대기열 검색" }),
  ).toBeVisible();
  await expect(
    sidePanel.getByPlaceholder(
      "환자, 보호자, 전화번호, 방문 목적, 메모, 담당의 검색",
    ),
  ).toBeVisible();
  await expect(page.getByText("환자 상세")).toHaveCount(0);
  await expect(page.getByText("진료 대기열")).toHaveCount(0);
  await expect(page.getByText("잠금 주의사항")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "접수 폼" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "스케줄 생성" })).toHaveCount(
    0,
  );
});

test("reception calendar toolbar icon actions use square 32px controls", async ({ page }) => {
  await page.goto("/w/clair-demo/reception?modulePanel=open&right=closed");

  for (const label of ["더보기", "우측 사이드 패널 열기"]) {
    const button = page.getByRole("button", { name: label, exact: true });

    await expect(button).toBeVisible();
    await expect(button).toHaveCSS("width", "32px");
    await expect(button).toHaveCSS("height", "32px");
  }
});

test("reception route date selects requested operating date", async ({
  page,
}) => {
  const calendarRead = page.waitForRequest(
    (request) =>
      request.url().includes("/reception/calendar/day") &&
      request.url().includes("date=2026-05-08"),
  );
  const queueRead = page.waitForRequest(
    (request) =>
      request.url().includes("/reception/queue") &&
      request.url().includes("date=2026-05-08"),
  );

  await page.goto("/w/clair-demo/reception?modulePanel=open&date=2026-05-08");
  await Promise.all([calendarRead, queueRead]);

  await expect(page.getByLabel("26.05.08 (금) 표시 중")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "26.05.08 (금) 선택됨" }),
  ).toBeVisible();
  await expect(
    page.getByTestId("appointment-card-appointment-coco-260501"),
  ).toHaveCount(0);
});

test("reception route date ignores invalid route date", async ({ page }) => {
  const calendarRead = page.waitForRequest(
    (request) =>
      request.url().includes("/reception/calendar/day") &&
      request.url().includes("date=2026-05-01"),
  );
  const queueRead = page.waitForRequest(
    (request) =>
      request.url().includes("/reception/queue") &&
      request.url().includes("date=2026-05-01"),
  );

  await page.goto("/w/clair-demo/reception?modulePanel=open&date=bad");
  await Promise.all([calendarRead, queueRead]);

  await expect(page).toHaveURL(/date=2026-05-01/);
  await expect(page.getByLabel("26.05.01 (금) 표시 중")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "오늘 26.05.01 (금) 선택됨" }),
  ).toBeVisible();
});

test("reception route date normalizes side panel date changes", async ({
  page,
}) => {
  await page.goto("/w/clair-demo/reception?modulePanel=open&date=2026-05-01");
  await expect(page.getByLabel("26.05.01 (금) 표시 중")).toBeVisible();

  const calendarRead = page.waitForRequest(
    (request) =>
      request.url().includes("/reception/calendar/day") &&
      request.url().includes("date=2026-05-08"),
  );
  const queueRead = page.waitForRequest(
    (request) =>
      request.url().includes("/reception/queue") &&
      request.url().includes("date=2026-05-08"),
  );

  await page.getByRole("button", { name: "26.05.08 (금) 선택" }).click();
  await Promise.all([calendarRead, queueRead]);

  await expect(page).toHaveURL(
    /\/w\/clair-demo\/reception\?modulePanel=open&date=2026-05-08/,
  );
  await expect(page.getByLabel("26.05.08 (금) 표시 중")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "26.05.08 (금) 선택됨" }),
  ).toBeVisible();
  await expect(
    page.getByTestId("appointment-card-appointment-coco-260501"),
  ).toHaveCount(0);
});

test("reception side panel shows a one-time return action after a date change", async ({
  page,
}) => {
  await page.goto("/w/clair-demo/reception?modulePanel=open&date=2026-05-01");
  await expect(
    page.getByRole("button", { name: "이전에 보던 날짜로 돌아가기" }),
  ).toHaveCount(0);

  const selectedDateCalendarRead = page.waitForRequest(
    (request) =>
      request.url().includes("/reception/calendar/day") &&
      request.url().includes("date=2026-05-08"),
  );
  const selectedDateQueueRead = page.waitForRequest(
    (request) =>
      request.url().includes("/reception/queue") &&
      request.url().includes("date=2026-05-08"),
  );

  await page.getByRole("button", { name: "26.05.08 (금) 선택" }).click();
  await Promise.all([selectedDateCalendarRead, selectedDateQueueRead]);

  const returnButton = page.getByRole("button", {
    name: "이전에 보던 날짜로 돌아가기",
  });
  await expect(returnButton).toBeVisible();

  const returnedCalendarRead = page.waitForRequest(
    (request) =>
      request.url().includes("/reception/calendar/day") &&
      request.url().includes("date=2026-05-01"),
  );
  const returnedQueueRead = page.waitForRequest(
    (request) =>
      request.url().includes("/reception/queue") &&
      request.url().includes("date=2026-05-01"),
  );

  await returnButton.click();
  await Promise.all([returnedCalendarRead, returnedQueueRead]);

  await expect(page).toHaveURL(/date=2026-05-01/);
  await expect(
    page.getByRole("button", { name: "이전에 보던 날짜로 돌아가기" }),
  ).toHaveCount(0);
});

test("reception selected operating date resets to today from global command", async ({
  page,
}) => {
  await page.goto("/w/clair-demo/reception?modulePanel=open&date=2026-05-08");
  await expect(page.getByLabel("26.05.08 (금) 표시 중")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "26.05.08 (금) 선택됨" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "전역 통합 검색 열기" }).click();
  const calendarRead = page.waitForRequest(
    (request) =>
      request.url().includes("/reception/calendar/day") &&
      request.url().includes("date=2026-05-01"),
  );
  const queueRead = page.waitForRequest(
    (request) =>
      request.url().includes("/reception/queue") &&
      request.url().includes("date=2026-05-01"),
  );

  await page.locator("#command-result-action-today-appointments").click();
  await Promise.all([calendarRead, queueRead]);

  await expect(page).toHaveURL(/date=2026-05-01/);
  await expect(page.getByLabel("26.05.01 (금) 표시 중")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "오늘 26.05.01 (금) 선택됨" }),
  ).toBeVisible();
});

test("reception topbar refresh refetches the selected operating date", async ({
  page,
}) => {
  await page.goto("/w/clair-demo/reception");

  const dateControl = page.getByTestId("reception-date-control");
  const scheduleToolbar = page.getByTestId("schedule-toolbar");
  const historyControls = page.getByTestId("workspace-history-controls");
  const refreshButton = historyControls.getByRole("button", {
    name: "접수/예약 새로고침",
  });
  const backButton = historyControls.getByRole("button", {
    name: "탭 뒤로가기",
  });
  const forwardButton = historyControls.getByRole("button", {
    name: "탭 앞으로가기",
  });
  await expect(
    dateControl.getByRole("button", { name: "접수/예약 새로고침" }),
  ).toHaveCount(0);
  await expect(
    dateControl.getByRole("button", { name: "오늘 일자로 이동" }),
  ).toHaveCount(0);
  await expect(
    scheduleToolbar.getByRole("button", { name: "오늘 일자로 이동" }),
  ).toBeDisabled();
  await expect(refreshButton).toBeEnabled();

  const [refreshBox, backBox, forwardBox] = await Promise.all([
    refreshButton.boundingBox(),
    backButton.boundingBox(),
    forwardButton.boundingBox(),
  ]);
  expect(refreshBox).not.toBeNull();
  expect(backBox).not.toBeNull();
  expect(forwardBox).not.toBeNull();
  expect(Math.round(backBox!.x - (refreshBox!.x + refreshBox!.width))).toBe(
    4,
  );
  expect(Math.round(forwardBox!.x - (backBox!.x + backBox!.width))).toBe(
    4,
  );

  const manualCalendarRead = page.waitForRequest(
    (request) =>
      request.url().includes("/reception/calendar/day") &&
      request.url().includes("date=2026-05-01"),
  );
  const manualQueueRead = page.waitForRequest(
    (request) =>
      request.url().includes("/reception/queue") &&
      request.url().includes("date=2026-05-01"),
  );
  await refreshButton.click();
  await Promise.all([manualCalendarRead, manualQueueRead]);

  const pickedDayCalendarRead = page.waitForRequest(
    (request) =>
      request.url().includes("/reception/calendar/day") &&
      request.url().includes("date=2026-05-08"),
  );
  const pickedDayQueueRead = page.waitForRequest(
    (request) =>
      request.url().includes("/reception/queue") &&
      request.url().includes("date=2026-05-08"),
  );
  await page.getByRole("button", { name: "26.05.08 (금) 선택" }).click();
  await Promise.all([pickedDayCalendarRead, pickedDayQueueRead]);
  await expect(page.getByLabel("26.05.08 (금) 표시 중")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "26.05.08 (금) 선택됨" }),
  ).toBeVisible();
  await expect(
    scheduleToolbar.getByRole("button", { name: "오늘 일자로 이동" }),
  ).toBeEnabled();
  await expect(
    page.getByTestId("appointment-card-appointment-coco-260501"),
  ).toHaveCount(0);

  const selectedDateRefreshCalendarRead = page.waitForRequest(
    (request) =>
      request.url().includes("/reception/calendar/day") &&
      request.url().includes("date=2026-05-08"),
  );
  const selectedDateRefreshQueueRead = page.waitForRequest(
    (request) =>
      request.url().includes("/reception/queue") &&
      request.url().includes("date=2026-05-08"),
  );
  await refreshButton.click();
  await Promise.all([
    selectedDateRefreshCalendarRead,
    selectedDateRefreshQueueRead,
  ]);

  const todayCalendarRead = page.waitForRequest(
    (request) =>
      request.url().includes("/reception/calendar/day") &&
      request.url().includes("date=2026-05-01"),
  );
  const todayQueueRead = page.waitForRequest(
    (request) =>
      request.url().includes("/reception/queue") &&
      request.url().includes("date=2026-05-01"),
  );
  await scheduleToolbar
    .getByRole("button", { name: "오늘 일자로 이동" })
    .click();
  await Promise.all([todayCalendarRead, todayQueueRead]);
  await expect(page).toHaveURL(/date=2026-05-01/);
  await expect(page.getByLabel("26.05.01 (금) 표시 중")).toBeVisible();
  await expect(
    scheduleToolbar.getByRole("button", { name: "오늘 일자로 이동" }),
  ).toBeDisabled();

  await page.route(
    "**/api/workspaces/clair-demo/reception/calendar/day?**",
    async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          ok: false,
          status: 500,
          error: "db_read_failed",
        }),
      });
    },
    { times: 1 },
  );
  await refreshButton.click();
  await expect(
    page.getByText("접수/예약 새로고침에 실패했습니다.").first(),
  ).toBeVisible();
});

test("reception prioritizes the Kong vomit queue and detail context from query params", async ({
  page,
}) => {
  await page.goto(
    "/w/clair-demo/reception?scenario=kong-vomit&patientId=patient-kong&encounterId=encounter-kong-260501",
  );

  const sidePanel = page
    .getByRole("complementary")
    .filter({ hasText: "접수/예약" })
    .first();
  const kongCard = sidePanel.getByTestId("patient-card-patient-kong");

  await expect(kongCard).toBeVisible();
  await expect(kongCard).toContainText("콩이");
  await expect(kongCard).toContainText("김하늘");
  await expect(kongCard).toContainText("예약");
  await expect(kongCard).toContainText("반복 구토와 식욕 저하");
  await expect(kongCard).toContainText("이수지");

  await page.getByTestId("appointment-card-appointment-kong-260501").click();

  await expect(page.getByText("예약 상세").first()).toBeVisible();
  await expect(
    page.getByTestId("reception-right-panel").getByRole("textbox").nth(1),
  ).toHaveValue(/^김하늘/);
  await expect(page.getByText("콩이").first()).toBeVisible();
  await expect(page.getByPlaceholder("방문목적을 입력해주세요")).toHaveValue(
    "반복 구토와 식욕 저하",
  );
  await expect(
    page.getByTestId("reception-right-panel").locator('input[value="15분"]'),
  ).toBeVisible();

  await page
    .getByTestId("reception-right-panel")
    .getByRole("button", { name: "닫기", exact: true })
    .click();
  await kongCard.click();

  await expect(page.getByText("접수 상세").first()).toBeVisible();
  await expect(
    page.getByTestId("reception-right-panel").getByRole("textbox").nth(1),
  ).toHaveValue(/^김하늘/);
  await expect(page.getByText("콩이").last()).toBeVisible();
});

test("reception calendar options expose Excel import and export actions", async ({
  page,
}) => {
  await page.goto("/w/clair-demo/reception");

  const calendarOptionsButton = page.getByRole("button", {
    name: "더보기",
    exact: true,
  });
  await expect(async () => {
    await calendarOptionsButton.click();
    await expect(calendarOptionsButton).toHaveAttribute(
      "aria-expanded",
      "true",
      {
        timeout: 1_000,
      },
    );
  }).toPass();

  await expect(
    page.getByRole("menuitem", { name: "Excel 다운로드" }),
  ).toBeVisible();
  await expect(
    page.getByRole("menuitem", { name: "Excel 업로드" }),
  ).toBeVisible();
});

test("reception week calendar shows a time axis and today's current-time marker", async ({
  page,
}) => {
  await page.goto("/w/clair-demo/reception");

  await page.getByRole("button", { name: "주" }).click();

  const calendar = page.getByTestId("reception-week-calendar");
  await expect(calendar).toBeVisible();
  await expect(calendar.getByText("00:00")).toBeVisible();
  await expect(calendar.getByText("24:00")).toBeVisible();
  await expect(calendar.getByText("01", { exact: true })).toBeVisible();
  await expect(calendar.getByTestId("week-current-time-indicator")).toHaveCount(
    1,
  );
  await expect(calendar.getByTestId("week-current-time-label")).toHaveText(
    "10:45",
  );
});

test("reception week calendar initially centers the current-time marker", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 640 });
  await page.goto("/w/clair-demo/reception");

  await page.getByRole("button", { name: "주" }).click();

  const weekCalendar = page.getByTestId("reception-week-calendar");
  const weekBodyViewport = weekCalendar
    .getByTestId("reception-week-calendar-body-scroll")
    .locator('[data-slot="scroll-area-viewport"]');
  await expectScrollFadeViewport(weekBodyViewport);

  const weekHeaderInsideFadeViewport = await weekCalendar
    .getByTestId("reception-week-calendar-header")
    .evaluate((header) =>
      Boolean(header.closest('[data-testid="reception-week-calendar-body-scroll"]')),
    );
  expect(weekHeaderInsideFadeViewport).toBe(false);

  const currentTimeDistanceFromCenter = async () =>
    page.getByTestId("week-current-time-indicator").evaluate((indicator) => {
      const viewport = indicator.closest<HTMLElement>(
        '[data-slot="scroll-area-viewport"]',
      );

      if (!viewport) return Number.POSITIVE_INFINITY;

      const viewportBox = viewport.getBoundingClientRect();
      const indicatorBox = indicator.getBoundingClientRect();
      const indicatorLineCenter = indicatorBox.top + indicator.clientHeight / 2;

      return Math.abs(
        indicatorLineCenter - (viewportBox.top + viewportBox.height / 2),
      );
    });
  await expect.poll(currentTimeDistanceFromCenter).toBeLessThanOrEqual(24);

  const scrollTop = await page
    .getByTestId("week-current-time-indicator")
    .evaluate((indicator) => {
      const viewport = indicator.closest<HTMLElement>(
        '[data-slot="scroll-area-viewport"]',
      );

      return viewport?.scrollTop ?? 0;
    });

  expect(scrollTop).toBeGreaterThan(20);
});

test("reception day calendar emphasizes schedule card hierarchy and current line", async ({
  page,
}) => {
  await page.goto("/w/clair-demo/reception");

  const calendar = page.getByTestId("reception-day-calendar");
  const dayBodyViewport = calendar
    .getByTestId("reception-day-calendar-body-scroll")
    .locator('[data-slot="scroll-area-viewport"]');
  const laneHeaderCell = calendar
    .getByTestId("veterinarian-lane-header-cell")
    .first();
  const laneHeader = calendar.getByTestId("veterinarian-lane-header").first();
  const laneAvatar = laneHeader.getByTestId("veterinarian-lane-avatar");
  const laneAvatarFallback = laneAvatar.locator('[data-slot="avatar-fallback"]');
  const laneAvatarImage = laneAvatar.locator('[data-slot="avatar-image"]');
  const kongAppointment = page.getByTestId(
    "appointment-card-appointment-kong-260501",
  );
  const nabiLaneAppointment = page.getByTestId(
    "appointment-card-appointment-nabi-260501",
  );
  const haruNoShowAppointment = page.getByTestId(
    "appointment-card-appointment-haru-260501",
  );

  await expectScrollFadeViewport(dayBodyViewport);
  const laneHeaderInsideFadeViewport = await laneHeaderCell.evaluate((cell) =>
    Boolean(cell.closest('[data-testid="reception-day-calendar-body-scroll"]')),
  );
  expect(laneHeaderInsideFadeViewport).toBe(false);

  await expect
    .poll(() =>
      laneHeaderCell.evaluate((cell) => {
        const style = getComputedStyle(cell);
        const box = cell.getBoundingClientRect();

        return {
          height: Math.round(box.height),
          paddingBottom: style.paddingBottom,
          paddingLeft: style.paddingLeft,
          paddingRight: style.paddingRight,
          paddingTop: style.paddingTop,
        };
      }),
    )
    .toEqual({
      height: 56,
      paddingBottom: "8px",
      paddingLeft: "8px",
      paddingRight: "8px",
      paddingTop: "8px",
    });
  await expect
    .poll(() =>
      laneHeader.evaluate((header) => {
        const style = getComputedStyle(header);
        const box = header.getBoundingClientRect();

        return {
          backgroundColor: style.backgroundColor,
          borderRadius: style.borderRadius,
          columnGap: style.columnGap,
          height: Math.round(box.height),
          paddingBottom: style.paddingBottom,
          paddingLeft: style.paddingLeft,
          paddingRight: style.paddingRight,
          paddingTop: style.paddingTop,
        };
      }),
    )
    .toEqual({
      backgroundColor: "color(srgb 0.951529 0.970588 0.988471)",
      borderRadius: "8px",
      columnGap: "8px",
      height: 40,
      paddingBottom: "8px",
      paddingLeft: "8px",
      paddingRight: "8px",
      paddingTop: "8px",
    });
  await expect
    .poll(() =>
      laneAvatar.evaluate((avatar) => {
        const style = getComputedStyle(avatar);
        const box = avatar.getBoundingClientRect();

        return {
          borderRadius: style.borderRadius,
          borderWidth: style.borderWidth,
          boxShadow: style.boxShadow,
          height: Math.round(box.height),
          width: Math.round(box.width),
        };
      }),
    )
    .toEqual({
      borderRadius: "6px",
      borderWidth: "0px",
      boxShadow: "none",
      height: 24,
      width: 24,
    });
  if (await laneAvatarFallback.count()) {
    await expect(laneAvatarFallback).toHaveText("SJ");
    await expect
      .poll(() =>
        laneAvatarFallback.evaluate((fallback) => {
          const style = getComputedStyle(fallback);

          return {
            backgroundColor: style.backgroundColor,
            borderRadius: style.borderRadius,
            color: style.color,
            fontSize: style.fontSize,
            fontWeight: style.fontWeight,
          };
        }),
      )
      .toEqual({
        backgroundColor: "rgb(252, 252, 253)",
        borderRadius: "6px",
        color: "rgb(113, 128, 150)",
        fontSize: "12px",
        fontWeight: "500",
      });
  } else {
    await expect(laneAvatarImage).toHaveAttribute("alt", "");
  }

  const currentTimeLabel = calendar.getByTestId("day-current-time-label");
  await expect(currentTimeLabel).toHaveText("10:45");
  await expect
    .poll(() =>
      currentTimeLabel.evaluate((label) => {
        const style = getComputedStyle(label);
        const box = label.getBoundingClientRect();

        return {
          backgroundColor: style.backgroundColor,
          borderRadius: style.borderRadius,
          fontSize: style.fontSize,
          height: Math.round(box.height),
          paddingBottom: style.paddingBottom,
          paddingLeft: style.paddingLeft,
          paddingRight: style.paddingRight,
          paddingTop: style.paddingTop,
          width: Math.round(box.width),
        };
      }),
    )
    .toEqual({
      backgroundColor: "rgb(229, 62, 62)",
      borderRadius: "6px",
      fontSize: "11px",
      height: 16,
      paddingBottom: "1px",
      paddingLeft: "4px",
      paddingRight: "4px",
      paddingTop: "1px",
      width: 36,
    });
  await expect
    .poll(() =>
      calendar
        .getByTestId("day-current-time-indicator-line")
        .evaluate((line) => getComputedStyle(line).paddingLeft),
    )
    .toBe("2px");
  await expect
    .poll(() =>
      calendar.getByTestId("day-current-time-indicator-line").evaluate((line) => {
        const dot = line.querySelector("span");
        const timeAxis = document.querySelector('[data-testid="day-time-axis"]');

        if (!dot || !timeAxis) return Number.POSITIVE_INFINITY;

        const dotBox = dot.getBoundingClientRect();
        const timeAxisBox = timeAxis.getBoundingClientRect();

        return Math.abs(dotBox.left + dotBox.width / 2 - timeAxisBox.right);
      }),
    )
    .toBeLessThanOrEqual(1);
  await expect(
    calendar
      .getByTestId("day-hour-row-10")
      .locator('[data-testid="calendar-quarter-hour-lines"]')
      .first()
      .locator("span"),
  ).toHaveCount(3);
  await expect(
    kongAppointment.getByTestId("appointment-purpose-appointment-kong-260501"),
  ).toContainText("콩이 · 김하늘");
  await expect(
    kongAppointment.getByTestId("appointment-accent-appointment-kong-260501"),
  ).toHaveClass(/emr-status-info-text/);
  await expect
    .poll(() =>
      kongAppointment.evaluate((card) => {
        const style = getComputedStyle(card);

        return {
          backgroundColor: style.backgroundColor,
          borderColor: style.borderColor,
          color: style.color,
        };
      }),
    )
    .toEqual({
      backgroundColor: "rgb(235, 248, 255)",
      borderColor: "rgb(99, 179, 237)",
      color: "rgb(42, 67, 101)",
    });
  await expect
    .poll(() =>
      kongAppointment
        .getByTestId("appointment-card-appointment-kong-260501-badge")
        .evaluate((badge) => {
          const style = getComputedStyle(badge);

          return {
            backgroundColor: style.backgroundColor,
            borderColor: style.borderColor,
            color: style.color,
          };
        }),
    )
    .toEqual({
      backgroundColor: "rgb(190, 227, 248)",
      borderColor: "rgb(99, 179, 237)",
      color: "rgb(42, 67, 101)",
    });
  await expect
    .poll(() =>
      nabiLaneAppointment.evaluate((card) => {
        const style = getComputedStyle(card);

        return {
          backgroundColor: style.backgroundColor,
          borderColor: style.borderColor,
          color: style.color,
        };
      }),
    )
    .toEqual({
      backgroundColor: "rgb(242, 253, 245)",
      borderColor: "rgb(132, 223, 162)",
      color: "rgb(40, 96, 58)",
    });
  await expect
    .poll(() =>
      nabiLaneAppointment
        .getByTestId("appointment-card-appointment-nabi-260501-badge")
        .evaluate((badge) => {
          const style = getComputedStyle(badge);

          return {
            backgroundColor: style.backgroundColor,
            borderColor: style.borderColor,
            color: style.color,
          };
        }),
    )
    .toEqual({
      backgroundColor: "rgb(209, 245, 221)",
      borderColor: "rgb(132, 223, 162)",
      color: "rgb(40, 96, 58)",
    });
  await expect
    .poll(() =>
      haruNoShowAppointment.evaluate((card) => {
        const style = getComputedStyle(card);

        return {
          borderColor: style.borderColor,
          color: style.color,
        };
      }),
    )
    .toEqual({
      borderColor: "rgb(252, 129, 129)",
      color: "rgb(197, 48, 48)",
    });
  await expect
    .poll(() =>
      haruNoShowAppointment
        .getByTestId("appointment-card-appointment-haru-260501-badge")
        .evaluate((badge) => {
          const style = getComputedStyle(badge);

          return {
            borderColor: style.borderColor,
            color: style.color,
          };
        }),
    )
    .toEqual({
      borderColor: "rgb(252, 129, 129)",
      color: "rgb(197, 48, 48)",
    });
  await expect(kongAppointment).toContainText("콩이");
  await expect(kongAppointment).toContainText("09:30-10:00");
  await expect
    .poll(() =>
      kongAppointment.evaluate((card) => getComputedStyle(card).boxShadow),
    )
    .toContain("rgba(0, 0, 0, 0.05) 0px 1px 2px 0px");
  const kongCardInsets = await kongAppointment.evaluate((card) => {
    const parent = card.parentElement;
    if (!parent) return null;

    const cardBox = card.getBoundingClientRect();
    const parentBox = parent.getBoundingClientRect();

    return {
      bottom: Math.round((parentBox.bottom - cardBox.bottom) * 100) / 100,
      left: Math.round((cardBox.left - parentBox.left) * 100) / 100,
      right: Math.round((parentBox.right - cardBox.right) * 100) / 100,
      top: Math.round((cardBox.top - parentBox.top) * 100) / 100,
      height: Math.round(cardBox.height),
      width: Math.round(cardBox.width),
    };
  });

  if (!kongCardInsets) throw new Error("Expected schedule card inset data");

  expect(Math.abs(kongCardInsets.left)).toBeLessThanOrEqual(1);
  expect(Math.abs(kongCardInsets.top)).toBeLessThanOrEqual(1);
  expect(kongCardInsets.height).toBe(60);
  expect(kongCardInsets.width).toBeGreaterThanOrEqual(160);
  expect(Math.abs(kongCardInsets.right)).toBeLessThanOrEqual(1);

  const timeAxisAlignment = await calendar.evaluate((calendarElement) => {
    const timeAxis = calendarElement.querySelector(
      '[data-testid="day-time-axis"]',
    );
    const alignedHours = [9, 10, 11, 12];
    const firstTimeLabel = Array.from(
      timeAxis?.querySelectorAll("div") ?? [],
    ).find((element) => element.textContent?.trim() === "00:00");

    if (!timeAxis || !firstTimeLabel) return null;

    const firstTextRange = document.createRange();
    firstTextRange.selectNodeContents(firstTimeLabel);
    const firstTextBox = firstTextRange.getBoundingClientRect();
    firstTextRange.detach();

    const timeAxisBox = timeAxis.getBoundingClientRect();
    const alignments = alignedHours.map((hour) => {
      const hourRow = calendarElement.querySelector(
        `[data-testid="day-hour-row-${hour}"]`,
      );
      const timeLabel = Array.from(timeAxis.querySelectorAll("div")).find(
        (element) =>
          element.textContent?.trim() === `${String(hour).padStart(2, "0")}:00`,
      );

      if (!hourRow || !timeLabel) return null;

      const textRange = document.createRange();
      textRange.selectNodeContents(timeLabel);
      const textBox = textRange.getBoundingClientRect();
      textRange.detach();

      const hourRowBox = hourRow.getBoundingClientRect();

      return {
        hour,
        gapToAxisRight: timeAxisBox.right - textBox.right,
        rowHeight: hourRowBox.height,
        textCenterOffsetFromRowLine: Math.abs(
          (textBox.top + textBox.bottom) / 2 - hourRowBox.top,
        ),
      };
    });

    if (alignments.some((alignment) => alignment === null)) return null;

    return {
      firstLabelInsetFromAxisTop: firstTextBox.top - timeAxisBox.top,
      alignments,
    };
  });

  if (!timeAxisAlignment)
    throw new Error("Expected day calendar time axis alignment data");

  expect(timeAxisAlignment.firstLabelInsetFromAxisTop).toBeGreaterThanOrEqual(
    0,
  );
  for (const alignment of timeAxisAlignment.alignments) {
    expect(alignment?.gapToAxisRight).toBeGreaterThanOrEqual(6);
    expect(alignment?.gapToAxisRight).toBeLessThanOrEqual(10);
    expect(alignment?.rowHeight).toBe(120);
    expect(alignment?.textCenterOffsetFromRowLine).toBeLessThanOrEqual(1);
  }

  const nabiAppointment = page.getByTestId(
    "appointment-card-appointment-nabi-260501",
  );
  await expect(
    nabiAppointment.getByTestId("appointment-purpose-appointment-nabi-260501"),
  ).toContainText("나비 · 오세아");
  await expect(nabiAppointment).toContainText("10:45-11:00");
  await expect(nabiAppointment).not.toContainText("피부 재진");
  await expect(nabiAppointment).toHaveCSS("height", "30px");
  const nabiBadgeMetrics = await nabiAppointment
    .getByTestId("appointment-card-appointment-nabi-260501-badge")
    .evaluate((badge) => {
      const card = badge.closest(
        '[data-testid="appointment-card-appointment-nabi-260501"]',
      );
      if (!card) return null;

      const badgeBox = badge.getBoundingClientRect();
      const cardBox = card.getBoundingClientRect();

      return {
        badgeHeight: Math.round(badgeBox.height),
        badgeTopInset: Math.round(badgeBox.top - cardBox.top),
        parentHeight: Math.round(cardBox.height),
        parentTestId: card.getAttribute("data-testid"),
      };
    });

  if (!nabiBadgeMetrics)
    throw new Error("Expected Nabi appointment badge metrics");
  expect(nabiBadgeMetrics.parentTestId).toBe(
    "appointment-card-appointment-nabi-260501",
  );
  expect(nabiBadgeMetrics.parentHeight).toBeGreaterThanOrEqual(
    nabiBadgeMetrics.badgeHeight,
  );
  expect(nabiBadgeMetrics.badgeTopInset).toBeGreaterThanOrEqual(5);
  expect(nabiBadgeMetrics.badgeTopInset).toBeLessThanOrEqual(7);
  const nabiContentInsets = await nabiAppointment.evaluate((card) => {
    const badge = card.querySelector(
      '[data-testid="appointment-card-appointment-nabi-260501-badge"]',
    );
    const purpose = card.querySelector(
      '[data-testid="appointment-purpose-appointment-nabi-260501"]',
    );
    const time = card.querySelector(
      '[data-testid="appointment-card-appointment-nabi-260501-time"]',
    );
    if (!badge || !purpose || !time) return null;

    const purposeTextRange = document.createRange();
    purposeTextRange.selectNodeContents(purpose);
    const purposeTextBox = purposeTextRange.getBoundingClientRect();
    purposeTextRange.detach();

    const timeTextRange = document.createRange();
    timeTextRange.selectNodeContents(time);
    const timeTextBox = timeTextRange.getBoundingClientRect();
    timeTextRange.detach();

    const badgeBox = badge.getBoundingClientRect();
    const cardBox = card.getBoundingClientRect();
    const purposeBox = purpose.getBoundingClientRect();
    const timeBox = time.getBoundingClientRect();
    const timeStyle = getComputedStyle(time);
    const verticalCenterOffset = Math.abs(
      (purposeTextBox.top + purposeTextBox.bottom) / 2 -
        (timeTextBox.top + timeTextBox.bottom) / 2,
    );

    return {
      badgeLeftInset: Math.round((badgeBox.left - cardBox.left) * 100) / 100,
      timeHeight: Math.round(timeBox.height),
      timeOpacity: timeStyle.opacity,
      timeTextLeftGap:
        Math.round((timeBox.left - purposeBox.right) * 100) / 100,
      verticalCenterOffset: Math.round(verticalCenterOffset * 100) / 100,
    };
  });

  if (!nabiContentInsets)
    throw new Error("Expected Nabi compact schedule content inset data");
  expect(nabiContentInsets.badgeLeftInset).toBeGreaterThanOrEqual(7);
  expect(nabiContentInsets.badgeLeftInset).toBeLessThanOrEqual(9);
  expect(nabiContentInsets.timeHeight).toBe(18);
  expect(nabiContentInsets.timeOpacity).toBe("0.6");
  expect(nabiContentInsets.timeTextLeftGap).toBeGreaterThanOrEqual(4);
  expect(nabiContentInsets.timeTextLeftGap).toBeLessThanOrEqual(8);
  expect(nabiContentInsets.verticalCenterOffset).toBeLessThanOrEqual(1);
  const nabiCardInsets = await nabiAppointment.evaluate((card) => {
    const parent = card.parentElement;
    if (!parent) return null;

    const cardBox = card.getBoundingClientRect();
    const parentBox = parent.getBoundingClientRect();

    return {
      right: Math.round((parentBox.right - cardBox.right) * 100) / 100,
      width: Math.round(cardBox.width),
    };
  });

  if (!nabiCardInsets)
    throw new Error("Expected Nabi schedule card inset data");
  expect(nabiCardInsets.width).toBeGreaterThanOrEqual(160);
  expect(Math.abs(nabiCardInsets.right)).toBeLessThanOrEqual(1);
});

test("reception day calendar keeps unassigned walk-ins sticky as compact neutral cards", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 640 });
  let calendarRequested = false;
  await page.route("**/api/workspaces/clair-demo/reception/calendar/day?**", async (route) => {
    calendarRequested = true;
    const date = new URL(route.request().url()).searchParams.get("date");
    const checkedInAt = "2026-05-01T14:30:00+09:00";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        status: 200,
        workspaceId: "clair-demo",
        date,
        records: [
          {
            encounter: {
              id: "encounter-unassigned-sticky",
              workspaceId: "clair-demo",
              patientId: "patient-coco",
              guardianId: "guardian-lee-jieun",
              primaryVeterinarianId: null,
              encounterNo: "E-STICKY-001",
              department: "내과",
              receptionType: "walk_in",
              durationMinutes: 60,
              chiefComplaint: "현장 접수",
              visitPurpose: "현장 접수",
              status: "waiting",
              checkedInAt,
              createdAt: checkedInAt,
              updatedAt: checkedInAt,
            },
            queueEntry: {
              id: "queue-unassigned-sticky",
              workspaceId: "clair-demo",
              encounterId: "encounter-unassigned-sticky",
              queueType: "consultation",
              status: "waiting",
              priority: "normal",
              sortOrder: 1,
              enteredAt: checkedInAt,
            },
          },
        ],
        enforcedBy: "reception-calendar-read",
      }),
    });
  });

  await page.goto("/w/clair-demo/reception");
  await expect.poll(() => calendarRequested).toBe(true);

  const calendar = page.getByTestId("reception-day-calendar");
  const unassignedCard = calendar
    .locator("button")
    .filter({ hasText: "14:30-15:30" })
    .first();
  await expect(unassignedCard).toBeVisible();
  await expect(unassignedCard).toContainText("외래");
  await expect(unassignedCard).toContainText("14:30-15:30");
  await expect(unassignedCard).not.toContainText("현장 접수");
  await expect(unassignedCard).not.toContainText("내과");
  await expect(unassignedCard).toHaveCSS("height", "30px");

  const cardTone = await unassignedCard.evaluate((card) => {
    const badge = card.querySelector(`[data-testid="${card.getAttribute("data-testid")}-badge"]`);
    const cardStyle = getComputedStyle(card);
    const badgeStyle = badge ? getComputedStyle(badge) : null;
    const resolveColor = (
      property: "backgroundColor" | "borderTopColor" | "color",
      value: string,
    ) => {
      const probe = document.createElement("span");
      probe.style[property] = value;
      document.body.append(probe);
      const resolved = getComputedStyle(probe)[property];
      probe.remove();
      return resolved;
    };

    return {
      badgeBackground: badgeStyle?.backgroundColor,
      badgeColor: badgeStyle?.color,
      borderColor: cardStyle.borderTopColor,
      backgroundColor: cardStyle.backgroundColor,
      expectedBadgeBackground: resolveColor("backgroundColor", "var(--card)"),
      expectedBadgeColor: resolveColor("color", "var(--muted-foreground)"),
      expectedBorderColor: resolveColor("borderTopColor", "var(--border)"),
      expectedCardBackground: resolveColor("backgroundColor", "var(--muted)"),
    };
  });

  expect(cardTone.backgroundColor).toBe(cardTone.expectedCardBackground);
  expect(cardTone.borderColor).toBe(cardTone.expectedBorderColor);
  expect(cardTone.badgeBackground).toBe(cardTone.expectedBadgeBackground);
  expect(cardTone.badgeColor).toBe(cardTone.expectedBadgeColor);

  const unassignedRowMetrics = await unassignedCard.evaluate(async (card) => {
    const unassignedRow =
      card.closest<HTMLElement>('[data-testid="unassigned-walkin-row"]') ??
      card.parentElement?.parentElement;
    const laneHeaderRow = unassignedRow?.previousElementSibling as
      | HTMLElement
      | undefined;
    const viewport = document.querySelector<HTMLElement>(
      '[data-testid="reception-day-calendar-body-scroll"] [data-slot="scroll-area-viewport"]',
    );

    if (!unassignedRow || !laneHeaderRow || !viewport) return null;

    const settle = () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });

    viewport.scrollTop = 0;
    await settle();
    const beforeRowBox = unassignedRow.getBoundingClientRect();
    const beforeHeaderBox = laneHeaderRow.getBoundingClientRect();

    viewport.scrollTop = 420;
    await settle();
    const afterRowBox = unassignedRow.getBoundingClientRect();
    const afterHeaderBox = laneHeaderRow.getBoundingClientRect();

    return {
      afterGap: Math.round((afterRowBox.top - afterHeaderBox.bottom) * 100) / 100,
      beforeGap:
        Math.round((beforeRowBox.top - beforeHeaderBox.bottom) * 100) / 100,
      rowInsideFadeViewport: Boolean(
        unassignedRow.closest('[data-testid="reception-day-calendar-body-scroll"]'),
      ),
    };
  });

  if (!unassignedRowMetrics) throw new Error("Expected unassigned row metrics");

  expect(unassignedRowMetrics.rowInsideFadeViewport).toBe(false);
  expect(Math.abs(unassignedRowMetrics.beforeGap)).toBeLessThanOrEqual(1);
  expect(Math.abs(unassignedRowMetrics.afterGap)).toBeLessThanOrEqual(1);
});

test("reception day calendar lays out overlapping same-veterinarian cards side by side", async ({
  page,
}) => {
  await page.route(
    "**/api/workspaces/clair-demo/reception/calendar/day?*",
    async (route) => {
      await route.fulfill({
        contentType: "application/json",
        json: {
          ok: true,
          status: 200,
          workspaceId: "clair-demo",
          date: "2026-05-01",
          records: [
            {
              appointment: {
                id: "appointment-kong-260501",
                workspaceId: "clair-demo",
                patientId: "patient-kong",
                guardianId: "guardian-kim-haneul",
                assignedVeterinarianId: "user-vet-suji",
                scheduledStartAt: "2026-05-01T09:30:00+09:00",
                scheduledEndAt: "2026-05-01T10:30:00+09:00",
                visitPurpose: "구토 및 복부 불편",
                symptomNote: "전날 밤부터 구토 3회, 아침 사료 거부",
                status: "checked_in",
                createdByUserId: "user-desk-yuna",
                createdAt: "2026-05-01T09:12:00+09:00",
                updatedAt: "2026-05-01T09:28:00+09:00",
              },
            },
            {
              appointment: {
                id: "appointment-coco-260501",
                workspaceId: "clair-demo",
                patientId: "patient-coco",
                guardianId: "guardian-lee-jieun",
                assignedVeterinarianId: "user-vet-suji",
                scheduledStartAt: "2026-05-01T09:45:00+09:00",
                scheduledEndAt: "2026-05-01T10:15:00+09:00",
                visitPurpose: "구토 및 식욕저하",
                symptomNote: "전날 밤부터 구토 2회",
                status: "checked_in",
                createdByUserId: "user-desk-yuna",
                createdAt: "2026-04-30T17:20:00+09:00",
                updatedAt: "2026-05-01T09:50:00+09:00",
              },
            },
          ],
          enforcedBy: "reception-calendar-read",
        },
        status: 200,
      });
    },
  );
  await page.goto("/w/clair-demo/reception");

  const calendar = page.getByTestId("reception-day-calendar");
  const kongCard = calendar.getByTestId(
    "appointment-card-appointment-kong-260501",
  );
  const cocoCard = calendar.getByTestId(
    "appointment-card-appointment-coco-260501",
  );
  await expect(kongCard).toBeVisible();
  await expect(cocoCard).toBeVisible();
  await expect(kongCard).toContainText("09:30-10:30");
  await expect(cocoCard).toContainText("09:45-10:15");

  const frames = await Promise.all(
    [kongCard, cocoCard].map((card) =>
      card.evaluate((element) => {
        const frame = element.parentElement;
        if (!frame) return null;
        const frameBox = frame.getBoundingClientRect();
        const laneBox = frame.parentElement?.getBoundingClientRect();

        return {
          columnCount: frame.dataset.overlapColumnCount,
          columnIndex: frame.dataset.overlapColumnIndex,
          laneWidth: laneBox?.width ?? 0,
          left: frameBox.left,
          width: frameBox.width,
        };
      }),
    ),
  );

  const [kongFrame, cocoFrame] = frames;
  if (!kongFrame || !cocoFrame) {
    throw new Error("Expected overlapping appointment frames");
  }

  expect(kongFrame.columnCount).toBe("2");
  expect(kongFrame.columnIndex).toBe("0");
  expect(cocoFrame.columnCount).toBe("2");
  expect(cocoFrame.columnIndex).toBe("1");
  expect(Math.round(kongFrame.width)).toBeLessThan(
    Math.round(kongFrame.laneWidth * 0.6),
  );
  expect(Math.round(cocoFrame.width)).toBeLessThan(
    Math.round(cocoFrame.laneWidth * 0.6),
  );
  expect(cocoFrame.left).toBeGreaterThan(kongFrame.left + kongFrame.width);
});

test("reception day current-time line layers above schedule cards", async ({
  page,
}) => {
  await page.route(
    "**/api/workspaces/clair-demo/reception/calendar/day?*",
    async (route) => {
      await route.fulfill({
        contentType: "application/json",
        json: {
          ok: true,
          status: 200,
          workspaceId: "clair-demo",
          date: "2026-05-01",
          records: [
            {
              appointment: {
                id: "appointment-current-layer-260501",
                workspaceId: "clair-demo",
                patientId: "patient-kong",
                guardianId: "guardian-kim-haneul",
                assignedVeterinarianId: "user-vet-suji",
                scheduledStartAt: "2026-05-01T10:30:00+09:00",
                scheduledEndAt: "2026-05-01T11:15:00+09:00",
                visitPurpose: "현재시간 레이어 확인",
                symptomNote: "현재시간 라인과 겹치는 예약",
                status: "confirmed",
                createdByUserId: "user-desk-yuna",
                createdAt: "2026-05-01T09:12:00+09:00",
                updatedAt: "2026-05-01T09:28:00+09:00",
              },
            },
          ],
          enforcedBy: "reception-calendar-read",
        },
        status: 200,
      });
    },
  );
  await page.goto("/w/clair-demo/reception");

  const calendar = page.getByTestId("reception-day-calendar");
  const currentTimeIndicator = calendar.getByTestId(
    "day-current-time-indicator",
  );
  const currentTimeLine = calendar.getByTestId("day-current-time-indicator-line");
  const appointmentCard = calendar.getByTestId(
    "appointment-card-appointment-current-layer-260501",
  );

  await expect(currentTimeIndicator).toHaveCSS("pointer-events", "none");
  await expect(currentTimeIndicator).toHaveCSS("z-index", "35");
  await expect(appointmentCard).toBeVisible();
  await expect(appointmentCard).toContainText("10:30-11:15");

  const layerCheck = await currentTimeLine.evaluate((line) => {
    const indicator = line.closest<HTMLElement>(
      '[data-testid="day-current-time-indicator"]',
    );
    const card = document.querySelector<HTMLElement>(
      '[data-testid="appointment-card-appointment-current-layer-260501"]',
    );

    if (!indicator || !card) {
      return { overlaps: false, topTestId: null };
    }

    const lineBox = line.getBoundingClientRect();
    const cardBox = card.getBoundingClientRect();
    const x = Math.max(lineBox.left, cardBox.left) + 12;
    const y = lineBox.top + lineBox.height / 2;
    const overlaps =
      x >= cardBox.left &&
      x <= cardBox.right &&
      y >= cardBox.top &&
      y <= cardBox.bottom;
    const previousPointerEvents = indicator.style.pointerEvents;

    indicator.style.pointerEvents = "auto";
    const topElement = document.elementFromPoint(x, y) as HTMLElement | null;
    indicator.style.pointerEvents = previousPointerEvents;

    return {
      overlaps,
      topTestId:
        topElement
          ?.closest<HTMLElement>("[data-testid]")
          ?.getAttribute("data-testid") ?? null,
    };
  });

  expect(layerCheck).toEqual({
    overlaps: true,
    topTestId: "day-current-time-indicator-line",
  });
});

test("reception day calendar initially centers the current-time marker", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 640 });
  await page.goto("/w/clair-demo/reception");

  const currentTimeDistanceFromCenter = async () =>
    page.getByTestId("day-current-time-indicator").evaluate((indicator) => {
      const viewport = indicator.closest<HTMLElement>(
        '[data-slot="scroll-area-viewport"]',
      );

      if (!viewport) return Number.POSITIVE_INFINITY;

      const viewportBox = viewport.getBoundingClientRect();
      const indicatorBox = indicator.getBoundingClientRect();
      const indicatorLineCenter = indicatorBox.top + indicator.clientHeight / 2;

      return Math.abs(
        indicatorLineCenter - (viewportBox.top + viewportBox.height / 2),
      );
    });
  await expect.poll(currentTimeDistanceFromCenter).toBeLessThanOrEqual(24);

  const scrollTop = await page
    .getByTestId("day-current-time-indicator")
    .evaluate((indicator) => {
      const viewport = indicator.closest<HTMLElement>(
        '[data-slot="scroll-area-viewport"]',
      );

      return viewport?.scrollTop ?? 0;
    });

  expect(scrollTop).toBeGreaterThan(20);
});

test("reception month calendar fills the available calendar height", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/w/clair-demo/reception");

  await page.getByRole("button", { name: "월", exact: true }).click();

  const calendar = page.getByTestId("reception-month-calendar");
  await expect(calendar).toBeVisible();

  const sizes = await calendar.evaluate((element) => {
    const viewport = element.closest('[data-slot="scroll-area-viewport"]');

    return {
      calendarHeight: element.getBoundingClientRect().height,
      viewportHeight: viewport?.getBoundingClientRect().height ?? 0,
    };
  });

  expect(sizes.calendarHeight).toBeGreaterThanOrEqual(sizes.viewportHeight - 1);
});

test("reception day calendar hides a lane from its ghost action without recoloring remaining lanes", async ({
  page,
}) => {
  await page.goto("/w/clair-demo/reception");

  const calendar = page.getByTestId("reception-day-calendar");
  const laneHeaderRow = calendar.getByTestId(
    "reception-day-calendar-lane-header",
  );
  const laneHeaders = calendar.getByTestId("veterinarian-lane-header");
  await expect.poll(() => laneHeaders.count()).toBeGreaterThan(1);
  const hiddenLaneHeader = laneHeaders.first();
  const retainedLaneHeader = laneHeaders.nth(1);
  const initialLaneCount = await laneHeaders.count();
  const retainedLaneBorderBefore = await retainedLaneHeader.evaluate((header) =>
    getComputedStyle(header).borderColor,
  );

  await hiddenLaneHeader.hover();
  const hideLaneButton = hiddenLaneHeader.getByRole("button", {
    name: "이수지 레인 숨기기",
  });

  await expect(hideLaneButton).toBeVisible();
  await expect
    .poll(() =>
      hideLaneButton.evaluate((button) => getComputedStyle(button).backgroundColor),
    )
    .toBe("rgba(0, 0, 0, 0)");

  await hideLaneButton.hover();
  await expect
    .poll(() =>
      hideLaneButton.evaluate((button) => getComputedStyle(button).backgroundColor),
    )
    .toBe("rgba(0, 0, 0, 0.04)");

  await hideLaneButton.click();

  await expect(laneHeaders).toHaveCount(initialLaneCount - 1);
  await expect(
    calendar
      .getByTestId("veterinarian-lane-header")
      .filter({ hasText: "김도윤" }),
  ).toHaveCount(1);
  await expect
    .poll(() =>
      laneHeaderRow.evaluate((row) =>
        getComputedStyle(row).gridTemplateColumns.split(" ").length,
      ),
    )
    .toBe(initialLaneCount);

  const retainedLaneBorderAfter = await calendar
    .getByTestId("veterinarian-lane-header")
    .filter({ hasText: "김도윤" })
    .evaluate((header) => getComputedStyle(header).borderColor);
  expect(retainedLaneBorderAfter).toBe(retainedLaneBorderBefore);
});

test("reception veterinarian selector controls visible schedule lanes", async ({
  page,
}) => {
  await page.goto("/w/clair-demo/reception");

  const calendar = page.getByTestId("reception-day-calendar");
  const scheduleToolbar = page.getByTestId("schedule-toolbar");

  await expect(
    calendar.getByText("이수지", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    calendar.getByText("김도윤", { exact: true }).first(),
  ).toBeVisible();

  const veterinarianButton = scheduleToolbar.getByRole("button", {
    name: "이수지 +9",
  });
  const todayShortcut = scheduleToolbar.getByRole("button", {
    name: "오늘 일자로 이동",
  });
  const calendarViewTabs = scheduleToolbar.getByRole("group", {
    name: "접수 캘린더 보기",
  });
  const [veterinarianBox, todayShortcutBox, calendarViewTabsBox] =
    await Promise.all([
      veterinarianButton.boundingBox(),
      todayShortcut.boundingBox(),
      calendarViewTabs.boundingBox(),
    ]);
  expect(veterinarianBox).not.toBeNull();
  expect(todayShortcutBox).not.toBeNull();
  expect(calendarViewTabsBox).not.toBeNull();
  expect(todayShortcutBox!.x).toBeGreaterThan(
    veterinarianBox!.x + veterinarianBox!.width,
  );
  expect(todayShortcutBox!.x + todayShortcutBox!.width).toBeLessThan(
    calendarViewTabsBox!.x,
  );
  await expect(async () => {
    await veterinarianButton.click();
    await expect(veterinarianButton).toHaveAttribute("aria-expanded", "true", {
      timeout: 1_000,
    });
  }).toPass();
  const veterinarianMenu = page.getByRole("menu");
  await expect(veterinarianMenu.getByText("오늘 근무 수의사")).toBeVisible();
  await expect(veterinarianMenu.getByText("그 외 수의사")).toBeVisible();
  await expect(page.getByRole("menuitemcheckbox")).toHaveCount(10);
  await page.getByRole("menuitemcheckbox", { name: "김도윤" }).click();
  await page.getByRole("menuitemcheckbox", { name: "박서연" }).click();

  await expect(page.getByRole("button", { name: "이수지 +7" })).toBeVisible();
  await expect(calendar.getByText("김도윤", { exact: true })).toHaveCount(0);
  await expect(calendar.getByText("박서연", { exact: true })).toHaveCount(0);
  await expect(
    page.getByTestId("appointment-card-appointment-nabi-260501"),
  ).toHaveCount(0);
});

test("reception cards open the reception detail drawer", async ({ page }) => {
  await page.goto("/w/clair-demo/reception");

  await page.getByTestId("appointment-card-appointment-nabi-260501").click();

  await expect(page.getByText("예약 상세").first()).toBeVisible();
  await expect(
    page.getByText("오세아 보호자 · 010-7812-4401 · 10:45 예약"),
  ).toBeVisible();
  await expect(page.getByLabel("소요시간")).toHaveValue("15분");
  await expect(
    page.getByRole("button", { name: "접수하기" }).last(),
  ).toBeVisible();
});

test("reception side panel cards keep order, open reception info, and clear selection on close", async ({
  page,
}) => {
  await page.goto("/w/clair-demo/reception");

  const sidePanel = page.locator("aside").first();
  const initialCardOrder = [
    "patient-card-patient-kong",
    "patient-card-patient-dubu",
    "patient-card-patient-coco",
    "patient-card-patient-nabi",
    "patient-card-patient-haru",
  ];
  await expect
    .poll(() =>
      sidePanel
        .locator('[data-testid^="patient-card-"]')
        .evaluateAll((cards) =>
          cards.map((card) => card.getAttribute("data-testid")),
        ),
    )
    .toEqual(initialCardOrder);
  const dubuCard = sidePanel.getByTestId("patient-card-patient-dubu");
  await dubuCard.click();
  await expect
    .poll(() =>
      sidePanel
        .locator('[data-testid^="patient-card-"]')
        .evaluateAll((cards) =>
          cards.map((card) => card.getAttribute("data-testid")),
        ),
    )
    .toEqual(initialCardOrder);
  const detailDrawer = page
    .getByRole("complementary")
    .filter({ hasText: "접수 상세" })
    .last();
  await expect(detailDrawer.getByText("접수 상세").first()).toBeVisible();
  await expect(dubuCard).toHaveAttribute("data-selected", "true");
  await page.getByRole("button", { name: "상세 닫기" }).click();
  await expect(dubuCard).not.toHaveAttribute("data-selected", "true");
});

test("patient drawer supports editing and guardian navigation", async ({
  page,
}) => {
  await page.goto(
    "/w/clair-demo/reception?drawer=reception-patient:patient-dubu",
  );

  await expect(page.getByText("환자 정보")).toBeVisible();
  await expect(page.getByText("보호자 연결")).toBeVisible();
  await expect(page.getByText("정하린", { exact: true }).last()).toBeVisible();
  await expect(
    page.getByRole("button", { name: "보호자 강서윤 보기" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "수정" }).click();
  const breedInput = page.getByRole("textbox", { name: "품종" });
  await breedInput.fill("포메");
  await page.getByRole("option", { name: "포메라니안" }).click();
  await page.getByRole("button", { name: "저장" }).click();
  await expect(breedInput).toHaveValue("포메라니안");

  await page.getByRole("button", { name: "보호자 강서윤 보기" }).click();

  await expect(page.getByText("보호자 정보").first()).toBeVisible();
  await expect(page.getByText("연결 환자").last()).toBeVisible();
  await expect(page.getByText("하루", { exact: true }).last()).toBeVisible();
  await expect(page.getByText("두부", { exact: true }).last()).toBeVisible();
});

test("patient drawer shows CS history and latest shortcuts", async ({
  page,
}) => {
  await page.goto(
    "/w/clair-demo/reception?drawer=reception-patient:patient-coco",
  );

  await page.getByRole("button", { name: "CS 이력" }).click();
  await expect(page.getByText("접수 문의")).toBeVisible();
  await page.getByRole("button", { name: "KakaoTalk" }).click();
  await expect(page.getByText("검사 결과 안내")).toBeVisible();

  await page.getByRole("button", { name: "최신내역" }).click();
  await expect(page.getByText("최근 조제")).toBeVisible();
  await expect(page.getByText("최근 검사")).toBeVisible();
});

test("patient guardian registration creates a new guardian and patient after confirmation", async ({
  page,
}) => {
  await page.goto("/w/clair-demo/reception");

  const sidePanel = page.locator("aside").first();

  await expect(
    sidePanel.getByRole("button", { name: "신규 환자" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "신규 접수/등록", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "환자/보호자 등록", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "환자/보호자 등록", exact: true })
    .click();
  await expect(
    page.getByRole("menuitem", { name: "신규 환자/보호자 등록" }),
  ).toBeVisible();
  await expect(
    page.getByRole("menuitem", { name: "기존 보호자에 환자 추가" }),
  ).toBeVisible();
  await page
    .getByRole("menuitem", { name: "신규 환자/보호자 등록" })
    .click();

  await expect(
    page.getByRole("heading", { name: "신규 보호자 등록" }),
  ).toBeVisible();
  await expect(page.getByText("1/2 보호자")).toBeVisible();
  await page.getByRole("button", { name: "다음" }).click();
  await expect(page.getByText("보호자명은 필수입니다.")).toBeVisible();
  await page.getByLabel("보호자명").fill("김새봄");
  await page.getByLabel("보호자 생년월일").fill("19931340");
  await expect(page.getByLabel("보호자 생년월일")).toHaveValue("1993-13-40");
  await page.getByLabel("보호자 휴대전화").fill("010-2222-3333");
  await page.getByRole("button", { name: "다음" }).click();
  await expect(
    page.getByText("생년월일은 YYYY-MM-DD 형식의 실제 날짜로 입력해 주세요."),
  ).toBeVisible();
  await page.getByLabel("보호자 생년월일").fill("19931123");
  await expect(page.getByLabel("보호자 생년월일")).toHaveValue("1993-11-23");
  await page.getByRole("button", { name: "다음" }).click();
  await expect(
    page.getByText("개인정보 수집 동의가 필요합니다."),
  ).toBeVisible();
  await page.getByRole("button", { name: "태블릿 서명 요청" }).click();
  await page.getByRole("button", { name: "서명 완료 처리" }).click();
  await page.getByRole("button", { name: "다음" }).click();

  await expect(
    page.getByRole("heading", { name: "신규 환자 등록" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "다음" }).click();
  await expect(page.getByText("환자명은 필수입니다.")).toBeVisible();
  await page.getByLabel("환자명").fill("새롬");
  await page.getByRole("combobox", { name: "종" }).click();
  await expect(page.getByRole("option", { name: "토끼" })).toBeVisible();
  await expect(page.getByRole("option", { name: "페럿" })).toBeVisible();
  await expect(page.getByRole("option", { name: "햄스터" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("combobox", { name: "성별" }).click();
  await page.getByRole("option", { name: "중성화 수컷" }).click();
  await page.getByLabel("품종").fill("푸");
  await page.getByRole("option", { name: "푸들" }).click();
  await page.getByLabel("나이 년").fill("2");
  await expect(page.getByLabel("나이 년").locator("..")).toContainText("년");
  await expect(page.getByLabel("나이 개월").locator("..")).toContainText("개월");
  await expect(page.getByText("개인정보 동의")).toHaveCount(0);
  await page.getByRole("button", { name: "다음" }).click();

  await expect(
    page.getByRole("heading", { name: "등록 정보 확인" }),
  ).toBeVisible();
  await expect(page.getByText("김새봄")).toBeVisible();
  await expect(page.getByText("새롬")).toBeVisible();
  await page.getByRole("button", { name: "등록" }).click();

  await expect(
    page.getByText("환자/보호자 등록이 완료되었습니다."),
  ).toBeVisible();
  await expect(page.getByTestId("walk-in-reception-dialog")).toHaveCount(0);
});

test("patient guardian registration dialogs keep dim backdrop without zoom motion", async ({
  page,
}) => {
  test.setTimeout(60_000);

  const registrationOptions = [
    {
      heading: "신규 보호자 등록",
      menuItem: "신규 환자/보호자 등록",
    },
    {
      heading: "기존 보호자에 신규 환자 등록",
      menuItem: "기존 보호자에 환자 추가",
    },
  ];
  const closePaths: {
    name: string;
    close: (page: Page, dialog: Locator) => Promise<void>;
  }[] = [
    {
      name: "close button",
      close: async (page) => {
        await page.getByRole("button", { name: "환자/보호자 창 닫기" }).click();
      },
    },
    {
      name: "cancel button",
      close: async (_page, dialog) => {
        await dialog.getByRole("button", { name: "취소" }).click();
      },
    },
    {
      name: "outside click",
      close: async (page) => {
        await page.locator('[data-slot="dialog-overlay"]').first().click({
          position: { x: 16, y: 16 },
        });
      },
    },
  ];

  for (const registrationOption of registrationOptions) {
    for (const closePath of closePaths) {
      await test.step(`${registrationOption.menuItem} - ${closePath.name}`, async () => {
        await page.goto("/w/workspace-clair-cheongdam/reception?modulePanel=open");
        await page
          .getByRole("button", { name: "환자/보호자 등록", exact: true })
          .click();
        await page
          .getByRole("menuitem", {
            name: registrationOption.menuItem,
            exact: true,
          })
          .click();

        const registrationDialog = page
          .locator('[data-slot="dialog-content"]')
          .filter({ hasText: registrationOption.heading })
          .last();

        await expect(
          page.getByRole("heading", { name: registrationOption.heading }),
        ).toBeVisible();
        await expectRegistrationDialogsWithDimAndWithoutZoom(page);

        await closePath.close(page, registrationDialog);
        await expect(
          page.getByRole("dialog", { name: "입력을 취소할까요?" }),
        ).toBeVisible();
        await expectRegistrationDialogsWithDimAndWithoutZoom(page);

        await page.getByRole("button", { name: "취소하고 나가기" }).click();
        await expect(page.locator('[data-slot="dialog-content"]')).toHaveCount(0);
      });
    }
  }
});

test("server-backed patient guardian registration sends minimal reception payload", async ({
  page,
}) => {
  let capturedBody: Record<string, unknown> | null = null;
  await mockKakaoPostcodeSearch(page, {
    address: "서울 강남구 테헤란로 152",
    autoJibunAddress: "",
    autoRoadAddress: "",
    jibunAddress: "서울 강남구 역삼동 737",
    roadAddress: "서울 강남구 테헤란로 152",
    userSelectedType: "R",
    zonecode: "06000",
  });

  await page.route(
    "**/api/workspaces/clair-demo/reception/patient-guardian-registration",
    async (route) => {
      capturedBody = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          workspaceId: "clair-demo",
          registration: {
            guardian: {
              id: "guardian-live-saebom",
              workspaceId: "clair-demo",
              name: "김새봄",
              mobilePhone: "010-2222-3333",
              createdAt: "2026-05-19T00:00:00.000Z",
              updatedAt: "2026-05-01T10:50:00+09:00",
            },
            patient: {
              id: "patient-live-saerom",
              workspaceId: "clair-demo",
              patientNo: "P-LIVE-0002",
              name: "새롬",
              species: "dog",
              breed: "푸들",
              estimatedAgeText: "2년",
              sex: "male",
              neutered: true,
              handlingCautionLocked: true,
              status: "active",
              createdAt: "2026-05-19T00:00:00.000Z",
              updatedAt: "2026-05-01T10:50:00+09:00",
            },
            patientGuardian: {
              id: "pg-live-saerom",
              patientId: "patient-live-saerom",
              guardianId: "guardian-live-saebom",
              relationship: "주보호자",
              isPrimary: true,
              canReceiveMessages: true,
              createdAt: "2026-05-19T00:00:00.000Z",
            },
            consents: [
              {
                id: "consent-live-privacy",
                workspaceId: "clair-demo",
                guardianId: "guardian-live-saebom",
                consentType: "privacy",
                status: "granted",
                signedAt: "2026-05-19T00:00:00.000Z",
              },
            ],
          },
          enforcedBy: "reception-patient-guardian-registration",
        }),
      });
    },
  );

  await page.goto("/w/clair-demo/reception");
  await page
    .getByRole("button", { name: "환자/보호자 등록", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "신규 환자/보호자 등록" })
    .click();
  const registrationDialog = page.getByRole("dialog", { name: "신규 보호자 등록" });
  await page.getByLabel("보호자명").fill("김새봄");
  await page.getByLabel("보호자 생년월일").fill("19931123");
  await page.getByLabel("보호자 휴대전화").fill("010-2222-3333");
  await registrationDialog.getByRole("button", { name: "주소 검색" }).click();
  await expect(registrationDialog.getByLabel("우편번호")).toHaveValue("06000");
  await expect(registrationDialog.getByLabel("기본 주소")).toHaveValue(
    "서울 강남구 테헤란로 152",
  );
  await registrationDialog.getByLabel("상세 주소").fill("5층");
  await page.getByRole("button", { name: "태블릿 서명 요청" }).click();
  await page.getByRole("button", { name: "서명 완료 처리" }).click();
  await page.getByRole("button", { name: "다음" }).click();
  await page.getByLabel("환자명").fill("새롬");
  await page.getByLabel("품종").fill("푸");
  await page.getByRole("option", { name: "푸들" }).click();
  await page.getByLabel("나이 년").fill("2");
  await page.getByRole("combobox", { name: "성별" }).click();
  await page.getByRole("option", { name: "중성화 수컷" }).click();
  await page.getByRole("button", { name: "다음" }).click();
  await page.getByRole("button", { name: "등록" }).click();

  await expect(
    page.getByText("환자/보호자 등록이 완료되었습니다."),
  ).toBeVisible();
  expect(capturedBody).toMatchObject({
    mode: "new_guardian_patient",
    guardian: {
      address: "(06000) 서울 강남구 테헤란로 152 5층",
      name: "김새봄",
      mobilePhone: "010-2222-3333",
      privacyConsent: true,
    },
    patient: {
      name: "새롬",
      species: "dog",
      breed: "푸들",
      estimatedAgeText: "2년",
      sex: "male",
      neutered: true,
    },
  });
});

test("patient guardian registration links an existing guardian to a new patient", async ({
  page,
}) => {
  await page.goto("/w/clair-demo/reception");

  await page
    .getByRole("button", { name: "환자/보호자 등록", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "기존 보호자에 환자 추가" })
    .click();
  await expect(
    page.getByRole("heading", { name: "기존 보호자에 신규 환자 등록" }),
  ).toBeVisible();
  await expect(
    page.getByText("입력한 정보는 최종 확인 후 등록됩니다."),
  ).toHaveCount(0);
  await expect(page.getByText("보호자 선택")).toBeVisible();
  await expect(page.getByText("환자 정보")).toBeVisible();
  await expect(page.getByRole("button", { name: "다음" })).toBeDisabled();
  await page.getByLabel("기존 보호자 검색").fill("오세아");
  await page.getByRole("option", { name: /오세아/ }).click();
  await expect(page.getByRole("button", { name: "다음" })).toBeDisabled();

  const registrationDialog = page.getByLabel("기존 보호자에 신규 환자 등록");
  await expect(page.getByLabel("기존 보호자 검색")).toHaveValue(
    "오세아 010-7812-4401 · 나비",
  );
  await expect(registrationDialog).toContainText("오세아");
  await expect(page.getByText("오세아 보호자의 동물")).toBeVisible();
  await expect(
    registrationDialog.getByText("나비", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("환자명").fill("라떼");
  await page.getByLabel("품종").fill("말티");
  await page.getByRole("option", { name: "말티즈" }).click();
  await page.getByText("믹스", { exact: true }).click();
  await page.getByLabel("추가 품종").fill("푸");
  await page.getByRole("option", { name: "푸들" }).click();
  await page.getByLabel("추가 품종").fill("치");
  await page.getByRole("option", { name: "치와와" }).click();
  await expect(page.getByText("푸들")).toBeVisible();
  await expect(page.getByText("치와와")).toBeVisible();
  await page.getByLabel("나이 개월").fill("8");
  await page.getByLabel("동물등록번호").fill("410-2026-00001");
  await expect(page.getByRole("button", { name: "다음" })).toBeEnabled();
  await page.getByRole("button", { name: "다음" }).click();
  await expect(
    page.getByRole("heading", { name: "등록 정보 확인" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "등록" }).click();

  await expect(page.getByText("환자 등록이 완료되었습니다.")).toBeVisible();
});

test("guardian registration dialog aligns CDS V2 label and field columns", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/w/clair-demo/reception");

  await page
    .getByRole("button", { name: "환자/보호자 등록", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "신규 환자/보호자 등록" })
    .click();

  const dialog = page.getByRole("dialog", { name: "신규 보호자 등록" });
  await expect(dialog).toBeVisible();
  await dialog.evaluate((element) =>
    Promise.all(
      element
        .getAnimations({ subtree: true })
        .map((animation) => animation.finished.catch(() => undefined)),
    ),
  );

  const metrics = await dialog.evaluate((element) => {
    const dialogRect = element.getBoundingClientRect();
    const dialogStyle = getComputedStyle(element);
    const round = (value: number) => Math.round(value);
    const normalizeLabelText = (value: string | undefined) =>
      value?.replace(/\*/g, "").trim();
    const getByLabelText = (text: string) =>
      [...element.querySelectorAll("label")].find(
        (label) => normalizeLabelText(label.textContent ?? undefined) === text,
      );
    const getByPlaceholder = (placeholder: string) =>
      [...element.querySelectorAll("input, textarea")].find(
        (control) => control.getAttribute("placeholder") === placeholder,
      );
    const getByButtonText = (text: string) =>
      [...element.querySelectorAll("button")].find(
        (button) => button.textContent?.trim() === text,
      );
    const closeButton = element.querySelector(
      'button[aria-label="환자/보호자 창 닫기"]',
    );
    const title = element.querySelector('[data-slot="dialog-title"]');
    const rect = (target: Element | undefined) => {
      if (!target) return null;
      const targetRect = target.getBoundingClientRect();

      return {
        h: round(targetRect.height),
        relX: round(targetRect.left - dialogRect.left),
        relY: round(targetRect.top - dialogRect.top),
        right: round(dialogRect.right - targetRect.right),
        w: round(targetRect.width),
      };
    };
    const textStyle = (target: Element | null) => {
      if (!target) return null;
      const style = getComputedStyle(target);

      return {
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        letterSpacing: style.letterSpacing,
        lineHeight: style.lineHeight,
      };
    };

    return {
      addressButton: rect(getByButtonText("주소 검색")),
      closeButton: rect(closeButton ?? undefined),
      dialog: {
        centerX: round(dialogRect.left + dialogRect.width / 2),
        centerY: round(dialogRect.top + dialogRect.height / 2),
        h: round(Number.parseFloat(dialogStyle.height)),
        viewportCenterX: round(window.innerWidth / 2),
        viewportCenterY: round(window.innerHeight / 2),
        w: round(Number.parseFloat(dialogStyle.width)),
      },
      iconCount: element.querySelectorAll("label svg").length,
      label: rect(getByLabelText("보호자명")),
      memoTextarea: rect(getByPlaceholder("특이사항 및 요청사항 입력")),
      nameInput: rect(getByPlaceholder("이름을 입력해주세요")),
      signatureButton: rect(getByButtonText("태블릿 서명 요청")),
      title: textStyle(title),
    };
  });

  expect(metrics).toMatchObject({
    addressButton: { h: 32, relX: 343, w: 81 },
    closeButton: { h: 32, relY: 10, right: 10, w: 32 },
    dialog: {
      centerX: 960,
      centerY: 540,
      h: 714,
      viewportCenterX: 960,
      viewportCenterY: 540,
      w: 440,
    },
    iconCount: 7,
    label: { h: 32, relX: 16, w: 128 },
    memoTextarea: { h: 76, relX: 156, w: 268 },
    nameInput: { h: 32, relX: 156, w: 268 },
    signatureButton: { h: 32, relX: 156, w: 122 },
    title: {
      fontSize: "16px",
      fontWeight: "600",
      letterSpacing: "normal",
      lineHeight: "24px",
    },
  });
});

test("registration and reception create side panels use CDS V2 32px controls", async ({
  page,
}) => {
  await page.goto("/w/clair-demo/reception");

  await page
    .getByRole("button", { name: "환자/보호자 등록", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "기존 보호자에 환자 추가" })
    .click();
  const registrationDialog = page.getByLabel("기존 보호자에 신규 환자 등록");
  await expect(registrationDialog.getByText("환자 정보")).toBeVisible();

  const registrationControlHeights = await Promise.all(
    [
      registrationDialog.getByLabel("환자명"),
      registrationDialog.getByRole("combobox", { name: "종" }),
      registrationDialog.getByLabel("품종"),
      registrationDialog.getByRole("combobox", { name: "성별" }),
    ].map((control) =>
      control.evaluate((element) =>
        Math.round(element.getBoundingClientRect().height),
      ),
    ),
  );
  expect(registrationControlHeights).toEqual([32, 32, 32, 32]);

  await page.goto("/w/clair-demo/reception");
  await openWalkInReceptionForm(page);
  const walkInForm = page.getByTestId("walk-in-reception-dialog");
  await expect(walkInForm).toBeVisible();

  const walkInControlHeights = await Promise.all(
    [
      walkInForm.getByLabel("환자 검색"),
      walkInForm.getByLabel("체중"),
      walkInForm.getByRole("combobox", { name: "진료과" }),
      walkInForm.getByRole("combobox", { name: "담당의" }),
      walkInForm.getByLabel("접수일"),
      walkInForm.getByLabel("접수시간"),
      walkInForm.getByRole("combobox", { name: "예상소요시간" }),
    ].map((control) =>
      control.evaluate((element) =>
        Math.round(element.getBoundingClientRect().height),
      ),
    ),
  );
  expect(walkInControlHeights).toEqual([32, 32, 32, 32, 32, 32, 32]);
  await expect(walkInForm.getByLabel("방문목적")).not.toHaveCSS(
    "height",
    "36px",
  );
  await expect(walkInForm.getByLabel("접수 메모")).not.toHaveCSS(
    "height",
    "36px",
  );

  await page.goto(
    "/w/clair-demo/reception?modulePanel=open&right=open&drawer=reception-reservation-form%3Anew",
  );
  const reservationDrawer = page.getByTestId("reservation-create-drawer");
  await expect(reservationDrawer).toBeVisible();

  const reservationControlHeights = await Promise.all(
    [
      reservationDrawer.getByLabel("환자 검색"),
      reservationDrawer.getByLabel("체중"),
      reservationDrawer.getByLabel("예약일"),
      reservationDrawer.getByRole("combobox", { name: "담당의" }),
      reservationDrawer.getByRole("combobox", { name: "예약시간" }),
      reservationDrawer.getByRole("combobox", { name: "예상소요시간" }),
    ].map((control) =>
      control.evaluate((element) =>
        Math.round(element.getBoundingClientRect().height),
      ),
    ),
  );
  expect(reservationControlHeights).toEqual([32, 32, 32, 32, 32, 32]);
  await expect(
    reservationDrawer.getByRole("button", { name: "바이탈 추가" }),
  ).toBeDisabled();
  await expect(reservationDrawer.getByRole("combobox", { name: "담당의" })).toContainText(
    "담당의를 선택해주세요",
  );
  await expect(reservationDrawer.getByLabel("예약 메모")).not.toHaveCSS(
    "height",
    "36px",
  );
});

test("walk-in reception drawer removes helper chrome and keeps focused placeholders", async ({
  page,
}) => {
  await page.goto("/w/workspace-clair-cheongdam/reception?modulePanel=open");

  await openWalkInReceptionForm(page);

  const panel = page.getByTestId("reception-right-panel");
  const walkInForm = page.getByTestId("walk-in-reception-dialog");
  await expect(panel).toBeVisible();
  await expect(page.getByTestId("workspace-drawer")).toHaveCount(0);
  await expect(walkInForm).toBeVisible();
  await expect(panel.getByText("walk-in", { exact: true })).toHaveCount(0);
  await expect(walkInForm.getByText("진료 접수")).toHaveCount(0);
  await expect(
    walkInForm.getByText("환자 선택 후 당일 접수를 생성합니다."),
  ).toHaveCount(0);
  await expect(
    walkInForm.getByText("환자명, 동물 정보, 보호자명으로 검색합니다."),
  ).toHaveCount(0);
  await expect(walkInForm.getByLabel("방문목적")).toHaveAttribute(
    "placeholder",
    "방문목적을 입력해주세요",
  );

  await expect(
    walkInForm.getByRole("button", { name: "카카오톡 발송" }),
  ).toHaveCount(0);
  await expect(walkInForm.getByRole("combobox", { name: "진료과" })).toContainText(
    "진료과를 선택해주세요",
  );
  await expect(walkInForm.getByRole("combobox", { name: "담당의" })).toContainText(
    "담당의를 선택해주세요",
  );
});

test("patient guardian registration blocks duplicate microchips and warns duplicate patient names", async ({
  page,
}) => {
  await page.goto("/w/clair-demo/reception");

  await page
    .getByRole("button", { name: "환자/보호자 등록", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "기존 보호자에 환자 추가" })
    .click();
  await page.getByLabel("기존 보호자 검색").fill("이지은");
  await page.getByRole("option", { name: /이지은/ }).click();
  await page.getByLabel("환자명").fill("코코");
  await expect(
    page.getByText(
      "동일 보호자 아래 같은 이름의 동물이 이미 등록되어 있습니다.",
    ),
  ).toBeVisible();
  await page.getByLabel("품종").fill("푸");
  await page.getByRole("option", { name: "푸들" }).click();
  await page.getByLabel("나이 년").fill("2");
  await page.getByLabel("마이크로칩").fill("410098765432109");
  await page.getByRole("button", { name: "다음" }).click();

  await expect(
    page.getByText("이미 등록된 마이크로칩 번호입니다.").first(),
  ).toBeVisible();
});

test("patient guardian registration asks before leaving dirty drafts", async ({
  page,
}) => {
  await page.goto("/w/clair-demo/reception");

  await page
    .getByRole("button", { name: "환자/보호자 등록", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "신규 환자/보호자 등록" })
    .click();
  await page.getByLabel("보호자명").fill("임시보호자");
  await page.getByRole("button", { exact: true, name: "취소" }).click();

  await expect(
    page.getByRole("heading", { name: "입력을 취소할까요?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "계속 작성" }).click();
  await expect(page.getByLabel("보호자명")).toHaveValue("임시보호자");
  await page.getByRole("button", { exact: true, name: "취소" }).click();
  await page.getByRole("button", { name: "취소하고 나가기" }).click();
  await expect(
    page.getByRole("heading", { name: "신규 보호자 등록" }),
  ).toHaveCount(0);
});

test("nav rail maps menu labels to the intended modules", async ({ page }) => {
  await page.goto("/w/clair-demo/reception");

  await expect(page.getByRole("link", { name: "접수/예약" })).toHaveAttribute(
    "href",
    /^\/w\/clair-demo\/reception(?:\?.*)?$/,
  );
  await expect(page.getByRole("link", { name: "진료/차트" })).toHaveAttribute(
    "href",
    /^\/w\/clair-demo\/treatment(?:\?.*)?$/,
  );
  await expect(
    page.getByRole("link", { name: "임상병리검사" }),
  ).toHaveAttribute("href", /^\/w\/clair-demo\/lab(?:\?.*)?$/);
  await expect(page.getByRole("link", { name: "영상검사" })).toHaveAttribute(
    "href",
    /^\/w\/clair-demo\/imaging(?:\?.*)?$/,
  );
  await expect(page.getByRole("link", { name: "조제/처치" })).toHaveAttribute(
    "href",
    /^\/w\/clair-demo\/dispensing(?:\?.*)?$/,
  );
  await expect(page.getByRole("link", { name: "수납" })).toHaveAttribute(
    "href",
    /^\/w\/clair-demo\/billing(?:\?.*)?$/,
  );
  await expect(page.getByRole("link", { name: "입원" })).toHaveAttribute(
    "href",
    /^\/w\/clair-demo\/inpatient(?:\?.*)?$/,
  );
  await expect(page.getByRole("link", { name: "고객관리" })).toHaveAttribute(
    "href",
    /^\/w\/clair-demo\/customer(?:\?.*)?$/,
  );
  await expect(page.getByRole("link", { name: "병원관리" })).toHaveAttribute(
    "href",
    /^\/w\/clair-demo\/orders(?:\?.*)?$/,
  );
});

test("reception side panel searches by patient and guardian context", async ({
  page,
}) => {
  await page.goto("/w/clair-demo/reception");

  const sidePanel = page
    .getByRole("complementary")
    .filter({ hasText: "접수/예약" })
    .first();
  await sidePanel.getByRole("button", { name: "검색" }).click();
  await sidePanel.getByRole("searchbox", { name: "대기열 검색" }).fill("코코");

  await expect(
    sidePanel.getByTestId("patient-card-patient-coco"),
  ).toBeVisible();
  await expect(
    sidePanel.getByTestId("patient-card-patient-coco"),
  ).toContainText("이지은");
  await expect(sidePanel.getByTestId("patient-card-patient-nabi")).toBeHidden();
  await sidePanel.getByRole("button", { name: "대기열 검색 닫기" }).click();
  await expect(
    sidePanel.getByRole("searchbox", { name: "대기열 검색" }),
  ).toHaveCount(0);
  await expect(
    sidePanel.getByTestId("patient-card-patient-kong"),
  ).toBeVisible();
});

test("reception card action menu exposes unavailable feedback and closes on Escape", async ({
  page,
}) => {
  await page.goto("/w/clair-demo/reception");

  const card = page.getByTestId("patient-card-patient-coco");
  const actionButton = card.getByRole("button", { name: "코코 카드 작업" });
  await expect
    .poll(() =>
      actionButton.evaluate((button) => getComputedStyle(button).opacity),
    )
    .toBe("0");
  await actionButton.evaluate((button) => button.focus());
  await expect
    .poll(() =>
      actionButton.evaluate((button) => getComputedStyle(button).opacity),
    )
    .toBe("1");
  await actionButton.click();
  await expect(page.getByRole("menu")).toContainText("차트 보러가기");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);

  await card.hover();
  await actionButton.click();
  await page.getByText("카카오톡 발송", { exact: true }).click();
  await expect(
    page.getByTestId("reception-card-action-feedback"),
  ).toContainText("카카오톡 발송은 아직 연결되지 않았어");
  await expect(page.getByRole("menu")).toHaveCount(0);
});

test("reception side-panel card action menu uses compact single-line actions", async ({
  page,
}) => {
  await page.goto("/w/clair-demo/reception");

  const card = page.getByTestId("patient-card-patient-coco");
  const actionButton = card.getByRole("button", { name: "코코 카드 작업" });
  await actionButton.evaluate((button) => button.focus());
  await actionButton.click();

  const actionMenu = page.getByRole("menu");
  await expect(actionMenu).not.toContainText("현재 drawer 열기");
  await expect(actionMenu).not.toContainText("진료/차트 탭에서 열기");
  const actionMenuItems = actionMenu.getByRole("menuitem");
  await expect(actionMenuItems).toHaveCount(2);
  const openAction = actionMenu.getByRole("menuitem", {
    name: "접수 상세 보기",
  });
  const chartAction = actionMenu.getByRole("menuitem", { name: "차트 보러가기" });
  await expect(openAction).toHaveCount(1);
  await expect(chartAction).toHaveCount(1);
  await expect(openAction).toHaveCSS("height", "32px");
  await expect(chartAction).toHaveCSS("height", "32px");
  await page.keyboard.press("Escape");
  await expect(actionMenu).toHaveCount(0);
});

test("server-backed reception queue read hydrates the side panel from persisted encounters", async ({
  page,
}) => {
  let requested = false;

  await page.route("**/reception/queue**", async (route) => {
    requested = true;
    expect(route.request().method()).toBe("GET");
    const requestedDate =
      new URL(route.request().url()).searchParams.get("date") ?? "2026-05-01";
    const requestedStartedAt = `${requestedDate}T09:25:00+09:00`;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        status: 200,
        queue: [
          {
            kind: "encounter_queue",
            encounter: {
              id: "encounter-live-queue-coco",
              workspaceId: "clair-demo",
              patientId: "patient-coco",
              guardianId: "guardian-lee-jieun",
              primaryVeterinarianId: "user-vet-doyun",
              encounterNo: "E-LIVE-QUEUE-0001",
              receptionType: "walk_in",
              department: "내과",
              durationMinutes: 30,
              chiefComplaint: "DEN-62 persisted queue read",
              visitPurpose: "DEN-62 persisted queue read",
              receptionMemo: "서버 대기열 read boundary",
              status: "waiting",
              checkedInAt: requestedStartedAt,
              createdAt: requestedStartedAt,
              updatedAt: requestedStartedAt,
            },
            queueEntry: {
              id: "queue-live-queue-coco",
              workspaceId: "clair-demo",
              encounterId: "encounter-live-queue-coco",
              queueType: "consultation",
              status: "waiting",
              priority: "normal",
              sortOrder: 1,
              enteredAt: requestedStartedAt,
            },
          },
        ],
        enforcedBy: "reception-queue-read",
      }),
    });
  });

  await page.goto("/w/clair-demo/reception");

  await expect.poll(() => requested).toBe(true);
  const persistedQueueCard = page
    .getByTestId("patient-card-patient-coco")
    .filter({ hasText: "DEN-62 persisted queue read" });
  await expect(persistedQueueCard).toContainText("DEN-62 persisted queue read");
  await expect(persistedQueueCard).toContainText("김도윤");
});

test("server-backed reception day calendar read hydrates appointments and walk-ins", async ({
  page,
}) => {
  let requested = false;

  await page.route("**/reception/calendar/day**", async (route) => {
    requested = true;
    expect(route.request().method()).toBe("GET");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        status: 200,
        workspaceId: "clair-demo",
        date: "2026-05-01",
        records: [
          {
            appointment: {
              id: "appointment-den63-coco",
              workspaceId: "clair-demo",
              patientId: "patient-live-choco-den63",
              guardianId: "guardian-live-dohyun-den63",
              assignedVeterinarianId: "user-vet-suji",
              scheduledStartAt: "2026-05-01T09:10:00+09:00",
              scheduledEndAt: "2026-05-01T09:30:00+09:00",
              visitPurpose: "DEN-63 persisted appointment",
              symptomNote: "DEN-63 calendar appointment detail",
              status: "confirmed",
              createdAt: "2026-05-01T08:00:00+09:00",
              updatedAt: "2026-05-01T08:00:00+09:00",
            },
            patient: {
              id: "patient-live-choco-den63",
              workspaceId: "clair-demo",
              patientNo: "P-LIVE-DEN63",
              name: "초코",
              species: "dog",
              breed: "Maltese",
              sex: "male",
              handlingCautionLocked: true,
              status: "active",
              createdAt: "2026-05-01T00:00:00+09:00",
              updatedAt: "2026-05-01T00:00:00+09:00",
            },
            primaryGuardian: {
              id: "guardian-live-dohyun-den63",
              workspaceId: "clair-demo",
              name: "최도현",
              mobilePhone: "010-4911-0004",
              createdAt: "2026-05-01T00:00:00+09:00",
              updatedAt: "2026-05-01T00:00:00+09:00",
            },
          },
          {
            encounter: {
              id: "encounter-den63-walkin-nabi",
              workspaceId: "clair-demo",
              patientId: "patient-nabi",
              guardianId: "guardian-oh-sea",
              primaryVeterinarianId: "user-vet-doyun",
              encounterNo: "E-DEN63-0001",
              receptionType: "walk_in",
              durationMinutes: 20,
              chiefComplaint: "DEN-63 persisted walk-in",
              visitPurpose: "DEN-63 persisted walk-in",
              status: "waiting",
              checkedInAt: "2026-05-01T10:15:00+09:00",
              createdAt: "2026-05-01T10:15:00+09:00",
              updatedAt: "2026-05-01T10:15:00+09:00",
            },
            queueEntry: {
              id: "queue-den63-walkin-nabi",
              workspaceId: "clair-demo",
              encounterId: "encounter-den63-walkin-nabi",
              queueType: "consultation",
              status: "waiting",
              priority: "normal",
              sortOrder: 1,
              enteredAt: "2026-05-01T10:15:00+09:00",
            },
          },
        ],
        enforcedBy: "reception-calendar-read",
      }),
    });
  });

  await page.goto("/w/clair-demo/reception");

  await expect.poll(() => requested).toBe(true);
  await expect(
    page.getByTestId("appointment-card-appointment-den63-coco"),
  ).toContainText("초코");
  await expect(
    page.getByTestId("appointment-card-appointment-den63-coco"),
  ).toContainText("최도현");
  await expect(
    page.getByTestId("walkin-card-encounter-den63-walkin-nabi"),
  ).toContainText("나비");
  await expect(
    page.getByTestId("walkin-card-encounter-den63-walkin-nabi"),
  ).toContainText("오세아");
});

test("reception calendar card summaries show only visit purpose or reservation memo", async ({
  page,
}) => {
  let requested = false;

  await page.route("**/reception/calendar/day**", async (route) => {
    requested = true;
    const date = new URL(route.request().url()).searchParams.get("date");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        status: 200,
        workspaceId: "clair-demo",
        date,
        records: [
          {
            encounter: {
              id: "encounter-calendar-summary",
              workspaceId: "clair-demo",
              patientId: "patient-nabi",
              guardianId: "guardian-oh-sea",
              primaryVeterinarianId: "user-vet-suji",
              encounterNo: "E-SUMMARY-001",
              receptionType: "walk_in",
              department: "영상의학과 · 방사선종양학과",
              durationMinutes: 90,
              chiefComplaint: "방문 목적 텍스트 에어리어 내용",
              visitPurpose: "방문 목적 텍스트 에어리어 내용",
              receptionMemo: "접수 메모는 캘린더 카드에서 숨김",
              status: "waiting",
              checkedInAt: "2026-05-01T15:00:00+09:00",
              createdAt: "2026-05-01T15:00:00+09:00",
              updatedAt: "2026-05-01T15:00:00+09:00",
            },
            patient: {
              id: "patient-nabi",
              workspaceId: "clair-demo",
              patientNo: "P-260414-0002",
              name: "나비",
              species: "cat",
              breed: "Korean Shorthair",
              sex: "female",
              handlingCautionLocked: false,
              status: "active",
              createdAt: "2026-04-01T00:00:00+09:00",
              updatedAt: "2026-04-01T00:00:00+09:00",
            },
            primaryGuardian: {
              id: "guardian-oh-sea",
              workspaceId: "clair-demo",
              name: "오세아",
              mobilePhone: "010-2000-0002",
              createdAt: "2026-04-01T00:00:00+09:00",
              updatedAt: "2026-04-01T00:00:00+09:00",
            },
            queueEntry: {
              id: "queue-calendar-summary",
              workspaceId: "clair-demo",
              encounterId: "encounter-calendar-summary",
              queueType: "consultation",
              status: "waiting",
              priority: "normal",
              sortOrder: 1,
              enteredAt: "2026-05-01T15:00:00+09:00",
            },
          },
          {
            appointment: {
              id: "appointment-calendar-summary",
              workspaceId: "clair-demo",
              patientId: "patient-coco",
              guardianId: "guardian-lee-jieun",
              assignedVeterinarianId: "user-vet-suji",
              scheduledStartAt: "2026-05-01T17:00:00+09:00",
              scheduledEndAt: "2026-05-01T18:30:00+09:00",
              visitPurpose: "예약 메모 텍스트 에어리어 내용",
              symptomNote: "증상 상세는 예약 카드에서 숨김",
              status: "confirmed",
              createdByUserId: "user-desk-yuna",
              createdAt: "2026-05-01T16:40:00+09:00",
              updatedAt: "2026-05-01T16:40:00+09:00",
            },
            patient: {
              id: "patient-coco",
              workspaceId: "clair-demo",
              patientNo: "P-260501-0001",
              name: "코코",
              species: "dog",
              breed: "Maltese",
              sex: "female",
              handlingCautionLocked: false,
              status: "active",
              createdAt: "2026-04-01T00:00:00+09:00",
              updatedAt: "2026-04-01T00:00:00+09:00",
            },
            primaryGuardian: {
              id: "guardian-lee-jieun",
              workspaceId: "clair-demo",
              name: "이지은",
              mobilePhone: "010-1000-0001",
              createdAt: "2026-04-01T00:00:00+09:00",
              updatedAt: "2026-04-01T00:00:00+09:00",
            },
          },
        ],
        enforcedBy: "reception-calendar-read",
      }),
    });
  });

  await page.goto("/w/clair-demo/reception");

  await expect.poll(() => requested).toBe(true);
  const walkInDescription = page.getByTestId(
    "walkin-card-encounter-calendar-summary-description",
  );
  await expect(walkInDescription).toContainText(
    "방문 목적 텍스트 에어리어 내용",
  );
  await expect(walkInDescription).not.toContainText("영상의학과");
  await expect(walkInDescription).not.toContainText("접수 메모");
  await expect(walkInDescription).not.toContainText("이수지");

  const appointmentDescription = page.getByTestId(
    "appointment-card-appointment-calendar-summary-description",
  );
  await expect(appointmentDescription).toContainText(
    "예약 메모 텍스트 에어리어 내용",
  );
  await expect(appointmentDescription).not.toContainText(
    "증상 상세는 예약 카드에서 숨김",
  );

  const summaryMetrics = await walkInDescription.evaluate((description) => {
    const box = description.getBoundingClientRect();
    const style = getComputedStyle(description);

    return {
      lineClamp:
        style.getPropertyValue("-webkit-line-clamp") || style.webkitLineClamp,
      maxVisualHeight: Math.round(box.height),
    };
  });
  expect(summaryMetrics.lineClamp).toBe("2");
  expect(summaryMetrics.maxVisualHeight).toBeLessThanOrEqual(36);
});

test("reception day and week calendars place walk-in cards by actual start minute and duration", async ({
  page,
}) => {
  await page.route("**/reception/calendar/day**", async (route) => {
    const date = new URL(route.request().url()).searchParams.get("date");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        status: 200,
        workspaceId: "clair-demo",
        date,
        records: [
          {
            encounter: {
              id: "encounter-time-axis-minutes",
              workspaceId: "clair-demo",
              patientId: "patient-coco",
              guardianId: "guardian-lee-jieun",
              primaryVeterinarianId: "user-vet-suji",
              encounterNo: "E-TIME-001",
              receptionType: "walk_in",
              durationMinutes: 30,
              chiefComplaint: "15:13 실제 시간 배치",
              visitPurpose: "15:13 실제 시간 배치",
              status: "waiting",
              checkedInAt: "2026-05-01T15:13:00+09:00",
              createdAt: "2026-05-01T15:13:00+09:00",
              updatedAt: "2026-05-01T15:13:00+09:00",
            },
            queueEntry: {
              id: "queue-time-axis-minutes",
              workspaceId: "clair-demo",
              encounterId: "encounter-time-axis-minutes",
              queueType: "consultation",
              status: "waiting",
              priority: "normal",
              sortOrder: 1,
              enteredAt: "2026-05-01T15:13:00+09:00",
            },
          },
          {
            encounter: {
              id: "encounter-time-axis-long",
              workspaceId: "clair-demo",
              patientId: "patient-nabi",
              guardianId: "guardian-oh-sea",
              primaryVeterinarianId: "user-vet-suji",
              encounterNo: "E-TIME-002",
              receptionType: "walk_in",
              durationMinutes: 90,
              chiefComplaint: "90분 실제 시간 배치",
              visitPurpose: "90분 실제 시간 배치",
              status: "waiting",
              checkedInAt: "2026-05-01T16:00:00+09:00",
              createdAt: "2026-05-01T16:00:00+09:00",
              updatedAt: "2026-05-01T16:00:00+09:00",
            },
            queueEntry: {
              id: "queue-time-axis-long",
              workspaceId: "clair-demo",
              encounterId: "encounter-time-axis-long",
              queueType: "consultation",
              status: "waiting",
              priority: "normal",
              sortOrder: 2,
              enteredAt: "2026-05-01T16:00:00+09:00",
            },
          },
        ],
        enforcedBy: "reception-calendar-read",
      }),
    });
  });

  await page.goto("/w/clair-demo/reception");

  const shortCard = page.getByTestId("walkin-card-encounter-time-axis-minutes");
  const longCard = page.getByTestId("walkin-card-encounter-time-axis-long");
  await expect(shortCard).toContainText("15:13");
  await expect(shortCard).not.toContainText("30분");
  await expect(longCard).toContainText("90분");
  const longDescription = longCard.getByTestId(
    "walkin-card-encounter-time-axis-long-description",
  );
  await expect(longDescription).toContainText("90분 실제 시간 배치");
  const longDescriptionMetrics = await longDescription.evaluate((description) => {
    const box = description.getBoundingClientRect();
    const style = getComputedStyle(description);
    return {
      fontSize: style.fontSize,
      lineClamp:
        style.getPropertyValue("-webkit-line-clamp") || style.webkitLineClamp,
      lineHeight: style.lineHeight,
      maxVisualHeight: Math.round(box.height),
    };
  });
  expect(longDescriptionMetrics.fontSize).toBe("13px");
  expect(longDescriptionMetrics.lineHeight).toBe("18px");
  expect(longDescriptionMetrics.lineClamp).toBe("2");
  expect(longDescriptionMetrics.maxVisualHeight).toBeLessThanOrEqual(36);
  const shortCardBadgeMetrics = await shortCard
    .getByTestId("walkin-card-encounter-time-axis-minutes-badge")
    .evaluate((badge) => {
      const parent = badge.parentElement;
      const card = badge.closest("button");
      if (!parent || !card) return null;

      const badgeBox = badge.getBoundingClientRect();
      const cardBox = card.getBoundingClientRect();

      return {
        badgeHeight: Math.round(badgeBox.height),
        badgeTopInset: Math.round(badgeBox.top - cardBox.top),
        parentHeight: Math.round(cardBox.height),
        parentTestId: card.getAttribute("data-testid"),
      };
    });

  if (!shortCardBadgeMetrics)
    throw new Error("Expected short walk-in badge metrics");
  expect(shortCardBadgeMetrics.parentTestId).toBe(
    "walkin-card-encounter-time-axis-minutes",
  );
  expect(shortCardBadgeMetrics.parentHeight).toBeGreaterThanOrEqual(
    shortCardBadgeMetrics.badgeHeight,
  );
  expect(shortCardBadgeMetrics.badgeTopInset).toBeGreaterThanOrEqual(5);
  expect(shortCardBadgeMetrics.badgeTopInset).toBeLessThanOrEqual(7);
  const shortWalkInContentMetrics = await shortCard.evaluate((card) => {
    const badge = card.querySelector(
      '[data-testid="walkin-card-encounter-time-axis-minutes-badge"]',
    );
    const purpose = card.querySelector(
      '[data-testid="walkin-purpose-encounter-time-axis-minutes"]',
    );
    const time = card.querySelector(
      '[data-testid="walkin-card-encounter-time-axis-minutes-time"]',
    );
    if (!badge || !purpose || !time) return null;

    const purposeTextRange = document.createRange();
    purposeTextRange.selectNodeContents(purpose);
    const purposeTextBox = purposeTextRange.getBoundingClientRect();
    purposeTextRange.detach();

    const timeTextRange = document.createRange();
    timeTextRange.selectNodeContents(time);
    const timeTextBox = timeTextRange.getBoundingClientRect();
    timeTextRange.detach();

    const badgeBox = badge.getBoundingClientRect();
    const cardBox = card.getBoundingClientRect();
    const timeBox = time.getBoundingClientRect();
    const timeStyle = getComputedStyle(time);
    const verticalGap = timeTextBox.top - purposeTextBox.bottom;

    return {
      badgeLeftInset: Math.round((badgeBox.left - cardBox.left) * 100) / 100,
      timeHeight: Math.round(timeBox.height),
      timeTextLeftInset:
        Math.round((timeTextBox.left - cardBox.left) * 100) / 100,
      timeOpacity: timeStyle.opacity,
      verticalGap: Math.round(verticalGap * 100) / 100,
    };
  });

  if (!shortWalkInContentMetrics)
    throw new Error("Expected short walk-in medium content metrics");
  expect(shortWalkInContentMetrics.badgeLeftInset).toBeGreaterThanOrEqual(7);
  expect(shortWalkInContentMetrics.badgeLeftInset).toBeLessThanOrEqual(9);
  expect(shortWalkInContentMetrics.timeHeight).toBe(18);
  expect(shortWalkInContentMetrics.timeOpacity).toBe("0.6");
  expect(shortWalkInContentMetrics.timeTextLeftInset).toBeGreaterThanOrEqual(7);
  expect(shortWalkInContentMetrics.timeTextLeftInset).toBeLessThanOrEqual(9);
  expect(shortWalkInContentMetrics.verticalGap).toBeGreaterThanOrEqual(3);
  expect(shortWalkInContentMetrics.verticalGap).toBeLessThanOrEqual(7);

  const dayMetrics = await shortCard.evaluate((card) => {
    const row = document.querySelector('[data-testid="day-hour-row-15"]');
    const longCard = document.querySelector(
      '[data-testid="walkin-card-encounter-time-axis-long"]',
    );
    if (!row || !longCard) return null;

    const cardBox = card.getBoundingClientRect();
    const rowBox = row.getBoundingClientRect();
    const longBox = longCard.getBoundingClientRect();

    return {
      height: Math.round(cardBox.height * 100) / 100,
      longHeight: Math.round(longBox.height * 100) / 100,
      top: Math.round((cardBox.top - rowBox.top) * 100) / 100,
    };
  });

  if (!dayMetrics) throw new Error("Expected day card metrics");
  expect(dayMetrics.top).toBeGreaterThan(25);
  expect(dayMetrics.top).toBeLessThan(27);
  expect(dayMetrics.height).toBe(60);
  expect(dayMetrics.longHeight).toBeGreaterThan(dayMetrics.height * 2.9);

  await shortCard.click();
  await expect(page.getByTestId("workspace-drawer")).toContainText(
    "15:13 실제 시간 배치",
  );
  await page.getByRole("button", { name: "상세 닫기" }).click();

  await page.getByRole("group", { name: "접수 캘린더 보기" }).getByRole(
    "button",
    { name: "주" },
  ).click();

  const weekShortCard = page.getByTestId(
    "walkin-card-encounter-time-axis-minutes",
  );
  await expect(weekShortCard).toContainText("15:13");
  const weekMetrics = await weekShortCard.evaluate((card) => {
    const row = document.querySelector('[data-testid="week-hour-row-15"]');
    if (!row) return null;

    const cardBox = card.getBoundingClientRect();
    const rowBox = row.getBoundingClientRect();

    return {
      height: Math.round(cardBox.height * 100) / 100,
      top: Math.round((cardBox.top - rowBox.top) * 100) / 100,
    };
  });

  if (!weekMetrics) throw new Error("Expected week card metrics");
  expect(weekMetrics.top).toBeGreaterThan(25);
  expect(weekMetrics.top).toBeLessThan(27);
  expect(weekMetrics.height).toBe(60);
});

test("reception persisted reads deny cross-workspace demo actors", async ({
  request,
}) => {
  const headers = { "x-clair-demo-session-user-id": "user-front-desk" };
  const queueResponse = await request.get(
    "/api/workspaces/other-workspace/reception/queue",
    {
      headers,
    },
  );
  const calendarResponse = await request.get(
    "/api/workspaces/other-workspace/reception/calendar/day?date=2026-05-01",
    { headers },
  );

  expect(queueResponse.status()).toBe(403);
  await expect(queueResponse.json()).resolves.toMatchObject({
    ok: false,
    denialReason: "workspace_membership_missing",
  });
  expect(calendarResponse.status()).toBe(403);
  await expect(calendarResponse.json()).resolves.toMatchObject({
    ok: false,
    denialReason: "workspace_membership_missing",
  });
});

test("reception check-in converts a confirmed appointment into a waiting encounter", async ({
  page,
}) => {
  await page.route(
    "**/api/workspaces/clair-demo/reception/appointments/appointment-nabi-260501/check-in",
    async (route) => {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 201,
          workspaceId: "clair-demo",
          checkIn: {
            appointment: {
              id: "appointment-nabi-260501",
              workspaceId: "clair-demo",
              patientId: "patient-nabi",
              guardianId: "guardian-oh-sea",
              assignedVeterinarianId: "user-vet-doyun",
              scheduledStartAt: "2026-05-01T10:45:00+09:00",
              scheduledEndAt: "2026-05-01T11:00:00+09:00",
              visitPurpose: "피부 재진",
              status: "checked_in",
              createdByUserId: "user-desk-yuna",
              createdAt: "2026-04-30T11:10:00+09:00",
              updatedAt: "2026-05-01T10:50:00+09:00",
            },
            encounter: {
              id: "encounter-live-appointment-nabi",
              workspaceId: "clair-demo",
              patientId: "patient-nabi",
              guardianId: "guardian-oh-sea",
              appointmentId: "appointment-nabi-260501",
              primaryVeterinarianId: "user-vet-doyun",
              encounterNo: "E-LIVE-0002",
              receptionType: "appointment",
              durationMinutes: 20,
              chiefComplaint: "피부 재진",
              visitPurpose: "피부 재진",
              status: "waiting",
              checkedInAt: "2026-05-01T10:50:00+09:00",
              createdAt: "2026-05-01T10:50:00+09:00",
              updatedAt: "2026-05-01T10:50:00+09:00",
            },
            queueEntry: {
              id: "queue-live-appointment-nabi",
              workspaceId: "clair-demo",
              encounterId: "encounter-live-appointment-nabi",
              queueType: "consultation",
              status: "waiting",
              priority: "normal",
              enteredAt: "2026-05-01T10:50:00+09:00",
            },
          },
          enforcedBy: "reception-appointment-check-in",
        }),
      });
    },
  );

  await page.goto("/w/clair-demo/reception");

  const nabiAppointment = page.getByTestId(
    "appointment-card-appointment-nabi-260501",
  );
  await expect(nabiAppointment).toContainText("예약");
  await expect(nabiAppointment).not.toContainText("예약확정");

  await nabiAppointment.click();
  const detailPanel = page.getByTestId("reception-right-panel");
  const beforeCheckInNotice = detailPanel.getByTestId(
    "reservation-before-check-in-notice",
  );
  await expect(beforeCheckInNotice).toContainText("접수 전, 예약 건입니다");
  await expect(beforeCheckInNotice).toContainText(
    "보호자 방문 시, 접수 할 수 있습니다.",
  );
  await expect(
    beforeCheckInNotice.getByTestId("reservation-before-check-in-notice-action"),
  ).toBeVisible();
  await expect(detailPanel).not.toContainText("예약확정");
  await submitAppointmentCheckInConfirm(page);

  await expect(nabiAppointment).toContainText("예약");
  await expect(nabiAppointment).not.toContainText("접수완료");
  await expect(page.getByTestId("patient-card-patient-nabi")).toContainText(
    "피부 재진",
  );
  await expect(page.getByTestId("patient-card-patient-nabi")).toContainText(
    "김도윤",
  );
});

test("server-backed appointment check-in sends the appointment transition request", async ({
  page,
}) => {
  let requested = false;

  await page.route(
    "**/api/workspaces/clair-demo/reception/appointments/appointment-nabi-260501/check-in",
    async (route) => {
      requested = true;
      expect(route.request().method()).toBe("POST");
      expect(route.request().postData()).toBeNull();
      expect(route.request().headers()["content-type"]).toBeUndefined();
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 201,
          workspaceId: "clair-demo",
          checkIn: {
            appointment: {
              id: "appointment-nabi-260501",
              workspaceId: "clair-demo",
              patientId: "patient-nabi",
              guardianId: "guardian-oh-sea",
              assignedVeterinarianId: "user-vet-doyun",
              scheduledStartAt: "2026-05-01T10:45:00+09:00",
              scheduledEndAt: "2026-05-01T11:00:00+09:00",
              visitPurpose: "피부 재진",
              status: "checked_in",
              createdByUserId: "user-desk-yuna",
              createdAt: "2026-04-30T11:10:00+09:00",
              updatedAt: "2026-05-19T00:00:00.000Z",
            },
            encounter: {
              id: "encounter-live-appointment-nabi",
              workspaceId: "clair-demo",
              patientId: "patient-nabi",
              guardianId: "guardian-oh-sea",
              appointmentId: "appointment-nabi-260501",
              primaryVeterinarianId: "user-vet-doyun",
              encounterNo: "E-LIVE-0002",
              receptionType: "appointment",
              durationMinutes: 20,
              chiefComplaint: "피부 재진",
              visitPurpose: "피부 재진",
              status: "waiting",
              checkedInAt: "2026-05-01T10:50:00+09:00",
              createdAt: "2026-05-01T10:50:00+09:00",
              updatedAt: "2026-05-01T10:50:00+09:00",
            },
            queueEntry: {
              id: "queue-live-appointment-nabi",
              workspaceId: "clair-demo",
              encounterId: "encounter-live-appointment-nabi",
              queueType: "consultation",
              status: "waiting",
              priority: "normal",
              enteredAt: "2026-05-01T10:50:00+09:00",
            },
          },
          enforcedBy: "reception-appointment-check-in",
        }),
      });
    },
  );

  await page.goto("/w/clair-demo/reception");

  const nabiAppointment = page.getByTestId(
    "appointment-card-appointment-nabi-260501",
  );
  await nabiAppointment.click();
  const detailPanel = page.getByTestId("reception-right-panel");
  const beforeCheckInNotice = detailPanel.getByTestId(
    "reservation-before-check-in-notice",
  );
  await expect(beforeCheckInNotice).toContainText("접수 전, 예약 건입니다");
  await expect(beforeCheckInNotice).toContainText(
    "보호자 방문 시, 접수 할 수 있습니다.",
  );
  await expect(
    beforeCheckInNotice.getByTestId("reservation-before-check-in-notice-action"),
  ).toBeVisible();
  await expect(detailPanel).not.toContainText("예약확정");
  const cancelDialog = await openAppointmentCheckInConfirm(page);
  await expect(cancelDialog).toContainText(
    "나비/오세아의 예약을 접수 확정하시겠습니까?",
  );
  await cancelDialog.getByRole("button", { exact: true, name: "취소" }).click();
  expect(requested).toBe(false);

  await submitAppointmentCheckInConfirm(page);

  expect(requested).toBe(true);
  await expect(page.getByText("예약 건 접수가 완료되었습니다")).toBeVisible();
  await expect(detailPanel).not.toContainText("접수 전, 예약 건입니다");
  await expect(
    detailPanel.getByRole("button", { name: "접수하기" }),
  ).toHaveCount(0);
  await expect(nabiAppointment).toContainText("예약");
  await expect(nabiAppointment).not.toContainText("접수완료");
  await expect(page.getByTestId("patient-card-patient-nabi")).toContainText(
    "피부 재진",
  );
  await expect(page.getByTestId("patient-card-patient-nabi")).toContainText(
    "김도윤",
  );
});

test("appointment check-in persistence regression reloads from queue and calendar reads", async ({
  page,
}) => {
  const persistedCheckIn = {
    appointment: {
      id: "appointment-nabi-260501",
      workspaceId: "clair-demo",
      patientId: "patient-nabi",
      guardianId: "guardian-oh-sea",
      assignedVeterinarianId: "user-vet-doyun",
      scheduledStartAt: "2026-05-01T10:45:00+09:00",
      scheduledEndAt: "2026-05-01T11:00:00+09:00",
      visitPurpose: "DEN-65 reload appointment",
      status: "checked_in",
      createdByUserId: "user-desk-yuna",
      createdAt: "2026-04-30T11:10:00+09:00",
      updatedAt: "2026-05-01T10:41:00+09:00",
    },
    encounter: {
      id: "encounter-e2e-appointment-nabi",
      workspaceId: "clair-demo",
      patientId: "patient-nabi",
      guardianId: "guardian-oh-sea",
      appointmentId: "appointment-nabi-260501",
      primaryVeterinarianId: "user-vet-doyun",
      encounterNo: "E-E2E-0002",
      receptionType: "appointment",
      durationMinutes: 20,
      chiefComplaint: "DEN-65 reload appointment",
      visitPurpose: "DEN-65 reload appointment",
      status: "waiting",
      checkedInAt: "2026-05-01T10:41:00+09:00",
      createdAt: "2026-05-01T10:41:00+09:00",
      updatedAt: "2026-05-01T10:41:00+09:00",
    },
    queueEntry: {
      id: "queue-e2e-appointment-nabi",
      workspaceId: "clair-demo",
      encounterId: "encounter-e2e-appointment-nabi",
      queueType: "consultation",
      status: "waiting",
      priority: "normal",
      sortOrder: 2,
      enteredAt: "2026-05-01T10:41:00+09:00",
    },
  };
  let appointmentCheckedIn = false;

  await page.route(
    "**/api/workspaces/clair-demo/reception/appointments/appointment-nabi-260501/check-in",
    async (route) => {
      appointmentCheckedIn = true;
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 201,
          workspaceId: "clair-demo",
          checkIn: persistedCheckIn,
          enforcedBy: "reception-appointment-check-in",
        }),
      });
    },
  );
  await page.route("**/reception/queue**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        status: 200,
        queue: appointmentCheckedIn
          ? [
              {
                encounter: persistedCheckIn.encounter,
                queueEntry: persistedCheckIn.queueEntry,
              },
            ]
          : [],
        enforcedBy: "reception-queue-read",
      }),
    });
  });
  await page.route("**/reception/calendar/day**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        status: 200,
        workspaceId: "clair-demo",
        date: "2026-05-01",
        records: appointmentCheckedIn ? [persistedCheckIn] : [],
        enforcedBy: "reception-calendar-read",
      }),
    });
  });

  await page.goto("/w/clair-demo/reception");

  const nabiAppointment = page.getByTestId(
    "appointment-card-appointment-nabi-260501",
  );
  await nabiAppointment.click();
  await submitAppointmentCheckInConfirm(page);
  await expect(nabiAppointment).toContainText("예약");
  await expect(nabiAppointment).not.toContainText("접수완료");

  await page.reload();

  await expect(
    page.getByTestId("appointment-card-appointment-nabi-260501"),
  ).toContainText("예약");
  await expect(
    page.getByTestId("appointment-card-appointment-nabi-260501"),
  ).not.toContainText("접수완료");
  await expect(
    page.getByTestId("appointment-card-appointment-nabi-260501"),
  ).toHaveAttribute(
    "aria-label",
    /DEN-65 reload appointment/,
  );
  await expect(page.getByTestId("patient-card-patient-nabi")).toContainText(
    "DEN-65 reload appointment",
  );
  await expect(page.getByTestId("patient-card-patient-nabi")).toContainText(
    "김도윤",
  );
});

test("reception right panel header uses the shared 52px height", async ({
  page,
}) => {
  await page.goto(
    "/w/clair-demo/reception?modulePanel=open&right=open&drawer=reception-appointment%3Aappointment-nabi-260501",
  );

  const rightPanel = page.getByTestId("reception-right-panel");
  await expect(rightPanel).toBeVisible();
  await expect(rightPanel.locator("header")).toHaveCSS("height", "52px");
  const closeButton = rightPanel.getByRole("button", {
    name: "우측 사이드 패널 닫기",
  });
  await expect(closeButton).toHaveCSS("width", "32px");
  await expect(closeButton).toHaveCSS("height", "32px");
});

test("reception right panel selection state uses a title-only shared drawer empty state", async ({
  page,
}) => {
  await page.goto(
    "/w/workspace-clair-cheongdam/reception?modulePanel=open&right=open",
  );

  const emptyState = page.getByTestId("reception-right-panel-empty-state");
  await expect(emptyState).toBeVisible();
  await expect(emptyState).toHaveAttribute("data-surface", "drawer");
  await expect(emptyState).toHaveAttribute("data-size", "md");
  await expect(emptyState).toHaveAttribute("data-action-count", "0");
  await expect(emptyState).toContainText("선택된 접수/예약 건이 없습니다");
  await expect(emptyState.locator("p")).toHaveCount(0);
});

test("reception side-panel footer actions use the shared 32px control height", async ({
  page,
}) => {
  await page.goto(
    "/w/clair-demo/reception?modulePanel=open&right=open&drawer=reception-encounter%3Aencounter-haru-260430",
  );

  const rightPanel = page.getByTestId("reception-right-panel");
  await expect(rightPanel).toBeVisible();

  const footerButtons = [
    rightPanel.getByTestId("reception-encounter-cancel-open"),
    rightPanel.getByRole("button", { name: "닫기", exact: true }),
    rightPanel.getByTestId("reception-encounter-edit-open"),
  ];

  for (const button of footerButtons) {
    await expect(button).toBeVisible();
    await expect(button).toHaveCSS("height", "32px");
  }
});

test("reception detail footer close collapses the side panel while retaining the detail", async ({
  page,
}) => {
  await page.goto(
    "/w/clair-demo/reception?modulePanel=open&right=open&drawer=reception-encounter%3Aencounter-haru-260430",
  );

  const rightPanel = page.getByTestId("reception-right-panel");
  await expect(rightPanel).toBeVisible();
  await rightPanel.getByRole("button", { name: "닫기", exact: true }).click();

  await expect(page).toHaveURL(/right=closed/);
  await expect(rightPanel).toHaveCount(0);

  await page
    .getByRole("button", { name: "우측 사이드 패널 열기", exact: true })
    .click();
  await expect(page.getByTestId("reception-right-panel")).toContainText(
    "접수 상세",
  );
  await expect(page).toHaveURL(/drawer=reception-encounter/);
});

test("reception encounter edit mode shows its badge beside the side-panel title", async ({
  page,
}) => {
  await page.goto(
    "/w/clair-demo/reception?modulePanel=open&right=open&drawer=reception-encounter%3Aencounter-haru-260430",
  );

  const rightPanel = page.getByTestId("reception-right-panel");
  const header = rightPanel.locator("header");
  await expect(header.getByText("수정 중")).toHaveCount(0);

  await rightPanel.getByTestId("reception-encounter-edit-open").click();
  await page.getByTestId("reception-encounter-edit-confirm").click();

  await expect(header.getByText("수정 중")).toHaveCount(1);
  await expect(rightPanel.getByText("수정 중")).toHaveCount(1);

  await rightPanel.getByRole("button", { name: "취소", exact: true }).click();
  await expect(header.getByText("수정 중")).toHaveCount(0);
});

test("reception encounter detail uses the CDS V2 side-panel field tokens", async ({
  page,
}) => {
  await page.goto(
    "/w/clair-demo/reception?modulePanel=open&right=open&drawer=reception-encounter%3Aencounter-haru-260430",
  );

  const detailPanel = page.getByTestId("reception-right-panel");
  await expect(detailPanel).toBeVisible();

  const metrics = await detailPanel.getByLabel("체중").evaluate((element) => {
    const field = element.closest("div.grid");
    const label = field?.firstElementChild;
    const section = element.closest("section");
    const sectionHeading = section?.querySelector("h3");
    const sectionFields = section?.lastElementChild;
    const content = section?.parentElement;
    const footer = element.closest("main")?.querySelector("footer");
    const unit = element.parentElement?.querySelector("span");
    const inputStyle = getComputedStyle(element);

    return {
      contentGap: content ? getComputedStyle(content).gap : undefined,
      contentPadding: content ? getComputedStyle(content).padding : undefined,
      fieldGap: field ? getComputedStyle(field).columnGap : undefined,
      fieldLabelWidth: label
        ? Math.round(label.getBoundingClientRect().width)
        : undefined,
      footerPaddingTop: footer ? getComputedStyle(footer).paddingTop : undefined,
      inputBackground: inputStyle.backgroundColor,
      inputFontSize: inputStyle.fontSize,
      inputFontWeight: inputStyle.fontWeight,
      inputHeight: Math.round(element.getBoundingClientRect().height),
      inputLineHeight: inputStyle.lineHeight,
      inputPaddingLeft: inputStyle.paddingLeft,
      labelColor: label ? getComputedStyle(label).color : undefined,
      labelFontSize: label ? getComputedStyle(label).fontSize : undefined,
      labelFontWeight: label ? getComputedStyle(label).fontWeight : undefined,
      sectionFieldGap: sectionFields
        ? getComputedStyle(sectionFields).rowGap
        : undefined,
      sectionHeadingFontSize: sectionHeading
        ? getComputedStyle(sectionHeading).fontSize
        : undefined,
      sectionHeadingHeight: sectionHeading
        ? Math.round(sectionHeading.getBoundingClientRect().height)
        : undefined,
      sectionHeadingMarginBottom: sectionHeading
        ? getComputedStyle(sectionHeading).marginBottom
        : undefined,
      sectionPaddingTop: section ? getComputedStyle(section).paddingTop : undefined,
      unitColor: unit ? getComputedStyle(unit).color : undefined,
      unitFontWeight: unit ? getComputedStyle(unit).fontWeight : undefined,
    };
  });

  expect(metrics).toEqual({
    contentGap: "16px",
    contentPadding: "16px",
    fieldGap: "12px",
    fieldLabelWidth: 108,
    footerPaddingTop: "16px",
    inputBackground: "rgb(255, 255, 255)",
    inputFontSize: "14px",
    inputFontWeight: "500",
    inputHeight: 32,
    inputLineHeight: "20.0004px",
    inputPaddingLeft: "10px",
    labelColor: "rgb(115, 115, 115)",
    labelFontSize: "14px",
    labelFontWeight: "500",
    sectionFieldGap: "12px",
    sectionHeadingFontSize: "13px",
    sectionHeadingHeight: 24,
    sectionHeadingMarginBottom: "0px",
    sectionPaddingTop: "0px",
    unitColor: "rgb(82, 82, 82)",
    unitFontWeight: "400",
  });
});

test("reception read failures explain local demo fallback and expose retry actions", async ({
  page,
}) => {
  let queueReadCount = 0;
  let calendarReadCount = 0;
  let failReads = true;

  await page.route("**/reception/queue**", async (route) => {
    queueReadCount += 1;

    if (failReads) {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          ok: false,
          status: 500,
          error: "db_read_failed",
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        status: 200,
        queue: [],
        enforcedBy: "reception-queue-read",
      }),
    });
  });
  await page.route("**/reception/calendar/day**", async (route) => {
    calendarReadCount += 1;

    if (failReads) {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          ok: false,
          status: 500,
          error: "db_read_failed",
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        status: 200,
        workspaceId: "clair-demo",
        date: "2026-05-01",
        records: [],
        enforcedBy: "reception-calendar-read",
      }),
    });
  });

  await page.goto("/w/clair-demo/reception");

  const queueAlert = page.getByTestId("reception-queue-read-alert");
  const calendarAlert = page.getByTestId("reception-calendar-read-alert");

  await expect(queueAlert).toContainText("서버 대기열을 불러오지 못했어");
  await expect(queueAlert).toContainText("로컬 데모/세션 데이터 기준으로 유지");
  await expect(calendarAlert).toContainText("서버 캘린더를 불러오지 못했어");
  await expect(calendarAlert).toContainText(
    "로컬 데모/세션 데이터 기준으로 유지",
  );

  failReads = false;
  await queueAlert.getByRole("button", { name: "대기열 다시 시도" }).click();

  await expect.poll(() => queueReadCount).toBeGreaterThanOrEqual(2);
  await expect.poll(() => calendarReadCount).toBeGreaterThanOrEqual(2);
  await expect(queueAlert).toHaveCount(0);
  await expect(calendarAlert).toHaveCount(0);
});

test("reception creates a walk-in waiting row from the new check-in dialog", async ({
  page,
}) => {
  const walkInCreate = await mockReceptionWalkInCreate(page, {
    checkedInAt: "2026-05-01T10:45:00+09:00",
    encounterId: "encounter-live-walkin-dubu",
    guardianId: "guardian-jung-harin",
    patientId: "patient-dubu",
    queueId: "queue-live-walkin-dubu",
  });

  await page.goto("/w/clair-demo/reception");

  const sidePanel = page.locator("aside").first();
  await sidePanel.getByTestId("patient-card-patient-dubu").click();
  await expect(page.getByTestId("reception-right-panel")).toContainText("접수 상세");
  await page.getByRole("button", { name: "우측 사이드 패널 닫기" }).click();
  await openWalkInReceptionForm(page);
  await expect(page).toHaveURL(/drawer=reception-form/);
  const walkInForm = page.getByTestId("walk-in-reception-dialog");
  await expect(page.getByTestId("reception-right-panel")).toContainText(
    "접수 생성",
  );
  await expect(walkInForm.getByLabel("체중")).toBeDisabled();
  await expect(
    walkInForm.getByRole("button", { name: "바이탈 추가" }),
  ).toBeDisabled();
  await expect(walkInForm.getByRole("combobox", { name: "진료과" })).toContainText(
    "진료과를 선택해주세요",
  );
  await expect(walkInForm.getByRole("combobox", { name: "담당의" })).toContainText(
    "담당의를 선택해주세요",
  );
  await expect(
    walkInForm.getByRole("button", { name: "카카오톡 발송" }),
  ).toHaveCount(0);
  await expect(walkInForm.getByLabel("환자 검색")).toHaveAttribute(
    "placeholder",
    "환자를 선택해주세요",
  );
  await expect(walkInForm.getByText("두부 · 정하린")).toHaveCount(0);
  await walkInForm.getByLabel("환자 검색").click();
  await walkInForm.getByLabel("환자 검색").fill("두부");
  await page.getByRole("option", { name: /두부.*정하린/ }).click();
  await expect(walkInForm.getByLabel("체중")).toBeEnabled();
  await expect(
    walkInForm.getByRole("button", { name: "바이탈 추가" }),
  ).toBeEnabled();
  await expect(walkInForm.getByLabel("체중")).toHaveValue("8.40");
  await walkInForm.getByLabel("체중").fill("8.65");
  await expect(walkInForm.getByLabel("방문목적")).toBeVisible();
  await expect(
    walkInForm.getByRole("button", { name: "태그 추가" }),
  ).toHaveCount(0);
  await walkInForm.getByLabel("방문목적").fill("재활 · 보행 재검 및 통증 상담");
  await walkInForm.getByLabel("접수 메모").fill("보호자가 계단 보행을 걱정함");
  await walkInForm.getByRole("button", { name: "생성" }).click();

  await expect.poll(() => walkInCreate.count).toBe(1);
  await expect(page.getByText("접수가 완료되었습니다")).toBeVisible();

  const dubuCard = page
    .getByTestId("patient-card-patient-dubu")
    .filter({ hasText: "보행 재검 및 통증 상담" });
  await expect(dubuCard).toContainText("두부");
  await expect(dubuCard).toContainText("재활");
  await expect(dubuCard).toContainText("보행 재검 및 통증 상담");
  await expect(dubuCard).toContainText("미지정");

  await expect(
    page.getByRole("button", {
      name: /진료대기 두부 · 재활 · 보행 재검 및 통증 상담/,
    }),
  ).toBeVisible();
});

test("reception creates a reservation through the unified check-in menu", async ({
  page,
}) => {
  await freezeBrowserClock(page, "2026-05-01T08:55:00+09:00");

  let createdAppointment: Record<string, unknown> | null = null;
  let latestBody: Record<string, unknown> | undefined;

  await page.route(
    "**/api/workspaces/clair-demo/reception/calendar/day**",
    async (route) => {
      if (!createdAppointment) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            status: 200,
            workspaceId: "clair-demo",
            date: "2026-05-01",
            records: [],
            enforcedBy: "reception-calendar-read",
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 200,
          workspaceId: "clair-demo",
          date: "2026-05-01",
          records: [{ appointment: createdAppointment }],
          enforcedBy: "reception-calendar-read",
        }),
      });
    },
  );

  await page.route(
    "**/api/workspaces/clair-demo/reception/appointments",
    async (route) => {
      latestBody = route.request().postDataJSON() as Record<string, unknown>;
      createdAppointment = {
        id: "appointment-den516-ui",
        workspaceId: "clair-demo",
        patientId: latestBody.patientId,
        guardianId: latestBody.guardianId,
        assignedVeterinarianId: latestBody.assignedVeterinarianId,
        scheduledStartAt: latestBody.scheduledStartAt,
        scheduledEndAt: "2026-05-01T12:30:00+09:00",
        visitPurpose: latestBody.reservationMemo,
        symptomNote: latestBody.reservationMemo,
        status: "confirmed",
        createdByUserId: "user-front-desk",
        createdAt: "2026-05-01T08:55:00+09:00",
        updatedAt: "2026-05-01T08:55:00+09:00",
      };

      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 201,
          workspaceId: "clair-demo",
          appointment: createdAppointment,
          enforcedBy: "reception-appointment-create",
        }),
      });
    },
  );

  await page.goto("/w/clair-demo/reception");

  await page.getByTestId("schedule-check-in-button").click();
  await page.getByRole("menuitem", { name: "예약하기" }).click();

  const drawer = page.getByTestId("reservation-create-drawer");
  await expect(drawer).toBeVisible();
  await expect(drawer.getByLabel("예약일")).toHaveCSS("font-size", "14px");
  await expect(drawer.getByLabel("예약일")).toHaveCSS("height", "32px");
  await expect(drawer.getByLabel("예약시간")).toHaveCSS("font-size", "14px");
  await expect(drawer.getByLabel("예약시간")).toHaveCSS("height", "32px");
  await expect(drawer.getByText("진료 시간 안에서 예약 가능한 시간을 선택합니다.")).toHaveCount(0);
  await expect(drawer.getByText("환자명, 동물 정보, 보호자명으로 검색합니다.")).toHaveCount(0);
  await expect(drawer.locator('input[type="date"][aria-label="예약일"]')).toHaveCount(0);
  await drawer.getByLabel("예약일").click();
  const selectedDateButton = page.getByRole("button", { name: /선택됨/ }).last();
  await expect(selectedDateButton).toBeVisible();
  await selectedDateButton.click();
  await expect(drawer.getByLabel("체중")).toBeDisabled();

  await drawer.getByLabel("환자 검색").fill("나비");
  await page.getByRole("option", { name: /나비.*오세아/ }).click();
  await expect(drawer.getByLabel("환자 검색")).toHaveValue(/나비/);
  await expect(drawer.getByLabel("환자 검색")).not.toHaveValue(/patient-nabi/);
  await expect(drawer.getByLabel("체중")).toHaveValue("4.80");
  await drawer.getByRole("button", { name: "환자 선택 초기화" }).click();
  await expect(drawer.getByLabel("환자 검색")).toHaveValue("");
  await expect(drawer.getByLabel("체중")).toBeDisabled();
  await drawer.getByLabel("환자 검색").fill("나비");
  await page.getByRole("option", { name: /나비.*오세아/ }).click();
  await drawer.getByLabel("체중").fill("4.95");

  await expect(drawer.getByLabel("예약시간")).toContainText("11:00");
  await expect(drawer.getByLabel("예약시간")).not.toContainText("540");
  await drawer.getByLabel("예약시간").click();
  await page.getByRole("option", { name: /^12:00$/ }).click();
  await expect(drawer.getByLabel("예약시간")).toContainText("12:00");
  await expect(drawer.getByLabel("예약시간")).not.toContainText("600");

  await drawer.getByLabel("예약 메모").fill("DEN-516 예약 생성 UI 검증");
  await drawer.getByRole("button", { name: "생성" }).click();

  await expect.poll(() => latestBody).toMatchObject({
    patientId: "patient-nabi",
    guardianId: "guardian-oh-sea",
    durationMinutes: 30,
    reservationMemo: "DEN-516 예약 생성 UI 검증",
    weightKg: 4.95,
  });
  expect(String(latestBody?.scheduledStartAt)).toMatch(
    /^2026-05-01T12:00:00\+09:00$/,
  );

  await expect(page.getByText("예약이 완료되었습니다")).toBeVisible();
  const detailDrawer = page.getByTestId("reception-right-panel");
  await expect(detailDrawer).toContainText("예약 상세");
  await expect(detailDrawer.getByLabel("예약일")).toHaveValue("2026.05.01");
  await expect(detailDrawer.getByLabel("예약시간")).toHaveValue("오후 12:00");
  await expect(detailDrawer).toContainText(
    "DEN-516 예약 생성 UI 검증",
  );
});

test("reservation drawer disables elapsed same-day time options", async ({
  page,
}) => {
  await page.goto("/w/clair-demo/reception?modulePanel=open&drawer=reception-reservation-form%3Anew");

  const drawer = page.getByTestId("reservation-create-drawer");
  await expect(drawer).toBeVisible();
  await expect(drawer.getByLabel("예약시간")).toContainText("11:00");

  await drawer.getByLabel("예약시간").click();
  await expect(
    page.getByRole("option", { name: "09:00 · 지난 시간" }),
  ).toHaveAttribute("aria-disabled", "true");
  await expect(
    page.getByRole("option", { name: "10:30 · 지난 시간" }),
  ).toHaveAttribute("aria-disabled", "true");
  await expect(
    page.getByRole("option", { name: "11:00" }),
  ).not.toHaveAttribute("aria-disabled", "true");
});

test("walk-in drawer explains that reception is closed outside business hours", async ({
  page,
}) => {
  await freezeBrowserClock(page, "2026-06-25T20:10:00+09:00");
  await page.goto(
    "/w/workspace-clair-cheongdam/reception?modulePanel=open&drawer=reception-form%3Awalk-in",
  );

  const drawer = page.getByTestId("walk-in-reception-dialog");
  await expect(drawer).toBeVisible();
  await expect(
    drawer.getByText("오늘 접수 가능 시간이 지났습니다. 다음 영업일 예약으로 등록해 주세요."),
  ).toBeVisible();
});

test("Cheongdam empty reception still renders the calendar workspace", async ({
  page,
}) => {
  const workspaceId = "workspace-clair-cheongdam";

  await page.route(
    `**/api/workspaces/${workspaceId}/reception/queue`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 200,
          queue: [],
          enforcedBy: "reception-queue-read",
        }),
      });
    },
  );
  await page.route(
    `**/api/workspaces/${workspaceId}/reception/calendar/day?**`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 200,
          records: [],
          enforcedBy: "reception-calendar-read",
        }),
      });
    },
  );

  await page.goto(`/w/${workspaceId}/reception?modulePanel=open`);

  await expect(page.getByTestId("schedule-toolbar")).toBeVisible();
  await expect(page.getByTestId("reception-calendar-frame")).toBeVisible();
  await expect(page.getByTestId("schedule-check-in-button")).toBeVisible();
  await expect(page.getByText("영업시간 09:00-19:00")).toHaveCount(0);
  await expect(page.getByText("환자를 선택해 주세요.")).toHaveCount(0);
  await expect(page.locator('[data-testid^="walkin-card-"]')).toHaveCount(0);
});

test("day lane headers show fact-based status and match the Figma metrics", async ({
  page,
}) => {
  const workspaceId = "workspace-clair-cheongdam";
  await freezeBrowserClock(page, "2026-07-14T19:26:00+09:00");
  await page.route(
    `**/api/workspaces/${workspaceId}/staff?role=vet*`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 200,
          staff: [
            {
              id: "49110000-0000-4000-8000-000000000003",
              displayName: "이수지",
              initial: "이",
              roles: ["vet"],
              status: "active",
              operationalStatus: {
                code: "shift_ended",
                label: "근무 종료",
                source: "schedule",
              },
            },
            {
              id: "49110000-0000-4000-8000-000000000004",
              displayName: "김도윤",
              initial: "김",
              roles: ["vet"],
              status: "active",
              operationalStatus: {
                code: "clocked_out",
                label: "퇴근",
                source: "time_clock",
              },
            },
          ],
        }),
      });
    },
  );
  await page.route(
    `**/api/workspaces/${workspaceId}/reception/queue`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 200,
          queue: [],
          enforcedBy: "reception-queue-read",
        }),
      });
    },
  );
  await page.route(
    `**/api/workspaces/${workspaceId}/reception/calendar/day?**`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 200,
          records: [],
          enforcedBy: "reception-calendar-read",
        }),
      });
    },
  );

  await page.goto(`/w/${workspaceId}/reception?modulePanel=open`);

  await expect(page.getByTestId("veterinarian-operational-status")).toHaveText([
    "근무 종료",
    "퇴근",
  ]);
  const statusBadge = page
    .getByTestId("veterinarian-operational-status")
    .first();
  await expect(statusBadge).toHaveCSS("height", "18px");
  await expect(statusBadge).toHaveCSS("border-radius", "6px");
  await expect(statusBadge).toHaveCSS("padding-top", "1px");
  await expect(statusBadge).toHaveCSS("padding-right", "6px");
  await expect(statusBadge).toHaveCSS("padding-bottom", "1px");
  await expect(statusBadge).toHaveCSS("padding-left", "6px");
  await expect(statusBadge).toHaveCSS("font-size", "12px");
  await expect(statusBadge).toHaveCSS("line-height", "15.9996px");
  await expect(statusBadge).toHaveCSS("font-weight", "500");
  await expect(statusBadge).toHaveCSS("letter-spacing", "0.3px");
  await expect(statusBadge).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(statusBadge).toHaveCSS("border-width", "0px");
  await expect
    .poll(() =>
      statusBadge.evaluate((element) => getComputedStyle(element).boxShadow),
    )
    .toContain("rgb(229, 229, 229) 0px 0px 0px 1px");
  await expect(statusBadge).toHaveCSS("color", "rgb(116, 106, 95)");
  await expect(statusBadge).toHaveCSS("min-width", "20px");
  await expect(
    page.getByTestId("veterinarian-operational-status").nth(1),
  ).toHaveCSS("color", "rgb(116, 106, 95)");
  await expect(
    page.getByTestId("veterinarian-operational-status").nth(1),
  ).toHaveCSS("width", "34px");
  const header = page.getByTestId("veterinarian-lane-header").first();
  const avatar = header.getByTestId("veterinarian-lane-avatar");
  const name = header.getByTestId("veterinarian-lane-name");
  const hideButton = header.getByRole("button", { name: "이수지 레인 숨기기" });

  const headerStyle = await header.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      backgroundColor: style.backgroundColor,
      borderRadius: style.borderRadius,
      columnGap: style.columnGap,
      height: style.height,
      paddingBottom: style.paddingBottom,
      paddingLeft: style.paddingLeft,
      paddingRight: style.paddingRight,
      paddingTop: style.paddingTop,
    };
  });
  expect(headerStyle).toMatchObject({
    borderRadius: "12px",
    columnGap: "10px",
    height: "40px",
    paddingBottom: "8px",
    paddingLeft: "10px",
    paddingRight: "10px",
    paddingTop: "8px",
  });
  await expect(avatar).toHaveCSS("width", "24px");
  await expect(avatar).toHaveCSS("height", "24px");
  await expect(avatar).toHaveCSS("border-radius", "6px");
  await expect(name).toHaveCSS("font-size", "16px");
  await expect(name).toHaveCSS("line-height", "24px");
  await expect(name).toHaveCSS("font-weight", "500");
  await expect(name).toHaveCSS("letter-spacing", "0.096px");

  await header.hover();
  await expect
    .poll(() => header.evaluate((element) => getComputedStyle(element).backgroundColor))
    .toBe(headerStyle.backgroundColor);
  await expect(hideButton).toHaveCSS("width", "24px");
  await expect(hideButton).toHaveCSS("height", "24px");
  await expect(hideButton).toHaveCSS("border-radius", "4px");
  await expect(hideButton.locator("svg")).toHaveCSS("width", "14px");
  await expect(hideButton).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await hideButton.hover();
  await expect(hideButton).toHaveCSS("background-color", "rgba(0, 0, 0, 0.04)");
});

test("Cheongdam reception defers the calendar board while veterinarian lanes load", async ({
  page,
}) => {
  const workspaceId = "workspace-clair-cheongdam";
  let releaseStaffResponse!: () => void;
  const staffResponseReady = new Promise<void>((resolve) => {
    releaseStaffResponse = resolve;
  });

  await page.route(
    `**/api/workspaces/${workspaceId}/staff?role=vet*`,
    async (route) => {
      await staffResponseReady;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 200,
          staff: [
            {
              id: "49110000-0000-4000-8000-000000000003",
              displayName: "청담 원장",
              initial: "청",
              roles: ["vet"],
              status: "active",
            },
          ],
        }),
      });
    },
  );
  await page.route(
    `**/api/workspaces/${workspaceId}/reception/queue`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 200,
          queue: [],
          enforcedBy: "reception-queue-read",
        }),
      });
    },
  );
  await page.route(
    `**/api/workspaces/${workspaceId}/reception/calendar/day?**`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 200,
          records: [],
          enforcedBy: "reception-calendar-read",
        }),
      });
    },
  );

  await page.goto(`/w/${workspaceId}/reception?modulePanel=open`);

  await expect(page.getByTestId("reception-calendar-resource-loading")).toBeVisible();
  const loadingGrid = page.getByTestId("reception-calendar-resource-loading-grid");
  const loadingMessage = page.getByTestId(
    "reception-calendar-resource-loading-message",
  );
  await expect(loadingMessage).toHaveText("진료 일정을 불러오는 중입니다");
  const loadingGridBox = await loadingGrid.boundingBox();
  const loadingMessageBox = await loadingMessage.boundingBox();
  if (!loadingGridBox || !loadingMessageBox) {
    throw new Error("Calendar loading grid and message must be measurable.");
  }
  expect(
    Math.abs(
      loadingMessageBox.x +
        loadingMessageBox.width / 2 -
        (loadingGridBox.x + loadingGridBox.width / 2),
    ),
  ).toBeLessThan(4);
  expect(
    Math.abs(
      loadingMessageBox.y +
        loadingMessageBox.height / 2 -
        (loadingGridBox.y + loadingGridBox.height / 2),
    ),
  ).toBeLessThan(4);
  await expect(page.getByText("수의사 0")).toHaveCount(0);
  await expect(page.getByTestId("reception-day-calendar")).toHaveCount(0);
  await expect(page.getByTestId("day-current-time-indicator")).toHaveCount(0);

  releaseStaffResponse();

  await expect(page.getByTestId("reception-calendar-resource-loading")).toHaveCount(0);
  const calendar = page.getByTestId("reception-day-calendar");
  await expect(calendar).toBeVisible();
  await expect(calendar.getByText("청담 원장")).toBeVisible();
});

test("Cheongdam empty reception ignores stale completed calendar queue records", async ({
  page,
}) => {
  const workspaceId = "workspace-clair-cheongdam";

  await page.route(
    `**/api/workspaces/${workspaceId}/reception/queue`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 200,
          queue: [],
          enforcedBy: "reception-queue-read",
        }),
      });
    },
  );
  await page.route(
    `**/api/workspaces/${workspaceId}/reception/calendar/day?**`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 200,
          records: [
            {
              appointment: null,
              encounter: {
                id: "encounter-cheongdam-stale-calendar",
                workspaceId,
                patientId: "patient-cheongdam-stale-calendar",
                guardianId: "guardian-cheongdam-stale-calendar",
                encounterNo: "E-260613-STALE",
                receptionType: "walk_in",
                department: "영상의학과 · 방사선종양학과",
                durationMinutes: 30,
                chiefComplaint: "구토/설사 · n",
                visitPurpose: "구토/설사 · n",
                status: "completed",
                checkedInAt: "2026-06-13T13:40:00+09:00",
                createdAt: "2026-06-13T13:40:00+09:00",
                updatedAt: "2026-06-13T14:10:00+09:00",
              },
              queueEntry: {
                id: "queue-cheongdam-stale-calendar",
                workspaceId,
                encounterId: "encounter-cheongdam-stale-calendar",
                queueType: "consultation",
                status: "done",
                priority: "normal",
                sortOrder: 1,
                enteredAt: "2026-06-13T13:40:00+09:00",
                finishedAt: "2026-06-13T14:10:00+09:00",
              },
            },
          ],
          enforcedBy: "reception-calendar-read",
        }),
      });
    },
  );

  await page.goto(`/w/${workspaceId}/reception?modulePanel=open`);

  await expect(page.getByTestId("schedule-toolbar")).toBeVisible();
  await expect(page.locator('[data-testid^="walkin-card-"]')).toHaveCount(0);
  await expect(page.getByText("환자 미지정 · 구토/설사 · n")).toHaveCount(0);
});

test("Cheongdam day calendar ignores active queue records from a previous operating date", async ({
  page,
}) => {
  const workspaceId = "workspace-clair-cheongdam";

  await page.route(
    `**/api/workspaces/${workspaceId}/reception/queue`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 200,
          queue: [
            {
              encounter: {
                id: "encounter-cheongdam-previous-day-active",
                workspaceId,
                patientId: "49121000-0000-4000-8000-000000000015",
                guardianId: "49120000-0000-4000-8000-000000000015",
                encounterNo: "E-260612-PREV",
                receptionType: "walk_in",
                department: "영상의학과 · 방사선종양학과",
                durationMinutes: 30,
                chiefComplaint: "구토/설사 · n",
                visitPurpose: "구토/설사 · n",
                status: "ordered",
                checkedInAt: "2026-06-12T13:40:00+09:00",
                createdAt: "2026-06-12T13:40:00+09:00",
                updatedAt: "2026-06-12T13:40:00+09:00",
              },
              queueEntry: {
                id: "queue-cheongdam-previous-day-active",
                workspaceId,
                encounterId: "encounter-cheongdam-previous-day-active",
                queueType: "consultation",
                status: "waiting",
                priority: "normal",
                sortOrder: 1,
                enteredAt: "2026-06-12T13:40:00+09:00",
              },
            },
          ],
          enforcedBy: "reception-queue-read",
        }),
      });
    },
  );
  await page.route(
    `**/api/workspaces/${workspaceId}/reception/calendar/day?**`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 200,
          records: [],
          enforcedBy: "reception-calendar-read",
        }),
      });
    },
  );

  await page.goto(`/w/${workspaceId}/reception?modulePanel=open`);

  await expect(page.getByTestId("schedule-toolbar")).toBeVisible();
  await expect(page.locator('[data-testid^="walkin-card-"]')).toHaveCount(0);
  await expect(page.getByText("환자 미지정 · 구토/설사 · n")).toHaveCount(0);
});

test("Cheongdam walk-in dialog does not offer legacy fixture patients before DB lookup", async ({
  page,
}) => {
  const workspaceId = "workspace-clair-cheongdam";

  await page.route(
    `**/api/workspaces/${workspaceId}/reception/queue`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 200,
          queue: [],
          enforcedBy: "reception-queue-read",
        }),
      });
    },
  );
  await page.route(
    `**/api/workspaces/${workspaceId}/reception/calendar/day?**`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 200,
          records: [],
          enforcedBy: "reception-calendar-read",
        }),
      });
    },
  );

  await page.goto(`/w/${workspaceId}/reception?modulePanel=open`);
  await openWalkInReceptionForm(page);

  const walkInForm = page.getByTestId("walk-in-reception-dialog");
  await walkInForm.getByLabel("환자 검색").click();

  await expect(page.getByRole("option", { name: /나비.*오세아/ })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("option", { name: /콩이|코코|하루/ }),
  ).toHaveCount(0);
});

test("Cheongdam walk-in keeps a selected DB lookup patient when the display label re-search is empty", async ({
  page,
}) => {
  const workspaceId = "workspace-clair-cheongdam";
  const patientId = "49121000-0000-4000-8000-000000000001";
  const guardianId = "49120000-0000-4000-8000-000000000001";
  const checkedInAt = `${getLocalDatePrefix()}T12:00:00+09:00`;
  let lookupRequests = 0;
  let createBody: Record<string, unknown> | undefined;

  await page.route(
    `**/api/workspaces/${workspaceId}/reception/queue`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 200,
          queue: [],
          enforcedBy: "reception-queue-read",
        }),
      });
    },
  );
  await page.route(
    `**/api/workspaces/${workspaceId}/reception/calendar/day?**`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 200,
          records: [],
          enforcedBy: "reception-calendar-read",
        }),
      });
    },
  );
  await page.route(
    `**/api/workspaces/${workspaceId}/reception/patient-guardian-lookup?**`,
    async (route) => {
      lookupRequests += 1;
      const query =
        new URL(route.request().url()).searchParams.get("query") ?? "";
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 200,
          enforcedBy: "reception-patient-guardian-lookup",
          patients:
            query === "바둑"
              ? [
                  {
                    patient: {
                      id: patientId,
                      workspaceId,
                      patientNo: "CD-P-0001",
                      name: "바둑이",
                      species: "dog",
                      breed: "말티즈",
                      birthDate: "2021-03-12",
                      sex: "male",
                      neutered: true,
                      handlingCautionLocked: true,
                      status: "active",
                      createdAt: "2026-06-12T00:00:00.000Z",
                      updatedAt: "2026-06-12T00:00:00.000Z",
                    },
                    primaryGuardian: {
                      id: guardianId,
                      workspaceId,
                      name: "김청담",
                      mobilePhone: "010-4912-0001",
                      createdAt: "2026-06-12T00:00:00.000Z",
                      updatedAt: "2026-06-12T00:00:00.000Z",
                    },
                    searchText: "바둑이 말티즈 김청담 010-4912-0001",
                  },
                ]
              : [],
        }),
      });
    },
  );
  await page.route(
    `**/api/workspaces/${workspaceId}/reception/walk-in-encounters`,
    async (route) => {
      createBody = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 201,
          workspaceId,
          enforcedBy: "reception-walk-in-encounter",
          walkIn: {
            encounter: {
              id: "encounter-cheongdam-badugi",
              workspaceId,
              patientId,
              guardianId,
              encounterNo: "E-260612-BADUGI",
              receptionType: "walk_in",
              department: "내과",
              durationMinutes: 30,
              chiefComplaint: createBody.visitPurpose,
              visitPurpose: createBody.visitPurpose,
              status: "waiting",
              checkedInAt,
              createdAt: checkedInAt,
              updatedAt: checkedInAt,
            },
            queueEntry: {
              id: "queue-cheongdam-badugi",
              workspaceId,
              encounterId: "encounter-cheongdam-badugi",
              queueType: "consultation",
              status: "waiting",
              priority: "normal",
              enteredAt: checkedInAt,
            },
          },
        }),
      });
    },
  );

  await page.goto(`/w/${workspaceId}/reception?modulePanel=open`);
  await openWalkInReceptionForm(page);

  const walkInForm = page.getByTestId("walk-in-reception-dialog");
  await walkInForm.getByLabel("환자 검색").fill("바둑");
  await page.getByRole("option", { name: /바둑이.*김청담/ }).click();
  await expect(walkInForm.getByText("검색 결과가 없습니다.")).toHaveCount(0);
  await expect.poll(() => lookupRequests).toBeGreaterThanOrEqual(2);

  await walkInForm.getByLabel("방문목적").fill("첫 내원 상담");
  await walkInForm.getByRole("button", { name: "생성" }).click();

  await expect.poll(() => createBody?.patientId).toBe(patientId);
  expect(createBody).toMatchObject({
    guardianId,
    patientId,
    patientName: "바둑이",
    visitPurpose: "첫 내원 상담",
  });
  await expect(page.getByTestId("walk-in-reception-dialog")).toHaveCount(0);

  const sidePanel = page
    .getByRole("complementary")
    .filter({ hasText: "접수/예약" })
    .first();
  await expect(
    sidePanel.getByTestId(`patient-card-${patientId}`),
  ).toContainText("첫 내원 상담");
  await sidePanel.getByRole("button", { name: /전체/ }).click();
  await expect(sidePanel.locator('[data-testid^="patient-card-"]')).toHaveCount(
    1,
  );

  await sidePanel.getByTestId(`patient-card-${patientId}`).click();
  const detailDrawer = page
    .getByRole("complementary")
    .filter({ hasText: "접수 상세" })
    .last();
  await expect(detailDrawer.getByText("접수 상세").first()).toBeVisible();
  await expect(detailDrawer.getByLabel("보호자 및 동물검색")).toHaveValue(
    /바둑이.*김청담/,
  );
  await expect(detailDrawer.getByLabel("방문 목적")).toHaveValue("첫 내원 상담");

  await page.reload();
  await expect(sidePanel.locator('[data-testid^="patient-card-"]')).toHaveCount(
    0,
  );
  await expect(page.locator('[data-testid^="walkin-card-"]')).toHaveCount(0);
});

test("Cheongdam reception readback hydrates live patient profiles after refresh", async ({
  page,
}) => {
  const workspaceId = "workspace-clair-cheongdam";
  const patientId = "49121000-0000-4000-8000-000000000071";
  const guardianId = "49120000-0000-4000-8000-000000000071";
  const veterinarianId = "49110000-0000-4000-8000-000000000003";
  const encounterId = "encounter-cheongdam-readback-luna";
  const readbackDate = getLocalDatePrefix();
  const readbackAt = `${readbackDate}T14:15:00+09:00`;
  const persistedWalkIn = {
    kind: "encounter_queue",
    encounter: {
      id: encounterId,
      workspaceId,
      patientId,
      guardianId,
      primaryVeterinarianId: veterinarianId,
      encounterNo: "E-260616-LUNA",
      receptionType: "walk_in",
      department: "내과",
      durationMinutes: 30,
      chiefComplaint: "DEN-512 refresh readback",
      visitPurpose: "DEN-512 refresh readback",
      status: "waiting",
      checkedInAt: readbackAt,
      createdAt: readbackAt,
      updatedAt: readbackAt,
    },
    queueEntry: {
      id: "queue-cheongdam-readback-luna",
      workspaceId,
      encounterId,
      queueType: "consultation",
      status: "waiting",
      priority: "normal",
      sortOrder: 1,
      enteredAt: readbackAt,
    },
  };
  await page.route(
    `**/api/workspaces/${workspaceId}/staff?role=vet*`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 200,
          staff: [
            {
              id: veterinarianId,
              displayName: "청담 원장",
              initial: "청",
              roles: ["vet"],
              status: "active",
            },
          ],
        }),
      });
    },
  );
  await page.route(
    `**/api/workspaces/${workspaceId}/reception/queue`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 200,
          queue: [persistedWalkIn],
          enforcedBy: "reception-queue-read",
        }),
      });
    },
  );
  await page.route(
    `**/api/workspaces/${workspaceId}/reception/calendar/day?**`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 200,
          workspaceId,
          date: readbackDate,
          records: [persistedWalkIn],
          enforcedBy: "reception-calendar-read",
        }),
      });
    },
  );
  await page.route(
    `**/api/workspaces/${workspaceId}/reception/patient-guardian-lookup?**`,
    async (route) => {
      const query =
        new URL(route.request().url()).searchParams.get("query") ?? "";
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 200,
          enforcedBy: "reception-patient-guardian-lookup",
          patients:
            query === ""
              ? [
                  {
                    patient: {
                      id: patientId,
                      workspaceId,
                      patientNo: "CD-P-071",
                      name: "루나",
                      species: "cat",
                      breed: "Korean Shorthair",
                      sex: "female",
                      neutered: true,
                      handlingCautionLocked: true,
                      status: "active",
                      createdAt: "2026-06-16T00:00:00+09:00",
                      updatedAt: "2026-06-16T00:00:00+09:00",
                    },
                    primaryGuardian: {
                      id: guardianId,
                      workspaceId,
                      name: "박지유",
                      mobilePhone: "010-7100-0071",
                      createdAt: "2026-06-16T00:00:00+09:00",
                      updatedAt: "2026-06-16T00:00:00+09:00",
                    },
                    searchText: "루나 박지유 010-7100-0071",
                  },
                ]
              : [],
        }),
      });
    },
  );

  await page.goto(`/w/${workspaceId}/reception?modulePanel=open`);

  const sidePanel = page.locator("aside").first();
  const patientCard = sidePanel.getByTestId(`patient-card-${patientId}`);
  await expect(patientCard).toContainText("루나");
  await expect(patientCard).toContainText("박지유");
  await expect(patientCard).toContainText("DEN-512 refresh readback");
  await expect(patientCard).toContainText("청담 원장");
  await expect(page.getByTestId(`walkin-card-${encounterId}`)).toContainText(
    "루나",
  );
  await expect(page.getByTestId(`walkin-card-${encounterId}`)).toContainText(
    "14:15",
  );

  await page.reload();

  await expect(patientCard).toContainText("루나");
  await expect(patientCard).toContainText("청담 원장");
  await expect(page.getByTestId(`walkin-card-${encounterId}`)).toContainText(
    "DEN-512 refresh readback",
  );
});

test("Cheongdam encounter edit keeps veterinarian assignment DB-backed across drawer queue and calendar", async ({
  page,
}) => {
  const workspaceId = "workspace-clair-cheongdam";
  const patientId = "49121000-0000-4000-8000-000000000081";
  const guardianId = "49120000-0000-4000-8000-000000000081";
  const chiefVetId = "49110000-0000-4000-8000-000000000001";
  const staffVetId = "49110000-0000-4000-8000-000000000003";
  const encounterId = "encounter-cheongdam-vet-assignment";
  const readbackDate = getLocalDatePrefix();
  const readbackAt = `${readbackDate}T10:30:00+09:00`;
  let currentVeterinarianId: string | undefined = "user-vet-suji";
  let updateCount = 0;
  let latestUpdateBody: Record<string, unknown> | undefined;
  const buildPersistedWalkIn = () => ({
    kind: "encounter_queue",
    encounter: {
      id: encounterId,
      workspaceId,
      patientId,
      guardianId,
      primaryVeterinarianId: currentVeterinarianId,
      encounterNo: "E-260623-VET",
      receptionType: "walk_in",
      department: "영상의학과 · 방사선종양학과",
      durationMinutes: 30,
      chiefComplaint: "담당의 회귀 확인",
      visitPurpose: "담당의 회귀 확인",
      receptionMemo: "미지정 카드 담당의 수정",
      status: "waiting",
      checkedInAt: readbackAt,
      createdAt: readbackAt,
      updatedAt: readbackAt,
    },
    queueEntry: {
      id: "queue-cheongdam-vet-assignment",
      workspaceId,
      encounterId,
      queueType: "consultation",
      status: "waiting",
      priority: "normal",
      sortOrder: 1,
      enteredAt: readbackAt,
    },
  });

  await page.route(
    `**/api/workspaces/${workspaceId}/staff?role=vet*`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 200,
          staff: [
            {
              id: chiefVetId,
              displayName: "청담 원장",
              initial: "원",
              roles: ["vet"],
              status: "active",
            },
            {
              id: staffVetId,
              displayName: "청담 수의사",
              initial: "수",
              roles: ["vet"],
              status: "active",
            },
          ],
        }),
      });
    },
  );
  await page.route(
    `**/api/workspaces/${workspaceId}/reception/queue`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 200,
          queue: [buildPersistedWalkIn()],
          enforcedBy: "reception-queue-read",
        }),
      });
    },
  );
  await page.route(
    `**/api/workspaces/${workspaceId}/reception/calendar/day?**`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 200,
          workspaceId,
          date: readbackDate,
          records: [buildPersistedWalkIn()],
          enforcedBy: "reception-calendar-read",
        }),
      });
    },
  );
  await page.route(
    `**/api/workspaces/${workspaceId}/reception/patient-guardian-lookup?**`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 200,
          enforcedBy: "reception-patient-guardian-lookup",
          patients: [
            {
              patient: {
                id: patientId,
                workspaceId,
                patientNo: "CD-P-081",
                name: "구름",
                species: "dog",
                breed: "Samoyed",
                sex: "female",
                neutered: true,
                weightKg: 7,
                handlingCautionLocked: false,
                status: "active",
                createdAt: "2026-06-23T00:00:00+09:00",
                updatedAt: "2026-06-23T00:00:00+09:00",
              },
              primaryGuardian: {
                id: guardianId,
                workspaceId,
                name: "문지아",
                mobilePhone: "010-4911-0016",
                createdAt: "2026-06-23T00:00:00+09:00",
                updatedAt: "2026-06-23T00:00:00+09:00",
              },
              searchText: "구름 문지아 010-4911-0016",
            },
          ],
        }),
      });
    },
  );
  await page.route(
    `**/api/workspaces/${workspaceId}/reception/encounters/${encounterId}`,
    async (route) => {
      updateCount += 1;
      latestUpdateBody = route.request().postDataJSON() as Record<
        string,
        unknown
      >;
      currentVeterinarianId =
        typeof latestUpdateBody.primaryVeterinarianId === "string"
          ? latestUpdateBody.primaryVeterinarianId
          : undefined;
      const persistedWalkIn = buildPersistedWalkIn();

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 200,
          workspaceId,
          update: {
            encounter: persistedWalkIn.encounter,
            patient: {
              id: patientId,
              workspaceId,
              patientNo: "CD-P-081",
              name: "구름",
              species: "dog",
              breed: "Samoyed",
              sex: "female",
              neutered: true,
              weightKg: 7,
              handlingCautionLocked: false,
              status: "active",
              createdAt: "2026-06-23T00:00:00+09:00",
              updatedAt: "2026-06-23T00:00:00+09:00",
            },
            queueEntry: persistedWalkIn.queueEntry,
          },
          enforcedBy: "reception-encounter-update",
        }),
      });
    },
  );

  await page.goto(
    `/w/${workspaceId}/reception?modulePanel=open&drawer=reception-encounter%3A${encounterId}`,
  );

  const sidePanel = page.locator("aside").first();
  const detailDrawer = page.getByTestId("reception-right-panel");
  const queueCard = sidePanel.getByTestId(`patient-card-${patientId}`);
  const calendarCard = page.getByTestId(`walkin-card-${encounterId}`);
  const drawerHeader = detailDrawer.getByText("접수 상세").first();
  const animalReadonlyTextbox = detailDrawer.locator("input").nth(0);
  const guardianReadonlyTextbox = detailDrawer.locator("input").nth(1);
  const veterinarianReadonlyTextbox = detailDrawer.locator("input").nth(4);
  const departmentCombobox = detailDrawer.getByRole("combobox", {
    name: "진료과",
  });
  const veterinarianCombobox = detailDrawer.getByRole("combobox", {
    name: "담당의",
  });
  const weightTextbox = detailDrawer.getByRole("textbox", {
    name: "체중",
  });
  const durationCombobox = detailDrawer.getByRole("combobox", {
    name: "예상소요시간",
  });
  await expect(queueCard).toBeVisible({ timeout: 15_000 });
  await expect(calendarCard).toBeVisible({ timeout: 15_000 });
  await queueCard.click();
  await expect(detailDrawer).toBeVisible();
  await expect(drawerHeader).toBeVisible();
  await expect(animalReadonlyTextbox).toHaveValue(/구름.*Samoyed/);
  await expect(guardianReadonlyTextbox).toHaveValue(/문지아.*010-4911-0016/);
  await expect(detailDrawer).not.toContainText("CD-P-081");
  await expect(detailDrawer).not.toContainText("E-260623-VET");
  await expect(detailDrawer).not.toContainText(chiefVetId);
  await expect(veterinarianReadonlyTextbox).toHaveValue("담당의 미지정");
  await expect(queueCard).not.toContainText("이수지");
  await expect(calendarCard).not.toContainText("이수지");

  await detailDrawer.getByTestId("reception-encounter-edit-open").click();
  await page.getByTestId("reception-encounter-edit-confirm").click();
  const [departmentBox, veterinarianBox, weightBox, durationBox] = await Promise.all([
    departmentCombobox.boundingBox(),
    veterinarianCombobox.boundingBox(),
    weightTextbox.boundingBox(),
    durationCombobox.boundingBox(),
  ]);
  expect(departmentBox?.height).toBeGreaterThan(0);
  expect(veterinarianBox?.height).toBeGreaterThan(0);
  expect(weightBox?.height).toBeGreaterThan(0);
  expect(durationBox?.height).toBeGreaterThan(0);
  await expect(veterinarianCombobox).toContainText("수의사 미지정");
  await expect(veterinarianCombobox).not.toContainText("user-vet-suji");
  await veterinarianCombobox.click();
  await page.getByRole("option", { name: "청담 원장" }).click();
  await detailDrawer.getByTestId("reception-encounter-edit-save").click();

  await expect.poll(() => updateCount).toBe(1);
  expect(latestUpdateBody).toMatchObject({
    primaryVeterinarianId: chiefVetId,
  });
  await expect(page.getByText("접수 수정이 완료되었습니다")).toBeVisible();
  await expect(veterinarianReadonlyTextbox).toHaveValue("청담 원장");
  await expect(detailDrawer).not.toContainText(chiefVetId);
  await expect(queueCard).toContainText("청담 원장");

  await detailDrawer.getByTestId("reception-encounter-edit-open").click();
  await page.getByTestId("reception-encounter-edit-confirm").click();
  await expect(veterinarianCombobox).toContainText("청담 원장");
  await expect(veterinarianCombobox).not.toContainText(chiefVetId);
  await veterinarianCombobox.click();
  await page.getByRole("option", { name: "수의사 미지정" }).click();
  await detailDrawer.getByTestId("reception-encounter-edit-save").click();

  await expect.poll(() => updateCount).toBe(2);
  expect(latestUpdateBody).not.toHaveProperty("primaryVeterinarianId");
  await expect(veterinarianReadonlyTextbox).toHaveValue("담당의 미지정");
  await expect(queueCard).not.toContainText("청담 원장");
  await expect(calendarCard).not.toContainText("청담 원장");
});

test("Cheongdam walk-in create failure does not say the selected DB patient is missing", async ({
  page,
}) => {
  const workspaceId = "workspace-clair-cheongdam";
  const patientId = "49121000-0000-4000-8000-000000000023";
  const guardianId = "49120000-0000-4000-8000-000000000023";

  await page.route(
    `**/api/workspaces/${workspaceId}/reception/queue`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 200,
          queue: [],
          enforcedBy: "reception-queue-read",
        }),
      });
    },
  );
  await page.route(
    `**/api/workspaces/${workspaceId}/reception/calendar/day?**`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 200,
          records: [],
          enforcedBy: "reception-calendar-read",
        }),
      });
    },
  );
  await page.route(
    `**/api/workspaces/${workspaceId}/reception/patient-guardian-lookup?**`,
    async (route) => {
      const query =
        new URL(route.request().url()).searchParams.get("query") ?? "";
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 200,
          enforcedBy: "reception-patient-guardian-lookup",
          patients:
            query === "토리"
              ? [
                  {
                    patient: {
                      id: patientId,
                      workspaceId,
                      patientNo: "CD-P-023",
                      name: "토리",
                      species: "dog",
                      breed: "Mixed small dog",
                      birthDate: "2014-05-20",
                      sex: "male",
                      neutered: true,
                      handlingCautionLocked: true,
                      status: "active",
                      createdAt: "2026-06-12T00:00:00.000Z",
                      updatedAt: "2026-06-12T00:00:00.000Z",
                    },
                    primaryGuardian: {
                      id: guardianId,
                      workspaceId,
                      name: "심도겸",
                      mobilePhone: "010-4912-0023",
                      createdAt: "2026-06-12T00:00:00.000Z",
                      updatedAt: "2026-06-12T00:00:00.000Z",
                    },
                    searchText: "토리 Mixed small dog 심도겸 010-4912-0023",
                  },
                ]
              : [],
        }),
      });
    },
  );
  await page.route(
    `**/api/workspaces/${workspaceId}/reception/walk-in-encounters`,
    async (route) => {
      await route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({
          ok: false,
          status: 409,
          denialReason: "patient_unavailable",
        }),
      });
    },
  );

  await page.goto(`/w/${workspaceId}/reception?modulePanel=open`);
  await openWalkInReceptionForm(page);

  const walkInForm = page.getByTestId("walk-in-reception-dialog");
  await walkInForm.getByLabel("환자 검색").fill("토리");
  await page.getByRole("option", { name: /토리.*심도겸/ }).click();
  await walkInForm.getByLabel("방문목적").fill("구토");
  await walkInForm.getByRole("button", { name: "생성" }).click();

  await expect(page.getByText("접수를 생성할 수 없습니다.")).toBeVisible();
  await expect(page.getByText("접수할 환자를 찾을 수 없습니다.")).toHaveCount(
    0,
  );
});

test("server-backed walk-in encounter sends minimal reception payload", async ({
  page,
}) => {
  let capturedBody: Record<string, unknown> | null = null;
  let createdWalkIn:
    | {
        encounter: Record<string, unknown>;
        queueEntry: Record<string, unknown>;
      }
    | null = null;

  await page.route(
    "**/api/workspaces/clair-demo/reception/walk-in-encounters",
    async (route) => {
      capturedBody = route.request().postDataJSON() as Record<string, unknown>;
      const checkedInAt =
        typeof capturedBody.plannedStartAt === "string"
          ? capturedBody.plannedStartAt
          : "2026-05-01T10:45:00+09:00";
      createdWalkIn = {
        encounter: {
          id: "encounter-live-walkin-dubu",
          workspaceId: "clair-demo",
          patientId: "patient-dubu",
          guardianId: "guardian-jung-harin",
          primaryVeterinarianId: "user-vet-doyun",
          encounterNo: "E-LIVE-0001",
          receptionType: "walk_in",
          department: "재활",
          durationMinutes: 30,
          chiefComplaint: capturedBody.visitPurpose ?? "현장 접수",
          visitPurpose: capturedBody.visitPurpose ?? "현장 접수",
          receptionMemo: "보호자가 계단 보행을 걱정함",
          status: "waiting",
          checkedInAt,
          createdAt: checkedInAt,
          updatedAt: checkedInAt,
        },
        queueEntry: {
          id: "queue-live-walkin-dubu",
          workspaceId: "clair-demo",
          encounterId: "encounter-live-walkin-dubu",
          queueType: "consultation",
          status: "waiting",
          priority: "normal",
          enteredAt: checkedInAt,
        },
      };
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          workspaceId: "clair-demo",
          walkIn: createdWalkIn,
          enforcedBy: "reception-walk-in-encounter",
        }),
      });
    },
  );
  await page.route(
    "**/api/workspaces/clair-demo/chart/live-queue",
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 200,
          queue: createdWalkIn
            ? [
                {
                  ...createdWalkIn,
                  patient: {
                    id: "patient-dubu",
                    workspaceId: "clair-demo",
                    patientNo: "P-260501-003",
                    name: "두부",
                    species: "dog",
                    breed: "비숑",
                    estimatedAgeText: "4세",
                    sex: "male",
                    handlingCautionLocked: true,
                    status: "active",
                    createdAt: "2026-05-01T00:00:00+09:00",
                    updatedAt: "2026-05-01T00:00:00+09:00",
                  },
                  primaryGuardian: {
                    id: "guardian-jung-harin",
                    workspaceId: "clair-demo",
                    name: "정하린",
                    mobilePhone: "010-4922-8821",
                    createdAt: "2026-05-01T00:00:00+09:00",
                    updatedAt: "2026-05-01T00:00:00+09:00",
                  },
                  veterinarianName: "김도윤",
                },
              ]
            : [],
          enforcedBy: "chart-live-queue-read",
        }),
      });
    },
  );

  await page.goto("/w/clair-demo/reception");
  await openWalkInReceptionForm(page);

  const walkInForm = page.getByTestId("walk-in-reception-dialog");
  await walkInForm.getByLabel("환자 검색").click();
  await walkInForm.getByLabel("환자 검색").fill("두부");
  await page.getByRole("option", { name: /두부.*정하린/ }).click();
  await expect(walkInForm.getByLabel("체중")).toHaveValue("8.40");
  await walkInForm.getByLabel("체중").fill("8.65");
  await walkInForm.getByLabel("방문목적").fill("재활 · 보행 재검 및 통증 상담");
  await walkInForm.getByLabel("담당의").click();
  await page.getByRole("option", { name: "김도윤" }).click();
  await walkInForm.getByLabel("접수 메모").fill("보호자가 계단 보행을 걱정함");
  await expect(walkInForm.getByLabel("접수시간")).toHaveValue("오전 10:45");
  await walkInForm.getByRole("button", { name: "생성" }).click();

  expect(capturedBody).toMatchObject({
    patientId: "patient-dubu",
    guardianId: "guardian-jung-harin",
    primaryVeterinarianId: "user-vet-doyun",
    department: "영상의학과 · 방사선종양학과",
    durationMinutes: 30,
    visitPurpose: "재활 · 보행 재검 및 통증 상담",
    weightKg: 8.65,
    memo: "보호자가 계단 보행을 걱정함",
    plannedStartAt: "2026-05-01T10:45:00+09:00",
  });
  await expect(page.getByRole("button", { name: "접수 확인하기" })).toBeVisible();
  await page.getByRole("button", { name: "접수 확인하기" }).click();

  await expect(page).toHaveURL(
    /\/w\/clair-demo\/reception\?.*encounterId=encounter-live-walkin-dubu/,
  );
  await expect(page).toHaveURL(
    /drawer=reception-encounter%3Aencounter-live-walkin-dubu/,
  );
  const detailPanel = page.getByTestId("reception-right-panel");
  await expect(detailPanel).toContainText("접수 상세");
  await expect(detailPanel).toContainText(
    "보행 재검 및 통증 상담",
  );

  const dubuCard = page
    .getByTestId("patient-card-patient-dubu")
    .filter({ hasText: "보행 재검 및 통증 상담" });
  await expect(dubuCard).toContainText("두부");
  await expect(dubuCard).toContainText("보행 재검 및 통증 상담");
  await expect(dubuCard).toContainText("김도윤");

  await dubuCard.hover();
  await page
    .getByTestId("reception-card-action-encounter-live-walkin-dubu")
    .click();
  await page
    .getByTestId(
      "reception-queue-action-chart-encounter-encounter-live-walkin-dubu",
    )
    .click();

  await expect(page).toHaveURL(
    /\/w\/clair-demo\/treatment\?.*encounterId=encounter-live-walkin-dubu/,
  );
  await expect(
    page.getByLabel("환자 컨텍스트 정보").getByText("E-LIVE-0001"),
  ).toBeVisible();
  await expect(page.getByText(/두부/).first()).toBeVisible();
});

test("walk-in persistence regression reloads from queue and calendar reads", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const persistedWalkIn = {
    kind: "encounter_queue",
    encounter: {
      id: "encounter-e2e-walkin-dubu",
      workspaceId: "clair-demo",
      patientId: "patient-dubu",
      guardianId: "guardian-jung-harin",
      primaryVeterinarianId: "user-vet-doyun",
      encounterNo: "E-E2E-0001",
      receptionType: "walk_in",
      department: "재활",
      durationMinutes: 30,
      chiefComplaint: "DEN-65 reload walk-in",
      visitPurpose: "DEN-65 reload walk-in",
      receptionMemo: "reload verification",
      status: "waiting",
      checkedInAt: "2026-05-01T01:15:00.000Z",
      createdAt: "2026-05-01T01:15:00.000Z",
      updatedAt: "2026-05-01T01:15:00.000Z",
    },
    queueEntry: {
      id: "queue-e2e-walkin-dubu",
      workspaceId: "clair-demo",
      encounterId: "encounter-e2e-walkin-dubu",
      queueType: "consultation",
      status: "waiting",
      priority: "normal",
      sortOrder: 1,
      enteredAt: "2026-05-01T01:15:00.000Z",
    },
  };
  let walkInCreated = false;
  let walkInCancelled = false;
  let selectedReadDate = "2026-05-01";
  const getPersistedWalkInReadback = () => {
    const startedAt = `${selectedReadDate}T01:15:00.000Z`;
    const finishedAt = `${selectedReadDate}T01:30:00.000Z`;

    return {
      ...persistedWalkIn,
      encounter: {
        ...persistedWalkIn.encounter,
        status: walkInCancelled ? "cancelled" : "waiting",
        checkedInAt: startedAt,
        createdAt: startedAt,
        updatedAt: walkInCancelled ? finishedAt : startedAt,
      },
      queueEntry: {
        ...persistedWalkIn.queueEntry,
        status: walkInCancelled ? "cancelled" : "waiting",
        enteredAt: startedAt,
        ...(walkInCancelled ? { finishedAt } : {}),
      },
    };
  };

  await page.route(
    "**/api/workspaces/clair-demo/reception/walk-in-encounters",
    async (route) => {
      walkInCreated = true;
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          workspaceId: "clair-demo",
          walkIn: getPersistedWalkInReadback(),
          enforcedBy: "reception-walk-in-encounter",
        }),
      });
    },
  );
  await page.route("**/reception/queue**", async (route) => {
    selectedReadDate =
      new URL(route.request().url()).searchParams.get("date") ?? selectedReadDate;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        status: 200,
        queue: walkInCreated ? [getPersistedWalkInReadback()] : [],
        enforcedBy: "reception-queue-read",
      }),
    });
  });
  await page.route("**/reception/calendar/day**", async (route) => {
    selectedReadDate =
      new URL(route.request().url()).searchParams.get("date") ?? selectedReadDate;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        status: 200,
        workspaceId: "clair-demo",
        date: selectedReadDate,
        records: walkInCreated && !walkInCancelled ? [getPersistedWalkInReadback()] : [],
        enforcedBy: "reception-calendar-read",
      }),
    });
  });
  await page.route(
    "**/api/workspaces/clair-demo/reception/encounters/encounter-e2e-walkin-dubu/cancel",
    async (route) => {
      walkInCancelled = true;
      expect(route.request().method()).toBe("POST");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 200,
          workspaceId: "clair-demo",
          cancellation: {
            encounter: getPersistedWalkInReadback().encounter,
            queueEntry: getPersistedWalkInReadback().queueEntry,
          },
          enforcedBy: "reception-encounter-cancel",
        }),
      });
    },
  );

  await page.goto("/w/clair-demo/reception");
  await openWalkInReceptionForm(page);

  const walkInForm = page.getByTestId("walk-in-reception-dialog");
  await walkInForm.getByLabel("환자 검색").click();
  await walkInForm.getByLabel("환자 검색").fill("두부");
  await page.getByRole("option", { name: /두부.*정하린/ }).click();
  await walkInForm.getByLabel("방문목적").fill("DEN-65 reload walk-in");
  await walkInForm.getByLabel("담당의").click();
  await page.getByRole("option", { name: "김도윤" }).click();
  await walkInForm.getByRole("button", { name: "생성" }).click();

  await expect(
    page.getByTestId("walkin-card-encounter-e2e-walkin-dubu"),
  ).toHaveAttribute("aria-label", /DEN-65 reload walk-in/);
  await expect(
    page.getByTestId("walkin-card-encounter-e2e-walkin-dubu"),
  ).toContainText("10:45");
  await expect(
    page.locator("aside").first().getByRole("button", {
      name: /DEN-65 reload walk-in/,
    }),
  ).toContainText("김도윤");

  await page.reload();

  await expect(page.getByText("DEN-65 reload walk-in").first()).toBeVisible({
    timeout: 15_000,
  });
  await expect(
    page.locator("aside").first().getByRole("button", {
      name: /DEN-65 reload walk-in/,
    }),
  ).toContainText("김도윤");
  await expect(
    page.getByTestId("walkin-card-encounter-e2e-walkin-dubu"),
  ).toHaveAttribute("aria-label", /DEN-65 reload walk-in/);
  await expect(
    page.getByTestId("walkin-card-encounter-e2e-walkin-dubu"),
  ).toContainText("10:15");

  await page.getByTestId("walkin-card-encounter-e2e-walkin-dubu").click();
  const detailDrawer = page
    .getByRole("complementary")
    .filter({ hasText: "접수 상세" })
    .last();
  await expect(detailDrawer.getByText("접수 상세").first()).toBeVisible();
  await expect(
    detailDrawer.getByTestId("reception-encounter-cancel-open"),
  ).toBeVisible();

  await detailDrawer.getByTestId("reception-encounter-cancel-open").click();
  await expect(page.getByRole("dialog")).toContainText("접수를 취소할까요?");
  await page.getByTestId("reception-encounter-cancel-confirm").click();

  await expect(page.getByText("접수가 취소되었습니다")).toBeVisible();
  await expect(
    page.getByTestId("walkin-card-encounter-e2e-walkin-dubu"),
  ).toHaveCount(0);
  await expect(page.getByTestId("reception-queue-status-cancelled")).toContainText(
    "취소",
  );
  await expect(page.getByTestId("reception-queue-status-cancelled")).toContainText(
    "두부",
  );
});

test("reception walk-in dialog uses DB-backed patient lookup states", async ({
  page,
}) => {
  const lookupQueries: string[] = [];

  await page.route(
    "**/api/workspaces/clair-demo/reception/patient-guardian-lookup?query=*",
    async (route) => {
      const url = new URL(route.request().url());
      const query = url.searchParams.get("query") ?? "";
      lookupQueries.push(query);

      if (query === "오류") {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ ok: false, error: "db_read_failed" }),
        });
        return;
      }

      if (query === "없는") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            patients: [],
            enforcedBy: "reception-patient-guardian-lookup",
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          patients: [
            {
              patient: {
                id: "patient-live-luna",
                workspaceId: "clair-demo",
                patientNo: "P-LIVE-0001",
                name: "루나",
                species: "cat",
                breed: "Korean Shorthair",
                sex: "female",
                neutered: true,
                handlingCautionLocked: true,
                status: "active",
                createdAt: "2026-05-19T00:00:00.000Z",
                updatedAt: "2026-05-19T00:00:00.000Z",
              },
              primaryGuardian: {
                id: "guardian-live-jiyu",
                workspaceId: "clair-demo",
                name: "박지유",
                mobilePhone: "010-2222-3333",
                createdAt: "2026-05-19T00:00:00.000Z",
                updatedAt: "2026-05-19T00:00:00.000Z",
              },
            },
          ],
          enforcedBy: "reception-patient-guardian-lookup",
        }),
      });
    },
  );

  await page.goto("/w/clair-demo/reception");
  await openWalkInReceptionForm(page);

  const walkInForm = page.getByTestId("walk-in-reception-dialog");
  await walkInForm.getByLabel("환자 검색").click();
  await expect(page.getByRole("listbox", { name: "검색 결과" })).toHaveCount(0);
  await walkInForm.getByLabel("환자 검색").fill("루");
  await expect(page.getByRole("listbox", { name: "검색 결과" })).toBeVisible();
  await expect.poll(() => lookupQueries.includes("루")).toBe(true);

  lookupQueries.length = 0;
  await walkInForm.getByLabel("환자 검색").fill("");
  await walkInForm.getByLabel("환자 검색").fill("루");
  await walkInForm.getByLabel("환자 검색").fill("루나");
  await expect(page.getByRole("option", { name: /루나.*박지유/ })).toBeVisible();
  await expect.poll(() => lookupQueries).toEqual(["루나"]);
  await page.getByRole("option", { name: /루나.*박지유/ }).click();
  await expect(walkInForm.getByLabel("환자 검색")).toHaveValue(/루나/);
  await page.waitForTimeout(350);
  expect(lookupQueries).toEqual(["루나"]);

  await walkInForm.getByLabel("환자 검색").fill("없는");
  await expect(
    page
      .getByRole("listbox", { name: "검색 결과" })
      .getByText("검색 결과가 없습니다."),
  ).toBeVisible();

  await walkInForm.getByLabel("환자 검색").fill("오류");
  await expect(
    page
      .getByRole("listbox", { name: "검색 결과" })
      .getByText("환자 검색을 불러오지 못했습니다."),
  ).toBeVisible();
});

test("reservation create drawer uses DB-backed patient lookup states", async ({
  page,
}) => {
  const lookupQueries: string[] = [];

  await page.route(
    "**/api/workspaces/workspace-clair-cheongdam/reception/patient-guardian-lookup?query=*",
    async (route) => {
      const query = new URL(route.request().url()).searchParams.get("query") ?? "";
      lookupQueries.push(query);

      if (query === "오류") {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ ok: false, error: "db_read_failed" }),
        });
        return;
      }

      if (query === "없는") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            patients: [],
            enforcedBy: "reception-patient-guardian-lookup",
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          patients: [
            {
              patient: {
                id: "49121000-0000-4000-8000-000000000004",
                workspaceId: "workspace-clair-cheongdam",
                patientNo: "CD-P-0004",
                name: "초코",
                species: "dog",
                breed: "Pomeranian",
                sex: "male",
                neutered: true,
                birthDate: "2017-06-01",
                weightKg: 4.2,
                handlingCautionLocked: false,
                status: "active",
                createdAt: "2026-06-01T00:00:00.000Z",
                updatedAt: "2026-06-01T00:00:00.000Z",
              },
              primaryGuardian: {
                id: "49120000-0000-4000-8000-000000000004",
                workspaceId: "workspace-clair-cheongdam",
                name: "최도현",
                mobilePhone: "010-4911-0004",
                createdAt: "2026-06-01T00:00:00.000Z",
                updatedAt: "2026-06-01T00:00:00.000Z",
              },
            },
          ],
          enforcedBy: "reception-patient-guardian-lookup",
        }),
      });
    },
  );

  await page.goto(
    "/w/workspace-clair-cheongdam/reception?modulePanel=open&drawer=reception-reservation-form%3Anew",
  );

  const reservationDrawer = page.getByTestId("reservation-create-drawer");
  await expect(reservationDrawer).toBeVisible();

  await reservationDrawer.getByLabel("환자 검색").fill("초");
  await expect(
    page.getByRole("option", { name: /초코.*최도현/ }),
  ).toBeVisible();
  await expect.poll(() => lookupQueries.includes("초")).toBe(true);

  lookupQueries.length = 0;
  await reservationDrawer.getByLabel("환자 검색").fill("");
  await reservationDrawer.getByLabel("환자 검색").fill("초");
  await reservationDrawer.getByLabel("환자 검색").fill("초코");
  await expect(
    page.getByRole("option", { name: /초코.*최도현/ }),
  ).toBeVisible();
  await expect.poll(() => lookupQueries).toEqual(["초코"]);
  await page.getByRole("option", { name: /초코.*최도현/ }).click();
  await expect(reservationDrawer.getByLabel("환자 검색")).toHaveValue(/초코/);
  await page.waitForTimeout(350);
  expect(lookupQueries).toEqual(["초코"]);

  await reservationDrawer.getByLabel("환자 검색").fill("없는");
  await expect(page.getByText("검색 결과가 없습니다.")).toBeVisible();

  await reservationDrawer.getByLabel("환자 검색").fill("오류");
  await expect(
    page.getByText("환자 검색을 불러오지 못했습니다."),
  ).toBeVisible();
});

test("Cheongdam reservation create omits mock veterinarian fallback when staff lookup fails", async ({
  page,
}) => {
  await freezeBrowserClock(page, "2026-06-17T08:50:00+09:00");

  let appointmentCreateCount = 0;
  let latestAppointmentBody: Record<string, unknown> | undefined;

  await page.route(
    "**/api/workspaces/workspace-clair-cheongdam/staff?role=vet*",
    async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ ok: false, error: "db_read_failed" }),
      });
    },
  );
  await page.route(
    "**/api/workspaces/workspace-clair-cheongdam/reception/calendar/day**",
    async (route) => {
      const date = new URL(route.request().url()).searchParams.get("date");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 200,
          workspaceId: "workspace-clair-cheongdam",
          date,
          records: [],
          enforcedBy: "reception-calendar-read",
        }),
      });
    },
  );
  await page.route(
    "**/api/workspaces/workspace-clair-cheongdam/reception/queue",
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 200,
          workspaceId: "workspace-clair-cheongdam",
          queue: [],
          enforcedBy: "reception-queue-read",
        }),
      });
    },
  );
  await page.route(
    "**/api/workspaces/workspace-clair-cheongdam/reception/patient-guardian-lookup?query=*",
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          patients: [
            {
              patient: {
                id: "49121000-0000-4000-8000-000000000004",
                workspaceId: "workspace-clair-cheongdam",
                patientNo: "CD-P-0004",
                name: "초코",
                species: "dog",
                breed: "Pomeranian",
                sex: "male",
                neutered: true,
                birthDate: "2017-06-01",
                weightKg: 4.2,
                handlingCautionLocked: false,
                status: "active",
                createdAt: "2026-06-01T00:00:00.000Z",
                updatedAt: "2026-06-01T00:00:00.000Z",
              },
              primaryGuardian: {
                id: "49120000-0000-4000-8000-000000000004",
                workspaceId: "workspace-clair-cheongdam",
                name: "최도현",
                mobilePhone: "010-4911-0004",
                createdAt: "2026-06-01T00:00:00.000Z",
                updatedAt: "2026-06-01T00:00:00.000Z",
              },
            },
          ],
          enforcedBy: "reception-patient-guardian-lookup",
        }),
      });
    },
  );
  await page.route(
    "**/api/workspaces/workspace-clair-cheongdam/reception/appointments",
    async (route) => {
      appointmentCreateCount += 1;
      latestAppointmentBody = route.request().postDataJSON() as Record<
        string,
        unknown
      >;
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 201,
          workspaceId: "workspace-clair-cheongdam",
          appointment: {
            id: "appointment-cheongdam-no-mock-vet",
            workspaceId: "workspace-clair-cheongdam",
            patientId: latestAppointmentBody.patientId,
            guardianId: latestAppointmentBody.guardianId,
            scheduledStartAt: latestAppointmentBody.scheduledStartAt,
            scheduledEndAt: "2026-06-17T09:30:00+09:00",
            visitPurpose: latestAppointmentBody.reservationMemo,
            symptomNote: latestAppointmentBody.reservationMemo,
            status: "confirmed",
            createdByUserId: "49110000-0000-4000-8000-000000000001",
            createdAt: "2026-06-17T09:00:00+09:00",
            updatedAt: "2026-06-17T09:00:00+09:00",
          },
          enforcedBy: "reception-appointment-create",
        }),
      });
    },
  );

  await page.goto(
    "/w/workspace-clair-cheongdam/reception?modulePanel=open&drawer=reception-reservation-form%3Anew",
  );

  const reservationDrawer = page.getByTestId("reservation-create-drawer");
  await expect(reservationDrawer).toBeVisible();
  await expect(reservationDrawer.getByLabel("담당의")).toContainText(
    "담당의를 선택해주세요",
  );
  await reservationDrawer.getByLabel("환자 검색").fill("초코");
  await page.getByRole("option", { name: /초코.*최도현/ }).click();
  await reservationDrawer.getByLabel("예약 메모").fill("mock 담당의 회귀");
  await reservationDrawer.getByRole("button", { name: "생성" }).click();

  await expect.poll(() => appointmentCreateCount).toBe(1);
  expect(latestAppointmentBody).toBeDefined();
  expect(latestAppointmentBody).not.toHaveProperty("assignedVeterinarianId");
  expect(latestAppointmentBody).toMatchObject({
    guardianId: "49120000-0000-4000-8000-000000000004",
    patientId: "49121000-0000-4000-8000-000000000004",
    reservationMemo: "mock 담당의 회귀",
  });
});

test("Cheongdam reservation create uses UUID veterinarian and renders detail readback", async ({
  page,
}) => {
  await freezeBrowserClock(page, "2026-06-25T23:50:00+09:00");

  let createdAppointment: Record<string, unknown> | null = null;
  let latestAppointmentBody: Record<string, unknown> | undefined;

  await page.route(
    "**/api/workspaces/workspace-clair-cheongdam/staff?role=vet*",
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 200,
          staff: [
            {
              id: "49110000-0000-4000-8000-000000000003",
              displayName: "청담 원장",
              initial: "원",
              roles: ["vet"],
              status: "active",
            },
          ],
          enforcedBy: "workspace-staff-read",
        }),
      });
    },
  );
  await page.route(
    "**/api/workspaces/workspace-clair-cheongdam/reception/calendar/day**",
    async (route) => {
      const date = new URL(route.request().url()).searchParams.get("date");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 200,
          workspaceId: "workspace-clair-cheongdam",
          date,
          records: createdAppointment ? [{ appointment: createdAppointment }] : [],
          enforcedBy: "reception-calendar-read",
        }),
      });
    },
  );
  await page.route(
    "**/api/workspaces/workspace-clair-cheongdam/reception/queue",
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 200,
          workspaceId: "workspace-clair-cheongdam",
          queue: [],
          enforcedBy: "reception-queue-read",
        }),
      });
    },
  );
  await page.route(
    "**/api/workspaces/workspace-clair-cheongdam/reception/patient-guardian-lookup?query=*",
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          patients: [
            {
              patient: {
                id: "49121000-0000-4000-8000-000000000023",
                workspaceId: "workspace-clair-cheongdam",
                patientNo: "CD-P-0023",
                name: "구름",
                species: "dog",
                breed: "Samoyed",
                sex: "female",
                neutered: true,
                birthDate: "2023-06-01",
                weightKg: 12,
                handlingCautionLocked: false,
                status: "active",
                createdAt: "2026-06-01T00:00:00.000Z",
                updatedAt: "2026-06-01T00:00:00.000Z",
              },
              primaryGuardian: {
                id: "49120000-0000-4000-8000-000000000023",
                workspaceId: "workspace-clair-cheongdam",
                name: "문지아",
                mobilePhone: "010-4911-0023",
                createdAt: "2026-06-01T00:00:00.000Z",
                updatedAt: "2026-06-01T00:00:00.000Z",
              },
            },
          ],
          enforcedBy: "reception-patient-guardian-lookup",
        }),
      });
    },
  );
  await page.route(
    "**/api/workspaces/workspace-clair-cheongdam/reception/appointments",
    async (route) => {
      latestAppointmentBody = route.request().postDataJSON() as Record<
        string,
        unknown
      >;
      createdAppointment = {
        id: "appointment-cheongdam-gureum-0900",
        workspaceId: "workspace-clair-cheongdam",
        patientId: latestAppointmentBody.patientId,
        guardianId: latestAppointmentBody.guardianId,
        assignedVeterinarianId: latestAppointmentBody.assignedVeterinarianId,
        scheduledStartAt: latestAppointmentBody.scheduledStartAt,
        scheduledEndAt: "2026-06-26T09:30:00+09:00",
        visitPurpose: latestAppointmentBody.reservationMemo,
        symptomNote: latestAppointmentBody.reservationMemo,
        status: "confirmed",
        createdByUserId: "49110000-0000-4000-8000-000000000001",
        createdAt: "2026-06-25T23:50:00+09:00",
        updatedAt: "2026-06-25T23:50:00+09:00",
      };

      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 201,
          workspaceId: "workspace-clair-cheongdam",
          appointment: createdAppointment,
          enforcedBy: "reception-appointment-create",
        }),
      });
    },
  );

  await page.goto(
    "/w/workspace-clair-cheongdam/reception?modulePanel=open&drawer=reception-reservation-form%3Anew",
  );

  const reservationDrawer = page.getByTestId("reservation-create-drawer");
  await expect(reservationDrawer).toBeVisible();
  await reservationDrawer.getByLabel("담당의").click();
  await page.getByRole("option", { name: "청담 원장" }).click();
  await expect(reservationDrawer.getByLabel("담당의")).toContainText("청담 원장");

  await reservationDrawer.getByLabel("환자 검색").fill("구름");
  await page.getByRole("option", { name: /구름.*문지아/ }).click();
  await expect(reservationDrawer.getByLabel("체중")).toHaveValue("12.00");

  await reservationDrawer.getByLabel("예약일").click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /26\.06\.26.*선택/ })
    .click();
  await expect(reservationDrawer.getByLabel("예약시간")).toContainText("09:00");
  await expect(reservationDrawer.getByLabel("예상소요시간")).toContainText("30분");

  await reservationDrawer.getByLabel("예약 메모").fill("구름 09시 예약");
  await reservationDrawer.getByRole("button", { name: "생성" }).click();

  await expect.poll(() => latestAppointmentBody).toMatchObject({
    assignedVeterinarianId: "49110000-0000-4000-8000-000000000003",
    durationMinutes: 30,
    guardianId: "49120000-0000-4000-8000-000000000023",
    patientId: "49121000-0000-4000-8000-000000000023",
    reservationMemo: "구름 09시 예약",
    scheduledStartAt: "2026-06-26T09:00:00+09:00",
    weightKg: 12,
  });
  await expect(page.getByText("예약이 완료되었습니다")).toBeVisible();
  const detailPanel = page.getByTestId("reception-right-panel");
  await expect(detailPanel).toContainText("예약 상세");
  await expect(detailPanel.getByLabel("예약일")).toHaveValue("2026.06.26");
  await expect(detailPanel.getByLabel("예약시간")).toHaveValue("오전 9:00");
  await expect(
    detailPanel.getByPlaceholder("방문목적을 입력해주세요"),
  ).toHaveValue("구름 09시 예약");
  await expect(
    detailPanel.getByPlaceholder("예약 메모를 입력해주세요"),
  ).toHaveValue("구름 09시 예약");
  await expect(page.getByLabel("26.06.26 (금) 표시 중")).toBeVisible();
});

test("calendar reception creation uses the shared DB-backed patient lookup", async ({
  page,
}) => {
  const lookupQueries: string[] = [];

  await page.route(
    "**/api/workspaces/clair-demo/reception/patient-guardian-lookup?query=*",
    async (route) => {
      const query = new URL(route.request().url()).searchParams.get("query") ?? "";
      lookupQueries.push(query);

      if (query === "오류") {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ ok: false, error: "db_read_failed" }),
        });
        return;
      }

      if (query === "없는") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            patients: [],
            enforcedBy: "reception-patient-guardian-lookup",
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          patients: [
            {
              patient: {
                id: "patient-live-luna-draft",
                workspaceId: "clair-demo",
                patientNo: "P-LIVE-DRAFT",
                name: "루나",
                species: "cat",
                breed: "Korean Shorthair",
                sex: "female",
                neutered: true,
                weightKg: 3.1,
                handlingCautionLocked: false,
                status: "active",
                createdAt: "2026-05-19T00:00:00.000Z",
                updatedAt: "2026-05-19T00:00:00.000Z",
              },
              primaryGuardian: {
                id: "guardian-live-jiyu-draft",
                workspaceId: "clair-demo",
                name: "박지유",
                mobilePhone: "010-2222-3333",
                createdAt: "2026-05-19T00:00:00.000Z",
                updatedAt: "2026-05-19T00:00:00.000Z",
              },
            },
          ],
          enforcedBy: "reception-patient-guardian-lookup",
        }),
      });
    },
  );

  await page.goto("/w/clair-demo/reception?modulePanel=open");
  await page.getByTestId("day-empty-slot-14-user-vet-suji").click();

  const sharedWalkInForm = page.getByTestId("walk-in-reception-dialog").last();
  await expect(sharedWalkInForm).toBeVisible();

  await sharedWalkInForm.getByLabel("환자 검색").fill("루나");
  await expect(
    page.getByRole("option", { name: /루나.*박지유/ }),
  ).toBeVisible();
  await expect.poll(() => lookupQueries.includes("루나")).toBe(true);
  await page.getByRole("option", { name: /루나.*박지유/ }).click();
  await expect(sharedWalkInForm.getByLabel("환자 검색")).toHaveValue(
    /루나 .* 박지유/,
  );

  await sharedWalkInForm.getByLabel("환자 검색").fill("없는");
  await expect(page.getByText("검색 결과가 없습니다.")).toBeVisible();

  await sharedWalkInForm.getByLabel("환자 검색").fill("오류");
  await expect(
    page.getByText("환자 검색을 불러오지 못했습니다."),
  ).toBeVisible();
});

test("reception creates a draft task from a 15-minute calendar click", async ({
  page,
}) => {
  const walkInCreate = await mockReceptionWalkInCreate(page, {
    checkedInAt: "2026-05-01T14:15:00+09:00",
    encounterId: "encounter-calendar-click-nabi",
    guardianId: "guardian-oh-sea",
    patientId: "patient-nabi",
    primaryVeterinarianId: "user-vet-suji",
    queueId: "queue-calendar-click-nabi",
  });

  await page.goto(
    "/w/clair-demo/reception?modulePanel=open&drawer=reception-appointment%3Aappointment-nabi-260501",
  );

  await expect(page.getByText("예약 상세").first()).toBeVisible();
  const emptySlot = page.getByTestId("day-empty-slot-14-user-vet-suji");
  const quarterSlot = page.getByTestId(
    "day-empty-slot-14-user-vet-suji-slot-1415",
  );

  await emptySlot.hover();
  await expect(quarterSlot).toBeVisible();
  const emptySlotInsets = await emptySlot.evaluate((slot) => {
    const parent = slot.parentElement;
    if (!parent) return null;

    const slotBox = slot.getBoundingClientRect();
    const parentBox = parent.getBoundingClientRect();

    return {
      left: Math.round((slotBox.left - parentBox.left) * 100) / 100,
      right: Math.round((parentBox.right - slotBox.right) * 100) / 100,
    };
  });
  const quarterSlotInsets = await quarterSlot.evaluate((slot) => {
    const parent = slot.parentElement;
    if (!parent) return null;

    const slotBox = slot.getBoundingClientRect();
    const parentBox = parent.getBoundingClientRect();

    return {
      left: Math.round((slotBox.left - parentBox.left) * 100) / 100,
      right: Math.round((parentBox.right - slotBox.right) * 100) / 100,
    };
  });

  if (!emptySlotInsets) throw new Error("Expected empty slot insets");
  if (!quarterSlotInsets) throw new Error("Expected quarter slot insets");

  expect(emptySlotInsets.left).toBe(0);
  expect(emptySlotInsets.right).toBeLessThanOrEqual(1);
  expect(quarterSlotInsets.left).toBe(0);
  expect(quarterSlotInsets.right).toBe(0);
  await quarterSlot.click();

  const draftDrawer = page.getByTestId("walk-in-reception-dialog").last();
  await expect(draftDrawer).toBeVisible();
  await expect(draftDrawer.getByText("접수구분")).toHaveCount(0);
  await expect(
    draftDrawer.getByText("진료 시간 안에서 예약 가능한 시간을 선택합니다."),
  ).toHaveCount(0);
  await expect(draftDrawer.getByLabel("환자 검색")).toHaveValue("");
  await expect(draftDrawer.getByRole("button", { name: "생성" })).toBeDisabled();
  await expect(draftDrawer.getByLabel("담당의")).toContainText("이수지");
  await expect(draftDrawer.getByLabel("접수시간")).toHaveValue("오후 2:15");
  await expect(draftDrawer.getByLabel("예상소요시간")).toContainText("15분");
  const draftControlMetrics = await draftDrawer.evaluate((drawer) => {
    const getControl = (label: string) =>
      drawer.querySelector(`[aria-label="${label}"]`);
    const patient = getControl("환자 검색")?.getBoundingClientRect();
    const weight = getControl("체중")?.getBoundingClientRect();
    const visitPurpose = getControl("방문목적")?.getBoundingClientRect();
    const memo = getControl("접수 메모")?.getBoundingClientRect();

    return {
      controlHeights: [
        "환자 검색",
        "체중",
        "담당의",
        "접수시간",
        "예상소요시간",
      ].map((label) =>
        Math.round(getControl(label)?.getBoundingClientRect().height ?? 0),
      ),
      patientWeightWidthDelta:
        patient && weight ? Math.abs(patient.width - weight.width) : null,
      visitMemoHeightDelta:
        visitPurpose && memo ? Math.abs(visitPurpose.height - memo.height) : null,
    };
  });
  expect(draftControlMetrics.controlHeights).toEqual([32, 32, 32, 32, 32]);
  expect(draftControlMetrics.patientWeightWidthDelta).not.toBeNull();
  expect(draftControlMetrics.patientWeightWidthDelta ?? 999).toBeLessThanOrEqual(
    1,
  );
  expect(draftControlMetrics.visitMemoHeightDelta).not.toBeNull();
  expect(draftControlMetrics.visitMemoHeightDelta ?? 999).toBeLessThanOrEqual(1);
  const calendarDraftCard = page.locator(
    '[data-testid^="calendar-draft-card-calendar-draft-2026-05-01m855"]',
  );
  await expect(calendarDraftCard).toBeVisible();
  await expect(calendarDraftCard).toContainText("14:15 - 14:30");
  const calendarDraftCardInsets = await calendarDraftCard.evaluate((card) => {
    const parent = card.parentElement;
    if (!parent) return null;

    const cardBox = card.getBoundingClientRect();
    const parentBox = parent.getBoundingClientRect();

    return {
      left: Math.round((cardBox.left - parentBox.left) * 100) / 100,
      right: Math.round((parentBox.right - cardBox.right) * 100) / 100,
    };
  });

  if (!calendarDraftCardInsets)
    throw new Error("Expected calendar draft card insets");

  expect(calendarDraftCardInsets.left).toBe(0);
  expect(calendarDraftCardInsets.right).toBe(0);
  await expect(calendarDraftCard).not.toContainText("임시 선택");
  await expect(calendarDraftCard).not.toContainText("생성 전");

  await expect(
    page
      .locator('[data-testid^="walkin-card-"]')
      .filter({ hasText: "나비" })
      .filter({ hasText: "14:15" }),
  ).toHaveCount(0);

  await draftDrawer.getByLabel("환자 검색").fill("나비");
  await page.getByRole("option", { name: /나비.*오세아/ }).click();
  await expect(draftDrawer.getByLabel("환자 검색")).toHaveValue(
    /나비 .* 오세아/,
  );
  await draftDrawer.getByLabel("방문목적").fill("현장 접수");
  await expect(draftDrawer.getByRole("button", { name: "생성" })).toBeEnabled();
  await draftDrawer.getByRole("button", { name: "생성" }).click();
  await expect.poll(() => walkInCreate.count).toBe(1);
  await expect(page.getByText("접수가 완료되었습니다")).toBeVisible();
  expect(walkInCreate.latestBody).toMatchObject({
    durationMinutes: 15,
    patientId: "patient-nabi",
    primaryVeterinarianId: "user-vet-suji",
    visitPurpose: "현장 접수",
  });
  await expect(calendarDraftCard).toHaveCount(0);

  const draftCard = page
    .locator('[data-testid^="walkin-card-"]')
    .filter({ hasText: "나비" })
    .filter({ hasText: "14:15" });
  await expect(draftCard).toBeVisible();
  await expect(draftCard).toContainText("14:15-14:30");
  await expect
    .poll(() => draftCard.evaluate((card) => getComputedStyle(card).boxShadow))
    .toContain("rgba(0, 0, 0, 0.05) 0px 1px 2px 0px");
  const draftCardInsets = await draftCard.evaluate((card) => {
    const parent = card.parentElement;
    if (!parent) return null;

    const cardBox = card.getBoundingClientRect();
    const parentBox = parent.getBoundingClientRect();

    return {
      bottom: Math.round((parentBox.bottom - cardBox.bottom) * 100) / 100,
      height: Math.round(cardBox.height),
      left: Math.round((cardBox.left - parentBox.left) * 100) / 100,
      right: Math.round((parentBox.right - cardBox.right) * 100) / 100,
      top: Math.round((cardBox.top - parentBox.top) * 100) / 100,
      width: Math.round(cardBox.width),
    };
  });

  if (!draftCardInsets)
    throw new Error("Expected generated schedule card inset data");

  expect(Math.abs(draftCardInsets.left)).toBeLessThanOrEqual(1);
  expect(Math.abs(draftCardInsets.top)).toBeLessThanOrEqual(1);
  expect(draftCardInsets.height).toBe(30);
  expect(draftCardInsets.width).toBeGreaterThanOrEqual(160);
  expect(Math.abs(draftCardInsets.right)).toBeLessThanOrEqual(1);
});

test("reception keeps only one active calendar selection preview", async ({
  page,
}) => {
  await page.goto("/w/clair-demo/reception?modulePanel=open");

  const firstSlot = page.getByTestId("day-empty-slot-14-user-vet-suji");
  const secondSlot = page.getByTestId("day-empty-slot-15-user-vet-suji");

  await firstSlot.evaluate((slot) => {
    const rect = slot.getBoundingClientRect();
    slot.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        button: 0,
        buttons: 1,
        clientX: rect.left + 16,
        clientY: rect.top + 2,
        isPrimary: true,
        pointerId: 1,
        pointerType: "mouse",
      }),
    );
  });
  await firstSlot.evaluate((slot) => {
    const rect = slot.getBoundingClientRect();
    slot.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        button: 0,
        buttons: 1,
        clientX: rect.left + 16,
        clientY: rect.top + rect.height,
        isPrimary: true,
        pointerId: 1,
        pointerType: "mouse",
      }),
    );
  });
  await expect(page.locator('[data-testid$="-selection-preview"]')).toHaveCount(
    1,
  );

  await secondSlot.evaluate((slot) => {
    const rect = slot.getBoundingClientRect();
    slot.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        button: 0,
        buttons: 1,
        clientX: rect.left + 16,
        clientY: rect.top + 2,
        isPrimary: true,
        pointerId: 2,
        pointerType: "mouse",
      }),
    );
  });
  await secondSlot.evaluate((slot) => {
    const rect = slot.getBoundingClientRect();
    slot.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        button: 0,
        buttons: 1,
        clientX: rect.left + 16,
        clientY: rect.top + rect.height,
        isPrimary: true,
        pointerId: 2,
        pointerType: "mouse",
      }),
    );
  });

  await expect(
    page.getByTestId("day-empty-slot-14-user-vet-suji-selection-preview"),
  ).toHaveCount(0);
  await expect(
    page.getByTestId("day-empty-slot-15-user-vet-suji-selection-preview"),
  ).toBeVisible();
  await expect(page.locator('[data-testid$="-selection-preview"]')).toHaveCount(
    1,
  );

  await secondSlot.evaluate((slot) => {
    const rect = slot.getBoundingClientRect();
    slot.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        button: 0,
        buttons: 0,
        clientX: rect.left + 16,
        clientY: rect.top + rect.height,
        isPrimary: true,
        pointerId: 2,
        pointerType: "mouse",
      }),
    );
  });

  await expect(page.locator('[data-testid$="-selection-preview"]')).toHaveCount(
    0,
  );
});

test("reception clears the draft schedule card on cancel or another selection", async ({
  page,
}) => {
  await page.goto(
    "/w/clair-demo/reception?modulePanel=open&drawer=reception-appointment%3Aappointment-nabi-260501",
  );
  await expect(page.getByText("예약 상세").first()).toBeVisible();

  const quarterSlot = page.getByTestId(
    "day-empty-slot-14-user-vet-suji-slot-1415",
  );
  const calendarDraftCard = page.locator(
    '[data-testid^="calendar-draft-card-calendar-draft-2026-05-01m855"]',
  );

  await quarterSlot.click();
  let draftDrawer = page.getByTestId("walk-in-reception-dialog").last();
  await expect(draftDrawer).toBeVisible();
  await expect(calendarDraftCard).toBeVisible();

  await draftDrawer.getByRole("button", { name: "취소" }).click();
  await expect(calendarDraftCard).toHaveCount(0);
  await expect(page).not.toHaveURL(/drawer=reception-form/);

  await quarterSlot.click();
  draftDrawer = page.getByTestId("walk-in-reception-dialog").last();
  await expect(draftDrawer).toBeVisible();
  await expect(calendarDraftCard).toBeVisible();

  await page.getByTestId("day-empty-slot-15-user-vet-suji-slot-1500").click();
  const replacementDraftCard = page.locator(
    '[data-testid^="calendar-draft-card-calendar-draft-2026-05-01m900"]',
  );
  draftDrawer = page.getByTestId("walk-in-reception-dialog").last();
  await expect(draftDrawer.getByLabel("접수시간")).toHaveValue("오후 3:00");
  await expect(page.getByTestId("reception-right-panel")).toBeVisible();
  await expect(calendarDraftCard).toHaveCount(0);
  await expect(replacementDraftCard).toBeVisible();
  await expect(
    page.locator('[data-testid^="calendar-draft-card-"]'),
  ).toHaveCount(1);

  await page.getByTestId("appointment-card-appointment-kong-260501").click();
  await expect(replacementDraftCard).toHaveCount(0);
});

test("reception clears the draft schedule card when the draft drawer shell closes", async ({
  page,
}) => {
  await page.goto(
    "/w/clair-demo/reception?modulePanel=open&drawer=reception-appointment%3Aappointment-nabi-260501",
  );
  await expect(page.getByText("예약 상세").first()).toBeVisible();

  const quarterSlot = page.getByTestId(
    "day-empty-slot-14-user-vet-suji-slot-1415",
  );
  const calendarDraftCard = page.locator(
    '[data-testid^="calendar-draft-card-calendar-draft-2026-05-01m855"]',
  );

  await quarterSlot.click();
  await expect(
    page.getByTestId("walk-in-reception-dialog").last(),
  ).toBeVisible();
  await expect(calendarDraftCard).toBeVisible();

  await page.getByRole("button", { name: "우측 사이드 패널 닫기" }).click();
  await expect(calendarDraftCard).toHaveCount(0);
  await expect(page.getByTestId("walk-in-reception-dialog")).toHaveCount(0);
});

test("reception clears an active drag preview immediately when selecting an existing schedule", async ({
  page,
}) => {
  await page.goto(
    "/w/clair-demo/reception?modulePanel=open&drawer=reception-appointment%3Aappointment-nabi-260501",
  );
  await expect(page.getByText("예약 상세").first()).toBeVisible();

  const dragSlot = page.getByTestId("day-empty-slot-14-user-vet-suji");
  await dragSlot.evaluate((slot) => {
    const rect = slot.getBoundingClientRect();
    slot.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        button: 0,
        buttons: 1,
        clientX: rect.left + 16,
        clientY: rect.top + 2,
        isPrimary: true,
        pointerId: 1,
        pointerType: "mouse",
      }),
    );
  });
  await dragSlot.evaluate((slot) => {
    const rect = slot.getBoundingClientRect();
    slot.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        button: 0,
        buttons: 1,
        clientX: rect.left + 16,
        clientY: rect.top + rect.height,
        isPrimary: true,
        pointerId: 1,
        pointerType: "mouse",
      }),
    );
  });
  await expect(
    page.getByTestId("day-empty-slot-14-user-vet-suji-selection-preview"),
  ).toBeVisible();

  const appointmentCard = page.getByTestId(
    "appointment-card-appointment-nabi-260501",
  );
  await appointmentCard.dispatchEvent("pointerdown", {
    bubbles: true,
    button: 0,
    buttons: 1,
    pointerId: 2,
    pointerType: "mouse",
  });
  await expect(page.locator('[data-testid$="-selection-preview"]')).toHaveCount(
    0,
  );

  await appointmentCard.click();
  await expect(page.getByTestId("walk-in-reception-dialog")).toHaveCount(0);
  await expect(page.getByText("예약 상세").first()).toBeVisible();
});

test("reception appointment calendar card does not add a selected ring while its drawer is open", async ({
  page,
}) => {
  await page.goto("/w/clair-demo/reception?modulePanel=open");

  const appointmentCard = page.getByTestId(
    "appointment-card-appointment-nabi-260501",
  );
  await expect(appointmentCard).toBeVisible();
  await appointmentCard.click();

  await expect
    .poll(() =>
      appointmentCard.evaluate((card) => getComputedStyle(card).boxShadow),
    )
    .not.toContain("inset");
});

test("reception keeps drag preview flush when crossing into a scheduled hour", async ({
  page,
}) => {
  await page.goto(
    "/w/clair-demo/reception?modulePanel=open&drawer=reception-appointment%3Aappointment-nabi-260501",
  );
  await expect(page.getByText("예약 상세").first()).toBeVisible();

  const dragSlot = page.getByTestId("day-empty-slot-9-user-vet-doyun");

  await dragSlot.evaluate((slot) => {
    const rect = slot.getBoundingClientRect();
    slot.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        button: 0,
        buttons: 1,
        clientX: rect.left + 16,
        clientY: rect.top + 2,
        isPrimary: true,
        pointerId: 1,
        pointerType: "mouse",
      }),
    );
  });
  await dragSlot.evaluate((slot) => {
    const rect = slot.getBoundingClientRect();
    slot.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        button: 0,
        buttons: 1,
        clientX: rect.left + 16,
        clientY: rect.top + rect.height * 1.5,
        isPrimary: true,
        pointerId: 1,
        pointerType: "mouse",
      }),
    );
  });

  const previewMetrics = await page
    .getByTestId("day-empty-slot-9-user-vet-doyun-selection-preview")
    .evaluate((preview) => {
      const parent = preview.parentElement;
      const hourCell = parent?.parentElement;
      const previewBox = preview.getBoundingClientRect();
      if (!parent || !hourCell) return null;

      const parentBox = parent.getBoundingClientRect();

      return {
        borderRadius: getComputedStyle(preview).borderRadius,
        hourCellOverflow: getComputedStyle(hourCell).overflow,
        left: Math.round((previewBox.left - parentBox.left) * 100) / 100,
        overflow: getComputedStyle(parent).overflow,
        overflowBeyondParentBottom:
          Math.round((previewBox.bottom - parentBox.bottom) * 100) / 100,
        right: Math.round((parentBox.right - previewBox.right) * 100) / 100,
        text: preview.textContent?.trim(),
      };
    });

  if (!previewMetrics) throw new Error("Expected scheduled-hour preview");

  expect(previewMetrics.text).toContain("09:00 - 10:30");
  expect(previewMetrics.borderRadius).toBe("8px");
  expect(previewMetrics.overflow).toBe("visible");
  expect(previewMetrics.hourCellOverflow).toBe("visible");
  expect(previewMetrics.overflowBeyondParentBottom).toBeGreaterThan(40);
  expect(previewMetrics.left).toBe(0);
  expect(previewMetrics.right).toBe(0);
});

test("reception blocks invalid calendar draft selections", async ({ page }) => {
  await page.goto("/w/clair-demo/reception?modulePanel=open");
  await expect(page.getByText("영업시간 09:00-19:00")).toHaveCount(0);

  const outsideBusinessSlot = page.getByTestId(
    "day-empty-slot-19-user-vet-suji-slot-1900",
  );
  await expect(outsideBusinessSlot).toHaveAttribute("aria-disabled", "true");
  await outsideBusinessSlot.click({ force: true });
  await expect(page.getByTestId("walk-in-reception-dialog")).toHaveCount(0);
  await expect(
    page.locator('[data-testid^="calendar-draft-card-"]'),
  ).toHaveCount(0);

  const elapsedSlot = page.getByTestId(
    "day-empty-slot-10-user-vet-suji-slot-1000",
  );
  await expect(elapsedSlot).toHaveAttribute("aria-disabled", "true");
  await elapsedSlot.click({ force: true });
  await expect(page.getByTestId("walk-in-reception-dialog")).toHaveCount(0);
  await expect(
    page.locator('[data-testid^="calendar-draft-card-"]'),
  ).toHaveCount(0);

  const lunchSlot = page.getByTestId(
    "day-empty-slot-12-user-vet-suji-slot-1215",
  );
  await expect(lunchSlot).toHaveAttribute("aria-disabled", "false");
  await lunchSlot.click();
  const draftDrawer = page.getByTestId("walk-in-reception-dialog").last();
  await expect(draftDrawer).toBeVisible();
  await expect(draftDrawer.getByLabel("접수시간")).toHaveValue("오후 12:15");
  await draftDrawer.getByRole("button", { name: "취소" }).click();
  await expect(
    page.locator('[data-testid^="calendar-draft-card-"]'),
  ).toHaveCount(0);

  const overlapSlot = page.getByTestId("day-empty-slot-9-user-vet-doyun");
  await overlapSlot.evaluate((slot) => {
    const rect = slot.getBoundingClientRect();
    slot.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        button: 0,
        buttons: 1,
        clientX: rect.left + 16,
        clientY: rect.top + rect.height * 0.75,
        isPrimary: true,
        pointerId: 1,
        pointerType: "mouse",
      }),
    );
  });
  await overlapSlot.evaluate((slot) => {
    const rect = slot.getBoundingClientRect();
    slot.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        button: 0,
        buttons: 1,
        clientX: rect.left + 16,
        clientY: rect.top + rect.height * 2.5,
        isPrimary: true,
        pointerId: 1,
        pointerType: "mouse",
      }),
    );
  });
  await expect(
    page.getByTestId("day-empty-slot-9-user-vet-doyun-selection-preview"),
  ).toHaveCount(0);
  await overlapSlot.evaluate((slot) => {
    const rect = slot.getBoundingClientRect();
    slot.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        button: 0,
        buttons: 0,
        clientX: rect.left + 16,
        clientY: rect.top + rect.height * 2.5,
        isPrimary: true,
        pointerId: 1,
        pointerType: "mouse",
      }),
    );
  });

  await expect(page.getByTestId("walk-in-reception-dialog")).toHaveCount(0);
  await expect(
    page.locator('[data-testid^="calendar-draft-card-"]'),
  ).toHaveCount(0);

  const tooLongSlot = page.getByTestId("day-empty-slot-14-user-vet-suji");
  await tooLongSlot.evaluate((slot) => {
    const rect = slot.getBoundingClientRect();
    slot.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        button: 0,
        buttons: 1,
        clientX: rect.left + 16,
        clientY: rect.top,
        isPrimary: true,
        pointerId: 2,
        pointerType: "mouse",
      }),
    );
  });
  await tooLongSlot.evaluate((slot) => {
    const rect = slot.getBoundingClientRect();
    slot.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        button: 0,
        buttons: 1,
        clientX: rect.left + 16,
        clientY: rect.top + rect.height * 4.5,
        isPrimary: true,
        pointerId: 2,
        pointerType: "mouse",
      }),
    );
  });
  await expect(
    page.getByTestId("day-empty-slot-14-user-vet-suji-selection-preview"),
  ).toHaveCount(0);
  await tooLongSlot.evaluate((slot) => {
    const rect = slot.getBoundingClientRect();
    slot.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        button: 0,
        buttons: 0,
        clientX: rect.left + 16,
        clientY: rect.top + rect.height * 4.5,
        isPrimary: true,
        pointerId: 2,
        pointerType: "mouse",
      }),
    );
  });

  await expect(page.getByTestId("walk-in-reception-dialog")).toHaveCount(0);
  await expect(
    page.locator('[data-testid^="calendar-draft-card-"]'),
  ).toHaveCount(0);
});

test("reception creates a draft task from a dragged calendar range", async ({
  page,
}) => {
  const walkInCreate = await mockReceptionWalkInCreate(page, {
    checkedInAt: "2026-05-01T14:00:00+09:00",
    encounterId: "encounter-calendar-drag-nabi",
    guardianId: "guardian-oh-sea",
    patientId: "patient-nabi",
    primaryVeterinarianId: "user-vet-suji",
    queueId: "queue-calendar-drag-nabi",
  });

  await page.goto(
    "/w/clair-demo/reception?modulePanel=open&drawer=reception-appointment%3Aappointment-nabi-260501",
  );
  await expect(page.getByText("예약 상세").first()).toBeVisible();

  const emptySlot = page.getByTestId("day-empty-slot-14-user-vet-suji");

  await emptySlot.evaluate((slot) => {
    const rect = slot.getBoundingClientRect();
    const startPoint = {
      x: rect.left + 16,
      y: rect.top + 2,
    };

    slot.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        button: 0,
        buttons: 1,
        clientX: startPoint.x,
        clientY: startPoint.y,
        isPrimary: true,
        pointerId: 1,
        pointerType: "mouse",
      }),
    );
  });
  await page.waitForTimeout(50);
  const dragEndPoint = await emptySlot.evaluate((slot) => {
    const rect = slot.getBoundingClientRect();
    const endPoint = {
      x: rect.left + 16,
      y: rect.top + rect.height * 2.3,
    };

    slot.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        button: 0,
        buttons: 1,
        clientX: endPoint.x,
        clientY: endPoint.y,
        isPrimary: true,
        pointerId: 1,
        pointerType: "mouse",
      }),
    );

    return endPoint;
  });
  const selectionPreviewMetrics = await page
    .getByTestId("day-empty-slot-14-user-vet-suji-selection-preview")
    .evaluate((preview) => {
      const parent = preview.parentElement;
      const previewBox = preview.getBoundingClientRect();
      if (!parent) return null;

      const parentBox = parent.getBoundingClientRect();

      return {
        left: Math.round((previewBox.left - parentBox.left) * 100) / 100,
        overflow: getComputedStyle(parent).overflow,
        overflowBeyondParentBottom:
          Math.round((previewBox.bottom - parentBox.bottom) * 100) / 100,
        previewHeight: Math.round(previewBox.height * 100) / 100,
        right: Math.round((parentBox.right - previewBox.right) * 100) / 100,
        text: preview.textContent?.trim(),
      };
    });

  if (!selectionPreviewMetrics)
    throw new Error("Expected multi-hour drag preview metrics");

  expect(selectionPreviewMetrics.text).toContain("14:00 - 16:30");
  expect(selectionPreviewMetrics.left).toBe(0);
  expect(selectionPreviewMetrics.right).toBe(0);
  expect(selectionPreviewMetrics.overflow).toBe("visible");
  expect(selectionPreviewMetrics.previewHeight).toBeGreaterThan(200);
  expect(selectionPreviewMetrics.overflowBeyondParentBottom).toBeGreaterThan(
    120,
  );

  await emptySlot.evaluate((slot, point) => {
    slot.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        button: 0,
        buttons: 0,
        clientX: point.x,
        clientY: point.y,
        isPrimary: true,
        pointerId: 1,
        pointerType: "mouse",
      }),
    );
  }, dragEndPoint);

  const draftDrawer = page.getByTestId("walk-in-reception-dialog").last();
  await expect(draftDrawer).toBeVisible();
  await expect(draftDrawer.getByLabel("접수시간")).toHaveValue("오후 2:00");
  await expect(draftDrawer.getByLabel("예상소요시간")).toContainText("150분");
  const calendarDraftCard = page.locator(
    '[data-testid^="calendar-draft-card-calendar-draft-2026-05-01m840"]',
  );
  await expect(calendarDraftCard).toBeVisible();
  await expect(calendarDraftCard).toContainText("14:00 - 16:30");

  await draftDrawer.getByLabel("환자 검색").fill("나비");
  await page.getByRole("option", { name: /나비.*오세아/ }).click();
  await draftDrawer.getByLabel("방문목적").fill("현장 접수");
  await draftDrawer.getByRole("button", { name: "생성" }).click();
  await expect.poll(() => walkInCreate.count).toBe(1);
  expect(walkInCreate.latestBody).toMatchObject({
    durationMinutes: 150,
    patientId: "patient-nabi",
    primaryVeterinarianId: "user-vet-suji",
    visitPurpose: "현장 접수",
  });
  await expect(calendarDraftCard).toHaveCount(0);

  const draftCard = page
    .locator('[data-testid^="walkin-card-"]')
    .filter({ hasText: "나비" })
    .filter({ hasText: "14:00" });
  await expect(draftCard).toBeVisible();
  await expect(draftCard).toContainText("14:00-16:30");
});

test("calendar-created walk-in opens its detail without a toast navigation action", async ({
  page,
}) => {
  const walkInCreate = await mockReceptionWalkInCreate(page, {
    checkedInAt: "2026-05-01T14:00:00+09:00",
    encounterId: "encounter-calendar-created-detail",
    guardianId: "guardian-oh-sea",
    patientId: "patient-nabi",
    primaryVeterinarianId: "user-vet-suji",
    queueId: "queue-calendar-created-detail",
  });

  await page.goto("/w/clair-demo/reception?modulePanel=open&right=open");
  await page.getByTestId("day-empty-slot-14-user-vet-suji").click();

  const createPanel = page.getByTestId("walk-in-reception-dialog");
  await expect(createPanel).toBeVisible();
  await createPanel.getByLabel("환자 검색").fill("나비");
  await page.getByRole("option", { name: /나비.*오세아/ }).click();
  await createPanel.getByLabel("방문목적").fill("현장 접수");
  await createPanel.getByRole("button", { name: "생성" }).click();

  await expect.poll(() => walkInCreate.count).toBe(1);
  await expect(page.getByText("접수가 완료되었습니다")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "접수 확인하기" }),
  ).toHaveCount(0);
  const detailPanel = page.getByTestId("reception-right-panel");
  await expect(detailPanel).toContainText("접수 상세");
  await expect(detailPanel.locator("input").first()).toHaveValue(/나비/);
});

test("calendar drag create failure shows an error toast without committing a walk-in", async ({
  page,
}) => {
  let walkInCreateCount = 0;

  await page.route(
    "**/api/workspaces/clair-demo/reception/walk-in-encounters",
    async (route) => {
      walkInCreateCount += 1;
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          ok: false,
          status: 500,
          error: "db_write_failed",
        }),
      });
    },
  );

  await page.goto(
    "/w/clair-demo/reception?modulePanel=open&drawer=reception-appointment%3Aappointment-nabi-260501",
  );
  await expect(page.getByText("예약 상세").first()).toBeVisible();

  const emptySlot = page.getByTestId("day-empty-slot-14-user-vet-suji");
  await emptySlot.evaluate((slot) => {
    const rect = slot.getBoundingClientRect();
    slot.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        button: 0,
        buttons: 1,
        clientX: rect.left + 16,
        clientY: rect.top + 2,
        isPrimary: true,
        pointerId: 1,
        pointerType: "mouse",
      }),
    );
  });
  const dragEndPoint = await emptySlot.evaluate((slot) => {
    const rect = slot.getBoundingClientRect();
    const endPoint = {
      x: rect.left + 16,
      y: rect.top + rect.height * 2.3,
    };

    slot.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        button: 0,
        buttons: 1,
        clientX: endPoint.x,
        clientY: endPoint.y,
        isPrimary: true,
        pointerId: 1,
        pointerType: "mouse",
      }),
    );

    return endPoint;
  });
  await emptySlot.evaluate((slot, point) => {
    slot.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        button: 0,
        buttons: 0,
        clientX: point.x,
        clientY: point.y,
        isPrimary: true,
        pointerId: 1,
        pointerType: "mouse",
      }),
    );
  }, dragEndPoint);

  const draftDrawer = page.getByTestId("walk-in-reception-dialog").last();
  await expect(draftDrawer).toBeVisible();
  await draftDrawer.getByLabel("환자 검색").fill("나비");
  await page.getByRole("option", { name: /나비.*오세아/ }).click();
  await draftDrawer.getByLabel("방문목적").fill("현장 접수");
  await draftDrawer.getByRole("button", { name: "생성" }).click();

  await expect.poll(() => walkInCreateCount).toBe(1);
  await expect(page.getByText("접수를 생성할 수 없습니다.")).toBeVisible();
  await expect(page.getByText("접수가 완료되었습니다")).toHaveCount(0);
  await expect(
    page
      .locator('[data-testid^="walkin-card-"]')
      .filter({ hasText: "나비" })
      .filter({ hasText: "14:00" }),
  ).toHaveCount(0);
});

test("reception creates a future dragged calendar range as a reservation", async ({
  page,
}) => {
  let appointmentCreateCount = 0;
  let walkInCreateCount = 0;
  let createdAppointment: Record<string, unknown> | null = null;
  let latestAppointmentBody: Record<string, unknown> | undefined;

  await page.route(
    "**/api/workspaces/clair-demo/reception/calendar/day**",
    async (route) => {
      const date = new URL(route.request().url()).searchParams.get("date");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 200,
          workspaceId: "clair-demo",
          date,
          records: createdAppointment ? [{ appointment: createdAppointment }] : [],
          enforcedBy: "reception-calendar-read",
        }),
      });
    },
  );

  await page.route(
    "**/api/workspaces/clair-demo/reception/walk-in-encounters",
    async (route) => {
      walkInCreateCount += 1;
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ ok: false, message: "walk-in must not be used" }),
      });
    },
  );

  await page.route(
    "**/api/workspaces/clair-demo/reception/appointments",
    async (route) => {
      appointmentCreateCount += 1;
      latestAppointmentBody = route.request().postDataJSON() as Record<
        string,
        unknown
      >;
      createdAppointment = {
        id: "appointment-future-drag-den516",
        workspaceId: "clair-demo",
        patientId: latestAppointmentBody.patientId,
        guardianId: latestAppointmentBody.guardianId,
        assignedVeterinarianId: latestAppointmentBody.assignedVeterinarianId,
        scheduledStartAt: latestAppointmentBody.scheduledStartAt,
        scheduledEndAt: "2026-05-02T12:00:00+09:00",
        visitPurpose: latestAppointmentBody.reservationMemo,
        symptomNote: latestAppointmentBody.reservationMemo,
        status: "confirmed",
        createdByUserId: "user-front-desk",
        createdAt: "2026-05-01T12:00:00+09:00",
        updatedAt: "2026-05-01T12:00:00+09:00",
      };

      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 201,
          workspaceId: "clair-demo",
          appointment: createdAppointment,
          enforcedBy: "reception-appointment-create",
        }),
      });
    },
  );

  await page.goto(
    "/w/clair-demo/reception?modulePanel=open&drawer=reception-appointment%3Aappointment-nabi-260501",
  );
  await expect(page.getByText("예약 상세").first()).toBeVisible();
  await page.getByTestId("side-panel-mini-calendar-day-2026-05-02").click();
  await expect(
    page.getByTestId("side-panel-mini-calendar-day-2026-05-02"),
  ).toBeVisible();

  const emptySlot = page.getByTestId("day-empty-slot-10-user-vet-suji");
  await emptySlot.evaluate((slot) => {
    const rect = slot.getBoundingClientRect();
    slot.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        button: 0,
        buttons: 1,
        clientX: rect.left + 16,
        clientY: rect.top + 2,
        isPrimary: true,
        pointerId: 1,
        pointerType: "mouse",
      }),
    );
  });
  await page.waitForTimeout(50);
  const dragEndPoint = await emptySlot.evaluate((slot) => {
    const rect = slot.getBoundingClientRect();
    const endPoint = { x: rect.left + 16, y: rect.top + rect.height * 2 };
    slot.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        button: 0,
        buttons: 1,
        clientX: endPoint.x,
        clientY: endPoint.y,
        isPrimary: true,
        pointerId: 1,
        pointerType: "mouse",
      }),
    );
    return endPoint;
  });
  await emptySlot.evaluate((slot, point) => {
    slot.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        button: 0,
        buttons: 0,
        clientX: point.x,
        clientY: point.y,
        isPrimary: true,
        pointerId: 1,
        pointerType: "mouse",
      }),
    );
  }, dragEndPoint);

  const reservationDrawer = page
    .getByTestId("reception-right-panel")
    .getByTestId("reservation-create-drawer");
  await expect(reservationDrawer).toBeVisible();
  await expect(reservationDrawer.getByText("접수 생성")).toHaveCount(0);
  await expect(page.getByText("접수를 생성할 수 없습니다.")).toHaveCount(0);
  await expect(reservationDrawer.getByLabel("예약일")).toContainText("26.05.02");
  await expect(reservationDrawer.getByLabel("예약시간")).toContainText("10:00");
  const durationText =
    (await reservationDrawer.getByLabel("예상소요시간").textContent()) ?? "";
  const expectedDurationMinutes = Number(durationText.match(/\d+/)?.[0]);
  expect(expectedDurationMinutes).toBeGreaterThan(30);
  await expect(reservationDrawer.getByLabel("담당의")).toContainText("이수지");
  await expect(reservationDrawer.getByLabel("환자 검색")).toHaveValue("");
  await expect(
    reservationDrawer.getByRole("button", { name: "생성" }),
  ).toBeDisabled();

  await reservationDrawer.getByLabel("환자 검색").waitFor({ state: "visible" });
  await page.waitForTimeout(300);
  await reservationDrawer.getByLabel("환자 검색").fill("나비");
  await page.getByRole("option", { name: /나비.*오세아/ }).click();
  await reservationDrawer.getByLabel("체중").fill("4.95");
  await reservationDrawer.getByLabel("예약 메모").fill("미래 드래그 예약 생성");
  await reservationDrawer.getByRole("button", { name: "생성" }).click();

  await expect.poll(() => appointmentCreateCount).toBe(1);
  expect(walkInCreateCount).toBe(0);
  expect(latestAppointmentBody).toMatchObject({
    assignedVeterinarianId: "user-vet-suji",
    durationMinutes: expectedDurationMinutes,
    guardianId: "guardian-oh-sea",
    patientId: "patient-nabi",
    reservationMemo: "미래 드래그 예약 생성",
    weightKg: 4.95,
  });
  expect(String(latestAppointmentBody?.scheduledStartAt)).toBe(
    "2026-05-02T10:00:00+09:00",
  );
  await expect(page.getByText("예약이 완료되었습니다")).toBeVisible();
  await expect(
    page.getByTestId("appointment-card-appointment-future-drag-den516"),
  ).toBeVisible();
});

test("reception normalizes a reverse dragged calendar range", async ({
  page,
}) => {
  await page.goto(
    "/w/clair-demo/reception?modulePanel=open&drawer=reception-appointment%3Aappointment-nabi-260501",
  );
  await expect(page.getByText("예약 상세").first()).toBeVisible();

  const reverseSlot = page.getByTestId("day-empty-slot-15-user-vet-suji");
  await reverseSlot.evaluate((slot) => {
    const rect = slot.getBoundingClientRect();
    slot.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        button: 0,
        buttons: 1,
        clientX: rect.left + 16,
        clientY: rect.top + rect.height * 0.5,
        isPrimary: true,
        pointerId: 1,
        pointerType: "mouse",
      }),
    );
  });
  await reverseSlot.evaluate((slot) => {
    const rect = slot.getBoundingClientRect();
    slot.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        button: 0,
        buttons: 1,
        clientX: rect.left + 16,
        clientY: rect.top - rect.height,
        isPrimary: true,
        pointerId: 1,
        pointerType: "mouse",
      }),
    );
  });
  await expect(
    page.getByTestId("day-empty-slot-15-user-vet-suji-selection-preview"),
  ).toContainText("14:00 - 15:30");
  await reverseSlot.evaluate((slot) => {
    const rect = slot.getBoundingClientRect();
    slot.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        button: 0,
        buttons: 0,
        clientX: rect.left + 16,
        clientY: rect.top - rect.height,
        isPrimary: true,
        pointerId: 1,
        pointerType: "mouse",
      }),
    );
  });

  const draftDrawer = page.getByTestId("walk-in-reception-dialog").last();
  const calendarDraftCard = page.locator(
    '[data-testid^="calendar-draft-card-calendar-draft-2026-05-01m840"]',
  );
  await expect(draftDrawer).toBeVisible();
  await expect(draftDrawer.getByLabel("접수시간")).toHaveValue("오후 2:00");
  await expect(draftDrawer.getByLabel("예상소요시간")).toContainText("90분");
  await expect(calendarDraftCard).toBeVisible();
  await expect(calendarDraftCard).toContainText("14:00 - 15:30");
});

test("reception walk-in keeps selected veterinarian and form details", async ({
  page,
}) => {
  await page.goto("/w/clair-demo/reception");

  await openWalkInReceptionForm(page);
  const walkInForm = page.getByTestId("walk-in-reception-dialog");
  await expect(walkInForm.getByLabel("환자 검색")).toHaveAttribute(
    "placeholder",
    "환자를 선택해주세요",
  );
  await walkInForm.getByLabel("환자 검색").click();
  await walkInForm.getByLabel("환자 검색").fill("하루");
  await page.getByRole("option", { name: /하루.*강서윤/ }).click();
  await walkInForm.getByLabel("방문목적").fill("예방접종 전 건강 확인");
  await walkInForm
    .getByLabel("접수 메모")
    .fill("기존 노쇼 예약과 별도 현장 접수");
  await walkInForm.getByLabel("담당의").click();
  await page.getByRole("option", { name: "김도윤" }).click();
  await walkInForm.getByRole("button", { name: "생성" }).click();

  const haruCard = page
    .getByTestId("patient-card-patient-haru")
    .filter({ hasText: "김도윤" });
  await expect(haruCard).toContainText("하루");
  await expect(haruCard).toContainText("예방접종 전 건강 확인");
  await expect(haruCard).toContainText("김도윤");
});
