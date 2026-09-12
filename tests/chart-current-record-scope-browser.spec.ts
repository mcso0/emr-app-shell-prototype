import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";

const workspaceId = "clair-demo";
const encounterId = "encounter-coco-260501";
const actorHeaders = { "x-clair-demo-session-user-id": "user-vet" };

async function createChart(request: APIRequestContext) {
  const response = await request.post(
    `/api/workspaces/${workspaceId}/chart/encounter-charts`,
    {
      data: { encounterId, creationRequestId: crypto.randomUUID() },
      headers: actorHeaders,
    },
  );
  expect(response.ok()).toBe(true);
  return (await response.json()).chart.id as string;
}

test("Assessment renders only the selected chart snapshot", async ({
  page,
  request,
}) => {
  const chartAId = await createChart(request);
  const chartBId = await createChart(request);
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

  const scenarioUrl = (chartId: string) =>
    `/w/${workspaceId}/treatment?patientId=patient-coco&encounterId=${encounterId}&chartId=${chartId}&modulePanel=closed&aside=history`;
  const openChart = async (targetPage: Page, chartId: string) => {
    await targetPage.goto(scenarioUrl(chartId));
    const chartButton = targetPage.locator(`[data-chart-id="${chartId}"]`);
    await expect(chartButton).toBeVisible();
    await chartButton.click();
    await expect(targetPage).toHaveURL(new RegExp(`chartId=${chartId}`));
  };

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
