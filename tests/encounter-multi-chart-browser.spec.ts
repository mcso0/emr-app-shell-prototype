import { expect, test, type Page } from "@playwright/test";

const createButton = (page: Page) =>
  page.getByRole("button", { name: "+ 새 차트", exact: true }).first();

async function openNewChartDialog(page: Page) {
  await createButton(page).click();
  const dialog = page.getByRole("dialog", {
    name: "새 차트를 어느 진료에 추가할까요?",
  });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function createNewChart(page: Page) {
  const dialog = await openNewChartDialog(page);
  const created = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().includes("chart/encounter-charts"),
  );
  await dialog
    .getByRole("button", { name: "선택한 진료에 차트 추가", exact: true })
    .click();
  return created;
}

test("new charts isolate SOAP, preserve saves across switches and refresh, and sign individually", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1920, height: 1080 });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/w/clair-demo/treatment?encounterId=encounter-coco-260501&patientId=patient-coco&modulePanel=open&aside=history");
  await expect(page.getByLabel("SOAP 블록 문서")).toBeVisible();
  const create = createButton(page);
  await expect(create).toBeEnabled();
  const firstDialog = await openNewChartDialog(page);
  await expect(firstDialog).toContainText("현재 보고 있는 진료");
  await expect(firstDialog).toContainText("새 차트 담당자: 송민재 · 오늘 작성");
  const created = page.waitForResponse((response) => response.request().method() === "POST" && response.url().includes("chart/encounter-charts"));
  await firstDialog.getByRole("button", { name: "선택한 진료에 차트 추가", exact: true }).click();
  const createdResponse = await created;
  expect(createdResponse.ok()).toBe(true);
  const createdChart = (await createdResponse.json()).chart;
  const createdId = createdChart.id;
  expect(createdChart).toMatchObject({
    authorUserId: "user-admin",
    authorDisplayName: "송민재",
  });
  await expect(page).toHaveURL(new RegExp(`chartId=${createdId}`));
  await expect(page.locator(`[data-chart-id="${createdId}"]`)).toContainText(
    "담당 송민재",
  );
  await expect(page.getByTestId("chart-additional-record-badge")).toBeVisible();
  await expect(page.getByTestId("chart-additional-record-info")).toContainText(
    "진료에 포함됩니다",
  );
  const firstId = new URL(page.url()).searchParams.get("chartId")!;
  const editor = page.getByLabel("SOAP 블록 문서");
  const paragraph = editor.locator('.bn-block-content[data-content-type="paragraph"]').first();
  await expect(paragraph).toBeEditable();
  await paragraph.click();
  await page.keyboard.type("Synthetic morning chart note");
  const saved = page.waitForResponse((response) => response.request().method() === "PATCH" && response.url().includes("chart/soap-notes") && response.request().postDataJSON()?.chartId === firstId);
  // Creation must flush the original chart, even while its debounce is pending.
  await (await createNewChart(page));
  expect((await saved).ok()).toBe(true);
  await expect.poll(() => new URL(page.url()).searchParams.get("chartId")).not.toBe(firstId);
  const secondId = new URL(page.url()).searchParams.get("chartId")!;
  await expect(editor).not.toContainText("Synthetic morning chart note");
  await expect(page.getByLabel("처방 조회 범위")).toHaveValue("chart");
  await expect(paragraph).toBeEditable();
  await paragraph.click();
  await page.keyboard.type("Synthetic afternoon chart note");
  await page.locator(`[data-chart-id="${firstId}"]`).click();
  await expect(editor).toContainText("Synthetic morning chart note");
  await expect(editor).not.toContainText("Synthetic afternoon chart note");
  await page.reload();
  await expect(page).toHaveURL(new RegExp(`chartId=${firstId}`));
  await expect(editor).toContainText("Synthetic morning chart note");
  await page.locator(`[data-chart-id="${secondId}"]`).click();
  await expect(editor).toContainText("Synthetic afternoon chart note");
  await page.getByRole("button", { name: "차트 완료", exact: true }).click();
  await expect(page.getByRole("button", { name: "완료 차트 수정", exact: true })).toBeVisible();
  await expect(page.locator(`[data-chart-id="${firstId}"]`)).not.toContainText("완료");
  await expect(create).toBeEnabled();
  await expect(page.getByRole("button", { name: "Order 추가", exact: true }).first()).toBeDisabled();
  await page.getByRole("button", { name: "완료 차트 수정", exact: true }).click();
  await expect(page.getByRole("button", { name: "수정 시작", exact: true })).toBeDisabled();
  await page.getByLabel("수정 사유", { exact: true }).fill("Synthetic correction after review");
  await page.getByRole("button", { name: "수정 시작", exact: true }).click();
  await expect(paragraph).toBeEditable();
  await paragraph.click();
  await page.keyboard.press("End");
  await page.keyboard.type(" amended");
  const amendment = page.waitForResponse((response) => response.request().method() === "PATCH" && response.url().includes("chart/soap-notes") && response.request().postDataJSON()?.chartId === secondId);
  await page.getByRole("button", { name: "수정 마침", exact: true }).click();
  const amendmentResponse = await amendment;
  expect(amendmentResponse.ok()).toBe(true);
  expect(amendmentResponse.request().postDataJSON().amendmentReason).toBe("Synthetic correction after review");
  await expect(page.getByRole("button", { name: "완료 차트 수정", exact: true })).toBeVisible();
  await page.reload();
  await expect(editor).toContainText("amended");
  await expect(page.locator(`[data-chart-id="${firstId}"]`)).not.toContainText("완료");
  await page.getByLabel("처방 조회 범위").selectOption("encounter");
  await expect(page.getByLabel("처방 조회 범위")).toHaveValue("encounter");
  await expect(page.getByRole("button", { name: "Order 추가", exact: true }).first()).toBeDisabled();
  await expect(page.getByText("오더 정보를 불러오는 중", { exact: false })).toHaveCount(0);
  await page.screenshot({ path: "/tmp/chart-pr037-two-charts.png", fullPage: false });
  expect(errors).toEqual([]);
});

test("failed SOAP save blocks chart creation, preserves text, and explicit retry recovers", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/w/clair-demo/treatment?encounterId=encounter-coco-260501&patientId=patient-coco&modulePanel=open&aside=history");
  const create = createButton(page);
  await expect(create).toBeEnabled();
  const createdResponse = await createNewChart(page);
  expect(createdResponse.ok()).toBe(true);
  const createdId = (await createdResponse.json()).chart.id;
  await expect(page).toHaveURL(new RegExp(`chartId=${createdId}`));
  const chartId = new URL(page.url()).searchParams.get("chartId")!;
  const editor = page.getByLabel("SOAP 블록 문서");
  let failNext = true;
  await page.route("**/chart/soap-notes", async (route) => {
    if (route.request().method() === "PATCH" && failNext) {
      failNext = false;
      await route.fulfill({ status: 500, json: { ok: false, status: 500, error: "db_write_failed" } });
    } else await route.continue();
  });
  const paragraph = editor.locator('.bn-block-content[data-content-type="paragraph"]').first();
  await expect(paragraph).toBeEditable();
  await paragraph.click(); await page.keyboard.type("Synthetic preserved failed-save text");
  const failedDialog = await openNewChartDialog(page);
  await failedDialog.getByRole("button", { name: "선택한 진료에 차트 추가", exact: true }).click();
  await expect.poll(() => failNext).toBe(false);
  await expect(failedDialog).toBeVisible();
  await expect(page.locator('h2[aria-label="Subject/Object"]')).toContainText("저장 실패");
  await expect(page).toHaveURL(new RegExp(`chartId=${chartId}`));
  await expect(editor).toContainText("Synthetic preserved failed-save text");
  await failedDialog.getByRole("button", { name: "취소" }).click();
  const retry = page.waitForResponse((response) => response.request().method() === "PATCH" && response.url().includes("chart/soap-notes") && response.request().postDataJSON()?.chartId === chartId);
  await page.getByRole("button", { name: "SOAP 저장", exact: true }).click();
  expect((await retry).ok()).toBe(true);
  await expect(page.getByRole("heading", { name: "Subject/Object", exact: true })).not.toContainText("저장 실패");
  const recoveredDialog = await openNewChartDialog(page);
  const recoveredCreate = page.waitForResponse((response) => response.request().method() === "POST" && response.url().includes("chart/encounter-charts"));
  await recoveredDialog.getByRole("button", { name: "선택한 진료에 차트 추가", exact: true }).click();
  expect((await recoveredCreate).ok()).toBe(true);
  await expect.poll(() => new URL(page.url()).searchParams.get("chartId")).not.toBe(chartId);
  await page.locator(`[data-chart-id="${chartId}"]`).click();
  await expect(editor).toContainText("Synthetic preserved failed-save text");
});

test("assessment response advances the SOAP token before the next save and chart switch", async ({ page, request }) => {
  test.setTimeout(90_000);
  await page.goto("/w/clair-demo/treatment?encounterId=encounter-coco-260501&modulePanel=open&aside=history");
  const create = createButton(page);
  await expect(create).toBeEnabled();
  const chart = (await (await createNewChart(page)).json()).chart;
  await expect(page).toHaveURL(new RegExp(`chartId=${chart.id}`));
  const paragraph = page.getByLabel("SOAP 블록 문서").locator('.bn-block-content[data-content-type="paragraph"]').first();
  await paragraph.click();
  const initialSave = page.waitForResponse((r) => r.request().method() === "PATCH" && r.url().includes("chart/soap-notes"));
  await page.keyboard.type("Synthetic diagnosis revision check");
  expect((await initialSave).ok()).toBe(true);
  let assessed = false;
  const expectedToken = "2026-09-09T07:30:00.123456+00:00";
  const sentTokens: unknown[] = [];
  await page.route("**/chart/diagnoses", async (route) => {
    if (route.request().method() !== "PATCH") return route.continue();
    const response = await route.fetch();
    const body = await response.json();
    expect(body.ok).toBe(true);
    const soap = await request.get(`/api/workspaces/clair-demo/chart/soap-notes?encounterId=encounter-coco-260501&chartId=${chart.id}`, { headers: { "x-clair-demo-session-user-id": "user-vet" } });
    const saved = (await soap.json()).soapNote;
    assessed = true;
    // The real RPC holds the note lock while recording assessments. A redundant
    // editable-toggle event must not enqueue a SOAP save with the old revision.
    await new Promise((resolve) => setTimeout(resolve, 1200));
    await route.fulfill({ response, json: { ...body, chart: { ...saved, updatedAt: expectedToken } } });
  });
  await page.route("**/chart/soap-notes", async (route) => {
    if (route.request().method() !== "PATCH" || !assessed) return route.continue();
    const input = route.request().postDataJSON();
    sentTokens.push(input.expectedUpdatedAt);
    await route.fulfill({ json: { ok: true, status: 200, auditRecorded: true, soapNote: { ...chart, blockDocument: input.blockDocument, updatedAt: expectedToken } } });
  });
  const assessmentSaved = page.waitForResponse((r) => r.request().method() === "PATCH" && r.url().includes("chart/diagnoses"));
  await page.getByRole("button", { name: "현재 진단 전체를 평가 기록", exact: true }).click();
  expect((await assessmentSaved).ok()).toBe(true);
  expect(sentTokens).toEqual([]);
  await expect(page.getByRole("button", { name: "SOAP 저장", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "SOAP 저장", exact: true }).click();
  await expect.poll(() => sentTokens.length).toBeGreaterThan(0);
  expect(sentTokens).toEqual(sentTokens.map(() => expectedToken));
  await expect(page.getByText("저장 충돌", { exact: true })).toHaveCount(0);
  await (await createNewChart(page));
  await expect(page).not.toHaveURL(new RegExp(`chartId=${chart.id}`));
});
