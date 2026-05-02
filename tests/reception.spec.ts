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
  await expect(sideTabs.getByRole("button", { name: "전체", exact: true })).toBeVisible();
  await expect(sideTabs.getByRole("button", { name: "접수", exact: true })).toBeVisible();
  await expect(sideTabs.getByRole("button", { name: "예약", exact: true })).toBeVisible();
  await expect(sidePanel.getByText("전체", { exact: true })).toHaveCount(2);
  await sideTabs.getByRole("button", { name: "접수", exact: true }).click();
  await expect(sidePanel.getByText("접수", { exact: true })).toHaveCount(2);
  await expect(sidePanel.getByText("나비 · P-260414-0009")).toHaveCount(0);
  await sideTabs.getByRole("button", { name: "예약", exact: true }).click();
  await expect(sidePanel.getByText("예약 작업")).toHaveCount(0);
  await expect(sidePanel.getByText("예약", { exact: true })).toHaveCount(2);
  await expect(sidePanel.getByText("나비 · P-260414-0009")).toBeVisible();
  await expect(sidePanel.getByText("코코 · P-260414-0008")).toHaveCount(0);
  await expect(sidePanel.getByRole("textbox", { name: "환자 검색" })).toHaveCount(0);
  await sidePanel.getByRole("button", { name: "검색" }).click();
  await expect(sidePanel.getByRole("textbox", { name: "환자 검색" })).toBeVisible();
  await expect(page.getByText("환자 상세")).toHaveCount(0);
  await expect(page.getByText("진료 대기열")).toHaveCount(0);
  await expect(page.getByText("잠금 주의사항")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "접수 폼" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "스케줄 생성" })).toHaveCount(0);
});

test("reception calendar options expose Excel import and export actions", async ({ page }) => {
  await page.goto("/w/clair-demo/reception");

  const calendarOptionsButton = page.getByRole("button", { name: "캘린더 옵션" });
  await expect(async () => {
    await calendarOptionsButton.click();
    await expect(calendarOptionsButton).toHaveAttribute("aria-expanded", "true", {
      timeout: 1_000,
    });
  }).toPass();

  await expect(page.getByRole("menuitem", { name: "Excel 다운로드" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Excel 업로드" })).toBeVisible();
});

test("reception veterinarian selector controls visible schedule lanes", async ({ page }) => {
  await page.goto("/w/clair-demo/reception");

  const calendar = page.getByTestId("reception-day-calendar");

  await expect(calendar.getByText("이수지", { exact: true }).first()).toBeVisible();
  await expect(calendar.getByText("김도윤", { exact: true }).first()).toBeVisible();

  const veterinarianButton = page.getByRole("button", { name: "수의사 2" });
  await expect(async () => {
    await veterinarianButton.click();
    await expect(veterinarianButton).toHaveAttribute("aria-expanded", "true", {
      timeout: 1_000,
    });
  }).toPass();
  await page.getByRole("menuitemcheckbox", { name: "김도윤" }).click();

  await expect(page.getByRole("button", { name: "이수지" })).toBeVisible();
  await expect(calendar.getByText("김도윤", { exact: true })).toHaveCount(0);
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
  await expect(page.getByText("나비 · 오세아")).toBeVisible();
  await expect(page.getByRole("button", { name: "접수 처리" }).last()).toBeVisible();
});

test("patient drawer supports editing and guardian navigation", async ({ page }) => {
  await page.goto("/w/clair-demo/reception");

  const sidePanel = page.locator("aside").first();
  await sidePanel.getByText("두부 · P-260501-0002").click();

  await expect(page.getByText("환자 정보")).toBeVisible();
  await expect(page.getByText("보호자 연결")).toBeVisible();
  await expect(page.getByText("정하린", { exact: true })).toBeVisible();
  await expect(page.getByText("강서윤", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "수정" }).click();
  await page.getByLabel("품종").fill("포메라니안 믹스");
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page.getByLabel("품종")).toHaveValue("포메라니안 믹스");

  await page.getByRole("button", { name: "보호자 강서윤 보기" }).click();

  await expect(page.getByText("보호자 정보")).toBeVisible();
  await expect(page.getByText("연결 환자").last()).toBeVisible();
  await expect(page.getByText("하루", { exact: true }).last()).toBeVisible();
  await expect(page.getByText("두부", { exact: true }).last()).toBeVisible();
});

test("patient drawer shows CS history and latest shortcuts", async ({ page }) => {
  await page.goto("/w/clair-demo/reception");

  const sidePanel = page.locator("aside").first();
  await sidePanel.getByText("코코 · P-260414-0008").click();

  await page.getByRole("button", { name: "CS 이력" }).click();
  await expect(page.getByText("접수 문의")).toBeVisible();
  await page.getByRole("button", { name: "KakaoTalk" }).click();
  await expect(page.getByText("검사 결과 안내")).toBeVisible();

  await page.getByRole("button", { name: "최신내역" }).click();
  await expect(page.getByText("최근 조제")).toBeVisible();
  await expect(page.getByText("최근 검사")).toBeVisible();
});

test("new patient registration validates and opens the patient drawer", async ({ page }) => {
  await page.goto("/w/clair-demo/reception");

  await page.getByRole("button", { name: "신규 환자" }).click();
  await page.getByRole("button", { name: "등록" }).click();
  await expect(page.getByText("환자명은 필수입니다.")).toBeVisible();

  await page.getByLabel("환자명").fill("새롬");
  await page.getByLabel("품종").fill("푸들");
  await page.getByLabel("보호자명").fill("김새봄");
  await page.getByLabel("보호자 휴대전화").fill("010-2222-3333");
  await page.getByRole("button", { name: "등록" }).click();

  await expect(page.getByText("환자 정보")).toBeVisible();
  await expect(page.getByText("새롬", { exact: true })).toBeVisible();
  await expect(page.getByLabel("품종").first()).toHaveValue("푸들");
  await expect(page.getByText("김새봄", { exact: true })).toBeVisible();
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
  await expect(page.getByRole("button", { name: "고객관리" })).toBeVisible();
  await expect(page.getByRole("link", { name: "병원관리" })).toHaveAttribute(
    "href",
    "/w/clair-demo/orders"
  );
});

test("reception side panel searches by patient and guardian context", async ({ page }) => {
  await page.goto("/w/clair-demo/reception");

  const sidePanel = page.locator("aside").first();
  await sidePanel.getByRole("button", { name: "검색" }).click();
  await sidePanel.getByRole("textbox", { name: "환자 검색" }).fill("코코");

  await expect(sidePanel.getByText("코코 · P-260414-0008")).toBeVisible();
  await expect(sidePanel.getByText("이지은 · 010-3245-1188")).toBeVisible();
  await expect(sidePanel.getByText("나비 · P-260414-0009")).toBeHidden();
});

test("reception check-in converts a confirmed appointment into a waiting encounter", async ({ page }) => {
  await page.goto("/w/clair-demo/reception");

  const nabiAppointment = page.getByTestId("appointment-card-appointment-nabi-260501");
  await expect(nabiAppointment).toContainText("예약확정");

  await nabiAppointment.getByRole("button", { name: "접수 처리" }).click();

  await expect(nabiAppointment).toContainText("접수완료");
  await expect(page.getByTestId("patient-card-patient-nabi")).toContainText("대기");
});

test("reception creates a walk-in waiting row for the selected patient", async ({ page }) => {
  await page.goto("/w/clair-demo/reception");

  const sidePanel = page.locator("aside").first();
  await sidePanel.getByText("두부 · P-260501-0002").click();
  await expect(page.getByText("환자 정보")).toBeVisible();
  await page.getByRole("button", { name: "상세 닫기" }).click();
  await expect(page).not.toHaveURL(/drawer=/);
  await page.getByRole("button", { name: "현장 접수" }).click();
  await expect(page).toHaveURL(/drawer=reception-form/);
  await expect(page.getByRole("heading", { name: "접수" }).last()).toBeVisible();
  await expect(page.getByLabel("방문 목적")).toBeVisible();
  await page.getByRole("button", { name: "생성" }).click();

  await expect(page.getByTestId("patient-card-patient-dubu")).toContainText("대기");
});
