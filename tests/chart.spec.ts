import { expect, test } from "@playwright/test";

const kongScenarioUrl =
  "/w/clair-demo/treatment?scenario=kong-vomit&patientId=patient-kong&encounterId=encounter-kong-260501&modulePanel=open&aside=closed";

test("chart workspace renders queue, history, SOAP, assessment, and orders", async ({ page }) => {
  await page.goto("/w/clair-demo/treatment?modulePanel=open&aside=history&right=open");

  await expect(page.getByText("진료 대기열")).toBeVisible();
  await expect(page.getByRole("button", { name: "차트이력" })).toBeVisible();
  await expect(page.locator("#chart-content-aside").getByText("차트이력")).toBeVisible();
  await expect(page.getByLabel("환자 컨텍스트 정보").getByText("담당 수의사")).toBeVisible();
  await expect(page.getByRole("heading", { name: "진료 기록" })).toBeVisible();
  await expect(page.getByText("소화기 SOAP")).toBeVisible();
  await expect(page.getByRole("heading", { name: "진단명", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "진단 이력" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "처방/오더", exact: true })).toBeVisible();
  await expect(page.getByText("급성 위장관염 의심", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("항구토제 세트")).toBeVisible();
  await expect(page.getByText("피하 수액 처치").first()).toBeVisible();
  await page.getByRole("button", { name: "첨부", exact: true }).click();
  await expect(page.getByText("1개").first()).toBeVisible();
  await expect(page.getByText("처치 지시서")).toHaveCount(0);
});

test("chart diagnosis comment and plan are editable text areas", async ({ page }) => {
  await page.goto(kongScenarioUrl);

  await page.getByLabel("진단 코멘트").fill("보호자에게 탈수 징후 설명 완료.");
  await page.getByLabel("Plan").fill("수액 후 24시간 식욕과 구토 횟수 확인.");

  await expect(page.getByLabel("진단 코멘트")).toHaveValue("보호자에게 탈수 징후 설명 완료.");
  await expect(page.getByLabel("Plan")).toHaveValue("수액 후 24시간 식욕과 구토 횟수 확인.");
});

test("chart opens the Kong scenario as one SOAP, assessment, and order flow", async ({ page }) => {
  await page.goto(kongScenarioUrl);

  const patientContext = page.getByLabel("환자 컨텍스트 정보");
  await expect(patientContext.getByText("콩이")).toBeVisible();
  await expect(patientContext.getByText("김하늘")).toBeVisible();
  await expect(patientContext.getByText("담당 수의사")).toBeVisible();
  await expect(page.getByText("보호자 진술상 전날 밤부터 구토 3회, 아침 식욕 없음. 물 섭취 후 재구토.")).toBeVisible();
  await expect(page.getByText("체온 39.1C, 복부 촉진 시 경미한 불편감. 탈수 경도 의심.")).toBeVisible();
  await expect(page.getByText("급성 위장관염 의심. 이물 가능성 배제를 위해 검사/영상 확인 필요.").first()).toBeVisible();
  await expect(page.getByText("피하 수액과 항구토제 처방 후 수납 안내").first()).toBeVisible();
  await expect(page.getByText("구토 완화 처방")).toBeVisible();
  await expect(page.getByText("CBC 검사").first()).toBeVisible();
  await expect(page.getByText("복부 초음파").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "경구제 1" })).toBeVisible();
  await expect(page.getByRole("button", { name: "원내 검사 1" })).toBeVisible();
  await expect(page.getByRole("button", { name: "영상 1" })).toBeVisible();
  await expect(page.getByRole("button", { name: "치료 1" })).toBeVisible();
});

test("chart queue selection changes the selected encounter", async ({ page }) => {
  await page.goto("/w/clair-demo/treatment");

  await page.getByTestId("order-queue-item-encounter-haru-260430").click();

  await expect(page.getByLabel("환자 컨텍스트 정보").getByText("하루")).toBeVisible();
  await expect(page.getByText("E-260430-0005").first()).toBeVisible();
  await expect(page.getByText("예방접종 전 건강 확인").first()).toBeVisible();
  await expect(page.getByText("진단 입력 전입니다.")).toBeVisible();
});

test("chart scenario query primes the encounter without locking queue selection", async ({ page }) => {
  await page.goto(kongScenarioUrl);

  await expect(page.getByLabel("환자 컨텍스트 정보").getByText("콩이")).toBeVisible();

  await page.getByTestId("order-queue-item-encounter-haru-260430").click();

  await expect(page.getByLabel("환자 컨텍스트 정보").getByText("하루")).toBeVisible();
  await expect(page.getByText("E-260430-0005").first()).toBeVisible();
  await expect(page.getByText("예방접종 전 건강 확인").first()).toBeVisible();
});

test("chart history selection returns to a previous encounter for the patient", async ({ page }) => {
  await page.goto("/w/clair-demo/treatment?modulePanel=open&aside=history");

  await page.getByTestId("order-queue-item-encounter-coco-260501").click();
  await page.getByTestId("chart-history-item-encounter-coco-260501").click();

  await expect(page.getByLabel("환자 컨텍스트 정보").getByText("코코")).toBeVisible();
  await expect(page.getByText("급성 위장관염 의심", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("CBC 검사").first()).toBeVisible();
});

test("chart patient panels collapse and reopen from the context bar", async ({ page }) => {
  await page.goto("/w/clair-demo/treatment?modulePanel=open&aside=history&right=closed");

  await expect(page.locator("#chart-content-aside").getByText("차트이력")).toBeVisible();
  await page.getByRole("button", { name: "차트이력" }).click();
  await expect(page).toHaveURL(/aside=closed/);

  await page.getByRole("button", { name: "차트이력" }).click();
  await expect(page).toHaveURL(/aside=history/);

  await expect(page.getByText("환자 사이드 패널")).toBeHidden();
  await page.getByRole("button", { name: "진단 이력 열기" }).click();
  await expect(page).toHaveURL(/right=open/);
  await expect(page.getByText("환자 사이드 패널")).toBeVisible();
});
