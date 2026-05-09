import { expect, test } from "@playwright/test";

test("reception renders the first-path workspace instead of the placeholder", async ({ page }) => {
  await page.goto("/w/clair-demo/reception");

  const sidePanel = page.locator("aside").first();

  await expect(page.getByText("접수 워크스페이스")).toHaveCount(0);
  await expect(page.getByText("예약 3건")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "26.05.01 (금) 날짜 선택" })).toBeVisible();
  await expect(page.getByText("영업시간 09:00-19:00")).toBeVisible();
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
        .evaluateAll((buttons) => buttons.map((button) => button.textContent?.trim()))
    )
    .toEqual(["전체", "대기", "예약"]);
  await expect(sidePanel.getByText("대기", { exact: true })).toHaveCount(2);
  await expect
    .poll(() =>
      sidePanel.locator('[data-testid^="patient-card-"]').evaluateAll((cards) =>
        cards.map((card) => card.getAttribute("data-testid"))
      )
    )
    .toEqual([
      "patient-card-patient-kong",
      "patient-card-patient-dubu",
      "patient-card-patient-coco",
      "patient-card-patient-haru",
    ]);
  await expect(sidePanel.getByText("112분 대기")).toHaveClass(/atomic-red-600/);
  await expect(sidePanel.getByTestId("patient-card-patient-nabi")).toHaveCount(0);
  await sideTabs.getByRole("button", { name: "예약", exact: true }).click();
  await expect(sidePanel.getByText("예약 작업")).toHaveCount(0);
  await expect(sidePanel.getByTestId("patient-card-patient-nabi")).toContainText("나비");
  await expect(sidePanel.getByTestId("patient-card-patient-nabi")).toContainText("예약");
  await expect(sidePanel.getByTestId("patient-card-patient-coco")).toHaveCount(0);
  await expect(sidePanel.getByRole("textbox", { name: "대기열 검색" })).toHaveCount(0);
  await sidePanel.getByRole("button", { name: "검색" }).click();
  await expect(sidePanel.getByRole("textbox", { name: "대기열 검색" })).toBeVisible();
  await expect(sidePanel.getByPlaceholder("대기열 내 환자, 보호자, 전화번호 검색")).toBeVisible();
  await expect(page.getByText("환자 상세")).toHaveCount(0);
  await expect(page.getByText("진료 대기열")).toHaveCount(0);
  await expect(page.getByText("잠금 주의사항")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "접수 폼" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "스케줄 생성" })).toHaveCount(0);
});

test("reception prioritizes the Kong vomit demo context from query params", async ({ page }) => {
  await page.goto(
    "/w/clair-demo/reception?scenario=kong-vomit&patientId=patient-kong&encounterId=encounter-kong-260501"
  );

  const sidePanel = page.locator("aside").first();
  const kongCard = sidePanel.getByTestId("patient-card-patient-kong");

  await expect(page.getByText("오늘 내원: 반복 구토와 식욕 저하")).toBeVisible();
  await expect(page.getByText("김하늘 보호자 · 콩이(P-260501-0003)")).toBeVisible();
  await expect(kongCard).toBeVisible();
  await expect(kongCard).toContainText("콩이");
  await expect(kongCard).toContainText("김하늘");
  await expect(kongCard).toContainText("예약");
  await expect(kongCard).toContainText("반복 구토와 식욕 저하");
  await expect(kongCard).toContainText("이수지");

  await page
    .getByTestId("appointment-card-appointment-kong-260501")
    .getByRole("button")
    .first()
    .click();

  await expect(page.getByText("예약 상세").first()).toBeVisible();
  await expect(page.getByText("김하늘 보호자 · 콩이 · 09:28 접수")).toBeVisible();
  await expect(page.getByLabel("방문 목적")).toHaveValue("반복 구토와 식욕 저하");

  await page.getByRole("button", { name: "상세 닫기" }).click();
  await kongCard.click();

  await expect(page.getByText("접수 정보")).toBeVisible();
  await expect(page.getByText("P-260501-0003").first()).toBeVisible();
  await expect(page.getByText("접수 상세").last()).toBeVisible();
  await expect(page.getByText("김하늘 보호자 · 콩이 · 09:28 접수").last()).toBeVisible();
});

test("reception calendar options expose Excel import and export actions", async ({ page }) => {
  await page.goto("/w/clair-demo/reception");

  const calendarOptionsButton = page.getByRole("button", { name: "더보기", exact: true });
  await expect(async () => {
    await calendarOptionsButton.click();
    await expect(calendarOptionsButton).toHaveAttribute("aria-expanded", "true", {
      timeout: 1_000,
    });
  }).toPass();

  await expect(page.getByRole("menuitem", { name: "Excel 다운로드" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Excel 업로드" })).toBeVisible();
});

test("reception week calendar shows a time axis and today's current-time marker", async ({ page }) => {
  await page.goto("/w/clair-demo/reception");

  await page.getByRole("button", { name: "주" }).click();

  const calendar = page.getByTestId("reception-week-calendar");
  await expect(calendar).toBeVisible();
  await expect(calendar.getByText("08:00")).toBeVisible();
  await expect(calendar.getByText("20:00")).toBeVisible();
  await expect(calendar.getByText("01", { exact: true })).toBeVisible();
  await expect(calendar.getByTestId("week-current-time-indicator")).toHaveCount(1);
});

test("reception day calendar emphasizes schedule card hierarchy and current line", async ({ page }) => {
  await page.goto("/w/clair-demo/reception");

  const calendar = page.getByTestId("reception-day-calendar");
  const kongAppointment = page.getByTestId("appointment-card-appointment-kong-260501");

  await expect(calendar.getByText("현재 11:20")).toHaveCount(0);
  await expect(kongAppointment.getByTestId("appointment-purpose-appointment-kong-260501")).toContainText("구토/식욕");
  await expect(kongAppointment.getByTestId("appointment-accent-appointment-kong-260501")).toHaveClass(/atomic-sky-500/);
  await expect(kongAppointment).toContainText("콩이");
  await expect(kongAppointment).toContainText("구토 및 복부");

  const timeAxisAlignment = await calendar.evaluate((calendarElement) => {
    const timeAxis = calendarElement.querySelector('[data-testid="day-time-axis"]');
    const hourRow = calendarElement.querySelector('[data-testid="day-hour-row-9"]');
    const timeLabel = Array.from(timeAxis?.querySelectorAll("div") ?? []).find(
      (element) => element.textContent?.trim() === "09:00"
    );

    if (!timeAxis || !hourRow || !timeLabel) return null;

    const textRange = document.createRange();
    textRange.selectNodeContents(timeLabel);
    const textBox = textRange.getBoundingClientRect();
    textRange.detach();

    const timeAxisBox = timeAxis.getBoundingClientRect();
    const hourRowBox = hourRow.getBoundingClientRect();

    return {
      gapToAxisRight: timeAxisBox.right - textBox.right,
      textCenterOffsetFromRowLine: Math.abs((textBox.top + textBox.bottom) / 2 - hourRowBox.top),
    };
  });

  if (!timeAxisAlignment) throw new Error("Expected day calendar time axis alignment data");

  expect(timeAxisAlignment.gapToAxisRight).toBeGreaterThanOrEqual(6);
  expect(timeAxisAlignment.gapToAxisRight).toBeLessThanOrEqual(10);
  expect(timeAxisAlignment.textCenterOffsetFromRowLine).toBeLessThanOrEqual(1);

  const nabiAppointment = page.getByTestId("appointment-card-appointment-nabi-260501");
  await expect(nabiAppointment.getByTestId("appointment-purpose-appointment-nabi-260501")).toContainText("피부");
  await expect(nabiAppointment.getByRole("button", { name: "접수 처리" })).toHaveClass(/label-strong/);
});

test("reception month calendar fills the available calendar height", async ({ page }) => {
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

test("reception veterinarian selector controls visible schedule lanes", async ({ page }) => {
  await page.goto("/w/clair-demo/reception");

  const calendar = page.getByTestId("reception-day-calendar");

  await expect(calendar.getByText("이수지", { exact: true }).first()).toBeVisible();
  await expect(calendar.getByText("김도윤", { exact: true }).first()).toBeVisible();
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
  await expect(page.getByTestId("appointment-card-appointment-nabi-260501")).toHaveCount(0);
});

test("reception cards open the reception detail drawer", async ({ page }) => {
  await page.goto("/w/clair-demo/reception");

  await page
    .getByTestId("appointment-card-appointment-nabi-260501")
    .getByRole("button")
    .first()
    .click();

  await expect(page.getByText("예약 상세").first()).toBeVisible();
  await expect(page.getByText("오세아 보호자 · 나비 · 10:40 예약")).toBeVisible();
  await expect(page.getByRole("button", { name: "접수 처리" }).last()).toBeVisible();
});

test("reception side panel cards keep order, open reception info, and clear selection on close", async ({ page }) => {
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
      sidePanel.locator('[data-testid^="patient-card-"]').evaluateAll((cards) =>
        cards.map((card) => card.getAttribute("data-testid"))
      )
    )
    .toEqual(initialCardOrder);
  const dubuCard = sidePanel.getByTestId("patient-card-patient-dubu");
  await dubuCard.click();
  await expect
    .poll(() =>
      sidePanel.locator('[data-testid^="patient-card-"]').evaluateAll((cards) =>
        cards.map((card) => card.getAttribute("data-testid"))
      )
    )
    .toEqual(initialCardOrder);
  await expect(page.getByText("접수 정보")).toBeVisible();
  await expect(page.getByText("접수 상세")).toBeVisible();
  await expect(dubuCard).toHaveAttribute("data-selected", "true");
  await page.getByRole("button", { name: "상세 닫기" }).click();
  await expect(dubuCard).not.toHaveAttribute("data-selected", "true");
});

test("patient drawer supports editing and guardian navigation", async ({ page }) => {
  await page.goto("/w/clair-demo/reception?drawer=reception-patient:patient-dubu");

  await expect(page.getByText("환자 정보")).toBeVisible();
  await expect(page.getByText("보호자 연결")).toBeVisible();
  await expect(page.getByText("정하린", { exact: true }).last()).toBeVisible();
  await expect(page.getByRole("button", { name: "보호자 강서윤 보기" })).toBeVisible();

  await page.getByRole("button", { name: "수정" }).click();
  await page.getByLabel("품종").fill("포메");
  await page.getByRole("option", { name: "포메라니안" }).click();
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page.getByLabel("품종")).toHaveValue("포메라니안");

  await page.getByRole("button", { name: "보호자 강서윤 보기" }).click();

  await expect(page.getByText("보호자 정보").first()).toBeVisible();
  await expect(page.getByText("연결 환자").last()).toBeVisible();
  await expect(page.getByText("하루", { exact: true }).last()).toBeVisible();
  await expect(page.getByText("두부", { exact: true }).last()).toBeVisible();
});

test("patient drawer shows CS history and latest shortcuts", async ({ page }) => {
  await page.goto("/w/clair-demo/reception?drawer=reception-patient:patient-coco");

  await page.getByRole("button", { name: "CS 이력" }).click();
  await expect(page.getByText("접수 문의")).toBeVisible();
  await page.getByRole("button", { name: "KakaoTalk" }).click();
  await expect(page.getByText("검사 결과 안내")).toBeVisible();

  await page.getByRole("button", { name: "최신내역" }).click();
  await expect(page.getByText("최근 조제")).toBeVisible();
  await expect(page.getByText("최근 검사")).toBeVisible();
});

test("patient guardian registration creates a new guardian and patient after confirmation", async ({ page }) => {
  await page.goto("/w/clair-demo/reception");

  const sidePanel = page.locator("aside").first();

  await expect(sidePanel.getByRole("button", { name: "신규 환자" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "신규 접수/등록", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "환자/보호자 등록", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "환자/보호자 등록", exact: true }).click();
  await expect(page.getByRole("heading", { name: "신규 등록" })).toBeVisible();
  await expect(page.getByText("환자/보호자 모두 신규 등록")).toBeVisible();
  await expect(page.getByText("기존 보호자에 신규 환자 등록")).toBeVisible();
  await page.getByRole("button", { name: "다음" }).click();

  await expect(page.getByRole("heading", { name: "신규 보호자 등록" })).toBeVisible();
  await expect(page.getByText("1/2 보호자")).toBeVisible();
  await page.getByRole("button", { name: "다음" }).click();
  await expect(page.getByText("보호자명은 필수입니다.")).toBeVisible();
  await page.getByLabel("보호자명").fill("김새봄");
  await page.getByLabel("보호자 생년월일").fill("1993-1213-123");
  await page.getByLabel("보호자 휴대전화").fill("010-2222-3333");
  await page.getByRole("button", { name: "다음" }).click();
  await expect(page.getByText("생년월일은 YYYY-MM-DD 형식의 실제 날짜로 입력해 주세요.")).toBeVisible();
  await page.getByLabel("보호자 생년월일").fill("1993-11-23");
  await page.getByRole("button", { name: "다음" }).click();
  await expect(page.getByText("개인정보 수집 동의가 필요합니다.")).toBeVisible();
  await page.getByRole("button", { name: "태블릿 서명 요청" }).click();
  await page.getByRole("button", { name: "서명 완료 처리" }).click();
  await page.getByRole("checkbox", { name: "마케팅 수신 동의" }).check();
  await page.getByRole("button", { name: "다음" }).click();

  await expect(page.getByRole("heading", { name: "신규 환자 등록" })).toBeVisible();
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

  await expect(page.getByRole("heading", { name: "등록 정보 확인" })).toBeVisible();
  await expect(page.getByText("김새봄")).toBeVisible();
  await expect(page.getByText("새롬")).toBeVisible();
  await page.getByRole("button", { name: "등록" }).click();

  await expect(page.getByText("환자/보호자 등록이 완료되었습니다.")).toBeVisible();
  await expect(page.getByTestId("walk-in-reception-dialog")).toHaveCount(0);
});

test("patient guardian registration links an existing guardian to a new patient", async ({ page }) => {
  await page.goto("/w/clair-demo/reception");

  await page.getByRole("button", { name: "환자/보호자 등록", exact: true }).click();
  await page.getByText("기존 보호자에 신규 환자 등록").click();
  await page.getByRole("button", { name: "다음" }).click();
  await expect(page.getByRole("heading", { name: "기존 보호자에 신규 환자 등록" })).toBeVisible();
  await expect(page.getByText("입력한 정보는 최종 확인 후 등록됩니다.")).toHaveCount(0);
  await expect(page.getByText("보호자 선택")).toBeVisible();
  await expect(page.getByText("동물 정보")).toBeVisible();
  await expect(page.getByRole("button", { name: "다음" })).toBeDisabled();
  await page.getByLabel("기존 보호자 검색").fill("오세아");
  await page.getByRole("option", { name: /오세아/ }).click();
  await expect(page.getByRole("button", { name: "다음" })).toBeDisabled();

  const registrationDialog = page.getByLabel("기존 보호자에 신규 환자 등록");
  await expect(page.getByLabel("기존 보호자 검색")).toHaveValue("오세아 010-7812-4401 · 나비");
  await expect(page.getByText("오세아", { exact: true })).toBeVisible();
  await expect(page.getByText("오세아 보호자의 동물")).toBeVisible();
  await expect(registrationDialog.getByText("나비", { exact: true })).toBeVisible();
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
  await expect(page.getByRole("heading", { name: "등록 정보 확인" })).toBeVisible();
  await page.getByRole("button", { name: "등록" }).click();

  await expect(page.getByText("환자 등록이 완료되었습니다.")).toBeVisible();
});

test("patient guardian registration blocks duplicate microchips and warns duplicate patient names", async ({ page }) => {
  await page.goto("/w/clair-demo/reception");

  await page.getByRole("button", { name: "환자/보호자 등록", exact: true }).click();
  await page.getByText("기존 보호자에 신규 환자 등록").click();
  await page.getByRole("button", { name: "다음" }).click();
  await page.getByLabel("기존 보호자 검색").fill("이지은");
  await page.getByRole("option", { name: /이지은/ }).click();
  await page.getByLabel("환자명").fill("코코");
  await expect(page.getByText("동일 보호자 아래 같은 이름의 동물이 이미 등록되어 있습니다.")).toBeVisible();
  await page.getByLabel("품종").fill("푸");
  await page.getByRole("option", { name: "푸들" }).click();
  await page.getByLabel("나이 년").fill("2");
  await page.getByLabel("마이크로칩").fill("410098765432109");
  await page.getByRole("button", { name: "다음" }).click();

  await expect(page.getByText("이미 등록된 마이크로칩 번호입니다.").first()).toBeVisible();
});

test("patient guardian registration asks before leaving dirty drafts", async ({ page }) => {
  await page.goto("/w/clair-demo/reception");

  await page.getByRole("button", { name: "환자/보호자 등록", exact: true }).click();
  await page.getByRole("button", { name: "다음" }).click();
  await page.getByLabel("보호자명").fill("임시보호자");
  await page.getByRole("button", { exact: true, name: "취소" }).click();

  await expect(page.getByRole("heading", { name: "입력을 취소할까요?" })).toBeVisible();
  await page.getByRole("button", { name: "계속 작성" }).click();
  await expect(page.getByLabel("보호자명")).toHaveValue("임시보호자");
  await page.getByRole("button", { exact: true, name: "취소" }).click();
  await page.getByRole("button", { name: "취소하고 나가기" }).click();
  await expect(page.getByRole("heading", { name: "신규 보호자 등록" })).toHaveCount(0);
});

test("nav rail maps menu labels to the intended modules", async ({ page }) => {
  await page.goto("/w/clair-demo/reception");

  await expect(page.getByRole("link", { name: "접수/예약" })).toHaveAttribute(
    "href",
    "/w/clair-demo/reception"
  );
  await expect(page.getByRole("link", { name: "진료(차트)" })).toHaveAttribute(
    "href",
    "/w/clair-demo/treatment"
  );
  await expect(page.getByRole("link", { name: "임상병리검사" })).toHaveAttribute(
    "href",
    "/w/clair-demo/lab"
  );
  await expect(page.getByRole("link", { name: "영상검사" })).toHaveAttribute(
    "href",
    "/w/clair-demo/imaging"
  );
  await expect(page.getByRole("link", { name: "조제/처치" })).toHaveAttribute(
    "href",
    "/w/clair-demo/dispensing"
  );
  await expect(page.getByRole("link", { name: "수납" })).toHaveAttribute(
    "href",
    "/w/clair-demo/billing"
  );
  await expect(page.getByRole("link", { name: "입원" })).toHaveAttribute(
    "href",
    "/w/clair-demo/inpatient"
  );
  await expect(page.getByRole("link", { name: "고객관리" })).toHaveAttribute(
    "href",
    "/w/clair-demo/customer"
  );
  await expect(page.getByRole("link", { name: "병원관리" })).toHaveAttribute(
    "href",
    "/w/clair-demo/orders"
  );
});

test("reception side panel searches by patient and guardian context", async ({ page }) => {
  await page.goto("/w/clair-demo/reception");

  const sidePanel = page.locator("aside").first();
  await sidePanel.getByRole("button", { name: "검색" }).click();
  await sidePanel.getByRole("textbox", { name: "대기열 검색" }).fill("코코");

  await expect(sidePanel.getByTestId("patient-card-patient-coco")).toBeVisible();
  await expect(sidePanel.getByTestId("patient-card-patient-coco")).toContainText("이지은");
  await expect(sidePanel.getByTestId("patient-card-patient-nabi")).toBeHidden();
  await sidePanel.getByRole("button", { name: "검색어 초기화" }).click();
  await expect(sidePanel.getByRole("textbox", { name: "대기열 검색" })).toHaveValue("");
  await expect(sidePanel.getByTestId("patient-card-patient-kong")).toBeVisible();
});

test("reception check-in converts a confirmed appointment into a waiting encounter", async ({ page }) => {
  await page.goto("/w/clair-demo/reception");

  const nabiAppointment = page.getByTestId("appointment-card-appointment-nabi-260501");
  await expect(nabiAppointment).toContainText("예약확정");

  await nabiAppointment.getByRole("button", { name: "접수 처리" }).click();

  await expect(nabiAppointment).toContainText("접수완료");
  await expect(page.getByTestId("patient-card-patient-nabi")).toContainText("피부 재진");
  await expect(page.getByTestId("patient-card-patient-nabi")).toContainText("김도윤");
});

test("reception creates a walk-in waiting row from the new check-in dialog", async ({ page }) => {
  await page.goto("/w/clair-demo/reception");

  const sidePanel = page.locator("aside").first();
  await sidePanel.getByTestId("patient-card-patient-dubu").click();
  await expect(page.getByText("접수 정보")).toBeVisible();
  await page.getByRole("button", { name: "상세 닫기" }).click();
  await page.getByTestId("schedule-check-in-button").click();
  await expect(page).not.toHaveURL(/drawer=/);
  const walkInForm = page.getByTestId("walk-in-reception-dialog");
  await expect(walkInForm.getByRole("heading", { name: "진료 접수" })).toBeVisible();
  await expect(walkInForm.getByText("동물명 또는 보호자명으로 검색")).toBeVisible();
  await expect(walkInForm.getByText("두부 · 정하린")).toHaveCount(0);
  await walkInForm.getByLabel("환자 검색").click();
  await page.getByRole("option", { name: /두부.*정하린/ }).click();
  await expect(walkInForm.getByLabel("방문 목적")).toBeVisible();
  await walkInForm.getByRole("button", { name: "태그 추가" }).click();
  await walkInForm.getByLabel("태그명").fill("재활");
  await walkInForm.getByLabel("태그명").press("Enter");
  await expect(walkInForm.getByRole("button", { name: "재활" })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  await walkInForm.getByLabel("방문 목적").fill("보행 재검 및 통증 상담");
  await walkInForm.getByLabel("접수 메모").fill("보호자가 계단 보행을 걱정함");
  await walkInForm.getByRole("button", { name: "생성" }).click();

  const dubuCard = page.getByTestId("patient-card-patient-dubu");
  await expect(dubuCard).toContainText("두부");
  await expect(dubuCard).toContainText("재활");
  await expect(dubuCard).toContainText("보행 재검 및 통증 상담");
  await expect(dubuCard).toContainText("수의사 미지정");

  const walkInCalendarCard = page.getByTestId("walkin-card-draft-encounter-walkin-patient-dubu");
  await expect(walkInCalendarCard).toContainText("진료대기");
  await expect(walkInCalendarCard).toContainText("담당의 미지정");
  await expect(walkInCalendarCard).toContainText("재활");
  await expect(walkInCalendarCard).toContainText("보행 재검 및 통증 상담");
  await expect(walkInCalendarCard.getByTestId("walkin-purpose-draft-encounter-walkin-patient-dubu")).toContainText("진료");
  await expect(walkInCalendarCard.getByTestId("walkin-accent-draft-encounter-walkin-patient-dubu")).toHaveClass(/atomic-gray-300/);
});

test("reception opens the walk-in form from an empty calendar slot", async ({ page }) => {
  await page.goto(
    "/w/clair-demo/reception?modulePanel=open&drawer=reception-appointment%3Aappointment-nabi-260501"
  );

  await expect(page.getByText("예약 상세").first()).toBeVisible();
  await page.getByTestId("day-empty-slot-14-user-vet-suji").click();

  await expect(page).not.toHaveURL(/drawer=/);
  const walkInForm = page.getByTestId("walk-in-reception-dialog");
  await expect(walkInForm.getByRole("heading", { name: "진료 접수" })).toBeVisible();
  await expect(walkInForm.getByText("동물명 또는 보호자명으로 검색")).toBeVisible();
});

test("reception walk-in keeps selected veterinarian and form details", async ({ page }) => {
  await page.goto("/w/clair-demo/reception");

  const sidePanel = page.locator("aside").first();
  await sidePanel.getByTestId("patient-card-patient-haru").click();
  await expect(page.getByText("접수 정보")).toBeVisible();

  await page.getByRole("button", { name: "상세 닫기" }).click();
  await page.getByTestId("schedule-check-in-button").click();
  const walkInForm = page.getByTestId("walk-in-reception-dialog");
  await expect(walkInForm.getByText("동물명 또는 보호자명으로 검색")).toBeVisible();
  await walkInForm.getByLabel("환자 검색").click();
  await page.getByRole("option", { name: /하루.*강서윤/ }).click();
  await walkInForm.getByLabel("방문 목적").fill("예방접종 전 건강 확인");
  await walkInForm.getByLabel("접수 메모").fill("기존 노쇼 예약과 별도 현장 접수");
  await walkInForm.getByLabel("담당의").click();
  await page.getByRole("option", { name: "김도윤" }).click();
  await walkInForm.getByRole("button", { name: "생성" }).click();

  const haruCard = page.getByTestId("patient-card-patient-haru");
  await expect(haruCard).toContainText("하루");
  await expect(haruCard).toContainText("예방접종 전 건강 확인");
  await expect(haruCard).toContainText("김도윤");

  const walkInCalendarCard = page.getByTestId("walkin-card-draft-encounter-walkin-patient-haru");
  await expect(walkInCalendarCard).toContainText("진료대기");
  await expect(walkInCalendarCard).toContainText("김도윤");
  await expect(walkInCalendarCard).toContainText("기존 노쇼 예약과 별도 현장 접수");
});
