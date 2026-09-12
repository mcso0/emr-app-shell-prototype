import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";

const workspaceId = "clair-demo";
const encounterId = "encounter-coco-260501";
const actorHeaders = { "x-clair-demo-session-user-id": "user-vet" };
const scenarioUrl = (chartId: string) =>
  `/w/${workspaceId}/treatment?patientId=patient-coco&encounterId=${encounterId}&chartId=${chartId}&modulePanel=closed&aside=history`;

async function openChart(page: Page, chartId: string) {
  await page.goto(scenarioUrl(chartId));
  const chartButton = page.locator(`[data-chart-id="${chartId}"]`);
  await expect(chartButton).toBeVisible();
  await chartButton.click();
  await expect(page).toHaveURL(new RegExp(`chartId=${chartId}`));
}

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

async function installScopedOrderFixture(
  page: Page,
  chartAId: string,
  chartBId: string,
) {
  await page.route(
    `**/api/workspaces/${workspaceId}/chart/order-drafts*`,
    async (route) => {
      if (route.request().method() !== "GET") {
        await route.fallback();
        return;
      }
      const response = await route.fetch();
      const body = (await response.json()) as {
        rows: Array<Record<string, unknown>>;
      };
      const rows = body.rows.map((row, index) => ({
        ...row,
        originChartId: index === 0 ? chartAId : index === 1 ? chartBId : null,
      }));
      await route.fulfill({
        response,
        contentType: "application/json",
        body: JSON.stringify({ ...body, rows }),
      });
    },
  );
  await page.route(
    `**/api/workspaces/${workspaceId}/chart/order-billing-summary*`,
    async (route) => {
      expect(route.request().method()).toBe("GET");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 200,
          enforcedBy: "chart-order-billing-summary",
          summary: {
            workspaceId,
            encounterId,
            etag: '"encounter-wide-summary"',
            generatedAt: new Date().toISOString(),
            currency: "KRW",
            context: null,
            invoiceId: null,
            orderCounts: {
              total: 99,
              confirmed: 99,
              draft: 0,
              recheck: 0,
              requested: 0,
              requestable: 0,
              cancelled: 0,
            },
            amounts: {
              gross: 999_999,
              confirmed: 999_999,
              draft: 0,
              discount: 0,
              surcharge: 0,
              tax: 0,
              paid: 0,
              outstanding: 999_999,
              estimatedTotal: 999_999,
              requestableTotal: 0,
            },
            requestableOrderIds: [],
            unfinishedOrders: [],
          },
        }),
      });
    },
  );
}

test("Plan/Order rows, counts, and money follow only the active chart", async ({
  page,
  request,
}) => {
  const chartAId = await createChart(request);
  const chartBId = await createChart(request);
  await installScopedOrderFixture(page, chartAId, chartBId);

  await openChart(page, chartAId);
  const footer = page.getByTestId("chart-order-footer");
  await expect(footer).toContainText("오더 1건");
  await expect(footer).toContainText("4,500원");
  await expect(footer).not.toContainText("999,999원");
  await expect(
    page.getByRole("checkbox", { name: "Maropitant 16mg T 선택" }),
  ).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: "CBC 검사 선택" }),
  ).toHaveCount(0);
  await expect(page.getByLabel("처방 조회 범위")).toHaveCount(0);

  await openChart(page, chartBId);
  await expect(footer).toContainText("오더 1건");
  await expect(footer).toContainText("35,000원");
  await expect(
    page.getByRole("checkbox", { name: "CBC 검사 선택" }),
  ).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: "Maropitant 16mg T 선택" }),
  ).toHaveCount(0);
});

test("included-order-sum set counts once and does not double-charge its parent", async ({
  page,
  request,
}) => {
  const chartId = await createChart(request);
  await page.route(
    `**/api/workspaces/${workspaceId}/chart/order-drafts*`,
    async (route) => {
      if (route.request().method() !== "GET") {
        await route.fallback();
        return;
      }
      const response = await route.fetch();
      const body = (await response.json()) as {
        rows: Array<Record<string, unknown>>;
      };
      const source = body.rows[0];
      const parentId = crypto.randomUUID();
      const childId = crypto.randomUUID();
      const rows = [
        {
          ...source,
          appliedSnapshot: {
            amountBasis: "included_order_sum",
            billingName: "Synthetic set",
            displayName: "Synthetic set",
            items: [],
          },
          calculationOutputs: { childSubtotalKrw: 6_000 },
          clinicalOrderType: "other",
          destinationModule: null,
          executionMode: "aggregate",
          lineTotalSnapshot: 6_000,
          orderId: parentId,
          orderType: "set",
          originChartId: chartId,
          parentOrderId: null,
          rowType: "set",
          sourceSetId: crypto.randomUUID(),
          sourceSetRevisionId: crypto.randomUUID(),
          unitPriceSnapshot: 6_000,
        },
        {
          ...source,
          appliedSnapshot: {
            billingName: "Synthetic set child",
            displayName: "Synthetic set child",
            selected: true,
          },
          lineTotalSnapshot: 6_000,
          orderId: childId,
          originChartId: chartId,
          parentOrderId: parentId,
          rowType: "set_child",
          unitPriceSnapshot: 6_000,
        },
      ];
      await route.fulfill({
        response,
        contentType: "application/json",
        body: JSON.stringify({ ...body, rows }),
      });
    },
  );

  await openChart(page, chartId);
  const footer = page.getByTestId("chart-order-footer");
  await expect(footer).toContainText("오더 1건");
  await expect(footer).toContainText("6,000원");
  await expect(footer).not.toContainText("12,000원");
});

test("chart billing action navigates to encounter billing without a billing POST", async ({
  page,
  request,
}) => {
  const chartId = await createChart(request);
  let billingPosts = 0;
  await page.route(
    `**/api/workspaces/${workspaceId}/chart/order-billing-summary*`,
    async (route) => {
      if (route.request().method() === "POST") billingPosts += 1;
      await route.fallback();
    },
  );

  await openChart(page, chartId);
  const billingButton = page
    .getByTestId("chart-order-footer")
    .getByRole("button", { name: "수납에서 청구" });
  await expect(billingButton).toBeEnabled();
  await billingButton.click();
  await expect(page).toHaveURL(/\/billing\?/);
  expect(billingPosts).toBe(0);
});

test("source contract keeps UI scope local while server mutations retain chart ownership", async () => {
  const moduleSource = await readFile(
    path.join(process.cwd(), "src/features/chart/module.tsx"),
    "utf8",
  );
  const draftServerSource = await readFile(
    path.join(
      process.cwd(),
      "src/features/chart/server-order-draft-persistence-core.ts",
    ),
    "utf8",
  );
  const actionServerSource = await readFile(
    path.join(
      process.cwd(),
      "src/features/chart/server-order-action-persistence-core.ts",
    ),
    "utf8",
  );

  expect(moduleSource).not.toContain("EncounterOrderArea");
  expect(moduleSource).not.toContain("처방 조회 범위");
  expect(moduleSource).toContain(
    "const effectiveBillingSummary = localBillingSummary",
  );
  expect(moduleSource).toContain("onNavigateToBilling?.(");
  expect(moduleSource).not.toContain("requestChartOrderBillingRoute");
  expect(draftServerSource).toContain("order_chart_mismatch");
  expect(actionServerSource).toContain(
    "(row.originChartId ?? null) !== (chartId ?? null)",
  );
});
