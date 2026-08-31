import { expect, test, type Page, type Route } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";

import type { ChartOrderBillingSummary } from "../src/features/chart/chart-order-billing-summary-contract";

const scenarioUrl =
  "/w/clair-demo/treatment?scenario=kong-vomit&patientId=patient-kong&encounterId=encounter-kong-260501&modulePanel=closed&aside=closed";

function createSummary({
  etag,
  estimatedTotal,
  requestable = 1,
}: {
  etag: string;
  estimatedTotal: number;
  requestable?: number;
}): ChartOrderBillingSummary {
  return {
    workspaceId: "clair-demo",
    encounterId: "encounter-kong-260501",
    etag,
    generatedAt: new Date().toISOString(),
    currency: "KRW",
    context: null,
    invoiceId: null,
    orderCounts: {
      total: 4,
      confirmed: 1,
      draft: 3,
      recheck: 0,
      requested: 0,
      requestable,
      cancelled: 0,
    },
    amounts: {
      gross: estimatedTotal,
      confirmed: 45_000,
      draft: estimatedTotal - 45_000,
      discount: 0,
      surcharge: 0,
      tax: 0,
      paid: 0,
      outstanding: 0,
      estimatedTotal,
      requestableTotal: requestable ? 45_000 : 0,
    },
    requestableOrderIds: requestable ? ["order-kong-maropitant"] : [],
    unfinishedOrders: [],
  };
}

async function fulfillSummary(route: Route, summary: ChartOrderBillingSummary) {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      enforcedBy: "chart-order-billing-summary",
      ok: true,
      status: 200,
      summary,
    }),
  });
}

async function dispatchWindowFocus(page: Page) {
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
}

test("persisted order edits refresh the authoritative footer amount without reload", async ({
  page,
}) => {
  let estimatedTotal = 134_500;
  let summaryReads = 0;
  let mutationPersisted = false;
  let readsAfterMutation = 0;
  let mutationRequests = 0;

  await page.route(
    "**/api/workspaces/clair-demo/chart/order-billing-summary*",
    async (route) => {
      expect(route.request().method()).toBe("GET");
      summaryReads += 1;
      if (mutationPersisted) readsAfterMutation += 1;
      await fulfillSummary(
        route,
        createSummary({
          etag: `\"billing-${summaryReads}\"`,
          estimatedTotal,
        }),
      );
    },
  );
  await page.route(
    "**/api/workspaces/clair-demo/chart/order-drafts*",
    async (route) => {
      if (route.request().method() !== "PATCH") {
        await route.fallback();
        return;
      }
      const response = await route.fetch();
      mutationRequests += 1;
      const body = route.request().postDataJSON() as {
        rows?: Array<{ orderId?: string; quantity?: number }>;
      };
      const quantity = body.rows?.find(
        (row) => row.orderId === "order-kong-maropitant",
      )?.quantity;
      if (quantity === 2) {
        estimatedTotal = 139_000;
        mutationPersisted = true;
      }
      const responseBody = (await response.json()) as Record<string, unknown>;
      await route.fulfill({
        response,
        contentType: "application/json",
        body: JSON.stringify({
          ...responseBody,
          billingSummary: createSummary({
            etag: '"billing-draft-response"',
            estimatedTotal,
          }),
        }),
      });
    },
  );

  await page.goto(scenarioUrl);
  const footer = page.getByTestId("chart-order-footer");
  await expect(footer).toContainText("134,500원");

  await page.getByLabel("Maropitant 16mg T 수량 수정").fill("2");
  await expect(footer).toContainText("오더 예상 총액");
  await expect(footer).toContainText("예상 · 저장 중");
  await expect(footer).toContainText("139,000원");
  await expect(page.getByTestId("chart-order-save-status")).toContainText(
    "저장됨",
    { timeout: 10_000 },
  );

  await expect.poll(() => mutationRequests).toBe(1);
  expect(readsAfterMutation).toBe(0);
  await expect(footer).toContainText("139,000원");
  await expect(footer).toContainText("청구 예상 총액");
});

test("focus revalidation ignores an older response that finishes last", async ({
  page,
}) => {
  let initialReads = 0;
  let focusReads = 0;
  let focusPhase = false;
  await page.route(
    "**/api/workspaces/clair-demo/chart/order-billing-summary*",
    async (route) => {
      if (!focusPhase) {
        initialReads += 1;
        await fulfillSummary(
          route,
          createSummary({ etag: '"billing-initial"', estimatedTotal: 100_000 }),
        );
        return;
      }
      focusReads += 1;
      if (focusReads === 1) {
        await new Promise((resolve) => setTimeout(resolve, 350));
      } else if (focusReads === 2) {
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      const estimatedTotal = focusReads === 1 ? 110_000 : 120_000;
      await fulfillSummary(
        route,
        createSummary({
          etag: `\"billing-focus-${focusReads}\"`,
          estimatedTotal,
        }),
      );
    },
  );

  await page.goto(scenarioUrl);
  const footer = page.getByTestId("chart-order-footer");
  await expect(footer).toContainText("100,000원");
  expect(initialReads).toBeGreaterThan(0);
  focusPhase = true;

  await dispatchWindowFocus(page);
  await expect.poll(() => focusReads).toBe(1);
  await dispatchWindowFocus(page);
  await expect.poll(() => focusReads).toBe(2);

  await expect(footer).toContainText("120,000원");
  await page.waitForTimeout(450);
  await expect(footer).toContainText("120,000원");
  await expect(footer).not.toContainText("110,000원");
});

test("a billing conflict followed by a failed refresh blocks both billing actions", async ({
  page,
}) => {
  let billingConflict = false;
  await page.route(
    "**/api/workspaces/clair-demo/chart/order-billing-summary*",
    async (route) => {
      if (route.request().method() === "POST") {
        billingConflict = true;
        await route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({
            ok: false,
            status: 409,
            error: "revision_conflict",
          }),
        });
        return;
      }
      if (!billingConflict) {
        await fulfillSummary(
          route,
          createSummary({ etag: '"billing-v1"', estimatedTotal: 100_000 }),
        );
        return;
      }
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ ok: false, status: 500, error: "db_read_failed" }),
      });
    },
  );

  await page.goto(scenarioUrl);
  const footer = page.getByTestId("chart-order-footer");
  const footerBilling = footer.getByRole("button", { name: "Order 청구" });
  await expect(footerBilling).toBeEnabled();
  await footerBilling.click();

  const aside = page.getByLabel("Plan/Order 금액 상세");
  await expect(aside).toBeVisible();
  await expect(footer).toContainText("최신 금액 확인 필요");
  await expect(footerBilling).toBeDisabled();
  await expect(
    aside.getByRole("button", { name: "Order 청구" }),
  ).toBeDisabled();
  await expect(aside.getByRole("button", { name: "금액 다시 확인" })).toBeVisible();
});

test("a delayed GET cannot overwrite a successful billing POST summary", async ({
  page,
}) => {
  let focusPhase = false;
  let billingRequests = 0;
  await page.route(
    "**/api/workspaces/clair-demo/chart/order-billing-summary*",
    async (route) => {
      if (route.request().method() === "POST") {
        billingRequests += 1;
        await fulfillSummary(
          route,
          createSummary({
            etag: '"billing-post-success"',
            estimatedTotal: 125_000,
            requestable: 0,
          }),
        );
        return;
      }
      if (!focusPhase) {
        await fulfillSummary(
          route,
          createSummary({ etag: '"billing-initial"', estimatedTotal: 100_000 }),
        );
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 350));
      await fulfillSummary(
        route,
        createSummary({ etag: '"billing-old-get"', estimatedTotal: 110_000 }),
      );
    },
  );

  await page.goto(scenarioUrl);
  const footer = page.getByTestId("chart-order-footer");
  await expect(footer).toContainText("100,000원");
  await expect(
    footer.getByRole("button", { name: "Order 청구" }),
  ).toBeEnabled();

  focusPhase = true;
  await page.evaluate(() => {
    window.dispatchEvent(new Event("focus"));
    const billingButton = Array.from(
      document.querySelectorAll<HTMLButtonElement>(
        '[data-testid="chart-order-footer"] button',
      ),
    ).find((button) => button.textContent?.includes("Order 청구"));
    billingButton?.click();
  });

  await expect.poll(() => billingRequests).toBe(1);
  await expect(footer).toContainText("125,000원");
  await page.waitForTimeout(450);
  await expect(footer).toContainText("125,000원");
  await expect(footer).not.toContainText("110,000원");
  await expect(
    footer.getByRole("button", { name: "Order 청구" }),
  ).toBeDisabled();
});

test("a delayed GET cannot overwrite the Summary returned by a draft mutation", async ({
  page,
}) => {
  let delayFocusRead = false;
  let mutationRequests = 0;
  let releaseDelayedRead!: () => void;
  const delayedReadGate = new Promise<void>((resolve) => {
    releaseDelayedRead = resolve;
  });
  await page.route(
    "**/api/workspaces/clair-demo/chart/order-billing-summary*",
    async (route) => {
      if (!delayFocusRead) {
        await fulfillSummary(
          route,
          createSummary({ etag: '"billing-initial"', estimatedTotal: 100_000 }),
        );
        return;
      }
      await delayedReadGate;
      await fulfillSummary(
        route,
        createSummary({ etag: '"billing-old-get"', estimatedTotal: 110_000 }),
      );
    },
  );
  await page.route(
    "**/api/workspaces/clair-demo/chart/order-drafts*",
    async (route) => {
      if (route.request().method() !== "PATCH") {
        await route.fallback();
        return;
      }
      mutationRequests += 1;
      const response = await route.fetch();
      const body = (await response.json()) as Record<string, unknown>;
      await route.fulfill({
        response,
        contentType: "application/json",
        body: JSON.stringify({
          ...body,
          billingSummary: createSummary({
            etag: '"billing-draft-success"',
            estimatedTotal: 120_000,
          }),
        }),
      });
    },
  );

  await page.goto(scenarioUrl);
  const footer = page.getByTestId("chart-order-footer");
  await expect(footer).toContainText("100,000원");

  delayFocusRead = true;
  await dispatchWindowFocus(page);
  await page.getByLabel("Maropitant 16mg T 수량 수정").fill("2");
  await expect.poll(() => mutationRequests, { timeout: 5_000 }).toBe(1);
  await expect(footer).toContainText("120,000원");

  releaseDelayedRead();
  await page.waitForTimeout(100);
  await expect(footer).toContainText("120,000원");
  await expect(footer).not.toContainText("110,000원");
});

test("invalid quantity keeps the last server amount and blocks billing", async ({
  page,
}) => {
  let mutationRequests = 0;
  await page.route(
    "**/api/workspaces/clair-demo/chart/order-billing-summary*",
    (route) =>
      fulfillSummary(
        route,
        createSummary({ etag: '"billing-initial"', estimatedTotal: 100_000 }),
      ),
  );
  await page.route(
    "**/api/workspaces/clair-demo/chart/order-drafts*",
    async (route) => {
      if (route.request().method() === "PATCH") mutationRequests += 1;
      await route.fallback();
    },
  );

  await page.goto(scenarioUrl);
  const footer = page.getByTestId("chart-order-footer");
  await expect(footer).toContainText("100,000원");
  await page.getByRole("textbox", { name: /수량 수정/ }).first().fill("0");

  await expect(footer).toContainText("입력 확인 필요 · 금액 미반영");
  await expect(footer).toContainText("100,000원");
  await expect(
    footer.getByRole("button", { name: "Order 청구" }),
  ).toBeDisabled();
  await page.waitForTimeout(850);
  expect(mutationRequests).toBe(0);
});

test("a failed draft save restores the last server amount and blocks billing", async ({
  page,
}) => {
  let mutationRequests = 0;
  await page.route(
    "**/api/workspaces/clair-demo/chart/order-billing-summary*",
    (route) =>
      fulfillSummary(
        route,
        createSummary({ etag: '"billing-initial"', estimatedTotal: 100_000 }),
      ),
  );
  await page.route(
    "**/api/workspaces/clair-demo/chart/order-drafts*",
    async (route) => {
      if (route.request().method() !== "PATCH") {
        await route.fallback();
        return;
      }
      mutationRequests += 1;
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ ok: false, status: 500, error: "db_write_failed" }),
      });
    },
  );

  await page.goto(scenarioUrl);
  const footer = page.getByTestId("chart-order-footer");
  await page.getByRole("textbox", { name: /수량 수정/ }).first().fill("2");
  await expect(footer).toContainText("오더 예상 총액");
  await expect.poll(() => mutationRequests, { timeout: 5_000 }).toBe(1);
  await expect(footer).toContainText("저장 실패 · 금액 미반영");
  await expect(footer).toContainText("100,000원");
  await expect(
    footer.getByRole("button", { name: "Order 청구" }),
  ).toBeDisabled();
});

test("a persisted draft is reflected when the following confirmation fails", async ({
  page,
}) => {
  let draftPersisted = false;
  let readsAfterDraft = 0;
  let confirmationRequests = 0;
  await page.route(
    "**/api/workspaces/clair-demo/chart/order-billing-summary*",
    async (route) => {
      if (draftPersisted) readsAfterDraft += 1;
      await fulfillSummary(
        route,
        createSummary({
          etag: draftPersisted ? '"billing-draft-saved"' : '"billing-initial"',
          estimatedTotal: draftPersisted ? 104_500 : 100_000,
        }),
      );
    },
  );
  await page.route(
    "**/api/workspaces/clair-demo/chart/order-drafts*",
    async (route) => {
      if (route.request().method() !== "PATCH") {
        await route.fallback();
        return;
      }
      const response = await route.fetch();
      draftPersisted = true;
      const responseBody = (await response.json()) as Record<string, unknown>;
      await route.fulfill({
        response,
        contentType: "application/json",
        body: JSON.stringify({
          ...responseBody,
          billingSummary: createSummary({
            etag: '"billing-draft-saved"',
            estimatedTotal: 104_500,
          }),
        }),
      });
    },
  );
  await page.route(
    "**/api/workspaces/clair-demo/chart/order-actions",
    async (route) => {
      if (route.request().method() !== "PATCH") {
        await route.fallback();
        return;
      }
      confirmationRequests += 1;
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ ok: false, status: 500, error: "db_write_failed" }),
      });
    },
  );

  await page.goto(scenarioUrl);
  const footer = page.getByTestId("chart-order-footer");
  await expect(footer).toContainText("100,000원");
  await page.getByLabel("Maropitant 16mg T 수량 수정").fill("3");
  await page.getByRole("checkbox", { name: "복부 초음파 선택" }).check();
  await page
    .getByRole("toolbar", { name: "선택 행 작업" })
    .getByRole("button", { name: "선택 확정" })
    .click();
  await page
    .getByRole("dialog", { name: "Order 확정 확인" })
    .getByRole("button", { name: "Order 확정" })
    .click();

  await expect.poll(() => confirmationRequests).toBeGreaterThan(0);
  expect(readsAfterDraft).toBe(0);
  await expect(footer).toContainText("104,500원");
});

test("execution revision conflicts invalidate and revalidate billing authority", async () => {
  const moduleSource = await readFile(
    path.join(process.cwd(), "src/features/chart/module.tsx"),
    "utf8",
  );
  const mutationFailure = moduleSource.slice(
    moduleSource.indexOf("const commitOrderMutation = async () =>"),
    moduleSource.indexOf("const payload = result.mutation.order"),
  );
  expect(mutationFailure).toContain(
    'if (result.denialReason === "revision_conflict")',
  );
  expect(mutationFailure).toContain('setBillingSummaryFreshness("stale")');
  expect(mutationFailure).toContain("void refreshBillingSummary()");
});

test("a local estimate never enables a billing POST", async ({ page }) => {
  let billingRequests = 0;
  await page.route(
    "**/api/workspaces/clair-demo/chart/order-billing-summary*",
    async (route) => {
      if (route.request().method() === "POST") billingRequests += 1;
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ ok: false, status: 500, error: "db_read_failed" }),
      });
    },
  );

  await page.goto(scenarioUrl);
  const footer = page.getByTestId("chart-order-footer");
  await expect(footer).toContainText("서버 확인 전 예상 총액");
  await expect(footer).toContainText("최신 금액 확인 필요");
  await expect(
    footer.getByRole("button", { name: "Order 청구" }),
  ).toBeDisabled();
  expect(billingRequests).toBe(0);
});
