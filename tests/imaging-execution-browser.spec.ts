import { expect, test, type Page } from "@playwright/test";
import { SESSION_WORKSPACES_STORAGE_KEY } from "../src/features/auth/workspace-session";
import { PREPARED_EMPTY_CLINIC_WORKSPACE_ID } from "../src/lib/emr-domain/demo-workspaces";
import type { ExecutionContext, ExecutionResultVersion } from "../src/features/fulfillment/execution-result-contract";

async function grantWorkspace(page: Page) {
  await page.addInitScript(([key, workspaceId]) => {
    const timestamp = "2026-06-14T00:00:00.000Z";
    window.localStorage.setItem(key, JSON.stringify({ currentWorkspaceId: workspaceId,
      workspaces: [{ id: workspaceId, displayName: "합성 영상 검증 병원", representativeName: "합성 관리자",
        contactEmail: "owner@imaging.test", contactPhone: null, subscriptionStatus: "trialing",
        createdBySessionId: "playwright-default-session", createdAt: timestamp }],
      memberships: [{ id: "membership-imaging-test", workspaceId, userSessionId: "playwright-default-session",
        displayName: "Synthetic Admin", email: "admin@imaging.test", roles: ["hospital_admin"], status: "active",
        createdAt: timestamp, activatedAt: timestamp }], invitations: [], updatedAt: timestamp }));
  }, [SESSION_WORKSPACES_STORAGE_KEY, PREPARED_EMPTY_CLINIC_WORKSPACE_ID]);
}

test("imaging CT review starts with blank actuals and explicitly records existing review, then reloads immutable amended history", async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on("pageerror", error => runtimeErrors.push(error.message));
  await grantWorkspace(page);
  const workspaceId = PREPARED_EMPTY_CLINIC_WORKSPACE_ID;
  const id = "97060000-0000-4000-8000-000000000001";
  let context: ExecutionContext = { workspaceId, workItemId: id, taskId: id, orderId: id, encounterId: id,
    attemptNo: 1, workItemRevision: 2, clinicalOrderType: "imaging", status: "in_progress", isCurrentAttempt: true,
    planSnapshot: { detailSchemaVersion: 1, detailInputs: { bodyRegion: "흉부 (제공된 합성 CT 판독 범위)", views: 1,
      contrastRequired: false, sedationRequired: false, imagingProtocol: "제공된 합성 CT 영상자료만 검토 · 신규 촬영 아님" } },
    planSha256: "c".repeat(64), resultRequired: true, canRecord: true, results: [] };
  const planned = structuredClone(context.planSnapshot);
  const bodies: Array<Record<string, unknown>> = [];
  await page.route(`**/api/workspaces/${workspaceId}/fulfillment/work-items?*`, async route => {
    const queueType = new URL(route.request().url()).searchParams.get("queueType");
    await route.fulfill({ json: { ok: true, workItems: queueType === "imaging" ? [{ workspaceId, id, orderId: id, encounterId: id,
      taskId: id, taskAttemptNo: 1, requestCycle: 1, rowRevision: context.workItemRevision, status: context.status,
      queueType: "imaging", assignedToUserId: id, requestedByUserId: id,
      createdAt: "2026-09-06T00:00:00.000Z", updatedAt: "2026-09-06T00:00:00.000Z",
      sourceSnapshot: { patientName: "합성 CT 환자", guardianName: "합성 보호자", orderDisplayName: "합성 기존 CT 판독",
        instruction: "제공된 합성 CT 검토 · 신규 촬영 아님", requestingVetName: "합성 수의사" } }] : [] } });
  });
  await page.route(`**/api/workspaces/${workspaceId}/fulfillment/work-items/${id}/execution`, async route => {
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON(); bodies.push(body);
      const record: ExecutionResultVersion = { id: `97060000-0000-4000-8000-00000000000${context.results.length + 2}`,
        version: context.results.length + 1, previousResultId: context.results.at(-1)?.id ?? null, schemaVersion: 1,
        payload: body.payload, performedAt: body.performedAt, performedByUserId: id, recordedByUserId: id,
        recordedAt: new Date().toISOString(), varianceReason: body.varianceReason, amendmentReason: body.amendmentReason,
        planSha256: context.planSha256 };
      context = { ...context, status: "completed", workItemRevision: 3, results: [...context.results, record] };
    }
    await route.fulfill({ json: { ok: true, context } });
  });
  await page.goto(`/w/${workspaceId}/imaging?modulePanel=open`);
  await expect(page).toHaveURL(new RegExp(`/w/${workspaceId}/imaging`));
  await expect(page).toHaveTitle(/CLAiR/i);
  // A single returned work item is selected by the module's normal entry effect.
  await expect(page.getByTestId(`imaging-queue-item-live-imaging-${id}`)).toBeVisible();
  await page.getByRole("button", { name: "수행기록·이력" }).click();
  const dialog = page.getByRole("dialog", { name: "실제 수행기록" });
  for (const name of ["실제 획득·검토한 영상 뷰", "실제 촬영·판독 프로토콜", "영상 소견", "판독 결과", "실제 수행 시각"]) {
    await expect(dialog.getByLabel(name, { exact: false })).toHaveValue("");
  }
  await expect(dialog.getByLabel("영상 수행 구분", { exact: false })).toContainText("직접 선택");
  await expect(dialog.getByRole("button", { name: "수행기록 저장 및 완료" })).toBeDisabled();
  await dialog.getByRole("button", { name: "현재 시각", exact: true }).click();
  await dialog.getByLabel("영상 수행 구분", { exact: false }).click();
  await page.getByRole("option", { name: /기존.*검토/ }).click();
  await dialog.getByLabel("실제 획득·검토한 영상 뷰", { exact: false }).fill("합성 제공 흉부 CT 시리즈");
  await dialog.getByLabel("실제 촬영·판독 프로토콜", { exact: false }).fill("제공된 합성 CT만 수기로 검토");
  await dialog.getByLabel("영상 품질", { exact: false }).click();
  await page.getByRole("option", { name: "제한적 판독", exact: true }).click();
  await dialog.getByLabel("영상 소견", { exact: false }).fill("수기로 입력한 합성 관찰");
  await dialog.getByLabel("판독 결과", { exact: false }).fill("합성 제한적 판독 · 신규 촬영 없음");
  await dialog.getByRole("button", { name: "수행기록 저장 및 완료" }).click();
  await expect.poll(() => bodies.length).toBe(1);
  expect(bodies[0]).toMatchObject({ expectedResultVersion: 0, payload: { acquisitionDisposition: "reviewed_existing",
    acquiredViews: ["합성 제공 흉부 CT 시리즈"], quality: "limited", interpretation: "합성 제한적 판독 · 신규 촬영 없음" } });
  await expect(dialog.getByText("버전 1", { exact: false })).toBeVisible();
  await dialog.getByRole("button", { name: "닫기", exact: true }).click();
  await page.getByRole("button", { name: "수행기록·이력" }).click();
  await dialog.getByRole("button", { name: "기록 정정", exact: true }).click();
  await dialog.getByLabel("판독 결과", { exact: false }).fill("합성 정정 판독 · 신규 촬영 없음");
  await expect(dialog.getByRole("button", { name: "정정 저장", exact: true })).toBeDisabled();
  await dialog.getByLabel("정정 사유", { exact: false }).fill("합성 전사 오류 정정");
  await dialog.getByRole("button", { name: "정정 저장", exact: true }).click();
  await expect.poll(() => bodies.length).toBe(2);
  expect(bodies[1]).toMatchObject({ expectedResultVersion: 1, payload: { acquisitionDisposition: "reviewed_existing" }, amendmentReason: "합성 전사 오류 정정" });
  await expect(dialog.getByText("버전 2", { exact: false })).toBeVisible();
  expect(context.results[0].payload.interpretation).toBe("합성 제한적 판독 · 신규 촬영 없음");
  expect(context.planSnapshot).toEqual(planned);
  expect(runtimeErrors).toEqual([]);
  await page.screenshot({ path: "/tmp/wp06-imaging-review-amended.png", fullPage: false });
});
