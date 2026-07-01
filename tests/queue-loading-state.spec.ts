import { readFileSync } from "node:fs";

import { expect, test, type Page, type Route } from "@playwright/test";

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

function createDeferredRoute() {
  let fulfillRoute: ((route: Route) => Promise<void>) | undefined;
  const pending = new Promise<void>((resolve) => {
    fulfillRoute = async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, queue: [], records: [] }),
      });
      resolve();
    };
  });

  return {
    pending,
    async release(route: Route) {
      if (!fulfillRoute) throw new Error("Deferred route was not initialized");
      await fulfillRoute(route);
    },
  };
}

async function delayRouteUntilAsserted(page: Page, url: string) {
  const deferred = createDeferredRoute();
  let capturedRoute: Route | undefined;

  await page.route(url, async (route) => {
    capturedRoute = route;
    await deferred.pending;
  });

  return {
    async release() {
      if (!capturedRoute) throw new Error(`No route captured for ${url}`);
      await deferred.release(capturedRoute);
    },
  };
}

async function getQueueStateIconBoxSize(page: Page, stateText: string) {
  return page.getByText(stateText, { exact: true }).evaluate((textElement) => {
    const iconElement = textElement.previousElementSibling;
    if (!iconElement) return null;

    const box = iconElement.getBoundingClientRect();
    return {
      height: Math.round(box.height),
      width: Math.round(box.width),
    };
  });
}

async function getQueueStateIconRootTagName(page: Page, stateText: string) {
  return page.getByText(stateText, { exact: true }).evaluate((textElement) => {
    const iconElement = textElement.previousElementSibling;
    return iconElement?.firstElementChild?.tagName ?? null;
  });
}

async function getQueueStateIconTextGap(page: Page, stateText: string) {
  return page.getByText(stateText, { exact: true }).evaluate((textElement) => {
    const iconElement = textElement.previousElementSibling;
    if (!iconElement) return null;

    const iconBox = iconElement.getBoundingClientRect();
    const textBox = textElement.getBoundingClientRect();
    return Math.round(textBox.top - iconBox.bottom);
  });
}

async function expectQueueStateSpacing(page: Page, stateText: string) {
  await expect
    .poll(async () => getQueueStateIconBoxSize(page, stateText))
    .toEqual({ height: 40, width: 40 });
  await expect
    .poll(async () => getQueueStateIconTextGap(page, stateText))
    .toBe(8);
}

test("reception queue loading uses the side-panel body motion state instead of top loading copy", async ({
  page,
}) => {
  await grantCheongdamWorkspaceAccess(page);

  await page.route(
    `**/api/workspaces/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/reception/calendar/day?*`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, status: 200, records: [] }),
      });
    },
  );
  const queueRoute = await delayRouteUntilAsserted(
    page,
    `**/api/workspaces/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/reception/queue?*`,
  );

  await page.goto(
    `/w/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/reception?modulePanel=open`,
  );

  await expect(
    page.getByText("접수/예약 정보를 불러오는 중입니다"),
  ).toBeVisible();
  await expect(page.getByText("대기열 확인 중")).toHaveCount(0);
  await expectQueueStateSpacing(page, "접수/예약 정보를 불러오는 중입니다");

  await queueRoute.release();
});

test("reception queue empty state keeps the icon and copy visually tight", async ({
  page,
}) => {
  await grantCheongdamWorkspaceAccess(page);

  await page.route(
    `**/api/workspaces/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/reception/calendar/day?*`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, status: 200, records: [] }),
      });
    },
  );
  const queueRoute = await delayRouteUntilAsserted(
    page,
    `**/api/workspaces/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/reception/queue?*`,
  );

  await page.goto(
    `/w/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/reception?modulePanel=open`,
  );
  await expect(
    page.getByText("접수/예약 정보를 불러오는 중입니다"),
  ).toBeVisible();
  await expectQueueStateSpacing(page, "접수/예약 정보를 불러오는 중입니다");

  await queueRoute.release();
  await expect(page.getByText("접수/예약이 없습니다")).toBeVisible();
  await expectQueueStateSpacing(page, "접수/예약이 없습니다");
  await expect
    .poll(async () => getQueueStateIconRootTagName(
      page,
      "접수/예약이 없습니다",
    ))
    .toBe("DIV");

  await page.getByRole("button", { name: "검색", exact: true }).click();
  await page.getByRole("searchbox", { name: "대기열 검색" }).fill("검색결과없음");
  await expect(page.getByText("검색 결과가 없습니다", { exact: true })).toBeVisible();
  await expectQueueStateSpacing(page, "검색 결과가 없습니다");
});

test("chart queue loading uses the shared side-panel body motion state", async ({
  page,
}) => {
  await grantCheongdamWorkspaceAccess(page);

  const liveQueueRoute = await delayRouteUntilAsserted(
    page,
    `**/api/workspaces/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/chart/live-queue?*`,
  );

  await page.goto(
    `/w/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/treatment?modulePanel=open&aside=closed`,
  );

  await expect(
    page.getByText("진료차트 정보를 불러오는 중입니다"),
  ).toBeVisible();
  await expectQueueStateSpacing(page, "진료차트 정보를 불러오는 중입니다");

  await liveQueueRoute.release();
  await expect(page.getByText("진료 업무가 없습니다", { exact: true })).toBeVisible();
  await expectQueueStateSpacing(page, "진료 업무가 없습니다");
});

test("queue panels keep visible queue rows ahead of background loading states", () => {
  const receptionModule = readFileSync("src/features/reception/module.tsx", "utf8");
  const chartModule = readFileSync("src/features/chart/module.tsx", "utf8");
  const orderQueuePanel = readFileSync("src/components/emr/order-queue-side-panel.tsx", "utf8");
  const labImagingModule = readFileSync("src/features/lab-imaging/module.tsx", "utf8");

  expect(receptionModule).toContain(
    'const showQueueLoadingState = queueReadStatus === "loading" && visibleQueueGroups.length === 0;',
  );
  expect(chartModule).toContain('setLiveQueueState({ status: "loading" });');
  expect(chartModule).not.toContain('setLiveQueueState({ records: [], status: "loading" });');
  const chartQueueRefreshBlock =
    chartModule.match(/const refreshLiveQueue = useCallback\([\s\S]*?\n  \}, \[[\s\S]*?\]\);/)?.[0] ?? "";

  expect(chartQueueRefreshBlock).toContain('setLiveQueueState({ status: "loading" });');
  expect(chartQueueRefreshBlock).not.toContain("selectedEncounterId,");
  expect(chartQueueRefreshBlock).not.toContain("explicitQueryEncounterId,");
  expect(orderQueuePanel).toContain(
    "const showLoadingState = loading && groupedItems.length === 0;",
  );
  expect(labImagingModule).toContain(
    'const showLabQueueLoadingState = fulfillmentQueue.status === "loading" && resultCount === 0;',
  );
  expect(labImagingModule).toContain(
    'const showImagingQueueLoadingState = fulfillmentQueue.status === "loading" && resultCount === 0;',
  );
});

test("chart content keeps the selected shell visible while details hydrate", () => {
  const chartModule = readFileSync("src/features/chart/module.tsx", "utf8");

  expect(chartModule).toContain("const detailLoading =");
  expect(chartModule).toContain("const chartDetailPendingDelayMs = 200;");
  expect(chartModule).toContain("function useDelayedBoolean(");
  expect(chartModule).toContain("function ChartDetailPendingIndicator()");
  expect(chartModule).toContain('data-testid="chart-detail-pending-indicator"');
  expect(chartModule).toContain("const detailHydrationPending = detailLoading;");
  expect(chartModule).toContain("const showDetailPendingIndicator = useDelayedBoolean(");
  expect(chartModule).toContain("writeDisabled={detailHydrationPending}");
  expect(chartModule).toContain("detailPending={showDetailPendingIndicator}");
  expect(chartModule).toContain("function SoapPanel({");
  expect(chartModule).toContain("function AssessmentPanel({");
  expect(chartModule).toContain("function OrderArea({");
  expect(chartModule).toContain("writeDisabled: boolean;");
  expect(chartModule).toContain("disabled={writeDisabled}");
  expect(chartModule).toContain("confirmDisabled={writeDisabled}");
  expect(chartModule).toContain("if (detailHydrationPending) return;");
  expect(chartModule).not.toContain("function ChartDetailLoadingState()");
  expect(chartModule).not.toContain('data-testid="chart-detail-loading-state"');
  expect(chartModule).not.toContain("return <ChartDetailLoadingState />");
  expect(chartModule).not.toContain("if (detailLoading) return <ChartDetailLoadingState />;");
});

test("chart detail panels label local loading before empty states", () => {
  const chartModule = readFileSync("src/features/chart/module.tsx", "utf8");

  expect(chartModule).toContain("function ChartPanelPendingState(");
  expect(chartModule).toContain("SOAP 정보를 불러오는 중");
  expect(chartModule).toContain("진단명 정보를 불러오는 중");
  expect(chartModule).toContain("오더 정보를 불러오는 중");
  expect(chartModule).toContain("const soapLoading =");
  expect(chartModule).toContain("const diagnosisLoading =");
  expect(chartModule).toContain("const orderLoading =");
  expect(chartModule).toContain("loading={soapLoading}");
  expect(chartModule).toContain("loading={diagnosisLoading}");
  expect(chartModule).toContain("loading={orderLoading}");
  expect(chartModule).toContain("!loading && !diagnosisRows.length");
  expect(chartModule).toContain("!loading && !rows.length");
});

test("chart detail panels remount encounter-scoped local state on queue switch", () => {
  const chartModule = readFileSync("src/features/chart/module.tsx", "utf8");

  expect(chartModule).toMatch(
    /<SoapPanel\s+key=\{`chart-soap-\$\{bundle\.encounter\.id\}-/,
  );
  expect(chartModule).toContain('key={`chart-assessment-${bundle.encounter.id}`}');
  expect(chartModule).toMatch(/<OrderArea\s+key=\{bundle\.encounter\.id\}/);
  expect(chartModule).not.toContain(
    "key={`chart-soap-${effectiveLatestSoap?.id ?? selectedEncounterId}",
  );
});

test("chart queue selection updates local encounter before shell navigation", () => {
  const chartModule = readFileSync("src/features/chart/module.tsx", "utf8");
  const selectionBlock =
    chartModule.match(
      /const selectWorkspaceEncounter = \(itemId: string\) => \{[\s\S]*?\n  \};/,
    )?.[0] ?? "";

  expect(selectionBlock).toContain("selectEncounter(itemId);");
  expect(selectionBlock).toContain('setSelectedQueueItem("treatment", itemId);');
  expect(selectionBlock.indexOf("selectEncounter(itemId);")).toBeLessThan(
    selectionBlock.indexOf("if (onNavigateWorkspaceSurface)"),
  );
});

test("chart content keeps diagnosis rows scoped while the pending grace window is active", () => {
  const chartModule = readFileSync("src/features/chart/module.tsx", "utf8");

  expect(chartModule).toContain("const rawDiagnosisRows = diagnosisState.rows;");
  expect(chartModule).toContain(
    "const diagnosisRows =\n    diagnosisState.encounterId === activeEncounterId",
  );
});

test("reception live read effect does not restart only because profile rows hydrate", () => {
  const receptionModule = readFileSync("src/features/reception/module.tsx", "utf8");

  expect(receptionModule).toContain(
    "const currentPatients = usePatientProfileStore.getState().patients;",
  );
  expect(receptionModule).not.toMatch(
    /const refreshReceptionReads = useCallback\([\s\S]*?\n\s+patients,\n\s+setReceptionCalendarReadStatus,/,
  );
});
