import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";

const workspaceId = "clair-demo";
const encounterId = "encounter-coco-260501";
const defaultChartId = "soap-coco-260501";
const scenarioUrl = (chartId: string) =>
  `/w/${workspaceId}/treatment?patientId=patient-coco&encounterId=${encounterId}&chartId=${chartId}&modulePanel=closed&aside=history`;

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
  await create.click();
  const dialog = page.getByRole("dialog", {
    name: "새 차트를 어느 진료에 추가할까요?",
  });
  await expect(dialog).toBeVisible();
  const currentVisit = dialog.getByTestId(`new-chart-encounter-${encounterId}`);
  await expect(currentVisit).toBeEnabled();
  await currentVisit.click();
  const created = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().includes("chart/encounter-charts"),
  );
  await dialog
    .getByRole("button", { name: "선택한 진료에 차트 추가", exact: true })
    .click();
  const response = await created;
  expect(response.ok()).toBe(true);
  const chartId = (await response.json()).chart.id as string;
  await expect(page).toHaveURL(new RegExp(`chartId=${chartId}`));
  await expect(page.locator(`[data-chart-id="${chartId}"]`)).toBeVisible();
  return chartId;
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
}) => {
  await warmChartWorkspace(page);
  const chartAId = defaultChartId;
  const chartBId = await createChart(page);
  await installScopedOrderFixture(page, chartAId, chartBId);

  await openChart(page, chartAId);
  const footer = page.getByTestId("chart-order-footer");
  await expect(footer).toContainText("미입력 오더 1");
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
  await expect(footer).toContainText("미확정 오더 1");
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
}) => {
  await warmChartWorkspace(page);
  const chartId = await createChart(page);
  const parentId = crypto.randomUUID();
  const childId = crypto.randomUUID();
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
          billingCandidateStatus: "candidate_created",
          clinicalOrderType: "other",
          destinationModule: null,
          executionMode: "aggregate",
          lineTotalSnapshot: 6_000,
          orderId: parentId,
          orderType: "set",
          originChartId: chartId,
          orderConfirmationStatus: "confirmed",
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
          billingCandidateStatus: "candidate_created",
          lineTotalSnapshot: 6_000,
          orderId: childId,
          originChartId: chartId,
          orderConfirmationStatus: "confirmed",
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
  await page.route(
    `**/api/workspaces/${workspaceId}/chart/order-actions*`,
    async (route) => {
      const updatedAt = "2026-09-12T08:00:00.000Z";
      const orderActions = [parentId, childId].map((orderId) => ({
        billingCandidateStatus: "candidate_created",
        encounterId,
        orderConfirmationStatus: "confirmed",
        orderId,
        status: "confirmed",
        updatedAt,
      }));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 200,
          etag: '"included-set-actions"',
          rows: [],
          orderActions,
        }),
      });
    },
  );

  await openChart(page, defaultChartId);
  await openChart(page, chartId);
  const footer = page.getByTestId("chart-order-footer");
  await expect(footer).toContainText("확정 오더 1");
  await expect(footer).toContainText("6,000원");
  await expect(footer).not.toContainText("12,000원");
  await footer.getByRole("button", { name: "금액 상세" }).click();
  const detail = page.getByLabel("Plan/Order 금액 상세");
  await expect(detail.getByText("1건", { exact: true })).toBeVisible();
  await expect(detail).toContainText("청구 가능 6,000원");
});

test("chart billing action navigates to encounter billing without a billing POST", async ({
  page,
}) => {
  await warmChartWorkspace(page);
  await createChart(page);
  let billingPosts = 0;
  await page.route(
    `**/api/workspaces/${workspaceId}/chart/order-billing-summary*`,
    async (route) => {
      if (route.request().method() === "POST") billingPosts += 1;
      await route.fallback();
    },
  );

  const billingButton = page
    .getByTestId("chart-order-footer")
    .getByRole("button", { name: "수납에서 청구" });
  await expect(billingButton).toBeEnabled();
  await billingButton.click();
  await expect(page).toHaveURL(/\/billing\?/);
  expect(billingPosts).toBe(0);
});

test("chart amount detail uses the shared drawer empty state when there are no orders", async ({
  page,
}) => {
  await warmChartWorkspace(page);
  const chartId = await createChart(page);
  await openChart(page, chartId);

  await page
    .getByTestId("chart-order-footer")
    .getByRole("button", { name: "금액 상세" })
    .click();

  const emptyState = page.getByTestId("chart-order-amount-detail-empty");
  await expect(emptyState).toBeVisible();
  await expect(emptyState).toHaveAttribute("data-kind", "no-data");
  await expect(emptyState).toHaveAttribute("data-surface", "drawer");
  await expect(
    emptyState.getByRole("heading", { name: "오더가 없습니다" }),
  ).toBeVisible();
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
  const amountDetailSource = await readFile(
    path.join(
      process.cwd(),
      "src/features/chart/components/chart-order-finance-footer.tsx",
    ),
    "utf8",
  );
  const foundationTokenSource = await readFile(
    path.join(process.cwd(), "src/styles/tokens/emr-foundation.css"),
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
  expect(amountDetailSource).toContain("EmrEmptyState");
  expect(amountDetailSource).toContain(
    "var(--emr-chart-order-amount-detail-width)",
  );
  expect(amountDetailSource).not.toContain("w-[360px]");
  expect(amountDetailSource).not.toContain("이 차트 금액 상세");
  expect(foundationTokenSource).toContain(
    "--emr-chart-order-amount-detail-adjustment-text",
  );
  expect(foundationTokenSource).toContain("--clair-color-atomic-red-600");
});
