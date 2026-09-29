import { expect, test, type Page } from "@playwright/test";

import { SESSION_WORKSPACES_STORAGE_KEY } from "../src/features/auth/workspace-session";
import { PREPARED_EMPTY_CLINIC_WORKSPACE_ID as workspaceId } from "../src/lib/emr-domain/demo-workspaces";

const modules = [
  { id: "lab", object: "검사" },
  { id: "imaging", object: "영상" },
  { id: "dispensing", object: "조제/처치" },
  { id: "billing", object: "수납" },
] as const;

async function grantAccess(page: Page) {
  await page.addInitScript(([key, id]) => {
    localStorage.setItem(key, JSON.stringify({
      currentWorkspaceId: id,
      workspaces: [{ id, displayName: "합성 병원", subscriptionStatus: "trialing", createdBySessionId: "playwright-default-session" }],
      memberships: [{ id: "loading-test-membership", workspaceId: id, userSessionId: "playwright-default-session", roles: ["hospital_admin"], status: "active" }],
      invitations: [],
    }));
  }, [SESSION_WORKSPACES_STORAGE_KEY, workspaceId]);
}

async function expectCenteredLoading(page: Page, id: string, object: string) {
  const main = page.getByTestId("workspace-main-content");
  const loading = page.getByTestId(`${id}-content-loading-state`);
  await expect(loading).toBeVisible();
  await expect(loading).toHaveAttribute("role", "status");
  await expect(loading).toHaveAttribute("data-size", "md");
  await expect(loading).toContainText(`${object} 업무를 불러오는 중입니다`);
  await expect(main.getByRole("heading", { name: `${object} 업무가 없습니다` })).toHaveCount(0);
  await expect(main.getByTestId("dispensing-fulfillment-state")).toHaveCount(0);
  const geometry = await loading.evaluate((state) => {
    const viewport = state.parentElement!;
    const a = state.getBoundingClientRect();
    const b = viewport.getBoundingClientRect();
    return { x: Math.abs(a.x + a.width / 2 - b.x - b.width / 2), y: Math.abs(a.y + a.height / 2 - b.y - b.height / 2) };
  });
  expect(geometry.x).toBeLessThanOrEqual(1);
  expect(geometry.y).toBeLessThanOrEqual(1);
}

for (const { id, object } of modules) {
  test(`${id} date transition centers loading, then shows true empty, including a cached date`, async ({ page }) => {
    await grantAccess(page);
    let release: (() => void) | undefined;
    let pending = false;
    const requestedDates: string[] = [];
    await page.route(`**/api/workspaces/${workspaceId}/${id === "billing" ? "billing/queue" : "fulfillment/work-items"}?*`, async (route) => {
      const date = new URL(route.request().url()).searchParams.get("date")!;
      requestedDates.push(date);
      if (pending && date === "2026-09-08") {
        await new Promise<void>((resolve) => {
          const previous = release;
          release = () => { previous?.(); resolve(); };
        });
      }
      await route.fulfill({ json: { ok: true, workItems: [], rows: [] } });
    });
    await page.goto(`/w/${workspaceId}/${id}?date=2026-09-07&modulePanel=open&aside=closed&right=closed`);
    const main = page.getByTestId("workspace-main-content");
    const empty = main.getByRole("heading", { name: `${object} 업무가 없습니다` });
    await expect(empty).toBeVisible();
    const panel = page.locator("aside").first();
    for (let attempt = 0; attempt < 2; attempt += 1) {
      pending = true;
      release = undefined;
      if (attempt === 0) {
        await panel.getByRole("button", { name: /날짜 선택/ }).click();
        await page.getByRole("button", { name: /26\.09\.08/ }).click();
      } else {
        await panel.getByRole("button", { name: "다음 날짜" }).click();
      }
      await expect.poll(() => Boolean(release)).toBe(true);
      await expect(page).toHaveURL(/date=2026-09-08/);
      await expectCenteredLoading(page, id, object);
      pending = false;
      (release as (() => void) | undefined)?.();
      await expect(empty).toBeVisible();
      await expect(page.getByTestId(`${id}-content-loading-state`)).toHaveCount(0);
      if (attempt === 0) {
        await panel.getByRole("button", { name: "이전 날짜" }).click();
        await expect(page).toHaveURL(/date=2026-09-07/);
        await expect(empty).toBeVisible();
      }
    }
    expect(requestedDates).toContain("2026-09-07");
    expect(requestedDates).toContain("2026-09-08");
  });
}

for (const { id, object } of modules) {
  test(`${id} initial read is loading until the response resolves`, async ({ page }) => {
    await grantAccess(page);
    const releases: Array<() => void> = [];
    await page.route(`**/api/workspaces/${workspaceId}/${id === "billing" ? "billing/queue" : "fulfillment/work-items"}?*`, async (route) => {
      await new Promise<void>((resolve) => releases.push(resolve));
      await route.fulfill({ json: { ok: true, workItems: [], rows: [] } });
    });
    await page.goto(`/w/${workspaceId}/${id}?date=2026-09-07&modulePanel=open&aside=closed&right=closed`);
    await expect.poll(() => releases.length).toBeGreaterThan(0);
    await expectCenteredLoading(page, id, object);
    await page.screenshot({ path: `/tmp/emr-${id}-queue-loading.png` });
    releases.forEach((release) => release());
    await expect(page.getByTestId("workspace-main-content").getByRole("heading", { name: `${object} 업무가 없습니다` })).toBeVisible();
  });

  for (const status of [403, 500]) {
    test(`${id} queue ${status} is distinct from empty and recovers through retry`, async ({ page }) => {
      await grantAccess(page);
      let denied = true;
      await page.route(`**/api/workspaces/${workspaceId}/${id === "billing" ? "billing/queue" : "fulfillment/work-items"}?*`, async (route) => {
        await route.fulfill({ status: denied ? status : 200, json: denied ? { ok: false, denialReason: status === 403 ? "permission_missing" : undefined } : { ok: true, workItems: [], rows: [] } });
      });
      await page.goto(`/w/${workspaceId}/${id}?date=2026-09-07&modulePanel=open&aside=closed&right=closed`);
      const main = page.getByTestId("workspace-main-content");
      await expect(main.getByRole("heading", { name: `${object} 업무가 없습니다` })).toHaveCount(0);
      await expect(main.getByText(/권한|불러오지 못했습니다/).first()).toBeVisible();
      if (status === 500) {
        denied = false;
        await main.getByRole("button", { name: /재시도/ }).click();
        await expect(main.getByRole("heading", { name: `${object} 업무가 없습니다` })).toBeVisible();
      }
    });
  }
}

function populatedQueue(id: string, date: string, patientName: string) {
  if (id === "billing") return { ok: true, rows: [{
    invoice: { id: `invoice-${date}`, workspaceId, encounterId: `encounter-${date}`, invoiceNo: `Q-${date}`, status: "draft", paymentState: "none", totalAmount: 10000, createdAt: `${date}T01:00:00Z` },
    encounter: { receptionType: "walk_in" }, patient: { name: patientName }, guardian: { name: "합성 보호자" }, lineCount: 1, lineSummary: "합성 청구", requestedByName: "합성 직원",
  }] };
  return { ok: true, workItems: [{ id: `item-${date}`, workspaceId, encounterId: `encounter-${date}`, orderId: `order-${date}`, queueType: id, status: "requested", rowRevision: 1, requestCycle: 1,
    patientName, guardianName: "합성 보호자", createdAt: `${date}T01:00:00Z`, sourceSnapshot: { effectiveDisplayName: "합성 업무", orderDisplayName: "합성 업무" },
  }] };
}

for (const { id, object } of modules) {
  for (const returning of [false, true]) {
    test(`${id} ignores late responses during ${returning ? "A-B-A" : "A-B-C"} date changes`, async ({ page }) => {
      await grantAccess(page);
      let hold = true;
      const releases: Array<() => void> = [];
      const heldDate = returning ? "2026-09-07" : "2026-09-08";
      const finalDate = returning ? "2026-09-07" : "2026-09-09";
      await page.route(`**/api/workspaces/${workspaceId}/${id === "billing" ? "billing/queue" : "fulfillment/work-items"}?*`, async (route) => {
        const params = new URL(route.request().url()).searchParams;
        const date = params.get("date")!;
        const late = hold && date === heldDate;
        if (late) await new Promise<void>(resolve => releases.push(resolve));
        const payload = late ? populatedQueue(id, date, "늦은 응답 환자") : date === finalDate ? populatedQueue(id, date, "현재 날짜 환자") : { ok: true, workItems: [], rows: [] };
        if (id === "dispensing" && params.get("queueType") === "treatment") await route.fulfill({ json: { ok: true, workItems: [] } });
        else await route.fulfill({ json: payload });
      });
      await page.goto(`/w/${workspaceId}/${id}?date=2026-09-07&modulePanel=open&aside=closed&right=closed`);
      const panel = page.locator("aside").first();
      if (returning) {
        await expectCenteredLoading(page, id, object);
        await expect.poll(() => releases.length).toBeGreaterThan(0);
      } else {
        await expect(page.getByTestId("workspace-main-content").getByRole("heading", { name: `${object} 업무가 없습니다` })).toBeVisible();
      }
      await panel.getByRole("button", { name: "다음 날짜" }).click();
      await expect(page).toHaveURL(/date=2026-09-08/);
      if (!returning) {
        await expect.poll(() => releases.length).toBeGreaterThan(0);
        await expectCenteredLoading(page, id, object);
      }
      hold = false;
      await panel.getByRole("button", { name: returning ? "이전 날짜" : "다음 날짜" }).click();
      await expect(page).toHaveURL(new RegExp(`date=${finalDate}`));
      await expect(panel.getByText("현재 날짜 환자", { exact: true })).toBeVisible();
      releases.forEach(release => release());
      await page.waitForLoadState("networkidle");
      await expect(panel.getByText("현재 날짜 환자", { exact: true })).toBeVisible();
      await expect(page.getByText("늦은 응답 환자", { exact: true })).toHaveCount(0);
      await expect(page.getByTestId(`${id}-content-loading-state`)).toHaveCount(0);
    });
  }
}

for (const { id, object } of modules) {
  test(`${id} content read completes when its queue panel is collapsed during loading`, async ({ page }) => {
    await grantAccess(page);
    const releases: Array<() => void> = [];
    await page.route(`**/api/workspaces/${workspaceId}/${id === "billing" ? "billing/queue" : "fulfillment/work-items"}?*`, async (route) => {
      await new Promise<void>(resolve => releases.push(resolve));
      await route.fulfill({ json: { ok: true, workItems: [], rows: [] } });
    });
    await page.goto(`/w/${workspaceId}/${id}?date=2026-09-07&modulePanel=closed&aside=closed&right=closed`);
    await expect.poll(() => releases.length).toBeGreaterThan(0);
    const initialCount = releases.length;
    await page.getByRole("button", { name: "사이드 패널 펼치기" }).click();
    await expect.poll(() => releases.length).toBeGreaterThan(initialCount);
    await expectCenteredLoading(page, id, object);
    await page.locator("aside").first().getByRole("button", { name: "사이드 패널 접기" }).click();
    releases.forEach(release => release());
    await expect(page.getByTestId("workspace-main-content").getByRole("heading", { name: `${object} 업무가 없습니다` })).toBeVisible();
  });
}


test("billing selects a live queue invoice with its encounter and preserves centered detail loading", async ({ page }) => {
  await grantAccess(page);
  const invoiceId = "99290000-0000-4000-8000-000000000051";
  const encounterId = "99290000-0000-4000-8000-000000000052";
  const invoice = { id: invoiceId, workspaceId, encounterId, invoiceNo: "Q-LIVE", status: "draft", paymentState: "none", subtotalAmount: 10000, discountAmount: 0, taxAmount: 0, totalAmount: 10000, createdAt: "2026-09-07T01:00:00Z" };
  const queue = populatedQueue("billing", "2026-09-07", "대기열 합성 환자");
  queue.rows![0].invoice = invoice;
  await page.route("**/billing/queue?*", route => route.fulfill({ json: queue }));
  const releases: Array<{ kind: string; resolve: () => void }> = [];
  let holdInvoices = true;
  let holdSummary = true;
  const hold = (kind: string) => (kind === "summary" ? holdSummary : holdInvoices)
    ? new Promise<void>(resolve => releases.push({ kind, resolve }))
    : Promise.resolve();
  await page.route("**/billing/invoice-candidates?*", route => route.fulfill({ json: { ok: true, candidates: [] } }));
  await page.route("**/chart/order-billing-summary?*", async route => {
    await hold("summary");
    await route.fulfill({ json: { ok: true, summary: {
      workspaceId, encounterId, invoiceId, etag: '"queue-detail"', generatedAt: invoice.createdAt, currency: "KRW",
      context: {
        encounter: { id: encounterId, patientId: "patient-queue", guardianId: "guardian-queue", encounterNo: "E-QUEUE", status: "ordered", createdAt: invoice.createdAt, updatedAt: invoice.createdAt },
        patient: { id: "patient-queue", patientNo: "P-QUEUE", name: "대기열 합성 환자", species: "dog", sex: "male", status: "active", createdAt: invoice.createdAt, updatedAt: invoice.createdAt },
        guardian: { id: "guardian-queue", name: "합성 보호자", createdAt: invoice.createdAt, updatedAt: invoice.createdAt },
      },
      orderCounts: { total: 1, confirmed: 1, draft: 0, recheck: 0, requested: 1, requestable: 0, cancelled: 0 },
      amounts: { gross: 10000, confirmed: 10000, draft: 0, discount: 0, surcharge: 0, tax: 0, paid: 0, outstanding: 10000, estimatedTotal: 10000, requestableTotal: 0 },
      requestableOrderIds: [], unfinishedOrders: [],
    } } });
  });
  await page.route("**/billing/invoice-lines?*", async route => {
    await hold("invoice");
    await route.fulfill({ json: { ok: true, invoice, lines: [{ id: "line-queue", invoiceId, description: "대기열 합성 청구", quantity: 1, unitPrice: 10000, lineTotal: 10000 }] } });
  });
  await page.route("**/billing/payment-status?*", async route => {
    await hold("payment");
    await route.fulfill({ json: { ok: true, invoice, payments: [] } });
  });
  const writes: string[] = [];
  page.on("request", request => { if (request.url().includes("/billing/queue") && request.method() !== "GET") writes.push(request.method()); });
  await page.goto(`/w/${workspaceId}/billing?date=2026-09-07&modulePanel=open&aside=closed&right=closed`);
  await page.locator("aside").first().getByText("대기열 합성 환자", { exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`encounterId=${encounterId}`));
  await expect(page).toHaveURL(new RegExp(`invoiceId=${invoiceId}`));
  await expectCenteredLoading(page, "billing", "수납");
  await expect.poll(() => releases.length).toBeGreaterThanOrEqual(3);
  // Invoice reads finish first; the center must remain pending until encounter context arrives.
  holdInvoices = false;
  releases.filter(release => release.kind !== "summary").forEach(release => release.resolve());
  await expectCenteredLoading(page, "billing", "수납");
  holdSummary = false;
  releases.forEach(release => release.resolve());
  await expect(page.getByRole("table", { name: "청구 항목 테이블" }).getByText("대기열 합성 청구", { exact: true })).toBeVisible();
  expect(writes).toEqual([]);
});

test("billing changes queue selection without inherited order filters or previous patient context", async ({ page }) => {
  await grantAccess(page);
  const invoiceId = "99290000-0000-4000-8000-000000000051";
  const encounterId = "99290000-0000-4000-8000-000000000052";
  const invoice = { id: invoiceId, workspaceId, encounterId, invoiceNo: "Q-LIVE", status: "draft", paymentState: "none", subtotalAmount: 10000, discountAmount: 0, taxAmount: 0, totalAmount: 10000, createdAt: "2026-09-07T01:00:00Z" };
  const queue = populatedQueue("billing", "2026-09-07", "대기열 합성 환자");
  queue.rows![0].invoice = invoice;
  const nextInvoiceId = "99290000-0000-4000-8000-000000000061";
  const nextEncounterId = "99290000-0000-4000-8000-000000000062";
  const nextInvoice = { ...invoice, id: nextInvoiceId, encounterId: nextEncounterId, invoiceNo: "Q-NEXT" };
  queue.rows!.push({ ...queue.rows![0], invoice: nextInvoice, patient: { name: "다음 합성 환자" } });
  await page.route("**/billing/queue?*", route => route.fulfill({ json: queue }));
  const releases: Array<{ kind: string; resolve: () => void }> = [];
  let holdSummary = true;
  const hold = (kind: string) => new Promise<void>(resolve => releases.push({ kind, resolve }));
  await page.route("**/billing/invoice-candidates?*", route => route.fulfill({ json: { ok: true, candidates: [] } }));
  await page.route("**/chart/order-billing-summary?*", async route => {
    const isNext = new URL(route.request().url()).searchParams.get("encounterId") === nextEncounterId;
    const currentInvoice = isNext ? nextInvoice : invoice;
    if (isNext && holdSummary) await hold("summary");
    await route.fulfill({ json: { ok: true, summary: {
      workspaceId, encounterId: currentInvoice.encounterId, invoiceId: currentInvoice.id, etag: '"queue-detail"', generatedAt: invoice.createdAt, currency: "KRW",
      context: {
        encounter: { id: currentInvoice.encounterId, patientId: "patient-queue", guardianId: "guardian-queue", encounterNo: "E-QUEUE", status: "ordered", createdAt: invoice.createdAt, updatedAt: invoice.createdAt },
        patient: { id: "patient-queue", patientNo: "P-QUEUE", name: isNext ? "다음 합성 환자" : "대기열 합성 환자", species: "dog", sex: "male", status: "active", createdAt: invoice.createdAt, updatedAt: invoice.createdAt },
        guardian: { id: "guardian-queue", name: "합성 보호자", createdAt: invoice.createdAt, updatedAt: invoice.createdAt },
      },
      orderCounts: { total: 1, confirmed: 1, draft: 0, recheck: 0, requested: 1, requestable: 0, cancelled: 0 },
      amounts: { gross: 10000, confirmed: 10000, draft: 0, discount: 0, surcharge: 0, tax: 0, paid: 0, outstanding: 10000, estimatedTotal: 10000, requestableTotal: 0 },
      requestableOrderIds: [], unfinishedOrders: [],
    } } });
  });
  await page.route("**/billing/invoice-lines?*", async route => {
    const currentInvoice = new URL(route.request().url()).searchParams.get("invoiceId") === nextInvoiceId ? nextInvoice : invoice;
    await route.fulfill({ json: { ok: true, invoice: currentInvoice, lines: [{ id: "line-queue", invoiceId: currentInvoice.id, orderId: currentInvoice.id === invoiceId ? "order-old" : "order-next", description: "대기열 합성 청구", quantity: 1, unitPrice: 10000, lineTotal: 10000 }] } });
  });
  await page.route("**/billing/payment-status?*", async route => {
    const currentInvoice = new URL(route.request().url()).searchParams.get("invoiceId") === nextInvoiceId ? nextInvoice : invoice;
    await route.fulfill({ json: { ok: true, invoice: currentInvoice, payments: [] } });
  });
  const writes: string[] = [];
  page.on("request", request => { if (request.url().includes("/billing/queue") && request.method() !== "GET") writes.push(request.method()); });
  await page.goto(`/w/${workspaceId}/billing?date=2026-09-07&modulePanel=open&aside=closed&right=closed&invoiceId=${invoiceId}&encounterId=${encounterId}&orderIds=order-old&patientId=patient-old`);
  const main = page.getByTestId("workspace-main-content");
  await expect(main.getByText("합성 보호자 · 대기열 합성 환자", { exact: true })).toBeVisible();
  const nextPayment = page.waitForResponse(response => response.url().includes(`payment-status?invoiceId=${nextInvoiceId}`));
  await page.locator("aside").first().getByText("다음 합성 환자", { exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`invoiceId=${nextInvoiceId}`));
  await expect.poll(() => releases.length).toBeGreaterThan(0);
  await nextPayment;
  await expectCenteredLoading(page, "billing", "수납");
  await expect(main.getByText("합성 보호자 · 대기열 합성 환자", { exact: true })).toHaveCount(0);
  expect(new URL(page.url()).searchParams.has("orderIds")).toBe(false);
  expect(new URL(page.url()).searchParams.has("patientId")).toBe(false);
  holdSummary = false;
  releases.forEach(release => release.resolve());
  await expect(main.getByText("합성 보호자 · 다음 합성 환자", { exact: true })).toBeVisible();
  await expect(page.getByRole("table", { name: "청구 항목 테이블" }).getByText("대기열 합성 청구", { exact: true })).toBeVisible();
  expect(writes).toEqual([]);
});
