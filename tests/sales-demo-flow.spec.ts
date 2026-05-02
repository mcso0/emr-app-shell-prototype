import { expect, test } from "@playwright/test";

const scenarioQuery = "scenario=kong-vomit&patientId=patient-kong&encounterId=encounter-kong-260501";

test("sales demo launcher opens the Kong golden scenario", async ({ page }) => {
  await page.goto("/w/clair-demo/home?modulePanel=open&aside=closed");

  await expect(page.getByRole("heading", { name: "콩이 구토 내원" })).toBeVisible();
  await expect(page.getByText("김하늘 보호자 · 푸들 · 반복 구토")).toBeVisible();

  await page.getByRole("link", { name: "데모 시작" }).click();

  await expect(page).toHaveURL(/\/w\/clair-demo\/reception/);
  await expect(page).toHaveURL(/scenario=kong-vomit/);
  await expect(page.getByText("콩이 · P-260501-0003").first()).toBeVisible();
});

test("golden scenario can be opened across chart, lab, imaging, and billing", async ({ page }) => {
  await page.goto(`/w/clair-demo/treatment?${scenarioQuery}&modulePanel=open&aside=closed`);
  await expect(page.getByRole("heading", { name: "콩이" })).toBeVisible();
  await expect(page.getByText("급성 위장관염 의심", { exact: true })).toBeVisible();
  await expect(page.getByText("구토 완화 처방")).toBeVisible();
  await expect(page).toHaveURL(/scenario=kong-vomit/);

  await page.goto(`/w/clair-demo/lab?${scenarioQuery}&labResultId=lab-result-kong-cbc&modulePanel=open&aside=closed`);
  await expect(page.getByText("콩이 · P-260501-0003").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "결과 입력" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "WBC 결과값" })).toHaveValue("21.4");
  await expect(page).toHaveURL(/scenario=kong-vomit/);

  await page.goto(
    `/w/clair-demo/imaging?${scenarioQuery}&imagingStudyId=imaging-kong-abdomen&modulePanel=open&aside=closed`
  );
  await expect(page.getByText("콩이 · P-260501-0003").first()).toBeVisible();
  await expect(page.getByText("복부 초음파", { exact: true })).toBeVisible();
  await expect(page.getByText("급성 위장관염 가능성이 높으며")).toBeVisible();
  await expect(page).toHaveURL(/scenario=kong-vomit/);

  await page.goto(`/w/clair-demo/billing?${scenarioQuery}&invoiceId=invoice-kong-260501&modulePanel=open&aside=closed`);
  await expect(page.getByText("INV-260501-0003 · 콩이 · 김하늘")).toBeVisible();
  await expect(page.getByText("156,500원").first()).toBeVisible();
  await page.getByRole("button", { name: "수납 완료" }).click();
  await expect(page.getByText("수납완료").first()).toBeVisible();
  await expect(page).toHaveURL(/scenario=kong-vomit/);
});
