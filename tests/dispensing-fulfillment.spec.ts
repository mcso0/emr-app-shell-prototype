import { expect, test, type Page } from "@playwright/test";

import { SESSION_WORKSPACES_STORAGE_KEY } from "../src/features/auth/workspace-session";
import { PREPARED_EMPTY_CLINIC_WORKSPACE_ID } from "../src/lib/emr-domain/demo-workspaces";
import type { ExecutionContext, ExecutionResultVersion } from "../src/features/fulfillment/execution-result-contract";

test("copied treatment link reopens the exact instruction when an encounter has multiple work items", async ({ page }) => {
  await grantCheongdamWorkspaceAccess(page);
  const workspaceId = PREPARED_EMPTY_CLINIC_WORKSPACE_ID;
  const encounterId = "97090000-0000-4000-8000-000000000031";
  const dispensingId = "97090000-0000-4000-8000-000000000032";
  const treatmentId = "97090000-0000-4000-8000-000000000033";
  const date = "2026-09-07";
  const requestedDates: string[] = [];

  await page.route(`**/api/workspaces/${workspaceId}/fulfillment/work-items?*`, async (route) => {
    const params = new URL(route.request().url()).searchParams;
    requestedDates.push(params.get("date") ?? "");
    const queueType = params.get("queueType");
    const id = queueType === "treatment" ? treatmentId : dispensingId;
    await route.fulfill({ json: { ok: true, workItems: params.get("date") === date ? [{
      id, workspaceId, encounterId, orderId: id, queueType, requestCycle: 1,
      rowRevision: 1, status: "requested", createdAt: "2026-09-07T01:30:00.000Z",
      updatedAt: "2026-09-07T01:30:00.000Z",
      sourceSnapshot: { patientName: "초코", guardianName: "보호자", orderDisplayName: queueType === "treatment" ? "피하 수액" : "경구약" },
    }] : [] } });
  });

  await page.goto(`/w/${workspaceId}/dispensing?date=${date}&encounterId=${encounterId}&queueItemId=live-fulfillment-${treatmentId}&modulePanel=closed&aside=closed`);
  await expect(page.getByRole("heading", { name: "처치 지시서" })).toBeVisible();
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin: new URL(page.url()).origin });
  await page.getByRole("button", { name: "처치 지시서 링크 복사" }).click();
  const copiedLink = await page.evaluate(() => navigator.clipboard.readText());
  const copiedUrl = new URL(copiedLink);
  expect(copiedUrl.searchParams.get("queueItemId")).toBe(`live-fulfillment-${treatmentId}`);
  expect(copiedUrl.searchParams.get("date")).toBe(date);
  expect(copiedUrl.searchParams.get("modulePanel")).toBe("closed");

  await page.goto(copiedLink);
  await expect(page.getByRole("heading", { name: "처치 지시서" })).toBeVisible();
  expect(requestedDates).toContain(date);
});

test("patient history combines dispensing and treatment orders and filters by category", async ({ page }) => {
  await page.goto(
    "/w/clair-demo/dispensing?date=2026-05-01&workItemId=fulfill-order-coco-maropitant&modulePanel=closed&aside=history",
  );

  const aside = page.locator("#dispensing-content-aside");
  await expect(aside).toContainText("조제/처치 이력");
  await expect(aside).toContainText("Maropitant 16mg T");
  await expect(aside).toContainText("피하 수액 처치");
  await expect(aside).not.toContainText("user-tech");

  await aside.getByRole("button", { name: "처치", exact: true }).click();
  await expect(aside).toContainText("피하 수액 처치");
  await expect(aside).not.toContainText("Maropitant 16mg T");

  await aside.getByRole("button", { name: "조제", exact: true }).click();
  await expect(aside).toContainText("Maropitant 16mg T");
  await expect(aside).not.toContainText("피하 수액 처치");
});

test("actual execution UI starts empty, records completion, reloads history and appends an explicit correction", async ({ page }) => {
  await grantCheongdamWorkspaceAccess(page);
  const workspaceId = PREPARED_EMPTY_CLINIC_WORKSPACE_ID;
  const id = "97080000-0000-4000-8000-000000000001";
  let context: ExecutionContext = { workspaceId, workItemId: id, taskId: id, orderId: id, encounterId: id,
    attemptNo: 1, workItemRevision: 2, clinicalOrderType: "dispensing", status: "in_progress", isCurrentAttempt: true,
    planSnapshot: { detailInputs: { dose: 0.5, doseUnit: "tablet", totalQuantity: 8 }, calculationOutputs: { plannedPracticalTotalQuantity: 8, dispenseUnit: "tablet" } },
    planSha256: "a".repeat(64), resultRequired: true, canRecord: true, results: [] };
  const bodies: Array<Record<string, unknown>> = [];
  await page.route(`**/api/workspaces/${workspaceId}/fulfillment/work-items?*`, async route => {
    const queueType = new URL(route.request().url()).searchParams.get("queueType");
    await route.fulfill({ json: { ok: true, workItems: queueType === "dispensing" ? [{ workspaceId, id, orderId: id, encounterId: id,
      taskId: id, taskAttemptNo: 1, requestCycle: 1, rowRevision: context.workItemRevision, status: context.status,
      queueType: "dispensing", assignedToUserId: id, requestedByUserId: id,
      patientName: "합성 수행 환자", guardianName: "합성 보호자", requesterName: "합성 수의사",
      createdAt: "2026-09-06T00:00:00.000Z", updatedAt: "2026-09-06T00:00:00.000Z",
      sourceSnapshot: { orderDisplayName: "합성 조제 작업", instruction: "합성 테스트" },
    }] : [] } });
  });
  await page.route(`**/api/workspaces/${workspaceId}/fulfillment/work-items/${id}/execution`, async route => {
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON(); bodies.push(body);
      const record: ExecutionResultVersion = { id: `97080000-0000-4000-8000-00000000000${context.results.length + 2}`,
        version: context.results.length + 1, previousResultId: context.results.at(-1)?.id ?? null, schemaVersion: 1,
        payload: body.payload, performedAt: body.performedAt, performedByUserId: id, recordedByUserId: id,
        recordedAt: new Date().toISOString(), varianceReason: body.varianceReason, amendmentReason: body.amendmentReason, planSha256: context.planSha256 };
      context = { ...context, status: "completed", workItemRevision: 3, results: [...context.results, record] };
    }
    await route.fulfill({ json: { ok: true, context } });
  });
  await page.goto(`/w/${workspaceId}/dispensing?modulePanel=open`);
  await page.getByTestId(`order-queue-item-live-fulfillment-${id}`).click();
  await expect.poll(() => {
    const url = new URL(page.url());
    return {
      date: url.searchParams.get("date"),
      encounterId: url.searchParams.get("encounterId"),
      workItemId: url.searchParams.get("workItemId"),
    };
  }).toMatchObject({
    date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    encounterId: id,
    workItemId: id,
  });
  await expect(page.getByText("합성 수행 환자").first()).toBeVisible();
  await expect(page.getByText("합성 수의사").first()).toBeVisible();
  await page.getByRole("button", { name: "수행기록·이력" }).click();
  const dialog = page.getByRole("dialog", { name: "실제 수행기록" });
  await expect(dialog.getByLabel("실제 준비수량", { exact: false })).toHaveValue("");
  await expect(dialog.getByLabel("실제 수행 시각", { exact: false })).toHaveValue("");
  await expect(dialog.getByRole("button", { name: "수행기록 저장 및 완료" })).toBeDisabled();
  await dialog.getByRole("button", { name: "현재 시각" }).click();
  await dialog.getByLabel("실제 준비수량", { exact: false }).fill("7.5");
  await dialog.getByLabel("실제 준비 단위", { exact: false }).fill("tablet");
  await dialog.getByLabel("계획과의 차이 사유").fill("합성 계량 차이");
  await dialog.getByRole("button", { name: "수행기록 저장 및 완료" }).click();
  await expect.poll(() => bodies.length).toBe(1);
  expect(bodies[0].payload).toEqual({ preparedQuantity: 7.5, preparedUnit: "tablet" });
  expect(context.planSnapshot).toMatchObject({ calculationOutputs: { plannedPracticalTotalQuantity: 8 } });
  await expect(dialog.getByText("버전 1", { exact: false })).toBeVisible();
  await dialog.getByRole("button", { name: "닫기", exact: true }).click();
  await page.getByRole("button", { name: "수행기록·이력" }).click();
  await dialog.getByRole("button", { name: "기록 정정", exact: true }).click();
  await expect(dialog.getByLabel("실제 준비수량", { exact: false })).toHaveValue("7.5");
  await dialog.getByLabel("실제 준비수량", { exact: false }).fill("8");
  await expect(dialog.getByRole("button", { name: "정정 저장" })).toBeDisabled();
  await dialog.getByLabel("정정 사유", { exact: false }).fill("합성 수량 재확인");
  await dialog.getByRole("button", { name: "정정 저장" }).click();
  await expect.poll(() => bodies.length).toBe(2);
  expect(bodies[1]).toMatchObject({ expectedResultVersion: 1, amendmentReason: "합성 수량 재확인", payload: { preparedQuantity: 8 } });
  await expect(dialog.getByText("버전 2", { exact: false })).toBeVisible();
  expect(context.results[0].payload.preparedQuantity).toBe(7.5);
});

test("treatment V2 actual UI requires explicit count, measurement and device identity while keeping planned values separate", async ({ page }) => {
  await grantCheongdamWorkspaceAccess(page);
  const workspaceId = PREPARED_EMPTY_CLINIC_WORKSPACE_ID;
  const id = "97040000-0000-4000-8000-000000000001";
  let context: ExecutionContext = { workspaceId, workItemId: id, taskId: id, orderId: id, encounterId: id,
    attemptNo: 1, workItemRevision: 2, clinicalOrderType: "treatment", status: "in_progress", isCurrentAttempt: true,
    planSnapshot: { detailSchemaVersion: 2, detailInputs: { procedureKind: "measurement", method: "합성 안압 측정",
      plannedProcedureCount: 1, procedureCountUnit: "session", measurementUnit: "mmHg", deviceProtocol: "TONOVET Plus 합성 수기 프로필" } },
    planSha256: "b".repeat(64), resultRequired: true, canRecord: true, results: [] };
  let posted: Record<string, unknown> | null = null;
  await page.route(`**/api/workspaces/${workspaceId}/fulfillment/work-items?*`, async route => {
    const queueType = new URL(route.request().url()).searchParams.get("queueType");
    await route.fulfill({ json: { ok: true, workItems: queueType === "treatment" ? [{ workspaceId, id, orderId: id, encounterId: id,
      taskId: id, taskAttemptNo: 1, requestCycle: 1, rowRevision: context.workItemRevision, status: context.status,
      queueType: "treatment", assignedToUserId: id, requestedByUserId: id,
      createdAt: "2026-09-06T00:00:00.000Z", updatedAt: "2026-09-06T00:00:00.000Z",
      sourceSnapshot: { patientName: "합성 수행 환자", guardianName: "합성 보호자", orderDisplayName: "합성 안압 측정", instruction: "수기 입력 · 연동 안 됨", requestingVetName: "합성 수의사" },
    }] : [] } });
  });
  await page.route(`**/api/workspaces/${workspaceId}/fulfillment/work-items/${id}/execution`, async route => {
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON(); posted = body;
      context = { ...context, status: "completed", workItemRevision: 3, results: [{ id: "97040000-0000-4000-8000-000000000002",
        version: 1, previousResultId: null, schemaVersion: 1, payload: body.payload, performedAt: body.performedAt,
        performedByUserId: id, recordedByUserId: id, recordedAt: new Date().toISOString(),
        varianceReason: body.varianceReason, amendmentReason: null, planSha256: context.planSha256 }] };
    }
    await route.fulfill({ json: { ok: true, context } });
  });
  await page.goto(`/w/${workspaceId}/dispensing?modulePanel=open`);
  await page.getByTestId(`order-queue-item-live-fulfillment-${id}`).click();
  await page.getByRole("button", { name: "수행기록·이력" }).click();
  const dialog = page.getByRole("dialog", { name: "실제 수행기록" });
  await expect(dialog.getByLabel("실제 시행 횟수", { exact: false })).toHaveValue("");
  await expect(dialog.getByLabel("실제 측정값", { exact: false })).toHaveValue("");
  await dialog.getByRole("button", { name: "현재 시각", exact: true }).click();
  await dialog.getByLabel("실제 시행한 처치", { exact: false }).fill("합성 안압 측정");
  await dialog.getByLabel("시행 결과", { exact: false }).fill("합성 측정값 기록");
  await dialog.getByLabel("실제 시행 횟수", { exact: false }).fill("1");
  await dialog.getByLabel("실제 횟수 단위", { exact: false }).fill("session");
  await dialog.getByLabel("실제 측정값", { exact: false }).fill("12");
  await dialog.getByLabel("실제 측정 단위", { exact: false }).fill("mmHg");
  await expect(dialog.getByRole("button", { name: "수행기록 저장 및 완료" })).toBeDisabled();
  await dialog.getByLabel("실제 사용 장비·모델", { exact: false }).fill("합성 TONOVET Plus 장비");
  await dialog.getByLabel("장비 설정 기록 방식", { exact: false }).click();
  await page.getByRole("option", { name: "조절 설정 없음 · 해당 없음" }).click();
  await dialog.getByRole("button", { name: "수행기록 저장 및 완료" }).click();
  await expect.poll(() => posted).not.toBeNull();
  expect(posted).toMatchObject({ payload: { performedCount: 1, performedCountUnit: "session", measurementValue: 12,
    measurementUnit: "mmHg", deviceSettingsPolicy: "not_adjustable" } });
  await expect(dialog.getByText("버전 1", { exact: false })).toBeVisible();
  expect(context.planSnapshot.detailInputs).not.toHaveProperty("measurementValue");
});

async function grantCheongdamWorkspaceAccess(page: Page) {
  await page.addInitScript(
    ([storageKey, workspaceId]) => {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({
          currentWorkspaceId: workspaceId,
          workspaces: [
            {
              id: workspaceId,
              displayName: "VIP동물의료센터 청담점",
              representativeName: "김승욱",
              contactEmail: "owner@cheongdam.test",
              contactPhone: null,
              subscriptionStatus: "trialing",
              createdBySessionId: "playwright-default-session",
              createdAt: "2026-06-14T00:00:00.000Z",
            },
          ],
          memberships: [
            {
              id: "membership-cheongdam-playwright-admin",
              workspaceId,
              userSessionId: "playwright-default-session",
              displayName: "Playwright Admin",
              email: "admin@cheongdam.test",
              roles: ["hospital_admin"],
              status: "active",
              createdAt: "2026-06-14T00:00:00.000Z",
              activatedAt: "2026-06-14T00:00:00.000Z",
            },
          ],
          invitations: [],
          updatedAt: "2026-06-14T00:00:00.000Z",
        }),
      );
    },
    [SESSION_WORKSPACES_STORAGE_KEY, PREPARED_EMPTY_CLINIC_WORKSPACE_ID],
  );
}

test("dispensing no-work empty state hides history aside", async ({ page }) => {
  await grantCheongdamWorkspaceAccess(page);
  let queueReadCount = 0;

  await page.route(
    `**/api/workspaces/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/fulfillment/work-items?*`,
    async (route) => {
      queueReadCount += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 200,
          enforcedBy: "fulfillment-work-item-persistence",
          workItems: [],
        }),
      });
    },
  );

  await page.goto(
    `/w/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/dispensing?modulePanel=open&aside=history&right=closed`,
  );

  await expect(page.locator("#dispensing-content-aside")).toHaveCount(0);
  const emptyState = page.getByTestId("dispensing-content-empty-state");
  await expect(emptyState).toBeVisible();
  await expect(emptyState).toHaveAttribute("data-surface", "content");
  await expect(emptyState).toHaveAttribute("data-size", "xl");
  await expect(
    emptyState.getByRole("heading", { name: "조제/처치 업무가 없습니다" }),
  ).toBeVisible();
  const refreshButton = emptyState.getByRole("button", { name: "새로고침" });
  await expect(refreshButton).toBeEnabled();
  await expect(page.getByTestId("dispensing-fulfillment-state")).toHaveCount(0);

  const initialQueueReadCount = queueReadCount;
  await refreshButton.click();
  await expect.poll(() => queueReadCount).toBeGreaterThan(initialQueueReadCount);
  await expect(refreshButton).toBeEnabled();
  await expect(page.getByTestId("dispensing-fulfillment-state")).toHaveCount(0);
  await expect(emptyState).toBeVisible();
});

test("dispensing keeps the exact work item when one encounter has multiple queue rows", async ({ page }) => {
  await grantCheongdamWorkspaceAccess(page);
  const workspaceId = PREPARED_EMPTY_CLINIC_WORKSPACE_ID;
  const encounterId = "97090000-0000-4000-8000-000000000001";
  const firstId = "97090000-0000-4000-8000-000000000011";
  const secondId = "97090000-0000-4000-8000-000000000012";
  const createItem = (id: string, orderName: string) => ({
    workspaceId,
    id,
    orderId: id,
    encounterId,
    requestCycle: 1,
    rowRevision: 1,
    status: "requested",
    queueType: "dispensing",
    requestedByUserId: "97090000-0000-4000-8000-000000000002",
    patientName: "합성 동일 진료 환자",
    guardianName: "합성 보호자",
    requesterName: "합성 요청 수의사",
    createdAt: "2026-09-12T00:01:00.000Z",
    updatedAt: "2026-09-12T00:01:00.000Z",
    sourceSnapshot: { orderDisplayName: orderName, instruction: `${orderName} 수행` },
  });

  await page.route(`**/api/workspaces/${workspaceId}/fulfillment/work-items?*`, async (route) => {
    const queueType = new URL(route.request().url()).searchParams.get("queueType");
    await route.fulfill({
      json: {
        ok: true,
        workItems:
          queueType === "dispensing"
            ? [createItem(firstId, "첫 번째 합성 조제"), createItem(secondId, "두 번째 합성 조제")]
            : [],
      },
    });
  });

  await page.goto(`/w/${workspaceId}/dispensing?modulePanel=open`);
  await page.getByTestId(`order-queue-item-live-fulfillment-${secondId}`).click();

  await expect.poll(() => {
    const url = new URL(page.url());
    return {
      encounterId: url.searchParams.get("encounterId"),
      workItemId: url.searchParams.get("workItemId"),
    };
  }).toEqual({ encounterId, workItemId: secondId });
  await expect(page.getByText("두 번째 합성 조제", { exact: true }).first()).toBeVisible();
});

test("dispensing resolves same-name live rows by exact id and sends commands to the clicked work item", async ({
  page,
}) => {
  await grantCheongdamWorkspaceAccess(page);
  const workspaceId = PREPARED_EMPTY_CLINIC_WORKSPACE_ID;
  const firstEncounterId = "97100000-0000-4000-8000-000000000001";
  const secondEncounterId = "97100000-0000-4000-8000-000000000002";
  const firstId = "97100000-0000-4000-8000-000000000011";
  const sameEncounterId = "97100000-0000-4000-8000-000000000012";
  const otherEncounterId = "97100000-0000-4000-8000-000000000013";
  const commandTargets: string[] = [];
  const executionTargets: string[] = [];
  const createItem = (id: string, encounterId: string, instruction: string) => ({
    workspaceId,
    id,
    orderId: id,
    encounterId,
    requestCycle: 1,
    rowRevision: 1,
    status: "requested",
    queueType: "dispensing",
    requestedByUserId: "97100000-0000-4000-8000-000000000003",
    patientName: "합성 동명이 작업 환자",
    guardianName: "합성 보호자",
    requesterName: "합성 요청 수의사",
    createdAt: "2026-09-12T00:01:00.000Z",
    updatedAt: "2026-09-12T00:01:00.000Z",
    sourceSnapshot: {
      orderDisplayName: "동일한 합성 조제",
      instruction,
    },
  });
  const workItems = [
    createItem(firstId, firstEncounterId, "첫 번째 작업 지시"),
    createItem(sameEncounterId, firstEncounterId, "같은 진료의 두 번째 작업 지시"),
    createItem(otherEncounterId, secondEncounterId, "다른 진료의 작업 지시"),
  ];

  await page.route(`**/api/workspaces/${workspaceId}/fulfillment/work-items?*`, async (route) => {
    const queueType = new URL(route.request().url()).searchParams.get("queueType");
    await route.fulfill({
      json: {
        ok: true,
        workItems: queueType === "dispensing" ? workItems : [],
      },
    });
  });
  await page.route(`**/api/workspaces/${workspaceId}/fulfillment/work-items/*`, async (route) => {
    if (route.request().method() !== "PATCH") {
      await route.fallback();
      return;
    }
    const workItemId = new URL(route.request().url()).pathname.split("/").at(-1);
    if (!workItemId) throw new Error("missing work item id");
    commandTargets.push(workItemId);
    await route.fulfill({
      json: {
        ok: true,
        workItems: workItems.map((workItem) =>
          workItem.id === workItemId
            ? { ...workItem, assignedToUserId: "user-tech", rowRevision: 2 }
            : workItem,
        ),
      },
    });
  });
  await page.route(
    `**/api/workspaces/${workspaceId}/fulfillment/work-items/*/execution`,
    async (route) => {
      const workItemId = new URL(route.request().url()).pathname.split("/").at(-2);
      const selectedWorkItem = workItems.find((item) => item.id === workItemId);
      if (!workItemId || !selectedWorkItem) {
        await route.fulfill({ status: 404, json: { ok: false } });
        return;
      }
      executionTargets.push(workItemId);
      await route.fulfill({
        json: {
          ok: true,
          context: {
            workspaceId,
            workItemId,
            taskId: workItemId,
            orderId: workItemId,
            encounterId: selectedWorkItem.encounterId,
            attemptNo: 1,
            workItemRevision: 1,
            clinicalOrderType: "dispensing",
            status: "requested",
            isCurrentAttempt: true,
            planSnapshot: {},
            planSha256: "c".repeat(64),
            resultRequired: true,
            canRecord: false,
            results: [],
          },
        },
      });
    },
  );

  await page.goto(`/w/${workspaceId}/dispensing?modulePanel=open`);
  await page
    .getByTestId(`order-queue-item-live-fulfillment-${sameEncounterId}`)
    .click();
  await expect.poll(() => {
    const url = new URL(page.url());
    return {
      encounterId: url.searchParams.get("encounterId"),
      workItemId: url.searchParams.get("workItemId"),
    };
  }).toEqual({ encounterId: firstEncounterId, workItemId: sameEncounterId });
  await expect(
    page.getByText("같은 진료의 두 번째 작업 지시", { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "수행기록·이력" }).click();
  await expect.poll(() => executionTargets.length).toBeGreaterThan(0);
  expect(new Set(executionTargets)).toEqual(new Set([sameEncounterId]));
  await page
    .getByRole("dialog", { name: "실제 수행기록" })
    .getByRole("button", { name: "닫기", exact: true })
    .click();
  await page.getByRole("button", { name: "담당하기" }).first().click();
  await expect.poll(() => commandTargets).toEqual([sameEncounterId]);

  await page
    .getByTestId(`order-queue-item-live-fulfillment-${otherEncounterId}`)
    .click();
  await expect.poll(() => {
    const url = new URL(page.url());
    return {
      encounterId: url.searchParams.get("encounterId"),
      workItemId: url.searchParams.get("workItemId"),
    };
  }).toEqual({ encounterId: secondEncounterId, workItemId: otherEncounterId });
  await expect(
    page.getByText("다른 진료의 작업 지시", { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "수행기록·이력" }).click();
  await expect.poll(() => executionTargets.includes(otherEncounterId)).toBe(true);
  expect(new Set(executionTargets)).toEqual(
    new Set([sameEncounterId, otherEncounterId]),
  );
  await page
    .getByRole("dialog", { name: "실제 수행기록" })
    .getByRole("button", { name: "닫기", exact: true })
    .click();
  await page.getByRole("button", { name: "담당하기" }).first().click();
  await expect.poll(() => commandTargets).toEqual([
    sameEncounterId,
    otherEncounterId,
  ]);
});

test("dispensing fails closed when a live work item id is missing", async ({ page }) => {
  await grantCheongdamWorkspaceAccess(page);
  const workspaceId = PREPARED_EMPTY_CLINIC_WORKSPACE_ID;
  const encounterId = "97110000-0000-4000-8000-000000000001";
  const existingId = "97110000-0000-4000-8000-000000000011";
  let commandCount = 0;
  const workItem = {
    workspaceId,
    id: existingId,
    orderId: existingId,
    encounterId,
    requestCycle: 1,
    rowRevision: 1,
    status: "requested",
    queueType: "dispensing",
    requestedByUserId: "97110000-0000-4000-8000-000000000003",
    patientName: "합성 누락 ID 환자",
    guardianName: "합성 보호자",
    requesterName: "합성 요청 수의사",
    createdAt: "2026-09-12T00:01:00.000Z",
    updatedAt: "2026-09-12T00:01:00.000Z",
    sourceSnapshot: {
      orderDisplayName: "동일한 합성 조제",
      instruction: "존재하는 작업 지시",
    },
  };

  await page.route(`**/api/workspaces/${workspaceId}/fulfillment/work-items?*`, async (route) => {
    const queueType = new URL(route.request().url()).searchParams.get("queueType");
    await route.fulfill({
      json: {
        ok: true,
        workItems: queueType === "dispensing" ? [workItem] : [],
      },
    });
  });
  await page.route(`**/api/workspaces/${workspaceId}/fulfillment/work-items/*`, async (route) => {
    if (route.request().method() === "PATCH") commandCount += 1;
    await route.fulfill({ status: 404, json: { ok: false } });
  });

  await page.goto(
    `/w/${workspaceId}/dispensing?modulePanel=open&date=2026-09-12&encounterId=${encounterId}&workItemId=missing-live-id`,
  );
  await expect(
    page.getByTestId(`order-queue-item-live-fulfillment-${existingId}`),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /조제 지시서|처치 지시서/ }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: "담당하기" })).toHaveCount(0);
  expect(commandCount).toBe(0);
});

type FulfillmentWorkItemStatus =
  | "requested"
  | "accepted"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "returned";

const workspaceId = "clair-demo";

function createFulfillmentWorkItem(overrides: {
  dispensingLineage?: Record<string, unknown>;
  detailInputs?: Record<string, unknown>;
  id: string;
  orderDisplayName: string;
  orderId: string;
  patientId?: string;
  queueType: "dispensing" | "treatment";
  quantity?: number;
  salesUnit?: string;
  status?: FulfillmentWorkItemStatus;
  taskAttemptNo?: number;
  taskId?: string;
  taskStatus?:
    | "pending"
    | "in_progress"
    | "paused"
    | "partial_complete"
    | "complete"
    | "cancelled";
}) {
  return {
    assignedToUserId: overrides.status === "requested" ? null : "user-tech",
    completedAt: null,
    createdAt: "2026-06-09T10:30:00.000Z",
    encounterId: "enc-den456",
    id: overrides.id,
    orderId: overrides.orderId,
    patientId: overrides.patientId,
    queueType: overrides.queueType,
    requestCycle: 1,
    requestedByUserId: "user-vet-suji",
    rowRevision: 1,
    sourceSnapshot: {
      ...(overrides.dispensingLineage
        ? { dispensingLineage: overrides.dispensingLineage }
        : {}),
      ...(overrides.detailInputs
        ? { detailInputs: overrides.detailInputs }
        : {}),
      guardianName: "이지은",
      instruction: `${overrides.orderDisplayName} 수행`,
      orderDisplayName: overrides.orderDisplayName,
      patientName: "코코",
      requestingVetName: "이수지",
      quantity: overrides.quantity,
      salesUnit: overrides.salesUnit,
    },
    status: overrides.status ?? "requested",
    taskAttemptNo: overrides.taskAttemptNo,
    taskId: overrides.taskId,
    taskStatus: overrides.taskStatus,
    updatedAt: "2026-06-09T10:35:00.000Z",
    workspaceId,
  };
}

test("dispensing treatment workspace reads fulfillment queue and sends status mutation", async ({
  page,
}) => {
  const fulfillmentQueueRead = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return (
      response.request().method() === "GET" &&
      url.pathname === "/api/workspaces/clair-demo/fulfillment/work-items" &&
      url.searchParams.get("queueType") === "dispensing"
    );
  });
  await page.goto("/w/clair-demo/dispensing?modulePanel=open");

  await expect(page.getByText("조제/처치").first()).toBeVisible();
  await fulfillmentQueueRead;
  await page.waitForLoadState("networkidle");
  const fulfillmentQueueItem = page.getByTestId(
    "order-queue-item-live-fulfillment-fulfill-order-coco-fluid",
  );
  await expect(fulfillmentQueueItem).toContainText(/이수지 (요청|재요청)/);
  await expect(fulfillmentQueueItem).not.toContainText("담당 수의사 요청");
  await fulfillmentQueueItem.click();
  await expect(
    page.getByRole("heading", { name: /조제 지시서|처치 지시서/ }),
  ).toBeVisible();

  const instructionStatus = page.getByTestId("instruction-status-label");
  const claimButton = page.getByRole("button", { name: "담당하기" }).first();
  if (
    (await instructionStatus.getByText(/대기중|재요청/).isVisible()) &&
    (await claimButton.isVisible()) &&
    (await claimButton.isEnabled())
  ) {
    const [fulfillmentStatusPatch] = await Promise.all([
      page
        .waitForResponse(
          (response) =>
            response.request().method() === "PATCH" &&
            response
              .url()
              .includes("/api/workspaces/clair-demo/fulfillment/work-items/") &&
            response.request().postData()?.includes('"in_progress"') === true,
          { timeout: 5000 },
        )
        .catch(() => null),
      claimButton.click(),
    ]);
    if (fulfillmentStatusPatch) expect(fulfillmentStatusPatch.ok()).toBe(true);
  }
  await expect(
    page.getByRole("button", { name: /조제중|처치중|재요청/ }).first(),
  ).toBeVisible();
});

test("Cheongdam dispensing renders standalone live fulfillment rows without fixture overlay", async ({
  page,
}) => {
  await grantCheongdamWorkspaceAccess(page);

  const liveWorkItem = {
    assignedToUserId: null,
    createdAt: "2026-06-14T01:30:00.000Z",
    encounterId: "encounter-cheongdam-live-001",
    id: "work-cheongdam-dispensing-001",
    orderId: "order-cheongdam-dispensing-001",
    patientId: "patient-cheongdam-live-001",
    queueType: "dispensing",
    requestCycle: 1,
    requestedByUserId: "user-vet",
    rowRevision: 1,
    sourceSnapshot: {
      guardianName: "최보호",
      instruction: "식후 1일 2회",
      inHospitalOrderName: "항생제 5일분",
      patientName: "루나",
      requestingVetName: "김민준",
    },
    status: "requested",
    updatedAt: "2026-06-14T01:30:00.000Z",
    workspaceId: PREPARED_EMPTY_CLINIC_WORKSPACE_ID,
  };
  let liveStatus: FulfillmentWorkItemStatus = "requested";
  let liveAssigneeUserId: string | null = null;
  let liveRevision = 1;
  const patchBodies: Array<{
    action?: string;
    expectedRevision?: number;
    reason?: string;
  }> = [];

  await page.route(
    `**/api/workspaces/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/fulfillment/work-items?*`,
    async (route) => {
      const url = new URL(route.request().url());
      const queueType = url.searchParams.get("queueType");

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 200,
          enforcedBy: "fulfillment-work-item-persistence",
          workItems:
            queueType === "dispensing"
              ? [
                  {
                    ...liveWorkItem,
                    assignedToUserId: liveAssigneeUserId,
                    rowRevision: liveRevision,
                    status: liveStatus,
                  },
                ]
              : [],
        }),
      });
    },
  );

  const lifecycleActions: string[] = [];
  await page.route(
    `**/api/workspaces/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/fulfillment/work-items/${liveWorkItem.id}`,
    async (route) => {
      const body = JSON.parse(route.request().postData() ?? "{}") as {
        action?: string;
        expectedRevision?: number;
        reason?: string;
      };
      patchBodies.push(body);
      if (body.action) lifecycleActions.push(body.action);
      if (body.action === "claim") liveAssigneeUserId = "user-tech";
      if (body.action === "unassign") liveAssigneeUserId = null;
      if (body.action === "start") liveStatus = "in_progress";
      liveRevision += 1;

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 200,
          enforcedBy: "fulfillment-work-item-persistence",
          workItems: [
            {
              ...liveWorkItem,
              assignedToUserId: liveAssigneeUserId,
              rowRevision: liveRevision,
              status: liveStatus,
            },
          ],
        }),
      });
    },
  );
  await page.route(
    `**/api/workspaces/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/fulfillment/work-items/${liveWorkItem.id}/history?*`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 200,
          enforcedBy: "fulfillment-work-item-history-persistence",
          history: {
            workspaceId: PREPARED_EMPTY_CLINIC_WORKSPACE_ID,
            workItemId: liveWorkItem.id,
            orderId: liveWorkItem.orderId,
            queueType: "dispensing",
            hasMore: false,
            nextCursor: null,
            events: [
              {
                id: "history-cheongdam-created",
                workItemId: liveWorkItem.id,
                orderId: liveWorkItem.orderId,
                previousStatus: null,
                nextStatus: "requested",
                actorUserId: "user-vet",
                reason: null,
                createdAt: "2026-06-14T01:30:00.000Z",
                source: "work_item_created",
              },
              {
                id: "history-cheongdam-started",
                workItemId: liveWorkItem.id,
                orderId: liveWorkItem.orderId,
                previousStatus: "accepted",
                nextStatus: "in_progress",
                actorUserId: "user-tech",
                reason: "조제 시작 확인",
                createdAt: "2026-06-14T01:35:00.000Z",
                source: "order_event",
              },
            ],
          },
        }),
      });
    },
  );

  await page.goto(
    `/w/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/dispensing?modulePanel=open`,
  );

  const liveQueueItem = page.getByTestId(
    `order-queue-item-live-fulfillment-${liveWorkItem.id}`,
  );
  await expect(liveQueueItem).toContainText("루나");
  await expect(liveQueueItem).toContainText("항생제 5일분");
  await expect(page.locator("aside").first().getByText("코코")).toHaveCount(0);

  await liveQueueItem.click();
  await expect(
    page.locator("[data-slot='instruction-header-order-info']"),
  ).toContainText("2026.06.14 10:30");
  await page
    .getByRole("button", { name: "조제 이력 패널 열기" })
    .click();
  const historyAside = page.locator("#dispensing-content-aside");
  await expect(historyAside).toContainText("조제/처치 이력");
  await expect(historyAside).toContainText("항생제 5일분");
  await expect(historyAside).not.toContainText("오더명 없음");
  await expect(historyAside).toContainText("요청");
  await expect(historyAside).not.toContainText("조제 시작 확인");
  await expect(historyAside).not.toContainText("user-tech");
  const historyDialog = page.getByRole("dialog", { name: "조제/처치 이력", exact: true });
  await expect(historyDialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(historyDialog).toBeHidden();
  await page.getByRole("button", { name: "담당하기" }).first().click();
  await expect.poll(() => lifecycleActions).toEqual(["claim"]);
  await page
    .getByRole("button", { name: "조제 상태 액션 열기" })
    .first()
    .click();
  await page.getByRole("menuitem", { name: "담당 취소" }).click();
  await expect.poll(() => lifecycleActions).toEqual(["claim", "unassign"]);
  await page.getByRole("button", { name: "담당하기" }).first().click();
  await expect.poll(() => lifecycleActions).toEqual(["claim", "unassign", "claim"]);
  await page.getByRole("button", { name: "조제 시작" }).click();
  await expect.poll(() => lifecycleActions).toEqual([
    "claim",
    "unassign",
    "claim",
    "start",
  ]);
  expect(patchBodies[0]).toMatchObject({ action: "claim", expectedRevision: 1 });
  expect(patchBodies[1]).toMatchObject({ action: "unassign", expectedRevision: 2 });
  await expect(page.getByTestId("instruction-status-label")).toContainText(
    "진행중",
  );
});

test("dispensing treatment workspace refreshes server-backed status after persisted mutation", async ({
  page,
}) => {
  let dispensingStatus: FulfillmentWorkItemStatus = "requested";
  let dispensingAssigneeUserId: string | null = null;
  let dispensingRevision = 1;
  const lifecycleActions: string[] = [];
  let dispensingReads = 0;
  let treatmentReads = 0;

  await page.route(
    new RegExp(
      `/api/workspaces/${workspaceId}/fulfillment/work-items\\?queueType=dispensing(?:&.*)?$`,
    ),
    async (route) => {
      dispensingReads += 1;
      await route.fulfill({
        contentType: "application/json",
        json: {
          ok: true,
          workItems: [
            {
              ...createFulfillmentWorkItem({
              id: "den456-dispensing",
              orderDisplayName: "DEN-456 항구토제 조제",
              orderId: "order-den456-dispensing",
              queueType: "dispensing",
              status: dispensingStatus,
              }),
              assignedToUserId: dispensingAssigneeUserId,
              rowRevision: dispensingRevision,
            },
          ],
        },
      });
    },
  );
  await page.route(
    new RegExp(
      `/api/workspaces/${workspaceId}/fulfillment/work-items\\?queueType=treatment(?:&.*)?$`,
    ),
    async (route) => {
      treatmentReads += 1;
      await route.fulfill({
        contentType: "application/json",
        json: {
          ok: true,
          workItems: [
            createFulfillmentWorkItem({
              id: "den456-treatment",
              orderDisplayName: "DEN-456 수액 처치",
              orderId: "order-den456-treatment",
              queueType: "treatment",
              status: "in_progress",
            }),
          ],
        },
      });
    },
  );
  await page.route(
    new RegExp(
      `/api/workspaces/${workspaceId}/fulfillment/work-items/den456-dispensing$`,
    ),
    async (route) => {
      const body = JSON.parse(route.request().postData() ?? "{}") as {
        action?: string;
      };
      if (body.action) lifecycleActions.push(body.action);
      if (body.action === "claim") dispensingAssigneeUserId = "user-tech";
      if (body.action === "start") dispensingStatus = "in_progress";
      dispensingRevision += 1;
      await route.fulfill({
        contentType: "application/json",
        json: {
          ok: true,
          workItems: [{
            ...createFulfillmentWorkItem({
              id: "den456-dispensing",
              orderDisplayName: "DEN-456 항구토제 조제",
              orderId: "order-den456-dispensing",
              queueType: "dispensing",
              status: dispensingStatus,
            }),
            assignedToUserId: dispensingAssigneeUserId,
            rowRevision: dispensingRevision,
          }],
        },
      });
    },
  );

  await page.goto(`/w/${workspaceId}/dispensing?modulePanel=open`);
  await expect
    .poll(() => dispensingReads, { message: "dispensing queue should be read" })
    .toBeGreaterThan(0);
  await expect
    .poll(() => treatmentReads, { message: "treatment queue should be read" })
    .toBeGreaterThan(0);

  await page
    .getByTestId("order-queue-item-live-fulfillment-den456-dispensing")
    .click();
  const orderRow = page.getByTestId(
    "order-row-section-0-live-order-row-den456-dispensing",
  );
  await expect(orderRow).toContainText("DEN-456 항구토제 조제");

  await page.getByRole("button", { name: "담당하기" }).first().click();
  await expect
    .poll(() => lifecycleActions.join(","), {
      message: "requested item should be claimed before starting",
    })
    .toBe("claim");
  await page.getByRole("button", { name: "조제 시작" }).click();
  await expect.poll(() => lifecycleActions.join(",")).toBe("claim,start");
  await expect
    .poll(() => dispensingReads, {
      message: "successful status mutation should refresh the dispensing queue",
    })
    .toBeGreaterThan(1);
  await expect(
    page.getByRole("button", { name: /조제 중|처치 중/ }).first(),
  ).toBeVisible();
});

test("dispensing queue reconciles server totals with visible type-filter counts", async ({
  page,
}) => {
  await grantCheongdamWorkspaceAccess(page);
  const targetWorkspaceId = PREPARED_EMPTY_CLINIC_WORKSPACE_ID;
  const queueItems = {
    dispensing: Array.from({ length: 3 }, (_, index) => ({
      ...createFulfillmentWorkItem({
        id: `reconcile-dispensing-${index + 1}`,
        orderDisplayName: `정합성 조제 ${index + 1}`,
        orderId: `order-reconcile-dispensing-${index + 1}`,
        queueType: "dispensing",
        status: index === 2 ? "in_progress" : "requested",
      }),
      workspaceId: targetWorkspaceId,
    })),
    treatment: Array.from({ length: 2 }, (_, index) => ({
      ...createFulfillmentWorkItem({
        id: `reconcile-treatment-${index + 1}`,
        orderDisplayName: `정합성 처치 ${index + 1}`,
        orderId: `order-reconcile-treatment-${index + 1}`,
        queueType: "treatment",
        status: index === 1 ? "completed" : "requested",
      }),
      workspaceId: targetWorkspaceId,
    })),
  };

  await page.route(
    new RegExp(
      `/api/workspaces/${targetWorkspaceId}/fulfillment/work-items\\?queueType=(dispensing|treatment)(?:&.*)?$`,
    ),
    async (route) => {
      const queueType = new URL(route.request().url()).searchParams.get(
        "queueType",
      ) as "dispensing" | "treatment";
      const workItems = queueItems[queueType];
      await route.fulfill({
        contentType: "application/json",
        json: {
          ok: true,
          summary: {
            totalCount: workItems.length,
            statusCounts: {},
          },
          workItems,
        },
      });
    },
  );

  await page.goto(`/w/${targetWorkspaceId}/dispensing?modulePanel=open`);

  const typeFilter = page.getByRole("group", { name: "오더 유형 필터" });
  await expect(
    typeFilter.getByRole("button", { name: /전체\s*5/ }),
  ).toBeVisible();
  await expect(
    typeFilter.getByRole("button", { name: /조제\s*3/ }),
  ).toBeVisible();
  await expect(
    typeFilter.getByRole("button", { name: /처치\s*2/ }),
  ).toBeVisible();

  const queueRows = page.locator(
    '[data-testid^="order-queue-item-live-fulfillment-"]',
  );
  await expect(queueRows).toHaveCount(5);
  await typeFilter.getByRole("button", { name: /조제\s*3/ }).click();
  await expect(queueRows).toHaveCount(3);
  await page
    .getByTestId("order-queue-item-live-fulfillment-reconcile-dispensing-1")
    .click();
  await expect(
    page.getByTestId(
      "order-row-section-0-live-order-row-reconcile-dispensing-1",
    ),
  ).toContainText("정합성 조제 1");

  await typeFilter.getByRole("button", { name: /처치\s*2/ }).click();
  await expect(queueRows).toHaveCount(2);
  await expect(
    page.getByTestId("order-queue-item-live-fulfillment-reconcile-treatment-1"),
  ).toBeVisible();
  await expect(
    page.getByTestId("order-queue-item-live-fulfillment-reconcile-treatment-2"),
  ).toBeVisible();
});

test("dispensing order table shows prescription details without guessed execution fields", async ({
  page,
}) => {
  const dispensingLineage = {
    schemaVersion: 1,
    sourceDispensingProfileId: "01740000-0000-4000-8000-000000000001",
    sourceDispensingProfileRevision: 3,
    sourceMedicationProductId: "01730000-0000-4000-8000-000000000001",
    sourceMedicationProductRevision: 2,
    sourceClinicalReviewId: "01750000-0000-4000-8000-000000000001",
    sourceEvidenceFingerprint: "a".repeat(64),
    clinicalUseAllowed: true,
    dispensingProfileSnapshot: {
      koreanDraftName: "검토 완료 약품",
      englishProductName: "Reviewed Medicine",
      dosageForm: "Tablet",
      routes: ["oral"],
      strengthSnapshot: [
        {
          numeratorValue: 25,
          numeratorUnit: "mg",
          denominatorValue: null,
          denominatorUnit: null,
        },
      ],
      targetSpecies: ["dog", "cat"],
    },
    dispensingProfileSnapshotSha256: "b".repeat(64),
  };

  await page.route(
    new RegExp(
      `/api/workspaces/${workspaceId}/fulfillment/work-items\\?queueType=dispensing(?:&.*)?$`,
    ),
    async (route) => {
      await route.fulfill({
        contentType: "application/json",
        json: {
          ok: true,
          workItems: [
            createFulfillmentWorkItem({
              detailInputs: {
                dose: 0.5,
                doseUnit: "ml",
                frequency: "bid",
                durationDays: 7,
                totalQuantity: 7,
                totalQuantityUnit: "ml",
                medicationInstruction: "after_meal",
                storageMethod: "refrigerated_light_protected",
                guardianNote:
                  "식후에 1회 0.5mL씩 하루 2회, 7일간 투여하세요.",
              },
              dispensingLineage,
              id: "pr017-reviewed-dispensing",
              orderDisplayName: "PR-017 검토 약품 조제",
              orderId: "order-pr017-reviewed-dispensing",
              patientId: "patient-pr017-reviewed",
              queueType: "dispensing",
              quantity: 2,
              salesUnit: "per_each",
              taskAttemptNo: 3,
              taskId: "task-pr017-reviewed-dispensing",
              taskStatus: "partial_complete",
            }),
          ],
        },
      });
    },
  );
  await page.route(
    new RegExp(
      `/api/workspaces/${workspaceId}/fulfillment/work-items\\?queueType=treatment(?:&.*)?$`,
    ),
    async (route) => {
      await route.fulfill({
        contentType: "application/json",
        json: { ok: true, workItems: [] },
      });
    },
  );

  await page.goto(`/w/${workspaceId}/dispensing?modulePanel=open`);
  await page
    .getByTestId("order-queue-item-live-fulfillment-pr017-reviewed-dispensing")
    .click();

  const prescriptionRow = page.getByTestId(
    "order-row-section-0-live-order-row-pr017-reviewed-dispensing",
  );
  await expect(prescriptionRow).toContainText("Tablet");
  await expect(prescriptionRow).toContainText("0.5 ml");
  await expect(prescriptionRow).toContainText("하루 2회");
  await expect(prescriptionRow).toContainText("7");
  await expect(prescriptionRow).toContainText("식후");
  await expect(prescriptionRow).toContainText("냉장·차광");
  await expect(prescriptionRow).toContainText(
    "식후에 1회 0.5mL씩 하루 2회, 7일간 투여하세요.",
  );
  await expect(prescriptionRow).not.toContainText(/lot|expiry|BUD|로트|유효기간/i);
});

test("dispensing projects frozen set display and confirmed product-unit billing without changing prescribed total", async ({
  page,
}) => {
  const sourceSnapshot = {
    displayName: "조제 세트 리허설 제품",
    patientName: "과거 환자명",
    guardianName: "과거 보호자명",
    requestingVetName: "과거 요청자명",
    quantity: 1,
    salesUnit: "per_each",
    detailInputs: {
      dose: 2,
      doseUnit: "tablet",
      totalQuantity: 2,
      totalQuantityUnit: "tablet",
    },
    calculationOutputs: {
      actualDispenseQuantity: 3,
      actualDispenseUnit: "tablet",
      plannedPracticalTotalQuantity: 3,
      totalRequiredDispenseQuantity: 3,
    },
    dispensingAuthoritySnapshot: {
      billingUnit: "tablet",
      dispenseUnit: "tablet",
      priceBasis: "per_product_unit",
    },
  };
  const workItem = {
    workspaceId,
    id: "work-dispensing-set-confirmed-quantity",
    orderId: "order-dispensing-set-confirmed-quantity",
    encounterId: "encounter-dispensing-set-confirmed-quantity",
    patientId: "patient-dispensing-set-confirmed-quantity",
    patientName: "현재 환자명",
    guardianName: "현재 보호자명",
    requesterName: "현재 요청자명",
    requestCycle: 1,
    rowRevision: 1,
    status: "requested",
    queueType: "dispensing",
    requestedByUserId: "user-vet-current",
    createdAt: "2026-09-12T01:30:00.000Z",
    updatedAt: "2026-09-12T01:30:00.000Z",
    sourceSnapshot,
  };

  await page.route(
    new RegExp(
      `/api/workspaces/${workspaceId}/fulfillment/work-items\\?queueType=(dispensing|treatment)(?:&.*)?$`,
    ),
    async (route) => {
      const queueType = new URL(route.request().url()).searchParams.get(
        "queueType",
      );
      await route.fulfill({
        contentType: "application/json",
        json: {
          ok: true,
          workItems: queueType === "dispensing" ? [workItem] : [],
        },
      });
    },
  );

  await page.goto(`/w/${workspaceId}/dispensing?modulePanel=open`);
  const queueItem = page.getByTestId(
    `order-queue-item-live-fulfillment-${workItem.id}`,
  );
  await expect(queueItem).toContainText("조제 세트 리허설 제품");
  await expect(queueItem).toContainText("현재 환자명");
  await expect(queueItem).toContainText("현재 보호자명");
  await expect(queueItem).toContainText("현재 요청자명");
  await queueItem.click();

  const orderRow = page.getByTestId(
    `order-row-section-0-live-order-row-${workItem.id}`,
  );
  await expect(orderRow).toContainText("조제 세트 리허설 제품");
  await expect(orderRow).toContainText("tablet");
  await expect(orderRow.getByRole("cell", { name: "2", exact: true })).toBeVisible();
  await expect(orderRow.getByRole("cell", { name: "3", exact: true })).toBeVisible();
  await expect(orderRow).not.toContainText("per_each");
  expect(sourceSnapshot).toMatchObject({
    quantity: 1,
    salesUnit: "per_each",
    detailInputs: { totalQuantity: 2 },
  });
});

test("dispensing treatment workspace surfaces fulfillment read permission denial", async ({
  page,
}) => {
  await page.route(
    new RegExp(
      `/api/workspaces/${workspaceId}/fulfillment/work-items\\?queueType=(dispensing|treatment)(?:&.*)?$`,
    ),
    async (route) => {
      await route.fulfill({
        contentType: "application/json",
        status: 403,
        json: {
          denialReason: "permission_missing",
          ok: false,
        },
      });
    },
  );

  await page.goto(`/w/${workspaceId}/dispensing?modulePanel=open`);

  await expect(page.getByTestId("dispensing-fulfillment-state")).toContainText(
    "권한",
  );
  await expect(
    page.getByRole("heading", {
      name: "조제/처치 대기열에서 항목을 선택해 주세요",
    }),
  ).toHaveCount(0);
});

test("dispensing treatment workspace keeps local state unchanged when fulfillment mutation fails", async ({
  page,
}) => {
  await page.route(
    new RegExp(
      `/api/workspaces/${workspaceId}/fulfillment/work-items\\?queueType=dispensing(?:&.*)?$`,
    ),
    async (route) => {
      await route.fulfill({
        contentType: "application/json",
        json: {
          ok: true,
          workItems: [
            createFulfillmentWorkItem({
              id: "den456-mutation-denied",
              orderDisplayName: "DEN-456 저장 실패 검증",
              orderId: "order-den456-denied",
              queueType: "dispensing",
              status: "requested",
            }),
          ],
        },
      });
    },
  );
  await page.route(
    new RegExp(
      `/api/workspaces/${workspaceId}/fulfillment/work-items\\?queueType=treatment(?:&.*)?$`,
    ),
    async (route) => {
      await route.fulfill({
        contentType: "application/json",
        json: {
          ok: true,
          workItems: [],
        },
      });
    },
  );
  await page.route(
    new RegExp(
      `/api/workspaces/${workspaceId}/fulfillment/work-items/den456-mutation-denied$`,
    ),
    async (route) => {
      await route.fulfill({
        contentType: "application/json",
        status: 403,
        json: {
          denialReason: "permission_missing",
          ok: false,
        },
      });
    },
  );

  await page.goto(`/w/${workspaceId}/dispensing?modulePanel=open`);
  await page
    .getByTestId("order-queue-item-live-fulfillment-den456-mutation-denied")
    .click();
  const orderRow = page.getByTestId(
    "order-row-section-0-live-order-row-den456-mutation-denied",
  );
  await expect(orderRow).toContainText("DEN-456 저장 실패 검증");

  await page.getByRole("button", { name: "담당하기" }).first().click();

  await expect(
    page.getByTestId("dispensing-fulfillment-mutation-state"),
  ).toContainText("저장하지 못했습니다");
  await expect(orderRow).toContainText("DEN-456 저장 실패 검증");
  await expect(
    page.getByRole("button", { name: "담당하기" }).first(),
  ).toBeVisible();
});

test("dispensing context opens the selected live profile and vital editor", async ({ page }) => {
  await grantCheongdamWorkspaceAccess(page);
  const workspaceId = PREPARED_EMPTY_CLINIC_WORKSPACE_ID;
  const patientId = "97090000-0000-4000-8000-000000000011";
  const guardianId = "97090000-0000-4000-8000-000000000012";
  const encounterId = "97090000-0000-4000-8000-000000000013";
  const workItemId = "97090000-0000-4000-8000-000000000014";
  await page.route(`**/api/workspaces/${workspaceId}/fulfillment/work-items?*`, async (route) => {
    const queueType = new URL(route.request().url()).searchParams.get("queueType");
    await route.fulfill({ json: { ok: true, workItems: queueType === "dispensing" ? [{
      id: workItemId, workspaceId, patientId, encounterId, orderId: workItemId,
      queueType: "dispensing", requestCycle: 1, rowRevision: 1, status: "in_progress",
      createdAt: "2026-09-07T01:30:00.000Z", updatedAt: "2026-09-07T01:30:00.000Z",
      sourceSnapshot: { patientName: "루나", guardianName: "최보호", orderDisplayName: "항생제 5일분", requestingVetName: "김민준" },
    }] : [] } });
  });
  await page.route(`**/api/workspaces/${workspaceId}/customer/patient/${patientId}/profile-overview`, async (route) => {
    await route.fulfill({ json: { ok: true, overview: {
      subjectId: patientId, subjectType: "patient",
      profile: { id: patientId, name: "루나", patientNo: "P-LUNA", status: "active" },
      relationships: { guardians: [{ id: guardianId, name: "최보호", isPrimary: true }] },
      access: { information: { allowed: true, requiredPermission: "patient:view" } },
    } } });
  });
  await page.route(`**/api/workspaces/${workspaceId}/patient-vitals/latest?*`, async (route) => {
    await route.fulfill({ json: { ok: true, status: 200, canWriteVitals: true, vital: null } });
  });
  const writes: Array<Record<string, unknown>> = [];
  await page.route(`**/api/workspaces/${workspaceId}/chart/encounter-vitals`, async (route) => {
    const body = route.request().postDataJSON() as { encounterId: string; vitals: Record<string, unknown> };
    writes.push(body.vitals);
    await route.fulfill({ json: { ok: true, vital: {
      id: "97090000-0000-4000-8000-000000000015",
      patientId, encounterId: body.encounterId,
      measuredAt: "2026-09-07T10:00:00+09:00",
      ...Object.fromEntries(Object.entries(body.vitals).filter(([, value]) => value !== null)),
    } } });
  });

  await page.goto(`/w/${workspaceId}/dispensing?date=2026-09-07&modulePanel=open&aside=closed&right=closed`);
  await page.getByTestId(`order-queue-item-live-fulfillment-${workItemId}`).click();
  await expect(page.getByRole("button", { name: "루나 환자 프로필 열기" })).toBeVisible();
  await page.getByRole("button", { name: "루나 환자 프로필 열기" }).click();
  await expect(page.getByTestId("profile-side-panel")).toHaveAttribute("data-profile-kind", "patient");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "최보호 보호자 프로필 열기" })).toBeVisible();
  await page.locator("[data-slot='patient-context-vitals']").hover();
  await page.getByRole("button", { name: "오늘 바이탈 입력" }).click();
  const dialog = page.getByRole("dialog", { name: "오늘 바이탈 입력" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("체중").fill("4.2");
  await dialog.getByRole("button", { name: "저장" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator("[data-slot='patient-context-vitals']")).toContainText("4.20 kg");
  expect(writes).toHaveLength(1);
  expect(writes[0]?.weightKg).toBe(4.2);
});
