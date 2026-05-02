import { expect, test } from "@playwright/test";

const kongScenarioUrl =
  "/w/clair-demo/treatment?scenario=kong-vomit&patientId=patient-kong&encounterId=encounter-kong-260501&modulePanel=open&aside=closed";

test("chart workspace renders queue, history, SOAP, assessment, and orders", async ({ page }) => {
  await page.goto("/w/clair-demo/treatment");

  await expect(page.getByText("진료 대기열")).toBeVisible();
  await expect(page.getByText("과거 진료 이력")).toBeVisible();
  await expect(page.getByRole("heading", { name: "SOAP" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Assessment", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Assessment History" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Order", exact: true })).toBeVisible();
  await expect(page.getByText("급성 위장관염 의심", { exact: true })).toBeVisible();
  await expect(page.getByText("항구토제 세트")).toBeVisible();
  await expect(page.getByText("피하 수액 처치")).toBeVisible();
  await expect(page.getByText("처치 지시서")).toHaveCount(0);
});

test("chart opens the Kong scenario as one SOAP, assessment, and order flow", async ({ page }) => {
  await page.goto(kongScenarioUrl);

  await expect(page.getByRole("heading", { name: "콩이" })).toBeVisible();
  await expect(page.getByText("김하늘 보호자가 반복 구토와 식욕 저하로 내원했습니다.")).toBeVisible();
  await expect(page.getByText("S 주관")).toBeVisible();
  await expect(page.getByText("O 객관")).toBeVisible();
  await expect(page.getByText("A 평가")).toBeVisible();
  await expect(page.getByText("P 계획")).toBeVisible();
  await expect(page.getByText("급성 위장관염 의심. 이물 가능성 배제를 위해 검사/영상 확인 필요.").first()).toBeVisible();
  await expect(page.getByText("피하 수액과 항구토제 처방 후 수납 안내").first()).toBeVisible();
  await expect(page.getByText("구토 완화 처방")).toBeVisible();
  await expect(page.getByText("CBC 검사")).toBeVisible();
  await expect(page.getByText("복부 초음파")).toBeVisible();
  await expect(page.getByText("조제 대기열 → 수납 청구")).toBeVisible();
  await expect(page.getByText("검사 결과 → 수납 청구")).toBeVisible();
  await expect(page.getByText("영상 판독 → 수납 청구")).toBeVisible();
  await expect(page.getByText("처치 진행 → 수납 청구")).toBeVisible();
});

test("chart queue selection changes the selected encounter", async ({ page }) => {
  await page.goto("/w/clair-demo/treatment");

  await page.getByTestId("chart-queue-item-encounter-haru-260430").click();

  await expect(page.getByRole("heading", { name: "하루" })).toBeVisible();
  await expect(page.getByText("E-260430-0005").first()).toBeVisible();
  await expect(page.getByText("예방접종 전 건강 확인").first()).toBeVisible();
  await expect(page.getByText("진단 입력 전입니다.")).toBeVisible();
});

test("chart scenario query primes the encounter without locking queue selection", async ({ page }) => {
  await page.goto(kongScenarioUrl);

  await expect(page.getByRole("heading", { name: "콩이" })).toBeVisible();

  await page.getByTestId("chart-queue-item-encounter-haru-260430").click();

  await expect(page.getByRole("heading", { name: "하루" })).toBeVisible();
  await expect(page.getByText("E-260430-0005").first()).toBeVisible();
  await expect(page.getByText("예방접종 전 건강 확인").first()).toBeVisible();
});

test("chart history selection returns to a previous encounter for the patient", async ({ page }) => {
  await page.goto("/w/clair-demo/treatment");

  await page.getByTestId("chart-queue-item-encounter-coco-260501").click();
  await page.getByRole("button", { name: /E-260501-0001/ }).click();

  await expect(page.getByRole("heading", { name: "코코" })).toBeVisible();
  await expect(page.getByText("급성 위장관염 의심", { exact: true })).toBeVisible();
  await expect(page.getByText("CBC 검사").first()).toBeVisible();
});
