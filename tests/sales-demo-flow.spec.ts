import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const scenarioQuery = "scenario=kong-vomit&patientId=patient-kong&encounterId=encounter-kong-260501";

async function expectDemoContext(page: Page) {
  const url = new URL(page.url());

  expect(url.searchParams.get("scenario")).toBe("kong-vomit");
  expect(url.searchParams.get("patientId")).toBe("patient-kong");
  expect(url.searchParams.get("encounterId")).toBe("encounter-kong-260501");
}

test("sales demo launcher carries the Kong scenario through the golden path", async ({ page }) => {
  await page.goto("/w/clair-demo/home?view=demo&modulePanel=open&aside=closed");

  await expect(page.getByRole("heading", { name: "콩이 구토 내원" })).toBeVisible();
  await expect(page.getByText("김하늘 보호자 · 푸들 · 반복 구토")).toBeVisible();

  await page.getByRole("link", { name: "데모 시작" }).click();

  await expect(page).toHaveURL(/\/w\/clair-demo\/reception/);
  await expectDemoContext(page);
  await expect(page.getByRole("button", { name: /콩이 · 김하늘/ }).first()).toBeVisible();

  await page.getByRole("link", { name: "진료/차트" }).click();
  await expect(page).toHaveURL(/\/w\/clair-demo\/treatment/);
  await expectDemoContext(page);
  await expect(page.getByLabel("환자 컨텍스트 정보").getByText("콩이")).toBeVisible();
  await expect(page.getByText("급성 위장관염 의심", { exact: true }).first()).toBeVisible();

  await page.getByRole("link", { name: "임상병리검사" }).click();
  await expect(page).toHaveURL(/\/w\/clair-demo\/lab/);
  await expectDemoContext(page);
  await expect(page.getByRole("row", { name: /WBC 21\.4/ })).toBeVisible();

  await page.getByRole("link", { name: "영상검사" }).click();
  await expect(page).toHaveURL(/\/w\/clair-demo\/imaging/);
  await expectDemoContext(page);
  await expect(page.getByTestId("imaging-queue-item-imaging-kong-abdomen")).toContainText("복부 초음파");
  await expect(page.getByRole("textbox", { name: "영상 종합소견" })).toContainText(
    "급성 위장관염 가능성이 높으며"
  );

  await page.getByRole("link", { name: "조제/처치" }).click();
  await expect(page).toHaveURL(/\/w\/clair-demo\/dispensing/);
  await expectDemoContext(page);
  await expect(page.getByRole("heading", { name: "조제 지시서" })).toBeVisible();

  await page.getByRole("link", { name: "수납" }).click();
  await expect(page).toHaveURL(/\/w\/clair-demo\/billing/);
  await expectDemoContext(page);
  await expect(page.getByText("INV-260501-0003 · 콩이 · 김하늘")).toBeVisible();
  await expect(page.getByText("156,500원").first()).toBeVisible();
});

test("reception live reader mock fallbacks preserve the Kong sales demo context", async ({
  page,
}) => {
  let calendarReadRequested = false;
  let queueReadRequested = false;

  await page.route("**/reception/calendar/day**", async (route) => {
    calendarReadRequested = true;
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
  await page.route("**/reception/queue**", async (route) => {
    queueReadRequested = true;
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

  await page.goto(`/w/clair-demo/reception?${scenarioQuery}&modulePanel=open&aside=closed`);

  await expect.poll(() => calendarReadRequested).toBe(true);
  await expect.poll(() => queueReadRequested).toBe(true);
  await expectDemoContext(page);
  await expect(page.getByTestId("appointment-card-appointment-kong-260501")).toContainText(
    "구토 및 복부 불편"
  );
  await expect(page.getByRole("button", { name: /콩이 · 김하늘/ }).first()).toBeVisible();
});

test("golden scenario can be opened across chart, lab, imaging, and billing", async ({ page }) => {
  await page.goto(`/w/clair-demo/treatment?${scenarioQuery}&modulePanel=open&aside=closed`);
  await expect(page.getByLabel("환자 컨텍스트 정보").getByText("콩이")).toBeVisible();
  await expect(page.getByText("급성 위장관염 의심", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("구토 완화 처방")).toBeVisible();
  await expect(page).toHaveURL(/scenario=kong-vomit/);

  await page.goto(`/w/clair-demo/lab?${scenarioQuery}&labResultId=lab-result-kong-cbc&modulePanel=open&aside=closed`);
  await expect(page.getByRole("button", { name: /콩이 · 김하늘/ }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "임상병리검사 결과지" })).toBeVisible();
  await expect(page.getByRole("row", { name: /WBC 21\.4/ })).toBeVisible();
  await expect(page).toHaveURL(/scenario=kong-vomit/);

  await page.goto(
    `/w/clair-demo/imaging?${scenarioQuery}&imagingStudyId=imaging-kong-abdomen&modulePanel=open&aside=closed`
  );
  await expect(page.getByLabel("환자 컨텍스트 정보").getByText("콩이")).toBeVisible();
  await expect(page.getByTestId("imaging-queue-item-imaging-kong-abdomen")).toContainText("복부 초음파");
  await expect(page.getByRole("textbox", { name: "영상 종합소견" })).toContainText(
    "급성 위장관염 가능성이 높으며"
  );
  await expect(page).toHaveURL(/scenario=kong-vomit/);

  await page.goto(`/w/clair-demo/billing?${scenarioQuery}&invoiceId=invoice-kong-260501&modulePanel=open&aside=closed`);
  await expect(page.getByText("INV-260501-0003 · 콩이 · 김하늘")).toBeVisible();
  await expect(page.getByText("156,500원").first()).toBeVisible();
  await page.getByRole("button", { name: "수납 완료" }).click();
  await expect(page.getByText("수납완료").first()).toBeVisible();
  await expect(page).toHaveURL(/scenario=kong-vomit/);
});
