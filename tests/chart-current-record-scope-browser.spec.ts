import {
  expect,
  test,
  type Page,
} from "@playwright/test";

const workspaceId = "clair-demo";
const encounterId = "encounter-coco-260501";
const defaultChartId = "soap-coco-260501";
const scenarioUrl = (chartId: string) =>
  `/w/${workspaceId}/treatment?patientId=patient-coco&encounterId=${encounterId}&chartId=${chartId}&modulePanel=closed&aside=history`;

async function warmChartWorkspace(page: Page) {
  await page.goto(scenarioUrl(defaultChartId));
  await expect(
    page.locator(`[data-chart-id="${defaultChartId}"]`),
  ).toBeVisible({ timeout: 15_000 });
}

async function createChart(page: Page) {
  const create = page
    .getByRole("button", { name: "+ 새 차트", exact: true })
    .first();
  await expect(create).toBeEnabled();
  const created = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().includes("chart/encounter-charts"),
  );
  await create.click();
  const response = await created;
  expect(response.ok()).toBe(true);
  const chartId = (await response.json()).chart.id as string;
  await expect(page).toHaveURL(new RegExp(`chartId=${chartId}`));
  await expect(page.locator(`[data-chart-id="${chartId}"]`)).toBeVisible();
  return chartId;
}

async function openChart(page: Page, chartId: string) {
  const chartButton = page.locator(`[data-chart-id="${chartId}"]`);
  await expect(chartButton).toBeVisible({ timeout: 15_000 });
  await expect(async () => {
    if ((await chartButton.getAttribute("aria-pressed")) !== "true") {
      await chartButton.click();
    }
    await expect(chartButton).toHaveAttribute("aria-pressed", "true", {
      timeout: 2_000,
    });
  }).toPass({ timeout: 15_000 });
  await expect
    .poll(() => new URL(page.url()).searchParams.get("chartId"), {
      timeout: 15_000,
    })
    .toBe(chartId);
}

test("Assessment renders only the selected chart snapshot", async ({ page }) => {
  await warmChartWorkspace(page);
  const chartAId = defaultChartId;
  const chartBId = await createChart(page);
  const createdAt = "2026-09-12T08:00:00.000Z";
  const diagnoses = [
    {
      id: "21370000-0000-4000-8000-000000000001",
      encounterId,
      diagnosisText: "Synthetic chart A assessment",
      diagnosisType: "suspected",
      isPrimary: true,
      sortOrder: 0,
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: "21370000-0000-4000-8000-000000000002",
      encounterId,
      diagnosisText: "Synthetic chart B assessment",
      diagnosisType: "confirmed",
      isPrimary: false,
      sortOrder: 1,
      createdAt,
      updatedAt: createdAt,
    },
  ];

  await page.route(`**/api/workspaces/${workspaceId}/chart/diagnoses*`, async (route) => {
    const chartId = new URL(route.request().url()).searchParams.get("chartId");
    const assessments =
      chartId === chartAId ? [diagnoses[0]] : chartId === chartBId ? [diagnoses[1]] : [];
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        status: 200,
        diagnoses,
        assessments,
        version: `version-${chartId}`,
        enforcedBy: "chart-diagnosis-persistence",
      }),
    });
  });

  await openChart(page, chartAId);
  await expect(
    page.getByRole("row", { name: /Synthetic chart A assessment/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("row", { name: /Synthetic chart B assessment/ }),
  ).toHaveCount(0);
  await expect(page.getByText(/이 차트 평가 .*접수 진단/)).toHaveCount(0);
  await expect(
    page.getByRole("button", {
      name: "현재 진단 전체를 평가 기록",
      exact: true,
    }),
  ).toHaveCount(0);

  await openChart(page, chartBId);
  await expect(
    page.getByRole("row", { name: /Synthetic chart B assessment/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("row", { name: /Synthetic chart A assessment/ }),
  ).toHaveCount(0);
});
