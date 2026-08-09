import { expect, test } from "@playwright/test";

test("Cheongdam customer workspace renders seeded DB patients instead of legacy fixtures", async ({
  page,
}) => {
  const workspaceId = "workspace-clair-cheongdam";

  await page.route(
    `**/api/workspaces/${workspaceId}/reception/patient-guardian-lookup?**`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          enforcedBy: "reception-patient-guardian-lookup",
          patients: [
            {
              patient: {
                id: "49121000-0000-4000-8000-000000000001",
                workspaceId,
                patientNo: "CD-P-001",
                name: "루미",
                species: "dog",
                breed: "Maltese",
                birthDate: "2025-11-20",
                sex: "female",
                neutered: false,
                handlingCautionLocked: true,
                status: "active",
                createdAt: "2026-06-12T00:00:00.000Z",
                updatedAt: "2026-06-12T00:00:00.000Z",
              },
              primaryGuardian: {
                id: "49120000-0000-4000-8000-000000000001",
                workspaceId,
                name: "김서윤",
                mobilePhone: "010-4911-0001",
                createdAt: "2026-06-12T00:00:00.000Z",
                updatedAt: "2026-06-12T00:00:00.000Z",
              },
              searchText: "루미 CD-P-001 Maltese 김서윤 010-4911-0001",
            },
            {
              patient: {
                id: "49121000-0000-4000-8000-000000000005",
                workspaceId,
                patientNo: "CD-P-005",
                name: "모카",
                species: "cat",
                breed: "Russian blue",
                birthDate: "2023-06-05",
                sex: "male",
                neutered: false,
                handlingCautionLocked: true,
                status: "active",
                createdAt: "2026-06-12T00:00:00.000Z",
                updatedAt: "2026-06-12T00:00:00.000Z",
              },
              primaryGuardian: {
                id: "49120000-0000-4000-8000-000000000005",
                workspaceId,
                name: "정유나",
                mobilePhone: "010-4911-0005",
                createdAt: "2026-06-12T00:00:00.000Z",
                updatedAt: "2026-06-12T00:00:00.000Z",
              },
              searchText: "모카 CD-P-005 Russian blue 정유나 010-4911-0005",
            },
          ],
        }),
      });
    },
  );

  await page.goto(`/w/${workspaceId}/customer?modulePanel=open`);

  await expect(page.getByTestId("customer-patient-table")).toBeVisible();
  await expect(page.getByText("CD-P-001")).toBeVisible();
  await expect(page.getByText("루미")).toBeVisible();
  await expect(page.getByText("김서윤")).toBeVisible();
  await expect(page.getByText("CD-P-005")).toBeVisible();
  await expect(page.getByText("모카")).toBeVisible();
  await expect(page.getByText("정유나")).toBeVisible();
  await expect(page.getByText("P-260414-0008")).toHaveCount(0);
  await expect(page.getByText("코코")).toHaveCount(0);
  await expect(page.getByText("나비")).toHaveCount(0);
  await expect(page.getByTestId("customer-side-panel-patient")).toContainText(
    "2",
  );
  await expect(page.getByTestId("customer-side-panel-guardian")).toContainText(
    "2",
  );
});

test("prepared profile reads overview first and lazy-loads only the selected live section", async ({
  page,
}) => {
  const workspaceId = "workspace-clair-cheongdam";
  const patientId = "49121000-0000-4000-8000-000000000999";
  let historyRequests = 0;
  let reservationRequests = 0;

  await page.route(`**/api/workspaces/${workspaceId}/reception/patient-guardian-lookup?**`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        patients: [{
          patient: {
            id: patientId,
            workspaceId,
            patientNo: "CD-P-999",
            name: "목록 환자",
            species: "cat",
            breed: "Siamese",
            birthDate: "2020-10-30",
            sex: "female",
            neutered: true,
            handlingCautionLocked: true,
            status: "active",
            createdAt: "2026-06-12T00:00:00.000Z",
            updatedAt: "2026-06-12T00:00:00.000Z",
          },
          primaryGuardian: null,
          searchText: "목록 환자 CD-P-999 Siamese",
        }],
      }),
    }),
  );
  await page.route(`**/api/workspaces/${workspaceId}/customer/patient/${patientId}/profile-overview`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        overview: {
          subjectType: "patient",
          subjectId: patientId,
          profile: {
            id: patientId,
            workspaceId,
            patientNo: "CD-P-999",
            name: "실데이터 환자",
            species: "cat",
            breed: "Siamese",
            birthDate: "2020-10-30",
            sex: "female",
            neutered: true,
            status: "active",
            createdAt: "2026-06-12T00:00:00.000Z",
            updatedAt: "2026-06-12T00:00:00.000Z",
          },
          relationships: { guardians: [] },
          access: {
            information: { allowed: true, requiredPermission: "patient:view" },
            history: { allowed: true, requiredPermission: "chart:view" },
            reservations: { allowed: false, requiredPermission: "reception:view" },
            billing: { allowed: true, requiredPermission: "billing:view" },
          },
        },
      }),
    }),
  );
  await page.route(`**/api/workspaces/${workspaceId}/customer/patient/${patientId}/profile-overview/history?**`, async (route) => {
    historyRequests += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        section: "history",
        items: [{
          id: "encounter-live-1",
          patientId,
          patientName: "실데이터 환자",
          occurredAt: "2026-07-14T09:00:00.000Z",
          status: "completed",
          visitPurpose: "검증 방문",
          clinicianName: "담당 의료진",
        }],
        nextCursor: null,
      }),
    });
  });
  await page.route(`**/api/workspaces/${workspaceId}/customer/patient/${patientId}/profile-overview/reservations?**`, async (route) => {
    reservationRequests += 1;
    await route.fulfill({ status: 403, contentType: "application/json", body: JSON.stringify({ ok: false, denialReason: "permission_missing" }) });
  });

  await page.goto(`/w/${workspaceId}/customer?modulePanel=open`);
  await page.getByText("목록 환자").click();
  const panel = page.getByTestId("profile-side-panel");
  await expect(panel.getByRole("heading", { name: "실데이터 환자" })).toBeVisible();
  await expect(panel.getByRole("tab", { name: "예약" })).toHaveAttribute("aria-disabled", "true");
  expect(historyRequests).toBe(0);

  await panel.getByRole("tab", { name: "진료 이력" }).click();
  await expect(panel.getByText("검증 방문")).toBeVisible();
  expect(historyRequests).toBe(1);

  await expect(panel.getByRole("tab", { name: "예약" })).toHaveAttribute(
    "title",
    "reception:view 권한이 필요합니다",
  );
  await panel.getByRole("tab", { name: "예약" }).dispatchEvent("click");
  await expect(panel.getByRole("tab", { name: "진료 이력" })).toHaveAttribute("aria-selected", "true");
  expect(reservationRequests).toBe(0);
});

test("customer no-data uses the shared whole-table empty state and screen CTA", async ({
  page,
}) => {
  const workspaceId = "workspace-clair-cheongdam";
  await page.route(
    `**/api/workspaces/${workspaceId}/reception/patient-guardian-lookup?**`,
    (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          enforcedBy: "reception-patient-guardian-lookup",
          patients: [],
        }),
      }),
  );

  await page.goto(`/w/${workspaceId}/customer?modulePanel=open`);

  const section = page.getByTestId("customer-patient-table");
  const emptyState = section.getByTestId("customer-patient-table-empty-state");
  await expect(emptyState).toHaveAttribute("data-kind", "no-data");
  await expect(emptyState).toContainText("동물 정보가 없습니다");
  await expect(
    section.getByRole("table", { name: "동물 고객관리 테이블" }),
  ).toHaveCount(0);
  await expect(section.getByTestId("customer-table-footer")).toHaveCount(0);

  await emptyState.getByRole("button", { name: "신규 동물" }).click();
  await expect(page.getByRole("dialog", { name: "신규 등록" })).toBeVisible();
});

test("customer read error retries without exposing stale rows", async ({
  page,
}) => {
  const workspaceId = "workspace-clair-cheongdam";
  let lookupAttempts = 0;
  let allowReadSuccess = false;
  await page.route(
    `**/api/workspaces/${workspaceId}/reception/patient-guardian-lookup?**`,
    async (route) => {
      lookupAttempts += 1;
      if (!allowReadSuccess) {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ ok: false, error: "db_read_failed" }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          enforcedBy: "reception-patient-guardian-lookup",
          patients: [
            {
              patient: {
                id: "49121000-0000-4000-8000-000000000301",
                workspaceId,
                patientNo: "CD-P-301",
                name: "재시도",
                species: "dog",
                breed: "Poodle",
                birthDate: "2024-01-10",
                sex: "male",
                neutered: true,
                handlingCautionLocked: false,
                status: "active",
                createdAt: "2026-06-12T00:00:00.000Z",
                updatedAt: "2026-06-12T00:00:00.000Z",
              },
              primaryGuardian: null,
              searchText: "재시도 CD-P-301 Poodle",
            },
          ],
        }),
      });
    },
  );

  await page.goto(`/w/${workspaceId}/customer?modulePanel=open`);

  const section = page.getByTestId("customer-patient-table");
  const readError = section.getByTestId("customer-patient-table-read-error");
  await expect(readError).toHaveAttribute("data-kind", "read-error");
  await expect(
    section.getByRole("table", { name: "동물 고객관리 테이블" }),
  ).toHaveCount(0);
  allowReadSuccess = true;
  await readError.getByRole("button", { name: "다시 시도" }).click();
  await expect(page.getByText("CD-P-301")).toBeVisible();
  expect(lookupAttempts).toBeGreaterThanOrEqual(2);
});

test("customer permission denial uses the shared no-permission state", async ({
  page,
}) => {
  const workspaceId = "workspace-clair-cheongdam";
  await page.route(
    `**/api/workspaces/${workspaceId}/reception/patient-guardian-lookup?**`,
    (route) =>
      route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({ ok: false, denialReason: "permission_missing" }),
      }),
  );

  await page.goto(`/w/${workspaceId}/customer?modulePanel=open`);

  const denied = page.getByTestId("customer-patient-table-read-denied");
  await expect(denied).toHaveAttribute("data-kind", "no-permission");
  await expect(denied).toContainText("동물 정보를 볼 권한이 없습니다");
  await expect(denied.getByRole("button")).toHaveCount(0);
});

test("Cheongdam customer table shows skeleton while seeded profiles are loading", async ({
  page,
}) => {
  const workspaceId = "workspace-clair-cheongdam";
  let resolveLookup: () => void = () => {};
  const lookupPending = new Promise<void>((resolve) => {
    resolveLookup = resolve;
  });

  await page.route(
    `**/api/workspaces/${workspaceId}/reception/patient-guardian-lookup?**`,
    async (route) => {
      await lookupPending;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          enforcedBy: "reception-patient-guardian-lookup",
          patients: [
            {
              patient: {
                id: "49121000-0000-4000-8000-000000000101",
                workspaceId,
                patientNo: "CD-P-101",
                name: "라온",
                species: "dog",
                breed: "Poodle",
                birthDate: "2024-01-10",
                sex: "male",
                neutered: true,
                handlingCautionLocked: true,
                status: "active",
                createdAt: "2026-06-12T00:00:00.000Z",
                updatedAt: "2026-06-12T00:00:00.000Z",
              },
              primaryGuardian: {
                id: "49120000-0000-4000-8000-000000000101",
                workspaceId,
                name: "박민준",
                mobilePhone: "010-4911-0101",
                createdAt: "2026-06-12T00:00:00.000Z",
                updatedAt: "2026-06-12T00:00:00.000Z",
              },
              searchText: "라온 CD-P-101 Poodle 박민준 010-4911-0101",
            },
          ],
        }),
      });
    },
  );

  await page.goto(`/w/${workspaceId}/customer?modulePanel=open`);

  const patientTable = page.getByTestId("customer-patient-table");
  const firstSkeletonRow = patientTable
    .getByTestId("customer-patient-table-skeleton-row")
    .first();
  const pinnedSkeletonCells = firstSkeletonRow.locator(
    'td[data-emr-column-pinned="left"]',
  );
  const pinnedSkeletonCell = pinnedSkeletonCells.nth(1);
  await expect(firstSkeletonRow).toBeVisible();
  await expect(pinnedSkeletonCells).toHaveCount(2);
  await expect(pinnedSkeletonCell).toHaveCSS("position", "sticky");
  await expect(pinnedSkeletonCell).not.toHaveCSS(
    "background-color",
    "rgba(0, 0, 0, 0)",
  );
  await expect(
    pinnedSkeletonCell.locator('[data-emr-table-identity-content="true"]'),
  ).toHaveCount(1);
  await expect(
    page.getByTestId("customer-page-header-count-skeleton"),
  ).toBeVisible();
  await expect(patientTable).not.toContainText("동물 정보가 없습니다");
  await expect(patientTable).not.toContainText("0건");
  await expect(
    page.getByTestId("customer-side-panel-patient"),
  ).not.toContainText("0");

  resolveLookup();

  await expect(page.getByText("CD-P-101")).toBeVisible();
  await expect(page.getByText("라온")).toBeVisible();
  await expect(page.getByText("박민준")).toBeVisible();
  await expect(
    patientTable.getByTestId("customer-patient-table-skeleton-row"),
  ).toHaveCount(0);
  await expect(page.getByTestId("customer-side-panel-patient")).toContainText(
    "1",
  );
  await expect(page.getByTestId("customer-side-panel-guardian")).toContainText(
    "1",
  );
});

test("Cheongdam customer table does not flash empty copy on SPA re-entry with stale ready state", async ({
  page,
}) => {
  const workspaceId = "workspace-clair-cheongdam";
  let lookupCallCount = 0;
  let resolveLookup: () => void = () => {};
  const lookupPending = new Promise<void>((resolve) => {
    resolveLookup = resolve;
  });

  await page.route(
    `**/api/workspaces/${workspaceId}/reception/patient-guardian-lookup?**`,
    async (route) => {
      lookupCallCount += 1;

      if (lookupCallCount <= 2) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            enforcedBy: "reception-patient-guardian-lookup",
            patients: [],
          }),
        });
        return;
      }

      await lookupPending;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          enforcedBy: "reception-patient-guardian-lookup",
          patients: [
            {
              patient: {
                id: "49121000-0000-4000-8000-000000000202",
                workspaceId,
                patientNo: "CD-P-202",
                name: "보름",
                species: "cat",
                breed: "Korean shorthair",
                birthDate: "2023-03-14",
                sex: "female",
                neutered: true,
                handlingCautionLocked: true,
                status: "active",
                createdAt: "2026-06-12T00:00:00.000Z",
                updatedAt: "2026-06-12T00:00:00.000Z",
              },
              primaryGuardian: {
                id: "49120000-0000-4000-8000-000000000202",
                workspaceId,
                name: "최서진",
                mobilePhone: "010-4911-0202",
                createdAt: "2026-06-12T00:00:00.000Z",
                updatedAt: "2026-06-12T00:00:00.000Z",
              },
              searchText: "보름 CD-P-202 Korean shorthair 최서진 010-4911-0202",
            },
          ],
        }),
      });
    },
  );

  await page.goto(`/w/${workspaceId}/customer?modulePanel=open`);

  const patientTable = page.getByTestId("customer-patient-table");
  await expect(patientTable).toContainText("동물 정보가 없습니다");

  await page.getByRole("link", { name: "접수/예약" }).click();
  await expect(page).toHaveURL(new RegExp(`/w/${workspaceId}/reception`));

  await page.getByRole("link", { name: "고객관리" }).click();
  await expect(
    patientTable.getByTestId("customer-patient-table-skeleton-row").first(),
  ).toBeVisible();
  await expect(patientTable).not.toContainText("동물 정보가 없습니다");
  await expect(patientTable).not.toContainText("0건");
  await expect(
    page.getByTestId("customer-page-header-count-skeleton"),
  ).toBeVisible();
  await expect(
    page.getByTestId("customer-side-panel-patient"),
  ).not.toContainText("0");

  resolveLookup();

  await expect(page.getByText("CD-P-202")).toBeVisible();
  await expect(page.getByText("보름")).toBeVisible();
  await expect(page.getByText("최서진")).toBeVisible();
});

test("customer workspace renders animal master list and opens the common patient drawer", async ({
  page,
}) => {
  await page.goto("/w/clair-demo/customer?modulePanel=open");

  await expect(page.getByTestId("customer-workspace")).toBeVisible();
  await expect(page.getByTestId("module-side-panel-title")).toHaveText(
    "고객관리",
  );
  const customerSidePanel = page.getByTestId("customer-side-panel");
  await expect(customerSidePanel).not.toContainText("Customer");
  await customerSidePanel
    .getByRole("button", { name: "보호자/동물 관리" })
    .click();
  await expect(page.getByTestId("customer-side-panel-patient")).toHaveCount(0);
  await customerSidePanel
    .getByRole("button", { name: "보호자/동물 관리" })
    .click();
  await expect(page.getByTestId("customer-side-panel-patient")).toBeVisible();
  await expect(page.getByTestId("customer-side-panel-patient")).toContainText(
    "5",
  );
  await expect(page.getByTestId("customer-side-panel-guardian")).toContainText(
    "5",
  );
  const scheduleFollowUp = customerSidePanel.getByRole("button", {
    name: /스케줄 관리/,
  });
  await expect(scheduleFollowUp).toBeDisabled();
  await expect(scheduleFollowUp).toContainText("미구현");
  await expect(
    customerSidePanel.getByRole("button", { name: "예약 일정" }),
  ).toHaveCount(0);
  await expect(
    page
      .getByTestId("customer-page-header")
      .getByRole("heading", { name: "동물" }),
  ).toBeVisible();
  await expect(page.getByTestId("customer-page-header")).not.toContainText(
    "스케줄 관리",
  );
  const inpatientNavBox = await page
    .getByRole("link", { name: "입원" })
    .boundingBox();
  const customerNavBox = await page
    .getByRole("link", { name: "고객관리" })
    .boundingBox();
  const hospitalAdminNavBox = await page
    .getByRole("link", { name: "병원관리" })
    .boundingBox();

  expect(inpatientNavBox).not.toBeNull();
  expect(customerNavBox).not.toBeNull();
  expect(hospitalAdminNavBox).not.toBeNull();
  expect(customerNavBox!.y - inpatientNavBox!.y).toBeGreaterThanOrEqual(48);
  expect(hospitalAdminNavBox!.y - customerNavBox!.y).toBeLessThan(52);
  await expect(page.getByTestId("customer-patient-table")).toBeVisible();
  const patientTable = page.getByRole("table", {
    name: "동물 고객관리 테이블",
  });
  const patientNameHeader = patientTable.locator("th", { hasText: "동물명" });
  await expect(patientNameHeader).toHaveAttribute(
    "data-emr-header-interaction",
    "static",
  );
  await expect(patientNameHeader).toHaveAttribute(
    "data-emr-column-resize",
    "none",
  );
  await expect(
    patientNameHeader.getByRole("button", {
      name: /동물명 오름차순 정렬/,
    }),
  ).toBeEnabled();
  await expect(
    patientTable.getByRole("button", {
      name: "품종 정렬은 현재 지원하지 않습니다",
    }),
  ).toBeDisabled();
  await expect(
    patientTable.locator("th", { hasText: "행 작업" }),
  ).toHaveAttribute("data-emr-column-resize", "none");
  await expect(
    page.getByTestId("customer-patient-row-patient-dubu"),
  ).toContainText("두부");
  await expect(
    page.getByTestId("customer-patient-row-patient-dubu"),
  ).toContainText("정하린");
  const dubuRow = page.getByTestId("customer-patient-row-patient-dubu");
  await expect(
    dubuRow.locator('[data-emr-cell-text-mode="one-line"]', {
      hasText: "두부",
    }),
  ).toBeVisible();
  await expect(
    dubuRow.locator('[data-emr-cell-text-mode="one-line"]', {
      hasText: /010-/,
    }),
  ).toBeVisible();
  await page
    .getByTestId("customer-patient-table")
    .getByRole("button", { name: "컬럼" })
    .click();
  await expect(page.getByText("표시 컬럼")).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByTestId("customer-patient-row-patient-dubu").click();

  await expect(page.getByText("환자 정보").first()).toBeVisible();
  await expect(page.getByRole("tab", { name: "환자 정보" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "카카오톡 발송" }),
  ).toBeVisible();
  await expect(page).toHaveURL(
    /drawer=patient%3Apatient-dubu|drawer=patient:patient-dubu/,
  );
});

test("customer patient table keeps animal identity pinned while data columns scroll", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1900, height: 1024 });
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto("/w/clair-demo/customer?modulePanel=open&aside=closed");

  const patientSection = page.getByTestId("customer-patient-table");
  const patientTable = page.getByRole("table", {
    name: "동물 고객관리 테이블",
  });
  const scrollContainer = patientTable.locator("xpath=..");
  const pinnedViewport = patientSection.locator(
    '[data-emr-pinned-table-viewport="true"]',
  );
  const pinnedDimmer = pinnedViewport.locator(
    '[data-emr-pinned-table-dimmer="true"]',
  );
  const pinnedDivider = pinnedViewport.locator(
    '[data-emr-pinned-table-divider="true"]',
  );
  const animalHeader = patientTable.locator(
    'th[data-customer-column-key="name"]',
  );
  const selectionHeader = patientTable
    .locator('thead th[data-emr-column-pinned="left"]')
    .first();
  const patientCodeHeader = patientTable.locator(
    'th[data-customer-column-key="patientNo"]',
  );
  const patientRows = patientTable.locator(
    'tbody tr[data-customer-table-row="true"]',
  );
  const firstPatientRow = patientRows.first();
  const subsequentPatientRow = patientRows.nth(1);
  const firstPatientCodeCell = firstPatientRow.locator(
    'td[data-customer-column-key="patientNo"]',
  );
  const subsequentPatientCodeCell = subsequentPatientRow.locator(
    'td[data-customer-column-key="patientNo"]',
  );
  const firstPatientCodeSurface = firstPatientCodeCell.locator("code");
  const subsequentPatientCodeSurface =
    subsequentPatientCodeCell.locator("code");
  const patientCodeHeaderSurface = patientCodeHeader.locator("button");
  const pinnedHeaderEdge = patientTable.locator(
    'thead th[data-emr-column-pinned="left"][data-emr-pinned-edge="true"]',
  );
  const firstPinnedBodyEdge = firstPatientRow.locator(
    'td[data-emr-column-pinned="left"][data-emr-pinned-edge="true"]',
  );
  const dubuRow = page.getByTestId("customer-patient-row-patient-dubu");
  const animalCell = dubuRow.locator('td[data-customer-column-key="name"]');
  const dubuPatientCodeCell = dubuRow.locator(
    'td[data-customer-column-key="patientNo"]',
  );
  const selectionCell = dubuRow
    .locator('td[data-emr-column-pinned="left"]')
    .first();
  const pageHeading = patientSection.getByRole("heading", { name: "동물" });
  const searchInput = patientSection.getByPlaceholder("동물 검색");
  const animalHeaderLabel = animalHeader.locator(
    '[data-customer-column-header-label="true"]',
  );
  const animalNameText = animalCell.locator(
    '[data-emr-cell-text-mode="one-line"]',
  );
  const footerTotal = patientSection
    .getByTestId("customer-table-footer")
    .locator("span")
    .first();

  await expect(patientSection).toHaveAttribute(
    "data-emr-pinned-table-workspace",
    "true",
  );
  await expect(patientTable).toHaveAttribute(
    "data-customer-pinned-identity",
    "name",
  );
  await expect(patientTable).toHaveCSS("min-width", "1480px");
  await expect(patientSection.getByTestId("customer-page-header")).toHaveCSS(
    "padding-top",
    "0px",
  );
  await expect(animalHeader).toHaveAttribute("data-emr-column-pinned", "left");
  await expect(selectionHeader).toHaveAttribute(
    "data-emr-column-pinned",
    "left",
  );
  await expect(selectionCell).toHaveCSS("position", "sticky");
  await expect(patientCodeHeader).not.toHaveAttribute(
    "data-emr-column-pinned",
    "left",
  );
  await expect(firstPatientRow).toBeVisible();
  await expect(subsequentPatientRow).toBeVisible();
  await expect(patientCodeHeaderSurface).toBeVisible();
  await expect(firstPatientCodeSurface).toBeVisible();
  await expect(subsequentPatientCodeSurface).toBeVisible();
  await expect(animalCell).toHaveCSS("position", "sticky");
  await expect(animalCell).toHaveCSS("white-space", "nowrap");
  await expect(
    dubuRow.locator('[data-emr-cell-text-mode="two-line-if-long"]'),
  ).toHaveCount(0);

  const visibleDataColumnOrder = await patientTable
    .locator("thead [data-customer-column-key]")
    .evaluateAll((headers) =>
      headers.map((header) => header.getAttribute("data-customer-column-key")),
    );
  expect(visibleDataColumnOrder.slice(0, 2)).toEqual(["name", "patientNo"]);

  await expect(animalCell.getByTestId("animal-patient-avatar")).toHaveCount(0);

  const [headingBox, searchBox, headerLabelBox, animalNameBox, footerTotalBox] =
    await Promise.all([
      pageHeading.boundingBox(),
      searchInput.boundingBox(),
      animalHeaderLabel.boundingBox(),
      animalNameText.boundingBox(),
      footerTotal.boundingBox(),
    ]);

  expect(headingBox).not.toBeNull();
  expect(searchBox).not.toBeNull();
  expect(headerLabelBox).not.toBeNull();
  expect(animalNameBox).not.toBeNull();
  expect(footerTotalBox).not.toBeNull();
  expect(Math.abs(searchBox!.x - headingBox!.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(headerLabelBox!.x - headingBox!.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(animalNameBox!.x - headingBox!.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(footerTotalBox!.x - headingBox!.x)).toBeLessThanOrEqual(1);

  await scrollContainer.evaluate((container) => {
    container.scrollLeft = 0;
  });
  await expect
    .poll(async () =>
      scrollContainer.evaluate((container) => container.scrollLeft),
    )
    .toBe(0);

  const [
    pinnedHeaderEdgeBox,
    patientCodeHeaderBox,
    patientCodeHeaderSurfaceBox,
    firstPinnedBodyEdgeBox,
    firstPatientCodeCellBox,
    firstPatientCodeSurfaceBox,
    subsequentPatientCodeCellBox,
    subsequentPatientCodeSurfaceBox,
  ] = await Promise.all([
    pinnedHeaderEdge.boundingBox(),
    patientCodeHeader.boundingBox(),
    patientCodeHeaderSurface.boundingBox(),
    firstPinnedBodyEdge.boundingBox(),
    firstPatientCodeCell.boundingBox(),
    firstPatientCodeSurface.boundingBox(),
    subsequentPatientCodeCell.boundingBox(),
    subsequentPatientCodeSurface.boundingBox(),
  ]);

  for (const [label, box] of [
    ["pinned header edge", pinnedHeaderEdgeBox],
    ["patient-code header", patientCodeHeaderBox],
    ["patient-code header surface", patientCodeHeaderSurfaceBox],
    ["pinned body edge", firstPinnedBodyEdgeBox],
    ["first patient-code cell", firstPatientCodeCellBox],
    ["first patient-code surface", firstPatientCodeSurfaceBox],
    ["subsequent patient-code cell", subsequentPatientCodeCellBox],
    ["subsequent patient-code surface", subsequentPatientCodeSurfaceBox],
  ] as const) {
    expect(box, `${label} is not measurable`).not.toBeNull();
  }

  for (const [label, edgeBox, cellBox, surfaceBox] of [
    [
      "header",
      pinnedHeaderEdgeBox,
      patientCodeHeaderBox,
      patientCodeHeaderSurfaceBox,
    ],
    [
      "first body",
      firstPinnedBodyEdgeBox,
      firstPatientCodeCellBox,
      firstPatientCodeSurfaceBox,
    ],
    [
      "subsequent body",
      firstPinnedBodyEdgeBox,
      subsequentPatientCodeCellBox,
      subsequentPatientCodeSurfaceBox,
    ],
  ] as const) {
    expect(
      surfaceBox!.x - (edgeBox!.x + edgeBox!.width),
      `${label} inset`,
    ).toBeGreaterThanOrEqual(9);
    expect(
      surfaceBox!.x - (edgeBox!.x + edgeBox!.width),
      `${label} inset`,
    ).toBeLessThanOrEqual(11);
    expect(surfaceBox!.x).toBeGreaterThanOrEqual(cellBox!.x - 1);
    expect(surfaceBox!.y).toBeGreaterThanOrEqual(cellBox!.y - 1);
    expect(surfaceBox!.x + surfaceBox!.width).toBeLessThanOrEqual(
      cellBox!.x + cellBox!.width + 1,
    );
    expect(surfaceBox!.y + surfaceBox!.height).toBeLessThanOrEqual(
      cellBox!.y + cellBox!.height + 1,
    );
  }

  const [
    headerSurfaceStyles,
    firstBodySurfaceStyles,
    subsequentBodySurfaceStyles,
  ] = await Promise.all(
    [
      patientCodeHeaderSurface,
      firstPatientCodeSurface,
      subsequentPatientCodeSurface,
    ].map((surface) =>
      surface.evaluate((element) => {
        const styles = getComputedStyle(element);
        return {
          borderRadius: styles.borderRadius,
          backgroundColor: styles.backgroundColor,
        };
      }),
    ),
  );

  for (const [label, styles] of [
    ["header", headerSurfaceStyles],
    ["first body", firstBodySurfaceStyles],
    ["subsequent body", subsequentBodySurfaceStyles],
  ] as const) {
    expect(parseFloat(styles.borderRadius), `${label} radius`).toBeGreaterThan(
      0,
    );
    if (label !== "header") {
      expect(styles.backgroundColor, `${label} surface background`).not.toBe(
        "rgba(0, 0, 0, 0)",
      );
    }
  }

  const contentHookStyles = await Promise.all(
    [
      patientCodeHeader.locator('[data-emr-table-content="true"]'),
      firstPatientCodeCell.locator('[data-emr-table-content="true"]'),
      subsequentPatientCodeCell.locator('[data-emr-table-content="true"]'),
    ].map((hook) =>
      hook.evaluate((element) => {
        const styles = getComputedStyle(element);
        return {
          marginInlineStart: styles.marginInlineStart,
          paddingInlineStart: styles.paddingInlineStart,
        };
      }),
    ),
  );
  for (const [label, styles] of [
    ["header", contentHookStyles[0]],
    ["first body", contentHookStyles[1]],
    ["subsequent body", contentHookStyles[2]],
  ] as const) {
    expect(styles.marginInlineStart, `${label} content margin`).toBe("10px");
    expect(styles.paddingInlineStart, `${label} content padding`).toBe("0px");
  }

  const edgeStyles = await Promise.all(
    [pinnedHeaderEdge, firstPinnedBodyEdge].map((edge) =>
      edge.evaluate((element) => {
        return {
          boxShadow: getComputedStyle(element).boxShadow,
        };
      }),
    ),
  );
  for (const [label, styles] of [
    ["header", edgeStyles[0]],
    ["body", edgeStyles[1]],
  ] as const) {
    expect(styles.boxShadow, `${label} edge shadow`).toBe("none");
  }

  const boundaryStyles = await pinnedViewport.evaluate((viewport) => {
    const dimmer = viewport.querySelector(
      '[data-emr-pinned-table-dimmer="true"]',
    );
    const divider = viewport.querySelector(
      '[data-emr-pinned-table-divider="true"]',
    );
    if (!(dimmer instanceof HTMLElement) || !(divider instanceof HTMLElement)) {
      throw new Error("Pinned boundary layers are missing.");
    }
    const dimmerStyle = getComputedStyle(dimmer);
    const dividerStyle = getComputedStyle(divider);
    return {
      pinnedColumnWidth: getComputedStyle(viewport)
        .getPropertyValue("--emr-table-pinned-column-width")
        .trim(),
      dimmer: {
        backgroundColor: dimmerStyle.backgroundColor,
        boxShadow: dimmerStyle.boxShadow,
        opacity: dimmerStyle.opacity,
        pointerEvents: dimmerStyle.pointerEvents,
        position: dimmerStyle.position,
        width: dimmerStyle.width,
        zIndex: Number.parseInt(dimmerStyle.zIndex, 10),
      },
      divider: {
        backgroundColor: dividerStyle.backgroundColor,
        pointerEvents: dividerStyle.pointerEvents,
        position: dividerStyle.position,
        width: dividerStyle.width,
        zIndex: Number.parseInt(dividerStyle.zIndex, 10),
      },
    };
  });
  expect(boundaryStyles.pinnedColumnWidth).toBe("228px");
  expect(boundaryStyles.dimmer).toMatchObject({
    backgroundColor: "rgb(0, 0, 0)",
    boxShadow: "none",
    opacity: "0.4",
    pointerEvents: "none",
    position: "absolute",
    width: "10px",
  });
  expect(boundaryStyles.dimmer.zIndex).toBeGreaterThan(12);
  expect(boundaryStyles.divider).toMatchObject({
    pointerEvents: "none",
    position: "absolute",
    width: "1px",
  });
  expect(boundaryStyles.divider.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
  expect(boundaryStyles.divider.zIndex).toBeGreaterThan(
    boundaryStyles.dimmer.zIndex,
  );

  for (const width of [1900, 1440, 1280, 1024]) {
    await page.setViewportSize({ width, height: 1024 });
    const canScroll = await scrollContainer.evaluate(
      (container) => container.scrollWidth > container.clientWidth,
    );
    await scrollContainer.evaluate((container) => {
      container.scrollLeft = 600;
    });

    if (canScroll) {
      await expect
        .poll(async () =>
          scrollContainer.evaluate((container) => container.scrollLeft),
        )
        .toBeGreaterThan(0);
    } else {
      await expect
        .poll(async () =>
          scrollContainer.evaluate((container) => container.scrollLeft),
        )
        .toBe(0);
    }
    const [
      viewportBox,
      containerBox,
      selectionHeaderBox,
      pinnedHeaderBox,
      dimmerBox,
      dividerBox,
      documentOverflow,
    ] = await Promise.all([
      pinnedViewport.boundingBox(),
      scrollContainer.boundingBox(),
      selectionHeader.boundingBox(),
      animalHeader.boundingBox(),
      pinnedDimmer.boundingBox(),
      pinnedDivider.boundingBox(),
      page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      ),
    ]);
    expect(viewportBox).not.toBeNull();
    expect(containerBox).not.toBeNull();
    expect(selectionHeaderBox).not.toBeNull();
    expect(pinnedHeaderBox).not.toBeNull();
    expect(dimmerBox).not.toBeNull();
    expect(dividerBox).not.toBeNull();
    expect(
      Math.abs(selectionHeaderBox!.x - containerBox!.x),
    ).toBeLessThanOrEqual(1);
    expect(
      Math.abs(
        pinnedHeaderBox!.x - selectionHeaderBox!.x - selectionHeaderBox!.width,
      ),
    ).toBeLessThanOrEqual(1);
    expect(Math.abs(dimmerBox!.x - viewportBox!.x - 228)).toBeLessThanOrEqual(1);
    expect(Math.abs(dividerBox!.x - viewportBox!.x - 227)).toBeLessThanOrEqual(1);
    expect(Math.abs(dimmerBox!.height - viewportBox!.height)).toBeLessThanOrEqual(
      1,
    );
    expect(Math.abs(dividerBox!.height - viewportBox!.height)).toBeLessThanOrEqual(
      1,
    );
    expect(documentOverflow).toBe(0);
  }

  const horizontalOverflowOwners = await patientSection.evaluate((root) =>
    Array.from(root.querySelectorAll<HTMLElement>("*"))
      .filter((element) => {
        const overflowX = getComputedStyle(element).overflowX;
        return overflowX === "auto" || overflowX === "scroll";
      })
      .map((element) => element.getAttribute("data-slot")),
  );
  expect(horizontalOverflowOwners).toEqual(["table-container"]);

  await expect(scrollContainer).toHaveCSS("overscroll-behavior-x", "none");
  await expect(scrollContainer).toHaveCSS("overscroll-behavior-y", "none");
  await scrollContainer.evaluate((container) => {
    container.scrollLeft = 0;
  });
  await scrollContainer.hover();
  await page.mouse.wheel(120, 0);
  await expect
    .poll(() => scrollContainer.evaluate((container) => container.scrollLeft))
    .toBeGreaterThan(0);

  await page.setViewportSize({ width: 1900, height: 1024 });
  await scrollContainer.evaluate((container) => {
    container.scrollLeft = 600;
  });

  await dubuRow.hover();
  const [hoverPinnedBackground, expectedHoverBackground] = await Promise.all([
    animalCell.evaluate((cell) => getComputedStyle(cell).backgroundColor),
    page.evaluate(() => {
      const probe = document.createElement("div");
      probe.style.backgroundColor = "var(--emr-surface-hover)";
      document.body.appendChild(probe);
      const color = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return color;
    }),
  ]);

  expect(hoverPinnedBackground).toBe(expectedHoverBackground);
  await expect(dubuPatientCodeCell).toHaveCSS(
    "background-color",
    "rgba(0, 0, 0, 0)",
  );

  await dubuRow.click();
  await expect(dubuRow).toHaveAttribute("data-state", "selected");
  const [selectedPinnedBackground, expectedSelectedBackground] =
    await Promise.all([
      animalCell.evaluate((cell) => getComputedStyle(cell).backgroundColor),
      page.evaluate(() => {
        const probe = document.createElement("div");
        probe.style.backgroundColor = "var(--emr-surface-selected)";
        document.body.appendChild(probe);
        const color = getComputedStyle(probe).backgroundColor;
        probe.remove();
        return color;
      }),
    ]);

  expect(selectedPinnedBackground).toBe(expectedSelectedBackground);
  await expect(dubuPatientCodeCell).toHaveCSS(
    "background-color",
    "rgba(0, 0, 0, 0)",
  );

  await page.getByTestId("customer-side-panel-guardian").click();
  const guardianTable = page.getByRole("table", {
    name: "보호자 고객관리 테이블",
  });
  const guardianHeader = guardianTable.locator(
    'th[data-customer-column-key="name"]',
  );
  const guardianCell = page
    .getByTestId("customer-guardian-row-guardian-kang-seoyun")
    .locator('td[data-customer-column-key="name"]');
  const guardianPinnedViewport = page
    .getByTestId("customer-guardian-table")
    .locator('[data-emr-pinned-table-viewport="true"]');
  await expect(guardianTable).toHaveAttribute(
    "data-customer-pinned-identity",
    "name",
  );
  await expect(guardianHeader).toHaveAttribute(
    "data-emr-column-pinned",
    "left",
  );
  await expect(guardianCell).toHaveCSS("position", "sticky");
  await expect(guardianPinnedViewport).toHaveCSS(
    "--emr-table-pinned-column-width",
    "228px",
  );
  await expect(
    guardianPinnedViewport.locator(
      '[data-emr-pinned-table-dimmer="true"]',
    ),
  ).toHaveCount(1);
});

test("customer table aligns selection header and row checkboxes", async ({
  page,
}) => {
  await page.goto("/w/clair-demo/customer?modulePanel=open&aside=closed");

  const table = page.getByRole("table", { name: "동물 고객관리 테이블" });
  const row = page.getByTestId("customer-patient-row-patient-coco");

  await expect(table).toBeVisible();
  await expect(row).toBeVisible();

  const selectAllPatient = table.getByRole("checkbox", {
    name: "동물 전체 선택",
  });
  const rowCheckbox = row.getByRole("checkbox", { name: "코코 선택" });
  const rowCheckboxControl = rowCheckbox.locator("xpath=..");
  await expect(selectAllPatient).toHaveCSS("width", "16px");
  await expect(selectAllPatient).toHaveCSS("height", "16px");
  await expect(rowCheckbox).toHaveCSS("width", "16px");
  await expect(rowCheckbox).toHaveCSS("height", "16px");
  await expect(selectAllPatient).toHaveCSS("opacity", "1");
  await expect(rowCheckboxControl).toHaveCSS("opacity", "0");
  await row.hover();
  await expect(rowCheckboxControl).toHaveCSS("opacity", "1");
  await expect
    .poll(async () => {
      const headerCell = await table.locator("th").first().boundingBox();
      const rowCell = await row.locator("td").first().boundingBox();
      if (!headerCell || !rowCell) return Number.POSITIVE_INFINITY;

      return Math.abs(
        headerCell.x + headerCell.width / 2 - (rowCell.x + rowCell.width / 2),
      );
    })
    .toBeLessThanOrEqual(1);
});

test("guardian list matches the Figma geometry, surfaces, controls, and responsive contract", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  await page.setViewportSize({ width: 1900, height: 1024 });
  await page.goto("/w/clair-demo/customer?modulePanel=open&aside=closed");

  const patientSection = page.getByTestId("customer-patient-table");
  await expect(patientSection).toHaveCSS(
    "background-color",
    "rgb(252, 252, 252)",
  );
  await expect
    .poll(() =>
      page
        .getByTestId("customer-workspace")
        .locator('[data-slot="emr-main-content-header"]')
        .evaluate((slot) => slot.getBoundingClientRect().height),
    )
    .toBe(44);

  await page.getByTestId("customer-side-panel-guardian").click();

  const section = page.getByTestId("customer-guardian-table");
  const table = section.getByRole("table", {
    name: "보호자 고객관리 테이블",
  });
  const firstRow = page.getByTestId(
    "customer-guardian-row-guardian-kang-seoyun",
  );
  const firstCellContent = firstRow
    .locator('[data-emr-customer-cell-content="true"]')
    .first();
  const footer = section.getByTestId("customer-table-footer");
  const guardianHeading = section.getByRole("heading", {
    name: "보호자",
  });
  const guardianSearch = section.getByPlaceholder("보호자 검색");
  const guardianHeaderLabel = table
    .locator('th[data-customer-column-key="name"]')
    .locator('[data-customer-column-header-label="true"]');
  const guardianNameText = firstRow
    .locator('td[data-customer-column-key="name"]')
    .locator('[data-emr-cell-text-mode="two-line-if-long"]');
  const footerTotal = footer.locator("span").first();

  await expect(section).toBeVisible();
  await expect(section).toHaveAttribute(
    "data-emr-pinned-table-workspace",
    "true",
  );
  await expect(table).toHaveAttribute("data-customer-pinned-identity", "name");
  await expect(
    table.locator('th[data-customer-column-key="name"]'),
  ).toHaveAttribute("data-emr-column-pinned", "left");
  await expect(firstRow).toBeVisible();
  await expect(footer).toContainText("총 5건");
  await expect(footer).toContainText("1/1 페이지");
  await expect(footer.getByRole("button", { name: "이전" })).toBeDisabled();
  await expect(footer.getByRole("button", { name: "다음" })).toBeDisabled();
  await expect(
    section.getByRole("button", { name: "환자/보호자 등록" }),
  ).toHaveCSS("background-color", "rgb(23, 23, 23)");

  for (const controlName of [
    "보호자 필터 설정",
    "테이블 보기 밀도: 기본 간격",
    "보호자 컬럼 표시 설정",
  ]) {
    const control = section.getByRole("button", { name: controlName });
    await expect(control).toBeVisible();
    await expect(control).toHaveCSS("height", "32px");
  }

  const [
    guardianHeadingBox,
    guardianSearchBox,
    guardianHeaderLabelBox,
    guardianNameBox,
    footerTotalBox,
  ] = await Promise.all([
    guardianHeading.boundingBox(),
    guardianSearch.boundingBox(),
    guardianHeaderLabel.boundingBox(),
    guardianNameText.boundingBox(),
    footerTotal.boundingBox(),
  ]);
  expect(guardianHeadingBox).not.toBeNull();
  expect(guardianSearchBox).not.toBeNull();
  expect(guardianHeaderLabelBox).not.toBeNull();
  expect(guardianNameBox).not.toBeNull();
  expect(footerTotalBox).not.toBeNull();
  expect(
    Math.abs(guardianSearchBox!.x - guardianHeadingBox!.x),
  ).toBeLessThanOrEqual(1);
  expect(
    Math.abs(guardianHeaderLabelBox!.x - guardianHeadingBox!.x),
  ).toBeLessThanOrEqual(1);
  expect(
    Math.abs(guardianNameBox!.x - guardianHeadingBox!.x),
  ).toBeLessThanOrEqual(1);
  expect(
    Math.abs(footerTotalBox!.x - guardianHeadingBox!.x),
  ).toBeLessThanOrEqual(1);

  const geometry = await section.evaluate((root) => {
    const header = root.querySelector(
      '[data-testid="customer-page-header"]',
    ) as HTMLElement;
    const heading = header.querySelector("h1, h2, h3") as HTMLElement;
    const search = header.querySelector(
      'input[aria-label="고객관리 검색"]',
    ) as HTMLElement;
    const tableContainer = root.querySelector(
      '[data-slot="table-container"]',
    ) as HTMLElement;
    const tableElement = root.querySelector("table") as HTMLElement;
    const tableHeaderRow = root.querySelector("thead tr") as HTMLElement;
    const firstTableRow = root.querySelector("tbody tr") as HTMLElement;
    const dataRow = root.querySelector(
      '[data-testid="customer-guardian-row-guardian-kang-seoyun"]',
    ) as HTMLElement;
    const longContentRow = root.querySelector(
      '[data-testid="customer-guardian-row-guardian-lee-jieun"]',
    ) as HTMLElement;
    const dataCellContent = dataRow.querySelector(
      '[data-emr-customer-cell-content="true"]',
    ) as HTMLElement;
    const footerElement = root.querySelector(
      '[data-testid="customer-table-footer"]',
    ) as HTMLElement;
    const rootRect = root.getBoundingClientRect();
    const headerRect = header.getBoundingClientRect();
    const tableContainerRect = tableContainer.getBoundingClientRect();
    const tableRect = tableElement.getBoundingClientRect();
    const tableHeaderRect = tableHeaderRow.getBoundingClientRect();
    const firstTableRowRect = firstTableRow.getBoundingClientRect();

    return {
      rootWidth: rootRect.width,
      rootBackground: getComputedStyle(root).backgroundColor,
      headerOffset: headerRect.top - rootRect.top,
      headerHeight: headerRect.height,
      headerBackground: getComputedStyle(header).backgroundColor,
      headerPadding: [
        getComputedStyle(header).paddingTop,
        getComputedStyle(header).paddingRight,
        getComputedStyle(header).paddingBottom,
        getComputedStyle(header).paddingLeft,
      ],
      headerGap: getComputedStyle(header).rowGap,
      headingFont: [
        getComputedStyle(heading).fontSize,
        getComputedStyle(heading).lineHeight,
        getComputedStyle(heading).fontWeight,
      ],
      searchWidth: search.getBoundingClientRect().width,
      tableContainerClientWidth: tableContainer.clientWidth,
      tableContainerWidth: tableContainerRect.width,
      tableWidth: tableRect.width,
      tableHeaderBackground: getComputedStyle(tableHeaderRow).backgroundColor,
      tableHeaderHeight: tableHeaderRect.height,
      tableHeaderToFirstRowGap: firstTableRowRect.top - tableHeaderRect.bottom,
      rowBackground: getComputedStyle(dataRow).backgroundColor,
      rowBorder: getComputedStyle(dataRow).borderBottomColor,
      rowHeight: dataRow.getBoundingClientRect().height,
      longContentRowHeight: longContentRow.getBoundingClientRect().height,
      cellPadding: [
        getComputedStyle(dataCellContent).paddingLeft,
        getComputedStyle(dataCellContent).paddingRight,
      ],
      footerBackground: getComputedStyle(footerElement).backgroundColor,
      footerHeight: footerElement.getBoundingClientRect().height,
      footerPadding: [
        getComputedStyle(footerElement).paddingTop,
        getComputedStyle(footerElement).paddingRight,
        getComputedStyle(footerElement).paddingBottom,
        getComputedStyle(footerElement).paddingLeft,
      ],
    };
  });

  expect(geometry.rootBackground).toBe("rgb(252, 252, 252)");
  expect(geometry.headerOffset).toBe(0);
  expect(geometry.headerHeight).toBe(108);
  expect(geometry.headerBackground).toBe("rgb(252, 252, 252)");
  expect(geometry.headerPadding).toEqual(["0px", "48px", "16px", "48px"]);
  expect(geometry.headerGap).toBe("12px");
  expect(geometry.headingFont).toEqual(["24px", "32px", "700"]);
  expect(geometry.searchWidth).toBe(320);
  expect(geometry.tableHeaderBackground).toBe("rgb(250, 250, 250)");
  expect(geometry.tableHeaderHeight).toBeGreaterThanOrEqual(36);
  expect(geometry.tableHeaderHeight).toBeLessThanOrEqual(36.5);
  expect(Math.abs(geometry.tableHeaderToFirstRowGap)).toBeLessThanOrEqual(0.5);
  expect(geometry.rowBackground).toBe("rgb(255, 255, 255)");
  expect(geometry.rowBorder).toBe("rgb(229, 229, 229)");
  expect(geometry.rowHeight).toBe(40);
  expect(geometry.longContentRowHeight).toBeGreaterThanOrEqual(
    geometry.rowHeight,
  );
  expect(geometry.cellPadding).toEqual(["0px", "0px"]);
  expect(geometry.footerBackground).toBe("rgb(252, 252, 252)");
  expect(geometry.footerHeight).toBe(64);
  expect(geometry.footerPadding).toEqual(["14px", "48px", "14px", "48px"]);
  expect(
    Math.abs(geometry.tableWidth - geometry.tableContainerClientWidth),
  ).toBeLessThanOrEqual(1);
  expect(
    Math.abs(geometry.rootWidth - geometry.tableContainerWidth),
  ).toBeLessThanOrEqual(1);

  const sortableHeader = table.getByRole("button", {
    name: /보호자명 오름차순 정렬/,
  });
  const plannedSortHeader = table.getByRole("button", {
    name: "휴대전화 정렬은 현재 지원하지 않습니다",
  });
  const sortButtonGeometry = await sortableHeader.evaluate((button) => {
    const style = getComputedStyle(button);
    const icon = button.querySelector("img") as HTMLElement;
    const rect = button.getBoundingClientRect();
    return {
      height: rect.height,
      iconHeight: icon.getBoundingClientRect().height,
      iconWidth: icon.getBoundingClientRect().width,
      padding: [
        style.paddingTop,
        style.paddingRight,
        style.paddingBottom,
        style.paddingLeft,
      ],
    };
  });

  expect(sortButtonGeometry.height).toBe(24);
  expect(sortButtonGeometry.iconHeight).toBeCloseTo(7.75, 1);
  expect(sortButtonGeometry.iconWidth).toBeCloseTo(6.75, 1);
  expect(sortButtonGeometry.padding).toEqual(["4px", "0px", "4px", "0px"]);
  await expect(sortableHeader).toBeEnabled();
  await expect(plannedSortHeader).toBeDisabled();

  const firstRowCheckboxInput = firstRow.getByRole("checkbox");
  const firstRowCheckbox = firstRow.locator('[data-slot="checkbox"]');
  await firstRow.hover();
  await expect(firstRowCheckbox).toBeVisible();
  await firstRowCheckboxInput.focus();

  const uncheckedCheckbox = await firstRowCheckbox.evaluate((checkbox) => {
    const rootStyle = getComputedStyle(checkbox);
    const surfaceStyle = getComputedStyle(checkbox, "::before");
    const rect = checkbox.getBoundingClientRect();
    return {
      height: rect.height,
      width: rect.width,
      opacity: rootStyle.opacity,
      borderColor: surfaceStyle.borderColor,
      background: surfaceStyle.backgroundColor,
      boxShadow: surfaceStyle.boxShadow,
    };
  });

  expect(uncheckedCheckbox).toMatchObject({
    height: 16,
    width: 16,
    opacity: "1",
    borderColor: "rgb(212, 212, 212)",
    background: "rgb(255, 255, 255)",
  });
  expect(uncheckedCheckbox.boxShadow).not.toBe("none");

  await page.keyboard.press("Space");
  await expect(firstRowCheckboxInput).toBeChecked();
  await expect(page.getByText("선택한 보호자 1개")).toBeVisible();
  await expect(page.getByText("보호자 정보").first()).toHaveCount(0);

  const checkedCheckbox = await firstRowCheckbox.evaluate((checkbox) => {
    const surfaceStyle = getComputedStyle(checkbox, "::before");
    const indicator = checkbox.querySelector(
      '[data-slot="checkbox-indicator"] img',
    ) as HTMLElement;
    return {
      background: surfaceStyle.backgroundColor,
      borderColor: surfaceStyle.borderColor,
      indicatorHeight: indicator.getBoundingClientRect().height,
      indicatorWidth: indicator.getBoundingClientRect().width,
    };
  });

  expect(checkedCheckbox.background).toBe("rgb(23, 23, 23)");
  expect(checkedCheckbox.borderColor).toBe("rgb(23, 23, 23)");
  expect(checkedCheckbox.indicatorHeight).toBeCloseTo(7.29, 1);
  expect(checkedCheckbox.indicatorWidth).toBeCloseTo(10.21, 1);

  const headerCheckbox = table.getByRole("checkbox", {
    name: "보호자 전체 선택",
  });
  await expect(headerCheckbox).toBeChecked({ indeterminate: true });

  await section
    .getByRole("button", { name: "테이블 보기 밀도: 기본 간격" })
    .click();
  const comfortableDensityOption = page.getByRole("menuitemradio", {
    name: "넓은 간격",
  });
  await expect(comfortableDensityOption).toBeVisible();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await expect
    .poll(() =>
      firstCellContent.evaluate(
        (element) => element.parentElement?.getBoundingClientRect().height,
      ),
    )
    .toBe(52);
  await section
    .getByRole("button", { name: "테이블 보기 밀도: 넓은 간격" })
    .click();
  const standardDensityOption = page.getByRole("menuitemradio", {
    name: "기본 간격",
  });
  await expect(standardDensityOption).toBeVisible();
  await standardDensityOption.evaluate((option) =>
    (option as HTMLElement).click(),
  );
  await expect
    .poll(() =>
      firstCellContent.evaluate(
        (element) => element.parentElement?.getBoundingClientRect().height,
      ),
    )
    .toBe(40);

  await page
    .getByRole("button", { name: "사이드 패널 접기", exact: true })
    .click();
  await page.setViewportSize({ width: 1000, height: 900 });

  const narrowMetrics = await section.evaluate((root) => {
    const header = root.querySelector(
      '[data-testid="customer-page-header"]',
    ) as HTMLElement;
    const tableContainer = root.querySelector(
      '[data-slot="table-container"]',
    ) as HTMLElement;
    const footerElement = root.querySelector(
      '[data-testid="customer-table-footer"]',
    ) as HTMLElement;
    return {
      clientWidth: tableContainer.clientWidth,
      scrollWidth: tableContainer.scrollWidth,
      headerPaddingLeft: getComputedStyle(header).paddingLeft,
      headerPaddingRight: getComputedStyle(header).paddingRight,
      footerPaddingLeft: getComputedStyle(footerElement).paddingLeft,
      footerPaddingRight: getComputedStyle(footerElement).paddingRight,
    };
  });

  expect(narrowMetrics.scrollWidth).toBeGreaterThanOrEqual(1120);
  expect(narrowMetrics.scrollWidth).toBeGreaterThan(narrowMetrics.clientWidth);
  expect(narrowMetrics).toMatchObject({
    headerPaddingLeft: "48px",
    headerPaddingRight: "48px",
    footerPaddingLeft: "48px",
    footerPaddingRight: "48px",
  });

  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect
    .poll(() =>
      firstRowCheckbox.evaluate(
        (checkbox) =>
          getComputedStyle(checkbox.parentElement as HTMLElement)
            .transitionDuration,
      ),
    )
    .toBe("0s");
  expect(
    await page.evaluate(
      () => matchMedia("(prefers-reduced-motion: reduce)").matches,
    ),
  ).toBe(true);
  const unexpectedConsoleErrors = consoleErrors.filter(
    (message) =>
      message !==
      "Failed to load resource: the server responded with a status of 401 (Unauthorized)",
  );
  expect(unexpectedConsoleErrors).toEqual([]);
});

test("customer side panel matches CDS.V2 module-list geometry, type, and color", async ({
  page,
}) => {
  await page.goto("/w/clair-demo/customer?modulePanel=open");

  const panelMetrics = await page
    .getByTestId("customer-side-panel")
    .evaluate((panel) => {
      const body = panel.querySelector('[data-emr-module-list-body="true"]');
      const group = panel.querySelector('[data-emr-module-list-group="true"]');
      const section = group?.querySelector("section");
      const trigger = section?.querySelector('button[aria-expanded="true"]');
      const icon = trigger?.querySelector(
        '[data-emr-module-list-section-icon="true"]',
      );
      const label = trigger?.querySelector(
        '[data-emr-module-list-item-label="true"]',
      );
      const action = trigger?.querySelector(
        '[data-emr-module-list-action="true"]',
      );
      const rail = section?.querySelector(
        '[data-emr-module-list-child-rail="true"]',
      );
      const childList = section?.querySelector(
        '[data-emr-module-list-child-list="true"]',
      );
      const selectedLeaf = section?.querySelector(
        '[data-testid="customer-side-panel-patient"]',
      );
      const selectedLeafLabel = selectedLeaf?.querySelector(
        '[data-emr-module-list-item-label="true"]',
      );
      const selectedLeafBadge = selectedLeaf?.querySelector(
        '[data-emr-module-list-badge="true"]',
      );
      const disabledItem = [...panel.querySelectorAll("button")].find((item) =>
        item.textContent?.includes("스케줄 관리"),
      );
      const disabledIcon = disabledItem?.querySelector(
        '[data-emr-module-list-item-icon="true"]',
      );
      const disabledLabel = disabledItem?.querySelector(
        '[data-emr-module-list-item-label="true"]',
      );

      if (
        !body ||
        !group ||
        !section ||
        !trigger ||
        !icon ||
        !label ||
        !action ||
        !rail ||
        !childList ||
        !selectedLeaf ||
        !selectedLeafLabel ||
        !selectedLeafBadge ||
        !disabledItem ||
        !disabledIcon ||
        !disabledLabel
      ) {
        throw new Error("Missing customer module list layout target");
      }

      const panelRect = panel.getBoundingClientRect();
      const bodyRect = body.getBoundingClientRect();
      const sectionRect = section.getBoundingClientRect();
      const triggerRect = trigger.getBoundingClientRect();
      const iconRect = icon.getBoundingClientRect();
      const labelRect = label.getBoundingClientRect();
      const railRect = rail.getBoundingClientRect();
      const childListRect = childList.getBoundingClientRect();
      const leafRect = selectedLeaf.getBoundingClientRect();
      const badgeRect = selectedLeafBadge.getBoundingClientRect();
      const disabledRect = disabledItem.getBoundingClientRect();
      const triggerStyle = getComputedStyle(trigger);
      const iconStyle = getComputedStyle(icon);
      const labelStyle = getComputedStyle(label);
      const actionStyle = getComputedStyle(action);
      const railStyle = getComputedStyle(rail);
      const childListStyle = getComputedStyle(childList);
      const leafStyle = getComputedStyle(selectedLeaf);
      const leafLabelStyle = getComputedStyle(selectedLeafLabel);
      const badgeStyle = getComputedStyle(selectedLeafBadge);
      const disabledIconStyle = getComputedStyle(disabledIcon);
      const disabledLabelStyle = getComputedStyle(disabledLabel);

      return {
        actionMarginLeft: actionStyle.marginLeft,
        actionSize: action.getBoundingClientRect().width,
        badgeBackground: badgeStyle.backgroundColor,
        badgeColor: badgeStyle.color,
        badgeFontSize: badgeStyle.fontSize,
        badgeHeight: badgeRect.height,
        badgeLetterSpacing: badgeStyle.letterSpacing,
        badgeLineHeight: badgeStyle.lineHeight,
        badgePaddingBottom: badgeStyle.paddingBottom,
        badgePaddingLeft: badgeStyle.paddingLeft,
        badgePaddingRight: badgeStyle.paddingRight,
        badgePaddingTop: badgeStyle.paddingTop,
        badgeWeight: badgeStyle.fontWeight,
        bodyWidth: bodyRect.width,
        childListHeight: childListRect.height,
        childListOffset: childListRect.left - sectionRect.left,
        childListRowGap: childListStyle.rowGap,
        disabledHeight: disabledRect.height,
        disabledIconColor: disabledIconStyle.color,
        disabledLabelColor: disabledLabelStyle.color,
        disabledWidth: disabledRect.width,
        groupRowGap: getComputedStyle(group).rowGap,
        groupWidth: group.getBoundingClientRect().width,
        iconColor: iconStyle.color,
        iconLabelGap: labelRect.left - iconRect.right,
        iconWidth: iconRect.width,
        itemHeight: triggerRect.height,
        itemLabelColor: labelStyle.color,
        itemLabelFontSize: labelStyle.fontSize,
        itemLabelLetterSpacing: labelStyle.letterSpacing,
        itemLabelLineHeight: labelStyle.lineHeight,
        itemLabelWeight: labelStyle.fontWeight,
        itemPaddingBottom: triggerStyle.paddingBottom,
        itemPaddingLeft: triggerStyle.paddingLeft,
        itemPaddingRight: triggerStyle.paddingRight,
        itemPaddingTop: triggerStyle.paddingTop,
        itemWidth: triggerRect.width,
        leafBackground: leafStyle.backgroundColor,
        leafHeight: leafRect.height,
        leafLabelColor: leafLabelStyle.color,
        leafLabelFontSize: leafLabelStyle.fontSize,
        leafLabelLetterSpacing: leafLabelStyle.letterSpacing,
        leafLabelLineHeight: leafLabelStyle.lineHeight,
        leafLabelWeight: leafLabelStyle.fontWeight,
        leafPaddingBottom: leafStyle.paddingBottom,
        leafPaddingLeft: leafStyle.paddingLeft,
        leafPaddingRight: leafStyle.paddingRight,
        leafPaddingTop: leafStyle.paddingTop,
        leafRightInset: panelRect.right - leafRect.right,
        leafWidth: leafRect.width,
        panelWidth: panel.getBoundingClientRect().width,
        railColor: railStyle.backgroundColor,
        railHeight: railRect.height,
        railOffset: railRect.left + railRect.width / 2 - sectionRect.left,
      };
    });

  expect(Math.round(panelMetrics.panelWidth)).toBe(288);
  expect(Math.round(panelMetrics.bodyWidth)).toBe(
    Math.round(panelMetrics.panelWidth),
  );
  expect(Math.round(panelMetrics.groupWidth)).toBe(288);
  expect(panelMetrics.groupRowGap).toBe("2px");
  expect(Math.round(panelMetrics.itemWidth)).toBe(272);
  expect(Math.round(panelMetrics.itemHeight)).toBe(36);
  expect(panelMetrics.itemPaddingTop).toBe("6px");
  expect(panelMetrics.itemPaddingRight).toBe("8px");
  expect(panelMetrics.itemPaddingBottom).toBe("6px");
  expect(panelMetrics.itemPaddingLeft).toBe("8px");
  expect(Math.round(panelMetrics.iconWidth)).toBe(14);
  expect(panelMetrics.iconColor).toBe("rgb(115, 115, 115)");
  expect(Math.round(panelMetrics.iconLabelGap)).toBe(8);
  expect(panelMetrics.itemLabelFontSize).toBe("13px");
  expect(panelMetrics.itemLabelLineHeight).toBe("18px");
  expect(panelMetrics.itemLabelLetterSpacing).toBe("0.247px");
  expect(panelMetrics.itemLabelWeight).toBe("500");
  expect(panelMetrics.itemLabelColor).toBe("rgb(64, 64, 64)");
  expect(Math.round(panelMetrics.actionSize)).toBe(24);
  expect(panelMetrics.actionMarginLeft).toBe("16px");
  expect(Math.round(panelMetrics.childListOffset)).toBe(26);
  expect(panelMetrics.childListRowGap).toBe("2px");
  expect(Math.round(panelMetrics.railOffset)).toBe(14);
  expect(Math.round(panelMetrics.railHeight)).toBe(
    Math.round(panelMetrics.childListHeight),
  );
  expect(panelMetrics.railColor).toBe("rgb(229, 229, 229)");
  expect(Math.round(panelMetrics.leafWidth)).toBe(246);
  expect(Math.round(panelMetrics.leafHeight)).toBe(32);
  expect(Math.round(panelMetrics.leafRightInset)).toBe(8);
  expect(panelMetrics.leafPaddingTop).toBe("6px");
  expect(panelMetrics.leafPaddingRight).toBe("8px");
  expect(panelMetrics.leafPaddingBottom).toBe("6px");
  expect(panelMetrics.leafPaddingLeft).toBe("8px");
  expect(panelMetrics.leafLabelFontSize).toBe("13px");
  expect(panelMetrics.leafLabelLineHeight).toBe("18px");
  expect(panelMetrics.leafLabelLetterSpacing).toBe("0.247px");
  expect(panelMetrics.leafLabelWeight).toBe("500");
  expect(panelMetrics.leafLabelColor).toBe("rgb(23, 23, 23)");
  expect(panelMetrics.leafBackground).toBe("rgba(0, 0, 0, 0.08)");
  expect(Math.round(panelMetrics.badgeHeight)).toBe(20);
  expect(panelMetrics.badgePaddingTop).toBe("2px");
  expect(panelMetrics.badgePaddingRight).toBe("6px");
  expect(panelMetrics.badgePaddingBottom).toBe("2px");
  expect(panelMetrics.badgePaddingLeft).toBe("6px");
  expect(panelMetrics.badgeFontSize).toBe("12px");
  expect(panelMetrics.badgeLineHeight).toBe("16px");
  expect(panelMetrics.badgeLetterSpacing).toBe("0.3px");
  expect(panelMetrics.badgeWeight).toBe("500");
  expect(panelMetrics.badgeColor).toBe("rgb(23, 23, 23)");
  expect(panelMetrics.badgeBackground).toBe("rgba(0, 0, 0, 0.04)");
  expect(Math.round(panelMetrics.disabledWidth)).toBe(272);
  expect(Math.round(panelMetrics.disabledHeight)).toBe(36);
  expect(panelMetrics.disabledIconColor).toBe("rgb(163, 163, 163)");
  expect(panelMetrics.disabledLabelColor).toBe("rgb(163, 163, 163)");
});

test("customer side panel switches to guardians and search filters rows", async ({
  page,
}) => {
  await page.goto("/w/clair-demo/customer?modulePanel=open");

  await page.getByTestId("customer-side-panel-guardian").click();
  await expect(
    page
      .getByTestId("customer-page-header")
      .getByRole("heading", { name: "보호자" }),
  ).toBeVisible();
  await expect(page.getByTestId("customer-guardian-table")).toBeVisible();
  await expect(
    page.getByTestId("customer-guardian-row-guardian-kang-seoyun"),
  ).toContainText("강서윤");
  await expect(
    page.getByTestId("customer-guardian-row-guardian-kang-seoyun"),
  ).toContainText("하루, 두부");

  await page.getByRole("textbox", { name: "고객관리 검색" }).fill("김하늘");

  await expect(
    page.getByTestId("customer-guardian-row-guardian-kim-haneul"),
  ).toBeVisible();
  await expect(
    page.getByTestId("customer-guardian-row-guardian-kang-seoyun"),
  ).toHaveCount(0);

  await page.getByTestId("customer-guardian-row-guardian-kim-haneul").click();

  await expect(page.getByText("보호자 정보").first()).toBeVisible();
  await expect(page.getByRole("tab", { name: "보호자 정보" })).toBeVisible();
  await expect(page).toHaveURL(
    /drawer=guardian%3Aguardian-kim-haneul|drawer=guardian:guardian-kim-haneul/,
  );
});

test("customer patient table supports single sort and section filter builder", async ({
  page,
}) => {
  await page.goto("/w/clair-demo/customer?modulePanel=open");

  const patientTableSection = page.getByTestId("customer-patient-table");
  const patientRows = patientTableSection.locator(
    '[data-testid^="customer-patient-row-"]',
  );

  await patientTableSection
    .getByRole("button", { name: /등록일시 오름차순 정렬/ })
    .click();
  await expect(patientRows.first()).toContainText("코코");

  await patientTableSection
    .getByRole("button", { name: /현재 정렬: 등록일시 오름차순/ })
    .click();
  await expect(patientRows.first()).toContainText("콩이");

  await patientTableSection
    .getByRole("button", { name: "동물 필터 설정" })
    .click();
  const filterBuilder = page.locator('[data-emr-table-filter-builder="true"]');
  await expect(
    filterBuilder.getByRole("combobox", { name: "필터 필드" }),
  ).toHaveCount(1);
  await expect(page.getByRole("option", { name: "품종" })).toBeVisible();
  await page.getByRole("option", { name: "품종" }).click();
  await expect(
    patientTableSection.getByRole("button", { name: "동물 필터 설정" }),
  ).toBeVisible();
  await expect(patientRows).toHaveCount(5);

  await filterBuilder.getByRole("combobox", { name: "필터 값" }).click();
  await page.getByRole("option", { name: "푸들" }).click();
  await filterBuilder.getByRole("button", { name: "그룹 필터" }).click();
  await filterBuilder
    .getByRole("combobox", { name: "필터 필드" })
    .nth(1)
    .click();
  await page.getByRole("option", { name: "상태" }).click();
  await filterBuilder.getByRole("combobox", { name: "필터 값" }).nth(1).click();
  await page.getByRole("option", { name: "오더진행" }).click();

  await expect(
    patientTableSection.getByRole("button", { name: "동물 필터 2개 설정" }),
  ).toBeVisible();
  await expect(patientRows).toHaveCount(1);
  await expect(patientRows.first()).toContainText("콩이");

  await filterBuilder.getByRole("button", { name: "초기화" }).click();
  await page.keyboard.press("Escape");

  await expect(
    patientTableSection.getByRole("button", { name: "동물 필터 설정" }),
  ).toBeVisible();
  await expect(patientRows).toHaveCount(5);
});

test("customer row action menu closes with Escape and explains unavailable actions", async ({
  page,
}) => {
  await page.goto("/w/clair-demo/customer?modulePanel=open");

  const row = page.getByTestId("customer-patient-row-patient-dubu");
  await row.getByRole("button", { name: "두부 행 작업" }).click();
  await expect(page.getByRole("menu")).toContainText("차트 보러가기");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);

  await row.getByRole("button", { name: "두부 행 작업" }).click();
  await page.getByText("카카오톡 발송", { exact: true }).click();
  await expect(page.getByTestId("customer-row-action-feedback")).toContainText(
    "카카오톡 발송은 아직 연결되지 않았습니다",
  );
  await expect(page.getByRole("menu")).toHaveCount(0);
});

test("customer side panel uses the shared title and collapse header", async ({
  page,
}) => {
  await page.goto("/w/clair-demo/customer?modulePanel=open");

  await expect(page.getByTestId("module-side-panel-title")).toHaveText(
    "고객관리",
  );
  await page
    .getByRole("button", { name: "사이드 패널 접기", exact: true })
    .click();

  await expect(page.getByTestId("customer-side-panel")).toHaveCount(0);
  await expect(page).toHaveURL(/modulePanel=closed/);
});

test("customer deleted history uses the mg table empty state and distinguishes search results", async ({
  page,
}) => {
  await page.goto("/w/clair-demo/customer?modulePanel=open");
  await page.getByTestId("customer-side-panel-deleted").click();

  const emptyState = page.getByTestId("customer-deleted-empty-state");
  await expect(emptyState).toHaveAttribute("data-size", "md");
  await expect(emptyState).toHaveAttribute("data-surface", "table");
  await expect(emptyState).toHaveAttribute("data-kind", "no-data");
  await expect(emptyState).toContainText("삭제된 보호자/동물이 없습니다");
  await expect(emptyState).toContainText("삭제 이력이 없습니다");

  await page.getByPlaceholder("삭제된 보호자/동물 검색").fill("없는 삭제 기록");
  await expect(emptyState).toHaveAttribute("data-kind", "no-filter-results");
  await expect(emptyState).toContainText("조건에 맞는 삭제 항목이 없습니다");
  await expect(emptyState).toContainText(
    "검색어를 바꾸면 삭제 이력이 다시 보입니다",
  );
  await emptyState.getByRole("button", { name: "조건 초기화" }).click();
  await expect(page.getByPlaceholder("삭제된 보호자/동물 검색")).toHaveValue(
    "",
  );
  await expect(emptyState).toHaveAttribute("data-kind", "no-data");
});

test("customer archive table pins identity and restores through the existing target API", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  const archiveRecord = {
    id: "patient-archived-mango",
    target: "patient",
    workspaceId: "clair-demo",
    displayName: "망고",
    status: "soft_deleted",
    deletedAt: "2026-07-20T04:30:00.000Z",
    deletedByUserId: "user-admin",
    auditEvent: {
      action: "soft_delete",
      actorUserId: "user-admin",
      occurredAt: "2026-07-20T04:30:00.000Z",
      target: "patient",
      targetId: "patient-archived-mango",
    },
  };
  let restoreBody: unknown;

  await page.route(
    "**/api/workspaces/clair-demo/customer/archive?status=soft_deleted",
    async (route) => {
      await route.fulfill({
        contentType: "application/json",
        status: 200,
        body: JSON.stringify({
          ok: true,
          status: 200,
          records: [archiveRecord],
          enforcedBy: "customer-archive-list",
        }),
      });
    },
  );
  await page.route(
    "**/api/workspaces/clair-demo/customer/patients/patient-archived-mango/archive",
    async (route) => {
      restoreBody = route.request().postDataJSON();
      await route.fulfill({
        contentType: "application/json",
        status: 200,
        body: JSON.stringify({
          ok: true,
          status: 200,
          record: {
            ...archiveRecord,
            status: "active",
            restoredAt: "2026-07-28T12:00:00.000Z",
            restoredByUserId: "playwright-default-session",
          },
          locks: [],
          enforcedBy: "customer-archive-mutation",
        }),
      });
    },
  );

  await page.goto("/w/clair-demo/customer?modulePanel=open&aside=closed");
  await page.getByTestId("customer-side-panel-deleted").click();

  const section = page.getByTestId("customer-archive-table");
  const table = section.getByRole("table", {
    name: "삭제된 보호자/동물 고객관리 테이블",
  });
  const row = page.getByTestId(
    "customer-archive-row-patient-patient-archived-mango",
  );
  const identityHeader = table.locator(
    'th[data-customer-archive-column="displayName"]',
  );
  const identityCell = row.locator(
    'td[data-customer-archive-column="displayName"]',
  );
  const pinnedViewport = section.locator(
    '[data-emr-pinned-table-viewport="true"]',
  );
  const pinnedDimmer = pinnedViewport.locator(
    '[data-emr-pinned-table-dimmer="true"]',
  );
  const pinnedDivider = pinnedViewport.locator(
    '[data-emr-pinned-table-divider="true"]',
  );

  await expect(section).toHaveAttribute(
    "data-emr-pinned-table-workspace",
    "true",
  );
  await expect(identityHeader).toHaveAttribute(
    "data-emr-column-pinned",
    "left",
  );
  await expect(identityCell).toHaveCSS("position", "sticky");
  await expect(row).toContainText("망고");
  await expect(row).toContainText("동물");

  const heading = section.getByRole("heading", {
    name: "삭제된 보호자/동물",
  });
  const search = section.getByPlaceholder("삭제된 보호자/동물 검색");
  const headerText = identityHeader.locator(
    '[data-emr-table-identity-text="true"]',
  );
  const rowText = identityCell.locator('[data-emr-table-identity-text="true"]');
  const footerTotal = section
    .getByTestId("customer-table-footer")
    .locator("span")
    .first();
  const [headingBox, searchBox, headerBox, rowBox, footerBox] =
    await Promise.all([
      heading.boundingBox(),
      search.boundingBox(),
      headerText.boundingBox(),
      rowText.boundingBox(),
      footerTotal.boundingBox(),
    ]);
  expect(headingBox).not.toBeNull();
  expect(searchBox).not.toBeNull();
  expect(headerBox).not.toBeNull();
  expect(rowBox).not.toBeNull();
  expect(footerBox).not.toBeNull();
  expect(Math.abs(searchBox!.x - headingBox!.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(headerBox!.x - headingBox!.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(rowBox!.x - headingBox!.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(footerBox!.x - headingBox!.x)).toBeLessThanOrEqual(1);

  const archiveScrollContainer = table.locator("xpath=..");
  await expect(archiveScrollContainer).toHaveCSS(
    "overscroll-behavior-x",
    "none",
  );
  await expect(archiveScrollContainer).toHaveCSS(
    "overscroll-behavior-y",
    "none",
  );
  const archiveBoundaryStyles = await pinnedViewport.evaluate((viewport) => {
    const dimmer = viewport.querySelector(
      '[data-emr-pinned-table-dimmer="true"]',
    );
    const divider = viewport.querySelector(
      '[data-emr-pinned-table-divider="true"]',
    );
    if (!(dimmer instanceof HTMLElement) || !(divider instanceof HTMLElement)) {
      throw new Error("Archive pinned boundary layers are missing.");
    }
    const dimmerStyle = getComputedStyle(dimmer);
    return {
      pinnedColumnWidth: getComputedStyle(viewport)
        .getPropertyValue("--emr-table-pinned-column-width")
        .trim(),
      dimmerBackground: dimmerStyle.backgroundColor,
      dimmerOpacity: dimmerStyle.opacity,
      dimmerWidth: dimmerStyle.width,
      dividerWidth: getComputedStyle(divider).width,
    };
  });
  expect(archiveBoundaryStyles).toEqual({
    pinnedColumnWidth: "220px",
    dimmerBackground: "rgb(0, 0, 0)",
    dimmerOpacity: "0.4",
    dimmerWidth: "10px",
    dividerWidth: "1px",
  });
  const [viewportBefore, dimmerBefore, dividerBefore] = await Promise.all([
    pinnedViewport.boundingBox(),
    pinnedDimmer.boundingBox(),
    pinnedDivider.boundingBox(),
  ]);
  await archiveScrollContainer.evaluate((container) => {
    container.scrollLeft = container.scrollWidth;
  });
  const [viewportAfter, dimmerAfter, dividerAfter] = await Promise.all([
    pinnedViewport.boundingBox(),
    pinnedDimmer.boundingBox(),
    pinnedDivider.boundingBox(),
  ]);
  for (const [label, box] of [
    ["viewport before", viewportBefore],
    ["dimmer before", dimmerBefore],
    ["divider before", dividerBefore],
    ["viewport after", viewportAfter],
    ["dimmer after", dimmerAfter],
    ["divider after", dividerAfter],
  ] as const) {
    expect(box, label).not.toBeNull();
  }
  expect(Math.abs(dimmerBefore!.x - viewportBefore!.x - 220)).toBeLessThanOrEqual(
    1,
  );
  expect(Math.abs(dividerBefore!.x - viewportBefore!.x - 219)).toBeLessThanOrEqual(
    1,
  );
  expect(Math.abs(dimmerAfter!.x - dimmerBefore!.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(dividerAfter!.x - dividerBefore!.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(dimmerAfter!.height - viewportAfter!.height)).toBeLessThanOrEqual(
    1,
  );

  await row.getByRole("button", { name: "망고 복원" }).click();
  await expect(row).toHaveCount(0);
  expect(restoreBody).toEqual({ action: "restore" });
  await expect(page.getByTestId("customer-deleted-empty-state")).toContainText(
    "삭제된 보호자/동물이 없습니다",
  );
});

test("customer archive surfaces read and restore permission or retryable failures", async ({
  page,
}) => {
  let allowReadSuccess = false;
  const archiveRecords = [
    {
      id: "patient-archive-denied",
      target: "patient",
      workspaceId: "clair-demo",
      displayName: "권한동물",
      status: "soft_deleted",
      deletedAt: "2026-07-20T04:30:00.000Z",
      deletedByUserId: "user-admin",
      auditEvent: null,
    },
    {
      id: "guardian-archive-error",
      target: "guardian",
      workspaceId: "clair-demo",
      displayName: "실패보호자",
      status: "soft_deleted",
      deletedAt: "2026-07-21T04:30:00.000Z",
      deletedByUserId: "user-admin",
      auditEvent: null,
    },
  ];

  await page.route(
    "**/api/workspaces/clair-demo/customer/archive?status=soft_deleted",
    async (route) => {
      if (!allowReadSuccess) {
        await route.fulfill({
          contentType: "application/json",
          status: 500,
          body: JSON.stringify({ ok: false, error: "db_read_failed" }),
        });
        return;
      }
      await route.fulfill({
        contentType: "application/json",
        status: 200,
        body: JSON.stringify({
          ok: true,
          status: 200,
          records: archiveRecords,
          enforcedBy: "customer-archive-list",
        }),
      });
    },
  );
  await page.route(
    "**/api/workspaces/clair-demo/customer/patients/patient-archive-denied/archive",
    (route) =>
      route.fulfill({
        contentType: "application/json",
        status: 403,
        body: JSON.stringify({
          ok: false,
          status: 403,
          denialReason: "permission_missing",
        }),
      }),
  );
  await page.route(
    "**/api/workspaces/clair-demo/customer/guardians/guardian-archive-error/archive",
    (route) =>
      route.fulfill({
        contentType: "application/json",
        status: 500,
        body: JSON.stringify({
          ok: false,
          status: 500,
          error: "db_write_failed",
        }),
      }),
  );

  await page.goto("/w/clair-demo/customer?modulePanel=open");
  await page.getByTestId("customer-side-panel-deleted").click();

  const readError = page.getByTestId("customer-archive-read-error");
  await expect(readError).toContainText("삭제 이력을 불러오지 못했습니다");
  allowReadSuccess = true;
  await readError.getByRole("button", { name: "다시 시도" }).click();

  const deniedRow = page.getByTestId(
    "customer-archive-row-patient-patient-archive-denied",
  );
  const errorRow = page.getByTestId(
    "customer-archive-row-guardian-guardian-archive-error",
  );
  await expect(deniedRow).toBeVisible();
  await deniedRow.getByRole("button", { name: "권한동물 복원" }).click();
  await expect(
    page.getByTestId("customer-archive-mutation-alert"),
  ).toContainText("삭제 항목을 복원할 권한이 없습니다");
  await expect(deniedRow).toBeVisible();

  await errorRow.getByRole("button", { name: "실패보호자 복원" }).click();
  await expect(
    page.getByTestId("customer-archive-mutation-alert"),
  ).toContainText("삭제 항목을 복원하지 못했습니다");
  await expect(errorRow).toBeVisible();
});

test("common patient and guardian drawers are available outside reception", async ({
  page,
}) => {
  await page.goto(
    "/w/clair-demo/billing?modulePanel=open&right=open&drawer=patient:patient-coco",
  );

  await expect(page.getByText("환자 정보").first()).toBeVisible();
  await expect(page.getByRole("tab", { name: "환자 정보" })).toBeVisible();
  await page.getByRole("button", { name: "보호자 이지은 보기" }).click();

  await expect(page.getByText("보호자 정보").first()).toBeVisible();
  await expect(page).toHaveURL(
    /drawer=guardian%3Aguardian-lee-jieun|drawer=guardian:guardian-lee-jieun/,
  );
});

test("patient and guardian profiles share the right-panel slot and push customer content", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto(
    "/w/clair-demo/customer?modulePanel=open&drawer=patient:patient-coco",
  );

  const frame = page.locator("main.emr-workspace-frame-responsive");
  const mainContent = page.getByTestId("workspace-main-content");
  const rightPanel = page.getByTestId("workspace-right-panel");
  const profilePanel = page.getByTestId("profile-side-panel");
  const getProfileGestureState = () =>
    profilePanel.evaluate((panel) => {
      const viewport = panel.querySelector<HTMLElement>(
        '[data-slot="scroll-area-viewport"]',
      );
      if (!viewport) throw new Error("profile_scroll_viewport_missing");

      const panelStyles = getComputedStyle(panel);
      const viewportStyles = getComputedStyle(viewport);
      return {
        panel: {
          overscrollBehaviorX: panelStyles.overscrollBehaviorX,
          touchAction: panelStyles.touchAction,
        },
        viewport: {
          overflowX: viewportStyles.overflowX,
          overscrollBehaviorX: viewportStyles.overscrollBehaviorX,
          scrollLeft: viewport.scrollLeft,
          touchAction: viewportStyles.touchAction,
        },
      };
    });
  const expectHorizontalWheelLocked = async () => {
    const viewport = profilePanel.locator('[data-slot="scroll-area-viewport"]');
    await viewport.evaluate((element) => {
      element.scrollLeft = 0;
    });
    await viewport.hover();
    await page.mouse.wheel(120, 0);
    await expect.poll(getProfileGestureState).toMatchObject({
      viewport: {
        overflowX: "hidden",
        scrollLeft: 0,
      },
    });
  };

  await expect(profilePanel).toHaveAttribute("data-profile-kind", "patient");
  await expect
    .poll(() =>
      profilePanel
        .locator("[data-profile-definition-icon]")
        .evaluateAll((icons) => icons.map((icon) => icon.getAttribute("data-profile-definition-icon"))),
    )
    .toEqual([
      "pet",
      "paw-print",
      "user",
      "clock",
      "calendar",
      "scan-line",
      "file-user",
      "notebook-text",
    ]);
  await expect.poll(getProfileGestureState).toEqual({
    panel: { overscrollBehaviorX: "none", touchAction: "pan-y" },
    viewport: {
      overflowX: "hidden",
      overscrollBehaviorX: "none",
      scrollLeft: 0,
      touchAction: "pan-y",
    },
  });
  await expectHorizontalWheelLocked();
  await expect(page.getByTestId("workspace-drawer")).toHaveCount(0);
  await expect
    .poll(async () => (await rightPanel.boundingBox())?.width)
    .toBe(380);

  const [frameBox, mainContentBox, rightPanelBox] = await Promise.all([
    frame.boundingBox(),
    mainContent.boundingBox(),
    rightPanel.boundingBox(),
  ]);
  expect(frameBox).not.toBeNull();
  expect(mainContentBox).not.toBeNull();
  expect(rightPanelBox).not.toBeNull();
  expect(rightPanelBox?.width).toBe(380);
  expect(rightPanelBox!.x - (mainContentBox!.x + mainContentBox!.width)).toBe(
    10,
  );
  expect(frameBox!.x + frameBox!.width).toBe(
    rightPanelBox!.x + rightPanelBox!.width,
  );

  await page.getByRole("button", { name: "보호자 이지은 보기" }).click();
  await expect(profilePanel).toHaveAttribute("data-profile-kind", "guardian");
  await expect
    .poll(() =>
      profilePanel
        .locator("[data-profile-definition-icon]")
        .evaluateAll((icons) => icons.map((icon) => icon.getAttribute("data-profile-definition-icon"))),
    )
    .toEqual(["user", "calendar", "phone", "mail", "map-pin", "notebook-text"]);
  await expect.poll(getProfileGestureState).toEqual({
    panel: { overscrollBehaviorX: "none", touchAction: "pan-y" },
    viewport: {
      overflowX: "hidden",
      overscrollBehaviorX: "none",
      scrollLeft: 0,
      touchAction: "pan-y",
    },
  });
  await expectHorizontalWheelLocked();

  const guardianRightPanelBox = await rightPanel.boundingBox();
  expect(guardianRightPanelBox).not.toBeNull();
  expect(guardianRightPanelBox?.x).toBe(rightPanelBox?.x);
  expect(guardianRightPanelBox?.width).toBe(rightPanelBox?.width);
  await expect(page.getByTestId("workspace-drawer")).toHaveCount(0);
});

test("profile panels keep one scroll-fade viewport", async ({ page }) => {
  await page.goto(
    "/w/clair-demo/customer?modulePanel=open&drawer=patient:patient-coco",
  );

  const profilePanel = page.getByTestId("profile-side-panel");
  const viewport = profilePanel.locator('[data-slot="scroll-area-viewport"]');

  await expect(viewport).toHaveCount(1);
  await expect(viewport).toHaveClass(/scroll-fade-y/);
  await expect(viewport).toHaveClass(/scroll-fade-8/);
});
