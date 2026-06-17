import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

import {
  getReceptionPatientSummaries,
  getReceptionQueueRows,
  getTodayAppointments,
} from "../src/features/reception/data";
import { getHomeMockData } from "../src/features/home/home.mock";
import {
  formatKoreanOperatingDateLabel,
  getWorkspaceOperatingDate,
} from "../src/lib/emr-domain/demo-date";
import {
  LEGACY_SALES_DEMO_WORKSPACE_ID,
  PREPARED_EMPTY_CLINIC_WORKSPACE_ID,
  resolveWorkspacePathname,
  resolveWorkspaceRouteParam,
} from "../src/lib/emr-domain/demo-workspaces";
import { MOCK_AUTH_STORAGE_KEY } from "../src/features/auth/mock-session";

test("Cheongdam prepared clinic scope does not inherit legacy daily work", () => {
  const operatingDate = "2026-06-12";
  const scope = {
    operatingDate,
    workspaceId: PREPARED_EMPTY_CLINIC_WORKSPACE_ID,
  };

  expect(getTodayAppointments([], [], scope)).toEqual([]);
  expect(getReceptionQueueRows([], scope)).toEqual([]);
  expect(
    getReceptionPatientSummaries([], undefined, scope).filter(
      (summary) => summary.activeEncounter || summary.latestAppointment
    )
  ).toEqual([]);
});

test("legacy Sales Demo scope exposes the fixture day only when addressed explicitly", () => {
  const appointments = getTodayAppointments([], [], {
    workspaceId: LEGACY_SALES_DEMO_WORKSPACE_ID,
  });
  const queueRows = getReceptionQueueRows([], {
    workspaceId: LEGACY_SALES_DEMO_WORKSPACE_ID,
  });

  expect(appointments.map((appointment) => appointment.id)).toContain(
    "appointment-nabi-260501"
  );
  expect(queueRows.map((row) => row.patient.name)).toContain("코코");
});

test("Home entry links stay scoped to the active workspace", () => {
  const workspaceId = "workspace-demo-active";
  const data = getHomeMockData("owner", workspaceId);
  const hrefs = [
    ...data.tasks.map((task) => task.actionHref),
    ...data.hospitalTasks.map((task) => task.actionHref),
    ...data.emptyLaunchers.map((launcher) => launcher.href),
    ...data.flowSummary.map((item) => item.href),
    ...data.roleNextActions.flatMap((hypothesis) =>
      hypothesis.actions.map((action) => action.actionHref)
    ),
  ];

  expect(hrefs.length).toBeGreaterThan(0);
  expect(hrefs.some((href) => href.includes("/w/clair-demo"))).toBe(false);
  expect(hrefs.every((href) => href.startsWith(`/w/${workspaceId}/`))).toBe(true);
});

test("missing workspace fallbacks resolve to Cheongdam seed verification scope", () => {
  expect(resolveWorkspaceRouteParam(undefined)).toBe(PREPARED_EMPTY_CLINIC_WORKSPACE_ID);
  expect(resolveWorkspaceRouteParam([])).toBe(PREPARED_EMPTY_CLINIC_WORKSPACE_ID);
  expect(resolveWorkspaceRouteParam("")).toBe(PREPARED_EMPTY_CLINIC_WORKSPACE_ID);
  expect(resolveWorkspacePathname(undefined)).toBe(PREPARED_EMPTY_CLINIC_WORKSPACE_ID);
  expect(resolveWorkspacePathname("/")).toBe(PREPARED_EMPTY_CLINIC_WORKSPACE_ID);

  expect(resolveWorkspaceRouteParam(LEGACY_SALES_DEMO_WORKSPACE_ID)).toBe(
    LEGACY_SALES_DEMO_WORKSPACE_ID
  );
  expect(resolveWorkspacePathname(`/w/${LEGACY_SALES_DEMO_WORKSPACE_ID}/reception`)).toBe(
    LEGACY_SALES_DEMO_WORKSPACE_ID
  );
});

test("workflow module fallback fixtures are explicit Sales Demo only", () => {
  const chartModule = readFileSync("src/features/chart/module.tsx", "utf8");
  const labImagingModule = readFileSync("src/features/lab-imaging/module.tsx", "utf8");
  const dispensingModule = readFileSync("src/features/dispensing/module.tsx", "utf8");
  const billingModule = readFileSync("src/features/billing/module.tsx", "utf8");

  expect(chartModule).toContain("isLegacySalesDemoWorkspace(workspaceId) &&");
  expect(chartModule).not.toContain("!isPreparedEmptyClinicWorkspace(workspaceId) &&");

  expect(labImagingModule).toContain(
    "{ allowMockFallback: isLegacySalesDemoWorkspace(workspaceId) }"
  );
  expect(labImagingModule).toContain("allowFixtureItems: legacySalesDemo");
  expect(labImagingModule).not.toContain(
    "{ allowMockFallback: !isPreparedEmptyClinicWorkspace(workspaceId) }"
  );
  expect(labImagingModule).not.toContain(
    "isPreparedEmptyClinicWorkspace(workspaceId) ? [] : getLabWorkItems()"
  );
  expect(labImagingModule).not.toContain(
    "isPreparedEmptyClinicWorkspace(workspaceId) ? [] : getImagingWorkItems()"
  );

  expect(dispensingModule).toContain(
    "allowFixtureItems: isLegacySalesDemoWorkspace(workspaceId)"
  );
  expect(dispensingModule).toContain(
    "allowLegacyFixtureFallback ? getSelectedOrderQueueItem"
  );

  expect(billingModule).toContain(
    "const workspaceInvoices = legacySalesDemo ? invoices : emptyBillingInvoices;"
  );
  expect(billingModule).toContain(
    'dateLabel={legacySalesDemo ? "26.05.01 (금)" : "오늘"}'
  );
  expect(billingModule).not.toContain(
    "preparedEmptyClinic ? emptyBillingInvoices : invoices"
  );
});

test("Cheongdam reception screen starts from current date and no visible fixture cards", async ({
  page,
}) => {
  const operatingDate = getWorkspaceOperatingDate(PREPARED_EMPTY_CLINIC_WORKSPACE_ID);
  const operatingDateLabel = formatKoreanOperatingDateLabel(operatingDate);

  await page.goto(
    `/w/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/reception?modulePanel=open`
  );

  await expect(
    page.getByRole("button", { name: `${operatingDateLabel} 날짜 선택` })
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "26.05.01 (금) 날짜 선택" })).toHaveCount(0);
  await expect(page.locator('[data-testid^="appointment-card-"]')).toHaveCount(0);
  await expect(page.locator('[data-testid^="walkin-card-"]')).toHaveCount(0);
});

test("Cheongdam reception read errors keep empty-clinic state with retry hooks", async ({
  page,
}) => {
  await page.route(
    `**/api/workspaces/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/reception/queue`,
    async (route) => {
      await route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({
          ok: false,
          status: 403,
          denialReason: "workspace_membership_missing",
        }),
      });
    }
  );
  await page.route(
    `**/api/workspaces/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/reception/calendar/day?**`,
    async (route) => {
      await route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({
          ok: false,
          status: 403,
          denialReason: "workspace_membership_missing",
        }),
      });
    }
  );

  await page.goto(
    `/w/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/reception?modulePanel=open`
  );

  await expect(page.getByTestId("reception-queue-read-alert")).toContainText(
    "기존 데모 업무는 표시하지 않고"
  );
  await expect(page.getByTestId("reception-calendar-read-alert")).toContainText(
    "기존 데모 업무는 표시하지 않고"
  );
  await expect(page.getByRole("button", { name: "대기열 다시 시도" })).toBeVisible();
  await expect(page.getByRole("button", { name: "캘린더 다시 시도" })).toBeVisible();
  await expect(page.getByText("아직 접수 대기 업무가 없습니다.")).toBeVisible();
  await expect(page.getByText("26.05.01")).toHaveCount(0);
  await expect(page.getByText("콩이")).toHaveCount(0);
  await expect(page.getByText("나비")).toHaveCount(0);
  await expect(page.getByText("코코")).toHaveCount(0);
  await expect(page.locator('[data-testid^="appointment-card-"]')).toHaveCount(0);
  await expect(page.locator('[data-testid^="walkin-card-"]')).toHaveCount(0);
});

test("Cheongdam work modules do not render legacy active-work fixtures", async ({
  page,
}) => {
  const modules = [
    "home",
    "treatment",
    "lab",
    "imaging",
    "dispensing",
    "billing",
    "inpatient",
  ];

  for (const moduleId of modules) {
    await page.goto(`/w/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/${moduleId}`);

    await expect(page.getByText("26.05.01")).toHaveCount(0);
    await expect(page.getByText("26.04.14")).toHaveCount(0);
    await expect(page.getByText("26.05.06")).toHaveCount(0);
    await expect(page.getByText("콩이")).toHaveCount(0);
    await expect(page.getByText("나비")).toHaveCount(0);
    await expect(page.getByText("코코")).toHaveCount(0);
    await expect(page.getByText("하루")).toHaveCount(0);
  }
});

test("Cheongdam shell search and notifications do not expose legacy daily work", async ({
  page,
}) => {
  await page.goto(`/w/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/home`);

  await expect(page.getByTestId("global-notification-badge")).toHaveCount(0);

  await page.keyboard.press(process.platform === "darwin" ? "Meta+K" : "Control+K");
  await page.getByLabel("통합 검색", { exact: true }).fill("콩이");

  await expect(page.getByText("검색 결과가 없습니다.")).toBeVisible();
  await expect(page.locator('[id^="command-result-patient-"]')).toHaveCount(0);
  await expect(page.locator('[id^="command-result-appointment-"]')).toHaveCount(0);
  await expect(page.locator('[id^="command-result-encounter-"]')).toHaveCount(0);
});

test("Cheongdam admin can invoke synthetic demo session reset from workspace topbar", async ({
  page,
}) => {
  let resetCalled = false;

  await page.addInitScript(
    ([storageKey]) => {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({
          id: "mock-session-admin-reset",
          role: "hospital_admin",
          storageMode: "local",
          issuedAt: "2026-06-16T00:00:00.000Z",
        })
      );
      window.localStorage.setItem(
        "clair-emr:chart-selected-encounter:v1:workspace-clair-cheongdam",
        "encounter-to-clear"
      );
    },
    [MOCK_AUTH_STORAGE_KEY]
  );
  await page.route(
    `**/api/workspaces/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/demo/session-reset`,
    async (route) => {
      resetCalled = true;
      expect(route.request().method()).toBe("POST");
      expect(route.request().headers()["x-clair-demo-session-user-id"]).toBe("user-admin");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          workspaceId: PREPARED_EMPTY_CLINIC_WORKSPACE_ID,
          mode: "remote_supabase",
          enforcedBy: "demo-session-reset",
          counts: {
            appointments: 0,
            encounters: 1,
            waitingQueueEntries: 1,
            soapNotes: 0,
            diagnoses: 0,
            orderGroups: 0,
            orders: 0,
            fulfillmentWorkItems: 0,
            invoices: 0,
            invoiceLines: 0,
            payments: 0,
            generatedPatients: 1,
            generatedGuardians: 1,
          },
        }),
      });
    }
  );

  await page.goto(`/w/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/home`);
  await page.getByTestId("demo-session-reset-button").click();
  await expect(page.getByText("데모 세션을 처음 상태로 초기화할까?")).toBeVisible();
  await page.getByRole("button", { name: "초기화", exact: true }).click();

  await expect(page.getByText("데모 세션을 초기화했어.")).toBeVisible();
  await expect
    .poll(() => resetCalled)
    .toBe(true);
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.localStorage.getItem(
          "clair-emr:chart-selected-encounter:v1:workspace-clair-cheongdam"
        )
      )
    )
    .toBeNull();
});

test("legacy Sales Demo route exposes the fixed fixture date and cards only on its route", async ({
  page,
}) => {
  await page.goto(`/w/${LEGACY_SALES_DEMO_WORKSPACE_ID}/reception?modulePanel=open`);

  await expect(page.getByRole("button", { name: "26.05.01 (금) 날짜 선택" })).toBeVisible();
  await expect(page.getByTestId("appointment-card-appointment-nabi-260501")).toBeVisible();
});
