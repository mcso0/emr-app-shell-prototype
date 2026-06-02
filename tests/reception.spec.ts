import { expect, test, type Page } from "@playwright/test";

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

  await expect(page.getByText("접수 워크스페이스")).toHaveCount(0);
  await expect(page.getByText("예약 3건")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "26.05.01 (금) 날짜 선택" }),
  ).toBeVisible();
  const dateControl = page.getByTestId("reception-date-control");
  const calendarViewTabs = page.getByRole("group", {
    name: "접수 캘린더 보기",
  });
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
      "오늘 일자로 이동",
    ]);
  await dateControl
    .getByRole("button", { name: "26.05.01 (금) 날짜 선택" })
    .click();
  await expect(page.getByText("2026년 5월")).toBeVisible();
  await page.keyboard.press("Escape");
  await calendarViewTabs.getByRole("button", { name: "주" }).click();
  await expect(
    page.getByRole("button", { name: "26.04.27 - 26.05.03 주 선택" }),
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
      "26.04.27 - 26.05.03 주 선택",
      "오늘 일자로 이동",
    ]);
  await dateControl
    .getByRole("button", { name: "26.04.27 - 26.05.03 주 선택" })
    .click();
  await expect(page.getByText("2026년 4월 - 5월")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "26.04.27 - 26.05.03 선택됨" }),
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
    .toEqual(["이전 월", "다음 월", "26.05 월 선택", "오늘 일자로 이동"]);
  await dateControl.getByRole("button", { name: "26.05 월 선택" }).click();
  await expect(page.getByText("2026년", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "26.05 선택됨" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await calendarViewTabs.getByRole("button", { name: "일" }).click();
  await expect(page.getByText("영업시간 09:00-19:00")).toBeVisible();
  await expect
    .poll(() =>
      page
        .getByTestId("appointment-card-appointment-coco-260501")
        .evaluate((card) => getComputedStyle(card).boxShadow),
    )
    .toContain("rgba(0, 0, 0, 0.05) 0px 1px 2px 0px");
  await expect
    .poll(async () => {
      const box = await page.getByTestId("schedule-toolbar").boundingBox();
      return Math.round(box?.height ?? 0);
    })
    .toBe(48);
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
  await expect(page.getByText("08:00")).toBeVisible();
  await expect(page.getByText("20:00")).toBeVisible();
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
    .toEqual(["전체", "대기", "예약"]);
  await expect(sidePanel.getByText("대기", { exact: true })).toHaveCount(2);
  await expect
    .poll(() =>
      sidePanel
        .locator('[data-testid^="patient-card-"]')
        .evaluateAll((cards) =>
          cards.map((card) => card.getAttribute("data-testid")),
        ),
    )
    .toEqual([
      "patient-card-patient-kong",
      "patient-card-patient-dubu",
      "patient-card-patient-coco",
      "patient-card-patient-haru",
    ]);
  await expect(sidePanel.getByText("112분 대기")).toHaveClass(
    /text-destructive/,
  );
  await expect(sidePanel.getByTestId("patient-card-patient-nabi")).toHaveCount(
    0,
  );
  await sideTabs.getByRole("button", { name: "예약", exact: true }).click();
  await expect(sidePanel.getByText("예약 작업")).toHaveCount(0);
  await expect(
    sidePanel.getByTestId("patient-card-patient-nabi"),
  ).toContainText("나비");
  await expect(
    sidePanel.getByTestId("patient-card-patient-nabi"),
  ).toContainText("예약");
  await expect(sidePanel.getByTestId("patient-card-patient-coco")).toHaveCount(
    0,
  );
  await expect(
    sidePanel.getByRole("textbox", { name: "대기열 검색" }),
  ).toHaveCount(0);
  await sidePanel.getByRole("button", { name: "검색" }).click();
  await expect(
    sidePanel.getByRole("textbox", { name: "대기열 검색" }),
  ).toBeVisible();
  await expect(
    sidePanel.getByPlaceholder("대기열 내 환자, 보호자, 전화번호 검색"),
  ).toBeVisible();
  await expect(page.getByText("환자 상세")).toHaveCount(0);
  await expect(page.getByText("진료 대기열")).toHaveCount(0);
  await expect(page.getByText("잠금 주의사항")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "접수 폼" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "스케줄 생성" })).toHaveCount(
    0,
  );
});

test("reception prioritizes the Kong vomit demo context from query params", async ({
  page,
}) => {
  await page.goto(
    "/w/clair-demo/reception?scenario=kong-vomit&patientId=patient-kong&encounterId=encounter-kong-260501",
  );

  const sidePanel = page.locator("aside").first();
  const kongCard = sidePanel.getByTestId("patient-card-patient-kong");

  await expect(
    page.getByText("오늘 내원: 반복 구토와 식욕 저하"),
  ).toBeVisible();
  await expect(
    page.getByText("김하늘 보호자 · 콩이(P-260501-0003)"),
  ).toBeVisible();
  await expect(kongCard).toBeVisible();
  await expect(kongCard).toContainText("콩이");
  await expect(kongCard).toContainText("김하늘");
  await expect(kongCard).toContainText("예약");
  await expect(kongCard).toContainText("반복 구토와 식욕 저하");
  await expect(kongCard).toContainText("이수지");

  await page.getByTestId("appointment-card-appointment-kong-260501").click();

  await expect(page.getByText("예약 상세").first()).toBeVisible();
  await expect(
    page.getByText("김하늘 보호자 · 콩이 · 09:28 접수"),
  ).toBeVisible();
  await expect(page.getByLabel("방문 목적")).toHaveValue(
    "반복 구토와 식욕 저하",
  );
  await expect(page.getByLabel("소요시간")).toHaveValue("15분");

  await page.getByRole("button", { name: "상세 닫기" }).click();
  await kongCard.click();

  await expect(page.getByText("접수 정보")).toBeVisible();
  await expect(page.getByText("P-260501-0003").first()).toBeVisible();
  await expect(page.getByText("접수 상세").last()).toBeVisible();
  await expect(
    page.getByText("김하늘 보호자 · 콩이 · 09:28 접수").last(),
  ).toBeVisible();
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
  await expect(calendar.getByText("08:00")).toBeVisible();
  await expect(calendar.getByText("20:00")).toBeVisible();
  await expect(calendar.getByText("01", { exact: true })).toBeVisible();
  await expect(calendar.getByTestId("week-current-time-indicator")).toHaveCount(
    1,
  );
});

test("reception day calendar emphasizes schedule card hierarchy and current line", async ({
  page,
}) => {
  await page.goto("/w/clair-demo/reception");

  const calendar = page.getByTestId("reception-day-calendar");
  const kongAppointment = page.getByTestId(
    "appointment-card-appointment-kong-260501",
  );

  await expect(calendar.getByText("현재 11:20")).toHaveCount(0);
  await expect(
    calendar
      .getByTestId("day-hour-row-10")
      .locator('[data-testid="calendar-quarter-hour-lines"]')
      .first()
      .locator("span"),
  ).toHaveCount(3);
  await expect(
    kongAppointment.getByTestId("appointment-purpose-appointment-kong-260501"),
  ).toContainText("구토 및 복부");
  await expect(
    kongAppointment.getByTestId("appointment-accent-appointment-kong-260501"),
  ).toHaveClass(/emr-status-info-text/);
  await expect(kongAppointment).toContainText("콩이");
  await expect(kongAppointment).toContainText("구토 및 복부");
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
  expect(kongCardInsets.height).toBe(36);
  expect(kongCardInsets.width).toBeGreaterThanOrEqual(170);
  expect(kongCardInsets.right).toBeGreaterThanOrEqual(7);
  expect(kongCardInsets.right).toBeLessThanOrEqual(9);

  const timeAxisAlignment = await calendar.evaluate((calendarElement) => {
    const timeAxis = calendarElement.querySelector(
      '[data-testid="day-time-axis"]',
    );
    const alignedHours = [9, 10, 11, 12];
    const firstTimeLabel = Array.from(
      timeAxis?.querySelectorAll("div") ?? [],
    ).find((element) => element.textContent?.trim() === "08:00");

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
    expect(alignment?.rowHeight).toBe(112);
    expect(alignment?.textCenterOffsetFromRowLine).toBeLessThanOrEqual(1);
  }

  const nabiAppointment = page.getByTestId(
    "appointment-card-appointment-nabi-260501",
  );
  const nabiPurposeChip = nabiAppointment.getByTestId(
    "appointment-purpose-chip-appointment-nabi-260501",
  );
  await expect(nabiPurposeChip).toContainText("외래");
  await expect(nabiPurposeChip).toHaveCSS("white-space", "nowrap");
  await expect(nabiAppointment).toHaveCSS("height", "80px");
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
  expect(nabiCardInsets.width).toBeGreaterThanOrEqual(170);
  expect(nabiCardInsets.right).toBeGreaterThanOrEqual(7);
  expect(nabiCardInsets.right).toBeLessThanOrEqual(9);
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

test("reception veterinarian selector controls visible schedule lanes", async ({
  page,
}) => {
  await page.goto("/w/clair-demo/reception");

  const calendar = page.getByTestId("reception-day-calendar");

  await expect(
    calendar.getByText("이수지", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    calendar.getByText("김도윤", { exact: true }).first(),
  ).toBeVisible();
  await expect(calendar.getByText("SJ", { exact: true }).first()).toBeVisible();
  await expect(calendar.getByText("DY", { exact: true }).first()).toBeVisible();

  const veterinarianButton = page.getByRole("button", { name: "이수지 +9" });
  await expect(async () => {
    await veterinarianButton.click();
    await expect(veterinarianButton).toHaveAttribute("aria-expanded", "true", {
      timeout: 1_000,
    });
  }).toPass();
  const veterinarianMenu = page.getByRole("menu");
  await expect(veterinarianMenu.getByText("오늘 근무 수의사")).toBeVisible();
  await expect(veterinarianMenu.getByText("그 외 수의사")).toBeVisible();
  await expect(veterinarianMenu.getByText("SJ", { exact: true })).toBeVisible();
  await expect(veterinarianMenu.getByText("DY", { exact: true })).toBeVisible();
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
    page.getByText("오세아 보호자 · 나비 · 10:45 예약"),
  ).toBeVisible();
  await expect(page.getByLabel("소요시간")).toHaveValue("15분");
  await expect(
    page.getByRole("button", { name: "접수 처리" }).last(),
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
  await expect(page.getByText("접수 정보")).toBeVisible();
  await expect(page.getByText("접수 상세")).toBeVisible();
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
  await expect(page.getByRole("heading", { name: "신규 등록" })).toBeVisible();
  await expect(page.getByText("환자/보호자 모두 신규 등록")).toBeVisible();
  await expect(page.getByText("기존 보호자에 신규 환자 등록")).toBeVisible();
  await page.getByRole("button", { name: "다음" }).click();

  await expect(
    page.getByRole("heading", { name: "신규 보호자 등록" }),
  ).toBeVisible();
  await expect(page.getByText("1/2 보호자")).toBeVisible();
  await page.getByRole("button", { name: "다음" }).click();
  await expect(page.getByText("보호자명은 필수입니다.")).toBeVisible();
  await page.getByLabel("보호자명").fill("김새봄");
  await page.getByLabel("보호자 생년월일").fill("1993-1213-123");
  await page.getByLabel("보호자 휴대전화").fill("010-2222-3333");
  await page.getByRole("button", { name: "다음" }).click();
  await expect(
    page.getByText("생년월일은 YYYY-MM-DD 형식의 실제 날짜로 입력해 주세요."),
  ).toBeVisible();
  await page.getByLabel("보호자 생년월일").fill("1993-11-23");
  await page.getByRole("button", { name: "다음" }).click();
  await expect(
    page.getByText("개인정보 수집 동의가 필요합니다."),
  ).toBeVisible();
  await page.getByRole("button", { name: "태블릿 서명 요청" }).click();
  await page.getByRole("button", { name: "서명 완료 처리" }).click();
  await page.getByRole("checkbox", { name: "마케팅 수신 동의" }).check();
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

test("server-backed patient guardian registration sends minimal reception payload", async ({
  page,
}) => {
  let capturedBody: Record<string, unknown> | null = null;

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
              updatedAt: "2026-05-19T00:00:00.000Z",
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
              updatedAt: "2026-05-19T00:00:00.000Z",
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
  await page.getByRole("button", { name: "다음" }).click();
  await page.getByLabel("보호자명").fill("김새봄");
  await page.getByLabel("보호자 휴대전화").fill("010-2222-3333");
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
  await page.getByText("기존 보호자에 신규 환자 등록").click();
  await page.getByRole("button", { name: "다음" }).click();
  await expect(
    page.getByRole("heading", { name: "기존 보호자에 신규 환자 등록" }),
  ).toBeVisible();
  await expect(
    page.getByText("입력한 정보는 최종 확인 후 등록됩니다."),
  ).toHaveCount(0);
  await expect(page.getByText("보호자 선택")).toBeVisible();
  await expect(page.getByText("동물 정보")).toBeVisible();
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

test("reception dialogs align 40px inputs and select triggers", async ({
  page,
}) => {
  await page.goto("/w/clair-demo/reception");

  await page
    .getByRole("button", { name: "환자/보호자 등록", exact: true })
    .click();
  await page.getByText("기존 보호자에 신규 환자 등록").click();
  await page.getByRole("button", { name: "다음" }).click();
  const registrationDialog = page.getByLabel("기존 보호자에 신규 환자 등록");
  await expect(registrationDialog.getByText("동물 정보")).toBeVisible();

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
  expect(registrationControlHeights).toEqual([40, 40, 40, 40]);

  await page.goto("/w/clair-demo/reception");
  await page.getByTestId("schedule-check-in-button").click();
  const walkInForm = page.getByTestId("walk-in-reception-dialog");
  await expect(
    walkInForm.getByRole("heading", { name: "진료 접수" }),
  ).toBeVisible();

  const walkInControlHeights = await Promise.all(
    [
      walkInForm.getByLabel("접수일"),
      walkInForm.getByLabel("진료시간"),
      walkInForm.getByRole("combobox", { name: "예상시간" }),
    ].map((control) =>
      control.evaluate((element) =>
        Math.round(element.getBoundingClientRect().height),
      ),
    ),
  );
  for (const height of walkInControlHeights) {
    expect(height).toBeGreaterThanOrEqual(38);
    expect(height).toBeLessThanOrEqual(40);
  }
});

test("patient guardian registration blocks duplicate microchips and warns duplicate patient names", async ({
  page,
}) => {
  await page.goto("/w/clair-demo/reception");

  await page
    .getByRole("button", { name: "환자/보호자 등록", exact: true })
    .click();
  await page.getByText("기존 보호자에 신규 환자 등록").click();
  await page.getByRole("button", { name: "다음" }).click();
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
  await page.getByRole("button", { name: "다음" }).click();
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

  const sidePanel = page.locator("aside").first();
  await sidePanel.getByRole("button", { name: "검색" }).click();
  await sidePanel.getByRole("textbox", { name: "대기열 검색" }).fill("코코");

  await expect(
    sidePanel.getByTestId("patient-card-patient-coco"),
  ).toBeVisible();
  await expect(
    sidePanel.getByTestId("patient-card-patient-coco"),
  ).toContainText("이지은");
  await expect(sidePanel.getByTestId("patient-card-patient-nabi")).toBeHidden();
  await sidePanel.getByRole("button", { name: "검색어 초기화" }).click();
  await expect(
    sidePanel.getByRole("textbox", { name: "대기열 검색" }),
  ).toHaveValue("");
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

test("server-backed reception queue read hydrates the side panel from persisted encounters", async ({
  page,
}) => {
  let requested = false;

  await page.route("**/reception/queue**", async (route) => {
    requested = true;
    expect(route.request().method()).toBe("GET");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        status: 200,
        queue: [
          {
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
              checkedInAt: "2026-05-19T00:00:00.000Z",
              createdAt: "2026-05-19T00:00:00.000Z",
              updatedAt: "2026-05-19T00:00:00.000Z",
            },
            queueEntry: {
              id: "queue-live-queue-coco",
              workspaceId: "clair-demo",
              encounterId: "encounter-live-queue-coco",
              queueType: "consultation",
              status: "waiting",
              priority: "normal",
              sortOrder: 1,
              enteredAt: "2026-05-19T00:00:00.000Z",
            },
          },
        ],
        enforcedBy: "reception-queue-read",
      }),
    });
  });

  await page.goto("/w/clair-demo/reception");

  await expect.poll(() => requested).toBe(true);
  await expect(page.getByTestId("patient-card-patient-coco")).toContainText(
    "DEN-62 persisted queue read",
  );
  await expect(page.getByTestId("patient-card-patient-coco")).toContainText(
    "김도윤",
  );
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
              patientId: "patient-coco",
              guardianId: "guardian-lee-jieun",
              assignedVeterinarianId: "user-vet-suji",
              scheduledStartAt: "2026-05-01T09:10:00+09:00",
              scheduledEndAt: "2026-05-01T09:30:00+09:00",
              visitPurpose: "DEN-63 persisted appointment",
              symptomNote: "DEN-63 calendar appointment detail",
              status: "confirmed",
              createdAt: "2026-05-01T08:00:00+09:00",
              updatedAt: "2026-05-01T08:00:00+09:00",
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
  ).toContainText("DEN-63 persisted appointment");
  await expect(
    page.getByTestId("walkin-card-encounter-den63-walkin-nabi"),
  ).toContainText("DEN-63 persisted walk-in");
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
  await page.goto("/w/clair-demo/reception");

  const nabiAppointment = page.getByTestId(
    "appointment-card-appointment-nabi-260501",
  );
  await expect(nabiAppointment).toContainText("예약");
  await expect(nabiAppointment).not.toContainText("예약확정");

  await nabiAppointment.click();
  await page.getByRole("button", { name: "접수 처리" }).last().click();

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
              checkedInAt: "2026-05-19T00:00:00.000Z",
              createdAt: "2026-05-19T00:00:00.000Z",
              updatedAt: "2026-05-19T00:00:00.000Z",
            },
            queueEntry: {
              id: "queue-live-appointment-nabi",
              workspaceId: "clair-demo",
              encounterId: "encounter-live-appointment-nabi",
              queueType: "consultation",
              status: "waiting",
              priority: "normal",
              enteredAt: "2026-05-19T00:00:00.000Z",
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
  await page.getByRole("button", { name: "접수 처리" }).last().click();

  expect(requested).toBe(true);
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
  await page.getByRole("button", { name: "접수 처리" }).last().click();
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
  ).toContainText("DEN-65 reload appointment");
  await expect(page.getByTestId("patient-card-patient-nabi")).toContainText(
    "DEN-65 reload appointment",
  );
  await expect(page.getByTestId("patient-card-patient-nabi")).toContainText(
    "김도윤",
  );
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
  await page.goto("/w/clair-demo/reception");

  const sidePanel = page.locator("aside").first();
  await sidePanel.getByTestId("patient-card-patient-dubu").click();
  await expect(page.getByText("접수 정보")).toBeVisible();
  await page.getByRole("button", { name: "상세 닫기" }).click();
  await page.getByTestId("schedule-check-in-button").click();
  await expect(page).not.toHaveURL(/drawer=/);
  const walkInForm = page.getByTestId("walk-in-reception-dialog");
  await expect(
    walkInForm.getByRole("heading", { name: "진료 접수" }),
  ).toBeVisible();
  await expect(walkInForm.getByLabel("환자 검색")).toHaveAttribute(
    "placeholder",
    "동물명 또는 보호자명으로 검색",
  );
  await expect(walkInForm.getByText("두부 · 정하린")).toHaveCount(0);
  await walkInForm.getByLabel("환자 검색").click();
  await page.getByRole("option", { name: /두부.*정하린/ }).click();
  await expect(walkInForm.getByLabel("방문 목적")).toBeVisible();
  await walkInForm.getByRole("button", { name: "태그 추가" }).click();
  await walkInForm.getByLabel("태그명").fill("재활");
  await walkInForm.getByLabel("태그명").press("Enter");
  await expect(
    walkInForm.getByRole("button", { name: "재활" }),
  ).toHaveAttribute("aria-pressed", "true");
  await walkInForm.getByLabel("방문 목적").fill("보행 재검 및 통증 상담");
  await walkInForm.getByLabel("접수 메모").fill("보호자가 계단 보행을 걱정함");
  await walkInForm.getByRole("button", { name: "생성" }).click();

  const dubuCard = page.getByTestId("patient-card-patient-dubu");
  await expect(dubuCard).toContainText("두부");
  await expect(dubuCard).toContainText("재활");
  await expect(dubuCard).toContainText("보행 재검 및 통증 상담");
  await expect(dubuCard).toContainText("수의사 미지정");

  const walkInCalendarCard = page
    .locator('[data-testid^="walkin-card-"]')
    .filter({
      hasText: "보행 재검 및 통증 상담",
    });
  await expect(walkInCalendarCard).toContainText("외래");
  await expect(walkInCalendarCard).toContainText("재활");
  await expect(walkInCalendarCard).toContainText("보행 재검 및 통증 상담");
  await expect(
    walkInCalendarCard.locator('[data-testid^="walkin-purpose-chip-"]'),
  ).toContainText("외래");
  await expect(
    walkInCalendarCard.locator('[data-testid^="walkin-purpose-encounter-"]'),
  ).toContainText("보행 재검 및 통증 상담");
  await expect(
    walkInCalendarCard.locator('[data-testid^="walkin-accent-"]'),
  ).toHaveClass(/emr-line-strong/);
});

test("server-backed walk-in encounter sends minimal reception payload", async ({
  page,
}) => {
  let capturedBody: Record<string, unknown> | null = null;

  await page.route(
    "**/api/workspaces/clair-demo/reception/walk-in-encounters",
    async (route) => {
      capturedBody = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          workspaceId: "clair-demo",
          walkIn: {
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
              chiefComplaint: "보행 재검 및 통증 상담",
              visitPurpose: "보행 재검 및 통증 상담",
              receptionMemo: "보호자가 계단 보행을 걱정함",
              status: "waiting",
              checkedInAt: "2026-05-19T00:00:00.000Z",
              createdAt: "2026-05-19T00:00:00.000Z",
              updatedAt: "2026-05-19T00:00:00.000Z",
            },
            queueEntry: {
              id: "queue-live-walkin-dubu",
              workspaceId: "clair-demo",
              encounterId: "encounter-live-walkin-dubu",
              queueType: "consultation",
              status: "waiting",
              priority: "normal",
              enteredAt: "2026-05-19T00:00:00.000Z",
            },
          },
          enforcedBy: "reception-walk-in-encounter",
        }),
      });
    },
  );

  await page.goto("/w/clair-demo/reception");
  await page.getByTestId("schedule-check-in-button").click();

  const walkInForm = page.getByTestId("walk-in-reception-dialog");
  await walkInForm.getByLabel("환자 검색").click();
  await page.getByRole("option", { name: /두부.*정하린/ }).click();
  await walkInForm.getByLabel("방문 목적").fill("보행 재검 및 통증 상담");
  await walkInForm.getByRole("button", { name: "태그 추가" }).click();
  await walkInForm.getByLabel("태그명").fill("재활");
  await walkInForm.getByLabel("태그명").press("Enter");
  await walkInForm.getByLabel("담당의").click();
  await page.getByRole("option", { name: "김도윤" }).click();
  await walkInForm.getByLabel("접수 메모").fill("보호자가 계단 보행을 걱정함");
  await walkInForm.getByRole("button", { name: "생성" }).click();

  expect(capturedBody).toMatchObject({
    patientId: "patient-dubu",
    guardianId: "guardian-jung-harin",
    primaryVeterinarianId: "user-vet-doyun",
    department: "영상의학과 · 방사선종양학과",
    durationMinutes: 30,
    visitPurpose: "재활 · 보행 재검 및 통증 상담",
    memo: "보호자가 계단 보행을 걱정함",
  });
  const dubuCard = page.getByTestId("patient-card-patient-dubu");
  await expect(dubuCard).toContainText("두부");
  await expect(dubuCard).toContainText("보행 재검 및 통증 상담");
  await expect(dubuCard).toContainText("김도윤");

  await dubuCard.hover();
  await dubuCard.getByRole("button", { name: "두부 카드 작업" }).click();
  await page.getByText("차트 보러가기", { exact: true }).click();

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
  const persistedWalkIn = {
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
      checkedInAt: "2026-05-01T10:15:00+09:00",
      createdAt: "2026-05-01T10:15:00+09:00",
      updatedAt: "2026-05-01T10:15:00+09:00",
    },
    queueEntry: {
      id: "queue-e2e-walkin-dubu",
      workspaceId: "clair-demo",
      encounterId: "encounter-e2e-walkin-dubu",
      queueType: "consultation",
      status: "waiting",
      priority: "normal",
      sortOrder: 1,
      enteredAt: "2026-05-01T10:15:00+09:00",
    },
  };
  let walkInCreated = false;

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
          walkIn: persistedWalkIn,
          enforcedBy: "reception-walk-in-encounter",
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
        queue: walkInCreated ? [persistedWalkIn] : [],
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
        records: walkInCreated ? [persistedWalkIn] : [],
        enforcedBy: "reception-calendar-read",
      }),
    });
  });

  await page.goto("/w/clair-demo/reception");
  await page.getByTestId("schedule-check-in-button").click();

  const walkInForm = page.getByTestId("walk-in-reception-dialog");
  await walkInForm.getByLabel("환자 검색").click();
  await page.getByRole("option", { name: /두부.*정하린/ }).click();
  await walkInForm.getByLabel("방문 목적").fill("DEN-65 reload walk-in");
  await walkInForm.getByLabel("담당의").click();
  await page.getByRole("option", { name: "김도윤" }).click();
  await walkInForm.getByRole("button", { name: "생성" }).click();

  await expect(
    page.getByTestId("walkin-card-encounter-e2e-walkin-dubu"),
  ).toContainText("DEN-65 reload walk-in");

  await page.reload();

  await expect(page.getByTestId("patient-card-patient-dubu")).toContainText(
    "DEN-65 reload walk-in",
  );
  await expect(page.getByTestId("patient-card-patient-dubu")).toContainText(
    "김도윤",
  );
  await expect(
    page.getByTestId("walkin-card-encounter-e2e-walkin-dubu"),
  ).toContainText("DEN-65 reload walk-in");
});

test("reception walk-in dialog uses DB-backed patient lookup states", async ({
  page,
}) => {
  await page.route(
    "**/api/workspaces/clair-demo/reception/patient-guardian-lookup?query=*",
    async (route) => {
      const url = new URL(route.request().url());
      const query = url.searchParams.get("query");

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
  await page.getByTestId("schedule-check-in-button").click();

  const walkInForm = page.getByTestId("walk-in-reception-dialog");
  await walkInForm.getByLabel("환자 검색").fill("루나");
  await expect(walkInForm.getByText("DB 검색 결과 1건")).toBeVisible();
  await page.getByRole("option", { name: /루나.*박지유/ }).click();
  await expect(walkInForm.getByLabel("환자 검색")).toHaveValue(/루나/);

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

  const draftDrawer = page.getByTestId("reception-draft-task-drawer").last();
  await expect(draftDrawer).toBeVisible();
  await expect(draftDrawer.getByText("접수 task 생성")).toBeVisible();
  await expect(draftDrawer.getByLabel("보호자 및 동물검색")).toHaveValue(
    /나비/,
  );
  await expect(draftDrawer.getByLabel("담당의")).toContainText("이수지");
  await expect(draftDrawer.getByLabel("진료시작시간")).toHaveValue("14:15");
  await expect(draftDrawer.getByLabel("소요시간")).toContainText("15분");
  const calendarDraftCard = page.locator(
    '[data-testid^="calendar-draft-card-calendar-draft-2026-05-01T14:15"]',
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

  await draftDrawer.getByRole("button", { name: "생성" }).click();
  await expect.poll(() => walkInCreate.count).toBe(1);
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
  await expect(draftCard).toContainText("14:15");
  await expect(draftCard).toContainText("15분");
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
  expect(draftCardInsets.height).toBe(80);
  expect(draftCardInsets.width).toBeGreaterThanOrEqual(170);
  expect(draftCardInsets.right).toBeGreaterThanOrEqual(7);
  expect(draftCardInsets.right).toBeLessThanOrEqual(9);
});

test("reception keeps only one active calendar selection preview", async ({
  page,
}) => {
  await page.goto(
    "/w/clair-demo/reception?modulePanel=open&drawer=reception-appointment%3Aappointment-nabi-260501",
  );
  await expect(page.getByText("예약 상세").first()).toBeVisible();

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
    '[data-testid^="calendar-draft-card-calendar-draft-2026-05-01T14:15"]',
  );

  await quarterSlot.click();
  let draftDrawer = page.getByTestId("reception-draft-task-drawer").last();
  await expect(draftDrawer).toBeVisible();
  await expect(calendarDraftCard).toBeVisible();

  await draftDrawer.getByRole("button", { name: "취소" }).click();
  await expect(calendarDraftCard).toHaveCount(0);
  await expect(page).not.toHaveURL(/drawer=reception-draft-task/);

  await quarterSlot.click();
  draftDrawer = page.getByTestId("reception-draft-task-drawer").last();
  await expect(draftDrawer).toBeVisible();
  await expect(calendarDraftCard).toBeVisible();
  await page.evaluate(() => {
    const drawer = document.querySelector('[data-testid="workspace-drawer"]');
    const drawerHost = drawer?.parentElement;

    if (!drawerHost) throw new Error("Expected workspace drawer host");

    (
      window as unknown as { __workspaceDrawerRemovals: number }
    ).__workspaceDrawerRemovals = 0;
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.removedNodes) {
          if (!(node instanceof HTMLElement)) continue;
          if (
            node.matches('[data-testid="workspace-drawer"]') ||
            node.querySelector('[data-testid="workspace-drawer"]')
          ) {
            (
              window as unknown as { __workspaceDrawerRemovals: number }
            ).__workspaceDrawerRemovals += 1;
          }
        }
      }
    });
    observer.observe(drawerHost, { childList: true });
    (
      window as unknown as { __workspaceDrawerObserver: MutationObserver }
    ).__workspaceDrawerObserver = observer;
  });

  await page.getByTestId("day-empty-slot-15-user-vet-suji-slot-1500").click();
  const replacementDraftCard = page.locator(
    '[data-testid^="calendar-draft-card-calendar-draft-2026-05-01T15:00"]',
  );
  draftDrawer = page.getByTestId("reception-draft-task-drawer").last();
  await expect(draftDrawer.getByLabel("진료시작시간")).toHaveValue("15:00");
  await expect(page.getByTestId("workspace-drawer")).toHaveCount(1);
  await page.waitForTimeout(250);
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { __workspaceDrawerRemovals?: number })
          .__workspaceDrawerRemovals ?? 0,
    ),
  ).toBe(0);
  await expect(calendarDraftCard).toHaveCount(0);
  await expect(replacementDraftCard).toBeVisible();
  await expect(
    page.locator('[data-testid^="calendar-draft-card-"]'),
  ).toHaveCount(1);

  await page.getByTestId("appointment-card-appointment-kong-260501").click();
  await expect(replacementDraftCard).toHaveCount(0);
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
  await expect(page.getByTestId("reception-draft-task-drawer")).toHaveCount(0);
  await expect(page.getByText("예약 상세").first()).toBeVisible();
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
  await expect(page.getByText("영업시간 09:00-19:00")).toBeVisible();

  const outsideBusinessSlot = page.getByTestId(
    "day-empty-slot-19-user-vet-suji-slot-1900",
  );
  await expect(outsideBusinessSlot).toHaveAttribute("aria-disabled", "true");
  await outsideBusinessSlot.click({ force: true });
  await expect(page.getByTestId("reception-draft-task-drawer")).toHaveCount(0);
  await expect(
    page.locator('[data-testid^="calendar-draft-card-"]'),
  ).toHaveCount(0);

  const lunchSlot = page.getByTestId(
    "day-empty-slot-12-user-vet-suji-slot-1215",
  );
  await expect(lunchSlot).toHaveAttribute("aria-disabled", "false");
  await lunchSlot.click();
  const draftDrawer = page.getByTestId("reception-draft-task-drawer").last();
  await expect(draftDrawer).toBeVisible();
  await expect(draftDrawer.getByLabel("진료시작시간")).toHaveValue("12:15");
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

  await expect(page.getByTestId("reception-draft-task-drawer")).toHaveCount(0);
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

  await expect(page.getByTestId("reception-draft-task-drawer")).toHaveCount(0);
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

  const draftDrawer = page.getByTestId("reception-draft-task-drawer").last();
  await expect(draftDrawer).toBeVisible();
  await expect(draftDrawer.getByLabel("진료시작시간")).toHaveValue("14:00");
  await expect(draftDrawer.getByLabel("소요시간")).toContainText("150분");
  const calendarDraftCard = page.locator(
    '[data-testid^="calendar-draft-card-calendar-draft-2026-05-01T14:00"]',
  );
  await expect(calendarDraftCard).toBeVisible();
  await expect(calendarDraftCard).toContainText("14:00 - 16:30");

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
  await expect(draftCard).toContainText("14:00");
  await expect(draftCard).toContainText("150분");
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

  const draftDrawer = page.getByTestId("reception-draft-task-drawer").last();
  const calendarDraftCard = page.locator(
    '[data-testid^="calendar-draft-card-calendar-draft-2026-05-01T14:00"]',
  );
  await expect(draftDrawer).toBeVisible();
  await expect(draftDrawer.getByLabel("진료시작시간")).toHaveValue("14:00");
  await expect(draftDrawer.getByLabel("소요시간")).toContainText("90분");
  await expect(calendarDraftCard).toBeVisible();
  await expect(calendarDraftCard).toContainText("14:00 - 15:30");
});

test("reception walk-in keeps selected veterinarian and form details", async ({
  page,
}) => {
  await page.goto("/w/clair-demo/reception");

  const sidePanel = page.locator("aside").first();
  await sidePanel.getByTestId("patient-card-patient-haru").click();
  await expect(page.getByText("접수 정보")).toBeVisible();

  await page.getByRole("button", { name: "상세 닫기" }).click();
  await page.getByTestId("schedule-check-in-button").click();
  const walkInForm = page.getByTestId("walk-in-reception-dialog");
  await expect(walkInForm.getByLabel("환자 검색")).toHaveAttribute(
    "placeholder",
    "동물명 또는 보호자명으로 검색",
  );
  await walkInForm.getByLabel("환자 검색").click();
  await page.getByRole("option", { name: /하루.*강서윤/ }).click();
  await walkInForm.getByLabel("방문 목적").fill("예방접종 전 건강 확인");
  await walkInForm
    .getByLabel("접수 메모")
    .fill("기존 노쇼 예약과 별도 현장 접수");
  await walkInForm.getByLabel("담당의").click();
  await page.getByRole("option", { name: "김도윤" }).click();
  await walkInForm.getByRole("button", { name: "생성" }).click();

  const haruCard = page.getByTestId("patient-card-patient-haru");
  await expect(haruCard).toContainText("하루");
  await expect(haruCard).toContainText("예방접종 전 건강 확인");
  await expect(haruCard).toContainText("김도윤");
});
