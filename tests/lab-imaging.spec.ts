import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

import { evaluateLabProfileValue } from "../src/features/lab-imaging/result-profile-contract";
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
        })
      );
    },
    [SESSION_WORKSPACES_STORAGE_KEY, PREPARED_EMPTY_CLINIC_WORKSPACE_ID]
  );
}

function waitForFulfillmentQueue(
  page: Page,
  queueType: "lab" | "imaging",
) {
  return page.waitForResponse((response) => {
    const url = new URL(response.url());
    return (
      response.ok() &&
      url.pathname.endsWith("/fulfillment/work-items") &&
      url.searchParams.get("queueType") === queueType &&
      url.searchParams.get("date") === "2026-05-01"
    );
  });
}

test("live receipt reopens with its chrome and known empty list without another queue read", async ({ page }) => {
  await grantCheongdamWorkspaceAccess(page);
  await page.setViewportSize({ width: 1920, height: 1080 });
  let queueReads = 0;
  const workItem = {
    id: "receipt-loading-work", workspaceId: PREPARED_EMPTY_CLINIC_WORKSPACE_ID,
    encounterId: "receipt-loading-encounter", orderId: "receipt-loading-order",
    patientId: "receipt-loading-patient", patientName: "샘플 환자", guardianName: "샘플 보호자",
    queueType: "lab", status: "requested", rowRevision: 1,
    assignedToUserId: null, requestedByUserId: "user-vet", requesterName: "샘플 수의사",
    createdAt: "2026-06-14T01:25:00.000Z", updatedAt: "2026-06-14T01:25:00.000Z",
    sourceSnapshot: { inHospitalOrderName: "샘플 CBC 검사", serviceItemId: "sample-cbc" },
  };
  await page.route(`**/api/workspaces/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/fulfillment/work-items**`, async route => {
    queueReads += 1;
    await route.fulfill({ json: { ok: true, workItems: [workItem] } });
  });
  await page.goto(`/w/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/lab?date=2026-06-14&labResultId=live-lab-${workItem.id}&encounterId=${workItem.encounterId}&modulePanel=closed&aside=closed&right=closed`);
  const trigger = page.getByRole("button", { name: "장비 검사 수신함", exact: true });
  await expect(trigger).toBeVisible();
  await page.waitForLoadState("networkidle");
  const initialReads = queueReads;
  const receipt = page.getByTestId("lab-receipt-panel");
  const emptyMessage = "현재 오더와 연결된 장비결과가 없습니다.";
  for (let cycle = 0; cycle < 2; cycle += 1) {
    await trigger.click();
    await expect(receipt.getByRole("heading", { name: "장비 검사 수신함", exact: true })).toBeVisible();
    await expect(receipt.getByRole("button", { name: "장비 검사 수신함 검색", exact: true })).toBeVisible();
    await expect(receipt.getByText(emptyMessage, { exact: true })).toBeVisible();
    await expect(receipt.locator('[data-testid="emr-queue-loading-state"]')).toHaveCount(0);
    expect(queueReads).toBe(initialReads);
    const receiptNode = await receipt.elementHandle();
    await page.setViewportSize({ width: 320, height: 900 });
    await page.getByRole("button", { name: "본문 보기", exact: true }).click();
    await expect(receipt).toBeHidden();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await trigger.click();
    await expect(receipt.getByText(emptyMessage, { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/right=open/);
    await page.setViewportSize({ width: 1920, height: 1080 });
    expect(await receiptNode!.evaluate((element) => element.isConnected)).toBe(true);
    expect(queueReads).toBe(initialReads);
    await receipt.getByRole("button", { name: "장비 검사 수신함 접기", exact: true }).click();
    await expect(receipt).toBeHidden();
  }
  expect(queueReads).toBe(initialReads);
});

test("lab no-work empty state hides history aside", async ({ page }) => {
  await grantCheongdamWorkspaceAccess(page);

  await page.route(
    `**/api/workspaces/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/fulfillment/work-items**`,
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
    }
  );

  await page.goto(
    `/w/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/lab?modulePanel=open&aside=history&right=closed&labResultId=live-lab-stale&encounterId=stale-encounter`
  );

  await expect(page.locator("#lab-content-aside")).toHaveCount(0);
  await expect(page.locator('section[data-surface="content"]')).toBeVisible();
  await expect(
    page
      .getByTestId("workspace-main-content")
      .getByRole("heading", { name: "검사 업무가 없습니다" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "임상병리검사 결과지" })).toHaveCount(0);
});

test("imaging no-work empty state hides history aside", async ({ page }) => {
  await grantCheongdamWorkspaceAccess(page);

  await page.route(
    `**/api/workspaces/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/fulfillment/work-items**`,
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
    }
  );

  await page.goto(
    `/w/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/imaging?modulePanel=open&aside=history&right=closed&imagingStudyId=live-imaging-stale&encounterId=stale-encounter`
  );

  await expect(page.locator("#imaging-content-aside")).toHaveCount(0);
  await expect(page.locator('section[data-surface="content"]')).toBeVisible();
  await expect(
    page
      .getByTestId("workspace-main-content")
      .getByRole("heading", { name: "영상 업무가 없습니다" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "영상검사 Order 상세" })).toHaveCount(0);
});

test("lab workspace renders result input, equipment receipts, and attachments", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const queueLoaded = waitForFulfillmentQueue(page, "lab");
  await page.goto("/w/clair-demo/lab?modulePanel=open");
  await queueLoaded;

  const sidePanel = page.locator("aside").first();
  await expect(sidePanel.getByText("임상병리검사")).toBeVisible();
  await expect(sidePanel.getByRole("group", { name: "임상병리검사 목록 보기" })).toHaveCount(0);
  await expect(sidePanel.getByRole("button", { name: "26.05.01(금) 날짜 선택" })).toBeVisible();
  await expect(sidePanel.getByText("검사 대기열")).toBeVisible();
  await expect(sidePanel.getByRole("button", { name: "결과입력 접기" })).toHaveAttribute("aria-expanded", "true");
  await expect(sidePanel.getByTestId("lab-queue-item-lab-result-coco-cbc")).toContainText("코코");
  await expect(sidePanel.getByTestId("lab-queue-item-lab-result-coco-cbc")).toContainText("예약");
  await expect(sidePanel.getByTestId("lab-queue-item-lab-result-coco-cbc")).toContainText("CBC 검사");
  await sidePanel.getByTestId("lab-queue-item-lab-result-coco-cbc").click();
  await expect(page).toHaveURL(/labResultId=lab-result-coco-cbc/);
  await expect(sidePanel.getByText("검사 · CBC 검사")).toHaveCount(0);
  await sidePanel.getByRole("button", { name: "결과입력 접기" }).click();
  await expect(sidePanel.getByRole("button", { name: "결과입력 펼치기" })).toHaveAttribute("aria-expanded", "false");
  await expect(sidePanel.getByTestId("lab-queue-item-lab-result-coco-cbc")).toHaveCount(0);
  await sidePanel.getByRole("button", { name: "결과입력 펼치기" }).click();
  await expect(sidePanel.getByTestId("lab-queue-item-lab-result-coco-cbc")).toBeVisible();
  await expect(sidePanel.getByText("차트별 검사")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "임상병리검사 이력 패널 접기" })).toBeVisible();
  await expect(page.locator("#lab-content-aside")).toContainText("임상검사 이력");
  await page.getByRole("button", { name: "임상병리검사 이력 패널 접기" }).hover();
  await expect(page.locator("[data-slot='tooltip-content']").filter({ hasText: "임상병리검사 이력" })).toBeVisible();
  await expect(page.locator("#lab-content-aside")).toContainText("26.05.01");
  const labTitleBar = page.locator("[data-slot='instruction-header-title-bar']");
  await expect(labTitleBar.getByRole("heading", { name: "임상병리검사 결과지" })).toBeVisible();
  await expect(labTitleBar.getByRole("heading", { name: "임상병리검사 결과지" })).toHaveCSS("font-size", "16px");
  await expect(page.getByText("요청 일시")).toBeVisible();
  await expect(page.getByTestId("lab-result-status-label")).toHaveText("입력");
  await expect(page.getByText("CBC 검사").first()).toBeVisible();
  await expect(page.getByRole("group", { name: "검사 결과 필터" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "HCT 결과값" })).toHaveValue("27");
  await expect(page.getByRole("columnheader", { name: "정상범위" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "담당자" })).toBeVisible();
  await expect(page.getByRole("table", { name: "임상병리 검사 결과 입력" }).getByRole("columnheader")).toHaveCount(7);
  await expect(page.getByRole("button", { name: "수정이력" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "차트에 복사하기" })).toHaveCount(0);
  await expect(page.getByText("■ 혈구 검사")).toHaveCount(0);
  const wbcRow = page.getByRole("row").filter({ has: page.getByRole("textbox", { name: "WBC 결과값", exact: true }) });
  await expect(wbcRow.getByRole("textbox", { name: "WBC 결과값", exact: true })).toHaveValue("18.2");
  await expect(wbcRow).toContainText(/K\/uL.*정상.*송하/);
  const hctRow = page.getByRole("row").filter({ has: page.getByRole("textbox", { name: "HCT 결과값", exact: true }) });
  await expect(hctRow).toContainText(/%.*30.*45.*낮음/);
  await hctRow.getByRole("button", { name: "HCT 검사 소견 펼치기", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "검사 소견", exact: true })).toHaveCSS("height", "76px");
  await expect(page.getByTestId("lab-result-detail-lab-row-coco-hct").getByText("첨부 자료가 없습니다.", { exact: true })).toBeVisible();
  await expect(hctRow.getByRole("button", { name: "HCT 검사 소견 접기", exact: true })).toHaveAttribute("aria-expanded", "true");
  await page.getByRole("textbox", { name: "HCT 결과값" }).fill("42");
  await expect(hctRow).toContainText(/%.*30.*45.*정상/);
  await page.getByRole("textbox", { name: "HCT 결과값" }).fill("27122");
  await expect(hctRow).toContainText(/%.*30.*45.*높음/);
  await expect(page.getByText("미달")).toHaveCount(0);
  await expect(page.getByRole("columnheader", { name: "이전결과" })).toHaveCount(0);
  await expect(page.getByRole("columnheader", { name: "장비값" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "검사결과 종합소견" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "검사결과 종합소견" })).toBeVisible();
  await expect(page.getByRole("button", { name: "코멘트 저장" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "첨부자료 추가" })).toBeVisible();
  await expect(page.getByText("coco-cbc-260501.pdf")).toBeVisible();
  await expect(page.getByText("cbc-smear-preview.png")).toBeVisible();
  await expect(page.getByText("처치 지시서")).toHaveCount(0);
});

test("Cheongdam lab workspace renders live fulfillment rows without legacy result fixtures", async ({
  page,
}) => {
  await grantCheongdamWorkspaceAccess(page);

  const liveWorkItem = {
    assignedToUserId: null,
    createdAt: "2026-06-14T01:20:00.000Z",
    encounterId: "encounter-cheongdam-live-lab-001",
    guardianName: "정보호",
    id: "work-cheongdam-lab-001",
    orderId: "order-cheongdam-lab-001",
    patientName: "모카",
    queueType: "lab",
    requestedByUserId: "user-vet",
    requesterName: "김민준",
    sourceSnapshot: {
      detail: { breed: "푸들", age: "3세" },
      instruction: "CBC 우선 확인",
      effectiveDisplayName: "CBC 검사",
      serviceItemId: "svc-live-cbc",
    },
    status: "requested",
    updatedAt: "2026-06-14T01:20:00.000Z",
    workspaceId: PREPARED_EMPTY_CLINIC_WORKSPACE_ID,
  };

  await page.route(
    `**/api/workspaces/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/fulfillment/work-items**`,
    async (route) => {
      const url = new URL(route.request().url());

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 200,
          enforcedBy: "fulfillment-work-item-persistence",
          workItems: url.searchParams.get("queueType") === "lab" ? [liveWorkItem] : [],
        }),
      });
    }
  );

  await page.goto(`/w/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/lab?modulePanel=open&aside=history`);
  const historyDialog = page.getByRole("complementary", { name: "임상병리검사 이력", exact: true });
  await expect(historyDialog).toBeVisible();
  await expect(page.locator("#lab-content-aside")).toContainText("CBC 검사");
  await historyDialog.locator("[data-workspace-history-collapse]").focus();
  await page.keyboard.press("Escape");
  await expect(historyDialog).toBeHidden();

  const sidePanel = page.locator("aside").first();
  await expect(sidePanel.getByTestId(`lab-queue-item-live-lab-${liveWorkItem.id}`)).toContainText("모카");
  await expect(sidePanel.getByTestId(`lab-queue-item-live-lab-${liveWorkItem.id}`)).toContainText("CBC 검사");
  await expect(sidePanel.getByTestId(`lab-queue-item-live-lab-${liveWorkItem.id}`)).toContainText("김민준");
  await expect(sidePanel.getByTestId(`lab-queue-item-live-lab-${liveWorkItem.id}`)).toContainText("10:20");
  await expect(sidePanel.getByTestId("lab-queue-item-lab-result-coco-cbc")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "임상병리검사 결과지" })).toBeVisible();
  await expect(page.getByText("모카").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "모카 환자 프로필 열기" })).toHaveCount(0);

  await sidePanel.getByTestId(`lab-queue-item-live-lab-${liveWorkItem.id}`).click();
  await expect.poll(() => {
    const url = new URL(page.url());
    return {
      date: url.searchParams.get("date"),
      encounterId: url.searchParams.get("encounterId"),
      labResultId: url.searchParams.get("labResultId"),
    };
  }).toMatchObject({
    date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    encounterId: liveWorkItem.encounterId,
    labResultId: `live-lab-${liveWorkItem.id}`,
  });

  await sidePanel.getByRole("button", { name: "이전 날짜" }).click();
  await expect.poll(() => {
    const url = new URL(page.url());
    return {
      date: url.searchParams.get("date"),
      encounterId: url.searchParams.get("encounterId"),
      labResultId: url.searchParams.get("labResultId"),
    };
  }).toEqual({
    date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    encounterId: null,
    labResultId: null,
  });
});

test("lab workspace renders shared empty state for true-empty live result rows", async ({
  page,
}) => {
  await grantCheongdamWorkspaceAccess(page);

  const liveWorkItem = {
    assignedToUserId: null,
    createdAt: "2026-06-14T01:20:00.000Z",
    encounterId: "encounter-cheongdam-lab-empty",
    id: "work-cheongdam-lab-empty",
    orderId: "order-cheongdam-lab-empty",
    queueType: "lab",
    requestedByUserId: "user-vet",
    sourceSnapshot: {
      detail: { breed: "푸들", age: "3세" },
      guardianName: "정보호",
      instruction: "결과지 연결 대기",
      orderDisplayName: "CBC 검사",
      patientName: "모카",
      requestingVetName: "김민준",
      serviceItemId: "svc-live-empty-cbc",
    },
    status: "requested",
    updatedAt: "2026-06-14T01:20:00.000Z",
    workspaceId: PREPARED_EMPTY_CLINIC_WORKSPACE_ID,
  };
  let catalogRequestCount = 0;

  await page.route(
    `**/api/workspaces/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/fulfillment/work-items**`,
    async (route) => {
      const url = new URL(route.request().url());

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 200,
          enforcedBy: "fulfillment-work-item-persistence",
          workItems: url.searchParams.get("queueType") === "lab" ? [liveWorkItem] : [],
        }),
      });
    }
  );
  await page.route(
    `**/api/workspaces/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/lab-imaging/result-entries?*`,
    async (route) => {
      catalogRequestCount += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 200,
          savedResult: null,
        }),
      });
    }
  );

  await page.goto(
    `/w/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/lab?modulePanel=open&aside=closed&labResultId=live-lab-${liveWorkItem.id}`
  );

  await expect(page.getByRole("heading", { name: "임상병리검사 결과지" })).toBeVisible();
  await expect(page.getByText("모카").first()).toBeVisible();
  await expect(page.getByTestId("lab-result-catalog-status")).toContainText(
    "연결된 결과지 항목이 없습니다.",
  );
  await expect(page.getByTestId("lab-result-catalog-status")).not.toContainText(
    /권한|불러오지 못했습니다/,
  );
  await expect(page.getByTestId("lab-result-catalog-retry-button")).toHaveCount(0);
  expect(catalogRequestCount).toBeGreaterThan(0);

  const resultInputTable = page
    .locator('[data-slot="lab-result-scroll-area"] table')
    .filter({ has: page.getByRole("columnheader", { name: "결과값" }) });
  await expect(resultInputTable).toHaveCount(1);
  const emptyState = resultInputTable.locator('tbody section[data-surface="table"]');
  await expect(emptyState).toHaveAttribute("data-kind", "upstream-pending");
  await expect(emptyState).toContainText("검사 결과 항목이 없습니다");
  await expect(emptyState).toContainText("결과지 항목이 연결되면 입력할 수 있습니다.");
  await expect(page.getByText("표시할 검사 결과가 없습니다.")).toHaveCount(0);
  await emptyState.screenshot({
    path: ".omo/evidence/empty-state-screen-adoption/browser/t4-lab-true-empty.png",
  });
});

test("CBC V2 actual persisted results load, preserve blank, submit typed states and reload", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await grantCheongdamWorkspaceAccess(page);
  const workspaceId = PREPARED_EMPTY_CLINIC_WORKSPACE_ID;
  const profiles = JSON.parse(readFileSync("docs/work/clinical-master/order-execution-defaults/artifacts/oed-lab-04/cbc-runtime.non-applied.v1.json", "utf8")).profiles;
  const profile = profiles.find((p: { profileKey: string }) => p.profileKey === "cm.lab-profile.clair-demo-cbc.dog");
  const rule = profile.rules.find((r: { code: string }) => r.code === "WBC");
  const wi = { id: "97050000-0000-4000-8000-000000000011", orderId: "97050000-0000-4000-8000-000000000012",
    encounterId: "97050000-0000-4000-8000-000000000013", workspaceId, queueType: "lab", status: "in_progress", requestCycle: 1, rowRevision: 1,
    sourceSnapshot: { orderDisplayName: "합성 CBC WBC", patientName: "합성 검증 환자", detail: { species: "dog" } } };
  const result = { ok: true, status: 200, workspaceId, orderId: wi.orderId, encounterId: wi.encounterId, workItemId: wi.id,
    resultId: "lab-result-persisted-cbc", entryWriteRevision: 0,
    resultDefinitionSnapshot: { schemaVersion: 2, resultProfile: { profileKey: profile.profileKey, revision: 1, clinicalUseAllowed: false,
      integrationStatus: "not_integrated", device: { name: "직접 등록한 합성 CBC 수기" } } },
    rows: [{ id: "frozen-wbc-row", analyteName: "WBC", value: null as string | null, unit: rule.unit, decimalScale: rule.decimalScale,
      resultValueKind: "numeric", judgment: "not_judged", interpretationRule: rule,
      referenceRange: `${rule.referenceInterval.low}–${rule.referenceInterval.high}`, resultState: "not_entered", resultPresence: "value", qualifier: "exact", deviceFlag: null }] };
  let posted: Record<string, unknown> | null = null; let catalogRequests = 0; let retestPosted: Record<string, unknown> | null = null;
  const deviceId = "97050000-0000-4000-8000-000000000021";
  await page.route(`**/api/workspaces/${workspaceId}/lab-imaging/result-profiles**`, route => route.fulfill({ json: { ok: true, configuration: {
    workspaceId, catalogItemId: "catalog-wbc", canConfigure: true, canSelect: false, canRetest: true,
    order: { id: wi.orderId, updatedAt: "2026-09-06T11:00:00Z", confirmationStatus: "confirmed", species: "dog", requiresProfile: true,
      selectedProfileVersionId: profile.id, selectedDeviceId: deviceId }, profiles: [profile],
    devices: [{ id: deviceId, workspace_id: workspaceId, name: "합성 CBC 수기", ...profile.device,
      entry_mode: "manual_entry", integration_status: "not_integrated", active: true, row_revision: 1 }],
    bindings: [{ workspace_id: workspaceId, order_catalog_item_id: "catalog-wbc", species: "dog", device_id: deviceId, profile_version_id: profile.id, row_revision: 1 }],
  } } }));
  await page.route(`**/api/workspaces/${workspaceId}/lab-imaging/retests`, async route => {
    retestPosted = route.request().postDataJSON();
    await route.fulfill({ json: { ok: true, workspaceId, priorOrderId: wi.orderId, encounterId: wi.encounterId,
      orderId: "97050000-0000-4000-8000-000000000022", confirmationStatus: "draft" } });
  });
  await page.route(`**/api/workspaces/${workspaceId}/fulfillment/work-items**`, route => route.fulfill({ json: { ok: true, workItems: [wi] } }));
  await page.route(`**/api/workspaces/${workspaceId}/lab-imaging/result-sheet-catalog**`, route => { catalogRequests++; return route.fulfill({ status: 500, json: { ok: false } }); });
  await page.route(`**/api/workspaces/${workspaceId}/lab-imaging/result-entries**`, async route => {
    if (route.request().method() === "POST") {
      posted = route.request().postDataJSON();
      const row = (posted!.rows as Array<Record<string, unknown>>)[0];
      result.rows[0].value = row.value as string; result.rows[0].qualifier = row.qualifier as string;
      const evaluation = evaluateLabProfileValue(rule, { value: row.value as string | null,
        qualifier: row.qualifier as "exact" | "less_than" | "greater_than", resultState: "value" });
      if (!evaluation.valid) throw new Error(evaluation.error);
      result.rows[0].resultState = evaluation.state; result.rows[0].judgment = evaluation.judgment;
      result.entryWriteRevision++;
      await route.fulfill({ json: { ok: true, entryWriteRevision: result.entryWriteRevision } });
    } else {
      expect(new URL(route.request().url()).searchParams.get("workItemId")).toBe(wi.id);
      await route.fulfill({ json: result });
    }
  });
  const url = `/w/${workspaceId}/lab?date=2026-09-06&modulePanel=open&aside=closed&labResultId=live-lab-${wi.id}`;
  await page.goto(url);
  await expect(page.getByTestId("lab-frozen-profile")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "임상병리검사 결과지 링크 복사" })).toBeVisible();
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin: new URL(page.url()).origin });
  await page.getByRole("button", { name: "임상병리검사 결과지 링크 복사" }).click();
  const resultLink = new URL(await page.evaluate(() => navigator.clipboard.readText()));
  expect(resultLink.pathname).toBe(`/w/${workspaceId}/lab`);
  expect(resultLink.searchParams.get("labResultId")).toBe(`live-lab-${wi.id}`);
  expect(resultLink.searchParams.get("date")).toBe("2026-09-06");
  await page.goto(resultLink.href);
  await expect(page.getByRole("heading", { name: "임상병리검사 결과지" })).toBeVisible();
  await expect(page.getByLabel("WBC 결과값", { exact: true })).toHaveValue("");
  await expect(page.getByTestId("lab-result-row-frozen-wbc-row")).toContainText("미판정");
  const wbcRow = page.getByTestId("lab-result-row-frozen-wbc-row");
  await expect(wbcRow.locator('[data-column-id="analyteName"]').getByRole("button", { name: "WBC 추가 결과 정보" })).toHaveCount(1);
  await expect(wbcRow.locator('[data-column-id="value"]').getByRole("button")).toHaveCount(0);
  await expect(page.getByLabel("WBC 결과값", { exact: true })).toBeVisible();
  await expect.poll(async () => (await page.getByLabel("WBC 결과값", { exact: true }).boundingBox())?.width).toBeCloseTo(220, 0);
  await page.getByLabel("WBC 결과값", { exact: true }).fill(String(rule.referenceInterval.low));
  await expect(page.getByTestId("lab-result-row-frozen-wbc-row").getByText("정상", { exact: true })).toBeVisible();
  await expect(page.getByTestId("lab-result-row-frozen-wbc-row").getByRole("textbox")).toHaveCount(1);
  await page.getByRole("button", { name: "WBC 추가 결과 정보" }).click();
  await page.getByLabel("WBC 부등호").selectOption("less_than");
  await expect(page.getByTestId("lab-result-row-frozen-wbc-row")).toContainText("미판정");
  await expect(page.getByTestId("lab-result-save-status")).toContainText("저장됨");
  expect(posted).toMatchObject({ resultId: result.resultId, expectedEntryWriteRevision: result.entryWriteRevision - 1,
    rows: [{ rowId: "frozen-wbc-row", qualifier: "less_than", deviceFlag: null, resultState: "value" }] });
  await page.reload();
  await expect(page.getByLabel("WBC 결과값", { exact: true })).toHaveValue(String(rule.referenceInterval.low));
  await page.getByRole("button", { name: "WBC 추가 결과 정보" }).click();
  await expect(page.getByLabel("WBC 부등호")).toHaveValue("less_than");
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("WBC 부등호")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "WBC 추가 결과 정보" })).toBeFocused();
  expect(catalogRequests).toBe(0);
  await page.getByRole("button", { name: "WBC만 재검 요청" }).click();
  const retest = page.getByTestId("lab-atomic-retest-dialog");
  await expect(page.getByRole("button", { name: "재검 오더 초안 만들기" })).toBeDisabled();
  await retest.getByLabel("재검 사유").fill("합성 WBC 단독 확인");
  await retest.getByLabel("재검 검체 결정").selectOption("new_specimen");
  await retest.getByLabel("재검 검체 참조").fill("synthetic-new-edta-002");
  await expect(retest.getByLabel("재검 청구 정책")).toHaveValue("no_charge");
  await retest.getByLabel("재검 프로필").selectOption(`${profile.id}:${deviceId}`);
  await page.getByRole("button", { name: "재검 오더 초안 만들기" }).click();
  await expect(retest.getByRole("link", { name: "차트에서 확인·확정" })).toBeVisible();
  expect(retestPosted).toMatchObject({ resultId: result.resultId, rowId: "frozen-wbc-row", expectedEntryWriteRevision: result.entryWriteRevision,
    specimenDecision: "new_specimen", specimenReference: "synthetic-new-edta-002", billingPolicy: "no_charge", profileVersionId: profile.id, deviceId });
  expect(result.rows[0].value).toBe(String(rule.referenceInterval.low));
});

test("lab workspace shows equipment receipts in the right panel", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/w/clair-demo/lab?modulePanel=open&aside=closed&right=open");

  const receiptPanel = page.getByTestId("lab-receipt-panel");
  const receiptPanelToggle = page.getByRole("button", {
    name: /장비 검사 수신함 새 장비결과 1건/,
  });
  await expect(receiptPanelToggle).toBeVisible();
  await expect(receiptPanelToggle).toContainText("1");
  await expect(page.getByRole("heading", { name: "장비 검사 수신함" })).toBeVisible();
  const receiptPanelCollapse = receiptPanel.getByRole("button", { name: "장비 검사 수신함 접기" });
  await expect(receiptPanelCollapse).toHaveCSS("width", "32px");
  await expect(receiptPanelCollapse).toHaveCSS("height", "32px");
  await expect(receiptPanelCollapse).toHaveCSS("opacity", "0");
  await receiptPanel.hover();
  await expect(receiptPanelCollapse).toHaveCSS("opacity", "1");
  await receiptPanelCollapse.click();
  await expect(receiptPanelToggle).toHaveAttribute("aria-expanded", "false");
  await receiptPanelToggle.click();
  await expect(receiptPanelToggle).toHaveAttribute("aria-expanded", "true");
  await expect(receiptPanel.getByRole("button", { name: "26.05.01(금) 날짜 선택" })).toBeVisible();
  await expect(receiptPanel.getByRole("button", { name: "장비 검사 수신함 검색" })).toBeVisible();
  await expect(page.getByText("장비 수신값과 현재 결과지를 비교합니다.")).toHaveCount(0);
  await expect(receiptPanel.getByRole("group", { name: "장비 검사 수신함 필터" })).toHaveCount(0);
  await expect(receiptPanel.getByText("오더 1")).toHaveCount(0);
  await expect(receiptPanel.getByText("전체 3")).toHaveCount(0);
  await expect(receiptPanel.getByText("검사 결과").first()).toBeVisible();
  await expect(receiptPanel.getByText("오더 연결")).toHaveCount(0);
  await expect(receiptPanel.getByText("ProCyte Dx")).toBeVisible();
  await expect(receiptPanel.getByText("10:49 수신")).toBeVisible();
  await expect(receiptPanel.getByText("코코 · 이지은 CBC 검사")).toBeVisible();
  await expect(receiptPanel.getByRole("button", { name: /ProCyte Dx 수신결과 접기/ })).toBeVisible();
  await expect(receiptPanel.getByText("검사 항목명")).toBeVisible();
  await expect(receiptPanel.getByText("WBC")).toBeVisible();
  await expect(receiptPanel.getByText("K/uL").first()).toBeVisible();
  await expect(receiptPanel.getByRole("button", { name: "결과 붙여넣기" })).toBeVisible();
  await receiptPanel.getByRole("button", { name: /ProCyte Dx 수신결과 접기/ }).click();
  await expect(receiptPanel.getByRole("button", { name: /ProCyte Dx 수신결과 펼치기/ })).toHaveAttribute("aria-expanded", "false");
  await expect(receiptPanel.getByText("검사 항목명")).toHaveCount(0);
  await receiptPanel.getByRole("button", { name: /ProCyte Dx 수신결과 펼치기/ }).click();
  await expect(receiptPanel.getByText("검사 항목명")).toBeVisible();

  await receiptPanel.getByRole("button", { name: "결과 붙여넣기" }).click();
  await expect(page.getByRole("dialog")).toContainText("검사결과를 붙여넣을까요?");
  await expect(page.getByRole("dialog")).toContainText("이전에 입력된 수치가 있으면 장비 수신값으로 덮어씁니다.");
  await page.getByRole("button", { name: "취소" }).click();
  await expect(receiptPanel.getByText("Catalyst One")).toHaveCount(0);
});

test("lab workspace prioritizes Kong CBC result from demo query", async ({ page }) => {
  await page.goto(
    "/w/clair-demo/lab?scenario=kong-vomit&patientId=patient-kong&encounterId=encounter-kong-260501&labResultId=lab-result-kong-cbc&modulePanel=open&aside=closed"
  );

  const sidePanel = page.locator("aside").first();
  await expect(sidePanel.getByTestId("lab-queue-item-lab-result-kong-cbc")).toContainText("콩이");
  await expect(page.getByRole("heading", { name: "임상병리검사 결과지" })).toBeVisible();
  await expect(page.getByText("환자").first()).toBeVisible();
  await expect(page.getByText("콩이").first()).toBeVisible();
  await expect(page.getByRole("row", { name: /WBC 21.4 K\/uL .*6.*17.*높음/ })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "WBC 결과값" })).toHaveValue("21.4");
  await expect(page.getByText("kong-cbc-260501.pdf")).toBeVisible();
});

test("imaging workspace renders reading, impression, and attachment flow", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const queueLoaded = waitForFulfillmentQueue(page, "imaging");
  await page.goto(
    "/w/clair-demo/imaging?modulePanel=open&aside=history&right=open&imagingStudyId=imaging-coco-thorax",
  );
  await queueLoaded;

  const sidePanel = page.locator("aside").first();
  await expect(sidePanel.getByText("영상검사")).toBeVisible();
  await expect(sidePanel.getByRole("group", { name: "영상검사 목록 보기" })).toHaveCount(0);
  await expect(sidePanel.getByRole("button", { name: "26.05.01(금) 날짜 선택" })).toBeVisible();
  await expect(sidePanel.getByText("영상 대기열")).toBeVisible();
  await expect(sidePanel.getByTestId("imaging-queue-item-imaging-coco-thorax")).toContainText("흉부 방사선");
  await expect(sidePanel.getByText("차트별 영상")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "영상검사 이력 패널 접기" })).toBeVisible();
  await page.getByRole("button", { name: "영상검사 이력 패널 접기" }).hover();
  await expect(page.locator("[data-slot='tooltip-content']").filter({ hasText: "영상검사 이력" })).toBeVisible();
  await expect(page.locator("#imaging-content-aside").getByRole("button", { name: /X-ray · 흉복부/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "영상검사 Order 상세" })).toBeVisible();
  await expect(page.getByText("흉부 방사선").first()).toBeVisible();
  await expect(page.getByTestId("imaging-study-status-label")).toHaveText("판독중");
  await expect(page.getByRole("button", { name: "Order 상세정보 접기" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "스터디 판독의견" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "영상 판독 내용" })).toContainText("복부 가스 음영 증가");
  await expect(page.getByRole("textbox", { name: "영상 종합소견" })).toContainText("위장관염 가능성");
  await expect(page.getByRole("textbox", { name: "Imaging Dx" })).toBeVisible();
  const completedStatusButton = page.getByRole("button", { name: "판독완료", exact: true });
  if ((await completedStatusButton.count()) === 0) {
    await expect(page.getByRole("button", { name: "판독 중", exact: true })).toBeVisible();
    await page
      .getByRole("button", { name: "판독 상태 액션 열기" })
      .click();
    await page.getByRole("menuitem", { name: "판독완료" }).click();
  }
  // Completion opens the existing required actual-execution form before any status write.
  const executionDialog = page.getByRole("dialog", { name: "실제 수행기록", exact: true });
  await expect(executionDialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(executionDialog).toBeHidden();
  await expect(page.getByTestId("imaging-study-status-label")).toHaveText("판독중");
  const summaryPanel = page.getByTestId("imaging-summary-panel");
  await expect(summaryPanel.getByText("coco-thorax-lateral.png")).toBeVisible();
  await expect(summaryPanel.getByRole("heading", { name: "종합소견" })).toBeVisible();
  await expect(summaryPanel.getByRole("heading", { name: "같은 차트 내 Order" })).toBeVisible();
  await expect(summaryPanel.getByRole("textbox", { name: "영상 종합 코멘트" })).toBeVisible();
  await expect(summaryPanel.getByText("coco-thorax-lateral.png")).toBeVisible();
  await expect(page.getByText("처치 지시서")).toHaveCount(0);
});

for (const kind of ["lab", "imaging"] as const) {
  test(`${kind} patient history controls use current entries and preserve selection`, async ({ page }) => {
    await page.goto(`/w/clair-demo/${kind}?modulePanel=open&aside=history&right=closed`);
    const aside = page.locator(`#${kind}-content-aside`);
    const cards = aside.locator('[data-testid^="patient-history-item-"]');
    await expect(cards.first()).toBeVisible();
    const initialIds = await cards.evaluateAll((items) => items.map((item) => item.getAttribute("data-testid")));
    const total = initialIds.length;
    const selected = aside.locator('[data-selected="true"]');
    const selectedId = await selected.first().getAttribute("data-testid");
    const initialUrl = page.url();
    await aside.getByRole("button", { name: "정렬: 최신순" }).click();
    await page.getByRole("menuitemradio", { name: "오래된순" }).click();
    await expect(cards).toHaveCount(total);
    const ascendingIds = await cards.evaluateAll((items) => items.map((item) => item.getAttribute("data-testid")));
    expect(ascendingIds).toEqual([...initialIds].reverse());
    const header = aside.locator('[data-slot="content-aside-search-header"]');
    const headerBeforeSearch = await header.boundingBox();
    const scrollBeforeSearch = await aside.locator('[data-slot="scroll-area"]').boundingBox();
    await aside.getByRole("button", { name: "검색", exact: true }).click();
    const search = aside.getByRole("searchbox", { name: kind === "lab" ? "검사 이력 검색" : "영상 이력 검색" });
    await expect(search).toHaveAttribute("placeholder", "키워드 입력");
    await expect(search).toHaveCSS("height", "28px");
    expect(await header.boundingBox()).toEqual(headerBeforeSearch);
    expect(await aside.locator('[data-slot="scroll-area"]').boundingBox()).toEqual(scrollBeforeSearch);
    await expect(aside.getByRole("button", { name: "필터", exact: true })).toHaveCount(0);
    await expect(aside.getByRole("button", { name: "정렬: 오래된순" })).toHaveCount(0);
    await search.fill("없는 검사");
    await expect(aside.getByTestId(`${kind}-content-aside-empty-state`)).toContainText("검색 결과가 없습니다");
    await expect(aside.getByText("선택한 이력이 조건에 가려져 있습니다")).toBeVisible();
    expect(page.url()).toBe(initialUrl);
    await search.press("Escape");
    await expect(cards).toHaveCount(total);
    if (selectedId) await expect(aside.getByTestId(selectedId)).toHaveAttribute("data-selected", "true");
    await aside.getByRole("button", { name: "필터", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: kind === "lab" ? "검사 이력 필터" : "영상 이력 필터" });
    await expect(dialog).toHaveAttribute("data-slot", "popover-content");
    await expect(page.locator('[data-slot="dialog-overlay"]')).toHaveCount(0);
    await expect(dialog.getByRole("heading")).toHaveClass(/\bsr-only\b/);
    await dialog.getByLabel("시작일").fill("2026-04-02");
    await dialog.getByLabel("종료일").fill("2026-04-01");
    await expect(dialog.getByRole("button", { name: "적용" })).toBeDisabled();
    await dialog.getByLabel("시작일").fill("2026-04-01");
    await dialog.getByRole("button", { name: "적용" }).click();
    await expect(aside.getByTestId(`${kind}-content-aside-empty-state`)).toContainText("조건에 맞는 이력이 없습니다");
    const indicator = aside.getByRole("button", { name: "필터", exact: true }).locator('[data-slot="history-filter-indicator"]');
    await expect(indicator).toBeVisible();
    await expect(indicator).toHaveCSS("width", "6px");
    await expect(aside.getByRole("button", { name: "날짜 조건 해제", exact: true })).toHaveCount(0);
    await aside.getByRole("button", { name: "필터", exact: true }).click();
    await dialog.getByRole("button", { name: "초기화", exact: true }).click();
    await dialog.getByRole("button", { name: "취소", exact: true }).click();
    await expect(cards).toHaveCount(0);
    await aside.getByRole("button", { name: "검색", exact: true }).click();
    await search.fill("없는 검사");
    await expect(aside.getByTestId(`${kind}-content-aside-empty-state`)).toContainText("검색 결과가 없습니다");
    await aside.getByRole("button", { name: "필터 해제", exact: true }).click();
    await expect(search).toHaveValue("없는 검사");
    await expect(cards).toHaveCount(0);
    await aside.getByRole("button", { name: "검색어 초기화", exact: true }).click();
    await expect(search).toHaveValue("");
    await expect(search).toBeFocused();
    await aside.getByRole("button", { name: "검색 닫기", exact: true }).click();
    await expect(cards).toHaveCount(total);
    await expect(aside.getByRole("button", { name: "검색", exact: true })).toBeFocused();
    await aside.getByRole("button", { name: "검색", exact: true }).click();
    const cancel = aside.getByRole("button", { name: "검색 닫기", exact: true });
    await expect(cancel).toBeEnabled();
    await expect(cancel.locator("svg")).toHaveCSS("width", "16px");
    await expect(cancel.locator("svg .oi-circle-close-fill")).toHaveCount(1);
    await expect(aside.getByRole("button", { name: "검색어 지우기", exact: true })).toHaveCount(0);
    await search.fill("다른 환자에는 유지하지 않을 검색");
    await expect(cards).toHaveCount(0);
    const nextQueueId = kind === "lab" ? "lab-queue-item-lab-result-kong-cbc" : "imaging-queue-item-imaging-kong-abdomen";
    await page.getByTestId(nextQueueId).click();
    await expect(aside.getByRole("searchbox")).toHaveCount(0);
    await expect(aside.getByRole("button", { name: "정렬: 최신순" })).toBeVisible();
    await expect(aside.getByRole("button", { name: "필터", exact: true })).toHaveAttribute("aria-pressed", "false");
    await expect(cards.first()).toBeVisible();
  });
}

test("imaging history aside keeps title count separate from evenly spaced actions", async ({
  page,
}) => {
  await page.goto(
    "/w/clair-demo/imaging?modulePanel=open&aside=history&right=closed",
  );

  const contentAside = page.locator("#imaging-content-aside");
  const title = contentAside.getByText("영상검사 이력", { exact: true }).first();
  const collapseButton = contentAside.getByRole("button", {
    name: "영상검사 이력 목록 접기",
  });
  const actionLabels = ["영상검사 이력 목록 접기", "정렬: 최신순", "필터", "검색"];
  const actionMetrics = await contentAside.evaluate((root, labels) => {
    return labels.map((label) => {
      const button = root.querySelector(
        `button[aria-label="${label}"]`,
      ) as HTMLButtonElement | null;

      if (!button) return null;

      const rect = button.getBoundingClientRect();

      return {
        label,
        left: Math.round(rect.left),
        right: Math.round(rect.right),
      };
    });
  }, actionLabels);
  const titleBox = await title.boundingBox();
  const collapseBox = await collapseButton.boundingBox();

  expect(actionMetrics.every(Boolean)).toBe(true);
  expect(actionMetrics.map((metric) => metric?.label)).toEqual(actionLabels);
  expect(titleBox).not.toBeNull();
  expect(collapseBox).not.toBeNull();
  if (!titleBox || !collapseBox) {
    throw new Error("Imaging aside title or collapse button bounds were not available.");
  }
  expect(titleBox.x + titleBox.width).toBeLessThan(collapseBox.x);

  const resolvedActionMetrics = actionMetrics.filter((metric) => metric !== null);

  const actionGaps: number[] = [];
  for (let index = 1; index < resolvedActionMetrics.length; index += 1) {
    const currentMetric = resolvedActionMetrics[index];
    const previousMetric = resolvedActionMetrics[index - 1];

    if (!currentMetric || !previousMetric) {
      throw new Error("Imaging aside action bounds were not available.");
    }

    actionGaps.push(currentMetric.left - previousMetric.right);
  }

  expect(actionGaps[0]).toBeGreaterThan(0);
  for (const gap of actionGaps) {
    expect(Math.abs(gap - actionGaps[0])).toBeLessThanOrEqual(1);
  }
});

test("clinical history panels keep the approved header frames and card spacing", async ({ page }, testInfo) => {
  const panels = [
    ["treatment", "chart-content-aside"],
    ["lab", "lab-content-aside"],
    ["imaging", "imaging-content-aside"],
    ["dispensing", "dispensing-content-aside"],
  ] as const;

  for (const [moduleId, asideId] of panels) {
    await page.goto(`/w/clair-demo/${moduleId}?date=2026-05-01&modulePanel=closed&aside=history${moduleId === "dispensing" ? "&workItemId=fulfill-order-coco-maropitant" : ""}`);
    const aside = page.locator(`#${asideId}`);
    await expect(aside).toBeVisible();
    const metrics = await aside.evaluate((panel) => {
      const header = panel.firstElementChild;
      const style = getComputedStyle(panel);
      return {
        headerHeight: header?.getBoundingClientRect().height,
        paddingLeft: style.paddingLeft,
        width: panel.closest('[data-workspace-panel="left"]')?.getBoundingClientRect().width,
      };
    });
    // Surface width includes the inline/drawer border; content fits inside it.
    expect(metrics).toEqual({ headerHeight: moduleId === "treatment" ? 28 : 48, paddingLeft: "16px", width: 280 });
    if (moduleId === "treatment") {
      await expect(aside.getByTestId("chart-history-date-mode-toolbar")).toHaveCSS("height", "24px");
    }
    await expect(aside.locator("[data-slot='content-history-group-title']").first()).toBeVisible();
    // Compare inside the aside; overall panel height and entrance motion are outside this contract.
    const readSearchFrame = () => aside.evaluate((panel) => {
      const parent = panel.getBoundingClientRect();
      return ['content-aside-search-header', 'scroll-area'].map((slot) => {
        const box = panel.querySelector(`[data-slot="${slot}"]`)!.getBoundingClientRect();
        return { x: box.x - parent.x, y: box.y - parent.y, width: box.width, ...(slot === "content-aside-search-header" ? { height: box.height } : {}) };
      });
    });
    const beforeSearch = await readSearchFrame();
    await aside.getByRole("button", { name: "검색", exact: true }).click();
    await expect(aside.getByRole("searchbox")).toHaveCSS("height", "28px");
    expect(await readSearchFrame()).toEqual(beforeSearch);
    await expect(aside.getByRole("button", { name: "필터", exact: true })).toHaveCount(0);
    if (moduleId === "treatment") {
      await expect(aside.getByRole("button", { name: "작성일 기준", exact: true })).toBeVisible();
    }
    if (moduleId === "treatment" || moduleId === "lab") {
      const screenshot = `output/playwright/history-header-search/${moduleId}-search.png`;
      await page.screenshot({ path: screenshot });
      await testInfo.attach(`${moduleId}-search`, { path: screenshot, contentType: "image/png" });
    }
    await aside.getByRole("button", { name: "검색 닫기", exact: true }).click();
    expect(await readSearchFrame()).toEqual(beforeSearch);
    expect((await page.locator('[data-workspace-panel="left"]').boundingBox())!.width).toBe(280);
    await expect(aside.locator("[data-slot='content-history-group-title']").first()).toBeVisible();
  }

  await expect(page.locator("#dispensing-content-aside").getByRole("group", {
    name: "조제/처치 이력 종류",
  })).toBeVisible();
});

test("Cheongdam imaging workspace renders live fulfillment rows without legacy study fixtures", async ({
  page,
}) => {
  await grantCheongdamWorkspaceAccess(page);

  const liveWorkItem = {
    assignedToUserId: null,
    createdAt: "2026-06-14T01:25:00.000Z",
    encounterId: "encounter-cheongdam-live-imaging-001",
    guardianName: "한보호",
    id: "work-cheongdam-imaging-001",
    orderId: "order-cheongdam-imaging-001",
    patientName: "하늘",
    queueType: "imaging",
    requestedByUserId: "user-vet",
    requesterName: "김민준",
    sourceSnapshot: {
      detail: { bodyPart: "복부", modality: "초음파" },
      instruction: "복부 통증 평가",
      inHospitalOrderName: "복부 초음파",
      serviceItemId: "svc-live-us",
    },
    status: "requested",
    updatedAt: "2026-06-14T01:25:00.000Z",
    workspaceId: PREPARED_EMPTY_CLINIC_WORKSPACE_ID,
  };

  await page.route(
    `**/api/workspaces/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/fulfillment/work-items**`,
    async (route) => {
      const url = new URL(route.request().url());

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          status: 200,
          enforcedBy: "fulfillment-work-item-persistence",
          workItems: url.searchParams.get("queueType") === "imaging" ? [liveWorkItem] : [],
        }),
      });
    }
  );

  await page.goto(`/w/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/imaging?modulePanel=open&aside=history`);

  const sidePanel = page.locator("aside").first();
  await expect(sidePanel.getByTestId(`imaging-queue-item-live-imaging-${liveWorkItem.id}`)).toContainText("하늘");
  await expect(sidePanel.getByTestId(`imaging-queue-item-live-imaging-${liveWorkItem.id}`)).toContainText("복부 초음파");
  await expect(page.locator("#imaging-content-aside")).toContainText("복부 초음파");
  await expect(sidePanel.getByTestId(`imaging-queue-item-live-imaging-${liveWorkItem.id}`)).toContainText("김민준");
  await expect(sidePanel.getByTestId(`imaging-queue-item-live-imaging-${liveWorkItem.id}`)).toContainText("10:25");
  await expect(sidePanel.getByTestId("imaging-queue-item-imaging-coco-thorax")).toHaveCount(0);
  const summaryDialog = page.getByRole("complementary", { name: "영상검사 이력", exact: true });
  await expect(summaryDialog).toBeVisible();
  await summaryDialog.locator("[data-workspace-history-collapse]").focus();
  await page.keyboard.press("Escape");
  await expect(summaryDialog).toBeHidden();
  await expect(page.getByRole("heading", { name: "영상검사 Order 상세" })).toBeVisible();
  await expect(page.getByText("하늘").first()).toBeVisible();

  await sidePanel.getByTestId(`imaging-queue-item-live-imaging-${liveWorkItem.id}`).click();
  await expect.poll(() => {
    const url = new URL(page.url());
    return {
      date: url.searchParams.get("date"),
      encounterId: url.searchParams.get("encounterId"),
      imagingStudyId: url.searchParams.get("imagingStudyId"),
    };
  }).toMatchObject({
    date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    encounterId: liveWorkItem.encounterId,
    imagingStudyId: `live-imaging-${liveWorkItem.id}`,
  });
});

test("imaging workspace prioritizes Kong abdomen study from demo query", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(
    "/w/clair-demo/imaging?scenario=kong-vomit&patientId=patient-kong&encounterId=encounter-kong-260501&imagingStudyId=imaging-kong-abdomen&modulePanel=open&aside=closed&right=open"
  );

  const sidePanel = page.locator("aside").first();
  await expect(sidePanel.getByTestId("imaging-queue-item-imaging-kong-abdomen")).toContainText("콩이");
  await expect(page.getByRole("heading", { name: "영상검사 Order 상세" })).toBeVisible();
  await expect(page.getByText("환자").first()).toBeVisible();
  await expect(page.getByText("콩이").first()).toBeVisible();
  await expect(page.getByRole("textbox", { name: "영상 판독 내용" })).toContainText(
    "위 내 소량 액체 저류. 장관 확장이나 명확한 이물 음영은 보이지 않음."
  );
  await expect(page.getByRole("textbox", { name: "영상 종합소견" })).toContainText(
    "급성 위장관염 가능성이 높으며, CBC 결과와 임상 증상 추적 권장."
  );
  await expect(page.getByTestId("imaging-summary-panel")).toContainText("CBC 검사");
  await expect(page.getByTestId("imaging-summary-panel")).toContainText("복부 초음파");
  await expect(page.getByTestId("imaging-summary-panel").getByText("kong-abdomen-ultrasound.png")).toBeVisible();
});

for (const queueType of ["lab", "imaging"] as const) {
  test(`${queueType} context opens authorized patient and guardian profiles`, async ({ page }) => {
    await grantCheongdamWorkspaceAccess(page);
    const workspaceId = PREPARED_EMPTY_CLINIC_WORKSPACE_ID;
    const patientId = "97090000-0000-4000-8000-000000000001";
    const guardianId = "97090000-0000-4000-8000-000000000002";
    const encounterId = "97090000-0000-4000-8000-000000000003";
    const workItem = {
      id: `context-${queueType}`,
      workspaceId,
      encounterId,
      patientId,
      orderId: `order-context-${queueType}`,
      queueType,
      requestCycle: 1,
      status: "requested",
      createdAt: "2026-09-07T01:20:00.000Z",
      updatedAt: "2026-09-07T01:20:00.000Z",
      sourceSnapshot: {
        patientName: "초코",
        guardianName: "최도현",
        orderDisplayName: queueType === "lab" ? "CBC 검사" : "흉부 영상",
        requestingVetName: "송민재",
        detail: { breed: "포메라니안", age: "3세" },
      },
    };
    const overview = {
      ok: true,
      overview: {
        subjectId: patientId,
        subjectType: "patient",
        profile: { id: patientId, name: "초코", patientNo: "P-CONTEXT", breed: "포메라니안", estimatedAgeText: "3세", sex: "male", status: "active" },
        relationships: { guardians: [{ id: guardianId, name: "최도현", mobilePhone: "010-1234-5678", isPrimary: true }] },
        access: { information: { allowed: true, requiredPermission: "patient:view" } },
      },
    };
    await page.route(`**/api/workspaces/${workspaceId}/fulfillment/work-items?*`, async (route) => {
      const requestedType = new URL(route.request().url()).searchParams.get("queueType");
      await route.fulfill({ json: { ok: true, workItems: requestedType === queueType ? [workItem] : [] } });
    });
    await page.route(`**/api/workspaces/${workspaceId}/customer/patient/${patientId}/profile-overview`, async (route) => {
      await route.fulfill({ json: overview });
    });
    await page.route(`**/api/workspaces/${workspaceId}/customer/guardian/${guardianId}/profile-overview`, async (route) => {
      await route.fulfill({ json: { ok: true, overview: {
        subjectId: guardianId,
        subjectType: "guardian",
        profile: { id: guardianId, name: "최도현", mobilePhone: "010-1234-5678", status: "active" },
        relationships: { patients: [{ id: patientId, name: "초코" }] },
        access: { information: { allowed: true, requiredPermission: "patient:view" } },
      } } });
    });
    await page.route(`**/api/workspaces/${workspaceId}/patient-vitals/latest?*`, async (route) => {
      await route.fulfill({ json: { ok: true, status: 200, canWriteVitals: false, vital: null } });
    });

    await page.goto(`/w/${workspaceId}/${queueType}?date=2026-09-07&modulePanel=open&aside=closed&right=closed`);
    const patientButton = page.getByRole("button", { name: "초코 환자 프로필 열기" });
    await expect(patientButton).toBeVisible();
    await patientButton.hover();
    await expect(page.locator("[data-slot='chart-patient-profile-preview']")).toContainText("P-CONTEXT");
    await patientButton.click();
    await expect(page.getByTestId("profile-side-panel")).toHaveAttribute("data-profile-kind", "patient");
    await expect(page.getByTestId("profile-side-panel")).toContainText("초코");
    await page.keyboard.press("Escape");

    const guardianButton = page.getByRole("button", { name: "최도현 보호자 프로필 열기" });
    await expect(guardianButton).toBeVisible();
    await guardianButton.hover();
    await expect(page.locator("[data-slot='chart-guardian-profile-preview']")).toContainText("010-1234-5678");
    await guardianButton.click();
    await expect(page.getByTestId("profile-side-panel")).toHaveAttribute("data-profile-kind", "guardian");
    await expect(page.getByTestId("profile-side-panel")).toContainText("최도현");
    await page.keyboard.press("Escape");

    await page.locator("[data-slot='patient-context-vitals']").hover();
    await expect(page.getByRole("button", { name: "오늘 바이탈 입력" })).toHaveAttribute("aria-disabled", "true");
  });
}
