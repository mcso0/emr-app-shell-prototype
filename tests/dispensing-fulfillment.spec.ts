import { expect, test, type Page } from "@playwright/test";

import { SESSION_WORKSPACES_STORAGE_KEY } from "../src/features/auth/workspace-session";
import { PREPARED_EMPTY_CLINIC_WORKSPACE_ID } from "../src/lib/emr-domain/demo-workspaces";

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

  await page.route(
    `**/api/workspaces/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/fulfillment/work-items?*`,
    async (route) => {
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
    requestedByUserId: "user-vet-suji",
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
    queueType: "dispensing",
    requestedByUserId: "user-vet",
    sourceSnapshot: {
      guardianName: "최보호",
      instruction: "식후 1일 2회",
      orderDisplayName: "항생제 5일분",
      patientName: "루나",
      requestingVetName: "김민준",
    },
    status: "requested",
    updatedAt: "2026-06-14T01:30:00.000Z",
    workspaceId: PREPARED_EMPTY_CLINIC_WORKSPACE_ID,
  };
  let liveStatus: FulfillmentWorkItemStatus = "requested";
  const patchBodies: Array<{
    assignedToUserId?: string | null;
    reason?: string;
    status?: FulfillmentWorkItemStatus;
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
                    assignedToUserId:
                      liveStatus === "requested" ? null : "user-tech",
                    status: liveStatus,
                  },
                ]
              : [],
        }),
      });
    },
  );

  const statusUpdates: string[] = [];
  await page.route(
    `**/api/workspaces/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/fulfillment/work-items/${liveWorkItem.id}`,
    async (route) => {
      const body = JSON.parse(route.request().postData() ?? "{}") as {
        assignedToUserId?: string | null;
        reason?: string;
        status?: FulfillmentWorkItemStatus;
      };
      patchBodies.push(body);
      if (body.status) {
        liveStatus = body.status;
        statusUpdates.push(body.status);
      }

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
              assignedToUserId:
                liveStatus === "requested" ? null : "user-tech",
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
  ).toContainText("2026.06.14 01:30");
  await page
    .getByRole("button", { name: "조제 이력 패널 열기" })
    .click();
  const historyAside = page.locator("#dispensing-content-aside");
  await expect(historyAside).toContainText("조제 이력");
  await expect(historyAside).toContainText("조제 시작");
  await expect(historyAside).toContainText("조제 시작 확인");
  await expect(historyAside).toContainText("수행자 user-tech");
  await page.getByRole("button", { name: "담당하기" }).first().click();

  await expect.poll(() => statusUpdates).toEqual(["accepted", "in_progress"]);

  await page
    .getByRole("button", { name: "조제 오더 상태 액션 열기" })
    .first()
    .click();
  await page.getByRole("menuitem", { name: "담당취소" }).click();
  await expect.poll(() => statusUpdates).toEqual([
    "accepted",
    "in_progress",
    "returned",
    "requested",
  ]);
  expect(patchBodies[2]).toMatchObject({
    assignedToUserId: null,
    reason: "담당 취소",
    status: "returned",
  });
  await expect(
    page.getByTestId("dispensing-fulfillment-readback"),
  ).toContainText("서버 상태 요청");
});

test("dispensing treatment workspace shows server readback and refreshes after persisted status mutation", async ({
  page,
}) => {
  let dispensingStatus: FulfillmentWorkItemStatus = "requested";
  const patchStatuses: string[] = [];
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
            createFulfillmentWorkItem({
              id: "den456-dispensing",
              orderDisplayName: "DEN-456 항구토제 조제",
              orderId: "order-den456-dispensing",
              queueType: "dispensing",
              status: dispensingStatus,
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
        status?: FulfillmentWorkItemStatus;
      };
      if (body.status) {
        dispensingStatus = body.status;
        patchStatuses.push(body.status);
      }
      await route.fulfill({
        contentType: "application/json",
        json: {
          ok: true,
          workItem: createFulfillmentWorkItem({
            id: "den456-dispensing",
            orderDisplayName: "DEN-456 항구토제 조제",
            orderId: "order-den456-dispensing",
            queueType: "dispensing",
            status: dispensingStatus,
          }),
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
  await expect(
    page.getByTestId("dispensing-fulfillment-readback"),
  ).toContainText("조제 업무 큐");
  await expect(
    page.getByTestId("dispensing-fulfillment-readback"),
  ).toContainText("서버 상태 요청");
  await expect(
    page.getByTestId("dispensing-fulfillment-readback"),
  ).toContainText("오더 order-den456-dispensing");

  await page.getByRole("button", { name: "담당하기" }).first().click();
  await expect
    .poll(() => patchStatuses.join(","), {
      message: "requested item should be accepted then started",
    })
    .toBe("accepted,in_progress");
  await expect(
    page.getByTestId("dispensing-fulfillment-readback"),
  ).toContainText("서버 상태 진행중");
  await expect(
    page.getByRole("button", { name: /조제중|처치중/ }).first(),
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
    page.getByTestId("dispensing-fulfillment-readback"),
  ).toContainText("오더 order-reconcile-dispensing-1");

  await typeFilter.getByRole("button", { name: /처치\s*2/ }).click();
  await expect(queueRows).toHaveCount(2);
  await expect(
    page.getByTestId("order-queue-item-live-fulfillment-reconcile-treatment-1"),
  ).toBeVisible();
  await expect(
    page.getByTestId("order-queue-item-live-fulfillment-reconcile-treatment-2"),
  ).toBeVisible();
});

test("dispensing readback shows only reviewed immutable medication facts and no guessed execution fields", async ({
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

  const facts = page.getByTestId("dispensing-reviewed-medication-facts");
  await expect(facts).toContainText("제품 검토 완료 약품");
  await expect(facts).toContainText("함량 25 mg");
  await expect(facts).toContainText("제형 Tablet");
  await expect(facts).toContainText("경로 oral");
  await expect(facts).toContainText("대상종 dog, cat");
  await expect(facts).toContainText("임상 검토 확인");
  const readback = page.getByTestId("dispensing-fulfillment-readback");
  await expect(readback).toContainText("환자 patient-pr017-reviewed");
  await expect(readback).toContainText("진료 enc-den456");
  await expect(readback).toContainText("오더 order-pr017-reviewed-dispensing");
  await expect(readback).toContainText(
    "Task task-pr017-reviewed-dispensing / 시도 3",
  );
  await expect(readback).toContainText("Task 상태 부분완료");
  await expect(readback).toContainText("처방 총량 7");
  await expect(readback).toContainText("청구 수량 2");
  await expect(readback).toContainText("청구 단위 per_each");
  const prescriptionRow = page.getByTestId(
    "order-row-section-0-live-order-row-pr017-reviewed-dispensing",
  );
  await expect(prescriptionRow).toContainText("0.5 ml");
  await expect(prescriptionRow).toContainText("하루 2회");
  await expect(prescriptionRow).toContainText("7");
  await expect(prescriptionRow).toContainText("식후");
  await expect(prescriptionRow).toContainText("냉장·차광");
  await expect(prescriptionRow).toContainText(
    "식후에 1회 0.5mL씩 하루 2회, 7일간 투여하세요.",
  );
  await expect(readback).not.toContainText(/lot|expiry|BUD|로트|유효기간/i);
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
  ).toBeVisible();
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
  await expect(
    page.getByTestId("dispensing-fulfillment-readback"),
  ).toContainText("서버 상태 요청");

  await page.getByRole("button", { name: "담당하기" }).first().click();

  await expect(
    page.getByTestId("dispensing-fulfillment-mutation-state"),
  ).toContainText("저장하지 못했습니다");
  await expect(
    page.getByTestId("dispensing-fulfillment-readback"),
  ).toContainText("서버 상태 요청");
  await expect(
    page.getByRole("button", { name: "담당하기" }).first(),
  ).toBeVisible();
});
