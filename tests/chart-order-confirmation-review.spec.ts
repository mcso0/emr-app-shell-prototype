import { expect, test } from "@playwright/test";

test("persisted set review shows one root, only included children, and their scoped charge", async ({ page }) => {
  const originChartId = "soap-kong-260501";
  const rootId = "97070000-0000-4000-8000-000000000030";
  const includedId = "97070000-0000-4000-8000-000000000031";
  const excludedId = "97070000-0000-4000-8000-000000000032";
  const etag = `"${"a".repeat(64)}"`;
  const base = {
    workspaceId: "clair-demo", encounterId: "encounter-kong-260501", originChartId,
    destinationModule: "lab", executionMode: "routed", detailSchemaVersion: 1,
    priority: "normal", billingEligible: true, revisionNo: 1, quantity: 1,
    quantitySource: "manual", snapshotSchemaVersion: 0, snapshotHash: null,
    calculationInputs: {}, calculationOutputs: {}, appliedPriceSnapshot: {},
    orderConfirmationStatus: "draft", status: "requested", updatedAt: "2026-09-22T00:00:00.000Z",
    sourceSetId: null, sourceSetRevisionId: null, sourceSetRevisionNo: null,
    sourceSetVersion: null, sourceSetRevisionItemId: null, dispensingLineage: null,
  };
  const labDetail = { specimenType: "blood", testPanel: "CBC", collectionCondition: "EDTA 전혈" };
  const root = {
    ...base, orderId: rootId, rowType: "set", orderType: "set", clinicalOrderType: "clinical_lab",
    destinationModule: null, billingReflectionEnabled: false, detailInputs: {},
    parentOrderId: null, workspaceCatalogItemId: "set-review-fixture", workspaceCatalogRevision: 1,
    sourceSetId: "set-review-fixture", sourceSetRevisionId: "set-review-revision", sourceSetRevisionNo: 1,
    unitPriceSnapshot: 0, lineTotalSnapshot: 0,
    appliedSnapshot: { displayName: "기본 혈액검사 세트", billingName: "기본 혈액검사 세트",
      amountBasis: "included_order_sum", billingReflectionEnabled: false, items: [],
      clinicalOrderType: "clinical_lab", rowType: "set" },
  };
  const makeChild = (orderId: string, name: string, selected: boolean, priceKrw: number) => ({
    ...base, orderId, rowType: "set_child", orderType: "clinical_lab", clinicalOrderType: "clinical_lab",
    parentOrderId: rootId, workspaceCatalogItemId: `fixture-${orderId}`, workspaceCatalogRevision: 1,
    sourceSetId: "set-review-fixture", sourceSetRevisionId: "set-review-revision", sourceSetRevisionNo: 1,
    sourceSetRevisionItemId: `item-${orderId}`, detailInputs: labDetail,
    billingReflectionEnabled: selected, unitPriceSnapshot: priceKrw, lineTotalSnapshot: priceKrw,
    appliedSnapshot: { displayName: name, billingName: name, clinicalOrderType: "clinical_lab",
      rowType: "set_child", selected, billingReflectionEnabled: selected, priceKrw },
  });
  const rows = [root, makeChild(includedId, "혈구검사 CBC", true, 20000),
    makeChild(excludedId, "제외한 혈당 검사", false, 5000)];
  const actions: string[] = [];
  page.on("request", request => {
    if (request.method() === "PATCH" && request.url().includes("/chart/order-actions")) actions.push(request.url());
  });
  await page.route("**/api/workspaces/clair-demo/chart/order-drafts*", route =>
    route.fulfill({ json: { ok: true, status: 200, etag, rows } }));
  await page.route("**/api/workspaces/clair-demo/chart/order-actions*", route =>
    route.fulfill({ json: { ok: true, status: 200, etag, rows: [], orderActions: [] } }));
  await page.goto("/w/clair-demo/treatment?scenario=kong-vomit&patientId=patient-kong&encounterId=encounter-kong-260501&modulePanel=open&aside=closed");

  const checkbox = page.getByRole("checkbox", { name: "기본 혈액검사 세트 선택" });
  await expect(checkbox).toBeEnabled();
  await checkbox.check();
  const trigger = page.getByRole("toolbar", { name: "선택 행 작업" })
    .getByRole("button", { name: "1개 Order 확정" });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "오더 1건을 확정할까요?" });
  const rootReview = dialog.locator("ul").first().locator(":scope > li");
  await expect(rootReview).toHaveCount(1);
  await expect(rootReview).toContainText("기본 혈액검사 세트");
  await expect(rootReview.getByText("Order 세트", { exact: true })).toBeVisible();
  await expect(rootReview).toContainText("20,000원");
  await expect(dialog.getByText("선택 오더 합계").locator("..").locator("strong")).toHaveText("20,000원");
  await rootReview.getByText("구성 1항목 보기").click();
  await expect(rootReview).toContainText("혈구검사 CBC");
  await expect(dialog).not.toContainText("제외한 혈당 검사");
  await expect(dialog.getByRole("button", { name: "1건 확정" })).toBeEnabled();
  await expect(dialog).toHaveCSS("opacity", "1");
  await page.screenshot({ path: "/tmp/order-confirmation-set.png", animations: "disabled" });
  await dialog.getByRole("button", { name: "취소" }).click();
  await expect(checkbox).toBeChecked();
  await trigger.click();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(checkbox).toBeFocused();
  expect(actions).toHaveLength(0);
});
