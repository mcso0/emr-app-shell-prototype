import { expect, test } from "@playwright/test";
import { createMockChartOrderBillingSummaryFromMutationRows } from "../src/features/chart/chart-order-billing-summary-contract";
import type { ChartActualContext } from "../src/features/chart/chart-actual-contract";

test("V2 chart plan confirms first, then records explicit actual after refresh", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const id = "97070000-0000-4000-8000-000000000021";
  const name = "합성 실제 진료 확인";
  const etag = `"${"a".repeat(64)}"`;
  let confirmed = false;
  let requests = 0;
  let actualContext: ChartActualContext = { workspaceId: "clair-demo", taskId: id, orderId: id, attemptNo: 1,
    clinicalOrderType: "consultation", planSnapshot: { detailSchemaVersion: 2 }, planSha256: "b".repeat(64), canAmend: false, canRecord: true, results: [] };
  const detailInputs = { responsibleClinicianId: "user-vet", occurrenceCount: 1, timing: "now", instructionSummary: "합성 계획 지시" };
  const row = { orderId: id, workspaceId: "clair-demo", encounterId: "encounter-kong-260501", rowType: "individual" as const,
    orderType: "consultation", clinicalOrderType: "consultation", destinationModule: null, executionMode: "immediate_complete",
    detailInputs, detailSchemaVersion: 2, priority: "normal", billingEligible: false, revisionNo: 0, parentOrderId: null,
    sourceSetId: null, sourceSetRevisionId: null, sourceSetRevisionNo: null, sourceSetVersion: null, sourceSetRevisionItemId: null,
    workspaceCatalogItemId: "wp07-browser-consultation", workspaceCatalogRevision: 1, dispensingLineage: null,
    quantity: 1, quantitySource: "manual", unitPriceSnapshot: 0, lineTotalSnapshot: 0, snapshotSchemaVersion: 0, snapshotHash: null,
    appliedSnapshot: { billingName: name, inHospitalOrderName: name, standardOrderName: name, billingReflectionEnabled: false,
      categoryGroup: "consultation", clinicalOrderType: "consultation", destinationModule: null, detailInputs, detailSchemaVersion: 2,
      executionMode: "immediate_complete", lineTotalSnapshot: 0, orderType: "consultation", priceKrw: 0, quantity: 1,
      rowType: "individual", workspaceCatalogItemId: "wp07-browser-consultation", workspaceCatalogRevision: 1 },
    appliedPriceSnapshot: {}, calculationInputs: {}, calculationOutputs: {}, billingReflectionEnabled: false,
    orderConfirmationStatus: "draft", status: "requested", updatedAt: "2026-09-06T00:00:00.000Z" };
  await page.route("**/api/workspaces/clair-demo/chart/order-drafts*", async route => {
    await route.fulfill({ json: { ok: true, status: 200, etag, rows: [{ ...row, orderConfirmationStatus: confirmed ? "confirmed" : "draft", status: confirmed ? "confirmed" : "requested" }] } });
  });
  let posted: Record<string, unknown> | null = null;
  await page.route("**/api/workspaces/clair-demo/chart/order-actions*", async route => {
    if (route.request().method() === "PATCH") {
      posted = route.request().postDataJSON();
      confirmed = true;
      const confirmedRow = { ...row, orderConfirmationStatus: "confirmed", status: "confirmed" };
      await route.fulfill({ json: { ok: true, status: 200, etag, serverAtomic: true, rows: [confirmedRow], orderActions: [], tasks: [], billingCandidates: [],
        billingSummary: createMockChartOrderBillingSummaryFromMutationRows({ encounterId: row.encounterId, etag, rows: [confirmedRow], workspaceId: "clair-demo" }) } });
    } else await route.fulfill({ json: { ok: true, status: 200, etag, rows: confirmed ? [{ ...row, orderConfirmationStatus: "confirmed", status: "confirmed" }] : [], orderActions: [] } });
  });
  await page.route("**/api/workspaces/clair-demo/chart/order-execution?*", async route => {
    await route.fulfill({ json: { ok: true, status: 200, execution: { workspaceId: "clair-demo", encounterId: row.encounterId,
      tasks: confirmed ? [{ taskId: id, orderId: id, parentTaskId: null, taskRole: "execution", clinicalOrderType: "consultation",
        destinationModule: null, status: actualContext.results.length ? "complete" : "pending", priority: "normal", attemptNo: 1, reRequestedFromTaskId: null,
        effectiveSnapshot: { detailInputs, detailSchemaVersion: 2 }, resultSnapshot: {}, startedAt: null,
        completedAt: actualContext.results.length ? "2026-09-08T00:05:00.000Z" : null, cancelledAt: null, createdAt: "2026-09-08T00:00:00.000Z", updatedAt: "2026-09-08T00:05:00.000Z" }] : [],
      events: [], revisions: [], queues: [], billingCandidates: [] } } });
  });
  await page.route(`**/api/workspaces/clair-demo/chart/tasks/${id}/actual`, async route => {
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON();
      requests++;
      expect(body.action).toBe("record");
      expect(body.selfPerformed).toBe(true);
      expect(body.payload).toEqual({ performedActivity: "합성 실제 수행", outcome: "합성 직접 입력 결과" });
      actualContext = { ...actualContext, canRecord: false, canAmend: true, results: [{ id, version: 1, previousResultId: null,
        payload: body.payload, performedAt: body.performedAt, performedByUserId: id, recordedByUserId: id,
        recordedAt: "2026-09-08T00:05:00.000Z", amendmentReason: null }] };
    }
    await route.fulfill({ json: { ok: true, context: actualContext } });
  });
  await page.goto("/w/clair-demo/treatment?scenario=kong-vomit&patientId=patient-kong&encounterId=encounter-kong-260501&modulePanel=open&aside=closed");
  await expect(page.getByRole("checkbox", { name: `${name} 선택` })).toBeVisible();
  await page.getByRole("checkbox", { name: `${name} 선택` }).check();
  await page.getByRole("toolbar", { name: "선택 행 작업" }).getByRole("button", { name: "선택 확정" }).click();
  const dialog = page.getByRole("dialog", { name: "Order 확정 확인" });
  await expect(dialog.getByLabel(`${name} 실제 수행`, { exact: true })).toHaveCount(0);
  await dialog.getByRole("button", { name: "Order 확정", exact: true }).click();
  await expect(dialog).toBeHidden();
  expect(Object.keys(((posted as Record<string, unknown> | null)?.actualRecords ?? {}) as object)).toEqual([]);
  expect(requests).toBe(0);
  await page.reload();
  await page.getByRole("checkbox", { name: `${name} 선택`, exact: true }).check();
  await page.getByRole("toolbar", { name: "선택 행 작업" }).getByRole("button", { name: "이력", exact: true }).click();
  const history = page.getByRole("dialog", { name: `${name} 이력`, exact: true });
  await expect(history.getByText("계획이 확정되었습니다. 실제 수행 후 결과를 기록해 주세요.")).toBeVisible();
  await history.getByRole("button", { name: "수행 결과 기록", exact: true }).click();
  await expect(history.getByRole("textbox", { name: "수행 내용", exact: true })).toHaveValue("");
  await expect(history.getByRole("textbox", { name: "결과", exact: true })).toHaveValue("");
  const complete = history.getByRole("button", { name: "수행 완료", exact: true });
  await expect(complete).toBeDisabled();
  await history.getByRole("textbox", { name: "수행 내용", exact: true }).fill("합성 실제 수행");
  await history.getByRole("textbox", { name: "결과", exact: true }).fill("합성 직접 입력 결과");
  await history.getByLabel("실제 수행 시각", { exact: true }).fill("2026-09-08T09:00");
  await expect(complete).toBeDisabled();
  await history.getByRole("switch").check();
  await expect(complete).toBeEnabled();
  await page.screenshot({ path: "/tmp/wp10-chart-plan-actual-desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await complete.scrollIntoViewIfNeeded();
  await expect(complete).toBeVisible();
  await page.screenshot({ path: "/tmp/wp10-chart-plan-actual-mobile.png" });
  await complete.click();
  await expect(history.getByText("실제 기록 v1", { exact: true })).toBeVisible();
  await expect(history.getByText("결과: 합성 직접 입력 결과", { exact: true })).toBeVisible();
  expect(requests).toBe(1);
  expect(errors).toEqual([]);
});
