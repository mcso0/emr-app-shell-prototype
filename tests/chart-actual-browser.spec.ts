import { expect, test } from "@playwright/test";
import { createMockChartOrderBillingSummaryFromMutationRows } from "../src/features/chart/chart-order-billing-summary-contract";
import type { ChartActualContext } from "../src/features/chart/chart-actual-contract";

test("chart confirmation requires explicit actual input and sends a separate attested DTO", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const id = "97070000-0000-4000-8000-000000000021";
  const name = "합성 실제 진료 확인";
  const etag = `"${"a".repeat(64)}"`;
  let confirmed = false;
  let requests = 0;
  let actualContext: ChartActualContext | null = null;
  const detailInputs = { responsibleClinicianId: "user-vet", occurrenceCount: 1, timing: "now", instructionSummary: "합성 계획 지시" };
  const row = { orderId: id, workspaceId: "clair-demo", encounterId: "encounter-kong-260501", rowType: "individual" as const,
    orderType: "consultation", clinicalOrderType: "consultation", destinationModule: null, executionMode: "immediate_complete",
    detailInputs, detailSchemaVersion: 1, priority: "normal", billingEligible: false, revisionNo: 0, parentOrderId: null,
    sourceSetId: null, sourceSetRevisionId: null, sourceSetRevisionNo: null, sourceSetVersion: null, sourceSetRevisionItemId: null,
    workspaceCatalogItemId: "wp07-browser-consultation", workspaceCatalogRevision: 1, dispensingLineage: null,
    quantity: 1, quantitySource: "manual", unitPriceSnapshot: 0, lineTotalSnapshot: 0, snapshotSchemaVersion: 0, snapshotHash: null,
    appliedSnapshot: { billingName: name, inHospitalOrderName: name, standardOrderName: name, billingReflectionEnabled: false,
      categoryGroup: "consultation", clinicalOrderType: "consultation", destinationModule: null, detailInputs, detailSchemaVersion: 1,
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
      requests++;
      if (requests === 1) { await route.fulfill({ status: 422, json: { ok: false, status: 422, error: "invalid_chart_actual" } }); return; }
      confirmed = true;
      const actual = (posted!.actualRecords as Record<string, { performedAt: string; payload: Record<string, string> }>)[id];
      actualContext = { workspaceId: "clair-demo", taskId: id, orderId: id, attemptNo: 1, clinicalOrderType: "consultation",
        planSnapshot: { detailInputs }, planSha256: "b".repeat(64), canAmend: true, results: [{ id, version: 1,
          previousResultId: null, payload: actual.payload, performedByUserId: id, performedAt: actual.performedAt,
          recordedByUserId: id, recordedAt: "2026-09-06T00:05:00.000Z", amendmentReason: null }] };
      const confirmedRow = { ...row, orderConfirmationStatus: "confirmed", status: "confirmed" };
      await route.fulfill({ json: { ok: true, status: 200, etag, serverAtomic: true, rows: [confirmedRow], orderActions: [], tasks: [], billingCandidates: [],
        billingSummary: createMockChartOrderBillingSummaryFromMutationRows({ encounterId: row.encounterId, etag, rows: [confirmedRow], workspaceId: "clair-demo" }) } });
    } else await route.fulfill({ json: { ok: true, status: 200, etag, rows: confirmed ? [{ ...row, orderConfirmationStatus: "confirmed", status: "confirmed" }] : [], orderActions: [] } });
  });
  await page.route("**/api/workspaces/clair-demo/chart/order-execution?*", async route => {
    await route.fulfill({ json: { ok: true, status: 200, execution: { workspaceId: "clair-demo", encounterId: row.encounterId,
      tasks: confirmed ? [{ taskId: id, orderId: id, parentTaskId: null, taskRole: "execution", clinicalOrderType: "consultation",
        destinationModule: null, status: "complete", priority: "normal", attemptNo: 1, reRequestedFromTaskId: null,
        effectiveSnapshot: { detailInputs }, resultSnapshot: { executionResultId: id }, startedAt: null,
        completedAt: "2026-09-06T00:05:00.000Z", cancelledAt: null, createdAt: "2026-09-06T00:05:00.000Z", updatedAt: "2026-09-06T00:05:00.000Z" }] : [],
      events: [], revisions: [], queues: [], billingCandidates: [] } } });
  });
  await page.route(`**/api/workspaces/clair-demo/chart/tasks/${id}/actual`, async route => {
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON();
      expect(body.amendmentReason).toBe("합성 전사 정정");
      actualContext!.results.push({ ...actualContext!.results[0], id: "97070000-0000-4000-8000-000000000022", version: 2,
        previousResultId: id, payload: body.payload, performedAt: body.performedAt, amendmentReason: body.amendmentReason });
    }
    await route.fulfill({ json: { ok: true, context: actualContext } });
  });
  await page.goto("/w/clair-demo/treatment?scenario=kong-vomit&patientId=patient-kong&encounterId=encounter-kong-260501&modulePanel=open&aside=closed");
  await expect(page.getByRole("checkbox", { name: `${name} 선택` })).toBeVisible();
  await page.getByRole("checkbox", { name: `${name} 선택` }).check();
  await page.getByRole("toolbar", { name: "선택 행 작업" }).getByRole("button", { name: /\d+개 Order 확정/ }).click();
  const dialog = page.getByRole("dialog", { name: "Order 확정 확인" });
  const confirm = dialog.getByRole("button", { name: "Order 확정", exact: true });
  await expect(dialog.getByLabel(`${name} 실제 수행`, { exact: true })).toHaveValue("");
  await expect(dialog.getByLabel(`${name} 실제 결과`, { exact: true })).toHaveValue("");
  await expect(dialog.getByLabel(`${name} 실제 수행 시각`, { exact: true })).toHaveValue("");
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel(`${name} 실제 수행`, { exact: true }).fill("합성 실제 진료 활동");
  await dialog.getByLabel(`${name} 실제 결과`, { exact: true }).fill("합성 직접 입력 결과");
  await dialog.getByLabel(`${name} 실제 수행 시각`, { exact: true }).fill("2026-09-06T09:00");
  await expect(confirm).toBeDisabled();
  await dialog.getByRole("switch").check();
  await expect(confirm).toBeEnabled();
  await expect(page.getByRole("toolbar", { name: "선택 행 작업" })).toBeHidden();
  await page.screenshot({ path: "/tmp/wp07-chart-actual-confirmation.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(confirm).toBeVisible();
  const bounds = await dialog.boundingBox();
  expect(bounds?.y).toBeGreaterThanOrEqual(0);
  expect((bounds?.y ?? 0) + (bounds?.height ?? 0)).toBeLessThanOrEqual(844);
  await page.screenshot({ path: "/tmp/wp07-chart-actual-confirmation-mobile.png" });
  await confirm.click();
  await expect.poll(() => posted).not.toBeNull();
  expect(posted).toMatchObject({ actualRecords: { [id]: { selfPerformed: true, payload: { performedActivity: "합성 실제 진료 활동", outcome: "합성 직접 입력 결과" } } } });
  expect(JSON.stringify(posted)).not.toContain("합성 계획 지시");
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await expect(dialog).toBeHidden();
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.reload();
  await page.getByRole("checkbox", { name: `${name} 선택`, exact: true }).check();
  await page.getByRole("toolbar", { name: "선택 행 작업" }).getByRole("button", { name: "이력", exact: true }).click();
  const history = page.getByRole("dialog", { name: `${name} 이력`, exact: true });
  await expect(history.getByText("실제 기록 v1", { exact: true })).toBeVisible();
  await expect(history.getByText("결과: 합성 직접 입력 결과", { exact: true })).toBeVisible();
  await expect(history.getByText(/수행: .*9:00:00/)).toBeVisible();
  await history.getByRole("button", { name: "실제 기록 정정", exact: true }).click();
  await expect(history.getByRole("button", { name: "정정본 저장", exact: true })).toBeDisabled();
  await history.getByRole("textbox", { name: "정정 결과", exact: true }).fill("합성 정정 결과");
  await history.getByRole("textbox", { name: "정정 사유", exact: true }).fill("합성 전사 정정");
  await history.getByRole("button", { name: "정정본 저장", exact: true }).click();
  await expect(history.getByText("실제 기록 v2", { exact: true })).toBeVisible();
  await expect(history.getByText("결과: 합성 직접 입력 결과", { exact: true })).toBeVisible();
  await expect(history.getByText("결과: 합성 정정 결과", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
